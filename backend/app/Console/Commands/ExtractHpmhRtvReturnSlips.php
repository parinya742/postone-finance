<?php

namespace App\Console\Commands;

use App\Services\HpmhRtv\ReturnSlipExtractService;
use Illuminate\Console\Command;

/**
 * Reads new/changed HP-MH RTV return slip PDFs into hpmh_rtv.return_slip_extract.
 * Scheduled every few minutes (routes/console.php), so slips the n8n scraper brings in are processed on their own.
 */
class ExtractHpmhRtvReturnSlips extends Command
{
    protected $signature = 'hpmh-rtv:extract-pending
        {--limit=200 : Most PDFs to read in this run}
        {--batch=10 : PDFs per Python run (the OCR model loads once per run)}
        {--retry-errors : Also re-read PDFs whose last read failed}';

    protected $description = 'Read pending HP-MH RTV return slip PDFs into the database';

    public function handle(ReturnSlipExtractService $service): int
    {
        $limit = max(1, (int) $this->option('limit'));
        $batch = max(1, min(50, (int) $this->option('batch')));
        $done = ['processed' => 0, 'ok' => 0, 'warning' => 0, 'error' => 0];
        $remaining = null;

        while ($done['processed'] < $limit) {
            $r = $service->processPending(min($batch, $limit - $done['processed']), null, (bool) $this->option('retry-errors'));
            foreach (array_keys($done) as $k) {
                $done[$k] += $r[$k];
            }
            $remaining = $r['remaining'];
            if ($r['processed'] === 0 || $remaining === 0) {
                break;
            }
        }

        if ($done['processed'] > 0 || $this->getOutput()->isVerbose()) {
            $this->info(sprintf('[%s] read %d PDF(s): ok %d, warning %d, error %d — %d still pending',
                now()->toDateTimeString(), $done['processed'], $done['ok'], $done['warning'], $done['error'],
                $remaining ?? $service->pendingQuery()->count()));
        }

        return self::SUCCESS;
    }
}
