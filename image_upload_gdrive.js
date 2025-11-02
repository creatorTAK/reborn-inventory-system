/**
 * 画像をGoogleドライブにアップロード
 *
 * @file image_upload_gdrive.js
 * @description 商品画像をGoogleドライブにアップロードし、公開URLを生成する
 * @author REBORN Inventory
 * @date 2025-11-02
 */

/**
 * 画像をGoogleドライブにアップロード
 *
 * @param {Object} params - アップロードパラメータ
 * @param {Array} params.images - 画像データ配列（Base64）
 * @param {string} params.productId - 商品ID（例: AA-1001）
 * @returns {Object} アップロード結果
 *
 * @example
 * const result = uploadImagesToGoogleDrive({
 *   images: [
 *     { data: 'data:image/jpeg;base64,...', name: 'メイン.jpg', forAI: false },
 *     { data: 'data:image/jpeg;base64,...', name: 'サブ1.jpg', forAI: false }
 *   ],
 *   productId: 'AA-1001'
 * });
 */
function uploadImagesToGoogleDrive(params) {
  try {
    console.log('📤 [Googleドライブ] アップロード開始:', params.productId);

    // パラメータ検証
    if (!params || !params.images || !Array.isArray(params.images)) {
      throw new Error('NG(IMAGE_UPLOAD_GDRIVE): 画像データが不正です');
    }

    if (params.images.length === 0) {
      console.log('⚠️ [Googleドライブ] 画像がありません');
      return {
        success: true,
        urls: [],
        message: '画像がありません'
      };
    }

    if (params.images.length > 20) {
      throw new Error('NG(IMAGE_UPLOAD_GDRIVE): 画像は最大20枚までです');
    }

    const productId = params.productId || 'unknown';

    // 商品画像フォルダを取得（または作成）
    console.log('📁 [Googleドライブ] フォルダ作成/取得中...');
    const rootFolder = getOrCreateFolder('商品画像');
    const productFolder = getOrCreateFolder(productId, rootFolder);
    console.log(`✅ [Googleドライブ] フォルダ準備完了: 商品画像/${productId}`);

    const uploadedUrls = [];

    // 各画像をアップロード
    params.images.forEach((img, index) => {
      try {
        console.log(`📷 [Googleドライブ] 画像${index + 1}/${params.images.length}をアップロード中...`);

        // Base64データからMIMEタイプとデータ部分を分離
        const dataUrlMatch = img.data.match(/^data:([^;]+);base64,(.+)$/);
        if (!dataUrlMatch) {
          throw new Error(`画像${index + 1}のデータ形式が不正です`);
        }

        const mimeType = dataUrlMatch[1];
        const base64Data = dataUrlMatch[2];

        // Base64デコードしてBlobを作成
        const blob = Utilities.newBlob(
          Utilities.base64Decode(base64Data),
          mimeType
        );

        // ファイル名生成
        const extension = mimeType.split('/')[1] || 'png';
        const timestamp = new Date().getTime();

        // 元のファイル名を使用（指定があれば）
        let baseName = img.name || `image_${index + 1}`;
        // 拡張子を除去
        baseName = baseName.replace(/\.[^.]+$/, '');
        // 安全な文字のみに変換
        baseName = baseName.replace(/[^a-zA-Z0-9_\-ぁ-んァ-ヶー一-龠]/g, '_');

        const fileName = `${timestamp}_${baseName}.${extension}`;
        blob.setName(fileName);

        // Googleドライブにアップロード
        const file = productFolder.createFile(blob);
        console.log(`✅ [Googleドライブ] ファイル作成完了: ${fileName}`);

        // 公開URL生成（共有リンク設定）
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        const fileId = file.getId();

        // 直接画像表示可能なURL形式
        const publicUrl = `https://drive.google.com/uc?export=view&id=${fileId}`;

        console.log(`🔗 [Googleドライブ] 公開URL生成: ${publicUrl}`);

        // URL情報を保存（R2版と同じ形式）
        uploadedUrls.push({
          url: publicUrl,
          fileId: fileId,
          fileName: fileName,
          name: img.name || fileName,
          forAI: img.forAI || false
        });

      } catch (err) {
        console.error(`❌ [Googleドライブ] 画像${index + 1}のアップロードエラー:`, err.message);
        uploadedUrls.push({
          error: err.message,
          index: index + 1,
          forAI: img.forAI || false
        });
      }
    });

    const successCount = uploadedUrls.filter(url => !url.error).length;
    const folderUrl = productFolder.getUrl();

    console.log(`✅ [Googleドライブ] アップロード完了: ${successCount}/${params.images.length}枚`);
    console.log(`📂 [Googleドライブ] フォルダURL: ${folderUrl}`);

    return {
      success: true,
      urls: uploadedUrls,
      totalCount: params.images.length,
      successCount: successCount,
      folderId: productFolder.getId(),
      folderUrl: folderUrl,
      message: `${successCount}/${params.images.length}枚の画像をGoogleドライブにアップロードしました`
    };

  } catch (error) {
    console.error('❌ [Googleドライブ] アップロードエラー:', error.message);
    return {
      success: false,
      error: error.message,
      urls: []
    };
  }
}

