/** master.gs（セールスワード専用システム完全版）**/
const MASTER_SHEET = 'マスタデータ';

// ===== 欠損関数修正パッチ =====
  function _uniqKeepOrder(arr) {
    const seen = new Set();
    const result = [];
    for (const item of arr || []) {
      const str = (item ?? '').toString().trim();
      if (str && !seen.has(str)) {
        seen.add(str);
        result.push(str);
      }
    }
    return result;
  }

  function _findIdx(arr, targets) {
  // targetsが配列の場合、各エイリアスを順番に試す
  if (Array.isArray(targets)) {
    for (const target of targets) {
      const index = arr.indexOf(target);
      if (index !== -1) return index;
    }
    return -1;
  }
  // 配列でない場合は従来通り
  return arr.indexOf(targets);
}

  function _splitMulti(value) {
    return String(value || '').split(/[,\u3001\/\uFF0F\n]+/).map(v => v.trim()).filter(v => v.length > 0);
  }


function getMasterOptions() {
  const WANT = {
    '担当者' : ['担当者'],
    'ブランド(英語)' : ['ブランド(英語)','ブランド（英語）'],
    'ブランド(カナ)' : ['ブランド(カナ)','ブランド（カナ）'],
    '仕入先' : ['仕入先','仕入れ先'],
    'セールスワード(カテゴリ)' : ['セールスワード(カテゴリ)','セールスワードカテゴリ','セールスワード（カテゴリ）'],
    'セールスワード' : ['セールスワード','セールスワード(キーワード)','セールスワード（キーワード）'],
    '生地・素材・質感系': ['生地・素材・質感系','生地/素材/質感','生地・素材','素材'],
    'サイズ' : ['サイズ'],
    'サイズ(表記)' : ['サイズ(表記)','サイズ（表記）'],
    '商品の状態' : ['商品の状態','商品状態'],
    // 出品情報
    '出品先' : ['出品先','出品サイト','販売先','マーケット','出品チャネル','販売チャネル'],
    // 配送について
    '配送料の負担' : ['配送料の負担','送料負担'],
    '配送の方法' : ['配送の方法','配送方法'],
    '発送元の地域' : ['発送元の地域','発送地域','都道府県'],
    '発送までの日数' : ['発送までの日数','発送日数'],
    // タイトル情報（20項目相当）
    '季節感・機能性' : ['季節感・機能性'],
    '着用シーン・イベント': ['着用シーン・イベント','シーン・イベント'],
    '見た目・印象' : ['見た目・印象'],
    'トレンド表現' : ['トレンド表現'],
    'サイズ感・体型カバー': ['サイズ感・体型カバー'],
    '年代・テイスト・スタイル': ['年代・テイスト・スタイル'],
    'カラー/配色/トーン': ['カラー/配色/トーン','カラー','配色','トーン'],
    '柄・模様' : ['柄・模様','柄','模様'],
    'ディテール・仕様' : ['ディテール・仕様','ディテール','仕様'],
    'シルエット/ライン' : ['シルエット/ライン','シルエット','ライン'],
    'ネックライン' : ['ネックライン'],
    '襟・衿' : ['襟・衿','襟','衿'],
    '袖・袖付け' : ['袖・袖付け','袖','袖付け'],
    '丈' : ['丈','長さ'],
    '革/加工' : ['革/加工','革','加工'],
    '毛皮/加工' : ['毛皮/加工','毛皮'],
    '生産国' : ['生産国','原産国'],
      // 素材情報項目を追加
      '素材(箇所)': ['素材(箇所)','素材箇所'],
      '素材(種類)': ['素材(種類)','素材種類'],
      // 手動管理シート項目を追加
      '大分類' : ['大分類'],
    '中分類' : ['中分類'],
    '小分類' : ['小分類'],
    '細分類1' : ['細分類1'],
    '細分類2' : ['細分類2'],
    'アイテム名' : ['アイテム名']
};

  const out = {};
  try {
    // マスタデータを最優先にしてマージ順序を変更
    mergeOptions(out, readOptionsFromSheet(getMasterSheetName_(), WANT)); // マスタデータ最優先
    mergeOptions(out, readOptionsFromManualSheet('手動管理_ブランド', WANT));
    mergeOptions(out, readOptionsFromManualSheet('手動管理_アイテム分類', WANT));
    mergeOptions(out, readOptionsFromSheet(getMainSheetName_(), WANT)); // メインシートは最後
    
  } catch (e) {
    console.error('getMasterOptions エラー:', e);
    // 失敗時でも構造は返す（空配列）→ Front が固まらない
    Object.keys(WANT).forEach(k => { if (!out[k]) out[k] = []; });
  }
  return out;
}

