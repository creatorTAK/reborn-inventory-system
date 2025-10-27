/**
 * packaging_materials_manager.js
 * 梱包資材マスタ管理システム
 * SaaS化を見据えたUI経由でのマスタデータ管理
 */

// =============================================================================
// サイドバー表示
// =============================================================================

/**
 * 梱包資材マスタ管理サイドバーを表示
 */
function showPackagingMaterialsManager() {
  const html = HtmlService.createTemplateFromFile('packaging_materials_ui');
  const sidebar = html.evaluate()
    .setTitle('📦 梱包資材マスタ管理')
    .setWidth(500);
  SpreadsheetApp.getUi().showSidebar(sidebar);
}

// =============================================================================
// データ取得API
// =============================================================================

/**
 * 梱包資材マスタの全データを取得
 * @returns {Object} { success: boolean, data: Array, message: string }
 */
function getPackagingMaterialsAPI() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('備品在庫リスト');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「備品在庫リスト」が見つかりません。先に販売記録機能セットアップを実行してください。',
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

    // ヘッダー行を除く全データを取得（11列）
    const values = sheet.getRange(2, 1, lastRow - 1, 11).getValues();

    const data = values.map((row, index) => ({
      rowIndex: index + 2, // スプレッドシートの行番号（1-indexed、ヘッダー除く）
      imageUrl: row[0] || '',
      productName: row[1] || '',
      supplier: row[2] || '',
      productLink: row[3] || '',
      quantity: Number(row[4]) || 0,
      price: Number(row[5]) || 0,
      abbreviation: row[6] || '',
      unitCost: Number(row[7]) || 0,
      inStock: Number(row[8]) || 0,
      outStock: Number(row[9]) || 0,
      inventory: Number(row[10]) || 0
    })).filter(item => item.abbreviation); // 略称が空の行を除外

    return {
      success: true,
      data: data,
      message: `${data.length}件のデータを取得しました`
    };

  } catch (error) {
    console.error('梱包資材マスタ取得エラー:', error);
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
 * 梱包資材を新規追加
 * @param {Object} params - { imageUrl, productName, supplier, productLink, quantity, price, abbreviation, inStock }
 * @returns {Object} { success: boolean, message: string }
 */
function addPackagingMaterialAPI(params) {
  try {
    // バリデーション
    if (!params.productName || !params.abbreviation) {
      return {
        success: false,
        message: '商品名と略称は必須です'
      };
    }

    if (typeof params.quantity !== 'number' || params.quantity <= 0) {
      return {
        success: false,
        message: '個数は1以上の数値で入力してください'
      };
    }

    if (typeof params.price !== 'number' || params.price < 0) {
      return {
        success: false,
        message: '価格は0以上の数値で入力してください'
      };
    }

    if (typeof params.inStock !== 'number' || params.inStock < 0) {
      return {
        success: false,
        message: '入庫数は0以上の数値で入力してください'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('備品在庫リスト');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「備品在庫リスト」が見つかりません'
      };
    }

    // 重複チェック（略称で判定）
    const existingData = getPackagingMaterialsAPI();
    if (existingData.success) {
      const duplicate = existingData.data.find(item =>
        item.abbreviation === params.abbreviation
      );

      if (duplicate) {
        return {
          success: false,
          message: `同じ略称の梱包資材が既に登録されています（${params.abbreviation}）`
        };
      }
    }

    // 新規行を追加
    const lastRow = sheet.getLastRow();
    const unitCost = params.quantity > 0 ? params.price / params.quantity : 0;
    const outStock = 0; // 初期値
    const inventory = params.inStock - outStock;

    const newRow = [
      params.imageUrl || '',
      params.productName,
      params.supplier || '',
      params.productLink || '',
      params.quantity,
      params.price,
      params.abbreviation,
      `=F${lastRow + 1}/E${lastRow + 1}`, // 1個あたりの計算式
      params.inStock,
      outStock,
      `=I${lastRow + 1}-J${lastRow + 1}` // 在庫数の計算式
    ];

    sheet.getRange(lastRow + 1, 1, 1, 11).setValues([newRow]);

    // フォーマット適用
    sheet.getRange(lastRow + 1, 5).setNumberFormat('#,##0');      // 個数
    sheet.getRange(lastRow + 1, 6).setNumberFormat('¥#,##0');     // 価格
    sheet.getRange(lastRow + 1, 8).setNumberFormat('¥#,##0.00');  // 1個あたり
    sheet.getRange(lastRow + 1, 9).setNumberFormat('#,##0');      // 入庫数
    sheet.getRange(lastRow + 1, 10).setNumberFormat('#,##0');     // 出庫数
    sheet.getRange(lastRow + 1, 11).setNumberFormat('#,##0');     // 在庫数

    // 罫線適用
    const dataRange = sheet.getRange(1, 1, lastRow + 1, 11);
    dataRange.setBorder(true, true, true, true, true, true);

    Logger.log(`梱包資材追加: ${params.productName} (${params.abbreviation}) ¥${params.price}`);

    return {
      success: true,
      message: '梱包資材を追加しました'
    };

  } catch (error) {
    console.error('梱包資材追加エラー:', error);
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
 * 梱包資材を編集
 * @param {Object} params - { rowIndex, imageUrl, productName, supplier, productLink, quantity, price, abbreviation, inStock }
 * @returns {Object} { success: boolean, message: string }
 */
function updatePackagingMaterialAPI(params) {
  try {
    // バリデーション
    if (!params.rowIndex || params.rowIndex < 2) {
      return {
        success: false,
        message: '無効な行番号です'
      };
    }

    if (!params.productName || !params.abbreviation) {
      return {
        success: false,
        message: '商品名と略称は必須です'
      };
    }

    if (typeof params.quantity !== 'number' || params.quantity <= 0) {
      return {
        success: false,
        message: '個数は1以上の数値で入力してください'
      };
    }

    if (typeof params.price !== 'number' || params.price < 0) {
      return {
        success: false,
        message: '価格は0以上の数値で入力してください'
      };
    }

    if (typeof params.inStock !== 'number' || params.inStock < 0) {
      return {
        success: false,
        message: '入庫数は0以上の数値で入力してください'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('備品在庫リスト');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「備品在庫リスト」が見つかりません'
      };
    }

    // 重複チェック（自分自身を除く）
    const existingData = getPackagingMaterialsAPI();
    if (existingData.success) {
      const duplicate = existingData.data.find(item =>
        item.rowIndex !== params.rowIndex &&
        item.abbreviation === params.abbreviation
      );

      if (duplicate) {
        return {
          success: false,
          message: `同じ略称の梱包資材が既に登録されています（${params.abbreviation}）`
        };
      }
    }

    // 現在の出庫数を取得
    const currentOutStock = sheet.getRange(params.rowIndex, 10).getValue() || 0;

    // データ更新
    const updateRow = [
      params.imageUrl || '',
      params.productName,
      params.supplier || '',
      params.productLink || '',
      params.quantity,
      params.price,
      params.abbreviation,
      `=F${params.rowIndex}/E${params.rowIndex}`, // 1個あたりの計算式
      params.inStock,
      currentOutStock, // 出庫数は既存値を維持
      `=I${params.rowIndex}-J${params.rowIndex}` // 在庫数の計算式
    ];

    sheet.getRange(params.rowIndex, 1, 1, 11).setValues([updateRow]);

    // フォーマット適用
    sheet.getRange(params.rowIndex, 5).setNumberFormat('#,##0');      // 個数
    sheet.getRange(params.rowIndex, 6).setNumberFormat('¥#,##0');     // 価格
    sheet.getRange(params.rowIndex, 8).setNumberFormat('¥#,##0.00');  // 1個あたり
    sheet.getRange(params.rowIndex, 9).setNumberFormat('#,##0');      // 入庫数
    sheet.getRange(params.rowIndex, 10).setNumberFormat('#,##0');     // 出庫数
    sheet.getRange(params.rowIndex, 11).setNumberFormat('#,##0');     // 在庫数

    Logger.log(`梱包資材更新: 行${params.rowIndex} - ${params.productName} (${params.abbreviation})`);

    return {
      success: true,
      message: '梱包資材を更新しました'
    };

  } catch (error) {
    console.error('梱包資材更新エラー:', error);
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
 * 梱包資材を削除
 * @param {number} rowIndex - 削除する行番号
 * @returns {Object} { success: boolean, message: string }
 */
function deletePackagingMaterialAPI(rowIndex) {
  try {
    // バリデーション
    if (!rowIndex || rowIndex < 2) {
      return {
        success: false,
        message: '無効な行番号です'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('備品在庫リスト');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「備品在庫リスト」が見つかりません'
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
    const deletedData = sheet.getRange(rowIndex, 1, 1, 11).getValues()[0];

    // 行を削除
    sheet.deleteRow(rowIndex);

    Logger.log(`梱包資材削除: ${deletedData[1]} (${deletedData[6]})`);

    return {
      success: true,
      message: '梱包資材を削除しました'
    };

  } catch (error) {
    console.error('梱包資材削除エラー:', error);
    return {
      success: false,
      message: `削除エラー: ${error.message}`
    };
  }
}
