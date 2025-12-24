# REBORN デザインシステム

**最終更新**: 2025-12-24

---

## アイコン規約

**基本ルール**: Bootstrap Icons を使用
- 絵文字（Emoji）は使用しない
- 一貫性のあるシンプルなアイコンで統一

```html
<!-- 正しい例 -->
<i class="bi bi-list-ul"></i> 仕入一覧
<i class="bi bi-truck"></i> 発送進捗

<!-- 間違った例 -->
📋 一覧
📦 発送進捗
```

---

## カラーパレット

### メインカラー: ブルー（Primary Blue）
メインUIの基準色。タブ、ボタン、セクションヘッダーに使用。

| 用途 | カラーコード | 説明 |
|------|-------------|------|
| Primary | `#3b82f6` | タブアクティブ、主要ボタン |
| Primary Dark | `#1d4ed8` | ホバー時テキスト |
| Primary Light | `#dbeafe` | ホバー時背景 |
| Section BG | `#f0f9ff` | デフォルト設定セクション背景 |
| Section Border | `#bae6fd` | デフォルト設定セクションボーダー |
| Section Text | `#0369a1` | デフォルト設定セクションテキスト |

### アクセントカラー: ティール/グリーン（Teal Green）
仕入登録の主要アクション、商品リストヘッダー、QRコード生成ボタン。

| 用途 | カラーコード | 説明 |
|------|-------------|------|
| Teal Primary | `#4ECDC4` | 入力モードボタン、商品リストヘッダー |
| Teal Secondary | `#44A08D` | グラデーション終点 |
| Teal Hover | `#26A69A` | ホバー時ボーダー |
| Teal Active Text | `#00897B` | アクティブ時テキスト |
| Teal Light BG | `#e0f7f5` | アクティブ時背景 |
| Teal Very Light | `#f0fdfb` | ボタン背景（薄い） |

**グラデーション**:
```css
background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
```

### サクセスカラー: グリーン（Success Green）
検品情報セクション、完了状態、プログレスバー完了時。

| 用途 | カラーコード | 説明 |
|------|-------------|------|
| Success Primary | `#10b981` | プログレスバー完了 |
| Success Dark | `#059669` | ハイライトテキスト |
| Success Icon | `#22c55e` | 検品セクションアイコン |
| Success Text | `#166534` | 検品セクションテキスト |
| Success Light BG | `#f0fdf4` | 検品セクション背景 |
| Success Border | `#86efac` | 検品セクションボーダー |

### 警告カラー: イエロー（Warning Yellow）
傷・汚れマーキング、アラート、注意セクション。

| 用途 | カラーコード | 説明 |
|------|-------------|------|
| Warning Light BG | `#fef3c7` | マーキングセクション背景 |
| Warning Border | `#fcd34d` | マーキングセクションボーダー |
| Warning Text | `#92400e` | マーキングセクションテキスト |
| Warning Accent | `#f59e0b` | アイコン、ボーダーアクセント |

### ニュートラル（Gray）
テキスト、背景、ボーダーの基本色。

| 用途 | カラーコード | 説明 |
|------|-------------|------|
| Text Primary | `#1f2937` | 主要テキスト |
| Text Secondary | `#374151` | 補助テキスト |
| Text Muted | `#6b7280` | 薄いテキスト |
| Text Light | `#9ca3af` | 非常に薄いテキスト |
| Border | `#e5e7eb` | 標準ボーダー |
| BG Light | `#f3f4f6` | 非アクティブボタン背景 |
| BG Very Light | `#f8f9fa` | カード背景 |

---

## コンポーネントスタイル

### タブナビゲーション
```css
/* タブボタン共通 */
.nav-tabs-custom .nav-link {
  border: none;
  border-radius: 8px;
  padding: 12px 10px;
  color: #6b7280;
  font-weight: 500;
  background: #f3f4f6;
}

/* ホバー */
.nav-tabs-custom .nav-link:hover {
  background: #dbeafe;
  color: #1d4ed8;
}

/* アクティブ */
.nav-tabs-custom .nav-link.active {
  background: #3b82f6;
  color: white;
}
```

### 入力モードボタン（個別入力/一括入力）
```css
.entry-mode-tab {
  border: 2px solid #ddd;
  border-radius: 8px;
  background: white;
}

.entry-mode-tab:hover {
  border-color: #4ECDC4;
}

.entry-mode-tab.active {
  border-color: #4ECDC4;
  background: #e0f7f5;
  color: #00897B;
}
```

### プライマリアクションボタン（ティールグリーン）
```css
.btn-entry-teal {
  background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
  border: none;
  color: white;
  font-weight: 600;
}

.btn-entry-teal:hover {
  background: linear-gradient(135deg, #44A08D 0%, #3d9682 100%);
  color: white;
}
```

### セクションヘッダー（ブルー）
```css
.default-settings-section {
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  padding: 12px;
}

.default-settings-header {
  font-weight: 600;
  color: #0369a1;
}
```

### 警告セクション（イエロー）
```css
.damage-marker-section {
  background: #fef3c7;
  border: 1px solid #fcd34d;
  border-radius: 8px;
}

.damage-marker-header .title {
  color: #92400e;
}

.damage-marker-header .title i {
  color: #f59e0b;
}
```

---

## 使用例

### 仕入管理画面での色使い
1. **メインタブ**: ブルー（`#3b82f6`）
2. **入力モード選択**: ティール（`#4ECDC4`）
3. **デフォルト設定セクション**: ブルー系（`#f0f9ff`）
4. **商品リストヘッダー**: ティール（`#4ECDC4`）
5. **QRコード生成ボタン**: ティールグラデーション
6. **傷・汚れマーキング**: イエロー（`#fef3c7`）
7. **検品情報セクション**: グリーン（`#f0fdf4`）

---

## 今後の統一作業

このデザインシステムを基準に、以下の画面を順次統一：
- [ ] 商品登録画面
- [ ] 在庫管理画面
- [ ] 入出庫履歴画面
- [ ] 設定管理画面
- [ ] マスタ管理画面
