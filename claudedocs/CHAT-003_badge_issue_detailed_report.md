# CHAT-003: システム通知バッジ問題 - 詳細技術レポート

## 📋 問題サマリー

**現象:**
- **チャット通知**: 3つのバッジポイント全てで正常動作 ✅
- **システム通知**: 3つのバッジポイント全てで動作しない ❌

**影響範囲:**
iOS/Safari PWA環境で商品登録時のシステム通知がバッジを表示しない

**試した対処:**
- 3台全てでPWA削除→再インストール実施済み
- Service Worker v28 → v29 更新済み
- Cloudflareへのデプロイ完了
- GAS @773 デプロイ済み

---

## 🏗️ システムアーキテクチャ全体図

```
[商品登録] (GAS/product.js)
    ↓
[FCM送信] (GAS/web_push.js)
    type='system'
    ↓
[FCM Push]
    ↓
[Service Worker] (firebase-messaging-sw.js)
    ├─ onBackgroundMessage()
    │   ├─ notificationType = payload.data?.type || 'chat'
    │   └─ if (notificationType === 'system')
    │       ├─ incrementSystemBadgeCount() → IndexedDB (SystemNotificationDB)
    │       └─ updateFirestoreUnreadCount() → Firestore
    └─ [通知表示]

[3つのバッジ表示ポイント]
1. ホーム画面アプリアイコンバッジ
   ← IndexedDB (RebornBadgeDB + SystemNotificationDB)
   ← setAppBadge() API

2. アプリ内ヘッダー💬アイコンバッジ
   ← Firestore: rooms/{roomId}/unreadCounts/{userName}
   ← window.chatUnreadByRoom 集計

3. チャットルーム右端バッジ
   ← Firestore: rooms/{roomId}/unreadCounts/{userName}
   ← 個別表示
```

---

## 📊 3つのバッジポイント詳細

### 1️⃣ ホーム画面アプリアイコンバッジ

**技術:**
- Web API: `navigator.setAppBadge(count)`
- データソース: IndexedDB
  - `RebornBadgeDB` (チャット通知用)
  - `SystemNotificationDB` (システム通知用)

**実装場所:**
- Service Worker: `firebase-messaging-sw.js:224-284`
  - `incrementBadgeCount()` - チャット用
  - `incrementSystemBadgeCount()` - システム用

**動作フロー:**
```javascript
// Service Worker内
if (notificationType === 'system') {
  await incrementSystemBadgeCount();
  // → SystemNotificationDB.getSystemBadgeCount()
  // → RebornBadgeDB.getBadgeCount()
  // → totalCount = chatCount + systemCount
  // → self.registration.setAppBadge(totalCount)
}
```

**チャット通知: 動作する ✅**
**システム通知: 動作しない ❌**

---

### 2️⃣ アプリ内ヘッダー💬アイコンバッジ

**技術:**
- データソース: Firestore
- Collection: `rooms/{roomId}/unreadCounts/{userName}`
- フィールド: `unreadCount` (integer)

**実装場所:**
- PWA: `docs/index.html:1925-1982`
  ```javascript
  // 各ルームの未読をリスニング
  const unreadDocRef = doc(db, `rooms/${roomId}/unreadCounts/${userName}`);
  onSnapshot(unreadDocRef, (snap) => {
    const unreadCount = snap.data()?.unreadCount || 0;
    window.chatUnreadByRoom[roomId] = unreadCount;
    updateTotalUnread(); // 合計を計算してバッジ更新
  });
  ```

**更新方法:**
- チャット通知: `docs/index.html` の `onSnapshot` で自動検知
- システム通知:
  - PWA開いている時: `incrementSystemNotificationUnreadCount()`
  - PWA閉じている時: Cloudflare Worker API `/api/unread/increment`

**チャット通知: 動作する ✅**
**システム通知: 動作しない ❌**

---

### 3️⃣ チャットルーム右端バッジ

**技術:**
- データソース: Firestore (ヘッダーと同じ)
- Collection: `rooms/{roomId}/unreadCounts/{userName}`

**実装場所:**
- PWA: チャットルーム一覧表示時にFirestoreから取得して表示

**更新方法:**
- ヘッダーバッジと同じFirestoreドキュメントを参照

**チャット通知: 動作する ✅**
**システム通知: 動作しない ❌**

