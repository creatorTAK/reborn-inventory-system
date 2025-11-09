/**
 * 🌐 REBORN Webhook Worker (Cloudflare Workers)
 *
 * 📌 目的：
 * GASからの通知リクエストを受け取り、Firestore投稿とFCM送信を行う
 * PWAに依存せず、サーバーサイドで完結する統合型通知システム
 *
 * 🔐 セキュリティ：
 * Bearer Token認証により、正規のGASからのリクエストのみ受理
 *
 * 🏗️ アーキテクチャ：
 * GAS → HTTP POST → Cloudflare Worker → Firestore REST API + FCM
 *
 * ⚙️ 環境変数（Cloudflare Workers Secrets）：
 * - WEBHOOK_SECRET: Bearer Token認証用の共有秘密鍵
 * - FIREBASE_PROJECT_ID: FirebaseプロジェクトID
 * - FIREBASE_SERVICE_ACCOUNT: Service AccountキーのJSON文字列
 * - FCM_SERVER_KEY: FCM Server Key
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 🔍 一時診断: 到達先の可視化（原因特定後に削除）
    if (url.pathname === '/whoami') {
      const hdr = (n) => request.headers.get(n) || '';
      return new Response(JSON.stringify({
        ok: true,
        where: {
          request_url: request.url,
          host: hdr('host'),
          cf_ray: hdr('cf-ray'),
          user_agent: hdr('user-agent'),
          deployment_type: 'worker'
        },
        version: {
          commit: 'v2-firestore-fix-' + new Date().toISOString().substring(0,19).replace(/[:-]/g,''),
          builtAt: new Date().toISOString(),
          latest_fix: 'firestore-flat-structure-with-roomId-text-field'
        },
        timestamp: new Date().toISOString()
      }, null, 2), {
        status: 200,
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-worker-commit': 'ee521a0c-3a75-47e3-8a48-77e6ff796ecd'
        }
      });
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
        }
      })
    }

    // 🆕 ルーティング: /api/unread/increment (Service Worker用)
    if (url.pathname === '/api/unread/increment') {
      return handleUnreadIncrement(request, env)
    }

    // POSTのみ受理（既存Webhook）
    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405)
    }

    try {
      // リクエストボディ取得
      const body = await request.text()
      const payload = JSON.parse(body)

      // 🔐 Bearer Token認証
      const authHeader = request.headers.get('Authorization')

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        console.log('❌ Missing or invalid Authorization header')
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401)
      }

      const token = authHeader.substring(7) // "Bearer " を除去

      if (token !== env.WEBHOOK_SECRET) {
        console.log('❌ Invalid token')
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401)
      }

      console.log('✅ Bearer Token verification PASSED')

      // 📢 通知データ検証
      if (!payload.notificationData) {
        return jsonResponse({ success: false, error: 'Missing notificationData' }, 400)
      }

      const { notificationData } = payload

      // 🔥 Firestore投稿
      const firestoreResult = await postToFirestore(notificationData, env)

      // 📲 FCM送信はGAS側で実施（トークンベース送信）
      // Cloudflare Workerはメッセージ保存とrooms更新のみ担当

      return jsonResponse({
        success: true,
        message: 'Notification posted successfully',
        debug: {
          firestore: {
            status: 'success',
            result: JSON.stringify(firestoreResult).substring(0, 200)
          }
        }
      })

    } catch (error) {
      console.error('❌ Webhook error:', error)
      return jsonResponse({
        success: false,
        error: error.message
      }, 500)
    }
  }
}





/**
 * 🔥 Firestore投稿
 */
