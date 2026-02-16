import { Request, Response } from "express";
import { prisma } from "../../database/client";
import { getPublicVapidKey } from "../../services/push";

export const SubscribeController = async (req: Request, res: Response) => {
    const { subscription, clienteId } = req.body;

    if (!subscription || !clienteId) {
        return res.status(400).json({ error: "Dados inválidos." });
    }

    try {
        // Salva ou atualiza a subscrição no banco
        await prisma.pushSubscription.create({
            data: {
                endpoint: subscription.endpoint,
                keys: subscription.keys, // Salva o JSON das chaves
                clienteId: Number(clienteId)
            }
        });

        return res.status(201).json({ message: "Inscrito com sucesso!" });
    } catch (error) {
        // Se já existe (endpoint unique), podemos ignorar ou atualizar
        console.error("Erro ao salvar subscrição:", error);
        return res.status(500).json({ error: "Erro ao salvar subscrição." });
    }
};

export const GetVapidKeyController = (req: Request, res: Response) => {
    const key = getPublicVapidKey();
    return res.json({ publicKey: key });
};
