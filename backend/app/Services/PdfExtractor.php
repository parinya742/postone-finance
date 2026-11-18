<?php

namespace App\Services;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;

/**
 * Runs a pdfplumber extractor (backend/scripts/pdf/<script>) on scraper PDF rows (s3_bucket, s3_key).
 * Each result is the script's JSON, or ['error' => ...] when the download or the parse fails.
 */
class PdfExtractor
{
    /** S3 disk for a scraper file row — rows may live in a bucket other than the default one. */
    public static function disk(?string $bucket): Filesystem
    {
        return $bucket && $bucket !== config('filesystems.disks.s3.bucket')
            ? Storage::build(array_merge(config('filesystems.disks.s3'), ['bucket' => $bucket]))
            : Storage::disk('s3');
    }

    public function run(object $doc, string $script): array
    {
        $tmp = $this->download($doc);
        if (is_array($tmp)) {
            return $tmp;
        }
        try {
            return $this->process([base_path('scripts/pdf/' . $script), $tmp], config('services.pdf_extract.timeout'));
        } finally {
            @unlink($tmp);
        }
    }

    /**
     * Several PDFs in one Python process (script must support --many) — the OCR model loads once.
     *
     * @param  iterable<object>  $docs  rows with id, s3_bucket, s3_key
     * @return array<int, array>  results keyed by doc id
     */
    public function runMany(iterable $docs, string $script): array
    {
        $results = $files = [];
        foreach ($docs as $doc) {
            $tmp = $this->download($doc);
            is_array($tmp) ? $results[$doc->id] = $tmp : $files[$doc->id] = $tmp;
        }
        if (! $files) {
            return $results;
        }

        try {
            // ~2 s to load Python + the OCR model, then ~0.5 s per PDF; leave generous headroom
            $timeout = max((int) config('services.pdf_extract.timeout'), 30 + 15 * count($files));
            $out = $this->process(array_merge([base_path('scripts/pdf/' . $script), '--many'], array_values($files)), $timeout);
            $batch = $out['results'] ?? null;
            foreach (array_keys($files) as $n => $id) {
                $results[$id] = is_array($batch[$n] ?? null) ? $batch[$n] : ['error' => $out['error'] ?? 'ตัวอ่าน PDF ไม่ส่งผลลัพธ์กลับมา'];
            }
        } finally {
            array_map(fn ($f) => @unlink($f), $files);
        }

        return $results;
    }

    /** Temp file path, or ['error' => ...] */
    private function download(object $doc): string|array
    {
        if (empty($doc->s3_key)) {
            return ['error' => 'ไม่พบไฟล์ใน S3'];
        }
        $tmp = tempnam(sys_get_temp_dir(), 'pdf_extract_') . '.pdf';
        try {
            file_put_contents($tmp, self::disk($doc->s3_bucket ?? null)->get($doc->s3_key));

            return $tmp;
        } catch (\Throwable $e) {
            @unlink($tmp);

            return ['error' => 'ดาวน์โหลด PDF ไม่สำเร็จ: ' . $e->getMessage()];
        }
    }

    private function process(array $args, int $timeout): array
    {
        $env = ['PYTHONIOENCODING' => 'utf-8'];
        if (PHP_OS_FAMILY === 'Windows') {
            // Python on Windows dies at startup ("_Py_HashRandomization_Init: failed to get random numbers")
            // without SYSTEMROOT, and `php artisan serve` strips it: its env passthrough list has "SYSTEMROOT"
            // but Windows names it "SystemRoot", and the match is case-sensitive.
            $env['SYSTEMROOT'] = getenv('SYSTEMROOT') ?: getenv('SystemRoot') ?: 'C:\\Windows';
        }

        try {
            $process = Process::timeout($timeout)->env($env)->run(array_merge([config('services.pdf_extract.python')], $args));
        } catch (\Throwable $e) {
            return ['error' => $e->getMessage()];
        }

        $json = json_decode($process->output(), true);

        return is_array($json) ? $json : ['error' => trim($process->errorOutput()) ?: 'ตัวอ่าน PDF ไม่ส่งผลลัพธ์กลับมา'];
    }
}
