import { createClientChannelId, createHostChannelId } from "./channel";

describe("channel id generation", () => {
  it("creates client id with expected length", () => {
    const id = createClientChannelId();
    expect(id).toHaveLength(21);
  });

  it("creates host id with 7-digit numeric format", async () => {
    const id = await createHostChannelId();
    expect(id).toMatch(/^\d{7}$/);
  });
});
