# Security Policy

## Supported status

Sky Chat Gateway is an engineering-beta service. Security fixes target the current `main` line after verification.

## Reporting

Report suspected vulnerabilities privately to the repository owner rather than publishing exploit details in a public issue.

## Current controls

The service validates room and message inputs, requires room membership before broadcast, caps Socket.IO message buffers, applies a basic per-socket message-rate limit, defaults browser CORS to an empty allowlist, sets baseline HTTP security headers, audits production dependencies in CI, and runs as a non-root container user.

## Explicit boundaries

There is currently no identity authentication, room authorization policy, moderation system, durable message storage, end-to-end encryption, shared distributed rate limit, shared pub/sub adapter, HA, or verified production deployment. A production integration must supply those controls at the appropriate identity, gateway, moderation, persistence, and infrastructure layers.
