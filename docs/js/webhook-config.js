/**
 * Webhook設定
 * 
 * ⚠️ セキュリティ注意:
 * - WEBHOOK_SECRET は公開リポジトリにコミットしないでください
 * - この値が漏洩すると、第三者が勝手に通知を送信できてしまいます
 * 
 * 設定方法:
 * 1. GAS Script Properties から WEBHOOK_URL と WEBHOOK_SECRET をコピー
 * 2. 下記の定数に貼り付け
 */

// TODO: GAS Script Properties から取得した値を貼り付けてください
const WEBHOOK_URL = 'https://reborn-webhook-worker.mercari-yasuhirotakuji.workers.dev';  // 例: https://reborn-webhook-worker.xxxxxxxx.workers.dev
const WEBHOOK_SECRET = 'abc123def456abc123def456abc123def456abc123def456abc123def456abc1';  // 50文字くらいのランダム文字列

/**
 * Cloudflare Worker に通知を送信
 * @param {Object} notificationData - 通知データ
 * @returns {Promise<Object>} レスポンス
 */
async function sendWebhookNotification(notificationData) {
  try {
    console.log('[Webhook] 通知送信開始:', notificationData);

    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${WEBHOOK_SECRET}`
      },
      body: JSON.stringify({ notificationData })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Webhook] エラーレスポンス:', errorText);
      throw new Error(`Webhook送信失敗: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    console.log('[Webhook] 通知送信成功:', result);
    return result;

  } catch (error) {
    console.error('[Webhook] 通知送信エラー:', error);
    throw error;
  }
}

// グローバルに公開
window.sendWebhookNotification = sendWebhookNotification;
