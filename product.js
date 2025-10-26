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
  'サイズ','サイズ(表記)','商品の状態',
  'アイテム名',
  '商品の説明',
  '商品状態(詳細)',
  '肩幅','身幅','袖丈','着丈','ウエスト','ヒップ','股上','股下',
  '仕入日','仕入先','仕入金額',
  '出品日','出品先','出品金額',
  '配送料の負担','配送の方法','発送元の地域','発送までの日数',

  // === Phase 1: 今すぐ追加（Agent SDK準備） ===
  '登録者',
  '登録日時',
  '最終更新者',
  '更新日時',

  // === Phase 4: 将来使用（今は空欄） ===
  'AI生成履歴',      // JSON形式
  'メルカリURL',
  '競合価格履歴',    // JSON形式
  'AIタグ',
  'JSON_データ',     // 商品画像URL（JSON形式で最大20枚）
  'Agent分析結果'    // JSON形式
];

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
// 登録者・更新者情報記録
// =============================================================================
/**
 * 登録者・更新者情報を記録
 * @param {Sheet} sheet - 対象シート
 * @param {number} targetRow - 対象行
 * @param {boolean} isNew - 新規登録かどうか（true: 新規, false: 更新）
 */
function recordUserActivity(sheet, targetRow, isNew = true) {
  const { map } = getHeaderMapCommon();

  // ユーザーメールアドレスを取得（複数の方法で試行）
  let userEmail = '';
  try {
    userEmail = Session.getEffectiveUser().getEmail();
  } catch (e) {
    try {
      userEmail = Session.getActiveUser().getEmail();
    } catch (e2) {
      // 取得できない場合は、スプレッドシートのオーナーのメールを使用
      userEmail = SpreadsheetApp.getActiveSpreadsheet().getOwner().getEmail();
    }
  }

  const now = new Date();

  if (isNew) {
    // 新規登録時のみ記録
    if (map['登録者']) {
      sheet.getRange(targetRow, map['登録者']).setValue(userEmail);
    }
    if (map['登録日時']) {
      sheet.getRange(targetRow, map['登録日時']).setValue(now);
    }
  }

  // 更新情報は常に記録（新規・更新共通）
  if (map['最終更新者']) {
    sheet.getRange(targetRow, map['最終更新者']).setValue(userEmail);
  }
  if (map['更新日時']) {
    sheet.getRange(targetRow, map['更新日時']).setValue(now);
  }
}

// =============================================================================
// メイン保存関数
// =============================================================================
function saveProduct(form) {
  const perfStart = new Date().getTime();
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
    
    // 管理番号取得（フロントエンドから受け取る）
    const mgmtKey = String(form['管理番号'] || '').trim();
    
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

      // コピー後、数式以外のセル（値が入っているセル）を空文字でクリア
      const values = dstRange.getValues()[0];
      const formulas = dstRange.getFormulas()[0];
      for (let i = 0; i < values.length; i++) {
        // 数式がないセルで値が入っている場合のみクリア
        if (!formulas[i] && values[i] !== '') {
          sh.getRange(targetRow, i + 1).setValue('');
        }
      }

    } else {
      sh.insertRowAfter(1);
      targetRow = 2;
    }

    // === データ保存（一括書き込み最適化） ===
    // 現在の行データを取得
    const rowData = sh.getRange(targetRow, 1, 1, lastCol).getValues()[0];

    // フォームデータを配列に反映
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
      rowData[col - 1] = val; // 配列は0始まり、列は1始まり
    }

    // === ステータスのデフォルト値設定（Phase 1-4） ===
    const statusCol = map['ステータス'];
    if (statusCol) {
      if (!rowData[statusCol - 1] || String(rowData[statusCol - 1]).trim() === '') {
        rowData[statusCol - 1] = '登録済み';
        console.log('ステータスを自動設定: 登録済み');
      }
    }

    // === 登録者・更新者情報を配列に設定 ===
    let userEmail = '';
    try {
      userEmail = Session.getEffectiveUser().getEmail();
    } catch (e) {
      try {
        userEmail = Session.getActiveUser().getEmail();
      } catch (e2) {
        userEmail = SpreadsheetApp.getActiveSpreadsheet().getOwner().getEmail();
      }
    }

    const now = new Date();

    if (map['登録者']) {
      rowData[map['登録者'] - 1] = userEmail;
    }
    if (map['登録日時']) {
      rowData[map['登録日時'] - 1] = now;
    }
    if (map['最終更新者']) {
      rowData[map['最終更新者'] - 1] = userEmail;
    }
    if (map['更新日時']) {
      rowData[map['更新日時'] - 1] = now;
    }

    // === 一括書き込み実行 ===
    const writeStart = new Date().getTime();
    sh.getRange(targetRow, 1, 1, lastCol).setValues([rowData]);
    const writeEnd = new Date().getTime();
    console.log(`[PERF] 一括書き込み完了: ${writeEnd - writeStart}ms`);

    // === 統計情報を更新 ===
    try {
      // Phase 2: 統計は毎回全件スキャンで計算するため、ここでの更新は不要
    } catch (statsError) {
      // 統計更新処理は削除（Phase 2では不要）
    }

    const perfEnd = new Date().getTime();
    console.log(`[PERF] saveProduct完了（通知送信前）: ${perfEnd - perfStart}ms`);

    let message = '登録完了しました';

    // 🔔 商品登録完了の通知を送信
    try {
      Logger.log('[saveProduct] 通知送信開始: ' + mgmtKey);
      sendProductRegistrationNotification(form, mgmtKey);
      Logger.log('[saveProduct] 通知送信完了: ' + mgmtKey);
    } catch (notificationError) {
      Logger.log('[saveProduct] 通知送信エラー: ' + notificationError);
      Logger.log('[saveProduct] エラースタック: ' + notificationError.stack);
      // 通知エラーは商品登録の成功には影響させない
    }

    return message;
      
  } catch (e) {
    console.error('saveProduct エラー:', e);
    const msg = (e && e.message) ? e.message : String(e);
    return msg.startsWith('NG(') ? msg : `NG(UNKNOWN): ${msg}`;
  }
}