function getCategoryRows() {
  try {
    console.log('=== getCategoryRows修正版実行開始 ===');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const itemSheet = ss.getSheetByName('手動管理_アイテム分類');
    
    if (!itemSheet) {
      return { ok: false, msg: '手動管理_アイテム分類シートが見つかりません' };
    }
    
    const data = itemSheet.getDataRange().getValues();
    console.log('シートデータ行数:', data.length);
    
    if (data.length <= 1) {
      return { ok: true, rows: [] };
    }
    
    const rows = [];
    
    // 各行をオブジェクトに変換（ヘッダー行をスキップ）
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      
      const rowObj = {
        '大分類': (row[0] || '').toString().trim(),
        '中分類': (row[1] || '').toString().trim(), 
        '小分類': (row[2] || '').toString().trim(),
        '細分類': (row[3] || '').toString().trim(),
        '細分類2': (row[4] || '').toString().trim(),
        'アイテム名': (row[5] || '').toString().trim(),
        'セールスワード(カテゴリ)': '',
        'セールスワード': ''
      };
      
      rows.push(rowObj);
    }
    
    console.log('変換後のrows数:', rows.length);
    
    return { ok: true, rows: rows };
    
  } catch (error) {
    console.error('getCategoryRows エラー:', error);
    return { ok: false, msg: `エラー: ${error.toString()}` };
  }
}

/**
 * セールスワード専用データ取得関数
 */
function getSalesWordData() {
  try {
    console.log('=== セールスワードデータ専用取得開始 ===');
    
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('マスタデータ');
    
    if (!masterSheet) {
      console.log('マスタデータシートが見つかりません');
      return { categories: [], words: [], wordsByCategory: {} };
    }
    
    const lastRow = masterSheet.getLastRow();
    const lastCol = masterSheet.getLastColumn();
    
    if (lastRow < 2) {
      console.log('マスタデータにデータがありません');
      return { categories: [], words: [], wordsByCategory: {} };
    }
    
    const values = masterSheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = values[0];
    
    // セールスワード関連の列を特定
    const categoryColIndex = headers.indexOf('セールスワード(カテゴリ)');
    const wordColIndex = headers.indexOf('セールスワード');
    
    console.log('セールスワード(カテゴリ)列:', categoryColIndex);
    console.log('セールスワード列:', wordColIndex);
    
    if (categoryColIndex === -1 || wordColIndex === -1) {
      console.log('セールスワード関連の列が見つかりません');
      return { categories: [], words: [], wordsByCategory: {} };
    }
    
    // データ収集
    const categorySet = new Set();
    const wordsByCategory = {};
    const allWords = new Set();
    
    for (let r = 1; r < values.length; r++) {
      const row = values[r];
      const category = String(row[categoryColIndex] || '').trim();
      const word = String(row[wordColIndex] || '').trim();
      
      if (category) {
        categorySet.add(category);
        
        if (word) {
          if (!wordsByCategory[category]) {
            wordsByCategory[category] = new Set();
          }
          wordsByCategory[category].add(word);
          allWords.add(word);
        }
      }
    }
    
    // 結果をオブジェクト形式に変換
    const result = {
      categories: Array.from(categorySet).sort(),
      wordsByCategory: {},
      allWords: Array.from(allWords).sort()
    };
    
    // カテゴリ別ワード配列に変換
    Object.keys(wordsByCategory).forEach(category => {
      result.wordsByCategory[category] = Array.from(wordsByCategory[category]).sort();
    });
    
    console.log('取得完了 - カテゴリ数:', result.categories.length);
    console.log('取得完了 - 全ワード数:', result.allWords.length);
    console.log('カテゴリ一覧:', result.categories);
    
    return result;
    
  } catch (error) {
    console.error('getSalesWordData エラー:', error);
    return { categories: [], words: [], wordsByCategory: {} };
  }
}

