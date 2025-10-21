# Issues（完了・アーカイブ）

このファイルは、REBORN Inventoryプロジェクトの**完了したIssue**をアーカイブします。

**運用ルール：**
- `docs/issues.md` で ✅ DONE になったIssueをここに移動
- 新しい完了Issueは最上部に追加（日付順）
- 削除せずに保管（将来の参考資料として活用）

**関連ドキュメント：**
- [TDD_POLICY.md](./TDD_POLICY.md) - Issue管理ルール詳細
- [issues.md](./issues.md) - 未完了Issue一覧

---

## 📚 完了Issue一覧

## RESET-005 | 機能改善: リセット機能の全面改修（「次の商品へ」機能） ✅ DONE (完了日: 2025-10-21)

### 📌 基本情報
- [x] カテゴリ: 機能改善
- [x] 優先度: 高
- [x] 影響範囲: リセット機能全体、商品登録ワークフロー
- [x] 要望日: 2025-10-21

### 💡 改善内容
現在のリセット機能を**「次の商品へ」機能**として全面改修。

**改善前の問題点：**
1. エラーが発生すると処理全体が中断される
2. 保持すべき項目とクリアすべき項目が混在
3. 1つの巨大な関数（300行超）で保守性が低い
4. デフォルト値の再適用が不安定
5. 部分的なリセット（割引情報・ハッシュタグ保持）が未実装

**改善後の効果：**
- ✅ 商品登録業務の効率化（設定を保持したまま次の商品へ）
- ✅ エラーに強い安定したリセット処理
- ✅ 保守性の高いモジュラー構造
- ✅ 明確なテストケースによる品質保証

### ✏️ 実装内容

#### 1. モジュラーアーキテクチャ (sp_scripts.html:3741-4214)

**新規関数：**
- `clearField(fieldId)` - 汎用フィールドクリア関数
- `resetManagementNumber()` - 管理番号ブロックリセット
- `resetBasicInfo()` - 基本情報ブロックリセット
- `resetProductName()` - 商品名ブロックリセット
- `resetProductDetails()` - 商品詳細ブロックリセット
- `resetDescriptionBlock()` - 商品説明の部分保持（割引情報・ハッシュタグ保持）
- `resetProcureListingInfo()` - 仕入・出品情報リセット
- `applyDefaultValuesAfterReset()` - デフォルト値再適用
- `updateAllPreviewsAfterReset()` - プレビュー更新
- `resetAttributeSections()` - 商品属性セクション初期化
- `resetColorSections()` - カラーセクション初期化
- `resetMaterialSections()` - 素材セクション初期化
- `resetSizeSection()` - サイズセクション初期化
- `resetProductImages()` - 商品画像クリア

**メインオーケストレーター：**
```javascript
function onReset() {
  // Phase 1: データクリア
  resetManagementNumber();
  resetBasicInfo();
  resetProductName();
  resetProductDetails();
  resetDescriptionBlock();
  resetProcureListingInfo();

  // Phase 2: デフォルト値再適用
  applyDefaultValuesAfterReset();

  // Phase 3: プレビュー更新
  updateAllPreviewsAfterReset();
}
```

#### 2. エラーハンドリング戦略
- 各関数が独立したtry-catchを持つ
- 1つのセクションでエラーが発生しても他のセクションの処理は継続
- コンソールに詳細なログを出力

#### 3. 商品説明の部分保持ロジック (sp_scripts.html:3887-3926)

**保持するコンテンツ：**
- 割引情報（`generateDiscountInfo()`から生成）
- ハッシュタグ（`generateHashtags()`から生成）

**クリアするコンテンツ：**
- 商品固有情報（商品説明本文）

**実装アプローチ：**
- 既存テキストの解析ではなく、設定から直接生成
- より確実でシンプルな実装

#### 4. 仕入・出品情報の処理 (sp_scripts.html:3932-3950)

