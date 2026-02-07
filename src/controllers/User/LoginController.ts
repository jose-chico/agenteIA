import { Request, Response } from "express";
import { prisma } from "../../database/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const LoginController = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        // 1. Procurar o usuário pelo e-mail
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({ error: "E-mail ou senha incorretos." });
        }

        // 2. Verificar se a senha bate com o hash no banco
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: "E-mail ou senha incorretos." });
        }

        // 3. Gerar o Token JWT (Chave de acesso)
        // O "SECRET_KEY" deve estar no seu arquivo .env
        const token = jwt.sign(
            { userId: user.id },
            process.env.JWT_SECRET || "sua_chave_secreta_aqui",
            { expiresIn: "1d" } // O login dura 1 dia
        );

        // 4. Retornar os dados para o Frontend
        return res.status(200).json({
            message: "Login realizado com sucesso!",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email
            }
        });

    } catch (error) {
        console.error("LOGIN ERROR:", error);
        return res.status(500).json({ error: "Erro interno no servidor." });
    }
};