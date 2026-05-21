<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    protected $connection = 'n8n';

    public function up(): void
    {
        Schema::connection('n8n')->create('ems_rates', function (Blueprint $table) {
            $table->id();
            $table->decimal('weight', 6, 2);
            $table->decimal('rate', 8, 2);
            $table->timestamps();
        });

        DB::connection('n8n')->table('ems_rates')->insert([
            ['weight' =>  0,    'rate' =>  28, 'created_at' => now(), 'updated_at' => now()],
            ['weight' =>  0.99, 'rate' =>  28, 'created_at' => now(), 'updated_at' => now()],
            ['weight' =>  1,    'rate' =>  28, 'created_at' => now(), 'updated_at' => now()],
            ['weight' =>  2,    'rate' =>  38, 'created_at' => now(), 'updated_at' => now()],
            ['weight' =>  3,    'rate' =>  48, 'created_at' => now(), 'updated_at' => now()],
            ['weight' =>  4,    'rate' =>  58, 'created_at' => now(), 'updated_at' => now()],
            ['weight' =>  5,    'rate' =>  68, 'created_at' => now(), 'updated_at' => now()],
            ['weight' =>  5.5,  'rate' =>  68, 'created_at' => now(), 'updated_at' => now()],
            ['weight' =>  6,    'rate' =>  78, 'created_at' => now(), 'updated_at' => now()],
            ['weight' =>  7,    'rate' =>  88, 'created_at' => now(), 'updated_at' => now()],
            ['weight' =>  8,    'rate' =>  98, 'created_at' => now(), 'updated_at' => now()],
            ['weight' =>  9,    'rate' => 108, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 10,    'rate' => 118, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 11,    'rate' => 123, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 12,    'rate' => 128, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 13,    'rate' => 133, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 14,    'rate' => 138, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 15,    'rate' => 143, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 16,    'rate' => 148, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 17,    'rate' => 153, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 18,    'rate' => 158, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 19,    'rate' => 163, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 20,    'rate' => 168, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 21,    'rate' => 183, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 22,    'rate' => 198, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 23,    'rate' => 213, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 24,    'rate' => 228, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 25,    'rate' => 243, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 26,    'rate' => 258, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 27,    'rate' => 273, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 28,    'rate' => 288, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 29,    'rate' => 303, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 30,    'rate' => 318, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 31,    'rate' => 333, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 32,    'rate' => 348, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 33,    'rate' => 363, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 34,    'rate' => 378, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 35,    'rate' => 393, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 36,    'rate' => 408, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 37,    'rate' => 423, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 38,    'rate' => 438, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 39,    'rate' => 453, 'created_at' => now(), 'updated_at' => now()],
            ['weight' => 40,    'rate' => 468, 'created_at' => now(), 'updated_at' => now()],
        ]);

        Schema::connection('n8n')->create('ems_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 50)->unique();
            $table->decimal('value', 10, 2)->default(0);
            $table->timestamps();
        });

        DB::connection('n8n')->table('ems_settings')->insert([
            ['key' => 'offset', 'value' => 0, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::connection('n8n')->dropIfExists('ems_settings');
        Schema::connection('n8n')->dropIfExists('ems_rates');
    }
};
