# マルチプラットフォーム連携ロードマップ

**作成日**: 2025-12-05
**目的**: FURIRAを複数販売プラットフォーム + SNS集客の一元管理システムへ発展させる

---

## 📊 プラットフォーム別API連携状況

### 個人向け（API連携不可 → 手動コピペ運用）
| プラットフォーム | API | 運用方法 |
|----------------|-----|---------|
| メルカリ | ❌ | FURIRAで管理 → 手動コピペ |
| Yahoo!フリマ | ❌ | FURIRAで管理 → 手動コピペ |
| Yahoo!オークション | ❌（個人） | FURIRAで管理 → 手動コピペ |
| ラクマ | ❌（個人） | FURIRAで管理 → 手動コピペ |

### 事業者向け（API連携可能 → 自動化可能）
| プラットフォーム | 事業者プログラム | API | 条件 |
|----------------|----------------|-----|------|
| メルカリShops | ショップ開設 | ✅ | 個人でも可、審査あり |
| Yahoo!オークション | ストア出店 | ✅ | 法人/個人事業主、個別契約 |
| ラクマ | 公式ショップ | ✅ | リユース事業者向け、審査あり |
| BASE | 開発者登録 | ✅ | 申請後1-2週間で利用可能 |
| eBay | セラー登録 | ✅ | 世界190カ国対応 |

---

## 🌏 海外展開プラットフォーム

| プラットフォーム | 対象地域 | 特徴 | API |
|----------------|---------|------|-----|
| eBay | 世界190カ国 | 古着カテゴリ人気、ラクマ連携あり | ✅ |
| Shopify | 世界（自社EC） | 130通貨対応、越境EC最強 | ✅ |
| Etsy | 世界 | ヴィンテージ・ハンドメイド特化 | ✅ |
| Poshmark | 米国のみ | ファッション特化、国際配送不可 | ❌ |
| Depop | 欧米 | 若者向け、SNS型 | ⚠️ |
| Vinted | 欧州 | 古着特化 | ❌ |

---

## 📱 SNS集客連携

### Meta Business API（Instagram自動投稿）
**公式ドキュメント**: https://developers.facebook.com/docs/instagram-api

**実現できること**:
- 商品画像 + 説明文を自動投稿
- ハッシュタグ自動付与
- 投稿スケジュール設定
- Instagramショッピングタグ連携

**必要なもの**:
- Instagramビジネスアカウント
- Facebookページとの連携
- Meta開発者アカウント
- アプリ審査（投稿機能利用時）

**API機能**:
- Content Publishing API: 画像/動画投稿
- Instagram Graph API: インサイト取得
- Product Tagging API: 商品タグ付け

### X (Twitter) API
- 商品登録時に自動ツイート
- 画像付き投稿
- ハッシュタグ自動付与

---

## 🎯 実装フェーズ

### Phase 1: 現状（個人運用）
- FURIRAで商品情報を一元管理
- 各プラットフォームに手動でコピペ出品
- 在庫は手動で同期

### Phase 2: 事業者登録後
- メルカリShops API連携
- BASE API連携
- 在庫自動同期の実装

### Phase 3: 海外展開
- eBay API連携
- Shopify連携（自社EC）
- 多言語対応

### Phase 4: SNS集客自動化
- Meta Business API連携（Instagram自動投稿）
- X API連携
- 商品登録 → 自動宣伝の実現

---

## 💡 完成形イメージ

```
FURIRAで商品登録（1回）
        ↓
┌───────────────────────────────────────┐
│  【販売】          │  【集客】         │
│  メルカリShops     │  Instagram       │
│  Yahoo!ストア      │  X (Twitter)     │
│  ラクマ公式        │                  │
│  BASE             │                  │
│  eBay (海外)      │                  │
│  Shopify (自社EC) │                  │
└───────────────────────────────────────┘
        ↓
   在庫自動同期 + 受注一元管理 + 認知拡大
```

---

## 📚 参考リンク

- [Meta Business API](https://developers.facebook.com/docs/instagram-api)
- [BASE Developers](https://developers.thebase.com/)
- [eBay Developers](https://developer.ebay.com/)
- [Shopify API](https://shopify.dev/api)
- [メルカリShops API連携情報](https://recore-pos.com/column_post/s_merukari-merukarishops-api/)

---

**最終更新**: 2025-12-05
