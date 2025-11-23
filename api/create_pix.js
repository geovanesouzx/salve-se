export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { email, name, cpf } = req.body; // Opcional: receber dados do user
    const apiKey = process.env.ASAAS_API_KEY; // Pega da Vercel

    try {
        // 1. Criar/Buscar Cliente no Asaas (Simplificado: Cria um novo sempre para garantir)
        const customerResponse = await fetch('https://api.asaas.com/v3/customers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'access_token': apiKey
            },
            body: JSON.stringify({
                name: name || "Estudante UFRB",
                email: email || "email@ufrb.edu.br"
            })
        });
        
        const customerData = await customerResponse.json();
        if (!customerData.id) throw new Error('Erro ao criar cliente no Asaas');

        // 2. Criar a Cobrança PIX
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
                dueDate: new Date().toISOString().split('T')[0], // Vence hoje
                description: "Assinatura Salve-se UFRB Premium (30 Dias)"
            })
        });

        const paymentData = await paymentResponse.json();
        if (!paymentData.id) throw new Error('Erro ao criar cobrança');

        // 3. Pegar o QR Code e Copia e Cola
        const qrResponse = await fetch(`https://api.asaas.com/v3/payments/${paymentData.id}/pixQrCode`, {
            method: 'GET',
            headers: { 'access_token': apiKey }
        });

        const qrData = await qrResponse.json();

        // Retorna tudo para o Frontend
        res.status(200).json({
            id: paymentData.id,
            payload: qrData.payload,
            encodedImage: qrData.encodedImage
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
}