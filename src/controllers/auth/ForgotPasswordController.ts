import { Request, Response } from "express";
import { prisma } from "../../database/client"; 
import { generateResetTokenAndLink } from "../services/resetToken/generateResetToken";
import { sendMail } from "../services/mailer/mailer"; 
import { resetPasswordTemplate } from "../services/mailer/templates/resetPassword";

export const ForgotPasswordController = async (req: Request, res: Response): Promise<Response> => {
    try {
        const { email } = req.body;
        console.log("------------------------------------------------");
        console.log(`[1] Tentativa de recuperação para: ${email}`);

        if (!email) {
            console.log("[ERRO] Corpo da requisição sem e-mail.");
            return res.status(400).json({ message: "O e-mail é obrigatório." });
        }

        // Busca o usuário ignorando maiúsculas/minúsculas
        const user = await prisma.user.findFirst({ 
            where: { 
                email: {
                    equals: email,
                    mode: "insensitive" 
                }
            } 
        });

        if (!user) {
            console.log(`[2] FIM: E-mail "${email}" não localizado no banco.`);
            // Retornamos 200 por segurança (evita enumeração de usuários), mas o log nos avisa
            return res.status(200).json({ message: "Se cadastrado, você receberá o link." });
        }

        console.log(`[3] Usuário ID ${user.id} localizado.`);

        try {
            console.log("[4] Gerando token e link...");
            const { link } = await generateResetTokenAndLink(user.id);
            
            // --- AJUSTE DO LINK PARA O SEU FRONTEND ---
            // 1. Muda a porta de 8000 para 5655
            // 2. Adiciona /public/ no caminho para o Live Server encontrar o arquivo
            const finalLink = link
                .replace("8000", "5655") 
                .replace("redefinir-senha.html", "public/redefinir-senha.html"); 

            console.log("\n================================================");
            console.log(`🔥 LINK GERADO: ${finalLink}`);
            console.log("================================================\n");

            const htmlContent = resetPasswordTemplate(finalLink, user.name || "Usuário");
            
            console.log("[5] Enviando e-mail...");
            await sendMail(email, "Redefinição de Senha 🔑", htmlContent);
            console.log("[6] E-mail enviado com sucesso!");

        } catch (tokenErr: unknown) {
            const msg = tokenErr instanceof Error ? tokenErr.message : "Erro desconhecido no token/mail";
            console.log("❌ ERRO NO PASSO 4 ou 5:");
            console.error(msg);
            return res.status(500).json({ message: "Erro ao gerar token de recuperação." });
        }

        return res.status(200).json({ 
            message: "Se o e-mail estiver cadastrado, você receberá um link de recuperação." 
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "Erro crítico";
        console.error("❌ ERRO GERAL NO CONTROLLER:", errorMessage);
        return res.status(500).json({ message: "Erro ao processar solicitação." });
    }
};