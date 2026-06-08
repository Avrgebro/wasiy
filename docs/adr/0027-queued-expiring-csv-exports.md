# Queued Expiring CSV Exports

Wasiy will generate CSV exports through queued jobs and store completed files on S3-compatible storage with an expiration period. Export requests will track status so users can request filtered exports without blocking API requests or risking timeouts on larger datasets.
