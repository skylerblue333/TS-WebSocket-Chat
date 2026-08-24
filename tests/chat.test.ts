import type { AddressInfo } from 'net';
import { io as Client, Socket as ClientSocket } from 'socket.io-client';

import { httpServer, io, membersBySocket, roomMembers } from '../src/index';

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

describe('chat policy', () => {
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

  it('rejects messages from a socket that has not joined', async () => {
    const socket = await connectClient();
    const error = new Promise<{ code: string }>((resolve) => socket.once('chat_error', resolve));
    socket.emit('send_message', { roomId: ROOM_ID, content: 'unauthorized room message' });
    await expect(error).resolves.toMatchObject({ code: 'NOT_IN_ROOM' });
    socket.close();
  });

  it('prevents a connection from changing its user identity', async () => {
    const socket = await connectClient();
    socket.emit('join_room', { roomId: ROOM_ID, userId: 'alice' });
    const error = new Promise<{ code: string }>((resolve) => socket.once('chat_error', resolve));
    socket.emit('join_room', { roomId: '223e4567-e89b-12d3-a456-426614174000', userId: 'mallory' });
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
