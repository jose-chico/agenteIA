import { Request, Response } from "express";
import { prisma } from "../../database/client";

export const UnreadCountController = async (req: Request, res: Response) => {
    try {
        const authUserId = req.body.userId;

        if (!authUserId) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        const userId = Number(authUserId);
        
        // Conta mensagens não lidas recebidas por este usuário
        const unreadCount = await prisma.message.count({
            where: {
                clienteId: userId,
                isRead: false,
                senderType: "ADMIN" // Conta apenas mensagens do admin para o cliente
            }
        });

        // Para admin: conta mensagens não lidas de todos os clientes
        const unreadByClient = await prisma.message.groupBy({
            by: ["clienteId"],
            where: {
                isRead: false,
                senderType: "CLIENTE"
            },
            _count: {
                id: true
            }
        });

        return res.status(200).json({ 
            unreadCount,
            unreadByClient: unreadByClient.map(item => ({
                clienteId: item.clienteId,
                count: item._count.id
            }))
        });

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("❌ ERRO AO CONTAR NÃO LIDAS:", error.message);
            return res.status(500).json({ error: "Erro ao contar mensagens.", detail: error.message });
        }
        return res.status(500).json({ error: "Erro interno desconhecido." });
    }
};
