# REBORN Project

REBORN在庫管理システム（GAS + Bootstrap 5 + Firebase/Firestore）

## 🔴 SPA フラグメントルール（厳守）

**全ページは `docs/fragments/*.html` を編集すること。`docs/` 直下の同名HTMLは旧iframe版で未使用。**

- ページ定義: `docs/js/spa-pages-config.js` の `FURIRA_PAGES`
- メインシェル・SPA基盤: `docs/index.html`

## デプロイ
- **PWA**: `git push origin main` → GitHub Actions → Firebase Hosting 自動デプロイ
- **GAS**: `clasp push` / `clasp deploy` 実行禁止（通知はFirebase Functionsに移行済み）

### 🔴 バージョン表示更新（必須）
docs/配下をコミットする際、同じコミット内で:
1. `docs/index.html` の `#debug-version` テキスト更新
2. `docs/index.html` の `var LOCAL_VER` 更新（同じ値）
- フォーマット: `vMMDD` + アルファベット連番（日付変更でリセット）

## 🔴 プッシュ通知・バッジ保護ルール（厳守）

通知・バッジは複数コンポーネントが連携しており、1箇所の変更が全体を壊す。以下を厳守すること。

### 絶対に変更してはいけない値
- **VAPIDキー**: `docs/index.html` の `VAPID_PUBLIC_KEY` 定数を唯一の定義とし、他の場所でハードコードしない
- **Firebase Config**: SW(`firebase-messaging-sw.js`)とメインページ(`index.html`)で同一の値を使用
- **`activeDevices.fcmTokens`**: 常に `[currentToken]`（配列直接セット）。`arrayUnion` 禁止（古いトークンが蓄積する）

### 変更禁止パターン
- `deleteToken()` をアプリ起動時に呼ばない（有効なトークンが破壊される）
- `firebase.messaging()` を Service Worker 内で初期化しない（二重通知の原因）
- `getToken()` を呼ぶ際は必ず `vapidKey: VAPID_PUBLIC_KEY` と `serviceWorkerRegistration` を渡す

### アーキテクチャ詳細
`claudedocs/PWA_NOTIFICATION_BADGE_ARCHITECTURE.md` に全体構成・iOS固有の制約・過去のバグ事例・テスト手順をまとめてある。変更前に必ず読むこと。

### 変更時の必須チェックリスト
以下のファイルを変更する場合、**変更前に**このチェックリストを確認:
- `docs/firebase-messaging-sw.js`
- `docs/index.html` 内の `getToken`, `refreshDeviceRegistration`, `sendPushToOwners`, `updateAppBadge`, `syncServiceWorkerBadgeCount`
- `functions/index.js` 内の `sendChatNotifications`, `sendFCMNotifications`, `onChatMessageCreated`

チェック項目:
1. VAPIDキーは `VAPID_PUBLIC_KEY` 定数を参照しているか？（ハードコード禁止）
2. `getToken()` に `serviceWorkerRegistration` を渡しているか？
3. SWに `firebase.messaging()` を追加していないか？
4. `activeDevices.fcmTokens` に `arrayUnion` を使っていないか？
5. `deleteToken()` をアプリ起動時フローに入れていないか？

## 🔴 タスク自動完了ルール（厳守）
`userTasks` にタスクを作成する際、**タスク画面以外で同じ操作が完了した場合の自動完了処理も必ずセットで実装する**。
- 対応する操作の完了関数内で、該当タスクの `completed: true` を更新
- `relatedData` のキー（productId, batchId等）でタスクを特定
- バッジが残り続ける問題を防止する
