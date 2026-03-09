# GameNet

Browser-based peer networking for multiplayer games, built on WebRTC data channels with pluggable signaling.

## Features

- **WebRTC peer transport** with `reliable` (ordered) and `unreliable` (unordered, zero retransmit) data channels
- **Pluggable signaling** — MQTT or local WebSocket signal servers
- **Host/client model** — `hostGame()` and `joinGame()` APIs for session management
- **Worker-hosted topology** — run the game server in a Web Worker with routing adapters
- **React bindings** — `GameProvider` and `useGame` hook for React apps
- **Serialization** — JSON and MessagePack payload serializers
- **Synthetic latency** — configurable extra latency for testing

## Monorepo Structure

| Package                    | Path                  | Description                                                          |
| -------------------------- | --------------------- | -------------------------------------------------------------------- |
| `@gamenet/core`            | `packages/gamenet`    | Core networking library (signaling, WebRTC, routing, React bindings) |
| `@gamenet/example-ui`      | `packages/example-ui` | Shared UI components for example apps                                |
| `@gamenet/example-app`     | `apps/example`        | Example app consuming the library                                    |
| `@gamenet/example-app-bjs` | `apps/example-bjs`    | Example app with Babylon.js integration                              |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 24+
- [pnpm](https://pnpm.io/) 10+

### Install

```sh
pnpm install
```

### Development

```sh
# Run the example app
pnpm run dev

# Run the Babylon.js example app
pnpm run dev:bjs

# Start the local WebSocket signaling server
pnpm run local-server
```

### Build

```sh
# Build everything
pnpm run build

# Build the library only
pnpm run build:lib
```

### Test & Lint

```sh
pnpm run test
pnpm run lint
pnpm run format:check
```

## Architecture

GameNet bootstraps sessions via a pluggable signal server, then establishes WebRTC peer connections for game traffic. Messages flow over two data channels (`reliable` and `unreliable`) using `{ t, data }` envelopes.

The routing subsystem supports running the game server in a Web Worker, with adapters bridging between main-thread WebRTC connections and the worker.

See [docs/gamenet-architecture.md](docs/gamenet-architecture.md) for full details.

## License

[Apache License 2.0](LICENSE.md)
