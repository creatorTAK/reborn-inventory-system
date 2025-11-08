function checkWebhookConfig() {
  const props = PropertiesService.getScriptProperties();
  const WEBHOOK_URL = props.getProperty('WEBHOOK_URL');
  const WEBHOOK_SECRET = props.getProperty('WEBHOOK_SECRET');
  
  Logger.log('=== Webhook設定確認 ===');
  Logger.log('WEBHOOK_URL: ' + (WEBHOOK_URL ? WEBHOOK_URL : '❌ 未設定'));
  Logger.log('WEBHOOK_SECRET: ' + (WEBHOOK_SECRET ? '✅ 設定済み (長さ: ' + WEBHOOK_SECRET.length + ')' : '❌ 未設定'));
  
  return {
    url: WEBHOOK_URL,
    secretLength: WEBHOOK_SECRET ? WEBHOOK_SECRET.length : 0
  };
}
