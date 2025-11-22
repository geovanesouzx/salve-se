// api/chat.js
// Este código roda escondido no servidor da Vercel!

export default async function handler(req, res) {
    // Só aceita pedidos do tipo POST
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { provider, message, history } = req.body;

    // Configurações (As chaves vêm do cofre da Vercel)
    const GEMINI_KEY = process.env.GEMINI_API_KEY;
    const GROQ_KEY = process.env.GROQ_API_KEY;

    try {
        let resultText = "";

        // --- SE FOR GEMINI ---
        if (provider === 'gemini') {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
            
            // Monta o histórico para o Gemini
            let contents = [];
            if (history) {
                history.forEach(msg => {
                    contents.push({ 
                        role: msg.role === 'user' ? 'user' : 'model', 
                        parts: [{ text: msg.text }] 
                    });
                });
            }
            // Adiciona a mensagem atual
            contents.push({ role: "user", parts: [{ text: message }] });

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: contents,
                    generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            resultText = data.candidates[0].content.parts[0].text;

        // --- SE FOR GROQ (LLAMA) ---
        } else {
            const url = "https://api.groq.com/openai/v1/chat/completions";
            
            // Monta o histórico para o Groq
            let messages = [];
            if (history) {
                history.forEach(msg => {
                    messages.push({ role: msg.role, content: msg.text });
                });
            }
            messages.push({ role: "user", content: message });

            const response = await fetch(url, {
                method: "POST",
                headers: { 
                    "Authorization": `Bearer ${GROQ_KEY}`, 
                    "Content-Type": "application/json" 
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: messages,
                    temperature: 0.1,
                    response_format: { type: "json_object" }
                })
            });

            const data = await response.json();
            if (data.error) throw new Error(data.error.message);
            resultText = data.choices[0].message.content;
        }

        // Devolve a resposta para o seu site
        return res.status(200).json({ text: resultText });

    } catch (error) {
        console.error("Erro na API Vercel:", error);
        return res.status(500).json({ error: error.message });
    }
}