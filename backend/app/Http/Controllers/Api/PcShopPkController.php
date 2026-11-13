<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PcShopPkPatternCompiler;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Other → PC SHOP PK
 * LINE bot "PC SHOP PK" data — schema pc_shop_pk in n8n_database ("n8n" connection).
 * Written by the n8n workflow "PC SHOP PK: LINE Order Capture" (message pattern SKU/QTY/PRICE).
 */
class PcShopPkController extends Controller
{
    private const SCHEMA = 'pc_shop_pk';

    private function table(string $name): Builder
    {
        return DB::connection('n8n')->table(self::SCHEMA . '.' . $name);
    }

    /** ILIKE search across $columns + pagination (per_page capped at 200). */
    private function respond(Builder $query, Request $request, array $columns): JsonResponse
    {
        if ($request->filled('search')) {
            $like = '%' . addcslashes(trim($request->string('search')->toString()), '%_\\') . '%';
            $query->where(function ($q) use ($columns, $like) {
                foreach ($columns as $col) {
                    $q->orWhereRaw("CAST({$col} AS TEXT) ILIKE ?", [$like]);
                }
            });
        }

        $perPage = max(1, min($request->integer('per_page', 20), 200));

        return response()->json($query->paginate($perPage));
    }

    private function applyDateRange(Builder $query, Request $request, string $column): void
    {
        if ($request->filled('date_from')) {
            $query->whereDate($column, '>=', $request->date_from);
        }
        if ($request->filled('date_to')) {
            $query->whereDate($column, '<=', $request->date_to);
        }
    }

    // line_order_messages — orders parsed from "SKU/QTY/PRICE" lines
    public function orderMessages(Request $request): JsonResponse
    {
        $s = self::SCHEMA;
        $query = $this->table('line_order_messages as o')
            ->leftJoin("{$s}.line_users as u", 'u.user_id', '=', 'o.user_id')
            ->leftJoin("{$s}.line_groups as g", 'g.group_id', '=', 'o.group_id')
            ->leftJoin("{$s}.order_patterns as p", 'p.id', '=', 'o.pattern_id')
            ->select([
                'o.id', 'o.message_id', 'o.source_type', 'o.group_id', 'g.group_name', 'o.user_id', 'u.display_name',
                'o.order_date', 'o.order_seq', 'o.sku', 'o.quantity', 'o.price',
                DB::raw('(o.quantity * o.price) AS line_total'),
                'o.branch_code', 'o.note', 'o.extra', 'o.pattern_id', 'p.name as pattern_name',
                'o.raw_line', 'o.raw_text', 'o.parsed_at',
            ])
            ->orderByDesc('o.order_date')
            ->orderByDesc('o.parsed_at')
            ->orderBy('o.order_seq');

        $this->applyDateRange($query, $request, 'o.order_date');
        if ($request->filled('source_type')) {
            $query->where('o.source_type', $request->source_type);
        }
        if ($request->filled('pattern_id')) {
            $query->where('o.pattern_id', $request->integer('pattern_id'));
        }
        if ($request->filled('group_id')) {
            $query->where('o.group_id', $request->group_id);
        }

        return $this->respond($query, $request, [
            'o.sku', 'o.raw_line', 'o.branch_code', 'o.message_id', 'u.display_name', 'g.group_name',
        ]);
    }

    // line_messages — raw LINE messages
    public function messages(Request $request): JsonResponse
    {
        $s = self::SCHEMA;
        $query = $this->table('line_messages as m')
            ->leftJoin("{$s}.line_users as u", 'u.user_id', '=', 'm.user_id')
            ->leftJoin("{$s}.line_groups as g", 'g.group_id', '=', 'm.group_id')
            ->select([
                'm.id', 'm.message_id', 'm.source_type', 'm.group_id', 'g.group_name', 'm.user_id', 'u.display_name',
                'm.message_type', 'm.message_text', 'm.sent_at', 'm.received_at',
            ])
            ->orderByDesc('m.sent_at')
            ->orderByDesc('m.id');

        $this->applyDateRange($query, $request, 'm.sent_at');
        if ($request->filled('message_type')) {
            $query->where('m.message_type', $request->message_type);
        }
        if ($request->filled('source_type')) {
            $query->where('m.source_type', $request->source_type);
        }
        if ($request->filled('group_id')) {
            $query->where('m.group_id', $request->group_id);
        }

        return $this->respond($query, $request, [
            'm.message_text', 'm.message_id', 'm.message_type', 'u.display_name', 'g.group_name',
        ]);
    }

