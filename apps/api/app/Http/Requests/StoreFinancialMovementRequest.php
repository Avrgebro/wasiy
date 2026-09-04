<?php

namespace App\Http\Requests;

use App\Enums\MovementCategory;
use App\Enums\MovementDirection;
use App\Enums\MovementStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreFinancialMovementRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        return [
            'direction' => ['required', Rule::enum(MovementDirection::class)],
            'category' => ['required', Rule::enum(MovementCategory::class)],
            'status' => ['sometimes', 'nullable', Rule::enum(MovementStatus::class)],
            'amount' => ['required', 'integer', 'min:1', 'max:100000000'],
            'concept' => ['required', 'string', 'max:120'],
            'detail' => ['sometimes', 'nullable', 'string', 'max:255'],
            'counterparty' => ['sometimes', 'nullable', 'string', 'max:120'],
            'unit_id' => ['sometimes', 'nullable', 'string', 'ulid'],
            'occurred_on' => ['required', 'date_format:Y-m-d'],
            'due_on' => ['sometimes', 'nullable', 'date_format:Y-m-d'],
            'note' => ['sometimes', 'nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * The category must belong to the direction, and the initial status must
     * fit the category: a deposit starts pending or held, everything else
     * pending or paid.
     */
    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            $category = MovementCategory::tryFrom((string) $this->input('category'));
            $direction = MovementDirection::tryFrom((string) $this->input('direction'));
            $status = MovementStatus::tryFrom((string) $this->input('status'));

            if ($category === null) {
                return;
            }

            if ($direction !== null && $category->direction() !== $direction) {
                $validator->errors()->add('category', __('That category does not belong to this kind of movement.'));
            }

            if ($status !== null && ! in_array($status, MovementStatus::initialFor($category), true)) {
                $validator->errors()->add('status', __('That status is not valid for this kind of movement.'));
            }
        });
    }
}
