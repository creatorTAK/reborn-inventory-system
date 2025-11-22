# iframe クロスオリジン localStorage 問題と解決策

**作成日:** 2025-11-22
**カテゴリ:** アーキテクチャ / トラブルシューティング
**重要度:** 🔴 最高

---

## 📋 概要

PWA（Cloudflare Pages）をiframeで埋め込む際、親ページとiframeが**異なるドメイン**の場合、localStorageは**完全に分離**される。この問題により、ユーザー情報（userName/userEmail）がiframe内で取得できず、「匿名ユーザー」として処理されるバグが発生した。

---

## 🐛 発生した問題

### 症状
- 商品登録時に `createdBy: "匿名ユーザー"`, `createdByEmail: "unknown@example.com"` になる
- チャット通知のアイコンが「匿」（デフォルト値）になる

### 原因
```
親ページ: https://furira.jp/
  ↓ localStorage: { reborn_user_name: "安廣拓志", reborn_user_email: "..." }

iframe: https://reborn-inventory-system.pages.dev/product.html
  ↓ localStorage: {} ← 空！別ドメインなので親のlocalStorageにアクセスできない
```

### アーキテクチャ
```
furira.jp (親ページ)
├── localStorage に userName/userEmail を保存
└── <iframe src="https://reborn-inventory-system.pages.dev/product.html">
    └── 🚨 親ページの localStorage にアクセス不可（Same-Origin Policy）
```

---

## ✅ 解決策

### 1. URLパラメータ方式（採用した方法）

**親ページでiframe URLにパラメータを付与:**

```javascript
// docs/index.html:2180-2190
const userName = localStorage.getItem('reborn_user_name') || '';
const userEmail = localStorage.getItem('reborn_user_email') || '';
const userIconUrl = localStorage.getItem('reborn_user_icon_url') || '';

const params = new URLSearchParams({
  userName: userName,
  userEmail: userEmail,  // 追加
  userIconUrl: userIconUrl,
  sessionId: sessionId
});

iframe.src = pwaBaseUrl + '/product.html?' + params.toString();
```

**iframe内でURLパラメータから取得:**

```javascript
// docs/js/product-scripts.js:8262-8283
const urlParams = new URLSearchParams(window.location.search);
let userEmail = urlParams.get('userEmail') || localStorage.getItem('reborn_user_email');
let userName = urlParams.get('userName') || localStorage.getItem('reborn_user_name');

if (userEmail && userName) {
  const source = urlParams.get('userName') ? 'URLパラメータ' : 'localStorage';
  console.log(`[saveProductToFirestore] ${source}からユーザー情報取得:`, { userEmail, userName });
} else {
  // フォールバック: Firebase Auth → デフォルト値
}
```

**優先順位:**
1. **URLパラメータ**（最優先 - iframe用）
2. localStorage（同一ドメインの場合のフォールバック）
3. Firebase Auth（ログイン済みの場合）
4. デフォルト値（最終手段）

---

## 🎯 実装のポイント

### ✅ 正しい実装
```javascript
// ❌ 間違い（localStorageに依存）
let userName = localStorage.getItem('reborn_user_name') || '匿名ユーザー';

// ✅ 正しい（URLパラメータ優先）
const urlParams = new URLSearchParams(window.location.search);
let userName = urlParams.get('userName') || localStorage.getItem('reborn_user_name');
```

### ✅ デバッグ方法

**iframe内のコンソールでURLパラメータを確認:**

```javascript
// 親ページのコンソールで実行
document.querySelectorAll('iframe').forEach((iframe, i) => {
  console.log(`iframe ${i}:`, iframe.src);
});

// iframeのコンソールに切り替えて実行
const urlParams = new URLSearchParams(window.location.search);
console.log('userName:', urlParams.get('userName'));
console.log('userEmail:', urlParams.get('userEmail'));
```

**コンソールのコンテキスト切り替え:**
1. Consoleタブ左上のドロップダウン（"top"と表示）をクリック
2. `product.html` または `reborn-inventory-system.pages.dev` を選択
3. これでiframe内のコンソールで実行できる

---

## 🚨 Service Worker キャッシュ問題

### 症状
コード修正後も古いコードが実行される

### 原因
Service Workerがファイルをキャッシュしている

### 解決策

