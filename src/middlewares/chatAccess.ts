import { Request, Response, NextFunction } from "express";
import { prisma } from "@/database/client";

export const ChatAccessMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    // Paywall desligado: apenas verifica se está autenticado
    const authUserId = Number(req.body.userId);
    if (!Number.isFinite(authUserId) || authUserId <= 0) {
        return res.status(401).json({ error: "Usuário não autenticado." });
    }
    return next();
};
