<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'n8n';

    public function up(): void
    {
        Schema::connection('n8n')->table('lazada_transactions_work', function (Blueprint $table) {
            $table->string('docuno', 50)->nullable()->after('cust_billname');
            $table->date('docudate')->nullable()->after('docuno');
        });
    }

    public function down(): void
    {
        Schema::connection('n8n')->table('lazada_transactions_work', function (Blueprint $table) {
            $table->dropColumn(['docuno', 'docudate']);
        });
    }
};
