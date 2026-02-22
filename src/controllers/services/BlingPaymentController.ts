import { Request, Response } from "express";
import { prisma } from "@/database/client";

type BlingPayload = {
    [key: string]: unknown;
    email?: unknown;
    customerEmail?: unknown;
    customer?: {
        [key: string]: unknown;
        email?: unknown;
    };
    data?: BlingPayload;
    cobranca?: {
        [key: string]: unknown;
        email?: unknown;
    };
    pagamento?: {
        [key: string]: unknown;
        email?: unknown;
        status?: unknown;
        valor?: unknown;
    };
    metadata?: {
        [key: string]: unknown;
        userId?: unknown;
    };
    meta?: {
        [key: string]: unknown;
        userId?: unknown;
    };
};

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

function extractEmail(payload: BlingPayload): string {
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

function extractStatus(payload: BlingPayload): string {
    return String(
        payload?.status ||
        payload?.paymentStatus ||
        payload?.data?.status ||
        payload?.data?.paymentStatus ||
        payload?.pagamento?.status ||
        ""
    ).trim();
}

function extractAmount(payload: BlingPayload): number {
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

function extractPaymentId(payload: BlingPayload): string {
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

function extractReference(payload: BlingPayload): string {
    return String(
        payload?.reference ||
        payload?.externalReference ||
        payload?.data?.reference ||
        payload?.data?.externalReference ||
        ""
    ).trim();
}

function extractUserId(payload: BlingPayload): number | null {
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

    const parsePositive = (raw: unknown): number | null => {
        const value = Number(String(raw ?? "").trim());
        if (!Number.isFinite(value) || value <= 0) return null;
        return value;
    };

    const decodedReference = (() => {
        let current = String(reference || "").trim();
        if (!current) return "";

        // Alguns gateways enviam reference URL-encoded (uma ou mais vezes).
        for (let i = 0; i < 2; i++) {
            try {
                const next = decodeURIComponent(current);
                if (next === current) break;
                current = next;
            } catch {
                break;
            }
        }

        return current;
    })();

    const normalized = decodedReference.trim();
    if (!normalized) return null;

    const searchByKey = (value: string): number | null => {
        const withQueryPrefix = value.includes("?")
            ? value
            : `https://ref.local/?${value.replace(/^[?#&]+/, "")}`;

        try {
            const url = new URL(withQueryPrefix);
            const params = url.searchParams;
            const keys = [
                "userId",
                "userid",
                "user_id",
                "uid",
                "clienteId",
                "cliente_id",
                "customerId",
                "customer_id"
            ];

            for (const key of keys) {
                const parsed = parsePositive(params.get(key));
                if (parsed) return parsed;
            }
        } catch {
            // Não é URL válida, segue para os regex abaixo.
        }

        return null;
    };

    const byQuery = searchByKey(normalized);
    if (byQuery) return byQuery;

    const patterns: Array<{ regex: RegExp; group: number }> = [
        {
            regex: /(?:^|[^a-z0-9])(falcon[_-]?user|user[_-]?id|user|uid|cliente[_-]?id|customer[_-]?id)[^\d]{0,5}(\d{1,12})(?:[^a-z0-9]|$)/i,
            group: 2
        },
        {
            regex: /(?:^|[^a-z0-9])id[^\d]{0,3}(\d{1,12})(?:[^a-z0-9]|$)/i,
            group: 1
        }
    ];

    for (const { regex, group } of patterns) {
        const match = normalized.match(regex);
        if (match?.[group]) {
            const parsed = parsePositive(match[group]);
            if (parsed) return parsed;
        }
    }

    const asNumber = parsePositive(normalized);
    if (asNumber) return asNumber;

    // fallback para referências no formato "falcon_user_123" ou apenas "..._123".
    const trailing = normalized.match(/(?:falcon[_-]?user|user|uid|cliente|customer)?[_-](\d{1,12})$/i);
    if (trailing?.[1]) {
        const parsed = parsePositive(trailing[1]);
        if (parsed) return parsed;
    }

    return null;
}

function extractEventName(payload: BlingPayload): string {
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

function isPaidEvent(payload: BlingPayload): boolean {
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

async function reconcilePremiumFromStoredPayments(user: { id: number; email: string; isPremium: boolean }) {
    if (user.isPremium) {
        return true;
    }

    const paidStatusTokens = [
        "paid",
        "pago",
        "approved",
        "aprovado",
        "received",
        "recebido",
        "confirmed",
        "confirmado"
    ];

    const payment = await prisma.payment.findFirst({
        where: {
            AND: [
                {
                    OR: [
                        { customerEmail: user.email },
                        { stripeSessionId: { contains: `falcon_user_${user.id}` } }
                    ]
                },
                {
                    OR: paidStatusTokens.map((token) => ({
                        status: {
                            contains: token,
                            mode: "insensitive"
                        }
                    }))
                }
            ]
        },
        select: { id: true }
    });

    if (!payment) {
        return false;
    }

    await prisma.user.update({
        where: { id: user.id },
        data: { isPremium: true }
    });

    return true;
}

async function persistPaymentEvidence(params: {
    email: string;
    reference: string;
    paymentId: string;
    status: string;
    amount: number;
}) {
    const { email, reference, paymentId, status, amount } = params;

    const paymentKey = paymentId.trim();
    const paymentRef = reference.trim();
    const normalizedEmail = email.trim().toLowerCase();

    if (!paymentKey && !paymentRef) {
        return;
    }

    const updateData = {
        status: status || "paid",
        amount,
        customerEmail: normalizedEmail || null,
        paymentMethod: "BLING_LINK",
        paidAt: new Date()
    };

    if (paymentKey) {
        await prisma.payment.upsert({
            where: { stripePaymentId: paymentKey },
            update: updateData,
            create: {
                stripePaymentId: paymentKey,
                stripeSessionId: paymentRef || null,
                amount,
                currency: "BRL",
                status: status || "paid",
                customerEmail: normalizedEmail || null,
                paymentMethod: "BLING_LINK",
                paidAt: new Date()
            }
        });
        return;
    }

    await prisma.payment.upsert({
        where: { stripeSessionId: paymentRef },
        update: updateData,
        create: {
            stripePaymentId: null,
            stripeSessionId: paymentRef,
            amount,
            currency: "BRL",
            status: status || "paid",
            customerEmail: normalizedEmail || null,
            paymentMethod: "BLING_LINK",
            paidAt: new Date()
        }
    });
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

        const isPremium = await reconcilePremiumFromStoredPayments(user);

        return res.status(200).json({
            isPremium,
            paymentRequired: !isPremium,
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

        await persistPaymentEvidence({
            email,
            reference,
            paymentId,
            status,
            amount
        });

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
