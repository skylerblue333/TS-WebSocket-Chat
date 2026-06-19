import { server, wss } from '../src/index';
import WebSocket from 'ws';

const PORT = 3099;

beforeAll((done) => server.listen(PORT, done));
afterAll((done) => { wss.close(); server.close(done); });

function wsClient(): Promise<WebSocket> {
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${PORT}`);
    ws.on('open', () => resolve(ws));
  });
}

test('broadcasts join message', (done) => {
  wsClient().then((ws1) => {
    wsClient().then((ws2) => {
      ws2.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.text?.includes('Alice')) {
          ws1.close();
          ws2.close();
          done();
        }
      });
      ws1.send(JSON.stringify({ type: 'join', username: 'Alice' }));
    });
  });
}, 5000);
