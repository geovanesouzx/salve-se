// api/pix.js
// Versão SEM BIBLIOTECA (Fetch Nativo)
const crypto = require('crypto');

export default async function handler(req, res) {
    // 1. Permite apenas POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const token = process.env.MP_ACCESS_TOKEN;
        if (!token) {
            throw new Error("Token do Mercado Pago não configurado.");
        }

        const { email, amount } = req.body;
        const valorFinal = Number(parseFloat(amount || 4.90).toFixed(2));
        const emailPagador = (email && email.includes('@')) ? email : 'test_user_123@test.com';
        const idempotencyKey = crypto.randomUUID();

        console.log("Iniciando Fetch para Mercado Pago...");

        // 2. CHAMADA DIRETA PARA A API (Sem usar a biblioteca npm)
        const response = await fetch('https://api.mercadopago.com/v1/payments', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'X-Idempotency-Key': idempotencyKey
            },
            body: JSON.stringify({
                transaction_amount: valorFinal,
                description: 'Salve-se UFRB Premium',
                payment_method_id: 'pix',
                payer: {
                    email: emailPagador
                },
            })
        });

        // 3. Processa a resposta
        const data = await response.json();

        if (!response.ok) {
            console.error("Erro do Mercado Pago:", JSON.stringify(data));
            throw new Error(data.message || "Erro na API do Mercado Pago");
        }

        // 4. Sucesso
        return res.status(200).json({
            id: data.id,
            qr_code: data.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: data.point_of_interaction.transaction_data.qr_code_base64
        });

    } catch (error) {
        console.error("ERRO FATAL:", error);
        return res.status(500).json({ 
            error: "Erro ao processar pagamento",
            details: error.message 
        });
    }
}