    /** Group dropdown for the order / message filters (name falls back to the linked customer, then the raw id). */
    public function groupOptions(): JsonResponse
    {
        $s = self::SCHEMA;
        $rows = $this->table('line_groups as g')
            ->leftJoin("{$s}.customers as c", 'c.group_id', '=', 'g.group_id')
            ->select([
                'g.group_id',
                DB::raw('COALESCE(g.group_name, c.customer_name, g.group_id) AS label'),
                'c.customer_code',
            ])
            ->orderByRaw('COALESCE(g.group_name, c.customer_name) NULLS LAST')
            ->orderBy('g.group_id')
            ->get();

        return response()->json(['data' => $rows]);
    }

    // line_users
    public function users(Request $request): JsonResponse
    {
        $query = $this->table('line_users')
            ->select(['id', 'user_id', 'display_name', 'picture_url', 'can_use_bot', 'last_synced_at'])
            ->orderBy('display_name');

        return $this->respond($query, $request, ['user_id', 'display_name']);
    }

    // line_groups
    public function groups(Request $request): JsonResponse
    {
        $query = $this->table('line_groups')
            ->select(['id', 'group_id', 'group_name', 'is_active', 'joined_at', 'last_message_at'])
            ->orderByDesc('last_message_at');

        return $this->respond($query, $request, ['group_id', 'group_name']);
    }

    // line_channels — channel_secret / channel_access_token are never returned
    public function channels(Request $request): JsonResponse
    {
        $query = $this->table('line_channels')
            ->select([
                'id', 'channel_name', 'channel_id', 'created_at', 'updated_at',
                DB::raw("(channel_secret IS NOT NULL AND channel_secret <> '') AS has_secret"),
                DB::raw("(channel_access_token IS NOT NULL AND channel_access_token <> '') AS has_access_token"),
            ])
            ->orderBy('channel_name');

        return $this->respond($query, $request, ['channel_name', 'channel_id']);
    }

    // ───────────────────────── customers (customer master, linked to line_groups by group_id) ─────────────────────────

    public const CUSTOMER_STATUSES = ['active', 'inactive', 'suspended'];

    public function customers(Request $request): JsonResponse
    {
        $s = self::SCHEMA;
        $query = $this->table('customers as c')
            ->leftJoin("{$s}.line_groups as g", 'g.group_id', '=', 'c.group_id')
            ->select([
                'c.id', 'c.customer_code', 'c.customer_name', 'c.customer_status', 'c.customer_type',
                'c.group_id', 'g.group_name', 'g.last_message_at', 'c.note', 'c.created_at', 'c.updated_at',
            ])
            ->orderBy('c.customer_code');

        if ($request->filled('customer_status')) {
            $query->where('c.customer_status', $request->customer_status);
        }
        if ($request->filled('customer_type')) {
            $query->where('c.customer_type', $request->customer_type);
        }
        if ($request->input('linked') === '1') {
            $query->whereNotNull('c.group_id');
        } elseif ($request->input('linked') === '0') {
            $query->whereNull('c.group_id');
        }

        return $this->respond($query, $request, [
            'c.customer_code', 'c.customer_name', 'c.customer_type', 'c.group_id', 'g.group_name', 'c.note',
        ]);
    }

    /** Dropdown data for the customer form: every LINE group (+ which customer holds it) and the types in use. */
    public function customerOptions(): JsonResponse
    {
        $s = self::SCHEMA;
        $groups = $this->table('line_groups as g')
            ->leftJoin("{$s}.customers as c", 'c.group_id', '=', 'g.group_id')
            ->select(['g.group_id', 'g.group_name', 'c.id as customer_id', 'c.customer_code'])
            ->orderByRaw('g.group_name NULLS LAST')
            ->orderBy('g.group_id')
            ->get();

        $types = $this->table('customers')
            ->whereNotNull('customer_type')
            ->distinct()
            ->orderBy('customer_type')
            ->pluck('customer_type');

        return response()->json(['groups' => $groups, 'types' => $types]);
    }

