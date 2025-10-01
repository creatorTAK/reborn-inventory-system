/**
 * master_data_manager.gs - マスタデータ管理システム（安定版）
 * キーワードの追加・削除・編集を安全に行う専用インターフェース
 */

// =============================================================================
// マスタデータ管理サイドバー表示
// =============================================================================
function showMasterDataManager() {
  const html = HtmlService.createTemplateFromFile('master_manager_ui');
  const sidebar = html.evaluate().setTitle('マスタデータ管理').setWidth(420);
  SpreadsheetApp.getUi().showSidebar(sidebar);
}

// =============================================================================
// 共通ユーティリティ関数
// =============================================================================

/**
 * マスタシート取得（エラーハンドリング付き）
 */
function getMasterSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('マスタデータ');
    if (!sheet) {
      throw new Error('マスタデータシートが見つかりません');
    }
    return sheet;
  } catch (error) {
    console.error('シート取得エラー:', error);
    throw error;
  }
}

/**
 * 複数値分割（カンマ・改行対応）
 */
function splitMulti(value) {
  if (!value) return [];
  return String(value)
    .split(/[,\n\r]+/)
    .map(v => v.trim())
    .filter(v => v !== '');
}

/**
 * 重複除去（順序保持）
 */
function uniqKeepOrder(array) {
  return [...new Set(array)];
}

// =============================================================================
// マスタデータ取得（カテゴリ別）- 軽量版
// =============================================================================
function getMasterDataByCategory() {
  try {
    // 一時的に簡易版を返す
    return {
      success: false,
      message: "マスタデータ取得機能は一時的に無効化されています（データ量が大きすぎるため）",
      categories: {
        '担当者': ['安藤', '山本', '高橋', 'テスト担当者123', 'セーフテスト担当者'],
        'セールスワード': [],
        '生地・素材・質感系': [],
        '季節感・機能性': [],
        '着用シーン・イベント': [],
        'ディテール・仕様': [],
        '見た目・印象': [],
        'トレンド表現': [],
        'サイズ感・体型カバー': [],
        '年代・テイスト・スタイル': [],
        'カラー/配色/トーン': [],
        '柄・模様': [],
        'シルエット/ライン': [],
        'ネックライン': [],
        '襟・衿': [],
        '袖・袖付け': [],
        '丈': [],
        '革/加工': [],
        '毛皮/加工': [],
        '生産国': [],
        'サイズ': [],
        '商品の状態': [],
        'ブランド(英語)': [],
        'ブランド(カナ)': [],
        '仕入先': [],
        '出品先': [],
        '配送料の負担': [],
        '配送の方法': [],
        '発送元の地域': [],
        '発送までの日数': []
      }
    };
  } catch (error) {
    console.error('マスタデータ取得エラー:', error);
    return {
      success: false,
      message: `データ取得エラー: ${error.message}`,
      categories: {}
    };
  }
}

// =============================================================================
// 安全なキーワード管理関数群（軽量版）
// =============================================================================

/**
 * 安全なキーワード追加関数（重複チェックなし）
 */
function addKeywordToMaster(category, newKeyword) {
  try {
    console.log(`安全な追加開始: ${category} -> ${newKeyword}`);
    
    // 入力チェック
    if (!newKeyword || newKeyword.trim() === '') {
      return { success: false, message: 'キーワードを入力してください' };
    }
    
    const keyword = newKeyword.trim();
    const sh = getMasterSheet();
    
    // ヘッダー取得と列インデックス確認
    const lastCol = sh.getLastColumn();
    const headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    const colIndex = headers.indexOf(category);
    
    if (colIndex === -1) {
      return { success: false, message: `カテゴリ「${category}」が見つかりません` };
    }
    
    // 重複チェックを省略して直接追加（高速化）
    const lastRow = sh.getLastRow();
    const targetRow = lastRow + 1;
    
    // 新しい行に直接追加
    sh.getRange(targetRow, colIndex + 1).setValue(keyword);
    SpreadsheetApp.flush();
    
    console.log(`追加完了: ${targetRow}行目`);
    
    return {
      success: true,
      message: `「${keyword}」を${category}に追加しました`,
      addedRow: targetRow,
      addedKeyword: keyword
    };
    
  } catch (error) {
    console.error('追加エラー:', error);
    return { success: false, message: `追加エラー: ${error.message}` };
  }
}

/**
 * キーワード削除関数（無効化版）
 */
function deleteKeywordFromMaster(category, targetKeyword) {
  return {
    success: false,
    message: "削除機能は一時的に無効化されています。手動でマスタデータを編集してください。"
  };
}

/**
 * キーワード編集関数（無効化版）
 */
function editKeywordInMaster(category, oldKeyword, newKeyword) {
  return {
    success: false,
    message: "編集機能は一時的に無効化されています。手動でマスタデータを編集してください。"
  };
}

/**
 * データ整理（無効化版）
 */
function cleanupMasterData(category) {
  return {
    success: false,
    message: "データ整理機能は一時的に無効化されています。"
  };
}

// =============================================================================
// 一括インポート（無効化版）
// =============================================================================
function bulkImportKeywords(category, keywordList) {
  return {
    success: false,
    message: "一括インポート機能は一時的に無効化されています。"
  };
}

// =============================================================================
// 診断・テスト関数群
// =============================================================================

/**
 * シンプルな追加テスト
 */
