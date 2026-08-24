import { io as Client, type Socket as ClientSocket } from "socket.io-client";
import request from "supertest";
import { app, httpServer, io } from "../src/index";

const roomId = "123e4567-e89b-12d3-a456-426614174000";
let baseUrl: string;
let client: ClientSocket;

beforeAll((done) => {
  httpServer.listen(0, "127.0.0.1", () => {
    const address = httpServer.address();
    if (!address || typeof address === "string") throw new Error("test server did not expose a TCP port");
    baseUrl = `http://127.0.0.1:${address.port}`;
    client = Client(baseUrl, { transports: ["websocket"] });
    client.on("connect", done);
  });
});

afterAll((done) => {
  client?.close();
  io.close(() => {
    if (httpServer.listening) httpServer.close(() => done());
    else done();
  });
});

describe("Sky Chat gateway", () => {
  it("exposes health/readiness with baseline security headers", async () => {
    const health = await request(app).get("/healthz");
    expect(health.status).toBe(200);
    expect(health.body).toEqual(expect.objectContaining({ status: "healthy", service: "sky-chat-gateway" }));
    expect(health.headers["x-content-type-options"]).toBe("nosniff");
    expect(health.headers["x-frame-options"]).toBe("DENY");
    expect(health.headers["referrer-policy"]).toBe("no-referrer");

    const ready = await request(app).get("/readyz");
    expect(ready.status).toBe(200);
    expect(ready.body.status).toBe("ready");
  });

  it("rejects invalid room identifiers", (done) => {
    client.emit("join_room", "not-a-uuid", (ack: { ok: boolean; error?: string }) => {
      expect(ack.ok).toBe(false);
      expect(ack.error).toContain("UUID");
      done();
    });
  });

  it("requires room membership before sending", (done) => {
    client.emit(
      "send_message",
      { roomId, userId: "user_123", content: "not joined" },
      (ack: { ok: boolean; error?: string }) => {
        expect(ack.ok).toBe(false);
        expect(ack.error).toContain("join");
        done();
      },
    );
  });

  it("validates, server-stamps, and broadcasts joined-room messages", (done) => {
    client.emit("join_room", roomId, (joinAck: { ok: boolean }) => {
      expect(joinAck.ok).toBe(true);
      client.once("new_message", (message: Record<string, unknown>) => {
        expect(message).toEqual(
          expect.objectContaining({
            id: expect.any(String),
            roomId,
            userId: "user_123",
            content: "Hello real-time world",
            timestamp: expect.any(String),
          }),
        );
        done();
      });
      client.emit("send_message", { roomId, userId: "user_123", content: "Hello real-time world" });
    });
  });

  it("rejects malformed message payloads", (done) => {
    client.emit("send_message", { roomId, userId: "", content: "" }, (ack: { ok: boolean }) => {
      expect(ack.ok).toBe(false);
      done();
    });
  });
});
