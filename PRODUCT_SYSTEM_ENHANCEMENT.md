# 商品登録システム - Agent SDK対応強化計画

**作成日**: 2025年10月20日
**目的**: 将来のAgent SDK連携を見据えた商品登録システムの強化

---

## 🎯 現状分析

### ✅ 既に実装済み
- 商品登録機能（100%完成）
- AI商品説明文生成（Gemini API）
- プッシュ通知連携
- 52,000件のブランドデータ
- セグメント方式管理番号

### ⚠️ Agent SDK連携に備えて追加すべき

#### 1. **画像管理機能**
```
【現状】
- 画像はアップロードできるが、保存されていない

【問題】
- Agent SDKで画像解析する時に画像がない
- 過去の商品画像を参照できない

【追加すべき】
- 画像URLの保存（複数可）
- 画像Base64データ or Google Drive保存
```

#### 2. **AI生成履歴**
```
【現状】
- AI生成した説明文は保存されるが、履歴がない

【問題】
- どのAIモデルで生成したか不明
- 生成時のプロンプトが記録されていない
- 複数回生成した履歴がない

【追加すべき】
- AI生成履歴（JSON）
- 使用したモデル名
- 生成日時
- プロンプト内容
```

#### 3. **価格調査データ**
```
【現状】
- 出品金額は手動入力

【問題】
- Agent SDKで価格調査する時の履歴がない
- 適正価格の根拠が不明

【追加すべき】
- メルカリURL（参考にした商品）
- 競合価格履歴（JSON）
- 価格調査日時
- 相場情報
```

#### 4. **更新履歴**
```
【現状】
- 誰がいつ更新したか不明

【問題】
- チーム連携時に誰が登録したか分からない
- Agent SDKで自動更新する時に識別できない

【追加すべき】
- 最終更新者
- 更新日時
- 登録者
- 登録日時
```

#### 5. **構造化データ（Agent SDK用）**
```
【現状】
- データが列単位でバラバラ

【問題】
- Agent SDKがデータを読みにくい
- API連携時に毎回パースが必要

【追加すべき】
- JSON_データ列
- Agent SDK用に最適化された構造化データ
```

---

## 📊 追加すべき列

### Phase 1（今すぐ追加）

| 列名 | 説明 | 使用タイミング | データ例 |
|-----|------|--------------|---------|
| **登録者** | 商品を登録したユーザー | Phase 1 | user@example.com |
| **登録日時** | 登録日時 | Phase 1 | 2025/10/20 14:30 |
| **最終更新者** | 最後に更新したユーザー | Phase 1 | user@example.com |
| **更新日時** | 最終更新日時 | Phase 1 | 2025/10/20 15:00 |
| **画像URL1** | 商品画像1のURL | Phase 1 | https://... |
| **画像URL2** | 商品画像2のURL | Phase 1 | https://... |
| **画像URL3** | 商品画像3のURL | Phase 1 | https://... |

### Phase 4（列だけ作成、空欄）

| 列名 | 説明 | 使用タイミング | データ例 |
|-----|------|--------------|---------|
| **AI生成履歴** | AI生成の履歴（JSON） | Phase 4 | {"model":"gemini-2.0-flash","date":"..."} |
| **メルカリURL** | 参考にした商品URL | Phase 4 | https://jp.mercari.com/... |
| **競合価格履歴** | 価格調査結果（JSON） | Phase 4 | {"avg":3980,"min":2500,"max":5000} |
| **AIタグ** | AI生成タグ（検索用） | Phase 4 | "ダウンジャケット,UNIQLO,冬,黒" |
| **JSON_データ** | 構造化データ（Agent SDK用） | Phase 4 | {"brand":"UNIQLO",...} |
| **Agent分析結果** | Agent SDKの分析結果 | Phase 4 | {"predicted_price":3980,...} |

---

## 🔧 product.js の強化

### 1. 画像保存機能の追加

