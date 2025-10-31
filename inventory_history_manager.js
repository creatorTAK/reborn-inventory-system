/**
 * inventory_history_manager.js
 * 入出庫履歴管理システム
 * トレーサビリティ強化のための履歴記録・管理機能
 */

// =============================================================================
// シート作成・初期設定
// =============================================================================

/**
 * 入出庫履歴シートを作成
 * @returns {Object} { success: boolean, message: string }
 */
function createInventoryHistorySheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetName = '入出庫履歴';

    // シートが既に存在する場合はスキップ
    let sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      return {
        success: true,
        message: `シート「${sheetName}」は既に存在します`
      };
    }

    // 新規シート作成
    sheet = ss.insertSheet(sheetName);

    // ヘッダー行を設定
    const headers = [
      '日時',
      '操作者',
      '資材名',
      '種別',
      '数量',
      '理由',
      '関連販売記録',
      '備考'
    ];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // ヘッダー行のスタイル設定
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#f59e0b');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');

    // 列幅設定
    sheet.setColumnWidth(1, 150); // 日時
    sheet.setColumnWidth(2, 200); // 操作者
    sheet.setColumnWidth(3, 200); // 資材名
    sheet.setColumnWidth(4, 80);  // 種別
    sheet.setColumnWidth(5, 80);  // 数量
    sheet.setColumnWidth(6, 150); // 理由
    sheet.setColumnWidth(7, 150); // 関連販売記録
    sheet.setColumnWidth(8, 250); // 備考

    // 行の固定（ヘッダー行）
    sheet.setFrozenRows(1);

    // 罫線を設定
    headerRange.setBorder(true, true, true, true, true, true);

    Logger.log(`シート「${sheetName}」を作成しました`);

    return {
      success: true,
      message: `シート「${sheetName}」を作成しました`
    };

  } catch (error) {
    Logger.log(`シート作成エラー: ${error.message}`);
    return {
      success: false,
      message: `シート作成エラー: ${error.message}`
    };
  }
}

// =============================================================================
// データ追加API
// =============================================================================

/**
 * 入出庫履歴を追加
 * @param {Object} params - { materialName, type, quantity, reason, relatedSalesRecord, note, operator }
 * @returns {Object} { success: boolean, message: string }
 */
