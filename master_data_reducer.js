// 一体型削減システム - 関数選択ボックス対応版
// master_data_reducer.gs の内容を全て置き換えてください

// ステップ1: 現状確認
function step1_checkStatus() {
  console.log('=== ステップ1: 現状確認 ===');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('マスタデータ');
  const currentRows = sheet.getLastRow() - 1;
  console.log(`現在のアイテム数: ${currentRows}件`);
  console.log(`削減進捗: ${1153 - currentRows}件削除済み`);
  console.log(`目標まで: ${currentRows - 500}件削除が必要`);
  return currentRows;
}

// ステップ2: 次のカテゴリ確認（シャツ・ブラウス）
function step2_showShirts() {
  console.log('=== ステップ2: レディースシャツ・ブラウス確認 ===');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('マスタデータ');
  const data = sheet.getRange(2, 1, sheet.getLastRow()-1, 6).getValues();
  
  const items = [];
  data.forEach((row, index) => {
    const [大分類, 中分類, 小分類, 細分類1, 細分類2, アイテム名] = row;
    if (`${大分類}-${中分類}-${小分類}` === 'レディース-トップス-シャツ・ブラウス') {
      items.push({
        row: index + 2,
        item: アイテム名,
        detail: `${細分類1} ${細分類2}`.trim()
      });
    }
  });
  
  console.log(`レディース-トップス-シャツ・ブラウス: ${items.length}件`);
  items.forEach((item, index) => {
    console.log(`${index + 1}. ${item.item} ${item.detail ? `(${item.detail})` : ''}`);
  });
  
  return items;
}

// ステップ3: シャツ・ブラウス削減実行
function step3_deleteShirts() {
  console.log('=== ステップ3: レディースシャツ・ブラウス削減実行 ===');
  
  const deletePatterns = [
    /スタンドカラー/, /ウイングカラー/, /ピンホールカラー/,
    /チェック/, /ストライプ/, /ドット/, /プリント/,
    /ワーク/, /ミリタリー/, /ウエスタン/, /オックスフォード/,
    /フォーマル/, /ビジネス/, /カジュアル/,
    /オーバーサイズ/, /ビッグ/, /スリム/, /タイト/
  ];
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('マスタデータ');
  const data = sheet.getRange(2, 1, sheet.getLastRow()-1, 6).getValues();
  const deleteRows = [];
  
  data.forEach((row, index) => {
    const [大分類, 中分類, 小分類, 細分類1, 細分類2, アイテム名] = row;
    if (`${大分類}-${中分類}-${小分類}` === 'レディース-トップス-シャツ・ブラウス') {
      const shouldDelete = deletePatterns.some(pattern => pattern.test(アイテム名));
      if (shouldDelete) {
        deleteRows.push(index + 2);
      }
    }
  });
  
  console.log(`削除対象: ${deleteRows.length}件`);
  deleteRows.sort((a, b) => b - a);
  
  deleteRows.forEach(rowNum => {
    const rowData = sheet.getRange(rowNum, 1, 1, 6).getValues()[0];
    console.log(`削除: ${rowData[5]}`);
    sheet.deleteRow(rowNum);
  });
  
  console.log(`${deleteRows.length}件の削除が完了しました`);
  return deleteRows.length;
}

// ステップ4: ニット・セーター確認
function step4_showKnits() {
  console.log('=== ステップ4: レディースニット・セーター確認 ===');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('マスタデータ');
  const data = sheet.getRange(2, 1, sheet.getLastRow()-1, 6).getValues();
  
  const items = [];
  data.forEach((row, index) => {
    const [大分類, 中分類, 小分類, 細分類1, 細分類2, アイテム名] = row;
    if (`${大分類}-${中分類}-${小分類}` === 'レディース-トップス-ニット・セーター') {
      items.push({
        row: index + 2,
        item: アイテム名
      });
    }
  });
  
  console.log(`レディース-トップス-ニット・セーター: ${items.length}件`);
  items.forEach((item, index) => {
    console.log(`${index + 1}. ${item.item}`);
  });
  
  return items;
}

// ステップ5: ニット・セーター削減実行
function step5_deleteKnits() {
  console.log('=== ステップ5: レディースニット・セーター削減実行 ===');
  
  const deletePatterns = [
    /フィッシャーマン/, /アーガイル/, /ケーブル/, /リブ/,
    /モヘア/, /カシミア/, /アルパカ/, /アンゴラ/,
    /タートル/, /クルー/, /Vネック/, /カーディガン(?!$)/,
    /オーバーサイズ/, /ビッグ/, /ショート/, /ロング/,
    /ボレロ/, /ポンチョ/, /ケープ/
  ];
  
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('マスタデータ');
  const data = sheet.getRange(2, 1, sheet.getLastRow()-1, 6).getValues();
  const deleteRows = [];
  
  data.forEach((row, index) => {
    const [大分類, 中分類, 小分類, 細分類1, 細分類2, アイテム名] = row;
    if (`${大分類}-${中分類}-${小分類}` === 'レディース-トップス-ニット・セーター') {
      const shouldDelete = deletePatterns.some(pattern => pattern.test(アイテム名));
      if (shouldDelete) {
        deleteRows.push(index + 2);
      }
    }
  });
  
  console.log(`削除対象: ${deleteRows.length}件`);
  deleteRows.sort((a, b) => b - a);
  
  deleteRows.forEach(rowNum => {
    const rowData = sheet.getRange(rowNum, 1, 1, 6).getValues()[0];
    console.log(`削除: ${rowData[5]}`);
    sheet.deleteRow(rowNum);
  });
  
  console.log(`${deleteRows.length}件の削除が完了しました`);
  return deleteRows.length;
}

// 最終確認
function step6_finalCheck() {
  console.log('=== ステップ6: 最終確認 ===');
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('マスタデータ');
  const currentRows = sheet.getLastRow() - 1;
  console.log(`現在のアイテム数: ${currentRows}件`);
  console.log(`削減進捗: ${1153 - currentRows}件削除済み`);
  
  if (currentRows <= 500) {
    console.log('🎉 目標達成！');
  } else {
    console.log(`あと${currentRows - 500}件削除が必要`);
    console.log('次は小さなカテゴリの統合や個別削除を検討しましょう');
  }
  
  return currentRows;
}