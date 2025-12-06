/**
 * 仕入先・出品先の初期データをFirestoreに投入するスクリプト
 *
 * 使用方法:
 * 1. ブラウザでPWAを開く（furira.jp または reborn-tak45.pages.dev）
 * 2. デベロッパーツール（F12）を開く
 * 3. コンソールタブで以下のコードを貼り付けて実行
 */

// ====== ここからコピーしてブラウザコンソールに貼り付け ======

(async function initMasterData() {
  console.log('🚀 仕入先・出品先の初期データ投入を開始...');

  // Firestoreの確認
  if (!window.db) {
    console.error('❌ Firestoreが初期化されていません。PWAページで実行してください。');
    return;
  }

  // 仕入先データ
  const suppliers = [
    { name: 'セカンドストリート', contact: '', email: '', phone: '' },
    { name: 'ハードオフ', contact: '', email: '', phone: '' },
    { name: 'ブックオフ', contact: '', email: '', phone: '' },
    { name: 'トレジャーファクトリー', contact: '', email: '', phone: '' },
    { name: 'キングファミリー', contact: '', email: '', phone: '' },
    { name: 'オフハウス', contact: '', email: '', phone: '' },
    { name: 'ドンドンダウン', contact: '', email: '', phone: '' },
    { name: '個人仕入れ', contact: '', email: '', phone: '' },
    { name: 'ネット仕入れ', contact: '', email: '', phone: '' },
    { name: 'その他', contact: '', email: '', phone: '' }
  ];

  // 出品先データ
  const salesChannels = [
    { name: 'メルカリ', commission: 10, url: 'https://mercari.com' },
    { name: 'メルカリShops', commission: 10, url: 'https://mercari-shops.com' },
    { name: 'ヤフオク', commission: 10, url: 'https://auctions.yahoo.co.jp' },
    { name: 'ヤフーフリマ', commission: 5, url: 'https://paypayfleamarket.yahoo.co.jp' },
    { name: 'ラクマ', commission: 6, url: 'https://fril.jp' },
    { name: 'BASE', commission: 3, url: 'https://thebase.in' },
    { name: 'minne', commission: 10.56, url: 'https://minne.com' },
    { name: 'Creema', commission: 11, url: 'https://www.creema.jp' }
  ];

  const batch = window.db.batch();
  let supplierCount = 0;
  let salesChannelCount = 0;

  // 仕入先を追加
  console.log('📦 仕入先データを追加中...');
  for (const supplier of suppliers) {
    const docRef = window.db.collection('suppliers').doc();
    batch.set(docRef, {
      ...supplier,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    supplierCount++;
  }

  // 出品先を追加
  console.log('📦 出品先データを追加中...');
  for (const channel of salesChannels) {
    const docRef = window.db.collection('salesChannels').doc();
    batch.set(docRef, {
      ...channel,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    salesChannelCount++;
  }

  // バッチコミット
  try {
    await batch.commit();
    console.log(`✅ 初期データ投入完了!`);
    console.log(`   - 仕入先: ${supplierCount}件`);
    console.log(`   - 出品先: ${salesChannelCount}件`);
    console.log('');
    console.log('🔄 ページをリロードして設定画面を確認してください。');
  } catch (error) {
    console.error('❌ データ投入エラー:', error);
  }
})();

// ====== ここまでコピー ======
