
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
    sendPasswordResetEmail,
    signInWithCustomToken,
    signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    setDoc,
    getDoc,
    deleteDoc,
    onSnapshot,
    enableIndexedDbPersistence,
    collection
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- CONFIGURAÇÃO DO FIREBASE (ISSO PRECISA FICAR AQUI!) ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {
    apiKey: "AIzaSyD5Ggqw9FpMS98CHcfXKnghMQNMV5WIVTw",
    authDomain: "salvee-se.firebaseapp.com",
    projectId: "salvee-se",
    storageBucket: "salvee-se.firebasestorage.app",
    messagingSenderId: "132544174908",
    appId: "1:132544174908:web:00c6aa4855cc18ed2cdc39"
};

// ============================================================
// --- CONFIGURAÇÃO DAS IAS(VIA VERCEL) ---
// ============================================================

// Controle de qual IA está ativa
let currentAIProvider = 'gemini';

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Tentativa de persistência offline
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

// Dados Locais
let scheduleData = JSON.parse(localStorage.getItem('salvese_schedule')) || [];
let tasksData = JSON.parse(localStorage.getItem('salvese_tasks')) || [];
let remindersData = JSON.parse(localStorage.getItem('salvese_reminders')) || [];
let notesData = JSON.parse(localStorage.getItem('salvese_notes')) || [];
let hiddenWidgets = JSON.parse(localStorage.getItem('salvese_hidden_widgets')) || [];
let widgetStyles = JSON.parse(localStorage.getItem('salvese_widget_styles')) || {};

// Configurações de Visualização
let scheduleViewMode = localStorage.getItem('salvese_schedule_mode') || 'table';

// Estados Temporários
let selectedClassIdToDelete = null;
let currentTaskFilter = 'all';
let chatHistory = [];
let currentViewContext = 'home';
let activeNoteId = null;
let saveTimeout = null;

// Conteúdo do Widget da IA
let aiWidgetContent = localStorage.getItem('salvese_ai_widget') || "Olá! Sou sua IA. Vou postar dicas úteis aqui.";

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
    chevron: `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`
};

// ============================================================
// --- BOOTSTRAP E AUTH ---
// ============================================================

const sessionActive = localStorage.getItem('salvese_session_active');

// Timeout de segurança para remover o loading se o Firebase demorar ou falhar
const forceLoadTimeout = setTimeout(() => {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
        if (sessionActive === 'true') {
            loadAppOfflineMode();
        } else {
            showLoginScreen();
        }
    }
}, 4000);

// Autenticação Inicial
const initAuth = async () => {
    if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
    }
};
initAuth();

onAuthStateChanged(auth, async (user) => {
    clearTimeout(forceLoadTimeout);

    if (user) {
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
                if (user.isAnonymous) {
                    userProfile = { displayName: 'Visitante', handle: 'visitante', semester: 'N/A' };
                    showAppInterface();
                } else {
                    showProfileSetupScreen();
                }
            }
        } catch (e) {
            console.error("Erro ao buscar perfil:", e);
            if (sessionActive === 'true') loadAppOfflineMode();
            else showProfileSetupScreen();
        }

    } else {
        currentUser = null;
        userProfile = null;
        if (unsubscribeData) unsubscribeData();

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

    if (loginScreen) loginScreen.classList.add('hidden');
    if (profileScreen) profileScreen.classList.add('hidden');
    if (appContent) appContent.classList.remove('hidden');

    updateUserInterfaceInfo();
    refreshAllUI();

    // Força a chamada inicial para ajustar layout se já estiver na home
    if (currentViewContext === 'home') {
        const main = document.querySelector('main');
        if (main) {
            main.className = "flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8";
        }
    }

    injectWidgetControls();

    if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
        loadingScreen.classList.add('opacity-0');
        setTimeout(() => loadingScreen.classList.add('hidden'), 500);
    }

    updateAIWidgetUI();
    applyWidgetVisibility();
    applyAllWidgetStyles();
}

function showLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    const profileScreen = document.getElementById('profile-setup-screen');
    const appContent = document.querySelector('.app-content-wrapper');
    const loadingScreen = document.getElementById('loading-screen');

    if (loginScreen) loginScreen.classList.remove('hidden');
    if (profileScreen) profileScreen.classList.add('hidden');
    if (appContent) appContent.classList.add('hidden');

    if (loadingScreen && !loadingScreen.classList.contains('hidden')) {
        loadingScreen.classList.add('opacity-0');
        setTimeout(() => loadingScreen.classList.add('hidden'), 500);
    }
}

function showProfileSetupScreen() {
    const loginScreen = document.getElementById('login-screen');
    const profileScreen = document.getElementById('profile-setup-screen');
    const appContent = document.querySelector('.app-content-wrapper');
    const loadingScreen = document.getElementById('loading-screen');

    if (loginScreen) loginScreen.classList.add('hidden');
    if (profileScreen) profileScreen.classList.remove('hidden');
    if (appContent) appContent.classList.add('hidden');
    if (loadingScreen) loadingScreen.classList.add('hidden');
}

window.fixChatLayout = function () {
    const viewIA = document.getElementById('view-ia');
    const messageContainer = document.getElementById('chat-messages-container');
    const inputContainer = viewIA ? viewIA.querySelector('.w-full.p-4.border-t') : null;

    if (viewIA) {
        // IMPORTANTE: Removi a linha que forçava remover o 'hidden' aqui.
        // Agora o chat obedece a navegação e só aparece quando chamado.

        viewIA.classList.add('flex');

        // A altura agora é 100% do pai (<main>), que não tem padding
        viewIA.style.height = "100%";

        if (messageContainer) {
            messageContainer.className = "flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth";
            messageContainer.style.paddingBottom = "20px";
        }

        if (inputContainer) {
            inputContainer.className = "flex-none w-full p-4 bg-white dark:bg-darkcard border-t border-gray-200 dark:border-darkborder z-20";
            inputContainer.style.position = "relative";
            inputContainer.style.bottom = "auto";
        }
    }
}

window.switchPage = function (pageId, addToHistory = true) {
    currentViewContext = pageId;

    // CORREÇÃO DE LAYOUT: Ajustar o container <main> dependendo da tela
    const mainContainer = document.querySelector('main');
    if (mainContainer) {
        if (pageId === 'ia') {
            // Na IA, removemos padding e scroll do main para o chat gerenciar seu próprio scroll
            mainContainer.className = "flex-1 flex flex-col h-full overflow-hidden p-0 bg-gray-50 dark:bg-darkbg";
        } else {
            // Nas outras telas, usamos o layout padrão com padding e scroll
            mainContainer.className = "flex-1 overflow-y-auto p-4 md:p-8 pb-24 md:pb-8";
        }
    }

    // Esconde todas as views
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));

    // Mostra APENAS a view alvo
    const target = document.getElementById(`view-${pageId}`);
    if (target) target.classList.remove('hidden');

    // Atualiza Menu Ativo
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeLink = document.getElementById(`nav-${pageId}`);
    if (activeLink) activeLink.classList.add('active');

    // Atualiza Menu Mobile
    const mobileNavLinks = document.querySelectorAll('#mobile-menu nav a');
    mobileNavLinks.forEach(link => {
        link.classList.remove('bg-indigo-50', 'text-indigo-600', 'dark:bg-indigo-900/50', 'dark:text-indigo-300');
        link.classList.add('text-gray-600', 'dark:text-gray-400');

        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(`'${pageId}'`)) {
            link.classList.add('bg-indigo-50', 'text-indigo-600', 'dark:bg-indigo-900/50', 'dark:text-indigo-300');
            link.classList.remove('text-gray-600', 'dark:text-gray-400');
        }
    });

    // Títulos da Página
    const titles = {
        home: 'Página Principal',
        onibus: 'Transporte',
        calc: 'Calculadora',
        pomo: 'Modo Foco',
        todo: 'Tarefas',
        email: 'Templates',
        aulas: 'Grade Horária',
        config: 'Configurações',
        notas: 'Anotações',
        ia: 'Salve-se IA',
        ocultos: 'Widgets Ocultos'
    };
    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) pageTitleEl.innerText = titles[pageId] || 'Salve-se UFRB';

    // Renderizações Específicas
    if (pageId === 'aulas' && window.renderSchedule) window.renderSchedule();
    if (pageId === 'config' && window.renderSettings) window.renderSettings();
    if (pageId === 'notas' && window.renderNotes) window.renderNotes();
    if (pageId === 'ocultos' && window.renderHiddenWidgetsPage) window.renderHiddenWidgetsPage();
    if (pageId === 'home') {
        applyWidgetVisibility();
        refreshAllUI();
    }

    // Ajuste específico da IA
    if (pageId === 'ia') {
        fixChatLayout();
        scrollToBottom();
        setTimeout(scrollToBottom, 100);
    }

    if (addToHistory) {
        history.pushState({ view: pageId }, null, `#${pageId}`);
    }
}

// ============================================================
// --- GESTÃO DE WIDGETS ---
// ============================================================

