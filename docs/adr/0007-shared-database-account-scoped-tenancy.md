# Shared Database Account-Scoped Tenancy

Wasiy will use a single PostgreSQL database with shared tables and explicit `account_id` scoping for tenant-owned records. This keeps v1 operations, migrations, and reporting simpler than database-per-account or schema-per-account tenancy while requiring strict backend authorization and query scoping.
