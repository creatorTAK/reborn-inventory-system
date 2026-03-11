/**
 * Pinterest API v5 - 自動ピン投稿
 *
 * 商品登録時にPinterest APIでピンを自動作成
 * OAuth2トークンはFirestoreで管理（自動リフレッシュ）
 */

const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {onRequest} = require('firebase-functions/v2/https');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {getFirestore} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');

const PINTEREST_API_BASE = 'https://api.pinterest.com/v5';
const PINTEREST_OAUTH_URL = 'https://api.pinterest.com/v5/oauth/token';

/**
 * Firestoreからトークンを取得
 */
async function getPinterestTokens() {
  const db = getFirestore();
  const doc = await db.collection('settings').doc('pinterestApi').get();
  if (!doc.exists) return null;
  return doc.data();
}

/**
 * トークンをFirestoreに保存
 */
async function savePinterestTokens(tokens) {
  const db = getFirestore();
  await db.collection('settings').doc('pinterestApi').set(tokens, {merge: true});
}

/**
 * アクセストークンをリフレッシュ
 */
async function refreshAccessToken(settings) {
  const {appId, appSecret, refreshToken} = settings;
  if (!appId || !appSecret || !refreshToken) {
    throw new Error('Pinterest API credentials not configured');
  }

  const credentials = Buffer.from(`${appId}:${appSecret}`).toString('base64');

  const response = await fetch(PINTEREST_OAUTH_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pinterest token refresh failed: ${response.status} ${error}`);
  }

  const data = await response.json();

  // 新しいトークンを保存
  const updatedTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    tokenExpiresAt: Date.now() + (data.expires_in * 1000),
    lastRefreshed: new Date().toISOString(),
  };

  await savePinterestTokens(updatedTokens);
  console.log('[Pinterest] トークンリフレッシュ成功');

  return updatedTokens.accessToken;
}

/**
 * 有効なアクセストークンを取得（必要ならリフレッシュ）
 */
async function getValidAccessToken() {
  const settings = await getPinterestTokens();
  if (!settings) {
    throw new Error('Pinterest API not configured. Run OAuth setup first.');
  }

  // トークンが有効期限内か確認（5分のバッファ）
  if (settings.accessToken && settings.tokenExpiresAt && Date.now() < settings.tokenExpiresAt - 300000) {
    return settings.accessToken;
  }

  // リフレッシュ
  return await refreshAccessToken(settings);
}

/**
 * Pinterest APIでピンを作成
 */
async function createPin({boardId, title, description, link, imageUrl, altText}) {
  const accessToken = await getValidAccessToken();

  const pinData = {
    board_id: boardId,
    title: (title || '').substring(0, 100),
    description: (description || '').substring(0, 800),
    link: link,
    media_source: {
      source_type: 'image_url',
      url: imageUrl,
    },
  };

  if (altText) {
    pinData.alt_text = altText.substring(0, 500);
  }

  const response = await fetch(`${PINTEREST_API_BASE}/pins`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(pinData),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Pinterest pin creation failed: ${response.status} ${error}`);
  }

  const result = await response.json();
  console.log('[Pinterest] ピン作成成功:', result.id);
  return result;
}

/**
 * 商品登録時のPinterest自動投稿トリガー
 */
