/** id.gs **/
const KEY_NUM_WIDTH = 4;     // メッセージ表示用の桁数
const MIN_NUM       = 1001;  // 最小番号

/**
 * 指定の棚番号（例: 'AA'）について、未使用の最小 商品番号(>=1001) を返す。
 * 優先：『棚番号』『商品番号』列を参照。無ければ『管理番号』列をフォールバック参照。
 * 返り値例: '1013'（数字のみ）
 */
function getNextItemNumber(shelfCode) {
  try {
    if (!shelfCode || !/^[A-Z]{2}$/.test(shelfCode)) {
      return `NG(VALIDATION): 棚番号は 'AA' のような英大文字2文字で指定してください`;
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
          const shelf = String(shelfVals[i] ?? '').trim().toUpperCase();
          if (shelf !== shelfCode) continue;
          const num = parseInt(String(itemVals[i] ?? '').trim(), 10);
          if (!Number.isNaN(num) && num >= MIN_NUM) {
            used.add(num);
            if (num > maxSeen) maxSeen = num;
          }
        }
      }
    } else if (idxMng !== -1) {
      // フォールバック：管理番号 'AA-1013' / 'AA1013' / 'AA 1013'
      if (nRows > 0) {
        const vals = sh.getRange(2, idxMng + 1, nRows, 1).getValues().flat();
        const re = new RegExp(`^${shelfCode}[- ]?(\\d+)$`, 'i');
        for (const v of vals) {
          const s = String(v || '').trim();
          const m = s.match(re);
          if (!m) continue;
          const num = parseInt(m[1], 10);
          if (!Number.isNaN(num) && num >= MIN_NUM) {
            used.add(num);
            if (num > maxSeen) maxSeen = num;
          }
        }
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
