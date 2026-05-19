<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Permission;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PermissionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Permission::query();

        if ($request->filled('module')) {
            $query->where('module', $request->module);
        }

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'ilike', "%{$request->search}%")
                  ->orWhere('slug', 'ilike', "%{$request->search}%");
            });
        }

        $permissions = $query->orderBy('module')->orderBy('action')->get();

        // Group by module for easier consumption in the frontend
        $grouped = $permissions->groupBy('module')->map(fn($perms, $module) => [
            'module'      => $module,
            'permissions' => $perms->values(),
        ])->values();

        return response()->json([
            'data'    => $permissions,
            'grouped' => $grouped,
            'modules' => $permissions->pluck('module')->unique()->sort()->values(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:100',
            'slug'        => 'required|string|max:100|unique:permissions,slug|regex:/^[a-z0-9_.-]+$/',
            'description' => 'nullable|string|max:500',
            'module'      => 'required|string|max:50',
            'action'      => 'required|string|max:50',
            'is_active'   => 'boolean',
        ]);

        $permission = Permission::create($data);

        return response()->json($permission, 201);
    }

    public function show(Permission $permission): JsonResponse
    {
        return response()->json($permission->load('roles:id,name,slug'));
    }

    public function update(Request $request, Permission $permission): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:100',
            'slug'        => ['sometimes', 'string', 'max:100', Rule::unique('permissions', 'slug')->ignore($permission->id), 'regex:/^[a-z0-9_.-]+$/'],
            'description' => 'nullable|string|max:500',
            'module'      => 'sometimes|string|max:50',
            'action'      => 'sometimes|string|max:50',
            'is_active'   => 'boolean',
        ]);

        $permission->update($data);

        return response()->json($permission);
    }

    public function destroy(Permission $permission): JsonResponse
    {
        $permission->delete();

        return response()->json(['message' => 'Permission deleted successfully.']);
    }
}
