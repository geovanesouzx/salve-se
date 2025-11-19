// ------------------------------------------------
// --- LÓGICA DE TEMA (INICIALIZAÇÃO) ---
// ------------------------------------------------
function initTheme() {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) { document.documentElement.classList.add('dark'); } else { document.documentElement.classList.remove('dark'); }
    const savedColor = localStorage.getItem('salvese_color');
    if(savedColor) updateColorVars(JSON.parse(savedColor));
}
initTheme();

function toggleTheme() {
    if (document.documentElement.classList.contains('dark')) { document.documentElement.classList.remove('dark'); localStorage.setItem('theme', 'light'); } else { document.documentElement.classList.add('dark'); localStorage.setItem('theme', 'dark'); }
}

// ------------------------------------------------
// --- LÓGICA PWA E OFFLINE (SERVICE WORKER BLOB) ---
// ------------------------------------------------

// 1. Criar Manifesto Dinamicamente
const manifest = {
    "name": "Salve-se Painel",
    "short_name": "Salve-se",
    "start_url": ".",
    "display": "standalone",
    "background_color": "#09090b",
    "theme_color": "#4f46e5",
    "icons": [
        { "src": "https://files.catbox.moe/xvifnp.png", "sizes": "192x192", "type": "image/png" },
        { "src": "https://files.catbox.moe/xvifnp.png", "sizes": "512x512", "type": "image/png" }
    ]
};
const stringManifest = JSON.stringify(manifest);
const blobManifest = new Blob([stringManifest], {type: 'application/json'});
const manifestURL = URL.createObjectURL(blobManifest);
document.querySelector('#pwa-manifest').setAttribute('href', manifestURL);

// 2. Service Worker embutido (Blob)
if ('serviceWorker' in navigator) {
    const swCode = `
        const CACHE_NAME = 'salvese-v1-offline';
        const URLS_TO_CACHE = [
            'https://cdn.tailwindcss.com',
            'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
            'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
            'https://files.catbox.moe/xvifnp.png'
        ];

        self.addEventListener('install', event => {
            self.skipWaiting();
            event.waitUntil(
                caches.open(CACHE_NAME).then(cache => {
                    return Promise.all(
                        URLS_TO_CACHE.map(url => {
                            return fetch(url, {mode: 'no-cors'}).then(response => {
                                if(response) return cache.put(url, response);
                            }).catch(e => console.log('Falha ao cachear: ' + url));
                        })
                    );
                })
            );
        });

        self.addEventListener('activate', event => {
            event.waitUntil(self.clients.claim());
        });

        self.addEventListener('fetch', event => {
            if (event.request.mode === 'navigate') {
                event.respondWith(
                    fetch(event.request).catch(() => {
                        return caches.match(event.request);
                    })
                );
                return;
            }
            event.respondWith(
                caches.match(event.request).then(response => {
                    if (response) return response;
                    return fetch(event.request).then(networkResponse => {
                        return networkResponse;
                    });
                })
            );
        });
    `;
    
    const blobSW = new Blob([swCode], {type: 'application/javascript'});
    const swURL = URL.createObjectURL(blobSW);

    window.addEventListener('load', () => {
        navigator.serviceWorker.register(swURL)
            .then(reg => console.log('SW registrado!', reg))
            .catch(err => console.log('SW falhou:', err));
    });

    // Lógica do botão instalar e Status de Rede
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtn = document.getElementById('btn-install-pwa');
        installBtn.classList.remove('hidden');
        
        installBtn.addEventListener('click', () => {
            deferredPrompt.prompt();
            deferredPrompt.userChoice.then((choiceResult) => {
                if (choiceResult.outcome === 'accepted') {
                    console.log('Usuário aceitou instalar');
                }
                deferredPrompt = null;
                installBtn.classList.add('hidden');
            });
        });
    });

    function updateNetworkStatus() {
        const toast = document.getElementById('network-toast');
        const text = document.getElementById('network-text');
        const icon = toast.querySelector('i');
        
        if(navigator.onLine) {
            toast.className = 'network-status online show';
            text.innerText = 'Online';
            icon.className = 'fas fa-wifi';
            setTimeout(() => toast.classList.remove('show'), 3000);
        } else {
            toast.className = 'network-status offline show';
            text.innerText = 'Offline';
            icon.className = 'fas fa-wifi-slash';
        }
    }

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
}