const WIDGET_PRESETS = {
    'default': { label: 'Padrão (Claro/Escuro)', class: 'bg-white dark:bg-darkcard border-gray-200 dark:border-darkborder' },
    'gradient-indigo': { label: 'Hora de Focar (Roxo)', class: 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white border-transparent shadow-lg' },
    'gradient-emerald': { label: 'Natureza (Verde)', class: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-transparent shadow-lg' },
    'gradient-sunset': { label: 'Pôr do Sol (Laranja)', class: 'bg-gradient-to-br from-orange-500 to-rose-500 text-white border-transparent shadow-lg' },
    'dark-mode': { label: 'Meia-Noite (Preto)', class: 'bg-gray-900 text-white border-gray-800 shadow-lg' }
};

function injectWidgetControls() {
    const widgets = ['widget-bus', 'widget-tasks', 'widget-quick', 'widget-class', 'widget-reminders', 'widget-ai', 'widget-notes'];

    widgets.forEach(id => {
        const widget = document.getElementById(id);
        if (!widget) return;

        const existingControls = widget.querySelector('.widget-controls');
        if (existingControls) existingControls.remove();

        const controlsDiv = document.createElement('div');
        controlsDiv.className = "widget-controls absolute top-3 right-3 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-black/50 backdrop-blur-sm rounded-lg p-1 shadow-sm";

        controlsDiv.innerHTML = `
            <button onclick="openWidgetCustomizer('${id}')" class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-indigo-500 dark:text-gray-300 dark:hover:text-indigo-400 transition" title="Personalizar Estilo">
                <i class="fas fa-palette text-xs"></i>
            </button>
            <button onclick="toggleWidget('${id}')" class="w-6 h-6 flex items-center justify-center text-gray-500 hover:text-red-500 dark:text-gray-300 dark:hover:text-red-400 transition" title="Ocultar Widget">
                <i class="fas fa-eye-slash text-xs"></i>
            </button>
        `;

        if (getComputedStyle(widget).position === 'static') widget.style.position = 'relative';
        widget.classList.add('group');

        widget.appendChild(controlsDiv);

        const oldButtons = widget.querySelectorAll('button[onclick^="toggleWidget"]');
        oldButtons.forEach(btn => {
            if (!btn.closest('.widget-controls')) btn.style.display = 'none';
        });
    });
}

window.openWidgetCustomizer = function (widgetId) {
    const modal = document.createElement('div');
    modal.className = "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm fade-in";
    modal.id = "customizer-modal";

    let optionsHtml = '';
    Object.entries(WIDGET_PRESETS).forEach(([key, preset]) => {
        optionsHtml += `
            <button onclick="setWidgetStyle('${widgetId}', '${key}')" class="w-full text-left p-3 rounded-xl border border-gray-200 dark:border-neutral-700 mb-2 hover:scale-[1.02] transition flex items-center gap-3 overflow-hidden group">
                <div class="w-8 h-8 rounded-full ${preset.class.split(' ').filter(c => c.startsWith('bg-') || c.startsWith('from-')).join(' ')} border border-gray-300 shadow-sm"></div>
                <span class="font-medium text-gray-700 dark:text-gray-200">${preset.label}</span>
                ${widgetStyles[widgetId] === key ? '<i class="fas fa-check text-green-500 ml-auto"></i>' : ''}
            </button>
        `;
    });

    modal.innerHTML = `
        <div class="bg-white dark:bg-neutral-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 m-4 relative animate-scale-in border border-gray-200 dark:border-neutral-800">
            <button onclick="document.getElementById('customizer-modal').remove()" class="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <i class="fas fa-times"></i>
            </button>
            <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-1">Personalizar Widget</h3>
            <p class="text-sm text-gray-500 mb-4">Escolha um estilo visual:</p>
            <div class="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                ${optionsHtml}
            </div>
        </div>
    `;

    document.body.appendChild(modal);
}

window.setWidgetStyle = function (widgetId, styleKey) {
    widgetStyles[widgetId] = styleKey;
    saveData();
    applyAllWidgetStyles();

    const modal = document.getElementById('customizer-modal');
    if (modal) modal.remove();

    showModal("Estilo Aplicado", "O visual do widget foi atualizado.");
}

function applyAllWidgetStyles() {
    Object.entries(widgetStyles).forEach(([id, styleKey]) => {
        const widget = document.getElementById(id);
        if (!widget) return;

        const preset = WIDGET_PRESETS[styleKey];
        if (!preset) return;

        widget.className = widget.className.replace(/bg-[\w-\/]+|border-[\w-\/]+|text-[\w-\/]+|widget-mode-\w+/g, '').trim();
        widget.classList.remove('bg-white', 'dark:bg-darkcard', 'border-gray-200', 'dark:border-darkborder', 'shadow-sm');

        if (!widget.className.includes('rounded-xl')) widget.classList.add('rounded-xl');
        if (!widget.className.includes('flex')) widget.classList.add('flex', 'flex-col');

        const isHidden = widget.classList.contains('hidden');
        widget.className = `rounded-xl border p-6 flex flex-col h-full min-h-[200px] relative overflow-hidden group transition-all duration-300 ${preset.class} ${isHidden ? 'hidden' : ''}`;

        if (styleKey !== 'default') {
            widget.classList.add('widget-custom-dark');

            const controls = widget.querySelector('.widget-controls');
            if (controls) {
                controls.className = "widget-controls absolute top-3 right-3 flex gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-black/60 backdrop-blur-sm rounded-lg p-1 shadow-sm";
            }
        } else {
            widget.classList.remove('widget-custom-dark');
            widget.classList.add('bg-white', 'dark:bg-darkcard', 'border-gray-200', 'dark:border-darkborder', 'shadow-sm');
        }

        if (!widget.querySelector('.widget-controls')) {
            injectWidgetControls();
        }
    });
}

window.toggleWidget = function (widgetId) {
    const widget = document.getElementById(widgetId);
    if (!widget) return;

    if (hiddenWidgets.includes(widgetId)) {
        hiddenWidgets = hiddenWidgets.filter(id => id !== widgetId);
        widget.classList.remove('hidden');
        showModal("Widget Restaurado", "O widget voltou para a tela principal.");
    } else {
        hiddenWidgets.push(widgetId);
        widget.classList.add('hidden');

        const toast = document.createElement('div');
        toast.className = "fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-gray-900 text-white px-4 py-2 rounded-full text-sm shadow-lg z-[60] animate-fade-in-up flex items-center gap-2";
        toast.innerHTML = `<span>Widget oculto.</span> <button onclick="switchPage('ocultos')" class="text-indigo-300 font-bold hover:underline">Desfazer</button>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    saveData();
    applyWidgetVisibility();
    if (currentViewContext === 'ocultos') renderHiddenWidgetsPage();
}

function applyWidgetVisibility() {
    const allWidgets = ['widget-bus', 'widget-tasks', 'widget-quick', 'widget-class', 'widget-reminders', 'widget-ai', 'widget-notes'];
    allWidgets.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (hiddenWidgets.includes(id)) {
                el.classList.add('hidden');
            } else {
                el.classList.remove('hidden');
            }
        }
    });
}

window.renderHiddenWidgetsPage = function () {
    const container = document.getElementById('view-ocultos');
    if (!container) return;

    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = "max-w-4xl mx-auto p-4";

    const header = document.createElement('div');
    header.className = "mb-6 flex items-center justify-between";
    header.innerHTML = `
        <div>
            <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Widgets Ocultos</h2>
            <p class="text-sm text-gray-500">Gerencie o que aparece na sua tela principal.</p>
        </div>
        <button onclick="switchPage('home')" class="text-indigo-600 font-bold text-sm">Voltar</button>
    `;
    wrapper.appendChild(header);

    if (hiddenWidgets.length === 0) {
        wrapper.innerHTML += `
            <div class="flex flex-col items-center justify-center py-20 text-center">
                <div class="w-20 h-20 bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
                    <i class="fas fa-check text-3xl"></i>
                </div>
                <h3 class="text-lg font-bold text-gray-700 dark:text-gray-200">Tudo Visível</h3>
                <p class="text-gray-500 dark:text-gray-400 text-sm max-w-xs mx-auto">Todos os seus widgets estão ativos na tela principal.</p>
            </div>
        `;
    } else {
        const grid = document.createElement('div');
        grid.className = "grid grid-cols-1 md:grid-cols-2 gap-4";

        const labels = {
            'widget-bus': { icon: 'bus', name: 'Circular / Ônibus' },
            'widget-tasks': { icon: 'check-circle', name: 'Tarefas' },
            'widget-quick': { icon: 'bolt', name: 'Acesso Rápido' },
            'widget-class': { icon: 'graduation-cap', name: 'Próxima Aula' },
            'widget-reminders': { icon: 'bell', name: 'Lembretes' },
            'widget-ai': { icon: 'robot', name: 'Dica da IA' },
            'widget-notes': { icon: 'sticky-note', name: 'Anotações' }
        };

        hiddenWidgets.forEach(id => {
            const info = labels[id] || { icon: 'cube', name: id };
            const card = document.createElement('div');
            card.className = "bg-white dark:bg-darkcard p-4 rounded-xl border border-gray-200 dark:border-darkborder flex justify-between items-center shadow-sm group hover:border-indigo-500 transition";
            card.innerHTML = `
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-gray-50 dark:bg-neutral-800 flex items-center justify-center text-gray-500 dark:text-gray-400 group-hover:text-indigo-500 transition">
                        <i class="fas fa-${info.icon}"></i>
                    </div>
                    <span class="font-bold text-gray-700 dark:text-gray-200">${info.name}</span>
                </div>
                <button onclick="toggleWidget('${id}')" class="text-xs bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 px-3 py-2 rounded-lg font-bold hover:bg-indigo-100 transition flex items-center gap-2">
                    <i class="fas fa-plus"></i> Restaurar
                </button>
            `;
            grid.appendChild(card);
        });
        wrapper.appendChild(grid);
    }

    container.appendChild(wrapper);
}

// ============================================================
// --- INTEGRAÇÃO IA ---
// ============================================================

window.setAIProvider = function (provider) {
    currentAIProvider = provider;
    const feedback = provider === 'gemini' ? "Gemini (Google) ativado." : "Llama 3.3 (Groq) ativada.";
    showModal("IA Alterada", feedback);
    updateAISelectorUI();
}

function updateAISelectorUI() {
    const btnGemini = document.getElementById('btn-ai-gemini');
    const btnGroq = document.getElementById('btn-ai-groq');

    if (btnGemini && btnGroq) {
        if (currentAIProvider === 'gemini') {
            btnGemini.classList.add('ring-2', 'ring-indigo-500');
            btnGroq.classList.remove('ring-2', 'ring-indigo-500');
        } else {
            btnGroq.classList.add('ring-2', 'ring-indigo-500');
            btnGemini.classList.remove('ring-2', 'ring-indigo-500');
        }
    }
}

function formatAIContent(text) {
    if (!text) return "";
    if (text.includes("<br>") || text.includes("<p>")) return text;
    return text.split('\n').filter(line => line.trim() !== '').map(line => `<p>${line}</p>`).join('');
}

window.sendIAMessage = async function () {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    const sendBtn = document.getElementById('chat-send-btn');

    if (!message) return;

    // 1. Exibe a mensagem do usuário na tela imediatamente
    appendMessage('user', message);
    input.value = '';
    input.disabled = true;
    sendBtn.disabled = true;

    scrollToBottom();
    showTypingIndicator();

    try {
        // 2. Coleta dados do contexto local
        const statusCircular = getBusStatusForAI();
        const tempElement = document.getElementById('weather-temp');

        // 3. Monta o Prompt do Sistema (Instruções para a IA)
        // Isso ensina a IA quem ela é e o que pode fazer
        let systemInstructionText = `
VOCÊ É A "SALVE-SE IA", ASSISTENTE ACADÊMICA DA UFRB.
Sua missão é organizar a vida do estudante, reduzir o estresse e ajudar nos estudos.
Fale sempre em Português do Brasil de forma natural.

CONTEXTO ATUAL:
- Tela: ${currentViewContext}
- Hora: ${new Date().toLocaleTimeString('pt-BR')}
- Dia: ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}
- Ônibus: ${statusCircular}
- Tarefas Pendentes: ${tasksData.filter(t => !t.done).length}

SUAS HABILIDADES:
1. 🎨 Designer: Você pode mudar as cores do app.
   CORES DISPONÍVEIS: Azul (use 'indigo'), Verde, Vermelho, Roxo, Rosa, Laranja, Amarelo, Preto, Ciano, Violeta, Lima.
2. 📅 Organizador: Crie tarefas e lembretes.
3. 🎓 Tutor: Ajude com dúvidas da UFRB.

AÇÕES PERMITIDAS (Responda APENAS com JSON):
ESTRUTURA: { "message": "texto amigável", "commands": [ { "action": "...", "params": {...} } ] }

Comandos:
- "toggle_theme": { "mode": "dark|light" }
- "set_global_color": { "color": "nome_da_cor_em_portugues" }  <-- Ex: "preta", "azul", "verde"
- "create_task": { "text": "...", "priority": "normal|high" }
- "create_reminder": { "desc": "...", "date": "YYYY-MM-DD" }
- "navigate": { "page": "home|todo|aulas|notas|onibus|calc|pomo" }
`;

        // 4. Prepara o histórico da conversa para enviar
        // A primeira mensagem é sempre o sistema (prompt)
        let historyPayload = [{ role: 'system', text: systemInstructionText }];

        // Adiciona as últimas 4 mensagens da conversa real para manter o contexto
        const recentHistory = chatHistory.slice(-4);
        recentHistory.forEach(msg => {
            historyPayload.push({ role: msg.role, text: msg.text });
        });

        // 5. SEGURANÇA: Chama a SUA API (/api/chat) na Vercel
        // Nenhuma chave secreta é enviada aqui, apenas o provedor escolhido
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                provider: currentAIProvider, // 'gemini' ou 'groq'
                message: message,            // O que o usuário digitou
                history: historyPayload      // O contexto montado acima
            })
        });

        const data = await response.json();

        if (data.error) throw new Error(data.error);

        // 6. Processa a resposta da IA
        let aiResponseText = data.text;

        // Limpeza do JSON (caso a IA mande blocos de código markdown)
        let cleanText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const first = cleanText.indexOf('{');
        const last = cleanText.lastIndexOf('}');
        if (first !== -1 && last !== -1) cleanText = cleanText.substring(first, last + 1);

        const responseJson = JSON.parse(cleanText);

        // Exibe a resposta da IA na tela
        if (responseJson.message) appendMessage('ai', responseJson.message);
        else appendMessage('ai', "Feito.");

        // Executa comandos (criar tarefa, mudar tema, etc.)
        if (responseJson.commands && Array.isArray(responseJson.commands)) {
            for (const cmd of responseJson.commands) {
                await executeAICommand(cmd);
                await new Promise(r => setTimeout(r, 300)); // Pequeno delay entre ações
            }
        }

    } catch (error) {
        console.error("Erro Geral:", error);
        appendMessage('ai', `⚠️ Erro: ${error.message}`);
    } finally {
        // Limpeza final: reabilita o input
        hideTypingIndicator();
        document.getElementById('chat-input').disabled = false;
        document.getElementById('chat-send-btn').disabled = false;
        document.getElementById('chat-input').focus();
        scrollToBottom();
    }
};

function hideTypingIndicator() {
    const existing = document.getElementById('dynamic-typing-indicator');
    if (existing) existing.remove();
}

function appendMessage(sender, text) {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    chatHistory.push({ role: sender === 'user' ? 'user' : 'assistant', text: text });
    if (chatHistory.length > 30) chatHistory.shift();

    const div = document.createElement('div');
    div.className = `flex w-full ${sender === 'user' ? 'justify-end' : 'justify-start'} mb-4 animate-scale-in group`;

    const time = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    const formattedText = text
        .replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-neutral-700 px-1 rounded text-xs font-mono">$1</code>');

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
        const providerLabel = currentAIProvider === 'gemini' ? 'Gemini' : 'Llama';
        div.innerHTML = `
            <div class="flex gap-3 max-w-[90%]">
                <div class="flex-shrink-0 flex flex-col justify-end">
                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs shadow-sm">
                        <i class="fas fa-robot"></i>
                    </div>
                </div>
                <div class="flex flex-col items-start">
                    <div class="bg-white dark:bg-darkcard border border-gray-200 dark:border-darkborder text-gray-800 dark:text-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm text-sm leading-relaxed">
                        ${formattedText}
                    </div>
                    <span class="text-[10px] text-gray-400 mt-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">${providerLabel} • ${time}</span>
                </div>
            </div>
        `;
    }
    container.appendChild(div);
    scrollToBottom();
}

// ============================================================
// --- EXECUTOR DE COMANDOS DA IA ---
// ============================================================

async function executeAICommand(cmd) {
    console.log("🤖 Comando IA recebido:", cmd);
    const p = cmd.params || {};

    switch (cmd.action) {
        // --- TEMA E CORES (CORRIGIDO) ---
        case 'toggle_theme':
            if (p.mode === 'dark' || p.mode === 'escuro') {
                document.documentElement.classList.add('dark');
                localStorage.setItem('theme', 'dark');
            } else if (p.mode === 'light' || p.mode === 'claro') {
                document.documentElement.classList.remove('dark');
                localStorage.setItem('theme', 'light');
            } else {
                toggleTheme();
            }
            break;

        case 'set_global_color':
            // 1. Limpa a entrada da IA
            let rawColor = p.color ? p.color.toLowerCase().trim() : 'indigo';

            // 2. TRADUTOR COMPLETO
            const colorMap = {
                // Masculino
                'verde': 'green', 'vermelho': 'red', 'azul': 'indigo',
                'roxo': 'purple', 'rosa': 'pink', 'laranja': 'orange',
                'amarelo': 'yellow', 'preto': 'black', 'ciano': 'cyan',
                'violeta': 'violet', 'lima': 'lime', 'petroleo': 'teal',

                // Feminino e variações
                'preta': 'black', 'vermelha': 'red', 'amarela': 'yellow',
                'roxa': 'purple', 'branca': 'black',

                // Inglês
                'indigo': 'indigo', 'green': 'green', 'red': 'red',
                'purple': 'purple', 'pink': 'pink', 'orange': 'orange',
                'yellow': 'yellow', 'black': 'black', 'cyan': 'cyan',
                'violet': 'violet', 'lime': 'lime', 'teal': 'teal',
                'rose': 'rose', 'blue': 'indigo'
            };

            // 3. Traduz a cor
            const finalColor = colorMap[rawColor] || rawColor;

            // 4. SEGURANÇA CORRIGIDA: Removemos o 'window.' para acessar a variável localmente
            // Verifica se a paleta de cores existe antes de aplicar
            if (typeof colorPalettes !== 'undefined' && colorPalettes[finalColor]) {
                setThemeColor(finalColor);
            } else {
                console.warn(`Cor não encontrada: ${finalColor}. Usando Indigo.`);
                setThemeColor('indigo');
            }
            break;

        // --- TAREFAS ---
        case 'create_task':
            tasksData.push({ id: Date.now().toString(), text: p.text, done: false, priority: p.priority || 'normal', category: p.category || 'geral', createdAt: Date.now() });
            saveData();
            break;

        case 'delete_task':
            if (p.text) {
                tasksData = tasksData.filter(t => !t.text.toLowerCase().includes(p.text.toLowerCase()));
                saveData();
            }
            break;

        case 'delete_all_tasks':
            tasksData = [];
            saveData();
            break;

        // --- LEMBRETES ---
        case 'create_reminder':
            remindersData.push({ id: Date.now().toString(), desc: p.desc, date: p.date, prio: p.prio || 'medium', createdAt: Date.now() });
            saveData();
            break;

        case 'delete_reminder':
            if (p.desc) {
                remindersData = remindersData.filter(r => !r.desc.toLowerCase().includes(p.desc.toLowerCase()));
                saveData();
            }
            break;

        case 'delete_all_reminders':
            remindersData = [];
            saveData();
            break;

        // --- AULAS ---
        case 'create_class':
            scheduleData.push({ id: Date.now().toString(), name: p.name, prof: p.prof || 'N/A', room: p.room || 'N/A', day: p.day, start: p.start, end: p.end, color: 'indigo' });
            saveData();
            break;

        // --- NAVEGAÇÃO ---
        case 'navigate':
            if (p.page !== currentViewContext) switchPage(p.page);
            break;

        // --- NOTAS ---
        case 'create_note':
            const newNoteId = Date.now().toString();
            notesData.push({ id: newNoteId, title: p.title || "Nota da IA", content: p.content || "", updatedAt: Date.now() });
            saveData();
            if (currentViewContext === 'notas') { renderNotes(); openNote(newNoteId); }
            break;

        // --- WIDGETS ---
        case 'hide_widget':
            if (p.id && !hiddenWidgets.includes(p.id)) toggleWidget(p.id);
            break;

        case 'show_widget':
            if (p.id && hiddenWidgets.includes(p.id)) toggleWidget(p.id);
            break;

        default:
            console.warn("⚠️ Comando IA não reconhecido:", cmd.action);
    }
}

function updateAIWidget(content) {
    aiWidgetContent = content;
    localStorage.setItem('salvese_ai_widget', content);
    updateAIWidgetUI();
}

function updateAIWidgetUI() {
    const widgetEl = document.getElementById('ai-widget-content');
    if (widgetEl) {
        widgetEl.innerHTML = `
            <div class="flex items-start gap-3">
                <i class="fas fa-lightbulb text-yellow-500 text-xl"></i>
                <div class="text-sm text-gray-600 dark:text-gray-300">
                    ${aiWidgetContent}
                </div>
            </div>
        `;
    }
}

if (aiWidgetContent === "Olá! Sou sua IA. Vou postar dicas úteis aqui.") {
    const tips = [
        "Beba água enquanto estuda!",
        "Use o Pomodoro para focar.",
        "O circular sai a cada hora cheia.",
        "Revise suas anotações hoje."
    ];
    updateAIWidget(tips[Math.floor(Math.random() * tips.length)]);
}

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
            schedule: [],
            tasks: [],
            reminders: [],
            notes: [],
            hiddenWidgets: [],
            widgetStyles: {},
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
            localStorage.setItem('salvese_notes', JSON.stringify(cloudData.notes || []));
            localStorage.setItem('salvese_hidden_widgets', JSON.stringify(cloudData.hiddenWidgets || []));
            localStorage.setItem('salvese_widget_styles', JSON.stringify(cloudData.widgetStyles || {}));

            scheduleData = cloudData.schedule || [];
            tasksData = cloudData.tasks || [];
            remindersData = cloudData.reminders || [];
            notesData = cloudData.notes || [];
            hiddenWidgets = cloudData.hiddenWidgets || [];
            widgetStyles = cloudData.widgetStyles || {};

            refreshAllUI();
            applyWidgetVisibility();
            applyAllWidgetStyles();
        }
    }, (error) => console.log("Modo offline ou erro de sync:", error.code));

    onSnapshot(doc(db, "users", uid), (docSnap) => {
        if (docSnap.exists()) {
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

    // ATUALIZADO: Usa o container pai para injetar vídeo ou img
    // O ID 'user-avatar-sidebar' era a IMG, vamos pegar o PAI dela
    const avatarImg = document.getElementById('user-avatar-sidebar');
    if (avatarImg && userProfile && userProfile.photoURL) {
        const parent = avatarImg.parentElement;
        parent.id = "sidebar-avatar-container"; // Damos um ID ao pai para facilitar
        avatarImg.remove(); // Remove a img antiga para recriar limpo
        renderMediaInContainer("sidebar-avatar-container", userProfile.photoURL);
    }

    if (userProfile) {
        if (nameDisplay) nameDisplay.innerText = userProfile.displayName;
        if (handleDisplay) handleDisplay.innerText = "@" + userProfile.handle;
    }
}

function refreshAllUI() {
    if (window.renderSchedule) window.renderSchedule();
    if (window.renderTasks) window.renderTasks();
    if (window.renderReminders) window.renderReminders();
    if (window.updateDashboardTasksWidget) window.updateDashboardTasksWidget();
    if (window.updateNextClassWidget) window.updateNextClassWidget();
    if (window.renderSettings) window.renderSettings();
    if (window.updateAIWidgetUI) window.updateAIWidgetUI();
    if (window.updateNotesWidget) window.updateNotesWidget();

    if (window.renderNotes && currentViewContext === 'notas') window.renderNotes(false);

    injectWidgetControls();
}

async function saveData() {
    localStorage.setItem('salvese_schedule', JSON.stringify(scheduleData));
    localStorage.setItem('salvese_tasks', JSON.stringify(tasksData));
    localStorage.setItem('salvese_reminders', JSON.stringify(remindersData));
    localStorage.setItem('salvese_notes', JSON.stringify(notesData));
    localStorage.setItem('salvese_hidden_widgets', JSON.stringify(hiddenWidgets));
    localStorage.setItem('salvese_widget_styles', JSON.stringify(widgetStyles));

    refreshAllUI();
    applyWidgetVisibility();
    applyAllWidgetStyles();

    if (currentUser) {
        try {
            const dataToSave = {
                schedule: scheduleData,
                tasks: tasksData,
                reminders: remindersData,
                notes: notesData,
                hiddenWidgets: hiddenWidgets,
                widgetStyles: widgetStyles,
                lastUpdated: new Date().toISOString()
            };
            await setDoc(doc(db, "users", currentUser.uid, "data", "appData"), dataToSave, { merge: true });
        } catch (e) {
            console.log("Salvamento local ok. Nuvem pendente.");
        }
    }
}

window.manualBackup = async function () {
    const btn = document.getElementById('btn-manual-backup');
    if (btn) {
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Salvando...';
        btn.disabled = true;
    }

    await saveData();

    setTimeout(() => {
        showModal('Backup', 'Seus dados foram sincronizados com a nuvem com sucesso!');
        if (btn) {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }, 800);
}

window.renderNotes = function (forceRender = true) {
    const container = document.getElementById('view-notas');
    if (!container) return;

    if (container.innerHTML.trim() === '') forceRender = true;

    if (!activeNoteId) {
        renderNotesList(container);
    } else {
        if (forceRender || !document.getElementById('editor-content')) {
            renderNoteEditor(container, activeNoteId);
        }
    }
}

function renderNotesList(container) {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = "max-w-4xl mx-auto h-full flex flex-col p-6";

    const header = document.createElement('div');
    header.className = "flex justify-between items-center mb-6";
    header.innerHTML = `
        <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Minhas Anotações</h2>
        <button onclick="createNewNote()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-md transition flex items-center gap-2 text-sm font-bold">
            <i class="fas fa-plus"></i> Nova Nota
        </button>
    `;
    wrapper.appendChild(header);

    const grid = document.createElement('div');
    grid.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20";

    if (notesData.length === 0) {
        grid.innerHTML = `
            <div class="col-span-full flex flex-col items-center justify-center py-20 text-gray-400 opacity-60">
                <i class="fas fa-sticky-note text-5xl mb-4"></i>
                <p>Nenhuma anotação ainda.</p>
            </div>
        `;
    } else {
        // Ordena: Primeiro a fixada, depois as recentes
        const sortedNotes = [...notesData].sort((a, b) => {
            if (a.pinned) return -1;
            if (b.pinned) return 1;
            return (b.updatedAt || 0) - (a.updatedAt || 0);
        });

        sortedNotes.forEach(note => {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = note.content || "";
            const textContent = tempDiv.innerText || tempDiv.textContent || "";
            const snippet = textContent.substring(0, 100) + (textContent.length > 100 ? "..." : "");
            const dateStr = new Date(note.updatedAt || Date.now()).toLocaleDateString('pt-BR');

            // Define a cor do alfinete
            const pinColor = note.pinned ? "text-indigo-600 dark:text-indigo-400 scale-110" : "text-gray-300 dark:text-neutral-700 hover:text-gray-500";
            const borderClass = note.pinned ? "border-indigo-500 ring-1 ring-indigo-500" : "border-gray-200 dark:border-darkborder";

            const card = document.createElement('div');
            card.className = `bg-white dark:bg-darkcard border ${borderClass} rounded-xl p-5 hover:shadow-lg transition cursor-pointer group flex flex-col h-48 relative`;

            // Clique no card abre a nota
            card.onclick = (e) => {
                if (!e.target.closest('button')) openNote(note.id);
            };

            card.innerHTML = `
                <div class="flex justify-between items-start mb-2 gap-2">
                    <h3 class="font-bold text-gray-800 dark:text-white truncate text-lg flex-1">${note.title || "Sem título"}</h3>
                    
                    <button onclick="togglePin('${note.id}', event)" class="p-1.5 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition z-20" title="${note.pinned ? 'Desfixar' : 'Fixar na Home'}">
                        <i class="fas fa-thumbtack ${pinColor} transition-colors"></i>
                    </button>

                    <button class="delete-note-btn text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 transition z-20" onclick="deleteNote('${note.id}'); event.stopPropagation();">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
                
                <div class="flex-1 overflow-hidden mb-3">
                    <p class="text-sm text-gray-500 dark:text-gray-400 line-clamp-4 break-words font-normal">${snippet || "Nota vazia..."}</p>
                </div>
                <div class="flex justify-between items-center mt-auto">
                    ${note.pinned ? '<span class="text-[10px] font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">FIXADA</span>' : '<span></span>'}
                    <p class="text-xs text-gray-400">${dateStr}</p>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    wrapper.appendChild(grid);
    container.appendChild(wrapper);
}
function renderNoteEditor(container, noteId) {
    const note = notesData.find(n => n.id === noteId);
    if (!note) { activeNoteId = null; renderNotesList(container); return; }

    container.innerHTML = '';
    const editorWrapper = document.createElement('div');

    editorWrapper.className = "fixed inset-0 z-50 bg-white dark:bg-darkcard md:static md:z-auto md:max-w-4xl md:mx-auto md:h-[calc(100vh-8rem)] flex flex-col md:rounded-xl md:border md:border-gray-200 md:dark:border-darkborder md:shadow-sm overflow-hidden md:m-4";

    const toolbar = document.createElement('div');
    toolbar.className = "flex items-center gap-1 p-2 border-b border-gray-200 dark:border-darkborder bg-gray-50 dark:bg-neutral-900 overflow-x-auto no-scrollbar flex-shrink-0";

    const createToolBtn = (icon, cmd, val = null, color = null) => `
        <button onclick="formatText('${cmd}', '${val || ''}')" class="p-2 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-300 transition flex-shrink-0 ${color ? 'text-' + color + '-500' : ''}" title="${cmd}">
            <i class="fas fa-${icon}"></i>
        </button>
    `;

    toolbar.innerHTML = `
        <button onclick="closeNote()" class="mr-2 p-2 rounded hover:bg-gray-200 dark:hover:bg-neutral-700 text-gray-600 dark:text-gray-400 font-bold flex items-center gap-1">
            <i class="fas fa-arrow-left"></i>
        </button>
        
        <button onclick="forceSaveNote()" id="btn-manual-save" class="mr-2 p-2 rounded bg-indigo-100 hover:bg-indigo-200 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 font-bold flex items-center gap-2 transition shadow-sm" title="Salvar Agora">
            <i class="fas fa-save"></i> <span class="text-xs hidden sm:inline">Salvar</span>
        </button>
        
        <span id="save-status" class="text-[10px] text-gray-400 uppercase font-bold w-16 text-center mr-2 transition-opacity">Salvo</span>

        <div class="w-px h-6 bg-gray-300 dark:bg-neutral-700 mx-1"></div>
        ${createToolBtn('bold', 'bold')}
        ${createToolBtn('italic', 'italic')}
        ${createToolBtn('underline', 'underline')}
        <div class="w-px h-6 bg-gray-300 dark:bg-neutral-700 mx-1"></div>
        ${createToolBtn('list-ul', 'insertUnorderedList')}
        ${createToolBtn('list-ol', 'insertOrderedList')}
        <div class="w-px h-6 bg-gray-300 dark:bg-neutral-700 mx-1 hidden sm:block"></div>
        <div class="flex gap-1 hidden sm:flex">
             <button onclick="formatText('hiliteColor', '#fef08a')" class="w-6 h-6 rounded-full bg-yellow-200 border border-gray-300 hover:scale-110 transition" title="Amarelo"></button>
             <button onclick="formatText('hiliteColor', '#bbf7d0')" class="w-6 h-6 rounded-full bg-green-200 border border-gray-300 hover:scale-110 transition" title="Verde"></button>
             <button onclick="formatText('hiliteColor', '#fbcfe8')" class="w-6 h-6 rounded-full bg-pink-200 border border-gray-300 hover:scale-110 transition" title="Rosa"></button>
             <button onclick="formatText('hiliteColor', '#bfdbfe')" class="w-6 h-6 rounded-full bg-blue-200 border border-gray-300 hover:scale-110 transition" title="Azul"></button>
        </div>
        <button onclick="deleteNote('${note.id}')" class="ml-auto p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><i class="fas fa-trash-alt"></i></button>
    `;

    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.className = "w-full p-4 text-xl font-bold bg-transparent border-b border-gray-100 dark:border-darkborder outline-none text-gray-900 dark:text-white flex-shrink-0";
    titleInput.placeholder = "Título da Nota";
    titleInput.value = note.title;

    // CORREÇÃO: Salva ao digitar E ao sair do campo (blur)
    titleInput.oninput = (e) => { note.title = e.target.value; debounceSaveNote(); };
    titleInput.onblur = () => { saveData(); };

    const contentDiv = document.createElement('div');
    contentDiv.id = 'editor-content';
    contentDiv.contentEditable = true;
    contentDiv.className = "flex-1 p-4 outline-none overflow-y-auto text-gray-800 dark:text-gray-200 text-base leading-relaxed";
    contentDiv.innerHTML = note.content;

    // CORREÇÃO: Salva ao digitar E ao sair do campo (blur)
    contentDiv.oninput = () => {
        note.content = contentDiv.innerHTML;
        note.updatedAt = Date.now();
        debounceSaveNote();
    };
    contentDiv.onblur = () => { saveData(); };

    editorWrapper.appendChild(toolbar);
    editorWrapper.appendChild(titleInput);
    editorWrapper.appendChild(contentDiv);
    container.appendChild(editorWrapper);
}

function debounceSaveNote() {
    const status = document.getElementById('save-status');
    if (status) {
        status.innerText = "Salvando...";
        status.className = "text-[10px] text-indigo-500 uppercase font-bold w-16 text-center mr-2 animate-pulse";
    }

    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
        saveData();
        if (status) {
            status.innerText = "Salvo";
            status.className = "text-[10px] text-gray-400 uppercase font-bold w-16 text-center mr-2";
        }
    }, 1000);
}

