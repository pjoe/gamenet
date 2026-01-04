export interface Message {
  from: string;
  to: string;
  type: string;
  data: ArrayBuffer;
  reliable: boolean;
}
