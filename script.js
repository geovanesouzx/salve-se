// ============================================================
// --- CONFIGURAÇÃO FIREBASE & IMPORTAÇÕES ---
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    signInWithPopup, 
    GoogleAuthProvider, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    getDoc, 
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

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Tenta habilitar persistência offline do próprio Firestore (cache extra)
try {
    enableIndexedDbPersistence(db).catch((err) => {
        if (err.code == 'failed-precondition') {
            console.log('Múltiplas abas abertas, persistência habilitada em apenas uma.');
        } else if (err.code == 'unimplemented') {
            console.log('Navegador não suporta persistência.');
        }
    });
} catch (e) { console.log("Persistência já ativa ou não suportada"); }

// Variáveis Globais de Usuário
let currentUser = null;
let userProfile = null;
let unsubscribeData = null; // Para parar de ouvir o banco se deslogar

// ============================================================
// --- LÓGICA DE AUTENTICAÇÃO & SINCRONIZAÇÃO ---
// ============================================================

// 1. Monitora Estado do Usuário (Login/Logout)
onAuthStateChanged(auth, async (user) => {
    const loginScreen = document.getElementById('login-screen');
    const profileScreen = document.getElementById('profile-setup-screen');
    const appContent = document.querySelector('.app-content-wrapper'); 
    const loadingScreen = document.getElementById('loading-screen'); // Referência ao Loading

    if (user) {
        currentUser = user;
        // Verifica se já tem perfil criado (handle único)
        const docRef = doc(db, "users", user.uid);
        
        // Pequena otimização: tentar ler do cache local primeiro se possível, ou deixar o loading rodar
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            // Usuário logado e com perfil -> Vai para o App
            userProfile = docSnap.data();
            
            if(loginScreen) loginScreen.classList.add('hidden');
            if(profileScreen) profileScreen.classList.add('hidden');
            if(appContent) appContent.classList.remove('hidden');
            
            updateUserInterfaceInfo();
            initRealtimeSync(user.uid); // Inicia sincronização
        } else {
            // Usuário logado, mas sem handle -> Vai para Setup de Perfil
            if(loginScreen) loginScreen.classList.add('hidden');
            if(profileScreen) profileScreen.classList.remove('hidden');
            if(appContent) appContent.classList.add('hidden');
        }
    } else {
        // Deslogado -> Mostra Login
        currentUser = null;
        userProfile = null;
        if(unsubscribeData) unsubscribeData(); // Para de ouvir Firebase

        if(loginScreen) loginScreen.classList.remove('hidden'); // Agora mostramos o login explicitamente
        if(profileScreen) profileScreen.classList.add('hidden');
        if(appContent) appContent.classList.add('hidden');
    }

    // Remove a tela de carregamento com uma transição suave
    if(loadingScreen && !loadingScreen.classList.contains('hidden')) {
        loadingScreen.classList.add('opacity-0');
        setTimeout(() => {
            loadingScreen.classList.add('hidden');
        }, 500); // Tempo igual ao duration-500 do CSS
    }
});

// 2. Função de Login Google
window.loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Erro no login:", error);
        alert("Erro ao fazer login: " + error.message);
    }
};

// 3. Função de Logout
window.logoutApp = async () => {
    try {
        await signOut(auth);
        // Limpa dados visuais sensíveis se necessário, mas mantém LocalStorage para uso offline futuro
        location.reload();
    } catch (error) {
        console.error("Erro ao sair:", error);
    }
};

