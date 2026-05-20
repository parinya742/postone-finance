<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PostoneShipment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PostoneShipmentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = PostoneShipment::with('accountType:id,name');

        if ($request->filled('search')) {
            $query->where(function ($q) use ($request) {
                $q->where('label_id', 'ilike', "%{$request->search}%")
                  ->orWhere('customer_name', 'ilike', "%{$request->search}%")
                  ->orWhere('tracking_no', 'ilike', "%{$request->search}%")
                  ->orWhere('so_number', 'ilike', "%{$request->search}%")
                  ->orWhere('product_details', 'ilike', "%{$request->search}%")
                  ->orWhere('pi_number', 'ilike', "%{$request->search}%");
            });
        }

        if ($request->filled('channel')) {
            $query->where('channel', $request->channel);
        }

        if ($request->filled('account_type_id')) {
            $query->where('account_type_id', $request->account_type_id);
        }

        $items = $query->orderByDesc('updated_at')->paginate($request->integer('per_page', 20));

        return response()->json($items);
    }

    public function show(string $labelId): JsonResponse
    {
        $item = PostoneShipment::with('accountType:id,name')->findOrFail($labelId);

        return response()->json($item);
    }
}
