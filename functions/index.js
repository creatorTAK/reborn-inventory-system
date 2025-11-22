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
    const targetUsers = await getTargetUsers(notificationData.userEmail);
    console.log(`👥 [onProductCreated] 対象ユーザー: ${targetUsers.length}人`);

    // FCMプッシュ通知を最優先で送信（順次実行）
    console.log('🚀 [onProductCreated] FCM送信開始（最優先）');
    try {
      await sendFCMNotifications(notificationData, targetUsers);
      console.log('✅ [onProductCreated] FCM送信完了');
    } catch (error) {
      console.error('❌ [onProductCreated] FCM送信エラー:', error.message);
    }

    // その後、並列でシステム通知ルームと未読カウント更新
    console.log('🚀 [onProductCreated] システム通知・未読カウント更新開始');
    await Promise.allSettled([
      postToSystemRoom(notificationData),
      updateUnreadCounts(targetUsers)
    ]);
    console.log('✅ [onProductCreated] すべての処理完了');

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
  const userName = productData.createdBy || '匿名ユーザー';
  const userEmail = productData.createdByEmail || 'unknown@example.com';
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
    userEmail: userEmail,
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
 * Collection Group Queryでdevicesサブコレクションから取得
 */
async function getTargetUsers(excludeUser) {
  try {
    // Collection Group Queryで全デバイスを取得（activeフィルタはアプリ側で実施）
    const devicesSnapshot = await db.collectionGroup('devices').get();

    console.log(`🔍 [getTargetUsers] 全デバイス数: ${devicesSnapshot.size}`);

    const userMap = new Map(); // 重複排除用（key: userEmail, value: userName）

    devicesSnapshot.forEach(deviceDoc => {
      const deviceData = deviceDoc.data();
      const userName = deviceData.userName;
      const userEmail = deviceData.userEmail;
      const isActive = deviceData.active;

      console.log(`🔍 [getTargetUsers] デバイス: ${deviceDoc.id}, userName: ${userName}, active: ${isActive}, email: ${userEmail}`);

      // アクティブなデバイスのみ対象
      if (isActive && userName && userEmail && userName !== excludeUser && userName !== 'システム') {
        userMap.set(userEmail, userName);
        console.log(`✅ [getTargetUsers] 追加: ${userName} (${userEmail})`);
      } else {
        console.log(`⏭️ [getTargetUsers] スキップ: ${userName} (active: ${isActive}, excludeUser: ${excludeUser})`);
      }
    });

    const targetUsers = Array.from(userMap.entries()).map(([userEmail, userName]) => ({
      userName,
      userEmail
    }));
    console.log(`📊 [getTargetUsers] 対象ユーザー（重複排除後）: ${targetUsers.length}人`);

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
  console.log('📨 [postToSystemRoom] 関数開始');
  try {
    const systemRoomId = 'system';
    const messageId = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    console.log('🔍 [DEBUG] postToSystemRoom開始');
    console.log('🔍 [DEBUG] messageId:', messageId);
    console.log('🔍 [DEBUG] notificationData:', JSON.stringify(notificationData));

    // システムルーム存在確認と自動作成
    console.log('🔍 [postToSystemRoom] systemRoomRef取得開始');
    const systemRoomRef = db.collection('rooms').doc(systemRoomId);

    console.log('🔍 [postToSystemRoom] systemRoomDoc.get()開始');
    let systemRoomDoc;
    try {
      systemRoomDoc = await Promise.race([
        systemRoomRef.get(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore get() timeout')), 5000))
      ]);
      console.log('✅ [postToSystemRoom] systemRoomDoc.get()完了, exists:', systemRoomDoc.exists);
    } catch (error) {
      console.error('❌ [postToSystemRoom] systemRoomDoc.get()エラー:', error.message);
      throw error;
    }

    if (!systemRoomDoc.exists) {
      console.log('⚠️ [postToSystemRoom] システムルーム未作成、自動作成します');
      console.log('🔍 [postToSystemRoom] systemRoomRef.set()開始');
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
      console.log('🔍 [postToSystemRoom] systemRoomRef.update()開始');
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
      userName: notificationData.userName,  // チャットUI用
      timestamp: new Date(),
      deleted: false,
      type: 'system'
    };

    console.log('🔍 [DEBUG] messageData:', JSON.stringify(messageData));
    console.log('🔍 [DEBUG] Firestore書き込み開始...');

    await db.collection('rooms').doc(systemRoomId).collection('messages').doc(messageId).set(messageData);
    console.log('✅ [postToSystemRoom] Firestore書き込み完了');

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
  console.log('🔔 [sendFCMNotifications] 関数開始');
  try {
    if (targetUsers.length === 0) {
      console.log('⏭️ [sendFCMNotifications] 対象ユーザーなし、スキップ');
      return;
    }

    console.log(`🔔 [sendFCMNotifications] FCM送信開始: ${targetUsers.length}人`);

    // ユーザーごとのアクティブデバイスからFCMトークンを取得
    const tokensPromises = targetUsers.map(async (user) => {
      try {
        const { userName, userEmail } = user;
        console.log(`🔍 [sendFCMNotifications] デバイストークン取得試行: users/${userEmail}/devices (${userName})`);

        // devicesサブコレクションからアクティブなデバイスを取得
        const devicesSnapshot = await Promise.race([
          db.collection('users').doc(userEmail).collection('devices')
            .where('active', '==', true)
            .get(),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`Firestore devices query timeout for ${userEmail}`)), 5000))
        ]);

        console.log(`✅ [sendFCMNotifications] デバイスクエリ完了: users/${userEmail}/devices (${devicesSnapshot.size}件)`);

        if (devicesSnapshot.empty) {
          console.log(`⚠️ [sendFCMNotifications] アクティブデバイスなし: ${userName} (${userEmail})`);
          return [];
        }

        // すべてのアクティブデバイスのトークンを取得
        const userTokens = [];
        devicesSnapshot.forEach(deviceDoc => {
          const deviceData = deviceDoc.data();
          const fcmToken = deviceData?.fcmToken;
          const permissionId = deviceData?.permissionId || 'staff';
          const permissionDisplay = deviceData?.permissionDisplay || 'スタッフ';

          if (fcmToken) {
            console.log(`✅ [sendFCMNotifications] トークン取得成功: ${userName} (${permissionDisplay}) → ${fcmToken.substring(0, 20)}...`);
            userTokens.push({ userName, token: fcmToken, permissionId, permissionDisplay });
          } else {
            console.log(`⚠️ [sendFCMNotifications] トークンなし: ${userName} device=${deviceDoc.id}`);
          }
        });

        return userTokens;
      } catch (error) {
        console.error(`❌ [sendFCMNotifications] ユーザー${user.userName} (${user.userEmail})のデバイス取得エラー:`, error);
        return [];
      }
    });

    // flat()で配列を平坦化（各ユーザーが複数デバイスを持つため）
    const tokensData = (await Promise.all(tokensPromises)).flat().filter(data => data && data.token);
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
  console.log('📊 [updateUnreadCounts] 関数開始');
  try {
    const systemRoomId = 'system';
    const batch = db.batch();

    targetUsers.forEach(user => {
      const { userEmail } = user;
      console.log(`📊 [updateUnreadCounts] カウント更新: ${userEmail}`);
      const unreadRef = db.collection('rooms').doc(systemRoomId).collection('unreadCounts').doc(userEmail);
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

/**
 * 個別チャットメッセージ送信時の通知処理
 * Firestoreトリガー: rooms/{roomId}/messages/{messageId} 作成時
 */
exports.onChatMessageCreated = onDocumentCreated('rooms/{roomId}/messages/{messageId}', async (event) => {
  const startTime = Date.now();
  const roomId = event.params.roomId;
  const messageId = event.params.messageId;

  console.log('💬 [onChatMessageCreated] メッセージ検知:', roomId, messageId);

  try {
    const messageData = event.data.data();

    if (!messageData) {
      console.error('❌ [onChatMessageCreated] メッセージデータが空');
      return;
    }

    // システムメッセージはスキップ
    if (messageData.type === 'system') {
      console.log('⏭️ [onChatMessageCreated] システムメッセージ、スキップ');
      return;
    }

    const senderName = messageData.userName || '匿名';
    const messageText = messageData.text || '(ファイル)';

    console.log('📋 [onChatMessageCreated] 送信者:', senderName, '内容:', messageText);

    // ルーム情報を取得
    const roomRef = db.collection('rooms').doc(roomId);
    const roomSnap = await roomRef.get();

    if (!roomSnap.exists()) {
      console.error('❌ [onChatMessageCreated] ルームが見つかりません:', roomId);
      return;
    }

    const roomData = roomSnap.data();
    const roomType = roomData.type || 'group';
    const members = roomData.members || [];

    console.log('📋 [onChatMessageCreated] ルーム:', roomData.name, 'タイプ:', roomType, 'メンバー:', members);

    // 送信者以外のメンバーに通知
    const targetMembers = members.filter(member => member !== senderName);

    if (targetMembers.length === 0) {
      console.log('⏭️ [onChatMessageCreated] 通知対象なし');
      return;
    }

    console.log('👥 [onChatMessageCreated] 通知対象:', targetMembers);

    // 対象メンバーのメールアドレスを取得
    const usersSnapshot = await db.collection('users').get();
    const memberEmails = [];

    usersSnapshot.forEach(userDoc => {
      const userData = userDoc.data();
      if (targetMembers.includes(userData.userName)) {
        memberEmails.push({
          userName: userData.userName,
          userEmail: userDoc.id
        });
      }
    });

    console.log('📧 [onChatMessageCreated] メールアドレス取得:', memberEmails);

    // FCM通知送信
    await sendChatNotifications(senderName, messageText, roomData.name || '個別チャット', memberEmails);

    const duration = Date.now() - startTime;
    console.log(`✅ [onChatMessageCreated] 通知完了: ${duration}ms`);

  } catch (error) {
    console.error('❌ [onChatMessageCreated] エラー:', error);
  }
});

/**
 * チャットメッセージのFCM通知送信
 */
async function sendChatNotifications(senderName, messageText, roomName, targetUsers) {
  console.log('💬 [sendChatNotifications] 関数開始');
  try {
    if (targetUsers.length === 0) {
      console.log('⏭️ [sendChatNotifications] 対象ユーザーなし、スキップ');
      return;
    }

    console.log(`💬 [sendChatNotifications] FCM送信開始: ${targetUsers.length}人`);

    // 各ユーザーのFCMトークンを取得
    const tokensPromises = targetUsers.map(async (user) => {
      try {
        const { userName, userEmail } = user;
        console.log(`🔍 [sendChatNotifications] トークン取得: ${userName} (${userEmail})`);

        const devicesSnapshot = await db.collection('users').doc(userEmail).collection('devices')
          .where('active', '==', true)
          .get();

        if (devicesSnapshot.empty) {
          console.log(`⚠️ [sendChatNotifications] アクティブデバイスなし: ${userName}`);
          return [];
        }

        const userTokens = [];
        devicesSnapshot.forEach(deviceDoc => {
          const deviceData = deviceDoc.data();
          const fcmToken = deviceData?.fcmToken;

          if (fcmToken) {
            console.log(`✅ [sendChatNotifications] トークン取得成功: ${userName}`);
            userTokens.push(fcmToken);
          }
        });

        return userTokens;
      } catch (error) {
        console.error(`❌ [sendChatNotifications] ユーザー${user.userName}のトークン取得エラー:`, error);
        return [];
      }
    });

    const tokens = (await Promise.all(tokensPromises)).flat().filter(token => token);

    if (tokens.length === 0) {
      console.log('⏭️ [sendChatNotifications] FCMトークンなし、スキップ');
      return;
    }

    console.log(`📨 [sendChatNotifications] 送信先トークン数: ${tokens.length}`);

    // FCM通知メッセージ作成
    const message = {
      notification: {
        title: `${senderName} - ${roomName}`,
        body: messageText
      },
      data: {
        type: 'CHAT_MESSAGE',
        roomName: roomName,
        senderName: senderName
      },
      tokens: tokens
    };

    // FCM送信
    const response = await messaging.sendEachForMulticast(message);
    console.log(`✅ [sendChatNotifications] FCM送信完了: 成功=${response.successCount}, 失敗=${response.failureCount}`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`❌ [sendChatNotifications] 送信失敗 [${idx}]:`, resp.error);
        }
      });
    }

  } catch (error) {
    console.error('❌ [sendChatNotifications] エラー:', error);
  }
}
