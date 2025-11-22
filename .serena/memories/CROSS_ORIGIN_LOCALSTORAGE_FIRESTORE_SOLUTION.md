# iframe クロスオリジン localStorage 問題 - クイックリファレンス

**最重要：** 異なるドメイン間でiframeを使う場合、localStorageは共有されない！

## 問題の兆候

- iframe内で localStorage が空になる
- ユーザー情報が「匿名ユーザー」になる
- アイコンがデフォルト値「匿」になる

## 即座の解決策

### 1. URLパラメータで渡す（親ページ）

```javascript
const userName = localStorage.getItem('reborn_user_name') || '';
const userEmail = localStorage.getItem('reborn_user_email') || '';

const params = new URLSearchParams({
  userName: userName,
  userEmail: userEmail,
  sessionId: Date.now()
});

iframe.src = `https://other-domain.com/page.html?${params.toString()}`;
```

### 2. URLパラメータから取得（iframe内）

```javascript
const urlParams = new URLSearchParams(window.location.search);
let userName = urlParams.get('userName') || localStorage.getItem('reborn_user_name');
let userEmail = urlParams.get('userEmail') || localStorage.getItem('reborn_user_email');
```

**優先順位:** URLパラメータ → localStorage → Firebase Auth → デフォルト値

## デバッグ方法

```javascript
// 親ページで実行：iframe URLを確認
document.querySelectorAll('iframe').forEach((iframe, i) => {
  console.log(`iframe ${i}:`, iframe.src);
});

// iframe内で実行：パラメータを確認
const urlParams = new URLSearchParams(window.location.search);
console.log('userName:', urlParams.get('userName'));
console.log('userEmail:', urlParams.get('userEmail'));
```

**重要：** コンソールのコンテキストを iframe に切り替える（左上ドロップダウン）

## Service Worker キャッシュクリア

```javascript
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
  console.log('Service Worker削除完了');
});
```

その後、完全リロード（Cmd+Shift+R / Ctrl+Shift+R）

## 関連ファイル

- 詳細ドキュメント: `docs/CROSS_ORIGIN_IFRAME_LOCALSTORAGE.md`
- 実装例: `docs/index.html:2180-2190`, `docs/js/product-scripts.js:8262-8283`
- Firebase Functions: `functions/index.js:205` (userName フィールド追加)

## 検証済み

- コミット: 708d625, 1eb8b99
- テスト: AA-1051, AA-1052 で完全動作確認
- 日付: 2025-11-22
