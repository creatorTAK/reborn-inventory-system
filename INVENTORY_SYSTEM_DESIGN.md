# 在庫管理システム - 設計ドキュメント

**作成日**: 2025年10月20日
**設計方針**: 将来のAgent SDK連携を見据えた拡張可能な設計

---

## 🎯 設計哲学

### 今すぐ使える + 将来拡張できる

```
今（Phase 1）
  ├── 基本的な検索・編集
  ├── シンプルな可視化
  └── プッシュ通知アラート

将来（Phase 4 - Agent SDK連携）
  ├── AI自動分析
  ├── 価格調査・提案
  ├── レポート自動生成
  └── すべて同じデータ構造で動く ✨
```

---

## 📊 データ構造設計

### スプレッドシート「在庫/売上管理表」

#### 現在の列（Phase 1で使用）

| 列名 | 説明 | 例 |
|-----|------|---|
| 管理番号 | 一意の識別子 | UNI-JK-001 |
| ブランド | ブランド名 | UNIQLO |
| アイテム | 商品種類 | ダウンジャケット |
| 色 | 色 | 黒 |
| サイズ | サイズ | M |
| 仕入価格 | 仕入価格 | 2000 |
| 販売価格 | 販売価格 | 3980 |
| 販売状況 | 在庫中/販売済み/取り下げ | 在庫中 |
| 登録日 | 登録日 | 2025/10/20 |

#### 追加する列（Phase 4に備える）

| 列名 | 説明 | Phase 1 | Phase 4 |
|-----|------|---------|---------|
| **最終更新者** | 更新したユーザー | ✅ 今すぐ | ✅ Agent識別に使用 |
| **更新日時** | 最終更新日時 | ✅ 今すぐ | ✅ 履歴追跡 |
| **JSON_データ** | 構造化データ | ⏳ 空欄 | ✅ Agent SDK用 |
| **AIタグ** | AI生成タグ | ⏳ 空欄 | ✅ 検索最適化 |
| **競合価格履歴** | 価格調査結果 | ⏳ 空欄 | ✅ 価格提案 |
| **AI分析結果** | 分析データ | ⏳ 空欄 | ✅ レポート生成 |

**ポイント:**
- ✅ = Phase 1で実装・使用
- ⏳ = 列だけ作成、データは空欄
- 将来、データを追加するだけで機能拡張

---

## 🔌 API設計（GAS Web App）

### Endpoint構成

```
https://script.google.com/macros/s/.../exec
  ?action=search_inventory
  &query=UNIQLO
  &status=在庫中
```

### アクション一覧

#### Phase 1 - 今すぐ実装

| アクション | 説明 | パラメータ | 戻り値 |
|-----------|------|-----------|--------|
| `search_inventory` | 在庫検索 | query, status | 商品リスト |
| `get_product` | 商品取得 | managementNumber | 商品詳細 |
| `update_product` | 商品更新 | managementNumber, updates | 成功/失敗 |
| `get_statistics` | 統計取得 | period | 統計データ |

#### Phase 4 - 将来実装（設計だけ）

| アクション | 説明 | 使用タイミング |
|-----------|------|---------------|
| `ai_analyze` | AI分析 | Agent SDK連携 |
| `price_research` | 価格調査 | Agent SDK連携 |
| `generate_report` | レポート生成 | Agent SDK連携 |

### 実装例（inventory.js）

