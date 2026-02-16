import { Request, Response } from "express";
import { prisma } from "../../database/client";
import bcrypt from "bcrypt";
import crypto from "crypto"; // Importado para gerar o hash de comparação

export const ResetPasswordController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({ message: "Token e nova senha são obrigatórios." });
        }

        // 1. IMPORTANTE: Gerar o Hash do token recebido para comparar com o banco
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

        // 2. Buscar pelo hash e não pelo token puro
        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { tokenHash: tokenHash },
            include: { user: true }
        });

        // 3. Validações de segurança
        if (!resetToken) {
            return res.status(400).json({ message: "Token inválido." });
        }

        if (resetToken.usedAt) {
            return res.status(400).json({ message: "Este link já foi utilizado." });
        }

        if (new Date() > resetToken.expiresAt) {
            return res.status(400).json({ message: "Este link expirou. Solicite um novo e-mail." });
        }

        // 4. Criptografar a nova senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // 5. Transação: Atualiza a senha e marca o token como usado ao mesmo tempo
        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetToken.usuarioId },
                data: { password: hashedPassword }
            }),
            prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { usedAt: new Date() }
            })
        ]);

        console.log(`[SUCESSO] Senha redefinida para o usuário ID: ${resetToken.usuarioId}`);

        return res.status(200).json({ message: "Senha alterada com sucesso!" });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
        console.error("❌ Erro no ResetPassword:", errorMessage);
        return res.status(500).json({ message: "Erro interno no servidor." });
    }
};