<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = AuditLog::query()->orderByDesc('created_at');

        if ($request->filled('target_type')) {
            $q->where('target_type', $request->target_type);
        }

        if ($request->filled('target_id')) {
            $q->where('target_id', $request->target_id);
        }

        return response()->json($q->paginate($request->integer('per_page', 30)));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'action'      => 'required|string|max:50',
            'target_type' => 'required|string|max:50',
            'target_id'   => 'required|integer|min:0',
            'target_name' => 'required|string|max:150',
            'payload'     => 'nullable|array',
        ]);

        AuditLog::record(
            $validated['action'],
            $validated['target_type'],
            (int) $validated['target_id'],
            $validated['target_name'],
            $validated['payload'] ?? []
        );

        return response()->json(['ok' => true], 201);
    }
}
