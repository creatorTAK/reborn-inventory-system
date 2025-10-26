# Issues（未完了）

このファイルは、REBORN Inventoryプロジェクトの**未完了Issue**を管理します。

**運用ルール：**
- 新しいIssueは該当カテゴリの最上部に追加
- 完了したIssue（✅ DONE）は `issues-closed.md` に移動
- 定期的にレビュー（週1回推奨）

**関連ドキュメント：**
- [TDD_POLICY.md](./TDD_POLICY.md) - Issue管理ルール詳細
- [ISSUE_TEMPLATE.md](./ISSUE_TEMPLATE.md) - Issue起票テンプレート
- [issues-closed.md](./issues-closed.md) - 完了Issueアーカイブ

---

## 🐛 バグ修正（Bug Fixes）

**現在のバグ: 1件**

---

## INV-002 | バグ修正: PWA版在庫管理画面で商品一覧が表示されない

### 📌 基本情報
- [ ] カテゴリ: バグ修正
- [ ] 優先度: 高
- [ ] 影響範囲: PWA版在庫管理画面
- [ ] 発見日: 2025-10-26

### 🐛 問題内容

PWA版（https://www.reborn-inventory.com）の在庫管理画面で、検索ボタンを押しても商品一覧が表示されない。

**症状:**
- 在庫管理メニューをクリック → 画面は開く
- ダッシュボードは表示される（空データ）
- 検索ボタンをクリック → 商品一覧が表示されない
- コンソールに以下のエラー:
  - `NetworkError: 次の原因のために接続できませんでした: HTTP 0`
  - `SyntaxError: Unexpected EOF`
- FCM登録デバッグシートに何も記録されない（APIが到達していない）

