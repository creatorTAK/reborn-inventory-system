# REBORN AI Chat

REBORNプロジェクトのユーザーサポート用AIチャットボット。

---

## 📋 プロジェクト概要

### 目的
- REBORNの使い方をサポート
- 技術的な質問に回答
- トラブルシューティング
- システム連携（プロプラン）
- 操作代行（プロプラン）

### 技術スタック
- **フロントエンド**: HTML/CSS/JavaScript
- **バックエンド**: Node.js + Express
- **AI API**: Gemini API（Google）

---

## 🎯 機能レベル

### レベルA: 基本チャットサポート ✅ 90%完成
- **対象プラン**: スタンダードプラン
- **機能**: REBORNの使い方説明、トラブルシューティング
- **技術**: Gemini API、システムプロンプト
- **現状**: 基本機能完成、チャット履歴保存とレスポンス評価が未実装

### レベルB: システム連携型サポート ⏳ Phase 3実装予定
- **対象プラン**: プロプラン
- **機能**: スプレッドシートにアクセス、在庫検索、売上確認、設定確認
- **技術**: Claude Agent SDK、GAS API連携
- **実装時期**: Phase 3（3-6ヶ月後）

### レベルC: 操作代行型サポート ⏳ Phase 3実装予定
- **対象プラン**: プロプラン
- **機能**: 画像→自動商品登録、価格調査→提案、在庫調整自動実行、レポート自動生成
- **技術**: Claude Agent SDK、Gemini Vision API、メルカリAPI/スクレイピング
- **実装時期**: Phase 3（3-6ヶ月後）

---

## 📁 ファイル構成

```
reborn-ai-chat/
├── src/
│   └── server.js         # Expressサーバー、Gemini API統合
├── public/
│   └── index.html        # チャットUI
├── .env                  # APIキー（gitignore済み）
├── .env.example          # 環境変数テンプレート
├── package.json          # 依存関係
├── CLAUDE.md            # 開発ドキュメント
└── DEVELOPMENT_ROADMAP.md  # 詳細ロードマップ
```

---

## 🚀 開発コマンド

```bash
# サーバー起動
npm start

# 環境変数設定
cp .env.example .env
nano .env  # GEMINI_API_KEYを設定
```

---

## 📊 実装ロードマップ

詳細は **`DEVELOPMENT_ROADMAP.md`** を参照。

メインプロジェクトのロードマップは **`../REBORN_ROADMAP.md`** を参照。

### Phase 2（スタンダードプラン）
- レベルA完成（チャット履歴、レスポンス評価、UI改善）

### Phase 3（プロプラン）
- レベルB実装（GAS連携、Agent SDK）
- レベルC実装（画像解析、操作代行）

---

## ⚠️ 重要な注意事項

- **Claude API削除**: Gemini APIのみ使用（コスト削減）
- **レベルB/C**: Agent SDK統合が必須（Phase 3以降）
- **実装順序**: Phase 1-2完了後にAgent SDK導入

---

## 📝 次のステップ

### Phase 2（スタンダードプラン機能実装時）
1. チャット履歴保存（LocalStorage）
2. レスポンス評価機能（👍/👎）
3. UI改善（レスポンシブ対応強化）

### Phase 3（プロプラン機能実装時）
1. GAS API連携
2. Claude Agent SDK統合
3. レベルB/C機能実装

---

**完成度**: レベルA 90%、レベルB/C 0%（Phase 3実装予定）
