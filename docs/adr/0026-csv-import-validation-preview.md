# CSV Import Validation Preview

> **Status: superseded (2026-09-06).** The CSV import feature this ADR describes was removed from the codebase, tables included, to be rebuilt from scratch. Kept for the reasoning; do not treat the design below as current.


Wasiy CSV imports for units, residents, and related registry data will run through a queued validation and preview step before committing records. This prevents bad foundational registry data from being written directly and gives managers a chance to review valid rows, errors, duplicates, and warnings before confirming the import.
