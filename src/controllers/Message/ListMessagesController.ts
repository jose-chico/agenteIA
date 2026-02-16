import { Request, Response } from "express";
import { prisma } from "../../database/client";

export const ListMessagesController = async (req: Request, res: Response) => {
    try {
        const { clienteId } = req.params;
        const authUserId = req.body.userId;
        const idBusca = Number(clienteId);
        const userId = Number(authUserId);

        // Se o idBusca não for um número válido, paramos aqui
        if (isNaN(idBusca)) {
            return res.status(400).json({ error: "ID do cliente inválido." });
        }

        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { clienteId: idBusca },
                    { usuarioId: idBusca }
                ],
                NOT: {
                    deletedBy: {
                        has: userId
                    }
                }
            },
            orderBy: {
                createdAt: "asc"
            }
        });

        console.log(`Mensagens encontradas para o ID ${idBusca}:`, messages.length);
        return res.json(messages);
    } catch (error) {
        console.error("Erro no ListMessages (Admin):", error);
        return res.status(500).json({ error: "Erro ao carregar mensagens." });
    }
};

export const ListMyMessagesController = async (req: Request, res: Response) => {
    try {
        const userId = req.body.userId; 

        if (!userId) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        const idUsuario = Number(userId);

        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { clienteId: idUsuario },
                    { usuarioId: idUsuario }
                ],
                NOT: {
                    deletedBy: {
                        has: idUsuario
                    }
                }
            },
            orderBy: {
                createdAt: "asc"
            }
        });

        return res.json(messages);
    } catch (error) {
        console.error("Erro ao listar histórico:", error);
        return res.status(500).json({ error: "Erro ao carregar histórico." });
    }
};
