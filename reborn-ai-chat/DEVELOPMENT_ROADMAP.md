# REBORN AI Chat - 完全開発ロードマップ

**作成日**: 2025年10月20日
**目的**: SaaS化時のユーザー向けAIサポートシステム

---

## 📋 プロジェクト概要

REBORNを利用するユーザーが困った時に助けてくれるAIサポートシステム。
単なる質問応答から、実際にシステムを操作する高度なサポートまで段階的に実装。

---

## 🎯 機能レベル定義

### レベルA: 基本チャットサポート ✅ **90%完成**

**内容:**
- REBORNの使い方を説明
- 商品登録方法、設定変更、トラブルシューティングをガイド
- システムプロンプトによる一般的なサポート

**具体例:**
```
ユーザー: 「商品登録の方法を教えて」
AI: 「商品登録は以下の手順で行います：
     1. サイドバーから「商品登録」を開く
     2. ブランド名を入力...」
```

**技術:**
- Claude API / Gemini API
- 静的な知識ベース（システムプロンプト）
- ストリーミングレスポンス

**現状:**
- ✅ Claude API統合済み
- ✅ Gemini APIフォールバック実装済み
- ✅ システムプロンプト更新済み（フリマ出品ツールとして正確に記述）
- ⏳ チャット履歴保存（未実装）
- ⏳ レスポンス評価（未実装）

---

### レベルB: システム連携型サポート 🎯 **次の実装目標**

**内容:**
- REBORNのスプレッドシートにアクセス
- リアルタイムでデータを取得・検索
- ユーザーの質問に対して実際のデータで回答
- 設定情報を確認・提案

**具体例:**

**例1: 在庫検索**
```
ユーザー: 「UNIQLOの在庫を検索して」
AI: （スプレッドシートを検索）
    「UNIQLOの商品は現在3点在庫があります：
    1. ウルトラライトダウン（黒、Mサイズ）- ¥3,980
    2. フリースジャケット（紺、Lサイズ）- ¥2,500
    3. デニムジャケット（青、Sサイズ）- ¥4,200

    詳細を見ますか？」
```

**例2: 売上確認**
```
ユーザー: 「今月の売上を教えて」
AI: （スプレッドシートを集計）
    「今月（10月）の売上状況：
    - 販売点数: 45点
    - 売上合計: ¥187,300
    - 利益: ¥89,500
    - 利益率: 47.8%

    先月比で+12%です！」
```

**例3: 設定確認**
```
ユーザー: 「デフォルトの配送方法は何？」
AI: （設定マスタを確認）
    「現在の設定：
    - デフォルト配送方法: らくらくメルカリ便
    - 配送元: 東京都
    - 発送までの日数: 1~2日

    変更したい場合は「設定管理」から変更できます。」
```

**技術:**
- Claude Agent SDK
- GAS API連携（Web App URL経由）
- スプレッドシート読み取り
- データ集計・分析

**実装要素:**
1. **GAS Connector** - GASのWeb AppとAPI連携
2. **Data Fetcher** - スプレッドシートからデータ取得
3. **Query Parser** - ユーザーの質問を解析
4. **Response Formatter** - データを読みやすく整形

---

### レベルC: 操作代行型サポート 🚀 **高度な機能**

**内容:**
- ユーザーの代わりに作業を実行
- 画像解析→自動商品登録
- 価格調査→最適価格提案
- 在庫調整の自動実行

**具体例:**

**例1: 画像から自動登録**
```
ユーザー: 「この商品を登録して」（画像添付）
AI: （処理中...）
    ↓
    1. 画像解析（Gemini Vision）
       → ブランド: UNIQLO
       → アイテム: ダウンジャケット
       → 色: 黒
       → サイズ: M

    2. メルカリ価格調査
       → 類似商品5件の平均: ¥3,800

    3. 適正価格計算
       → 推奨価格: ¥3,980

    4. 商品名・説明文生成

    5. スプレッドシートに保存
    ↓
「登録完了しました！

【登録内容】
- 管理番号: UNI-JK-001
- ブランド: UNIQLO
- 商品名: UNIQLO ウルトラライトダウンジャケット 黒 Mサイズ
- 価格: ¥3,980
- 説明文: 軽量で暖かい...（自動生成）

スプレッドシートに保存しました。
商品ページで確認できます。」
```