    public function storeCustomer(Request $request): JsonResponse
    {
        $row = $this->customerPayload($request);
        $id = $this->table('customers')->insertGetId($row);

        return response()->json(['message' => 'เพิ่มลูกค้าแล้ว', 'id' => $id], 201);
    }

    public function updateCustomer(Request $request, int $id): JsonResponse
    {
        abort_unless($this->table('customers')->where('id', $id)->exists(), 404);

        $this->table('customers')->where('id', $id)->update($this->customerPayload($request, $id));

        return response()->json(['message' => 'บันทึกแล้ว']);
    }

    public function destroyCustomer(int $id): JsonResponse
    {
        $deleted = $this->table('customers')->where('id', $id)->delete();
        abort_unless($deleted, 404);

        return response()->json(['message' => 'ลบลูกค้าแล้ว']);
    }

    private function customerPayload(Request $request, ?int $id = null): array
    {
        $s = self::SCHEMA;
        $data = $request->validate([
            'customer_code'   => ['required', 'string', 'max:50', "unique:n8n.{$s}.customers,customer_code" . ($id ? ",{$id}" : '')],
            'customer_name'   => ['required', 'string', 'max:255'],
            'customer_status' => ['required', 'in:' . implode(',', self::CUSTOMER_STATUSES)],
            'customer_type'   => ['nullable', 'string', 'max:50'],
            'group_id'        => [
                'nullable', 'string', 'max:64',
                "exists:n8n.{$s}.line_groups,group_id",
                "unique:n8n.{$s}.customers,group_id" . ($id ? ",{$id}" : ''),
            ],
            'note'            => ['nullable', 'string'],
        ], [
            'customer_code.unique' => 'รหัสลูกค้านี้มีอยู่แล้ว',
            'customer_status.in'   => 'สถานะลูกค้าไม่ถูกต้อง',
            'group_id.exists'      => 'ไม่พบกลุ่ม LINE นี้',
            'group_id.unique'      => 'กลุ่ม LINE นี้ผูกกับลูกค้ารายอื่นแล้ว',
        ]);

        $data['customer_code'] = trim($data['customer_code']);
        $data['customer_name'] = trim($data['customer_name']);
        $data['customer_type'] = filled($data['customer_type'] ?? null) ? trim($data['customer_type']) : null;
        $data['group_id']      = filled($data['group_id'] ?? null) ? $data['group_id'] : null;
        $data['note']          = filled($data['note'] ?? null) ? $data['note'] : null;

        return $data;
    }

    // ───────────────────────── order_patterns (configurable parsing) ─────────────────────────

    public function patterns(): JsonResponse
    {
        $s = self::SCHEMA;
        $rows = $this->table('order_patterns as p')
            ->select([
                'p.*',
                DB::raw("(SELECT count(*) FROM {$s}.line_order_messages o WHERE o.pattern_id = p.id) AS order_count"),
                DB::raw("(SELECT max(o.parsed_at) FROM {$s}.line_order_messages o WHERE o.pattern_id = p.id) AS last_matched_at"),
            ])
            ->orderBy('p.priority')
            ->orderBy('p.id')
            ->get()
            ->map(fn ($r) => $this->decodePattern($r));

        return response()->json([
            'data'   => $rows,
            'fields' => array_keys(PcShopPkPatternCompiler::FIELDS),
        ]);
    }

    public function storePattern(Request $request, PcShopPkPatternCompiler $compiler): JsonResponse
    {
        $row = $this->patternPayload($request, $compiler);
        $row['created_by'] = $row['updated_by'];
        $row['created_at'] = now();

        $id = $this->table('order_patterns')->insertGetId($row);

        return response()->json(['message' => 'เพิ่มรูปแบบแล้ว', 'id' => $id], 201);
    }

    public function updatePattern(Request $request, int $id, PcShopPkPatternCompiler $compiler): JsonResponse
    {
        abort_unless($this->table('order_patterns')->where('id', $id)->exists(), 404);

        $this->table('order_patterns')->where('id', $id)->update($this->patternPayload($request, $compiler));

        return response()->json(['message' => 'บันทึกแล้ว']);
    }

