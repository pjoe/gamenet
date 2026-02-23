# Project Guidelines

## Environment Setup

Dependencies are automatically pre-installed via `.github/workflows/copilot-setup-steps.yml` when Copilot starts working. This workflow:

- Sets up Node.js 24 with pnpm caching
- Installs all project dependencies with `pnpm install --frozen-lockfile`

## Code Style

- Use TypeScript with strict typing; avoid weakening types unless existing networking files already require it.
- Follow ESLint flat config in `eslint.config.js` and keep underscore-prefixed unused args/vars when intentionally unused.
- Keep formatting consistent with Prettier (`pnpm run format` / `pnpm run format:check`).
- Preserve existing event-driven style (`mitt`) for game networking flows.

## Commit messages

Use conventional commits style for commit messages, e.g.:

- `feat: add new feature`
- `fix: bug fix`
- `docs: update documentation`
- `refactor: code refactoring`
- `test: add or update tests`
- `chore: maintenance tasks`

## Architecture

This is a pnpm monorepo with two packages:

- `packages/gamenet` — the `@gamenet/core` library (networking, routing, signaling, React bindings)
- `apps/example` — the example app consuming the library

- UI and routing live in `apps/example/src/main.tsx`, `apps/example/src/App.tsx`, and `apps/example/src/pages/*`.
- Core networking library is `packages/gamenet/src/*` with public API from `packages/gamenet/src/index.ts`.
- React bindings (GameContext/useGame) are in `packages/gamenet/src/react/` and exported as `@gamenet/core/react`.
- Keep signaling concerns behind `SignalServer` (`packages/gamenet/src/signal_server.ts`) and concrete adapters.
- Keep WebRTC peer-connection logic centralized in `packages/gamenet/src/peer_conn.ts`.
- Signal server initialization is the app's responsibility (done in `apps/example/src/main.tsx`).
- See `docs/gamenet-architecture.md` for module boundaries and host/join sequence flow.

## Build and Test

- Install: `pnpm install`
- Dev app: `pnpm run dev`
- Build all: `pnpm run build`
- Build library only: `pnpm run build:lib`
- Preview build: `pnpm run preview`
- Test: `pnpm run test`
- Lint: `pnpm run lint`
- Lint autofix: `pnpm run lint:fix`
- Format: `pnpm run format`
- Format check: `pnpm run format:check`
- Local WebSocket signaling server: `pnpm run local-server`

## Conventions

- Signal server selection is global via `selectSignalServer(...)`; avoid changing defaults unless task requires it.
- Existing game payloads use `{ t, data }` envelopes over WebRTC data channels; preserve compatibility unless coordinated changes are requested.
- Prefer focused changes in the same module boundary (UI pages vs networking core vs signaling adapters).
- For local MQTT testing, use `local-mqtt/` Docker configuration and treat it as development-only infrastructure.
