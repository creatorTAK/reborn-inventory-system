# 🌐 Webhook方式実装完了レポート（v23 @723）

## 📌 実装概要

postMessage方式からWebhook方式に移行し、PWA非依存の通知システムを実現しました。

**変更前（v20-v22）**:
```
GAS → postMessage → PWA（必須） → Firestore + FCM
               ❌ PWAが閉じていると通知が届かない
```

**変更後（v23）**:
```
GAS → Webhook HTTP POST → Cloudflare Worker → Firestore + FCM
                      ✅ PWA非依存で確実に通知が届く
```

---

## ✅ 実装完了項目

### 1. Cloudflare Workerコード作成
📁 `claudedocs/cloudflare-worker.js`

**機能**:
- HMAC-SHA256署名検証（セキュリティ）
- Firestore REST API経由でシステム通知ルームに投稿
- FCM送信（`/topics/all_users`）
- エラーハンドリング

**環境変数（Cloudflare Worker Secrets）**:
- `WEBHOOK_SECRET`: HMAC署名検証用
- `FIREBASE_PROJECT_ID`: FirebaseプロジェクトID
- `FIREBASE_SERVICE_ACCOUNT`: Service AccountキーJSON
- `FCM_SERVER_KEY`: FCM Server Key

### 2. GAS側Webhook送信処理
📁 `product.js`

**新規関数**:
- `sendProductRegistrationWebhook()`: 通知データ作成 + Webhook送信
- `sendWebhookNotification()`: HTTP POSTリクエスト送信
- `generateHmacSignature()`: HMAC-SHA256署名生成

**変更箇所**:
- `saveProduct()`: `sendProductRegistrationNotification()` → `sendProductRegistrationWebhook()`に変更

**Script Properties（要設定）**:
- `WEBHOOK_URL`: Cloudflare Worker URL
- `WEBHOOK_SECRET`: HMAC署名検証用（Workerと同じ値）

### 3. postMessage関連コード削除
📁 `docs/index.html`, `sp_scripts.html`

**削除内容**:
- PWA側の`__reborn_notify`受信処理
- GAS側の`postMessage`送信処理
- HMAC署名検証関連コード（旧方式）

**残存コード**:
- ナビゲーション要求のpostMessage（チャット画面遷移など）
- ユーザーアイコン更新のpostMessage

### 4. ドキュメント作成
📁 `claudedocs/WEBHOOK_SETUP_GUIDE.md`

**内容**:
- Cloudflare Workerデプロイ手順
- Firebase Service Accountキー取得
- 環境変数設定
- トラブルシューティング

---

## 🔧 セットアップ手順（概要）

### ステップ1: Cloudflare Worker作成
1. Cloudflare Dashboard → Workers & Pages → Create Worker
2. `claudedocs/cloudflare-worker.js`をコピー&ペースト
3. デプロイして Worker URLを取得

### ステップ2: Firebase Service Account取得
1. Firebase Console → プロジェクト設定 → サービスアカウント
2. 「新しい秘密鍵の生成」→ JSONダウンロード

### ステップ3: Cloudflare Worker環境変数設定
```
WEBHOOK_SECRET: （32文字以上のランダム文字列）
FIREBASE_PROJECT_ID: （FirebaseプロジェクトID）
FIREBASE_SERVICE_ACCOUNT: （Service AccountキーJSON）
FCM_SERVER_KEY: （FCM Server Key）
```

### ステップ4: GAS Script Properties設定
```
WEBHOOK_URL: （Cloudflare Worker URL）
WEBHOOK_SECRET: （Workerと同じ値）
```

### ステップ5: デプロイとテスト
```bash
clasp push
clasp deploy --deploymentId AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA
```

詳細は `claudedocs/WEBHOOK_SETUP_GUIDE.md` を参照

---

## 📊 変更ファイル一覧

| ファイル | 変更内容 |
|---------|----------|
| `product.js` | Webhook送信処理実装（3関数追加、1関数変更） |
| `docs/index.html` | postMessage受信処理削除（コメント化） |
| `sp_scripts.html` | postMessage送信処理削除（コメント化） |
| `claudedocs/cloudflare-worker.js` | **新規作成** Webhook Worker実装 |
| `claudedocs/WEBHOOK_SETUP_GUIDE.md` | **新規作成** セットアップガイド |
| `.clasp-current-version.txt` | `@722` → `@723` |

