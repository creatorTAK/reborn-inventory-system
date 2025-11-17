# ヘッダーUI統一化分析レポート

**作成日**: 2025-11-16
**目的**: 全メニュー画面のヘッダーUI統一デザインシステム策定
**背景**: 戻るボタン実装前に、まずUIを統一する必要がある

---

## 📊 現状分析

### 各メニュー画面のヘッダーUI現状

| 画面 | ファイル | ヘッダー構造 | 問題点 |
|------|----------|--------------|--------|
| **PWA版マスタ管理** | `docs/master-management.html` | ✅ 統一ヘッダーあり | 唯一の標準形 |
| **商品登録** | `sidebar_product.html` | ❌ ヘッダーなし | mobile_header includeあるが空 |
| **在庫管理** | `sidebar_inventory.html` | ❌ ヘッダーなし | モーダルタイトルのみ |
| **入出庫履歴** | `inventory_history_viewer.html` | ⚠️ 簡易タイトルのみ | `<h4 class="page-title">` |
| **設定管理** | `sidebar_config.html` | ❌ ヘッダーなし | タブナビゲーションのみ |

### 詳細な問題点

#### 1. **PWA版マスタ管理** (`docs/master-management.html`)
**現状のヘッダー構造**:
```html
<div class="header">
  <div class="header-content">
    <button class="back-button" id="back-button">
      <i class="bi bi-chevron-left"></i>
    </button>
    <div class="header-title" id="headerTitle">
      <i class="bi bi-gear" id="headerIcon"></i>
      マスタ管理
    </div>
    <div style="width: 40px;"></div> <!-- スペーサー -->
  </div>
</div>
```

**特徴**:
- ✅ 統一された3カラムレイアウト（左：戻るボタン、中央：タイトル、右：スペーサー）
- ✅ Bootstrap Icons使用
- ✅ 戻るボタン実装済み
- ✅ レスポンシブ対応

**スタイル**:
```css
.header {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 12px 16px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 800px;
  margin: 0 auto;
}

.back-button {
  width: 40px;
  height: 40px;
  border: none;
  background: #f3f4f6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
}
```

#### 2. **商品登録** (`sidebar_product.html`)
**現状**:
- ❌ ヘッダーなし
- `<?!= include('mobile_header'); ?>` あるが、mobile_header.htmlは空
- ページタイトル表示なし

**影響**:
- ユーザーが現在どの画面にいるか分からない
- 戻る手段がない

#### 3. **在庫管理** (`sidebar_inventory.html`)
**現状**:
- ❌ ページレベルのヘッダーなし
- モーダル内タイトルのみ（`<h5 class="modal-title">`）
- ダッシュボードセクション見出し：`<h5 class="mb-3">📊 在庫状況ダッシュボード</h5>`

**影響**:
- iframe内で開かれた時、タイトルが見えない
- 戻るボタンを配置する場所がない

#### 4. **入出庫履歴** (`inventory_history_viewer.html`)
**現状のヘッダー**:
```html
<h4 class="page-title">📊 入出庫履歴</h4>
```

**スタイル**:
```css
.page-title {
  margin: 0 0 16px 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #212529;
}

/* PC版: タイトル非表示（モーダルタイトルがあるため） */
@media (min-width: 768px) {
  .page-title {
    display: none;
  }
}
```

**問題点**:
- ⚠️ 簡易的なタイトルのみ
- 戻るボタンなし
- PC版では非表示になる

#### 5. **設定管理** (`sidebar_config.html`)
**現状**:
- ❌ ページヘッダーなし
- タブナビゲーション（`.nav-tabs`）あり
- セクション見出し（`<h4>`）のみ

**問題点**:
- タブが画面上部を占有
- 全体のタイトルがない
- 戻るボタンを配置する場所がない

---

## 🎯 統一デザインシステム提案

### 基本方針

1. **PWA版マスタ管理のヘッダー構造を標準とする**
2. **全メニューに統一されたヘッダーを実装**
3. **レスポンシブ対応（SP/PC両対応）**
4. **Bootstrap Icons使用（既存と統一）**

### 標準ヘッダー構造

#### HTML構造
```html
<!-- 統一ヘッダー -->
<div class="header">
  <div class="header-content">
    <!-- 左：戻るボタン -->
    <button class="back-button" id="back-button">
      <i class="bi bi-chevron-left"></i>
    </button>

    <!-- 中央：タイトル -->
    <div class="header-title" id="headerTitle">
      <i class="bi bi-[ICON]" id="headerIcon"></i>
      [画面タイトル]
    </div>

    <!-- 右：スペーサー（または機能ボタン） -->
    <div style="width: 40px;"></div>
  </div>
</div>
```

#### 画面別タイトルとアイコン

