<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SpecialPostalZoneController extends Controller
{
    private function query()
    {
        return DB::connection('n8n')->table('special_postal_zones');
    }

    public function index(Request $request): JsonResponse
    {
        $q = $this->query()->orderBy('seq');

        if ($request->filled('search')) {
            $s = $request->search;
            $q->where(function ($qb) use ($s) {
                $qb->where('province', 'ilike', "%{$s}%")
                   ->orWhere('office_name', 'ilike', "%{$s}%")
                   ->orWhere('postal_code', 'ilike', "%{$s}%")
                   ->orWhere('area_description', 'ilike', "%{$s}%");
            });
        }

        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'seq'              => 'required|integer',
            'area_group'       => 'required|integer',
            'province'         => 'required|string|max:100',
            'office_name'      => 'required|string|max:100',
            'postal_code'      => 'required|string|max:5',
            'area_description' => 'nullable|string|max:200',
            'rate'             => 'required|numeric',
        ]);

        $data['created_at'] = now();
        $data['updated_at'] = now();

        $id = $this->query()->insertGetId($data);
        $row = $this->query()->where('id', $id)->first();

        return response()->json($row, 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $data = $request->validate([
            'seq'              => 'sometimes|integer',
            'area_group'       => 'sometimes|integer',
            'province'         => 'sometimes|string|max:100',
            'office_name'      => 'sometimes|string|max:100',
            'postal_code'      => 'sometimes|string|max:5',
            'area_description' => 'nullable|string|max:200',
            'rate'             => 'sometimes|numeric',
        ]);

        $data['updated_at'] = now();

        $this->query()->where('id', $id)->update($data);
        $row = $this->query()->where('id', $id)->first();

        return response()->json($row);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->query()->where('id', $id)->delete();

        return response()->json(['message' => 'Deleted successfully.']);
    }
}
