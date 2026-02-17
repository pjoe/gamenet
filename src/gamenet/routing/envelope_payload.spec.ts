import { decodeRoutingEnvelopePayload } from "./envelope_payload";

function encodeBase64FromText(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  return Buffer.from(binary, "binary").toString("base64");
}

describe("decodeRoutingEnvelopePayload", () => {
  it("decodes wrapped pong payload from routing envelope", () => {
    const pongPayload = { time: Date.now() - 42 };
    const envelopeData = {
      from: "client-1",
      to: "host-worker",
      payload: encodeBase64FromText(JSON.stringify(pongPayload)),
    };

    expect(decodeRoutingEnvelopePayload(envelopeData)).toEqual(pongPayload);
  });

  it("returns undefined for invalid routing envelope payload", () => {
    const invalidEnvelopeData = {
      from: "client-1",
      to: "host-worker",
      payload: "not-base64-json",
    };

    expect(decodeRoutingEnvelopePayload(invalidEnvelopeData)).toBeUndefined();
  });
});
