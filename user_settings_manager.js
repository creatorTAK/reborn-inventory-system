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

    return {
      success: true,
      data: {
        userName: userProperties.getProperty('OPERATOR_NAME') || '',
        notificationEnabled: userProperties.getProperty('NOTIFICATION_ENABLED') === 'true',
        notificationSound: userProperties.getProperty('NOTIFICATION_SOUND') === 'true',
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
 * @param {boolean} settings.notificationEnabled - 通知有効フラグ
 * @param {boolean} settings.notificationSound - 通知音有効フラグ
 */
function saveUserBasicSettingsAPI(settings) {
  try {
    if (!settings || typeof settings !== 'object') {
      return {
        success: false,
        message: '設定データが不正です'
      };
    }

    if (!settings.userName || settings.userName.trim() === '') {
      return {
        success: false,
        message: 'ユーザー名を入力してください'
      };
    }

    const userProperties = PropertiesService.getUserProperties();

    // ユーザー名を保存（既存のOPERATOR_NAMEと共通化）
    userProperties.setProperty('OPERATOR_NAME', settings.userName.trim());

    // 通知設定を保存
    userProperties.setProperty('NOTIFICATION_ENABLED', settings.notificationEnabled ? 'true' : 'false');
    userProperties.setProperty('NOTIFICATION_SOUND', settings.notificationSound ? 'true' : 'false');

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
 * @param {string} base64Data - Base64エンコードされた画像データ
 * @param {string} fileName - ファイル名
 */
function uploadUserIconAPI(base64Data, fileName) {
  try {
    // TODO: 将来的にはGoogle Driveまたはクラウドストレージに保存
    // 現在は実装をスキップ（Phase 2で実装予定）

    return {
      success: false,
      message: 'アイコンアップロード機能は準備中です'
    };
  } catch (error) {
    console.error('アイコンアップロードエラー:', error);
    return {
      success: false,
      message: `アップロードエラー: ${error.message}`
    };
  }
}
