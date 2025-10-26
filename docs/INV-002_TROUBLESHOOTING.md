# INV-002 トラブルシューティング - PWA版在庫管理画面で商品一覧が表示されない

**作成日:** 2025-10-26
**Issue ID:** INV-002

---

## 📋 問題の概要

PWA版（https://www.reborn-inventory.com）の在庫管理画面で、検索ボタンを押しても商品一覧が表示されない。

**症状:**
- NetworkError: HTTP 0
- SyntaxError: Unexpected EOF
- FCM登録デバッグシートに何も記録されない（APIが到達していない）

---

## 🔍 根本原因（特定済み）

### ✅ 発見した根本原因

**sidebar_inventory.htmlのGASへのデプロイが反映されていない**

#### 詳細

1. **アーキテクチャの理解:**
   - docs/index.html (GitHub Pages) → iframeでGAS Web Appを読み込み
   - iframe src: `https://script.google.com/macros/s/.../exec?menu=inventory`
   - **sidebar_inventory.htmlはGASから配信されている**（GitHub Pagesからではない）

2. **ファイルの場所:**
   - sidebar_inventory.html: プロジェクトルート（`./sidebar_inventory.html`）
   - docs/sidebar_inventory.html: **存在しない**
   - → GitHub Pagesには関係ない

3. **デプロイ状況の確認:**
   ```bash
   # ローカルファイルには修正が反映されている
   $ grep -c "fetchJSON" sidebar_inventory.html
   3

   $ grep "window.parent.REBORN_CONFIG" sidebar_inventory.html
   const GAS_BASE_URL = (window.parent && window.parent.REBORN_CONFIG && window.parent.REBORN_CONFIG.GAS_BASE_URL)

   # しかし、デプロイされたバージョンには反映されていない
   $ curl -s "https://www.reborn-inventory.com/sidebar_inventory.html" | grep -c "fetchJSON"
   0
   ```

4. **clasp push状況:**
   ```bash
   $ clasp push
   Script is already up to date.
   ```
   → pushは成功している

5. **デプロイメント状況:**
   ```bash
   $ clasp deployments
   - AKfycbxZLevlCbjY9QdheHAf7TzqyHBKLmToQdSRVG28J8mH @HEAD
   - AKfycbzZjNr6TQW9ZjuwY9s0dKjC15hlXke6bMRhkLaXowmEtgy418t9h1O-DEmcFBx3bmPJ0A @282
   ```

   **問題点:**
   - `@HEAD`: 最新のコード（fetchJSON修正済み）
   - `@282`: 現在有効なWeb Appバージョン（古いコード）
   - **@HEADの修正が@282に反映されていない**

---

## 💡 解決方法

### 必要な作業

**GAS Web Appの再デプロイが必要**

1. **GASエディタで手動デプロイ:**
   - https://script.google.com/home/projects/15gwr6oQUTLjdbNM_8ypqE0ao-7HCEJYrtU_CwJ-uN58PXg6Rhb4kYc71/edit
   - 右上「デプロイ」→「デプロイを管理」
   - 既存のデプロイ（@282）を選択
   - 「バージョンを編集」→「新バージョン」を選択
   - 説明: `INV-002修正 - sidebar_inventory.html fetchJSON実装`
   - 「デプロイ」をクリック

2. **動作確認:**
   ```bash
   # pingエンドポイントで確認
   curl "https://script.google.com/macros/s/AKfycbzZjNr6TQW9ZjuwY9s0dKjC15hlXke6bMRhkLaXowmEtgy418t9h1O-DEmcFBx3bmPJ0A/exec?action=ping"

   # 期待結果
   {"ok":true,"data":{"serverTime":"...","message":"pong"}}
   ```

3. **ブラウザでテスト:**
   - キャッシュクリア（必須）
   - https://www.reborn-inventory.com を開く
   - 在庫管理メニューをクリック
   - 検索ボタンをクリック
   - コンソールで確認:
     ```
     🔍 [DEBUG] API URL: ...
     🔍 [DEBUG] API応答受信: {ok: true, data: {...}}
     ```

---

## 📝 実施済みの対策（効果なし）

