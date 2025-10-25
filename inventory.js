/**
 * inventory.gs（大幅拡張版） - 在庫管理の中核機能
 * 商品検索、販売情報更新、利益計算を統合
 */

// =============================================================================
// 在庫管理用定数
// =============================================================================
const INVENTORY_HEADERS = {
  key: '管理番号',
  person: '担当者',
  status: 'ステータス',
  saleDate: '販売日',
  saleDestination: '販売先',
  saleAmount: '販売金額',
  shippingMethod: '発送方法',
  packagingMaterial: '梱包資材',
  packagingCost: '梱包資材費',
  shippingCost: '送料',
  platformFee: '販売手数料',
  profit: '利益',
  profitRate: '利益率'
};

const INVENTORY_START_ROW = 2;

// =============================================================================
// 統計情報専用シート管理（パフォーマンス最適化）
// =============================================================================
const STATS_SHEET_NAME = '統計情報';

/**
 * 統計情報シートを取得または作成
 */
function getStatsSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let statsSheet = ss.getSheetByName(STATS_SHEET_NAME);
  
  if (!statsSheet) {
    statsSheet = ss.insertSheet(STATS_SHEET_NAME);
    initializeStatsSheet(statsSheet);
    Logger.log('[統計] 統計情報シートを新規作成しました');
  }
  
  return statsSheet;
}

/**
 * 統計情報シートの初期化
 */
function initializeStatsSheet(sheet) {
  // ヘッダー行
  sheet.appendRow(['項目', '値', '最終更新日時']);
  
  // ステータス別件数
  sheet.appendRow(['登録済み', 0, new Date()]);
  sheet.appendRow(['出品準備中', 0, new Date()]);
  sheet.appendRow(['出品中', 0, new Date()]);
  sheet.appendRow(['販売済み', 0, new Date()]);
  sheet.appendRow(['取り下げ', 0, new Date()]);
  sheet.appendRow(['合計', 0, new Date()]);
  
  // 金額集計
  sheet.appendRow(['総仕入金額', 0, new Date()]);
  sheet.appendRow(['総出品金額', 0, new Date()]);
  sheet.appendRow(['総販売金額', 0, new Date()]);
  sheet.appendRow(['総利益金額', 0, new Date()]);
  
  // 在庫日数
  sheet.appendRow(['総在庫日数', 0, new Date()]);
  sheet.appendRow(['在庫日数カウント', 0, new Date()]);
  
  // フォーマット
  const range = sheet.getRange(1, 1, sheet.getLastRow(), 3);
  range.setFontSize(10);
  sheet.getRange('A1:C1').setFontWeight('bold').setBackground('#4285f4').setFontColor('#ffffff');
  sheet.setColumnWidth(1, 150);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 180);
  
  Logger.log('[統計] 統計情報シートを初期化しました');
}

/**
 * 統計情報シートから値を取得
 */
function getStatsValue(itemName) {
  try {
    const sheet = getStatsSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === itemName) {
        return Number(data[i][1]) || 0;
      }
    }
    
    return 0;
  } catch (error) {
    Logger.log(`[統計] 値取得エラー (${itemName}): ${error.message}`);
    return 0;
  }
}

/**
 * 統計情報シートから全ての値を一度に取得（最適化版）
 * 1回のシート読み込みで全統計を取得
 */
function getAllStatsValues() {
  try {
    const sheet = getStatsSheet();
    const data = sheet.getDataRange().getValues();
    
    const stats = {};
    for (let i = 1; i < data.length; i++) {
      const itemName = data[i][0];
      const value = Number(data[i][1]) || 0;
      stats[itemName] = value;
    }
    
    return stats;
  } catch (error) {
    Logger.log(`[統計] 全値取得エラー: ${error.message}`);
    return {};
  }
}

/**
 * 統計情報シートの値を更新
 */
function setStatsValue(itemName, value) {
  try {
    const sheet = getStatsSheet();
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === itemName) {
        sheet.getRange(i + 1, 2).setValue(value);
        sheet.getRange(i + 1, 3).setValue(new Date());
        return true;
      }
    }
    
    Logger.log(`[統計] 項目が見つかりません: ${itemName}`);
    return false;
  } catch (error) {
    Logger.log(`[統計] 値更新エラー (${itemName}): ${error.message}`);
    return false;
  }
}

/**
 * 統計情報を増加
 */
function incrementStats(itemName, amount = 1) {
  const currentValue = getStatsValue(itemName);
  setStatsValue(itemName, currentValue + amount);
}

/**
 * 統計情報を減少
 */
function decrementStats(itemName, amount = 1) {
  const currentValue = getStatsValue(itemName);
  setStatsValue(itemName, Math.max(0, currentValue - amount));
}

/**
 * 商品のステータス変更時の統計更新
 */
function updateStatsOnStatusChange(oldStatus, newStatus, productData) {
  Logger.log(`[統計] ステータス変更: ${oldStatus} → ${newStatus}`);
  
  // 旧ステータスから減算
  if (oldStatus) {
    decrementStats(oldStatus, 1);
    decrementStats('合計', 1);
    
    // 金額の減算
    const purchaseAmount = Number(productData.purchaseAmount) || 0;
    decrementStats('総仕入金額', purchaseAmount);
    
    if (oldStatus === '出品中' || oldStatus === '販売済み') {
      const listingAmount = Number(productData.listingAmount) || 0;
      decrementStats('総出品金額', listingAmount);
    }
    
    if (oldStatus === '販売済み') {
      const saleAmount = Number(productData.saleAmount) || 0;
      const profit = Number(productData.profit) || 0;
      const inventoryDays = Number(productData.inventoryDays) || 0;
      
      decrementStats('総販売金額', saleAmount);
      decrementStats('総利益金額', profit);
      
      if (inventoryDays > 0) {
        decrementStats('総在庫日数', inventoryDays);
        decrementStats('在庫日数カウント', 1);
      }
    }
  }
  
  // 新ステータスに加算
  if (newStatus) {
    incrementStats(newStatus, 1);
    incrementStats('合計', 1);
    
    // 金額の加算
    const purchaseAmount = Number(productData.purchaseAmount) || 0;
    incrementStats('総仕入金額', purchaseAmount);
    
    if (newStatus === '出品中' || newStatus === '販売済み') {
      const listingAmount = Number(productData.listingAmount) || 0;
      incrementStats('総出品金額', listingAmount);
    }
    
    if (newStatus === '販売済み') {
      const saleAmount = Number(productData.saleAmount) || 0;
      const profit = Number(productData.profit) || 0;
      const inventoryDays = Number(productData.inventoryDays) || 0;
      
      incrementStats('総販売金額', saleAmount);
      incrementStats('総利益金額', profit);
      
      if (inventoryDays > 0) {
        incrementStats('総在庫日数', inventoryDays);
        incrementStats('在庫日数カウント', 1);
      }
    }
  }
}

/**
 * 統計情報を全て再計算（初期化用または整合性チェック用）
 */

/**
 * 金額文字列を数値に変換（¥記号とカンマを除去）
 * 例: "¥2,980" → 2980
 */
function parseAmount(value) {
  if (!value) return 0;
  
  // 既に数値の場合
  if (typeof value === 'number') return value;
  
  // 文字列の場合、¥記号とカンマを除去して数値に変換
  const cleaned = String(value).replace(/[¥,]/g, '');
  const num = Number(cleaned);
  
  return isNaN(num) ? 0 : num;
}

