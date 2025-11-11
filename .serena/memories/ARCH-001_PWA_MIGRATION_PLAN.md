# ARCH-001: PWA完全移行プロジェクト

## 🎯 プロジェクト概要

**Issue ID**: ARCH-001  
**開始日**: 2025-11-11  
**目標**: PWA + iframe(GAS)ハイブリッド構成から、PWA完全移行への段階的移行

## 📊 現在の問題

### アーキテクチャ
```
PWA (https://reborn-inventory-system.pages.dev)
  └─ iframe (https://script.google.com/...)
      ├─ chat_ui_firestore.html
      ├─ 在庫管理画面
      ├─ 商品登録画面
      └─ マスタ管理画面
```

### 問題点
1. **パフォーマンス**: 画面遷移に2〜3秒（iframe読み込み待ち）
2. **クロスオリジン制約**: postMessage不可、`history.back()`不可
3. **複雑性**: 戻るボタン等の基本機能が複雑な実装を要求
4. **UX**: もっさり感、ネイティブアプリに劣る操作性

## 🚀 移行後のアーキテクチャ

```
PWA (https://reborn-inventory-system.pages.dev)
  ├─ docs/index.html (メインフレーム)
  ├─ docs/chat.html (チャット画面)
  ├─ docs/inventory.html (在庫管理)
  ├─ docs/product.html (商品登録)
  ├─ docs/master.html (マスタ管理)
  └─ docs/js/
      ├─ api.js (GAS API共通ロジック)
      ├─ chat.js
      ├─ inventory.js
      └─ product.js

GAS (APIサーバー)
  └─ スプレッドシート操作のみ
```

### 期待効果
1. **パフォーマンス**: 画面遷移 0.1〜0.3秒（約10倍速）
2. **制約解消**: クロスオリジン制約完全解消
3. **シンプル化**: `history.back()`等が普通に動作
4. **UX**: ネイティブアプリ並みの操作性

## 📋 段階的実装計画

### フェーズ1: 基盤構築（1日） ← 現在ここ
- [ ] GAS API共通ロジック設計
- [ ] `docs/js/api.js` 作成
- [ ] GAS側にAPIエンドポイント実装
- [ ] 動作確認

### フェーズ2: チャット画面移行（2日）
- [ ] `chat_ui_firestore.html` → `docs/chat.html` 移植
- [ ] Firestore接続PWA側に移植
- [ ] 戻るボタン実装
- [ ] 動作確認

### フェーズ3-5: 他画面移行（3〜6日）
- 在庫管理
- 商品登録
- マスタ管理

### フェーズ6: クリーンアップ（1日）
- 不要なGASファイル削除
- 最適化
- ドキュメント更新

## 🔧 技術的な実装方針

### GAS API設計

**エンドポイント:**
```javascript
// GAS側 (menu.js等)
function doGet(e) {
  const action = e.parameter.action;
  
  switch(action) {
    case 'getInventoryData':
      return ContentService.createTextOutput(
        JSON.stringify(getInventoryData())
      ).setMimeType(ContentService.MimeType.JSON);
    
    case 'saveProduct':
      const productData = JSON.parse(e.parameter.data);
      return ContentService.createTextOutput(
        JSON.stringify(saveProduct(productData))
      ).setMimeType(ContentService.MimeType.JSON);
    
    default:
      // 既存のiframe表示ロジック（後方互換性）
      return HtmlService.createHtmlOutputFromFile('menu');
  }
}
```

**PWA側 (`docs/js/api.js`):**
```javascript
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA/exec';

async function callGasApi(action, params = {}) {
  const url = new URL(GAS_API_URL);
  url.searchParams.append('action', action);
  
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
  }
  
  const response = await fetch(url.toString());
  return await response.json();
}

// 使用例
const inventoryData = await callGasApi('getInventoryData');
const result = await callGasApi('saveProduct', {data: productData});
```

### Firebase設定の共有

PWA側の既存Firebase設定を使用：
```javascript
// docs/index.html内に既にあるFirebase設定
const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  // ...
};

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 移植した画面から使用
const messagesRef = db.collection('chatRooms').doc(roomId).collection('messages');
```

## ⚠️ リスク管理

### リスク1: 既存機能の動作不良
- **対策**: 段階的移行、各フェーズで動作確認
- **検証方法**: 既存機能の全テスト

### リスク2: GAS API認証
- **対策**: 
  - 初期: 「誰でもアクセス可能」設定
  - 後期: 簡易トークン認証実装（必要に応じて）
- **セキュリティ**: 機密データはFirestoreに保存（既存）

### リスク3: スプレッドシート操作の互換性
- **対策**: GAS側の関数は一切変更しない
- **移行方法**: PWA側からfetch()で呼び出すだけ

## 📝 デプロイルール

### GASファイル修正時
```bash
npx @google/clasp push
npx @google/clasp deploy --deploymentId AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA --description "ARCH-001: フェーズX実装"
```

### PWAファイル修正時
```bash
git add docs/
git commit -m "feat(ARCH-001): フェーズX実装"
git push origin main
```

## 🎯 成功基準

1. ✅ 全画面の遷移速度 < 0.5秒
2. ✅ 戻るボタンが全画面で正常動作
3. ✅ クロスオリジン制約による回避策が不要
4. ✅ 既存機能の全てが正常動作
5. ✅ デプロイルールの遵守

---

**最終更新**: 2025-11-11  
**担当**: Claude Code + Serena MCP  
**Issue**: [ARCH-001](docs/issues.md)
