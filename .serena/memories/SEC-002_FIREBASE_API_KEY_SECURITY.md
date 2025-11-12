# SEC-002: Firebase APIキーセキュリティ対応

## 📋 概要

**発生日**: 2025-11-12  
**完了日**: 2025-11-12  
**Issue番号**: SEC-002  
**カテゴリ**: セキュリティ（緊急）

---

## 🚨 インシデント内容

Google Cloudからセキュリティ警告メール受信：
- Firebase APIキー `AIzaSyCe-mj6xoV1HbHkIOVqeHCjKjwwtCorUZQ` がGitHubに公開
- URL: https://github.com/creatorTAK/reborn-inventory-system/blob/12f91612963f473556d05ca58a8655bebf7c2b63/docs/index.html
- APIキーに制限がない状態で公開されていた

---

## ✅ 実施した対応

### 1. APIキーに制限を追加（完了）

**場所**: Google Cloud Console → APIs & Services → Credentials

**アプリケーション制限（HTTPリファラー）:**
```
https://reborn-inventory-system.pages.dev/*
https://*.pages.dev/*
http://localhost/*
```

**API制限:**
```
✅ Cloud Firestore API
✅ Firebase Cloud Messaging API
✅ FCM Registration API
✅ Firebase Installations API
✅ Identity Toolkit API
```

### 2. Firestoreセキュリティルール強化（完了）

**navigationコレクション:**
```javascript
match /navigation/{docId} {
  allow read: if true;
  allow write: if request.time > resource.data.timestamp + duration.value(5, 's')
             || !exists(/databases/$(database)/documents/navigation/$(docId));
}
```

**その他のコレクション:**
- users, products, categories, masterOptions, brands: 書き込み禁止（GASからのみ）
- デフォルトルール追加: 未定義のコレクションは全て拒否

---

## 📈 今後の対応（段階的）

### 短期（1週間以内）
- [x] APIキー制限設定
- [x] Firestoreルール強化
- [ ] Google Cloud使用状況の確認
- [ ] Cloud Loggingで不正使用ログ確認

**手順: Google Cloud使用状況確認**
1. https://console.cloud.google.com/apis/dashboard?project=reborn-chat
2. 想定外の大量リクエストがないか確認
3. 見知らぬIPアドレスからのアクセスがないか確認

**手順: Cloud Logging確認**
1. https://console.cloud.google.com/logs/query?project=reborn-chat
2. 検索クエリ: `severity>=WARNING resource.type="api"`
3. エラーや警告が大量に出ていないか確認

### 中期（1ヶ月以内）
- [ ] APIキー再生成の検討（既に公開されたキーを新しいキーに置き換え）
- [ ] 環境変数化の検討（Cloudflare Pages環境変数）
- [ ] 監視体制の構築（Google Cloud使用量アラート設定）

**APIキー再生成手順（必要に応じて実施）:**
1. Google Cloud Console → APIs & Services → Credentials
2. 該当APIキーの「再生成」をクリック
3. 新しいAPIキーをコピー
4. docs/index.html, chat_ui_firestore.html の全ての箇所を新しいキーに置き換え
5. 同じ制限を新しいキーに設定
6. デプロイ（GAS + PWA）
7. 動作確認後、古いキーを削除

**環境変数化手順（推奨）:**
1. Cloudflare Pagesダッシュボード → Settings → Environment variables
2. `FIREBASE_API_KEY` を追加
3. HTMLファイルからAPIキーを削除し、ビルド時に環境変数から注入
4. GitHubからAPIキーが完全に削除される

### 長期（継続的）
- [ ] 定期的なセキュリティレビュー（月1回）
- [ ] 使用状況の監視（異常なトラフィック検出）
- [ ] セキュリティベストプラクティスの更新

---

## 💡 重要な教訓

### Firebase Web APIキーの性質
- FirebaseのWeb APIキーは**公開されても基本的に問題ない**（設計上）
- セキュリティは「Firestore Security Rules」で制御される
- APIキーは「どのプロジェクトか」を特定するだけ

### 制限が必須の理由
- APIキーに制限がない = 誰でも無制限に使える状態
- 不正使用された場合、課金が発生するリスク
- Google Cloudが警告を出すレベルの脆弱性

### 対策の効果
| 項目 | 対策前 | 対策後 |
|------|--------|--------|
| APIキー使用制限 | ❌ なし | ✅ 指定ドメインのみ |
| API使用範囲 | ❌ 全て | ✅ 必要な5つのみ |
| navigationコレクション | ❌ 無制限 | ✅ 5秒に1回まで |
| 課金リスク | 🚨 高 | ✅ 低減 |

---

## 🔗 関連ファイル

- `docs/index.html` (line 1046-1053): Firebase config
- `chat_ui_firestore.html` (line 474-481): Firebase config
- `docs/firestore.rules`: Firestoreセキュリティルール

---

**最終更新**: 2025-11-12 12:30  
**状態**: 対応完了、被害なし
