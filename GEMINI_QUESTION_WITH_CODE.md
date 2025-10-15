# Gemini質問用 - FCM通知問題（コード付き）

## 📝 質問文（コピペ用）

```
iPhone PWAでFCM（Firebase Cloud Messaging）通知が届かない問題について、Google Apps Scriptの専門家として助けてください。

【システム構成】
- フロントエンド: GitHub Pages（PWA）
- バックエンド: Google Apps Script（Web App）
- 通知: Firebase Cloud Messaging HTTP v1 API
- デバイス: iPhone（PWAをホーム画面に追加してスタンドアロンモードで起動）

【動作している部分】
1. Apps Scriptエディタから直接sendFCMNotification()を実行 → iPhoneに通知が届く ✅
2. PWAからGASへのAPIリクエストは成功（HTTP 200 OK） ✅
3. GASの実行ログにも記録されている ✅
4. FCMへの送信も成功（レスポンス: success: 2件） ✅

【問題】
PWAアプリから通知送信ボタンをタップしても、iPhoneに通知が届きません。

【重要な手がかり】
過去のテストで「エディタから実行した通知」と「PWAから実行した通知」が2個同時に届いたことがあります。
- エディタからの通知: 「テスト通知です」というメッセージ付き ✅
- PWAからの通知: メッセージが空（空の通知） ⚠️

これは、PWAからの通知も実は送信されているが、titleやbodyのパラメータが正しく渡っていない可能性を示唆しています。

【質問】
1. 以下のGASコードで、URLパラメータ（日本語・絵文字含む）が正しく取得できない原因は何ですか？
2. decodeURIComponent()で日本語が失われる可能性はありますか？
3. iPhoneのPWAからのリクエストと、ブラウザからのリクエストで何か違いはありますか？
4. 具体的な修正方法を教えてください。

関連するコードを以下に添付します。
```

---

## 📄 関連コード一式

### 1. menu.js - doGet関数（sendFCM部分）

```javascript
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (!action) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'アクションが指定されていません'
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ... 他のアクション省略 ...

    if (action === 'sendFCM') {
      // FCM通知を送信（GETメソッド）
      try {
        // デバッグログをスプレッドシートに書き込む
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let debugSheet = ss.getSheetByName('デバッグログ');
        if (!debugSheet) {
          debugSheet = ss.insertSheet('デバッグログ');
          debugSheet.appendRow(['タイムスタンプ', 'アクション', '受信パラメータ', 'デコード後title', 'デコード後body', '送信結果']);
        }

        const timestamp = new Date().toLocaleString('ja-JP');
        const rawParams = JSON.stringify(e.parameter);

        const title = decodeURIComponent(e.parameter.title || 'REBORN');
        const body = decodeURIComponent(e.parameter.body || 'テスト通知です');

        const result = sendFCMNotification(title, body);

        // デバッグ情報をスプレッドシートに記録
        debugSheet.appendRow([
          timestamp,
          'sendFCM',
          rawParams,
          title,
          body,
          JSON.stringify(result)
        ]);

        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: 'エラー: ' + error.toString()
        }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // その他のアクションは将来追加
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: '不明なアクション: ' + action
    }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: 'サーバーエラー: ' + error.toString()
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

### 2. web_push.js - sendFCMNotification関数

```javascript
/**
 * FCM HTTP v1 API を使用してプッシュ通知を送信
 * @param {string} title - 通知のタイトル
 * @param {string} body - 通知の本文
 * @return {Object} 送信結果
 */
function sendFCMNotification(title, body) {
  try {
    // 1. FCMトークンを取得
    const tokens = getFCMTokens();
    if (!tokens || tokens.length === 0) {
      return {
        status: 'error',
        message: 'FCMトークンが登録されていません'
      };
    }

    Logger.log('FCMトークン数: ' + tokens.length);

    // 2. アクセストークンを取得（サービスアカウント認証）
    const accessToken = getAccessToken();
    if (!accessToken) {
      return {
        status: 'error',
        message: 'アクセストークンの取得に失敗しました'
      };
    }

    // 3. Firebase プロジェクトID
    const projectId = 'reborn-pwa';

    // 4. 各トークンに通知を送信
    let successCount = 0;
    let failCount = 0;

    tokens.forEach(function(token) {
      try {
        // FCM HTTP v1 API エンドポイント
        const url = 'https://fcm.googleapis.com/v1/projects/' + projectId + '/messages:send';

        // リクエストペイロード
        const payload = {
          message: {
            token: token.trim(),
            notification: {
              title: title,
              body: body
            },
            webpush: {
              fcm_options: {
                link: 'https://yasuhirotakushi.github.io/reborn-inventory-system/'
              }
            }
          }
        };

        Logger.log('送信ペイロード: ' + JSON.stringify(payload));

        // HTTP リクエスト
        const options = {
          method: 'post',
          contentType: 'application/json',
          headers: {
            'Authorization': 'Bearer ' + accessToken
          },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(url, options);
        const responseCode = response.getResponseCode();
        const responseBody = response.getContentText();

        Logger.log('FCM Response: ' + responseCode + ' - ' + responseBody);

        if (responseCode === 200) {
          successCount++;
          // 最終送信日時を更新
          updateLastSentTime(token);
        } else {
          failCount++;
          Logger.log('FCM送信失敗: ' + responseBody);
        }
      } catch (error) {
        failCount++;
        Logger.log('エラー（トークン: ' + token + '）: ' + error.toString());
      }
    });

    return {
      status: 'success',
      message: '通知を送信しました（成功: ' + successCount + '件、失敗: ' + failCount + '件）',
      successCount: successCount,
      failCount: failCount
    };

  } catch (error) {
    Logger.log('sendFCMNotification エラー: ' + error.toString());
    return {
      status: 'error',
      message: 'エラー: ' + error.toString()
    };
  }
}

/**
 * スプレッドシートからFCMトークンを取得
 */
function getFCMTokens() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FCM通知登録');
    if (!sheet) {
      Logger.log('FCM通知登録シートが見つかりません');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const tokens = [];

    // ヘッダー行をスキップ（行1）
    for (let i = 1; i < data.length; i++) {
      const token = data[i][1]; // B列: FCMトークン
      const status = data[i][3]; // D列: ステータス

      if (token && status === 'アクティブ') {
        tokens.push(token);
      }
    }

    return tokens;
  } catch (error) {
    Logger.log('getFCMTokens エラー: ' + error.toString());
    return [];
  }
}

