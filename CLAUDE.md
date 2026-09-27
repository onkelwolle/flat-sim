# flat-sim

Browser app for planning furniture placement on a scaled floor plan. Stack and rationale: `docs/adr/0001-browser-only-typescript-react-konva.md`.

## Commands

Toolchain (Node, pnpm) is pinned in `mise.toml`; run `mise install` first.

- `pnpm dev`: dev server at http://localhost:5173/flat-sim/
- `pnpm typecheck`, `pnpm lint` (oxlint), `pnpm format:check` / `pnpm format` (Prettier)
- `pnpm test`: Vitest unit tests (`src/**/*.test.ts`)
- `pnpm test:e2e`: Playwright against a production build (`e2e/`); needs `pnpm exec playwright install chromium` once

CI (`.github/workflows/ci.yml`) runs all of the above on PRs and `main`; `deploy.yml` publishes to GitHub Pages (manual trigger; Pages is not enabled yet, see workflow comment).

## Agent skills

### Issue tracker

Issues are tracked in this repo's GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses the default five triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.
