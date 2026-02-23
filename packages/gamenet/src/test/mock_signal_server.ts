import { SignalServer } from "../signal_server";

type SignalMessage = {
  from: string;
  to: string;
  t: string;
  data?: unknown;
};

export interface MockSignalServer extends SignalServer {
  reset: () => void;
}

export function createMockSignalServer(): MockSignalServer {
  const subscriptions = new Map<string, (message: string) => void>();
  const queuedMessages = new Map<string, string[]>();

  const flushQueued = (to: string) => {
    const onMessage = subscriptions.get(to);
    const messages = queuedMessages.get(to);
    if (!onMessage || !messages || messages.length === 0) {
      return;
    }

    queuedMessages.delete(to);
    queueMicrotask(() => {
      for (const message of messages) {
        onMessage(message);
      }
    });
  };

  return {
    async send(from, to, t, data) {
      const envelope: SignalMessage = { from, to, t, data };
      const message = JSON.stringify(envelope);
      const onMessage = subscriptions.get(to);

      if (onMessage) {
        queueMicrotask(() => onMessage(message));
        return;
      }

      const current = queuedMessages.get(to) ?? [];
      current.push(message);
      queuedMessages.set(to, current);
    },
    subscribe(to, onMessage) {
      subscriptions.set(to, onMessage);
      flushQueued(to);
    },
    unsubscribe() {
      return;
    },
    reset() {
      subscriptions.clear();
      queuedMessages.clear();
    },
  };
}
