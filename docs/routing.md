# Routing Architecture

This document describes the routing subsystem in `packages/gamenet/src/routing` and how messages flow between peers across local, worker, and remote (WebRTC) boundaries.

## Architecture overview

The primary hosting topology runs the game server inside a **Web Worker**, with the host browser tab acting as both the routing hub and a local game client. External players connect via WebRTC. The main-thread `Router` is the central hub that ties all components together.

```mermaid
graph LR
    subgraph "Host browser tab (main thread)"
        HC["Host Client<br/>(joinGame)"]
        R[Router]
        WA[Worker Adapter]
        BA["Bridge Adapter<br/>(per ext client)"]

        HC <--> R
        R <--> WA
        R <--> BA
    end

    subgraph "Worker Thread"
        W["Worker<br/>hostGame()"]
    end

    WA <-->|postMessage| W
    BA <-->|WebRTC<br/>PeerConn| EC

    EC["External Client<br/>(Join page)"]
```

### Components

| Component              | Location             | Role                                                                                                            |
| ---------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Router**             | Main thread          | Central message hub; routes between worker adapter, local host-client adapter, and per-client bridge adapters   |
| **Worker Adapter**     | Main thread → Worker | Bridges `postMessage` between main-thread router and worker thread (`createWorkerAdapter` from `@gamenet/core`) |
| **Worker Game Server** | Worker thread        | Runs `hostGame()` via `setupHostServerWorker` from `@gamenet/core/worker-setup`                                 |
| **Host Client**        | Main thread          | Regular `joinGame()` client connected locally via `createLocalClientAdapterSession`                             |
| **Bridge Adapter**     | Main thread          | Per-external-client adapter; converts between routing `Message` and WebRTC session `sendMessage`/`sendRaw`      |
| **WebRTC Manager**     | Main thread          | `createServerWebRTCAdapterManager` from `@gamenet/core` accepting external peer connections via signaling       |

### Combined topology diagram

```mermaid
graph LR
    subgraph "Worker Thread"
        GS[hostGame / GameServer]
        WM[WorkerServerAdapterManager]
        GS --- WM
    end

    subgraph "Main Thread"
        R[Router]
        WA[Worker Adapter]
        HC[Host Client - joinGame]
        LA[Local Adapter]
        BA1[Bridge Adapter 1]
        BA2[Bridge Adapter 2]

        R --- WA
        R --- LA
        R --- BA1
        R --- BA2
        HC --- LA
    end

    WA ---|postMessage| WM

    subgraph "External Clients"
        EC1[Client 1 - WebRTC]
        EC2[Client 2 - WebRTC]
    end

    BA1 ---|WebRTC| EC1
    BA2 ---|WebRTC| EC2
```

## Implementation status

- **Implemented**:
  - In-process router with direct local clients
  - Worker adapter for Web Worker communication (zero-copy `ArrayBuffer` transfers)
  - Worker-side `ServerAdapterManager` (`createWorkerServerAdapterManager`)
  - WebRTC adapter for remote peer communication using msgpack binary encoding
  - Worker-hosted game server with local host-client and external WebRTC clients (`Host.tsx`)
  - `envelope_payload.ts` for decoding routing payloads on the client side
- **Integration status**: WebRTC adapter is wired into `game_server.ts` and `game_client.ts` runtime; worker hosting is wired in `apps/example/src/pages/Host.tsx` and `apps/example/src/workers/host_server_worker.ts`; routing types and functions are exported from `@gamenet/core`

## Core module map

- `message.ts`
  - Defines `Message`:
    - `from: string`
    - `to: string`
    - `type: string`
    - `data: ArrayBuffer`
    - `reliable: boolean`
- `client.ts`
  - Defines `Client` with `receiveMessage(...)` and `emitMessage(...)` hooks.
  - `createClient(id)` builds a simple in-process endpoint.
- `adapter.ts`
  - Defines `Adapter` (`Client` + `clientIds` + client lifecycle hooks).
  - Defines transport-agnostic session contracts:
    - `ClientAdapterSession` — used by `joinGame()` to abstract client-side transport.
    - `ServerAdapterSession` / `ServerAdapterManager` — used by `hostGame()` to abstract server-side transport.
  - Re-exports worker adapter utilities from `worker_adapter.ts`.
- `worker_adapter.ts`
  - `createWorkerAdapter(id, worker)` — main-thread side; bridges router messages to a `Worker` via `postMessage` (with transferable `ArrayBuffer`).
  - `createWorkerServerAdapterManager(args)` — worker-thread side; creates a `ServerAdapterManager` that runs inside a Web Worker, dispatching control messages (`__client_connected`, `__client_disconnected`) and game messages to per-client sessions.
