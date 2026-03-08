// Firebase Cloud Messaging Service Worker
// @796 Phase 3: NOTIF-004根本対策 - event.waitUntil()ベースに全面改修
// @fix: ホーム画面アイコンバッジ対応 - navigator.setAppBadge()追加

// バージョン管理（更新時にインクリメント）
const CACHE_VERSION = 'v33';
const CACHE_NAME = 'reborn-pwa-' + CACHE_VERSION;

// 通知の重複を防ぐためのキャッシュ（軽量化）
const notificationCache = new Map();
const MAX_CACHE_SIZE = 200;
const CACHE_TTL_MS = 5000; // 5秒で自動削除

// ネットワークタイムアウト
const NETWORK_TIMEOUT = 4000; // 4秒

// 事前キャッシュするリソース
const PRECACHE_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-180.png',
  '/icon-192.png',
  '/icon-512.png'
];

// Firebase SDK読み込み
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyCe-mj6xoV1HbHkIOVqeHCjKjwwtCorUZQ",
  authDomain: "furira.jp",
  projectId: "reborn-chat",
  storageBucket: "reborn-chat.firebasestorage.app",
  messagingSenderId: "345706548795",
  appId: "1:345706548795:web:058a553da6b4b74db5161e"
};

// Firebase初期化
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

console.log('[SW v32] Service Worker initialized with event.waitUntil() architecture');

// ================================================================================
// キャッシュクリーンアップ（軽量化）
// ================================================================================
function pruneCache() {
  const now = Date.now();
  for (const [key, timestamp] of notificationCache.entries()) {
    if (now - timestamp > CACHE_TTL_MS) {
      notificationCache.delete(key);
    }
  }
  while (notificationCache.size > MAX_CACHE_SIZE) {
    const oldest = notificationCache.keys().next().value;
    notificationCache.delete(oldest);
  }
}

// ================================================================================
// IndexedDB操作（最小化）
// ================================================================================
function openDB(dbName) {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('badge')) {
        db.createObjectStore('badge');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function incrementBadge(dbName) {
  return openDB(dbName).then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('badge', 'readwrite');
    const store = tx.objectStore('badge');
    const getReq = store.get('count');

    getReq.onsuccess = () => {
      const currentCount = Number(getReq.result || 0) + 1;
      store.put(currentCount, 'count');
      console.log(`[Badge] ${dbName} count:`, currentCount);

      // 🔔 ホーム画面アイコンにバッジを設定
      if (navigator.setAppBadge) {
        navigator.setAppBadge(currentCount).then(() => {
          console.log(`[Badge] ✅ setAppBadge(${currentCount}) 成功`);
        }).catch(err => {
          console.warn(`[Badge] ⚠️ setAppBadge失敗:`, err);
        });
      } else {
        console.log('[Badge] setAppBadge API未対応');
      }
    };

    tx.oncomplete = () => {
      db.close();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  }));
}

// ================================================================================
// ACK送信（タイムアウト付き）
// ================================================================================
function sendAck(messageId) {
  if (!messageId) return Promise.resolve();

  const ackUrl = 'https://script.google.com/macros/s/AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA/exec';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT);

  return fetch(ackUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'receiveAck',
      messageId: messageId,
      timestamp: Date.now()
    }),
    signal: controller.signal
  })
  .then(res => res.json())
  .then(data => console.log('[ACK] Success:', data))
  .catch(err => {
    if (err.name === 'AbortError') {
      console.warn('[ACK] Timeout:', messageId);
    } else {
      console.error('[ACK] Error:', err);
    }
  })
  .finally(() => clearTimeout(timeoutId));
}

// ================================================================================
// Firestore unreadCount更新（タイムアウト付き）
// ================================================================================
function updateFirestoreUnreadCount(userName) {
  if (!userName) return Promise.resolve();

  const workerUrl = 'https://reborn-webhook.tak45.workers.dev/api/unread/increment';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), NETWORK_TIMEOUT);

  return fetch(workerUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      roomId: 'room_system_notifications',
      userName: userName,
      delta: 1
    }),
    signal: controller.signal
  })
  .then(res => {
    if (!res.ok) throw new Error(`Worker returned ${res.status}`);
    return res.json();
  })
  .then(data => console.log('[Firestore] unreadCount updated:', data))
  .catch(err => {
    if (err.name === 'AbortError') {
      console.warn('[Firestore] Timeout');
    } else {
      console.error('[Firestore] Error:', err);
    }
  })
  .finally(() => clearTimeout(timeoutId));
}

