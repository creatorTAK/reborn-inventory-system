// Service Worker for REBORN PWA
// プッシュ通知とオフライン対応の基盤

const CACHE_NAME = 'reborn-v28'; // PWA版：チャット無限ループ修正（Firestoreリスナー重複防止）
const urlsToCache = [
  '/',
  '/index.html',
  '/notifications.html',
  '/manifest.json',
  '/icon-180.png',
  '/css/product-styles.css',
  '/js/product-scripts.js'
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
    icon: '/icon-180.png',
    badge: '/icon-180.png',
    data: {
      url: '/'
    }
  };

  // サーバーからデータが送られてきた場合
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || 'REBORN',
        body: data.body || 'テスト通知です',
        icon: data.icon || '/icon-180.png',
        badge: data.badge || '/icon-180.png',
        data: data.data || { url: '/' }
      };
    } catch (e) {
      console.error('[Service Worker] Push data parse error:', e);
    }
  }

  // アプリバッジを更新（通知データにバッジカウントが含まれている場合）
  if ('setAppBadge' in self.navigator) {
    const badgeCount = notificationData.data?.badgeCount;
    if (badgeCount !== undefined) {
      self.navigator.setAppBadge(badgeCount).catch(err => {
        console.error('[Service Worker] Badge API エラー:', err);
      });
      console.log('[Service Worker] アプリバッジ更新:', badgeCount);
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

  const urlToOpen = event.notification.data?.url || '/';

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
