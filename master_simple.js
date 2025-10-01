/**
 * 手動管理シート用のシンプルマスタデータ取得関数
 * 登録日、使用回数などの追跡機能なし
 */

// =================================
// 1. シンプルなマスタデータ取得
// =================================

/**
 * 統合マスタデータ取得（手動管理版）
 */
function getMasterData(fieldName) {
  try {
    // ブランド関連
    if (['ブランド(英語)', 'ブランド(カナ)'].includes(fieldName)) {
      return getBrandData(fieldName);
    }
    
    // アイテム分類関連
    if (['大分類', '中分類', '小分類', '細分類1', '細分類2', 'アイテム名'].includes(fieldName)) {
      return getItemCategoryData(fieldName);
    }
    
    // その他の動的マスタ（従来通り）
    return getDynamicMasterData(fieldName);
    
  } catch (error) {
    console.error(`マスタデータ取得エラー (${fieldName}):`, error);
    return [];
  }
}

/**
 * ブランドデータ取得
 */
function getBrandData(fieldName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const brandSheet = ss.getSheetByName('手動管理_ブランド');
  
  if (!brandSheet) {
    console.warn('手動管理_ブランドシートが見つかりません');
    return [];
  }
  
  const data = brandSheet.getDataRange().getValues();
  if (data.length <= 1) return []; // ヘッダーのみの場合
  
  const columnIndex = fieldName === 'ブランド(英語)' ? 0 : 1;
  
  const uniqueValues = new Set();
  for (let i = 1; i < data.length; i++) {
    const value = data[i][columnIndex];
    if (value && value.toString().trim()) {
      uniqueValues.add(value.toString().trim());
    }
  }
  
  return Array.from(uniqueValues).sort();
}

/**
 * アイテム分類データ取得
 */
function getItemCategoryData(fieldName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const itemSheet = ss.getSheetByName('手動管理_アイテム分類');
  
  if (!itemSheet) {
    console.warn('手動管理_アイテム分類シートが見つかりません');
    return [];
  }
  
  const columnMap = {
    '大分類': 0,
    '中分類': 1,
    '小分類': 2,
    '細分類1': 3,
    '細分類2': 4,
    'アイテム名': 5
  };
  
  const columnIndex = columnMap[fieldName];
  if (columnIndex === undefined) {
    console.warn(`未対応のフィールド名: ${fieldName}`);
    return [];
  }
  
  const data = itemSheet.getDataRange().getValues();
  if (data.length <= 1) return []; // ヘッダーのみの場合
  
  const uniqueValues = new Set();
  for (let i = 1; i < data.length; i++) {
    const value = data[i][columnIndex];
    if (value && value.toString().trim()) {
      uniqueValues.add(value.toString().trim());
    }
  }
  
  return Array.from(uniqueValues).sort();
}

/**
 * 動的マスタデータ取得（従来通り）
 */
function getDynamicMasterData(fieldName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const masterSheet = ss.getSheetByName('マスタデータ');
  
  if (!masterSheet) {
    console.warn('マスタデータシートが見つかりません');
    return [];
  }
  
  const data = masterSheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  
  const headers = data[0];
  const fieldIndex = headers.indexOf(fieldName);
  
  if (fieldIndex === -1) {
    console.warn(`フィールド '${fieldName}' が見つかりません`);
    return [];
  }
  
  const uniqueValues = new Set();
  for (let i = 1; i < data.length; i++) {
    const value = data[i][fieldIndex];
    if (value && value.toString().trim()) {
      uniqueValues.add(value.toString().trim());
    }
  }
  
  return Array.from(uniqueValues).sort();
}

// =================================
// 2. UI用データ提供関数
// =================================

/**
 * プルダウンメニュー用データ生成
 */
function getDropdownData(fieldName) {
  return getMasterData(fieldName);
}

/**
 * 商品登録用ブランドリスト取得
 */
function getBrandList() {
  return {
    english: getBrandData('ブランド(英語)'),
    kana: getBrandData('ブランド(カナ)')
  };
}

/**
 * 商品登録用アイテム分類リスト取得
 */
function getItemCategoryList() {
  return {
    major: getItemCategoryData('大分類'),
    middle: getItemCategoryData('中分類'),
    minor: getItemCategoryData('小分類'),
    sub1: getItemCategoryData('細分類1'),
    sub2: getItemCategoryData('細分類2'),
    items: getItemCategoryData('アイテム名')
  };
}

// =================================
// 3. 診断・確認機能
// =================================

/**
 * 手動管理シートの状況確認
 */
function checkManualMasterSheets() {
  console.log('=== 手動管理シート状況確認 ===');
  
  const results = {
    brand: {
      english: getBrandData('ブランド(英語)').length,
      kana: getBrandData('ブランド(カナ)').length
    },
    itemCategory: {
      major: getItemCategoryData('大分類').length,
      middle: getItemCategoryData('中分類').length,
      minor: getItemCategoryData('小分類').length,
      sub1: getItemCategoryData('細分類1').length,
      sub2: getItemCategoryData('細分類2').length,
      items: getItemCategoryData('アイテム名').length
    }
  };
  
  console.log('ブランド(英語):', results.brand.english + '件');
  console.log('ブランド(カナ):', results.brand.kana + '件');
  console.log('大分類:', results.itemCategory.major + '件');
  console.log('中分類:', results.itemCategory.middle + '件');
  console.log('小分類:', results.itemCategory.minor + '件');
  console.log('細分類1:', results.itemCategory.sub1 + '件');
  console.log('細分類2:', results.itemCategory.sub2 + '件');
  console.log('アイテム名:', results.itemCategory.items + '件');
  
  return results;
}

/**
 * サンプルデータ表示
 */
function showSampleData() {
  console.log('=== サンプルデータ ===');
  
  console.log('ブランド(英語) 最初の5件:');
  getBrandData('ブランド(英語)').slice(0, 5).forEach(item => console.log('  ' + item));
  
  console.log('大分類 最初の5件:');
  getItemCategoryData('大分類').slice(0, 5).forEach(item => console.log('  ' + item));
  
  console.log('アイテム名 最初の5件:');
  getItemCategoryData('アイテム名').slice(0, 5).forEach(item => console.log('  ' + item));
}

// =================================
// 4. 使用方法ガイド
// =================================

function showUsageGuide() {
  console.log('=== 手動管理マスタデータ使用方法 ===');
  console.log('');
  console.log('📋 基本的な使用方法:');
  console.log('  getMasterData("ブランド(英語)")  // ブランドの英語名リスト取得');
  console.log('  getMasterData("大分類")         // 大分類リスト取得');
  console.log('  getMasterData("アイテム名")      // アイテム名リスト取得');
  console.log('');
  console.log('🔍 確認・診断:');
  console.log('  checkManualMasterSheets()     // 各シートの件数確認');
  console.log('  showSampleData()              // サンプルデータ表示');
  console.log('');
  console.log('🎯 UI用データ取得:');
  console.log('  getBrandList()                // ブランドデータ一式取得');
  console.log('  getItemCategoryList()         // アイテム分類データ一式取得');
  console.log('');
  console.log('✅ 準備完了！手動でシートを整理した後、確認してください');
}

// 初期表示
showUsageGuide();