/**
 * 🔍 Webhook診断スクリプト
 *
 * このファイルをGASエディタにコピーして実行してください。
 * 現在の設定状況と接続テストを行います。
 */

function diagnoseWebhookSettings() {
  const props = PropertiesService.getScriptProperties();
  const WEBHOOK_URL = props.getProperty('WEBHOOK_URL');
  const WEBHOOK_SECRET = props.getProperty('WEBHOOK_SECRET');

  console.log('='.repeat(60));
  console.log('🔍 Webhook診断レポート');
  console.log('='.repeat(60));
  console.log('');

  // 1. 設定確認
  console.log('【1】Script Properties 設定状況');
  console.log('  WEBHOOK_URL: ' + (WEBHOOK_URL || '❌ 未設定'));
  console.log('  WEBHOOK_SECRET: ' + (WEBHOOK_SECRET ? '✅ 設定済み（長さ: ' + WEBHOOK_SECRET.length + '）' : '❌ 未設定'));
  console.log('');

  // 2. 期待値との比較
  console.log('【2】期待されるURL');
  console.log('  https://reborn-webhook-worker.mercari-yasuhirotakuji.workers.dev');
  console.log('');
  console.log('【3】実際のURL');
  console.log('  ' + WEBHOOK_URL);
  console.log('');

  if (WEBHOOK_URL !== 'https://reborn-webhook-worker.mercari-yasuhirotakuji.workers.dev') {
    console.log('⚠️ 警告: URLが期待値と一致しません！');
    console.log('');
  }

  // 3. 接続テスト
  if (!WEBHOOK_URL || !WEBHOOK_SECRET) {
    console.log('❌ 設定不足のため接続テストをスキップします');
    console.log('');
    return;
  }

  console.log('【4】接続テスト開始');
  console.log('');

  try {
    const testPayload = {
      notificationData: {
        type: 'DIAGNOSTIC_TEST',
        content: 'これは診断テストです - ' + new Date().toISOString(),
        sender: 'GAS診断スクリプト',
        title: '🔍 診断テスト'
      }
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(testPayload),
      headers: {
        'Authorization': 'Bearer ' + WEBHOOK_SECRET
      },
      muteHttpExceptions: true
    };

    console.log('  リクエスト送信中...');
    const startTime = new Date().getTime();
    const response = UrlFetchApp.fetch(WEBHOOK_URL, options);
    const endTime = new Date().getTime();
    const responseTime = endTime - startTime;

    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();

    console.log('  応答時間: ' + responseTime + 'ms');
    console.log('  HTTPステータス: ' + responseCode);
    console.log('  レスポンス: ' + responseText);
    console.log('');

    if (responseCode === 200) {
      console.log('✅ 接続テスト成功！');
      console.log('');
      console.log('📋 次のステップ:');
      console.log('  1. Cloudflare Workers のログを確認してください');
      console.log('  2. このテストリクエストが表示されているか確認');
      console.log('  3. 表示されている場合: 商品登録時のリクエストが届いていない別の問題');
      console.log('  4. 表示されていない場合: ログ監視の設定問題');
    } else {
      console.log('❌ 接続テスト失敗');
      console.log('  ステータスコード ' + responseCode + ' を受信');
    }

  } catch (error) {
    console.log('❌ 接続エラー: ' + error.toString());
    console.log('');
    console.log('  エラーの可能性:');
    console.log('  - URLが間違っている');
    console.log('  - WEBHOOK_SECRETが間違っている');
    console.log('  - ネットワーク接続の問題');
    console.log('  - Cloudflare Workersが停止している');
  }

  console.log('');
  console.log('='.repeat(60));
  console.log('診断完了');
  console.log('='.repeat(60));
}

/**
 * 商品登録時の実際のログを確認する関数
 * GAS実行ログから sendWebhookNotification の詳細ログを確認できます
 */
function testProductNotificationFlow() {
  console.log('🧪 商品登録通知フローのテスト');
  console.log('');

  // テストデータ
  const testForm = {
    'ブランド(英語)': 'TEST',
    'アイテム名': 'テスト商品',
    '大分類(カテゴリ)': 'テストカテゴリ',
    '出品先': 'メルカリ',
    '出品金額': '10000'
  };

  const testManagementNumber = 'TEST-' + new Date().getTime();

  console.log('テスト管理番号: ' + testManagementNumber);
  console.log('');

  try {
    // sendProductRegistrationWebhook を直接呼び出し
    // この関数が存在することを前提としています
    if (typeof sendProductRegistrationWebhook === 'function') {
      const result = sendProductRegistrationWebhook(testForm, testManagementNumber);
      console.log('結果: ' + JSON.stringify(result, null, 2));
    } else {
      console.log('❌ sendProductRegistrationWebhook 関数が見つかりません');
      console.log('   product.js が正しく読み込まれているか確認してください');
    }
  } catch (error) {
    console.log('❌ エラー: ' + error.toString());
  }

  console.log('');
  console.log('📋 確認事項:');
  console.log('  1. 上記のログに [sendWebhookNotification] で始まる行があるか');
  console.log('  2. Webhook送信: の後に表示されるURLを確認');
  console.log('  3. Response code: が 200 か確認');
  console.log('  4. Cloudflare Workers ログに対応するリクエストがあるか確認');
}
