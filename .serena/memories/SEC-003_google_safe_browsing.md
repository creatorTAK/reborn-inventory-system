# SEC-003 - Google Safe Browsing警告（旧ドメイン）

## 📊 状態: 審査リクエスト送信完了（実質影響なし）

**対応日**: 2025-11-13  
**優先度**: 低（旧ドメインで現在使用していないため）  
**完了日**: 2025-11-13

---

## 🚨 問題の概要

Android端末で `https://www.reborn-inventory.com` にアクセスすると、Google Safe Browsingによる「危険なサイト」警告が表示される。

**警告メッセージ:**
> 「危険なサイト - アクセスしようとしたサイトでは、攻撃者がユーザーを騙してソフトウェアをインストールさせたり、パスワード、電話番号、クレジットカード番号などを開示させたりする可能性があります。」

---

## 🔍 調査結果

### ドメイン状況
- ✅ **furira.jp**: 現在使用中のメインドメイン → **問題なし**
  - Google Safe Browsing Status: 「データがありません」（クリーン）
- ⚠️ **reborn-inventory.com**: 旧ドメイン（**現在使用していない**） → 警告あり
  - Google Safe Browsing Status: 「このサイトは安全ではありません」

### Google Safe Browsing 詳細
**検出内容**: ソーシャルエンジニアリング攻撃

**説明**:  
> 「これらのページは、ユーザーを騙して危険な操作（望ましくないソフトウェアのインストール、個人情報の公開など）を実行させようとしています。」

**具体的なURL**: なし（ドメイン全体への警告）

### 原因分析
**最も可能性が高い原因**: 前所有者による不正利用の履歴

- ドメイン全体がブラックリストに登録されている
- 現在のサイトコンテンツには問題なし（正規のビジネスアプリケーション）
- 特定のURLが指摘されていない = ドメインレピュテーション問題

---

## ✅ 実施した対応（2025-11-13）

### 1. Google Search Console セットアップ
- ✅ ドメイン所有権確認（DNS検証方式）
- ✅ Cloudflare OAuth経由でDNS TXTレコード追加
- ✅ 所有権証明完了

### 2. セキュリティ問題の確認
- ✅ Google Search Console「セキュリティの問題」画面で詳細確認
- ✅ 検出された問題: 不正なページ（ソーシャルエンジニアリング）
- ✅ URLの例: 該当なし（ドメイン全体への警告）

### 3. 審査リクエスト送信
- ✅ Google Search Console「審査をリクエスト」ボタンから送信
- ✅ 説明文提出（英語）:

```
This appears to be a false positive. Our website (reborn-inventory.com) is a legitimate business inventory management system with the following characteristics:

- Business purpose: Product inventory and sales record management
- No software downloads offered
- No requests for personal information beyond standard business data
- Secured with Firestore authentication
- No malicious content present

We believe this may be related to previous domain ownership history. We request a manual review of our current website content.
```

- ⏳ 審査結果待ち（通常2-3営業日）
- 📧 結果はメールで通知される予定

---

## 💡 実質的な影響

**影響なし** - 以下の理由により実質的な問題はない：

1. **reborn-inventory.comは旧ドメイン**で、現在使用していない
2. 現在のメインドメイン **furira.jp には警告なし**
3. ユーザーは全員 furira.jp を使用しているため、**サービスに影響なし**

---

## 📋 今後の対応

### 審査結果待ち（2-3営業日）
- ✅ **承認された場合**: ドメインの警告が解除される
- ❌ **却下された場合**: 再審査リクエスト or ドメイン廃棄検討

### 長期的な対応
- reborn-inventory.com を今後使用する予定がなければ、**ドメイン更新せず自然廃棄**
- furira.jp が正常に動作している限り、実質的な対応不要

---

## 🔗 関連リソース

- **Google Safe Browsing Status**: https://transparencyreport.google.com/safe-browsing/search
- **Google Search Console**: https://search.google.com/search-console
- **Cloudflare DNS設定**: Cloudflare Dashboard → reborn-inventory.com → DNS

---

## 📝 メモ

- 旧ドメインの警告のため、実質的な緊急性はない
- furira.jp（現在のメインドメイン）には問題なし
- 審査結果はメールで通知される
- 審査に2-3営業日かかる（通常）

---

**最終更新**: 2025-11-13 20:35  
**ステータス**: 審査リクエスト送信完了、結果待ち（実質影響なし）