---

## 🔄 チャット通知 vs システム通知の比較

### チャット通知フロー (動作する ✅)

```
[ユーザーA] チャット送信
    ↓
[GAS/chat_manager.js:441-524] sendMessageToUsers()
    ↓
[GAS/web_push.js:691] sendFCMToTokenV1()
    type='chat' (デフォルト)
    badgeCount=undefined
    ↓
[FCM Push]
    payload.data.type = 'chat'
    ↓
[Service Worker] firebase-messaging-sw.js:108-116
    notificationType = 'chat'
    ↓
    await incrementBadgeCount()
    → RebornBadgeDB更新
    → setAppBadge() ✅
    ↓
[PWA] docs/index.html
    onSnapshot自動検知
    → Firestore unreadCount自動更新 ✅
    → ヘッダーバッジ更新 ✅
    → ルームバッジ更新 ✅
```

**結果: 3つ全て動作 ✅✅✅**

---

### システム通知フロー (動作しない ❌)

```
[商品登録] product.js:359-490
    ↓
[GAS/web_push.js:691] sendFCMToTokenV1()
    type='system' (明示指定 @773)
    badgeCount=undefined
    ↓
[FCM Push]
    payload.data.type = 'system'
    ↓
[Service Worker] firebase-messaging-sw.js:108-116
    notificationType = 'system'
    ↓
    await incrementSystemBadgeCount()
    → SystemNotificationDB更新を試みる
    → setAppBadge()を呼び出す
    → ❓ 動作しない
    ↓
    await updateFirestoreUnreadCount()
    → PWA開いている場合: postMessage('INCREMENT_SYSTEM_UNREAD')
    → PWA閉じている場合: Cloudflare Worker API呼び出し
    ↓
[PWA] docs/index.html:1669-1673
    message handler for 'INCREMENT_SYSTEM_UNREAD'
    → incrementSystemNotificationUnreadCount()
    → Firestore setDoc() with increment(1)
    → ❓ 動作しない
```

**結果: 3つ全て動作しない ❌❌❌**

---

## 🔍 コード詳細

### Service Worker (firebase-messaging-sw.js)

**バージョン: v29**
**最終更新: @775**

```javascript
// Line 5
const CACHE_VERSION = 'v29';  // @775 修正

// Line 87-116: onBackgroundMessage ハンドラー
messaging.onBackgroundMessage(async (payload) => {
  console.log('[firebase-messaging-sw.js] バックグラウンドメッセージ受信:', payload);

  // 通知の重複チェック（省略）...

  // @773 完全分離: typeに応じて別のバッジシステムを使用
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

  // 通知表示（省略）...
});
```

**incrementSystemBadgeCount() 関数 (Line 263-284):**
```javascript
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
```

**updateFirestoreUnreadCount() 関数 (Line 287-340):**
```javascript
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

      const res = await fetch('https://reborn-webhook.tak45.workers.dev/api/unread/increment', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify(requestBody)
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
    } catch (e) {
      console.error('[sw] server-side unread increment failed:', e);
      console.error('[DEBUG] エラー詳細:', e.message, e.stack);
    }
  } catch (err) {
    console.error('[Firestore] エラー:', err);
  }
}
```

---

### PWA (docs/index.html)

**メッセージハンドラー (Line 1668-1673):**
```javascript
// 🔔 Service Workerからのシステム通知バッジ更新要求
if (event.data.type === 'INCREMENT_SYSTEM_UNREAD') {
  console.log('[Badge] Service Workerからシステム通知バッジ更新要求');
  // システム通知ルームのFirestore unreadCountを+1
  incrementSystemNotificationUnreadCount();
}
```

**incrementSystemNotificationUnreadCount() 関数 (Line 2059-2086):**
```javascript
async function incrementSystemNotificationUnreadCount() {
  console.log('[Badge] システム通知ルームの未読カウント+1開始');

  const userName = localStorage.getItem('reborn_user_name');
  if (!userName) {
    console.error('[Badge] ユーザー名が取得できません');
    return;
  }

  try {
    // 共通Firebaseインスタンスを取得（重複初期化防止）
    const db = await getFirebaseDb();
    const { doc, setDoc, increment } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const systemRoomId = 'room_system_notifications';
    const unreadDocRef = doc(db, `rooms/${systemRoomId}/unreadCounts/${userName}`);

    // Firestore unreadCountを+1（アトミック操作）
    await setDoc(unreadDocRef, {
      unreadCount: increment(1)
    }, { merge: true });

    console.log('[Badge] Firestore unreadCount +1 完了');

  } catch (error) {
    console.error('[Badge] Firestore更新エラー:', error);
  }
}
```

