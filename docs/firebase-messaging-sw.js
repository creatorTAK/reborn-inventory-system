// Firebase Cloud Messaging Service Worker
// バックグラウンドでのプッシュ通知を処理

// バージョン管理（更新時にインクリメント）
const CACHE_VERSION = 'v4';
const CACHE_NAME = 'reborn-pwa-' + CACHE_VERSION;

// 通知の重複を防ぐためのキャッシュ
const notificationCache = new Set();

importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyAwJKTz1gm3CIz_R4YT1bQOpgaBq1ULt1A",
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

  // 🔧 重複チェック: 同じ通知を短時間に2回表示しない
  const notificationTitle = payload.notification?.title || 'REBORN';
  const notificationBody = payload.notification?.body || 'テスト通知です';
  const cacheKey = `${notificationTitle}|${notificationBody}`.substring(0, 100);

  // 同じ通知が2秒以内に来た場合はスキップ
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

  // 2. 通知を表示
  const notificationOptions = {
    body: notificationBody,
    icon: '/reborn-inventory-system/icon-180.png',
    badge: '/reborn-inventory-system/icon-180.png',
    vibrate: [200, 100, 200],
    data: payload.data || { url: '/reborn-inventory-system/' },
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

// Service Workerのインストール時に古いキャッシュを削除
self.addEventListener('install', (event) => {
  console.log('[Service Worker] インストール中... バージョン:', CACHE_VERSION);
  self.skipWaiting(); // 即座に有効化
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
