---
description: "Use when editing GameNet networking modules. Covers signaling abstraction, host/join handshake compatibility, and WebRTC data-channel message conventions."
name: "GameNet Networking Guidelines"
applyTo: "packages/gamenet/src/**"
---

# GameNet Networking Guidelines

- Keep public networking API stable via `packages/gamenet/src/index.ts` exports unless the task explicitly requires API changes.
- Preserve signaling abstraction boundaries: depend on `SignalServer` (`signal_server.ts`) and keep transport-specific logic in adapters.
- Signal server initialization is an app-level concern — the library exports factories (`createMqttSignalServer`, `createLocalSignalServer`) and `selectSignalServer()`.
- Maintain host/join flow compatibility (`join` -> `joined` -> `offer/answer/candidate`) across `game_client.ts`, `game_server.ts`, and `peer_conn.ts`.
- Preserve payload envelope compatibility over data channels: `{ t, data }` for JSON messages.
- Keep reliability semantics explicit (`reliable` vs `unreliable`) and avoid silent behavior changes in channel routing.
- Reference `docs/gamenet-architecture.md` before structural refactors and keep docs in sync for architecture changes.
