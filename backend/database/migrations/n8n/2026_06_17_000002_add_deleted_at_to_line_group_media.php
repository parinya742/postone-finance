<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'n8n';

    public function up(): void
    {
        Schema::connection('n8n')->table('line_group_media', function (Blueprint $table) {
            $table->softDeletes()->after('created_at');
        });
    }

    public function down(): void
    {
        Schema::connection('n8n')->table('line_group_media', function (Blueprint $table) {
            $table->dropSoftDeletes();
        });
    }
};