**例2: 価格調整提案**
```
ユーザー: 「売れ残っている商品を教えて」
AI: （在庫を分析）
    「30日以上売れていない商品が12点あります：

    【値下げ推奨】
    1. Nikeスニーカー（¥8,500 → ¥6,800推奨）
       理由: 類似商品の相場が下がっています

    2. アディダスパーカー（¥4,200 → ¥3,500推奨）
       理由: 出品から45日経過

    値下げしますか？（一括実行も可能）」

ユーザー: 「全部値下げして」
AI: （価格を一括更新）
    「12点すべての価格を更新しました！
    平均値下げ率: 18%
    これで売れる確率が30%向上します。」
```

**例3: 売上レポート自動生成**
```
ユーザー: 「今月のレポートを作って」
AI: （データ分析→PDF生成）
    「10月の売上レポートを作成しました！

    【サマリー】
    - 売上: ¥187,300（前月比+12%）
    - 利益: ¥89,500（利益率47.8%）
    - 販売点数: 45点

    【トップ3ブランド】
    1. UNIQLO - 12点 - ¥38,400
    2. GU - 8点 - ¥24,500
    3. ZARA - 6点 - ¥31,200

    【来月の戦略提案】
    - UNIQLOの仕入れを強化
    - 冬物アウターに注力
    - 値下げ商品の見直し

    PDFをダウンロードしますか？」
```

**技術:**
- Claude Agent SDK（高度な自律動作）
- Gemini Vision API（画像解析）
- メルカリAPI/スクレイピング（価格調査）
- GAS API連携（データ書き込み）
- PDF生成（レポート作成）

**実装要素:**
1. **Image Analyzer** - 画像からブランド・商品情報抽出
2. **Price Researcher** - メルカリで競合価格調査
3. **Product Generator** - 商品名・説明文自動生成
4. **Data Writer** - スプレッドシートに自動保存
5. **Report Generator** - PDF/Excel形式でレポート生成

---

## 📊 実装ロードマップ

### フェーズ1: レベルA完成（1週間）

**目標**: 基本チャット機能を100%完成

**実装項目:**
- [x] Claude API統合 ✅
- [x] Gemini APIフォールバック ✅
- [x] システムプロンプト更新 ✅
- [ ] チャット履歴保存（LocalStorage）
- [ ] レスポンス評価機能（👍/👎）
- [ ] UI改善（レスポンシブ対応強化）

**技術詳細:**
```javascript
// チャット履歴保存
class ChatHistory {
  save(message, role) {
    const history = this.load();
    history.push({ message, role, timestamp: Date.now() });
    localStorage.setItem('reborn-chat-history', JSON.stringify(history));
  }

  load() {
    return JSON.parse(localStorage.getItem('reborn-chat-history') || '[]');
  }

  clear() {
    localStorage.removeItem('reborn-chat-history');
  }
}

// レスポンス評価
function addRating(messageId, rating) {
  // 評価を記録
  fetch('/api/rating', {
    method: 'POST',
    body: JSON.stringify({ messageId, rating })
  });
}
```

**完成基準:**
- ✅ 会話履歴がリロード後も残る
- ✅ 評価ボタンで品質をフィードバック
- ✅ モバイルで快適に使える

---

### フェーズ2: レベルB実装（2-3週間）

**目標**: GAS連携でリアルタイムデータ取得

#### ステップ2-1: GAS API連携（1週間）

**実装項目:**
- [ ] GAS側にAPI Endpoint作成
- [ ] 認証システム（APIキー or OAuth）
- [ ] データ取得API（在庫、売上、設定）
- [ ] Node.js側のGAS Connector

**GAS API設計:**
```javascript
// GAS側（Code.gs）
function doGet(e) {
  const action = e.parameter.action;
  const apiKey = e.parameter.apiKey;

  // 認証チェック
  if (!validateApiKey(apiKey)) {
    return jsonResponse({ error: 'Unauthorized' }, 401);
  }

  switch(action) {
    case 'search_inventory':
      return searchInventory(e.parameter.query);
    case 'get_sales':
      return getSalesData(e.parameter.month);
    case 'get_config':
      return getConfigData(e.parameter.key);
    default:
      return jsonResponse({ error: 'Invalid action' }, 400);
  }
}

function searchInventory(query) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('在庫/売上管理表');
  // 検索ロジック...
  return jsonResponse({ results: [...] });
}
```

**Node.js側（Connector）:**
```typescript
// reborn-ai-chat/src/services/gas-connector.ts
export class GASConnector {
  private apiUrl: string;
  private apiKey: string;

  async searchInventory(query: string) {
    const url = `${this.apiUrl}?action=search_inventory&query=${query}&apiKey=${this.apiKey}`;
    const response = await fetch(url);
    return response.json();
  }

  async getSales(month: string) {
    const url = `${this.apiUrl}?action=get_sales&month=${month}&apiKey=${this.apiKey}`;
    const response = await fetch(url);
    return response.json();
  }
}
```

