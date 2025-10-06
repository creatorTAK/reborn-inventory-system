/** filter.js **/
// 高機能フィルタリングシステム

/**
 * フィルタダイアログを表示
 */
function showFilterDialog() {
  const html = HtmlService.createHtmlOutputFromFile('filter_dialog')
    .setWidth(450)
    .setHeight(550);
  SpreadsheetApp.getUi().showModalDialog(html, '🔍 在庫絞り込み');
}

/**
 * クイックフィルタ: 在庫中のみ
 */
function quickFilterInStock() {
  return applyQuickFilter('ステータス', '在庫中');
}

/**
 * クイックフィルタ: 出品済のみ
 */
function quickFilterListed() {
  return applyQuickFilter('ステータス', '出品済');
}

/**
 * クイックフィルタ: 未販売のみ
 */
function quickFilterUnsold() {
  const sheet = getSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusIdx = headers.indexOf('ステータス');

  if (statusIdx === -1) {
    return 'NG: ステータス列が見つかりません';
  }

  // 既存のフィルタを削除
  clearFilter();

  // 新しいフィルタを作成
  const dataRange = sheet.getDataRange();
  const filter = dataRange.createFilter();

  // 「販売済」以外を表示
  const criteria = SpreadsheetApp.newFilterCriteria()
    .whenTextDoesNotContain('販売済')
    .build();
  filter.setColumnFilterCriteria(statusIdx + 1, criteria);

  return 'OK: 未販売のみ表示しました';
}

/**
 * クイックフィルタ: 今月仕入れ分のみ
 */
function quickFilterThisMonth() {
  const sheet = getSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const dateIdx = headers.indexOf('仕入日');

  if (dateIdx === -1) {
    return 'NG: 仕入日列が見つかりません';
  }

  // 今月の開始日
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // 既存のフィルタを削除
  clearFilter();

  // 新しいフィルタを作成
  const dataRange = sheet.getDataRange();
  const filter = dataRange.createFilter();

  const criteria = SpreadsheetApp.newFilterCriteria()
    .whenDateAfter(thisMonthStart)
    .build();
  filter.setColumnFilterCriteria(dateIdx + 1, criteria);

  return 'OK: 今月仕入れ分のみ表示しました';
}

/**
 * クイックフィルタ: 在庫日数30日以上
 */
function quickFilterOldStock() {
  const sheet = getSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const daysIdx = headers.indexOf('在庫日数');

  if (daysIdx === -1) {
    return 'NG: 在庫日数列が見つかりません';
  }

  // 既存のフィルタを削除
  clearFilter();

  // 新しいフィルタを作成
  const dataRange = sheet.getDataRange();
  const filter = dataRange.createFilter();

  const criteria = SpreadsheetApp.newFilterCriteria()
    .whenNumberGreaterThanOrEqualTo(30)
    .build();
  filter.setColumnFilterCriteria(daysIdx + 1, criteria);

  return 'OK: 在庫日数30日以上のみ表示しました';
}

/**
 * 汎用クイックフィルタ
 */
function applyQuickFilter(columnName, value) {
  const sheet = getSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const colIdx = headers.indexOf(columnName);

  if (colIdx === -1) {
    return `NG: ${columnName}列が見つかりません`;
  }

  // 既存のフィルタを削除
  clearFilter();

  // 新しいフィルタを作成
  const dataRange = sheet.getDataRange();
  const filter = dataRange.createFilter();

  const criteria = SpreadsheetApp.newFilterCriteria()
    .whenTextEqualTo(value)
    .build();
  filter.setColumnFilterCriteria(colIdx + 1, criteria);

  return `OK: ${value}のみ表示しました`;
}

/**
 * 複合条件フィルタを適用
 */
function applyComplexFilter(conditions) {
  try {
    const sheet = getSheet_();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // 既存のフィルタを削除
    clearFilter();

    // 新しいフィルタを作成
    const dataRange = sheet.getDataRange();
    const filter = dataRange.createFilter();

    // 各条件を適用
    if (conditions.shelf && conditions.shelf !== '全て') {
      const mgmtIdx = headers.indexOf('管理番号');
      if (mgmtIdx !== -1) {
        const criteria = SpreadsheetApp.newFilterCriteria()
          .whenTextStartsWith(conditions.shelf + '-')
          .build();
        filter.setColumnFilterCriteria(mgmtIdx + 1, criteria);
      }
    }

    if (conditions.status && conditions.status !== '全て') {
      const statusIdx = headers.indexOf('ステータス');
      if (statusIdx !== -1) {
        const criteria = SpreadsheetApp.newFilterCriteria()
          .whenTextEqualTo(conditions.status)
          .build();
        filter.setColumnFilterCriteria(statusIdx + 1, criteria);
      }
    }

    if (conditions.staff && conditions.staff !== '全て') {
      const staffIdx = headers.indexOf('担当者');
      if (staffIdx !== -1) {
        const criteria = SpreadsheetApp.newFilterCriteria()
          .whenTextEqualTo(conditions.staff)
          .build();
        filter.setColumnFilterCriteria(staffIdx + 1, criteria);
      }
    }

    if (conditions.brand && conditions.brand.trim() !== '') {
      const brandEnIdx = headers.indexOf('ブランド(英語)');
      const brandKanaIdx = headers.indexOf('ブランド(カナ)');

      // ブランド英語またはカナで検索
      if (brandEnIdx !== -1) {
        const criteria = SpreadsheetApp.newFilterCriteria()
          .whenTextContains(conditions.brand)
          .build();
        filter.setColumnFilterCriteria(brandEnIdx + 1, criteria);
      }
    }

    return 'OK: フィルタを適用しました';
  } catch (e) {
    return 'NG: ' + e.message;
  }
}

