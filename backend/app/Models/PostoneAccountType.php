<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PostoneAccountType extends Model
{
    protected $connection = 'n8n';
    protected $table = 'postone_account_types';
    public $timestamps = false;

    protected $fillable = ['name', 'status', 'description', 'shop_id'];

    protected $casts = [
        'created_at' => 'datetime',
        'shop_id' => 'integer',
    ];

    public function shipments()
    {
        return $this->hasMany(PostoneShipment::class, 'account_type_id');
    }
}
