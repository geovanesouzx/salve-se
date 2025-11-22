import { MercadoPagoConfig, Preference } from 'mercadopago';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // 1. Configuração (Pegamos a chave das variáveis de ambiente)
    const client = new MercadoPagoConfig({ 
        accessToken: process.env.MP_ACCESS_TOKEN 
    });

    try {
        // 2. Cria a preferência de compra
        const preference = new Preference(client);

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
                    // Para onde o usuário volta depois de pagar
                    success: 'https://salve-se-ufrb.vercel.app/?status=success',
                    failure: 'https://salve-se-ufrb.vercel.app/?status=failure',
                    pending: 'https://salve-se-ufrb.vercel.app/?status=pending'
                },
                auto_return: 'approved',
            }
        });

        // 3. Devolve o link de pagamento para o frontend
        return res.status(200).json({ url: result.init_point });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: 'Erro ao criar pagamento' });
    }
}