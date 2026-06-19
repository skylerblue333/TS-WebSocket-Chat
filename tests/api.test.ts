import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import { app, io } from '../src/index';
import request from 'supertest';

describe('WebSocket Real-Time Gateway', () => {
  let ioServer: Server, clientSocket: ClientSocket;
  let httpServer: ReturnType<typeof createServer>;

  beforeAll((done) => {
    httpServer = createServer(app);
    ioServer = new Server(httpServer);
    httpServer.listen(() => {
      const port = (httpServer.address() as any).port;
      clientSocket = Client(`http://localhost:${port}`);
      clientSocket.on('connect', done);
    });
  });

  afterAll(() => {
    ioServer.close();
    clientSocket.close();
    httpServer.close();
  });

  it('REST /health returns connection metrics', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });

  it('Validates and broadcasts messages via Zod schema', (done) => {
    const validMsg = {
      roomId: '123e4567-e89b-12d3-a456-426614174000',
      userId: 'user_123',
      content: 'Hello real-time world',
      timestamp: new Date().toISOString()
    };

    clientSocket.emit('join_room', validMsg.roomId);
    
    clientSocket.on('new_message', (msg) => {
      expect(msg.content).toBe(validMsg.content);
      done();
    });

    setTimeout(() => {
      clientSocket.emit('send_message', validMsg);
    }, 50);
  });
});
