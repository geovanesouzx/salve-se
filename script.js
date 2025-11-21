// ============================================================
// --- CONFIGURAÇÃO FIREBASE & IMPORTAÇÕES ---
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signOut, 
    updateProfile, 
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
    deleteDoc, 
    onSnapshot, 
    enableIndexedDbPersistence 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyD5Ggqw9FpMS98CHcfXKnghMQNMV5WIVTw",
  authDomain: "salvee-se.firebaseapp.com",
  projectId: "salvee-se",
  storageBucket: "salvee-se.firebasestorage.app",
  messagingSenderId: "132544174908",
  appId: "1:132544174908:web:00c6aa4855cc18ed2cdc39"
};

// Configuração da IA (Gemini)
const apiKey = "AIzaSyAZgpqT4iz9NgLzpYJsIvc4tgeaJ1qHUaI"; 
const GEMINI_MODEL = "gemini-2.5-flash-preview-09-2025";
const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Tenta habilitar persistência offline
try {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code === 'failed-precondition') {
            console.warn("Persistência falhou: Múltiplas abas abertas.");
        } else if (err.code === 'unimplemented') {
            console.warn("O navegador não suporta persistência.");
        }
    });
} catch (e) { 
    console.log("Persistência já ativa ou não suportada"); 
}

// ============================================================
// --- VARIÁVEIS GLOBAIS ---
// ============================================================
let currentUser = null;
let userProfile = null;
let unsubscribeData = null;
let scheduleData = JSON.parse(localStorage.getItem('salvese_schedule')) || [];
let tasksData = JSON.parse(localStorage.getItem('salvese_tasks')) || [];
let remindersData = JSON.parse(localStorage.getItem('salvese_reminders')) || [];
let selectedClassIdToDelete = null;
let currentTaskFilter = 'all'; 
let chatHistory = []; 
let currentViewContext = 'home'; 

// ============================================================
// --- ÍCONES SVG ---
// ============================================================
const svgs = {
    photo: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
    user: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
    at: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94"/></svg>`,
    school: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>`,
    lock: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    cloud: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19c0-3.037-2.463-5.5-5.5-5.5S6.5 15.963 6.5 19"/><path d="M12 13.5V4"/><path d="M7 9l5-5 5 5"/></svg>`,
    logout: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>`,
    chevron: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`,
    ai: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10H12V2z"/><path d="M12 2a10 10 0 0 1 10 10"/><path d="M12 12L2 12"/><path d="M12 12L12 22"/></svg>`
};

// ============================================================
// --- SISTEMA DE BOOTSTRAP E AUTH ---
// ============================================================

const sessionActive = localStorage.getItem('salvese_session_active');

const forceLoadTimeout = setTimeout(() => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
        console.warn("Firebase demorou. Verificando modo offline...");
        if (sessionActive === 'true') {
            loadAppOfflineMode(); 
        } else {
            showLoginScreen();
        }
    }
}, 3000); 

onAuthStateChanged(auth, async (user) => {
    clearTimeout(forceLoadTimeout);

    if (user) {
        console.log("Usuário autenticado.");
        currentUser = user;
        localStorage.setItem('salvese_session_active', 'true');

        try {
            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef); 

            if (docSnap.exists()) {
                userProfile = docSnap.data();
                if (!userProfile.semester) userProfile.semester = "N/A";
                localStorage.setItem('salvese_user_profile', JSON.stringify(userProfile));
                showAppInterface(); 
                initRealtimeSync(user.uid); 
            } else {
                showProfileSetupScreen();
            }
        } catch (e) {
            console.error("Erro ao buscar perfil:", e);
            if (sessionActive === 'true') loadAppOfflineMode();
            else showProfileSetupScreen();
        }

    } else {
        currentUser = null;
        userProfile = null;
        if(unsubscribeData) unsubscribeData();

        if (sessionActive === 'true' && !navigator.onLine) {
            loadAppOfflineMode();
        } else {
            localStorage.removeItem('salvese_session_active');
            showLoginScreen();
        }
    }
});

function loadAppOfflineMode() {
    const savedProfile = localStorage.getItem('salvese_user_profile');
    if (savedProfile) {
        userProfile = JSON.parse(savedProfile);
    } else {
        userProfile = { displayName: 'Modo Offline', handle: 'offline', semester: 'N/A' };
    }
    showAppInterface();
}

// ============================================================
// --- GERENCIAMENTO DE TELAS (VIEW) ---
// ============================================================

function showAppInterface() {
    const loginScreen = document.getElementById('login-screen');
    const profileScreen = document.getElementById('profile-setup-screen');
    const appContent = document.querySelector('.app-content-wrapper');
    const loadingScreen = document.getElementById('loading-screen');

    if(loginScreen) loginScreen.classList.add('hidden');
    if(profileScreen) profileScreen.classList.add('hidden');
    if(appContent) appContent.classList.remove('hidden');

    updateUserInterfaceInfo();
    refreshAllUI();

    if(loadingScreen && !loadingScreen.classList.contains('hidden')) {
        loadingScreen.classList.add('opacity-0');
        setTimeout(() => loadingScreen.classList.add('hidden'), 500);
    }
}

function showLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    const profileScreen = document.getElementById('profile-setup-screen');
    const appContent = document.querySelector('.app-content-wrapper');
    const loadingScreen = document.getElementById('loading-screen');

    if(loginScreen) loginScreen.classList.remove('hidden');
    if(profileScreen) profileScreen.classList.add('hidden');
    if(appContent) appContent.classList.add('hidden');

    if(loadingScreen && !loadingScreen.classList.contains('hidden')) {
        loadingScreen.classList.add('opacity-0');
        setTimeout(() => loadingScreen.classList.add('hidden'), 500);
    }
}

function showProfileSetupScreen() {
    const loginScreen = document.getElementById('login-screen');
    const profileScreen = document.getElementById('profile-setup-screen');
    const appContent = document.querySelector('.app-content-wrapper');
    const loadingScreen = document.getElementById('loading-screen');

    if(loginScreen) loginScreen.classList.add('hidden');
    if(profileScreen) profileScreen.classList.remove('hidden');
    if(appContent) appContent.classList.add('hidden');
    if(loadingScreen) loadingScreen.classList.add('hidden');
}

window.switchPage = function(pageId, addToHistory = true) {
    currentViewContext = pageId;

    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    const target = document.getElementById(`view-${pageId}`);
    if (target) target.classList.remove('hidden');

    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeLink = document.getElementById(`nav-${pageId}`);
    if (activeLink) activeLink.classList.add('active');

    const mobileNavLinks = document.querySelectorAll('#mobile-menu nav a');
    mobileNavLinks.forEach(link => {
        link.classList.remove('bg-indigo-50', 'text-indigo-600', 'dark:bg-indigo-900/50', 'dark:text-indigo-300');
        link.classList.add('text-gray-600', 'dark:text-gray-400');

        if(link.getAttribute('onclick') && link.getAttribute('onclick').includes(`'${pageId}'`)) {
             link.classList.add('bg-indigo-50', 'text-indigo-600', 'dark:bg-indigo-900/50', 'dark:text-indigo-300');
             link.classList.remove('text-gray-600', 'dark:text-gray-400');
        }
    });

    const titles = { 
        home: 'Página Principal', 
        onibus: 'Transporte', 
        calc: 'Calculadora', 
        pomo: 'Modo Foco', 
        todo: 'Tarefas', 
        email: 'Templates', 
        aulas: 'Grade Horária', 
        config: 'Configurações',
        ia: 'Salve-se IA'
    };
    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) pageTitleEl.innerText = titles[pageId] || 'Salve-se UFRB';
    
    if(pageId === 'aulas' && window.renderSchedule) window.renderSchedule();
    if(pageId === 'config' && window.renderSettings) window.renderSettings();
    
    if(pageId === 'ia') {
        const chatContainer = document.getElementById('chat-messages-container');
        if(chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    if(addToHistory) {
        history.pushState({view: pageId}, null, `#${pageId}`);
    }
}

// ============================================================
// --- INTEGRAÇÃO SALVE-SE IA (SUPERSYSTEM) ---
// ============================================================

window.sendIAMessage = async function() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    const container = document.getElementById('chat-messages-container');
    const sendBtn = document.getElementById('chat-send-btn');
    // A referência fixa ao indicador é removida aqui para ser tratada dinamicamente

    if (!message) return;

    // Adiciona mensagem do usuário
    appendMessage('user', message);
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;
    
    // Scroll imediato
    if(container) container.scrollTop = container.scrollHeight;

    // Mostrar indicador de digitação no FINAL da lista
    showTypingIndicator();

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const fetchWithRetry = async (url, options, retries = 3, backoff = 1000) => {
        try {
            const res = await fetch(url, options);
            if (!res.ok) {
                // Se for erro 429 (Too Many Requests), não adianta retentar muito rápido
                if (res.status === 429) {
                    throw new Error("Limite de requisições atingido (429). Tente novamente em instantes.");
                }
                if (res.status >= 500 && retries > 0) {
                    await delay(backoff);
                    return fetchWithRetry(url, options, retries - 1, backoff * 2);
                }
                throw new Error(`Erro HTTP: ${res.status}`);
            }
            return res.json();
        } catch (err) {
            if (retries > 0 && !err.message.includes("429")) {
                await delay(backoff);
                return fetchWithRetry(url, options, retries - 1, backoff * 2);
            }
            throw err;
        }
    };

    try {
        // Contexto Expandido para a IA (Estado Global)
        const contextData = {
            telaAtual: currentViewContext,
            dataAtual: new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }),
            user: userProfile ? userProfile.displayName : 'Usuário',
            tarefas: tasksData.map(t => ({ id: t.id, text: t.text, done: t.done, priority: t.priority })),
            aulas: scheduleData.map(c => ({ id: c.id, name: c.name, day: c.day, start: c.start, room: c.room })),
            lembretes: remindersData,
            timerStatus: { isRunning: isRunning1, timeLeft: timeLeft1, mode: currentMode1 },
            theme: localStorage.getItem('theme') || 'light'
        };

        // Prompt de Sistema Massivo com 50+ Funções
        let systemInstructionText = `
Você é a "Salve-se IA", o sistema operacional inteligente do estudante da UFRB.
Seu objetivo é controlar o aplicativo e ajudar o estudante.

CONTEXTO ATUAL:
${JSON.stringify(contextData)}

INSTRUÇÃO DE SAÍDA:
Se o usuário pedir para realizar uma ação, responda ESTRITAMENTE com um JSON.
Se for apenas conversa, responda com texto.

LISTA DE COMANDOS JSON (action e params):

-- TAREFAS --
1. "create_task" -> { "text": "...", "priority": "low|normal|medium|high", "category": "geral|estudo|trabalho" }
2. "delete_task" -> { "taskId": "ID" } (ou fuzzy search pelo texto)
3. "task_complete" -> { "taskId": "ID" }
4. "task_incomplete" -> { "taskId": "ID" }
5. "task_clear_completed" -> {}
6. "task_filter_change" -> { "filter": "all|active|completed" }
7. "task_get_summary" -> {} (Responda com texto analisando as tarefas)

-- AULAS --
8. "create_class" -> { "name": "...", "day": "seg|ter...", "start": "HH:MM", "end": "HH:MM", "room": "...", "prof": "..." }
9. "delete_class" -> { "classId": "ID" }
10. "class_next_info" -> {} (Analise as aulas e diga qual a próxima em texto)
11. "class_clear_day" -> { "day": "seg" }

-- CALCULADORA --
12. "navigate" -> { "page": "calc" } (Use para levar à calc)
13. "calc_add_grade" -> { "grade": number, "weight": number }
14. "calc_reset" -> {}
15. "calc_set_passing" -> { "val": number }

-- POMODORO --
16. "timer_start" -> {}
17. "timer_pause" -> {}
18. "timer_stop" -> {}
19. "timer_set_mode" -> { "mode": "pomodoro|short|long" }

-- UI & NAVEGAÇÃO --
20. "navigate" -> { "page": "home|aulas|onibus|todo|pomo|calc|email|config|ia" }
21. "ui_theme_toggle" -> {}
22. "ui_color_set" -> { "color": "indigo|red|green|blue|orange|pink|purple|teal|black" }
23. "ui_clock_toggle" -> {}
24. "nav_modal_open" -> { "modal": "profile|class|reminder" }
25. "ui_toast_show" -> { "msg": "..." }

-- ÔNIBUS --
26. "navigate" -> { "page": "onibus" }
27. "bus_next_info" -> {} (Retorne texto com estimativa)

-- LINKS UFRB --
28. "ufrb_portal" -> {} (Abre SIGAA)
29. "ufrb_ava" -> {} (Abre Moodle)
30. "ufrb_calendar" -> {}
31. "ufrb_library" -> {}

-- EMAILS --
32. "navigate" -> { "page": "email" }
33. "email_load_template" -> { "key": "deadline|review|absence|tcc" }
34. "email_copy" -> {}
35. "email_clear" -> {}

-- PERFIL & SISTEMA --
36. "profile_edit_name" -> {}
37. "profile_edit_handle" -> {}
38. "profile_photo_upload" -> {}
39. "system_backup" -> {}
40. "system_logout" -> {}
41. "system_reset_password" -> {}

-- LEMBRETES --
42. "create_reminder" -> { "desc": "...", "date": "YYYY-MM-DD", "prio": "low|medium|high" }
43. "delete_reminder" -> { "id": "ID" }

-- UTILITÁRIOS --
44. "util_roll_dice" -> {}
45. "util_coin_flip" -> {}
46. "easter_egg_confetti" -> {}
47. "ai_clear_chat" -> {}
        `;

        const contents = [];
        if (chatHistory.length > 0) {
            let expectingRole = 'user';
            for (const msg of chatHistory) {
                if (msg.role === expectingRole) {
                    contents.push({ role: msg.role === 'user' ? 'user' : 'model', parts: [{ text: msg.text }] });
                    expectingRole = expectingRole === 'user' ? 'model' : 'user';
                }
            }
        }
        if (contents.length > 0 && contents[contents.length - 1].role === 'user') contents.pop(); 
        contents.push({ role: "user", parts: [{ text: message }] });

        const data = await fetchWithRetry(GEMINI_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: contents,
                systemInstruction: { parts: [{ text: systemInstructionText }] },
                generationConfig: { temperature: 0.4, maxOutputTokens: 800 }
            })
        });
        
        if (data.error) throw new Error(data.error.message || "Erro na API Gemini");
        if (!data.candidates || !data.candidates[0].content) throw new Error("Sem resposta.");

        let aiResponseText = data.candidates[0].content.parts[0].text.trim();
        // Tratamento para remover blocos de código Markdown se a IA colocar
        aiResponseText = aiResponseText.replace(/```json\n/g, '').replace(/\n```/g, '');

        if (aiResponseText.startsWith('{') && aiResponseText.endsWith('}')) {
            try {
                const command = JSON.parse(aiResponseText);
                await executeAICommand(command);
            } catch (e) {
                console.error("Erro ao processar comando IA:", e);
                appendMessage('ai', "Tentei realizar uma ação, mas me confundi nos dados. Pode repetir?");
            }
        } else {
            appendMessage('ai', aiResponseText);
        }

    } catch (error) {
        console.error("Erro IA:", error);
        let msg = "Ops! Tive um problema técnico.";
        if(error.message.includes("API key")) msg = "Chave de API inválida.";
        if(error.message.includes("429")) msg = "⚠️ Limite de uso da IA atingido (429). Aguarde um pouco.";
        if(error.message.includes("500")) msg = "⚠️ Instabilidade no servidor da IA (500).";
        appendMessage('ai', msg);
    } finally {
        // Remover indicador de digitação
        hideTypingIndicator();
        input.disabled = false;
        sendBtn.disabled = false;
        input.focus();
        if(container) container.scrollTop = container.scrollHeight;
    }
};

