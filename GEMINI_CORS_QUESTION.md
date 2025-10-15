# Gemini相談用 - FCM通知のCORS問題

**作成日**: 2025年10月16日 朝
**状況**: POSTメソッド実装でCORSエラー発生

---

## 📊 ここまでの経緯

### ✅ 問題の特定（成功）

**固定値テストを実施:**
- バージョン111で固定値（`const title = '🔧 固定タイトル'`）をFCM送信
- **結果**: 通知が届いた！
- **結論**: パラメータの取得・デコーディングに問題があることが確定

**重要な発見:**
- iPhoneのPWAでは、アプリがフォアグラウンド時は通知が表示されない
- ボタンを押した後、**すぐにホーム画面に戻る**と通知が届く

---

### 🔧 解決策の実装（失敗）

**アプローチ**: GETメソッド → POSTメソッドに変更

**理由**:
- URLパラメータのエンコード/デコード問題を回避
- 日本語・絵文字・改行文字の扱いが簡単
- Geminiも推奨していた方法

**実装内容**:

#### 1. menu.js（Apps Script）

```javascript
function doPost(e) {
  try {
    // リクエストボディを解析
    const requestBody = e.postData ? JSON.parse(e.postData.contents) : {};
    const action = requestBody.action;

    if (!action) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'アクションが指定されていません'
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'sendFCM') {
      // FCM通知を送信（POSTメソッド）
      const title = requestBody.title || 'REBORN';
      const body = requestBody.body || 'テスト通知です';

      const result = sendFCMNotification(title, body);

      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: '不明なアクション: ' + action
    }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('doPost error: ' + error);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

#### 2. docs/index.html（PWA）

```javascript
// POSTメソッドでJSONを送信（エンコード不要）
const title = '🎉 REBORN サーバー通知（FCM）';
const body = '商品が売れました！\n管理番号: AA-1002\n出品先: メルカリ\n販売金額: 5,280円';

const response = await fetch(GAS_API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    action: 'sendFCM',
    title: title,
    body: body
  })
});
```

---

### ❌ 発生したエラー

**エラーメッセージ**:
```
Preflight response is not successful. Status code: 405
Fetch API cannot load https://script.google.com/macros/s/AKfycbxgrHJ5FkYiNDulGavakaHWSMxeBxz6nQ0db_RTalqWdPOx7HZpmGX70sbP9Z3hUvfd4g/exec due to access control checks.
Failed to load resource: Preflight response is not successful. Status code: 405
```

**エラーの意味**:
- ブラウザがPOSTリクエストを送る前に、OPTIONSリクエスト（プリフライト）を送信
- Apps ScriptがOPTIONSメソッドに応答していない（405 = Method Not Allowed）
- CORSプリフライトに失敗

---

## 🤔 考えられる解決策

### 案1: doOptions関数を追加してCORS対応

```javascript
function doOptions(e) {
  return ContentService.createTextOutput('')
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}
```

**メリット**: POSTメソッドをそのまま使える
**デメリット**: Apps ScriptでsetHeader()がサポートされているか不明

---

### 案2: GETメソッドに戻す + Base64エンコード

```javascript
// PWA側
const title = '🎉 REBORN サーバー通知（FCM）';
const body = '商品が売れました！\n管理番号: AA-1002';
const titleEncoded = btoa(unescape(encodeURIComponent(title)));
const bodyEncoded = btoa(unescape(encodeURIComponent(body)));
const response = await fetch(GAS_API_URL + '?action=sendFCM&title=' + titleEncoded + '&body=' + bodyEncoded);

