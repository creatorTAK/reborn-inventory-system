# 🚨 セッション開始時の必須チェックリスト

**このファイルはセッション開始直後に必ず読むこと**

## 必須タスク（順番厳守）

### 1. issues-summary.mdを読む（軽量・高速）
```
Read: /Users/yasuhirotakushi/Desktop/reborn-project/docs/issues-summary.md
```
- **未完了Issue数**と**優先度**を把握
- 今回の作業に関連するIssueがないか確認
- **詳細が必要な場合のみ** issues.md から該当Issueを読む

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
- **デプロイは既存ID更新方式**（効率化）
- デプロイフロー確認（2ステップ）
- デプロイチェックリスト確認

### 4. **🆕 PWA版デプロイID確認（必須）**
```
Grep: "AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA" in docs/index.html
```
- **docs/index.html の4箇所にデプロイIDが正しく設定されているか確認**
- 正しいデプロイID: `AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA`
- 古いデプロイIDが残っていないか確認
- **確認箇所:**
  1. window.REBORN_CONFIG.GAS_BASE_URL（22行目付近）
  2. iframe src（552行目付近）
  3. const GAS_API_URL（610行目付近）
  4. const baseUrl in navigateToPage（880行目付近）

### 5. ユーザーに報告
読んだ内容を簡潔に報告：
- 未完了Issue数と優先度別内訳
- 今回の作業に関連するIssue有無
- **PWA版デプロイID確認結果（正常/要修正）**

---

## 開発ルール（常に厳守）

**すべての開発作業において以下を必ず守ること：**

- **問題・トラブル発見 → Issue起票**
  - どんな小さな不具合でも必ずdocs/issues.mdに記録
  - **同時にissues-summary.mdも更新**

- **Issue完了時 → 両ファイル更新（必須）**
  - `[x] ✅ DONE` になったIssueは**即座に**以下を実行：
    1. issues.md から該当Issueを削除し issues-closed.md に移動
    2. **issues-summary.md から該当Issueを削除**（重要）
    3. **issues-summary.md の統計（総Issue数、優先度別件数）を更新**
  - 理由: issues.mdとissues-summary.mdの同期を保つ
  - **実施タイミング**: Issue完了直後、セッション終了前
  
- **コード修正前 → TDD判断**
  - TDD_POLICY.mdに従って適用可否を判断
  
- **設計決定 → ロードマップ更新**
  - 重要な設計変更は関連ドキュメントに反映
  
- **デプロイ → 効率化デプロイフロー（GASファイル修正時）**
  1. `npx @google/clasp push`
  2. `npx @google/clasp deploy --deploymentId AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA --description \"変更内容\"`
  ✅ 完了（index.html更新不要、git push不要）

- **デプロイ → PWAファイル修正時（docs/配下）**
  1. `git add .`
  2. `git commit -m \"変更内容\"`
  3. `git push origin main`
  ✅ 完了（Cloudflare Pages自動デプロイ）

**⚠️ デプロイID固定方式のメリット:**
- index.html の更新が不要（**初回設定後は**手間削減、ミス防止）
- デプロイ上限を気にしなくて良い
- デプロイが高速化

**⚠️ 絶対にやってはいけないこと:**
- `npx @google/clasp deploy`（オプションなし） → 新IDが発行されてしまう
- PWA用固定デプロイID `AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA` を削除
- **セッション開始時のデプロイID確認をスキップ**
- **完了Issueをissues.mdに放置**（肥大化の原因）
- **issues-summary.mdとissues.mdの不整合を放置**（新ルール）

---

## このチェックリストを守らなかった場合のリスク
- 同じバグを繰り返す
- 既存の不具合を見落とす
- システム全体を破壊する可能性
- **デプロイ手順を間違えてPWA版が未更新になる**
- **間違った方法でデプロイしてindex.htmlとの不整合が発生**
- **古いデプロイIDが残っていてPWA版が動かない（2回発生済み）**
- **issues.mdが肥大化してセッション開始時に読み込めなくなる（1回発生済み → サマリー方式で解決）**
- **issues-summary.mdとissues.mdが不整合になり、誤った情報で開発を進める**

---

**最終更新: 2025-11-01**
**更新内容: サマリーファイル方式導入（トークン消費90%削減）**
