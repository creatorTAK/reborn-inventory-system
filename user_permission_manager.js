/**
 * ユーザー権限管理システム
 * FCM通知登録シートに権限カラムを追加し、ユーザーごとの権限を管理
 */

/** @OnlyCurrentDoc */

// シート名定義
const FCM_SHEET_NAME = 'FCM通知登録';

// === 疎通テスト用 ===
/**
 * ダイアログとサーバー間の疎通確認用関数
 * @param {Object} payload - 任意のコンテキスト情報
 * @return {Object} 疎通確認結果
 */
function ping(payload) {
  try {
    const info = {
      ok: true,
      ts: new Date(),
      who: (Session.getActiveUser() && Session.getActiveUser().getEmail()) || '',
      context: payload || null
    };
    Logger.log('[ping] ' + JSON.stringify(info));
    return info;
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

// 権限レベル定義
const PERMISSION_LEVELS = {
  OWNER: 'オーナー',
  STAFF: 'スタッフ',
  CONTRACTOR: '外注'
};

/**
 * FCM通知登録シートに権限カラムを追加するマイグレーション
 * 既存データに影響を与えずに新しいカラムを追加
 */
function migrateAddPermissionColumns() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(FCM_SHEET_NAME);

    if (!sheet) {
      Logger.log('ERROR: FCM通知登録シートが見つかりません');
      return {
        success: false,
        message: 'FCM通知登録シートが見つかりません'
      };
    }

    // 現在のヘッダー行を取得
    const lastColumn = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

    Logger.log('現在のカラム数: ' + lastColumn);
    Logger.log('現在のヘッダー: ' + headers.join(', '));

    let addedColumns = [];

    // 権限カラム（L列）の追加チェック
    if (lastColumn < 12 || headers[11] !== '権限') {
      Logger.log('権限カラムを追加します');
      sheet.getRange(1, 12).setValue('権限');
      addedColumns.push('権限');
    } else {
      Logger.log('権限カラムは既に存在します');
    }

    // 備考カラム（M列）の追加チェック
    if (lastColumn < 13 || headers[12] !== '備考') {
      Logger.log('備考カラムを追加します');
      sheet.getRange(1, 13).setValue('備考');
      addedColumns.push('備考');
    } else {
      Logger.log('備考カラムは既に存在します');
    }

    // データ検証を追加（権限カラムにドロップダウンリスト）
    const dataRange = sheet.getRange(2, 12, sheet.getMaxRows() - 1, 1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList([
        PERMISSION_LEVELS.OWNER,
        PERMISSION_LEVELS.STAFF,
        PERMISSION_LEVELS.CONTRACTOR
      ], true)
      .setAllowInvalid(false)
      .build();
    dataRange.setDataValidation(rule);
    Logger.log('権限カラムにデータ検証（ドロップダウン）を設定しました');

    return {
      success: true,
      message: addedColumns.length > 0
        ? `カラムを追加しました: ${addedColumns.join(', ')}`
        : 'すべてのカラムが既に存在します',
      addedColumns: addedColumns
    };
  } catch (error) {
    Logger.log('migrateAddPermissionColumns error: ' + error);
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 既存ユーザーに権限を設定（マイグレーション用）
 * @param {String} ownerUserName - オーナーとして設定するユーザー名
 */
function setInitialPermissions(ownerUserName = '安廣拓志') {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(FCM_SHEET_NAME);

    if (!sheet) {
      Logger.log('ERROR: FCM通知登録シートが見つかりません');
      return {
        success: false,
        message: 'FCM通知登録シートが見つかりません'
      };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // カラムインデックスを確認
    const userNameCol = headers.indexOf('ユーザー名');
    const permissionCol = headers.indexOf('権限');

    if (userNameCol === -1) {
      Logger.log('ERROR: ユーザー名カラムが見つかりません');
      return {
        success: false,
        message: 'ユーザー名カラムが見つかりません'
      };
    }

    if (permissionCol === -1) {
      Logger.log('ERROR: 権限カラムが見つかりません。先にmigrateAddPermissionColumns()を実行してください');
      return {
        success: false,
        message: '権限カラムが見つかりません。先にmigrateAddPermissionColumns()を実行してください'
      };
    }

    let ownerSet = false;
    let staffCount = 0;

    // データ行をループ（ヘッダー行を除く）
    for (let i = 1; i < data.length; i++) {
      const userName = data[i][userNameCol];
      const currentPermission = data[i][permissionCol];

      // 既に権限が設定されている場合はスキップ
      if (currentPermission && currentPermission !== '') {
        Logger.log(`行${i + 1}: ${userName} - 既に権限が設定されています (${currentPermission})`);
        continue;
      }

      // オーナーユーザー名と一致する場合
      if (userName === ownerUserName) {
        sheet.getRange(i + 1, permissionCol + 1).setValue(PERMISSION_LEVELS.OWNER);
        Logger.log(`行${i + 1}: ${userName} → オーナーに設定しました`);
        ownerSet = true;
      } else {
        // その他のユーザーはスタッフに設定
        sheet.getRange(i + 1, permissionCol + 1).setValue(PERMISSION_LEVELS.STAFF);
        Logger.log(`行${i + 1}: ${userName} → スタッフに設定しました`);
        staffCount++;
      }
    }

    return {
      success: true,
      message: `権限を設定しました（オーナー: ${ownerSet ? 1 : 0}人、スタッフ: ${staffCount}人）`,
      ownerSet: ownerSet,
      staffCount: staffCount
    };
  } catch (error) {
    Logger.log('setInitialPermissions error: ' + error);
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * ユーザー権限を取得
 * @param {String} userName - ユーザー名
 * @return {String|null} 権限レベル (オーナー/スタッフ/外注) または null
 */
function getUserPermission(userName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(FCM_SHEET_NAME);

    if (!sheet) {
      Logger.log('ERROR: FCM通知登録シートが見つかりません');
      return null;
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const userNameCol = headers.indexOf('ユーザー名');
    const permissionCol = headers.indexOf('権限');

    if (userNameCol === -1 || permissionCol === -1) {
      Logger.log('ERROR: 必要なカラムが見つかりません');
      return null;
    }

    // ユーザー名で検索（最新のレコードを優先）
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][userNameCol] === userName) {
        return data[i][permissionCol] || null;
      }
    }

    Logger.log(`ユーザー ${userName} が見つかりません`);
    return null;
  } catch (error) {
    Logger.log('getUserPermission error: ' + error);
    return null;
  }
}

/**
 * メールアドレスからユーザー名を取得
 * @param {String} email - メールアドレス
 * @return {String|null} ユーザー名 または null
 */
function getUserNameByEmail(email) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(FCM_SHEET_NAME);

    if (!sheet) {
      Logger.log('ERROR: FCM通知登録シートが見つかりません');
      return null;
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const userNameCol = headers.indexOf('ユーザー名');
    const emailCol = headers.indexOf('メールアドレス');

    if (userNameCol === -1 || emailCol === -1) {
      Logger.log('ERROR: 必要なカラムが見つかりません');
      return null;
    }

    // メールアドレスで検索（最新のレコードを優先）
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][emailCol] === email) {
        return data[i][userNameCol] || null;
      }
    }

    Logger.log(`メールアドレス ${email} に対応するユーザーが見つかりません`);
    return null;
  } catch (error) {
    Logger.log('getUserNameByEmail error: ' + error);
    return null;
  }
}

