<?php

namespace App\Http\Controllers\Concerns;

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

    /** Pre-signed S3 download link for a scraper file row (file_name, s3_bucket, s3_key). */
    protected function s3DownloadResponse(?object $file): JsonResponse
    {
        if (! $file || ! $file->s3_key) {
            return response()->json(['message' => 'ไม่พบไฟล์'], 404);
        }

        $disk = $file->s3_bucket && $file->s3_bucket !== config('filesystems.disks.s3.bucket')
            ? Storage::build(array_merge(config('filesystems.disks.s3'), ['bucket' => $file->s3_bucket]))
            : Storage::disk('s3');

        $url = $disk->temporaryUrl($file->s3_key, now()->addMinutes(10), [
            'ResponseContentDisposition' => 'attachment; filename="' . $file->file_name . '"',
        ]);

        return response()->json(['url' => $url, 'file_name' => $file->file_name]);
    }
}
