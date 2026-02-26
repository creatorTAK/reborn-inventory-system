# SPA移行 総合監査レポート

**日時**: 2026-02-26
**対象**: 全21フラグメント + index.html SPA統合

---

## サマリー

| 深刻度 | 件数 | 説明 |
|--------|------|------|
| P0 CRITICAL | 20件 | 機能が完全に壊れている / データ不整合 |
| P1 IMPORTANT | 18件 | 機能劣化・エッジケースバグ |
| P2 MINOR | 多数 | 軽微な差異（省略） |

---

## P0 CRITICAL（必ず修正）

### 1. config.html: localStorage保存先の不一致
- **旧**: 各設定を個別キー(`rebornConfig_conditionButtons`, `rebornConfig_salesword`等)に保存
- **新**: 全設定を単一`config`キーに保存
- **影響**: product.htmlが`rebornConfig_*`キーを読むため、**設定が全て無視される**

### 2. config.html: Firestore保存先の不一致
- **旧**: `settings/common`に保存
- **新**: `configs/{userId}`に保存
- **影響**: GASバックエンドや他ページが`settings/common`を読むため、**設定同期が完全に壊れる**

### 3. config.html: セールスワードのデータ構造が完全に異なる
- **旧**: `{ よく使う: [...], 表示形式: {...}, デフォルト: {...} }`
- **新**: `{ items: [...], separator: '/', bracket: 'none' }`
- **影響**: product.htmlが旧フォーマットを期待→**セールスワード機能が全壊**

### 4. config.html: 管理番号配置設定の欠落
- `showInTitle`, `showInDescription`, `titleFormat`, `descFormat`等が収集されない
- `managementNumberPlacement`がlocalStorageに保存されない
- **影響**: 管理番号がタイトル・説明文に表示されない

### 5. config.html: 仕入・出品デフォルト値が保存されない
- `collectProcureListingDefaults()`が存在しない
- **影響**: 仕入先・出品先・日付のデフォルト設定が永続化されない

### 6. config.html: loadBasicSettings / saveBasicSettings 欠落
- ユーザー名・通知設定・権限バッジの読み込み/保存機能が丸ごと欠落
- **影響**: ユーザー設定パネルが機能しない

### 7. config.html: 発送情報・口座情報モーダルの読み込み欠落
- `loadShippingInfo()` / `loadBankAccountInfo()`が存在しない
- 保存関数はあるが読み込み関数がない
- **影響**: モーダルを開いても常に空（既存データが表示されない）

### 8. config.html: タスク完了処理の欠落
- `completeSettingTask()`が存在しない
- **影響**: 発送情報・口座情報を登録してもタスクが完了にならない

### 9. config.html: アイコンアップロードのfileハンドラ欠落
- ファイル選択→リサイズ→プレビュー→Base64化の処理が全て欠落
- **影響**: ユーザーアイコンの変更が不可能

### 10. config.html: 権限UIの簡略化
- 旧: サブタブ単位のFirestore権限制御（アコーディオン＋一括トグル）
- 新: 3つのタブのハードコード非表示のみ
- **影響**: 細かい権限設定が全て無視される

### 11. todo_list.html: sendReminder()欠落
- 管理者がユーザーにタスクリマインダーを送信する機能が完全に欠落
- **影響**: タスク管理モーダルからリマインダー送信不可

### 12. chat_ui_firestore.html: cuiClearViewingStatus()未定義
- `destroyChatUiPage()`が`cuiClearViewingStatus()`を呼ぶが関数が存在しない
- 正しくは`clearViewingStatus()`
- **影響**: チャット退出時にエラー、閲覧ステータスがクリアされない

### 13. chat_ui_firestore.html: 検索クエリ引き継ぎが壊れている
- `cuiSearchQueryParam`が常に空文字
- 旧ではlocalStorageから`current_chat_search_query`を読んでいた
- **影響**: チャット一覧から検索→チャットルーム開く際に検索結果が引き継がれない

### 14. purchase.html: sendDispatchNotification()がスタブ
- 旧: Firestoreにreceiving_taskを作成 + batchステータスを`shipped`に更新
- 新: `alert()`を表示するだけ（Firestore書き込みなし）
- **影響**: 発送通知ワークフローが完全に壊れている

### 15. purchase.html: 仕入入力の下書き保存機能が欠落
- `saveEntryDraft()`, `loadEntryDraft()`, `restoreEntryDraft()`, `showDraftRestoreDialog()`が全て欠落
- **影響**: 画面遷移すると入力中の仕入データが全て失われる

