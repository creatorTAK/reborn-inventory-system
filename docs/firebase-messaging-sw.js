// Firebase Cloud Messaging Service Worker
// @796 Phase 3: NOTIF-004根本対策 - event.waitUntil()ベースに全面改修
// @fix: ホーム画面アイコンバッジ対応 - navigator.setAppBadge()追加

// バージョン管理（更新時にインクリメント）
const CACHE_VERSION = 'v379';  // v379: 全フラグメント+index.htmlのグレー/ボーダーをウォームパレットに統一
const CACHE_NAME = 'reborn-pwa-' + CACHE_VERSION;

// 通知の重複を防ぐためのキャッシュ（軽量化）
const notificationCache = new Map();
const MAX_CACHE_SIZE = 200;
const CACHE_TTL_MS = 10000; // 🔧 パフォーマンス改善: 10秒に延長（重複排除の信頼性向上）

// ネットワークタイムアウト
const NETWORK_TIMEOUT = 4000; // 4秒

// 事前キャッシュするリソース
// ⚠️ index.html と / はfetchイベントでバイパスしているためプリキャッシュ不要
// プリキャッシュすると古いHTMLがキャッシュに残り、バージョン不一致の原因になる
const PRECACHE_RESOURCES = [
  '/manifest.json',
  '/icon-180.png',
  '/icon-192.png',
  '/icon-512.png'
];

// Firebase Messaging SDKは使用しない（2重通知を防ぐため）
// pushイベントを手動でハンドリングする

// 閲覧中のルームID管理（クライアントからpostMessageで受け取る）
const viewingRoomByClient = new Map(); // clientId -> roomId

console.log('[SW v160] Service Worker initialized - JS/CSS Network First caching enabled');

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

// ================================================================================
// Pending Navigation DB（通知タップ→ページ遷移用）
// iOS PWAではnotificationclickが発火しないことがあるため、
// pushイベントでナビゲーション先を保存し、アプリ復帰時に読み取る
// ================================================================================
function openPendingNavDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('PendingNavigationDB', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('nav')) {
        db.createObjectStore('nav');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function savePendingNavigation(page, roomId) {
  return openPendingNavDB().then(db => new Promise((resolve) => {
    const tx = db.transaction('nav', 'readwrite');
    const store = tx.objectStore('nav');
    store.put({ page: page, roomId: roomId || '', timestamp: Date.now() }, 'pending');
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); resolve(false); };
  })).catch((err) => {
    console.error('[SW] savePendingNavigation error:', err);
    return false;
  });
}

function clearPendingNavigation() {
  return openPendingNavDB().then(db => new Promise((resolve) => {
    const tx = db.transaction('nav', 'readwrite');
    const store = tx.objectStore('nav');
    store.delete('pending');
    tx.oncomplete = () => { db.close(); resolve(true); };
    tx.onerror = () => { db.close(); resolve(false); };
  })).catch(() => false);
}

// 指定DBのバッジカウントを読み取る（読み取り専用）
function readBadgeCount(dbName) {
  return openDB(dbName).then(db => new Promise((resolve) => {
    const tx = db.transaction('badge', 'readonly');
    const store = tx.objectStore('badge');
    const getReq = store.get('count');
    getReq.onsuccess = () => {
      resolve(Number(getReq.result || 0));
    };
    getReq.onerror = () => resolve(0);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); resolve(0); };
  })).catch(() => 0);
}

// 全DB（チャット+タスク+資材不足）の合算でアプリバッジを更新
async function updateCombinedAppBadge() {
  try {
    const chatCount = await readBadgeCount('RebornBadgeDB');
    const todoCount = await readBadgeCount('SystemNotificationDB');
    const packagingCount = await readBadgeCount('PackagingBadgeDB');
    const totalCount = chatCount + todoCount + packagingCount;
    if (navigator.setAppBadge) {
      if (totalCount > 0) {
        await navigator.setAppBadge(totalCount);
        console.log(`[Badge] ✅ setAppBadge(${totalCount}) チャット:${chatCount} + タスク:${todoCount} + 資材:${packagingCount}`);
      } else {
        await navigator.clearAppBadge();
        console.log('[Badge] アプリバッジクリア');
      }
    }
  } catch (err) {
    console.warn('[Badge] ⚠️ 合算バッジ更新失敗:', err);
  }
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
    };

    tx.oncomplete = () => {
      db.close();
      // 🔔 両DBの合算でホーム画面アイコンバッジを設定
      updateCombinedAppBadge();
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  }));
}