```javascript
// product.js に追加

/**
 * 画像をGoogle Driveに保存してURLを返す
 * @param {Blob} imageBlob - 画像データ
 * @param {String} managementNumber - 管理番号
 * @returns {String} 画像URL
 */
function saveImageToDrive(imageBlob, managementNumber) {
  try {
    // Google Driveの「REBORN商品画像」フォルダに保存
    const folder = getOrCreateImageFolder();
    const fileName = `${managementNumber}_${Date.now()}.jpg`;
    const file = folder.createFile(imageBlob.setName(fileName));

    // 共有設定（リンクを知っている全員が閲覧可能）
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return file.getUrl();
  } catch (error) {
    console.error('画像保存エラー:', error);
    return null;
  }
}

function getOrCreateImageFolder() {
  const folderName = 'REBORN商品画像';
  const folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  } else {
    return DriveApp.createFolder(folderName);
  }
}

/**
 * saveProduct に画像保存処理を追加
 */
function saveProduct(form) {
  // ... 既存のコード ...

  // 画像URLの保存
  if (form['画像1']) {
    const imageUrl1 = saveImageToDrive(form['画像1'], mgmtKey);
    if (imageUrl1) {
      sh.getRange(targetRow, map['画像URL1']).setValue(imageUrl1);
    }
  }

  if (form['画像2']) {
    const imageUrl2 = saveImageToDrive(form['画像2'], mgmtKey);
    if (imageUrl2) {
      sh.getRange(targetRow, map['画像URL2']).setValue(imageUrl2);
    }
  }

  if (form['画像3']) {
    const imageUrl3 = saveImageToDrive(form['画像3'], mgmtKey);
    if (imageUrl3) {
      sh.getRange(targetRow, map['画像URL3']).setValue(imageUrl3);
    }
  }

  // ... 既存のコード ...
}
```

### 2. 更新履歴の記録

```javascript
// product.js に追加

/**
 * 登録者・更新者情報を記録
 */
function recordUserActivity(sheet, targetRow, isNew = true) {
  const { map } = getHeaderMapCommon();
  const userEmail = Session.getActiveUser().getEmail();
  const now = new Date();

  if (isNew) {
    // 新規登録
    if (map['登録者']) {
      sheet.getRange(targetRow, map['登録者']).setValue(userEmail);
    }
    if (map['登録日時']) {
      sheet.getRange(targetRow, map['登録日時']).setValue(now);
    }
  }

  // 更新情報は常に記録
  if (map['最終更新者']) {
    sheet.getRange(targetRow, map['最終更新者']).setValue(userEmail);
  }
  if (map['更新日時']) {
    sheet.getRange(targetRow, map['更新日時']).setValue(now);
  }
}

/**
 * saveProduct に更新履歴記録を追加
 */
function saveProduct(form) {
  // ... データ保存処理 ...

  // 更新履歴を記録
  recordUserActivity(sh, targetRow, true); // true = 新規登録

  // ... 残りの処理 ...
}
```

### 3. AI生成履歴の記録

```javascript
// product.js に追加

/**
 * AI生成履歴を記録
 * @param {String} managementNumber - 管理番号
 * @param {Object} generationData - 生成データ
 */
function recordAIGeneration(managementNumber, generationData) {
  try {
    const sh = getSheet();
    const { map } = getHeaderMapCommon();

    // 管理番号で行を検索
    const targetRow = findRowByManagementNumber(managementNumber);
    if (!targetRow) return;

    // 既存の履歴を取得
    const historyCol = map['AI生成履歴'];
    if (!historyCol) return;

    const existingHistory = sh.getRange(targetRow, historyCol).getValue();
    let history = [];

    if (existingHistory) {
      try {
        history = JSON.parse(existingHistory);
      } catch (e) {
        history = [];
      }
    }

    // 新しい生成データを追加
    history.push({
      timestamp: new Date().toISOString(),
      model: generationData.model || 'gemini-2.0-flash-exp',
      prompt: generationData.prompt || '',
      result: generationData.result || '',
      imageUsed: generationData.imageUsed || false
    });

    // 最新10件のみ保持
    if (history.length > 10) {
      history = history.slice(-10);
    }

    // 保存
    sh.getRange(targetRow, historyCol).setValue(JSON.stringify(history));

  } catch (error) {
    console.error('AI生成履歴記録エラー:', error);
  }
}

/**
 * 管理番号で行を検索
 */
function findRowByManagementNumber(managementNumber) {
  const sh = getSheet();
  const { map } = getHeaderMapCommon();

  const managementCol = map['管理番号'];
  if (!managementCol) return null;

  const lastRow = sh.getLastRow();
  const managementValues = sh.getRange(2, managementCol, lastRow - 1, 1)
    .getDisplayValues().flat();

  const rowIndex = managementValues.findIndex(val =>
    String(val).trim() === String(managementNumber).trim()
  );

  return rowIndex !== -1 ? rowIndex + 2 : null;
}
```

