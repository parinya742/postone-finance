<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UserSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            [
                'name'     => 'Super Admin',
                'username' => 'superadmin',
                'email'    => 'superadmin@postone.local',
                'password' => Hash::make('password'),
                'status'   => 'active',
                'role'     => 'super_admin',
            ],
            [
                'name'     => 'Admin User',
                'username' => 'admin',
                'email'    => 'admin@postone.local',
                'password' => Hash::make('password'),
                'status'   => 'active',
                'role'     => 'admin',
            ],
            [
                'name'     => 'Manager User',
                'username' => 'manager',
                'email'    => 'manager@postone.local',
                'password' => Hash::make('password'),
                'status'   => 'active',
                'role'     => 'manager',
            ],
        ];

        foreach ($users as $data) {
            $role = Role::where('slug', $data['role'])->first();
            unset($data['role']);

            $user = User::firstOrCreate(['email' => $data['email']], $data);

            if ($role && ! $user->roles()->where('role_id', $role->id)->exists()) {
                $user->roles()->attach($role->id, ['assigned_at' => now()]);
            }
        }
    }
}
