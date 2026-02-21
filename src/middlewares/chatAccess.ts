import { Request, Response, NextFunction } from "express";
import { prisma } from "@/database/client";

export const ChatAccessMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authUserId = Number(req.body.userId);
        const userRole = String(req.body.userRole || "").toUpperCase();

        if (!Number.isFinite(authUserId) || authUserId <= 0) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        // Admin sempre pode acessar o chat.
        if (userRole === "ADMIN") {
            return next();
        }

        const user = await prisma.user.findUnique({
            where: { id: authUserId },
            select: { isPremium: true }
        });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        if (!user.isPremium) {
            return res.status(403).json({
                error: "Acesso bloqueado. Pagamento necessário para usar o chat.",
                code: "PAYMENT_REQUIRED"
            });
        }

        return next();
    } catch (error) {
        console.error("Erro no ChatAccessMiddleware:", error);
        return res.status(500).json({ error: "Erro ao validar acesso ao chat." });
    }
};

