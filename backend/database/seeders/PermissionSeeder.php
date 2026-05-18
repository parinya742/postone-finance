<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class PermissionSeeder extends Seeder
{
    public function run(): void
    {
        $modules = [
            'users'       => ['view', 'create', 'edit', 'delete', 'export'],
            'roles'       => ['view', 'create', 'edit', 'delete'],
            'permissions' => ['view', 'create', 'edit', 'delete'],
            'finance'     => ['view', 'create', 'edit', 'delete', 'export', 'approve'],
            'reports'     => ['view', 'export'],
            'settings'    => ['view', 'edit'],
            'audit_logs'  => ['view', 'export'],
            'dashboard'   => ['view'],
        ];

        $labelMap = [
            'view'    => 'View',
            'create'  => 'Create',
            'edit'    => 'Edit',
            'delete'  => 'Delete',
            'export'  => 'Export',
            'approve' => 'Approve',
        ];

        foreach ($modules as $module => $actions) {
            foreach ($actions as $action) {
                $moduleLabel = ucwords(str_replace('_', ' ', $module));
                Permission::firstOrCreate(
                    ['slug' => "{$module}.{$action}"],
                    [
                        'name'        => "{$labelMap[$action]} {$moduleLabel}",
                        'description' => "Can {$action} {$moduleLabel}",
                        'module'      => $module,
                        'action'      => $action,
                        'is_active'   => true,
                    ]
                );
            }
        }
    }
}
