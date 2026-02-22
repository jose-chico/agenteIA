import "module-alias/register";
import express from "express";
import cors from "cors";
import path from "path";
import dotenv from "dotenv";
import { createServer } from "http"; 
import { router } from "./routes/router"; 
import { verifySMTP } from "./controllers/services/mailer/mailer";
import { initializeSocket } from "./socket";
import fs from "fs";

dotenv.config();

const PORT = process.env.PORT || 8000;
const app = express();
const httpServer = createServer(app); 

const uploadsPath = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath);

const publicPath = path.join(process.cwd(), "public");

app.set("trust proxy", 1); // Confia no proxy reverso (Render/Heroku/etc)
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
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

// Inicializa o Socket.IO
const io = initializeSocket(httpServer);

httpServer.listen(PORT, () => {
    console.log(`🚀 SERVIDOR RODANDO NA PORTA: ${PORT}`);
});
