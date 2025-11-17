# 技術パターン: iframe内戻るボタン実装

**作成日**: 2025-11-16
**適用事例**: MASTER-002（汎用マスタ管理エンジン）
**目的**: 全メニュー画面に統一的な戻るボタンを実装する

---

## 📋 問題定義

### 発生する問題

**症状**:
- トップメニュー（GAS） → iframe内のPWA画面 → 戻るボタンをクリック → 何も起こらない

**原因**:
1. **onclick問題**: `onclick="goBack()"` がグローバルスコープでgoBackを探すが見つからない
2. **sessionId問題**: iframe内でsessionStorageが共有されず、sessionIdがnullになる
3. **Firestore Navigation**: sessionIdチェックで弾かれる

---

## ✅ 解決パターン

### Pattern 1: addEventListener方式（推奨）

**HTML（戻るボタン）**:
```html
<!-- ❌ 非推奨: inline onclick -->
<button class="back-button" onclick="goBack()">
  <i class="bi bi-chevron-left"></i>
</button>

<!-- ✅ 推奨: id属性のみ -->
<button class="back-button" id="back-button">
  <i class="bi bi-chevron-left"></i>
</button>
```

**JavaScript（イベントリスナー設定）**:
```javascript
// DOMContentLoaded後に戻るボタンにイベントリスナーを設定
document.addEventListener('DOMContentLoaded', () => {
  const backButton = document.getElementById('back-button');
  if (backButton) {
    backButton.addEventListener('click', goBack);
    console.log('[ページ名] ✅ 戻るボタンにgoBack()イベントリスナーを設定しました');
  } else {
    console.error('[ページ名] ❌ 戻るボタンが見つかりません');
  }
});
```

**利点**:
- ✅ スクリプトロード順序に依存しない
- ✅ モジュールスコープでも動作する
- ✅ デバッグログで確認しやすい

---

### Pattern 2: sessionId受け渡し（必須）

#### 親ページ（index.html）側

**navigateToPage()関数内**:
```javascript
// sessionIdを取得
const sessionId = sessionStorage.getItem('device_session_id');
const sessionIdParam = '&sessionId=' + encodeURIComponent(sessionId);

// iframe.srcにsessionIdを追加
if (page === 'master-product') {
  const pwaBaseUrl = 'https://reborn-inventory-system.pages.dev';
  iframe.src = pwaBaseUrl + '/master-management.html?category=product' + sessionIdParam;
}
```

**重要ポイント**:
- sessionIdは `sessionStorage.getItem('device_session_id')` から取得
- URLパラメータとして渡す（`&sessionId=xxx`）
- 全てのPWA画面遷移で統一して渡す

#### iframe内（PWA画面）側

**初期化処理（DOMContentLoaded内）**:
```javascript
// URLパラメータからsessionIdを取得
const urlParams = new URLSearchParams(window.location.search);
const sessionId = urlParams.get('sessionId');

console.log('[ページ名] URLパラメータ sessionId:', sessionId);

// sessionIdをsessionStorageに保存（iframe内でもアクセス可能にする）
if (sessionId) {
  sessionStorage.setItem('device_session_id', sessionId);
  console.log('[ページ名] ✅ sessionIdをsessionStorageに保存しました');
} else {
  console.warn('[ページ名] ⚠️ URLパラメータにsessionIdがありません');
}
```

**重要ポイント**:
- URLパラメータから取得したsessionIdを**必ずsessionStorageに保存**
- これをしないとgoBack()でsessionIdがnullになる

---

### Pattern 3: goBack()関数実装