/**
 * 商品登録完了の通知を送信
 * @param {Object} form - 商品フォームデータ
 * @param {String} managementNumber - 管理番号
 */
function sendProductRegistrationNotification(form, managementNumber) {
  const debugLogs = [];

  function debugLog(message) {
    Logger.log(message);
    debugLogs.push(new Date().toLocaleTimeString('ja-JP') + ' - ' + message);
  }

  debugLog('[sendProductRegistrationNotification] 開始: ' + managementNumber);

  try {
    // 通知内容を作成
    const brandName = form['ブランド(英語)'] || form['ブランド(カナ)'] || '';
    const itemName = form['アイテム名'] || '';
    const category = form['大分類(カテゴリ)'] || form['大分類'] || '';
    const listingDestination = form['出品先'] || '';
    const listingAmount = form['出品金額'] || '';

    debugLog('[sendProductRegistrationNotification] データ取得完了');

    // 通知タイトル
    const title = '✅ 商品登録完了';

    // 通知本文
    let body = managementNumber ? `管理番号: ${managementNumber}` : '商品を登録しました';

    // ブランド名 + アイテム名
    if (brandName) {
      body += `\n${brandName}`;
    }

    if (itemName) {
      body += ` ${itemName}`;
    } else if (category) {
      body += ` ${category}`;
    }

    // 出品先
    if (listingDestination) {
      body += `\n出品先: ${listingDestination}`;
    }

    // 出品金額
    if (listingAmount) {
      const amount = Number(listingAmount);
      if (!isNaN(amount)) {
        body += `\n出品金額: ${amount.toLocaleString()}円`;
      }
    }

    debugLog('[sendProductRegistrationNotification] 通知本文作成完了');

    // FCM通知を送信（web_push.jsの関数を呼び出す）
    // 非同期で送信（商品登録処理をブロックしない）
    try {
      debugLog('[sendProductRegistrationNotification] sendFCMNotification確認中...');
      debugLog('[sendProductRegistrationNotification] typeof sendFCMNotification = ' + typeof sendFCMNotification);

      // sendFCMNotificationはweb_push.jsで定義されている
      if (typeof sendFCMNotification === 'function') {
        debugLog('[sendProductRegistrationNotification] sendFCMNotification呼び出し開始');
        sendFCMNotification(title, body);
        debugLog('[sendProductRegistrationNotification] sendFCMNotification呼び出し完了');
      } else {
        debugLog('[sendProductRegistrationNotification] ERROR: sendFCMNotification関数が見つかりません');
      }
    } catch (fcmError) {
      debugLog('[sendProductRegistrationNotification] FCM通知送信エラー: ' + fcmError);
      // エラーをスローしない（商品登録の成功には影響させない）
    }
    debugLog('[sendProductRegistrationNotification] 完了');

    // デバッグログをスプレッドシートに出力
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let debugSheet = ss.getSheetByName('デバッグログ');
      if (!debugSheet) {
        debugSheet = ss.insertSheet('デバッグログ');
        debugSheet.appendRow(['日時', '管理番号', 'ログ']);
      }
      debugSheet.appendRow([new Date(), managementNumber, debugLogs.join('\n')]);
    } catch (sheetError) {
      Logger.log('デバッグログシート書き込みエラー: ' + sheetError);
    }

  } catch (error) {
    debugLog('[sendProductRegistrationNotification] 外側エラー: ' + error);
    // デバッグログをスプレッドシートに出力（エラー時も）
    try {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      let debugSheet = ss.getSheetByName('デバッグログ');
      if (!debugSheet) {
        debugSheet = ss.insertSheet('デバッグログ');
        debugSheet.appendRow(['日時', '管理番号', 'ログ']);
      }
      debugSheet.appendRow([new Date(), managementNumber, debugLogs.join('\n') + '\nERROR: ' + error]);
    } catch (sheetError) {
      Logger.log('デバッグログシート書き込みエラー: ' + sheetError);
    }
    // エラーをスローしない
  }
}

