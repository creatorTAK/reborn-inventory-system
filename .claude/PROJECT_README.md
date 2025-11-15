# REBORN プロジェクト - Claude Code 設定

このディレクトリには、REBORN在庫管理システムのClaude Code専用設定が含まれています。

## 📁 ファイル構成

### 🚨 最重要ファイル（セッション開始時に必読）

- **REBORN_SESSION_RULES.md** - セッション開始時の強制ルール
  - 新規セッション開始時に必ず読み込むこと
  - TodoWriteでチェックリストを作成
  - 全ステップ完了まで他の作業禁止

### 📋 カスタムコマンド

- **commands/session-start.md** - セッション開始コマンド
  - 使い方: `/session-start` を実行
  - 必須読み込みを自動実行
  - TodoWriteで進捗追跡

### 🎨 デザイン関連

- **skills/reborn-design-system.md** - REBORNデザインシステム
  - UI/UX改善時に参照
  - ブランドカラー、コンポーネント定義

## 🚀 セッション開始時の手順

### 方法1: カスタムコマンド（推奨）
```bash
/session-start
```

### 方法2: 手動実行
1. Read `.claude/REBORN_SESSION_RULES.md`
2. 指示に従ってTodoWrite作成
3. 順番に必須ファイル読み込み
4. 状況報告

## 📝 Serena Memory 一覧

以下のメモリが利用可能です（`mcp__serena__read_memory` で読み込み）：

- **MANDATORY_SESSION_START_CHECKLIST** - セッション開始チェックリスト
- **DEPLOYMENT_RULES** - デプロイルール（GAS + PWA）
- **SESSION_STATE** - 現在のセッション状態（自動更新）

## ⚠️ 重要な注意事項

1. **新規セッション = 必ず REBORN_SESSION_RULES.md 読み込み**
2. **デプロイ前 = 必ず DEPLOYMENT_RULES 読み込み**
3. **Issue完了 = 必ず issues-summary.md 更新**

---

**最終更新: 2025-11-15**
