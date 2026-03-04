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

## 🔴 タスク自動完了ルール（厳守）
`userTasks` にタスクを作成する際、**タスク画面以外で同じ操作が完了した場合の自動完了処理も必ずセットで実装する**。
- 対応する操作の完了関数内で、該当タスクの `completed: true` を更新
- `relatedData` のキー（productId, batchId等）でタスクを特定
- バッジが残り続ける問題を防止する