function recalculateAllStats() {
  const startTime = new Date().getTime();
  Logger.log('[統計] 全統計情報の再計算を開始');
  
  try {
    const sh = getSheet();
    const lastRow = sh.getLastRow();
    
    if (lastRow < INVENTORY_START_ROW) {
      Logger.log('[統計] データが存在しないため、統計をゼロリセット');
      initializeStatsSheet(getStatsSheet());
      return { success: true, message: '統計をゼロリセットしました' };
    }
    
    const { map } = getHeaderMapCommon();
    const managementCol = colByName(sh, INVENTORY_HEADERS.key);
    
    // 統計変数
    const statusCounts = {
      '登録済み': 0,
      '出品準備中': 0,
      '出品中': 0,
      '販売済み': 0,
      '取り下げ': 0
    };
    let total = 0;
    let totalPurchaseAmount = 0;
    let totalListingAmount = 0;
    let totalSaleAmount = 0;
    let totalProfit = 0;
    let totalInventoryDays = 0;
    let inventoryDaysCount = 0;
    
    // 全商品をスキャン
    for (let row = INVENTORY_START_ROW; row <= lastRow; row++) {
      const managementNumber = getCellValue(sh, row, managementCol);
      if (!managementNumber) continue;
      
      total++;
      
      const status = getCellValue(sh, row, map['ステータス']);
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      }
      
      const purchaseAmount = parseAmount(getCellValue(sh, row, map['仕入金額']));
      const listingAmount = parseAmount(getCellValue(sh, row, map['出品金額']));
      const saleAmount = parseAmount(getCellValue(sh, row, map['販売金額']));
      const profit = parseAmount(getCellValue(sh, row, map['利益金額']));
      
      totalPurchaseAmount += purchaseAmount;
      
      if (status === '出品中' || status === '販売済み') {
        totalListingAmount += listingAmount;
      }
      
      if (status === '販売済み') {
        totalSaleAmount += saleAmount;
        totalProfit += profit;
        
        const inventoryDays = parseAmount(getCellValue(sh, row, map['在庫日数']));
        if (inventoryDays > 0) {
          totalInventoryDays += inventoryDays;
          inventoryDaysCount++;
        }
      }
    }
    
    // 統計シートに書き込み
    setStatsValue('登録済み', statusCounts['登録済み']);
    setStatsValue('出品準備中', statusCounts['出品準備中']);
    setStatsValue('出品中', statusCounts['出品中']);
    setStatsValue('販売済み', statusCounts['販売済み']);
    setStatsValue('取り下げ', statusCounts['取り下げ']);
    setStatsValue('合計', total);
    setStatsValue('総仕入金額', totalPurchaseAmount);
    setStatsValue('総出品金額', totalListingAmount);
    setStatsValue('総販売金額', totalSaleAmount);
    setStatsValue('総利益金額', totalProfit);
    setStatsValue('総在庫日数', totalInventoryDays);
    setStatsValue('在庫日数カウント', inventoryDaysCount);
    
    const endTime = new Date().getTime();
    const duration = endTime - startTime;
    
    Logger.log(`[統計] 再計算完了: ${total}件, ${duration}ms`);
    
    return {
      success: true,
      message: `統計情報を再計算しました（${total}件の商品、${duration}ms）`,
      stats: {
        total: total,
        statusCounts: statusCounts,
        totalPurchaseAmount: totalPurchaseAmount,
        totalListingAmount: totalListingAmount,
        totalSaleAmount: totalSaleAmount,
        totalProfit: totalProfit,
        averageInventoryDays: inventoryDaysCount > 0 ? Math.round(totalInventoryDays / inventoryDaysCount) : 0
      }
    };
    
  } catch (error) {
    Logger.log(`[統計] 再計算エラー: ${error.message}`);
    return {
      success: false,
      error: `統計再計算エラー: ${error.message}`
    };
  }
}

/**
 * 旧ステータスから新ステータスへの一括移行（1回のみ実行）
 * 「在庫」→「登録済み」
 * 「販売」→「販売済み」
 */
function migrateOldStatusToNew() {
  const startTime = new Date().getTime();
  Logger.log('[移行] ステータス移行を開始');
  
  try {
    const sh = getSheet();
    const lastRow = sh.getLastRow();
    
    if (lastRow < INVENTORY_START_ROW) {
      Logger.log('[移行] データが存在しません');
      return;
    }
    
    const { map } = getHeaderMapCommon();
    const statusCol = map['ステータス'];
    
    if (!statusCol) {
      Logger.log('[移行] エラー: ステータス列が見つかりません');
      return;
    }
    
    let migratedCount = 0;
    let skippedCount = 0;
    
    // 全行をスキャンして移行
    for (let row = INVENTORY_START_ROW; row <= lastRow; row++) {
      const currentStatus = getCellValue(sh, row, statusCol);
      
      if (!currentStatus) {
        skippedCount++;
        continue;
      }
      
      let newStatus = null;
      
      // マッピング
      if (currentStatus === '在庫') {
        newStatus = '登録済み';
      } else if (currentStatus === '販売') {
        newStatus = '販売済み';
      }
      
      // 移行
      if (newStatus) {
        sh.getRange(row, statusCol).setValue(newStatus);
        migratedCount++;
        
        if (migratedCount % 10 === 0) {
          Logger.log(`[移行] 進捗: ${migratedCount}件移行完了`);
        }
      } else {
        skippedCount++;
      }
    }
    
    const endTime = new Date().getTime();
    Logger.log(`[移行] 完了: ${migratedCount}件移行、${skippedCount}件スキップ、${endTime - startTime}ms`);
    Logger.log('[移行] 次に recalculateAllStats() を実行してください');
    
    return {
      migrated: migratedCount,
      skipped: skippedCount,
      duration: endTime - startTime
    };
    
  } catch (error) {
    Logger.log(`[移行] エラー: ${error.message}`);
    throw error;
  }
}

/**
 * ステータス列のデータ入力規則（プルダウン）を更新
 * 新しい5つのステータスに対応
 */
