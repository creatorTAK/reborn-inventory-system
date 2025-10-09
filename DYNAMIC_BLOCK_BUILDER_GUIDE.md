# 動的ブロックビルダー - 使用ガイド

## 📋 概要

動的ブロックビルダーは、フォーム内で動的に追加・削除可能なブロック要素を簡単に実装できる統一システムです。

## 🎯 主な機能

- ✅ 宣言的な設定でブロックを自動生成
- ✅ 追加・削除の自動管理
- ✅ 最小/最大数の制御
- ✅ 自動リナンバリング
- ✅ データ収集・セット機能
- ✅ カスタムテンプレート対応
- ✅ イベントハンドラー統合

## 🚀 基本的な使い方

### 1. HTMLにインクルード

```html
<?!= include('dynamic_block_builder'); ?>
<?!= include('dynamic_block_builder_styles'); ?>
```

### 2. コンテナ要素を配置

```html
<div id="myBlockList" class="block-list"></div>
<button type="button" onclick="myBuilder.addItem()">+ ブロックを追加</button>
```

### 3. JavaScriptで初期化

```javascript
const myBuilder = new DynamicBlockBuilder({
  containerId: 'myBlockList',
  itemLabel: 'アイテム',
  minItems: 1,
  maxItems: 10,
  fields: [
    {
      id: 'name',
      type: 'text',
      label: '名前',
      placeholder: '名前を入力'
    },
    {
      id: 'category',
      type: 'select',
      label: 'カテゴリ',
      options: ['オプション1', 'オプション2', 'オプション3']
    },
    {
      id: 'amount',
      type: 'number',
      label: '数量',
      min: 0,
      max: 100
    }
  ],
  onChange: () => {
    console.log('データが変更されました');
  }
});
```

## 📝 設定オプション

### 必須項目

| オプション | 型 | 説明 |
|-----------|-----|------|
| `containerId` | string | コンテナ要素のID |
| `fields` | Array | フィールド定義配列 |

### オプション項目

| オプション | 型 | デフォルト値 | 説明 |
|-----------|-----|-------------|------|
| `itemLabel` | string | 'アイテム' | アイテムのラベル |
| `minItems` | number | 1 | 最小アイテム数 |
| `maxItems` | number | 10 | 最大アイテム数 |
| `itemClass` | string | 'dynamic-block-item' | アイテム要素のCSSクラス |
| `onChange` | Function | () => {} | 変更時のコールバック関数 |
| `template` | Object | {} | カスタムテンプレート設定 |

### フィールド定義

各フィールドは以下のプロパティを持ちます:

| プロパティ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| `id` | string | ✅ | フィールドID |
| `type` | string | ✅ | フィールドタイプ（text/number/select/custom） |
| `label` | string | | ラベルテキスト |
| `placeholder` | string | | プレースホルダー |
| `className` | string | | CSSクラス名 |
| `options` | Array/string | | セレクトボックスのオプション |
| `min` | number | | 数値入力の最小値 |
| `max` | number | | 数値入力の最大値 |
| `step` | number | | 数値入力のステップ |
| `render` | Function | | カスタムレンダラー（type: 'custom'の場合） |
| `onInput` | Function | | 入力時のコールバック |

## 💡 使用例

### 例1: シンプルなテキスト入力

```javascript
const builder = new DynamicBlockBuilder({
  containerId: 'taskList',
  itemLabel: 'タスク',
  minItems: 1,
  maxItems: 20,
  fields: [
    {
      id: 'title',
      type: 'text',
      label: 'タスク名',
      placeholder: 'タスクを入力'
    },
    {
      id: 'priority',
      type: 'select',
      label: '優先度',
      options: ['高', '中', '低']
    }
  ]
});
```

### 例2: グローバル変数からオプション取得

```javascript
// グローバル変数
let CATEGORIES = ['カテゴリA', 'カテゴリB', 'カテゴリC'];

const builder = new DynamicBlockBuilder({
  containerId: 'itemList',
  itemLabel: '商品',
  fields: [
    {
      id: 'category',
      type: 'select',
      label: 'カテゴリ',
      options: 'CATEGORIES'  // 文字列でグローバル変数名を指定
    }
  ]
});
```

### 例3: カスタムレンダラー（複雑なUI）

