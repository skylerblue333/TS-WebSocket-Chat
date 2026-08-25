# SkyChannels — Wave 2 Slot #108 / Lane 12

**Status:** engineering beta / creator-channel domain core.

SkyChannels adds a bounded creator-channel registry to the existing Sky Chat Gateway repository. It manages channel identity, ownership, visibility, editor/viewer membership, and publish/view authorization decisions without pretending the existing Socket.IO transport is already wired to those channel records.

## Domain contract

A channel has:
- a caller-supplied bounded channel ID;
- a generated UUID room ID suitable for the existing chat transport;
- one immutable owner;
- `public`, `unlisted`, or `private` visibility;
- bounded editor/viewer membership;
- a monotonic version;
- `realtimeTransportConnected: false` until an explicit integration is implemented.

Only the owner can add/remove editor and viewer membership. Public visibility grants read access only; it never grants publish authority. Editors and owners can publish according to the domain decision helper.

## SKYCOIN4444 integration

Recommended composition:

`SkyIdentity / SkyAuth -> SkyChannels membership -> SkyPolicy/SkyPermissions decision -> Sky Chat Gateway room transport`

The generated `roomId` is intentionally compatible with the existing UUID room contract in `src/index.ts`. This product does not automatically join users to Socket.IO rooms and does not claim channel membership is currently enforced by the transport layer.

## Security boundaries

The registry is process-local and in-memory. It does not provide durable channel persistence, distributed membership propagation, authentication, moderation, media storage, subscription billing, creator payouts, tenant isolation, or production deployment evidence. Callers must authenticate identities and enforce returned access decisions at the transport/API boundary.