    public function destroyPattern(int $id): JsonResponse
    {
        // Orders already parsed keep pattern_id (shown as "ลบแล้ว"); nothing else references it.
        $deleted = $this->table('order_patterns')->where('id', $id)->delete();
        abort_unless($deleted, 404);

        return response()->json(['message' => 'ลบรูปแบบแล้ว']);
    }

    /**
     * Try the parser on sample text.
     * With `pattern` (unsaved form values) only that pattern is tested; otherwise every active pattern.
     */
    public function testPattern(Request $request, PcShopPkPatternCompiler $compiler): JsonResponse
    {
        $request->validate([
            'text'     => 'required|string|max:5000',
            'group_id' => 'nullable|string|max:100',
            'pattern'  => 'nullable|array',
        ]);

        $patterns = null;
        if ($request->filled('pattern')) {
            $draft = $request->input('pattern');
            $compiled = $compiler->compile($draft);
            $patterns = json_encode([[
                'id'       => isset($draft['id']) ? (int) $draft['id'] : null,
                'name'     => $draft['name'] ?? 'ทดสอบ',
                'regex'    => $compiled['regex'],
                'fields'   => $compiled['fields'],
                'prefix'   => $draft['prefix'] ?? null,
                'defaults' => (object) $this->cleanDefaults($draft['defaults'] ?? []),
            ]], JSON_UNESCAPED_UNICODE);
        }

        $rows = DB::connection('n8n')->select(
            'SELECT * FROM pc_shop_pk.parse_order_text(?, ?, ?::jsonb)',
            [$request->string('text')->toString(), $request->input('group_id'), $patterns]
        );

        return response()->json([
            'data'     => array_map(function ($r) {
                $r->extra = $r->extra ? json_decode($r->extra, true) : null;
                return $r;
            }, $rows),
            'compiled' => isset($compiled) ? $compiled : null,
        ]);
    }

    /** Text messages that produced no order rows (candidates for a new pattern / re-parse). */
    public function unmatched(Request $request): JsonResponse
    {
        $s = self::SCHEMA;
        $query = $this->table('line_messages as m')
            ->leftJoin("{$s}.line_users as u", 'u.user_id', '=', 'm.user_id')
            ->leftJoin("{$s}.line_groups as g", 'g.group_id', '=', 'm.group_id')
            ->where('m.message_type', 'text')
            ->whereRaw("NOT EXISTS (SELECT 1 FROM {$s}.line_order_messages o WHERE o.message_id = m.message_id)")
            ->select([
                'm.id', 'm.message_id', 'm.source_type', 'm.group_id', 'g.group_name', 'm.user_id', 'u.display_name',
                'm.message_text', 'm.sent_at',
                DB::raw("EXISTS (SELECT 1 FROM {$s}.parse_order_text(m.message_text, m.group_id) x WHERE x.looks_like_order) AS looks_like_order"),
            ])
            ->orderByDesc('m.sent_at')
            ->orderByDesc('m.id');

        $this->applyDateRange($query, $request, 'm.sent_at');
        if ($request->input('suspect') === '1') {
            $query->whereRaw("EXISTS (SELECT 1 FROM {$s}.parse_order_text(m.message_text, m.group_id) x WHERE x.looks_like_order)");
        }

        return $this->respond($query, $request, ['m.message_text', 'u.display_name', 'g.group_name']);
    }

