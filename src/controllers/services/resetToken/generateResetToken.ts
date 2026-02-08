import crypto from "crypto";
import { prisma } from "../../../database/client";

const TTL_MIN = Number(process.env.RESET_TOKEN_TTL_MINUTES || "30");

export async function generateResetTokenAndLink(usuarioId: number) {
    // 1. Buscar o usuário para obter o e-mail (já que o banco exige o e-mail no token)
    const user = await prisma.user.findUnique({
        where: { id: usuarioId },
        select: { email: true }
    });

    if (!user) {
        throw new Error("Usuário não encontrado para geração de token.");
    }

    // 2. Limpeza preventiva
    await prisma.passwordResetToken.deleteMany({
        where: { 
            OR: [
                { usuarioId },
                { expiresAt: { lt: new Date() } }
            ]
        },
    });

    // 3. Token seguro para a URL
    const tokenRaw = crypto.randomBytes(32).toString("hex"); 
    
    // 4. Hash para o Banco (SHA-256)
    const tokenHash = crypto.createHash("sha256").update(tokenRaw).digest("hex");
    const expiresAt = new Date(Date.now() + TTL_MIN * 60 * 1000);

    // 5. Persistência (Agora incluindo o campo 'email' obrigatório)
    await prisma.passwordResetToken.create({
        data: { 
            tokenHash, 
            expiresAt, 
            usuarioId,
            email: user.email // <-- Adicionado para corrigir o erro de tipagem
        },
    });

    const appUrl = (process.env.APP_URL || process.env.BASE_URL || "http://localhost:8000").replace(/\/$/, "");
    
    // Link final
    const link = `${appUrl}/reset-password.html?token=${tokenRaw}`;

    return { tokenRaw, link, expiresAt };
}