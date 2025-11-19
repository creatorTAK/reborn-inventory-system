/**
 * REBORN在庫管理システム - Firestoreマイグレーションスクリプト（商品・在庫データ）
 *
 * 在庫管理シートから商品データを読み取り、
 * Firestore (reborn-chat) の products コレクションに移行します。
 *
 * @related-issue ARCH-001 Phase 3
 * @created 2025-11-11
 */

// ============================================
// 設定
// ============================================

const MIGRATION_FIRESTORE_PROJECT_ID = 'reborn-chat';
const MIGRATION_FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${MIGRATION_FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

// 在庫管理シートの開始行（ヘッダー行の次、2行目）
const MIGRATION_INVENTORY_START_ROW = 2;

// ============================================
// メイン処理
// ============================================

/**
 * 商品・在庫データをFirestoreに移行
 *
 * 実行方法:
 * 1. GASエディタでこのファイルを開く
 * 2. migrateProductsToFirestore関数を選択
 * 3. 実行ボタンをクリック
 * 4. 初回実行時は権限承認が必要
 */
function migrateProductsToFirestore() {
  Logger.log('===== 商品・在庫データ移行開始 =====');
  Logger.log('時刻: ' + new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));

  try {
    // スプレッドシート取得（共通関数を使用）
    const sheet = getSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow < MIGRATION_INVENTORY_START_ROW) {
      Logger.log('❌ エラー: データが存在しません');
      return;
    }

    Logger.log('✅ シート読み取り成功: ' + (lastRow - MIGRATION_INVENTORY_START_ROW + 1) + '行');

    // ヘッダーマップを取得（共通関数を使用）
    const { map } = getHeaderMapCommon();

    Logger.log('✅ カラムマッピング完了');

    // バッチ処理用の配列
    const products = [];
    let successCount = 0;
    let errorCount = 0;

    // データ読み込み（一括取得でパフォーマンス改善）
    const dataRange = sheet.getRange(MIGRATION_INVENTORY_START_ROW, 1, lastRow - MIGRATION_INVENTORY_START_ROW + 1, sheet.getLastColumn());
    const data = dataRange.getValues();

    Logger.log('📊 データ取得完了: ' + data.length + '行');

    // すべての必要なカラム位置を事前取得（パフォーマンス最適化）
    const colCache = {
      managementNumber: colByName(sheet, '管理番号'),
      status: colByName(sheet, 'ステータス'),
      brand: colByName(sheet, 'ブランド(英語)'),
      category: colByName(sheet, '大分類(カテゴリ)') || colByName(sheet, '大分類'),
      itemName: colByName(sheet, 'アイテム名'),
      person: colByName(sheet, '担当者'),
      size: colByName(sheet, 'サイズ'),
      color: colByName(sheet, 'カラー/配色/トーン') || colByName(sheet, 'カラー(選択)'),
      productName: colByName(sheet, '商品名(タイトル)') || colByName(sheet, '商品名'),
      purchaseDate: colByName(sheet, '仕入日'),
      purchaseAmount: colByName(sheet, '仕入金額'),
      listingDate: colByName(sheet, '出品日'),
      listingAmount: colByName(sheet, '出品金額'),
      saleDate: colByName(sheet, '販売日'),
      saleAmount: colByName(sheet, '販売金額'),
      profit: colByName(sheet, '利益金額'),
      profitRate: colByName(sheet, '利益率'),
      inventoryDays: colByName(sheet, '在庫日数'),
      registrant: colByName(sheet, '登録者'),
      registeredAt: colByName(sheet, '登録日時'),
      lastEditor: colByName(sheet, '最終更新者'),
      updatedAt: colByName(sheet, '更新日時'),
      imageUrl1: colByName(sheet, '画像URL1')
    };

    if (!colCache.managementNumber) {
      Logger.log('❌ エラー: 管理番号列が見つかりません');
      return;
    }
    Logger.log('✅ カラムキャッシュ作成完了');

    // 各行を処理
    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      const managementNumber = row[colCache.managementNumber - 1]; // 0-basedに変換
      if (!managementNumber || managementNumber === '') {
        continue;
      }

      // 値を取得するヘルパー関数
      const getValue = (cacheKey) => {
        const col = colCache[cacheKey];
        return col ? row[col - 1] : '';
      };

      // 商品データを構築
      const productData = {
        managementNumber: String(managementNumber || ''),
        status: String(getValue('status') || ''),
        brand: String(getValue('brand') || ''),
        category: String(getValue('category') || ''),
        itemName: String(getValue('itemName') || ''),
        person: String(getValue('person') || ''),
        size: String(getValue('size') || ''),
        color: String(getValue('color') || ''),
        productName: String(getValue('productName') || ''),
        purchaseDate: getValue('purchaseDate') ? formatDateForFirestore(getValue('purchaseDate')) : '',
        purchaseAmount: parseFloat(getValue('purchaseAmount')) || 0,
        listingDate: getValue('listingDate') ? formatDateForFirestore(getValue('listingDate')) : '',
        listingAmount: parseFloat(getValue('listingAmount')) || 0,
        saleDate: getValue('saleDate') ? formatDateForFirestore(getValue('saleDate')) : '',
        saleAmount: parseFloat(getValue('saleAmount')) || 0,
        profit: parseFloat(getValue('profit')) || 0,
        profitRate: String(getValue('profitRate') || ''),
        inventoryDays: parseInt(getValue('inventoryDays')) || 0,
        registrant: String(getValue('registrant') || ''),
        registeredAt: getValue('registeredAt') ? formatDateForFirestore(getValue('registeredAt')) : '',
        lastEditor: String(getValue('lastEditor') || ''),
        updatedAt: getValue('updatedAt') ? formatDateForFirestore(getValue('updatedAt')) : '',
        imageUrl1: String(getValue('imageUrl1') || ''),
        // 検索用フィールド
        searchText: [
          managementNumber,
          getValue('productName'),
          getValue('brand'),
          getValue('category')
        ].filter(v => v).join(' ').toLowerCase()
      };

      products.push(productData);

      // 100件ごとにバッチ書き込み（Firestore APIの制限対策）
      if (products.length >= 100) {
        const batchResult = writeBatchToFirestore(products);
        successCount += batchResult.success;
        errorCount += batchResult.error;
        products.length = 0; // 配列をクリア
        Utilities.sleep(500); // レート制限対策
      }
    }

    // 残りのデータを書き込み
    if (products.length > 0) {
      const batchResult = writeBatchToFirestore(products);
      successCount += batchResult.success;
      errorCount += batchResult.error;
    }

    Logger.log('===== 移行完了 =====');
    Logger.log('✅ 成功: ' + successCount + '件');
    Logger.log('❌ 失敗: ' + errorCount + '件');
    Logger.log('📊 合計: ' + (successCount + errorCount) + '件');

  } catch (error) {
    Logger.log('❌ エラー: ' + error.message);
    Logger.log(error.stack);
  }
}

