/**
 * REBORN FCM Worker
 *
 * Endpoints:
 * - POST /send - Send push notifications via FCM HTTP v1 API
 * - POST /send-email - Send email notifications via Resend
 *
 * Required Environment Variables (Secrets):
 * - FIREBASE_SERVICE_ACCOUNT: Firebase Service Account JSON string
 * - FIREBASE_PROJECT_ID: Firebase project ID (e.g., "reborn-chat")
 * - RESEND_API_KEY: Resend API key for email
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
        return jsonResponse({ status: 'ok', service: 'reborn-fcm-worker', version: 'v2-fcm-http-v1' });
      }

      // 404 for unknown routes
      return jsonResponse({ error: 'Not Found', path }, 404);

    } catch (error) {
      console.error('[Worker Error]', error);
      return jsonResponse({ error: error.message, stack: error.stack }, 500);
    }
  }
};

/**
 * Handle push notification requests using FCM HTTP v1 API
 * POST /send
 * Body: { tokens: string[], title: string, body: string, data?: object }
 */
async function handlePushNotification(request, env) {
  console.log('[FCM] handlePushNotification called');

  const { tokens, title, body, data } = await request.json();

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    console.log('[FCM] Error: tokens array is required');
    return jsonResponse({ error: 'tokens array is required' }, 400);
  }

  if (!title || !body) {
    console.log('[FCM] Error: title and body are required');
    return jsonResponse({ error: 'title and body are required' }, 400);
  }

  // Check required environment variables
  if (!env.FIREBASE_SERVICE_ACCOUNT) {
    console.error('[FCM] Error: FIREBASE_SERVICE_ACCOUNT not configured');
    return jsonResponse({ error: 'FIREBASE_SERVICE_ACCOUNT not configured' }, 500);
  }

  if (!env.FIREBASE_PROJECT_ID) {
    console.error('[FCM] Error: FIREBASE_PROJECT_ID not configured');
    return jsonResponse({ error: 'FIREBASE_PROJECT_ID not configured' }, 500);
  }

  console.log('[FCM] Sending to', tokens.length, 'tokens');
  console.log('[FCM] Title:', title);
  console.log('[FCM] Body:', body);

  const results = [];
  const errors = [];

  try {
    // Get Firebase Access Token using Service Account
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    console.log('[FCM] Service Account loaded:', serviceAccount.client_email);

    const accessToken = await getFirebaseAccessToken(serviceAccount);
    console.log('[FCM] Access token obtained');

    // FCM HTTP v1 API endpoint
    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`;

    for (const token of tokens) {
      try {
        const message = {
          message: {
            token: token,
            notification: {
              title: title,
              body: body,
            },
            data: {
              ...(data || {}),
              click_action: 'https://furira.jp'
            },
            webpush: {
              notification: {
                icon: '/icons/icon-192.png',
                badge: '/icons/badge-72.png',
              },
              fcm_options: {
                link: 'https://furira.jp'
              }
            }
          }
        };

        console.log('[FCM] Sending to token:', token.substring(0, 30) + '...');

        const response = await fetch(fcmUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(message),
        });

        const responseText = await response.text();
        console.log('[FCM] Response status:', response.status);
        console.log('[FCM] Response body:', responseText.substring(0, 200));

        if (response.ok) {
          const result = JSON.parse(responseText);
          results.push({ token: token.substring(0, 20) + '...', success: true, messageId: result.name });
        } else {
          const errorResult = JSON.parse(responseText);
          errors.push({ token: token.substring(0, 20) + '...', error: errorResult.error?.message || responseText });
        }
      } catch (error) {
        console.error('[FCM] Error sending to token:', error);
        errors.push({ token: token.substring(0, 20) + '...', error: error.message });
      }
    }
  } catch (error) {
    console.error('[FCM] Fatal error:', error);
    return jsonResponse({ error: error.message, phase: 'authentication' }, 500);
  }

  console.log('[FCM] Results:', results.length, 'success,', errors.length, 'failed');

  return jsonResponse({
    success: errors.length === 0,
    sent: results.length,
    failed: errors.length,
    results,
    errors: errors.length > 0 ? errors : undefined
  });
}

/**
 * Get Firebase Access Token using Service Account (OAuth2)
 */
async function getFirebaseAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000);
  const expiry = now + 3600;

  const jwtHeader = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const jwtPayload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
    scope: 'https://www.googleapis.com/auth/firebase.messaging'
  };

  // Generate JWT using Web Crypto API
  const encoder = new TextEncoder();
  const header = base64UrlEncode(JSON.stringify(jwtHeader));
  const payload = base64UrlEncode(JSON.stringify(jwtPayload));
  const message = `${header}.${payload}`;

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToBinary(serviceAccount.private_key),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    encoder.encode(message)
  );

  const jwt = `${message}.${base64UrlEncode(signature)}`;

  // Exchange JWT for Access Token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error('Failed to get access token: ' + errorText);
  }

  const tokenData = await tokenResponse.json();
  return tokenData.access_token;
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
        from: 'フリラ <noreply@furira.jp>',
        to: [to],
        subject: subject,
        text: body,
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
      <h1 style="margin:0; font-size: 28px; font-weight: bold;">FURIRA</h1>
      <p style="margin:5px 0 0 0; font-size: 14px;">物販管理システム</p>
    </div>
    <div class="content">
      ${body.split('\n').map(line => `<p style="margin: 10px 0;">${escapeHtml(line)}</p>`).join('')}
    </div>
    <div class="footer">
      <p>このメールは <a href="https://furira.jp">フリラ物販管理システム</a> から自動送信されています。</p>
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
 * Utility functions
 */
function base64UrlEncode(data) {
  if (data instanceof ArrayBuffer) {
    data = String.fromCharCode(...new Uint8Array(data));
  }
  return btoa(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function pemToBinary(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

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

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}
