/**
 * 🔔 REBORN Inventory - Firebase Functions
 *
 * 商品登録時の即時通知システム
 * Firestoreトリガーで自動実行、100-200msで通知配信
 */

const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');

// Firebase Admin初期化
initializeApp();
const db = getFirestore();
const messaging = getMessaging();

/**
 * 商品登録時の通知処理
 * Firestoreトリガー: products/{productId} 作成時
 */
exports.onProductCreated = onDocumentCreated('products/{productId}', async (event) => {
  const startTime = Date.now();
  const productId = event.params.productId;

  console.log('🔔 [onProductCreated] 商品登録検知:', productId);

  try {
    console.log('🔍 [DEBUG] event.data:', event.data);
    const productData = event.data.data();
    console.log('🔍 [DEBUG] productData:', productData);

    if (!productData) {
      console.error('❌ [onProductCreated] 商品データが空');
      return;
    }

    // 通知データ作成
    console.log('🔍 [DEBUG] createNotificationData開始');
    const notificationData = createNotificationData(productData);
    console.log('📋 [onProductCreated] 通知データ作成完了:', notificationData);

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

    console.log('🔍 [DEBUG] postToSystemRoom開始');
    console.log('🔍 [DEBUG] messageId:', messageId);
    console.log('🔍 [DEBUG] notificationData:', JSON.stringify(notificationData));

    // システムルーム存在確認と自動作成
    const systemRoomRef = db.collection('rooms').doc(systemRoomId);
    const systemRoomDoc = await systemRoomRef.get();

    if (!systemRoomDoc.exists) {
      console.log('⚠️ [postToSystemRoom] システムルーム未作成、自動作成します');
      await systemRoomRef.set({
        id: 'system',
        name: 'システム通知',
        type: 'system',
        members: [], // 全員が参加
        createdAt: new Date(),
        lastMessageAt: new Date(),
        lastMessage: notificationData.content,
        lastMessageSender: notificationData.sender
      });
      console.log('✅ [postToSystemRoom] システムルーム作成完了');
    } else {
      // 既存ルームの lastMessage を更新
      await systemRoomRef.update({
        lastMessageAt: new Date(),
        lastMessage: notificationData.content,
        lastMessageSender: notificationData.sender
      });
      console.log('✅ [postToSystemRoom] システムルーム更新完了');
    }

    const messageData = {
      id: messageId,
      text: notificationData.content,
      sender: notificationData.sender,
      timestamp: new Date(),
      deleted: false,
      type: 'system'
    };

    console.log('🔍 [DEBUG] messageData:', JSON.stringify(messageData));
    console.log('🔍 [DEBUG] Firestore書き込み開始...');

    await db.collection('rooms').doc(systemRoomId).collection('messages').doc(messageId).set(messageData);

    console.log('📨 [postToSystemRoom] システム通知ルーム投稿完了');
  } catch (error) {
    console.error('❌ [postToSystemRoom] エラー:', error);
    console.error('❌ [postToSystemRoom] エラー詳細:', error.message);
    console.error('❌ [postToSystemRoom] スタック:', error.stack);
  }
}

/**
 * FCMプッシュ通知送信
 */
async function sendFCMNotifications(notificationData, targetUsers) {
  try {
    if (targetUsers.length === 0) {
      console.log('⏭️ [sendFCMNotifications] 対象ユーザーなし、スキップ');
      return;
    }

    console.log(`🔔 [sendFCMNotifications] FCM送信開始: ${targetUsers.length}人`);

    // ユーザーごとのFCMトークンを取得
    const tokensPromises = targetUsers.map(async (userName) => {
      try {
        const userDoc = await db.collection('users').doc(userName).get();
        const fcmToken = userDoc.data()?.fcmToken;
        return fcmToken ? { userName, token: fcmToken } : null;
      } catch (error) {
        console.error(`❌ [sendFCMNotifications] ユーザー${userName}のトークン取得エラー:`, error);
        return null;
      }
    });

    const tokensData = (await Promise.all(tokensPromises)).filter(data => data !== null);
    const tokens = tokensData.map(data => data.token);

    if (tokens.length === 0) {
      console.log('⏭️ [sendFCMNotifications] FCMトークンなし、スキップ');
      return;
    }

    console.log(`📨 [sendFCMNotifications] 送信先トークン数: ${tokens.length}`);

    // FCM通知メッセージ作成
    const message = {
      notification: {
        title: notificationData.title,
        body: `${notificationData.managementNumber} ${notificationData.productName}`
      },
      data: {
        type: notificationData.type,
        managementNumber: notificationData.managementNumber,
        productName: notificationData.productName,
        userName: notificationData.userName,
        timestamp: notificationData.timestamp
      }
    };

    // 複数のトークンに送信
    const sendPromises = tokens.map(async (token) => {
      try {
        await messaging.send({
          ...message,
          token: token
        });
        console.log(`✅ [sendFCMNotifications] 送信成功: ${token.substring(0, 20)}...`);
        return { success: true };
      } catch (error) {
        console.error(`❌ [sendFCMNotifications] 送信失敗: ${token.substring(0, 20)}...`, error.message);
        return { success: false, error: error.message };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter(r => r.success).length;
    console.log(`📊 [sendFCMNotifications] 送信結果: ${successCount}/${tokens.length}件成功`);

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
        unreadCount: FieldValue.increment(1), // PWA側と統一: count → unreadCount
        lastUpdated: new Date()
      }, { merge: true });
    });

    await batch.commit();
    console.log('📊 [updateUnreadCounts] 未読カウント更新完了');
  } catch (error) {
    console.error('❌ [updateUnreadCounts] エラー:', error);
  }
}
