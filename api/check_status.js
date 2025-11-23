export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { id } = req.body;
    const apiKey = process.env.ASAAS_API_KEY;

    try {
        const response = await fetch(`https://api.asaas.com/v3/payments/${id}`, {
            method: 'GET',
            headers: { 'access_token': apiKey }
        });

        const data = await response.json();

        // Verifica se foi pago
        const isPaid = data.status === 'RECEIVED' || data.status === 'CONFIRMED';

        res.status(200).json({ 
            paid: isPaid, 
            status: data.status 
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}