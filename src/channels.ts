import { randomUUID } from "node:crypto";

export type ChannelVisibility = "public" | "unlisted" | "private";
export type ChannelRole = "owner" | "editor" | "viewer";

export interface ChannelSnapshot {
  id: string;
  roomId: string;
  ownerId: string;
  title: string;
  visibility: ChannelVisibility;
  version: number;
  members: Array<{ userId: string; role: ChannelRole }>;
  realtimeTransportConnected: false;
}

const SAFE_ID = /^[A-Za-z0-9_.:@-]{1,64}$/;
const MAX_CHANNELS = 10_000;
const MAX_MEMBERS = 10_000;

function validateId(value: string, field: string): string {
  const normalized = value.trim();
  if (!SAFE_ID.test(normalized)) throw new Error(`invalid_${field}`);
  return normalized;
}

function validateTitle(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 120) throw new Error("invalid_title");
  return normalized;
}

interface StoredChannel {
  id: string;
  roomId: string;
  ownerId: string;
  title: string;
  visibility: ChannelVisibility;
  version: number;
  members: Map<string, ChannelRole>;
}

export class ChannelRegistry {
  private readonly channels = new Map<string, StoredChannel>();

  create(input: { id: string; ownerId: string; title: string; visibility?: ChannelVisibility }): ChannelSnapshot {
    const id = validateId(input.id, "channel_id");
    const ownerId = validateId(input.ownerId, "owner_id");
    const title = validateTitle(input.title);
    const visibility = input.visibility ?? "private";
    if (!(["public", "unlisted", "private"] as string[]).includes(visibility)) throw new Error("invalid_visibility");
    if (this.channels.has(id)) throw new Error("channel_exists");
    if (this.channels.size >= MAX_CHANNELS) throw new Error("capacity_exhausted");

    const stored: StoredChannel = {
      id,
      roomId: randomUUID(),
      ownerId,
      title,
      visibility,
      version: 1,
      members: new Map([[ownerId, "owner"]]),
    };
    this.channels.set(id, stored);
    return this.snapshot(stored);
  }

  get(id: string): ChannelSnapshot | undefined {
    const channel = this.channels.get(validateId(id, "channel_id"));
    return channel ? this.snapshot(channel) : undefined;
  }

  addMember(channelId: string, actorId: string, userId: string, role: Exclude<ChannelRole, "owner">): ChannelSnapshot {
    const channel = this.requireChannel(channelId);
    const actor = validateId(actorId, "actor_id");
    const user = validateId(userId, "user_id");
    if (actor !== channel.ownerId) throw new Error("owner_required");
    if (role !== "editor" && role !== "viewer") throw new Error("invalid_role");
    if (!channel.members.has(user) && channel.members.size >= MAX_MEMBERS) throw new Error("member_capacity_exhausted");
    if (user === channel.ownerId) throw new Error("owner_role_immutable");
    channel.members.set(user, role);
    channel.version += 1;
    return this.snapshot(channel);
  }

  removeMember(channelId: string, actorId: string, userId: string): ChannelSnapshot {
    const channel = this.requireChannel(channelId);
    const actor = validateId(actorId, "actor_id");
    const user = validateId(userId, "user_id");
    if (actor !== channel.ownerId) throw new Error("owner_required");
    if (user === channel.ownerId) throw new Error("owner_role_immutable");
    if (!channel.members.delete(user)) throw new Error("member_not_found");
    channel.version += 1;
    return this.snapshot(channel);
  }

  canView(channelId: string, userId?: string): boolean {
    const channel = this.requireChannel(channelId);
    if (channel.visibility === "public") return true;
    if (!userId) return false;
    const user = validateId(userId, "user_id");
    return channel.members.has(user);
  }

  canPublish(channelId: string, userId: string): boolean {
    const channel = this.requireChannel(channelId);
    const role = channel.members.get(validateId(userId, "user_id"));
    return role === "owner" || role === "editor";
  }

  private requireChannel(id: string): StoredChannel {
    const channel = this.channels.get(validateId(id, "channel_id"));
    if (!channel) throw new Error("channel_not_found");
    return channel;
  }

  private snapshot(channel: StoredChannel): ChannelSnapshot {
    return {
      id: channel.id,
      roomId: channel.roomId,
      ownerId: channel.ownerId,
      title: channel.title,
      visibility: channel.visibility,
      version: channel.version,
      members: [...channel.members.entries()]
        .map(([userId, role]) => ({ userId, role }))
        .sort((a, b) => a.userId.localeCompare(b.userId)),
      realtimeTransportConnected: false,
    };
  }
}
