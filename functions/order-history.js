/**
 * Order History API - FURIRA EC Site
 *
 * メールアドレスで注文履歴を取得する。
 * セキュリティ: メールアドレスに紐づく注文のみ返却。
 * 個人情報（住所・電話番号）は返さない。
 */

const {onRequest} = require('firebase-functions/v2/https');
const {getFirestore} = require('firebase-admin/firestore');

/**
 * POST /getOrderHistory
 * Body: { email: 'customer@example.com' }
 * Returns: { orders: [...] }
 */
exports.getOrderHistory = onRequest(
  {
    region: 'asia-northeast1',
    cors: ['https://furira.jp', 'http://localhost:5000', 'http://localhost:3000'],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({error: 'Method not allowed'});
      return;
    }

    const {email} = req.body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({error: 'Valid email is required'});
      return;
    }

    try {
      const db = getFirestore();
      const snapshot = await db.collection('orders')
        .where('customerEmail', '==', email.trim().toLowerCase())
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

      const orders = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        orders.push({
          id: doc.id,
          orderNumber: doc.id.substring(0, 8).toUpperCase(),
          status: data.status || 'paid',
          amountTotal: data.amountTotal || 0,
          currency: data.currency || 'jpy',
          items: (data.items || []).map((item) => ({
            name: item.name || '',
            amount: item.amount || 0,
            quantity: item.quantity || 1,
          })),
          createdAt: data.createdAt ? data.createdAt.toDate().toISOString() : null,
          shippedAt: data.shippedAt ? data.shippedAt.toDate().toISOString() : null,
          deliveredAt: data.deliveredAt ? data.deliveredAt.toDate().toISOString() : null,
          carrier: data.carrier || '',
          trackingNumber: data.trackingNumber || '',
        });
      });

      res.json({orders});
    } catch (error) {
      console.error('[OrderHistory] Error:', error);
      res.status(500).json({error: 'Failed to fetch orders'});
    }
  }
);