**Firestoreリスナー (Line 1925-1982):**
```javascript
// 未読カウント管理用のグローバル変数を初期化
if (!window.chatUnreadByRoom) window.chatUnreadByRoom = {};

// 未読カウント合計を更新する関数
function updateTotalUnread() {
  const totalUnread = Object.values(window.chatUnreadByRoom).reduce((sum, count) => sum + count, 0);
  console.log('[Chat FAB] 未読カウント合計:', totalUnread, window.chatUnreadByRoom);
  updateChatBadge(totalUnread);
}

// 各ルームをループ
rooms.forEach((room) => {
  const roomId = room.id;
  const userName = localStorage.getItem('reborn_user_name');

  const unreadDocRef = doc(db, `rooms/${roomId}/unreadCounts/${userName}`);

  // リアルタイムリスナー
  onSnapshot(unreadDocRef, (snap) => {
    const unreadCount = snap.data()?.unreadCount || 0;
    console.log(`[Chat FAB] ${roomId} 未読: ${unreadCount}`);

    window.chatUnreadByRoom[roomId] = unreadCount;
    updateTotalUnread();
  });
});
```

---

### GAS (product.js)

**商品登録時のFCM送信 (Line 416-483):**
```javascript
// 🔔 FCM プッシュ通知を送信（チャット通知と同じロジックに統一 @772）
try {
  debugLog('[sendProductRegistrationWebhook] FCM送信開始');

  // 全ユーザー名を取得
  const allUsers = getAllUserNames();
  // 登録者自身を除外
  const targetUsers = allUsers.filter(function(user) {
    return user && user !== userName && user !== 'システム';
  });

  debugLog('[sendProductRegistrationWebhook] FCM送信対象ユーザー: ' + targetUsers.length + '人');

  if (targetUsers.length === 0) {
    debugLog('[sendProductRegistrationWebhook] FCM送信対象ユーザーなし');
  } else {
    // 一意のメッセージIDを生成（チャット通知と同じ）
    const messageId = new Date().getTime() + '_' + Math.random().toString(36).substring(2, 15);
    debugLog('[sendProductRegistrationWebhook] メッセージID: ' + messageId);

    // アクセストークン取得
    if (typeof getAccessToken === 'function') {
      const accessToken = getAccessToken();
      if (!accessToken) {
        debugLog('[sendProductRegistrationWebhook] アクセストークン取得失敗');
      } else {
        let successCount = 0;
        let failCount = 0;

        // 各ユーザーのトークンを取得して送信（チャット通知と同じロジック）
        targetUsers.forEach(function(targetUserName) {
          if (typeof getUserFCMTokens === 'function') {
            const tokens = getUserFCMTokens(targetUserName);

            if (tokens && tokens.length > 0) {
              tokens.forEach(function(token) {
                try {
                  // @773 完全分離: type='system'を明示的に指定
                  const result = sendFCMToTokenV1(accessToken, token, notificationData.title, notificationData.content, messageId, undefined, 'system');
                  if (result.success) {
                    successCount++;
                    debugLog('[sendProductRegistrationWebhook] ✅ 成功: ' + targetUserName);
                    if (typeof updateLastSentTime === 'function') {
                      updateLastSentTime(token);
                    }
                  } else {
                    failCount++;
                    debugLog('[sendProductRegistrationWebhook] ❌ 失敗: ' + targetUserName + ' - ' + (result.error || '不明なエラー'));
                  }
                } catch (error) {
                  failCount++;
                  debugLog('[sendProductRegistrationWebhook] 💥 例外: ' + targetUserName + ' - ' + error);
                }
              });
            } else {
              debugLog('[sendProductRegistrationWebhook] トークンなし: ' + targetUserName);
            }
          }
        });

        debugLog('[sendProductRegistrationWebhook] FCM送信完了: 成功=' + successCount + ', 失敗=' + failCount);
      }
    }
  }
} catch (fcmError) {
  debugLog('[sendProductRegistrationWebhook] FCM送信エラー: ' + fcmError);
  // FCMエラーは致命的ではないので継続
}
```

