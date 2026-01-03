/**
 * カテゴリコード初期データ登録スクリプト
 *
 * 使用方法:
 * 1. furira.jpの任意のページを開く
 * 2. ログイン済みの状態でブラウザのコンソールを開く（F12）
 * 3. このスクリプトを貼り付けて実行
 */

async function seedCategoryCodes() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDKが読み込まれていません。');
    console.log('furira.jpのページでログイン後に実行してください。');
    return;
  }

  const db = firebase.firestore();

  // カテゴリコード初期データ
  const categoryCodes = [
    { code: 'TS', name: 'Tシャツ' },
    { code: 'JK', name: 'ジャケット' },
    { code: 'PT', name: 'パンツ' },
    { code: 'SK', name: 'スカート' },
    { code: 'OP', name: 'ワンピース' },
    { code: 'BG', name: 'バッグ' },
    { code: 'SH', name: 'シューズ' },
    { code: 'AC', name: 'アクセサリー' },
    { code: 'OT', name: 'アウター' },
    { code: 'KN', name: 'ニット' }
  ];

  console.log('🚀 カテゴリコード初期データ登録開始...\n');

  const batch = db.batch();
  const collection = db.collection('categoryCodes');

  for (const item of categoryCodes) {
    // ドキュメントIDをコードにする（重複防止）
    const docRef = collection.doc(item.code);
    batch.set(docRef, {
      code: item.code,
      name: item.name,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }); // 既存データがあればマージ

    console.log(`  ✅ ${item.code}: ${item.name}`);
  }

  try {
    await batch.commit();
    console.log(`\n✅ ${categoryCodes.length}件のカテゴリコードを登録しました`);
    console.log('\n🎉 完了！ページをリロードして確認してください。');
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// 実行
seedCategoryCodes();
