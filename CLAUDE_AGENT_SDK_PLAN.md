# Claude Agent SDK × REBORN 統合計画

**作成日**: 2025年10月20日
**ステータス**: 計画段階（Phase 4専用）

---

## 🚨 重要な警告

**このドキュメントは Phase 4（3-6ヶ月後）専用です**

**Phase 1-3では、このドキュメントの内容を提案・実装してはいけません**

**前提条件**:
- ✅ Phase 1完了（在庫管理・売上管理・チーム連携）
- ✅ Phase 2完了（実運用2ヶ月以上）
- ✅ Phase 3完了（SaaS化・安定収益）
- ✅ ユーザーの明示的な承認

**現在**: Phase 1（在庫管理システム実装中）

**このドキュメントの実装時期**: Phase 4（3-6ヶ月後を想定）

**詳細**: [API_SAFETY_CRITICAL.md](API_SAFETY_CRITICAL.md)を参照

---

## 📋 Claude Agent SDK とは

**2025年9月リリースの最新技術**（Anthropic社）

### 主要機能

1. **サブエージェント**: 複数のエージェントを同時に動かして並行作業
2. **Computer Use**: デスクトップ環境を操作可能
3. **自律的な動作**: ファイル操作、コマンド実行、反復作業
4. **TypeScript/Python対応**: 公式SDK提供
5. **コンテキスト管理**: 自動要約機能
6. **MCP統合**: カスタムツールの追加可能

### 公式リソース

- ドキュメント: https://docs.claude.com/en/api/agent-sdk/overview
- GitHub (Python): https://github.com/anthropics/claude-agent-sdk-python
- GitHub (TypeScript): https://github.com/anthropics/claude-agent-sdk-typescript

---

## 💡 REBORN × Agent SDK で実現できること

### フェーズ1: スマート商品登録エージェント ⭐ 最優先

**現在の商品登録フロー:**
```
ユーザーが手動入力 → AI生成ボタン → 説明文生成 → 保存
所要時間: 約10分/件
```

**エージェント導入後:**
```
商品画像をアップロード
  ↓（エージェントが自動実行）
1. 画像からブランド・アイテムを判定
2. メルカリで類似商品を検索
3. 競合価格を調査（5-10件）
4. 平均価格から適正価格を提案
5. 売れる商品名・説明文を生成
6. スプレッドシートに保存
  ↓
完成！所要時間: 約30秒/件
```

**具体的な機能:**
- ✅ 画像解析（ブランドロゴ検出、色・柄抽出）
- ✅ メルカリAPI/スクレイピングで競合調査
- ✅ 適正価格の自動計算
- ✅ SEO最適化された商品名生成
- ✅ 販売促進に効果的な説明文生成
- ✅ 複数プラットフォームへの同時出品準備

**導入効果:**
- 商品登録時間: 10分 → 30秒（**95%削減**）
- 売れる確率: 向上（適正価格設定）
- 作業ストレス: 激減

---

### フェーズ2: 在庫最適化エージェント

**自動タスク:**
```
毎朝9時に実行
  ↓
1. 在庫データを分析
2. 売れ筋/滞留在庫を判定
3. 価格調整を提案
4. プッシュ通知で報告
```

**具体的な機能:**
- ✅ 売れ筋商品の早期検出
- ✅ 滞留在庫の値下げ提案
- ✅ 仕入れ推奨アイテムの提案
- ✅ 在庫回転率の最適化

---

### フェーズ3: 売上分析エージェント

**自動タスク:**
```
毎週月曜日に実行
  ↓
1. 先週の売上を分析
2. トレンドを抽出
3. 今週の戦略を提案
4. レポートを自動生成（PDF）
5. メール/プッシュ通知で送信
```

**具体的な機能:**
- ✅ 週次/月次レポート自動生成
- ✅ カテゴリ別売上分析
- ✅ 利益率の可視化
- ✅ 次の仕入れ戦略提案

---

### フェーズ4: 顧客サポートエージェント（reborn-ai-chat強化）

**現在のreborn-ai-chat:**
```
基本的な質問応答のみ
- REBORNについての一般的な説明
- 機能の概要説明
```

**エージェント導入後:**
```
1. 在庫DBにアクセス
2. 商品情報をリアルタイム検索
3. 具体的な回答を生成
4. 必要に応じてGASを操作
```

**具体例:**

