# ARCH-001: Firestore移行 実行手順書

## 📋 作成済みファイル

### PWA側
- ✅ `docs/js/firestore-api.js` - Firestore API（ユーザー情報読み取り）

### GAS側
- ✅ `migration_users_to_firestore.js` - マイグレーションスクリプト

## 🚀 実行手順（次のセッション）

### ステップ1: GASデプロイ（clasp push）

```bash
cd /Users/yasuhirotakushi/Desktop/reborn-project
npx @google/clasp push
```

**確認事項:**
- `migration_users_to_firestore.js` がプッシュされること

### ステップ2: マイグレーションスクリプト実行

**GASエディタで実行:**
1. Apps Scriptエディタを開く
2. `migration_users_to_firestore.js` を開く
3. 関数選択: `migrateUsersToFirestore`
4. 実行ボタンをクリック
5. **初回実行時**: Firestore APIの権限承認が必要
   - 承認画面が出たら許可する
   - スコープ: `https://www.googleapis.com/auth/datastore`

**ログ確認:**
```
===== ユーザーデータ移行開始 =====
✅ シート読み取り成功: XX行
✅ 重複除去後のユーザー数: XX
✅ 移行成功: 山田太郎
✅ 移行成功: 佐藤花子
...
===== 移行完了 =====
✅ 成功: XX件
❌ 失敗: 0件
```

**トラブルシューティング:**
- エラーが出た場合、ログを確認して対処
- 権限エラーの場合、Firestore APIを有効化する必要あり

### ステップ3: Firestore確認

**方法A: GAS関数で確認**
```javascript
// GASエディタで実行
listFirestoreUsers()
```

**方法B: Firebase Consoleで確認**
1. https://console.firebase.google.com/
2. プロジェクト: `reborn-chat` を選択
3. Firestore Database を開く
4. `users` コレクションを確認
5. ドキュメント数がマイグレーション件数と一致するか確認

### ステップ4: PWAデプロイ

```bash
cd /Users/yasuhirotakushi/Desktop/reborn-project
git add docs/js/firestore-api.js
git commit -m "feat(ARCH-001): Firestore API実装 - ユーザー情報高速化"
git push origin main
```

**デプロイ完了待ち:** 1-2分

### ステップ5: テスト実行

**テストページ:**
```
https://reborn-inventory-system.pages.dev/test-api.html
```

**ブラウザコンソールで手動テスト:**
```javascript
// firestore-api.jsを読み込み
const script = document.createElement('script');
script.src = '/js/firestore-api.js';
script.type = 'module';
document.head.appendChild(script);

// 読み込み完了後（数秒待つ）
const startTime = performance.now();
const users = await window.FirestoreApi.getUserList();
const endTime = performance.now();

console.log('取得件数:', users.length);
console.log('実行時間:', (endTime - startTime).toFixed(2) + 'ms');
console.log('ユーザー一覧:', users);
```

**期待結果:**
```
取得件数: XX
実行時間: 50-300ms  ← 3800msから劇的改善！
ユーザー一覧: [{ userName: '山田太郎', ... }, ...]
```

### ステップ6: キャッシュテスト

```javascript
// 1回目（Firestoreから取得）
const startTime1 = performance.now();
const users1 = await window.FirestoreApi.getUserList();
const endTime1 = performance.now();
console.log('1回目:', (endTime1 - startTime1).toFixed(2) + 'ms');

// 2回目（キャッシュから取得）
const startTime2 = performance.now();
const users2 = await window.FirestoreApi.getUserList();
const endTime2 = performance.now();
console.log('2回目:', (endTime2 - startTime2).toFixed(2) + 'ms');
```

**期待結果:**
```
1回目: 200ms
2回目: 0.5ms  ← キャッシュ効果！
```

## ✅ 成功基準

### パフォーマンス
- [  ] Firestore読み取り < 300ms
- [  ] キャッシュヒット < 5ms
- [  ] GAS API（3800ms）より10倍以上速い

### 機能
- [  ] 全ユーザーがFirestoreに移行されている
- [  ] データの整合性が保たれている
- [  ] エラーが発生しない

### 品質
- [  ] ログが適切に出力されている
- [  ] エラーハンドリングが動作する
- [  ] GAS APIフォールバックが機能する

## 🔄 次のフェーズ

Firestoreテスト成功後：
1. Service Workerキャッシング実装
2. 既存画面でFirestore APIを使用するよう変更
3. Phase 2: チャット画面のPWA移行

## 📝 注意事項

### データ同期
- 現時点では **一方向のみ**（Firestore読み取りのみ）
- ユーザー追加/更新は既存の仕組み（GAS → スプレッドシート）を使用
- 定期的にマイグレーションスクリプトを再実行してFirestoreを更新

### 双方向同期（将来的な拡張）
- ユーザー登録時にFirestoreにも書き込むよう変更
- スプレッドシートとFirestoreの両方を更新
- または、Firestoreをマスターにしてスプレッドシートを廃止

---

**最終更新**: 2025-11-11  
**担当**: Claude Code + Serena MCP  
**Issue**: ARCH-001