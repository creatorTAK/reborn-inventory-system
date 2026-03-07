/**
 * Stripe Webhook Handler - FURIRA EC Site
 *
 * checkout.session.completed イベントを受信し:
 * 1. 注文データをFirestoreに保存（orders コレクション）
 * 2. 商品ステータスを「販売済み」に更新
 * 3. 管理者にFCM通知を送信
 */

const {onRequest} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getMessaging} = require('firebase-admin/messaging');

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

exports.stripeWebhook = onRequest(
  {
    region: 'asia-northeast1',
    secrets: [stripeSecretKey, stripeWebhookSecret],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method not allowed');
      return;
    }

    const stripe = require('stripe')(stripeSecretKey.value());

    // Verify webhook signature
    let event;
    try {
      const sig = req.headers['stripe-signature'];
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        sig,
        stripeWebhookSecret.value()
      );
    } catch (err) {
      console.error('[Webhook] Signature verification failed:', err.message);
      res.status(400).send('Webhook signature verification failed');
      return;
    }

    // Handle checkout.session.completed
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      console.log('[Webhook] checkout.session.completed:', session.id);

      try {
        await handleCheckoutCompleted(session, stripe);
        res.json({received: true});
      } catch (error) {
        console.error('[Webhook] Error handling checkout:', error);
        // Return 200 to prevent Stripe from retrying
        res.json({received: true, error: error.message});
      }
      return;
    }

    // Other events - acknowledge
    res.json({received: true});
  }
);

