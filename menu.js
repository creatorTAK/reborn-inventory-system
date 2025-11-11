function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

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
    Logger.log('[ping] error: ' + err);
    return { ok: false, error: String(err) };
  }
}

/**
 * テスト用：単純な配列を返す関数
 */
function testGetUserList() {
  Logger.log('[testGetUserList] ===== 実行開始 =====');
  const testData = [
    { userName: 'テストユーザー1', email: 'test1@example.com', permission: 'オーナー', status: 'アクティブ', registeredAt: '2025-11-03' },
    { userName: 'テストユーザー2', email: 'test2@example.com', permission: 'スタッフ', status: 'アクティブ', registeredAt: '2025-11-03' }
  ];
  Logger.log('[testGetUserList] テストデータを返します: ' + testData.length + '件');
  Logger.log('[testGetUserList] ===== 実行完了 =====');
  return testData;
}

/**
 * ユーザー一覧を取得（ユーザー権限管理UI用）
 * 注: user_permission_manager.jsのgetUserList()と区別するため別名を使用
 * @return {Array} ユーザー情報の配列
 */
function getUserListForUI() {
  // 🚀 最適化版v2 - ARCH-001対応（2025-11-11）
  // 修正: getDataRange()を1回だけ呼び出す（API呼び出し削減）
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    if (!ss) return [];

    const sheet = ss.getSheetByName('FCM通知登録');
    if (!sheet) return [];

    // 🎯 最適化1: 1回のAPI呼び出しで全データ取得
    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) return []; // ヘッダーのみ

    const headers = data[0];
    const userNameCol = headers.indexOf('ユーザー名');
    const emailCol = headers.indexOf('メールアドレス');
    const permissionCol = headers.indexOf('権限');
    const statusCol = headers.indexOf('ステータス');
    const registeredAtCol = headers.indexOf('登録日時');
    const iconCol = 8; // 列9（アイコンURL）※0始まりなので8

    if (userNameCol === -1) return [];

    const uniqueUsers = new Map();
    const permissionUpdates = []; // バッチ更新用

    // 🎯 最適化2: Logger.log()削除（本番環境で不要）
    for (let i = 1; i < data.length; i++) {
      const userName = data[i][userNameCol];
      
      // 空行スキップ
      if (!userName || userName === '') continue;

      const permission = permissionCol !== -1 ? data[i][permissionCol] : '';
      const registeredAt = registeredAtCol !== -1 ? data[i][registeredAtCol] : '';

      // 重複チェック: より新しいデータのみ保持
      const existingUser = uniqueUsers.get(userName);
      if (existingUser && registeredAt) {
        const currentDate = new Date(registeredAt);
        const existingDate = new Date(existingUser.registeredAt);
        if (currentDate <= existingDate) continue;
      }

      // 🎯 最適化3: 権限が空の場合、バッチ更新リストに追加
      const finalPermission = permission || 'スタッフ';
      if (permissionCol !== -1 && (!permission || permission === '')) {
        permissionUpdates.push({ row: i + 1, value: 'スタッフ' });
      }

      // 日付変換
      let registeredAtStr = '';
      if (registeredAt) {
        try {
          registeredAtStr = Utilities.formatDate(
            new Date(registeredAt), 
            'Asia/Tokyo', 
            'yyyy-MM-dd HH:mm:ss'
          );
        } catch (e) {
          registeredAtStr = String(registeredAt);
        }
      }

      uniqueUsers.set(userName, {
        userName: userName,
        email: emailCol !== -1 ? String(data[i][emailCol] || '') : '',
        permission: finalPermission,
        status: statusCol !== -1 ? String(data[i][statusCol] || 'アクティブ') : 'アクティブ',
        registeredAt: registeredAtStr,
        userIconUrl: String(data[i][iconCol] || '')
      });
    }

    // 🎯 最適化4: シート更新をバッチ処理
    if (permissionUpdates.length > 0 && permissionCol !== -1) {
      permissionUpdates.forEach(function(update) {
        sheet.getRange(update.row, permissionCol + 1).setValue(update.value);
      });
    }

    return Array.from(uniqueUsers.values());

  } catch (error) {
    // エラー時のみログ出力
    Logger.log('[getUserListForUI] ERROR: ' + error.message);
    return [];
  }
}

/**
 * ユーザー権限を更新（ユーザー権限管理UI用）
 * @param {String} userName - ユーザー名
 * @param {String} permission - 権限レベル (オーナー/スタッフ/外注)
 * @return {Object} 更新結果
 */
