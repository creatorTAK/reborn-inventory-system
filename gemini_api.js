/**
 * gemini_api.js
 *
 * Gemini API統合モジュール
 * 商品説明文の自動生成機能を提供
 *
 * @module gemini_api
 * @requires config.js
 * @requires error_handler.js
 */

// =============================================================================
// デバッグ設定
// =============================================================================

/**
 * デバッグモード（本番環境ではfalseに設定）
 * @const {boolean}
 */
const DEBUG_MODE = true;

// =============================================================================
// 定数定義
// =============================================================================

/**
 * Gemini APIのエンドポイントURL
 * @const {string}
 */
const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

/**
 * 生成する説明文の最大文字数
 * @const {number}
 */
const MAX_DESCRIPTION_LENGTH = 300;

/**
 * 生成する説明文の最小文字数
 * @const {number}
 */
const MIN_DESCRIPTION_LENGTH = 200;

/**
 * APIリクエストのタイムアウト時間（秒）
 * @const {number}
 */
const API_TIMEOUT_SECONDS = 30;

// =============================================================================
// APIキー管理
// =============================================================================

/**
 * Script PropertiesからGemini APIキーを取得
 *
 * @returns {string} APIキー
 * @throws {Error} APIキーが設定されていない場合
 */
function getGeminiApiKey() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    throw new Error('NG(CONFIG): Gemini APIキーが設定されていません。Script Propertiesに「GEMINI_API_KEY」を設定してください。');
  }

  return apiKey;
}

/**
 * APIキーが設定されているかチェック
 *
 * @returns {boolean} 設定されている場合true
 */
function hasGeminiApiKey() {
  try {
    const apiKey = getGeminiApiKey();
    return apiKey && apiKey.length > 0;
  } catch (error) {
    return false;
  }
}

// =============================================================================
// プロンプト生成
// =============================================================================

/**
 * 商品情報から説明文生成用のプロンプトを構築
 *
 * @param {Object} productInfo - 商品情報オブジェクト
 * @param {string} productInfo.brandName - ブランド名（英語）
 * @param {string} [productInfo.brandKana] - ブランド名（カナ）
 * @param {string} productInfo.itemName - アイテム名
 * @param {string} [productInfo.category] - カテゴリ
 * @param {string} [productInfo.size] - サイズ
 * @param {string} [productInfo.condition] - 商品の状態
 * @param {string} [productInfo.material] - 素材
 * @param {string} [productInfo.color] - カラー
 * @returns {string} 構築されたプロンプト
 */
function buildDescriptionPrompt(productInfo) {
  // 必須項目のバリデーション
  if (!productInfo.brandName || !productInfo.itemName) {
    throw new Error('NG(VALIDATION): ブランド名とアイテム名は必須です。');
  }

  // プロンプトのベース部分
  let prompt = `あなたはメルカリの出品説明文を作成する専門家です。以下の商品情報から、魅力的で購買意欲を高める商品説明文を作成してください。

【商品情報】
ブランド: ${productInfo.brandName}`;

  // オプション情報を追加
  if (productInfo.brandKana) {
    prompt += `（${productInfo.brandKana}）`;
  }

  prompt += `
アイテム: ${productInfo.itemName}`;

  if (productInfo.category) {
    prompt += `
カテゴリ: ${productInfo.category}`;
  }

  if (productInfo.size) {
    prompt += `
サイズ: ${productInfo.size}`;
  }

  if (productInfo.condition) {
    prompt += `
状態: ${productInfo.condition}`;
  }

  if (productInfo.material) {
    prompt += `
素材: ${productInfo.material}`;
  }

  if (productInfo.color) {
    prompt += `
カラー: ${productInfo.color}`;
  }

  // 指示部分
  prompt += `

【作成条件】
1. 文字数: ${MIN_DESCRIPTION_LENGTH}〜${MAX_DESCRIPTION_LENGTH}文字
2. 以下の要素を含めること：
   - 商品の特徴やアピールポイント
   - おすすめのコーディネート提案
   - 着用シーンの提案
3. 自然で読みやすい文章
4. 購入者の視点に立った魅力的な表現
5. 過度な誇張表現は避ける

説明文のみを出力してください。余計な前置きや注釈は不要です。`;

  return prompt;
}

