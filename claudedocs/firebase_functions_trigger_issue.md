# Firebase Functions Firestore トリガーが発火しない問題

## 問題の概要

Firebase Functions の `onChatMessageCreated` トリガーが、個別チャットメッセージ作成時に発火しない。
システム通知メッセージに対しては正常に発火するが、個別チャット (`rooms/{roomId}/messages/{messageId}`) に対しては全く発火しない。

## 環境情報

- **Firebase Functions**: v2 (Gen 2)
- **Node.js**: 22
- **Region**: us-central1
- **Firestore**: Default database
- **トリガータイプ**: `google.cloud.firestore.document.v1.created`

## 動作状況

### ✅ 正常に動作（システム通知）
- **トリガー**: `onProductCreated` (商品登録時)
- **Firestoreパス**: `products/{productId}`
- **動作**: 正常に発火し、システム通知ルーム (`system`) にメッセージ投稿
- **ログ確認**: `onChatMessageCreated` がシステムメッセージを検知してスキップ

```
2025-11-22T06:21:42.668067Z ? onchatmessagecreated: 💬 [onChatMessageCreated] メッセージ検知: system 1763792500234_p3dtm294fr
2025-11-22T06:21:42.668365Z ? onchatmessagecreated: ⏭️ [onChatMessageCreated] システムメッセージ、スキップ
```

### ❌ 発火しない（個別チャット）
- **Firestoreパス**: `rooms/dm_mercari_yasuhirotakuji_at_gmail_com_yasuhirotakuji_at_gmail_com/messages/LrMRtPvBZZWY9Q9hRfEc`
- **動作**: メッセージは正常にFirestoreに保存されるが、`onChatMessageCreated` が全く発火しない
- **ログ確認**: 個別チャットメッセージに関するログが一切出力されない

## トリガー設定

```javascript
// functions/index.js (line 362)
exports.onChatMessageCreated = onDocumentCreated('rooms/{roomId}/messages/{messageId}', async (event) => {
  const startTime = Date.now();
  const roomId = event.params.roomId;
  const messageId = event.params.messageId;

  console.log('💬 [onChatMessageCreated] メッセージ検知:', roomId, messageId);

  try {
    const messageData = event.data.data();

    if (!messageData) {
      console.error('❌ [onChatMessageCreated] メッセージデータが空');
      return;
    }

    // システムメッセージはスキップ
    if (messageData.type === 'system') {
      console.log('⏭️ [onChatMessageCreated] システムメッセージ、スキップ');
      return;
    }

    const senderName = messageData.userName || '匿名';
    const messageText = messageData.text || '(ファイル)';

    console.log('📋 [onChatMessageCreated] 送信者:', senderName, '内容:', messageText);

    // ルーム情報を取得
    const roomRef = db.collection('rooms').doc(roomId);
    const roomSnap = await roomRef.get();

    if (!roomSnap.exists()) {
      console.error('❌ [onChatMessageCreated] ルームが見つかりません:', roomId);
      return;
    }

    const roomData = roomSnap.data();
    const roomType = roomData.type || 'group';
    const members = roomData.members || [];

    console.log('📋 [onChatMessageCreated] ルーム:', roomData.name, 'タイプ:', roomType, 'メンバー:', members);

    // 送信者以外のメンバーに通知
    const targetMembers = members.filter(member => member !== senderName);

    if (targetMembers.length === 0) {
      console.log('⏭️ [onChatMessageCreated] 通知対象なし');
      return;
    }

    console.log('👥 [onChatMessageCreated] 通知対象:', targetMembers);

    // 対象メンバーのメールアドレスを取得
    const usersSnapshot = await db.collection('users').get();
    const memberEmails = [];

    usersSnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      if (targetMembers.includes(userData.userName)) {
        memberEmails.push({
          userName: userData.userName,
          userEmail: userDoc.id
        });
      }
    });

    console.log('📧 [onChatMessageCreated] メールアドレス取得:', memberEmails);

    // FCM通知送信
    await sendChatNotifications(senderName, messageText, roomData.name || '個別チャット', memberEmails);

    const duration = Date.now() - startTime;
    console.log(`✅ [onChatMessageCreated] 通知完了: ${duration}ms`);

  } catch (error) {
    console.error('❌ [onChatMessageCreated] エラー:', error);
  }
});
```

## デプロイ確認

```bash
$ npx firebase functions:list --project reborn-chat

┌──────────────────────┬─────────┬────────────────────────────────────────────┬─────────────┬────────┬──────────┐
│ Function             │ Version │ Trigger                                    │ Location    │ Memory │ Runtime  │
├──────────────────────┼─────────┼────────────────────────────────────────────┼─────────────┼────────┼──────────┤
│ onChatMessageCreated │ v2      │ google.cloud.firestore.document.v1.created │ us-central1 │ 256    │ nodejs22 │
├──────────────────────┼─────────┼────────────────────────────────────────────┼─────────────┼────────┼──────────┤
│ onProductCreated     │ v2      │ google.cloud.firestore.document.v1.created │ us-central1 │ 256    │ nodejs22 │
└──────────────────────┴─────────┴────────────────────────────────────────────┴─────────────┴────────┴──────────┘
```

✅ デプロイは成功している

## Firestore構造確認

### システム通知メッセージ（発火する）
```
rooms/
  system/
    messages/
      1763792500234_p3dtm294fr/
        text: "✅ 商品登録完了..."
        userName: "安廣拓志"
        timestamp: 2025-11-22T06:21:41.245Z
        type: "system"
        deleted: false
```

### 個別チャットメッセージ（発火しない）
```
rooms/
  dm_mercari_yasuhirotakuji_at_gmail_com_yasuhirotakuji_at_gmail_com/
    messages/
      LrMRtPvBZZWY9Q9hRfEc/
        text: "テストメッセージ"
        userName: "安廣拓志"
        timestamp: 2025-11-22T06:45:00.000Z
        deleted: []
```

