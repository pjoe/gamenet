import {
  decode as decodeMsgpack,
  encode as encodeMsgpack,
} from "@msgpack/msgpack";

export interface PayloadSerde {
  encode: (value: unknown) => ArrayBuffer;
  decode: <T = unknown>(buffer: ArrayBuffer) => T | undefined;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

function toArrayBuffer(data: Uint8Array): ArrayBuffer {
  return data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer;
}

export function createJsonPayloadSerde(): PayloadSerde {
  return {
    encode(value: unknown): ArrayBuffer {
      const bytes = textEncoder.encode(JSON.stringify(value));
      return toArrayBuffer(bytes);
    },
    decode<T = unknown>(buffer: ArrayBuffer): T | undefined {
      try {
        return JSON.parse(textDecoder.decode(new Uint8Array(buffer))) as T;
      } catch {
        return undefined;
      }
    },
  };
}

export function createMsgpackPayloadSerde(): PayloadSerde {
  return {
    encode(value: unknown): ArrayBuffer {
      return toArrayBuffer(encodeMsgpack(value));
    },
    decode<T = unknown>(buffer: ArrayBuffer): T | undefined {
      try {
        return decodeMsgpack(new Uint8Array(buffer)) as T;
      } catch {
        return undefined;
      }
    },
  };
}

export const defaultPayloadSerde = createMsgpackPayloadSerde();