### 4. PRODUCT_FIELDS に新しい列を追加

```javascript
// product.js の PRODUCT_FIELDS に追加

const PRODUCT_FIELDS = [
  // ... 既存のフィールド ...

  // === Phase 1: 今すぐ追加 ===
  '登録者',
  '登録日時',
  '最終更新者',
  '更新日時',
  '画像URL1',
  '画像URL2',
  '画像URL3',

  // === Phase 4: 将来使用（今は空欄） ===
  'AI生成履歴',      // JSON形式
  'メルカリURL',
  '競合価格履歴',    // JSON形式
  'AIタグ',
  'JSON_データ',     // Agent SDK用
  'Agent分析結果'    // JSON形式
];
```

---

## 🎨 UI強化（sidebar_product.html）

### 1. 画像アップロード機能

```html
<!-- sp_block_basic.html または新しいブロック -->

<div class="form-group">
  <label>商品画像</label>

  <div class="image-upload-area">
    <div class="image-preview" id="imagePreview1">
      <input type="file" id="image1" accept="image/*" onchange="handleImageUpload(1)">
      <label for="image1" class="upload-label">
        <i class="fas fa-camera"></i>
        <span>画像1をアップロード</span>
      </label>
      <img id="preview1" style="display:none; max-width: 200px;">
    </div>

    <div class="image-preview" id="imagePreview2">
      <input type="file" id="image2" accept="image/*" onchange="handleImageUpload(2)">
      <label for="image2" class="upload-label">
        <i class="fas fa-camera"></i>
        <span>画像2をアップロード</span>
      </label>
      <img id="preview2" style="display:none; max-width: 200px;">
    </div>

    <div class="image-preview" id="imagePreview3">
      <input type="file" id="image3" accept="image/*" onchange="handleImageUpload(3)">
      <label for="image3" class="upload-label">
        <i class="fas fa-camera"></i>
        <span>画像3をアップロード</span>
      </label>
      <img id="preview3" style="display:none; max-width: 200px;">
    </div>
  </div>

  <small class="form-text text-muted">
    ※ 商品画像を最大3枚まで登録できます（Phase 4でAI解析に使用）
  </small>
</div>
```

### 2. JavaScript処理（sp_scripts.html）

```javascript
// sp_scripts.html に追加

/**
 * 画像アップロード処理
 */
function handleImageUpload(imageNumber) {
  const fileInput = document.getElementById(`image${imageNumber}`);
  const preview = document.getElementById(`preview${imageNumber}`);

  if (fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];

    // プレビュー表示
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.src = e.target.result;
      preview.style.display = 'block';
    };
    reader.readAsDataURL(file);

    // Base64エンコード（GAS送信用）
    const reader2 = new FileReader();
    reader2.onload = function(e) {
      window[`imageData${imageNumber}`] = e.target.result;
    };
    reader2.readAsDataURL(file);
  }
}

/**
 * 商品保存時に画像データを含める
 */
function collectProductInfo() {
  const data = {
    // ... 既存のフィールド ...
  };

  // 画像データを追加
  if (window.imageData1) data['画像1'] = window.imageData1;
  if (window.imageData2) data['画像2'] = window.imageData2;
  if (window.imageData3) data['画像3'] = window.imageData3;

  return data;
}
```

---

## 📝 実装スケジュール

### Week 1: スプレッドシート準備（1日）

**Day 1:**
- [ ] スプレッドシートに新しい列を追加
  - Phase 1の列（登録者、更新日時等）
  - Phase 4の列（空欄でOK）
- [ ] テストデータで動作確認

### Week 2: product.js 強化（3-4日）

**Day 1:**
- [ ] PRODUCT_FIELDS に新しい列を追加
- [ ] recordUserActivity() 実装
- [ ] saveProduct() に更新履歴記録を追加
- [ ] 動作確認

