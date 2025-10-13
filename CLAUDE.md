# REBORN プロジェクト - 開発ドキュメント

古着物販管理システム（Google Apps Script + スプレッドシート）

**完成度: 76%** | **商品登録: 100%** ✅ | **モバイル対応: 100%** ✅ | **タブナビゲーション: 100%** ✅ | **Google Sites埋め込み: 100%** ✅ ★NEW | **在庫管理: 0%** | **設定管理: 100%** ✅ | **売上分析: 20%** | **管理番号システム: 100%** ✅ | **ハッシュタグシステム: 100%** ✅ | **セールスワード設定: 100%** ✅ | **使い方ガイド: 100%** ✅ | **リセット機能: 100%** ✅ | **コピー機能: 100%** ✅ | **商品名並び替え: 100%** ✅ | **AI生成機能: 100%** ✅ | **Google Search Grounding: 100%** ✅ | **見出しスタイル: 100%** ✅ | **コード品質: 85%** 🔧

---

## 📋 目次

1. [プロジェクト概要](#プロジェクト概要)
2. [技術スタック](#技術スタック)
3. [ファイル構成（39ファイル）](#ファイル構成)
4. [実装済み機能](#実装済み機能)
5. [設定管理システム](#設定管理システム)
6. [データ構造](#データ構造)
7. [過去のトラブルと教訓](#過去のトラブルと教訓)
8. [開発ルール](#開発ルール)
9. [次の実装予定](#次の実装予定)

---

## プロジェクト概要

### ビジネス背景

古着の**仕入れからメルカリ等での販売**まで、物販事業の全工程を超効率化するシステム。非エンジニアがAI + ライブコーディングで開発中。

### 開発目標

- **短期**: 個人 + チームでの業務効率化
- **中期**: 単純作業の外注化、AIによる半自動出品
- **長期**: 同業者向けSaaS化（課金制ビジネス）

---

## 技術スタック

### コア技術

```
Google Apps Script (GAS)
├── バックエンド: JavaScript (ES6+)
├── データベース: Google スプレッドシート
├── フロントエンド: HTML Service + Bootstrap 5
└── デプロイ: clasp (Google Apps Script CLI)
```

### 開発環境

```
ローカル開発
├── エディタ: Visual Studio Code
├── バージョン管理: Git + GitHub (Private)
└── 同期ツール: clasp
```

### 開発ワークフロー

```bash
# 1. ローカルでコード編集（VSCode）

# 2. GASにプッシュ
clasp push

# 3. ウェブアプリにデプロイ（Apps Scriptエディタで手動操作）
# Apps Scriptエディタを開く: https://script.google.com/d/15gwr6oQUTLjdbNM_8ypqE0ao-7HCEJYrtU_CwJ-uN58PXg6Rhb4kYc71/edit
# 「デプロイ」→「デプロイを管理」→ ✏️ 鉛筆アイコン → 「新バージョン」→「デプロイ」

# 4. ブラウザでテスト（スーパーリロード: Cmd+Shift+R）
# スプレッドシートを開いて動作確認

# 5. 動作確認後、Gitにコミット
git add .
git commit -m "feat: 新機能追加"
git push origin main
```

**⚠️ デプロイ時の重要な注意事項：**
- **❌ `clasp deploy` は使用しない（「ライブラリ」に上書きされてしまう問題あり）**
- **✅ Apps Scriptエディタで手動デプロイのみ使用**
- 現在のウェブアプリデプロイID: `AKfycbxgrHJ5FkYiNDulGavakaHWSMxeBxz6nQ0db_RTalqWdPOx7HZpmGX70sbP9Z3hUvfd4g`
- ウェブアプリURL: `https://script.google.com/macros/s/AKfycbxgrHJ5FkYiNDulGavakaHWSMxeBxz6nQ0db_RTalqWdPOx7HZpmGX70sbP9Z3hUvfd4g/exec`
- このIDは2025年10月13日に作成

### ⚠️ 重要な注意事項

#### Claude Codeの会話圧縮後は必ず `clasp push` を確認

**症状**:
- Claude Codeとのチャットが長くなると「Conversation compacted」が表示される
- この画面に切り替わると、直前の変更が `clasp push` されていないことを忘れがち

**対策**:
1. **会話圧縮画面が表示されたら、まず `clasp push` の実行を確認**
2. ファイル変更後は必ず「clasp pushを実行してください」と明示的に依頼
3. 長時間作業する場合は、定期的に `clasp push` を実行

**確認方法**:
```bash
# 最後のpush以降の変更を確認
git status

# GASとローカルの差分を確認（clasp pull後に比較）
# ※注意: clasp pullは上書きするので必ずバックアップを取る
```

### Playwrightでのスプレッドシートアクセス方法 ★新規

Google Apps Scriptで作成したスプレッドシート連携アプリの動作確認に、Playwrightを使用できます。

#### アクセス手順

```bash
# 1. Apps Scriptエディタを開く
clasp open-script
# → URLが表示される: https://script.google.com/d/[scriptId]/edit

# 2. Playwrightでアクセス
# - Apps Scriptエディタにアクセス
# - 「概要」タブをクリック
# - 「コンテナ」セクションのスプレッドシートリンクをクリック
# → スプレッドシートにアクセス可能
```

#### ✅ 可能な操作

- **基本操作**: メニュークリック、タブ切り替え、ボタンクリック
- **スクリーンショット**: ページ全体・特定要素の画像取得
- **ページ状態確認**: URL、タイトル、スナップショット取得
- **メニュー操作**: 「物販管理システム」等のカスタムメニューの実行

#### ❌ 制約事項

**Google Apps ScriptのサンドボックスiFrame内の操作制限**:
- Same-origin policyにより、iframe内部の要素にJavaScriptで直接アクセス不可
- 設定管理UI、商品登録UI等のiframe内部の詳細操作は制限される
- 視覚的な確認（スクリーンショット）は可能

**具体的な制約**:
```javascript
// ❌ NG: iframe内の要素に直接アクセス
const button = iframe.contentDocument.querySelector('button');

// ✅ OK: スクリーンショットで視覚的に確認
await page.screenshot({ path: 'screenshot.png' });
```

#### 実用例

```javascript
// メニューからUIを開く
await page.getByRole('button', { name: '🗂️ マスタ・設定' }).click();
await page.getByRole('menuitem', { name: '⚙️ 設定管理' }).click();

// 少し待ってからスクリーンショット
await new Promise(f => setTimeout(f, 3000));
await page.screenshot({ path: 'settings.png' });
```

#### 推奨事項

- **動作確認は実際のブラウザで行う**: Playwrightは補助的な確認ツールとして使用
- **スクリーンショットで視覚的に確認**: iframe内の詳細は画像で確認
- **メニュー操作の確認には有効**: カスタムメニューの動作確認に利用

### 今後の統合予定

```
AI機能
├── Gemini API: 商品説明文自動生成
├── Gemini Vision API: 画像解析
└── 価格最適化提案

開発効率化ツール
├── Claude Code: AI駆動開発（導入済み）
├── Serena MCP: リポジトリ全体把握精度向上（導入済み）★重要
│   ├── シンボルベースでの正確な検索・編集
│   ├── 関数間の依存関係を漏れなく追跡
│   └── エラー大幅減少・開発速度向上
└── CLAUDE.md: 完全開発ドキュメント（このファイル）
```

---

## ファイル構成

### 全39ファイル構成

#### JSファイル（22個）

**コアシステム**
```
config.js                    # システム全体設定・FIELD_IDS定義
menu.js                      # メニュー表示・サイドバー制御（設定管理追加）
common.js                    # 共通ユーティリティ統合
utils.js                     # ユーティリティ（最小版）
error_handler.js             # 統一エラーハンドリングシステム
```

**商品管理**
```
product.js                   # 商品登録（列名ベースマッピング、管理番号設定対応）★重要
inventory.js                 # 在庫管理（検索・更新・利益計算）
id.js                        # 管理番号生成（柔軟な設定対応）
gemini_api.js                # Gemini API統合（AI商品説明文生成）★新規
```

**設定管理（新規）**
```
config_loader.js             # 設定マスタ読み込み・保存 ★最重要
setup_config.js              # 設定マスタシート自動生成
```

**マスタデータ管理**
```
master.js                    # マスタデータ取得 ★最重要
master_hierarchy.js          # セールスワード関連機能のみ
master_utils.js              # マスタ共通処理（シート名取得等）
master_simple.js             # 手動管理シート用シンプルマスタ取得
master_data_manager.js       # マスタデータ管理統括（軽量・安全版）
master_data_reducer.js       # データ削減システム（段階的実行版）
```

**最適化・検証**
```
performance_optimizer.js     # パフォーマンス最適化（キャッシュ機能）
data_integrity.js            # データ整合性確保（重複チェック等）
validation_enhancer.js       # 強化されたバリデーションシステム
diagnosis.js                 # システム診断
test_master.js               # テスト用
```

#### HTMLファイル（20個）

**メインUI**
```
sidebar_product.html         # 商品登録メインUI（テンプレート構造）
sidebar_config.html          # 設定管理UI（5タブ構成）★新規
sidebar_inventory.html       # 在庫管理サイドバー（最小版）
inventory_sidebar.html       # 在庫管理UIサイドバー
master_manager_ui.html       # マスタデータ管理UI
```

**スクリプト・スタイル**
```
dynamic_block_builder.html           # 動的ブロックビルダー（統一システム）★新規
dynamic_block_builder_styles.html    # 動的ブロックビルダー用スタイル ★新規
test_dynamic_block_builder.html      # 動的ブロックビルダーテスト ★新規
sp_scripts.html              # JavaScript処理（設定マスタ対応）★最重要・最大規模
sp_styles.html               # CSSスタイルシート（包括的）
```

**商品登録UIブロック（モジュラー設計）**
```
sp_block_manage.html         # 管理番号入力ブロック
sp_block_basic.html          # 基本情報入力ブロック
sp_block_title.html          # 商品名作成ブロック
sp_block_description.html    # 商品の説明ブロック
sp_block_shipping.html       # 配送情報ブロック
sp_block_procure.html        # 仕入情報ブロック
sp_block_listing.html        # 出品情報ブロック
sp_block_kodawari.html       # こだわり条件ブロック
```

---

## 実装済み機能

### 1. 商品登録（100%完成）✅

#### ✨ AI商品説明文生成（Gemini API統合）★新規完成 ✅

**概要**:
Gemini APIを活用して、商品情報から魅力的な商品説明文を自動生成する革新的機能。

**完成度**: 100% ✅
**実装日**: 2025年10月12日

**主要機能**:
- ✨ **ワンクリックでAI生成**: 「✨ AI生成」ボタンをクリックするだけ
- 📝 **高品質な説明文**: 200〜300文字の購買意欲を高める文章
- 🎨 **自動情報収集**: 入力済みの商品情報を自動で読み取り
- ✏️ **編集可能**: 生成後も自由に編集可能

**生成される内容**:
1. 商品の特徴・アピールポイント
2. おすすめコーディネート提案
3. 着用シーン提案
4. 自然で読みやすい文章

**収集される商品情報**:
- ブランド名（英語・カナ）
- アイテム名
- カテゴリ（大分類 > 中分類 > 小分類）
- サイズ（表記）
- 商品の状態
- 素材（箇所・種類・割合）
- カラー（複数選択可）

**UI設計**:
- 紫のグラデーションボタン（目立つデザイン）
- ローディング表示（⏳ 生成中...）
- 成功メッセージ（✅ AI説明文を生成しました！）
- 詳細なエラーメッセージ（APIキー未設定時の設定手順表示）

**技術仕様**:
- **使用モデル**: `gemini-2.0-flash-exp`（最新・高速）
- **APIバージョン**: `v1beta`
- **生成時間**: 5〜10秒
- **セキュリティ**: APIキーはScript Propertiesで安全に管理

**実装ファイル**:
- `gemini_api.js` (lines 1-331) - APIコア機能
- `sp_block_description.html` (lines 5-8) - AI生成ボタン
- `sp_scripts.html` (lines 2440-2611) - フロントエンド処理

**主要関数**:
```javascript
// gemini_api.js
function generateProductDescription(productInfo)  // メイン生成関数
function buildDescriptionPrompt(productInfo)      // プロンプト構築
function callGeminiApi(prompt)                    // API呼び出し

// sp_scripts.html
function generateAiDescription()                  // ボタンクリック処理
function collectProductInfo()                     // 商品情報収集
```

**生成例**:
```
ご覧いただきありがとうございます！
UNIQLO定番のスウェットパーカー、Mサイズをほぼ未使用の状態で出品いたします。

コットン100%の柔らかな肌触りで、着心地抜群。シンプルながらも洗練されたデザインは、
どんなスタイルにも合わせやすい万能アイテムです。

おすすめのコーディネートは、デニムやチノパンと合わせた定番カジュアルスタイル。
インナーにシャツを合わせれば、少し上品な印象にもなります。

週末のリラックスタイムや、ちょっとしたお出かけにもぴったり♪
一枚持っていると重宝すること間違いなしです。
```

**ユーザー反応**:
> 「やばすぎますこれは！！」（2025年10月12日）

---

#### 管理番号自動採番機能（拡張版）

**柔軟な設定対応**:
- 棚番号の使用/不使用を選択可能
- 棚番号形式: アルファベット2文字(AA-ZZ)、1文字(A-Z)、数字2桁(01-99)、数字3桁(001-999)、自由入力
- 区切り文字: 任意（`-`, `_`, 空欄など）
- 商品番号桁数: 3〜6桁（ゼロパディング）
- 商品番号開始値: 任意の数値

**対応例**:
- `AA-1001` (デフォルト)
- `A_001` (アルファベット1文字、区切り`_`、3桁)
- `01-00001` (数字2桁、区切り`-`、5桁)
- `RACK-A-0001` (自由入力、区切り`-`、4桁)
- `1001` (棚番号なし、商品番号のみ)

**実装ファイル**: `id.js`, `product.js`, `sp_block_manage.html`, `config_loader.js`

---

### 🏷️ 管理番号システム（完全リニューアル版）✅ ★最重要機能

#### 概要

セグメント方式による超柔軟な管理番号生成システム。商品登録と設定管理の両面で完全実装。

**完成度**: 100% ✅
**実装期間**: 2025年（Serena MCP導入後、開発効率が飛躍的に向上）

#### 1. セグメントベースアーキテクチャ

管理番号を複数の「セグメント」で構成し、各セグメントが独立して設定・生成される設計。

**7種類のセグメントタイプ**:

| セグメント | 説明 | 例 | 入力方法 |
|----------|------|-----|---------|
| `category` | カテゴリコード | K, O, C | ユーザー入力 |
| `date` | 登録日 | 251007, 20251007 | 自動生成 |
| `rank` | 品質ランク | A, B, C | ユーザー入力 |
| `size` | サイズコード | S, M, L | ユーザー入力 |
| `color` | 色コード | BK, WH, RD | ユーザー入力 |
| `sequence` | 連番 | 001, 1001 | 自動採番 |
| `custom` | カスタム値 | AA, BB, RACK-A | ユーザー選択 |

**設定可能項目**:
- 各セグメントの有効/無効
- 区切り文字（`-`, `_`, 空欄など）
- 連番の桁数（3〜6桁）
- 連番の開始値（任意）
- カスタム値のデフォルト値

**実装ファイル**: `id.js` (lines 1-263), `config_loader.js` (lines 80-98, 393-406)

#### 2. 商品登録側の機能

**動的セグメント入力フィールド**:
- 設定マスタに基づいて自動生成
- `custom`タイプは2段階プルダウン（頭文字 → 棚番号）
- リアルタイムプレビュー更新

**例: AA-ZZ 棚番号の2段階選択**:
```
頭文字: [A▼]  →  棚番号: [AA▼ AB▼ AC▼ ... AZ▼]
```
- 26 + 26 = 52回の選択（vs 676回の選択）
- UX大幅改善

**使用可能な管理番号表示**:
- 読み取り専用フィールド
- 左詰め表示、グレー背景
- 上下ボタンで手動調整可能

**上下ボタンによる番号調整**:
- ▲ボタン: 番号を1つ増やす
- ▼ボタン: 番号を1つ減らす（スマートバリデーション付き）

**スマートバリデーション**:
- ▼ボタン押下時、サーバーに問い合わせ
- `getMinAvailableNumber()` で使用済み番号を確認
- 実際に使用可能な番号までしか下げられない
- ボタン無効化でフィードバック

**実装ファイル**:
- `sp_block_manage.html` (lines 1-27)
- `sp_scripts.html` (lines 700-962)
- `id.js` (lines 209-263: `getMinAvailableNumber()`)

**主要関数**:
```javascript
// sp_scripts.html
function renderManagementNumberFields(segments)  // 動的UI生成
function updateManagementNumberPreview()         // プレビュー更新
function adjustManagementNumber(delta)           // 番号調整

// id.js
function generateSegmentBasedManagementNumber(userInputs)  // 管理番号生成
function getNextSequenceNumber(prefix, config)             // 連番取得
function getMinAvailableNumber(prefix, digits, currentNumber)  // 最小番号
```

#### 3. 設定管理側の機能

**プリセットシステム** ★目玉機能:
- ワンクリックで一般的なパターンを適用
- 5種類のプリセット（アイコン・例付き）
- 適用後にカスタマイズ可能（ディープコピー）

**プリセット一覧**:

| プリセット | 説明 | 例 | アイコン |
|----------|------|-----|---------|
| シンプル連番 | 連番のみ | 1001, 1002, 1003 | 🔢 |
| 棚番号 + 連番 | 棚管理向け | AA-1001, BB-1001 | 📦 |
| カテゴリ + 日付 + 連番 | 日付管理 | K-251007-001 | 📅 |
| 棚番号 + 日付 + 連番 | 棚×日付 | AA-251007-001 | 🗓️ |
| カテゴリ + ランク + 連番 | 品質管理 | K-A-001 | ⭐ |

**セグメント編集機能**:
- 「+ セグメントを追加」ボタン
- 各セグメントを個別に削除可能
- ドラッグ&ドロップ並び替え（未実装、将来予定）

**リアルタイムプレビュー**:
- 設定変更時に即座に反映
- フォントサイズ18px、左詰め
- レター間隔1px

**保存機能**:
- JSON形式でスプレッドシートに保存
- キャッシュ自動クリア
- 成功通知とエラーハンドリング

**実装ファイル**:
- `management_number_builder.html` (全体)
- `sidebar_config.html` (lines 355-360: 保存ボタン)
- `config_loader.js` (lines 80-98, 393-406)

#### 4. データフロー

```
┌─────────────────────────────────────────────────────────┐
│ 設定マスタシート                                         │
│ ├── カテゴリ: 管理番号設定                               │
│ └── 項目1: segments                                      │
│     └── 値: [{"type":"custom","config":{"value":"AA"}...}] │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ config_loader.js                                         │
│ ├── loadConfigMaster() でJSON解析                        │
│ └── 5分間キャッシュ                                      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ 商品登録UI (sp_scripts.html)                             │
│ ├── renderManagementNumberFields()                       │
│ │   └── セグメント設定からUI自動生成                     │
│ ├── updateManagementNumberPreview()                      │
│ │   └── ユーザー入力値を収集                             │
│ └── ユーザー入力: { custom: "AA", ... }                  │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ id.js (generateSegmentBasedManagementNumber)             │
│ ├── セグメントごとに値を生成                             │
│ │   ├── custom → ユーザー入力値 (AA)                     │
│ │   ├── date → formatDate()                              │
│ │   └── sequence → getNextSequenceNumber()               │
│ │       └── プレフィックス "AA" で既存番号を検索         │
│ │           └── 未使用の最小番号を返す (1001)            │
│ └── 区切り文字で結合: "AA-1001"                          │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│ スプレッドシート「在庫/売上管理表」                       │
│ └── 管理番号列に "AA-1001" を保存                        │
└─────────────────────────────────────────────────────────┘
```

#### 5. 独立した連番管理

**プレフィックスベースの採番**:
- 各プレフィックスごとに独立して連番を管理
- 例: AA-1001, AA-1002 / BB-1001, BB-1002
- 正規表現マッチングで既存番号を検索

**実装コード** (id.js lines 160-177):
```javascript
const pattern = prefix
  ? `^${escapeRegex(prefix)}-?(\\d+)$`
  : `^(\\d+)$`;
const re = new RegExp(pattern, 'i');

for (const v of vals) {
  const s = String(v || '').trim();
  const m = s.match(re);
  if (!m) continue;

  const num = parseInt(m[1], 10);
  if (!Number.isNaN(num) && num >= startValue) {
    used.add(num);
    if (num > maxSeen) maxSeen = num;
  }
}
```

**未使用番号の探索**:
- 使用済み番号をSetで管理
- 最小未使用番号を線形探索
- 欠番があれば優先的に埋める

#### 6. 2段階プルダウンの実装

**課題**: AA-ZZ (676通り) のプルダウンは選択が大変

**解決策**: 頭文字 (26通り) → 2文字目 (26通り) の2段階選択

**実装** (sp_scripts.html lines 786-858):
```javascript
// 頭文字の選択肢を生成（A-Z）
let firstCharOptions = '<option value="">--選択--</option>';
for (let i = 65; i <= 90; i++) {
  const char = String.fromCharCode(i);
  firstCharOptions += `<option value="${char}">${char}</option>`;
}

// 頭文字選択時に2文字目を更新
document.getElementById('mgmt_custom_first').addEventListener('change', function() {
  const firstChar = this.value;
  const secondSelect = document.getElementById('mgmt_custom_second');

  if (!firstChar) {
    secondSelect.innerHTML = '<option value="">--選択--</option>';
    secondSelect.disabled = true;
  } else {
    let secondOptions = '<option value="">--選択--</option>';
    for (let i = 65; i <= 90; i++) {
      const char = String.fromCharCode(i);
      secondOptions += `<option value="${char}">${firstChar}${char}</option>`;
    }
    secondSelect.innerHTML = secondOptions;
    secondSelect.disabled = false;
  }
  updateManagementNumberPreview();
});
```

**ユーザー体験**:
- 最大26回の選択で済む（676 → 26 + 26）
- 視覚的にわかりやすい階層構造
- 無効状態でUIフィードバック

#### 7. プリセットシステムのアーキテクチャ

**ディープコピー戦略**:
```javascript
function applyPreset(presetName) {
  const preset = MANAGEMENT_NUMBER_CONFIG.presets[presetName];
  if (!preset) return;

  // ディープコピーでプリセットを複製
  MANAGEMENT_NUMBER_CONFIG.segments = JSON.parse(JSON.stringify(preset));

  renderSegments();
  updatePreview();
}
```

**メリット**:
- プリセット適用後もカスタマイズ可能
- 元のプリセットテンプレートは不変
- ユーザーが自由に編集できる

#### 8. Serena MCPの貢献 ★重要

**導入効果**:
- エラー大幅減少（ほぼゼロ）
- 開発速度向上（2〜3倍）
- 関数間の依存関係を正確に追跡
- シンボルベースでの正確な検索・編集

**ユーザーコメント**:
> "大体何かしらエラーが起きてたんですが、やはりSerena MCPを導入したのも結構よかったですね。"

**具体例**:
- `_findIdx()` のような内部関数も漏れなく検索
- `getMinAvailableNumber()` の新規追加時に依存関係を正確に把握
- 複数ファイルにまたがる変更を一貫して実行

#### 9. 後方互換性

**旧システムとの共存**:
```javascript
// id.js lines 265-299
function getNextManagementNumber(shelfCode) {
  const mgmtConfig = getManagementNumberConfig();

  // セグメント設定がある場合は新方式
  if (mgmtConfig.segments && mgmtConfig.segments.length > 0) {
    return generateSegmentBasedManagementNumber({ category: shelfCode });
  }

  // 旧方式（棚番号+連番）
  const useShelf = String(mgmtConfig['棚番号使用'] || '').toLowerCase() === 'true';
  // ... 旧ロジック継続
}
```

**移行パス**:
- 既存データは影響なし
- 設定マスタに`segments`がない場合は旧方式
- 段階的な移行が可能

#### 10. テスト済みシナリオ

✅ AA-ZZ すべての棚番号で採番確認
✅ プレフィックスごとに独立した連番
✅ 欠番がある場合の最小番号取得
✅ 上下ボタンでの手動調整
✅ ▼ボタンの使用済み番号バリデーション
✅ プリセット5種類すべて適用・カスタマイズ
✅ 設定保存・読み込み・キャッシュクリア
✅ 2段階プルダウンの動作
✅ リアルタイムプレビュー更新
✅ エラーハンドリング（NG()プレフィックス）

#### 11. 残課題・将来予定

- [ ] セグメントのドラッグ&ドロップ並び替え
- [ ] プリセットのユーザー登録機能
- [ ] 管理番号の一括変更ツール
- [ ] 履歴管理・ロールバック機能

---

#### 分類カテゴリ6階層プルダウン

- 大分類 → 中分類 → 小分類 → 細分類1 → 細分類2 → アイテム名
- 階層連動（上位選択で下位が有効化）
- サイズ詳細入力機能に連動

**データ件数**: 1,686件（手動管理_アイテム分類）
**実装ファイル**: `master.js`, `sp_scripts.html`, `sp_block_basic.html`

#### ブランド名2段式表示オートコンプリート機能

- 英語50,000 + カナ50,000 = 合計100,000超の候補から瞬時に検索
- 大文字小文字区別なし、部分マッチ可能
- 最大15件表示
- 2行表示（英語名 + カナ読み）
- メルカリと同様のUI

**データ件数**: 52,667件（手動管理_ブランド）
**実装ファイル**: `master.js`, `sp_scripts.html`, `sp_styles.html`

#### 商品名選択式自動作成 + ドラッグ&ドロップ並び替え ★完成 ✅

- リアルタイムプレビュー（入力中に即座に反映）
- 40文字カウンター（超過時警告）
- SEO最適化された商品名の半自動生成

**構成要素**:
1. セールスワード
2. ブランド名（英語/カナ）
3. アイテム名
4. 商品属性（動的追加可能）

**ドラッグ&ドロップ並び替え機能** ★新規完成 ✅:
- ⋮⋮ ドラッグハンドルで各ブロックを自由に並び替え
- セールスワード、ブランド情報、アイテム名、商品属性のすべてを自由配置
- 設定マスタに並び順を保存、次回起動時も同じ順序で表示
- リアルタイムプレビュー更新（並び替えに応じて即座に反映）
- 後方互換性：古い設定データを自動的に最新形式に移行

**アイテム名の独立ブロック化** ★新規完成 ✅:
- 基本情報で選択したアイテム名を自動反映
- 自由にテキスト編集可能（略称などに変更可）
- 他のブロックと同様にドラッグ&ドロップで並び替え可能

**実装ファイル**:
- `sp_scripts.html` (lines 112, 1911-2092): ドラッグ&ドロップロジック、並び順保存/読み込み
- `sp_block_title.html` (lines 24-130): ドラッグ可能ブロック構造
- `config_loader.js` (lines 142-151, 290-331): 商品名ブロック並び順の保存/取得

#### セールスワード連動選択

- 19カテゴリ × 連動キーワード
- カテゴリ選択でキーワードが自動更新
- 商品名プレビューに自動反映

**実装ファイル**: `master.js`, `sp_scripts.html`

#### 商品の説明選択式自動作成（設定マスタ対応）

- リアルタイムプレビュー
- 1000文字カウンター（超過時警告）

**自動生成される要素**:
1. ブランド情報
2. サイズ情報（実寸）
3. 素材情報
4. 商品状態（詳細）
5. オリジナルハッシュタグ（設定可能）
6. 割引情報（設定可能）

**実装ファイル**: `sp_scripts.html`, `sp_block_description.html`, `config_loader.js`

#### ハッシュタグ自動生成（設定可能）

**設定項目**:
- 全商品プレフィックス（例: `#REBORN_`）
- 全商品テキスト（例: `全商品`）
- ブランドプレフィックス・サフィックス
- カテゴリプレフィックス・サフィックス

**生成例**:
```
#REBORN_全商品
#REBORN_UNIQLOアイテム一覧
#REBORN_トップス一覧
#REBORN_レディースアイテム一覧
#REBORN_レディーストップス一覧
```

**実装ファイル**: `sp_scripts.html`, `config_loader.js`

#### 割引情報自動挿入（設定可能）

**設定項目**:
- フォロー割: 範囲と割引額（複数設定可）+ 説明文
- リピート割: 割引額 + 説明文
- まとめ割: 範囲と割引額（複数設定可）+ 説明文

**デフォルト例**:
```
【お得な割引情報】

■ フォロー割
〜2,999円 ⇒ 100円引
〜5,999円 ⇒ 200円引
〜8,999円 ⇒ 300円引
9,000円〜 ⇒ 500円引

■ リピート割
次回購入時に200円引
「リピート割希望」とコメントにてお知らせください。

■ まとめ割
2点⇒300円引
3点⇒500円引
4点以上⇒1,000円引
購入したい商品が複数ある場合、コメントにてお知らせください。
```

**特徴**:
- すべての割引を削除すると、割引情報セクション全体が非表示
- 説明文は設定マスタで自由に編集可能

**実装ファイル**: `sp_scripts.html`, `config_loader.js`, `sidebar_config.html`

#### 配送についてブロック（設定可能）

**設定項目**:
- 配送料の負担: プルダウン選択
- 配送の方法: プルダウン選択（10種類以上）
- 発送元の地域: プルダウン選択（全47都道府県）
- 発送までの日数: プルダウン選択

**デフォルト値**:
- 配送料の負担: 送料込み(出品者負担)
- 配送の方法: ゆうゆうメルカリ便
- 発送元の地域: 岡山県
- 発送までの日数: 1~2日で発送

**実装ファイル**: `sp_block_shipping.html`, `sp_scripts.html`, `config_loader.js`

---

### 2. モバイル対応（100%完成）✅ ★NEW

#### 📱 概要

スマートフォンのブラウザから商品登録システムにアクセス可能に。PC版と同じフル機能をモバイルで利用できるようになり、将来のSaaS化に向けた重要な基盤が完成。

**完成度**: 100% ✅
**実装日**: 2025年10月13日
**所要時間**: 約6時間（複数の技術的問題を解決）

#### ✨ 主要機能

1. **Web Appデプロイ経由でのアクセス**
   - Google Apps ScriptのWeb App機能を活用
   - スマホのブラウザから直接アクセス可能
   - URLを共有すれば誰でもアクセス可能（権限設定：全員）

2. **レスポンシブデザイン**
   - viewport設定によりスマホ画面に最適化
   - タッチ操作しやすいボタンサイズ（最小44x44px）
   - 読みやすいフォントサイズ（16px以上）
   - iOS自動ズーム防止

3. **フル機能対応**
   - ✅ 52,000件のブランドオートコンプリート
   - ✅ 6階層カテゴリプルダウン
   - ✅ 管理番号自動採番
   - ✅ AI商品説明文生成
   - ✅ リアルタイムプレビュー
   - ✅ すべての入力・保存機能

4. **動作確認済み**
   - 入力フィールドの操作
   - プルダウン選択
   - ボタンタップ
   - スクロール操作
   - データ保存

#### 🔧 実装の詳細

**viewport設定（GAS専用の方法）**:
```javascript
// ❌ 通常のHTML（動かない）
<meta name="viewport" content="width=device-width, initial-scale=1.0">

// ✅ GAS専用の方法
return HtmlService.createHtmlOutput(html)
  .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
  .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
```

**モバイル最適化CSS**:
```css
@media screen and (max-width: 768px) {
  body { font-size: 14px; padding: 16px; }
  button { min-height: 44px; font-size: 15px; }
  input, select, textarea { font-size: 16px; min-height: 44px; }
}
```

**絶対URLの使用**:
```javascript
// ❌ 相対パス（動かない）
<a href="?menu=product">商品登録</a>

// ✅ 絶対URL
const baseUrl = ScriptApp.getService().getUrl();
<a href="${baseUrl}?menu=product">商品登録</a>
```

#### 🚀 アクセス方法

1. **Web App URL**:
```
https://script.google.com/macros/s/AKfycbxgrHJ5FkYiNDulGavakaHWSMxeBxz6nQ0db_RTalqWdPOx7HZpmGX70sbP9Z3hUvfd4g/exec
```

2. **メニュー指定**:
```
?menu=test           # テストページ
?menu=product-simple # シンプル商品登録
?menu=product        # フル機能商品登録
?menu=config         # 設定管理
```

3. **スマホでアクセス**:
- 上記URLをスマホに送ってブラウザで開く
- または、Apps Scriptエディタの「デプロイを管理」からURLをコピーして開く

#### 📊 ビジネスインパクト

**SaaS化への重要な一歩**:
- 多くの物販初心者・副業者はスマホで作業
- モバイル対応は競合との大きな差別化要素
- PCに限定せず、より多くのユーザーにリーチ可能
- 外出先での商品登録・在庫確認が可能に

**開発者コメント**:
> "本当に諦めずにチャレンジしてよかったです。何度もエラーに直面しましたが、非エンジニアとAIの合わせ技で乗り越えられました。"

#### 🎯 今後の改善予定

- UI/UX の細かい調整（ボタン配置、スクロール動作など）
- タッチジェスチャーの最適化
- オフライン対応（PWA化）検討
- モバイル専用の簡易入力モード

**実装ファイル**: `menu.js`, `sp_styles.html`

---

#### 🌐 Google Sites埋め込み（100%完成）✅ ★NEW

**概要**:
Web App URLに表示される警告メッセージ「このアプリケーションはGoogle Apps Scriptのユーザーによって作成されたものです」を削除するため、Google Sitesに埋め込みを実施。

**完成度**: 100% ✅
**実装日**: 2025年10月14日
**所要時間**: 約30分

**主要機能**:

1. **警告メッセージの削除** ✅
   - Google Sitesに埋め込むことで、警告メッセージが表示されなくなる
   - プロフェッショナルな見た目を実現
   - ユーザーに安心感を与える

2. **公開URL**
   ```
   https://sites.google.com/view/reborn-system
   ```

3. **埋め込み方法**
   - iframe形式で埋め込み
   - 高さ: 2000px（全体が見えるように設定）
   - 幅: 100%

4. **動作確認済み**
   - ✅ PCでの表示・操作（スクロール、タブ切り替え正常）
   - ✅ スマホでの表示・操作（全機能正常動作）
   - ✅ 警告メッセージなし
   - ✅ すべての機能が正常に動作

**実装コード**:
```html
<iframe
  src="https://script.google.com/macros/s/AKfycbxgrHJ5FkYiNDulGavakaHWSMxeBxz6nQ0db_RTalqWdPOx7HZpmGX70sbP9Z3hUvfd4g/exec"
  width="100%"
  height="2000"
  style="border: none;">
</iframe>
```

**トレードオフ**:
- **直接Web App URL**:
  - ❌ 警告メッセージあり
  - ✅ 余白なし、画面いっぱいに表示

- **Google Sites経由**（採用）:
  - ✅ 警告メッセージなし
  - ⚠️ Google Sitesの余白あり（左右に少しスペース）
  - ✅ プロフェッショナルな見た目
  - ✅ 将来のSaaS化に向けて最適

**ビジネスインパクト**:
- チームメンバーや外注スタッフに安心して共有できる
- 警告メッセージによる心理的ハードルを排除
- SaaS化に向けた重要な一歩

**今後の改善予定**:
- カスタムドメイン設定（Google Workspace有料版で可能）
- PWA化でアプリのようにインストール可能に

---

### 3. タブナビゲーション（100%完成）✅ ★NEW

#### 📱 概要

本格的なWebアプリUIとして、タブナビゲーションを実装。メインメニューを経由せず、ページ間を直接切り替え可能に。

**完成度**: 100% ✅
**実装日**: 2025年10月13日
**所要時間**: 約30分

#### ✨ 主要機能

1. **2行構成ヘッダー**
   - 1行目: 🔄 REBORN + 👤アイコン（将来的にログインユーザー情報）
   - 2行目: タブ（商品登録、設定、在庫管理、売上）

2. **タブ切り替え**
   - 商品登録 ⇔ 設定管理を直接切り替え
   - アクティブタブは白背景で強調表示
   - 未実装機能は半透明で無効化

3. **デフォルトページ変更**
   - URLパラメータなしでアクセス → 商品登録画面
   - メインメニュー画面は残すが不要に

4. **スマホ対応**
   - 横スクロール対応
   - タッチ操作に最適化
   - グラデーション背景（紫系）

#### 🔧 実装の詳細

**デザイン**:
```
┌─────────────────────────────────────┐
│ 🔄 REBORN                      👤   │ ← 1行目（システム名）
├─────────────────────────────────────┤
│ [📝 商品登録] [⚙️ 設定] [📦在庫] [📈売上] │ ← 2行目（タブ）
└─────────────────────────────────────┘
```

**CSS**:
```css
.tab-nav-header {
  position: sticky;
  top: 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  z-index: 1000;
}

.tab-nav-tab.active {
  background: white;
  color: #667eea;
  font-weight: 600;
}
```

**アクティブタブ判定**:
- 商品登録: `sidebar_product.html`で「📝 商品登録」がactive
- 設定管理: `sidebar_config.html`で「⚙️ 設定」がactive

#### 📊 UX改善

**変更前（案1）**:
```
商品登録 → 戻るボタン → メインメニュー → 設定管理
```

**変更後（案3）**:
```
商品登録 → タブタップ → 設定管理
```

- ✅ **1回のタップで切り替え**
- ✅ **メインメニュー不要**
- ✅ **本格的なWebアプリUI**
- ✅ **SaaS化に向けた基盤**

#### 🎯 今後の拡張

- 在庫管理・売上分析の実装時、タブを有効化するだけ
- ログインユーザー情報の表示（👤アイコン）
- タブのドロップダウンメニュー（サブメニュー）

**実装ファイル**: `mobile_header.html`, `sidebar_product.html`, `sidebar_config.html`, `menu.js`

---

### 4. 設定管理システム（100%完成）★完成 ✅

#### 概要

非エンジニアでも簡単に各種設定を変更できるUI。SaaS化の基盤となる重要機能。

#### メニュー構成

「物販管理システム」→「⚙️ 設定管理」から8タブ構成のUIを開く

**タブ一覧**（2025年10月12日更新）:
1. 🔢 管理番号設定（デフォルト選択）
2. 💬 セールスワード設定
3. 🔘 商品状態ボタン設定
4. 💰 割引情報設定
5. 🏷️ ハッシュタグ設定
6. 📦 配送デフォルト設定
7. 📅 仕入・出品デフォルト設定 ★新規
8. 📖 使い方ガイド

#### 1. 商品状態ボタン設定

**機能**:
- 商品の状態（6種類）ごとにクイック挿入ボタンを設定
- ボタンラベル、ボタンテキストを自由に編集
- ボタンの追加・削除が可能

**対応する商品の状態**:
- 新品、未使用
- 未使用に近い
- 目立った傷や汚れなし
- やや傷や汚れあり
- 傷や汚れあり
- 全体的に状態が悪い

**実装ファイル**: `sidebar_config.html`, `config_loader.js`

#### 2. ハッシュタグ設定 ★完成 ✅

**概要**:
動的にハッシュタグを追加・編集・並び替えできる高機能システム。商品説明の最後に自動挿入される。

**主要機能**:

1. **動的ハッシュタグ追加**
   - 5種類のハッシュタグタイプ: 🌐 全商品、👔 ブランド、📁 カテゴリ、🎨 カラー、📏 サイズ
   - タイプ選択メニューから追加
   - 個別の削除も可能

2. **ドラッグ&ドロップ並び替え**
   - ⋮⋮ アイコンをドラッグして順序変更
   - 管理番号システムと同様のUI
   - 視覚的フィードバック付き

3. **共通プレフィックス設定**
   - すべてのハッシュタグに共通の接頭辞（例: `#REBORN_`）
   - リアルタイムプレビュー更新

4. **サフィックスのカスタマイズ**
   - プルダウン選択: 一覧、アイテム一覧、商品一覧、コレクション
   - カスタム入力も可能

5. **カテゴリの複数選択**
   - 大分類、中分類、小分類、細分類1、細分類2、アイテム名から選択
   - 複数選択で連結（例: `#REBORN_メンズトップス一覧`）
   - デフォルト: 大分類のみ

6. **プレビュー表示**
   - 具体例付き（UNIQLO、メンズ、黒、M など）
   - 「例:」ラベルで分かりやすく

7. **すべてクリアボタン**
   - 🗑️ ボタンで一括削除
   - 確認ダイアログ付き

**生成例**:
```
#REBORN_全商品
#REBORN_UNIQLOアイテム一覧
#REBORN_メンズ一覧
#REBORN_黒一覧
#REBORN_M一覧
```

**実装ファイル**:
- `sidebar_config.html` (UI)
- `config_loader.js` (設定読み込み・保存)
- `sp_scripts.html` (ハッシュタグ生成ロジック)

**セールスワード設定（よく使うセールスワード設定）**: ★新規完成 ✅

**概要**:
マスタデータから2段式プルダウンでセールスワードを選択・登録できるシステム。テキスト入力ではなく、既存の値から選択することで、タイポを防ぎ、一貫性を保つ。

**主要機能**:

1. **2段式プルダウン選択**
   - カテゴリプルダウン（1段目）: セールスワードのカテゴリを選択
   - セールスワードプルダウン（2段目）: カテゴリに応じたセールスワードを選択
   - カテゴリ選択時に、セールスワードプルダウンが自動更新

2. **登録・削除機能**
   - 「+ 追加」ボタンで選択したセールスワードを登録
   - 重複チェック付き（同じセールスワードは追加不可）
   - 登録済みリストに読み取り専用で表示
   - 個別の削除ボタンあり

3. **マスタデータ連携**
   - `getSaleswordHierarchy()` 関数でマスタデータから階層構造を取得
   - マスタデータの「セールスワード(カテゴリ)」と「セールスワード」列を参照
   - ページ読み込み時に自動でマスタデータを取得

4. **UI/UX**
   - 2段階選択で迷わず選択可能
   - プルダウンリセット（追加後に自動クリア）
   - 登録済みリストは番号付きで見やすく表示

**実装箇所**:
- `sidebar_config.html` (lines 450-477: UI)
- `sidebar_config.html` (lines 2505-2595: JavaScript)
- `master.js` (lines 301-316: `getSaleswordHierarchy()`)
- `config_loader.js` (設定読み込み・保存)

**データフロー**:
```
マスタデータシート
└── セールスワード(カテゴリ) / セールスワード列
      ↓
getSaleswordHierarchy() (master.js)
      ↓
{ "カテゴリ1": ["ワード1", "ワード2"], "カテゴリ2": [...] }
      ↓
loadSaleswordMasterData() (sidebar_config.html)
      ↓
カテゴリプルダウン初期化
      ↓
ユーザーがカテゴリ選択
      ↓
updateSaleswordOptions() でセールスワードプルダウン更新
      ↓
ユーザーがセールスワード選択 → 「+ 追加」ボタン
      ↓
addSaleswordFromDropdown() で登録（重複チェック）
      ↓
SALESWORD_LIST に保存 → 設定マスタに保存
```

**実装日**: 2025年10月11日

#### 3. 割引情報設定

**設定項目**:

**フォロー割**:
- 範囲と割引額（複数設定可）
- 説明文（任意）

**リピート割**:
- 割引額
- 説明文（任意）

**まとめ割**:
- 範囲と割引額（複数設定可）
- 説明文（任意）

**特徴**:
- すべてフリーテキスト入力
- 範囲追加・削除ボタンあり
- 説明文はデフォルト値が表示され、そのまま編集可能

**実装ファイル**: `sidebar_config.html`, `config_loader.js`, `sp_scripts.html`

#### 4. 配送デフォルト設定

**設定項目**:
- 配送料の負担（プルダウン）
- 配送の方法（プルダウン: 10種類以上）
- 発送元の地域（プルダウン: 全47都道府県）
- 発送までの日数（プルダウン）

**実装ファイル**: `sidebar_config.html`, `config_loader.js`

#### 5. 仕入・出品デフォルト設定 ★新規完成 ✅

**概要**:
商品登録時の仕入日・出品日を自動入力するための設定。「常に今日の日付を使用」と「固定日付」の2つのモードを選択可能。

**設定項目**:

**デフォルトの仕入日**:
- ☑ 「常に今日の日付を使用」チェックボックス
  - チェック時: 毎日自動で今日の日付に更新
  - 未チェック時: 固定日付を使用
- 📅 日付入力フィールド（カレンダー）
  - チェック時は無効化（グレーアウト）
  - 未チェック時は有効化

**デフォルトの出品日**:
- ☑ 「常に今日の日付を使用」チェックボックス
- 📅 日付入力フィールド（カレンダー）

**デフォルトの仕入先**:
- プルダウン選択（マスタデータから取得）

**デフォルトの出品先**:
- プルダウン選択（マスタデータから取得）

**使い分けの例**:
- 仕入日: 固定日付（過去の一括仕入れなど）
- 出品日: 「常に今日」をチェック（毎日の出品作業）

**実装ファイル**:
- `sidebar_config.html` (lines 453-509, 3228-3262, 3314-3325): UI + トグル関数 + 収集関数
- `sp_scripts.html` (lines 1253-1313): デフォルト値適用ロジック
- `config_loader.js` (lines 242-257): 設定読み込み・保存

**実装日**: 2025年10月12日

#### 6. 管理番号設定 ★高度な機能

**設定項目**:

**棚番号の使用**:
- チェックボックスで有効/無効を切り替え

**棚番号の形式**（棚番号使用時のみ）:
- アルファベット2文字 (AA-ZZ)
- アルファベット1文字 (A-Z)
- 数字2桁 (01-99)
- 数字3桁 (001-999)
- 自由入力（任意の文字列）

**棚番号のサンプル値**（自由入力時のみ）:
- プレビュー表示用のサンプル値

**区切り文字**:
- 任意の文字列（最大10文字）
- 空欄も可能

**商品番号桁数**:
- 3〜6桁から選択

**商品番号開始値**:
- 任意の数値（例: 1, 100, 1001）

**プレビュー**:
- 設定内容をリアルタイムで確認可能
- 例: `AA-1001`, `A_001`, `RACK-A-0001`, `1001`

**実装ファイル**: `sidebar_config.html`, `config_loader.js`, `product.js`, `id.js`

#### 設定マスタシート

**シート名**: `設定マスタ`

**構造**:
```
カテゴリ | 項目1 | 項目2 | 項目3 | 値
---------|-------|-------|-------|-----
商品状態ボタン | 新品、未使用 | タグ付き未使用 | | タグ付き未使用品です。
ハッシュタグ | 全商品プレフィックス | | | #REBORN_
割引情報 | フォロー割 | 〜2,999円 | | 100円引
割引情報 | リピート割 | 説明文 | | 「リピート割希望」とコメントにてお知らせください。
配送デフォルト | 配送料の負担 | | | 送料込み(出品者負担)
管理番号設定 | 棚番号使用 | | | true
```

**自動生成**:
- `setup_config.js`の`setupConfigSheet()`関数で自動生成可能
- Apps Scriptエディタで実行するだけで初期設定が完了

**キャッシュ**:
- 5分間キャッシュ（パフォーマンス向上）
- 保存時に自動でキャッシュクリア

**実装ファイル**: `config_loader.js`, `setup_config.js`

#### 7. 使い方ガイド ★新規完成 ✅

**概要**:
設定管理の各機能を詳しく解説するアコーディオン式のガイドタブ。非エンジニアでも迷わず設定できるよう、丁寧な説明を提供。

**主要機能**:

1. **アコーディオン式UI**
   - 5つのセクションに分かれた折りたたみ式
   - 必要な部分だけ展開して確認可能
   - 見やすいレイアウト

2. **各設定の詳細解説**
   - 📌 概要: 機能の説明
   - 🎯 できること/設定項目: 主な機能一覧
   - 📝 設定手順: ステップバイステップの手順
   - 💡 設定例/おすすめ設定: 具体例付き

3. **5つのガイドセクション**
   - 🔢 管理番号設定
   - 📦 配送デフォルト設定
   - 🔘 商品状態ボタン設定
   - 💰 割引情報設定
   - 🏷️ ハッシュタグ設定

4. **ヒントセクション**
   - 設定保存の重要性
   - プレビュー機能の活用方法
   - ガイド参照の推奨

5. **保存ボタンの自動非表示**
   - 使い方ガイドタブでは保存ボタンが非表示
   - 他のタブに切り替えると再表示
   - JavaScriptで動的制御

**特徴**:
- わかりやすい日本語（専門用語を避ける）
- 具体例を豊富に掲載
- アイコンを活用した視覚的な説明
- プレフィックス・サフィックスなどの専門用語を使わず、「先頭に付く文字列」「末尾の文字列」と表現

**実装ファイル**: `sidebar_config.html` (lines 463-709, 744-759)

---

### 3. 在庫管理（0%完成）

**現状**: メニューUI未実装、未着手

---

### 4. マスタデータ管理（30%完成）

**現状**: メニューUI未実装、データ分離のみ完了

#### 手動管理シート分離

**シート構成**:
```
マスタデータ（31列）
├── 仕入先、出品先、担当者
├── サイズ、商品の状態
├── 配送料の負担、配送の方法、発送元の地域、発送までの日数
├── 素材(箇所)、素材(種類)
├── セールスワード(カテゴリ)、セールスワード
└── タイトル情報（18項目）

手動管理_ブランド（52,667件）
├── ブランド(英語)
└── ブランド(カナ)

手動管理_アイテム分類（1,686件）
├── 大分類
├── 中分類
├── 小分類
├── 細分類1
├── 細分類2
└── アイテム名

設定マスタ（新規）
├── 商品状態ボタン
├── ハッシュタグ
├── 割引情報
├── 配送デフォルト
└── 管理番号設定
```

---

### 5. 売上分析（20%完成）

**現状**: メニューUI未実装、未着手

---

## データ構造

### スプレッドシート構成

**メインファイル**: 在庫/売上管理表

#### シート一覧

```
在庫/売上管理表（メインデータ）
├── 管理情報: 棚番号、商品番号、管理番号、担当者
├── 商品情報: ブランド、商品名、カテゴリ、サイズ
├── 説明文: セールスワード、商品説明、状態詳細
├── サイズ詳細: 肩幅、身幅、袖丈、着丈、ウエスト、ヒップ、股上、股下
├── 仕入情報: 仕入日、仕入先、仕入金額
├── 出品情報: 出品日、出品先、出品金額
└── 配送情報: 配送料負担、配送方法、発送元、発送日数

マスタデータ
└── 31列のマスタ項目

手動管理_ブランド
└── 52,667件（英語・カナ）

手動管理_アイテム分類
└── 1,686件（6階層分類）

設定マスタ（新規）
└── 5カテゴリの設定項目
```

### FIELD_IDS配列（全フィールド定義）

```javascript
const FIELD_IDS = [
  '棚番号','商品番号','担当者',
  'セールスワード(カテゴリ)','セールスワード',
  'ブランド(英語)','ブランド(カナ)',
  '商品名(タイトル)',
  '大分類(カテゴリ)','中分類(カテゴリ)','小分類(カテゴリ)',
  '細分類(カテゴリ)','細分類2',
  'サイズ','商品の状態',
  'アイテム名',
  '商品の説明',
  '商品状態詳細',
  '肩幅','身幅','袖丈','着丈','ウエスト','ヒップ','股上','股下',
  '仕入日','仕入先','仕入金額',
  '出品日','出品先','出品金額',
  '配送料の負担','配送の方法','発送元の地域','発送までの日数'
];
```

### フィールドマッピング（列名変換）

```javascript
const fieldMapping = {
  '大分類(カテゴリ)': '大分類',
  '中分類(カテゴリ)': '中分類',
  '小分類(カテゴリ)': '小分類',
  '細分類(カテゴリ)': '細分類1',
  '商品状態詳細': '商品状態(詳細)'
};
```

---

## 過去のトラブルと教訓

### ❌ 問題①: プルダウンの選択肢が表示されない

**症状**: 担当者、サイズ、商品の状態、素材などのプルダウンをクリックしても選択肢が表示されない

**原因**: `_findIdx()`関数が配列形式のエイリアスを正しく処理できていなかった

```javascript
// ❌ NG
arr.indexOf(targets) // targets が配列の場合、配列全体を検索してしまう
```

**解決策**:

```javascript
function _findIdx(arr, targets) {
  // targetsが配列の場合、各エイリアスを順番に試す
  if (Array.isArray(targets)) {
    for (const target of targets) {
      const index = arr.indexOf(target);
      if (index !== -1) return index;
    }
    return -1;
  }
  // 配列でない場合は従来通り
  return arr.indexOf(targets);
}
```

**教訓**:
- エイリアス配列は各要素を順番に検索する必要がある
- `Array.isArray()`で型チェックを必ず行う

---

### ❌ 問題②: 新規行追加時に数式が消える

**症状**: 保存時に新規行が追加されるが、元々数式が入っているセルが空白になる

**原因**:
- `clearContent()`を使用していたため、数式も削除されていた
- `PASTE_NORMAL`は値も一緒にコピーするため、前の行の値が引き継がれてしまう

**解決策**:

```javascript
// ❌ NG: これだと数式が消える
src.copyTo(dst, SpreadsheetApp.CopyPasteType.PASTE_NORMAL, false);
dst.clearContent();

// ✅ OK: 個別にコピー
srcRange.copyTo(dstRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);
srcRange.copyTo(dstRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
srcRange.copyTo(dstRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
```

**教訓**:
- 行コピー時は`PASTE_FORMULA`, `PASTE_FORMAT`, `PASTE_DATA_VALIDATION`を個別に使用
- `PASTE_NORMAL`や`clearContent()`は使用禁止
- 数式の相対参照は自動的に+1される

---

### ❌ 問題③: 大分類〜細分類、アイテム名が保存されない

**症状**: フォームで選択した分類情報がスプレッドシートに反映されない

**原因**: フォームのID（例: `大分類(カテゴリ)`）とスプレッドシートの列名（例: `大分類`）が一致していなかった

**解決策**:

```javascript
// product.js の PRODUCT_FIELDS を実際のシート列名に変更
const PRODUCT_FIELDS = [
  // ❌ NG: '大分類(カテゴリ)'
  // ✅ OK:
  '大分類','中分類','小分類','細分類1','細分類2',
  'アイテム名'
];

// または、saveProduct() 内でマッピングを追加
const fieldMapping = {
  '大分類(カテゴリ)': '大分類',
  '中分類(カテゴリ)': '中分類',
  '小分類(カテゴリ)': '小分類',
  '細分類(カテゴリ)': '細分類1',
  '商品状態詳細': '商品状態(詳細)'
};
```

**教訓**:
- フォームID、JavaScript変数名、スプレッドシート列名が異なる場合は、必ず`fieldMapping`で明示的にマッピングする
- 推測せず、必ず実際の列名を確認してからコーディングする
- `config.js`の`HEADER_ALIASES`でエイリアス定義があっても、実際の保存時は実列名を使う

---

### ❌ 問題④: 罫線が太く表示される

**症状**: 新規行追加時に罫線が太く表示される

**原因**:
- 既存行の下側に太い罫線が設定されていた
- `PASTE_FORMAT`でその罫線スタイルもコピーされた

**解決策**:

```javascript
// ✅ OK: PASTE_FORMAT で既存行の罫線をそのままコピー
srcRange.copyTo(dstRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

// ❌ NG: 手動で罫線を設定すると太さが変わる
dstRange.setBorder(true, null, null, null, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID);
```

**教訓**:
- 罫線は`PASTE_FORMAT`で既存行からコピーするのが最も安全
- 手動で`setBorder()`を使う場合は、既存行の罫線スタイルが影響する
- スプレッドシート側で既存行の罫線を統一しておく

---

### ❌ 問題⑤: 細分類1・細分類2のバグ

**症状**: 入力して保存した後、細分類1と細分類2の列だけ1つ上の行の値がそのままコピーされて入っている

**原因**: 行コピー時に`PASTE_FORMULA`で数式をコピーしたが、値も一緒にコピーされてしまった

**解決策**:

```javascript
// コピー後、数式以外のセル（値が入っているセル）を空文字でクリア
const values = dstRange.getValues()[0];
const formulas = dstRange.getFormulas()[0];
for (let i = 0; i < values.length; i++) {
  // 数式がないセルで値が入っている場合のみクリア
  if (!formulas[i] && values[i] !== '') {
    sh.getRange(targetRow, i + 1).setValue('');
  }
}
```

**実装箇所**: `product.js` lines 161-169

**教訓**:
- 行コピー後、数式以外のセルに値が残っている場合は明示的にクリアする
- 数式セルと値セルを区別して処理する

---

### ❌ 問題⑥: 商品状態ボタンのテキストが追加されてしまう

**症状**: 別のボタンを押すと前のボタンで入った文章がそのまま残っていて、その後に新しい文章が入るようになっている

**原因**: ボタンクリック時にテキストを追加（append）していた

**解決策**:

```javascript
// ❌ NG: 追加
if (currentValue.trim()) {
  textarea.value = currentValue + '\n' + text;
}

// ✅ OK: 置き換え
textarea.value = text;
```

**実装箇所**: `sp_scripts.html` line 276

**教訓**:
- ボタンの挙動は常に「置き換え」にする
- 追加したい場合は別のUIを用意する

---

### ❌ 問題⑦: ハッシュタグと割引情報が設定マスタから反映されない

**症状**: 設定マスタシートで値を変更しても、商品の説明プレビューに反映されない

**原因**: 設定を非同期で読み込んでいたが、読み込み完了前にプレビューが生成されていた

**解決策**:

```javascript
// 設定読み込み成功時に商品の説明を更新
.withSuccessHandler(function(config) {
  if (config) {
    HASHTAG_CONFIG = config;
    // 読み込み後、プレビューを更新
    if (typeof updateDescriptionFromDetail === 'function') {
      updateDescriptionFromDetail();
    }
  }
})
```

**実装箇所**: `sp_scripts.html` lines 430-437, 470-477

**教訓**:
- 非同期処理の完了を待ってから次の処理を実行する
- 成功ハンドラー内でUIを更新する

---

### ❌ 問題⑧: リセットボタンで一部のフィールドがクリアされない ★重要

**発生日**: 2025年10月9日

**症状**: リセットボタンを押しても以下が残ったままになる
- 管理番号の頭文字と棚番号
- ブランド(英語)・ブランド(カナ)
- 商品名プレビュー
- 商品の説明プレビュー（デフォルト値も消える）
- サイズアイコン・ラベル
- サイズ(表記)プルダウン
- 裄丈ラベル（肩幅に戻らない）

**原因**:

1. **存在しない関数呼び出しでエラー**:
```javascript
setItemNumber('', '選択してください');  // この関数が存在しない
// ReferenceError: Can't find variable: setItemNumber
```
→ エラーで処理が中断し、その後のクリア処理が実行されていなかった

2. **動的に生成されるフィールドを考慮していない**:
- `mgmt_shelf_first`, `mgmt_shelf_second`（棚番号の頭文字・棚番号）
- `mgmt_custom_first`, `mgmt_custom_second`（カスタム値）
- これらは設定に応じて動的に生成されるため、FIELD_IDSに含まれていない

3. **商品名ブロックと基本情報ブロックの区別**:
- 基本情報: `ブランド(英語)`のみ
- 商品名ブロック: `商品名_ブランド(英語)`, `商品名_ブランド(カナ)`
- 両方を個別にクリアする必要がある

**解決策**:

```javascript
function onReset() {
  console.log('=== リセット開始 ===');

  // 1. FIELD_IDSの全フィールドをクリア
  FIELD_IDS.forEach(k=>{
    const el=document.getElementById(k);
    if(el) {
      el.value='';
      console.log(`クリア: ${k}`);
    }
  });

  // 2. カテゴリプルダウンをリセット
  ['中分類(カテゴリ)','小分類(カテゴリ)','細分類(カテゴリ)','細分類2']
    .forEach(id=> resetSelect(id, true));

  // ... 省略 ...

  // 9. 管理番号関連をリセット（動的フィールド対応）
  const mgmtShelfFirst = document.getElementById('mgmt_shelf_first');
  const mgmtShelfSecond = document.getElementById('mgmt_shelf_second');
  const mgmtCustomFirst = document.getElementById('mgmt_custom_first');
  const mgmtCustomSecond = document.getElementById('mgmt_custom_second');
  if (mgmtShelfFirst) mgmtShelfFirst.value = '';
  if (mgmtShelfSecond) mgmtShelfSecond.value = '';
  if (mgmtCustomFirst) mgmtCustomFirst.value = '';
  if (mgmtCustomSecond) mgmtCustomSecond.value = '';

  // 管理番号プレビューをクリア
  const mgmtNumberField = document.getElementById('管理番号');
  if (mgmtNumberField) mgmtNumberField.value = '';

  // 10. ブランドフィールドをクリア
  const brandEnBasic = document.getElementById('ブランド(英語)');
  if (brandEnBasic) brandEnBasic.value = '';

  const brandEn = document.getElementById('商品名_ブランド(英語)');
  const brandKana = document.getElementById('商品名_ブランド(カナ)');
  if (brandEn) brandEn.value = '';
  if (brandKana) brandKana.value = '';

  // 11. プレビューを明示的にクリア
  const namePreview = document.getElementById('商品名プレビュー');
  if (namePreview) namePreview.value = '';

  // 12. サイズ関連をリセット
  const shoulderLabel = document.getElementById('shoulderWidthLabel');
  if (shoulderLabel) shoulderLabel.textContent = '肩幅';

  const sizeHyokiTop = document.getElementById('サイズ(表記)_トップス');
  const sizeHyokiBottom = document.getElementById('サイズ(表記)_ボトムス');
  if (sizeHyokiTop) sizeHyokiTop.value = '';
  if (sizeHyokiBottom) sizeHyokiBottom.value = '';

  const sizeSection = document.getElementById('sizeSection');
  if (sizeSection) sizeSection.style.display = 'none';

  const sizeIconDisplay = document.getElementById('sizeIconDisplay');
  const sizeLabelDisplay = document.getElementById('sizeLabelDisplay');
  if (sizeIconDisplay) sizeIconDisplay.textContent = '👕';
  if (sizeLabelDisplay) sizeLabelDisplay.textContent = 'サイズ';

  // 13. プレビュー再構築
  updateNamePreview();  // 空の商品名
  updateDescriptionFromDetail();  // デフォルト値のみ

  console.log('=== リセット完了 ===');
}
```

**実装箇所**: `sp_scripts.html` lines 2057-2177

**デバッグ手法**:

1. **ブラウザの開発者ツールを活用**:
```javascript
// コンソールログで処理の進行を確認
console.log('=== リセット開始 ===');
console.log(`クリア: ${k}`);
console.log('=== リセット完了 ===');
```

2. **エラーで処理が止まっている箇所を特定**:
```
[Error] ReferenceError: Can't find variable: setItemNumber
    onReset (スクリプト要素1:2137)
```
→ この行でエラーが発生し、その後の処理が実行されていない

3. **スーパーリロードの重要性**:
- `clasp push`後は必ず**Cmd+Shift+R**（スーパーリロード）
- 通常のリロードではJavaScriptのキャッシュが残る

**教訓**:

1. **リセット処理は初期化処理と同等に扱う**:
   - 初期状態 = 商品登録メニューを開いた直後の状態
   - リセット = 初期状態に完全に戻す
   - デフォルト値（ハッシュタグ・割引情報）は保持

2. **動的に生成されるフィールドの考慮**:
   - 設定に応じて動的に生成されるフィールドは、存在チェックが必須
   - `if (element) element.value = '';` のパターンを使う

3. **プレビューフィールドの扱い**:
   - 読み取り専用フィールドも明示的にクリア
   - その後、更新関数を呼び出して再構築

4. **エラーハンドリングの重要性**:
   - 存在しない関数を呼び出すとそこで処理が止まる
   - `console.log()`でデバッグログを仕込む
   - ブラウザの開発者ツールでエラーを確認

5. **テスト方法**:
   - リセット前: データを入力した状態
   - リセット後: 初期状態（デフォルト値あり）
   - 複数回のリセットで動作が安定しているか確認

**チェックリスト** - リセット機能実装時:

- [ ] FIELD_IDSに含まれる全フィールドをクリア
- [ ] 動的に生成されるフィールドを個別にクリア
- [ ] 読み取り専用フィールドも明示的にクリア
- [ ] プレビューフィールドの再構築関数を呼び出す
- [ ] デフォルト値は保持（配送情報、ハッシュタグ、割引情報）
- [ ] console.log()でデバッグログを仕込む
- [ ] エラーが発生しないか開発者ツールで確認
- [ ] 複数回リセットして動作確認

---

### ❌ 問題⑨: サイズ(表記)と裄丈のプレビュー反映

**発生日**: 2025年10月9日

**症状**:
1. サイズ(表記)プルダウンを選択しても商品の説明プレビューに反映されない
2. ラグラン判定でラベルが「裄丈」に変わるが、プレビューでは「肩幅」のまま

**原因**:

1. **イベントリスナーが設定されていない**:
```javascript
// サイズ(表記)変更時のイベントリスナーがなかった
```

2. **getSizeInfo()関数でラグラン判定していない**:
```javascript
function getSizeInfo() {
  // ラグラン判定がなく、常に「肩幅」と表示
  if (sizeValues.肩幅) sizeText += `肩幅：${sizeValues.肩幅}cm\n`;
}
```

**解決策**:

1. **サイズ(表記)のイベントリスナー追加**:
```javascript
function setupSizeHyokiListeners() {
  const sizeHyokiTop = document.getElementById('サイズ(表記)_トップス');
  const sizeHyokiBottom = document.getElementById('サイズ(表記)_ボトムス');

  if (sizeHyokiTop) {
    sizeHyokiTop.addEventListener('change', updateDescriptionFromDetail);
  }
  if (sizeHyokiBottom) {
    sizeHyokiBottom.addEventListener('change', updateDescriptionFromDetail);
  }
}

// ページ読み込み時に設定
setTimeout(() => {
  setupSizeHyokiListeners();
}, 1000);
```

2. **getSizeInfo()でラグラン判定を追加**:
```javascript
function getSizeInfo() {
  const sizeHyoki = _val('サイズ(表記)_トップス') || _val('サイズ(表記)_ボトムス');

  // ラグラン判定
  const itemName = _val('アイテム名');
  const isRaglan = itemName && itemName.includes('ラグラン');
  const shoulderLabel = isRaglan ? '裄丈' : '肩幅';

  // サイズ(実寸)セクション
  if (hasJissunData) {
    sizeText += 'サイズ(実寸)\n';
    if (sizeValues.肩幅) sizeText += `${shoulderLabel}：${sizeValues.肩幅}cm\n`;
    // ...
  }
}
```

3. **アイテム名変更時のイベントリスナー追加**:
```javascript
function setupRaglanListener() {
  const itemNameField = document.getElementById('アイテム名');
  if (itemNameField) {
    itemNameField.addEventListener('change', updateSizeDisplay);
  }
}
```

**実装箇所**:
- `sp_scripts.html` lines 1644-1693: `getSizeInfo()`
- `sp_scripts.html` lines 2944-2970: イベントリスナー設定

**教訓**:
- プレビュー更新関数は、表示に使う全データを参照する
- 入力フィールド変更時のイベントリスナーを忘れずに設定
- リアルタイム更新が求められる場合は`change`イベントを使う

---

### ❌ 問題⑩: モバイル対応の複合的問題 ★重要

**発生日**: 2025年10月13日

**症状**: スマホで商品登録UIにアクセスできない、または表示が崩れる
1. 「ファイルを開けません」エラー
2. UIが小さすぎて操作不可
3. リンクをタップすると白い画面になる
4. デプロイしても反映されない

**原因**:

**1. viewport meta tagの問題** ★最重要:
```html
<!-- ❌ 通常のHTMLでは動くが、GASでは動かない -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```
Google Apps Scriptでは通常のHTML meta tagが機能しない。GAS専用の`.addMetaTag()`メソッドを使う必要がある。

**2. デプロイタイプの問題**:
- 多くのデプロイが「ライブラリ」として作成されていた
- 正しくは「ウェブアプリ」として作成する必要がある
- アクセス権限が「自分のみ」になっていた（「全員」にする必要がある）

**3. clasp deployの限界**:
- `clasp push`はコードをアップロードするだけ
- `clasp deploy`でデプロイしても、Apps Scriptエディタで手動バージョン更新が必要
- これをしないと最新コードが反映されない

**4. 相対パスの問題**:
```html
<!-- ❌ Web Appでは相対パスが動かない -->
<a href="?menu=product">商品登録</a>
```
Web Appでは相対パスが正しく解決されないことがある。

**5. ブラウザキャッシュ**:
- スマホのブラウザが古いエラー画面をキャッシュ
- 同じURLでも、新しくコピーするとキャッシュをバイパスする

**解決策**:

**1. GAS専用のviewport設定**:
```javascript
// menu.js
return HtmlService.createHtmlOutput(html)
  .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
  .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
```

**2. 正しいデプロイ設定**:
- すべての古いデプロイを削除（`clasp undeploy`）
- Apps Scriptエディタで手動で「ウェブアプリ」として新規作成
- アクセス権限を「全員」に設定

**3. 正しいデプロイワークフロー**:
```bash
# 1. コードをプッシュ
clasp push -f

# 2. Apps Scriptエディタで手動操作
# - 「デプロイ」→「デプロイを管理」
# - 既存デプロイを選択
# - ✏️ 鉛筆アイコンをクリック
# - 「バージョン」を「新バージョン」に変更
# - 「デプロイ」をクリック

# 3. デプロイ管理画面からURLをコピーしてアクセス
```

**4. 絶対URLの使用**:
```javascript
const baseUrl = ScriptApp.getService().getUrl();
return HtmlService.createHtmlOutput(`
  <a href="${baseUrl}?menu=product">商品登録</a>
`);
```

**5. キャッシュ対策**:
- デプロイ管理画面から毎回URLをコピーして開く
- または、URLの最後に`?v=24`などのパラメータを追加

**実装箇所**:
- `menu.js` (lines 15, 70, 106-113): `.addMetaTag()`と絶対URL
- `sp_styles.html`: モバイル最適化CSS

**所要時間**: 約6時間

**教訓**:

1. **GASは通常のHTML/CSSと異なる挙動がある**
   - meta tagは`.addMetaTag()`を使う
   - 相対パスは動かないことがある
   - 公式ドキュメントだけでなく、実例記事を探すことが重要

2. **clasp CLIには限界がある**
   - デプロイは手動操作が確実
   - バージョン更新は必ずApps Scriptエディタで行う

3. **複数の問題が重なると時間がかかる**
   - 一つずつ切り分けて解決する
   - テストページを作って最小構成で確認する

4. **非エンジニアでも諦めずに続ければ解決できる**
   - ユーザーが調査した記事（https://enchord.jp/blog/gas-html-responsive/）が決定的だった
   - AIとの合わせ技で複雑な技術的問題も乗り越えられる

5. **キャッシュは思わぬ落とし穴**
   - URLが同じでも、新しくコピーすると動くことがある
   - デプロイ管理画面から常に最新URLをコピーする習慣をつける

**チェックリスト** - モバイル対応時:
- [ ] `.addMetaTag('viewport', ...)`を使用
- [ ] デプロイタイプは「ウェブアプリ」
- [ ] アクセス権限は「全員」
- [ ] Apps Scriptエディタで新バージョンとして更新
- [ ] 相対パスではなく絶対URLを使用
- [ ] デプロイ管理画面からURLをコピー
- [ ] スマホでテスト（プルダウン、入力、ボタン、スクロール）

---

## 開発ルール

### ✅ 開発時のチェックリスト

#### フィールド追加時
- [ ] フォームIDとスプレッドシート列名が一致しているか確認
- [ ] 一致していない場合は`fieldMapping`に追加
- [ ] `FIELD_IDS`（フロントエンド）に追加
- [ ] `PRODUCT_FIELDS`（バックエンド）に**実際のシート列名**で追加

#### 行コピー処理変更時
- [ ] `PASTE_FORMULA`, `PASTE_FORMAT`, `PASTE_DATA_VALIDATION`を個別使用
- [ ] `clearContent()`を使用していないか確認
- [ ] 数式が正しく引き継がれるかテスト
- [ ] 数式以外のセルに値が残っていないか確認

#### マスタデータ追加時
- [ ] `HEADER_ALIASES`にエイリアス定義を追加
- [ ] `_findIdx()`が配列形式のエイリアスを処理できることを確認

#### 設定マスタ追加時
- [ ] `config_loader.js`の`loadConfigMaster()`に読み込み処理を追加
- [ ] `config_loader.js`の`saveConfigMaster()`に保存処理を追加
- [ ] `setup_config.js`にデフォルトデータを追加
- [ ] `sidebar_config.html`にUI要素を追加
- [ ] キャッシュクリア処理を確認

#### デバッグ時
- [ ] `console.log()`でフォームから送信されたデータを確認
- [ ] 実際のシート列名を確認
- [ ] Apps Scriptの「実行ログ」でエラーを確認

---

### ❌ 禁止事項

#### コーディング
- ❌ `PASTE_NORMAL`を使用しない（数式が消える）
- ❌ `clearContent()`を数式が入っている範囲に使用しない
- ❌ フィールド名を推測しない（必ず実際の列名を確認）
- ❌ 手動で`setBorder()`を使用しない（罫線が太くなる可能性）
- ❌ デフォルト値をコード内にハードコードしない（設定マスタを使用）

#### ワークフロー
- ❌ Apps Script webエディタで直接編集しない
- ❌ `clasp push`せずにブラウザをリロードしない
- ❌ ローカルファイルを編集した後に`clasp pull`しない（上書きされる）

---

### 📝 トラブルシューティング

#### プルダウンが表示されない
1. `master.js`の`_findIdx()`が配列形式のエイリアスを処理できるか確認
2. マスタデータシートに該当列が存在するか確認
3. `HEADER_ALIASES`にエイリアス定義があるか確認

#### データが保存されない
1. フォームIDとスプレッドシート列名が一致しているか確認
2. `fieldMapping`にマッピングがあるか確認
3. `console.log()`でフォームデータが送信されているか確認
4. Apps Scriptの実行ログでエラーが出ていないか確認

#### 数式が消える
1. `PASTE_NORMAL`を使用していないか確認
2. `clearContent()`を使用していないか確認
3. `PASTE_FORMULA`, `PASTE_FORMAT`, `PASTE_DATA_VALIDATION`を個別使用しているか確認

#### 設定が反映されない
1. 設定マスタシートに正しくデータが保存されているか確認
2. キャッシュがクリアされているか確認（`clearConfigCache()`）
3. ブラウザをスーパーリロード（Cmd+Shift+R）
4. 非同期読み込みが完了しているか確認

---

## コードレビュー・リファクタリング（2025/10/12実施）🔧

### 実施内容

Gemini API統合前のコード品質向上を目的とした、安全で効果的な改善を実施。

#### 1. デバッグユーティリティの追加 ✅

**目的**: 本番環境でのログ制御を容易にする

**実装内容**:
```javascript
// デバッグ設定（sp_scripts.html冒頭）
const DEBUG_MODE = true; // 本番環境ではfalseに設定

const debug = {
  log: (...args) => { if (DEBUG_MODE) console.log(...args); },
  warn: (...args) => { if (DEBUG_MODE) console.warn(...args); },
  error: (...args) => { console.error(...args); }, // エラーは常に表示
  info: (...args) => { if (DEBUG_MODE) console.info(...args); }
};
```

**メリット**:
- 本番環境では`DEBUG_MODE = false`に切り替えるだけ
- 開発時は詳細なログで問題を特定しやすい
- エラーログは常に表示されるため、本番でも問題を検知可能

#### 2. エラーハンドリングの強化 ✅

**対象関数**:
- `updateDescriptionFromDetail()` - 商品の説明プレビュー更新
- `updateNamePreview()` - 商品名プレビュー更新
- `onReset()` - フォーム全体のリセット

**実装パターン**:
```javascript
function 重要な関数() {
  try {
    // メイン処理
  } catch (error) {
    console.error('エラーメッセージ:', error);
    debug.error('詳細エラー:', error);
    // 必要に応じてユーザーへの通知
  }
}
```

**効果**:
- エラーが発生してもシステムが停止しない
- エラー内容が明確に記録される
- Gemini API統合時の問題切り分けが容易になる

#### 3. JSDocコメントの追加 ✅

主要関数に説明コメントを追加し、コードの可読性を向上。

**例**:
```javascript
/**
 * 商品の説明プレビューを更新
 * ブランド、カラー、サイズ、素材、商品状態、管理番号、割引情報、ハッシュタグを組み立てる
 * @throws {Error} 要素が見つからない場合や処理中にエラーが発生した場合
 */
function updateDescriptionFromDetail() {
  // ...
}
```

#### 4. 既存エラーハンドリングの確認 ✅

**確認結果**:
- `product.js`: 6つのcatch blockで適切にエラー処理
- `id.js`: 主要な管理番号生成関数にtry-catch実装済み
- エラーハンドリングは全体的に良好

### スキップした項目（リスク回避）

#### 超長関数の分割 ❌
- `renderManagementSegmentUI()` - 294行
- `hideSuggest()` - 274行
- `attachBrandSuggest()` - 247行

**理由**:
- 複雑なロジックが絡み合っており、分割すると既存機能を破壊するリスクが高い
- Gemini API統合後に実施する方が安全

### コード分析結果

```
sp_scripts.html: 3,946行、103個の関数
sidebar_config.html: 3,233行
product.js: 500行、6つのエラーハンドリング
id.js: 352行、3つのエラーハンドリング
```

### 次のステップ

**Gemini API統合に向けて準備完了** ✅

- ✅ エラーハンドリング強化
- ✅ デバッグユーティリティ追加
- ✅ コメント追加
- ⏸️ 超長関数の分割（API統合後に実施）

---

## 次の実装予定

### 短期（2週間以内）- 商品登録完成に向けて

#### ~~1. サイズレイアウト変更（縦→2列並び）~~ ✅ **完了（2025/10/09）**

**変更内容**: 縦配置 → 2列並び

```
変更前:        変更後:
肩幅           肩幅    身幅
身幅    →      袖丈    着丈
袖丈
着丈
```

**実装方法**:
- `class="row"`をインラインスタイルに変更
- `display: grid; grid-template-columns: 1fr 1fr; gap: 8px;`
- トップス（肩幅・身幅、袖丈・着丈）とボトムス（ウエスト・ヒップ、股上・股下）に適用

**実装箇所**: `sp_block_description.html` lines 42-137

---

#### ~~2. ラグラン例外処理（肩幅→裄丈）~~ ✅ **完了（2025/10/09）**

**機能**:
- アイテム名に「ラグラン」が含まれる場合、「肩幅」→「裄丈」に変更
- UI表示ラベルとプレビューの両方に対応
- リアルタイム更新（アイテム名変更時に自動切り替え）

**実装内容**:

1. **UI表示ラベルの動的切り替え**:
```javascript
// ラグラン判定
const itemName = _val('アイテム名');
const isRaglan = itemName && itemName.includes('ラグラン');

// ラベルテキスト更新
const shoulderLabel = document.getElementById('shoulderWidthLabel');
if (shoulderLabel) {
  shoulderLabel.textContent = isRaglan ? '裄丈' : '肩幅';
}
```

2. **プレビュー表示の動的切り替え**:
```javascript
function getSizeInfo() {
  const itemName = _val('アイテム名');
  const isRaglan = itemName && itemName.includes('ラグラン');
  const shoulderLabel = isRaglan ? '裄丈' : '肩幅';

  if (sizeValues.肩幅) sizeText += `${shoulderLabel}：${sizeValues.肩幅}cm\n`;
}
```

3. **イベントリスナー追加**:
```javascript
function setupRaglanListener() {
  const itemNameField = document.getElementById('アイテム名');
  if (itemNameField) {
    itemNameField.addEventListener('change', updateSizeDisplay);
  }
}
```

**実装箇所**:
- `sp_block_description.html` line 44: `id="shoulderWidthLabel"`
- `sp_scripts.html` lines 1649-1652: ラグラン判定
- `sp_scripts.html` lines 2804-2840: UI更新
- `sp_scripts.html` lines 2957-2963: イベントリスナー

---

#### ~~3. リセット機能の完全実装~~ ✅ **完了（2025/10/09）**

**機能**: リセットボタンで初期状態（商品登録メニューを開いた直後の状態）に完全に戻す

**対応項目**:
- FIELD_IDS全フィールドのクリア
- 動的生成フィールド（管理番号の頭文字・棚番号）
- ブランドフィールド（基本情報・商品名ブロック）
- 商品名プレビュー（空欄に）
- 商品の説明プレビュー（デフォルト値のみ表示）
- サイズ関連（アイコン・ラベル・表記プルダウン・裄丈ラベル）
- 素材フィールド（1セット目のみ残して他を削除）
- 配送デフォルト値を再適用

**実装箇所**: `sp_scripts.html` lines 2057-2177

**重要な教訓**:
- リセット = 初期化と同等に扱う
- 動的フィールドは存在チェック必須
- エラーで処理が止まらないようにする
- console.log()でデバッグログを仕込む

---

#### ~~4. ブランド(カナ)の頭に半角スペース~~ ✅ **完了**

**変更内容**: `【セール】UNIQLOユニクロ ニット` → `【セール】UNIQLO ユニクロ ニット`

- ブランド(英語)の前: スペースなし（現状維持）
- ブランド(カナ)の前: 半角スペース追加

---

#### ~~5. ブランド名自動反映~~ ✅ **完了**

**機能**:
- 基本情報ブロックでブランド選択
- ↓ 自動反映
- 商品名ブロックのブランド(英語)・ブランド(カナ)

**追加要件**:
- 商品名ブロックのブランド名をテキスト編集可能にする
- 編集した値も商品名プレビューに反映

**理由**: 略称で入力したい場合がある（例: ユニクロ → ユニ）

---

#### ~~6. 商品属性の動的追加~~ ✅ **完了**

**変更内容**: 固定3セット → 動的追加方式

**実装内容**:
- デフォルト1セット表示
- 素材ブロックと同様の動的追加
- 「+ 商品属性を追加」ボタン
- 見た目スッキリ

**実装方法**: 動的ブロックビルダー（`DynamicBlockBuilder`）を使用

---

#### ~~7. カラー(詳細)追加~~ ✅ **完了（2025/10/10）**

**機能**:
- 商品の説明ブロック内に追加
- マスタデータの「カラー/配色/トーン」列を参照
- 複数選択可能（黒 + ブラック、2色以上の服対応）
- プレビュー配置: ブランド名の下

**UI設計**:
- 🎨 アイコン付きセクション
- 3列グリッドレイアウトのチェックボックス
- 最大高さ200pxでスクロール可能
- リアルタイムプレビュー更新

**実装内容**:

1. **カラーチェックボックスの動的生成**
   - `loadColorOptions()`: マスタデータから取得
   - `renderColorCheckboxes()`: チェックボックス生成
   - ページロード時に自動実行

2. **プレビュー生成**
   - `getColorInfo()`: 選択されたカラーを取得
   - カンマ区切りで結合（例: 黒、ブラック）
   - `updateDescriptionFromDetail()`に統合

3. **リセット対応**
   - `onReset()`にチェックボックスクリア処理を追加
   - すべてのチェックを解除

**表示例**:
```
ブランド名
UNIQLO（ユニクロ）

カラー(詳細)
黒、ブラック

サイズ(表記)
M
```

**実装ファイル**:
- `sp_block_description.html` (lines 143-154): UI
- `sp_scripts.html` (lines 559-579): `loadColorOptions()`
- `sp_scripts.html` (lines 584-624): `renderColorCheckboxes()`
- `sp_scripts.html` (lines 1644-1653): `getColorInfo()`
- `sp_scripts.html` (lines 2186-2191): リセット処理

---

#### ~~8. コピーボタン実装~~ ✅ **完了（2025/10/10）**

**機能**:
- 商品名コピーボタン
- 商品説明コピーボタン
- ワンクリックでクリップボードにコピー
- 視覚的フィードバック（✓ コピー済み、緑色）

**実装位置**:
- グループタイトル（✏️ 商品名、📝 商品の説明）の右側

**実装内容**:

1. **コピーボタンの配置**:
```html
<div class="group-title" style="display: flex; justify-content: space-between; align-items: center;">
  <span>✏️ 商品名</span>
  <button type="button" onclick="copyToClipboard('商品名プレビュー', 'copyNameBtn')" id="copyNameBtn"
          style="padding: 6px 12px; font-size: 12px; background: #e3f2fd; border: 1px solid #90caf9; border-radius: 4px; cursor: pointer; color: #1976d2; font-weight: 500;">
    📋 商品名をコピー
  </button>
</div>
```

2. **コピー機能の実装**:
```javascript
function copyToClipboard(fieldId, buttonId) {
  const field = document.getElementById(fieldId);
  const button = document.getElementById(buttonId);

  if (!field || !field.value.trim()) {
    alert('コピーする内容がありません');
    return;
  }

  // クリップボードにコピー
  navigator.clipboard.writeText(field.value).then(function() {
    // ボタンのテキストを「✓ コピー済み」に変更
    const originalText = button.innerHTML;
    button.innerHTML = '✓ コピー済み';
    button.style.background = '#c8e6c9';
    button.style.borderColor = '#81c784';
    button.style.color = '#2e7d32';

    // 1秒後に元に戻す
    setTimeout(function() {
      button.innerHTML = originalText;
      button.style.background = '#e3f2fd';
      button.style.borderColor = '#90caf9';
      button.style.color = '#1976d2';
    }, 1000);
  }).catch(function(err) {
    console.error('クリップボードへのコピーに失敗しました:', err);
    alert('コピーに失敗しました。ブラウザの設定を確認してください。');
  });
}
```

**実装ファイル**:
- `sp_block_title.html` (lines 2-8): 商品名コピーボタン
- `sp_block_description.html` (lines 2-8): 商品の説明コピーボタン
- `sp_scripts.html` (lines 2548-2578): `copyToClipboard()`関数

---

#### ~~9. 商品の説明の自動リサイズ機能~~ ✅ **完了（2025/10/10）**

**機能**:
- 商品の説明テキストエリアが内容に応じて自動的に高さ調整
- スクロール不要で全体を表示
- 項目追加時にリアルタイムで拡大

**実装内容**:

1. **HTML側の設定**:
```html
<textarea
  id="商品の説明"
  placeholder="商品の状態・素材・サイズ感・ディテール・注意点などを記入してください"
  readonly
  style="background-color: #f8f9fa; margin-top: 4px; min-height: 120px; resize: none;"
></textarea>
```

2. **CSS側の設定** (`sp_styles.html`):
```css
#商品の説明 {
  line-height: 1.5;
  overflow: auto;  /* max-height制限を削除 */
  background: linear-gradient(135deg, #fefce8 0%, #fef3c7 100%);
  border: 2px solid #a855f7;
}
```

3. **自動リサイズ関数**:
```javascript
function autoResizeTextarea(textarea) {
  if (!textarea) return;

  setTimeout(function() {
    // 一旦高さをリセットしてscrollHeightを正しく取得
    textarea.style.height = 'auto';

    // scrollHeightに基づいて高さを設定
    const newHeight = Math.max(120, textarea.scrollHeight + 10);
    textarea.style.height = newHeight + 'px';
  }, 50);
}
```

4. **プレビュー更新時に自動リサイズ**:
```javascript
function updateDescriptionFromDetail() {
  // ... 説明文生成処理 ...

  descTextarea.value = descriptionText;

  // テキストエリアの高さを自動調整
  autoResizeTextarea(descTextarea);
}
```

**実装ファイル**:
- `sp_block_description.html` (line 22): テキストエリアの設定
- `sp_styles.html` (lines 256-261): CSS設定
- `sp_scripts.html` (lines 2580-2603): `autoResizeTextarea()`関数
- `sp_scripts.html` (line 2075): `updateDescriptionFromDetail()`に呼び出し追加

**注意点**:
- PC入力では快適、モバイル対応は今後検討
- わずかなカクカク感あり（`setTimeout(50ms)`による遅延）

---

#### ~~10. 管理番号「採番中...」表示~~ ✅ **完了（2025/10/10）**

**機能**:
- 棚番号の2文字目を選択した直後に「採番中...」と表示
- サーバーからの応答で実際の管理番号に切り替わる

**実装内容**:
```javascript
function updateManagementNumberPreview() {
  // ... バリデーション処理 ...

  // 採番中を表示
  setManagementNumber('', '採番中...');

  // 自動採番を実行
  google.script.run
    .withSuccessHandler(function(managementNumber) {
      if (typeof managementNumber === 'string' && managementNumber.startsWith('NG(')) {
        setManagementNumber('', managementNumber);
        return;
      }
      setManagementNumber(managementNumber, '');
    })
    .withFailureHandler(function(e) {
      console.error('管理番号生成エラー:', e);
      setManagementNumber('', 'エラー');
    })
    .generateSegmentBasedManagementNumber(userInputs);
}
```

**実装ファイル**:
- `sp_scripts.html` (lines 1560-1561): 採番中表示

---

#### 1. コードレビュー・リファクタリング

**目的**: Gemini API実装前にコードを最適化

**実施内容**:

1. **重複コードの統合**
   ```javascript
   // 例: getSheet_(), getSheet() を統一
   function getMainSheet() {
     return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
   }
   ```

2. **長い関数の分割**
   ```javascript
   // 分割例
   function updateDescriptionFromDetail() {
     const brandText = getBrandInfo();
     const sizeText = getSizeInfo();
     const materialText = getMaterialInfo();
     const detailText = getDetailInfo();
     const hashtags = generateHashtags();

     const description = buildDescription(brandText, sizeText, materialText, detailText, hashtags);
     updateDescriptionField(description);
   }
   ```

3. **マジックナンバーの定数化**
   ```javascript
   // NG
   if (length > 40) { ... }

   // OK
   const MAX_TITLE_LENGTH = 40;
   if (length > MAX_TITLE_LENGTH) { ... }
   ```

4. **命名規則の統一**
   - 関数名: camelCase
   - 定数: UPPER_SNAKE_CASE
   - プライベート関数: _functionName()

5. **パフォーマンス最適化**
   - ブランド検索の高速化（既に実装済みだが他にも適用）
   - キャッシュの積極活用
   - 不要なループの削除

6. **コメント追加**
   - 複雑なロジックに説明追加
   - 関数の引数・戻り値を明記

7. **エラーハンドリングの統一**
   - `error_handler.js`を全体で活用
   - 一貫したエラーメッセージ

**重点チェック箇所**:
- 過去のトラブル箇所（`_findIdx()`, 列名マッピング等）
- 38ファイルの役割分担が適切か
- 重複コードの有無

#### 3. エラーハンドリング強化

**目的**: Gemini API実装前にエラー処理を強化

**実施内容**:

1. **バリデーション統一**
   ```javascript
   // 例: 商品番号入力時
   input.addEventListener('blur', () => {
     const result = validateField('商品番号', input.value);
     if (!result.isValid) {
       showError(result.message);
     }
   });
   ```

2. **ユーザー向けエラーメッセージ改善**
   ```javascript
   // NG
   return "NG(VALIDATION): Error occurred";

   // OK
   return "商品番号は1001以上の数値で入力してください（現在の値: abc）";
   ```

3. **ログ記録機能追加**
   ```javascript
   function logError(error, context) {
     const logEntry = {
       timestamp: new Date().toISOString(),
       type: error.type,
       message: error.message,
       context: context
     };
     // ログシートに書き込み
     writeToLogSheet(logEntry);
   }
   ```

4. **リトライ機構実装**
   ```javascript
   function retryableExecute(fn, maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return fn();
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         console.log(`Retry ${i + 1}/${maxRetries}`);
       }
     }
   }
   ```

5. **フォールバック処理**
   ```javascript
   function getMasterDataSafe(fieldName) {
     try {
       return getMasterData(fieldName);
     } catch (error) {
       console.warn('マスタデータ取得失敗、キャッシュを使用:', error);
       return getCachedMasterData(fieldName);
     }
   }
   ```

---

### 短期（1ヶ月〜2ヶ月以内）- Gemini API統合

#### 1. AI商品説明文自動生成

**機能概要**:
- 「AI生成」ボタン設置
- 商品登録メニュー内の入力情報をAIが読み込み
- 服のアピールポイントを自動生成（200〜300文字）
  - 商品概要
  - コーディネート案
  - 着用シーン
- 商品の説明プレビューに反映

**実装手順**:
1. Gemini APIキー設定
2. プロンプト設計
3. API呼び出し処理
4. レスポンスのパース・表示
5. エラーハンドリング

**プロンプト例**:
```javascript
const prompt = `
以下の商品情報からメルカリ用の魅力的な商品説明文を200〜300文字で作成してください。

ブランド: ${brandName}
アイテム: ${itemName}
カテゴリ: ${category}
サイズ: ${size}
状態: ${condition}
素材: ${material}
カラー: ${color}

以下の要素を含めてください：
- 商品の特徴
- コーディネート提案
- おすすめの着用シーン
`;
```

**実装ファイル**:
- 新規: `gemini_api.js`
- 修正: `sp_block_description.html`（ボタン追加）
- 修正: `sp_scripts.html`（API呼び出し処理）

#### 2. Gemini Vision API統合（画像解析）

**機能概要**:
- 商品画像アップロード機能（1〜3枚）
- AIが画像を解析
- より精度の高い商品説明文を生成

**実装手順**:
1. 画像アップロードUI作成
2. 画像のBase64エンコード
3. Gemini Vision API呼び出し
4. 画像解析結果と入力情報を統合
5. 説明文生成

**実装ファイル**:
- 修正: `gemini_api.js`
- 新規: `sp_block_image.html`（画像アップロード）

#### 3. 価格最適化提案

**機能概要**:
- 画像解析結果から適正価格を提案
- 出品金額フィールドに自動反映
- 参考価格として表示

**プロンプト例**:
```javascript
const pricePrompt = `
以下の商品情報から、メルカリでの適正な出品価格を提案してください。

ブランド: ${brandName}
アイテム: ${itemName}
状態: ${condition}
仕入価格: ${purchaseAmount}円

価格のみを数値で回答してください。
`;
```

#### 4. データエクスポート機能

**機能概要**:
- メルカリShopsのCSV一括出品用ファイル生成
- 商品登録データをCSV形式でエクスポート

**実装内容**:
- CSVヘッダー定義（メルカリShops仕様に準拠）
- データ変換処理
- ダウンロード機能
- 複数商品の一括エクスポート

**実装ファイル**:
- 新規: `export.js`
- 修正: `menu.js`（メニュー追加）

---

### 中期（2ヶ月〜3ヶ月以内）

**注意**: 大まかな内容のため、開発が進む中で具体化

#### 1. 在庫管理機能

**ジャンプ機能**:
- 管理番号ブロック設置（商品登録と同様）
- 管理番号を選択・検索
- 該当行にジャンプ

**販売情報**:
- 販売日、販売先、販売金額の入力
- UIは仕入情報・出品情報と同様
- シートに保存

**発送情報**:
- 発送方法、梱包資材の選択
- 選択値に基づく自動計算
- 利益計算に反映

**商品編集機能**: ★重要
- 登録済み商品のタイトル・説明文等を編集
- 売れ行きが悪い商品の改善に活用

**実装ファイル**:
- 修正: `inventory.js`（既存関数あり）
- 新規: UIブロック

---

##### 📝 商品編集機能の実装案（詳細）

**背景**:
メルカリ等に出品後、反応が悪い商品のタイトルや説明文を修正して売れやすくする必要がある。大幅な変更は少ないが、細かな調整は頻繁に発生する可能性がある。

**採用案**: **案1 - 在庫管理メニュー経由の編集** ★推奨

**概要**:
- 在庫管理メニューに「編集」ボタンを追加
- 管理番号で商品を検索 → 該当行のデータを商品登録UIに読み込み
- 編集して保存すると、同じ行に上書き保存

**メリット**:
- 商品登録UIを再利用できる（新規開発不要）
- 「検索 → 編集」という自然な流れ
- 在庫管理と編集が一体化（UXが良い）

**デメリット**:
- 在庫管理メニューを先に実装する必要がある

---

**検討した他の案**:

**案2**: 商品登録メニューに「編集モード」を追加
- メリット: 新規登録と編集を1つのUIで完結
- デメリット: UIが複雑になる、誤操作リスク

**案3**: スプレッドシートで直接編集（最もシンプル）
- メリット: 実装不要、今すぐ使える
- デメリット: プルダウンやプレビュー機能が使えない

**案4**: 専用の「商品編集」メニューを新設
- メリット: 新規登録と編集が明確に分離
- デメリット: UIコードの重複、開発コスト増

---

**実装時に必要な対応**: **データ保存の拡張**

現在、**商品名**と**商品の説明**は最終結果のみ保存。編集機能実装時には、個別の入力値も保存する必要がある。

**パターンA: 個別の列を追加** ★推奨

追加すべき列:
```
商品属性1, 商品属性2, 商品属性3  ← 最大3つまで
素材1, 素材2, 素材3  ← 簡略化「表地: ポリエステル 100%」を1列に
カラー(詳細)  ← カンマ区切り「黒,ブラック」
```

**メリット**:
- スプレッドシートで直接確認・編集しやすい
- データの視認性が高い
- フィルタ機能が使える

**デメリット**:
- 列数が増える（管理が複雑になる）

**パターンB: JSON形式で保存**

追加すべき列:
```
商品属性(JSON): ["ヴィンテージ", "古着", "オーバーサイズ"]
素材情報(JSON): [{"箇所":"表地","種類1":"ポリエステル","パーセンテージ":"100%"}]
カラー(詳細)(JSON): ["黒", "ブラック"]
```

**メリット**:
- 列数が少なく済む
- 柔軟に拡張できる

**デメリット**:
- スプレッドシートで直接編集しにくい
- JSONをパースする処理が必要

---

**実装ステップ**:

1. **現在の保存処理を確認**
   - `product.js`の`saveProduct()`を確認
   - どの情報が保存されているか、されていないかを洗い出し

2. **不足している列を追加**
   - スプレッドシートに新しい列を追加
   - `FIELD_IDS`に追加

3. **保存処理を修正**
   - 商品属性、素材情報、カラー(詳細)を個別に保存

4. **読み込み処理を実装**
   ```javascript
   function loadProductByManagementNumber(managementNumber) {
     // 管理番号で行を検索
     // 該当行のデータを取得
     // フォームに値をセット
   }
   ```

5. **上書き保存処理を実装**
   ```javascript
   function updateProduct(managementNumber, data) {
     // 管理番号で行を特定
     // 該当行に上書き保存
     // 新規行は追加しない
   }
   ```

6. **編集モードフラグ**
   ```javascript
   let isEditMode = false;
   let editingManagementNumber = null;
   ```

---

**ユースケース別の推奨方法**:

| ユースケース | 推奨方法 |
|------------|--------|
| タイトルだけ修正 | スプレッドシート直接編集 |
| 説明文を大幅に書き直し | 編集機能（在庫管理経由） |
| 価格だけ変更 | スプレッドシート直接編集 |
| 複数商品を一括修正 | スプレッドシート直接編集 |
| ブランド名の修正（プルダウン選択したい） | 編集機能（在庫管理経由） |

---

#### 2. 売上管理

**統合データ**:
- 仕入情報（商品登録メニュー）
- 出品情報（商品登録メニュー）
- 販売情報（在庫管理メニュー）
- 発送情報（在庫管理メニュー）
- 備品管理データ

**実装予定**:
- 売上・利益の自動計算
- 担当者別報酬の自動計算
- 売上分析ダッシュボード
- 確定申告用書類の出力

#### 3. 備品管理システム

**機能**:
- 在庫アラート機能
- 自動発注システム
- 売上管理との連動

**実装内容**:
- 備品マスタ作成
- 在庫数管理
- 閾値設定・アラート
- 発注処理（将来的に自動化）

#### 4. LINEもしくはSlack通知機能

**目的**: チーム利用・外注スタッフへの自動通知

**通知内容**:
- 商品の発送依頼
- 在庫アラート
- 売上レポート
- タスク完了通知

**実装方法**:
- LINE Messaging API または Slack Webhook
- GASのトリガー機能活用

#### 5. 売上分析ダッシュボード

**表示内容**:
- 売上推移グラフ
- 利益率分析
- 担当者別パフォーマンス
- カテゴリ別売上
- 在庫回転率

**実装技術**:
- Google Data Studio連携
- またはHTML Service + Chart.js

#### 6. モバイル対応UI改善

**目的**:
- 個人・チームでの使い勝手向上
- 将来のSaaS化に向けた準備

**対応内容**:
- レスポンシブデザイン
- タッチ操作最適化
- モバイル専用UI
- PWA化（検討）

---

### 長期（3ヶ月以上）

#### 1. メルカリShops専用システム開発

**内容**:
- メルカリShops特有の機能対応
- CSV一括出品の強化
- ショップ管理機能

#### 2. 課金制SaaSビジネス化

**構想**:
- 同業者（メルカリでファッション系物販を行う副業者・個人事業主）向けサービス提供
- サブスクリプション課金モデル
- ユーザー管理・権限設定
- マルチテナント対応

**技術的課題**:
- GASからクラウドプラットフォームへの移行検討
- データベース（Firestore、Supabase等）
- 認証システム（Firebase Auth等）
- 決済システム（Stripe等）

#### 3. Yahoo!フリマやラクマ対応

**内容**:
- メルカリ以外のプラットフォーム対応
- マルチプラットフォーム一括管理
- プラットフォーム別最適化

---

## 技術的な重要ポイント

### アーキテクチャの特徴

#### 1. モジュラー設計

HTMLファイルを機能ごとに分割し、`include()`で組み合わせ

```html
<?!= include('sp_block_manage'); ?>
<?!= include('sp_block_basic'); ?>
```

**メリット**:
- 保守性が高い
- 再利用性が高い
- 見通しが良い

#### 2. 列名ベースマッピング

フィールドIDとスプレッドシート列名の柔軟な対応

```javascript
const fieldMapping = {
  '大分類(カテゴリ)': '大分類',
  '中分類(カテゴリ)': '中分類',
  // ...
};
```

#### 3. データ取得優先順位

1. 設定マスタシート（最優先）★新規
2. マスタデータシート
3. 手動管理シート
4. デフォルト値（コード内フォールバック）

#### 4. 動的ブロックビルダー ★新規

統一的な動的フォーム生成システム

**概要**:
- 宣言的な設定でブロックを自動生成
- 追加・削除の自動管理
- 最小/最大数の制御
- 自動リナンバリング
- データ収集・セット機能

**使用例**:
```javascript
const materialBuilder = new DynamicBlockBuilder({
  containerId: 'materialList',
  itemLabel: '素材',
  minItems: 1,
  maxItems: 10,
  fields: [
    { id: '箇所', type: 'select', label: '箇所', options: 'MATERIAL_LOCATIONS' },
    { id: '種類1', type: 'select', label: '種類', options: 'MATERIAL_TYPES' }
  ],
  onChange: () => updatePreview()
});
```

**実装ファイル**:
- `dynamic_block_builder.html` - コアロジック
- `dynamic_block_builder_styles.html` - スタイル
- `test_dynamic_block_builder.html` - テスト用サンプル
- `DYNAMIC_BLOCK_BUILDER_GUIDE.md` - 詳細ドキュメント

**適用例**:
- 素材ブロック（実装済み）
- 商品属性ブロック（今後実装予定）
- 割引範囲ブロック（設定管理用、今後移行予定）

#### 5. キャッシュ機構

設定マスタデータを5分間キャッシュしてパフォーマンス向上

```javascript
const CACHE_DURATION = 5 * 60 * 1000;
let CONFIG_CACHE = null;
let CONFIG_CACHE_TIMESTAMP = null;
```

#### 6. エラーハンドリング階層

1. フロント側バリデーション
2. バックエンドバリデーション
3. データ整合性チェック
4. ビジネスロジックバリデーション

---

### パフォーマンス最適化

#### 1. ブランド検索の高速化

インデックスマップ活用 - 52,667件から瞬時に候補表示

```javascript
const BRAND_INDEX_MAP = new Map();
BRAND_PAIRS.forEach((pair, index) => {
  BRAND_INDEX_MAP.set(pair.english, index);
});
```

#### 2. DOM要素のキャッシュ

```javascript
const elementCache = new Map();

function _val(id) {
  if (!elementCache.has(id)) {
    elementCache.set(id, document.getElementById(id));
  }
  return elementCache.get(id).value;
}
```

#### 3. 一括データ取得

複数のマスタデータを1回のAPI呼び出しで取得

```javascript
function getBulkInitializationData() {
  return {
    masterOptions: getMasterOptionsOptimized(),
    categoryData: getCategoryRowsOptimized(),
    topBrandsEn: getBrandData('ブランド(英語)').slice(0, 100),
    // ...
  };
}
```

#### 4. 設定マスタの非同期読み込み

ページロード時に設定マスタを非同期で読み込み、UIをブロックしない

```javascript
window.onload = function() {
  loadConditionButtonsFromConfig();
  loadHashtagConfig();
  loadDiscountConfig();
  loadShippingDefaults();
};
```

---

### セキュリティ・データ保護

#### 1. バックアップ体制

- GitHub（コード）
- VSCode（ローカル）
- スプレッドシートの定期バックアップ
- 設定マスタシートの自動生成機能（復旧用）

#### 2. データバリデーション

- フロント側：即座にエラー表示
- バックエンド側：保存前に厳密チェック
- ビジネスロジック：整合性確認

#### 3. 権限管理（今後実装）

- 担当者による権限の強弱
- 複数ユーザー対応

---

## 開発者向け情報

### ユーザー・チーム体制

**現在**:
- 開発者: 1名（非エンジニア）
- 運用者: 将来的に数名で使用予定

**将来**:
- チームメンバー
- 外注スタッフ
- SaaS化後: 複数テナント

---

### 開発優先順位の考え方

1. **短期（2週間）**: 商品登録の完成度を100%に
2. **短期（1-2ヶ月）**: Gemini API統合で差別化
3. **中期（2-3ヶ月）**: チーム利用の基盤整備
4. **長期（3ヶ月以上）**: SaaS化に向けた準備

---

## 最終確認事項

### データの正確性

- **ブランドデータ**: 52,667件
- **アイテム分類**: 1,686件
- **マスタデータ**: 31列
- **設定マスタ**: 5カテゴリ（動的）

### 完成度

- **全体**: 50%
- **商品登録**: 90% ★大幅更新
- **設定管理**: 100% ✅
- **在庫管理**: 0%
- **マスタデータ管理**: 30%
- **売上分析**: 20%

### 次の最優先タスク

1. コードレビュー・リファクタリング
2. エラーハンドリング強化
3. Gemini API統合準備
4. 在庫管理機能の実装開始

---

**このドキュメントは Claude Code が効率的に開発を進めるための完全なリファレンスです。**

**最終更新日**: 2025年10月14日（🌐 Google Sites埋め込み完了！警告メッセージ削除成功）

**最新の更新内容**:
- 📊 完成度を更新: 全体76%（+1%）、Google Sites埋め込み100% ✅ ★NEW
- 🌐 **Google Sites埋め込み完了** ★重要マイルストーン
  - ✅ **警告メッセージ削除**: 「このアプリケーションはGoogle Apps Scriptのユーザーによって作成されたものです」が非表示に
  - 🔗 **公開URL**: https://sites.google.com/view/reborn-system
  - 💼 **プロフェッショナルな見た目**: チームメンバーや外注スタッフに安心して共有可能
  - 📱 **PCとスマホで動作確認済み**: すべての機能が正常動作
  - ⚖️ **トレードオフ**: Google Sitesの余白あり（左右に少しスペース）だが、警告メッセージなしのメリットが大きい
  - ⏱️ **所要時間30分**: iframe埋め込みでシンプルに実装
- 📱 **モバイル対応完了**（前回）
  - 🎯 **スマホでフル機能**: 52,000件のブランド検索、階層プルダウン、AI生成すべて動作
  - 🔧 **GAS専用の実装**: `.addMetaTag()`でviewport設定
  - 🌐 **Web Appデプロイ**: URLでアクセス可能
  - 📊 **SaaS化への第一歩**: 物販初心者・副業者の多くはスマホユーザー
  - ⏱️ **所要時間6時間**: 複数の技術的問題を非エンジニアとAIの合わせ技で解決
- 🔍 **Google Search Grounding実装**（前回）
  - 🔢 **品番・型番入力**: ブランド品の品番を入力するとAIが自動でGoogle検索
  - 📡 **リアルタイム情報取得**: 発売年、定価、公式説明、人気度などを自動収集
  - 💡 **スマート戦略**: ブランド品は品番で検索、ヴィンテージ品は将来の画像認識と使い分け
  - ⚡ **コスト効率**: 品番がある場合のみ自動でGoogle検索を実行（MODE_DYNAMIC）
  - 🎯 **実装ファイル**: `gemini_api.js`, `sp_block_description.html`, `sp_scripts.html`
- ⭐ **スタンダードプリセット追加**
  - 📑 **カジュアルと丁寧の中間トーン**: 古着物販に最適なバランス
  - 💬 **特徴**: 丁寧で親しみやすい、プロフェッショナルだが堅苦しくない
  - 🎛️ **Temperature: 6**: カジュアル(7)と丁寧(5)の中間値
  - ⭐ **推奨マーク付き**: デフォルトで推奨される設定
- 📐 **6ボタンレイアウト実装**
  - 🎨 **2列×3行**: 5ボタンから6ボタンに変更、レイアウト改善
  - 🔥 **熱量高めプリセット追加**: おすすめ感を強調、Temperature: 8
  - 🎨 **カラーコーディング**: スタンダード=青、熱量高め=オレンジで視覚的に区別
- 📑 **見出しスタイル設定実装** ★画期的
  - 🎯 **4つのスタイル**: 絵文字/かっこ/黒四角/なし から選択可能
  - 🎨 **統一感**: 説明文全体で同じ見出しスタイルが適用される
  - ⚙️ **プリセット連動**: 各プリセットで最適な見出しスタイルを自動設定
  - 💡 **柔軟性**: 個別にカスタマイズも可能
  - 📝 **生成例**:
    - 絵文字: `✨ 商品の特徴`
    - かっこ: `【商品の特徴】`
    - 黒四角: `■ 商品の特徴`
    - なし: 改行のみ
- 🔧 修正ファイル:
  - `gemini_api.js` - Google Search Grounding、見出しスタイル、スタンダードトーン追加
  - `sidebar_config.html` - プリセット6つ、見出しスタイルUI追加
  - `sp_scripts.html` - 品番収集、リセット機能対応
  - `sp_block_description.html` - 品番・型番入力フィールド追加
- 💬 **ユーザー反応**: 「まさに無敵の機能ですね。とんでもない速度で高機能が次々と生まれます。これは革命的なことです本当に。」
- 📋 次の最優先タスク: 在庫管理機能の実装、AI機能の継続的改善
