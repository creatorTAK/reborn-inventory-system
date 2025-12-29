# Firestore データ構造ドキュメント

**REBORN在庫管理システム - Firestoreデータベース構造一覧**

このドキュメントは、Firebase Consoleで見える英語のコレクション名・フィールド名を日本語で理解するためのリファレンスです。

---

## 📚 コレクション一覧

| コレクション名 | 日本語名 | 用途 |
|--------------|---------|------|
| `rooms` | チャットルーム | チャット機能のルーム管理 |
| `users` | ユーザー管理 | システムユーザーの情報 |
| `products` | 商品在庫 | 商品登録・在庫管理（※GAS側） |
| `platforms` | プラットフォームマスタ | 出品先ECプラットフォームの定義 |
| `configs` | ユーザー設定 | ユーザー固有の設定情報 |

---

## 🏠 rooms（チャットルーム）

**用途**: チャット機能のルーム（会話部屋）を管理します。

**パス**: `rooms/{roomId}`

### 主要なルームID

| ルームID | 日本語名 | 説明 |
|---------|---------|------|
| `system` | システム通知ルーム | 商品登録などのシステム通知専用 |
| `room_default_all` | 全体チャット | 全員が参加する全体ルーム |
| その他 | 個別チャット | ユーザーが作成したチャットルーム |

### フィールド一覧

| フィールド名 | 日本語名 | 型 | 説明 | 必須 |
|------------|---------|-----|------|------|
| `name` | ルーム名 | string | チャットルームの名前 | ✅ |
| `icon` | アイコン | string | ルームアイコン（絵文字など） | - |
| `members` | メンバー | array | 参加ユーザーのメールアドレス配列 | ✅ |
| `createdBy` | 作成者 | string | ルーム作成者のユーザー名 | - |
| `createdAt` | 作成日時 | timestamp | ルーム作成日時 | ✅ |
| `lastMessage` | 最終メッセージ | string | 最後に送信されたメッセージ | - |
| `lastMessageAt` | 最終更新日時 | timestamp | 最後のメッセージ送信日時 | - |
| `lastMessageBy` | 最終送信者 | string | 最後にメッセージを送信したユーザー名 | - |

---

### 📝 messages（メッセージ）サブコレクション

**用途**: 各チャットルームのメッセージ本体を保存します。

**パス**: `rooms/{roomId}/messages/{messageId}`

#### フィールド一覧

| フィールド名 | 日本語名 | 型 | 説明 | 必須 |
|------------|---------|-----|------|------|
| `text` | メッセージ本文 | string | チャットメッセージの内容 | ✅ |
| `userName` | 送信者名 | string | メッセージを送信したユーザー名 | ✅ |
| `timestamp` | 送信日時 | timestamp | メッセージ送信日時 | ✅ |
| `deletedBy` | 削除者リスト | array | このメッセージを削除したユーザーのリスト | ✅ |

**表示ロジック**:
- `deletedBy` に自分のユーザー名が含まれていれば、そのメッセージは非表示になります
- 他のユーザーには引き続き表示されます（個別削除機能）

---

### 🔔 unreadCounts（未読カウント）サブコレクション

**用途**: ユーザーごとの未読メッセージ数を管理します。バッジ表示に使用。

**パス**: `rooms/{roomId}/unreadCounts/{userEmail}`

**⚠️ 重要**: ドキュメントIDは**必ずuserEmail形式**（例: `yasuhirotakuji@gmail.com`）

#### フィールド一覧

| フィールド名 | 日本語名 | 型 | 説明 | 必須 |
|------------|---------|-----|------|------|
| `userId` | ユーザーID | string | ユーザーのメールアドレス | ✅ |
| `unreadCount` | 未読数 | number | 未読メッセージ数 | ✅ |
| `lastUpdatedAt` | 更新日時 | timestamp | 最終更新日時 | ✅ |

**運用ルール**:
- ✅ **正しい例**: `mercari.yasuhirotakuji@gmail.com`
- ❌ **誤った例**: `安廣拓志`（旧userName形式、削除対象）

**更新タイミング**:
- メッセージ受信時: `unreadCount`を+1
- チャットルームを開いた時: `unreadCount`を0にリセット

