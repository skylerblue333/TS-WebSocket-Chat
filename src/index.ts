import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { z } from 'zod';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' }
});

const MessageSchema = z.object({
  roomId: z.string().uuid(),
  userId: z.string(),
  content: z.string().min(1).max(5000),
  timestamp: z.string().datetime()
});

// In-memory simulation of Redis Pub/Sub
const activeRooms = new Map<string, Set<string>>();

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join_room', (roomId: string) => {
    socket.join(roomId);
    if (!activeRooms.has(roomId)) activeRooms.set(roomId, new Set());
    activeRooms.get(roomId)?.add(socket.id);
    
    // Broadcast system event
    io.to(roomId).emit('system_event', {
      type: 'USER_JOINED',
      usersInRoom: activeRooms.get(roomId)?.size
    });
  });

  socket.on('send_message', (payload: unknown) => {
    try {
      const msg = MessageSchema.parse(payload);
      // In production, this would publish to Redis Streams
      io.to(msg.roomId).emit('new_message', msg);
    } catch (e) {
      socket.emit('error', { message: 'Invalid message payload' });
    }
  });

  socket.on('disconnect', () => {
    activeRooms.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        io.to(roomId).emit('system_event', {
          type: 'USER_LEFT',
          usersInRoom: users.size
        });
      }
    });
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    activeConnections: io.engine.clientsCount,
    activeRooms: activeRooms.size
  });
});

if (require.main === module) {
  httpServer.listen(3000, () => {
    console.log('Real-time WebSocket Gateway running on port 3000');
  });
}

export { app, httpServer, io };