window.forceSaveNote = async function () {
    const btn = document.getElementById('btn-manual-save');
    const icon = btn ? btn.querySelector('i') : null;
    const status = document.getElementById('save-status');

    if (icon) icon.className = "fas fa-circle-notch fa-spin";
    if (status) {
        status.innerText = "Salvando...";
        status.classList.add("text-indigo-500");
    }

    await saveData();

    setTimeout(() => {
        if (icon) icon.className = "fas fa-check";
        if (status) {
            status.innerText = "Salvo!";
            status.classList.remove("text-indigo-500");
            status.classList.add("text-green-500");
        }
        setTimeout(() => {
            if (icon) icon.className = "fas fa-save";
            if (status) {
                status.innerText = "Salvo";
                status.classList.remove("text-green-500");
                status.classList.add("text-gray-400");
            }
        }, 1500);
    }, 500);
}

window.createNewNote = function () {
    const newId = Date.now().toString();
    notesData.push({
        id: newId,
        title: "",
        content: "",
        updatedAt: Date.now()
    });
    saveData();
    openNote(newId);
}

window.openNote = function (id) {
    activeNoteId = id;
    renderNotes(true);
}

window.closeNote = function () {
    // 1. SEGURANÇA: Antes de fechar, pega o que está escrito na tela AGORA
    const titleInput = document.querySelector('#view-notas input[type="text"]');
    const contentDiv = document.getElementById('editor-content');

    // Se a nota estiver aberta, atualizamos a memória com o texto da tela
    if (activeNoteId && titleInput && contentDiv) {
        const note = notesData.find(n => n.id === activeNoteId);
        if (note) {
            note.title = titleInput.value;
            note.content = contentDiv.innerHTML;
            note.updatedAt = Date.now();
        }
    }

    // 2. Cancela qualquer salvamento automático pendente para não duplicar
    if (typeof saveTimeout !== 'undefined') clearTimeout(saveTimeout);

    // 3. Salva imediatamente no banco de dados
    saveData();

    // 4. Fecha a nota e volta para a lista
    activeNoteId = null;
    renderNotes(true);
}
window.deleteNote = function (id) {
    openCustomConfirmModal("Excluir Nota", "Tem certeza que deseja apagar esta nota?", () => {
        notesData = notesData.filter(n => n.id !== id);
        if (activeNoteId === id) activeNoteId = null;
        saveData();
        renderNotes(true);
    });
}

