import { Request, Response } from "express";
import { prisma } from "../../database/client";
import { getIO } from "../../socket"; // Importa getIO ao invés de io direto
import { sendPushNotification } from "../../services/push";
import { sendMail } from "../services/mailer/mailer";

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
        const io = getIO(); // Obtém a instância do socket

        // Envia para o cliente específico (sala do usuário)
        io.to(finalClienteId.toString()).emit("newMessage", newMessage);

        // Se for mensagem de CLIENTE, também envia para a sala "admin" (todos os admins)
        if (senderType === "CLIENTE") {
            io.to("admin").emit("newMessage", newMessage);
            // Envia também para o próprio cliente que enviou (para aparecer na tela dele)
            io.to(userId.toString()).emit("newMessage", newMessage);
        }

        if (senderType === "ADMIN") {
            io.to(userId.toString()).emit("newMessage", newMessage);

            // --- NOTIFICAÇÃO PUSH PARA O CLIENTE (Se a msg for do Admin) ---
            if (clienteExiste) {
                // Busca subscrições do cliente
                // @ts-ignore
                const subscriptions = await prisma.pushSubscription.findMany({
                    where: { clienteId: clienteExiste.id }
                });

                if (subscriptions) {
                    const payload = {
                        title: "Nova mensagem do Suporte",
                        body: content.length > 50 ? content.substring(0, 50) + "..." : content,
                        url: `/index.html?chat=${clienteExiste.id}`, // Link para abrir o chat
                        icon: "https://cdn-icons-png.flaticon.com/512/3233/3233508.png" // Ícone genérico
                    };

                    subscriptions.forEach((sub: any) => {
                        const pushSubscription = {
                            endpoint: sub.endpoint,
                            keys: sub.keys
                        };
                        sendPushNotification(pushSubscription, payload);
                    });
                }

                // --- NOTIFICAÇÃO POR EMAIL (OFFLINE) ---
                // Se o cliente tiver email, agenda verificação para daqui a X minutos
                if (clienteExiste.email) {
                    const DELAY_MINUTOS = 10;
                    const delayMs = DELAY_MINUTOS * 60 * 1000;

                    setTimeout(async () => {
                        try {
                            // 1. Verifica se a mensagem ainda existe e NÃO foi lida
                            const msgCheck = await prisma.message.findUnique({
                                where: { id: newMessage.id }
                            });

                            if (msgCheck && !msgCheck.isRead) {
                                console.log(`📧 Cliente ${clienteExiste.nome} offline/não leu. Enviando email...`);

                                const html = `
                                    <div style="font-family: Arial, sans-serif; color: #333;">
                                        <h2>Olá, ${clienteExiste.nome}!</h2>
                                        <p>Você tem uma nova mensagem do suporte que ainda não foi lida.</p>
                                        <p><strong>Mensagem:</strong> "${content.substring(0, 100)}${content.length > 100 ? '...' : ''}"</p>
                                        <br>
                                        <a href="${process.env.APP_URL || 'http://localhost:3000'}/index.html?chat=${clienteExiste.id}" 
                                           style="background-color: #10b981; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                                           Responder Agora
                                        </a>
                                        <br><br>
                                        <p style="font-size: 12px; color: #888;">Se você já leu esta mensagem, desconsidere este e-mail.</p>
                                    </div>
                                `;

                                await sendMail(clienteExiste.email!, "Nova mensagem do suporte", html);
                            }
                        } catch (err) {
                            console.error("Erro ao enviar email offline:", err);
                        }
                    }, delayMs);
                }
            }
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