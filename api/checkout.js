// api/checkout.js
import { MercadoPagoConfig, Preference } from 'mercadopago';

export default async function handler(req, res) {
    // A Vercel exige que respondamos apenas a POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Inicializa o MP com a chave segura que está na Vercel
        const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
        const preference = new Preference(client);

        // Pega a URL do site dinamicamente (funciona em localhost e produção)
        // Se der erro, substitua pela URL fixa: 'https://salve-se-ufrb.vercel.app'
        const origin = req.headers.origin || 'https://salve-se-ufrb.vercel.app';

        const body = {
            items: [
                {
                    id: 'premium_mensal',
                    title: 'Salve-se UFRB Premium',
                    description: 'Acesso ilimitado a IA, Temas e Backup',
                    picture_url: 'https://files.catbox.moe/pmdtq6.png',
                    quantity: 1,
                    currency_id: 'BRL',
                    unit_price: 4.90 // O PREÇO AQUI
                }
            ],
            back_urls: {
                success: `${origin}/?status=success`,
                failure: `${origin}/?status=failure`,
                pending: `${origin}/?status=pending`
            },
            auto_return: 'approved',
        };

        const result = await preference.create({ body });

        // Retorna o link para o Frontend
        return res.status(200).json({ init_point: result.init_point });

    } catch (error) {
        console.error("Erro MP:", error);
        return res.status(500).json({ error: error.message });
    }
}