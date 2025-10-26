# 販売記録機能 設計ドキュメント

**作成日**: 2025-10-27
**ステータス**: 設計中
**対象Issue**: INV-004（予定）

---

## 📋 目的

メルカリ等で商品が販売された際の記録を効率的に行い、利益計算を自動化する。

**背景:**
- 現在は販売後の記録が手動で煩雑
- 利益計算が複雑（仕入、手数料、送料、梱包資材費）
- 発送方法と梱包資材の組み合わせが多様
- 備品在庫の管理が必要

---

## 🎯 Phase 1 スコープ（メルカリ手動運用完成）

### 必須機能
1. **販売情報の記録**
   - 販売日
   - 販売金額
   - プラットフォーム（デフォルト: メルカリ）

2. **発送方法の選択**
   - 連動式プルダウン（発送方法1 → 発送方法2）
   - 送料の自動計算
   - データソース: 発送方法マスタシート

3. **梱包資材の選択**
   - 複数選択（デフォルト3個、追加可能）
   - 各資材の単価自動取得
   - 梱包資材費の自動計算
   - データソース: 備品在庫リストシート

4. **利益の自動計算**
   ```
   最終利益 = 販売金額
            - 仕入金額
            - プラットフォーム手数料
            - 決済手数料
            - 送料
            - 梱包資材費（合計）
   ```

5. **備品在庫の自動更新**
   - 出庫数合計の増加
   - 在庫数の減少

6. **ステータス更新**
   - 商品ステータスを「販売済み」に変更
   - 販売日時の記録

### Phase 2以降
- 入出庫履歴の記録
- 在庫アラート機能
- 複数プラットフォーム対応（販売記録の拡張）

---

## 🏗️ データ構造

### 在庫/売上管理表シート（既存）

**販売記録関連の列:**
```
列: 販売日
列: 販売先（メルカリ、メルカリShops等）
列: 販売金額
列: 発送方法1（らくらくメルカリ便、等）
列: 発送方法2（ネコポス、宅急便60、等）
列: 送料
列: 梱包資材1
列: 梱包資材2
列: 梱包資材3
列: 梱包資材費合計
列: プラットフォーム手数料
列: 決済手数料
列: 最終利益
列: ステータス
```

### 発送方法マスタシート（既存）

**構造:**
```
列A: 発送方法1（カテゴリ）
列B: 発送方法2（詳細・サイズ）
列C: 送料

例:
| 発送方法1          | 発送方法2                    | 送料  |
|-------------------|----------------------------|------|
| らくらくメルカリ便  | ネコポス                     | 210  |
| らくらくメルカリ便  | 宅急便コンパクト              | 450  |
| らくらくメルカリ便  | 宅急便60                     | 750  |
| ゆうゆうメルカリ便  | ゆうパケット                  | 230  |
| ゆうゆうメルカリ便  | ゆうパケットプラス            | 455  |
| レターパック       | レターパックライト            | 370  |
| レターパック       | レターパックプラス            | 520  |
| 普通郵便(定形外郵便)| 50g以内                      | 120  |
| 未定              | 未定                         | 0    |
```

### 備品在庫リストシート（既存）

**構造:**
```
列A: 商品画像
列B: 商品名
列C: 発注先
列D: 商品リンク
列E: 個数
列F: 価格
列G: 略称（プルダウン用）
列H: 1個あたり（自動計算: 価格 ÷ 個数）
列I: 入庫数合計
列J: 出庫数合計
列K: 在庫数（自動計算: 入庫数合計 - 出庫数合計）

例:
| 商品名                      | 略称                  | 1個あたり | 入庫数合計 | 出庫数合計 | 在庫数 |
|----------------------------|----------------------|----------|----------|----------|-------|
| A4 ジッパー式ポリ袋          | A4ジッパー袋          | ¥9.39    | 100      | 20       | 80    |
| B4 テープ付OPP袋            | B4 OPP袋             | ¥6.60    | 200      | 50       | 150   |
| サンキューカード(メンズ)      | サンキューカード(M)   | ¥4.26    | 500      | 100      | 400   |
| ゆうパケットポストmini       | ゆうパケポmini        | ¥60.00   | 50       | 10       | 40    |
| レターパックプラス           | レタパ+              | ¥600.00  | 20       | 5        | 15    |
| なし                       | なし                 | ¥0.00    | 9999     | 0        | 9999  |
```

