# REBORN/フリラ UIデザイン標準規格

**最終更新: 2025-12-21**
**目的: UI/UXの一貫性を保ち、開発中にルールが変わらないようにする**

---

## 1. ヘッダー（ページヘッダー）

### 標準構造
```html
<div class="page-header">
  <button class="back-button" onclick="goBack()">
    <i class="bi bi-chevron-left"></i>
  </button>
  <h1>ページタイトル</h1>
</div>
```

### CSS標準
```css
.page-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(135deg, #40B4E5 0%, #1E8FBF 100%);
  padding: 20px;
  padding-top: calc(20px + env(safe-area-inset-top, 0px));
  color: white;
  text-align: center;
  z-index: 1000;
}
.page-header h1 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}
```

---

## 2. 戻るボタン

### 標準スタイル: 丸型アイコンボタン
- **形状**: 円形（border-radius: 50%）
- **サイズ**: 38px × 38px
- **アイコン**: Bootstrap Icons `bi-chevron-left`
- **背景**: rgba(255, 255, 255, 0.2)
- **配置**: ヘッダー左側、垂直中央

### CSS標準
```css
.page-header .back-button {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  left: 16px;
  background: rgba(255, 255, 255, 0.2);
  border: none;
  border-radius: 50%;
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: white;
  font-size: 18px;
  margin-top: calc(env(safe-area-inset-top, 0px) / 2);
}
.page-header .back-button:active {
  background: rgba(255, 255, 255, 0.3);
}
```

### ❌ 禁止スタイル
- テキスト付きボタン（「← 戻る」など）
- 角丸長方形ボタン

---

## 3. プルダウン（Select）

### プレースホルダー文言
```html
<option value="">-- 選択してください --</option>
```
※ 短縮版の場合: `--選択--`

### CSS標準
```css
.form-select {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 16px;
  font-family: inherit;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  color: #374151;
}
.form-select:focus {
  outline: none;
  border-color: #3b82f6;
  background: #f9fafb;
}
```

### 標準カラー
| 状態 | ボーダー | 背景 | テキスト |
|------|---------|------|---------|
| 通常 | #d1d5db | white | #374151 |
| フォーカス | #3b82f6 | #f9fafb | #374151 |

---

## 4. テキストエリア

### CSS標準
```css
.form-textarea {
  width: 100%;
  min-height: 150px;
  padding: 12px;
  border: 2px solid #e5e7eb;
  border-radius: 12px;
  font-size: 16px;
  font-family: inherit;
  resize: vertical;
  transition: border-color 0.2s;
}
.form-textarea:focus {
  outline: none;
  border-color: #40B4E5;
}
```

---

## 5. ボタン

### プライマリボタン（送信系）
```css
.submit-btn {
  width: 100%;
  padding: 16px;
  background: linear-gradient(135deg, #40B4E5 0%, #1E8FBF 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}
.submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

---

## 6. カラーパレット

### ブランドカラー
| 名称 | カラーコード | 用途 |
|------|-------------|------|
| Primary | #40B4E5 | メインカラー、ヘッダー、ボタン |
| Primary Dark | #1E8FBF | グラデーション終点 |

### UIカラー
| 名称 | カラーコード | 用途 |
|------|-------------|------|
| Border | #d1d5db | フォーム要素のボーダー |
| Border Light | #e5e7eb | テキストエリアのボーダー |
| Focus | #3b82f6 | フォーカス時のボーダー |
| Text | #374151 | 通常テキスト |
| Text Muted | #6b7280 | 補足テキスト |
| Background | #f8f9fa | ページ背景 |
| Error | #ef4444 | 必須マーク、エラー |

---

## 7. フォームラベル

### 必須マーク
```html
<label class="form-label">
  項目名<span class="required">*</span>
</label>
```

```css
.form-label {
  display: block;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
  margin-bottom: 8px;
}
.form-label .required {
  color: #ef4444;
  margin-left: 4px;
}
```

---

## 8. 参照実装ファイル

| 要素 | 参照ファイル |
|------|-------------|
| ヘッダー・戻るボタン | docs/master-management.html |
| プルダウン | docs/config.html |
| フィードバックフォーム | docs/feedback.html |

---

## 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2025-12-21 | 初版作成（v309時点のルールを文書化） |
