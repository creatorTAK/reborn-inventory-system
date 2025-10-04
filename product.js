/** product.gs（最下行コピーで数式・検証・書式を引き継ぎ） **/

// =============================================================================
// 必要な定数・設定（sp_scripts.htmlとの連携用） - 重複回避版
// =============================================================================
const REQUIRED_FIELDS_PRODUCT = []; // 重複回避

const PRODUCT_FIELDS = [
  '棚番号','商品番号','担当者',
  'セールスワード(カテゴリ)','セールスワード',
  'ブランド(英語)','ブランド(カナ)',
  '商品名(タイトル)',
  '生地・素材・質感系',
  '季節感・機能性','着用シーン・イベント','見た目・印象','トレンド表現',
  'サイズ感・体型カバー','年代・テイスト・スタイル','カラー/配色/トーン','柄・模様',
  'ディテール・仕様','シルエット/ライン','ネックライン','襟・衿',
  '袖・袖付け','丈','革/加工','毛皮/加工','生産国',
  '大分類','中分類','小分類','細分類1','細分類2',
  'サイズ','商品の状態',
  'アイテム名',
  '商品の説明',
  '商品状態(詳細)',
  '肩幅','身幅','袖丈','着丈','ウエスト','ヒップ','股上','股下',
  '仕入日','仕入先','仕入金額',
  '出品日','出品先','出品金額',
  '配送料の負担','配送の方法','発送元の地域','発送までの日数'
];

const KEY_NUM_WIDTH_PRODUCT = 4; // 重複回避

// =============================================================================
// ヘルパー関数（sp_scripts.htmlとの連携用）
// =============================================================================
function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('在庫/売上管理表');
}

function getSheet() {
  return getSheet_();
}

function getHeaderMap_() {
  const sh = getSheet_();
  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  
  const map = {};
  headers.forEach((name, index) => {
    if (name && name.toString().trim()) {
      map[name.toString().trim()] = index + 1; // 1-based
    }
  });
  
  return { map, lastCol };
}

function getHeaderMapCommon() {
  return getHeaderMap_();
}

function colByName(sheet, columnName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headers.indexOf(columnName);
  return index === -1 ? null : index + 1; // 1-based
}

// =============================================================================
// 商品状態詳細の列名動的対応関数
// =============================================================================
function getColumnByName(sheet, columnName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const columnIndex = headers.indexOf(columnName);
  return columnIndex >= 0 ? columnIndex + 1 : null; // 1ベースのインデックスに変換
}

function saveProductDetailField(sheet, targetRow, formData) {
  // 商品状態(詳細)を動的に保存
  const detailColumn = getColumnByName(sheet, '商品状態(詳細)');
  
  if (detailColumn && formData['商品状態詳細']) {
    console.log(`商品状態(詳細)を列${detailColumn}に保存: "${formData['商品状態詳細']}"`);
    sheet.getRange(targetRow, detailColumn).setValue(formData['商品状態詳細']);
    return true;
  } else if (detailColumn) {
    // 列は存在するが値が空の場合、空文字をセット
    sheet.getRange(targetRow, detailColumn).setValue('');
    return true;
  }
  
  return false; // 列が見つからない場合
}