---

### GAS (web_push.js)

**sendFCMToTokenV1() 関数 (Line 691-821):**
```javascript
function sendFCMToTokenV1(accessToken, token, title, body, messageId, badgeCount, type) {
  const notificationType = type || 'chat'; // デフォルトは'chat'
  try {
    const url = `https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`;

    // 🔧 data のみのペイロード（Service Worker で完全制御）
    // → notification フィールドなし: バックグラウンドでも onBackgroundMessage が呼ばれる
    // → data: title, body, type, messageId 等すべて含む
    // → TTL/Urgency/priority: 即座配信を保証
    // → Service Worker で通知とバッジを完全制御可能
    const message = {
      message: {
        token: token,
        data: {
          title: title,           // Service Worker で通知タイトルに使用
          body: body,             // Service Worker で通知本文に使用
          type: notificationType, // 'chat' または 'system'
          messageId: messageId || '',
          click_action: '/',
          badgeCount: (badgeCount !== undefined && badgeCount !== null) ? String(badgeCount) : '0'
        },
        android: {
          priority: 'HIGH',
          ttl: '30s'
        },
        webpush: {
          headers: {
            TTL: '30',
            Urgency: 'high'
          },
          fcm_options: {
            link: '/'
          }
        }
      }
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      payload: JSON.stringify(message),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log('[sendFCMToTokenV1] Response Code: ' + responseCode);
    Logger.log('[sendFCMToTokenV1] Response Body: ' + responseText);

    // 200が返ってきても、レスポンスボディにエラーが含まれている可能性があるので解析
    if (responseCode === 200) {
      // 成功処理...
      return {
        success: true,
        response: responseText
      };
    } else {
      // エラー処理...
      return {
        success: false,
        error: 'HTTP ' + responseCode + ': ' + responseText
      };
    }
  } catch (error) {
    Logger.log('sendFCMToTokenV1 error: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}
```

---

### Cloudflare Worker (webhook-worker.js)

