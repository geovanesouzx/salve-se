// api/checkout.js
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const ASAAS_API_URL = 'https://www.asaas.com/api/v3'; 
    const API_KEY = process.env.ASAAS_API_KEY;

    if (!API_KEY) {
        return res.status(500).json({ error: 'Chave de API não configurada na Vercel' });
    }

    try {
        const { name, email, cpf } = req.body;

        // 1. TENTAR CRIAR O CLIENTE
        const customerResponse = await fetch(`${ASAAS_API_URL}/customers`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': API_KEY
            },
            body: JSON.stringify({
                name: name || 'Estudante Salve-se',
                email: email,
                cpfCnpj: cpf, // Opcional
                notificationDisabled: true // Para não encher o email do aluno de spam do Asaas
            })
        });

        const customerData = await customerResponse.json();
        let customerId = customerData.id;

        // SE O CLIENTE JÁ EXISTIR (Erro de email duplicado)
        if (customerData.errors && customerData.errors[0].code === 'CUSTOMER_EMAIL_ALREADY_EXISTS') {
             // Buscamos o ID desse cliente pelo email
             const searchResponse = await fetch(`${ASAAS_API_URL}/customers?email=${email}`, {
                headers: { 'access_token': API_KEY }
             });
             const searchData = await searchResponse.json();
             if (searchData.data && searchData.data.length > 0) {
                 customerId = searchData.data[0].id;
             }
        } else if (customerData.errors) {
            throw new Error(customerData.errors[0].description);
        }

        if (!customerId) throw new Error("Falha ao identificar cliente no Asaas");

        // 2. CRIAR A COBRANÇA PIX
        const paymentBody = {
            customer: customerId,
            billingType: 'PIX',
            value: 5.00, // Valor da assinatura
            dueDate: new Date().toISOString().split('T')[0], // Vence hoje
            description: 'Assinatura Premium - Salve-se UFRB',
            postalService: false
        };

        const paymentResponse = await fetch(`${ASAAS_API_URL}/payments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': API_KEY
            },
            body: JSON.stringify(paymentBody)
        });

        const paymentData = await paymentResponse.json();

        if (paymentData.errors) {
            throw new Error(paymentData.errors[0].description);
        }

        // Retorna o link da fatura (invoiceUrl) que já abre o QR Code
        return res.status(200).json({ init_point: paymentData.invoiceUrl });

    } catch (error) {
        console.error("Erro Asaas:", error);
        return res.status(500).json({ error: error.message });
    }
}