---

## 🖼️ UI設計

### 販売記録モーダル

**モーダルタイトル:** 「販売記録」

**セクション構成:**

#### 1. 基本情報
```
[販売日]
  └─ 日付ピッカー（デフォルト: 今日）

[販売先]
  └─ プルダウン（メルカリ、メルカリShops、ラクマ、等）
     デフォルト: メルカリ

[販売金額] ※必須
  └─ 数値入力（¥マーク付き）
```

#### 2. 発送情報
```
[発送方法（カテゴリ）] ※必須
  └─ プルダウン（らくらくメルカリ便、ゆうゆうメルカリ便、等）
     データソース: 発送方法マスタ 列A（ユニーク値）

[発送方法（詳細）] ※必須
  └─ プルダウン（連動：発送方法1に応じて選択肢が変わる）
     データソース: 発送方法マスタ 列B（発送方法1でフィルタ）

[送料]
  └─ 自動表示（発送方法2選択時に自動計算）
     ¥XXX（編集不可、またはグレーアウト）
```

#### 3. 梱包資材
```
[梱包資材]
  ┌─────────────────────────────────┐
  │ 梱包資材1: [プルダウン ▼]  単価: ¥XX.XX │
  │ 梱包資材2: [プルダウン ▼]  単価: ¥XX.XX │
  │ 梱包資材3: [プルダウン ▼]  単価: ¥XX.XX │
  │ [+ 梱包資材を追加]                      │
  └─────────────────────────────────┘
  
  梱包資材費合計: ¥XXX.XX（自動計算）
  
  データソース: 備品在庫リスト 列G（略称）
  単価: 備品在庫リスト 列H（1個あたり）
  
  ※「なし」を選択可能（¥0.00）
```

#### 4. 手数料・利益
```
[プラットフォーム手数料]
  └─ 自動計算（販売金額 × 手数料率）
     例: メルカリ = 10%
     ¥XXX（自動表示）

[決済手数料]
  └─ 自動計算（メルカリの場合は0円、他プラットフォームは要確認）
     ¥XXX（自動表示）

[最終利益]
  ┌─────────────────────────────────┐
  │ 販売金額:        ¥5,000         │
  │ 仕入金額:      - ¥1,000         │
  │ プラット手数料: - ¥500          │
  │ 決済手数料:     - ¥0            │
  │ 送料:          - ¥210           │
  │ 梱包資材費:     - ¥20           │
  │ ─────────────────────────────── │
  │ 最終利益:       ¥3,270          │
  └─────────────────────────────────┘
```

#### 5. アクション
```
[キャンセル]  [販売記録を保存]
```

---

## 🔧 実装設計

### フロントエンド（sidebar_inventory.html）