// ================================================================================
// 通知音設定の取得（IndexedDB: SettingsDB）
// ================================================================================
function getNotificationSoundSetting() {
  return new Promise((resolve) => {
    const req = indexedDB.open('SettingsDB', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings');
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      try {
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const getReq = store.get('notificationSound');

        getReq.onsuccess = () => {
          const value = getReq.result;
          db.close();
          // 未設定の場合はtrue（デフォルトで音あり）
          resolve(value !== undefined ? value : true);
        };
        getReq.onerror = () => {
          db.close();
          resolve(true); // エラー時はデフォルトで音あり
        };
      } catch (e) {
        db.close();
        resolve(true);
      }
    };
    req.onerror = () => resolve(true); // エラー時はデフォルトで音あり
  });
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
  console.log('[SW v160] Push event received');

  // ペイロード解析
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    console.error('[SW v160] Failed to parse payload:', e);
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

  const title = notification.title || data.title || 'REBORN';
  const body = notification.body || data.body || '新しい通知があります';
  const icon = data.icon || '/icon-180.png';
  const badge = data.badge || '/icon-180.png';
  const link = data.link || '/';
  const messageId = data.messageId;
  const notificationType = data.type || 'chat'; // 'chat' or 'system'
  const userName = data.userName; // システム通知用

  // 🔧 パフォーマンス改善: roomId+messageIdで重複排除（より確実な重複検出）
  const roomId = data.roomId || '';
  const cacheKey = messageId ? `${roomId}_${messageId}` : `${Date.now()}_${Math.random()}`;

  // ================================================================================
  // 🎯 CRITICAL: 全ての非同期処理を event.waitUntil() でラップ
  // ================================================================================
  const promiseChain = (async () => {
    try {
      // 1. キャッシュクリーンアップ + 重複チェック
      pruneCache();
      if (notificationCache.has(cacheKey)) {
        console.log('[SW v160] Duplicate notification, skipping:', cacheKey);
        return;
      }
      notificationCache.set(cacheKey, Date.now());

      // 2. バッジ更新（閲覧中ならスキップ）
      const isViewing = await isAnyClientViewingChat();
      
      if (isViewing) {
        console.log('[Badge] Client is viewing chat, skipping badge increment');
      } else if (notificationType === 'system') {
        console.log('[Badge] System notification: SystemNotificationDB + Firestore');
        await incrementBadge('SystemNotificationDB');
        await updateFirestoreUnreadCount(userName);
      } else {
        console.log('[Badge] Chat notification: RebornBadgeDB');
        await incrementBadge('RebornBadgeDB');
      }

      // 3. 古い通知のクリーンアップ（5件以上で全削除）
      const existingNotifications = await self.registration.getNotifications();
      console.log('[Notification] Existing notifications:', existingNotifications.length);

      if (existingNotifications.length >= 5) {
        for (const n of existingNotifications) {
          n.close();
          console.log('[Notification] Closed old notification:', n.tag);
        }
      }

      // 5. 通知音設定を取得
      const soundEnabled = await getNotificationSoundSetting();
      console.log('[SW] Notification sound setting:', soundEnabled);

      // 6. 新しい通知を表示
      const notificationOptions = {
        body: body,
        icon: icon,
        badge: badge,
        vibrate: soundEnabled ? [200, 100, 200] : [], // 音オフ時はバイブもオフ
        silent: !soundEnabled, // 音オフ時はサイレント通知
        data: {
          url: link,
          messageId: messageId,
          type: notificationType,
          roomId: roomId
        },
        tag: messageId || cacheKey,
        renotify: true
      };

      console.log('[SW v337] Showing notification:', title, 'silent:', !soundEnabled);
      await self.registration.showNotification(title, notificationOptions);

      // 🔧 Pending Navigation: 通知タイプからナビゲーション先を決定して保存
      // iOS PWAではnotificationclickが発火しないことがあるため、
      // pushイベント（確実に発火）の段階でナビゲーション先を保存しておく
      const typePageMap = {
        'chat': 'chat', 'CHAT_MESSAGE': 'chat', 'chat_message': 'chat',
        'CHAT_MENTION': 'chat', 'MENTION': 'chat',
        'incoming_call': 'chat', 'INCOMING_CALL': 'chat',
        'system': 'todo-list', 'pending_user': 'todo-list',
        'task_request': 'todo-list', 'task_completion': 'todo-list',
        'extension_request': 'todo-list',
        'budget_alert': 'announce'
      };
      const pendingPage = typePageMap[notificationType] || '';
      if (pendingPage) {
        await savePendingNavigation(pendingPage, roomId);
        console.log('[SW v337] Saved pending navigation:', pendingPage, 'roomId:', roomId);
      }

      console.log('[SW v337] Push event handled successfully');

    } catch (error) {
      console.error('[SW v160] Error in push handler:', error);
      // エラーでも通知は試みる
      try {
        await self.registration.showNotification('REBORN', {
          body: '通知の処理中にエラーが発生しました',
          icon: '/icon-180.png'
        });
      } catch (e) {
        console.error('[SW v160] Failed to show error notification:', e);
      }
    }
  })();

  // 🎯 CRITICAL: ブラウザにSWの実行完了を保証
  event.waitUntil(promiseChain);
});

