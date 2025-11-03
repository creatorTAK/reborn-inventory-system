# 画像ストレージプロバイダー切り替え機能

## 概要

商品画像の保存先を、Cloudflare R2とGoogle Driveの間で切り替え可能にする機能。

## 実装日

2025-10-31～2025-11-03（段階的実装）

## サポートされるストレージ

### 1. Cloudflare R2
- 高速CDN配信
- 無制限のスケール
- エグレス料金なし
- 設定必要項目：
  - Access Key ID
  - Secret Access Key
  - Bucket Name
  - Public URL

### 2. Google Drive
- Google Apps Script統合
- 追加コストなし
- フォルダ階層管理
- 共有設定が必要
- **重要**: 2024年仕様変更により新URL形式を使用

## 実装ファイル

### config.js
プロバイダー設定の保存・取得

```javascript
const IMAGE_STORAGE_PROVIDER = PropertiesService.getScriptProperties()
  .getProperty('IMAGE_STORAGE_PROVIDER') || 'gdrive';
```

### sp_scripts.html
商品登録時のアップロード処理分岐

```javascript
if (IMAGE_STORAGE_PROVIDER === 'gdrive') {
  google.script.run
    .withSuccessHandler(onUploadSuccess)
    .withFailureHandler(onUploadFailure)
    .uploadImagesToGoogleDrive(uploadParams);
} else {
  google.script.run
    .withSuccessHandler(onUploadSuccess)
    .withFailureHandler(onUploadFailure)
    .uploadImagesToR2(uploadParams);
}
```

### image_upload_gdrive.js
Google Driveへのアップロード実装

```javascript
function uploadImagesToGoogleDrive(params) {
  // フォルダ構造: REBORN商品画像/[管理番号]/画像ファイル
  const rootFolder = getOrCreateFolder('REBORN商品画像');
  const productFolder = getOrCreateFolder(params.managementNumber, rootFolder);
  
  // ファイル作成
  const file = productFolder.createFile(blob);
  
  // 共有設定
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  
  // 新URL形式を使用
  const fileId = file.getId();
  const publicUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
  
  return {
    success: true,
    urls: [{
      url: publicUrl,
      fileId: fileId,
      fileName: fileName,
      forAI: img.forAI || false
    }]
  };
}
```

### image_upload_r2.js
Cloudflare R2へのアップロード実装

```javascript
function uploadImagesToR2(params) {
  const r2Config = {
    accessKeyId: PropertiesService.getScriptProperties().getProperty('R2_ACCESS_KEY_ID'),
    secretAccessKey: PropertiesService.getScriptProperties().getProperty('R2_SECRET_ACCESS_KEY'),
    bucketName: PropertiesService.getScriptProperties().getProperty('R2_BUCKET_NAME'),
    publicUrl: PropertiesService.getScriptProperties().getProperty('R2_PUBLIC_URL')
  };
  
  // S3互換APIでアップロード
  // ...
  
  return {
    success: true,
    urls: [{
      url: publicUrl,
      fileName: fileName,
      forAI: img.forAI || false
    }]
  };
}
```

## URL形式の違い

### Google Drive (新形式)
```
https://lh3.googleusercontent.com/d/{fileId}
```

### Cloudflare R2
```
https://{publicUrl}/{managementNumber}/{filename}
```

## 設定UI

**sidebar_config.html** の「基本設定」セクション:

```html
<div class="form-group">
  <label for="image-storage-provider">画像ストレージプロバイダー</label>
  <select class="form-control" id="image-storage-provider">
    <option value="gdrive">Google Drive</option>
    <option value="r2">Cloudflare R2</option>
  </select>
</div>
```

## 切り替え時の注意事項

### Google Drive → R2 移行時
1. 既存の画像は自動移行されない
2. 新規登録からR2に保存される
3. 既存商品の画像URLは変更されない（Google Driveのまま）
4. 必要に応じて手動で画像を再アップロード

### R2 → Google Drive 移行時
1. 既存のR2画像は残る
2. 新規登録からGoogle Driveに保存される
3. 既存商品の画像URLは変更されない（R2のまま）
4. R2の設定（API Key等）は保持される

## JSON_データ列の形式

どちらのプロバイダーでも同じ形式で保存：

```json
[
  {
    "url": "https://...",
    "fileId": "...",  // Google Driveの場合のみ
    "fileName": "image1.jpg",
    "forAI": false
  },
  {
    "url": "https://...",
    "fileName": "ai_image.jpg",
    "forAI": true
  }
]
```

## forAIフラグ

- `forAI: false` - 商品画像（在庫管理画面に表示）
- `forAI: true` - AI分析用画像（表示には使わない）

商品画像には必ず `forAI: false` を設定すること。

## パフォーマンス比較

### Google Drive
- ✅ 追加コストなし
- ✅ GAS統合が簡単
- ⚠️ CDN速度はR2より遅い可能性
- ⚠️ 2024年仕様変更に注意

### Cloudflare R2
- ✅ 高速CDN配信
- ✅ 無制限スケール
- ✅ エグレス料金なし
- ⚠️ 外部API設定が必要
- ⚠️ わずかなストレージコスト

## 推奨設定

- **小規模運用・コスト重視**: Google Drive
- **高トラフィック・速度重視**: Cloudflare R2

## トラブルシューティング

### Google Drive画像が表示されない
1. 共有設定を確認（ANYONE_WITH_LINK）
2. 新URL形式を使用しているか確認
3. fileIdが正しく保存されているか確認

### R2画像が表示されない
1. R2のCORS設定を確認
2. Public URLが正しいか確認
3. バケット名が正しいか確認

## デプロイ履歴

- @589: Google Drive新URL形式対応（2025-11-03）
- @570: uploadFunction method chaining修正
- それ以前: R2実装、切り替え機能実装

## 関連メモリ

- `google_drive_image_url_format_2024`: Google Driveの新URL形式詳細
