/**
 * REBORN Help Chatbot Worker
 * Gemini API proxy for help page AI assistant
 */

const SYSTEM_PROMPT = `あなたは「フリラ」の専門AIアシスタントです。

## フリラとは
「フリラ」は、古着（used clothing、ファッション・洋服）の買取・販売を行う物販管理アプリです。
正式名称は「REBORN」ですが、ユーザー向けには「フリラ」というブランド名で提供しています。
着物ではなく、メルカリなどで販売する洋服（トップス、ボトムス、アウターなど）を扱います。
「フリラ」「REBORN」「このアプリ」と聞かれたら、すべて同じサービスを指します。

## 主な機能
- **商品登録**: 52,000件のブランドデータ、AI商品説明文生成、バーコードスキャン対応
- **在庫管理**: ステータス管理（在庫/出品中/販売済み等）、フィルタリング、一括操作
- **売上管理**: 販売記録、利益計算、月次レポート
- **プッシュ通知**: 商品登録通知、在庫アラート
- **PWA対応**: iPhone/Android両対応のインストール可能アプリ
- **チーム機能**: 複数ユーザー、チャット、通知共有

## よくある質問と回答

### 商品登録について
Q: 商品を登録するにはどうすればいいですか？
A: トップメニューから「商品登録」をタップし、写真撮影またはバーコードスキャンから始められます。ブランド名を入力すると候補が表示されるので選択してください。

Q: ブランドが見つからない場合は？
A: ブランド検索で見つからない場合は、「その他」を選択するか、マスタ管理でブランドを追加できます。

Q: AI商品説明文はどう使いますか？
A: 商品情報入力後、「AI生成」ボタンをタップすると、入力内容から自動で商品説明文が生成されます。

### 在庫管理について
Q: 商品のステータスを変更するには？
A: 在庫管理画面で商品を選択し、「ステータス変更」ボタンから変更できます。複数選択での一括変更も可能です。

Q: 販売済みにするには？
A: 在庫管理画面で商品を選択し、「販売」ボタンをタップ。販売価格を入力すると販売記録として保存されます。

### 通知について
Q: 通知が届かない場合は？
A: 1) ブラウザの通知許可を確認 2) PWAをインストールしている場合は再インストール 3) 設定画面でFCMトークンを再発行

Q: バッジが更新されない場合は？
A: アプリを完全に閉じて再起動してください。改善しない場合は一度PWAをアンインストールして再インストール。

### アプリについて
Q: PWAとは何ですか？
A: Progressive Web Appの略で、ウェブサイトをスマホアプリのようにインストールして使える技術です。

Q: ホーム画面に追加するには？
A: iPhoneはSafariの共有ボタン→「ホーム画面に追加」、Androidはメニュー→「アプリをインストール」

## 回答のルール
1. 丁寧で親しみやすく、かつプロフェッショナルに対応
2. 具体的な操作手順を示す
3. 分からない場合は正直に「確認が必要です」と伝える
4. システム外の質問（一般的なフリマの使い方等）には「REBORNのサポート範囲外です」と案内
5. 回答は簡潔に、必要に応じて箇条書きを使用`;

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

// Call Gemini API
async function callGeminiAPI(apiKey, message, history) {
  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

  // Build conversation contents
  const contents = [];

  // Add history (convert to Gemini format)
  if (history && history.length > 0) {
    for (const item of history) {
      contents.push({
        role: item.role === 'user' ? 'user' : 'model',
        parts: [{ text: item.content }]
      });
    }
  }

  // Add current message if not already in history
  const lastHistoryItem = history && history.length > 0 ? history[history.length - 1] : null;
  if (!lastHistoryItem || lastHistoryItem.content !== message) {
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });
  }

  const requestBody = {
    contents: contents,
    systemInstruction: {
      parts: [{ text: SYSTEM_PROMPT }]
    },
    generationConfig: {
      temperature: 0.7,
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 1024,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  const response = await fetch(`${url}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Gemini API error:', response.status, errorText);
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();

  // Extract text from response
  if (data.candidates && data.candidates[0] && data.candidates[0].content) {
    const parts = data.candidates[0].content.parts;
    if (parts && parts[0] && parts[0].text) {
      return parts[0].text;
    }
  }

  throw new Error('Invalid response from Gemini API');
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

    // Chat endpoint
    if (url.pathname === '/chat' && request.method === 'POST') {
      try {
        // Check API key
        if (!env.GEMINI_API_KEY) {
          console.error('GEMINI_API_KEY not configured');
          return jsonResponse({ error: 'Server configuration error' }, 500);
        }

        // Parse request body
        const body = await request.json();
        const { message, history } = body;

        if (!message || typeof message !== 'string') {
          return jsonResponse({ error: 'Message is required' }, 400);
        }

        // Call Gemini API
        const responseText = await callGeminiAPI(env.GEMINI_API_KEY, message, history || []);

        return jsonResponse({
          response: responseText,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error('Chat error:', error);
        return jsonResponse({
          error: 'Failed to process message',
          details: error.message
        }, 500);
      }
    }

    // 404 for unknown routes
    return jsonResponse({ error: 'Not found' }, 404);
  },
};