```javascript
const builder = new DynamicBlockBuilder({
  containerId: 'materialList',
  itemLabel: '素材',
  fields: [
    {
      id: 'location',
      type: 'select',
      label: '箇所',
      options: 'MATERIAL_LOCATIONS'
    },
    {
      id: 'composition',
      type: 'custom',
      render: (index) => {
        const div = document.createElement('div');
        div.innerHTML = `
          <div class="row">
            <div class="col">
              <label>種類1</label>
              <select id="type1_${index}">...</select>
            </div>
            <div class="col">
              <label>割合</label>
              <input type="number" id="percent1_${index}">
            </div>
          </div>
        `;
        return div;
      }
    }
  ]
});
```

### 例4: データの収集とセット

```javascript
// データを収集
const data = builder.collectData();
console.log(data);
// [
//   { name: '田中', category: 'オプション1', amount: 5 },
//   { name: '佐藤', category: 'オプション2', amount: 10 }
// ]

// データをセット
builder.setData([
  { name: '鈴木', category: 'オプション3', amount: 15 },
  { name: '高橋', category: 'オプション1', amount: 20 }
]);
```

## 🎨 スタイルカスタマイズ

### デフォルトクラス

```css
.dynamic-block-item           /* アイテム全体 */
.dynamic-block-header         /* ヘッダー部分 */
.remove-dynamic-block-btn     /* 削除ボタン */
.dynamic-block-fields         /* フィールドコンテナ */
.dynamic-block-field          /* 個別フィールド */
.add-dynamic-block-btn        /* 追加ボタン */
```

### カスタムクラスの使用

```javascript
const builder = new DynamicBlockBuilder({
  containerId: 'myList',
  itemClass: 'my-custom-item',
  template: {
    headerClass: 'my-header',
    removeBtnClass: 'my-remove-btn',
    fieldsClass: 'my-fields'
  },
  fields: [...]
});
```

## 🔧 API リファレンス

### メソッド

#### `addItem(data)`
アイテムを追加します。

```javascript
builder.addItem();                          // 空のアイテムを追加
builder.addItem({ name: '田中', age: 30 }); // データ付きで追加
```

#### `removeItem(index)`
指定されたインデックスのアイテムを削除します。

```javascript
builder.removeItem(2);  // 2番目のアイテムを削除
```

#### `collectData()`
すべてのアイテムのデータを収集します。

```javascript
const data = builder.collectData();
```

#### `setData(dataArray)`
データをセットします（既存アイテムはクリアされます）。

```javascript
builder.setData([
  { name: '田中', age: 30 },
  { name: '佐藤', age: 25 }
]);
```

#### `clear()`
すべてのアイテムをクリアします（最小数まで）。

```javascript
builder.clear();
```

#### `getItemCount()`
現在のアイテム数を取得します。

```javascript
const count = builder.getItemCount();
```

#### `getContainer()`
コンテナ要素を取得します。

```javascript
const container = builder.getContainer();
```

#### `updateRemoveButtons()`
削除ボタンの表示を更新します。

```javascript
builder.updateRemoveButtons();
```

## 📦 既存コードとの統合

### 素材ブロック（実装済み）

```javascript
// 既存の関数名を維持しつつ、内部で動的ブロックビルダーを使用
function addMaterial() {
  if (materialBuilder) {
    materialBuilder.addItem();
  }
}

function removeMaterial(index) {
  if (materialBuilder) {
    materialBuilder.removeItem(index);
  }
}
```

### 商品属性ブロック（今後実装予定）

```javascript
const attributeBuilder = new DynamicBlockBuilder({
  containerId: 'attributeList',
  itemLabel: '商品属性',
  minItems: 1,
  maxItems: 5,
  fields: [
    {
      id: 'attribute',
      type: 'text',
      label: '属性',
      placeholder: '例: 新品、未使用'
    }
  ],
  onChange: () => updateTitlePreview()
});
```

## ⚠️ 注意事項

1. **フィールドID**: 各アイテムのフィールドIDは `{itemLabel}{index}_{fieldId}` の形式で自動生成されます
   - 例: `素材1_箇所`, `素材2_種類1`

2. **最小・最大数**: `minItems` 未満、または `maxItems` 超過の操作は自動的にブロックされます

3. **グローバル変数**: `options` で文字列を指定する場合、その名前のグローバル変数が必要です

4. **カスタムレンダラー**: `type: 'custom'` の場合、`render` 関数でHTMLElementを返す必要があります

5. **イベントリスナー**: カスタムレンダラー内でイベントリスナーを追加する場合、手動で設定してください

## 🔄 バージョン履歴

### v1.0.0 (2025-01-XX)
- 初版リリース
- 基本機能実装
- 素材ブロックへの統合完了

## 📞 サポート

質問や問題がある場合は、CLAUDE.md を参照するか、開発者に連絡してください。
