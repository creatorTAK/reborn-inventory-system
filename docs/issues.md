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

**現在のバグ: 0件**

---

## ✨ 機能追加・改善（Features & Improvements）

### UI-005 | UI改善: 保存中のローディングオーバーレイ表示

#### 📌 基本情報
- [ ] カテゴリ: UI改善
- [ ] 優先度: 中
- [ ] 影響範囲: 商品登録画面 - 保存処理
- [ ] 要望日: 2025-10-23

#### 💡 改善内容
現在、商品保存時（R2画像アップロード含む）の待ち時間中、画面下部にテキスト表示のみで、何が起きているかわかりにくい。

**現状の問題:**
- 画面下部の小さなテキスト表示のみ
- 進捗がわからない
- 待機が必要なことが明確でない

**改善方針:**
1. 画面全体に半透明オーバーレイを表示
2. 中央にローディング表示
3. 進捗バーで進捗状況を表示（例: 画像 2/3 アップロード中）
4. 完了まで他の操作を無効化

#### ✅ 期待効果
- ユーザーが待機が必要だと明確に理解できる
- 進捗がわかり安心感が増す
- 誤操作（二重送信など）を防止
- メルカリなど主要サービスと同じUX

#### 📍 関連ファイル
- `sp_scripts.html` (saveProduct関数, uploadImagesToR2Direct関数)
- `sp_styles.html` (オーバーレイのスタイル)

#### ✏️ 実装内容
- [x] オーバーレイHTMLの作成（sp_scripts.html）
- [x] オーバーレイCSSの作成（sp_styles.html）
- [x] showLoadingOverlay()関数の実装
- [x] hideLoadingOverlay()関数の実装
- [x] updateProgress()関数の実装（進捗更新）
- [x] saveProduct()とuploadImagesToR2Direct()に組み込み
- [ ] Gitコミット
- [ ] clasp push
- [ ] 手動デプロイ
- [ ] 動作確認

#### 📝 確認結果
- [ ] オーバーレイが画面中央に表示される
- [ ] 進捗バーが正しく更新される
- [ ] 保存中は他の操作ができない
- [ ] 完了後、オーバーレイが消える
- [ ] デグレード確認: OK / NG

#### 状態
- [ ] ✅ DONE (完了日: )

---

**現在の機能追加・改善: 1件**

---

## 🔧 技術的負債・リファクタリング（Technical Debt）

**現在の技術的負債: 0件**

---

**総Issue数: 0件**
**最終更新: 2025-10-23**
