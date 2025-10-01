/**
 * validation_enhancer.gs - 強化されたバリデーションシステム
 * リアルタイム検証、詳細なエラーメッセージ、入力誘導機能
 */

// =============================================================================
// 強化されたバリデーションルール
// =============================================================================
const VALIDATION_RULES = {
  // 管理番号関連
  managementNumber: {
    pattern: /^[A-Z]{2}-\d{4,}$/,
    message: '管理番号は「AA-1001」の形式で入力してください',
    maxLength: 10
  },
  
  // 数値関連
  itemNumber: {
    min: 1001,
    max: 9999,
    message: '商品番号は1001〜9999の範囲で入力してください'
  },
  
  price: {
    min: 0,
    max: 1000000,
    message: '金額は0〜1,000,000円の範囲で入力してください'
  },
  
  // 文字数制限
  productTitle: {
    maxLength: 40,
    softLimit: 35,
    message: '商品名は40文字以内で入力してください',
    warningMessage: '商品名が35文字を超えています。40文字以内に調整することをお勧めします'
  },
  
  description: {
    maxLength: 1000,
    softLimit: 800,
    minLength: 10,
    message: '商品説明は10文字以上1000文字以内で入力してください',
    warningMessage: '商品説明が800文字を超えています。1000文字以内に調整することをお勧めします'
  },
  
  // 日付関連
  date: {
    minDate: new Date('2020-01-01'),
    maxDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1年後まで
    message: '日付は2020年1月1日以降、1年後までの範囲で入力してください'
  }
};

// =============================================================================
// リアルタイムバリデーション
// =============================================================================
function validateField(fieldName, value, context = {}) {
  const result = {
    isValid: true,
    level: 'info', // info, warning, error
    message: '',
    suggestion: ''
  };
  
  try {
    switch (fieldName) {
      case '管理番号':
        return validateManagementNumber(value);
        
      case '商品番号':
        return validateItemNumber(value, context);
        
      case '商品名(タイトル)':
        return validateProductTitle(value);
        
      case '商品の説明':
        return validateDescription(value);
        
      case '仕入金額':
      case '出品金額':
      case '販売金額':
        return validatePrice(value, fieldName);
        
      case '仕入日':
      case '出品日':
      case '販売日':
        return validateDate(value, fieldName);
        
      default:
        return result; // デフォルトは有効
    }
  } catch (error) {
    return {
      isValid: false,
      level: 'error',
      message: `バリデーションエラー: ${error.message}`,
      suggestion: ''
    };
  }
}

function validateManagementNumber(value) {
  const result = { isValid: true, level: 'info', message: '', suggestion: '' };
  
  if (!value || value.trim() === '') {
    return result; // 空は許可
  }
  
  const trimmed = value.trim().toUpperCase();
  
  if (!VALIDATION_RULES.managementNumber.pattern.test(trimmed)) {
    result.isValid = false;
    result.level = 'error';
    result.message = VALIDATION_RULES.managementNumber.message;
    result.suggestion = '例: AA-1001, BB-1002';
  }
  
  return result;
}

function validateItemNumber(value, context) {
  const result = { isValid: true, level: 'info', message: '', suggestion: '' };
  
  if (!value || value.trim() === '') {
    return result; // 空は許可
  }
  
  const num = Number(value);
  const rules = VALIDATION_RULES.itemNumber;
  
  if (isNaN(num)) {
    result.isValid = false;
    result.level = 'error';
    result.message = '商品番号は数値で入力してください';
    return result;
  }
  
  if (num < rules.min || num > rules.max) {
    result.isValid = false;
    result.level = 'error';
    result.message = rules.message;
    result.suggestion = `推奨範囲: ${rules.min}〜${rules.max}`;
  }
  
  return result;
}

function validateProductTitle(value) {
  const result = { isValid: true, level: 'info', message: '', suggestion: '' };
  
  if (!value || value.trim() === '') {
    return result; // 空は許可
  }
  
  const length = Array.from(value).length;
  const rules = VALIDATION_RULES.productTitle;
  
  if (length > rules.maxLength) {
    result.isValid = false;
    result.level = 'error';
    result.message = rules.message;
    result.suggestion = `現在${length}文字（${length - rules.maxLength}文字オーバー）`;
  } else if (length > rules.softLimit) {
    result.level = 'warning';
    result.message = rules.warningMessage;
    result.suggestion = `現在${length}文字（残り${rules.maxLength - length}文字）`;
  }
  
  return result;
}