window.forceSaveNote = async function () {
    const btn = document.getElementById('btn-manual-save');
    const icon = btn ? btn.querySelector('i') : null;
    const status = document.getElementById('save-status');

    // Efeito visual no botão
    if (icon) {
        icon.className = "fas fa-circle-notch fa-spin";
    }
    if (status) {
        status.innerText = "Salvando...";
        status.classList.add("text-indigo-500");
    }

    // Salva
    await saveData();

    // Restaura efeito visual
    setTimeout(() => {
        if (icon) icon.className = "fas fa-check";
        if (status) {
            status.innerText = "Salvo!";
            status.classList.remove("text-indigo-500");
            status.classList.add("text-green-500");
        }

        // Volta ao ícone original depois de 1.5s
        setTimeout(() => {
            if (icon) icon.className = "fas fa-save";
            if (status) {
                status.innerText = "Salvo";
                status.classList.remove("text-green-500");
                status.classList.add("text-gray-400");
            }
        }, 1500);
    }, 500);
}

window.formatText = function (cmd, val) {
    document.execCommand(cmd, false, val);
    const editor = document.getElementById('editor-content');
    if (editor) {
        editor.focus();
        editor.dispatchEvent(new Event('input'));
    }
}

window.updateNotesWidget = function () {
    const container = document.getElementById('notes-widget-content');
    const titleEl = document.querySelector('#widget-notes h3'); // Pega o título do widget
    const iconEl = document.querySelector('#widget-notes i'); // Pega o ícone

    if (!container) return;

    if (notesData.length === 0) {
        container.innerHTML = `
            <p class="text-gray-400 text-sm italic text-center py-4">Nenhuma anotação.</p>
        `;
        return;
    }

    // 1. Tenta achar a nota fixada
    let targetNote = notesData.find(n => n.pinned);
    let isPinned = true;

    // 2. Se não tiver fixada, pega a mais recente
    if (!targetNote) {
        targetNote = [...notesData].sort((a, b) => b.updatedAt - a.updatedAt)[0];
        isPinned = false;
    }

    // 3. Atualiza Título e Ícone do Widget dinamicamente
    if (titleEl && iconEl) {
        if (isPinned) {
            titleEl.innerText = "Nota Fixada";
            iconEl.className = "fas fa-thumbtack text-indigo-500 text-lg";
        } else {
            titleEl.innerText = "Nota Recente";
            iconEl.className = "fas fa-sticky-note text-yellow-500 text-lg";
        }
    }

    const textPreview = targetNote.content.replace(/<[^>]*>?/gm, '').substring(0, 100) + "...";

    container.innerHTML = `
        <div onclick="switchPage('notas'); openNote('${targetNote.id}')" class="cursor-pointer hover:bg-gray-50 dark:hover:bg-neutral-800 rounded p-2 -mx-2 transition h-full flex flex-col">
            <h4 class="font-bold text-gray-800 dark:text-white truncate text-base">${targetNote.title || "Sem Título"}</h4>
            <p class="text-xs text-gray-500 dark:text-gray-400 line-clamp-4 mt-2 leading-relaxed">${textPreview}</p>
            <p class="text-[10px] text-gray-400 mt-auto text-right pt-2">
                ${isPinned ? '<i class="fas fa-thumbtack mr-1"></i>' : ''} 
                ${new Date(targetNote.updatedAt).toLocaleDateString()}
            </p>
        </div>
    `;
}