/**
 * 現在のユーザーがオーナー権限を持っているかチェック
 * @param {String} fcmToken - PWAからのアクセス時のFCMトークン（オプション）
 * @return {Boolean} オーナーの場合 true
 */
function isOwner(fcmToken) {
  try {
    let userName = null;

    // PWAからのアクセスの場合、fcmTokenからユーザー名を取得
    if (fcmToken) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName(FCM_SHEET_NAME);

      if (sheet) {
        const data = sheet.getDataRange().getValues();
        const headers = data[0];
        const userNameCol = headers.indexOf('ユーザー名');
        const tokenCol = headers.indexOf('FCMトークン');

        if (userNameCol !== -1 && tokenCol !== -1) {
          for (let i = data.length - 1; i >= 1; i--) {
            if (data[i][tokenCol] === fcmToken) {
              userName = data[i][userNameCol];
              break;
            }
          }
        }
      }
    }

    // GASからのアクセスの場合、メールアドレスからユーザー名を取得
    if (!userName) {
      const email = Session.getActiveUser().getEmail();
      Logger.log('[isOwner] 現在のユーザーメール: ' + email);
      userName = getUserNameByEmail(email);
    }

    if (!userName) {
      Logger.log('[isOwner] ユーザー名を特定できませんでした');
      return false;
    }

    Logger.log('[isOwner] ユーザー名: ' + userName);
    const permission = getUserPermission(userName);
    Logger.log('[isOwner] 権限: ' + permission);

    return permission === PERMISSION_LEVELS.OWNER;
  } catch (error) {
    Logger.log('[isOwner] error: ' + error);
    return false;
  }
}

