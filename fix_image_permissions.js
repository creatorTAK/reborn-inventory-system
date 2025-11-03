/**
 * 既存のGoogle Drive画像ファイルの共有設定を修正
 *
 * 使い方：
 * 1. Apps Scriptエディタでこの関数を実行
 * 2. 「REBORN管理番号フォルダ」内の全画像ファイルの共有設定を修正
 */
function fixExistingImagePermissions() {
  try {
    Logger.log('🔍 親フォルダを検索中...');
    
    // 「商品画像」フォルダを取得（image_upload_gdrive.jsと同じ方法）
    const folders = DriveApp.getFoldersByName('REBORN商品画像');
    
    if (!folders.hasNext()) {
      Logger.log('❌ 「REBORN商品画像」フォルダが見つかりません');
      return {
        success: false,
        error: 'REBORN商品画像フォルダが見つかりません'
      };
    }
    
    const parentFolder = folders.next();
    Logger.log(`✅ 親フォルダ取得: ${parentFolder.getName()}`);

    // 管理番号フォルダを取得
    const productFolders = parentFolder.getFolders();
    let totalFiles = 0;
    let successCount = 0;
    let errorCount = 0;

    Logger.log('📂 管理番号フォルダをスキャン中...');

    while (productFolders.hasNext()) {
      const productFolder = productFolders.next();
      const folderName = productFolder.getName();
      Logger.log(`\n📁 フォルダ: ${folderName}`);

      // フォルダ内の画像ファイルを取得
      const files = productFolder.getFiles();

      while (files.hasNext()) {
        const file = files.next();
        const fileName = file.getName();
        const fileId = file.getId();
        totalFiles++;

        try {
          // 共有設定を適用
          file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

          Logger.log(`  ✅ ${fileName} (${fileId})`);
          successCount++;

        } catch (error) {
          Logger.log(`  ❌ ${fileName} (${fileId}): ${error.message}`);
          errorCount++;
        }
      }
    }

    Logger.log(`\n📊 処理完了`);
    Logger.log(`  合計ファイル: ${totalFiles}`);
    Logger.log(`  成功: ${successCount}`);
    Logger.log(`  失敗: ${errorCount}`);

    return {
      success: true,
      totalFiles: totalFiles,
      successCount: successCount,
      errorCount: errorCount
    };

  } catch (error) {
    Logger.log(`❌ エラー: ${error.message}`);
    Logger.log(error.stack);
    return {
      success: false,
      error: error.message
    };
  }
}
