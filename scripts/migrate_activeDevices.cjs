/**
 * 🔄 activeDevices マイグレーションスクリプト
 *
 * users/{email}/devices から activeDevices/{email} を生成
 *
 * 実行方法:
 * 1. Firebase管理用サービスアカウントキーを取得
 * 2. serviceAccountKey.json として scripts/ に配置
 * 3. node scripts/migrate_activeDevices.js
 *
 * ⚠️ 注意:
 * - 実行前にFirestoreバックアップを取得すること
 * - 初回のみ実行（べき等性あり）
 * - 所要時間: ユーザー数による（100ユーザー ≈ 1-2分）
 */

const admin = require('firebase-admin');
const path = require('path');

// サービスアカウントキーの読み込み
const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
let serviceAccount;

try {
  serviceAccount = require(serviceAccountPath);
} catch (error) {
  console.error('❌ serviceAccountKey.json が見つかりません');
  console.error('');
  console.error('📝 取得手順:');
  console.error('1. Firebase Console → プロジェクト設定');
  console.error('2. サービスアカウント → 新しい秘密鍵の生成');
  console.error('3. ダウンロードしたJSONを scripts/serviceAccountKey.json として保存');
  console.error('');
  process.exit(1);
}

// Firebase Admin 初期化
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

/**
 * メインマイグレーション処理
 */
async function migrate() {
  console.log('🚀 activeDevices マイグレーション開始');
  console.log('');

  try {
    // 全ユーザーを取得
    const usersSnapshot = await db.collection('users').get();
    const totalUsers = usersSnapshot.size;

    console.log(`👥 対象ユーザー数: ${totalUsers}`);
    console.log('');

    if (totalUsers === 0) {
      console.log('⚠️ ユーザーが見つかりません');
      return;
    }

    let processedCount = 0;
    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // 各ユーザーを処理
    for (const userDoc of usersSnapshot.docs) {
      const userEmail = userDoc.id;

      try {
        // activeDevices が既に存在するかチェック
        const activeDeviceDoc = await db.collection('activeDevices').doc(userEmail).get();

        if (activeDeviceDoc.exists) {
          console.log(`⏭️ スキップ: ${userEmail} (既に存在)`);
          skippedCount++;
          processedCount++;
          continue;
        }

        // users/{email}/devices からアクティブなトークンを取得
        const devicesSnapshot = await db.collection('users')
          .doc(userEmail)
          .collection('devices')
          .where('active', '==', true)
          .get();

        const tokens = [];
        devicesSnapshot.forEach(deviceDoc => {
          const data = deviceDoc.data();
          if (data?.fcmToken && typeof data.fcmToken === 'string') {
            tokens.push(data.fcmToken);
          }
        });

        if (tokens.length > 0) {
          // 重複削除
          const uniqueTokens = Array.from(new Set(tokens));

          // activeDevices に書き込み
          await db.collection('activeDevices').doc(userEmail).set({
            fcmTokens: uniqueTokens,
            lastUpdated: admin.firestore.FieldValue.serverTimestamp()
          });

          console.log(`✅ 移行完了: ${userEmail} (${uniqueTokens.length} tokens)`);
          migratedCount++;
        } else {
          console.log(`ℹ️ トークンなし: ${userEmail}`);
          skippedCount++;
        }

        processedCount++;

        // 進捗表示（50件ごと）
        if (processedCount % 50 === 0) {
          console.log('');
          console.log(`📊 進捗: ${processedCount} / ${totalUsers} (${Math.round(processedCount / totalUsers * 100)}%)`);
          console.log('');
        }

      } catch (error) {
        console.error(`❌ エラー: ${userEmail}`, error.message);
        errorCount++;
        processedCount++;
      }
    }

    // 完了サマリー
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('✅ マイグレーション完了');
    console.log('═══════════════════════════════════════');
    console.log(`総ユーザー数: ${totalUsers}`);
    console.log(`✅ 移行完了: ${migratedCount} users`);
    console.log(`⏭️ スキップ: ${skippedCount} users (既存 or トークンなし)`);
    console.log(`❌ エラー: ${errorCount} users`);
    console.log('');

    if (errorCount === 0) {
      console.log('🎉 すべて正常に完了しました');
    } else {
      console.log('⚠️ 一部エラーが発生しました。ログを確認してください');
    }

  } catch (error) {
    console.error('');
    console.error('❌ マイグレーション失敗');
    console.error(error);
    process.exit(1);
  }
}

/**
 * 検証用: activeDevices の件数を表示
 */
async function verifyMigration() {
  console.log('');
  console.log('🔍 検証: activeDevices 件数確認');

  const activeDevicesSnapshot = await db.collection('activeDevices').get();
  console.log(`📊 activeDevices ドキュメント数: ${activeDevicesSnapshot.size}`);

  if (activeDevicesSnapshot.size > 0) {
    console.log('');
    console.log('サンプル (最初の3件):');
    activeDevicesSnapshot.docs.slice(0, 3).forEach((doc, index) => {
      const data = doc.data();
      console.log(`  ${index + 1}. ${doc.id}: ${data.fcmTokens?.length || 0} tokens`);
    });
  }

  console.log('');
}

// メイン実行
(async () => {
  try {
    await migrate();
    await verifyMigration();
    console.log('✅ スクリプト終了');
    process.exit(0);
  } catch (error) {
    console.error('❌ 予期しないエラー:', error);
    process.exit(1);
  }
})();
