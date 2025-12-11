# activeDevices 高速化実装 - デプロイガイド

## 📌 概要

個別チャット通知配信の遅延問題（1.7秒）を解決するため、`activeDevices` トップレベルコレクションを導入しました。

**期待される改善:**
- FCMトークン取得: 820ms → 100-200ms（4-8倍高速化）
- 通知全体: 1.7秒 → 約1秒以下

---

## 🎯 変更ファイル一覧

### 新規作成
- `functions/deviceSync.js` - デバイス同期トリガー
- `scripts/migrate_activeDevices.js` - マイグレーションスクリプト

### 修正
- `functions/index.js` - 通知送信高速化 + deviceSync エクスポート
- `docs/firestore.rules` - activeDevices セキュリティルール追加

---

## 🚀 デプロイ手順（3ステップ）

### Step 1: Firestoreセキュリティルールのデプロイ

**重要:** 先にセキュリティルールをデプロイしないと、マイグレーション実行時にエラーが発生します。

```bash
# プロジェクトルートで実行
cd /Users/yasuhirotakushi/Desktop/reborn-project

# Firestoreルールのみデプロイ（約5秒）
npx firebase deploy --only firestore:rules --project reborn-chat
```

**成功例:**
```
✔ cloud.firestore: rules file docs/firestore.rules compiled successfully
✔ firestore: released rules docs/firestore.rules to cloud.firestore
✔ Deploy complete!
```

---

### Step 2: マイグレーション実行

既存の `users/{email}/devices` データから `activeDevices/{email}` を生成します。

#### 2-1. サービスアカウントキー取得（初回のみ）

1. Firebase Console: https://console.firebase.google.com/
2. プロジェクト選択: `reborn-chat`
3. ⚙️ プロジェクト設定 → サービスアカウント
4. 「新しい秘密鍵の生成」をクリック
5. ダウンロードしたJSON を `scripts/serviceAccountKey.json` として保存

```bash
# 配置確認
ls -la scripts/serviceAccountKey.json
# -rw-r--r--  1 user  staff  2405 Nov 24 10:00 scripts/serviceAccountKey.json
```

#### 2-2. マイグレーション実行

```bash
# scriptsディレクトリで実行
cd /Users/yasuhirotakushi/Desktop/reborn-project

# Node.js でマイグレーション実行
node scripts/migrate_activeDevices.js
```

**実行時の出力例:**
```
🚀 activeDevices マイグレーション開始

👥 対象ユーザー数: 5

✅ 移行完了: yasuhirotakuji@gmail.com (2 tokens)
✅ 移行完了: user2@example.com (1 tokens)
ℹ️ トークンなし: user3@example.com

═══════════════════════════════════════
✅ マイグレーション完了
═══════════════════════════════════════
総ユーザー数: 5
✅ 移行完了: 2 users
⏭️ スキップ: 3 users (既存 or トークンなし)
❌ エラー: 0 users

🎉 すべて正常に完了しました

🔍 検証: activeDevices 件数確認
📊 activeDevices ドキュメント数: 2

サンプル (最初の3件):
  1. yasuhirotakuji@gmail.com: 2 tokens
  2. user2@example.com: 1 tokens
```

**注意:**
- 2回目以降の実行は安全（既存データはスキップ）
- トークンがないユーザーは `activeDevices` 未作成

---

### Step 3: Firebase Functions デプロイ

```bash
# functionsディレクトリで実行
cd /Users/yasuhirotakushi/Desktop/reborn-project/functions

# Functions のみデプロイ（約30-60秒）
npx firebase deploy --only functions --project reborn-chat
```

**デプロイ対象:**
- `onProductCreated` (既存)
- `onChatMessageCreated` (既存 - 高速化済み)
- `onDeviceCreated` (既存)
- `syncActiveDevices` ← **新規**

**成功例:**
```
✔ functions[syncActiveDevices(us-central1)] Successful create operation.
✔ functions[onChatMessageCreated(us-central1)] Successful update operation.
✔ Deploy complete!
```

---

## ✅ デプロイ後の確認

### 1. Firebase Console でトリガー確認

1. Firebase Console → Functions
2. `syncActiveDevices` が表示されているか確認
3. トリガー: `users/{userEmail}/devices/{deviceId}` (onWrite)

### 2. 動作テスト

#### テスト1: 新規デバイス登録

PWAでログインし、FCMトークンを新規登録（新しいブラウザ/シークレットモード）

**期待動作:**
- `users/{email}/devices/{deviceId}` に書き込み
- 数秒後、`syncActiveDevices` トリガーが起動
- `activeDevices/{email}` が自動作成される

**確認コマンド:**
```bash
# Firebase Functions ログ確認
npx firebase functions:log --project reborn-chat -n 20
```

