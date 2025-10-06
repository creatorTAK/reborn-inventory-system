/**
 * シート構造を新しい管理番号システムに移行するスクリプト
 * 実行方法: Apps Scriptエディタで setupNewManagementSystem() を実行
 */

function setupNewManagementSystem() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('在庫/売上管理表');

  if (!sheet) {
    SpreadsheetApp.getUi().alert('「在庫/売上管理表」シートが見つかりません');
    return;
  }

  try {
    // ステップ1: 現在の列構成を確認
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const colIndices = {
      管理番号: headers.indexOf('管理番号') + 1,
      棚番号: headers.indexOf('棚番号') + 1,
      商品番号: headers.indexOf('商品番号') + 1
    };

    console.log('現在の列構成:', colIndices);

    // ステップ2: 棚番号列と商品番号列が存在する場合、管理番号列にマージ
    if (colIndices.棚番号 > 0 && colIndices.商品番号 > 0 && colIndices.管理番号 > 0) {
      migrateToSingleManagementNumber(sheet, colIndices);
    }

    // ステップ3: 補助列「棚番号（抽出）」を追加
    const helperColIndex = addHelperColumn(sheet, colIndices.管理番号);

    // ステップ4: スライサーを設定（スキップ - 手動で設定）
    // setupSlicer(sheet, helperColIndex);

    // ステップ5: 旧列を削除（オプション）
    if (colIndices.棚番号 > 0 && colIndices.商品番号 > 0) {
      deleteOldColumns(sheet, colIndices);
    }

    SpreadsheetApp.getUi().alert('✅ シート構造の移行が完了しました！\n\n' +
      '・管理番号列に統合完了\n' +
      '・補助列「棚番号（抽出）」を追加（非表示）\n' +
      '・旧「棚番号」「商品番号」列を削除\n\n' +
      '※ スライサーは手動で設定してください（データ > スライサー）');
  } catch (error) {
    console.error('エラー:', error);
    SpreadsheetApp.getUi().alert('❌ エラーが発生しました: ' + error.message);
  }
}

/**
 * 棚番号と商品番号を管理番号列にマージ
 */
function migrateToSingleManagementNumber(sheet, colIndices) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  // 設定マスタから管理番号設定を取得
  const mgmtConfig = getManagementNumberConfig();
  const useShelf = mgmtConfig['棚番号使用'] === 'true';
  const separator = mgmtConfig['区切り文字'] || '-';
  const padWidth = parseInt(mgmtConfig['商品番号桁数']) || 4;

  // 既存データを読み込み
  const shelfValues = sheet.getRange(2, colIndices.棚番号, lastRow - 1, 1).getValues();
  const numValues = sheet.getRange(2, colIndices.商品番号, lastRow - 1, 1).getValues();

  // 管理番号を生成
  const mgmtNumbers = [];
  for (let i = 0; i < shelfValues.length; i++) {
    const shelf = String(shelfValues[i][0] || '').trim().toUpperCase();
    const num = String(numValues[i][0] || '').trim();

    if (!num) {
      mgmtNumbers.push(['']); // 空のまま
      continue;
    }

    const paddedNum = String(Number(num)).padStart(padWidth, '0');

    if (useShelf && shelf) {
      mgmtNumbers.push([`${shelf}${separator}${paddedNum}`]);
    } else {
      mgmtNumbers.push([paddedNum]);
    }
  }

  // 管理番号列に書き込み
  if (mgmtNumbers.length > 0) {
    sheet.getRange(2, colIndices.管理番号, mgmtNumbers.length, 1).setValues(mgmtNumbers);
  }

  console.log(`${mgmtNumbers.length}件の管理番号をマージしました`);
}

/**
 * 補助列「棚番号（抽出）」を追加
 * @returns {number} 補助列のインデックス
 */
function addHelperColumn(sheet, mgmtColIndex) {
  // 管理番号列の右隣に挿入
  const helperColIndex = mgmtColIndex + 1;
  sheet.insertColumnAfter(mgmtColIndex);

  // ヘッダーを設定
  sheet.getRange(1, helperColIndex).setValue('棚番号（抽出）');
  sheet.getRange(1, helperColIndex).setBackground('#f0f0f0').setFontWeight('bold');

  // 数式を設定（管理番号から棚番号部分を抽出）
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    // 設定マスタから区切り文字を取得
    const mgmtConfig = getManagementNumberConfig();
    const separator = mgmtConfig['区切り文字'] || '-';

    // 管理番号列の列文字を取得（例: C列 → "C"）
    const mgmtColLetter = columnToLetter(mgmtColIndex);

    // 数式: 区切り文字の前の部分を抽出、なければ空文字
    const formula = `=IF(ISBLANK(${mgmtColLetter}2),"",IF(ISERROR(FIND("${separator}",${mgmtColLetter}2)),"",LEFT(${mgmtColLetter}2,FIND("${separator}",${mgmtColLetter}2)-1)))`;

    sheet.getRange(2, helperColIndex).setFormula(formula);

    // 数式を下にコピー
    sheet.getRange(2, helperColIndex).copyTo(
      sheet.getRange(2, helperColIndex, lastRow - 1, 1),
      SpreadsheetApp.CopyPasteType.PASTE_FORMULA,
      false
    );
  }

  // 列を非表示
  sheet.hideColumns(helperColIndex);

  console.log(`補助列「棚番号（抽出）」を追加しました（列${helperColIndex}）`);
  return helperColIndex;
}

/**
 * スライサーを設定
 */
function setupSlicer(sheet, helperColIndex) {
  // 既存のスライサーを削除
  const slicers = sheet.getSlicers();
  slicers.forEach(slicer => slicer.remove());

  // データ範囲を取得
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  const dataRange = sheet.getRange(1, 1, lastRow, lastCol);

  // スライサーを作成
  const slicer = sheet.newSlicer()
    .setDataRange(dataRange)
    .setColumnFilterCriteria(helperColIndex, SpreadsheetApp.newFilterCriteria())
    .setTitle('棚番号で絞り込み')
    .setPosition(50, 50, 0, 0) // 位置調整
    .build();

  sheet.insertSlicer(slicer);

  console.log('スライサーを設定しました');
}

/**
 * 旧「棚番号」「商品番号」列を削除
 */
function deleteOldColumns(sheet, colIndices) {
  // 削除は後ろから（インデックスがずれないように）
  const colsToDelete = [colIndices.棚番号, colIndices.商品番号].sort((a, b) => b - a);

  colsToDelete.forEach(colIndex => {
    if (colIndex > 0) {
      sheet.deleteColumn(colIndex);
      console.log(`列${colIndex}を削除しました`);
    }
  });
}

/**
 * 列番号をアルファベットに変換（例: 1 → "A", 27 → "AA"）
 */
function columnToLetter(column) {
  let temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}