// 4. Verificar e Salvar Perfil Único
window.saveUserProfile = async () => {
    const handleInput = document.getElementById('input-handle').value.toLowerCase().trim();
    const nameInput = document.getElementById('input-display-name').value.trim();
    const errorMsg = document.getElementById('profile-error');

    if (!handleInput || !nameInput) {
        errorMsg.innerText = "Preencha todos os campos.";
        return;
    }

    // Regex para permitir apenas letras, numeros e underscore
    const handleRegex = /^[a-z0-9_]+$/;
    if (!handleRegex.test(handleInput)) {
        errorMsg.innerText = "Usuário deve conter apenas letras minúsculas, números e _";
        return;
    }

    try {
        // Verifica se o handle já existe na coleção 'usernames'
        const usernameRef = doc(db, "usernames", handleInput);
        const usernameSnap = await getDoc(usernameRef);

        if (usernameSnap.exists()) {
            errorMsg.innerText = "Este nome de usuário já está em uso. Escolha outro.";
            return;
        }

        // Se não existe, cria as referências
        const batch =  // Operação em lote (atômica)
        
        // 1. Reserva o username
        await setDoc(doc(db, "usernames", handleInput), { uid: currentUser.uid });
        
        // 2. Cria o perfil do usuário
        const profileData = {
            handle: handleInput,
            displayName: nameInput,
            email: currentUser.email,
            photoURL: currentUser.photoURL,
            createdAt: new Date().toISOString()
        };
        
        await setDoc(doc(db, "users", currentUser.uid), profileData);

        // 3. Salva dados iniciais vazios ou pega do localStorage se o usuário já usava offline
        const initialData = {
            schedule: JSON.parse(localStorage.getItem('salvese_schedule')) || [],
            tasks: JSON.parse(localStorage.getItem('salvese_tasks')) || [],
            reminders: JSON.parse(localStorage.getItem('salvese_reminders')) || [],
            lastUpdated: new Date().toISOString()
        };
        
        await setDoc(doc(db, "users", currentUser.uid, "data", "appData"), initialData);

        // Atualiza estado local e força recarregamento da UI
        userProfile = profileData;
        document.getElementById('profile-setup-screen').classList.add('hidden');
        document.querySelector('.app-content-wrapper').classList.remove('hidden');
        updateUserInterfaceInfo();
        initRealtimeSync(currentUser.uid);

    } catch (error) {
        console.error("Erro ao criar perfil:", error);
        errorMsg.innerText = "Erro ao salvar perfil. Tente novamente.";
    }
};

// 5. Sincronização Realtime (O Coração do Híbrido)
function initRealtimeSync(uid) {
    const dataRef = doc(db, "users", uid, "data", "appData");

    // Escuta mudanças no Firebase
    unsubscribeData = onSnapshot(dataRef, (doc) => {
        if (doc.exists()) {
            const cloudData = doc.data();
            console.log("Dados recebidos da nuvem:", cloudData);

            // LÓGICA DE CONFLITO SIMPLES:
            // Se a nuvem mudar, atualizamos o LocalStorage e a Tela.
            // Isso garante que se você usou o celular, o PC atualiza.
            
            // Salva no LocalStorage
            localStorage.setItem('salvese_schedule', JSON.stringify(cloudData.schedule || []));
            localStorage.setItem('salvese_tasks', JSON.stringify(cloudData.tasks || []));
            localStorage.setItem('salvese_reminders', JSON.stringify(cloudData.reminders || []));

            // Atualiza variáveis globais do script antigo
            scheduleData = cloudData.schedule || [];
            tasksData = cloudData.tasks || [];
            remindersData = cloudData.reminders || [];

            // Re-renderiza a interface
            refreshAllUI();
        }
    });
}

function updateUserInterfaceInfo() {
    const nameDisplay = document.getElementById('user-display-name');
    const handleDisplay = document.getElementById('user-display-id');
    
    if(userProfile) {
        if(nameDisplay) nameDisplay.innerText = userProfile.displayName;
        if(handleDisplay) handleDisplay.innerText = "@" + userProfile.handle;
    }
}

function refreshAllUI() {
    if (window.renderSchedule) window.renderSchedule();
    if (window.renderTasks) window.renderTasks();
    if (window.renderReminders) window.renderReminders();
    if (window.updateDashboardTasksWidget) window.updateDashboardTasksWidget();
    if (window.updateNextClassWidget) window.updateNextClassWidget();
}


// ============================================================
// --- CÓDIGO ORIGINAL DA APLICAÇÃO (ADAPTADO) ---
// ============================================================

// --- LÓGICA DE TEMA (INICIALIZAÇÃO) ---
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

