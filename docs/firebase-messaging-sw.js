// Firebase Cloud Messaging Service Worker
// バックグラウンドでのプッシュ通知を処理

// バージョン管理（更新時にインクリメント）
const CACHE_VERSION = 'v31';  // @796 Phase 2: NOTIF-004対応 - 通知自動クリーンアップ
const CACHE_NAME = 'reborn-pwa-' + CACHE_VERSION;

// 通知の重複を防ぐためのキャッシュ（タイムスタンプ付き）
const notificationCache = new Map();
const MAX_CACHE_SIZE = 100;  // @796: キャッシュ最大サイズ（メモリリーク防止）
const NETWORK_TIMEOUT = 5000;  // @796: ネットワークリクエストタイムアウト（5秒）

// 事前キャッシュするリソース（初回インストール時）
const PRECACHE_RESOURCES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-180.png',
  '/icon-192.png',
  '/icon-512.png'
];

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js');

// Firebase設定（reborn-chat に統一）
const firebaseConfig = {
  apiKey: "AIzaSyCe-mj6xoV1HbHkIOVqeHCjKjwwtCorUZQ",
  authDomain: "reborn-chat.firebaseapp.com",
  projectId: "reborn-chat",
  storageBucket: "reborn-chat.firebasestorage.app",
  messagingSenderId: "345706548795",
  appId: "1:345706548795:web:058a553da6b4b74db5161e"
};

// Firebase初期化
firebase.initializeApp(firebaseConfig);

// Firebase Messaging取得
const messaging = firebase.messaging();

// バックグラウンドメッセージ受信（asyncで非同期処理を待機）
messaging.onBackgroundMessage(async (payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);

  // 🔧 notification + data から値を取得
  const notificationTitle = payload.notification?.title || payload.data?.title || 'REBORN';
  const notificationBody = payload.notification?.body || payload.data?.body || 'テスト通知です';
  const notificationIcon = payload.data?.icon || '/icon-180.png';

  // 🔧 badge/badgeCount 両方に対応（フィールド名不一致対策）
  const rawBadge = payload.data?.badge || payload.data?.badgeCount || payload.notification?.badge;
  console.log('[DEBUG] rawBadge from payload:', rawBadge, '(badge:', payload.data?.badge, ', badgeCount:', payload.data?.badgeCount, ')');
  const notificationBadge = rawBadge || '/icon-180.png';

  const notificationLink = payload.data?.click_action || payload.data?.link || '/';
  const messageId = payload.data?.messageId || '';

  // @796: キャッシュクリーンアップ改善（メモリリーク防止）
  const now = Date.now();

  // 1. 2秒以上前のエントリを削除
  for (const [key, timestamp] of notificationCache.entries()) {
    if (now - timestamp > 2000) {
      notificationCache.delete(key);
      console.log('[firebase-messaging-sw.js] 古いキャッシュを削除:', key);
    }
  }

  // 2. サイズ制限チェック（最大100件）
  if (notificationCache.size >= MAX_CACHE_SIZE) {
    // 最も古いエントリを削除（先頭から削除）
    const oldestKey = notificationCache.keys().next().value;
    notificationCache.delete(oldestKey);
    console.log('[firebase-messaging-sw.js] サイズ制限によりキャッシュ削除:', oldestKey, 'サイズ:', notificationCache.size);
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

  // 🧹 表示中通知を最大3件に制限（古い通知を自動削除）
  try {
    const existingNotifications = await self.registration.getNotifications();
    console.log('[firebase-messaging-sw.js] 現在の通知数:', existingNotifications.length);

    if (existingNotifications.length >= 3) {
      // 古い順に閉じる（最新3件のみ残す）
      const toClose = existingNotifications.slice(0, existingNotifications.length - 2);
      toClose.forEach(n => {
        n.close();
        console.log('[firebase-messaging-sw.js] 古い通知を閉じました:', n.tag);
      });
    }
  } catch (err) {
    console.error('[firebase-messaging-sw.js] 通知取得エラー:', err);
  }

  // 🔧 @773 完全分離: typeに応じて別のバッジシステムを使用
  const notificationType = payload.data?.type || 'chat';
  console.log('[DEBUG] payload.data:', payload.data);
  console.log('[DEBUG] notificationType:', notificationType);

  // type分岐: チャットとシステムで完全に独立したバッジシステム
  if (notificationType === 'system') {
    console.log('[Badge] システム通知: SystemNotificationDB + Firestore unreadCount更新');
    await incrementSystemBadgeCount(); // システム通知専用（SystemNotificationDB） → アプリアイコンバッジ
    await updateFirestoreUnreadCount(); // Firestore unreadCount更新 → ヘッダーバッジ & ルームバッジ
  } else {
    console.log('[Badge] チャット通知: RebornBadgeDB使用');
    await incrementBadgeCount(); // チャット通知（RebornBadgeDB）
  }

  // 3. 通知を表示（messageIdをtagに使用）
  const notificationOptions = {
    body: notificationBody,
    icon: notificationIcon,
    badge: notificationBadge,
    vibrate: [200, 100, 200],
    data: { url: notificationLink, messageId: messageId },
    tag: messageId || cacheKey, // messageIdをtagに（一意性確保）
    renotify: true // 再通知を有効化
  };

  // @796 Phase 2: 古い通知をクリアしてブラウザの表示数制限を回避
  try {
    const existingNotifications = await self.registration.getNotifications();
    console.log('[Notification] 既存通知数:', existingNotifications.length);

    // 通知が2件以上ある場合、古いものから順にクリア（最新1件のみ残す）
    if (existingNotifications.length >= 2) {
      // 古い通知を全てクリア（新しい通知を表示する余裕を作る）
      for (const notification of existingNotifications) {
        notification.close();
        console.log('[Notification] 古い通知をクリア:', notification.tag);
      }
      console.log('[Notification] 全ての古い通知をクリア完了');
    }
  } catch (err) {
    console.warn('[Notification] 既存通知のクリアに失敗:', err);
    // エラーが出ても通知表示は続行
  }

  console.log('[firebase-messaging-sw.js] 通知を表示します:', notificationTitle);
  await self.registration.showNotification(notificationTitle, notificationOptions);

  // ACK送信（受信確認）- messageIdがある場合のみ
  if (messageId) {
    sendAck(messageId);
  }
});

