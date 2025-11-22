// api/checkout.js
// Versão compatível (CommonJS) para evitar erro de PolicyAgent

const { MercadoPagoConfig, Preference } = require('mercadopago');

export default async function handler(req, res) {
    // 1. Segurança: Só aceita POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 2. Verifica se a chave existe
        if (!process.env.MP_ACCESS_TOKEN) {
            console.error("ERRO: MP_ACCESS_TOKEN não encontrado nas variáveis.");
            throw new Error("Token do Mercado Pago não configurado.");
        }

        // 3. Configura o Mercado Pago
        const client = new MercadoPagoConfig({ 
            accessToken: process.env.MP_ACCESS_TOKEN 
        });

        const preference = new Preference(client);

        // 4. Cria a cobrança
        const result = await preference.create({
            body: {
                items: [
                    {
                        id: 'salve-se-pro',
                        title: 'Salve-se UFRB - Premium',
                        quantity: 1,
                        unit_price: 4.90,
                        currency_id: 'BRL',
                        description: 'Assinatura mensal com recursos de IA ilimitados.'
                    }
                ],
                back_urls: {
                    success: 'https://salve-se-ufrb.vercel.app/?status=success',
                    failure: 'https://salve-se-ufrb.vercel.app/?status=failure',
                    pending: 'https://salve-se-ufrb.vercel.app/?status=pending'
                },
                auto_return: 'approved',
            }
        });

        // 5. Sucesso! Devolve o link
        return res.status(200).json({ url: result.init_point });

    } catch (error) {
        console.error("ERRO NO CHECKOUT:", error);
        // Retorna o erro para o console do navegador (F12) pra gente ver se der pau
        return res.status(500).json({ 
            error: error.message || 'Erro interno no servidor',
            details: error.cause || null
        });
    }
}