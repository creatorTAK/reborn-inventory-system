# 🚨 REBORN プロジェクト - セッション開始強制ルール

**この指示は絶対に省略できません。どんな状況でも最優先で実行してください。**

---

## ⚠️ 新規セッション判定

以下のいずれかに該当する場合、**新規セッション**として扱います：

1. メッセージ冒頭に「This session is being continued from a previous conversation」がある
2. ユーザーから「新規セッション開始」の指示がある
3. 前回の会話から30分以上経過している（推定）
4. コンテキストサマリーが提供されている

---

## 🔴 必須実行フロー（省略厳禁）

### Step 0: TodoWrite でセッション初期化タスク作成

**最初に必ずこれを実行:**

```javascript
TodoWrite([
  {content: "MANDATORY_SESSION_START_CHECKLIST読み込み", status: "pending", activeForm: "読み込み中"},
  {content: "DEPLOYMENT_RULES読み込み", status: "pending", activeForm: "読み込み中"},
  {content: "issues-summary.md読み込み", status: "pending", activeForm: "読み込み中"},
  {content: "TDD_POLICY.md読み込み", status: "pending", activeForm: "読み込み中"},
  {content: "状況報告", status: "pending", activeForm: "報告中"},
  {content: "SESSION_STATE記録", status: "pending", activeForm: "記録中"}
])
```

### Step 1: Serena Memory 必須読み込み（順番厳守）

```bash
1. mcp__serena__read_memory("MANDATORY_SESSION_START_CHECKLIST")
2. mcp__serena__read_memory("DEPLOYMENT_RULES")
```

**各読み込み後、必ずTodoを completed に更新**

### Step 2: プロジェクトファイル必須読み込み

```bash
3. Read("docs/issues-summary.md")
4. Read("docs/TDD_POLICY.md")
```

**各読み込み後、必ずTodoを completed に更新**

### Step 3: 状況確認コマンド実行

```bash
5. git log --oneline -3  # 最新コミット確認
6. git status            # 未コミット変更確認
```

### Step 4: ユーザーへの報告（簡潔に）

```markdown
✅ セッション開始チェック完了

📊 **プロジェクト状況:**
- 未完了Issue: X件 (詳細: issues-summary.md参照)
- 最新コミット: [ハッシュ] [メッセージ]
- 未コミット変更: あり/なし
- PWA最新デプロイ: @[番号]

🚀 **準備完了:** 作業を開始できます
```

### Step 5: SESSION_STATE 記録

```bash
mcp__serena__write_memory("SESSION_STATE", `
セッション開始: [現在日時]
読み込み完了: ✅ MANDATORY_SESSION_START_CHECKLIST, DEPLOYMENT_RULES, issues-summary.md, TDD_POLICY.md
未完了Issue: [件数]
最新コミット: [ハッシュ] [メッセージ]
PWAデプロイID: AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA
最新バージョン: @[番号]
`)
```

**全Todo完了後、最終報告**

---

## 🔒 ルール遵守の仕組み

### 1. TodoWrite 活用（必須）
- セッション開始時、必ず6つのTodoを作成
- 1つずつ順番に実行し、completed に更新
- **全Todo完了まで、他の作業は一切行わない**

### 2. メモリ活用
- SESSION_STATE に常にセッション状態を記録
- 30分ごとに SESSION_STATE を更新
- 作業完了時に SESSION_STATE を更新

### 3. エラー時の対応
- エラーが発生したら、該当Todoを in_progress のまま保持
- エラー内容をユーザーに報告
- **勝手に次のステップに進まない**

---

## 📋 セッション中の定期チェック

### 30分ごと（推定）
```bash
1. git status で未保存変更確認
2. TodoWrite で進捗確認
3. SESSION_STATE 更新
```

### デプロイ前（必須）
```bash
1. DEPLOYMENT_RULES 再読み込み
2. docs/配下の変更 → git push origin main
3. GAS配下の変更 → clasp push + clasp deploy --deploymentId [固定ID]
4. 両方の変更 → 両方実行
```

### Issue完了時（必須）
```bash
1. issues.md から issues-closed.md に移動
2. issues-summary.md 更新
3. Git commit
```

---

## 🚫 絶対にやってはいけないこと

❌ セッション開始チェックをスキップ
❌ Todo作成せずに作業開始
❌ メモリ読み込みを省略
❌ DEPLOYMENT_RULES を読まずにデプロイ
❌ .claspignore を確認せずに clasp push
❌ PWAファイル変更後に git push を忘れる
❌ Issue完了時に issues-summary.md を更新し忘れる

---

## 💡 ユーザーへの提案

もし私（AI）がこのルールを守らなかった場合：

1. **すぐに指摘してください**
2. **このファイルを読み直すよう指示してください**
3. **必要に応じて /session-start コマンドを実行させてください**

---

**最終更新: 2025-11-15**
**ルール改訂理由: セッション開始時の必須チェックを確実に実行するため**
