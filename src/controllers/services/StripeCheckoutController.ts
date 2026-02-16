import { Request, Response } from "express";
import Stripe from "stripe";

// Helper: Converte valores monetários para número
function parsePrice(input: unknown): number {
    if (typeof input === "number") return input;
    if (typeof input === "string") {
        const cleaned = input.replace(/[^\d.,-]/g, "").replace(",", ".");
        const num = parseFloat(cleaned);
        return Number.isFinite(num) ? num : 0;
    }
    return 0;
}

export const StripeCheckoutController = async (req: Request, res: Response) => {
    try {
        const secretKey = process.env.STRIPE_SECRET_KEY;
        if (!secretKey) {
            return res.status(500).json({ message: "Stripe não configurado no .env." });
        }

        const stripe = new Stripe(secretKey, {
            apiVersion: "2023-10-16" as Stripe.StripeConfig["apiVersion"]
        });
        
        const total = parsePrice(req.query.total);

        if (total <= 0) {
            return res.status(400).json({ message: "Total inválido ou zerado." });
        }

        const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
        const successUrl = `${appUrl}/pages/confirmacao-pagamento.html?session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${appUrl}/pages/checkout.html`;

        const session = await stripe.checkout.sessions.create({
            mode: "payment",
            payment_method_types: ["card", "pix", "boleto"],
            locale: "pt-BR",
            line_items: [
                {
                    price_data: {
                        currency: "brl",
                        product_data: { 
                            name: "Assinatura/Créditos - Chat System",
                            description: "Acesso aos recursos premium do chat"
                        },
                        unit_amount: Math.round(total * 100),
                    },
                    quantity: 1,
                },
            ],
            success_url: successUrl,
            cancel_url: cancelUrl,
        });

        return res.status(200).json({ url: session.url });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Erro desconhecido no Stripe";
        return res.status(500).json({ message: errorMessage });
    }
};

export const StripeCheckoutControllerPost = async (req: Request, res: Response) => {
    try {
        return res.status(200).json({ message: "Rota POST pronta para implementação de metadata." });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : "Erro interno";
        return res.status(500).json({ message: errorMessage });
    }
};