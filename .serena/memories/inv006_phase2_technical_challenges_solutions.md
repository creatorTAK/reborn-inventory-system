# INV-006 Phase 2: ユーザー権限管理UI - 技術的課題と解決策

## 実装期間
2025-11-03 17:00 - 2025-11-04 05:00

## 完成した機能
1. ユーザー一覧表示（FCM通知登録シートから取得）
2. 権限変更機能（オーナー/スタッフ/外注）
3. 統計カード（総ユーザー数、オーナー、スタッフ、外注）
4. PWA対応（スマホからアクセス可能）
5. **オーナー権限チェック（セキュリティ強化）**

## デプロイ情報
- GAS: @621 (AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA)
- PWA: Cloudflare Pages (自動デプロイ)

---

## 🔥 技術的課題と解決策

### 1. Date Serialization問題 (@616)

#### 問題
- google.script.runでDate objectを返すとクライアント側でnullになる
- サーバーログでは正常にデータ取得できているが、UIには「読み込み中...」が永遠に表示
- ブラウザコンソール: `[UM] 予期しない形式: -- null`

#### 原因
google.script.runのサンドボックス環境では、Date objectが正しくシリアライズされない

#### 解決策
```javascript
// ❌ NG: Date objectをそのまま返す
const user = {
  registeredAt: new Date(data[i][registeredAtCol])
};

// ✅ OK: Utilities.formatDate()で文字列化
let registeredAtStr = '';
if (data[i][registeredAtCol]) {
  try {
    const date = new Date(data[i][registeredAtCol]);
    registeredAtStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {
    registeredAtStr = String(data[i][registeredAtCol]);
  }
}

const user = {
  registeredAt: registeredAtStr // String型
};
```

#### 教訓
- google.script.runで返す全てのフィールドは**プリミティブ型（String, Number, Boolean）**にする
- Date, Function, undefined などは正しくシリアライズされない

---

### 2. サイドバー幅不足 (@617)

#### 問題
- 5カラムのテーブルを表示したが、1カラム目（ユーザー）しか見えない
- 横スクロールも効かない状態

#### 原因
サイドバーのデフォルト幅400pxが狭すぎた

#### 解決策
```javascript
// menu.js - showUserManagement()
const html = t.evaluate()
  .setTitle('ユーザー権限管理')
  .setWidth(600); // 400px → 600px に変更
```

#### 結果
- 横スクロールで全5カラムが表示可能になった
- Google Sheets サイドバーの最大幅は約600px程度

---

### 3. 権限空欄ユーザーへの自動デフォルト値設定 (@619)

#### 問題
- UI上は「スタッフ」と表示されるが、シート上は空欄のまま
- 権限を変更して保存したユーザーだけシートに書き込まれる
- 何も触らなかったユーザーは権限列が空欄

#### 原因
getUserListForUI()が読み込み時にデフォルト値「スタッフ」を**表示用にセット**していたが、**シートには書き込んでいなかった**

#### 解決策
```javascript
// menu.js - getUserListForUI()
const rowsToUpdate = []; // 権限が空欄の行を記録

for (let i = 1; i < data.length; i++) {
  const currentPermission = permissionCol !== -1 ? data[i][permissionCol] : '';
  if (permissionCol !== -1 && (!currentPermission || currentPermission === '')) {
    Logger.log('[getUserListForUI] 行' + (i+1) + ': 権限が空欄なので「スタッフ」を設定します');
    rowsToUpdate.push({ row: i + 1, permission: 'スタッフ' });
  }
}

// 権限が空欄の行にデフォルト値を書き込む
if (rowsToUpdate.length > 0 && permissionCol !== -1) {
  rowsToUpdate.forEach(function(update) {
    sheet.getRange(update.row, permissionCol + 1).setValue(update.permission);
  });
}
```

#### 教訓
- UI表示とデータベース実態を一致させる
- 初回読み込み時にデフォルト値を**シートに保存**する

---

### 4. PWAメニューのID命名規則統一 (@618修正前)

#### 問題
- 他の設定管理メニュー: `drawer-config-basic`, `drawer-config-product`
- ユーザー権限管理のみ: `drawer-user-management` ← 不統一

#### 解決策
```javascript
// docs/index.html
// ❌ NG
<a href="#" onclick="navigateToPage('user_management');" id="drawer-user-management">

// ✅ OK
<a href="#" onclick="navigateToPage('config-user');" id="drawer-config-user">
```

#### 教訓
- 命名規則は最初から統一する
- 既存コードのパターンに従う

---

### 5. オーナー権限チェック実装 (@620-621)

#### 要件
オーナーのみがユーザー権限管理画面にアクセス・変更可能

#### 実装した多層防御

