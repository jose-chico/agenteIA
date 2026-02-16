import { Request, Response } from "express";
import { prisma } from "../../database/client";
import bcrypt from "bcrypt";

export const ResetPasswordController = async (req: Request, res: Response) => {
    try {
        const { email, newPassword } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });

        if (!user) {
            return res.status(404).json({ error: "E-mail não encontrado." });
        }

        // Criptografa a nova senha
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Atualiza no banco
        await prisma.user.update({
            where: { email },
            data: { password: hashedPassword }
        });

        return res.json({ message: "Senha alterada com sucesso!" });
    } catch (error) {
        return res.status(500).json({ error: "Erro ao redefinir senha." });
    }
};