// ================================================================================
// 🎯 CORE: push イベントハンドラ（event.waitUntil()使用）
// ================================================================================
self.addEventListener('push', (event) => {
  console.log('[SW v32] Push event received');

  // ペイロード解析
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    console.error('[SW v32] Failed to parse payload:', e);
    payload = {
      data: {
        title: 'New message',
        body: event.data ? event.data.text() : ''
      }
    };
  }

  // 🔧 notification + data から値を取得（互換性維持）
  const data = payload.data || {};
  const notification = payload.notification || {};

  const title = notification.title || data.title || 'FURIRA';
  const body = notification.body || data.body || '新しい通知があります';
  const icon = data.icon || '/icon-180.png';
  const badge = data.badge || '/icon-180.png';
  const link = data.link || 'https://reborn-tak45.pages.dev/';
  const messageId = data.messageId;
  const notificationType = data.type || 'chat'; // 'chat' or 'system'
  const userName = data.userName; // システム通知用

  const cacheKey = messageId || `${Date.now()}_${Math.random()}`;

  // ================================================================================
  // 🎯 CRITICAL: 全ての非同期処理を event.waitUntil() でラップ
  // ================================================================================
  const promiseChain = (async () => {
    try {
      // 1. キャッシュクリーンアップ + 重複チェック
      pruneCache();
      if (notificationCache.has(cacheKey)) {
        console.log('[SW v32] Duplicate notification, skipping:', cacheKey);
        return;
      }
      notificationCache.set(cacheKey, Date.now());

      // 2. バッジ更新（最小化されたIndexedDB操作）
      if (notificationType === 'system') {
        console.log('[Badge] System notification: SystemNotificationDB + Firestore');
        await incrementBadge('SystemNotificationDB');
        await updateFirestoreUnreadCount(userName);
      } else {
        console.log('[Badge] Chat notification: RebornBadgeDB');
        await incrementBadge('RebornBadgeDB');
      }

      // 3. ACK送信（並列実行、失敗しても続行）
      if (messageId) {
        sendAck(messageId); // 並列実行（await不要）
      }

      // 4. 古い通知のクリーンアップ（5件以上で全削除）
      const existingNotifications = await self.registration.getNotifications();
      console.log('[Notification] Existing notifications:', existingNotifications.length);

      if (existingNotifications.length >= 5) {
        for (const n of existingNotifications) {
          n.close();
          console.log('[Notification] Closed old notification:', n.tag);
        }
      }

      // 5. 新しい通知を表示
      const notificationOptions = {
        body: body,
        icon: icon,
        badge: badge,
        vibrate: [200, 100, 200],
        data: {
          url: link,
          messageId: messageId,
          type: notificationType
        },
        tag: messageId || cacheKey,
        renotify: true
      };

      console.log('[SW v32] Showing notification:', title);
      await self.registration.showNotification(title, notificationOptions);

      console.log('[SW v32] Push event handled successfully');

    } catch (error) {
      console.error('[SW v32] Error in push handler:', error);
      // エラーでも通知は試みる
      try {
        await self.registration.showNotification('FURIRA', {
          body: '通知の処理中にエラーが発生しました',
          icon: '/icon-180.png'
        });
      } catch (e) {
        console.error('[SW v32] Failed to show error notification:', e);
      }
    }
  })();

  // 🎯 CRITICAL: ブラウザにSWの実行完了を保証
  event.waitUntil(promiseChain);
});

// ================================================================================
// 通知クリックイベント
// ================================================================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW v32] Notification clicked');

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

// ================================================================================
// Service Worker インストール
// ================================================================================
self.addEventListener('install', (event) => {
  console.log('[SW v32] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW v32] Precaching resources');
        return cache.addAll(PRECACHE_RESOURCES);
      })
      .then(() => {
        console.log('[SW v32] Precache complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW v32] Precache error:', error);
        return self.skipWaiting();
      })
  );
});

// ================================================================================
// Service Worker 有効化
// ================================================================================
self.addEventListener('activate', (event) => {
  console.log('[SW v32] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW v32] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW v32] Activated, claiming clients');
        return self.clients.claim();
      })
  );
});

// ================================================================================
// Service Worker エラーハンドリング
// ================================================================================
self.addEventListener('error', (event) => {
  console.error('[SW v32] Global error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW v32] Unhandled rejection:', event.reason);
});

console.log('[SW v32] Service Worker loaded successfully');