function simpleAddTest() {
  try {
    console.log('=== シンプル追加テスト開始 ===');
    
    const sh = getMasterSheet();
    console.log('シート取得成功:', sh.getName());
    
    // ヘッダー確認
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    console.log('ヘッダー:', headers);
    
    // 担当者列の確認
    const colIndex = headers.indexOf('担当者');
    console.log('担当者列インデックス:', colIndex);
    
    if (colIndex === -1) {
      console.log('ERROR: 担当者列が見つかりません');
      return { success: false, message: '担当者列が見つかりません' };
    }
    
    // 現在のデータを確認
    const lastRow = sh.getLastRow();
    console.log('最終行:', lastRow);
    
    if (lastRow >= 2) {
      const currentData = sh.getRange(2, colIndex + 1, lastRow - 1, 1).getValues();
      console.log('担当者列の現在のデータ:', currentData.flat().filter(v => v));
    }
    
    // 直接書き込みテスト
    const newRow = lastRow + 1;
    const testValue = `テスト担当者_${Date.now()}`;
    console.log(`新しい行 ${newRow} の ${colIndex + 1} 列目に "${testValue}" を書き込み`);
    
    sh.getRange(newRow, colIndex + 1).setValue(testValue);
    SpreadsheetApp.flush();
    
    console.log('書き込み完了');
    
    // 書き込み結果を確認
    const writtenValue = sh.getRange(newRow, colIndex + 1).getValue();
    console.log('書き込まれた値:', writtenValue);
    
    console.log('=== テスト完了 ===');
    
    return {
      success: true,
      message: `${newRow}行目に書き込み完了`,
      writtenValue: writtenValue
    };
    
  } catch (error) {
    console.error('テストエラー:', error);
    return { success: false, message: error.message };
  }
}

/**
 * 担当者列データ確認
 */
function checkTantoData() {
  try {
    const sh = getMasterSheet();
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const colIndex = headers.indexOf('担当者');
    
    if (colIndex === -1) {
      console.log('担当者列が見つかりません');
      return { success: false, message: '担当者列が見つかりません' };
    }
    
    const lastRow = sh.getLastRow();
    if (lastRow >= 2) {
      const data = sh.getRange(2, colIndex + 1, lastRow - 1, 1).getValues().flat();
      console.log('担当者列の全データ:');
      const validData = [];
      data.forEach((value, index) => {
        if (value) {
          console.log(`  ${index + 2}行目: "${value}"`);
          validData.push(value);
        }
      });
      return { success: true, data: validData, count: validData.length };
    } else {
      console.log('担当者列にデータがありません');
      return { success: true, data: [], count: 0 };
    }
    
  } catch (error) {
    console.error('エラー:', error);
    return { success: false, message: error.message };
  }
}

/**
 * 安全なテスト関数
 */
function safeTestAddKeyword() {
  try {
    console.log('安全テスト開始');
    
    // 1. シート取得テスト
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sh = ss.getSheetByName('マスタデータ');
    
    if (!sh) {
      SpreadsheetApp.getUi().alert('エラー', 'マスタデータシートが見つかりません', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    
    console.log('シート取得成功');
    
    // 2. ヘッダー確認
    const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    const tantoIndex = headers.indexOf('担当者');
    
    if (tantoIndex === -1) {
      SpreadsheetApp.getUi().alert('エラー', '担当者列が見つかりません', SpreadsheetApp.getUi().ButtonSet.OK);
      return;
    }
    
    console.log('担当者列確認: ' + tantoIndex);
    
    // 3. 直接書き込み（重複チェックなし）
    const lastRow = sh.getLastRow();
    const newRow = lastRow + 1;
    const testValue = 'セーフテスト_' + Date.now();
    
    sh.getRange(newRow, tantoIndex + 1).setValue(testValue);
    SpreadsheetApp.flush();
    
    console.log('書き込み完了: ' + newRow + '行目');
    
    SpreadsheetApp.getUi().alert('成功', `${newRow}行目に「${testValue}」を追加しました`, SpreadsheetApp.getUi().ButtonSet.OK);
    
  } catch (error) {
    console.error('エラー:', error);
    SpreadsheetApp.getUi().alert('エラー', `エラー発生: ${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 商品登録機能テスト
 */
function testProductSave() {
  try {
    console.log('商品登録テスト開始');
    
    // マスタデータシートで担当者を確認
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('マスタデータ');
    
    // I列（9列目）の担当者データを確認
    const lastRow = masterSheet.getLastRow();
    if (lastRow >= 2) {
      const tantoData = masterSheet.getRange(2, 9, lastRow - 1, 1).getValues().flat();
      console.log('マスタデータの担当者一覧:', tantoData.filter(v => v));
    }
    
    // メインシート（商品データ）への書き込みテスト
    const mainSheet = ss.getSheets()[0]; // 最初のシート（商品管理用）
    const mainLastRow = mainSheet.getLastRow();
    const newRow = mainLastRow + 1;
    
    // 担当者列に書き込み（メインシートの10列目と仮定）
    const testValue = "テスト担当者商品登録_" + Date.now();
    mainSheet.getRange(newRow, 10).setValue(testValue); // J列（10列目）に書き込み
    
    SpreadsheetApp.flush();
    
    SpreadsheetApp.getUi().alert(
      '商品登録テスト結果', 
      `マスタデータ: I列に担当者データ確認\nメインシート: ${newRow}行目のJ列に「${testValue}」を書き込みました`, 
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
  } catch (error) {
    console.error('テストエラー:', error);
    SpreadsheetApp.getUi().alert('エラー', `テストエラー: ${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

/**
 * 簡単な動作確認テスト
 */
function quickTest() {
  try {
    // addKeywordToMaster のテスト
    const result = addKeywordToMaster("担当者", "クイックテスト_" + Date.now());
    
    SpreadsheetApp.getUi().alert(
      'クイックテスト結果',
      `成功: ${result.success}\nメッセージ: ${result.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    
    return result;
    
  } catch (error) {
    SpreadsheetApp.getUi().alert('エラー', `エラー: ${error.message}`, SpreadsheetApp.getUi().ButtonSet.OK);
    return { success: false, message: error.message };
  }
}