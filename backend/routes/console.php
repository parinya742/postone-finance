<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('shopee:refresh-tokens')->hourly()->appendOutputTo(storage_path('logs/shopee-token-refresh.log'));

// HP-MH RTV: read return slip PDFs the n8n scraper brought in (no-op when nothing is pending)
Schedule::command('hpmh-rtv:extract-pending')->everyFiveMinutes()->withoutOverlapping(30)
    ->appendOutputTo(storage_path('logs/hpmh-rtv-extract.log'));
