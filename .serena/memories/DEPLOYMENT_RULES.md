# 🚀 REBORN Inventory - デプロイルール（厳守）

**このルールは絶対に省略してはいけません**

## ⚠️ 重要な原則

### 🔴 ドメイン別ホスティング構成

| ドメイン | ホスティング | デプロイ方法 |
|---------|------------|-------------|
| **furira.jp** | **Firebase Hosting** | `git push` → GitHub Actions自動デプロイ |
| reborn-inventory-system.pages.dev | Cloudflare Pages | `git push origin main` |

---

## 🔴🔴🔴 最重要: キャッシュ対策の自動チェック

**JS/CSSファイルを変更したら、必ずHTMLのバージョンパラメータも更新する必要がある**

### デプロイ前の必須チェック手順

```bash
# 1. 変更ファイルを確認
git diff --name-only HEAD~1

# 2. 以下のファイルが含まれていたら、対応するHTMLのバージョンを確認・更新
```

| 変更したファイル | 確認・更新するHTMLファイル | バージョンパラメータ |
|----------------|--------------------------|-------------------|
| `docs/js/product-scripts.js` | `docs/product.html` | `?v=XXX` を更新 |
| `docs/css/product-styles.css` | `docs/product.html` | `?v=XXX` を更新 |
| `docs/js/master-manager.js` | `docs/master-management.html` | `?v=XXX` を更新 |
| `docs/js/config-manager.js` | `docs/config.html` | `?v=XXX` を更新 |

### 自動チェックコマンド（デプロイ前に必ず実行）

```bash
# JS/CSSの変更があるか確認
git diff --name-only | grep -E '\.(js|css)$'

# 変更があった場合、対応するHTMLのバージョンパラメータを確認
# 例: product-scripts.js が変更されていたら
grep 'product-scripts.js?v=' docs/product.html
# → バージョンが古ければ更新する
```

### ⚠️ これを忘れると
- ブラウザは古いJS/CSSをキャッシュから読み込み続ける
- 「変更が反映されない」問題が毎回発生する
- ユーザーが手動でハードリロードしない限り新しいコードが適用されない

---

## 📋 標準デプロイフロー

### PWAファイル修正時（docs/配下）

```bash
# 1. 変更をステージング
git add .

# 2. ⭐ キャッシュ対策チェック（必須）
# 変更したJS/CSSがあれば、対応HTMLのバージョンを更新済みか確認
git diff --cached --name-only | grep -E '\.(js|css)$'

# 3. コミット＆プッシュ
git commit -m "変更内容"
git push origin main

# GitHub Actionsが自動でFirebase Hostingにデプロイ
```

### GASファイル修正時

```bash
npx @google/clasp push
npx @google/clasp deploy --deploymentId AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA --description "変更内容"
```

### Firestoreセキュリティルール修正時

```bash
npx firebase deploy --only firestore:rules
```

---

## 🔧 デプロイID管理

**GAS用固定デプロイID:**
```
AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA
```

---

## 🚫 やってはいけないこと

❌ `npx @google/clasp deploy`（オプションなし）
❌ JS/CSS変更後にHTMLのバージョンパラメータを更新せずにデプロイ

---

**最終更新: 2025-12-08**
**更新内容: キャッシュ対策の自動チェック手順を追加。JS/CSS変更時は必ずHTMLバージョンを更新。**
