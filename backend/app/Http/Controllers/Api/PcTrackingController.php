<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Other → ติดตามงาน PC
 * LINE bot data from the EDI database ("edi" connection, DB_*_EDI in .env).
 */
class PcTrackingController extends Controller
{
    /** LINE groups whose orders / messages are shown (config services.pc_tracking.line_group_ids). */
    public static function lineGroupIds(): array
    {
        return config('services.pc_tracking.line_group_ids') ?: ['__none__'];
    }

    private function edi(): \Illuminate\Database\Connection
    {
        return DB::connection('edi');
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

    // line_order_messages — orders parsed from LINE messages
    public function orderMessages(Request $request): JsonResponse
    {
        $query = $this->edi()->table('line_order_messages as o')
            ->leftJoin('line_users as u', 'u.user_id', '=', 'o.user_id')
            ->leftJoin('line_groups as g', 'g.group_id', '=', 'o.group_id')
            ->select([
                'o.id', 'o.message_id', 'o.group_id', 'g.group_name', 'o.user_id', 'u.display_name',
                'o.order_date', 'o.order_date_iso', 'o.order_seq', 'o.branch_code', 'o.sku',
                'o.quantity', 'o.amount', 'o.raw_text', 'o.parsed_at',
            ])
            ->orderByDesc('o.order_date_iso')
            ->orderByDesc('o.order_seq')
            ->orderByDesc('o.id');

        $this->applyDateRange($query, $request, 'o.order_date_iso');
        $query->whereIn('o.group_id', self::lineGroupIds());

        return $this->respond($query, $request, [
            'o.branch_code', 'o.sku', 'o.raw_text', 'o.message_id', 'u.display_name', 'g.group_name',
        ]);
    }

    // line_messages — raw LINE messages
    public function messages(Request $request): JsonResponse
    {
        $query = $this->edi()->table('line_messages as m')
            ->leftJoin('line_users as u', 'u.user_id', '=', 'm.user_id')
            ->leftJoin('line_groups as g', 'g.group_id', '=', 'm.group_id')
            ->select([
                'm.id', 'm.message_id', 'm.group_id', 'g.group_name', 'm.user_id', 'u.display_name',
                'm.message_type', 'm.message_text', 'm.sent_at', 'm.received_at',
            ])
            ->orderByDesc('m.sent_at')
            ->orderByDesc('m.id');

        $this->applyDateRange($query, $request, 'm.sent_at');
        $query->whereIn('m.group_id', self::lineGroupIds());
        if ($request->filled('message_type')) {
            $query->where('m.message_type', $request->message_type);
        }

        return $this->respond($query, $request, [
            'm.message_text', 'm.message_id', 'm.message_type', 'u.display_name', 'g.group_name',
        ]);
    }

    // line_users
    public function users(Request $request): JsonResponse
    {
        $query = $this->edi()->table('line_users')
            ->select(['id', 'user_id', 'display_name', 'picture_url', 'can_use_bot', 'last_synced_at'])
            ->orderBy('display_name');

        return $this->respond($query, $request, ['user_id', 'display_name']);
    }

    // line_groups
    public function groups(Request $request): JsonResponse
    {
        $query = $this->edi()->table('line_groups')
            ->select(['id', 'group_id', 'group_name', 'is_active', 'joined_at', 'last_message_at'])
            ->orderByDesc('last_message_at');

        return $this->respond($query, $request, ['group_id', 'group_name']);
    }

    // line_channels — channel_secret / channel_access_token are never returned
    public function channels(Request $request): JsonResponse
    {
        $query = $this->edi()->table('line_channels')
            ->select([
                'id', 'channel_name', 'channel_id', 'created_at', 'updated_at',
                DB::raw("(channel_secret IS NOT NULL AND channel_secret <> '') AS has_secret"),
                DB::raw("(channel_access_token IS NOT NULL AND channel_access_token <> '') AS has_access_token"),
            ])
            ->orderBy('channel_name');

        return $this->respond($query, $request, ['channel_name', 'channel_id']);
    }
}