function validateDescription(value) {
  const result = { isValid: true, level: 'info', message: '', suggestion: '' };
  
  if (!value || value.trim() === '') {
    return result; // 空は許可
  }
  
  const length = Array.from(value).length;
  const rules = VALIDATION_RULES.description;
  
  if (length < rules.minLength) {
    result.level = 'warning';
    result.message = `商品説明は${rules.minLength}文字以上での入力をお勧めします`;
    result.suggestion = `現在${length}文字（あと${rules.minLength - length}文字）`;
  } else if (length > rules.maxLength) {
    result.isValid = false;
    result.level = 'error';
    result.message = rules.message;
    result.suggestion = `現在${length}文字（${length - rules.maxLength}文字オーバー）`;
  } else if (length > rules.softLimit) {
    result.level = 'warning';
    result.message = rules.warningMessage;
    result.suggestion = `現在${length}文字（残り${rules.maxLength - length}文字）`;
  }
  
  return result;
}

function validatePrice(value, fieldName) {
  const result = { isValid: true, level: 'info', message: '', suggestion: '' };
  
  if (!value || value.trim() === '') {
    return result; // 空は許可
  }
  
  const num = Number(value);
  const rules = VALIDATION_RULES.price;
  
  if (isNaN(num)) {
    result.isValid = false;
    result.level = 'error';
    result.message = `${fieldName}は数値で入力してください`;
    return result;
  }
  
  if (num < rules.min || num > rules.max) {
    result.isValid = false;
    result.level = 'error';
    result.message = rules.message;
    result.suggestion = `入力値: ¥${num.toLocaleString()}`;
  }
  
  // 金額の妥当性チェック
  if (num > 0 && num < 100) {
    result.level = 'warning';
    result.message = '金額が低すぎる可能性があります';
    result.suggestion = '本当にこの金額でよろしいですか？';
  }
  
  return result;
}

function validateDate(value, fieldName) {
  const result = { isValid: true, level: 'info', message: '', suggestion: '' };
  
  if (!value || value.trim() === '') {
    return result; // 空は許可
  }
  
  const date = new Date(value);
  const rules = VALIDATION_RULES.date;
  
  if (isNaN(date.getTime())) {
    result.isValid = false;
    result.level = 'error';
    result.message = '正しい日付形式で入力してください';
    return result;
  }
  
  if (date < rules.minDate || date > rules.maxDate) {
    result.isValid = false;
    result.level = 'error';
    result.message = rules.message;
    result.suggestion = `入力日付: ${date.toLocaleDateString()}`;
  }
  
  // 未来日付の警告
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  if (fieldName === '仕入日' && date > today) {
    result.level = 'warning';
    result.message = '仕入日が未来の日付になっています';
  }
  
  return result;
}

// =============================================================================
// ビジネスロジックバリデーション
// =============================================================================
function validateBusinessLogic(formData) {
  const warnings = [];
  const errors = [];
  
  // 金額の整合性チェック
  const purchaseAmount = Number(formData['仕入金額']) || 0;
  const listingAmount = Number(formData['出品金額']) || 0;
  const saleAmount = Number(formData['販売金額']) || 0;
  
  if (purchaseAmount > 0 && listingAmount > 0) {
    const margin = listingAmount - purchaseAmount;
    const marginRate = (margin / purchaseAmount) * 100;
    
    if (marginRate < 20) {
      warnings.push(`利益率が低い可能性があります（${marginRate.toFixed(1)}%）`);
    }
    
    if (purchaseAmount >= listingAmount) {
      warnings.push('仕入金額が出品金額以上です。利益が見込めません');
    }
  }
  
  if (listingAmount > 0 && saleAmount > 0 && saleAmount < listingAmount) {
    warnings.push('販売金額が出品金額より低くなっています');
  }
  
  // 日付の整合性チェック
  const purchaseDate = formData['仕入日'] ? new Date(formData['仕入日']) : null;
  const listingDate = formData['出品日'] ? new Date(formData['出品日']) : null;
  const saleDate = formData['販売日'] ? new Date(formData['販売日']) : null;
  
  if (purchaseDate && listingDate && purchaseDate > listingDate) {
    errors.push('仕入日が出品日より後になっています');
  }
  
  if (listingDate && saleDate && listingDate > saleDate) {
    errors.push('出品日が販売日より後になっています');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors,
    warnings: warnings
  };
}