function openCustomInputModal(title, placeholder, initialValue, onConfirm) {
    const modal = document.getElementById('custom-input-modal');
    const modalTitle = document.getElementById('custom-modal-title');
    const modalInput = document.getElementById('custom-modal-input');
    const btnConfirm = document.getElementById('custom-modal-confirm');
    const btnCancel = document.getElementById('custom-modal-cancel');

    if (!modal) return console.error("Modal não encontrado no HTML");

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
        if (onConfirm) onConfirm(val);
    });

    newBtnCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    modalInput.onkeypress = (e) => {
        if (e.key === 'Enter') newBtnConfirm.click();
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

    if (!modal) return;

    modalTitle.innerText = title;
    modalMsg.innerText = message;

    const newBtnYes = btnYes.cloneNode(true);
    btnYes.parentNode.replaceChild(newBtnYes, btnYes);

    const newBtnNo = btnNo.cloneNode(true);
    btnNo.parentNode.replaceChild(newBtnNo, btnNo);

    newBtnYes.addEventListener('click', () => {
        modal.classList.add('hidden');
        if (onConfirm) onConfirm();
    });

    newBtnNo.addEventListener('click', () => {
        modal.classList.add('hidden');
    });

    modal.classList.remove('hidden');
}

window.showModal = function (title, message) {
    const m = document.getElementById('generic-modal');
    document.getElementById('generic-modal-title').innerText = title;
    document.getElementById('generic-modal-message').innerText = message;
    if (m) {
        history.pushState({ modal: 'generic' }, null, '#alert');
        m.classList.remove('hidden');
        setTimeout(() => { m.classList.remove('opacity-0'); m.firstElementChild.classList.remove('scale-95'); m.firstElementChild.classList.add('scale-100'); }, 10);
    }
}

window.closeGenericModal = function () {
    const m = document.getElementById('generic-modal');
    if (m) {
        m.classList.add('opacity-0'); m.firstElementChild.classList.remove('scale-100'); m.firstElementChild.classList.add('scale-95');
        setTimeout(() => m.classList.add('hidden'), 300);
    }
}

