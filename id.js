/** id.gs - セグメント式管理番号生成システム **/

/**
 * 管理番号セグメント設定を取得
 * @returns {Object} セグメント設定 { segments: [...] }
 */
function getManagementNumberSegments() {
  const config = getManagementNumberConfig();
  return config.segments || [];
}

/**
 * 日付フォーマットを生成
 * @param {string} format - 日付フォーマット (YYMMDD, YYYYMMDD, YYMD, YYMM)
 * @returns {string} フォーマットされた日付
 */
function formatDate(format) {
  const now = new Date();
  const y = now.getFullYear();
  const yy = String(y).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');

  switch (format) {
    case 'YYMMDD':
      return yy + m + d;
    case 'YYYYMMDD':
      return String(y) + m + d;
    case 'YYMD':
      return yy + String(now.getMonth() + 1) + String(now.getDate());
    case 'YYMM':
      return yy + m;
    default:
      return yy + m + d;
  }
}

/**
 * セグメント方式で次の管理番号を生成
 * @param {Object} userInputs - ユーザー入力値 { category: 'K', ... }
 * @returns {string} 管理番号（例: 'K-251007-001'）またはエラーメッセージ
 */
function generateSegmentBasedManagementNumber(userInputs) {
  try {
    const segments = getManagementNumberSegments();

    if (!segments || segments.length === 0) {
      return 'NG(NO_SEGMENTS): 管理番号のセグメント設定がありません';
    }

    const parts = [];
    let sequenceSegmentIndex = -1;
    let sequenceConfig = null;

    // 各セグメントの値を生成
    segments.forEach((segment, index) => {
      const type = segment.type;
      const config = segment.config;

      switch (type) {
        case 'shelf':
          // 棚番号（ユーザー入力優先、なければ設定値）
          let shelfValue;
          if (userInputs.shelf) {
            shelfValue = userInputs.shelf;
          } else if (config.format === 'custom') {
            shelfValue = config.code || 'AA';
          } else {
            shelfValue = config.format || 'AA';
          }
          parts.push(shelfValue);
          break;

        case 'category':
          // カテゴリコード（ユーザー入力）
          const categoryValue = userInputs.category || config.code || 'K';
          parts.push(categoryValue);
          break;

        case 'date':
          // 登録日（自動生成）
          const dateFormat = config.format || 'YYMMDD';
          parts.push(formatDate(dateFormat));
          break;

        case 'rank':
          // 品質ランク（ユーザー入力）
          const rankValue = userInputs.rank || config.rank || 'A';
          parts.push(rankValue);
          break;

        case 'size':
          // サイズコード（ユーザー入力）
          const sizeValue = userInputs.size || config.size || 'M';
          parts.push(sizeValue);
          break;

        case 'color':
          // 色コード（ユーザー入力）
          const colorValue = userInputs.color || config.code || 'BK';
          parts.push(colorValue);
          break;

        case 'sequence':
          // 連番（自動採番）- 後で処理
          sequenceSegmentIndex = index;
          sequenceConfig = config;
          parts.push(''); // プレースホルダー
          break;

        case 'custom':
          // カスタム値（ユーザー入力優先、なければ設定値）
          const customValue = userInputs.custom || config.value || '';
          parts.push(customValue);
          break;

        default:
          parts.push('');
      }
    });

    // 連番を生成（他のセグメントから作られたプレフィックスを使用）
    if (sequenceSegmentIndex !== -1 && sequenceConfig) {
      const prefix = parts.filter((p, i) => i < sequenceSegmentIndex && p !== '').join('-');
      const nextNum = getNextSequenceNumber(prefix, sequenceConfig);

      if (typeof nextNum === 'string' && nextNum.startsWith('NG(')) {
        return nextNum;
      }

      parts[sequenceSegmentIndex] = nextNum;
    }

    // 区切り文字で連結
    const separator = segments[0]?.separator || '-';
    return parts.filter(p => p !== '').join(separator);

  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return msg.startsWith('NG(') ? msg : `NG(UNKNOWN): ${msg}`;
  }
}

/**
 * 指定プレフィックスの次の連番を取得
 * @param {string} prefix - プレフィックス（例: 'K-251007'）
 * @param {Object} config - 連番設定 { digits: 3, start: 1 }
 * @returns {string} ゼロパディングされた連番（例: '001'）
 */
function getNextSequenceNumber(prefix, config) {
  try {
    const digits = parseInt(config.digits) || 3;
    const startValue = parseInt(config.start) || 1;

    const sh = getSheet_();
    const lastRow = sh.getLastRow();
    const nRows = Math.max(0, lastRow - 1);
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];

    const idxMng = headers.indexOf('管理番号');

    if (idxMng === -1) {
      return `NG(HEADER_MISSING): 管理番号列が見つかりません`;
    }

    const used = new Set();
    let maxSeen = startValue - 1;

    if (nRows > 0) {
      const vals = sh.getRange(2, idxMng + 1, nRows, 1).getValues().flat();

      // プレフィックスが空の場合（連番のみ）
      const pattern = prefix
        ? `^${escapeRegex(prefix)}-?(\\d+)$`
        : `^(\\d+)$`;
      const re = new RegExp(pattern, 'i');

      for (const v of vals) {
        const s = String(v || '').trim();
        const m = s.match(re);
        if (!m) continue;

        const num = parseInt(m[1], 10);
        if (!Number.isNaN(num) && num >= startValue) {
          used.add(num);
          if (num > maxSeen) maxSeen = num;
        }
      }
    }

    // 未使用の最小番号を探す
    let candidate = startValue;
    const upper = Math.max(maxSeen + 1, startValue);
    for (; candidate <= upper; candidate++) {
      if (!used.has(candidate)) break;
    }

    // ゼロパディング
    return String(candidate).padStart(digits, '0');

  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return msg.startsWith('NG(') ? msg : `NG(UNKNOWN): ${msg}`;
  }
}

