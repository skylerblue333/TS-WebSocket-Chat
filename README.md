# Sky Chat Gateway

**Status: engineering beta.** Sky Chat Gateway is a focused TypeScript/Socket.IO service for room-based real-time messaging. It can run independently or sit behind the SKYCOIN4444 gateway as a transport for SkyChat/live features.

## Implemented behavior

Socket events:

- `join_room(roomId, ack)` — validates a UUID room identifier before joining.
- `leave_room(roomId, ack)` — leaves a validated room and updates tracked occupancy.
- `send_message(payload, ack)` — validates `roomId`, `userId`, and `content`; requires the socket to be a member of the target room; applies a per-socket message-rate limit; and emits a server-generated message ID and timestamp.
- `system_event` — emits `USER_JOINED` / `USER_LEFT` room occupancy updates.
- `validation_error` and `rate_limited` — explicit client error events.

HTTP operations:

- `GET /health` and `GET /healthz` — liveness plus measured connection/room counts.
- `GET /readyz` — readiness for traffic.

Message content is trimmed and limited to 2,000 characters. Socket.IO's HTTP buffer is capped at 64 KB. Room IDs are UUIDs; user IDs are bounded to 64 conservative identifier characters. Clients cannot publish to rooms they have not joined.

## Run locally

Requires Node.js 22+.

```bash
npm ci
npm run build
npm test -- --runInBand
PORT=3000 CORS_ORIGINS=https://app.example.com npm start
```

`CORS_ORIGINS` is a comma-separated browser-origin allowlist. The default is an empty allowlist rather than wildcard browser access.

## Example Socket.IO client

```ts
socket.emit("join_room", roomId, console.log);
socket.emit(
  "send_message",
  { roomId, userId: "user_123", content: "Hello" },
  console.log,
);
socket.on("new_message", console.log);
```

## Verification

GitHub Actions gates changes with:

- frozen `npm ci`
- TypeScript compilation
- real Socket.IO + HTTP integration tests
- high-severity production dependency audit
- Docker build
- non-root image-user verification
- runtime image boot plus `/healthz` smoke test

The previous unrelated raw-WebSocket test and unused Redis CI service were removed because they did not exercise the actual implementation.

## Container

```bash
docker build -t sky-chat .
docker run --rm -p 3000:3000 -e CORS_ORIGINS=https://app.example.com sky-chat
```

The runtime image executes as the unprivileged Node image user.

## Architecture and scaling boundary

Room occupancy and rate-limit state are process-local. This is deliberate for the standalone beta. Horizontal scaling requires a shared Socket.IO adapter/pub-sub layer and distributed rate-limit/occupancy semantics; that integration is **not** currently implemented or claimed.

For SKYCOIN4444 integration, keep the service independently deployable and connect through a stable Socket.IO event contract rather than copying it into the flagship codebase.

## Security and limitations

The gateway has bounded inputs, room-membership enforcement, per-socket abuse control, non-wildcard CORS defaults, baseline HTTP security headers, and non-root container execution. It does **not** implement user authentication, authorization, moderation, durable message history, encryption beyond transport, multi-node coordination, HA, or production deployment.

See `SECURITY.md`.

## License

See `LICENSE`.
