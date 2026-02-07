import { Request, Response } from "express";
import { prisma } from "../../database/client";
import { io } from "../../server"; // 1. Importamos o 'io' que você exportou no server.ts

export const CreateMessageController = async (req: Request, res: Response) => {
    try {
        const { content, type, clienteId } = req.body;
        const authUserId = req.body.userId;

        if (!authUserId) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        const userId = Number(authUserId);
        
        const finalClienteId = clienteId ? Number(clienteId) : userId;
        const senderType = clienteId ? "ADMIN" : "CLIENTE";

        console.log("--- Processando Mensagem ---");
        console.log(`Usuário Logado: ${userId} | Chat Destino (Cliente): ${finalClienteId}`);

        let clienteExiste = await prisma.cliente.findUnique({
            where: { id: finalClienteId }
        });

        if (!clienteExiste) {
            console.log(`Cliente ${finalClienteId} não encontrado. Criando registro automático...`);
            const currentUser = await prisma.user.findUnique({ where: { id: userId } });

            clienteExiste = await prisma.cliente.create({
                data: {
                    id: finalClienteId,
                    nome: currentUser?.name || "Cliente Novo",
                    email: currentUser?.email || "",
                    usuarioId: userId
                }
            });
        }

        // 3. Salvando a mensagem no Banco de Dados
        const newMessage = await prisma.message.create({
            data: {
                content,
                type: type || "text",
                senderType: senderType,
                usuarioId: userId,
                clienteId: clienteExiste.id
            }
        });

        // --- 🚀 DISPARO EM TEMPO REAL ---
        // Envia para o cliente específico (sala do usuário)
        io.to(finalClienteId.toString()).emit("newMessage", newMessage);
        
        // Se for mensagem de CLIENTE, também envia para a sala "admin" (todos os admins)
        if (senderType === "CLIENTE") {
            io.to("admin").emit("newMessage", newMessage);
        }
        
        // Se for mensagem de ADMIN, também envia para o admin que enviou (para atualizar a própria tela)
        if (senderType === "ADMIN") {
            io.to(userId.toString()).emit("newMessage", newMessage);
        }

        console.log("✅ Mensagem enviada e transmitida via Socket!");
        return res.status(201).json(newMessage);

    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error("❌ ERRO NO CONTROLLER:", error.message);
            return res.status(500).json({ error: "Erro ao processar mensagem.", detail: error.message });
        }
        return res.status(500).json({ error: "Erro interno desconhecido." });
    }
};