function addInventoryHistoryAPI(params) {
  try {
    // バリデーション
    if (!params.materialName) {
      return {
        success: false,
        message: '資材名は必須です'
      };
    }

    if (!params.type || !['入庫', '出庫', '調整'].includes(params.type)) {
      return {
        success: false,
        message: '種別は「入庫」「出庫」「調整」のいずれかを指定してください'
      };
    }

    if (typeof params.quantity !== 'number' || params.quantity <= 0) {
      return {
        success: false,
        message: '数量は1以上の数値で入力してください'
      };
    }

    if (!params.reason) {
      return {
        success: false,
        message: '理由は必須です'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('入出庫履歴');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「入出庫履歴」が見つかりません。先にシートを作成してください。'
      };
    }

    // 新規行を追加
    const lastRow = sheet.getLastRow();
    const timestamp = new Date();
    const operator = params.operator || Session.getActiveUser().getEmail() || 'システム';

    // 入庫時のみ価格情報を保存
    const purchasePrice = params.type === '入庫' ? (params.purchasePrice || '') : '';
    const packageQuantity = params.type === '入庫' ? (params.packageQuantity || '') : '';
    const unitCost = params.type === '入庫' ? (params.unitCost || '') : '';

    const newRow = [
      timestamp,
      operator,
      params.materialName,
      params.type,
      params.quantity,
      params.reason,
      params.relatedSalesRecord || '',
      params.note || '',
      purchasePrice,
      packageQuantity,
      unitCost
    ];

    sheet.getRange(lastRow + 1, 1, 1, 11).setValues([newRow]);

    // フォーマット適用
    sheet.getRange(lastRow + 1, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss'); // 日時
    sheet.getRange(lastRow + 1, 5).setNumberFormat('#,##0'); // 数量
    sheet.getRange(lastRow + 1, 9).setNumberFormat('#,##0'); // 購入価格
    sheet.getRange(lastRow + 1, 10).setNumberFormat('#,##0'); // 購入個数
    sheet.getRange(lastRow + 1, 11).setNumberFormat('#,##0.00'); // 単価

    // 罫線適用
    const dataRange = sheet.getRange(1, 1, lastRow + 1, 11);
    dataRange.setBorder(true, true, true, true, true, true);

    Logger.log(`入出庫履歴追加: ${params.materialName} ${params.type} ${params.quantity}個`);

    return {
      success: true,
      message: '入出庫履歴を追加しました'
    };

  } catch (error) {
    Logger.log(`入出庫履歴追加エラー: ${error.message}`);
    return {
      success: false,
      message: `追加エラー: ${error.message}`
    };
  }
}

/**
 * 入庫登録（履歴記録 + 備品在庫リスト更新）
 * @param {Object} params - { materialName, quantity, reason, relatedSalesRecord, note, operator }
 * @returns {Object} { success: boolean, message: string }
 */
function registerInboundAPI(params) {
  try {
    // バリデーション
    if (!params.materialName) {
      return {
        success: false,
        message: '資材名は必須です'
      };
    }

    if (typeof params.quantity !== 'number' || params.quantity <= 0) {
      return {
        success: false,
        message: '数量は1以上の数値で入力してください'
      };
    }

    if (!params.reason) {
      return {
        success: false,
        message: '理由は必須です'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const inventorySheet = ss.getSheetByName('備品在庫リスト');

    if (!inventorySheet) {
      return {
        success: false,
        message: 'シート「備品在庫リスト」が見つかりません'
      };
    }

    // 資材を検索
    const lastRow = inventorySheet.getLastRow();
    if (lastRow < 2) {
      return {
        success: false,
        message: '備品在庫リストにデータがありません'
      };
    }

    const productNames = inventorySheet.getRange(2, 2, lastRow - 1, 1).getValues();
    let targetRow = -1;

    for (let i = 0; i < productNames.length; i++) {
      if (productNames[i][0] === params.materialName) {
        targetRow = i + 2; // スプレッドシートの行番号（1-indexed、ヘッダー除く）
        break;
      }
    }

    if (targetRow === -1) {
      return {
        success: false,
        message: `資材「${params.materialName}」が備品在庫リストに見つかりません`
      };
    }

    // 入庫数合計を更新（I列 = 9列目）
    const currentInStock = inventorySheet.getRange(targetRow, 9).getValue() || 0;
    inventorySheet.getRange(targetRow, 9).setValue(currentInStock + params.quantity);

    Logger.log(`[入庫登録] ${params.materialName}: 入庫数 ${currentInStock} → ${currentInStock + params.quantity}`);

    // 入出庫履歴に記録
    const historyResult = addInventoryHistoryAPI({
      materialName: params.materialName,
      type: '入庫',
      quantity: params.quantity,
      reason: params.reason,
      relatedSalesRecord: params.relatedSalesRecord || '',
      note: params.note || '',
      operator: params.operator || 'ユーザー',
      purchasePrice: params.purchasePrice,
      packageQuantity: params.packageQuantity,
      unitCost: params.unitCost
    });

    if (!historyResult.success) {
      return {
        success: false,
        message: `履歴記録に失敗: ${historyResult.message}`
      };
    }

    return {
      success: true,
      message: `${params.materialName}を${params.quantity}個入庫しました`
    };

  } catch (error) {
    Logger.log(`入庫登録エラー: ${error.message}`);
    return {
      success: false,
      message: `入庫登録エラー: ${error.message}`
    };
  }
}

/**
 * 入出庫履歴を一括追加（パフォーマンス最適化版）
 * @param {Array} historyArray - [{ materialName, type, quantity, reason, relatedSalesRecord, note, operator }, ...]
 * @returns {Object} { success: boolean, message: string, count: number }
 */
function addBatchInventoryHistoryAPI(historyArray) {
  try {
    if (!Array.isArray(historyArray) || historyArray.length === 0) {
      return {
        success: false,
        message: '履歴データが空です',
        count: 0
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('入出庫履歴');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「入出庫履歴」が見つかりません。先にシートを作成してください。',
        count: 0
      };
    }

    // バリデーション
    for (let i = 0; i < historyArray.length; i++) {
      const params = historyArray[i];
      
      if (!params.materialName) {
        return {
          success: false,
          message: `${i + 1}件目: 資材名は必須です`,
          count: 0
        };
      }

      if (!params.type || !['入庫', '出庫', '調整'].includes(params.type)) {
        return {
          success: false,
          message: `${i + 1}件目: 種別は「入庫」「出庫」「調整」のいずれかを指定してください`,
          count: 0
        };
      }

      if (typeof params.quantity !== 'number' || params.quantity <= 0) {
        return {
          success: false,
          message: `${i + 1}件目: 数量は1以上の数値で入力してください`,
          count: 0
        };
      }

      if (!params.reason) {
        return {
          success: false,
          message: `${i + 1}件目: 理由は必須です`,
          count: 0
        };
      }
    }

    // 新規行を一括追加
    const lastRow = sheet.getLastRow();
    const timestamp = new Date();
    const rows = [];

    for (const params of historyArray) {
      const operator = params.operator || Session.getActiveUser().getEmail() || 'システム';
      
      rows.push([
        timestamp,
        operator,
        params.materialName,
        params.type,
        params.quantity,
        params.reason,
        params.relatedSalesRecord || '',
        params.note || ''
      ]);
    }

    // 一括書き込み（1回のAPI呼び出し）
    sheet.getRange(lastRow + 1, 1, rows.length, 8).setValues(rows);

    // フォーマット適用（新規追加行のみ）
    const formatRange = sheet.getRange(lastRow + 1, 1, rows.length, 8);
    formatRange.getRange(1, 1, rows.length, 1).setNumberFormat('yyyy-mm-dd hh:mm:ss'); // 日時列
    formatRange.getRange(1, 5, rows.length, 1).setNumberFormat('#,##0'); // 数量列

    // 罫線適用（新規追加行のみ）
    formatRange.setBorder(true, true, true, true, true, true);

    Logger.log(`入出庫履歴一括追加: ${rows.length}件`);

    return {
      success: true,
      message: `入出庫履歴を${rows.length}件追加しました`,
      count: rows.length
    };

  } catch (error) {
    Logger.log(`入出庫履歴一括追加エラー: ${error.message}`);
    return {
      success: false,
      message: `追加エラー: ${error.message}`,
      count: 0
    };
  }
}

// =============================================================================
// データ取得API
// =============================================================================

/**
 * 入出庫履歴を取得（フィルタリング対応）
 * @param {Object} params - { materialName, type, startDate, endDate, limit }
 * @returns {Object} { success: boolean, data: Array, message: string }
 */
function getInventoryHistoryAPI(params) {
  try {
    params = params || {};

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('入出庫履歴');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「入出庫履歴」が見つかりません',
        data: []
      };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return {
        success: true,
        data: [],
        message: 'データがありません'
      };
    }

    // 全データを取得（11列）
    const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();

    let data = values.map((row, index) => ({
      rowIndex: index + 2,
      timestamp: row[0] ? new Date(row[0]).toISOString() : '',
      operator: row[1] || '',
      materialName: row[2] || '',
      type: row[3] || '',
      quantity: Number(row[4]) || 0,
      reason: row[5] || '',
      relatedSalesRecord: row[6] || '',
      note: row[7] || '',
      purchasePrice: row[8] ? Number(row[8]) : null,
      packageQuantity: row[9] ? Number(row[9]) : null,
      unitCost: row[10] ? Number(row[10]) : null
    })).filter(item => item.materialName); // 資材名が空の行を除外

    // フィルタリング
    if (params.materialName) {
      data = data.filter(item => item.materialName === params.materialName);
    }

    if (params.type) {
      data = data.filter(item => item.type === params.type);
    }

    if (params.startDate) {
      const startDate = new Date(params.startDate);
      data = data.filter(item => new Date(item.timestamp) >= startDate);
    }

    if (params.endDate) {
      const endDate = new Date(params.endDate);
      endDate.setHours(23, 59, 59, 999); // 終日まで含める
      data = data.filter(item => new Date(item.timestamp) <= endDate);
    }

    // 日時降順でソート（新しい順）
    data.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // 件数制限
    if (params.limit && params.limit > 0) {
      data = data.slice(0, params.limit);
    }

    return {
      success: true,
      data: data,
      message: `${data.length}件のデータを取得しました`
    };

  } catch (error) {
    Logger.log(`入出庫履歴取得エラー: ${error.message}`);
    return {
      success: false,
      message: `データ取得エラー: ${error.message}`,
      data: []
    };
  }
}

/**
 * 資材別の在庫数を計算（履歴から集計）
 * @param {string} materialName - 資材名
 * @returns {Object} { success: boolean, inventory: number, inStock: number, outStock: number, message: string }
 */
function getInventoryByMaterialAPI(materialName) {
  try {
    if (!materialName) {
      return {
        success: false,
        message: '資材名は必須です',
        inventory: 0,
        inStock: 0,
        outStock: 0
      };
    }

    // 履歴を取得
    const result = getInventoryHistoryAPI({ materialName: materialName });

    if (!result.success) {
      return {
        success: false,
        message: result.message,
        inventory: 0,
        inStock: 0,
        outStock: 0
      };
    }

    // 入庫・出庫を集計
    let inStock = 0;
    let outStock = 0;

    result.data.forEach(item => {
      if (item.type === '入庫') {
        inStock += item.quantity;
      } else if (item.type === '出庫') {
        outStock += item.quantity;
      } else if (item.type === '調整') {
        // 調整は正の値なら入庫、負の値なら出庫として扱う
        if (item.quantity > 0) {
          inStock += item.quantity;
        } else {
          outStock += Math.abs(item.quantity);
        }
      }
    });

    const inventory = inStock - outStock;

    return {
      success: true,
      inventory: inventory,
      inStock: inStock,
      outStock: outStock,
      message: `在庫数: ${inventory}個（入庫: ${inStock}、出庫: ${outStock}）`
    };

  } catch (error) {
    Logger.log(`在庫数計算エラー: ${error.message}`);
    return {
      success: false,
      message: `計算エラー: ${error.message}`,
      inventory: 0,
      inStock: 0,
      outStock: 0
    };
  }
}

/**
 * テスト: 入出庫履歴API動作確認
 */
function testGetInventoryHistoryAPI() {
  const result = getInventoryHistoryAPI({});
  Logger.log('API Result:');
  Logger.log(result);
  
  if (result.success) {
    Logger.log(`データ件数: ${result.data.length}件`);
  } else {
    Logger.log(`エラー: ${result.message}`);
  }
  
  return result;
}
