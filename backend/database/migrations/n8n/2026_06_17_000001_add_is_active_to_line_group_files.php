<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'n8n';

    public function up(): void
    {
        Schema::connection('n8n')->table('line_group_files', function (Blueprint $table) {
            $table->boolean('is_active')->default(true)->after('source_type');
        });
    }

    public function down(): void
    {
        Schema::connection('n8n')->table('line_group_files', function (Blueprint $table) {
            $table->dropColumn('is_active');
        });
    }
};
