<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class EmsRateController extends Controller
{
    private function query()
    {
        return DB::connection('n8n')->table('ems_rates')->whereNull('deleted_at');
    }

    private function settingsQuery()
    {
        return DB::connection('n8n')->table('ems_settings');
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
        $data['created_by'] = auth()->id();
        $data['updated_by'] = auth()->id();

        $id = DB::connection('n8n')->table('ems_rates')->insertGetId($data);
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
        $data['updated_by'] = auth()->id();

        $this->query()->where('id', $id)->update($data);
        $row = $this->query()->where('id', $id)->first();

        return response()->json($row);
    }

    public function destroy(int $id): JsonResponse
    {
        $row = $this->query()->where('id', $id)->first();

        if (! $row) {
            return response()->json(['message' => 'ไม่พบข้อมูล'], 404);
        }

        DB::connection('n8n')->table('ems_rates')->where('id', $id)->update([
            'deleted_at' => now(),
            'deleted_by' => auth()->id(),
        ]);

        return response()->json(['message' => 'Deleted successfully.']);
    }

    public function updateOffset(Request $request): JsonResponse
    {
        $data = $request->validate([
            'offset' => 'required|numeric',
        ]);

        $this->settingsQuery()->updateOrInsert(
            ['key' => 'offset'],
            ['value' => $data['offset'], 'updated_at' => now(), 'updated_by' => auth()->id()]
        );

        return response()->json(['offset' => (float) $data['offset']]);
    }
}
