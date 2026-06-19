import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';

interface Message {
  type: 'join' | 'message' | 'leave';
  username?: string;
  text?: string;
}

const server = http.createServer();
const wss = new WebSocketServer({ server });

const clients = new Map<WebSocket, string>();

wss.on('connection', (ws: WebSocket) => {
  ws.on('message', (raw: Buffer) => {
    let msg: Message;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.type === 'join' && msg.username) {
      clients.set(ws, msg.username);
      broadcast({ type: 'message', username: 'System', text: `${msg.username} joined` }, ws);
    } else if (msg.type === 'message' && msg.text) {
      const username = clients.get(ws) || 'Anonymous';
      broadcast({ type: 'message', username, text: msg.text });
    }
  });

  ws.on('close', () => {
    const username = clients.get(ws);
    clients.delete(ws);
    if (username) {
      broadcast({ type: 'leave', username, text: `${username} left` });
    }
  });
});

function broadcast(msg: Message, exclude?: WebSocket) {
  const data = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client !== exclude && client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

if (require.main === module) {
  server.listen(3001, () => console.log('WebSocket chat server on :3001'));
}

export { server, wss, broadcast, clients };
