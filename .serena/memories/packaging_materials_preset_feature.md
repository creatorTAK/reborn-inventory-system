# 梱包資材プリセット機能

## 概要

販売記録画面で、登録済みの梱包資材プリセットを選択すると、複数の梱包資材が自動的に入力され、梱包費が自動計算される機能。

## 実装日

2025-11-02

## 主な機能

### 1. プリセット選択
- 販売記録モーダルに「梱包資材プリセット選択」ドロップダウンを追加
- 既存のプリセットを選択可能
- 選択すると即座に梱包資材が自動入力される

### 2. 自動入力
- プリセットに登録された複数の梱包資材が一括入力される
- 各資材の数量も自動設定
- 梱包費が自動計算される

### 3. プリセット新規作成
- 「新しいプリセットを作成」ボタン
- 現在入力されている梱包資材をプリセットとして保存可能
- プリセット名を入力して保存

### 4. プリセット管理
- 設定画面の「マスタ管理」セクションから管理
- プリセット一覧表示
- 編集・削除機能

## 実装ファイル

### sidebar_inventory.html
販売記録モーダルにUI追加（Lines 約500-550付近）

```javascript
// プリセット選択時の処理
const presetSelect = document.getElementById('packaging-preset-select');
presetSelect.addEventListener('change', function() {
  const presetName = this.value;
  if (presetName) {
    google.script.run
      .withSuccessHandler(applyPackagingPreset)
      .withFailureHandler(handleError)
      .getPackagingMaterialsPreset(presetName);
  }
});

function applyPackagingPreset(preset) {
  // 梱包資材フィールドに自動入力
  preset.materials.forEach((material, index) => {
    // 資材名と数量を設定
    document.getElementById(`packaging-material-${index+1}`).value = material.name;
    document.getElementById(`packaging-quantity-${index+1}`).value = material.quantity;
  });
  
  // 梱包費を自動計算
  calculatePackagingCost();
}
```

### packaging_materials_manager.js
プリセットの保存・取得・削除ロジック

```javascript
function savePackagingMaterialsPreset(presetName, materials) {
  const sheet = getPackagingPresetsSheet();
  // プリセット保存処理
}

function getPackagingMaterialsPreset(presetName) {
  const sheet = getPackagingPresetsSheet();
  // プリセット取得処理
}

function deletePackagingMaterialsPreset(presetName) {
  const sheet = getPackagingPresetsSheet();
  // プリセット削除処理
}

function getAllPackagingPresetsNames() {
  const sheet = getPackagingPresetsSheet();
  // 全プリセット名を取得
}
```

## データ構造

### プリセットデータ形式（JSON）
```json
{
  "name": "メルカリ便_小型",
  "materials": [
    {
      "name": "OPP袋 A4",
      "quantity": 1,
      "unitCost": 5
    },
    {
      "name": "プチプチ 30cm",
      "quantity": 1,
      "unitCost": 15
    },
    {
      "name": "ダンボール 60サイズ",
      "quantity": 1,
      "unitCost": 80
    }
  ],
  "totalCost": 100
}
```

## シート構造

**梱包資材プリセットシート**:
- 列A: プリセット名
- 列B: 資材データ（JSON文字列）
- 列C: 作成日時
- 列D: 最終更新日時

## 使用フロー

1. 販売記録画面を開く
2. 「梱包資材プリセット選択」ドロップダウンをクリック
3. 既存のプリセット（例：「メルカリ便_小型」）を選択
4. 自動的に梱包資材が入力される
5. 梱包費が自動計算される
6. そのまま販売記録を保存

## メリット

1. **効率化**: 毎回手動で梱包資材を入力する手間が不要
2. **正確性**: 入力ミスを防止
3. **一貫性**: 同じ梱包パターンを標準化
4. **時短**: 販売記録の入力時間を大幅短縮

## テスト結果

- ✅ プリセット選択で自動入力
- ✅ 梱包費の自動計算
- ✅ 販売記録への反映
- ✅ ステータス更新（登録済み → 販売済み）

## 注意事項

- プリセットは梱包資材マスタに登録されている資材を使用すること
- プリセット名は一意である必要がある
- プリセット削除時は確認ダイアログを表示すること

## 関連機能

- 梱包資材マスタ管理（master_data_manager.js）
- 販売記録機能（INV-004）
- 自動計算機能（梱包費、利益計算）