- `adapter_webrtc.ts`
  - `createWebRTCAdapter(id, remoteId, sendRawFrame)` bridges routing messages to/from WebRTC data channels using msgpack binary encoding.
  - `createClientWebRTCAdapterSession(args)` — full WebRTC client session lifecycle (signaling, PeerConn, adapter creation).
  - `createServerWebRTCAdapterManager(args)` — full WebRTC server manager lifecycle (signaling, PeerConn per client, adapter creation).
  - **Internal use only**: Not exported from `@gamenet/core` (only `createServerWebRTCAdapterManager` is exported).
- `envelope_payload.ts`
  - `decodeRoutingEnvelopePayload(data)` — detects and decodes base64-encoded routing payloads in message envelopes; used by `game_client.ts` to transparently unwrap routed messages.
- `host_server_worker_setup.ts` (exported as `@gamenet/core/worker-setup`)
  - Provides `setupHostServerWorker()` function for apps to create worker entry points.
  - Handles `__init` control message to bootstrap, then dispatches all subsequent messages to the adapter manager.
  - Runs game logic (connection handling, `clients_ping_list` broadcast) inside the worker thread.
- `host_server_worker.ts`
  - Library's own worker entry point (reference implementation) using `setupHostServerWorker()`.
- `router.ts`
  - Defines `Router` and `createRouter(id)`.
  - Maintains:
    - `adapters: Map<string, Adapter>`
    - `routes: Map<string, Client>` (client id → direct client or adapter)
    - optional `defaultRoute`.

## Worker-hosted game server (primary hosting model)

The primary hosting topology runs the game server inside a Web Worker, with the host browser tab acting as both the routing hub and a local game client. External players connect via WebRTC. This is implemented in `apps/example/src/pages/Host.tsx` (orchestrator) and `apps/example/src/workers/host_server_worker.ts` (worker entry using `@gamenet/core/worker-setup`).

### Startup sequence

1. `Host.tsx` creates a `serverId` and a main-thread `Router`.
2. A Web Worker is spawned running the app's worker entry point (`apps/example/src/workers/host_server_worker.ts`).
3. A `WorkerAdapter` (from `@gamenet/core`) is created and registered with the router (route target: `WORKER_SERVER_ID`).
4. An `__init` control message is sent to the worker with the `serverId`.
5. Inside the worker, `setupHostServerWorker` (from `@gamenet/core/worker-setup`) initializes `createWorkerServerAdapterManager` and starts `hostGame()`.
6. The host tab calls `joinGame()` (from `@gamenet/core`) with `createLocalClientAdapterSession`, connecting the host as a regular game client through the router (no WebRTC needed).
7. A `ServerWebRTCAdapterManager` (from `@gamenet/core`) is created on the main thread to accept incoming WebRTC connections from external clients.

### Control messages

The worker adapter protocol uses special message types for session lifecycle:

| Message type            | Direction     | Purpose                                                         |
| ----------------------- | ------------- | --------------------------------------------------------------- |
| `__init`                | Main → Worker | Bootstrap: passes `serverId`, triggers `hostGame()` in worker   |
| `__client_connected`    | Main → Worker | Notifies worker that a client (local or external) has connected |
| `__client_disconnected` | Main → Worker | Notifies worker that a client has disconnected                  |

### Local host-client flow

The host browser tab joins its own game as a regular client via `joinGame()`. Instead of using WebRTC, it uses `createLocalClientAdapterSession` which routes messages directly through the main-thread router to the worker.

```mermaid
sequenceDiagram
    participant HC as Host Client (joinGame)
    participant R as Router (main thread)
    participant WA as Worker Adapter
    participant W as Worker (hostGame)

    Note over HC,W: Host starts — joinGame with local adapter session

    R->>WA: __client_connected {from: hostClientId}
    WA->>W: postMessage(__client_connected)
    W->>W: createSession(hostClientId)

    HC->>R: sendMessage({from:hostClientId, to:worker, type:"join"})
    R->>WA: receiveMessage(...)
    WA->>W: postMessage(message)
    W->>W: session.onMessage({t:"join"})

    W->>WA: postMessage({from:worker, to:hostClientId, type:"ping"})
    WA->>R: emitMessage(...)
    R->>HC: hostSideAdapter.receiveMessage → session.onMessage({t:"ping"})
    HC->>R: sendMessage({type:"pong"})
```

The local host-client adapter (`createLocalClientAdapterSession`) works as follows:

- Registers a **host-side adapter** with the host router that receives messages destined for the host client and delivers them to `session.onMessage`.
- Returns a **client-side adapter** to `joinGame()` for its internal router registration.
- `sendMessage` / `sendRaw` encode the envelope into a routing `Message` and call `hostRouter.sendMessage(...)` directly (no serialization overhead beyond the routing `Message` struct).
- On `dispose`, sends `__client_disconnected` to the worker and removes routes.

### External client flow

