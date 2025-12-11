/**
 * Active Devices Sync Script
 *
 * 全てのアクティブなデバイスを users/{email}/devices から取得し、
 * activeDevices/{email} に同期するスクリプト
 *
 * 使用方法: node scripts/sync-active-devices.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Firebase Admin初期化
const serviceAccountPath = path.join(__dirname, '..', 'firebase-service-account.json');
const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function syncActiveDevices() {
  console.log('='.repeat(60));
  console.log('🔄 Active Devices Sync Script');
  console.log('='.repeat(60));

  try {
    // 1. 全ユーザーを取得
    const usersSnapshot = await db.collection('users').get();
    console.log(`\n📊 Total users: ${usersSnapshot.size}`);

    let totalDevices = 0;
    let totalSynced = 0;
    const syncedUsers = [];

    // 2. 各ユーザーのデバイスを処理
    for (const userDoc of usersSnapshot.docs) {
      const userEmail = userDoc.id;
      const userData = userDoc.data();

      // devicesサブコレクションを取得
      const devicesSnapshot = await db
        .collection('users')
        .doc(userEmail)
        .collection('devices')
        .where('active', '==', true)
        .get();

      if (devicesSnapshot.empty) {
        continue;
      }

      totalDevices += devicesSnapshot.size;

      // 3. FCMトークンを収集
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
        console.log(`⚠️ ${userEmail}: No FCM tokens found in ${devicesSnapshot.size} active devices`);
        continue;
      }

      // 4. activeDevicesに同期
      await db.collection('activeDevices').doc(userEmail).set({
        fcmTokens: fcmTokens,
        userName: userName,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        syncedAt: new Date().toISOString()
      }, { merge: true });

      totalSynced++;
      syncedUsers.push({
        email: userEmail,
        userName: userName,
        tokenCount: fcmTokens.length
      });

      console.log(`✅ ${userName} (${userEmail}): ${fcmTokens.length} tokens synced`);
    }

    // 5. サマリー表示
    console.log('\n' + '='.repeat(60));
    console.log('📊 Sync Summary');
    console.log('='.repeat(60));
    console.log(`Total active devices found: ${totalDevices}`);
    console.log(`Users synced to activeDevices: ${totalSynced}`);

    if (syncedUsers.length > 0) {
      console.log('\nSynced users:');
      syncedUsers.forEach(u => {
        console.log(`  - ${u.userName} (${u.email}): ${u.tokenCount} tokens`);
      });
    }

    console.log('\n✅ Sync completed successfully!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error during sync:', error);
    process.exit(1);
  }

  process.exit(0);
}

// メイン実行
syncActiveDevices();
