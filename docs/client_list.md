# Client List Broadcast

This document describes how the host broadcasts connected clients and their ping values, and how join clients display that list.

## Overview

- The host periodically sends a roster snapshot to all connected clients.
- The snapshot contains connected client IDs and server-observed ping values.
- Join clients listen for the snapshot event and render it in the joined view.

## Message Contract

The roster uses the standard GameNet JSON envelope:

```ts
{ t: "clients_ping_list", data: ClientsPingListPayload }
```

Payload shape:

```ts
interface ClientsPingListEntry {
  clientId: string;
  nickname: string;
  pingMs: number | null;
}

interface ClientsPingListPayload {
  ts: number;
  clients: ClientsPingListEntry[];
}
```

Notes:

- `pingMs` is `null` when ping is not yet known.
- `nickname` is the client-provided display name, falling back to `clientId` if missing.
- Unknown ping is shown as `N/A` in the UI.
- This list includes connected remote clients only (not the host).

## Broadcast Behavior

Host behavior:

- Sends `clients_ping_list` every 500ms.
- Sends an immediate `clients_ping_list` snapshot on connect/disconnect.
- Uses default channel send options (no explicit reliability override).

## Client UI Behavior

Join page behavior:

- In joined state, the client listens for `clients_ping_list` updates.
- The latest list is stored in local page state.
- The list is rendered under the joined status card with:
  - Client ID
  - Ping value (formatted as milliseconds, or `N/A`)

## Files

- `packages/gamenet/src/game_server.ts` (broadcast producer)
- `packages/gamenet/src/clients_ping_list.ts` (payload types)
- `apps/example/src/pages/Game.tsx` (broadcast consumer + renderer)
