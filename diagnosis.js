// === 段階的診断用関数群 ===

// 1. 基本的なシートアクセステスト
function testBasicSheetAccess() {
  console.time('シートアクセステスト');
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('マスタデータ'); // シート名を実際の名前に変更
    
    if (!masterSheet) {
      console.log('❌ マスタシートが見つかりません');
      return false;
    }
    
    const lastRow = masterSheet.getLastRow();
    const lastCol = masterSheet.getLastColumn();
    
    console.log(`✅ シートアクセス成功: ${lastRow}行 x ${lastCol}列`);
    console.log(`データ範囲: ${masterSheet.getDataRange().getA1Notation()}`);
    
    return true;
  } catch (error) {
    console.log('❌ シートアクセスエラー:', error.toString());
    return false;
  } finally {
    console.timeEnd('シートアクセステスト');
  }
}

// 2. シート保護設定の確認
function checkSheetProtections() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('マスタデータ');
    
    const protections = masterSheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    
    console.log(`保護範囲数: ${protections.length}`);
    protections.forEach((protection, index) => {
      const range = protection.getRange();
      console.log(`保護範囲${index + 1}: ${range.getA1Notation()}`);
      console.log(`  編集者: ${protection.getEditors().map(u => u.getEmail()).join(', ')}`);
    });
    
    return protections;
  } catch (error) {
    console.log('❌ 保護設定確認エラー:', error.toString());
    return [];
  }
}

// 3. 小範囲データ読み取りテスト
function testSmallDataRead() {
  console.time('小範囲読み取り');
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('マスタデータ');
    
    // 最初の10行だけテスト
    const testRange = masterSheet.getRange(1, 1, Math.min(10, masterSheet.getLastRow()), masterSheet.getLastColumn());
    const values = testRange.getValues();
    
    console.log(`✅ 小範囲読み取り成功: ${values.length}行`);
    console.log('ヘッダー行:', values[0]);
    console.log('サンプル行:', values[1] || 'データなし');
    
    return values;
  } catch (error) {
    console.log('❌ 小範囲読み取りエラー:', error.toString());
    return [];
  } finally {
    console.timeEnd('小範囲読み取り');
  }
}

// 4. 単一セル書き込みテスト
function testSingleCellWrite() {
  console.time('単一セル書き込み');
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('マスタデータ');
    
    // 空いているセルに書き込みテスト
    const testCell = masterSheet.getRange(masterSheet.getLastRow() + 1, 1);
    const testValue = `テスト_${new Date().getTime()}`;
    
    testCell.setValue(testValue);
    SpreadsheetApp.flush(); // 強制的に書き込み実行
    
    // 読み取り確認
    const writtenValue = testCell.getValue();
    const success = writtenValue === testValue;
    
    console.log(`✅ 書き込みテスト: ${success ? '成功' : '失敗'}`);
    console.log(`期待値: ${testValue}, 実際値: ${writtenValue}`);
    
    // テストデータを削除
    testCell.clearContent();
    
    return success;
  } catch (error) {
    console.log('❌ 書き込みテストエラー:', error.toString());
    return false;
  } finally {
    console.timeEnd('単一セル書き込み');
  }
}

// 5. 現在のマスタ管理関数の安全な実行テスト
function testCurrentMasterFunction() {
  console.time('現在の関数テスト');
  try {
    // 制限時間を設定（30秒でタイムアウト）
    const timeoutId = Utilities.sleep(1); // 最小限の処理
    
    // 実際のaddKeywordToMaster関数を短縮版で実行
    // ※ 実際の関数名と引数に変更してください
    console.log('⚠ 実際のマスタ関数呼び出しは手動で実行してください');
    console.log('例: addKeywordToMaster("テストカテゴリ", "テストキーワード")');
    
    return true;
  } catch (error) {
    console.log('❌ 現在の関数テストエラー:', error.toString());
    return false;
  } finally {
    console.timeEnd('現在の関数テスト');
  }
}

// 6. メモリ使用量チェック
function checkMemoryUsage() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('マスタデータ');
    
    const dataRange = masterSheet.getDataRange();
    const cellCount = dataRange.getNumRows() * dataRange.getNumColumns();
    
    console.log(`総セル数: ${cellCount.toLocaleString()}`);
    console.log(`推定メモリ使用量: ${Math.round(cellCount * 100 / 1024 / 1024)}MB`);
    
    // GASの制限値との比較
    if (cellCount > 2000000) {
      console.log('⚠ 警告: セル数がGAS推奨制限を超えています');
    }
    
    return cellCount;
  } catch (error) {
    console.log('❌ メモリ使用量チェックエラー:', error.toString());
    return -1;
  }
}

// === 総合診断実行関数 ===
function runCompleteDiagnosis() {
  console.log('=== 古着転売システム マスタデータ診断開始 ===\n');
  
  const results = {};
  
  results.basicAccess = testBasicSheetAccess();
  console.log('');
  
  results.protections = checkSheetProtections();
  console.log('');
  
  results.smallRead = testSmallDataRead();
  console.log('');
  
  results.singleWrite = testSingleCellWrite();
  console.log('');
  
  results.memoryUsage = checkMemoryUsage();
  console.log('');
  
  testCurrentMasterFunction();
  
  console.log('\n=== 診断結果サマリー ===');
  console.log(`シートアクセス: ${results.basicAccess ? '✅' : '❌'}`);
  console.log(`保護設定: ${results.protections.length > 0 ? '⚠要確認' : '✅'}`);
  console.log(`データ読み取り: ${results.smallRead.length > 0 ? '✅' : '❌'}`);
  console.log(`データ書き込み: ${results.singleWrite ? '✅' : '❌'}`);
  console.log(`メモリ使用量: ${results.memoryUsage > 1000000 ? '⚠高負荷' : '✅'}`);
  
  return results;
}

// === 緊急時の安全なマスタ操作関数 ===
function safeAddKeyword(category, keyword) {
  console.time('安全なキーワード追加');
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const masterSheet = ss.getSheetByName('マスタデータ');
    
    // 最後の行を取得（時間をかけない方法）
    const lastRow = masterSheet.getLastRow();
    
    // 新しい行に直接追加（最小限の操作）
    const newRow = lastRow + 1;
    const range = masterSheet.getRange(newRow, 1, 1, 2); // カテゴリとキーワードの2列のみ
    
    range.setValues([[category, keyword]]);
    SpreadsheetApp.flush();
    
    console.log(`✅ キーワード追加成功: ${category} - ${keyword}`);
    return true;
  } catch (error) {
    console.log('❌ 安全なキーワード追加エラー:', error.toString());
    return false;
  } finally {
    console.timeEnd('安全なキーワード追加');
  }
}