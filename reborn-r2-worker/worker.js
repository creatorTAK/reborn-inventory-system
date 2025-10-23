import { AwsClient } from 'aws4fetch';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS handling
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    // POST /get-presigned-url - Generate presigned URL
    if (request.method === 'POST' && url.pathname === '/get-presigned-url') {
      try {
        const { fileName, contentType } = await request.json();

        if (!fileName) {
          return jsonResponse({ error: 'fileName required' }, 400);
        }

        // Generate unique file name
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const key = `uploads/${timestamp}-${randomStr}-${fileName}`;

        // S3-compatible endpoint
        const bucket = 'reborn-test';
        const accountId = env.CF_ACCOUNT_ID;
        const s3Endpoint = `https://${bucket}.${accountId}.r2.cloudflarestorage.com`;
        const objectUrl = `${s3Endpoint}/${encodeURIComponent(key)}`;

        // Sign with AWS Signature V4
        const aws = new AwsClient({
          accessKeyId: env.R2_ACCESS_KEY_ID,
          secretAccessKey: env.R2_SECRET_ACCESS_KEY,
        });

        // Generate presigned URL (query parameter method)
        const presignedRequest = await aws.sign(
          new Request(objectUrl, {
            method: 'PUT',
            headers: contentType ? { 'Content-Type': contentType } : {},
          }),
          {
            aws: { signQuery: true },
          }
        );

        return jsonResponse({
          presignedUrl: presignedRequest.url,
          key: key,
          bucket: bucket,
        });

      } catch (error) {
        return jsonResponse({ error: error.message }, 500);
      }
    }

    // POST /upload - File upload (multipart/form-data)
    if (request.method === 'POST' && url.pathname === '/upload') {
      try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file) {
          return jsonResponse({ success: false, error: 'No file provided' }, 400);
        }

        // Generate unique file name
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(7);
        const originalName = file.name || 'image.jpg';
        const key = `${timestamp}-${randomStr}-${originalName}`;

        // Save to R2
        await env.MY_BUCKET.put(key, file.stream(), {
          httpMetadata: {
            contentType: file.type || 'image/jpeg'
          }
        });

        // Generate public URL via /image/ endpoint
        const workerUrl = new URL(request.url);
        const publicUrl = `${workerUrl.protocol}//${workerUrl.host}/image/${key}`;

        return jsonResponse({
          success: true,
          url: publicUrl,
          fileName: key
        });

      } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 500);
      }
    }

    // GET /image/{fileName} - Get image
    if (request.method === 'GET' && url.pathname.startsWith('/image/')) {
      const fileName = url.pathname.replace('/image/', '');
      const object = await env.MY_BUCKET.get(fileName);

      if (!object) {
        return new Response('Not found', { status: 404 });
      }

      return new Response(object.body, {
        headers: {
          'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
};

// Helper function
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  });
}
