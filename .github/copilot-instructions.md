# Project Guidelines

## Environment Setup

Dependencies are automatically pre-installed via `.github/workflows/copilot-setup-steps.yml` when Copilot starts working. This workflow:

- Sets up Node.js 24 with npm caching
- Installs all project dependencies with `npm ci`

## Code Style

- Use TypeScript with strict typing; avoid weakening types unless existing networking files already require it.
- Follow ESLint flat config in `eslint.config.js` and keep underscore-prefixed unused args/vars when intentionally unused.
- Keep formatting consistent with Prettier (`npm run format` / `npm run format:check`).
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

- UI and routing live in `src/main.tsx`, `src/App.tsx`, and `src/pages/*`.
- Core networking library is `src/gamenet/*` with public API from `src/gamenet/index.ts`.
- Keep signaling concerns behind `SignalServer` (`src/gamenet/signal_server.ts`) and concrete adapters (`signal_server_mqtt.ts`, `signal_server_local.ts`).
- Keep WebRTC peer-connection logic centralized in `src/gamenet/peer_conn.ts`.
- See `docs/gamenet-architecture.md` for module boundaries and host/join sequence flow.

## Build and Test

- Install: `npm install`
- Dev app: `npm run dev`
- Build: `npm run build`
- Preview build: `npm run preview`
- Lint: `npm run lint`
- Lint autofix: `npm run lint:fix`
- Format: `npm run format`
- Format check: `npm run format:check`
- Local WebSocket signaling server: `npm run local-server`
- Note: there is currently no standard test script in `package.json`; do not assume a default test runner.

## Conventions

- Signal server selection is global via `selectSignalServer(...)`; avoid changing defaults unless task requires it.
- Existing game payloads use `{ t, data }` envelopes over WebRTC data channels; preserve compatibility unless coordinated changes are requested.
- Prefer focused changes in the same module boundary (UI pages vs networking core vs signaling adapters).
- For local MQTT testing, use `local-mqtt/` Docker configuration and treat it as development-only infrastructure.
