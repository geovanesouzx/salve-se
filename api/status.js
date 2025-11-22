const { MercadoPagoConfig, Payment } = require('mercadopago');

export default async function handler(req, res) {
    const { id } = req.query;

    if (!id) return res.status(400).json({ error: 'ID required' });

    try {
        if (!process.env.MP_ACCESS_TOKEN) throw new Error("Token não configurado");

        const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
        const payment = new Payment(client);

        const result = await payment.get({ id });

        return res.status(200).json({ 
            status: result.status 
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}