// GAS側
const titleDecoded = decodeURIComponent(escape(atob(e.parameter.title)));
const bodyDecoded = decodeURIComponent(escape(atob(e.parameter.body)));
```

**メリット**: CORS問題を完全に回避、固定値テストと同じ経路
**デメリット**: エンコード/デコードの複雑さ

---

### 案3: doPostをdoGetに統合

GETメソッドのままで、パラメータの取得方法だけ改善する

```javascript
function doGet(e) {
  const action = e.parameter.action;

  if (action === 'sendFCM') {
    // URLパラメータを直接使う（デコード処理を改善）
    let title = e.parameter.title || 'REBORN';
    let body = e.parameter.body || 'テスト通知です';

    try {
      title = decodeURIComponent(title);
      body = decodeURIComponent(body);
    } catch (error) {
      // デコード失敗時はそのまま使用
    }

    const result = sendFCMNotification(title, body);
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

**メリット**: シンプル、CORS問題なし
**デメリット**: 日本語・絵文字の問題が再発する可能性

---

### 案4: Form URLエンコード形式に変更

POSTメソッドだが、JSONではなくForm形式で送信

```javascript
// PWA側
const formData = new URLSearchParams();
formData.append('action', 'sendFCM');
formData.append('title', title);
formData.append('body', body);

const response = await fetch(GAS_API_URL, {
  method: 'POST',
  body: formData
});

// GAS側
const action = e.parameter.action;
const title = e.parameter.title;
const body = e.parameter.body;
```

**メリット**: CORSプリフライトが発生しない可能性
**デメリット**: 試してみないと動くか不明

---

## ❓ Geminiへの質問

**Google Apps ScriptでPOSTリクエストのCORS問題を解決する最適な方法を教えてください。**

### 詳細な質問

1. **doOptions関数は有効ですか？**
   - Apps ScriptでOPTIONSメソッドを処理できますか？
   - setHeader()は使えますか？（過去にsetHeader()が動かなかったことがあります）

2. **案2（Base64エンコード）は確実に動きますか？**
   - 日本語・絵文字・改行文字を含むテキストをBase64エンコードすれば、URLパラメータで送信可能ですか？
   - サンプルコードを教えてください

3. **案4（Form URLエンコード）でCORSプリフライトを回避できますか？**
   - Content-Type: application/x-www-form-urlencodedならプリフライトが発生しない？
   - Apps Scriptで正しく受け取れますか？

4. **他に推奨される方法はありますか？**
   - Apps Script + iPhoneのPWAという構成で、日本語を含む通知を送る最適な実装方法

---

## 🎯 最終目標

**iPhoneのPWAから以下の通知を送信したい:**

**タイトル**: 🎉 REBORN サーバー通知（FCM）

**本文**:
```
商品が売れました！
管理番号: AA-1002
出品先: メルカリ
販売金額: 5,280円
```

✅ 日本語が正しく表示される
✅ 絵文字が表示される
✅ 改行が正しく反映される

---

## 📎 現在のシステム構成

- **フロントエンド**: GitHub Pages（PWA）
  - URL: https://yasuhirotakushi.github.io/reborn-inventory-system/
- **バックエンド**: Google Apps Script（Web App）
  - デプロイID: AKfycbxgrHJ5FkYiNDulGavakaHWSMxeBxz6nQ0db_RTalqWdPOx7HZpmGX70sbP9Z3hUvfd4g
  - バージョン: 113
- **通知**: Firebase Cloud Messaging HTTP v1 API
- **デバイス**: iPhone（PWAをホーム画面に追加してスタンドアロンモードで起動）

---

## 🔍 確認済みの事実

1. ✅ GAS → FCM → iPhone の経路は正常（固定値で確認済み）
2. ✅ GETメソッドは動作する（固定値テストで成功）
3. ✅ POSTメソッドはCORSプリフライトエラー（405）
4. ✅ iPhoneのPWAではフォアグラウンド時に通知が表示されない仕様

---

## ✅ 解決（2025年10月16日 6:44）

**採用した方法**: 案2 - GETメソッド + Base64エンコード

**Geminiの回答**:
> 最もシンプルで信頼性が高く、これまでのテストで成功している「GETメソッド」の経路を活かすために、Base64エンコードを使ったアプローチ（案2）を強く推奨します

**実装結果**: 🎉 完全成功！

### 実装内容

**バージョン**: 114

**PWA側 (docs/index.html)**:
```javascript
const title = '🎉 REBORN サーバー通知（FCM）';
const body = '商品が売れました！\n管理番号: AA-1002\n出品先: メルカリ\n販売金額: 5,280円';

// Base64エンコード
const titleEncoded = btoa(encodeURIComponent(title));
const bodyEncoded = btoa(encodeURIComponent(body));

// GETリクエスト
const url = GAS_API_URL + '?action=sendFCM&title=' + titleEncoded + '&body=' + bodyEncoded;
const response = await fetch(url);
```

**GAS側 (menu.js doGet関数)**:
```javascript
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

  const result = sendFCMNotification(title, body);
  // ...
}
```

### テスト結果

**iPhone PWAでの確認**:
- ✅ 日本語が正しく表示（「商品が売れました！」）
- ✅ 絵文字が正しく表示（🎉）
- ✅ 改行が正しく反映（4行の本文）
- ✅ CORS問題を完全に回避

**デバッグログ（スプレッドシート）**:
```
タイムスタンプ: 2025/10/16 6:44
デコード後title: 🎉 REBORN サーバー通知（FCM）
デコード後body: 商品が売れました！
管理番号: AA-1002
出品先: メルカリ
販売金額: 5,280円
送信結果: {"status":"success","message":"通知を送信しました"}
```

### 今後の改善予定

1. **ボタン連打防止機能**
   - 送信中は2度押しできないようにする
   - ローディング表示中はボタンを無効化

2. **古いFCMトークンのクリーンアップ**
   - 定期的に古いトークンを削除
   - アクティブなトークンのみ保持

### 教訓

1. **Apps ScriptのCORS制約**
   - POSTメソッドは`doOptions()`が実装できないため、CORSプリフライトに対応不可
   - GETメソッド + Base64エンコードが最も確実

2. **固定値テストの重要性**
   - パラメータ問題をエンコード問題と切り分けられた
   - 根本原因の特定に不可欠

3. **Geminiへの相談の効果**
   - Google固有の制約を正確に把握できた
   - 推奨アプローチの確認で時間を大幅節約

---

**具体的な実装コード例と、推奨するアプローチを教えてください。**

**→ 上記の通り、Base64エンコード方式で完全解決しました！**
