<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LineGroupExtractedFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LineGroupExtractedFileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = LineGroupExtractedFile::with('parentFile:id,original_file_name,group_id');

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('file_name', 'ilike', "%{$request->search}%")
                  ->orWhere('message_id', 'ilike', "%{$request->search}%");
            });
        }

        if ($request->filled('file_type')) {
            $query->where('file_type', $request->file_type);
        }

        if ($request->filled('parent_file_id')) {
            $query->where('parent_file_id', $request->parent_file_id);
        }

        $items = $query->orderByDesc('created_at')->paginate($request->integer('per_page', 20));

        return response()->json($items);
    }
}
