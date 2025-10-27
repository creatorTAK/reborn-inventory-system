# 🚨 セッション開始時の必須チェックリスト

**このファイルはセッション開始直後に必ず読むこと**

## 必須タスク（順番厳守）

### 1. issues.mdを読む
```
Read: /Users/yasuhirotakushi/Desktop/reborn-project/docs/issues.md
```
- 未完了Issueを把握
- 関連する作業がないか確認

### 2. TDD_POLICY.mdを読む
```
Read: /Users/yasuhirotakushi/Desktop/reborn-project/docs/TDD_POLICY.md
```
- Issue管理ルール確認
- TDD適用判断基準確認

### 3. DEPLOYMENT_RULESを読む（重要）
```
Serena Memory: DEPLOYMENT_RULES
```
- **デプロイは必ず両方実施**（GAS + PWA）
- デプロイフロー確認（4ステップ）
- デプロイチェックリスト確認

### 4. ユーザーに報告
読んだ内容を簡潔に報告：
- 未完了Issue数
- 今回の作業に関連するIssue有無

---

## 開発ルール（常に厳守）

**すべての開発作業において以下を必ず守ること：**

- **問題・トラブル発見 → Issue起票**
  - どんな小さな不具合でも必ずdocs/issues.mdに記録
  
- **コード修正前 → TDD判断**
  - TDD_POLICY.mdに従って適用可否を判断
  
- **設計決定 → ロードマップ更新**
  - 重要な設計変更は関連ドキュメントに反映
  
- **デプロイ → 4ステップ完全実施（1つでも欠けたらPWA版未反映）**
  1. `clasp push`
  2. `clasp deploy`（新デプロイID確認）
  3. `docs/index.html`更新（4箇所、replace_all: true）
  4. `git push`（PWA反映）

**⚠️ 特にデプロイは4ステップすべて実施すること！**
- Step 1-2のみ → スプレッドシート版のみ反映、PWA版は古いまま
- Step 3を忘れる → PWA版が古いデプロイIDを参照し続ける
- Step 4を忘れる → docs/index.htmlの変更が反映されない

---

## このチェックリストを守らなかった場合のリスク
- 同じバグを繰り返す
- 既存の不具合を見落とす
- システム全体を破壊する可能性
- **デプロイ手順を省略してPWA版が未更新になる**
