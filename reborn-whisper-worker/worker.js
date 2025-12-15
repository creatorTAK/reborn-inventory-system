/**
 * REBORN Whisper Worker
 * OpenAI Whisper APIを使用した音声認識プロキシ
 * iOS Safari対応のため、クライアントで録音した音声をサーバー側で文字起こし
 */

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Helper function for JSON response
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

// Handle OPTIONS request (CORS preflight)
function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// MIMEタイプからファイル拡張子を取得
function getFileExtension(mimeType) {
  const mimeToExt = {
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/aac': 'm4a',
    'audio/x-m4a': 'm4a',
    'audio/m4a': 'm4a',
  };

  // MIMEタイプからコーデック部分を除去 (例: audio/webm;codecs=opus -> audio/webm)
  const baseMime = mimeType.split(';')[0].trim().toLowerCase();

  return mimeToExt[baseMime] || 'webm';
}

// Call OpenAI Whisper API
async function transcribeAudio(apiKey, audioBlob, mimeType) {
  const ext = getFileExtension(mimeType);
  const filename = `audio.${ext}`;

  console.log('Sending to Whisper:', filename, 'mimeType:', mimeType, 'size:', audioBlob.size);

  const formData = new FormData();
  formData.append('file', audioBlob, filename);
  formData.append('model', 'whisper-1');
  formData.append('language', 'ja');
  formData.append('response_format', 'json');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Whisper API error:', response.status, errorText);
    throw new Error(`Whisper API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.text;
}

// Main handler
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleOptions();
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
    }

    // Transcribe endpoint
    if (url.pathname === '/transcribe' && request.method === 'POST') {
      try {
        // Check API key
        if (!env.OPENAI_API_KEY) {
          console.error('OPENAI_API_KEY not configured');
          return jsonResponse({ error: 'Server configuration error' }, 500);
        }

        // Get audio data from request
        const contentType = request.headers.get('content-type') || '';
        console.log('Request content-type:', contentType);

        let audioBlob;
        let mimeType = 'audio/webm'; // デフォルト

        if (contentType.includes('multipart/form-data')) {
          // FormData形式
          const formData = await request.formData();
          audioBlob = formData.get('audio');
          if (audioBlob && audioBlob.type) {
            mimeType = audioBlob.type;
          }
        } else {
          // Raw blob形式
          audioBlob = await request.blob();
          mimeType = audioBlob.type || contentType;
        }

        if (!audioBlob || audioBlob.size === 0) {
          console.error('No audio data received');
          return jsonResponse({ error: 'Audio data is required' }, 400);
        }

        console.log('Received audio:', audioBlob.size, 'bytes, type:', mimeType);

        // 最小サイズチェック（100バイト未満は無効）
        if (audioBlob.size < 100) {
          console.error('Audio too small:', audioBlob.size);
          return jsonResponse({ error: 'Audio data too small' }, 400);
        }

        // Call Whisper API
        const transcription = await transcribeAudio(env.OPENAI_API_KEY, audioBlob, mimeType);

        console.log('Transcription result:', transcription);

        return jsonResponse({
          text: transcription,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Transcription error:', error.message);
        return jsonResponse({
          error: 'Failed to transcribe audio',
          details: error.message
        }, 500);
      }
    }

    // 404 for unknown routes
    return jsonResponse({ error: 'Not found' }, 404);
  },
};