External clients connect via WebRTC. The main thread acts as a bridge, forwarding messages between the WebRTC session and the worker via the router.

```mermaid
sequenceDiagram
    participant EC as External Client (Join page)
    participant WR as WebRTC PeerConn
    participant BA as Bridge Adapter (main thread)
    participant R as Router (main thread)
    participant WA as Worker Adapter
    participant W as Worker (hostGame)

    Note over EC,W: External client connects via WebRTC signaling

    EC->>WR: WebRTC data channel open
    WR->>BA: session established (onConnection)
    R->>WA: __client_connected {from: externalClientId}
    WA->>W: postMessage(__client_connected)
    W->>W: createSession(externalClientId)

    EC->>WR: sendMessage({t:"join"})
    WR->>BA: session.onMessage({t:"join"})
    BA->>R: sendMessage({from:ext, to:worker, type:"join"})
    R->>WA: receiveMessage(...)
    WA->>W: postMessage(message)
    W->>W: session.onMessage({t:"join"})

    W->>WA: postMessage({from:worker, to:ext, type:"msg", data:"Welcome"})
    WA->>R: emitMessage(...)
    R->>BA: receiveMessage(...)
    BA->>WR: session.sendMessage({t:"msg", data:...})
    WR->>EC: data channel message
```

The bridge adapter (`createClientBridgeAdapter` in `apps/example/src/pages/Host.tsx`) works as follows:

- Created per external client when `ServerWebRTCAdapterManager.onConnection` fires.
- `receiveMessage` forwards the routing `Message.data` as a `MessageEnvelope` via the WebRTC session's `sendMessage` / `sendRaw`.
- Incoming WebRTC messages from `session.onMessage` are encoded into routing `Message` format and sent to the router via `router.sendMessage(...)`.
- On disconnect, the bridge adapter and routes are cleaned up, and `__client_disconnected` is sent to the worker.

## Routing primitives

### 1) Local peers in the same thread (direct clients)

Local peers are registered directly with `registerClient(client)`.

- Router stores `routes.set(client.id, client)`.
- When a client emits (`client.onEmitMessage`), router calls `sendMessage(message)`.
- If `message.to` exists in `routes`, router forwards to that target's `receiveMessage(...)`.
- If no route exists, router forwards to `defaultRoute` if configured; otherwise logs a warning.

### 2) Local peers in a Web Worker (worker adapter)

Worker-hosted peers are represented through an adapter registered with `registerAdapter(adapter)`.

- Adapter route population:
  - Existing `adapter.clientIds` are inserted into router routes at registration time.
  - `adapter.onClientAdd` and `adapter.onClientRemove` keep route table in sync.
- Router-to-worker direction:
  - Router resolves destination to the worker adapter and calls `adapter.receiveMessage(message)`.
  - `createWorkerAdapter` posts to worker with `worker.postMessage(message, [message.data])` (zero-copy `ArrayBuffer` transfer).
- Worker-to-router direction:
  - Worker calls `postMessage(message, [message.data])` back to main thread.
  - Adapter `worker.onmessage` converts event data to `Message` and calls `adapter.emitMessage(message)`.
  - Router listens to `adapter.onEmitMessage`, updates source route (`message.from -> adapter`), then routes onward.

### 3) Remote peers via WebRTC

The WebRTC adapter (`adapter_webrtc.ts`) bridges the routing subsystem with WebRTC data channels using **msgpack binary encoding**.

**Outbound routing Message → WebRTC**:

- Routing `Message` is serialized to a binary msgpack frame via `encodeRoutingWireMessage`:
  - `from`, `to`, `type`, `reliable` fields are encoded directly
  - `data` (`ArrayBuffer`) is encoded as `Uint8Array`
- The msgpack frame is sent as raw binary over the data channel via `sendRaw`
- `Message.reliable` selects between reliable/unreliable data channels

**Inbound WebRTC → routing Message**:

- Raw binary data channel payload is decoded via `decodeRoutingWireMessage` using msgpack
- `from`, `to`, `type` are extracted as strings
- `data` (`Uint8Array`) is converted back to `ArrayBuffer`
- `reliable` falls back to the data channel's reliability if not present in the wire message
- Malformed payloads that fail msgpack decoding are silently dropped

## Direct WebRTC hosting (without worker)

When `hostGame()` is called directly (without a worker), the game server runs on the main thread with simpler routing:

- `GameServer` creates a `Router` and `ServerWebRTCAdapterManager`.
- Each WebRTC client gets a `WebRTCAdapter` registered with the router.
- Data channels use `bindPeerDataChannels` for raw binary message handling.
- Non-routing messages are dispatched via `mitt` events as before.

## Client-side routing (`game_client.ts`)