exports.onProductCreatedPinterest = onDocumentCreated('products/{productId}', async (event) => {
  const productId = event.params.productId;

  try {
    // Pinterest設定を確認
    const settings = await getPinterestTokens();
    if (!settings || !settings.enabled) {
      console.log('[Pinterest] 自動投稿が無効のためスキップ');
      return;
    }

    const productData = event.data.data();
    if (!productData) {
      console.log('[Pinterest] 商品データなし、スキップ');
      return;
    }

    // 商品画像がない場合はスキップ
    const imageUrls = (productData.images && productData.images.imageUrls) || [];
    if (imageUrls.length === 0) {
      console.log('[Pinterest] 画像がないためスキップ:', productId);
      return;
    }

    // EC用タイトル・説明文を優先使用
    const title = productData.ecTitle || productData.productName || '';
    const description = productData.ecDescription || productData.description || '';
    const imageUrl = imageUrls[0]; // 1枚目の画像

    // ECサイトの商品ページURL
    const shopUrl = `https://furira.jp/shop/item.html?id=${productId}`;

    // ピン作成
    const pin = await createPin({
      boardId: settings.boardId,
      title: title,
      description: description,
      link: shopUrl,
      imageUrl: imageUrl,
      altText: title,
    });

    // 投稿結果をFirestoreに記録
    const db = getFirestore();
    await db.collection('products').doc(productId).update({
      pinterestPinId: pin.id,
      pinterestPinUrl: `https://www.pinterest.jp/pin/${pin.id}/`,
      pinterestPostedAt: new Date().toISOString(),
    });

    console.log(`[Pinterest] 自動投稿完了: ${productId} → pin:${pin.id}`);
  } catch (error) {
    console.error(`[Pinterest] 自動投稿エラー (${productId}):`, error.message);
    // エラーでも商品登録自体は失敗させない
  }
});

/**
 * OAuth2 コールバック用HTTPエンドポイント
 * Pinterest OAuth認可後のリダイレクト先
 * URL: https://[region]-[project].cloudfunctions.net/pinterestOAuthCallback?code=xxx
 */
