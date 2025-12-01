/**
 * REBORN FCM Worker
 *
 * Endpoints:
 * - POST /send - Send push notifications via FCM
 * - POST /send-email - Send email notifications via Resend
 */

// CORS headers for all responses
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Route handling
      if (request.method === 'POST' && path === '/send') {
        return await handlePushNotification(request, env);
      }

      if (request.method === 'POST' && path === '/send-email') {
        return await handleSendEmail(request, env);
      }

      // Health check
      if (request.method === 'GET' && path === '/health') {
        return jsonResponse({ status: 'ok', service: 'reborn-fcm-worker' });
      }

      // 404 for unknown routes
      return jsonResponse({ error: 'Not Found', path }, 404);

    } catch (error) {
      console.error('[Worker Error]', error);
      return jsonResponse({ error: error.message }, 500);
    }
  }
};

/**
 * Handle push notification requests
 * POST /send
 * Body: { tokens: string[], title: string, body: string, data?: object }
 */
async function handlePushNotification(request, env) {
  const { tokens, title, body, data } = await request.json();

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    return jsonResponse({ error: 'tokens array is required' }, 400);
  }

  if (!title || !body) {
    return jsonResponse({ error: 'title and body are required' }, 400);
  }

  const FCM_SERVER_KEY = env.FCM_SERVER_KEY;
  if (!FCM_SERVER_KEY) {
    return jsonResponse({ error: 'FCM_SERVER_KEY not configured' }, 500);
  }

  const results = [];
  const errors = [];

  for (const token of tokens) {
    try {
      const response = await fetch('https://fcm.googleapis.com/fcm/send', {
        method: 'POST',
        headers: {
          'Authorization': `key=${FCM_SERVER_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: token,
          notification: {
            title: title,
            body: body,
            icon: '/icons/icon-192.png',
            badge: '/icons/badge-72.png',
            click_action: 'https://furira.jp'
          },
          data: data || {},
          webpush: {
            fcm_options: {
              link: 'https://furira.jp'
            }
          }
        }),
      });

      const result = await response.json();

      if (result.success === 1) {
        results.push({ token: token.substring(0, 20) + '...', success: true });
      } else {
        errors.push({ token: token.substring(0, 20) + '...', error: result });
      }
    } catch (error) {
      errors.push({ token: token.substring(0, 20) + '...', error: error.message });
    }
  }

  return jsonResponse({
    success: errors.length === 0,
    sent: results.length,
    failed: errors.length,
    results,
    errors: errors.length > 0 ? errors : undefined
  });
}

/**
 * Handle email sending requests via Resend
 * POST /send-email
 * Body: { to: string, subject: string, body: string }
 */
async function handleSendEmail(request, env) {
  const { to, subject, body } = await request.json();

  if (!to || !subject || !body) {
    return jsonResponse({ error: 'to, subject, and body are required' }, 400);
  }

  const RESEND_API_KEY = env.RESEND_API_KEY;
  if (!RESEND_API_KEY) {
    return jsonResponse({ error: 'RESEND_API_KEY not configured' }, 500);
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'FURIRA <noreply@furira.jp>',
        to: [to],
        subject: subject,
        text: body,
        // HTML version with simple formatting
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #40B4E5, #1E8FBF); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #fff; padding: 30px; border: 1px solid #ddd; border-top: none; }
    .footer { background: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666; border-radius: 0 0 8px 8px; }
    a { color: #1E8FBF; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://furira.jp/images/furira-text-logo.png" alt="FURIRA" style="max-width: 180px; height: auto; margin-bottom: 8px;">
      <p style="margin:0; font-size: 14px;">物販管理システム</p>
    </div>
    <div class="content">
      ${body.split('\n').map(line => `<p style="margin: 10px 0;">${escapeHtml(line)}</p>`).join('')}
    </div>
    <div class="footer">
      <p>このメールは <a href="https://furira.jp">FURIRA物販管理システム</a> から自動送信されています。</p>
    </div>
  </div>
</body>
</html>
        `.trim()
      }),
    });

    const result = await response.json();

    if (response.ok) {
      console.log('[Email] Sent successfully:', result.id);
      return jsonResponse({
        success: true,
        messageId: result.id,
        to: to
      });
    } else {
      console.error('[Email] Error:', result);
      return jsonResponse({
        success: false,
        error: result.message || 'Failed to send email',
        details: result
      }, response.status);
    }
  } catch (error) {
    console.error('[Email] Exception:', error);
    return jsonResponse({
      success: false,
      error: error.message
    }, 500);
  }
}

/**
 * Helper function to escape HTML
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * Helper function to return JSON response with CORS headers
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
