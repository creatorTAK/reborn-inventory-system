/**
 * ランクデータ移行スクリプト
 * managementRanks → conditionRanks への移行
 *
 * 使用方法:
 * 1. furira.jpの任意のページ（product.html等）を開く
 * 2. ログイン済みの状態でブラウザのコンソールを開く（F12）
 * 3. 以下の関数を貼り付けて実行
 *
 * 注意: 既存のconditionRanksデータがある場合は上書きされます
 */

async function migrateRanksToConditionRanks() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDKが読み込まれていません。');
    console.log('furira.jpのページでログイン後に実行してください。');
    return;
  }

  const db = firebase.firestore();

  console.log('🚀 ランクデータ移行開始...');
  console.log('   移行元: managementRanks');
  console.log('   移行先: conditionRanks');
  console.log('');

  try {
    // 移行元データを取得
    const sourceSnapshot = await db.collection('managementRanks').get();

    if (sourceSnapshot.empty) {
      console.log('⚠️ 移行元（managementRanks）にデータがありません。');
      console.log('   seedConditionRanks() でデフォルトデータを投入してください。');
      return;
    }

    console.log(`📋 移行元データ: ${sourceSnapshot.size}件`);

    // バッチ書き込み
    const batch = db.batch();
    let count = 0;

    sourceSnapshot.forEach(doc => {
      const data = doc.data();
      const destRef = db.collection('conditionRanks').doc(doc.id);

      batch.set(destRef, {
        ...data,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log(`  📝 ${doc.id}: ${data.name || data.code}`);
      count++;
    });

    await batch.commit();

    console.log('');
    console.log(`✅ 移行完了！ ${count}件のデータを移行しました。`);
    console.log('');
    console.log('📌 次のステップ:');
    console.log('   1. マスタ管理画面で「商品マスタ > 説明文生成 > ランク」を確認');
    console.log('   2. 問題なければ、旧データを削除: deleteOldManagementRanks()');

  } catch (error) {
    console.error('❌ 移行エラー:', error);
  }
}

// 旧データ削除（移行確認後に実行）
async function deleteOldManagementRanks() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDKが読み込まれていません。');
    return;
  }

  const db = firebase.firestore();

  console.log('🗑️ 旧ランクデータ削除開始...');
  console.log('   対象: managementRanks');
  console.log('');

  try {
    const snapshot = await db.collection('managementRanks').get();

    if (snapshot.empty) {
      console.log('ℹ️ 削除対象データがありません。');
      return;
    }

    const batch = db.batch();
    let count = 0;

    snapshot.forEach(doc => {
      batch.delete(doc.ref);
      console.log(`  🗑️ ${doc.id}`);
      count++;
    });

    await batch.commit();

    console.log('');
    console.log(`✅ 削除完了！ ${count}件を削除しました。`);

  } catch (error) {
    console.error('❌ 削除エラー:', error);
  }
}

// conditionRanksにデフォルトデータを直接投入（新規の場合）
async function seedConditionRanks() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDKが読み込まれていません。');
    return;
  }

  const db = firebase.firestore();
  const batch = db.batch();

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

  console.log('🚀 conditionRanksにデフォルトデータを投入...');

  for (const rank of DEFAULT_RANKS) {
    const docRef = db.collection('conditionRanks').doc(rank.code);
    batch.set(docRef, {
      ...rank,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    console.log(`  📝 ${rank.code}: ${rank.name}`);
  }

  try {
    await batch.commit();
    console.log('');
    console.log(`✅ 投入完了！ ${DEFAULT_RANKS.length}件`);
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// グローバルに公開
if (typeof window !== 'undefined') {
  window.migrateRanksToConditionRanks = migrateRanksToConditionRanks;
  window.deleteOldManagementRanks = deleteOldManagementRanks;
  window.seedConditionRanks = seedConditionRanks;

  console.log('📋 ランクデータ移行ツール');
  console.log('');
  console.log('利用可能な関数:');
  console.log('  migrateRanksToConditionRanks() - managementRanks → conditionRanks 移行');
  console.log('  deleteOldManagementRanks()     - 旧データ削除（移行確認後）');
  console.log('  seedConditionRanks()           - 新規デフォルトデータ投入');
}
