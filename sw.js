const CACHE_NAME = 'salvese-v11.0-ai-tools'; // Versão incrementada para forçar update
const URLS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    'https://cdn.tailwindcss.com',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
    'https://files.catbox.moe/pmdtq6.png',
    'https://media.tenor.com/q9CixI3CcrkAAAAj/dance.gif',
    'https://media.tenor.com/qL2ySe3uUgQAAAAj/gatto.gif',
    'https://www.svgrepo.com/show/475656/google-color.svg'
];

// 1. Instalação
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

// 2. Ativação e Limpeza
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

// 3. Interceptação
self.addEventListener('fetch', event => {
    const url = event.request.url;
    
    // IMPORTANTE: Ignorar APIs dinâmicas para evitar cache de respostas JSON
    if (url.includes('firestore.googleapis.com') || 
        url.includes('googleapis.com/auth') || 
        url.includes('generativelanguage.googleapis.com') || // Permitir IA Gemini
        (url.includes('firebase') && !url.endsWith('.js')) ||
        url.includes('api.imgur.com')) { 
        return; 
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            const fetchPromise = fetch(event.request).then(networkResponse => {
                // Atualiza cache em background se tiver internet e for uma requisição válida
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                     const responseToCache = networkResponse.clone();
                     caches.open(CACHE_NAME).then(cache => {
                         cache.put(event.request, responseToCache);
                     });
                }
                return networkResponse;
            }).catch(() => {
                // Falha silenciosa se offline e não houver cache
            });

            return cachedResponse || fetchPromise;
        })
    );
});