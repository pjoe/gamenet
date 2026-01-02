/**
 * GameNet Library
 * Core networking and game state management utilities
 */

import { selectSignalServer } from "./signal_server";
import { createMqttSignalServer } from "./signal_server_mqtt";

export * from "./game_server";
export * from "./game_client";

// default signal serve
//selectSignalServer(createMqttSignalServer("ws://localhost:9001"));
selectSignalServer(createMqttSignalServer("wss://test.mosquitto.org:8081"));
//selectSignalServer(createLocalSignalServer());