#### ステップ2-2: Agent SDK統合（1週間）

**実装項目:**
- [ ] Claude Agent SDK インストール
- [ ] Support Agent作成
- [ ] 意図分類システム
- [ ] データ整形・表示

**Agent実装:**
```typescript
// reborn-ai-chat/src/agents/support-agent.ts
import { Agent } from '@anthropic-ai/agent-sdk';
import { GASConnector } from '../services/gas-connector';

export class SupportAgent {
  private agent: Agent;
  private gasConnector: GASConnector;

  async handleQuery(userMessage: string) {
    // 1. 意図を分類
    const intent = await this.classifyIntent(userMessage);

    // 2. 意図に応じた処理
    switch(intent.type) {
      case 'search_inventory':
        return await this.handleInventorySearch(intent.params);

      case 'get_sales':
        return await this.handleSalesQuery(intent.params);

      case 'get_config':
        return await this.handleConfigQuery(intent.params);

      case 'general_help':
        return await this.handleGeneralHelp(userMessage);

      default:
        return this.fallbackResponse();
    }
  }

  private async classifyIntent(message: string) {
    // Claude Agentで意図を分類
    const prompt = `
ユーザーの質問を分類してください：
「${message}」

分類：
- search_inventory: 在庫検索
- get_sales: 売上確認
- get_config: 設定確認
- general_help: 一般的な質問
`;

    const response = await this.agent.chat(prompt);
    return JSON.parse(response);
  }

  private async handleInventorySearch(params: any) {
    // GASで在庫検索
    const results = await this.gasConnector.searchInventory(params.query);

    // 結果を整形
    return this.formatInventoryResults(results);
  }
}
```

#### ステップ2-3: UI改善（数日）

**実装項目:**
- [ ] データ表示用コンポーネント（表形式）
- [ ] グラフ表示（Chart.js）
- [ ] アクションボタン（「詳細を見る」等）

**完成基準:**
- ✅ 在庫検索ができる
- ✅ 売上データを表示できる
- ✅ 設定情報を確認できる
- ✅ データが見やすく表示される

---

### フェーズ3: レベルC実装（3-4週間）

**目標**: 操作代行・自動化機能

#### ステップ3-1: 画像解析→自動登録（2週間）

**実装項目:**
- [ ] 画像アップロード機能
- [ ] Gemini Vision統合
- [ ] メルカリ価格調査（スクレイピング）
- [ ] 商品情報自動生成
- [ ] GASへ自動保存

**技術実装:**
```typescript
// reborn-ai-chat/src/agents/product-registration-agent.ts
export class ProductRegistrationAgent {
  async processImage(imageFile: File) {
    // 1. 画像をBase64エンコード
    const imageBase64 = await this.encodeImage(imageFile);

    // 2. Gemini Visionで解析
    const analysis = await this.analyzeImage(imageBase64);

    // 3. メルカリで価格調査
    const priceData = await this.researchPrice(analysis.brand, analysis.item);

    // 4. 適正価格計算
    const optimalPrice = this.calculateOptimalPrice(priceData);

    // 5. 商品情報生成
    const productInfo = await this.generateProductInfo({
      ...analysis,
      optimalPrice,
      competitors: priceData
    });

    // 6. GASに保存
    const result = await this.saveToGAS(productInfo);

    return {
      success: true,
      managementNumber: result.managementNumber,
      productInfo
    };
  }

  private async analyzeImage(imageBase64: string) {
    // Gemini Vision API
    const prompt = `
この商品画像を分析してください：
- ブランド名
- アイテム種類
- 色
- 柄/デザイン
- サイズ（見える場合）
- 状態（新品/中古/ダメージ有無）
`;

    return await callGeminiVision(imageBase64, prompt);
  }

  private async researchPrice(brand: string, item: string) {
    // メルカリスクレイピング or API
    return await scrape Mercari(brand, item);
  }
}
```

#### ステップ3-2: 在庫管理自動化（1週間）

**実装項目:**
- [ ] 売れ筋/滞留在庫の自動判定
- [ ] 値下げ提案アルゴリズム
- [ ] 一括価格更新機能
- [ ] プッシュ通知連携

#### ステップ3-3: レポート自動生成（1週間）

**実装項目:**
- [ ] データ集計ロジック
- [ ] PDF生成（pdfkit or puppeteer）
- [ ] グラフ・チャート生成
- [ ] メール送信機能

**完成基準:**
- ✅ 画像から自動登録できる
- ✅ 在庫分析と価格提案ができる
- ✅ レポートを自動生成できる

