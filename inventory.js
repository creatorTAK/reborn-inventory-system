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
 * 統計情報シートから全ての値を一度に取得（最適化版 + Phase 6 キャッシュ）
 * 1回のシート読み込みで全統計を取得
 * Phase 6: PropertiesServiceでキャッシュ、最終更新時刻で判定
 */
function getAllStatsValues() {
  try {
    const t1 = new Date().getTime();
    const sheet = getStatsSheet();
    const t2 = new Date().getTime();
    Logger.log(`[PERF-DEBUG] getStatsSheet(): ${t2 - t1}ms`);

    // Phase 6: キャッシュチェック
    const properties = PropertiesService.getScriptProperties();
    const cachedTimestamp = properties.getProperty('stats_cache_timestamp');

    // 統計シートの最終更新時刻を取得（セルD1に記録されている想定）
    let sheetTimestamp = null;
    try {
      sheetTimestamp = sheet.getRange('D1').getValue();
      if (!sheetTimestamp || sheetTimestamp === '') {
        // D1が空の場合は現在時刻を書き込む（初回のみ）
        const now = new Date();
        sheet.getRange('D1').setValue(now);
        sheetTimestamp = now.getTime();
        Logger.log(`[PERF] 統計シートD1を初期化: ${now}`);
      } else {
        sheetTimestamp = new Date(sheetTimestamp).getTime();
      }
    } catch (e) {
      Logger.log(`[PERF] D1読み込みエラー: ${e.message}`);
      // エラーの場合は現在時刻を使用
      sheetTimestamp = new Date().getTime();
    }

    // キャッシュが有効かチェック
    if (cachedTimestamp && sheetTimestamp && cachedTimestamp == sheetTimestamp) {
      const cachedData = properties.getProperty('stats_cache_data');
      if (cachedData) {
        const t3 = new Date().getTime();
        Logger.log(`[PERF] 統計キャッシュヒット: ${t3 - t1}ms`);
        return JSON.parse(cachedData);
      }
    }

    Logger.log(`[PERF] 統計キャッシュミス: 再取得します`);

    const data = sheet.getDataRange().getValues();
    const t3 = new Date().getTime();
    Logger.log(`[PERF-DEBUG] getDataRange().getValues(): ${t3 - t2}ms (${data.length}行)`);

    const stats = {};
    for (let i = 1; i < data.length; i++) {
      const itemName = data[i][0];
      const value = Number(data[i][1]) || 0;
      stats[itemName] = value;
    }

    const t4 = new Date().getTime();
    Logger.log(`[PERF-DEBUG] 辞書化処理: ${t4 - t3}ms`);

    // Phase 6: キャッシュに保存
    if (sheetTimestamp) {
      properties.setProperty('stats_cache_data', JSON.stringify(stats));
      properties.setProperty('stats_cache_timestamp', sheetTimestamp.toString());
      Logger.log(`[PERF] 統計キャッシュ更新: タイムスタンプ=${sheetTimestamp}`);
    }

    Logger.log(`[PERF-DEBUG] getAllStatsValues() 合計: ${t4 - t1}ms`);

    return stats;
  } catch (error) {
    Logger.log(`[統計] 全値取得エラー: ${error.message}`);
    return {};
  }
}

/**
 * 統計情報シートの値を更新
 * Phase 6: 更新時にタイムスタンプ(D1)を更新してキャッシュを無効化
 */
