/**
 * REBORN FCM Worker
 *
 * Endpoints:
 * - POST /send - Send push notifications via FCM HTTP v1 API or Web Push
 * - POST /send-email - Send email notifications via Resend
 *
 * Required Environment Variables (Secrets):
 * - FIREBASE_SERVICE_ACCOUNT: Firebase Service Account JSON string
 * - FIREBASE_PROJECT_ID: Firebase project ID (e.g., "reborn-chat")
 * - RESEND_API_KEY: Resend API key for email
 * - VAPID_PRIVATE_KEY: VAPID private key for Web Push (Base64 encoded)
 * - VAPID_PUBLIC_KEY: VAPID public key for Web Push (Base64 encoded)
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
        return jsonResponse({ status: 'ok', service: 'reborn-fcm-worker', version: 'v3-webpush-support' });
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
 * Handle push notification requests
 * Supports both FCM tokens and Web Push subscriptions
 * POST /send
 * Body: { tokens: string[], title: string, body: string, data?: object }
 */
async function handlePushNotification(request, env) {
  console.log('[Push] handlePushNotification called');

  const { tokens, title, body, data } = await request.json();

  if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
    console.log('[Push] Error: tokens array is required');
    return jsonResponse({ error: 'tokens array is required' }, 400);
  }

  if (!title || !body) {
    console.log('[Push] Error: title and body are required');
    return jsonResponse({ error: 'title and body are required' }, 400);
  }

  console.log('[Push] Sending to', tokens.length, 'tokens');
  console.log('[Push] Title:', title);
  console.log('[Push] Body:', body);

  const results = [];
  const errors = [];

  // Separate tokens by type
  const webPushTokens = [];
  const fcmTokens = [];

  for (const token of tokens) {
    if (token.startsWith('webpush:')) {
      webPushTokens.push(token);
    } else if (token.startsWith('ios-pwa-') || token.startsWith('https://')) {
      // Old format Web Push endpoints - skip with warning
      console.log('[Push] Skipping old format token:', token.substring(0, 30) + '...');
      errors.push({ token: token.substring(0, 20) + '...', error: 'Old format token - please re-register' });
    } else {
      fcmTokens.push(token);
    }
  }

  // Handle Web Push tokens
  if (webPushTokens.length > 0) {
    console.log('[WebPush] Processing', webPushTokens.length, 'Web Push tokens');

    if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY) {
      console.error('[WebPush] VAPID keys not configured');
      for (const token of webPushTokens) {
        errors.push({ token: token.substring(0, 20) + '...', error: 'VAPID keys not configured' });
      }
    } else {
      for (const token of webPushTokens) {
        try {
          const result = await sendWebPush(token, { title, body, data }, env);
          if (result.success) {
            results.push({ token: token.substring(0, 20) + '...', success: true, type: 'webpush' });
          } else {
            errors.push({ token: token.substring(0, 20) + '...', error: result.error, type: 'webpush' });
          }
        } catch (error) {
          console.error('[WebPush] Error:', error);
          errors.push({ token: token.substring(0, 20) + '...', error: error.message, type: 'webpush' });
        }
      }
    }
  }

  // Handle FCM tokens
  if (fcmTokens.length > 0) {
    console.log('[FCM] Processing', fcmTokens.length, 'FCM tokens');

    if (!env.FIREBASE_SERVICE_ACCOUNT || !env.FIREBASE_PROJECT_ID) {
      console.error('[FCM] Firebase configuration missing');
      for (const token of fcmTokens) {
        errors.push({ token: token.substring(0, 20) + '...', error: 'Firebase not configured' });
      }
    } else {
      try {
        const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
        const accessToken = await getFirebaseAccessToken(serviceAccount);
        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/messages:send`;

        for (const token of fcmTokens) {
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

            if (response.ok) {
              const result = JSON.parse(responseText);
              results.push({ token: token.substring(0, 20) + '...', success: true, messageId: result.name, type: 'fcm' });
            } else {
              const errorResult = JSON.parse(responseText);
              errors.push({ token: token.substring(0, 20) + '...', error: errorResult.error?.message || responseText, type: 'fcm' });
            }
          } catch (error) {
            console.error('[FCM] Error sending to token:', error);
            errors.push({ token: token.substring(0, 20) + '...', error: error.message, type: 'fcm' });
          }
        }
      } catch (error) {
        console.error('[FCM] Fatal error:', error);
        for (const token of fcmTokens) {
          errors.push({ token: token.substring(0, 20) + '...', error: error.message, type: 'fcm' });
        }
      }
    }
  }

  console.log('[Push] Results:', results.length, 'success,', errors.length, 'failed');

  return jsonResponse({
    success: errors.length === 0,
    sent: results.length,
    failed: errors.length,
    results,
    errors: errors.length > 0 ? errors : undefined
  });
}

/**
 * Send Web Push notification using RFC 8030 protocol
 */
async function sendWebPush(token, notification, env) {
  console.log('[WebPush] Sending notification...');

  // Decode the subscription from token
  let subscription;
  try {
    const encodedData = token.substring('webpush:'.length);
    subscription = JSON.parse(atob(encodedData));
    console.log('[WebPush] Decoded subscription endpoint:', subscription.endpoint.substring(0, 50) + '...');
  } catch (e) {
    console.error('[WebPush] Failed to decode token:', e);
    return { success: false, error: 'Invalid Web Push token format' };
  }

  if (!subscription.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) {
    console.error('[WebPush] Incomplete subscription data');
    return { success: false, error: 'Incomplete subscription (missing endpoint or keys)' };
  }

  try {
    // Prepare the payload
    const payload = JSON.stringify({
      title: notification.title,
      body: notification.body,
      icon: '/icon-180.png',
      badge: '/icon-180.png',
      data: {
        ...(notification.data || {}),
        url: 'https://furira.jp'
      }
    });

    // Generate VAPID headers
    const vapidHeaders = await generateVapidHeaders(
      subscription.endpoint,
      env.VAPID_PUBLIC_KEY,
      env.VAPID_PRIVATE_KEY
    );

    // Encrypt the payload using aes128gcm
    const encryptedPayload = await encryptPayload(
      payload,
      subscription.keys.p256dh,
      subscription.keys.auth
    );

    // Send the request
    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Authorization': vapidHeaders.authorization,
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'TTL': '86400',
        ...vapidHeaders.crypto
      },
      body: encryptedPayload
    });

    console.log('[WebPush] Response status:', response.status);

    if (response.status === 201 || response.status === 200) {
      console.log('[WebPush] ✅ Successfully sent');
      return { success: true };
    } else if (response.status === 410) {
      console.log('[WebPush] ❌ Subscription expired');
      return { success: false, error: 'Subscription expired (410 Gone)' };
    } else {
      const responseText = await response.text();
      console.log('[WebPush] ❌ Error:', response.status, responseText);
      return { success: false, error: `HTTP ${response.status}: ${responseText}` };
    }
  } catch (error) {
    console.error('[WebPush] Exception:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Generate VAPID headers for Web Push authentication
 */
async function generateVapidHeaders(endpoint, publicKeyBase64, privateKeyBase64) {
  const endpointUrl = new URL(endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;

  // Create JWT payload
  const now = Math.floor(Date.now() / 1000);
  const jwtHeader = { typ: 'JWT', alg: 'ES256' };
  const jwtPayload = {
    aud: audience,
    exp: now + 86400, // 24 hours
    sub: 'mailto:support@furira.jp'
  };

  // Import VAPID private key for signing
  const privateKeyBytes = base64UrlDecode(privateKeyBase64);
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    createPKCS8FromRaw(privateKeyBytes),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  // Create and sign JWT
  const encoder = new TextEncoder();
  const headerB64 = base64UrlEncode(JSON.stringify(jwtHeader));
  const payloadB64 = base64UrlEncode(JSON.stringify(jwtPayload));
  const signatureInput = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    encoder.encode(signatureInput)
  );

  // Convert signature to JWT format (DER to raw)
  const signatureB64 = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${signatureInput}.${signatureB64}`;

  return {
    authorization: `vapid t=${jwt}, k=${publicKeyBase64}`,
    crypto: {}
  };
}

/**
 * Encrypt payload for Web Push using aes128gcm
 * Implements RFC 8291 (Message Encryption for Web Push)
 */
async function encryptPayload(payload, p256dhBase64, authBase64) {
  const encoder = new TextEncoder();
  const payloadBytes = encoder.encode(payload);

  // Decode subscriber's public key and auth secret
  const subscriberPublicKeyBytes = base64UrlDecode(p256dhBase64);
  const authSecret = base64UrlDecode(authBase64);

  // Import subscriber's public key
  const subscriberPublicKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKeyBytes,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  );

  // Generate ephemeral key pair
  const ephemeralKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  );

  // Derive shared secret
  const sharedSecret = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: subscriberPublicKey },
    ephemeralKeyPair.privateKey,
    256
  );

  // Export ephemeral public key
  const ephemeralPublicKey = await crypto.subtle.exportKey('raw', ephemeralKeyPair.publicKey);
  const ephemeralPublicKeyBytes = new Uint8Array(ephemeralPublicKey);

  // Derive encryption key using HKDF
  const sharedSecretKey = await crypto.subtle.importKey(
    'raw',
    sharedSecret,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  // PRK = HKDF-Extract(salt=auth_secret, IKM=shared_secret)
  // Key = HKDF-Expand(PRK, info="Content-Encoding: aes128gcm" + 0x00, len=16)
  // Nonce = HKDF-Expand(PRK, info="Content-Encoding: nonce" + 0x00, len=12)

  // Create info for key derivation
  const keyInfo = createInfo('aesgcm', subscriberPublicKeyBytes, ephemeralPublicKeyBytes);
  const nonceInfo = createInfo('nonce', subscriberPublicKeyBytes, ephemeralPublicKeyBytes);

  // First, derive PRK from auth and shared secret
  const prkKey = await crypto.subtle.importKey(
    'raw',
    authSecret,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  // Derive IKM from shared secret
  const ikm = await deriveHKDF(prkKey, new Uint8Array(sharedSecret), concat(
    encoder.encode('WebPush: info\x00'),
    subscriberPublicKeyBytes,
    ephemeralPublicKeyBytes
  ), 32);

  const ikmKey = await crypto.subtle.importKey(
    'raw',
    ikm,
    { name: 'HKDF' },
    false,
    ['deriveBits']
  );

  // Derive CEK (Content Encryption Key)
  const cek = await deriveHKDF(ikmKey, new Uint8Array(0), encoder.encode('Content-Encoding: aes128gcm\x00'), 16);

  // Derive nonce
  const nonce = await deriveHKDF(ikmKey, new Uint8Array(0), encoder.encode('Content-Encoding: nonce\x00'), 12);

  // Import CEK for AES-GCM
  const aesKey = await crypto.subtle.importKey(
    'raw',
    cek,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );

  // Add padding delimiter
  const paddedPayload = concat(payloadBytes, new Uint8Array([2])); // 2 = final record

  // Encrypt
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    paddedPayload
  );

  // Build aes128gcm encoded message
  // Format: salt (16) + rs (4) + idlen (1) + keyid (65) + ciphertext
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const rs = new Uint8Array([0, 0, 16, 1]); // Record size: 4097
  const idlen = new Uint8Array([65]); // Key ID length

  return concat(
    salt,
    rs,
    idlen,
    ephemeralPublicKeyBytes,
    new Uint8Array(encrypted)
  );
}

