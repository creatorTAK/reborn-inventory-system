/**
 * 🔔 REBORN Inventory - Firebase Functions
 *
 * 商品登録時の即時通知システム
 * Firestoreトリガーで自動実行、100-200msで通知配信
 *
 * v2.1: 個別チャット通知高速化（memberEmails優先使用）
 * v2.2: activeDevices未登録時のフォールバック処理追加（個別チャット通知修正）
 */

const {onDocumentCreated, onDocumentUpdated} = require('firebase-functions/v2/firestore');
const {onObjectFinalized} = require('firebase-functions/v2/storage');
const {onSchedule} = require('firebase-functions/v2/scheduler');
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

    // 🔢 商品登録カウントダウン処理（仕入スロット連携）
    if (productData.purchaseSlotId) {
      console.log('🔢 [onProductCreated] 仕入スロット連携あり:', productData.purchaseSlotId);
      try {
        await updateRegistrationCountdown(productData.purchaseSlotId);
      } catch (countdownError) {
        console.error('❌ [onProductCreated] カウントダウン処理エラー:', countdownError);
        // カウントダウンエラーでも通知は継続
      }
    }

    // 📸 商品撮影報酬は listing_approval タスク承認時にカウント（onTaskCompleted）

  } catch (error) {
    console.error('❌ [onProductCreated] エラー:', error);
    // エラーでもFirestore保存は成功しているので、処理継続
  }
});

/**
 * 🔢 商品登録カウントダウン処理
 * purchaseSlotから仕入バッチを特定し、残数を減らす
 * 残数が0になったら商品登録タスクを自動完了
 */