// =============================================================================
// API呼び出し
// =============================================================================

/**
 * Gemini APIを呼び出してテキストを生成
 *
 * @param {string} prompt - 生成用プロンプト
 * @returns {string} 生成されたテキスト
 * @throws {Error} API呼び出しに失敗した場合
 */
function callGeminiApi(prompt) {
  try {
    const apiKey = getGeminiApiKey();
    const url = `${GEMINI_API_ENDPOINT}?key=${apiKey}`;

    // リクエストボディの構築
    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1024,
        topP: 0.8,
        topK: 40
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE'
        }
      ]
    };

    // HTTPリクエストオプション
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    if (DEBUG_MODE) {
      console.log('[Gemini API] リクエスト送信:', url);
      console.log('[Gemini API] プロンプト:', prompt);
    }

    // API呼び出し
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (DEBUG_MODE) {
      console.log('[Gemini API] ステータスコード:', statusCode);
      console.log('[Gemini API] レスポンス:', responseText);
    }

    // ステータスコードのチェック
    if (statusCode !== 200) {
      const errorData = JSON.parse(responseText);
      throw new Error(`NG(API): Gemini API呼び出しエラー (${statusCode}): ${errorData.error?.message || 'Unknown error'}`);
    }

    // レスポンスのパース
    const responseData = JSON.parse(responseText);

    // 生成されたテキストの抽出
    if (!responseData.candidates || responseData.candidates.length === 0) {
      throw new Error('NG(API): Gemini APIから結果が返されませんでした。');
    }

    const candidate = responseData.candidates[0];

    // 安全性フィルタのチェック
    if (candidate.finishReason === 'SAFETY') {
      throw new Error('NG(API): 安全性フィルタにより生成がブロックされました。プロンプトを見直してください。');
    }

    if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
      throw new Error('NG(API): 生成されたテキストが空です。');
    }

    const generatedText = candidate.content.parts[0].text;

    if (DEBUG_MODE) {
      console.log('[Gemini API] 生成されたテキスト:', generatedText);
    }

    return generatedText.trim();

  } catch (error) {
    if (error.message.startsWith('NG(')) {
      throw error;
    }
    throw new Error(`NG(API): Gemini API呼び出し中にエラーが発生しました: ${error.message}`);
  }
}

// =============================================================================
// メイン関数
// =============================================================================

/**
 * 商品情報から説明文を自動生成
 *
 * @param {Object} productInfo - 商品情報オブジェクト（buildDescriptionPrompt参照）
 * @returns {string} 生成された商品説明文
 * @throws {Error} 生成に失敗した場合
 */
function generateProductDescription(productInfo) {
  try {
    // APIキーの存在チェック
    if (!hasGeminiApiKey()) {
      throw new Error('NG(CONFIG): Gemini APIキーが設定されていません。');
    }

    // プロンプトの構築
    const prompt = buildDescriptionPrompt(productInfo);

    // API呼び出し
    const generatedText = callGeminiApi(prompt);

    // 文字数チェック
    if (generatedText.length < MIN_DESCRIPTION_LENGTH) {
      console.warn(`[警告] 生成された説明文が短すぎます (${generatedText.length}文字)`);
    } else if (generatedText.length > MAX_DESCRIPTION_LENGTH) {
      console.warn(`[警告] 生成された説明文が長すぎます (${generatedText.length}文字)`);
    }

    return generatedText;

  } catch (error) {
    console.error('[エラー] 商品説明文の生成に失敗:', error);
    throw error;
  }
}

/**
 * テスト用関数：Gemini API接続テスト
 *
 * @returns {Object} テスト結果 {success: boolean, message: string}
 */
function testGeminiApiConnection() {
  try {
    // APIキーチェック
    if (!hasGeminiApiKey()) {
      return {
        success: false,
        message: 'APIキーが設定されていません。'
      };
    }

    // シンプルなテストプロンプト
    const testPrompt = 'こんにちは！と日本語で返答してください。';
    const response = callGeminiApi(testPrompt);

    return {
      success: true,
      message: `接続成功！レスポンス: ${response}`
    };

  } catch (error) {
    return {
      success: false,
      message: `接続失敗: ${error.message}`
    };
  }
}