/**
 * リアルタイム検索
 */
function searchProducts(keyword) {
  try {
    if (!keyword || keyword.trim() === '') {
      return clearFilter();
    }

    const sheet = getSheet_();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // 検索対象列
    const searchColumns = [
      '管理番号',
      '商品名(タイトル)',
      'ブランド(英語)',
      'ブランド(カナ)'
    ];

    // 既存のフィルタを削除
    clearFilter();

    // キーワードに一致する行を検索
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return 'NG: データがありません';

    const dataRange = sheet.getDataRange();
    const values = dataRange.getValues();

    // 一致する行番号を収集
    const matchedRows = [];
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      let matched = false;

      for (const colName of searchColumns) {
        const colIdx = headers.indexOf(colName);
        if (colIdx !== -1) {
          const cellValue = String(row[colIdx] || '').toLowerCase();
          if (cellValue.includes(keyword.toLowerCase())) {
            matched = true;
            break;
          }
        }
      }

      if (matched) {
        matchedRows.push(i + 1); // 1-indexed
      }
    }

    if (matchedRows.length === 0) {
      return 'NG: 検索結果が見つかりません';
    }

    // フィルタを適用（管理番号列を使用）
    const mgmtIdx = headers.indexOf('管理番号');
    if (mgmtIdx === -1) return 'NG: 管理番号列が見つかりません';

    const filter = dataRange.createFilter();

    // 一致した管理番号のリストを作成
    const matchedMgmtNumbers = matchedRows.map(rowNum => values[rowNum - 1][mgmtIdx]);

    const criteria = SpreadsheetApp.newFilterCriteria()
      .whenTextContains(keyword)
      .build();

    // 管理番号、商品名、ブランドのいずれかでフィルタ
    filter.setColumnFilterCriteria(mgmtIdx + 1, criteria);

    return `OK: ${matchedRows.length}件見つかりました`;
  } catch (e) {
    return 'NG: ' + e.message;
  }
}

/**
 * フィルタを解除
 */
function clearFilter() {
  try {
    const sheet = getSheet_();
    const filter = sheet.getFilter();
    if (filter) {
      filter.remove();
    }
    return 'OK: フィルタを解除しました';
  } catch (e) {
    return 'OK'; // フィルタがない場合もOK
  }
}

/**
 * フィルタ用の選択肢データを取得
 */
function getFilterOptions() {
  const sheet = getSheet_();
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const lastRow = sheet.getLastRow();

  const options = {
    shelves: ['全て'],
    statuses: ['全て'],
    staff: ['全て']
  };

  if (lastRow < 2) return options;

  // 棚番号を抽出（管理番号から）
  const mgmtIdx = headers.indexOf('管理番号');
  if (mgmtIdx !== -1) {
    const mgmtValues = sheet.getRange(2, mgmtIdx + 1, lastRow - 1, 1).getValues().flat();
    const shelfSet = new Set();
    mgmtValues.forEach(val => {
      const str = String(val || '').trim();
      const match = str.match(/^([A-Z]{1,2})-/);
      if (match) {
        shelfSet.add(match[1]);
      }
    });
    options.shelves = options.shelves.concat(Array.from(shelfSet).sort());
  }

  // ステータス
  const statusIdx = headers.indexOf('ステータス');
  if (statusIdx !== -1) {
    const statusValues = sheet.getRange(2, statusIdx + 1, lastRow - 1, 1).getValues().flat();
    const statusSet = new Set(statusValues.filter(v => v && String(v).trim() !== ''));
    options.statuses = options.statuses.concat(Array.from(statusSet).sort());
  }

  // 担当者
  const staffIdx = headers.indexOf('担当者');
  if (staffIdx !== -1) {
    const staffValues = sheet.getRange(2, staffIdx + 1, lastRow - 1, 1).getValues().flat();
    const staffSet = new Set(staffValues.filter(v => v && String(v).trim() !== ''));
    options.staff = options.staff.concat(Array.from(staffSet).sort());
  }

  return options;
}

/**
 * シート取得（共通関数）
 */
function getSheet_() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName('在庫/売上管理表');
}
