# システム通知バッジ問題 - 現状まとめ（ChatGPT報告用）

## 📊 現在の動作状況

### ✅ チャット通知（完全動作）
| 状態 | 通知 | バッジ |
|------|------|--------|
| PWA開いている | ✅ | ✅ |
| PWA閉じている | ✅ | ✅ |

### ⚠️ システム通知（部分的動作）
| 状態 | 通知 | バッジ |
|------|------|--------|
| PWA開いている | ✅ | ❌ |
| PWA閉じている | ✅ | ❌ |

**問題**: システム通知のバッジだけが増加しない

---

## 🔧 実施済み修正

### 修正1: FCM payload修正（@769）
**ファイル**: `web_push.js` - `sendFCMToTokenV1()`

**変更内容**:
- `notification` フィールドを削除
- `title`, `body` を `data` フィールドに移動
- `type: 'system'` を data に含める

**修正前**:
```javascript
message: {
  token: token,
  notification: {
    title: title,
    body: body
  },
  data: {
    type: notificationType, // 'chat' または 'system'
    messageId: messageId || '',
    ...
  }
}
```

**修正後**:
```javascript
message: {
  token: token,
  data: {
    title: title,           // Service Worker で使用
    body: body,             // Service Worker で使用
    type: notificationType, // 'chat' または 'system'
    messageId: messageId || '',
    ...
  }
}
```

**効果**: PWA閉じている時も `onBackgroundMessage` が呼ばれるようになった
**結果**: チャット通知は完全動作、システム通知は通知のみ動作

---

### 修正2: Cloudflare Worker increment実装修正
**ファイル**: `cloudflare-workers/webhook-worker.js` - `handleUnreadIncrement()`

**問題**: 常に unreadCount を 0 にリセットしてから加算していた

**修正前のフロー**:
1. PATCH で `integerValue: '0'` を送信（リセット）
2. レスポンスから値を取得（常に0）
3. 0 + delta を計算
4. 再度 PATCH（常に delta の値のみになる）

**修正後のフロー**:
1. GET で現在値を取得
2. 現在値 + delta を計算
3. PATCH で新しい値を設定

**デプロイ**: Cloudflare Worker v49c79efe

**期待効果**: システム通知バッジが正しく増加する
**実際の結果**: まだバッジが増加しない ❌

---

## 🔍 技術的な実装詳細

### FCM送信（GAS側）
**ファイル**: `product.js` (商品登録時)

```javascript
// line 419
const fcmResult = sendFCMNotification(notificationData.title, notificationData.content, 'system');
```

**ファイル**: `web_push.js` - `sendFCMNotification()`

```javascript
// line 588-650
function sendFCMNotification(title, body, type) {
  const notificationType = type || 'chat'; // デフォルトは'chat'

  // 中略...

  // line 645: typeを渡す
  const result = sendFCMToTokenV1(accessToken, token, title, body, undefined, undefined, notificationType);
}
```

**ファイル**: `web_push.js` - `sendFCMToTokenV1()`

```javascript
// line 691-711
function sendFCMToTokenV1(accessToken, token, title, body, messageId, badgeCount, type) {
  const notificationType = type || 'chat'; // デフォルトは'chat'

  const message = {
    message: {
      token: token,
      data: {
        title: title,
        body: body,
        type: notificationType, // ← ここで 'system' が渡される
        messageId: messageId || '',
        click_action: '/',
        badgeCount: (badgeCount !== undefined && badgeCount !== null) ? String(badgeCount) : '0'
      },
      // notification フィールドなし（削除済み）
    }
  };
}
```

---

### Service Worker（PWA側）
**ファイル**: `docs/firebase-messaging-sw.js` (v24 - debug logs付き)

```javascript
// line 45-51: ペイロード取得
const notificationTitle = payload.notification?.title || payload.data?.title || 'REBORN';
const notificationBody = payload.notification?.body || payload.data?.body || 'テスト通知です';
const notificationIcon = payload.data?.icon || '/icon-180.png';
const notificationBadge = payload.data?.badge || '/icon-180.png';
const notificationLink = payload.data?.click_action || payload.data?.link || '/';
const messageId = payload.data?.messageId || '';

// line 98-109: type検出とバッジ処理
const notificationType = payload.data?.type || 'chat';
console.log('[DEBUG] payload.data:', payload.data);
console.log('[DEBUG] notificationType:', notificationType);
console.log('[DEBUG] notificationType === "system":', notificationType === 'system');

if (notificationType === 'system') {
  console.log('[DEBUG] システム通知と判定 → updateFirestoreUnreadCount()を呼び出します');
  await updateFirestoreUnreadCount();
} else {
  console.log('[DEBUG] チャット通知と判定 → updateFirestoreUnreadCount()をスキップ');
}

// line 112: バッジカウント増加（全通知共通）
await incrementBadgeCount();
```

**ファイル**: `docs/firebase-messaging-sw.js` - `updateFirestoreUnreadCount()`

