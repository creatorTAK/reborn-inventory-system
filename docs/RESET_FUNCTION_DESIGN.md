# リセット機能 設計ドキュメント

**Issue:** RESET-005
**作成日:** 2025-10-21
**最終更新:** 2025-10-21

---

## 📖 目的

商品登録フォームのリセット機能を**「次の商品へ」機能**として全面改修する。

**設計の重要性:**
- システム全体に影響する重要機能
- 複雑な依存関係がある（各ブロックが連動）
- バグが起きると商品登録業務全体が止まる

**設計目標:**
1. **保守性の高い構造**：各セクションを独立した関数に分離
2. **エラーに強い**：1つのエラーで全体が止まらない
3. **明確な責務**：各関数の役割を明確にする
4. **テスト可能**：セクションごとにテスト可能

---

## 🏗️ システムアーキテクチャ

### 現在の構造（問題あり）

```
onReset() {
  // 300行の巨大な関数
  // エラーが起きると全体が止まる
  // 保持/削除のロジックが混在
}
```

### 新しい構造（改善後）

```
onReset()                    メイン関数（オーケストレーター）
  ├─ resetManagementNumber() 管理番号ブロック
  ├─ resetBasicInfo()        基本情報ブロック
  ├─ resetProductName()      商品名ブロック
  ├─ resetProductDetails()   商品詳細ブロック
  ├─ resetDescription()      商品説明ブロック（部分保持）
  ├─ applyDefaultValues()    デフォルト値再適用
  └─ updateAllPreviews()     プレビュー更新
```

---

## 📐 関数設計

### 1. onReset() - メイン関数

**責務:**
- 各セクションのリセット関数を順序通り実行
- 全体のエラーハンドリング
- ユーザーへのフィードバック

**入力:** なし
**出力:** なし

**処理フロー:**
```javascript
function onReset() {
  try {
    console.log('=== リセット開始 ===');

    // Phase 1: データクリア
    resetManagementNumber();
    resetBasicInfo();
    resetProductName();
    resetProductDetails();
    resetDescription();

    // Phase 2: デフォルト値再適用
    applyDefaultValues();

    // Phase 3: UI更新
    updateAllPreviews();

    console.log('=== リセット完了 ===');
  } catch (error) {
    console.error('リセット処理エラー:', error);
    alert('リセット処理中にエラーが発生しました。ページを再読み込みしてください。');
  }
}
```

**エラーハンドリング:**
- 各セクション関数内でtry-catchを使用
- エラーが発生してもログ出力して処理を継続
- onReset()レベルの致命的エラーのみユーザーに通知

---

### 2. resetManagementNumber() - 管理番号ブロック

**責務:**
- 管理番号関連の全フィールドをクリア

**クリア対象:**
- prefix1（頭文字）
- 棚番号
- 管理番号フィールド
- 担当者
- 動的生成フィールド（mgmt_shelf_first, mgmt_shelf_second等）

**処理フロー:**
```javascript
function resetManagementNumber() {
  try {
    console.log('[Reset] 管理番号ブロック開始');

    // 基本フィールド
    clearField('prefix1');
    clearField('棚番号');
    clearField('管理番号');
    clearField('担当者');

    // 動的生成フィールド
    clearField('mgmt_shelf_first');
    clearField('mgmt_shelf_second');
    clearField('mgmt_custom_first');
    clearField('mgmt_custom_second');

    console.log('[Reset] 管理番号ブロック完了');
  } catch (error) {
    console.error('[Reset] 管理番号ブロックエラー:', error);
  }
}
```

**依存関係:** なし

---

### 3. resetBasicInfo() - 基本情報ブロック

**責務:**
- 基本情報の全フィールドをクリア
- カテゴリプルダウンを初期化

**クリア対象:**
- カテゴリー（大分類、中分類、小分類、細分類、細分類2）
- ブランド（英語、カナ）
- アイテム名
- サイズ
- 商品の状態

**処理フロー:**
```javascript
function resetBasicInfo() {
  try {
    console.log('[Reset] 基本情報ブロック開始');

    // カテゴリー
    clearField('大分類(カテゴリ)');
    resetSelect('中分類(カテゴリ)', true);
    resetSelect('小分類(カテゴリ)', true);
    resetSelect('細分類(カテゴリ)', true);
    resetSelect('細分類2', true);

    // 細分類行を非表示
    const saibunruiRow = document.getElementById('saibunruiRow');
    if (saibunruiRow) saibunruiRow.style.display = 'none';

    // ブランド
    clearField('ブランド(英語)');
    clearField('ブランド(カナ)');
    hideSuggest('ブランド(英語)');

    // その他
    clearField('アイテム名');
    clearField('サイズ');
    clearField('商品の状態');

    console.log('[Reset] 基本情報ブロック完了');
  } catch (error) {
    console.error('[Reset] 基本情報ブロックエラー:', error);
  }
}
```

