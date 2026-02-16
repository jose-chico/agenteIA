import crypto from "crypto";
import { prisma } from "../../../database/client";

type VerifyResult =
  | { ok: true; usuarioId: number }
  | { ok: false; reason: "invalid" | "used" | "expired" | "error" };

export async function verifyAndConsumeToken(tokenRaw: string): Promise<VerifyResult> {
    try {
        const tokenHash = crypto.createHash("sha256").update(tokenRaw).digest("hex");

        const token = await prisma.passwordResetToken.findUnique({
            where: { tokenHash },
        });

        if (!token) return { ok: false, reason: "invalid" };
        if (token.usedAt) return { ok: false, reason: "used" };
        if (token.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };

        // Consome o token: não pode ser usado duas vezes!
        await prisma.passwordResetToken.update({
            where: { tokenHash },
            data: { usedAt: new Date() },
        });

        return { ok: true, usuarioId: token.usuarioId };
    } catch (error) {
        console.error("Erro ao validar token:", error);
        return { ok: false, reason: "error" };
    }
}