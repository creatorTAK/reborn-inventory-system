# 🚨 CSS変更時の必須デプロイ手順（厳守）

## 問題の背景
PWA版でCSS変更が反映されない問題が繰り返し発生（2025-11-13に3回発生）。
根本原因：Service WorkerがCSSを強力にキャッシュしており、バージョンパラメータだけでは更新されない。

## ✅ CSS変更時の必須3ステップ

### Step 1: CSSファイル本体を変更
```bash
# バージョン番号をインクリメント（コメント行を必ず変更）
# 例：@version 2.1 → @version 2.2
```

### Step 2: Service Worker バージョンアップ（最重要）
```bash
# docs/firebase-messaging-sw.js
# CACHE_VERSION を必ずインクリメント
const CACHE_VERSION = 'v34';  → 'v35'
console.log('[SW v34]...');   → '[SW v35]...'
```

### Step 3: git push（Cloudflare Pages自動デプロイ）
```bash
git add docs/css/ docs/firebase-messaging-sw.js
git commit -m "fix: CSS更新 + SW v35"
git push origin main
```

## ⚠️ 絶対にやってはいけないこと

❌ Service Workerバージョンを上げずにCSS変更をpush
❌ バージョンパラメータ（?v=xxxx）だけに頼る
❌ CSSファイル本体を変更せずにデプロイ

## 📋 確認チェックリスト

CSS変更をpushする前に必ず確認：
- [ ] CSSファイルの @version をインクリメント
- [ ] Service Workerの CACHE_VERSION をインクリメント
- [ ] Service Workerの console.log も更新
- [ ] 両方のファイルを同時に git add
- [ ] git push 完了

## 🔍 デプロイ後の確認方法

### ユーザー側での確認手順
1. PWAアプリを完全終了（バックグラウンドからも削除）
2. 30秒待つ（Cloudflare Pagesデプロイ待ち）
3. PWAアプリを再起動
4. ブラウザ版の場合：F12 → Console → `[SW vXX]` でバージョン確認

### 開発側での確認コマンド
```bash
# Cloudflare Pagesデプロイ状況確認
curl -s "https://reborn-inventory-system.pages.dev/firebase-messaging-sw.js" | grep "CACHE_VERSION"

# CSS更新確認
curl -s "https://reborn-inventory-system.pages.dev/css/reborn-theme.css" | head -10
```

## 📝 発生履歴

- **2025-11-13 12:00** - UI-017: CSSバージョンパラメータのみ変更（失敗）
- **2025-11-13 12:30** - CSSファイル本体を変更（失敗）
- **2025-11-13 13:00** - Service Worker v34 に更新（成功）

**教訓**：Service Workerバージョンアップなしでは、どんな方法でもキャッシュはクリアされない。

## 🎯 今後の改善予定

1. **自動チェックスクリプト作成**
   - CSS変更時にService Workerバージョンも変更されているか自動確認
   - pre-commit hookで実装

2. **デプロイ前検証**
   - `npm run deploy:check` コマンドでバージョン整合性確認

3. **ドキュメント化**
   - この手順をREADME.mdに追加

---

**最終更新: 2025-11-13**
**重要度: 🔴 最高（繰り返し発生防止のため）**
