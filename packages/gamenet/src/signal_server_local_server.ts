// Server-side implementation (run with Node.js)
import { WebSocket, WebSocketServer } from "ws";

const startServer = (port: number = 8080) => {
  const wss = new WebSocketServer({ port });
  const clients = new Map<string, WebSocket>();

  wss.on("connection", (ws) => {
    let clientId: string | null = null;

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString());

      if (message.t === "register") {
        clientId = message.from;
        if (!clientId) return;
        clients.set(clientId, ws);
        console.log(`Client registered: ${clientId}`);
        return;
      }

      console.log(
        `Message from ${message.from} to ${message.to}: ${message.t}`
      );
      const recipient = clients.get(message.to);
      if (recipient && recipient.readyState === 1) {
        recipient.send(JSON.stringify(message));
      }
    });

    ws.on("close", () => {
      if (clientId) {
        clients.delete(clientId);
        console.log(`Client disconnected: ${clientId}`);
      }
    });
  });

  console.log(`Signal server running on ws://localhost:${port}`);
};

startServer();
