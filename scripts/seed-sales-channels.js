/**
 * 出品先マスタ初期データ登録スクリプト
 *
 * 使用方法:
 * 1. furira.jpの任意のページを開く
 * 2. ログイン済みの状態でブラウザのコンソールを開く（F12）
 * 3. このスクリプトを貼り付けて実行
 */

async function seedSalesChannels() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDKが読み込まれていません。');
    console.log('furira.jpのページでログイン後に実行してください。');
    return;
  }

  const db = firebase.firestore();

  // 出品先マスタ初期データ（既存プラットフォーム画像を使用）
  const salesChannels = [
    {
      platformId: 'mercari',
      name: 'メルカリ',
      iconUrl: 'images/platform/mercari.png',
      commission: 10,
      order: 1,
      active: true
    },
    {
      platformId: 'mercari-shops',
      name: 'メルカリShops',
      iconUrl: 'images/platform/mercari-shops.png',
      commission: 10,
      order: 2,
      active: true
    },
    {
      platformId: 'yahoo-fleamarket',
      name: 'Yahoo!フリマ',
      iconUrl: 'images/platform/yahoo-fleamarket.png',
      commission: 5,
      order: 3,
      active: true
    },
    {
      platformId: 'yahoo-auction',
      name: 'ヤフオク!',
      iconUrl: 'images/platform/yahoo-auction.png',
      commission: 10,
      order: 4,
      active: true
    },
    {
      platformId: 'rakuma',
      name: 'ラクマ',
      iconUrl: 'images/platform/rakuma.png',
      commission: 6,
      order: 5,
      active: true
    },
    {
      platformId: 'amazon',
      name: 'Amazon',
      iconUrl: 'images/platform/amazon.png',
      commission: 15,
      order: 6,
      active: true
    },
    {
      platformId: 'ebay',
      name: 'eBay',
      iconUrl: 'images/platform/ebay.png',
      commission: 12,
      order: 7,
      active: true
    },
    {
      platformId: 'rakuten-ichiba',
      name: '楽天市場',
      iconUrl: 'images/platform/rakuten-ichiba.png',
      commission: 10,
      order: 8,
      active: true
    },
    {
      platformId: 'yahoo-shopping',
      name: 'Yahoo!ショッピング',
      iconUrl: 'images/platform/yahoo-shopping.png',
      commission: 6,
      order: 9,
      active: true
    },
    {
      platformId: 'shopify',
      name: 'Shopify',
      iconUrl: 'images/platform/shopify.png',
      commission: 0,
      order: 10,
      active: true
    },
    {
      platformId: 'stores',
      name: 'STORES',
      iconUrl: 'images/platform/stores.png',
      commission: 5,
      order: 11,
      active: true
    },
    {
      platformId: 'base',
      name: 'BASE',
      iconUrl: 'images/platform/base.png',
      commission: 6.6,
      order: 12,
      active: true
    }
  ];

  console.log('🚀 出品先マスタ初期データ登録開始...\n');

  const batch = db.batch();
  const collection = db.collection('salesChannels');

  for (const item of salesChannels) {
    // ドキュメントIDをplatformIdにする（重複防止）
    const docRef = collection.doc(item.platformId);
    batch.set(docRef, {
      platformId: item.platformId,
      name: item.name,
      iconUrl: item.iconUrl,
      commission: item.commission,
      order: item.order,
      active: item.active,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }); // 既存データがあればマージ

    console.log(`  ✅ ${item.platformId}: ${item.name} (手数料: ${item.commission}%)`);
  }

  try {
    await batch.commit();
    console.log(`\n✅ ${salesChannels.length}件の出品先を登録しました`);
    console.log('\n🎉 完了！ページをリロードして確認してください。');
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// 実行
seedSalesChannels();