#### 販売記録モーダルHTML
```html
<!-- 販売記録モーダル -->
<div class="modal fade" id="salesRecordModal" tabindex="-1">
  <div class="modal-dialog modal-lg">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title">販売記録</h5>
        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
      </div>
      <div class="modal-body">
        <!-- 基本情報 -->
        <div class="mb-4">
          <h6 class="border-bottom pb-2">基本情報</h6>
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">販売日 <span class="text-danger">*</span></label>
              <input type="date" class="form-control" id="salesDate" required>
            </div>
            <div class="col-md-6">
              <label class="form-label">販売先 <span class="text-danger">*</span></label>
              <select class="form-select" id="salesPlatform" required>
                <option value="メルカリ" selected>メルカリ</option>
                <option value="メルカリShops">メルカリShops</option>
                <option value="ラクマ">ラクマ</option>
                <option value="Yahoo!フリマ">Yahoo!フリマ</option>
                <option value="BASE">BASE</option>
                <option value="その他">その他</option>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label">販売金額 <span class="text-danger">*</span></label>
              <div class="input-group">
                <span class="input-group-text">¥</span>
                <input type="number" class="form-control" id="salesAmount" min="0" required>
              </div>
            </div>
          </div>
        </div>

        <!-- 発送情報 -->
        <div class="mb-4">
          <h6 class="border-bottom pb-2">発送情報</h6>
          <div class="row g-3">
            <div class="col-md-6">
              <label class="form-label">発送方法（カテゴリ） <span class="text-danger">*</span></label>
              <select class="form-select" id="shippingMethod1" required>
                <option value="">選択してください</option>
              </select>
            </div>
            <div class="col-md-6">
              <label class="form-label">発送方法（詳細） <span class="text-danger">*</span></label>
              <select class="form-select" id="shippingMethod2" required disabled>
                <option value="">まず発送方法を選択してください</option>
              </select>
            </div>
            <div class="col-12">
              <label class="form-label">送料</label>
              <div class="input-group">
                <span class="input-group-text">¥</span>
                <input type="text" class="form-control bg-light" id="shippingFee" readonly>
              </div>
            </div>
          </div>
        </div>

        <!-- 梱包資材 -->
        <div class="mb-4">
          <h6 class="border-bottom pb-2">梱包資材</h6>
          <div id="packagingMaterialsContainer">
            <!-- 動的に追加される梱包資材選択欄 -->
          </div>
          <button type="button" class="btn btn-sm btn-outline-secondary mt-2" id="addPackagingMaterial">
            <i class="bi bi-plus-circle"></i> 梱包資材を追加
          </button>
          <div class="mt-3">
            <strong>梱包資材費合計: </strong>
            <span id="totalPackagingCost">¥0.00</span>
          </div>
        </div>

        <!-- 手数料・利益 -->
        <div class="mb-4">
          <h6 class="border-bottom pb-2">利益計算</h6>
          <table class="table table-sm">
            <tbody>
              <tr>
                <td>販売金額</td>
                <td class="text-end" id="profitSalesAmount">¥0</td>
              </tr>
              <tr>
                <td>仕入金額</td>
                <td class="text-end text-danger" id="profitPurchaseCost">- ¥0</td>
              </tr>
              <tr>
                <td>プラットフォーム手数料 (<span id="platformFeeRate">10</span>%)</td>
                <td class="text-end text-danger" id="profitPlatformFee">- ¥0</td>
              </tr>
              <tr>
                <td>決済手数料</td>
                <td class="text-end text-danger" id="profitPaymentFee">- ¥0</td>
              </tr>
              <tr>
                <td>送料</td>
                <td class="text-end text-danger" id="profitShippingFee">- ¥0</td>
              </tr>
              <tr>
                <td>梱包資材費</td>
                <td class="text-end text-danger" id="profitPackagingCost">- ¥0</td>
              </tr>
              <tr class="table-primary fw-bold">
                <td>最終利益</td>
                <td class="text-end" id="finalProfit">¥0</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">キャンセル</button>
        <button type="button" class="btn btn-primary" id="saveSalesRecord">販売記録を保存</button>
      </div>
    </div>
  </div>
</div>
```

#### JavaScript処理

**グローバル変数:**
```javascript
let shippingMethodMaster = []; // 発送方法マスタデータ
let packagingMaterialsMaster = []; // 備品在庫リストデータ
let currentProductData = null; // 販売記録対象の商品データ
let packagingMaterialCount = 3; // 梱包資材選択欄の数（初期値3）
```

