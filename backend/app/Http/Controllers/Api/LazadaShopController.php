<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class LazadaShopController extends Controller
{
    private function query()
    {
        return DB::connection('n8n')->table('lazada_tokens');
    }

    public function index(Request $request): JsonResponse
    {
        $q = $this->query()->orderBy('shop_name');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('shop_name', 'ilike', "%{$s}%")
                   ->orWhere('seller_id', 'ilike', "%{$s}%")
                   ->orWhere('short_code', 'ilike', "%{$s}%");
            });
        }

        return response()->json($q->paginate($request->integer('per_page', 50)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'shop_name'     => 'required|string|max:100',
            'app_key'       => 'required|string|max:255',
            'app_secret'    => 'required|string|max:255',
            'access_token'  => 'nullable|string',
            'refresh_token' => 'nullable|string',
            'seller_id'     => 'required|string|max:50',
            'short_code'    => 'required|string|max:50',
        ]);

        $id = $this->query()->insertGetId(array_merge($data, [
            'created_at' => now(),
            'updated_at' => now(),
        ]));

        return response()->json($this->query()->where('id', $id)->first(), 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        if (! $this->query()->where('id', $id)->exists()) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        $data = $request->validate([
            'shop_name'     => 'sometimes|string|max:100',
            'app_key'       => 'sometimes|string|max:255',
            'app_secret'    => 'sometimes|string|max:255',
            'access_token'  => 'nullable|string',
            'refresh_token' => 'nullable|string',
            'seller_id'     => 'sometimes|string|max:50',
            'short_code'    => 'sometimes|string|max:50',
        ]);

        $data['updated_at'] = now();
        $this->query()->where('id', $id)->update($data);

        return response()->json($this->query()->where('id', $id)->first());
    }

    public function destroy(int $id): JsonResponse
    {
        if (! $this->query()->where('id', $id)->exists()) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        $this->query()->where('id', $id)->delete();

        return response()->json(['message' => 'Deleted successfully.']);
    }
}
