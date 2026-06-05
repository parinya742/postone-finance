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
}