```
【ユーザー】
「UNIQLOのジャケットの在庫はありますか？」

【エージェント】
  ↓ スプレッドシートを検索
  ↓ 該当商品を抽出
  ↓ 回答を生成

「はい、UNIQLOのジャケットは現在3点在庫があります：
1. ウルトラライトダウン（黒、Mサイズ）- ¥3,980
2. フリースジャケット（紺、Lサイズ）- ¥2,500
3. デニムジャケット（青、Sサイズ）- ¥4,200

詳細を見ますか？」
```

---

### フェーズ5: 価格調査エージェント

**自動タスク:**
```
新商品登録時 + 毎日夜中に実行
  ↓
1. メルカリで類似商品を検索
2. 価格推移を記録
3. 値下げタイミングを提案
4. プッシュ通知で報告
```

---

## 📊 実装ロードマップ

### ステップ1: 環境構築（1週間）

```bash
# Claude Agent SDK をインストール
cd reborn-ai-chat
npm install @anthropic-ai/agent-sdk
```

**作業内容:**
- ✅ Agent SDK のセットアップ
- ✅ 認証設定（Anthropic API Key）
- ✅ 基本的なエージェントのテスト
- ✅ REBORN GASとの接続テスト

---

### ステップ2: スマート商品登録エージェント（2-3週間）

**実装順序:**
1. 画像解析機能（Gemini Vision API活用）
2. メルカリ価格調査（Web Scraping or API）
3. 価格計算ロジック
4. 商品名・説明文生成（Claude Agent）
5. GASへの自動保存

**技術スタック:**
```typescript
// reborn-ai-chat/src/agents/product-registration-agent.ts
import { Agent } from '@anthropic-ai/agent-sdk';

class ProductRegistrationAgent {
  async processProduct(imageUrl: string) {
    // 1. 画像解析
    const analysis = await this.analyzeImage(imageUrl);

    // 2. 競合調査
    const competitors = await this.searchMercari(analysis.brand, analysis.item);

    // 3. 価格計算
    const optimalPrice = this.calculateOptimalPrice(competitors);

    // 4. 商品情報生成
    const productInfo = await this.generateProductInfo(analysis, competitors);

    // 5. GASに保存
    await this.saveToGAS(productInfo);

    return productInfo;
  }

  private async analyzeImage(imageUrl: string) {
    // Gemini Vision API で画像解析
  }

  private async searchMercari(brand: string, item: string) {
    // メルカリで類似商品検索
  }

  private calculateOptimalPrice(competitors: any[]) {
    // 適正価格計算
  }

  private async generateProductInfo(analysis: any, competitors: any[]) {
    // Claude Agent で商品情報生成
  }

  private async saveToGAS(productInfo: any) {
    // GAS API経由で保存
  }
}
```

---

### ステップ3: 在庫最適化エージェント（1-2週間）

```typescript
// reborn-ai-chat/src/agents/inventory-agent.ts
class InventoryAgent {
  async analyzeInventory() {
    // スプレッドシートから在庫データ取得
    const inventory = await this.fetchInventoryFromGAS();

    // 分析実行
    const analysis = await this.performAnalysis(inventory);

    // 提案生成
    const recommendations = await this.generateRecommendations(analysis);

    // プッシュ通知
    await this.sendPushNotification(recommendations);
  }

  private async fetchInventoryFromGAS() {
    // GAS API経由でデータ取得
  }

  private async performAnalysis(inventory: any[]) {
    // Claude Agent で在庫分析
  }

  private async generateRecommendations(analysis: any) {
    // 提案生成
  }

  private async sendPushNotification(recommendations: any) {
    // FCM経由でプッシュ通知
  }
}
```

---

### ステップ4: reborn-ai-chat強化（1週間）

```typescript
// reborn-ai-chat/src/agents/support-agent.ts
class SupportAgent {
  async handleQuery(userMessage: string) {
    // 意図を理解
    const intent = await this.classifyIntent(userMessage);

    if (intent === 'inventory_search') {
      // 在庫検索
      const results = await this.searchInventory(userMessage);
      return this.formatInventoryResponse(results);
    }

    if (intent === 'product_registration_help') {
      // 登録サポート
      return await this.guideProductRegistration(userMessage);
    }

    // その他の質問
    return await this.generalSupport(userMessage);
  }

  private async classifyIntent(message: string) {
    // Claude Agent で意図分類
  }

  private async searchInventory(query: string) {
    // GAS API経由で在庫検索
  }

  private formatInventoryResponse(results: any[]) {
    // 読みやすい形式に整形
  }

  private async guideProductRegistration(message: string) {
    // 商品登録のガイダンス
  }

  private async generalSupport(message: string) {
    // 一般的なサポート
  }
}
```