// =============================================================================
// 管理番号生成関連は id.js に移動
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
// 管理番号生成（設定マスタ対応）
// =============================================================================
function generateManagementNumber(shelfCode, itemNumber) {
  const mgmtConfig = getManagementNumberConfig();
  const useShelf = mgmtConfig['棚番号使用'] === 'true';
  const padWidth = parseInt(mgmtConfig['商品番号桁数']) || DEFAULT_KEY_NUM_WIDTH;
  const separator = mgmtConfig['区切り文字'] || DEFAULT_SEPARATOR;
  const shelf = String(shelfCode || '').trim();
  const num = String(itemNumber || '').trim();

  if (num) {
    const paddedNum = String(Number(num)).padStart(padWidth, '0');
    if (useShelf && shelf) {
      return `${shelf}${separator}${paddedNum}`;
    } else {
      return paddedNum;
    }
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

  // === 登録者・更新者情報を記録 ===
  recordUserActivity(sh, targetRow, true); // true = 新規登録

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

/**
 * 商品登録完了通知を非同期で送信
 * saveProduct() から切り離すことで、保存処理の完了を早くする
 *
 * @param {Object} form - 商品フォームデータ
 * @param {string} managementNumber - 管理番号
 * @returns {string} 結果メッセージ
 */
function sendProductNotificationAsync(form, managementNumber) {
  const notifStart = new Date().getTime();
  try {
    console.log('[非同期通知] 通知送信開始:', managementNumber);
    sendProductRegistrationNotification(form, managementNumber);
    const notifEnd = new Date().getTime();
    console.log(`[PERF] 非同期通知送信完了: ${notifEnd - notifStart}ms`);
    return '通知送信完了';
  } catch (error) {
    console.error('[非同期通知] 送信エラー:', error);
    return `通知送信エラー: ${error.message}`;
  }
}

/**
 * 通知テスト関数 - GASエディタから直接実行
 */
function testNotification() {
  try {
    Logger.log('=== 通知テスト開始 ===');

    const testForm = {
      'ブランド(英語)': 'TEST BRAND',
      'アイテム名': 'テスト商品',
      '出品先': 'メルカリ',
      '出品金額': '10000'
    };

    Logger.log('テストデータ:', JSON.stringify(testForm));

    sendProductRegistrationNotification(testForm, 'TEST-001');

    Logger.log('=== 通知テスト完了 ===');
    return 'テスト完了 - ログと通知ログシートを確認してください';
  } catch (error) {
    Logger.log('=== 通知テストエラー ===');
    Logger.log('エラー:', error);
    Logger.log('スタックトレース:', error.stack);
    return 'エラー: ' + error.message;
  }
}

/**
 * saveProduct全体のテスト - 通知も含めて
 */
function testSaveProductWithNotification() {
  try {
    Logger.log('=== saveProductテスト開始 ===');

    const testForm = {
      '棚番号': 'AA',
      '商品番号': '9999',
      '担当者': 'テスト',
      'ブランド(英語)': 'TEST BRAND',
      'アイテム名': 'テスト商品',
      '出品先': 'メルカリ',
      '出品金額': '10000',
      '商品名(タイトル)': 'テスト用商品タイトル',
      '商品状態詳細': 'テスト用'
    };

    Logger.log('テストフォーム:', JSON.stringify(testForm));

    const result = saveProduct(testForm);

    Logger.log('saveProduct結果:', result);
    Logger.log('=== saveProductテスト完了 ===');
    Logger.log('通知が届いたか、通知ログシート（管理番号: AA-9999）を確認してください');

    return result;
  } catch (error) {
    Logger.log('=== saveProductテストエラー ===');
    Logger.log('エラー:', error);
    Logger.log('スタックトレース:', error.stack);
    return 'エラー: ' + error.message;
  }
}