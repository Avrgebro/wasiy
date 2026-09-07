<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Concerns\HasUlids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['invoice_id', 'uploaded_by', 'disk', 'path', 'original_filename', 'mime_type', 'size_bytes', 'paid_on', 'amount_minor', 'operation_number'])]
class InvoicePaymentProof extends Model
{
    use HasFactory, HasUlids;

    protected function casts(): array
    {
        return ['paid_on' => 'immutable_date', 'size_bytes' => 'integer', 'amount_minor' => 'integer'];
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}
