# REBORNテーマ - クイックスタートガイド

## 5分で始めるREBORNデザインシステム

このガイドに従えば、5分で既存ページにREBORNブランドカラーを適用できます。

---

## Step 1: CSSファイルの追加（2分）

既存HTMLファイルの`<head>`セクションに以下を追加してください。

### Before（適用前）

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>在庫管理</title>

  <!-- Bootstrap 5 -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

  <style>
    /* カスタムスタイル */
  </style>
</head>
```

### After（適用後）

```html
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>在庫管理</title>

  <!-- Bootstrap 5 -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

  <!-- ✨ REBORNテーマ（追加） -->
  <link rel="stylesheet" href="https://www.reborn-inventory.com/css/reborn-brand-colors.css">
  <link rel="stylesheet" href="https://www.reborn-inventory.com/css/reborn-theme.css">

  <style>
    /* カスタムスタイル */
  </style>
</head>
```

**重要**: CSS読み込み順序を守ってください
1. Bootstrap 5 CDN
2. reborn-brand-colors.css
3. reborn-theme.css
4. カスタムスタイル（既存の`<style>`タグ）

---

## Step 2: 動作確認（3分）

### 確認項目

ページをブラウザで開き、以下を確認してください：

#### ✅ ボタンの色変更
```html
<!-- 自動的にREBORNブルー(#40B4E5)に変わる -->
<button class="btn btn-primary">保存</button>
<button class="btn btn-info">情報</button>
```

**期待する結果**:
- ボタン背景色: #40B4E5（明るいスカイブルー）
- Hover時: #1E8FBF（濃い青）
- Active時: #1A7AA3（さらに濃い青）

#### ✅ リンクの色変更
```html
<a href="#">リンクテキスト</a>
```

**期待する結果**:
- デフォルト: #1E8FBF（濃い青）
- Hover時: #1A7AA3（さらに濃い青） + 下線表示

#### ✅ バッジの色変更
```html
<span class="badge bg-primary">新着</span>
<span class="badge bg-info">情報</span>
```

**期待する結果**:
- 背景色: #40B4E5（REBORNブルー）
- テキスト色: #FFFFFF（白）

#### ✅ カードヘッダーのグラデーション
```html
<div class="card">
  <div class="card-header">商品情報</div>
  <div class="card-body">...</div>
</div>
```

**期待する結果**:
- ヘッダー: #40B4E5 → #1E8FBFのグラデーション
- テキスト: 白色

---

## Step 3: 追加機能の活用（オプション）

### アクセントカラーの使用

重要なアクション、CTA（Call to Action）ボタンにはアクセントカラーを使用できます。

```html
<!-- オレンジ色のアクセントボタン -->
<button class="btn btn-accent">今すぐ登録</button>

<!-- アクセントバッジ -->
<span class="badge bg-accent">重要</span>
```

### グラデーション背景

```html
<!-- REBORNブランドグラデーション -->
<div class="bg-primary-gradient p-4 text-white">
  <h2>REBORNInventory</h2>
  <p>統一されたブランドデザイン</p>
</div>
```

### Hover時のリフト効果

```html
<!-- ホバー時に浮き上がるカード -->
<div class="card hover-lift">
  <div class="card-body">
    マウスを乗せると浮き上がります
  </div>
</div>
```

---

## トラブルシューティング

### 問題: カラーが変わらない

**原因1**: CSS読み込み順序が間違っている

**解決策**:
```html
<!-- ❌ 間違った順序 -->
<link rel="stylesheet" href="reborn-theme.css">
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

<!-- ✅ 正しい順序 -->
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
<link rel="stylesheet" href="reborn-theme.css">
```

**原因2**: インラインスタイルが優先されている

**解決策**:
```html
<!-- ❌ インラインスタイルを削除 -->
<button class="btn btn-primary" style="background-color: #007bff;">NG</button>

<!-- ✅ クラスのみ使用 -->
<button class="btn btn-primary">OK</button>
```

**原因3**: カスタムCSSが上書きしている

**解決策**:
```html
<style>
  /* ❌ カスタムCSSで色を上書きしている */
  .btn-primary {
    background-color: #007bff !important;
  }

  /* ✅ 削除するか、テーマ変数を使用 */
  .custom-button {
    background-color: var(--bs-primary); /* REBORNカラーを使用 */
  }
</style>
```

### 問題: モバイルで表示が崩れる

**解決策**: Viewportメタタグを確認
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
```

---

## クラス早見表

### ボタン

| クラス | 色 | 用途 |
|-------|---|-----|
| `.btn-primary` | REBORNブルー (#40B4E5) | 主要アクション |
| `.btn-info` | REBORNブルー (#40B4E5) | 情報表示 |
| `.btn-accent` | オレンジ (#FF8C42) | 強調アクション |
| `.btn-success` | グリーン (#10b981) | 成功・完了 |
| `.btn-warning` | イエロー (#f59e0b) | 警告 |
| `.btn-danger` | レッド (#ef4444) | 削除・危険 |

### バッジ

| クラス | 色 | 用途 |
|-------|---|-----|
| `.badge.bg-primary` | REBORNブルー | 通常のバッジ |
| `.badge.bg-info` | REBORNブルー | 情報バッジ |
| `.badge.bg-accent` | オレンジ | 強調バッジ |
| `.badge.text-bg-primary` | 枠線のみ | アウトラインバッジ |

### 背景色

| クラス | 色 | 用途 |
|-------|---|-----|
| `.bg-primary` | REBORNブルー | 単色背景 |
| `.bg-primary-light` | 薄いREBORNブルー | 淡い背景 |
| `.bg-primary-gradient` | グラデーション | ヘッダー・ヒーロー |
| `.bg-accent` | オレンジ | アクセント背景 |

### テキスト色

| クラス | 色 | 用途 |
|-------|---|-----|
| `.text-primary` | REBORNブルー | 強調テキスト |
| `.text-primary-dark` | 濃いREBORNブルー | リンク等 |
| `.text-accent` | オレンジ | アクセントテキスト |

---

## CSS変数の活用（上級者向け）

カスタムスタイルでREBORNカラーを使用する場合、CSS変数を活用してください。

```css
.custom-element {
  /* REBORNブランドカラー */
  background-color: var(--bs-primary);
  color: var(--bs-primary-dark);
  border: 2px solid var(--bs-primary);

  /* ホバー時 */
  &:hover {
    background-color: var(--bs-primary-dark);
  }

  /* アクセントカラー */
  .highlight {
    background-color: var(--bs-accent);
  }
}
```

### 利用可能な主要変数

```css
/* Primary Colors */
--bs-primary: #40B4E5;
--bs-primary-rgb: 64, 180, 229;
--bs-info: #40B4E5;

/* Accent */
--bs-accent: #FF8C42;
--bs-accent-rgb: 255, 140, 66;

/* Semantic */
--bs-success: #10b981;
--bs-warning: #f59e0b;
--bs-danger: #ef4444;

/* Link */
--bs-link-color: #1E8FBF;
--bs-link-hover-color: #1A7AA3;

/* Borders */
--bs-border-radius: 8px;
--bs-border-radius-lg: 12px;

/* Shadows */
--bs-box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
--bs-box-shadow-lg: 0 4px 12px rgba(0, 0, 0, 0.08);
```

---

## チェックリスト

テーマ適用完了後、以下を確認してください：

### 視覚確認
- [ ] ボタンがREBORNブルー（#40B4E5）で表示されている
- [ ] リンクが濃い青（#1E8FBF）で表示されている
- [ ] バッジがREBORNブルーで表示されている
- [ ] カードヘッダーがグラデーション表示されている

### インタラクション確認
- [ ] ボタンHover時に色が濃くなる（#1E8FBF）
- [ ] リンクHover時に下線が表示される
- [ ] フォーム要素Focus時にREBORNカラーのリングが表示される

### レスポンシブ確認
- [ ] スマートフォン（375px）で正常表示
- [ ] タブレット（768px）で正常表示
- [ ] デスクトップ（1920px）で正常表示

### アクセシビリティ確認
- [ ] Tabキーでフォーカス移動が視認できる
- [ ] カラーコントラスト比が適切（WCAG 2.1 AA）

---

## サンプルHTML

完全な実装サンプル：

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>REBORN在庫管理 - サンプル</title>

  <!-- Bootstrap 5 -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">

  <!-- REBORNテーマ -->
  <link rel="stylesheet" href="https://www.reborn-inventory.com/css/reborn-brand-colors.css">
  <link rel="stylesheet" href="https://www.reborn-inventory.com/css/reborn-theme.css">
</head>
<body>
  <div class="container mt-5">
    <!-- ヘッダー -->
    <div class="bg-primary-gradient text-white p-4 rounded-3 mb-4">
      <h1>REBORNInventory</h1>
      <p class="mb-0">統一されたブランドデザイン</p>
    </div>

    <!-- カード -->
    <div class="card hover-lift mb-4">
      <div class="card-header">
        商品管理
      </div>
      <div class="card-body">
        <h5 class="card-title">在庫状況</h5>
        <p class="card-text">現在の在庫数を確認できます</p>

        <!-- ボタン -->
        <button class="btn btn-primary me-2">詳細を見る</button>
        <button class="btn btn-accent">新規登録</button>

        <!-- バッジ -->
        <div class="mt-3">
          <span class="badge bg-primary me-2">在庫あり</span>
          <span class="badge bg-accent">重要</span>
          <span class="badge bg-success">完了</span>
        </div>
      </div>
    </div>

    <!-- アラート -->
    <div class="alert alert-primary" role="alert">
      <strong>お知らせ:</strong> REBORNブランドカラーが適用されました！
    </div>

    <!-- リンク -->
    <p>
      <a href="#">マニュアルを見る</a> |
      <a href="#">サポートに問い合わせ</a>
    </p>
  </div>

  <!-- Bootstrap JS -->
  <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
</body>
</html>
```

---

## 次のステップ

### すぐにできること
1. 既存ページに2行のCSSを追加
2. ボタン・リンク・バッジの色変化を確認
3. 問題があればトラブルシューティングを参照

### より詳しく学ぶ
- 📄 包括的実装計画: `/claudedocs/reborn-design-system-implementation-plan.md`
- 🎨 テーマCSS詳細: `/docs/css/reborn-theme.css`
- 🎯 ブランドカラー定義: `/docs/css/reborn-brand-colors.css`

---

## サポート

質問や問題がある場合は、実装計画ドキュメントの「トラブルシューティング」セクションを確認してください。

**Happy Coding with REBORN Design System! 🎨✨**
