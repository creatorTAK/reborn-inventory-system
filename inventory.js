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