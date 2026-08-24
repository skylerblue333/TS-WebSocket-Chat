import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { z } from 'zod';

const PORT = Number.parseInt(process.env.PORT ?? '3000', 10);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const app = express();
const httpServer = createServer(app);
const allowedOrigins = (process.env.CORS_ORIGINS ?? '')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const io = new Server(httpServer, {
  cors: allowedOrigins.length > 0 ? { origin: allowedOrigins, methods: ['GET', 'POST'] } : undefined,
  maxHttpBufferSize: 16 * 1024,
  pingTimeout: 20_000,
  pingInterval: 25_000,
});

const RoomId = z.string().uuid();
const UserId = z.string().trim().min(1).max(128).regex(/^[A-Za-z0-9._:-]+$/);
const JoinSchema = z.object({ roomId: RoomId, userId: UserId }).strict();
const MessageSchema = z
  .object({ roomId: RoomId, content: z.string().trim().min(1).max(2000) })
  .strict();

interface Membership {
  userId: string;
  rooms: Set<string>;
}

const membersBySocket = new Map<string, Membership>();
const roomMembers = new Map<string, Map<string, string>>();

function emitError(socket: Socket, code: string, message: string): void {
  socket.emit('chat_error', { code, message });
}

function leaveRoom(socket: Socket, roomId: string): void {
  const membership = membersBySocket.get(socket.id);
  const users = roomMembers.get(roomId);
  if (!membership || !users || !membership.rooms.has(roomId)) return;

  membership.rooms.delete(roomId);
  users.delete(socket.id);
  socket.leave(roomId);
  if (users.size === 0) roomMembers.delete(roomId);
  io.to(roomId).emit('system_event', { type: 'USER_LEFT', usersInRoom: users.size });
}

io.on('connection', (socket) => {
  socket.on('join_room', (payload: unknown) => {
    const parsed = JoinSchema.safeParse(payload);
    if (!parsed.success) {
      emitError(socket, 'INVALID_JOIN', 'roomId and userId are invalid');
      return;
    }

    const existing = membersBySocket.get(socket.id);
    if (existing && existing.userId !== parsed.data.userId) {
      emitError(socket, 'IDENTITY_MISMATCH', 'a connection cannot change userId');
      return;
    }

    const membership = existing ?? { userId: parsed.data.userId, rooms: new Set<string>() };
    membersBySocket.set(socket.id, membership);
    if (membership.rooms.has(parsed.data.roomId)) return;

    membership.rooms.add(parsed.data.roomId);
    const users = roomMembers.get(parsed.data.roomId) ?? new Map<string, string>();
    users.set(socket.id, membership.userId);
    roomMembers.set(parsed.data.roomId, users);
    socket.join(parsed.data.roomId);
    io.to(parsed.data.roomId).emit('system_event', {
      type: 'USER_JOINED',
      usersInRoom: users.size,
    });
  });

  socket.on('leave_room', (roomId: unknown) => {
    const parsed = RoomId.safeParse(roomId);
    if (!parsed.success) {
      emitError(socket, 'INVALID_ROOM', 'roomId must be a UUID');
      return;
    }
    leaveRoom(socket, parsed.data);
  });

  socket.on('send_message', (payload: unknown) => {
    const parsed = MessageSchema.safeParse(payload);
    if (!parsed.success) {
      emitError(socket, 'INVALID_MESSAGE', 'message payload is invalid');
      return;
    }

    const membership = membersBySocket.get(socket.id);
    if (!membership?.rooms.has(parsed.data.roomId)) {
      emitError(socket, 'NOT_IN_ROOM', 'join the room before sending messages');
      return;
    }

    io.to(parsed.data.roomId).emit('new_message', {
      roomId: parsed.data.roomId,
      userId: membership.userId,
      content: parsed.data.content,
      timestamp: new Date().toISOString(),
    });
  });

  socket.on('disconnect', () => {
    const membership = membersBySocket.get(socket.id);
    if (!membership) return;
    for (const roomId of [...membership.rooms]) leaveRoom(socket, roomId);
    membersBySocket.delete(socket.id);
  });
});

app.disable('x-powered-by');
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', service: 'sky-websocket-chat' });
});
app.get('/readyz', (_req, res) => {
  res.json({ status: 'ready', activeConnections: io.engine.clientsCount });
});
app.get('/metrics', (_req, res) => {
  res.json({
    service: 'sky-websocket-chat',
    activeConnections: io.engine.clientsCount,
    activeRooms: roomMembers.size,
    memberships: membersBySocket.size,
  });
});

if (require.main === module) {
  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(JSON.stringify({ event: 'server_started', service: 'sky-websocket-chat', port: PORT }));
  });
}

export { app, httpServer, io, membersBySocket, roomMembers };
