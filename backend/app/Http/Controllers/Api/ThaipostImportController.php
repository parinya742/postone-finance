<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LineGroupFile;
use App\Models\LineGroupExtractedFile;
use App\Models\ThailandPostAcceptance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use App\Models\AuditLog;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

class ThaipostImportController extends Controller
{
    // Generic fallback: flexible header aliases
    private const HEADER_MAP = [
        'barcode'         => ['barcode', 'บาร์โค้ด', 'เลขพัสดุ', 'tracking no', 'barcode no'],
        'recipient_name'  => ['recipient_name', 'ชื่อผู้รับ', 'ผู้รับ', 'receiver name'],
        'recipient_phone' => ['recipient_phone', 'เบอร์ผู้รับ', 'โทรผู้รับ', 'phone', 'tel'],
        'sender_name'     => ['sender_name', 'ชื่อผู้ส่ง', 'ผู้ส่ง', 'sender', 'ชื่อผู้ฝากส่ง'],
        'office_name'     => ['office_name', 'ที่ทำการ', 'สาขา', 'office', 'post office'],
        'office_code'     => ['office_code', 'รหัสที่ทำการ', 'รหัสสาขา', 'office code'],
        'service_name'    => ['service_name', 'บริการ', 'ประเภทบริการ', 'service type'],
        'weight_grams'    => ['weight_grams', 'น้ำหนัก', 'น้ำหนัก(กรัม)', 'weight', 'weight(g)'],
        'service_fee'     => ['service_fee', 'ค่าบริการ', 'fee', 'total fee', 'amount'],
        'cod_amount'      => ['cod_amount', 'cod', 'COD', 'เก็บเงินปลายทาง', 'เก็บเงิน'],
        'tr_number'       => ['tr_number', 'tr no', 'tr_no', 'เลขที่ใบนำส่ง'],
        'seq_no'          => ['seq_no', 'ลำดับ', 'seq', 'no', 'ลำดับที่'],
    ];