// ============================================================
// --- AUXILIARES DE CHAT (INDICADOR DE DIGITAÇÃO & UI) ---
// ============================================================

function showTypingIndicator() {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    // Remove se já existir (para garantir que vá para o final)
    hideTypingIndicator();

    const div = document.createElement('div');
    div.id = 'dynamic-typing-indicator';
    div.className = 'flex gap-2 max-w-[90%] animate-fade-in-up mt-2';
    div.innerHTML = `
        <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white text-xs shadow-sm mt-auto mb-1">
            <i class="fas fa-robot animate-pulse"></i>
        </div>
        <div class="bg-white dark:bg-darkcard border border-gray-200 dark:border-darkborder rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center gap-1">
            <div class="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce"></div>
            <div class="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
            <div class="w-1.5 h-1.5 bg-gray-400 dark:bg-gray-500 rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function hideTypingIndicator() {
    const existing = document.getElementById('dynamic-typing-indicator');
    if (existing) existing.remove();
}

function appendMessage(sender, text) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    chatHistory.push({ role: sender, text: text });
    if (chatHistory.length > 20) chatHistory.shift();

    const div = document.createElement('div');
    div.className = `flex w-full ${sender === 'user' ? 'justify-end' : 'justify-start'} mb-4 animate-scale-in group`;
    
    // Horário da mensagem
    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const formattedText = text.replace(/\n/g, '<br>');

    if (sender === 'user') {
        div.innerHTML = `
            <div class="flex flex-col items-end max-w-[85%]">
                <div class="bg-indigo-600 text-white rounded-2xl rounded-br-sm px-4 py-3 shadow-md text-sm leading-relaxed relative">
                    ${formattedText}
                </div>
                <span class="text-[10px] text-gray-400 mt-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity">${time}</span>
            </div>
        `;
    } else {
        const mdText = formattedText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        div.innerHTML = `
            <div class="flex gap-3 max-w-[90%]">
                <div class="flex-shrink-0 flex flex-col justify-end">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs shadow-sm">
                        <i class="fas fa-robot"></i>
                    </div>
                </div>
                <div class="flex flex-col items-start">
                    <div class="bg-white dark:bg-darkcard border border-gray-200 dark:border-darkborder text-gray-800 dark:text-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm text-sm leading-relaxed">
                        ${mdText}
                    </div>
                    <span class="text-[10px] text-gray-400 mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">Salve-se IA • ${time}</span>
                </div>
            </div>
        `;
    }
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

// ============================================================
// --- EXECUÇÃO DE COMANDOS IA (O CÉREBRO DO SISTEMA) ---
// ============================================================
async function executeAICommand(cmd) {
    console.log("Executando comando IA:", cmd);
    const p = cmd.params || {};
    let feedback = "";

    switch(cmd.action) {
        // --- TAREFAS ---
        case 'create_task':
            tasksData.push({ id: Date.now().toString(), text: p.text, done: false, priority: p.priority || 'normal', category: p.category || 'geral', createdAt: Date.now() });
            saveData();
            feedback = `Adicionei a tarefa "${p.text}"! ✅`;
            break;
        case 'delete_task':
            if(p.taskId) { tasksData = tasksData.filter(t => t.id !== p.taskId); feedback = "Tarefa removida."; }
            else { feedback = "Preciso do ID da tarefa."; }
            saveData();
            break;
        case 'task_complete':
            const tComp = tasksData.find(t => t.id === p.taskId);
            if(tComp) { tComp.done = true; saveData(); feedback = "Tarefa marcada como concluída! 🎉"; }
            else feedback = "Tarefa não encontrada.";
            break;
        case 'task_incomplete':
            const tInc = tasksData.find(t => t.id === p.taskId);
            if(tInc) { tInc.done = false; saveData(); feedback = "Tarefa reaberta."; }
            break;
        case 'task_clear_completed':
            clearCompleted();
            feedback = "Tarefas concluídas removidas.";
            break;
        case 'task_filter_change':
            setTaskFilter(p.filter);
            feedback = `Filtro alterado para: ${p.filter}`;
            break;

        // --- AULAS ---
        case 'create_class':
            scheduleData.push({ id: Date.now().toString(), name: p.name, prof: p.prof || 'N/A', room: p.room || 'N/A', day: p.day, start: p.start, end: p.end, color: 'indigo' });
            saveData();
            feedback = `Aula de ${p.name} adicionada! 🎓`;
            break;
        case 'delete_class':
            scheduleData = scheduleData.filter(c => c.id !== p.classId);
            saveData();
            feedback = "Aula removida.";
            break;
        case 'class_clear_day':
            scheduleData = scheduleData.filter(c => c.day !== p.day);
            saveData();
            feedback = `Limpei todas as aulas de ${p.day}.`;
            break;

        // --- CALCULADORA ---
        case 'calc_add_grade':
            switchPage('calc');
            setTimeout(() => {
                // Simulação de preenchimento via DOM não ideal, melhor manipular estado se possível
                // Aqui vamos injetar no DOM inputs existentes
                const inputs = document.querySelectorAll('.grade-input');
                const weights = document.querySelectorAll('.weight-input');
                // Encontrar primeiro vazio
                let found = false;
                for(let i=0; i<inputs.length; i++) {
                    if(inputs[i].value === "") {
                        inputs[i].value = p.grade;
                        weights[i].value = p.weight;
                        found = true;
                        break;
                    }
                }
                if(!found) { addGradeRow(); setTimeout(() => {
                    const newInputs = document.querySelectorAll('.grade-input');
                    const newWeights = document.querySelectorAll('.weight-input');
                    newInputs[newInputs.length-1].value = p.grade;
                    newWeights[newWeights.length-1].value = p.weight;
                    calculateAverage();
                }, 100); } else { calculateAverage(); }
            }, 500);
            feedback = "Nota adicionada na calculadora.";
            break;
        case 'calc_reset':
            resetCalc();
            feedback = "Calculadora limpa.";
            break;
        case 'calc_set_passing':
            const passEl = document.getElementById('passing-grade');
            if(passEl) { passEl.value = p.val; calculateAverage(); feedback = `Média para aprovação definida em ${p.val}`; }
            break;

        // --- POMODORO ---
        case 'timer_start':
            if(!isRunning1) toggleTimer();
            feedback = "Foco total! Timer iniciado. 🔥";
            switchPage('pomo');
            break;
        case 'timer_pause':
            if(isRunning1) toggleTimer();
            feedback = "Timer pausado.";
            break;
        case 'timer_stop':
            resetTimer();
            feedback = "Timer resetado.";
            break;
        case 'timer_set_mode':
            setTimerMode(p.mode);
            switchPage('pomo');
            feedback = `Modo alterado para ${p.mode}.`;
            break;

        // --- UI & NAVEGAÇÃO ---
        case 'navigate':
            switchPage(p.page);
            feedback = `Navegando para ${p.page}... 🚀`;
            break;
        case 'ui_theme_toggle':
            toggleTheme();
            feedback = "Tema alternado.";
            break;
        case 'ui_color_set':
            setThemeColor(p.color);
            feedback = `Cor do tema alterada para ${p.color}.`;
            break;
        case 'ui_clock_toggle':
            cycleClockMode();
            feedback = "Estilo do relógio alterado.";
            break;
        case 'nav_modal_open':
            if(p.modal === 'profile') showProfileSetupScreen(); // Simplificação
            if(p.modal === 'class') openAddClassModal();
            if(p.modal === 'reminder') toggleRemindersModal();
            feedback = "Modal aberto.";
            break;
        case 'ui_toast_show':
            showModal("Aviso da IA", p.msg);
            feedback = "Mensagem exibida.";
            break;

        // --- LINKS EXTERNOS ---
        case 'ufrb_portal':
            window.open('https://sistemas.ufrb.edu.br/sigaa/verTelaLogin.do', '_blank');
            feedback = "Abrindo Portal...";
            break;
        case 'ufrb_ava':
            window.open('https://ava.ufrb.edu.br/', '_blank');
            feedback = "Abrindo AVA...";
            break;
        case 'ufrb_calendar':
            window.open('https://ufrb.edu.br/portal/calendario-academico', '_blank');
            feedback = "Abrindo Calendário...";
            break;
        case 'ufrb_library':
            window.open('https://ufrb.edu.br/biblioteca/', '_blank');
            feedback = "Abrindo Biblioteca...";
            break;

        // --- EMAILS ---
        case 'email_load_template':
            switchPage('email');
            loadTemplate(p.key);
            feedback = "Template carregado.";
            break;
        case 'email_copy':
            copyEmail();
            feedback = "Email copiado para a área de transferência.";
            break;
        case 'email_clear':
            document.getElementById('email-content').value = '';
            feedback = "Editor limpo.";
            break;

        // --- PERFIL & SISTEMA ---
        case 'profile_edit_name':
            editName();
            feedback = "Abrindo edição de nome.";
            break;
        case 'profile_edit_handle':
            editHandle();
            feedback = "Abrindo edição de usuário.";
            break;
        case 'profile_photo_upload':
            changePhoto();
            feedback = "Selecione sua foto.";
            break;
        case 'system_backup':
            manualBackup();
            feedback = "Iniciando backup...";
            break;
        case 'system_logout':
            logoutApp();
            feedback = "Saindo...";
            break;
        case 'system_reset_password':
            changePassword();
            feedback = "Iniciando processo de senha.";
            break;

        // --- UTILITÁRIOS ---
        case 'util_roll_dice':
            const dice = Math.floor(Math.random() * 6) + 1;
            feedback = `🎲 O dado caiu em: **${dice}**`;
            break;
        case 'util_coin_flip':
            const coin = Math.random() > 0.5 ? "Cara" : "Coroa";
            feedback = `🪙 Deu: **${coin}**`;
            break;
        case 'easter_egg_confetti':
            feedback = "🎉 Chuva de confetes!";
            // Simulação simples visual
            showModal("🎉", "Imagine confetes caindo agora! (Animação CSS indisponível neste contexto)");
            break;
        case 'ai_clear_chat':
            chatHistory = [];
            document.getElementById('chat-messages-container').innerHTML = '';
            appendMessage('ai', 'Histórico limpo! O que mais deseja?');
            return; // Retorna direto para não duplicar msg
        
        // --- LEMBRETES ---
        case 'create_reminder':
             remindersData.push({ id: Date.now().toString(), desc: p.desc, date: p.date, prio: p.prio || 'medium', createdAt: Date.now() });
             saveData();
             feedback = `Lembrete definido para ${p.date}.`;
             break;
        case 'delete_reminder':
             deleteReminder(p.id);
             feedback = "Lembrete apagado.";
             break;

        default:
            feedback = "Ação realizada (ou comando desconhecido).";
    }

    appendMessage('ai', feedback);
}

// ============================================================
// --- FUNÇÕES DE USUÁRIO & DADOS ---
// ============================================================

window.loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        alert("Erro ao fazer login: " + error.message);
    }
};

window.logoutApp = async () => {
    try {
        await signOut(auth);
        localStorage.removeItem('salvese_session_active'); 
        location.reload();
    } catch (error) {
        localStorage.removeItem('salvese_session_active');
        location.reload();
    }
};

window.saveUserProfile = async () => {
    const handleInput = document.getElementById('input-handle').value.toLowerCase().trim();
    const nameInput = document.getElementById('input-display-name').value.trim();
    const errorMsg = document.getElementById('profile-error');

    if (!handleInput || !nameInput) {
        errorMsg.innerText = "Preencha todos os campos.";
        return;
    }

    const handleRegex = /^[a-z0-9_]+$/;
    if (!handleRegex.test(handleInput)) {
        errorMsg.innerText = "Usuário deve conter apenas letras minúsculas, números e _";
        return;
    }

    try {
        const usernameRef = doc(db, "usernames", handleInput);
        const usernameSnap = await getDoc(usernameRef);

        if (usernameSnap.exists()) {
            errorMsg.innerText = "Este nome de usuário já está em uso.";
            return;
        }

        await setDoc(doc(db, "usernames", handleInput), { uid: currentUser.uid });
        
        const profileData = {
            handle: handleInput,
            displayName: nameInput,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            createdAt: new Date().toISOString(),
            semester: "N/A",
            lastHandleChange: Date.now()
        };
        
        await setDoc(doc(db, "users", currentUser.uid), profileData);

        const initialData = {
            schedule: JSON.parse(localStorage.getItem('salvese_schedule')) || [],
            tasks: JSON.parse(localStorage.getItem('salvese_tasks')) || [],
            reminders: JSON.parse(localStorage.getItem('salvese_reminders')) || [],
            lastUpdated: new Date().toISOString()
        };
        
        await setDoc(doc(db, "users", currentUser.uid, "data", "appData"), initialData);

        userProfile = profileData;
        localStorage.setItem('salvese_session_active', 'true');
        localStorage.setItem('salvese_user_profile', JSON.stringify(userProfile));

        showAppInterface();
        initRealtimeSync(currentUser.uid);

    } catch (error) {
        console.error("Erro ao criar perfil:", error);
        errorMsg.innerText = "Erro ao salvar perfil. Verifique sua conexão.";
    }
};

function initRealtimeSync(uid) {
    const dataRef = doc(db, "users", uid, "data", "appData");
    unsubscribeData = onSnapshot(dataRef, (doc) => {
        if (doc.exists()) {
            const cloudData = doc.data();
            localStorage.setItem('salvese_schedule', JSON.stringify(cloudData.schedule || []));
            localStorage.setItem('salvese_tasks', JSON.stringify(cloudData.tasks || []));
            localStorage.setItem('salvese_reminders', JSON.stringify(cloudData.reminders || []));

            scheduleData = cloudData.schedule || [];
            tasksData = cloudData.tasks || [];
            remindersData = cloudData.reminders || [];

            refreshAllUI();
        }
    }, (error) => console.log("Modo offline ou erro de sync:", error.code));

    onSnapshot(doc(db, "users", uid), (docSnap) => {
        if(docSnap.exists()) {
            userProfile = docSnap.data();
            localStorage.setItem('salvese_user_profile', JSON.stringify(userProfile));
            updateUserInterfaceInfo();
            if (document.getElementById('view-config') && !document.getElementById('view-config').classList.contains('hidden')) {
                window.renderSettings();
            }
        }
    });
}

function updateUserInterfaceInfo() {
    const nameDisplay = document.getElementById('user-display-name');
    const handleDisplay = document.getElementById('user-display-id');
    const sidebarAvatar = document.getElementById('user-avatar-sidebar');
    
    if(userProfile) {
        if(nameDisplay) nameDisplay.innerText = userProfile.displayName;
        if(handleDisplay) handleDisplay.innerText = "@" + userProfile.handle;
        if(sidebarAvatar && userProfile.photoURL) sidebarAvatar.src = userProfile.photoURL;
    }
}

function refreshAllUI() {
    if (window.renderSchedule) window.renderSchedule();
    if (window.renderTasks) window.renderTasks();
    if (window.renderReminders) window.renderReminders();
    if (window.updateDashboardTasksWidget) window.updateDashboardTasksWidget();
    if (window.updateNextClassWidget) window.updateNextClassWidget();
    if (window.renderSettings) window.renderSettings();
}

async function saveData() {
    localStorage.setItem('salvese_schedule', JSON.stringify(scheduleData));
    localStorage.setItem('salvese_tasks', JSON.stringify(tasksData));
    localStorage.setItem('salvese_reminders', JSON.stringify(remindersData));

    refreshAllUI();

    if (currentUser) {
        try {
            const dataToSave = {
                schedule: scheduleData,
                tasks: tasksData,
                reminders: remindersData,
                lastUpdated: new Date().toISOString()
            };
            await setDoc(doc(db, "users", currentUser.uid, "data", "appData"), dataToSave, { merge: true });
        } catch (e) {
            console.log("Salvamento local ok. Nuvem pendente.");
        }
    }
}

window.manualBackup = async function() {
    const btn = document.getElementById('btn-manual-backup');
    if(btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        btn.disabled = true;
    }

    await saveData();

    setTimeout(() => {
        showModal('Backup', 'Seus dados foram sincronizados com a nuvem com sucesso!');
        if(btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }, 800);
}

// ============================================================
// --- UI COMPONENTS: MODAIS E INPUTS ---
// ============================================================

function openCustomInputModal(title, placeholder, initialValue, onConfirm) {
    const modal = document.getElementById('custom-input-modal');
    const modalTitle = document.getElementById('custom-modal-title');
    const modalInput = document.getElementById('custom-modal-input');
    const btnConfirm = document.getElementById('custom-modal-confirm');
    const btnCancel = document.getElementById('custom-modal-cancel');

    if(!modal) return console.error("Modal não encontrado no HTML");

    modalTitle.innerText = title;
    modalInput.placeholder = placeholder || "";
    modalInput.value = initialValue || "";
    
    const newBtnConfirm = btnConfirm.cloneNode(true);
    btnConfirm.parentNode.replaceChild(newBtnConfirm, btnConfirm);
    
    const newBtnCancel = btnCancel.cloneNode(true);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

    newBtnConfirm.addEventListener('click', () => {
        const val = modalInput.value;
        modal.classList.add('hidden');
        if(onConfirm) onConfirm(val);
    });

    newBtnCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    modalInput.onkeypress = (e) => {
        if(e.key === 'Enter') newBtnConfirm.click();
    };

    modal.classList.remove('hidden');
    modalInput.focus();
}

function openCustomConfirmModal(title, message, onConfirm) {
    const modal = document.getElementById('custom-confirm-modal');
    const modalTitle = document.getElementById('custom-confirm-title');
    const modalMsg = document.getElementById('custom-confirm-msg');
    const btnYes = document.getElementById('custom-confirm-yes');
    const btnNo = document.getElementById('custom-confirm-no');

    if(!modal) return;

    modalTitle.innerText = title;
    modalMsg.innerText = message;

    const newBtnYes = btnYes.cloneNode(true);
    btnYes.parentNode.replaceChild(newBtnYes, btnYes);
    
    const newBtnNo = btnNo.cloneNode(true);
    btnNo.parentNode.replaceChild(newBtnNo, btnNo);

    newBtnYes.addEventListener('click', () => {
        modal.classList.add('hidden');
        if(onConfirm) onConfirm();
    });

    newBtnNo.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    modal.classList.remove('hidden');
}

window.showModal = function(title, message) {
    const m = document.getElementById('generic-modal');
    document.getElementById('generic-modal-title').innerText = title;
    document.getElementById('generic-modal-message').innerText = message;
    if (m) {
        history.pushState({modal: 'generic'}, null, '#alert');
        m.classList.remove('hidden');
        setTimeout(() => { m.classList.remove('opacity-0'); m.firstElementChild.classList.remove('scale-95'); m.firstElementChild.classList.add('scale-100'); }, 10);
    }
}

window.closeGenericModal = function() {
    const m = document.getElementById('generic-modal');
    if (m) {
        m.classList.add('opacity-0'); m.firstElementChild.classList.remove('scale-100'); m.firstElementChild.classList.add('scale-95');
        setTimeout(() => m.classList.add('hidden'), 300);
    }
}

// ============================================================
// --- PERFIL E CONFIGURAÇÕES ---
// ============================================================

window.editName = function() {
    openCustomInputModal(
        "Alterar Nome de Exibição", 
        "Digite seu novo nome...", 
        userProfile.displayName, 
        async (newName) => {
            if (newName && newName.trim() !== "" && newName !== userProfile.displayName) {
                if(!currentUser) return showModal("Erro", "Você precisa estar online.");
                
                try {
                    await setDoc(doc(db, "users", currentUser.uid), { displayName: newName.trim() }, { merge: true });
                    await updateProfile(currentUser, { displayName: newName.trim() });
                    showModal("Sucesso", "Nome alterado com sucesso!");
                } catch (e) {
                    showModal("Erro", "Falha ao alterar nome: " + e.message);
                }
            }
        }
    );
}

window.editHandle = function() {
    if (!userProfile || !currentUser) return;

    const lastChange = userProfile.lastHandleChange || 0;
    const now = Date.now();
    const daysSinceLastChange = (now - lastChange) / (1000 * 60 * 60 * 24);
    
    if (daysSinceLastChange < 7 && userProfile.createdAt !== userProfile.lastHandleChange) {
        const daysLeft = Math.ceil(7 - daysSinceLastChange);
        return showModal("Aguarde", `Você só pode alterar seu usuário a cada 7 dias. Aguarde mais ${daysLeft} dia(s).`);
    }

    openCustomInputModal(
        "Alterar @Usuário",
        "Sem o @ (apenas letras e números)",
        userProfile.handle,
        async (newHandle) => {
            if (!newHandle || newHandle.trim() === "" || newHandle === userProfile.handle) return;

            const cleanHandle = newHandle.toLowerCase().trim();
            const handleRegex = /^[a-z0-9_]+$/;
            
            if (!handleRegex.test(cleanHandle)) {
                return showModal("Inválido", "Use apenas letras minúsculas, números e _.");
            }

            openCustomConfirmModal(
                "Confirmar Troca",
                `Deseja alterar para @${cleanHandle}? Essa ação não pode ser desfeita por 7 dias.`,
                async () => {
                    try {
                        const newHandleRef = doc(db, "usernames", cleanHandle);
                        const docSnap = await getDoc(newHandleRef);
                        
                        if (docSnap.exists()) {
                            return showModal("Indisponível", "Este usuário já está em uso.");
                        }

                        await setDoc(newHandleRef, { uid: currentUser.uid });
                        
                        if (userProfile.handle) {
                            await deleteDoc(doc(db, "usernames", userProfile.handle));
                        }

                        await setDoc(doc(db, "users", currentUser.uid), { 
                            handle: cleanHandle,
                            lastHandleChange: Date.now()
                        }, { merge: true });

                        showModal("Sucesso", `Seu usuário agora é @${cleanHandle}`);

                    } catch (e) {
                        console.error(e);
                        showModal("Erro", "Erro ao atualizar usuário. Tente novamente.");
                    }
                }
            );
        }
    );
}

window.editSemester = function() {
    openCustomInputModal(
        "Semestre Atual",
        "Ex: 2025.1",
        userProfile.semester,
        async (newSemester) => {
            if (newSemester !== null && currentUser) {
                try {
                    await setDoc(doc(db, "users", currentUser.uid), { semester: newSemester }, { merge: true });
                } catch (e) {
                    showModal("Erro", "Erro ao salvar semestre: " + e.message);
                }
            }
        }
    );
}

window.changePhoto = function() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const loadingBtn = document.getElementById('btn-change-photo-settings');
        let originalBtnContent = "";
        if(loadingBtn) {
             originalBtnContent = loadingBtn.innerHTML;
             loadingBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Enviando...';
             loadingBtn.disabled = true;
        } else {
             showModal("Aguarde", "Enviando sua foto para o servidor...");
        }

        const formData = new FormData();
        formData.append('image', file);

        try {
            // Nota: Client-ID exposto, idealmente use um proxy backend
            const response = await fetch('https://api.imgur.com/3/image', {
                method: 'POST',
                headers: { 'Authorization': 'Client-ID 513bb727cecf9ac' },
                body: formData
            });

            const data = await response.json();

            if (data.success && currentUser) {
                const newUrl = data.data.link;

                await updateProfile(currentUser, { photoURL: newUrl });
                await setDoc(doc(db, "users", currentUser.uid), { photoURL: newUrl }, { merge: true });
                
                const genericModal = document.getElementById('generic-modal');
                if(genericModal && !genericModal.classList.contains('hidden')) closeGenericModal();

                showModal("Sucesso", "Foto de perfil atualizada com sucesso!");
            } else {
                throw new Error('Falha no upload: ' + (data.data.error || 'Erro desconhecido'));
            }

        } catch (error) {
            console.error("Erro ao atualizar foto:", error);
            showModal("Erro", "Erro ao enviar foto: " + error.message);
        } finally {
            if(loadingBtn) {
                loadingBtn.innerHTML = originalBtnContent;
                loadingBtn.disabled = false;
            }
        }
    };

    input.click();
}

window.changePassword = function() {
    if (currentUser && currentUser.email) {
        openCustomConfirmModal(
            "Redefinir Senha",
            "Enviar e-mail de redefinição de senha para " + currentUser.email + "?",
            async () => {
                try {
                    await sendPasswordResetEmail(auth, currentUser.email);
                    showModal("E-mail Enviado", "Verifique sua caixa de entrada para redefinir a senha.");
                } catch (e) {
                    showModal("Erro", "Erro: " + e.message);
                }
            }
        );
    }
}

window.renderSettings = function() {
    const container = document.getElementById('settings-content');
    if (!container || !userProfile) return;

    let dateStr = "N/A";
    if (userProfile.createdAt) {
        const date = new Date(userProfile.createdAt);
        dateStr = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    const photo = userProfile.photoURL || "https://files.catbox.moe/pmdtq6.png";

    const createActionCard = (onclick, svgIcon, title, subtitle, colorClass = "text-gray-500 group-hover:text-indigo-500") => `
        <button onclick="${onclick}" class="group w-full bg-white dark:bg-darkcard border border-gray-100 dark:border-darkborder p-4 rounded-2xl flex items-center justify-between hover:border-indigo-500 dark:hover:border-indigo-500 hover:shadow-md transition-all duration-200 mb-3 text-left">
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 rounded-full bg-gray-50 dark:bg-neutral-800 flex items-center justify-center ${colorClass} transition-colors">
                    ${svgIcon}
                </div>
                <div>
                    <p class="font-bold text-gray-800 dark:text-gray-200 text-sm">${title}</p>
                    <p class="text-xs text-gray-400 dark:text-gray-500">${subtitle}</p>
                </div>
            </div>
            <div class="text-gray-300 dark:text-neutral-700 group-hover:text-indigo-500 transition-colors">
                ${svgs.chevron}
            </div>
        </button>
    `;

    container.innerHTML = `
        <div class="max-w-2xl mx-auto w-full pb-24 space-y-6">
            
            <!-- Header do Perfil -->
            <div class="bg-white dark:bg-darkcard rounded-3xl shadow-sm border border-gray-200 dark:border-darkborder p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden">
                 <div class="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-10 dark:opacity-20"></div>
                 
                 <div class="relative group mb-4 mt-4">
                    <div class="w-28 h-28 rounded-full overflow-hidden p-1 border-4 border-white dark:border-darkcard shadow-lg relative z-10">
                        <img src="${photo}" class="w-full h-full object-cover rounded-full" onerror="this.src='https://files.catbox.moe/pmdtq6.png'">
                    </div>
                    <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-full flex items-center justify-center cursor-pointer m-1 z-20" onclick="changePhoto()">
                        <i class="fas fa-camera text-white text-2xl"></i>
                    </div>
                </div>

                <h2 class="text-2xl font-black text-gray-900 dark:text-white mb-0.5 tracking-tight">
                    ${userProfile.displayName}
                </h2>
                <p class="text-indigo-600 dark:text-indigo-400 font-bold text-sm mb-4 bg-indigo-50 dark:bg-indigo-900/20 px-3 py-1 rounded-full">@${userProfile.handle}</p>
                
                <div class="grid grid-cols-2 gap-4 w-full max-w-sm mt-2">
                    <div class="bg-gray-50 dark:bg-neutral-800/50 p-3 rounded-xl">
                         <p class="text-xs text-gray-400 uppercase font-bold mb-1">Semestre</p>
                         <p class="font-bold text-gray-800 dark:text-white">${userProfile.semester || 'N/A'}</p>
                    </div>
                    <div class="bg-gray-50 dark:bg-neutral-800/50 p-3 rounded-xl">
                         <p class="text-xs text-gray-400 uppercase font-bold mb-1">Membro Desde</p>
                         <p class="font-bold text-gray-800 dark:text-white">${dateStr.split(' de ')[2] || dateStr}</p>
                    </div>
                </div>
            </div>

            <!-- Seção de Ações -->
            <div>
                <h3 class="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Gerenciar Conta</h3>
                ${createActionCard('changePhoto()', svgs.photo, 'Foto de Perfil', 'Atualize sua imagem de exibição')}
                ${createActionCard('editName()', svgs.user, 'Nome de Exibição', 'Como seu nome aparece no app')}
                ${createActionCard('editHandle()', svgs.at, 'Nome de Usuário', 'Seu identificador único @handle')}
                ${createActionCard('editSemester()', svgs.school, 'Semestre Atual', 'Para organizar suas matérias')}
            </div>

            <!-- Segurança e Dados -->
            <div>
                <h3 class="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Segurança & Dados</h3>
                
                ${createActionCard('changePassword()', svgs.lock, 'Redefinir Senha', 'Receba um e-mail para trocar a senha')}
                ${createActionCard('manualBackup()', svgs.cloud, 'Backup Manual', 'Forçar sincronização com a nuvem')}
                
                <button onclick="logoutApp()" class="group w-full bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 p-4 rounded-2xl flex items-center justify-between hover:bg-red-100 dark:hover:bg-red-900/20 transition-all duration-200 text-left mt-4">
                    <div class="flex items-center gap-4">
                        <div class="w-10 h-10 rounded-full bg-white dark:bg-red-900/20 flex items-center justify-center text-red-500">
                            ${svgs.logout}
                        </div>
                        <div>
                            <p class="font-bold text-red-600 dark:text-red-400 text-sm">Sair da Conta</p>
                            <p class="text-xs text-red-400 dark:text-red-500/70">Encerrar sessão neste dispositivo</p>
                        </div>
                    </div>
                    <div class="text-red-300 dark:text-red-800">
                        ${svgs.chevron}
                    </div>
                </button>
            </div>

            <div class="text-center pt-4 pb-8">
                 <p class="text-xs text-gray-300 dark:text-gray-600 font-mono">ID: ${currentUser.uid.substring(0,8)}...</p>
                 <p class="text-xs text-gray-300 dark:text-gray-600 mt-1">Salve-se UFRB v2.2 (Clean UI)</p>
            </div>
        </div>
    `;
}

// ============================================================
// --- FUNCIONALIDADE: TAREFAS (TODO LIST) ---
// ============================================================

window.addTask = function () {
    const input = document.getElementById('todo-input');
    const priorityInput = document.getElementById('todo-priority'); 
    const categoryInput = document.getElementById('todo-category'); 
    
    const text = input.value.trim();
    if (!text) return;

    const priority = priorityInput ? priorityInput.value : 'normal';
    const category = categoryInput ? categoryInput.value : 'geral';

    tasksData.push({
        id: Date.now().toString(),
        text: text,
        done: false,
        priority: priority,
        category: category,
        createdAt: Date.now()
    });

    input.value = '';
    saveData();
};

window.toggleTask = function (taskId) {
    const task = tasksData.find(t => t.id === taskId);
    if (task) {
        task.done = !task.done;
        saveData();
    }
};

window.deleteTask = function (taskId) {
    tasksData = tasksData.filter(t => t.id !== taskId);
    saveData();
};

window.clearCompleted = function () {
    tasksData = tasksData.filter(t => !t.done);
    saveData();
};

window.setTaskFilter = function(filter) {
    currentTaskFilter = filter;
    ['filter-all', 'filter-active', 'filter-completed'].forEach(id => {
        const btn = document.getElementById(id);
        if(btn) {
            if(id === `filter-${filter}`) btn.classList.add('bg-indigo-100', 'text-indigo-700', 'dark:bg-indigo-900/50', 'dark:text-indigo-300');
            else btn.classList.remove('bg-indigo-100', 'text-indigo-700', 'dark:bg-indigo-900/50', 'dark:text-indigo-300');
        }
    });
    window.renderTasks();
};

function getPriorityInfo(prio) {
    switch(prio) {
        case 'high': return { label: 'Alta', color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-900' };
        case 'medium': return { label: 'Média', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400 border-orange-100 dark:border-orange-900' };
        default: return { label: 'Normal', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-900' };
    }
}

function getCategoryIcon(cat) {
    switch(cat) {
        case 'estudo': return '<i class="fas fa-book"></i>';
        case 'trabalho': return '<i class="fas fa-briefcase"></i>';
        case 'pessoal': return '<i class="fas fa-user"></i>';
        default: return '<i class="fas fa-circle text-[8px]"></i>';
    }
}

window.renderTasks = function () {
    const list = document.getElementById('todo-list');
    if (!list) return;
    
    list.innerHTML = '';
    
    let filteredTasks = tasksData;
    if (currentTaskFilter === 'active') filteredTasks = tasksData.filter(t => !t.done);
    if (currentTaskFilter === 'completed') filteredTasks = tasksData.filter(t => t.done);

    const priorityWeight = { 'high': 3, 'medium': 2, 'normal': 1 };
    
    const sortedTasks = [...filteredTasks].sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1; 
        if (priorityWeight[b.priority || 'normal'] !== priorityWeight[a.priority || 'normal']) {
            return priorityWeight[b.priority || 'normal'] - priorityWeight[a.priority || 'normal'];
        }
        return b.createdAt - a.createdAt;
    });

    if (sortedTasks.length === 0) {
        list.innerHTML = `
            <div class="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-600">
                <i class="fas fa-clipboard-check text-4xl mb-3 opacity-30"></i>
                <p class="text-sm">Nenhuma tarefa encontrada.</p>
            </div>
        `;
        return;
    }

    sortedTasks.forEach(t => {
        const div = document.createElement('div');
        const prioInfo = getPriorityInfo(t.priority || 'normal');
        const catIcon = getCategoryIcon(t.category || 'geral');
        
        div.className = `group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${t.done ? 'bg-gray-50/50 dark:bg-neutral-900/30 border-transparent opacity-60' : 'bg-white dark:bg-darkcard border-gray-200 dark:border-darkborder hover:border-indigo-300 dark:hover:border-indigo-800 shadow-sm hover:shadow-md'}`;
        
        div.innerHTML = `
            <button onclick="toggleTask('${t.id}')" class="w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${t.done ? 'bg-emerald-500 border-emerald-500 text-white scale-90' : 'border-gray-300 dark:border-gray-600 hover:border-indigo-500 text-transparent'}">
                <i class="fas fa-check text-[10px]"></i>
            </button>
            
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-sm font-medium truncate ${t.done ? 'text-gray-500 line-through decoration-gray-400' : 'text-gray-800 dark:text-gray-200'}">${t.text}</span>
                </div>
                <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${prioInfo.color}">${prioInfo.label}</span>
                    <span class="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1 capitalize">${catIcon} ${t.category || 'Geral'}</span>
                </div>
            </div>
            
            <button onclick="deleteTask('${t.id}')" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition opacity-0 group-hover:opacity-100">
                <i class="fas fa-trash-alt text-xs"></i>
            </button>
        `;
        list.appendChild(div);
    });
    
    window.updateDashboardTasksWidget(); 
}

window.updateDashboardTasksWidget = function() {
    const container = document.getElementById('dashboard-tasks-list');
    const taskCountEl = document.getElementById('task-count-badge'); 
    
    const pendingTasks = tasksData.filter(t => !t.done);
    
    if(taskCountEl) {
        taskCountEl.innerText = pendingTasks.length;
        taskCountEl.className = pendingTasks.length > 0 ? 'bg-indigo-600 text-white px-2 py-0.5 rounded-full text-xs font-bold' : 'hidden';
    }
    
    if (!container) return;
    container.innerHTML = '';

    if (pendingTasks.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-6 text-center h-full">
                <div class="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-2">
                    <i class="fas fa-check"></i>
                </div>
                <p class="text-sm text-gray-500 dark:text-gray-400 font-medium">Tudo feito!</p>
            </div>
        `;
        return;
    }

    const priorityWeight = { 'high': 3, 'medium': 2, 'normal': 1 };
    const topTasks = [...pendingTasks].sort((a, b) => {
        return priorityWeight[b.priority || 'normal'] - priorityWeight[a.priority || 'normal'];
    }).slice(0, 3); 

    topTasks.forEach(t => {
        const prioInfo = getPriorityInfo(t.priority || 'normal');
        const item = document.createElement('div');
        item.className = "flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-neutral-800 transition cursor-pointer border border-transparent hover:border-gray-100 dark:hover:border-neutral-700";
        item.onclick = () => switchPage('todo'); 
        
        item.innerHTML = `
            <div class="w-1.5 h-1.5 rounded-full ${t.priority === 'high' ? 'bg-red-500' : (t.priority === 'medium' ? 'bg-orange-500' : 'bg-blue-500')}"></div>
            <span class="flex-1 text-sm text-gray-700 dark:text-gray-300 truncate">${t.text}</span>
            <span class="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border ${prioInfo.color}">${prioInfo.label}</span>
        `;
        container.appendChild(item);
    });

    if (pendingTasks.length > 3) {
        const more = document.createElement('div');
        more.className = "text-center mt-2";
        more.innerHTML = `<span class="text-xs text-indigo-600 dark:text-indigo-400 font-bold cursor-pointer hover:underline" onclick="switchPage('todo')">+ mais ${pendingTasks.length - 3} tarefas</span>`;
        container.appendChild(more);
    }
};

