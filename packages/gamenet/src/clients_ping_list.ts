export interface ClientsPingListEntry {
  clientId: string;
  nickname: string;
  pingMs: number | null;
}

export interface ClientsPingListPayload {
  ts: number;
  clients: ClientsPingListEntry[];
}
