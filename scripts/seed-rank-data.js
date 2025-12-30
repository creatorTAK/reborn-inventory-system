/**
 * 管理番号ランク マスタデータ投入スクリプト
 *
 * 使用方法:
 * 1. Firebaseコンソールにログイン
 * 2. このスクリプトをブラウザのコンソールで実行
 *
 * または、Node.jsで実行:
 * node scripts/seed-rank-data.js
 */

// デフォルトのランク定義（商品状態ランク）
const DEFAULT_RANKS = [
  {
    code: 'S',
    name: '新品同様',
    description: 'タグ付き未使用、または未使用に近い状態。目立つ使用感なし。',
    sortOrder: 1
  },
  {
    code: 'A',
    name: '非常に良い',
    description: '微細な使用感のみ。目立つダメージなし。',
    sortOrder: 2
  },
  {
    code: 'B',
    name: '良い',
    description: '軽い使用感あり。小さな傷や汚れがある程度。',
    sortOrder: 3
  },
  {
    code: 'C',
    name: 'やや難あり',
    description: '傷・汚れ・色褪せなど使用感がある。',
    sortOrder: 4
  },
  {
    code: 'D',
    name: '難あり',
    description: '明確なダメージあり。訳あり品。',
    sortOrder: 5
  }
];

// ブラウザ環境用（Firebaseが既にロードされている前提）
async function seedRankData() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDKが読み込まれていません。');
    console.log('Firebaseコンソールまたはアプリのコンソールで実行してください。');
    return;
  }

  const db = firebase.firestore();
  const batch = db.batch();

  console.log('🚀 ランクマスタデータ投入開始...');

  for (const rank of DEFAULT_RANKS) {
    const docRef = db.collection('managementRanks').doc(rank.code);
    batch.set(docRef, {
      ...rank,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log(`  📝 ${rank.code}: ${rank.name}`);
  }

  try {
    await batch.commit();
    console.log('✅ ランクマスタデータ投入完了！');
    console.log(`   合計 ${DEFAULT_RANKS.length} 件`);
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// Node.js環境用（Firebase Admin SDK）
async function seedRankDataNode() {
  const admin = require('firebase-admin');

  // サービスアカウントキーが必要
  // const serviceAccount = require('./serviceAccountKey.json');
  // admin.initializeApp({
  //   credential: admin.credential.cert(serviceAccount)
  // });

  console.log('Node.js環境での実行はサービスアカウントキーが必要です。');
  console.log('ブラウザのコンソールで seedRankData() を実行してください。');
}

// グローバルに公開（ブラウザ用）
if (typeof window !== 'undefined') {
  window.seedRankData = seedRankData;
  console.log('💡 seedRankData() でランクマスタを投入できます。');
}

// Node.js環境では直接実行
if (typeof module !== 'undefined' && require.main === module) {
  seedRankDataNode();
}
