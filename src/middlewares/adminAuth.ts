import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

interface AdminTokenPayload {
    userId: number;
    email: string;
    role: string;
    iat: number;
    exp: number;
}

export const AdminMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "Token não fornecido." });
    }

    const [, token] = authHeader.split(" ");

    try {
        const secret = process.env.JWT_SECRET || "sua_chave_secreta_aqui";

        const decoded = jwt.verify(token, secret) as AdminTokenPayload;

        // Verifica se é ADMIN
        if (decoded.role !== "ADMIN") {
            return res.status(403).json({ error: "Acesso negado. Apenas administradores." });
        }

        if (!req.body) req.body = {};

        req.body.userId = decoded.userId;
        req.body.userRole = decoded.role;

        return next();
    } catch (err) {
        console.error("Erro na validação do JWT Admin:", err);
        return res.status(401).json({ error: "Token inválido ou expirado." });
    }
};
