/**
 * GAS経由でブランドデータを全件エクスポート
 *
 * 実行方法:
 *   node export-brands-from-gas.js
 */

import { writeFileSync } from 'fs';

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA/exec';

/**
 * GAS APIから指定範囲のブランドを取得
 */
async function fetchBrandsBatch(offset, limit) {
  const url = `${GAS_API_URL}?action=getBrands&offset=${offset}&limit=${limit}`;

  console.log(`📥 ブランド取得中: offset=${offset}, limit=${limit}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return await response.json();
}

/**
 * 全ブランドデータを取得
 */
async function fetchAllBrands() {
  console.log('🚀 GAS経由でブランドデータを全件取得開始\n');

  const BATCH_SIZE = 10000; // 1回のリクエストで取得する件数
  let allBrands = [];
  let offset = 0;
  let total = 0;

  try {
    // 最初のリクエストで総件数を取得
    const firstBatch = await fetchBrandsBatch(0, BATCH_SIZE);

    if (firstBatch.success === false) {
      throw new Error(firstBatch.error || 'GAS APIエラー');
    }

    total = firstBatch.total;
    allBrands = firstBatch.brands;

    console.log(`✅ バッチ1/${Math.ceil(total / BATCH_SIZE)}: ${firstBatch.brands.length}件取得（全${total}件中）\n`);

    // 残りのデータを取得
    offset = BATCH_SIZE;
    let batchNumber = 2;

    while (offset < total) {
      const batch = await fetchBrandsBatch(offset, BATCH_SIZE);

      if (batch.success === false) {
        throw new Error(batch.error || 'GAS APIエラー');
      }

      allBrands = allBrands.concat(batch.brands);

      console.log(`✅ バッチ${batchNumber}/${Math.ceil(total / BATCH_SIZE)}: ${batch.brands.length}件取得（累計: ${allBrands.length}件）\n`);

      offset += BATCH_SIZE;
      batchNumber++;

      // APIレート制限対策で少し待機
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log(`\n✅ 全${allBrands.length}件のブランドデータ取得完了\n`);

    return allBrands;

  } catch (error) {
    console.error('❌ エラー:', error);
    throw error;
  }
}

/**
 * メイン処理
 */
async function main() {
  try {
    const brands = await fetchAllBrands();

    // JSONファイルに保存
    console.log('💾 brands-data.json に保存中...');
    writeFileSync('./brands-data.json', JSON.stringify(brands, null, 0));
    console.log('✅ brands-data.json に保存完了\n');

    console.log(`📊 統計:`);
    console.log(`   総件数: ${brands.length}件`);
    console.log(`   ファイルサイズ: ${(JSON.stringify(brands).length / 1024 / 1024).toFixed(2)}MB\n`);

    console.log('📌 次のステップ: import-brands-from-json.js を実行してAlgoliaにインポートしてください');

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
