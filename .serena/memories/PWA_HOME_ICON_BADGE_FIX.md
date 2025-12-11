# PWAホーム画面アイコンバッジの修正記録

## 問題
- プッシュ通知は届くが、ホーム画面のPWAアイコンにバッジが表示されない
- アプリを一度開いて閉じるとバッジが表示される

## 原因
Service Worker (`firebase-messaging-sw.js`) の `incrementBadge()` 関数で：
- IndexedDBにバッジカウントを保存 → ✅ 実行されていた
- `navigator.setAppBadge()` でアイコンバッジを設定 → ❌ **呼び出されていなかった**

## 解決方法
`incrementBadge()` 関数に `navigator.setAppBadge()` の呼び出しを追加：

```javascript
getReq.onsuccess = () => {
  const currentCount = Number(getReq.result || 0) + 1;
  store.put(currentCount, 'count');
  console.log(`[Badge] ${dbName} count:`, currentCount);

  // 🔔 ホーム画面アイコンにバッジを設定
  if (navigator.setAppBadge) {
    navigator.setAppBadge(currentCount).then(() => {
      console.log(`[Badge] ✅ setAppBadge(${currentCount}) 成功`);
    }).catch(err => {
      console.warn(`[Badge] ⚠️ setAppBadge失敗:`, err);
    });
  } else {
    console.log('[Badge] setAppBadge API未対応');
  }
};
```

## 修正ファイル
- `docs/firebase-messaging-sw.js` (v155)

## 補足
- `navigator.setAppBadge()` はPWA APIで、ホーム画面に追加したアイコンにバッジを表示する
- iOS Safari (iOS 16.4+) とChrome/Edgeでサポート
- Service Worker内から呼び出し可能

## 関連する仕組み
1. **プッシュ通知受信時**: Service Worker → `incrementBadge()` → IndexedDB保存 + `setAppBadge()`
2. **アプリを開いた時**: PWA → Firestoreから未読数取得 → `setAppBadge()`

## 日付
2025-12-09
