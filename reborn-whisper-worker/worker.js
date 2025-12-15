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

// Call OpenAI Whisper API
async function transcribeAudio(apiKey, audioBlob) {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.webm');
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
    throw new Error(`Whisper API error: ${response.status}`);
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

        let audioBlob;
        if (contentType.includes('multipart/form-data')) {
          // FormData形式
          const formData = await request.formData();
          audioBlob = formData.get('audio');
        } else {
          // Raw blob形式
          audioBlob = await request.blob();
        }

        if (!audioBlob || audioBlob.size === 0) {
          return jsonResponse({ error: 'Audio data is required' }, 400);
        }

        console.log('Received audio:', audioBlob.size, 'bytes, type:', audioBlob.type);

        // Call Whisper API
        const transcription = await transcribeAudio(env.OPENAI_API_KEY, audioBlob);

        return jsonResponse({
          text: transcription,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Transcription error:', error);
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
