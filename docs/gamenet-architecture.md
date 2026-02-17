# GameNet Architecture

This document describes the architecture implemented in `src/gamenet`.

## High-level overview

GameNet provides browser-based peer networking for multiplayer games:

- **Session bootstrap** via a pluggable **signal server** (MQTT or local WebSocket).
- **Peer transport** via **WebRTC RTCPeerConnection**.
- **Game messages** via two data channels:
  - `reliable` (ordered, default reliability)
  - `unreliable` (unordered, `maxRetransmits: 0`)
- **Host/client APIs** exposed by `hostGame()` and `joinGame()`.

At startup, `src/gamenet/index.ts` selects a default signal server implementation.

## Module map

### Public API

- `index.ts`
  - Re-exports `game_server` and `game_client` APIs.
  - Picks default signaling backend using `selectSignalServer(...)`.

### Core session APIs

- `game_server.ts`
  - Implements `hostGame(args?): Promise<GameServer>`.
  - Accepts optional `createAdapterManager` to inject custom server transport (default: WebRTC).
  - Owns active adapter-backed sessions for connected clients.
  - Converts data channel messages into typed events (via `mitt`).
  - Emits per-client `Channel` objects to game code.
- `game_client.ts`
  - Implements `joinGame(args)`.
  - Accepts optional `createAdapterSession` to inject custom client transport (default: WebRTC).
  - Creates local client id and starts adapter-backed join flow.
  - Emits inbound game events via `mitt`.
  - Supports optional synthetic latency (`extraLatency`) in both directions.

### IDs and channel naming

- `channel.ts`
  - `createHostChannelId()` produces a short numeric host code plus hash suffix.
  - `createClientChannelId()` uses `nanoid(21)`.

### WebRTC connection primitive

- `peer_conn.ts`
  - Wraps `RTCPeerConnection` setup.
  - Handles SDP offer/answer and ICE candidate exchange through a signaling adapter.
  - Creates and tracks `reliable` + `unreliable` data channels.
  - Exposes `sendJSON` and `sendRaw` with reliability selection.

### Signaling abstraction and implementations

- `signal_server.ts`
  - Defines `SignalServer` interface (`send`, `subscribe`, `unsubscribe`).
  - Maintains global selected implementation (`getSignalServer` / `selectSignalServer`).
- `signal_server_mqtt.ts`
  - MQTT-backed signaling using topic-per-recipient.
  - Default topic prefix: `pjoe.gamenet/`.
- `signal_server_local.ts`
  - Browser-side local WebSocket signaling client.
- `signal_server_local_server.ts`
  - Node/WebSocket reference signaling server for local development.

### Routing submodule

`src/gamenet/routing/*` defines a generic in-process routing model with pluggable transport adapters:

- `message.ts`: binary message shape (`ArrayBuffer`, `reliable` flag).
- `client.ts`: generic message endpoint (`Client`).
- `adapter.ts`: adapter abstraction + transport-agnostic session contracts (`ClientAdapterSession`, `ServerAdapterSession`, `ServerAdapterManager`).
- `worker_adapter.ts`: main-thread `createWorkerAdapter` + worker-side `createWorkerServerAdapterManager`.
- `adapter_webrtc.ts`: WebRTC adapter + client/server session/manager implementations (internal, not publicly exported).
- `envelope_payload.ts`: `decodeRoutingEnvelopePayload` for transparent routing payload unwrapping on client side.
- `router.ts`: route table + adapter/client registration and forwarding.
- `host_server_worker.ts`: worker entry point that runs `hostGame()` inside a Web Worker.

**Integration status**:

- Routing infrastructure is wired into `hostGame` and `joinGame` runtime
- Each `GameServer` creates a `Router` and registers adapters per connected peer
- Each `GameClient` creates a `Router` and registers an adapter for server connection
- `Host.tsx` implements the full worker-hosted topology: game server in worker, local host-client, and external WebRTC clients bridged through the main-thread router
- Routing messages coexist with existing non-routing messages on data channels
- **Not exported**: Routing API is internal and not exposed from `src/gamenet/index.ts`

See `docs/routing.md` for detailed flow diagrams and the worker-hosted architecture.

### Experimental / unused

- `msgpack.ts` is commented-out prototype code for MessagePack extension codecs.

## Host/client connection flow

```mermaid
sequenceDiagram
    participant H as Host (serverId)
    participant S as SignalServer
    participant C as Client (clientId)

    H->>S: subscribe(serverId)
    C->>S: subscribe(clientId)
    C->>S: send(clientId -> serverId, "join")
    S->>H: {from: clientId, t:"join"}
    H->>S: send(serverId -> clientId, "joined")
    S->>C: {from: serverId, t:"joined"}

    C->>C: create PeerConn + createOffer()
    C->>S: send("offer", localDescription)
    S->>H: offer
    H->>H: create PeerConn + setRemoteDescription(offer)
    H->>S: send("answer", localDescription)
    S->>C: answer

    C->>H: ICE candidates via SignalServer
    H->>C: ICE candidates via SignalServer

    C->>H: WebRTC data channels open
    C->>H: {t:"join"} over reliable channel
    Note over C,H: game payloads now flow over data channels
```