    // Thailand Post acceptance report — Excel column letters mapped from STANDARD_COLMAP
    // (verified against n8n parse script: seq=0,tr=2,depositDt=3,barcode=5,
    //  recipient=8,dest=9,destCode=11,destName=14,weight=16,phone=18,
    //  service=21,fee=24,cod=27,wallet=28,sender=30)
    private const TP_COL = [
        'seq_no'           => 'A',   // index 0
        'tr_number'        => 'C',   // index 2
        'deposit_datetime' => 'D',   // index 3
        'barcode'          => 'F',   // index 5
        'recipient_name'   => 'I',   // index 8
        'destination'      => 'J',   // index 9
        'destination_code' => 'L',   // index 11
        'destination_name' => 'O',   // index 14
        'weight_grams'     => 'Q',   // index 16
        'recipient_phone'  => 'S',   // index 18
        'service_name'     => 'V',   // index 21
        'service_fee'      => 'Y',   // index 24
        'cod_amount'       => 'AB',  // index 27
        'wallet_phone'     => 'AC',  // index 28
        'sender_name'      => 'AE',  // index 30
    ];

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|mimes:xlsx,xls,csv,zip|max:20480',
        ]);

        $uploadedFile = $request->file('file');
        $ext = strtolower($uploadedFile->getClientOriginalExtension());

        if ($ext === 'zip') {
            $zipUrl = null;
            try {
                /** @var \Illuminate\Filesystem\FilesystemAdapter $s3 */
                $s3 = Storage::disk('s3');
                $s3Path = 'thaipost-imports/' . date('Y/m') . '/' . uniqid() . '_' . $uploadedFile->getClientOriginalName();
                if ($s3->put($s3Path, file_get_contents($uploadedFile->getRealPath()))) {
                    $zipUrl = $s3->url($s3Path);
                }
            } catch (\Throwable) {
                // S3 upload failed — continue without file_url
            }

            $parentZipFile = LineGroupFile::create([
                'original_file_name' => $uploadedFile->getClientOriginalName(),
                'file_extension'     => 'zip',
                'content_type'       => $uploadedFile->getMimeType() ?: 'application/zip',
                'source_type'        => 'excel_upload',
                'file_url'           => $zipUrl,
                'imported_by'        => auth()->id(),
                'created_at'         => now(),
            ]);

            $zip = new \ZipArchive();
            if ($zip->open($uploadedFile->getRealPath()) !== true) {
                $parentZipFile->delete();
                return response()->json(['message' => 'ไม่สามารถเปิดไฟล์ ZIP ได้'], 422);
            }

            $tempDir = storage_path('app/temp-zip-' . uniqid());
            if (!file_exists($tempDir)) {
                mkdir($tempDir, 0755, true);
            }

            $zip->extractTo($tempDir);
            $zip->close();

            $files = $this->getExcelCsvFilesRecursive($tempDir);
            if (empty($files)) {
                $this->removeDirectory($tempDir);
                $parentZipFile->delete();
                return response()->json(['message' => 'ไม่พบไฟล์ Excel (.xlsx, .xls) หรือ .csv ภายในไฟล์ ZIP'], 422);
            }

            $totalInserted = 0;
            $totalUpdated = 0;
            $totalSkipped = 0;
            $allErrors = [];
            $importedFileIds = [];

            foreach ($files as $filePath) {
                $fileName = basename($filePath);
                // Skip macOS hidden files like ._filename.xlsx or __MACOSX folders
                if (str_starts_with($fileName, '._') || str_contains($filePath, '__MACOSX')) {
                    continue;
                }

                $extractedUrl = null;
                try {
                    $s3 = Storage::disk('s3');
                    $s3Path = 'thaipost-imports/extracted/' . date('Y/m') . '/' . uniqid() . '_' . $fileName;
                    if ($s3->put($s3Path, file_get_contents($filePath))) {
                        $extractedUrl = $s3->url($s3Path);
                    }
                } catch (\Throwable) {
                    // S3 upload failed — continue without file_url
                }

                $fileExt = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));

                $extractedFile = LineGroupExtractedFile::create([
                    'parent_file_id' => $parentZipFile->id,
                    'message_id'     => null,
                    'file_name'      => $fileName,
                    'file_extension' => $fileExt,
                    'file_type'      => $this->getMimeTypeFromExtension($fileExt),
                    's3_url'         => $extractedUrl,
                    'created_at'     => now(),
                ]);

                try {
                    $res = DB::connection('n8n')->transaction(fn () => $this->importSingleFile(
                        $filePath,
                        $fileName,
                        $this->getMimeTypeFromExtension($fileExt),
                        $parentZipFile,
                        $extractedFile
                    ));
                } catch (\Throwable $e) {
                    $res = ['success' => false, 'message' => $e->getMessage()];
                }

                if (isset($res['success']) && $res['success']) {
                    $totalInserted += $res['inserted'] ?? 0;
                    $totalUpdated += $res['updated'] ?? 0;
                    $totalSkipped += $res['skipped'] ?? 0;
                    if (!empty($res['errors'])) {
                        $allErrors = array_merge($allErrors, $res['errors']);
                    }
                    $importedFileIds[] = $extractedFile->id;
                } else {
                    $allErrors[] = "ไฟล์ {$fileName}: " . ($res['message'] ?? 'ข้อผิดพลาดที่ไม่ทราบสาเหตุ');
                }
            }

            $this->removeDirectory($tempDir);

            AuditLog::record(
                'import',
                'line_group_file',
                $parentZipFile->id,
                $parentZipFile->original_file_name,
                [
                    'file_extension' => 'zip',
                    'inserted' => $totalInserted,
                    'updated'  => $totalUpdated,
                    'skipped'  => $totalSkipped,
                    'extracted_files_count' => count($importedFileIds),
                    'errors_count' => count($allErrors),
                ]
            );

            return response()->json([
                'message'  => 'นำเข้าไฟล์จาก ZIP สำเร็จ',
                'file_ids' => $importedFileIds,
                'inserted' => $totalInserted,
                'updated'  => $totalUpdated,
                'skipped'  => $totalSkipped,
                'errors'   => $allErrors,
            ]);
        }

        try {
            $res = DB::connection('n8n')->transaction(fn () => $this->importSingleFile(
                $uploadedFile->getRealPath(),
                $uploadedFile->getClientOriginalName(),
                $uploadedFile->getMimeType()
            ));
        } catch (\Throwable $e) {
            $res = ['success' => false, 'message' => $e->getMessage()];
        }

        if (isset($res['success']) && $res['success']) {
            AuditLog::record(
                'import',
                'line_group_file',
                $res['file_id'],
                $uploadedFile->getClientOriginalName(),
                [
                    'file_extension' => $ext,
                    'inserted' => $res['inserted'],
                    'updated'  => $res['updated'],
                    'skipped'  => $res['skipped'],
                    'errors_count' => count($res['errors'] ?? []),
                ]
            );

            return response()->json([
                'message'  => 'นำเข้าสำเร็จ',
                'file_id'  => $res['file_id'],
                'inserted' => $res['inserted'],
                'updated'  => $res['updated'],
                'skipped'  => $res['skipped'],
                'errors'   => $res['errors'],
            ]);
        }

        return response()->json(['message' => $res['message'] ?? 'นำเข้าไม่สำเร็จ'], 422);
    }

    private function importSingleFile(
        string $filePath,
        string $originalName,
        ?string $mimeType = null,
        ?LineGroupFile $parentZipFile = null,
        ?LineGroupExtractedFile $extractedFile = null
    ): array {
        if (!$parentZipFile) {
            $fileUrl = null;
            try {
                /** @var \Illuminate\Filesystem\FilesystemAdapter $s3 */
                $s3 = Storage::disk('s3');
                $s3Path = 'thaipost-imports/' . date('Y/m') . '/' . uniqid() . '_' . $originalName;
                if ($s3->put($s3Path, file_get_contents($filePath))) {
                    $fileUrl = $s3->url($s3Path);
                }
            } catch (\Throwable) {
                // S3 upload failed — continue without file_url
            }

            $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

            $lineFile = LineGroupFile::create([
                'original_file_name' => $originalName,
                'file_extension'     => $ext,
                'content_type'       => $mimeType ?: ($this->getMimeTypeFromExtension($ext)),
                'source_type'        => 'excel_upload',
                'file_url'           => $fileUrl,
                'imported_by'        => auth()->id(),
                'created_at'         => now(),
            ]);
        } else {
            $lineFile = $parentZipFile;
        }

        try {
            $spreadsheet = IOFactory::load($filePath);
            $sheet = $spreadsheet->getActiveSheet();
            // letter-keyed columns (A, B, C ...) so TP_COL map works correctly
            $rows = $sheet->toArray(null, true, true, true);
        } catch (\Throwable $e) {
            if (!$parentZipFile) {
                $lineFile->delete();
            }
            return [
                'success' => false,
                'message' => 'ไม่สามารถอ่านไฟล์ได้: ' . $e->getMessage()
            ];
        }

        if (empty($rows)) {
            if (!$parentZipFile) {
                $lineFile->delete();
            }
            return [
                'success' => false,
                'message' => 'ไฟล์ว่างเปล่า'
            ];
        }

        if ($this->isThaipostTemplate($rows)) {
            return $this->processThaipostTemplateData($rows, $lineFile, $extractedFile);
        }

        return $this->processGenericFormatData($rows, $lineFile, $extractedFile);
    }

    // ─── Thailand Post report template ────────────────────────────────────────

    private function isThaipostTemplate(array $rows): bool
    {
        foreach (array_slice($rows, 0, 10) as $row) {
            foreach ($row as $cell) {
                $text = trim((string) $cell);
                if (str_contains($text, 'รายงานข้อมูลรายละเอียดการรับฝาก') ||
                    str_contains($text, 'รหัสที่ทำการ')) {
                    return true;
                }
            }
        }
        return false;
    }

    private function processThaipostTemplateData(array $rows, LineGroupFile $lineFile, ?LineGroupExtractedFile $extractedFile = null): array
    {
        $meta = $this->extractThaipostMeta($rows);
        $senderCol = $this->findSenderNameColumn($rows);

        $inserted = $updated = $skipped = 0;
        $errors = [];

        foreach ($rows as $rowIdx => $row) {
            // Data rows have a positive integer in column A (seq_no)
            $seqVal = $row['A'] ?? null;
            if (!is_numeric($seqVal) || (int) $seqVal <= 0) {
                continue;
            }

            $barcode = $this->val($row[self::TP_COL['barcode']] ?? null);
            if ($barcode === null) {
                $skipped++;
                continue;
            }

            $data = array_merge($meta, [
                'seq_no'           => (int) $seqVal,
                'tr_number'        => $this->val($row[self::TP_COL['tr_number']] ?? null),
                'deposit_datetime' => $this->parseDateTime($row[self::TP_COL['deposit_datetime']] ?? null),
                'barcode'          => $barcode,
                'recipient_name'   => $this->val($row[self::TP_COL['recipient_name']] ?? null),
                'destination'      => $this->val($row[self::TP_COL['destination']] ?? null),
                'destination_code' => $this->val($row[self::TP_COL['destination_code']] ?? null),
                'destination_name' => $this->colWithFallback($row, 'destination_name'),
                'weight_grams'     => $this->numWithFallback($row, 'weight_grams'),
                'recipient_phone'  => $this->val($row[self::TP_COL['recipient_phone']] ?? null),
                'service_name'     => $this->colWithFallback($row, 'service_name'),
                'service_fee'      => $this->num($row[self::TP_COL['service_fee']] ?? null),
                'cod_amount'       => $this->num($row[self::TP_COL['cod_amount']] ?? null),
                'wallet_phone'     => $this->val($row[self::TP_COL['wallet_phone']] ?? null),
                'sender_name'      => $this->val($row[$senderCol] ?? null),
                'source_file'      => $extractedFile ? $extractedFile->file_name : $lineFile->original_file_name,
                'parent_file_id'   => $lineFile->id,
                'extracted_file_id'=> $extractedFile ? $extractedFile->id : null,
                'import_batch_id'  => (string) $lineFile->id,
                'file_source_type' => $extractedFile ? 'zip_extracted' : 'excel_upload',
                'imported_by'      => auth()->id(),
                'imported_at'      => now(),
            ]);

            try {
                $exists = ThailandPostAcceptance::where('barcode', $barcode)->exists();
                ThailandPostAcceptance::updateOrCreate(['barcode' => $barcode], $data);
                $exists ? $updated++ : $inserted++;
            } catch (\Throwable $e) {
                $errors[] = "แถว {$rowIdx}: " . $e->getMessage();
            }
        }

        return [
            'success'  => true,
            'file_id'  => $extractedFile ? $extractedFile->id : $lineFile->id,
            'inserted' => $inserted,
            'updated'  => $updated,
            'skipped'  => $skipped,
            'errors'   => $errors,
        ];
    }

    private function extractThaipostMeta(array $rows): array
    {
        $meta = ['office_code' => null, 'office_name' => null, 'print_datetime' => null];

        foreach (array_slice($rows, 0, 10) as $row) {
            // Office info may be in different cells on the same row
            $rowText = implode(' ', array_map('strval', $row));

            if ($meta['office_code'] === null &&
                preg_match('/รหัสที่ทำการ\s*:\s*(\d+)/', $rowText, $m)) {
                $meta['office_code'] = $m[1];
            }

            if ($meta['office_name'] === null &&
                preg_match('/ชื่อที่ทำการ\s*:\s*([^\s].*?)(?:\s{2,}|$)/', $rowText, $m)) {
                $meta['office_name'] = trim($m[1]);
            }

            if ($meta['print_datetime'] === null &&
                preg_match('/วันเวลาที่พิมพ์\s+(\S+\s+\S+)/', $rowText, $m)) {
                $meta['print_datetime'] = $this->parseThaiBuddhistDate(trim($m[1]));
            }
        }

        return $meta;
    }

    /**
     * Auto-detect the sender_name column by scanning header rows for "ผู้ฝากส่ง".
     * Falls back to the hardcoded column letter 'P'.
     */
    private function findSenderNameColumn(array $rows): string
    {
        foreach (array_slice($rows, 0, 12) as $row) {
            foreach ($row as $colLetter => $cell) {
                if (str_contains((string) $cell, 'ผู้ฝากส่ง')) {
                    return (string) $colLetter;
                }
            }
        }
        return self::TP_COL['sender_name']; // default: 'AE'
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    private function parseDateTime(mixed $value): ?string
    {
        if ($value === null || $value === '') return null;

        // Excel may store dates as a numeric serial — convert directly
        if (is_float($value) || (is_int($value) && $value > 1000)) {
            try {
                $dt = ExcelDate::excelToDateTimeObject($value);
                return $dt->format('Y-m-d\TH:i:s');
            } catch (\Throwable) {}
        }

        return $this->parseThaiBuddhistDate(trim((string) $value));
    }

    private function parseThaiBuddhistDate(string $str): ?string
    {
        if ($str === '' || $str === '-') return null;

        // "1/04/2569 15:13:45" — day/month/BE-year time
        if (preg_match('#(\d{1,2})/(\d{1,2})/(\d{4})\s+(\d{1,2}:\d{2}:\d{2})#', $str, $m)) {
            $year = (int) $m[3];
            if ($year > 2400) $year -= 543;
            return sprintf('%04d-%02d-%02dT%s', $year, (int) $m[2], (int) $m[1], $m[4]);
        }

        // "1/04/2569" — date only
        if (preg_match('#(\d{1,2})/(\d{1,2})/(\d{4})#', $str, $m)) {
            $year = (int) $m[3];
            if ($year > 2400) $year -= 543;
            return sprintf('%04d-%02d-%02d', $year, (int) $m[2], (int) $m[1]);
        }

        return null;
    }

    private function val(mixed $v): ?string
    {
        if ($v === null) return null;
        $s = trim((string) $v);
        return ($s === '' || $s === '-') ? null : $s;
    }

    private function num(mixed $v): ?float
    {
        if ($v === null || $v === '' || $v === '-') return null;
        $s = str_replace(',', '', trim((string) $v));
        return is_numeric($s) ? (float) $s : null;
    }

    // Try primary column then ±1 adjacent columns (mirrors n8n destName/weight/service fallback)
    private function colWithFallback(array $row, string $field): ?string
    {
        $col = self::TP_COL[$field];
        $v = $this->val($row[$col] ?? null);
        if ($v !== null) return $v;
        $v = $this->val($row[$this->colOffset($col, +1)] ?? null);
        if ($v !== null) return $v;
        return $this->val($row[$this->colOffset($col, -1)] ?? null);
    }

    private function numWithFallback(array $row, string $field): ?float
    {
        $col = self::TP_COL[$field];
        $v = $this->num($row[$col] ?? null);
        if ($v !== null) return $v;
        $v = $this->num($row[$this->colOffset($col, +1)] ?? null);
        if ($v !== null) return $v;
        return $this->num($row[$this->colOffset($col, -1)] ?? null);
    }

    // Convert Excel column letter to 0-based index, offset it, then back to letter
    private function colOffset(string $col, int $offset): string
    {
        $col = strtoupper($col);
        $idx = 0;
        foreach (str_split($col) as $char) {
            $idx = $idx * 26 + (ord($char) - ord('A') + 1);
        }
        $idx = $idx - 1 + $offset; // 0-based
        if ($idx < 0) return $col;
        $result = '';
        $n = $idx + 1;
        while ($n > 0) {
            $n--;
            $result = chr(ord('A') + ($n % 26)) . $result;
            $n = intdiv($n, 26);
        }
        return $result;
    }

    // ─── Generic / fallback format ────────────────────────────────────────────

    private function processGenericFormatData(array $rows, LineGroupFile $lineFile, ?LineGroupExtractedFile $extractedFile = null): array
    {
        $headerRow = array_shift($rows);
        $columnMap = $this->resolveColumnMap($headerRow);

        if (!in_array('barcode', $columnMap)) {
            if (!$extractedFile) {
                $lineFile->delete();
            }
            return [
                'success' => false,
                'message' => 'ไม่พบคอลัมน์ barcode ในไฟล์ กรุณาตรวจสอบหัวตาราง',
            ];
        }

        $inserted = $updated = $skipped = 0;
        $errors = [];

        foreach ($rows as $rowIndex => $row) {
            $data = $this->extractRowData($row, $columnMap);

            if (empty($data['barcode'])) {
                $skipped++;
                continue;
            }

            try {
                $exists = ThailandPostAcceptance::where('barcode', $data['barcode'])->exists();
                ThailandPostAcceptance::updateOrCreate(
                    ['barcode' => $data['barcode']],
                    array_merge($data, [
                        'source_file'      => $extractedFile ? $extractedFile->file_name : $lineFile->original_file_name,
                        'parent_file_id'   => $lineFile->id,
                        'extracted_file_id'=> $extractedFile ? $extractedFile->id : null,
                        'import_batch_id'  => (string) $lineFile->id,
                        'file_source_type' => $extractedFile ? 'zip_extracted' : 'excel_upload',
                        'imported_by'      => auth()->id(),
                        'imported_at'      => now(),
                    ])
                );
                $exists ? $updated++ : $inserted++;
            } catch (\Throwable $e) {
                $errors[] = 'แถว ' . ($rowIndex + 1) . ': ' . $e->getMessage();
            }
        }

        return [
            'success'  => true,
            'file_id'  => $extractedFile ? $extractedFile->id : $lineFile->id,
            'inserted' => $inserted,
            'updated'  => $updated,
            'skipped'  => $skipped,
            'errors'   => $errors,
        ];
    }

    private function resolveColumnMap(array $headerRow): array
    {
        $map = [];
        foreach ($headerRow as $colKey => $header) {
            $normalized = strtolower(trim((string) $header));
            foreach (self::HEADER_MAP as $dbCol => $aliases) {
                foreach ($aliases as $alias) {
                    if (strtolower(trim($alias)) === $normalized) {
                        $map[$colKey] = $dbCol;
                        break 2;
                    }
                }
            }
        }
        return $map;
    }

    private function extractRowData(array $row, array $columnMap): array
    {
        $data        = [];
        $numericCols = ['weight_grams', 'service_fee', 'cod_amount', 'seq_no'];

        foreach ($columnMap as $colKey => $dbCol) {
            $val = $row[$colKey] ?? null;
            if ($val === null || $val === '') continue;

            $data[$dbCol] = in_array($dbCol, $numericCols)
                ? (is_numeric($val) ? (float) $val : null)
                : trim((string) $val);
        }

        return $data;
    }

    private function getExcelCsvFilesRecursive(string $dir): array
    {
        $files = [];
        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));
        foreach ($iterator as $file) {
            if ($file->isFile()) {
                $ext = strtolower($file->getExtension());
                if (in_array($ext, ['xlsx', 'xls', 'csv'])) {
                    $files[] = $file->getPathname();
                }
            }
        }
        return $files;
    }

    private function removeDirectory(string $dir): void
    {
        if (is_dir($dir)) {
            $files = array_diff(scandir($dir), ['.', '..']);
            foreach ($files as $file) {
                $path = $dir . DIRECTORY_SEPARATOR . $file;
                is_dir($path) ? $this->removeDirectory($path) : unlink($path);
            }
            rmdir($dir);
        }
    }

    private function getMimeTypeFromExtension(string $ext): string
    {
        return match ($ext) {
            'xlsx'  => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls'   => 'application/vnd.ms-excel',
            'csv'   => 'text/csv',
            default => 'application/octet-stream',
        };
    }
}
