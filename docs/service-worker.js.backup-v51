// Service Worker for REBORN PWA
// プッシュ通知とオフライン対応の基盤

const CACHE_NAME = 'reborn-v51-cleanup'; // デバッグログ削除+名前変更
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
// 重要: iOS Safari PWAでは未捕捉の例外でSW全体が失敗するため、全てtry/catchで囲む
// 参考: ChatGPT分析 - 直列実行 + 例外捕捉が必須
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    try {
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

      // バッジ: 正の整数のみ（0やnullはiOSでバグあり）
      const badgeCountRaw = notificationData.data?.badgeCount;
      const badgeCount = (typeof badgeCountRaw !== 'undefined' && badgeCountRaw !== null)
        ? parseInt(badgeCountRaw, 10)
        : null;

      // まずバッジをセット（直列実行 - 順序は実験で入れ替え可能）
      if ('setAppBadge' in self.registration && Number.isInteger(badgeCount) && badgeCount > 0) {
        try {
          await self.registration.setAppBadge(badgeCount);
          console.log('[SW] ✅ setAppBadge ok:', badgeCount);
        } catch (e) {
          console.error('[SW] ❌ setAppBadge failed:', e.name, e.message);
          // 失敗しても続行（未捕捉で落とさない）
        }
      }

      // 通知は確実に表示する（例外は捕まえる）
      try {
        await self.registration.showNotification(notificationData.title, {
          body: notificationData.body,
          icon: notificationData.icon,
          badge: notificationData.badge,
          data: notificationData.data,
          vibrate: [200, 100, 200],
          tag: 'reborn-notification'
        });
        console.log('[SW] ✅ showNotification ok');
      } catch (e) {
        console.error('[SW] ❌ showNotification failed:', e.name, e.message);
      }

    } catch (topErr) {
      console.error('[SW] push handler top-level error:', topErr);
    }
  })());
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
