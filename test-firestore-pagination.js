/**
 * Firestore REST APIのページネーションをテスト
 *
 * 実行方法:
 *   node test-firestore-pagination.js
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA/exec';

/**
 * GAS APIから全ブランドを取得してページネーション情報を確認
 */
async function testPagination() {
  console.log('🔍 Firestoreページネーションテスト開始\n');

  const BATCH_SIZE = 10000;
  let offset = 0;
  let pageNumber = 1;

  try {
    while (true) {
      const url = `${GAS_API_URL}?action=getBrands&offset=${offset}&limit=${BATCH_SIZE}`;

      console.log(`📥 ページ${pageNumber}: offset=${offset}, limit=${BATCH_SIZE}`);

      const response = await fetch(url);

      if (!response.ok) {
        console.error(`❌ HTTP ${response.status}: ${response.statusText}`);
        break;
      }

      const data = await response.json();

      if (data.success === false) {
        console.error(`❌ API エラー: ${data.error}`);
        break;
      }

      console.log(`✅ ページ${pageNumber}: ${data.brands.length}件取得（全${data.total}件中、累計: ${offset + data.brands.length}件）`);
      console.log(`   offset=${data.offset}, limit=${data.limit}, total=${data.total}\n`);

      // データが取得できなくなったら終了
      if (data.brands.length === 0) {
        console.log('⚠️ データが0件になったため終了');
        break;
      }

      // 全件取得完了チェック
      if (offset + data.brands.length >= data.total) {
        console.log(`✅ 全件取得完了: ${data.total}件`);
        break;
      }

      offset += BATCH_SIZE;
      pageNumber++;

      // 安全装置: 10ページ以上は取得しない
      if (pageNumber > 10) {
        console.log('⚠️ 10ページ以上取得したため終了');
        break;
      }

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('\n📊 テスト完了');

  } catch (error) {
    console.error('\n❌ エラー:', error);
  }
}

testPagination();