window.editName = function () {
    openCustomInputModal(
        "Alterar Nome de Exibição",
        "Digite seu novo nome...",
        userProfile.displayName,
        async (newName) => {
            if (newName && newName.trim() !== "" && newName !== userProfile.displayName) {
                if (!currentUser) return showModal("Erro", "Você precisa estar online.");

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

window.editHandle = function () {
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

window.editSemester = function () {
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

window.changePhoto = function () {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*, video/mp4, video/webm';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // ⚠️ LIMITE VERCEL: 4MB (Segurança para não travar a função serverless)
        if (file.size > 4 * 1024 * 1024) {
            return showModal("Arquivo muito grande", "Devido a limites de segurança, envie arquivos menores que 4MB.");
        }

        const loadingBtn = document.getElementById('btn-change-photo-settings');
        let originalBtnContent = "";
        if (loadingBtn) {
            originalBtnContent = loadingBtn.innerHTML;
            loadingBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin mr-2"></i> Enviando...';
            loadingBtn.disabled = true;
        } else {
            showModal("Aguarde", "Enviando mídia...");
        }

        // Converter Arquivo para Base64
        const toBase64 = (file) => new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });

        try {
            const base64File = await toBase64(file);

            // --- AQUI MUDOU: Envia para /api/upload ---
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    image: base64File
                })
            });

            const data = await response.json();

            if (data.success && currentUser) {
                const newUrl = data.data.link;

                await updateProfile(currentUser, { photoURL: newUrl });
                await setDoc(doc(db, "users", currentUser.uid), { photoURL: newUrl }, { merge: true });

                // Atualiza imediatamente na tela
                userProfile.photoURL = newUrl;
                updateUserInterfaceInfo();
                if (document.getElementById('settings-content')) renderSettings();

                const genericModal = document.getElementById('generic-modal');
                if (genericModal && !genericModal.classList.contains('hidden')) closeGenericModal();

                showModal("Sucesso", "Perfil atualizado com sucesso! 📸");
            } else {
                throw new Error(data.error || 'Falha no upload.');
            }

        } catch (error) {
            console.error("Erro ao atualizar foto:", error);
            showModal("Erro", "Erro ao enviar: " + error.message);
        } finally {
            if (loadingBtn) {
                loadingBtn.innerHTML = originalBtnContent;
                loadingBtn.disabled = false;
            }
        }
    };

    input.click();
}

window.changePassword = function () {
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

window.renderSettings = function () {
    const container = document.getElementById('settings-content');
    if (!container || !userProfile) return;

    let dateStr = "N/A";
    if (userProfile.createdAt) {
        const date = new Date(userProfile.createdAt);
        dateStr = date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    const photoUrl = userProfile.photoURL || "https://files.catbox.moe/pmdtq6.png";

    // Detecta se é vídeo para renderizar o HTML correto no template string
    const isVideo = photoUrl.match(/\.(mp4|webm)$/i);
    const mediaHtml = isVideo
        ? `<video src="${photoUrl}" class="w-full h-full object-cover" autoplay loop muted playsinline></video>`
        : `<img src="${photoUrl}" class="w-full h-full object-cover" onerror="this.src='https://files.catbox.moe/pmdtq6.png'">`;

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
            
            <div class="bg-white dark:bg-darkcard rounded-3xl shadow-sm border border-gray-200 dark:border-darkborder p-6 md:p-8 flex flex-col items-center text-center relative overflow-hidden">
                 <div class="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-indigo-500 to-purple-600 opacity-10 dark:opacity-20"></div>
                 
                 <div class="relative group mb-4 mt-4">
                    <div class="w-28 h-28 rounded-full overflow-hidden p-1 border-4 border-white dark:border-darkcard shadow-lg relative z-10 bg-white dark:bg-darkcard">
                        <div class="w-full h-full rounded-full overflow-hidden relative">
                            ${mediaHtml}
                        </div>
                    </div>
                    <div id="btn-change-photo-settings" class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition rounded-full flex items-center justify-center cursor-pointer m-1 z-20" onclick="changePhoto()">
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

            <div>
                <h3 class="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Gerenciar Conta</h3>
                ${createActionCard('changePhoto()', svgs.photo, 'Foto de Perfil', 'Atualize sua imagem ou vídeo')}
                ${createActionCard('editName()', svgs.user, 'Nome de Exibição', 'Como seu nome aparece no app')}
                ${createActionCard('editHandle()', svgs.at, 'Nome de Usuário', 'Seu identificador único @handle')}
                ${createActionCard('editSemester()', svgs.school, 'Semestre Atual', 'Para organizar suas matérias')}
            </div>
            
            <div>
                 <h3 class="px-4 text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Interface</h3>
                 ${createActionCard("switchPage('ocultos')", `<i class="fas fa-eye-slash"></i>`, 'Widgets Ocultos', 'Gerenciar itens escondidos da tela inicial')}
            </div>

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
                 <p class="text-xs text-gray-300 dark:text-gray-600 font-mono">ID: ${currentUser.uid.substring(0, 8)}...</p>
                 <p class="text-xs text-gray-300 dark:text-gray-600 mt-1">Salve-se UFRB v3.4 (GIF Support)</p>
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

window.setTaskFilter = function (filter) {
    currentTaskFilter = filter;
    ['filter-all', 'filter-active', 'filter-completed'].forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            if (id === `filter-${filter}`) btn.classList.add('bg-indigo-100', 'text-indigo-700', 'dark:bg-indigo-900/50', 'dark:text-indigo-300');
            else btn.classList.remove('bg-indigo-100', 'text-indigo-700', 'dark:bg-indigo-900/50', 'dark:text-indigo-300');
        }
    });
    window.renderTasks();
};

