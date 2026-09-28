# flat-sim

Browser app for planning furniture placement on a scaled floor plan. Stack and rationale: `docs/adr/0001-browser-only-typescript-react-konva.md`.

## Commands

Toolchain (Node, pnpm, gitleaks) is pinned in `mise.toml`; run `mise install` first. `pnpm install` points git at `.githooks/`, whose pre-commit hook blocks staged secrets via gitleaks.

- `pnpm dev`: dev server at http://localhost:5173/flat-sim/
- `pnpm typecheck`, `pnpm lint` (oxlint), `pnpm format:check` / `pnpm format` (Prettier)
- `pnpm test`: Vitest unit tests (`src/**/*.test.ts`)
- `pnpm test:e2e`: Playwright against a production build (`e2e/`); needs `pnpm exec playwright install chromium` once. Touch specs live in `e2e/touch/` and run only in the touch-emulated `tablet` project (multi-finger gestures via `e2e/touch/fingers.ts`)

CI (`.github/workflows/ci.yml`) runs all of the above on PRs and `main`; `deploy.yml` publishes `main` to https://onkelwolle.github.io/flat-sim/.

## Agent skills

### Issue tracker

Issues are tracked in this repo's GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default five triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.
