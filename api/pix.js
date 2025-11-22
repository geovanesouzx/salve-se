const { MercadoPagoConfig, Payment } = require('mercadopago');
const crypto = require('crypto');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const token = process.env.MP_ACCESS_TOKEN;
        if (!token) throw new Error("Token não configurado.");

        const client = new MercadoPagoConfig({ accessToken: token });
        const payment = new Payment(client);

        const { email, amount } = req.body;

        // O segredo para não dar erro 500:
        // 1. Email diferente do dono da conta
        // 2. Valor numérico exato
        const body = {
            transaction_amount: Number(parseFloat(amount || 4.90).toFixed(2)),
            description: 'Salve-se UFRB Premium',
            payment_method_id: 'pix',
            payer: {
                email: (email && email.includes('@')) ? email : 'test_user_123@test.com'
            },
        };

        const requestOptions = { idempotencyKey: crypto.randomUUID() };
        const result = await payment.create({ body, requestOptions });

        return res.status(200).json({
            id: result.id,
            qr_code: result.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64
        });

    } catch (error) {
        console.error("Erro Pix:", error);
        return res.status(500).json({ error: error.message, details: error });
    }
}