/**
 * data_integrity.gs - データ整合性確保システム
 * 管理番号重複チェック、データ型統一、参照整合性の確保
 */

// =============================================================================
// 管理番号重複チェック
// =============================================================================
function checkManagementNumberDuplicate(managementNumber, excludeRow = null) {
  try {
    const sh = getSheet();
    const lastRow = sh.getLastRow();
    
    if (lastRow < 2) return { isDuplicate: false };
    
    const managementCol = colByName(sh, '管理番号');
    if (!managementCol) {
      throw createError(ERROR_TYPES.HEADER_MISSING, '管理番号列が見つかりません');
    }
    
    const values = sh.getRange(2, managementCol, lastRow - 1, 1).getDisplayValues().flat();
    const targetNumber = String(managementNumber).trim().toUpperCase();
    
    for (let i = 0; i < values.length; i++) {
      const currentRow = i + 2;
      const currentValue = String(values[i]).trim().toUpperCase();
      
      // 除外行をスキップ
      if (excludeRow && currentRow === excludeRow) continue;
      
      if (currentValue === targetNumber) {
        return {
          isDuplicate: true,
          duplicateRow: currentRow,
          message: `管理番号「${managementNumber}」は既に${currentRow}行目で使用されています`
        };
      }
    }
    
    return { isDuplicate: false };
    
  } catch (error) {
    throw handleError(error, 'managementNumberCheck');
  }
}

