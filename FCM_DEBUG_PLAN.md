# FCM通知問題 - 完全解決計画

**作成日**: 2025年10月15日夜
**目的**: iPhoneのPWAからFCM通知が届かない問題を明日必ず解決する

---

## 📊 現状の完全整理

### ✅ 動作している部分

1. **エディタから直接実行 → 通知が届く**
   - `sendFCMNotification()` を Apps Script エディタで実行
   - iPhoneに「テスト通知です」というメッセージ付きで届く
   - **結論**: GAS → FCM → iPhone の経路は完全に動作

2. **PWAからのAPIリクエストは成功**
   - Safari Web Inspectorで確認済み
   - HTTP 200 OK
   - レスポンスJSON: `{"status":"success","message":"通知を送信しました（成功: 2件、失敗: 0件）"}`

3. **Apps Scriptの実行ログに記録あり**
   - バージョン109のdoGetが「完了」ステータス
   - **結論**: PWA → GAS の経路は動作している

4. **FCMトークンは正しく登録されている**
   - スプレッドシート「FCM通知登録」に2件保存
   - トークン形式も正しい

### ❌ 問題

**PWAアプリから「③ サーバーから通知を送信」をタップしても、iPhoneに通知が届かない**

### 🔍 重要な手がかり

**過去のテストで「2個同時に通知が来た」ことがある：**
- エディタから実行した分: 「テスト通知です」というメッセージ付き ✅
- アプリから実行した分: **メッセージなし（空の通知）** ⚠️

→ **これが最大のヒント**: アプリからの通知も実は送信されていたが、メッセージが空だった可能性

---

## 🎯 明日の行動計画（優先順位順）

### ステップ1: 固定値テスト（最優先・30分）

**目的**: パラメータの問題か否かを100%確定する

**手順**:
1. Apps Scriptエディタで「デプロイ」→「デプロイを管理」
2. ✏️ 鉛筆アイコン → 「新バージョン」→ 説明: `debug: 固定値テスト`
3. 「デプロイ」をクリック → バージョン111になる
4. iPhoneでREBORNアプリを開く
5. 「③ サーバーから通知を送信」をタップ
6. **すぐにホーム画面に戻る**（1秒以内）
7. 5秒待つ

**期待される結果**:

✅ **「🔧 固定タイトル」という通知が届いた場合**:
→ **原因確定**: パラメータの取得・デコーディングに問題がある
→ 次のステップ2へ

❌ **固定値でも通知が届かない場合**:
→ パラメータ以外の問題（Service Worker、iOS設定、FCMトークン等）
→ 次のステップ3へ

---

### ステップ2: パラメータデバッグ（固定値で届いた場合）

**目的**: どのパラメータがおかしいのか特定

**手順**:
1. スプレッドシートを開く
2. 「デバッグログ」シートが自動作成されているか確認
3. 最新行を確認：
   - タイムスタンプ
   - 受信パラメータ（生データ）
   - デコード後title
   - デコード後body
   - 送信結果

**スクリーンショット撮影箇所**:
- デバッグログシートの全体
- 最新行の詳細

**もしシートがない場合**:
→ 他のAIに質問（後述の質問文を使用）

---

### ステップ3: Service Worker確認（固定値でも届かない場合）

**目的**: PWAのService Workerが正しく動作しているか確認

**手順**:
1. iPhoneでSafariを開く
2. `https://yasuhirotakushi.github.io/reborn-inventory-system/` にアクセス
3. 開発者ツール（Macと接続）で確認
4. 「Application」タブ → 「Service Workers」
5. `firebase-messaging-sw.js` が登録されているか確認

**スクリーンショット撮影箇所**:
- Service Workers一覧
- ステータス（active/waiting/installing）

**問題がある場合の対処**:
- Service Workerを削除
- PWAをホーム画面から削除
- 再インストール

---

### ステップ4: FCMトークンの検証

**目的**: 登録されているトークンが本当に現在のデバイスのものか確認

