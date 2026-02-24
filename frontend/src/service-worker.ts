/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />
/// <reference types="@sveltejs/kit" />

// This service worker uses a Network-Only strategy (no caching)
// Perfect for online-only PWA that always needs fresh data

// Version - increment this to force SW update
// Version - increment this to force SW update
// Version - increment this to force SW update
// Version - increment this to force SW update
// Version - increment this to force SW update
const VERSION = '1.0.5';

const sw = self as unknown as ServiceWorkerGlobalScope;

// Listen for install event
sw.addEventListener('install', (event) => {
    console.log(`[ServiceWorker] Installing v${VERSION}...`);
    // Skip waiting to activate immediately
    event.waitUntil(sw.skipWaiting());
});

// Listen for activate event
sw.addEventListener('activate', (event) => {
    console.log(`[ServiceWorker] Activating v${VERSION}...`);

    // Clean up any old caches explicitly just in case
    event.waitUntil(
        caches
            .keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        console.log('[ServiceWorker] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    })
                );
            })
            .then(() => {
                // Take control of all clients immediately
                return sw.clients.claim();
            })
    );
});

// Listen for fetch event - Network-Only strategy
sw.addEventListener('fetch', (event) => {
    // Let the browser do its default thing for non-GET requests.
    if (event.request.method !== 'GET') return;

    // Network-Only: Always fetch from network, never cache
    event.respondWith(
        fetch(event.request)
            .then((response) => response)
            .catch(async (error) => {
                console.error('[ServiceWorker] Fetch failed:', error);

                // For navigation requests (HTML pages), show offline page
                if (event.request.mode === 'navigate') {
                    try {
                        const offlinePage = await fetch('/offline.html');
                        return offlinePage;
                    } catch {
                        return new Response(
                            `<!DOCTYPE html>
<html lang="th">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ไม่มีการเชื่อมต่อ - Trackivity</title>
    <link href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Kanit', sans-serif; background: #fafafa; color: #1a1a1a; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .container { max-width: 600px; text-align: center; }
        .logo { font-size: 48px; font-weight: 700; margin-bottom: 24px; color: #f97316; }   
        .icon-container { width: 100px; height: 100px; margin: 0 auto 32px; background: #fff0eb; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 40px; }
        h1 { font-size: 32px; font-weight: 600; margin-bottom: 12px; }
        p { font-size: 18px; color: #666; margin-bottom: 32px; }
        button { background: #f97316; color: white; border: none; padding: 14px 32px; border-radius: 9999px; font-size: 16px; font-weight: 500; font-family: 'Kanit', sans-serif; cursor: pointer; transition: background 0.2s; }
        button:hover { background: #ea580c; }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">Trackivity</div>
        <div class="icon-container">📶</div>
        <h1>ไม่มีการเชื่อมต่ออินเทอร์เน็ต</h1>
        <p>คุณออฟไลน์อยู่ กรุณาเชื่อมต่ออินเทอร์เน็ตเพื่อใช้งานระบบ</p>
        <button onclick="window.location.reload()">ลองโหลดซ้ำอีกครั้ง</button>
    </div>
</body>
</html>`,
                            {
                                status: 503,
                                statusText: 'Service Unavailable',
                                headers: { 'Content-Type': 'text/html; charset=utf-8' }
                            }
                        );
                    }
                }

                return new Response(
                    JSON.stringify({
                        error: 'Network unavailable',
                        message: 'กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต'
                    }),
                    {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            })
    );
});

// ─── Web Push Notifications ───────────────────────────────────────────────

sw.addEventListener('push', (event) => {
    console.log('[ServiceWorker] Push event received:', event);

    let data;
    try {
        data = event.data?.json();
    } catch (e) {
        data = { title: 'การแจ้งเตือนจาก Trackivity', body: event.data?.text() || 'ข้อความใหม่จากระบบ' };
    }

    const options: NotificationOptions = {
        body: data.body,
        icon: '/pwa-192x192.png',
        badge: '/badge-96x96.png', // Small icon for Android status bar
        data: { url: data.link || '/' },
        // @ts-ignore - TS types for SW vibrate might be missing on some TS configs
        vibrate: [200, 100, 200, 100, 200, 100, 200],
        tag: 'trackivity-push',
        renotify: true,
        requireInteraction: true,
        timestamp: Date.now()
    };

    event.waitUntil(sw.registration.showNotification(data.title || 'การแจ้งเตือน', options));
});

sw.addEventListener('notificationclick', (event) => {
    console.log('[ServiceWorker] Notification click received.', event);
    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';

    event.waitUntil(
        sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // If the app is already open, focus it and maybe navigate
            for (const client of clientList) {
                if ('focus' in client) {
                    return client.focus().then((c) => {
                        if (c && 'navigate' in c) {
                            return c.navigate(urlToOpen);
                        }
                    });
                }
            }
            // If the app is not open, open a new window
            if (sw.clients.openWindow) {
                return sw.clients.openWindow(urlToOpen);
            }
        })
    );
});

console.log(`[ServiceWorker] Script loaded - Network-Only mode (v${VERSION})`);
