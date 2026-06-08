<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'n8n';

    public function up(): void
    {
        Schema::connection('n8n')->create('line_group_file_notes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('line_group_file_id');
            $table->text('note');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->string('user_name', 100);
            $table->timestamps();

            $table->index('line_group_file_id');
        });
    }

    public function down(): void
    {
        Schema::connection('n8n')->dropIfExists('line_group_file_notes');
    }
};
