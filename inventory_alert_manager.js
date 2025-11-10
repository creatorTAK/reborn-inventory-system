/**
 * inventory_alert_manager.js
 * INV-006: 在庫アラートのプッシュ通知機能
 *
 * 機能:
 * - 在庫アラート設定の管理
 * - 在庫アラート判定ロジック
 * - プッシュ通知の送信
 */

// =============================================================================
// 定数定義
// =============================================================================
const INVENTORY_ALERT_SHEET = '在庫アラート設定';
const PACKAGING_MATERIALS_SHEET = '備品在庫リスト';

// アラート通知の最小間隔（ミリ秒）- 同じ資材に対して24時間以内に重複通知しない
const ALERT_MIN_INTERVAL = 24 * 60 * 60 * 1000; // 24時間

// =============================================================================
// Phase 1: 在庫アラート設定シートの初期化
// =============================================================================

/**
 * 在庫アラート設定シートを取得または作成
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getInventoryAlertSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(INVENTORY_ALERT_SHEET);

  if (!sheet) {
    sheet = createInventoryAlertSheet(ss);
  }

  return sheet;
}

/**
 * 在庫アラート設定シートの保護を解除
 */
function removeInventoryAlertSheetProtection() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(INVENTORY_ALERT_SHEET);

    if (!sheet) {
      return {
        success: false,
        message: '在庫アラート設定シートが見つかりません'
      };
    }

    // シート全体の保護を解除
    const sheetProtections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    for (const protection of sheetProtections) {
      protection.remove();
      Logger.log('[在庫アラート] シート全体の保護を解除: ' + protection.getDescription());
    }

    // 範囲の保護を解除
    const rangeProtections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
    for (const protection of rangeProtections) {
      protection.remove();
      Logger.log('[在庫アラート] 範囲の保護を解除: ' + protection.getDescription());
    }

    return {
      success: true,
      message: '在庫アラート設定シートの保護を解除しました（シート保護: ' + sheetProtections.length + '件、範囲保護: ' + rangeProtections.length + '件）'
    };
  } catch (error) {
    Logger.log('[在庫アラート] 保護解除エラー: ' + error);
    return {
      success: false,
      message: 'エラー: ' + error.toString()
    };
  }
}

/**
 * 在庫アラート設定シートを新規作成
 * @param {GoogleAppsScript.Spreadsheet.Spreadsheet} ss
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function createInventoryAlertSheet(ss) {
  const sheet = ss.insertSheet(INVENTORY_ALERT_SHEET);

  // ヘッダー行を作成
  const headers = [
    '資材名',
    'カテゴリ',
    '在庫アラート閾値',
    '通知有効',
    '最終通知日時',
    '備考'
  ];

  sheet.appendRow(headers);

  // ヘッダー行のフォーマット
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold')
    .setBackground('#4285f4')
    .setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // 列幅を設定
  sheet.setColumnWidth(1, 200); // 資材名
  sheet.setColumnWidth(2, 120); // カテゴリ
  sheet.setColumnWidth(3, 120); // 閾値
  sheet.setColumnWidth(4, 100); // 通知有効
  sheet.setColumnWidth(5, 180); // 最終通知日時
  sheet.setColumnWidth(6, 200); // 備考

  // データの入力規則を設定（通知有効列）
  const validationRange = sheet.getRange(2, 4, 1000, 1);
  const validationRule = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .setAllowInvalid(false)
    .build();
  validationRange.setDataValidation(validationRule);

  // シート保護なし（オーナーが自由に編集可能）

  Logger.log('[在庫アラート] 在庫アラート設定シートを作成しました');

  return sheet;
}

/**
 * 備品在庫リストから全資材を読み込み、在庫アラート設定シートを初期化
 * （既存の設定は保持、新しい資材のみ追加）
 * @returns {Object} { success: boolean, message: string, addedCount: number }
 */
