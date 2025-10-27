/**
 * デバッグ用: AA-1016の仕入金額取得テスト
 */
function debugPurchaseAmountAA1016() {
  try {
    Logger.log('=== AA-1016 仕入金額デバッグ開始 ===');

    const result = getProductByManagementNumberAPI('AA-1016');

    Logger.log('API結果:');
    Logger.log(JSON.stringify(result, null, 2));

    if (result.success && result.data) {
      Logger.log('\n取得データ:');
      Logger.log('管理番号: ' + result.data.managementNumber);
      Logger.log('仕入金額: ' + result.data.purchaseAmount);
      Logger.log('出品金額: ' + result.data.listingAmount);
      Logger.log('仕入金額の型: ' + typeof result.data.purchaseAmount);
      Logger.log('出品金額の型: ' + typeof result.data.listingAmount);

      // スプレッドシートから直接取得
      const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('在庫/売上管理表');
      const lastRow = sh.getLastRow();
      const data = sh.getRange(1, 1, lastRow, sh.getLastColumn()).getValues();

      // AA-1016の行を探す
      for (let i = 1; i < data.length; i++) {
        if (data[i][1] === 'AA-1016') { // B列が管理番号
          Logger.log('\nスプレッドシート直接取得（' + (i + 1) + '行目）:');
          Logger.log('全行データ: ' + JSON.stringify(data[i]));

          // ヘッダー行
          const headers = data[0];
          Logger.log('\nヘッダー行:');
          for (let j = 0; j < headers.length; j++) {
            if (headers[j] && (headers[j].includes('仕入') || headers[j].includes('出品'))) {
              Logger.log(`列${j + 1} (${String.fromCharCode(65 + j)}): ${headers[j]} = ${data[i][j]}`);
            }
          }
          break;
        }
      }
    }

    Logger.log('=== デバッグ終了 ===');
    return result;

  } catch (error) {
    Logger.log('エラー: ' + error.toString());
    Logger.log(error.stack);
    return { success: false, error: error.toString() };
  }
}