/**
 * Derive key material using HKDF
 */
async function deriveHKDF(key, salt, info, length) {
  const derived = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    length * 8
  );
  return new Uint8Array(derived);
}

/**
 * Create info parameter for HKDF
 */
function createInfo(type, subscriberKey, senderKey) {
  const encoder = new TextEncoder();
  const typeBytes = encoder.encode(`Content-Encoding: ${type}\x00`);
  return concat(typeBytes, subscriberKey, senderKey);
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

  const jwt = `${message}.${base64UrlEncode(new Uint8Array(signature))}`;

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
  let str;
  if (data instanceof ArrayBuffer || data instanceof Uint8Array) {
    const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
    str = String.fromCharCode(...bytes);
  } else {
    str = data;
  }
  return btoa(str)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64UrlDecode(str) {
  // Add padding if needed
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }
  const binary = atob(str);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
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

/**
 * Create PKCS8 wrapper for raw EC private key
 */
function createPKCS8FromRaw(rawKey) {
  // PKCS8 header for P-256 EC key
  const header = new Uint8Array([
    0x30, 0x81, 0x87, 0x02, 0x01, 0x00, 0x30, 0x13,
    0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02,
    0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d,
    0x03, 0x01, 0x07, 0x04, 0x6d, 0x30, 0x6b, 0x02,
    0x01, 0x01, 0x04, 0x20
  ]);
  const footer = new Uint8Array([
    0xa1, 0x44, 0x03, 0x42, 0x00, 0x04
  ]);

  // For now, return raw key wrapped minimally
  // If rawKey is already 32 bytes, wrap it
  if (rawKey.length === 32) {
    return concat(header, rawKey, footer, new Uint8Array(64));
  }
  // If it's already a full PKCS8 key, return as-is
  return rawKey;
}

function concat(...arrays) {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
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
