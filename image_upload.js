/**
 * image_upload.js
 * Google Driveへの画像アップロード機能
 *
 * Phase 1: 基本的な画像保存機能
 * - 最大20枚の画像をGoogle Driveに保存
 * - JSON形式でURLを管理
 * - AI生成用画像の選択対応
 */

/**
 * 画像保存用のフォルダを取得または作成
 * @returns {Folder} Google Driveフォルダ
 */
function getOrCreateImageFolder_() {
  const folderName = 'REBORN商品画像';
  const folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  }

  // フォルダが存在しない場合は作成
  return DriveApp.createFolder(folderName);
}

/**
 * 商品ごとのサブフォルダを取得または作成
 * @param {string} productId - 商品ID（棚番号など）
 * @returns {Folder} 商品専用フォルダ
 */
function getOrCreateProductFolder_(productId) {
  const rootFolder = getOrCreateImageFolder_();
  const subFolderName = `商品_${productId}_${new Date().getTime()}`;

  // 既存のフォルダを検索（同じ商品IDの場合）
  const existingFolders = rootFolder.getFoldersByName(subFolderName);
  if (existingFolders.hasNext()) {
    return existingFolders.next();
  }

  // 新規作成
  return rootFolder.createFolder(subFolderName);
}

/**
 * Base64画像データをGoogle Driveにアップロード
 *
 * @param {Object} params - パラメータオブジェクト
 * @param {Array<Object>} params.images - 画像データ配列
 *   @param {string} images[].data - Base64エンコードされた画像データ（data:image/png;base64,... 形式）
 *   @param {string} images[].name - ファイル名（オプション）
 *   @param {boolean} images[].forAI - AI生成用かどうか（オプション）
 * @param {string} params.productId - 商品ID（棚番号など）
 *
 * @returns {Object} アップロード結果
 *   @property {boolean} success - 成功したかどうか
 *   @property {Array<Object>} urls - アップロードされた画像のURL配列
 *   @property {string} error - エラーメッセージ（失敗時）
 */
function uploadImagesToGoogleDrive(params) {
  try {
    // パラメータ検証
    if (!params || !params.images || !Array.isArray(params.images)) {
      throw new Error('NG(IMAGE_UPLOAD): 画像データが不正です');
    }

    if (params.images.length === 0) {
      return {
        success: true,
        urls: [],
        message: '画像がありません'
      };
    }

    if (params.images.length > 20) {
      throw new Error('NG(IMAGE_UPLOAD): 画像は最大20枚までです');
    }

    const productId = params.productId || 'unknown';
    const folder = getOrCreateProductFolder_(productId);
    const uploadedUrls = [];

    // 各画像をアップロード
    params.images.forEach((img, index) => {
      try {
        // Base64データからMIMEタイプとデータ部分を分離
        const dataUrlMatch = img.data.match(/^data:([^;]+);base64,(.+)$/);
        if (!dataUrlMatch) {
          throw new Error(`画像${index + 1}のデータ形式が不正です`);
        }

        const mimeType = dataUrlMatch[1];
        const base64Data = dataUrlMatch[2];

        // Base64デコード
        const blob = Utilities.newBlob(
          Utilities.base64Decode(base64Data),
          mimeType
        );

        // ファイル名生成
        const extension = mimeType.split('/')[1] || 'png';
        const fileName = img.name || `image_${index + 1}_${new Date().getTime()}.${extension}`;
        blob.setName(fileName);

        // Google Driveにアップロード
        const file = folder.createFile(blob);

        // 共有設定（リンクを知っている全員が閲覧可能）
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

        // URL情報を保存
        uploadedUrls.push({
          url: file.getUrl(),
          id: file.getId(),
          name: fileName,
          forAI: img.forAI || false,
          uploadedAt: new Date().toISOString()
        });

        Logger.log(`画像アップロード成功: ${fileName} (${index + 1}/${params.images.length})`);

      } catch (err) {
        Logger.log(`画像${index + 1}のアップロード失敗: ${err.message}`);
        // 個別の画像エラーは記録するが、処理は継続
        uploadedUrls.push({
          error: err.message,
          index: index + 1,
          forAI: img.forAI || false
        });
      }
    });

    return {
      success: true,
      urls: uploadedUrls,
      folderId: folder.getId(),
      folderUrl: folder.getUrl(),
      totalCount: params.images.length,
      successCount: uploadedUrls.filter(u => !u.error).length,
      message: `${uploadedUrls.filter(u => !u.error).length}/${params.images.length}枚の画像をアップロードしました`
    };

  } catch (error) {
    Logger.log(`画像アップロードエラー: ${error.message}`);
    return {
      success: false,
      error: error.message,
      urls: []
    };
  }
}

/**
 * 画像URLをJSON形式でスプレッドシートに保存する形式に変換
 *
 * @param {Array<Object>} urls - uploadImagesToGoogleDrive()の戻り値のurls配列
 * @returns {string} JSON文字列
 */
function formatImageUrlsForSheet(urls) {
  if (!urls || urls.length === 0) {
    return '';
  }

  // エラーがないURLのみ抽出
  const validUrls = urls.filter(u => !u.error);

  if (validUrls.length === 0) {
    return '';
  }

  // シンプルなJSON形式に変換
  return JSON.stringify(validUrls, null, 2);
}

/**
 * AI生成用画像のURLのみを抽出
 *
 * @param {Array<Object>} urls - 画像URL配列
 * @returns {Array<Object>} AI生成用の画像URL配列（最大3件）
 */
function getAiImageUrls(urls) {
  if (!urls || urls.length === 0) {
    return [];
  }

  return urls
    .filter(u => !u.error && u.forAI === true)
    .slice(0, 3); // 最大3件
}

/**
 * 古い画像フォルダを削除（ストレージ管理用）
 * 注意: 現在は手動実行のみ。自動削除は慎重に
 *
 * @param {number} daysOld - 何日前より古いフォルダを削除するか
 */
function cleanupOldImageFolders(daysOld = 90) {
  try {
    const rootFolder = getOrCreateImageFolder_();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const folders = rootFolder.getFolders();
    let deletedCount = 0;

    while (folders.hasNext()) {
      const folder = folders.next();
      const createdDate = folder.getDateCreated();

      if (createdDate < cutoffDate) {
        Logger.log(`古いフォルダを削除: ${folder.getName()} (作成日: ${createdDate})`);
        folder.setTrashed(true);
        deletedCount++;
      }
    }

    Logger.log(`${deletedCount}個のフォルダを削除しました`);
    return {
      success: true,
      deletedCount: deletedCount
    };

  } catch (error) {
    Logger.log(`フォルダ削除エラー: ${error.message}`);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * テスト用: サンプル画像をアップロード
 * Apps Script エディタから直接実行可能
 */
function testImageUpload() {
  // テスト用の小さなBase64画像（1x1 透明PNG）
  const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const result = uploadImagesToGoogleDrive({
    images: [
      { data: testImage, name: 'test1.png', forAI: true },
      { data: testImage, name: 'test2.png', forAI: false }
    ],
    productId: 'TEST001'
  });

  Logger.log('テスト結果:');
  Logger.log(JSON.stringify(result, null, 2));

  if (result.success) {
    Logger.log('JSON形式:');
    Logger.log(formatImageUrlsForSheet(result.urls));
  }
}