function initializeInventoryAlertSettings() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const materialsSheet = ss.getSheetByName(PACKAGING_MATERIALS_SHEET);

    if (!materialsSheet) {
      return {
        success: false,
        message: '「備品在庫リスト」シートが見つかりません'
      };
    }

    const alertSheet = getInventoryAlertSheet();

    // 備品在庫リストから資材データを取得
    const materialsData = materialsSheet.getDataRange().getValues();
    const materialsHeaders = materialsData[0];

    // 列インデックスを取得
    const nameColIndex = materialsHeaders.indexOf('商品名');
    const categoryColIndex = materialsHeaders.indexOf('カテゴリ');

    if (nameColIndex === -1) {
      return {
        success: false,
        message: '「商品名」列が見つかりません'
      };
    }

    // 既存のアラート設定を取得
    const existingAlerts = {};
    const alertData = alertSheet.getDataRange().getValues();

    for (let i = 1; i < alertData.length; i++) {
      const materialName = alertData[i][0];
      if (materialName) {
        existingAlerts[materialName] = true;
      }
    }

    // 新しい資材を追加
    let addedCount = 0;
    for (let i = 1; i < materialsData.length; i++) {
      const materialName = materialsData[i][nameColIndex];
      const category = categoryColIndex !== -1 ? materialsData[i][categoryColIndex] : '';

      // 商品名が空の場合はスキップ
      if (!materialName) continue;

      // 既に設定が存在する場合はスキップ
      if (existingAlerts[materialName]) continue;

      // 新しい資材を追加（デフォルト: 閾値10、通知有効）
      alertSheet.appendRow([
        materialName,
        category,
        10, // デフォルト閾値
        true, // デフォルトで通知有効
        '', // 最終通知日時（空）
        '自動追加'
      ]);

      addedCount++;
    }

    Logger.log(`[在庫アラート] ${addedCount}件の新しい資材を追加しました`);

    return {
      success: true,
      message: `${addedCount}件の新しい資材を追加しました`,
      addedCount: addedCount
    };

  } catch (error) {
    Logger.log('[在庫アラート] 初期化エラー: ' + error);
    return {
      success: false,
      message: `初期化エラー: ${error.message}`
    };
  }
}

// =============================================================================
// Phase 2: アラート判定ロジック
// =============================================================================

/**
 * 全資材の在庫をチェックし、アラート対象を取得
 * @returns {Array<Object>} アラート対象の資材リスト
 */
function checkInventoryAlerts() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const materialsSheet = ss.getSheetByName(PACKAGING_MATERIALS_SHEET);
    const alertSheet = getInventoryAlertSheet();

    if (!materialsSheet) {
      Logger.log('[在庫アラート] 「備品在庫リスト」シートが見つかりません');
      return [];
    }

    // アラート設定を取得
    const alertSettings = getInventoryAlertSettings();

    // 備品在庫リストから現在の在庫を取得
    const materialsData = materialsSheet.getDataRange().getValues();
    const headers = materialsData[0];

    const nameColIndex = headers.indexOf('商品名');
    const inventoryColIndex = headers.indexOf('在庫数');

    if (nameColIndex === -1 || inventoryColIndex === -1) {
      Logger.log('[在庫アラート] 必要な列が見つかりません');
      return [];
    }

    // 在庫をマップに格納
    const currentInventory = {};
    for (let i = 1; i < materialsData.length; i++) {
      const materialName = materialsData[i][nameColIndex];
      const inventory = Number(materialsData[i][inventoryColIndex]) || 0;

      if (materialName) {
        currentInventory[materialName] = inventory;
        Logger.log(`[備品在庫] ${materialName}: ${inventory}`);
      }
    }

    Logger.log(`[備品在庫] 登録資材数: ${Object.keys(currentInventory).length}件`);

    // アラート対象をチェック
    const alertTargets = [];

    alertSettings.forEach(setting => {
      const { materialName, threshold, notificationEnabled, lastAlertTime } = setting;

      Logger.log(`[在庫チェック] 資材: ${materialName}, 閾値: ${threshold}, 通知有効: ${notificationEnabled}`);

      // 通知が無効の場合はスキップ
      if (!notificationEnabled) {
        Logger.log(`[在庫チェック] ${materialName}: 通知無効のためスキップ`);
        return;
      }

      // 現在の在庫を取得
      const currentStock = currentInventory[materialName];
      Logger.log(`[在庫チェック] ${materialName}: 現在在庫=${currentStock} (${currentStock === undefined ? 'マッチングなし' : 'OK'})`);
      
      if (currentStock === undefined) {
        Logger.log(`[在庫チェック] ${materialName}: 備品在庫リストに該当する資材名が見つかりません`);
        return;
      }

      // 閾値チェック
      Logger.log(`[在庫チェック] ${materialName}: 閾値チェック ${currentStock} <= ${threshold} = ${currentStock <= threshold}`);
      
      if (currentStock <= threshold) {
        // 重複通知を防ぐ（24時間以内に通知済みの場合はスキップ）
        const shouldSend = shouldSendAlert(lastAlertTime);
        Logger.log(`[在庫チェック] ${materialName}: 24時間チェック shouldSend=${shouldSend}, lastAlertTime=${lastAlertTime}`);
        
        if (shouldSend) {
          alertTargets.push({
            materialName: materialName,
            category: setting.category,
            currentStock: currentStock,
            threshold: threshold
          });
        }
      }
    });

    Logger.log(`[在庫アラート] ${alertTargets.length}件のアラート対象を検出`);

    return alertTargets;

  } catch (error) {
    Logger.log('[在庫アラート] チェックエラー: ' + error);
    return [];
  }
}

