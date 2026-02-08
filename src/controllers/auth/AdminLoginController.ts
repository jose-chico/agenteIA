import { Request, Response } from "express";
import { prisma } from "../../database/client";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

export const AdminLoginController = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: "E-mail e senha são obrigatórios." });
        }

        // Busca o usuário na tabela User (admins)
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json({ error: "Credenciais inválidas." });
        }

        // Verifica a senha
        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            return res.status(401).json({ error: "Credenciais inválidas." });
        }

        // Gera o token JWT
        const token = jwt.sign(
            { 
                userId: user.id, 
                email: user.email,
                role: "ADMIN" // Marca explicitamente como admin
            },
            process.env.JWT_SECRET || "secret",
            { expiresIn: "7d" }
        );

        console.log(`✅ Admin login bem-sucedido: ${user.email}`);

        return res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: "ADMIN"
            }
        });

    } catch (error) {
        console.error("Erro no AdminLoginController:", error);
        return res.status(500).json({ error: "Erro interno do servidor." });
    }
};
