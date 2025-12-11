/**
 * 🔔 REBORN Inventory - Firebase Functions
 *
 * 商品登録時の即時通知システム
 * Firestoreトリガーで自動実行、100-200msで通知配信
 *
 * v2.1: 個別チャット通知高速化（memberEmails優先使用）
 */

const {onDocumentCreated, onDocumentUpdated} = require('firebase-functions/v2/firestore');
const {onObjectFinalized} = require('firebase-functions/v2/storage');
const {initializeApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');
const {getStorage} = require('firebase-admin/storage');
const sharp = require('sharp');
const path = require('path');

// Firebase Admin初期化
initializeApp();
const db = getFirestore();
const messaging = getMessaging();
const bucket = getStorage().bucket();

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
console.log('🔧 [onChatMessageCreated] 関数初期化完了');

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
    const mentions = messageData.mentions || []; // メンションされたユーザー名の配列

    console.log('📋 [onChatMessageCreated] 送信者:', senderName, '内容:', messageText, 'メンション:', mentions);

    // ルーム情報を取得
    const roomRef = db.collection('rooms').doc(roomId);
    const roomSnap = await roomRef.get();

    if (!roomSnap.exists) {
      console.error('❌ [onChatMessageCreated] ルームが見つかりません:', roomId);
      return;
    }

    const roomData = roomSnap.data();
    const roomType = roomData.type || 'group';
    const members = roomData.members || [];

    console.log('📋 [onChatMessageCreated] ルーム:', roomData.name, 'タイプ:', roomType, 'メンバー:', members);

    // 🔔 非表示解除: 新着メッセージ時にhiddenByをクリア（ルームを再表示）
    if (roomData.hiddenBy && roomData.hiddenBy.length > 0) {
      console.log('👁️ [onChatMessageCreated] 非表示解除:', roomData.hiddenBy);
      await roomRef.update({ hiddenBy: [] });
      console.log('✅ [onChatMessageCreated] hiddenBy クリア完了');
    }

    // 送信者以外のメンバーに通知
    const targetMembers = members.filter(member => member !== senderName);

    if (targetMembers.length === 0) {
      console.log('⏭️ [onChatMessageCreated] 通知対象なし');
      return;
    }

    console.log('👥 [onChatMessageCreated] 通知対象:', targetMembers);

    // 対象メンバーのメールアドレスを取得
    // roomData.memberEmails を優先使用（高速化）
    let memberEmails = [];

    if (roomData.memberEmails && roomData.memberEmails.length > 0) {
      // memberEmails フィールドがある場合（個別チャット等）
      console.log('📧 [onChatMessageCreated] memberEmails フィールドから取得（高速）');

      // 送信者のメールアドレスを特定
      const senderEmail = messageData.userEmail || null;

      // 送信者以外のメールアドレスを抽出
      memberEmails = roomData.memberEmails
        .filter(email => email !== senderEmail)
        .map((email, index) => ({
          userName: targetMembers[index] || 'Unknown',
          userEmail: email
        }));

      console.log('📧 [onChatMessageCreated] memberEmails から取得:', memberEmails);
    } else {
      // memberEmails フィールドがない場合（旧データ、全体チャット等）
      console.log('📧 [onChatMessageCreated] users コレクションから取得（低速）');
      const usersSnapshot = await db.collection('users').get();

      usersSnapshot.forEach(userDoc => {
        const userData = userDoc.data();
        if (targetMembers.includes(userData.userName)) {
          memberEmails.push({
            userName: userData.userName,
            userEmail: userDoc.id
          });
        }
      });

      console.log('📧 [onChatMessageCreated] users スキャン完了:', memberEmails);
    }

    // メンション通知と通常通知を分離
    let mentionedUsers = [];
    let normalUsers = memberEmails;

    if (mentions.length > 0) {
      console.log('📢 [onChatMessageCreated] メンション検出:', mentions);

      // メンションされたユーザーを特定（ユーザー名で照合）
      mentionedUsers = memberEmails.filter(user => mentions.includes(user.userName));
      // 通常通知対象はメンションされていないユーザーのみ
      normalUsers = memberEmails.filter(user => !mentions.includes(user.userName));

      console.log('📢 [onChatMessageCreated] メンション通知対象:', mentionedUsers.map(u => u.userName));
      console.log('📢 [onChatMessageCreated] 通常通知対象:', normalUsers.map(u => u.userName));
    }

    // 🎯 閲覧中ユーザーを通知対象から除外（バッジ問題対策）
    const viewingUsers = await getViewingUsers(roomId);
    console.log('👀 [onChatMessageCreated] 閲覧中ユーザー:', viewingUsers);

    if (viewingUsers.length > 0) {
      const beforeCount = normalUsers.length + mentionedUsers.length;
      normalUsers = normalUsers.filter(user => !viewingUsers.includes(user.userEmail));
      mentionedUsers = mentionedUsers.filter(user => !viewingUsers.includes(user.userEmail));
      const afterCount = normalUsers.length + mentionedUsers.length;
      console.log(`👀 [onChatMessageCreated] 閲覧中ユーザー除外: ${beforeCount} -> ${afterCount}`);
    }

    // 🎯 閲覧中ユーザーを未読カウント更新からも除外（バッジ問題対策）
    const memberEmailsForUnread = memberEmails.filter(user => !viewingUsers.includes(user.userEmail));
    console.log(`📊 [onChatMessageCreated] 未読カウント更新対象: ${memberEmailsForUnread.length}人 (閲覧中${viewingUsers.length}人除外)`);

    // FCM通知送信と未読カウント更新を並列実行
    const notificationPromises = [
      updateChatUnreadCounts(roomId, memberEmailsForUnread)
    ];

    // 🔍 デバッグ: normalUsers の状態を確認
    console.log(`🔍 [DEBUG] normalUsers.length: ${normalUsers.length}, normalUsers: ${JSON.stringify(normalUsers)}`);

    // 通常の通知（メンションされていないユーザー）
    if (normalUsers.length > 0) {
      console.log(`📤 [onChatMessageCreated] sendChatNotifications呼び出し開始`);
      notificationPromises.push(
        sendChatNotifications(senderName, messageText, roomData.name || '個別チャット', normalUsers, roomData.mutedBy || [])
      );
    } else {
      console.log(`⏭️ [onChatMessageCreated] normalUsers.length=0, FCM通知スキップ`);
    }

    // メンション通知（メンションされたユーザー、ミュート無視）
    if (mentionedUsers.length > 0) {
      const mentionNotificationText = `${senderName}があなたをメンションしました: ${messageText}`;
      notificationPromises.push(
        sendMentionNotifications(senderName, messageText, roomData.name || '個別チャット', mentionedUsers)
      );
    }

    await Promise.allSettled(notificationPromises);

    const duration = Date.now() - startTime;
    console.log(`✅ [onChatMessageCreated] 通知完了: ${duration}ms`);

  } catch (error) {
    console.error('❌ [onChatMessageCreated] エラー:', error);
  }
});