```javascript
/**
 * Web App エントリーポイント
 */
function doGet(e) {
  const action = e.parameter.action;

  try {
    switch(action) {
      // === Phase 1: 今すぐ実装 ===
      case 'search_inventory':
        return searchInventory(e.parameter);

      case 'get_product':
        return getProduct(e.parameter.managementNumber);

      case 'update_product':
        return updateProduct(e.parameter);

      case 'get_statistics':
        return getStatistics(e.parameter);

      // === Phase 4: 将来実装（コメント） ===
      // case 'ai_analyze':
      //   return aiAnalyzeInventory(e.parameter);

      // case 'price_research':
      //   return researchCompetitorPrice(e.parameter);

      // case 'generate_report':
      //   return generateInventoryReport(e.parameter);

      default:
        return jsonError('Invalid action', 400);
    }
  } catch (error) {
    return jsonError(error.message, 500);
  }
}

/**
 * 在庫検索（Phase 1）
 */
function searchInventory(params) {
  const sheet = getMainSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // クエリパラメータ取得
  const query = params.query || '';
  const status = params.status || '';

  // 検索ロジック
  const results = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const item = {};

    headers.forEach((header, index) => {
      item[header] = row[index];
    });

    // フィルタリング
    if (query && !itemMatchesQuery(item, query)) continue;
    if (status && item['販売状況'] !== status) continue;

    results.push(item);
  }

  return jsonResponse({ results, count: results.length });
}

/**
 * 商品取得（Phase 1）
 */
function getProduct(managementNumber) {
  const sheet = getMainSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // 管理番号で検索
  const mnCol = headers.indexOf('管理番号');
  for (let i = 1; i < data.length; i++) {
    if (data[i][mnCol] === managementNumber) {
      const item = {};
      headers.forEach((header, index) => {
        item[header] = data[i][index];
      });
      return jsonResponse({ product: item });
    }
  }

  return jsonError('Product not found', 404);
}

/**
 * 商品更新（Phase 1）
 */
function updateProduct(params) {
  const managementNumber = params.managementNumber;
  const updates = JSON.parse(params.updates);

  const sheet = getMainSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  // 管理番号で検索
  const mnCol = headers.indexOf('管理番号');
  for (let i = 1; i < data.length; i++) {
    if (data[i][mnCol] === managementNumber) {
      // 更新処理
      Object.keys(updates).forEach(key => {
        const colIndex = headers.indexOf(key);
        if (colIndex !== -1) {
          sheet.getRange(i + 1, colIndex + 1).setValue(updates[key]);
        }
      });

      // 最終更新者・更新日時を記録
      const userCol = headers.indexOf('最終更新者');
      const dateCol = headers.indexOf('更新日時');

      if (userCol !== -1) {
        sheet.getRange(i + 1, userCol + 1)
          .setValue(Session.getActiveUser().getEmail());
      }

      if (dateCol !== -1) {
        sheet.getRange(i + 1, dateCol + 1)
          .setValue(new Date());
      }

      return jsonResponse({ success: true });
    }
  }

  return jsonError('Product not found', 404);
}

// ========================================
// Phase 4: 将来実装（コメントで残す）
// ========================================

/**
 * AI分析（Phase 4 - Agent SDK連携）
 *
 * @param {Object} params - パラメータ
 * @returns {Object} 分析結果
 *
 * @future
 * Agent SDKと連携して在庫を自動分析
 * - 売れ筋商品の検出
 * - 滞留在庫の特定
 * - 価格調整の提案
 */
// function aiAnalyzeInventory(params) {
//   // Agent SDK API呼び出し
//   // const analysis = callAgentSDK('analyze', inventory);
//
//   // JSON_データ列に保存
//   // updateJSONData(managementNumber, analysis);
//
//   // return jsonResponse({ analysis });
// }

/**
 * 競合価格調査（Phase 4 - Agent SDK連携）
 *
 * @param {Object} params - ブランド、アイテム
 * @returns {Object} 価格データ
 *
 * @future
 * メルカリで競合価格を調査
 * - 類似商品の検索
 * - 価格の集計
 * - 適正価格の計算
 */
// function researchCompetitorPrice(params) {
//   // Agent SDKでメルカリ調査
//   // const priceData = callAgentSDK('research', params);
//
//   // 競合価格履歴に保存
//   // savePriceHistory(params.managementNumber, priceData);
//
//   // return jsonResponse({ priceData });
// }

// ========================================
// ユーティリティ関数
// ========================================

function jsonResponse(data, status = 200) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonError(message, status = 500) {
  return ContentService
    .createTextOutput(JSON.stringify({ error: message, status }))
    .setMimeType(ContentService.MimeType.JSON);
}

function itemMatchesQuery(item, query) {
  const searchFields = ['ブランド', 'アイテム', '管理番号', '色'];
  return searchFields.some(field =>
    String(item[field] || '').toLowerCase().includes(query.toLowerCase())
  );
}
```

---

## 🎨 UI設計

### sidebar_inventory.html

#### Phase 1 - 今すぐ実装

```html
<!-- 検索エリア -->
<div class="search-section">
  <input type="text" id="searchQuery" placeholder="ブランド、アイテム、管理番号...">

  <select id="statusFilter">
    <option value="">すべて</option>
    <option value="在庫中">在庫中</option>
    <option value="販売済み">販売済み</option>
    <option value="取り下げ">取り下げ</option>
  </select>

  <button onclick="searchInventory()">検索</button>
</div>

<!-- 結果表示エリア -->
<div id="searchResults">
  <!-- 商品カード -->
  <div class="product-card" onclick="viewProduct('UNI-JK-001')">
    <div class="product-header">
      <span class="brand">UNIQLO</span>
      <span class="price">¥3,980</span>
    </div>
    <div class="product-body">
      <p class="product-name">ウルトラライトダウンジャケット</p>
      <p class="product-details">黒 / Mサイズ</p>
    </div>
    <div class="product-footer">
      <span class="management-number">UNI-JK-001</span>
      <span class="status status-available">在庫中</span>
    </div>
  </div>
</div>

<!-- 統計サマリー -->
<div class="statistics">
  <div class="stat-item">
    <span class="stat-label">在庫点数</span>
    <span class="stat-value">127点</span>
  </div>
  <div class="stat-item">
    <span class="stat-label">在庫金額</span>
    <span class="stat-value">¥487,300</span>
  </div>
</div>
```