// --- LOCAL STORAGE DATA HANDLING ---
let scheduleData = JSON.parse(localStorage.getItem('salvese_schedule')) || [];
let tasksData = JSON.parse(localStorage.getItem('salvese_tasks')) || [];
let remindersData = JSON.parse(localStorage.getItem('salvese_reminders')) || [];
let selectedClassIdToDelete = null;

function saveData() {
    localStorage.setItem('salvese_schedule', JSON.stringify(scheduleData));
    localStorage.setItem('salvese_tasks', JSON.stringify(tasksData));
    localStorage.setItem('salvese_reminders', JSON.stringify(remindersData));
    
    if(window.renderSchedule) window.renderSchedule();
    if(window.renderTasks) window.renderTasks();
    if(window.renderReminders) window.renderReminders();
    updateDashCounts();
    
    // Atualiza widget de próxima aula ao salvar
    if(window.updateNextClassWidget) window.updateNextClassWidget();
}

function updateDashCounts() {
    const pending = tasksData.filter(t => !t.done).length;
    document.getElementById('task-count').innerText = `${pending} pendentes`;
    document.getElementById('dash-task-count').innerText = pending;
}

// --- REMINDERS LOGIC ---
function toggleRemindersModal() {
    const modal = document.getElementById('reminders-modal');
    const content = modal.firstElementChild;
    if (modal.classList.contains('hidden')) {
        renderReminders();
        modal.classList.remove('hidden');
        setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); content.classList.add('scale-100'); }, 10);
    } else {
        modal.classList.add('opacity-0'); content.classList.remove('scale-100'); content.classList.add('scale-95');
        setTimeout(() => modal.classList.add('hidden'), 300);
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

    remindersData.push({
        id: Date.now().toString(),
        desc, date, prio,
        createdAt: Date.now()
    });

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

    if (sorted.length > 0) badge.classList.remove('hidden'); else badge.classList.add('hidden');

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
                        <span class="text-xs font-bold uppercase text-gray-500 leading-none">${dateObj.toLocaleDateString('pt-BR', {month:'short'}).replace('.','')}</span>
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

    if (sorted.length === 0) {
        listModal.innerHTML = `
            <div class="flex flex-col items-center justify-center h-32 text-gray-400 dark:text-gray-600">
                <i class="fas fa-exclamation-circle text-3xl mb-2 opacity-20"></i>
                <p class="text-sm">Nenhum lembrete. <br>Use o botão acima para adicionar.</p>
            </div>`;
    } else {
        listModal.innerHTML = sorted.map(r => generateHTML(r, false)).join('');
    }

    if (sorted.length === 0) {
        listHome.innerHTML = `
            <div class="flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-gray-100 dark:border-neutral-800 rounded-lg h-full">
                <p class="text-gray-400 dark:text-gray-500 font-medium">Nenhum lembrete de alta prioridade.</p>
            </div>`;
    } else {
        listHome.innerHTML = sorted.slice(0, 3).map(r => generateHTML(r, true)).join('');
    }
}

// --- TASK FUNCTIONS ---
window.addTask = function() {
    const input = document.getElementById('todo-input');
    const text = input.value.trim();
    if (!text) return;
    
    tasksData.push({
        id: Date.now().toString(),
        text: text,
        done: false,
        createdAt: Date.now()
    });
    input.value = '';
    saveData();
};

window.toggleTask = function(taskId) {
    const task = tasksData.find(t => t.id === taskId);
    if (task) {
        task.done = !task.done;
        saveData();
    }
};

window.deleteTask = function(taskId) {
    tasksData = tasksData.filter(t => t.id !== taskId);
    saveData();
};

window.clearCompleted = function() {
    tasksData = tasksData.filter(t => !t.done);
    saveData();
};

window.renderTasks = function() {
    const list = document.getElementById('todo-list');
    list.innerHTML = '';
    const sortedTasks = [...tasksData].sort((a, b) => b.createdAt - a.createdAt);
    
    sortedTasks.forEach(t => {
        const div = document.createElement('div');
        div.className = `flex items-center gap-3 p-3 rounded-lg border transition ${t.done ? 'bg-gray-50 dark:bg-neutral-900/50 border-gray-200 dark:border-darkborder' : 'bg-white dark:bg-darkcard border-gray-200 dark:border-darkborder'}`;
        div.innerHTML = `
            <button onclick="toggleTask('${t.id}')" class="w-5 h-5 rounded border flex items-center justify-center transition ${t.done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-400 hover:border-emerald-500'}">
                ${t.done ? '<i class="fas fa-check text-xs"></i>' : ''}
            </button>
            <span class="flex-1 text-sm ${t.done ? 'text-gray-400 line-through' : 'text-gray-700 dark:text-gray-200'}">${t.text}</span>
            <button onclick="deleteTask('${t.id}')" class="text-gray-400 hover:text-red-500 transition">
                <i class="fas fa-times"></i>
            </button>
        `;
        list.appendChild(div);
    });
    updateDashCounts();
}

