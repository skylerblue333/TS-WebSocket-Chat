# Ecosystem Integration

**Role:** realtime messaging transport.

**Foundation:** Socket.IO/WebSocket transport. Keep transport concerns separate from ShadowChat domain logic.

**Consumes:** authenticated room/channel events.

**Provides:** connection lifecycle, room membership, and realtime message delivery.

**Production requirements:** authentication, authorization per room, payload validation, rate limiting, connection limits, persistence/event handoff, and telemetry.
