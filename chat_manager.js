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
 * @param {String} userName - GASからのアクセス時に明示的に指定するユーザー名（オプション）
 * @return {Object} 送信結果
 */
function sendMessage(message, channelId, fcmToken, userName) {
  try {
    Logger.log('[sendMessage] メッセージ送信開始');
    Logger.log('[sendMessage] message: ' + message);
    Logger.log('[sendMessage] channelId: ' + (channelId || '全体'));
    Logger.log('[sendMessage] fcmToken: ' + (fcmToken ? 'あり' : 'なし'));
    Logger.log('[sendMessage] userName: ' + (userName || 'なし'));

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

    // 優先順位1: GASから明示的に指定されたユーザー名
    if (userName) {
      senderName = userName;
      if (typeof getUserPermission === 'function') {
        senderPermission = getUserPermission(userName);
      }
      Logger.log('[sendMessage] ユーザー名が明示的に指定されました: ' + senderName);
    }

    // 優先順位2: PWAからのアクセスの場合、fcmTokenからユーザー名を取得
    if (!senderName && fcmToken) {
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
              Logger.log('[sendMessage] FCMトークンからユーザー名を取得: ' + senderName);
              break;
            }
          }
        }
      }
    }

    // 優先順位3: GASからのアクセスの場合、メールアドレスからユーザー名を取得（フォールバック）
    if (!senderName) {
      let email = '';

      try {
        // 共有スプレッドシートでも正確に取得できるSession.getEffectiveUser()を優先
        email = Session.getEffectiveUser().getEmail();
        Logger.log('[sendMessage] Session.getEffectiveUser(): ' + email);
      } catch (e) {
        Logger.log('[sendMessage] Session.getEffectiveUser()失敗、Session.getActiveUser()を試行');
        try {
          email = Session.getActiveUser().getEmail();
          Logger.log('[sendMessage] Session.getActiveUser(): ' + email);
        } catch (e2) {
          Logger.log('[sendMessage] Session.getActiveUser()も失敗: ' + e2);
        }
      }

      Logger.log('[sendMessage] 現在のユーザーメール: ' + email);

      if (email && typeof getUserNameByEmail === 'function') {
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

    // [REMOVED] GAS FCM通知 - Firebase Functions (onChatMessageCreated) がFirestoreトリガーで自動通知

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

// [REMOVED] sendChatNotification - Firebase Functions (onChatMessageCreated) がFirestoreトリガーで自動通知するため不要

/**
 * 新着メッセージを取得（Polling用）
 * @param {Number} lastCheckTime - 最終確認時刻（Unixタイムスタンプ ミリ秒）
 * @param {String} userName - 現在のユーザー名（自分のメッセージを除外）
 * @param {String} channelId - チャンネルID（省略時は'全体'）
 * @return {Array} 新着メッセージの配列
 */
function getNewMessages(lastCheckTime, userName, channelId) {
  try {
    Logger.log('[getNewMessages] 開始 - lastCheckTime: ' + lastCheckTime + ', userName: ' + userName);

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('チャットメッセージ');

    if (!sheet) {
      Logger.log('[getNewMessages] ERROR: チャットメッセージシートが見つかりません');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const messageIdCol = headers.indexOf('メッセージID');
    const timestampCol = headers.indexOf('タイムスタンプ');
    const senderCol = headers.indexOf('送信者');
    const senderPermissionCol = headers.indexOf('送信者権限');
    const channelCol = headers.indexOf('チャンネル');
    const messageCol = headers.indexOf('メッセージ');

    if (messageIdCol === -1 || timestampCol === -1 || senderCol === -1 || messageCol === -1) {
      Logger.log('[getNewMessages] ERROR: 必要なカラムが見つかりません');
      return [];
    }

    const newMessages = [];
    const targetChannel = channelId || '全体';
    const lastCheckDate = lastCheckTime ? new Date(lastCheckTime) : new Date(0);

    Logger.log('[getNewMessages] 検索条件 - チャンネル: ' + targetChannel + ', 最終確認: ' + lastCheckDate);

    // データ行をループ（最新から取得）
    for (let i = data.length - 1; i >= 1; i--) {
      const channel = data[i][channelCol];
      const sender = data[i][senderCol];
      const timestamp = data[i][timestampCol];

      // チャンネルフィルタ
      if (channel !== targetChannel) {
        continue;
      }

      // 自分のメッセージを除外
      if (sender === userName) {
        continue;
      }

      // タイムスタンプチェック
      if (timestamp) {
        const messageDate = new Date(timestamp);
        if (messageDate <= lastCheckDate) {
          // 古いメッセージに到達したらループ終了
          break;
        }

        // タイムスタンプを文字列化
        const timestampStr = Utilities.formatDate(messageDate, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

        const messageObj = {
          messageId: String(data[i][messageIdCol] || ''),
          timestamp: timestampStr,
          timestampMs: messageDate.getTime(), // ミリ秒も返す
          sender: String(sender || ''),
          senderPermission: String(data[i][senderPermissionCol] || ''),
          channel: String(channel || ''),
          message: String(data[i][messageCol] || '')
        };

        newMessages.push(messageObj);
      }
    }

    // 古い順に並び替え（画面では古いメッセージが上）
    newMessages.reverse();

    Logger.log('[getNewMessages] 新着件数: ' + newMessages.length);
    return newMessages;
  } catch (error) {
    Logger.log('[getNewMessages] ERROR: ' + error);
    return [];
  }
}

// グローバル露出
globalThis.sendMessage = sendMessage;
globalThis.getMessages = getMessages;
globalThis.getNewMessages = getNewMessages;