function setStatsValue(itemName, value) {
  try {
    const sheet = getStatsSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === itemName) {
        sheet.getRange(i + 1, 2).setValue(value);
        sheet.getRange(i + 1, 3).setValue(new Date());

        // Phase 6: タイムスタンプを更新（キャッシュ無効化）
        sheet.getRange('D1').setValue(new Date());

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

    // 【PERF-001 最適化】一括読み込み（600回のAPI呼び出し → 1回）
    const allData = sh.getDataRange().getValues();

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

    // 全商品をスキャン（配列から直接読み取り）
    for (let i = INVENTORY_START_ROW - 1; i < allData.length; i++) {
      const managementNumber = allData[i][managementCol - 1];
      if (!managementNumber) continue;

      total++;

      const status = allData[i][map['ステータス'] - 1];
      if (statusCounts.hasOwnProperty(status)) {
        statusCounts[status]++;
      }

      const purchaseAmount = parseAmount(allData[i][map['仕入金額'] - 1]);
      const listingAmount = parseAmount(allData[i][map['出品金額'] - 1]);
      const saleAmount = parseAmount(allData[i][map['販売金額'] - 1]);
      const profit = parseAmount(allData[i][map['利益金額'] - 1]);

      totalPurchaseAmount += purchaseAmount;

      if (status === '出品中' || status === '販売済み') {
        totalListingAmount += listingAmount;
      }

      if (status === '販売済み') {
        totalSaleAmount += saleAmount;
        totalProfit += profit;

        const inventoryDays = parseAmount(allData[i][map['在庫日数'] - 1]);
        if (inventoryDays > 0) {
          totalInventoryDays += inventoryDays;
          inventoryDaysCount++;
        }
      }
    }

    // 【PERF-001 最適化】統計シートに一括書き込み（13回のAPI呼び出し → 1回）
    const statsSheet = getStatsSheet();
    const statsData = statsSheet.getDataRange().getValues();

    // 統計値を配列にまとめる
    const statsMap = {
      '登録済み': statusCounts['登録済み'],
      '出品準備中': statusCounts['出品準備中'],
      '出品中': statusCounts['出品中'],
      '販売済み': statusCounts['販売済み'],
      '取り下げ': statusCounts['取り下げ'],
      '合計': total,
      '総仕入金額': totalPurchaseAmount,
      '総出品金額': totalListingAmount,
      '総販売金額': totalSaleAmount,
      '総利益金額': totalProfit,
      '総在庫日数': totalInventoryDays,
      '在庫日数カウント': inventoryDaysCount
    };

    const now = new Date();
    const updates = [];

    // 統計シートの行を特定して更新データを準備
    for (let i = 1; i < statsData.length; i++) {
      const itemName = statsData[i][0];
      if (statsMap.hasOwnProperty(itemName)) {
        updates.push({
          row: i + 1,
          value: statsMap[itemName],
          timestamp: now
        });
      }
    }

    // 一括更新（setValues使用）
    for (const update of updates) {
      statsSheet.getRange(update.row, 2).setValue(update.value);
      statsSheet.getRange(update.row, 3).setValue(update.timestamp);
    }

    // タイムスタンプ更新（キャッシュ無効化）
    statsSheet.getRange('D1').setValue(now);

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

      case 'getExistingUserCount':
        // 初回登録判定用（FCM通知登録シートのユーザー数取得）
        try {
          const count = getExistingUserCount();
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            count: count
          }))
            .setMimeType(ContentService.MimeType.JSON)
            .setHeader('Access-Control-Allow-Origin', '*')
            .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            .setHeader('Access-Control-Allow-Headers', 'Content-Type');
        } catch (error) {
          Logger.log('[doGet] getExistingUserCount ERROR: ' + error);
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            count: 0,
            error: error.toString()
          }))
            .setMimeType(ContentService.MimeType.JSON)
            .setHeader('Access-Control-Allow-Origin', '*')
            .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            .setHeader('Access-Control-Allow-Headers', 'Content-Type');
        }

      case 'subscribeFCM':
        // FCM通知登録（スプレッドシート + Firestore）
        return subscribeFCMAPI(e.parameter);

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
    // 【PERF-001 Phase 4】キャッシュ機能: タイムスタンプチェック
    const statsSheet = getStatsSheet();
    const lastUpdate = statsSheet.getRange('D1').getValue();
    const now = new Date();
    const cacheValidityMinutes = 5; // キャッシュ有効期限（5分）

    let shouldRecalculate = false;

    if (!lastUpdate || typeof lastUpdate.getTime !== 'function') {
      // タイムスタンプが無効 → 再計算
      shouldRecalculate = true;
      Logger.log('[統計] タイムスタンプ無効 → 再計算実行');
    } else {
      const minutesSinceUpdate = (now.getTime() - lastUpdate.getTime()) / 1000 / 60;
      if (minutesSinceUpdate > cacheValidityMinutes) {
        // キャッシュ期限切れ → 再計算
        shouldRecalculate = true;
        Logger.log(`[統計] キャッシュ期限切れ（${Math.round(minutesSinceUpdate)}分経過） → 再計算実行`);
      } else {
        Logger.log(`[統計] キャッシュ有効（${Math.round(minutesSinceUpdate)}分前） → キャッシュ使用`);
      }
    }

    // 必要に応じて統計を再計算
    if (shouldRecalculate) {
      recalculateAllStats();
    }

    // 統計シートを1回だけ読み込み（11回→1回に削減！）
    const allStats = getAllStatsValues();

    const total = allStats['合計'] || 0;
    const statusCounts = {
      registered: allStats['登録済み'] || 0,
      preparingListing: allStats['出品準備中'] || 0,
      listed: allStats['出品中'] || 0,
      sold: allStats['販売済み'] || 0,
      withdrawn: allStats['取り下げ'] || 0
    };

    const totalPurchaseAmount = allStats['総仕入金額'] || 0;
    const totalListingAmount = allStats['総出品金額'] || 0;
    const totalSaleAmount = allStats['総販売金額'] || 0;
    const totalProfit = allStats['総利益金額'] || 0;
    const totalInventoryDays = allStats['総在庫日数'] || 0;
    const inventoryDaysCount = allStats['在庫日数カウント'] || 0;

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
  Logger.log('🎯 [DEBUG] getInventoryDashboardAPI 呼び出し開始');
  Logger.log('🎯 [DEBUG] params: ' + JSON.stringify(params));

  const startTime = new Date().getTime();
  Logger.log('[PERF] getInventoryDashboardAPI 開始（Phase 5: 全列インデックス方式）');

  try {
    // paramsのデフォルト値設定
    params = params || {};

    // フィルタ条件
    const filters = {
      statuses: params.statuses || [],
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
    const perPage = parseInt(params.limit) || 10;

    // ソート
    const sortBy = params.sortBy || 'registeredAt';
    const sortOrder = params.sortOrder || 'desc';

    const sh = getSheet();
    
    // 【Phase 5】ステップ1: インデックス列定義（全必要列を含む）
    // フィルタ・ソート・表示に必要な全列（詳細データ読み込みを不要にする）
    const INDEX_COLUMNS = [
      '管理番号',       // 0: 必須
      'ステータス',     // 1: フィルタ
      'ブランド(英語)', // 2: フィルタ
      '大分類',         // 3: フィルタ
      '担当者',         // 4: フィルタ
      'サイズ',         // 5: フィルタ
      'カラー(選択)',   // 6: フィルタ
      '商品名(タイトル)', // 7: 検索・表示
      '仕入日',         // 8: 日付フィルタ
      '出品日',         // 9: 日付フィルタ
      '販売日',         // 10: 日付フィルタ
      '登録日時',       // 11: ソート
      '利益金額',       // 12: ソート
      '仕入金額',       // 13: 表示
      '出品金額',       // 14: 表示
      // 【Phase 5追加】詳細表示用の列
      'アイテム名',     // 15: 詳細表示
      '販売金額',       // 16: 詳細表示
      '利益率',         // 17: 詳細表示
      '在庫日数',       // 18: 詳細表示
      '登録者',         // 19: 詳細表示
      '最終更新者',     // 20: 詳細表示
      '更新日時',       // 21: 詳細表示
      '画像URL1',       // 22: 詳細表示
      '画像URL2',       // 23: 詳細表示
      '画像URL3',       // 24: 詳細表示
      'JSON_データ'     // 25: 画像配列
    ];

    // 【Phase 4】ステップ2: 軽量インデックス読み込み
    const indexFetchStart = new Date().getTime();
    const lastRow = sh.getLastRow();
    const totalRows = lastRow - 1; // ヘッダー除く
    
    if (totalRows < 1) {
      // データなし
      return jsonSuccessResponse({
        statistics: getEmptyStatistics(),
        products: [],
        count: 0,
        totalCount: 0,
        page: page,
        perPage: perPage,
        totalPages: 0
      });
    }

    // ヘッダー行取得（全列必要）
    const headerRow = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const fullColIdx = {};
    for (let i = 0; i < headerRow.length; i++) {
      const headerName = String(headerRow[i]).trim();
      if (headerName) {
        fullColIdx[headerName] = i;
      }
    }

    // インデックス列の列番号を特定
    const indexColNumbers = INDEX_COLUMNS.map(col => fullColIdx[col]);
    
    // 軽量データ読み込み（全行×15列のみ）
    const indexData = [];
    const BATCH_SIZE = 1000; // 1000行ずつ読み込み
    for (let startRow = 2; startRow <= lastRow; startRow += BATCH_SIZE) {
      const rowsToFetch = Math.min(BATCH_SIZE, lastRow - startRow + 1);
      const batchData = sh.getRange(startRow, 1, rowsToFetch, sh.getLastColumn()).getValues();
      
      // 必要な列だけ抽出
      for (let i = 0; i < batchData.length; i++) {
        const row = batchData[i];
        const indexRow = indexColNumbers.map(colNum => row[colNum]);
        indexRow.push(startRow + i); // 元の行番号を追加
        indexData.push(indexRow);
      }
    }
    
    Logger.log('[PERF] インデックス読み込み完了: ' + (new Date().getTime() - indexFetchStart) + 'ms (' + indexData.length + '行)');

    // 【Phase 4】ステップ3: 統計情報取得（統計シートから）
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

    // 【Phase 4】ステップ4: フィルタリング（軽量データで実行）
    const filterStart = new Date().getTime();
    const matchedItems = [];
    const statusFilters = Array.isArray(filters.statuses) ? filters.statuses : [];

    for (let i = 0; i < indexData.length; i++) {
      const row = indexData[i];
      const rowNumber = row[15]; // 最後の要素が行番号
      
      // 管理番号チェック
      const managementNumber = String(row[0] || '').trim();
      if (!managementNumber) continue;

      // ステータスフィルタ
      const status = String(row[1] || '').trim();
      if (statusFilters.length > 0 && !statusFilters.includes(status)) {
        continue;
      }

      // ブランドフィルタ
      const brand = String(row[2] || '').trim();
      if (filters.brand && brand !== filters.brand) {
        continue;
      }

      // カテゴリフィルタ
      const category = String(row[3] || '').trim();
      if (filters.category && category !== filters.category) {
        continue;
      }

      // 担当者フィルタ
      const person = String(row[4] || '').trim();
      if (filters.person && person !== filters.person) {
        continue;
      }

      // サイズフィルタ
      const size = String(row[5] || '').trim();
      if (filters.size && size !== filters.size) {
        continue;
      }

      // カラーフィルタ
      const color = String(row[6] || '').trim();
      if (filters.color && color !== filters.color) {
        continue;
      }

      // テキスト検索
      if (filters.searchText) {
        const productName = String(row[7] || '').trim();
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
        
        if (filters.dateType === 'purchase') {
          targetDate = row[8]; // 仕入日
        } else if (filters.dateType === 'listing') {
          targetDate = row[9]; // 出品日
        } else if (filters.dateType === 'sale') {
          targetDate = row[10]; // 販売日
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

      // フィルタ通過 → マッチリストに追加（Phase 5: 全情報を含む）
      matchedItems.push({
        rowNumber: rowNumber,
        managementNumber: managementNumber,
        status: status,
        brand: brand,
        category: category,
        person: String(row[4] || '').trim(),
        size: String(row[5] || '').trim(),
        color: String(row[6] || '').trim(),
        productName: String(row[7] || '').trim(),
        purchaseDate: row[8],
        listingDate: row[9],
        saleDate: row[10],
        registeredAt: row[11],
        profit: parseAmount(row[12]),
        purchaseAmount: parseAmount(row[13]),
        listingAmount: parseAmount(row[14]),
        // Phase 5追加：詳細データ
        itemName: String(row[15] || '').trim(),
        saleAmount: parseAmount(row[16]),
        profitRate: row[17] || '',
        inventoryDays: parseAmount(row[18]),
        registrant: row[19] || '',
        lastEditor: row[20] || '',
        updatedAt: row[21] || '',
        imageUrl1: row[22] || '',
        imageUrl2: row[23] || '',
        imageUrl3: row[24] || '',
        jsonData: row[25] || ''
      });
    }

    Logger.log('[PERF] フィルタリング完了: ' + (new Date().getTime() - filterStart) + 'ms (' + matchedItems.length + '件)');

    // 【Phase 4】ステップ5: ソート
    const sortStart = new Date().getTime();
    matchedItems.sort((a, b) => {
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

    // ページネーション計算
    const totalCount = matchedItems.length;
    const totalPages = Math.ceil(totalCount / perPage);
    const startIndex = (page - 1) * perPage;
    const endIndex = startIndex + perPage;
    const pageItems = matchedItems.slice(startIndex, endIndex);

    // 【Phase 5】ステップ6: インデックスデータからproductsを直接生成（詳細データ読み込み不要）
    const productsStart = new Date().getTime();
    const products = [];

    for (let i = 0; i < pageItems.length; i++) {
      const item = pageItems[i];

      // JSON_データ列から商品画像URL配列を取得
      let productImages = [];
      const jsonDataRaw = item.jsonData;
      Logger.log(`[DEBUG] Processing images for ${item.managementNumber}`);
      Logger.log(`[DEBUG] jsonDataRaw: ${jsonDataRaw}`);
      if (jsonDataRaw && String(jsonDataRaw).trim()) {
        try {
          const parsedData = JSON.parse(String(jsonDataRaw));
          Logger.log(`[DEBUG] Parsed data: ${JSON.stringify(parsedData)}`);
          if (Array.isArray(parsedData)) {
            Logger.log(`[DEBUG] Is array, length: ${parsedData.length}`);
            const filtered = parsedData.filter(img => !img.forAI && img.url);
            Logger.log(`[DEBUG] After filter (!forAI && has url): ${filtered.length} images`);
            productImages = filtered.map(img => img.url);
            Logger.log(`[DEBUG] Product images URLs: ${JSON.stringify(productImages)}`);
          } else {
            Logger.log(`[DEBUG] Parsed data is not an array`);
          }
        } catch (parseError) {
          Logger.log(`[ERROR] JSON_データ列のパースエラー（管理番号: ${item.managementNumber}）: ${parseError.message}`);
        }
      } else {
        Logger.log(`[DEBUG] No jsonDataRaw for ${item.managementNumber}`);
      }

      products.push({
        managementNumber: item.managementNumber,
        person: item.person,
        productName: item.productName,
        category: item.category,
        brand: item.brand,
        itemName: item.itemName,
        size: item.size,
        color: item.color,
        status: item.status,
        purchaseDate: item.purchaseDate || '',
        purchaseAmount: item.purchaseAmount,
        listingDate: item.listingDate || '',
        listingAmount: item.listingAmount,
        saleDate: item.saleDate || '',
        saleAmount: item.saleAmount,
        profit: item.profit,
        profitRate: item.profitRate,
        inventoryDays: item.inventoryDays,
        registrant: item.registrant,
        registeredAt: item.registeredAt || '',
        lastEditor: item.lastEditor,
        updatedAt: item.updatedAt,
        imageUrl1: item.imageUrl1,
        imageUrl2: item.imageUrl2,
        imageUrl3: item.imageUrl3,
        images: productImages
      });
    }

    Logger.log('[PERF] products生成完了: ' + (new Date().getTime() - productsStart) + 'ms (' + products.length + '件)');

    // Date型を文字列に変換
    Logger.log('[DEBUG] Before serialization, first product images:', products[0] ? products[0].images : 'N/A');
    const serializedProducts = products.map(function(product) {
      const serialized = {};
      for (var key in product) {
        if (product.hasOwnProperty(key)) {
          var value = product[key];
          if (value instanceof Date) {
            serialized[key] = value.toISOString();
          } else if (value === null || value === undefined) {
            serialized[key] = '';
          } else {
            serialized[key] = value;
          }
        }
      }
      return serialized;
    });
    
    Logger.log('[DEBUG] After serialization, first product images:', serializedProducts[0] ? serializedProducts[0].images : 'N/A');
    
    const endTime = new Date().getTime();
    Logger.log('[PERF] getInventoryDashboardAPI 完了: 合計' + (endTime - startTime) + 'ms（Phase 5: 全列インデックス方式）');

    return jsonSuccessResponse({
      statistics: statistics,
      products: serializedProducts,
      count: serializedProducts.length,
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

// ヘルパー関数: 空の統計を返す
function getEmptyStatistics() {
  return {
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
  };
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

/**
 * 成功レスポンス（google.script.run用：直接オブジェクトを返す）
 */
function jsonSuccessResponse(data) {
  return { success: true, data: data };
}

/**
 * エラーレスポンス（google.script.run用：直接オブジェクトを返す）
 */
function jsonErrorResponse(errorMessage) {
  return { success: false, error: errorMessage };
}

// =============================================================================
// 販売記録機能 API (INV-004)
// =============================================================================

/**
 * 発送方法マスタ取得API
 * シート「発送方法マスタ」からデータを取得
 */
function getShippingMethodMasterAPI() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '発送方法マスタ';
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, message: `シート「${sheetName}」が見つかりません` };
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return { success: true, data: [] };
    }
    
    const headers = data[0];
    const master = [];
    
    // ヘッダー行からインデックスを取得
    const method1Idx = headers.indexOf('発送方法1');
    const method2Idx = headers.indexOf('発送方法2');
    const feeIdx = headers.indexOf('送料');
    
    if (method1Idx === -1 || method2Idx === -1 || feeIdx === -1) {
      return { 
        success: false, 
        message: '必要な列（発送方法1、発送方法2、送料）が見つかりません' 
      };
    }
    
    // データ行を処理
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row[method1Idx]) continue; // 空行スキップ
      
      master.push({
        method1: row[method1Idx],
        method2: row[method2Idx],
        fee: Number(row[feeIdx]) || 0
      });
    }
    
    Logger.log(`[発送方法マスタ] ${master.length}件取得`);
    return { success: true, data: master };
    
  } catch (error) {
    Logger.log(`[ERROR] getShippingMethodMasterAPI: ${error.message}`);
    return { success: false, message: error.toString() };
  }
}

/**
 * 備品在庫リスト取得API
 * シート「備品在庫リスト」からデータを取得
 */
function getPackagingMaterialsMasterAPI() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '備品在庫リスト';
    const sheet = ss.getSheetByName(sheetName);
    
    if (!sheet) {
      return { success: false, message: `シート「${sheetName}」が見つかりません` };
    }
    
    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return { success: true, data: [] };
    }
    
    const headers = data[0];
    const master = [];
    
    // 列インデックスを取得
    const colMap = {};
    headers.forEach((header, index) => {
      colMap[header] = index;
    });
    
    // 必須列のチェック
    const requiredCols = ['商品名', '1個あたり'];
    for (const col of requiredCols) {
      if (colMap[col] === undefined) {
        return {
          success: false,
          message: `必要な列「${col}」が見つかりません`
        };
      }
    }

    // データ行を処理
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const productName = row[colMap['商品名']];
      if (!productName) continue; // 空行スキップ

      master.push({
        productName: productName,
        unitCost: Number(row[colMap['1個あたり']]) || 0,
        inStock: Number(row[colMap['入庫数合計']]) || 0,
        outStock: Number(row[colMap['出庫数合計']]) || 0,
        inventory: Number(row[colMap['在庫数']]) || 0
      });
    }
    
    Logger.log(`[備品在庫リスト] ${master.length}件取得`);
    return { success: true, data: master };
    
  } catch (error) {
    Logger.log(`[ERROR] getPackagingMaterialsMasterAPI: ${error.message}`);
    return { success: false, message: error.toString() };
  }
}