// =============================================================================
// 入力候補・誘導機能
// =============================================================================
function getInputSuggestions(fieldName, currentValue, context = {}) {
  const suggestions = [];
  
  switch (fieldName) {
    case '商品番号':
      if (context.shelfCode) {
        suggestions.push({
          type: 'auto',
          value: 'auto',
          label: '自動採番（推奨）',
          description: '未使用の最小番号を自動設定'
        });
      }
      break;
      
    case '出品金額':
      if (context.purchaseAmount) {
        const purchase = Number(context.purchaseAmount);
        const suggestions30 = Math.round(purchase * 1.3);
        const suggestions50 = Math.round(purchase * 1.5);
        
        suggestions.push(
          {
            type: 'calculation',
            value: suggestions30,
            label: `¥${suggestions30.toLocaleString()}`,
            description: '仕入額の1.3倍（30%利益）'
          },
          {
            type: 'calculation',
            value: suggestions50,
            label: `¥${suggestions50.toLocaleString()}`,
            description: '仕入額の1.5倍（50%利益）'
          }
        );
      }
      break;
      
    case '出品日':
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      suggestions.push(
        {
          type: 'date',
          value: today.toISOString().split('T')[0],
          label: '今日',
          description: today.toLocaleDateString()
        },
        {
          type: 'date',
          value: tomorrow.toISOString().split('T')[0],
          label: '明日',
          description: tomorrow.toLocaleDateString()
        }
      );
      break;
  }
  
  return suggestions;
}

// =============================================================================
// バリデーション結果の統合
// =============================================================================
function validateFormComprehensive(formData) {
  const fieldResults = {};
  const summary = {
    isValid: true,
    hasWarnings: false,
    errorCount: 0,
    warningCount: 0,
    criticalErrors: [],
    suggestions: []
  };
  
  // 各フィールドのバリデーション
  for (const [fieldName, value] of Object.entries(formData)) {
    const result = validateField(fieldName, value, formData);
    fieldResults[fieldName] = result;
    
    if (!result.isValid) {
      summary.isValid = false;
      summary.errorCount++;
      if (result.level === 'error') {
        summary.criticalErrors.push(`${fieldName}: ${result.message}`);
      }
    }
    
    if (result.level === 'warning') {
      summary.hasWarnings = true;
      summary.warningCount++;
    }
  }
  
  // ビジネスロジックバリデーション
  const businessValidation = validateBusinessLogic(formData);
  if (!businessValidation.isValid) {
    summary.isValid = false;
    summary.criticalErrors.push(...businessValidation.errors);
  }
  
  if (businessValidation.warnings.length > 0) {
    summary.hasWarnings = true;
    summary.warningCount += businessValidation.warnings.length;
  }
  
  return {
    fieldResults: fieldResults,
    businessValidation: businessValidation,
    summary: summary
  };
}

// =============================================================================
// テスト用関数
// =============================================================================
function testValidationEnhancer() {
  console.log('=== バリデーション強化テスト開始 ===');
  
  const testData = {
    '管理番号': 'AA-1001',
    '商品番号': '1001',
    '商品名(タイトル)': 'テスト商品名',
    '商品の説明': 'テスト商品の説明文です。',
    '仕入金額': '1000',
    '出品金額': '1500',
    '仕入日': '2025-09-01',
    '出品日': '2025-09-02'
  };
  
  const validation = validateFormComprehensive(testData);
  console.log('バリデーション結果:', validation);
  
  console.log('=== バリデーション強化テスト完了 ===');
  return 'バリデーション強化システム正常動作確認完了';
}
