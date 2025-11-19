const CACHE_NAME = 'salvese-v6.0-complete';
const URLS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://files.catbox.moe/xvifnp.png',
    'https://media.tenor.com/q9CixI3CcrkAAAAj/dance.gif',
    'https://media.tenor.com/qL2ySe3uUgQAAAAj/gatto.gif'
];

// 1. Instalação: Cacheia o básico
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

// 2. Ativação: Limpa caches antigos
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

// 3. Interceptação: Network First (Prioriza conteúdo atualizado)
self.addEventListener('fetch', event => {
    event.respondWith(
        fetch(event.request)
            .then(networkResponse => {
                if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, responseToCache);
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                return caches.match(event.request).then(cachedResponse => {
                    if (cachedResponse) return cachedResponse;
                    if (event.request.mode === 'navigate') return caches.match('./index.html');
                });
            })
    );
});