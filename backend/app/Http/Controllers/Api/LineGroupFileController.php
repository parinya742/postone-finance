<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\LineGroupFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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

        if ($request->filled('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        $items = $query->orderByDesc('created_at')->paginate($request->integer('per_page', 20));

        return response()->json($items);
    }

    public function toggleActive(int $id): JsonResponse
    {
        $file = LineGroupFile::findOrFail($id);
        $before = $file->is_active;

        DB::connection('n8n')->transaction(function () use ($file, $id, $before) {
            $file->is_active = !$before;
            $file->save();

            AuditLog::record(
                $file->is_active ? 'activate' : 'deactivate',
                'line_group_files',
                $id,
                $file->original_file_name ?? $file->message_id,
                ['group_id' => $file->group_id, 'is_active' => ['before' => $before, 'after' => $file->is_active]]
            );
        });

        return response()->json(['id' => $file->id, 'is_active' => $file->is_active]);
    }
}
