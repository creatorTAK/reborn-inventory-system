/**
 * Cloudflare Pages Function - GAS API プロキシ
 *
 * CORS問題を解決するため、furira.jpドメインでGAS APIへのプロキシを提供
 * パス: /gas-proxy
 */

const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA/exec';

export async function onRequest(context) {
  const { request } = context;

  // CORSプリフライト対応
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Max-Age': '86400',
      }
    });
  }

  try {
    // リクエストURLからクエリパラメータを取得
    const url = new URL(request.url);
    const params = url.searchParams;

    // GAS APIにリクエストを転送
    const gasUrl = new URL(GAS_API_URL);
    params.forEach((value, key) => {
      gasUrl.searchParams.append(key, value);
    });

    const gasResponse = await fetch(gasUrl.toString(), {
      method: request.method,
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await gasResponse.text();

    // レスポンスにCORSヘッダーを付けて返す
    return new Response(data, {
      status: gasResponse.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      }
    });
  }
}
