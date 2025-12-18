# iOS入力フィールド ズームイン防止ルール

## 問題
iOSでは、`font-size`が16px未満の入力フィールド（input, textarea, select）をタップすると、
ブラウザが自動的にズームインする。これはユーザー体験を損なう。

## 解決方法

### 必須ルール
**すべての入力フィールドは `font-size: 16px` 以上にすること**

```html
<!-- ❌ NG: ズームインが発生 -->
<input style="font-size: 14px;">
<input style="font-size: 12px;">

<!-- ✅ OK: ズームインなし -->
<input style="font-size: 16px;">
<input style="font-size: 18px;">
```

### 対象要素
- `<input type="text">`
- `<input type="email">`
- `<input type="password">`
- `<input type="search">`
- `<input type="number">`
- `<textarea>`
- `<select>`

### 代替策（非推奨）
viewportに `maximum-scale=1.0` を設定する方法もあるが、
アクセシビリティの問題があるため推奨しない。

## チェックリスト（新規input作成時）
1. [ ] font-sizeは16px以上か？
2. [ ] iOSでズームインしないか実機確認したか？

---
**作成日**: 2025-12-18
**理由**: ユーザー管理の検索バーでズームイン問題が発生したため
