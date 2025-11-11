# ARCH-001: PWA完全移行プロジェクト（更新版）

## 🎯 プロジェクト概要

**Issue ID**: ARCH-001  
**開始日**: 2025-11-11  
**最終更新**: 2025-11-11（方針変更: Firestore移行優先）  
**目標**: PWA + iframe(GAS)ハイブリッド構成から、PWA完全移行 + Firestore活用への段階的移行

## 📊 パフォーマンス調査結果（2025-11-11）

### GAS Web App性能測定
```
test API (単純応答):           2.36秒
getUserListForUI (スプレッドシート読み取り): 3.80秒

内訳推定:
- GAS起動コスト:      約2.4秒（避けられない）
- スプレッドシート読み取り: 約1.4秒
```

### 最適化の試み
- Logger.log() 50箇所削除 → 効果なし
- コード最適化 → 効果なし
- 個別getRange()削減 → 逆効果

### 根本原因（ChatGPT検証済み）
**GAS Web App固有の起動オーバーヘッド（2〜2.5秒）が支配的**
- コードレベルの最適化では改善不可
- Google Apps Script実行環境の制約
- 文献と一致する正常値

### 結論
→ **Firestore移行による根本的解決が必要**

## 🚀 新しい移行計画（Firestore優先）

### アーキテクチャ変更

**現在:**
```
PWA → iframe(GAS) → Spreadsheet (3.8秒)
```

**移行後:**
```
PWA → Firestore (0.05〜0.3秒) ← ユーザー情報等
PWA → GAS → Spreadsheet ← 商品マスタ等（必要時のみ）
```

### 期待効果
```
現状: 3.8秒
移行後: 0.05〜0.3秒（10〜70倍高速化）
```

### 費用
```
小〜中規模（〜50人）: $0/月（無料枠内）
大規模（100-200人）: $0〜$2/月
超大規模（500人+）: $0〜$5/月

→ ユーザー承認済み（費用面で問題なし）
```

## 📋 更新後の実装計画

### ✅ Phase 1: 基盤構築（完了）
- [x] GAS API共通ロジック設計
- [x] `docs/js/api.js` 作成
- [x] テストページ作成
- [x] 動作確認
- [x] GAS最適化の試行と限界確認

### 🔄 Phase 1.5: Firestore移行（NEW - 優先実施）

#### データ構造設計
```javascript
// Firestore Collection: users
{
  userName: "山田太郎",
  email: "yamada@example.com",
  permission: "スタッフ",
  status: "アクティブ",
  registeredAt: Timestamp,
  userIconUrl: "https://...",
  fcmTokens: {
    "token1": { lastUpdated: Timestamp, device: "iPhone" },
    "token2": { lastUpdated: Timestamp, device: "iPad" }
  }
}
```

#### 実装ステップ
1. **GASマイグレーションスクリプト作成**
   - スプレッドシート → Firestore データ移行
   - 既存FCM通知登録シートから読み取り
   - Firestoreへ書き込み

2. **PWA側Firestore読み取り実装**
   - `docs/js/firestore-api.js` 作成
   - `getUserList()` 関数実装
   - キャッシング付き

3. **双方向同期（オプション）**
   - Firestore → スプレッドシート同期
   - 既存システムとの互換性維持

4. **テストと検証**
   - パフォーマンス測定
   - データ整合性確認

#### 移行対象データ
**優先度1（即座に移行）:**
- ✅ ユーザー一覧（FCM通知登録）
- ✅ FCMトークン情報

**優先度2（様子見）:**
- 商品マスタ（大量データ、スプレッドシートのまま）
- 在庫履歴（大量データ）
- 販売記録（レポート用途）

**移行しない:**
- チャット関連（既にFirestore）
- 梱包資材（既にFirestore想定）

### Phase 2: チャット画面移行（2日）
- [ ] `chat_ui_firestore.html` → `docs/chat.html` 移植
- [ ] Firestore接続PWA側に移植
- [ ] 戻るボタン実装
- [ ] 動作確認

### Phase 3-5: 他画面移行（3〜6日）
- 在庫管理
- 商品登録
- マスタ管理

### Phase 6: 最適化とクリーンアップ（1日）
- Service Workerキャッシング実装
- 不要なGASファイル削除
- パフォーマンス最終調整
- ドキュメント更新

## 🔧 技術的な実装方針

### Firestore API設計

