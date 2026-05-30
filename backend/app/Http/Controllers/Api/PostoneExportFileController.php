<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PostoneExportFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PostoneExportFileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PostoneExportFile::query();

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('account_name', 'ilike', "%{$request->search}%")
                  ->orWhere('shop_id', 'ilike', "%{$request->search}%")
                  ->orWhere('file_name', 'ilike', "%{$request->search}%")
                  ->orWhere('filter_range', 'ilike', "%{$request->search}%");
            });
        }

        if ($request->filled('account_name')) {
            $query->where('account_name', $request->account_name);
        }

        $items = $query->orderByDesc('created_at')->paginate($request->integer('per_page', 20));

        return response()->json($items);
    }
}
