import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Interface para o TypeScript não reclamar do 'any'
interface TokenPayload {
    userId?: string | number;
    id?: string | number;
    role?: string;
    iat: number;
    exp: number;
}

export const AuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).json({ error: "Token não fornecido." });
    }

    const [, token] = authHeader.split(" ");

    try {
        const secret = process.env.JWT_SECRET || "sua_chave_secreta_aqui";

        // Decodifica o token usando a interface
        const decoded = jwt.verify(token, secret) as TokenPayload;

        // Busca o ID independente se no token está como 'userId' ou 'id'
        const id = decoded.userId || decoded.id;

        if (!id) {
            return res.status(401).json({ error: "ID de usuário não encontrado no token." });
        }

        // Garante que req.body existe
        if (!req.body) req.body = {};

        // Passa o ID para o corpo da requisição para o controller usar
        req.body.userId = id;
        if (decoded.role) {
            req.body.userRole = decoded.role;
        }

        return next();
    } catch (err) {
        console.error("Erro na validação do JWT:", err);
        return res.status(401).json({ error: "Token inválido ou expirado." });
    }
};