| 画面 | タイトル | アイコン（Bootstrap Icons） |
|------|----------|---------------------------|
| 商品登録 | 商品登録 | `bi-box-seam` |
| 在庫管理 | 在庫管理 | `bi-clipboard-data` |
| 入出庫履歴 | 入出庫履歴 | `bi-clock-history` |
| 設定管理 | 設定管理 | `bi-gear` |
| マスタ管理 | マスタ管理 | `bi-gear` |

#### 共通CSS（reborn-theme.cssに追加）

```css
/* ========================================
   統一ヘッダーシステム
   ======================================== */

.header {
  position: sticky;
  top: 0;
  z-index: 1000;
  background: white;
  border-bottom: 1px solid #e5e7eb;
  padding: 12px 16px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 800px;
  margin: 0 auto;
}

.back-button {
  width: 40px;
  height: 40px;
  border: none;
  background: #f3f4f6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background-color 0.2s;
  color: #374151;
  font-size: 20px;
}

.back-button:hover {
  background: #e5e7eb;
}

.back-button:active {
  background: #d1d5db;
}

.header-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  justify-content: center;
}

.header-title i {
  font-size: 20px;
}

/* レスポンシブ調整 */
@media (max-width: 767px) {
  .header {
    padding: 10px 12px;
  }

  .header-title {
    font-size: 16px;
  }
}
```

---

## 📋 実装手順

### Phase 1: 共通CSSの追加

**ファイル**: `css/reborn-theme.css`

1. 上記の統一ヘッダーCSSを追加
2. キャッシュバスター更新（`?v=xxxx`）

### Phase 2: 各メニューへのヘッダー実装

#### 2.1. 商品登録 (`sidebar_product.html`)

**追加箇所**: `<body>` タグ直後

```html
<body class="<?!= typeof isSidebar !== 'undefined' && isSidebar ? 'sidebar' : '' ?>">
  <!-- ヘッダー -->
  <div class="header">
    <div class="header-content">
      <button class="back-button" id="back-button">
        <i class="bi bi-chevron-left"></i>
      </button>
      <div class="header-title">
        <i class="bi bi-box-seam"></i>
        商品登録
      </div>
      <div style="width: 40px;"></div>
    </div>
  </div>

  <!-- 既存のコンテンツ -->
  <?!= include('sp_block_manage'); ?>
  ...
```

**CSS追加**:
```html
<head>
  ...
  <link rel="stylesheet" href="https://www.reborn-inventory.com/css/reborn-theme.css?v=XXXX">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.0/font/bootstrap-icons.css">
</head>
```

#### 2.2. 在庫管理 (`sidebar_inventory.html`)

**追加箇所**: Loading Overlay直後

```html
<body>
  <!-- Loading Overlay -->
  <div class="loading-overlay" id="loadingOverlay">...</div>

  <!-- ヘッダー -->
  <div class="header">
    <div class="header-content">
      <button class="back-button" id="back-button">
        <i class="bi bi-chevron-left"></i>
      </button>
      <div class="header-title">
        <i class="bi bi-clipboard-data"></i>
        在庫管理
      </div>
      <div style="width: 40px;"></div>
    </div>
  </div>

  <!-- モーダル類 -->
  <div class="modal fade" id="productDetailModal">...</div>
  ...
```

#### 2.3. 入出庫履歴 (`inventory_history_viewer.html`)

**変更箇所**: 既存の `<h4 class="page-title">` を削除し、ヘッダー構造に置き換え

```html
<body>
  <!-- 既存のタイトルを削除 -->
  <!-- <h4 class="page-title">📊 入出庫履歴</h4> -->

  <!-- 新しいヘッダー -->
  <div class="header">
    <div class="header-content">
      <button class="back-button" id="back-button">
        <i class="bi bi-chevron-left"></i>
      </button>
      <div class="header-title">
        <i class="bi bi-clock-history"></i>
        入出庫履歴
      </div>
      <div style="width: 40px;"></div>
    </div>
  </div>

  <div class="container-fluid">
    <!-- フィルタリングセクション -->
    <div class="filter-section">
      ...
```

**削除するCSS**:
```css
/* 削除対象 */
.page-title {
  margin: 0 0 16px 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #212529;
}

@media (min-width: 768px) {
  .page-title {
    display: none;
  }
}
```

#### 2.4. 設定管理 (`sidebar_config.html`)

**追加箇所**: `<body>` タグ直後

```html
<body>
  <!-- ヘッダー -->
  <div class="header">
    <div class="header-content">
      <button class="back-button" id="back-button">
        <i class="bi bi-chevron-left"></i>
      </button>
      <div class="header-title">
        <i class="bi bi-gear"></i>
        設定管理
      </div>
      <div style="width: 40px;"></div>
    </div>
  </div>

  <!-- 既存のコンテンツ -->
  <div class="config-container">
    <div class="nav-tabs-container">
      ...
```

### Phase 3: 戻るボタン機能実装

**各HTMLファイルに追加**:

1. **sessionId受け渡し処理**（DOMContentLoaded内）
2. **addEventListener設定**
3. **goBack()関数実装**

詳細は `claudedocs/TECH-PATTERN-back-button.md` を参照。