**モーダル初期化:**
```javascript
function initSalesRecordModal(productData) {
  currentProductData = productData;
  packagingMaterialCount = 3;
  
  // 販売日を今日に設定
  document.getElementById('salesDate').valueAsDate = new Date();
  
  // 発送方法マスタを読み込み
  loadShippingMethodMaster();
  
  // 備品在庫リストを読み込み
  loadPackagingMaterialsMaster();
  
  // 梱包資材選択欄を初期化（3個）
  renderPackagingMaterials();
  
  // イベントリスナー設定
  setupSalesRecordEventListeners();
  
  // モーダル表示
  new bootstrap.Modal(document.getElementById('salesRecordModal')).show();
}
```

**発送方法マスタ読み込み:**
```javascript
function loadShippingMethodMaster() {
  google.script.run
    .withSuccessHandler(function(result) {
      if (result && result.success) {
        shippingMethodMaster = result.data;
        populateShippingMethod1();
      }
    })
    .withFailureHandler(function(error) {
      showError('発送方法マスタの読み込みに失敗しました: ' + error);
    })
    .getShippingMethodMasterAPI();
}

function populateShippingMethod1() {
  const select = document.getElementById('shippingMethod1');
  const categories = [...new Set(shippingMethodMaster.map(item => item.method1))];
  
  select.innerHTML = '<option value="">選択してください</option>';
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
}
```

**連動式プルダウン:**
```javascript
function onShippingMethod1Change() {
  const method1 = document.getElementById('shippingMethod1').value;
  const select2 = document.getElementById('shippingMethod2');
  
  if (!method1) {
    select2.disabled = true;
    select2.innerHTML = '<option value="">まず発送方法を選択してください</option>';
    document.getElementById('shippingFee').value = '';
    return;
  }
  
  // method1に対応するmethod2の選択肢を取得
  const options = shippingMethodMaster.filter(item => item.method1 === method1);
  
  select2.disabled = false;
  select2.innerHTML = '<option value="">選択してください</option>';
  options.forEach(item => {
    const option = document.createElement('option');
    option.value = item.method2;
    option.dataset.fee = item.fee;
    option.textContent = `${item.method2} (¥${item.fee})`;
    select2.appendChild(option);
  });
}

function onShippingMethod2Change() {
  const select2 = document.getElementById('shippingMethod2');
  const selectedOption = select2.options[select2.selectedIndex];
  
  if (selectedOption && selectedOption.dataset.fee) {
    document.getElementById('shippingFee').value = selectedOption.dataset.fee;
    updateProfitCalculation();
  }
}
```

**梱包資材選択欄の動的生成:**
```javascript
function renderPackagingMaterials() {
  const container = document.getElementById('packagingMaterialsContainer');
  container.innerHTML = '';
  
  for (let i = 1; i <= packagingMaterialCount; i++) {
    const div = document.createElement('div');
    div.className = 'row g-2 mb-2 align-items-center';
    div.innerHTML = `
      <div class="col-md-8">
        <label class="form-label">梱包資材${i}</label>
        <select class="form-select packaging-material-select" id="packagingMaterial${i}">
          <option value="">選択してください</option>
        </select>
      </div>
      <div class="col-md-4">
        <label class="form-label">単価</label>
        <input type="text" class="form-control bg-light" id="packagingCost${i}" readonly>
      </div>
    `;
    container.appendChild(div);
    
    // 備品在庫リストからプルダウンを生成
    populatePackagingMaterialSelect(i);
  }
}

function populatePackagingMaterialSelect(index) {
  const select = document.getElementById(`packagingMaterial${index}`);
  
  packagingMaterialsMaster.forEach(item => {
    const option = document.createElement('option');
    option.value = item.abbreviation;
    option.dataset.cost = item.unitCost;
    option.textContent = `${item.abbreviation} (¥${item.unitCost})`;
    select.appendChild(option);
  });
  
  // 変更イベントリスナー
  select.addEventListener('change', function() {
    const selectedOption = this.options[this.selectedIndex];
    const costInput = document.getElementById(`packagingCost${index}`);
    
    if (selectedOption && selectedOption.dataset.cost) {
      costInput.value = `¥${selectedOption.dataset.cost}`;
    } else {
      costInput.value = '';
    }
    
    updatePackagingCostTotal();
    updateProfitCalculation();
  });
}

function updatePackagingCostTotal() {
  let total = 0;
  for (let i = 1; i <= packagingMaterialCount; i++) {
    const select = document.getElementById(`packagingMaterial${i}`);
    const selectedOption = select.options[select.selectedIndex];
    if (selectedOption && selectedOption.dataset.cost) {
      total += parseFloat(selectedOption.dataset.cost);
    }
  }
  
  document.getElementById('totalPackagingCost').textContent = `¥${total.toFixed(2)}`;
  return total;
}
```