async function updateRegistrationCountdown(purchaseSlotId) {
  console.log('🔢 [updateRegistrationCountdown] 開始:', purchaseSlotId);

  try {
    // 1. purchaseSlotsからbatchIdを取得
    const slotDoc = await db.collection('purchaseSlots').doc(purchaseSlotId).get();
    if (!slotDoc.exists) {
      console.warn('⚠️ [updateRegistrationCountdown] スロットが見つかりません:', purchaseSlotId);
      return;
    }

    const slotData = slotDoc.data();
    const batchId = slotData.batchId;
    if (!batchId) {
      console.warn('⚠️ [updateRegistrationCountdown] batchIdがありません:', purchaseSlotId);
      return;
    }

    console.log('🔢 [updateRegistrationCountdown] batchId:', batchId);

    // 2. purchaseBatchesのカウントを更新
    const batchRef = db.collection('purchaseBatches').doc(batchId);
    const batchDoc = await batchRef.get();
    if (!batchDoc.exists) {
      console.warn('⚠️ [updateRegistrationCountdown] バッチが見つかりません:', batchId);
      return;
    }

    const batchData = batchDoc.data();
    const currentRemaining = batchData.remainingCount || 0;
    const currentRegistered = batchData.registeredCount || 0;
    const totalCount = batchData.itemCount || 0;

    if (currentRemaining <= 0) {
      console.log('⚠️ [updateRegistrationCountdown] 残数が0以下、スキップ:', batchId);
      return;
    }

    const newRemaining = currentRemaining - 1;
    const newRegistered = currentRegistered + 1;

    console.log(`🔢 [updateRegistrationCountdown] カウント更新: ${currentRemaining} → ${newRemaining} (登録済み: ${newRegistered}/${totalCount})`);

    // 3. バッチデータ更新
    const batchUpdate = {
      remainingCount: newRemaining,
      registeredCount: newRegistered,
      updatedAt: new Date().toISOString()
    };

    // 4. 残数0の場合はステータスを完了に
    if (newRemaining === 0) {
      batchUpdate.status = 'completed';
      console.log('🎉 [updateRegistrationCountdown] 全商品登録完了!', batchId);
    }

    await batchRef.update(batchUpdate);

    // 5. 商品登録タスクのタイトルを更新（残数表示）
    const taskId = batchData.registrationTaskId;
    if (taskId) {
      const assigneeUserId = batchData.assigneeUserId;
      if (assigneeUserId) {
        const taskRef = db.collection('userTasks').doc(assigneeUserId).collection('tasks').doc(taskId);
        const taskDoc = await taskRef.get();

        if (taskDoc.exists) {
          const taskUpdate = {
            title: `商品登録（残り${newRemaining}点）`,
            'relatedData.remainingCount': newRemaining,
            'relatedData.registeredCount': newRegistered,
            updatedAt: new Date().toISOString()
          };

          // 残数0の場合はタスクを自動完了
          if (newRemaining === 0) {
            taskUpdate.completed = true;
            taskUpdate.completedAt = new Date().toISOString();
            taskUpdate.title = `商品登録完了（${totalCount}点）`;
            console.log('✅ [updateRegistrationCountdown] タスク自動完了:', taskId);
          }

          await taskRef.update(taskUpdate);
          console.log('✅ [updateRegistrationCountdown] タスク更新完了:', taskId);
        }
      }
    }

    console.log('✅ [updateRegistrationCountdown] 処理完了');

  } catch (error) {
    console.error('❌ [updateRegistrationCountdown] エラー:', error);
    throw error;
  }
}

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

    // 通話履歴メッセージはスキップ（通話終了時の記録）
    if (messageData.type === 'call') {
      console.log('⏭️ [onChatMessageCreated] 通話履歴メッセージ、スキップ');
      return;
    }

    const senderName = messageData.senderName || messageData.userName || '匿名';
    // メッセージタイプに応じた表示テキスト
    let messageText;
    if (messageData.type === 'voice') {
      messageText = '🎤 音声メッセージ';
    } else if (messageData.type === 'image') {
      messageText = '📷 画像';
    } else if (messageData.type === 'file') {
      messageText = '📎 ファイル';
    } else {
      messageText = messageData.text || '(メッセージ)';
    }
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
    // ただし、送信者をブロックしているユーザーの非表示設定は維持する（LINE風）
    if (roomData.hiddenBy && roomData.hiddenBy.length > 0) {
      console.log('👁️ [onChatMessageCreated] 非表示ユーザー確認:', roomData.hiddenBy);

      // ブロックチェック: 非表示にしているユーザーの中で、送信者をブロックしている人を特定
      const senderEmail = messageData.userEmail || null;
      let usersToKeepHidden = [];

      if (roomType === 'direct' && senderEmail) {
        // 個別チャットの場合、非表示ユーザーのブロック状態をチェック
        for (const hiddenUserName of roomData.hiddenBy) {
          // hiddenByにはユーザー名が入っている。メールアドレスを取得してブロックリストをチェック
          const hiddenUserEmail = roomData.memberEmails?.find(e => {
            // memberEmailsとmembersの順番が対応していると仮定
            const idx = roomData.memberEmails.indexOf(e);
            return roomData.members?.[idx] === hiddenUserName;
          });

          if (hiddenUserEmail) {
            const hiddenUserDoc = await db.collection('users').doc(hiddenUserEmail).get();
            if (hiddenUserDoc.exists) {
              const blockedList = hiddenUserDoc.data().blockedUsers || [];
              if (blockedList.includes(senderName) || blockedList.includes(senderEmail)) {
                console.log(`🚫 [onChatMessageCreated] ${hiddenUserName} は送信者をブロック中 → 非表示維持`);
                usersToKeepHidden.push(hiddenUserName);
              }
            }
          }
        }
      }

      // ブロックしていないユーザーの非表示のみ解除
      if (usersToKeepHidden.length > 0) {
        console.log('👁️ [onChatMessageCreated] 非表示維持ユーザー:', usersToKeepHidden);
        await roomRef.update({ hiddenBy: usersToKeepHidden });
      } else {
        await roomRef.update({ hiddenBy: [] });
      }
      console.log('✅ [onChatMessageCreated] hiddenBy 更新完了');
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

    // 🚫 ブロックチェック: 送信者をブロックしているユーザーには通知しない（LINE風）
    const senderEmail = messageData.userEmail || null;
    if (senderEmail && memberEmails.length > 0) {
      console.log('🚫 [onChatMessageCreated] ブロックチェック開始');
      const blockChecks = await Promise.all(
        memberEmails.map(async (user) => {
          try {
            const userDoc = await db.collection('users').doc(user.userEmail).get();
            if (userDoc.exists) {
              const userData = userDoc.data();
              const blockedUsers = userData.blockedUsers || [];
              // 送信者のユーザー名またはメールがブロックリストに含まれているかチェック
              const hasBlocked = blockedUsers.includes(senderName) || blockedUsers.includes(senderEmail);
              if (hasBlocked) {
                console.log(`🚫 [onChatMessageCreated] ${user.userName} が送信者 ${senderName} をブロック中 → 通知スキップ`);
              }
              return { ...user, hasBlocked };
            }
            return { ...user, hasBlocked: false };
          } catch (error) {
            console.error(`❌ [onChatMessageCreated] ブロックチェックエラー: ${user.userEmail}`, error);
            return { ...user, hasBlocked: false };
          }
        })
      );

      // ブロックしているユーザーを除外
      const beforeCount = memberEmails.length;
      memberEmails = blockChecks.filter(user => !user.hasBlocked);
      const blockedCount = beforeCount - memberEmails.length;
      if (blockedCount > 0) {
        console.log(`🚫 [onChatMessageCreated] ブロック除外: ${blockedCount}人を通知対象から除外`);
      }
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
 * 📞 通話着信時のプッシュ通知
 * rooms/{roomId}/calls/{callId} のドキュメント作成時にトリガー
 * 発信者以外のルームメンバーに着信通知を送信
 */
console.log('🔧 [onIncomingCall] 関数初期化完了');

exports.onIncomingCall = onDocumentCreated('rooms/{roomId}/calls/{callId}', async (event) => {
  const startTime = Date.now();
  const roomId = event.params.roomId;
  const callId = event.params.callId;

  console.log('📞 [onIncomingCall] 通話検知:', roomId, callId);

  try {
    const callData = event.data.data();

    if (!callData) {
      console.error('❌ [onIncomingCall] 通話データが空');
      return;
    }

    // status が 'calling' の場合のみ通知（着信時）
    if (callData.status !== 'calling') {
      console.log('⏭️ [onIncomingCall] ステータスが calling ではない:', callData.status);
      return;
    }

    const callerName = callData.callerName || '不明';
    const callerId = callData.callerId; // メールアドレス

    console.log('📞 [onIncomingCall] 発信者:', callerName, callerId);

    // ルーム情報を取得してメンバーを特定
    const roomRef = db.collection('rooms').doc(roomId);
    const roomSnap = await roomRef.get();

    if (!roomSnap.exists) {
      console.error('❌ [onIncomingCall] ルームが見つかりません:', roomId);
      return;
    }

    const roomData = roomSnap.data();
    const roomName = roomData.name || '通話';

    // memberEmails から発信者以外を取得
    let targetEmails = [];
    if (roomData.memberEmails && Array.isArray(roomData.memberEmails)) {
      targetEmails = roomData.memberEmails.filter(email => email !== callerId);
    }

    if (targetEmails.length === 0) {
      console.log('⏭️ [onIncomingCall] 通知対象なし');
      return;
    }

    console.log('📞 [onIncomingCall] 通知対象:', targetEmails);

    // 🎯 閲覧中ユーザーを通知対象から除外（通話画面を開いている場合は通知不要）
    const viewingUsers = await getViewingUsers(roomId);
    console.log('👀 [onIncomingCall] 閲覧中ユーザー:', viewingUsers);

    const filteredTargetEmails = targetEmails.filter(email => !viewingUsers.includes(email));
    console.log(`📞 [onIncomingCall] 閲覧中除外後: ${filteredTargetEmails.length}人 (${targetEmails.length - filteredTargetEmails.length}人除外)`);

    if (filteredTargetEmails.length === 0) {
      console.log('⏭️ [onIncomingCall] 全員閲覧中のため通知スキップ');
      return;
    }

    // 各ユーザーのFCMトークンを取得して通知送信
    const notificationPromises = filteredTargetEmails.map(async (userEmail) => {
      try {
        // activeDevices から取得
        const activeDeviceDoc = await db.collection('activeDevices').doc(userEmail).get();

        if (!activeDeviceDoc.exists) {
          console.log(`⚠️ [onIncomingCall] activeDevices なし: ${userEmail}`);
          return;
        }

        const deviceData = activeDeviceDoc.data();
        const tokens = Array.isArray(deviceData?.fcmTokens) ? deviceData.fcmTokens.filter(Boolean) : [];

        if (tokens.length === 0) {
          console.log(`⚠️ [onIncomingCall] FCMトークンなし: ${userEmail}`);
          return;
        }

        console.log(`📤 [onIncomingCall] 通知送信: ${userEmail} (${tokens.length}トークン)`);

        // プッシュ通知送信
        const message = {
          tokens: tokens,
          notification: {
            title: '着信',
            body: `${callerName}から通話があります`
          },
          data: {
            type: 'incoming_call',
            roomId: roomId,
            callId: callId,
            callerName: callerName,
            url: '/' // タップでアプリを開く
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1
              }
            }
          },
          android: {
            notification: {
              sound: 'default',
              priority: 'high',
              channelId: 'incoming_call'
            }
          }
        };

        const response = await messaging.sendEachForMulticast(message);
        console.log(`✅ [onIncomingCall] 送信結果: 成功${response.successCount} 失敗${response.failureCount}`);

      } catch (error) {
        console.error(`❌ [onIncomingCall] 通知送信エラー (${userEmail}):`, error);
      }
    });

    await Promise.allSettled(notificationPromises);

    const duration = Date.now() - startTime;
    console.log(`✅ [onIncomingCall] 完了: ${duration}ms`);

  } catch (error) {
    console.error('❌ [onIncomingCall] エラー:', error);
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
    const VIEWING_TIMEOUT_MS = 60 * 1000; // 1分（通知漏れ防止のため短縮）

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
    // v2.2: activeDevices未登録時は users/{email}/devices サブコレクションからフォールバック取得
    const tokensPromises = unmutedUsers.map(async (user) => {
      try {
        const { userName, userEmail } = user;
        console.log(`🔍 [sendChatNotifications] トークン取得: ${userName} (${userEmail})`);

        // activeDevices/{userEmail} から直接取得（高速化）
        const activeDeviceDoc = await db.collection('activeDevices').doc(userEmail).get();

        if (activeDeviceDoc.exists) {
          const data = activeDeviceDoc.data();

          // 🔧 通知が無効になっている場合はスキップ
          if (data.notificationEnabled === false) {
            console.log(`🔕 [sendChatNotifications] 通知無効: ${userName}`);
            return { tokens: [], soundEnabled: false };
          }

          const tokens = Array.isArray(data?.fcmTokens) ? data.fcmTokens.filter(Boolean) : [];

          if (tokens.length > 0) {
            console.log(`✅ [sendChatNotifications] activeDevicesから取得成功: ${userName} (${tokens.length}件)`);
            return {
              tokens: tokens,
              soundEnabled: data.notificationSound !== false
            };
          }
        }

        // 🔧 v2.2: activeDevices未登録またはトークンなしの場合、サブコレクションから取得
        console.log(`🔄 [sendChatNotifications] フォールバック: users/${userEmail}/devices を検索`);
        const devicesSnapshot = await db
          .collection('users')
          .doc(userEmail)
          .collection('devices')
          .where('active', '==', true)
          .get();

        if (devicesSnapshot.empty) {
          console.log(`⚠️ [sendChatNotifications] アクティブデバイスなし: ${userName}`);
          return { tokens: [], soundEnabled: true };
        }

        const fallbackTokens = [];
        devicesSnapshot.forEach(deviceDoc => {
          const deviceData = deviceDoc.data();
          if (deviceData.fcmToken) {
            fallbackTokens.push(deviceData.fcmToken);
          }
        });

        if (fallbackTokens.length === 0) {
          console.log(`⚠️ [sendChatNotifications] FCMトークンなし: ${userName}`);
          return { tokens: [], soundEnabled: true };
        }

        console.log(`✅ [sendChatNotifications] フォールバック成功: ${userName} (${fallbackTokens.length}件)`);
        return {
          tokens: fallbackTokens,
          soundEnabled: true // デフォルトtrue
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
    // v2.2: activeDevices未登録時は users/{email}/devices サブコレクションからフォールバック取得
    const tokensPromises = mentionedUsers.map(async (user) => {
      try {
        const { userName, userEmail } = user;
        console.log(`🔍 [sendMentionNotifications] トークン取得: ${userName} (${userEmail})`);

        const activeDeviceDoc = await db.collection('activeDevices').doc(userEmail).get();

        if (activeDeviceDoc.exists) {
          const data = activeDeviceDoc.data();

          // 通知が無効でもメンションは送信（重要な通知のため）
          // ただし、notificationEnabled が明示的に false の場合はスキップ
          if (data.notificationEnabled === false) {
            console.log(`🔕 [sendMentionNotifications] 通知完全無効: ${userName}（メンションもスキップ）`);
            return [];
          }

          const tokens = Array.isArray(data?.fcmTokens) ? data.fcmTokens.filter(Boolean) : [];

          if (tokens.length > 0) {
            console.log(`✅ [sendMentionNotifications] activeDevicesから取得成功: ${userName} (${tokens.length}件)`);
            return tokens;
          }
        }

        // 🔧 v2.2: activeDevices未登録またはトークンなしの場合、サブコレクションから取得
        console.log(`🔄 [sendMentionNotifications] フォールバック: users/${userEmail}/devices を検索`);
        const devicesSnapshot = await db
          .collection('users')
          .doc(userEmail)
          .collection('devices')
          .where('active', '==', true)
          .get();

        if (devicesSnapshot.empty) {
          console.log(`⚠️ [sendMentionNotifications] アクティブデバイスなし: ${userName}`);
          return [];
        }

        const fallbackTokens = [];
        devicesSnapshot.forEach(deviceDoc => {
          const deviceData = deviceDoc.data();
          if (deviceData.fcmToken) {
            fallbackTokens.push(deviceData.fcmToken);
          }
        });

        if (fallbackTokens.length === 0) {
          console.log(`⚠️ [sendMentionNotifications] FCMトークンなし: ${userName}`);
          return [];
        }

        console.log(`✅ [sendMentionNotifications] フォールバック成功: ${userName} (${fallbackTokens.length}件)`);
        return fallbackTokens;
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
  // type または taskType フィールドを確認
  const taskType = afterData.type || afterData.taskType;
  const compensationTaskTypes = ['listing_approval', 'shipping_task', 'inventory_action', 'inspection_task'];
  if (!compensationTaskTypes.includes(taskType)) {
    console.log('⏭️ [onTaskCompleted] 報酬対象外のタスクタイプ:', taskType);
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

    if (taskType === 'listing_approval') {
      taskTypeKey = 'listing';
      unitPrice = settings.taskRates?.listing || 100;
      description = '出品作業報酬';
    } else if (taskType === 'shipping_task') {
      taskTypeKey = 'shipping';
      unitPrice = settings.taskRates?.shipping || 100;
      description = '梱包発送報酬';
    } else if (taskType === 'inventory_action') {
      taskTypeKey = 'editing';
      // タスクに設定された報酬額を優先、なければ設定から取得
      unitPrice = afterData.compensation || settings.taskRates?.editing || 50;
      description = '追加編集報酬';
    } else if (taskType === 'inspection_task') {
      taskTypeKey = 'inspection';
      unitPrice = settings.taskRates?.inspection || 30;
      // 検品点数を取得（registeredCount または expectedCount）
      const inspectionItemCount = afterData.registeredCount || afterData.expectedCount || afterData.relatedData?.itemCount || 1;
      description = `検品作業報酬 (${inspectionItemCount}点)`;
    }

    // 担当スタッフ（タスクを実行した人ではなく、実際の作業者）を取得
    // inventory_action / inspection_task タスクの場合は userEmail（タスク担当者）を使用
    let staffEmail = null;
    let staffName = '不明';

    if (taskType === 'inventory_action' || taskType === 'inspection_task') {
      // タスク担当者が作業者
      staffEmail = userEmail;
      // ユーザー情報を取得
      const userDoc = await db.collection('users').doc(userEmail).get();
      if (userDoc.exists) {
        staffName = userDoc.data().userName || userDoc.data().displayName || userEmail.split('@')[0];
      }
    } else {
      staffEmail = afterData.relatedData?.staffEmail ||
                   afterData.relatedData?.assignedTo ||
                   afterData.relatedData?.createdByEmail ||
                   null;
      staffName = afterData.relatedData?.staffName ||
                  afterData.relatedData?.assignedToName ||
                  afterData.relatedData?.createdBy ||
                  '不明';
    }

    if (!staffEmail) {
      console.warn('⚠️ [onTaskCompleted] 担当スタッフのメールが不明:', afterData);
      return null;
    }

    // 報酬カウント対象外フラグをチェック
    const staffUserDoc = await db.collection('users').doc(staffEmail).get();
    if (staffUserDoc.exists && staffUserDoc.data().excludeFromCompensation === true) {
      console.log('⏭️ [onTaskCompleted] 報酬カウント対象外ユーザー:', staffEmail);
      // 報酬はスキップするが、検品ステータス更新は実行する
      if (taskType === 'inspection_task') {
        try {
          // 新フロー: inspectionRequestId がある場合
          const inspectionRequestId = afterData.inspectionRequestId;
          if (inspectionRequestId) {
            await db.collection('inspectionRequests').doc(inspectionRequestId).update({
              status: 'completed',
              completedAt: new Date().toISOString()
            });
            console.log('✅ [onTaskCompleted] 検品依頼ステータス更新完了（報酬なし）:', inspectionRequestId);
          }

          // 旧フロー: batchId がある場合
          const batchId = afterData.relatedData?.batchId;
          if (batchId) {
            await db.collection('purchaseBatches').doc(batchId).update({
              inspectionStatus: 'completed',
              inspectionCompletedAt: new Date().toISOString()
            });
            console.log('✅ [onTaskCompleted] 検品ステータス更新完了（報酬なし）:', batchId);
          }
        } catch (batchError) {
          console.error('⚠️ [onTaskCompleted] 検品ステータス更新エラー:', batchError);
        }
      }
      return { success: true, skipped: true, reason: 'excludeFromCompensation' };
    }

    // 報酬記録を作成
    const now = new Date();

    // 検品タスクの場合は点数ベースで報酬を計算
    let itemCount = 1;
    let totalAmount = unitPrice;
    if (taskType === 'inspection_task') {
      itemCount = afterData.registeredCount || afterData.expectedCount || afterData.relatedData?.itemCount || 1;
      totalAmount = unitPrice * itemCount;
    }

    const compensationRecord = {
      taskId: taskId,
      taskType: taskType,
      taskTypeKey: taskTypeKey,
      staffEmail: staffEmail,
      staffName: staffName,
      unitPrice: unitPrice,
      itemCount: itemCount,
      totalAmount: totalAmount,
      description: description,
      // inventory_action の場合は直接フィールドを参照
      productId: afterData.productId || afterData.relatedData?.productId || null,
      managementNumber: afterData.managementNumber || afterData.relatedData?.managementNumber || null,
      inspectionRequestId: afterData.inspectionRequestId || null,
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

    // 📸 listing_approval の場合、商品に画像があれば撮影報酬も記録
    if (taskType === 'listing_approval' && compensationRecord.productId) {
      try {
        const productDoc = await db.collection('products').doc(compensationRecord.productId).get();
        if (productDoc.exists) {
          const productData = productDoc.data();
          const imageUrls = productData.images?.imageUrls || [];

          if (imageUrls.length > 0) {
            const photographyUnitPrice = settings.taskRates?.photography || 50;
            const photographyRecord = {
              taskId: taskId,
              taskType: 'listing_approval_photography',
              taskTypeKey: 'photography',
              staffEmail: staffEmail,
              staffName: staffName,
              unitPrice: photographyUnitPrice,
              description: '商品撮影報酬',
              productId: compensationRecord.productId,
              managementNumber: compensationRecord.managementNumber,
              imageCount: imageUrls.length,
              completedAt: afterData.completedAt || now.toISOString(),
              recordedAt: now.toISOString(),
              yearMonth: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
              approvedBy: userEmail
            };

            await db.collection('compensationRecords').add(photographyRecord);
            console.log('✅ [onTaskCompleted] 撮影報酬も記録:', {
              staffName,
              photographyUnitPrice,
              imageCount: imageUrls.length
            });
          }
        }
      } catch (photoError) {
        console.error('⚠️ [onTaskCompleted] 撮影報酬記録エラー（継続）:', photoError);
        // 撮影報酬のエラーは致命的ではないので継続
      }
    }

    // 🔍 検品タスク完了時の処理
    if (taskType === 'inspection_task') {
      try {
        // 新フロー: inspectionRequestId がある場合
        const inspectionRequestId = afterData.inspectionRequestId;
        if (inspectionRequestId) {
          await db.collection('inspectionRequests').doc(inspectionRequestId).update({
            status: 'completed',
            completedAt: new Date().toISOString()
          });
          console.log('✅ [onTaskCompleted] 検品依頼ステータス更新完了:', inspectionRequestId);
        }

        // 旧フロー: batchId がある場合（後方互換性）
        const batchId = afterData.relatedData?.batchId;
        if (batchId) {
          await db.collection('purchaseBatches').doc(batchId).update({
            inspectionStatus: 'completed',
            inspectionCompletedAt: new Date().toISOString()
          });
          console.log('✅ [onTaskCompleted] 検品ステータス更新完了:', batchId);
        }

        if (!inspectionRequestId && !batchId) {
          console.warn('⚠️ [onTaskCompleted] 検品タスクにinspectionRequestIdもbatchIdもありません');
        }
      } catch (batchError) {
        console.error('⚠️ [onTaskCompleted] 検品ステータス更新エラー（継続）:', batchError);
        // ステータス更新エラーは致命的ではないので継続
      }
    }

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

// ============================================
// 📧 Resendメール送信ヘルパー
// ============================================

/**
 * Cloudflare Worker経由でメールを送信（Resend API使用）
 * @param {string} to - 送信先メールアドレス
 * @param {string} subject - 件名
 * @param {string} textBody - テキスト本文
 * @param {string} htmlBody - HTML本文
 */
async function sendEmailViaCloudflare(to, subject, textBody, htmlBody) {
  const CLOUDFLARE_WORKER_URL = 'https://reborn-fcm-worker.mercari-yasuhirotakuji.workers.dev/send-email';

  try {
    const response = await fetch(CLOUDFLARE_WORKER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: to,
        subject: subject,
        text: textBody,
        html: htmlBody
      }),
    });

    const result = await response.json();

    if (response.ok && result.success) {
      console.log(`📧 [sendEmailViaCloudflare] 送信成功: ${to}`);
      return { success: true, messageId: result.id };
    } else {
      console.error(`📧 [sendEmailViaCloudflare] 送信失敗: ${to}`, result);
      return { success: false, error: result.error || 'Unknown error' };
    }
  } catch (error) {
    console.error(`📧 [sendEmailViaCloudflare] 例外: ${to}`, error);
    return { success: false, error: error.message };
  }
}

/**
 * タスクリマインダー用のHTMLメールを生成
 * @param {string} userName - ユーザー名
 * @param {Array} notifications - 通知一覧
 */
function generateReminderEmailHtml(userName, notifications) {
  const urgentTasks = notifications.filter(n => n.type === 'urgent_reminder');
  const normalTasks = notifications.filter(n => n.type === 'reminder');

  const taskListHtml = notifications.map(n => {
    const bgColor = n.type === 'urgent_reminder' ? '#fef2f2' : '#f9fafb';
    const borderColor = n.type === 'urgent_reminder' ? '#ef4444' : '#e5e7eb';
    return `
      <div style="background: ${bgColor}; border-left: 3px solid ${borderColor}; padding: 12px 16px; margin-bottom: 8px; border-radius: 4px;">
        <div style="font-weight: 600; color: #374151;">${escapeHtml(n.title)}</div>
        <div style="color: #6b7280; font-size: 14px; margin-top: 4px;">${escapeHtml(n.content)}</div>
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #40B4E5, #1E8FBF); color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 24px; font-weight: bold;">📋 タスクリマインダー</h1>
      <p style="margin: 8px 0 0 0; font-size: 14px; opacity: 0.9;">フリラ物販管理システム</p>
    </div>
    <div style="background: #fff; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
      <p style="margin: 0 0 16px 0; font-size: 16px;">
        ${escapeHtml(userName)}さん、おはようございます。
      </p>
      <p style="margin: 0 0 20px 0; color: #6b7280;">
        ${urgentTasks.length > 0 ? `<span style="color: #ef4444; font-weight: 600;">⚠️ 緊急対応が必要なタスクが${urgentTasks.length}件あります。</span><br>` : ''}
        未完了のタスクが${notifications.length}件あります。ご確認ください。
      </p>

      <div style="margin-bottom: 24px;">
        ${taskListHtml}
      </div>

      <div style="text-align: center; margin-top: 24px;">
        <a href="https://furira.jp" style="display: inline-block; background: #40B4E5; color: white; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          フリラを開く
        </a>
      </div>
    </div>
    <div style="background: #f9fafb; padding: 16px; text-align: center; font-size: 12px; color: #9ca3af; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb; border-top: none;">
      <p style="margin: 0;">このメールは <a href="https://furira.jp" style="color: #40B4E5;">フリラ物販管理システム</a> から自動送信されています。</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * HTMLエスケープ（メール用）
 */
function escapeHtml(text) {
  if (!text) return '';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, m => map[m]);
}

// ============================================
// 🔔 自動リマインダー（毎日9時実行）
// ============================================

/**
 * 自動リマインダー関数
 * 毎日朝9時（JST）に実行
 * - 発送タスク: 期限24時間前、期限当日/超過で通知
 * - 通常タスク: 3日以上放置で通知
 */
exports.dailyTaskReminder = onSchedule({
  schedule: '0 0 * * *', // UTC 0:00 = JST 9:00
  timeZone: 'Asia/Tokyo',
  region: 'asia-northeast1'
}, async (event) => {
  console.log('🔔 [dailyTaskReminder] 自動リマインダー開始');
  const startTime = Date.now();

  try {
    // 全ユーザーを取得
    const usersSnapshot = await db.collection('users').get();
    console.log(`👥 [dailyTaskReminder] ユーザー数: ${usersSnapshot.size}`);

    const now = new Date();
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);

    let totalNotifications = 0;

    for (const userDoc of usersSnapshot.docs) {
      const userEmail = userDoc.id;
      const userData = userDoc.data();

      // ユーザーのタスクを取得
      const tasksSnapshot = await db.collection('userTasks')
        .doc(userEmail)
        .collection('tasks')
        .where('completed', '==', false)
        .get();

      if (tasksSnapshot.empty) continue;

      const notifications = [];

      for (const taskDoc of tasksSnapshot.docs) {
        const task = taskDoc.data();
        const taskId = taskDoc.id;

        // 既にリマインダー送信済みかチェック（同じ日に複数送信しない）
        const lastReminder = task.lastReminderSent?.toDate?.() || null;
        if (lastReminder) {
          const lastReminderDate = lastReminder.toDateString();
          const todayDate = now.toDateString();
          if (lastReminderDate === todayDate) {
            continue; // 今日既に送信済み
          }
        }

        let shouldNotify = false;
        let notificationTitle = '';
        let notificationContent = '';
        let notificationType = 'reminder';

        if (task.dueDate) {
          // 発送タスク等（dueDateあり）
          const dueDate = task.dueDate.toDate ? task.dueDate.toDate() : new Date(task.dueDate);

          if (dueDate < now) {
            // 期限切れ
            const overdueDays = Math.ceil((now - dueDate) / (1000 * 60 * 60 * 24));
            shouldNotify = true;
            notificationTitle = '🚨 発送期限を過ぎています';
            notificationContent = `「${task.title}」の期限を${overdueDays}日超過しています。至急対応してください。`;
            notificationType = 'urgent_reminder';
          } else if (dueDate <= tomorrow) {
            // 明日が期限 or 今日が期限
            const hoursLeft = Math.ceil((dueDate - now) / (1000 * 60 * 60));
            if (hoursLeft <= 24) {
              shouldNotify = true;
              notificationTitle = '⏰ 本日が発送期限です';
              notificationContent = `「${task.title}」の期限が本日です。お早めに対応してください。`;
              notificationType = 'urgent_reminder';
            } else {
              shouldNotify = true;
              notificationTitle = '📅 明日が発送期限です';
              notificationContent = `「${task.title}」の期限が明日です。準備をお願いします。`;
              notificationType = 'reminder';
            }
          }
        } else if (task.createdAt) {
          // 通常タスク（3日以上放置）
          const createdDate = task.createdAt.toDate ? task.createdAt.toDate() : new Date(task.createdAt);
          if (createdDate < threeDaysAgo) {
            const daysPassed = Math.ceil((now - createdDate) / (1000 * 60 * 60 * 24));
            shouldNotify = true;
            notificationTitle = '📋 未完了タスクがあります';
            notificationContent = `「${task.title}」が${daysPassed}日間未完了です。確認をお願いします。`;
            notificationType = 'reminder';
          }
        }

        if (shouldNotify) {
          notifications.push({
            taskId,
            title: notificationTitle,
            content: notificationContent,
            type: notificationType
          });
        }
      }

      // 通知を送信
      if (notifications.length > 0) {
        const batch = db.batch();

        for (const notification of notifications) {
          // userAnnouncementsに通知追加
          const announcementRef = db.collection('users')
            .doc(userEmail)
            .collection('userAnnouncements')
            .doc();

          batch.set(announcementRef, {
            title: notification.title,
            content: notification.content,
            createdAt: FieldValue.serverTimestamp(),
            read: false,
            type: notification.type
          });

          // タスクのlastReminderSentを更新
          const taskRef = db.collection('userTasks')
            .doc(userEmail)
            .collection('tasks')
            .doc(notification.taskId);

          batch.update(taskRef, {
            lastReminderSent: FieldValue.serverTimestamp()
          });

          totalNotifications++;
        }

        await batch.commit();

        // 📧 Cloudflare Worker経由でメール送信
        const userName = userData.userName || userData.displayName || userEmail.split('@')[0];
        const urgentCount = notifications.filter(n => n.type === 'urgent_reminder').length;
        const subject = urgentCount > 0
          ? `🚨 【緊急】未完了タスクが${notifications.length}件あります`
          : `📋 未完了タスクが${notifications.length}件あります`;

        const textBody = notifications.map(n => `${n.title}\n${n.content}`).join('\n\n');
        const htmlBody = generateReminderEmailHtml(userName, notifications);

        const emailResult = await sendEmailViaCloudflare(
          userEmail,
          subject,
          textBody,
          htmlBody
        );

        if (emailResult.success) {
          console.log(`📧 [dailyTaskReminder] ${userName}: メール送信成功`);
        } else {
          console.warn(`📧 [dailyTaskReminder] ${userName}: メール送信失敗 - ${emailResult.error}`);
        }

        console.log(`📧 [dailyTaskReminder] ${userName}: ${notifications.length}件の通知送信`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [dailyTaskReminder] 完了: ${totalNotifications}件の通知送信 (${duration}ms)`);

    return { success: true, notificationsSent: totalNotifications };

  } catch (error) {
    console.error('❌ [dailyTaskReminder] エラー:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 滞留商品チェック（毎日9時実行）
 * - 出品中の商品をチェック
 * - 14日以上: 警告タスク作成
 * - 30日以上: 対策タスク作成（報酬付き）
 */
exports.dailyInventoryAgingCheck = onSchedule({
  schedule: '0 0 * * *', // UTC 0:00 = JST 9:00
  timeZone: 'Asia/Tokyo',
  region: 'asia-northeast1'
}, async (event) => {
  console.log('📦 [dailyInventoryAgingCheck] 滞留商品チェック開始');
  const startTime = Date.now();

  try {
    // 滞留設定を取得（閾値やタスク担当者設定）
    const agingSettingsDoc = await db.collection('settings').doc('inventoryAging').get();
    const agingSettings = agingSettingsDoc.exists ? agingSettingsDoc.data() : {};

    // 報酬設定を取得
    const compensationSettingsDoc = await db.collection('settings').doc('compensation').get();
    const compensationSettings = compensationSettingsDoc.exists ? compensationSettingsDoc.data() : {};

    // デフォルト設定
    const warningDays = agingSettings.warningDays || 14;
    const actionDays = agingSettings.actionDays || 30;
    const assigneeType = agingSettings.assigneeType || 'registrant'; // 'registrant' or 'fixed'
    const fixedAssignee = agingSettings.fixedAssignee || null;
    // 報酬額は報酬設定から取得
    const compensationAmount = compensationSettings.taskRates?.editing || 50;

    console.log(`📋 [設定] 警告: ${warningDays}日, 対策: ${actionDays}日, 担当: ${assigneeType}, 報酬: ¥${compensationAmount}`);

    // 出品中の商品を取得
    const productsSnapshot = await db.collection('products')
      .where('status', '==', '出品中')
      .get();

    console.log(`📦 [dailyInventoryAgingCheck] 出品中商品数: ${productsSnapshot.size}`);

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    let warningTasksCreated = 0;
    let actionTasksCreated = 0;

    // 通知対象ユーザーを収集（ユーザーごとのアラート数を集計）
    const userAlerts = {}; // { email: { actionCount: 0, warningCount: 0, userName: '' } }

    for (const productDoc of productsSnapshot.docs) {
      const product = productDoc.data();
      const productId = productDoc.id;

      // 出品日を取得
      let listingDate = null;
      if (product.listingDate) {
        listingDate = product.listingDate.toDate ? product.listingDate.toDate() : new Date(product.listingDate);
      } else if (product.listingStartDate) {
        listingDate = product.listingStartDate.toDate ? product.listingStartDate.toDate() : new Date(product.listingStartDate);
      } else if (product.createdAt) {
        listingDate = product.createdAt.toDate ? product.createdAt.toDate() : new Date(product.createdAt);
      }

      if (!listingDate || isNaN(listingDate.getTime())) {
        console.log(`⏭️ [${product.managementNumber}] 出品日不明 - スキップ`);
        continue;
      }

      listingDate.setHours(0, 0, 0, 0);
      const diffTime = now - listingDate;
      const agingDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // タスク担当者を決定
      let assigneeEmail = null;
      if (assigneeType === 'fixed' && fixedAssignee) {
        assigneeEmail = fixedAssignee;
      } else {
        // 商品登録者を担当者にする
        assigneeEmail = product.userEmail || product.registrantEmail || null;
      }

      if (!assigneeEmail) {
        console.log(`⏭️ [${product.managementNumber}] 担当者不明 - スキップ`);
        continue;
      }

      // 既存タスクをチェック（重複作成防止）
      const existingTasksSnapshot = await db.collection('userTasks')
        .doc(assigneeEmail)
        .collection('tasks')
        .where('productId', '==', productId)
        .where('taskType', 'in', ['inventory_warning', 'inventory_action'])
        .where('completed', '==', false)
        .get();

      const existingWarning = existingTasksSnapshot.docs.find(d => d.data().taskType === 'inventory_warning');
      const existingAction = existingTasksSnapshot.docs.find(d => d.data().taskType === 'inventory_action');

      // 30日以上: 対策タスク
      if (agingDays >= actionDays && !existingAction) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 3); // 3日以内に対応

        await db.collection('userTasks')
          .doc(assigneeEmail)
          .collection('tasks')
          .add({
            title: `【要対策】${product.productName || product.managementNumber} - ${agingDays}日滞留`,
            taskType: 'inventory_action',
            productId: productId,
            managementNumber: product.managementNumber,
            productName: product.productName || '',
            agingDays: agingDays,
            completed: false,
            createdAt: FieldValue.serverTimestamp(),
            dueDate: dueDate,
            compensation: compensationAmount,
            compensationType: 'editing',
            priority: 'high'
          });

        actionTasksCreated++;
        console.log(`🔴 [${product.managementNumber}] 対策タスク作成 (${agingDays}日)`);

        // 通知対象に追加
        if (!userAlerts[assigneeEmail]) {
          // ユーザー名を取得
          const userDoc = await db.collection('users').doc(assigneeEmail).get();
          const userName = userDoc.exists ? (userDoc.data().displayName || userDoc.data().name || assigneeEmail.split('@')[0]) : assigneeEmail.split('@')[0];
          userAlerts[assigneeEmail] = { actionCount: 0, warningCount: 0, userName };
        }
        userAlerts[assigneeEmail].actionCount++;

        // 警告タスクがあれば完了にする
        if (existingWarning) {
          await db.collection('userTasks')
            .doc(assigneeEmail)
            .collection('tasks')
            .doc(existingWarning.id)
            .update({
              completed: true,
              completedAt: FieldValue.serverTimestamp(),
              completedReason: '対策タスクに昇格'
            });
        }
      }
      // 14日以上30日未満: 警告タスク
      else if (agingDays >= warningDays && agingDays < actionDays && !existingWarning) {
        await db.collection('userTasks')
          .doc(assigneeEmail)
          .collection('tasks')
          .add({
            title: `【要確認】${product.productName || product.managementNumber} - ${agingDays}日滞留`,
            taskType: 'inventory_warning',
            productId: productId,
            managementNumber: product.managementNumber,
            productName: product.productName || '',
            agingDays: agingDays,
            completed: false,
            createdAt: FieldValue.serverTimestamp(),
            dueDate: null, // 警告は期限なし
            compensation: 0,
            priority: 'medium'
          });

        warningTasksCreated++;
        console.log(`🟡 [${product.managementNumber}] 警告タスク作成 (${agingDays}日)`);

        // 通知対象に追加
        if (!userAlerts[assigneeEmail]) {
          const userDoc = await db.collection('users').doc(assigneeEmail).get();
          const userName = userDoc.exists ? (userDoc.data().displayName || userDoc.data().name || assigneeEmail.split('@')[0]) : assigneeEmail.split('@')[0];
          userAlerts[assigneeEmail] = { actionCount: 0, warningCount: 0, userName };
        }
        userAlerts[assigneeEmail].warningCount++;
      }
    }

    // 📢 プッシュ通知を送信（アラートがあるユーザーのみ）
    const usersToNotify = Object.entries(userAlerts).filter(([_, data]) => data.actionCount > 0 || data.warningCount > 0);

    if (usersToNotify.length > 0) {
      console.log(`🔔 [dailyInventoryAgingCheck] 通知送信開始: ${usersToNotify.length}人`);

      for (const [userEmail, alertData] of usersToNotify) {
        try {
          // ユーザーのデバイストークンを取得
          const devicesSnapshot = await db.collection('users').doc(userEmail).collection('devices')
            .where('active', '==', true)
            .get();

          if (devicesSnapshot.empty) {
            console.log(`⏭️ [${userEmail}] アクティブデバイスなし - スキップ`);
            continue;
          }

          // 通知内容を作成
          let title = '📦 滞留在庫アラート';
          let body = '';

          if (alertData.actionCount > 0 && alertData.warningCount > 0) {
            body = `要対策: ${alertData.actionCount}件、要確認: ${alertData.warningCount}件の滞留商品があります`;
          } else if (alertData.actionCount > 0) {
            body = `${alertData.actionCount}件の商品が30日以上滞留しています。値下げ等の対策をご検討ください`;
          } else {
            body = `${alertData.warningCount}件の商品が14日以上滞留しています`;
          }

          // FCM送信
          const tokens = [];
          devicesSnapshot.forEach(doc => {
            const token = doc.data().fcmToken;
            if (token) tokens.push(token);
          });

          if (tokens.length > 0) {
            const message = {
              notification: { title, body },
              data: {
                type: 'inventory_aging',
                actionCount: String(alertData.actionCount),
                warningCount: String(alertData.warningCount),
                url: '/todo_list.html'
              },
              tokens: tokens
            };

            const response = await messaging.sendEachForMulticast(message);
            console.log(`✅ [${userEmail}] 通知送信: 成功${response.successCount}件, 失敗${response.failureCount}件`);
          }
        } catch (notifyError) {
          console.error(`❌ [${userEmail}] 通知送信エラー:`, notifyError.message);
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [dailyInventoryAgingCheck] 完了: 警告${warningTasksCreated}件, 対策${actionTasksCreated}件, 通知${usersToNotify.length}件 (${duration}ms)`);

    return {
      success: true,
      warningTasksCreated,
      actionTasksCreated,
      notificationsSent: usersToNotify.length
    };

  } catch (error) {
    console.error('❌ [dailyInventoryAgingCheck] エラー:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 商品更新時の滞留タスク自動完了
 * - ステータス変更（出品中 → 他）
 * - 価格変更
 * - 説明変更
 * の場合、滞留タスクを自動完了
 */
exports.onProductUpdatedForAgingTask = onDocumentUpdated('products/{productId}', async (event) => {
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();
  const productId = event.params.productId;

  // 変更検知
  const statusChanged = beforeData.status !== afterData.status;
  const priceChanged = beforeData.listingAmount !== afterData.listingAmount;
  const descriptionChanged = beforeData.description !== afterData.description;
  const wasListed = beforeData.status === '出品中';

  // 出品中でなかった場合はスキップ
  if (!wasListed) {
    return null;
  }

  // 何か対策を講じた場合
  const actionTaken = statusChanged || priceChanged || descriptionChanged;

  if (!actionTaken) {
    return null;
  }

  console.log(`📦 [onProductUpdatedForAgingTask] 商品更新検知: ${afterData.managementNumber}`);
  console.log(`  - ステータス変更: ${statusChanged}`);
  console.log(`  - 価格変更: ${priceChanged}`);
  console.log(`  - 説明変更: ${descriptionChanged}`);

  try {
    // 担当者を特定
    const assigneeEmail = afterData.userEmail || afterData.registrantEmail;
    if (!assigneeEmail) {
      console.log(`⏭️ [${afterData.managementNumber}] 担当者不明 - スキップ`);
      return null;
    }

    // この商品の未完了滞留タスクを検索
    const tasksSnapshot = await db.collection('userTasks')
      .doc(assigneeEmail)
      .collection('tasks')
      .where('productId', '==', productId)
      .where('taskType', 'in', ['inventory_warning', 'inventory_action'])
      .where('completed', '==', false)
      .get();

    if (tasksSnapshot.empty) {
      console.log(`📝 [${afterData.managementNumber}] 未完了の滞留タスクなし`);
      return null;
    }

    const batch = db.batch();
    let completedCount = 0;

    for (const taskDoc of tasksSnapshot.docs) {
      const taskData = taskDoc.data();
      let completedReason = '';

      if (statusChanged) {
        completedReason = `ステータス変更: ${beforeData.status} → ${afterData.status}`;
      } else if (priceChanged) {
        completedReason = `価格変更: ¥${beforeData.listingAmount} → ¥${afterData.listingAmount}`;
      } else if (descriptionChanged) {
        completedReason = '商品説明を更新';
      }

      batch.update(taskDoc.ref, {
        completed: true,
        completedAt: FieldValue.serverTimestamp(),
        completedReason: completedReason,
        completedBy: 'auto' // 自動完了
      });

      completedCount++;
      console.log(`✅ [${afterData.managementNumber}] タスク自動完了: ${taskData.taskType} - ${completedReason}`);
    }

    await batch.commit();
    console.log(`📦 [onProductUpdatedForAgingTask] ${completedCount}件のタスクを自動完了`);

    return { success: true, completedCount };

  } catch (error) {
    console.error('❌ [onProductUpdatedForAgingTask] エラー:', error);
    return { success: false, error: error.message };
  }
});

/**
 * 📅 報酬支払日通知
 * 毎日朝9時（JST）に実行
 * 支払日に該当する場合、該当ユーザーにプッシュ通知を送信
 */
exports.paymentDayNotification = onSchedule({
  schedule: '0 0 * * *', // UTC 0:00 = JST 9:00
  timeZone: 'Asia/Tokyo',
  region: 'asia-northeast1'
}, async (event) => {
  console.log('💰 [paymentDayNotification] 支払日通知チェック開始');
  const startTime = Date.now();

  try {
    // 報酬設定を取得
    const settingsDoc = await db.collection('settings').doc('compensation').get();
    if (!settingsDoc.exists) {
      console.log('⏭️ [paymentDayNotification] 報酬設定が見つかりません');
      return { success: false, reason: 'no_settings' };
    }

    const settings = settingsDoc.data();
    const paymentDaySetting = settings.options?.paymentDay || '翌月5日';
    const cutoffDay = settings.options?.cutoffDay || '末日';

    console.log(`📋 [paymentDayNotification] 設定: 支払日=${paymentDaySetting}, 締日=${cutoffDay}`);

    // 今日が支払日かチェック
    const today = new Date();
    const todayDate = today.getDate();
    const todayMonth = today.getMonth();
    const todayYear = today.getFullYear();

    let isPaymentDay = false;
    let paymentDayNumber = 0;

    // 支払日の日付を取得
    if (paymentDaySetting === '翌月末日') {
      // 月末日（今月の最終日）
      const lastDay = new Date(todayYear, todayMonth + 1, 0).getDate();
      isPaymentDay = (todayDate === lastDay);
      paymentDayNumber = lastDay;
    } else {
      // 翌月X日の場合
      const match = paymentDaySetting.match(/翌月(\d+)日/);
      if (match) {
        paymentDayNumber = parseInt(match[1], 10);
        isPaymentDay = (todayDate === paymentDayNumber);
      }
    }

    console.log(`📅 [paymentDayNotification] 今日=${todayDate}日, 支払日=${paymentDayNumber}日, 該当=${isPaymentDay}`);

    if (!isPaymentDay) {
      console.log('⏭️ [paymentDayNotification] 今日は支払日ではありません');
      return { success: true, isPaymentDay: false };
    }

    // 対象期間を計算（前月の締め日基準）
    let periodStart, periodEnd;

    // 締め日の計算
    const prevMonth = todayMonth === 0 ? 11 : todayMonth - 1;
    const prevMonthYear = todayMonth === 0 ? todayYear - 1 : todayYear;
    const twoMonthsAgo = prevMonth === 0 ? 11 : prevMonth - 1;
    const twoMonthsAgoYear = prevMonth === 0 ? prevMonthYear - 1 : prevMonthYear;

    if (cutoffDay === '末日') {
      // 前月末日締めの場合：前月1日〜前月末日
      periodStart = new Date(prevMonthYear, prevMonth, 1, 0, 0, 0, 0);
      periodEnd = new Date(prevMonthYear, prevMonth + 1, 0, 23, 59, 59, 999);
    } else if (cutoffDay === '15日') {
      // 15日締めの場合：前々月16日〜前月15日
      periodStart = new Date(twoMonthsAgoYear, twoMonthsAgo, 16, 0, 0, 0, 0);
      periodEnd = new Date(prevMonthYear, prevMonth, 15, 23, 59, 59, 999);
    } else if (cutoffDay === '20日') {
      // 20日締めの場合：前々月21日〜前月20日
      periodStart = new Date(twoMonthsAgoYear, twoMonthsAgo, 21, 0, 0, 0, 0);
      periodEnd = new Date(prevMonthYear, prevMonth, 20, 23, 59, 59, 999);
    } else if (cutoffDay === '25日') {
      // 25日締めの場合：前々月26日〜前月25日
      periodStart = new Date(twoMonthsAgoYear, twoMonthsAgo, 26, 0, 0, 0, 0);
      periodEnd = new Date(prevMonthYear, prevMonth, 25, 23, 59, 59, 999);
    } else {
      // デフォルト：前月1日〜末日
      periodStart = new Date(prevMonthYear, prevMonth, 1, 0, 0, 0, 0);
      periodEnd = new Date(prevMonthYear, prevMonth + 1, 0, 23, 59, 59, 999);
    }

    console.log(`📆 [paymentDayNotification] 対象期間: ${periodStart.toISOString()} 〜 ${periodEnd.toISOString()}`);

    // 報酬レコードを取得
    const recordsSnapshot = await db.collection('compensationRecords').get();

    if (recordsSnapshot.empty) {
      console.log('⏭️ [paymentDayNotification] 報酬レコードがありません');
      return { success: true, isPaymentDay: true, notificationsSent: 0 };
    }

    // スタッフごとに集計
    const staffTotals = new Map();

    recordsSnapshot.forEach(doc => {
      const data = doc.data();
      const staffEmail = data.staffEmail;
      if (!staffEmail) return;

      // 完了日を取得
      const completedAtRaw = data.completedAt || data.recordedAt;
      if (!completedAtRaw) return;

      let completedAt;
      if (typeof completedAtRaw === 'string') {
        completedAt = new Date(completedAtRaw);
      } else if (completedAtRaw.toDate) {
        completedAt = completedAtRaw.toDate();
      } else {
        completedAt = new Date(completedAtRaw);
      }

      // 期間内かチェック
      if (completedAt >= periodStart && completedAt <= periodEnd) {
        if (!staffTotals.has(staffEmail)) {
          staffTotals.set(staffEmail, {
            email: staffEmail,
            name: data.staffName || staffEmail.split('@')[0],
            totalAmount: 0,
            recordCount: 0
          });
        }
        const staff = staffTotals.get(staffEmail);
        staff.totalAmount += (data.unitPrice || 0);
        staff.recordCount += 1;
      }
    });

    console.log(`👥 [paymentDayNotification] 対象スタッフ: ${staffTotals.size}人`);

    if (staffTotals.size === 0) {
      console.log('⏭️ [paymentDayNotification] 対象期間の報酬レコードがありません');
      return { success: true, isPaymentDay: true, notificationsSent: 0 };
    }

    // 各スタッフに通知を送信
    let notificationsSent = 0;
    const periodLabel = `${periodStart.getMonth() + 1}月分`;

    for (const [email, staffData] of staffTotals) {
      try {
        // 1. userAnnouncementsに追加
        await db.collection('users')
          .doc(email)
          .collection('userAnnouncements')
          .add({
            title: `💰 ${periodLabel}の報酬明細が届きました`,
            content: `今月の報酬は ¥${staffData.totalAmount.toLocaleString()} です。マイページで詳細をご確認ください。`,
            createdAt: FieldValue.serverTimestamp(),
            read: false,
            type: 'compensation_statement',
            data: {
              period: periodLabel,
              amount: staffData.totalAmount,
              recordCount: staffData.recordCount
            }
          });

        console.log(`📋 [paymentDayNotification] アナウンス追加: ${email}`);

        // 2. FCM通知を送信
        const deviceDoc = await db.collection('activeDevices').doc(email).get();
        if (deviceDoc.exists) {
          const deviceData = deviceDoc.data();
          const tokens = Array.isArray(deviceData?.fcmTokens) ? deviceData.fcmTokens.filter(Boolean) : [];

          if (tokens.length > 0) {
            const message = {
              tokens: tokens,
              notification: {
                title: `💰 ${periodLabel}の報酬明細`,
                body: `今月の報酬は ¥${staffData.totalAmount.toLocaleString()} です`
              },
              data: {
                type: 'compensation_statement',
                url: '/mypage.html'
              },
              webpush: {
                notification: {
                  icon: '/icons/icon-192.png',
                  badge: '/icons/badge-72.png'
                },
                fcm_options: {
                  link: 'https://furira.jp/mypage.html'
                }
              }
            };

            const response = await messaging.sendEachForMulticast(message);
            console.log(`📤 [paymentDayNotification] FCM送信: ${email} - 成功${response.successCount} 失敗${response.failureCount}`);
          }
        }

        notificationsSent++;

      } catch (error) {
        console.error(`❌ [paymentDayNotification] 通知エラー (${email}):`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`✅ [paymentDayNotification] 完了: ${notificationsSent}件通知 (${duration}ms)`);

    return {
      success: true,
      isPaymentDay: true,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      notificationsSent,
      staffCount: staffTotals.size
    };

  } catch (error) {
    console.error('❌ [paymentDayNotification] エラー:', error);
    return { success: false, error: error.message };
  }
});
