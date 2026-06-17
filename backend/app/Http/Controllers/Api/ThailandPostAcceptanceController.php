<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ThailandPostAcceptance;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ThailandPostAcceptanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ThailandPostAcceptance::where(function ($q) {
            $q->whereNull('parent_file_id')
              ->orWhereHas('parentFile', fn ($q2) => $q2->where('is_active', true));
        });

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('barcode', 'ilike', "%{$request->search}%")
                  ->orWhere('recipient_name', 'ilike', "%{$request->search}%")
                  ->orWhere('sender_name', 'ilike', "%{$request->search}%")
                  ->orWhere('tr_number', 'ilike', "%{$request->search}%");
            });
        }

        if ($request->filled('office_code')) {
            $query->where('office_code', $request->office_code);
        }

        if ($request->filled('import_batch_id')) {
            $query->where('import_batch_id', $request->import_batch_id);
        }

        if ($request->filled('file_source_type')) {
            $query->where('file_source_type', $request->file_source_type);
        }

        if ($request->filled('date_from')) {
            $query->whereDate('deposit_datetime', '>=', $request->date_from);
        }

        if ($request->filled('date_to')) {
            $query->whereDate('deposit_datetime', '<=', $request->date_to);
        }

        $items = $query->orderByDesc('imported_at')->paginate($request->integer('per_page', 20));

        return response()->json($items);
    }

    public function show(int $id): JsonResponse
    {
        $item = ThailandPostAcceptance::findOrFail($id);

        return response()->json($item);
    }
}
