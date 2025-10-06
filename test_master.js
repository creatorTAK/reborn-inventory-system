function testMasterDataRead() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('マスタデータ');
  if (!sheet) {
    Logger.log('マスタデータシートが見つかりません');
    return;
  }

  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  Logger.log('行数: ' + lastRow + ', 列数: ' + lastCol);

  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  Logger.log('ヘッダー行: ' + JSON.stringify(headers));

  // 担当者列を探す
  const tantouIdx = headers.indexOf('担当者');
  Logger.log('担当者列のインデックス: ' + tantouIdx);

  if (tantouIdx !== -1 && lastRow >= 2) {
    const tantouData = sheet.getRange(2, tantouIdx + 1, lastRow - 1, 1).getValues();
    Logger.log('担当者データ: ' + JSON.stringify(tantouData));
  }
}

function deleteColumnD() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('在庫/売上管理表');
  sheet.deleteColumn(4); // D列を削除
  console.log('✅ D列（棚番号（抽出））を削除しました');

  // 削除後の確認
  const headers = sheet.getRange(1, 1, 1, 6).getValues()[0];
  console.log('=== 削除後の列構成（最初の6列） ===');
  headers.forEach((header, index) => {
    console.log(`${index + 1}列目: ${header}`);
  });
}
