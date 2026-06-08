<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LineGroupFileNote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LineGroupFileNoteController extends Controller
{
    public function index(int $fileId): JsonResponse
    {
        $notes = LineGroupFileNote::where('line_group_file_id', $fileId)
            ->orderByDesc('created_at')
            ->get();

        return response()->json($notes);
    }

    public function store(Request $request, int $fileId): JsonResponse
    {
        $data = $request->validate(['note' => 'required|string|max:2000']);

        $user = $request->user();

        $note = LineGroupFileNote::create([
            'line_group_file_id' => $fileId,
            'note'               => $data['note'],
            'user_id'            => $user?->id,
            'user_name'          => $user?->name ?? 'ไม่ระบุ',
        ]);

        return response()->json($note, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $note = LineGroupFileNote::findOrFail($id);
        $data = $request->validate(['note' => 'required|string|max:2000']);

        $note->update(['note' => $data['note']]);

        return response()->json($note);
    }

    public function destroy(int $id): JsonResponse
    {
        LineGroupFileNote::findOrFail($id)->delete();

        return response()->json(['message' => 'Deleted successfully.']);
    }
}
