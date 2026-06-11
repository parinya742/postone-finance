<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function getConnection(): string
    {
        return 'n8n';
    }

    public function up(): void
    {
        DB::connection('n8n')->statement(
            'ALTER TABLE shopee_transaction_tokens ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL'
        );
    }

    public function down(): void
    {
        DB::connection('n8n')->statement(
            'ALTER TABLE shopee_transaction_tokens DROP COLUMN IF EXISTS expires_at'
        );
    }
};
