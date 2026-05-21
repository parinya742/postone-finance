<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class DomesticLetterRateController extends Controller
{
    private function query()
    {
        return DB::connection('n8n')->table('domestic_letter_rates');
    }

    private function settingsQuery()
    {
        return DB::connection('n8n')->table('domestic_letter_settings');
    }

    public function index(Request $request): JsonResponse
    {
        $rates = $this->query()->orderBy('weight')->get();
        $offset = (float) ($this->settingsQuery()->where('key', 'offset')->value('value') ?? 0);

        return response()->json([
            'data'   => $rates,
            'offset' => $offset,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'weight' => 'required|numeric|min:0',
            'rate'   => 'required|numeric|min:0',
        ]);

        $data['created_at'] = now();
        $data['updated_at'] = now();

        $id = $this->query()->insertGetId($data);
        $row = $this->query()->where('id', $id)->first();

        return response()->json($row, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $row = $this->query()->where('id', $id)->first();

        if (! $row) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        $data = $request->validate([
            'weight' => 'sometimes|numeric|min:0',
            'rate'   => 'sometimes|numeric|min:0',
        ]);

        $data['updated_at'] = now();

        $this->query()->where('id', $id)->update($data);
        $row = $this->query()->where('id', $id)->first();

        return response()->json($row);
    }

    public function destroy(int $id): JsonResponse
    {
        $affected = $this->query()->where('id', $id)->delete();

        if (! $affected) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        return response()->json(['message' => 'Deleted successfully.']);
    }

    public function updateOffset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'offset' => 'required|numeric',
        ]);

        $this->settingsQuery()->updateOrInsert(
            ['key' => 'offset'],
            ['value' => $data['offset'], 'updated_at' => now()]
        );

        return response()->json(['offset' => (float) $data['offset']]);
    }
}