**完全な実装例**:
```javascript
async function goBack() {
  // 確実なログ（関数呼び出し確認用）
  console.log('[ページ名] >>> goBack() called at', new Date().toISOString());

  // iframe内で開かれているか判定
  const isInIframe = window.self !== window.top;

  if (isInIframe) {
    // iframe内から親ページのトップメニューに戻る（Firestore経由）
    console.log('[ページ名] iframe内で開かれているため、Firestore経由で戻る');
    try {
      // Firestoreを初期化
      if (typeof window.initializeFirestore !== 'function') {
        console.error('[ページ名] ❌ initializeFirestore関数が未定義');
        alert('Firestore初期化関数が見つかりません');
        return;
      }

      const db = await window.initializeFirestore();
      console.log('[ページ名] ✅ Firestore初期化完了');

      const sessionId = sessionStorage.getItem('device_session_id');
      console.log('[ページ名] sessionId:', sessionId);

      // Firestore v9 modular syntax
      const { getFirestore, collection, doc, setDoc, serverTimestamp } =
        await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

      // menuControlドキュメントに書き込み
      await setDoc(doc(db, 'navigation', 'menuControl'), {
        action: 'navigate',
        page: 'home',
        sessionId: sessionId,
        timestamp: serverTimestamp(),
        from: 'ページ識別子' // 例: 'master-management', 'inventory', 'config'
      });
      console.log('[ページ名] ✅ Firestore書き込み成功 - トップメニューに戻る');
    } catch (error) {
      console.error('[ページ名] ❌ Firestoreエラー:', error);
      alert('戻る処理でエラーが発生しました: ' + error.message);
    }
  } else {
    // 直接開かれている場合はブラウザの履歴で戻る
    console.log('[ページ名] 直接開かれているため、history.back()で戻る');
    window.history.back();
  }
}
```

**重要ポイント**:
- `from` フィールドでどの画面から戻ったかを識別できる
- sessionIdがnullの場合でも書き込みは成功するが、親側でスキップされる
- iframe判定を必ず行う（直接開かれた場合の対応）

---

## 🔄 完全な実装フロー

### 1. 親ページ（index.html）の準備

**navigateToPage()関数の修正**:
```javascript
function navigateToPage(page) {
  // ... 既存のコード ...

  // sessionIdを取得
  const sessionId = sessionStorage.getItem('device_session_id');
  const sessionIdParam = '&sessionId=' + encodeURIComponent(sessionId);

  if (page === '新しいページ') {
    iframe.src = baseUrl + '?menu=xxx' + sessionIdParam; // GAS版
    // または
    iframe.src = pwaBaseUrl + '/page.html' + sessionIdParam; // PWA版
  }
}
```

**menuControl listener（既存）**:
```javascript
// 既にindex.htmlに実装済み
onSnapshot(doc(db, 'navigation', 'menuControl'), (snapshot) => {
  if (snapshot.exists()) {
    const data = snapshot.data();

    // 初回読み込みは無視
    if (isFirstMenuSnapshot) {
      isFirstMenuSnapshot = false;
      return;
    }

    // sessionId一致チェック
    const mySessionId = sessionStorage.getItem('device_session_id');
    if (data.sessionId !== mySessionId) {
      return; // 他の端末の操作
    }

    // navigate要求を処理
    if (data.action === 'navigate' && data.page) {
      navigateToPage(data.page);
    }
  }
});
```

### 2. iframe内（PWA/GAS画面）の実装

**HTML構造**:
```html
<div class="header">
  <div class="header-content">
    <button class="back-button" id="back-button">
      <i class="bi bi-chevron-left"></i>
    </button>
    <div class="header-title">ページタイトル</div>
  </div>
</div>
```

**JavaScript実装**:
```javascript
// 1. sessionId受け渡し（初期化時）
document.addEventListener('DOMContentLoaded', () => {
  // URLパラメータからsessionIdを取得
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('sessionId');

  if (sessionId) {
    sessionStorage.setItem('device_session_id', sessionId);
    console.log('[ページ名] ✅ sessionIdをsessionStorageに保存しました');
  }

  // 2. 戻るボタンにイベントリスナーを設定
  const backButton = document.getElementById('back-button');
  if (backButton) {
    backButton.addEventListener('click', goBack);
    console.log('[ページ名] ✅ 戻るボタンにgoBack()イベントリスナーを設定しました');
  }
});

// 3. goBack()関数
async function goBack() {
  console.log('[ページ名] >>> goBack() called at', new Date().toISOString());

  const isInIframe = window.self !== window.top;

  if (isInIframe) {
    console.log('[ページ名] iframe内で開かれているため、Firestore経由で戻る');
    try {
      if (typeof window.initializeFirestore !== 'function') {
        console.error('[ページ名] ❌ initializeFirestore関数が未定義');
        alert('Firestore初期化関数が見つかりません');
        return;
      }

      const db = await window.initializeFirestore();
      console.log('[ページ名] ✅ Firestore初期化完了');

      const sessionId = sessionStorage.getItem('device_session_id');
      console.log('[ページ名] sessionId:', sessionId);

      const { doc, setDoc, serverTimestamp } =
        await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

      await setDoc(doc(db, 'navigation', 'menuControl'), {
        action: 'navigate',
        page: 'home',
        sessionId: sessionId,
        timestamp: serverTimestamp(),
        from: 'ページ識別子'
      });
      console.log('[ページ名] ✅ Firestore書き込み成功 - トップメニューに戻る');
    } catch (error) {
      console.error('[ページ名] ❌ Firestoreエラー:', error);
      alert('戻る処理でエラーが発生しました: ' + error.message);
    }
  } else {
    console.log('[ページ名] 直接開かれているため、history.back()で戻る');
    window.history.back();
  }
}
```

