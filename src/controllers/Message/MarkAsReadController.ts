import { Request, Response } from "express";
import { prisma } from "../../database/client";
import { getIO } from "../../socket";

export const MarkAsReadController = async (req: Request, res: Response) => {
    try {
        const { messageIds } = req.body;
        const authUserId = req.body.userId;

        if (!authUserId) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        if (!messageIds || !Array.isArray(messageIds) || messageIds.length === 0) {
            return res.status(400).json({ error: "IDs de mensagens inválidos." });
        }

        const updatedMessages = await prisma.message.updateMany({
            where: {
                id: { in: messageIds },
                isRead: false
            },
            data: {
                isRead: true,
                readAt: new Date()
            }
        });

        // Notifica via socket que as mensagens foram lidas
        if (updatedMessages.count > 0) {
            const io = getIO(); // Obtém a instância do socket
            const messages = await prisma.message.findMany({
                where: { id: { in: messageIds } },
                select: { id: true, clienteId: true, usuarioId: true }
            });

            messages.forEach(msg => {
                // Notifica o remetente que a mensagem foi lida
                io.to(msg.usuarioId.toString()).emit("messageRead", { 
                    messageIds: [msg.id],
                    readBy: authUserId 
                });
            });
        }

        return res.status(200).json({ 
            success: true, 
            updatedCount: updatedMessages.count 
        });

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("❌ ERRO AO MARCAR COMO LIDO:", error.message);
            return res.status(500).json({ error: "Erro ao marcar mensagens.", detail: error.message });
        }
        return res.status(500).json({ error: "Erro interno desconhecido." });
    }
};
