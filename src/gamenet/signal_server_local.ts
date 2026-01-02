import type { SignalServer } from "./signal_server";

interface Message {
  from: string;
  to: string;
  type: string;
  data?: any;
}

export function createLocalSignalServer(
  url: string = "ws://localhost:8080"
): SignalServer {
  let ws: WebSocket | null = null;
  let messageHandler: ((message: string) => void) | null = null;

  const send = async (
    from: string,
    to: string,
    t: string,
    data?: any
  ): Promise<void> => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    const message: Message = { from, to, type: t, data };
    ws.send(JSON.stringify(message));
  };

  const subscribe = (
    to: string,
    onMessage: (message: string) => void
  ): void => {
    messageHandler = onMessage;
    ws = new WebSocket(url);

    ws.onopen = () => {
      ws?.send(JSON.stringify({ type: "register", id: to }));
    };

    ws.onmessage = (event) => {
      if (messageHandler) {
        messageHandler(event.data);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };
  };

  const unsubscribe = (): void => {
    if (ws) {
      ws.close();
      ws = null;
    }
    messageHandler = null;
  };

  return { send, subscribe, unsubscribe };
}
