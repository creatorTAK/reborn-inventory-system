# ネクストエンジン連携 ギャップ分析レポート

**作成日**: 2025-12-29
**目的**: REBORNシステムとネクストエンジン連携に必要な変更点の特定

---

## 1. 現状分析

### 1.1 REBORNシステムの機能概要

| 機能 | 概要 | Firestoreコレクション |
|------|------|---------------------|
| 商品登録 | 商品情報、画像、AI説明文生成 | `products` |
| 在庫管理 | ステータス管理、SKU対応 | `products` (statusフィールド) |
| 販売管理 | 販売済商品、入金管理 | `products` (status=販売済み) |
| 売上分析 | KPI、期間別・カテゴリ別分析 | `products`から集計 |
| 棚卸 | QRスキャンベース棚卸 | `products` |
| 入出庫履歴 | 入庫/出庫/調整記録 | `inventoryHistory` |
| 仕入管理 | 仕入スロット、ラベル印刷 | `purchaseSlots` |

### 1.2 REBORN商品データ構造（現在）

```javascript
{
  productId: "P-00001",
  managementNumber: "AA-1041",
  brand: { nameEn: "NIKE", nameKana: "ナイキ" },
  category: {
    superCategory: "メンズ",
    major: "トップス",
    middle: "Tシャツ/カットソー",
    minor: "半袖",
    detail1: "", detail2: ""
  },
  productName: "商品名",
  description: "商品説明",
  condition: "目立った傷や汚れなし",
  size: { display: "L", actual: "L" },

  purchase: { date: Date, supplier: "セカスト", amount: 1000 },
  listing: { date: Date, destination: "メルカリ", amount: 3980 },
  shipping: { feeBearer: "送料込み", method: "らくらくメルカリ便", ... },

  status: "登録済み|出品準備中|出品中|販売済み|取り下げ",
  itemType: "unique|sku-based",
  stockQuantity: 1,

  images: { imageUrls: [...] },
  createdAt: Date,
  updatedAt: Date
}
```

### 1.3 ネクストエンジンAPI機能

| API | エンドポイント | 用途 |
|-----|---------------|------|
| 商品マスタ登録 | `/api_v1_master_goods/upload` | 商品情報登録 |
| 商品マスタ検索 | `/api_v1_master_goods/search` | 商品情報取得 |
| 在庫マスタ検索 | `/api_v1_master_stock/search` | 在庫情報取得 |
| 拠点在庫更新 | `/api_v1_master_base_stock/upload` | 在庫数更新 |
| 受注伝票検索 | `/api_v1_receiveorder/search` | 受注情報取得 |
| 受注伝票更新 | `/api_v1_receiveorder/update` | 受注ステータス更新 |

---

## 2. ギャップ分析

### 2.1 🔴 重大なギャップ（必須対応）

#### GAP-001: プラットフォーム商品ID管理がない

**現状**: REBORNは内部管理番号（managementNumber）のみ管理
**必要**: 各プラットフォームでの出品ID（メルカリ商品ID、BASE商品ID等）

**対応策**:
```javascript
// productsコレクションに追加
platformIds: {
  nextEngine: "NE-123456",      // ネクストエンジン商品コード
  mercariShops: "m12345678",     // メルカリShops商品ID
  base: "base-item-001",         // BASE商品ID
  shopify: "shopify-001"         // Shopify商品ID
}
```

**影響範囲**: 商品登録、在庫管理、販売記録

---

#### GAP-002: 受注管理機能がない

**現状**: 「販売済み」ステータスのみで管理、受注フローなし
**必要**: 受注→発送準備→出荷→配送完了のフロー管理

**対応策**:
```javascript
// 新規コレクション: orders
{
  orderId: "ORD-001",
  productId: "P-00001",
  platform: "mercari-shops",
  platformOrderId: "MERCARI-12345",
  status: "受注済|発送準備中|出荷済|配送完了|キャンセル",
  orderDate: Date,
  shippedDate: Date,
  deliveredDate: Date,
  trackingNumber: "1234-5678-9012",
  buyer: { ... },
  payment: { ... }
}
```

**影響範囲**: 新規画面追加「受注管理」、販売管理画面改修

---

#### GAP-003: 双方向在庫同期の仕組みがない