async function postToFirestore(notificationData, env) {
  // Firebase Service Account認証
  const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)
  const accessToken = await getFirebaseAccessToken(serviceAccount)

  // システム通知ルームID（PWA側と統一）
  const SYSTEM_NOTIFICATION_ROOM_ID = 'room_system_notifications'

  // Firestoreドキュメント作成（PWA側のフラット構造に合わせる）
  const docId = generateDocumentId()
  const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/messages/${docId}`

  const firestoreDoc = {
    fields: {
      roomId: { stringValue: SYSTEM_NOTIFICATION_ROOM_ID },
      text: { stringValue: notificationData.content },
      userName: { stringValue: notificationData.sender },  // PWA側のschemaに合わせてuserNameを使用
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

  // roomsコレクションのlastMessageを更新（PWA側と同じ処理）
  const roomDocUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/rooms/${SYSTEM_NOTIFICATION_ROOM_ID}`
  const firstLine = notificationData.content.split('\n')[0]

  const roomUpdate = {
    fields: {
      name: { stringValue: '📢 システム通知' },  // ルーム名を保持
      type: { stringValue: 'system' },  // ルームタイプを保持
      icon: { stringValue: '📢' },  // アイコンを保持
      lastMessage: { stringValue: firstLine },
      lastMessageAt: { timestampValue: new Date().toISOString() },
      lastMessageBy: { stringValue: notificationData.sender }
    }
  }

  const roomResponse = await fetch(roomDocUrl, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(roomUpdate)
  })

  if (!roomResponse.ok) {
    console.error('Failed to update room lastMessage:', await roomResponse.text())
    // roomsコレクション更新失敗は致命的ではないのでエラーにしない
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
    scope: 'https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore'
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

/**
 * 🆕 /api/unread/increment エンドポイント
 * Service Workerからの unreadCount +1 リクエストを処理
 */
async function handleUnreadIncrement(request, env) {
  try {
    // POSTのみ受理
    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method not allowed' }, 405)
    }

    // リクエストボディ取得
    const body = await request.json()
    const { roomId, userName, delta } = body

    // パラメータ検証
    if (!roomId || !userName || !delta) {
      return jsonResponse({
        success: false,
        error: 'Missing required parameters: roomId, userName, delta'
      }, 400)
    }

    console.log(`[UnreadIncrement] roomId=${roomId}, userName=${userName}, delta=${delta}`)

    // Service Account取得
    const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT)

    // Access Token取得
    const accessToken = await getFirebaseAccessToken(serviceAccount)

    // Firestore unreadCount を increment
    const unreadDocUrl = `https://firestore.googleapis.com/v1/projects/${env.FIREBASE_PROJECT_ID}/databases/(default)/documents/rooms/${roomId}/unreadCounts/${userName}`

    // 🔧 修正: まず現在値をGETで取得（PATCHでリセットしない）
    const getResponse = await fetch(unreadDocUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    let currentCount = 0
    let newCount = delta

    if (getResponse.ok) {
      // ドキュメントが存在する場合、現在値を取得
      const currentDoc = await getResponse.json()
      currentCount = parseInt(currentDoc.fields?.unreadCount?.integerValue || '0')
      newCount = currentCount + delta
      console.log(`[UnreadIncrement] 現在値: ${currentCount}, 加算: ${delta}, 新規値: ${newCount}`)
    } else if (getResponse.status === 404) {
      // ドキュメントが存在しない場合、deltaをそのまま新規値とする
      console.log(`[UnreadIncrement] ドキュメント未存在、新規作成: ${newCount}`)
    } else {
      const error = await getResponse.text()
      throw new Error(`Firestore GET failed: ${error}`)
    }

    // 新しい値でPATCH（作成または更新）
    const updateResponse = await fetch(unreadDocUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          unreadCount: {
            integerValue: newCount.toString()
          }
        }
      })
    })

    if (!updateResponse.ok) {
      const error = await updateResponse.text()
      throw new Error(`Firestore PATCH failed: ${error}`)
    }

    console.log(`[UnreadIncrement] 更新成功: ${currentCount} → ${newCount}`)

    return jsonResponse({
      success: true,
      message: 'UnreadCount incremented',
      previous: currentCount,
      current: newCount
    })

  } catch (error) {
    console.error('[UnreadIncrement] Error:', error)
    return jsonResponse({
      success: false,
      error: error.message
    }, 500)
  }
}


