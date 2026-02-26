# REBORN Project

REBORN在庫管理システム（Google Apps Script + Bootstrap 5 + Firebase）

---

## 🔴 重要: 2026年1月インシデント対応（進行中）

**詳細: `docs/2026-01_INCIDENT_REPORT.md`**

### 概要
- 2026年1月にGemini APIキー漏洩（公共Wi-Fi経由、被害額¥386）
- reborn-gemini-api: Googleによりロック中（異議申し立て済み）
- reborn-chat: 不正アクセスで¥386課金（2月は沈静化 ¥101予測）

### 対応状況
- [x] `api_key_validator.js` からハードコードされた漏洩キーを除去（2026-02-24）
- [x] Google Cloud Console: 新しいAPIキーを制限付きで発行（Generative Language API のみ）
- [x] GAS Script Properties に新キーを設定（2026-02-24）
- [x] Cloudflare Worker（reborn-help-chatbot）の環境変数を更新（2026-02-24）
- [x] 予算アラート設定済み（¥1,000/月、50%/90%/100%通知）
- [x] Gemini API接続テスト成功（gemini-2.5-flash、2026-02-24）
- [ ] FURIRA 商品登録画面でAI生成の実機テスト
- [ ] ヘルプページのAIチャットボットの動作確認
- [ ] reborn-gemini-api の異議申し立て結果を確認（放置可）

---

## セッション開始ルール

### `/session` 実行時
`.claude/REBORN_SESSION_RULES.md` を読み、記載されたフローに従う。

詳細設定はSerenaメモリに保存されており、必要な時に読み込む：
- `DEPLOYMENT_RULES` - デプロイ手順
- `SESSION_STATE` - セッション状態
- その他プロジェクト固有のメモリ

---

## 🔴 SPA フラグメントルール（厳守）

**全ページはSPAフラグメント方式で動作している。ページのHTML/JS/CSSを修正する場合、必ず `docs/fragments/` 配下のファイルを編集すること。**

- `docs/` 直下の同名HTMLファイル（config.html, menu_home.html等）は**旧iframe版であり使用されていない**
- ページ定義: `docs/js/spa-pages-config.js` の `FURIRA_PAGES`
- 編集前に必ず `spa-pages-config.js` で `fragmentUrl` を確認する
- 詳細マッピング: Serenaメモリ `SPA_FRAGMENT_ARCHITECTURE` を参照

| 修正対象 | 編集するファイル |
|---------|----------------|
| ホーム画面 | `docs/fragments/menu_home.html` |
| 設定画面 | `docs/fragments/config.html` |
| 商品登録 | `docs/fragments/product.html` |
| マスタ管理 | `docs/fragments/master-management.html` |
| その他全ページ | `docs/fragments/*.html` |
| メインシェル・バッジ・SPA基盤 | `docs/index.html` |

---

## 技術スタック
- **バックエンド**: Google Apps Script
- **フロントエンド**: HTML/CSS/JavaScript, Bootstrap 5
- **データベース**: Firestore
- **ホスティング**: Cloudflare Pages（PWA）

## デプロイ
- **GAS**: `clasp push` → `clasp deploy`
- **PWA**: `git push origin main` → GitHub Actions → Firebase Hosting 自動デプロイ

### 🔴 バージョン表示更新（必須）
PWAデプロイ時は `docs/index.html` の `#debug-version` を必ず更新:
- フォーマット: `vMMDD` + アルファベット連番（例: `v0226a` → `v0226b`）
- 日付が変わったらリセット（例: `v0227a`）
