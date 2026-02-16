import { Request, Response } from "express";
import { prisma } from "../../database/client";

export const DeleteClienteController = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        await prisma.cliente.delete({
            where: { id: Number(id) }
        });

        return res.json({ message: "Cliente removido com sucesso." });
    } catch (error) {
        return res.status(500).json({ error: "Erro ao excluir cliente." });
    }
};