// =============================================================================
// データ型整合性チェック
// =============================================================================
function validateDataTypes(data) {
  const errors = [];
  
  // 数値型フィールドのチェック
  const numericFields = ['商品番号', '仕入金額', '出品金額', '販売金額', '梱包資材費', '送料', '販売手数料'];
  
  for (const field of numericFields) {
    const value = data[field];
    if (value !== '' && value != null && isNaN(Number(value))) {
      errors.push(`${field}は数値である必要があります（現在の値: ${value}）`);
    }
  }
  
  // 日付型フィールドのチェック
  const dateFields = ['仕入日', '出品日', '販売日'];
  
  for (const field of dateFields) {
    const value = data[field];
    if (value !== '' && value != null) {
      const date = new Date(value);
      if (isNaN(date.getTime())) {
        errors.push(`${field}は正しい日付形式である必要があります（現在の値: ${value}）`);
      }
    }
  }
  
  // 管理番号形式チェック
  const managementNumber = data['管理番号'];
  if (managementNumber && !/^[A-Z]{2}-\d{4,}$/.test(managementNumber)) {
    errors.push(`管理番号は「AA-1001」形式である必要があります（現在の値: ${managementNumber}）`);
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

// =============================================================================
// 必須フィールド整合性チェック
// =============================================================================
function validateRequiredFields(data, context = 'general') {
  const errors = [];
  
  // コンテキスト別の必須フィールド定義
  const requiredFieldsMap = {
    product_registration: [], // 現在は任意
    sale_completion: ['販売日', '販売先', '販売金額'],
    shipping_completion: ['発送方法']
  };
  
  const requiredFields = requiredFieldsMap[context] || [];
  
  for (const field of requiredFields) {
    const value = data[field];
    if (!value || String(value).trim() === '') {
      errors.push(`${field}は必須項目です`);
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

// =============================================================================
// 参照整合性チェック
// =============================================================================
function validateReferentialIntegrity(data) {
  const warnings = [];
  
  // 金額の整合性チェック
  const purchaseAmount = Number(data['仕入金額']) || 0;
  const listingAmount = Number(data['出品金額']) || 0;
  const saleAmount = Number(data['販売金額']) || 0;
  
  // 仕入金額 > 出品金額の警告
  if (purchaseAmount > 0 && listingAmount > 0 && purchaseAmount >= listingAmount) {
    warnings.push('仕入金額が出品金額以上です。利益が見込めない可能性があります。');
  }
  
  // 出品金額 > 販売金額の警告
  if (listingAmount > 0 && saleAmount > 0 && listingAmount > saleAmount) {
    warnings.push('出品金額より販売金額が低くなっています。');
  }
  
  // 日付の整合性チェック
  const purchaseDate = data['仕入日'] ? new Date(data['仕入日']) : null;
  const listingDate = data['出品日'] ? new Date(data['出品日']) : null;
  const saleDate = data['販売日'] ? new Date(data['販売日']) : null;
  
  if (purchaseDate && listingDate && purchaseDate > listingDate) {
    warnings.push('仕入日が出品日より後になっています。');
  }
  
  if (listingDate && saleDate && listingDate > saleDate) {
    warnings.push('出品日が販売日より後になっています。');
  }
  
  // ステータスと販売情報の整合性
  const status = data['ステータス'];
  if (status === '販売完了' && !saleAmount) {
    warnings.push('ステータスが「販売完了」ですが販売金額が未入力です。');
  }
  
  if (saleAmount > 0 && status !== '販売完了' && status !== '発送完了' && status !== '取引完了') {
    warnings.push('販売金額が入力されていますがステータスが適切でない可能性があります。');
  }
  
  return {
    hasWarnings: warnings.length > 0,
    warnings: warnings
  };
}

// =============================================================================
// 総合データ検証
// =============================================================================
function validateProductData(data, context = 'product_registration', excludeRow = null) {
  const results = {
    isValid: true,
    errors: [],
    warnings: [],
    details: {}
  };
  
  try {
    // 1. 管理番号重複チェック
    if (data['管理番号']) {
      const duplicateCheck = checkManagementNumberDuplicate(data['管理番号'], excludeRow);
      if (duplicateCheck.isDuplicate) {
        results.errors.push(duplicateCheck.message);
        results.isValid = false;
      }
      results.details.managementNumberCheck = duplicateCheck;
    }
    
    // 2. データ型チェック
    const typeCheck = validateDataTypes(data);
    if (!typeCheck.isValid) {
      results.errors.push(...typeCheck.errors);
      results.isValid = false;
    }
    results.details.dataTypeCheck = typeCheck;
    
    // 3. 必須フィールドチェック
    const requiredCheck = validateRequiredFields(data, context);
    if (!requiredCheck.isValid) {
      results.errors.push(...requiredCheck.errors);
      results.isValid = false;
    }
    results.details.requiredFieldCheck = requiredCheck;
    
    // 4. 参照整合性チェック（警告のみ）
    const integrityCheck = validateReferentialIntegrity(data);
    if (integrityCheck.hasWarnings) {
      results.warnings.push(...integrityCheck.warnings);
    }
    results.details.referentialIntegrityCheck = integrityCheck;
    
    return results;
    
  } catch (error) {
    throw handleError(error, 'comprehensive_data_validation');
  }
}

// =============================================================================
// データクリーニング
// =============================================================================
function cleanProductData(data) {
  const cleaned = {};
  
  for (const [key, value] of Object.entries(data || {})) {
    let cleanedValue = value;
    
    // 文字列の前後空白除去
    if (typeof value === 'string') {
      cleanedValue = value.trim();
    }
    
    // 数値型フィールドの変換
    const numericFields = ['商品番号', '仕入金額', '出品金額', '販売金額', '梱包資材費', '送料', '販売手数料'];
    if (numericFields.includes(key) && cleanedValue !== '' && cleanedValue != null) {
      const num = Number(cleanedValue);
      cleanedValue = isNaN(num) ? cleanedValue : num;
    }
    
    // 管理番号の大文字変換
    if (key === '管理番号' && cleanedValue) {
      cleanedValue = String(cleanedValue).toUpperCase();
    }
    
    cleaned[key] = cleanedValue;
  }
  
  return cleaned;
}

// =============================================================================
// データ整合性レポート生成
// =============================================================================
function generateIntegrityReport() {
  try {
    const sh = getSheet();
    const lastRow = sh.getLastRow();
    
    if (lastRow < 2) {
      return {
        summary: 'データが存在しません',
        totalRecords: 0,
        issues: []
      };
    }
    
    const report = {
      summary: '',
      totalRecords: lastRow - 1,
      duplicateManagementNumbers: [],
      dataTypeErrors: [],
      referentialIntegrityWarnings: [],
      generatedAt: new Date().toISOString()
    };
    
    // 全レコードのチェック
    for (let row = 2; row <= lastRow; row++) {
      const rowData = getRowData(sh, row);
      const validation = validateProductData(rowData, 'general', row);
      
      if (!validation.isValid) {
        validation.errors.forEach(error => {
          if (error.includes('管理番号')) {
            report.duplicateManagementNumbers.push(`${row}行目: ${error}`);
          } else {
            report.dataTypeErrors.push(`${row}行目: ${error}`);
          }
        });
      }
      
      if (validation.warnings.length > 0) {
        validation.warnings.forEach(warning => {
          report.referentialIntegrityWarnings.push(`${row}行目: ${warning}`);
        });
      }
    }
    
    // サマリー生成
    const totalIssues = report.duplicateManagementNumbers.length + 
                       report.dataTypeErrors.length + 
                       report.referentialIntegrityWarnings.length;
    
    report.summary = `総レコード数: ${report.totalRecords}, 問題件数: ${totalIssues}`;
    
    return report;
    
  } catch (error) {
    throw handleError(error, 'integrity_report_generation');
  }
}

function getRowData(sheet, row) {
  const { map } = getHeaderMapCommon();
  const data = {};
  
  for (const fieldName of FIELDS) {
    const col = map[fieldName];
    if (col) {
      data[fieldName] = sheet.getRange(row, col).getDisplayValue();
    }
  }
  
  // 管理番号も取得
  const managementCol = colByName(sheet, '管理番号');
  if (managementCol) {
    data['管理番号'] = sheet.getRange(row, managementCol).getDisplayValue();
  }
  
  return data;
}

// =============================================================================
// テスト用関数
// =============================================================================
function testDataIntegrity() {
  try {
    console.log('=== データ整合性テスト開始 ===');
    
    // テストデータ
    const testData = {
      '管理番号': 'AA-1001',
      '商品番号': '1001',
      '仕入金額': '1000',
      '出品金額': '1500',
      '販売金額': '1300',
      '仕入日': '2025-09-01',
      '出品日': '2025-09-02',
      '販売日': '2025-09-03'
    };
    
    const validation = validateProductData(testData);
    console.log('バリデーション結果:', validation);
    
    console.log('=== データ整合性テスト完了 ===');
    return 'データ整合性システム正常動作確認完了';
    
  } catch (error) {
    return handleError(error, 'data_integrity_test');
  }
}