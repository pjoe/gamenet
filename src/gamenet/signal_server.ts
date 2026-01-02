export interface SignalServer {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send(from: string, to: string, t: string, data?: any): Promise<void>;
  subscribe(to: string, onMessage: (message: string) => void): void;
  unsubscribe(): void;
}

let _signalServer: SignalServer;
export function getSignalServer(): SignalServer {
  return _signalServer;
}

export function selectSignalServer(signalServer: SignalServer) {
  _signalServer = signalServer;
}
