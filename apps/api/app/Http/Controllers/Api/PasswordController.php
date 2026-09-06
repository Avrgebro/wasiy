<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\Rules\Password;

/** Self-service password change for any signed-in user, staff or resident. */
class PasswordController extends Controller
{
    public function update(Request $request): Response
    {
        $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        $request->user()->forceFill(['password' => $request->input('password')])->save();

        return response()->noContent();
    }
}
