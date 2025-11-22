// api/pix.js
const { MercadoPagoConfig, Payment } = require('mercadopago');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
        const payment = new Payment(client);

        const { email, amount } = req.body;

        const body = {
            transaction_amount: Number(amount) || 4.90,
            description: 'Salve-se UFRB - Premium',
            payment_method_id: 'pix',
            payer: {
                email: email || 'email@teste.com' // O MP exige um email
            },
        };

        // Cria o pagamento específico de PIX
        const result = await payment.create({ body });

        // Retorna os dados do QR Code
        return res.status(200).json({
            id: result.id,
            qr_code: result.point_of_interaction.transaction_data.qr_code, // Código Copia e Cola
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64 // Imagem
        });

    } catch (error) {
        console.error("Erro PIX:", error);
        return res.status(500).json({ error: error.message });
    }
}