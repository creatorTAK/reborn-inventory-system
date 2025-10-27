# 🚀 REBORN Inventory - デプロイルール（厳守）

**このルールは絶対に省略してはいけません**

## ⚠️ 重要な原則

**コード修正 = 必ず両方デプロイ**
- GAS版（スプレッドシート）
- PWA版（Cloudflare Pages）

どちらか一方だけのデプロイは**NG**です。

---

## 📋 標準デプロイフロー（必ず全手順実施）

### Step 1: GASコードアップロード
```bash
npx @google/clasp push
```
- コードをGASにアップロード
- スプレッドシートのサイドバー/メニューには即反映
- **Web Appには未反映**（次のステップが必須）

### Step 2: GAS Web Appデプロイ
```bash
npx @google/clasp deploy
```
- 新しいデプロイIDが発行される
- 例: `AKfycbw7O4NXLGDEMoYZbNLmT1QYcaY0eeniW__Yu4AsxK1LG1ouZkcU6SjmjZc5U0jtK7dVgw @323`
- このIDを次のステップで使用

### Step 3: PWA版のデプロイID更新
```bash
# docs/index.htmlの全箇所（4箇所）を新IDで更新
Edit tool で replace_all: true を使用
```

**更新対象:**
- `GAS_BASE_URL`（1箇所）
- iframe src（1箇所）
- `GAS_API_URL`（1箇所）
- `baseUrl`（1箇所）

### Step 4: Cloudflare Pagesデプロイ
```bash
git add docs/index.html
git commit -m "deploy: Update GAS deployment ID to @XXX (変更内容)"
git push origin main
```
- Cloudflare Pagesが自動デプロイ（1〜2分）
- PWA版に反映

---

## ✅ デプロイチェックリスト

コード修正後、以下を必ず実行：

- [ ] `npx @google/clasp push`
- [ ] `npx @google/clasp deploy`
- [ ] 新しいデプロイIDを確認
- [ ] `docs/index.html`を新IDで更新（4箇所、replace_all: true）
- [ ] `git add docs/index.html`
- [ ] `git commit -m "deploy: ..."`
- [ ] `git push origin main`

**全ステップ完了 = PWA版にも反映完了**

---

## 🚫 やってはいけないこと

❌ `npx @google/clasp push`だけで終わる
❌ `npx @google/clasp deploy`を忘れる
❌ `docs/index.html`の更新を忘れる
❌ git pushを忘れる

**1つでも欠けたら、PWA版は古いバージョンのまま**

---

## 📝 デプロイ時のコミットメッセージ例

```
deploy: Update GAS deployment ID to @323 (販売記録UI改善反映)
deploy: Update GAS deployment ID to @324 (在庫管理バグ修正)
deploy: Update GAS deployment ID to @325 (パフォーマンス改善)
```

---

## 🔄 デプロイ完了の確認方法

1. PWA版を開く
2. ブラウザのDevToolsを開く
3. Consoleで以下を確認：
   - ネットワークタブで新しいデプロイIDのリクエストが飛んでいるか
   - エラーが出ていないか

---

**最終更新: 2025-10-27**
**ルール策定理由: デプロイ手順の省略によりPWA版が未更新になる問題を防ぐため**