/**
   * ブランドペアデータの取得（英語名とカナ読みの正確な対応関係を保持）
   */
  function getBrandPairs() {
    try {
      console.log('=== getBrandPairs 開始 ===');

      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const brandSheet = ss.getSheetByName('手動管理_ブランド');

      if (!brandSheet) {
        console.error('手動管理_ブランドシートが見つかりません');
        return [];
      }

      const data = brandSheet.getDataRange().getValues();
      console.log('ブランドデータ行数:', data.length);

      const pairs = [];

      // ヘッダー行をスキップして処理
      for (let i = 1; i < data.length; i++) {
        const english = String(data[i][0] || '').trim();  // A列：ブランド(英語)
        const kana = String(data[i][1] || '').trim();     // B列：ブランド(カナ)

        if (english && kana) {
          pairs.push({
            english: english,
            kana: kana
          });
        }
      }

      console.log('ブランドペア取得完了:', pairs.length, '件');
      return pairs;

    } catch (error) {
      console.error('getBrandPairs エラー:', error);
      return [];
    }
  }

/**
 * 指定カテゴリのセールスワード取得
 */
function getSalesWordsByCategory(category) {
  try {
    if (!category) {
      return { success: false, words: [] };
    }
    
    const salesWordData = getSalesWordData();
    const words = salesWordData.wordsByCategory[category] || [];
    
    console.log(`カテゴリ "${category}" のワード数:`, words.length);
    
    return {
      success: true,
      words: words
    };
    
  } catch (error) {
    console.error('getSalesWordsByCategory エラー:', error);
    return { success: false, words: [] };
  }
}

/**
 * 手動管理シートからのオプション読み取り
 */
function readOptionsFromManualSheet(sheetName, aliasMap) {
  const res = {};
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) return res;
  
  const lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lr < 2 || lc < 1) return res;
  
  const values = sh.getRange(1, 1, lr, lc).getValues();
  const headers = values[0];
  
  // 手動管理シートの構造に基づく列マッピング
  const columnMapping = getManualSheetColumnMapping(sheetName, headers);
  
  // 各列のデータを収集
  Object.keys(columnMapping).forEach(fieldName => {
    if (!aliasMap[fieldName]) return;
    
    const columnIndex = columnMapping[fieldName];
    if (columnIndex === -1) return;
    
    const seen = new Set();
    const fieldData = [];
    
    for (let r = 1; r < values.length; r++) {
      const value = values[r][columnIndex];
      const trimmed = String(value || '').trim();
      
      if (trimmed && !seen.has(trimmed)) {
        seen.add(trimmed);
        fieldData.push(trimmed);
      }
    }
    
    if (fieldData.length > 0) {
      res[fieldName] = fieldData;
    }
  });
  
  return res;
}

/**
 * 手動管理シートの列マッピング取得
 */
function getManualSheetColumnMapping(sheetName, headers) {
  if (sheetName === '手動管理_ブランド') {
    return {
      'ブランド(英語)': headers.indexOf('ブランド(英語)') !== -1 ? headers.indexOf('ブランド(英語)') : 0,
      'ブランド(カナ)': headers.indexOf('ブランド(カナ)') !== -1 ? headers.indexOf('ブランド(カナ)') : 1
    };
  }
  
  if (sheetName === '手動管理_アイテム分類') {
    return {
      '大分類': headers.indexOf('大分類') !== -1 ? headers.indexOf('大分類') : 0,
      '中分類': headers.indexOf('中分類') !== -1 ? headers.indexOf('中分類') : 1,
      '小分類': headers.indexOf('小分類') !== -1 ? headers.indexOf('小分類') : 2,
      '細分類1': headers.indexOf('細分類1') !== -1 ? headers.indexOf('細分類1') : 3,
      '細分類2': headers.indexOf('細分類2') !== -1 ? headers.indexOf('細分類2') : 4,
      'アイテム名': headers.indexOf('アイテム名') !== -1 ? headers.indexOf('アイテム名') : 5
    };
  }
  
  return {};
}

