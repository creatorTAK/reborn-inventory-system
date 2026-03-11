/**
 * Instagram + Facebook 自動投稿
 *
 * 商品登録時にInstagram Graph API + Facebook Pages APIで自動投稿
 * Meta OAuth2トークンはFirestoreで管理（自動リフレッシュ）
 *
 * Instagram: 2ステップ（コンテナ作成→公開）
 * Facebook: 1ステップ（画像付き投稿）
 */

const {onDocumentCreated} = require('firebase-functions/v2/firestore');
const {onRequest} = require('firebase-functions/v2/https');
const {onSchedule} = require('firebase-functions/v2/scheduler');
const {getFirestore} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');

const META_GRAPH_API = 'https://graph.facebook.com/v25.0';

/**
 * FirestoreからMeta API設定を取得
 */
async function getMetaSettings() {
  const db = getFirestore();
  const doc = await db.collection('settings').doc('metaApi').get();
  if (!doc.exists) return null;
  return doc.data();
}

/**
 * Meta API設定をFirestoreに保存
 */
async function saveMetaSettings(data) {
  const db = getFirestore();
  await db.collection('settings').doc('metaApi').set(data, {merge: true});
}

/**
 * 長期トークンを取得（短期トークン→長期トークンに交換）
 * 長期トークンは60日有効
 */
async function exchangeForLongLivedToken(shortLivedToken, appId, appSecret) {
  const url = `${META_GRAPH_API}/oauth/access_token?` +
    `grant_type=fb_exchange_token` +
    `&client_id=${appId}` +
    `&client_secret=${appSecret}` +
    `&fb_exchange_token=${shortLivedToken}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Long-lived token exchange failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in, // 秒
  };
}

/**
 * ページアクセストークンを取得
 * ユーザートークンからページトークンを取得（ページトークンは無期限）
 */
async function getPageAccessToken(userAccessToken, pageId) {
  const url = `${META_GRAPH_API}/${pageId}?fields=access_token&access_token=${userAccessToken}`;

  const response = await fetch(url);
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Page access token failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Instagram投稿用のキャプションを生成
 */
function buildInstagramCaption(productData) {
  const title = productData.ecTitle || productData.productName || '';
  const description = productData.ecDescription || productData.description || '';

  // 商品情報
  const brand = (productData.brand && productData.brand.nameEn) || '';
  const brandKana = (productData.brand && productData.brand.nameKana) || '';
  const category = productData.itemName || '';
  const size = (productData.size && productData.size.display) || '';
  const condition = productData.condition || '';
  const color = (productData.colors && productData.colors[0] && productData.colors[0].color) || '';

  // 価格（EC価格 > 出品金額）
  const price = productData.ecPrice ||
    (productData.listing && productData.listing.amount) ||
    productData.listingAmount || 0;

  // 商品情報ブロック
  const infoLines = [];
  if (brand) infoLines.push(`ブランド: ${brand}${brandKana ? ` (${brandKana})` : ''}`);
  if (category) infoLines.push(`アイテム: ${category}`);
  if (size) infoLines.push(`サイズ: ${size}`);
  if (condition) infoLines.push(`状態: ${condition}`);
  if (price > 0) infoLines.push(`💰 ¥${price.toLocaleString()}（税込・送料込）`);
  const infoBlock = infoLines.length > 0 ? infoLines.join('\n') : '';

  // 説明文を120文字に制限
  const shortDesc = description.length > 120 ? description.substring(0, 117) + '...' : description;

  // ハッシュタグ生成
  const hashtags = ['#FURIRA', '#古着', '#ヴィンテージ', '#セレクトショップ'];
  if (brand) hashtags.push(`#${brand.replace(/\s+/g, '')}`);
  if (brandKana) hashtags.push(`#${brandKana.replace(/\s+/g, '')}`);
  if (category) hashtags.push(`#${category.replace(/\s+/g, '')}`);
  if (color) hashtags.push(`#${color}`);
  hashtags.push('#ファッション', '#古着コーデ', '#古着好きな人と繋がりたい', '#古着女子', '#古着男子', '#コーデ', '#今日のコーデ');

  // キャプション組み立て
  let caption = title;
  if (infoBlock) caption += `\n\n${infoBlock}`;
  if (shortDesc) caption += `\n\n${shortDesc}`;
  caption += '\n\n🛒 ショップはプロフィールのリンクから';
  caption += `\n\n${hashtags.join(' ')}`;

  return caption;
}

