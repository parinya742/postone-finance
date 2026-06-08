<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LineGroupFileNote extends Model
{
    protected $connection = 'n8n';
    protected $fillable = ['line_group_file_id', 'note', 'user_id', 'user_name'];
}