exports.pinterestOAuthCallback = onRequest(async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    console.error('[Pinterest OAuth] エラー:', error);
    res.status(400).send(`Pinterest OAuth error: ${error}`);
    return;
  }

  if (!code) {
    // 認可URLを生成して表示
    const settings = await getPinterestTokens();
    if (!settings || !settings.appId) {
      res.status(500).send('Pinterest App ID not configured in Firestore settings/pinterestApi');
      return;
    }

    const redirectUri = `https://${req.headers.host}/${req.path.split('/')[1] || 'pinterestOAuthCallback'}`;
    const authUrl = `https://www.pinterest.com/oauth/?` +
      `client_id=${settings.appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=code` +
      `&scope=boards:read,boards:write,pins:read,pins:write`;

    res.send(`
      <html>
      <body style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px;">
        <h2>Pinterest OAuth Setup</h2>
        <p>以下のリンクをクリックしてPinterestアカウントを認可してください:</p>
        <a href="${authUrl}" style="display: inline-block; padding: 12px 24px; background: #E60023; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Pinterestを認可する
        </a>
        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          Redirect URI: <code>${redirectUri}</code>
        </p>
      </body>
      </html>
    `);
    return;
  }

  // 認可コードをアクセストークンに交換
  try {
    const settings = await getPinterestTokens();
    if (!settings || !settings.appId || !settings.appSecret) {
      res.status(500).send('Pinterest API credentials not configured');
      return;
    }

    const redirectUri = `https://${req.headers.host}/${req.path.split('/')[1] || 'pinterestOAuthCallback'}`;
    const credentials = Buffer.from(`${settings.appId}:${settings.appSecret}`).toString('base64');

    const tokenResponse = await fetch(PINTEREST_OAUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${errText}`);
    }

    const tokenData = await tokenResponse.json();

    // トークンを保存（リフレッシュトークンは1年有効）
    const REFRESH_TOKEN_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;
    await savePinterestTokens({
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: Date.now() + (tokenData.expires_in * 1000),
      refreshTokenExpiresAt: Date.now() + REFRESH_TOKEN_LIFETIME_MS,
      tokenScope: tokenData.scope,
      lastRefreshed: new Date().toISOString(),
      enabled: true,
    });

    // ボード一覧を取得して表示
    const boardsResponse = await fetch(`${PINTEREST_API_BASE}/boards`, {
      headers: {'Authorization': `Bearer ${tokenData.access_token}`},
    });
    const boardsData = await boardsResponse.json();
    const boards = boardsData.items || [];

    let boardListHtml = '';
    if (boards.length > 0) {
      boardListHtml = '<h3>ボードを選択:</h3><ul>' +
        boards.map((b) => `<li><a href="?set_board=${b.id}">${b.name}</a> (${b.id})</li>`).join('') +
        '</ul>';
    } else {
      boardListHtml = '<p>⚠️ ボードがありません。Pinterestでボードを作成してから、Firestoreの settings/pinterestApi に boardId を設定してください。</p>';
    }

    res.send(`
      <html>
      <body style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px;">
        <h2>✅ Pinterest OAuth 認可完了！</h2>
        <p>アクセストークンが正常に取得・保存されました。</p>
        ${boardListHtml}
        <p style="margin-top: 20px; color: #666; font-size: 14px;">
          次のステップ: Firestoreの <code>settings/pinterestApi</code> に <code>boardId</code> を設定してください。
        </p>
      </body>
      </html>
    `);

    console.log('[Pinterest OAuth] トークン取得・保存完了');
  } catch (err) {
    console.error('[Pinterest OAuth] エラー:', err.message);
    res.status(500).send(`OAuth error: ${err.message}`);
  }
});

/**
 * ボードIDを設定するエンドポイント
 */
exports.pinterestSetBoard = onRequest(async (req, res) => {
  const boardId = req.query.board_id;
  if (!boardId) {
    res.status(400).send('board_id is required');
    return;
  }

  await savePinterestTokens({boardId: boardId});
  res.send(`✅ Board ID set: ${boardId}`);
});

/**
 * Pinterest トークン期限チェック（毎日9時に実行）
 * リフレッシュトークンの期限7日前に管理者へ通知
 */
exports.checkPinterestTokenExpiry = onSchedule({
  schedule: '0 9 * * *',
  timeZone: 'Asia/Tokyo',
}, async () => {
  try {
    const settings = await getPinterestTokens();
    if (!settings || !settings.enabled || !settings.refreshTokenExpiresAt) {
      return;
    }

    const now = Date.now();
    const daysLeft = Math.floor((settings.refreshTokenExpiresAt - now) / (24 * 60 * 60 * 1000));

    // 3日前と期限切れのみ通知
    if (daysLeft > 3 || (daysLeft > 0 && daysLeft < 3)) return;

    const db = getFirestore();

    // 管理者を取得
    const adminsSnapshot = await db.collection('users')
      .where('permissionId', '==', 'owner')
      .get();

    const urgency = daysLeft <= 0 ? '🔴 期限切れ' : '🟠 あと3日';
    const title = `${urgency}: Pinterest認証の更新が必要です`;
    const body = daysLeft <= 0
      ? 'Pinterestの認証が期限切れです。自動投稿が停止しています。以下のURLにアクセスして再認証してください。'
      : 'Pinterestの認証があと3日で期限切れになります。以下のURLにアクセスして再認証してください。';

    for (const doc of adminsSnapshot.docs) {
      // お知らせ作成
      await db.collection('users').doc(doc.id).collection('personalAnnouncements').add({
        title: title,
        body: body + '\nhttps://us-central1-reborn-chat.cloudfunctions.net/pinterestOAuthCallback',
        priority: 'high',
        type: 'pinterest_token_expiry',
        createdAt: new Date().toISOString(),
      });

      // FCMプッシュ通知
      try {
        const deviceDoc = await db.collection('activeDevices').doc(doc.id).get();
        if (deviceDoc.exists) {
          const tokens = Array.isArray(deviceDoc.data().fcmTokens)
            ? deviceDoc.data().fcmTokens
            : [deviceDoc.data().fcmToken].filter(Boolean);

          for (const token of tokens) {
            await getMessaging().send({
              token: token,
              notification: {title: title, body: body},
              webpush: {fcmOptions: {link: '/'}},
            }).catch(() => {});
          }
        }
      } catch (e) {
        console.error('[Pinterest] FCM通知エラー:', e.message);
      }
    }

    console.log(`[Pinterest] トークン期限通知送信 (残り${daysLeft}日)`);
  } catch (error) {
    console.error('[Pinterest] トークン期限チェックエラー:', error.message);
  }
});
