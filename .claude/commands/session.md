# /session - REBORNセッション開始

## 実行タイミング
- Claude Code再起動時
- セッション切り替え時（サマリー後の新規開始）

## 実行手順（この順序で実行）

### 1. Serenaプロジェクトアクティベート
```
mcp__serena__activate_project("reborn-project")
```

### 2. 必須メモリ読み込み（2つのみ）
```
mcp__serena__read_memory("DEPLOYMENT_RULES")
```
※ MANDATORY_SESSION_START_CHECKLISTは不要（このコマンドが代替）

### 3. Issue状況確認（軽量ファイルのみ）
```
Read("docs/issues-summary.md")
```
※ issues.md全体は絶対に読まない（25,000トークン超過）
※ TDD_POLICY.mdはIssue作業時のみ読む

### 4. Git状態確認
```bash
git log --oneline -3
git status
```

### 5. SESSION_STATE更新
```
mcp__serena__write_memory("SESSION_STATE", "セッション開始: [日時], 状態: 指示待ち")
```

### 6. ユーザーに簡潔報告
- 未完了Issue数（優先度別）
- 直近コミット（1行）
- 未コミット変更有無

## 出力形式（簡潔に）

```
## セッション開始完了

**Git:** main, 最新 / 未コミット変更あり
**直近:** [コミットメッセージ]
**Issue:** 7件（最高2, 高3, 中2）

何に取り組みますか？
```

## 🔴 デプロイ時バージョン更新ルール（必須）

**PWAファイル（docs/配下）をコミット＆デプロイする際は、必ず以下を実行:**

1. `docs/index.html` の `#debug-version` テキストを更新する
2. フォーマット: `vMMDD` + アルファベット連番（例: `v0226a` → `v0226b` → `v0226c`）
3. 日付が変わったらリセット（例: `v0227a`）
4. バージョン更新は修正内容と同じコミットに含めるか、直後に別コミットする

**セッション開始時の確認:**
- `git log --oneline -3` で最新バージョンを把握
- 現在のバージョンをユーザーに報告する

## 注意
- 進行中タスクがある場合（サマリーに記載）はタスク継続を優先
- このコマンド以外のセッション開始処理は不要