**postToFirestore() 関数 (Line 136-203):**
```javascript
async function postToFirestore(notificationData, env) {
  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
  const accessToken = await getFirebaseAccessToken(serviceAccount)

  // システム通知ルームID（PWA側と統一）
  const SYSTEM_NOTIFICATION_ROOM_ID = 'room_system_notifications'

  // Firestoreドキュメント作成（PWA側のフラット構造に合わせる）
  const docId = generateDocumentId()
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/messages/${docId}`

  const firestoreDoc = {
    fields: {
      roomId: { stringValue: SYSTEM_NOTIFICATION_ROOM_ID },
      text: { stringValue: notificationData.content },
      userName: { stringValue: notificationData.sender },
      timestamp: { timestampValue: new Date().toISOString() },
      isSystemNotification: { booleanValue: true },
      notificationSent: { booleanValue: false }
    }
  }

  // ✅ メッセージ投稿
  const response = await fetch(firestoreUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(firestoreDoc)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Firestore error: ${error}`)
  }

  // ✅ roomsコレクションのlastMessageを更新
  const roomDocUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/rooms/${SYSTEM_NOTIFICATION_ROOM_ID}`
  const firstLine = notificationData.content.split('\n')[0]

  const roomUpdate = {
    fields: {
      name: { stringValue: '📢 システム通知' },
      type: { stringValue: 'system' },
      icon: { stringValue: '📢' },
      lastMessage: { stringValue: firstLine },
      lastMessageAt: { timestampValue: new Date().toISOString() },
      lastMessageBy: { stringValue: notificationData.sender }
    }
  }

  const roomResponse = await fetch(roomDocUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(roomUpdate)
  })

  if (!roomResponse.ok) {
    console.error('Failed to update room lastMessage:', await roomResponse.text())
    // roomsコレクション更新失敗は致命的ではないのでエラーにしない
  }

  // ❌ Missing: rooms/{roomId}/unreadCounts/{userName} update
  return response.json()
}
```

**handleUnreadIncrement() 関数 (Line 322-415):**
```javascript
async function handleUnreadIncrement(request, env) {
  try {
    // POSTのみ受理
    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405)
    }

    // リクエストボディ取得
    const body = await request.json()
    const { roomId, userName, delta } = body

    // パラメータ検証
    if (!roomId || !userName || !delta) {
      return jsonResponse({
        success: false,
        error: 'Missing required parameters: roomId, userName, delta'
      }, 400)
    }

    console.log(`[UnreadIncrement] roomId=${roomId}, userName=${userName}, delta=${delta}`)

    // Service Account取得
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)

    // Access Token取得
    const accessToken = await getFirebaseAccessToken(serviceAccount)

    // Firestore unreadCount を increment
    const unreadDocUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/rooms/${roomId}/unreadCounts/${userName}`

    // 🔧 修正: まず現在値をGETで取得（PATCHでリセットしない）
    const getResponse = await fetch(unreadDocUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    let currentCount = 0
    let newCount = delta

    if (getResponse.ok) {
      // ドキュメントが存在する場合、現在値を取得
      const currentDoc = await getResponse.json()
      currentCount = parseInt(currentDoc.fields?.unreadCount?.integerValue || '0')
      newCount = currentCount + delta
      console.log(`[UnreadIncrement] 現在値: ${currentCount}, 加算: ${delta}, 新規値: ${newCount}`)
    } else if (getResponse.status === 404) {
      // ドキュメントが存在しない場合、deltaをそのまま新規値とする
      console.log(`[UnreadIncrement] ドキュメント未存在、新規作成: ${newCount}`)
    } else {
      const error = await getResponse.text()
      throw new Error(`Firestore GET failed: ${error}`)
    }

    // 新しい値でPATCH（作成または更新）
    const updateResponse = await fetch(unreadDocUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          unreadCount: {
            integerValue: newCount.toString()
          }
        }
      })
    })

    if (!updateResponse.ok) {
      const error = await updateResponse.text()
      throw new Error(`Firestore PATCH failed: ${error}`)
    }

    console.log(`[UnreadIncrement] 更新成功: ${currentCount} → ${newCount}`)

    return jsonResponse({
      success: true,
      message: 'UnreadCount incremented',
      previous: currentCount,
      current: newCount
    })

  } catch (error) {
    console.error('[UnreadIncrement] Error:', error)
    return jsonResponse({
      success: false,
      error: error.message
    }, 500)
  }
}
```

---

## 📝 修正履歴

### @773 - 完全分離: チャットとシステムで独立したバッジシステム実装

**実装内容:**
- Service Worker v27で `SystemNotificationDB` 新規作成
- `incrementSystemBadgeCount()` 追加（システム通知専用）
- type分岐: `type='system'` → `SystemNotificationDB`使用
- type分岐: `type='chat'` → `RebornBadgeDB`使用（従来通り）
- アプリバッジは両方の合計を表示

**結果:** バッジ動作せず ❌

---

### @774 - PWA状態に関係なくService Worker内で直接バッジ更新

**根本原因:**
- Service Worker v27では、PWAが開いている場合にpostMessageでPWA側にバッジ更新を委譲
- しかし、PWA側（docs/index.html）のメッセージハンドラーがコメントアウトされていた
- 結果：PWAが開いている状態ではバッジが増加しない

**修正内容:**
- Service Worker v28で postMessage方式を完全廃止
- `incrementBadgeCount()`: PWA状態チェックを削除、常に`setAppBadge()`を直接呼び出し
- `incrementSystemBadgeCount()`: PWA状態チェックを削除、常に`setAppBadge()`を直接呼び出し

**結果:** バッジ動作せず ❌

---

### @775 - システム通知でFirestore unreadCount更新追加（全3バッジポイント対応）

**根本原因:**
- Service Worker v28では、システム通知で`incrementSystemBadgeCount()`のみを呼び出し
- これによりIndexedDB（SystemNotificationDB）→ アプリアイコンバッジは更新される（はず）
- しかし、Firestore unreadCountが更新されないため、ヘッダーバッジとルームバッジが機能しない

**修正内容:**
- Service Worker v29でシステム通知処理に`updateFirestoreUnreadCount()`呼び出しを追加
```javascript
if (notificationType === 'system') {
  await incrementSystemBadgeCount();      // IndexedDB → アプリアイコンバッジ
  await updateFirestoreUnreadCount();     // Firestore → ヘッダー & ルームバッジ
}
```

