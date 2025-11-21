# クロスオリジンlocalStorage問題とFirestore解決策

**重要度: 🔴 最高（アーキテクチャ設計の根幹）**

## 📋 問題の概要

REBORNシステムは複数ドメインで構成されており、localStorageの同一オリジンポリシーによりデータ共有ができない問題が発生した。

## 🎯 発生した具体的な問題（2025-11-20）

### 症状
- **設定画面（config.html）でセールスワード設定を保存** → 成功
- **商品登録画面（product.html）で読み込み** → 失敗（localStorage: null）
- デフォルトセールスワードが自動選択されない
- よく使うワードがカテゴリプルダウンに表示されない

### 原因
```
config.html:    https://furira.jp (GASドメイン)
product.html:   https://reborn-inventory-system.pages.dev (Cloudflare Pages)

→ 異なるオリジン
→ localStorageは同一オリジンポリシーに従う
→ データ共有不可能
```

## 🔍 デバッグログによる原因特定

### config.html（保存側）
```javascript
📍 [DEBUG] オリジン: "https://furira.jp"
✅ 全設定をlocalStorageに保存しました
🔍 [DEBUG] 保存直後の読み込み成功: {よく使う: [], デフォルト: {...}}
```
→ 同一ページ内では読み書き成功

### product.html（読み込み側）
```javascript
📍 [DEBUG] オリジン: "https://reborn-inventory-system.pages.dev"
📍 [DEBUG] localStorage.length: 0
✅ Step 1: localStorageから読み込み完了: {}
[applyDefaultSalesword] saleswordConfig: undefined
```
→ 別オリジンのため空

## ✅ 解決策：Firestore経由でのデータ共有

### アーキテクチャ設計
```
┌─────────────────┐
│  config.html    │ (https://furira.jp)
│  設定画面       │
└────┬────────────┘
     │ 1. localStorage保存（同一オリジン用キャッシュ）
     │ 2. Firestore保存（クロスオリジン共有）
     ↓
┌─────────────────────────────────┐
│  Firestore                      │
│  collection: settings           │
│  doc: common                    │
│  {                              │
│    salesword: {...},            │
│    discount: {...},             │
│    ...                          │
│  }                              │
└────┬────────────────────────────┘
     │
     ↓ 3. Firestore読み込み
┌─────────────────┐
│  product.html   │ (https://reborn-inventory-system.pages.dev)
│  商品登録画面   │
│                 │ 4. CACHED_CONFIGに反映
│                 │ 5. localStorage保存（次回高速表示用）
└─────────────────┘
```

### 実装コード（product-scripts.js）

```javascript
// docs/js/product-scripts.js の loadAllConfig() 関数

async function loadAllConfig() {
  console.log('🚀 設定読み込み開始（ハイブリッド方式）');
  
  // 1. まずlocalStorageから即座に読み込み（高速表示用キャッシュ）
  try {
    if (!window.CACHED_CONFIG) {
      window.CACHED_CONFIG = {};
    }

    const salesword = localStorage.getItem('rebornConfig_salesword');
    if (salesword) window.CACHED_CONFIG['よく使うセールスワード'] = JSON.parse(salesword);
    // 他の設定も同様...

    console.log('✅ Step 1: localStorageから読み込み完了:', window.CACHED_CONFIG);
  } catch (e) {
    console.error('localStorage読み込みエラー:', e);
  }

  // 2. Firestoreから最新設定を取得してCACHED_CONFIGに統合（PWA版）
  console.log('🔄 Step 2: Firestoreから最新設定を取得中...');
  try {
    const docRef = firebase.firestore().collection('settings').doc('common');
    const docSnap = await docRef.get();
    
    if (docSnap.exists) {
      const firestoreData = docSnap.data();
      console.log('✅ Firestoreから設定取得成功:', firestoreData);
      
      // Firestoreのデータを日本語キーに変換してCACHED_CONFIGにマージ
      if (firestoreData.salesword) {
        window.CACHED_CONFIG['よく使うセールスワード'] = firestoreData.salesword;
        localStorage.setItem('rebornConfig_salesword', JSON.stringify(firestoreData.salesword));
        console.log('✅ セールスワード設定をCACHED_CONFIGに反映:', firestoreData.salesword);
      }
      // 他の設定も同様に処理...
      
      console.log('✅ Step 2: Firestore設定をCACHED_CONFIGに統合完了:', window.CACHED_CONFIG);
    }
  } catch (e) {
    console.error('❌ Firestore設定取得エラー:', e);
    console.log('⚠️ localStorageのみを使用します');
  }
}
```

