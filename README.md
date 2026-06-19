# TS-WebSocket-Chat

Real-time WebSocket chat server with broadcast and join/leave events.

## Quick Start

```bash
npm ci && npm test
npm run build && npm start
```

## Connect

```js
const ws = new WebSocket('ws://localhost:3001');
ws.send(JSON.stringify({ type: 'join', username: 'Alice' }));
ws.send(JSON.stringify({ type: 'message', text: 'Hello!' }));
```
