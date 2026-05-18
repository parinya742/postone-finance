<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PostoneSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PostoneSessionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PostoneSession::query();

        if ($request->filled('search')) {
            $query->where('username', 'ilike', "%{$request->search}%");
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        $items = $query->orderByDesc('last_used_at')->paginate($request->integer('per_page', 20));

        return response()->json($items);
    }

    public function destroy(PostoneSession $postoneSession): JsonResponse
    {
        $postoneSession->delete();

        return response()->json(['message' => 'Session deleted successfully.']);
    }
}
