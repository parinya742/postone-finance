<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LineGroupExtractedFile extends Model
{
    protected $connection = 'n8n';
    protected $table = 'line_group_extracted_files';
    public $timestamps = false;

    protected $casts = [
        'created_at' => 'datetime',
        'parent_file_id' => 'integer',
    ];

    public function parentFile()
    {
        return $this->belongsTo(LineGroupFile::class, 'parent_file_id');
    }
}
