import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";

let io: SocketIOServer;

export function initializeSocket(httpServer: HTTPServer): SocketIOServer {
    io = new SocketIOServer(httpServer, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
    });

    io.on("connection", (socket) => {
        console.log(`🟢 Cliente conectado: ${socket.id}`);

        socket.on("join", (userId: string) => {
            socket.join(userId);
            console.log(`👤 User ${userId} entrou na sala ${userId}`);
        });

        socket.on("joinAdmin", (adminId: string) => {
            socket.join("admin");
            socket.join(adminId);
            console.log(`👑 Admin ${adminId} entrou nas salas: admin, ${adminId}`);
        });

        socket.on("typing", (data: { clienteId: number; senderType: string; isTyping: boolean }) => {
            const targetRoom = data.senderType === "ADMIN" ? data.clienteId.toString() : "admin";
            socket.to(targetRoom).emit("displayTyping", data);
        });

        socket.on("disconnect", () => {
            console.log(`🔴 Cliente desconectado: ${socket.id}`);
        });
    });

    return io;
}

export function getIO(): SocketIOServer {
    if (!io) {
        throw new Error("Socket.IO not initialized. Call initializeSocket first.");
    }
    return io;
}
