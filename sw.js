const CACHE_NAME = 'salvese-v1.3-offline'; // Atualize esta versão sempre que mudar o código
const URLS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://files.catbox.moe/xvifnp.png',
    'https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.min.js',
    'https://media.tenor.com/q9CixI3CcrkAAAAj/dance.gif',
    'https://media.tenor.com/IVh7YxGaB_4AAAAM/nerd-emoji.gif',
    'https://media.tenor.com/qL2ySe3uUgQAAAAj/gatto.gif'
];

// Instalação: Cacheia os arquivos estáticos
self.addEventListener('install', event => {
    self.skipWaiting(); // Força o SW a ativar imediatamente
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Abrindo cache e adicionando arquivos...');
            return Promise.all(
                URLS_TO_CACHE.map(url => {
                    return fetch(url, { mode: 'no-cors' })
                        .then(response => {
                            if (response) return cache.put(url, response);
                        })
                        .catch(e => console.warn('Falha ao cachear recurso externo:', url));
                })
            );
        })
    );
});

// Ativação: Limpa caches antigos
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log('Deletando cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim()) // Assume o controle das páginas imediatamente
    );
});

// Interceptação: Serve do cache, cai para rede se não tiver
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            // Cache hit - retorna a resposta do cache
            if (response) {
                return response;
            }
            
            // Clone a requisição
            const fetchRequest = event.request.clone();

            return fetch(fetchRequest).catch(() => {
                // Se falhar (offline) e não estiver no cache:
                // Se for uma navegação (ex: reload na página), retorna o index.html
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});