**依存関係:**
- resetSelect()（既存関数）
- hideSuggest()（既存関数）

---

### 4. resetProductName() - 商品名ブロック

**責務:**
- 商品名関連をクリア
- **セールスワードのデフォルト値は保持**

**クリア対象:**
- 商品名プレビュー
- ブランド情報表示
- アイテム名
- 商品属性（2個目以降を削除、1個目をクリア）

**保持対象:**
- セールスワードのデフォルト値

**処理フロー:**
```javascript
function resetProductName() {
  try {
    console.log('[Reset] 商品名ブロック開始');

    // 商品名プレビュー
    clearField('商品名プレビュー');

    // ブランド情報（基本情報に連動するのでクリア）
    clearField('商品名_ブランド(英語)');
    clearField('商品名_ブランド(カナ)');

    // ブランドチェックボックスをチェック状態に戻す
    const brandEnCheckbox = document.getElementById('商品名_ブランド(英語)_チェック');
    const brandKanaCheckbox = document.getElementById('商品名_ブランド(カナ)_チェック');
    if (brandEnCheckbox) brandEnCheckbox.checked = true;
    if (brandKanaCheckbox) brandKanaCheckbox.checked = true;

    // アイテム名
    clearField('商品名_アイテム名');

    // 商品属性（2個目以降を削除）
    resetAttributeSections();

    // セールスワードはapplyDefaultValues()で再適用

    console.log('[Reset] 商品名ブロック完了');
  } catch (error) {
    console.error('[Reset] 商品名ブロックエラー:', error);
  }
}
```

**依存関係:**
- resetAttributeSections()（新規作成）

---

### 5. resetProductDetails() - 商品詳細ブロック

**責務:**
- 商品詳細情報をクリア
- 動的セクション（カラー、素材）を1つに戻す

**クリア対象:**
- サイズセクション（非表示に戻す）
- カラー（2個目以降を削除）
- 素材（2個目以降を削除）
- 商品の状態詳細
- AI生成情報（追加属性、品番・型番、商品画像）

**処理フロー:**
```javascript
function resetProductDetails() {
  try {
    console.log('[Reset] 商品詳細ブロック開始');

    // サイズセクション
    resetSizeSection();

    // カラー
    resetColorSections();

    // 素材
    resetMaterialSections();

    // 商品の状態詳細
    clearField('商品状態詳細');

    // AI生成情報
    clearField('AI用商品属性');
    clearField('品番型番');
    resetProductImages();

    console.log('[Reset] 商品詳細ブロック完了');
  } catch (error) {
    console.error('[Reset] 商品詳細ブロックエラー:', error);
  }
}
```

**依存関係:**
- resetSizeSection()（新規作成）
- resetColorSections()（新規作成）
- resetMaterialSections()（新規作成）
- resetProductImages()（新規作成）

---

### 6. resetDescription() - 商品説明ブロック（最重要・最難関）

**責務:**
- 商品の説明textareaをデフォルト値に戻す
- **割引情報とハッシュタグは保持**

**保持対象:**
- 設定で定義された割引情報
- 設定で定義されたハッシュタグ

**クリア対象:**
- 商品固有情報（ブランド、商品の状態、AI生成文等）
- オリジナルハッシュタグ（商品固有）

**処理フロー:**
```javascript
function resetDescription() {
  try {
    console.log('[Reset] 商品説明ブロック開始');

    // 現在の説明文を取得
    const descTextarea = document.getElementById('商品の説明');
    if (!descTextarea) return;

    // 割引情報とハッシュタグを抽出
    const preservedContent = extractPreservedContent(descTextarea.value);

    // textareaをクリア
    descTextarea.value = '';

    // 保持する内容を再設定
    if (preservedContent) {
      descTextarea.value = preservedContent;
    }

    console.log('[Reset] 商品説明ブロック完了');
  } catch (error) {
    console.error('[Reset] 商品説明ブロックエラー:', error);
  }
}
```

**依存関係:**
- extractPreservedContent()（新規作成・複雑）

---

### 7. applyDefaultValues() - デフォルト値再適用

**責務:**
- 各種デフォルト値を再適用

**適用対象:**
- セールスワード
- 配送情報
- 仕入情報
- 出品情報

