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
        // สร้าง Table สำหรับเก็บอัตราค่าส่งจดหมายในประเทศ
        Schema::connection('n8n')->create('domestic_letter_rates', function (Blueprint $table) {
            $table->id();
            $table->decimal('weight', 6, 2);
            $table->decimal('rate', 8, 2);
            $table->timestamps();
        });

        // Insert ข้อมูลตั้งต้นจากตาราง
        $now = now();
        $rates = [
            ['weight' => 0.01, 'rate' => 18],
            ['weight' => 0.02, 'rate' => 19],
            ['weight' => 0.03, 'rate' => 24],
            ['weight' => 0.04, 'rate' => 24],
            ['weight' => 0.05, 'rate' => 24],
            ['weight' => 0.06, 'rate' => 24],
            ['weight' => 0.07, 'rate' => 24],
            ['weight' => 0.08, 'rate' => 24],
            ['weight' => 0.09, 'rate' => 24],
            ['weight' => 0.1,  'rate' => 24],
            ['weight' => 0.11, 'rate' => 30],
            ['weight' => 0.12, 'rate' => 30],
            ['weight' => 0.13, 'rate' => 30],
            ['weight' => 0.14, 'rate' => 30],
            ['weight' => 0.15, 'rate' => 30],
            ['weight' => 0.16, 'rate' => 30],
            ['weight' => 0.17, 'rate' => 30],
            ['weight' => 0.18, 'rate' => 30],
            ['weight' => 0.19, 'rate' => 30],
            ['weight' => 0.2,  'rate' => 30],
            ['weight' => 0.21, 'rate' => 30],
            ['weight' => 0.22, 'rate' => 30],
            ['weight' => 0.23, 'rate' => 30],
            ['weight' => 0.24, 'rate' => 30],
            ['weight' => 0.25, 'rate' => 30],
            ['weight' => 0.26, 'rate' => 36],
            ['weight' => 0.27, 'rate' => 36],
            ['weight' => 0.28, 'rate' => 36],
            ['weight' => 0.29, 'rate' => 36],
            ['weight' => 0.3,  'rate' => 36],
            ['weight' => 0.31, 'rate' => 36],
            ['weight' => 0.32, 'rate' => 36],
            ['weight' => 0.33, 'rate' => 36],
            ['weight' => 0.34, 'rate' => 36],
            ['weight' => 0.35, 'rate' => 36],
            ['weight' => 0.36, 'rate' => 36],
            ['weight' => 0.37, 'rate' => 36],
            ['weight' => 0.38, 'rate' => 36],
            ['weight' => 0.39, 'rate' => 36],
            ['weight' => 0.4,  'rate' => 36],
            ['weight' => 0.41, 'rate' => 36],
            ['weight' => 0.42, 'rate' => 36],
            ['weight' => 0.43, 'rate' => 36],
            ['weight' => 0.44, 'rate' => 36],
            ['weight' => 0.45, 'rate' => 36],
            ['weight' => 0.46, 'rate' => 36],
            ['weight' => 0.47, 'rate' => 36],
            ['weight' => 0.48, 'rate' => 36],
            ['weight' => 0.49, 'rate' => 36],
            ['weight' => 0.5,  'rate' => 36],
            ['weight' => 0.6,  'rate' => 53],
            ['weight' => 0.7,  'rate' => 53],
            ['weight' => 0.8,  'rate' => 53],
            ['weight' => 0.9,  'rate' => 53],
            ['weight' => 1,    'rate' => 53],
            ['weight' => 1.1,  'rate' => 53],
            ['weight' => 1.2,  'rate' => 53],
            ['weight' => 1.3,  'rate' => 53],
            ['weight' => 1.4,  'rate' => 53],
            ['weight' => 1.5,  'rate' => 53],
            ['weight' => 1.6,  'rate' => 53],
            ['weight' => 1.7,  'rate' => 53],
            ['weight' => 1.8,  'rate' => 53],
            ['weight' => 1.9,  'rate' => 53],
            ['weight' => 2,    'rate' => 75],
        ];

        // เพิ่ม timestamps ให้ทุกแถว
        $rates = array_map(function ($item) use ($now) {
            $item['created_at'] = $now;
            $item['updated_at'] = $now;
            return $item;
        }, $rates);

        // ทำการ Insert ข้อมูลทีละชุดเพื่อป้องกันการ Insert เกินลิมิต (ถ้ามี)
        $chunks = array_chunk($rates, 50);
        foreach ($chunks as $chunk) {
            DB::connection('n8n')->table('domestic_letter_rates')->insert($chunk);
        }

        // สร้าง Table สำหรับเก็บ Setting (คล้าย ems_settings)
        Schema::connection('n8n')->create('domestic_letter_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key', 50)->unique();
            $table->decimal('value', 10, 2)->default(0);
            $table->timestamps();
        });

        DB::connection('n8n')->table('domestic_letter_settings')->insert([
            ['key' => 'offset', 'value' => 0, 'created_at' => $now, 'updated_at' => $now],
        ]);
    }

    public function down(): void
    {
        Schema::connection('n8n')->dropIfExists('domestic_letter_settings');
        Schema::connection('n8n')->dropIfExists('domestic_letter_rates');
    }
};