import {
  createClientChannelId,
  createHostChannelId,
  validateHostChannelId,
} from "./channel";

describe("channel id generation", () => {
  it("creates client id with expected length", () => {
    const id = createClientChannelId();
    expect(id).toHaveLength(21);
  });

  it("creates host id with 7-digit numeric format", async () => {
    const id = await createHostChannelId();
    expect(id).toMatch(/^\d{7}$/);
    await expect(validateHostChannelId(id)).resolves.toBe(true);
  });
});

describe("host channel id validation", () => {
  it.each(["0000060", "8388582"])("accepts known valid ID %s", async (id) => {
    await expect(validateHostChannelId(id)).resolves.toBe(true);
  });

  it.each(["0000061", "8388583"])(
    "rejects an incorrect hash in %s",
    async (id) => {
      await expect(validateHostChannelId(id)).resolves.toBe(false);
    }
  );

  it.each([
    "",
    "60",
    "000060",
    "00000060",
    "abcdefg",
    "000006a",
    " 0000060",
    "0000060 ",
    "0000060\n",
    "-000060",
    "+000060",
    "00006.0",
    "8388608",
    "9999999",
  ])("rejects malformed or out-of-range ID %j", async (id) => {
    await expect(validateHostChannelId(id)).resolves.toBe(false);
  });
});
