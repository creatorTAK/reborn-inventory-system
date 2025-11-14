/**
 * master_migration.js
 *
 * スプレッドシート上のマスタデータをFirestoreに移行するスクリプト
 * Phase 3: 業務関連マスタ統合
 *
 * 実行方法:
 * 1. migrateShippingMethodsToFirestore() - 発送方法マスタ移行
 * 2. migratePackagingMaterialsToFirestore() - 梱包資材マスタ移行
 * 3. migrateAllBusinessMasters() - 一括移行
 */

// =============================================================================
// Firestore REST API設定
// =============================================================================

const FIRESTORE_PROJECT_ID = 'reborn-chat';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;
const BATCH_SIZE = 500; // Firestore Batch Write APIの上限

// =============================================================================
// 発送方法マスタのFirestore移行
// =============================================================================

/**
 * 発送方法マスタをFirestoreに移行
 * スプレッドシート「発送方法マスタ」→ Firestore「shippingMethods」コレクション
 */
function migrateShippingMethodsToFirestore() {
  try {
    Logger.log('===== 発送方法マスタのFirestore移行開始 =====');

    // スプレッドシートからデータ取得
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('発送方法マスタ');

    if (!sheet) {
      throw new Error('シート「発送方法マスタ」が見つかりません');
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log('移行対象データがありません');
      return {
        success: true,
        message: '移行対象データがありません',
        count: 0
      };
    }

    // ヘッダー行を除く全データを取得
    const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

    // Firestoreに移行するデータを整形
    const items = [];
    let itemCounter = 1;

    for (let i = 0; i < values.length; i++) {
      const method1 = String(values[i][0] || '').trim();
      const method2 = String(values[i][1] || '').trim();
      const fee = values[i][2] || 0;

      // 空行スキップ
      if (!method1 && !method2) {
        continue;
      }

      // Firestore用データ整形
      const id = `shipping_${String(itemCounter).padStart(6, '0')}`;
      const firestoreData = {
        id: id,
        name: `${method1} - ${method2}`, // カテゴリ + 詳細を結合
        category: method1, // カテゴリを別フィールドとして保存
        detail: method2, // 詳細を別フィールドとして保存
        price: Number(fee) || 0,
        description: '', // 説明は空
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'spreadsheet_migration' // 移行元を記録
      };

      items.push(firestoreData);
      itemCounter++;

      Logger.log(`準備: ${firestoreData.name} (¥${firestoreData.price})`);
    }

    Logger.log(`\n準備完了: ${items.length}件のデータを移行します`);

    // Firestoreに一括保存
    const result = saveToFirestoreBatch('shippingMethods', items);

    Logger.log(`===== 発送方法マスタの移行完了: ${result.successCount}/${items.length}件 =====`);

    return {
      success: result.successCount > 0,
      message: `発送方法マスタを${result.successCount}/${items.length}件移行しました`,
      count: result.successCount,
      failed: result.failedCount
    };

  } catch (error) {
    Logger.log(`❌ 発送方法マスタ移行エラー: ${error.message}`);
    return {
      success: false,
      message: `移行エラー: ${error.message}`,
      count: 0
    };
  }
}

// =============================================================================
// 梱包資材マスタのFirestore移行
// =============================================================================

/**
 * 梱包資材マスタをFirestoreに移行
 * スプレッドシート「備品在庫リスト」→ Firestore「packagingMaterials」コレクション
 */
function migratePackagingMaterialsToFirestore() {
  try {
    Logger.log('===== 梱包資材マスタのFirestore移行開始 =====');

    // スプレッドシートからデータ取得
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('備品在庫リスト');

    if (!sheet) {
      throw new Error('シート「備品在庫リスト」が見つかりません');
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log('移行対象データがありません');
      return {
        success: true,
        message: '移行対象データがありません',
        count: 0
      };
    }

    // ヘッダー行を除く全データを取得（12列）
    const values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();

    // Firestoreに移行するデータを整形
    const items = [];
    let itemCounter = 1;

    for (let i = 0; i < values.length; i++) {
      const productName = String(values[i][1] || '').trim();

      // 空行スキップ
      if (!productName) {
        continue;
      }

      // 略称を生成（カタカナ・英字のみ抽出、最大5文字）
      const abbreviation = generateAbbreviation(productName);

      // Firestore用データ整形
      const id = `packaging_${String(itemCounter).padStart(6, '0')}`;
      const firestoreData = {
        id: id,
        name: productName,
        abbreviation: abbreviation,
        category: String(values[i][2] || '').trim(),
        unitPrice: Number(values[i][7]) || 0, // 1個あたり（unitCost）
        imageUrl: String(values[i][0] || '').trim(),
        supplier: String(values[i][3] || '').trim(),
        productLink: String(values[i][4] || '').trim(),
        quantity: Number(values[i][5]) || 0,
        price: Number(values[i][6]) || 0,
        inStock: Number(values[i][8]) || 0,
        outStock: Number(values[i][9]) || 0,
        inventory: Number(values[i][10]) || 0,
        expenseType: String(values[i][11] || '個別原価').trim(),
        createdAt: new Date(),
        updatedAt: new Date(),
        source: 'spreadsheet_migration' // 移行元を記録
      };

      items.push(firestoreData);
      itemCounter++;

      Logger.log(`準備: ${firestoreData.name} (${firestoreData.abbreviation}) - ¥${firestoreData.unitPrice}`);
    }

    Logger.log(`\n準備完了: ${items.length}件のデータを移行します`);

    // Firestoreに一括保存
    const result = saveToFirestoreBatch('packagingMaterials', items);

    Logger.log(`===== 梱包資材マスタの移行完了: ${result.successCount}/${items.length}件 =====`);

    return {
      success: result.successCount > 0,
      message: `梱包資材マスタを${result.successCount}/${items.length}件移行しました`,
      count: result.successCount,
      failed: result.failedCount
    };

  } catch (error) {
    Logger.log(`❌ 梱包資材マスタ移行エラー: ${error.message}`);
    return {
      success: false,
      message: `移行エラー: ${error.message}`,
      count: 0
    };
  }
}

