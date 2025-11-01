/**
 * ユーザー設定管理API
 * 基本設定（ユーザー名、通知設定、アイコンなど）を管理
 */

/**
 * 基本設定を取得
 */
function getUserBasicSettingsAPI() {
  try {
    const userProperties = PropertiesService.getUserProperties();

    // デフォルト値: 通知設定は初回はtrueにする
    const notificationEnabledValue = userProperties.getProperty('NOTIFICATION_ENABLED');
    const notificationSoundValue = userProperties.getProperty('NOTIFICATION_SOUND');

    return {
      success: true,
      data: {
        userName: userProperties.getProperty('OPERATOR_NAME') || '',
        email: userProperties.getProperty('USER_EMAIL') || '',
        notificationEnabled: notificationEnabledValue === null ? true : notificationEnabledValue === 'true',
        notificationSound: notificationSoundValue === null ? true : notificationSoundValue === 'true',
        userIconUrl: userProperties.getProperty('USER_ICON_URL') || ''
      }
    };
  } catch (error) {
    console.error('基本設定取得エラー:', error);
    return {
      success: false,
      message: `取得エラー: ${error.message}`
    };
  }
}

/**
 * 基本設定を保存
 * @param {Object} settings - 設定オブジェクト
 * @param {string} settings.userName - ユーザー名
 * @param {string} settings.email - メールアドレス
 * @param {boolean} settings.notificationEnabled - 通知有効フラグ
 * @param {boolean} settings.notificationSound - 通知音有効フラグ
 */
function saveUserBasicSettingsAPI(settings) {
  try {
    console.log('=== saveUserBasicSettingsAPI 開始 ===');
    console.log('受信したsettings:', JSON.stringify(settings));

    if (!settings || typeof settings !== 'object') {
      console.error('設定データが不正です');
      return {
        success: false,
        message: '設定データが不正です'
      };
    }

    if (!settings.userName || settings.userName.trim() === '') {
      console.error('ユーザー名が空です');
      return {
        success: false,
        message: 'ユーザー名を入力してください'
      };
    }

    const userProperties = PropertiesService.getUserProperties();

    // ユーザー名を保存（既存のOPERATOR_NAMEと共通化）
    userProperties.setProperty('OPERATOR_NAME', settings.userName.trim());
    console.log('OPERATOR_NAME保存:', settings.userName.trim());

    // メールアドレスを保存
    if (settings.email) {
      userProperties.setProperty('USER_EMAIL', settings.email.trim());
      console.log('USER_EMAIL保存:', settings.email.trim());
    }

    // 通知設定を保存
    userProperties.setProperty('NOTIFICATION_ENABLED', settings.notificationEnabled ? 'true' : 'false');
    console.log('NOTIFICATION_ENABLED保存:', settings.notificationEnabled ? 'true' : 'false');

    userProperties.setProperty('NOTIFICATION_SOUND', settings.notificationSound ? 'true' : 'false');
    console.log('NOTIFICATION_SOUND保存:', settings.notificationSound ? 'true' : 'false');

    console.log('=== saveUserBasicSettingsAPI 完了 ===');
    return {
      success: true,
      message: '基本設定を保存しました'
    };
  } catch (error) {
    console.error('基本設定保存エラー:', error);
    return {
      success: false,
      message: `保存エラー: ${error.message}`
    };
  }
}

/**
 * ユーザーアイコンをアップロード
 * @param {string} base64Data - Base64エンコードされた画像データ（data:image/jpeg;base64,... 形式）
 */
function uploadUserIconAPI(base64Data) {
  try {
    console.log('=== uploadUserIconAPI 開始 ===');

    if (!base64Data) {
      return {
        success: false,
        message: '画像データが空です'
      };
    }

    // Base64データサイズチェック（2MB制限）
    const sizeInBytes = (base64Data.length * 3) / 4;
    const sizeInMB = sizeInBytes / (1024 * 1024);
    console.log('画像サイズ:', sizeInMB.toFixed(2), 'MB');

    if (sizeInMB > 2) {
      return {
        success: false,
        message: 'ファイルサイズは2MB以下にしてください'
      };
    }

    const userProperties = PropertiesService.getUserProperties();

    // Base64データをPropertiesServiceに保存
    // 注: PropertiesServiceは9KBまでの制限があるため、画像は小さめに
    userProperties.setProperty('USER_ICON_URL', base64Data);
    console.log('✅ アイコンをPropertiesServiceに保存しました');

    return {
      success: true,
      message: 'アイコンを保存しました',
      iconUrl: base64Data
    };
  } catch (error) {
    console.error('アイコンアップロードエラー:', error);
    return {
      success: false,
      message: `アップロードエラー: ${error.message}`
    };
  }
}

