/**
 * image_upload_r2.js
 * Cloudflare R2への画像アップロード機能
 *
 * Phase 2: R2移行版
 * - 最大20枚の画像をCloudflare R2に保存
 * - Workers経由でアップロード
 * - Google Drive版と同じインターフェース
 */

// Workers APIのエンドポイント
const R2_WORKER_URL = 'https://reborn-r2-uploader.mercari-yasuhirotakuji.workers.dev/upload';

/**
 * Base64画像データをCloudflare R2にアップロード（Workers経由）
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
function uploadImagesToR2(params) {
  try {
    // パラメータ検証
    if (!params || !params.images || !Array.isArray(params.images)) {
      throw new Error('NG(IMAGE_UPLOAD_R2): 画像データが不正です');
    }

    if (params.images.length === 0) {
      return {
        success: true,
        urls: [],
        message: '画像がありません'
      };
    }

    if (params.images.length > 20) {
      throw new Error('NG(IMAGE_UPLOAD_R2): 画像は最大20枚までです');
    }

    const productId = params.productId || 'unknown';
    const uploadedUrls = [];

    // 各画像のリクエストを準備
    const requests = [];
    const fileInfos = [];

    params.images.forEach((img, index) => {
      try {
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

        // ファイル名生成（商品IDを含める）
        const extension = mimeType.split('/')[1] || 'png';
        const timestamp = new Date().getTime();
        const fileName = img.name || `${productId}_${timestamp}_${index + 1}.${extension}`;
        blob.setName(fileName);

        // リクエストオプションを配列に追加
        requests.push({
          url: R2_WORKER_URL,
          method: 'post',
          payload: { file: blob },
          muteHttpExceptions: true
        });

        // ファイル情報を保存（レスポンスと紐付けるため）
        fileInfos.push({
          name: fileName,
          forAI: img.forAI || false,
          index: index
        });

      } catch (err) {
        Logger.log(`画像${index + 1}の準備エラー: ${err.message}`);
        uploadedUrls.push({
          error: err.message,
          index: index + 1,
          forAI: img.forAI || false
        });
      }
    });

    // 全てのリクエストを並列実行（UrlFetchApp.fetchAll）
    if (requests.length > 0) {
      const responses = UrlFetchApp.fetchAll(requests);

      // レスポンスを処理
      responses.forEach((response, index) => {
        try {
          const responseCode = response.getResponseCode();
          const responseText = response.getContentText();

          if (responseCode !== 200) {
            throw new Error(`アップロード失敗（HTTP ${responseCode}）: ${responseText}`);
          }

          const result = JSON.parse(responseText);

          if (!result.success) {
            throw new Error(result.error || 'アップロードに失敗しました');
          }

          // URL情報を保存（Google Drive版と同じ形式）
          uploadedUrls.push({
            url: result.url,
            fileName: result.fileName,
            name: fileInfos[index].name,
            forAI: fileInfos[index].forAI
          });

        } catch (err) {
          Logger.log(`画像${fileInfos[index].index + 1}のアップロードエラー: ${err.message}`);
          uploadedUrls.push({
            error: err.message,
            index: fileInfos[index].index + 1,
            forAI: fileInfos[index].forAI
          });
        }
      });
    }

    const successCount = uploadedUrls.filter(url => !url.error).length;

    return {
      success: true,
      urls: uploadedUrls,
      totalCount: params.images.length,
      successCount: successCount,
      message: `${successCount}/${params.images.length}枚の画像をR2にアップロードしました`
    };

  } catch (error) {
    Logger.log(`R2アップロードエラー: ${error.message}`);
    return {
      success: false,
      error: error.message,
      urls: []
    };
  }
}

/**
 * テスト用: サンプル画像をR2にアップロード
 * Apps Script エディタから直接実行可能
 */
function testR2Upload() {
  // テスト用の小さなBase64画像（1x1 透明PNG）
  const testImage = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

  const result = uploadImagesToR2({
    images: [
      { data: testImage, name: 'test1.png', forAI: true },
      { data: testImage, name: 'test2.png', forAI: false }
    ],
    productId: 'TEST_R2_001'
  });

  Logger.log('R2テスト結果:');
  Logger.log(JSON.stringify(result, null, 2));

  if (result.success && result.successCount > 0) {
    Logger.log('\n✅ R2アップロード成功！');
    Logger.log('アップロードされた画像URL:');
    result.urls.filter(u => !u.error).forEach(u => {
      Logger.log(`  - ${u.url}`);
    });
  } else {
    Logger.log('\n❌ R2アップロード失敗');
  }
}