**利益計算の更新:**
```javascript
function updateProfitCalculation() {
  // 販売金額
  const salesAmount = parseFloat(document.getElementById('salesAmount').value) || 0;
  document.getElementById('profitSalesAmount').textContent = `¥${salesAmount.toLocaleString()}`;
  
  // 仕入金額（商品データから取得）
  const purchaseCost = currentProductData.purchaseCost || 0;
  document.getElementById('profitPurchaseCost').textContent = `- ¥${purchaseCost.toLocaleString()}`;
  
  // プラットフォーム手数料（メルカリ = 10%）
  const platformFeeRate = getPlatformFeeRate(document.getElementById('salesPlatform').value);
  document.getElementById('platformFeeRate').textContent = platformFeeRate;
  const platformFee = Math.floor(salesAmount * (platformFeeRate / 100));
  document.getElementById('profitPlatformFee').textContent = `- ¥${platformFee.toLocaleString()}`;
  
  // 決済手数料（メルカリの場合は0円）
  const paymentFee = 0; // 今後プラットフォームごとに変更
  document.getElementById('profitPaymentFee').textContent = `- ¥${paymentFee.toLocaleString()}`;
  
  // 送料
  const shippingFee = parseFloat(document.getElementById('shippingFee').value) || 0;
  document.getElementById('profitShippingFee').textContent = `- ¥${shippingFee.toLocaleString()}`;
  
  // 梱包資材費
  const packagingCost = updatePackagingCostTotal();
  document.getElementById('profitPackagingCost').textContent = `- ¥${packagingCost.toFixed(2)}`;
  
  // 最終利益
  const finalProfit = salesAmount - purchaseCost - platformFee - paymentFee - shippingFee - packagingCost;
  document.getElementById('finalProfit').textContent = `¥${finalProfit.toLocaleString()}`;
  document.getElementById('finalProfit').className = finalProfit >= 0 ? 'text-end text-success' : 'text-end text-danger';
}

function getPlatformFeeRate(platform) {
  const feeRates = {
    'メルカリ': 10,
    'メルカリShops': 5,
    'ラクマ': 6,
    'Yahoo!フリマ': 5,
    'BASE': 3,
    'Shopify': 0,
    'その他': 0
  };
  return feeRates[platform] || 0;
}
```

**保存処理:**
```javascript
function saveSalesRecord() {
  // バリデーション
  if (!validateSalesRecord()) {
    return;
  }
  
  // データ収集
  const salesData = {
    managementNumber: currentProductData.managementNumber,
    salesDate: document.getElementById('salesDate').value,
    salesPlatform: document.getElementById('salesPlatform').value,
    salesAmount: parseFloat(document.getElementById('salesAmount').value),
    shippingMethod1: document.getElementById('shippingMethod1').value,
    shippingMethod2: document.getElementById('shippingMethod2').value,
    shippingFee: parseFloat(document.getElementById('shippingFee').value),
    packagingMaterials: [],
    packagingCostTotal: updatePackagingCostTotal(),
    platformFee: parseFloat(document.getElementById('profitPlatformFee').textContent.replace(/[^0-9]/g, '')),
    paymentFee: parseFloat(document.getElementById('profitPaymentFee').textContent.replace(/[^0-9]/g, '')),
    finalProfit: parseFloat(document.getElementById('finalProfit').textContent.replace(/[^0-9-]/g, ''))
  };
  
  // 梱包資材データ収集
  for (let i = 1; i <= packagingMaterialCount; i++) {
    const select = document.getElementById(`packagingMaterial${i}`);
    if (select.value) {
      const selectedOption = select.options[select.selectedIndex];
      salesData.packagingMaterials.push({
        abbreviation: select.value,
        unitCost: parseFloat(selectedOption.dataset.cost)
      });
    }
  }
  
  showLoading();
  
  google.script.run
    .withSuccessHandler(function(result) {
      hideLoading();
      if (result && result.success) {
        showSuccess('販売記録を保存しました');
        bootstrap.Modal.getInstance(document.getElementById('salesRecordModal')).hide();
        loadDashboardAndSearch(); // 再読み込み
      } else {
        showError('保存に失敗しました: ' + (result.message || 'Unknown error'));
      }
    })
    .withFailureHandler(function(error) {
      hideLoading();
      showError('保存エラー: ' + error);
    })
    .saveSalesRecordAPI(salesData);
}
```