/**
 * Instagramに画像を投稿（単一画像 or カルーセル）
 * カルーセルは最大10枚（Instagram APIの上限）
 */
async function postToInstagram(igUserId, accessToken, imageUrls, caption) {
  // 配列でない場合は配列に変換
  const urls = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  // Instagram APIの上限は10枚
  const images = urls.slice(0, 10);

  if (images.length === 1) {
    // 単一画像投稿
    return await postInstagramSingle(igUserId, accessToken, images[0], caption);
  }

  // カルーセル投稿（複数画像）
  // Step 1: 各画像のコンテナを作成
  const childIds = [];
  for (const url of images) {
    const containerResponse = await fetch(`${META_GRAPH_API}/${igUserId}/media`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        image_url: url,
        is_carousel_item: true,
        access_token: accessToken,
      }),
    });

    if (!containerResponse.ok) {
      const error = await containerResponse.text();
      console.error(`[Instagram] カルーセル子コンテナ作成失敗:`, error);
      continue;
    }

    const containerData = await containerResponse.json();
    childIds.push(containerData.id);
    console.log('[Instagram] カルーセル子コンテナ作成:', containerData.id);
  }

  if (childIds.length === 0) {
    throw new Error('Instagram carousel: no child containers created');
  }

  // 子コンテナが1つだけになった場合は単一画像投稿にフォールバック
  if (childIds.length === 1) {
    return await postInstagramSingle(igUserId, accessToken, images[0], caption);
  }

  // Step 2: カルーセルコンテナを作成
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const carouselResponse = await fetch(`${META_GRAPH_API}/${igUserId}/media`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      media_type: 'CAROUSEL',
      children: childIds,
      caption: caption,
      access_token: accessToken,
    }),
  });

  if (!carouselResponse.ok) {
    const error = await carouselResponse.text();
    throw new Error(`Instagram carousel creation failed: ${carouselResponse.status} ${error}`);
  }

  const carouselData = await carouselResponse.json();
  console.log('[Instagram] カルーセルコンテナ作成:', carouselData.id);

  // Step 3: 公開
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const publishResponse = await fetch(`${META_GRAPH_API}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      creation_id: carouselData.id,
      access_token: accessToken,
    }),
  });

  if (!publishResponse.ok) {
    const error = await publishResponse.text();
    throw new Error(`Instagram carousel publish failed: ${publishResponse.status} ${error}`);
  }

  const publishData = await publishResponse.json();
  console.log('[Instagram] カルーセル投稿成功:', publishData.id);
  return publishData;
}

/**
 * Instagram単一画像投稿
 */
async function postInstagramSingle(igUserId, accessToken, imageUrl, caption) {
  const containerResponse = await fetch(`${META_GRAPH_API}/${igUserId}/media`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      image_url: imageUrl,
      caption: caption,
      access_token: accessToken,
    }),
  });

  if (!containerResponse.ok) {
    const error = await containerResponse.text();
    throw new Error(`Instagram container creation failed: ${containerResponse.status} ${error}`);
  }

  const containerData = await containerResponse.json();
  console.log('[Instagram] コンテナ作成:', containerData.id);

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const publishResponse = await fetch(`${META_GRAPH_API}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      creation_id: containerData.id,
      access_token: accessToken,
    }),
  });

  if (!publishResponse.ok) {
    const error = await publishResponse.text();
    throw new Error(`Instagram publish failed: ${publishResponse.status} ${error}`);
  }

  const publishData = await publishResponse.json();
  console.log('[Instagram] 投稿成功:', publishData.id);
  return publishData;
}

/**
 * Facebookページに画像付き投稿
 */
