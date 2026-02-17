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
  - Implements `hostGame(): Promise<GameServer>`.
  - Owns active `PeerConn`s for connected clients.
  - Converts data channel messages into typed events (via `mitt`).
  - Emits per-client `Channel` objects to game code.
- `game_client.ts`
  - Implements `joinGame({ serverId, extraLatency })`.
  - Creates local client id and drives join + offer flow.
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

### Routing submodule (separate abstraction)

`src/gamenet/routing/*` defines a generic in-process routing model:

- `client.ts`: generic message endpoint (`Client`).
- `adapter.ts`: adapter abstraction (can wrap workers).
- `router.ts`: route table + adapter/client registration and forwarding.
- `message.ts`: binary message shape (`ArrayBuffer`, `reliable` flag).

This routing module is currently orthogonal to `hostGame` / `joinGame` flows.

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

- Subscribes on `serverId` signaling topic/channel.
- For each joiner:
  - responds `joined`,
  - creates a `PeerConn` on offer,
  - tracks connection in `peerConns` and `dcMap`.
- Creates a per-client `Channel` abstraction with:
  - `on(type|"*")`
  - `emit(...)` / `emitRaw(...)`
  - `onDisconnect(...)`
- Sends periodic pings every 500 ms and maintains smoothed latency estimate.

### Client side (`GameClient`)

- Subscribes on generated `clientId` signaling channel.
- Sends initial `join` to `serverId`.
- On `joined`, creates offer and completes negotiation.
- On connect:
  - unsubscribes from signaling,
  - binds data channel handlers,
  - sends reliable `{t:"join"}` event,
  - auto-responds to host `ping` with `pong`.

## Data and event model

Game payloads are sent as JSON envelopes over data channels:

- outbound: `{ t: string, data: unknown }`
- inbound: parsed then emitted through `mitt` under event name `t`.

Wildcard handlers (`"*"`) are supported on both host `Channel` and client `GameClient`.

## Extension points

1. **Signal transport**: implement `SignalServer` and call `selectSignalServer(...)`.
2. **Message encoding**: replace JSON envelopes with binary codecs (see `msgpack.ts` prototype).
3. **Routing integration**: use `routing/` abstractions to bridge worker/local/remote endpoints.
4. **ICE config**: extend `iceServers` in `peer_conn.ts` for NAT traversal.

## Notable implementation characteristics

- Signal server is selected globally (singleton-style) rather than per session.
- Two-channel design allows reliability tradeoffs per message.
- `extraLatency` is a useful deterministic network simulation hook on client side.
- Host ping interval is created per connection and not currently cleared on disconnect/dispose.

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
- `src/gamenet/routing/client.ts`
- `src/gamenet/routing/adapter.ts`
- `src/gamenet/routing/router.ts`
- `src/gamenet/routing/message.ts`
- `src/gamenet/msgpack.ts`
