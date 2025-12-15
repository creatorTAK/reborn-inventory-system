// Service Worker for REBORN PWA
// プッシュ通知とオフライン対応の基盤

const CACHE_NAME = 'reborn-v76-menu-responsive'; // トップメニューレスポンシブ対応
const SW_VERSION = 'v76-menu-responsive'; // 確認用バージョン
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
  console.log('★★★ [Service Worker ' + SW_VERSION + '] Installing... ★★★');
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

  // その他のリソース（JS/CSS/画像等）は stale-while-revalidate
  // キャッシュから即座に返しつつ、バックグラウンドで最新版を取得
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(event.request).then((cachedResponse) => {
        // バックグラウンドでネットワークから最新版を取得してキャッシュ更新
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          // 成功したらキャッシュを更新（次回アクセス時に最新版が使われる）
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        }).catch(() => {
          // ネットワークエラー時は何もしない（キャッシュが使われる）
          return null;
        });

        // キャッシュがあれば即座に返す、なければネットワークを待つ
        return cachedResponse || fetchPromise;
      });
    })
  );
});

// プッシュ通知の受信
// ★★★ v52: オリジナルパターン復元（c89bdaf） ★★★
// - self.navigator.setAppBadge を使用
// - バッジはwaitUntil外（fire-and-forget）
// - 通知はwaitUntil内
self.addEventListener('push', (event) => {
  console.log('★★★ [SW ' + SW_VERSION + '] Push received ★★★');

  let notificationData = {
    title: 'フリラ',
    body: 'テスト通知です',
    icon: '/icon-180.png',
    badge: '/icon-180.png',
    data: { url: '/' }
  };

  // サーバーからデータが送られてきた場合
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
      console.log('[SW ' + SW_VERSION + '] Payload:', JSON.stringify(notificationData.data));
    } catch (e) {
      console.error('[SW] Push data parse error:', e);
    }
  }

  // ★ バッジ: waitUntil外、self.navigator.setAppBadge（オリジナルパターン）
  if ('setAppBadge' in self.navigator) {
    const badgeCount = notificationData.data?.badgeCount;
    if (badgeCount !== undefined) {
      const count = parseInt(badgeCount, 10);
      console.log('[SW ' + SW_VERSION + '] Setting badge:', count);
      self.navigator.setAppBadge(count).catch(err => {
        console.error('[SW] Badge API error:', err);
      });
    }
  } else {
    console.log('[SW ' + SW_VERSION + '] setAppBadge not in self.navigator');
  }

  // ★ 通知: waitUntil内（オリジナルパターン）
  event.waitUntil(
    self.registration.showNotification(notificationData.title, {
      body: notificationData.body,
      icon: notificationData.icon,
      badge: notificationData.badge,
      data: notificationData.data,
      vibrate: [200, 100, 200],
      tag: 'reborn-notification'
    }).then(() => {
      console.log('[SW ' + SW_VERSION + '] ✅ Notification shown');
    }).catch(err => {
      console.error('[SW ' + SW_VERSION + '] ❌ Notification error:', err);
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
