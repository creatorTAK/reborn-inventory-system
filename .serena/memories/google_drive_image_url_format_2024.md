# Google Drive 画像URL形式 - 2024年仕様変更対応

## 重要：Google Driveの仕様変更（2024年）

2024年にGoogleがGoogle Driveの画像URL形式を変更しました。古い形式は動作しなくなっています。

### ❌ 使用不可の旧形式

```javascript
// これらの形式は現在使用できません
const url1 = `http://drive.google.com/uc?id=${fileId}`;
const url2 = `http://drive.google.com/uc?export=view&id=${fileId}`;
const url3 = `https://drive.google.com/file/d/${fileId}/view`;
```

### ✅ 正しい新形式

```javascript
// 2024年以降はこの形式を使用
const publicUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
```

## 実装場所

**image_upload_gdrive.js (Lines 108-110)**:
```javascript
// 新しいGoogle Drive画像URL形式（2024年Googleの仕様変更対応）
// 参考: https://note.com/mir4545/n/n5b29726e8574
const publicUrl = `https://lh3.googleusercontent.com/d/${fileId}`;
```

## 必要な共有設定

新しいURL形式を使用する場合も、ファイルの共有設定は必須です：

```javascript
file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
```

## 利点

1. **シンプル** - プロキシ不要で直接Google CDNから配信
2. **高速** - Google Content Delivery Networkによる最適化
3. **3rd-party Cookie問題なし** - Googleusercontent.comドメインから直接配信
4. **認証不要** - GAS Web Appの認証制限を回避

## トラブルシューティングで試した失敗策

### 1. GAS Web Appプロキシ（失敗）
**試したこと**: menu.jsのdoGet()で画像プロキシを実装
**失敗理由**: 匿名アクセスコンテキストでDriveApp.getFileById()が使用できない
```javascript
// これは匿名アクセスでは動作しない
const file = DriveApp.getFileById(fileId);
return ContentService.createOutput(file.getBlob());
```

### 2. referrerpolicyとcrossorigin属性（効果なし）
**試したこと**: imgタグに属性追加
```html
<img src="..." referrerpolicy="no-referrer" crossorigin="anonymous">
```
**結果**: 3rd-party cookie問題は解決せず

### 3. Base64エンコード（複雑で不要）
**試したこと**: HTMLにbase64埋め込み
**結果**: 新URL形式なら不要

## 参考リンク

- https://note.com/mir4545/n/n5b29726e8574 （日本語解説）

## デプロイ履歴

- @589: 新しいURL形式に対応（2025-11-03）
- 旧バージョン（@570-@588）: プロキシ実装などの試行錯誤

## 注意事項

- **既存の画像データ**: 古いURL形式で保存されている場合、新規登録で上書きするか、一括変換スクリプトが必要
- **フォルダ名**: 統一して "REBORN商品画像" を使用
- **forAIフラグ**: 商品画像には `forAI: false` を設定