**Service Worker削除コマンド:**
```javascript
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
  console.log('Service Worker削除完了');
});
```

**その後:**
1. ページを完全リロード（Cmd+Shift+R / Ctrl+Shift+R）
2. 新しいデータでテスト

---

## 📊 検証結果

### Before（問題発生時）
```
iframe URL:
https://reborn-inventory-system.pages.dev/product.html?userName=安廣拓志&sessionId=...

Firestore保存データ:
{
  createdBy: "匿名ユーザー",  // ❌
  createdByEmail: "unknown@example.com"  // ❌
}
```

### After（修正後）
```
iframe URL:
https://reborn-inventory-system.pages.dev/product.html?userName=安廣拓志&userEmail=mercari.yasuhirotakuji@gmail.com&sessionId=...

Firestore保存データ:
{
  createdBy: "安廣拓志",  // ✅
  createdByEmail: "mercari.yasuhirotakuji@gmail.com"  // ✅
}
```

---

## 🔧 関連修正

### 1. Firebase Functions - システム通知メッセージ

**問題:**
チャットUIが `msg.userName` を期待しているのに、Firebase Functionsは `sender` フィールドのみ保存していた

**修正:**
```javascript
// functions/index.js:201-209
const messageData = {
  id: messageId,
  text: notificationData.content,
  sender: notificationData.sender,
  userName: notificationData.userName,  // ← 追加
  timestamp: new Date(),
  deleted: false,
  type: 'system'
};
```

**影響:**
- システム通知のアイコンが「匿」から「安」（ユーザー名の頭文字）に修正

---

## 📝 コミット履歴

| Commit | 説明 | ファイル |
|--------|------|----------|
| `708d625` | iframe URLパラメータ対応（userEmail追加） | docs/index.html, docs/js/product-scripts.js |
| `1eb8b99` | Firebase Functions userName フィールド追加 | functions/index.js |

---

## 🎓 学んだこと

### 1. Same-Origin Policy の影響
- 異なるドメイン間では localStorage は完全に分離される
- `furira.jp` と `reborn-inventory-system.pages.dev` は別オリジン
- 親ページとiframeでデータ共有するには別の方法が必要

### 2. クロスオリジン通信の選択肢

| 方法 | メリット | デメリット | 採用 |
|------|---------|-----------|------|
| **URLパラメータ** | シンプル、実装が簡単 | URLに情報が見える | ✅ |
| postMessage API | セキュア、双方向通信可能 | 複雑、非同期処理が必要 | - |
| Cookies（SameSite=None） | 自動送信 | HTTPS必須、セキュリティリスク | - |

### 3. デバッグのベストプラクティス
- iframe内のコンソールはコンテキスト切り替えが必要
- URLパラメータの確認が最優先
- Service Workerキャッシュに注意

### 4. フォールバック設計の重要性
```javascript
// 優先順位を明確にする
const value =
  urlParams.get('key') ||        // 1. URLパラメータ（iframe用）
  localStorage.getItem('key') || // 2. localStorage（同一ドメイン用）
  firebaseAuth.currentUser?.key || // 3. Firebase Auth
  'default_value';               // 4. デフォルト値
```

---

## 🔗 関連ドキュメント

- [Firestore データ構造](./firestore-structure.md)
- [TDD 開発ポリシー](./TDD_POLICY.md)
- [デプロイルール](../.serena/memories/DEPLOYMENT_RULES.md)

---

## ⚠️ 今後の注意点

### iframe を使う場合の必須チェックリスト

- [ ] 親ページとiframeのドメインが異なるか確認
- [ ] 異なる場合、URLパラメータでデータを渡す
- [ ] iframe内でURLパラメータを優先的に取得
- [ ] localStorage はフォールバックとして使用
- [ ] デバッグ時はiframeのコンソールに切り替える
- [ ] Service Workerキャッシュをクリアしてテスト

### PWA開発での教訓

1. **Same-Origin Policy を常に意識する**
2. **URLパラメータはシンプルで効果的**
3. **Service Workerは便利だがキャッシュに注意**
4. **複数のフォールバックを用意する**
5. **デバッグ時はコンソールのコンテキストを確認**

---

**最終更新:** 2025-11-22
**作成者:** Claude Code
**検証済み:** AA-1051, AA-1052（完全動作確認）
