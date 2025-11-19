// ------------------------------------------------
// --- INICIALIZAÇÃO E TEMA ---
// ------------------------------------------------

// Configuração de cores (Paleta Tailwind extendida)
const colorPalettes = {
    cyan: { 50: '236 254 255', 100: '207 250 254', 500: '6 182 212', 600: '8 145 178', 700: '14 116 144' },
    red: { 50: '254 242 242', 100: '254 226 226', 500: '239 68 68', 600: '220 38 38', 700: '185 28 28' },
    green: { 50: '240 253 244', 100: '220 252 231', 500: '34 197 94', 600: '22 163 74', 700: '21 128 61' },
    yellow: { 50: '254 252 232', 100: '254 249 195', 500: '234 179 8', 600: '202 138 4', 700: '161 98 7' },
    purple: { 50: '250 245 255', 100: '243 232 255', 500: '168 85 247', 600: '147 51 234', 700: '126 34 206' },
    pink: { 50: '253 242 248', 100: '252 231 243', 500: '236 72 153', 600: '219 39 119', 700: '190 24 93' },
    orange: { 50: '255 247 237', 100: '255 237 213', 500: '249 115 22', 600: '234 88 12', 700: '194 65 12' },
    indigo: { 50: '238 242 255', 100: '224 231 255', 500: '99 102 241', 600: '79 70 229', 700: '67 56 202' },
    teal: { 50: '240 253 250', 100: '204 251 241', 500: '20 184 166', 600: '13 148 136', 700: '15 118 110' }
};

function initTheme() {
    // Dark Mode
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }

    // Cor do Tema
    const savedColor = localStorage.getItem('salvese_color');
    if (savedColor) {
        try {
            updateColorVars(JSON.parse(savedColor));
        } catch (e) {
            console.error("Erro ao carregar cor", e);
        }
    }
}
initTheme();

function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
}

function toggleColorMenu(device) {
    const menu = document.getElementById(`color-menu-${device}`);
    if (!menu) return;

    // Fecha outros menus abertos
    document.querySelectorAll('.color-menu').forEach(m => {
        if (m.id !== `color-menu-${device}`) m.classList.add('hidden');
    });

    const isHidden = menu.classList.contains('hidden');
    
    if (isHidden) {
        menu.innerHTML = '';
        Object.keys(colorPalettes).forEach(color => {
            const btn = document.createElement('button');
            const rgb = colorPalettes[color][500];
            btn.className = `w-8 h-8 rounded-full border-2 border-white dark:border-gray-700 hover:scale-110 transition transform shadow-sm`;
            btn.style.backgroundColor = `rgb(${rgb})`;
            btn.onclick = (e) => {
                e.stopPropagation(); // Impede fechar o menu imediatamente
                setThemeColor(color);
                menu.classList.add('hidden');
            };
            menu.appendChild(btn);
        });
        menu.classList.remove('hidden');
        menu.classList.add('visible');
    } else {
        menu.classList.add('hidden');
    }
}

function setThemeColor(colorName) {
    const palette = colorPalettes[colorName];
    if (!palette) return;
    
    const iconColor = `rgb(${palette[600]})`;
    document.querySelectorAll('#desktop-palette-icon, #mobile-palette-icon').forEach(icon => {
        icon.style.color = iconColor;
    });

    updateColorVars(palette);
    localStorage.setItem('salvese_color', JSON.stringify(palette));
}

function updateColorVars(palette) {
    const root = document.documentElement;
    Object.keys(palette).forEach(shade => {
        root.style.setProperty(`--theme-${shade}`, palette[shade]);
    });
}

// Fecha menus ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('button[onclick^="toggleColorMenu"]') && !e.target.closest('.color-menu')) {
        document.querySelectorAll('.color-menu').forEach(m => m.classList.add('hidden'));
    }
});

// ------------------------------------------------
// --- NAVEGAÇÃO E HISTÓRICO (SISTEMA VOLTAR) ---
// ------------------------------------------------

// Estado inicial do histórico
history.replaceState({ page: 'home', modal: null }, '', '');

