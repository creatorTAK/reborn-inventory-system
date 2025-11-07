# 🌐 Webhook方式セットアップガイド

## 📌 概要

Webhook方式により、GASからの通知送信がPWAに依存せず、サーバーサイドで完結します。

**アーキテクチャ**:
```
GAS → HTTP POST → Cloudflare Worker → Firestore投稿 + FCM送信
```

**メリット**:
- ✅ PWAが開いていなくても通知が届く
- ✅ サーバーサイド完結でより確実
- ✅ 将来のSaaS化の基盤

---

## 🔧 セットアップ手順

### 1️⃣ Cloudflare Workerのデプロイ

#### 1-1. Cloudflare Dashboardにログイン
https://dash.cloudflare.com/

#### 1-2. Workers & Pages → Create application → Create Worker

#### 1-3. Worker名を設定
推奨名: `reborn-webhook-worker`

#### 1-4. コードをデプロイ
`claudedocs/cloudflare-worker.js` の内容をコピーしてWorkerエディタに貼り付け

#### 1-5. デプロイ
「Save and Deploy」をクリック

#### 1-6. Worker URLをコピー
例: `https://reborn-webhook-worker.YOUR_SUBDOMAIN.workers.dev`

---

### 2️⃣ Firebase Service Accountキーの取得

#### 2-1. Firebase Consoleにアクセス
https://console.firebase.google.com/

#### 2-2. プロジェクト設定 → サービスアカウント

#### 2-3. 「新しい秘密鍵の生成」をクリック

#### 2-4. JSONファイルをダウンロード
⚠️ このファイルは機密情報です。安全に保管してください。

---

### 3️⃣ Cloudflare Worker環境変数の設定

#### 3-1. Worker設定 → Variables and Secrets

#### 3-2. 以下の環境変数を設定（すべてSecretとして設定）

| 変数名 | 値 | 取得方法 |
|--------|-----|----------|
| `WEBHOOK_SECRET` | ランダムな文字列（32文字以上推奨） | `openssl rand -hex 32` で生成 |
| `FIREBASE_PROJECT_ID` | FirebaseプロジェクトID | Firebase Console → プロジェクト設定 |
| `FIREBASE_SERVICE_ACCOUNT` | Service AccountキーのJSON文字列 | ダウンロードしたJSONファイルの内容をそのまま貼り付け |
| `FCM_SERVER_KEY` | FCM Server Key | Firebase Console → プロジェクト設定 → Cloud Messaging → Server Key |

**WEBHOOK_SECRETの生成例**:
```bash
# macOS/Linux
openssl rand -hex 32

# または、任意の32文字以上のランダム文字列
```

**FIREBASE_SERVICE_ACCOUNTの設定例**:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com",
  ...
}
```
⚠️ JSON全体を**そのまま**貼り付けてください（改行含む）

#### 3-3. 保存して再デプロイ

---

### 4️⃣ GAS Script Propertiesの設定

#### 4-1. GASエディタで「プロジェクトの設定」→「スクリプト プロパティ」

#### 4-2. 以下の2つのプロパティを追加

| プロパティ | 値 |
|------------|-----|
| `WEBHOOK_URL` | Cloudflare Worker URL（例: `https://reborn-webhook-worker.YOUR_SUBDOMAIN.workers.dev`） |
| `WEBHOOK_SECRET` | Cloudflare Workerで設定した`WEBHOOK_SECRET`と**同じ**値 |

⚠️ `WEBHOOK_SECRET`はCloudflare WorkerとGASで**完全に一致**する必要があります

---

### 5️⃣ デプロイとテスト

#### 5-1. GASをデプロイ
```bash
clasp push
clasp deploy --deploymentId AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA
```

#### 5-2. バージョン番号を更新
`.clasp-current-version.txt` を更新（例: `@723`）

#### 5-3. テスト
1. **GAS版**で商品登録
2. **PWA版**で商品登録
3. **PWAを閉じた状態**でGAS版から商品登録

#### 5-4. 通知確認
- Firestoreの`chatRooms/system_notifications/messages`に投稿があることを確認
- FCM通知が届くことを確認

---

## 🔍 トラブルシューティング

### ❌ Webhook送信エラー: 401 Unauthorized
**原因**: HMAC署名の検証失敗

**確認事項**:
1. GAS Script Propertiesの`WEBHOOK_SECRET`とCloudflare Workerの`WEBHOOK_SECRET`が一致しているか
2. タイムスタンプが5分以内か（サーバー時刻のずれ）

### ❌ Webhook送信エラー: 500 Internal Server Error
**原因**: Cloudflare Worker内部エラー

**確認事項**:
1. Cloudflare Worker Logs を確認（Dashboard → Worker → Logs）
2. Firebase Service Accountキーが正しく設定されているか
3. FCM Server Keyが正しく設定されているか

### ❌ 通知が届かない
**原因**: FCM送信失敗

**確認事項**:
1. Cloudflare Worker Logsでエラーを確認
2. FCM Server Keyが有効か
3. ユーザーがトピック購読しているか（`/topics/all_users`）

---

## 📊 動作確認チェックリスト

- [ ] Cloudflare Workerがデプロイされている
- [ ] Cloudflare Worker環境変数が設定されている（4つすべて）
- [ ] GAS Script Propertiesが設定されている（2つ）
- [ ] `WEBHOOK_SECRET`がGASとWorkerで一致している
- [ ] GASをデプロイした（`clasp deploy`）
- [ ] GAS版で商品登録 → 通知が届く
- [ ] PWA版で商品登録 → 通知が届く
- [ ] **PWAを閉じた状態**でGAS版から商品登録 → 通知が届く ⭐ **重要**

---

## 🚀 次のステップ

### セキュリティ強化
- Cloudflare WorkerにIP制限を追加（GASのIPのみ許可）
- レート制限の実装（DDoS対策）

### 監視・ロギング
- Cloudflare Worker LogsをSentryやDatadogと連携
- Firestore投稿失敗時のリトライ機構

### SaaS化の準備
- テナントIDの追加
- マルチテナント対応のFirestoreコレクション設計

---

## 📝 変更履歴

| バージョン | 日付 | 変更内容 |
|-----------|------|----------|
| v23 | 2025-11-07 | Webhook方式初回実装 |

---

## ⚠️ 重要事項

1. **Service Accountキーの取り扱い**
   - 絶対にGitにコミットしない
   - 環境変数としてのみ保存
   - 定期的にローテーション

2. **HMAC署名の重要性**
   - 正規のGASからのリクエストのみ受理
   - `WEBHOOK_SECRET`の漏洩に注意

3. **テスト環境の推奨**
   - 本番環境とは別のCloudflare Workerを用意
   - 本番FirebaseプロジェクトとTest環境を分離