---

## 🎯 次のアクション（ユーザー作業）

### 必須作業（通知を機能させるため）

#### 1. Cloudflare Workerをデプロイ
- [ ] Cloudflareアカウントにログイン
- [ ] `claudedocs/cloudflare-worker.js`をデプロイ
- [ ] Worker URLをコピー

#### 2. Firebase Service Accountキーを取得
- [ ] Firebase Consoleでキー生成
- [ ] JSONファイルをダウンロード

#### 3. Cloudflare Worker環境変数を設定
- [ ] `WEBHOOK_SECRET`を生成（`openssl rand -hex 32`）
- [ ] 4つの環境変数をすべて設定
- [ ] 再デプロイ

#### 4. GAS Script Propertiesを設定
- [ ] `WEBHOOK_URL`を設定
- [ ] `WEBHOOK_SECRET`を設定（Workerと同じ値）

#### 5. テスト
- [ ] GAS版で商品登録 → 通知確認
- [ ] PWA版で商品登録 → 通知確認
- [ ] **PWAを閉じた状態**でGAS版から商品登録 → 通知確認 ⭐ **重要**

### 参考ドキュメント
📖 `claudedocs/WEBHOOK_SETUP_GUIDE.md`

---

## ⚠️ 注意事項

### セキュリティ
- ✅ Service AccountキーをGitにコミットしない
- ✅ `WEBHOOK_SECRET`はCloudflare WorkerとGASで完全一致させる
- ✅ Firebase Service AccountキーはSecretとして保存

### テスト環境推奨
- 本番環境とは別のCloudflare Workerを用意
- Test用Firebaseプロジェクトで先にテスト

### トラブルシューティング
Webhook送信エラーの場合:
1. Cloudflare Worker Logsを確認
2. `WEBHOOK_SECRET`が一致しているか確認
3. Firebase Service Accountキーが正しいか確認

詳細は `claudedocs/WEBHOOK_SETUP_GUIDE.md` のトラブルシューティング参照

---

## 🚀 将来の拡張

### Phase 1（現在）
✅ PWA非依存の通知システム

### Phase 2（将来）
- レート制限実装（DDoS対策）
- リトライ機構（Firestore投稿失敗時）
- 監視・ロギング（Sentry連携）

### Phase 3（SaaS化）
- テナントID追加
- マルチテナント対応
- 管理画面実装

---

## 📝 技術詳細

### HMAC署名フロー
```
1. GAS: timestamp生成
2. GAS: message = timestamp + '.' + JSON_body
3. GAS: signature = HMAC-SHA256(message, WEBHOOK_SECRET)
4. GAS: HTTP POST with headers X-Signature, X-Timestamp
5. Worker: 同じ方法でsignature再計算
6. Worker: 受信signatureと比較検証
7. Worker: タイムスタンプ5分以内チェック
```

### Firestore投稿フロー
```
1. Worker: Service Account JWT生成
2. Worker: Google OAuth2 Access Token取得
3. Worker: Firestore REST API PATCH
4. Worker: chatRooms/system_notifications/messages/{docId}
```

### FCM送信フロー
```
1. Worker: FCM REST API POST
2. Worker: Topic: /topics/all_users
3. Worker: notification + data payload
```

---

## ✅ 実装完了チェックリスト

### コード実装
- [x] Cloudflare Workerコード作成
- [x] GAS Webhook送信処理実装
- [x] postMessage関連コード削除
- [x] セットアップガイド作成
- [x] GASデプロイ（@723）

### ユーザー作業（未完了）
- [ ] Cloudflare Workerデプロイ
- [ ] Firebase Service Accountキー取得
- [ ] Cloudflare Worker環境変数設定
- [ ] GAS Script Properties設定
- [ ] テスト実行

---

## 📞 サポート

問題が発生した場合:
1. `claudedocs/WEBHOOK_SETUP_GUIDE.md`のトラブルシューティング確認
2. Cloudflare Worker Logsを確認
3. GASログを確認（`Logger.log`出力）

---

**実装日**: 2025-11-07
**バージョン**: v23 @723
**実装者**: Claude Code with Serena MCP
