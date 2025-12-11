# メールアドレスベース認証システム実装記録

## 実装日
2025-11-25

## 背景・問題
- オーナーがスマホで登録後、PCで開くと新規ユーザー扱いになっていた
- 同じメールアドレスでも別のデバイスとして認識されず、権限が引き継がれなかった
- 1つのアカウントで複数デバイスを使用できなかった

## 実装内容

### 1. Firestoreデータ構造
```javascript
users コレクション {
  userName: "安廣拓志",
  userEmail: "mercari.yasuhirotakuji@gmail.com",
  permissionId: "owner",  // 重要: "permission"ではなく"permissionId"
  permissionDisplay: "🔑 オーナー",
  createdAt: "2025-01-23T...",
  deviceId: "token...",
  // その他のフィールド...
}
```

**重要なフィールド名**:
- `userEmail` (NOT `email`)
- `permissionId` (NOT `permission`)
- `userName` (NOT `name`)

### 2. 認証フロー

#### 既存ユーザーの場合
```
1. メールアドレス入力
   ↓
2. FirestoreでuserEmailフィールドを検索
   ↓
3. 既存ユーザー発見
   ↓
4. LocalStorageに保存:
   - reborn_user_name: userName
   - reborn_user_email: userEmail
   - reborn_user_permission_id: permissionId
   - reborn_user_permission_display: permissionDisplay
   ↓
5. IndexedDBにも保存
   ↓
6. 成功メッセージ表示:
   「✅ 認証成功！
   
   {userName}さん（{権限アイコン} {権限名}）としてログインしました。
   
   次に「① 通知を許可」ボタンを押してください。」
   ↓
7. ステップ①（通知許可）へ進む
```

#### 新規ユーザーの場合
```
1. メールアドレス入力
   ↓
2. FirestoreでuserEmailフィールドを検索
   ↓
3. 既存ユーザーなし
   ↓
4. 新規ユーザー登録画面を表示:
   - ユーザー名入力
   - メールアドレス（自動入力・無効化）
   - 権限選択（初回登録者のみオーナー選択可能）
   ↓
5. 登録ボタン押下
   ↓
6. LocalStorage、IndexedDB、Firestoreに保存
   ↓
7. ステップ①へ進む
```

### 3. コード実装（主要部分）

#### メールアドレス認証関数
```javascript
window.checkEmailAndProceed = async function checkEmailAndProceed() {
  const email = document.getElementById('auth-email-input').value.trim();
  
  // Firestore検索
  const { getDocs, collection, query, where } = await import('...');
  const usersCollection = collection(db, 'users');
  const q = query(usersCollection, where('userEmail', '==', email));
  const querySnapshot = await getDocs(q);
  
  if (!querySnapshot.empty) {
    // 既存ユーザー → 自動ログイン
    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    const userName = userData.userName;
    const permissionId = userData.permissionId;
    
    // LocalStorageに保存
    localStorage.setItem('reborn_user_name', userName);
    localStorage.setItem('reborn_user_email', email);
    localStorage.setItem('reborn_user_permission_id', permissionId);
    localStorage.setItem('reborn_user_permission_display', getPermissionDisplayName(permissionId));
    
    // 成功メッセージ表示
    // ...
  } else {
    // 新規ユーザー → 登録画面表示
    // ...
  }
}
```

#### 権限マッピング
```javascript
function getPermissionDisplayName(permissionId) {
  const permissionMap = {
    'owner': '🔑 オーナー',
    'staff': '📋 スタッフ',
    'outsource': '🔧 外注パートナー'
  };
  return permissionMap[permissionId] || '📋 スタッフ';
}
```

### 4. 新規ユーザー登録時のFirestore保存
```javascript
const newUserDoc = await addDoc(usersCollection, {
  userName: userName,
  userEmail: email,
  permissionId: permissionId,
  permissionDisplay: getPermissionDisplayName(permissionId),
  createdAt: new Date().toISOString(),
  deviceId: null  // 通知許可後に設定される
});
```

### 5. HTMLスクショ構造
```html
<!-- メールアドレス入力エリア -->
<div class="step-section" id="email-auth-section">
  <input type="email" id="auth-email-input" />
  <button onclick="checkEmailAndProceed()">次へ →</button>
</div>

<!-- 認証結果表示エリア（独立配置） -->
<div id="auth-result" class="step-result" style="display: none;"></div>

<!-- 新規ユーザー登録画面（初回のみ表示） -->
<div class="step-section" id="new-user-section" style="display: none;">
  <!-- ユーザー名、権限選択フォーム -->
</div>
```

**重要**: `auth-result`を`email-auth-section`の外に配置することで、入力欄を非表示にしても成功メッセージが表示され続ける。

## 動作確認結果

### テスト1: 既存オーナーアカウント
- メール: mercari.yasuhirotakuji@gmail.com
- 結果: ✅ 「安廣拓志さん（🔑 オーナー）としてログインしました」と表示
- Firestore: 既存アカウントを使用、重複なし

### テスト2: 既存スタッフアカウント
- メール: 山田太郎のメールアドレス
- 結果: ✅ 「山田太郎さん（📋 スタッフ）としてログインしました」と表示
- Firestore: 既存アカウントを使用、重複なし

### テスト3: 複数デバイス対応
- スマホで登録 → PCで同じメールアドレスでログイン
- 結果: ✅ 正常に動作、usersコレクションにオーナーは1人のみ

## トラブルシューティング記録

### 問題1: フィールド名の不一致
**症状**: 既存ユーザーが「スタッフ」として表示される
**原因**: コードで`permission`フィールドを参照していたが、実際は`permissionId`
**解決**: すべての参照を`permissionId`に統一

### 問題2: 成功メッセージが表示されない
**症状**: メールアドレス入力後、何も表示されずステップ①が見える
**原因**: `auth-result`が`email-auth-section`内にあり、親要素を非表示にすると一緒に消える
**解決**: `auth-result`を独立した表示エリアとして配置

### 問題3: console.logが動作しない
**症状**: デバッグ時にconsole出力が一切表示されない
**原因**: index.html の8-17行目でconsoleオブジェクトがオーバーライドされている（Safari対応）
**解決**: 画面上にデバッグ情報を表示する方式に変更

## 関連ファイル

- `docs/index.html`: 認証UI + JavaScript実装
- Firestore: `users`コレクション

## 今後の開発での注意点

1. **Firestoreフィールド名は必ず確認する**
   - 実装前に実際のデータ構造を確認
   - `userEmail`, `permissionId`, `userName`を使用

2. **既存ユーザー検索はuserEmailで行う**
   ```javascript
   query(usersCollection, where('userEmail', '==', email))
   ```

3. **新規ユーザー登録時のフィールド**
   ```javascript
   {
     userName: string,
     userEmail: string,
     permissionId: 'owner' | 'staff' | 'outsource',
     permissionDisplay: string,
     createdAt: string (ISO),
     deviceId: string | null
   }
   ```

4. **権限判定はpermissionIdを使う**
   ```javascript
   if (userData.permissionId === 'owner') { ... }
   ```

5. **デバッグ時はconsole.logが無効化されている可能性を考慮**
   - 画面表示でデバッグ
   - または一時的にconsoleオーバーライドをコメントアウト

## 参考コミット
- `e5d638d`: 認証成功メッセージ表示修正
- `e972e6e`: permissionIdフィールド使用 + UIフロー簡素化
- `b7fcae2`: userEmailフィールドを使用した認証修正
