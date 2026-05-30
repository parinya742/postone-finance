<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PostoneExportFile extends Model
{
    protected $connection = 'n8n';
    protected $table = 'postone_export_files';
    public $timestamps = false;

    protected $casts = [
        'created_at' => 'datetime',
        'row_count' => 'integer',
    ];
}