function switchPage(pageId, pushState = true) {
    // Esconde todas as views
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    
    // Mostra a view alvo
    const target = document.getElementById(`view-${pageId}`);
    if (target) {
        target.classList.remove('hidden');
        window.scrollTo(0, 0);
    }

    // Atualiza Sidebar (Desktop)
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeLink = document.getElementById(`nav-${pageId}`);
    if (activeLink) activeLink.classList.add('active');

    // Atualiza Menu Mobile (Visual) - Adiciona destaque na aba atual
    // Remove estilos ativos anteriores no mobile
    const mobileLinks = document.querySelectorAll('#mobile-menu a');
    mobileLinks.forEach(link => {
        link.classList.remove('bg-indigo-50', 'text-indigo-600', 'dark:bg-neutral-800', 'dark:text-white', 'font-bold');
        link.classList.add('text-gray-600', 'dark:text-gray-400');
    });

    // Acha o link correspondente no menu mobile (usando onclick como ref ou criar IDs)
    // Vamos assumir a ordem ou usar o texto, mas o ideal é adicionar IDs nos links do menu mobile no HTML.
    // Como o HTML usa onclick, vamos procurar pelo href ou onclick.
    const mobileLink = Array.from(mobileLinks).find(l => l.getAttribute('onclick')?.includes(`'${pageId}'`));
    if (mobileLink) {
        mobileLink.classList.remove('text-gray-600', 'dark:text-gray-400');
        mobileLink.classList.add('bg-indigo-50', 'text-indigo-600', 'dark:bg-neutral-800', 'dark:text-white', 'font-bold');
    }

    // Títulos
    const titles = { 
        home: 'Página Principal', 
        onibus: 'Transporte Circular', 
        calc: 'Calculadora', 
        pomo: 'Modo Foco', 
        todo: 'Lista de Tarefas', 
        email: 'Templates de Email', 
        aulas: 'Grade Horária' 
    };
    const pageTitleEl = document.getElementById('page-title');
    if (pageTitleEl) pageTitleEl.innerText = titles[pageId] || 'Salve-se';

    // Histórico do Navegador
    if (pushState) {
        history.pushState({ page: pageId, modal: null }, '', `#${pageId}`);
    }

    // Renderizações específicas
    if(pageId === 'aulas' && window.renderSchedule) window.renderSchedule();
    if(pageId === 'todo' && window.renderTasks) window.renderTasks();
}

// Listener Global para o botão Voltar do Navegador/Celular
window.addEventListener('popstate', (event) => {
    // 1. Verifica Modais Abertos
    const openModal = document.querySelector('[id$="-modal"]:not(.hidden):not(.opacity-0)');
    const mobileMenu = document.getElementById('mobile-menu');
    
    // Se menu mobile estiver aberto
    if (mobileMenu && !mobileMenu.classList.contains('-translate-x-full')) {
        mobileMenu.classList.add('-translate-x-full');
        document.getElementById('menu-overlay').classList.add('hidden');
        return;
    }

    // Se algum modal estiver aberto
    if (openModal) {
        // Fecha o modal correspondente
        if(openModal.id === 'class-modal') toggleModal(false);
        else if(openModal.id === 'reminders-modal') toggleRemindersModal();
        else if(openModal.id === 'delete-confirmation-modal') closeDeleteConfirmation();
        else if(openModal.id === 'generic-modal') closeGenericModal();
        return;
    }

    // 2. Navegação de Páginas
    if (event.state && event.state.page) {
        switchPage(event.state.page, false); // false para não duplicar histórico
    } else {
        switchPage('home', false);
    }
});

// ------------------------------------------------
// --- RELÓGIO CENTRAL ---
// ------------------------------------------------

let clockMode = 0;
const clockStyles = [
    { format: '24h', showSeconds: true },   // 14:30:05
    { format: '12h', showSeconds: true },   // 02:30:05 PM
    { format: 'minimal', showSeconds: false }, // 14:30
    { format: 'full', showSeconds: false }     // 19/11 • 14:30
];

function cycleClockMode() {
    clockMode = (clockMode + 1) % clockStyles.length;
    updateClock();
}

function updateClock() {
    const now = new Date();
    const style = clockStyles[clockMode];
    let timeString = "";

    if (style.format === '24h') {
        timeString = now.toLocaleTimeString('pt-BR');
    } else if (style.format === '12h') {
        timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    } else if (style.format === 'minimal') {
        timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } else if (style.format === 'full') {
        const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        timeString = `${date} • ${time}`;
    }

    const clockEl = document.getElementById('clock');
    if (clockEl) {
        clockEl.innerText = timeString;
        // Feedback visual de clique
        clockEl.style.opacity = '0.5';
        setTimeout(() => clockEl.style.opacity = '1', 150);
    }
}
setInterval(updateClock, 1000);
updateClock();

// ------------------------------------------------
// --- GESTÃO DE DADOS (LocalStorage) ---
// ------------------------------------------------
let scheduleData = JSON.parse(localStorage.getItem('salvese_schedule')) || [];
let tasksData = JSON.parse(localStorage.getItem('salvese_tasks')) || [];
let remindersData = JSON.parse(localStorage.getItem('salvese_reminders')) || [];
let selectedClassIdToDelete = null;
let currentTaskFilter = 'all';

function saveData() {
    localStorage.setItem('salvese_schedule', JSON.stringify(scheduleData));
    localStorage.setItem('salvese_tasks', JSON.stringify(tasksData));
    localStorage.setItem('salvese_reminders', JSON.stringify(remindersData));

    if (window.renderSchedule) window.renderSchedule();
    if (window.renderTasks) window.renderTasks();
    if (window.renderReminders) window.renderReminders();
    updateDashboardTasksWidget();
    updateNextClassWidget();
}

// ------------------------------------------------
// --- TAREFAS (TODO) ---
// ------------------------------------------------

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
    renderTasks();
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
            </div>`;
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
    updateDashboardTasksWidget();
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
            </div>`;
        return;
    }

    const priorityWeight = { 'high': 3, 'medium': 2, 'normal': 1 };
    const topTasks = [...pendingTasks].sort((a, b) => priorityWeight[b.priority || 'normal'] - priorityWeight[a.priority || 'normal']).slice(0, 3);

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

