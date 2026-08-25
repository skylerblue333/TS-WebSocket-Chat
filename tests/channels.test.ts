import { ChannelRegistry } from "../src/channels";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("SkyChannels domain core", () => {
  it("creates a private channel with immutable owner membership", () => {
    const registry = new ChannelRegistry();
    const channel = registry.create({ id: "creator.one", ownerId: "user.owner", title: "Creator One" });
    expect(channel.visibility).toBe("private");
    expect(channel.members).toEqual([{ userId: "user.owner", role: "owner" }]);
    expect(channel.realtimeTransportConnected).toBe(false);
    expect(UUID_V4.test(channel.roomId)).toBe(true);
    expect(() => registry.removeMember("creator.one", "user.owner", "user.owner")).toThrow("owner_role_immutable");
  });

  it("allows only owners to manage editor/viewer membership", () => {
    const registry = new ChannelRegistry();
    registry.create({ id: "channel.alpha", ownerId: "owner.1", title: "Alpha", visibility: "unlisted" });
    registry.addMember("channel.alpha", "owner.1", "editor.1", "editor");
    registry.addMember("channel.alpha", "owner.1", "viewer.1", "viewer");

    expect(registry.canView("channel.alpha", "viewer.1")).toBe(true);
    expect(registry.canPublish("channel.alpha", "editor.1")).toBe(true);
    expect(registry.canPublish("channel.alpha", "viewer.1")).toBe(false);
    expect(() => registry.addMember("channel.alpha", "editor.1", "viewer.2", "viewer")).toThrow("owner_required");
  });

  it("keeps public read access separate from publish authority", () => {
    const registry = new ChannelRegistry();
    registry.create({ id: "public.channel", ownerId: "owner.2", title: "Public", visibility: "public" });
    expect(registry.canView("public.channel")).toBe(true);
    expect(registry.canPublish("public.channel", "random.user")).toBe(false);
  });

  it("returns detached membership snapshots", () => {
    const registry = new ChannelRegistry();
    const first = registry.create({ id: "safe.channel", ownerId: "owner.3", title: "Safe" });
    first.members[0].role = "viewer";
    expect(registry.get("safe.channel")?.members[0].role).toBe("owner");
  });
});