---

## 👤 users（ユーザー管理）

**用途**: システムに登録されているユーザー情報を管理します。

**パス**: `users/{userId}`

### フィールド一覧

| フィールド名 | 日本語名 | 型 | 説明 | 必須 |
|------------|---------|-----|------|------|
| `userName` | ユーザー名 | string | 表示用のユーザー名 | ✅ |
| `email` | メールアドレス | string | ユーザーのメールアドレス | ✅ |
| `permission` | 権限 | string | `管理者` または `スタッフ` | ✅ |
| `status` | ステータス | string | `アクティブ` または `無効` | ✅ |
| `registeredAt` | 登録日時 | timestamp | ユーザー登録日時 | - |
| `userIconUrl` | アイコンURL | string | プロフィール画像のURL | - |

**権限の種類**:
- `管理者`: すべての機能にアクセス可能
- `スタッフ`: 制限された機能のみアクセス可能

**ステータスの種類**:
- `アクティブ`: ログイン可能
- `無効`: ログイン不可（退職者など）

---

## 📦 products（商品在庫）※GAS側

**用途**: 商品在庫データを管理します（Google Apps Script側で使用）

**パス**: `products/{productId}`

**注意**: このコレクションは主にGAS側で使用されています。PWA版では参照のみ。

### 主要フィールド（抜粋）

| フィールド名 | 日本語名 | 型 | 説明 |
|------------|---------|-----|------|
| `managementNumber` | 管理番号 | string | 商品の管理番号（例: AA-1041） |
| `itemName` | 商品名 | string | 商品の名称 |
| `brand` | ブランド | object | ブランド情報 |
| `category` | カテゴリ | object | カテゴリ情報 |
| `createdBy` | 登録者名 | string | 商品を登録したユーザー名 |
| `createdByEmail` | 登録者メール | string | 登録者のメールアドレス |
| `createdAt` | 登録日時 | timestamp | 商品登録日時 |
| `updatedAt` | 更新日時 | timestamp | 最終更新日時 |

---

## 🌐 platforms（プラットフォームマスタ）

**用途**: 出品先ECプラットフォーム（メルカリ、BASE、Shopify等）の定義をグローバルに管理します。

**パス**: `platforms/{platformId}`

### フィールド一覧

| フィールド名 | 日本語名 | 型 | 説明 | 必須 |
|------------|---------|-----|------|------|
| `id` | プラットフォームID | string | 一意の識別子（例: mercari, shopify） | ✅ |
| `name` | 表示名 | string | UI表示用の名前（例: メルカリ） | ✅ |
| `description` | 説明 | string | プラットフォームの簡潔な説明 | ✅ |
| `icon` | アイコンパス | string | アイコン画像のパス | ✅ |
| `status` | 実装状態 | string | 「実装済」または「準備中」 | ✅ |
| `order` | 表示順 | number | デフォルトの表示順序 | ✅ |
| `isSystem` | システム標準 | boolean | システム標準プラットフォームか | ✅ |
| `category` | カテゴリ | string | 分類（flea-market, ec-platform, mall, global） | - |
| `createdAt` | 作成日時 | timestamp | レコード作成日時 | ✅ |
| `updatedAt` | 更新日時 | timestamp | 最終更新日時 | ✅ |

### 登録プラットフォーム一覧

| ID | 表示名 | カテゴリ |
|----|--------|---------|
| `mercari` | メルカリ | flea-market |
| `mercari-shops` | メルカリShops | flea-market |
| `yahoo-fleamarket` | Yahoo!フリマ | flea-market |
| `yahoo-auction` | Yahoo!オークション | auction |
| `rakuma` | ラクマ | flea-market |
| `base` | BASE | ec-platform |
| `shopify` | Shopify | ec-platform |
| `stores` | STORES | ec-platform |
| `ebay` | eBay | global |
| `amazon` | Amazon | ec-platform |
| `rakuten-ichiba` | 楽天市場 | mall |
| `yahoo-shopping` | Yahoo!ショッピング | mall |

---

## ⚙️ configs（ユーザー設定）

**用途**: ユーザー固有の設定情報を管理します。

