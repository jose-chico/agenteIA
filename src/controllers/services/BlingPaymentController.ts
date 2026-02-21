import { Request, Response } from "express";
import { prisma } from "@/database/client";

function buildPaymentLink(template: string, user: { id: number; email: string; name: string }) {
    const reference = `falcon_user_${user.id}`;

    return template
        .split("{userId}").join(encodeURIComponent(String(user.id)))
        .split("{email}").join(encodeURIComponent(user.email))
        .split("{name}").join(encodeURIComponent(user.name || ""))
        .split("{reference}").join(encodeURIComponent(reference));
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

function extractUserId(payload: any): number | null {
    const raw =
        payload?.userId ??
        payload?.clienteId ??
        payload?.customerId ??
        payload?.data?.userId ??
        payload?.data?.clienteId ??
        payload?.data?.customerId ??
        payload?.metadata?.userId ??
        payload?.meta?.userId ??
        null;

    const parsed = Number(raw);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return null;
}

function tryExtractUserIdFromReference(reference: string): number | null {
    if (!reference) return null;

    const patterns = [
        /userId[:=_-]?(\d+)/i,
        /uid[:=_-]?(\d+)/i,
        /clienteId[:=_-]?(\d+)/i,
        /id[:=_-]?(\d+)/i
    ];

    for (const pattern of patterns) {
        const match = reference.match(pattern);
        if (match?.[1]) {
            const id = Number(match[1]);
            if (Number.isFinite(id) && id > 0) return id;
        }
    }

    return null;
}

function extractEventName(payload: any): string {
    return String(
        payload?.event ||
        payload?.eventName ||
        payload?.type ||
        payload?.topic ||
        payload?.name ||
        payload?.data?.event ||
        payload?.data?.type ||
        ""
    ).trim().toLowerCase();
}

function isPaidEvent(payload: any): boolean {
    const status = extractStatus(payload);
    if (isPaidStatus(status)) return true;

    const event = extractEventName(payload);
    if (!event) return false;

    return [
        "paid",
        "pago",
        "approved",
        "confirm",
        "receb"
    ].some((token) => event.includes(token));
}

function isWebhookAuthorized(req: Request): boolean {
    const secret = (process.env.BLING_WEBHOOK_SECRET || "").trim();
    if (!secret) return true;

    const headerSecret = String(req.headers["x-webhook-secret"] || "").trim();
    const querySecret = String(req.query.secret || "").trim();
    const authHeader = String(req.headers.authorization || "").trim();
    const bearer = authHeader.toLowerCase().startsWith("bearer ")
        ? authHeader.slice(7).trim()
        : "";

    return headerSecret === secret || querySecret === secret || bearer === secret;
}

async function releaseAccessFromPaymentData(params: {
    email: string;
    userId: number | null;
    reference: string;
    paymentId: string;
    status: string;
    amount: number;
}) {
    const { email, userId, reference, paymentId, status, amount } = params;

    const referenceUserId = tryExtractUserIdFromReference(reference);
    const finalUserId = userId || referenceUserId;

    const user =
        (finalUserId
            ? await prisma.user.findUnique({ where: { id: finalUserId } })
            : null) ||
        (email
            ? await prisma.user.findUnique({ where: { email } })
            : null);

    if (!user) {
        return { ok: false as const, reason: "user_not_found" };
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: true }
    });

    const effectivePaymentId = paymentId || `bling-${user.id}-${Date.now()}`;

    await prisma.payment.upsert({
        where: { stripePaymentId: effectivePaymentId },
        update: {
            status: status || "paid",
            amount,
            customerEmail: user.email,
            customerName: user.name,
            paymentMethod: "BLING_LINK",
            paidAt: new Date()
        },
        create: {
            stripePaymentId: effectivePaymentId,
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

    return { ok: true as const, userId: user.id };
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
        if (!isWebhookAuthorized(req)) {
            return res.status(401).json({ error: "Webhook não autorizado." });
        }

        const payload = req.body || {};
        const status = extractStatus(payload);
        const isPaid = isPaidEvent(payload);
        const email = extractEmail(payload);
        const userId = extractUserId(payload);
        const paymentId = extractPaymentId(payload);
        const reference = extractReference(payload);
        const amount = extractAmount(payload);

        if (!isPaid) {
            return res.status(200).json({ received: true, ignored: "status_not_paid" });
        }

        const released = await releaseAccessFromPaymentData({
            email,
            userId,
            reference,
            paymentId,
            status,
            amount
        });

        if (!released.ok) {
            console.warn("Webhook Bling sem usuário vinculável:", payload);
            return res.status(202).json({
                received: true,
                pending: "user_not_found"
            });
        }

        return res.status(200).json({ received: true, userId: released.userId });
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
