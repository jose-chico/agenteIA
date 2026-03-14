import { Request, Response } from "express";
import { prisma } from "../../database/client";
import { getIO } from "../../socket";

export const DeleteMessageController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { mode } = req.body; // "TODOS" ou "MIM"
        const authUserId = req.body.userId; // Middleware de autenticação injeta isso

        if (!authUserId) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }
        
        const userId = Number(authUserId);
        const messageId = Number(id);

        const messageExists = await prisma.message.findUnique({
            where: { id: messageId }
        });

        if (!messageExists) {
            return res.status(404).json({ error: "Mensagem não encontrada." });
        }

        if (mode === "TODOS") {
            // Validar permissão: só quem enviou pode apagar para todos
            const isOwner = messageExists.usuarioId === userId;
            if (!isOwner) {
                return res.status(403).json({ error: "Você não tem permissão para deletar esta mensagem para todos." });
            }

            // Apaga o registro do banco de dados definitivamente
            await prisma.message.delete({
                where: { id: messageId }
            });

            const io = getIO(); // Obtém a instância do socket
            
            // Notifica via socket que a mensagem foi apagada para todos
            if (messageExists.clienteId) {
                io.to(messageExists.clienteId.toString()).emit("messageDeleted", { id: messageExists.id });
            }
            io.to("admin").emit("messageDeleted", { id: messageExists.id });

            return res.json({ message: "Mensagem apagada para todos!", mode: "TODOS", id: messageId });
        }

        // --- Apagar somente para mim (estilo WhatsApp) ---
        // Permite remover qualquer mensagem da própria visualização, desde que o usuário esteja na conversa
        const inConversation = messageExists.usuarioId === userId || messageExists.clienteId === userId;
        if (!inConversation) {
            return res.status(403).json({ error: "Você não participa desta conversa." });
        }

        const alreadyDeletedBy = messageExists.deletedBy || [];
        const newDeletedBy = Array.from(new Set([...alreadyDeletedBy, userId]));

        await prisma.message.update({
            where: { id: messageId },
            data: {
                deletedBy: { set: newDeletedBy }
            }
        });

        return res.json({ message: "Mensagem removida da sua visualização.", mode: "MIM", id: messageId });
    } catch (error) {
        console.error("Erro ao deletar mensagem:", error);
        return res.status(500).json({ error: "Erro interno ao apagar mensagem." });
    }
};