// --- SCHEDULE FUNCTIONS ---
window.saveClass = function() {
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
        if (index !== -1) {
            scheduleData[index] = classData;
        }
    } else {
        scheduleData.push(classData);
    }
    
    saveData();
    toggleModal(false);
};

window.confirmDeleteClass = function() {
    const id = document.getElementById('class-id').value;
    if(!id) return;
    selectedClassIdToDelete = id;
    document.getElementById('class-modal').classList.add('opacity-0');
    setTimeout(() => document.getElementById('class-modal').classList.add('hidden'), 300);
    const confirmModal = document.getElementById('delete-confirmation-modal');
    confirmModal.classList.remove('hidden');
    setTimeout(() => { confirmModal.classList.remove('opacity-0'); confirmModal.firstElementChild.classList.remove('scale-95'); confirmModal.firstElementChild.classList.add('scale-100'); }, 10);
};

window.closeDeleteConfirmation = function() {
    selectedClassIdToDelete = null;
    const confirmModal = document.getElementById('delete-confirmation-modal');
    confirmModal.classList.add('opacity-0'); confirmModal.firstElementChild.classList.remove('scale-100'); confirmModal.firstElementChild.classList.add('scale-95');
    setTimeout(() => confirmModal.classList.add('hidden'), 300);
};

window.performDeleteClass = function() {
    if (!selectedClassIdToDelete) return;
    scheduleData = scheduleData.filter(c => c.id !== selectedClassIdToDelete);
    saveData();
    closeDeleteConfirmation();
};

window.getScheduleData = () => scheduleData;

