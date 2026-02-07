import { Request, Response } from "express";
import Stripe from "stripe";
import { prisma } from "../../database/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const StripeWebhookController = async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!endpointSecret) {
        console.error("❌ STRIPE_WEBHOOK_SECRET não configurado");
        return res.status(400).send("Webhook secret não configurado");
    }

    let event: Stripe.Event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        console.error("⚠️ Erro na verificação do webhook:", message);
        return res.status(400).send(`Webhook Error: ${message}`);
    }

    try {
        switch (event.type) {
            case "payment_intent.succeeded":
                await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent);
                break;
            
            case "checkout.session.completed":
                await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
                break;

            default:
                console.log(`ℹ️ Evento ignorado: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error: unknown) {
        console.error("❌ Erro ao processar webhook:", error);
        res.status(500).json({ error: "Erro interno do servidor" });
    }
};

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
    console.log("💰 Pagamento confirmado no Stripe:", paymentIntent.id);

    try {
        const sessions = await stripe.checkout.sessions.list({
            payment_intent: paymentIntent.id,
            limit: 1,
        });

        const session = sessions.data[0];
        
        let products = [];
        if (session?.metadata?.products) {
            try {
                products = JSON.parse(session.metadata.products);
            } catch (e) {
                console.error("Erro no parse de produtos:", e);
            }
        }

        let paymentMethod = "unknown";
        if (paymentIntent.payment_method) {
            const pm = await stripe.paymentMethods.retrieve(paymentIntent.payment_method as string);
            paymentMethod = pm.type; 
        }

        const payment = await prisma.payment.create({
            data: {
                stripePaymentId: paymentIntent.id,
                stripeSessionId: session?.id || null,
                amount: paymentIntent.amount / 100,
                currency: paymentIntent.currency.toUpperCase(),
                status: paymentIntent.status,
                paymentMethod: paymentMethod,
                customerEmail: session?.customer_details?.email || null,
                customerName: session?.customer_details?.name || null,
                products: products || undefined,
                paidAt: new Date(),
            },
        });

        console.log("✅ Pagamento registrado no banco:", payment.id);

    } catch (error: unknown) {
        console.error("❌ Erro ao salvar pagamento no banco:", error);
    }
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
    console.log("🛒 Sessão de checkout finalizada:", session.id);
}