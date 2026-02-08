"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const auth_1 = require("@/middlewares/auth");
// Controllers de Usuário
const CreateUserController_1 = require("@/controllers/User/CreateUserController");
const LoginController_1 = require("@/controllers/User/LoginController");
// Controllers de Autenticação (Esqueci a Senha)
const ForgotPasswordController_1 = require("@/controllers/auth/ForgotPasswordController");
const ResetPasswordController_1 = require("@/controllers/auth/ResetPasswordController");
// Outros Controllers
const ListClientesController_1 = require("@/controllers/Cliente/ListClientesController");
const DeleteClienteController_1 = require("@/controllers/Cliente/DeleteClienteController");
const ListMessagesController_1 = require("@/controllers/Message/ListMessagesController");
const CreateMessageController_1 = require("@/controllers/Message/CreateMessageController");
const DeleteMessageController_1 = require("@/controllers/Message/DeleteMessageController");
const MarkAsReadController_1 = require("@/controllers/Message/MarkAsReadController");
const UnreadCountController_1 = require("@/controllers/Message/UnreadCountController");
const BroadcastMessageController_1 = require("@/controllers/Message/BroadcastMessageController");
const router = (0, express_1.Router)();
exports.router = router;
// --- CONFIGURAÇÃO DO MULTER PARA UPLOAD ---
const storage = multer_1.default.diskStorage({
    destination: "uploads/",
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path_1.default.extname(file.originalname));
    }
});
const upload = (0, multer_1.default)({ storage });
// --- ROTAS DE USUÁRIO E AUTENTICAÇÃO ---
router.post("/users", CreateUserController_1.CreateUserController);
router.post("/login", LoginController_1.LoginController);
// Novas rotas de recuperação de senha
router.post("/forgot-password", ForgotPasswordController_1.ForgotPasswordController); // Passo 1: Solicita o e-mail
router.post("/reset-password", ResetPasswordController_1.ResetPasswordController); // Passo 2: Troca a senha com o token
// --- ROTAS DE CLIENTE (ADMIN) ---
router.get("/clientes", auth_1.AuthMiddleware, ListClientesController_1.ListClientesController);
router.delete("/clientes/:id", auth_1.AuthMiddleware, DeleteClienteController_1.DeleteClienteController);
// --- ROTAS DE MENSAGEM ---
router.get("/messages/me", auth_1.AuthMiddleware, ListMessagesController_1.ListMyMessagesController);
router.get("/messages/unread/count", auth_1.AuthMiddleware, UnreadCountController_1.UnreadCountController);
router.get("/messages/:clienteId", auth_1.AuthMiddleware, ListMessagesController_1.ListMessagesController);
router.post("/messages", auth_1.AuthMiddleware, CreateMessageController_1.CreateMessageController);
router.post("/messages/broadcast", auth_1.AuthMiddleware, BroadcastMessageController_1.BroadcastMessageController);
router.delete("/messages/:id", auth_1.AuthMiddleware, DeleteMessageController_1.DeleteMessageController);
router.patch("/messages/mark-read", auth_1.AuthMiddleware, MarkAsReadController_1.MarkAsReadController);
// --- ROTA DE UPLOAD DE IMAGEM ---
router.post("/messages/upload", auth_1.AuthMiddleware, upload.single("image"), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "Nenhum arquivo enviado." });
    }
    const baseUrl = process.env.BASE_URL || "http://localhost:8000";
    const imageUrl = `${baseUrl}/uploads/${req.file.filename}`;
    return res.json({ url: imageUrl });
});
