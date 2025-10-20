# API使用時の重大な安全ルール - 絶対厳守

**作成日**: 2025年10月20日
**重要度**: ★★★★★ 最重要（Claude Codeは必ず読むこと）
**背景**: Claude APIの誤設定により800円の損失と開発停止が発生

---

## 🚨 発生した事故の記録

### 事故の経緯（2025年10月20日）

1. **Claude Code**（Claude MAX プラン・ブラウザ認証）で開発中
2. Claude Agent SDK導入のため、**環境変数にAPIキーを設定**
   ```bash
   export ANTHROPIC_API_KEY="sk-ant-..." # ~/.zshrc に記述
   ```
3. → Claude Code CLIがAPIキーを検知
4. → ブラウザ認証（MAX プラン）とAPIキーが競合
5. → **Auth conflict エラー**発生
6. → **APIが優先**され、すべての会話がAPI経由で消費
7. → 5ドル（約800円）のクレジット枯渇
8. → Claude Code CLIが完全停止

### 問題の根本原因

**グローバル環境変数に`ANTHROPIC_API_KEY`を設定したこと**

- ターミナル全体で有効になった
- Claude Code CLIがこれを検知
- MAX プラン（月額固定・無制限）ではなく、API（従量課金）が使われた
- 普通の会話もすべてAPI経由で消費

### なぜこうなったか

**Claude Codeが独断でClaude Agent SDKの導入を提案した**

- `CLAUDE_AGENT_SDK_PLAN.md`を作成
- 環境変数設定を指示
- Phase 1（在庫管理）の段階でPhase 4（Agent SDK）の機能を提案
- ユーザーへの明示的な確認なし
- リスクの説明なし

---

## ❌ 絶対にやってはいけないこと

### 1. グローバル環境変数にAPIキーを設定

```bash
# ❌ 絶対禁止
export ANTHROPIC_API_KEY="sk-ant-..."  # ~/.zshrc, ~/.zprofile, ~/.bashrc等

# ❌ これも禁止
export OPENAI_API_KEY="sk-..."
export GEMINI_API_KEY="..."
export ANTHROPIC_API_KEY="..."
```

**理由**:
- ターミナル全体で有効になる
- Claude Code CLIと競合する
- 意図せずAPI経由で消費される
- **クレジットカード設定時、無限に請求される危険性**

---

### 2. Claude Codeの独断で大きな変更を提案・実行

**禁止事項**:
- ❌ 新しいAPIの導入提案（事前確認なし）
- ❌ 環境変数の設定指示（事前確認なし）
- ❌ 課金が発生する可能性がある変更（事前確認なし）
- ❌ アーキテクチャの大幅な変更（事前確認なし）
- ❌ ロードマップ（REBORN_PRIORITY_ROADMAP.md）を無視した提案

---

### 3. Phase を飛ばした提案

```
現在: Phase 1（在庫管理システム実装中）

❌ やってはいけない提案:
- Agent SDK導入（Phase 4の内容）
- SaaS化（Phase 3の内容）
- reborn-ai-chatの高度な機能（Phase 4の内容）

✅ やるべき提案:
- 在庫管理システムの実装（Phase 1）
- 売上管理システムの実装（Phase 1）
- チーム連携機能（Phase 1）
```

---

## ✅ 正しい方法

### APIキーの管理方法

#### 方法1: `.env` ファイルのみ（推奨）

```bash
# ✅ 正しい方法
# プロジェクト内の .env ファイルに記載
# 例: reborn-ai-chat/.env

ANTHROPIC_API_KEY=sk-ant-...
GEMINI_API_KEY=...
```

**Node.jsでの読み込み**:
```javascript
// reborn-ai-chat/server.ts
import dotenv from 'dotenv';
dotenv.config(); // このプロセス内でのみ有効

const apiKey = process.env.ANTHROPIC_API_KEY;
```

**メリット**:
- ✅ そのプロセス内でのみ有効
- ✅ Claude Code CLIには影響しない
- ✅ `.gitignore`で除外（公開されない）

---

#### 方法2: `direnv` で確実に分離（最も安全）

```bash
# インストール
brew install direnv

# ~/.zshrc に追加
eval "$(direnv hook zsh)"

# プロジェクトごとに設定
# reborn-ai-chat/.envrc
export ANTHROPIC_API_KEY=sk-ant-...

# 許可
cd reborn-ai-chat
direnv allow
```