**現状**: REBORN内でのみ在庫管理、外部連携なし
**必要**: ネクストエンジン↔REBORN間の在庫同期

**対応策**:
1. **REBORN→ネクストエンジン**: 商品登録時にAPI呼び出し
2. **ネクストエンジン→REBORN**: Webhookまたは定期ポーリング

```
┌──────────┐    商品登録API     ┌──────────────────┐
│  REBORN  │ ─────────────────→ │  ネクストエンジン  │
│          │ ←───────────────── │                  │
└──────────┘    Webhook/Polling └──────────────────┘
                (受注/在庫変動)
```

**影響範囲**: Cloud Functions追加、Firestoreトリガー

---

#### GAP-004: カテゴリマッピングがない

**現状**: REBORN独自カテゴリ体系
**必要**: 各プラットフォームへのカテゴリID変換

**対応策**: (既存Issue MAP-001参照)
```javascript
// categories/{categoryId}/platformMappings
{
  mercariShops: { categoryId: "1234", categoryName: "..." },
  base: { categoryId: "BASE-CAT-001", ... },
  ...
}
```

**影響範囲**: マスタ管理、商品登録

---

### 2.2 🟡 中程度のギャップ（優先対応）

#### GAP-005: 商品データ変換レイヤーがない

**現状**: Firestoreに直接保存
**必要**: REBORN形式→ネクストエンジンCSV形式の変換

**対応策**:
```javascript
// Cloud Function: convertToNextEngineFormat
function convertToNextEngineFormat(rebornProduct) {
  return {
    goods_id: rebornProduct.managementNumber,
    goods_name: rebornProduct.productName,
    jan_code: "",
    goods_option1_name: rebornProduct.size.display,
    selling_price: rebornProduct.listing.amount,
    cost_price: rebornProduct.purchase.amount,
    image_url_http: rebornProduct.images.imageUrls[0],
    // ...その他必須フィールド
  };
}
```

**影響範囲**: 新規モジュール追加

---

#### GAP-006: 出荷・配送追跡機能がない

**現状**: 発送方法の設定のみ、追跡なし
**必要**: 追跡番号管理、配送ステータス表示

**対応策**:
- `orders`コレクションに追跡情報追加
- 配送状況画面の新規追加

**影響範囲**: 受注管理画面、通知機能

---

#### GAP-007: ネクストエンジン認証情報管理

**現状**: なし
**必要**: APIトークン、リフレッシュトークンの安全な管理

**対応策**:
- Firebase Secret Manager または環境変数で管理
- トークンリフレッシュの自動化

**影響範囲**: 設定管理、Cloud Functions

---

### 2.3 🟢 軽微なギャップ（将来対応可）

#### GAP-008: 売上分析のプラットフォーム別表示

**現状**: 全体集計のみ
**必要**: プラットフォーム別売上・利益分析

**対応策**: 既存分析画面の拡張

---

#### GAP-009: 一括出品機能

**現状**: 1商品ずつ登録
**必要**: 複数商品の一括登録→一括出品

**対応策**: バッチ処理の実装

---

## 3. 対応優先順位

### Phase 1: 基盤整備（必須・先行）

| 優先度 | ギャップID | 対応内容 | 工数目安 |
|-------|-----------|---------|---------|
| 1 | GAP-007 | ネクストエンジン認証情報管理 | 0.5日 |
| 2 | GAP-005 | 商品データ変換レイヤー | 1日 |
| 3 | GAP-001 | プラットフォーム商品ID管理 | 0.5日 |
| 4 | GAP-004 | カテゴリマッピング（MAP-001連携） | 2日 |

### Phase 2: 連携機能実装

| 優先度 | ギャップID | 対応内容 | 工数目安 |
|-------|-----------|---------|---------|
| 5 | GAP-003 | 双方向在庫同期 | 2日 |
| 6 | GAP-002 | 受注管理機能 | 3日 |
| 7 | GAP-006 | 出荷・配送追跡 | 1日 |

### Phase 3: 運用強化

| 優先度 | ギャップID | 対応内容 | 工数目安 |
|-------|-----------|---------|---------|
| 8 | GAP-008 | プラットフォーム別分析 | 1日 |
| 9 | GAP-009 | 一括出品機能 | 2日 |