/**
 * ユーザー権限を更新
 * @param {String} userName - ユーザー名
 * @param {String} permission - 権限レベル (オーナー/スタッフ/外注)
 * @param {String} fcmToken - PWAからのアクセス時のFCMトークン（オプション）
 * @return {Object} 更新結果
 */
function updateUserPermission(userName, permission, fcmToken) {
  try {
    // オーナー権限チェック
    if (!isOwner(fcmToken)) {
      Logger.log('[updateUserPermission] 権限エラー: オーナー権限が必要です');
      return {
        success: false,
        message: 'この操作はオーナー権限が必要です'
      };
    }

    // 権限レベルの妥当性チェック
    const validPermissions = Object.values(PERMISSION_LEVELS);
    if (!validPermissions.includes(permission)) {
      return {
        success: false,
        message: `無効な権限レベルです: ${permission}。有効な値: ${validPermissions.join(', ')}`
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(FCM_SHEET_NAME);

    if (!sheet) {
      Logger.log('ERROR: FCM通知登録シートが見つかりません');
      return {
        success: false,
        message: 'FCM通知登録シートが見つかりません'
      };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const userNameCol = headers.indexOf('ユーザー名');
    const permissionCol = headers.indexOf('権限');

    if (userNameCol === -1 || permissionCol === -1) {
      return {
        success: false,
        message: '必要なカラムが見つかりません'
      };
    }

    let updatedCount = 0;

    // 該当ユーザーの全レコードを更新
    for (let i = 1; i < data.length; i++) {
      if (data[i][userNameCol] === userName) {
        sheet.getRange(i + 1, permissionCol + 1).setValue(permission);
        Logger.log(`行${i + 1}: ${userName} の権限を ${permission} に更新しました`);
        updatedCount++;
      }
    }

    if (updatedCount === 0) {
      return {
        success: false,
        message: `ユーザー ${userName} が見つかりません`
      };
    }

    return {
      success: true,
      message: `${userName} の権限を ${permission} に更新しました（${updatedCount}件）`,
      updatedCount: updatedCount
    };
  } catch (error) {
    Logger.log('updateUserPermission error: ' + error);
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * ユーザー一覧を取得（権限情報を含む）
 * @return {Array} ユーザー情報の配列
 */
function getUserList() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(FCM_SHEET_NAME);

    if (!sheet) {
      Logger.log('ERROR: FCM通知登録シートが見つかりません');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // 必要なカラムのインデックス取得
    const userIdCol = headers.indexOf('ユーザーID');
    const userNameCol = headers.indexOf('ユーザー名');
    const emailCol = headers.indexOf('メールアドレス');
    const permissionCol = headers.indexOf('権限');
    const statusCol = headers.indexOf('ステータス');
    const registeredAtCol = headers.indexOf('登録日時');
    const notesCol = headers.indexOf('備考');

    const users = [];
    const uniqueUsers = new Map(); // ユーザー名でユニーク化

    // データ行をループ（ヘッダー行を除く）
    for (let i = 1; i < data.length; i++) {
      const userName = data[i][userNameCol];

      if (!userName || userName === '') {
        continue;
      }

      // 同じユーザー名の場合は最新のレコードを優先
      const existingUser = uniqueUsers.get(userName);
      const currentDate = new Date(data[i][registeredAtCol]);

      if (existingUser) {
        const existingDate = new Date(existingUser.registeredAt);
        if (currentDate <= existingDate) {
          continue; // 既存のレコードの方が新しい
        }
      }

      const userInfo = {
        userId: data[i][userIdCol] || '',
        userName: userName,
        email: emailCol !== -1 ? data[i][emailCol] : '',
        permission: permissionCol !== -1 ? data[i][permissionCol] : '',
        status: statusCol !== -1 ? data[i][statusCol] : '',
        registeredAt: data[i][registeredAtCol] || '',
        notes: notesCol !== -1 ? data[i][notesCol] : ''
      };

      uniqueUsers.set(userName, userInfo);
    }

    // Map を配列に変換
    return Array.from(uniqueUsers.values());
  } catch (error) {
    Logger.log('getUserList error: ' + error);
    return [];
  }
}

/**
 * オーナーユーザー一覧を取得
 * @return {Array} オーナー権限のユーザー情報配列
 */
function getOwnerUsers() {
  const allUsers = getUserList();
  return allUsers.filter(user => user.permission === PERMISSION_LEVELS.OWNER);
}

/**
 * スタッフユーザー一覧を取得
 * @return {Array} スタッフ権限のユーザー情報配列
 */
function getStaffUsers() {
  const allUsers = getUserList();
  return allUsers.filter(user => user.permission === PERMISSION_LEVELS.STAFF);
}

/**
 * 外注ユーザー一覧を取得
 * @return {Array} 外注権限のユーザー情報配列
 */
function getContractorUsers() {
  const allUsers = getUserList();
  return allUsers.filter(user => user.permission === PERMISSION_LEVELS.CONTRACTOR);
}

/**
 * Phase 1マイグレーション実行（フル実行）
 * 1. 権限カラムと備考カラムを追加
 * 2. 安廣拓志をオーナーに設定
 * 3. その他のユーザーをスタッフに設定
 */
function executePhase1Migration() {
  Logger.log('=== Phase 1 マイグレーション開始 ===');

  // Step 1: カラム追加
  Logger.log('Step 1: 権限カラムと備考カラムを追加...');
  const migrationResult = migrateAddPermissionColumns();
  Logger.log('マイグレーション結果: ' + JSON.stringify(migrationResult));

  if (!migrationResult.success) {
    Logger.log('ERROR: カラム追加に失敗しました');
    return migrationResult;
  }

  // Step 2: 初期権限設定
  Logger.log('Step 2: 初期権限を設定...');
  const permissionResult = setInitialPermissions('安廣拓志');
  Logger.log('権限設定結果: ' + JSON.stringify(permissionResult));

  if (!permissionResult.success) {
    Logger.log('ERROR: 権限設定に失敗しました');
    return permissionResult;
  }

  // Step 3: 結果確認
  Logger.log('Step 3: 結果を確認...');
  const users = getUserList();
  Logger.log('登録ユーザー数: ' + users.length);
  users.forEach(user => {
    Logger.log(`  - ${user.userName}: ${user.permission} (${user.email})`);
  });

  Logger.log('=== Phase 1 マイグレーション完了 ===');

  return {
    success: true,
    message: 'Phase 1 マイグレーションが正常に完了しました',
    migration: migrationResult,
    permissions: permissionResult,
    userCount: users.length
  };
}

// === 念のため"グローバル露出"を強制（V8での露出不具合/ネームスペース化対策） ===
globalThis.getUserList = getUserList;
globalThis.updateUserPermission = updateUserPermission;
globalThis.getUserPermission = getUserPermission;
globalThis.getUserNameByEmail = getUserNameByEmail;
globalThis.isOwner = isOwner;
globalThis.ping = ping;
