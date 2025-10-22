# 画像管理機能実装完了レポート
**実装日**: 2025-10-21
**ステータス**: ✅ 実装完了・デプロイ済み

---

## 📝 実装概要

セル文字数制限エラー（50,000文字超過）を解決するため、画像保存方法をBase64データURLからGoogle Drive URLに変更しました。

### 問題の原因
```javascript
// ❌ 旧コード（エラーの原因）
d[`画像URL${index + 1}`] = img.data; // Base64データを直接保存
// → 1枚の画像で50,000文字を超えてしまう
```

### 解決策
```javascript
// ✅ 新コード
1. Google Driveに画像をアップロード
2. Drive URLを取得（~100文字程度）
3. JSON形式でスプレッドシートに保存
```

---

## 🎯 実装した機能

### 1. Google Drive画像アップロード機能
**ファイル**: `image_upload.js`（新規作成）

#### 主要関数

##### `uploadImagesToGoogleDrive(params)`
- **機能**: Base64画像データをGoogle Driveにアップロード
- **パラメータ**:
  ```javascript
  {
    images: [
      { data: "data:image/png;base64,...", name: "image1.png", forAI: true },
      { data: "data:image/jpeg;base64,...", name: "image2.jpg", forAI: false }
    ],
    productId: "商品ID（棚番号など）"
  }
  ```
- **戻り値**:
  ```javascript
  {
    success: true,
    urls: [
      {
        url: "https://drive.google.com/file/d/.../view",
        id: "ファイルID",
        name: "image1.png",
        forAI: true,
        uploadedAt: "2025-10-21T12:00:00.000Z"
      },
      // ...
    ],
    folderId: "フォルダID",
    folderUrl: "https://drive.google.com/drive/folders/...",
    totalCount: 2,
    successCount: 2,
    message: "2/2枚の画像をアップロードしました"
  }
  ```

#### フォルダ構造
```
Google Drive
└─ REBORN商品画像/
    ├─ 商品_TEST001_1729498800000/
    │   ├─ image_1_1729498800001.png
    │   ├─ image_2_1729498800002.jpg
    │   └─ image_3_1729498800003.png
    ├─ 商品_TEST002_1729498900000/
    └─ ...
```

#### その他のヘルパー関数
- `getOrCreateImageFolder_()`: ルートフォルダ取得/作成
- `getOrCreateProductFolder_(productId)`: 商品別サブフォルダ作成
- `formatImageUrlsForSheet(urls)`: スプレッドシート保存用JSON変換
- `getAiImageUrls(urls)`: AI生成用画像のみ抽出（最大3件）
- `cleanupOldImageFolders(daysOld)`: 古いフォルダ削除（ストレージ管理用）

---

### 2. UI更新（20枚対応 + AI選択チェックボックス）

#### sp_block_description.html
**変更点**:
1. 画像枚数制限を3枚→20枚に変更
2. AI生成用画像カウント表示を追加
3. グリッドレイアウトを3列→4列に変更

**Before**:
```html
選択した画像（<span id="imageCount">0</span>/3）
<div style="display: grid; grid-template-columns: repeat(3, 1fr);">
```

**After**:
```html
<div style="display: flex; justify-content: space-between;">
  <span>選択した画像（<span id="imageCount">0</span>/20）</span>
  <span>AI生成用: <span id="aiImageCount">0</span>/3</span>
</div>
<div style="display: grid; grid-template-columns: repeat(4, 1fr);">
```

#### sp_scripts.html
**変更内容**:

##### 1) 画像データ構造の拡張
```javascript
// Before
uploadedImages.push({
  name: file.name,
  data: base64Data,
  mimeType: file.type
});

// After
uploadedImages.push({
  name: file.name,
  data: base64Data,
  mimeType: file.type,
  forAI: false  // ← 追加: AI生成用フラグ
});
```

##### 2) 画像枚数制限の変更
```javascript
// Before
if (uploadedImages.length + files.length > 3) {
  alert('画像は最大3枚までアップロードできます');
}

// After
if (uploadedImages.length + files.length > 20) {
  alert('画像は最大20枚までアップロードできます');
}
```

##### 3) チェックボックス付きプレビュー表示
```javascript
function displayImagePreviews() {
  // AI生成用画像数をカウント
  const aiImageCount = uploadedImages.filter(img => img.forAI).length;
  aiCount.textContent = aiImageCount;

  uploadedImages.forEach((image, index) => {
    previewItem.innerHTML = `
      <img src="${image.data}" ...>

      <!-- ✅ 新規追加: AIチェックボックス -->
      <label style="position: absolute; top: 4px; left: 4px; ...">
        <input
          type="checkbox"
          ${image.forAI ? 'checked' : ''}
          onchange="toggleAiImage(${index}, this.checked)"
        />
        <span>AI</span>
      </label>

      <button onclick="removeImage(${index})">×</button>
    `;
  });
}
```