**期待されるログ:**
```
🔄 [syncActiveDevices] トリガー実行: yasuhirotakuji@gmail.com/device-xxx
✅ [syncActiveDevices] アクティブデバイス検知
💾 [syncActiveDevices] activeDevices 更新: 1 tokens
✅ [syncActiveDevices] 同期完了: yasuhirotakuji@gmail.com
```

#### テスト2: 個別チャット通知送信

個別チャットでメッセージを送信

**期待動作:**
- 通知配信速度が向上（1.7秒 → 約1秒以下）
- バッジ更新も高速化

**確認コマンド:**
```bash
# チャットメッセージ送信直後に実行
npx firebase functions:log --project reborn-chat -n 50 | grep "onChatMessageCreated"
```

**期待されるログ:**
```
🔍 [sendChatNotifications] トークン取得: ユーザー名 (yasuhirotakuji@gmail.com)
✅ [sendChatNotifications] トークン取得成功: ユーザー名 (2件)
✅ [onChatMessageCreated] 通知完了: 950ms  ← 1秒以下！
```

**改善前のログ（比較用）:**
```
✅ [onChatMessageCreated] 通知完了: 1767ms  ← 遅い
```

---

## 🔍 トラブルシューティング

### エラー1: `serviceAccountKey.json が見つかりません`

**原因:** サービスアカウントキーが未配置

**解決:**
```bash
# キーの配置を確認
ls scripts/serviceAccountKey.json

# なければFirebase Consoleから再取得
# → プロジェクト設定 → サービスアカウント → 新しい秘密鍵の生成
```

---

### エラー2: `PERMISSION_DENIED` (Firestore Rules)

**原因:** セキュリティルールがデプロイされていない

**解決:**
```bash
# Step 1 を再実行
npx firebase deploy --only firestore:rules --project reborn-chat
```

---

### エラー3: `syncActiveDevices` トリガーが動かない

**原因:** Functions デプロイが失敗している

**確認:**
```bash
# Functions 一覧を確認
npx firebase functions:list --project reborn-chat

# syncActiveDevices が表示されるはず
```

**解決:**
```bash
# 強制再デプロイ
npx firebase deploy --only functions --force --project reborn-chat
```

---

### エラー4: 通知速度が改善しない

**原因1:** `activeDevices` が未作成
```bash
# Firestore Console で確認
# activeDevices コレクションが存在するか？
# 対象ユーザーのドキュメントが存在するか？
```

**原因2:** 古いコードがキャッシュされている
```bash
# Functions を強制再デプロイ
npx firebase deploy --only functions --force --project reborn-chat
```

**原因3:** まだ `users/{email}/devices` クエリを使っている
```bash
# ログで確認
npx firebase functions:log -n 50 | grep "devicesSnapshot"

# もし出てきたら、古いコードが動いている
# → functions/index.js の変更が反映されていない
```

---

## 📊 パフォーマンス計測

### ログから処理時間を確認

```bash
# 最近の通知送信時間を確認
npx firebase functions:log -n 100 --project reborn-chat | grep "通知完了"
```

**期待される結果:**
```
✅ [onChatMessageCreated] 通知完了: 850ms
✅ [onChatMessageCreated] 通知完了: 920ms
✅ [onChatMessageCreated] 通知完了: 1050ms
```

**改善前（比較用）:**
```
✅ [onChatMessageCreated] 通知完了: 1767ms
✅ [onChatMessageCreated] 通知完了: 1820ms
✅ [onChatMessageCreated] 通知完了: 1650ms
```

---

## 🧹 後片付け（任意）

マイグレーション完了後、サービスアカウントキーは削除推奨（セキュリティ）

```bash
# キーを削除
rm scripts/serviceAccountKey.json

# または .gitignore に追加（既に追加済み）
echo "scripts/serviceAccountKey.json" >> .gitignore
```

---

## 📝 デプロイチェックリスト

- [ ] Step 1: Firestoreルールデプロイ完了
- [ ] Step 2: マイグレーション実行完了
- [ ] Step 3: Firebase Functions デプロイ完了
- [ ] テスト1: 新規デバイス登録で `syncActiveDevices` 動作確認
- [ ] テスト2: 個別チャット通知速度改善確認（1秒以下）
- [ ] ログ確認: `通知完了: XXXms` が1000ms以下
- [ ] サービスアカウントキー削除（セキュリティ）

---

## 🎉 完了後の状態

- `activeDevices` コレクション: 全アクティブユーザー分作成
- `syncActiveDevices` トリガー: デバイス登録/削除時に自動同期
- 通知送信: サブコレクションクエリ不要、高速化完了

---

**作成日:** 2025-11-24
**作成者:** Claude Code
**関連Issue:** 個別チャット通知配信遅延問題（1.7秒）
