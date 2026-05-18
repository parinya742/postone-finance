<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PostoneAccountType;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PostoneAccountTypeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PostoneAccountType::query();

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('name', 'ilike', "%{$request->search}%")
                  ->orWhere('description', 'ilike', "%{$request->search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $items = $query->orderBy('id')->paginate($request->integer('per_page', 15));

        return response()->json($items);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'required|string|max:100',
            'status'      => 'nullable|in:Active,Inactive',
            'description' => 'nullable|string',
            'shop_id'     => 'nullable|integer',
        ]);

        $item = PostoneAccountType::create($data);

        return response()->json($item, 201);
    }

    public function show(PostoneAccountType $postoneAccountType): JsonResponse
    {
        return response()->json($postoneAccountType);
    }

    public function update(Request $request, PostoneAccountType $postoneAccountType): JsonResponse
    {
        $data = $request->validate([
            'name'        => 'sometimes|string|max:100',
            'status'      => 'sometimes|in:Active,Inactive',
            'description' => 'nullable|string',
            'shop_id'     => 'nullable|integer',
        ]);

        $postoneAccountType->update($data);

        return response()->json($postoneAccountType);
    }

    public function destroy(PostoneAccountType $postoneAccountType): JsonResponse
    {
        $postoneAccountType->delete();

        return response()->json(['message' => 'Deleted successfully.']);
    }
}
