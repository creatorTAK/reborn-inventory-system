# PWA チャット バッジ・通知アーキテクチャ

**作成日:** 2025-11-27
**プロジェクト:** REBORN Inventory System
**重要度:** 🔴 高（次期システム開発で必須）

---

## 📋 概要

PWA（Progressive Web App）でリアルタイムチャット機能を実装する際の、バッジ（アプリアイコン上の数字）と通知の制御アーキテクチャ。

特に「チャットルームを閲覧中のユーザーにはバッジ・通知を送らない」という要件を実現するための設計パターン。

---

## 🎯 要件

| 状態 | バッジ | 通知 | 期待動作 |
|------|--------|------|----------|
| チャットルーム閲覧中 | なし | なし | 既に見ているので不要 |
| バックグラウンド/別画面 | あり | あり | 新着を知らせる |
| アプリ未起動 | あり | あり | 新着を知らせる |

---

## ❌ 失敗したアプローチ

### 1. Service Worker側での制御（失敗）

**試みた方法:**
- `clients.matchAll()` でチャットページを開いているクライアントを検出
- `postMessage` でクライアントから閲覧状態をSWに通知
- 閲覧中なら `incrementBadge()` をスキップ

**失敗理由:**
- iOS PWAではService Workerがバックグラウンドで終了しやすい
- `clients.matchAll()` がiOS PWAで正しく動作しない場合がある
- クライアントからのpostMessageが届くタイミングが不安定
- **根本的問題**: FCM通知自体は送られるため、SWのpushイベントは発火する

### 2. クライアント側でバッジクリア（失敗）

**試みた方法:**
- `navigator.clearAppBadge()` をクライアントから呼び出し
- `onSnapshot` でメッセージ受信時に即座にクリア

**失敗理由:**
- Service Workerがバッジを設定 → クライアントがクリア の順序が保証されない
- iOS PWAでは `clearAppBadge()` が効かない場合がある
- **根本的問題**: バッジの設定元（SW）と異なるコンテキスト（クライアント）からのクリアは不安定

---

## ✅ 成功したアプローチ: サーバー側で除外

### アーキテクチャ概要

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  PWA Client     │────▶│   Firestore     │◀────│ Firebase        │
│  (閲覧状態書込) │     │ viewingStatus   │     │ Functions       │
└─────────────────┘     └─────────────────┘     │ (閲覧中除外)    │
                                                 └─────────────────┘
                                                         │
                                                         ▼
                                                 ┌─────────────────┐
                                                 │  FCM通知        │
                                                 │  (閲覧中は送らない)
                                                 └─────────────────┘
```

### 1. Firestoreコレクション設計

```
viewingStatus/{userEmail}
  - roomId: string | null    // 閲覧中のルームID（nullは閲覧終了）
  - lastUpdated: Timestamp   // 更新日時
```

### 2. クライアント側実装（chat_ui_firestore.html）

```javascript
// 閲覧中状態をFirestoreに書き込み
async function setViewingStatus(roomId) {
  if (!currentUserEmail || !roomId) return;
  
  try {
    const viewingRef = doc(db, 'viewingStatus', currentUserEmail);
    await setDoc(viewingRef, {
      roomId: roomId,
      lastUpdated: serverTimestamp()
    });
    console.log('[閲覧状態] Firestore更新: 閲覧中 -', roomId);
  } catch (error) {
    console.error('[閲覧状態] Firestore書き込みエラー:', error);
  }
}

// 閲覧終了をFirestoreに書き込み
async function clearViewingStatus() {
  if (!currentUserEmail) return;
  
  try {
    const viewingRef = doc(db, 'viewingStatus', currentUserEmail);
    await setDoc(viewingRef, {
      roomId: null,
      lastUpdated: serverTimestamp()
    });
    console.log('[閲覧状態] Firestore更新: 閲覧終了');
  } catch (error) {
    console.error('[閲覧状態] Firestoreクリアエラー:', error);
  }
}

// イベントリスナー設定
// ルーム開始時
setViewingStatus(currentRoomId);