/**
 * 在庫アラート設定を取得
 * @returns {Array<Object>} アラート設定のリスト
 */
function getInventoryAlertSettings() {
  try {
    const sheet = getInventoryAlertSheet();
    // 実際のデータ行数のみ取得（効率化）
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      Logger.log('[在庫アラート] 設定データがありません');
      return [];
    }
    
    const data = sheet.getRange(1, 1, lastRow, 5).getValues();

    const settings = [];

    for (let i = 1; i < data.length; i++) {
      const materialName = data[i][0];

      // 資材名が空の場合はスキップ（空白行）
      if (!materialName || materialName.toString().trim() === '') {
        continue;
      }

      const category = data[i][1];
      const threshold = Number(data[i][2]) || 0;
      // チェックボックスは TRUE（文字列）または true（boolean）になるため、両方対応
      const notificationEnabled = data[i][3] === true || data[i][3] === 'TRUE' || data[i][3] === 'true';
      const lastAlertTime = data[i][4];

      Logger.log(`[在庫アラート設定] ${materialName}: 通知=${notificationEnabled} (元の値: ${data[i][3]}, 型: ${typeof data[i][3]})`);

      settings.push({
        rowIndex: i + 1, // スプレッドシートの行番号
        materialName: materialName,
        category: category,
        threshold: threshold,
        notificationEnabled: notificationEnabled,
        lastAlertTime: lastAlertTime
      });
    }

    return settings;

  } catch (error) {
    Logger.log('[在庫アラート] 設定取得エラー: ' + error);
    return [];
  }
}

/**
 * 通知を送るべきか判定（重複防止）
 * @param {Date|String} lastAlertTime - 最終通知日時
 * @returns {Boolean} 通知を送るべきか
 */
function shouldSendAlert(lastAlertTime) {
  // 24時間制限を削除：常に通知を送信
  // 在庫が閾値以下の間は毎回通知、在庫が回復すれば自動停止
  // 通知停止は「通知有効」チェックボックスで制御
  return true;
}

/**
 * 最終通知日時を更新
 * @param {String} materialName - 資材名
 * @returns {Boolean} 更新成功/失敗
 */
function updateLastAlertTime(materialName) {
  try {
    const sheet = getInventoryAlertSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === materialName) {
        // 最終通知日時を現在時刻に更新
        sheet.getRange(i + 1, 5).setValue(new Date());
        Logger.log(`[在庫アラート] 最終通知日時を更新: ${materialName}`);
        return true;
      }
    }

    return false;

  } catch (error) {
    Logger.log('[在庫アラート] 最終通知日時更新エラー: ' + error);
    return false;
  }
}

// =============================================================================
// Phase 3: 通知送信機能
// =============================================================================

/**
 * 在庫アラート通知を送信（Webhook + FCM）
 * @param {Array<Object>} alertTargets - アラート対象の資材リスト
 * @returns {Object} { success: boolean, message: string, sentCount: number }
 */
