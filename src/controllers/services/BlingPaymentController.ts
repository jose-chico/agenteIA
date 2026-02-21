import { Request, Response } from "express";
import { prisma } from "@/database/client";

function buildPaymentLink(template: string, user: { id: number; email: string; name: string }) {
    return template
        .split("{userId}").join(encodeURIComponent(String(user.id)))
        .split("{email}").join(encodeURIComponent(user.email))
        .split("{name}").join(encodeURIComponent(user.name || ""));
}

function isPaidStatus(value: unknown) {
    const status = String(value || "").toLowerCase();
    if (!status) return false;

    return [
        "paid",
        "pago",
        "approved",
        "aprovado",
        "received",
        "recebido",
        "confirmed",
        "confirmado"
    ].some((item) => status.includes(item));
}

function extractEmail(payload: any): string {
    return String(
        payload?.email ||
        payload?.customerEmail ||
        payload?.customer?.email ||
        payload?.data?.email ||
        payload?.data?.customerEmail ||
        payload?.data?.customer?.email ||
        payload?.cobranca?.email ||
        payload?.pagamento?.email ||
        ""
    ).trim().toLowerCase();
}

function extractStatus(payload: any): string {
    return String(
        payload?.status ||
        payload?.paymentStatus ||
        payload?.data?.status ||
        payload?.data?.paymentStatus ||
        payload?.pagamento?.status ||
        ""
    ).trim();
}

function extractAmount(payload: any): number {
    const amountRaw =
        payload?.amount ??
        payload?.value ??
        payload?.total ??
        payload?.data?.amount ??
        payload?.data?.value ??
        payload?.pagamento?.valor ??
        0;

    const normalized = Number(
        String(amountRaw)
            .replace(/[^\d,.-]/g, "")
            .replace(",", ".")
    );

    return Number.isFinite(normalized) ? normalized : 0;
}

function extractPaymentId(payload: any): string {
    return String(
        payload?.paymentId ||
        payload?.id ||
        payload?.transactionId ||
        payload?.data?.paymentId ||
        payload?.data?.id ||
        payload?.data?.transactionId ||
        ""
    ).trim();
}

function extractReference(payload: any): string {
    return String(
        payload?.reference ||
        payload?.externalReference ||
        payload?.data?.reference ||
        payload?.data?.externalReference ||
        ""
    ).trim();
}

export const GetPaymentAccessStatusController = async (req: Request, res: Response) => {
    try {
        const authUserId = Number(req.body.userId);

        if (!Number.isFinite(authUserId) || authUserId <= 0) {
            return res.status(401).json({ error: "Usuário não autenticado." });
        }

        const user = await prisma.user.findUnique({
            where: { id: authUserId },
            select: { id: true, email: true, name: true, isPremium: true }
        });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        const paymentTemplate = (process.env.BLING_PAYMENT_LINK || "").trim();
        const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
        const fallbackPixUrl = `${appUrl}/pagamento.html?userId=${encodeURIComponent(String(user.id))}&email=${encodeURIComponent(user.email)}`;
        const paymentUrl = paymentTemplate ? buildPaymentLink(paymentTemplate, user) : fallbackPixUrl;

        return res.status(200).json({
            isPremium: user.isPremium,
            paymentRequired: !user.isPremium,
            paymentUrl
        });
    } catch (error) {
        console.error("Erro em GetPaymentAccessStatusController:", error);
        return res.status(500).json({ error: "Erro ao consultar acesso de pagamento." });
    }
};

export const GetBlingPaymentLinkController = async (req: Request, res: Response) => {
    try {
        const authUserId = Number(req.body.userId);
        const paymentTemplate = (process.env.BLING_PAYMENT_LINK || "").trim();

        const user = await prisma.user.findUnique({
            where: { id: authUserId },
            select: { id: true, email: true, name: true, isPremium: true }
        });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado." });
        }

        const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
        const fallbackPixUrl = `${appUrl}/pagamento.html?userId=${encodeURIComponent(String(user.id))}&email=${encodeURIComponent(user.email)}`;
        const paymentUrl = paymentTemplate ? buildPaymentLink(paymentTemplate, user) : fallbackPixUrl;
        return res.status(200).json({
            paymentUrl,
            isPremium: user.isPremium
        });
    } catch (error) {
        console.error("Erro em GetBlingPaymentLinkController:", error);
        return res.status(500).json({ error: "Erro ao gerar link de pagamento." });
    }
};