#### Phase 4 - 将来拡張（コメント）

```html
<!-- AI分析結果表示エリア（Phase 4で実装） -->
<!--
<div class="ai-analysis">
  <h3>AI分析結果</h3>
  <div class="analysis-card">
    <h4>売れ筋商品</h4>
    <ul id="trendingProducts"></ul>
  </div>
  <div class="analysis-card">
    <h4>値下げ推奨</h4>
    <ul id="priceDownSuggestions"></ul>
  </div>
</div>
-->
```

---

## 📱 プッシュ通知設計

### Phase 1 - 在庫アラート

```javascript
/**
 * 在庫アラート（Phase 1）
 * 毎朝9時に実行（トリガー設定）
 */
function sendInventoryAlert() {
  const longStockItems = findLongStockItems(30); // 30日以上

  if (longStockItems.length > 0) {
    const message = {
      title: '🔔 在庫アラート',
      body: `${longStockItems.length}点の長期在庫があります`,
      data: {
        type: 'inventory_alert',
        count: longStockItems.length
      }
    };

    sendPushNotification(message);
  }
}

function findLongStockItems(days) {
  const sheet = getMainSheet();
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const today = new Date();
  const threshold = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);

  const longStock = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const status = row[headers.indexOf('販売状況')];
    const registeredDate = new Date(row[headers.indexOf('登録日')]);

    if (status === '在庫中' && registeredDate < threshold) {
      longStock.push({
        managementNumber: row[headers.indexOf('管理番号')],
        brand: row[headers.indexOf('ブランド')],
        item: row[headers.indexOf('アイテム')],
        days: Math.floor((today - registeredDate) / (24 * 60 * 60 * 1000))
      });
    }
  }

  return longStock;
}
```

### Phase 4 - Agent連携通知（将来）

```javascript
/**
 * AI分析完了通知（Phase 4）
 */
// function notifyAIAnalysisComplete(analysis) {
//   const message = {
//     title: '🤖 AI分析完了',
//     body: `${analysis.suggestions.length}件の提案があります`,
//     data: {
//       type: 'ai_analysis',
//       analysisId: analysis.id
//     }
//   };
//
//   sendPushNotification(message);
// }
```

---

## 🧪 テストデータ

### Phase 1用サンプルデータ

```
管理番号,ブランド,アイテム,色,サイズ,仕入価格,販売価格,販売状況,登録日,最終更新者,更新日時
UNI-JK-001,UNIQLO,ダウンジャケット,黒,M,2000,3980,在庫中,2025/09/15,user@example.com,2025/10/20
GU-SW-001,GU,スウェット,グレー,L,800,1980,在庫中,2025/09/20,user@example.com,2025/10/20
ZARA-PT-001,ZARA,パンツ,ベージュ,M,1500,3500,販売済み,2025/09/25,user@example.com,2025/10/18
```

---

## 🚀 実装スケジュール

### Week 1

**Day 1-2: 準備**
- [ ] スプレッドシートに列追加
- [ ] inventory.js の骨格作成
- [ ] テストデータ準備

**Day 3-5: 検索機能**
- [ ] searchInventory() 実装
- [ ] getProduct() 実装
- [ ] sidebar_inventory.html UI作成
- [ ] 検索結果表示
- [ ] 動作確認

### Week 2

**Day 1-3: 編集機能**
- [ ] updateProduct() 実装
- [ ] 編集UIモーダル作成
- [ ] バリデーション実装
- [ ] 動作確認

**Day 4-5: 可視化とアラート**
- [ ] getStatistics() 実装
- [ ] ダッシュボード表示
- [ ] プッシュ通知アラート
- [ ] 動作確認

---

## 📝 チェックリスト

### Phase 1完成の条件

- [ ] 在庫を検索できる
- [ ] 検索結果を一覧表示できる
- [ ] 商品詳細を表示できる
- [ ] 商品情報を編集できる
- [ ] 統計情報を表示できる
- [ ] 長期在庫アラートが届く
- [ ] すべての機能が安定動作

### Phase 4準備の条件

- [ ] データ構造が拡張可能
- [ ] API Endpointが定義されている
- [ ] コードに将来の拡張ポイントがコメントされている
- [ ] 最終更新者・更新日時が記録されている

---

**この設計に従えば、Phase 1を完成させつつ、Phase 4への道筋も確保できます！**
