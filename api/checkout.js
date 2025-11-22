import { MercadoPagoConfig, Payment } from 'mercadopago';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const client = new MercadoPagoConfig({ 
            accessToken: process.env.MP_ACCESS_TOKEN 
        });

        const payment = new Payment(client);

        // O email vem do frontend (usuário logado)
        const { email } = req.body;

        const result = await payment.create({
            body: {
                transaction_amount: 4.90,
                description: 'Salve-se UFRB - Premium',
                payment_method_id: 'pix',
                payer: {
                    email: email || 'email_generico@test.com' // Fallback se não tiver email
                },
            }
        });

        // Extrai os dados do PIX da resposta complexa do MP
        const pointOfInteraction = result.point_of_interaction;
        const transactionData = pointOfInteraction.transaction_data;

        return res.status(200).json({
            qr_code: transactionData.qr_code, // Código Copia e Cola
            qr_code_base64: transactionData.qr_code_base64, // Imagem em Base64
            ticket_url: pointOfInteraction.transaction_data.ticket_url // Link do comprovante
        });

    } catch (error) {
        console.error("ERRO PIX:", error);
        return res.status(500).json({ 
            error: 'Erro ao gerar PIX', 
            details: error.message 
        });
    }
}