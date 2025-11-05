# 売上管理・報酬計算機能の権限要件

## 背景
INV-006 Phase 2でユーザー権限管理機能（オーナー/スタッフ/外注）を実装完了。
今後実装予定の売上管理・報酬計算機能において、権限別のアクセス制御が必要。

## セキュリティ要件

### 外注に見られてはいけない情報
- **売上データ**: 商品ごとの売上金額、利益率など
- **報酬計算**: 報酬額の計算ロジックや金額
- **財務情報**: 全体の収益、原価、利益などの集計データ

### 権限別アクセスレベル（想定）

#### 🔴 オーナー（安廣拓志）
- ✅ 全データ閲覧・編集
- ✅ 売上管理: 全期間、全商品
- ✅ 報酬計算: 全ユーザーの報酬閲覧・計算
- ✅ 財務レポート: 全レポート閲覧
- ✅ 設定変更: 報酬計算式、手数料率など

#### 🟡 スタッフ（山田太郎など）
- ✅ 自分が担当した商品の売上閲覧
- ⚠️ 自分の報酬のみ閲覧可能
- ❌ 他のスタッフの報酬は非表示
- ❌ 全体の利益率・財務情報は非表示

#### 🟢 外注
- ✅ 自分が作業した商品の在庫状況のみ閲覧
- ❌ 売上データは完全に非表示
- ❌ 報酬情報は完全に非表示
- ❌ 財務情報は完全に非表示

---

## 実装が必要な機能

### 1. 売上管理画面
- **表示制御**:
  - オーナー: 全売上データ
  - スタッフ: 自分が登録した商品の売上のみ
  - 外注: アクセス不可（メニュー非表示 or 権限エラー）

- **データフィルタリング**:
  ```javascript
  function getSalesData() {
    const userPermission = getUserPermission(currentUser);
    
    if (userPermission === 'オーナー') {
      return getAllSalesData(); // 全データ
    } else if (userPermission === 'スタッフ') {
      return getSalesDataByUser(currentUser); // 自分のデータのみ
    } else {
      return []; // 外注はアクセス不可
    }
  }
  ```

### 2. 報酬計算機能
- **計算ロジック**:
  - 商品登録数、販売数、売上金額などに基づく報酬計算
  - 計算式はオーナーのみ設定可能
  
- **表示制御**:
  - オーナー: 全ユーザーの報酬閲覧・編集
  - スタッフ: 自分の報酬のみ閲覧
  - 外注: 自分の報酬のみ閲覧（もし報酬制度があれば）

- **レポート出力**:
  - オーナー: 全ユーザー分の報酬レポート
  - スタッフ/外注: 自分の報酬レポートのみ

### 3. 財務レポート
- **オーナー専用機能**:
  - 期間別売上・利益レポート
  - 商品カテゴリ別分析
  - 利益率分析
  - ROI計算

- **アクセス制御**:
  ```javascript
  function showFinancialReport() {
    if (!isOwner()) {
      ui.alert('権限エラー', '財務レポートはオーナーのみがアクセスできます。');
      return;
    }
    // レポート表示
  }
  ```

### 4. メニュー表示制御
```javascript
// menu.js - onOpen()
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const userPermission = getUserPermission(getCurrentUserName());
  
  // 売上管理メニュー（外注には非表示）
  if (userPermission !== '外注') {
    ui.createMenu('💰 売上管理')
      .addItem('📊 売上一覧', 'showSalesReport')
      .addItem('💵 報酬計算', 'showRewardCalculation')
      .addToUi();
  }
  
  // 財務レポート（オーナーのみ）
  if (userPermission === 'オーナー') {
    ui.createMenu('📈 財務レポート')
      .addItem('📊 期間別売上', 'showPeriodSalesReport')
      .addItem('💹 利益率分析', 'showProfitAnalysis')
      .addToUi();
  }
}
```

---

## データベース設計（想定）

### 売上管理シート
```
| 販売ID | 商品ID | 商品名 | 販売日 | 売上金額 | 原価 | 利益 | 登録者 | 担当者 |
|--------|--------|--------|--------|----------|------|------|--------|--------|
```

**アクセス制御フィールド**: `登録者` or `担当者` でフィルタリング

### 報酬計算シート
```
| ユーザー名 | 期間 | 登録数 | 販売数 | 売上合計 | 報酬額 | 計算日 |
|------------|------|--------|--------|----------|--------|--------|
```

**アクセス制御フィールド**: `ユーザー名` でフィルタリング

---

## セキュリティ実装パターン（再利用可能）

### パターン1: メニュー非表示
```javascript
// 権限に応じてメニュー項目を動的に表示/非表示
if (userPermission === 'オーナー') {
  menu.addItem('💰 売上管理', 'showSales');
}
```

### パターン2: 画面アクセス制御
```javascript
function showSalesReport() {
  const permission = getUserPermission(getCurrentUserName());
  if (permission === '外注') {
    ui.alert('権限エラー', 'この機能にアクセスする権限がありません。');
    return;
  }
  // 画面表示
}
```

### パターン3: データフィルタリング
```javascript
function getSalesData() {
  const allData = sheet.getDataRange().getValues();
  const permission = getUserPermission(getCurrentUserName());
  
  if (permission === 'オーナー') {
    return allData; // 全データ
  } else if (permission === 'スタッフ') {
    return allData.filter(row => row[担当者列] === getCurrentUserName());
  } else {
    return []; // 外注はアクセス不可
  }
}
```

### パターン4: カラム単位のマスキング
```javascript
function renderSalesTable() {
  const permission = getUserPermission(getCurrentUserName());
  const showProfit = (permission === 'オーナー'); // 利益列はオーナーのみ
  
  html += '<th>売上金額</th>';
  if (showProfit) {
    html += '<th>原価</th><th>利益</th>'; // オーナーのみ表示
  }
}
```

---

## 実装優先順位

### Phase 1: 売上管理基本機能
- [ ] 売上データ記録機能
- [ ] 売上一覧表示（権限別フィルタリング）
- [ ] 期間別集計レポート（オーナーのみ）

### Phase 2: 報酬計算機能
- [ ] 報酬計算ロジック実装
- [ ] 報酬レポート表示（権限別）
- [ ] 報酬計算式設定画面（オーナーのみ）

### Phase 3: 財務レポート
- [ ] 利益率分析
- [ ] カテゴリ別分析
- [ ] ROI計算

---

## 技術的考慮事項

### パフォーマンス
- 大量データの場合、フィルタリングをサーバー側で実施
- クライアント側では必要なデータのみ受信

### セキュリティ
- クライアント側でのデータマスキングだけでなく、**サーバー側で必ずデータフィルタリング**
- APIレベルでの権限チェック必須（クライアント側のチェックは補助的）

### 監査
- 売上データ・報酬データへのアクセスログを記録
- 誰が、いつ、どのデータにアクセスしたかを追跡

---

## 関連Issue（今後作成予定）

- [ ] INV-007: 売上管理機能実装（Phase 1）
- [ ] INV-008: 報酬計算機能実装（Phase 2）
- [ ] INV-009: 財務レポート機能実装（Phase 3）

---

**記録日: 2025-11-04**
**記録者: Claude Code (based on user requirements)**