**パス**: `configs/{userId}`

### フィールド一覧（プラットフォーム設定）

| フィールド名 | 日本語名 | 型 | 説明 | 必須 |
|------------|---------|-----|------|------|
| `プラットフォーム設定.registrationMode` | 登録モード | string | 「individual」または「batch」 | - |
| `プラットフォーム設定.platforms` | プラットフォーム配列 | array | 各プラットフォームのチェック状態 | - |
| `プラットフォーム設定.platformOrder` | 並び順 | array | プラットフォームIDの配列（ユーザーカスタム順） | - |

---

## 🔍 データの見方（Firebase Console）

### 1. Firestoreにアクセス
https://console.firebase.google.com/ → **reborn-chat** → **Firestore Database**

### 2. コレクション階層の見方

```
📁 rooms（コレクション）
  📄 system（ドキュメント）
    📁 messages（サブコレクション）
      📄 abc123（ドキュメント）
        - text: "メッセージ内容"
        - userName: "安廣拓志"
        - timestamp: 2025-11-22 09:00:00
    📁 unreadCounts（サブコレクション）
      📄 yasuhirotakuji@gmail.com（ドキュメント）← ✅ 正しい形式
        - userId: "yasuhirotakuji@gmail.com"
        - unreadCount: 3
      📄 安廣拓志（ドキュメント）← ❌ 削除対象（旧形式）
        - userId: "安廣拓志"
        - unreadCount: 0
```

### 3. 削除対象の見分け方

**unreadCountsサブコレクション**で：
- ✅ **残すべき**: `@` を含むドキュメントID（メールアドレス形式）
- ❌ **削除すべき**: `@` を含まないドキュメントID（旧userName形式）

---

## 🛠️ よくある操作

### 未読カウントのリセット

**手動リセット方法**:
1. `rooms` → 該当ルーム → `unreadCounts` → 自分のメールアドレス
2. `unreadCount` フィールドを選択
3. 値を `0` に変更 → 保存

### チャットルームの削除

**注意**: ルームを削除すると、以下も**すべて削除**されます：
- メッセージ履歴（`messages`サブコレクション）
- 未読カウント（`unreadCounts`サブコレクション）

**削除方法**:
1. `rooms` → 削除したいルーム
2. 右上のゴミ箱アイコン → 削除確認

---

## 📌 重要な注意事項

### 🚨 削除してはいけないもの

| 項目 | 理由 |
|-----|------|
| `rooms/system` | システム通知ルーム（必須） |
| `rooms/room_default_all` | 全体チャット（必須） |
| `messages` サブコレクション全体 | チャット履歴が消える |
| `@`を含むunreadCounts | 現在使用中のユーザーデータ |

### ✅ 削除して良いもの

| 項目 | 理由 |
|-----|------|
| `@`を含まないunreadCounts | 旧userName形式（使用されていない） |
| 不要な個別チャットルーム | ユーザーが作成した一時ルーム |

---

## 🔄 データフロー図

### チャットメッセージ送信時

```
1. ユーザーがメッセージ入力
   ↓
2. Firestoreに保存
   rooms/{roomId}/messages に追加
   ↓
3. 未読カウント更新
   rooms/{roomId}/unreadCounts/{他のユーザーのメール} の unreadCount +1
   ↓
4. Firebase Functions発火
   FCM通知送信
   ↓
5. 他のユーザーに通知・バッジ表示
```

### 商品登録時（システム通知）

```
1. 商品登録（PWA）
   ↓
2. Firestoreにproduct追加（GAS側）
   ↓
3. Firebase Functions発火
   - rooms/system/messages にメッセージ追加
   - rooms/system/unreadCounts/{全ユーザー} の unreadCount +1
   - FCM通知送信
   ↓
4. 全ユーザーに通知・バッジ表示
```

---

## 📚 関連ドキュメント

- [Firebase公式ドキュメント](https://firebase.google.com/docs/firestore)
- [Firestoreセキュリティルール](./firestore.rules)
- [TDD開発ポリシー](./TDD_POLICY.md)

---

**最終更新**: 2025-11-22
**作成者**: Claude Code
**バージョン**: 1.0