// ================================================================================
// クライアントからのメッセージ受信（閲覧中ルームID管理 + バッジクリア）
// ================================================================================
self.addEventListener('message', (event) => {
  const data = event.data || {};

  if (data.type === 'VIEWING_ROOM') {
    if (data.roomId) {
      // グローバル変数として保持（シンプルに1つだけ）
      self._currentViewingRoomId = data.roomId;
      console.log('[SW v160] Client viewing room:', data.roomId);
    } else {
      self._currentViewingRoomId = null;
      console.log('[SW v160] Client left room');
    }
  }

  // 🎯 バッジクリア命令（クライアントからの要求）
  if (data.type === 'CLEAR_BADGE') {
    console.log('[SW v160] Received CLEAR_BADGE command');
    clearAllBadges();
  }

  // 🎯 新バージョンへの即時更新（クライアントからの要求）
  if (data.type === 'SKIP_WAITING') {
    console.log('[SW v160] Received SKIP_WAITING command');
    self.skipWaiting();
  }

  // 🎯 バッジカウント同期（クライアントからの要求）
  // アプリが開かれたときに、IndexedDBのカウントをFirestoreベースの正しい値に同期
  if (data.type === 'SYNC_BADGE_COUNT') {
    console.log('[SW v160] Received SYNC_BADGE_COUNT:', data);
    syncBadgeCounts(data.chatCount || 0, data.todoCount || 0, data.packagingCount || 0);
  }
});

// ================================================================================
// バッジカウント同期処理（クライアントの正しい値に合わせる）
// ================================================================================
async function syncBadgeCounts(chatCount, todoCount, packagingCount) {
  try {
    // RebornBadgeDB（チャット用）をchatCountに設定
    await setBadgeInDB('RebornBadgeDB', chatCount);

    // SystemNotificationDB（やることリスト用）をtodoCountに設定
    await setBadgeInDB('SystemNotificationDB', todoCount);

    // PackagingBadgeDB（資材不足用）をpackagingCountに設定
    await setBadgeInDB('PackagingBadgeDB', packagingCount || 0);

    // ★ アプリバッジも正しい値に更新（重要！）
    const totalCount = chatCount + todoCount + (packagingCount || 0);
    if (navigator.setAppBadge) {
      if (totalCount > 0) {
        await navigator.setAppBadge(totalCount);
        console.log('[SW v160] App badge synced to:', totalCount);
      } else {
        await navigator.clearAppBadge();
        console.log('[SW v160] App badge cleared');
      }
    }

    console.log('[SW v160] Badge counts synced: chat=' + chatCount + ', todo=' + todoCount + ', packaging=' + (packagingCount || 0));
  } catch (err) {
    console.error('[SW v160] Error syncing badge counts:', err);
  }
}

