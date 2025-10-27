/**
 * 販売記録機能に必要なシートを作成
 * GASエディタから実行: setupSalesRecordingSheets()
 */

function setupSalesRecordingSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. 発送方法マスタシート作成
  createShippingMethodMasterSheet(ss);

  // 2. 備品在庫リストシート作成
  createPackagingMaterialsSheet(ss);

  Logger.log('✅ 販売記録機能のシートセットアップ完了');
  SpreadsheetApp.getUi().alert('販売記録機能のシートセットアップが完了しました！\n\n作成されたシート:\n・発送方法マスタ\n・備品在庫リスト');
}

/**
 * 発送方法マスタシート作成
 */
function createShippingMethodMasterSheet(ss) {
  const sheetName = '発送方法マスタ';

  // 既存シートがあれば削除
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    Logger.log(`既存の「${sheetName}」シートを削除します`);
    ss.deleteSheet(sheet);
  }

  // 新規シート作成
  sheet = ss.insertSheet(sheetName);

  // ヘッダー行
  const headers = ['発送方法1', '発送方法2', '送料'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ヘッダーのフォーマット
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4285f4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');

  // サンプルデータ（メルカリの発送方法）
  const sampleData = [
    ['らくらくメルカリ便', 'ネコポス', 210],
    ['らくらくメルカリ便', '宅急便コンパクト', 450],
    ['らくらくメルカリ便', '宅急便60', 750],
    ['らくらくメルカリ便', '宅急便80', 850],
    ['らくらくメルカリ便', '宅急便100', 1050],
    ['らくらくメルカリ便', '宅急便120', 1200],
    ['らくらくメルカリ便', '宅急便140', 1450],
    ['らくらくメルカリ便', '宅急便160', 1700],
    ['ゆうゆうメルカリ便', 'ゆうパケット', 230],
    ['ゆうゆうメルカリ便', 'ゆうパケットプラス', 455],
    ['ゆうゆうメルカリ便', 'ゆうパック60', 770],
    ['ゆうゆうメルカリ便', 'ゆうパック80', 870],
    ['ゆうゆうメルカリ便', 'ゆうパック100', 1070],
    ['梱包・発送たのメル便', '80サイズ', 1700],
    ['梱包・発送たのメル便', '120サイズ', 2400],
    ['梱包・発送たのメル便', '160サイズ', 3400],
    ['梱包・発送たのメル便', '200サイズ', 5000],
    ['ゆうメール', '150g以内', 180],
    ['ゆうメール', '250g以内', 215],
    ['ゆうメール', '500g以内', 310],
    ['ゆうメール', '1kg以内', 360],
    ['レターパック', 'レターパックライト', 370],
    ['レターパック', 'レターパックプラス', 520],
    ['普通郵便(定形郵便)', '25g以内', 84],
    ['普通郵便(定形郵便)', '50g以内', 94],
    ['普通郵便(定形外郵便)', '50g以内', 120],
    ['普通郵便(定形外郵便)', '100g以内', 140],
    ['普通郵便(定形外郵便)', '150g以内', 210],
    ['普通郵便(定形外郵便)', '250g以内', 250],
    ['普通郵便(定形外郵便)', '500g以内', 390],
    ['普通郵便(定形外郵便)', '1kg以内', 580],
    ['クリックポスト', 'クリックポスト', 185],
    ['ゆうパケット', 'ゆうパケット', 250],
    ['未定', '未定', 0]
  ];

  // データ挿入
  sheet.getRange(2, 1, sampleData.length, 3).setValues(sampleData);

  // 列幅調整
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 100);

  // 送料列を数値フォーマット
  sheet.getRange(2, 3, sampleData.length, 1).setNumberFormat('¥#,##0');

  // 罫線
  const dataRange = sheet.getRange(1, 1, sampleData.length + 1, 3);
  dataRange.setBorder(true, true, true, true, true, true);

  Logger.log(`✅ 「${sheetName}」シート作成完了（${sampleData.length}件のデータ）`);
}

/**
 * 備品在庫リストシート作成
 */
