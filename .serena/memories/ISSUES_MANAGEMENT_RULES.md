# Issue管理ルール - トークン最適化版

**目的**: Issue管理作業でのトークン消費を最小化し、効率的な運用を実現する

---

## 📊 ファイル構成とトークンサイズ

| ファイル | サイズ | 用途 | セッション開始時 |
|---------|--------|------|-----------------|
| **issues-summary.md** | 約2,000トークン | 軽量サマリー | ✅ 必ず読む |
| **issues.md** | 25,549トークン | 全Issue詳細 | ❌ 絶対に読まない |
| **issues-closed.md** | 不明（大容量） | 完了Issueアーカイブ | ❌ 読まない |

---

## 🚨 絶対禁止事項

### ❌ issues.md全体読み込み

```python
# ❌ 絶対に禁止！
Read("docs/issues.md")

# エラー例:
# File content (25549 tokens) exceeds maximum allowed tokens (25000)
```

**理由**:
- issues.mdは25,549トークン（1回の上限25,000超え）
- 読み込み失敗でエラー
- 仮に成功しても25,000トークン消費（セッション予算の12.5%）

---

## ✅ 正しいIssue操作方法

### 1. セッション開始時: issues-summary.mdのみ読む

```python
# ✅ 正しい（約2,000トークン）
Read("docs/issues-summary.md")
```

**内容**:
- 未完了Issue一覧（ID、タイトル、優先度）
- Issue統計（総数、完了数）
- 最近完了したIssue一覧

### 2. Issue検索: Grepで部分検索

```python
# ✅ 正しい（約500トークン）
Grep("UI-015", path="docs/issues.md", output_mode="content", -A=60)
```

**用途**:
- 特定IssueのIDで検索
- 該当部分のみ取得
- 前後の行も取得可能（-A, -B, -C）

### 3. Issue編集: replace_regexで部分置換

```python
# ✅ 正しい（約100トークン）
mcp__serena__replace_regex(
    relative_path="docs/issues.md",
    regex="## UI-015.*?---",
    repl=""  # 削除
)
```

**用途**:
- Issue削除
- Issue内容の部分修正
- ワイルドカード活用で効率化

### 4. Issue追加: replace_regexで挿入

```python
# ✅ 正しい（約200トークン）
mcp__serena__replace_regex(
    relative_path="docs/issues.md",
    regex="## 🧪 テスト・検証（Testing & Validation）",
    repl="## 🧪 テスト・検証（Testing & Validation）\n\n## TEST-001 | ...\n\n---"
)
```

**用途**:
- 新Issue追加
- セクション先頭に挿入

---

## 📋 Issue管理ワークフロー

### A. Issue作成

1. ✅ issues-summary.mdを読む（現状確認）
2. ✅ Grepでセクション位置確認
3. ✅ replace_regexで新Issue追加（issues.md）
4. ✅ Editで統計更新（issues-summary.md）

**トークン消費**: 約3,000トークン

### B. Issue完了

1. ✅ Grepで該当Issue検索（issues.md）
2. ✅ Readでissues-closed.md先頭確認（5行程度）
3. ✅ Editでissues-closed.md先頭に追加
4. ✅ replace_regexで該当Issue削除（issues.md）
5. ✅ Editで該当Issue削除＋統計更新（issues-summary.md）

**トークン消費**: 約2,500トークン

### C. Issue検索・参照

1. ✅ issues-summary.mdを読む（概要確認）
2. ✅ Grepで詳細検索（必要時のみ）

**トークン消費**: 約2,500トークン

---

## 🎯 トークン最適化テクニック

### 1. Grepのoutput_mode活用

```python
# 件数だけ知りたい場合（約50トークン）
Grep("TEST-", path="docs/issues.md", output_mode="count")

# ファイル名だけ知りたい場合（約100トークン）
Grep("TEST-", path="docs/issues.md", output_mode="files_with_matches")

# 内容も必要な場合（約500トークン）
Grep("TEST-", path="docs/issues.md", output_mode="content", -A=30)
```

### 2. replace_regexのワイルドカード活用

```python
# ❌ 非効率（Issueを全部読んでから削除）
content = Read("docs/issues.md")  # 25,549トークン
# ... 削除処理

# ✅ 効率的（該当部分だけ削除）
replace_regex(
    relative_path="docs/issues.md",
    regex="## UI-015.*?---",  # ワイルドカード活用
    repl=""
)  # 約100トークン
```

### 3. issues-summary.mdの優先活用

```python
# ❌ 非効率
issues = Grep("", path="docs/issues.md", output_mode="content")  # 大量トークン

# ✅ 効率的
summary = Read("docs/issues-summary.md")  # 約2,000トークン
# サマリーで十分な場合はこれで完結
```

---

## 🔧 メンテナンスルール

### 定期チェック（月次）

1. issues.mdのサイズ確認
   ```bash
   wc -w docs/issues.md  # 単語数確認
   ```

2. 20,000トークン超えたら対策検討
   - 保持Issueをさらに分離
   - Issue個別ファイル化
   - アーカイブ強化

### Issue完了時（必須）

1. issues.mdから削除
2. issues-closed.mdに移動
3. issues-summary.md統計更新

**重要**: 完了Issueの放置が肥大化の主原因

---

## 📝 過去のトラブル事例

### 2025-11-19: issues.md全体読み込み失敗

**状況**:
```
Read("docs/issues.md")
→ Error: File content (25549 tokens) exceeds maximum allowed tokens (25000)
```

**原因**: issues.md全体を読もうとした

**対策**: 
- MANDATORY_SESSION_START_CHECKLISTに禁止ルール追加
- ISSUES_MANAGEMENT_RULES作成（このファイル）
- Grep活用の徹底

### 過去: issues.md肥大化（セッション開始時読み込み不可）

**状況**: issues.mdが巨大化し、セッション開始時に読み込めない

**対策**:
- issues-summary.md（軽量版）作成
- 完了Issueをissues-closed.mdに分離
- セッション開始時はissues-summary.mdのみ読む

---

## 🎓 学習ポイント

### トークン消費の実態

**誤解**: Readでエラーが出たら25,000トークン消費？
**正解**: エラーで止まるので0トークン（ただし時間のロス）

**誤解**: issues.mdを1回読むだけなら問題ない？
**正解**: 25,549トークンは予算200,000の12.5%（大量消費）

### 効率的な操作

**ポイント1**: 軽量なissues-summary.mdを最大活用
**ポイント2**: 詳細が必要な時だけGrepで部分検索
**ポイント3**: 編集はreplace_regexで該当部分だけ

---

**作成日**: 2025-11-19  
**目的**: セッション開始時に自動で思い出すためのリファレンス  
**参照**: MANDATORY_SESSION_START_CHECKLIST（セッション開始時必読）
