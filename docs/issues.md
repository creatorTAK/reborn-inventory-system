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

### NOTIF-001 | バグ: 非登録端末で通知が重複して2個表示される

#### 📌 基本情報
- [ ] カテゴリ: バグ修正
- [ ] 優先度: 中
- [ ] 影響範囲: プッシュ通知機能
- [ ] 発見日: 2025-10-23

#### 🐛 不具合内容
商品登録後のプッシュ通知が、非登録端末（保存操作をしていない端末）で2個重複して表示される。

**現象:**
- 登録端末（保存操作した端末）：通知1個 ✅ 正常
- 他の端末（2台）：同じ通知が2個表示される 🐛
- ただし、バッジは1個のみ（正常）

**期待動作:**
- すべての端末で通知は1個のみ表示されるべき

#### 📍 関連ファイル
- `web_push.js` (sendPushNotification関数)
- `product.js` (saveProduct関数 - 通知送信トリガー)

#### 🔍 調査結果
- [x] web_push.jsのsendFCMToTokenV1関数を確認
- [x] **原因特定**: `notification`と`data`の両方を送信していた
  - バックグラウンド: FCMが`notification`を自動表示（1個目） + Service Workerが`data`から表示（2個目）
  - フォアグラウンド: `onMessage`ハンドラーが手動表示（1個のみ）

#### 🔧 修正内容
- [x] web_push.js: `notification`フィールドを削除（行310-313）
- [x] `data`フィールドのみ送信に変更
- [x] 重複した`getActiveFCMTokens`関数を削除
- [ ] Gitコミット
- [ ] clasp push
- [ ] 手動デプロイ
- [ ] 動作確認（3台の端末で確認）

#### 📝 テスト結果
- [ ] 登録端末：通知1個
- [ ] 非登録端末1：通知1個
- [ ] 非登録端末2：通知1個
- [ ] デグレード確認: OK / NG

#### 状態
- [ ] ✅ DONE (完了日: )

---

**現在のバグ: 1件**

---

## ✨ 機能追加・改善（Features & Improvements）

**現在の機能追加・改善: 0件**

---

## 🔧 技術的負債・リファクタリング（Technical Debt）

**現在の技術的負債: 0件**

---

**総Issue数: 1件**
**最終更新: 2025-10-23**
