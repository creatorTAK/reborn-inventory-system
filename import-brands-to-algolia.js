/**
 * REBORN在庫管理システム - Algoliaブランドインポート
 *
 * Firestoreから全ブランドデータを取得してAlgoliaにインポート
 *
 * 実行方法:
 *   node import-brands-to-algolia.js
 *
 * @created 2025-11-19
 */

import { algoliasearch } from 'algoliasearch';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

// 環境変数読み込み
config();

const ALGOLIA_APP_ID = process.env.ALGOLIA_APP_ID;
const ALGOLIA_API_KEY = process.env.ALGOLIA_API_KEY;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

if (!ALGOLIA_APP_ID || !ALGOLIA_API_KEY) {
  console.error('❌ エラー: .envファイルにALGOLIA_APP_IDとALGOLIA_API_KEYを設定してください');
  process.exit(1);
}

// Firebase Admin初期化
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync('./firebase-service-account.json', 'utf8'));
} catch (error) {
  console.error('❌ エラー: firebase-service-account.jsonが見つかりません');
  console.error('   Firebase Console → Project Settings → Service Accounts → Generate New Private Key');
  process.exit(1);
}

initializeApp({
  credential: cert(serviceAccount),
  projectId: FIREBASE_PROJECT_ID
});

const db = getFirestore();

// Algoliaクライアント初期化
const client = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY);

/**
 * Firestoreから全ブランドデータを取得
 */
async function fetchAllBrandsFromFirestore() {
  console.log('📥 Firestoreからブランドデータを取得中...');

  const brandsRef = db.collection('brands');
  const snapshot = await brandsRef.get();

  const brands = [];
  snapshot.forEach(doc => {
    const data = doc.data();
    brands.push({
      objectID: doc.id, // AlgoliaのobjectIDとしてFirestoreのドキュメントIDを使用
      id: doc.id,
      name: data.name || '',
      nameKana: data.nameKana || '',
      searchText: data.searchText || '',
      usageCount: data.usageCount || 0,
      createdAt: data.createdAt ? data.createdAt.toMillis() : Date.now(),
      updatedAt: data.updatedAt ? data.updatedAt.toMillis() : Date.now()
    });
  });

  console.log(`✅ ${brands.length}件のブランドを取得しました`);
  return brands;
}

/**
 * Algoliaにブランドデータをインポート
 */
async function importBrandsToAlgolia(brands) {
  console.log('📤 Algoliaにデータをインポート中...');

  const indexName = 'brands';

  try {
    // バッチサイズ1000件ずつアップロード（Algolia推奨）
    const batchSize = 1000;
    const batches = [];

    for (let i = 0; i < brands.length; i += batchSize) {
      const batch = brands.slice(i, i + batchSize);
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

    console.log(`✅ 全${brands.length}件のインポートが完了しました！`);

    // インデックス設定を構成
    console.log('⚙️  インデックス設定を構成中...');

    await client.setSettings({
      indexName: indexName,
      indexSettings: {
        // 検索対象の属性（優先度順）
        searchableAttributes: [
          'name',
          'nameKana',
          'searchText'
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
        // タイポ許容
        typoTolerance: true,
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
    // 1. Firestoreからデータ取得
    const brands = await fetchAllBrandsFromFirestore();

    if (brands.length === 0) {
      console.log('⚠️  インポートするブランドがありません');
      return;
    }

    // 2. Algoliaにインポート
    await importBrandsToAlgolia(brands);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ すべて完了しました！（所要時間: ${duration}秒）`);

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

// 実行
main();
