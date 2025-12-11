const admin = require('firebase-admin');
const serviceAccount = require('../functions/reborn-chat-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkDevices() {
  const usersSnapshot = await db.collection('users').get();

  console.log('📊 総ユーザー数:', usersSnapshot.size);

  for (const userDoc of usersSnapshot.docs) {
    const devicesSnapshot = await db.collection('users').doc(userDoc.id).collection('devices').get();

    if (devicesSnapshot.size > 0) {
      console.log('\n👤 ユーザー:', userDoc.id);
      console.log('   デバイス数:', devicesSnapshot.size);

      for (const deviceDoc of devicesSnapshot.docs) {
        const data = deviceDoc.data();
        console.log('   📱 デバイスID:', deviceDoc.id);
        console.log('      - permission:', data.permission || 'なし');
        console.log('      - permissionId:', data.permissionId || 'なし');
        console.log('      - permissionDisplay:', data.permissionDisplay || 'なし');
        console.log('      - active:', data.active);
      }
    }
  }

  process.exit(0);
}

checkDevices().catch(error => {
  console.error('エラー:', error);
  process.exit(1);
});
