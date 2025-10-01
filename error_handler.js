/**
 * error_handler.gs - 統一エラーハンドリングシステム
 * 全システム共通のエラー処理と分類
 */

// =============================================================================
// エラー分類定数
// =============================================================================
const ERROR_TYPES = {
  VALIDATION: 'VALIDATION',
  SHEET_ACCESS: 'SHEET_ACCESS', 
  HEADER_MISSING: 'HEADER_MISSING',
  DATA_NOT_FOUND: 'DATA_NOT_FOUND',
  PERMISSION: 'PERMISSION',
  NETWORK: 'NETWORK',
  SYSTEM: 'SYSTEM',
  USER_INPUT: 'USER_INPUT'
};

const ERROR_LEVELS = {
  INFO: 'INFO',
  WARNING: 'WARNING', 
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

// =============================================================================
// エラーオブジェクト作成関数（クラスの代替）
// =============================================================================
function createSystemError(type, message, details = {}, level = ERROR_LEVELS.ERROR) {
  const error = new Error(message);
  error.name = 'SystemError';
  error.type = type;
  error.level = level;
  error.details = details;
  error.timestamp = new Date().toISOString();
  error.userMessage = generateUserMessage(type);
  
  return error;
}

function generateUserMessage(type) {
  const userMessages = {
    [ERROR_TYPES.VALIDATION]: '入力内容に問題があります',
    [ERROR_TYPES.SHEET_ACCESS]: 'スプレッドシートにアクセスできません',
    [ERROR_TYPES.HEADER_MISSING]: 'スプレッドシートの列設定に問題があります',
    [ERROR_TYPES.DATA_NOT_FOUND]: '指定されたデータが見つかりません',
    [ERROR_TYPES.PERMISSION]: 'アクセス権限がありません',
    [ERROR_TYPES.NETWORK]: 'ネットワークエラーが発生しました',
    [ERROR_TYPES.SYSTEM]: 'システムエラーが発生しました',
    [ERROR_TYPES.USER_INPUT]: '入力内容を確認してください'
  };
  
  return userMessages[type] || 'エラーが発生しました';
}

function formatErrorToString(error) {
  return `[${error.type || 'UNKNOWN'}] ${error.message}`;
}

function formatErrorToUserString(error) {
  const userMsg = error.userMessage || generateUserMessage(error.type);
  return `${userMsg}: ${error.message}`;
}

// =============================================================================
// エラーハンドラー（関数ベース）
// =============================================================================
function logError(error) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: error.type || 'UNKNOWN',
    level: error.level || ERROR_LEVELS.ERROR,
    message: error.message,
    details: error.details || {},
    stack: error.stack
  };
  
  console.error('SystemError:', logEntry);
  
  // 将来的にはスプレッドシートのログシートに記録
  // writeToLogSheet(logEntry);
  
  return logEntry;
}

function handleSystemError(error, context = '') {
  // SystemErrorでない場合は変換
  if (!error.type) {
    error = convertToSystemError(error, context);
  }
  
  // ログ記録
  logError(error);
  
  // ユーザー向けメッセージ生成
  return formatUserResponse(error);
}

function convertToSystemError(error, context) {
  const message = error.message || String(error);
  
  // エラーメッセージから種類を推定
  if (message.includes('getSheetByName')) {
    return createSystemError(
      ERROR_TYPES.SHEET_ACCESS,
      `シート「${context}」が見つかりません`,
      { originalError: message }
    );
  }
  
  if (message.includes('getRange') || message.includes('setValue')) {
    return createSystemError(
      ERROR_TYPES.SHEET_ACCESS,
      'スプレッドシートの操作中にエラーが発生しました',
      { originalError: message, context: context }
    );
  }
  
  if (message.includes('権限') || message.includes('permission')) {
    return createSystemError(
      ERROR_TYPES.PERMISSION,
      'アクセス権限がありません',
      { originalError: message, context: context }
    );
  }
  
  // デフォルトはシステムエラー
  return createSystemError(
    ERROR_TYPES.SYSTEM,
    message,
    { originalError: message, context: context }
  );
}

