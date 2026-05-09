import {
  Adapter,
  ClientAdapterSession,
  createHostChannelId,
  createRouter,
  createServerWebRTCAdapterManager,
  createWorkerAdapter,
  joinGame,
  Message,
  MessageEnvelope,
  MessageStatsEvent,
  Router,
} from "@gamenet/core";

const WORKER_SERVER_ID = "host-worker";

function createEmptyBuffer(): ArrayBuffer {
  return new ArrayBuffer(0);
}

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
}

function encodeClientConnectPayload(payload: {
  nickname?: string;
}): ArrayBuffer {
  const nickname = payload.nickname?.trim();
  if (!nickname) {
    return createEmptyBuffer();
  }

  return toArrayBuffer(new TextEncoder().encode(JSON.stringify({ nickname })));
}

/**
 * Creates a simple adapter for a WebRTC client that:
 * - receiveMessage: forwards routing Message data as binary envelope via session.sendMessage
 * - emitMessage: no-op (inbound messages are handled by session.onMessage in the caller)
 */
function createClientBridgeAdapter(
  adapterId: string,
  clientId: string,
  sendMessage: (msg: MessageEnvelope, options?: { reliable: boolean }) => void,
  sendRaw: (msg: ArrayBuffer, options?: { reliable: boolean }) => void
) {
  return {
    id: adapterId,
    clientIds: new Set<string>([clientId]),
    receiveMessage(message: Message) {
      this.onReceiveMessage?.(message);
      if (message.type === "raw" && message.data) {
        sendRaw(message.data, { reliable: message.reliable });
      } else {
        sendMessage(
          { t: message.type, data: message.data },
          { reliable: message.reliable }
        );
      }
    },
    emitMessage(message: Message) {
      this.onEmitMessage?.(message);
    },
  } satisfies Adapter;
}

/**
 * Creates a ClientAdapterSession that connects a GameClient to the host's
 * router locally (no WebRTC). Messages are routed through the host router
 * to the worker, and responses are delivered back via onMessage.
 */
function createLocalClientAdapterSession(args: {
  clientId: string;
  targetId: string;
  hostRouter: Router;
  nickname?: string;
}): ClientAdapterSession {
  const { clientId, targetId, hostRouter, nickname } = args;

  // Adapter registered with the host router to receive messages for this client
  const hostSideAdapter: Adapter = {
    id: `local:${clientId}`,
    clientIds: new Set([clientId]),
    receiveMessage(message: Message) {
      this.onReceiveMessage?.(message);
      session.onMessage?.({ t: message.type, data: message.data });
    },
    emitMessage(message: Message) {
      this.onEmitMessage?.(message);
    },
  };

  // Adapter returned to joinGame for its internal router registration
  const clientSideAdapter: Adapter = {
    id: `local-gw:${clientId}`,
    clientIds: new Set([targetId]),
    receiveMessage(message: Message) {
      this.onReceiveMessage?.(message);
    },
    emitMessage(message: Message) {
      this.onEmitMessage?.(message);
    },
  };

  const session: ClientAdapterSession = {
    adapter: undefined,
    sendMessage(msg: MessageEnvelope, options?: { reliable: boolean }) {
      const message: Message = {
        from: clientId,
        to: targetId,
        type: msg.t,
        data: msg.data,
        reliable: options?.reliable ?? true,
      };
      hostRouter.sendMessage(message);
    },
    sendRaw(data: ArrayBuffer, options?: { reliable: boolean }) {
      const message: Message = {
        from: clientId,
        to: targetId,
        type: "raw",
        data,
        reliable: options?.reliable ?? true,
      };
      hostRouter.sendMessage(message);
    },
    dispose() {
      hostRouter.adapters.delete(hostSideAdapter.id);
      hostRouter.routes.delete(clientId);
      const disconnectMsg: Message = {
        from: clientId,
        to: targetId,
        type: "__client_disconnected",
        data: createEmptyBuffer(),
        reliable: true,
      };
      hostRouter.sendMessage(disconnectMsg);
    },
  };

  hostRouter.registerAdapter(hostSideAdapter);

  // Notify worker that this client connected
  const connectMsg: Message = {
    from: clientId,
    to: targetId,
    type: "__client_connected",
    data: encodeClientConnectPayload({ nickname }),
    reliable: true,
  };
  hostRouter.sendMessage(connectMsg);

  // Connect immediately on next microtask
  session.adapter = clientSideAdapter;
  queueMicrotask(() => {
    session.onConnected?.(clientSideAdapter);
  });

  return session;
}

