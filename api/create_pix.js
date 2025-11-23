export default async function handler(req, res) {
    // CORS Headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { email, name, cpf } = req.body; // <--- RECEBENDO O CPF AQUI
    const apiKey = process.env.ASAAS_API_KEY; 

    if (!apiKey) {
        return res.status(500).json({ error: 'API Key não configurada.' });
    }

    try {
        // 1. Criar/Buscar Cliente COM CPF
        const customerResponse = await fetch('https://api.asaas.com/v3/customers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': apiKey
            },
            body: JSON.stringify({
                name: name || "Estudante UFRB",
                email: email || "email@ufrb.edu.br",
                cpfCnpj: cpf // <--- ENVIANDO O CPF PARA O ASAAS
            })
        });
        
        const customerData = await customerResponse.json();
        
        if (!customerData.id) {
            // Se o erro for CPF inválido, retornamos legível
            const errorMsg = customerData.errors ? customerData.errors[0].description : 'Erro ao cadastrar cliente';
            throw new Error(`Asaas Cliente: ${errorMsg}`);
        }

        // 2. Criar a Cobrança
        const paymentResponse = await fetch('https://api.asaas.com/v3/payments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': apiKey
            },
            body: JSON.stringify({
                customer: customerData.id,
                billingType: "PIX",
                value: 6.00,
                dueDate: new Date().toISOString().split('T')[0], 
                description: "Assinatura Premium Salve-se UFRB"
            })
        });

        const paymentData = await paymentResponse.json();

        if (!paymentData.id) {
            const errorMsg = paymentData.errors ? paymentData.errors[0].description : 'Erro ao criar cobrança';
            throw new Error(`Asaas Pagamento: ${errorMsg}`);
        }

        // 3. Pegar QR Code
        const qrResponse = await fetch(`https://api.asaas.com/v3/payments/${paymentData.id}/pixQrCode`, {
            method: 'GET',
            headers: { 'access_token': apiKey }
        });

        const qrData = await qrResponse.json();

        res.status(200).json({
            id: paymentData.id,
            payload: qrData.payload,
            encodedImage: qrData.encodedImage
        });

    } catch (error) {
        console.error("Erro Backend:", error);
        res.status(500).json({ error: error.message });
    }
}