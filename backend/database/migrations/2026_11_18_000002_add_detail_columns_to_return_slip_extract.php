<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Everything else printed on the return slip: the vendor block, branch phones, the buyer split into code + name,
 * and per item the base-unit quantity, the return reason (1st "***" line) and the slip a 162 line reverses.
 * Thai national ID numbers in free text are masked by the extractor before they reach these tables.
 */
return new class extends Migration
{
    protected $connection = 'hpmh_rtv';

    public function up(): void
    {
        Schema::connection('hpmh_rtv')->table('return_slip_extract', function (Blueprint $table) {
            $table->string('buyer_code', 10)->nullable()->after('buyer');
            $table->string('buyer_name', 100)->nullable()->after('buyer_code');
            $table->string('site_tel', 50)->nullable()->after('created_by');
            $table->string('site_tel2', 50)->nullable()->after('site_tel');
            $table->string('vendor_name', 200)->nullable()->after('site_tel2');
            $table->text('vendor_address')->nullable()->after('vendor_name');
            $table->string('vendor_contact', 200)->nullable()->after('vendor_address');
            $table->string('vendor_tel', 50)->nullable()->after('vendor_contact');
            $table->index('buyer_code');
        });

        Schema::connection('hpmh_rtv')->table('return_slip_extract_item', function (Blueprint $table) {
            $table->decimal('base_qty', 15, 3)->nullable()->after('qty');
            $table->string('base_unit', 10)->nullable()->after('base_qty');
            $table->text('return_reason')->nullable()->after('description_pdf');
            $table->string('reversed_doc_no', 20)->nullable()->after('return_reason');
            $table->index('reversed_doc_no');
        });
    }

    public function down(): void
    {
        Schema::connection('hpmh_rtv')->table('return_slip_extract_item', function (Blueprint $table) {
            $table->dropIndex(['reversed_doc_no']);
            $table->dropColumn(['base_qty', 'base_unit', 'return_reason', 'reversed_doc_no']);
        });
        Schema::connection('hpmh_rtv')->table('return_slip_extract', function (Blueprint $table) {
            $table->dropIndex(['buyer_code']);
            $table->dropColumn(['buyer_code', 'buyer_name', 'site_tel', 'site_tel2', 'vendor_name', 'vendor_address', 'vendor_contact', 'vendor_tel']);
        });
    }
};
