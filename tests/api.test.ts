import type { AddressInfo } from 'net';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';
import request from 'supertest';

import { app, httpServer, io, membersBySocket, roomMembers } from '../src/index';

const ROOM_ID = '123e4567-e89b-12d3-a456-426614174000';

function connectClient(): Promise<ClientSocket> {
  const port = (httpServer.address() as AddressInfo).port;
  return new Promise((resolve, reject) => {
    const socket = Client(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      reconnection: false,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

describe('Sky WebSocket Chat', () => {
  beforeAll((done) => httpServer.listen(0, '127.0.0.1', done));

  afterEach(() => {
    for (const socket of io.sockets.sockets.values()) socket.disconnect(true);
    membersBySocket.clear();
    roomMembers.clear();
  });

  afterAll((done) => {
    io.close(() => httpServer.close(done));
  });

  it('reports health, readiness, and bounded metrics', async () => {
    expect((await request(app).get('/healthz')).body).toEqual({
      status: 'ok',
      service: 'sky-websocket-chat',
    });
    expect((await request(app).get('/readyz')).status).toBe(200);
    expect((await request(app).get('/metrics')).body.activeRooms).toBe(0);
  });

  it('broadcasts server-authored message identity and timestamp', async () => {
    const sender = await connectClient();
    const receiver = await connectClient();

    sender.emit('join_room', { roomId: ROOM_ID, userId: 'alice' });
    receiver.emit('join_room', { roomId: ROOM_ID, userId: 'bob' });

    const received = new Promise<Record<string, unknown>>((resolve) => {
      receiver.once('new_message', resolve);
    });
    sender.emit('send_message', { roomId: ROOM_ID, content: ' hello ' });

    const message = await received;
    expect(message.roomId).toBe(ROOM_ID);
    expect(message.userId).toBe('alice');
    expect(message.content).toBe('hello');
    expect(typeof message.timestamp).toBe('string');

    sender.close();
    receiver.close();
  });
});
