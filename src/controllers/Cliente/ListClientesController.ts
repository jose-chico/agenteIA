import { Request, Response } from "express";
import { prisma } from "../../database/client";

export const ListClientesController = async (req: Request, res: Response) => {
    try {
        // Busca todos os clientes
        const clientes = await prisma.cliente.findMany({
            orderBy: {
                nome: "asc"
            }
        });

        return res.json(clientes);
    } catch (error) {
        console.error("Erro ao listar clientes:", error);
        return res.status(500).json({ error: "Erro interno ao buscar clientes." });
    }
};