function sendInventoryAlertNotifications(alertTargets) {
  try {
    if (!alertTargets || alertTargets.length === 0) {
      return {
        success: true,
        message: 'アラート対象がありません',
        sentCount: 0
      };
    }

    // オーナー権限のユーザーのみを取得
    const allUsers = getAllUserNames();
    const ownerUsers = allUsers.filter(function(userName) {
      if (!userName || userName === 'システム') return false;
      const permission = getUserPermission(userName);
      return permission === 'オーナー';
    });

    Logger.log(`[在庫アラート] オーナーユーザー: ${ownerUsers.length}人`);

    // 通知メッセージを作成
    const title = '⚠️ 在庫アラート';
    let body = '以下の梱包資材の在庫が不足しています:\n\n';

    alertTargets.forEach((target, index) => {
      body += `${index + 1}. ${target.materialName} (${target.category})\n`;
      body += `   現在: ${target.currentStock} / 閾値: ${target.threshold}\n`;
    });

    // Webhook送信用のnotificationDataを作成
    const notificationData = {
      type: 'INVENTORY_ALERT',
      roomId: 'room_inventory_alert',  // 在庫アラート専用ルーム
      userName: 'システム',
      timestamp: new Date().toISOString(),
      content: body,
      sender: 'システム',
      title: title,
      targetUsers: ownerUsers  // オーナーのみ
    };

    // 🌐 Webhook送信（Firestoreに投稿）
    try {
      Logger.log('[在庫アラート] Webhook送信開始');
      const webhookResult = sendWebhookNotification(notificationData);
      Logger.log('[在庫アラート] Webhook送信完了: ' + JSON.stringify(webhookResult));
    } catch (webhookError) {
      Logger.log('[在庫アラート] Webhook送信エラー: ' + webhookError);
      // Webhookエラーでも処理継続（FCM通知は送る）
    }

    // 🔔 FCM通知を送信（オーナーのみに送信）
    const fcmResult = sendFCMNotificationByPermission(title, body, 'オーナー', 'system');

    if (fcmResult.status === 'success') {
      // 各資材の最終通知日時を更新
      alertTargets.forEach(target => {
        updateLastAlertTime(target.materialName);
      });

      Logger.log(`[在庫アラート] ${alertTargets.length}件のアラート通知を送信しました`);

      return {
        success: true,
        message: `${alertTargets.length}件のアラート通知を送信しました`,
        sentCount: alertTargets.length
      };
    } else {
      Logger.log('[在庫アラート] FCM通知送信に失敗: ' + fcmResult.message);
      return {
        success: false,
        message: 'FCM通知送信に失敗: ' + fcmResult.message,
        sentCount: 0
      };
    }

  } catch (error) {
    Logger.log('[在庫アラート] 通知送信エラー: ' + error);
    return {
      success: false,
      message: `通知送信エラー: ${error.message}`,
      sentCount: 0
    };
  }
}

/**
 * 在庫アラートを実行（チェック + 通知送信）
 * @returns {Object} { success: boolean, message: string, alertCount: number }
 */
function runInventoryAlertCheck() {
  try {
    Logger.log('[在庫アラート] アラートチェックを開始します');

    // 在庫をチェック
    const alertTargets = checkInventoryAlerts();

    if (alertTargets.length === 0) {
      Logger.log('[在庫アラート] アラート対象はありません');
      return {
        success: true,
        message: 'アラート対象はありません',
        alertCount: 0
      };
    }

    // 通知を送信
    const result = sendInventoryAlertNotifications(alertTargets);

    return {
      success: result.success,
      message: result.message,
      alertCount: alertTargets.length
    };

  } catch (error) {
    Logger.log('[在庫アラート] 実行エラー: ' + error);
    return {
      success: false,
      message: `実行エラー: ${error.message}`,
      alertCount: 0
    };
  }
}

// =============================================================================
// API関数（PWA/スプレッドシートから呼び出し）
// =============================================================================

/**
 * 在庫アラート設定を取得（API）
 * @returns {Object} { success: boolean, data: Array, message: string }
 */
function getInventoryAlertSettingsAPI() {
  try {
    const settings = getInventoryAlertSettings();

    return {
      success: true,
      data: settings,
      message: `${settings.length}件の設定を取得しました`
    };

  } catch (error) {
    Logger.log('[在庫アラート API] 取得エラー: ' + error);
    return {
      success: false,
      data: [],
      message: `取得エラー: ${error.message}`
    };
  }
}

/**
 * 在庫アラート設定を更新（API）
 * @param {String} materialName - 資材名
 * @param {Number} threshold - 閾値
 * @param {Boolean} notificationEnabled - 通知有効/無効
 * @returns {Object} { success: boolean, message: string }
 */
function updateInventoryAlertSettingAPI(materialName, threshold, notificationEnabled) {
  try {
    const sheet = getInventoryAlertSheet();
    const data = sheet.getDataRange().getValues();

    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === materialName) {
        // 閾値を更新
        if (threshold !== undefined) {
          sheet.getRange(i + 1, 3).setValue(Number(threshold));
        }

        // 通知有効/無効を更新
        if (notificationEnabled !== undefined) {
          sheet.getRange(i + 1, 4).setValue(notificationEnabled);
        }

        Logger.log(`[在庫アラート API] 設定を更新: ${materialName}`);

        return {
          success: true,
          message: '設定を更新しました'
        };
      }
    }

    return {
      success: false,
      message: `資材「${materialName}」が見つかりません`
    };

  } catch (error) {
    Logger.log('[在庫アラート API] 更新エラー: ' + error);
    return {
      success: false,
      message: `更新エラー: ${error.message}`
    };
  }
}

/**
 * 在庫アラートを手動実行（API）
 * @returns {Object} { success: boolean, message: string, alertCount: number }
 */
function runInventoryAlertCheckAPI() {
  return runInventoryAlertCheck();
}

