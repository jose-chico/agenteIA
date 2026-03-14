import { Request, Response } from "express";
import { prisma } from "@/database/client";

export const ManualPaymentStatusController = async (req: Request, res: Response) => {
    try {
        const userId = Number(req.body.userId);
        if (!Number.isFinite(userId) || userId <= 0) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { isPremium: true, email: true, id: true }
        });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        return res.json({
            isPremium: user.isPremium,
            email: user.email,
            userId: user.id
        });
    } catch (error) {
        console.error("Erro em ManualPaymentStatusController:", error);
        return res.status(500).json({ error: "Erro ao verificar status de pagamento." });
    }
};