// ============================================
// ヘルパー関数
// ============================================

/**
 * 日付をFirestore用の文字列に変換
 */
function formatDateForFirestore(date) {
  if (!date) return '';
  if (typeof date === 'string') return date;
  if (date instanceof Date) {
    return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
  }
  return String(date);
}

/**
 * バッチデータをFirestoreに書き込み
 */
function writeBatchToFirestore(products) {
  let successCount = 0;
  let errorCount = 0;

  for (const product of products) {
    try {
      // ドキュメントIDは管理番号を使用（特殊文字を置換）
      const docId = product.managementNumber.replace(/[\/\.\$\#\[\]]/g, '_');
      const url = `${MIGRATION_FIRESTORE_BASE_URL}/products/${docId}`;

      // Firestoreのデータ構造に変換
      const firestoreDoc = {
        fields: {}
      };

      // 各フィールドをFirestore形式に変換
      for (const [key, value] of Object.entries(product)) {
        if (typeof value === 'string') {
          firestoreDoc.fields[key] = { stringValue: value };
        } else if (typeof value === 'number') {
          firestoreDoc.fields[key] = { doubleValue: value };
        } else if (typeof value === 'boolean') {
          firestoreDoc.fields[key] = { booleanValue: value };
        }
      }

      // Firestore REST APIで書き込み
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
      const statusCode = response.getResponseCode();

      if (statusCode === 200) {
        successCount++;
        if (successCount % 50 === 0) {
          Logger.log('進捗: ' + successCount + '件完了');
        }
      } else {
        errorCount++;
        Logger.log('❌ 書き込み失敗 (' + product.managementNumber + '): ' + statusCode);
        Logger.log('Response: ' + response.getContentText());
      }

    } catch (error) {
      errorCount++;
      Logger.log('❌ エラー (' + product.managementNumber + '): ' + error.message);
    }
  }

  return { success: successCount, error: errorCount };
}

/**
 * Firestoreの全productsドキュメントを削除（テスト用）
 *
 * 注意: 本番環境では慎重に使用すること
 */
function deleteAllProductsFromFirestore() {
  Logger.log('===== Firestoreデータ削除開始 =====');

  try {
    const url = `${MIGRATION_FIRESTORE_BASE_URL}/products`;
    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());

    if (!data.documents) {
      Logger.log('削除するドキュメントがありません');
      return;
    }

    Logger.log('削除対象: ' + data.documents.length + '件');

    let deleteCount = 0;
    for (const doc of data.documents) {
      const docPath = doc.name;
      const deleteOptions = {
        method: 'delete',
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
        },
        muteHttpExceptions: true
      };

      UrlFetchApp.fetch(`https://firestore.googleapis.com/v1/${docPath}`, deleteOptions);
      deleteCount++;

      if (deleteCount % 50 === 0) {
        Logger.log('削除進捗: ' + deleteCount + '件');
        Utilities.sleep(500);
      }
    }

    Logger.log('✅ 削除完了: ' + deleteCount + '件');

  } catch (error) {
    Logger.log('❌ エラー: ' + error.message);
    Logger.log(error.stack);
  }
}