/**
 * 🎯 指定ルームを閲覧中のユーザーのメールアドレスを取得
 * viewingStatus コレクションをクエリして、roomId が一致するユーザーを返す
 * 🔧 5分以上前の古いデータは無視（タスクキルでクリアされないケース対策）
 */
async function getViewingUsers(roomId) {
  try {
    const viewingSnapshot = await db.collection('viewingStatus')
      .where('roomId', '==', roomId)
      .get();

    const viewingUsers = [];
    const now = Date.now();
    const VIEWING_TIMEOUT_MS = 5 * 60 * 1000; // 5分

    viewingSnapshot.forEach(doc => {
      const data = doc.data();
      const lastUpdated = data.lastUpdated?.toMillis?.() || 0;
      const isRecent = (now - lastUpdated) < VIEWING_TIMEOUT_MS;

      if (isRecent) {
        // ドキュメントIDがユーザーのメールアドレス
        viewingUsers.push(doc.id);
        console.log(`👀 [getViewingUsers] アクティブ: ${doc.id} (${Math.round((now - lastUpdated) / 1000)}秒前)`);
      } else {
        console.log(`⏰ [getViewingUsers] タイムアウト除外: ${doc.id} (${Math.round((now - lastUpdated) / 1000)}秒前)`);
      }
    });

    return viewingUsers;
  } catch (error) {
    console.error('❌ [getViewingUsers] エラー:', error);
    return []; // エラー時は空配列を返す（通知は送る）
  }
}

/**
 * 個別チャット未読カウント更新
 */
