<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $roles = Role::withCount('users')
            ->with('permissions:id,name,slug,module,action')
            ->orderBy('level')
            ->get();

        return response()->json($roles);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'           => 'required|string|max:100',
            'slug'           => 'required|string|max:100|unique:roles,slug|regex:/^[a-z0-9_]+$/',
            'description'    => 'nullable|string|max:500',
            'level'          => 'required|integer|min:1|max:99',
            'color'          => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'is_active'      => 'boolean',
            'permission_ids' => 'nullable|array',
            'permission_ids.*' => 'exists:permissions,id',
        ]);

        if (! $request->user()->isSuperAdmin() && $data['level'] <= $request->user()->minRoleLevel()) {
            return response()->json(['message' => 'ไม่สามารถสร้าง role ที่มี level สูงกว่าหรือเท่ากับคุณได้'], 403);
        }

        $role = Role::create($data);

        if (! empty($data['permission_ids'])) {
            $role->permissions()->sync($data['permission_ids']);
        }

        return response()->json($role->load('permissions:id,name,slug,module'), 201);
    }

    public function show(Role $role): JsonResponse
    {
        return response()->json(
            $role->load('permissions:id,name,slug,module,action')->loadCount('users')
        );
    }

    public function update(Request $request, Role $role): JsonResponse
    {
        if (! $request->user()->canManageRole($role)) {
            return response()->json(['message' => 'ไม่สามารถแก้ไข role ที่มี level สูงกว่าหรือเท่ากับคุณได้'], 403);
        }

        $data = $request->validate([
            'name'           => 'sometimes|string|max:100',
            'slug'           => ['sometimes', 'string', 'max:100', Rule::unique('roles', 'slug')->ignore($role->id), 'regex:/^[a-z0-9_]+$/'],
            'description'    => 'nullable|string|max:500',
            'level'          => 'sometimes|integer|min:1|max:99',
            'color'          => 'nullable|string|regex:/^#[0-9A-Fa-f]{6}$/',
            'is_active'      => 'boolean',
            'permission_ids' => 'nullable|array',
            'permission_ids.*' => 'exists:permissions,id',
        ]);

        if ($role->is_system && isset($data['slug']) && $data['slug'] !== $role->slug) {
            return response()->json(['message' => 'Cannot change slug of a system role.'], 422);
        }

        $role->update($data);

        if (array_key_exists('permission_ids', $data)) {
            $role->permissions()->sync($data['permission_ids'] ?? []);
        }

        return response()->json($role->load('permissions:id,name,slug,module,action'));
    }

    public function destroy(Request $request, Role $role): JsonResponse
    {
        if (! $request->user()->canManageRole($role)) {
            return response()->json(['message' => 'ไม่สามารถลบ role ที่มี level สูงกว่าหรือเท่ากับคุณได้'], 403);
        }

        if ($role->is_system) {
            return response()->json(['message' => 'System roles cannot be deleted.'], 422);
        }

        $role->delete();

        return response()->json(['message' => 'Role deleted successfully.']);
    }

    public function syncPermissions(Request $request, Role $role): JsonResponse
    {
        if (! $request->user()->canManageRole($role)) {
            return response()->json(['message' => 'ไม่สามารถแก้ไข permissions ของ role ที่มี level สูงกว่าหรือเท่ากับคุณได้'], 403);
        }

        $data = $request->validate([
            'permission_ids'   => 'required|array',
            'permission_ids.*' => 'exists:permissions,id',
        ]);

        $role->permissions()->sync($data['permission_ids']);

        return response()->json($role->load('permissions:id,name,slug,module,action'));
    }
}