function updateStatusValidation() {
  const startTime = new Date().getTime();
  Logger.log('[設定] ステータス列のプルダウン設定を更新開始');

  try {
    const sh = getSheet();
    const { map } = getHeaderMapCommon();
    const statusCol = map['ステータス'];

    if (!statusCol) {
      Logger.log('[設定] エラー: ステータス列が見つかりません');
      return { success: false, error: 'ステータス列が見つかりません' };
    }

    // 新しいステータス一覧
    const newStatuses = ['登録済み', '出品準備中', '出品中', '販売済み', '取り下げ'];

    // データ入力規則を作成
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(newStatuses, true) // true = ドロップダウンを表示
      .setAllowInvalid(false) // 無効な値を許可しない
      .build();

    // ステータス列全体に適用（2行目以降、1000行まで）
    const lastRow = Math.max(sh.getLastRow(), 1000); // 最低1000行分を設定
    const range = sh.getRange(INVENTORY_START_ROW, statusCol, lastRow - INVENTORY_START_ROW + 1, 1);
    range.setDataValidation(rule);

    const endTime = new Date().getTime();
    Logger.log(`[設定] ステータス列のプルダウン設定完了: ${newStatuses.join(', ')} (${endTime - startTime}ms)`);

    return {
      success: true,
      statuses: newStatuses,
      message: 'ステータス列のプルダウン設定を更新しました'
    };

  } catch (error) {
    Logger.log(`[設定] エラー: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * デバッグ用：ヘッダーマップの内容を確認
 */
function debugHeaderMap() {
  const { map } = getHeaderMapCommon();
  
  Logger.log('=== ヘッダーマップの内容 ===');
  Logger.log(JSON.stringify(map, null, 2));
  
  // 特に重要なフィールドを確認
  const importantFields = ['仕入金額', '出品金額', '販売金額', '利益金額', 'ステータス'];
  Logger.log('\n=== 重要フィールドの確認 ===');
  for (const field of importantFields) {
    if (map[field]) {
      Logger.log(`✅ ${field}: 列番号 ${map[field]}`);
    } else {
      Logger.log(`❌ ${field}: マップに存在しません`);
    }
  }
  
  // 実際にデータを取得してみる（2～6行目）
  const sh = getSheet();
  Logger.log('\n=== 実際のデータ（2～6行目） ===');
  for (let row = 2; row <= 6; row++) {
    const status = getCellValue(sh, row, map['ステータス']);
    const purchase = getCellValue(sh, row, map['仕入金額']);
    const listing = getCellValue(sh, row, map['出品金額']);
    const sale = getCellValue(sh, row, map['販売金額']);
    const profit = getCellValue(sh, row, map['利益金額']);
    
    Logger.log(`行${row}: ステータス="${status}", 仕入=${purchase}, 出品=${listing}, 販売=${sale}, 利益=${profit}`);
  }
}

/**
 * デバッグ用：統計シート読み込みのパフォーマンステスト
 */
function testStatsPerformance() {
  Logger.log('=== 統計シートパフォーマンステスト ===');
  
  // テスト1: getAllStatsValues()の速度
  const start1 = new Date().getTime();
  const allStats = getAllStatsValues();
  const end1 = new Date().getTime();
  Logger.log(`✅ getAllStatsValues(): ${end1 - start1}ms`);
  Logger.log(`   統計項目数: ${Object.keys(allStats).length}`);
  Logger.log(`   合計: ${allStats['合計']}`);
  Logger.log(`   販売済み: ${allStats['販売済み']}`);
  Logger.log(`   総利益金額: ${allStats['総利益金額']}`);
  
  // テスト2: 統計シート自体の取得速度
  const start2 = new Date().getTime();
  const statsSheet = getStatsSheet();
  const end2 = new Date().getTime();
  Logger.log(`\n✅ getStatsSheet(): ${end2 - start2}ms`);
  
  // テスト3: 統計シートのデータ範囲取得速度
  const start3 = new Date().getTime();
  const data = statsSheet.getDataRange().getValues();
  const end3 = new Date().getTime();
  Logger.log(`✅ getDataRange().getValues(): ${end3 - start3}ms`);
  Logger.log(`   行数: ${data.length}`);
  
  // テスト4: 在庫シート取得速度（比較用）
  const start4 = new Date().getTime();
  const sh = getSheet();
  const lastRow = sh.getLastRow();
  const end4 = new Date().getTime();
  Logger.log(`\n✅ getSheet() + getLastRow(): ${end4 - start4}ms`);
  Logger.log(`   総行数: ${lastRow}`);
  
  Logger.log('\n=== テスト完了 ===');
}

/**
 * デバッグ用：getInventoryDashboardAPIを直接テスト
 */
function testGetInventoryDashboard() {
  Logger.log('=== getInventoryDashboardAPI テスト ===');
  
  try {
    const result = getInventoryDashboardAPI({
      status: '',
      page: 1,
      perPage: 10
    });
    
    // ContentServiceのTextOutputから実際のJSONを取得
    const content = result.getContent();
    Logger.log('結果:');
    Logger.log(content);
    
    // パース して確認
    const parsed = JSON.parse(content);
    Logger.log('\n統計情報:');
    Logger.log('合計: ' + parsed.data.statistics.total);
    Logger.log('登録済み: ' + parsed.data.statistics.statusCounts.registered);
    Logger.log('販売済み: ' + parsed.data.statistics.statusCounts.sold);
    Logger.log('総利益: ' + parsed.data.statistics.totalProfit);
    Logger.log('\n商品件数: ' + parsed.data.products.length);
    
  } catch (error) {
    Logger.log('エラー: ' + error.message);
    Logger.log('スタックトレース: ' + error.stack);
  }
}

// =============================================================================
// 商品検索・ジャンプ機能（既存改良）
// =============================================================================
function jumpToRowByCode(code) {
  const searchCode = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}-\d+$/.test(searchCode)) {
    return 'NG: 管理番号は AA-1234 の形式で入力してください';
  }
  
  try {
    const sh = getSheet();
    const productInfo = findProductByManagementNumber(searchCode);
    
    if (!productInfo.found) {
      return `NG: "${searchCode}" は見つかりません`;
    }
    
    // セル選択をジャンプ
    try {
      sh.setActiveRange(sh.getRange(productInfo.row, productInfo.col));
    } catch(_) {}
    
    return `OK: ${searchCode} → ${productInfo.row}行目へ移動しました`;
    
  } catch (error) {
    return `NG: エラーが発生しました - ${error.message}`;
  }
}

// =============================================================================
// 商品検索共通ロジック
// =============================================================================
function findProductByManagementNumber(managementNumber) {
  const sh = getSheet();
  const keyCol = colByName(sh, INVENTORY_HEADERS.key);
  
  if (!keyCol) {
    return { 
      found: false, 
      error: `見出し「${INVENTORY_HEADERS.key}」の列が見つかりません` 
    };
  }
  
  const lastRow = sh.getLastRow();
  if (lastRow < INVENTORY_START_ROW) {
    return { found: false, error: 'データがありません' };
  }
  
  const searchCode = String(managementNumber).trim().toUpperCase();
  const vals = sh.getRange(INVENTORY_START_ROW, keyCol, lastRow - INVENTORY_START_ROW + 1, 1)
    .getDisplayValues().map(r => String(r[0]).trim().toUpperCase());
  
  const idx = vals.indexOf(searchCode);
  if (idx === -1) {
    return { found: false, error: '該当する管理番号が見つかりません' };
  }
  
  const row = INVENTORY_START_ROW + idx;
  return { 
    found: true, 
    row: row, 
    col: keyCol,
    managementNumber: searchCode
  };
}

// =============================================================================
// 商品情報取得
// =============================================================================
function getProductInfo(managementNumber) {
  try {
    const productLocation = findProductByManagementNumber(managementNumber);
    if (!productLocation.found) {
      return { success: false, error: productLocation.error };
    }
    
    const sh = getSheet();
    const { map } = getHeaderMapCommon();
    const row = productLocation.row;
    
    // 基本情報取得
    const productInfo = {
      managementNumber: managementNumber,
      row: row,
      // 基本情報
      person: getCellValue(sh, row, map['担当者']),
      category: getCellValue(sh, row, map['大分類(カテゴリ)']),
      brand: getCellValue(sh, row, map['ブランド(英語)']),
      itemName: getCellValue(sh, row, map['アイテム名']),
      size: getCellValue(sh, row, map['サイズ']),
      condition: getCellValue(sh, row, map['商品の状態']),
      
      // 仕入情報
      purchaseDate: getCellValue(sh, row, map['仕入日']),
      purchaseSource: getCellValue(sh, row, map['仕入先']),
      purchaseAmount: getCellValue(sh, row, map['仕入金額']),
      
      // 出品情報
      listingDate: getCellValue(sh, row, map['出品日']),
      listingDestination: getCellValue(sh, row, map['出品先']),
      listingAmount: getCellValue(sh, row, map['出品金額']),
      
      // 販売情報
      saleDate: getCellValue(sh, row, map['販売日']),
      saleDestination: getCellValue(sh, row, map['販売先']),
      saleAmount: getCellValue(sh, row, map['販売金額']),
      
      // 配送・梱包情報
      shippingMethod: getCellValue(sh, row, map['発送方法']),
      packagingMaterial: getCellValue(sh, row, map['梱包資材']),
      packagingCost: getCellValue(sh, row, map['梱包資材費']),
      shippingCost: getCellValue(sh, row, map['送料']),
      
      // 手数料・利益
      platformFee: getCellValue(sh, row, map['販売手数料']),
      profit: getCellValue(sh, row, map['利益']),
      profitRate: getCellValue(sh, row, map['利益率'])
    };
    
    return { success: true, data: productInfo };
    
  } catch (error) {
    return { 
      success: false, 
      error: `商品情報取得エラー: ${error.message}` 
    };
  }
}

// =============================================================================
// 販売情報更新
// =============================================================================
function updateSaleInfo(managementNumber, saleData) {
  try {
    const productLocation = findProductByManagementNumber(managementNumber);
    if (!productLocation.found) {
      return `NG: ${productLocation.error}`;
    }
    
    const sh = getSheet();
    const { map } = getHeaderMapCommon();
    const row = productLocation.row;
    
    // 販売情報の更新
    const updateFields = {
      '販売日': saleData.saleDate,
      '販売先': saleData.saleDestination, 
      '販売金額': saleData.saleAmount
    };
    
    for (const [fieldName, value] of Object.entries(updateFields)) {
      if (value !== undefined && value !== '') {
        const col = map[fieldName];
        if (col) {
          const cellValue = fieldName === '販売金額' ? Number(value) || 0 : value;
          sh.getRange(row, col).setValue(cellValue);
        }
      }
    }
    
    // ステータス更新（販売完了）
    const statusCol = map['ステータス'];
    if (statusCol && saleData.saleAmount) {
      sh.getRange(row, statusCol).setValue('販売完了');
    }
    
    return `OK: ${managementNumber} の販売情報を更新しました`;
    
  } catch (error) {
    return `NG: 販売情報更新エラー - ${error.message}`;
  }
}

// =============================================================================
// 発送・梱包情報更新
// =============================================================================
function updateShippingInfo(managementNumber, shippingData) {
  try {
    const productLocation = findProductByManagementNumber(managementNumber);
    if (!productLocation.found) {
      return `NG: ${productLocation.error}`;
    }
    
    const sh = getSheet();
    const { map } = getHeaderMapCommon();
    const row = productLocation.row;
    
    // 発送・梱包情報の更新
    const updateFields = {
      '発送方法': shippingData.shippingMethod,
      '梱包資材': shippingData.packagingMaterial,
      '梱包資材費': shippingData.packagingCost,
      '送料': shippingData.shippingCost
    };
    
    for (const [fieldName, value] of Object.entries(updateFields)) {
      if (value !== undefined && value !== '') {
        const col = map[fieldName];
        if (col) {
          const cellValue = ['梱包資材費', '送料'].includes(fieldName) 
            ? Number(value) || 0 
            : value;
          sh.getRange(row, col).setValue(cellValue);
        }
      }
    }
    
    // 利益計算の再実行
    recalculateProfit(managementNumber);
    
    return `OK: ${managementNumber} の発送情報を更新しました`;
    
  } catch (error) {
    return `NG: 発送情報更新エラー - ${error.message}`;
  }
}

// =============================================================================
// 利益計算（自動計算）
// =============================================================================
function recalculateProfit(managementNumber) {
  try {
    const productInfo = getProductInfo(managementNumber);
    if (!productInfo.success) {
      return false;
    }
    
    const data = productInfo.data;
    const sh = getSheet();
    const { map } = getHeaderMapCommon();
    const row = data.row;
    
    // 利益計算
    const saleAmount = Number(data.saleAmount) || 0;
    const purchaseAmount = Number(data.purchaseAmount) || 0;
    const packagingCost = Number(data.packagingCost) || 0;
    const shippingCost = Number(data.shippingCost) || 0;
    const platformFee = Number(data.platformFee) || 0;
    
    const totalCost = purchaseAmount + packagingCost + shippingCost + platformFee;
    const profit = saleAmount - totalCost;
    const profitRate = saleAmount > 0 ? (profit / saleAmount) * 100 : 0;
    
    // 結果をシートに書き込み
    const profitCol = map['利益'];
    const profitRateCol = map['利益率'];
    
    if (profitCol) {
      sh.getRange(row, profitCol).setValue(profit);
    }
    
    if (profitRateCol) {
      sh.getRange(row, profitRateCol).setValue(profitRate);
    }
    
    return true;
    
  } catch (error) {
    console.error('利益計算エラー:', error);
    return false;
  }
}

// =============================================================================
// 一括ステータス更新
// =============================================================================
function updateProductStatus(managementNumber, newStatus) {
  try {
    const productLocation = findProductByManagementNumber(managementNumber);
    if (!productLocation.found) {
      return `NG: ${productLocation.error}`;
    }
    
    const sh = getSheet();
    const { map } = getHeaderMapCommon();
    const statusCol = map['ステータス'];
    
    if (!statusCol) {
      return 'NG: ステータス列が見つかりません';
    }
    
    sh.getRange(productLocation.row, statusCol).setValue(newStatus);
    
    // セル選択をジャンプ
    try {
      sh.setActiveRange(sh.getRange(productLocation.row, productLocation.col));
    } catch(_) {}
    
    return `OK: ${managementNumber} のステータスを「${newStatus}」に更新しました`;
    
  } catch (error) {
    return `NG: ステータス更新エラー - ${error.message}`;
  }
}

// =============================================================================
// ユーティリティ関数
// =============================================================================
function getCellValue(sheet, row, col) {
  if (!col || col < 1) return '';
  try {
    return sheet.getRange(row, col).getDisplayValue() || '';
  } catch (error) {
    return '';
  }
}

// =============================================================================
// 在庫一覧取得（将来の分析機能用）
// =============================================================================
function getInventoryList(filters = {}) {
  try {
    const sh = getSheet();
    const lastRow = sh.getLastRow();

    if (lastRow < INVENTORY_START_ROW) {
      return { success: true, data: [] };
    }

    const { map } = getHeaderMapCommon();
    const managementCol = colByName(sh, INVENTORY_HEADERS.key);

    const inventoryList = [];

    for (let row = INVENTORY_START_ROW; row <= lastRow; row++) {
      const managementNumber = getCellValue(sh, row, managementCol);
      if (!managementNumber) continue;

      const productInfo = {
        managementNumber: managementNumber,
        person: getCellValue(sh, row, map['担当者']),
        category: getCellValue(sh, row, map['大分類(カテゴリ)']),
        brand: getCellValue(sh, row, map['ブランド(英語)']),
        saleAmount: getCellValue(sh, row, map['販売金額']),
        profit: getCellValue(sh, row, map['利益']),
        status: getCellValue(sh, row, map['ステータス'])
      };

      // フィルター適用（将来拡張）
      if (filters.status && productInfo.status !== filters.status) continue;
      if (filters.person && productInfo.person !== filters.person) continue;

      inventoryList.push(productInfo);
    }

    return { success: true, data: inventoryList };

  } catch (error) {
    return {
      success: false,
      error: `在庫一覧取得エラー: ${error.message}`
    };
  }
}

// =============================================================================
// Phase 1: Web App API エンドポイント（Agent SDK準備）
// =============================================================================

/**
 * Web App API エンドポイント - 在庫管理システム用
 * デプロイ: ウェブアプリとして公開 → URLを取得
 * 使用例: https://script.google.com/.../exec?action=search_inventory&status=在庫中
 */
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (!action) {
      return jsonErrorResponse('actionパラメータが必要です');
    }

    // Phase 1: 今すぐ実装するエンドポイント
    switch(action) {
      case 'search_inventory':
        return searchInventoryAPI(e.parameter);

      case 'get_product':
        return getProductAPI(e.parameter.managementNumber);

      case 'update_product':
        return updateProductAPI(e.parameter);

      case 'get_statistics':
        return getStatisticsAPI(e.parameter);

      default:
        return jsonErrorResponse(`未対応のアクション: ${action}`);
    }

    // Phase 4: 将来実装するエンドポイント（コメントアウト）
    // case 'ai_analyze':
    //   return aiAnalyzeInventoryAPI(e.parameter);
    // case 'ai_suggest_price':
    //   return aiSuggestPriceAPI(e.parameter);
    // case 'bulk_update':
    //   return bulkUpdateAPI(e.parameter);

  } catch (error) {
    return jsonErrorResponse(`システムエラー: ${error.message}`);
  }
}

// =============================================================================
// API ハンドラー関数
// =============================================================================

/**
 * 在庫検索API
 * パラメータ: status, brand, category, person
 */
function searchInventoryAPI(params) {
  try {
    // フィルタ条件
    const filters = {
      status: params.status || '', // 複数選択対応（カンマ区切り）
      brand: params.brand || '',
      category: params.category || '',
      person: params.person || '',
      size: params.size || '',
      color: params.color || '',
      searchText: params.searchText || '', // 管理番号・商品名の部分一致検索
      dateFrom: params.dateFrom || '', // 日付範囲（仕入日、出品日等）
      dateTo: params.dateTo || '',
      dateType: params.dateType || 'purchase' // purchase, listing, sale
    };

    // ページネーション
    const page = parseInt(params.page) || 1;
    const perPage = parseInt(params.perPage) || 50;

    // ソート
    const sortBy = params.sortBy || 'registeredAt'; // registeredAt, listingDate, saleDate, profit
    const sortOrder = params.sortOrder || 'desc'; // asc, desc

    const sh = getSheet();
    const lastRow = sh.getLastRow();

    if (lastRow < INVENTORY_START_ROW) {
      return jsonSuccessResponse({ 
        products: [], 
        count: 0,
        totalCount: 0,
        page: page,
        perPage: perPage,
        totalPages: 0
      });
    }

    const { map } = getHeaderMapCommon();
    const managementCol = colByName(sh, INVENTORY_HEADERS.key);

    const allResults = [];

    // ステータスフィルタ（複数選択対応）
    const statusFilters = Array.isArray(filters.statuses) ? filters.statuses : [];

    for (let row = INVENTORY_START_ROW; row <= lastRow; row++) {
      const managementNumber = getCellValue(sh, row, managementCol);
      if (!managementNumber) continue;

      // 基本情報取得
      const status = getCellValue(sh, row, map['ステータス']);
      const brand = getCellValue(sh, row, map['ブランド(英語)']);
      const category = getCellValue(sh, row, map['大分類']);
      const person = getCellValue(sh, row, map['担当者']);
      const size = getCellValue(sh, row, map['サイズ']);
      const color = getCellValue(sh, row, map['カラー(選択)']);
      const productName = getCellValue(sh, row, map['商品名(タイトル)']);

      // フィルタ適用
      if (statusFilters.length > 0 && !statusFilters.includes(status)) continue;
      if (filters.brand && brand !== filters.brand) continue;
      if (filters.category && category !== filters.category) continue;
      if (filters.person && person !== filters.person) continue;
      if (filters.size && size !== filters.size) continue;
      if (filters.color && color !== filters.color) continue;

      // テキスト検索（管理番号・商品名）
      if (filters.searchText) {
        const searchLower = filters.searchText.toLowerCase();
        const matchNumber = (managementNumber || '').toLowerCase().includes(searchLower);
        const matchName = (productName || '').toLowerCase().includes(searchLower);
        if (!matchNumber && !matchName) continue;
      }

      // 日付範囲フィルタ
      if (filters.dateFrom || filters.dateTo) {
        let targetDate = null;
        if (filters.dateType === 'purchase') {
          targetDate = getCellValue(sh, row, map['仕入日']);
        } else if (filters.dateType === 'listing') {
          targetDate = getCellValue(sh, row, map['出品日']);
        } else if (filters.dateType === 'sale') {
          targetDate = getCellValue(sh, row, map['販売日']);
        }

        if (targetDate) {
          const dateObj = new Date(targetDate);
          if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            if (dateObj < fromDate) continue;
          }
          if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999); // 日付の終わりまで含める
            if (dateObj > toDate) continue;
          }
        } else if (filters.dateFrom || filters.dateTo) {
          // 日付が入力されていない商品は除外
          continue;
        }
      }

      // 商品情報を追加
      const productInfo = {
        managementNumber: managementNumber,
        person: person,
        productName: productName,
        category: category,
        brand: brand,
        itemName: getCellValue(sh, row, map['アイテム名']),
        size: size,
        color: color,
        status: status,
        purchaseDate: getCellValue(sh, row, map['仕入日']),
        purchaseAmount: getCellValue(sh, row, map['仕入金額']),
        listingDate: getCellValue(sh, row, map['出品日']),
        listingAmount: getCellValue(sh, row, map['出品金額']),
        saleDate: getCellValue(sh, row, map['販売日']),
        saleAmount: getCellValue(sh, row, map['販売金額']),
        profit: getCellValue(sh, row, map['利益金額']),
        profitRate: getCellValue(sh, row, map['利益率']),
        inventoryDays: getCellValue(sh, row, map['在庫日数']),
        registrant: getCellValue(sh, row, map['登録者']),
        registeredAt: getCellValue(sh, row, map['登録日時']),
        lastEditor: getCellValue(sh, row, map['最終更新者']),
        updatedAt: getCellValue(sh, row, map['更新日時']),
        imageUrl1: getCellValue(sh, row, map['画像URL1']),
        imageUrl2: getCellValue(sh, row, map['画像URL2']),
        imageUrl3: getCellValue(sh, row, map['画像URL3'])
      };

      allResults.push(productInfo);
    }

    // ソート
    allResults.sort((a, b) => {
      let aVal, bVal;
      
      switch(sortBy) {
        case 'registeredAt':
          aVal = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
          bVal = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
          break;
        case 'listingDate':
          aVal = a.listingDate ? new Date(a.listingDate).getTime() : 0;
          bVal = b.listingDate ? new Date(b.listingDate).getTime() : 0;
          break;
        case 'saleDate':
          aVal = a.saleDate ? new Date(a.saleDate).getTime() : 0;
          bVal = b.saleDate ? new Date(b.saleDate).getTime() : 0;
          break;
        case 'profit':
          aVal = parseFloat(a.profit) || 0;
          bVal = parseFloat(b.profit) || 0;
          break;
        case 'purchaseDate':
          aVal = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
          bVal = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
          break;
        default:
          aVal = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
          bVal = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
      }

      if (sortOrder === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });

    // ページネーション
    const totalCount = allResults.length;
    const totalPages = Math.ceil(totalCount / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedResults = allResults.slice(startIndex, endIndex);

    return jsonSuccessResponse({
      products: paginatedResults,
      count: paginatedResults.length,
      totalCount: totalCount,
      page: page,
      perPage: perPage,
      totalPages: totalPages,
      filters: filters,
      sortBy: sortBy,
      sortOrder: sortOrder
    });

  } catch (error) {
    return jsonErrorResponse(`検索エラー: ${error.message}`);
  }
}

/**
 * 商品情報取得API
 * パラメータ: managementNumber
 */
function getProductAPI(managementNumber) {
  try {
    if (!managementNumber) {
      return jsonErrorResponse('管理番号が必要です');
    }

    const result = getProductInfo(managementNumber);

    if (!result.success) {
      return jsonErrorResponse(result.error);
    }

    return jsonSuccessResponse(result.data);

  } catch (error) {
    return jsonErrorResponse(`取得エラー: ${error.message}`);
  }
}

/**
 * 商品情報更新API
 * パラメータ: managementNumber, field, value, editor
 */
function updateProductAPI(params) {
  try {
    const { managementNumber, field, value, editor } = params;

    if (!managementNumber || !field || value === undefined) {
      return jsonErrorResponse('managementNumber, field, value が必要です');
    }

    const productLocation = findProductByManagementNumber(managementNumber);
    if (!productLocation.found) {
      return jsonErrorResponse(productLocation.error);
    }

    const sh = getSheet();
    const { map } = getHeaderMapCommon();
    const row = productLocation.row;

    // フィールド更新
    const col = map[field];
    if (!col) {
      return jsonErrorResponse(`フィールド「${field}」が見つかりません`);
    }

    // Phase 2: 統計は毎回全件スキャンで計算するため、ステータス変更時の統計更新は不要

    // 値を更新
    sh.getRange(row, col).setValue(value);

    // ユーザー活動記録
    recordUserUpdate(sh, row, map, editor || 'システム');

    // Phase 2: 統計更新処理は削除（毎回全件スキャンで計算）

    // 利益再計算（金額系フィールドの場合）
    if (['販売金額', '送料', '梱包資材費', '販売手数料'].includes(field)) {
      recalculateProfit(managementNumber);
    }

    return jsonSuccessResponse({
      message: '更新しました',
      managementNumber: managementNumber,
      field: field,
      value: value
    });

  } catch (error) {
    return jsonErrorResponse(`更新エラー: ${error.message}`);
  }
}

/**
 * 在庫統計API
 * パラメータ: なし
 */
function getStatisticsAPI(params) {
  const startTime = new Date().getTime();
  Logger.log('[PERF] getStatisticsAPI 開始（統計シートから取得）');
  
  try {
    // 統計シートから直接読み込み（スキャン不要！）
    const total = getStatsValue('合計');
    const statusCounts = {
      registered: getStatsValue('登録済み'),
      preparingListing: getStatsValue('出品準備中'),
      listed: getStatsValue('出品中'),
      sold: getStatsValue('販売済み'),
      withdrawn: getStatsValue('取り下げ')
    };
    
    const totalPurchaseAmount = getStatsValue('総仕入金額');
    const totalListingAmount = getStatsValue('総出品金額');
    const totalSaleAmount = getStatsValue('総販売金額');
    const totalProfit = getStatsValue('総利益金額');
    const totalInventoryDays = getStatsValue('総在庫日数');
    const inventoryDaysCount = getStatsValue('在庫日数カウント');
    
    const endTime = new Date().getTime();
    Logger.log(`[PERF] getStatisticsAPI 完了: ${endTime - startTime}ms（統計シートから取得）`);
    
    return jsonSuccessResponse({
      total: total,
      statusCounts: statusCounts,
      totalPurchaseAmount: totalPurchaseAmount,
      totalListingAmount: totalListingAmount,
      totalSaleAmount: totalSaleAmount,
      totalProfit: totalProfit,
      averageProfit: statusCounts.sold > 0 ? Math.round(totalProfit / statusCounts.sold) : 0,
      averageInventoryDays: inventoryDaysCount > 0 ? Math.round(totalInventoryDays / inventoryDaysCount) : 0
    });

  } catch (error) {
    Logger.log(`[統計] getStatisticsAPI エラー: ${error.message}`);
    return jsonErrorResponse(`統計取得エラー: ${error.message}`);
  }
}

/**
 * 在庫ダッシュボードAPI（統合版・getValues最適化版）
 * 1回のgetDataRange().getValues()で全データを配列として一括取得
 * ループ内ではサービス呼び出しなし、配列アクセスのみで処理
 * 期待パフォーマンス: 6秒 → 0.5-1.2秒
 */
function getInventoryDashboardAPI(params) {
  const startTime = new Date().getTime();
  Logger.log('[PERF] getInventoryDashboardAPI 開始（getValues最適化版）');

  try {
    // paramsのデフォルト値設定（エディタから直接実行した場合に対応）
    params = params || {};

    // フィルタ条件
    const filters = {
      statuses: params.statuses || [],  // 修正: statusesを配列で受け取る
      brand: params.brand || '',
      category: params.category || '',
      person: params.person || '',
      size: params.size || '',
      color: params.color || '',
      searchText: params.searchText || '',
      dateFrom: params.dateFrom || '',
      dateTo: params.dateTo || '',
      dateType: params.dateType || 'purchase'
    };

    // ページネーション
    const page = parseInt(params.page) || 1;
    const perPage = parseInt(params.limit) || 10;  // 修正: limitに変更

    // ソート
    const sortBy = params.sortBy || 'registeredAt';
    const sortOrder = params.sortOrder || 'desc';

    // 【最適化】getDataRange().getValues()で一括取得（1回のサービス呼び出し）
    const bulkFetchStart = new Date().getTime();
    const sh = getSheet();
    const allData = sh.getDataRange().getValues();
    Logger.log('[PERF] getDataRange().getValues()完了: ' + (new Date().getTime() - bulkFetchStart) + 'ms');

    if (allData.length < 2) {
      // ヘッダー行のみ、またはデータなし
      return jsonSuccessResponse({
        statistics: {
          total: 0,
          statusCounts: {
            registered: 0,
            preparingListing: 0,
            listed: 0,
            sold: 0,
            withdrawn: 0
          },
          totalPurchaseAmount: 0,
          totalListingAmount: 0,
          totalSaleAmount: 0,
          totalProfit: 0,
          averageProfit: 0,
          averageInventoryDays: 0
        },
        products: [],
        count: 0,
        totalCount: 0,
        page: page,
        perPage: perPage,
        totalPages: 0
      });
    }

    // ヘッダー行（1行目）から列インデックスマップを構築
    const headerRow = allData[0];
    const colIdx = {};
    for (let i = 0; i < headerRow.length; i++) {
      const headerName = String(headerRow[i]).trim();
      if (headerName) {
        colIdx[headerName] = i;
      }
    }

    // 必須列の確認
    const requiredFields = ['管理番号', 'ステータス'];
    for (const field of requiredFields) {
      if (colIdx[field] === undefined) {
        return jsonErrorResponse(`必須列「${field}」が見つかりません`);
      }
    }

    // 【統計分離最適化】統計は統計シートから取得（ループ内での統計計算を削除）
    const statsStart = new Date().getTime();
    const allStats = getAllStatsValues();
    Logger.log('[PERF] 統計シート読み込み完了: ' + (new Date().getTime() - statsStart) + 'ms');

    const statistics = {
      total: allStats['合計'] || 0,
      statusCounts: {
        registered: allStats['登録済み'] || 0,
        preparingListing: allStats['出品準備中'] || 0,
        listed: allStats['出品中'] || 0,
        sold: allStats['販売済み'] || 0,
        withdrawn: allStats['取り下げ'] || 0
      },
      totalPurchaseAmount: allStats['総仕入金額'] || 0,
      totalListingAmount: allStats['総出品金額'] || 0,
      totalSaleAmount: allStats['総販売金額'] || 0,
      totalProfit: allStats['総利益金額'] || 0,
      averageProfit: (allStats['販売済み'] > 0) ? Math.round((allStats['総利益金額'] || 0) / allStats['販売済み']) : 0,
      averageInventoryDays: (allStats['在庫日数カウント'] > 0) ? Math.round((allStats['総在庫日数'] || 0) / allStats['在庫日数カウント']) : 0
    };

    // 商品一覧用配列
    const allResults = [];

    // ステータスフィルタ（複数選択対応）
    const statusFilters = Array.isArray(filters.statuses) ? filters.statuses : [];

    // 【最適化】配列ループ処理（統計計算なし、フィルタリングのみ）
    const loopStart = new Date().getTime();

    // データ行をループ（2行目以降）
    for (let rowIdx = 1; rowIdx < allData.length; rowIdx++) {
      const row = allData[rowIdx];

      // 管理番号チェック
      const managementNumber = String(row[colIdx['管理番号']] || '').trim();
      if (!managementNumber) continue;

      // ステータス取得
      const status = String(row[colIdx['ステータス']] || '').trim();

      // フィルタ適用（早期終了最適化）
      if (statusFilters.length > 0 && !statusFilters.includes(status)) {
        continue;
      }

      const brand = String(row[colIdx['ブランド(英語)']] || '').trim();
      if (filters.brand && brand !== filters.brand) {
        continue;
      }

      const category = String(row[colIdx['大分類']] || '').trim();
      if (filters.category && category !== filters.category) {
        continue;
      }

      const person = String(row[colIdx['担当者']] || '').trim();
      if (filters.person && person !== filters.person) {
        continue;
      }

      const size = String(row[colIdx['サイズ']] || '').trim();
      if (filters.size && size !== filters.size) {
        continue;
      }

      const color = String(row[colIdx['カラー(選択)']] || '').trim();
      if (filters.color && color !== filters.color) {
        continue;
      }

      // テキスト検索
      if (filters.searchText) {
        const productName = String(row[colIdx['商品名(タイトル)']] || '').trim();
        const searchLower = filters.searchText.toLowerCase();
        const matchNumber = managementNumber.toLowerCase().includes(searchLower);
        const matchName = productName.toLowerCase().includes(searchLower);
        if (!matchNumber && !matchName) {
          continue;
        }
      }

      // 日付範囲フィルタ
      if (filters.dateFrom || filters.dateTo) {
        let targetDate = null;
        let targetDateCol = null;

        if (filters.dateType === 'purchase') {
          targetDateCol = colIdx['仕入日'];
        } else if (filters.dateType === 'listing') {
          targetDateCol = colIdx['出品日'];
        } else if (filters.dateType === 'sale') {
          targetDateCol = colIdx['販売日'];
        }

        if (targetDateCol !== undefined) {
          targetDate = row[targetDateCol];
        }

        if (targetDate) {
          const dateObj = new Date(targetDate);
          if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            if (dateObj < fromDate) {
              continue;
            }
          }
          if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            toDate.setHours(23, 59, 59, 999);
            if (dateObj > toDate) {
              continue;
            }
          }
        } else {
          continue;
        }
      }

      // フィルタ通過した商品を追加
      const productName = String(row[colIdx['商品名(タイトル)']] || '').trim();
      const itemName = String(row[colIdx['アイテム名']] || '').trim();

      // 金額情報（フィルタ通過後のみ取得）
      const purchaseAmount = parseAmount(row[colIdx['仕入金額']] || 0);
      const listingAmount = parseAmount(row[colIdx['出品金額']] || 0);
      const saleAmount = parseAmount(row[colIdx['販売金額']] || 0);
      const profit = parseAmount(row[colIdx['利益金額']] || 0);
      const inventoryDays = parseAmount(row[colIdx['在庫日数']] || 0);

      const productInfo = {
        managementNumber: managementNumber,
        person: person,
        productName: productName,
        category: category,
        brand: brand,
        itemName: itemName,
        size: size,
        color: color,
        status: status,
        purchaseDate: row[colIdx['仕入日']] || '',
        purchaseAmount: purchaseAmount,
        listingDate: row[colIdx['出品日']] || '',
        listingAmount: listingAmount,
        saleDate: row[colIdx['販売日']] || '',
        saleAmount: saleAmount,
        profit: profit,
        profitRate: row[colIdx['利益率']] || '',
        inventoryDays: inventoryDays,
        registrant: row[colIdx['登録者']] || '',
        registeredAt: row[colIdx['登録日時']] || '',
        lastEditor: row[colIdx['最終更新者']] || '',
        updatedAt: row[colIdx['更新日時']] || '',
        imageUrl1: row[colIdx['画像URL1']] || '',
        imageUrl2: row[colIdx['画像URL2']] || '',
        imageUrl3: row[colIdx['画像URL3']] || ''
      };

      allResults.push(productInfo);
    }

    const loopEndTime = new Date().getTime();
    Logger.log('[PERF] 配列ループ処理完了: ' + (loopEndTime - loopStart) + 'ms, フィルタ後: ' + allResults.length + '件');

    // ソート
    const sortStart = new Date().getTime();
    allResults.sort((a, b) => {
      let aVal, bVal;

      switch(sortBy) {
        case 'registeredAt':
          aVal = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
          bVal = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
          break;
        case 'listingDate':
          aVal = a.listingDate ? new Date(a.listingDate).getTime() : 0;
          bVal = b.listingDate ? new Date(b.listingDate).getTime() : 0;
          break;
        case 'saleDate':
          aVal = a.saleDate ? new Date(a.saleDate).getTime() : 0;
          bVal = b.saleDate ? new Date(b.saleDate).getTime() : 0;
          break;
        case 'profit':
          aVal = parseFloat(a.profit) || 0;
          bVal = parseFloat(b.profit) || 0;
          break;
        case 'purchaseDate':
          aVal = a.purchaseDate ? new Date(a.purchaseDate).getTime() : 0;
          bVal = b.purchaseDate ? new Date(b.purchaseDate).getTime() : 0;
          break;
        default:
          aVal = a.registeredAt ? new Date(a.registeredAt).getTime() : 0;
          bVal = b.registeredAt ? new Date(b.registeredAt).getTime() : 0;
      }

      if (sortOrder === 'asc') {
        return aVal - bVal;
      } else {
        return bVal - aVal;
      }
    });
    Logger.log('[PERF] ソート完了: ' + (new Date().getTime() - sortStart) + 'ms');

    // ページネーション
    const totalCount = allResults.length;
    const totalPages = Math.ceil(totalCount / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const paginatedResults = allResults.slice(startIndex, endIndex);

    const endTime = new Date().getTime();
    Logger.log('[PERF] getInventoryDashboardAPI 完了: 合計' + (endTime - startTime) + 'ms（getValues最適化版）');

    // 統計情報と商品一覧を返す
    return jsonSuccessResponse({
      statistics: statistics,
      products: paginatedResults,
      count: paginatedResults.length,
      totalCount: totalCount,
      page: page,
      perPage: perPage,
      totalPages: totalPages,
      filters: filters,
      sortBy: sortBy,
      sortOrder: sortOrder
    });

  } catch (error) {
    Logger.log(`[PERF] getInventoryDashboardAPI エラー: ${error.message}`);
    Logger.log(`[PERF] スタックトレース: ${error.stack}`);
    return jsonErrorResponse(`ダッシュボード取得エラー: ${error.message}`);
  }
}


/**
 * 商品複製API
 * 既存商品をコピーして新しい商品として登録
 */
function duplicateProductAPI(params) {
  try {
    const originalNumber = params.managementNumber;
    if (!originalNumber) {
      return jsonErrorResponse('管理番号が指定されていません');
    }

    const sh = getSheet();
    const { map } = getHeaderMapCommon();
    const managementCol = colByName(sh, INVENTORY_HEADERS.key);
    const lastRow = sh.getLastRow();

    // 元の商品を検索
    let originalRow = null;
    for (let row = INVENTORY_START_ROW; row <= lastRow; row++) {
      const managementNumber = getCellValue(sh, row, managementCol);
      if (managementNumber === originalNumber) {
        originalRow = row;
        break;
      }
    }

    if (!originalRow) {
      return jsonErrorResponse(`商品が見つかりません: ${originalNumber}`);
    }

    // 新しい管理番号を生成
    const newManagementNumber = getNextManagementNumber();
    
    // 新しい行を追加
    const newRow = lastRow + 1;

    // 元の商品データを取得して複製
    const lastCol = sh.getLastColumn();
    const originalData = sh.getRange(originalRow, 1, 1, lastCol).getValues()[0];
    
    // 新しいデータ配列を作成（元のデータをコピー）
    const newData = [...originalData];

    // リセットが必要な項目
    newData[managementCol - 1] = newManagementNumber; // 管理番号
    newData[map['ステータス'] - 1] = '登録済み'; // ステータス
    newData[map['出品日'] - 1] = ''; // 出品日クリア
    newData[map['販売日'] - 1] = ''; // 販売日クリア
    newData[map['販売金額'] - 1] = ''; // 販売金額クリア
    newData[map['利益金額'] - 1] = ''; // 利益金額クリア
    newData[map['利益率'] - 1] = ''; // 利益率クリア
    newData[map['在庫日数'] - 1] = ''; // 在庫日数クリア

    // システム管理項目を更新
    const currentUser = Session.getActiveUser().getEmail();
    const currentTime = new Date();
    
    newData[map['登録者'] - 1] = currentUser;
    newData[map['登録日時'] - 1] = currentTime;
    newData[map['最終更新者'] - 1] = currentUser;
    newData[map['更新日時'] - 1] = currentTime;

    // 新しい行に書き込み
    sh.getRange(newRow, 1, 1, lastCol).setValues([newData]);

    // 元の行の数式・書式をコピー（PASTE_FORMULA, PASTE_FORMAT）
    sh.getRange(originalRow, 1, 1, lastCol).copyTo(
      sh.getRange(newRow, 1, 1, lastCol),
      SpreadsheetApp.CopyPasteType.PASTE_FORMAT
    );

    return jsonSuccessResponse({
      newManagementNumber: newManagementNumber,
      originalManagementNumber: originalNumber,
      message: `商品を複製しました: ${originalNumber} → ${newManagementNumber}`
    });

  } catch (error) {
    return jsonErrorResponse(`複製エラー: ${error.message}`);
  }
}

/**
 * 商品詳細取得API（Phase 1-4）
 * 指定した管理番号の商品の全情報を取得
 */
function getProductDetailAPI(params) {
  try {
    const managementNumber = params.managementNumber;
    if (!managementNumber) {
      return jsonErrorResponse('管理番号が指定されていません');
    }

    const sh = getSheet();
    const { map } = getHeaderMapCommon();
    const managementCol = colByName(sh, INVENTORY_HEADERS.key);
    const lastRow = sh.getLastRow();

    // 商品を検索
    let targetRow = null;
    for (let row = INVENTORY_START_ROW; row <= lastRow; row++) {
      const rowManagementNumber = getCellValue(sh, row, managementCol);
      if (rowManagementNumber === managementNumber) {
        targetRow = row;
        break;
      }
    }

    if (!targetRow) {
      return jsonErrorResponse(`商品が見つかりません: ${managementNumber}`);
    }

    // 商品データを取得
    const product = {
      managementNumber: getCellValue(sh, targetRow, managementCol),
      person: getCellValue(sh, targetRow, map['担当者']),
      purchaseDate: getCellValue(sh, targetRow, map['仕入日']),
      brand: getCellValue(sh, targetRow, map['ブランド']),
      productName: getCellValue(sh, targetRow, map['商品名']),
      category: getCellValue(sh, targetRow, map['カテゴリ']),
      item: getCellValue(sh, targetRow, map['アイテム']),
      size: getCellValue(sh, targetRow, map['サイズ']),
      color: getCellValue(sh, targetRow, map['カラー']),
      material: getCellValue(sh, targetRow, map['素材']),
      productDescription: getCellValue(sh, targetRow, map['商品説明']),
      imageUrl1: getCellValue(sh, targetRow, map['画像URL1']),
      imageUrl2: getCellValue(sh, targetRow, map['画像URL2']),
      imageUrl3: getCellValue(sh, targetRow, map['画像URL3']),
      purchaseAmount: getCellValue(sh, targetRow, map['仕入金額']),
      status: getCellValue(sh, targetRow, map['ステータス']),
      listingDate: getCellValue(sh, targetRow, map['出品日']),
      listingDestination: getCellValue(sh, targetRow, map['出品先']),
      listingAmount: getCellValue(sh, targetRow, map['出品金額']),
      saleDate: getCellValue(sh, targetRow, map['販売日']),
      saleAmount: getCellValue(sh, targetRow, map['販売金額']),
      profit: getCellValue(sh, targetRow, map['利益金額']),
      inventoryDays: getCellValue(sh, targetRow, map['在庫日数'])
    };

    return jsonSuccessResponse(product);

  } catch (error) {
    return jsonErrorResponse(`商品詳細取得エラー: ${error.message}`);
  }
}

/**
 * 商品ステータス更新API（Phase 1-4）
 * 指定した管理番号の商品のステータスを更新
 */
function updateProductStatusAPI(params) {
  try {
    const managementNumber = params.managementNumber;
    const newStatus = params.newStatus;

    if (!managementNumber) {
      return jsonErrorResponse('管理番号が指定されていません');
    }
    if (!newStatus) {
      return jsonErrorResponse('新しいステータスが指定されていません');
    }

    // ステータスの妥当性チェック
    const validStatuses = ['登録済み', '出品準備中', '出品中', '販売済み', '取り下げ'];
    if (!validStatuses.includes(newStatus)) {
      return jsonErrorResponse(`無効なステータス: ${newStatus}`);
    }

    const sh = getSheet();
    const { map } = getHeaderMapCommon();
    const managementCol = colByName(sh, INVENTORY_HEADERS.key);
    const statusCol = map['ステータス'];
    const lastRow = sh.getLastRow();

    // 商品を検索
    let targetRow = null;
    for (let row = INVENTORY_START_ROW; row <= lastRow; row++) {
      const rowManagementNumber = getCellValue(sh, row, managementCol);
      if (rowManagementNumber === managementNumber) {
        targetRow = row;
        break;
      }
    }

    if (!targetRow) {
      return jsonErrorResponse(`商品が見つかりません: ${managementNumber}`);
    }

    // ステータスを更新
    sh.getRange(targetRow, statusCol).setValue(newStatus);

    // 最終更新者・更新日時を記録
    const currentUser = Session.getActiveUser().getEmail();
    const currentTime = new Date();
    sh.getRange(targetRow, map['最終更新者']).setValue(currentUser);
    sh.getRange(targetRow, map['更新日時']).setValue(currentTime);

    Logger.log(`[在庫管理] ステータス更新: ${managementNumber} → ${newStatus}`);

    // 統計情報を再計算
    recalculateAllStats();

    return jsonSuccessResponse({
      managementNumber: managementNumber,
      newStatus: newStatus,
      message: `ステータスを「${newStatus}」に更新しました`
    });

  } catch (error) {
    return jsonErrorResponse(`ステータス更新エラー: ${error.message}`);
  }
}

// =============================================================================
// ユーザー活動記録（Phase 1）
// =============================================================================

/**
 * 最終更新者と更新日時を記録
 */
function recordUserUpdate(sheet, row, headerMap, editorName) {
  try {
    const now = new Date();
    const timestamp = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

    // 最終更新者
    const editorCol = headerMap['最終更新者'];
    if (editorCol) {
      sheet.getRange(row, editorCol).setValue(editorName);
    }

    // 更新日時
    const updatedAtCol = headerMap['更新日時'];
    if (updatedAtCol) {
      sheet.getRange(row, updatedAtCol).setValue(timestamp);
    }

    return true;

  } catch (error) {
    console.error('ユーザー活動記録エラー:', error);
    return false;
  }
}

// =============================================================================
// JSON レスポンスヘルパー
// =============================================================================

function jsonSuccessResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: true, data: data }))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonErrorResponse(errorMessage) {
  return ContentService
    .createTextOutput(JSON.stringify({ success: false, error: errorMessage }))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================================================
// Phase 4: 将来実装する関数（コメントアウト）
// =============================================================================

/*
// Agent SDK連携用: AI分析エンドポイント
function aiAnalyzeInventoryAPI(params) {
  // 在庫をAIが分析して最適化提案を返す
  // - 長期在庫の検出
  // - 値下げ推奨商品
  // - 仕入れ戦略の提案
}

// Agent SDK連携用: AI価格提案
function aiSuggestPriceAPI(params) {
  // メルカリ価格調査結果を元にAIが価格を提案
  // - 競合価格分析
  // - 適正価格算出
  // - 値下げタイミング提案
}

// Agent SDK連携用: 一括更新
function bulkUpdateAPI(params) {
  // 複数商品を一括更新
  // - AI提案を一括適用
  // - ステータス一括変更
  // - 価格一括調整
}
*/