/**
 * 単一フィールドのマスタデータ取得（後方互換性）
 */
function getMasterData(fieldName) {
  try {
    const allOptions = getMasterOptions();
    return allOptions[fieldName] || [];
  } catch (error) {
    console.error(`getMasterData エラー (${fieldName}):`, error);
    return [];
  }
}

function mergeOptions(dst, src) {
  Object.keys(src || {}).forEach(k => {
    const existing = dst[k] || [];
    const newItems = src[k] || [];
    
    // 新しいアイテムがある場合のみマージ
    if (newItems.length > 0) {
      dst[k] = _uniqKeepOrder([...existing, ...newItems]);
    } else if (existing.length === 0) {
      // 既存も新規も空の場合、空配列を設定
      dst[k] = [];
    }
  });
}

function readOptionsFromSheet(sheetName, aliasMap) {
  const res = {};
  const sh = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sh) return res;
  
  const lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lr < 2 || lc < 1) return res;
  
  const values = sh.getRange(1, 1, lr, lc).getValues();
  const headers = values[0];
  
  // 列インデックスマップを作成
  const idx = {};
  Object.keys(aliasMap).forEach(key => {
    idx[key] = _findIdx(headers, aliasMap[key]);
  });
  
  // データを収集
  const seen = Object.fromEntries(Object.keys(idx).map(k => [k, new Set()]));
  
  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    
    for (const key of Object.keys(idx)) {
      const c = idx[key];
      if (c === -1) continue;
      
      const cellValue = row[c];
      if (!cellValue) continue;
      
      // セル値を文字列に変換して分割処理
      const list = _splitMulti(cellValue);
      if (!res[key]) res[key] = [];
      
      for (const v of list) {
        const trimmed = String(v || '').trim();
        if (!trimmed || seen[key].has(trimmed)) continue;
        
        seen[key].add(trimmed);
        res[key].push(trimmed);
      }
    }
  }
  
  return res;
}

// === シート名（定数があればそれを優先） ===
function getMasterSheetName_() {
  try { if (typeof MASTER_SHEET !== 'undefined' && MASTER_SHEET) return MASTER_SHEET; } catch (_) { }
  return 'マスタデータ';
}

function getMainSheetName_() {
  try { if (typeof SHEET_NAME !== 'undefined' && SHEET_NAME) return SHEET_NAME; } catch (_) { }
  return '在庫/売上管理表';
}

function testGetCategoryRowsSimple() {
  console.log('=== getCategoryRows単体テスト ===');
  const result = getCategoryRows();
  console.log('結果:', result);
  if (result.ok && result.rows && result.rows.length > 0) {
    console.log('最初の行:', result.rows[0]);
  }
}

// セールスワード専用テスト関数
function testSalesWordData() {
  console.log('=== セールスワード専用テスト ===');
  const result = getSalesWordData();
  console.log('取得結果:', result);
  
  if (result.categories.length > 0) {
    console.log('最初のカテゴリのワード:', result.wordsByCategory[result.categories[0]]);
  }
}

  function exportHeaders() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('在庫/売上管理表');
  
  if (!sheet) {
    Logger.log('シートが見つかりません');
    return;
  }
  
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // CSV形式で出力(番号付き)
  let output = '';
  headers.forEach((header, index) => {
    output += `${index + 1},${header}\n`;
  });
  
  Logger.log(output);
  Logger.log(`\n=== 合計: ${lastCol}列 ===`);
}