**PWA側 (`docs/js/firestore-api.js`):**
```javascript
// Firebaseは既存のindex.htmlで初期化済み
const db = firebase.firestore();

/**
 * ユーザー一覧取得（Firestoreから）
 * @returns {Promise<Array>} ユーザー一覧
 */
async function getUserListFromFirestore() {
  try {
    const snapshot = await db.collection('users')
      .where('status', '==', 'アクティブ')
      .get();
    
    const users = [];
    snapshot.forEach(doc => {
      users.push({
        id: doc.id,
        ...doc.data(),
        registeredAt: doc.data().registeredAt?.toDate().toISOString()
      });
    });
    
    return users;
  } catch (error) {
    console.error('Firestore getUserList error:', error);
    return [];
  }
}

/**
 * キャッシング付きユーザー一覧取得
 */
let userListCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分

async function getUserList(forceRefresh = false) {
  const now = Date.now();
  
  if (!forceRefresh && userListCache && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('[getUserList] キャッシュから返却');
    return userListCache;
  }
  
  console.log('[getUserList] Firestoreから取得');
  const startTime = performance.now();
  
  userListCache = await getUserListFromFirestore();
  cacheTimestamp = now;
  
  const endTime = performance.now();
  console.log(`[getUserList] 実行時間: ${(endTime - startTime).toFixed(2)}ms`);
  
  return userListCache;
}
```

### マイグレーションスクリプト（GAS）

**`migration_users_to_firestore.js`:**
```javascript
function migrateUsersToFirestore() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('FCM通知登録');
  
  if (!sheet) {
    Logger.log('ERROR: FCM通知登録シートが見つかりません');
    return;
  }
  
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const userNameCol = headers.indexOf('ユーザー名');
  const emailCol = headers.indexOf('メールアドレス');
  const permissionCol = headers.indexOf('権限');
  const statusCol = headers.indexOf('ステータス');
  const registeredAtCol = headers.indexOf('登録日時');
  const iconCol = 8;
  
  const firestoreUrl = 'https://firestore.googleapis.com/v1/projects/YOUR_PROJECT_ID/databases/(default)/documents/users';
  
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 1; i < data.length; i++) {
    const userName = data[i][userNameCol];
    if (!userName) continue;
    
    const userData = {
      fields: {
        userName: { stringValue: userName },
        email: { stringValue: String(data[i][emailCol] || '') },
        permission: { stringValue: String(data[i][permissionCol] || 'スタッフ') },
        status: { stringValue: String(data[i][statusCol] || 'アクティブ') },
        registeredAt: { timestampValue: new Date(data[i][registeredAtCol]).toISOString() },
        userIconUrl: { stringValue: String(data[i][iconCol] || '') }
      }
    };
    
    try {
      const options = {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify(userData),
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
        }
      };
      
      UrlFetchApp.fetch(firestoreUrl + '?documentId=' + encodeURIComponent(userName), options);
      successCount++;
      Logger.log(`✅ 移行成功: ${userName}`);
    } catch (error) {
      errorCount++;
      Logger.log(`❌ 移行失敗: ${userName} - ${error}`);
    }
  }
  
  Logger.log(`\n=== 移行完了 ===`);
  Logger.log(`成功: ${successCount}件`);
  Logger.log(`失敗: ${errorCount}件`);
}
```

## ⚠️ リスク管理

### リスク1: データ移行の失敗
- **対策**: バックアップ必須、段階的移行
- **検証方法**: 移行後にデータ整合性確認スクリプト実行

### リスク2: Firestore接続エラー
- **対策**: GAS APIへのフォールバック実装
- **フェイルセーフ**: エラー時は既存の仕組みを使用

### リスク3: キャッシュの陳腐化
- **対策**: 
  - 適切なキャッシュ期間設定（5分）
  - 手動更新ボタン実装
  - バックグラウンド自動更新

## 🎯 成功基準

### パフォーマンス
- [x] API呼び出し時間測定（完了: 3.8秒）
- [ ] Firestore読み取り時間 < 0.3秒
- [ ] キャッシュヒット時 < 0.05秒

### 機能
- [ ] ユーザー一覧がFirestoreから正常に取得できる
- [ ] データ整合性が保たれている
- [ ] 既存機能への影響なし

### 品質
- [ ] エラーハンドリングが適切
- [ ] ログ出力が適切
- [ ] デプロイルール遵守

## 📝 デプロイルール

### GASファイル修正時
```bash
npx @google/clasp push
npx @google/clasp deploy --deploymentId AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA --description "ARCH-001: Firestore移行 Phase X"
```

### PWAファイル修正時
```bash
git add docs/
git commit -m "feat(ARCH-001): Firestore移行 Phase X"
git push origin main
```

---

**最終更新**: 2025-11-11（方針変更: Firestore移行優先）  
**担当**: Claude Code + Serena MCP  
**Issue**: [ARCH-001](docs/issues.md)  
**根拠**: ChatGPT検証により、GAS最適化の限界を確認、Firestore移行が最適解と判断