async function updateChatUnreadCounts(roomId, targetUsers) {
  console.log('📊 [updateChatUnreadCounts] 関数開始');
  try {
    const batch = db.batch();

    targetUsers.forEach(user => {
      const { userEmail } = user;
      console.log(`📊 [updateChatUnreadCounts] カウント更新: ${userEmail}`);
      const unreadRef = db.collection('rooms').doc(roomId).collection('unreadCounts').doc(userEmail);
      batch.set(unreadRef, {
        unreadCount: FieldValue.increment(1),
        lastUpdated: new Date()
      }, { merge: true });
    });

    await batch.commit();
    console.log('📊 [updateChatUnreadCounts] 未読カウント更新完了');
  } catch (error) {
    console.error('❌ [updateChatUnreadCounts] エラー:', error);
  }
}

/**
 * チャットメッセージのFCM通知送信
 */
async function sendChatNotifications(senderName, messageText, roomName, targetUsers, mutedBy = []) {
  console.log('💬 [sendChatNotifications] 関数開始');
  try {
    if (targetUsers.length === 0) {
      console.log('⏭️ [sendChatNotifications] 対象ユーザーなし、スキップ');
      return;
    }

    // ミュートユーザーを除外
    const unmutedUsers = targetUsers.filter(user => !mutedBy.includes(user.userName));

    if (unmutedUsers.length === 0) {
      console.log('⏭️ [sendChatNotifications] 全員ミュート中、通知スキップ');
      return;
    }

    if (mutedBy.length > 0) {
      console.log(`🔕 [sendChatNotifications] ミュート中ユーザー: ${mutedBy.join(', ')}`);
    }

    console.log(`💬 [sendChatNotifications] FCM送信開始: ${unmutedUsers.length}人 (ミュート除外後)`);

    // 🔧 修正: 各ユーザーの通知設定をチェックしてトークンを取得
    const tokensPromises = unmutedUsers.map(async (user) => {
      try {
        const { userName, userEmail } = user;
        console.log(`🔍 [sendChatNotifications] トークン取得: ${userName} (${userEmail})`);

        // activeDevices/{userEmail} から直接取得（高速化）
        const activeDeviceDoc = await db.collection('activeDevices').doc(userEmail).get();

        if (!activeDeviceDoc.exists) {
          console.log(`⚠️ [sendChatNotifications] activeDevices未登録: ${userName}`);
          return { tokens: [], soundEnabled: true };
        }

        const data = activeDeviceDoc.data();

        // 🔧 通知が無効になっている場合はスキップ
        if (data.notificationEnabled === false) {
          console.log(`🔕 [sendChatNotifications] 通知無効: ${userName}`);
          return { tokens: [], soundEnabled: false };
        }

        const tokens = Array.isArray(data?.fcmTokens) ? data.fcmTokens.filter(Boolean) : [];

        if (tokens.length === 0) {
          console.log(`⚠️ [sendChatNotifications] アクティブトークンなし: ${userName}`);
          return { tokens: [], soundEnabled: data.notificationSound !== false };
        }

        console.log(`✅ [sendChatNotifications] トークン取得成功: ${userName} (${tokens.length}件)`);
        return {
          tokens: tokens,
          soundEnabled: data.notificationSound !== false // デフォルトtrue
        };
      } catch (error) {
        console.error(`❌ [sendChatNotifications] ユーザー${user.userName}のトークン取得エラー:`, error);
        return { tokens: [], soundEnabled: true };
      }
    });

    const results = await Promise.all(tokensPromises);

    // 通知音有効/無効でトークンを分離
    const tokensWithSound = [];
    const tokensWithoutSound = [];

    results.forEach(result => {
      if (result.tokens.length > 0) {
        if (result.soundEnabled) {
          tokensWithSound.push(...result.tokens);
        } else {
          tokensWithoutSound.push(...result.tokens);
        }
      }
    });

    const totalTokens = tokensWithSound.length + tokensWithoutSound.length;

    if (totalTokens === 0) {
      console.log('⏭️ [sendChatNotifications] 通知対象トークンなし、スキップ');
      return;
    }

    console.log(`📨 [sendChatNotifications] 送信先トークン数: ${totalTokens} (音あり: ${tokensWithSound.length}, 音なし: ${tokensWithoutSound.length})`);

    // 🔧 通知音ありのトークンに送信
    if (tokensWithSound.length > 0) {
      const messageWithSound = {
        notification: {
          title: `${senderName} - ${roomName}`,
          body: messageText
        },
        data: {
          type: 'CHAT_MESSAGE',
          roomName: roomName,
          senderName: senderName,
          badgeCount: '1'
        },
        android: {
          notification: {
            sound: 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        },
        tokens: tokensWithSound
      };

      const response = await messaging.sendEachForMulticast(messageWithSound);
      console.log(`✅ [sendChatNotifications] 音あり送信完了: 成功=${response.successCount}, 失敗=${response.failureCount}`);

      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`❌ [sendChatNotifications] 音あり送信失敗 [${idx}]:`, resp.error);
          }
        });
      }
    }

    // 🔧 通知音なしのトークンに送信
    if (tokensWithoutSound.length > 0) {
      const messageWithoutSound = {
        notification: {
          title: `${senderName} - ${roomName}`,
          body: messageText
        },
        data: {
          type: 'CHAT_MESSAGE',
          roomName: roomName,
          senderName: senderName,
          badgeCount: '1'
        },
        apns: {
          payload: {
            aps: {
              badge: 1
            }
          }
        },
        tokens: tokensWithoutSound
      };

      const response = await messaging.sendEachForMulticast(messageWithoutSound);
      console.log(`✅ [sendChatNotifications] 音なし送信完了: 成功=${response.successCount}, 失敗=${response.failureCount}`);

      if (response.failureCount > 0) {
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            console.error(`❌ [sendChatNotifications] 音なし送信失敗 [${idx}]:`, resp.error);
          }
        });
      }
    }

  } catch (error) {
    console.error('❌ [sendChatNotifications] エラー:', error);
  }
}

