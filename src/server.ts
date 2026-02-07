import "module-alias/register";
import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { createServer } from "http"; 
import { Server } from "socket.io"; 
import { router } from "./routes/router"; 
import { verifySMTP } from "./controllers/services/mailer/mailer";
import fs from "fs";

dotenv.config();

const PORT = process.env.PORT || 8000;
const app = express();
const httpServer = createServer(app); 

const io = new Server(httpServer, {
    cors: {
        origin: ["http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:5655", "http://localhost:5655", "http://localhost:8000"],
        methods: ["GET", "POST"]
    }
});

const uploadsPath = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath);

const publicPath = path.join(process.cwd(), "public");

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(uploadsPath));
app.use(express.static(publicPath));
app.use(router);

// CHAMADA DO SMTP
(async () => {
    try {
        await verifySMTP();
        console.log("📧 SMTP verificado com sucesso.");
    } catch (err) {
        console.error("⚠️ Erro ao verificar SMTP.");
    }
})();

// --- LÓGICA DE SOCKET ---
io.on("connection", (socket) => {
    
    socket.on("join", (data) => {
        if (typeof data === "object" && data.userId) {
            // Cliente/Admin especifica seu ID
            socket.join(data.userId.toString());
            
            // Se for admin, também entra na sala "admin"
            if (data.isAdmin) {
                socket.join("admin");
                console.log(`👨‍💼 Admin ${data.userId} entrou na sala admin.`);
            } else {
                console.log(`👤 Cliente ${data.userId} entrou na sua sala.`);
            }
        } else if (data) {
            // Fallback para compatibilidade (assume que é um ID de cliente)
            socket.join(data.toString());
            console.log(`👤 Usuário ${data} entrou na sala.`);
        }
    });

    // Evento de Digitando (Typing)
    socket.on("typing", (data) => {
        // Envia para a sala específica do cliente
        if (data.clienteId) {
            socket.to(data.clienteId.toString()).emit("displayTyping", data);
            // Também envia para admins se for cliente digitando
            if (data.senderType === "CLIENTE") {
                socket.to("admin").emit("displayTyping", data);
            }
        }
    });

    // Evento de deletar mensagem
    socket.on("deleteMessage", (data) => {
        if (data.clienteId) {
            // Envia para o cliente específico
            socket.to(data.clienteId.toString()).emit("messageDeleted", { id: data.id });
            // Também envia para admins
            socket.to("admin").emit("messageDeleted", { id: data.id });
        }
    });

    socket.on("disconnect", () => {
        console.log("🔌 Um usuário se desconectou.");
    });
});

httpServer.listen(PORT, () => {
    console.log(`🚀 SERVIDOR RODANDO NA PORTA: ${PORT}`);
});

export { io };