// ============================================================
// --- FUNCIONALIDADE: GRADE HORÁRIA ---
// ============================================================

const timeSlots = [
    { start: "07:00", end: "08:00" }, { start: "08:00", end: "09:00" }, { start: "09:00", end: "10:00" },
    { start: "10:00", end: "11:00" }, { start: "11:00", end: "12:00" }, { start: "12:00", end: "13:00" },
    { start: "13:00", end: "14:00" }, { start: "14:00", end: "15:00" }, { start: "15:00", end: "16:00" },
    { start: "16:00", end: "17:00" }, { start: "17:00", end: "18:00" }, { start: "18:30", end: "19:30" },
    { start: "19:30", end: "20:30" }, { start: "20:30", end: "21:30" }, { start: "21:30", end: "22:30" }
];

const daysList = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const daysDisplay = {'seg': 'Seg', 'ter': 'Ter', 'qua': 'Qua', 'qui': 'Qui', 'sex': 'Sex', 'sab': 'Sab'};

window.renderSchedule = function () {
    const viewContainer = document.getElementById('view-aulas');
    if (!viewContainer) return;

    viewContainer.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = "max-w-6xl mx-auto pb-20 md:pb-10";

    const header = document.createElement('div');
    header.className = "hidden md:flex justify-between items-center mb-6 px-2";
    header.innerHTML = `
        <div>
            <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Grade Horária</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400">Gerencie suas aulas da semana.</p>
        </div>
        <button onclick="openAddClassModal()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-md transition flex items-center gap-2 text-sm font-bold">
            <i class="fas fa-plus"></i> <span>Nova Aula</span>
        </button>
    `;
    wrapper.appendChild(header);

    const mobileHeader = document.createElement('h2');
    mobileHeader.className = "md:hidden text-xl font-bold text-gray-900 dark:text-white mb-6 px-1";
    mobileHeader.innerText = "Minha Grade de Horários";
    wrapper.appendChild(mobileHeader);

    const mobileContainer = document.createElement('div');
    mobileContainer.className = "md:hidden space-y-6";

    daysList.forEach(dayKey => {
        const daySection = document.createElement('div');
        daySection.className = "flex flex-col gap-3";

        const headerRow = document.createElement('div');
        headerRow.className = "flex justify-between items-center px-1";
        headerRow.innerHTML = `
            <h3 class="text-lg font-bold text-gray-800 dark:text-gray-100">${daysDisplay[dayKey]}</h3>
            <button onclick="openAddClassModal('${dayKey}', '07:00')" class="text-gray-400 hover:text-indigo-600 transition p-1">
                <i class="fas fa-plus"></i>
            </button>
        `;
        daySection.appendChild(headerRow);

        const classesToday = scheduleData
            .filter(c => c.day === dayKey)
            .sort((a, b) => parseInt(a.start.replace(':','')) - parseInt(b.start.replace(':','')));

        const cardsContainer = document.createElement('div');
        cardsContainer.className = "space-y-3";

        if (classesToday.length === 0) {
            cardsContainer.innerHTML = `
                <p class="text-sm text-gray-400 italic pl-1">Nenhuma aula neste dia.</p>
                <div class="border-b border-gray-100 dark:border-neutral-800 border-dashed my-1"></div>
            `;
        } else {
            classesToday.forEach(aula => {
                const colorKey = aula.color || 'indigo';
                const palette = colorPalettes[colorKey] || colorPalettes['indigo'];
                
                const card = document.createElement('div');
                card.className = "relative rounded-xl p-4 cursor-pointer active:scale-[0.98] transition-transform overflow-hidden group";
                card.style.backgroundColor = `rgba(${palette[500]}, 0.12)`;
                
                card.innerHTML = `
                    <div class="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full" style="background-color: rgb(${palette[500]})"></div>
                    <div class="pl-3 flex justify-between items-start">
                        <div class="flex-1 pr-2">
                            <h4 class="font-bold text-xl leading-tight mb-1" style="color: rgb(${palette[700]}); filter: brightness(0.8) contrast(1.5);">${aula.name}</h4>
                            <div class="dark:text-gray-200 text-gray-900 font-medium">
                                <p class="text-base font-medium opacity-90" style="color: rgb(${palette[600]})">${aula.prof}</p>
                                <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">${aula.room}</p>
                            </div>
                        </div>
                        <div class="text-right flex flex-col items-end">
                             <div class="text-sm font-bold opacity-80 mb-0.5" style="color: rgb(${palette[700]})">${aula.start}</div>
                             <div class="text-sm opacity-60 dark:text-gray-400">${aula.end}</div>
                        </div>
                    </div>
                `;
                
                card.onclick = () => openEditClassModal(aula.id);
                cardsContainer.appendChild(card);
            });
        }
        daySection.appendChild(cardsContainer);
        mobileContainer.appendChild(daySection);
    });

    wrapper.appendChild(mobileContainer);

    const desktopContainer = document.createElement('div');
    desktopContainer.className = "hidden md:block bg-white dark:bg-darkcard rounded-xl border border-gray-200 dark:border-darkborder shadow-sm overflow-hidden";
    
    let tableHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
                <thead class="bg-gray-50 dark:bg-neutral-900 text-gray-500 dark:text-gray-400 font-bold text-xs uppercase tracking-wider">
                    <tr>
                        <th class="p-4 text-left w-40 border-b dark:border-darkborder sticky left-0 bg-gray-50 dark:bg-neutral-900 z-10">Horário</th>
                        ${daysList.map(d => `<th class="p-4 text-center border-b dark:border-darkborder border-l dark:border-neutral-800 min-w-[120px]">${daysDisplay[d]}</th>`).join('')}
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-darkborder">
    `;

    const occupied = {};

    timeSlots.forEach((slot, index) => {
        tableHTML += `<tr>`;
        tableHTML += `<td class="p-3 font-mono text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-neutral-900/50 sticky left-0 z-10 border-r dark:border-darkborder whitespace-nowrap">${slot.start} - ${slot.end}</td>`;

        daysList.forEach(day => {
            const cellKey = `${day}-${index}`;
            if (occupied[cellKey]) return;

            const foundClass = scheduleData.find(c => c.day === day && c.start === slot.start);
            
            if (foundClass) {
                let endIndex = timeSlots.findIndex(s => s.end === foundClass.end);
                if(endIndex === -1) endIndex = timeSlots.findIndex(s => s.start === foundClass.end) - 1;
                if (endIndex === -1) endIndex = index; 
                
                const span = Math.max(1, (endIndex - index) + 1);
                
                for (let k = 1; k < span; k++) occupied[`${day}-${index + k}`] = true;

                const colorKey = foundClass.color || 'indigo';
                const palette = colorPalettes[colorKey] || colorPalettes['indigo'];
                const bgStyle = `background-color: rgba(${palette[500]}, 0.15)`;
                const borderStyle = `border-left: 4px solid rgb(${palette[500]})`;
                const textStyle = `color: rgb(${palette[700]})`;

                tableHTML += `
                    <td rowspan="${span}" class="p-1 align-top h-full border-l border-gray-100 dark:border-neutral-800 relative group cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition" onclick="openEditClassModal('${foundClass.id}')">
                        <div class="h-full w-full rounded p-2 flex flex-col justify-center text-left shadow-sm" style="${bgStyle}; ${borderStyle}">
                            <p class="text-sm font-bold truncate" style="${textStyle}">${foundClass.name}</p>
                            <p class="text-xs text-gray-600 dark:text-gray-300 truncate opacity-80">${foundClass.prof}</p>
                            <p class="text--[10px] text-gray-500 dark:text-gray-400 truncate mt-1 bg-white/50 dark:bg-black/20 rounded w-fit px-1">${foundClass.room}</p>
                        </div>
                    </td>
                `;
            } else {
                tableHTML += `
                    <td class="p-1 border-l border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 transition cursor-pointer group" onclick="openAddClassModal('${day}', '${slot.start}')">
                        <div class="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-gray-300 dark:text-neutral-600">
                            <i class="fas fa-plus text-xs"></i>
                        </div>
                    </td>
                `;
            }
        });
        tableHTML += `</tr>`;
    });

    tableHTML += `</tbody></table></div>`;
    desktopContainer.innerHTML = tableHTML;
    wrapper.appendChild(desktopContainer);

    viewContainer.appendChild(wrapper);
};

window.openAddClassModal = function (day, startHourStr) {
    resetModalFields();
    document.getElementById('modal-title').innerText = "Adicionar Aula";
    document.getElementById('btn-delete-class').classList.add('hidden');
    
    if (day) document.getElementById('class-day').value = day;
    else {
         const todayIndex = new Date().getDay();
         const map = ['dom','seg','ter','qua','qui','sex','sab'];
         if(todayIndex > 0 && todayIndex < 7) document.getElementById('class-day').value = map[todayIndex];
    }

    if (startHourStr) {
        document.getElementById('class-start').value = startHourStr;
        updateEndTime(2);
    }
    toggleModal(true);
}

window.openEditClassModal = function (id) {
    resetModalFields();
    const classItem = scheduleData.find(c => c.id === id);
    if (!classItem) return;
    document.getElementById('modal-title').innerText = "Editar Aula";
    document.getElementById('btn-delete-class').classList.remove('hidden');
    document.getElementById('class-id').value = classItem.id;
    document.getElementById('class-name').value = classItem.name;
    document.getElementById('class-prof').value = classItem.prof;
    document.getElementById('class-room').value = classItem.room;
    document.getElementById('class-day').value = classItem.day;
    document.getElementById('class-start').value = classItem.start;
    document.getElementById('class-end').value = classItem.end;
    window.selectedColor = classItem.color || 'cyan';
    renderColorPicker();
    toggleModal(true);
}

window.saveClass = function () {
    const id = document.getElementById('class-id').value;
    const name = document.getElementById('class-name').value;
    const prof = document.getElementById('class-prof').value;
    const room = document.getElementById('class-room').value;
    const day = document.getElementById('class-day').value;
    const start = document.getElementById('class-start').value;
    const end = document.getElementById('class-end').value;

    if (!name) return showModal('Erro', 'O nome da matéria é obrigatório!');

    const classData = {
        id: id || Date.now().toString(),
        name, prof, room, day, start, end,
        color: window.selectedColor
    };

    if (id) {
        const index = scheduleData.findIndex(c => c.id === id);
        if (index !== -1) scheduleData[index] = classData;
    } else {
        scheduleData.push(classData);
    }

    saveData();
    toggleModal(false);
};

window.confirmDeleteClass = function () {
    const id = document.getElementById('class-id').value;
    if (!id) return;
    selectedClassIdToDelete = id;
    document.getElementById('class-modal').classList.add('opacity-0');
    setTimeout(() => document.getElementById('class-modal').classList.add('hidden'), 300);
    const confirmModal = document.getElementById('delete-confirmation-modal');
    confirmModal.classList.remove('hidden');
    setTimeout(() => { confirmModal.classList.remove('opacity-0'); confirmModal.firstElementChild.classList.remove('scale-95'); confirmModal.firstElementChild.classList.add('scale-100'); }, 10);
};

window.closeDeleteConfirmation = function () {
    selectedClassIdToDelete = null;
    const confirmModal = document.getElementById('delete-confirmation-modal');
    confirmModal.classList.add('opacity-0'); confirmModal.firstElementChild.classList.remove('scale-100'); confirmModal.firstElementChild.classList.add('scale-95');
    setTimeout(() => confirmModal.classList.add('hidden'), 300);
};

window.performDeleteClass = function () {
    if (!selectedClassIdToDelete) return;
    scheduleData = scheduleData.filter(c => c.id !== selectedClassIdToDelete);
    saveData();
    closeDeleteConfirmation();
};

function resetModalFields() {
    document.getElementById('class-id').value = ''; document.getElementById('class-name').value = ''; document.getElementById('class-prof').value = '';
    document.getElementById('class-room').value = ''; document.getElementById('class-day').value = 'seg'; window.selectedColor = 'cyan';
    
    const startSel = document.getElementById('class-start'); 
    const endSel = document.getElementById('class-end');
    
    startSel.innerHTML = ''; 
    endSel.innerHTML = '';
    
    timeSlots.forEach(t => { 
        const opt = `<option value="${t.start}">${t.start}</option>`; 
        startSel.innerHTML += opt; 
    });
    
    timeSlots.forEach(t => { 
        const opt = `<option value="${t.end}">${t.end}</option>`; 
        endSel.innerHTML += opt; 
    });
    
    startSel.value = "07:00"; 
    updateEndTime(2); 
    renderColorPicker();
}

window.updateEndTime = function(slotsToAdd = 2) {
    const startSel = document.getElementById('class-start');
    const endSel = document.getElementById('class-end');
    const startHourStr = startSel.value;
    
    const idx = timeSlots.findIndex(s => s.start === startHourStr);
    
    if (idx !== -1) {
        let targetIdx = idx + (slotsToAdd - 1); 
        if (targetIdx >= timeSlots.length) targetIdx = timeSlots.length - 1;
        endSel.value = timeSlots[targetIdx].end;
    }
}

window.toggleModal = function(show) {
    const modal = document.getElementById('class-modal'); 
    const content = document.getElementById('class-modal-content');
    if (show) { 
        history.pushState({modal: 'class'}, null, '#class-modal');
        modal.classList.remove('hidden'); 
        setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); content.classList.add('scale-100'); }, 10); 
    } else { 
        modal.classList.add('opacity-0'); 
        content.classList.remove('scale-100'); 
        content.classList.add('scale-95'); 
        setTimeout(() => modal.classList.add('hidden'), 300); 
    }
}

function renderColorPicker() {
    const container = document.getElementById('color-picker-container');
    if (!container) return;
    container.innerHTML = '';
    Object.keys(colorPalettes).forEach(color => {
        const rgb = colorPalettes[color][500]; const isSelected = color === window.selectedColor;
        const btn = document.createElement('button');
        btn.className = `w-8 h-8 rounded-full flex items-center justify-center transition transform hover:scale-110 ${isSelected ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-gray-500 ring-offset-white dark:ring-offset-neutral-900' : ''}`;
        btn.style.backgroundColor = `rgb(${rgb})`;
        if (isSelected) { btn.innerHTML = '<i class="fas fa-check text-white text-xs"></i>'; }
        btn.onclick = () => { window.selectedColor = color; renderColorPicker(); };
        container.appendChild(btn);
    });
}