**クリアするフィールド：**
- 仕入日、仕入先、仕入金額
- 出品日、出品先、出品金額

**保持するもの：**
- デフォルト値（日付・仕入先・出品先のデフォルト設定）

### 📐 設計方針

**原則：**
1. **関数の単一責任**: 各関数は1つのブロックのみを担当
2. **エラー分離**: エラーが他の処理に波及しない
3. **既存機能の活用**: `applyShippingDefaults()`, `applyProcureListingDefaults()`等を再利用
4. **デフォルト値の一元管理**: 設定マスタから読み込んだ値を使用

### 📝 関連Issue

**統合されたIssue：**
- RESET-001: 管理番号プレフィックス・棚番号が残る → ✅ 解決
- RESET-002: 商品名ブロックの情報が残る → ✅ 解決
- RESET-003: 商品の説明プレビューが消えない → ✅ 解決
- RESET-004: 配送方法・出品先のデフォルト値が消える → ✅ 解決

### 📊 実装規模

- **追加コード**: 約470行
- **新規関数**: 14個
- **修正ファイル**: sp_scripts.html
- **バックアップ**: `onReset_OLD()` として旧関数を保存

### 🧪 テスト結果

**実施したテスト：**
- ✅ Phase 1実装後の動作確認
- ✅ Phase 2（商品説明の部分保持）の動作確認
- ✅ 仕入・出品情報のリセット確認

**ユーザーフィードバック：**
> "難しい処理をうまくやったね。素晴らしい。ほぼほぼいい感じです。"

### 📦 デプロイ履歴

**Commit:**
1. `5535efa` - feat(RESET-005): Phase 2完了 - 商品説明の部分保持ロジック実装
2. `f3861c4` - fix(RESET-005): 仕入・出品情報のリセット処理を修正

**clasp push:** 2025-10-21 (48ファイル)

### 状態
- [x] ✅ DONE (完了日: 2025-10-21)

---

## BUG-001 | バグ: リセット処理でReferenceError発生 ✅ DONE (完了日: 2025-10-21)

### 📌 基本情報
- [x] カテゴリ: バグ修正
- [x] 優先度: 高
- [x] 影響範囲: リセット機能
- [x] 発見日: 2025-10-21

### 🐛 不具合内容
リセットボタンをクリックすると、以下のエラーが発生してリセット処理が中断される：

```
ReferenceError: Can't find variable: defaultSalesword
```

**エラー発生タイミング:**
- 商品登録後にリセットボタンをクリック
- エラーダイアログ「リセット処理中にエラーが発生しました。ページを再読み込みしてください。」が表示

### ✅ 期待動作
リセットボタンをクリックしても、エラーなく正常にリセット処理が完了する。

### 📍 関連ファイル
- `sp_scripts.html` (3122行目、3799-3804行目)

### 🐛 根本原因
- `defaultSalesword` がローカル変数として宣言されていた（3122行目）
- `onReset()` 関数からアクセスできないスコープにあった
- スコープ外の変数にアクセスしようとして ReferenceError が発生

### ✏️ 修正内容
- [x] defaultSaleswordをグローバル変数として宣言（190-191行目）
- [x] 他のグローバル変数（SALESWORD_FORMAT, CONDITION_HISTORYなど）と同じ場所に配置
- [x] ローカル宣言を削除（3125行目）
- [x] グローバル宣言への参照コメントを追加

**実装詳細:**
```javascript
// 190-191行目に追加
// デフォルトセールスワード設定
let defaultSalesword = null;

// 3125行目を変更
// 修正前: let defaultSalesword = null;
// 修正後: // defaultSalesword はグローバル変数として宣言済み（190行目）
```

### 📝 テスト結果
- [x] リセット処理が正常に完了することを確認
- [x] ReferenceErrorが発生しないことを確認

### 状態
- [x] ✅ DONE (完了日: 2025-10-21)

---

**完了Issue数: 2件**
**最終更新: 2025-10-21**
