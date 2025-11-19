/**
 * JSONファイルからAlgoliaにブランドをインポート
 *
 * 実行方法:
 *   node import-brands-from-json.js
 */

import { algoliasearch } from 'algoliasearch';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

// 環境変数読み込み
config();

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;

if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
  console.error('❌ エラー: .envファイルにALGOLIA_APP_IDとALGOLIA_API_KEYを設定してください');
  process.exit(1);
}

// Algoliaクライアント初期化
const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);

/**
 * JSONファイルからブランドデータを読み込み
 */
function loadBrandsFromJson() {
  console.log('📥 brands-data.json からデータを読み込み中...');

  try {
    const jsonData = readFileSync('./brands-data.json', 'utf8');
    const brands = JSON.parse(jsonData);

    console.log(`✅ ${brands.length}件のブランドを読み込みました`);
    return brands;

  } catch (error) {
    console.error('❌ エラー: brands-data.json が見つかりません');
    console.error('   先に export-brands-from-gas.js を実行してブランドデータをダウンロードしてください');
    process.exit(1);
  }
}

/**
 * Algoliaにブランドデータをインポート
 */
async function importBrandsToAlgolia(brands) {
  console.log('📤 Algoliaにデータをインポート中...');

  const indexName = 'brands';

  try {
    // Algolia用のフォーマットに変換
    const algoliaObjects = brands.map(brand => ({
      objectID: brand.id,
      id: brand.id,
      name: brand.nameEn || '',  // nameEn を使用（英語名）
      nameKana: brand.nameKana || '',
      searchText: brand.searchText || '',
      usageCount: brand.usageCount || 0
    }));

    // バッチサイズ1000件ずつアップロード
    const batchSize = 1000;
    const batches = [];

    for (let i = 0; i < algoliaObjects.length; i += batchSize) {
      const batch = algoliaObjects.slice(i, i + batchSize);
      batches.push(batch);
    }

    console.log(`📦 ${batches.length}個のバッチに分割してアップロード...`);

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`   バッチ ${i + 1}/${batches.length}: ${batch.length}件アップロード中...`);

      await client.saveObjects({
        indexName: indexName,
        objects: batch
      });

      console.log(`   ✅ バッチ ${i + 1}/${batches.length} 完了`);
    }

    console.log(`✅ 全${algoliaObjects.length}件のインポートが完了しました！`);

    // インデックス設定を構成
    console.log('⚙️  インデックス設定を構成中...');

    await client.setSettings({
      indexName: indexName,
      indexSettings: {
        // 検索対象の属性（優先度順）
        searchableAttributes: [
          'name',
          'nameKana'
        ],
        // 検索結果の属性
        attributesToRetrieve: [
          'objectID',
          'id',
          'name',
          'nameKana',
          'usageCount'
        ],
        // ランキング（人気順優先）
        customRanking: [
          'desc(usageCount)'
        ],
        // タイポ許容を無効化（NIKE→Nigelなどの誤マッチを防ぐ）
        typoTolerance: false,
        // 前方一致優先
        queryType: 'prefixAll',
        // ハイライト設定
        highlightPreTag: '<mark>',
        highlightPostTag: '</mark>',
        attributesToHighlight: ['name', 'nameKana']
      }
    });

    console.log('✅ インデックス設定完了');

  } catch (error) {
    console.error('❌ Algoliaインポートエラー:', error);
    throw error;
  }
}

/**
 * メイン処理
 */
async function main() {
  console.log('🚀 REBORN Inventory - Algoliaブランドインポート開始\n');

  const startTime = Date.now();

  try {
    // 1. JSONファイルからデータ読み込み
    const brands = loadBrandsFromJson();

    if (brands.length === 0) {
      console.log('⚠️  インポートするブランドがありません');
      return;
    }

    // 2. Algoliaにインポート
    await importBrandsToAlgolia(brands);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ すべて完了しました！（所要時間: ${duration}秒）`);
    console.log('\n📝 次のステップ: PWA側のAlgolia検索UIを実装します');

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// 実行
main();
