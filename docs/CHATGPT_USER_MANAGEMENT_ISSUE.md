# Google Apps Script - ユーザー権限管理画面の読み込み問題

## 🚨 緊急の問題

Google Spreadsheetのメニューから「ユーザー権限管理」を開くと、モーダルダイアログは表示されるが、データが「読み込み中...」のまま永遠にロードされない。

---

## 📋 症状

### 動作する場合
✅ **直接URLでWeb Appとして開く場合は正常に動作する**
```
https://script.google.com/macros/s/AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA/exec?menu=user_management
```
- ユーザー一覧が表示される
- 統計カードに正しいデータが表示される
- 権限変更も可能

### 動作しない場合
❌ **Spreadsheetのメニューからモーダルダイアログで開く場合**
- モーダルダイアログは表示される
- 「読み込み中...」のまま永遠に回り続ける
- データが一切表示されない
- コンソールエラーは特になし（前回は "Load failed" が出た）

---

## 🔧 試したこと

### 1. fetch() を使用（失敗）
```javascript
const url = `${GAS_API_URL}?action=getUserList`;
const response = await fetch(url);
```
→ **結果**: "Load failed" エラー（クロスオリジンの問題と推測）

### 2. google.script.run に変更（失敗）
```javascript
google.script.run
  .withSuccessHandler(function(result) {
    // 処理
  })
  .withFailureHandler(function(error) {
    // エラー処理
  })
  .getUserList();
```
→ **結果**: 依然として「読み込み中」のまま動かない

### 3. サイドバー → モーダルダイアログに変更
```javascript
// 変更前
SpreadsheetApp.getUi().showSidebar(html);

// 変更後
SpreadsheetApp.getUi().showModalDialog(html, 'ユーザー権限管理');
```
→ **結果**: 変わらず

---

## 📂 関連コード

### menu.js の該当部分

```javascript
/**
 * ユーザー権限管理画面を表示（モーダルダイアログ）
 */
function showUserManagement() {
  const t = HtmlService.createTemplateFromFile('user_management_ui');
  t.showBackButton = false;
  t.GAS_BASE_URL = ScriptApp.getService().getUrl();
  t.fcmToken = '';
  const html = t.evaluate()
    .setTitle('ユーザー権限管理')
    .setWidth(800)
    .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'ユーザー権限管理');
}

// API エンドポイント（doGet経由で呼ばれる）
if (action === 'getUserList') {
  const result = getUserList();
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    users: result
  })).setMimeType(ContentService.MimeType.JSON);
}
```

### user_management_ui.html の該当部分

```html
<script>
  const GAS_API_URL = '<?= GAS_BASE_URL ?>';

  console.log('GAS_API_URL:', GAS_API_URL);

  window.addEventListener('DOMContentLoaded', async function() {
    await loadUsers();
  });

  async function loadUsers() {
    showLoading(true);
    try {
      // google.script.runを使用（ダイアログ/サイドバー用）
      google.script.run
        .withSuccessHandler(function(result) {
          console.log('getUserList result:', result);
          if (result.success && result.users) {
            users = result.users;
            renderUserTable();
            updateStats();
          } else {
            showToast('ユーザー一覧の取得に失敗しました', 'danger');
          }
          showLoading(false);
        })
        .withFailureHandler(function(error) {
          console.error('Error loading users:', error);
          showToast('エラーが発生しました: ' + error.message, 'danger');
          showLoading(false);
        })
        .getUserList();
    } catch (error) {
      console.error('Error:', error);
      showToast('エラーが発生しました: ' + error.message, 'danger');
      showLoading(false);
    }
  }
</script>
```

### user_permission_manager.js のgetUserList関数

```javascript
/**
 * ユーザー一覧を取得（重複排除）
 * @returns {Array<Object>} ユーザー一覧
 */
function getUserList() {
  try {
    const sheet = ss.getSheetByName(FCM_TOKENS_SHEET);
    if (!sheet) {
      Logger.log('[ユーザー一覧] FCM通知登録シートが見つかりません');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // 列インデックスを取得
    const userNameIndex = headers.indexOf('ユーザー名');
    const emailIndex = headers.indexOf('メールアドレス');
    const statusIndex = headers.indexOf('ステータス');
    const registeredAtIndex = headers.indexOf('登録日時');
    const permissionIndex = headers.indexOf('権限'); // L列

    if (userNameIndex === -1) {
      Logger.log('[ユーザー一覧] 必要な列が見つかりません');
      return [];
    }

    // ユーザー名でグループ化（最新のレコードを保持）
    const userMap = {};

    for (let i = 1; i < data.length; i++) {
      const userName = data[i][userNameIndex];
      if (!userName) continue;

      const user = {
        userName: userName,
        email: emailIndex !== -1 ? data[i][emailIndex] : '',
        status: statusIndex !== -1 ? data[i][statusIndex] : '',
        registeredAt: registeredAtIndex !== -1 ? data[i][registeredAtIndex] : '',
        permission: permissionIndex !== -1 ? data[i][permissionIndex] : 'スタッフ'
      };

      // 既存のユーザーと比較して、新しい方を保持
      if (!userMap[userName] ||
          (user.registeredAt && (!userMap[userName].registeredAt || user.registeredAt > userMap[userName].registeredAt))) {
        userMap[userName] = user;
      }
    }

    // 配列に変換
    const users = Object.values(userMap);

    Logger.log(`[ユーザー一覧] ${users.length}人のユーザーを取得しました`);
    return users;

  } catch (error) {
    Logger.log('[ユーザー一覧] エラー: ' + error);
    return [];
  }
}
```

---

## 🎯 期待する動作

1. Spreadsheetのメニュー「⚙️ 設定管理 → 🔐 ユーザー権限管理」をクリック
2. モーダルダイアログが開く
3. `getUserList()`が呼ばれる
4. ユーザー一覧が表示される
5. 統計カードに数値が表示される

---

## ❓ 疑問点

1. **なぜ直接URLでは動作するのに、ダイアログでは動作しないのか？**
   - 同じHTMLファイル（user_management_ui.html）を使用している
   - 直接URL: doGet()経由でWeb Appとして動作
   - ダイアログ: showModalDialog()経由で表示

2. **google.script.run.getUserList() が呼ばれているのか？**
   - コンソールログも出ない
   - エラーも出ない
   - withSuccessHandlerもwithFailureHandlerも呼ばれていない様子

3. **GAS_BASE_URLの値は正しく渡されているのか？**
   - `<?= GAS_BASE_URL ?>` がテンプレートで展開されているはず
   - コンソールログで確認すべき？

---

## 🔍 調査が必要な点

1. ダイアログ内でconsole.logは動作するか？
2. google.script.runが実際に関数を呼び出しているか？
3. getUserList()関数がグローバルスコープに公開されているか？
4. HTMLテンプレートのGAS_BASE_URLが正しく展開されているか？

---

## 🚀 次に試すべきこと（提案をお願いします）

1. デバッグ用のシンプルな関数で動作確認
2. Loggerログの確認方法
3. ダイアログでのconsole.log確認方法
4. 他の動作しているダイアログとの比較

---

## 📝 補足情報

- **Google Apps Script プロジェクト**: REBORN在庫管理システム
- **デプロイID**: `AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA`
- **現在のバージョン**: @604
- **問題発生日**: 2025-11-03

---

**この問題の解決方法を教えてください。特に、google.script.runがダイアログ内で正しく動作させる方法を知りたいです。**
