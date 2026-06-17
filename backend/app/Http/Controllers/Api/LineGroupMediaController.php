<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\LineGroupMedia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LineGroupMediaController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $trashed = $request->input('trashed', 'without');

        $query = match ($trashed) {
            'only'  => LineGroupMedia::onlyTrashed(),
            'with'  => LineGroupMedia::withTrashed(),
            default => LineGroupMedia::query(),
        };

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('group_id', 'ilike', "%{$request->search}%")
                  ->orWhere('message_id', 'ilike', "%{$request->search}%");
            });
        }

        if ($request->filled('content_type')) {
            $query->where('content_type', $request->content_type);
        }

        if ($request->filled('file_extension')) {
            $query->where('file_extension', $request->file_extension);
        }

        if ($request->filled('group_id')) {
            $query->where('group_id', $request->group_id);
        }

        $items = $query->orderByDesc('created_at')->paginate($request->integer('per_page', 20));

        return response()->json($items);
    }

    public function show(int $id): JsonResponse
    {
        $item = LineGroupMedia::withTrashed()->findOrFail($id);

        return response()->json($item);
    }

    public function restore(int $id): JsonResponse
    {
        $item = LineGroupMedia::onlyTrashed()->findOrFail($id);
        $item->restore();

        AuditLog::record('restore', 'line_group_media', $id, $item->message_id, [
            'group_id'     => $item->group_id,
            'content_type' => $item->content_type,
        ]);

        return response()->json(['message' => 'Restored']);
    }

    public function destroy(int $id): JsonResponse
    {
        $item = LineGroupMedia::findOrFail($id);
        $item->delete();

        AuditLog::record('delete', 'line_group_media', $id, $item->message_id, [
            'group_id'     => $item->group_id,
            'content_type' => $item->content_type,
            'file_url'     => $item->file_url,
        ]);

        return response()->json(['message' => 'Deleted']);
    }
}