export async function setupHosting(args: { nickname: string; worker: Worker }) {
  const serverId = await createHostChannelId();
  const router = createRouter(serverId);
  const workerAdapter = createWorkerAdapter(WORKER_SERVER_ID, args.worker);
  workerAdapter.clientIds.add(WORKER_SERVER_ID);
  router.registerAdapter(workerAdapter);

  const serverStatsHandlers = new Set<(event: MessageStatsEvent) => void>();
  workerAdapter.onMessageStats = (event) => {
    const stats: MessageStatsEvent = {
      type: event.type,
      bytes: event.bytes,
    };
    serverStatsHandlers.forEach((handler) => handler(stats));
  };

  // Send __init to worker with serverId (must happen before joinGame
  // so the worker is ready to handle __client_connected)
  const initMessage: Message = {
    from: serverId,
    to: WORKER_SERVER_ID,
    type: "__init",
    data: createEmptyBuffer(),
    reliable: true,
  };
  router.sendMessage(initMessage);

  // Connect host as a regular game client through the router
  const hostClient = await joinGame({
    serverId,
    nickname: args.nickname,
    createAdapterSession: ({ clientId, nickname: localNickname }) =>
      createLocalClientAdapterSession({
        clientId,
        targetId: WORKER_SERVER_ID,
        hostRouter: router,
        nickname: localNickname,
      }),
  });

  const manager = createServerWebRTCAdapterManager({ serverId });

  manager.onConnection = (webrtcSession) => {
    const remoteId = webrtcSession.remoteId;

    // Create a bridge adapter for this client
    const bridgeAdapter = createClientBridgeAdapter(
      `bridge:${remoteId}`,
      remoteId,
      (msg, opts) => webrtcSession.sendMessage(msg, opts),
      (msg, opts) => webrtcSession.sendRaw(msg, opts)
    );
    router.registerAdapter(bridgeAdapter);

    // Forward incoming WebRTC messages from this client to the worker
    webrtcSession.onMessage = (json) => {
      const routedMessage: Message = {
        from: remoteId,
        to: WORKER_SERVER_ID,
        type: json.t,
        data: json.data,
        reliable: true,
      };
      router.sendMessage(routedMessage);
    };

    webrtcSession.onDisconnected = () => {
      router.adapters.delete(bridgeAdapter.id);
      router.routes.delete(remoteId);
      // Notify worker about disconnection
      const disconnectMsg: Message = {
        from: remoteId,
        to: WORKER_SERVER_ID,
        type: "__client_disconnected",
        data: createEmptyBuffer(),
        reliable: true,
      };
      router.sendMessage(disconnectMsg);
    };

    // Notify worker about new connection
    const connectMsg: Message = {
      from: remoteId,
      to: WORKER_SERVER_ID,
      type: "__client_connected",
      data: encodeClientConnectPayload({
        nickname: webrtcSession.nickname ?? remoteId,
      }),
      reliable: true,
    };
    router.sendMessage(connectMsg);
  };

  return {
    gameClient: hostClient,
    serverId,
    onServerMessageStats(handler: (event: MessageStatsEvent) => void) {
      serverStatsHandlers.add(handler);
      return () => {
        serverStatsHandlers.delete(handler);
      };
    },
    dispose() {
      router.adapters.delete(workerAdapter.id);
      args.worker.terminate();
      manager.dispose();
    },
  };
}
