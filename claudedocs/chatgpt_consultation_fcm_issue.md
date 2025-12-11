# Firebase Cloud Functions - FCM通知が送信されない問題の相談

## 📋 プロジェクト概要

**プロジェクト名**: REBORN在庫管理システム（PWA）
**環境**:
- Firebase Cloud Functions v2 (Node.js 22)
- Firebase Admin SDK v13.6.0
- firebase-functions v7.0.0
- クライアント: PWA (Cloudflare Pages)
- デバイス: iPhone（iOS）

**目的**: 商品登録時にFirestore triggerでFCMプッシュ通知を送信

---

## 🚨 問題の症状

### 正常に動作している部分 ✅
1. 商品登録 → Firestoreへの保存（products collection）
2. Firebase Cloud Functions のトリガー起動（onDocumentCreated）
3. FCMトークンのFirestoreへの保存（users collection）
4. PWAでのシステムメッセージ表示
5. PWAでの未読バッジカウント更新
6. ユーザードキュメントの取得（Firestore read operations）

### 動作していない部分 ❌
**FCMプッシュ通知がiPhoneに届かない**

---

## 🔍 詳細な問題分析

### 現在のコードフロー (functions/index.js)

```javascript
exports.onProductCreated = onDocumentCreated('products/{productId}', async (event) => {
  const productData = event.data.data();
  const notificationData = createNotificationData(productData);
  const targetUsers = await getTargetUsers(notificationData.userName);

  // FCMプッシュ通知を最優先で送信（順次実行）
  try {
    await sendFCMNotifications(notificationData, targetUsers);
    console.log('✅ [onProductCreated] FCM送信完了');
  } catch (error) {
    console.error('❌ [onProductCreated] FCM送信エラー:', error.message);
  }

  // その後、並列でシステム通知ルームと未読カウント更新
  await Promise.allSettled([
    postToSystemRoom(notificationData),
    updateUnreadCounts(targetUsers)
  ]);
});
```

### sendFCMNotifications関数の実装

```javascript
async function sendFCMNotifications(notificationData, targetUsers) {
  console.log('🔔 [sendFCMNotifications] 関数開始');

  if (targetUsers.length === 0) {
    console.log('⏭️ [sendFCMNotifications] 対象ユーザーなし、スキップ');
    return;
  }

  console.log(`🔔 [sendFCMNotifications] FCM送信開始: ${targetUsers.length}人`);

  // ユーザーごとのFCMトークンを取得
  const tokensPromises = targetUsers.map(async (userName) => {
    try {
      console.log(`🔍 [sendFCMNotifications] トークン取得試行: users/${userName}`);

      const userDoc = await Promise.race([
        db.collection('users').doc(userName).get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error(`Firestore get() timeout for ${userName}`)), 5000))
      ]);

      console.log(`✅ [sendFCMNotifications] get()完了: users/${userName}`);

      if (!userDoc.exists) {
        console.log(`⚠️ [sendFCMNotifications] ドキュメント不在: users/${userName}`);
        return null;
      }

      const userData = userDoc.data();
      console.log(`📄 [sendFCMNotifications] ユーザーデータ: ${JSON.stringify(userData)}`);

      const fcmToken = userData?.fcmToken;
      if (fcmToken) {
        console.log(`✅ [sendFCMNotifications] トークン取得成功: ${userName} → ${fcmToken.substring(0, 20)}...`);
        return { userName, token: fcmToken };
      } else {
        console.log(`⚠️ [sendFCMNotifications] トークンなし: ${userName}`);
        return null;
      }
    } catch (error) {
      console.error(`❌ [sendFCMNotifications] ユーザー${userName}のトークン取得エラー:`, error);
      return null;
    }
  });

  const tokensData = (await Promise.all(tokensPromises)).filter(data => data !== null);
  const tokens = tokensData.map(data => data.token);

  if (tokens.length === 0) {
    console.log('⏭️ [sendFCMNotifications] FCMトークンなし、スキップ');
    return;
  }

  console.log(`📨 [sendFCMNotifications] 送信先トークン数: ${tokens.length}`);

  // FCM通知メッセージ作成
  const message = {
    notification: {
      title: notificationData.title,
      body: `${notificationData.managementNumber} ${notificationData.productName}`
    },
    data: {
      type: notificationData.type,
      managementNumber: notificationData.managementNumber,
      productName: notificationData.productName,
      userName: notificationData.userName,
      timestamp: notificationData.timestamp
    }
  };

  // 複数のトークンに送信
  const sendPromises = tokens.map(async (token) => {
    try {
      await messaging.send({
        ...message,
        token: token
      });
      console.log(`✅ [sendFCMNotifications] 送信成功: ${token.substring(0, 20)}...`);
      return { success: true };
    } catch (error) {
      console.error(`❌ [sendFCMNotifications] 送信失敗: ${token.substring(0, 20)}...`, error.message);
      return { success: false, error: error.message };
    }
  });

  const results = await Promise.all(sendPromises);
  const successCount = results.filter(r => r.success).length;
  console.log(`📊 [sendFCMNotifications] 送信結果: ${successCount}/${tokens.length}件成功`);
}
```

---

## 🔬 実際のログ出力（問題発生時）

### テストケース: 商品登録 P20251121021 (管理番号: AA-1033)

