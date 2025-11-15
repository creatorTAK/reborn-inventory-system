# 業務関連マスタのFirestore移行ガイド

**Phase 3: 業務関連マスタ統合**

このガイドでは、スプレッドシート上の業務関連マスタデータをFirestoreに移行する手順を説明します。

---

## 📋 移行対象マスタ

### 1. 発送方法マスタ
- **移行元**: スプレッドシート「発送方法マスタ」シート
- **移行先**: Firestore `shippingMethods` コレクション
- **データ構造**:
  ```javascript
  {
    name: "ゆうパック - 60サイズ", // カテゴリ + 詳細
    category: "ゆうパック", // カテゴリ
    detail: "60サイズ", // 詳細
    price: 700, // 送料
    description: "", // 説明（オプション）
    createdAt: Timestamp,
    updatedAt: Timestamp,
    source: "spreadsheet_migration"
  }
  ```

### 2. 梱包資材マスタ
- **移行元**: スプレッドシート「備品在庫リスト」シート
- **移行先**: Firestore `packagingMaterials` コレクション
- **データ構造**:
  ```javascript
  {
    name: "OPP袋 A4サイズ", // 資材名
    abbreviation: "OPP", // 略称（自動生成）
    category: "袋類", // カテゴリ
    unitPrice: 10, // 単価
    imageUrl: "https://...", // 画像URL
    supplier: "ABC商事", // 発注先
    productLink: "https://...", // 商品リンク
    quantity: 100, // 個数
    price: 1000, // 価格
    inStock: 50, // 入庫数
    outStock: 30, // 出庫数
    inventory: 20, // 在庫数
    expenseType: "個別原価", // 経費区分
    createdAt: Timestamp,
    updatedAt: Timestamp,
    source: "spreadsheet_migration"
  }
  ```

---

## 🚀 移行手順

### Step 1: スプレッドシートを開く

1. REBORN在庫管理システムのスプレッドシートを開く
2. 拡張機能メニューから「Apps Script」を選択

### Step 2: 移行スクリプトを実行

#### 方法A: 一括移行（推奨）
すべての業務関連マスタを一括で移行します。

```javascript
// Apps Scriptエディタで実行
migrateAllBusinessMasters()
```

**実行結果の確認:**
- Apps Script エディタのログを確認
- 「実行ログ」タブに移行件数が表示されます

```
========================================
業務関連マスタの一括移行を開始
========================================
===== 発送方法マスタのFirestore移行開始 =====
✅ 移行成功: ゆうパック - 60サイズ (¥700)
✅ 移行成功: クリックポスト - 標準 (¥185)
...
===== 発送方法マスタの移行完了: 15件 =====
===== 梱包資材マスタのFirestore移行開始 =====
✅ 移行成功: OPP袋 A4サイズ (OPP) - ¥10
✅ 移行成功: プチプチ 120cm (プチ) - ¥50
...
===== 梱包資材マスタの移行完了: 42件 =====
========================================
一括移行完了
発送方法: 15件
梱包資材: 42件
========================================
```

#### 方法B: 個別移行
マスタごとに個別に移行する場合：

```javascript
// 発送方法マスタのみ移行
migrateShippingMethodsToFirestore()

// 梱包資材マスタのみ移行
migratePackagingMaterialsToFirestore()
```

### Step 3: Firestoreでデータ確認

1. Firebase Consoleを開く
2. Firestoreデータベースを選択
3. 以下のコレクションを確認:
   - `shippingMethods` - 発送方法マスタ
   - `packagingMaterials` - 梱包資材マスタ

**確認ポイント:**
- ✅ ドキュメント数がスプレッドシートの行数と一致しているか
- ✅ データが正しく移行されているか
- ✅ `createdAt`、`updatedAt` タイムスタンプが設定されているか

### Step 4: 汎用マスタ管理画面で表示確認

1. PWA版を開く: https://reborn-inventory-system.pages.dev/
2. サイドメニューから「🏢 業務関連マスタ管理」を選択
3. マスタ種別ドロップダウンで以下を確認:
   - ✅ 「発送方法」を選択 → 移行したデータが表示される
   - ✅ 「梱包資材」を選択 → 移行したデータが表示される

---

## ⚠️ 注意事項

### データの重複について
- 同じデータを複数回移行すると、Firestoreに重複して保存されます
- 移行前にFirestoreのコレクションを削除する場合は、Firebase Consoleから手動で削除してください

### スプレッドシートシートの扱い
- 移行後もスプレッドシートシートは**削除されません**
- 必要に応じて `hideOldMasterSheets()` を実行してシートを非表示化できます

```javascript
// 旧マスタシートを非表示化（削除はしない）
hideOldMasterSheets()
```

**非表示化の対象:**
- ✅ 「発送方法マスタ」シート → 非表示化
- ❌ 「備品在庫リスト」シート → 在庫管理で使用中のため非表示にしない

### データのロールバック
移行に失敗した場合や元に戻したい場合：
1. Firebase Consoleから該当コレクションを削除
2. 必要に応じて移行スクリプトを再実行

---

## 🔧 トラブルシューティング

### エラー: `シート「発送方法マスタ」が見つかりません`
**原因**: スプレッドシートに対象シートが存在しない
**解決**: `setup_sales_recording_sheets.js` の `setupSalesRecordingSheets()` を実行してシートを作成

### エラー: `Firestore接続エラー`
**原因**: Firestore認証情報が正しく設定されていない
**解決**: `firestore-key.json` がGASプロジェクトにアップロードされているか確認

### 移行したデータがPWA版で表示されない
**原因**: キャッシュの問題
**解決**:
1. PWAでハードリロード（Cmd+Shift+R / Ctrl+Shift+R）
2. Service Workerのキャッシュをクリア
3. ブラウザのキャッシュをクリア

---

## 📝 移行後の作業

### Phase 3 残りタスク
- [ ] 汎用マスタ管理画面での表示確認（完了）
- [ ] 既存機能（商品登録等）のAPI変更
  - 発送方法選択 → Firestoreから取得
  - 梱包資材選択 → Firestoreから取得
- [ ] 動作確認・デプロイ

### Phase 4: UI/UX最適化
- [ ] レスポンシブ対応確認
- [ ] ローディング状態改善
- [ ] エラーハンドリング強化
- [ ] 実機テスト

---

**作成日**: 2025-11-14
**対象フェーズ**: MASTER-002 Phase 3
**関連ファイル**: `master_migration.js`
