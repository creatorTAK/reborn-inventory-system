/**
 * shipping_method_master_manager.js
 * 発送方法マスタ管理システム
 * SaaS化を見据えたUI経由でのマスタデータ管理
 */

// =============================================================================
// サイドバー表示
// =============================================================================

/**
 * 発送方法マスタ管理サイドバーを表示
 */
function showShippingMethodMasterManager() {
  const html = HtmlService.createTemplateFromFile('shipping_method_master_ui');
  const sidebar = html.evaluate()
    .setTitle('🚚 発送方法マスタ管理')
    .setWidth(500);
  SpreadsheetApp.getUi().showSidebar(sidebar);
}

// =============================================================================
// データ取得API
// =============================================================================

/**
 * 発送方法マスタの全データを取得
 * @returns {Object} { success: boolean, data: Array, message: string }
 */
function getShippingMethodsAPI() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('発送方法マスタ');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「発送方法マスタ」が見つかりません。先に販売記録機能セットアップを実行してください。',
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

    // ヘッダー行を除く全データを取得
    const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

    const data = values.map((row, index) => ({
      rowIndex: index + 2, // スプレッドシートの行番号（1-indexed、ヘッダー除く）
      method1: row[0] || '',
      method2: row[1] || '',
      fee: row[2] || 0
    })).filter(item => item.method1 || item.method2); // 空行を除外

    return {
      success: true,
      data: data,
      message: `${data.length}件のデータを取得しました`
    };

  } catch (error) {
    console.error('発送方法マスタ取得エラー:', error);
    return {
      success: false,
      message: `データ取得エラー: ${error.message}`,
      data: []
    };
  }
}

// =============================================================================
// データ追加API
// =============================================================================

/**
 * 発送方法を新規追加
 * @param {Object} params - { method1: string, method2: string, fee: number }
 * @returns {Object} { success: boolean, message: string }
 */
function addShippingMethodAPI(params) {
  try {
    // バリデーション
    if (!params.method1 || !params.method2) {
      return {
        success: false,
        message: '発送方法（カテゴリ）と発送方法（詳細）は必須です'
      };
    }

    if (typeof params.fee !== 'number' || params.fee < 0) {
      return {
        success: false,
        message: '送料は0以上の数値で入力してください'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('発送方法マスタ');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「発送方法マスタ」が見つかりません'
      };
    }

    // 重複チェック
    const existingData = getShippingMethodsAPI();
    if (existingData.success) {
      const duplicate = existingData.data.find(item =>
        item.method1 === params.method1 && item.method2 === params.method2
      );

      if (duplicate) {
        return {
          success: false,
          message: `同じ発送方法が既に登録されています（${params.method1} - ${params.method2}）`
        };
      }
    }

    // 新規行を追加
    const lastRow = sheet.getLastRow();
    const newRow = [params.method1, params.method2, params.fee];

    sheet.getRange(lastRow + 1, 1, 1, 3).setValues([newRow]);

    // フォーマット適用
    sheet.getRange(lastRow + 1, 3).setNumberFormat('¥#,##0');

    // 罫線適用
    const dataRange = sheet.getRange(1, 1, lastRow + 1, 3);
    dataRange.setBorder(true, true, true, true, true, true);

    Logger.log(`発送方法追加: ${params.method1} - ${params.method2} (¥${params.fee})`);

    return {
      success: true,
      message: '発送方法を追加しました'
    };

  } catch (error) {
    console.error('発送方法追加エラー:', error);
    return {
      success: false,
      message: `追加エラー: ${error.message}`
    };
  }
}

// =============================================================================
// データ更新API
// =============================================================================

/**
 * 発送方法を編集
 * @param {Object} params - { rowIndex: number, method1: string, method2: string, fee: number }
 * @returns {Object} { success: boolean, message: string }
 */
function updateShippingMethodAPI(params) {
  try {
    // バリデーション
    if (!params.rowIndex || params.rowIndex < 2) {
      return {
        success: false,
        message: '無効な行番号です'
      };
    }

    if (!params.method1 || !params.method2) {
      return {
        success: false,
        message: '発送方法（カテゴリ）と発送方法（詳細）は必須です'
      };
    }

    if (typeof params.fee !== 'number' || params.fee < 0) {
      return {
        success: false,
        message: '送料は0以上の数値で入力してください'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('発送方法マスタ');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「発送方法マスタ」が見つかりません'
      };
    }

    // 重複チェック（自分自身を除く）
    const existingData = getShippingMethodsAPI();
    if (existingData.success) {
      const duplicate = existingData.data.find(item =>
        item.rowIndex !== params.rowIndex &&
        item.method1 === params.method1 &&
        item.method2 === params.method2
      );

      if (duplicate) {
        return {
          success: false,
          message: `同じ発送方法が既に登録されています（${params.method1} - ${params.method2}）`
        };
      }
    }

    // データ更新
    const updateRow = [params.method1, params.method2, params.fee];
    sheet.getRange(params.rowIndex, 1, 1, 3).setValues([updateRow]);

    // フォーマット適用
    sheet.getRange(params.rowIndex, 3).setNumberFormat('¥#,##0');

    Logger.log(`発送方法更新: 行${params.rowIndex} - ${params.method1} - ${params.method2} (¥${params.fee})`);

    return {
      success: true,
      message: '発送方法を更新しました'
    };

  } catch (error) {
    console.error('発送方法更新エラー:', error);
    return {
      success: false,
      message: `更新エラー: ${error.message}`
    };
  }
}

// =============================================================================
// データ削除API
// =============================================================================

/**
 * 発送方法を削除
 * @param {number} rowIndex - 削除する行番号
 * @returns {Object} { success: boolean, message: string }
 */
function deleteShippingMethodAPI(rowIndex) {
  try {
    // バリデーション
    if (!rowIndex || rowIndex < 2) {
      return {
        success: false,
        message: '無効な行番号です'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('発送方法マスタ');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「発送方法マスタ」が見つかりません'
      };
    }

    const lastRow = sheet.getLastRow();
    if (rowIndex > lastRow) {
      return {
        success: false,
        message: '指定された行が見つかりません'
      };
    }

    // 削除前のデータを取得（ログ用）
    const deletedData = sheet.getRange(rowIndex, 1, 1, 3).getValues()[0];

    // 行を削除
    sheet.deleteRow(rowIndex);

    Logger.log(`発送方法削除: ${deletedData[0]} - ${deletedData[1]} (¥${deletedData[2]})`);

    return {
      success: true,
      message: '発送方法を削除しました'
    };

  } catch (error) {
    console.error('発送方法削除エラー:', error);
    return {
      success: false,
      message: `削除エラー: ${error.message}`
    };
  }
}