// =============================================================================
// ユーティリティ関数
// =============================================================================

/**
 * 商品名から略称を自動生成
 * カタカナ・英字のみ抽出、最大5文字
 * @param {string} productName - 商品名
 * @returns {string} 略称
 */
function generateAbbreviation(productName) {
  if (!productName) return '';

  // カタカナ・英字のみ抽出
  const katakanaAndAlpha = productName.match(/[ァ-ヶA-Za-z0-9]+/g);

  if (!katakanaAndAlpha || katakanaAndAlpha.length === 0) {
    // カタカナ・英字がない場合は先頭5文字
    return productName.substring(0, 5);
  }

  // 結合して最大5文字
  const abbreviation = katakanaAndAlpha.join('').substring(0, 5);
  return abbreviation;
}

/**
 * Firestoreにデータを保存（Firestore REST API使用）
 * @param {string} collectionName - コレクション名
 * @param {Array} items - 保存するデータ配列
 * @returns {Object} { successCount: number, failedCount: number }
 */
function saveToFirestoreBatch(collectionName, items) {
  let successCount = 0;
  let failedCount = 0;

  // Batch Write APIで処理（最大500件/バッチ）
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batchItems = items.slice(i, i + BATCH_SIZE);

    try {
      // Batch Write APIのリクエストボディ構築
      const writes = batchItems.map(item => {
        // タイムスタンプをISO形式に変換
        const createdAt = item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt;
        const updatedAt = item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt;

        // Firestoreフィールド形式に変換
        const fields = {};
        for (const [key, value] of Object.entries(item)) {
          if (key === 'id') continue; // idはドキュメント名に使用

          if (typeof value === 'string') {
            fields[key] = { stringValue: value };
          } else if (typeof value === 'number') {
            fields[key] = { integerValue: value };
          } else if (value instanceof Date) {
            fields[key] = { stringValue: value.toISOString() };
          } else if (typeof value === 'boolean') {
            fields[key] = { booleanValue: value };
          }
        }

        return {
          update: {
            name: `projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents/${collectionName}/${item.id}`,
            fields: fields
          }
        };
      });

      const batchRequest = {
        writes: writes
      };

      // Batch Write API呼び出し
      const url = `${FIRESTORE_BASE_URL}:batchWrite`;
      const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
        },
        payload: JSON.stringify(batchRequest),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();

      if (responseCode === 200) {
        // バッチ全体が成功
        successCount += batchItems.length;
        Logger.log(`  ✅ バッチ成功: ${batchItems.length}件`);
      } else {
        // バッチ全体が失敗
        failedCount += batchItems.length;
        Logger.log(`  ❌ バッチ失敗: ${batchItems.length}件`);
        Logger.log(`  HTTPステータス: ${responseCode}`);
        Logger.log(`  レスポンス: ${response.getContentText().substring(0, 500)}`);
      }

      // バッチ間に短い待機（レート制限対策）
      if (i + BATCH_SIZE < items.length) {
        Utilities.sleep(100);
      }

    } catch (error) {
      Logger.log(`  ❌ バッチエラー: ${error.message}`);
      failedCount += batchItems.length;
    }
  }

  return {
    successCount: successCount,
    failedCount: failedCount
  };
}

// =============================================================================
// 移行後のクリーンアップ（オプション）
// =============================================================================

/**
 * 移行完了後のスプレッドシートシート非表示化
 * ※削除はせず、非表示にして保持
 */
function hideOldMasterSheets() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // 発送方法マスタシートを非表示
    const shippingSheet = ss.getSheetByName('発送方法マスタ');
    if (shippingSheet) {
      shippingSheet.hideSheet();
      Logger.log('✅ 「発送方法マスタ」シートを非表示にしました');
    }

    // 備品在庫リストシートは非表示にしない（在庫管理で使用中のため）
    Logger.log('✅ 「備品在庫リスト」シートは在庫管理で使用中のため非表示にしません');

    return {
      success: true,
      message: '旧マスタシートの非表示化完了'
    };

  } catch (error) {
    Logger.log(`❌ シート非表示化エラー: ${error.message}`);
    return {
      success: false,
      message: `エラー: ${error.message}`
    };
  }
}

// =============================================================================
// 一括移行実行
// =============================================================================

/**
 * すべての業務関連マスタを一括移行
 */
function migrateAllBusinessMasters() {
  Logger.log('========================================');
  Logger.log('業務関連マスタの一括移行を開始');
  Logger.log('========================================');

  // 1. 発送方法マスタ移行
  const shippingResult = migrateShippingMethodsToFirestore();
  Logger.log(`発送方法: ${shippingResult.message}`);

  // 2. 梱包資材マスタ移行
  const packagingResult = migratePackagingMaterialsToFirestore();
  Logger.log(`梱包資材: ${packagingResult.message}`);

  Logger.log('========================================');
  Logger.log('一括移行完了');
  Logger.log(`発送方法: ${shippingResult.count}件`);
  Logger.log(`梱包資材: ${packagingResult.count}件`);
  Logger.log('========================================');

  return {
    success: shippingResult.success && packagingResult.success,
    shipping: shippingResult,
    packaging: packagingResult
  };
}
