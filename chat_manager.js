/**
 * チャット機能 バックエンドAPI
 * CHAT-001: チーム内チャット機能
 */

/** @OnlyCurrentDoc */

// シート名定義
const CHAT_SHEET_NAME = 'チャットメッセージ';

/**
 * メッセージを送信
 * @param {String} message - メッセージ本文
 * @param {String} channelId - チャンネルID（Phase 1は'全体'固定）
 * @param {String} fcmToken - PWAからのアクセス時のFCMトークン（オプション）
 * @return {Object} 送信結果
 */
function sendMessage(message, channelId, fcmToken) {
  try {
    Logger.log('[sendMessage] メッセージ送信開始');
    Logger.log('[sendMessage] message: ' + message);
    Logger.log('[sendMessage] channelId: ' + (channelId || '全体'));
    Logger.log('[sendMessage] fcmToken: ' + (fcmToken ? 'あり' : 'なし'));

    // メッセージの妥当性チェック
    if (!message || message.trim() === '') {
      return {
        success: false,
        message: 'メッセージが空です'
      };
    }

    if (message.length > 1000) {
      return {
        success: false,
        message: 'メッセージが長すぎます（最大1000文字）'
      };
    }

    // 送信者情報を取得
    let senderName = null;
    let senderPermission = null;

    // PWAからのアクセスの場合、fcmTokenからユーザー名を取得
    if (fcmToken) {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const fcmSheet = ss.getSheetByName('FCM通知登録');

      if (fcmSheet) {
        const data = fcmSheet.getDataRange().getValues();
        const headers = data[0];
        const userNameCol = headers.indexOf('ユーザー名');
        const permissionCol = headers.indexOf('権限');
        const tokenCol = headers.indexOf('FCMトークン');

        if (userNameCol !== -1 && tokenCol !== -1) {
          for (let i = data.length - 1; i >= 1; i--) {
            if (data[i][tokenCol] === fcmToken) {
              senderName = data[i][userNameCol];
              senderPermission = permissionCol !== -1 ? data[i][permissionCol] : '不明';
              break;
            }
          }
        }
      }
    }

    // GASからのアクセスの場合、メールアドレスからユーザー名を取得
    if (!senderName) {
      const email = Session.getActiveUser().getEmail();
      Logger.log('[sendMessage] 現在のユーザーメール: ' + email);

      if (typeof getUserNameByEmail === 'function') {
        senderName = getUserNameByEmail(email);
      }

      if (senderName && typeof getUserPermission === 'function') {
        senderPermission = getUserPermission(senderName);
      }
    }

    // ユーザー名が特定できない場合はデフォルト値
    if (!senderName) {
      senderName = '匿名ユーザー';
      senderPermission = '不明';
    }

    Logger.log('[sendMessage] 送信者: ' + senderName + ' (' + senderPermission + ')');

    // シートを取得
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CHAT_SHEET_NAME);

    // シートが存在しない場合は作成
    if (!sheet) {
      Logger.log('[sendMessage] チャットメッセージシートが存在しないため作成します');
      if (typeof setupChatMessagesSheet === 'function') {
        const setupResult = setupChatMessagesSheet();
        if (!setupResult.success) {
          return setupResult;
        }
        sheet = ss.getSheetByName(CHAT_SHEET_NAME);
      } else {
        return {
          success: false,
          message: 'チャットメッセージシートが見つかりません'
        };
      }
    }

    // メッセージIDを生成（タイムスタンプベース）
    const now = new Date();
    const messageId = 'msg_' + now.getTime();

    // タイムスタンプをフォーマット
    const timestamp = Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

    // チャンネルIDのデフォルト値
    const channel = channelId || '全体';

    // 新しい行を追加
    const newRow = [
      messageId,
      timestamp,
      senderName,
      senderPermission,
      channel,
      message.trim(),
      '' // 既読者リスト（Phase 2以降）
    ];

    sheet.appendRow(newRow);

    Logger.log('[sendMessage] メッセージを保存しました: ' + messageId);

    // FCM通知を送信（送信者以外の全ユーザーに）
    try {
      if (typeof sendChatNotification === 'function') {
        sendChatNotification(senderName, message, senderName);
      }
    } catch (notifError) {
      Logger.log('[sendMessage] 通知送信エラー（継続）: ' + notifError);
    }

    return {
      success: true,
      message: 'メッセージを送信しました',
      messageId: messageId,
      timestamp: timestamp,
      sender: senderName,
      senderPermission: senderPermission
    };
  } catch (error) {
    Logger.log('[sendMessage] ERROR: ' + error);
    return {
      success: false,
      message: 'エラー: ' + error.toString()
    };
  }
}

/**
 * メッセージ一覧を取得
 * @param {String} channelId - チャンネルID（Phase 1は'全体'固定）
 * @param {Number} limit - 取得件数（デフォルト100件）
 * @return {Array} メッセージ一覧
 */