function updateUserPermission(userName, permission) {
  try {
    const validPermissions = ['オーナー', 'スタッフ', '外注'];
    if (!validPermissions.includes(permission)) {
      return {
        success: false,
        message: `無効な権限レベルです: ${permission}`
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FCM通知登録');

    if (!sheet) {
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

    // ✅ オーナー権限に変更する場合、既存のオーナーをチェック
    if (permission === 'オーナー') {
      let currentOwnerName = null;
      
      for (let i = 1; i < data.length; i++) {
        if (data[i][permissionCol] === 'オーナー') {
          currentOwnerName = data[i][userNameCol];
          break;
        }
      }

      // 既に別のユーザーがオーナーの場合、エラー
      if (currentOwnerName && currentOwnerName !== userName) {
        return {
          success: false,
          message: `既に ${currentOwnerName} がオーナーです。オーナーは1人のみ設定可能です。`
        };
      }
    }

    let updatedCount = 0;

    for (let i = 1; i < data.length; i++) {
      if (data[i][userNameCol] === userName) {
        sheet.getRange(i + 1, permissionCol + 1).setValue(permission);
        Logger.log(`[updateUserPermission] 行${i + 1}: ${userName} → ${permission}`);
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
    Logger.log('[updateUserPermission] error: ' + error);
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * POSTリクエストのエントリーポイント
 * Push通知関連のAPIエンドポイント
 */
function doPost(e) {
  try {
    // リクエストボディを解析
    const requestBody = e.postData ? JSON.parse(e.postData.contents) : {};
    const action = requestBody.action;

    if (!action) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'アクションが指定されていません'
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'subscribeFCM') {
      // FCMトークンを保存（チーム利用対応: デバイス情報、メールアドレス、権限、通知設定も保存）
      const token = requestBody.token;
      const deviceInfo = requestBody.deviceInfo || null;
      const userId = requestBody.userId || null;
      const userName = requestBody.userName || null;
      const email = requestBody.email || null;
      const permission = requestBody.permission || 'スタッフ';
      const notificationEnabled = requestBody.notificationEnabled !== undefined ? requestBody.notificationEnabled : true;
      const notificationSound = requestBody.notificationSound !== undefined ? requestBody.notificationSound : true;
      const result = saveFCMToken(token, deviceInfo, userId, userName, email, permission, notificationEnabled, notificationSound);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'sendFCM') {
      // FCM通知を送信（POSTメソッド）
      try {
        // デバッグログをスプレッドシートに書き込む
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let debugSheet = ss.getSheetByName('デバッグログ');
        if (!debugSheet) {
          debugSheet = ss.insertSheet('デバッグログ');
          debugSheet.appendRow(['タイムスタンプ', 'メソッド', 'アクション', '受信データ', 'title', 'body', '送信結果']);
        }

        const timestamp = new Date().toLocaleString('ja-JP');
        const rawData = JSON.stringify(requestBody);

        // POSTデータから直接取得（エンコード/デコード不要）
        const title = requestBody.title || 'REBORN';
        const body = requestBody.body || 'テスト通知です';

        const result = sendFCMNotification(title, body);

        // デバッグ情報をスプレッドシートに記録
        debugSheet.appendRow([
          timestamp,
          'POST',
          'sendFCM',
          rawData,
          title,
          body,
          JSON.stringify(result)
        ]);

        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: 'エラー: ' + error.toString()
        }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (action === 'receiveAck') {
      // ACK（受信確認）を記録
      try {
        const messageId = requestBody.messageId;
        const timestamp = requestBody.timestamp;

        Logger.log('[ACK受信] messageId: ' + messageId + ', timestamp: ' + timestamp);

        // ACK記録シートに保存
        if (typeof recordAck === 'function') {
          recordAck(messageId, timestamp);
        }

        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          message: 'ACK received',
          messageId: messageId
        }))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        Logger.log('[ACK受信] ERROR: ' + error);
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          error: error.toString()
        }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (action === 'sendChatNotification') {
      // チャット通知を個別ユーザーに送信
      const title = requestBody.title;
      const body = requestBody.body;
      const targetUserName = requestBody.targetUserName;
      const badgeCount = requestBody.badgeCount;

      Logger.log('[チャット通知] ' + targetUserName + 'に送信: ' + title + ', バッジ: ' + badgeCount);

      const result = sendFCMNotificationToUser(title, body, targetUserName, badgeCount);

      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: '不明なアクション: ' + action
    }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('doPost error: ' + error);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Web Appのエントリーポイント
 * URLパラメータ ?menu=product または ?menu=config でメニューを指定可能
 */
function doGet(e) {
  try {
    // JSON APIエンドポイント（GitHub Pages用）
    if (e && e.parameter && e.parameter.action) {
      const action = e.parameter.action;

      // 画像プロキシ機能（3rd-party cookie問題の回避）
      if (action === 'getImage') {
        const fileId = e.parameter.id;

        if (!fileId) {
          return ContentService.createTextOutput('Missing file ID')
            .setMimeType(ContentService.MimeType.TEXT);
        }

        try {
          // Google Driveからファイルを取得
          const file = DriveApp.getFileById(fileId);
          const blob = file.getBlob();

          // ContentServiceで生のバイナリデータを返す
          // これによりWeb AppのURLが直接画像のソースとして機能する
          return ContentService.createOutput(blob).setMimeType(blob.getContentType());

        } catch (error) {
          Logger.log('getImage error for fileId ' + fileId + ': ' + error.message);
          Logger.log('Error stack: ' + error.stack);

          // デバッグ用：エラーメッセージをテキストで返す
          return ContentService.createTextOutput('Error: ' + error.message + ' | File ID: ' + fileId)
            .setMimeType(ContentService.MimeType.TEXT);
        }
      }

      // ユーザー一覧取得API（PWA版チャットアイコン表示用）
      if (action === 'getUserListForUI') {
        try {
          const users = getUserListForUI();
          return ContentService.createTextOutput(JSON.stringify(users))
            .setMimeType(ContentService.MimeType.JSON);
        } catch (error) {
          Logger.log('getUserListForUI API error: ' + error.message);
          return ContentService.createTextOutput(JSON.stringify([]))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }

      if (action === 'test') {
        // テストAPI
        const response = {
          status: 'success',
          message: 'GAS API接続成功！GitHub Pages + GAS hybrid構成が正しく動作しています。',
          timestamp: new Date().toISOString(),
          data: {
            project: 'REBORN',
            version: '1.0.0',
            architecture: 'GitHub Pages (Frontend) + GAS (Backend API)'
          }
        };

        return ContentService.createTextOutput(JSON.stringify(response))
          .setMimeType(ContentService.MimeType.JSON);
      }

      if (action === 'setOperatorName') {
        // 担当者名を保存（GET経由、PWA初回設定用）
        const name = e.parameter.name;

        if (!name) {
          const errorResponse = {
            success: false,
            message: '担当者名が指定されていません'
          };
          return ContentService.createTextOutput(JSON.stringify(errorResponse))
            .setMimeType(ContentService.MimeType.JSON);
        }

        const result = setOperatorNameAPI(name);
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }

      if (action === 'getExistingUserCount') {
        // 既存ユーザー数を取得（初回登録判定用）
        try {
          const count = getExistingUserCount();
          const response = {
            success: true,
            count: count
          };
          return ContentService.createTextOutput(JSON.stringify(response))
            .setMimeType(ContentService.MimeType.JSON);
        } catch (error) {
          Logger.log('[doGet] getExistingUserCount ERROR: ' + error);
          const errorResponse = {
            success: false,
            count: 0,
            error: error.toString()
          };
          return ContentService.createTextOutput(JSON.stringify(errorResponse))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }

      if (action === 'getNewMessages') {
        // 新着メッセージを取得（Polling用）
        try {
          const lastCheckTime = e.parameter.lastCheckTime ? parseInt(e.parameter.lastCheckTime) : 0;
          const userName = e.parameter.userName ? decodeURIComponent(e.parameter.userName) : '';
          const channelId = e.parameter.channelId ? decodeURIComponent(e.parameter.channelId) : '全体';

          Logger.log('[doGet] getNewMessages - userName: ' + userName + ', lastCheckTime: ' + lastCheckTime);

          const newMessages = getNewMessages(lastCheckTime, userName, channelId);

          const response = {
            success: true,
            count: newMessages.length,
            messages: newMessages,
            serverTime: new Date().getTime()
          };

          return ContentService.createTextOutput(JSON.stringify(response))
            .setMimeType(ContentService.MimeType.JSON);
        } catch (error) {
          Logger.log('[doGet] getNewMessages ERROR: ' + error);
          const errorResponse = {
            success: false,
            count: 0,
            messages: [],
            error: error.toString()
          };
          return ContentService.createTextOutput(JSON.stringify(errorResponse))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }

      if (action === 'subscribeFCM') {
        // FCMトークンを保存（GETメソッド、チーム利用対応 + ユーザー名対応 + メールアドレス + 権限 + 通知設定）
        const token = e.parameter.token;
        const deviceInfoParam = e.parameter.deviceInfo;
        const userIdParam = e.parameter.userId;
        const userNameParam = e.parameter.userName;
        const emailParam = e.parameter.email;
        const permissionParam = e.parameter.permission;
        const notificationEnabledParam = e.parameter.notificationEnabled;
        const notificationSoundParam = e.parameter.notificationSound;

        // デバッグログをスプレッドシートに書き込む
        try {
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          let debugSheet = ss.getSheetByName('FCM登録デバッグ');
          if (!debugSheet) {
            debugSheet = ss.insertSheet('FCM登録デバッグ');
            debugSheet.appendRow(['タイムスタンプ', 'トークン（先頭20文字）', 'deviceInfoParam', 'userIdParam', 'userId (decoded)', 'userNameParam', 'userName (decoded)', 'email', 'permission', 'notificationEnabled', 'notificationSound']);
          }

          const deviceInfo = deviceInfoParam ? JSON.parse(decodeURIComponent(deviceInfoParam)) : null;
          const userId = userIdParam ? decodeURIComponent(userIdParam) : null;
          const userName = userNameParam ? decodeURIComponent(userNameParam) : null;
          const email = emailParam ? decodeURIComponent(emailParam) : null;
          const permission = permissionParam ? decodeURIComponent(permissionParam) : 'スタッフ';
          const notificationEnabled = notificationEnabledParam === 'true' || notificationEnabledParam === true;
          const notificationSound = notificationSoundParam === 'true' || notificationSoundParam === true;

          debugSheet.appendRow([
            Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
            token ? token.substring(0, 20) + '...' : 'null',
            deviceInfoParam ? 'あり（' + deviceInfoParam.substring(0, 30) + '...）' : 'null',
            userIdParam || 'null',
            userId || 'null',
            userNameParam || 'null',
            userName || 'null',
            email || 'null',
            permission || 'null',
            notificationEnabled,
            notificationSound
          ]);
        } catch (debugError) {
          Logger.log('Debug sheet error: ' + debugError);
        }

        const deviceInfo = deviceInfoParam ? JSON.parse(decodeURIComponent(deviceInfoParam)) : null;
        const userId = userIdParam ? decodeURIComponent(userIdParam) : null;
        const userName = userNameParam ? decodeURIComponent(userNameParam) : null;
        const email = emailParam ? decodeURIComponent(emailParam) : null;
        const permission = permissionParam ? decodeURIComponent(permissionParam) : 'スタッフ';
        const notificationEnabled = notificationEnabledParam === 'true' || notificationEnabledParam === true;
        const notificationSound = notificationSoundParam === 'true' || notificationSoundParam === true;

        const result = saveFCMToken(token, deviceInfo, userId, userName, email, permission, notificationEnabled, notificationSound);
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }

      if (action === 'sendFCM') {
        // FCM通知を送信（GETメソッド + Base64デコード）
        try {
          // デバッグログをスプレッドシートに書き込む
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          let debugSheet = ss.getSheetByName('デバッグログ');
          if (!debugSheet) {
            debugSheet = ss.insertSheet('デバッグログ');
            debugSheet.appendRow(['タイムスタンプ', 'アクション', '受信パラメータ', 'デコード後title', 'デコード後body', '送信結果']);
          }

          const timestamp = new Date().toLocaleString('ja-JP');
          const rawParams = JSON.stringify(e.parameter);

          // URLパラメータからBase64エンコードされた文字列を取得
          const titleEncoded = e.parameter.title || '';
          const bodyEncoded = e.parameter.body || '';

          // デフォルト値
          let title = 'REBORN';
          let body = 'テスト通知です';

          // Base64デコード + URIデコード
          try {
            if (titleEncoded) {
              // Base64デコード → バイト配列 → 文字列 → URIデコード
              const titleBytes = Utilities.base64Decode(titleEncoded);
              const titleDecoded = Utilities.newBlob(titleBytes).getDataAsString();
              title = decodeURIComponent(titleDecoded);
            }
            if (bodyEncoded) {
              const bodyBytes = Utilities.base64Decode(bodyEncoded);
              const bodyDecoded = Utilities.newBlob(bodyBytes).getDataAsString();
              body = decodeURIComponent(bodyDecoded);
            }
          } catch (decodeError) {
            Logger.log('パラメータのデコードに失敗: ' + decodeError);
            // デコード失敗時はデフォルト値を使用
          }

          const result = sendFCMNotification(title, body);

          // デバッグ情報をスプレッドシートに記録
          debugSheet.appendRow([
            timestamp,
            'sendFCM',
            rawParams,
            title,
            body,
            JSON.stringify(result)
          ]);

          return ContentService.createTextOutput(JSON.stringify(result))
            .setMimeType(ContentService.MimeType.JSON);
        } catch (error) {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'エラー: ' + error.toString()
          }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }

      if (action === 'getNotificationHistory') {
        // 通知履歴を取得
        const limit = parseInt(e.parameter.limit) || 50;
        const history = getNotificationHistory(limit);

        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          history: history
        }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      if (action === 'getInventoryDashboard') {
        const start = new Date();
        const params = {
          statuses: e.parameter.statuses ? e.parameter.statuses.split(',') : [],
          page: parseInt(e.parameter.page) || 1,
          limit: parseInt(e.parameter.limit) || 10,
          sortBy: e.parameter.sortBy || 'registeredAt',
          sortOrder: e.parameter.sortOrder || 'desc',
          searchText: e.parameter.searchText || '',
          brand: e.parameter.brand || '',
          category: e.parameter.category || '',
          size: e.parameter.size || '',
          color: e.parameter.color || ''
        };
        logDebug_Reach(action, e.parameter, start);
        const result = getInventoryDashboardAPI(params);
        // inventory.js関数は既に{success: true/false, data/error: ...}形式を返す
        return toContentService_(result);
      }

      if (action === 'getProductDetail') {
        const start = new Date();
        logDebug_Reach(action, e.parameter, start);
        const result = getProductDetailAPI({ managementNumber: e.parameter.managementNumber });
        return toContentService_(result);
      }

      if (action === 'updateProductStatus') {
        const start = new Date();
        const params = {
          managementNumber: e.parameter.managementNumber,
          newStatus: e.parameter.newStatus
        };
        logDebug_Reach(action, e.parameter, start);
        const result = updateProductStatusAPI(params);
        return toContentService_(result);
      }

      if (action === 'updateProduct') {
        const start = new Date();
        const params = {
          managementNumber: e.parameter.managementNumber,
          field: e.parameter.field,
          value: e.parameter.value,
          editor: e.parameter.editor || 'unknown'
        };
        logDebug_Reach(action, e.parameter, start);
        const result = updateProductAPI(params);
        return toContentService_(result);
      }

      if (action === 'duplicateProduct') {
        const start = new Date();
        logDebug_Reach(action, e.parameter, start);
        const result = duplicateProductAPI({ managementNumber: e.parameter.managementNumber });
        return toContentService_(result);
      }

      if (action === 'ping') {
        // ヘルスチェック用
        return jsonOk_({ serverTime: new Date().toISOString(), message: 'pong' });
      }

      if (action === 'echo') {
        // デバッグ用：全てのパラメータをそのまま返す
        return jsonOk_({
          query: e.parameter,
          timestamp: new Date().toISOString(),
          message: 'echo OK'
        });
      }

      // INV-006: 在庫アラート設定取得
      if (action === 'getInventoryAlertSettings') {
        const result = getInventoryAlertSettingsAPI();
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // INV-006: 在庫アラート設定更新
      if (action === 'updateInventoryAlertSetting') {
        const materialName = e.parameter.materialName;
        const threshold = e.parameter.threshold ? parseInt(e.parameter.threshold) : undefined;
        const notificationEnabled = e.parameter.notificationEnabled === 'true';

        const result = updateInventoryAlertSettingAPI(materialName, threshold, notificationEnabled);
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // INV-006: 在庫アラート手動実行
      if (action === 'runInventoryAlertCheck') {
        const result = runInventoryAlertCheckAPI();
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // INV-006: 在庫アラート設定初期化
      if (action === 'initializeInventoryAlertSettings') {
        const result = initializeInventoryAlertSettings();
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // INV-006 Phase 5: 定期実行トリガー設定
      if (action === 'setupDailyInventoryAlertTrigger') {
        const hour = e.parameter.hour ? parseInt(e.parameter.hour) : 9;
        const result = setupDailyInventoryAlertTriggerAPI(hour);
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // INV-006 Phase 5: トリガー削除
      if (action === 'removeDailyInventoryAlertTrigger') {
        const result = removeDailyInventoryAlertTriggerAPI();
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // INV-006 Phase 5: トリガー一覧取得
      if (action === 'getInventoryAlertTriggers') {
        const result = getInventoryAlertTriggersAPI();
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // ユーザー権限管理: Phase 1マイグレーション実行
      if (action === 'executePhase1Migration') {
        const result = executePhase1Migration();
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // ユーザー権限管理: ユーザー一覧取得
      if (action === 'getUserList') {
        const result = getUserList();
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          users: result
        }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // ユーザー権限管理: ユーザー権限更新
      if (action === 'updateUserPermission') {
        const userName = e.parameter.userName;
        const permission = e.parameter.permission;
        if (!userName || !permission) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'ユーザー名と権限を指定してください'
          }))
            .setMimeType(ContentService.MimeType.JSON);
        }
        const result = updateUserPermission(userName, permission);
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // ユーザー権限管理: ユーザー権限取得
      if (action === 'getUserPermission') {
        const userName = e.parameter.userName;
        if (!userName) {
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: 'ユーザー名を指定してください'
          }))
            .setMimeType(ContentService.MimeType.JSON);
        }
        const permission = getUserPermission(userName);
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          userName: userName,
          permission: permission
        }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // INV-006 Phase 4: 備品在庫リストに担当者カラム追加
      if (action === 'migrateAddManagerColumn') {
        const result = migrateAddManagerColumnToInventory();
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // INV-006 Phase 4: 担当者カラム存在チェック
      if (action === 'checkManagerColumn') {
        const exists = checkManagerColumnExists();
        return ContentService.createTextOutput(JSON.stringify({
          success: true,
          exists: exists
        }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      // 不明なアクション
      return jsonError_('不明なアクション: ' + action);
    }

    const menuType = (e && e.parameter && e.parameter.menu) ? e.parameter.menu : 'product';

    // PWAアイコン配信
    if (menuType === 'icon') {
      const iconBase64 = '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';
      const iconBlob = Utilities.newBlob(Utilities.base64Decode(iconBase64), 'image/png');
      return ContentService.createTextOutput()
        .setContent(iconBlob.getBytes())
        .setMimeType(ContentService.MimeType.PNG);
    }

    // PWA manifest.json配信
    if (menuType === 'manifest') {
      const baseUrl = ScriptApp.getService().getUrl();
      const manifest = {
        name: "REBORN.",
        short_name: "REBORN",
        description: "古着物販管理システム - 商品登録から在庫管理まで",
        start_url: baseUrl + "?menu=product",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        orientation: "portrait",
        icons: [
          {
            src: baseUrl + "?menu=icon",
            sizes: "180x180",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      };

      return ContentService.createTextOutput(JSON.stringify(manifest))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // メインメニュー
    if (menuType === 'test' || menuType === 'main') {
      const baseUrl = ScriptApp.getService().getUrl();
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            /* スクロール固定（モバイル対応） */
            html, body {
              overflow-x: hidden;
              width: 100%;
              position: relative;
              -webkit-overflow-scrolling: touch;
            }
            html {
              touch-action: pan-y;
            }
            * {
              max-width: 100%;
              box-sizing: border-box;
            }

            body {
              font-family: system-ui, sans-serif;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              margin: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              border-radius: 16px;
              padding: 32px;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              max-width: 400px;
              width: 100%;
            }
            h1 {
              color: #1f2937;
              margin: 0 0 8px 0;
              font-size: 28px;
              text-align: center;
            }
            .subtitle {
              color: #6b7280;
              text-align: center;
              font-size: 14px;
              margin-bottom: 32px;
            }
            .menu-section {
              margin-bottom: 24px;
            }
            .menu-title {
              font-size: 12px;
              color: #6b7280;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 12px;
            }
            .menu-button {
              display: block;
              width: 100%;
              padding: 16px 20px;
              margin-bottom: 12px;
              background: white;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
              text-decoration: none;
              color: #1f2937;
              font-size: 16px;
              font-weight: 500;
              transition: all 0.2s ease;
              text-align: left;
              cursor: pointer;
            }
            .menu-button:hover {
              border-color: #667eea;
              background: #f9fafb;
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
            }
            .menu-button:active {
              transform: translateY(0);
            }
            .icon {
              font-size: 20px;
              margin-right: 12px;
            }
            .debug-section {
              padding-top: 24px;
              border-top: 1px solid #e5e7eb;
            }
            .debug-button {
              background: #f3f4f6;
              border-color: #d1d5db;
              color: #6b7280;
              font-size: 14px;
              padding: 12px 16px;
            }
            .debug-button:hover {
              border-color: #9ca3af;
              background: #e5e7eb;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔄 REBORN</h1>
            <p class="subtitle">古着物販管理システム</p>

            <div class="menu-section">
              <div class="menu-title">メインメニュー</div>
              <a href="${baseUrl}?menu=product" class="menu-button">
                <span class="icon">📝</span>商品登録
              </a>
              <a href="${baseUrl}?menu=config" class="menu-button">
                <span class="icon">⚙️</span>設定管理
              </a>
              <a href="#" class="menu-button" style="opacity: 0.5; pointer-events: none;">
                <span class="icon">📦</span>在庫管理（準備中）
              </a>
            </div>

            <div class="debug-section">
              <div class="menu-title">開発・デバッグ</div>
              <a href="${baseUrl}?menu=product-simple" class="menu-button debug-button">
                <span class="icon">🧪</span>シンプル商品登録
              </a>
            </div>
          </div>
        </body>
        </html>
      `)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // デバッグ用：シンプルな商品登録テスト（超ミニマル版）
    if (menuType === 'product-simple') {
      const baseUrl = ScriptApp.getService().getUrl();
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: system-ui, sans-serif;
              padding: 20px;
              background: #f0f0f0;
            }
            h1 { color: #059669; }
            button {
              padding: 15px 30px;
              font-size: 18px;
              background: #10b981;
              color: white;
              border: none;
              border-radius: 8px;
              margin: 10px 0;
            }
            a {
              display: inline-block;
              margin: 10px 0;
              padding: 10px 16px;
              background: #6b7280;
              color: white;
              text-decoration: none;
              border-radius: 6px;
            }
          </style>
        </head>
        <body>
          <h1>シンプル商品登録（テスト）</h1>
          <p>このページが表示されれば成功です。</p>
          <button onclick="alert('動作しています！')">テストボタン</button>
          <hr>
          <p><a href="${baseUrl}?menu=test">← 戻る</a></p>
        </body>
        </html>
      `)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    let template;
    let title;

    if (menuType === 'config') {
      template = HtmlService.createTemplateFromFile('sidebar_config');
      title = 'REBORN';
      // activeTabパラメータを取得（PWAからのリンク用）
      template.activeTab = (e && e.parameter && e.parameter.activeTab) || 'basic';
    } else if (menuType === 'product') {
      template = HtmlService.createTemplateFromFile('sidebar_product');
      title = 'REBORN';
    } else if (menuType === 'inventory') {
      template = HtmlService.createTemplateFromFile('sidebar_inventory');
      title = 'REBORN - 在庫管理';
    } else if (menuType === 'shipping-master') {
      template = HtmlService.createTemplateFromFile('shipping_method_master_ui');
      title = 'REBORN - 発送方法マスタ管理';
    } else if (menuType === 'packaging-master') {
      template = HtmlService.createTemplateFromFile('packaging_materials_ui');
      title = 'REBORN - 梱包資材マスタ管理';
    } else if (menuType === 'inventory_history') {
      template = HtmlService.createTemplateFromFile('inventory_history_viewer');
      title = 'REBORN - 入出庫履歴';
    } else if (menuType === 'inventory_alert_settings') {
      template = HtmlService.createTemplateFromFile('inventory_alert_settings_ui');
      title = 'REBORN - 在庫アラート設定';
    } else if (menuType === 'user_migration_test') {
      template = HtmlService.createTemplateFromFile('test_user_migration');
      title = 'REBORN - ユーザー権限管理 Phase 1';
    } else if (menuType === 'user_management') {
      // オーナー権限チェック（PWA対応）
      try {
        const hasOwnerPermission = isOwner(fcmToken);
        if (!hasOwnerPermission) {
          return HtmlService.createHtmlOutput('<h2>権限エラー</h2><p>ユーザー権限管理はオーナーのみがアクセスできます。</p>');
        }
      } catch (error) {
        Logger.log('[doGet] user_management 権限チェックエラー: ' + error);
        // エラーが発生した場合は一時的にアクセスを許可（デバッグ用）
      }
      template = HtmlService.createTemplateFromFile('user_management_ui');
      title = 'REBORN - ユーザー権限管理';
    } else if (menuType === 'chat' || menuType === 'chat_rooms') {
      // roomIdパラメータがある場合はチャット画面、ない場合はルーム一覧
      const roomId = e.parameter.roomId || '';
      const gasBaseUrl = e.parameter.gasBaseUrl || '';  // ✅ API呼び出し用URL

      if (roomId) {
        // チャット画面を開く
        Logger.log('[doGet] チャット画面を読み込みます (roomId: ' + roomId + ')');
        template = HtmlService.createTemplateFromFile('chat_ui_firestore');
        template.gasRoomId = roomId;
        template.gasBaseUrl = gasBaseUrl;  // ✅ テンプレート変数に設定
        title = 'REBORN - チーム チャット';
        Logger.log('[doGet] chat_ui_firestoreテンプレート作成完了');
      } else {
        // トークルーム一覧を表示
        Logger.log('[doGet] トークルーム一覧を読み込みます');
        template = HtmlService.createTemplateFromFile('chat_rooms_list');
        template.gasBaseUrl = gasBaseUrl;  // ✅ テンプレート変数に設定
        title = 'REBORN - チーム チャット';
        Logger.log('[doGet] chat_rooms_listテンプレート作成完了');
      }
    } else {
      // 不明なメニューの場合はデフォルトで商品登録
      template = HtmlService.createTemplateFromFile('sidebar_product');
      title = 'REBORN';
    }

    // Web Appとして開かれていることを示すフラグ（戻るボタン表示用）
    template.showBackButton = true;

    // GAS自身のURL（Web App /exec）をテンプレート変数として渡す（クロスオリジン対策）
    const gasBaseUrl = ScriptApp.getService().getUrl();
    template.GAS_BASE_URL = gasBaseUrl;
    Logger.log('[doGet] GAS_BASE_URL設定: ' + gasBaseUrl);

    // PWA版判定フラグ（app=pwaパラメータで明示的に判定）
    template.isPWA = e && e.parameter && e.parameter.app === 'pwa';

    // FCMトークンをテンプレート変数として渡す（マルチユーザー対応）
    template.fcmToken = (e && e.parameter && e.parameter.fcmToken) || '';

    // PWA版：ユーザー名、roomId、parentOrigin、pmTokenをテンプレート変数として渡す
    template.pwaUserName = (e && e.parameter && e.parameter.userName) || '';
    template.pwaRoomId = (e && e.parameter && e.parameter.roomId) || '';
    template.pwaParentOrigin = (e && e.parameter && e.parameter.parentOrigin) || '';
    template.pwaPmToken = (e && e.parameter && e.parameter.pmToken) || '';

    // GAS版：ユーザー名を取得（メールアドレスから）
    if (!template.isPWA) {
      try {
        let userEmail = '';
        try {
          userEmail = Session.getEffectiveUser().getEmail();
        } catch (emailError) {
          try {
            userEmail = Session.getActiveUser().getEmail();
          } catch (emailError2) {
            Logger.log('[doGet] メールアドレス取得失敗');
          }
        }

        if (userEmail) {
          const userName = getUserNameByEmail(userEmail);
          template.gasUserName = userName || '';
          Logger.log('[doGet] GAS版ユーザー名設定: ' + userName);
        } else {
          template.gasUserName = '';
        }
      } catch (error) {
        Logger.log('[doGet] ユーザー名取得エラー: ' + error);
        template.gasUserName = '';
      }
    } else {
      template.gasUserName = '';
    }

    Logger.log('[doGet] app=%s userName=%s roomId=%s fcmToken=%s', e?.parameter?.app, e?.parameter?.userName, e?.parameter?.roomId, e?.parameter?.fcmToken ? e.parameter.fcmToken.substring(0, 20) + '...' : 'なし');
    Logger.log('[doGet] テンプレート変数: isPWA=%s pwaUserName=%s pwaRoomId=%s gasUserName=%s', template.isPWA, template.pwaUserName, template.pwaRoomId, template.gasUserName);

    // Web Appとして開く場合はwidthを指定しない（画面幅いっぱいに表示）
    return template.evaluate()
      .setTitle(title)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  } catch (error) {
    // JSON APIリクエストのエラー時はJSONで返す
    if (e && e.parameter && e.parameter.action) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: error.message,
        stack: error.stack
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 通常のエラー時の表示
    return HtmlService.createHtmlOutput(
      '<h1>エラーが発生しました</h1><p>' + error.message + '</p><p>' + error.stack + '</p>'
    );
  }
}

/**
 * テスト用：doGet()をローカルでテストする関数
 * GASエディタでこの関数を実行して、doGet()の動作を確認できます
 */
function testDoGet() {
  try {
    const e = {
      parameter: {
        menu: 'inventory'
      }
    };

    Logger.log('=== testDoGet開始 ===');
    const result = doGet(e);
    Logger.log('Result type: ' + typeof result);
    Logger.log('Has evaluate: ' + (result && typeof result.evaluate === 'function'));

    if (result && typeof result.evaluate === 'function') {
      Logger.log('Evaluating...');
      const html = result.evaluate();
      Logger.log('HTML generated successfully');
      Logger.log('HTML content length: ' + html.getContent().length);
      Logger.log('First 200 chars: ' + html.getContent().substring(0, 200));
      return { success: true, message: 'HTML template generated successfully', contentLength: html.getContent().length };
    } else {
      Logger.log('ERROR: result is not a template');
      Logger.log('result: ' + JSON.stringify(result));
      return { success: false, message: 'Result is not a template', result: result };
    }
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return { success: false, message: error.toString(), stack: error.stack };
  }
}

/**
 * テスト用：超シンプルな関数（google.script.run検証用）
 */
function testHelloWorld() {
  return { success: true, data: 'Hello World from GAS!' };
}

/**
 * テスト用：getInventoryDashboardAPIと同じ形式で固定データを返す
 */
function testInventoryDashboardMock() {
  return {
    success: true,
    data: {
      statistics: {
        total: 1,
        statusCounts: {
          registered: 1,
          preparingListing: 0,
          listed: 0,
          sold: 0,
          withdrawn: 0
        },
        totalPurchaseAmount: 1000,
        totalListingAmount: 2000,
        totalSaleAmount: 0,
        totalProfit: 0,
        averageProfit: 0,
        averageInventoryDays: 0
      },
      products: [
        {
          managementNumber: 'TEST-001',
          brand: 'テストブランド',
          productName: 'テスト商品',
          status: '登録済み',
          purchaseAmount: 1000,
          listingAmount: 2000,
          category: 'メンズ',
          size: 'M',
          color: 'ブルー'
        }
      ],
      count: 1,
      totalCount: 1,
      page: 1,
      perPage: 10,
      totalPages: 1
    }
  };
}

/**
 * テスト用：getInventoryDashboardAPIを直接テスト
 */
function testInventoryAPI() {
  try {
    Logger.log('=== testInventoryAPI開始 ===');
    const params = {
      statuses: ['登録済み', '出品準備中', '出品中'],
      page: 1,
      limit: 10,
      sortBy: 'registeredAt',
      sortOrder: 'desc',
      searchText: '',
      brand: '',
      category: '',
      size: '',
      color: ''
    };

    const result = getInventoryDashboardAPI(params);
    Logger.log('Result type: ' + typeof result);
    Logger.log('Result: ' + JSON.stringify(result).substring(0, 500));
    return result;
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return { success: false, error: error.toString() };
  }
}

function showProductSidebar() {
  const t = HtmlService.createTemplateFromFile('sidebar_product');
  t.isSidebar = true;  // スプレッドシートのサイドバーフラグ
  t.fcmToken = '';  // スプレッドシートから開く場合はFCMトークンなし
  const html = t.evaluate().setTitle('商品登録').setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showInventorySidebar() {
  const t = HtmlService.createTemplateFromFile('sidebar_inventory');
  t.fcmToken = '';  // スプレッドシートから開く場合はFCMトークンなし
  const html = t.evaluate()
    .setTitle('📦 在庫管理')
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * 入出庫履歴を表示
 */
function showInventoryHistoryViewer() {
  const html = HtmlService.createHtmlOutputFromFile('inventory_history_viewer')
    .setTitle('📊 入出庫履歴')
    .setWidth(800);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showMasterDataManager() {
  SpreadsheetApp.getUi().alert('情報', 'マスタデータ管理機能は準備中です', SpreadsheetApp.getUi().ButtonSet.OK);
}

function showSalesAnalysis() {
  SpreadsheetApp.getUi().alert('情報', '売上分析機能は将来実装予定です', SpreadsheetApp.getUi().ButtonSet.OK);
}

function showConfigManager() {
  const t = HtmlService.createTemplateFromFile('sidebar_config');
  t.isSidebar = true;  // スプレッドシートのサイドバーフラグ
  t.fcmToken = '';  // スプレッドシートから開く場合はFCMトークンなし
  t.activeTab = 'basic';  // デフォルトタブ
  const html = t.evaluate().setTitle('設定管理').setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

// 設定管理サブメニュー用関数
function showConfigManagerBasic() {
  const t = HtmlService.createTemplateFromFile('sidebar_config');
  t.isSidebar = true;
  t.fcmToken = '';
  t.activeTab = 'basic';
  const html = t.evaluate().setTitle('基本設定').setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showConfigManagerManagement() {
  const t = HtmlService.createTemplateFromFile('sidebar_config');
  t.isSidebar = true;
  t.fcmToken = '';
  t.activeTab = 'management';
  const html = t.evaluate().setTitle('管理番号設定').setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showConfigManagerProduct() {
  const t = HtmlService.createTemplateFromFile('sidebar_config');
  t.isSidebar = true;
  t.fcmToken = '';
  t.activeTab = 'product';
  const html = t.evaluate().setTitle('商品登録設定').setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showConfigManagerShipping() {
  const t = HtmlService.createTemplateFromFile('sidebar_config');
  t.isSidebar = true;
  t.fcmToken = '';
  t.activeTab = 'shipping';
  const html = t.evaluate().setTitle('配送設定').setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showConfigManagerProcure() {
  const t = HtmlService.createTemplateFromFile('sidebar_config');
  t.isSidebar = true;
  t.fcmToken = '';
  t.activeTab = 'procure-listing';
  const html = t.evaluate().setTitle('仕入・出品設定').setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showConfigManagerAI() {
  const t = HtmlService.createTemplateFromFile('sidebar_config');
  t.isSidebar = true;
  t.fcmToken = '';
  t.activeTab = 'ai';
  const html = t.evaluate().setTitle('AI生成設定').setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * ユーザー権限管理画面を表示（サイドバー）
 */
function showUserManagement() {
  // オーナー権限チェック（一時的に無効化 - デバッグ用）
  try {
    const hasOwnerPermission = isOwner();
    if (!hasOwnerPermission) {
      const ui = SpreadsheetApp.getUi();
      ui.alert(
        '権限エラー',
        'ユーザー権限管理はオーナーのみがアクセスできます。',
        ui.ButtonSet.OK
      );
      return;
    }
  } catch (error) {
    Logger.log('[showUserManagement] 権限チェックエラー: ' + error);
    // エラーが発生した場合は一時的にアクセスを許可（デバッグ用）
  }

  const t = HtmlService.createTemplateFromFile('user_management_ui');
  t.showBackButton = false; // スプレッドシートから開く場合は戻るボタン不要
  t.GAS_BASE_URL = ScriptApp.getService().getUrl() || '';
  t.fcmToken = '';
  t.isSidebar = true; // サイドバーフラグ
  const html = t.evaluate()
    .setTitle('ユーザー権限管理')
    .setWidth(600); // テーブル5カラム表示のため幅を拡大
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * 在庫アラート設定画面を表示（サイドバー）
 */
function showInventoryAlertSettings() {
  const t = HtmlService.createTemplateFromFile('inventory_alert_settings_ui');
  t.GAS_BASE_URL = ScriptApp.getService().getUrl() || '';
  t.isSidebar = true; // サイドバーフラグ
  const html = t.evaluate()
    .setTitle('⚠️ 在庫アラート設定')
    .setWidth(600);
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * チャット画面を表示（サイドバー）
 */
/**
 * メールアドレスからユーザー名を取得
 */
function getUserNameByEmail(email) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FCM通知登録');

    if (!sheet) {
      Logger.log('[getUserNameByEmail] FCM通知登録シートが見つかりません');
      return '';
    }

    const data = sheet.getDataRange().getValues();
    if (data.length <= 1) {
      Logger.log('[getUserNameByEmail] FCM通知登録シートにデータがありません');
      return '';
    }

    const headers = data[0];
    const userNameCol = headers.indexOf('ユーザー名');
    const emailCol = headers.indexOf('メールアドレス');

    if (userNameCol === -1 || emailCol === -1) {
      Logger.log('[getUserNameByEmail] 必要な列が見つかりません');
      return '';
    }

    // メールアドレスで検索
    for (let i = 1; i < data.length; i++) {
      const rowEmail = data[i][emailCol];
      if (rowEmail && rowEmail.toString().toLowerCase() === email.toLowerCase()) {
        const userName = data[i][userNameCol];
        Logger.log('[getUserNameByEmail] 該当ユーザー発見: ' + userName);
        return userName || '';
      }
    }

    Logger.log('[getUserNameByEmail] 該当ユーザーが見つかりません: ' + email);
    return '';
  } catch (error) {
    Logger.log('[getUserNameByEmail] エラー: ' + error);
    return '';
  }
}

function showChatSidebar() {
  try {
    let userEmail = '';

    try {
      // 共有スプレッドシートでも正確に取得できるSession.getEffectiveUser()を優先
      userEmail = Session.getEffectiveUser().getEmail();
      Logger.log('[showChatSidebar] Session.getEffectiveUser(): ' + userEmail);
    } catch (e) {
      Logger.log('[showChatSidebar] Session.getEffectiveUser()失敗、Session.getActiveUser()を試行');
      try {
        userEmail = Session.getActiveUser().getEmail();
        Logger.log('[showChatSidebar] Session.getActiveUser(): ' + userEmail);
      } catch (e2) {
        Logger.log('[showChatSidebar] Session.getActiveUser()も失敗: ' + e2);
      }
    }

    Logger.log('[showChatSidebar] ユーザー: ' + userEmail);

    // メールアドレスからユーザー名を取得
    const userName = getUserNameByEmail(userEmail);
    Logger.log('[showChatSidebar] ユーザー名: ' + userName);

    // トークルーム一覧を表示
    const template = HtmlService.createTemplateFromFile('chat_rooms_list');
    template.isPWA = false;  // GAS版なので常にfalse
    template.pwaUserName = '';  // GAS版では使わない
    template.gasUserName = userName || '';  // GAS版用のユーザー名
    Logger.log('[showChatSidebar] ユーザー名設定: ' + userName);

    const html = template.evaluate()
      .setTitle('💬 チーム チャット')
      .setWidth(400);

    SpreadsheetApp.getUi().showSidebar(html);
  } catch (error) {
    Logger.log('[showChatSidebar] エラー: ' + error);
    SpreadsheetApp.getUi().alert('チャット画面を開けませんでした: ' + error.message);
  }
}

/**
 * チャットメッセージシート作成（メニューから実行）
 */
function createChatMessagesSheetMenu() {
  const result = setupChatMessagesSheet();
  const ui = SpreadsheetApp.getUi();

  if (result.success) {
    ui.alert('✅ 成功', result.message, ui.ButtonSet.OK);
  } else {
    ui.alert('❌ エラー', result.message, ui.ButtonSet.OK);
  }
}

/**
 * 入出庫履歴シート作成（メニューから実行）
 */
function createInventoryHistorySheetMenu() {
  const result = createInventoryHistorySheet();
  const ui = SpreadsheetApp.getUi();

  if (result.success) {
    ui.alert('✅ 成功', result.message, ui.ButtonSet.OK);
  } else {
    ui.alert('❌ エラー', result.message, ui.ButtonSet.OK);
  }
}

/**
 * シート保護設定（メニューから実行）
 * SEC-001: 権限列の不正変更防止
 */
function setupSheetProtectionMenu() {
  const ui = SpreadsheetApp.getUi();
  
  // 確認ダイアログ
  const response = ui.alert(
    '🔒 シート保護設定',
    '以下のシートをオーナーのみ編集可能に保護します：\n\n' +
    '・FCM通知登録\n・ユーザー権限管理\n\n' +
    'スタッフ・外注は閲覧のみ可能になります。\n\n実行しますか？',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  const result = setupSheetProtection();
  
  if (result.success) {
    ui.alert('✅ 成功', result.message, ui.ButtonSet.OK);
  } else {
    ui.alert('❌ エラー', result.message, ui.ButtonSet.OK);
  }
}

/**
 * シート保護解除（デバッグ用、メニューから実行）
 * WARNING: 本番環境では使用しないこと
 */
function removeSheetProtectionMenu() {
  const ui = SpreadsheetApp.getUi();
  
  // 確認ダイアログ
  const response = ui.alert(
    '⚠️ シート保護解除（デバッグ用）',
    'すべてのシート保護を解除します。\n\n' +
    'この操作は開発・デバッグ時のみ使用してください。\n' +
    '本番環境では使用しないでください。\n\n' +
    '実行しますか？',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  const result = removeSheetProtection();
  
  if (result.success) {
    ui.alert('✅ 成功', result.message, ui.ButtonSet.OK);
  } else {
    ui.alert('❌ エラー', result.message, ui.ButtonSet.OK);
  }
}

/**
 * シート保護状態確認（メニューから実行）
 */
function checkSheetProtectionMenu() {
  const ui = SpreadsheetApp.getUi();
  const result = checkSheetProtection();
  
  if (result.success) {
    let message = '現在の保護状態：\n\n';
    
    for (const sheetName in result.status) {
      message += '【' + sheetName + '】\n' + result.status[sheetName] + '\n\n';
    }
    
    ui.alert('🔍 シート保護状態', message, ui.ButtonSet.OK);
  } else {
    ui.alert('❌ エラー', result.message, ui.ButtonSet.OK);
  }
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // 商品管理メニュー
  ui.createMenu('📝 商品管理')
    .addItem('📝 商品登録', 'showProductSidebar')
    .addItem('📦 在庫管理', 'showInventorySidebar')
    .addItem('📊 入出庫履歴', 'showInventoryHistoryViewer')
    .addToUi();

  // フィルタ・検索メニュー
  ui.createMenu('🔍 フィルタ・検索')
    .addItem('🔍 詳細絞り込み', 'showFilterDialog')
    .addSeparator()
    .addItem('📦 在庫中のみ表示', 'quickFilterInStock')
    .addItem('🚀 出品済のみ表示', 'quickFilterListed')
    .addItem('💰 未販売のみ表示', 'quickFilterUnsold')
    .addItem('📅 今月仕入れ分のみ', 'quickFilterThisMonth')
    .addItem('⚠️ 在庫日数30日以上', 'quickFilterOldStock')
    .addSeparator()
    .addItem('✖️ フィルタ解除', 'clearFilter')
    .addToUi();

  // マスタ管理メニュー
  ui.createMenu('🗂️ マスタ管理')
    .addItem('🗂️ マスタデータ管理', 'showMasterDataManager')
    .addItem('🚚 発送方法マスタ管理', 'showShippingMethodMasterManager')
    .addItem('📦 梱包資材マスタ管理', 'showPackagingMaterialsManager')
    .addToUi();

  // 設定管理メニュー
  ui.createMenu('⚙️ 設定管理')
    .addItem('👤 基本設定', 'showConfigManagerBasic')
    .addItem('🔐 ユーザー権限管理', 'showUserManagement')
    .addItem('⚠️ 在庫アラート設定', 'showInventoryAlertSettings')
    .addSeparator()
    .addItem('🔒 シート保護設定', 'setupSheetProtectionMenu')
    .addItem('🔍 シート保護状態確認', 'checkSheetProtectionMenu')
    .addSeparator()
    .addItem('🔢 管理番号設定', 'showConfigManagerManagement')
    .addItem('📝 商品登録設定', 'showConfigManagerProduct')
    .addItem('📦 配送設定', 'showConfigManagerShipping')
    .addItem('💼 仕入・出品設定', 'showConfigManagerProcure')
    .addItem('✨ AI生成設定', 'showConfigManagerAI')
    .addToUi();

}

/**
 * ⚠️ 在庫アラートを手動実行（メニューから）
 */
function runInventoryAlertManual() {
  try {
    const result = runInventoryAlertCheckAPI();

    const ui = SpreadsheetApp.getUi();
    if (result.success) {
      ui.alert(
        '在庫アラート実行完了',
        `${result.message}\n\nアラート件数: ${result.alertCount}件`,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        '在庫アラート実行エラー',
        result.message,
        ui.ButtonSet.OK
      );
    }
  } catch (error) {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'エラー',
      'エラーが発生しました: ' + error.toString(),
      ui.ButtonSet.OK
    );
    Logger.log('[runInventoryAlertManual] エラー: ' + error);
  }
}

/**
 * 🔓 在庫アラート設定シートの保護を解除（メニューから）
 */
function removeInventoryAlertProtectionFromMenu() {
  try {
    const result = removeInventoryAlertSheetProtection();

    const ui = SpreadsheetApp.getUi();
    if (result.success) {
      ui.alert(
        '在庫アラート設定の保護解除完了',
        result.message,
        ui.ButtonSet.OK
      );
    } else {
      ui.alert(
        '在庫アラート設定の保護解除エラー',
        result.message,
        ui.ButtonSet.OK
      );
    }
  } catch (error) {
    const ui = SpreadsheetApp.getUi();
    ui.alert(
      'エラー',
      'エラーが発生しました: ' + error.toString(),
      ui.ButtonSet.OK
    );
    Logger.log('[removeInventoryAlertProtectionFromMenu] エラー: ' + error);
  }
}

/**
 * 🧪 Webhookテスト結果シートを開く
 */
function openWebhookTestSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let testSheet = ss.getSheetByName('Webhookテスト');
  
  if (!testSheet) {
    testSheet = ss.insertSheet('Webhookテスト');
    testSheet.appendRow(['タイムスタンプ', 'テスト項目', 'ステータス', '詳細']);
    
    // 列幅を調整
    testSheet.setColumnWidth(1, 150); // タイムスタンプ
    testSheet.setColumnWidth(2, 200); // テスト項目
    testSheet.setColumnWidth(3, 120); // ステータス
    testSheet.setColumnWidth(4, 400); // 詳細
    
    // ヘッダーをフォーマット
    const headerRange = testSheet.getRange(1, 1, 1, 4);
    headerRange.setBackground('#4285f4');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
  }
  
  ss.setActiveSheet(testSheet);
  SpreadsheetApp.getUi().alert('✅ Webhookテストシートを開きました');
}

// ========================================
// CORS対応のJSON レスポンスヘルパー関数
// ========================================

/**
 * オブジェクトをContentServiceでラップ（inventory.js用）
 */
function toContentService_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * JSON 成功レスポンス
 * 注：GASは自動的にCORSを処理するため、手動ヘッダー設定不要
 */
function jsonOk_(obj) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: obj }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * JSON エラーレスポンス
 */
function jsonError_(message) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 到達ログ（デバッグ用）
 */
function logDebug_Reach(action, params, startTime) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName('FCM登録デバッグ');
    if (!sh) {
      sh = ss.insertSheet('FCM登録デバッグ');
      sh.appendRow(['タイムスタンプ', 'ソース', 'アクション', 'パラメータ', '処理時間']);
    }
    sh.appendRow([
      new Date(),
      'menu.doGet',
      action,
      JSON.stringify(params).substring(0, 200),
      (new Date() - startTime) + 'ms'
    ]);
  } catch (e) {
    // ログ失敗は握りつぶし
    Logger.log('logDebug_Reach error: ' + e);
  }
}

/**
 * 全ユーザー名を取得（チャット未読カウント更新用）
 * @return {Array} ユーザー名の配列
 */
function getAllUserNames() {
  try {
    Logger.log('[getAllUserNames] 全ユーザー名取得開始');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const fcmSheet = ss.getSheetByName('FCM通知登録');

    if (!fcmSheet) {
      Logger.log('[getAllUserNames] FCM通知登録シートが見つかりません');
      return [];
    }

    const data = fcmSheet.getDataRange().getValues();
    const headers = data[0];
    const userNameCol = headers.indexOf('ユーザー名');

    if (userNameCol === -1) {
      Logger.log('[getAllUserNames] ユーザー名列が見つかりません');
      return [];
    }

    // ユーザー名を収集（重複除去）
    const userNames = [];
    const seenNames = new Set();

    for (let i = 1; i < data.length; i++) {
      const userName = data[i][userNameCol];
      if (userName && !seenNames.has(userName)) {
        userNames.push(userName);
        seenNames.add(userName);
      }
    }

    Logger.log('[getAllUserNames] 取得ユーザー数:', userNames.length);
    return userNames;
  } catch (error) {
    Logger.log('[getAllUserNames] エラー:', error);
    return [];
  }
}
