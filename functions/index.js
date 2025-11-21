/**
 * 🔔 REBORN Inventory - Firebase Functions
 *
 * 商品登録時の即時通知システム
 * Firestoreトリガーで自動実行、100-200msで通知配信
 */

const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');

// Firebase Admin初期化
initializeApp();
const db = getFirestore();

/**
 * 商品登録時の通知処理
 * Firestoreトリガー: products/{productId} 作成時
 */
exports.onProductCreated = onDocumentCreated('products/{productId}', async (event) => {
  const startTime = Date.now();
  const productId = event.params.productId;

  console.log('🔔 [onProductCreated] 商品登録検知:', productId);

  try {
    const productData = event.data.data();

    if (!productData) {
      console.error('❌ [onProductCreated] 商品データが空');
      return;
    }

    // 通知データ作成
    const notificationData = createNotificationData(productData);
    console.log('📋 [onProductCreated] 通知データ作成完了');

    // 対象ユーザー取得（商品登録者以外の全ユーザー）
    const targetUsers = await getTargetUsers(notificationData.userName);
    console.log(`👥 [onProductCreated] 対象ユーザー: ${targetUsers.length}人`);

    // 並列処理で高速化
    await Promise.all([
      // 1. システム通知ルームに投稿
      postToSystemRoom(notificationData),

      // 2. FCMプッシュ通知送信
      sendFCMNotifications(notificationData, targetUsers),

      // 3. 未読カウント更新
      updateUnreadCounts(targetUsers)
    ]);

    const duration = Date.now() - startTime;
    console.log(`✅ [onProductCreated] 通知完了: ${duration}ms`);

  } catch (error) {
    console.error('❌ [onProductCreated] エラー:', error);
    // エラーでもFirestore保存は成功しているので、処理継続
  }
});

/**
 * 通知データ作成
 */
function createNotificationData(productData) {
  const userName = productData.createdBy || 'unknown@example.com';
  const managementNumber = productData.managementNumber || productData.productId;
  const brandName = productData.brand?.nameEn || productData.brand?.nameKana || '';
  const itemName = productData.itemName || '';
  const category = productData.category?.major || '';
  const listingDestination = productData.listing?.destination || '';
  const listingAmount = productData.listing?.amount || '';

  const productName = (brandName ? brandName + ' ' : '') + (itemName || category || '');

  return {
    type: 'PRODUCT_REGISTERED',
    userName: userName,
    managementNumber: managementNumber,
    productName: productName,
    listingDestination: listingDestination,
    listingAmount: listingAmount,
    timestamp: new Date().toISOString(),
    content: `✅ 商品登録完了\n${userName}さんが商品を登録しました\n\n管理番号: ${managementNumber}\n${productName}\n${listingDestination ? '出品先: ' + listingDestination : ''}\n${listingAmount ? '出品金額: ' + Number(listingAmount).toLocaleString() + '円' : ''}`,
    sender: userName,
    title: '✅ 商品登録完了'
  };
}

/**
 * 対象ユーザー取得（登録者以外の全ユーザー）
 */
async function getTargetUsers(excludeUser) {
  try {
    const usersSnapshot = await db.collection('users').get();
    const targetUsers = [];

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      const userName = userData.userName || userData.email;

      if (userName && userName !== excludeUser && userName !== 'システム') {
        targetUsers.push(userName);
      }
    });

    return targetUsers;
  } catch (error) {
    console.error('❌ [getTargetUsers] エラー:', error);
    return [];
  }
}

/**
 * システム通知ルームに投稿
 */
async function postToSystemRoom(notificationData) {
  try {
    const systemRoomId = 'system';
    const messageId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    await db.collection('rooms').doc(systemRoomId).collection('messages').doc(messageId).set({
      id: messageId,
      text: notificationData.content,
      sender: notificationData.sender,
      timestamp: new Date(),
      deleted: false,
      type: 'system'
    });

    console.log('📨 [postToSystemRoom] システム通知ルーム投稿完了');
  } catch (error) {
    console.error('❌ [postToSystemRoom] エラー:', error);
  }
}

/**
 * FCMプッシュ通知送信
 */
async function sendFCMNotifications(notificationData, targetUsers) {
  try {
    // TODO: FCM送信実装
    // 現在はFirestore投稿のみ実装
    // FCM実装は次のステップで追加
    console.log('⏳ [sendFCMNotifications] FCM送信は次フェーズで実装');
  } catch (error) {
    console.error('❌ [sendFCMNotifications] エラー:', error);
  }
}

/**
 * 未読カウント更新
 */
async function updateUnreadCounts(targetUsers) {
  try {
    const systemRoomId = 'system';
    const batch = db.batch();

    targetUsers.forEach(userName => {
      const unreadRef = db.collection('rooms').doc(systemRoomId).collection('unreadCounts').doc(userName);
      batch.set(unreadRef, {
        count: FieldValue.increment(1),
        lastUpdated: new Date()
      }, { merge: true });
    });

    await batch.commit();
    console.log('📊 [updateUnreadCounts] 未読カウント更新完了');
  } catch (error) {
    console.error('❌ [updateUnreadCounts] エラー:', error);
  }
}
