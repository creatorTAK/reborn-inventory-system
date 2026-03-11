# PWA プッシュ通知・バッジ アーキテクチャ

> **このドキュメントの目的**: 開発を通じて得た「公式ドキュメントには書いていない」実装知見をまとめる。
> 通知・バッジ関連コードを変更する前に必ず読むこと。

## 全体構成図

```
┌─────────────────────────────────────────────────────┐
│  Cloud Functions (functions/index.js)                │
│  ・onChatMessageCreated → sendChatNotifications()   │
│  ・FCM Admin SDK sendEachForMulticast()              │
└──────────────────────┬──────────────────────────────┘
                       │ FCM経由でWeb Push配信
                       ▼
┌─────────────────────────────────────────────────────┐
│  Service Worker (firebase-messaging-sw.js)           │
│  ・push イベントハンドラ                              │
│  ・IndexedDB でバッジカウント管理（4つのDB）           │
│  ・navigator.setAppBadge() でホームアイコンバッジ     │
└──────────────────────┬──────────────────────────────┘
                       │ postMessage で双方向通信
                       ▼
┌─────────────────────────────────────────────────────┐
│  メインページ (index.html)                           │
│  ・Firestore onSnapshot で未読カウント監視            │
│  ・updateAppBadge() → SW に同期                      │
│  ・visibilitychange で背景移行時にSWへ同期            │
└─────────────────────────────────────────────────────┘
```

## 1. FCMトークンのライフサイクル

### トークン生成の正しい方法

```javascript
// ✅ 正しい: VAPID_PUBLIC_KEY定数 + serviceWorkerRegistration
const token = await getToken(messaging, {
  vapidKey: VAPID_PUBLIC_KEY,
  serviceWorkerRegistration: swReg
});

// ❌ 間違い: VAPIDキーをハードコード（過去に不一致で全デバイスの通知が壊れた）
// ❌ 間違い: serviceWorkerRegistration を省略（トークンがプッシュ購読と紐づかない）
```

### トークンの保存先（2箇所）

| 保存先 | 用途 | 更新タイミング |
|---|---|---|
| `activeDevices/{email}.fcmTokens` | Cloud Functionsが通知送信時に参照 | 通知許可時、アプリ起動時 |
| `users/{email}/devices/{docId}` | デバイス管理・古いデバイス削除 | 通知許可時、アプリ起動時 |

### 過去に起きた致命的バグ

| バグ | 原因 | 影響 | 教訓 |
|---|---|---|---|
| 全デバイスで通知停止 | `refreshDeviceRegistration()`で間違ったVAPIDキーをハードコード | 全ユーザーのトークンが無効化 | VAPIDキーは`VAPID_PUBLIC_KEY`定数のみ使用 |
| アプリ起動のたびにトークン無効化 | `deleteToken()`を毎回呼んでいた | 起動するたびに前のトークンが破壊される | `deleteToken()`はアプリ起動フローで絶対に呼ばない |
| 古いトークンが蓄積→重複送信 | `arrayUnion(token)`で追加のみ、削除なし | 1メッセージで複数プッシュが飛ぶ | `fcmTokens: [token]` で常に上書き |
| 二重通知 | SWに`firebase.messaging()`を初期化 | FCM SDKの自動表示 + pushハンドラの手動表示 | SWにFirebase Messaging SDKを入れない |

## 2. Service Worker の設計原則

### なぜ Firebase Messaging SDK を SW に入れないのか

FCMメッセージに `notification` フィールドがある場合:
- **SDK入り**: SDKが自動で通知表示 → カスタムpushハンドラも表示 → **二重通知**
- **SDKなし**: pushハンドラのみが表示 → **1回だけ** ✅

トークン登録はメインページ側の `getToken()` で完結する。SWにSDKは不要。

### push イベントの処理順序（重要）

```
1. ペイロード解析
2. 重複チェック (roomId_messageId, 10秒TTL) ← これより前にバッジ処理しない！
3. 閲覧中チェック (isAnyClientViewingChat)
4. バッジ更新 (incrementBadge → updateCombinedAppBadge → setAppBadge)
5. 古い通知クリーンアップ (5件超で全削除)
6. 通知表示 (showNotification)
7. Pending Navigation 保存 (iOS用)
```

### バッジ管理: 4つのIndexedDB

| DB名 | 対象 | インクリメント元 |
|---|---|---|
| `RebornBadgeDB` | チャット未読 | SW pushハンドラ (type !== 'system') |
| `SystemNotificationDB` | タスク未読 | SW pushハンドラ (type === 'system') |
| `PackagingBadgeDB` | 資材不足 | メインページから同期 |
| `EcBadgeDB` | EC未発送 | メインページから同期 |

`updateCombinedAppBadge()` が4つのDBを合計して `navigator.setAppBadge(total)` を呼ぶ。

## 3. iOS PWA 固有の制約と対策

### 3.1 ホームアイコンバッジが消える問題

**原因**: iOS PWAではメインページから呼んだ `navigator.setAppBadge()` がバックグラウンド移行時に保持されない。

**対策**: `visibilitychange: hidden` でSWにバッジカウントを同期し、**SW側から** `setAppBadge()` を呼ぶ。

