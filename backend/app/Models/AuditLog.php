<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $connection = 'n8n';

    public $timestamps = false;

    protected $fillable = [
        'user_id', 'user_name', 'action',
        'target_type', 'target_id', 'target_name',
        'payload', 'ip_address',
    ];

    protected $casts = ['payload' => 'array'];

    public static function record(string $action, string $targetType, int $targetId, string $targetName, array $payload = []): void
    {
        $user = auth()->user();
        static::create([
            'user_id'     => $user?->id,
            'user_name'   => $user?->name ?? 'system',
            'action'      => $action,
            'target_type' => $targetType,
            'target_id'   => $targetId,
            'target_name' => $targetName,
            'payload'     => $payload ?: null,
            'ip_address'  => request()->ip(),
        ]);
    }
}
