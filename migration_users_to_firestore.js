/**
 * REBORN在庫管理システム - Firestoreマイグレーションスクリプト
 * 
 * FCM通知登録シートからユーザーデータを読み取り、
 * Firestore (reborn-chat) の users コレクションに移行します。
 * 
 * @related-issue ARCH-001
 * @created 2025-11-11
 */

// ============================================
// 設定
// ============================================

const FIRESTORE_PROJECT_ID = 'reborn-chat';
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

// ============================================
// メイン処理
// ============================================

/**
 * ユーザーデータをFirestoreに移行
 * 
 * 実行方法:
 * 1. GASエディタでこのファイルを開く
 * 2. migrateUsersToFirestore関数を選択
 * 3. 実行ボタンをクリック
 * 4. 初回実行時は権限承認が必要
 */
function migrateUsersToFirestore() {
  Logger.log('===== ユーザーデータ移行開始 =====');
  Logger.log('時刻: ' + new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));

  try {
    // スプレッドシート取得
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FCM通知登録');

    if (!sheet) {
      Logger.log('❌ エラー: FCM通知登録シートが見つかりません');
      return;
    }

    // データ取得
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log('❌ エラー: シートが空です');
      return;
    }

    const headers = data[0];
    Logger.log('✅ シート読み取り成功: ' + (data.length - 1) + '行');

    // カラムインデックス取得
    const userNameCol = headers.indexOf('ユーザー名');
    const emailCol = headers.indexOf('メールアドレス');
    const permissionCol = headers.indexOf('権限');
    const statusCol = headers.indexOf('ステータス');
    const registeredAtCol = headers.indexOf('登録日時');
    const iconCol = 8; // 列9（アイコンURL）※0始まりなので8

    Logger.log('カラムインデックス: ユーザー名=' + userNameCol + ', メール=' + emailCol + ', 権限=' + permissionCol);

    if (userNameCol === -1) {
      Logger.log('❌ エラー: ユーザー名列が見つかりません');
      return;
    }

    // ユーザーデータを重複除去して準備
    const uniqueUsers = new Map();

    for (let i = 1; i < data.length; i++) {
      const userName = data[i][userNameCol];

      if (!userName || userName === '') continue;

      const registeredAt = registeredAtCol !== -1 ? data[i][registeredAtCol] : null;

      // 重複チェック: より新しいデータのみ保持
      const existingUser = uniqueUsers.get(userName);
      if (existingUser && registeredAt) {
        const currentDate = new Date(registeredAt);
        const existingDate = new Date(existingUser.registeredAt);
        if (currentDate <= existingDate) continue;
      }

      uniqueUsers.set(userName, {
        userName: userName,
        email: emailCol !== -1 ? String(data[i][emailCol] || '') : '',
        permission: permissionCol !== -1 ? String(data[i][permissionCol] || 'スタッフ') : 'スタッフ',
        status: statusCol !== -1 ? String(data[i][statusCol] || 'アクティブ') : 'アクティブ',
        registeredAt: registeredAt,
        userIconUrl: String(data[i][iconCol] || '')
      });
    }

    Logger.log('✅ 重複除去後のユーザー数: ' + uniqueUsers.size);

    // Firestoreに書き込み
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    uniqueUsers.forEach((user, userName) => {
      try {
        const result = writeUserToFirestore(user);
        if (result.success) {
          successCount++;
          Logger.log(`✅ 移行成功: ${userName}`);
        } else {
          errorCount++;
          errors.push({ userName, error: result.error });
          Logger.log(`❌ 移行失敗: ${userName} - ${result.error}`);
        }
      } catch (error) {
        errorCount++;
        errors.push({ userName, error: error.toString() });
        Logger.log(`❌ 移行失敗: ${userName} - ${error}`);
      }
    });

    // 結果サマリー
    Logger.log('');
    Logger.log('===== 移行完了 =====');
    Logger.log('✅ 成功: ' + successCount + '件');
    Logger.log('❌ 失敗: ' + errorCount + '件');

    if (errors.length > 0) {
      Logger.log('');
      Logger.log('=== エラー詳細 ===');
      errors.forEach(e => {
        Logger.log(`- ${e.userName}: ${e.error}`);
      });
    }

    Logger.log('');
    Logger.log('時刻: ' + new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }));

  } catch (error) {
    Logger.log('❌ 致命的エラー: ' + error);
    Logger.log('スタックトレース: ' + error.stack);
  }
}

/**
 * 単一ユーザーをFirestoreに書き込み
 * 
 * @param {Object} user - ユーザーデータ
 * @returns {Object} { success: boolean, error?: string }
 */
function writeUserToFirestore(user) {
  try {
    // Firestore REST API用のドキュメント構造
    const firestoreDoc = {
      fields: {
        userName: { stringValue: user.userName },
        email: { stringValue: user.email },
        permission: { stringValue: user.permission },
        status: { stringValue: user.status },
        userIconUrl: { stringValue: user.userIconUrl }
      }
    };

    // 登録日時をTimestamp型に変換
    if (user.registeredAt) {
      try {
        const date = new Date(user.registeredAt);
        firestoreDoc.fields.registeredAt = { timestampValue: date.toISOString() };
      } catch (e) {
        Logger.log(`⚠️ 警告: ${user.userName}の登録日時変換失敗 - ${e}`);
      }
    }

    // Firestore REST APIに書き込み
    const url = `${FIRESTORE_BASE_URL}/users/${encodeURIComponent(user.userName)}`;

    const options = {
      method: 'patch',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      },
      payload: JSON.stringify(firestoreDoc),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      return { success: true };
    } else {
      const responseText = response.getContentText();
      return { success: false, error: `HTTP ${responseCode}: ${responseText}` };
    }

  } catch (error) {
    return { success: false, error: error.toString() };
  }
}

/**
 * Firestore内のユーザー一覧を表示（確認用）
 */
function listFirestoreUsers() {
  try {
    const url = `${FIRESTORE_BASE_URL}/users`;

    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      const documents = data.documents || [];

      Logger.log('===== Firestoreユーザー一覧 =====');
      Logger.log('総ユーザー数: ' + documents.length);

      documents.forEach((doc, index) => {
        const userName = doc.fields.userName.stringValue;
        const status = doc.fields.status.stringValue;
        const permission = doc.fields.permission.stringValue;
        Logger.log(`${index + 1}. ${userName} (${permission}, ${status})`);
      });

    } else {
      Logger.log('❌ エラー: HTTP ' + responseCode);
      Logger.log(response.getContentText());
    }

  } catch (error) {
    Logger.log('❌ エラー: ' + error);
  }
}

/**
 * 特定のユーザーをFirestoreから削除（テスト用）
 * 
 * @param {string} userName - 削除するユーザー名
 */
function deleteFirestoreUser(userName) {
  try {
    const url = `${FIRESTORE_BASE_URL}/users/${encodeURIComponent(userName)}`;

    const options = {
      method: 'delete',
      headers: {
        'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
      },
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();

    if (responseCode === 200) {
      Logger.log(`✅ 削除成功: ${userName}`);
    } else {
      Logger.log(`❌ 削除失敗: ${userName} - HTTP ${responseCode}`);
      Logger.log(response.getContentText());
    }

  } catch (error) {
    Logger.log('❌ エラー: ' + error);
  }
}
