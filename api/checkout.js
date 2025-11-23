import { MercadoPagoConfig, Preference } from 'mercadopago';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
        const preference = new Preference(client);
        const origin = req.headers.origin || 'https://salve-se-ufrb.vercel.app';

        // RECEBE OS DADOS DO FRONTEND
        const { email, name, surname } = req.body;

        // Separa nome e sobrenome se vier tudo junto
        const nameParts = name ? name.split(' ') : ['Estudante'];
        const firstName = nameParts[0];
        const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : 'UFRB';

        const body = {
            items: [
                {
                    id: 'premium_mensal',
                    title: 'Salve-se UFRB Premium',
                    description: 'Acesso ilimitado a IA, Temas e Backup',
                    picture_url: 'https://files.catbox.moe/pmdtq6.png',
                    quantity: 1,
                    currency_id: 'BRL',
                    unit_price: 4.90
                }
            ],
            // INSERE OS DADOS DO ALUNO AQUI
            payer: {
                name: firstName,
                surname: lastName,
                email: email
            },
            back_urls: {
                success: `${origin}/?status=success`,
                failure: `${origin}/?status=failure`,
                pending: `${origin}/?status=pending`
            },
            auto_return: 'approved',
            payment_methods: {
                excluded_payment_types: [
                    { id: "ticket" }
                ],
                installments: 1
            }
        };

        const result = await preference.create({ body });
        return res.status(200).json({ init_point: result.init_point });

    } catch (error) {
        console.error("Erro MP:", error);
        return res.status(500).json({ error: error.message });
    }
}