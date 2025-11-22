// Usamos 'require' para evitar erros de módulo na Vercel
const { MercadoPagoConfig, Payment } = require('mercadopago');

export default async function handler(req, res) {
    // 1. CORS e Método
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 2. Debug: Verifica se a chave existe
        if (!process.env.MP_ACCESS_TOKEN) {
            throw new Error("Token do Mercado Pago (MP_ACCESS_TOKEN) não encontrado nas variáveis de ambiente.");
        }

        // 3. Configuração
        const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
        const payment = new Payment(client);

        const { email, amount } = req.body;

        // 4. Criação do Pagamento
        const paymentData = {
            transaction_amount: Number(amount) || 4.90,
            description: 'Salve-se UFRB - Premium',
            payment_method_id: 'pix',
            payer: {
                // Garante um email válido para teste se vier vazio ou for o mesmo da conta
                email: (email && email.includes('@')) ? email : `user_test_${Date.now()}@test.com`,
                first_name: 'Aluno',
                last_name: 'UFRB'
            },
        };

        const result = await payment.create({ body: paymentData });

        // 5. Resposta
        if (result && result.point_of_interaction) {
            return res.status(200).json({
                id: result.id,
                qr_code: result.point_of_interaction.transaction_data.qr_code,
                qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64
            });
        } else {
            console.error("Resposta estranha do MP:", result);
            throw new Error("O Mercado Pago não retornou o QR Code.");
        }

    } catch (error) {
        console.error("ERRO FATAL NO BACKEND:", error);
        // Retorna o erro detalhado para você ver no Console do navegador
        return res.status(500).json({ 
            error: error.message || "Erro interno",
            details: error.cause || "Sem detalhes"
        });
    }
}