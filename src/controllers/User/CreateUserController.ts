import { Request, Response } from "express";
import { prisma } from "../../database/client";
import bcrypt from "bcrypt";

export const CreateUserController = async (req: Request, res: Response) => {
    try {
        const { name, email, phone, password } = req.body;

        // 1. Verificação básica
        if (!name || !email || !password) {
            return res.status(400).json({ error: "Preencha todos os campos obrigatórios." });
        }

        // 2. Checar se o e-mail já existe
        const userExists = await prisma.user.findUnique({ where: { email } });
        if (userExists) {
            return res.status(400).json({ error: "Este e-mail já está em uso." });
        }

        // 3. Criptografar a senha
        const hashedPassword = await bcrypt.hash(password, 10);

        // 4. Salvar no Banco de Dados
        const newUser = await prisma.user.create({
            data: {
                name,
                email,
                phone,
                password: hashedPassword
            }
        });

        return res.status(201).json({ message: "Usuário criado com sucesso!", id: newUser.id });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erro interno no servidor." });
    }
};