// api/webhook.js
import * as admin from 'firebase-admin';

// Inicializa o Firebase com a "Chave Mestra" que você salvou na Vercel
if (!admin.apps.length) {
    try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CONFIG);
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    } catch (error) {
        console.error("Erro na chave do Firebase Admin:", error);
    }
}

const db = admin.firestore();

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { event, payment } = req.body;
    const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

    // Filtra apenas os eventos de pagamento confirmado/recebido
    if (event === 'PAYMENT_CONFIRMED' || event === 'PAYMENT_RECEIVED') {
        try {
            console.log(`💰 Pagamento recebido! ID: ${payment.id}, Cliente: ${payment.customer}`);

            // 1. O Asaas manda o ID do cliente, precisamos pegar o E-mail dele
            const customerReq = await fetch(`https://www.asaas.com/api/v3/customers/${payment.customer}`, {
                headers: { 'access_token': ASAAS_API_KEY }
            });
            
            const customerData = await customerReq.json();
            const userEmail = customerData.email;

            if (!userEmail) {
                console.error("E-mail não encontrado no cadastro do Asaas.");
                return res.status(200).json({ received: true }); // Retorna 200 pro Asaas não ficar tentando de novo
            }

            console.log(`📧 Buscando usuário no Firebase com email: ${userEmail}`);

            // 2. Busca o usuário no seu Banco de Dados pelo Email
            const usersRef = db.collection('users');
            const snapshot = await usersRef.where('email', '==', userEmail).get();

            if (snapshot.empty) {
                console.error('❌ Usuário não encontrado no Firebase.');
                return res.status(200).json({ received: true });
            }

            // 3. Ativa o Premium para esse usuário
            const batch = db.batch();
            snapshot.forEach(doc => {
                const userRef = usersRef.doc(doc.id);
                batch.update(userRef, { 
                    isPremium: true,
                    premiumSince: new Date().toISOString(),
                    paymentId: payment.id,
                    plan: 'pro_monthly'
                });
            });

            await batch.commit();
            console.log('✅ SUCESSO! Premium ativado automaticamente.');

        } catch (error) {
            console.error("🚨 Erro no processamento:", error);
            return res.status(500).json({ error: error.message });
        }
    }

    // Responde pro Asaas que recebeu o aviso
    return res.status(200).json({ received: true });
}