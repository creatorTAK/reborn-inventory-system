# Cloudflare Pages デプロイ構造

## 🎯 重要：URL構造の正しい理解

### プロジェクト構造
```
reborn-project/
├── docs/
│   ├── index.html
│   ├── notifications.html
│   ├── manifest.json
│   └── firebase-messaging-sw.js
└── [その他のファイル]
```

### Cloudflare Pages デプロイ設定
- **Build output directory**: （空欄）
- **Root directory**: `docs`
- **Branch**: `main`

### デプロイ後のURL構造
```
https://reborn-inventory-system.pages.dev/
├── /index.html                    ← docs/index.html
├── /notifications.html            ← docs/notifications.html
├── /manifest.json                 ← docs/manifest.json
└── /firebase-messaging-sw.js     ← docs/firebase-messaging-sw.js
```

## ❌ よくある間違い

### 間違い1: サブディレクトリを想定
```javascript
// ❌ 間違い（404エラー）
window.location.href = '/reborn-inventory-system/notifications.html';

// ✅ 正しい
window.location.href = '/notifications.html';
```

### 間違い2: 相対パスの使用
```javascript
// ❌ 間違い（現在のページによって異なる場所に解決される）
window.location.href = './notifications.html';

// ✅ 正しい
window.location.href = '/notifications.html';
```

### 間違い3: manifest.jsonのパス
```json
// ❌ 間違い
{
  "start_url": "/reborn-inventory-system/",
  "scope": "/reborn-inventory-system/"
}

// ✅ 正しい
{
  "start_url": "/",
  "scope": "/"
}
```

## ✅ パス指定の絶対ルール

### ルール1: 常に絶対パス（`/` から始まる）
```javascript
// PWA内遷移
window.location.href = '/notifications.html';
window.location.href = '/index.html';

// manifest.json参照
<link rel="manifest" href="/manifest.json">

// アイコン参照
<link rel="icon" href="/icon-192.png">
```

### ルール2: 相対パスは使わない
```javascript
// ❌ 禁止（予測不可能な挙動）
window.location.href = './notifications.html';
window.location.href = '../index.html';
```

### ルール3: ドメイン名をパスに含めない
```javascript
// ❌ 間違い
window.location.href = '/reborn-inventory-system/notifications.html';

// ✅ 正しい（プロジェクト名はドメインに含まれる）
// https://reborn-inventory-system.pages.dev/notifications.html
window.location.href = '/notifications.html';
```

## 🧪 デプロイ後の検証チェックリスト

### 1. URL構造の確認
```bash
# ブラウザで以下のURLに直接アクセスして確認
https://reborn-inventory-system.pages.dev/
https://reborn-inventory-system.pages.dev/notifications.html
https://reborn-inventory-system.pages.dev/manifest.json
https://reborn-inventory-system.pages.dev/firebase-messaging-sw.js
```

### 2. F12コンソールで確認
```javascript
// 現在のURL
console.log(window.location.href);

// manifest.jsonの読み込み確認
fetch('/manifest.json')
  .then(r => r.json())
  .then(data => console.log('manifest:', data));

// ページ遷移のテスト
console.log('Testing navigation...');
window.location.href = '/notifications.html';
```

### 3. Service Workerキャッシュの確認
```
F12 → Application → Service Workers
→ "Unregister" ボタンでキャッシュクリア
→ ページリロード
→ 最新版が読み込まれることを確認
```

## 🔧 トラブルシューティング

### 問題: 「ページが見つかりません」（404）
**原因**: パスが間違っている
**解決**:
1. F12 → Network タブで失敗したリクエストのURLを確認
2. `/reborn-inventory-system/` が含まれている場合は削除
3. 絶対パス（`/` から始まる）に修正

### 問題: 「古いコードが残っている」
**原因**: Service Workerキャッシュ
**解決**:
1. Service Workerバージョンをインクリメント（v17 → v18）
2. F12 → Application → Service Workers → Unregister
3. PWAアプリ削除 → 再インストール

### 問題: 「相対パスが予期しない場所に遷移する」
**原因**: 相対パスは現在のページの場所に依存
**解決**: すべて絶対パス（`/` から始まる）に変更

## 📝 今回の教訓（2025-11-06）

### 発生した問題
- ベルマークボタンを押すと商品登録ページにリダイレクト
- 通知ページ（`/notifications.html`）に遷移しない

### 根本原因
- コード内で `/reborn-inventory-system/notifications.html` を指定
- Cloudflare Pagesの実際の構造は `/notifications.html`
- 404エラーで商品登録ページにフォールバック

### 解決策
- 33箇所の `/reborn-inventory-system/` を `/` に一括置換
- manifest.jsonの `start_url`/`scope` を `/` に変更
- Service Worker v17でキャッシュクリア

### 再発防止
- このメモリーファイルをセッション開始時に必ず参照
- パス変更時は絶対パスルールを遵守
- デプロイ後は必ずURLアクセステストを実施

---

**最終更新: 2025-11-06**
**重要度: 🔴 最高（PWAの基本動作に関わる）**