/**
 * メンション通知のFCM送信（ミュート設定を無視）
 */
async function sendMentionNotifications(senderName, messageText, roomName, mentionedUsers) {
  console.log('📢 [sendMentionNotifications] 関数開始');
  try {
    if (mentionedUsers.length === 0) {
      console.log('⏭️ [sendMentionNotifications] 対象ユーザーなし、スキップ');
      return;
    }

    console.log(`📢 [sendMentionNotifications] FCM送信開始: ${mentionedUsers.length}人`);

    // 各ユーザーのトークンを取得（ミュートは無視）
    const tokensPromises = mentionedUsers.map(async (user) => {
      try {
        const { userName, userEmail } = user;
        console.log(`🔍 [sendMentionNotifications] トークン取得: ${userName} (${userEmail})`);

        const activeDeviceDoc = await db.collection('activeDevices').doc(userEmail).get();

        if (!activeDeviceDoc.exists) {
          console.log(`⚠️ [sendMentionNotifications] activeDevices未登録: ${userName}`);
          return [];
        }

        const data = activeDeviceDoc.data();

        // 通知が無効でもメンションは送信（重要な通知のため）
        // ただし、notificationEnabled が明示的に false の場合はスキップ
        if (data.notificationEnabled === false) {
          console.log(`🔕 [sendMentionNotifications] 通知完全無効: ${userName}（メンションもスキップ）`);
          return [];
        }

        const tokens = Array.isArray(data?.fcmTokens) ? data.fcmTokens.filter(Boolean) : [];

        if (tokens.length === 0) {
          console.log(`⚠️ [sendMentionNotifications] アクティブトークンなし: ${userName}`);
          return [];
        }

        console.log(`✅ [sendMentionNotifications] トークン取得成功: ${userName} (${tokens.length}件)`);
        return tokens;
      } catch (error) {
        console.error(`❌ [sendMentionNotifications] ユーザー${user.userName}のトークン取得エラー:`, error);
        return [];
      }
    });

    const results = await Promise.all(tokensPromises);
    const allTokens = results.flat();

    if (allTokens.length === 0) {
      console.log('⏭️ [sendMentionNotifications] 通知対象トークンなし、スキップ');
      return;
    }

    console.log(`📨 [sendMentionNotifications] 送信先トークン数: ${allTokens.length}`);

    // メンション専用の通知メッセージ
    const mentionMessage = {
      notification: {
        title: `📢 ${roomName}`,
        body: `${senderName}があなたをメンションしました`
      },
      data: {
        type: 'CHAT_MENTION',
        roomName: roomName,
        senderName: senderName,
        messageText: messageText
      },
      android: {
        notification: {
          sound: 'default',
          priority: 'high'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      },
      tokens: allTokens
    };

    const response = await messaging.sendEachForMulticast(mentionMessage);
    console.log(`✅ [sendMentionNotifications] 送信完了: 成功=${response.successCount}, 失敗=${response.failureCount}`);

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          console.error(`❌ [sendMentionNotifications] 送信失敗 [${idx}]:`, resp.error);
        }
      });
    }

  } catch (error) {
    console.error('❌ [sendMentionNotifications] エラー:', error);
  }
}

