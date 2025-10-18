/**
 * api_key_validator.js
 *
 * APIキー検証モジュール
 * すべてのAPIキーが正しく設定されているかを確認し、実際に動作するかをテストする
 *
 * @module api_key_validator
 */

// =============================================================================
// 定数定義
// =============================================================================

/**
 * 正しいAPIキーの値（DEVELOPMENT_SERVICES.mdと一致）
 * @const {Object}
 */
const CORRECT_API_KEYS = {
  GEMINI_API_KEY: 'AIzaSyArK3GbavlVNno9Y8Scx0i4Q1q6KOijoLA',  // reborn-gemini-api
  FIREBASE_API_KEY: 'AIzaSyAwJKTz1gm3CIz_R4YTlbQopgaBq1ULt1A'  // reborn-pwa
};

/**
 * 正しいFirebase設定（DEVELOPMENT_SERVICES.mdと一致）
 * @const {Object}
 */
const CORRECT_FIREBASE_CONFIG = {
  projectId: 'reborn-pwa',
  authDomain: 'reborn-pwa.firebaseapp.com',
  messagingSenderId: '345653439471',
  appId: '1:345653439471:web:7620819ce3f022d9cd241a'
};

// =============================================================================
// メイン検証関数
// =============================================================================

/**
 * すべてのAPIキーを検証してレポートを表示
 */
function validateAllApiKeys() {
  const results = [];

  Logger.log('=== APIキー検証開始 ===');

  // 1. Script Properties検証
  results.push(validateScriptProperties());

  // 2. Gemini API Key検証
  results.push(validateGeminiApiKey());

  // 3. Firebase設定検証（docs/index.html）
  results.push(validateFirebaseConfigInFiles());

  // 4. 全体サマリー
  const summary = generateSummary(results);

  Logger.log('=== APIキー検証完了 ===');

  // HTMLレポートを表示
  const html = generateReportHtml(results, summary);
  const htmlOutput = HtmlService.createHtmlOutput(html)
    .setWidth(700)
    .setHeight(500);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, '🔧 APIキー検証結果');
}

// =============================================================================
// 個別検証関数
// =============================================================================

/**
 * Script Propertiesの検証
 * @returns {Object} 検証結果
 */
function validateScriptProperties() {
  Logger.log('Script Properties検証開始...');

  try {
    const props = PropertiesService.getScriptProperties();
    const geminiKey = props.getProperty('GEMINI_API_KEY');
    const oauth2Fcm = props.getProperty('oauth2.fcm');

    const issues = [];

    // GEMINI_API_KEYチェック
    if (!geminiKey) {
      issues.push('❌ GEMINI_API_KEY が設定されていません');
    } else if (geminiKey !== CORRECT_API_KEYS.GEMINI_API_KEY) {
      issues.push(`❌ GEMINI_API_KEY が間違っています
期待値: ${CORRECT_API_KEYS.GEMINI_API_KEY}
実際値: ${geminiKey}`);
    } else {
      issues.push('✅ GEMINI_API_KEY 正常');
    }

    // oauth2.fcmチェック
    if (!oauth2Fcm) {
      issues.push('⚠️ oauth2.fcm が存在しません（初回実行時は正常）');
    } else {
      issues.push('✅ oauth2.fcm 存在確認');
    }

    const hasError = issues.some(msg => msg.startsWith('❌'));

    return {
      name: '🔑 Script Properties',
      status: hasError ? 'error' : 'success',
      details: issues
    };
  } catch (error) {
    Logger.log('Script Properties検証エラー: ' + error);
    return {
      name: '🔑 Script Properties',
      status: 'error',
      details: [`❌ エラー: ${error.toString()}`]
    };
  }
}

/**
 * Gemini APIキーを実際に呼び出してテスト
 * @returns {Object} 検証結果
 */
function validateGeminiApiKey() {
  Logger.log('Gemini API検証開始...');

  try {
    const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

    if (!apiKey) {
      return {
        name: '🤖 Gemini API',
        status: 'error',
        details: ['❌ APIキーが設定されていないためテストスキップ']
      };
    }

    // 実際にAPIを呼び出してテスト
    const testResult = testGeminiApi(apiKey);

    if (testResult.success) {
      return {
        name: '🤖 Gemini API',
        status: 'success',
        details: [
          '✅ API呼び出し成功',
          `レスポンスコード: ${testResult.statusCode}`,
          'API接続正常'
        ]
      };
    } else {
      return {
        name: '🤖 Gemini API',
        status: 'error',
        details: [
          '❌ API呼び出し失敗',
          `エラー: ${testResult.error}`,
          'APIキーまたはプロジェクト設定を確認してください'
        ]
      };
    }
  } catch (error) {
    Logger.log('Gemini API検証エラー: ' + error);
    return {
      name: '🤖 Gemini API',
      status: 'error',
      details: [`❌ エラー: ${error.toString()}`]
    };
  }
}