/**
 * 最終送信日時を更新
 */
function updateLastSentTime(token) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FCM通知登録');
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    const now = new Date();

    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === token) {
        sheet.getRange(i + 1, 3).setValue(now); // C列: 最終送信日時
        break;
      }
    }
  } catch (error) {
    Logger.log('updateLastSentTime エラー: ' + error.toString());
  }
}
```

---

### 3. PWA index.html - 通知送信部分

```javascript
// GAS API URL
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbxgrHJ5FkYiNDulGavakaHWSMxeBxz6nQ0db_RTalqWdPOx7HZpmGX70sbP9Z3hUvfd4g/exec';

// サーバーからFCM通知を送信
async function sendFCMNotification() {
  const notifResult = document.getElementById('notificationResult');

  try {
    notifResult.innerHTML = '送信中...<span class="loading"></span>';

    // GETメソッドでCORSプリフライトを回避
    const title = encodeURIComponent('🎉 REBORN サーバー通知（FCM）');
    const body = encodeURIComponent('商品が売れました！\n管理番号: AA-1002\n出品先: メルカリ\n販売金額: 5,280円');
    const response = await fetch(GAS_API_URL + '?action=sendFCM&title=' + title + '&body=' + body);

    if (response.ok) {
      const data = await response.json();
      notifResult.innerHTML = '✅ サーバーから通知を送信しました！\n\niPhoneの場合、画面上部に通知が表示されます。\nまたは通知センターを確認してください。';
      notifResult.style.background = '#f0fdf4';
      notifResult.style.borderColor = '#22c55e';
    } else {
      throw new Error('HTTP ' + response.status);
    }
  } catch (error) {
    notifResult.innerHTML = '❌ エラー: ' + error.message;
    notifResult.style.background = '#fef2f2';
    notifResult.style.borderColor = '#ef4444';
  }
}
```

---

### 4. firebase-messaging-sw.js（Service Worker）

```javascript
// Firebase SDKをインポート
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Firebase設定
const firebaseConfig = {
  apiKey: "AIzaSyBHVts3zK-RKGhU0KdLJbAqoqNkvfItxu8",
  authDomain: "reborn-pwa.firebaseapp.com",
  projectId: "reborn-pwa",
  storageBucket: "reborn-pwa.firebasestorage.app",
  messagingSenderId: "668188273032",
  appId: "1:668188273032:web:c1ad0eddfb98fe19e4d9ac"
};

// Firebaseを初期化
firebase.initializeApp(firebaseConfig);

// Messagingインスタンスを取得
const messaging = firebase.messaging();

// バックグラウンドメッセージを受信
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] バックグラウンドメッセージを受信:', payload);

  const notificationTitle = payload.notification.title || 'REBORN';
  const notificationOptions = {
    body: payload.notification.body || '新しい通知があります',
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
```

---

## 🔍 追加情報

### デプロイ情報
- **現在のバージョン**: 110
- **デプロイURL**: https://script.google.com/macros/s/AKfycbxgrHJ5FkYiNDulGavakaHWSMxeBxz6nQ0db_RTalqWdPOx7HZpmGX70sbP9Z3hUvfd4g/exec
- **アクセス権限**: 全員

### FCMトークン情報
- **登録数**: 2件
- **トークン形式**: `c8CV-WrvMlI4LCmKvR3yZW:APA91b...`（正常）
- **ステータス**: アクティブ

### 実行ログ
- バージョン109のdoGetが「完了」ステータス
- エディタからの実行ログは見られるが、doGetの詳細ログが開けない

---

## 💡 私の仮説

1. **エンコード/デコード問題**
   - PWAで`encodeURIComponent()`したパラメータが、GASで`decodeURIComponent()`した時に空になっている
   - 特に日本語や絵文字、改行文字が含まれている場合

2. **GASのe.parameterの制限**
   - URLパラメータの文字数制限
   - 特殊文字の扱い

3. **iPhoneのPWA特有の問題**
   - フォアグラウンドでは通知が表示されない仕様

---

## ❓ Geminiへの質問（最重要）

**以下のどのアプローチが最適ですか？また、それぞれのコード例を示してください。**

### アプローチA: POSTメソッドに変更
- PWAからPOSTでJSONボディを送信
- GASでdoPost関数を実装
- メリット: 文字数制限なし、エンコード問題が起きにくい

### アプローチB: Base64エンコード
- PWAでBase64エンコードして送信
- GASでBase64デコード
- メリット: 特殊文字の問題を回避

### アプローチC: URLエンコードの修正
- 現在の方法を修正（二重エンコード回避など）
- メリット: 変更が少ない

### アプローチD: クエリパラメータを分割
- title, bodyを別々のパラメータにせず、1つにまとめる
- または、固定値のIDを送り、GAS側でマッピング

---

**具体的な実装コード例と、推奨するアプローチを教えてください。**