// ------------------------------------------------
// --- GRADE HORÁRIA ---
// ------------------------------------------------

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

    const mobileHeader = document.createElement('div');
    mobileHeader.className = "md:hidden flex justify-between items-center mb-6 px-1";
    mobileHeader.innerHTML = `
        <h2 class="text-xl font-bold text-gray-900 dark:text-white">Minha Grade</h2>
        <button onclick="openAddClassModal()" class="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg"><i class="fas fa-plus text-sm"></i></button>
    `;
    wrapper.appendChild(mobileHeader);

    // Mobile View
    const mobileContainer = document.createElement('div');
    mobileContainer.className = "md:hidden space-y-6";

    daysList.forEach(dayKey => {
        const classesToday = scheduleData.filter(c => c.day === dayKey).sort((a, b) => parseInt(a.start.replace(':','')) - parseInt(b.start.replace(':','')));
        if (classesToday.length === 0) return; // Oculta dias vazios no mobile para limpar tela

        const daySection = document.createElement('div');
        daySection.className = "flex flex-col gap-3";
        daySection.innerHTML = `<h3 class="text-lg font-bold text-gray-800 dark:text-gray-100 px-1">${daysDisplay[dayKey]}</h3>`;

        const cardsContainer = document.createElement('div');
        cardsContainer.className = "space-y-3";

        classesToday.forEach(aula => {
            const colorKey = aula.color || 'indigo';
            const palette = colorPalettes[colorKey] || colorPalettes['indigo'];
            const card = document.createElement('div');
            card.className = "relative rounded-xl p-4 cursor-pointer active:scale-[0.98] transition-transform overflow-hidden group border border-gray-100 dark:border-transparent";
            card.style.backgroundColor = `rgba(${palette[500]}, 0.1)`;
            
            card.innerHTML = `
                <div class="absolute left-0 top-0 bottom-0 w-1.5" style="background-color: rgb(${palette[500]})"></div>
                <div class="pl-3 flex justify-between items-start">
                    <div class="flex-1 pr-2">
                        <h4 class="font-bold text-xl leading-tight mb-1" style="color: rgb(${palette[700]}); filter: brightness(0.8) contrast(1.5);">${aula.name}</h4>
                        <div class="dark:text-gray-200 text-gray-900 font-medium">
                            <p class="text-base font-medium opacity-90" style="color: rgb(${palette[600]})">${aula.prof}</p>
                            <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">${aula.room}</p>
                        </div>
                    </div>
                    <div class="text-right flex flex-col items-end">
                         <div class="text-sm font-bold opacity-80 mb-0.5 px-2 py-1 rounded bg-white dark:bg-black/20" style="color: rgb(${palette[700]})">${aula.start}</div>
                         <div class="text-xs opacity-60 dark:text-gray-400 mt-1">${aula.end}</div>
                    </div>
                </div>
            `;
            card.onclick = () => openEditClassModal(aula.id);
            cardsContainer.appendChild(card);
        });
        daySection.appendChild(cardsContainer);
        mobileContainer.appendChild(daySection);
    });
    
    if (scheduleData.length === 0) {
        mobileContainer.innerHTML = `<div class="text-center py-10 text-gray-400"><p>Toque no + para adicionar aulas.</p></div>`;
    }
    wrapper.appendChild(mobileContainer);

    // Desktop View
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
                <tbody class="divide-y divide-gray-100 dark:divide-darkborder">`;
    const occupied = {};
    timeSlots.forEach((slot, index) => {
        tableHTML += `<tr><td class="p-3 font-mono text-xs font-bold text-gray-500 dark:text-gray-400 bg-gray-50/50 dark:bg-neutral-900/50 sticky left-0 z-10 border-r dark:border-darkborder whitespace-nowrap">${slot.start} - ${slot.end}</td>`;
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
                tableHTML += `
                    <td rowspan="${span}" class="p-1 align-top h-full border-l border-gray-100 dark:border-neutral-800 relative group cursor-pointer hover:brightness-95 dark:hover:brightness-110 transition" onclick="openEditClassModal('${foundClass.id}')">
                        <div class="h-full w-full rounded p-2 flex flex-col justify-center text-left shadow-sm border-l-4" style="background-color: rgba(${palette[500]}, 0.15); border-color: rgb(${palette[500]})">
                            <p class="text-sm font-bold truncate" style="color: rgb(${palette[700]})">${foundClass.name}</p>
                            <p class="text-xs text-gray-600 dark:text-gray-300 truncate opacity-80">${foundClass.prof}</p>
                            <p class="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-1 bg-white/50 dark:bg-black/20 rounded w-fit px-1">${foundClass.room}</p>
                        </div>
                    </td>`;
            } else {
                tableHTML += `<td class="p-1 border-l border-gray-100 dark:border-neutral-800 hover:bg-gray-50 dark:hover:bg-neutral-800 transition cursor-pointer group" onclick="openAddClassModal('${day}', '${slot.start}')"><div class="w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 text-gray-300 dark:text-neutral-600"><i class="fas fa-plus text-xs"></i></div></td>`;
            }
        });
        tableHTML += `</tr>`;
    });
    tableHTML += `</tbody></table></div>`;
    desktopContainer.innerHTML = tableHTML;
    wrapper.appendChild(desktopContainer);
    viewContainer.appendChild(wrapper);
};

// --- MODAIS E CORES ---
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

    const classData = { id: id || Date.now().toString(), name, prof, room, day, start, end, color: window.selectedColor };

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
    // Push history state para o modal de confirmação para o botão voltar funcionar
    history.pushState({ modal: 'delete-confirmation-modal' }, '', '#delete');
    
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
    
    // Se veio do botão voltar, o history já mudou. Se clicou cancelar, voltamos.
    if(history.state && history.state.modal === 'delete-confirmation-modal') history.back();
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
    startSel.innerHTML = ''; endSel.innerHTML = '';
    
    timeSlots.forEach(t => { startSel.innerHTML += `<option value="${t.start}">${t.start}</option>`; });
    timeSlots.forEach(t => { endSel.innerHTML += `<option value="${t.end}">${t.end}</option>`; });
    
    startSel.value = "07:00"; 
    updateEndTime(2);
    renderColorPicker();
}

function updateEndTime(slotsToAdd = 2) {
    const startSel = document.getElementById('class-start');
    const endSel = document.getElementById('class-end');
    const idx = timeSlots.findIndex(s => s.start === startSel.value);
    if (idx !== -1) {
        let targetIdx = idx + (slotsToAdd - 1); 
        if (targetIdx >= timeSlots.length) targetIdx = timeSlots.length - 1;
        endSel.value = timeSlots[targetIdx].end;
    }
}

function toggleModal(show) {
    const modal = document.getElementById('class-modal'); 
    const content = document.getElementById('class-modal-content');
    
    if (show) { 
        // Push state se estiver abrindo
        history.pushState({ modal: 'class-modal' }, '', '#modal');
        modal.classList.remove('hidden'); 
        setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); content.classList.add('scale-100'); }, 10); 
    } else { 
        modal.classList.add('opacity-0'); content.classList.remove('scale-100'); content.classList.add('scale-95'); 
        setTimeout(() => modal.classList.add('hidden'), 300); 
        
        // Se o estado atual é o do modal, volta um.
        if(history.state && history.state.modal === 'class-modal') history.back();
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

// --- WIDGET PRÓXIMA AULA ---
function updateNextClassWidget() {
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
            nextClass = c; status = 'future'; break;
        } else if (currentMinutes >= startMins && currentMinutes < endMins) {
            nextClass = c; status = 'now'; break;
        }
    }

    if (nextClass) {
        const [hStart, mStart] = nextClass.start.split(':').map(Number);
        const [hEnd, mEnd] = nextClass.end.split(':').map(Number);
        const startMins = hStart * 60 + mStart;
        const endMins = hEnd * 60 + mEnd;
        let badgeHTML = '', progressHTML = '';

        if (status === 'future') {
            let diffMins = startMins - currentMinutes;
            const h = Math.floor(diffMins / 60); const m = diffMins % 60;
            const timeTxt = h > 0 ? `${h}h ${m}min` : `${diffMins} min`;
            badgeHTML = `<div class="inline-flex items-center gap-1 bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1 rounded-full text-xs font-bold mt-3 shadow-sm"><i class="far fa-clock"></i> Faltam ${timeTxt}</div>`;
        } else {
            const percentage = Math.min(100, Math.max(0, ((currentMinutes - startMins) / (endMins - startMins)) * 100));
            badgeHTML = `<div class="inline-flex items-center gap-1 bg-green-600 text-white px-3 py-1 rounded-full text-xs font-bold mt-3 shadow-sm animate-pulse"><i class="fas fa-circle text-[8px]"></i> Acontecendo Agora</div>`;
            progressHTML = `<div class="w-full bg-gray-200 dark:bg-neutral-700 rounded-full h-1.5 mt-3"><div class="bg-green-500 h-1.5 rounded-full transition-all duration-1000" style="width: ${percentage}%"></div></div><p class="text-[10px] text-gray-400 dark:text-gray-500 text-right mt-1">Termina em ${endMins - currentMinutes} min</p>`;
        }

        container.innerHTML = `<div class="animate-fade-in-up"><h2 class="text-2xl font-bold text-gray-900 dark:text-white leading-tight mb-1 truncate">${nextClass.name}</h2><p class="text-gray-500 dark:text-gray-400 font-medium mb-1 truncate">${nextClass.prof}</p><div class="text-sm text-gray-600 dark:text-gray-300 flex gap-3 mt-2 items-center"><span class="font-semibold flex items-center"><i class="fas fa-map-marker-alt mr-1.5 text-indigo-500"></i> ${nextClass.room}</span><span class="flex items-center text-gray-400 dark:text-gray-500 text-xs bg-gray-100 dark:bg-neutral-800 px-2 py-0.5 rounded">${nextClass.start} - ${nextClass.end}</span></div>${badgeHTML}${progressHTML}</div>`;
    } else {
        const msg = scheduleData.length === 0 ? "Adicione aulas na Grade." : "Você está livre!";
        const action = scheduleData.length === 0 ? "onclick=\"switchPage('aulas'); openAddClassModal()\" class='cursor-pointer hover:opacity-80 transition'" : "";
        container.innerHTML = `<div class="py-4 text-center" ${action}><div class="w-12 h-12 bg-gray-100 dark:bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-400 dark:text-gray-500"><i class="${scheduleData.length === 0 ? "fas fa-plus-circle" : "fas fa-couch"} text-xl"></i></div><h2 class="text-lg font-bold text-gray-400 dark:text-gray-500 mb-1 leading-tight">Sem aulas agora</h2><p class="text-xs text-gray-400 dark:text-gray-600 font-medium">${msg}</p></div>`;
    }
}

// ------------------------------------------------
// --- REMINDERS & MODAL ---
// ------------------------------------------------
function toggleRemindersModal() {
    const modal = document.getElementById('reminders-modal');
    const content = modal ? modal.firstElementChild : null;
    if (!modal) return;

    if (modal.classList.contains('hidden')) {
        renderReminders();
        history.pushState({ modal: 'reminders-modal' }, '', '#reminders');
        modal.classList.remove('hidden');
        setTimeout(() => { modal.classList.remove('opacity-0'); if(content) { content.classList.remove('scale-95'); content.classList.add('scale-100'); } }, 10);
    } else {
        modal.classList.add('opacity-0'); if(content) { content.classList.remove('scale-100'); content.classList.add('scale-95'); }
        setTimeout(() => modal.classList.add('hidden'), 300);
        if(history.state && history.state.modal === 'reminders-modal') history.back();
    }
}

function showReminderForm() {
    document.getElementById('btn-add-reminder').classList.add('hidden');
    document.getElementById('reminder-form').classList.remove('hidden');
    document.getElementById('rem-date').valueAsDate = new Date();
}

function hideReminderForm() {
    document.getElementById('reminder-form').classList.add('hidden');
    document.getElementById('btn-add-reminder').classList.remove('hidden');
    document.getElementById('rem-desc').value = '';
}

function addReminder() {
    const desc = document.getElementById('rem-desc').value.trim();
    const date = document.getElementById('rem-date').value;
    const prio = document.getElementById('rem-prio').value;
    if (!desc) return;
    remindersData.push({ id: Date.now().toString(), desc, date, prio, createdAt: Date.now() });
    saveData();
    hideReminderForm();
}

function deleteReminder(id) {
    remindersData = remindersData.filter(r => r.id !== id);
    saveData();
}

function renderReminders() {
    const listModal = document.getElementById('reminders-list-modal');
    const listHome = document.getElementById('home-reminders-list');
    const badge = document.getElementById('notification-badge');
    const sorted = [...remindersData].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    if(badge) { if (sorted.length > 0) badge.classList.remove('hidden'); else badge.classList.add('hidden'); }

    const generateHTML = (rem, isHome) => {
        const dateObj = new Date(rem.date + 'T00:00:00');
        let prioColor = 'bg-gray-100 text-gray-600 dark:bg-neutral-800 dark:text-gray-400';
        if (rem.prio === 'high') prioColor = 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
        if (rem.prio === 'medium') prioColor = 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400';
        const deleteBtn = isHome ? '' : `<button onclick="deleteReminder('${rem.id}')" class="text-gray-400 hover:text-red-500 transition px-2"><i class="fas fa-trash-alt"></i></button>`;
        return `<div class="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-neutral-800 bg-white dark:bg-darkcard hover:bg-gray-50 dark:hover:bg-neutral-800/50 transition group"><div class="flex items-center gap-3 overflow-hidden"><div class="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-gray-50 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 flex-shrink-0"><span class="text-xs font-bold uppercase text-gray-500 leading-none">${dateObj.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span><span class="text-lg font-bold text-gray-800 dark:text-white leading-none">${dateObj.getDate()}</span></div><div class="min-w-0"><p class="text-sm font-medium text-gray-800 dark:text-white truncate">${rem.desc}</p><span class="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${prioColor}">${rem.prio === 'high' ? 'Alta' : (rem.prio === 'medium' ? 'Média' : 'Baixa')}</span></div></div>${deleteBtn}</div>`;
    };

    if(listModal) {
        listModal.innerHTML = sorted.length === 0 ? `<div class="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-600"><i class="fas fa-exclamation-circle text-3xl mb-2 opacity-20"></i><p class="text-sm">Nenhum lembrete.</p></div>` : sorted.map(r => generateHTML(r, false)).join('');
    }
    if(listHome) {
        listHome.innerHTML = sorted.length === 0 ? `<div class="flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-gray-100 dark:border-neutral-800 rounded-lg h-full"><p class="text-gray-400 dark:text-gray-500 font-medium">Nenhum lembrete.</p></div>` : sorted.slice(0, 3).map(r => generateHTML(r, true)).join('');
    }
}

// ------------------------------------------------
// --- PWA ---
// ------------------------------------------------
const manifest = { "name": "Salve-se Painel", "short_name": "Salve-se", "start_url": ".", "display": "standalone", "background_color": "#09090b", "theme_color": "#4f46e5", "icons": [ { "src": "https://files.catbox.moe/xvifnp.png", "sizes": "192x192", "type": "image/png" }, { "src": "https://files.catbox.moe/xvifnp.png", "sizes": "512x512", "type": "image/png" } ] };
const blobManifest = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
document.querySelector('#pwa-manifest')?.setAttribute('href', URL.createObjectURL(blobManifest));

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => { console.log('SW OK'); reg.update(); }).catch(err => console.log('SW Fail', err));
    });
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault(); deferredPrompt = e;
        const installBtn = document.getElementById('btn-install-pwa');
        if (installBtn) {
            installBtn.classList.remove('hidden');
            installBtn.addEventListener('click', () => {
                deferredPrompt.prompt();
                deferredPrompt.userChoice.then((choiceResult) => { deferredPrompt = null; installBtn.classList.add('hidden'); });
            });
        }
    });
}
window.addEventListener('online', updateNet); window.addEventListener('offline', updateNet);
function updateNet() {
    const t = document.getElementById('network-toast'), txt = document.getElementById('network-text'), icon = t?.querySelector('i');
    if(t && txt && icon) {
        if(navigator.onLine) { t.className = 'network-status online show'; txt.innerText='Online'; icon.className='fas fa-wifi'; setTimeout(()=>t.classList.remove('show'), 3000); }
        else { t.className = 'network-status offline show'; txt.innerText='Offline'; icon.className='fas fa-wifi-slash'; }
    }
}

// ------------------------------------------------
// --- CIRCULAR ---
// ------------------------------------------------
function addTime(base, min) { const [h, m] = base.split(':').map(Number); const d = new Date(); d.setHours(h); d.setMinutes(m + min); return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function createTrip(s, e, type, spd = 'normal') {
    let stops = []; const f = spd === 'fast' ? 0.7 : 1.0;
    if (type === 'saida-garagem') stops = [{l:'Garagem',t:0}, {l:'RU/Resid.',t:2*f}, {l:'Fitotecnia',t:4*f}, {l:'Solos',t:6*f}, {l:'Pav I',t:8*f}, {l:'Biblio',t:10*f}, {l:'Pav II',t:12*f}, {l:'Engenharia',t:13*f}, {l:'Portão II',t:15*f}, {l:'Ponto Ext I',t:16*f}, {l:'RU (Chegada)',t:24*f}];
    else if (type === 'volta-campus') stops = [{l:'RU/Resid.',t:0}, {l:'Fitotecnia',t:2*f}, {l:'Solos',t:4*f}, {l:'Pav I',t:6*f}, {l:'Biblio',t:8*f}, {l:'Pav II',t:10*f}, {l:'Engenharia',t:11*f}, {l:'Portão II',t:13*f}, {l:'RU (Fim)',t:22*f}];
    else if (type === 'volta-e-recolhe') stops = [{l:'RU/Resid.',t:0}, {l:'Pav I',t:5*f}, {l:'Biblio',t:6*f}, {l:'Pav II',t:8*f}, {l:'Engenharia',t:9*f}, {l:'Portão II',t:10*f}, {l:'RU',t:18*f}, {l:'Garagem',t:25*f}];
    return { start: s, end: e, origin: stops[0].l, dest: stops[stops.length-1].l, stops: stops.map(st => ({ loc: st.l, time: addTime(s, st.t) })) };
}
const busSchedule = [
    createTrip('06:25','06:50','saida-garagem'), createTrip('06:50','07:10','volta-campus','fast'), createTrip('07:10','07:25','volta-campus','fast'), createTrip('07:55','08:20','volta-e-recolhe'),
    createTrip('09:35','10:00','saida-garagem'), createTrip('10:00','10:25','volta-e-recolhe'), createTrip('11:30','11:55','saida-garagem'), createTrip('11:55','12:20','volta-campus'), createTrip('12:20','12:45','volta-e-recolhe'),
    createTrip('13:00','13:25','saida-garagem'), createTrip('13:25','13:45','volta-campus'), createTrip('14:00','14:25','volta-e-recolhe'), createTrip('15:35','16:00','saida-garagem'), createTrip('16:00','16:25','volta-e-recolhe'),
    createTrip('17:30','17:55','saida-garagem'), createTrip('17:55','18:15','volta-campus'), createTrip('18:15','18:40','volta-e-recolhe'), createTrip('20:40','21:00','volta-e-recolhe','fast'), createTrip('21:40','22:00','volta-e-recolhe','fast'), createTrip('22:30','22:50','volta-e-recolhe','fast')
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
    const now = new Date(); const currSec = now.getHours()*3600 + now.getMinutes()*60 + now.getSeconds();
    let activeBus = null, nextBus = null, minDiff = Infinity;
    for (let b of busSchedule) {
        const [h1,m1] = b.start.split(':').map(Number), [h2,m2] = b.end.split(':').map(Number);
        const startS = h1*3600+m1*60, endS = h2*3600+m2*60;
        if (currSec >= startS && currSec < endS) { activeBus = b; break; }
        if (startS > currSec) { const diff = startS - currSec; if (diff < minDiff) { minDiff = diff; nextBus = b; } }
    }
    const area = document.getElementById('bus-dynamic-area'); if(!area) return;
    const title = document.getElementById('dash-bus-title'), sub = document.getElementById('dash-bus-subtitle'), dot = document.getElementById('bus-status-dot'), txt = document.getElementById('bus-status-text');
    
    if (activeBus) {
        dot.className = "w-2 h-2 rounded-full bg-green-500 animate-pulse"; txt.innerText = "Em Trânsito"; txt.className = "text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider";
        title.innerText = activeBus.end; sub.innerText = `Destino: ${activeBus.dest}`;
        let timeline = '<div class="relative pl-3 border-l-2 border-gray-200 dark:border-neutral-800 space-y-4 ml-1">';
        activeBus.stops.filter(s => { const [h,m]=s.time.split(':').map(Number); return (h*3600+m*60) >= (currSec-60); }).slice(0,3).forEach((s,i) => {
            timeline += `<div class="relative flex items-start animate-fade-in-up" style="animation-delay: ${i*100}ms"><div class="absolute -left-[19px] w-3 h-3 rounded-full ${i===0?'bg-green-500 ring-4 ring-green-100 dark:ring-green-900/30':'bg-gray-300 dark:bg-neutral-700'} border-2 border-white dark:border-darkcard mt-1.5"></div><div class="flex justify-between w-full items-start pl-2"><span class="text-sm ${i===0?'text-green-700 dark:text-green-400 font-bold':'text-gray-600 dark:text-gray-400'}">${s.loc}</span><div class="text-right"><span class="text-xs font-mono text-gray-700 dark:text-gray-300 font-bold">${s.time}</span></div></div></div>`;
        });
        area.innerHTML = timeline + '</div>';
    } else if (nextBus) {
        dot.className = "w-2 h-2 rounded-full bg-indigo-500"; txt.innerText = "Próximo"; txt.className = "text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider";
        title.innerText = nextBus.start; sub.innerText = `${nextBus.origin} ➔ ${nextBus.dest}`;
        const h = Math.floor(minDiff/3600), m = Math.floor((minDiff%3600)/60), s = minDiff%60;
        area.innerHTML = `<div class="flex items-center h-full"><div class="w-full py-3 rounded-lg text-center font-bold text-sm ${minDiff<=900?'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 animate-pulse':'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300'}">Saída em ${h>0?h+'h ':''}${m}m ${s}s</div></div>`;
    } else {
        dot.className = "w-2 h-2 rounded-full bg-gray-400"; txt.innerText = "Encerrado"; title.innerText = "--:--"; sub.innerText = "Sem viagens"; area.innerHTML = `<div class="w-full py-3 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 text-center text-sm font-medium mt-auto">Volta amanhã</div>`;
    }
}
renderBusTable(); updateNextBus(); setInterval(updateNextBus, 1000);

// ------------------------------------------------
// --- CALCULADORA ---
// ------------------------------------------------
function addGradeRow() {
    const c = document.getElementById('grades-container'); if(!c) return;
    const d = document.createElement('div'); d.className = "flex gap-3 items-center fade-in";
    d.innerHTML = `<div class="flex-grow relative"><input type="text" inputmode="decimal" class="grade-input w-full bg-gray-50 dark:bg-neutral-900/50 border border-gray-300 dark:border-neutral-700 rounded-xl pl-4 py-3 outline-none focus:border-indigo-500 dark:text-white font-medium" placeholder="Nota"></div><div class="w-28 relative"><input type="text" inputmode="decimal" value="1" class="weight-input w-full bg-gray-50 dark:bg-neutral-900/50 border border-gray-300 dark:border-neutral-700 rounded-xl pl-4 py-3 outline-none focus:border-indigo-500 dark:text-white font-medium text-center" placeholder="Peso"></div>`;
    c.appendChild(d); d.querySelectorAll('input').forEach(i => i.addEventListener('input', calculateAverage));
}
function calculateAverage() {
    let totS = 0, totW = 0, has = false; const passing = parseFloat(document.getElementById('passing-grade')?.value)||6.0;
    document.querySelectorAll('.grade-input').forEach((inp, i) => {
        const v = parseFloat(inp.value.replace(',', '.')), wInp = document.querySelectorAll('.weight-input')[i];
        if (!isNaN(v)) { let w = parseFloat(wInp.value.replace(',', '.')); if (isNaN(w)) w = 1; totS += v*w; totW += w; has = true; }
    });
    const disp = document.getElementById('result-display'), feed = document.getElementById('result-feedback');
    if (!has || totW === 0) { disp.innerText = "--"; disp.className = "text-6xl font-black text-gray-300 dark:text-gray-600 mb-6"; feed.innerHTML = '<p class="text-gray-400 text-sm italic">Adicione notas...</p>'; return; }
    const avg = totS / totW; disp.innerText = avg.toFixed(2);
    if (avg >= passing) { disp.className = "text-6xl font-black text-green-500 dark:text-green-400 mb-6 scale-110"; feed.innerHTML = `<img src="https://media.tenor.com/q9CixI3CcrkAAAAj/dance.gif" class="w-32 h-32 object-contain mb-4 drop-shadow-lg rounded-full"><p class="text-green-600 font-bold">Aprovado!</p>`; }
    else { disp.className = "text-6xl font-black text-red-500 dark:text-red-400 mb-6"; feed.innerHTML = `<img src="https://media.tenor.com/qL2ySe3uUgQAAAAj/gatto.gif" class="w-32 h-32 object-contain mb-4 drop-shadow-lg rounded-lg"><p class="text-red-600 font-bold">Reprovado...</p>`; }
}
function resetCalc() { const c=document.getElementById('grades-container'); if(c) c.innerHTML=''; addGradeRow(); addGradeRow(); calculateAverage(); }
addGradeRow(); addGradeRow(); document.getElementById('passing-grade')?.addEventListener('input', calculateAverage);

// ------------------------------------------------
// --- POMODORO ---
// ------------------------------------------------
let timerI, timeL = 25*60, isR = false, cMode = 'pomodoro';
const modes = { 'pomodoro': 25*60, 'short': 5*60, 'long': 15*60 };
function updTimer() {
    const m=Math.floor(timeL/60), s=timeL%60;
    document.getElementById('timer-display').innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    document.getElementById('timer-circle').style.strokeDashoffset = 816 - (timeL/modes[cMode])*816;
}
function toggleTimer() {
    const btn = document.getElementById('btn-start');
    if (isR) { clearInterval(timerI); isR=false; btn.innerHTML = '<i class="fas fa-play pl-1"></i>'; btn.classList.replace('bg-red-600','bg-indigo-600'); }
    else { isR=true; btn.innerHTML = '<i class="fas fa-pause"></i>'; btn.classList.replace('bg-indigo-600','bg-red-600'); timerI = setInterval(() => { timeL--; if(timeL<=0) { clearInterval(timerI); isR=false; showModal('Acabou!','Tempo esgotado.'); toggleTimer(); return; } updTimer(); }, 1000); }
}
function resetTimer() { if(isR) toggleTimer(); timeL = modes[cMode]; updTimer(); }
function setTimerMode(m) {
    ['pomodoro','short','long'].forEach(md => { const b=document.getElementById(`mode-${md}`); if(md===m) { b.classList.add('bg-white','dark:bg-neutral-700','text-gray-800','dark:text-white'); b.classList.remove('text-gray-500'); } else { b.classList.remove('bg-white','dark:bg-neutral-700','text-gray-800','dark:text-white'); b.classList.add('text-gray-500'); } });
    cMode=m; document.getElementById('timer-label').innerText = m==='pomodoro'?'Foco':m==='short'?'Curta':'Longa'; resetTimer();
}

// ------------------------------------------------
// --- UTILITÁRIOS ---
// ------------------------------------------------
const templates = { deadline: `Prezado(a) Prof(a). [Nome],\n\nSolicito extensão no prazo do trabalho [Nome].\n\nAtenciosamente,\n[Seu Nome]`, review: `Prezado(a) Prof(a). [Nome],\n\nGostaria de solicitar revisão da prova.\n\nAtenciosamente,\n[Seu Nome]`, absence: `Prezado(a) Prof(a). [Nome],\n\nJustifico falta no dia [Data].\n\nAtenciosamente,\n[Seu Nome]`, tcc: `Prezado(a) Prof(a). [Nome],\n\nTenho interesse em orientação de TCC.\n\nAtenciosamente,\n[Seu Nome]` };
function loadTemplate(k) { document.getElementById('email-content').value = templates[k]; }
function copyEmail() { document.getElementById('email-content').select(); document.execCommand('copy'); }
function openPortal() { window.open('https://sistemas.ufrb.edu.br/sigaa/verTelaLogin.do', '_blank'); }

function showModal(title, message) {
    const m = document.getElementById('generic-modal');
    document.getElementById('generic-modal-title').innerText = title;
    document.getElementById('generic-modal-message').innerText = message;
    
    // Push state para generic modal
    history.pushState({ modal: 'generic-modal' }, '', '#alert');
    
    m.classList.remove('hidden');
    setTimeout(() => { m.classList.remove('opacity-0'); m.firstElementChild.classList.remove('scale-95'); m.firstElementChild.classList.add('scale-100'); }, 10);
}
function closeGenericModal() {
    const m = document.getElementById('generic-modal');
    m.classList.add('opacity-0'); m.firstElementChild.classList.remove('scale-100'); m.firstElementChild.classList.add('scale-95');
    setTimeout(() => m.classList.add('hidden'), 300);
    if(history.state && history.state.modal === 'generic-modal') history.back();
}

// Inits
document.addEventListener('DOMContentLoaded', () => {
    renderTasks(); renderReminders(); if(window.renderSchedule) window.renderSchedule(); updateNextClassWidget(); setInterval(updateNextClassWidget, 60000);
});