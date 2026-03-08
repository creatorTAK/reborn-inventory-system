/**
 * Photoroom API Proxy - 背景除去 + AIシャドウ + リライティング
 *
 * フロントエンドから直接Photoroom APIキーを使わず、
 * Cloud Function経由で安全にAPI呼び出しを行う。
 */

const {onRequest} = require('firebase-functions/v2/https');
const {defineSecret} = require('firebase-functions/params');

const photoroomApiKey = defineSecret('PHOTOROOM_API_KEY');

/**
 * POST /photoroomEditImage
 * Body: { imageBase64: 'data:image/jpeg;base64,...' }
 * Returns: { success: true, imageBase64: 'data:image/png;base64,...' }
 */
exports.photoroomEditImage = onRequest(
  {
    region: 'asia-northeast1',
    cors: ['https://furira.jp', 'http://localhost:5000', 'http://localhost:3000'],
    secrets: [photoroomApiKey],
    timeoutSeconds: 60,
    memory: '512MiB',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).json({error: 'Method not allowed'});
      return;
    }

    try {
      const {imageBase64} = req.body;

      if (!imageBase64) {
        res.status(400).json({error: 'imageBase64 is required'});
        return;
      }

      // base64データからバイナリに変換
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');

      // multipart/form-data を構築
      const boundary = '----FormBoundary' + Date.now().toString(16);
      const parts = [];

      // 画像ファイル
      parts.push(
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="imageFile"; filename="image.jpg"\r\n' +
        'Content-Type: image/jpeg\r\n\r\n'
      );
      parts.push(imageBuffer);
      parts.push('\r\n');

      // パラメータ: 背景除去
      parts.push(
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="removeBackground"\r\n\r\n' +
        'true\r\n'
      );

      // パラメータ: 白背景
      parts.push(
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="background.color"\r\n\r\n' +
        '#FFFFFF\r\n'
      );

      // パラメータ: AIシャドウ（ソフトシャドウ）
      parts.push(
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="shadow.mode"\r\n\r\n' +
        'ai.soft\r\n'
      );

      // パラメータ: リライティング
      parts.push(
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="lighting.mode"\r\n\r\n' +
        'ai.auto\r\n'
      );

      // パラメータ: 出力フォーマット（JPEG: 軽量）
      parts.push(
        `--${boundary}\r\n` +
        'Content-Disposition: form-data; name="export.format"\r\n\r\n' +
        'jpeg\r\n'
      );

      // 終了
      parts.push(`--${boundary}--\r\n`);

      // Buffer結合
      const bodyParts = parts.map((part) =>
        typeof part === 'string' ? Buffer.from(part) : part
      );
      const body = Buffer.concat(bodyParts);

      const response = await fetch('https://image-api.photoroom.com/v2/edit', {
        method: 'POST',
        headers: {
          'x-api-key': photoroomApiKey.value(),
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body: body,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Photoroom] API error:', response.status, errorText);
        res.status(response.status).json({
          error: 'Photoroom API error',
          detail: errorText,
        });
        return;
      }

      // レスポンス画像をbase64に変換
      const resultArrayBuffer = await response.arrayBuffer();
      const resultBase64 = 'data:image/jpeg;base64,' + Buffer.from(resultArrayBuffer).toString('base64');

      res.status(200).json({
        success: true,
        imageBase64: resultBase64,
      });
    } catch (error) {
      console.error('[Photoroom] Proxy error:', error);
      res.status(500).json({error: 'Internal server error', detail: error.message});
    }
  }
);
