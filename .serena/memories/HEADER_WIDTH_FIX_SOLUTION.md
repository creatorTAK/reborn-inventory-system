# ヘッダー幅問題の解決策（2025-12-16）

## 問題
product.htmlのヘッダー幅がボトムナビより狭い

## 原因（確定）
- **ボトムナビ**: `position: fixed; left: 0; right: 0;` → ビューポート基準で全幅
- **ヘッダー**: `position: sticky` → 親要素（body）の幅に制約される
- bodyはスクロールバー分だけviewportより狭い（約6px）

## 試した方法（効果なし）
1. v300: `width: 100vw; margin-left: calc(50% - 50vw);` → 水平スクロールの原因になる
2. v301: `max-width: none !important;` → 親要素（body）を超えられない

## 確実な解決策
ヘッダーをボトムナビと同じ構造にする：

```css
/* reborn-theme.css の .header を修正 */
.header {
  position: fixed;  /* sticky → fixed に変更 */
  top: 0;
  left: 0;
  right: 0;
  width: auto;  /* left/rightで幅を決定 */
}

/* コンテンツにヘッダー分の余白を追加 */
/* product.htmlの場合 */
.platform-tabs-container {
  margin-top: 98px; /* ヘッダーの高さ分（padding 28px × 2 + コンテンツ） */
}
```

## 注意点
- position: fixed にすると、ヘッダーは常に画面上部に固定される
- stickyのような「スクロールでくっつく」動作ではなくなる
- 他の画面（scan.html等）にも影響するため、reborn-theme.cssを修正する場合は全画面確認が必要

## 再開時の指示
「ヘッダー幅問題の続き。HEADER_WIDTH_FIX_SOLUTIONメモリを読んで、position: fixedへの変更を実装してください」
