/**
 * カテゴリマスタ移行スクリプト
 *
 * 「手動管理_アイテム分類」シートからFirestoreにカテゴリを移行
 * Firestore REST APIを使用（既存の移行スクリプトと同じ方式）
 *
 * 実行方法:
 * GASスクリプトエディタで migrateCategoriesNextBatch() を実行
 */

// Firestore REST API設定
const CATEGORIES_FIRESTORE_PROJECT_ID = 'reborn-chat';
const CATEGORIES_FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${CATEGORIES_FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

// 1回の実行で処理する件数
const CATEGORIES_CHUNK_SIZE = 500;

/**
 * 次のバッチを移行
 */
function migrateCategoriesNextBatch() {
  const startTime = Date.now();

  Logger.log('========================================');
  Logger.log('カテゴリマスタFirestore移行');
  Logger.log('========================================');

  try {
    // シート情報取得
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('手動管理_アイテム分類');

    if (!sheet) {
      throw new Error('シート「手動管理_アイテム分類」が見つかりません');
    }

    // 進捗確認
    const props = PropertiesService.getScriptProperties();
    const lastRow = parseInt(props.getProperty('CATEGORIES_LAST_ROW') || '0');
    const totalRows = sheet.getLastRow() - 1; // ヘッダー除く

    Logger.log(`📊 進捗: ${lastRow}/${totalRows}件`);

    if (lastRow >= totalRows) {
      Logger.log('🎉 全件移行完了！');
      return { success: true, completed: true };
    }

    // 次のバッチ範囲
    const startRow = lastRow + 2; // +1はヘッダー、+1は次の行
    const endRow = Math.min(startRow + CATEGORIES_CHUNK_SIZE - 1, totalRows + 1);
    const batchSize = endRow - startRow + 1;

    Logger.log(`🔄 処理範囲: ${startRow}行 ~ ${endRow}行 (${batchSize}件)`);

    // データ取得
    const data = sheet.getRange(startRow, 1, batchSize, 6).getValues();

    let successCount = 0;
    let skipCount = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      const level1 = row[0] ? String(row[0]).trim() : '';
      const level2 = row[1] ? String(row[1]).trim() : '';
      const level3 = row[2] ? String(row[2]).trim() : '';
      const level4 = row[3] ? String(row[3]).trim() : '';
      const level5 = row[4] ? String(row[4]).trim() : '';
      const itemName = row[5] ? String(row[5]).trim() : '';

      // 必須項目チェック
      if (!level1 || !level2 || !level3 || !itemName) {
        skipCount++;
        continue;
      }

      // フルパス生成
      const pathParts = [level1, level2, level3];
      if (level4) pathParts.push(level4);
      if (level5) pathParts.push(level5);
      pathParts.push(itemName);
      const fullPath = pathParts.join(' > ');

      // Firestoreドキュメント作成
      const doc = {
        fields: {
          level1: { stringValue: level1 },
          level2: { stringValue: level2 },
          level3: { stringValue: level3 },
          level4: level4 ? { stringValue: level4 } : { nullValue: null },
          level5: level5 ? { stringValue: level5 } : { nullValue: null },
          itemName: { stringValue: itemName },
          fullPath: { stringValue: fullPath },
          usageCount: { integerValue: '0' },
          createdAt: { timestampValue: new Date().toISOString() }
        }
      };

      // Firestore REST APIで保存
      const url = `${CATEGORIES_FIRESTORE_BASE_URL}/categories`;
      const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
        },
        payload: JSON.stringify(doc),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options);

      if (response.getResponseCode() === 200) {
        successCount++;
        if (successCount % 100 === 0) {
          Logger.log(`✅ ${successCount}件完了: ${fullPath}`);
        }
      } else {
        Logger.log(`❌ エラー [${startRow + i}]: ${response.getContentText()}`);
      }

      // レート制限対策
      if (i > 0 && i % 100 === 0) {
        Utilities.sleep(500);
      }
    }

    // 進捗保存
    props.setProperty('CATEGORIES_LAST_ROW', String(endRow - 1));

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    Logger.log('');
    Logger.log('========================================');
    Logger.log('バッチ完了');
    Logger.log('========================================');
    Logger.log(`✅ 成功: ${successCount}件`);
    Logger.log(`⏭️  スキップ: ${skipCount}件`);
    Logger.log(`⏱️  実行時間: ${elapsed}秒`);
    Logger.log(`📊 進捗: ${endRow - 1}/${totalRows}件 (${((endRow - 1) / totalRows * 100).toFixed(1)}%)`);

    if (endRow - 1 < totalRows) {
      Logger.log('');
      Logger.log('🔄 続きがあります。再度 migrateCategoriesNextBatch() を実行してください。');
    }

    return {
      success: true,
      processed: successCount,
      skipped: skipCount,
      total: endRow - 1,
      totalRows: totalRows
    };

  } catch (error) {
    Logger.log('❌ 移行エラー:');
    Logger.log(error.toString());
    Logger.log(error.stack);
    throw error;
  }
}

/**
 * 進捗リセット
 */
function resetCategoriesMigration() {
  PropertiesService.getScriptProperties().deleteProperty('CATEGORIES_LAST_ROW');
  Logger.log('✅ 進捗をリセットしました');
}