/**
 * デバイス登録時のユーザー自動作成
 * Firestoreトリガー: users/{userEmail}/devices/{deviceId} 作成時
 *
 * 目的: 新規デバイス登録時に、usersコレクションにユーザードキュメントを自動作成
 * これにより、手動でのユーザー登録作業が不要になる
 */
console.log('🔧 [onDeviceCreated] 関数初期化完了');

exports.onDeviceCreated = onDocumentCreated('users/{userEmail}/devices/{deviceId}', async (event) => {
  const userEmail = event.params.userEmail;
  const deviceId = event.params.deviceId;

  console.log('📱 [onDeviceCreated] デバイス登録検知:', { userEmail, deviceId });

  try {
    const deviceData = event.data.data();

    if (!deviceData) {
      console.error('❌ [onDeviceCreated] デバイスデータが空');
      return;
    }

    const { userName, permissionId, permissionDisplay } = deviceData;
    console.log('📋 [onDeviceCreated] デバイス情報:', { userName, permissionId, permissionDisplay });

    // usersコレクションのドキュメント参照
    const userDocRef = db.collection('users').doc(userEmail);
    const userDoc = await userDocRef.get();

    if (userDoc.exists) {
      console.log('✅ [onDeviceCreated] ユーザードキュメント既存、更新のみ実行');

      // 最終使用日時のみ更新
      await userDocRef.update({
        lastUsedAt: new Date(),
        userName: userName // ユーザー名が変更された場合に備えて更新
      });

      console.log('✅ [onDeviceCreated] ユーザー情報更新完了:', userEmail);
    } else {
      console.log('🆕 [onDeviceCreated] 新規ユーザー、ドキュメント作成');

      // 新規ユーザードキュメント作成
      const newUserData = {
        userName: userName,
        userEmail: userEmail,
        permissionId: permissionId,
        permissionDisplay: permissionDisplay,
        status: 'アクティブ', // チャットユーザー選択画面で表示されるために必要
        createdAt: new Date(),
        lastUsedAt: new Date()
      };

      await userDocRef.set(newUserData);

      console.log('✅ [onDeviceCreated] 新規ユーザー作成完了:', newUserData);
    }

  } catch (error) {
    console.error('❌ [onDeviceCreated] エラー:', error);
  }
});

// ========================================
// デバイス同期トリガー（通知高速化 - 方法2）
// ========================================
const deviceSync = require('./deviceSync');
exports.syncActiveDevices = deviceSync.syncActiveDevices;

// ========================================
// 🔧 手動同期エンドポイント（管理用）
// 全アクティブデバイスを activeDevices コレクションに同期
// ========================================
const {onRequest} = require('firebase-functions/v2/https');

