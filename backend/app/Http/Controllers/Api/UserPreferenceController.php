<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\UserPreference;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserPreferenceController extends Controller
{
    public function show(string $key): JsonResponse
    {
        $pref = UserPreference::where('user_id', Auth::id())
            ->where('key', $key)
            ->first();

        return response()->json(['value' => $pref?->value ?? null]);
    }

    public function upsert(Request $request, string $key): JsonResponse
    {
        $request->validate(['value' => 'required']);

        UserPreference::updateOrCreate(
            ['user_id' => Auth::id(), 'key' => $key],
            ['value'   => $request->input('value')]
        );

        return response()->json(['ok' => true]);
    }
}
