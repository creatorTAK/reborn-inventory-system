# Cloudflare R2 署名付きURL実装の調査依頼

## 現在の状況

### 達成したいこと
スマホアプリからCloudflare R2に画像を**直接**アップロードして、現在15-18秒かかっている処理を5-8秒に短縮したい（3枚の画像）。

### 現在の問題
以下の実装を試したが、速度がほとんど改善していない：
```
スマホ → Workers（中継） → R2
```

### 目指す実装
```
スマホ → 署名付きURL取得（Workers） → R2に直接PUT → 完了後、URLのみをGASに送信
```

---

## 既存環境

### Cloudflare環境
- **R2バケット名**: `reborn-test`
- **リージョン**: APAC
- **Workers名**: `reborn-r2-uploader`
- **Workers URL**: `https://reborn-r2-uploader.mercari-yasuhirotakuji.workers.dev`
- **R2バインディング**: `MY_BUCKET`

### 現在のWorkers実装
```javascript
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // POST /upload - 画像アップロード（現在は中継方式）
    if (request.method === 'POST' && url.pathname === '/upload') {
      const formData = await request.formData();
      const file = formData.get('file');

      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(7);
      const fileName = `${timestamp}-${randomStr}-${file.name}`;

      await env.MY_BUCKET.put(fileName, file.stream(), {
        httpMetadata: { contentType: file.type }
      });

      return new Response(JSON.stringify({
        success: true,
        fileName: fileName,
        url: `${url.origin}/image/${fileName}`
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // GET /image/{fileName} - 画像取得
    if (request.method === 'GET' && url.pathname.startsWith('/image/')) {
      const fileName = url.pathname.replace('/image/', '');
      const object = await env.MY_BUCKET.get(fileName);

      if (!object) {
        return new Response('Not Found', { status: 404 });
      }

      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata.contentType,
          'Access-Control-Allow-Origin': '*'
        }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
```

### クライアント側（スマホ）
- Google Apps Scriptで作られたWebアプリ
- JavaScriptで実装
- 画像はBase64形式でメモリに保持
- 最大20枚の画像を扱う

---

## 調査してほしい内容

### 1. 署名付きURL生成方法
**質問：**
- Cloudflare WorkersでR2の署名付きURL（Presigned URL）を生成する方法は？
- R2はAWS S3のSignature V4と互換性があるか？
- Workers SDKに署名付きURL生成機能はあるか？
- 公式のサンプルコードはあるか？

### 2. CORS設定
**質問：**
- R2バケットにCORS設定は必要か？
- 必要な場合、設定方法は？（Cloudflare Dashboard or API?）
- スマホブラウザから直接PUTリクエストを送る際の注意点は？

### 3. クライアント側の実装
**質問：**
- JavaScript（ブラウザ環境）から署名付きURLを使ってR2にPUTする具体的なコード例は？
- FormDataを使うか、直接Blob/ArrayBufferを送るか？
- 必要なHTTPヘッダーは？
- Content-Typeの指定方法は？

### 4. セキュリティ
**質問：**
- 署名付きURLの有効期限設定（推奨値は？）
- パブリックアクセスの制御方法
- アップロードサイズの制限設定

### 5. エラーハンドリング
**質問：**
- アップロード失敗時の再試行戦略
- よくあるエラーとその対処法
- タイムアウト設定

### 6. パフォーマンス最適化
**質問：**
- 並列アップロード時の注意点
- 画像サイズ・形式の推奨設定（現在：横幅800px、JPEG 70%品質）
- リージョン選択の影響（現在：APAC）

---

## 具体的に知りたい実装イメージ

### Workers側
```javascript
// POST /get-presigned-url
// リクエスト: { fileName: "xxx.jpg", contentType: "image/jpeg" }
// レスポンス: { presignedUrl: "https://...", fileName: "xxx.jpg", expiresIn: 3600 }

// どうやって署名付きURLを生成するか？
```

### クライアント側
```javascript
// 1. 署名付きURLを取得
const response = await fetch('https://worker-url/get-presigned-url', {
  method: 'POST',
  body: JSON.stringify({ fileName: 'test.jpg', contentType: 'image/jpeg' })
});
const { presignedUrl } = await response.json();

// 2. R2に直接PUT（この部分の正しい実装は？）
await fetch(presignedUrl, {
  method: 'PUT',
  body: blob, // or FormData?
  headers: { ??? }
});
```

---

## 期待する調査結果

以下の形式で情報をまとめてください：

1. **実装可能かどうかの判定**
   - Cloudflare R2で署名付きURLによる直接アップロードは可能か？

2. **Workers側の完全なコード例**
   - 署名付きURL生成エンドポイント
   - 必要な環境変数・設定

3. **クライアント側の完全なコード例**
   - 署名付きURL取得
   - R2への直接PUT

4. **CORS設定の具体的な手順**
   - Cloudflare Dashboardでの設定方法
   - 必要なCORSヘッダー

5. **注意点・制約事項**
   - 既知の問題
   - パフォーマンス上の考慮事項

---

## 参考情報

- Cloudflare公式ドキュメント: https://developers.cloudflare.com/r2/
- 特に注目すべきセクション: Presigned URLs, CORS, Public Buckets
- AWS S3との互換性情報

---

## 補足

もし署名付きURLアプローチが**推奨されない**または**不可能**な場合、代替案も提示してください：
- Cloudflareが推奨するR2への最速アップロード方法
- Workers経由アップロードの最適化方法
- その他の高速化アプローチ