**Day 2:**
- [ ] saveImageToDrive() 実装
- [ ] getOrCreateImageFolder() 実装
- [ ] saveProduct() に画像保存処理を追加
- [ ] 動作確認

**Day 3-4:**
- [ ] recordAIGeneration() 実装
- [ ] findRowByManagementNumber() 実装
- [ ] gemini_api.js との連携
- [ ] 動作確認

### Week 3: UI強化（2-3日）

**Day 1-2:**
- [ ] 画像アップロードUIの実装
- [ ] handleImageUpload() 実装
- [ ] プレビュー表示
- [ ] 動作確認

**Day 3:**
- [ ] 統合テスト
- [ ] バグ修正
- [ ] ドキュメント更新

---

## 🧪 テスト計画

### Phase 1 テスト

```javascript
/**
 * 画像保存テスト
 */
function testImageSave() {
  // テスト用画像データ（Base64）
  const testImageBase64 = "data:image/png;base64,iVBORw0KGgoAAAANS...";
  const testBlob = Utilities.newBlob(
    Utilities.base64Decode(testImageBase64.split(',')[1]),
    'image/png',
    'test.png'
  );

  const url = saveImageToDrive(testBlob, 'TEST-001');
  console.log('画像URL:', url);

  return url ? 'OK' : 'NG';
}

/**
 * 更新履歴テスト
 */
function testUserActivity() {
  const sh = getSheet();
  const testRow = sh.getLastRow() + 1;

  recordUserActivity(sh, testRow, true);

  // 確認
  const { map } = getHeaderMapCommon();
  const registrant = sh.getRange(testRow, map['登録者']).getValue();
  const updater = sh.getRange(testRow, map['最終更新者']).getValue();

  console.log('登録者:', registrant);
  console.log('最終更新者:', updater);

  return (registrant && updater) ? 'OK' : 'NG';
}

/**
 * AI生成履歴テスト
 */
function testAIGenerationHistory() {
  const testData = {
    model: 'gemini-2.0-flash-exp',
    prompt: 'テスト用プロンプト',
    result: 'テスト用結果',
    imageUsed: true
  };

  recordAIGeneration('TEST-001', testData);

  // 確認
  const sh = getSheet();
  const targetRow = findRowByManagementNumber('TEST-001');
  const { map } = getHeaderMapCommon();

  const history = sh.getRange(targetRow, map['AI生成履歴']).getValue();
  console.log('AI生成履歴:', history);

  try {
    const parsed = JSON.parse(history);
    return parsed.length > 0 ? 'OK' : 'NG';
  } catch (e) {
    return 'NG';
  }
}
```

---

## 🎯 完成基準

### Phase 1完成の条件

- [ ] 新しい列がスプレッドシートに追加されている
- [ ] 商品登録時に登録者・登録日時が記録される
- [ ] 商品登録時に更新者・更新日時が記録される
- [ ] 画像をアップロードできる
- [ ] 画像がGoogle Driveに保存される
- [ ] 画像URLがスプレッドシートに記録される
- [ ] AI生成履歴が記録される（空欄でもOK）
- [ ] すべてのテストがパスする

### Phase 4準備の条件

- [ ] Phase 4用の列が準備されている（空欄）
- [ ] データ構造がAgent SDK連携に対応
- [ ] API Endpointが拡張可能
- [ ] コードに将来の拡張ポイントがコメントされている

---

## 💡 メリット

### 今すぐのメリット

1. **画像管理**
   - 商品画像を確実に保存
   - 後から見返せる
   - チーム間で共有可能

2. **更新履歴**
   - 誰が登録したか明確
   - トラブルシューティングが容易
   - チーム連携がスムーズ

3. **AI生成履歴**
   - 何度も生成し直せる
   - 過去の生成結果を比較できる

### 将来のメリット（Phase 4）

1. **Agent SDK連携**
   - 画像データがあるのでAI解析可能
   - 履歴データで学習・改善
   - 構造化データで高速処理

2. **価格調査自動化**
   - 過去の調査データを活用
   - トレンド分析が可能
   - 適正価格の精度向上

3. **レポート自動生成**
   - データが揃っているので即座にレポート化
   - グラフ・チャートも自動生成

---

**この強化を実施すれば、商品登録システムがPhase 4でそのまま活用できます！**
