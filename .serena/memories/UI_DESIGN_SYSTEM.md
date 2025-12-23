# REBORN UI デザインシステム

**最終更新: 2025-12-23**

このドキュメントは、REBORN PWAのUI実装における統一ルールを定義します。
すべての新規実装・修正時にこのルールに従ってください。

---

## 基本原則

- **シンプル**: 装飾を最小限に、機能を明確に
- **統一感**: 全画面で同じルールを適用
- **アクセシブル**: 誰でも使いやすいデザイン

---

## アイコン

### 使用ライブラリ
```
Bootstrap Icons (CDN)
https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css
```

### 基本ルール
- ✅ Bootstrap Icons (`bi-*`) を基本として使用
- ❌ Font Awesome は使用しない

### アイコン使い分けルール

| 場所 | 使用するアイコン | 例 |
|------|-----------------|-----|
| ヘッダーボタン | Bootstrap Icons | `<i class="bi bi-chevron-left">` |
| メニュー項目 | Bootstrap Icons | `<i class="bi bi-gear">` |
| タイトル・見出し | なし（テキストのみ） | `<h2>タスク管理</h2>` |
| **内訳・カテゴリアイコン** | **カラー絵文字 + 背景** | 下記参照 |

### カラーアイコンエリア（カテゴリ表示用）

内訳やカテゴリを視覚的に区別する場合、**背景付きアイコンエリア**で絵文字を使用可能。

```html
<!-- 良い例: 背景付きアイコンエリア -->
<div class="category-icon listing">📦</div>
<div class="category-icon shipping">🚚</div>
<div class="category-icon achievement">🏆</div>

<!-- 悪い例: 絵文字を直接テキストに使用 -->
<h2>📋 タスク管理</h2>
<div>👥 ユーザー別タスク状況</div>
```

```css
/* カラーアイコンエリアのスタイル */
.category-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}
.category-icon.listing { background: #dbeafe; }   /* 青系 - 出品 */
.category-icon.shipping { background: #fef3c7; }  /* 黄系 - 発送 */
.category-icon.success { background: #d1fae5; }   /* 緑系 - 成功 */
.category-icon.danger { background: #fee2e2; }    /* 赤系 - 警告 */
.category-icon.info { background: #e0e7ff; }      /* 紫系 - 情報 */
```

### 使い分けまとめ

| パターン | OK/NG | 理由 |
|----------|-------|------|
| `<i class="bi bi-gear"></i> 設定` | ✅ | Bootstrap Icons + テキスト |
| `📦` (背景付きエリア内) | ✅ | カテゴリを視覚的に区別 |
| `📋 タスク管理` (見出し) | ❌ | 見出しに絵文字は使わない |
| `👥 ユーザー` (ラベル) | ❌ | ラベルに絵文字は使わない |

---

## カラーパレット

### ブランドカラー
| 名前 | 値 | 用途 |
|------|-----|------|
| Primary | `#40B4E5` | アクセント、リンク、選択状態 |
| Primary Dark | `#1E8FBF` | ホバー、アクティブ状態 |

### テキストカラー
| 名前 | 値 | 用途 |
|------|-----|------|
| 本文 | `#333333` | メインテキスト |
| サブ | `#666666` | 補足テキスト |
| 薄い | `#9ca3af` | プレースホルダー、無効状態 |
| 見出し | `#374151` | セクション見出し |

### 背景カラー
| 名前 | 値 | 用途 |
|------|-----|------|
| 画面背景 | `#f5f5f5` | ページ全体の背景 |
| カード | `#ffffff` | カード、モーダル |
| セクション | `#f9fafb` | グループ化された領域 |
| ボーダー | `#f0f0f0` | 区切り線、枠線 |

### ステータスカラー（数字・バッジ用）
| 名前 | 値 | 用途 |
|------|-----|------|
| 情報 | `#3b82f6` | 総数、情報系 |
| 警告 | `#f59e0b` | 未完了、注意 |
| 危険 | `#ef4444` | 期限切れ、エラー |
| 成功 | `#10b981` | 完了、成功 |

### カテゴリアイコン背景色
| 名前 | 値 | 用途 |
|------|-----|------|
| 青系 | `#dbeafe` | 出品、在庫 |
| 黄系 | `#fef3c7` | 発送、配送 |
| 緑系 | `#d1fae5` | 完了、成功 |
| 赤系 | `#fee2e2` | 警告、削除 |
| 紫系 | `#e0e7ff` | 情報、その他 |

---

## ヘッダー

### 標準ヘッダー（白背景）
```css
.page-header {
  background: #ffffff;
  height: 56px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: sticky;
  top: 0;
  z-index: 100;
  border-bottom: 1px solid #f0f0f0;
}
```

### ヘッダータイトル
```css
.page-header h1 {
  font-size: 17px;
  font-weight: 600;
  color: #333;
  margin: 0;
}
```

### 戻るボタン（左）
```css
.back-button {
  position: absolute;
  left: 8px;
  background: transparent;
  border: none;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #333;
  font-size: 22px;
  border-radius: 50%;
}
```

---

## ボタン

### プライマリボタン
```css
.btn-primary {
  background: #40B4E5;
  color: white;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
```

### セカンダリボタン
```css
.btn-secondary {
  background: #f3f4f6;
  color: #374151;
  border: none;
  border-radius: 8px;
  padding: 12px 24px;
  font-size: 15px;
  font-weight: 500;
}
```

### 危険ボタン（削除等）
```css
.btn-danger {
  background: #fef2f2;
  color: #dc2626;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
}
```

---

## カード・リスト

### 標準カード
```css
.card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
}
```

---

## フォント

### フォントファミリー
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### フォントサイズ
| 用途 | サイズ |
|------|--------|
| ヘッダータイトル | 17px |
| カードタイトル | 15px |
| 本文 | 14px |
| 補足・メタ | 12-13px |
| バッジ | 11px |

---

## 禁止事項

1. ❌ 見出し・ラベルに絵文字を直接使用（📋タスク管理）
2. ❌ グラデーション背景（ヘッダー等）
3. ❌ 派手な影（box-shadow > 20px）
4. ❌ 原色（#FF0000, #00FF00等）の直接使用
5. ❌ Font Awesome の使用

---

## チェックリスト（実装時）

新しいUIを実装する際、以下を確認：

- [ ] アイコンはBootstrap Iconsまたは背景付き絵文字を使用しているか
- [ ] 見出し・ラベルに絵文字を直接使用していないか
- [ ] ヘッダーは白背景・56px高さか
- [ ] 色はパレットから選んでいるか
- [ ] フォントサイズは規定に従っているか