// =============================================================================
// Phase 5: 定期実行トリガー管理
// =============================================================================

/**
 * 定期実行トリガーを設定（毎日指定時刻に実行）
 * @param {Number} hour - 実行時刻（0-23）
 * @returns {Object} { success: boolean, message: string, triggerId: string }
 */
function setupDailyInventoryAlertTrigger(hour = 9) {
  try {
    // 既存のトリガーを削除
    const result = removeDailyInventoryAlertTrigger();
    Logger.log(`[在庫アラート トリガー] 既存トリガー削除: ${result.message}`);

    // 新しいトリガーを作成（毎日指定時刻）
    const trigger = ScriptApp.newTrigger('runInventoryAlertCheck')
      .timeBased()
      .atHour(hour)
      .everyDays(1)
      .create();

    const triggerId = trigger.getUniqueId();

    Logger.log(`[在庫アラート トリガー] 新しいトリガーを作成: ${triggerId}（毎日 ${hour}:00）`);

    return {
      success: true,
      message: `毎日 ${hour}:00 に在庫アラートを実行するトリガーを設定しました`,
      triggerId: triggerId
    };

  } catch (error) {
    Logger.log('[在庫アラート トリガー] 設定エラー: ' + error);
    return {
      success: false,
      message: `トリガー設定エラー: ${error.message}`,
      triggerId: null
    };
  }
}

/**
 * 定期実行トリガーを削除
 * @returns {Object} { success: boolean, message: string, deletedCount: number }
 */
function removeDailyInventoryAlertTrigger() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    let deletedCount = 0;

    triggers.forEach(trigger => {
      // runInventoryAlertCheck関数のトリガーを削除
      if (trigger.getHandlerFunction() === 'runInventoryAlertCheck') {
        ScriptApp.deleteTrigger(trigger);
        deletedCount++;
        Logger.log(`[在庫アラート トリガー] 削除: ${trigger.getUniqueId()}`);
      }
    });

    return {
      success: true,
      message: `${deletedCount}件のトリガーを削除しました`,
      deletedCount: deletedCount
    };

  } catch (error) {
    Logger.log('[在庫アラート トリガー] 削除エラー: ' + error);
    return {
      success: false,
      message: `トリガー削除エラー: ${error.message}`,
      deletedCount: 0
    };
  }
}

/**
 * 現在のトリガー設定を取得
 * @returns {Object} { success: boolean, triggers: Array }
 */
function getInventoryAlertTriggers() {
  try {
    const triggers = ScriptApp.getProjectTriggers();
    const inventoryAlertTriggers = [];

    triggers.forEach(trigger => {
      if (trigger.getHandlerFunction() === 'runInventoryAlertCheck') {
        const triggerInfo = {
          id: trigger.getUniqueId(),
          handlerFunction: trigger.getHandlerFunction(),
          eventType: trigger.getEventType().toString(),
          triggerSource: trigger.getTriggerSource().toString()
        };

        // 時間ベーストリガーの場合、詳細情報を追加
        if (trigger.getEventType() === ScriptApp.EventType.CLOCK) {
          // トリガーの詳細情報を文字列化
          triggerInfo.description = `毎日実行（詳細はApps Scriptエディタで確認してください）`;
        }

        inventoryAlertTriggers.push(triggerInfo);
      }
    });

    return {
      success: true,
      triggers: inventoryAlertTriggers,
      message: `${inventoryAlertTriggers.length}件のトリガーが設定されています`
    };

  } catch (error) {
    Logger.log('[在庫アラート トリガー] 取得エラー: ' + error);
    return {
      success: false,
      triggers: [],
      message: `トリガー取得エラー: ${error.message}`
    };
  }
}

/**
 * トリガー設定API（時刻指定）
 * @param {Number} hour - 実行時刻（0-23）
 * @returns {Object} { success: boolean, message: string }
 */
function setupDailyInventoryAlertTriggerAPI(hour) {
  const hourInt = parseInt(hour);

  if (isNaN(hourInt) || hourInt < 0 || hourInt > 23) {
    return {
      success: false,
      message: '実行時刻は0〜23の範囲で指定してください'
    };
  }

  return setupDailyInventoryAlertTrigger(hourInt);
}

/**
 * トリガー削除API
 * @returns {Object} { success: boolean, message: string }
 */
function removeDailyInventoryAlertTriggerAPI() {
  return removeDailyInventoryAlertTrigger();
}

/**
 * トリガー一覧取得API
 * @returns {Object} { success: boolean, triggers: Array }
 */
function getInventoryAlertTriggersAPI() {
  return getInventoryAlertTriggers();
}
