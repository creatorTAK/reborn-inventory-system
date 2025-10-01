/**
 * common.gs - 共通ユーティリティ統合版
 * 既存の定数を使用し、新しい関数のみを提供
 */

// =============================================================================
// ヘッダー処理統合（正規化・検索・マップ作成）
// =============================================================================
function normalizeHeader(s) {
  return String(s || '')
    .trim()
    .replace(/（/g, '(').replace(/）/g, ')')
    .replace(/／/g, '/')
    .replace(/\u3000/g, ' ')
    .toLowerCase()
    .replace(/\s+/g, '');
}

function findHeaderIndex(headers, aliases) {
  const map = new Map();
  headers.forEach((h, i) => map.set(normalizeHeader(h), i));
  
  for (const alias of aliases) {
    const idx = map.get(normalizeHeader(alias));
    if (idx !== undefined) return idx;
  }
  return -1;
}

function getHeaderMapCommon() {
  const sh = getSheet();
  const lastCol = sh.getLastColumn();
  const headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  
  // 重複チェック
  const counts = headerRow.reduce((m, v) => { 
    if (!v) return m; 
    m[v] = (m[v] || 0) + 1; 
    return m; 
  }, {});
  
  const dup = Object.keys(counts).find(k => counts[k] > 1);
  if (dup) {
    throw new Error(`HEADER_DUPLICATE: 見出し '${dup}' が重複しています`);
  }
  
  // 論理名 → 実列番号（1始まり）
  const map = {};
  for (const logical of FIELDS) {
    const aliases = HEADER_ALIASES[logical] || [logical];
    const idx = findHeaderIndex(headerRow, aliases);
    if (idx !== -1) map[logical] = idx + 1;
  }
  
  return { map, lastCol };
}

// =============================================================================
// シート取得・操作
// =============================================================================
function getSheet() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh) {
    throw new Error(`SHEET_NOT_FOUND: シート '${SHEET_NAME}' が見つかりません`);
  }
  return sh;
}

function getMasterSheet() {
  const sh = SpreadsheetApp.getActive().getSheetByName(MASTER_SHEET);
  if (!sh) {
    throw new Error(`MASTER_SHEET_NOT_FOUND: マスタシート '${MASTER_SHEET}' が見つかりません`);
  }
  return sh;
}

function colByName(sh, headerName) {
  const lastCol = sh.getLastColumn(); 
  if (!lastCol) return 0;
  
  const headers = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const norm = s => String(s || '').replace(/[ \t\r\n　]+/g, '').trim();
  const target = norm(headerName);
  
  for (let i = 0; i < headers.length; i++) { 
    if (norm(headers[i]) === target) return i + 1; 
  }
  return 0;
}

function writeRowByHeaders(sheet, row, updates) {
  const lastCol = sheet.getLastColumn();
  const headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] : [];
  const norm = s => String(s || '').replace(/[ \t\r\n　]+/g, '').trim();
  const hmap = {};
  headers.forEach((h, i) => { hmap[norm(h)] = i + 1; });
  
  for (const [h, v] of Object.entries(updates || {})) {
    const col = hmap[norm(h)] || 0;
    if (!col) continue;
    try { 
      sheet.getRange(row, col).setValue(v); 
    } catch(_) {}
  }
}

// =============================================================================
// 文字列・配列処理
// =============================================================================
function splitMulti(s) {
  return String(s || '')
    .split(/[,\u3001\/\uFF0F\n]+/)
    .map(v => v.trim())
    .filter(Boolean);
}

function uniqKeepOrder(arr) {
  const seen = new Set();
  const out = [];
  
  for (const x of (arr || [])) {
    const v = (x ?? '').toString().trim();
    if (!v || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

// =============================================================================
// エラーハンドリング統一
// =============================================================================
function createError(type, message, details = {}) {
  const error = new Error(`${type}: ${message}`);
  error.type = type;
  error.details = details;
  error.timestamp = new Date().toISOString();
  return error;
}

function handleError(error) {
  console.error('System Error:', error);
  
  if (error && error.message) {
    return error.message.startsWith('NG(') ? error.message : `NG(UNKNOWN): ${error.message}`;
  }
  return `NG(UNKNOWN): ${String(error)}`;
}

function safeExecute(fn, fallback = null) {
  try {
    return fn();
  } catch (error) {
    console.error('Safe execution failed:', error);
    return fallback;
  }
}

// =============================================================================
// シート名取得（互換性維持）
// =============================================================================
function getMasterSheetName() {
  return MASTER_SHEET;
}

function getMainSheetName() {
  return SHEET_NAME;
}