---

## 🎯 各メニュー別の適用方法

### GAS版メニュー（商品登録、在庫管理、設定管理）

**ファイル例**:
- `register_product.html`
- `manage_inventory.html`
- `sidebar_config.html`

**実装手順**:
1. ヘッダーに戻るボタンHTML追加
2. `<script>` セクションにgoBack()関数追加
3. addEventListener設定追加
4. URLパラメータからsessionId取得→sessionStorage保存

**注意点**:
- GAS版は `baseUrl + '?menu=xxx' + sessionIdParam` 形式
- window.initializeFirestore は存在しないので、別の初期化方法が必要
- または、PWA版に移行することを検討

### PWA版メニュー（マスタ管理）

**ファイル例**:
- `docs/master-management.html`（実装済み）
- 今後のPWA画面全て

**実装手順**:
1. 上記のPattern 1-3を全て実装
2. index.htmlでsessionIdParamを追加

---

## 🧪 デバッグ方法

### 期待されるコンソールログフロー

**正常動作時**:
```
1. [ページ名] URLパラメータ sessionId: 1763280924658_xxx
2. [ページ名] ✅ sessionIdをsessionStorageに保存しました
3. [ページ名] ✅ 戻るボタンにgoBack()イベントリスナーを設定しました
--- 戻るボタンクリック ---
4. [ページ名] >>> goBack() called at 2025-11-16T08:15:42.760Z
5. [ページ名] iframe内で開かれているため、Firestore経由で戻る
6. [ページ名] ✅ Firestore初期化完了
7. [ページ名] sessionId: 1763280924658_xxx
8. [ページ名] ✅ Firestore書き込み成功 - トップメニューに戻る
--- 親ページ側 ---
9. [Navigation] 🔔 Menu onSnapshot コールバック実行
10. [Navigation] ✅ navigate要求を受信 → navigateToPage()呼び出し: home
```

### トラブルシューティング

**問題1: goBack()が呼ばれない**
```
症状: >>> goBack() called at が出ない
原因: addEventListener未設定、または要素が見つからない
確認:
- typeof goBack → "function" か？
- document.getElementById('back-button') → null ではないか？
```

**問題2: sessionIdがnull**
```
症状: [ページ名] sessionId: null
原因: URLパラメータにsessionIdがない、または保存していない
確認:
- window.location.search に sessionId が含まれているか？
- sessionStorage.setItem() を実行したか？
```

**問題3: 親ページでスキップされる**
```
症状: [Navigation] ⏭️ 他の端末の操作のためスキップ
原因: sessionIdが一致しない
確認:
- iframe内のsessionId と index.htmlのsessionId が同じか？
- console.logで両方を確認
```

---

## 📝 チェックリスト（実装時）

### 親ページ（index.html）
- [ ] navigateToPage()でsessionIdParamを追加
- [ ] menuControl listenerが正常動作（既存）

### iframe内（各画面）
- [ ] ヘッダーに戻るボタンHTML追加（id="back-button"）
- [ ] URLパラメータからsessionId取得
- [ ] sessionStorageに保存
- [ ] addEventListener設定
- [ ] goBack()関数実装
- [ ] 確実なログ追加（各ステップ）

### テスト
- [ ] トップメニューから開く
- [ ] 戻るボタンをクリック
- [ ] コンソールログ確認
- [ ] トップメニューに戻る

---

## 🔗 参考資料

- **実装事例**: MASTER-002（docs/master-management.html）
- **コミット**:
  - ea7d682: addEventListener方式に変更
  - 9b98152: sessionId問題修正
- **Issue**: docs/issues.md - MASTER-002

---

**作成者**: Claude (Anthropic)
**レビュー**: REBORN開発チーム
**最終更新**: 2025-11-16