// IndexedDBのバッジカウントを特定の値に設定
function setBadgeInDB(dbName, count) {
  return openDB(dbName).then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('badge', 'readwrite');
    const store = tx.objectStore('badge');
    store.put(count, 'count');

    tx.oncomplete = () => {
      db.close();
      console.log(`[SW v160] ${dbName} count set to ${count}`);
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  })).catch(err => {
    console.error(`[SW v160] Error setting ${dbName}:`, err);
  });
}

// ================================================================================
// バッジクリア処理（SW側で実行）
// ================================================================================
async function clearAllBadges() {
  try {
    // 1. Navigator Badge API（アプリアイコンバッジ）
    if (navigator.clearAppBadge) {
      await navigator.clearAppBadge();
      console.log('[SW v160] App badge cleared via Navigator API');
    }

    // 2. IndexedDB のカウントをリセット（RebornBadgeDB）
    await resetBadgeInDB('RebornBadgeDB');

    // 3. IndexedDB のカウントをリセット（SystemNotificationDB）
    await resetBadgeInDB('SystemNotificationDB');

    // 4. IndexedDB のカウントをリセット（PackagingBadgeDB）
    await resetBadgeInDB('PackagingBadgeDB');

    console.log('[SW v160] All badges cleared successfully');
  } catch (err) {
    console.error('[SW v160] Error clearing badges:', err);
  }
}

// IndexedDBのバッジカウントをリセット
function resetBadgeInDB(dbName) {
  return openDB(dbName).then(db => new Promise((resolve, reject) => {
    const tx = db.transaction('badge', 'readwrite');
    const store = tx.objectStore('badge');
    store.put(0, 'count');

    tx.oncomplete = () => {
      db.close();
      console.log(`[SW v160] ${dbName} count reset to 0`);
      resolve(true);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  })).catch(err => {
    console.error(`[SW v160] Error resetting ${dbName}:`, err);
  });
}

// 閲覧中かどうかをチェック（push受信時に使用）
// 🔧 v351: chat_rooms_list.html、index.htmlも閲覧中と判定（バッジ二重加算防止）
async function isAnyClientViewingChat() {
  try {
    // 方法1: postMessageで受け取ったフラグをチェック
    if (self._currentViewingRoomId) {
      console.log('[SW v160] Client is viewing room (flag):', self._currentViewingRoomId);
      return true;
    }

    // 方法2: フォアグラウンドでアプリページを開いているクライアントを探す
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    // チェック対象のページリスト
    const appPages = [
      'chat_ui_firestore.html',  // チャットルーム
      'chat_rooms_list.html',    // トーク一覧
      'index.html',              // メインアプリ
      '/chat'                    // チャット関連URL
    ];

    for (const client of clientsList) {
      if (client.url) {
        // いずれかのアプリページを開いていれば閲覧中と判定
        const isAppPage = appPages.some(page => client.url.includes(page));
        if (isAppPage) {
          console.log('[SW v160] Found client viewing app (URL):', client.url);
          return true;
        }
      }
    }
  } catch (err) {
    console.error('[SW v160] Error checking clients:', err);
  }
  return false;
}

// ================================================================================
// 通知クリックイベント
// ================================================================================
self.addEventListener('notificationclick', (event) => {
  console.log('[SW v161] Notification clicked');

  event.notification.close();

  // ターゲットページ決定（targetPage > type推定 > ホーム）
  const data = event.notification.data || {};
  let targetPage = data.targetPage || '';

  if (!targetPage) {
    // 通知タイプ → 遷移先ページのマッピング
    // GAS: 'chat', 'system'
    // Firebase Functions: 'CHAT_MESSAGE', 'CHAT_MENTION', 'incoming_call', 'PRODUCT_REGISTERED'
    // PWA/Cloudflare: 'chat_message', 'pending_user', 'task_request', 'task_completion', 'extension_request', 'user_approved'
    const typePageMap = {
      'chat': 'chat',
      'CHAT_MESSAGE': 'chat',
      'chat_message': 'chat',
      'CHAT_MENTION': 'chat',
      'MENTION': 'chat',
      'incoming_call': 'chat',
      'INCOMING_CALL': 'chat',
      'system': 'todo-list',
      'pending_user': 'todo-list',
      'task_request': 'todo-list',
      'task_completion': 'todo-list',
      'extension_request': 'todo-list',
      'budget_alert': 'announce'
    };
    targetPage = typePageMap[data.type] || '';
  }

  console.log('[SW v337] notificationclick targetPage:', targetPage, 'type:', data.type, 'roomId:', data.roomId || 'none');

  // notificationclickが発火した場合、pending navigationをクリア
  // （こちらが直接ナビゲーションを行うため二重遷移を防止）
  clearPendingNavigation();

  const baseUrl = self.location.origin + '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // 既にアプリが開いていればフォーカス + postMessageでナビゲーション指示
        for (let client of clientList) {
          if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
            return client.focus().then(function(c) {
              if (targetPage) {
                c.postMessage({
                  type: 'navigateFromNotification',
                  page: targetPage,
                  roomId: data.roomId || ''
                });
              }
              return c;
            });
          }
        }
        // なければ新しいタブを開く（page付き）
        let openUrl = baseUrl;
        if (targetPage) {
          openUrl += '?page=' + targetPage;
          if (data.roomId) openUrl += '&roomId=' + encodeURIComponent(data.roomId);
        }
        if (clients.openWindow) {
          return clients.openWindow(openUrl);
        }
      })
  );
});

