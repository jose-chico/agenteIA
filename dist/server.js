"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
require("module-alias/register");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const router_1 = require("./routes/router");
const mailer_1 = require("./controllers/services/mailer/mailer");
const fs_1 = __importDefault(require("fs"));
dotenv_1.default.config();
const PORT = process.env.PORT || 8000;
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: {
        origin: ["http://127.0.0.1:5500", "http://localhost:5500", "http://127.0.0.1:5655", "http://localhost:5655", "http://localhost:8000"],
        methods: ["GET", "POST"]
    }
});
exports.io = io;
const uploadsPath = path_1.default.join(process.cwd(), "uploads");
if (!fs_1.default.existsSync(uploadsPath))
    fs_1.default.mkdirSync(uploadsPath);
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "10mb" }));
app.use("/uploads", express_1.default.static(uploadsPath));
app.use(router_1.router);
// CHAMADA DO SMTP
(async () => {
    try {
        await (0, mailer_1.verifySMTP)();
        console.log("📧 SMTP verificado com sucesso.");
    }
    catch (err) {
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
            }
            else {
                console.log(`👤 Cliente ${data.userId} entrou na sua sala.`);
            }
        }
        else if (data) {
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
