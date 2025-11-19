/**
 * Firestore Admin SDKから直接ブランドデータを全件エクスポート
 *
 * 実行方法:
 *   node export-brands-from-firestore.js
 */

import admin from 'firebase-admin';
import { writeFileSync } from 'fs';
import { config } from 'dotenv';

// 環境変数読み込み
config();

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'reborn-chat';

// Firebase Admin SDK初期化（Application Default Credentials使用）
try {
  admin.initializeApp({
    projectId: FIREBASE_PROJECT_ID
  });
  console.log('✅ Firebase Admin SDK初期化成功');
} catch (error) {
  console.error('❌ Firebase Admin SDK初期化エラー:', error);
  process.exit(1);
}

const db = admin.firestore();

/**
 * Firestoreから全ブランドを取得
 */
async function fetchAllBrandsFromFirestore() {
  console.log('🚀 Firestoreから全ブランドデータを取得開始\n');

  const startTime = Date.now();

  try {
    const brandsRef = db.collection('brands');
    const snapshot = await brandsRef.get();

    console.log(`✅ Firestoreから${snapshot.size}件のブランドを取得しました\n`);

    const brands = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      brands.push({
        id: doc.id,
        nameEn: data.nameEn || '',
        nameKana: data.nameKana || '',
        searchText: data.searchText || '',
        usageCount: data.usageCount || 0
      });
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`✅ データ変換完了: ${brands.length}件（${duration}秒）\n`);

    return brands;

  } catch (error) {
    console.error('❌ Firestore取得エラー:', error);
    throw error;
  }
}

/**
 * メイン処理
 */
async function main() {
  try {
    const brands = await fetchAllBrandsFromFirestore();

    // JSONファイルに保存
    console.log('💾 brands-data.json に保存中...');
    writeFileSync('./brands-data.json', JSON.stringify(brands, null, 0));
    console.log('✅ brands-data.json に保存完了\n');

    console.log(`📊 統計:`);
    console.log(`   総件数: ${brands.length}件`);
    console.log(`   ファイルサイズ: ${(JSON.stringify(brands).length / 1024 / 1024).toFixed(2)}MB\n`);

    console.log('📌 次のステップ: import-brands-from-json.js を実行してAlgoliaにインポートしてください');

    process.exit(0);

  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error);
    process.exit(1);
  }
}

main();
