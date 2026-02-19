/**
 * GameNet Library
 * Core networking and game state management utilities
 */

import { selectSignalServer } from "./signal_server";
import { createLocalSignalServer } from "./signal_server_local";
import { createMqttSignalServer } from "./signal_server_mqtt";

export * from "./game_client";
export * from "./game_server";

const signalKind = import.meta.env.VITE_SIGNAL_SERVER_KIND;
const signalUrl = import.meta.env.VITE_SIGNAL_SERVER_URL;

const DEFAULT_SIGNAL_SERVER_URL = "ws://localhost:9001";
// const DEFAULT_SIGNAL_SERVER_URL = "wss://test.mosquitto.org:8081";

function getDefaultMqttUrl() {
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    return DEFAULT_SIGNAL_SERVER_URL;
  }

  return "wss://test.mosquitto.org:8081";
}

function selectDefaultSignalServer() {
  if (signalKind === "mqtt") {
    const mqttUrl = signalUrl ?? getDefaultMqttUrl();
    return createMqttSignalServer(mqttUrl);
  }

  if (signalKind === "local") {
    return createLocalSignalServer(signalUrl ?? "ws://localhost:8080");
  }

  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    return createMqttSignalServer(DEFAULT_SIGNAL_SERVER_URL);
  }

  return createMqttSignalServer(getDefaultMqttUrl());
}

selectSignalServer(selectDefaultSignalServer());