// @796: ACK（受信確認）をGASに送信（タイムアウト対応）
function sendAck(messageId) {
  const ackUrl = 'https://script.google.com/macros/s/AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA/exec';
  const timestamp = new Date().getTime();

  console.log('[ACK] 送信開始:', messageId);

  // タイムアウト制御
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
    console.warn('[ACK] タイムアウト:', messageId);
  }, NETWORK_TIMEOUT);

  fetch(ackUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'receiveAck',
      messageId: messageId,
      timestamp: timestamp
    }),
    signal: controller.signal
  })
  .then(response => response.json())
  .then(data => {
    console.log('[ACK] 送信成功:', data);
  })
  .catch(error => {
    if (error.name === 'AbortError') {
      console.warn('[ACK] タイムアウトによる中断:', messageId);
    } else {
      console.error('[ACK] 送信エラー:', error);
    }
  })
  .finally(() => {
    clearTimeout(timeoutId);
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

// 🔧 @773 完全分離: システム通知専用IndexedDB（RebornBadgeDBと完全独立）
function getSystemBadgeCount() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SystemNotificationDB', 1);

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

function setSystemBadgeCount(count) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SystemNotificationDB', 1);

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

// システム通知専用バッジカウント増加
async function incrementSystemBadgeCount() {
  try {
    // 🔧 @774 修正: PWAの状態に関係なく、Service Worker内で直接バッジ更新
    if ('setAppBadge' in self.registration) {
      const chatCount = await getBadgeCount(); // チャット通知のカウント
      const systemCount = await getSystemBadgeCount(); // システム通知のカウント
      const newSystemCount = systemCount + 1;

      await setSystemBadgeCount(newSystemCount);

      // 両方の合計をアプリバッジに表示
      const totalCount = chatCount + newSystemCount;
      await self.registration.setAppBadge(totalCount);

      console.log('[SystemBadge] カウント更新: chat=' + chatCount + ', system=' + systemCount + '→' + newSystemCount + ', total=' + totalCount);
    } else {
      console.warn('[SystemBadge] setAppBadge API not supported');
    }
  } catch (err) {
    console.error('[SystemBadge] エラー:', err);
  }
}

// Firestore unreadCountを更新（システム通知ルーム専用）
async function updateFirestoreUnreadCount() {
  try {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    // 開いているクライアントがある場合はメッセージを送信
    if (clients.length > 0) {
      clients[0].postMessage({
        type: 'INCREMENT_SYSTEM_UNREAD'
      });
      console.log('[sw] asked client to increment system unread');
      return;
    }

    // クライアントがない場合、Cloudflare Workerに依頼
    const userName = await getUserNameFromIndexedDB();
    console.log('[DEBUG] updateFirestoreUnreadCount - userName:', userName);
    if (!userName) {
      console.error('[sw] userName not found in IndexedDB - システム通知バッジ更新スキップ');
      return;
    }

    try {
      const roomId = 'room_system_notifications';
      const requestBody = { roomId, userName, delta: 1 };
      console.log('[DEBUG] Cloudflare Worker リクエスト:', requestBody);

      // @796: タイムアウト制御
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.warn('[sw] Cloudflare Worker タイムアウト');
      }, NETWORK_TIMEOUT);

      try {
        const res = await fetch('https://reborn-webhook.tak45.workers.dev/api/unread/increment', {
          method: 'POST',
          headers: {
            'content-type': 'application/json'
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });

        console.log('[DEBUG] Cloudflare Worker レスポンスステータス:', res.status);

        if (!res.ok) {
          const errorText = await res.text();
          console.error('[DEBUG] Cloudflare Worker エラーレスポンス:', errorText);
          throw new Error(`Worker returned ${res.status}: ${errorText}`);
        }

        const result = await res.json();
        console.log('[DEBUG] Cloudflare Worker 成功レスポンス:', result);
        console.log('[sw] server-side unread increment OK:', result);
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        console.warn('[sw] Cloudflare Worker タイムアウトによる中断');
      } else {
        console.error('[sw] server-side unread increment failed:', e);
        console.error('[DEBUG] エラー詳細:', e.message, e.stack);
      }
    }
  } catch (err) {
    console.error('[Firestore] エラー:', err);
  }
}

// IndexedDBからuserNameを取得
function getUserNameFromIndexedDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('RebornUserDB', 1);

    request.onerror = () => {
      console.error('[IndexedDB] 開けませんでした');
      resolve(null);
    };

    request.onsuccess = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('user')) {
        console.error('[IndexedDB] userストアが存在しません');
        resolve(null);
        return;
      }

      const transaction = db.transaction(['user'], 'readonly');
      const store = transaction.objectStore('user');
      const getRequest = store.get('userName');

      getRequest.onsuccess = () => {
        const userName = getRequest.result || null;
        console.log('[DEBUG] IndexedDB userName取得:', userName);
        resolve(userName);
      };

      getRequest.onerror = () => {
        console.error('[IndexedDB] userName取得エラー');
        resolve(null);
      };
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('user')) {
        db.createObjectStore('user');
      }
    };
  });
}