**環境:**
- Frontend: GitHub Pages (https://www.reborn-inventory.com)
- Backend: Google Apps Script Web App
- 問題箇所: sidebar_inventory.html（iframeで表示）

### ✅ 期待動作

- 検索ボタンをクリック → GAS APIにリクエストが送信される
- FCM登録デバッグシートにログが記録される
- 商品一覧が画面に表示される
- コンソールに以下のログ:
  ```
  🔍 [DEBUG] API URL: https://script.google.com/macros/s/.../exec?action=getInventoryDashboard&...
  🔍 [DEBUG] API応答受信: {ok: true, data: {...}}
  ```

### 📍 関連ファイル
- `docs/index.html` (REBORN_CONFIG.GAS_BASE_URL定義)
- `docs/sidebar_inventory.html` (在庫管理UI、fetchJSON実装)
- `menu.js` (GAS Web App、doGet関数、jsonOk_/jsonError_/logDebug_Reach)
- `inventory.js` (getInventoryDashboardAPI関数)

### 🔍 実施済みの調査・対策

#### ChatGPTの提案に基づく修正（実施済み）
1. **docs/index.htmlにGAS_BASE_URL追加**
   - `window.REBORN_CONFIG.GAS_BASE_URL` を定義
   - iframe子ページから参照可能に
   - デプロイ確認済み（curlで確認）

2. **menu.jsにCORS対応追加**
   - `jsonOk_(obj)` - 成功レスポンス
   - `jsonError_(message)` - エラーレスポンス
   - `logDebug_Reach(action, params, startTime)` - デバッグログ
   - 各APIハンドラーを修正（getInventoryDashboard, ping等）

3. **sidebar_inventory.htmlの修正**
   - `fetchJSON()` ヘルパー実装（タイムアウト、エラーハンドリング）
   - GAS_BASE_URLを親windowから取得: `window.parent.REBORN_CONFIG.GAS_BASE_URL`
   - レスポンス構造変更: `{ok:true, data:{success:true, data:{...}}}`

4. **デプロイ完了**
   - GAS: 手動デプロイ完了（2025-10-26 09:09）
   - GitHub Pages: デプロイ完了（curl確認済み）

#### 確認済み事項
- ✅ pingエンドポイント正常動作: `{"ok":true,"data":{"serverTime":"2025-10-26T00:09:59.682Z","message":"pong"}}`
- ✅ docs/index.htmlにREBORN_CONFIG存在確認済み
- ✅ Git commit & push完了（8コミット）
- ❌ 在庫管理画面は依然として動作しない

### 🚨 問題の状況

**実施した対策が全く改善していない:**
- ChatGPTの提案に従って修正を実施
- GitHub Pages、GASともにデプロイ完了
- pingエンドポイントは動作
- しかし在庫管理画面の検索は依然として失敗
- 同じNetworkError、Unexpected EOFが継続

**想定される原因候補:**
1. iframe内でのGAS_BASE_URL取得が失敗している？
2. sidebar_inventory.htmlが正しくデプロイされていない？
3. fetchJSON()の実装に問題がある？
4. ブラウザキャッシュの問題？
5. 根本的に別の原因がある？

### 🧪 テストケース

#### TC-INV-002-001: 在庫管理画面で商品検索
**前提条件:**
- スプレッドシートに商品データが存在
- PWA版 https://www.reborn-inventory.com にアクセス
- ブラウザキャッシュをクリア済み

**実行操作:**
1. 在庫管理メニューをクリック
2. 検索ボタンをクリック
3. コンソールを確認
4. FCM登録デバッグシートを確認

**期待結果:**
- コンソールに `🔍 [DEBUG] API URL: ...` が表示される
- コンソールに `🔍 [DEBUG] API応答受信: {ok: true, ...}` が表示される
- FCM登録デバッグシートに新規ログが記録される
- 商品一覧が画面に表示される
- NetworkErrorが発生しない

**実測結果:**
- ❌ NetworkError: HTTP 0
- ❌ SyntaxError: Unexpected EOF
- ❌ FCM登録デバッグシートに何も記録されない
- ❌ 商品一覧が表示されない

### 🎯 根本原因（特定済み）

**sidebar_inventory.htmlのGASへのデプロイが反映されていない**

**詳細:**
1. sidebar_inventory.htmlはGASから配信されている（GitHub Pagesではない）
2. clasp pushは成功済み（`Script is already up to date.`）
3. しかし、**GAS Web Appを再デプロイしていない**
4. 現在有効なのは古いバージョン（@282）
5. 最新のコード（@HEAD）にはfetchJSON修正が含まれているが、Web Appに反映されていない

**確認結果:**
```bash
# ローカルファイルには修正が反映されている
$ grep -c "fetchJSON" sidebar_inventory.html
3

# デプロイメント状況
$ clasp deployments
- @HEAD: 最新のコード（fetchJSON修正済み）
- @282: 現在有効なWeb Appバージョン（古いコード）
```

### ✏️ 修正手順

- [x] 現状を詳細にまとめる（ChatGPTに再度相談するため）
  - [x] トラブルシューティングドキュメント作成: `docs/INV-002_TROUBLESHOOTING.md`
  - [x] 根本原因の特定完了
- [ ] **GAS Web Appを手動で再デプロイ**（最優先）
  1. GASエディタを開く
  2. 右上「デプロイ」→「デプロイを管理」
  3. 既存のデプロイ（@282）を選択
  4. 「バージョンを編集」→「新バージョン」を選択
  5. 説明: `INV-002修正 - sidebar_inventory.html fetchJSON実装`
  6. 「デプロイ」をクリック
- [ ] ブラウザキャッシュをクリア
- [ ] 動作テスト（TC-INV-002-001）

### 状態
- [ ] ✅ DONE (完了日: )

---

## 🔧 パフォーマンス改善（Performance）

**現在のパフォーマンス課題: 1件**

---

## PERF-001 | パフォーマンス: PWA画面遷移が遅い（特に在庫管理が5秒）

### 📌 基本情報
- [ ] カテゴリ: パフォーマンス改善
- [ ] 優先度: 中
- [ ] 影響範囲: PWA全体（特に在庫管理）
- [ ] 発見日: 2025-10-24

### 🐛 問題内容
PWA版で画面遷移（商品登録、設定、在庫管理）が遅く、体感で鈍い。
特に在庫管理は5秒程度かかり、ロードマークが表示される。

**症状:**
- 商品登録 → 設定 → 在庫管理の遷移に時間がかかる
- 在庫管理は特に遅く、約5秒
- 中央にロードマークが表示される

### ✅ 期待動作
- 画面遷移が1秒以内（目標）
- 最低でも2秒以内に表示開始
- ローディング中も操作可能な状態を維持

### 📍 関連ファイル
- `docs/index.html` (iframe制御、navigateToPage関数)
- `menu.js` (doGet関数、Web App初期化)
- `sidebar_inventory.html` (在庫管理UI、初期化処理)
- `inventory.js` (searchInventoryAPI, getStatisticsAPI)

### 🔍 調査項目
- [ ] iframe読み込み時間を計測
- [ ] GAS Web App初期化時間を計測
- [ ] sidebar_inventory.html初期化時のAPI呼び出しを確認
- [ ] スプレッドシートアクセス時間を計測
- [ ] ブラウザDevToolsでネットワーク/パフォーマンス分析

### 💡 改善案
1. **ローディングUI改善**
   - プログレスバー追加
   - スケルトンUI表示
   - 「読み込み中...」メッセージ

2. **API最適化**
   - 初期表示時は最低限のデータのみ取得
   - 統計情報は遅延ロード
   - ページネーションのデフォルト件数削減（50→20）

3. **キャッシュ活用**
   - 前回の統計情報をlocalStorageにキャッシュ
   - マスタデータ（ブランド、カテゴリ等）をキャッシュ

4. **iframe事前ロード**
   - 非表示iframeで事前にロード
   - 表示時は切り替えのみ

5. **遅延ロード**
   - 画像は遅延ロード
   - 商品一覧は初回10件のみ表示

### ✏️ 実装内容
- [x] パフォーマンス計測（各処理の時間）
- [x] ボトルネック特定（原因: loadDashboard()とsearch()を同時実行）
- [x] Phase 1: ページネーション最適化（50→10件）
- [x] Phase 2: API統合実装（getInventoryDashboardAPI作成）
- [x] sidebar_inventory.htmlの修正（loadDashboardAndSearch()に統合）
- [x] デプロイ完了（GAS）
- [ ] Phase 3: キャッシュ実装（localStorage活用）- 次回実施予定
- [ ] ユーザーテスト実施
- [ ] 改善効果の実測

### 📝 測定結果
- [x] 改善前: 在庫管理ロード時間 約5秒（ユーザー報告）
- [x] 改善後: 在庫管理ロード時間 **3.6〜4.8秒**（実測 2025-10-26）
- [x] 改善率: **約28%削減**（期待より低い）

**実測データ（コンソールログ）:**
- API応答時間1: 3597ms（約3.6秒）
- API応答時間2: 4803ms（約4.8秒）
- **体感的にも遅さを感じる** → Phase 3で改善必須

### 💡 実装した改善内容
**Phase 1: ページネーション最適化**
- デフォルト表示件数: 50件 → 10件に変更
- sidebar_inventory.html: 248行目

**Phase 2: API統合**
- 新規API作成: `getInventoryDashboardAPI(params)` (inventory.js: 817-1122行目)
- 1回のスプレッドシートスキャンで統計と商品一覧の両方を取得
- 既存の`loadDashboard()`と`search()`を`loadDashboardAndSearch()`に統合
- スプレッドシートアクセスを2回→1回に削減

**期待効果 vs 実測:**
- 期待: 約80%削減（5秒→1秒）
- 実測: 約28%削減（5秒→3.6〜4.8秒）
- **ギャップ原因**: 統計計算で全件スキャンが発生している可能性

### 🔧 Phase 3実装予定（優先度: 高）
- [ ] 統計シート活用の確認（recalculateAllStats実行タイミング）
- [ ] localStorageに統計情報をキャッシュ（初回以降は高速化）
- [ ] 初回表示時の統計計算を非同期化
- [ ] 目標: **1秒以内**でダッシュボード+一覧表示

### 状態
- [ ] ✅ DONE (完了日: ) - Phase 3実装後に完了予定

---

## ✨ 機能追加・改善（Features & Improvements）

**現在の機能追加・改善: 1件**

---

## INV-001 | 機能追加: Phase 1 在庫管理システム実装

### 📌 基本情報
- [ ] カテゴリ: 機能追加
- [ ] 優先度: 高
- [ ] 影響範囲: 在庫管理（新規機能）
- [ ] 要望日: 2025-10-24

### 💡 要望内容

Phase 1の在庫管理システムを実装する。以下の機能を含む：

**実装する機能**:
1. 在庫検索・絞り込み機能
2. 商品複製機能（メルカリ再出品、類似商品登録）
3. 在庫状況ダッシュボード
4. ステータス手動変更
5. 出品前商品の編集
6. 画像差し替え

**実装しない機能（Phase 2以降）**:
- 出品後商品の全項目編集
- 複数プラットフォーム管理
- 一括価格変更

### ✅ 期待動作

**在庫検索・絞り込み**:
- ステータス、ブランド、カテゴリ、サイズ、カラー等で絞り込み可能
- 一覧表示（カード形式、50件/ページ）
- ソート機能（登録日時、出品日、販売日、利益金額）

**商品複製**:
- 既存商品データを全コピー
- 管理番号のみ新規採番
- ステータスを「登録済み」にリセット
- 商品登録フォームを開く（データ入力済み）

**在庫状況ダッシュボード**:
- ステータス別件数表示
- 総在庫金額、総出品金額、総販売金額、総利益金額
- 平均在庫日数

### 📍 関連ファイル
- `inventory.js` (在庫管理バックエンド)
- `sidebar_inventory.html` (在庫管理UI)
- `INVENTORY_MANAGEMENT_DESIGN.md` (設計書)

### 🧪 テストケース

#### TC-INV-001-001: 在庫検索（ステータス絞り込み）
**前提条件:**
- スプレッドシートに複数ステータスの商品が存在
  - 登録済み: 5件
  - 出品中: 10件
  - 販売済み: 20件

**実行操作:**
1. 在庫管理画面を開く
2. ステータスフィルタで「出品中」を選択
3. 検索ボタンをクリック

**期待結果:**
- 「出品中」の商品10件のみが表示される
- 他のステータスの商品は表示されない

#### TC-INV-001-002: 商品複製
**前提条件:**
- 管理番号 AA-1001 の商品が存在
- 次の管理番号は AA-1002

**実行操作:**
1. 在庫一覧で AA-1001 の「複製」ボタンをクリック
2. 商品登録フォームが開く
3. そのまま「登録」ボタンをクリック

**期待結果:**
- 新しい商品が AA-1002 として登録される
- AA-1001 のデータ（ブランド、カテゴリ等）が全てコピーされている
- ステータスは「登録済み」
- 出品日、販売日はクリアされている

#### TC-INV-001-003: 在庫状況ダッシュボード
**前提条件:**
- 登録済み: 5件（仕入金額合計: 10,000円）
- 出品中: 10件（仕入金額合計: 50,000円、出品金額合計: 100,000円）
- 販売済み: 20件（販売金額合計: 500,000円、利益金額合計: 200,000円）

**実行操作:**
1. 在庫管理画面を開く
2. ダッシュボードを表示

**期待結果:**
- ステータス別件数が正しく表示される
  - 登録済み: 5件
  - 出品中: 10件
  - 販売済み: 20件
- 総在庫金額: 60,000円
- 総出品金額: 100,000円
- 総販売金額: 500,000円
- 総利益金額: 200,000円

### ✏️ 実装内容

#### Phase 1-1: 在庫検索・絞り込み機能 ✅ 完了
- [x] バックエンド関数実装（`inventory.js`）
  - [x] `searchInventoryAPI(params)` - 検索・絞り込み（ページネーション、ソート、詳細フィルタ対応）
  - [x] `getStatisticsAPI(params)` - 統計情報取得（新ステータス対応）
- [x] フロントエンド実装（`sidebar_inventory.html`）
  - [x] 検索フォームUI
  - [x] フィルタUI（ステータス複数選択、ブランド、カテゴリ、サイズ、カラー、テキスト検索）
  - [x] 一覧表示UI（カード形式、レスポンシブ）
  - [x] ページネーション
  - [x] ソート機能
- [ ] TC-INV-001-001 実行（次回テスト予定）

#### Phase 1-2: 商品複製機能 ✅ 完了
- [x] バックエンド関数実装（`inventory.js`）
  - [x] `duplicateProductAPI(params)` - 商品複製
- [x] フロントエンド実装（`sidebar_inventory.html`）
  - [x] 「複製」ボタン追加
  - [x] 複製処理実装
- [ ] TC-INV-001-002 実行（次回テスト予定）

#### Phase 1-3: 在庫状況ダッシュボード ✅ 完了
- [x] バックエンド関数実装（`inventory.js`）
  - [x] `getStatisticsAPI(params)` - 統計情報取得
- [x] フロントエンド実装（`sidebar_inventory.html`）
  - [x] ダッシュボードUI（ステータス別件数、総利益、平均在庫日数）
  - [x] 統計情報表示
- [ ] TC-INV-001-003 実行（次回テスト予定）

#### Phase 1-4: その他機能
- [x] ステータス手動変更機能（実装完了 2025-10-26）
  - 商品詳細モーダルでステータス選択可能
  - updateProductStatusAPIとの連携
  - 全ステータス間の手動変更に対応
- [x] 出品前商品の編集機能（実装完了 2025-10-26）
  - 「登録済み」「出品準備中」のみ編集可能
  - 編集可能フィールド: ブランド、商品名、カテゴリ、アイテム、サイズ、カラー、素材、商品説明、仕入金額、出品金額
  - 変更フィールドの自動検出と一括更新
  - updateProductAPIとの連携
- [ ] 画像差し替え機能（Phase 2以降に実施 - 別Issue化予定）

### 📝 テスト結果
- [ ] TC-INV-001-001: PASS / FAIL
- [ ] TC-INV-001-002: PASS / FAIL
- [ ] TC-INV-001-003: PASS / FAIL
- [ ] デグレード確認（商品登録機能）: OK / NG

### 状態
- [ ] ✅ DONE (完了日: )

---

---

## 🔧 技術的負債・リファクタリング（Technical Debt）

**現在の技術的負債: 0件**

---

**総Issue数: 0件**
**最終更新: 2025-10-23**
