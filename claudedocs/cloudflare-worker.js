/**
 * 🌐 REBORN Webhook Worker (Cloudflare Workers)
 *
 * 📌 目的：
 * GASからの通知リクエストを受け取り、Firestore投稿とFCM送信を行う
 * PWAに依存せず、サーバーサイドで完結する統合型通知システム
 *
 * 🔐 セキュリティ：
 * HMAC-SHA256署名検証により、正規のGASからのリクエストのみ受理
 *
 * 🏗️ アーキテクチャ：
 * GAS → HTTP POST → Cloudflare Worker → Firestore REST API + FCM
 *
 * ⚙️ 環境変数（Cloudflare Workers Secrets）：
 * - WEBHOOK_SECRET: HMAC署名検証用の共有秘密鍵
 * - FIREBASE_PROJECT_ID: FirebaseプロジェクトID
 * - FIREBASE_SERVICE_ACCOUNT: Service AccountキーのJSON文字列
 * - FCM_SERVER_KEY: FCM Server Key
 */

addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

/**
 * メインハンドラー
 */
async function handleRequest(request) {
  // CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Signature, X-Timestamp'
      }
    })
  }

  // POSTのみ受理
  if (request.method !== 'POST') {
    return jsonResponse({ success: false, error: 'Method not allowed' }, 405)
  }

  try {
    // リクエストボディ取得
    const body = await request.text()
    const payload = JSON.parse(body)

    // 🔐 HMAC署名検証
    const signature = request.headers.get('X-Signature')
    const timestamp = request.headers.get('X-Timestamp')

    if (!signature || !timestamp) {
      return jsonResponse({ success: false, error: 'Missing signature or timestamp' }, 401)
    }

    const isValid = await verifySignature(body, signature, timestamp, WEBHOOK_SECRET)
    if (!isValid) {
      return jsonResponse({ success: false, error: 'Invalid signature' }, 401)
    }

    // タイムスタンプチェック（5分以内）
    const now = Date.now()
    const requestTime = parseInt(timestamp)
    if (Math.abs(now - requestTime) > 5 * 60 * 1000) {
      return jsonResponse({ success: false, error: 'Request expired' }, 401)
    }

    // 📢 通知データ検証
    if (!payload.notificationData) {
      return jsonResponse({ success: false, error: 'Missing notificationData' }, 400)
    }

    const { notificationData } = payload

    // 🔥 Firestore投稿
    await postToFirestore(notificationData)

    // 📲 FCM送信
    await sendFCM(notificationData)

    return jsonResponse({
      success: true,
      message: 'Notification posted and sent successfully'
    })

  } catch (error) {
    console.error('❌ Webhook error:', error)
    return jsonResponse({
      success: false,
      error: error.message
    }, 500)
  }
}

/**
 * 🔐 HMAC署名検証
 */
async function verifySignature(body, signature, timestamp, secret) {
  const message = timestamp + '.' + body
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(message)
  )

  const expectedSignature = bufferToHex(signatureBuffer)
  return signature === expectedSignature
}

/**
 * 🔥 Firestore投稿
 */
async function postToFirestore(notificationData) {
  // Firebase Service Account認証
  const serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT)
  const accessToken = await getFirebaseAccessToken(serviceAccount)

  // システム通知ルームID（固定）
  const SYSTEM_NOTIFICATION_ROOM_ID = 'system_notifications'

  // Firestoreドキュメント作成
  const docId = generateDocumentId()
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents/chatRooms/${SYSTEM_NOTIFICATION_ROOM_ID}/messages/${docId}`

  const firestoreDoc = {
    fields: {
      content: { stringValue: notificationData.content },
      sender: { stringValue: notificationData.sender },
      timestamp: { timestampValue: new Date().toISOString() },
      isSystemNotification: { booleanValue: true },
      notificationSent: { booleanValue: false }
    }
  }

  const response = await fetch(firestoreUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(firestoreDoc)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Firestore error: ${error}`)
  }

  return response.json()
}

/**
 * 📲 FCM送信
 */
async function sendFCM(notificationData) {
  const fcmUrl = 'https://fcm.googleapis.com/fcm/send'

  const fcmPayload = {
    to: '/topics/all_users',  // 全ユーザー向けトピック
    notification: {
      title: notificationData.title || 'REBORN通知',
      body: notificationData.content,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: 'reborn-notification',
      requireInteraction: true
    },
    data: {
      type: 'system_notification',
      timestamp: new Date().toISOString()
    }
  }

  const response = await fetch(fcmUrl, {
    method: 'POST',
    headers: {
      'Authorization': `key=${FCM_SERVER_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(fcmPayload)
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`FCM error: ${error}`)
  }

  return response.json()
}

/**
 * 🔑 Firebase Access Token取得（Service Account）
 */
async function getFirebaseAccessToken(serviceAccount) {
  const now = Math.floor(Date.now() / 1000)
  const expiry = now + 3600

  const jwtHeader = {
    alg: 'RS256',
    typ: 'JWT'
  }

  const jwtPayload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: expiry,
    scope: 'https://www.googleapis.com/auth/datastore'
  }

  // JWT生成（Web Crypto API）
  const encoder = new TextEncoder()
  const header = base64UrlEncode(JSON.stringify(jwtHeader))
  const payload = base64UrlEncode(JSON.stringify(jwtPayload))
  const message = `${header}.${payload}`

  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToBinary(serviceAccount.private_key),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    encoder.encode(message)
  )

  const jwt = `${message}.${base64UrlEncode(signature)}`

  // Access Token取得
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  })

  if (!tokenResponse.ok) {
    throw new Error('Failed to get access token')
  }

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

/**
 * ユーティリティ関数
 */

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}

function bufferToHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

function base64UrlEncode(data) {
  if (data instanceof ArrayBuffer) {
    data = String.fromCharCode(...new Uint8Array(data))
  }
  return btoa(data)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '')
}

function pemToBinary(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

function generateDocumentId() {
  return 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15)
}