/**
 * 管理番号から商品情報を取得するAPI
 */
function getProductByManagementNumberAPI(managementNumber) {
  try {
    if (!managementNumber) {
      return { success: false, message: '管理番号が指定されていません' };
    }
    
    const result = getProductInfo(managementNumber);
    
    if (!result.success) {
      return { success: false, message: result.error };
    }
    
    return { success: true, data: result.data };
    
  } catch (error) {
    Logger.log(`[ERROR] getProductByManagementNumberAPI: ${error.message}`);
    return { success: false, message: error.toString() };
  }
}

/**
 * 販売記録保存API
 * 販売情報、発送情報、梱包資材情報を保存し、利益を計算
 */
function saveSalesRecordAPI(salesData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '在庫/売上管理表';
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return { success: false, message: `シート「${sheetName}」が見つかりません` };
    }

    // ユーザー名を取得（FCMトークンから）
    let operatorName = 'システム';
    if (salesData.fcmToken) {
      const operatorResult = getOperatorNameByFCMToken(salesData.fcmToken);
      if (operatorResult.success && operatorResult.name) {
        operatorName = operatorResult.name;
      }
    } else {
      // フォールバック: PropertiesService
      const userProperties = PropertiesService.getUserProperties();
      operatorName = userProperties.getProperty('OPERATOR_NAME') || 'システム';
    }

    // ヘッダー取得
    const { map } = getHeaderMapCommon();

    // 管理番号で行を検索
    const dataRange = sheet.getDataRange();
    const data = dataRange.getValues();
    let targetRow = -1;

    const managementCol = map['管理番号'];
    if (!managementCol) {
      return { success: false, message: '管理番号列が見つかりません' };
    }

    for (let i = 1; i < data.length; i++) {
      if (data[i][managementCol - 1] === salesData.managementNumber) {
        targetRow = i + 1; // スプレッドシートの行番号（1-indexed）
        break;
      }
    }

    if (targetRow === -1) {
      return { success: false, message: '商品が見つかりません' };
    }
    
    // 梱包資材のバリデーション（最大5個）
    if (salesData.packagingMaterials.length > 5) {
      return {
        success: false,
        message: '梱包資材は最大5個までです'
      };
    }

    // 【PERF-001 最適化】販売情報と梱包資材を一括書き込み
    const updateFields = {
      '販売日': salesData.salesDate,
      '販売先': salesData.salesPlatform,
      '販売金額': salesData.salesAmount,
      '発送方法1': salesData.shippingMethod1,
      '発送方法2': salesData.shippingMethod2,
      '送料': salesData.shippingFee,
      '梱包資材費': salesData.packagingCostTotal,
      '手数料': salesData.platformFee,
      '利益金額': salesData.finalProfit,
      '利益率': salesData.profitRate !== null && salesData.profitRate !== undefined
        ? Math.round(salesData.profitRate * 100) / 10000
        : null,
      'ステータス': '販売済み'
    };

    // 梱包資材を追加（最大5個対応）
    for (let i = 0; i < salesData.packagingMaterials.length && i < 5; i++) {
      const material = salesData.packagingMaterials[i];
      updateFields[`梱包資材${i + 1}`] = material.productName;
      updateFields[`梱包費${i + 1}`] = material.unitCost;
    }

    // 一括書き込み実行
    for (const [fieldName, value] of Object.entries(updateFields)) {
      const col = map[fieldName];
      if (col) {
        sheet.getRange(targetRow, col).setValue(value);
      } else {
        Logger.log(`[警告] 列「${fieldName}」が見つかりません`);
      }
    }

    // ユーザー活動記録
    recordUserUpdate(sheet, targetRow, map, operatorName);

    // 備品在庫リストの出庫処理
    const inventoryResult = updatePackagingInventory(salesData.packagingMaterials, salesData.managementNumber);
    if (!inventoryResult.success) {
      Logger.log(`[警告] 備品在庫更新に失敗: ${inventoryResult.message}`);
    }
    
    // 入出庫履歴に記録（一括処理で高速化）
    if (salesData.packagingMaterials.length > 0) {
      try {
        const historyArray = salesData.packagingMaterials.map(material => ({
          materialName: material.productName,
          type: '出庫',
          quantity: 1,
          reason: '販売記録',
          relatedSalesRecord: salesData.managementNumber,
          note: `自動記録（販売記録保存時）`,
          operator: operatorName
        }));
        
        const historyResult = addBatchInventoryHistoryAPI(historyArray);
        
        if (!historyResult.success) {
          Logger.log(`[警告] 入出庫履歴記録に失敗: ${historyResult.message}`);
        } else {
          Logger.log(`[入出庫履歴] ${historyResult.count}件を一括記録しました`);
        }
      } catch (historyError) {
        Logger.log(`[警告] 入出庫履歴記録エラー: ${historyError.message}`);
      }
    }

    // 統計情報の再計算を削除（PERF-001: パフォーマンス改善）
    // 理由: 全商品スキャンが保存時間のボトルネック（5-10秒）
    // 統計は表示時にオンデマンドで計算（Phase 4で実装）
    // recalculateAllStats();

    Logger.log(`[販売記録] ${salesData.managementNumber} を保存しました`);

    // [REMOVED] INV-006: 在庫アラートチェック - PWA master-manager.js + Firestoreに移行済み

    return { success: true, message: '販売記録を保存しました' };
    
  } catch (error) {
    Logger.log(`[ERROR] saveSalesRecordAPI: ${error.message}`);
    return { success: false, message: error.toString() };
  }
}