### バックエンド（inventory.js）

#### 発送方法マスタ取得API
```javascript
function getShippingMethodMasterAPI() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '発送方法マスタ';
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, message: `シート「${sheetName}」が見つかりません` };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const master = [];
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[0]) continue; // 空行スキップ
      
      master.push({
        method1: row[0], // 発送方法1
        method2: row[1], // 発送方法2
        fee: row[2]      // 送料
      });
    }
    
    return { success: true, data: master };
  } catch (error) {
    console.error('❌ [ERROR] getShippingMethodMasterAPI:', error);
    return { success: false, message: error.toString() };
  }
}
```

#### 備品在庫リスト取得API
```javascript
function getPackagingMaterialsMasterAPI() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '備品在庫リスト';
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, message: `シート「${sheetName}」が見つかりません` };
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const master = [];
    
    // 列インデックスを取得
    const colMap = {};
    headers.forEach((header, index) => {
      colMap[header] = index;
    });
    
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[colMap['略称']]) continue; // 空行スキップ
      
      master.push({
        productName: row[colMap['商品名']],
        abbreviation: row[colMap['略称']],
        unitCost: row[colMap['1個あたり']] || 0,
        inStock: row[colMap['入庫数合計']] || 0,
        outStock: row[colMap['出庫数合計']] || 0,
        inventory: row[colMap['在庫数']] || 0
      });
    }
    
    return { success: true, data: master };
  } catch (error) {
    console.error('❌ [ERROR] getPackagingMaterialsMasterAPI:', error);
    return { success: false, message: error.toString() };
  }
}
```

#### 販売記録保存API
```javascript
function saveSalesRecordAPI(salesData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '在庫/売上管理表';
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, message: `シート「${sheetName}」が見つかりません` };
    }
    
    // ヘッダー取得
    const { map, lastCol } = getHeaderMapCommon();
    
    // 管理番号で行を検索
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    let targetRow = -1;
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][map['管理番号'] - 1] === salesData.managementNumber) {
        targetRow = i + 1; // スプレッドシートの行番号（1-indexed）
        break;
      }
    }
    
    if (targetRow === -1) {
      return { success: false, message: '商品が見つかりません' };
    }
    
    // 販売情報を書き込み
    sheet.getRange(targetRow, map['販売日']).setValue(salesData.salesDate);
    sheet.getRange(targetRow, map['販売先']).setValue(salesData.salesPlatform);
    sheet.getRange(targetRow, map['販売金額']).setValue(salesData.salesAmount);
    sheet.getRange(targetRow, map['発送方法1']).setValue(salesData.shippingMethod1);
    sheet.getRange(targetRow, map['発送方法2']).setValue(salesData.shippingMethod2);
    sheet.getRange(targetRow, map['送料']).setValue(salesData.shippingFee);
    
    // 梱包資材を書き込み（最大3個想定、それ以上は列を追加する必要がある）
    for (let i = 0; i < salesData.packagingMaterials.length && i < 3; i++) {
      const colName = `梱包資材${i + 1}`;
      if (map[colName]) {
        sheet.getRange(targetRow, map[colName]).setValue(salesData.packagingMaterials[i].abbreviation);
      }
    }
    
    sheet.getRange(targetRow, map['梱包資材費合計']).setValue(salesData.packagingCostTotal);
    sheet.getRange(targetRow, map['プラットフォーム手数料']).setValue(salesData.platformFee);
    sheet.getRange(targetRow, map['決済手数料']).setValue(salesData.paymentFee);
    sheet.getRange(targetRow, map['最終利益']).setValue(salesData.finalProfit);
    sheet.getRange(targetRow, map['ステータス']).setValue('販売済み');
    
    // 備品在庫リストの出庫処理
    updatePackagingInventory(salesData.packagingMaterials);
    
    return { success: true, message: '販売記録を保存しました' };
  } catch (error) {
    console.error('❌ [ERROR] saveSalesRecordAPI:', error);
    return { success: false, message: error.toString() };
  }
}
```

