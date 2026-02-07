import { Router } from "express";
import multer from "multer";
import path from "path";
import { AuthMiddleware } from "@/middlewares/auth";

// Controllers de Usuário
import { CreateUserController } from "@/controllers/User/CreateUserController";
import { LoginController } from "@/controllers/User/LoginController";

// Controllers de Autenticação (Esqueci a Senha)

import { ForgotPasswordController } from "@/controllers/auth/ForgotPasswordController";
import { ResetPasswordController } from "@/controllers/auth/ResetPasswordController";

// Outros Controllers
import { ListClientesController } from "@/controllers/Cliente/ListClientesController";
import { DeleteClienteController } from "@/controllers/Cliente/DeleteClienteController";
import { ListMessagesController, ListMyMessagesController } from "@/controllers/Message/ListMessagesController";
import { CreateMessageController } from "@/controllers/Message/CreateMessageController";
import { DeleteMessageController } from "@/controllers/Message/DeleteMessageController";
import { MarkAsReadController } from "@/controllers/Message/MarkAsReadController";
import { UnreadCountController } from "@/controllers/Message/UnreadCountController";

const router = Router();

// --- CONFIGURAÇÃO DO MULTER PARA UPLOAD ---
const storage = multer.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// --- ROTAS DE USUÁRIO E AUTENTICAÇÃO ---
router.post("/users", CreateUserController);
router.post("/login", LoginController);

// Novas rotas de recuperação de senha
router.post("/forgot-password", ForgotPasswordController); // Passo 1: Solicita o e-mail
router.post("/reset-password", ResetPasswordController);   // Passo 2: Troca a senha com o token

// --- ROTAS DE CLIENTE (ADMIN) ---
router.get("/clientes", AuthMiddleware, ListClientesController);
router.delete("/clientes/:id", AuthMiddleware, DeleteClienteController);

// --- ROTAS DE MENSAGEM ---
router.get("/messages/me", AuthMiddleware, ListMyMessagesController);
router.get("/messages/unread/count", AuthMiddleware, UnreadCountController);
router.get("/messages/:clienteId", AuthMiddleware, ListMessagesController);
router.post("/messages", AuthMiddleware, CreateMessageController);
router.delete("/messages/:id", AuthMiddleware, DeleteMessageController);
router.patch("/messages/mark-read", AuthMiddleware, MarkAsReadController);

// --- ROTA DE UPLOAD DE IMAGEM ---
router.post("/messages/upload", AuthMiddleware, upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }
    const imageUrl = `http://localhost:8000/uploads/${req.file.filename}`;
    return res.json({ url: imageUrl });
});

export { router };