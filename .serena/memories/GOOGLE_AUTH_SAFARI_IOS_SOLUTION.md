# Google認証 Safari/iOS 対応ガイド

**作成日**: 2025-11-30
**問題解決**: Safari/iOSでのGoogle Sign-In（Firebase Authentication）

---

## 🎯 結論（最重要）

**Safari/iOS + Cloudflare Pages + Firebase Auth の正解構成：**

```javascript
// authDomainは元のまま（firebaseapp.com）
const firebaseConfig = {
  authDomain: "reborn-chat.firebaseapp.com",  // ← 変更しない
  // ... 他の設定
};

// 全デバイスでポップアップ認証を使用
const result = await signInWithPopup(auth, provider);
```

---

## 📋 問題の経緯

### 症状
1. モバイル（Safari/iOS）でGoogleログイン後、元のページに戻る
2. 認証状態が検出されない（`onAuthStateChanged`が発火しない）
3. Firestoreの`users`コレクションにユーザーが作成されない
4. コンソールに認証関連のログが出ない

### 原因
**Safari/iOSのサードパーティCookie制限**

- `signInWithRedirect`使用時、認証フローは以下:
  1. furira.jp → Google認証画面
  2. Google → reborn-chat.firebaseapp.com（authDomain）
  3. reborn-chat.firebaseapp.com → furira.jp（元のページ）

- Safari/iOSは`firebaseapp.com`のCookieをサードパーティとしてブロック
- リダイレクト後、認証セッション情報が失われる

---

## ❌ 試して失敗したアプローチ

### 1. getRedirectResultのタイミング調整
```javascript
// DOMContentLoaded後に実行
document.addEventListener('DOMContentLoaded', async () => {
  const result = await getRedirectResult(auth);
  // → 結果なし（Cookieがブロックされているため）
});
```
**結果**: 失敗

### 2. onAuthStateChangedで監視
```javascript
onAuthStateChanged(auth, (user) => {
  if (user) handleGoogleAuthResult(user);
});
```
**結果**: 失敗（そもそも発火しない）

### 3. authDomainをカスタムドメインに変更
```javascript
authDomain: "furira.jp",  // カスタムドメインに変更
```
**結果**: ボタンを押しても何も起きなくなった

**原因**: `authDomain`を`furira.jp`にすると、Firebaseは`furira.jp/__/auth/handler`を探す。
Cloudflare Pagesではこのパスが存在しないため、認証フローが開始されない。

### 4. authDomain変更 + ポップアップ認証
```javascript
authDomain: "furira.jp",
// signInWithPopup使用
```
**結果**: 失敗（初期化時点でエラー？）

---

## ✅ 成功したアプローチ

### 最終解決策
```javascript
// authDomainは元のまま
const firebaseConfig = {
  apiKey: "...",
  authDomain: "reborn-chat.firebaseapp.com",  // 変更しない
  projectId: "reborn-chat",
  // ...
};

// 全デバイスでポップアップ認証を使用
async function signInWithGoogle() {
  const auth = window.firebaseAuth;
  const provider = window.firebaseGoogleProvider;
  
  // リダイレクト認証は使わない
  // モバイルでもポップアップ認証を使用
  console.log('[Auth] ポップアップ認証を使用（全デバイス共通）');
  const result = await signInWithPopup(auth, provider);
  await handleGoogleAuthResult(result.user);
}
```

### なぜポップアップ認証は動作するのか？
- ポップアップ認証は同一ウィンドウ内でセッションを管理
- リダイレクトが発生しないため、サードパーティCookie問題を回避
- `authDomain`が異なるドメインでも問題なし

---

## 🔧 必要な設定

### Google Cloud Console
- **承認済みJavaScript生成元**:
  - https://furira.jp
  - https://reborn-furira.pages.dev
  - https://reborn-chat.firebaseapp.com

- **承認済みリダイレクトURI**:
  - https://reborn-chat.firebaseapp.com/__/auth/handler
  - https://furira.jp/__/auth/handler（使わないが念のため追加）

### Firebase Console
- **Authentication → Settings → 承認済みドメイン**:
  - furira.jp
  - reborn-furira.pages.dev

---

## 📝 コード例（完全版）

```javascript
// Firebase初期化
import { getAuth, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",  // 変更しない
  projectId: "YOUR_PROJECT",
  // ...
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// ログイン関数
async function signInWithGoogle() {
  try {
    // 全デバイスでポップアップ認証を使用（Safari/iOS対応）
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    
    console.log('ログイン成功:', user.email);
    
    // Firestoreにユーザー保存
    await saveUserToFirestore(user);
    
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      console.log('ログインがキャンセルされました');
    } else if (error.code === 'auth/popup-blocked') {
      console.log('ポップアップがブロックされました');
    } else {
      console.error('ログインエラー:', error);
    }
  }
}
```

---

## ⚠️ 注意事項

1. **signInWithRedirectは使わない**（Safari/iOSで動作しない）
2. **authDomainは変更しない**（Cloudflare Pagesでは`/__/auth/handler`がないため）
3. **ポップアップブロッカーに注意**（ユーザーにポップアップ許可を案内）

---

## 🔗 参考情報

- ChatGPTからのアドバイス: authDomainをカスタムドメインにする案
- 実際の結果: Cloudflare Pagesでは`/__/auth/handler`が必要なため失敗
- 最終解決: ポップアップ認証で回避

---

**最終更新**: 2025-11-30
