import nodemailer, { Transporter } from "nodemailer";

const env = (k: string) => (process.env[k] || "").trim();

const HOST = env("SMTP_HOST");
const PORT = Number(env("SMTP_PORT") || "587");
const USER = env("SMTP_USER");
const PASS = env("SMTP_PASS");
const FROM = env("MAIL_FROM") || "no-reply@seu-chat.com";
const FAKE = env("FAKE_MAIL") === "true"; 

export let transporter: Transporter;

/**
 * Inicializa e verifica a conexão com o servidor de e-mail
 */
export async function verifySMTP(): Promise<void> {
    try {
        if (FAKE) {
            console.log("[mailer] 🧪 FAKE_MAIL habilitado — usando Ethereal (Modo Dev)");
            const test = await nodemailer.createTestAccount();
            transporter = nodemailer.createTransport({
                host: test.smtp.host,
                port: test.smtp.port,
                secure: test.smtp.secure,
                auth: { user: test.user, pass: test.pass },
            });
            await transporter.verify();
            console.log("[mailer] ✅ Ethereal pronto para testes.");
            return;
        }

        console.log(`[mailer] 🛰️ Tentando SMTP: ${HOST || "Local"} na porta ${PORT}`);
        
        transporter = nodemailer.createTransport({
            host: HOST || undefined,
            port: PORT,
            secure: PORT === 465, // True para 465, false para outras
            auth: USER && PASS ? { user: USER, pass: PASS } : undefined,
        });

        await transporter.verify();
        console.log("[mailer] ✅ SMTP Real Conectado com Sucesso!");
    } catch (e) {
        console.error("[mailer] ❌ SMTP Error:", e);
        console.log("[mailer] 🔄 Habilitando fallback Ethereal para não travar o sistema...");
        
        const test = await nodemailer.createTestAccount();
        transporter = nodemailer.createTransport({
            host: test.smtp.host,
            port: test.smtp.port,
            secure: test.smtp.secure,
            auth: { user: test.user, pass: test.pass },
        });
        await transporter.verify();
        console.log("[mailer] ✅ Fallback Ethereal pronto.");
    }
}

/**
 * Função principal para disparar e-mails
 */
export async function sendMail(to: string, subject: string, html: string): Promise<void> {
    if (!transporter) {
        throw new Error("Transporter de e-mail não foi inicializado.");
    }

    const info = await transporter.sendMail({ from: FROM, to, subject, html });
    
    // Se estiver usando Ethereal, loga a URL para você ver o e-mail no navegador
    const url = nodemailer.getTestMessageUrl(info);
    if (url) {
        console.log("-----------------------------------------");
        console.log("📧 E-mail de Teste enviado!");
        console.log("🔗 Ver e-mail:", url);
        console.log("-----------------------------------------");
    }
}