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

        // Garante registro na tabela cliente para este usuário
        await prisma.cliente.upsert({
            where: { id: newUser.id },
            update: {
                nome: name,
                email: email,
                usuarioId: newUser.id
            },
            create: {
                id: newUser.id,
                nome: name,
                email: email,
                usuarioId: newUser.id
            }
        });

        // Mensagem automática de boas-vindas com o link de pagamento
        const welcomeMessage = "Bem-vindo! Para liberar o agente de IA e operar day trade no Mini-Índice, realize o pagamento diário de R$100 em: https://agenteia-22ds.onrender.com/pagamento.html";

        await prisma.message.create({
            data: {
                content: welcomeMessage,
                type: "text",
                senderType: "ADMIN",
                usuarioId: newUser.id,
                clienteId: newUser.id
            }
        });

        return res.status(201).json({ message: "Usuário criado com sucesso!", id: newUser.id });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: "Erro interno no servidor." });
    }
};
