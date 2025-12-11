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

**🚨 重要: issues.md全体読み込み禁止**
```
❌ Read("docs/issues.md")  # 絶対に禁止！25,549トークン消費
✅ Grep("ISSUE-ID", path="docs/issues.md")  # 必要部分だけ検索
```

### 2. TDD_POLICY.mdを読む
```
Read: /Users/yasuhirotakushi/Desktop/reborn-project/docs/TDD_POLICY.md
```
- Issue管理ルール確認
- TDD適用判断基準確認

### 3. DEPLOYMENT_RULESを読む（🔴 最重要）
```
Serena Memory: DEPLOYMENT_RULES
```
**🚨 2025-12-02更新: ドメイン別ホスティング構成**

| ドメイン | ホスティング | デプロイ方法 |
|---------|------------|-------------|
| **furira.jp** | Firebase Hosting | `git push` → GitHub Actions自動デプロイ |
| pages.dev | Cloudflare Pages | `git push` で自動 |

### 4. Firestoreセキュリティルールの場所を確認
```
File: docs/firestore.rules
```
- 新コレクション追加時はルールも追加
- デプロイ: `npx firebase deploy --only firestore:rules`

### 5. ユーザーに報告
- 未完了Issue数と優先度別内訳
- 今回の作業に関連するIssue有無

---

## 開発ルール（常に厳守）

### デプロイルール（🔴 最重要）

**PWAファイル修正時（docs/配下）:** ⭐ 自動化済み
```bash
# GitHubにプッシュするだけでOK！
git add . && git commit -m "変更内容" && git push origin main

# ⭐ Firebase Hostingへのデプロイは GitHub Actions で自動実行されます
```

**✅ 2025-12-06更新: `git push` だけで furira.jp に自動反映されるようになりました！**

**GASファイル修正時:**
```bash
npx @google/clasp push
npx @google/clasp deploy --deploymentId AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA --description "変更内容"
```

### その他のルール

- **問題・トラブル発見 → Issue起票**
- **Issue完了時 → issues.md と issues-summary.md 両方更新**
- **コード修正前 → TDD判断**
- **PWA内リンク → 絶対パス使用**（相対パス禁止）

---

## ⚠️ 絶対にやってはいけないこと

❌ `npx @google/clasp deploy`（オプションなし）
❌ issues.md全体をReadで読み込む（25,549トークン消費）
❌ PWA内リンクで相対パスを使用

---

## このチェックリストを守らなかった場合のリスク

- 同じバグを繰り返す
- 既存の不具合を見落とす
- issues.md全体読み込みで25,000トークン超過エラー

---

**最終更新: 2025-12-08**
**更新内容: Playwright MCP自動発動ルールを削除。Playwrightはユーザーからの明示的な指示がある場合のみ使用。**