```
アプリ表示中: メインページが setAppBadge(N)
    ↓ ユーザーがホームに戻る
visibilitychange → hidden
    ↓ メインページが syncServiceWorkerBadgeCount(chat, todo, pkg, ec) を送信
SW が SYNC_BADGE_COUNT を受信
    ↓ IndexedDB を更新 + setAppBadge(total)
    → SW 経由なのでバッジが保持される ✅
```

### 3.2 notificationclick が発火しない問題

**原因**: iOS PWAでは通知タップ時に `notificationclick` イベントが発火しないことがある。

**対策**: pushイベントの段階で遷移先を IndexedDB (`PendingNavigationDB`) に保存。アプリ復帰時にチェックして遷移。

```
push到着 → SW が PendingNavigationDB に {page: 'chat', roomId} を保存
    ↓
通知タップ → アプリ復帰
    ↓
visibilitychange: visible → checkPendingNavigation()
    ↓ IndexedDBに保存された遷移先に自動ナビゲート
```

### 3.3 Service Worker の更新

iOS PWAではSWの更新に**アプリの複数回再起動**が必要な場合がある。
`install` イベントで `self.skipWaiting()` を呼んでいるが、iOS では即座に反映されないことがある。

## 4. Cloud Functions の通知送信フロー

### チャットメッセージの通知

```
onChatMessageCreated (Firestoreトリガー)
    ↓
1. メッセージ解析 (system/callタイプはスキップ)
2. ルーム情報取得 (members, mutedBy, hiddenBy)
3. 送信者を除外
4. ブロックユーザーを除外
5. 閲覧中ユーザーを除外 (getViewingUsers)
6. メンション/通常を分離
    ↓
sendChatNotifications() ← 通常メッセージ
sendMentionNotifications() ← メンション（ミュート無視）
updateChatUnreadCounts() ← Firestore未読カウント更新
    ↓
sendEachForMulticast() → FCM → Web Push → SW push event
```

### トークン取得の優先順位

```
1. activeDevices/{email}.fcmTokens (高速パス)
2. users/{email}/devices サブコレクション (フォールバック)
```

`activeDevices` は常に最新の1トークンのみ保持（`arrayUnion` 禁止、直接 `[token]` セット）。

## 5. メインページとSWの同期メカニズム

### 双方向通信

| 方向 | メッセージ | 目的 |
|---|---|---|
| ページ→SW | `VIEWING_ROOM` | チャット閲覧中を通知（バッジ二重カウント防止） |
| ページ→SW | `CLEAR_BADGE` | 全バッジクリア |
| ページ→SW | `SYNC_BADGE_COUNT` | 正確なカウントをSWに同期 |
| ページ→SW | `SKIP_WAITING` | SW即時更新 |
| SW→ページ | `navigateFromNotification` | 通知タップ時のページ遷移指示 |

### 二重カウント防止の仕組み

チャット未読が**SWのpushハンドラ**と**メインページのonSnapshot**の両方でカウントされる問題:

- **アプリが閉じている場合**: SW pushハンドラがバッジを更新
- **アプリが開いている場合**: `isAnyClientViewingChat()` がtrueを返し、SWはバッジをスキップ → メインページのonSnapshotが正しいカウントを設定

## 6. テスト手順

通知・バッジ関連の変更後、以下を全て確認:

### 基本動作
- [ ] アプリ閉じた状態でチャット受信 → 通知1つ + バッジ1つ
- [ ] アプリ開いた状態でチャット受信 → 通知1つ + バッジ増えない（onSnapshotで更新）
- [ ] タスク通知受信 → 通知1つ + バッジ1つ

### iOS PWA固有
- [ ] 未読ありでホームに戻る → ホームアイコンにバッジ表示
- [ ] 通知タップ → 正しいページに遷移
- [ ] アプリ再起動後 → バッジが正しい値を表示

### エッジケース
- [ ] 連続で複数メッセージ → バッジが正しくインクリメント（二重にならない）
- [ ] ミュートしたルーム → 通知来ない
- [ ] メンション → ミュートでも通知来る

## 7. 関連ファイル一覧

| ファイル | 役割 |
|---|---|
| `docs/firebase-messaging-sw.js` | Service Worker（push処理、バッジ管理） |
| `docs/index.html` | メインページ（FCMセットアップ、バッジ同期、Firestoreリスナー） |
| `functions/index.js` | Cloud Functions（通知送信、未読カウント更新） |
| `docs/fragments/chat_ui_firestore.html` | チャットUI（閲覧中通知をSWに送信） |

## 更新履歴

| 日付 | バージョン | 内容 |
|---|---|---|
| 2026-03-11 | v0312a | FCMトークン破壊バグ修正（VAPIDキー不一致 + deleteToken廃止） |
| 2026-03-11 | v0312b | 二重通知修正（SWからFirebase SDK削除） |
| 2026-03-11 | v0312c | 古いトークン蓄積防止（arrayUnion→直接セット） |
| 2026-03-11 | v0312d | iOS PWAホームアイコンバッジ保持（visibilitychange:hidden同期） |