**結果:** 3台全てでPWA再インストール後もバッジ動作せず ❌

---

## 🤔 問題分析

### なぜチャット通知は動作してシステム通知は動作しないのか？

**仮説1: IndexedDB SystemNotificationDB が実際に更新されていない**
- `incrementSystemBadgeCount()` の処理が失敗している
- IndexedDBへの書き込み権限の問題
- Service Worker v29が実際には読み込まれていない

**仮説2: Firestore unreadCount更新が失敗している**
- `updateFirestoreUnreadCount()` の処理が失敗している
- PWA開いている時: postMessage が届いていない
- PWA閉じている時: Cloudflare Worker API呼び出しが失敗している
- IndexedDBから userName が取得できていない

**仮説3: type='system' が正しく伝播していない**
- FCMペイロードで `payload.data.type` が 'system' になっていない
- Service Worker側で `notificationType` が 'chat' と判定されている
- チャット通知のパスに流れている

**仮説4: setAppBadge() API自体が動作していない**
- iOS/Safari PWAでの `setAppBadge()` の制約
- SystemNotificationDBとRebornBadgeDBの合計計算ロジックの問題
- PWAのmanifest.jsonの設定不備

**仮説5: チャット通知とシステム通知でFCMペイロードに違いがある**
- チャット通知: `badgeCount` フィールドが設定されている（値は様々）
- システム通知: `badgeCount=undefined` → ペイロードで '0' になる
- この違いがService Worker側の処理に影響している

---

## 🛠️ デバッグ推奨手順

### 1. Service Worker バージョン確認
PWAを開いて、開発者ツールのコンソールで:
```javascript
navigator.serviceWorker.controller?.scriptURL
```

期待値: `firebase-messaging-sw.js` (v29)

---

### 2. FCMペイロード確認
商品登録時のService Workerコンソールログで確認:
```
[DEBUG] payload.data: { title: "...", body: "...", type: "system", ... }
[DEBUG] notificationType: system
```

期待値: `type: "system"` が正しく設定されている

---

### 3. バッジ更新ログ確認
システム通知受信時のログ:
```
[Badge] システム通知: SystemNotificationDB + Firestore unreadCount更新
[SystemBadge] カウント更新: chat=X, system=Y→Z, total=A
[sw] asked client to increment system unread
```

期待値: 両方の関数が呼ばれている

---

### 4. PWAメッセージ受信確認
PWA開いている状態で商品登録:
```
[Badge] Service Workerからシステム通知バッジ更新要求
[Badge] システム通知ルームの未読カウント+1開始
[Badge] Firestore unreadCount +1 完了
```

期待値: postMessageが届いてFirestore更新が完了

---

### 5. Cloudflare Worker API確認
PWA閉じている状態で商品登録:
```
[DEBUG] Cloudflare Worker リクエスト: {roomId: "room_system_notifications", userName: "XXX", delta: 1}
[DEBUG] Cloudflare Worker レスポンスステータス: 200
[DEBUG] Cloudflare Worker 成功レスポンス: {success: true, ...}
```

期待値: API呼び出しが成功している

---

### 6. IndexedDB確認
開発者ツールのApplicationタブ → IndexedDB:
- `RebornBadgeDB` → `badge` → `badgeCount` の値
- `SystemNotificationDB` → `badge` → `badgeCount` の値

期待値: システム通知後に `SystemNotificationDB.badgeCount` が増加

---

### 7. Firestore確認
Firebaseコンソール → Firestore Database:
- `rooms/room_system_notifications/unreadCounts/{userName}`
- フィールド: `unreadCount`

期待値: システム通知後に `unreadCount` が増加

---

## 💡 代替アプローチ提案

### アプローチ1: システム通知をチャット通知と完全に同じ仕組みにする

**概要:**
システム通知もチャット通知と同じ `type='chat'` (デフォルト) に戻し、RebornBadgeDBを使用する。

**メリット:**
- チャット通知は動作しているので、同じ仕組みなら確実に動く
- コードがシンプルになる

**デメリット:**
- チャットとシステムの分離ができない
- システム通知のバッジクリア操作がチャット全体に影響する

**実装:**
```javascript
// product.js:454 - type指定を削除
const result = sendFCMToTokenV1(accessToken, token, notificationData.title, notificationData.content, messageId);
// type='system' を渡さない → デフォルトで 'chat' になる
```

