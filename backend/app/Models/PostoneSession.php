<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PostoneSession extends Model
{
    protected $connection = 'n8n';
    protected $table = 'postone_session';
    public $timestamps = false;

    protected $fillable = ['status'];

    protected $hidden = ['cookie_value', 'php_sessid', 'postone_passkey'];

    protected $casts = [
        'login_at' => 'datetime',
        'last_used_at' => 'datetime',
        'updated_at' => 'datetime',
    ];
}