- `joinGame()` creates a `Router` and registers a local `Client` for the client's own ID.
- Connects to the server via `ClientAdapterSession` (WebRTC by default, or custom via `createAdapterSession` arg).
- On connect, the session's adapter is registered with the router.
- Incoming messages pass through `decodeRoutingEnvelopePayload` to transparently unwrap routing payloads before emitting to `mitt`.
- Adapter cleanup on disconnect removes routes.

## Primitives flow diagram (same-thread + worker)

```mermaid
sequenceDiagram
    participant C1 as Local Client A (main thread)
    participant R as Router
    participant C2 as Local Client B (main thread)
    participant WA as Worker Adapter
    participant W as Worker peer(s)

    Note over R,WA: Adapter registration wires client add/remove hooks

    C1->>R: emitMessage({from:A,to:B,type,data,reliable})
    R->>C2: receiveMessage(...)

    C1->>R: emitMessage({from:A,to:W1,...})
    R->>WA: receiveMessage(...)
    WA->>W: postMessage(message, [message.data])

    W->>WA: postMessage({from:W1,to:B,...})
    WA->>R: emitMessage(...)
    Note over R: routes.set(from, WA)
    R->>C2: receiveMessage(...)

    C1->>R: emitMessage({to:unknown,...})
    alt defaultRoute set
        R->>WA: receiveMessage(...)
    else no defaultRoute
        R-->>R: warn("No route found")
    end
```

## Primitives flow diagram (WebRTC adapter)

```mermaid
sequenceDiagram
    participant L as Local Client (Router side)
    participant R as Router
    participant RA as WebRTC Adapter
    participant PC as PeerConn
    participant RP as Remote Peer

    L->>R: emitMessage({from:local,to:remote,type,data,reliable})
    R->>RA: receiveMessage(...)
    RA->>RA: encodeRoutingWireMessage (msgpack)
    RA->>PC: sendRaw(msgpackFrame, {reliable})
    PC->>RP: binary data channel payload

    RP->>PC: binary payload from remote
    PC->>RA: dc.onmessage (ArrayBuffer)
    RA->>RA: decodeRoutingWireMessage (msgpack)
    RA->>R: emitMessage({from:remote,to:local,...})
    R->>L: receiveMessage(...)
```

## Routing decisions and guarantees

- Routing key is destination id (`message.to`).
- Source learning exists for adapters (`message.from` is bound to emitting adapter).
- Reliability is part of the message contract (`reliable: boolean`) and remains explicit through WebRTC transport.
- Router itself does not serialize payloads; transport adapters own wire-format translation.
- WebRTC adapter uses msgpack binary encoding for `Message` transport over data channels.
- Worker adapter uses `postMessage` with transferable `ArrayBuffer` (zero-copy).

## Compatibility

- Existing non-routing `{ t, data }` messages continue to work unchanged
- Routing messages use msgpack binary encoding over data channels
- `decodeRoutingEnvelopePayload` on the client side transparently unwraps routing payloads (supports base64-encoded payloads for backward compatibility)
- No signaling protocol changes required
- Backward compatible with existing game code

## Extension points

1. Add new `Adapter` implementations for other transport mechanisms.
2. Use `defaultRoute` as an upstream fallback for unresolved destinations.
3. Add policy checks (authorization, filtering, metrics) at adapter boundaries before forwarding.
4. Replace msgpack with other binary codecs or direct ArrayBuffer transfer for specific use cases.
5. Add route discovery mechanisms for clients to discover other clients' IDs.
6. Support multi-hop forwarding through intermediate peers.

## Current limitations and known issues

- No built-in persistence or retry strategy at router level
- Route lifecycle for adapter-owned clients depends on adapter hook correctness (`onClientAdd`/`onClientRemove`)
- No automatic route discovery mechanism for peer-to-peer communication
- Messages must fit within data channel MTU limits (msgpack-encoded payload overhead)

## File index

### Library (`packages/gamenet/src/routing/`)

- `message.ts` — `Message` type
- `client.ts` — `Client` type and `createClient`
- `adapter.ts` — `Adapter`, `ClientAdapterSession`, `ServerAdapterSession`, `ServerAdapterManager`
- `worker_adapter.ts` — `createWorkerAdapter`, `createWorkerServerAdapterManager`
- `adapter_webrtc.ts` — WebRTC adapter, session, and manager implementations (msgpack binary encoding)
- `envelope_payload.ts` — `decodeRoutingEnvelopePayload`
- `router.ts` — `Router` and `createRouter`
- `host_server_worker_setup.ts` — `setupHostServerWorker` (exported as `@gamenet/core/worker-setup`)
- `host_server_worker.ts` — Reference worker entry point

### Example app (`apps/example/src/`)

- `pages/Host.tsx` — UI orchestrator: worker hosting, local host-client, external client bridging
- `workers/host_server_worker.ts` — Worker entry point (uses `@gamenet/core/worker-setup`)
