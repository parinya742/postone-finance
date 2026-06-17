<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class LineGroupMedia extends Model
{
    use SoftDeletes;

    protected $connection = 'n8n';
    protected $table = 'line_group_media';
    public $timestamps = false;
    protected $guarded = [];

    protected $casts = [
        'created_at' => 'datetime',
        'deleted_at'  => 'datetime',
        'width'       => 'integer',
        'height'      => 'integer',
        'duration_ms' => 'integer',
    ];
}