/**
 * 正規表現用に文字列をエスケープ
 */
function escapeRegex(str) {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * スプレッドシートを取得
 */
function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('在庫/売上管理表');
}

/**
 * 使用可能な最小管理番号を取得
 * @param {string} prefix - プレフィックス（例: 'BB'）
 * @param {number} digits - 桁数
 * @param {number} currentNumber - 現在の番号
 * @returns {number} 使用可能な最小番号
 */
function getMinAvailableNumber(prefix, digits, currentNumber) {
  try {
    const sh = getSheet_();
    const lastRow = sh.getLastRow();
    const nRows = Math.max(0, lastRow - 1);
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];

    const idxMng = headers.indexOf('管理番号');

    if (idxMng === -1) {
      return 1; // 列が見つからない場合は1を返す
    }

    if (nRows === 0) {
      return 1; // データがない場合は1を返す
    }

    const vals = sh.getRange(2, idxMng + 1, nRows, 1).getValues().flat();

    // プレフィックスに一致する管理番号から最大値を探す
    const pattern = prefix ? `^${escapeRegex(prefix)}-?(\\d+)$` : `^(\\d+)$`;
    const re = new RegExp(pattern, 'i');

    let maxUsedNumber = 0;

    for (const v of vals) {
      const s = String(v || '').trim();
      const m = s.match(re);
      if (!m) continue;

      const num = parseInt(m[1], 10);
      if (!Number.isNaN(num) && num > maxUsedNumber) {
        maxUsedNumber = num;
      }
    }

    // 使用済みの最大番号の次の番号が最小使用可能番号
    const minAvailable = maxUsedNumber + 1;

    console.log(`最小使用可能番号: ${minAvailable} (プレフィックス: ${prefix}, 使用済み最大: ${maxUsedNumber})`);
    return minAvailable;

  } catch (e) {
    console.error('getMinAvailableNumber エラー:', e);
    return 1;
  }
}

// ========== 後方互換性のため旧関数を残す ==========

/**
 * 旧形式の管理番号生成（後方互換用）
 * @deprecated 新しいセグメント方式を使用してください
 */
function getNextManagementNumber(shelfCode) {
  // 旧形式の設定がある場合はそちらを使用
  const mgmtConfig = getManagementNumberConfig();

  // セグメント設定がある場合は新方式
  if (mgmtConfig.segments && mgmtConfig.segments.length > 0) {
    return generateSegmentBasedManagementNumber({ category: shelfCode });
  }

  // 旧方式（棚番号+連番）
  const useShelf = String(mgmtConfig['棚番号使用'] || '').toLowerCase() === 'true';
  const separator = mgmtConfig['区切り文字'] || '-';
  const padWidth = parseInt(mgmtConfig['商品番号桁数']) || 4;
  const startValue = parseInt(mgmtConfig['商品番号開始値']) || 1001;

  const nextNumber = getNextItemNumber(shelfCode);

  if (typeof nextNumber === 'string' && nextNumber.startsWith('NG(')) {
    return nextNumber;
  }

  const paddedNumber = String(nextNumber).padStart(padWidth, '0');

  if (useShelf && shelfCode) {
    return `${shelfCode}${separator}${paddedNumber}`;
  } else {
    return paddedNumber;
  }
}

function getNextItemNumber(shelfCode) {
  const mgmtConfig = getManagementNumberConfig();
  const startValue = parseInt(mgmtConfig['商品番号開始値']) || 1001;

  const sh = getSheet_();
  const lastRow = sh.getLastRow();
  const nRows = Math.max(0, lastRow - 1);
  const lastCol = sh.getLastColumn();
  const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  const idxItem = headers.indexOf('商品番号');

  if (idxItem === -1) {
    return `NG(HEADER_MISSING): 商品番号列が見つかりません`;
  }

  const used = new Set();
  let maxSeen = startValue - 1;

  if (nRows > 0) {
    const vals = sh.getRange(2, idxItem + 1, nRows, 1).getValues().flat();

    for (const v of vals) {
      const num = parseInt(String(v || '').trim(), 10);
      if (!Number.isNaN(num) && num >= startValue) {
        used.add(num);
        if (num > maxSeen) maxSeen = num;
      }
    }
  }

  let candidate = startValue;
  const upper = Math.max(maxSeen + 1, startValue);
  for (; candidate <= upper; candidate++) {
    if (!used.has(candidate)) break;
  }

  return String(candidate);
}