/**
 * フォルダを取得または作成
 *
 * @param {string} folderName - フォルダ名
 * @param {GoogleAppsScript.Drive.Folder} parentFolder - 親フォルダ（省略時はルート）
 * @returns {GoogleAppsScript.Drive.Folder} フォルダオブジェクト
 */
function getOrCreateFolder(folderName, parentFolder) {
  const parent = parentFolder || DriveApp.getRootFolder();
  const folders = parent.getFoldersByName(folderName);

  if (folders.hasNext()) {
    // 既存フォルダを返す
    return folders.next();
  } else {
    // 新規フォルダを作成
    console.log(`📁 [Googleドライブ] フォルダ作成: ${folderName}`);
    return parent.createFolder(folderName);
  }
}

/**
 * Googleドライブの容量をチェック
 *
 * @returns {Object} 容量情報
 */
function checkGoogleDriveCapacity() {
  try {
    const quota = Drive.About.get();
    const used = parseInt(quota.storageQuota.usage);
    const limit = parseInt(quota.storageQuota.limit);
    const remaining = limit - used;
    const usedPercentage = Math.round((used / limit) * 100);

    // 100MB未満の場合は警告
    const WARNING_THRESHOLD = 100 * 1024 * 1024; // 100MB

    return {
      used: used,
      limit: limit,
      remaining: remaining,
      usedPercentage: usedPercentage,
      warning: remaining < WARNING_THRESHOLD,
      usedGB: (used / (1024 * 1024 * 1024)).toFixed(2),
      limitGB: (limit / (1024 * 1024 * 1024)).toFixed(2),
      remainingGB: (remaining / (1024 * 1024 * 1024)).toFixed(2)
    };
  } catch (error) {
    console.error('❌ [Googleドライブ] 容量チェックエラー:', error.message);
    return {
      error: error.message
    };
  }
}

/**
 * テスト関数: Googleドライブアップロード
 */
function testGoogleDriveUpload() {
  console.log('🧪 [テスト] Googleドライブアップロード開始');

  // 1x1pxの透明PNG画像（テスト用）
  const testImage = {
    data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    name: 'test.png',
    forAI: false
  };

  const result = uploadImagesToGoogleDrive({
    images: [testImage],
    productId: 'TEST-001'
  });

  console.log('📊 [テスト] 結果:', JSON.stringify(result, null, 2));

  if (result.success) {
    console.log('✅ [テスト] アップロード成功');
    console.log('🔗 [テスト] 画像URL:', result.urls[0].url);
    console.log('📂 [テスト] フォルダURL:', result.folderUrl);
  } else {
    console.log('❌ [テスト] アップロード失敗:', result.error);
  }

  return result;
}

/**
 * テスト関数: Googleドライブ容量チェック
 */
function testGoogleDriveCapacity() {
  console.log('🧪 [テスト] Googleドライブ容量チェック');

  const capacity = checkGoogleDriveCapacity();

  console.log('📊 [容量情報]');
  console.log(`  使用量: ${capacity.usedGB} GB / ${capacity.limitGB} GB (${capacity.usedPercentage}%)`);
  console.log(`  残容量: ${capacity.remainingGB} GB`);

  if (capacity.warning) {
    console.log('⚠️ [警告] 容量が残り100MB未満です');
  } else {
    console.log('✅ [OK] 容量に余裕があります');
  }

  return capacity;
}
