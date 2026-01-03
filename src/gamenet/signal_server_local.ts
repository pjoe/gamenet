import type { SignalServer } from "./signal_server";

interface Message {
  from: string;
  to: string;
  t: string;
  data?: unknown;
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
    data?: unknown
  ): Promise<void> => {
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      await new Promise<void>((resolve, reject) => {
        if (!ws) {
          ws = new WebSocket(url);
          ws.addEventListener("open", () => {
            console.debug("WebSocket connected");
            ws?.send(JSON.stringify({ t: "register", from }));
            resolve();
          });
        } else {
          ws.addEventListener("open", () => {
            console.debug("WebSocket connected now ");
            resolve();
          });
        }

        ws.addEventListener("error", (error) => {
          console.error("WebSocket error:", error);
          reject(error);
        });
      });
    }
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      throw new Error("WebSocket is not connected");
    }

    const message: Message = { from, to, t, data };
    ws.send(JSON.stringify(message));
  };

  const subscribe = (
    to: string,
    onMessage: (message: string) => void
  ): void => {
    messageHandler = onMessage;
    if (!ws) {
      ws = new WebSocket(url);

      ws.addEventListener("open", () => {
        ws?.send(JSON.stringify({ t: "register", from: to }));
      });
    }

    ws.addEventListener("message", (event) => {
      if (messageHandler) {
        messageHandler(event.data);
      }
    });

    ws.addEventListener("error", (error) => {
      console.error("WebSocket error:", error);
    });
    ws.addEventListener("close", () => {
      console.log("WebSocket connection closed");
    });
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