exports.manualSyncActiveDevices = onRequest(
  { cors: true, region: 'us-central1' },
  async (req, res) => {
    console.log('🔄 [manualSyncActiveDevices] 手動同期開始');

    try {
      // 全ユーザーを取得
      const usersSnapshot = await db.collection('users').get();
      console.log(`📊 [manualSyncActiveDevices] ユーザー数: ${usersSnapshot.size}`);

      let totalSynced = 0;
      const results = [];

      for (const userDoc of usersSnapshot.docs) {
        const userEmail = userDoc.id;
        const userData = userDoc.data();

        // devicesサブコレクションからアクティブなデバイスを取得
        const devicesSnapshot = await db
          .collection('users')
          .doc(userEmail)
          .collection('devices')
          .where('active', '==', true)
          .get();

        if (devicesSnapshot.empty) {
          continue;
        }

        // FCMトークンを収集
        const fcmTokens = [];
        let userName = userData.userName || 'Unknown';

        devicesSnapshot.forEach(deviceDoc => {
          const deviceData = deviceDoc.data();
          if (deviceData.fcmToken) {
            fcmTokens.push(deviceData.fcmToken);
            if (deviceData.userName) {
              userName = deviceData.userName;
            }
          }
        });

        if (fcmTokens.length === 0) {
          continue;
        }

        // activeDevicesに同期
        await db.collection('activeDevices').doc(userEmail).set({
          fcmTokens: fcmTokens,
          userName: userName,
          lastUpdated: FieldValue.serverTimestamp(),
          syncedAt: new Date().toISOString()
        }, { merge: true });

        totalSynced++;
        results.push({
          email: userEmail,
          userName: userName,
          tokenCount: fcmTokens.length
        });

        console.log(`✅ [manualSyncActiveDevices] ${userName} (${userEmail}): ${fcmTokens.length} tokens`);
      }

      console.log(`✅ [manualSyncActiveDevices] 同期完了: ${totalSynced}ユーザー`);

      res.json({
        success: true,
        message: `${totalSynced}ユーザーを同期しました`,
        totalUsers: usersSnapshot.size,
        syncedUsers: totalSynced,
        results: results
      });

    } catch (error) {
      console.error('❌ [manualSyncActiveDevices] エラー:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);


// ============================================
// 🖼️ サムネイル自動生成
// ============================================

/**
 * 画像アップロード時にサムネイルを自動生成
 * Storage トリガー: 商品画像がアップロードされた時
 */
exports.generateThumbnail = onObjectFinalized({
  region: 'asia-northeast1',
  memory: '512MiB',
  timeoutSeconds: 120,
}, async (event) => {
  const filePath = event.data.name;
  const contentType = event.data.contentType;

  console.log('🖼️ [generateThumbnail] ファイル検知:', filePath);

  // 画像以外はスキップ
  if (!contentType || !contentType.startsWith('image/')) {
    console.log('⏭️ [generateThumbnail] 画像以外のためスキップ:', contentType);
    return null;
  }

  // 既にサムネイルの場合はスキップ（無限ループ防止）
  if (filePath.includes('_thumb_')) {
    console.log('⏭️ [generateThumbnail] サムネイルのためスキップ');
    return null;
  }

  // 商品画像フォルダ以外はスキップ（必要に応じて調整）
  if (!filePath.startsWith('products/') && !filePath.startsWith('images/')) {
    console.log('⏭️ [generateThumbnail] 対象フォルダ外のためスキップ:', filePath);
    return null;
  }

  try {
    const startTime = Date.now();

    // ファイル名とパスを解析
    const fileName = path.basename(filePath);
    const fileDir = path.dirname(filePath);
    const fileNameWithoutExt = path.parse(fileName).name;
    const fileExt = path.parse(fileName).ext;

    // サムネイルのファイル名
    const thumbFileName = `${fileNameWithoutExt}_thumb_200${fileExt}`;
    const thumbFilePath = `${fileDir}/thumbs/${thumbFileName}`;

    console.log('📂 [generateThumbnail] サムネイル生成開始:', {
      original: filePath,
      thumbnail: thumbFilePath
    });

    // 元画像をダウンロード
    const file = bucket.file(filePath);
    const [imageBuffer] = await file.download();

    // サムネイル生成（200x200、アスペクト比維持）
    const thumbnailBuffer = await sharp(imageBuffer)
      .resize(200, 200, {
        fit: 'cover',
        position: 'center'
      })
      .jpeg({ quality: 80 })
      .toBuffer();

    // サムネイルをアップロード
    const thumbFile = bucket.file(thumbFilePath);
    await thumbFile.save(thumbnailBuffer, {
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          originalPath: filePath,
          generatedAt: new Date().toISOString()
        }
      }
    });

    // サムネイルを公開
    await thumbFile.makePublic();

    // サムネイルのURLを取得
    const thumbUrl = `https://storage.googleapis.com/${bucket.name}/${thumbFilePath}`;

    const duration = Date.now() - startTime;
    console.log(`✅ [generateThumbnail] 完了: ${duration}ms`, {
      original: filePath,
      thumbnail: thumbUrl
    });

    return { success: true, thumbnailUrl: thumbUrl };

  } catch (error) {
    console.error('❌ [generateThumbnail] エラー:', error);
    return { success: false, error: error.message };
  }
});

// ============================================
// 💰 外注報酬自動記録システム
// ============================================

/**
 * タスク完了時の報酬自動記録
 * Firestoreトリガー: userTasks/{userEmail}/tasks/{taskId} 更新時
 *
 * 対象タスクタイプ:
 * - listing_approval: 出品確認タスク（担当者が出品 → 管理者が確認完了）
 * - shipping_task: 発送タスク（商品が売れた → 担当者が発送完了）
 */
exports.onTaskCompleted = onDocumentUpdated('userTasks/{userEmail}/tasks/{taskId}', async (event) => {
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  const userEmail = event.params.userEmail;
  const taskId = event.params.taskId;

  // 完了状態の変化をチェック（未完了→完了に変わった場合のみ処理）
  if (beforeData.completed === true || afterData.completed !== true) {
    return null; // 既に完了済み、または完了以外の更新は無視
  }

  console.log('💰 [onTaskCompleted] タスク完了検知:', {
    taskId,
    userEmail,
    taskType: afterData.type,
    title: afterData.title
  });

  // 報酬対象のタスクタイプをチェック
  const compensationTaskTypes = ['listing_approval', 'shipping_task'];
  if (!compensationTaskTypes.includes(afterData.type)) {
    console.log('⏭️ [onTaskCompleted] 報酬対象外のタスクタイプ:', afterData.type);
    return null;
  }

  try {
    // 報酬設定を取得
    const settingsDoc = await db.collection('settings').doc('compensation').get();
    const settings = settingsDoc.exists ? settingsDoc.data() : getDefaultCompensationSettings();

    // タスクタイプに応じた報酬額を決定
    let taskTypeKey = '';
    let unitPrice = 0;
    let description = '';

    if (afterData.type === 'listing_approval') {
      taskTypeKey = 'listing';
      unitPrice = settings.taskRates?.listing || 100;
      description = '出品作業報酬';
    } else if (afterData.type === 'shipping_task') {
      taskTypeKey = 'shipping';
      unitPrice = settings.taskRates?.shipping || 100;
      description = '梱包発送報酬';
    }

    // 担当スタッフ（タスクを実行した人ではなく、実際の作業者）を取得
    const staffEmail = afterData.relatedData?.staffEmail ||
                       afterData.relatedData?.assignedTo ||
                       afterData.relatedData?.createdByEmail ||
                       null;
    const staffName = afterData.relatedData?.staffName ||
                      afterData.relatedData?.assignedToName ||
                      afterData.relatedData?.createdBy ||
                      '不明';

    if (!staffEmail) {
      console.warn('⚠️ [onTaskCompleted] 担当スタッフのメールが不明:', afterData);
      return null;
    }

    // 報酬記録を作成
    const now = new Date();
    const compensationRecord = {
      taskId: taskId,
      taskType: afterData.type,
      taskTypeKey: taskTypeKey,
      staffEmail: staffEmail,
      staffName: staffName,
      unitPrice: unitPrice,
      description: description,
      productId: afterData.relatedData?.productId || null,
      managementNumber: afterData.relatedData?.managementNumber || null,
      completedAt: afterData.completedAt || now.toISOString(),
      recordedAt: now.toISOString(),
      yearMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      approvedBy: userEmail // タスクを完了させた管理者
    };

    // Firestoreに報酬記録を保存
    await db.collection('compensationRecords').add(compensationRecord);

    console.log('✅ [onTaskCompleted] 報酬記録完了:', {
      staffName,
      staffEmail,
      taskTypeKey,
      unitPrice,
      productId: compensationRecord.productId
    });

    return { success: true, compensation: compensationRecord };

  } catch (error) {
    console.error('❌ [onTaskCompleted] 報酬記録エラー:', error);
    return { success: false, error: error.message };
  }
});

/**
 * デフォルトの報酬設定
 */
function getDefaultCompensationSettings() {
  return {
    taskRates: {
      listing: 100,
      shipping: 100,
      photography: 50,
      inspection: 30
    },
    options: {
      autoRecordListing: true,
      autoRecordShipping: true,
      cutoffDay: '末日',
      recordAsExpense: true
    }
  };
}