/**
 * Gemini APIをテスト呼び出し
 * @param {string} apiKey - APIキー
 * @returns {Object} テスト結果
 */
function testGeminiApi(apiKey) {
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;
    const payload = {
      contents: [{
        parts: [{ text: "Hello, Gemini!" }]
      }]
    };

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();

    return {
      success: statusCode === 200,
      statusCode: statusCode,
      error: statusCode !== 200 ? response.getContentText() : null
    };
  } catch (error) {
    return {
      success: false,
      error: error.toString()
    };
  }
}

/**
 * Firebaseファイル設定の検証（読み取り専用・参考情報）
 * @returns {Object} 検証結果
 */
function validateFirebaseConfigInFiles() {
  Logger.log('Firebase設定検証開始...');

  // 注意: GASからHTMLファイルの内容を直接読み取ることはできないため、
  // ここでは参考情報として正しい値を表示するのみ

  return {
    name: '🔥 Firebase設定（参考）',
    status: 'info',
    details: [
      '📋 以下のファイルを手動で確認してください：',
      '',
      '1. docs/index.html (344行目付近)',
      `   apiKey: "${CORRECT_API_KEYS.FIREBASE_API_KEY}"`,
      `   projectId: "${CORRECT_FIREBASE_CONFIG.projectId}"`,
      '',
      '2. docs/firebase-messaging-sw.js (16行目付近)',
      `   apiKey: "${CORRECT_API_KEYS.FIREBASE_API_KEY}"`,
      '',
      '⚠️ 重要: apiKeyは「R4YTlbQo」（小文字l、小文字o）',
      '   NG例: R4YT1bQO（数字1、大文字O）'
    ]
  };
}

// =============================================================================
// レポート生成
// =============================================================================

/**
 * サマリーを生成
 * @param {Array} results - 検証結果の配列
 * @returns {Object} サマリー
 */
function generateSummary(results) {
  const errorCount = results.filter(r => r.status === 'error').length;
  const successCount = results.filter(r => r.status === 'success').length;
  const infoCount = results.filter(r => r.status === 'info').length;

  return {
    total: results.length,
    errorCount: errorCount,
    successCount: successCount,
    infoCount: infoCount,
    allGreen: errorCount === 0
  };
}

/**
 * HTMLレポートを生成
 * @param {Array} results - 検証結果の配列
 * @param {Object} summary - サマリー
 * @returns {string} HTML文字列
 */
function generateReportHtml(results, summary) {
  const statusIcon = summary.allGreen ? '✅' : '❌';
  const statusText = summary.allGreen
    ? 'すべてのAPIキーが正常です'
    : `${summary.errorCount}件のエラーがあります`;
  const statusColor = summary.allGreen ? '#10b981' : '#ef4444';

  let html = `
<!DOCTYPE html>
<html>
<head>
  <base target="_top">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 20px;
      background: #f9fafb;
    }

    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 24px;
      border-radius: 12px 12px 0 0;
      margin-bottom: 0;
    }

    .header h2 {
      font-size: 24px;
      margin-bottom: 8px;
    }

    .header p {
      font-size: 14px;
      opacity: 0.9;
    }

    .summary {
      background: ${statusColor};
      color: white;
      padding: 16px 24px;
      border-radius: 0;
      font-size: 18px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .results {
      background: white;
      padding: 24px;
      border-radius: 0 0 12px 12px;
    }

    .result-item {
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid #e5e7eb;
    }

    .result-item:last-child {
      border-bottom: none;
      margin-bottom: 0;
      padding-bottom: 0;
    }

    .result-title {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .result-detail {
      font-size: 14px;
      line-height: 1.6;
      color: #4b5563;
      white-space: pre-wrap;
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    }

    .status-success { color: #10b981; }
    .status-error { color: #ef4444; }
    .status-info { color: #3b82f6; }

    .footer {
      text-align: center;
      margin-top: 16px;
      padding: 16px;
      background: white;
      border-radius: 12px;
      font-size: 14px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>🔧 APIキー検証レポート</h2>
    <p>すべてのAPIキーと設定を検証しました</p>
  </div>

  <div class="summary">
    <span>${statusIcon}</span>
    <span>${statusText}</span>
  </div>

  <div class="results">
`;

  // 各検証結果を追加
  results.forEach(result => {
    const statusClass = `status-${result.status}`;
    const detailsText = result.details.join('\n');

    html += `
    <div class="result-item">
      <div class="result-title ${statusClass}">
        ${result.name}
      </div>
      <div class="result-detail">
${detailsText}
      </div>
    </div>
`;
  });

  html += `
  </div>

  <div class="footer">
    詳細な設定値は DEVELOPMENT_SERVICES.md を参照してください
  </div>
</body>
</html>
`;

  return html;
}
