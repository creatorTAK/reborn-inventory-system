// Firebase Cloud Messaging Service Worker
// バックグラウンドでのプッシュ通知を処理

// バージョン管理（更新時にインクリメント）
const CACHE_VERSION = 'v9';
const CACHE_NAME = 'reborn-pwa-' + CACHE_VERSION;

// 通知の重複を防ぐためのキャッシュ
const notificationCache = new Set();

// 事前キャッシュするリソース（初回インストール時）
const PRECACHE_RESOURCES = [
  '/reborn-inventory-system/',
  '/reborn-inventory-system/index.html',
  '/reborn-inventory-system/manifest.json',
  '/reborn-inventory-system/icon-180.png',
  '/reborn-inventory-system/icon-192.png',
  '/reborn-inventory-system/icon-512.png'
];

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyAwJKTz1gm3CIz_R4YTlbQopgaBq1ULt1A",
  authDomain: "reborn-pwa.firebaseapp.com",
  projectId: "reborn-pwa",
  storageBucket: "reborn-pwa.firebasestorage.app",
  messagingSenderId: "345653439471",
  appId: "1:345653439471:web:7620819ce3f022d9cd241a",
  measurementId: "G-SX48K45X75"
};

// Firebase初期化
firebase.initializeApp(firebaseConfig);

// Firebase Messaging取得
const messaging = firebase.messaging();

// バックグラウンドメッセージ受信
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  // 🔧 データメッセージから値を取得
  // notification ではなく data から取得（ブラウザの自動表示を防ぐため）
  const notificationTitle = payload.data?.title || 'REBORN';
  const notificationBody = payload.data?.body || 'テスト通知です';
  const notificationIcon = payload.data?.icon || '/reborn-inventory-system/icon-180.png';
  const notificationBadge = payload.data?.badge || '/reborn-inventory-system/icon-180.png';
  const notificationLink = payload.data?.link || '/reborn-inventory-system/';
  const cacheKey = `${notificationTitle}|${notificationBody}`.substring(0, 100);

  // 同じ通知が2秒以内に来た場合はスキップ（念のため）
  if (notificationCache.has(cacheKey)) {
    console.log('[firebase-messaging-sw.js] 重複通知をスキップしました:', cacheKey);
    return;
  }

  // キャッシュに追加（2秒後に削除）
  notificationCache.add(cacheKey);
  setTimeout(() => {
    notificationCache.delete(cacheKey);
    console.log('[firebase-messaging-sw.js] キャッシュから削除:', cacheKey);
  }, 2000);

  // 1. バッジカウントを増やす（Badge API）
  incrementBadgeCount();

  // 2. 通知を表示（1回だけ）
  const notificationOptions = {
    body: notificationBody,
    icon: notificationIcon,
    badge: notificationBadge,
    vibrate: [200, 100, 200],
    data: { url: notificationLink },
    tag: cacheKey // 同じtagの通知は上書きされる（重複防止）
  };

  console.log('[firebase-messaging-sw.js] 通知を表示します:', notificationTitle);
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// バッジカウントを増やす（Service Worker内）
function incrementBadgeCount() {
  // localStorageから現在のカウントを取得
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    // 開いているクライアントがある場合はメッセージを送信
    if (clients.length > 0) {
      clients[0].postMessage({
        type: 'INCREMENT_BADGE'
      });
    } else {
      // クライアントがない場合、直接Badge APIを更新
      if ('setAppBadge' in self.navigator) {
        // localStorageは使えないため、IndexedDBまたは直接+1
        // ここではシンプルに現在の値を取得せず+1だけする
        self.navigator.setAppBadge(1).catch(err => {
          console.error('Badge API エラー:', err);
        });
      }
    }
  });
}

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

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

// Service Workerのインストール時に主要リソースを事前キャッシュ
self.addEventListener('install', (event) => {
  console.log('[Service Worker] インストール中... バージョン:', CACHE_VERSION);

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] 事前キャッシュ開始');
        return cache.addAll(PRECACHE_RESOURCES);
      })
      .then(() => {
        console.log('[Service Worker] 事前キャッシュ完了');
        return self.skipWaiting(); // 即座に有効化
      })
      .catch((error) => {
        console.error('[Service Worker] 事前キャッシュエラー:', error);
        // エラーが出てもインストール続行
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] 有効化中... バージョン:', CACHE_VERSION);

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] 古いキャッシュを削除:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] すべてのクライアントを制御します');
      return self.clients.claim();
    })
  );
});

// fetchイベント: Cache First戦略（2回目以降の起動を高速化）
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // GASドメイン（script.google.com）は常に最新版を取得（キャッシュしない）
  if (url.hostname === 'script.google.com' ||
      url.hostname.includes('googleusercontent.com')) {
    return; // デフォルトのネットワークリクエスト
  }

  // Firebase関連のリクエストもキャッシュしない
  if (url.hostname === 'www.gstatic.com' && url.pathname.includes('firebase')) {
    return;
  }

  // それ以外: Cache First戦略
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // キャッシュヒット: 即座に返す
          return cachedResponse;
        }

        // キャッシュミス: ネットワークから取得
        return fetch(event.request)
          .then((networkResponse) => {
            // 成功した場合のみキャッシュに保存
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error('[Service Worker] Fetch error:', error);
            // ネットワークエラー時、オフライン用のフォールバック可能
            throw error;
          });
      })
  );
});
