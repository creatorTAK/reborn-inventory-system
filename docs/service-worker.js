// Service Worker for REBORN PWA
// プッシュ通知とオフライン対応の基盤

const CACHE_NAME = 'reborn-v3'; // クロスオリジン対応版
const urlsToCache = [
  '/reborn-inventory-system/',
  '/reborn-inventory-system/index.html',
  '/reborn-inventory-system/notifications.html',
  '/reborn-inventory-system/manifest.json',
  '/reborn-inventory-system/icon-180.png'
];

// Service Workerのインストール
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
  );
});

// Service Workerのアクティベーション
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// ネットワークリクエストの処理
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ★ クロスオリジン（script.google.com 等）は一切キャッシュせず素通し
  if (url.origin !== self.location.origin) {
    console.log('[Service Worker] Cross-origin fetch (bypass cache):', url.href);
    event.respondWith(fetch(event.request));
    return;
  }

  // 同一オリジンのリクエストはキャッシュ戦略を使う
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // キャッシュにあればキャッシュを返す、なければネットワークから取得
        return response || fetch(event.request);
      })
  );
});

// プッシュ通知の受信
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);

  let notificationData = {
    title: 'REBORN',
    body: 'テスト通知です',
    icon: '/reborn-inventory-system/icon-180.png',
    badge: '/reborn-inventory-system/icon-180.png',
    data: {
      url: '/reborn-inventory-system/'
    }
  };

  // サーバーからデータが送られてきた場合
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || 'REBORN',
        body: data.body || 'テスト通知です',
        icon: data.icon || '/reborn-inventory-system/icon-180.png',
        badge: data.badge || '/reborn-inventory-system/icon-180.png',
        data: data.data || { url: '/reborn-inventory-system/' }
      };
    } catch (e) {
      console.error('[Service Worker] Push data parse error:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      vibrate: [200, 100, 200],
      tag: 'reborn-notification'
    })
  );
});

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event);

  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/reborn-inventory-system/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 既にタブが開いている場合はそれをフォーカス
        for (let client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // なければ新しいタブを開く
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
