# Changelog

## 3.1.0 - 2026-08-24

- Added UUID validation for room membership operations.
- Required room membership before message broadcast.
- Added bounded user/message validation, server-generated message IDs/timestamps, per-socket rate limiting, room cleanup, and explicit client error events.
- Replaced wildcard browser CORS with an explicit allowlist configuration.
- Added health/readiness aliases and baseline HTTP security headers.
- Replaced obsolete raw-WebSocket tests with real Socket.IO integration coverage.
- Removed the unused Redis CI service and added build, dependency audit, container, non-root, and runtime smoke gates.
- Hardened the runtime container on Node 22 with production-only dependencies.
