// Service Worker for REBORN PWA
// プッシュ通知とオフライン対応の基盤

const CACHE_NAME = 'reborn-v46-badge-fireforget'; // navigator.setAppBadge + waitUntil外
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
  // 即座にアクティブ化（待機をスキップ）
  self.skipWaiting();

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
    }).then(() => {
      // 即座にこのService Workerでページを制御
      return self.clients.claim();
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

  // HTMLファイルはネットワーク優先（常に最新版を取得）
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // 成功したらキャッシュを更新
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // オフライン時はキャッシュから返す
          return caches.match(event.request);
        })
    );
    return;
  }

  // その他のリソースはキャッシュ優先
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        return response || fetch(event.request);
      })
  );
});

// プッシュ通知の受信
// 過去の動作実績: self.navigator.setAppBadge + waitUntil外（fire-and-forget）
self.addEventListener('push', (event) => {
  console.log('[SW] Push received');

  let notificationData = {
    title: 'フリラ',
    body: 'テスト通知です',
    icon: '/icon-180.png',
    badge: '/icon-180.png',
    data: { url: '/' }
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        data: data.data || notificationData.data
      };
      console.log('[SW] Payload parsed:', JSON.stringify(notificationData.data));
    } catch (e) {
      console.error('[SW] push data json parse error', e);
    }
  }

  // 🔴 バッジ: waitUntilの外で fire-and-forget（過去の動作パターン）
  const badgeCountRaw = notificationData.data?.badgeCount;
  const badgeCount = (typeof badgeCountRaw !== 'undefined' && badgeCountRaw !== null)
    ? parseInt(badgeCountRaw, 10)
    : null;

  if (Number.isInteger(badgeCount) && badgeCount > 0) {
    // self.navigator.setAppBadge を使用（過去の動作実績）
    if ('setAppBadge' in navigator) {
      navigator.setAppBadge(badgeCount)
        .then(() => console.log('[SW] ✅ navigator.setAppBadge ok:', badgeCount))
        .catch(e => console.error('[SW] ❌ navigator.setAppBadge failed:', e));
    } else if (self.navigator && 'setAppBadge' in self.navigator) {
      self.navigator.setAppBadge(badgeCount)
        .then(() => console.log('[SW] ✅ self.navigator.setAppBadge ok:', badgeCount))
        .catch(e => console.error('[SW] ❌ self.navigator.setAppBadge failed:', e));
    }
  }

  // 🔵 通知表示: waitUntil内で確実に実行
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      vibrate: [200, 100, 200],
      tag: 'reborn-notification'
    }).then(() => {
      console.log('[SW] ✅ showNotification ok');
    }).catch(e => {
      console.error('[SW] ❌ showNotification failed:', e);
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