```
2025-11-21T06:27:55.416574Z ? onproductcreated: 🚀 [onProductCreated] FCM送信開始（最優先）
2025-11-21T06:27:55.417099Z ? onproductcreated: 🔔 [sendFCMNotifications] FCM送信開始: 3人
2025-11-21T06:27:55.591615Z ? onproductcreated: ✅ [sendFCMNotifications] get()完了: users/安廣拓志
2025-11-21T06:27:56.197343Z ? onproductcreated: ✅ [sendFCMNotifications] get()完了: users/山田太郎
2025-11-21T06:27:56.202492Z ? onproductcreated: ✅ [sendFCMNotifications] get()完了: users/田中花子
```

**その後、ログが途切れる。以下のログが一切出力されない：**
- `📄 [sendFCMNotifications] ユーザーデータ: ...`
- `✅ [sendFCMNotifications] トークン取得成功: ...`
- `📨 [sendFCMNotifications] 送信先トークン数: ...`
- `✅ [sendFCMNotifications] 送信成功: ...`
- `📊 [sendFCMNotifications] 送信結果: ...`

---

## 🤔 私の仮説

### 仮説1: userDoc.data() が silent fail している
**可能性**: 高い
**理由**:
- `userDoc.get()` は成功している（ログに `get()完了` が出力）
- しかし `userDoc.data()` 以降のログが一切出力されない
- Firebase Admin SDK の `.data()` メソッドに何らかの問題がある可能性

**検証方法**:
- `userDoc.data()` の前後に try-catch を追加
- `userDoc` オブジェクトの状態をログ出力

### 仮説2: Promise.all(tokensPromises) が hang している
**可能性**: 中程度
**理由**:
- 以前、`Promise.all()` で並列実行した際に Firestore read operations が hang した実績あり
- 順次実行に変更したことで `userDoc.get()` は成功したが、`tokensPromises` の `Promise.all()` は残っている

**検証方法**:
- `Promise.all(tokensPromises)` の前後にログ追加
- `for...of` ループで順次実行に変更してテスト

### 仮説3: Firebase Functions の実行環境に制約がある
**可能性**: 低い
**理由**:
- Node.js 22 (2nd Gen) を使用
- Firebase Admin SDK v13.6.0, firebase-functions v7.0.0
- 公式ドキュメント通りの実装

**検証方法**:
- Firebase Functions のログ出力上限を確認
- 実行時間制限（タイムアウト）を確認
- メモリ制限を確認

### 仮説4: FCMトークンのフォーマットが不正
**可能性**: 低い
**理由**:
- FCMトークンは正常に保存されている（Firestore Console で確認済み）
- しかし、そもそもトークン取得のログが出力されていないため、この段階には到達していない

---

## 📊 Firestore データ構造

### users collection
```javascript
users/安廣拓志:
{
  email: "yasuhiro@example.com",
  userName: "安廣拓志",
  fcmToken: "d8eF3qL9xY2hKj4mN6pR8tV0wX1yZ3aB5cD7eF9gH0iJ2kL4mN6oP8qR0sT2uV4wX6yZ8aB0cD2eF4gH6iJ8kL0mN2oP4qR6sT8uV0wX2yZ4aB6cD8eF0gH2iJ4kL6mN8oP0qR2sT4uV6wX8yZ0aB2cD4eF6gH8iJ0kL2mN4oP6qR8sT0uV2wX4yZ6aB8cD0eF2gH4iJ6kL8mN0oP2qR4sT6uV8wX0yZ2aB4cD6eF8gH0iJ2kL4mN6oP8qR0sT2uV4"
}
```

### products collection (trigger source)
```javascript
products/P20251121021:
{
  productId: "P20251121021",
  managementNumber: "AA-1033",
  brand: { nameEn: "NIKE", nameKana: "ナイキ" },
  itemName: "Air Max 90",
  category: { major: "スニーカー" },
  listing: { destination: "メルカリ", amount: "12000" },
  createdBy: "安廣拓志",
  createdAt: Timestamp
}
```

---

## 🛠️ これまでに試した対策

### 対策1: Promise.race() でタイムアウト実装
**結果**: タイムアウトエラーが発生しない（Promise.race 自体が機能していない可能性）

### 対策2: Promise.all() を順次実行に変更
**結果**: `userDoc.get()` は成功したが、その後の処理が進まない

### 対策3: 詳細なデバッグログの追加
**結果**: `userDoc.get()` までは成功するが、`userDoc.data()` 以降のログが出力されない

---

## ❓ ChatGPTへの質問

1. **Firebase Admin SDK の `.data()` メソッドが silent fail する可能性はありますか？**
   - もしあるなら、どのような条件で発生しますか？
   - 回避方法はありますか？

2. **Firebase Cloud Functions (2nd Gen) で Promise.all() が hang する既知の問題はありますか？**
   - Node.js 22 環境での制約事項はありますか？
   - 推奨される非同期処理のパターンはありますか？

3. **FCM通知送信の正しい実装パターンを教えてください**
   - 複数ユーザーへの一斉送信のベストプラクティスは？
   - エラーハンドリングの推奨パターンは？

4. **Firebase Functions のログ出力について**
   - console.log() が途中で出力されなくなる原因は？
   - ログ出力の上限や制約事項はありますか？

5. **この問題の根本原因として、他に考えられる可能性はありますか？**

---

## 🎯 期待する回答

- 具体的な原因の特定
- 修正方法の提案
- 推奨される実装パターン
- デバッグ方法の提案

---

**補足**: この問題は Firebase Functions の一般的な機能（Firestore trigger + FCM送信）であるため、設定が不可能なはずがないと考えています。何か根本的な実装ミスや設定ミスがある可能性が高いと推測しています。