##### 4) AI選択切り替え処理（最大3枚制限）
```javascript
function toggleAiImage(index, checked) {
  if (checked) {
    const currentAiCount = uploadedImages.filter(img => img.forAI).length;
    if (currentAiCount >= 3) {
      alert('AI生成用画像は最大3枚までです');
      displayImagePreviews(); // チェックを元に戻す
      return;
    }
  }

  uploadedImages[index].forAI = checked;
  displayImagePreviews();
  debug.log(`画像${index + 1}のAI生成フラグを${checked ? 'ON' : 'OFF'}にしました`);
}
```

##### 5) collect()関数の修正
```javascript
// Before: Base64データを直接保存（エラーの原因）
if (uploadedImages && uploadedImages.length > 0) {
  uploadedImages.forEach((img, index) => {
    if (index < 3) {
      d[`画像URL${index + 1}`] = img.data; // ❌ 50,000文字超過エラー
    }
  });
}

// After: コメントのみ（実際のアップロードはonSave()で処理）
// === 画像はGoogle Driveにアップロード後にJSON形式で保存 ===
// 画像アップロードはonSave()関数で処理します
// ここでは何もしません（Base64データをスプレッドシートに保存するとエラーになるため）
```

##### 6) onSave()関数の大幅変更
```javascript
function onSave() {
  updateNamePreview();
  updateDesc();
  const d = collect();
  const ng = frontValidate(d);
  if (ng) return show(ng);

  // ✅ 画像がある場合は先にGoogle Driveにアップロード
  if (uploadedImages && uploadedImages.length > 0) {
    show('画像をアップロード中…');

    const productId = d['棚番号'] || 'unknown_' + new Date().getTime();

    const imagesToUpload = uploadedImages.map(img => ({
      data: img.data,
      name: img.name,
      forAI: img.forAI
    }));

    // Google Driveにアップロード
    google.script.run
      .withSuccessHandler(function(uploadResult) {
        if (uploadResult.success) {
          debug.log(`画像アップロード成功: ${uploadResult.successCount}/${uploadResult.totalCount}枚`);

          // ✅ JSON形式でURLを保存
          const imageUrlsJson = JSON.stringify(uploadResult.urls);
          d['JSON_データ'] = imageUrlsJson;

          // スプレッドシートに保存
          show('データを保存中…');
          saveProductToSheet(d);
        } else {
          show(`NG(IMAGE_UPLOAD): ${uploadResult.error}`);
        }
      })
      .withFailureHandler(function(error) {
        show(`NG(IMAGE_UPLOAD): ${error.message}`);
      })
      .uploadImagesToGoogleDrive({
        images: imagesToUpload,
        productId: productId
      });
  } else {
    // 画像がない場合は直接保存
    show('送信中…');
    saveProductToSheet(d);
  }
}

// ✅ 新規追加: スプレッドシート保存用のヘルパー関数
function saveProductToSheet(d) {
  google.script.run
    .withSuccessHandler(function(result) {
      show(result);
      // ... 成功後の処理（画像クリアなど）
    })
    .withFailureHandler(function(error) {
      show(`NG(UNKNOWN): ${error.message}`);
    })
    .saveProduct(d);
}
```

---

## 📊 データ保存形式

### スプレッドシートの`JSON_データ`列に保存される内容
```json
[
  {
    "url": "https://drive.google.com/file/d/1a2b3c4d5e6f7g8h9i0j/view",
    "id": "1a2b3c4d5e6f7g8h9i0j",
    "name": "image_1_1729498800001.png",
    "forAI": true,
    "uploadedAt": "2025-10-21T12:00:00.000Z"
  },
  {
    "url": "https://drive.google.com/file/d/2b3c4d5e6f7g8h9i0j1k/view",
    "id": "2b3c4d5e6f7g8h9i0j1k",
    "name": "image_2_1729498800002.jpg",
    "forAI": false,
    "uploadedAt": "2025-10-21T12:00:05.000Z"
  }
]
```

### データ活用例
```javascript
// スプレッドシートから読み込み
const jsonData = row['JSON_データ'];
const imageUrls = JSON.parse(jsonData);

// AI生成用画像のみ抽出
const aiImages = imageUrls.filter(img => img.forAI);
console.log(`AI生成用画像: ${aiImages.length}枚`);

// メルカリShopsへ出品時は全画像を使用
const allImageUrls = imageUrls.map(img => img.url);
mercariShopsAPI.createListing({
  title: '商品名',
  images: allImageUrls  // 最大20枚
});
```

---

## 🧪 テスト方法