**処理フロー:**
```javascript
function applyDefaultValues() {
  try {
    console.log('[Reset] デフォルト値適用開始');

    // セールスワード
    applyDefaultSalesword();

    // 配送情報
    applyShippingDefaults(); // 既存関数

    // 仕入・出品情報
    applyProcureListingDefaults(); // 既存関数

    console.log('[Reset] デフォルト値適用完了');
  } catch (error) {
    console.error('[Reset] デフォルト値適用エラー:', error);
  }
}
```

**依存関係:**
- applyDefaultSalesword()（新規作成）
- applyShippingDefaults()（既存）
- applyProcureListingDefaults()（既存）

---

### 8. updateAllPreviews() - プレビュー更新

**責務:**
- 各種プレビューを更新

**更新対象:**
- ブランド表示
- 商品名プレビュー
- 商品の説明プレビュー

**処理フロー:**
```javascript
function updateAllPreviews() {
  try {
    console.log('[Reset] プレビュー更新開始');

    // ブランド表示を更新
    updateBrandDisplay(); // 既存関数

    // 商品名プレビュー・商品の説明を更新
    setTimeout(() => {
      updateNamePreview(); // 既存関数
      updateDescriptionFromDetail(); // 既存関数（改修済み）
    }, 100);

    console.log('[Reset] プレビュー更新完了');
  } catch (error) {
    console.error('[Reset] プレビュー更新エラー:', error);
  }
}
```

**依存関係:**
- updateBrandDisplay()（既存）
- updateNamePreview()（既存）
- updateDescriptionFromDetail()（既存・改修必要）

---

## 🔧 ヘルパー関数

### clearField(fieldId)
**責務:** 指定されたフィールドをクリア

```javascript
function clearField(fieldId) {
  const el = document.getElementById(fieldId);
  if (el) {
    el.value = '';
  }
}
```

### resetAttributeSections()
**責務:** 商品属性セクションを1つに戻す

```javascript
function resetAttributeSections() {
  const attributeItems = document.querySelectorAll('.attribute-item');
  attributeItems.forEach((item, index) => {
    if (index === 0) {
      // 1個目はクリア
      clearField('商品属性1_カテゴリ');
      clearField('商品属性1_値');
      const valueSelect = document.getElementById('商品属性1_値');
      if (valueSelect) valueSelect.disabled = true;
    } else {
      // 2個目以降は削除
      item.remove();
    }
  });
  attributeCount = 1;
  updateAttributeRemoveButtons();
}
```

### resetColorSections()
**責務:** カラーセクションを1つに戻す

```javascript
function resetColorSections() {
  const colorItems = document.querySelectorAll('.color-item');
  colorItems.forEach((item, index) => {
    if (index === 0) {
      clearField('カラー1');
    } else {
      item.remove();
    }
  });
  colorCount = 1;
  updateColorRemoveButtons();
}
```

### resetMaterialSections()
**責務:** 素材セクションを1つに戻す

```javascript
function resetMaterialSections() {
  const materialItems = document.querySelectorAll('.material-item');
  materialItems.forEach((item, index) => {
    if (index === 0) {
      clearField('素材1_箇所');
      clearField('素材1_種類1');
      clearField('素材1_％1');
      clearField('素材1_種類2');
      clearField('素材1_％2');
    } else {
      item.remove();
    }
  });
  materialCount = 1;
  updateRemoveButtons();
}
```

### resetSizeSection()
**責務:** サイズセクションを非表示に戻す

```javascript
function resetSizeSection() {
  // サイズセクション非表示
  const sizeSection = document.getElementById('sizeSection');
  if (sizeSection) sizeSection.style.display = 'none';

  // アイコン・ラベルを初期状態に
  const sizeIconDisplay = document.getElementById('sizeIconDisplay');
  const sizeLabelDisplay = document.getElementById('sizeLabelDisplay');
  if (sizeIconDisplay) sizeIconDisplay.textContent = '👕';
  if (sizeLabelDisplay) sizeLabelDisplay.textContent = 'サイズ';

  // 全サイズフィールドをクリア
  // ... (省略)
}
```

### resetProductImages()
**責務:** 商品画像を全削除

```javascript
function resetProductImages() {
  // グローバル変数をクリア
  AI_GENERATED_TEXT = '';
  uploadedImages = [];

  // プレビューコンテナを非表示
  const container = document.getElementById('imagePreviewContainer');
  if (container) container.style.display = 'none';

  // ファイル入力をリセット
  const fileInput = document.getElementById('productImages');
  if (fileInput) fileInput.value = '';

  // プレビューを更新
  displayImagePreviews();
}
```