// =============================================================================
// メイン保存関数
// =============================================================================
function saveProduct(form) {
  try {
    // ★★★ フォームIDとスプレッドシート列名のマッピング ★★★
    const fieldMapping = {
      '大分類(カテゴリ)': '大分類',
      '中分類(カテゴリ)': '中分類',
      '小分類(カテゴリ)': '小分類',
      '細分類(カテゴリ)': '細分類1',
      '商品状態詳細': '商品状態(詳細)'
    };

    console.log('=== saveProduct 受信データ ===');
    console.log('全データ:', JSON.stringify(form));

    const sh = getSheet_();
    const { map, lastCol } = getHeaderMap_();
    
    // 必須チェック
    for (const k of REQUIRED_FIELDS_PRODUCT) {
      if (!form[k]) return `NG(VALIDATION): '${k}' が未入力です`;
    }
    
    if (form['商品番号']) {
      const n = Number(form['商品番号']);
      if (!Number.isFinite(n) || n < 1001) {
        return 'NG(FORMAT): 商品番号は1001以上の数値で入力してください';
      }
    }
    
    if (form['仕入金額'] && isNaN(Number(form['仕入金額']))) {
      return 'NG(FORMAT): 仕入金額は数値で入力してください';
    }
    
    if (form['仕入日']) {
      const d = new Date(form['仕入日']);
      if (isNaN(d.getTime())) return 'NG(FORMAT): 仕入日の形式が不正です';
    }
    
    // 管理番号生成
    const padWidth = KEY_NUM_WIDTH_PRODUCT;
    const shelf = String(form['棚番号'] || '').trim();
    const num = String(form['商品番号'] || '').trim();
    const mgmtKey = (shelf && num) ? `${shelf}-${String(Number(num)).padStart(padWidth, '0')}` : '';
    
    // === 行挿入処理 ===
    const lastRow = sh.getLastRow();
    let targetRow;
    
    if (lastRow >= 2) {
      // スプレッドシートの標準動作を再現
      sh.insertRowAfter(lastRow);
      targetRow = lastRow + 1;
      
      const srcRange = sh.getRange(lastRow, 1, 1, lastCol);
      const dstRange = sh.getRange(targetRow, 1, 1, lastCol);
      
// 数式のみをコピー
srcRange.copyTo(dstRange, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);

// 書式をコピー（罫線も含む）
srcRange.copyTo(dstRange, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);

// データ検証（プルダウン）をコピー
srcRange.copyTo(dstRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
      
    } else {
      sh.insertRowAfter(1);
      targetRow = 2;
    }
    
    // === データ保存 ===
    for (const formKey of Object.keys(form)) {
      // マッピングを適用
      const sheetColumnName = fieldMapping[formKey] || formKey;
      const col = map[sheetColumnName];
      
      if (!col) {
        console.log(`列未発見: フォーム[${formKey}] → シート[${sheetColumnName}]`);
        continue;
      }
      
      let val = form[formKey];
      
      // データ型変換
      if (formKey === '商品番号' && val !== '' && val != null) {
        val = Number(val);
      } else {
        val = (val == null) ? '' : String(val).trim();
      }
      
      console.log(`保存: ${formKey} → ${sheetColumnName} = "${val}" (列${col})`);
      sh.getRange(targetRow, col).setValue(val);
    }
    
    // 管理番号
    const headersAll = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const idxMng = headersAll.indexOf('管理番号');
    if (idxMng !== -1 && mgmtKey) {
      sh.getRange(targetRow, idxMng + 1).setValue(mgmtKey);
    }
    
    let message = mgmtKey ? `OK: 管理番号='${mgmtKey}' を登録しました` : `OK: 登録しました`;
    
    if (form['商品状態詳細']) {
      message += ` ※商品状態(詳細)も保存`;
    }
    
    return message;
      
  } catch (e) {
    console.error('saveProduct エラー:', e);
    const msg = (e && e.message) ? e.message : String(e);
    return msg.startsWith('NG(') ? msg : `NG(UNKNOWN): ${msg}`;
  }
}

// =============================================================================
// 管理番号生成関連（sp_scripts.htmlから呼び出される）
// =============================================================================
function getNextItemNumber(shelf) {
  try {
    const sh = getSheet_();
    if (!sh) return 'NG(SHEET): シートが見つかりません';

    const { map } = getHeaderMap_();
    const numCol = map['商品番号'];
    const shelfCol = map['棚番号'];

    if (!numCol) return 'NG(COLUMN): 商品番号列が見つかりません';
    if (!shelfCol) return 'NG(COLUMN): 棚番号列が見つかりません';

    const lastRow = sh.getLastRow();
    if (lastRow < 2) return 1001; // 初回

    // 棚番号と商品番号を同時に取得
    const range = sh.getRange(2, Math.min(numCol, shelfCol), lastRow - 1, Math.abs(numCol - shelfCol) + 1);
    const values = range.getValues();

    // 指定された棚番号に一致する商品番号のみを抽出
    const filteredNumbers = values
      .filter(row => {
        const rowShelf = shelfCol < numCol ? row[0] : row[row.length - 1];
        return String(rowShelf).trim() === String(shelf).trim();
      })
      .map(row => {
        const num = shelfCol < numCol ? row[row.length - 1] : row[0];
        const n = Number(num);
        return Number.isFinite(n) ? n : 0;
      });

    // 該当する棚番号のデータがない場合は1001から開始
    if (filteredNumbers.length === 0) return 1001;

    const maxNum = Math.max(...filteredNumbers);
    return maxNum >= 1001 ? maxNum + 1 : 1001;

  } catch (error) {
    console.error('getNextItemNumber エラー:', error);
    return `NG(ERROR): ${error.message}`;
  }
}

// =============================================================================
// セールスワード関連（sp_scripts.htmlから呼び出される）
// =============================================================================
function getSalesWordCategoryOptionsFromAnywhere() {
  try {
    const allOptions = getMasterOptions();
    return {
      ok: true,
      options: allOptions['セールスワード(カテゴリ)'] || []
    };
  } catch (error) {
    console.error('getSalesWordCategoryOptions エラー:', error);
    return { ok: false, options: [] };
  }
}

function getSalesWordOptionsFromAnywhere(category) {
  try {
    const allOptions = getMasterOptions();
    return {
      ok: true,
      options: allOptions['セールスワード'] || []
    };
  } catch (error) {
    console.error('getSalesWordOptions エラー:', error);
    return { ok: false, options: [] };
  }
}

// =============================================================================
// バリデーション（分離・拡張性重視）
// =============================================================================
function validateProductData(form) {
  const errors = [];
  
  // 必須フィールドチェック
  const requiredFields = []; // 現在は任意だが、将来的に拡張可能
  for (const field of requiredFields) {
    if (!form[field] || String(form[field]).trim() === '') {
      errors.push(`'${field}' は必須項目です`);
    }
  }
  
  // 商品番号バリデーション
  if (form['商品番号']) {
    const num = Number(form['商品番号']);
    if (!Number.isFinite(num) || num < 1001) {
      errors.push('商品番号は1001以上の数値で入力してください');
    }
  }
  
  // 金額バリデーション
  const amountFields = ['仕入金額', '出品金額'];
  for (const field of amountFields) {
    if (form[field] && isNaN(Number(form[field]))) {
      errors.push(`${field}は数値で入力してください`);
    }
  }
  
  // 日付バリデーション
  const dateFields = ['仕入日', '出品日'];
  for (const field of dateFields) {
    if (form[field]) {
      const date = new Date(form[field]);
      if (isNaN(date.getTime())) {
        errors.push(`${field}の形式が不正です`);
      }
    }
  }
  
  // 文字数制限チェック
  const lengthChecks = [
    { field: '商品名(タイトル)', max: 40 },
    { field: '商品の説明', max: 1000 },
    { field: '商品状態詳細', max: 500 } // 新規追加
  ];
  
  for (const check of lengthChecks) {
    const value = form[check.field] || '';
    const length = Array.from(value).length;
    if (length > check.max) {
      errors.push(`${check.field}は${check.max}文字以内で入力してください（現在${length}文字）`);
    }
  }
  
  return errors.length > 0 
    ? { success: false, error: `バリデーションエラー: ${errors.join(', ')}` }
    : { success: true };
}

// =============================================================================
// データ処理・変換
// =============================================================================
function processProductData(form) {
  const processed = {};
  
  // 全フィールドを処理
  for (const fieldName of PRODUCT_FIELDS) {
    let value = form[fieldName];
    
    // データ型変換
    if (fieldName === '商品番号' && value !== '' && value != null) {
      processed[fieldName] = Number(value);
    } else if (['仕入金額', '出品金額'].includes(fieldName) && value) {
      processed[fieldName] = Number(value) || 0;
    } else {
      processed[fieldName] = (value == null) ? '' : String(value).trim();
    }
  }
  
  return processed;
}

// =============================================================================
// 管理番号生成（将来の拡張対応）
// =============================================================================
function generateManagementNumber(shelfCode, itemNumber) {
  const padWidth = 4; // 将来的に設定可能にする
  const shelf = String(shelfCode || '').trim();
  const num = String(itemNumber || '').trim();
  
  if (shelf && num) {
    return `${shelf}-${String(Number(num)).padStart(padWidth, '0')}`;
  }
  return '';
}

// =============================================================================
// シート保存処理（既存ロジック維持）
// =============================================================================
function saveProductToSheet(processedData, managementNumber) {
  const sh = getSheet();
  const { map, lastCol } = getHeaderMapCommon();
  
  // 最下行コピーで数式・検証・書式を引き継ぐ
  const lastRow = sh.getLastRow();
  let targetRow;
  
  if (lastRow >= 2) {
    // データが1行以上ある → その直下に1行挿入
    sh.insertRowsAfter(lastRow, 1);
    targetRow = lastRow + 1;
    
    const src = sh.getRange(lastRow, 1, 1, lastCol);
      const dst = sh.getRange(targetRow, 1, 1, lastCol);

      // 数式・検証・書式だけを貼り付け
      src.copyTo(dst, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
      src.copyTo(dst, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION, false);
      src.copyTo(dst, SpreadsheetApp.CopyPasteType.PASTE_FORMULA, false);

      // 明示的に上部罫線を設定（確実に罫線を表示するため）
      dst.setBorder(true, null, null, null, null, null, 'black', SpreadsheetApp.BorderStyle.SOLID);
    } else {
    // データが無い（見出しのみ）→ 2行目を空で用意
    sh.insertRowsAfter(1, 1);
    targetRow = 2;
  }
  
  // フィールドデータの書き込み
  for (const fieldName of PRODUCT_FIELDS) {
    const col = map[fieldName];
    if (!col) continue;
    
    const value = processedData[fieldName];
    sh.getRange(targetRow, col).setValue(value);
  }
  
  // 商品状態(詳細)の動的保存
  saveProductDetailField(sh, targetRow, processedData);
  
  // 管理番号の書き込み（別途処理）
  if (managementNumber) {
    const headersAll = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const idxMng = headersAll.indexOf('管理番号');
    if (idxMng !== -1) {
      sh.getRange(targetRow, idxMng + 1).setValue(managementNumber);
    }
  }
  
  return { row: targetRow, managementNumber };
}

// =============================================================================
// 商品データ取得（将来の編集機能用）
// =============================================================================
function getProductByManagementNumber(managementNumber) {
  try {
    const sh = getSheet();
    const { map } = getHeaderMapCommon();
    
    // 管理番号で行を検索
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return null;
    
    const managementCol = colByName(sh, '管理番号');
    if (!managementCol) return null;
    
    const managementValues = sh.getRange(2, managementCol, lastRow - 1, 1)
      .getDisplayValues().flat();
    
    const rowIndex = managementValues.findIndex(val => 
      String(val).trim().toUpperCase() === String(managementNumber).trim().toUpperCase()
    );
    
    if (rowIndex === -1) return null;
    
    const targetRow = rowIndex + 2;
    const product = {};
    
    // 全フィールドのデータを取得
    for (const fieldName of PRODUCT_FIELDS) {
      const col = map[fieldName];
      if (col) {
        product[fieldName] = sh.getRange(targetRow, col).getDisplayValue();
      }
    }
    
    // 商品状態(詳細)も動的に取得
    const detailColumn = getColumnByName(sh, '商品状態(詳細)');
    if (detailColumn) {
      product['商品状態詳細'] = sh.getRange(targetRow, detailColumn).getDisplayValue();
    }
    
    return {
      ...product,
      _row: targetRow,
      _managementNumber: managementNumber
    };
    
  } catch (error) {
    console.error('Get product error:', error);
    return null;
  }
}

// =============================================================================
// 将来拡張用：商品複製機能
// =============================================================================
function duplicateProduct(managementNumber, modifications = {}) {
  try {
    const originalProduct = getProductByManagementNumber(managementNumber);
    if (!originalProduct) {
      return 'NG: 指定された商品が見つかりません';
    }
    
    // 複製データ作成（管理番号関連はクリア）
    const duplicateData = { ...originalProduct };
    delete duplicateData._row;
    delete duplicateData._managementNumber;
    duplicateData['棚番号'] = '';
    duplicateData['商品番号'] = '';
    
    // 修正事項を適用
    Object.assign(duplicateData, modifications);
    
    return saveProduct(duplicateData);
    
  } catch (error) {
    return handleProductError(error);
  }
}

function testSaveProductBasic() {
  try {
    const testForm = {
      '棚番号': 'AA',
      '商品番号': '1001',
      '担当者': 'テスト',
      '商品名(タイトル)': 'テスト商品',
      '商品状態詳細': 'テスト用の商品状態詳細'  // テスト用追加
    };
    
    console.log('テストフォームデータ:', testForm);
    const result = saveProduct(testForm);
    console.log('保存結果:', result);
    return result;
  } catch (error) {
    console.error('テストエラー:', error);
    return `テストエラー: ${error.message}`;
  }
}