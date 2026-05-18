<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LineGroupFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LineGroupFileController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = LineGroupFile::withCount('extractedFiles');

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('original_file_name', 'ilike', "%{$request->search}%")
                  ->orWhere('group_id', 'ilike', "%{$request->search}%")
                  ->orWhere('message_id', 'ilike', "%{$request->search}%");
            });
        }

        if ($request->filled('extension')) {
            $query->where('file_extension', $request->extension);
        }

        $items = $query->orderByDesc('created_at')->paginate($request->integer('per_page', 20));

        return response()->json($items);
    }
}