// ================================================================================
// Service Worker インストール
// ================================================================================
self.addEventListener('install', (event) => {
  console.log('[SW v160] Installing...');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW v160] Precaching resources');
        return cache.addAll(PRECACHE_RESOURCES);
      })
      .then(() => {
        console.log('[SW v160] Precache complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW v160] Precache error:', error);
        return self.skipWaiting();
      })
  );
});

// ================================================================================
// Service Worker 有効化
// ================================================================================
self.addEventListener('activate', (event) => {
  console.log('[SW v331] Activating...');

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW v331] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
            // 現在のキャッシュからもindex.htmlを削除（古い残留対策）
            return caches.open(cacheName).then((cache) => {
              return Promise.all([
                cache.delete('/index.html'),
                cache.delete('/')
              ]);
            });
          })
        );
      })
      .then(() => {
        console.log('[SW v331] Activated, claiming clients');
        return self.clients.claim();
      })
  );
});

// ================================================================================
// Fetch イベントハンドラ（キャッシュ戦略）
// ⚠️ 2025-12-12 重要な変更: HTML/JS/CSSはキャッシュを完全にバイパス
// キャッシュ問題の根本解決のため、動的コンテンツはService Workerを通さない
// ================================================================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 同一オリジンのリクエストのみ処理
  if (url.origin !== location.origin) {
    return;
  }

  // API呼び出しはキャッシュしない
  if (url.pathname.includes('/api/') || url.pathname.includes('/exec')) {
    return;
  }

  // ★ ナビゲーション（index.html）: ネットワーク強制取得（cache:no-store）
  // iOS PWAタスクキル後にHTTPキャッシュから古いHTMLが返される問題の根本対策
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .catch(() => {
          // オフライン時: キャッシュがあれば返す
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // その他HTML/JS/CSS: キャッシュを完全にバイパス（SWは介入しない）
  if (url.pathname.endsWith('.html') ||
      url.pathname === '/' ||
      !url.pathname.includes('.') ||
      url.pathname.match(/\.(js|css)$/)) {
    return;
  }

  // 画像: Cache First（長期キャッシュ）- 画像のみキャッシュを使用
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|svg|ico|webp)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) {
          return cached;
        }
        return fetch(event.request).then(response => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, clone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // manifest.json: キャッシュから返す（PWAに必要）
  if (url.pathname === '/manifest.json') {
    event.respondWith(
      caches.match(event.request).then(cached => {
        return cached || fetch(event.request);
      })
    );
    return;
  }
});

// ================================================================================
// Service Worker エラーハンドリング
// ================================================================================
self.addEventListener('error', (event) => {
  console.error('[SW v160] Global error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('[SW v160] Unhandled rejection:', event.reason);
});

console.log('[SW v160] Service Worker loaded successfully');
