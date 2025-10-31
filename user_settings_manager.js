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