**動作**:
```bash
# 開発用ディレクトリ（環境変数なし）
$ cd /Users/yasuhirotakushi/Desktop/reborn-project
$ echo $ANTHROPIC_API_KEY
（空白）✅ Claude Code CLIはMAXプランで動作

# API用ディレクトリ（環境変数あり）
$ cd reborn-ai-chat
direnv: loading .envrc
$ echo $ANTHROPIC_API_KEY
sk-ant-...（表示される）✅

# 外に出ると無効化
$ cd ..
direnv: unloading
$ echo $ANTHROPIC_API_KEY
（空白）✅ 自動的に無効化
```

**メリット**:
- ✅ ディレクトリに入った時だけ有効
- ✅ 出ると自動的に無効化
- ✅ 完全に分離される
- ✅ 誤って設定を残すことがない

---

### Claude Codeの提案ルール

#### Phase 4以前の禁止事項

**Phase 1-3では以下を提案してはいけない**:

1. ❌ **Claude Agent SDK**の導入
2. ❌ **新しいAPI**の導入（Gemini以外）
3. ❌ **大規模なアーキテクチャ変更**
4. ❌ **課金が発生する新サービス**

**理由**:
- 基本機能が完成していない
- 実運用での検証が必要
- ROI（投資対効果）が不明

---

#### 事前確認が必須の変更

以下の変更を提案する際は、**必ずユーザーに事前確認**すること：

```
⚠️ 重要な変更提案

【提案内容】
〇〇の導入

【必要な作業】
1. ...
2. ...

【コスト】
- 初期費用: 〇〇円
- 月額費用: 〇〇円

【リスク】
- ...
- ...

【導入タイミング】
Phase 〇（〇ヶ月後を想定）

【代替案】
- ...

【実施の可否を確認してください】
→ ユーザーの明示的な承認を待つ
```

**対象となる変更**:
1. 新しいAPIの導入
2. 環境変数の設定
3. 課金が発生する変更
4. アーキテクチャの大幅な変更
5. セキュリティに関わる変更
6. Phase を超えた提案

---

## 🔒 安全確認チェックリスト

### 開発開始時（毎回実行）

```bash
# 1. グローバル環境変数の確認
$ env | grep ANTHROPIC_API_KEY
（何も表示されない）✅

$ env | grep API_KEY
（何も表示されない、または必要なもののみ）✅

# 2. Claude Code CLIの認証状態確認
$ claude /whoami
（ブラウザアカウントのみ表示）✅

# 3. 設定ファイルの確認
$ grep -nH "ANTHROPIC_API_KEY" ~/.zshrc ~/.zprofile ~/.bash_profile ~/.bashrc
（何も見つからない）✅
```

---

### Phase 4開始前（必須チェック）

**前提条件**:
- [ ] Phase 1完了（在庫管理・売上管理・チーム連携）
- [ ] Phase 2完了（実運用2ヶ月以上）
- [ ] Phase 3完了（SaaS化・安定収益）
- [ ] 月額コスト（$50程度）の承認
- [ ] Anthropic Console で使用量上限設定完了
- [ ] 環境分離方法の確認（`.env` or `direnv`）
- [ ] ユーザーへの明示的な説明と承認

**技術的準備**:
- [ ] `direnv`インストール完了
- [ ] `.envrc` or `.env`ファイル作成
- [ ] `.gitignore`にAPIキーファイル追加
- [ ] Anthropic Console でアラート設定（$5到達時）
- [ ] Anthropic Console で月額上限設定（$10）
- [ ] テスト用の少額クレジットで動作確認

---

## 💰 Anthropic Console での安全設定

### 1. 使用量上限の設定（必須）

**URL**: https://console.anthropic.com/settings/billing

**設定内容**:
```
Usage limits:
- Monthly limit: $10（約1,500円）
- Alert threshold: $5（約750円）到達時に通知

Notification settings:
- Email alerts: ON
- Webhook: （任意）
```

**効果**:
- ✅ $10を超えたら自動停止
- ✅ $5到達時にメール通知
- ✅ 無限に請求されることを防ぐ

---

### 2. 支払い方法の安全設定

**推奨**:
- ✅ デビットカード（上限あり）
- ✅ プリペイドクレジット（上限設定可能）

**非推奨**:
- ⚠️ クレジットカード（無限に請求される可能性）

**現在の設定**:
- デビットカード（安全）✅

---

## 📋 Phase 別のAPI使用可否