---

### アプローチ2: システム通知専用のバッジシステムを完全に削除

**概要:**
- アプリアイコンバッジ: チャット通知のみで管理
- ヘッダー・ルームバッジ: Firestore統合管理
- システム通知は通知のみでバッジは更新しない

**メリット:**
- 複雑性が大幅に減少
- チャット機能に影響を与えない

**デメリット:**
- システム通知のバッジがなくなる（要件を満たさない）

**実装:**
```javascript
// Service Worker v30
if (notificationType === 'system') {
  // バッジ更新をスキップ
  console.log('[Badge] システム通知: バッジ更新なし');
} else {
  await incrementBadgeCount();
}
```

---

### アプローチ3: システム通知を通常のチャットルームとして扱う

**概要:**
システム通知専用のチャットルーム `room_system_notifications` を作成し、通常のチャット通知と同じフローに乗せる。

**メリット:**
- 既存のチャット機能を100%再利用
- バッジ、未読管理、メッセージ表示が全て自動で動作

**デメリット:**
- システム通知が「チャット」として扱われる（UI/UX的に違和感）

**実装:**
```javascript
// product.js:454 - チャット送信関数を呼び出す
const systemRoomId = 'room_system_notifications';
const result = sendMessageToUsers(accessToken, [targetUserName], notificationData.title, notificationData.content, systemRoomId);
// sendFCMToTokenV1() の代わりに sendMessageToUsers() を使用
```

---

### アプローチ4: GAS側でFirestore unreadCountを直接更新

**概要:**
FCM送信後、GAS側から直接Firestore REST APIで `rooms/{roomId}/unreadCounts/{userName}` を更新する。

**メリット:**
- Service Worker/PWAの複雑なロジックに依存しない
- 確実にFirestoreが更新される

**デメリット:**
- GASのFirestore REST API呼び出しに時間がかかる
- 各ユーザーごとにAPI呼び出しが必要（コスト増）

**実装:**
```javascript
// product.js内に新規関数追加
function updateFirestoreUnreadCountForUser(userName, roomId) {
  const accessToken = getFirebaseAccessToken(); // 要実装
  const url = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/rooms/${roomId}/unreadCounts/${userName}`;

  // GET current value
  // PATCH with increment
  // ...
}

// 各ユーザーへのFCM送信後に呼び出し
targetUsers.forEach(function(targetUserName) {
  // FCM送信...
  updateFirestoreUnreadCountForUser(targetUserName, 'room_system_notifications');
});
```

---

### アプローチ5: アプリアイコンバッジのみ対応（ヘッダー・ルームバッジは諦める）

**概要:**
- アプリアイコンバッジ: `setAppBadge()` で対応
- ヘッダー・ルームバッジ: システム通知では表示しない

**メリット:**
- Firestore更新の複雑性を回避
- IndexedDBのみで完結

**デメリット:**
- ヘッダー・ルームバッジが動作しない（要件を部分的に満たさない）

**実装:**
```javascript
// Service Worker v30
if (notificationType === 'system') {
  await incrementSystemBadgeCount(); // IndexedDBのみ
  // updateFirestoreUnreadCount() を呼ばない
}
```

---

### アプローチ6: デバッグモード強化版Service Workerをデプロイ

**概要:**
すべての処理ステップで詳細なコンソールログを出力するバージョンをデプロイし、実際にどこで失敗しているかを特定する。

**メリット:**
- 根本原因を確実に特定できる
- 推測ではなく事実に基づいて修正できる

**デメリット:**
- デバッグに時間がかかる
- ユーザーに協力を依頼する必要がある

**実装:**
```javascript
// Service Worker v30-debug
if (notificationType === 'system') {
  console.log('[DEBUG-1] システム通知開始');

  console.log('[DEBUG-2] incrementSystemBadgeCount呼び出し前');
  await incrementSystemBadgeCount();
  console.log('[DEBUG-3] incrementSystemBadgeCount呼び出し後');

  console.log('[DEBUG-4] updateFirestoreUnreadCount呼び出し前');
  await updateFirestoreUnreadCount();
  console.log('[DEBUG-5] updateFirestoreUnreadCount呼び出し後');
}