window.updateNextClassWidget = function() {
    const container = document.getElementById('next-class-content');
    if (!container) return;

    const now = new Date();
    const daysArr = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const currentDay = daysArr[now.getDay()];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const todayClasses = scheduleData.filter(c => c.day === currentDay);
    todayClasses.sort((a, b) => {
        const [hA, mA] = a.start.split(':').map(Number);
        const [hB, mB] = b.start.split(':').map(Number);
        return (hA * 60 + mA) - (hB * 60 + mB);
    });

    let nextClass = null;
    let status = "";

    for (let c of todayClasses) {
        const [hStart, mStart] = c.start.split(':').map(Number);
        const [hEnd, mEnd] = c.end.split(':').map(Number);
        const startMins = hStart * 60 + mStart;
        const endMins = hEnd * 60 + mEnd;

        if (currentMinutes < startMins) {
            nextClass = c;
            status = 'future';
            break;
        } else if (currentMinutes >= startMins && currentMinutes < endMins) {
            nextClass = c;
            status = 'now';
            break;
        }
    }

    if (nextClass) {
        const [hStart, mStart] = nextClass.start.split(':').map(Number);
        const [hEnd, mEnd] = nextClass.end.split(':').map(Number);
        const startMins = hStart * 60 + mStart;
        const endMins = hEnd * 60 + mEnd;

        let badgeHTML = '';
        let progressHTML = '';

        if (status === 'future') {
            let diffMins = startMins - currentMinutes;
            if (diffMins > 60) {
                const h = Math.floor(diffMins / 60);
                const m = diffMins % 60;
                badgeHTML = `<div class="inline-flex items-center gap-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1 rounded-full text-xs font-bold mt-3 shadow-sm"><i class="far fa-clock"></i> Faltam ${h}h ${m}min</div>`;
            } else {
                badgeHTML = `<div class="inline-flex items-center gap-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1 rounded-full text-xs font-bold mt-3 shadow-sm"><i class="far fa-clock"></i> Faltam ${diffMins} min</div>`;
            }
        } else {
            const totalDuration = endMins - startMins;
            const elapsed = currentMinutes - startMins;
            const percentage = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
            const remaining = endMins - currentMinutes;

            badgeHTML = `<div class="inline-flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold mt-3 shadow-sm animate-pulse"><i class="fas fa-circle text-[8px]"></i> Acontecendo Agora</div>`;

            progressHTML = `
                <div class="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-1.5 mt-3">
                    <div class="bg-green-500 h-1.5 rounded-full transition-all duration-1000" style="width: ${percentage}%"></div>
                </div>
                <p class="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-1">Termina em ${remaining} min</p>
            `;
        }

        container.innerHTML = `
            <div class="animate-fade-in-up">
                <h2 class="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-1 truncate" title="${nextClass.name}">${nextClass.name}</h2>
                <p class="text-gray-500 dark:text-gray-400 font-medium mb-1 truncate">${nextClass.prof}</p>
                <div class="text-sm text-gray-600 dark:text-gray-300 flex gap-3 mt-2 items-center">
                    <span class="font-semibold flex items-center"><i class="fas fa-map-marker-alt mr-1.5 text-indigo-500"></i> ${nextClass.room}</span>
                    <span class="flex items-center text-gray-400 dark:text-gray-500 text-xs bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded">${nextClass.start} - ${nextClass.end}</span>
                </div>
                ${badgeHTML}
                ${progressHTML}
            </div>
        `;
    } else {
        const msg = scheduleData.length === 0 
            ? "Adicione aulas na Grade Horária." 
            : "Você está livre pelo resto do dia!";
        const icon = scheduleData.length === 0 ? "fas fa-plus-circle" : "fas fa-couch";
        const action = scheduleData.length === 0 ? "onclick=\"switchPage('aulas'); openAddClassModal()\" class='cursor-pointer hover:opacity-80 transition'" : "";

        container.innerHTML = `
            <div class="py-4 text-center" ${action}>
                <div class="w-12 h-12 bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400 dark:text-gray-500">
                        <i class="${icon} text-xl"></i>
                </div>
                <h2 class="text-lg font-bold text-gray-400 dark:text-gray-500 mb-1 leading-tight">Sem mais aulas</h2>
                <p class="text-xs text-gray-400 dark:text-gray-600 font-medium">${msg}</p>
            </div>
        `;
    }
}

