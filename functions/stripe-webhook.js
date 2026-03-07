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
}
