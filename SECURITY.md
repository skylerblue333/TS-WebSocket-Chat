# Security Policy

## Status

Sky WebSocket Chat is an **engineering beta**. CI verifies the current implementation and container, but production infrastructure and external security review are not established by this repository.

## Implemented controls

- Room identifiers must be UUIDs.
- User identifiers are length- and character-bounded.
- Message content is trimmed and capped at 2,000 characters.
- Socket.IO transport payloads are capped at 16 KiB.
- A connection cannot change its user identity after its first valid room join.
- A socket cannot publish to a room until it has joined that room.
- Sender identity and timestamps are authored by the server.
- Cross-origin browser access is disabled by default unless explicit origins are supplied through `CORS_ORIGINS`.
- The container runs as a non-root user.
- CI audits runtime dependencies.

## Boundaries

This service does not currently authenticate a claimed `userId`; it only keeps the identity consistent after the first valid join. Deployers must bind authenticated identity to the socket before treating user IDs as authoritative.

The repository does not provide tenant authorization, moderation, abuse-rate limiting, durable history, encrypted persistence, distributed presence, multi-node fan-out, E2E encryption, or TLS termination. Those controls must be supplied by verified integrations and infrastructure.

## Reporting

Use GitHub private vulnerability reporting when available. Do not disclose credentials, private conversations, access tokens, personal data, or working exploit details in public issues.
