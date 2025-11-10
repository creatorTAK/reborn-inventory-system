# FCM通知が3-4回で停止する問題の調査依頼

## 技術スタック
- **Frontend**: PWA (Progressive Web App)
- **Backend**: Google Apps Script (GAS)
- **Push通知**: Firebase Cloud Messaging (FCM) v1 API
- **Service Worker**: firebase-messaging-sw.js
- **Database**:
  - Firestore (メッセージ、バッジカウント)
  - IndexedDB (ローカルバッジカウント)
- **Webhook**: Cloudflare Workers

## 問題の症状

### 明確な再現パターン
**1台の端末につき3-4回までしか通知が届かない**

- **通知1-3回目**: ✅ FCMプッシュ通知が届く + バッジ増加 + メッセージ表示
- **通知4回目以降**: ❌ FCMプッシュ通知が届かない / ✅ バッジは増加 / ✅ メッセージは表示される

### 重要な観察事項
1. **Firestoreへの書き込みは常に成功**
   - メッセージは全て正常にFirestoreに保存される
   - バッジカウント（unreadCount）も正常に更新される
   - PWA側でメッセージとバッジは全て正常に表示される

2. **FCM API自体は成功している**
   - GASログでFCM API Response Code: 200を確認
   - FCM APIは正常にリクエストを受け付けている
   - エラーメッセージなし

3. **タスクキルで復活**
   - アプリのタスクキル（完全終了）後は通知が再び届くようになる
   - PWA削除→再インストールでも復活
   - Service Workerの状態リセットで復活する

4. **端末ごとに独立したカウント**
   - 端末Aで3-4回制限に達しても、端末Bは独立して動作
   - 各端末で3-4回ずつ通知が届く

## GASのFCM送信コード（抜粋）

```javascript
function sendFCMToTokenV1(token, payload) {
  const url = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

  const message = {
    message: {
      token: token,
      notification: {
        title: payload.title,
        body: payload.body
      },
      data: payload.data || {},
      webpush: {
        fcm_options: {
          link: payload.link || 'https://reborn-tak45.pages.dev/'
        }
      }
    }
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + getAccessToken(),
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(message)
  });

  console.log('[sendFCMToTokenV1] Response Code:', response.getResponseCode());
  // → 常に200を返す
}
```

## Service Workerの通知受信処理（現在のコード v31）

```javascript
messaging.onBackgroundMessage(async (payload) => {
  const messageId = payload.data?.messageId;
  const cacheKey = messageId || `${Date.now()}_${Math.random()}`;

  // 重複チェック
  if (notificationCache.has(cacheKey)) {
    return;
  }
  notificationCache.set(cacheKey, Date.now());

  // キャッシュクリーンアップ（Phase 1対策）
  const now = Date.now();
  for (const [key, timestamp] of notificationCache.entries()) {
    if (now - timestamp > 2000) {
      notificationCache.delete(key);
    }
  }
  if (notificationCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = notificationCache.keys().next().value;
    notificationCache.delete(oldestKey);
  }

  // バッジ更新（IndexedDB操作 × 5回）
  await incrementBadgeCount(); // or incrementSystemBadgeCount()
  await updateFirestoreUnreadCount(); // Cloudflare Worker経由

  // Phase 2対策: 古い通知をクリア
  const existingNotifications = await self.registration.getNotifications();
  if (existingNotifications.length >= 2) {
    for (const notification of existingNotifications) {
      notification.close();
    }
  }

  // 通知表示
  await self.registration.showNotification(notificationTitle, notificationOptions);

  // ACK送信（5秒タイムアウト付き）
  if (messageId) {
    sendAck(messageId);
  }
});
```

## これまでの対策と結果

### Phase 1: キャッシュ＋タイムアウト対策（v30）
**実装内容:**
- notificationCacheのサイズ制限（最大100件）
- ACK送信のタイムアウト（5秒）
- Firestore更新のタイムアウト（5秒）

**結果:** ❌ 改善なし（依然として3-4回で停止）

### Phase 2: 通知自動クリーンアップ（v31）
**実装内容:**
- showNotification()前にgetNotifications()で既存通知を取得
- 2件以上ある場合、全ての古い通知をclose()

**結果:** 🔄 テスト中（この後テスト予定）

## 疑問点

1. **なぜ正確に3-4回なのか？**
   - ブラウザの通知表示数制限？
   - Service Workerのメモリ制限？
   - FCMのレート制限？
   - IndexedDBの処理キュー？

2. **FCM APIが200を返すのに端末に届かない**
   - FCM → デバイス間で何が起きているのか？
   - ブラウザがプッシュイベントを受信していない？
   - Service Workerがイベントを処理できていない？

3. **タスクキルで復活する理由**
   - Service Worker状態のリセットで何が解放される？
   - メモリ？キュー？リソース？

## 環境情報
- **ブラウザ**: Chrome/Safari (PWA)
- **デバイス**: iOS/Android（具体的なバージョン不明）
- **Service Worker**: firebase-messaging-sw.js v31
- **Firebase SDK**: firebase-messaging@9.x

## 質問
この「3-4回で確実に停止する」という症状は既知の問題でしょうか？
もしそうであれば、根本原因と確実な解決策を教えてください。

特に知りたいこと：
- ブラウザのプッシュ通知に関する制限事項
- Service Workerのリソース制限
- FCMのベストプラクティス
- IndexedDB操作が通知受信に与える影響
