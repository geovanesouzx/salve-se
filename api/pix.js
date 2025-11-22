const { MercadoPagoConfig, Payment } = require('mercadopago');
const crypto = require('crypto'); // Nativo do Node.js

export default async function handler(req, res) {
    // 1. Permite apenas POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // 2. Verifica a chave da API
        const token = process.env.MP_ACCESS_TOKEN;
        if (!token) {
            console.error("ERRO: Token não encontrado.");
            throw new Error("Token do Mercado Pago não configurado.");
        }

        // 3. Configura o cliente
        const client = new MercadoPagoConfig({ 
            accessToken: token,
            options: { timeout: 5000 }
        });
        const payment = new Payment(client);

        const { email, amount } = req.body;

        // 4. TRATAMENTO DE DADOS (A parte crítica)
        // Garante que o valor é um número com 2 casas decimais
        const valorFinal = Number(parseFloat(amount || 4.90).toFixed(2));
        
        // Garante um e-mail válido para o teste
        const emailPagador = (email && email.includes('@')) ? email : 'comprador_teste@ufrb.edu.br';

        // Gera um ID único para essa tentativa (Idempotência)
        const idempotencyKey = crypto.randomUUID();

        const body = {
            transaction_amount: valorFinal,
            description: 'Salve-se UFRB Premium',
            payment_method_id: 'pix',
            payer: {
                email: emailPagador
            },
        };

        console.log("Enviando para o Mercado Pago:", JSON.stringify(body));

        // 5. Cria o pagamento com cabeçalho de idempotência
        const requestOptions = {
            idempotencyKey: idempotencyKey
        };

        const result = await payment.create({ body, requestOptions });

        // 6. Sucesso
        return res.status(200).json({
            id: result.id,
            qr_code: result.point_of_interaction.transaction_data.qr_code,
            qr_code_base64: result.point_of_interaction.transaction_data.qr_code_base64
        });

    } catch (error) {
        console.error("ERRO PIX DETALHADO:", JSON.stringify(error, null, 2));
        
        // Retorna o erro de forma que o frontend entenda
        return res.status(500).json({ 
            error: "Erro ao criar Pix",
            details: error.message || JSON.stringify(error)
        });
    }
}