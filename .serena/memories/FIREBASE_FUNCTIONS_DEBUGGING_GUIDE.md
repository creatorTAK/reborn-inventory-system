# Firebase Functions デバッグ・トラブルシューティングガイド

**作成日**: 2025-11-22
**用途**: Firebase Functions関連の問題発生時の調査手順

---

## 🔍 基本的なデバッグ手順

### 1. 関数がデプロイされているか確認
```bash
npx firebase functions:list --project reborn-chat
```

**確認ポイント**:
- 対象関数が一覧に表示されるか
- ステータスが「ACTIVE」か

---

### 2. Cloud Loggingでログ確認
```bash
# 全ログ表示
npx firebase functions:log --project reborn-chat

# 特定関数のみ
npx firebase functions:log --project reborn-chat --only onChatMessageCreated
```

**重要な違いを見分ける**:
- ✅ `Successful update operation` → 既存関数の更新（正常）
- ⚠️ `Successful create operation` → 新規作成（初回以外は要注意）

**理由**: 
- 「create」が2回目以降に表示される = 前回のデプロイが反映されていなかった可能性
- ChatGPT分析により判明（2025-11-22 個別チャット問題）

---

### 3. トリガーが発火しているか確認

**デバッグログを追加**:
```javascript
// 関数の最初に追加
console.log('🔧 [関数名] 関数初期化完了');

exports.myFunction = onDocumentCreated('path/{id}', async (event) => {
  console.log('🚀 [関数名] トリガー発火', { eventId: event.id });
  
  // ... 処理 ...
  
  console.log('✅ [関数名] 処理完了');
});
```

**確認方法**:
1. デプロイ実行
2. Firestoreでトリガー条件を満たす操作（メッセージ送信等）
3. Cloud Loggingで上記ログが表示されるか確認

---

## 🚨 よくあるエラーパターン

### パターン1: `snapshot.exists is not a function`

**原因**: Firebase Admin SDK v2 では `exists` はプロパティ

**修正**:
```javascript
// ❌ 間違い (v1の書き方)
if (!snapshot.exists()) {

// ✅ 正しい (v2の書き方)
if (!snapshot.exists) {
```

**影響範囲**: `snapshot.exists()` を使っている全箇所

---

### パターン2: 通知は届くがバッジが更新されない

**原因**: 未読カウント更新処理が未実装

**チェック項目**:
```javascript
// 他の正常動作している関数と比較
// onProductCreated には updateUnreadCounts があるか？
// onChatMessageCreated には updateChatUnreadCounts があるか？

await Promise.allSettled([
  sendNotifications(...),
  updateUnreadCounts(...)  // ← これがあるか確認
]);
```

**解決策**: 
- `updateChatUnreadCounts` 等の未読カウント更新関数を実装
- `Promise.allSettled` で並列実行

**参考**: claudedocs/individual_chat_notification_badge_fix.md

---

### パターン3: トリガーが発火しない

**考えられる原因**:
1. デプロイされていない（再デプロイ実行）
2. Firestoreパスが間違っている
3. トリガー条件（onCreate, onUpdate等）が間違っている

**確認手順**:
```bash
# 1. 関数が存在するか
npx firebase functions:list --project reborn-chat

# 2. ログに何か出ているか
npx firebase functions:log --project reborn-chat

# 3. コード上のパスとFirestoreの実パスを比較
# コード: 'rooms/{roomId}/messages/{messageId}'
# Firestore実パス: rooms/dm_mercari_.../messages/abc123
```

---

## 📋 デバッグチェックリスト

Firebase Functions で問題が発生した場合、以下を順番に確認：

- [ ] **Step 1**: `firebase functions:list` で関数が存在するか
- [ ] **Step 2**: `firebase functions:log` でログ確認
- [ ] **Step 3**: 「create」vs「update」を確認（create が2回目以降なら要注意）
- [ ] **Step 4**: デバッグログ追加（関数初期化、トリガー発火、処理完了）
- [ ] **Step 5**: 再デプロイ実行
- [ ] **Step 6**: テスト実行（Firestoreで実際の操作）
- [ ] **Step 7**: Cloud Loggingでログ確認
- [ ] **Step 8**: エラーメッセージから原因特定
- [ ] **Step 9**: SDK仕様確認（exists() vs exists 等）
- [ ] **Step 10**: 正常動作している類似関数と比較

---

## 🛠️ 便利なコマンド集

```bash
# 関数一覧
npx firebase functions:list --project reborn-chat

# 全ログ表示（リアルタイム）
npx firebase functions:log --project reborn-chat

# 特定関数のみ
npx firebase functions:log --project reborn-chat --only onChatMessageCreated

# 最新10件のみ
npx firebase functions:log --project reborn-chat --limit 10

# 特定の関数のみデプロイ
npx firebase deploy --only functions:onChatMessageCreated --project reborn-chat

# 全関数デプロイ
npx firebase deploy --only functions --project reborn-chat
```

---

## 💡 ベストプラクティス

### 1. 常にデバッグログを追加
```javascript
console.log('🔧 [関数名] 関数初期化完了');
console.log('🚀 [関数名] トリガー発火');
console.log('📊 [関数名] データ取得:', data);
console.log('✅ [関数名] 処理完了');
console.error('❌ [関数名] エラー:', error);
```

### 2. Promise.allSettled を使う
```javascript
// 個別に成功/失敗を処理
await Promise.allSettled([
  sendNotifications(),
  updateBadge()
]);
```

### 3. エラーハンドリング
```javascript
try {
  // 処理
} catch (error) {
  console.error('❌ [関数名] エラー:', error);
  // エラーを投げずに処理を続行（バッジ更新失敗でも通知は送る）
}
```

### 4. SDK仕様を確認
- Firebase Admin SDK v2 では `snapshot.exists` はプロパティ
- `snapshot.data()` はメソッド（変更なし）

---

## 🔗 関連ドキュメント

- **claudedocs/individual_chat_notification_badge_fix.md** - 個別チャット問題の詳細記録
- **claudedocs/chatgpt_consultation_fcm_issue.md** - ChatGPT分析記録
- **DEPLOYMENT_RULES** (Serena Memory) - デプロイ手順

---

**最終更新**: 2025-11-22
**作成者**: Claude (Sonnet 4.5)