以下の対策は実施済みだが、根本原因は**GAS Web Appの再デプロイ未実施**だった。

### 1. docs/index.htmlにGAS_BASE_URL追加 ✅
```html
<script>
  window.REBORN_CONFIG = {
    GAS_BASE_URL: "https://script.google.com/macros/s/.../exec"
  };
</script>
```

### 2. menu.jsにCORS対応追加 ✅
```javascript
function jsonOk_(obj) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: obj }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError_(message) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

function logDebug_Reach(action, params, startTime) {
  // FCM登録デバッグシートにログ記録
}
```

### 3. sidebar_inventory.htmlの修正 ✅
```javascript
// URL取得
const GAS_BASE_URL = (window.parent && window.parent.REBORN_CONFIG && window.parent.REBORN_CONFIG.GAS_BASE_URL)
  || "https://script.google.com/macros/s/.../exec";

// fetchJSONヘルパー
function fetchJSON(url, opts = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...opts, signal: controller.signal, credentials: "omit", cache: "no-store" })
    .then(async (res) => {
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status}: ${text.slice(0,200)}`);
      }
      if (!ct.includes('application/json')) {
        const text = await res.text().catch(() => "");
        throw new Error(`Non-JSON response: ${ct} :: ${text.slice(0,200)}`);
      }
      return res.json();
    })
    .finally(() => clearTimeout(t));
}
```

### 4. clasp push ✅
```bash
$ clasp push
Pushed 10 files.
```

### 5. GitHub Pages push ✅
```bash
$ git push origin main
```

**しかし、GAS Web Appを再デプロイしていなかったため、効果なし。**

---

## 🎯 ChatGPTへの質問内容（まとめ）

以下の情報を整理してChatGPTに再度相談してください。

### 状況サマリー

**問題:**
- PWA版在庫管理画面で検索ボタンを押しても商品一覧が表示されない
- NetworkError: HTTP 0、SyntaxError: Unexpected EOF

**アーキテクチャ:**
- Frontend: GitHub Pages (https://www.reborn-inventory.com)
- Backend: Google Apps Script Web App
- sidebar_inventory.htmlはGASから配信（GitHub Pagesではない）
- iframe src: `https://script.google.com/macros/s/.../exec?menu=inventory`

**実施済みの対策（ChatGPTの提案に基づく）:**
1. docs/index.htmlにREBORN_CONFIG追加 ✅
2. menu.jsにjsonOk_/jsonError_/logDebug_Reach追加 ✅
3. sidebar_inventory.htmlにfetchJSON実装 ✅
4. clasp push完了 ✅
5. GitHub Pages push完了 ✅

**結果:**
- pingエンドポイントは正常動作
- しかし在庫管理画面は依然として失敗

**根本原因（特定済み）:**
- sidebar_inventory.htmlの修正がGASにpushされている（clasp push済み）
- しかし、**GAS Web Appを再デプロイしていない**
- 現在有効なのは古いバージョン（@282）
- 最新のコード（@HEAD）が反映されていない

**質問:**
1. GAS Web Appの再デプロイ手順は正しいか？
2. 他に見落としている可能性はあるか？
3. 再デプロイ後も動作しない場合、次に確認すべき点は？

---

## 📊 デバッグ情報

### 現在のデプロイメント一覧
```
- @HEAD: 最新のコード（fetchJSON修正済み）
- @282: 現在有効なWeb Appバージョン（古いコード）
```

### ファイル確認結果
```bash
# ローカル
$ grep -c "fetchJSON" sidebar_inventory.html
3

# デプロイ済み（GitHub Pages - 関係ない）
$ curl -s "https://www.reborn-inventory.com/sidebar_inventory.html" | grep -c "fetchJSON"
0

# デプロイ済み（GAS - 古いバージョン）
# → Web Appを再デプロイすれば反映されるはず
```

### clasp status
```bash
$ clasp push
Script is already up to date.
```

---

## ✅ 次のアクション

1. **GAS Web Appを手動で再デプロイ**（最優先）
2. ブラウザキャッシュクリア
3. 動作テスト
4. Issue更新（結果を記録）