## Runtime responsibilities

### Host side (`GameServer`)

- Creates a `Router` instance for message routing.
- Delegates signaling + negotiation + data-channel lifecycle to a pluggable `ServerAdapterManager` (default: WebRTC; can be injected via `createAdapterManager` arg).
- For each connected session:
  - registers session adapter with router,
  - tracks session + adapter by remote client id,
  - bridges non-routing envelopes to `mitt` events.
- Creates a per-client `Channel` abstraction with:
  - `on(type|"*")`
  - `emit(...)` / `emitRaw(...)`
  - `onDisconnect(...)`
- Sends periodic pings every 500 ms and maintains smoothed latency estimate.
- Cleans up adapter routes on peer disconnect.

### Worker-hosted server (`Host.tsx` + `host_server_worker.ts`)

The primary hosting model runs `hostGame()` inside a Web Worker:

- Main thread creates a `Router`, spawns a worker, and registers a `WorkerAdapter` to bridge `postMessage` to the worker.
- Worker runs `hostGame()` with `createWorkerServerAdapterManager`, which receives control messages (`__client_connected`, `__client_disconnected`) and game messages via `postMessage`.
- The host browser tab joins its own game via `joinGame()` with `createLocalClientAdapterSession` — a purely in-process adapter that routes through the main-thread router without WebRTC.
- External clients connect via WebRTC to a `ServerWebRTCAdapterManager` on the main thread; per-client "bridge adapters" forward messages between the WebRTC session and the router/worker.
- The worker broadcasts `clients_ping_list` to all connected sessions (both local and external).

See `docs/routing.md` for detailed architecture diagrams and message flows.

### Client side (`GameClient`)

- Creates a `Router` instance for message routing.
- Delegates signaling + negotiation + data-channel lifecycle to a pluggable `ClientAdapterSession` (default: WebRTC; can be injected via `createAdapterSession` arg).
- On connect:
  - creates adapter from session and registers it with router,
  - sends reliable `{t:"join"}` event,
  - auto-responds to host `ping` with `pong`.
- Incoming messages pass through `decodeRoutingEnvelopePayload` to transparently unwrap routing payloads.
- Cleans up adapter on disconnect.

## Data and event model

Game payloads are sent as JSON envelopes over data channels:

- **Standard messages**: `{ t: string, data: unknown }`
  - Parsed and emitted through `mitt` under event name `t`
- **Routing messages**: `{ t: string, data: { from: string, to: string, payload: string } }`
  - Detected by structure and routed through `WebRTCAdapter` to `Router`
  - Payload is base64-encoded ArrayBuffer
  - Compatible with existing message flow (both types coexist)

Wildcard handlers (`"*"`) are supported on both host `Channel` and client `GameClient`.

## Extension points

1. **Signal transport**: implement `SignalServer` and call `selectSignalServer(...)`.
2. **Message encoding**: replace JSON envelopes with binary codecs (see `msgpack.ts` prototype).
3. **Routing API exposure**: export routing module from `src/gamenet/index.ts` when ready for public use.
4. **ICE config**: extend `iceServers` in `peer_conn.ts` for NAT traversal.
5. **Custom adapter sessions**: inject `createAdapterSession` into `joinGame()` or `createAdapterManager` into `hostGame()` for non-WebRTC transports.

## Notable implementation characteristics

- Signal server can be injected into adapter sessions, with global selected server used by default.
- Two-channel design allows reliability tradeoffs per message.
- `extraLatency` is a useful deterministic network simulation hook on client side.
- Host ping interval is created per connection and cleared on disconnect.
- Routing infrastructure is wired internally but not exposed in public API.
- Routing and non-routing messages coexist on same data channels without interference.
- `hostGame()` and `joinGame()` accept optional factory args for adapter managers/sessions, enabling non-WebRTC transports (e.g., worker-backed local sessions).
- The worker-hosted model keeps game logic off the main thread while the main thread handles WebRTC negotiation and message routing.

## File index

- `src/gamenet/index.ts`
- `src/gamenet/channel.ts`
- `src/gamenet/game_client.ts`
- `src/gamenet/game_server.ts`
- `src/gamenet/peer_conn.ts`
- `src/gamenet/signal_server.ts`
- `src/gamenet/signal_server_mqtt.ts`
- `src/gamenet/signal_server_local.ts`
- `src/gamenet/signal_server_local_server.ts`
- `src/gamenet/routing/message.ts`
- `src/gamenet/routing/client.ts`
- `src/gamenet/routing/adapter.ts`
- `src/gamenet/routing/worker_adapter.ts`
- `src/gamenet/routing/adapter_webrtc.ts` (internal, not exported)
- `src/gamenet/routing/envelope_payload.ts`
- `src/gamenet/routing/router.ts`
- `src/gamenet/routing/host_server_worker.ts`
- `src/gamenet/msgpack.ts`
