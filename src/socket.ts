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

       socket.on("join", (data: { userId: number | string; isAdmin: boolean }) => {  
    const userId = data.userId.toString();  
    socket.join(userId);  
    console.log(`👤 User ${userId} entrou na sala ${userId}`);  
      
    if (data.isAdmin) {  
        socket.join("admin");  
        console.log(`👑 Admin ${userId} também entrou na sala "admin"`);  
    }  
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
