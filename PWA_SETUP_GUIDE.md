# PWA + GAS + postMessage 完全セットアップガイド

**最終更新日**: 2025年10月17日
**対象**: 他のプロジェクトで同じ構成を再現したい開発者向け
**所要時間**: 約1時間で基本構成を再現可能

---

## 📋 目次

1. [はじめに](#はじめに)
2. [アーキテクチャ概要](#アーキテクチャ概要)
3. [前提条件](#前提条件)
4. [セットアップ手順（ステップバイステップ）](#セットアップ手順)
5. [postMessage実装の完全ガイド](#postmessage実装の完全ガイド)
6. [トラブルシューティング](#トラブルシューティング)
7. [セキュリティ考慮事項](#セキュリティ考慮事項)
8. [最小構成テンプレートコード](#最小構成テンプレートコード)
9. [チェックリスト](#チェックリスト)

---

## はじめに

### このガイドの目的

このガイドは、**REBORN プロジェクト**で実装した以下の技術構成を、他のプロジェクトで即座に再現するための完全マニュアルです。

**実現できること**:
- ✅ カスタムドメイン（例: www.your-app.com）でアプリ公開
- ✅ iPhoneホーム画面に追加可能なPWA
- ✅ 全画面表示（ネイティブアプリ並み）
- ✅ Google Apps Script（GAS）のビジネスロジックをそのまま活用
- ✅ PWA内でのタブ切り替え（Safariに飛ばない）
- ✅ プッシュ通知（Service Worker）
- ✅ チーム利用・SaaS化の基盤

### なぜこの構成が必要か

**GAS単体の制約**:
- ❌ Service Workerが使えない（プッシュ通知不可）
- ❌ カスタムドメインが使えない
- ❌ 警告メッセージが表示される

**この構成のメリット**:
- ✅ GASの強み（スプレッドシート連携、無料、簡単）を維持
- ✅ PWAの強み（Service Worker、カスタムドメイン）を獲得
- ✅ 両方のいいとこ取り

---

## アーキテクチャ概要

### 全体構成図

```
┌─────────────────────────────────────────────┐
│ Cloudflare Pages                             │
│ https://www.your-app.com                     │
│                                               │
│ ┌─────────────────────────────────────────┐ │
│ │ index.html（親ウィンドウ）               │ │
│ │ ├── postMessage受信処理                  │ │
│ │ ├── Service Worker登録                   │ │
│ │ └── iframe（GAS Web App）                │ │
│ └─────────────────────────────────────────┘ │
│                                               │
│ ┌─────────────────────────────────────────┐ │
│ │ firebase-messaging-sw.js                 │ │
│ │ └── プッシュ通知処理                     │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
                    ↕ postMessage
┌─────────────────────────────────────────────┐
│ GAS Web App                                  │
│ https://script.google.com/macros/s/[ID]/exec│
│                                               │
│ ┌─────────────────────────────────────────┐ │
│ │ script.google.com（外側iframe）          │ │
│ │ └── googleusercontent.com（内側iframe）  │ │
│ │     ├── sidebar_page1.html               │ │
│ │     ├── sidebar_page2.html               │ │
│ │     └── postMessage送信処理              │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ Google Spreadsheet                           │
│ ├── データ保存                               │
│ └── ビジネスロジック                         │
└─────────────────────────────────────────────┘
```

### 技術スタック

**フロントエンド（Cloudflare Pages）**:
- HTML5, CSS3, JavaScript（ES6+）
- Service Worker API
- postMessage API
- Firebase Cloud Messaging（FCM）

**バックエンド（Google Apps Script）**:
- JavaScript（GAS環境）
- HTML Service
- Spreadsheet Service
- XFrameOptionsMode.ALLOWALL

**インフラ**:
- Cloudflare Pages（静的ホスティング、カスタムドメイン、SSL自動）
- GitHub（バージョン管理、自動デプロイ）
- Firebase（プッシュ通知）

---

## 前提条件

### 必要なアカウント

- ✅ Google アカウント（GAS・スプレッドシート用）
- ✅ GitHub アカウント（コード管理用）
- ✅ Cloudflare アカウント（Pages・カスタムドメイン用）
- ✅ Firebase アカウント（プッシュ通知用、Googleアカウントで登録可能）
- ✅ カスタムドメイン（取得済み、例: your-app.com）

### 必要な知識

- 基本的なHTML/CSS/JavaScript
- Git/GitHubの基本操作
- Google Apps Scriptの基本（または学習意欲）

### 必要なツール

- Visual Studio Code（または任意のエディタ）
- Git CLI
- Node.js（clasp CLI用）
- clasp CLI（`npm install -g @google/clasp`）

---

## セットアップ手順

### Phase 1: GitHubリポジトリ作成

**所要時間**: 5分

1. **GitHub で新規リポジトリ作成**
   - リポジトリ名: `your-app-name`
   - Visibility: Public（GitHub Pages/Cloudflare Pages利用のため）
   - Initialize with README: ✓

2. **ローカルにクローン**
   ```bash
   git clone https://github.com/your-username/your-app-name.git
   cd your-app-name
   ```

3. **ディレクトリ構成作成**
   ```bash
   mkdir docs
   touch docs/index.html
   touch docs/manifest.json
   touch docs/firebase-messaging-sw.js
   ```

---

### Phase 2: GAS プロジェクト作成

**所要時間**: 10分

1. **Google Apps Script プロジェクト作成**
   - https://script.google.com/ にアクセス
   - 「新しいプロジェクト」をクリック
   - プロジェクト名を設定（例: your-app-name）

2. **clasp でローカルと連携**
   ```bash
   clasp login
   clasp create --type standalone --title "your-app-name" --rootDir .
   ```

3. **menu.js を作成**（後述のテンプレート参照）

4. **XFrameOptionsMode 設定**
   ```javascript
   // menu.js
   function doGet(e) {
     const html = HtmlService.createHtmlOutputFromFile('sidebar_page1');
     return html
       .setTitle('Your App')
       .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
       .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
       .setSandboxMode(HtmlService.SandboxMode.IFRAME);
   }
   ```

5. **ウェブアプリとしてデプロイ**
   - Apps Scriptエディタ: 「デプロイ」→「新しいデプロイ」
   - 種類: ウェブアプリ
   - 次のユーザーとして実行: 自分
   - アクセスできるユーザー: 全員
   - デプロイ → URLをコピー（`https://script.google.com/macros/s/[ID]/exec`）

---

### Phase 3: Firebase プロジェクト設定

**所要時間**: 10分

1. **Firebase プロジェクト作成**
   - https://console.firebase.google.com/ にアクセス
   - 「プロジェクトを追加」
   - プロジェクト名を入力（例: your-app-name）
   - Google Analytics: 不要なら無効化

2. **Cloud Messaging 設定**
   - プロジェクト設定 → Cloud Messaging
   - 「ウェブプッシュ証明書」を生成
   - 公開鍵（VAPID key）をコピー

3. **ウェブアプリ登録**
   - プロジェクト設定 → 全般 → アプリを追加 → ウェブ
   - アプリのニックネーム: your-app-name
   - Firebase SDK configuration をコピー（後で使用）

---

### Phase 4: Cloudflare Pages デプロイ

**所要時間**: 15分

1. **Cloudflare Pages プロジェクト作成**
   - https://dash.cloudflare.com/ にアクセス
   - Workers & Pages → Pages → プロジェクトを作成
   - GitHub リポジトリに接続
   - リポジトリ選択: `your-app-name`

2. **ビルド設定**
   - ビルドコマンド: （空欄）
   - ビルド出力ディレクトリ: `docs`
   - ルートディレクトリ: `/`

3. **デプロイ開始**
   - 「保存してデプロイ」
   - 数分で完了（例: `https://your-app-name.pages.dev`）

4. **カスタムドメイン設定**
   - プロジェクト → カスタムドメイン → ドメインを追加
   - ドメイン名: `www.your-app.com`
   - CNAME レコード自動追加（Cloudflare管理の場合）
   - SSL証明書自動発行（Let's Encrypt）
   - 検証完了まで数分待機

---

### Phase 5: PWA基本ファイル作成

**所要時間**: 15分

1. **docs/index.html** を作成（後述のテンプレート参照）

2. **docs/manifest.json** を作成
   ```json
   {
     "name": "Your App Name",
     "short_name": "YourApp",
     "start_url": "/",
     "display": "standalone",
     "background_color": "#ffffff",
     "theme_color": "#667eea",
     "icons": [
       {
         "src": "icon-192.png",
         "sizes": "192x192",
         "type": "image/png"
       },
       {
         "src": "icon-512.png",
         "sizes": "512x512",
         "type": "image/png"
       }
     ]
   }
   ```

3. **docs/firebase-messaging-sw.js** を作成
   ```javascript
   importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
   importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

   firebase.initializeApp({
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   });

   const messaging = firebase.messaging();

   messaging.onBackgroundMessage((payload) => {
     console.log('バックグラウンドメッセージ受信:', payload);
     const notificationTitle = payload.notification.title;
     const notificationOptions = {
       body: payload.notification.body,
       icon: '/icon-192.png'
     };
     self.registration.showNotification(notificationTitle, notificationOptions);
   });
   ```

4. **アイコン画像を追加**
   - `docs/icon-192.png`（192x192px）
   - `docs/icon-512.png`（512x512px）

5. **Git commit & push**
   ```bash
   git add docs/
   git commit -m "feat: PWA基本ファイル追加"
   git push origin main
   ```

6. **Cloudflare Pages 自動デプロイ確認**
   - 数分後、`https://www.your-app.com` にアクセス
   - PWAが表示されることを確認

---

### Phase 6: postMessage 実装

**所要時間**: 10分

1. **docs/index.html に postMessage受信処理を追加**
   ```javascript
   window.addEventListener('message', function(event) {
     const isValidOrigin = event.origin === 'https://script.google.com' ||
                          event.origin.includes('googleusercontent.com');

     if (!isValidOrigin) {
       console.warn('⚠️ 不正なオリジン:', event.origin);
       return;
     }

     if (event.data.type === 'navigate' && event.data.url) {
       const iframe = document.getElementById('gas-iframe');
       iframe.src = event.data.url;
     }
   });
   ```

2. **GAS側（sidebar_page1.html, sidebar_page2.html）に postMessage送信処理を追加**
   ```javascript
   function navigateInPWA(url) {
     if (window.top && window.top !== window.self) {
       window.top.postMessage({
         type: 'navigate',
         url: url
       }, '*');
     } else {
       window.location.href = url;
     }
   }
   ```

3. **clasp push & デプロイ**
   ```bash
   clasp push -f
   # Apps Scriptエディタで手動デプロイ（新バージョン）
   ```

4. **動作確認**
   - PCブラウザで `https://www.your-app.com` にアクセス
   - 開発者ツールのコンソールを開く
   - タブ切り替え時に `📤 postMessage送信` と `📨 受信メッセージ` が表示されることを確認

---

### Phase 7: プッシュ通知の実装（FCM + GAS）

**所要時間**: 30分
**難易度**: 中級（CORS問題の理解が必要）

#### 概要

iPhoneのPWAからGAS経由でFCM（Firebase Cloud Messaging）プッシュ通知を送信する実装。日本語・絵文字・改行を含む通知を正しく送信するため、**Base64エンコード方式**を採用。

#### 背景: CORS問題との戦い

**最初の試み（失敗）**: POSTメソッド + JSON

```javascript
// ❌ この方法は動かない
const response = await fetch(GAS_API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'sendFCM',
    title: '🎉 REBORN サーバー通知（FCM）',
    body: '商品が売れました！\n管理番号: AA-1002'
  })
});
```

**エラー**:
```
Preflight response is not successful. Status code: 405
```

**原因**:
- ブラウザがPOSTリクエスト前にOPTIONSリクエスト（プリフライト）を送信
- Apps ScriptにはOPTIONSメソッドのハンドラー（`doOptions()`）がない
- `setHeader()` も使えない
- → CORSプリフライトに対応不可

#### 解決策: GETメソッド + Base64エンコード

**採用した方式**:
- GETメソッドでリクエスト（CORSプリフライト回避）
- URLパラメータにBase64エンコードした文字列を送信
- 日本語・絵文字・改行を正しく送信可能

#### PWA側の実装

```javascript
// docs/index.html

// 通知内容（日本語・絵文字・改行を含む）
const title = '🎉 REBORN サーバー通知（FCM）';
const body = '商品が売れました！\n管理番号: AA-1002\n出品先: メルカリ\n販売金額: 5,280円';

// Base64エンコード
const titleEncoded = btoa(encodeURIComponent(title));
const bodyEncoded = btoa(encodeURIComponent(body));

// GETリクエスト
const GAS_API_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
const url = GAS_API_URL + '?action=sendFCM&title=' + titleEncoded + '&body=' + bodyEncoded;

const response = await fetch(url);
const result = await response.json();

if (result.status === 'success') {
  console.log('✅ 通知送信成功');
} else {
  console.error('❌ 通知送信失敗:', result.message);
}
```

#### GAS側の実装

```javascript
// menu.js

function doGet(e) {
  const action = e.parameter.action;

  if (action === 'sendFCM') {
    // URLパラメータからBase64エンコードされた文字列を取得
    const titleEncoded = e.parameter.title || '';
    const bodyEncoded = e.parameter.body || '';

    // デフォルト値
    let title = 'REBORN';
    let body = 'テスト通知です';

    // Base64デコード + URIデコード
    try {
      if (titleEncoded) {
        const titleBytes = Utilities.base64Decode(titleEncoded);
        const titleDecoded = Utilities.newBlob(titleBytes).getDataAsString();
        title = decodeURIComponent(titleDecoded);
      }
      if (bodyEncoded) {
        const bodyBytes = Utilities.base64Decode(bodyEncoded);
        const bodyDecoded = Utilities.newBlob(bodyBytes).getDataAsString();
        body = decodeURIComponent(bodyDecoded);
      }
    } catch (decodeError) {
      Logger.log('パラメータのデコードに失敗: ' + decodeError);
    }

    // FCM通知を送信
    const result = sendFCMNotification(title, body);

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 通常のHTML表示
  // ... (既存のdoGet処理)
}

function sendFCMNotification(title, body) {
  try {
    // Firebase Admin SDKのアクセストークンを取得
    const accessToken = getAccessToken();

    // FCMトークンをスプレッドシートから取得
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('FCMトークン');
    const tokens = sheet.getRange('A2:A').getValues().flat().filter(String);

    if (tokens.length === 0) {
      return { status: 'error', message: 'FCMトークンが登録されていません' };
    }

    // FCM HTTP v1 API で送信
    const projectId = 'YOUR_FIREBASE_PROJECT_ID';
    const url = 'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send';

    tokens.forEach(token => {
      const payload = {
        message: {
          token: token,
          notification: {
            title: title,
            body: body
          }
        }
      };

      const options = {
        method: 'post',
        headers: {
          'Authorization': 'Bearer ' + accessToken,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options);
      Logger.log('FCM Response: ' + response.getContentText());
    });

    return { status: 'success', message: '通知を送信しました' };

  } catch (error) {
    Logger.log('FCM Error: ' + error);
    return { status: 'error', message: error.toString() };
  }
}

function getAccessToken() {
  // Firebase Admin SDK の Service Account JSON をスクリプトプロパティから取得
  const serviceAccountJson = PropertiesService.getScriptProperties().getProperty('FIREBASE_SERVICE_ACCOUNT');
  const serviceAccount = JSON.parse(serviceAccountJson);

  // OAuth2 でアクセストークンを取得
  const url = 'https://oauth2.googleapis.com/token';
  const payload = {
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: createJWT(serviceAccount)
  };

  const options = {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: payload,
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const result = JSON.parse(response.getContentText());
  return result.access_token;
}

function createJWT(serviceAccount) {
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: serviceAccount.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = Utilities.base64EncodeWebSafe(JSON.stringify(header));
  const encodedClaim = Utilities.base64EncodeWebSafe(JSON.stringify(claim));
  const signature = Utilities.computeRsaSha256Signature(
    encodedHeader + '.' + encodedClaim,
    serviceAccount.private_key
  );
  const encodedSignature = Utilities.base64EncodeWebSafe(signature);

  return encodedHeader + '.' + encodedClaim + '.' + encodedSignature;
}
```

#### Firebase Service Account の設定

1. **Firebase Console でService Account作成**
   - プロジェクト設定 → サービスアカウント
   - 「新しい秘密鍵の生成」
   - JSONファイルをダウンロード

2. **GAS Script Propertiesに保存**
   ```javascript
   // Apps Script エディタ: プロジェクトの設定 → スクリプト プロパティ
   // キー: FIREBASE_SERVICE_ACCOUNT
   // 値: { "type": "service_account", "project_id": "...", ... } (JSONファイルの内容)
   ```

#### テスト結果

**iPhone PWAでの確認**:
- ✅ 日本語が正しく表示（「商品が売れました！」）
- ✅ 絵文字が正しく表示（🎉）
- ✅ 改行が正しく反映（4行の本文）
- ✅ CORS問題を完全に回避

**通知例**:
```
タイトル: 🎉 REBORN サーバー通知（FCM）

本文:
商品が売れました！
管理番号: AA-1002
出品先: メルカリ
販売金額: 5,280円
```

#### 重要な注意点

**iPhoneのPWA通知の仕様**:
- ✅ バックグラウンド時: 通知が表示される
- ❌ フォアグラウンド時: 通知が表示されない（iOS仕様）
- → ボタンを押した後、**すぐにホーム画面に戻る**と通知が届く

#### 教訓

1. **Apps ScriptのCORS制約**
   - POSTメソッドは `doOptions()` が実装できないため、CORSプリフライトに対応不可
   - GETメソッド + Base64エンコードが最も確実

2. **固定値テストの重要性**
   - パラメータ問題とエンコード問題を切り分けられる
   - 根本原因の特定に不可欠

3. **Base64エンコードの信頼性**
   - 日本語・絵文字・改行を含むテキストでも完全に動作
   - URLパラメータの長さ制限に注意（約2000文字まで）

---

## postMessage実装の完全ガイド

### GASの2重iframe構造

**重要**: GAS Web Appは2重のiframe構造になっています。

```
親ウィンドウ（Cloudflare Pages）
└── iframe: script.google.com（外側）
    └── iframe: googleusercontent.com（内側・サンドボックス） ← 実際のコードはここ
```

**ポイント**:
- `window.parent` → 外側iframeまでしか届かない ❌
- `window.top` → 親ウィンドウまで届く ✅

### 送信側（GAS iframe内）

**基本パターン**:
```javascript
function navigateInPWA(url) {
  try {
    // iframe内にいる場合、最上位ウィンドウに送信
    if (window.top && window.top !== window.self) {
      console.log('📤 postMessage送信 (to window.top):', url);
      window.top.postMessage({
        type: 'navigate',
        url: url
      }, '*'); // ワイルドカード必須（GASサンドボックスから送信）
    } else {
      // iframe外の場合
      window.location.href = url;
    }
  } catch (e) {
    console.error('❌ ナビゲーションエラー:', e);
    window.location.href = url; // フォールバック
  }
}
```

**使用例**:
```html
<a href="#" onclick="navigateInPWA('<?= ScriptApp.getService().getUrl() ?>?page=2'); return false;">
  ページ2へ
</a>
```

### 受信側（親ウィンドウ）

**基本パターン**:
```javascript
window.addEventListener('message', function(event) {
  // セキュリティ: GASのサンドボックスiframeからのメッセージを許可
  const isValidOrigin = event.origin === 'https://script.google.com' ||
                       event.origin.includes('googleusercontent.com');

  if (!isValidOrigin) {
    console.warn('⚠️ 不正なオリジンからのメッセージを拒否:', event.origin);
    return;
  }

  console.log('📨 受信メッセージ (from ' + event.origin + '):', event.data);

  // ナビゲーション要求の処理
  if (event.data.type === 'navigate' && event.data.url) {
    const iframe = document.getElementById('gas-iframe');
    console.log('🚀 ナビゲーション:', event.data.url);
    iframe.src = event.data.url;
  }
});
```

### メッセージフォーマット

**標準フォーマット**:
```javascript
{
  type: 'navigate',      // メッセージタイプ
  url: 'https://...'     // ナビゲーション先URL
}
```

**拡張例**（将来的な機能追加）:
```javascript
// データ送信
{
  type: 'data',
  action: 'save',
  payload: { productId: 123, name: 'Product Name' }
}

// 通知送信
{
  type: 'notification',
  title: '商品が保存されました',
  body: '管理番号: AA-1001'
}
```

---

## トラブルシューティング

### 問題1: タブをクリックしても反応しない

**症状**:
- タブナビゲーションをクリックしても何も起きない
- コンソールにエラーもログもない

**原因**:
- `window.parent` を使用している（2重iframe構造に未対応）

**解決策**:
```javascript
// ❌ NG
window.parent.postMessage(...);

// ✅ OK
window.top.postMessage(...);
```

**確認方法**:
```javascript
console.log('window.self:', window.self);
console.log('window.parent:', window.parent);
console.log('window.top:', window.top);
console.log('window.parent !== window.top:', window.parent !== window.top);
// → true なら2重iframe構造
```

---

### 問題2: postMessage送信エラー（`Unable to post message`）

**症状**:
- コンソールに `Unable to post message to https://www.your-app.com. Recipient has origin https://...googleusercontent.com.` エラー

**原因**:
- ターゲットオリジンが厳密すぎる（GASサンドボックスから送信できない）

**解決策**:
```javascript
// ❌ NG
window.top.postMessage({ type: 'navigate', url: url }, 'https://www.your-app.com');

// ✅ OK
window.top.postMessage({ type: 'navigate', url: url }, '*');
```

**セキュリティ注意**:
- ワイルドカード `'*'` を使うのはGASサンドボックスの制約のため
- 受信側でオリジンチェックを厳密に行うことで安全性を確保

---

### 問題3: オリジンチェックでメッセージが拒否される

**症状**:
- コンソールに `⚠️ 不正なオリジンからのメッセージを拒否` と表示

**原因**:
- オリジンチェックの条件が厳しすぎる

**解決策**:
```javascript
// ❌ NG（script.google.comのみ許可）
if (event.origin !== 'https://script.google.com') {
  return;
}

// ✅ OK（googleusercontent.comも許可）
const isValidOrigin = event.origin === 'https://script.google.com' ||
                     event.origin.includes('googleusercontent.com');

if (!isValidOrigin) {
  return;
}
```

**デバッグ方法**:
```javascript
// 受信側でオリジンをログ出力
window.addEventListener('message', function(event) {
  console.log('📨 受信オリジン:', event.origin);
  console.log('📨 受信データ:', event.data);
  // ...
});
```

---

### 問題4: CSS変数未定義（背景色が表示されない）

**症状**:
- タブナビゲーションヘッダーの背景が白い（グラデーションが表示されない）

**原因**:
- CSS変数 `--primary-gradient` が定義されていない

**解決策**:
```html
<!-- スタイルシート（例: sp_styles.html）を include -->
<?!= include('sp_styles'); ?>

<!-- sp_styles.html で CSS変数を定義 -->
<style>
  :root {
    --primary-gradient: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    --primary-color: #667eea;
  }

  .tab-nav-header {
    background: var(--primary-gradient);
  }
</style>
```

---

### 問題5: スクロール時に内部メニューがヘッダーに重なる

**症状**:
- スクロールすると、内部メニュー（例: 管理番号設定、セールスワード等）がタブナビゲーションヘッダーの上に表示される

**原因**:
- z-index の競合

**解決策**:
```css
/* タブナビゲーションヘッダー（最上位） */
.tab-nav-header {
  position: sticky;
  top: 0;
  z-index: 1000; /* 高い値 */
}

/* 内部メニュー（下位） */
.nav-tabs {
  position: relative;
  z-index: 1; /* 低い値 */
}
```

---

### 問題6: iPhoneでPWAが全画面表示されない

**症状**:
- iPhoneでホーム画面に追加しても、Safariのアドレスバーが表示される

**原因**:
- manifest.json の `display` 設定が不正
- またはmetaタグが不足

**解決策**:
```json
// manifest.json
{
  "display": "standalone", // ← 必須
  "start_url": "/",
  "scope": "/"
}
```

```html
<!-- iOS専用のmetaタグ -->
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Your App">
<link rel="apple-touch-icon" href="icon-180.png">
```

---

### 問題7: Service Workerが登録できない

**症状**:
- コンソールに `Service Worker registration failed` エラー

**原因**:
- HTTPSでない（localhostを除く）
- Service Workerのパスが間違っている

**解決策**:
```javascript
// ✅ OK（ルートパス）
navigator.serviceWorker.register('/firebase-messaging-sw.js')

// ❌ NG（相対パス）
navigator.serviceWorker.register('./firebase-messaging-sw.js')

// ❌ NG（サブディレクトリ）
navigator.serviceWorker.register('/docs/firebase-messaging-sw.js')
// → scope が /docs/ に限定される
```

**確認方法**:
```javascript
navigator.serviceWorker.register('/firebase-messaging-sw.js')
  .then(registration => {
    console.log('✅ Service Worker 登録成功:', registration.scope);
  })
  .catch(error => {
    console.error('❌ Service Worker 登録失敗:', error);
  });
```

---

### 問題8: POSTメソッドでCORSエラー（FCM通知送信時）

**症状**:
- PWAからGASにPOSTリクエストを送信すると `Preflight response is not successful. Status code: 405` エラー
- OPTIONSリクエスト（プリフライト）で失敗

**原因**:
- Apps ScriptにはOPTIONSメソッドのハンドラー（`doOptions()`）がない
- `setHeader()` も使えない
- → CORSプリフライトに対応不可

**解決策: GETメソッド + Base64エンコード**

```javascript
// PWA側（送信）
const title = '🎉 REBORN サーバー通知（FCM）';
const body = '商品が売れました！\n管理番号: AA-1002';

const titleEncoded = btoa(encodeURIComponent(title));
const bodyEncoded = btoa(encodeURIComponent(body));

const url = GAS_API_URL + '?action=sendFCM&title=' + titleEncoded + '&body=' + bodyEncoded;
const response = await fetch(url); // GETリクエスト

// GAS側（受信）
function doGet(e) {
  if (e.parameter.action === 'sendFCM') {
    const titleBytes = Utilities.base64Decode(e.parameter.title);
    const titleDecoded = Utilities.newBlob(titleBytes).getDataAsString();
    const title = decodeURIComponent(titleDecoded);

    // 同様にbodyもデコード
    // ...
  }
}
```

**メリット**:
- ✅ CORS問題を完全に回避
- ✅ 日本語・絵文字・改行を正しく送信可能
- ✅ 固定値テストで動作確認済みの経路を使用

**デメリット**:
- ⚠️ URLパラメータの長さ制限（約2000文字まで）

---

### 問題9: iPhone PWAで通知が表示されない

**症状**:
- FCM送信が成功しているのに、iPhoneに通知が表示されない

**原因**:
- iPhoneのPWAは**フォアグラウンド時に通知が表示されない仕様**

**解決策**:
- ボタンを押した後、**すぐにホーム画面に戻る**
- 数秒後にバックグラウンドで通知が届く

**デバッグ方法**:
```javascript
// GAS側でログ出力
Logger.log('FCM送信結果:', response.getContentText());

// スプレッドシートにデバッグログを書き込む
const debugSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('デバッグログ');
debugSheet.appendRow([new Date(), 'FCM送信', title, body, response.getContentText()]);
```

**確認ポイント**:
- ✅ FCMトークンが正しく登録されているか
- ✅ Firebase Service Accountが正しく設定されているか
- ✅ アクセストークンが正しく取得できているか
- ✅ FCM APIのレスポンスが成功しているか

---

## セキュリティ考慮事項

### 1. オリジンチェックの重要性

**必ず実装すべき**:
```javascript
window.addEventListener('message', function(event) {
  // ホワイトリスト方式
  const allowedOrigins = [
    'https://script.google.com',
    'https://n-*.googleusercontent.com' // ワイルドカード（正規表現で実装）
  ];

  const isValid = allowedOrigins.some(origin => {
    if (origin.includes('*')) {
      const regex = new RegExp(origin.replace('*', '.*'));
      return regex.test(event.origin);
    }
    return event.origin === origin;
  });

  if (!isValid) {
    console.warn('⚠️ 不正なオリジン:', event.origin);
    return;
  }

  // メッセージ処理
});
```

### 2. メッセージタイプの検証

**推奨パターン**:
```javascript
const ALLOWED_MESSAGE_TYPES = ['navigate', 'data', 'notification'];

if (!ALLOWED_MESSAGE_TYPES.includes(event.data.type)) {
  console.warn('⚠️ 不正なメッセージタイプ:', event.data.type);
  return;
}
```

### 3. URLの検証

**推奨パターン**:
```javascript
if (event.data.type === 'navigate' && event.data.url) {
  // URLが想定内のドメインか確認
  const url = new URL(event.data.url);
  if (url.origin !== 'https://script.google.com') {
    console.warn('⚠️ 不正なナビゲーション先:', event.data.url);
    return;
  }

  iframe.src = event.data.url;
}
```

### 4. CSP（Content Security Policy）

**推奨設定**（meta tag）:
```html
<meta http-equiv="Content-Security-Policy" content="
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.gstatic.com;
  connect-src 'self' https://fcm.googleapis.com https://script.google.com;
  frame-src https://script.google.com https://*.googleusercontent.com;
">
```

**Cloudflare Pages の場合（_headers ファイル）**:
```
/*
  Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://www.gstatic.com; connect-src 'self' https://fcm.googleapis.com https://script.google.com; frame-src https://script.google.com https://*.googleusercontent.com;
```

### 5. Firebase APIキーの管理

**絶対にやってはいけないこと**:
- ❌ GitHub に APIキー をコミットしない
- ❌ クライアント側のコードに Secret Key を含めない

**推奨方法**:
- ✅ Firebase の APIキー（公開鍵）はクライアント側でOK（ドメイン制限で保護）
- ✅ GAS の Script Properties で機密情報を管理

```javascript
// GAS側（安全）
const API_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
```

---

## 最小構成テンプレートコード

### docs/index.html（親ウィンドウ）

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Your App">
  <title>Your App Name</title>

  <!-- PWA Icons -->
  <link rel="apple-touch-icon" href="icon-180.png">
  <link rel="icon" type="image/png" sizes="192x192" href="icon-192.png">
  <link rel="icon" type="image/png" sizes="512x512" href="icon-512.png">
  <link rel="manifest" href="manifest.json">

  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body, html {
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    #app-container {
      width: 100vw;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }

    #gas-iframe {
      width: 100%;
      height: 100%;
      border: none;
      flex: 1;
    }

    .loading {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 18px;
    }
  </style>
</head>
<body>
  <div id="app-container">
    <div class="loading" id="loading">
      <div>
        <div style="font-size: 48px; margin-bottom: 16px; text-align: center;">🔄</div>
        <div>システム起動中...</div>
      </div>
    </div>

    <!-- GAS Web App を iframe で表示 -->
    <iframe
      id="gas-iframe"
      src="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
      style="display: none;"
      onload="document.getElementById('loading').style.display='none'; this.style.display='flex';">
    </iframe>
  </div>

  <script>
    // Service Worker 登録（プッシュ通知用）
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then(registration => {
          console.log('✅ Service Worker 登録成功:', registration.scope);
        })
        .catch(error => {
          console.error('❌ Service Worker 登録失敗:', error);
        });
    }

    // postMessage受信処理（iframe内からのナビゲーション要求）
    window.addEventListener('message', function(event) {
      // セキュリティ: GASのサンドボックスiframeからのメッセージを許可
      const isValidOrigin = event.origin === 'https://script.google.com' ||
                           event.origin.includes('googleusercontent.com');

      if (!isValidOrigin) {
        console.warn('⚠️ 不正なオリジンからのメッセージを拒否:', event.origin);
        return;
      }

      console.log('📨 受信メッセージ (from ' + event.origin + '):', event.data);

      // ナビゲーション要求の処理
      if (event.data.type === 'navigate' && event.data.url) {
        const iframe = document.getElementById('gas-iframe');
        console.log('🚀 ナビゲーション:', event.data.url);
        iframe.src = event.data.url;
      }
    });

    // PWA インストール済みチェック
    window.addEventListener('DOMContentLoaded', () => {
      if (window.matchMedia('(display-mode: standalone)').matches) {
        console.log('✅ PWA として起動');
      } else {
        console.log('ℹ️ ブラウザで起動');
      }
    });
  </script>
</body>
</html>
```

---

### sidebar_page1.html（GAS側・ページ1）

```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <title>ページ1</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 20px;
    }

    .nav-tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }

    .nav-tab {
      padding: 10px 20px;
      background: #f0f0f0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      color: #333;
    }

    .nav-tab.active {
      background: #667eea;
      color: white;
    }
  </style>
</head>
<body>
  <div class="nav-tabs">
    <a href="#" onclick="navigateInPWA('<?= ScriptApp.getService().getUrl() ?>'); return false;" class="nav-tab active">
      ページ1
    </a>
    <a href="#" onclick="navigateInPWA('<?= ScriptApp.getService().getUrl() ?>?page=2'); return false;" class="nav-tab">
      ページ2
    </a>
  </div>

  <h1>ページ1</h1>
  <p>これはページ1の内容です。</p>

  <script>
  function navigateInPWA(url) {
    try {
      // iframe内にいる場合、最上位ウィンドウにpostMessageで通知
      if (window.top && window.top !== window.self) {
        console.log('📤 postMessage送信 (to window.top):', url);
        window.top.postMessage({
          type: 'navigate',
          url: url
        }, '*'); // GASのサンドボックスiframeから送信するため、ワイルドカードを使用
      } else {
        // iframe外（通常のブラウザ）の場合
        window.location.href = url;
      }
    } catch (e) {
      console.error('❌ ナビゲーションエラー:', e);
      // フォールバック: 通常の遷移
      window.location.href = url;
    }
  }
  </script>
</body>
</html>
```

---

### sidebar_page2.html（GAS側・ページ2）

```html
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <meta charset="UTF-8">
  <title>ページ2</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 20px;
    }

    .nav-tabs {
      display: flex;
      gap: 10px;
      margin-bottom: 20px;
    }

    .nav-tab {
      padding: 10px 20px;
      background: #f0f0f0;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      text-decoration: none;
      color: #333;
    }

    .nav-tab.active {
      background: #667eea;
      color: white;
    }
  </style>
</head>
<body>
  <div class="nav-tabs">
    <a href="#" onclick="navigateInPWA('<?= ScriptApp.getService().getUrl() ?>'); return false;" class="nav-tab">
      ページ1
    </a>
    <a href="#" onclick="navigateInPWA('<?= ScriptApp.getService().getUrl() ?>?page=2'); return false;" class="nav-tab active">
      ページ2
    </a>
  </div>

  <h1>ページ2</h1>
  <p>これはページ2の内容です。</p>

  <script>
  function navigateInPWA(url) {
    try {
      if (window.top && window.top !== window.self) {
        console.log('📤 postMessage送信 (to window.top):', url);
        window.top.postMessage({
          type: 'navigate',
          url: url
        }, '*');
      } else {
        window.location.href = url;
      }
    } catch (e) {
      console.error('❌ ナビゲーションエラー:', e);
      window.location.href = url;
    }
  }
  </script>
</body>
</html>
```

---

### menu.js（GAS側・ルーティング）

```javascript
function doGet(e) {
  const page = e && e.parameter && e.parameter.page ? e.parameter.page : '1';

  let htmlFile = 'sidebar_page1';
  if (page === '2') {
    htmlFile = 'sidebar_page2';
  }

  const html = HtmlService.createHtmlOutputFromFile(htmlFile);

  return html
    .setTitle('Your App Name')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .setSandboxMode(HtmlService.SandboxMode.IFRAME);
}
```

---

## チェックリスト

### デプロイ前

- [ ] GitHubリポジトリ作成完了
- [ ] GAS プロジェクト作成完了
- [ ] Firebase プロジェクト作成完了
- [ ] Cloudflare Pages プロジェクト作成完了
- [ ] カスタムドメイン取得済み
- [ ] docs/index.html 作成完了
- [ ] docs/manifest.json 作成完了
- [ ] docs/firebase-messaging-sw.js 作成完了
- [ ] アイコン画像（192x192, 512x512）作成完了
- [ ] GAS側の XFrameOptionsMode.ALLOWALL 設定完了
- [ ] postMessage 送信処理（GAS側）実装完了
- [ ] postMessage 受信処理（親ウィンドウ側）実装完了
- [ ] FCM通知実装（Base64エンコード方式）完了
- [ ] Firebase Service Account設定完了

### デプロイ後

- [ ] Cloudflare Pages デプロイ成功
- [ ] カスタムドメイン SSL証明書発行完了
- [ ] GAS Web App デプロイ完了
- [ ] PCブラウザで動作確認完了
  - [ ] iframe にGAS Web Appが表示される
  - [ ] タブ切り替えが動作する
  - [ ] コンソールに postMessage のログが出る
- [ ] iPhoneで動作確認完了
  - [ ] ホーム画面に追加できる
  - [ ] 全画面表示（スタンドアロンモード）
  - [ ] タブ切り替えがPWA内で完結（Safariが開かない）
  - [ ] Service Worker登録成功

### セキュリティ

- [ ] オリジンチェック実装完了
- [ ] メッセージタイプ検証実装完了
- [ ] URLバリデーション実装完了
- [ ] Firebase APIキーをGitHubにコミットしていない
- [ ] CSP設定（推奨）

---

## 参考リンク

**公式ドキュメント**:
- [postMessage API - MDN](https://developer.mozilla.org/ja/docs/Web/API/Window/postMessage)
- [Service Worker API - MDN](https://developer.mozilla.org/ja/docs/Web/API/Service_Worker_API)
- [Google Apps Script - HTML Service](https://developers.google.com/apps-script/guides/html)
- [Cloudflare Pages - Docs](https://developers.cloudflare.com/pages/)
- [Firebase Cloud Messaging - Docs](https://firebase.google.com/docs/cloud-messaging)

**関連記事**:
- [GAS Web App を iframe で埋め込む方法](https://enchord.jp/blog/gas-html-responsive/)（REBORN プロジェクトで参照）
- [PWA の基礎](https://web.dev/progressive-web-apps/)

---

## 更新履歴

- **2025年10月17日**: 初版作成（REBORN プロジェクト Phase 7 完了時点）
- **2025年10月17日**: Phase 7「プッシュ通知の実装（FCM + GAS）」追加、CORS問題解決の詳細を統合

---

このガイドは、技術的な開発が進むたびに随時更新していきます。
