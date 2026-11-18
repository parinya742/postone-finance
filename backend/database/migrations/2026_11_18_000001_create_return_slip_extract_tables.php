<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Data read out of the HP-MH RTV return slip PDFs (scripts/pdf/extract_hpmh_return_slip.py), stored next to the
 * n8n scraper's tables in schema hpmh_rtv. Written by this app only (App\Services\HpmhRtv\ReturnSlipExtractService).
 *
 * No foreign key to return_slip_document: that table belongs to the n8n scraper, and a constraint could block its
 * own deletes/re-inserts. document_id is unique instead, and source_s3_key tells when the PDF was replaced.
 */
return new class extends Migration
{
    protected $connection = 'hpmh_rtv';

    public function up(): void
    {
        Schema::connection('hpmh_rtv')->create('return_slip_extract', function (Blueprint $table) {
            $table->id();
            $table->bigInteger('document_id')->unique();          // return_slip_document.id
            $table->string('vendor_no', 20)->nullable();
            $table->string('article_doc_no', 20)->nullable();
            $table->integer('fiscal_year')->nullable();

            // header as printed
            $table->string('site_code', 10)->nullable();
            $table->string('site', 100)->nullable();
            $table->string('storage_location', 10)->nullable();
            $table->date('doc_date')->nullable();
            $table->time('doc_time')->nullable();
            $table->string('delivery_note', 30)->nullable();
            $table->string('buyer', 100)->nullable();
            $table->string('created_by', 50)->nullable();
            $table->text('po_text')->nullable();
            $table->text('gr_text')->nullable();
            $table->integer('pages')->nullable();

            // totals: *_sum = added up from the items, total* = printed on the last page
            $table->integer('items_count')->default(0);
            $table->decimal('qty_sum', 15, 3)->nullable();
            $table->decimal('items_sum', 15, 2)->nullable();
            $table->decimal('total_qty', 15, 3)->nullable();
            $table->decimal('total_bu', 15, 3)->nullable();
            $table->decimal('total', 15, 2)->nullable();

            // ok = read and balanced, warning = read with warnings, error = could not be read (see error)
            $table->string('status', 10);
            $table->jsonb('warnings')->nullable();
            $table->text('error')->nullable();

            // provenance — a row is re-read when the PDF (s3 key) or the extractor version changes
            $table->text('source_s3_key')->nullable();
            $table->string('extractor_version', 30);
            $table->boolean('ocr_used')->default(false);
            $table->integer('ocr_lines')->default(0);
            $table->text('ocr_error')->nullable();
            $table->jsonb('raw')->nullable();                    // full extractor output
            $table->timestampTz('extracted_at');
            $table->timestampsTz();

            $table->index(['vendor_no', 'article_doc_no', 'fiscal_year']);
            $table->index('status');
        });

        Schema::connection('hpmh_rtv')->create('return_slip_extract_item', function (Blueprint $table) {
            $table->id();
            $table->foreignId('extract_id')->constrained('return_slip_extract')->cascadeOnDelete();
            $table->integer('item_no');
            $table->string('vd_part', 50)->nullable();
            $table->string('article', 30)->nullable();
            $table->string('batch', 50)->nullable();
            $table->string('po_no', 20)->nullable();               // "4311924202/10" -> 4311924202 / 10
            $table->string('po_item', 10)->nullable();
            $table->string('mvt', 5)->nullable();
            $table->string('s', 5)->nullable();
            $table->string('reference', 30)->nullable();
            $table->string('unit', 10)->nullable();
            $table->decimal('qty', 15, 3)->nullable();
            $table->decimal('price', 15, 2)->nullable();
            $table->decimal('amount', 15, 2)->nullable();
            $table->text('description')->nullable();               // Thai repaired with OCR
            $table->text('description_pdf')->nullable();           // as printed in the PDF text layer
            $table->jsonb('remarks')->nullable();                  // "***" lines: reason, customer, ...
            $table->jsonb('remarks_pdf')->nullable();
            $table->integer('page')->nullable();
            $table->timestampsTz();

            $table->unique(['extract_id', 'item_no']);
            $table->index('article');
            $table->index('po_no');
        });
    }

    public function down(): void
    {
        Schema::connection('hpmh_rtv')->dropIfExists('return_slip_extract_item');
        Schema::connection('hpmh_rtv')->dropIfExists('return_slip_extract');
    }
};