### キーポイント

1. **非同期処理への変更**
   - `function loadAllConfig()` → `async function loadAllConfig()`
   - 呼び出し側: `loadAllConfig()` → `await loadAllConfig()`

2. **英語キー → 日本語キーのマッピング**
   ```javascript
   firestoreData.salesword → window.CACHED_CONFIG['よく使うセールスワード']
   firestoreData.discount → window.CACHED_CONFIG['割引情報']
   // config.htmlで使用している日本語キーに合わせる
   ```

3. **localStorageへのキャッシュ保存**
   ```javascript
   // 次回のページ読み込み時に高速表示するため
   localStorage.setItem('rebornConfig_salesword', JSON.stringify(firestoreData.salesword));
   ```

## 🎯 適用範囲

この解決策は以下のすべての設定に適用済み：

- ✅ セールスワード設定（`salesword`）
- ✅ 割引情報（`discount`）
- ✅ ハッシュタグ設定（`hashtag`）
- ✅ 配送デフォルト（`shippingDefault`）
- ✅ 仕入出品デフォルト（`procureListingDefault`）
- ✅ 管理番号設定（`managementNumber`）
- ✅ AI生成設定（`aiSettings`）
- ✅ 商品状態ボタン（`conditionButtons`）

## ⚠️ 今後の注意事項

### 新しい設定項目を追加する場合

1. **config.htmlで保存処理追加**
   ```javascript
   // Firestoreに保存
   if (firestoreData.新しい設定) {
     await db.collection('settings').doc('common').set({
       新しい設定: data
     }, { merge: true });
   }
   ```

2. **product-scripts.jsで読み込み処理追加**
   ```javascript
   // loadAllConfig() 内に追加
   if (firestoreData.新しい設定) {
     window.CACHED_CONFIG['新しい設定の日本語キー'] = firestoreData.新しい設定;
     localStorage.setItem('rebornConfig_新しい設定', JSON.stringify(firestoreData.新しい設定));
   }
   ```

3. **必ずFirestore保存とCACHED_CONFIG反映の両方を実装**
   - localStorage保存だけでは、異なるオリジンで読み込めない
   - Firestore経由の共有が必須

### デバッグ方法

クロスオリジン問題を疑う症状：
- 設定画面で保存成功するが、商品登録画面で反映されない
- console.logで `localStorage.getItem()` が `null` を返す
- `window.CACHED_CONFIG` が空オブジェクト `{}`

確認手順：
1. F12 → Console で以下を実行
   ```javascript
   console.log('現在のオリジン:', window.location.origin);
   console.log('localStorage件数:', localStorage.length);
   console.log('CACHED_CONFIG:', window.CACHED_CONFIG);
   ```

2. 異なるオリジンで同じ確認を実施
3. オリジンが異なる場合、この解決策を適用

## 📚 関連ドキュメント

- **CLOUDFLARE_PAGES_DEPLOYMENT_STRUCTURE**: PWAのパス構造
- **DEPLOYMENT_RULES**: デプロイ手順
- **SEC-002_FIREBASE_API_KEY_SECURITY**: Firestoreセキュリティ設定

## 📝 修正履歴

- **2025-11-20**: 初版作成（セールスワード設定のクロスオリジン問題解決）
- **Commit**: `63a1a93` - fix: Firestore経由で設定共有（localStorage同一オリジン制約回避）

---

**このメモリーは必ず保持すること**
- 同様の問題が発生した際の解決パターン
- 新機能追加時の実装ガイドライン
- REBORNシステムのアーキテクチャ理解に不可欠