---

## 🏗️ プロジェクト構成

```
reborn-project/
├── reborn-ai-chat/                    # メインプロジェクト
│   ├── src/
│   │   ├── server.ts                  # Expressサーバー
│   │   ├── agents/                    # エージェント群（新規）
│   │   │   ├── product-registration-agent.ts
│   │   │   ├── inventory-agent.ts
│   │   │   ├── sales-analysis-agent.ts
│   │   │   ├── support-agent.ts
│   │   │   └── price-research-agent.ts
│   │   ├── services/                  # サービス層（新規）
│   │   │   ├── gas-connector.ts       # GAS API連携
│   │   │   ├── mercari-scraper.ts     # メルカリ調査
│   │   │   ├── image-analyzer.ts      # 画像解析
│   │   │   └── notification.ts        # プッシュ通知
│   │   └── utils/                     # ユーティリティ
│   ├── public/
│   │   └── index.html                 # チャットUI
│   ├── package.json
│   └── .env                           # 環境変数
│
├── [既存のGASプロジェクト]            # そのまま維持
│   ├── product.js
│   ├── inventory.js
│   ├── config.js
│   └── ...
│
└── docs/                              # PWAファイル（そのまま）
    ├── index.html
    └── ...
```

---

## 💰 コスト試算

### 追加コスト

| 項目 | 月額 | 備考 |
|-----|------|------|
| **Anthropic API** | $20-50 | Claude Agent SDK使用料 |
| **サーバー** | $10-20 | Node.jsアプリホスティング（Heroku/Railway等） |
| **合計** | **$30-70/月** | **約¥4,500-10,000/月** |

**既存コスト（変更なし）:**
- ドメイン: ¥1,500/年
- その他: 無料

---

## 🎯 期待効果

### 作業時間削減

| 作業 | 現在 | 導入後 | 削減率 |
|-----|------|--------|--------|
| 商品登録 | 10分/件 | 30秒/件 | **95%** |
| 在庫チェック | 30分/日 | 自動 | **100%** |
| 売上分析 | 2時間/週 | 自動 | **100%** |
| 価格調査 | 5分/件 | 自動 | **100%** |

**月間削減時間: 約40時間**

### 売上向上

- 適正価格設定 → 売れる確率 **+20-30%**
- SEO最適化 → 閲覧数 **+30-50%**
- 在庫最適化 → 利益率 **+10-15%**

---

## 📝 技術的な検討事項

### メリット

- ✅ 作業時間の大幅削減
- ✅ 売上・利益率の向上
- ✅ 人的エラーの削減
- ✅ スケーラビリティの向上
- ✅ SaaS化への基盤

### デメリット・課題

- ❌ 月額コストの増加（$30-70/月）
- ❌ 複雑性の増加
- ❌ 学習コスト
- ❌ API制限への対応
- ❌ エラーハンドリングの重要性

### リスク管理

1. **APIコスト超過**
   - 解決策: 使用量監視、上限設定

2. **エージェントの誤動作**
   - 解決策: 人間による最終確認、ログ記録

3. **依存度の高まり**
   - 解決策: 手動モードの維持、バックアップ手順

---

## 🚀 次のステップ

### 短期（1-2ヶ月）

1. **環境構築**
   - Agent SDK セットアップ
   - GAS API連携の確立

2. **スマート商品登録エージェント**
   - 画像解析機能
   - 価格調査機能
   - 自動保存機能

### 中期（3-6ヶ月）

3. **在庫最適化エージェント**
   - 自動分析
   - 提案機能

4. **売上分析エージェント**
   - レポート自動生成
   - 戦略提案

### 長期（6ヶ月以降）

5. **SaaS化準備**
   - マルチテナント対応
   - 課金システム
   - 本格的な事業化

---

## 参考資料

- [Anthropic Agent SDK ドキュメント](https://docs.claude.com/en/api/agent-sdk/overview)
- [Building agents with the Claude Agent SDK](https://www.anthropic.com/engineering/building-agents-with-the-claude-agent-sdk)
- [Claude Sonnet 4.5 発表](https://www.anthropic.com/news/claude-sonnet-4-5)

---

**このドキュメントは随時更新されます。**