/**
 * 備品在庫更新処理
 * 梱包資材の出庫数を増やし、在庫数を減らす
 * @param {Array} packagingMaterials - 梱包資材リスト
 * @param {string} managementNumber - 関連販売記録の管理番号（オプション）
 */
function updatePackagingInventory(packagingMaterials, managementNumber) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '備品在庫リスト';
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) {
      return {
        success: false,
        message: `シート「${sheetName}」が見つかりません`
      };
    }

    const data = sheet.getDataRange().getValues();
    if (data.length < 2) {
      return { success: true, message: '備品在庫リストにデータがありません' };
    }

    const headers = data[0];

    // 列インデックスを取得
    const colMap = {};
    headers.forEach((header, index) => {
      colMap[header] = index;
    });

    // 必須列のチェック
    if (colMap['商品名'] === undefined || colMap['出庫数合計'] === undefined) {
      return {
        success: false,
        message: '必要な列（商品名、出庫数合計）が見つかりません'
      };
    }

    // 【PERF-001 最適化】更新対象をまとめて一括更新
    const updates = [];
    let updatedCount = 0;

    for (const material of packagingMaterials) {
      if (!material.productName || material.productName === 'なし') {
        continue; // 「なし」はスキップ
      }

      let found = false;

      for (let i = 1; i < data.length; i++) {
        if (data[i][colMap['商品名']] === material.productName) {
          const targetRow = i + 1; // 1-indexed
          const currentOutStock = Number(data[i][colMap['出庫数合計']]) || 0;

          // 更新データを配列に追加
          updates.push({
            row: targetRow,
            col: colMap['出庫数合計'] + 1,
            value: currentOutStock + 1
          });

          updatedCount++;
          found = true;
          break;
        }
      }

      if (!found) {
        Logger.log(`[警告] 梱包資材「${material.productName}」が備品在庫リストに見つかりません`);
      }
    }

    // 一括更新実行
    for (const update of updates) {
      sheet.getRange(update.row, update.col).setValue(update.value);
    }

    Logger.log(`[備品在庫] ${updatedCount}件の出庫処理を実行しました`);
    return { success: true, message: `${updatedCount}件の備品在庫を更新しました` };

  } catch (error) {
    Logger.log(`[ERROR] updatePackagingInventory: ${error.message}`);
    return { success: false, message: error.toString() };
  }
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

