/**
 * Firestore 権限設定の初期化スクリプト
 *
 * 実行方法:
 * node scripts/init-permissions.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
  readFileSync('./functions/reborn-chat-firebase-adminsdk.json', 'utf8')
);

// Firebase Admin初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function initPermissions() {
  console.log('🔄 権限設定を初期化します...');

  const permissionsData = {
    roles: [
      {
        id: 'owner',
        display: 'オーナー',
        description: 'システム全体の管理者',
        order: 1,
        isSystem: true,
        canModify: false  // 内部IDは変更不可
      },
      {
        id: 'staff',
        display: 'スタッフ',
        description: '通常の従業員',
        order: 2,
        isSystem: true,
        canModify: false
      },
      {
        id: 'partner',
        display: '外注',
        description: '外部パートナー',
        order: 3,
        isSystem: true,
        canModify: false
      }
    ],
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    version: 1
  };

  try {
    await db.collection('settings').doc('permissions').set(permissionsData);
    console.log('✅ 権限設定を作成しました');
    console.log('📋 初期設定:');
    permissionsData.roles.forEach(role => {
      console.log(`   - ${role.id}: ${role.display} (${role.description})`);
    });
  } catch (error) {
    console.error('❌ エラー:', error);
    process.exit(1);
  }

  process.exit(0);
}

initPermissions();