---

## ✅ 実装チェックリスト

### 共通準備
- [ ] `css/reborn-theme.css` に統一ヘッダーCSS追加
- [ ] Bootstrap Icons CDN確認（全ファイル）
- [ ] キャッシュバスター更新

### 商品登録 (`sidebar_product.html`)
- [ ] ヘッダーHTML追加
- [ ] Bootstrap Icons CDN追加
- [ ] reborn-theme.css読み込み確認
- [ ] 動作確認（iframe内）

### 在庫管理 (`sidebar_inventory.html`)
- [ ] ヘッダーHTML追加
- [ ] Bootstrap Icons CDN追加
- [ ] reborn-theme.css読み込み確認
- [ ] 動作確認（iframe内）

### 入出庫履歴 (`inventory_history_viewer.html`)
- [ ] 既存タイトル削除
- [ ] ヘッダーHTML追加
- [ ] Bootstrap Icons CDN追加
- [ ] reborn-theme.css読み込み確認
- [ ] 旧CSSクラス削除
- [ ] 動作確認（iframe内 + 直接開く）

### 設定管理 (`sidebar_config.html`)
- [ ] ヘッダーHTML追加
- [ ] Bootstrap Icons CDN確認
- [ ] reborn-theme.css読み込み確認
- [ ] タブナビゲーションとの共存確認
- [ ] 動作確認（iframe内）

---

## 🎨 デザイン詳細

### カラーパレット

| 要素 | カラー | 用途 |
|------|--------|------|
| ヘッダー背景 | `#ffffff` | 白背景 |
| ヘッダーボーダー | `#e5e7eb` | 下部境界線 |
| タイトル文字 | `#1f2937` | ダークグレー |
| 戻るボタン背景 | `#f3f4f6` | ライトグレー |
| 戻るボタン背景（hover） | `#e5e7eb` | グレー |
| 戻るボタン背景（active） | `#d1d5db` | ミディアムグレー |
| アイコン色 | `#374151` | グレー |

### サイズ仕様

| 要素 | サイズ | 備考 |
|------|--------|------|
| ヘッダー高さ | `64px` | padding 12px × 2 + 40px |
| 戻るボタン | `40px × 40px` | 正方形 |
| タイトルフォント（SP） | `16px` | 600 weight |
| タイトルフォント（PC） | `18px` | 600 weight |
| アイコンサイズ | `20px` | Bootstrap Icons |
| コンテナ最大幅 | `800px` | PC版中央寄せ |

### レスポンシブ調整

**スマホ（< 768px）**:
- ヘッダーpadding: `10px 12px`
- タイトルフォント: `16px`

**PC（≥ 768px）**:
- ヘッダーpadding: `12px 16px`
- タイトルフォント: `18px`
- コンテナ: `max-width: 800px; margin: 0 auto;`

---

## 🔄 段階的ロールアウト戦略

### ステップ1: CSS統一（リスク低）
1. `css/reborn-theme.css` に統一ヘッダーCSS追加
2. キャッシュバスター更新
3. デプロイ（影響範囲: なし）

### ステップ2: 1画面でテスト実装（リスク中）
1. `inventory_history_viewer.html` で先行実装
   - 理由: 既存ヘッダーが最もシンプル
2. デプロイ＋動作確認
3. フィードバック収集

### ステップ3: 残り3画面を順次実装（リスク中）
1. `sidebar_inventory.html`
2. `sidebar_product.html`
3. `sidebar_config.html`
4. 各実装後に動作確認

### ステップ4: 戻るボタン機能追加（リスク中）
1. ヘッダーUI統一完了後
2. `TECH-PATTERN-back-button.md` に従って実装
3. 全画面一括実装

---

## 📝 注意事項

### GAS版の制約
- GAS版ファイルは iframe内で開かれることを想定
- 直接開かれた場合と iframe内で開かれた場合の両対応が必要
- `window.self !== window.top` で判定

### Bootstrap Icons依存
- 全ファイルにCDN追加が必要
- オフライン動作に影響する可能性あり（既存PWAは問題なし）

### 既存UIとの共存
- `sidebar_config.html` のタブナビゲーションとヘッダーの共存
- z-index管理（header: 1000, tabs: 100）

### デプロイ順序
1. CSS変更（PWAデプロイ: `git push origin main`）
2. GAS変更（`clasp push` + `clasp deploy`）
3. sessionIdParam追加（index.html: PWAデプロイ）

---

## 🔗 関連ドキュメント

- **戻るボタン技術パターン**: `claudedocs/TECH-PATTERN-back-button.md`
- **Issue UI-016**: 全メニュー戻るボタン実装（後続タスク）
- **デザインシステム**: `.claude/skills/reborn-design-system.md`
- **TDD Policy**: `docs/TDD_POLICY.md`

---

**作成者**: Claude (Anthropic)
**レビュー**: REBORN開発チーム
**最終更新**: 2025-11-16