function updateNextClassWidget() {
    const container = document.getElementById('next-class-content');
    if (!container) return;

    const now = new Date();
    const daysMap = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
    const currentDay = daysMap[now.getDay()];
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

document.addEventListener('DOMContentLoaded', () => {
    renderTasks();
    renderReminders();
    if(window.renderSchedule) window.renderSchedule();
    updateNextClassWidget();
    setInterval(updateNextClassWidget, 60000);
});

function showModal(title, message) {
    document.getElementById('generic-modal-title').innerText = title;
    document.getElementById('generic-modal-message').innerText = message;
    const m = document.getElementById('generic-modal'); m.classList.remove('hidden');
    setTimeout(() => { m.classList.remove('opacity-0'); m.firstElementChild.classList.remove('scale-95'); m.firstElementChild.classList.add('scale-100'); }, 10);
}
function closeGenericModal() {
    const m = document.getElementById('generic-modal'); m.classList.add('opacity-0'); m.firstElementChild.classList.remove('scale-100'); m.firstElementChild.classList.add('scale-95');
    setTimeout(() => m.classList.add('hidden'), 300);
}

// ... Cores e outras funções auxiliares ...
const colorPalettes = {
    cyan: { 50:'236 254 255', 100:'207 250 254', 200:'165 243 252', 300:'103 232 249', 400:'34 211 238', 500:'6 182 212', 600:'8 145 178', 700:'14 116 144', 800:'21 94 117', 900:'22 78 99' },
    red: { 50:'254 242 242', 100:'254 226 226', 200:'254 202 202', 300:'252 165 165', 400:'248 113 113', 500:'239 68 68', 600:'220 38 38', 700:'185 28 28', 800:'153 27 27', 900:'127 29 29' },
    green: { 50:'240 253 244', 100:'220 252 231', 200:'187 247 208', 300:'134 239 172', 400:'74 222 128', 500:'34 197 94', 600:'22 163 74', 700:'21 128 61', 800:'22 101 52', 900:'20 83 45' },
    yellow: { 50:'254 252 232', 100:'254 249 195', 200:'254 240 138', 300:'253 224 71', 400:'250 204 21', 500:'234 179 8', 600:'202 138 4', 700:'161 98 7', 800:'133 77 14', 900:'113 63 18' },
    purple: { 50:'250 245 255', 100:'243 232 255', 200:'233 213 255', 300:'216 180 254', 400:'192 132 252', 500:'168 85 247', 600:'147 51 234', 700:'126 34 206', 800:'107 33 168', 900:'88 28 135' },
    pink: { 50:'253 242 248', 100:'252 231 243', 200:'251 204 231', 300:'249 168 212', 400:'244 114 182', 500:'236 72 153', 600:'219 39 119', 700:'190 24 93', 800:'157 23 77', 900:'131 24 67' },
    orange: { 50:'255 247 237', 100:'255 237 213', 200:'254 215 170', 300:'253 186 116', 400:'251 146 60', 500:'249 115 22', 600:'234 88 12', 700:'194 65 12', 800:'154 52 18', 900:'124 45 18' },
    indigo: { 50:'238 242 255', 100:'224 231 255', 200:'199 210 254', 300:'165 180 252', 400:'129 140 248', 500:'99 102 241', 600:'79 70 229', 700:'67 56 202', 800:'55 48 163', 900:'49 46 129' },
    teal: { 50:'240 253 250', 100:'204 251 241', 200:'153 246 228', 300:'94 234 212', 400:'45 212 191', 500:'20 184 166', 600:'13 148 136', 700:'15 118 110', 800:'17 94 89', 900:'19 78 74' }
};

function toggleColorMenu(device) {
    const menu = document.getElementById(`color-menu-${device}`);
    const isHidden = menu.classList.contains('hidden');
    document.querySelectorAll('.color-menu').forEach(m => m.classList.add('hidden'));
    if(isHidden) {
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

function setThemeColor(colorName) {
    const palette = colorPalettes[colorName];
    if(!palette) return;
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
    if(!e.target.closest('button[onclick^="toggleColorMenu"]') && !e.target.closest('.color-menu')) {
        document.querySelectorAll('.color-menu').forEach(m => m.classList.add('hidden'));
    }
});

function switchPage(pageId) {
    document.querySelectorAll('[id^="view-"]').forEach(el => el.classList.add('hidden'));
    document.getElementById(`view-${pageId}`).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    const activeLink = document.getElementById(`nav-${pageId}`);
    if(activeLink) activeLink.classList.add('active');
    const titles = { home: 'Página Principal', onibus: 'Transporte', calc: 'Calculadora', pomo: 'Modo Foco', todo: 'Tarefas', email: 'Templates', aulas: 'Grade Horária' };
    document.getElementById('page-title').innerText = titles[pageId] || 'Salve-se';
}

let clockMode = 0; 
function cycleClockMode() { clockMode = (clockMode + 1) % 4; updateClock(); }
function updateClock() { 
    const now = new Date();
    let timeString = "";
    if (clockMode === 0) timeString = now.toLocaleTimeString('pt-BR'); 
    else if (clockMode === 1) timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
    else if (clockMode === 2) timeString = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    else {
        const date = now.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
        const time = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        timeString = `${date} • ${time}`;
    }
    document.getElementById('clock').innerText = timeString; 
}
setInterval(updateClock, 1000); updateClock();

const days = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const timeSlots = [
    { label: "07:00-08:00", start: "07:00" }, { label: "08:00-09:00", start: "08:00" }, { label: "09:00-10:00", start: "09:00" },
    { label: "10:00-11:00", start: "10:00" }, { label: "11:00-12:00", start: "11:00" }, { label: "12:00-13:00", start: "12:00" },
    { label: "13:00-14:00", start: "13:00" }, { label: "14:00-15:00", start: "14:00" }, { label: "15:00-16:00", start: "15:00" },
    { label: "16:00-17:00", start: "16:00" }, { label: "17:00-18:00", start: "17:00" }, { label: "18:30-19:30", start: "18:30" },
    { label: "19:30-20:30", start: "19:30" }, { label: "20:30-21:30", start: "20:30" }, { label: "21:30-22:30", start: "21:30" } 
];

window.selectedColor = 'cyan'; 
window.renderSchedule = function() {
    const tbody = document.getElementById('schedule-body');
    const data = window.getScheduleData ? window.getScheduleData() : [];
    tbody.innerHTML = '';

    const occupied = {}; 

    timeSlots.forEach((slot, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `<td class="w-32 py-3 px-4 font-medium bg-gray-50 dark:bg-darkcard text-gray-500 dark:text-gray-400 text-left sticky left-0 z-10 text-xs">${slot.label}</td>`;
        
        days.forEach(day => {
            const cellKey = `${day}-${index}`;
            if (occupied[cellKey]) return;

            const foundClass = data.find(c => c.day === day && c.start === slot.start);
            const cell = document.createElement('td');
            cell.className = "schedule-cell cursor-pointer relative group";

            if (foundClass) {
                const startIndex = index;
                let endIndex = timeSlots.findIndex(s => s.start === foundClass.end);
                if (endIndex === -1) { 
                     if (foundClass.end === "22:30") endIndex = timeSlots.length;
                     else endIndex = startIndex + 1; 
                }
                const span = Math.max(1, endIndex - startIndex);
                for (let i = 1; i < span; i++) occupied[`${day}-${startIndex + i}`] = true;

                cell.rowSpan = span;
                const rgb = colorPalettes[foundClass.color] ? colorPalettes[foundClass.color][500] : '99, 102, 241';
                const lighterBg = colorPalettes[foundClass.color] ? `rgb(${colorPalettes[foundClass.color][100]})` : '#EEF2FF';
                const darkBg = colorPalettes[foundClass.color] ? `rgba(${colorPalettes[foundClass.color][500]}, 0.15)` : 'rgba(99, 102, 241, 0.2)';
                const borderColor = `rgb(${rgb})`;
                
                cell.innerHTML = `
                    <div onclick="openEditClassModal('${foundClass.id}')" 
                         class="w-full h-full rounded-r-md p-2 text-left border-l-4 shadow-sm animate-scale-in relative hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-center" 
                         style="background-color: var(--cell-bg); border-left-color: ${borderColor};">
                        <style>
                            .light .schedule-cell div { --cell-bg: ${lighterBg}; }
                            .dark .schedule-cell div { --cell-bg: ${darkBg}; }
                        </style>
                        <p class="text-[11px] font-bold truncate leading-tight mb-1" style="color: ${borderColor}">${foundClass.name}</p>
                        <p class="text-[10px] text-gray-600 dark:text-gray-300 truncate opacity-90 leading-tight">${foundClass.prof}</p>
                        <p class="text-[9px] text-gray-500 dark:text-gray-400 truncate opacity-70 leading-tight mt-0.5">${foundClass.room}</p>
                    </div>`;
            } else {
                cell.innerHTML = `<div onclick="openAddClassModal('${day}', '${slot.start}')" class="add-btn-minimal"><i class="fas fa-plus"></i></div>`;
            }
            row.appendChild(cell);
        });
        tbody.appendChild(row);
    });
}

window.openAddClassModal = function(day, startHourStr) {
    resetModalFields();
    document.getElementById('modal-title').innerText = "Adicionar Aula";
    document.getElementById('btn-delete-class').classList.add('hidden');
    if(day) document.getElementById('class-day').value = day;
    if(startHourStr) {
        document.getElementById('class-start').value = startHourStr;
        updateEndTime(2);
    }
    toggleModal(true);
}

window.openEditClassModal = function(id) {
    resetModalFields();
    const data = window.getScheduleData();
    const classItem = data.find(c => c.id === id);
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

function resetModalFields() {
    document.getElementById('class-id').value = ''; document.getElementById('class-name').value = ''; document.getElementById('class-prof').value = '';
    document.getElementById('class-room').value = ''; document.getElementById('class-day').value = 'seg'; window.selectedColor = 'cyan';
    const startSel = document.getElementById('class-start'); const endSel = document.getElementById('class-end');
    startSel.innerHTML = ''; endSel.innerHTML = '';
    const allTimes = timeSlots.map(s => s.start); allTimes.push("22:30"); 
    allTimes.forEach(t => { const opt = `<option value="${t}">${t}</option>`; startSel.innerHTML += opt; endSel.innerHTML += opt; });
    startSel.value = "07:00"; endSel.value = "09:00"; renderColorPicker();
}

function updateEndTime(defaultOffset = 2) {
     const startSel = document.getElementById('class-start');
     const endSel = document.getElementById('class-end');
     const startHourStr = startSel.value;
     const idx = timeSlots.findIndex(s => s.start === startHourStr);
     
     if(idx !== -1) {
         let targetIdx = idx + defaultOffset;
         if (targetIdx > timeSlots.length) targetIdx = timeSlots.length; 
         if (targetIdx < timeSlots.length) { endSel.value = timeSlots[targetIdx].start; } else { endSel.value = "22:30"; }
     }
}

function setEndTimeBasedOnStart(startHourStr) { updateEndTime(2); }

function renderColorPicker() {
    const container = document.getElementById('color-picker-container'); container.innerHTML = '';
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

function toggleModal(show) {
    const modal = document.getElementById('class-modal'); const content = document.getElementById('class-modal-content');
    if(show) { modal.classList.remove('hidden'); setTimeout(() => { modal.classList.remove('opacity-0'); content.classList.remove('scale-95'); content.classList.add('scale-100'); }, 10); } 
    else { modal.classList.add('opacity-0'); content.classList.remove('scale-100'); content.classList.add('scale-95'); setTimeout(() => modal.classList.add('hidden'), 300); }
}

function addTime(baseTime, minutesToAdd) { const [h, m] = baseTime.split(':').map(Number); const date = new Date(); date.setHours(h); date.setMinutes(m + minutesToAdd); return date.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}); }
function createTrip(startTime, endTime, routeType, speed = 'normal') {
    let stops = []; const factor = speed === 'fast' ? 0.7 : 1.0; 
    if (routeType === 'saida-garagem') { stops = [{loc:'Garagem (Saída)', t:0}, {loc:'RU/Resid.', t:Math.round(2 * factor)}, {loc:'Fitotecnia', t:Math.round(4 * factor)}, {loc:'Prédio Solos', t:Math.round(6 * factor)}, {loc:'Pav. Aulas I', t:Math.round(8 * factor)}, {loc:'Biblioteca', t:Math.round(10 * factor)}, {loc:'Pav. Aulas II', t:Math.round(12 * factor)}, {loc:'Pav. Engenharia', t:Math.round(13 * factor)}, {loc:'Portão II', t:Math.round(15 * factor)}, {loc:'Ponto Ext. I', t:Math.round(16 * factor)}, {loc:'Ponto Ext. II', t:Math.round(17 * factor)}, {loc:'Portão I', t:Math.round(18 * factor)}, {loc:'Biblioteca', t:Math.round(20 * factor)}, {loc:'Torre/COTEC', t:Math.round(22 * factor)}, {loc:'RU (Chegada)', t:Math.round(24 * factor)}]; } 
    else if (routeType === 'volta-campus') { stops = [{loc:'RU/Resid. (Início)', t:0}, {loc:'Fitotecnia', t:Math.round(2 * factor)}, {loc:'Prédio Solos', t:Math.round(4 * factor)}, {loc:'Pav. Aulas I', t:Math.round(6 * factor)}, {loc:'Biblioteca', t:Math.round(8 * factor)}, {loc:'Pav. Aulas II', t:Math.round(10 * factor)}, {loc:'Pav. Engenharia', t:Math.round(11 * factor)}, {loc:'Portão II', t:Math.round(13 * factor)}, {loc:'Ponto Ext. I', t:Math.round(14 * factor)}, {loc:'Ponto Ext. II', t:Math.round(15 * factor)}, {loc:'Portão I', t:Math.round(16 * factor)}, {loc:'Biblioteca', t:Math.round(18 * factor)}, {loc:'Torre/COTEC', t:Math.round(20 * factor)}, {loc:'RU (Fim)', t:Math.round(22 * factor)}]; } 
    else if (routeType === 'recolhe') { stops = [{loc:'RU/Resid.', t:0}, {loc:'Fitotecnia', t:2}, {loc:'Prédio Solos', t:4}, {loc:'Eng. Florestal', t:6}, {loc:'Garagem (Chegada)', t:Math.round(15 * factor)}]; } 
    else if (routeType === 'volta-e-recolhe') { stops = [{loc:'RU/Resid. (Início)', t:0}, {loc:'Fitotecnia', t:2}, {loc:'Prédio Solos', t:3}, {loc:'Pav. Aulas I', t:5}, {loc:'Biblioteca', t:6}, {loc:'Pav. Aulas II', t:8}, {loc:'Pav. Engenharia', t:9}, {loc:'Portão II', t:10}, {loc:'Ponto Ext. I', t:11}, {loc:'Ponto Ext. II', t:12}, {loc:'Portão I', t:13}, {loc:'Biblioteca', t:14}, {loc:'Torre/COTEC', t:16}, {loc:'RU (Fim Volta)', t:18}, {loc:'Fitotecnia', t:20}, {loc:'Prédio Solos', t:21}, {loc:'Eng. Florestal', t:23}, {loc:'Garagem (Chegada)', t:25}]; }
    return { start: startTime, end: endTime, origin: stops[0].loc, dest: stops[stops.length-1].loc, stops: stops.map(s => { if((routeType === 'recolhe' || routeType === 'volta-e-recolhe') && s.loc.includes('Garagem')) return { loc: s.loc, time: endTime }; return { loc: s.loc, time: addTime(startTime, s.t) }; }) };
}
const busSchedule = [
    createTrip('06:25', '06:50', 'saida-garagem'), createTrip('06:50', '07:10', 'volta-campus', 'fast'), createTrip('07:10', '07:25', 'volta-campus', 'fast'), createTrip('07:25', '07:40', 'volta-campus', 'fast'), createTrip('07:40', '07:55', 'volta-campus', 'fast'), createTrip('07:55', '08:20', 'volta-e-recolhe'),
    createTrip('09:35', '10:00', 'saida-garagem'), createTrip('10:00', '10:25', 'volta-e-recolhe'), createTrip('11:30', '11:55', 'saida-garagem'), createTrip('11:55', '12:20', 'volta-campus'), createTrip('12:20', '12:45', 'volta-e-recolhe'),
    createTrip('13:00', '13:25', 'saida-garagem'), createTrip('13:25', '13:45', 'volta-campus'), createTrip('13:45', '14:00', 'volta-campus'), createTrip('14:00', '14:25', 'volta-e-recolhe'),
    createTrip('15:35', '16:00', 'saida-garagem'), createTrip('16:00', '16:25', 'volta-e-recolhe'), createTrip('17:30', '17:55', 'saida-garagem'), createTrip('17:55', '18:15', 'volta-campus'), createTrip('18:15', '18:40', 'volta-e-recolhe'),
    createTrip('20:40', '21:00', 'volta-e-recolhe', 'fast'), createTrip('21:40', '22:00', 'volta-e-recolhe', 'fast'), createTrip('22:30', '22:50', 'volta-e-recolhe', 'fast')
];
function renderBusTable() {
    const tbody = document.getElementById('bus-table-body'); tbody.innerHTML = '';
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
    if (activeBus) {
        statusDot.className = "w-2 h-2 rounded-full bg-green-500 animate-pulse"; statusText.innerText = "Em Trânsito"; statusText.className = "text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wider";
        title.innerText = activeBus.end; subtitle.innerText = `Destino: ${activeBus.dest}`;
        let timelineHtml = '<div class="relative pl-3 border-l-2 border-gray-200 dark:border-neutral-800 space-y-4 ml-1">';
        const upcomingStops = activeBus.stops.filter(s => { const [sh, sm] = s.time.split(':').map(Number); const stopSeconds = sh * 3600 + sm * 60; return stopSeconds >= (currentTotalSeconds - 60); }).slice(0, 3);
        if(upcomingStops.length === 0) timelineHtml += '<p class="text-xs text-gray-500 pl-2">Chegando ao destino...</p>';
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
        let timeString = ""; if(hours > 0) timeString += `${hours}h `; timeString += `${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
        let badgeClass = timeDiff <= 900 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 animate-pulse" : "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300";
        container.innerHTML = `<div class="flex items-center h-full"><div class="w-full py-3 rounded-lg text-center font-bold text-sm ${badgeClass}">Saída em ${timeString}</div></div>`;
    } else {
        statusDot.className = "w-2 h-2 rounded-full bg-gray-400"; statusText.innerText = "Encerrado"; title.innerText = "Fim"; subtitle.innerText = "Sem mais viagens hoje"; container.innerHTML = `<div class="w-full py-3 rounded-lg bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-gray-400 text-center text-sm font-medium mt-auto">Volta amanhã</div>`;
    }
}
renderBusTable(); updateNextBus(); setInterval(updateNextBus, 1000);

function addGradeRow() {
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
    document.getElementById('grades-container').appendChild(div);
    div.querySelectorAll('input').forEach(i => i.addEventListener('input', calculateAverage));
}

function parseLocalFloat(val) {
    if (!val) return NaN;
    return parseFloat(val.replace(',', '.'));
}

function calculateAverage() {
    let totalScore = 0, totalWeight = 0, hasInput = false;
    const passing = parseFloat(document.getElementById('passing-grade').value) || 6.0;
    
    document.querySelectorAll('.grade-input').forEach((inp, i) => {
        const val = parseLocalFloat(inp.value);
        let wStr = document.querySelectorAll('.weight-input')[i].value;
        let w = parseLocalFloat(wStr);
        
        if (isNaN(w) && !isNaN(val)) w = 1;
        
        if(!isNaN(val) && !isNaN(w)) { 
            hasInput = true; 
            totalScore += val * w; 
            totalWeight += w; 
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

    if(avg >= passing) {
        display.className = "text-6xl font-black text-green-500 dark:text-green-400 mb-6 transition-all duration-500 scale-110";
        feedback.innerHTML = `
            <div class="flex flex-col items-center animate-scale-in">
                <img src="https://media.tenor.com/IVh7YxGaB_4AAAAM/nerd-emoji.gif" class="w-32 h-32 object-contain mb-4 drop-shadow-lg rounded-full">
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

function resetCalc() { 
    document.getElementById('grades-container').innerHTML=''; 
    addGradeRow(); addGradeRow(); 
    calculateAverage(); 
}

addGradeRow(); addGradeRow();
document.getElementById('passing-grade').addEventListener('input', calculateAverage);

let timerInterval1, timeLeft1 = 25*60, isRunning1=false, currentMode1='pomodoro';
const modes1 = { 'pomodoro': 25*60, 'short': 5*60, 'long': 15*60 };
function updateTimerDisplay() {
    const m=Math.floor(timeLeft1/60), s=timeLeft1%60;
    document.getElementById('timer-display').innerText = `${m.toString().padStart(2,'0')}:${s.toString().padStart(2,'0')}`;
    document.getElementById('timer-circle').style.strokeDashoffset = 816 - (timeLeft1 / modes1[currentMode1]) * 816;
}
function toggleTimer() {
    const btn = document.getElementById('btn-start');
    if(isRunning1) { clearInterval(timerInterval1); isRunning1=false; btn.innerHTML='<i class="fas fa-play pl-1"></i>'; btn.classList.replace('bg-red-600','bg-indigo-600'); btn.classList.replace('hover:bg-red-700','hover:bg-indigo-700');}
    else { isRunning1=true; btn.innerHTML='<i class="fas fa-pause"></i>'; btn.classList.replace('bg-indigo-600','bg-red-600'); btn.classList.replace('hover:bg-indigo-700','hover:bg-red-700');
        timerInterval1 = setInterval(() => { timeLeft1--; if(timeLeft1<=0) { clearInterval(timerInterval1); isRunning1=false; showModal('Tempo', 'O tempo acabou!'); toggleTimer(); return;} updateTimerDisplay(); }, 1000);
    }
}
function resetTimer() { if(isRunning1) toggleTimer(); timeLeft1=modes1[currentMode1]; updateTimerDisplay(); }
function setTimerMode(m) {
    ['pomodoro','short','long'].forEach(mode => { const btn = document.getElementById(`mode-${mode}`);
        if(mode===m) { btn.classList.add('bg-white','dark:bg-neutral-700','text-gray-800','dark:text-white','shadow-sm'); btn.classList.remove('text-gray-500','dark:text-gray-400'); }
        else { btn.classList.remove('bg-white','dark:bg-neutral-700','text-gray-800','dark:text-white','shadow-sm'); btn.classList.add('text-gray-500','dark:text-gray-400'); }
    }); currentMode1=m; document.getElementById('timer-label').innerText = m==='pomodoro'?'Foco':(m==='short'?'Curta':'Longa'); resetTimer();
}

const templates = {
    deadline: `Prezado(a) Prof(a). [Nome],\n\nSolicito respeitosamente uma extensão no prazo do trabalho [Nome], originalmente para [Data]. Tive um imprevisto [Motivo] e preciso de mais tempo para entregar com qualidade.\n\nAtenciosamente,\n[Seu Nome]`,
    review: `Prezado(a) Prof(a). [Nome],\n\nGostaria de solicitar a revisão da minha prova de [Matéria]. Fiquei com dúvida na questão [X].\n\nAtenciosamente,\n[Seu Nome]`,
    absence: `Prezado(a) Prof(a). [Nome],\n\nJustifico minha falta no dia [Data] devido a [Motivo]. Segue anexo (se houver).\n\nAtenciosamente,\n[Seu Nome]`,
    tcc: `Prezado(a) Prof(a). [Nome],\n\nTenho interesse em sua área de pesquisa e gostaria de saber se há disponibilidade para orientação de TCC sobre [Tema].\n\nAtenciosamente,\n[Seu Nome]`
};
function loadTemplate(k) { document.getElementById('email-content').value=templates[k]; }
function copyEmail() { const e=document.getElementById('email-content'); e.select(); document.execCommand('copy'); }