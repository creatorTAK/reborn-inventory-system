/**
 * Stripe Checkout - FURIRA EC Site
 *
 * カートの商品IDを受け取り、Stripe Checkout Sessionを作成して返す。
 * 商品データはFirestoreから取得し、価格改ざんを防止。
 */

const {onRequest} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');
const {getFirestore} = require('firebase-admin/firestore');

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');

/**
 * POST /createCheckoutSession
 * Body: { items: ['productId1', 'productId2', ...] }
 * Returns: { url: 'https://checkout.stripe.com/...' }
 */
exports.createCheckoutSession = onRequest(
  {
    region: 'asia-northeast1',
    cors: ['https://furira.jp', 'http://localhost:5000', 'http://localhost:3000'],
    secrets: [stripeSecretKey],
  },
  async (req, res) => {
    // POST only
    if (req.method !== 'POST') {
      res.status(405).json({error: 'Method not allowed'});
      return;
    }

    const {items} = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({error: 'items is required'});
      return;
    }

    // Max 20 items
    if (items.length > 20) {
      res.status(400).json({error: 'Too many items'});
      return;
    }

    try {
      const db = getFirestore();
      const stripe = require('stripe')(stripeSecretKey.value());

      // マークアップ設定を取得
      let markupPercent = 0;
      try {
        const settingsDoc = await db.collection('settings').doc('ecAutoPriceRules').get();
        if (settingsDoc.exists) markupPercent = settingsDoc.data().markupPercent || 0;
      } catch (e) { /* ignore */ }

      // Fetch product data from Firestore (price from DB, not client)
      const lineItems = [];
      const unavailable = [];

      for (const productId of items) {
        const doc = await db.collection('products').doc(productId).get();
        if (!doc.exists) {
          unavailable.push(productId);
          continue;
        }

        const data = doc.data();
        const status = data.status || '';
        if (status === '販売済み' || status === '販売済') {
          unavailable.push(productId);
          continue;
        }

        // EC価格優先: ecPrice > markup適用 > listingAmount
        let price = 0;
        if (data.ecPrice && data.ecPrice > 0) {
          price = data.ecPrice;
        } else if (markupPercent > 0) {
          price = Math.round((data.listingAmount || 0) * (1 + markupPercent / 100));
        } else {
          price = data.listingAmount || 0;
        }
        if (price <= 0) {
          unavailable.push(productId);
          continue;
        }

        // Get first image for Stripe checkout display
        let imageUrl = '';
        if (data.images && data.images.imageUrls && data.images.imageUrls.length > 0) {
          imageUrl = data.images.imageUrls[0];
        } else if (data.images && Array.isArray(data.images) && data.images.length > 0) {
          imageUrl = data.images[0];
        } else if (data.imageUrl1) {
          imageUrl = data.imageUrl1;
        }

        const brand = (typeof data.brand === 'object' && data.brand !== null)
          ? (data.brand.name || data.brand.label || '') : (data.brand || '');
        const name = (brand ? brand + ' ' : '') + (data.productName || 'FURIRA商品');

        const lineItem = {
          price_data: {
            currency: 'jpy',
            product_data: {
              name: name,
              metadata: {productId: doc.id},
            },
            unit_amount: Math.round(price),
          },
          quantity: 1,
        };

        if (imageUrl) {
          lineItem.price_data.product_data.images = [imageUrl];
        }

        lineItems.push(lineItem);
      }

      if (lineItems.length === 0) {
        res.status(400).json({
          error: 'No available items',
          unavailable: unavailable,
        });
        return;
      }

      // Create Stripe Checkout Session
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: lineItems,
        shipping_address_collection: {
          allowed_countries: ['JP'],
        },
        phone_number_collection: {
          enabled: true,
        },
        payment_method_types: ['card'],
        metadata: {
          productIds: items.join(','),
        },
        success_url: 'https://furira.jp/shop/success.html?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://furira.jp/shop/cart.html',
      });

      res.json({
        url: session.url,
        unavailable: unavailable,
      });
    } catch (error) {
      console.error('[Stripe] Checkout session error:', error);
      res.status(500).json({error: 'Failed to create checkout session'});
    }
  }
);