| Phase | 内容 | Claude API | Gemini API | 理由 |
|-------|------|-----------|-----------|------|
| Phase 1 | 在庫・売上管理 | ❌ 使用禁止 | ✅ 使用可 | 基本機能に集中 |
| Phase 2 | 実運用・改善 | ❌ 使用禁止 | ✅ 使用可 | システム安定化 |
| Phase 3 | SaaS化 | ❌ 使用禁止 | ✅ 使用可 | 収益化が先 |
| Phase 4 | Agent SDK | ✅ 検討可能 | ✅ 使用可 | 安定収益後 |

---

## 🎯 Claude Code への明示的な制約

### このドキュメントの位置づけ

**優先度**: 最高
**対象**: Claude Code（AI開発アシスタント）
**拘束力**: 絶対厳守

### Claude Code が必ず守るべきルール

1. **Phase 1-3では、Claude Agent SDKを提案しない**
2. **新しいAPIの導入は、必ず事前確認する**
3. **環境変数の設定を指示する前に、必ず安全性を確認する**
4. **グローバル環境変数へのAPIキー設定は、絶対に指示しない**
5. **課金が発生する変更は、必ずコストとリスクを説明する**
6. **REBORN_PRIORITY_ROADMAP.mdを無視した提案をしない**
7. **ユーザーの明示的な承認なしに、大きな変更を実行しない**

### 提案時の確認事項

```
【提案前に自問】
1. この提案は現在のPhaseに適しているか？
2. コストとリスクを説明したか？
3. 代替案を提示したか？
4. ユーザーの承認を得たか？
5. 安全性を確認したか？

→ 1つでもNOなら提案を保留し、ユーザーに相談
```

---

## 📝 今後のドキュメント更新ルール

### このドキュメントの更新

**更新が必要な場合**:
- 新しいAPIを導入する時
- 課金が発生するサービスを追加する時
- セキュリティインシデントが発生した時
- Phase が進んだ時

**更新者**:
- Claude Code（提案）
- ユーザー（承認）

---

## 🔄 定期確認スケジュール

### 毎回の開発開始時

```bash
# 環境変数確認（10秒）
env | grep API_KEY
claude /whoami
```

### Phase 移行時

- [ ] このドキュメントを再読
- [ ] チェックリストを実行
- [ ] ユーザーと安全性を確認

### 月次確認

- [ ] Anthropic Console で使用量確認
- [ ] 不要なAPIキーを削除
- [ ] 環境変数設定を確認

---

## 📞 緊急時の対応

### APIクレジットが異常消費されている場合

1. **即座にAPIキーを無効化**
   - https://console.anthropic.com/settings/keys
   - "Disable" をクリック

2. **環境変数を削除**
   ```bash
   unset ANTHROPIC_API_KEY
   # ~/.zshrc から該当行を削除
   source ~/.zshrc
   ```

3. **Claude Code CLIを再起動**
   ```bash
   claude /logout
   claude /login
   # "Use API key?" → No
   ```

4. **使用量を確認**
   - https://console.anthropic.com/settings/billing

---

## 🎓 教訓

### 今回の事故から学んだこと

1. **AIの提案を盲信しない**
   - Claude Codeも間違える
   - 大きな変更は必ず確認

2. **段階を守る**
   - 基礎ができていないのに応用に進まない
   - Phase を飛ばさない

3. **安全設定を怠らない**
   - 使用量上限設定は必須
   - 環境変数は慎重に管理

4. **記録を残す**
   - 問題が起きたら必ずドキュメント化
   - 再発防止策を明文化

---

## ✅ まとめ

### 絶対に守ること

1. ✅ **グローバル環境変数にAPIキーを設定しない**
2. ✅ **新しいAPIは事前確認**
3. ✅ **Anthropic Console で上限設定**
4. ✅ **Phase を守る**
5. ✅ **定期的に安全確認**

### Phase 4でAPIを安全に使うには

1. ✅ `.env` または `direnv` で完全分離
2. ✅ 使用量上限設定（$10/月）
3. ✅ アラート設定（$5到達時）
4. ✅ デビットカードで支払い
5. ✅ 定期的な使用量確認

---

**このドキュメントは、今後のすべての開発において最優先で参照すること。**
**Claude Code は、このドキュメントに反する提案・実行を絶対にしてはならない。**

---

**最終更新**: 2025年10月20日
**次回見直し**: Phase 移行時