// --- LÓGICA PWA E OFFLINE ---
const manifest = {
    "name": "Salve-se Painel",
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
                
                // Se voltar a ficar online, tenta sincronizar dados pendentes (O Firestore faz isso sozinho, mas forçamos atualização da UI)
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

// --- GESTÃO DE DADOS (MODIFICADO PARA FIREBASE) ---

// Inicializa com LocalStorage para ser RÁPIDO e OFFLINE FIRST
let scheduleData = JSON.parse(localStorage.getItem('salvese_schedule')) || [];
let tasksData = JSON.parse(localStorage.getItem('salvese_tasks')) || [];
let remindersData = JSON.parse(localStorage.getItem('salvese_reminders')) || [];
let selectedClassIdToDelete = null;

let currentTaskFilter = 'all'; 

// FUNÇÃO SAVEDATA ATUALIZADA
async function saveData() {
    // 1. Salva Localmente (Sempre, funciona offline)
    localStorage.setItem('salvese_schedule', JSON.stringify(scheduleData));
    localStorage.setItem('salvese_tasks', JSON.stringify(tasksData));
    localStorage.setItem('salvese_reminders', JSON.stringify(remindersData));

    // 2. Atualiza UI Local
    refreshAllUI();

    // 3. Salva no Firebase (Se logado)
    // O Firestore gerencia a fila se estiver offline automaticamente via enableIndexedDbPersistence
    if (currentUser) {
        try {
            const dataToSave = {
                schedule: scheduleData,
                tasks: tasksData,
                reminders: remindersData,
                lastUpdated: new Date().toISOString()
            };
            // Usamos setDoc com merge para não apagar outros campos se houver
            await setDoc(doc(db, "users", currentUser.uid, "data", "appData"), dataToSave, { merge: true });
            console.log("Dados sincronizados com a nuvem.");
        } catch (e) {
            console.error("Erro ao sincronizar nuvem (provavelmente offline, será enviado depois):", e);
        }
    }
}

// --- LÓGICA DE TAREFAS (TODO) ---

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
    
    const dashCountOld = document.getElementById('dash-task-count'); 
    if(dashCountOld) dashCountOld.innerText = pendingTasks.length;
    
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


// --- CONFIGURAÇÃO DE HORÁRIOS ---
const timeSlots = [
    { start: "07:00", end: "08:00" },
    { start: "08:00", end: "09:00" },
    { start: "09:00", end: "10:00" },
    { start: "10:00", end: "11:00" },
    { start: "11:00", end: "12:00" },
    { start: "12:00", end: "13:00" },
    { start: "13:00", end: "14:00" },
    { start: "14:00", end: "15:00" },
    { start: "15:00", end: "16:00" },
    { start: "16:00", end: "17:00" },
    { start: "17:00", end: "18:00" }, 
    { start: "18:30", end: "19:30" }, 
    { start: "19:30", end: "20:30" },
    { start: "20:30", end: "21:30" },
    { start: "21:30", end: "22:30" }
];

const daysList = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const daysDisplay = {'seg': 'Seg', 'ter': 'Ter', 'qua': 'Qua', 'qui': 'Qui', 'sex': 'Sex', 'sab': 'Sab'};

// --- SISTEMA DE GRADE ---
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

// --- FUNÇÕES DE MODAL E CORES ---
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

// --- OUTRAS FUNCIONALIDADES ---

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

// Reminders Logic
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

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    // Renderiza imediatamente o que estiver no localStorage
    window.renderTasks();
    window.renderReminders();
    if (window.renderSchedule) window.renderSchedule();
    window.updateNextClassWidget();
    
    const activeMobileLink = document.querySelector(`#mobile-menu nav a[onclick*="'home'"]`);
    if(activeMobileLink) {
         activeMobileLink.classList.add('bg-indigo-50', 'text-indigo-600', 'dark:bg-indigo-900/50', 'dark:text-indigo-300');
         activeMobileLink.classList.remove('text-gray-600', 'dark:text-gray-400');
    }

    setInterval(window.updateNextClassWidget, 60000);
});

// Navegação e Histórico
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
            btn.onclick = () => setThemeColor(color);
            menu.appendChild(btn);
        });
        menu.classList.remove('hidden');
        menu.classList.add('visible');
    }
}

