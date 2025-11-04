/**
 * チャットメッセージシート セットアップスクリプト
 * CHAT-001: チーム内チャット機能
 */

/** @OnlyCurrentDoc */

// シート名定義（chat_manager.jsで定義済み）
// const CHAT_SHEET_NAME = 'チャットメッセージ';

/**
 * チャットメッセージシートを作成
 * メニューから手動実行、または初回アクセス時に自動実行
 */
function setupChatMessagesSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(CHAT_SHEET_NAME);

    // 既に存在する場合はスキップ
    if (sheet) {
      Logger.log('[setupChatMessagesSheet] チャットメッセージシートは既に存在します');
      return {
        success: true,
        message: 'チャットメッセージシートは既に存在します',
        alreadyExists: true
      };
    }

    // シート作成
    sheet = ss.insertSheet(CHAT_SHEET_NAME);
    Logger.log('[setupChatMessagesSheet] チャットメッセージシートを作成しました');

    // ヘッダー行を設定
    const headers = [
      'メッセージID',    // A列: 一意のID（タイムスタンプベース）
      'タイムスタンプ',  // B列: 送信日時
      '送信者',          // C列: 送信者ユーザー名
      '送信者権限',      // D列: 送信時の権限（オーナー/スタッフ/外注）
      'チャンネル',      // E列: チャンネル名（Phase 1は'全体'固定）
      'メッセージ',      // F列: メッセージ本文
      '既読者リスト'     // G列: 既読したユーザー名のカンマ区切りリスト（Phase 2以降）
    ];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // ヘッダー行のスタイル設定
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#667eea');
    headerRange.setFontColor('#ffffff');
    headerRange.setFontWeight('bold');
    headerRange.setHorizontalAlignment('center');

    // 列幅を調整
    sheet.setColumnWidth(1, 180);  // メッセージID
    sheet.setColumnWidth(2, 160);  // タイムスタンプ
    sheet.setColumnWidth(3, 120);  // 送信者
    sheet.setColumnWidth(4, 100);  // 送信者権限
    sheet.setColumnWidth(5, 100);  // チャンネル
    sheet.setColumnWidth(6, 400);  // メッセージ
    sheet.setColumnWidth(7, 200);  // 既読者リスト

    // シートを固定（ヘッダー行）
    sheet.setFrozenRows(1);

    // サンプルデータを追加（開発・テスト用）
    const now = new Date();
    const sampleData = [
      [
        'msg_' + now.getTime(),
        Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
        'システム',
        'システム',
        '全体',
        'チャット機能へようこそ！ここでチーム全員とメッセージをやり取りできます。',
        ''
      ]
    ];

    sheet.getRange(2, 1, sampleData.length, headers.length).setValues(sampleData);

    Logger.log('[setupChatMessagesSheet] セットアップ完了');

    return {
      success: true,
      message: 'チャットメッセージシートを作成しました',
      sheetName: CHAT_SHEET_NAME
    };
  } catch (error) {
    Logger.log('[setupChatMessagesSheet] ERROR: ' + error);
    return {
      success: false,
      message: 'エラー: ' + error.toString()
    };
  }
}

/**
 * チャットメッセージシートが存在するかチェック
 * @return {Boolean} 存在する場合 true
 */
function chatSheetExists() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CHAT_SHEET_NAME);
  return sheet !== null;
}

/**
 * チャットメッセージシートをクリア（テスト用）
 * WARNING: 全てのメッセージが削除されます
 */
function clearChatMessages() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CHAT_SHEET_NAME);

    if (!sheet) {
      return {
        success: false,
        message: 'チャットメッセージシートが見つかりません'
      };
    }

    // ヘッダー行以外を削除
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.deleteRows(2, lastRow - 1);
    }

    Logger.log('[clearChatMessages] チャットメッセージをクリアしました');

    return {
      success: true,
      message: 'チャットメッセージをクリアしました'
    };
  } catch (error) {
    Logger.log('[clearChatMessages] ERROR: ' + error);
    return {
      success: false,
      message: 'エラー: ' + error.toString()
    };
  }
}

// グローバル露出
globalThis.setupChatMessagesSheet = setupChatMessagesSheet;
globalThis.chatSheetExists = chatSheetExists;
globalThis.clearChatMessages = clearChatMessages;