// ============================================================
// --- FUNCIONALIDADE: LEMBRETES ---
// ============================================================

window.toggleRemindersModal = function() {
    const modal = document.getElementById('reminders-modal');
    const content = modal ? modal.firstElementChild : null;
    if (!modal) return;

    if (modal.classList.contains('hidden')) {
        history.pushState({modal: 'reminders'}, null, '#reminders-modal');
        renderReminders();
        modal.classList.remove('hidden');
        setTimeout(() => { modal.classList.remove('opacity-0'); if(content) { content.classList.remove('scale-95'); content.classList.add('scale-100'); } }, 10);
    } else {
        modal.classList.add('opacity-0'); if(content) { content.classList.remove('scale-100'); content.classList.add('scale-95'); }
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

window.showReminderForm = function() {
    document.getElementById('btn-add-reminder').classList.add('hidden');
    document.getElementById('reminder-form').classList.remove('hidden');
    document.getElementById('rem-date').valueAsDate = new Date();
}

window.hideReminderForm = function() {
    document.getElementById('reminder-form').classList.add('hidden');
    document.getElementById('btn-add-reminder').classList.remove('hidden');
    document.getElementById('rem-desc').value = '';
}

window.addReminder = function() {
    const desc = document.getElementById('rem-desc').value.trim();
    const date = document.getElementById('rem-date').value;
    const prio = document.getElementById('rem-prio').value;

    if (!desc) return;

    remindersData.push({
        id: Date.now().toString(),
        desc, date, prio,
        createdAt: Date.now()
    });

    saveData();
    hideReminderForm();
}

window.deleteReminder = function(id) {
    remindersData = remindersData.filter(r => r.id !== id);
    saveData();
}

window.renderReminders = function() {
    const listModal = document.getElementById('reminders-list-modal');
    const listHome = document.getElementById('home-reminders-list');
    const badge = document.getElementById('notification-badge');

    const sorted = [...remindersData].sort((a, b) => new Date(a.date) - new Date(b.date));

    if(badge) {
        if (sorted.length > 0) badge.classList.remove('hidden'); else badge.classList.add('hidden');
    }

    const generateHTML = (rem, isHome) => {
        const dateObj = new Date(rem.date + 'T00:00:00');
        let prioColor = 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400';
        if (rem.prio === 'high') prioColor = 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
        if (rem.prio === 'medium') prioColor = 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';

        const deleteBtn = isHome ? '' : `<button onclick="deleteReminder('${rem.id}')" class="text-gray-400 hover:text-red-500 transition px-2"><i class="fas fa-trash-alt"></i></button>`;

        return `
            <div class="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-neutral-800 bg-white dark:bg-darkcard hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition group">
                <div class="flex items-center gap-3 overflow-hidden">
                    <div class="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 flex-shrink-0">
                        <span class="text-xs font-bold uppercase text-gray-500 leading-none">${dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                        <span class="text-lg font-bold text-gray-800 dark:text-white leading-none">${dateObj.getDate()}</span>
                    </div>
                    <div class="min-w-0">
                        <p class="text-sm font-medium text-gray-800 dark:text-white truncate">${rem.desc}</p>
                        <span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${prioColor}">${rem.prio === 'high' ? 'Alta' : (rem.prio === 'medium' ? 'Média' : 'Baixa')}</span>
                    </div>
                </div>
                ${deleteBtn}
            </div>
        `;
    };

    if(listModal) {
        if (sorted.length === 0) {
            listModal.innerHTML = `
                <div class="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-600">
                    <i class="fas fa-exclamation-circle text-3xl mb-2 opacity-20"></i>
                    <p class="text-sm">Nenhum lembrete. <br>Use o botão acima para adicionar.</p>
                </div>`;
        } else {
            listModal.innerHTML = sorted.map(r => generateHTML(r, false)).join('');
        }
    }

    if(listHome) {
        if (sorted.length === 0) {
            listHome.innerHTML = `
                <div class="flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-gray-100 dark:border-neutral-800 rounded-lg h-full">
                    <p class="text-gray-400 dark:text-gray-500 font-medium">Nenhum lembrete de alta prioridade.</p>
                </div>`;
        } else {
            listHome.innerHTML = sorted.slice(0, 3).map(r => generateHTML(r, true)).join('');
        }
    }
}

// ============================================================
// --- FUNCIONALIDADE: ONIBUS E ROTAS ---
// ============================================================

function addTime(baseTime, minutesToAdd) { 
    const [h, m] = baseTime.split(':').map(Number); 
    const date = new Date(); 
    date.setHours(h); 
    date.setMinutes(m + minutesToAdd); 
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); 
}

function createTrip(startTime, endTime, routeType, speed = 'normal') {
    let stops = []; const factor = speed === 'fast' ? 0.7 : 1.0;
    if (routeType === 'saida-garagem') { 
        stops = [{ loc: 'Garagem (Saída)', t: 0 }, { loc: 'RU/Resid.', t: Math.round(2 * factor) }, { loc: 'Fitotecnia', t: Math.round(4 * factor) }, { loc: 'Prédio Solos', t: Math.round(6 * factor) }, { loc: 'Pav. Aulas I', t: Math.round(8 * factor) }, { loc: 'Biblioteca', t: Math.round(10 * factor) }, { loc: 'Pav. Aulas II', t: Math.round(12 * factor) }, { loc: 'Pav. Engenharia', t: Math.round(13 * factor) }, { loc: 'Portão II', t: Math.round(15 * factor) }, { loc: 'Ponto Ext. I', t: Math.round(16 * factor) }, { loc: 'Ponto Ext. II', t: Math.round(17 * factor) }, { loc: 'Portão I', t: Math.round(18 * factor) }, { loc: 'Biblioteca', t: Math.round(20 * factor) }, { loc: 'Torre/COTEC', t: Math.round(22 * factor) }, { loc: 'RU (Chegada)', t: Math.round(24 * factor) }]; 
    } else if (routeType === 'volta-campus') { 
        stops = [{ loc: 'RU/Resid. (Início)', t: 0 }, { loc: 'Fitotecnia', t: Math.round(2 * factor) }, { loc: 'Prédio Solos', t: Math.round(4 * factor) }, { loc: 'Pav. Aulas I', t: Math.round(6 * factor) }, { loc: 'Biblioteca', t: Math.round(8 * factor) }, { loc: 'Pav. Aulas II', t: Math.round(10 * factor) }, { loc: 'Pav. Engenharia', t: Math.round(11 * factor) }, { loc: 'Portão II', t: Math.round(13 * factor) }, { loc: 'Ponto Ext. I', t: Math.round(14 * factor) }, { loc: 'Ponto Ext. II', t: Math.round(15 * factor) }, { loc: 'Portão I', t: Math.round(16 * factor) }, { loc: 'Biblioteca', t: Math.round(18 * factor) }, { loc: 'Torre/COTEC', t: Math.round(20 * factor) }, { loc: 'RU (Fim)', t: Math.round(22 * factor) }]; 
    } else if (routeType === 'recolhe') { 
        stops = [{ loc: 'RU/Resid.', t: 0 }, { loc: 'Fitotecnia', t: 2 }, { loc: 'Prédio Solos', t: 4 }, { loc: 'Eng. Florestal', t: 6 }, { loc: 'Garagem (Chegada)', t: Math.round(15 * factor) }]; 
    } else if (routeType === 'volta-e-recolhe') { 
        stops = [{ loc: 'RU/Resid. (Início)', t: 0 }, { loc: 'Fitotecnia', t: 2 }, { loc: 'Prédio Solos', t: 3 }, { loc: 'Pav. Aulas I', t: 5 }, { loc: 'Biblioteca', t: 6 }, { loc: 'Pav. Aulas II', t: 8 }, { loc: 'Pav. Engenharia', t: 9 }, { loc: 'Portão II', t: 10 }, { loc: 'Ponto Ext. I', t: 11 }, { loc: 'Ponto Ext. II', t: 12 }, { loc: 'Portão I', t: 13 }, { loc: 'Biblioteca', t: 14 }, { loc: 'Torre/COTEC', t: 16 }, { loc: 'RU (Fim Volta)', t: 18 }, { loc: 'Fitotecnia', t: 20 }, { loc: 'Prédio Solos', t: 21 }, { loc: 'Eng. Florestal', t: 23 }, { loc: 'Garagem (Chegada)', t: 25 }]; 
    }
    
    return { 
        start: startTime, 
        end: endTime, 
        origin: stops[0].loc, 
        dest: stops[stops.length - 1].loc, 
        stops: stops.map(s => { 
            if ((routeType === 'recolhe' || routeType === 'volta-e-recolhe') && s.loc.includes('Garagem')) return { loc: s.loc, time: endTime }; 
            return { loc: s.loc, time: addTime(startTime, s.t) }; 
        }) 
    };
}

const busSchedule = [
    createTrip('06:25', '06:50', 'saida-garagem'), createTrip('06:50', '07:10', 'volta-campus', 'fast'), createTrip('07:10', '07:25', 'volta-campus', 'fast'), createTrip('07:25', '07:40', 'volta-campus', 'fast'), createTrip('07:40', '07:55', 'volta-campus', 'fast'), createTrip('07:55', '08:20', 'volta-e-recolhe'),
    createTrip('09:35', '10:00', 'saida-garagem'), createTrip('10:00', '10:25', 'volta-e-recolhe'), createTrip('11:30', '11:55', 'saida-garagem'), createTrip('11:55', '12:20', 'volta-campus'), createTrip('12:20', '12:45', 'volta-e-recolhe'),
    createTrip('13:00', '13:25', 'saida-garagem'), createTrip('13:25', '13:45', 'volta-campus'), createTrip('13:45', '14:00', 'volta-campus'), createTrip('14:00', '14:25', 'volta-e-recolhe'),
    createTrip('15:35', '16:00', 'saida-garagem'), createTrip('16:00', '16:25', 'volta-e-recolhe'), createTrip('17:30', '17:55', 'saida-garagem'), createTrip('17:55', '18:15', 'volta-campus'), createTrip('18:15', '18:40', 'volta-e-recolhe'),
    createTrip('20:40', '21:00', 'volta-e-recolhe', 'fast'), createTrip('21:40', '22:00', 'volta-e-recolhe', 'fast'), createTrip('22:30', '22:50', 'volta-e-recolhe', 'fast')
];

function renderBusTable() {
    const tbody = document.getElementById('bus-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    busSchedule.forEach(bus => {
        const row = document.createElement('tr'); row.className = "hover:bg-gray-50 dark:hover:bg-darkhover transition border-b border-gray-100 dark:border-neutral-800";
        const stopsStr = bus.stops.map(s => `<span class="inline-flex items-center bg-gray-100 dark:bg-neutral-800 rounded px-2 py-1 text-xs mr-2 mb-1 border border-gray-200 dark:border-neutral-700"><span class="font-mono font-bold text-indigo-600 dark:text-indigo-400 mr-1">${s.time}</span><span class="text-gray-600 dark:text-gray-300">${s.loc}</span></span>`).join('');
        row.innerHTML = `<td class="px-6 py-4 whitespace-nowrap align-top"><div class="text-sm font-bold text-gray-900 dark:text-white">${bus.start}</div><div class="text-xs text-gray-500 dark:text-gray-400">até ${bus.end}</div></td><td class="px-6 py-4 align-top"><div class="flex flex-wrap gap-1">${stopsStr}</div></td>`;
        tbody.appendChild(row);
    });
}