async function postToFacebook(pageId, pageAccessToken, imageUrl, message, link) {
  const response = await fetch(`${META_GRAPH_API}/${pageId}/photos`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      url: imageUrl,
      message: message,
      access_token: pageAccessToken,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Facebook post failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  console.log('[Facebook] 投稿成功:', data.id);
  return data;
}

/**
 * 商品登録時の自動投稿トリガー
 */
exports.onProductCreatedMeta = onDocumentCreated('products/{productId}', async (event) => {
  const productId = event.params.productId;

  try {
    const settings = await getMetaSettings();
    if (!settings || !settings.enabled) {
      console.log('[Meta] 自動投稿が無効のためスキップ');
      return;
    }

    const productData = event.data.data();
    if (!productData) {
      console.log('[Meta] 商品データなし、スキップ');
      return;
    }

    // 商品画像がない場合はスキップ
    const imageUrls = (productData.images && productData.images.imageUrls) || [];
    if (imageUrls.length === 0) {
      console.log('[Meta] 画像がないためスキップ:', productId);
      return;
    }

    const shopUrl = `https://furira.jp/shop/item.html?id=${productId}`;
    const title = productData.ecTitle || productData.productName || '';
    const description = productData.ecDescription || productData.description || '';

    const db = getFirestore();
    const updateData = {};

    // Instagram投稿（複数画像カルーセル対応）
    if (settings.instagramUserId && settings.instagramAccessToken) {
      try {
        const caption = buildInstagramCaption(productData);
        const igResult = await postToInstagram(
          settings.instagramUserId,
          settings.instagramAccessToken,
          imageUrls,
          caption,
        );
        updateData.instagramPostId = igResult.id;
        updateData.instagramPostedAt = new Date().toISOString();
        console.log(`[Instagram] 自動投稿完了: ${productId}`);
      } catch (igError) {
        console.error(`[Instagram] 投稿エラー (${productId}):`, igError.message);
      }
    }

    // Facebook投稿
    if (settings.facebookPageId && settings.facebookPageAccessToken) {
      try {
        const brand = (productData.brand && productData.brand.nameEn) || '';
        const price = productData.ecPrice ||
          (productData.listing && productData.listing.amount) ||
          productData.listingAmount || 0;
        const size = (productData.size && productData.size.display) || '';
        const condition = productData.condition || '';
        const fbInfoLines = [title];
        if (brand) fbInfoLines.push(`ブランド: ${brand}`);
        if (size) fbInfoLines.push(`サイズ: ${size}`);
        if (condition) fbInfoLines.push(`状態: ${condition}`);
        if (price > 0) fbInfoLines.push(`💰 ¥${price.toLocaleString()}（税込・送料込）`);
        if (description) fbInfoLines.push('', description);
        fbInfoLines.push('', `🛒 ${shopUrl}`);
        const fbMessage = fbInfoLines.join('\n');
        const fbResult = await postToFacebook(
          settings.facebookPageId,
          settings.facebookPageAccessToken,
          imageUrls[0],
          fbMessage,
          shopUrl,
        );
        updateData.facebookPostId = fbResult.id;
        updateData.facebookPostedAt = new Date().toISOString();
        console.log(`[Facebook] 自動投稿完了: ${productId}`);
      } catch (fbError) {
        console.error(`[Facebook] 投稿エラー (${productId}):`, fbError.message);
      }
    }

    // 投稿結果をFirestoreに記録
    if (Object.keys(updateData).length > 0) {
      await db.collection('products').doc(productId).update(updateData);
    }
  } catch (error) {
    console.error(`[Meta] 自動投稿エラー (${productId}):`, error.message);
  }
});

/**
 * Meta OAuth2 コールバック用HTTPエンドポイント
 */
exports.metaOAuthCallback = onRequest(async (req, res) => {
  const code = req.query.code;
  const error = req.query.error;

  if (error) {
    res.status(400).send(`Meta OAuth error: ${error}`);
    return;
  }

  if (!code) {
    // 認可URLを生成して表示
    const settings = await getMetaSettings();
    if (!settings || !settings.appId) {
      res.status(500).send('Meta App ID not configured in Firestore settings/metaApi');
      return;
    }

    const redirectUri = `https://${req.headers.host}/metaOAuthCallback`;
    const authUrl = `https://www.facebook.com/v25.0/dialog/oauth?` +
      `client_id=${settings.appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=instagram_basic,instagram_content_publish,pages_read_engagement,pages_show_list,pages_manage_posts,business_management` +
      `&response_type=code`;

    res.send(`
      <html>
      <body style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px;">
        <h2>Meta (Instagram + Facebook) OAuth Setup</h2>
        <p>以下のリンクをクリックしてFacebook/Instagramアカウントを認可してください:</p>
        <a href="${authUrl}" style="display: inline-block; padding: 12px 24px; background: #1877F2; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
          Facebook/Instagramを認可する
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
    const settings = await getMetaSettings();
    if (!settings || !settings.appId || !settings.appSecret) {
      res.status(500).send('Meta API credentials not configured');
      return;
    }

    const redirectUri = `https://${req.headers.host}/metaOAuthCallback`;

    // 短期トークン取得
    const tokenUrl = `${META_GRAPH_API}/oauth/access_token?` +
      `client_id=${settings.appId}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${settings.appSecret}` +
      `&code=${code}`;

    const tokenResponse = await fetch(tokenUrl);
    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${tokenResponse.status} ${errText}`);
    }

    const tokenData = await tokenResponse.json();

    // 長期トークンに交換
    const longLived = await exchangeForLongLivedToken(
      tokenData.access_token,
      settings.appId,
      settings.appSecret,
    );

    // ユーザーが管理するページ一覧を取得
    const pagesResponse = await fetch(
      `${META_GRAPH_API}/me/accounts?fields=id,name,access_token,category&access_token=${longLived.accessToken}`,
    );
    const pagesData = await pagesResponse.json();
    let pages = pagesData.data || [];

    console.log('[Meta OAuth] /me/accounts response:', JSON.stringify(pagesData));

    // /me/accounts が空の場合、ユーザートークンで直接ページ情報を取得
    if (pages.length === 0) {
      // Firestoreに保存済みのページIDがあればそれを使う、なければ既知のページIDを試行
      const knownPageId = settings.facebookPageId || '109250680726855';
      try {
        const pageResponse = await fetch(
          `${META_GRAPH_API}/${knownPageId}?fields=id,name,access_token,instagram_business_account&access_token=${longLived.accessToken}`,
        );
        const pageData = await pageResponse.json();
        console.log('[Meta OAuth] Direct page fetch:', JSON.stringify(pageData));
        if (pageData.id && pageData.access_token) {
          pages = [{
            id: pageData.id,
            name: pageData.name,
            access_token: pageData.access_token,
            igUserId: pageData.instagram_business_account ? pageData.instagram_business_account.id : null,
          }];
        }
      } catch (e) {
        console.error('[Meta OAuth] Direct page fetch error:', e.message);
      }
    }

    // Instagram Business Account IDを取得（直接取得で既に入っている場合はスキップ）
    for (const page of pages) {
      if (page.igUserId) continue;
      const igResponse = await fetch(
        `${META_GRAPH_API}/${page.id}?fields=instagram_business_account&access_token=${page.access_token}`,
      );
      const igData = await igResponse.json();
      if (igData.instagram_business_account) {
        page.igUserId = igData.instagram_business_account.id;
      }
    }

    // トークンを保存
    const TOKEN_LIFETIME_MS = (longLived.expiresIn || 5184000) * 1000; // デフォルト60日
    await saveMetaSettings({
      userAccessToken: longLived.accessToken,
      tokenExpiresAt: Date.now() + TOKEN_LIFETIME_MS,
      lastRefreshed: new Date().toISOString(),
    });

    // ページ一覧を表示
    let pagesHtml = '';
    if (pages.length > 0) {
      pagesHtml = '<h3>Facebookページを選択:</h3><ul>' +
        pages.map((p) => {
          const igLabel = p.igUserId ? ` | Instagram: ${p.igUserId}` : ' | Instagram未連携';
          return `<li><a href="?set_page=${p.id}&page_token=${encodeURIComponent(p.access_token)}&ig_user_id=${p.igUserId || ''}&page_name=${encodeURIComponent(p.name)}">${p.name}</a> (${p.id}${igLabel})</li>`;
        }).join('') +
        '</ul>';
    } else {
      pagesHtml = '<p>⚠️ ページの自動検出に失敗しました（ビジネスポートフォリオ管理のページは自動検出できません）。</p>' +
        '<h3>手動でページを設定:</h3>' +
        `<p><a href="/metaSetPage?page_id=109250680726855" style="display:inline-block;padding:10px 20px;background:#1877F2;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">Furira ページを設定する</a></p>` +
        '<p style="margin-top:16px;font-size:13px;color:#666;">別のページIDを設定する場合:<br>' +
        '<code>/metaSetPage?page_id=YOUR_PAGE_ID</code></p>';
    }

    res.send(`
      <html>
      <body style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px;">
        <h2>✅ Meta OAuth 認可完了！</h2>
        <p>アクセストークンが正常に取得・保存されました。</p>
        ${pagesHtml}
      </body>
      </html>
    `);

    console.log('[Meta OAuth] トークン取得・保存完了');
  } catch (err) {
    console.error('[Meta OAuth] エラー:', err.message);
    res.status(500).send(`OAuth error: ${err.message}`);
  }
});

/**
 * ページ設定エンドポイント
 * ページIDを指定して、ユーザートークンからページトークン・Instagram情報を取得・保存
 */
exports.metaSetPage = onRequest(async (req, res) => {
  const pageId = req.query.page_id;

  if (!pageId) {
    res.status(400).send('page_id is required');
    return;
  }

  try {
    const settings = await getMetaSettings();
    if (!settings || !settings.userAccessToken) {
      res.status(500).send('ユーザートークンが未設定です。先にOAuth認可を行ってください。');
      return;
    }

    // ユーザートークンでページアクセストークンを取得
    const pageResponse = await fetch(
      `${META_GRAPH_API}/${pageId}?fields=id,name,access_token,instagram_business_account&access_token=${settings.userAccessToken}`,
    );
    const pageData = await pageResponse.json();

    let updateData = {
      facebookPageId: pageId,
      enabled: true,
    };

    if (pageData.error) {
      // ページトークン取得失敗 - ユーザートークンで代用
      console.log('[Meta] Page token fetch failed, using user token:', pageData.error.message);
      updateData.facebookPageAccessToken = settings.userAccessToken;
      updateData.facebookPageName = 'Furira';
      // Instagram IDは既知の値を使用
      updateData.instagramUserId = '17841441160691168';
      updateData.instagramAccessToken = settings.userAccessToken;
    } else {
      updateData.facebookPageAccessToken = pageData.access_token || settings.userAccessToken;
      updateData.facebookPageName = pageData.name || '';
      if (pageData.instagram_business_account) {
        updateData.instagramUserId = pageData.instagram_business_account.id;
        updateData.instagramAccessToken = pageData.access_token || settings.userAccessToken;
      } else {
        // 既知のInstagram ID
        updateData.instagramUserId = '17841441160691168';
        updateData.instagramAccessToken = pageData.access_token || settings.userAccessToken;
      }
    }

    await saveMetaSettings(updateData);

    res.send(`
      <html>
      <body style="font-family: sans-serif; max-width: 600px; margin: 40px auto; padding: 20px;">
        <h2>✅ 設定完了！</h2>
        <p>Facebook Page: ${updateData.facebookPageName} (${pageId})</p>
        <p>Instagram Business Account: ${updateData.instagramUserId}</p>
        ${pageData.error ? `<p style="color:#c60;">⚠️ ページトークンの直接取得に失敗したため、ユーザートークンで設定しました。<br>詳細: ${pageData.error.message}</p>` : ''}
        <p>商品が出品されるたびに自動投稿されます。</p>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('[Meta] metaSetPage error:', err.message);
    res.status(500).send(`Error: ${err.message}`);
  }
});

/**
 * Meta トークン期限チェック（毎日9時に実行）
 * 長期トークンの期限3日前と期限切れ時に通知
 */
exports.checkMetaTokenExpiry = onSchedule({
  schedule: '0 9 * * *',
  timeZone: 'Asia/Tokyo',
}, async () => {
  try {
    const settings = await getMetaSettings();
    if (!settings || !settings.enabled || !settings.tokenExpiresAt) {
      return;
    }

    const now = Date.now();
    const daysLeft = Math.floor((settings.tokenExpiresAt - now) / (24 * 60 * 60 * 1000));

    // 3日前と期限切れのみ通知
    if (daysLeft > 3 || (daysLeft > 0 && daysLeft < 3)) return;

    const db = getFirestore();
    const adminsSnapshot = await db.collection('users')
      .where('permissionId', '==', 'owner')
      .get();

    const urgency = daysLeft <= 0 ? '🔴 期限切れ' : '🟠 あと3日';
    const title = `${urgency}: Instagram/Facebook認証の更新が必要です`;
    const body = daysLeft <= 0
      ? 'Instagram/Facebookの認証が期限切れです。自動投稿が停止しています。再認証してください。'
      : 'Instagram/Facebookの認証があと3日で期限切れになります。再認証してください。';

    for (const doc of adminsSnapshot.docs) {
      await db.collection('users').doc(doc.id).collection('personalAnnouncements').add({
        title: title,
        body: body + '\nhttps://us-central1-reborn-chat.cloudfunctions.net/metaOAuthCallback',
        priority: 'high',
        type: 'meta_token_expiry',
        createdAt: new Date().toISOString(),
      });

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
        console.error('[Meta] FCM通知エラー:', e.message);
      }
    }

    console.log(`[Meta] トークン期限通知送信 (残り${daysLeft}日)`);
  } catch (error) {
    console.error('[Meta] トークン期限チェックエラー:', error.message);
  }
});