### 1. Apps Scriptエディタでデプロイ
1. [Google Apps Script](https://script.google.com)を開く
2. プロジェクト「REBORN在庫管理」を選択
3. 「デプロイ」→「デプロイを管理」
4. 最新バージョンを確認
5. 「新しいデプロイ」を作成（必要に応じて）

### 2. 動作確認手順

#### ステップ1: 画像アップロード（1-3枚）
1. 商品登録画面を開く
2. 「商品の説明」セクション → 「AI生成」ブロック
3. 「画像を選択」ボタンをクリック
4. 1-3枚の画像を選択
5. プレビューが表示されることを確認
   - カウント: `選択した画像（3/20）`
   - 各画像に「AI」チェックボックスが表示される
   - 削除ボタン（×）が表示される

#### ステップ2: AI生成用画像の選択
1. 画像プレビューの「AI」チェックボックスをクリック
2. 最大3枚までチェック可能
3. 4枚目をチェックしようとすると警告が表示される
   - `AI生成用画像は最大3枚までです`
4. AI生成用カウントが更新される
   - `AI生成用: 3/3`

#### ステップ3: 画像の削除
1. 任意の画像の×ボタンをクリック
2. 画像が削除される
3. カウントが更新される

#### ステップ4: 20枚画像のテスト
1. 「画像を選択」で20枚の画像を選択
2. プレビューが4列グリッドで表示される
3. カウント: `選択した画像（20/20）`
4. 21枚目を追加しようとすると警告
   - `画像は最大20枚までアップロードできます`

#### ステップ5: 保存テスト
1. 商品情報を入力（棚番号は必須）
2. 画像を数枚アップロード
3. 「保存」ボタンをクリック
4. 進捗メッセージを確認:
   - `画像をアップロード中…`
   - `データを保存中…`
   - `OK: 保存しました`
5. スプレッドシートを確認:
   - `JSON_データ`列にJSON形式でURLが保存される
   - Base64データは保存されていない
6. Google Driveを確認:
   - `REBORN商品画像`フォルダが作成される
   - 商品ごとのサブフォルダが作成される
   - 画像ファイルがアップロードされている

#### ステップ6: エラーハンドリング確認
1. **ネットワークエラー**: Wi-Fiを切断して保存 → エラーメッセージ表示
2. **大きすぎる画像**: 10MB超の画像を選択 → 警告表示
3. **画像以外のファイル**: PDFなどを選択 → 警告表示

---

## 📈 期待される効果

### 1. エラー解消
- ✅ セル文字数制限エラー（50,000文字）が発生しなくなる
- ✅ 大量の画像を扱えるようになる（最大20枚）

### 2. パフォーマンス向上
- ✅ スプレッドシートのサイズが大幅に削減
- ✅ 読み込み速度が向上
- ✅ Google Driveで画像を一元管理

### 3. 機能拡張
- ✅ メルカリShopsの20枚画像に対応
- ✅ AI生成用画像を柔軟に選択可能
- ✅ チーム間での画像共有が容易

### 4. 将来への布石
- ✅ Phase 3（SaaS化）の準備完了
- ✅ Phase 4（Agent SDK）でのAI画像認識に対応
- ✅ 複数プラットフォーム出品の基盤完成

---

## 🔧 トラブルシューティング

### Q1: 画像がアップロードされない
**原因**:
- Google Driveの容量不足
- 権限エラー

**対処法**:
1. Google Driveの容量を確認
2. Apps Scriptの権限を再承認
3. `cleanupOldImageFolders(90)`を実行して古いフォルダを削除

### Q2: JSON_データ列に何も保存されない
**原因**:
- 画像を選択していない
- アップロードに失敗している

**対処法**:
1. ブラウザのコンソールログを確認
2. Apps Scriptのログを確認（`表示` → `ログ`）
3. エラーメッセージを確認

### Q3: AI生成用チェックボックスが表示されない
**原因**:
- ブラウザキャッシュが古い
- デプロイが反映されていない

**対処法**:
1. ブラウザのキャッシュをクリア（Cmd+Shift+R）
2. Apps Scriptエディタで最新デプロイを確認
3. サイドバーを再読み込み

### Q4: 画像URLにアクセスできない
**原因**:
- Drive共有設定が正しくない

**対処法**:
1. Google Driveでファイルを確認
2. 共有設定: 「リンクを知っている全員が閲覧可能」
3. `image_upload.js`の`setSharing()`部分を確認

---

## 📝 次のステップ

### Phase 1（現在）完了タスク
- ✅ Google Drive画像アップロード機能
- ✅ 20枚画像対応
- ✅ AI生成用画像選択
- ✅ JSON形式でのURL保存

### 次の優先タスク
1. **在庫管理機能の実装** - 画像ギャラリー表示
2. **Photoroom API統合** - 画像背景一括処理
3. **実運用での検証** - バグ修正・UI改善

### Phase 2以降の拡張
- メルカリShops API連携時に画像URLを活用
- BASE API連携時に画像URLを活用
- Agent SDKでのAI画像認識（画像URLから自動分析）

---

## 📚 関連ドキュメント

- [REBORN_COMPLETE_ROADMAP.md](/Users/yasuhirotakushi/Desktop/reborn-project/REBORN_COMPLETE_ROADMAP.md) - 全体ロードマップ
- [SPREADSHEET_COLUMN_SETUP.md](/Users/yasuhirotakushi/Desktop/reborn-project/SPREADSHEET_COLUMN_SETUP.md) - 列定義
- [CLAUDE_AGENT_SDK_PLAN.md](/Users/yasuhirotakushi/Desktop/reborn-project/CLAUDE_AGENT_SDK_PLAN.md) - Agent SDK計画

---

**実装者**: Claude Code
**レビュー**: 保留（実運用テスト後）
**承認**: 保留（テスト完了後）
