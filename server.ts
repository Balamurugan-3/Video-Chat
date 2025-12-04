import { createServer } from "node:http";
import next from "next";
import { Server } from "socket.io";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(async () => {
  const httpServer = createServer(handler);

  const io = new Server(httpServer);

  // Connect to MongoDB
  if (process.env.MONGODB_URI) {
    import("./src/lib/db").then(({ default: dbConnect }) => {
      dbConnect()
        .then(() => console.log("✅ MongoDB connected"))
        .catch(err => console.error("❌ MongoDB connection failed:", err));
    });
  }

  // Redis Adapter for Scalability (only if REDIS_URL is provided)
  if (process.env.REDIS_URL) {
    const { createClient } = require("redis");
    const { createAdapter } = require("@socket.io/redis-adapter");

    const pubClient = createClient({ url: process.env.REDIS_URL });
    const subClient = pubClient.duplicate();

    Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log("✅ Redis Adapter connected for scalability");
    }).catch((err) => {
      console.error("❌ Redis connection failed:", err);
    });
  }

  interface User {
    socketId: string;
    peerId: string;
    country: string;
    name: string;
    gender: string;
    age: string;
    userId?: string; // Optional MongoDB user ID
  }

  let queue: User[] = [];

  // Store active chat sessions (roomId -> chatSessionId)
  const activeSessions = new Map<string, string>();

  io.on("connection", (socket) => {
    console.log("Client connected", socket.id);

    socket.on("find_match", async ({ peerId, country, name, gender, age }) => {
      // Validate that all required profile data exists
      if (!peerId) {
        console.error(`❌ User ${socket.id} missing peerId`);
        socket.emit("error", { message: "Connection error: Missing peer ID" });
        return;
      }

      if (!name || !gender || !age) {
        console.warn(`⚠ User ${socket.id} has incomplete profile:`, { name, gender, age });
      }

      console.log(`🔍 User ${socket.id} looking for match:`, {
        peerId,
        name: name || "NO NAME",
        gender: gender || "NO GENDER",
        age: age || "NO AGE",
        country: country || "NO COUNTRY"
      });

      // Remove if already in queue to avoid duplicates
      queue = queue.filter(u => u.socketId !== socket.id);

      // Simple matching: find anyone else
      const match = queue.find(u => u.socketId !== socket.id);

      if (match) {
        // Remove match from queue
        queue = queue.filter(u => u.socketId !== match.socketId);

        const roomId = `${socket.id}-${match.socketId}`;
        socket.join(roomId);
        io.sockets.sockets.get(match.socketId)?.join(roomId);

        // Ensure we're sending complete data
        console.log(`✅ MATCH FOUND! Pairing:`, {
          user1: { socketId: socket.id, name, peerId },
          user2: { socketId: match.socketId, name: match.name, peerId: match.peerId }
        });

        // Create chat session in database
        if (process.env.MONGODB_URI) {
          try {
            const ChatSession = (await import("./src/models/ChatSession")).default;
            const User = (await import("./src/models/User")).default;

            const session = await ChatSession.create({
              user1Id: socket.id,
              user2Id: match.socketId,
              user1Name: name,
              user2Name: match.name,
              messages: []
            });

            activeSessions.set(roomId, session._id.toString());
            console.log("✅ Chat session created:", session._id);

            // Increment total chats for both users if they have accounts
            // Note: This would require passing userId from client, for now we skip
          } catch (error) {
            console.error("❌ Error creating chat session:", error);
          }
        }

        // Notify both with complete profile data
        socket.emit("match_found", {
          remotePeerId: match.peerId,
          remoteName: match.name,
          remoteGender: match.gender,
          remoteAge: match.age,
          initiator: true
        });

        io.to(match.socketId).emit("match_found", {
          remotePeerId: peerId,
          remoteName: name,
          remoteGender: gender,
          remoteAge: age,
          initiator: false
        });

        console.log(`🎉 Successfully matched ${socket.id} (${name}) with ${match.socketId} (${match.name})`);
      } else {
        queue.push({ socketId: socket.id, peerId, country, name, gender, age });
        console.log(`⏳ User ${socket.id} (${name}) added to queue. Queue size: ${queue.length}`);
      }
    });

    socket.on("send_message", async ({ message }) => {
      // Find the room this socket is in (excluding their own ID)
      const rooms = Array.from(socket.rooms);
      const chatRoom = rooms.find(r => r !== socket.id);

      if (chatRoom) {
        socket.to(chatRoom).emit("receive_message", { message });
        console.log(`Message sent in room ${chatRoom}: ${message}`);

        // Save message to database
        if (process.env.MONGODB_URI && activeSessions.has(chatRoom)) {
          try {
            const ChatSession = (await import("./src/models/ChatSession")).default;
            const sessionId = activeSessions.get(chatRoom);

            await ChatSession.updateOne(
              { _id: sessionId },
              {
                $push: {
                  messages: {
                    senderId: socket.id,
                    text: message,
                    timestamp: new Date()
                  }
                }
              }
            );
            console.log("✅ Message saved to database");
          } catch (error) {
            console.error("❌ Error saving message:", error);
          }
        }
      }
    });

    socket.on("end_call", async () => {
      const rooms = Array.from(socket.rooms);
      const chatRoom = rooms.find(r => r !== socket.id);

      if (chatRoom) {
        socket.to(chatRoom).emit("call_ended");
        console.log(`Call ended by ${socket.id} in room ${chatRoom}`);

        // Mark session as ended in database
        if (process.env.MONGODB_URI && activeSessions.has(chatRoom)) {
          try {
            const ChatSession = (await import("./src/models/ChatSession")).default;
            const sessionId = activeSessions.get(chatRoom);

            await ChatSession.updateOne(
              { _id: sessionId },
              { endedAt: new Date() }
            );
            activeSessions.delete(chatRoom);
            console.log("✅ Chat session ended in database");
          } catch (error) {
            console.error("❌ Error ending chat session:", error);
          }
        }

        // Both leave the room
        socket.leave(chatRoom);
        io.sockets.sockets.get(chatRoom.replace(socket.id, "").replace("-", ""))?.leave(chatRoom);
      }
    });

    socket.on("disconnect", () => {
      // Remove from queue if present
      queue = queue.filter(u => u.socketId !== socket.id);

      // Notify anyone in a room with this user
      const rooms = Array.from(socket.rooms);
      const chatRoom = rooms.find(r => r !== socket.id);

      if (chatRoom) {
        socket.to(chatRoom).emit("peer_disconnected");
        console.log(`👋 User ${socket.id} disconnected from room ${chatRoom}`);
      }

      console.log(`❌ Client disconnected: ${socket.id}`);
    });
  });

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
