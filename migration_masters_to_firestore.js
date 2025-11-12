/**
 * REBORN在庫管理システム - マスタデータFirestore Migration
 *
 * カテゴリマスタとマスタオプションをFirestoreに移行します。
 *
 * 使用方法:
 * 1. GASエディタでこのスクリプトを開く
 * 2. 関数 migrateMastersToFirestore() を実行
 *
 * @version 1.0.0
 * @created 2025-11-12
 * @related-issue ARCH-001 Phase 3
 */

// Firestore REST API設定
const MASTERS_FIRESTORE_PROJECT_ID = 'reborn-chat';
const MASTERS_FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${MASTERS_FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

/**
 * メイン移行関数
 */
function migrateMastersToFirestore() {
  console.log('========================================');
  console.log('マスタデータFirestore移行開始');
  console.log('========================================');

  const startTime = Date.now();

  try {
    // 1. カテゴリマスタ移行
    console.log('\n[1/2] カテゴリマスタ移行開始...');
    const categoryResult = migrateCategoryMaster();
    console.log(`✅ カテゴリマスタ移行完了: ${categoryResult.count}件`);

    // 2. マスタオプション移行
    console.log('\n[2/2] マスタオプション移行開始...');
    const optionsResult = migrateMasterOptions();
    console.log(`✅ マスタオプション移行完了: ${optionsResult.fieldCount}フィールド`);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('\n========================================');
    console.log(`✅ 全体移行完了 (所要時間: ${duration}秒)`);
    console.log('========================================');

    return {
      success: true,
      duration: duration,
      categories: categoryResult.count,
      masterOptionsFields: optionsResult.fieldCount
    };

  } catch (error) {
    console.error('❌ 移行エラー:', error);
    throw error;
  }
}

/**
 * カテゴリマスタをFirestoreに移行
 */
function migrateCategoryMaster() {
  console.log('カテゴリマスタ取得中...');

  // 既存のGAS API関数を使用
  const categoryData = getCategoryRows();

  if (!categoryData || !categoryData.ok) {
    throw new Error('カテゴリマスタの取得に失敗しました: ' + (categoryData?.msg || 'Unknown error'));
  }

  const rows = categoryData.rows || [];
  console.log(`カテゴリマスタ取得完了: ${rows.length}件`);

  if (rows.length === 0) {
    console.warn('⚠️ カテゴリマスタにデータがありません');
    return { count: 0 };
  }

  // Firestoreに保存（単一ドキュメントに全データ）
  console.log('Firestoreに保存中...');

  // Firestore用データ構造に変換
  const firestoreDoc = {
    fields: {
      rows: { arrayValue: { values: rows.map(row => ({ mapValue: { fields: convertToFirestoreFields(row) } })) } },
      updatedAt: { stringValue: new Date().toISOString() },
      version: { stringValue: '1.0.0' },
      source: { stringValue: 'migration_masters_to_firestore.js' }
    }
  };

  // Firestore REST API経由で保存
  const url = `${MASTERS_FIRESTORE_BASE_URL}/categories/master`;
  const options = {
    method: 'patch',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify(firestoreDoc),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();

  if (responseCode !== 200) {
    throw new Error(`Firestore保存エラー (${responseCode}): ${response.getContentText()}`);
  }

  console.log(`Firestoreに保存完了: categories/master`);

  return { count: rows.length };
}

/**
 * マスタオプションをFirestoreに移行（フィールドごとに分割保存）
 */
function migrateMasterOptions() {
  console.log('マスタオプション取得中...');

  // 既存のGAS API関数を使用
  const options = getMasterOptions();

  if (!options || typeof options !== 'object') {
    throw new Error('マスタオプションの取得に失敗しました');
  }

  const fieldNames = Object.keys(options);
  const fieldCount = fieldNames.length;
  console.log(`マスタオプション取得完了: ${fieldCount}フィールド`);

  // 統計情報を計算
  let totalItems = 0;
  const fieldStats = {};
  fieldNames.forEach(field => {
    const count = (options[field] || []).length;
    fieldStats[field] = count;
    totalItems += count;
  });

  console.log(`総選択肢数: ${totalItems}個`);

  // Firestoreに保存（フィールドごとに分割）
  console.log('Firestoreに保存中（フィールドごとに分割）...');

  let savedCount = 0;
  let failedFields = [];

  // 各フィールドを個別のドキュメントとして保存
  fieldNames.forEach((fieldName, index) => {
    const items = options[fieldName] || [];

    // フィールド名をURLセーフに変換（スラッシュなど特殊文字を置換）
    const safeFieldName = fieldName
      .replace(/\//g, '_')
      .replace(/\(/g, '_')
      .replace(/\)/g, '_')
      .replace(/\s/g, '_');

    const firestoreDoc = {
      fields: {
        fieldName: { stringValue: fieldName },
        items: {
          arrayValue: {
            values: items.map(val => ({ stringValue: String(val) }))
          }
        },
        count: { integerValue: items.length },
        updatedAt: { stringValue: new Date().toISOString() }
      }
    };

    try {
      const url = `${MASTERS_FIRESTORE_BASE_URL}/masterOptions/${safeFieldName}`;
      const requestOptions = {
        method: 'patch',
        contentType: 'application/json',
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
        },
        payload: JSON.stringify(firestoreDoc),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, requestOptions);
      const responseCode = response.getResponseCode();

      if (responseCode === 200) {
        savedCount++;
        if ((index + 1) % 10 === 0) {
          console.log(`進捗: ${index + 1}/${fieldCount} フィールド保存完了`);
        }
      } else {
        console.error(`❌ フィールド "${fieldName}" 保存失敗 (${responseCode}): ${response.getContentText()}`);
        failedFields.push(fieldName);
      }
    } catch (error) {
      console.error(`❌ フィールド "${fieldName}" 保存エラー:`, error);
      failedFields.push(fieldName);
    }
  });

  // インデックスドキュメントを保存（全フィールドのリスト）
  console.log('インデックスドキュメントを保存中...');
  const indexDoc = {
    fields: {
      fieldNames: {
        arrayValue: {
          values: fieldNames.map(name => ({ stringValue: name }))
        }
      },
      fieldCount: { integerValue: fieldCount },
      totalItems: { integerValue: totalItems },
      updatedAt: { stringValue: new Date().toISOString() },
      version: { stringValue: '1.0.0' }
    }
  };

  const indexUrl = `${MASTERS_FIRESTORE_BASE_URL}/masterOptions/_index`;
  const indexOptions = {
    method: 'patch',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify(indexDoc),
    muteHttpExceptions: true
  };

  const indexResponse = UrlFetchApp.fetch(indexUrl, indexOptions);
  if (indexResponse.getResponseCode() !== 200) {
    console.warn('⚠️ インデックスドキュメント保存失敗:', indexResponse.getContentText());
  }

  console.log(`✅ 保存完了: ${savedCount}/${fieldCount} フィールド`);
  if (failedFields.length > 0) {
    console.warn(`⚠️ 保存失敗フィールド (${failedFields.length}件):`, failedFields.join(', '));
  }

  return {
    fieldCount: fieldCount,
    totalItems: totalItems,
    savedCount: savedCount,
    failedCount: failedFields.length
  };
}

/**
 * オブジェクトをFirestoreフィールド形式に変換
 */
function convertToFirestoreFields(obj) {
  const fields = {};
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      fields[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        fields[key] = { integerValue: value };
      } else {
        fields[key] = { doubleValue: value };
      }
    } else if (typeof value === 'boolean') {
      fields[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      fields[key] = {
        arrayValue: {
          values: value.map(v => ({ stringValue: String(v) }))
        }
      };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  });
  return fields;
}

