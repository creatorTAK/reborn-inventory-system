/** master_hierarchy.gs - getCategoryRows関数を削除し、セールスワード関連のみ残す */

/** セールスワード(カテゴリ) 候補：マスタ優先→在庫/売上管理表 */
function getSalesWordCategoryOptionsFromAnywhere() {
  const res = getCategoryRows(); // master.gsの正本関数を呼び出し
  let options = [];
  if (res && res.ok && res.rows?.length) {
    options = _uniqKeepOrder(
      res.rows.flatMap(r => _splitMulti(r['セールスワード(カテゴリ)']))
    );
  }
  if (options.length === 0) {
    const sh = SpreadsheetApp.getActive().getSheetByName(getMainSheetName_());
    if (sh) {
      const vals = sh.getDataRange().getValues();
      const headers = vals[0];
      const idx = _findIdx(headers, ['セールスワード(カテゴリ)']);
      if (idx !== -1)
        options = _uniqKeepOrder(vals.slice(1).flatMap(row => _splitMulti(row[idx])));
    }
  }
  return { ok:true, options };
}

/** セールスワード 候補：指定カテゴリでマスタを絞り込み→フォールバック */
function getSalesWordOptionsFromAnywhere(cat) {
  const wanted = String(cat || '').trim();
  const res = getCategoryRows(); // master.gsの正本関数を呼び出し
  let words = [];
  if (res && res.ok && res.rows?.length) {
    let rows = res.rows;
    if (wanted) rows = rows.filter(r => _splitMulti(r['セールスワード(カテゴリ)']).includes(wanted));
    words = _uniqKeepOrder(rows.flatMap(r => _splitMulti(r['セールスワード'])));
  }
  if (words.length === 0) {
    const sh = SpreadsheetApp.getActive().getSheetByName(getMainSheetName_());
    if (sh) {
      const vals = sh.getDataRange().getValues();
      const headers = vals[0];
      const idxCat = _findIdx(headers, ['セールスワード(カテゴリ)']);
      const idxWord = _findIdx(headers, ['セールスワード']);
      if (idxWord !== -1) {
        const rows = vals.slice(1);
        const filtered = (!wanted || idxCat === -1)
          ? rows
          : rows.filter(row => _splitMulti(row[idxCat]).includes(wanted));
        words = _uniqKeepOrder(filtered.flatMap(row => _splitMulti(row[idxWord])));
      }
    }
  }
  return { ok:true, options: words };
}