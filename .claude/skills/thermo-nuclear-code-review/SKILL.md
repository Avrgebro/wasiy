---
name: thermo-nuclear-code-review
description: Extremely strict maintainability review focused on abstraction quality, oversized files, and spaghetti-condition growth. Invoke explicitly with /thermo-nuclear-code-review — reviews the current diff (or a given branch/PR/path).
disable-model-invocation: true
---

# Thermo-Nuclear Code Review

You are running an unusually strict review. The bar is not "does it work" — it is implementation quality, maintainability, abstraction quality, and long-term codebase health. Actively hunt for "code judo" moves: restructurings that keep behavior identical while making the implementation dramatically simpler.

## Scope

Review the current working-tree diff against the merge base with `main` by default (`git diff main...HEAD` plus uncommitted changes). If the user names a branch, PR number, or path, review that instead. Read enough surrounding code to judge structure — never review a hunk in isolation.

This repo is a pnpm monorepo:
- `apps/api` — Laravel (PHP). Tests: `php artisan test` (or `pnpm test:api`).
- `apps/web` — React + TypeScript (Vite, Mantine). Lint: `pnpm lint:web`.
- `apps/marketing` — marketing site.

## Non-negotiable standards

1. **Structural ambition.** Don't settle for incremental cleanups. Look for changes that make whole branches, helper functions, modes, or conditionals disappear entirely.
2. **File-size threshold.** Any change that pushes a file from under 1,000 lines to over 1,000 lines is a presumptive quality problem unless there is a compelling structural reason. For this repo that especially means Laravel controllers/models in `apps/api/app` and React components in `apps/web/src`.
3. **Spaghetti detection.** Reject ad-hoc conditionals or special cases sprinkled into unrelated flows. That logic belongs in a dedicated abstraction — a policy, service class, form request, or middleware on the API side; a hook, context, or extracted component on the web side.
4. **Design over pragmatism.** Prefer clean structure with identical behavior over messier code that merely works.
5. **Type clarity.** Challenge unnecessary optionality, `any` (TS) / `mixed` (PHP), and cast-heavy code. Favor explicit typed models: TypeScript interfaces/discriminated unions on the web side; typed DTOs, enums, and form requests on the API side.
6. **Canonical layer.** Feature logic stays isolated, and existing helpers get reused. Flag bespoke one-offs that duplicate an existing utility, Eloquent scope, hook, or shared component.
7. **Atomic updates.** Flag sequential orchestration where parallel execution is feasible, and multi-step state mutations that should be a single atomic transition (e.g., DB writes that belong inside one transaction; sequential awaits that could be `Promise.all`).

## Review priorities (descending)

1. Structural regressions
2. Missed simplification opportunities
3. Branching-complexity increases
4. Abstraction and type problems
5. File-size concerns
6. Modularity issues
7. Legibility gaps

## Approval blockers

Presumptively block (verdict: **REQUEST CHANGES**) unless clearly justified in the diff or its description:

- Incidental complexity kept where a code-judo move would eliminate it
- A file crossing the 1,000-line threshold
- Ad-hoc branching tangled into existing flows
- Feature checks scattered across shared code instead of centralized
- Unnecessary wrapper layers or cast-heavy contracts
- Duplicated helpers, or logic placed in the wrong layer (e.g., business rules in a controller or a React component)

## Output format

Deliver a report with:

1. **Verdict** — APPROVE or REQUEST CHANGES, with a one-paragraph rationale.
2. **Findings** — ordered by the priority list above. For each: `file:line`, what's wrong, why it hurts maintainability, and a concrete restructuring (sketch the code-judo move — show the shape of the simpler version, not just "refactor this").
3. **Code-judo opportunities** — simplifications that aren't blockers but would meaningfully shrink or flatten the implementation.

Be blunt. Do not soften findings, and do not pad the report with praise. Never propose a restructuring that changes behavior — every suggestion must be behavior-preserving.