function formatUserResponse(error) {
  const userString = formatErrorToUserString(error);
  
  switch (error.level) {
    case ERROR_LEVELS.CRITICAL:
      return `重大エラー: ${userString}`;
    
    case ERROR_LEVELS.ERROR:
      return `エラー: ${userString}`;
    
    case ERROR_LEVELS.WARNING:
      return `警告: ${userString}`;
    
    case ERROR_LEVELS.INFO:
      return `情報: ${userString}`;
    
    default:
      return userString;
  }
}

function createValidationError(field, message, value = null) {
  return createSystemError(
    ERROR_TYPES.VALIDATION,
    `${field}: ${message}`,
    { field: field, value: value },
    ERROR_LEVELS.WARNING
  );
}

function createDataNotFoundError(resource, identifier) {
  return createSystemError(
    ERROR_TYPES.DATA_NOT_FOUND,
    `${resource}「${identifier}」が見つかりません`,
    { resource: resource, identifier: identifier }
  );
}

function createSheetError(sheetName, operation = '') {
  return createSystemError(
    ERROR_TYPES.SHEET_ACCESS,
    `シート「${sheetName}」への${operation}操作に失敗しました`,
    { sheetName: sheetName, operation: operation }
  );
}

// =============================================================================
// 便利関数（既存コードから移行しやすい形）
// =============================================================================
function handleError(error, context = '') {
  return handleSystemError(error, context);
}

function createError(type, message, details = {}) {
  return createSystemError(type, message, details);
}

function safeExecute(fn, fallbackValue = null, context = '') {
  try {
    return fn();
  } catch (error) {
    const handled = handleSystemError(error, context);
    console.warn(`SafeExecute failed: ${handled}`);
    return fallbackValue;
  }
}

function validateRequired(value, fieldName) {
  if (!value || String(value).trim() === '') {
    throw createValidationError(fieldName, '必須項目です', value);
  }
  return true;
}

function validateNumber(value, fieldName, min = null, max = null) {
  if (value === '' || value == null) return true; // 空は許可
  
  const num = Number(value);
  if (isNaN(num)) {
    throw createValidationError(fieldName, '数値で入力してください', value);
  }
  
  if (min !== null && num < min) {
    throw createValidationError(fieldName, `${min}以上で入力してください`, value);
  }
  
  if (max !== null && num > max) {
    throw createValidationError(fieldName, `${max}以下で入力してください`, value);
  }
  
  return true;
}

function validateDate(value, fieldName) {
  if (value === '' || value == null) return true; // 空は許可
  
  const date = new Date(value);
  if (isNaN(date.getTime())) {
    throw createValidationError(fieldName, '正しい日付形式で入力してください', value);
  }
  
  return true;
}

function validateLength(value, fieldName, maxLength) {
  if (value === '' || value == null) return true; // 空は許可
  
  const length = Array.from(String(value)).length;
  if (length > maxLength) {
    throw createValidationError(
      fieldName, 
      `${maxLength}文字以内で入力してください（現在${length}文字）`, 
      value
    );
  }
  
  return true;
}

// =============================================================================
// テスト用関数（エラー表示を抑制）
// =============================================================================
function testErrorHandlerSafe() {
  const results = [];
  
  // Test 1: バリデーションエラー
  try {
    validateRequired('', '商品名');
  } catch (error) {
    const handled = handleError(error, 'testValidation');
    results.push(`Test 1 OK: ${handled}`);
  }
  
  // Test 2: 数値バリデーションエラー
  try {
    validateNumber('abc', '商品番号', 1001);
  } catch (error) {
    const handled = handleError(error, 'testNumber');
    results.push(`Test 2 OK: ${handled}`);
  }
  
  // Test 3: システムエラー
  try {
    throw new Error('テスト用システムエラー');
  } catch (error) {
    const handled = handleError(error, 'testSystem');
    results.push(`Test 3 OK: ${handled}`);
  }
  
  // 結果表示
  console.log('=== エラーハンドリングテスト結果 ===');
  results.forEach(result => console.log(result));
  console.log('=== テスト完了 ===');
  
  return 'エラーハンドリングシステム正常動作確認完了';
}