function updateNextBus() {
    const now = new Date(); const currentTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    let activeBus = null; let nextBus = null; let timeDiff = Infinity;
    
    for (let bus of busSchedule) {
        const [h1, m1] = bus.start.split(':').map(Number); const [h2, m2] = bus.end.split(':').map(Number);
        const startSeconds = h1 * 3600 + m1 * 60; const endSeconds = h2 * 3600 + m2 * 60;
        if (currentTotalSeconds >= startSeconds && currentTotalSeconds < endSeconds) { activeBus = bus; break; }
        if (startSeconds > currentTotalSeconds) { const diff = startSeconds - currentTotalSeconds; if (diff < timeDiff) { timeDiff = diff; nextBus = bus; } }
    }
    
    const container = document.getElementById('bus-dynamic-area'); const title = document.getElementById('dash-bus-title'); const subtitle = document.getElementById('dash-bus-subtitle');
    const statusDot = document.getElementById('bus-status-dot'); const statusText = document.getElementById('bus-status-text');
    
    if (!container || !title) return;

    if (activeBus) {
        statusDot.className = "w-2 h-2 rounded-full bg-green-500 animate-pulse"; statusText.innerText = "Em Trânsito"; statusText.className = "text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider";
        title.innerText = activeBus.end; subtitle.innerText = `Destino: ${activeBus.dest}`;
        let timelineHtml = '<div class="relative pl-3 border-l-2 border-gray-200 dark:border-neutral-800 space-y-4 ml-1">';
        const upcomingStops = activeBus.stops.filter(s => { const [sh, sm] = s.time.split(':').map(Number); const stopSeconds = sh * 3600 + sm * 60; return stopSeconds >= (currentTotalSeconds - 60); }).slice(0, 3);
        if (upcomingStops.length === 0) timelineHtml += '<p class="text-xs text-gray-500 pl-2">Chegando ao destino...</p>';
        upcomingStops.forEach((stop, idx) => {
            let dotClass = idx === 0 ? "bg-green-500 ring-4 ring-green-100 dark:ring-green-900/30" : "bg-gray-300 dark:bg-neutral-700";
            let textClass = idx === 0 ? "text-green-700 dark:text-green-400 font-bold" : "text-gray-600 dark:text-gray-400";
            let animClass = "animate-fade-in-up";
            timelineHtml += `<div class="relative flex items-start route-item ${animClass}" style="animation-delay: ${idx * 100}ms"><div class="absolute -left-[19px] w-3 h-3 rounded-full ${dotClass} border-2 border-white dark:border-darkcard mt-1.5 transition-colors duration-500"></div><div class="flex justify-between w-full items-start pl-2"><span class="text-sm ${textClass} transition-colors duration-500">${stop.loc}</span><div class="text-right"><span class="text-xs font-mono text-gray-700 dark:text-gray-300 font-bold">${stop.time}</span><span class="block text-[9px] text-red-500 font-bold uppercase tracking-wide leading-tight">Estimativa</span></div></div></div>`;
        });
        timelineHtml += '</div>'; if (container.innerHTML !== timelineHtml) { container.innerHTML = timelineHtml; }
    } else if (nextBus) {
        statusDot.className = "w-2 h-2 rounded-full bg-indigo-500"; statusText.innerText = "Próximo Circular"; statusText.className = "text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider";
        title.innerText = nextBus.start; subtitle.innerText = `${nextBus.origin} ➔ ${nextBus.dest}`;
        const hours = Math.floor(timeDiff / 3600); const minutes = Math.floor((timeDiff % 3600) / 60); const seconds = timeDiff % 60;
        let timeString = ""; if (hours > 0) timeString += `${hours}h `; timeString += `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
        let badgeClass = timeDiff <= 900 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 animate-pulse" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300";
        container.innerHTML = `<div class="flex items-center h-full"><div class="w-full py-3 rounded-lg text-center font-bold text-sm ${badgeClass}">Saída em ${timeString}</div></div>`;
    } else {
        statusDot.className = "w-2 h-2 rounded-full bg-gray-400"; statusText.innerText = "Encerrado"; title.innerText = "Fim"; subtitle.innerText = "Sem mais viagens hoje"; container.innerHTML = `<div class="w-full py-3 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 text-center text-sm font-medium mt-auto">Volta amanhã</div>`;
    }
}

// ============================================================
// --- FUNCIONALIDADE: CALCULADORA ---
// ============================================================

window.addGradeRow = function() {
    const container = document.getElementById('grades-container');
    if (!container) return;
    
    const div = document.createElement('div'); div.className = "flex gap-3 items-center fade-in";
    div.innerHTML = `
        <div class="flex-grow relative group">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><i class="fas fa-file-alt"></i></div>
            <input type="text" inputmode="decimal" class="grade-input w-full bg-gray-50 dark:bg-neutral-900/50 border border-gray-300 dark:border-neutral-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition dark:text-white font-medium" placeholder="Sua Nota (ex: 8.5)">
        </div>
        <div class="w-28 relative group">
            <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400"><i class="fas fa-balance-scale"></i></div>
            <input type="text" inputmode="decimal" value="1" class="weight-input w-full bg-gray-50 dark:bg-neutral-900/50 border border-gray-300 dark:border-neutral-700 rounded-xl pl-10 pr-4 py-3 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition dark:text-white font-medium text-center" placeholder="Peso">
        </div>
    `;
    container.appendChild(div);
    div.querySelectorAll('input').forEach(i => i.addEventListener('input', calculateAverage));
}

function parseLocalFloat(val) {
    if (!val) return NaN;
    return parseFloat(val.replace(',', '.'));
}

window.calculateAverage = function() {
    let totalScore = 0, totalWeight = 0, hasInput = false;
    const passingEl = document.getElementById('passing-grade');
    if(!passingEl) return;
    const passing = parseFloat(passingEl.value) || 6.0;

    document.querySelectorAll('.grade-input').forEach((inp, i) => {
        const val = parseLocalFloat(inp.value);
        const weightInps = document.querySelectorAll('.weight-input');
        if(weightInps[i]) {
            let wStr = weightInps[i].value;
            let w = parseLocalFloat(wStr);
            if (isNaN(w) && !isNaN(val)) w = 1;
            if (!isNaN(val) && !isNaN(w)) {
                hasInput = true;
                totalScore += val * w;
                totalWeight += w;
            }
        }
    });

    const display = document.getElementById('result-display');
    const feedback = document.getElementById('result-feedback');

    if (!hasInput || totalWeight === 0) {
        display.innerText = "--";
        display.className = "text-6xl font-black text-gray-300 dark:text-gray-600 mb-6 transition-all duration-500";
        feedback.innerHTML = '<p class="text-gray-400 text-sm italic">Adicione notas para ver o resultado...</p>';
        return;
    }

    const avg = totalScore / totalWeight;
    display.innerText = avg.toFixed(2);

    if (avg >= passing) {
        display.className = "text-6xl font-black text-green-500 dark:text-green-400 mb-6 transition-all duration-500 scale-110";
        feedback.innerHTML = `
            <div class="flex flex-col items-center animate-scale-in">
                <img src="https://media.tenor.com/q9CixI3CcrkAAAAj/dance.gif" class="w-32 h-32 object-contain mb-4 drop-shadow-lg rounded-full">
                <p class="text-green-600 dark:text-green-400 font-bold text-lg">Parabéns! Aprovado!</p>
            </div>
        `;
    } else {
        display.className = "text-6xl font-black text-red-500 dark:text-red-400 mb-6 transition-all duration-500";
        feedback.innerHTML = `
            <div class="flex flex-col items-center animate-scale-in">
                <img src="https://media.tenor.com/qL2ySe3uUgQAAAAj/gatto.gif" class="w-32 h-32 object-contain mb-4 drop-shadow-lg rounded-lg">
                <p class="text-red-600 dark:text-red-400 font-bold text-lg">Ixi... Não foi dessa vez.</p>
            </div>
        `;
    }
}

window.resetCalc = function() {
    const container = document.getElementById('grades-container');
    if(container) container.innerHTML = '';
    addGradeRow(); addGradeRow();
    calculateAverage();
}

// ============================================================
// --- FUNCIONALIDADE: POMODORO ---
// ============================================================

let timerInterval1, timeLeft1 = 25 * 60, isRunning1 = false, currentMode1 = 'pomodoro';
const modes1 = { 'pomodoro': 25 * 60, 'short': 5 * 60, 'long': 15 * 60 };

function updateTimerDisplay() {
    const m = Math.floor(timeLeft1 / 60), s = timeLeft1 % 60;
    const display = document.getElementById('timer-display');
    const circle = document.getElementById('timer-circle');
    
    if(display) display.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    if(circle) circle.style.strokeDashoffset = 816 - (timeLeft1 / modes1[currentMode1]) * 816;
}

window.toggleTimer = function() {
    const btn = document.getElementById('btn-start');
    if(!btn) return;
    if (isRunning1) {
        clearInterval(timerInterval1); isRunning1 = false; btn.innerHTML = '<i class="fas fa-play pl-1"></i>'; btn.classList.replace('bg-red-600', 'bg-indigo-600'); btn.classList.replace('hover:bg-red-700', 'hover:bg-indigo-700');
    }
    else {
        isRunning1 = true; btn.innerHTML = '<i class="fas fa-pause"></i>'; btn.classList.replace('bg-indigo-600', 'bg-red-600'); btn.classList.replace('hover:bg-indigo-700', 'hover:bg-red-700');
        timerInterval1 = setInterval(() => {
            timeLeft1--; if (timeLeft1 <= 0) { 
                clearInterval(timerInterval1); isRunning1 = false; showModal('Tempo', 'O tempo acabou!'); toggleTimer(); return;
            } updateTimerDisplay();
        }, 1000);
    }
}

window.resetTimer = function() { if (isRunning1) toggleTimer(); timeLeft1 = modes1[currentMode1]; updateTimerDisplay(); }

window.setTimerMode = function(m) {
    ['pomodoro', 'short', 'long'].forEach(mode => {
        const btn = document.getElementById(`mode-${mode}`);
        if (btn) {
            if (mode === m) { btn.classList.add('bg-white', 'dark:bg-neutral-700', 'text-gray-800', 'dark:text-white', 'shadow-sm'); btn.classList.remove('text-gray-500', 'dark:text-gray-400'); }
            else { btn.classList.remove('bg-white', 'dark:bg-neutral-700', 'text-gray-800', 'dark:text-white', 'shadow-sm'); btn.classList.add('text-gray-500', 'dark:text-gray-400'); }
        }
    }); 
    currentMode1 = m; 
    const label = document.getElementById('timer-label');
    if(label) label.innerText = m === 'pomodoro' ? 'Foco' : (m === 'short' ? 'Curta' : 'Longa'); 
    resetTimer();
}

// ============================================================
// --- FUNCIONALIDADE: OUTROS ---
// ============================================================

const templates = {
    deadline: `Prezado(a) Prof(a). [Nome],\n\nSolicito respeitosamente uma extensão no prazo do trabalho [Nome], originalmente para [Data]. Tive um imprevisto [Motivo] e preciso de mais tempo para entregar com qualidade.\n\nAtenciosamente,\n[Seu Nome]`,
    review: `Prezado(a) Prof(a). [Nome],\n\nGostaria de solicitar a revisão da minha prova de [Matéria]. Fiquei com dúvida na questão [X].\n\nAtenciosamente,\n[Seu Nome]`,
    absence: `Prezado(a) Prof(a). [Nome],\n\nJustifico minha falta no dia [Data] devido a [Motivo]. Segue anexo (se houver).\n\nAtenciosamente,\n[Seu Nome]`,
    tcc: `Prezado(a) Prof(a). [Nome],\n\nTenho interesse em sua área de pesquisa e gostaria de saber se há disponibilidade para orientação de TCC sobre [Tema].\n\nAtenciosamente,\n[Seu Nome]`
};

window.loadTemplate = function(k) { document.getElementById('email-content').value = templates[k]; }
window.copyEmail = function() { const e = document.getElementById('email-content'); e.select(); document.execCommand('copy'); }
window.openPortal = function() { window.open('https://sistemas.ufrb.edu.br/sigaa/verTelaLogin.do', '_blank'); }

// ============================================================
// --- TEMA E CORES ---
// ============================================================

const colorPalettes = {
    cyan: { 50: '236 254 255', 100: '207 250 254', 200: '165 243 252', 300: '103 232 249', 400: '34 211 238', 500: '6 182 212', 600: '8 145 178', 700: '14 116 144', 800: '21 94 117', 900: '22 78 99' },
    red: { 50: '254 242 242', 100: '254 226 226', 200: '254 202 202', 300: '252 165 165', 400: '248 113 113', 500: '239 68 68', 600: '220 38 38', 700: '185 28 28', 800: '153 27 27', 900: '127 29 29' },
    green: { 50: '240 253 244', 100: '220 252 231', 200: '187 247 208', 300: '134 239 172', 400: '74 222 128', 500: '34 197 94', 600: '22 163 74', 700: '21 128 61', 800: '22 101 52', 900: '20 83 45' },
    yellow: { 50: '254 252 232', 100: '254 249 195', 200: '254 240 138', 300: '253 224 71', 400: '250 204 21', 500: '234 179 8', 600: '202 138 4', 700: '161 98 7', 800: '133 77 14', 900: '113 63 18' },
    purple: { 50: '250 245 255', 100: '243 232 255', 200: '233 213 255', 300: '216 180 254', 400: '192 132 252', 500: '168 85 247', 600: '147 51 234', 700: '126 34 206', 800: '107 33 168', 900: '88 28 135' },
    pink: { 50: '253 242 248', 100: '252 231 243', 200: '251 204 231', 300: '249 168 212', 400: '244 114 182', 500: '236 72 153', 600: '219 39 119', 700: '190 24 93', 800: '157 23 77', 900: '131 24 67' },
    orange: { 50: '255 247 237', 100: '255 237 213', 200: '254 215 170', 300: '253 186 116', 400: '251 146 60', 500: '249 115 22', 600: '234 88 12', 700: '194 65 12', 800: '154 52 18', 900: '124 45 18' },
    indigo: { 50: '238 242 255', 100: '224 231 255', 200: '199 210 254', 300: '165 180 252', 400: '129 140 248', 500: '99 102 241', 600: '79 70 229', 700: '67 56 202', 800: '55 48 163', 900: '49 46 129' },
    teal: { 50: '240 253 250', 100: '204 251 241', 200: '153 246 228', 300: '94 234 212', 400: '45 212 191', 500: '20 184 166', 600: '13 148 136', 700: '15 118 110', 800: '17 94 89', 900: '19 78 74' },
    rose: { 50: '255 241 242', 100: '255 228 230', 200: '254 205 211', 300: '253 164 175', 400: '251 113 133', 500: '244 63 94', 600: '225 29 72', 700: '190 18 60', 800: '159 18 57', 900: '136 19 55' },
    lime: { 50: '247 254 231', 100: '236 252 203', 200: '217 249 157', 300: '190 242 100', 400: '163 230 53', 500: '132 204 22', 600: '101 163 13', 700: '77 124 15', 800: '63 98 18', 900: '54 83 20' },
    violet: { 50: '245 243 255', 100: '237 233 254', 200: '221 214 254', 300: '196 181 253', 400: '167 139 250', 500: '139 92 246', 600: '124 58 237', 700: '109 40 217', 800: '91 33 182', 900: '76 29 149' },
    black: { 50: '250 250 250', 100: '244 244 245', 200: '228 228 231', 300: '212 212 216', 400: '161 161 170', 500: '113 113 122', 600: '82 82 91', 700: '63 63 70', 800: '39 39 42', 900: '24 24 27' }
};

function initTheme() {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    const savedColor = localStorage.getItem('salvese_color');
    if (savedColor) updateColorVars(JSON.parse(savedColor));
}
initTheme();

window.toggleTheme = function() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}

window.toggleColorMenu = function(device) {
    const menu = document.getElementById(`color-menu-${device}`);
    if (!menu) return;
    const isHidden = menu.classList.contains('hidden');
    document.querySelectorAll('.color-menu').forEach(m => m.classList.add('hidden'));
    if (isHidden) {
        menu.innerHTML = '';
        Object.keys(colorPalettes).forEach(color => {
            const btn = document.createElement('button');
            const rgb = colorPalettes[color][500];
            btn.className = `w-6 h-6 rounded-full border border-gray-200 dark:border-gray-700 hover:scale-110 transition transform focus:outline-none ring-2 ring-transparent focus:ring-offset-1 focus:ring-gray-400`;
            btn.style.backgroundColor = `rgb(${rgb})`;
            btn.title = color.charAt(0).toUpperCase() + color.slice(1);
            btn.onclick = () => setThemeColor(color);
            menu.appendChild(btn);
        });
        menu.classList.remove('hidden');
        menu.classList.add('visible');
    }
}

function setThemeColor(colorName) {
    const palette = colorPalettes[colorName];
    if (!palette) return;
    
    const iconColor = colorName === 'black' ? `rgb(${palette[900]})` : `rgb(${palette[600]})`;
    
    document.querySelectorAll('#desktop-palette-icon, #mobile-palette-icon').forEach(icon => {
        icon.classList.remove('text-indigo-600');
        icon.style.color = iconColor;
        if (colorName === 'black' && document.documentElement.classList.contains('dark')) {
             icon.style.color = '#ffffff';
        }
    });

    updateColorVars(palette);
    localStorage.setItem('salvese_color', JSON.stringify(palette));
    document.querySelectorAll('.color-menu').forEach(m => m.classList.add('hidden'));
}

function updateColorVars(palette) {
    const root = document.documentElement;
    Object.keys(palette).forEach(shade => {
        root.style.setProperty(`--theme-${shade}`, palette[shade]);
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('button[onclick^="toggleColorMenu"]') && !e.target.closest('.color-menu')) {
        document.querySelectorAll('.color-menu').forEach(m => m.classList.add('hidden'));
    }
});

let clockMode = 0;
window.cycleClockMode = function() { clockMode = (clockMode + 1) % 4; updateClock(); }
function updateClock() {
    const now = new Date();
    let timeString = "";
    if (clockMode === 0) timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    else if (clockMode === 1) timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    else if (clockMode === 2) timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: true });
    else {
        const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        timeString = `${date} • ${time}`;
    }
    
    const clockEls = document.querySelectorAll('#clock');
    clockEls.forEach(el => el.innerText = timeString);
}
setInterval(updateClock, 1000); updateClock();

// ============================================================
// --- PWA E INICIALIZAÇÃO ---
// ============================================================

const manifest = {
    "name": "Salve-se UFRB",
    "short_name": "Salve-se",
    "start_url": ".",
    "display": "standalone",
    "background_color": "#09090b",
    "theme_color": "#4f46e5",
    "icons": [
        { "src": "https://files.catbox.moe/pmdtq6.png", "sizes": "192x192", "type": "image/png" },
        { "src": "https://files.catbox.moe/pmdtq6.png", "sizes": "512x512", "type": "image/png" }
    ]
};
const stringManifest = JSON.stringify(manifest);
const blobManifest = new Blob([stringManifest], { type: 'application/json' });
const manifestURL = URL.createObjectURL(blobManifest);
const pwaManifestLink = document.querySelector('#pwa-manifest');
if (pwaManifestLink) {
    pwaManifestLink.setAttribute('href', manifestURL);
}

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                reg.update();
            })
            .catch(err => console.log('SW falhou:', err));
    });

    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtn = document.getElementById('btn-install-pwa');
        if (installBtn) {
            installBtn.classList.remove('hidden');
            installBtn.addEventListener('click', () => {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => {
                    deferredPrompt = null;
                    installBtn.classList.add('hidden');
                });
            });
        }
    });

    function updateNetworkStatus() {
        const toast = document.getElementById('network-toast');
        const text = document.getElementById('network-text');
        const icon = toast ? toast.querySelector('i') : null;

        if (toast && text && icon) {
            if (navigator.onLine) {
                toast.className = 'network-status online show';
                text.innerText = 'Online';
                icon.className = 'fas fa-wifi';
                setTimeout(() => toast.classList.remove('show'), 3000);
                if(currentUser) refreshAllUI(); 
            } else {
                toast.className = 'network-status offline show';
                text.innerText = 'Offline';
                icon.className = 'fas fa-wifi-slash';
            }
        }
    }
    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
}

// Inicialização DOM
document.addEventListener('DOMContentLoaded', () => {
    window.renderTasks();
    window.renderReminders();
    if (window.renderSchedule) window.renderSchedule();
    window.updateNextClassWidget();
    renderBusTable(); 
    updateNextBus(); 
    setInterval(updateNextBus, 1000);
    
    // Auto-select Home on sidebar
    const activeMobileLink = document.querySelector(`#mobile-menu nav a[onclick*="'home'"]`);
    if(activeMobileLink) {
         activeMobileLink.classList.add('bg-indigo-50', 'text-indigo-600', 'dark:bg-indigo-900/50', 'dark:text-indigo-300');
         activeMobileLink.classList.remove('text-gray-600', 'dark:text-gray-400');
    }

    setInterval(window.updateNextClassWidget, 60000);
    
    addGradeRow(); addGradeRow();
    if(document.getElementById('passing-grade')) document.getElementById('passing-grade').addEventListener('input', calculateAverage);
});

// History Handling
window.addEventListener('popstate', (event) => {
    const classModal = document.getElementById('class-modal');
    const remindersModal = document.getElementById('reminders-modal');
    const genericModal = document.getElementById('generic-modal');

    if (classModal && !classModal.classList.contains('hidden')) {
        classModal.classList.add('opacity-0'); 
        setTimeout(() => classModal.classList.add('hidden'), 300);
        return;
    }
    
    if (remindersModal && !remindersModal.classList.contains('hidden')) {
        remindersModal.classList.add('opacity-0');
        setTimeout(() => remindersModal.classList.add('hidden'), 300);
        return;
    }

    if (genericModal && !genericModal.classList.contains('hidden')) {
        closeGenericModal();
        return;
    }

    if (event.state && event.state.view) {
        switchPage(event.state.view, false);
    } else {
        switchPage('home', false);
    }
});