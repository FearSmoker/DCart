import { NextApiRequest, NextApiResponse } from "next";
import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { Socket as NetSocket } from "net";
import Redis from "ioredis";
import { initKafkaConsumers } from "@/lib/kafka";

interface SocketWithIO extends NetSocket {
  server: HTTPServer & {
    io?: SocketIOServer;
  };
}

interface ResponseWithSocket extends NextApiResponse {
  socket: SocketWithIO;
}

export const config = {
  api: {
    bodyParser: false,
  },
};

const redisUrl = process.env.REDIS_URL || "redis://127.0.0.1:6379";

export default function handler(req: NextApiRequest, res: ResponseWithSocket) {
  if (!res.socket.server.io) {

    // Start Kafka consumers
    initKafkaConsumers().catch((err) => {
      console.error("Failed to initialize Kafka consumers:", err);
    });

    const io = new SocketIOServer(res.socket.server as unknown as HTTPServer, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: {
        origin: "*",
      },
    });
    res.socket.server.io = io;

    // Create Redis Pub/Sub client in subscriber mode
    const sub = new Redis(redisUrl, {
      lazyConnect: true,
    });
    sub.on("error", (err) => {
      // Silence expected connection / client limit errors
      if (!String(err).includes("ERR max number of clients") && !String(err).includes("ECONNRESET")) {
        console.error("[Socket Redis Sub] Connection error:", err.message);
      }
    });

    // Subscribe to ALL relevant channels:
    // - dcart:events: typed realtime events from publishRealtime() (payout, order, inventory, etc.)
    // - inventory: legacy inventory updates
    // - notifications: legacy user notifications
    sub.subscribe("dcart:events", "inventory", "notifications", (err) => {
      if (err) {
        console.error("Failed to subscribe to Redis channels:", err);
      }
    });

    sub.on("message", (channel, message) => {
      try {
        const data = JSON.parse(message);

        if (channel === "dcart:events") {
          // Forward typed events directly — clients listen by event type name
          // e.g. socket.on("order:delivered", handler) or socket.on("payout:approved", handler)
          const { type, data: eventData } = data as { type: string; data: unknown };
          if (type) {
            io.emit(type, eventData);
          }
        } else if (channel === "inventory") {
          io.emit("inventory_update", data);
        } else if (channel === "notifications") {
          io.emit("new_notification", data);
        }
      } catch (err) {
        console.error("Error parsing Pub/Sub message:", err);
      }
    });

    io.on("connection", (socket) => {
      socket.on("disconnect", () => { /* client disconnected */ });
    });
  }

  res.end();
}