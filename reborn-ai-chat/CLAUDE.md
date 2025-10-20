# REBORN AI Chat - 開発ドキュメント

AIチャットボット（Claude API + Gemini API対応）

**完成度**: 90%

---

## プロジェクト概要

REBORNプロジェクトのユーザーサポート用AIチャットボット。

### 目的
- REBORNの使い方をサポート
- 技術的な質問に回答
- トラブルシューティング
- 機能改善の提案

### 技術スタック
- **フロントエンド**: HTML/CSS/JavaScript
- **バックエンド**: Node.js + Express
- **AI API**:
  - Claude API (Anthropic)
  - Gemini API (Google) - フォールバック用

---

## ファイル構成

```
reborn-ai-chat/
├── src/
│   └── server.js         # Expressサーバー、Claude/Gemini API統合
├── public/
│   └── index.html        # チャットUI
├── .env                  # APIキー（gitignore済み）
├── .env.example          # 環境変数テンプレート
└── package.json          # 依存関係
```

---

## 重要な設定

### システムプロンプト (src/server.js)

```javascript
const SYSTEM_PROMPT = `あなたはREBORNプロジェクトの専門AIアシスタントです。

REBORNは、古着（used clothing、ファッション・洋服）の買取・販売を行う物販管理システムです。
着物ではなく、メルカリなどで販売する洋服（トップス、ボトムス、アウターなど）を扱います。

主な機能：
- 商品登録（52,000件のブランドデータ、AI商品説明文生成）
- 在庫管理
- 売上管理
- プッシュ通知機能
- PWA対応（iPhone/Android）

あなたの役割：
1. REBORNの使い方をサポート
2. 技術的な質問に回答
3. トラブルシューティング
4. 機能改善の提案

丁寧で親しみやすく、かつプロフェッショナルに対応してください。`;
```

### 使用モデル
- **Claude**: `claude-3-5-haiku-20241022`（高速・コスト効率）
- **Gemini**: `gemini-2.0-flash-exp`（フォールバック）

---

## 開発コマンド

```bash
# サーバー起動
npm start

# 環境変数設定
cp .env.example .env
nano .env  # APIキーを設定
```

---

## トラブルシューティング

### モデル名エラー (404 not_found_error)
- 原因: 無効なモデル名
- 解決: 公式ドキュメントで最新のモデル名を確認
- 現在の正しいモデル: `claude-3-5-haiku-20241022`

### APIキーが認識されない
- 原因: .envファイルが作成されていない
- 解決: `cp .env.example .env` → nano で編集

---

## 次の実装予定

- [ ] チャット履歴の保存機能
- [ ] ユーザー認証
- [ ] レスポンスの評価機能
