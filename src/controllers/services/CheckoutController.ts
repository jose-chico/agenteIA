import { Request, Response } from "express";

export const CheckoutController = async (req: Request, res: Response) => {
    try {
        const total = parseFloat(String(req.query.total ?? "0"));

        if (!Number.isFinite(total) || total <= 0) {
            return res.status(400).json({ error: "Total inválido para checkout." });
        }

        const appUrl = (process.env.APP_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
        
        // URL de simulação
        const checkoutUrl = `${appUrl}/pages/confirmacao-pagamento.html?amount=${total.toFixed(2)}&currency=BRL&status=simulated`;

        return res.status(200).json({ 
            message: "Checkout simulado iniciado", 
            url: checkoutUrl, 
            amount: total 
        });
    } catch (error) {
        return res.status(500).json({ error: "Erro ao processar checkout simulado" });
    }
};