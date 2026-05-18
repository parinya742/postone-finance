<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ThailandPostAcceptance extends Model
{
    protected $connection = 'n8n';
    protected $table = 'thailand_post_acceptance';
    public $timestamps = false;

    protected $casts = [
        'imported_at' => 'datetime',
        'weight_grams' => 'float',
        'service_fee' => 'float',
        'cod_amount' => 'float',
        'seq_no' => 'integer',
    ];

    public function parentFile()
    {
        return $this->belongsTo(LineGroupFile::class, 'parent_file_id');
    }

    public function extractedFile()
    {
        return $this->belongsTo(LineGroupExtractedFile::class, 'extracted_file_id');
    }
}
