# セッション開始コマンド（軽量版）

**トークン消費量: 約3,000-4,000トークン（通常版の1/3）**

## 実行内容

### Step 1: 最重要メモリのみ読み込み
1. Serena Memory: DEPLOYMENT_RULES を読み込む（デプロイミス防止のため最優先）
2. docs/issues-summary.md を読み込む（Issue把握）

### Step 2: TodoWrite でセッション初期化（簡略版）
以下のTodoを作成：
- [pending] セッション開始チェック完了
- [pending] 未完了Issue確認

### Step 3: 簡潔な状況報告
- 未完了Issue数のみ
- 最新コミット（git log -1）のみ

### Step 4: SESSION_STATE 簡易記録
```
セッション開始: [日時]
未完了Issue: [件数]
最新コミット: [ハッシュ]
```

## 省略される内容（必要時に手動読み込み）
- MANDATORY_SESSION_START_CHECKLIST（デプロイ時のみ読む）
- TDD_POLICY.md（Issue作成時のみ読む）
- git status（変更がある場合のみ確認）

## 使い分け
- **通常作業**: `/session-start-light` を使用（トークン節約）
- **デプロイ作業**: `/session-start` を使用（完全チェック）
- **Issue作業**: `/session-start` を使用（TDD判断が必要）
