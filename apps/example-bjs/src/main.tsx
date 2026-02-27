import {
  createLocalSignalServer,
  createMqttSignalServer,
  selectSignalServer,
} from "@gamenet/core";
import { GameProvider } from "@gamenet/core/react";
import { ThemeProvider } from "@gamenet/example-ui";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Signal server initialization (moved from library to app responsibility)
const signalKind = import.meta.env.VITE_SIGNAL_SERVER_KIND;
const signalUrl = import.meta.env.VITE_SIGNAL_SERVER_URL;
// const DEFAULT_SIGNAL_SERVER_URL = "wss://test.mosquitto.org:8081";
const DEFAULT_SIGNAL_SERVER_URL = "wss://broker.emqx.io:8084/mqtt";

function getDefaultMqttUrl() {
  if (
    typeof window !== "undefined" &&
    window.location.hostname === "localhost"
  ) {
    return DEFAULT_SIGNAL_SERVER_URL;
  }
  return DEFAULT_SIGNAL_SERVER_URL;
}

function selectDefaultSignalServer() {
  if (signalKind === "mqtt") {
    return createMqttSignalServer(signalUrl ?? getDefaultMqttUrl());
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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <GameProvider>
        <App />
      </GameProvider>
    </ThemeProvider>
  </StrictMode>
);
