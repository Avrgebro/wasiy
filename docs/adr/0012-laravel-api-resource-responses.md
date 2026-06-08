# Laravel API Resource Responses

Wasiy will use Laravel API Resources and Laravel's native paginated response shape for REST responses. The frontend will rely on `data` for resources, `data`, `links`, and `meta` for paginated collections, and Laravel's default `message` and `errors` shape for validation and general errors instead of introducing a custom response wrapper in v1.
