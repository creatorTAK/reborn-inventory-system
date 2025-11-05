# NOTIF-004: 7回目通知失敗問題 - 詳細分析レポート

**作成日**: 2025-11-05
**優先度**: 🔴 最高
**状態**: 🔄 調査中

---

## 📋 症状サマリー

### 基本症状
- **FCMプッシュ通知が7回目で必ず止まる**（再現性100%）
- バッジカウントが**4以上にならない**（最大3で停止）
- バッジをクリア（0にリセット）すると、また1〜6回は届く
- その後、再び7回目で停止

### 環境
- **フロントエンド**: PWA（Cloudflare Pages）
- **バックエンド**: Google Apps Script
- **通知**: Firebase Cloud Messaging (FCM) HTTP v1 API
- **Service Worker**: firebase-messaging-sw.js
- **テスト環境**: Android端末2台（携帯回線あり）

---

## 🔬 再現手順

1. PWAをホーム画面にインストール（アプリ削除→再設定済み）
2. チャット画面からテスト通知を送信
3. 1〜6回目: 通知とバッジが正常に届く（バッジ: 1→2→3）
4. **7回目: 通知もバッジも届かない**
5. 8回目以降: すべて届かない
6. ベルマークボタンでバッジをクリア（0にリセット）
7. 再度テスト → また1〜6回は届く → 7回目で停止

**再現性**: 100%（複数回確認済み）

---

## 📊 技術的詳細

### アーキテクチャ

```
[GAS] sendFcmMessage()
  ↓ FCM HTTP v1 API
[FCM Server]
  ↓ Push
[PWA] firebase-messaging-sw.js (Service Worker)
  ↓ onBackgroundMessage
  1. notificationCache チェック（重複防止）
  2. incrementBadgeCount() 実行
  3. showNotification() 実行
  4. sendAck() 実行（ACKシステム）
```

### 現在の実装（v13）

**firebase-messaging-sw.js の主要ロジック:**

```javascript
// グローバル変数
const notificationCache = new Map();  // タイムスタンプ付きキャッシュ

messaging.onBackgroundMessage((payload) => {
  const messageId = payload.data?.messageId || '';
  const now = Date.now();

  // 🧹 古いキャッシュをクリーンアップ（2秒以上前のエントリを削除）
  for (const [key, timestamp] of notificationCache.entries()) {
    if (now - timestamp > 2000) {
      notificationCache.delete(key);
    }
  }

  // キャッシュキー生成
  const cacheKey = messageId || `${notificationTitle}|${notificationBody}|${now}`.substring(0, 100);

  console.log('[firebase-messaging-sw.js] messageId:', messageId);
  console.log('[firebase-messaging-sw.js] cacheKey:', cacheKey);
  console.log('[firebase-messaging-sw.js] キャッシュサイズ:', notificationCache.size);

  // messageIdがある場合のみ重複チェック
  if (messageId && notificationCache.has(cacheKey)) {
    console.log('[firebase-messaging-sw.js] 重複通知をスキップしました:', cacheKey);
    return;  // ← ここで処理終了（通知表示しない）
  }

  // キャッシュに追加
  if (messageId) {
    notificationCache.set(cacheKey, now);
  }

  // 1. バッジカウントを増やす
  incrementBadgeCount();

  // 2. 通知を表示
  self.registration.showNotification(notificationTitle, notificationOptions);

  // 3. ACK送信
  if (messageId) {
    sendAck(messageId);
  }
});
```

**バッジカウント実装:**

```javascript
function incrementBadgeCount() {
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    if (clients.length > 0) {
      // PWAが開いている場合: メッセージを送信
      clients[0].postMessage({ type: 'INCREMENT_BADGE' });
    } else {
      // PWAが閉じている場合: IndexedDBで管理
      if ('setAppBadge' in self.navigator) {
        try {
          const currentCount = await getBadgeCount();  // IndexedDBから取得
          const newCount = currentCount + 1;
          await setBadgeCount(newCount);              // IndexedDBに保存
          await self.navigator.setAppBadge(newCount); // Badge API更新
          console.log('[Badge] カウント更新:', currentCount, '→', newCount);
        } catch (err) {
          console.error('[Badge] エラー:', err);
        }
      }
    }
  });
}
```

**PWA側（index.html）のバッジ管理:**

```javascript
let badgeCount = 0;

// Service Workerからのメッセージ受信
navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data.type === 'INCREMENT_BADGE') {
    incrementBadge();  // localStorageとBadge APIを更新
  }
});

function incrementBadge() {
  badgeCount++;
  localStorage.setItem('reborn-badge-count', badgeCount);
  updateBadgeDisplay();  // UI更新
  updateAppBadge();      // Badge API更新
  console.log('🔔 バッジカウント +1:', badgeCount);
}

function updateAppBadge() {
  if ('setAppBadge' in navigator) {
    if (badgeCount > 0) {
      navigator.setAppBadge(badgeCount);
    } else {
      navigator.clearAppBadge();
    }
  }
}
```

---

## 🔍 これまでの修正履歴

### v10 → v11
- **修正**: notificationCache の管理ロジック改善
- **内容**: `messageId` がない場合はキャッシュしない
- **結果**: ❌ 7回目で停止（変化なし）

### v11 → v12
- **修正**: バッジカウント実装（IndexedDB永続化）
- **内容**: `setAppBadge(1)` → IndexedDBで正しくカウント管理
- **結果**: ❌ 7回目で停止（バッジは改善されず）

