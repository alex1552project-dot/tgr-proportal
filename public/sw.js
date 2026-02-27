const CACHE_NAME = 'proportal-v1';
const OFFLINE_URLS = ['/'];

// Install — cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — cache-first for assets, network-first for navigation
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Skip non-GET and Netlify function calls
  if (event.request.method !== 'GET' || url.pathname.startsWith('/.netlify/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });

      // Return cached immediately if available, fetch in background
      // For navigation requests, try network first for freshness
      if (event.request.mode === 'navigate') {
        return networkFetch.catch(() => cached || offlinePage());
      }

      return cached || networkFetch.catch(() => offlinePage());
    })
  );
});

function offlinePage() {
  return new Response(
    `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>TGR ProPortal</title>
  <style>
    body {
      background: #0f0f1a;
      color: #fff;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      text-align: center;
      padding: 24px;
    }
    h1 { color: #C2865A; font-size: 24px; margin-bottom: 8px; }
    p { opacity: 0.5; font-size: 15px; }
  </style>
</head>
<body>
  <h1>TGR ProPortal</h1>
  <p>No connection — Sin conexión</p>
</body>
</html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}
