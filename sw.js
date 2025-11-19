const CACHE_NAME = 'salvese-v2.0-network-first'; // Mudei a versão para forçar atualização
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

// 1. Instalação: Cacheia o básico imediatamente
self.addEventListener('install', event => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            return Promise.all(
                URLS_TO_CACHE.map(url => {
                    return fetch(url, { mode: 'no-cors' })
                        .then(response => {
                            if (response) return cache.put(url, response);
                        })
                        .catch(e => console.warn('Falha no pré-cache:', url));
                })
            );
        })
    );
});

// 2. Ativação: Limpa caches de versões antigas
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Interceptação: ESTRATÉGIA NETWORK FIRST (Rede Primeiro)
// Tenta pegar da internet. Se der certo, atualiza o cache e mostra.
// Se der errado (offline), pega do cache.
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                // Se a resposta da rede for válida, a gente clona e salva no cache atualizado
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Se deu erro na rede (está OFFLINE), tenta pegar do cache
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // Se não tem no cache e é navegação (ex: recarregar página), manda pro index
                    if (event.request.mode === 'navigate') {
                        return caches.match('./index.html');
                    }
                });
            })
    );
});