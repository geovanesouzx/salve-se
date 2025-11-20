const CACHE_NAME = 'salvese-v6.0-hybrid'; // Atualize a versão se mudar o código
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

// 1. Instalação: Cacheia o básico imediatamente
self.addEventListener('install', event => {
    self.skipWaiting(); // Força ativação
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            // Tenta cachear tudo, mas não falha se uma imagem externa falhar (opcional)
            return Promise.all(
                URLS_TO_CACHE.map(url => {
                    return fetch(url, { mode: 'no-cors' }) // no-cors para CDNs externos
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
                        console.log('Deletando cache antigo:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// 3. Interceptação: ESTRATÉGIA HÍBRIDA (Stale-While-Revalidate para App Shell)
// Isso carrega o cache instantaneamente, mas busca atualização em segundo plano.
self.addEventListener('fetch', event => {
    // Ignora requisições para o Firebase/Firestore (deixe o SDK lidar com isso)
    if (event.request.url.includes('firestore.googleapis.com') || 
        event.request.url.includes('googleapis.com/auth') ||
        event.request.url.includes('firebase')) {
        return; 
    }

    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // Se tem cache, retorna ele
            const fetchPromise = fetch(event.request).then(networkResponse => {
                // E atualiza o cache em segundo plano para a próxima vez
                if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                     const responseToCache = networkResponse.clone();
                     caches.open(CACHE_NAME).then(cache => {
                         cache.put(event.request, responseToCache);
                     });
                }
                return networkResponse;
            }).catch(() => {
                // Se falhar a rede, tudo bem, já retornamos o cache se existir
            });

            return cachedResponse || fetchPromise;
        })
    );
});