<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::with('roles:id,name,slug,color,level')
            ->withCount('roles');

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'ilike', "%{$request->search}%")
                  ->orWhere('email', 'ilike', "%{$request->search}%")
                  ->orWhere('username', 'ilike', "%{$request->search}%");
            });
        }

        if ($request->filled('role')) {
            $query->whereHas('roles', fn($q) => $q->where('slug', $request->role));
        }

        $users = $query->orderBy('name')
            ->paginate($request->integer('per_page', 15));

        return response()->json($users);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'      => 'required|string|max:100',
            'username'  => 'nullable|string|max:50|unique:users,username',
            'email'     => 'required|email|unique:users,email',
            'password'  => 'required|string|min:8|confirmed',
            'status'    => 'nullable|in:active,inactive,suspended,pending',
            'role_ids'  => 'nullable|array',
            'role_ids.*' => 'exists:roles,id',
        ]);

        $roles = collect();
        if (! empty($data['role_ids'])) {
            $roles = Role::whereIn('id', $data['role_ids'])->get();
            foreach ($roles as $role) {
                if (! $request->user()->canManageRole($role)) {
                    return response()->json(['message' => 'ไม่สามารถกำหนด role ที่มี level สูงกว่าหรือเท่ากับคุณได้'], 403);
                }
            }
        }

        $data['password'] = Hash::make($data['password']);
        $user = User::create($data);

        if ($roles->isNotEmpty()) {
            $pivotData = $roles->mapWithKeys(fn($role) => [
                $role->id => ['assigned_by' => $request->user()->id, 'assigned_at' => now()],
            ])->toArray();
            $user->roles()->sync($pivotData);
        }

        return response()->json($user->load('roles:id,name,slug,color'), 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json(
            $user->load('roles.permissions:id,name,slug,module,action')
                 ->loadCount('roles')
        );
    }

    public function update(Request $request, User $user): JsonResponse
    {
        if (! $request->user()->isSuperAdmin() && ! $request->user()->canManageUser($user)) {
            return response()->json(['message' => 'ไม่สามารถแก้ไขผู้ใช้ที่มี level สูงกว่าหรือเท่ากับคุณได้'], 403);
        }

        $data = $request->validate([
            'name'      => 'sometimes|string|max:100',
            'username'  => ['sometimes', 'nullable', 'string', 'max:50', Rule::unique('users', 'username')->ignore($user->id)],
            'email'     => ['sometimes', 'email', Rule::unique('users', 'email')->ignore($user->id)],
            'password'  => 'sometimes|string|min:8|confirmed',
            'status'    => 'sometimes|in:active,inactive,suspended,pending',
            'role_ids'  => 'nullable|array',
            'role_ids.*' => 'exists:roles,id',
        ]);

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        }

        $user->update($data);

        if (array_key_exists('role_ids', $data)) {
            $roleIds = $data['role_ids'] ?? [];
            if (! empty($roleIds)) {
                $roles = Role::whereIn('id', $roleIds)->get();
                foreach ($roles as $role) {
                    if (! $request->user()->canManageRole($role)) {
                        return response()->json(['message' => 'ไม่สามารถกำหนด role ที่มี level สูงกว่าหรือเท่ากับคุณได้'], 403);
                    }
                }
                $pivotData = $roles->mapWithKeys(fn($role) => [
                    $role->id => ['assigned_by' => $request->user()->id, 'assigned_at' => now()],
                ])->toArray();
            } else {
                $pivotData = [];
            }
            $user->roles()->sync($pivotData);
        }

        return response()->json($user->load('roles:id,name,slug,color'));
    }

    public function destroy(Request $request, User $user): JsonResponse
    {
        if ($user->id === $request->user()->id) {
            return response()->json(['message' => 'Cannot delete your own account.'], 422);
        }

        if (! $request->user()->isSuperAdmin()) {
            $targetMinLevel = (int) ($user->roles()->min('level') ?? PHP_INT_MAX);
            if ($targetMinLevel <= $request->user()->minRoleLevel()) {
                return response()->json(['message' => 'ไม่สามารถลบผู้ใช้ที่มี level สูงกว่าหรือเท่ากับคุณได้'], 403);
            }
        }

        $user->delete();

        return response()->json(['message' => 'User deleted successfully.']);
    }

    public function assignRoles(Request $request, User $user): JsonResponse
    {
        if (! $request->user()->canManageUser($user)) {
            return response()->json(['message' => 'ไม่สามารถแก้ไข roles ของผู้ใช้ที่มี level สูงกว่าหรือเท่ากับคุณได้'], 403);
        }

        $data = $request->validate([
            'role_ids'   => 'required|array',
            'role_ids.*' => 'exists:roles,id',
        ]);

        $roles = Role::whereIn('id', $data['role_ids'])->get();
        foreach ($roles as $role) {
            if (! $request->user()->canManageRole($role)) {
                return response()->json(['message' => 'ไม่สามารถกำหนด role ที่มี level สูงกว่าหรือเท่ากับคุณได้'], 403);
            }
        }

        $pivotData = $roles->mapWithKeys(fn($role) => [
            $role->id => ['assigned_by' => $request->user()->id, 'assigned_at' => now()],
        ])->toArray();

        $user->roles()->sync($pivotData);

        return response()->json($user->load('roles:id,name,slug,color'));
    }

    public function revokeRole(Request $request, User $user, Role $role): JsonResponse
    {
        if (! $request->user()->canManageUser($user)) {
            return response()->json(['message' => 'ไม่สามารถแก้ไข roles ของผู้ใช้ที่มี level สูงกว่าหรือเท่ากับคุณได้'], 403);
        }

        if (! $request->user()->canManageRole($role)) {
            return response()->json(['message' => 'ไม่สามารถถอด role ที่มี level สูงกว่าหรือเท่ากับคุณได้'], 403);
        }

        $user->roles()->detach($role->id);

        return response()->json(['message' => 'Role revoked successfully.']);
    }
}
