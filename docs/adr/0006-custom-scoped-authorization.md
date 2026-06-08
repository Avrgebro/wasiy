# Custom Scoped Authorization

Wasiy will use Laravel Policies and Gates with explicit account-scoped and location-scoped role assignment models instead of hard-coded role checks or a generic permission package in v1. The product's permissions depend on Account, Location, role, Resident, and Unit Membership relationships, so authorization should remain expressed in the domain model.
