/**
 * Firestore platforms コレクション初期化スクリプト
 *
 * このスクリプトは、プラットフォームマスタデータをFirestoreに投入します。
 * ブラウザコンソールから実行してください。
 *
 * 使い方:
 * 1. config.html を開く
 * 2. ブラウザ開発者ツールのコンソールを開く
 * 3. このスクリプトをコピー&ペーストして実行
 */

async function initPlatformsCollection() {
  console.log('🚀 platforms コレクション初期化を開始...');

  // Firestore参照の確認
  if (!window.db) {
    console.error('❌ Firestoreが初期化されていません');
    return;
  }

  // プラットフォームマスタデータ
  const platforms = [
    // フリマ系（既存）
    {
      id: 'mercari',
      name: 'メルカリ',
      description: 'フリマアプリ',
      icon: '/images/platform/mercari.png',
      status: '実装済',
      order: 1,
      isSystem: true,
      category: 'flea-market'
    },
    {
      id: 'mercari-shops',
      name: 'メルカリShops',
      description: 'ショップ向けEC',
      icon: '/images/platform/mercari-shops.png',
      status: '準備中',
      order: 2,
      isSystem: true,
      category: 'flea-market'
    },
    {
      id: 'yahoo-fleamarket',
      name: 'Yahoo!フリマ',
      description: 'PayPayフリマ',
      icon: '/images/platform/yahoo-fleamarket.png',
      status: '準備中',
      order: 3,
      isSystem: true,
      category: 'flea-market'
    },
    {
      id: 'yahoo-auction',
      name: 'Yahoo!オークション',
      description: 'ヤフオク',
      icon: '/images/platform/yahoo-auction.png',
      status: '準備中',
      order: 4,
      isSystem: true,
      category: 'auction'
    },
    {
      id: 'rakuma',
      name: 'ラクマ',
      description: '楽天フリマ',
      icon: '/images/platform/rakuma.png',
      status: '準備中',
      order: 5,
      isSystem: true,
      category: 'flea-market'
    },

    // ECプラットフォーム（既存）
    {
      id: 'base',
      name: 'BASE',
      description: 'ネットショップ',
      icon: '/images/platform/base.png',
      status: '準備中',
      order: 6,
      isSystem: true,
      category: 'ec-platform'
    },

    // ECプラットフォーム（新規追加）
    {
      id: 'shopify',
      name: 'Shopify',
      description: 'ECプラットフォーム',
      icon: '/images/platform/shopify.png',
      status: '準備中',
      order: 7,
      isSystem: true,
      category: 'ec-platform'
    },
    {
      id: 'stores',
      name: 'STORES',
      description: 'ネットショップ',
      icon: '/images/platform/stores.png',
      status: '準備中',
      order: 8,
      isSystem: true,
      category: 'ec-platform'
    },

    // 海外EC（新規追加）
    {
      id: 'ebay',
      name: 'eBay',
      description: '海外向けオークション',
      icon: '/images/platform/ebay.png',
      status: '準備中',
      order: 9,
      isSystem: true,
      category: 'global'
    },
    {
      id: 'amazon',
      name: 'Amazon',
      description: 'Amazonセラー',
      icon: '/images/platform/amazon.png',
      status: '準備中',
      order: 10,
      isSystem: true,
      category: 'ec-platform'
    },

    // モール系（新規追加）
    {
      id: 'rakuten-ichiba',
      name: '楽天市場',
      description: '楽天モール',
      icon: '/images/platform/rakuten-ichiba.png',
      status: '準備中',
      order: 11,
      isSystem: true,
      category: 'mall'
    },
    {
      id: 'yahoo-shopping',
      name: 'Yahoo!ショッピング',
      description: 'Yahoo!モール',
      icon: '/images/platform/yahoo-shopping.png',
      status: '準備中',
      order: 12,
      isSystem: true,
      category: 'mall'
    }
  ];

  const batch = window.db.batch();
  const now = firebase.firestore.FieldValue.serverTimestamp();

  for (const platform of platforms) {
    const docRef = window.db.collection('platforms').doc(platform.id);
    batch.set(docRef, {
      ...platform,
      createdAt: now,
      updatedAt: now
    });
    console.log(`📦 ${platform.name} を追加準備`);
  }

  try {
    await batch.commit();
    console.log('✅ platforms コレクション初期化完了！');
    console.log(`   合計 ${platforms.length} 件のプラットフォームを登録しました`);

    // 確認のため読み込み
    const snapshot = await window.db.collection('platforms').orderBy('order').get();
    console.log('\n📋 登録されたプラットフォーム:');
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   ${data.order}. ${data.name} (${data.id}) - ${data.status}`);
    });
  } catch (error) {
    console.error('❌ 初期化エラー:', error);
  }
}

// 実行
initPlatformsCollection();
