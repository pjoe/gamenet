export interface ClientsPingListEntry {
  clientId: string;
  pingMs: number | null;
}

export interface ClientsPingListPayload {
  ts: number;
  clients: ClientsPingListEntry[];
}