// バッジカウントを増やす（Service Worker内）
async function incrementBadgeCount() {
  try {
    // 🔧 @774 修正: PWAの状態に関係なく、Service Worker内で直接バッジ更新
    if ('setAppBadge' in self.registration) {
      const currentCount = await getBadgeCount();
      const newCount = currentCount + 1;

      await setBadgeCount(newCount);
      await self.registration.setAppBadge(newCount);

      console.log('[Badge] カウント更新:', currentCount, '→', newCount);
    } else {
      console.warn('[Badge] setAppBadge API not supported');
    }
  } catch (err) {
    console.error('[Badge] エラー:', err);
  }
}

// 通知クリック時の処理
self.addEventListener('notificationclick', (event) => {
  console.log('[firebase-messaging-sw.js] Notification clicked:', event);

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

// fetchイベント: HTMLはNetwork First、その他はCache First
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

  // HTMLファイル: Network First戦略（常に最新版を取得、開発効率向上）
  if (url.pathname.endsWith('.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // 成功した場合はキャッシュに保存して返す
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
          // ネットワークエラー時はキャッシュから返す（オフライン対応）
          console.log('[Service Worker] Network failed, trying cache:', url.pathname);
          return caches.match(event.request);
        })
    );
    return;
  }

  // その他のリソース（JS/CSS/画像など）: Cache First戦略（高速化）
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
