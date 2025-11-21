/**
 * セールスワードマスタをスプレッドシートからFirestoreに移行
 *
 * 実行方法:
 * 1. GASエディタでこのファイルを開く
 * 2. migrateSalesWordsToFirestore() を実行
 * 3. 初回実行時は権限承認が必要
 *
 * Firestore構造:
 * Collection: saleswords
 * - Document: {カテゴリ名}
 *   - category: カテゴリ名
 *   - words: [ワード配列]
 *   - order: 表示順序
 */

// Firestore REST API設定
const SALESWORDS_FIRESTORE_PROJECT_ID = 'reborn-chat';
const SALESWORDS_FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${SALESWORDS_FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

function migrateSalesWordsToFirestore() {
  try {
    Logger.log('=== セールスワードマスタFirestore移行開始 ===');

    // 1. スプレッドシートからデータ取得
    const salesWordData = getSalesWordData();

    if (!salesWordData || !salesWordData.categories || salesWordData.categories.length === 0) {
      Logger.log('❌ セールスワードデータが取得できませんでした');
      return;
    }

    Logger.log('✅ スプレッドシートからデータ取得成功');
    Logger.log('カテゴリ数: ' + salesWordData.categories.length);
    Logger.log('カテゴリ一覧: ' + salesWordData.categories.join(', '));

    // 2. Firestoreにデータを保存（REST API使用）
    const accessToken = ScriptApp.getOAuthToken();
    let successCount = 0;
    let errorCount = 0;

    salesWordData.categories.forEach((category, index) => {
      try {
        const words = salesWordData.wordsByCategory[category] || [];

        // Firestore REST API用のデータ構造
        const firestoreDoc = {
          fields: {
            category: { stringValue: category },
            words: {
              arrayValue: {
                values: words.map(word => ({ stringValue: word }))
              }
            },
            order: { integerValue: index + 1 },
            updatedAt: { stringValue: new Date().toISOString() }
          }
        };

        // ドキュメントIDはカテゴリ名（URLエンコード）
        const docId = encodeURIComponent(category);
        const url = `${SALESWORDS_FIRESTORE_BASE_URL}/saleswords/${docId}`;

        const options = {
          method: 'patch',
          contentType: 'application/json',
          headers: {
            'Authorization': 'Bearer ' + accessToken
          },
          payload: JSON.stringify(firestoreDoc),
          muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch(url, options);
        const statusCode = response.getResponseCode();

        if (statusCode === 200) {
          Logger.log(`✅ [${index + 1}/${salesWordData.categories.length}] ${category}: ${words.length}件のワード`);
          successCount++;
        } else {
          Logger.log(`❌ [${index + 1}/${salesWordData.categories.length}] ${category} 保存失敗 (HTTP ${statusCode})`);
          Logger.log(response.getContentText());
          errorCount++;
        }

      } catch (error) {
        Logger.log(`❌ ${category} の保存エラー: ${error}`);
        errorCount++;
      }
    });

    Logger.log('=== 移行完了 ===');
    Logger.log('成功: ' + successCount + '件');
    Logger.log('失敗: ' + errorCount + '件');

    // 3. 移行結果をスプレッドシートに記録
    recordMigrationResult('saleswords', successCount, errorCount);

  } catch (error) {
    Logger.log('❌ 移行処理エラー: ' + error);
  }
}

/**
 * 移行結果を記録
 */
function recordMigrationResult(collectionName, successCount, errorCount) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let logSheet = ss.getSheetByName('移行ログ');

    if (!logSheet) {
      logSheet = ss.insertSheet('移行ログ');
      logSheet.appendRow(['日時', 'コレクション', '成功', '失敗', '備考']);
    }

    logSheet.appendRow([
      new Date().toLocaleString('ja-JP'),
      collectionName,
      successCount,
      errorCount,
      errorCount === 0 ? '正常終了' : 'エラーあり'
    ]);

    Logger.log('✅ 移行ログ記録完了');

  } catch (error) {
    Logger.log('❌ 移行ログ記録エラー: ' + error);
  }
}

/**
 * Firestoreから読み込みテスト（REST API使用）
 */
function testReadSalesWordsFromFirestore() {
  try {
    Logger.log('=== Firestore読み込みテスト開始 ===');

    const accessToken = ScriptApp.getOAuthToken();
    const url = `${SALESWORDS_FIRESTORE_BASE_URL}/saleswords?orderBy=order`;

    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + accessToken
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();

    if (statusCode !== 200) {
      Logger.log('❌ Firestore読み込み失敗 (HTTP ' + statusCode + ')');
      Logger.log(response.getContentText());
      return;
    }

    const data = JSON.parse(response.getContentText());
    const documents = data.documents || [];

    Logger.log('取得件数: ' + documents.length);

    const result = {
      categories: [],
      wordsByCategory: {},
      allWords: []
    };

    documents.forEach(doc => {
      const fields = doc.fields;
      const category = fields.category.stringValue;
      const words = (fields.words.arrayValue.values || []).map(v => v.stringValue);

      result.categories.push(category);
      result.wordsByCategory[category] = words;
      result.allWords = result.allWords.concat(words);
    });

    Logger.log('カテゴリ一覧: ' + result.categories.join(', '));
    Logger.log('全ワード数: ' + result.allWords.length);

    Logger.log('=== テスト完了 ===');
    return result;

  } catch (error) {
    Logger.log('❌ 読み込みテストエラー: ' + error);
  }
}
