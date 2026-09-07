<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/** The drawer promises "Imagen o PDF, hasta 10 MB" (mockup 22c); these rules are the authority. */
class StorePaymentProofRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,pdf', 'mimetypes:image/jpeg,image/png,application/pdf', 'max:'.(int) config('wasiy.billing.proof_max_file_kb')],
            'paid_on' => ['sometimes', 'nullable', 'date', 'before_or_equal:today'],
            'amount_minor' => ['sometimes', 'nullable', 'integer', 'min:1'],
            'operation_number' => ['sometimes', 'nullable', 'string', 'max:60'],
        ];
    }
}
