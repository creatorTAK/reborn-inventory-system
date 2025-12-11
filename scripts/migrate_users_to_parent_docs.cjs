/**
 * Firestore コンソールで実行するスクリプト
 * users/{email}/devices/{token} のデータから
 * 親ドキュメント users/{email} を自動生成
 */

// Firestoreコンソール > ルール > 「クエリを実行」で以下を実行してください
// ※このファイルは実行されません。手動でコピー&ペーストしてください。

/*
========================================
手順:
========================================
1. Firestoreコンソールを開く
2. 以下のJavaScriptコードをブラウザの開発者ツール（Console）で実行
3. 完了後、usersコレクションを確認
========================================
*/

console.log(`
このスクリプトは直接実行できません。
以下の手順でFirestoreコンソールから実行してください:

1. https://console.firebase.google.com/project/reborn-chat/firestore/databases/-default-/data/~2Fusers
2. ブラウザの開発者ツール（F12）を開く
3. Consoleタブを選択
4. 以下のコードをコピー&ペーストして実行:

---コピーここから---

async function migrateUsers() {
  const db = firebase.firestore();
  const usersSnapshot = await db.collection('users').get();

  console.log('📋 対象ユーザー数:', usersSnapshot.size);

  let count = 0;
  for (const userDoc of usersSnapshot.docs) {
    const email = userDoc.id;
    const existingData = userDoc.data();

    // 既にフィールドがある場合はスキップ
    if (existingData && Object.keys(existingData).length > 0) {
      console.log('⏭️  スキップ:', email);
      continue;
    }

    // devicesサブコレクションから最新情報取得
    const devicesSnapshot = await db.collection('users').doc(email).collection('devices')
      .orderBy('lastUsedAt', 'desc').limit(1).get();

    if (devicesSnapshot.empty) {
      console.log('⚠️  devices empty:', email);
      continue;
    }

    const device = devicesSnapshot.docs[0].data();

    // 親ドキュメント作成
    await db.collection('users').doc(email).set({
      userName: device.userName || '名前未設定',
      email: device.userEmail || email,
      status: 'アクティブ',
      permission: device.permissionId || 'staff',
      permissionDisplay: device.permissionDisplay || 'スタッフ',
      registeredAt: device.registeredAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, { merge: true });

    console.log('✅', email, ':', device.userName);
    count++;
  }

  console.log('========== 完了 ==========');
  console.log('作成件数:', count);
}

migrateUsers();

---コピーここまで---
`);
