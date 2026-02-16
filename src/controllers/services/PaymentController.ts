import { Request, Response } from "express";
import { prisma } from "../../database/client";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const GetPaymentBySessionController = async (req: Request, res: Response) => {
    try {
        const { session_id } = req.params;

        if (!session_id) {
            return res.status(400).json({ error: "O session_id é obrigatório." });
        }

        // 1. Busca no Banco Local (Mudado para 'const' para satisfazer o ESLint)
        const payment = await prisma.payment.findFirst({ 
            where: { stripeSessionId: session_id } 
        });

        // 2. Se não achou no banco, busca a sessão "ao vivo" no Stripe
        if (!payment) {
            const session = await stripe.checkout.sessions.retrieve(session_id);
            
            return res.json({
                status: session.payment_status === "paid" ? "succeeded" : "pending",
                customerEmail: session.customer_details?.email,
                amount: (session.amount_total || 0) / 100,
                currency: (session.currency || "BRL").toUpperCase()
            });
        }

        // 3. Se achou no banco, retorna o registro completo
        return res.json(payment);

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Erro desconhecido";
        console.error("[GetPaymentBySession] Erro:", message);
        
        return res.status(404).json({ 
            error: "Pagamento não localizado.",
            details: message 
        });
    }
};