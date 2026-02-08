"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("module-alias/register");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = require("http");
const router_1 = require("./routes/router");
const mailer_1 = require("./controllers/services/mailer/mailer");
const socket_1 = require("./socket");
const fs_1 = __importDefault(require("fs"));
dotenv_1.default.config();
const PORT = process.env.PORT || 8000;
const app = (0, express_1.default)();
const httpServer = (0, http_1.createServer)(app);
const uploadsPath = path_1.default.join(process.cwd(), "uploads");
if (!fs_1.default.existsSync(uploadsPath))
    fs_1.default.mkdirSync(uploadsPath);
const publicPath = path_1.default.join(process.cwd(), "public");
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: "10mb" }));
app.use("/uploads", express_1.default.static(uploadsPath));
app.use(express_1.default.static(publicPath));
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
// Inicializa o Socket.IO
const io = (0, socket_1.initializeSocket)(httpServer);
httpServer.listen(PORT, () => {
    console.log(`🚀 SERVIDOR RODANDO NA PORTA: ${PORT}`);
});
