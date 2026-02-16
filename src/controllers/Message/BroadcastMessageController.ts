import { Request, Response } from "express";
import { prisma } from "../../database/client";
import { getIO } from "../../socket";

export const BroadcastMessageController = async (req: Request, res: Response) => {
    try {
        const { content } = req.body;
        const adminUserId = req.body.userId;

        if (!content) {
            return res.status(400).json({ error: "Conteúdo da mensagem é obrigatório." });
        }

        // Busca todos os clientes
        const clientes = await prisma.cliente.findMany();

        if (clientes.length === 0) {
            return res.status(404).json({ error: "Nenhum cliente encontrado." });
        }

        const io = getIO();
        let successCount = 0;
        const createdMessages = [];

        // Cria uma mensagem para cada cliente
        for (const cliente of clientes) {
            try {
                const newMessage = await prisma.message.create({
                    data: {
                        content: content,
                        usuarioId: adminUserId,
                        clienteId: cliente.id,
                        senderType: "ADMIN",
                        type: "TEXT",
                        isRead: false
                    }
                });

                // Envia via socket para o cliente
                io.to(cliente.id.toString()).emit("newMessage", newMessage);
                
                successCount++;
                createdMessages.push(newMessage);
            } catch (err) {
                console.error(`Erro ao enviar para cliente ${cliente.id}:`, err);
            }
        }

        console.log(`✅ Broadcast enviado para ${successCount} cliente(s)`);

        return res.status(201).json({ 
            message: "Mensagens enviadas com sucesso",
            count: successCount,
            clientIds: clientes.map(c => c.id)
        });

    } catch (error) {
        console.error("Erro no broadcast:", error);
        return res.status(500).json({ error: "Erro ao enviar mensagens broadcast." });
    }
};
