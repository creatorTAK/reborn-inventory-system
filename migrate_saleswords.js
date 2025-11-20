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

function migrateSalesWordsToFirestore() {
  try {
    console.log('=== セールスワードマスタFirestore移行開始 ===');

    // 1. スプレッドシートからデータ取得
    const salesWordData = getSalesWordData();

    if (!salesWordData || !salesWordData.categories || salesWordData.categories.length === 0) {
      console.error('❌ セールスワードデータが取得できませんでした');
      return;
    }

    console.log('✅ スプレッドシートからデータ取得成功');
    console.log('カテゴリ数:', salesWordData.categories.length);
    console.log('カテゴリ一覧:', salesWordData.categories);

    // 2. Firestoreにデータを保存
    const firestore = getFirestore();
    let successCount = 0;
    let errorCount = 0;

    salesWordData.categories.forEach((category, index) => {
      try {
        const words = salesWordData.wordsByCategory[category] || [];

        const docData = {
          category: category,
          words: words,
          order: index + 1,
          updatedAt: new Date().toISOString()
        };

        // Firestoreに保存（カテゴリ名をドキュメントIDとして使用）
        const docId = category; // 例: "価格・セール"
        firestore.collection('saleswords').doc(docId).set(docData);

        console.log(`✅ [${index + 1}/${salesWordData.categories.length}] ${category}: ${words.length}件のワード`);
        successCount++;

      } catch (error) {
        console.error(`❌ ${category} の保存エラー:`, error);
        errorCount++;
      }
    });

    console.log('=== 移行完了 ===');
    console.log('成功:', successCount, '件');
    console.log('失敗:', errorCount, '件');

    // 3. 移行結果をスプレッドシートに記録
    recordMigrationResult('saleswords', successCount, errorCount);

  } catch (error) {
    console.error('❌ 移行処理エラー:', error);
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

    console.log('✅ 移行ログ記録完了');

  } catch (error) {
    console.error('❌ 移行ログ記録エラー:', error);
  }
}

/**
 * Firestoreから読み込みテスト
 */
function testReadSalesWordsFromFirestore() {
  try {
    console.log('=== Firestore読み込みテスト開始 ===');

    const firestore = getFirestore();
    const docs = firestore.collection('saleswords').orderBy('order').get();

    console.log('取得件数:', docs.length);

    const result = {
      categories: [],
      wordsByCategory: {},
      allWords: []
    };

    docs.forEach(doc => {
      const data = doc.data();
      result.categories.push(data.category);
      result.wordsByCategory[data.category] = data.words;
      result.allWords = result.allWords.concat(data.words);
    });

    console.log('カテゴリ一覧:', result.categories);
    console.log('全ワード数:', result.allWords.length);

    console.log('=== テスト完了 ===');
    return result;

  } catch (error) {
    console.error('❌ 読み込みテストエラー:', error);
  }
}
