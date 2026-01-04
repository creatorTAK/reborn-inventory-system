/**
 * 出品先マスタ初期データ登録スクリプト（手数料タイプ対応版）
 *
 * 使用方法:
 * 1. furira.jpの任意のページを開く
 * 2. ログイン済みの状態でブラウザのコンソールを開く（F12）
 * 3. このスクリプトを貼り付けて実行
 *
 * 手数料タイプ:
 * - simple: 固定%（メルカリ、Yahoo!フリマ等）
 * - variable: 変動制（ラクマ等）
 * - complex: 複合計算（BASE等）
 * - manual: 手動入力（楽天、Amazon等）
 */

async function seedSalesChannels() {
  if (typeof firebase === 'undefined') {
    console.error('Firebase SDKが読み込まれていません。');
    console.log('furira.jpのページでログイン後に実行してください。');
    return;
  }

  const db = firebase.firestore();

  // 出品先マスタ初期データ（2025年調査結果に基づく）
  const salesChannels = [
    // === フリマアプリ（固定%） ===
    {
      platformId: 'mercari',
      name: 'メルカリ',
      iconUrl: 'images/platform/mercari.png',
      feeType: 'simple',
      commission: 10,
      order: 1,
      active: true
    },
    {
      platformId: 'mercari-shops',
      name: 'メルカリShops',
      iconUrl: 'images/platform/mercari-shops.png',
      feeType: 'simple',
      commission: 10,
      order: 2,
      active: true
    },
    {
      platformId: 'yahoo-fleamarket',
      name: 'Yahoo!フリマ',
      iconUrl: 'images/platform/yahoo-fleamarket.png',
      feeType: 'simple',
      commission: 5,
      order: 3,
      active: true
    },
    {
      platformId: 'yahoo-auction',
      name: 'ヤフオク!',
      iconUrl: 'images/platform/yahoo-auction.png',
      feeType: 'simple',
      commission: 10,
      order: 4,
      active: true
    },

    // === フリマアプリ（変動制） ===
    {
      platformId: 'rakuma',
      name: 'ラクマ',
      iconUrl: 'images/platform/rakuma.png',
      feeType: 'variable',
      commissionMin: 4.5,
      commissionMax: 10,
      commissionDefault: 10,
      order: 5,
      active: true
    },

    // === ネットショップ（複合計算） ===
    {
      platformId: 'base',
      name: 'BASE',
      iconUrl: 'images/platform/base.png',
      feeType: 'complex',
      commissionFormula: '3.6% + 40円 + 3%',
      formulaDescription: 'スタンダードプラン: 決済手数料3.6%+40円、サービス利用料3%（実質約6.6%）',
      order: 10,
      active: true
    },
    {
      platformId: 'stores',
      name: 'STORES',
      iconUrl: 'images/platform/stores.png',
      feeType: 'complex',
      commissionFormula: '3.6%',
      formulaDescription: 'ベーシックプラン: クレジットカード決済3.6%、コンビニ等4.6%（月額費用別途）',
      order: 11,
      active: true
    },
    {
      platformId: 'shopify',
      name: 'Shopify',
      iconUrl: 'images/platform/shopify.png',
      feeType: 'complex',
      commissionFormula: '3.55%',
      formulaDescription: 'Shopifyペイメント利用時: 決済手数料約3.55%（プラン別月額費用別途）',
      order: 12,
      active: true
    },

    // === モール系（手動入力） ===
    {
      platformId: 'amazon',
      name: 'Amazon',
      iconUrl: 'images/platform/amazon.png',
      feeType: 'manual',
      feeNote: 'カテゴリ別8〜15%、メディア商品は成約料（本80円等）別途、FBA利用時は保管・配送手数料も発生。低価格商品（750円未満）は5%に軽減。',
      feeEstimate: 15,
      order: 6,
      active: true
    },
    {
      platformId: 'ebay',
      name: 'eBay',
      iconUrl: 'images/platform/ebay.png',
      feeType: 'manual',
      feeNote: '落札手数料13.6〜15%+$0.30、海外決済手数料1.35%、為替手数料3%。合計約20%程度。ストア契約で割引あり。',
      feeEstimate: 20,
      order: 7,
      active: true
    },
    {
      platformId: 'rakuten-ichiba',
      name: '楽天市場',
      iconUrl: 'images/platform/rakuten-ichiba.png',
      feeType: 'manual',
      feeNote: '月額2.75〜14.3万円+システム利用料2〜7%+楽天ポイント1%+決済2.5〜3.5%。がんばれ！プランで月額27,500円〜。',
      feeEstimate: 10,
      order: 8,
      active: true
    },
    {
      platformId: 'yahoo-shopping',
      name: 'Yahoo!ショッピング',
      iconUrl: 'images/platform/yahoo-shopping.png',
      feeType: 'manual',
      feeNote: '出店料・月額無料。ストアポイント2.5%（必須）+キャンペーン原資1.5%（必須）+アフィリエイト1〜50%。実質約6%程度。',
      feeEstimate: 6,
      order: 9,
      active: true
    }
  ];

  console.log('🚀 出品先マスタ初期データ登録開始...\n');

  const batch = db.batch();
  const collection = db.collection('salesChannels');

  // 手数料タイプの表示名
  const feeTypeLabels = {
    simple: '固定%',
    variable: '変動制',
    complex: '複合計算',
    manual: '手動入力'
  };

  for (const item of salesChannels) {
    // ドキュメントIDをplatformIdにする（重複防止）
    const docRef = collection.doc(item.platformId);

    const data = {
      platformId: item.platformId,
      name: item.name,
      iconUrl: item.iconUrl,
      feeType: item.feeType,
      order: item.order,
      active: item.active,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 手数料タイプ別のフィールドを追加
    switch (item.feeType) {
      case 'simple':
        data.commission = item.commission;
        break;
      case 'variable':
        data.commissionMin = item.commissionMin;
        data.commissionMax = item.commissionMax;
        data.commissionDefault = item.commissionDefault;
        break;
      case 'complex':
        data.commissionFormula = item.commissionFormula;
        data.formulaDescription = item.formulaDescription;
        break;
      case 'manual':
        data.feeNote = item.feeNote;
        data.feeEstimate = item.feeEstimate;
        break;
    }

    batch.set(docRef, data, { merge: true });

    // 手数料情報の表示
    let feeInfo = '';
    switch (item.feeType) {
      case 'simple':
        feeInfo = `${item.commission}%`;
        break;
      case 'variable':
        feeInfo = `${item.commissionMin}〜${item.commissionMax}%`;
        break;
      case 'complex':
        feeInfo = item.commissionFormula;
        break;
      case 'manual':
        feeInfo = `約${item.feeEstimate}%`;
        break;
    }

    console.log(`  ✅ ${item.platformId}: ${item.name} [${feeTypeLabels[item.feeType]}] ${feeInfo}`);
  }

  try {
    await batch.commit();
    console.log(`\n✅ ${salesChannels.length}件の出品先を登録しました`);
    console.log('\n📊 手数料タイプ別内訳:');
    console.log(`   - 固定%: ${salesChannels.filter(s => s.feeType === 'simple').length}件`);
    console.log(`   - 変動制: ${salesChannels.filter(s => s.feeType === 'variable').length}件`);
    console.log(`   - 複合計算: ${salesChannels.filter(s => s.feeType === 'complex').length}件`);
    console.log(`   - 手動入力: ${salesChannels.filter(s => s.feeType === 'manual').length}件`);
    console.log('\n🎉 完了！ページをリロードして確認してください。');
  } catch (error) {
    console.error('❌ エラー:', error);
  }
}

// 実行
seedSalesChannels();