const colorPalettes = {
    cyan: { 50: '236 254 255', 100: '207 250 254', 200: '165 243 252', 300: '103 232 249', 400: '34 211 238', 500: '6 182 212', 600: '8 145 178', 700: '14 116 144', 800: '21 94 117', 900: '22 78 99' },
    red: { 50: '254 242 242', 100: '254 226 226', 200: '254 202 202', 300: '252 165 165', 400: '248 113 113', 500: '239 68 68', 600: '220 38 38', 700: '185 28 28', 800: '153 27 27', 900: '127 29 29' },
    green: { 50: '240 253 244', 100: '220 252 231', 200: '187 247 208', 300: '134 239 172', 400: '74 222 128', 500: '34 197 94', 600: '22 163 74', 700: '21 128 61', 800: '22 101 52', 900: '20 83 45' },
    yellow: { 50: '254 252 232', 100: '254 249 195', 200: '254 240 138', 300: '253 224 71', 400: '250 204 21', 500: '234 179 8', 600: '202 138 4', 700: '161 98 7', 800: '133 77 14', 900: '113 63 18' },
    purple: { 50: '250 245 255', 100: '243 232 255', 200: '233 213 255', 300: '216 180 254', 400: '192 132 252', 500: '168 85 247', 600: '147 51 234', 700: '126 34 206', 800: '107 33 168', 900: '88 28 135' },
    pink: { 50: '253 242 248', 100: '252 231 243', 200: '251 204 231', 300: '249 168 212', 400: '244 114 182', 500: '236 72 153', 600: '219 39 119', 700: '190 24 93', 800: '157 23 77', 900: '131 24 67' },
    orange: { 50: '255 247 237', 100: '255 237 213', 200: '254 215 170', 300: '253 186 116', 400: '251 146 60', 500: '249 115 22', 600: '234 88 12', 700: '194 65 12', 800: '154 52 18', 900: '124 45 18' },
    indigo: { 50: '238 242 255', 100: '224 231 255', 200: '199 210 254', 300: '165 180 252', 400: '129 140 248', 500: '99 102 241', 600: '79 70 229', 700: '67 56 202', 800: '55 48 163', 900: '49 46 129' },
    teal: { 50: '240 253 250', 100: '204 251 241', 200: '153 246 228', 300: '94 234 212', 400: '45 212 191', 500: '20 184 166', 600: '13 148 136', 700: '15 118 110', 800: '17 94 89', 900: '19 78 74' }
};

function setThemeColor(colorName) {
    const palette = colorPalettes[colorName];
    if (!palette) return;
    const iconColor = `rgb(${palette[600]})`;
    document.querySelectorAll('#desktop-palette-icon, #mobile-palette-icon').forEach(icon => {
        icon.classList.remove('text-indigo-600');
        icon.style.color = iconColor;
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

window.switchPage = function(pageId, addToHistory = true) {
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

        if(link.getAttribute('onclick').includes(`'${pageId}'`)) {
             link.classList.add('bg-indigo-50', 'text-indigo-600', 'dark:bg-indigo-900/50', 'dark:text-indigo-300');
             link.classList.remove('text-gray-600', 'dark:text-gray-400');
        }
    });

    const titles = { home: 'Página Principal', onibus: 'Transporte', calc: 'Calculadora', pomo: 'Modo Foco', todo: 'Tarefas', email: 'Templates', aulas: 'Grade Horária', fluxo: 'Fluxograma' };
    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) pageTitleEl.innerText = titles[pageId] || 'Salve-se';
    
    if(pageId === 'aulas' && window.renderSchedule) window.renderSchedule();

    if(addToHistory) {
        history.pushState({view: pageId}, null, `#${pageId}`);
    }
}

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

