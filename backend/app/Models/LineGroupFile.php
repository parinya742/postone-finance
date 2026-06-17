<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LineGroupFile extends Model
{
    protected $connection = 'n8n';
    protected $table = 'line_group_files';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'created_at' => 'datetime',
        'is_active'  => 'boolean',
    ];

    public function extractedFiles()
    {
        return $this->hasMany(LineGroupExtractedFile::class, 'parent_file_id');
    }
}
