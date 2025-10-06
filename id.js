/** id.gs **/
// 管理番号設定（設定マスタから取得）
const KEY_NUM_WIDTH = 4;     // デフォルト桁数（後方互換のため残す）
const DEFAULT_SEPARATOR = '-'; // デフォルト区切り文字

/**
 * 指定の棚番号について、未使用の最小 商品番号(>=開始値) を返す。
 * 優先：『棚番号』『商品番号』列を参照。無ければ『管理番号』列をフォールバック参照。
 * 返り値例: '1013'（数字のみ）
 */
function getNextItemNumber(shelfCode) {
  try {
    // 設定マスタから管理番号設定を取得
    const mgmtConfig = getManagementNumberConfig();
    const useShelf = String(mgmtConfig['棚番号使用'] || '').toLowerCase() === 'true';
    const shelfFormat = mgmtConfig['棚番号形式'] || 'AA';
    const MIN_NUM = parseInt(mgmtConfig['商品番号開始値']) || 1001;

    // 棚番号の検証（棚番号を使用する場合のみ）
    if (useShelf && shelfCode) {
      // 形式に応じた検証
      let isValid = false;
      switch (shelfFormat) {
        case 'AA':
          isValid = /^[A-Z]{2}$/.test(shelfCode);
          break;
        case 'A':
          isValid = /^[A-Z]$/.test(shelfCode);
          break;
        case '01':
          isValid = /^\d{2}$/.test(shelfCode);
          break;
        case '001':
          isValid = /^\d{3}$/.test(shelfCode);
          break;
        case 'custom':
          isValid = shelfCode.length > 0; // 自由入力は空でなければOK
          break;
        default:
          isValid = true;
      }

      if (!isValid) {
        return `NG(VALIDATION): 棚番号の形式が設定と一致しません（設定: ${shelfFormat}）`;
      }
    }

    const sh = getSheet_();
    const lastRow = sh.getLastRow();
    const nRows = Math.max(0, lastRow - 1);
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];

    const idxShelf = headers.indexOf('棚番号');
    const idxItem  = headers.indexOf('商品番号');
    const idxMng   = headers.indexOf('管理番号');

    const used = new Set();
    let maxSeen = MIN_NUM - 1;

    if (idxShelf !== -1 && idxItem !== -1) {
      if (nRows > 0) {
        const shelfVals = sh.getRange(2, idxShelf + 1, nRows, 1).getValues().flat();
        const itemVals  = sh.getRange(2, idxItem  + 1, nRows, 1).getValues().flat();
        for (let i = 0; i < nRows; i++) {
          const shelf = String(shelfVals[i] ?? '').trim();

          // 棚番号を使用する場合のみ棚番号を比較
          if (useShelf) {
            if (shelf.toUpperCase() !== shelfCode.toUpperCase()) continue;
          }

          const num = parseInt(String(itemVals[i] ?? '').trim(), 10);
          if (!Number.isNaN(num) && num >= MIN_NUM) {
            used.add(num);
            if (num > maxSeen) maxSeen = num;
          }
        }
      }
    } else if (idxMng !== -1) {
      // フォールバック：管理番号から抽出
      console.log('管理番号列インデックス:', idxMng);
      console.log('行数:', nRows);
      if (nRows > 0) {
        const vals = sh.getRange(2, idxMng + 1, nRows, 1).getValues().flat();
        console.log('管理番号列の最初の5件:', vals.slice(0, 5));
        const separator = mgmtConfig['区切り文字'] || '-';
        const escapedSep = separator.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const escapedShelf = shelfCode.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

        // 棚番号使用の場合: 'AA-1013' のようなパターン
        // 棚番号不使用の場合: '1013' のようなパターン
        const pattern = useShelf
          ? `^${escapedShelf}${escapedSep}?(\\d+)$`
          : `^(\\d+)$`;
        const re = new RegExp(pattern, 'i');
        console.log('検索パターン:', pattern);

        for (const v of vals) {
          const s = String(v || '').trim();
          const m = s.match(re);
          if (!m) continue;
          const num = parseInt(m[1], 10);
          console.log('マッチした管理番号:', s, '→ 番号:', num);
          if (!Number.isNaN(num) && num >= MIN_NUM) {
            used.add(num);
            if (num > maxSeen) maxSeen = num;
          }
        }
        console.log('見つかった最大番号:', maxSeen);
      }
    } else {
      return `NG(HEADER_MISSING): 『棚番号/商品番号』 または 『管理番号』 列が見つかりません`;
    }

    // 未使用の最小番号
    let candidate = MIN_NUM;
    const upper = Math.max(maxSeen + 1, MIN_NUM);
    for (; candidate <= upper; candidate++) {
      if (!used.has(candidate)) break;
    }
    return String(candidate);
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return msg.startsWith('NG(') ? msg : `NG(UNKNOWN): ${msg}`;
  }
}

/**
 * 指定の棚番号について、次の管理番号を完全な形式で返す
 * 返り値例: 'AA-1013' または '1013'（棚番号使用しない場合）
 * @param {string} shelfCode - 棚番号（例: 'AA'）空文字列も許可
 * @returns {string} 管理番号（例: 'AA-1013'）またはエラーメッセージ
 */
function getNextManagementNumber(shelfCode) {
  try {
    // 設定マスタから管理番号設定を取得
    const mgmtConfig = getManagementNumberConfig();
    const useShelf = String(mgmtConfig['棚番号使用'] || '').toLowerCase() === 'true';
    const separator = mgmtConfig['区切り文字'] || DEFAULT_SEPARATOR;
    const padWidth = parseInt(mgmtConfig['商品番号桁数']) || KEY_NUM_WIDTH;

    // 棚番号の正規化
    const normalizedShelf = String(shelfCode || '').trim().toUpperCase();

    // 次の商品番号を取得
    const nextNumber = getNextItemNumber(normalizedShelf);

    // エラーチェック
    if (typeof nextNumber === 'string' && nextNumber.startsWith('NG(')) {
      return nextNumber;
    }

    // 商品番号をゼロパディング
    const paddedNumber = String(nextNumber).padStart(padWidth, '0');

    // 管理番号を生成
    if (useShelf && normalizedShelf) {
      return `${normalizedShelf}${separator}${paddedNumber}`;
    } else {
      return paddedNumber;
    }
  } catch (e) {
    const msg = (e && e.message) ? e.message : String(e);
    return msg.startsWith('NG(') ? msg : `NG(UNKNOWN): ${msg}`;
  }
}