function saveProduct(data) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('在庫/売上管理表');
    
    if (!sheet) {
      return 'NG(SHEET): シートが見つかりません';
    }
    
    const lastCol = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    
    const headerMap = {};
    headers.forEach((header, index) => {
      const headerName = String(header || '').trim();
      if (headerName) {
        headerMap[headerName] = index;
      }
    });
    
    const fieldMapping = {
      '棚番号': '棚番号',
      '商品番号': '商品番号',
      '担当者': '担当者',
      'セールスワード(カテゴリ)': 'セールスワード(カテゴリ)',
      'セールスワード': 'セールスワード',
      'ブランド(英語)': 'ブランド(英語)',
      'ブランド(カナ)': 'ブランド(カナ)',
      '商品名(タイトル)': '商品名(タイトル)',
      '大分類(カテゴリ)': '大分類',
      '中分類(カテゴリ)': '中分類',
      '小分類(カテゴリ)': '小分類',
      '細分類(カテゴリ)': '細分類1',
      '細分類2': '細分類2',
      'サイズ': 'サイズ',
      '商品の状態': '商品の状態',
      'アイテム名': 'アイテム名',
      '商品の説明': '商品の説明',
      '商品状態詳細': '商品状態(詳細)',
      '肩幅': '肩幅',
      '身幅': '身幅',
      '袖丈': '袖丈',
      '着丈': '着丈',
      'ウエスト': 'ウエスト',
      'ヒップ': 'ヒップ',
      '股上': '股上',
      '股下': '股下',
      '仕入日': '仕入日',
      '仕入先': '仕入先',
      '仕入金額': '仕入金額',
      '出品日': '出品日',
      '出品先': '出品先',
      '出品金額': '出品金額',
      '配送料の負担': '配送料の負担',
      '配送の方法': '配送の方法',
      '発送元の地域': '発送元の地域',
      '発送までの日数': '発送までの日数'
    };
    
    const lastRow = sheet.getLastRow();
    const newRowNumber = lastRow + 1;
    
    // 空の行を追加(数式がコピーされる)
    sheet.insertRowAfter(lastRow);
    console.log(`新しい行を挿入: 行${newRowNumber}`);
    
    // 直前の行から書式(罫線、背景色など)をコピー
    const sourceRange = sheet.getRange(lastRow, 1, 1, lastCol);
    sourceRange.copyFormatToRange(sheet, 1, lastCol, newRowNumber, newRowNumber);
    
    SpreadsheetApp.flush();
    
    // 入力データを配置
    let mappedCount = 0;
    Object.keys(data).forEach(fieldId => {
      const sheetColumnName = fieldMapping[fieldId] || fieldId;
      const columnIndex = headerMap[sheetColumnName];
      
      if (columnIndex !== undefined) {
        const value = data[fieldId] || '';
        if (value) {
          sheet.getRange(newRowNumber, columnIndex + 1).setValue(value);
          mappedCount++;
        }
      }
    });
    
    SpreadsheetApp.flush();
    
    console.log(`データ入力完了: ${mappedCount}項目`);
    console.log(`商品登録完了: 行${newRowNumber}に保存`);
    return 'OK: 商品を登録しました';
    
  } catch (error) {
    console.error('saveProduct エラー:', error);
    return `NG(ERROR): ${error.toString()}`;
  }
}

/**
   * 商品状態(詳細)の過去入力履歴を取得
   */
  function getProductConditionHistory() {
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('在庫/売上管理表');

      if (!sheet) {
        return [];
      }

      // ヘッダーから列インデックスを取得
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const colIndex = headers.indexOf('商品状態(詳細)');

      if (colIndex === -1) {
        return [];
      }

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        return [];
      }

      // データを取得
      const data = sheet.getRange(2, colIndex + 1, lastRow - 1, 1).getValues();

      // 重複を除外して配列化
      const seen = new Set();
      const history = [];

      for (let i = 0; i < data.length; i++) {
        const value = String(data[i][0] || '').trim();
        if (value && !seen.has(value)) {
          seen.add(value);
          history.push(value);
        }
      }

      console.log(`商品状態履歴取得: ${history.length}件`);
      return history.sort(); // アルファベット順にソート

    } catch (error) {
      console.error('getProductConditionHistory エラー:', error);
      return [];
    }
  }