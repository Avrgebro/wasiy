# GitHub Actions Quality Gates

Wasiy will use GitHub Actions to run backend and frontend quality gates on pull requests. Backend checks include dependency installation, Laravel Pint, Larastan/PHPStan, and Pest; frontend checks include pnpm install, TypeScript, ESLint, Vitest, and production build, with Playwright added for critical end-to-end flows as they stabilize.