### 16. purchase.html: 初期データロードが未実行
- 旧: `initializePage()`が`loadPurchaseData()`を呼ぶ
- 新: `initPurchasePage()`がデータロードを呼ばない
- **影響**: ページ表示時にリストが空

### 17. compensation.html: getProductTaskCounts()欠落
- スタッフの商品登録タスク数をカウントする機能が欠落
- **影響**: 報酬集計タブのタスク数が表示されない

### 18. compensation.html: 月次トレンドテーブル欠落
- `monthlyTrendBody`要素とデータ表示ロジックが丸ごと欠落
- **影響**: 月別報酬推移が見られない

### 19. index.html: チャットUIのイベントリスナーが蓄積
- `cuiInitialize()`がeventListenerを`_cuiAddEventListener()`経由で登録しない
- SPA再訪問時にDOMが再利用されるため、リスナーが重複追加される
- **影響**: Enterキーで複数メッセージ送信、スクロールハンドラの性能低下

### 20. index.html: ブラウザ戻るボタンが機能しない
- `history.pushState()`も`popstate`リスナーもない
- **影響**: Android PWAで戻るボタンを押すとアプリが終了する

---

## P1 IMPORTANT（早期修正推奨）

### config.html関連
1. **serverTimestamp欠落**: 12箇所でFirestore書き込み時のタイムスタンプが欠落
2. **クリア/リセット関数8個が欠落**: clearAllSaleswordSettings, clearConditionButtons, clearAllHashtags, clearAllDiscounts, clearShippingDefaults, clearProcureDefaults, clearListingDefaults, clearManagementNumberSettings
3. **BroadcastChannel欠落**: 設定変更のクロスタブ通知がwindow.postMessageのみ
4. **AI設定イベントリスナー欠落**: プレビューのリアルタイム更新なし
5. **sendApprovalEmail()欠落**: 承認時のメール通知なし
6. **deleteUser()欠落**: ユーザー削除不可
7. **changeUserPermission()欠落**: モーダルからの権限変更不可
8. **SW更新チェック欠落**: checkServiceWorkerVersion/forceUpdateServiceWorker

### chat関連
9. **イベントリスナーのトラッキング未使用**: document/windowリスナーがリーク
10. **chat_rooms_list CSS欠落**: .form-select, .no-results, .search-button等
11. **絵文字カテゴリ減少**: 16→13カテゴリ（4カテゴリ欠落）

### purchase関連
12. **PurchaseApi グローバルオブジェクト未作成**: 他ページからのAPI呼び出しが失敗
13. **draft保存タイマー変数のみ存在**: 実装なし

### help.html
14. **AIチャット全画面時にボトムナビ非表示にしない**: 重なって表示される

### feedback.html
15. **uploadBytesResumableの代わりにuploadBytes使用**: プログレス表示なし

### index.html統合
16. **localStorage権限キーの不一致**: `reborn_user_permission_id` vs `reborn_user_permission`
17. **初回ページロードがiframe→SPA二重ロード**: 初回はiframeで`menu_home.html`を読み、後でSPAフラグメントも読む
18. **権限チェックがUI（ドロワー）レベルのみ**: フラグメント自体にはアクセス制御なし

---

## 修正方針の提案

### Phase 1: データ破壊の防止（最優先）
config.htmlの保存先問題(#1,#2)を修正 → 設定が正しく保存・読み込みされるようにする

### Phase 2: ワークフロー修復
- purchase.htmlの発送通知(#14) + 下書き保存(#15) + 初期ロード(#16)
- config.htmlの発送・口座情報読み込み(#7) + タスク完了(#8)
- compensation.htmlのタスクカウント(#17)
- todo_list.htmlのリマインダー(#11)

### Phase 3: チャット修復
- cuiClearViewingStatus修正(#12)
- 検索クエリ引き継ぎ修正(#13)
- イベントリスナー蓄積修正(#19)

### Phase 4: UX改善
- ブラウザ戻るボタン対応(#20)
- config.htmlの不足関数復元（基本設定、アイコン、クリア関数等）
- help.htmlのボトムナビ制御

---

## 影響の小さいページ（移行品質が良好）

以下のページは旧版との差異が軽微で、大きな問題なし：
- **menu_home.html** - 良好（権限キャッシュ改善あり）
- **todo_history.html** - 良好（クリーンアップ改善あり）
- **mypage.html** - 非常に良好（最も完全な移行）
- **plans.html** - 完璧（問題なし）
- **master-management.html** - 良好
- **product.html** - 良好（Firebase Messagingは親に委譲）
- **inventory.html** - 良好
- **inventory_history.html** - 良好
- **stocktaking.html** - 良好
- **accounting.html** - 良好
- **sales.html** - 良好（ベルボタン維持）