function getPriorityInfo(prio) {
    switch (prio) {
        case 'high': return { label: 'Alta', color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border-red-100 dark:border-red-900' };
        case 'medium': return { label: 'Média', color: 'text-orange-600 bg-orange-50 dark:bg-orange-900/20 dark:text-orange-400 border-orange-100 dark:border-orange-900' };
        default: return { label: 'Normal', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 border-blue-100 dark:border-blue-900' };
    }
}

function getCategoryIcon(cat) {
    switch (cat) {
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

window.updateDashboardTasksWidget = function () {
    const container = document.getElementById('dashboard-tasks-list');
    const taskCountEl = document.getElementById('task-count-badge');

    const pendingTasks = tasksData.filter(t => !t.done);

    if (taskCountEl) {
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
// --- FUNCIONALIDADE: GRADE HORÁRIA (Com Alternador de View) ---
// ============================================================

const timeSlots = [
    { start: "07:00", end: "08:00" }, { start: "08:00", end: "09:00" }, { start: "09:00", end: "10:00" },
    { start: "10:00", end: "11:00" }, { start: "11:00", end: "12:00" }, { start: "12:00", end: "13:00" },
    { start: "13:00", end: "14:00" }, { start: "14:00", end: "15:00" }, { start: "15:00", end: "16:00" },
    { start: "16:00", end: "17:00" }, { start: "17:00", end: "18:00" }, { start: "18:30", end: "19:30" },
    { start: "19:30", end: "20:30" }, { start: "20:30", end: "21:30" }, { start: "21:30", end: "22:30" }
];

const daysList = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const daysDisplay = { 'seg': 'Seg', 'ter': 'Ter', 'qua': 'Qua', 'qui': 'Qui', 'sex': 'Sex', 'sab': 'Sab' };

window.toggleScheduleMode = function () {
    scheduleViewMode = scheduleViewMode === 'table' ? 'cards' : 'table';
    localStorage.setItem('salvese_schedule_mode', scheduleViewMode);
    window.renderSchedule();
}

window.renderSchedule = function () {
    const viewContainer = document.getElementById('view-aulas');
    if (!viewContainer) return;

    viewContainer.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = "max-w-6xl mx-auto pb-20 md:pb-10";

    // Header Desktop com Toggle
    const header = document.createElement('div');
    header.className = "hidden md:flex justify-between items-center mb-6 px-2";
    header.innerHTML = `
        <div class="flex items-center gap-4">
            <div>
                <h2 class="text-2xl font-bold text-gray-800 dark:text-white">Grade Horária</h2>
                <p class="text-sm text-gray-500 dark:text-gray-400">Gerencie suas aulas da semana.</p>
            </div>
            <button onclick="toggleScheduleMode()" class="ml-4 text-xs font-bold px-3 py-1.5 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-neutral-800 transition flex items-center gap-2 text-gray-600 dark:text-gray-300">
                <i class="fas ${scheduleViewMode === 'table' ? 'fa-th-list' : 'fa-table'}"></i>
                ${scheduleViewMode === 'table' ? 'Ver como Lista' : 'Ver como Tabela'}
            </button>
        </div>
        <button onclick="openAddClassModal()" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg shadow-md transition flex items-center gap-2 text-sm font-bold">
            <i class="fas fa-plus"></i> <span>Nova Aula</span>
        </button>
    `;
    wrapper.appendChild(header);

    // Header Mobile
    const mobileHeader = document.createElement('div');
    mobileHeader.className = "md:hidden flex justify-between items-center mb-6 px-1";
    mobileHeader.innerHTML = `
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Minha Grade</h2>
        <button onclick="openAddClassModal()" class="bg-indigo-600 hover:bg-indigo-700 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-md">
            <i class="fas fa-plus text-sm"></i>
        </button>
    `;
    wrapper.appendChild(mobileHeader);

    // CONTAINER TIPO "CARDS" (Usado no mobile e opcional no PC)
    const cardsContainerWrapper = document.createElement('div');
    cardsContainerWrapper.className = scheduleViewMode === 'cards' ? "space-y-6" : "md:hidden space-y-6";

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
            .sort((a, b) => parseInt(a.start.replace(':', '')) - parseInt(b.start.replace(':', '')));

        const cardsContainer = document.createElement('div');
        cardsContainer.className = "space-y-3";
        // Layout em grid se estiver no PC modo cards
        if (scheduleViewMode === 'cards') {
            cardsContainer.className = "space-y-3 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:space-y-0";
        }

        if (classesToday.length === 0) {
            if (scheduleViewMode === 'cards') { // Apenas exibe msg vazia se for cards mode explicitamente ou mobile
                cardsContainer.innerHTML = `
                    <div class="col-span-full">
                        <p class="text-sm text-gray-400 italic pl-1">Nenhuma aula neste dia.</p>
                        <div class="border-b border-gray-100 dark:border-neutral-800 border-dashed my-1 md:hidden"></div>
                    </div>
                `;
            } else {
                cardsContainer.innerHTML = `
                    <p class="text-sm text-gray-400 italic pl-1">Nenhuma aula neste dia.</p>
                    <div class="border-b border-gray-100 dark:border-neutral-800 border-dashed my-1"></div>
                `;
            }
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
        cardsContainerWrapper.appendChild(daySection);
    });

    // Se estiver no modo tabela no PC, esconde o wrapper de cards (que já tem md:hidden por padrão se for mobile-only logic)
    // Mas se user escolheu 'cards', ele aparece.
    if (scheduleViewMode === 'cards') {
        wrapper.appendChild(cardsContainerWrapper);
    } else {
        // Renderiza cards apenas mobile
        wrapper.appendChild(cardsContainerWrapper);
    }

    // CONTAINER TIPO "TABELA" (Apenas Desktop e se selecionado)
    if (scheduleViewMode === 'table') {
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
                    if (endIndex === -1) endIndex = timeSlots.findIndex(s => s.start === foundClass.end) - 1;
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
    }

    viewContainer.appendChild(wrapper);
};

window.openAddClassModal = function (day, startHourStr) {
    resetModalFields();
    document.getElementById('modal-title').innerText = "Adicionar Aula";
    document.getElementById('btn-delete-class').classList.add('hidden');

    if (day) document.getElementById('class-day').value = day;
    else {
        const todayIndex = new Date().getDay();
        const map = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
        if (todayIndex > 0 && todayIndex < 7) document.getElementById('class-day').value = map[todayIndex];
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

window.updateEndTime = function (slotsToAdd = 2) {
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

window.toggleModal = function (show) {
    const modal = document.getElementById('class-modal');
    const content = document.getElementById('class-modal-content');
    if (show) {
        history.pushState({ modal: 'class' }, null, '#class-modal');
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

window.updateNextClassWidget = function () {
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

window.toggleRemindersModal = function () {
    const modal = document.getElementById('reminders-modal');
    const content = modal ? modal.firstElementChild : null;
    if (!modal) return;

    if (modal.classList.contains('hidden')) {
        history.pushState({ modal: 'reminders' }, null, '#reminders-modal');
        renderReminders();
        modal.classList.remove('hidden');
        setTimeout(() => { modal.classList.remove('opacity-0'); if (content) { content.classList.remove('scale-95'); content.classList.add('scale-100'); } }, 10);
    } else {
        modal.classList.add('opacity-0'); if (content) { content.classList.remove('scale-100'); content.classList.add('scale-95'); }
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

window.showReminderForm = function () {
    document.getElementById('btn-add-reminder').classList.add('hidden');
    document.getElementById('reminder-form').classList.remove('hidden');
    document.getElementById('rem-date').valueAsDate = new Date();
}

window.hideReminderForm = function () {
    document.getElementById('reminder-form').classList.add('hidden');
    document.getElementById('btn-add-reminder').classList.remove('hidden');
    document.getElementById('rem-desc').value = '';
}

window.addReminder = function () {
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

window.deleteReminder = function (id) {
    remindersData = remindersData.filter(r => r.id !== id);
    saveData();
}

window.renderReminders = function () {
    const listModal = document.getElementById('reminders-list-modal');
    const listHome = document.getElementById('home-reminders-list');
    const badge = document.getElementById('notification-badge');

    const sorted = [...remindersData].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (badge) {
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

    if (listModal) {
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

    if (listHome) {
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
    const now = new Date();
    const day = now.getDay(); // 0 = Domingo, 6 = Sábado

    const container = document.getElementById('bus-dynamic-area');
    const title = document.getElementById('dash-bus-title');
    const subtitle = document.getElementById('dash-bus-subtitle');
    const statusDot = document.getElementById('bus-status-dot');
    const statusText = document.getElementById('bus-status-text');

    if (!container || !title) return;

    // --- LÓGICA DE FIM DE SEMANA ---
    if (day === 0 || day === 6) {
        statusDot.className = "w-2 h-2 rounded-full bg-red-500";
        statusText.innerText = "Fim de Semana";
        statusText.className = "text-xs font-bold text-red-500 uppercase tracking-wider";

        title.innerText = "Off";
        subtitle.innerText = "Circular não roda hoje.";

        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-center opacity-60">
                <i class="fas fa-couch text-2xl mb-2 text-indigo-300"></i>
                <p class="text-xs text-gray-500">Aproveite o descanso!</p>
            </div>
        `;
        return; // Para a função aqui
    }

    // --- LÓGICA NORMAL (SEGUNDA A SEXTA) ---
    const currentTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    let activeBus = null;
    let nextBus = null;
    let timeDiff = Infinity;

    for (let bus of busSchedule) {
        const [h1, m1] = bus.start.split(':').map(Number);
        const [h2, m2] = bus.end.split(':').map(Number);
        const startSeconds = h1 * 3600 + m1 * 60;
        const endSeconds = h2 * 3600 + m2 * 60;

        if (currentTotalSeconds >= startSeconds && currentTotalSeconds < endSeconds) {
            activeBus = bus;
            break;
        }
        if (startSeconds > currentTotalSeconds) {
            const diff = startSeconds - currentTotalSeconds;
            if (diff < timeDiff) {
                timeDiff = diff;
                nextBus = bus;
            }
        }
    }

    if (activeBus) {
        statusDot.className = "w-2 h-2 rounded-full bg-green-500 animate-pulse";
        statusText.innerText = "Em Trânsito";
        statusText.className = "text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider";
        title.innerText = activeBus.end;
        subtitle.innerText = `Destino: ${activeBus.dest}`;

        let timelineHtml = '<div class="relative pl-3 border-l-2 border-gray-200 dark:border-neutral-800 space-y-4 ml-1">';
        const upcomingStops = activeBus.stops.filter(s => {
            const [sh, sm] = s.time.split(':').map(Number);
            const stopSeconds = sh * 3600 + sm * 60;
            return stopSeconds >= (currentTotalSeconds - 60);
        }).slice(0, 3);

        if (upcomingStops.length === 0) timelineHtml += '<p class="text-xs text-gray-500 pl-2">Chegando ao destino...</p>';

        upcomingStops.forEach((stop, idx) => {
            let dotClass = idx === 0 ? "bg-green-500 ring-4 ring-green-100 dark:ring-green-900/30" : "bg-gray-300 dark:bg-neutral-700";
            let textClass = idx === 0 ? "text-green-700 dark:text-green-400 font-bold" : "text-gray-600 dark:text-gray-400";
            let animClass = "animate-fade-in-up";
            timelineHtml += `<div class="relative flex items-start route-item ${animClass}" style="animation-delay: ${idx * 100}ms"><div class="absolute -left-[19px] w-3 h-3 rounded-full ${dotClass} border-2 border-white dark:border-darkcard mt-1.5 transition-colors duration-500"></div><div class="flex justify-between w-full items-start pl-2"><span class="text-sm ${textClass} transition-colors duration-500">${stop.loc}</span><div class="text-right"><span class="text-xs font-mono text-gray-700 dark:text-gray-300 font-bold">${stop.time}</span><span class="block text-[9px] text-red-500 font-bold uppercase tracking-wide leading-tight">Estimativa</span></div></div></div>`;
        });
        timelineHtml += '</div>';
        if (container.innerHTML !== timelineHtml) container.innerHTML = timelineHtml;

    } else if (nextBus) {
        statusDot.className = "w-2 h-2 rounded-full bg-indigo-500";
        statusText.innerText = "Próximo Circular";
        statusText.className = "text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider";
        title.innerText = nextBus.start;
        subtitle.innerText = `${nextBus.origin} ➔ ${nextBus.dest}`;

        const hours = Math.floor(timeDiff / 3600);
        const minutes = Math.floor((timeDiff % 3600) / 60);
        const seconds = timeDiff % 60;

        let timeString = "";
        if (hours > 0) timeString += `${hours}h `;
        timeString += `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;

        let badgeClass = timeDiff <= 900 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 animate-pulse" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300";

        container.innerHTML = `<div class="flex items-center h-full"><div class="w-full py-3 rounded-lg text-center font-bold text-sm ${badgeClass}">Saída em ${timeString}</div></div>`;

    } else {
        statusDot.className = "w-2 h-2 rounded-full bg-gray-400";
        statusText.innerText = "Encerrado";
        title.innerText = "Fim";
        subtitle.innerText = "Sem mais viagens hoje";
        container.innerHTML = `<div class="w-full py-3 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 text-center text-sm font-medium mt-auto">Volta amanhã</div>`;
    }
}

// ============================================================
// --- FUNCIONALIDADE: CALCULADORA ---
// ============================================================

window.addGradeRow = function () {
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

window.calculateAverage = function () {
    let totalScore = 0, totalWeight = 0, hasInput = false;
    const passingEl = document.getElementById('passing-grade');
    if (!passingEl) return;
    const passing = parseFloat(passingEl.value) || 6.0;

    document.querySelectorAll('.grade-input').forEach((inp, i) => {
        const val = parseLocalFloat(inp.value);
        const weightInps = document.querySelectorAll('.weight-input');
        if (weightInps[i]) {
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

window.resetCalc = function () {
    const container = document.getElementById('grades-container');
    if (container) container.innerHTML = '';
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

    if (display) display.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    if (circle) circle.style.strokeDashoffset = 816 - (timeLeft1 / modes1[currentMode1]) * 816;
}

window.toggleTimer = function () {
    const btn = document.getElementById('btn-start');
    if (!btn) return;
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

window.resetTimer = function () { if (isRunning1) toggleTimer(); timeLeft1 = modes1[currentMode1]; updateTimerDisplay(); }

window.setTimerMode = function (m) {
    ['pomodoro', 'short', 'long'].forEach(mode => {
        const btn = document.getElementById(`mode-${mode}`);
        if (btn) {
            if (mode === m) { btn.classList.add('bg-white', 'dark:bg-neutral-700', 'text-gray-800', 'dark:text-white', 'shadow-sm'); btn.classList.remove('text-gray-500', 'dark:text-gray-400'); }
            else { btn.classList.remove('bg-white', 'dark:bg-neutral-700', 'text-gray-800', 'dark:text-white', 'shadow-sm'); btn.classList.add('text-gray-500', 'dark:text-gray-400'); }
        }
    });
    currentMode1 = m;
    const label = document.getElementById('timer-label');
    if (label) label.innerText = m === 'pomodoro' ? 'Foco' : (m === 'short' ? 'Curta' : 'Longa');
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

window.loadTemplate = function (k) { document.getElementById('email-content').value = templates[k]; }
window.copyEmail = function () { const e = document.getElementById('email-content'); e.select(); document.execCommand('copy'); }
window.openPortal = function () { window.open('https://sistemas.ufrb.edu.br/sigaa/verTelaLogin.do', '_blank'); }

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

window.toggleTheme = function () {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}

window.toggleColorMenu = function (device) {
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
window.cycleClockMode = function () { clockMode = (clockMode + 1) % 4; updateClock(); }
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
                if (currentUser) refreshAllUI();
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
    updateAIWidgetUI();
    fixChatLayout();
    setInterval(updateNextBus, 1000);

    // Auto-select Home on sidebar
    const activeMobileLink = document.querySelector(`#mobile-menu nav a[onclick*="'home'"]`);
    if (activeMobileLink) {
        activeMobileLink.classList.add('bg-indigo-50', 'text-indigo-600', 'dark:bg-indigo-900/50', 'dark:text-indigo-300');
        activeMobileLink.classList.remove('text-gray-600', 'dark:text-gray-400');
    }

    setInterval(window.updateNextClassWidget, 60000);

    addGradeRow(); addGradeRow();
    if (document.getElementById('passing-grade')) document.getElementById('passing-grade').addEventListener('input', calculateAverage);
});

// --- NOVA FUNÇÃO AUXILIAR PARA A IA (COM REGRAS DE FIM DE SEMANA) ---
function getBusStatusForAI() {
    const now = new Date();
    const day = now.getDay(); // 0 = Domingo, 6 = Sábado

    // LÓGICA DE FIM DE SEMANA ADICIONADA AQUI:
    if (day === 0 || day === 6) {
        return "STATUS: FIM DE SEMANA. O circular não funciona aos sábados e domingos. O serviço retorna na segunda-feira.";
    }

    const currentTotalSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();

    let activeBus = null;
    let nextBus = null;
    let timeDiff = Infinity;

    // Procura ônibus ativo ou o próximo
    for (let bus of busSchedule) {
        const [h1, m1] = bus.start.split(':').map(Number);
        const [h2, m2] = bus.end.split(':').map(Number);
        const startSeconds = h1 * 3600 + m1 * 60;
        const endSeconds = h2 * 3600 + m2 * 60;

        if (currentTotalSeconds >= startSeconds && currentTotalSeconds < endSeconds) {
            activeBus = bus;
            break;
        }
        if (startSeconds > currentTotalSeconds) {
            const diff = startSeconds - currentTotalSeconds;
            if (diff < timeDiff) {
                timeDiff = diff;
                nextBus = bus;
            }
        }
    }

    // Formata a resposta para a IA entender
    if (activeBus) {
        return `STATUS: EM TRÂNSITO AGORA. O ônibus saiu às ${activeBus.start} e chega no destino (${activeBus.dest}) às ${activeBus.end}. Rota: ${activeBus.origin} -> ${activeBus.dest}.`;
    } else if (nextBus) {
        const hours = Math.floor(timeDiff / 3600);
        const minutes = Math.floor((timeDiff % 3600) / 60);
        return `STATUS: AGUARDANDO. Não há ônibus rodando agora. O próximo sai às ${nextBus.start} (daqui a ${hours}h ${minutes}m). Rota: ${nextBus.origin} -> ${nextBus.dest}.`;
    } else {
        return `STATUS: ENCERRADO. Não há mais viagens programadas para hoje. O serviço retorna amanhã às 06:25.`;
    }
}

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
// ============================================================
// --- RECONHECIMENTO DE VOZ (MODO MANUAL) ---
// ============================================================

window.startVoiceRecognition = function () {
    const btn = document.getElementById('btn-mic');
    const icon = btn.querySelector('i');
    const input = document.getElementById('chat-input');

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        showModal("Não suportado", "Seu navegador não suporta comandos de voz.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.interimResults = false; // Só pega o resultado final
    recognition.maxAlternatives = 1;

    // Visual: Botão vermelho indicando gravação
    btn.classList.remove('bg-gray-200', 'dark:bg-neutral-800', 'text-gray-600', 'dark:text-gray-300');
    btn.classList.add('bg-red-500', 'text-white', 'animate-pulse');
    icon.classList.remove('fa-microphone');
    icon.classList.add('fa-stop'); // Ícone de "Parar"

    const originalPlaceholder = input.placeholder;
    input.placeholder = "Estou ouvindo...";

    recognition.start();

    recognition.onresult = (event) => {
        const text = event.results[0][0].transcript;

        // AQUI ESTÁ A MUDANÇA:
        // Apenas coloca o texto no input, NÃO envia automático.
        input.value = text;
        input.focus(); // Foca na caixa para você poder editar se quiser
    };

    recognition.onspeechend = () => {
        recognition.stop();
        resetMicButton();
    };

    recognition.onerror = (event) => {
        console.error('Erro voz:', event.error);
        resetMicButton();
        if (event.error === 'not-allowed') {
            showModal("Permissão", "Ative o microfone para usar essa função.");
        }
    };

    function resetMicButton() {
        btn.classList.add('bg-gray-200', 'dark:bg-neutral-800', 'text-gray-600', 'dark:text-gray-300');
        btn.classList.remove('bg-red-500', 'text-white', 'animate-pulse');
        icon.classList.add('fa-microphone');
        icon.classList.remove('fa-stop');
        input.placeholder = originalPlaceholder;
    }
};

// ============================================================
// --- WIDGET: RESUMO INTELIGENTE DO DIA ---
// ============================================================

function updateSmartSummary() {
    const container = document.getElementById('ai-widget-content');
    if (!container) return;

    // 1. Contar Tarefas Pendentes
    const pendingTasks = tasksData.filter(t => !t.done).length;

    // 2. Verificar Próximo Ônibus (Reutilizando a lógica que criamos)
    const busStatus = getBusStatusForAI(); // Pega o texto do ônibus
    let busShort = "Sem circulares agora.";

    // Extrai apenas a parte útil do texto do ônibus para o widget
    if (busStatus.includes("EM TRÂNSITO")) busShort = "🚍 Circular rodando agora.";
    else if (busStatus.includes("AGUARDANDO")) {
        const match = busStatus.match(/sai às (\d{2}:\d{2})/);
        if (match) busShort = `🚍 Próximo ônibus às ${match[1]}.`;
    }

    // 3. Verificar Próxima Aula
    const now = new Date();
    const days = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const todayKey = days[now.getDay()];
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const todayClasses = scheduleData.filter(c => c.day === todayKey);
    const nextClass = todayClasses.find(c => {
        const [h, m] = c.start.split(':').map(Number);
        return (h * 60 + m) > currentTime;
    });

    let classText = "Sem mais aulas hoje.";
    if (nextClass) classText = `🎓 Aula de ${nextClass.name} às ${nextClass.start}.`;

    // 4. Montar o HTML
    let taskColor = pendingTasks > 0 ? "text-orange-500" : "text-green-500";
    let taskIcon = pendingTasks > 0 ? "fa-exclamation-circle" : "fa-check-circle";
    let taskMsg = pendingTasks > 0 ? `${pendingTasks} tarefas pendentes.` : "Tudo feito por hoje!";

    container.innerHTML = `
        <div class="space-y-3 animate-fade-in-up">
            <div class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <i class="fas ${taskIcon} ${taskColor} w-5 text-center"></i>
                <span>${taskMsg}</span>
            </div>
            
            <div class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <i class="fas fa-bus text-indigo-500 w-5 text-center"></i>
                <span>${busShort}</span>
            </div>

            <div class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                <i class="fas fa-graduation-cap text-purple-500 w-5 text-center"></i>
                <span>${classText}</span>
            </div>
        </div>
    `;
}

// Adicione isso no final do arquivo para rodar sempre
setInterval(updateSmartSummary, 60000); // Atualiza a cada minuto
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(updateSmartSummary, 500); // Roda ao iniciar
});

// --- FUNÇÃO RENDERIZAR AVATAR (VÍDEO/GIF/IMG) ---
function renderMediaInContainer(containerId, url, className = "w-full h-full object-cover") {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Limpa o container antes de adicionar
    container.innerHTML = '';

    // Normaliza URL do Imgur (Garante HTTPS e remove parâmetros extras se houver)
    let cleanUrl = url.split('?')[0];

    // Verifica extensões de vídeo comuns
    const isVideo = cleanUrl.match(/\.(mp4|webm|mov)$/i);

    if (isVideo) {
        const video = document.createElement('video');
        video.src = cleanUrl;
        video.className = className;
        video.autoplay = true;
        video.loop = true;
        video.muted = true; // Essencial para autoplay funcionar
        video.playsInline = true; // Essencial para iOS
        video.style.width = "100%";
        video.style.height = "100%";
        video.style.objectFit = "cover";

        // Promessa de play para garantir
        video.onloadeddata = () => {
            video.play().catch(e => console.log("Autoplay bloqueado:", e));
        };

        container.appendChild(video);
    } else {
        const img = document.createElement('img');
        img.src = cleanUrl;
        img.className = className;
        img.style.width = "100%";
        img.style.height = "100%";
        img.style.objectFit = "cover";
        img.onerror = function () { this.src = 'https://files.catbox.moe/pmdtq6.png'; };

        container.appendChild(img);
    }
}

// ============================================================
// --- NOVA FUNÇÃO: FIXAR NOTA ---
// ============================================================

window.togglePin = function (id, event) {
    // Impede que o clique abra a nota (stop propagation)
    if (event) event.stopPropagation();

    const note = notesData.find(n => n.id === id);
    if (note) {
        // Se já estava fixada, desfixa.
        // Se não estava, fixa ela e DESFIXA todas as outras (só 1 permitida)
        const wasPinned = note.pinned;

        // Reseta todas para false
        notesData.forEach(n => n.pinned = false);

        // Se não estava fixada, fixa agora
        if (!wasPinned) {
            note.pinned = true;
            showModal("Nota Fixada", "Esta nota agora aparece na tela inicial! 📌");
        } else {
            showModal("Desfixada", "O widget voltou a mostrar a nota mais recente.");
        }

        saveData();
        renderNotes(false); // Atualiza a lista visualmente
    }
}

// ============================================================
// --- FUNÇÃO QUE FALTAVA: SCROLL TO BOTTOM ---
// ============================================================

window.scrollToBottom = function () {
    const container = document.getElementById('chat-messages-container');
    if (container) {
        // Rola suavemente para o final
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
        });
    }
}

// ============================================================
// --- FUNÇÃO QUE FALTAVA: MOSTRAR DIGITANDO... ---
// ============================================================

window.showTypingIndicator = function () {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    // Remove se já existir (para evitar duplicatas)
    const existing = document.getElementById('dynamic-typing-indicator');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'dynamic-typing-indicator';
    div.className = "flex w-full justify-start mb-4 animate-fade-in-up";

    div.innerHTML = `
        <div class="flex gap-3 max-w-[90%]">
            <div class="flex-shrink-0 flex flex-col justify-end">
                <div class="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs shadow-sm animate-pulse">
                    <i class="fas fa-robot"></i>
                </div>
            </div>
            <div class="flex flex-col items-start">
                <div class="bg-white dark:bg-darkcard border border-gray-200 dark:border-darkborder text-gray-500 dark:text-gray-400 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm text-sm flex items-center gap-1 h-[46px]">
                    <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0s"></span>
                    <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.2s"></span>
                    <span class="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style="animation-delay: 0.4s"></span>
                </div>
                <span class="text-[10px] text-gray-400 mt-1 ml-1">Digitando...</span>
            </div>
        </div>
    `;

    container.appendChild(div);
    scrollToBottom(); // Rola para ver a animação
}