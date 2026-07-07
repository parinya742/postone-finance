<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function getConnection(): string
    {
        return 'n8n';
    }

    public function up(): void
    {
        Schema::connection('n8n')->table('shopee_transaction_tokens', function (Blueprint $table) {
            $table->unsignedBigInteger('bank_id')->nullable()->after('refresh_token');
            $table->string('bank_account_name', 255)->nullable()->after('bank_id');
            $table->string('bank_account_number', 50)->nullable()->after('bank_account_name');
        });
    }

    public function down(): void
    {
        Schema::connection('n8n')->table('shopee_transaction_tokens', function (Blueprint $table) {
            $table->dropColumn(['bank_id', 'bank_account_name', 'bank_account_number']);
        });
    }
};