/**
 * FCMトークンから担当者名を取得
 * @param {string} fcmToken - FCMトークン
 * @return {Object} 取得結果
 */
function getOperatorNameByFCMToken(fcmToken) {
  try {
    Logger.log('=== getOperatorNameByFCMToken 開始 ===');
    Logger.log('FCMトークン: ' + (fcmToken ? fcmToken.substring(0, 20) + '...' : 'なし'));

    if (!fcmToken) {
      Logger.log('FCMトークンが指定されていません');
      // フォールバック: PropertiesServiceから取得
      const userProperties = PropertiesService.getUserProperties();
      const name = userProperties.getProperty('OPERATOR_NAME');
      return {
        success: true,
        name: name || '',
        source: 'properties'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FCM通知登録');

    if (!sheet) {
      Logger.log('FCM通知登録シートが見つかりません');
      // フォールバック: PropertiesServiceから取得
      const userProperties = PropertiesService.getUserProperties();
      const name = userProperties.getProperty('OPERATOR_NAME');
      return {
        success: true,
        name: name || '',
        source: 'properties'
      };
    }

    // データ範囲を取得（ヘッダー行を除く）
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log('FCM通知登録シートにデータがありません');
      return {
        success: true,
        name: '',
        source: 'none'
      };
    }

    const dataRange = sheet.getRange(2, 1, lastRow - 1, 7); // 列1〜7
    const data = dataRange.getValues();

    Logger.log('FCM通知登録シートのデータ件数: ' + data.length);

    // FCMトークンで検索（列4）
    for (let i = 0; i < data.length; i++) {
      const rowToken = data[i][3]; // 列4: FCMトークン
      if (rowToken === fcmToken) {
        const userName = data[i][1]; // 列2: ユーザー名
        Logger.log('✅ FCMトークンに一致するユーザー名を発見: ' + userName);
        return {
          success: true,
          name: userName || '',
          source: 'fcm_sheet'
        };
      }
    }

    Logger.log('⚠️ FCMトークンに一致するデータが見つかりませんでした');
    // フォールバック: PropertiesServiceから取得
    const userProperties = PropertiesService.getUserProperties();
    const name = userProperties.getProperty('OPERATOR_NAME');
    return {
      success: true,
      name: name || '',
      source: 'properties_fallback'
    };

  } catch (error) {
    Logger.log('❌ FCMトークンから担当者名取得エラー: ' + error.message);
    // エラー時もフォールバック
    try {
      const userProperties = PropertiesService.getUserProperties();
      const name = userProperties.getProperty('OPERATOR_NAME');
      return {
        success: true,
        name: name || '',
        source: 'properties_error'
      };
    } catch (fallbackError) {
      return {
        success: false,
        name: '',
        error: error.message
      };
    }
  }
}

/**
 * FCM通知登録API（スプレッドシート + Firestore保存）
 * @param {Object} params - リクエストパラメータ
 * @return {ContentService} JSON形式のレスポンス
 */
function subscribeFCMAPI(params) {
  try {
    Logger.log('=== subscribeFCMAPI 開始 ===');
    Logger.log('パラメータ: ' + JSON.stringify(params));

    const token = params.token;
    const userId = params.userId;
    const userName = params.userName;
    const email = params.email;
    const permission = params.permission || 'スタッフ';
    const deviceInfo = params.deviceInfo ? JSON.parse(params.deviceInfo) : {};
    const notificationEnabled = params.notificationEnabled === 'true';
    const notificationSound = params.notificationSound === 'true';

    if (!token || !userId) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: 'トークンまたはユーザーIDが指定されていません'
      }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader('Access-Control-Allow-Origin', '*')
        .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        .setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    // 1. スプレッドシートに保存（既存処理）
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FCM通知登録');

    if (!sheet) {
      Logger.log('FCM通知登録シートが見つかりません');
    } else {
      const lastRow = sheet.getLastRow();
      const dataRange = sheet.getRange(2, 1, Math.max(lastRow - 1, 1), 7);
      const data = dataRange.getValues();

      let foundRow = -1;
      for (let i = 0; i < data.length; i++) {
        if (data[i][0] === userId) {
          foundRow = i + 2;
          break;
        }
      }

      const now = new Date();
      if (foundRow > 0) {
        // 更新
        sheet.getRange(foundRow, 1, 1, 7).setValues([[
          userId,
          userName,
          email,
          token,
          permission,
          now,
          JSON.stringify(deviceInfo)
        ]]);
        Logger.log('スプレッドシート更新: 行' + foundRow);
      } else {
        // 新規追加
        sheet.appendRow([
          userId,
          userName,
          email,
          token,
          permission,
          now,
          JSON.stringify(deviceInfo)
        ]);
        Logger.log('スプレッドシート新規追加');
      }
    }

    // 2. Firestoreに保存（Firebase Functions用）
    // TODO: FirestoreApp libraryの初期化が必要
    // try {
    //   const firestore = getFirestoreApp();
    //   const userDocName = userName || userId;
    //
    //   firestore.updateDocument('users/' + userDocName, {
    //     fcmToken: token,
    //     email: email || userId,
    //     userName: userName,
    //     permission: permission,
    //     notificationEnabled: notificationEnabled,
    //     notificationSound: notificationSound,
    //     deviceInfo: deviceInfo,
    //     updatedAt: new Date().toISOString()
    //   }, true); // mergeオプション
    //
    //   Logger.log('✅ Firestoreに保存: users/' + userDocName);
    // } catch (firestoreError) {
    //   Logger.log('⚠️ Firestore保存エラー（スプレッドシートには保存済み）: ' + firestoreError);
    // }
    Logger.log('⏭️ Firestore保存は次フェーズで実装（スプレッドシートには保存済み）');

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'FCM登録が完了しました'
    }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type');

  } catch (error) {
    Logger.log('[subscribeFCMAPI] ERROR: ' + error);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: 'FCM登録エラー: ' + error.toString()
    }))
      .setMimeType(ContentService.MimeType.JSON)
      .setHeader('Access-Control-Allow-Origin', '*')
      .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      .setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
}