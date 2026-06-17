<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\LineGroupMedia;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

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

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'files'    => 'required|array|min:1|max:30',
            'files.*'  => 'file|mimes:jpg,jpeg,png,gif,webp,mp4,mov,mp3,m4a,aac|max:102400',
            'group_id' => 'nullable|string|max:255',
        ]);

        $groupId = $request->filled('group_id') ? $request->group_id : 'manual';
        $importedBy = auth()->user()?->name;
        $results = [];

        foreach ($request->file('files') as $file) {
            $ext  = strtolower($file->getClientOriginalExtension());
            $mime = $file->getMimeType() ?? '';

            $contentType = match (true) {
                str_starts_with($mime, 'image/') => 'image',
                str_starts_with($mime, 'video/') => 'video',
                default                          => 'audio',
            };

            $s3Path    = 'line-media/' . uniqid() . '_' . $file->getClientOriginalName();
            $s3        = Storage::disk('s3');
            $s3->put($s3Path, file_get_contents($file->getRealPath()));
            $url       = $s3->url($s3Path);
            $messageId = 'manual-' . now()->format('YmdHis') . '-' . Str::random(8);

            $item = LineGroupMedia::create([
                'group_id'       => $groupId,
                'message_id'     => $messageId,
                'file_url'       => $url,
                'file_extension' => $ext,
                'content_type'   => $contentType,
                'created_at'     => now(),
                'imported_by'    => $importedBy,
            ]);

            AuditLog::record('import', 'line_group_media', $item->id, $messageId, [
                'group_id'     => $groupId,
                'content_type' => $contentType,
                'file_url'     => $url,
            ]);

            $results[] = $item;
        }

        return response()->json($results, 201);
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
