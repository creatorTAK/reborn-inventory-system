/**
 * テスト用：既存ユーザー数を確認
 */
function testGetExistingUserCount() {
  const count = getExistingUserCount();
  Logger.log('=== テスト結果 ===');
  Logger.log('既存ユーザー数: ' + count);

  // シートの状態も確認
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('FCM通知登録');

  if (!sheet) {
    Logger.log('FCM通知登録シート: 存在しません');
  } else {
    const data = sheet.getDataRange().getValues();
    Logger.log('FCM通知登録シート: 存在します');
    Logger.log('総行数: ' + data.length);
    Logger.log('データ行数: ' + (data.length - 1));

    // 実際のデータ内容を確認
    Logger.log('=== シートの内容 ===');
    for (let i = 0; i < Math.min(data.length, 5); i++) {
      Logger.log('Row ' + (i + 1) + ': ' + JSON.stringify(data[i]));
    }
  }

  return count;
}
