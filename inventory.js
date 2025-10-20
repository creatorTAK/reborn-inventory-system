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
    const filters = {
      status: params.status || '',
      brand: params.brand || '',
      category: params.category || '',
      person: params.person || ''
    };

    const sh = getSheet();
    const lastRow = sh.getLastRow();

    if (lastRow < INVENTORY_START_ROW) {
      return jsonSuccessResponse({ products: [], count: 0 });
    }

    const { map } = getHeaderMapCommon();
    const managementCol = colByName(sh, INVENTORY_HEADERS.key);

    const results = [];

    for (let row = INVENTORY_START_ROW; row <= lastRow; row++) {
      const managementNumber = getCellValue(sh, row, managementCol);
      if (!managementNumber) continue;

      // フィルター適用
      const status = getCellValue(sh, row, map['ステータス']);
      const brand = getCellValue(sh, row, map['ブランド(英語)']);
      const category = getCellValue(sh, row, map['大分類(カテゴリ)']);
      const person = getCellValue(sh, row, map['担当者']);

      if (filters.status && status !== filters.status) continue;
      if (filters.brand && brand !== filters.brand) continue;
      if (filters.category && category !== filters.category) continue;
      if (filters.person && person !== filters.person) continue;

      // 商品情報を追加
      results.push({
        managementNumber: managementNumber,
        person: person,
        category: category,
        brand: brand,
        itemName: getCellValue(sh, row, map['アイテム名']),
        size: getCellValue(sh, row, map['サイズ']),
        status: status,
        purchaseAmount: getCellValue(sh, row, map['仕入金額']),
        listingAmount: getCellValue(sh, row, map['出品金額']),
        saleAmount: getCellValue(sh, row, map['販売金額']),
        profit: getCellValue(sh, row, map['利益']),

        // Phase 1: 新しい列
        registrant: getCellValue(sh, row, map['登録者']),
        registeredAt: getCellValue(sh, row, map['登録日時']),
        lastEditor: getCellValue(sh, row, map['最終更新者']),
        updatedAt: getCellValue(sh, row, map['更新日時']),
        imageUrl1: getCellValue(sh, row, map['画像URL1'])
      });
    }

    return jsonSuccessResponse({
      products: results,
      count: results.length,
      filters: filters
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

    sh.getRange(row, col).setValue(value);

    // ユーザー活動記録
    recordUserUpdate(sh, row, map, editor || 'システム');

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
  try {
    const sh = getSheet();
    const lastRow = sh.getLastRow();

    if (lastRow < INVENTORY_START_ROW) {
      return jsonSuccessResponse({
        total: 0,
        inStock: 0,
        sold: 0,
        totalPurchaseAmount: 0,
        totalSaleAmount: 0,
        totalProfit: 0
      });
    }

    const { map } = getHeaderMapCommon();

    let total = 0;
    let inStock = 0;
    let sold = 0;
    let totalPurchaseAmount = 0;
    let totalSaleAmount = 0;
    let totalProfit = 0;

    for (let row = INVENTORY_START_ROW; row <= lastRow; row++) {
      const managementNumber = getCellValue(sh, row, colByName(sh, INVENTORY_HEADERS.key));
      if (!managementNumber) continue;

      total++;

      const status = getCellValue(sh, row, map['ステータス']);
      if (status === '在庫中' || status === '出品中') inStock++;
      if (status === '販売完了') sold++;

      const purchaseAmount = Number(getCellValue(sh, row, map['仕入金額'])) || 0;
      const saleAmount = Number(getCellValue(sh, row, map['販売金額'])) || 0;
      const profit = Number(getCellValue(sh, row, map['利益'])) || 0;

      totalPurchaseAmount += purchaseAmount;
      totalSaleAmount += saleAmount;
      totalProfit += profit;
    }

    return jsonSuccessResponse({
      total: total,
      inStock: inStock,
      sold: sold,
      totalPurchaseAmount: totalPurchaseAmount,
      totalSaleAmount: totalSaleAmount,
      totalProfit: totalProfit,
      averageProfit: sold > 0 ? Math.round(totalProfit / sold) : 0
    });

  } catch (error) {
    return jsonErrorResponse(`統計取得エラー: ${error.message}`);
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