/**
 * 画像プロキシ機能
 * Google Driveの画像をWebアプリ経由で配信（3rd-party cookie問題の回避）
 *
 * 使い方：
 * https://script.google.com/macros/s/{デプロイID}/exec?action=getImage&id={fileId}
 */

/**
 * Webアプリのメインエントリーポイント（画像配信用）
 * 既存のdoGet()がある場合は、そちらに統合してください
 */
function doGet_ImageProxy(e) {
  try {
    // アクションパラメータで処理を分岐
    const action = e.parameter.action;

    if (action === 'getImage') {
      return serveImage(e);
    }

    // 他のアクション用に既存のdoGet()に処理を渡す
    // return doGet_Original(e);

    return ContentService.createTextOutput('Invalid action')
      .setMimeType(ContentService.MimeType.TEXT);

  } catch (error) {
    Logger.log('doGet_ImageProxy error: ' + error.message);
    return ContentService.createTextOutput('Error: ' + error.message)
      .setMimeType(ContentService.MimeType.TEXT);
  }
}

/**
 * Google Driveから画像を取得して配信
 */
function serveImage(e) {
  const fileId = e.parameter.id;

  if (!fileId) {
    return ContentService.createTextOutput('Missing file ID')
      .setMimeType(ContentService.MimeType.TEXT);
  }

  try {
    // Google Driveからファイルを取得
    const file = DriveApp.getFileById(fileId);
    const blob = file.getBlob();

    // 画像として配信
    const output = ContentService.createOutput()
      .append(blob.getBytes())
      .setMimeType(blob.getContentType());

    // キャッシュヘッダーを設定（1年間キャッシュ）
    output.addHeader('Cache-Control', 'public, max-age=31536000, immutable');

    // CORS対応（必要に応じて）
    output.addHeader('Access-Control-Allow-Origin', '*');

    Logger.log('Serving image: ' + fileId + ', type: ' + blob.getContentType());

    return output;

  } catch (error) {
    Logger.log('serveImage error for fileId ' + fileId + ': ' + error.message);

    // エラー時は透明1x1pxのGIFを返す（画像が壊れて見えないように）
    const transparentGif = Utilities.base64Decode('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
    return ContentService.createOutput()
      .append(transparentGif)
      .setMimeType('image/gif')
      .addHeader('Cache-Control', 'no-cache');
  }
}

/**
 * 画像プロキシURLを生成
 * @param {string} fileId - Google DriveのファイルID
 * @returns {string} プロキシURL
 */
function getImageProxyUrl(fileId) {
  // デプロイIDを取得（実際のデプロイIDに置き換える必要があります）
  const deployId = 'AKfycbysB4W4MbXrnR0i2dp8cv3jtlCck69tUkXZR6gMArd55d73u92dg_jbHDazssJtWws_'; // 最新のデプロイID
  const baseUrl = 'https://script.google.com/macros/s/' + deployId + '/exec';

  return baseUrl + '?action=getImage&id=' + fileId;
}
