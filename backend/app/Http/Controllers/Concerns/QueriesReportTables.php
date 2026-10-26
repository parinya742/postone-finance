<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Contracts\Filesystem\Filesystem;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Shared helpers for read-only report controllers over n8n scraper schemas (CRC, HPMH, ...).
 */
trait QueriesReportTables
{
    protected function perPage(Request $request): int
    {
        return min(max($request->integer('per_page', 50), 1), 500);
    }

    protected function applySearch(Builder $q, Request $request, array $columns): void
    {
        if (! $request->filled('search')) {
            return;
        }
        $s = $request->search;
        $q->where(function ($qb) use ($s, $columns) {
            foreach ($columns as $col) {
                $qb->orWhere($col, 'ilike', "%{$s}%");
            }
        });
    }

    protected function applyDateRange(Builder $q, Request $request, string $column): void
    {
        if ($request->filled('start_date')) {
            $q->whereDate($column, '>=', $request->start_date);
        }
        if ($request->filled('end_date')) {
            $q->whereDate($column, '<=', $request->end_date);
        }
    }

    /**
     * Paginate and attach column sums computed over the whole filtered set.
     *
     * @param  array  $sumColumns  list of columns, or [alias => qualified column]
     */
    protected function paginateWithTotals(Builder $q, Request $request, array $sumColumns, array $order): JsonResponse
    {
        $sums = [];
        foreach ($sumColumns as $alias => $col) {
            $alias = is_int($alias) ? $col : $alias;
            $sums[] = "COALESCE(SUM({$col}), 0) as {$alias}";
        }
        $totalsQuery = clone $q;
        $totalsQuery->columns = null; // drop row columns so only the aggregates are selected
        $totals = $totalsQuery->selectRaw(implode(', ', $sums))->first();

        foreach ($order as $col => $dir) {
            $q->orderBy($col, $dir);
        }

        $page = $q->paginate($this->perPage($request))->toArray();
        $page['totals'] = $totals;

        return response()->json($page);
    }

    /** Scraper run log (audit_log table shared by the n8n scraper schemas), newest first. */
    protected function auditLogResponse(Builder $q, Request $request): JsonResponse
    {
        $q->select('id', 'run_id', 'topic', 'step', 'status', 'message', 'error_detail', 'metadata',
            'started_at', 'finished_at', 'duration_ms');

        foreach (['status', 'topic'] as $col) {
            if ($request->filled($col)) {
                $q->where($col, $request->input($col));
            }
        }
        // Runs that are not vendor-specific (login, ...) carry no vendor_no and are kept for every vendor
        if ($request->filled('vendor_no')) {
            $q->where(fn ($w) => $w->whereRaw("metadata->>'vendor_no' = ?", [$request->vendor_no])
                ->orWhereRaw("metadata->>'vendor_no' IS NULL"));
        }
        $this->applyDateRange($q, $request, 'started_at');
        $this->applySearch($q, $request, ['message', 'error_detail', 'step']);

        return response()->json($q->orderByDesc('started_at')->orderByDesc('id')->paginate($this->perPage($request)));
    }

    protected function auditLogTopicsResponse(Builder $q): JsonResponse
    {
        return response()->json($q->whereNotNull('topic')->distinct()->orderBy('topic')->pluck('topic'));
    }

    /** S3 disk for a scraper file row — rows may live in a bucket other than the default one. */
    protected function s3Disk(?string $bucket): Filesystem
    {
        return $bucket && $bucket !== config('filesystems.disks.s3.bucket')
            ? Storage::build(array_merge(config('filesystems.disks.s3'), ['bucket' => $bucket]))
            : Storage::disk('s3');
    }

    /**
     * Pre-signed S3 link for a scraper file row (file_name, s3_bucket, s3_key).
     * $inline = true lets the browser render it (e.g. a PDF in an iframe) instead of downloading.
     */
    protected function s3DownloadResponse(?object $file, bool $inline = false): JsonResponse
    {
        if (! $file || ! $file->s3_key) {
            return response()->json(['message' => 'ไม่พบไฟล์'], 404);
        }

        $disk = $this->s3Disk($file->s3_bucket);

        $options = ['ResponseContentDisposition' => ($inline ? 'inline' : 'attachment') . '; filename="' . $file->file_name . '"'];
        if ($inline && str_ends_with(strtolower($file->file_name ?? ''), '.pdf')) {
            $options['ResponseContentType'] = 'application/pdf';
        }
        $url = $disk->temporaryUrl($file->s3_key, now()->addMinutes(10), $options);

        return response()->json(['url' => $url, 'file_name' => $file->file_name]);
    }
}
