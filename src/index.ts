import express, { type Request, type Response } from "express";
import { createServer } from "node:http";
import { randomUUID } from "node:crypto";
import { Server } from "socket.io";
import { z } from "zod";

const app = express();
const httpServer = createServer(app);

function configuredOrigins(): string[] {
  return (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function originAllowed(origin: string | undefined): boolean {
  if (origin === undefined) return true;
  return configuredOrigins().includes(origin);
}

const io = new Server(httpServer, {
  cors: { origin: configuredOrigins() },
  allowRequest: (request, callback) => callback(null, originAllowed(request.headers.origin)),
  maxHttpBufferSize: 64 * 1024,
  pingTimeout: 20_000,
  pingInterval: 25_000,
});

const RoomIdSchema = z.string().uuid();
const MessageInputSchema = z.object({
  roomId: z.string().uuid(),
  userId: z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_.:@-]+$/),
  content: z.string().trim().min(1).max(2000),
});

type MessageInput = z.infer<typeof MessageInputSchema>;
type Ack = (result: { ok: true } | { ok: false; error: string }) => void;

type RateState = { windowStartedAt: number; messages: number };
const activeRooms = new Map<string, Set<string>>();
const rateBySocket = new Map<string, RateState>();
const rateWindowMs = 10_000;
const maxMessagesPerWindow = 30;

function rateLimited(socketId: string): boolean {
  const now = Date.now();
  const state = rateBySocket.get(socketId);
  if (!state || now-state.windowStartedAt >= rateWindowMs) {
    rateBySocket.set(socketId, { windowStartedAt: now, messages: 1 });
    return false;
  }
  state.messages += 1;
  return state.messages > maxMessagesPerWindow;
}

function leaveAllTrackedRooms(socketId: string): void {
  for (const [roomId, users] of activeRooms) {
    if (!users.delete(socketId)) continue;
    if (users.size === 0) activeRooms.delete(roomId);
    io.to(roomId).emit("system_event", { type: "USER_LEFT", usersInRoom: users.size });
  }
}

io.on("connection", (socket) => {
  console.log(JSON.stringify({ event: "socket_connected", socketId: socket.id }));

  socket.on("join_room", async (rawRoomId: unknown, ack?: Ack) => {
    const parsed = RoomIdSchema.safeParse(rawRoomId);
    if (!parsed.success) {
      ack?.({ ok: false, error: "roomId must be a UUID" });
      socket.emit("validation_error", { event: "join_room", message: "roomId must be a UUID" });
      return;
    }

    const roomId = parsed.data;
    await socket.join(roomId);
    const users = activeRooms.get(roomId) ?? new Set<string>();
    users.add(socket.id);
    activeRooms.set(roomId, users);
    io.to(roomId).emit("system_event", { type: "USER_JOINED", usersInRoom: users.size });
    ack?.({ ok: true });
  });

  socket.on("leave_room", async (rawRoomId: unknown, ack?: Ack) => {
    const parsed = RoomIdSchema.safeParse(rawRoomId);
    if (!parsed.success) {
      ack?.({ ok: false, error: "roomId must be a UUID" });
      return;
    }
    const roomId = parsed.data;
    await socket.leave(roomId);
    const users = activeRooms.get(roomId);
    if (users?.delete(socket.id)) {
      if (users.size === 0) activeRooms.delete(roomId);
      io.to(roomId).emit("system_event", { type: "USER_LEFT", usersInRoom: users.size });
    }
    ack?.({ ok: true });
  });

  socket.on("send_message", (payload: unknown, ack?: Ack) => {
    const parsed = MessageInputSchema.safeParse(payload);
    if (!parsed.success) {
      ack?.({ ok: false, error: "invalid message payload" });
      socket.emit("validation_error", { event: "send_message", message: "invalid message payload" });
      return;
    }

    const msg: MessageInput = parsed.data;
    if (!socket.rooms.has(msg.roomId)) {
      ack?.({ ok: false, error: "join the room before sending messages" });
      socket.emit("validation_error", { event: "send_message", message: "room membership required" });
      return;
    }
    if (rateLimited(socket.id)) {
      ack?.({ ok: false, error: "message rate limit exceeded" });
      socket.emit("rate_limited", { retryAfterMs: rateWindowMs });
      return;
    }

    const outbound = {
      id: randomUUID(),
      roomId: msg.roomId,
      userId: msg.userId,
      content: msg.content,
      timestamp: new Date().toISOString(),
    };
    io.to(msg.roomId).emit("new_message", outbound);
    ack?.({ ok: true });
  });

  socket.on("disconnect", () => {
    leaveAllTrackedRooms(socket.id);
    rateBySocket.delete(socket.id);
    console.log(JSON.stringify({ event: "socket_disconnected", socketId: socket.id }));
  });
});

app.disable("x-powered-by");
app.use((_request: Request, response: Response, next) => {
  response.setHeader("x-content-type-options", "nosniff");
  response.setHeader("x-frame-options", "DENY");
  response.setHeader("referrer-policy", "no-referrer");
  next();
});

function health(_request: Request, response: Response): void {
  response.json({
    status: "healthy",
    service: "sky-chat-gateway",
    activeConnections: io.engine.clientsCount,
    activeRooms: activeRooms.size,
  });
}

app.get("/health", health);
app.get("/healthz", health);
app.get("/readyz", (_request: Request, response: Response) => {
  response.json({ status: "ready", service: "sky-chat-gateway" });
});

if (require.main === module) {
  const configured = Number(process.env.PORT ?? 3000);
  const port = Number.isInteger(configured) && configured >= 1 && configured <= 65535 ? configured : 3000;
  httpServer.listen(port, "0.0.0.0", () => {
    console.log(JSON.stringify({ event: "start", service: "sky-chat-gateway", port }));
  });
}

export { app, httpServer, io, originAllowed };