**手順**:
1. スプレッドシートの「FCM通知登録」シートを全削除
2. iPhoneでREBORNアプリを削除（ホーム画面から）
3. Safariで https://yasuhirotakushi.github.io/reborn-inventory-system/ を開く
4. 「ホーム画面に追加」で再インストール
5. アプリを開く
6. 「① 通知の許可をリクエスト」→「許可」
7. 「② FCMに登録」をタップ
8. スプレッドシートで新しいトークンが保存されたか確認
9. 「③ サーバーから通知を送信」をタップ
10. すぐにホーム画面に戻る

---

### ステップ5: iPhoneの通知設定確認

**目的**: iOS側で通知がブロックされていないか確認

**手順**:
1. iPhoneの「設定」アプリを開く
2. 「通知」をタップ
3. 下にスクロールして「Safari」を探す
4. 通知が「許可」になっているか確認
5. 「ロック画面」「通知センター」「バナー」がすべてONか確認

**スクリーンショット撮影箇所**:
- Safari通知設定の画面

---

## 💬 他のAIへの質問文（コピペ用）

### Gemini用質問文

```
iPhone PWAでFCM（Firebase Cloud Messaging）通知が届かない問題について質問です。

【システム構成】
- フロントエンド: GitHub Pages（PWA）
- バックエンド: Google Apps Script（Web App）
- 通知: Firebase Cloud Messaging HTTP v1 API
- デバイス: iPhone（PWAをホーム画面に追加してスタンドアロンモードで起動）

【動作している部分】
1. Apps Scriptエディタから直接sendFCMNotification()を実行 → iPhoneに通知が届く
2. PWAからGASへのAPIリクエストは成功（HTTP 200 OK）
3. GASの実行ログにも記録されている
4. FCMへの送信も成功（success: 2件）

【問題】
PWAアプリから通知送信ボタンをタップしても、iPhoneに通知が届きません。

【重要な手がかり】
過去のテストで「エディタから実行した通知」と「PWAから実行した通知」が2個同時に届いたことがあります。その時、エディタからの通知には「テスト通知です」というメッセージが入っていましたが、PWAからの通知はメッセージが空でした。

【質問】
1. なぜPWAから送信した通知だけメッセージが空になる（または届かない）のでしょうか？
2. GASでURLパラメータを取得する際の注意点はありますか？
3. iPhoneのPWAでフォアグラウンド/バックグラウンドの通知表示に制約はありますか？
4. Service Workerの設定で見落としがちなポイントはありますか？

具体的な解決策を教えてください。
```

---

### ChatGPT用質問文

```
iPhone PWA + Google Apps Script + FCMで通知が届かない問題です。

【問題の詳細】
- GASのエディタから直接実行: 通知が届く ✅
- PWAのボタンから実行: 通知が届かない ❌
- しかし、PWA→GAS→FCMのすべての通信は成功している（ログで確認済み）

【過去の観察】
一度だけ、PWAから送信した通知が届いたことがありますが、その時はメッセージが空でした。

【GASのコード（sendFCM部分）】
```javascript
const title = decodeURIComponent(e.parameter.title || 'REBORN');
const body = decodeURIComponent(e.parameter.body || 'テスト通知です');
const result = sendFCMNotification(title, body);
```

【PWAのコード（fetch部分）】
```javascript
const title = encodeURIComponent('🎉 REBORN サーバー通知（FCM）');
const body = encodeURIComponent('商品が売れました！\n管理番号: AA-1002');
const response = await fetch(GAS_API_URL + '?action=sendFCM&title=' + title + '&body=' + body);
```

【質問】
1. URLパラメータのエンコード/デコードで問題が起きる原因は？
2. GASの`e.parameter`で日本語が正しく取得できない場合の対処法は？
3. iPhoneのPWAで通知が表示されない既知の問題はありますか？

解決策を教えてください。
```

---

### Stack Overflow用質問文（英語）

