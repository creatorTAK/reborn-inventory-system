/**
 * シート保護機能
 * SEC-001: 権限列の不正変更防止
 */

/** @OnlyCurrentDoc */

// 保護対象シート名
const PROTECTED_SHEETS = [
  'FCM通知登録',
  'ユーザー権限管理'
];

/**
 * シート保護を設定
 * オーナーのみ編集可能、他のユーザーは閲覧のみ
 */
function setupSheetProtection() {
  try {
    Logger.log('[setupSheetProtection] シート保護設定開始');

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // オーナーのメールアドレスを取得
    const ownerEmails = getOwnerEmails();

    if (ownerEmails.length === 0) {
      Logger.log('[setupSheetProtection] WARNING: オーナーが見つかりません。保護設定をスキップします。');
      return {
        success: false,
        message: '管理者が見つかりません。先に管理者を設定してください。'
      };
    }

    Logger.log('[setupSheetProtection] オーナー: ' + ownerEmails.join(', '));

    let protectedCount = 0;

    // 各シートを保護
    for (const sheetName of PROTECTED_SHEETS) {
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        Logger.log('[setupSheetProtection] WARNING: シート "' + sheetName + '" が見つかりません');
        continue;
      }

      // 既存の保護を削除
      const existingProtections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);
      for (const protection of existingProtections) {
        protection.remove();
      }

      // 新しい保護を設定
      const protection = sheet.protect();
      protection.setDescription('管理者専用（SEC-001: 権限変更保護）');
      protection.setWarningOnly(false); // 編集禁止

      // オーナーのみ編集可能
      protection.removeEditors(protection.getEditors());
      protection.addEditors(ownerEmails);

      // ドメイン全体の編集を禁止
      if (protection.canDomainEdit()) {
        protection.setDomainEdit(false);
      }

      Logger.log('[setupSheetProtection] シート "' + sheetName + '" を保護しました');
      protectedCount++;
    }

    Logger.log('[setupSheetProtection] 完了: ' + protectedCount + '個のシートを保護');

    return {
      success: true,
      message: protectedCount + '個のシートを保護しました',
      protectedSheets: PROTECTED_SHEETS.slice(0, protectedCount)
    };
  } catch (error) {
    Logger.log('[setupSheetProtection] ERROR: ' + error);
    return {
      success: false,
      message: 'エラー: ' + error.toString()
    };
  }
}

/**
 * オーナーのメールアドレス一覧を取得
 * @return {Array<String>} オーナーのメールアドレス配列
 */
function getOwnerEmails() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FCM通知登録');

    if (!sheet) {
      Logger.log('[getOwnerEmails] FCM通知登録シートが見つかりません');
      return [];
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];

    const emailCol = headers.indexOf('メールアドレス');
    const permissionCol = headers.indexOf('権限');

    if (emailCol === -1 || permissionCol === -1) {
      Logger.log('[getOwnerEmails] 必要な列が見つかりません');
      return [];
    }

    const ownerEmails = [];

    for (let i = 1; i < data.length; i++) {
      const permission = data[i][permissionCol];
      const email = data[i][emailCol];

      if (permission === 'オーナー' && email && email !== '') {
        ownerEmails.push(email);
      }
    }

    return ownerEmails;
  } catch (error) {
    Logger.log('[getOwnerEmails] ERROR: ' + error);
    return [];
  }
}

/**
 * シート保護を解除（デバッグ用）
 * WARNING: 本番環境では使用しないこと
 */
function removeSheetProtection() {
  try {
    Logger.log('[removeSheetProtection] シート保護解除開始');

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let removedCount = 0;

    for (const sheetName of PROTECTED_SHEETS) {
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        continue;
      }

      const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);

      for (const protection of protections) {
        protection.remove();
        removedCount++;
      }

      Logger.log('[removeSheetProtection] シート "' + sheetName + '" の保護を解除しました');
    }

    Logger.log('[removeSheetProtection] 完了: ' + removedCount + '個の保護を解除');

    return {
      success: true,
      message: removedCount + '個の保護を解除しました'
    };
  } catch (error) {
    Logger.log('[removeSheetProtection] ERROR: ' + error);
    return {
      success: false,
      message: 'エラー: ' + error.toString()
    };
  }
}

/**
 * 保護状態を確認
 * @return {Object} 保護状態情報
 */
function checkSheetProtection() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const status = {};

    for (const sheetName of PROTECTED_SHEETS) {
      const sheet = ss.getSheetByName(sheetName);

      if (!sheet) {
        status[sheetName] = 'シートが存在しません';
        continue;
      }

      const protections = sheet.getProtections(SpreadsheetApp.ProtectionType.SHEET);

      if (protections.length === 0) {
        status[sheetName] = '保護なし';
      } else {
        const editors = protections[0].getEditors().map(user => user.getEmail());
        status[sheetName] = '保護済み（編集可能: ' + editors.join(', ') + '）';
      }
    }

    Logger.log('[checkSheetProtection] 保護状態: ' + JSON.stringify(status));

    return {
      success: true,
      status: status
    };
  } catch (error) {
    Logger.log('[checkSheetProtection] ERROR: ' + error);
    return {
      success: false,
      message: 'エラー: ' + error.toString()
    };
  }
}

// グローバル露出
globalThis.setupSheetProtection = setupSheetProtection;
globalThis.getOwnerEmails = getOwnerEmails;
globalThis.removeSheetProtection = removeSheetProtection;
globalThis.checkSheetProtection = checkSheetProtection;
