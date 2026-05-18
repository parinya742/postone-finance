<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'name'        => 'Super Admin',
                'slug'        => 'super_admin',
                'description' => 'Full system access — all permissions granted automatically',
                'level'       => 1,
                'color'       => '#DC2626',
                'is_system'   => true,
            ],
            [
                'name'        => 'Admin',
                'slug'        => 'admin',
                'description' => 'Manage users, roles, and most system settings',
                'level'       => 2,
                'color'       => '#7C3AED',
                'is_system'   => true,
            ],
            [
                'name'        => 'Manager',
                'slug'        => 'manager',
                'description' => 'Manage finance and reports; limited user management',
                'level'       => 3,
                'color'       => '#2563EB',
                'is_system'   => false,
            ],
            [
                'name'        => 'Staff',
                'slug'        => 'staff',
                'description' => 'Create and edit finance records; view reports',
                'level'       => 4,
                'color'       => '#059669',
                'is_system'   => false,
            ],
            [
                'name'        => 'Viewer',
                'slug'        => 'viewer',
                'description' => 'Read-only access to dashboard and reports',
                'level'       => 5,
                'color'       => '#6B7280',
                'is_system'   => false,
            ],
        ];

        foreach ($roles as $data) {
            Role::firstOrCreate(['slug' => $data['slug']], $data);
        }

        // Assign permissions to roles
        $allPerms = Permission::all();

        $superAdmin = Role::where('slug', 'super_admin')->first();
        $superAdmin->permissions()->sync($allPerms->pluck('id'));

        $admin = Role::where('slug', 'admin')->first();
        $adminPerms = $allPerms->whereIn('module', ['users', 'roles', 'permissions', 'finance', 'reports', 'settings', 'audit_logs', 'dashboard']);
        $admin->permissions()->sync($adminPerms->pluck('id'));

        $manager = Role::where('slug', 'manager')->first();
        $managerPerms = $allPerms->filter(fn($p) =>
            in_array($p->module, ['finance', 'reports', 'dashboard']) ||
            ($p->module === 'users' && in_array($p->action, ['view']))
        );
        $manager->permissions()->sync($managerPerms->pluck('id'));

        $staff = Role::where('slug', 'staff')->first();
        $staffPerms = $allPerms->filter(fn($p) =>
            ($p->module === 'finance' && in_array($p->action, ['view', 'create', 'edit'])) ||
            ($p->module === 'dashboard' && $p->action === 'view') ||
            ($p->module === 'reports' && $p->action === 'view')
        );
        $staff->permissions()->sync($staffPerms->pluck('id'));

        $viewer = Role::where('slug', 'viewer')->first();
        $viewerPerms = $allPerms->where('action', 'view')
            ->whereIn('module', ['dashboard', 'reports', 'finance']);
        $viewer->permissions()->sync($viewerPerms->pluck('id'));
    }
}
