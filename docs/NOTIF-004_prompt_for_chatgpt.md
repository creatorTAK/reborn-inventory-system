# ChatGPT / Gemini への相談プロンプト

## 簡潔版（すぐ相談したい場合）

```
PWAのFCMプッシュ通知で、必ず7回目で通知が止まる問題に困っています。

【症状】
- 1〜6回目: 通知とバッジが正常に届く
- 7回目: 通知もバッジも届かない（再現性100%）
- バッジをクリア（0にリセット）すると、また1〜6回届く
- バッジカウントが4以上にならない（最大3で停止）

【環境】
- PWA (Service Worker: firebase-messaging-sw.js)
- FCM HTTP v1 API
- Android端末2台でテスト

【現在の実装】
Service Worker内で `notificationCache` (Map) を使って重複防止。
タイムスタンプベースで2秒以上前のエントリを自動削除。

```javascript
const notificationCache = new Map();

messaging.onBackgroundMessage((payload) => {
  const messageId = payload.data?.messageId || '';
  const now = Date.now();

  // 古いキャッシュをクリーンアップ
  for (const [key, timestamp] of notificationCache.entries()) {
    if (now - timestamp > 2000) {
      notificationCache.delete(key);
    }
  }

  const cacheKey = messageId || `${title}|${body}|${now}`;

  if (messageId && notificationCache.has(cacheKey)) {
    return; // 重複スキップ
  }

  if (messageId) {
    notificationCache.set(cacheKey, now);
  }

  incrementBadgeCount();
  self.registration.showNotification(title, options);
});
```

【質問】
1. なぜ「ちょうど7回目」で止まるのか？
2. Service Workerのグローバル変数（notificationCache）は再起動後も保持される？
3. Badge APIに4以上の制限があるか？
4. FCMに連続送信の制限があるか？
5. この実装で見落としている問題は？

より詳しい情報は添付のMarkdownファイルを参照してください。
```

---

## 詳細版（じっくり調査したい場合）

```
PWAでFCMプッシュ通知を実装していますが、必ず7回目で通知が止まる問題に直面しています。
添付の「NOTIF-004_7th_notification_failure_analysis.md」に詳細をまとめました。

【特に知りたいこと】
1. Service Workerのライフサイクルとグローバル変数の保持
2. FCMの重複配信・レート制限の仕様
3. Badge APIの制限（特に4以上にならない理由）
4. 「7回目」で止まる根本原因の推測
5. タイムスタンプベースのキャッシュ管理の妥当性

【現状】
- v10 → v11: キャッシュロジック改善 → ❌ 効果なし
- v11 → v12: IndexedDBでバッジ管理 → ❌ 効果なし
- v12 → v13: タイムスタンプベースに変更 → ⏳ テスト待ち

【再現性】
100%（複数回テスト済み）

詳細な技術情報、実装コード、仮説は添付ファイルを参照してください。
根本原因の特定と、確実な解決策を提案していただけると助かります。
```

---

## 🎯 ChatGPT / Gemini への質問リスト

### 1. Service Worker について
- グローバル変数 `const notificationCache = new Map();` は、Service Worker再起動後も保持されるか？
- Service Workerの停止→再起動のタイミングは？
- `setTimeout` がService Workerで不安定な理由は？
- メモリ上のグローバル変数に上限はあるか？

### 2. FCM について
- FCMは同じ `messageId` の通知を複数回送信する可能性があるか？
- FCM HTTP v1 APIのレート制限は？
- 連続送信で何らかの制限に引っかかる可能性は？
- FCM側でのキャッシュ/重複防止の仕組みは？

### 3. Badge API について
- Chrome/Android の Badge API に数値の上限があるか？
- なぜバッジが4以上にならない可能性があるか？
- `setAppBadge()` の制限事項は？

### 4. 「7回目」の謎
- なぜ「ちょうど7回目」なのか？
- Service Worker、FCM、Badge APIのいずれかに「6回まで」「7回目でNG」という仕様があるか？
- ブラウザ/OSレベルでの制限？

### 5. 実装の妥当性
- タイムスタンプベースのキャッシュ管理は正しいアプローチか？
- より良い方法はあるか？
- IndexedDB を使うべきか？
- `notificationCache` を永続化すべきか？

---

## 📋 相談の流れ

### Step 1: 簡潔版でまず相談
ChatGPTに「簡潔版」のプロンプトを送信

### Step 2: 必要に応じて詳細共有
ChatGPTが詳細を求めたら「NOTIF-004_7th_notification_failure_analysis.md」を共有

### Step 3: Gemini にも同じ質問
ChatGPTの回答を得た後、Geminiにも同じ質問をして、異なる視点を得る

### Step 4: 回答を統合
両方のAIからの回答を統合し、最も確実な解決策を選択

### Step 5: 実装・テスト
選択した解決策を実装し、10回連続テストで検証

---

**作成日**: 2025-11-05 16:45
**作成者**: Claude Code (Sonnet 4.5)
