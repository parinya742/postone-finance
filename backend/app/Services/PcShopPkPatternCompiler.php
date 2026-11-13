<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * PC SHOP PK — turns an order-message pattern into the (regex, fields) pair used by
 * the Postgres function pc_shop_pk.parse_order_text().
 *
 * Template mode: placeholders in braces, everything else is literal text.
 *   {sku}/{qty}/{price}        -> 50299/1/1890
 *   {sku} x{qty} @{price}      -> 50299 x2 @1890
 * Spaces around literal text are optional when typing; a literal that is only spaces needs ≥1 space.
 * Regex is PostgreSQL ARE syntax, matched case-insensitively.
 */
class PcShopPkPatternCompiler
{
    private const NUMBER = '([0-9][0-9,]*(?:\.[0-9]+)?)';

    /** Known fields => capture group. Unknown {name} fields capture one word and go to `extra`. */
    public const FIELDS = [
        'sku'    => '([A-Za-z0-9][A-Za-z0-9-]*)',
        'qty'    => self::NUMBER,
        'price'  => self::NUMBER,
        'branch' => '([A-Za-z0-9-]+)',
        'date'   => '([0-9]{1,2}[/.-][0-9]{1,2}[/.-][0-9]{2,4})',
        'note'   => '(.*)',
    ];

    private const CUSTOM_FIELD = '(\S+)';

    /**
     * @param  array{mode:string, template?:?string, regex?:?string, fields?:array|string|null}  $input
     * @return array{regex:string, fields:string[]}
     */
    public function compile(array $input): array
    {
        $result = ($input['mode'] ?? 'template') === 'regex'
            ? $this->fromRegex((string) ($input['regex'] ?? ''), $input['fields'] ?? [])
            : $this->fromTemplate((string) ($input['template'] ?? ''));

        $this->assertValidInPostgres($result['regex']);

        return $result;
    }

    /** @return array{regex:string, fields:string[]} */
    public function fromTemplate(string $template): array
    {
        $template = trim($template);
        if ($template === '') {
            $this->fail('template', 'กรุณากรอกรูปแบบข้อความ');
        }

        $parts = preg_split('/(\{[A-Za-z_][A-Za-z0-9_]*\})/', $template, -1, PREG_SPLIT_DELIM_CAPTURE);
        $regex = '';
        $fields = [];
        $prevWasField = false;

        foreach ($parts as $part) {
            if (preg_match('/^\{([A-Za-z_][A-Za-z0-9_]*)\}$/', $part, $m)) {
                $name = strtolower($m[1]);
                if ($prevWasField) {
                    $this->fail('template', "ต้องมีตัวคั่นระหว่างช่องข้อมูล (ก่อน {{$name}})");
                }
                if (in_array($name, $fields, true)) {
                    $this->fail('template', "ช่อง {{$name}} ซ้ำกัน");
                }
                $fields[] = $name;
                $regex .= self::FIELDS[$name] ?? self::CUSTOM_FIELD;
                $prevWasField = true;
                continue;
            }

            if ($part === '') {
                continue;
            }
            if (str_contains($part, '{') || str_contains($part, '}')) {
                $this->fail('template', 'ชื่อช่องข้อมูลต้องเป็นภาษาอังกฤษในวงเล็บปีกกา เช่น {sku}');
            }
            $trimmed = trim($part);
            $regex .= $trimmed === ''
                ? '\s+'
                : '\s*' . preg_replace('/\s+/', '\s+', $this->escape($trimmed)) . '\s*';
            $prevWasField = false;
        }

        $this->assertHasSku($fields, 'template');

        return ['regex' => '^\s*' . $regex . '\s*$', 'fields' => $fields];
    }

    /** @return array{regex:string, fields:string[]} */
    public function fromRegex(string $regex, array|string|null $fields): array
    {
        $regex = trim($regex);
        if ($regex === '') {
            $this->fail('regex', 'กรุณากรอก Regex');
        }

        $fields = is_array($fields) ? $fields : explode(',', (string) $fields);
        $fields = array_values(array_filter(array_map(fn ($f) => strtolower(trim((string) $f)), $fields), fn ($f) => $f !== ''));
        foreach ($fields as $f) {
            if (! preg_match('/^[a-z_][a-z0-9_]*$/', $f)) {
                $this->fail('fields', "ชื่อช่อง \"{$f}\" ไม่ถูกต้อง (a-z, 0-9, _)");
            }
        }
        $this->assertHasSku($fields, 'fields');

        // capturing groups = "(" not escaped and not followed by "?"
        $groups = preg_match_all('/(?<!\\\\)\((?!\?)/', $regex);
        if ($groups !== count($fields)) {
            $this->fail('fields', "Regex มี {$groups} กลุ่ม แต่ระบุชื่อช่องไว้ " . count($fields) . ' ช่อง');
        }

        return ['regex' => $regex, 'fields' => $fields];
    }

    private function escape(string $literal): string
    {
        return preg_replace('/([\\\\^$.|?*+()\[\]{}])/', '\\\\$1', $literal);
    }

    private function assertHasSku(array $fields, string $key): void
    {
        if (! in_array('sku', $fields, true)) {
            $this->fail($key, 'ต้องมีช่อง {sku} (รหัสสินค้า) อย่างน้อย 1 ช่อง');
        }
    }

    private function assertValidInPostgres(string $regex): void
    {
        try {
            DB::connection('n8n')->select('SELECT regexp_match(?, ?, ?) AS m', ['', $regex, 'i']);
        } catch (\Throwable $e) {
            $this->fail('regex', 'Regex ไม่ถูกต้อง: ' . preg_replace('/\s*\(Connection:.*$/s', '', $e->getMessage()));
        }
    }

    private function fail(string $key, string $message): never
    {
        throw ValidationException::withMessages([$key => $message]);
    }
}
