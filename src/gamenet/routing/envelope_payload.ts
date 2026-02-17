export function decodeBase64(base64: string): Uint8Array {
  if (typeof atob === "function") {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }

  if (typeof Buffer !== "undefined") {
    return Uint8Array.from(Buffer.from(base64, "base64"));
  }

  throw new Error("Base64 decoding is not available in this runtime");
}

export function decodeRoutingEnvelopePayload(
  data: unknown
): unknown | undefined {
  if (
    !data ||
    typeof data !== "object" ||
    !("payload" in data) ||
    typeof data.payload !== "string"
  ) {
    return undefined;
  }

  try {
    const payloadBytes = decodeBase64(data.payload);
    const payloadText = new TextDecoder().decode(payloadBytes);
    return JSON.parse(payloadText);
  } catch {
    return undefined;
  }
}