export const ConfirmBlingPaymentController = async (req: Request, res: Response) => {
    try {
        const { userId, email, amount, paymentId, reference, status } = req.body;

        const finalEmail = String(email || "").trim().toLowerCase();
        const finalUserId = Number(userId);

        const user = Number.isFinite(finalUserId) && finalUserId > 0
            ? await prisma.user.findUnique({ where: { id: finalUserId } })
            : await prisma.user.findUnique({ where: { email: finalEmail } });

        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado para confirmação." });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { isPremium: true }
        });

        const paymentKey = String(paymentId || "").trim();
        const paymentRef = String(reference || "").trim();

        if (paymentKey) {
            await prisma.payment.upsert({
                where: { stripePaymentId: paymentKey },
                update: {
                    status: String(status || "paid"),
                    amount: Number(amount || 0),
                    customerEmail: user.email,
                    customerName: user.name,
                    paymentMethod: "BLING_LINK",
                    paidAt: new Date()
                },
                create: {
                    stripePaymentId: paymentKey,
                    stripeSessionId: paymentRef || null,
                    status: String(status || "paid"),
                    amount: Number(amount || 0),
                    currency: "BRL",
                    customerEmail: user.email,
                    customerName: user.name,
                    paymentMethod: "BLING_LINK",
                    paidAt: new Date()
                }
            });
        }

        return res.status(200).json({
            message: "Pagamento confirmado e acesso liberado.",
            userId: user.id
        });
    } catch (error) {
        console.error("Erro em ConfirmBlingPaymentController:", error);
        return res.status(500).json({ error: "Erro ao confirmar pagamento." });
    }
};

export const BlingWebhookController = async (req: Request, res: Response) => {
    try {
        const secret = (process.env.BLING_WEBHOOK_SECRET || "").trim();
        const sentSecret = String(req.headers["x-webhook-secret"] || "").trim();

        if (secret && sentSecret !== secret) {
            return res.status(401).json({ error: "Webhook não autorizado." });
        }

        const payload = req.body || {};
        const status = extractStatus(payload);
        const isPaid = isPaidStatus(status);
        const email = extractEmail(payload);
        const paymentId = extractPaymentId(payload);
        const reference = extractReference(payload);
        const amount = extractAmount(payload);

        if (!isPaid) {
            return res.status(200).json({ received: true, ignored: "status_not_paid" });
        }

        if (!email) {
            console.warn("Webhook Bling sem email identificável:", payload);
            return res.status(400).json({ error: "Email do pagador não encontrado no payload." });
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: "Usuário não encontrado para este pagamento." });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { isPremium: true }
        });

        if (paymentId) {
            await prisma.payment.upsert({
                where: { stripePaymentId: paymentId },
                update: {
                    status: status || "paid",
                    amount,
                    customerEmail: user.email,
                    customerName: user.name,
                    paymentMethod: "BLING_LINK",
                    paidAt: new Date()
                },
                create: {
                    stripePaymentId: paymentId,
                    stripeSessionId: reference || null,
                    amount,
                    currency: "BRL",
                    status: status || "paid",
                    customerEmail: user.email,
                    customerName: user.name,
                    paymentMethod: "BLING_LINK",
                    paidAt: new Date()
                }
            });
        }

        return res.status(200).json({ received: true, userId: user.id });
    } catch (error) {
        console.error("Erro em BlingWebhookController:", error);
        return res.status(500).json({ error: "Erro ao processar webhook do Bling." });
    }
};

export const GetPixInfoController = async (req: Request, res: Response) => {
    const pixKey = (process.env.PIX_KEY || "6037b8eb-5956-4886-9fc0-98cd16119dc0").trim();
    const receiverName = (process.env.PIX_RECEIVER_NAME || "FALCON AI").trim();
    const city = (process.env.PIX_CITY || "SAO PAULO").trim();
    const amount = Number(process.env.PIX_AMOUNT || "1");

    return res.status(200).json({
        pixKey,
        receiverName,
        city,
        amount: Number.isFinite(amount) && amount > 0 ? amount : 1
    });
};
