// Service Worker for REBORN PWA
// プッシュ通知とオフライン対応の基盤

const CACHE_NAME = 'reborn-v42-badge-fix'; // バッジをwaitUntil内に移動
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
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received:', event);

  let notificationData = {
    title: 'フリラ',
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
        title: data.title || 'FURIRA',
        body: data.body || 'テスト通知です',
        icon: data.icon || '/icon-180.png',
        badge: data.badge || '/icon-180.png',
        data: data.data || { url: '/' }
      };
    } catch (e) {
      console.error('[Service Worker] Push data parse error:', e);
    }
  }

  console.log('[Service Worker] Badge API対応:', 'setAppBadge' in self.registration);
  console.log('[Service Worker] 通知データ:', JSON.stringify(notificationData.data));

  // 通知表示とバッジ設定を両方waitUntilに含める（バックグラウンド終了防止）
  const promises = [];

  // 通知表示（必須）
  promises.push(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      vibrate: [200, 100, 200],
      tag: 'reborn-notification'
    })
  );

  // バッジ設定（waitUntil内で実行することでバックグラウンドでも確実に完了）
  if ('setAppBadge' in self.registration) {
    const badgeCountRaw = notificationData.data?.badgeCount;
    console.log('[Service Worker] badgeCountRaw:', badgeCountRaw);
    if (badgeCountRaw !== undefined && badgeCountRaw !== null) {
      const badgeCount = parseInt(badgeCountRaw, 10) || 1;
      console.log('[Service Worker] setAppBadge呼び出し:', badgeCount);
      promises.push(
        self.registration.setAppBadge(badgeCount)
          .then(() => console.log('[Service Worker] ✅ バッジ設定成功:', badgeCount))
          .catch(err => console.error('[Service Worker] ❌ Badge API エラー:', err.name, err.message))
      );
    } else {
      console.log('[Service Worker] badgeCountなし - バッジ設定スキップ');
    }
  } else {
    console.log('[Service Worker] Badge API未対応');
  }

  event.waitUntil(Promise.all(promises));
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
