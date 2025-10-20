# REBORN プロジェクト - 開発ドキュメント

古着物販管理システム（Google Apps Script + スプレッドシート）

**完成度: 85%** | **商品登録: 100%** ✅ | **設定管理: 100%** ✅ | **PWA基盤: 100%** ✅ | **FCM通知: 100%** ✅ | **チーム管理: 10%** 🎯 | **在庫管理: 0%** | **売上分析: 20%**

---

## 🚨 最重要：必読ドキュメント

**Claude Code（AI開発アシスタント）へ**: 開発を始める前に必ず読むこと

### API使用時の重大な安全ルール
**[API_SAFETY_CRITICAL.md](API_SAFETY_CRITICAL.md)** ← ★必ず最初に読むこと

**背景**: 2025年10月20日、Claude APIの誤設定により800円の損失と開発停止が発生

**絶対厳守事項**:
- ❌ グローバル環境変数にAPIキーを設定しない
- ❌ Phase を飛ばした提案をしない（今はPhase 1）
- ❌ 新しいAPI導入は必ず事前確認
- ❌ Claude Agent SDKは Phase 4まで提案禁止

**詳細**: [API_SAFETY_CRITICAL.md](API_SAFETY_CRITICAL.md)を必ず参照

---

## 📋 目次

**このファイル（CLAUDE.md）**: プロジェクトのエッセンシャル情報
1. [プロジェクト概要](#プロジェクト概要)
2. [技術スタック](#技術スタック)
3. [ファイル構成](#ファイル構成)
4. [開発ルール](#開発ルール)
5. [最新の更新内容](#最新の更新内容)

**詳細ドキュメント** (必要に応じて読み込み):
- **[API_SAFETY_CRITICAL.md](API_SAFETY_CRITICAL.md)** ★最重要 - API使用時の重大な安全ルール（必ず最初に読むこと）
- **[PWA_SETUP_GUIDE.md](PWA_SETUP_GUIDE.md)** - PWA + GAS + FCM構成の完全マニュアル、トラブルシューティング
- **[DEVELOPMENT_SERVICES.md](DEVELOPMENT_SERVICES.md)** - 開発環境・ツール一覧、サービス情報
- **[DOCUMENTATION_RULES.md](DOCUMENTATION_RULES.md)** - ドキュメント管理ルール

---

## プロジェクト概要

### ビジネス背景

古着の**仕入れからメルカリ等での販売**まで、物販事業の全工程を超効率化するシステム。非エンジニアがAI + ライブコーディングで開発中。

### 開発目標

**⚠️ 重要な方針転換（2025年10月15日）** ★超重要

**全ての開発をチーム利用を前提に進める**

- **開発者自身がチームで利用する**ため、実際の業務で検証しながら開発
- **個人向け**ではなく**チーム向け**を主軸に設計
- **プッシュ通知**によるタスク管理・自動化を核とした差別化戦略

**開発目標の見直し**:
- **短期（現在）**: 在庫管理・売上管理システムの実装 ← ★最優先
- **中期（3-6ヶ月）**: プッシュ通知による完全自動化、チーム管理機能
- **長期（6ヶ月以降）**:
  - **個人プラン**（月額980円）: 1人利用、基本機能
  - **チームプラン**（月額4,980円）★主力商品: 5人まで、プッシュ通知フル活用、タスク管理
  - **エンタープライズ**（要見積もり）: 無制限、カスタマイズ対応

---

## 技術スタック

### コア技術

```
Google Apps Script (GAS)
├── バックエンド: JavaScript (ES6+)
├── データベース: Google スプレッドシート
├── フロントエンド: HTML Service + Bootstrap 5
└── デプロイ: clasp (Google Apps Script CLI)
```

### PWA・プッシュ通知

```
PWA (Progressive Web App)
├── ホスティング: Cloudflare Pages
├── カスタムドメイン: www.reborn-inventory.com
├── Service Worker: firebase-messaging-sw.js
├── FCM (Firebase Cloud Messaging): プッシュ通知
└── Badge API: アイコンバッジ表示
```

### 開発環境

```
ローカル開発
├── エディタ: Visual Studio Code
├── バージョン管理: Git + GitHub
├── 同期ツール: clasp (GAS CLI)
└── AI支援: Claude Code + Serena MCP
```

### 開発ワークフロー（簡易版）

```bash
# 1. ローカルでコード編集（VSCode）

# 2. GASファイルの場合
clasp push -f  # GASにプッシュ
# Apps Scriptエディタで手動デプロイ（「新バージョン」として）

# 3. PWAファイル(docs/)の場合
git add . && git commit -m "feat: ..." && git push
# Cloudflare Pagesが自動デプロイ（1-2分）

# 4. ブラウザでテスト（スーパーリロード: Cmd+Shift+R）
```

**⚠️ 重要**: `clasp deploy`は**絶対に使用禁止**（ライブラリとして作成されウェブアプリとして動作しない）

**詳細**: デプロイ手順の完全版は[DEVELOPMENT_GUIDE.md](DEVELOPMENT_GUIDE.md)を参照

---

## ファイル構成

### 全39ファイル構成

#### JSファイル（22個）

**コアシステム**
```
config.js                    # システム全体設定・FIELD_IDS定義
menu.js                      # メニュー表示・サイドバー制御
common.js                    # 共通ユーティリティ統合
utils.js                     # ユーティリティ（最小版）
error_handler.js             # 統一エラーハンドリングシステム
```

**商品管理**
```
product.js                   # 商品登録（列名ベースマッピング）★重要
inventory.js                 # 在庫管理（検索・更新・利益計算）
id.js                        # 管理番号生成（セグメント方式）
gemini_api.js                # Gemini API統合（AI商品説明文生成）
web_push.js                  # FCM通知送信（OAuth 2.0認証）
```

**設定管理**
```
config_loader.js             # 設定マスタ読み込み・保存 ★最重要
setup_config.js              # 設定マスタシート自動生成
```

**マスタデータ管理**
```
master.js                    # マスタデータ取得 ★最重要
master_hierarchy.js          # セールスワード関連機能
master_utils.js              # マスタ共通処理
master_simple.js             # 手動管理シート用シンプルマスタ取得
master_data_manager.js       # マスタデータ管理統括
master_data_reducer.js       # データ削減システム
```

**最適化・検証**
```
performance_optimizer.js     # パフォーマンス最適化（キャッシュ機能）
data_integrity.js            # データ整合性確保
validation_enhancer.js       # 強化されたバリデーションシステム
diagnosis.js                 # システム診断
test_master.js               # テスト用
```

#### HTMLファイル（20個）

**メインUI**
```
sidebar_product.html         # 商品登録メインUI（テンプレート構造）
sidebar_config.html          # 設定管理UI（8タブ構成）★最大規模
sidebar_inventory.html       # 在庫管理サイドバー
inventory_sidebar.html       # 在庫管理UIサイドバー
master_manager_ui.html       # マスタデータ管理UI
```

**スクリプト・スタイル**
```
dynamic_block_builder.html           # 動的ブロックビルダー（統一システム）
dynamic_block_builder_styles.html    # 動的ブロックビルダー用スタイル
test_dynamic_block_builder.html      # 動的ブロックビルダーテスト
sp_scripts.html              # JavaScript処理 ★最重要・最大規模
sp_styles.html               # CSSスタイルシート
management_number_builder.html       # 管理番号ビルダーUI
mobile_header.html           # モバイルヘッダー（タブナビゲーション）
```

**商品登録UIブロック（モジュラー設計）**
```
sp_block_manage.html         # 管理番号入力ブロック
sp_block_basic.html          # 基本情報入力ブロック
sp_block_title.html          # 商品名作成ブロック
sp_block_description.html    # 商品の説明ブロック
sp_block_shipping.html       # 配送情報ブロック
sp_block_procure.html        # 仕入情報ブロック
sp_block_listing.html        # 出品情報ブロック
sp_block_kodawari.html       # こだわり条件ブロック
```

#### PWAファイル（docs/）

```
docs/index.html              # PWAメイン画面（postMessage受信）
docs/notifications.html      # 通知ページ（バッジ管理）
docs/firebase-messaging-sw.js  # Service Worker（FCM通知受信）
docs/manifest.json           # PWA設定
docs/icon-*.png              # アプリアイコン
```

---

## 開発ルール

### ✅ 開発時のチェックリスト

#### フィールド追加時
- [ ] フォームIDとスプレッドシート列名が一致しているか確認
- [ ] 一致していない場合は`fieldMapping`に追加
- [ ] `FIELD_IDS`（フロントエンド）に追加
- [ ] `PRODUCT_FIELDS`（バックエンド）に**実際のシート列名**で追加

#### 行コピー処理変更時
- [ ] `PASTE_FORMULA`, `PASTE_FORMAT`, `PASTE_DATA_VALIDATION`を個別使用
- [ ] `clearContent()`を使用していないか確認
- [ ] 数式が正しく引き継がれるかテスト

#### 設定マスタ追加時
- [ ] `config_loader.js`の`loadConfigMaster()`に読み込み処理を追加
- [ ] `config_loader.js`の`saveConfigMaster()`に保存処理を追加
- [ ] `setup_config.js`にデフォルトデータを追加
- [ ] `sidebar_config.html`にUI要素を追加

---

### 🤖 AI活用ルール ★超重要

#### Claude Code（このAI）の得意・不得意

**高確度（90%以上）- 自信を持って実装可能**:
- ✅ Google Apps Script（GAS）開発
- ✅ スプレッドシート連携、データ操作
- ✅ HTML/CSS/JavaScript基礎
- ✅ マスタデータ連携、UI設計
- ✅ 商品登録のような従来型Web開発

**中確度（60-70%）- 慎重に進める**:
- ⚠️ FCMの一般的な実装（Webブラウザ）
- ⚠️ Service Workerの基本
- ⚠️ PWAの基礎知識

**低確度（50%以下）- 必ず他AIに相談**:
- ❌ **iOS PWA特有の挙動**
- ❌ **モバイル特有の制約・バグ**
- ❌ **Firebase/FCM詳細仕様**
- ❌ **Push Notification API（iOS）**
- ❌ **Service Worker詳細仕様**
- ❌ **CORS（Apps Script特有の問題）**

#### 必須ルール

**低確度領域に入る前に、必ず以下を実行**:

1. **ユーザーに確認を求める**
   ```
   「この部分は私の知識確度が低い領域です。
    ○○（ChatGPT/Gemini）に相談することを推奨します。」
   ```

2. **相談先AI候補を提案**
   - **Gemini**: Google製品（GAS、FCM、Firebase）に強い、レスポンス速い、使用制限なし → 日常的な相談役
   - **ChatGPT エージェントモード**: 最新情報を網羅的に調査（10-15分）、使用制限あり → 重要判断時のみ
   - **Claude**: 文章理解、ドキュメント分析

3. **使い分けの原則**:
   - まずGeminiで軽く確認（5分以内で答えが出そうな質問）
   - 解決しない、または重要な判断が必要 → ChatGPTエージェントモード
   - ChatGPTは「最後の切り札」として温存

4. **絶対に推測で実装しない**
   - 「おそらく動く」→ テストして動かない → 時間の無駄
   - 確実な情報を得てから実装

---

### ❌ 禁止事項

#### コーディング
- ❌ `PASTE_NORMAL`を使用しない（数式が消える）
- ❌ `clearContent()`を数式が入っている範囲に使用しない
- ❌ フィールド名を推測しない（必ず実際の列名を確認）
- ❌ デフォルト値をコード内にハードコードしない（設定マスタを使用）
- ❌ DOM標準メソッドと同じ名前の関数を使用しない（`removeAttribute`等）

#### ワークフロー
- ❌ Apps Script webエディタで直接編集しない
- ❌ `clasp push`せずにブラウザをリロードしない
- ❌ ローカルファイルを編集した後に`clasp pull`しない（上書きされる）
- ❌ `clasp deploy`を実行しない（ライブラリとして作成される）

#### デプロイ

**✅ すること**:
- Apps Scriptのファイル（`.js`, `.html`）を修正した後：
  - 必ず「clasp push後、Apps Scriptエディタで新バージョンとしてデプロイしてください」と案内
  - デプロイ手順を毎回明示する
- `docs/`フォルダ内のファイルを修正した場合：
  - 「GitHub pushで反映されます。1〜2分待ってからリロードしてください」と案内

**❌ しないこと**:
- 「デプロイしましたか？」という確認
- 「デプロイができてないことが原因です」という推測
- デプロイに関する問題の可能性を示唆すること

**理由**: ユーザーは指示通りに必ず実行するため、デプロイ関連の確認や推測は不要

---

### 📝 トラブルシューティング

よくある問題の解決方法は[TROUBLESHOOTING.md](TROUBLESHOOTING.md)を参照してください。

**代表的な問題**:
- プルダウンが表示されない → `master.js`の`_findIdx()`確認
- データが保存されない → `fieldMapping`確認
- 数式が消える → `PASTE_NORMAL`使用禁止
- 設定が反映されない → キャッシュクリア、スーパーリロード

---

## 最新の更新内容

**最終更新日**: 2025年10月20日（📚 **ドキュメント構成の最適化** ✅）

### 📚 ドキュメント構造

**CLAUDE.md** (このファイル) - 14K、エッセンシャルのみ、常時読み込み

**詳細ドキュメント** (必要に応じて読み込み):
- **[PWA_SETUP_GUIDE.md](PWA_SETUP_GUIDE.md)** (60K) - PWA + GAS + FCM構成の完全マニュアル、トラブルシューティング
- **[DEVELOPMENT_SERVICES.md](DEVELOPMENT_SERVICES.md)** (74K) - 開発環境・ツール一覧、サービス情報

**効果**:
- ✅ CLAUDE.mdは14K（40k制限の1/3）で最適化済み
- ✅ 会話圧縮時のトークン消費を最小化
- ✅ 必要な情報だけを読み込める構成

### 過去の更新（2025年10月19日）

- ⚙️ **デフォルトセールスワード設定（100%完成）** ✅
- 🔧 **5つのバグ修正** ✅（iPhone SEスクロール、商品属性削除、アプリ音停止、複数デバイス通知）
- 📱 **通知ページPWA化完了** ✅
- 🎯 **開発戦略見直し**: 在庫管理・売上管理システムを優先実装（通知・SaaS機能は一時停止）

詳細は各ドキュメントを参照：
- PWA構成・トラブル → [PWA_SETUP_GUIDE.md](PWA_SETUP_GUIDE.md)
- 開発環境・ツール → [DEVELOPMENT_SERVICES.md](DEVELOPMENT_SERVICES.md)

---

**このドキュメントは Claude Code が効率的に開発を進めるための完全なリファレンスです。**
