<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PostoneShipment extends Model
{
    protected $connection = 'n8n';
    protected $table = 'postone_shipments';
    protected $primaryKey = 'label_id';
    public $incrementing = false;
    protected $keyType = 'string';
    public $timestamps = false;

    protected $casts = [
        'updated_at' => 'datetime',
        'account_type_id' => 'integer',
    ];

    public function accountType()
    {
        return $this->belongsTo(PostoneAccountType::class, 'account_type_id');
    }
}