---

## 🏗️ 最終的なプロジェクト構成

```
reborn-ai-chat/
├── src/
│   ├── server.ts                      # Expressサーバー
│   │
│   ├── agents/                        # エージェント群
│   │   ├── support-agent.ts           # レベルB: サポートエージェント
│   │   ├── product-registration-agent.ts  # レベルC: 商品登録
│   │   ├── inventory-agent.ts         # レベルC: 在庫管理
│   │   └── report-agent.ts            # レベルC: レポート生成
│   │
│   ├── services/                      # サービス層
│   │   ├── gas-connector.ts           # GAS API連携
│   │   ├── image-analyzer.ts          # Gemini Vision
│   │   ├── price-researcher.ts        # メルカリ価格調査
│   │   └── notification.ts            # プッシュ通知
│   │
│   ├── utils/                         # ユーティリティ
│   │   ├── intent-classifier.ts       # 意図分類
│   │   ├── response-formatter.ts      # レスポンス整形
│   │   └── data-validator.ts          # データ検証
│   │
│   └── types/                         # TypeScript型定義
│       └── index.ts
│
├── public/
│   ├── index.html                     # チャットUI
│   ├── styles.css                     # スタイル
│   └── app.js                         # フロントエンドロジック
│
├── tests/                             # テスト
│   ├── agents/
│   └── services/
│
├── package.json
├── tsconfig.json
├── .env
└── .env.example
```

---

## 💰 コスト試算

### 開発フェーズ

| フェーズ | 期間 | 主な作業 |
|---------|------|---------|
| フェーズ1 | 1週間 | レベルA完成 |
| フェーズ2 | 2-3週間 | レベルB実装 |
| フェーズ3 | 3-4週間 | レベルC実装 |
| **合計** | **6-8週間** | **完全実装** |

### 運用コスト

| 項目 | 月額 | 備考 |
|-----|------|------|
| **Anthropic API** | $20-50 | Agent SDK使用料 |
| **Gemini API** | ほぼ無料 | 150万トークン/月無料 |
| **サーバー** | $10-20 | Node.js（Heroku/Railway/Fly.io） |
| **合計** | **$30-70/月** | **約¥4,500-10,000/月** |

---

## 🎯 期待効果

### ユーザー満足度向上

- ✅ 24時間365日サポート
- ✅ 即座に回答（待ち時間ゼロ）
- ✅ 実際のデータで回答
- ✅ 作業を代行してくれる

### 作業時間削減

| 作業 | 従来 | AI活用後 | 削減率 |
|-----|------|----------|--------|
| サポート問い合わせ対応 | 10分/件 | 自動 | 100% |
| 商品登録 | 10分/件 | 30秒/件 | 95% |
| 在庫確認 | 5分 | 10秒 | 97% |
| レポート作成 | 2時間 | 1分 | 99% |

### SaaS化への貢献

- ✅ 差別化要因（他にない機能）
- ✅ ユーザー満足度向上→継続率UP
- ✅ サポートコスト削減
- ✅ プレミアム機能として課金可能

---

## 📝 技術的な検討事項

### メリット

- ✅ ユーザー体験の劇的向上
- ✅ サポート業務の自動化
- ✅ 差別化要因
- ✅ スケーラビリティ

### 課題・リスク

- ❌ 開発コストが大きい
- ❌ APIコストの増加
- ❌ エラーハンドリングの複雑化
- ❌ セキュリティリスク（GAS API認証）

### 対策

1. **段階的実装**
   - フェーズごとに完成・テスト
   - 動作確認してから次へ

2. **コスト管理**
   - API使用量の監視
   - 上限設定
   - キャッシュ活用

3. **セキュリティ**
   - APIキー認証
   - レート制限
   - ログ記録

---

## 🚀 次のステップ

### 今すぐできること

1. **フェーズ1開始**
   - チャット履歴保存を実装
   - レスポンス評価機能を追加
   - UI改善

2. **GAS API準備**
   - API Endpoint設計
   - 認証方式決定
   - テストデータ作成

3. **Agent SDK調査**
   - 公式ドキュメント確認
   - サンプルコード実行
   - 動作検証

### 判断が必要なこと

1. **優先順位**
   - フェーズ2とフェーズ3、どちらを優先？
   - 両方並行？

2. **技術選択**
   - GAS API認証: APIキー or OAuth?
   - サーバー: Heroku? Railway? Fly.io?
   - メルカリ調査: スクレイピング? API（有料）?

---

どのフェーズから始めますか？
それとも、まず特定の機能だけを試してみますか？
