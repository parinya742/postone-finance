<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use Illuminate\Support\Facades\DB;

$rows = DB::connection('n8n')->table('thailand_post_acceptance')
    ->where('deposit_datetime', 'like', '%/%')
    ->get(['barcode', 'deposit_datetime']);

$updated = 0;
foreach ($rows as $row) {
    $str = $row->deposit_datetime;
    // format is typically DD/MM/YYYY HH:MM:SS
    if (preg_match('#(\d{1,2})/(\d{1,2})/(\d{4})\s+(\d{1,2}:\d{2}:\d{2})#', $str, $m)) {
        $year = (int) $m[3];
        if ($year > 2400) $year -= 543;
        
        $newDate = sprintf('%04d-%02d-%02dT%s', $year, (int) $m[2], (int) $m[1], $m[4]);
        
        DB::connection('n8n')->table('thailand_post_acceptance')
            ->where('barcode', $row->barcode)
            ->update(['deposit_datetime' => $newDate]);
            
        $updated++;
    } elseif (preg_match('#(\d{1,2})/(\d{1,2})/(\d{4})#', $str, $m)) {
        $year = (int) $m[3];
        if ($year > 2400) $year -= 543;
        
        $newDate = sprintf('%04d-%02d-%02d', $year, (int) $m[2], (int) $m[1]);
        
        DB::connection('n8n')->table('thailand_post_acceptance')
            ->where('barcode', $row->barcode)
            ->update(['deposit_datetime' => $newDate]);
            
        $updated++;
    }
}
echo "Updated $updated rows\n";