// ページ離脱時
window.addEventListener('pagehide', () => clearViewingStatus());
window.addEventListener('beforeunload', () => clearViewingStatus());
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    clearViewingStatus();
  } else if (document.visibilityState === 'visible') {
    setViewingStatus(currentRoomId);
  }
});
```

### 3. Firebase Functions実装（index.js）

```javascript
// 指定ルームを閲覧中のユーザーのメールアドレスを取得
async function getViewingUsers(roomId) {
  try {
    const viewingSnapshot = await db.collection('viewingStatus')
      .where('roomId', '==', roomId)
      .get();

    const viewingUsers = [];
    viewingSnapshot.forEach(doc => {
      viewingUsers.push(doc.id); // ドキュメントID = メールアドレス
    });

    return viewingUsers;
  } catch (error) {
    console.error('❌ [getViewingUsers] エラー:', error);
    return []; // エラー時は空配列（通知は送る）
  }
}

// メッセージ作成トリガー内で使用
exports.onChatMessageCreated = functions.firestore
  .document('rooms/{roomId}/messages/{messageId}')
  .onCreate(async (snap, context) => {
    const roomId = context.params.roomId;
    
    // ... 送信者除外などの処理 ...
    
    // 🎯 閲覧中ユーザーを取得
    const viewingUsers = await getViewingUsers(roomId);
    console.log('👀 閲覧中ユーザー:', viewingUsers);
    
    // 🎯 FCM通知対象から除外
    normalUsers = normalUsers.filter(user => !viewingUsers.includes(user.userEmail));
    mentionedUsers = mentionedUsers.filter(user => !viewingUsers.includes(user.userEmail));
    
    // 🎯 未読カウント更新対象からも除外（重要！）
    const memberEmailsForUnread = memberEmails.filter(
      user => !viewingUsers.includes(user.userEmail)
    );
    
    // FCM通知送信
    await sendChatNotifications(senderName, messageText, roomName, normalUsers);
    
    // 未読カウント更新
    await updateChatUnreadCounts(roomId, memberEmailsForUnread);
  });
```

### 4. Firestoreセキュリティルール

```javascript
// 閲覧中状態コレクション
match /viewingStatus/{userEmail} {
  allow read: if true;  // Firebase Functionsで読み取り
  allow write: if true; // PWAから書き込み（本番では自分のみに制限）
}
```

---

## ⚠️ 重要な教訓

### 1. バッジの制御元を統一する

**問題:** Service Workerでバッジを設定し、クライアントでクリアしようとした
**教訓:** バッジの増減は同じコンテキスト（サーバー or クライアント）で管理する

### 2. 未読カウント（Firestore）がバッジに影響する

**問題:** FCM通知を除外しても、Firestoreの`unreadCounts`が更新され、クライアントの`onSnapshot`がバッジを更新した
**教訓:** 通知だけでなく、未読カウント更新も閲覧中ユーザーから除外する

### 3. iOS PWA特有の制限

- Service Workerがバックグラウンドで終了しやすい
- `clients.matchAll()` が不安定
- `navigator.clearAppBadge()` が効かない場合がある
- **対策:** クライアント側での制御を諦め、サーバー側で制御する

---

## 📁 関連ファイル

- `docs/chat_ui_firestore.html` - チャットUI（閲覧状態書き込み）
- `functions/index.js` - Firebase Functions（閲覧中除外ロジック）
- `docs/firestore.rules` - セキュリティルール（viewingStatus）
- `docs/firebase-messaging-sw.js` - Service Worker（参考: 失敗したアプローチ）
- `docs/index.html` - メイン画面（unreadCountsリスニング）

---

## 🔄 送信者除外との比較

「送信者には通知を送らない」という既存機能と同じアプローチ：

| 除外対象 | 除外方法 | 実装場所 |
|----------|----------|----------|
| 送信者 | `members.filter(m => m !== senderName)` | Firebase Functions |
| 閲覧中ユーザー | `members.filter(m => !viewingUsers.includes(m))` | Firebase Functions |

**ポイント:** どちらもサーバー側（Firebase Functions）で除外することで確実に動作する

---

## 🚀 次期システムへの適用

この設計パターンは以下のシステムに適用可能：

1. **チーム内チャットアプリ**
2. **カスタマーサポートシステム**
3. **リアルタイム通知システム**
4. **コラボレーションツール**

**キーポイント:**
- Firestoreで「閲覧中状態」を管理
- サーバー側（Firebase Functions）で通知・未読カウントを制御
- クライアント側の制御は補助的に使用（メインにしない）

---

**最終更新:** 2025-11-27
**検証環境:** iOS Safari PWA, Firebase Functions v2, Firestore
