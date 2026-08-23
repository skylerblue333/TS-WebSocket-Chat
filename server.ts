import { Server } from "socket.io";
import { createServer } from "node:http";

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: process.env.CORS_ORIGIN ?? "*" } });

io.on("connection", socket => {
  socket.on("join", room => socket.join(String(room)));
  socket.on("message", ({ room, text }) => io.to(String(room)).emit("message", { id: socket.id, text, at: Date.now() }));
});

httpServer.listen(Number(process.env.PORT ?? 3000));
