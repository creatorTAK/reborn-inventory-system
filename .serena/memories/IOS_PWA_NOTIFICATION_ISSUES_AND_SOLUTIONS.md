# iOS PWA 通知関連の問題と解決策

## 概要
2024年12月に発生したiOS PWAの通知許可・FCMトークン登録に関する問題とその解決策をまとめる。

---

## 問題1: 2台目端末で通知が受け取れない

### 症状
- 1台目（オーナー）: 通知が正常に動作、iPhoneの通知設定にフリラが表示される
- 2台目（スタッフ）: 通知が動作しない、iPhoneの通知設定にフリラが表示されない

### 根本原因
**スタッフユーザーの認証フローが通知設定画面を完全にスキップしていた**

#### 1台目（オーナー）のフロー:
```
ログイン → ユーザー名入力 → 通知設定画面 → アプリ
```

#### 2台目（スタッフ）のフロー（修正前）:
```
ログイン → ユーザー名入力 → 承認待ち → 管理者承認 → アプリ（通知設定スキップ！）
```

### 解決策
`completeLoginAfterApproval` 関数を修正し、承認後に通知設定画面を表示するように変更。

**修正箇所**: `docs/index.html` の `completeLoginAfterApproval` 関数

```javascript
// 修正前: 直接アプリに遷移
showAppScreen();
navigateToPage('home');

// 修正後: 「次へ（通知設定）」ボタンを表示
document.getElementById('pending-message').innerHTML = `
  <div style="margin-top: 16px;">
    <p style="margin-bottom: 16px;">次に通知設定を行います</p>
    <button onclick="proceedToNotificationAfterApproval(...)">
      次へ（通知設定）
    </button>
  </div>
`;
```

---

## 問題2: iOS PWAで通知許可が denied になる

### 症状
- `Notification.permission` が `default` なのに `requestPermission()` が `denied` を返す
- しかしアプリ画面に遷移すると、再度通知許可ダイアログが表示され、許可できる

### 原因
**iOSのユーザージェスチャーチェーン要件**

iOS PWAでは、通知許可リクエストはユーザーの直接的なタップから始まるジェスチャーチェーン内で行う必要がある。
承認完了後の自動遷移ではこのチェーンが切れてしまう。

### 解決策
1. 承認完了後に「次へ」ボタンを表示し、ユーザーのタップを介して通知設定画面に遷移
2. `denied` が返ってもエラー表示せず、アプリ画面に自動遷移（アプリ内で再度許可ダイアログが出る）

**修正箇所**: `docs/index.html` の `enableNotifications` 関数

```javascript
if (permission !== 'granted') {
  console.log('[通知設定] 初回denied - アプリ画面で再試行します');
  resultDiv.textContent = '通知設定を続行中...';
  setTimeout(() => {
    openApp();
  }, 1000);
  return;
}
```

---

## 問題3: アプリ画面遷移後にFCMトークンが登録されない

### 症状
- 通知許可は取得できた（iPhoneの設定にフリラが表示）
- しかしプッシュ通知が届かない（バッジのみ更新される）

### 原因
アプリ画面に遷移した時点では通知許可がまだ `denied` または `default` のため、`checkAndUpdateFCMToken()` がFCMトークンを取得・登録せずに終了していた。

### 解決策
`checkAndUpdateFCMToken()` 内で通知許可を再リクエストするように修正。

**修正箇所**: `docs/index.html` の `checkAndUpdateFCMToken` 関数

```javascript
// 🔧 iOS PWAで通知許可がまだの場合は再リクエスト
if (Notification.permission !== 'granted') {
  console.log('🔔 通知許可をリクエスト中...');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.log('⏭️ 通知が許可されていないため、FCMトークンチェックをスキップ');
    return;
  }
}
```

---

## 問題4: ヘッダーのやることリストバッジが更新されない

### 症状
- ホームメニュー画面のミニヘッダー（`mini-todo-badge`）にはバッジが表示される
- 他の画面（チャット等）のヘッダー（`todo-badge-count`）にはバッジが表示されない

### 原因
- `startTodoListener()` はページ読み込み時に1回だけ呼ばれる
- その時点ではユーザーがログインしていないため、`userEmail` がなく早期リターン
- ログイン後に `startTodoListener()` が再度呼ばれていなかった

### 解決策
`showAppScreen()` 内で `startTodoListener()` を呼び出すように修正。

**修正箇所**: `docs/index.html` の `showAppScreen` 関数

```javascript
async function showAppScreen() {
  document.getElementById('setup-screen').style.display = 'none';
  document.getElementById('app-screen').style.display = 'flex';

  await checkAndUpdateFCMToken();

  // やることリストのリスナーを開始（ヘッダーバッジ更新用）
  if (typeof startTodoListener === 'function') {
    startTodoListener();
  }
}
```

---

## 関連ファイル

| ファイル | 役割 |
|---------|------|
| `docs/index.html` | メインPWA、認証フロー、通知設定、ヘッダーバッジ |
| `docs/menu_home.html` | ホームメニュー、ミニヘッダーバッジ（`mini-todo-badge`） |
| `docs/todo_history.html` | 完了タスク履歴画面 |

---

## デバッグ時の注意点

### iOS PWA通知のデバッグ情報
```javascript
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isStandalone = window.navigator.standalone === true;
const isIOSPWA = isIOS && isStandalone;
const iOSVersion = parseFloat(navigator.userAgent.match(/OS (\d+)_/)?.[1] || '0');
const hasFirebaseMessaging = !!window.firebaseMessaging;
const hasNotificationAPI = 'Notification' in window;
const hasPushManager = 'PushManager' in window;
const currentPermission = Notification.permission;
```

### デプロイ先
- **furira.jp**: `git push` + `npx firebase deploy --only hosting`
- **Cloudflare Pages (reborn.furira.jp)**: `git push origin main` のみ

---

## 教訓

1. **認証フローの全パスを確認**: オーナーとスタッフで異なるフローがある場合、両方で必要な処理（通知設定等）が実行されるか確認
2. **iOS PWAのユーザージェスチャー要件**: 自動遷移ではなくユーザーのタップを介して通知許可をリクエスト
3. **リスナー開始のタイミング**: ページ読み込み時ではなく、ログイン完了後にリスナーを開始
4. **複数画面でのバッジ同期**: 同じデータを表示する複数のUIコンポーネントがある場合、それぞれのリスナーが正しく動作しているか確認
