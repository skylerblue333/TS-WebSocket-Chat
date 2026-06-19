# TS-WebSocket-Chat

![CI](https://github.com/skylerblue333/TS-WebSocket-Chat/workflows/CI/badge.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-3178c6.svg)
![Node.js](https://img.shields.io/badge/Node.js-18.x-339933.svg)
![Redis](https://img.shields.io/badge/Redis-Streams-DC382D.svg)

A production-ready real-time messaging gateway built with Socket.io, Express, and strict Zod runtime schema validation.

## System Architecture


```mermaid
graph TD
    Client[Web/Mobile Client] -->|WebSocket/WSS| Gateway[Node.js Gateway]
    Client -->|GraphQL| Gateway
    Gateway -->|Redis Pub/Sub| Cache[(Redis Streams)]
    Gateway -->|Prisma| DB[(PostgreSQL)]
    Cache --> Worker[Background Processor]
```


## Elite Features
- **Real-Time Pub/Sub**: Room-based broadcasting ready for Redis adapter scaling.
- **Runtime Validation**: Strict Zod schemas for all incoming WebSocket payloads.
- **Hybrid Architecture**: Co-located REST API and WebSocket server.

## Quick Start
```bash
docker-compose up -d redis
npm ci
npm test
npm run build && npm start
```