/**
 * FCMトークンから基本設定を取得
 * @param {string} fcmToken - FCMトークン
 */
function getUserBasicSettingsByTokenAPI(fcmToken) {
  try {
    console.log('=== getUserBasicSettingsByTokenAPI 開始 ===');
    console.log('FCMトークン:', fcmToken ? fcmToken.substring(0, 20) + '...' : 'なし');

    if (!fcmToken) {
      // フォールバック: PropertiesServiceから取得
      return getUserBasicSettingsAPI();
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FCM通知登録');

    if (!sheet) {
      console.error('FCM通知登録シートが見つかりません');
      // フォールバック: PropertiesServiceから取得
      return getUserBasicSettingsAPI();
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      console.log('FCM通知登録シートにデータがありません');
      return { success: true, data: { userName: '', email: '', notificationEnabled: true, notificationSound: true, userIconUrl: '' } };
    }

    const dataRange = sheet.getRange(2, 1, lastRow - 1, 11);
    const data = dataRange.getValues();

    // FCMトークンで検索
    for (let i = 0; i < data.length; i++) {
      const rowToken = data[i][3]; // 列4: FCMトークン
      if (rowToken === fcmToken) {
        const userName = data[i][1] || ''; // 列2: ユーザー名
        const email = data[i][7] || ''; // 列8: メールアドレス
        const iconUrl = data[i][8] || ''; // 列9: アイコンURL
        const notificationEnabled = data[i][9] === undefined ? true : data[i][9]; // 列10: 通知有効
        const notificationSound = data[i][10] === undefined ? true : data[i][10]; // 列11: 通知音

        console.log('✅ FCMトークンに一致する設定を発見:', userName);
        return {
          success: true,
          data: {
            userName: userName,
            email: email,
            notificationEnabled: notificationEnabled,
            notificationSound: notificationSound,
            userIconUrl: iconUrl
          }
        };
      }
    }

    console.log('⚠️ FCMトークンに一致するデータが見つかりませんでした');
    return { success: true, data: { userName: '', email: '', notificationEnabled: true, notificationSound: true, userIconUrl: '' } };

  } catch (error) {
    console.error('❌ FCMトークンから基本設定取得エラー:', error);
    // エラー時はフォールバック
    return getUserBasicSettingsAPI();
  }
}

/**
 * FCMトークンで基本設定を保存
 * @param {string} fcmToken - FCMトークン
 * @param {Object} settings - 設定オブジェクト
 */
function saveUserBasicSettingsByTokenAPI(fcmToken, settings) {
  try {
    console.log('=== saveUserBasicSettingsByTokenAPI 開始 ===');
    console.log('FCMトークン:', fcmToken ? fcmToken.substring(0, 20) + '...' : 'なし');
    console.log('設定:', JSON.stringify(settings));

    if (!settings || typeof settings !== 'object') {
      return { success: false, message: '設定データが不正です' };
    }

    if (!settings.userName || settings.userName.trim() === '') {
      return { success: false, message: 'ユーザー名を入力してください' };
    }

    if (!fcmToken) {
      // フォールバック: PropertiesServiceに保存
      return saveUserBasicSettingsAPI(settings);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FCM通知登録');

    if (!sheet) {
      console.error('FCM通知登録シートが見つかりません');
      // フォールバック: PropertiesServiceに保存
      return saveUserBasicSettingsAPI(settings);
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      console.log('FCM通知登録シートにデータがありません');
      return { success: false, message: 'FCM通知登録が見つかりません' };
    }

    const dataRange = sheet.getRange(2, 1, lastRow - 1, 11);
    const data = dataRange.getValues();

    // FCMトークンで検索して更新
    for (let i = 0; i < data.length; i++) {
      const rowToken = data[i][3]; // 列4: FCMトークン
      if (rowToken === fcmToken) {
        const rowIndex = i + 2; // ヘッダー行を考慮

        // データを更新
        sheet.getRange(rowIndex, 2).setValue(settings.userName.trim()); // 列2: ユーザー名
        sheet.getRange(rowIndex, 8).setValue(settings.email ? settings.email.trim() : ''); // 列8: メールアドレス
        sheet.getRange(rowIndex, 10).setValue(settings.notificationEnabled !== undefined ? settings.notificationEnabled : true); // 列10: 通知有効
        sheet.getRange(rowIndex, 11).setValue(settings.notificationSound !== undefined ? settings.notificationSound : true); // 列11: 通知音

        console.log('✅ FCM通知登録シートの設定を更新しました');

        // PropertiesServiceにも保存（後方互換性）
        const userProperties = PropertiesService.getUserProperties();
        userProperties.setProperty('OPERATOR_NAME', settings.userName.trim());
        if (settings.email) {
          userProperties.setProperty('USER_EMAIL', settings.email.trim());
        }
        userProperties.setProperty('NOTIFICATION_ENABLED', settings.notificationEnabled ? 'true' : 'false');
        userProperties.setProperty('NOTIFICATION_SOUND', settings.notificationSound ? 'true' : 'false');

        return { success: true, message: '基本設定を保存しました' };
      }
    }

    console.log('⚠️ FCMトークンに一致するデータが見つかりませんでした');
    return { success: false, message: 'FCM通知登録が見つかりません' };

  } catch (error) {
    console.error('❌ FCMトークンで基本設定保存エラー:', error);
    return { success: false, message: `保存エラー: ${error.message}` };
  }
}

/**
 * FCMトークンでユーザーアイコンをアップロード
 * @param {string} fcmToken - FCMトークン
 * @param {string} base64Data - Base64エンコードされた画像データ
 */
function uploadUserIconByTokenAPI(fcmToken, base64Data) {
  try {
    console.log('=== uploadUserIconByTokenAPI 開始 ===');
    console.log('FCMトークン:', fcmToken ? fcmToken.substring(0, 20) + '...' : 'なし');

    if (!base64Data) {
      return { success: false, message: '画像データが空です' };
    }

    // Base64データサイズチェック（2MB制限）
    const sizeInBytes = (base64Data.length * 3) / 4;
    const sizeInMB = sizeInBytes / (1024 * 1024);
    console.log('画像サイズ:', sizeInMB.toFixed(2), 'MB');

    if (sizeInMB > 2) {
      return { success: false, message: 'ファイルサイズは2MB以下にしてください' };
    }

    if (!fcmToken) {
      // フォールバック: PropertiesServiceに保存
      return uploadUserIconAPI(base64Data);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FCM通知登録');

    if (!sheet) {
      console.error('FCM通知登録シートが見つかりません');
      // フォールバック: PropertiesServiceに保存
      return uploadUserIconAPI(base64Data);
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      console.log('FCM通知登録シートにデータがありません');
      return { success: false, message: 'FCM通知登録が見つかりません' };
    }

    const dataRange = sheet.getRange(2, 1, lastRow - 1, 11);
    const data = dataRange.getValues();

    // FCMトークンで検索して更新
    for (let i = 0; i < data.length; i++) {
      const rowToken = data[i][3]; // 列4: FCMトークン
      if (rowToken === fcmToken) {
        const rowIndex = i + 2; // ヘッダー行を考慮

        // アイコンURLを更新
        sheet.getRange(rowIndex, 9).setValue(base64Data); // 列9: アイコンURL

        console.log('✅ FCM通知登録シートのアイコンを更新しました');

        // PropertiesServiceにも保存（後方互換性）
        const userProperties = PropertiesService.getUserProperties();
        userProperties.setProperty('USER_ICON_URL', base64Data);

        return { success: true, message: 'アイコンを保存しました', iconUrl: base64Data };
      }
    }

    console.log('⚠️ FCMトークンに一致するデータが見つかりませんでした');
    return { success: false, message: 'FCM通知登録が見つかりません' };

  } catch (error) {
    console.error('❌ FCMトークンでアイコンアップロードエラー:', error);
    return { success: false, message: `アップロードエラー: ${error.message}` };
  }
}
