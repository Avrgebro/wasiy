<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class StorePhotoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * The dropzone promises "JPG o PNG · máx. 10 MB"; these rules are the
     * authority. mimetypes inspects the actual content, so an image
     * extension on a non-image file fails here.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'file' => [
                'required',
                'file',
                'mimes:jpg,jpeg,png',
                'mimetypes:image/jpeg,image/png',
                'max:'.(int) config('wasiy.photos.max_file_kb'),
            ],
        ];
    }
}
