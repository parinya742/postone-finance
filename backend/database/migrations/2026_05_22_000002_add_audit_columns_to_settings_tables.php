<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'n8n';

    public function up(): void
    {
        $tables = ['ems_settings', 'domestic_letter_settings'];

        foreach ($tables as $table) {
            Schema::connection('n8n')->table($table, function (Blueprint $t) {
                $t->unsignedBigInteger('updated_by')->nullable()->after('updated_at');
            });
        }
    }

    public function down(): void
    {
        $tables = ['ems_settings', 'domestic_letter_settings'];

        foreach ($tables as $table) {
            Schema::connection('n8n')->table($table, function (Blueprint $t) {
                $t->dropColumn('updated_by');
            });
        }
    }
};
