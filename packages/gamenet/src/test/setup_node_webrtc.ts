import { jest } from "@jest/globals";
import nodeDataChannel from "node-datachannel";
import nodeDataChannelPolyfill from "node-datachannel/polyfill";

const globalTarget = globalThis as Record<string, unknown>;
const shouldKeepLogs = process.env.GAMENET_TEST_VERBOSE_LOGS === "1";
let logSpy: ReturnType<typeof jest.spyOn> | undefined;

const polyfillEntries = Object.entries(
  nodeDataChannelPolyfill as unknown as Record<string, unknown>
);
for (const [key, value] of polyfillEntries) {
  if (!(key in globalTarget)) {
    globalTarget[key] = value;
  }
}

if (typeof globalTarget.atob !== "function") {
  globalTarget.atob = (data: string) =>
    Buffer.from(data, "base64").toString("binary");
}

if (typeof globalTarget.btoa !== "function") {
  globalTarget.btoa = (data: string) =>
    Buffer.from(data, "binary").toString("base64");
}

if (!shouldKeepLogs) {
  beforeAll(() => {
    logSpy = jest.spyOn(console, "log").mockImplementation(() => undefined);
  });
}

afterAll(async () => {
  logSpy?.mockRestore();
  try {
    nodeDataChannel.cleanup();
  } catch {
    return;
  }

  await new Promise((resolve) => setTimeout(resolve, 300));
});