---

## 4. Firestoreスキーマ変更案

### 4.1 productsコレクション（変更）

```diff
 {
   productId: "P-00001",
   managementNumber: "AA-1041",
+  platformIds: {
+    nextEngine: "NE-123456",
+    mercariShops: null,
+    base: null,
+    shopify: null
+  },
+  syncStatus: {
+    nextEngine: { synced: true, lastSyncAt: Date, error: null },
+    mercariShops: { synced: false, lastSyncAt: null, error: null }
+  },
   status: "登録済み",
+  listingStatus: {
+    mercariShops: "未出品|出品中|売却済",
+    base: "未出品|出品中|売却済"
+  },
   ...
 }
```

### 4.2 ordersコレクション（新規）

```javascript
// Firestore: orders/{orderId}
{
  orderId: "ORD-20251229-001",
  productId: "P-00001",
  managementNumber: "AA-1041",

  // 注文情報
  platform: "mercari-shops",
  platformOrderId: "MERCARI-12345678",
  orderDate: Timestamp,

  // 金額情報
  salePrice: 3980,
  platformFee: 398,
  shippingCost: 0,
  netAmount: 3582,

  // 配送情報
  shippingMethod: "らくらくメルカリ便",
  trackingNumber: "1234-5678-9012",
  shippedDate: Timestamp,
  deliveredDate: Timestamp,

  // ステータス
  status: "受注済|発送準備中|出荷済|配送完了|キャンセル",

  // メタデータ
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### 4.3 nextEngineConfigコレクション（新規）

```javascript
// Firestore: configs/{userId}/nextEngine
{
  accessToken: "encrypted_token",
  refreshToken: "encrypted_refresh_token",
  expiresAt: Timestamp,
  clientId: "xxx",
  clientSecret: "encrypted_secret",
  isConnected: true,
  lastSyncAt: Timestamp
}
```

---

## 5. システムアーキテクチャ変更

### 5.1 現在のアーキテクチャ

```
┌─────────────┐     ┌─────────────┐
│   PWA       │ ──→ │  Firestore  │
│ (フロント)   │ ←── │             │
└─────────────┘     └─────────────┘
```

### 5.2 ネクストエンジン連携後

```
┌─────────────┐     ┌─────────────┐     ┌──────────────────┐
│   PWA       │ ──→ │  Firestore  │ ──→ │ Cloud Functions  │
│ (フロント)   │ ←── │             │ ←── │                  │
└─────────────┘     └─────────────┘     └────────┬─────────┘
                                                 │
                                    ┌────────────┴────────────┐
                                    │                         │
                              ┌─────▼─────┐            ┌──────▼──────┐
                              │ネクスト    │            │ SNS API     │
                              │エンジンAPI │            │ (Instagram/ │
                              └─────┬─────┘            │  X)         │
                                    │                  └─────────────┘
                    ┌───────────────┼───────────────┐
                    │               │               │
              ┌─────▼─────┐  ┌──────▼─────┐  ┌──────▼─────┐
              │メルカリ    │  │   BASE     │  │  Shopify   │
              │Shops      │  │            │  │            │
              └───────────┘  └────────────┘  └────────────┘
```

---

## 6. 既存Issue との関連

| Issue ID | タイトル | 関連ギャップ | 優先度変更 |
|---------|---------|-------------|-----------|
| MAP-001 | カテゴリマッピング設計 | GAP-004 | 据え置き（高） |
| PLAT-001 | マルチプラットフォーム対応 | GAP-001, GAP-003 | 据え置き（高） |
| TEST-001 | 全メニュー機能検証 | - | 据え置き（最高） |

---

## 7. 次のアクション

1. **ネクストエンジン契約・APIキー取得**（ユーザー側タスク）
2. **GAP-007**: 認証情報管理の実装
3. **GAP-005**: データ変換レイヤーのプロトタイプ
4. **MAP-001との統合**: カテゴリマッピング設計確定

---

**参考情報**:
- [ネクストエンジン API](https://developer.next-engine.com/api)
- [ネクストエンジン機能一覧](https://next-engine.net/functions/)

---

**最終更新**: 2025-12-29
**作成者**: Claude Code
