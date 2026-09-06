# Queued Expiring CSV Exports

> **Status: superseded (2026-09-06).** The CSV export feature this ADR describes was removed from the codebase, tables included, to be rebuilt from scratch. Kept for the reasoning; do not treat the design below as current.


Wasiy will generate CSV exports through queued jobs and store completed files on S3-compatible storage with an expiration period. Export requests will track status so users can request filtered exports without blocking API requests or risking timeouts on larger datasets.