    /** Re-run the active patterns on text messages that have no order rows yet (date range by sent_at). */
    public function reparse(Request $request): JsonResponse
    {
        $request->validate([
            'date_from' => 'required|date',
            'date_to'   => 'required|date|after_or_equal:date_from',
        ]);
        $s = self::SCHEMA;

        $result = DB::connection('n8n')->selectOne("
            WITH msgs AS (
                SELECT m.* FROM {$s}.line_messages m
                 WHERE m.message_type = 'text'
                   AND m.sent_at::date BETWEEN ?::date AND ?::date
                   AND NOT EXISTS (SELECT 1 FROM {$s}.line_order_messages o WHERE o.message_id = m.message_id)
            ),
            ins AS (
                INSERT INTO {$s}.line_order_messages
                    (message_id, order_seq, source_type, group_id, user_id, order_date, sku, quantity, price,
                     branch_code, note, extra, pattern_id, raw_line, raw_text)
                SELECT m.message_id, p.order_seq, m.source_type, m.group_id, m.user_id,
                       COALESCE(p.order_date, m.sent_at::date), p.sku, p.quantity, p.price,
                       p.branch_code, p.note, p.extra, p.pattern_id, p.raw_line, m.message_text
                  FROM msgs m
                 CROSS JOIN LATERAL {$s}.parse_order_text(m.message_text, m.group_id) p
                 WHERE p.matched
                ON CONFLICT (message_id, order_seq) DO NOTHING
                RETURNING message_id
            )
            SELECT (SELECT count(*) FROM msgs)::int AS checked,
                   count(*)::int AS orders,
                   count(DISTINCT message_id)::int AS messages
              FROM ins
        ", [$request->date_from, $request->date_to]);

        return response()->json([
            'message' => "ตรวจ {$result->checked} ข้อความ · จับได้ {$result->messages} ข้อความ ({$result->orders} รายการ)",
            ...(array) $result,
        ]);
    }

    private function patternPayload(Request $request, PcShopPkPatternCompiler $compiler): array
    {
        $data = $request->validate([
            'name'        => 'required|string|max:100',
            'mode'        => 'required|in:template,regex',
            'template'    => 'required_if:mode,template|nullable|string|max:300',
            'regex'       => 'required_if:mode,regex|nullable|string|max:1000',
            'fields'      => 'nullable',
            'prefix'      => 'nullable|string|max:10',
            'group_ids'   => 'nullable|array',
            'group_ids.*' => 'string|max:100',
            'defaults'    => 'nullable|array',
            'defaults.qty'   => 'nullable|numeric|gt:0',
            'defaults.price' => 'nullable|numeric|min:0',
            'priority'    => 'required|integer|min:0|max:9999',
            'is_active'   => 'required|boolean',
            'note'        => 'nullable|string|max:500',
        ]);

        $compiled = $compiler->compile($data);
        $groups = array_values(array_filter(array_map('trim', $data['group_ids'] ?? [])));

        return [
            'name'       => trim($data['name']),
            'mode'       => $data['mode'],
            'template'   => $data['mode'] === 'template' ? trim($data['template']) : null,
            'regex'      => $compiled['regex'],
            'fields'     => $this->pgArray($compiled['fields']),
            'prefix'     => ($data['prefix'] ?? '') !== '' ? $data['prefix'] : null,
            'group_ids'  => $groups ? $this->pgArray($groups) : null,
            'defaults'   => json_encode((object) $this->cleanDefaults($data['defaults'] ?? [])),
            'priority'   => $data['priority'],
            'is_active'  => $data['is_active'],
            'note'       => $data['note'] ?? null,
            'updated_by' => $request->user()?->name,
            'updated_at' => now(),
        ];
    }

    /** Only qty / price defaults, stored as strings (the parser reads them as text). */
    private function cleanDefaults(array $defaults): array
    {
        $out = [];
        foreach (['qty', 'price'] as $k) {
            if (isset($defaults[$k]) && $defaults[$k] !== '' && is_numeric($defaults[$k])) {
                $out[$k] = (string) $defaults[$k];
            }
        }
        return $out;
    }

    /** PHP array -> Postgres text[] literal. */
    private function pgArray(array $values): string
    {
        return '{' . implode(',', array_map(
            fn ($v) => '"' . str_replace(['\\', '"'], ['\\\\', '\\"'], (string) $v) . '"',
            $values
        )) . '}';
    }

    private function decodePattern(object $r): object
    {
        $parse = fn (?string $v) => $v === null || $v === '{}' ? [] : str_getcsv(trim($v, '{}'), ',', '"', '\\');
        $r->fields = $parse($r->fields);
        $r->group_ids = $parse($r->group_ids);
        $r->defaults = $r->defaults ? json_decode($r->defaults, true) : [];
        return $r;
    }
}
