# Vercel Web and Forge API Deployment

Wasiy will deploy the Vite React SPA to Vercel from `apps/web` and the Laravel API to Laravel Forge from `apps/api`. Production should prefer managed PostgreSQL, Redis, object storage, and transactional email services, while staging may self-host PostgreSQL on the same Forge server to reduce early infrastructure overhead.