// incrementSystemBadgeCount内
async function incrementSystemBadgeCount() {
  console.log('[DEBUG-6] incrementSystemBadgeCount内部開始');
  try {
    if ('setAppBadge' in self.registration) {
      console.log('[DEBUG-7] setAppBadge API利用可能');

      console.log('[DEBUG-8] getBadgeCount呼び出し前');
      const chatCount = await getBadgeCount();
      console.log('[DEBUG-9] chatCount:', chatCount);

      console.log('[DEBUG-10] getSystemBadgeCount呼び出し前');
      const systemCount = await getSystemBadgeCount();
      console.log('[DEBUG-11] systemCount:', systemCount);

      const newSystemCount = systemCount + 1;
      console.log('[DEBUG-12] newSystemCount:', newSystemCount);

      console.log('[DEBUG-13] setSystemBadgeCount呼び出し前');
      await setSystemBadgeCount(newSystemCount);
      console.log('[DEBUG-14] setSystemBadgeCount呼び出し後');

      const totalCount = chatCount + newSystemCount;
      console.log('[DEBUG-15] totalCount:', totalCount);

      console.log('[DEBUG-16] setAppBadge呼び出し前');
      await self.registration.setAppBadge(totalCount);
      console.log('[DEBUG-17] setAppBadge呼び出し後 - 成功');
    } else {
      console.warn('[DEBUG-18] setAppBadge API not supported');
    }
  } catch (err) {
    console.error('[DEBUG-19] エラー発生:', err);
    console.error('[DEBUG-20] エラースタック:', err.stack);
  }
}
```

---

## 🎯 推奨アプローチ

### 優先順位付け

1. **最優先: アプローチ6（デバッグモード強化版）**
   - 根本原因を特定しないと何をしても解決しない
   - 詳細ログで実際に何が起きているか確認

2. **次善策: アプローチ1（チャット通知と同じ仕組み）**
   - チャットは動作している実績がある
   - 最も確実に動作する可能性が高い

3. **代替案: アプローチ3（システム通知をチャットルームとして扱う）**
   - 既存機能の再利用で確実性が高い
   - UI/UX的には調整が必要

4. **妥協案: アプローチ5（アプリアイコンバッジのみ）**
   - 最低限の機能を確保
   - ヘッダー・ルームバッジは諦める

---

## 📌 次のステップ提案

### ステップ1: デバッグログ収集

Service Worker v30-debug をデプロイして、以下のログを収集:
1. `payload.data` の内容
2. `notificationType` の値
3. `incrementSystemBadgeCount()` の各ステップ
4. `updateFirestoreUnreadCount()` の各ステップ
5. IndexedDB読み書きの結果
6. Cloudflare Worker API呼び出しの結果

### ステップ2: 根本原因の特定

収集したログから以下を確認:
- どの関数が呼ばれていないか
- どの処理で例外が発生しているか
- IndexedDB/Firestoreの実際の値

### ステップ3: 的確な修正

根本原因に基づいて、以下のいずれかを実施:
- コードバグの修正
- アーキテクチャの変更（代替アプローチ採用）
- iOS/Safari PWAの制約に対応した実装変更

---

## 📊 技術スタック情報

- **PWA**: Cloudflare Pages
- **Service Worker**: firebase-messaging-sw.js (v29)
- **GAS**: @773 デプロイ済み
- **Cloudflare Worker**: webhook-worker.js (vac9d560e)
- **Firestore**: Firebase (プロジェクトID: `${FIREBASE_PROJECT_ID}`)
- **FCM**: Firebase Cloud Messaging v1 API
- **IndexedDB**: RebornBadgeDB, SystemNotificationDB
- **環境**: iOS/Safari PWA (3台でテスト済み)

---

## 🔗 関連ファイル

- `docs/firebase-messaging-sw.js` (Service Worker v29)
- `docs/index.html` (PWA メインファイル)
- `product.js` (商品登録・システム通知送信)
- `web_push.js` (FCM送信処理)
- `cloudflare-workers/webhook-worker.js` (Webhook処理)
- `.clasp-current-version.txt` (デプロイ履歴)
- `docs/issues.md` (Issue詳細)
- `docs/issues-summary.md` (Issueサマリー)

---

**作成日時:** 2025-11-10
**Issue ID:** CHAT-003
**ステータス:** 未解決（3回の修正試行後も動作せず）
**優先度:** 高
