# Firebase SDK パフォーマンスガイド

**作成日**: 2025-12-14
**関連Issue**: プルダウン読み込み30秒遅延問題

---

## 🚨 重要な教訓

### Firebase SDKには2種類ある

| SDK種類 | 読み込み方式 | 初期化速度 | 使用例 |
|---------|-------------|-----------|--------|
| **compat版** | `<script src="...">` (同期) | ⚡ 即座 | product.html |
| **モジュラー版** | `<script type="module">` (遅延) | 🐢 遅い | 旧purchase.html |

### ⚠️ 絶対にやってはいけないこと

**同じプロジェクト内でSDK方式を混在させない**

- product.htmlがcompat版なら、他のページもcompat版を使う
- 混在させると、片方だけ極端に遅くなる

---

## 📋 SDK比較

### compat版（推奨）

```html
<!-- SDKの読み込み -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>

<script>
  // 初期化
  const app = firebase.apps.length ? firebase.app() : firebase.initializeApp(firebaseConfig);
  const db = firebase.firestore();

  // 設定（重要！）
  db.settings({
    cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
    experimentalForceLongPolling: true  // WebSocket問題回避
  });

  // API使用例
  const snapshot = await db.collection('suppliers').get();
  const docSnap = await db.collection('settings').doc('labelSettings').get();
  await db.collection('products').doc(id).update({ ... });
  await db.collection('batches').doc(id).set({ ... });
  
  // serverTimestamp
  createdAt: firebase.firestore.FieldValue.serverTimestamp()
  
  // exists チェック（プロパティ）
  if (docSnap.exists) { ... }
</script>
```

### モジュラー版（非推奨 - 遅い）

```html
<script type="module">
  import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
  import { getFirestore, collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);

  // API使用例
  const snapshot = await getDocs(collection(db, 'suppliers'));
  const docSnap = await getDoc(doc(db, 'settings', 'labelSettings'));
  await updateDoc(doc(db, 'products', id), { ... });
  await setDoc(doc(db, 'batches', id), { ... });
  
  // serverTimestamp
  createdAt: serverTimestamp()
  
  // exists チェック（メソッド）
  if (docSnap.exists()) { ... }
</script>
```

---

## 🔧 パフォーマンス最適化設定

### 必須設定（compat版）

```javascript
db.settings({
  // キャッシュサイズ無制限
  cacheSizeBytes: firebase.firestore.CACHE_SIZE_UNLIMITED,
  
  // WebSocket問題回避（long polling使用）
  experimentalForceLongPolling: true
});
```

### なぜexperimentalForceLongPollingが必要か

- 一部の環境でWebSocket接続が不安定
- long pollingは安定しているが若干遅い
- しかしWebSocket失敗時のリトライよりは速い

---

## 📝 新規ページ作成時のチェックリスト

1. **既存ページのSDK方式を確認**
   ```bash
   grep -n "firebase-.*-compat.js\|type=\"module\"" docs/*.html
   ```

2. **同じSDK方式を使用**
   - product.htmlがcompat版 → 新規ページもcompat版

3. **設定を統一**
   - `experimentalForceLongPolling: true`
   - `cacheSizeBytes: CACHE_SIZE_UNLIMITED`

4. **APIスタイルを統一**
   - compat版: `db.collection('xxx').doc('yyy').get()`
   - モジュラー版: `getDoc(doc(db, 'xxx', 'yyy'))`

---

## 🔄 API変換早見表

| 操作 | compat版 | モジュラー版 |
|------|----------|-------------|
| コレクション取得 | `db.collection('xxx').get()` | `getDocs(collection(db, 'xxx'))` |
| ドキュメント取得 | `db.collection('xxx').doc('id').get()` | `getDoc(doc(db, 'xxx', 'id'))` |
| ドキュメント作成 | `db.collection('xxx').doc('id').set(data)` | `setDoc(doc(db, 'xxx', 'id'), data)` |
| ドキュメント更新 | `db.collection('xxx').doc('id').update(data)` | `updateDoc(doc(db, 'xxx', 'id'), data)` |
| タイムスタンプ | `firebase.firestore.FieldValue.serverTimestamp()` | `serverTimestamp()` |
| 存在チェック | `docSnap.exists` (プロパティ) | `docSnap.exists()` (メソッド) |

---

## 📚 関連ファイル

- **product.html**: compat版の参考実装
- **purchase.html**: v286でcompat版に変更済み

---

**最終更新**: 2025-12-14
**更新者**: Claude Code