function getMessages(channelId, limit) {
  try {
    Logger.log('[getMessages] メッセージ取得開始');
    Logger.log('[getMessages] channelId: ' + (channelId || '全体'));
    Logger.log('[getMessages] limit: ' + (limit || 100));

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CHAT_SHEET_NAME);

    if (!sheet) {
      Logger.log('[getMessages] チャットメッセージシートが見つかりません');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    // カラムインデックスを取得
    const messageIdCol = headers.indexOf('メッセージID');
    const timestampCol = headers.indexOf('タイムスタンプ');
    const senderCol = headers.indexOf('送信者');
    const senderPermissionCol = headers.indexOf('送信者権限');
    const channelCol = headers.indexOf('チャンネル');
    const messageCol = headers.indexOf('メッセージ');

    if (messageIdCol === -1 || timestampCol === -1 || senderCol === -1 || messageCol === -1) {
      Logger.log('[getMessages] ERROR: 必要なカラムが見つかりません');
      return [];
    }

    const messages = [];
    const targetChannel = channelId || '全体';
    const maxLimit = limit || 100;

    // データ行をループ（ヘッダー行を除く、最新から取得）
    for (let i = data.length - 1; i >= 1 && messages.length < maxLimit; i--) {
      const channel = data[i][channelCol];

      // チャンネルフィルタ
      if (channel !== targetChannel) {
        continue;
      }

      // タイムスタンプを文字列化
      let timestampStr = '';
      if (data[i][timestampCol]) {
        try {
          const date = new Date(data[i][timestampCol]);
          timestampStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
        } catch (e) {
          timestampStr = String(data[i][timestampCol]);
        }
      }

      const messageObj = {
        messageId: String(data[i][messageIdCol] || ''),
        timestamp: timestampStr,
        sender: String(data[i][senderCol] || ''),
        senderPermission: String(data[i][senderPermissionCol] || ''),
        channel: String(channel || ''),
        message: String(data[i][messageCol] || '')
      };

      messages.push(messageObj);
    }

    // 古い順に並び替え（画面では古いメッセージが上）
    messages.reverse();

    Logger.log('[getMessages] 取得件数: ' + messages.length);
    return messages;
  } catch (error) {
    Logger.log('[getMessages] ERROR: ' + error);
    return [];
  }
}

/**
 * FCM通知を送信（新着チャットメッセージ）
 * @param {String} senderName - 送信者名
 * @param {String} message - メッセージ本文
 * @param {String} excludeUser - 通知を送信しないユーザー（送信者自身）
 */
function sendChatNotification(senderName, message, excludeUser) {
  try {
    Logger.log('[sendChatNotification] 通知送信開始');
    Logger.log('[sendChatNotification] 送信者: ' + senderName);
    Logger.log('[sendChatNotification] 除外ユーザー: ' + excludeUser);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const fcmSheet = ss.getSheetByName('FCM通知登録');

    if (!fcmSheet) {
      Logger.log('[sendChatNotification] FCM通知登録シートが見つかりません');
      return;
    }

    const data = fcmSheet.getDataRange().getValues();
    const headers = data[0];

    const userNameCol = headers.indexOf('ユーザー名');
    const tokenCol = headers.indexOf('FCMトークン');
    const statusCol = headers.indexOf('ステータス');

    if (userNameCol === -1 || tokenCol === -1) {
      Logger.log('[sendChatNotification] 必要なカラムが見つかりません');
      return;
    }

    // 送信対象のトークンを収集
    const tokens = [];
    for (let i = 1; i < data.length; i++) {
      const userName = data[i][userNameCol];
      const token = data[i][tokenCol];
      const status = statusCol !== -1 ? data[i][statusCol] : '';

      // 除外ユーザーはスキップ
      if (userName === excludeUser) {
        continue;
      }

      // アクティブなユーザーのみ
      if (status !== 'アクティブ') {
        continue;
      }

      // トークンが有効
      if (token && token !== '') {
        tokens.push(token);
      }
    }

    if (tokens.length === 0) {
      Logger.log('[sendChatNotification] 送信対象のトークンがありません');
      return;
    }

    // メッセージ本文を短縮（通知用）
    let shortMessage = message.length > 50 ? message.substring(0, 50) + '...' : message;

    // FCM通知を送信
    const title = '💬 ' + senderName + 'さんからメッセージ';
    const body = shortMessage;

    Logger.log('[sendChatNotification] 送信対象: ' + tokens.length + '件');

    if (typeof sendFcmNotification === 'function') {
      sendFcmNotification(tokens, title, body, { type: 'chat', sender: senderName });
    } else {
      Logger.log('[sendChatNotification] sendFcmNotification関数が見つかりません');
    }
  } catch (error) {
    Logger.log('[sendChatNotification] ERROR: ' + error);
  }
}

// グローバル露出
globalThis.sendMessage = sendMessage;
globalThis.getMessages = getMessages;
globalThis.sendChatNotification = sendChatNotification;