async function handleCheckoutCompleted(session, stripe) {
  const db = getFirestore();
  const messaging = getMessaging();

  // Get product IDs from metadata
  const productIds = (session.metadata && session.metadata.productIds)
    ? session.metadata.productIds.split(',')
    : [];

  if (productIds.length === 0) {
    console.warn('[Webhook] No productIds in session metadata');
    return;
  }

  // Get line items for price details
  const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

  // Get shipping details
  const shipping = session.shipping_details || session.customer_details || {};
  const customerEmail = session.customer_details ? session.customer_details.email : '';
  const customerPhone = session.customer_details ? session.customer_details.phone : '';

  // 1. Save order to Firestore
  const orderData = {
    sessionId: session.id,
    paymentIntentId: session.payment_intent,
    productIds: productIds,
    customerEmail: customerEmail,
    customerPhone: customerPhone || '',
    shippingAddress: shipping.address || {},
    shippingName: shipping.name || '',
    amountTotal: session.amount_total,
    currency: session.currency,
    status: 'paid',
    createdAt: FieldValue.serverTimestamp(),
    items: lineItems.data.map(function(item) {
      return {
        name: item.description,
        amount: item.amount_total,
        quantity: item.quantity,
      };
    }),
  };

  const orderRef = await db.collection('orders').add(orderData);
  console.log('[Webhook] Order saved:', orderRef.id);

  // 2. Update product status to 販売済み
  var productNames = [];
  for (const productId of productIds) {
    try {
      const productDoc = await db.collection('products').doc(productId).get();
      if (productDoc.exists) {
        const productData = productDoc.data();
        productNames.push(productData.productName || productId);

        await db.collection('products').doc(productId).update({
          status: '販売済み',
          saleDate: FieldValue.serverTimestamp(),
          saleAmount: Math.round((session.amount_total || 0) / productIds.length),
          saleChannel: 'EC',
          orderId: orderRef.id,
        });
        console.log('[Webhook] Product updated to 販売済み:', productId);
      }
    } catch (err) {
      console.error('[Webhook] Failed to update product:', productId, err);
    }
  }

  // 3. Create task for admins (やることリスト)
  try {
    const adminEmails = [];
    const activeDevicesSnap2 = await db.collection('activeDevices').get();
    activeDevicesSnap2.forEach(function(doc) { adminEmails.push(doc.id); });

    const itemNames = productNames.length > 0 ? productNames.join(', ') : productIds.join(', ');
    const totalYenTask = Math.round((session.amount_total || 0));

    for (const email of adminEmails) {
      await db.collection('userTasks').doc(email).collection('tasks').add({
        title: 'EC注文: ' + itemNames,
        description: '¥' + totalYenTask.toLocaleString() + ' の注文が入りました。メルカリ出品の取り下げと発送準備をしてください。',
        type: 'ec_order',
        completed: false,
        createdAt: FieldValue.serverTimestamp(),
        dueDate: null,
        link: '',
        relatedData: {
          orderId: orderRef.id,
          productIds: productIds,
          amountTotal: totalYenTask,
          customerEmail: customerEmail,
          shippingName: shipping.name || '',
        },
      });
    }
    console.log('[Webhook] Tasks created for', adminEmails.length, 'admins');
  } catch (err) {
    console.error('[Webhook] Task creation failed:', err);
  }

  // 4. Send FCM notification to admins
  try {
    const totalYen = Math.round((session.amount_total || 0));
    const itemText = productNames.length > 0
      ? productNames.join(', ')
      : productIds.join(', ');

    // Get all active devices for notification
    const activeDevicesSnap = await db.collection('activeDevices').get();
    const tokens = [];
    activeDevicesSnap.forEach(function(doc) {
      const data = doc.data();
      if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
        data.fcmTokens.forEach(function(t) { if (t) tokens.push(t); });
      } else if (data.token) {
        tokens.push(data.token);
      }
    });
    console.log('[Webhook] FCM tokens found:', tokens.length);

    if (tokens.length > 0) {
      const message = {
        notification: {
          title: 'EC注文が入りました',
          body: itemText + ' (¥' + totalYen.toLocaleString() + ')',
        },
        data: {
          type: 'ec_order',
          orderId: orderRef.id,
          url: '/shop/success.html',
        },
        tokens: tokens,
      };

      const result = await messaging.sendEachForMulticast(message);
      console.log('[Webhook] FCM sent:', result.successCount, 'success,', result.failureCount, 'failed');
    }
  } catch (err) {
    console.error('[Webhook] FCM notification failed:', err);
    // Don't throw - order is already saved
  }

  // 5. Send order confirmation email to customer
  console.log('[Webhook] Step 5: Email check - customerEmail:', customerEmail || '(empty)');
  if (customerEmail) {
    try {
      const totalYenEmail = Math.round((session.amount_total || 0));
      const orderNumber = session.id.substring(0, 24).toUpperCase();
      const itemListHtml = productNames.map(function(name) {
        return '<li style="padding: 4px 0;">' + escapeHtmlStr(name) + '</li>';
      }).join('');
      const shippingAddr = shipping.address || {};
      const addrText = [
        shippingAddr.postal_code ? '〒' + shippingAddr.postal_code : '',
        shippingAddr.state || '',
        shippingAddr.city || '',
        shippingAddr.line1 || '',
        shippingAddr.line2 || '',
      ].filter(Boolean).join(' ');

      const subject = '【FURIRA】ご注文ありがとうございます（注文番号: ' + orderNumber + '）';
      const textBody = 'FURIRA ご注文確認\n\n'
        + '注文番号: ' + orderNumber + '\n'
        + '商品: ' + productNames.join(', ') + '\n'
        + '合計: ¥' + totalYenEmail.toLocaleString() + '\n'
        + 'お届け先: ' + (shipping.name || '') + ' ' + addrText + '\n\n'
        + '発送準備が整い次第、改めてご連絡いたします。\n'
        + 'ご不明な点がございましたら、お気軽にお問い合わせください。\n\n'
        + 'FURIRA - Vintage & Used Clothing';

      const htmlBody = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Noto Sans JP', sans-serif; line-height: 1.6; color: #2C2C2C; margin: 0; padding: 0; background: #F5F2ED;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: #2C2C2C; color: white; padding: 24px; text-align: center; border-radius: 8px 8px 0 0;">
      <h1 style="margin: 0; font-size: 28px; font-weight: 700; letter-spacing: 0.1em;">FURIRA</h1>
      <p style="margin: 8px 0 0 0; font-size: 12px; opacity: 0.7; letter-spacing: 0.05em;">vintage &amp; used clothing</p>
    </div>
    <div style="background: #fff; padding: 32px 24px; border: 1px solid #e5e7eb; border-top: none;">
      <h2 style="margin: 0 0 16px 0; font-size: 18px; color: #2C2C2C;">ご注文ありがとうございます</h2>
      <p style="margin: 0 0 24px 0; font-size: 14px; color: #6B6560;">ご注文を承りました。発送準備が整い次第、改めてご連絡いたします。</p>

      <div style="background: #F5F2ED; padding: 16px; border-radius: 6px; margin-bottom: 24px;">
        <div style="font-size: 12px; color: #9B9590; margin-bottom: 4px;">注文番号</div>
        <div style="font-size: 18px; font-weight: 700; color: #2C2C2C; letter-spacing: 0.05em;">${orderNumber}</div>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 600; color: #2C2C2C; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 8px;">ご注文商品</div>
        <ul style="list-style: none; padding: 0; margin: 0; font-size: 14px; color: #2C2C2C;">${itemListHtml}</ul>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 2px solid #2C2C2C; padding-top: 12px; margin-bottom: 24px;">
        <span style="font-size: 14px; font-weight: 600;">合計（税込）</span>
        <span style="font-size: 20px; font-weight: 700;">&yen;${totalYenEmail.toLocaleString()}</span>
      </div>

      <div style="margin-bottom: 24px;">
        <div style="font-size: 13px; font-weight: 600; color: #2C2C2C; margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 8px;">お届け先</div>
        <div style="font-size: 14px; color: #2C2C2C;">${escapeHtmlStr(shipping.name || '')}</div>
        <div style="font-size: 13px; color: #6B6560;">${escapeHtmlStr(addrText)}</div>
      </div>

      <p style="font-size: 13px; color: #9B9590; margin: 24px 0 0 0;">ご不明な点がございましたら、お気軽にお問い合わせください。</p>
    </div>
    <div style="text-align: center; padding: 16px; font-size: 11px; color: #9B9590;">
      &copy; 2026 FURIRA. All rights reserved.
    </div>
  </div>
</body></html>`;

      console.log('[Webhook] Step 5: Calling sendOrderEmail to:', customerEmail);
      const emailResult = await sendOrderEmail(customerEmail, subject, textBody, htmlBody);
      console.log('[Webhook] Step 5: Email result:', JSON.stringify(emailResult));
    } catch (err) {
      console.error('[Webhook] Step 5: Order email FAILED:', err.message, err.stack);
    }
  }
}

function escapeHtmlStr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function sendOrderEmail(to, subject, textBody, htmlBody) {
  const CLOUDFLARE_WORKER_URL = 'https://reborn-fcm-worker.mercari-yasuhirotakuji.workers.dev/send-email';
  console.log('[sendOrderEmail] Sending to:', to, 'via:', CLOUDFLARE_WORKER_URL);

  const response = await fetch(CLOUDFLARE_WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: to,
      subject: subject,
      text: textBody,
      html: htmlBody,
    }),
  });

  const responseText = await response.text();
  console.log('[sendOrderEmail] Response status:', response.status, 'body:', responseText.substring(0, 500));
  let result;
  try {
    result = JSON.parse(responseText);
  } catch (e) {
    throw new Error('Email response not JSON: ' + responseText.substring(0, 200));
  }
  if (!response.ok || !result.success) {
    throw new Error('Email send failed: ' + JSON.stringify(result));
  }
  return result;
}
