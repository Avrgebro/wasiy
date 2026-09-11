# Money in Minor Units

Every money value is an integer number of cents, and every field that carries one ends in `_minor`. 199.50 soles is stored, transmitted and validated as `19950`. The web converts at exactly two places: the shared `MoneyInput` and `formatMoney`.

## Context

V1 stored amenity fees and deposits, reservation snapshots, financial movements and unit maintenance fees as whole soles in unsigned integers, and the inputs were integer-only with an "S/ " mask. Invoices and payment proofs, added later (ADR 0040), already used `amount_minor` cents. Two conventions for one concept, and no way to enter S/ 199.50 anywhere outside billing.

Decimal columns were the alternative: keep names, change types to `decimal(10,2)`. Rejected because it leaves two conventions in place, because JavaScript sums of decimals drift, and because the billing side had already proven the integer approach.

## Decisions

- Storage: unsigned integers in cents. Columns are renamed with the `_minor` suffix; the migration multiplies existing rows by 100 and its `down` divides and renames back. `financial_movements.amount_minor` is a big integer so sums do not overflow.
- API: request fields, resource fields, sort keys and computed totals all carry the suffix (`amount_minor`, `fee_amount_minor`, `balance_minor`, `dues_issued_total_minor`, …). Counts stay unsuffixed. Validation is integer, never decimal.
- Web: form state holds cents. `MoneyInput` (components/ui) shows soles with two decimals, a "S/" `leftSection` instead of a text mask, and emits cents. `formatMoney(minor)` prints "S/ 1 250" when there are no cents and "S/ 1 250.50" otherwise. No other code divides or multiplies by 100.
- Activity log messages print soles with two decimals through one helper.

## Consequences

Amounts accept cents everywhere. The API contract changed names, so clients built against the old fields must move to `_minor`. Summing amounts in JavaScript is exact. A future second currency changes the formatter and the symbol in `MoneyInput`, nothing in storage.
