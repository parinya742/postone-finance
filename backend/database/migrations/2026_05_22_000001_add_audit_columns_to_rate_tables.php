<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'n8n';

    public function up(): void
    {
        $tables = ['special_postal_zones', 'ems_rates', 'domestic_letter_rates'];

        foreach ($tables as $table) {
            Schema::connection('n8n')->table($table, function (Blueprint $t) {
                $t->unsignedBigInteger('created_by')->nullable()->after('created_at');
                $t->unsignedBigInteger('updated_by')->nullable()->after('updated_at');
                $t->unsignedBigInteger('deleted_by')->nullable();
                $t->softDeletes();
            });
        }
    }

    public function down(): void
    {
        $tables = ['special_postal_zones', 'ems_rates', 'domestic_letter_rates'];

        foreach ($tables as $table) {
            Schema::connection('n8n')->table($table, function (Blueprint $t) {
                $t->dropColumn(['created_by', 'updated_by', 'deleted_by', 'deleted_at']);
            });
        }
    }
};