```javascript
// line 211-249
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
    if (!userName) {
      console.error('[sw] userName not found in IndexedDB');
      return;
    }

    try {
      const roomId = 'room_system_notifications';
      const res = await fetch('https://reborn-webhook.tak45.workers.dev/api/unread/increment', {
        method: 'POST',
        headers: {
          'content-type': 'application/json'
        },
        body: JSON.stringify({ roomId, userName, delta: 1 })
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`Worker returned ${res.status}: ${errorText}`);
      }

      const result = await res.json();
      console.log('[sw] server-side unread increment OK:', result);
    } catch (e) {
      console.error('[sw] server-side unread increment failed:', e);
    }
  } catch (err) {
    console.error('[Firestore] エラー:', err);
  }
}
```

---

### Cloudflare Worker（バックエンド）
**ファイル**: `cloudflare-workers/webhook-worker.js` - `handleUnreadIncrement()`

```javascript
// line 319-399
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
      data: { oldCount: currentCount, newCount: newCount }
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

## 🔍 デバッグ情報が必要な箇所

### 1. Service Worker Debug Logs
**確認場所**: F12 → Console（PWA閉じた状態でシステム通知受信時）

**期待されるログ**:
```
[DEBUG] payload.data: {title: "...", body: "...", type: "system", ...}
[DEBUG] notificationType: system
[DEBUG] notificationType === "system": true
[DEBUG] システム通知と判定 → updateFirestoreUnreadCount()を呼び出します
[sw] userName not found in IndexedDB  ← または
[sw] server-side unread increment OK: {...}  ← または
[sw] server-side unread increment failed: ...
```

**実際のログ**: （未確認）

### 2. Cloudflare Worker Logs
**確認場所**: Cloudflare Dashboard → Workers → reborn-webhook-worker → Logs

**期待されるログ**:
```
[UnreadIncrement] roomId=room_system_notifications, userName=オーナー, delta=1
[UnreadIncrement] 現在値: 0, 加算: 1, 新規値: 1
[UnreadIncrement] 更新成功: 0 → 1
```

**実際のログ**: （未確認）

### 3. IndexedDB確認
**確認場所**: F12 → Application → Storage → IndexedDB → RebornUserDB → user

**期待される値**:
- key: `userName`
- value: `オーナー` または `スタッフ` または `外注`

**実際の値**: （未確認）

---

## 🤔 考えられる原因

### 仮説1: type が 'system' として渡されていない
- GAS側で `'system'` を渡しているが、FCM経由で正しく届いていない可能性
- **確認方法**: Service Worker debug logs

### 仮説2: IndexedDB に userName が保存されていない
- Service Workerが userName を取得できず、Cloudflare Workerに到達していない
- **確認方法**: F12 → Application → IndexedDB 確認

### 仮説3: Cloudflare Workerに到達していない
- `updateFirestoreUnreadCount()` が失敗している
- ネットワークエラーまたはCORSエラー
- **確認方法**: F12 → Network タブ、Cloudflare Worker logs

### 仮説4: Firestoreの更新は成功しているが、PWAが読み取れていない
- バッジの表示ロジックが Firestore を正しく参照していない
- チャット通知と異なる経路でバッジを表示する必要がある
- **確認方法**: Firestore Console で `rooms/room_system_notifications/unreadCounts` を確認

### 仮説5: incrementBadgeCount() が動作していない
- チャット通知では動作しているが、システム通知では動作しない理由が不明
- **確認方法**: Service Worker debug logs

---

## 📋 次のデバッグステップ（推奨）

1. **Service Worker Logs確認**
   - PWAを閉じた状態で商品登録
   - F12 → Console で `[DEBUG]` ログを確認
   - `type: 'system'` が正しく渡されているか確認

2. **IndexedDB確認**
   - F12 → Application → IndexedDB → RebornUserDB
   - `userName` が正しく保存されているか確認

3. **Network確認**
   - F12 → Network タブ
   - `/api/unread/increment` へのリクエストが発生しているか確認
   - レスポンスが成功しているか確認

4. **Cloudflare Worker Logs確認**
   - Cloudflare Dashboard でログ確認
   - increment処理が実行されているか確認

5. **Firestore直接確認**
   - Firebase Console → Firestore
   - `rooms/room_system_notifications/unreadCounts/{userName}` の値を確認
   - 値が増加しているか確認

---

## 🎯 質問（ChatGPT向け）

1. システム通知のバッジが増加しない根本原因は何が考えられますか？

2. チャット通知は動作しているのに、システム通知のバッジだけ動作しない理由は？

3. Service Worker の `incrementBadgeCount()` は全通知共通で呼ばれているはずですが、なぜシステム通知だけバッジが増えないのでしょうか？

4. デバッグのために確認すべき優先順位の高いポイントはどこですか？

5. 現在の実装で見落としている可能性のある箇所はありますか？

---

**作成日**: 2025-11-09
**バージョン**: GAS @769, Cloudflare Worker v49c79efe, PWA Service Worker v24