```markdown
# FCM notifications not appearing on iPhone PWA, but API calls succeed

## Setup
- Frontend: GitHub Pages (PWA)
- Backend: Google Apps Script (Web App)
- Notifications: Firebase Cloud Messaging HTTP v1 API
- Device: iPhone (PWA installed to home screen, running in standalone mode)

## Problem
When I tap the "Send Notification" button in the PWA app, the notification does not appear on iPhone. However, when I manually run `sendFCMNotification()` from the Apps Script editor, the notification arrives successfully.

## What's Working
1. ✅ Apps Script editor execution → Notification appears on iPhone
2. ✅ PWA → GAS API request succeeds (HTTP 200 OK)
3. ✅ GAS execution logged successfully
4. ✅ FCM API responds with success (2 successful sends)

## Important Clue
Once in the past, I received TWO notifications simultaneously:
- One from the editor: Had the message "Test notification"
- One from the PWA: **Message was empty** (blank notification)

This suggests the PWA notification IS being sent, but the message payload is empty or not being delivered.

## GAS Code (doGet handler)
```javascript
if (action === 'sendFCM') {
  const title = decodeURIComponent(e.parameter.title || 'REBORN');
  const body = decodeURIComponent(e.parameter.body || 'Test notification');
  const result = sendFCMNotification(title, body);
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
```

## PWA Code (fetch call)
```javascript
const title = encodeURIComponent('🎉 REBORN Server Notification');
const body = encodeURIComponent('Item sold!\nID: AA-1002');
const response = await fetch(GAS_API_URL + '?action=sendFCM&title=' + title + '&body=' + body);
```

## Questions
1. Why would the notification message be empty when sent from PWA but not from the editor?
2. Are there known issues with URL parameter encoding/decoding in GAS for Japanese characters?
3. Are there iOS PWA-specific restrictions on notification display (foreground/background)?
4. What Service Worker configurations might prevent notifications from appearing?

Any help would be greatly appreciated!
```

---

## 🔍 考えられる原因の完全リスト

### 1. パラメータエンコーディング問題（可能性: 高）
- **症状**: メッセージが空の通知が届いた
- **原因**: `encodeURIComponent`と`decodeURIComponent`の不一致
- **検証方法**: ステップ1（固定値テスト）
- **解決策**: デバッグログで確認後、エンコード方式を変更

### 2. GASのdoGet関数のパラメータ取得問題（可能性: 高）
- **症状**: `e.parameter.title`が空になる
- **原因**: 日本語や絵文字の処理問題
- **検証方法**: ステップ2（デバッグログ確認）
- **解決策**: POSTメソッドに変更、またはBase64エンコード

### 3. iPhoneのPWAフォアグラウンド制約（可能性: 中）
- **症状**: アプリが画面に表示されている間は通知が出ない
- **原因**: iOS仕様
- **検証方法**: 通知送信後、即座にホーム画面に戻る
- **解決策**: UIで「ホーム画面に戻ってください」と指示表示

### 4. Service Worker未登録（可能性: 中）
- **症状**: バックグラウンド通知が機能しない
- **原因**: `firebase-messaging-sw.js`が正しく登録されていない
- **検証方法**: ステップ3（Service Worker確認）
- **解決策**: Service Worker再登録

### 5. FCMトークンの不一致（可能性: 低）
- **症状**: 古いトークンに送信している
- **原因**: デバイス変更、アプリ再インストール
- **検証方法**: ステップ4（トークン再取得）
- **解決策**: トークンをクリアして再登録

### 6. iOS通知設定でブロック（可能性: 低）
- **症状**: すべての通知が届かない
- **原因**: iPhoneの設定で通知がオフ
- **検証方法**: ステップ5（通知設定確認）
- **解決策**: 設定でSafariの通知を許可

### 7. FCM APIのペイロード問題（可能性: 低）
- **症状**: 空のメッセージを送信している
- **原因**: `notification`オブジェクトが正しく構築されていない
- **検証方法**: web_push.jsのコード確認
- **解決策**: ペイロード構造を修正

### 8. CORS/Same-Origin Policy問題（可能性: 極低）
- **症状**: APIリクエストがブロックされる
- **原因**: ブラウザのセキュリティ制約
- **検証方法**: すでに200 OKなので可能性低い
- **解決策**: 不要（既に成功している）

---

## 📝 デバッグログの見方

スプレッドシート「デバッグログ」シートが作成されたら、以下を確認：

| 列 | 内容 | 期待値 | 問題がある場合 |
|----|------|--------|--------------|
| タイムスタンプ | 実行日時 | 2025/10/16 10:00:00 | - |
| アクション | sendFCM | sendFCM | - |
| 受信パラメータ | `{"title":"...","body":"..."}` | 日本語が含まれているか | `{"title":"","body":""}` → エンコード問題 |
| デコード後title | 🎉 REBORN サーバー通知（FCM） | 日本語・絵文字が正しく表示 | 空欄、文字化け → デコード問題 |
| デコード後body | 商品が売れました！... | 改行・日本語が正しく表示 | 空欄、文字化け → デコード問題 |
| 送信結果 | `{"status":"success",...}` | success | error → FCM送信問題 |

---

## 🚀 最終手段（上記すべてが失敗した場合）

### オプションA: POSTメソッドに変更

**理由**: GETメソッドのURLパラメータには文字数制限やエンコード問題がある

**手順**:
1. PWAのコードをPOSTメソッドに変更
2. GASのdoPost関数を実装
3. JSONボディでパラメータを送信

### オプションB: 専門家に依頼

**外注先候補**:
1. Lancers / CrowdWorks（日本のフリーランスプラットフォーム）
2. Upwork（海外、Firebase専門家多数）
3. Firebase公式サポート（有料）

**依頼内容テンプレート**:
```
【依頼内容】
iPhone PWAでFCM通知が届かない問題のデバッグと修正

【報酬】
10,000円〜30,000円（解決までの時間による）

【環境】
- Google Apps Script
- Firebase Cloud Messaging HTTP v1 API
- GitHub Pages（PWA）
- iPhone

【現状】
- GASからの直接実行では通知が届く
- PWAからのAPI呼び出しは成功しているが通知が届かない

【納品物】
- 原因の特定レポート
- 修正したコード
- 動作確認（実際に通知が届くまで）

【期限】
2日以内
```

### オプションC: 代替アプローチ（通知以外の方法）

**案1**: SMS通知に変更
- Twilio API使用
- 確実に届く
- コスト: 1通あたり約10円

**案2**: LINE通知に変更
- LINE Messaging API使用
- 多くのユーザーが使い慣れている
- 無料枠あり

**案3**: メール通知に変更
- GASから直接メール送信
- 最もシンプル
- 無料

---

## ⏰ 明日の時間配分（推奨）

| 時間 | タスク | 所要時間 |
|------|--------|----------|
| 09:00-09:30 | ステップ1: 固定値テスト | 30分 |
| 09:30-10:00 | ステップ2: デバッグログ確認 | 30分 |
| 10:00-10:30 | 結果をGeminiに相談 | 30分 |
| 10:30-11:30 | 修正実装 | 60分 |
| 11:30-12:00 | 最終テスト | 30分 |
| **合計** | | **3時間** |

もし12:00までに解決しない場合は、外注を検討する。

---

## 📞 困った時の連絡先

### Firebase公式
- ドキュメント: https://firebase.google.com/docs/cloud-messaging
- サポート: https://firebase.google.com/support

### Stack Overflow
- タグ: `firebase-cloud-messaging`, `google-apps-script`, `pwa`, `ios`
- 検索: https://stackoverflow.com/questions/tagged/firebase-cloud-messaging+ios

### GitHub Issues（類似問題）
- Firebase JS SDK: https://github.com/firebase/firebase-js-sdk/issues
- 検索ワード: "iOS PWA notification not showing"

---

## ✅ 明日のチェックリスト

朝一番で確認：

- [ ] バージョン111がデプロイ済みか確認
- [ ] iPhoneの充電を確認（80%以上）
- [ ] Macとの接続を確認（Web Inspector用）
- [ ] スプレッドシートを開いておく
- [ ] このドキュメントを印刷 or 別画面で表示
- [ ] Gemini、ChatGPTのタブを開いておく
- [ ] タイマーをセット（各ステップ30分）

---

**このドキュメントを保存して、明日の作業に活用してください。**

**必ず解決できます。頑張りましょう！** 💪