function createPackagingMaterialsSheet(ss) {
  const sheetName = '備品在庫リスト';

  // 既存シートがあれば削除
  let sheet = ss.getSheetByName(sheetName);
  if (sheet) {
    Logger.log(`既存の「${sheetName}」シートを削除します`);
    ss.deleteSheet(sheet);
  }

  // 新規シート作成
  sheet = ss.insertSheet(sheetName);

  // ヘッダー行
  const headers = [
    '商品画像',
    '商品名',
    '発注先',
    '商品リンク',
    '個数',
    '価格',
    '略称',
    '1個あたり',
    '入庫数合計',
    '出庫数合計',
    '在庫数'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  // ヘッダーのフォーマット
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#34a853');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');

  // サンプルデータ
  const sampleData = [
    ['', 'A4 ジッパー式ポリ袋 100枚', 'Amazon', 'https://example.com', 100, 939, 'A4ジッパー袋', '=F2/E2', 100, 0, '=I2-J2'],
    ['', 'B4 テープ付OPP袋 100枚', 'Amazon', 'https://example.com', 100, 660, 'B4 OPP袋', '=F3/E3', 100, 0, '=I3-J3'],
    ['', 'サンキューカード(メンズ) 100枚', '印刷会社', 'https://example.com', 100, 426, 'サンキューカード(M)', '=F4/E4', 100, 0, '=I4-J4'],
    ['', 'サンキューカード(レディース) 100枚', '印刷会社', 'https://example.com', 100, 426, 'サンキューカード(L)', '=F5/E5', 100, 0, '=I5-J5'],
    ['', 'ゆうパケットポストmini 20枚', '郵便局', 'https://example.com', 20, 1200, 'ゆうパケポmini', '=F6/E6', 20, 0, '=I6-J6'],
    ['', 'ゆうパケットポストシール 20枚', '郵便局', 'https://example.com', 20, 100, 'ゆうパケポシール', '=F7/E7', 20, 0, '=I7-J7'],
    ['', 'レターパックプラス 1枚', '郵便局', 'https://example.com', 1, 520, 'レタパ+', '=F8/E8', 10, 0, '=I8-J8'],
    ['', 'レターパックライト 1枚', '郵便局', 'https://example.com', 1, 370, 'レタパライト', '=F9/E9', 10, 0, '=I9-J9'],
    ['', 'クリスタルパック 100枚', 'Amazon', 'https://example.com', 100, 550, 'クリスタルパック', '=F10/E10', 100, 0, '=I10-J10'],
    ['', 'プチプチ袋 50枚', 'Amazon', 'https://example.com', 50, 800, 'プチプチ袋', '=F11/E11', 50, 0, '=I11-J11'],
    ['', '宅配ビニール袋 50枚', 'Amazon', 'https://example.com', 50, 600, '宅配ビニール袋', '=F12/E12', 50, 0, '=I12-J12'],
    ['', 'ダンボール60サイズ 10枚', 'Amazon', 'https://example.com', 10, 1200, 'ダンボール60', '=F13/E13', 10, 0, '=I13-J13'],
    ['', 'ダンボール80サイズ 10枚', 'Amazon', 'https://example.com', 10, 1500, 'ダンボール80', '=F14/E14', 10, 0, '=I14-J14'],
    ['', 'ガムテープ', '100均', '', 1, 110, 'ガムテープ', '=F15/E15', 5, 0, '=I15-J15'],
    ['', 'なし', '', '', 1, 0, 'なし', '=F16/E16', 9999, 0, '=I16-J16']
  ];

  // データ挿入
  sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);

  // 列幅調整
  sheet.setColumnWidth(1, 80);   // 商品画像
  sheet.setColumnWidth(2, 250);  // 商品名
  sheet.setColumnWidth(3, 100);  // 発注先
  sheet.setColumnWidth(4, 150);  // 商品リンク
  sheet.setColumnWidth(5, 60);   // 個数
  sheet.setColumnWidth(6, 80);   // 価格
  sheet.setColumnWidth(7, 150);  // 略称
  sheet.setColumnWidth(8, 100);  // 1個あたり
  sheet.setColumnWidth(9, 100);  // 入庫数合計
  sheet.setColumnWidth(10, 100); // 出庫数合計
  sheet.setColumnWidth(11, 80);  // 在庫数

  // 数値フォーマット
  sheet.getRange(2, 5, sampleData.length, 1).setNumberFormat('#,##0');      // 個数
  sheet.getRange(2, 6, sampleData.length, 1).setNumberFormat('¥#,##0');     // 価格
  sheet.getRange(2, 8, sampleData.length, 1).setNumberFormat('¥#,##0.00');  // 1個あたり
  sheet.getRange(2, 9, sampleData.length, 1).setNumberFormat('#,##0');      // 入庫数合計
  sheet.getRange(2, 10, sampleData.length, 1).setNumberFormat('#,##0');     // 出庫数合計
  sheet.getRange(2, 11, sampleData.length, 1).setNumberFormat('#,##0');     // 在庫数

  // 罫線
  const dataRange = sheet.getRange(1, 1, sampleData.length + 1, headers.length);
  dataRange.setBorder(true, true, true, true, true, true);

  // 略称列にデータ入力規則を追加（後で自動プルダウン用）
  const abbreviations = sampleData.map(row => row[6]);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(abbreviations, true)
    .build();

  Logger.log(`✅ 「${sheetName}」シート作成完了（${sampleData.length}件のサンプルデータ）`);
}

/**
 * テスト実行用
 */
function testSetupSheets() {
  setupSalesRecordingSheets();
}