**パス形式**: `rooms/{roomId}/messages/{messageId}` ✅ 一致

## 試したこと

### 1. roomID を日本語からメールアドレスベースに変更
- **旧**: `dm_安廣拓志_山田太郎` (日本語文字含む)
- **新**: `dm_mercari_yasuhirotakuji_at_gmail_com_yasuhirotakuji_at_gmail_com` (英数字のみ)
- **結果**: ❌ 変わらず発火しない

### 2. functions/ ディレクトリ構造の修正
- **問題**: firebase.json が `"source": "functions"` を指定していたが、functions/ ディレクトリが存在しなかった
- **修正**: functions/ ディレクトリを作成し、index.js と package.json を配置
- **結果**: ✅ デプロイ成功、onProductCreated は正常動作、onChatMessageCreated は依然として発火しない

### 3. Firebase Functions 再デプロイ
```bash
$ npx firebase deploy --only functions --project reborn-chat
✔ functions[onProductCreated(us-central1)] Successful update operation.
✔ functions[onChatMessageCreated(us-central1)] Successful update operation.
```
- **結果**: ❌ 変わらず発火しない

## 疑問点

1. **なぜ `onProductCreated` は発火するのに `onChatMessageCreated` は発火しないのか？**
   - 同じ `onDocumentCreated` トリガーを使用
   - 同じ Firebase Functions にデプロイ済み
   - トリガーパターンも正しい

2. **なぜ systemルームのメッセージには反応するのに、個別チャットルームのメッセージには反応しないのか？**
   - どちらも `rooms/{roomId}/messages/{messageId}` パターンに一致
   - systemルームでは `onChatMessageCreated` がログに記録されている

3. **Firestore イベント自体が発生していない可能性はあるか？**
   - メッセージは正常に保存されている
   - フロントエンドでリアルタイム更新も正常に動作

## 次に確認すべきこと

1. Google Cloud Console でイベントログを確認
2. Firestore Rules が影響している可能性
3. サブコレクショントリガーの制約や既知の問題
4. リージョン設定の不一致（trigger_region: asia-northeast1 vs function location: us-central1）

## Firebase Functions ログ（最近の全ログ）

```
2025-11-22T06:21:40.435510Z ? onproductcreated: 📊 [updateUnreadCounts] 未読カウント更新完了
2025-11-22T06:21:41.073048Z ? onproductcreated: ✅ [postToSystemRoom] systemRoomDoc.get()完了, exists: true
2025-11-22T06:21:41.073129Z ? onproductcreated: 🔍 [postToSystemRoom] systemRoomRef.update()開始
2025-11-22T06:21:41.244871Z ? onproductcreated: ✅ [postToSystemRoom] システムルーム更新完了
2025-11-22T06:21:41.245215Z ? onproductcreated: 🔍 [DEBUG] messageData: {...}
2025-11-22T06:21:41.245240Z ? onproductcreated: 🔍 [DEBUG] Firestore書き込み開始...
2025-11-22T06:21:41.897376Z ? onproductcreated: ✅ [postToSystemRoom] Firestore書き込み完了
2025-11-22T06:21:41.897883Z ? onproductcreated: 📨 [postToSystemRoom] システム通知ルーム投稿完了
2025-11-22T06:21:41.898113Z ? onproductcreated: ✅ [onProductCreated] すべての処理完了
2025-11-22T06:21:41.898184Z ? onproductcreated: ✅ [onProductCreated] 通知完了: 4199ms
2025-11-22T06:21:42.647824Z I onchatmessagecreated:
2025-11-22T06:21:42.668067Z ? onchatmessagecreated: 💬 [onChatMessageCreated] メッセージ検知: system 1763792500234_p3dtm294fr
2025-11-22T06:21:42.668365Z ? onchatmessagecreated: ⏭️ [onChatMessageCreated] システムメッセージ、スキップ
```

**以降、個別チャットメッセージに関するログは一切なし**

## 関連ファイル

- `functions/index.js` (line 362-524): onChatMessageCreated 定義
- `docs/chat_ui_firestore.html` (line 1115-1122): メッセージ送信処理
- `docs/chat_rooms_list.html` (line 1221-1227): roomID生成ロジック
- `firebase.json`: Firebase Functions 設定

## 🎯 根本原因（2025-11-22 解決）

**原因**: `onChatMessageCreated` が実際にはデプロイされていなかった

**証拠**:
```
2025-11-22T06:58:47 デプロイログ:
✔  functions[onChatMessageCreated(us-central1)] Successful create operation.
```

- デプロイログに **"Successful create operation"** と表示
- `onProductCreated` は "Successful update operation"（更新）
- つまり、`onChatMessageCreated` は**新規作成**された = 以前はデプロイされていなかった

**なぜデプロイされていなかったか**:
- 前回のセッションで functions/ ディレクトリを作成した際、何らかの理由で `onChatMessageCreated` のエクスポートが反映されていなかった可能性
- `npx firebase functions:list` では表示されていたが、実際には動作していなかった

**解決方法**:
```bash
cd functions && npx firebase deploy --only functions --project reborn-chat
```

## 期待する動作

個別チャットでメッセージを送信したとき：
1. Firestore `rooms/{roomId}/messages/{messageId}` にメッセージが保存される ✅ 動作中
2. `onChatMessageCreated` トリガーが発火する ⏳ **再デプロイ後にテスト必要**
3. Firebase Functions がログを出力する ⏳ **再デプロイ後にテスト必要**
4. FCM通知が送信される ⏳ **再デプロイ後にテスト必要**
5. バッジが更新される ⏳ **再デプロイ後にテスト必要**
