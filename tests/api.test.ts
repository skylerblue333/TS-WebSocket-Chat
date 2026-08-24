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

function joinRoom(socket: ClientSocket, roomId: string, userId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('join acknowledgement timed out')), 2000);
    const onError = (payload: { code: string; message: string }) => {
      clearTimeout(timer);
      reject(new Error(`${payload.code}: ${payload.message}`));
    };
    socket.once('chat_error', onError);
    socket.once('system_event', (event: { type?: string }) => {
      if (event.type !== 'USER_JOINED') return;
      clearTimeout(timer);
      socket.off('chat_error', onError);
      resolve();
    });
    socket.emit('join_room', { roomId, userId });
  });
}

describe('Sky WebSocket Chat', () => {
  beforeAll((done) => {
    httpServer.listen(0, '127.0.0.1', done);
  });

  afterEach(() => {
    for (const socket of io.sockets.sockets.values()) socket.disconnect(true);
    membersBySocket.clear();
    roomMembers.clear();
  });

  afterAll((done) => {
    io.close(done);
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

    await joinRoom(sender, ROOM_ID, 'alice');
    await joinRoom(receiver, ROOM_ID, 'bob');

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

  it('rejects messages from a socket that has not joined', async () => {
    const socket = await connectClient();
    const error = new Promise<{ code: string }>((resolve) => socket.once('chat_error', resolve));
    socket.emit('send_message', { roomId: ROOM_ID, content: 'unauthorized room message' });
    await expect(error).resolves.toMatchObject({ code: 'NOT_IN_ROOM' });
    socket.close();
  });

  it('prevents a connection from changing its user identity', async () => {
    const socket = await connectClient();
    await joinRoom(socket, ROOM_ID, 'alice');
    const error = new Promise<{ code: string }>((resolve) => socket.once('chat_error', resolve));
    socket.emit('join_room', {
      roomId: '223e4567-e89b-12d3-a456-426614174000',
      userId: 'mallory',
    });
    await expect(error).resolves.toMatchObject({ code: 'IDENTITY_MISMATCH' });
    socket.close();
  });

  it('rejects malformed joins', async () => {
    const socket = await connectClient();
    const error = new Promise<{ code: string }>((resolve) => socket.once('chat_error', resolve));
    socket.emit('join_room', { roomId: 'not-a-uuid', userId: '' });
    await expect(error).resolves.toMatchObject({ code: 'INVALID_JOIN' });
    socket.close();
  });
});
