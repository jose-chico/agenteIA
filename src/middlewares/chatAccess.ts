import { Request, Response, NextFunction } from "express";
import { prisma } from "@/database/client";

export const ChatAccessMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authUserId = Number(req.body.userId);
        const userRole = String(req.body.userRole || "").toUpperCase();

        if (!Number.isFinite(authUserId) || authUserId <= 0) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        if (userRole === "ADMIN") {
            return next();
        }

        const user = await prisma.user.findUnique({
            where: { id: authUserId },
            select: { id: true, email: true, isPremium: true }
        });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        if (user.isPremium) {
            return next();
        }

        const paidStatusTokens = [
            "paid",
            "pago",
            "approved",
            "aprovado",
            "received",
            "recebido",
            "confirmed",
            "confirmado"
        ];

        const paidRecord = await prisma.payment.findFirst({
            where: {
                AND: [
                    {
                        OR: [
                            { customerEmail: user.email },
                            { stripeSessionId: { contains: `falcon_user_${user.id}` } }
                        ]
                    },
                    {
                        OR: paidStatusTokens.map((token) => ({
                            status: {
                                contains: token,
                                mode: "insensitive"
                            }
                        }))
                    }
                ]
            },
            select: { id: true }
        });

        if (paidRecord) {
            await prisma.user.update({
                where: { id: user.id },
                data: { isPremium: true }
            });
            return next();
        }

        return res.status(403).json({
            error: "Acesso bloqueado. Pagamento necessário para usar o chat.",
            code: "PAYMENT_REQUIRED"
        });
    } catch (error) {
        console.error("Erro no ChatAccessMiddleware:", error);
        return res.status(500).json({ error: "Erro ao validar acesso ao chat." });
    }
};
