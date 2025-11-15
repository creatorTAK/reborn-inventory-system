# セッション開始コマンド

**このコマンドは新規セッション開始時に必ず最初に実行してください**

## 実行内容

以下を順番に実行し、TodoWriteで進捗を追跡します：

### Step 1: 必須メモリ読み込み
1. Serena Memory: MANDATORY_SESSION_START_CHECKLIST を読み込む
2. Serena Memory: DEPLOYMENT_RULES を読み込む
3. docs/issues-summary.md を読み込む
4. docs/TDD_POLICY.md を読み込む

### Step 2: TodoWrite でセッション初期化
以下のTodoを作成：
- [pending] セッション開始チェック完了
- [pending] 未完了Issue確認・報告
- [pending] 前回からの変更確認（git log）
- [pending] デプロイ状態確認

### Step 3: 状況報告
- 未完了Issue数
- 最新Gitコミット（git log -3）
- PWA最新デプロイID確認
- 作業継続準備完了報告

### Step 4: セッション状態をメモリに記録
以下の内容でSerena Memory SESSION_STATE を更新：
```
セッション開始: [日時]
読み込み完了: MANDATORY_SESSION_START_CHECKLIST, DEPLOYMENT_RULES, issues-summary.md, TDD_POLICY.md
未完了Issue: [件数]
最新コミット: [ハッシュ]
PWAデプロイID: AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA
最新バージョン: @[番号]
```

## 重要な注意
- このコマンドを実行するまで、他の作業は一切行わない
- 全てのステップを TodoWrite で追跡する
- 各ステップ完了後、必ずTodoを completed に更新する

## エラー時の対応
もしこのコマンドの実行中にエラーが発生したら：
1. エラー内容をユーザーに報告
2. 該当Todoを in_progress のまま保持
3. ユーザーの指示を待つ
