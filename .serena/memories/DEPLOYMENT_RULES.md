# 🚀 REBORN Inventory - デプロイルール（厳守）

**このルールは絶対に省略してはいけません**

## ⚠️ 重要な原則

**コード修正 = 必ずGASデプロイ**
- GAS版（スプレッドシート + PWA）
- 既存デプロイIDを更新する方式（効率的）

---

## 📋 標準デプロイフロー（効率化版）

### Step 1: GASコードアップロード
```bash
npx @google/clasp push
# または
npm run deploy:gas "変更内容"
```
- コードをGASにアップロード
- スプレッドシートのサイドバー/メニューには即反映
- **Web Appには未反映**（次のステップが必須）

### Step 2: GAS Web Appデプロイ（既存IDを更新）
```bash
npx @google/clasp deploy --deploymentId AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA --description "変更内容の簡潔な説明"
# または
npm run deploy:gas "変更内容"
```

**重要ポイント:**
- 同じデプロイIDを使い続ける（固定）
- `--deploymentId` オプションで既存IDを更新
- `--description` オプションで変更内容を記録
- **index.html の更新不要**（デプロイIDが変わらないため）

**成功例:**
```
Deployed AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA @856
```

### Step 3: Firestoreセキュリティルールデプロイ（ルール変更時のみ）
```bash
npx firebase deploy --only firestore:rules
# または
npm run deploy:rules
```
- docs/firestore.rules を編集後に実行
- 所要時間：約5秒
- Firebase Console不要（CLI経由で自動デプロイ）

**成功例:**
```
✔ cloud.firestore: rules file docs/firestore.rules compiled successfully
✔ firestore: released rules docs/firestore.rules to cloud.firestore
✔ Deploy complete!
```

### Step 4: Cloudflare Pagesデプロイ（PWAコード変更時のみ）
```bash
# inventory.js, config.js 等のGASファイルのみ変更した場合 → 不要
# docs/配下のファイルを変更した場合のみ実行:
git add .
git commit -m "変更内容"
git push origin main
```

---

## ✅ デプロイチェックリスト

コード修正後、以下を必ず実行：

### GASファイル修正時（inventory.js, config.js, web_push.js, chat_ui_firestore.html等）
- [ ] `npx @google/clasp push`
- [ ] `npx @google/clasp deploy --deploymentId AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA --description "変更内容"`
- [ ] ✅ 完了（index.html更新不要、git push不要）

### PWAファイル修正時（docs/index.html, docs/styles.css等）
- [ ] `git add .`
- [ ] `git commit -m "変更内容"`
- [ ] `git push origin main`
- [ ] ✅ 完了（Cloudflare Pages自動デプロイ 1〜2分）

### Firestoreセキュリティルール修正時（docs/firestore.rules）
- [ ] `npx firebase deploy --only firestore:rules` または `npm run deploy:rules`
- [ ] ✅ 完了（約5秒、Firebase Console不要）

### 両方修正時（GAS + PWA）
- [ ] `npx @google/clasp push`
- [ ] `npx @google/clasp deploy --deploymentId AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA --description "変更内容"`
- [ ] `git add .`
- [ ] `git commit -m "deploy: 変更内容"`
- [ ] `git push origin main`

---

## 🔧 デプロイID管理

**PWA用固定デプロイID:**
```
AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA
```

**現在のバージョン番号:** @679

**初回設定日:** 2025-10-28
**最終更新:** 2025-11-06

**重要:** このIDは変更しないこと。同じIDを使い続けることで：
- デプロイ上限（20件）を気にしなくて良い
- index.html の更新が不要
- デプロイが高速化

---

## 🚫 やってはいけないこと

❌ `npx @google/clasp deploy`（オプションなし） → 新しいIDが発行されてしまう
❌ 違うデプロイIDを使う → index.htmlとの不整合
❌ GASファイル修正後にpushだけで終わる → Web Appに未反映

---

## 🔄 デプロイ上限エラーが出た場合

もし `Scripts may only have up to 20 versioned deployments` エラーが出た場合：

```bash
# デプロイ一覧を確認
npx @google/clasp deployments

# 不要な古いデプロイを削除（PWA用固定デプロイ以外）
npx @google/clasp undeploy [デプロイID]
```

**注意:** `AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA` は絶対に削除しないこと！

---

## 📝 デプロイ時のdescription例

```bash
# 例1: バグ修正
--description "fix(INV-004): 利益率フォーマット修正"

# 例2: 機能追加
--description "feat(INV-005): 検索UI改善"

# 例3: 通知修正
--description "fix(NOTIF-003): FCMトークン自動更新対応"

# 例4: チャット修正
--description "fix(CHAT): app=pwaフラグで判定ロジック修正"
```

---

## 🔄 デプロイ完了の確認方法

1. PWA版を開く（ハードリロード: Cmd+Shift+R / Ctrl+Shift+R）
2. ブラウザのDevToolsを開く
3. Consoleで確認：
   - エラーが出ていないか
   - 新機能が動作しているか

---

**最終更新: 2025-11-13**
**ルール改訂理由: Firebase CLI導入、Firestoreルールデプロイフロー追加、バージョン@856**