#### 備品在庫更新処理
```javascript
function updatePackagingInventory(packagingMaterials) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '備品在庫リスト';
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      throw new Error(`シート「${sheetName}」が見つかりません`);
    }
    
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    
    // 列インデックスを取得
    const colMap = {};
    headers.forEach((header, index) => {
      colMap[header] = index;
    });
    
    // 各梱包資材の出庫数を更新
    packagingMaterials.forEach(material => {
      for (let i = 1; i < data.length; i++) {
        if (data[i][colMap['略称']] === material.abbreviation) {
          const targetRow = i + 1;
          const currentOutStock = data[i][colMap['出庫数合計']] || 0;
          
          // 出庫数を1増加
          sheet.getRange(targetRow, colMap['出庫数合計'] + 1).setValue(currentOutStock + 1);
          
          // 在庫数は自動計算式で更新されると想定
          // もし手動更新が必要な場合:
          // const currentInventory = data[i][colMap['在庫数']] || 0;
          // sheet.getRange(targetRow, colMap['在庫数'] + 1).setValue(currentInventory - 1);
          
          break;
        }
      }
    });
    
    console.log('✅ 備品在庫リスト更新完了');
  } catch (error) {
    console.error('❌ [ERROR] updatePackagingInventory:', error);
    throw error;
  }
}
```

---

## 🔌 在庫管理画面への統合

### 商品カードに「販売記録」ボタン追加

**既存の商品カードHTML（sidebar_inventory.html）を修正:**

```html
<div class="product-card" data-management-number="${product.managementNumber}">
  <!-- 既存の内容 -->
  
  <!-- アクションボタンエリア -->
  <div class="card-footer bg-white border-0 pt-0">
    <div class="d-flex gap-2">
      <button class="btn btn-sm btn-outline-primary flex-fill" onclick="viewProductDetail('${product.managementNumber}')">
        詳細
      </button>
      <button class="btn btn-sm btn-outline-success flex-fill" onclick="openSalesRecordModal('${product.managementNumber}')">
        販売記録
      </button>
      <button class="btn btn-sm btn-outline-secondary" onclick="copyProductInfo('${product.managementNumber}')">
        コピー
      </button>
    </div>
  </div>
</div>
```

**JavaScript:**
```javascript
function openSalesRecordModal(managementNumber) {
  // 商品データを取得
  google.script.run
    .withSuccessHandler(function(result) {
      if (result && result.success && result.data) {
        initSalesRecordModal(result.data);
      } else {
        showError('商品データの取得に失敗しました');
      }
    })
    .withFailureHandler(function(error) {
      showError('エラー: ' + error);
    })
    .getProductByManagementNumberAPI(managementNumber);
}
```

---

## 📝 テスト計画

### テストケース

#### TC-SALES-001: 発送方法の連動プルダウン
**手順:**
1. 販売記録モーダルを開く
2. 発送方法1で「らくらくメルカリ便」を選択
3. 発送方法2のプルダウンが有効化され、選択肢が表示されることを確認
4. 発送方法2で「ネコポス」を選択
5. 送料に「210」が自動入力されることを確認