### v12 → v13
- **修正**: タイムスタンプベースのキャッシュ管理
- **内容**: `setTimeout` を削除し、受信時に古いエントリを自動削除
- **理由**: `setTimeout` がService Workerで不安定（停止すると実行されない）
- **結果**: ⏳ 未テスト（現在デプロイ中）

---

## 🤔 仮説と疑問点

### 仮説1: notificationCache の蓄積問題
**内容**: Service Workerが停止すると、`setTimeout` による削除が実行されず、キャッシュが溜まる

**v13での対策**: タイムスタンプベースの自動クリーンアップ

**疑問点**:
- なぜ「ちょうど7回目」で止まるのか？
- キャッシュサイズに上限がある？
- Map/Set のメモリ上限？

### 仮説2: messageId の問題
**内容**: GASから送られる `messageId` が重複している可能性

**確認事項**:
- GASの `sendFcmMessage()` で生成される `messageId` はユニークか？
- 現在の実装: `const messageId = Utilities.getUuid();`
- UUID v4 なので重複はありえない...はず

**疑問点**:
- FCM側で `messageId` が上書きされている？
- ペイロードの `data.messageId` が正しく送信されているか？

### 仮説3: Badge API の制限
**内容**: Badge APIに何らかの制限があり、4以上にできない

**確認事項**:
- Chrome/Android の Badge API に上限がある？
- PWA側の実装ミス？

**疑問点**:
- なぜバッジが最大3なのか？
- 4にならない理由は？

### 仮説4: FCM側の制限
**内容**: FCMに連続送信の制限がある（レート制限）

**確認事項**:
- FCM HTTP v1 API のレート制限
- 現在の送信間隔: 手動で1つずつ送信（数秒間隔）

**疑問点**:
- レート制限なら、エラーが返るはず（200 OKは返っている）
- なぜ7回目なのか？

### 仮説5: Service Workerのライフサイクル問題
**内容**: Service Workerが6回の通知処理後に停止/再起動している

**確認事項**:
- Service Worker の停止タイミング
- `notificationCache` はメモリ上に残る？（グローバル変数）

**疑問点**:
- Service Workerが再起動しても、グローバル変数は保持される？
- それとも再起動でクリアされる？

---

## 📝 確認が必要なこと

### F12 Console ログ（7回目）
```javascript
// 必要なログ:
[firebase-messaging-sw.js] messageId: ???
[firebase-messaging-sw.js] cacheKey: ???
[firebase-messaging-sw.js] キャッシュサイズ: ???
[firebase-messaging-sw.js] 重複通知をスキップしました: ???  // ← これが出る？
[Badge] カウント更新: 3 → 4  // ← これが出ない？
```

### GAS側のログ
```javascript
// web_push.js sendFcmMessage() のログ:
[FCM] メッセージID: ???  // ユニークか？
[FCM] レスポンスコード: 200  // 7回目も200？
[FCM] レスポンスボディ: ???
```

### 確認したい挙動
1. **6回目と7回目の違い**
   - FCMのレスポンスは同じか？
   - messageId は異なるか？
   - キャッシュサイズはどう変化するか？

2. **バッジが4にならない理由**
   - `incrementBadge()` は呼ばれているか？
   - `updateAppBadge()` は呼ばれているか？
   - Badge API のエラーは出ているか？

3. **「バッジをクリアすると動く」理由**
   - Service Workerが再起動している？
   - `notificationCache` がクリアされている？
   - それとも別の要因？

---

## 🎯 解決に向けた質問

### ChatGPT / Gemini への質問

1. **Service Worker の notificationCache について**
   - グローバル変数 `const notificationCache = new Map();` は、Service Worker再起動後も保持されるか？
   - Service Worker停止→再起動のタイミングは？
   - `setTimeout` がService Workerで不安定な理由は？

2. **FCM の重複配信について**
   - FCMは同じ `messageId` の通知を複数回送信する可能性があるか？
   - FCM側でのキャッシュ/重複防止の仕組みは？

3. **Badge API の制限について**
   - Chrome/Android の Badge API に数値の上限があるか？
   - なぜバッジが4以上にならない可能性があるか？

4. **「7回目」で止まる理由**
   - なぜ「ちょうど7回目」なのか？
   - Service Worker、FCM、Badge API のいずれかに「6回まで」「7回目でNG」という仕様があるか？

5. **タイムスタンプベースのキャッシュ管理の妥当性**
   - v13の実装（受信時に古いエントリを削除）は正しいアプローチか？
   - より良い方法はあるか？

---

## 📎 関連ファイル

- `docs/firebase-messaging-sw.js` - Service Worker（通知処理）
- `docs/index.html` - PWAメイン（バッジ管理）
- `web_push.js` - GAS（FCM送信）
- `chat_manager.js` - GAS（チャットロジック）

---

## 🚀 次のステップ

1. **v13デプロイ後のテスト**（2〜3分待機）
   - 10回連続テスト
   - F12ログをすべて記録
   - 特に6回目と7回目の違いを確認

2. **ChatGPT / Gemini に相談**
   - このドキュメントを共有
   - 上記質問への回答を得る

3. **根本原因の特定**
   - ログ + 外部AI の知見 → 原因特定
   - 確実な修正を実施

---

**最終更新**: 2025-11-05 16:45
**更新者**: Claude Code (Sonnet 4.5)
