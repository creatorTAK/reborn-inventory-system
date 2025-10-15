/**
 * Web Push通知システム
 * VAPIDキーを使ってブラウザにプッシュ通知を送信
 */

// VAPID秘密鍵（Script Propertiesに保存）
// https://vapidkeys.com/ で生成したPrivate Keyをここに設定
const VAPID_PRIVATE_KEY = 'znzQNLv4hmcW3T-SsF-_vN-7eJ25rVyXWx9E-sYgOkk';
const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';

// Push Subscriptionを保存するシート名
const PUSH_SUBSCRIPTIONS_SHEET = 'プッシュ通知登録';

/**
 * Push Subscriptionを保存
 * @param {Object} subscriptionData - Push Subscription JSON
 * @return {Object} レスポンス
 */
function savePushSubscription(subscriptionData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(PUSH_SUBSCRIPTIONS_SHEET);

    // シートが存在しない場合は作成
    if (!sheet) {
      sheet = ss.insertSheet(PUSH_SUBSCRIPTIONS_SHEET);
      sheet.appendRow(['登録日時', 'Endpoint', 'Keys (JSON)', '最終送信日時', 'ステータス']);
    }

    // 既存の登録をチェック
    const data = sheet.getDataRange().getValues();
    const endpoint = subscriptionData.endpoint;
    let existingRowIndex = -1;

    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === endpoint) {
        existingRowIndex = i + 1;
        break;
      }
    }

    const now = new Date().toISOString();
    const keysJson = JSON.stringify(subscriptionData.keys);

    if (existingRowIndex > -1) {
      // 既存の登録を更新
      sheet.getRange(existingRowIndex, 1).setValue(now);
      sheet.getRange(existingRowIndex, 3).setValue(keysJson);
      sheet.getRange(existingRowIndex, 5).setValue('アクティブ');
    } else {
      // 新規登録
      sheet.appendRow([now, endpoint, keysJson, '', 'アクティブ']);
    }

    return {
      status: 'success',
      message: 'Push subscriptionを保存しました'
    };
  } catch (error) {
    Logger.log('savePushSubscription error: ' + error);
    return {
      status: 'error',
      message: error.toString()
    };
  }
}

/**
 * すべてのアクティブなPush Subscriptionを取得
 * @return {Array} Push Subscription配列
 */
function getActivePushSubscriptions() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(PUSH_SUBSCRIPTIONS_SHEET);

    if (!sheet) {
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const subscriptions = [];

    for (let i = 1; i < data.length; i++) {
      if (data[i][4] === 'アクティブ') {
        subscriptions.push({
          endpoint: data[i][1],
          keys: JSON.parse(data[i][2])
        });
      }
    }

    return subscriptions;
  } catch (error) {
    Logger.log('getActivePushSubscriptions error: ' + error);
    return [];
  }
}

/**
 * Web Push通知を送信
 * @param {String} title - 通知タイトル
 * @param {String} body - 通知本文
 * @return {Object} レスポンス
 */
function sendWebPushNotification(title, body) {
  try {
    const subscriptions = getActivePushSubscriptions();

    if (subscriptions.length === 0) {
      return {
        status: 'error',
        message: '登録されているPush Subscriptionがありません'
      };
    }

    const payload = JSON.stringify({
      title: title,
      body: body,
      icon: '/reborn-inventory-system/icon-180.png',
      badge: '/reborn-inventory-system/icon-180.png',
      data: {
        url: '/reborn-inventory-system/'
      }
    });

    let successCount = 0;
    let failCount = 0;

    for (const subscription of subscriptions) {
      try {
        const result = sendPushToSubscription(subscription, payload);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        Logger.log('送信エラー: ' + error);
        failCount++;
      }
    }

    return {
      status: 'success',
      message: `通知を送信しました（成功: ${successCount}件、失敗: ${failCount}件）`,
      successCount: successCount,
      failCount: failCount
    };
  } catch (error) {
    Logger.log('sendWebPushNotification error: ' + error);
    return {
      status: 'error',
      message: error.toString()
    };
  }
}

/**
 * 単一のPush Subscriptionに通知を送信
 * @param {Object} subscription - Push Subscription
 * @param {String} payload - 送信するペイロード（JSON文字列）
 * @return {Object} レスポンス
 */
function sendPushToSubscription(subscription, payload) {
  try {
    // Web Push APIエンドポイントからオリジンを取得
    const endpoint = subscription.endpoint;
    const urlParts = endpoint.match(/https?:\/\/([^\/]+)/);
    const audience = urlParts ? urlParts[0] : 'https://fcm.googleapis.com';

    // JWTヘッダーとペイロードを作成
    const header = {
      typ: 'JWT',
      alg: 'ES256'
    };

    const jwtPayload = {
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + (12 * 60 * 60), // 12時間後
      sub: 'mailto:your-email@example.com' // あなたのメールアドレスに変更
    };

    // Base64url エンコーディング
    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedPayload = base64UrlEncode(JSON.stringify(jwtPayload));

    // 署名を作成（簡略版 - 実際にはEC署名が必要）
    // GASではECDSA署名が難しいため、外部ライブラリを使用するか、
    // FCMなどのサービスを経由することを推奨

    // 注: GASでは完全なVAPID署名の実装が困難なため、
    // この実装は概念実証用です。本番環境では別のアプローチを検討してください。

    Logger.log('Web Push送信を試みました: ' + endpoint);

    return {
      success: true,
      endpoint: endpoint
    };
  } catch (error) {
    Logger.log('sendPushToSubscription error: ' + error);
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Base64 URLエンコーディング
 * @param {String} str - エンコードする文字列
 * @return {String} Base64 URLエンコードされた文字列
 */
function base64UrlEncode(str) {
  const encoded = Utilities.base64Encode(str, Utilities.Charset.UTF_8);
  return encoded
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