function addTime(baseTime, minutesToAdd) { const [h, m] = baseTime.split(':').map(Number); const date = new Date(); date.setHours(h); date.setMinutes(m + minutesToAdd); return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function createTrip(startTime, endTime, routeType, speed = 'normal') {
    let stops = []; const factor = speed === 'fast' ? 0.7 : 1.0;
    if (routeType === 'saida-garagem') { stops = [{ loc: 'Garagem (Saída)', t: 0 }, { loc: 'RU/Resid.', t: Math.round(2 * factor) }, { loc: 'Fitotecnia', t: Math.round(4 * factor) }, { loc: 'Prédio Solos', t: Math.round(6 * factor) }, { loc: 'Pav. Aulas I', t: Math.round(8 * factor) }, { loc: 'Biblioteca', t: Math.round(10 * factor) }, { loc: 'Pav. Aulas II', t: Math.round(12 * factor) }, { loc: 'Pav. Engenharia', t: Math.round(13 * factor) }, { loc: 'Portão II', t: Math.round(15 * factor) }, { loc: 'Ponto Ext. I', t: Math.round(16 * factor) }, { loc: 'Ponto Ext. II', t: Math.round(17 * factor) }, { loc: 'Portão I', t: Math.round(18 * factor) }, { loc: 'Biblioteca', t: Math.round(20 * factor) }, { loc: 'Torre/COTEC', t: Math.round(22 * factor) }, { loc: 'RU (Chegada)', t: Math.round(24 * factor) }]; }
    else if (routeType === 'volta-campus') { stops = [{ loc: 'RU/Resid. (Início)', t: 0 }, { loc: 'Fitotecnia', t: Math.round(2 * factor) }, { loc: 'Prédio Solos', t: Math.round(4 * factor) }, { loc: 'Pav. Aulas I', t: Math.round(6 * factor) }, { loc: 'Biblioteca', t: Math.round(8 * factor) }, { loc: 'Pav. Aulas II', t: Math.round(10 * factor) }, { loc: 'Pav. Engenharia', t: Math.round(11 * factor) }, { loc: 'Portão II', t: Math.round(13 * factor) }, { loc: 'Ponto Ext. I', t: Math.round(14 * factor) }, { loc: 'Ponto Ext. II', t: Math.round(15 * factor) }, { loc: 'Portão I', t: Math.round(16 * factor) }, { loc: 'Biblioteca', t: Math.round(18 * factor) }, { loc: 'Torre/COTEC', t: Math.round(20 * factor) }, { loc: 'RU (Fim)', t: Math.round(22 * factor) }]; }
    else if (routeType === 'recolhe') { stops = [{ loc: 'RU/Resid.', t: 0 }, { loc: 'Fitotecnia', t: 2 }, { loc: 'Prédio Solos', t: 4 }, { loc: 'Eng. Florestal', t: 6 }, { loc: 'Garagem (Chegada)', t: Math.round(15 * factor) }]; }
    else if (routeType === 'volta-e-recolhe') { stops = [{ loc: 'RU/Resid. (Início)', t: 0 }, { loc: 'Fitotecnia', t: 2 }, { loc: 'Prédio Solos', t: 3 }, { loc: 'Pav. Aulas I', t: 5 }, { loc: 'Biblioteca', t: 6 }, { loc: 'Pav. Aulas II', t: 8 }, { loc: 'Pav. Engenharia', t: 9 }, { loc: 'Portão II', t: 10 }, { loc: 'Ponto Ext. I', t: 11 }, { loc: 'Ponto Ext. II', t: 12 }, { loc: 'Portão I', t: 13 }, { loc: 'Biblioteca', t: 14 }, { loc: 'Torre/COTEC', t: 16 }, { loc: 'RU (Fim Volta)', t: 18 }, { loc: 'Fitotecnia', t: 20 }, { loc: 'Prédio Solos', t: 21 }, { loc: 'Eng. Florestal', t: 23 }, { loc: 'Garagem (Chegada)', t: 25 }]; }
    return { start: startTime, end: endTime, origin: stops[0].loc, dest: stops[stops.length - 1].loc, stops: stops.map(s => { if ((routeType === 'recolhe' || routeType === 'volta-e-recolhe') && s.loc.includes('Garagem')) return { loc: s.loc, time: endTime }; return { loc: s.loc, time: addTime(startTime, s.t) }; }) };
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
renderBusTable(); updateNextBus(); setInterval(updateNextBus, 1000);

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

addGradeRow(); addGradeRow();
if(document.getElementById('passing-grade')) document.getElementById('passing-grade').addEventListener('input', calculateAverage);

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

const templates = {
    deadline: `Prezado(a) Prof(a). [Nome],\n\nSolicito respeitosamente uma extensão no prazo do trabalho [Nome], originalmente para [Data]. Tive um imprevisto [Motivo] e preciso de mais tempo para entregar com qualidade.\n\nAtenciosamente,\n[Seu Nome]`,
    review: `Prezado(a) Prof(a). [Nome],\n\nGostaria de solicitar a revisão da minha prova de [Matéria]. Fiquei com dúvida na questão [X].\n\nAtenciosamente,\n[Seu Nome]`,
    absence: `Prezado(a) Prof(a). [Nome],\n\nJustifico minha falta no dia [Data] devido a [Motivo]. Segue anexo (se houver).\n\nAtenciosamente,\n[Seu Nome]`,
    tcc: `Prezado(a) Prof(a). [Nome],\n\nTenho interesse em sua área de pesquisa e gostaria de saber se há disponibilidade para orientação de TCC sobre [Tema].\n\nAtenciosamente,\n[Seu Nome]`
};
window.loadTemplate = function(k) { document.getElementById('email-content').value = templates[k]; }
window.copyEmail = function() { const e = document.getElementById('email-content'); e.select(); document.execCommand('copy'); }
window.openPortal = function() { window.open('https://sistemas.ufrb.edu.br/sigaa/verTelaLogin.do', '_blank'); }