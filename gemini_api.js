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
// ヘルパー関数
// =============================================================================

/**
 * AI設定から最小文字数を取得
 *
 * @param {Object} aiConfig - AI生成設定
 * @returns {number} 最小文字数
 */
function getMinLengthFromConfig(aiConfig) {
  const lengthMap = {
    'short': 150,
    'medium': 200,
    'long': 300
  };
  return lengthMap[aiConfig.length] || MIN_DESCRIPTION_LENGTH;
}

/**
 * AI設定から最大文字数を取得
 *
 * @param {Object} aiConfig - AI生成設定
 * @returns {number} 最大文字数
 */
function getMaxLengthFromConfig(aiConfig) {
  const lengthMap = {
    'short': 200,
    'medium': 300,
    'long': 500
  };
  return lengthMap[aiConfig.length] || MAX_DESCRIPTION_LENGTH;
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
 * @param {Object} [aiConfig] - AI生成設定
 * @returns {string} 構築されたプロンプト
 */
function buildDescriptionPrompt(productInfo, aiConfig, imageCount) {
  // 必須項目のバリデーション
  if (!productInfo.brandName || !productInfo.itemName) {
    throw new Error('NG(VALIDATION): ブランド名とアイテム名は必須です。');
  }

  // 画像数のデフォルト
  imageCount = imageCount || 0;

  // AI設定のデフォルト値
  const config = aiConfig || {};
  const minLength = getMinLengthFromConfig(config);
  const maxLength = getMaxLengthFromConfig(config);

  // カスタムプロンプトテンプレートがある場合は使用
  if (config.promptTemplate && config.promptTemplate.trim()) {
    let customPrompt = config.promptTemplate;

    // 変数を置換
    customPrompt = customPrompt
      .replace(/\{brand\}/g, productInfo.brandName + (productInfo.brandKana ? `（${productInfo.brandKana}）` : ''))
      .replace(/\{item\}/g, productInfo.itemName || '')
      .replace(/\{category\}/g, productInfo.category || '')
      .replace(/\{size\}/g, productInfo.size || '')
      .replace(/\{condition\}/g, productInfo.condition || '')
      .replace(/\{material\}/g, productInfo.material || '')
      .replace(/\{color\}/g, productInfo.color || '')
      .replace(/\{attributes\}/g, productInfo.attributes || '')
      .replace(/\{modelNumber\}/g, productInfo.modelNumber || '')
      .replace(/\{length\}/g, `${minLength}-${maxLength}`);

    return customPrompt;
  }

  // デフォルトプロンプト
  let prompt = `あなたはメルカリの出品説明文を作成する専門家です。以下の商品情報から、魅力的で購買意欲を高める商品説明文を作成してください。

【商品情報】`;

  // 含める要素のチェック
  if (config.includeBrand !== false && productInfo.brandName) {
    prompt += `
ブランド: ${productInfo.brandName}`;
    if (productInfo.brandKana) {
      prompt += `（${productInfo.brandKana}）`;
    }
  }

  if (config.includeCategory !== false && productInfo.category) {
    prompt += `
カテゴリ: ${productInfo.category}`;
  }

  prompt += `
アイテム: ${productInfo.itemName}`;

  if (config.includeSize !== false && productInfo.size) {
    prompt += `
サイズ: ${productInfo.size}`;
  }

  if (config.includeCondition !== false && productInfo.condition) {
    prompt += `
状態: ${productInfo.condition}`;
  }

  if (config.includeMaterial !== false && productInfo.material) {
    prompt += `
素材: ${productInfo.material}`;
  }

  if (config.includeColor !== false && productInfo.color) {
    prompt += `
カラー: ${productInfo.color}`;
  }

  if (config.includeAttributes !== false && productInfo.attributes) {
    prompt += `
商品属性: ${productInfo.attributes}`;
  }

  // 品番・型番がある場合は強調
  if (productInfo.modelNumber) {
    prompt += `
品番・型番: ${productInfo.modelNumber}

※重要: この品番・型番でGoogle検索を行い、以下の情報を含めてください：
  - 発売年・シーズン
  - メーカー希望小売価格（定価）
  - 商品の公式説明・特徴
  - 人気度や評価（あれば）
  - 素材やディテールの詳細情報`;
  }

  // トーン/スタイルに応じた指示
  let toneInstruction = '';
  switch (config.tone) {
    case 'polite':
      toneInstruction = '丁寧で格調高い文体で書いてください。';
      break;
    case 'standard':
      toneInstruction = '丁寧で親しみやすい文体で書いてください。プロフェッショナルだが堅苦しくない表現を心がけてください。';
      break;
    case 'enthusiastic':
      toneInstruction = '熱量高めで、おすすめ感を強調してください。';
      break;
    case 'casual':
    default:
      toneInstruction = 'フレンドリーでカジュアルな文体で書いてください。';
      break;
  }

  // 見出しスタイルに応じた指示
  let headingInstruction = '';
  switch (config.headingStyle) {
    case 'emoji':
      headingInstruction = '見出しには絵文字を使ってください。例: ✨ 商品の特徴、👔 コーディネート提案、🎯 おすすめシーン';
      break;
    case 'brackets':
      headingInstruction = '見出しには【】を使ってください。例: 【商品の特徴】、【コーディネート提案】、【おすすめシーン】';
      break;
    case 'square':
      headingInstruction = '見出しには■を使ってください。例: ■ 商品の特徴、■ コーディネート提案、■ おすすめシーン';
      break;
    case 'none':
      headingInstruction = '見出しは使わず、改行のみで区切ってください。';
      break;
    default:
      headingInstruction = '見出しには【】を使ってください。例: 【商品の特徴】、【コーディネート提案】、【おすすめシーン】';
      break;
  }

  // 画像がある場合の指示
  if (imageCount > 0) {
    prompt += `

【画像情報】
${imageCount}枚の商品画像が添付されています。
画像を詳しく分析して、以下の情報を抽出し、説明文に反映してください：
- 商品の色・柄・デザインの詳細
- 素材感（見た目からわかる範囲で）
- シルエット・形状の特徴
- ディテール（ポケット、ボタン、装飾など）
- 着用イメージ・雰囲気
- 状態（汚れ、ダメージ、使用感など）
- その他、画像から読み取れる魅力的なポイント`;
  }

  // 指示部分
  prompt += `

【作成条件】
1. 文字数: ${minLength}〜${maxLength}文字
2. ${toneInstruction}
3. ${headingInstruction}
4. 以下の要素を含めること：
   - 商品の特徴やアピールポイント`;

  if (config.includeCoordinate !== false) {
    prompt += `
   - おすすめのコーディネート提案`;
  }

  if (config.includeScene !== false) {
    prompt += `
   - 着用シーンの提案`;
  }

  prompt += `
5. 自然で読みやすい文章
6. 購入者の視点に立った魅力的な表現
7. 過度な誇張表現は避ける

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
 * @param {Object} [aiConfig] - AI生成設定
 * @param {Object} [productInfo] - 商品情報（Google Search Grounding判定用）
 * @returns {string} 生成されたテキスト
 * @throws {Error} API呼び出しに失敗した場合
 */
function callGeminiApi(prompt, aiConfig, productInfo, images) {
  try {
    const apiKey = getGeminiApiKey();
    const url = `${GEMINI_API_ENDPOINT}?key=${apiKey}`;

    // AI設定のデフォルト値
    const config = aiConfig || {};
    const temperature = config.temperature !== undefined ? config.temperature : 0.7;
    const maxTokens = config.maxTokens || 1024;

    // 画像データの検証
    images = images || [];

    // partsの構築（テキスト + 画像）
    const parts = [{ text: prompt }];

    // 画像がある場合は追加
    if (images.length > 0) {
      images.forEach((image, index) => {
        parts.push({
          inline_data: {
            mime_type: image.mimeType,
            data: image.data
          }
        });

        if (DEBUG_MODE) {
          console.log(`[Gemini API] 画像 ${index + 1} を追加:`, image.mimeType);
        }
      });
    }

    // リクエストボディの構築
    const requestBody = {
      contents: [{
        parts: parts
      }],
      generationConfig: {
        temperature: temperature,
        maxOutputTokens: maxTokens,
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

    // 品番・型番がある場合はGoogle Search Groundingを有効化
    if (productInfo && productInfo.modelNumber && productInfo.modelNumber.trim()) {
      requestBody.tools = [{
        googleSearchRetrieval: {
          dynamicRetrievalConfig: {
            mode: "MODE_DYNAMIC",
            dynamicThreshold: 0.7
          }
        }
      }];

      if (DEBUG_MODE) {
        console.log('[Gemini API] Google Search Grounding有効 - 品番:', productInfo.modelNumber);
      }
    }

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
function generateProductDescription(productInfo, images) {
  try {
    // APIキーの存在チェック
    if (!hasGeminiApiKey()) {
      throw new Error('NG(CONFIG): Gemini APIキーが設定されていません。');
    }

    // 画像データの検証
    images = images || [];
    if (images.length > 0) {
      console.log(`[情報] ${images.length}枚の画像を使用してAI生成します`);
    }

    // AI生成設定を取得
    let aiConfig = {};
    try {
      const config = loadConfigMaster();
      aiConfig = config && config.AI生成設定 ? config.AI生成設定 : {};
    } catch (error) {
      console.warn('[警告] AI生成設定の読み込みに失敗。デフォルト設定を使用します:', error);
      aiConfig = {};
    }

    // プロンプトの構築（画像の枚数を渡す）
    const prompt = buildDescriptionPrompt(productInfo, aiConfig, images.length);

    // API呼び出し（品番がある場合はGoogle Search Groundingが有効化される）
    const generatedText = callGeminiApi(prompt, aiConfig, productInfo, images);

    // 文字数チェック（設定された範囲を使用）
    const minLength = getMinLengthFromConfig(aiConfig);
    const maxLength = getMaxLengthFromConfig(aiConfig);

    if (generatedText.length < minLength) {
      console.warn(`[警告] 生成された説明文が短すぎます (${generatedText.length}文字)`);
    } else if (generatedText.length > maxLength) {
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
    const response = callGeminiApi(testPrompt, null, null);

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
