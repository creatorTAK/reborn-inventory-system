// Firebase Cloud Messaging Service Worker
// バックグラウンドでのプッシュ通知を処理

// バージョン管理（更新時にインクリメント）
const CACHE_VERSION = 'v13';
const CACHE_NAME = 'reborn-pwa-' + CACHE_VERSION;

// 通知の重複を防ぐためのキャッシュ（タイムスタンプ付き）
const notificationCache = new Map();

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

  // 🔧 notification + data から値を取得
  const notificationTitle = payload.notification?.title || payload.data?.title || 'REBORN';
  const notificationBody = payload.notification?.body || payload.data?.body || 'テスト通知です';
  const notificationIcon = payload.data?.icon || '/reborn-inventory-system/icon-180.png';
  const notificationBadge = payload.data?.badge || '/reborn-inventory-system/icon-180.png';
  const notificationLink = payload.data?.click_action || payload.data?.link || '/reborn-inventory-system/';
  const messageId = payload.data?.messageId || '';

  // キャッシュクリーンアップ: 2秒以上前のエントリを削除
  const now = Date.now();
  for (const [key, timestamp] of notificationCache.entries()) {
    if (now - timestamp > 2000) {
      notificationCache.delete(key);
      console.log('[firebase-messaging-sw.js] 古いキャッシュを削除:', key);
    }
  }

  // messageIdを使った重複チェック
  const cacheKey = messageId || `${notificationTitle}|${notificationBody}|${now}`.substring(0, 100);

  console.log('[firebase-messaging-sw.js] messageId:', messageId);
  console.log('[firebase-messaging-sw.js] cacheKey:', cacheKey);
  console.log('[firebase-messaging-sw.js] キャッシュサイズ:', notificationCache.size);

  // messageIdがある場合のみ重複チェック（テストメッセージは毎回表示）
  if (messageId && notificationCache.has(cacheKey)) {
    console.log('[firebase-messaging-sw.js] 重複通知をスキップしました:', cacheKey);
    return;
  }

  // キャッシュに追加（タイムスタンプ付き、setTimeoutは使わない）
  if (messageId) {
    notificationCache.set(cacheKey, now);
    console.log('[firebase-messaging-sw.js] キャッシュに追加:', cacheKey);
  }

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

  // ACK送信（受信確認）- messageIdがある場合のみ
  if (messageId) {
    sendAck(messageId);
  }
});

// ACK（受信確認）をGASに送信
function sendAck(messageId) {
  const ackUrl = 'https://script.google.com/macros/s/AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA/exec';
  const timestamp = new Date().getTime();

  console.log('[ACK] 送信開始:', messageId);

  fetch(ackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'receiveAck',
      messageId: messageId,
      timestamp: timestamp
    })
  })
  .then(response => response.json())
  .then(data => {
    console.log('[ACK] 送信成功:', data);
  })
  .catch(error => {
    console.error('[ACK] 送信エラー:', error);
  });
}

// IndexedDB: バッジカウント永続化
function getBadgeCount() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RebornBadgeDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['badge'], 'readonly');
      const store = transaction.objectStore('badge');
      const getRequest = store.get('count');

      getRequest.onsuccess = () => resolve(getRequest.result || 0);
      getRequest.onerror = () => resolve(0);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('badge')) {
        db.createObjectStore('badge');
      }
    };
  });
}

function setBadgeCount(count) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RebornBadgeDB', 1);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['badge'], 'readwrite');
      const store = transaction.objectStore('badge');
      store.put(count, 'count');

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('badge')) {
        db.createObjectStore('badge');
      }
    };
  });
}

// バッジカウントを増やす（Service Worker内）
function incrementBadgeCount() {
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    // 開いているクライアントがある場合はメッセージを送信
    if (clients.length > 0) {
      clients[0].postMessage({
        type: 'INCREMENT_BADGE'
      });
    } else {
      // クライアントがない場合、IndexedDBから現在のカウントを取得して+1
      if ('setAppBadge' in self.navigator) {
        try {
          const currentCount = await getBadgeCount();
          const newCount = currentCount + 1;

          await setBadgeCount(newCount);
          await self.navigator.setAppBadge(newCount);

          console.log('[Badge] カウント更新:', currentCount, '→', newCount);
        } catch (err) {
          console.error('[Badge] エラー:', err);
        }
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
