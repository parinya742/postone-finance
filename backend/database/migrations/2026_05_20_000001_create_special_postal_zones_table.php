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
        Schema::connection('n8n')->create('special_postal_zones', function (Blueprint $table) {
            $table->id();
            $table->integer('seq');
            $table->integer('area_group');
            $table->string('province', 100);
            $table->string('office_name', 100);
            $table->string('postal_code', 5);
            $table->string('area_description', 200)->nullable();
            $table->decimal('rate', 8, 2)->default(0);
            $table->timestamps();
        });

        DB::connection('n8n')->table('special_postal_zones')->insert([
            ['seq' => 1,  'area_group' => 1,  'province' => 'ชลบุรี',      'office_name' => 'เกาะสีชัง',     'postal_code' => '20120', 'area_description' => 'เกาะสีชัง',                      'rate' => 20],
            ['seq' => 2,  'area_group' => 2,  'province' => 'ชลบุรี',      'office_name' => 'บางละมุง',      'postal_code' => '20150', 'area_description' => 'เฉพาะเกาะล้าน',                 'rate' => 20],
            ['seq' => 3,  'area_group' => 3,  'province' => 'ระยอง',       'office_name' => 'เพ',            'postal_code' => '21160', 'area_description' => 'เฉพาะเกาะเสมิด',                'rate' => 20],
            ['seq' => 4,  'area_group' => 4,  'province' => 'ตราด',        'office_name' => 'ตราด',          'postal_code' => '23000', 'area_description' => 'เฉพาะเกาะกูด',                  'rate' => 20],
            ['seq' => 5,  'area_group' => 5,  'province' => 'ตราด',        'office_name' => 'แหลมงอบ',       'postal_code' => '23120', 'area_description' => 'เฉพาะเกาะหมาก',                 'rate' => 20],
            ['seq' => 6,  'area_group' => 6,  'province' => 'ตราด',        'office_name' => 'เกาะช้าง',      'postal_code' => '23170', 'area_description' => null,                             'rate' => 20],
            ['seq' => 7,  'area_group' => 7,  'province' => 'เชียงใหม่',   'office_name' => 'สะเมิง',        'postal_code' => '50250', 'area_description' => 'ทุกพื้นที่ของรหัสไปรษณีย์',     'rate' => 20],
            ['seq' => 8,  'area_group' => 7,  'province' => 'เชียงใหม่',   'office_name' => 'อมก๋อย',        'postal_code' => '50310', 'area_description' => 'ทุกพื้นที่ของรหัสไปรษณีย์',     'rate' => 20],
            ['seq' => 9,  'area_group' => 7,  'province' => 'เชียงใหม่',   'office_name' => 'เวียงแหง',      'postal_code' => '50350', 'area_description' => 'ทุกพื้นที่ของรหัสไปรษณีย์',     'rate' => 20],
            ['seq' => 10, 'area_group' => 8,  'province' => 'น่าน',        'office_name' => 'ทุ่งช้าง',      'postal_code' => '55130', 'area_description' => 'ทุกพื้นที่ของรหัสไปรษณีย์',     'rate' => 20],
            ['seq' => 11, 'area_group' => 8,  'province' => 'น่าน',        'office_name' => 'บ่อเกลือ',      'postal_code' => '55220', 'area_description' => 'ทุกพื้นที่ของรหัสไปรษณีย์',     'rate' => 20],
            ['seq' => 12, 'area_group' => 9,  'province' => 'เชียงราย',    'office_name' => 'เวียงป่าเป้า',  'postal_code' => '57170', 'area_description' => 'ทุกพื้นที่ของรหัสไปรษณีย์',     'rate' => 20],
            ['seq' => 13, 'area_group' => 9,  'province' => 'เชียงราย',    'office_name' => 'แม่สรวย',       'postal_code' => '57180', 'area_description' => 'ทุกพื้นที่ของรหัสไปรษณีย์',     'rate' => 20],
            ['seq' => 14, 'area_group' => 9,  'province' => 'เชียงราย',    'office_name' => 'แม่เจดีย์',     'postal_code' => '57260', 'area_description' => 'ทุกพื้นที่ของรหัสไปรษณีย์',     'rate' => 20],
            ['seq' => 15, 'area_group' => 9,  'province' => 'เชียงราย',    'office_name' => 'เวียงแก่น',     'postal_code' => '57310', 'area_description' => 'ทุกพื้นที่ของรหัสไปรษณีย์',     'rate' => 20],
            ['seq' => 16, 'area_group' => 9,  'province' => 'เชียงราย',    'office_name' => 'ขุนตาล',        'postal_code' => '57340', 'area_description' => 'ทุกพื้นที่ของรหัสไปรษณีย์',     'rate' => 20],
            ['seq' => 17, 'area_group' => 10, 'province' => 'แม่ฮ่องสอน', 'office_name' => 'แม่ฮ่องสอน',   'postal_code' => '58000', 'area_description' => 'ทุกพื้นที่ของรหัสไปรษณีย์',     'rate' => 20],
            ['seq' => 18, 'area_group' => 10, 'province' => 'แม่ฮ่องสอน', 'office_name' => 'แม่สะเรียง',   'postal_code' => '58110', 'area_description' => 'ทุกพื้นที่ของรหัสไปรษณีย์',     'rate' => 20],
        ]);
    }

    public function down(): void
    {
        Schema::connection('n8n')->dropIfExists('special_postal_zones');
    }
};