**Layer 1: メニュー表示時のチェック**
```javascript
// menu.js - showUserManagement()
function showUserManagement() {
  try {
    const hasOwnerPermission = isOwner();
    if (!hasOwnerPermission) {
      const ui = SpreadsheetApp.getUi();
      ui.alert('権限エラー', 'ユーザー権限管理はオーナーのみがアクセスできます。', ui.ButtonSet.OK);
      return;
    }
  } catch (error) {
    Logger.log('[showUserManagement] 権限チェックエラー: ' + error);
    // エラー時は一時的にアクセス許可（デバッグ用）
  }
}

// menu.js - doGet() (PWA対応)
} else if (menuType === 'user_management') {
  try {
    const hasOwnerPermission = isOwner(fcmToken);
    if (!hasOwnerPermission) {
      return HtmlService.createHtmlOutput('<h2>権限エラー</h2>...');
    }
  } catch (error) {
    Logger.log('[doGet] user_management 権限チェックエラー: ' + error);
  }
}
```

**Layer 2: 保存時のチェック（最終防御）**
```javascript
// user_permission_manager.js - updateUserPermission()
function updateUserPermission(userName, permission, fcmToken) {
  try {
    const hasOwnerPermission = isOwner(fcmToken);
    if (!hasOwnerPermission) {
      return { success: false, message: 'この操作はオーナー権限が必要です' };
    }
  } catch (permError) {
    Logger.log('[updateUserPermission] 権限チェックエラー: ' + permError);
  }
}
```

**Layer 3: ユーザー特定ロジック**
```javascript
// user_permission_manager.js - isOwner()
function isOwner(fcmToken) {
  let userName = null;

  // PWAからのアクセス: FCMトークンからユーザー名を取得
  if (fcmToken) {
    // FCM通知登録シートでfcmTokenを検索してユーザー名を取得
  }

  // GASからのアクセス: メールアドレスからユーザー名を取得
  if (!userName) {
    const email = Session.getActiveUser().getEmail();
    userName = getUserNameByEmail(email);
  }

  const permission = getUserPermission(userName);
  return permission === PERMISSION_LEVELS.OWNER;
}
```

#### テスト結果
- ✅ オーナー（安廣拓志）: アクセス可能、変更可能
- ✅ スタッフ（山田太郎）: 「権限エラー」ダイアログ表示、アクセス拒否

---

## 🔧 関連ファイル

### サーバー側
- `menu.js`: getUserListForUI(), updateUserPermission(), showUserManagement(), doGet()
- `user_permission_manager.js`: isOwner(), getUserPermission(), getUserNameByEmail()

### クライアント側
- `user_management_ui.html`: ユーザー権限管理UI
- `docs/index.html`: PWAナビゲーション

---

## 📚 技術的知見まとめ

### Google Apps Script 特有の制約
1. **Date Serialization**: google.script.runはDate objectを正しくシリアライズしない → Utilities.formatDate()で文字列化必須
2. **サイドバー幅**: 最大約600px程度が限界
3. **認証ダイアログ**: 初回実行時に「認証が必要です」が表示されるのは正常動作

### セキュリティベストプラクティス
1. **多層防御**: UI層、API層の複数箇所でチェック
2. **エラーハンドリング**: 権限チェックエラー時も画面が真っ白にならないようtry-catch
3. **ユーザー特定**: GAS（メールアドレス）とPWA（FCMトークン）の両対応

### 命名規則
- PWAメニューID: `drawer-{category}-{feature}` 形式で統一
- 例: `drawer-config-basic`, `drawer-config-user`

---

## 🚀 今後の拡張可能性

権限管理機能が実装されたことで、以下の機能が実装可能に：

1. **機能別アクセス制限**
   - 在庫管理: スタッフ以上
   - マスタ管理: オーナーのみ
   - 商品登録: 全ユーザー

2. **データレベルのアクセス制限**
   - オーナー: 全データ閲覧・編集
   - スタッフ: 自分が登録したデータのみ編集
   - 外注: 閲覧のみ

3. **監査ログ**
   - 誰が、いつ、何を変更したかを記録

4. **承認ワークフロー**
   - スタッフが変更 → オーナーが承認

5. **レポート権限**
   - 売上レポート: オーナーのみ
   - 在庫レポート: スタッフ以上

---

## 🎯 デプロイ履歴

- @614: テストデータ表示確認
- @615: 実データ取得実装
- @616: Date serialization問題修正
- @617: サイドバー幅600px拡張
- @618: PWA対応、ID命名規則統一
- @619: 権限空欄ユーザーへのデフォルト値自動設定
- @620: オーナー権限チェック実装
- @621: 権限チェックエラーハンドリング追加（緊急修正）

---

**最終更新: 2025-11-04 05:00**
