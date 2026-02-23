/**
 * GameNet Library
 * Core networking and game state management utilities
 */

// Core game client/server
export * from "./game_client";
export * from "./game_server";

// Signaling
export { getSignalServer, selectSignalServer } from "./signal_server";
export type { SignalServer } from "./signal_server";
export { createLocalSignalServer } from "./signal_server_local";
export { createMqttSignalServer } from "./signal_server_mqtt";

// Channel utilities
export { createClientChannelId, createHostChannelId } from "./channel";

// Serialization
export { createJsonPayloadSerde, createMsgpackPayloadSerde } from "./serde";
export type { PayloadSerde } from "./serde";

// Telemetry types
export type {
  ClientsPingListEntry,
  ClientsPingListPayload,
} from "./clients_ping_list";

// Routing
export { createWorkerAdapter } from "./routing/adapter";
export type {
  Adapter,
  ClientAdapterSession,
  MessageEnvelope,
  ServerAdapterManager,
  ServerAdapterSession,
} from "./routing/adapter";
export { createServerWebRTCAdapterManager } from "./routing/adapter_webrtc";
export type { Message } from "./routing/message";
export { createRouter } from "./routing/router";
export type { Router } from "./routing/router";