**期待結果:**
- 発送方法2の選択肢が発送方法1に応じて変わる
- 送料が自動計算される

#### TC-SALES-002: 梱包資材の複数選択
**手順:**
1. 販売記録モーダルを開く
2. 梱包資材1で「A4ジッパー袋」を選択
3. 梱包資材2で「サンキューカード(M)」を選択
4. 梱包資材3で「なし」を選択
5. 梱包資材費合計が正しく計算されることを確認
6. 「+ 梱包資材を追加」をクリック
7. 梱包資材4の選択欄が追加されることを確認

**期待結果:**
- 梱包資材費合計 = ¥9.39 + ¥4.26 = ¥13.65
- 動的に選択欄を追加できる

#### TC-SALES-003: 利益計算
**手順:**
1. 販売記録モーダルを開く（仕入金額 ¥1,000の商品）
2. 販売金額に「5000」を入力
3. 販売先「メルカリ」（手数料10%）
4. 発送方法で送料 ¥210 を選択
5. 梱包資材費合計 ¥13.65
6. 最終利益が正しく計算されることを確認

**期待結果:**
```
販売金額:        ¥5,000
仕入金額:      - ¥1,000
プラット手数料: - ¥500（5000 × 10%）
決済手数料:     - ¥0
送料:          - ¥210
梱包資材費:     - ¥13.65
───────────────────────
最終利益:       ¥3,276.35
```

#### TC-SALES-004: 保存処理
**手順:**
1. 全項目を入力して「販売記録を保存」をクリック
2. スプレッドシートの該当行が更新されることを確認
3. ステータスが「販売済み」になることを確認
4. 備品在庫リストの出庫数が増加することを確認

**期待結果:**
- 在庫/売上管理表シートに全データが保存される
- 備品在庫リストの出庫数合計が+1される

#### TC-SALES-005: バリデーション
**手順:**
1. 販売記録モーダルを開く
2. 販売金額を入力せずに「販売記録を保存」をクリック
3. エラーメッセージが表示されることを確認

**期待結果:**
- 必須項目が未入力の場合、エラーメッセージが表示される
- 保存処理が実行されない

---

## ⚠️ 技術的課題と検討事項

### 1. 梱包資材の動的追加
**課題:** スプレッドシートの列数は固定（梱包資材1〜3）だが、UIでは3個以上選択可能にする

**解決策:**
- Phase 1: デフォルト3個、4個目以降は追加可能だがスプレッドシートには保存されない（警告表示）
- Phase 2: スプレッドシートの列を動的に追加、または別シートに梱包資材詳細を保存

### 2. 備品在庫リストの在庫数更新
**課題:** 在庫数が自動計算式の場合、出庫数更新だけで良いか？

**確認事項:**
- 在庫数列に計算式が入っているか？
- 手動更新が必要か？

### 3. プラットフォーム別手数料率
**課題:** プラットフォームごとに手数料率が異なる

**解決策:**
- フロントエンドに手数料率マスタをハードコード（Phase 1）
- Phase 2: スプレッドシートにプラットフォームマスタシート作成

### 4. 入出庫履歴
**課題:** 備品の入出庫履歴を記録するか？

**Phase 1:** 出庫数合計のみ更新（履歴なし）
**Phase 2:** 入出庫履歴シート作成

---

## 📝 次のアクション

1. **ユーザー確認**
   - この設計案の承認
   - Phase 1スコープの最終確認
   - スプレッドシートの列名確認

2. **Issue起票**
   - INV-004: 販売記録機能実装

3. **実装開始**
   - バックエンドAPI実装
   - フロントエンドUI実装
   - テスト

4. **Phase 2準備**
   - 入出庫履歴設計
   - 在庫アラート設計

---

**最終更新**: 2025-10-27
**次回レビュー**: ユーザー確認後
