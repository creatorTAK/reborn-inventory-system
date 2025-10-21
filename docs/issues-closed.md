# Issues（完了・アーカイブ）

このファイルは、REBORN Inventoryプロジェクトの**完了したIssue**をアーカイブします。

**運用ルール：**
- `docs/issues.md` で ✅ DONE になったIssueをここに移動
- 新しい完了Issueは最上部に追加（日付順）
- 削除せずに保管（将来の参考資料として活用）

**関連ドキュメント：**
- [TDD_POLICY.md](./TDD_POLICY.md) - Issue管理ルール詳細
- [issues.md](./issues.md) - 未完了Issue一覧

---

## 📚 完了Issue一覧

## BUG-001 | バグ: リセット処理でReferenceError発生 ✅ DONE (完了日: 2025-10-21)

### 📌 基本情報
- [x] カテゴリ: バグ修正
- [x] 優先度: 高
- [x] 影響範囲: リセット機能
- [x] 発見日: 2025-10-21

### 🐛 不具合内容
リセットボタンをクリックすると、以下のエラーが発生してリセット処理が中断される：

```
ReferenceError: Can't find variable: defaultSalesword
```

**エラー発生タイミング:**
- 商品登録後にリセットボタンをクリック
- エラーダイアログ「リセット処理中にエラーが発生しました。ページを再読み込みしてください。」が表示

### ✅ 期待動作
リセットボタンをクリックしても、エラーなく正常にリセット処理が完了する。

### 📍 関連ファイル
- `sp_scripts.html` (3122行目、3799-3804行目)

### 🐛 根本原因
- `defaultSalesword` がローカル変数として宣言されていた（3122行目）
- `onReset()` 関数からアクセスできないスコープにあった
- スコープ外の変数にアクセスしようとして ReferenceError が発生

### ✏️ 修正内容
- [x] defaultSaleswordをグローバル変数として宣言（190-191行目）
- [x] 他のグローバル変数（SALESWORD_FORMAT, CONDITION_HISTORYなど）と同じ場所に配置
- [x] ローカル宣言を削除（3125行目）
- [x] グローバル宣言への参照コメントを追加

**実装詳細:**
```javascript
// 190-191行目に追加
// デフォルトセールスワード設定
let defaultSalesword = null;

// 3125行目を変更
// 修正前: let defaultSalesword = null;
// 修正後: // defaultSalesword はグローバル変数として宣言済み（190行目）
```

### 📝 テスト結果
- [x] リセット処理が正常に完了することを確認
- [x] ReferenceErrorが発生しないことを確認

### 状態
- [x] ✅ DONE (完了日: 2025-10-21)

---

**完了Issue数: 1件**
**最終更新: 2025-10-21**
