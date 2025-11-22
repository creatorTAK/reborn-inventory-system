# REBORN在庫管理システム ドキュメント

このディレクトリには、REBORN在庫管理システムの各種ドキュメントが含まれています。

---

## 📚 主要ドキュメント

### システムアーキテクチャ

- **[Firestoreデータ構造](./firestore-structure.md)** 🆕
  - Firestoreのコレクション・フィールド名を日本語で理解するためのリファレンス
  - Firebase Consoleで見える英語表記を日本語で説明
  - データの見方、削除ルール、よくある操作方法

### 開発ガイド

- **[TDD開発ポリシー](./TDD_POLICY.md)**
  - Issue管理ルール
  - TDD適用判断基準
  - 開発フロー

### Issue管理

- **[Issue一覧サマリー](./issues-summary.md)**
  - 未完了Issue数と優先度別内訳（軽量版）
  - セッション開始時に必ず確認

- **[詳細Issue一覧](./issues.md)**
  - 全Issue詳細（大容量、部分検索推奨）

- **[完了Issue一覧](./issues-closed.md)**
  - 解決済みIssue履歴

---

## 🔥 Firebase関連

### Firestore Database

- **[Firestoreデータ構造ドキュメント](./firestore-structure.md)** 👈 **おすすめ！**
  - コレクション一覧と日本語対応表
  - フィールド名の説明
  - データの見方・削除方法

- **[Firestoreセキュリティルール](./firestore.rules)**
  - アクセス制御ルール
  - デプロイコマンド: `npx firebase deploy --only firestore:rules --project reborn-chat`

### Firebase Functions

- **[Firebase Functions v2](../functions/index.js)**
  - 商品登録時のFCM通知・バッジ処理
  - デプロイコマンド: `npx firebase deploy --only functions --project reborn-chat`

---

## 🚀 デプロイ方法

### PWA版（docs/配下のファイル変更時）

```bash
git add .
git commit -m "変更内容"
git push origin main
# Cloudflare Pagesが自動デプロイ
```

### GAS版（GASファイル変更時）

```bash
npx @google/clasp push
npx @google/clasp deploy --deploymentId AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA --description "変更内容"
```

### Firebase Functions（functions/配下の変更時）

```bash
cd functions
npm install  # 依存関係更新時のみ
cd ..
npx firebase deploy --only functions --project reborn-chat
```

### Firestoreセキュリティルール

```bash
npx firebase deploy --only firestore:rules --project reborn-chat
```

---

## 📖 よくある質問

### Q1. Firestoreのコレクション名が英語で分かりにくい

→ **[Firestoreデータ構造ドキュメント](./firestore-structure.md)** を参照してください。
各コレクション・フィールドの日本語説明があります。

### Q2. 未読バッジが消えない

→ Firebase Console → Firestore Database → `rooms/{roomId}/unreadCounts/{自分のメール}` の `unreadCount` を `0` に設定

### Q3. 商品登録しても通知が来ない

→ Firebase Functions のログを確認:
```bash
npx firebase functions:log --project reborn-chat
```

### Q4. チャット機能でエラーが出る

→ `rooms/system` と `rooms/room_default_all` が存在するか確認

---

## 🛠️ 開発環境

- **PWA**: Cloudflare Pages
- **GAS**: Google Apps Script
- **データベース**: Firestore
- **通知**: Firebase Cloud Messaging (FCM)
- **Functions**: Firebase Functions v2

---

**最終更新**: 2025-11-22