### extractPreservedContent(currentText) ⚠️ 最難関
**責務:** 商品の説明から保持すべき内容（割引情報・ハッシュタグ）を抽出

**ロジック:**
1. 設定から割引情報とハッシュタグを取得
2. 現在のテキストから該当部分を抽出
3. 抽出した内容を結合して返す

```javascript
function extractPreservedContent(currentText) {
  // TODO: 実装が複雑
  // 1. 設定から割引情報のパターンを取得
  // 2. 設定からハッシュタグのリストを取得
  // 3. currentTextから該当部分をマッチング
  // 4. 結合して返す
  return '';
}
```

### applyDefaultSalesword()
**責務:** セールスワードのデフォルト値を適用

```javascript
function applyDefaultSalesword() {
  if (typeof defaultSalesword !== 'undefined' && defaultSalesword &&
      defaultSalesword.カテゴリ && defaultSalesword.セールスワード) {
    setTimeout(() => {
      applyDefaultSalesword(defaultSalesword);
      console.log('デフォルトセールスワードを再適用しました');
    }, 100);
  }
}
```

---

## 📊 データフロー

```
ユーザーがリセットボタンをクリック
  ↓
onReset()
  ↓
Phase 1: データクリア
  ├─ resetManagementNumber() → DOM要素をクリア
  ├─ resetBasicInfo()        → DOM要素をクリア
  ├─ resetProductName()      → DOM要素をクリア
  ├─ resetProductDetails()   → DOM要素をクリア
  └─ resetDescription()      → 部分保持ロジック
  ↓
Phase 2: デフォルト値再適用
  └─ applyDefaultValues()
       ├─ セールスワード → グローバル変数から
       ├─ 配送情報      → SHIPPING_DEFAULTSから
       └─ 仕入・出品    → PROCURE_LISTING_DEFAULTSから
  ↓
Phase 3: UI更新
  └─ updateAllPreviews()
       ├─ updateBrandDisplay()
       ├─ updateNamePreview()
       └─ updateDescriptionFromDetail()
  ↓
完了
```

---

## ⚠️ エラーハンドリング戦略

### 原則
1. **各セクション関数内でtry-catch**
2. **エラーが発生してもログ出力して処理を継続**
3. **onReset()レベルの致命的エラーのみユーザーに通知**

### 例
```javascript
function resetManagementNumber() {
  try {
    // 処理
  } catch (error) {
    console.error('[Reset] 管理番号ブロックエラー:', error);
    // 処理は継続（throwしない）
  }
}
```

---

## 🧪 テスト戦略

### 単体テスト（手動）
- 各セクション関数を個別にテスト
- テストケース: TC-RESET-005-001 ~ 012

### 統合テスト
- onReset()全体のフローをテスト
- エラー耐性テスト（TC-RESET-005-011）
- デグレードテスト（TC-RESET-005-012）

### テスト実行順序
1. Phase 1: 各セクション関数の単体テスト
2. Phase 2: applyDefaultValues()のテスト
3. Phase 3: onReset()全体の統合テスト

---

## 📝 実装の注意点

### 1. 商品の説明の部分保持（最難関）
- extractPreservedContent()の実装が複雑
- 設定から割引情報とハッシュタグのパターンを取得
- 正規表現でマッチング
- エッジケース（ユーザーが手動で編集した場合）を考慮

### 2. デフォルト値の取得元
- セールスワード: `defaultSalesword`（グローバル変数）
- 配送情報: `SHIPPING_DEFAULTS`（グローバル変数）
- 仕入・出品: `PROCURE_LISTING_DEFAULTS`（グローバル変数）

### 3. 既存関数との連携
- updateDescriptionFromDetail()は既存のままで良いか確認
- resetSelect(), hideSuggest()等の既存関数を活用

### 4. グローバル変数の管理
- materialCount, colorCount, attributeCount等のカウンター変数を正しくリセット

---

## 🚀 実装スケジュール

### Phase 1: 関数構造の作成（1-2時間）
- 各セクション関数のスケルトン作成
- エラーハンドリングの枠組み

### Phase 2: セクションごとの実装（3-4時間）
- 簡単なセクションから実装
- resetManagementNumber(), resetBasicInfo()
- resetProductName(), resetProductDetails()
- resetDescription()（最後・最難関）

### Phase 3: デフォルト値の再適用（1時間）
- applyDefaultValues()実装

### Phase 4: テスト（2-3時間）
- 12個のテストケースを全て実行
- 不具合修正

**合計: 7-10時間**

---

**次のステップ:** Phase 1の実装開始

