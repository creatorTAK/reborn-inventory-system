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
 * Gemini APIのベースURL
 * @const {string}
 */
const GEMINI_API_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * モデル階層定義（フォールバック順）
 * 上位モデルで失敗した場合、下位モデルに自動フォールバック
 * @const {Array}
 */
const GEMINI_MODEL_TIERS = [
  {
    name: 'gemini-2.5-flash',
    tier: 'premium',
    isThinkingModel: true,    // 思考モデルはmaxTokens多めに必要
    minMaxTokens: 4096,
    description: '高品質（思考機能あり）'
  },
  {
    name: 'gemini-2.0-flash',
    tier: 'standard',
    isThinkingModel: false,
    minMaxTokens: 1024,
    description: '標準'
  },
  {
    name: 'gemini-1.5-flash',
    tier: 'lite',
    isThinkingModel: false,
    minMaxTokens: 1024,
    description: '軽量・安定版'
  }
];

/**
 * デフォルトで使用するモデル（配列の最初）
 * @const {string}
 */
const DEFAULT_MODEL = GEMINI_MODEL_TIERS[0].name;

// 後方互換性のためのエンドポイント定数（既存コードとの互換用）
const GEMINI_API_ENDPOINT = `${GEMINI_API_BASE_URL}/${DEFAULT_MODEL}:generateContent`;

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
 * 実際の商品説明生成をテスト（診断用）
 * GASエディタから直接実行して確認できます
 */
function testProductDescriptionDirect() {
  try {
    Logger.log('=== 商品説明生成テスト ===');

    // テスト用の商品情報
    const testProductInfo = {
      brandName: 'UNIQLO',
      brandKana: 'ユニクロ',
      itemName: 'Tシャツ',
      category: 'トップス',
      size: 'M',
      condition: '目立った傷や汚れなし',
      material: '綿100%',
      color: 'ホワイト'
    };

    Logger.log('商品情報: ' + JSON.stringify(testProductInfo));

    // 画像なしで生成
    const result = generateProductDescription(testProductInfo, []);

    Logger.log('✅ 生成成功！');
    Logger.log('生成テキスト: ' + result);

    return result;
  } catch (error) {
    Logger.log('❌ エラー: ' + error);
    return null;
  }
}

/**
 * Gemini APIの簡易テスト（診断用）
 * GASエディタから直接実行して確認できます
 */
function testGeminiApiDirect() {
  try {
    const apiKey = getGeminiApiKey();
    const model = 'gemini-2.5-flash';  // テスト対象モデル
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    Logger.log('=== Gemini API 直接テスト ===');
    Logger.log('モデル: ' + model);
    Logger.log('URL: ' + url.replace(apiKey, '***'));

    const requestBody = {
      contents: [{
        parts: [{ text: 'こんにちは。簡単なテストです。「テスト成功」と返してください。' }]
      }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 100
      }
    };

    Logger.log('リクエスト送信中...');

    const response = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    });

    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    Logger.log('ステータス: ' + statusCode);
    Logger.log('レスポンス: ' + responseText);

    if (statusCode === 200) {
      const data = JSON.parse(responseText);
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const text = data.candidates[0].content.parts[0].text;
        Logger.log('✅ 成功！生成テキスト: ' + text);
      } else {
        Logger.log('⚠️ レスポンスはあるがコンテンツなし');
        Logger.log('candidates: ' + JSON.stringify(data.candidates));
      }
    } else {
      Logger.log('❌ エラー: ' + statusCode);
    }

    return responseText;
  } catch (error) {
    Logger.log('❌ 例外: ' + error);
    return null;
  }
}

/**
 * 利用可能なGeminiモデル一覧を取得（診断用）
 * GASエディタから直接実行して確認できます
 */
function listAvailableGeminiModels() {
  try {
    const apiKey = getGeminiApiKey();
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    const statusCode = response.getResponseCode();
    const responseText = response.getContentText();

    if (statusCode !== 200) {
      Logger.log('❌ APIエラー: ' + statusCode);
      Logger.log(responseText);
      return;
    }

    const data = JSON.parse(responseText);
    const models = data.models || [];

    Logger.log('=== 利用可能なGeminiモデル ===');
    Logger.log('総数: ' + models.length);
    Logger.log('');

    // generateContentをサポートするモデルのみ抽出
    const generateContentModels = models.filter(m =>
      m.supportedGenerationMethods &&
      m.supportedGenerationMethods.includes('generateContent')
    );

    Logger.log('=== generateContent対応モデル ===');
    generateContentModels.forEach(m => {
      Logger.log('- ' + m.name.replace('models/', ''));
    });

    return generateContentModels.map(m => m.name.replace('models/', ''));
  } catch (error) {
    Logger.log('❌ エラー: ' + error);
    return null;
  }
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

  // デフォルトプロンプト（画像がある場合は画像中心に）
  let prompt = '';

  if (imageCount > 0) {
    prompt = `あなたはメルカリの出品説明文を作成する専門家です。

**添付された${imageCount}枚の商品画像を詳しく観察し**、画像から読み取れる具体的な情報をメインに、魅力的で購買意欲を高める商品説明文を作成してください。

テキスト情報は補足として参考にしてください。

【商品情報（参考）】`;
  } else {
    prompt = `あなたはメルカリの出品説明文を作成する専門家です。以下の商品情報から、魅力的で購買意欲を高める商品説明文を作成してください。

【商品情報】`;
  }

  // 含める要素のチェック
  if (config.includeBrand !== false && productInfo.brandName) {
    prompt += `
ブランド: ${productInfo.brandName}`;
    if (productInfo.brandKana) {
      prompt += `（${productInfo.brandKana}）`;
    }
    if (DEBUG_MODE) Logger.log('[Gemini API] ✅ ブランド情報を追加');
  } else if (DEBUG_MODE) {
    Logger.log('[Gemini API] ❌ ブランド情報スキップ - includeBrand: ' + config.includeBrand + ', brandName: ' + productInfo.brandName);
  }

  if (config.includeCategory !== false && productInfo.category) {
    prompt += `
カテゴリ: ${productInfo.category}`;
    if (DEBUG_MODE) Logger.log('[Gemini API] ✅ カテゴリ情報を追加');
  } else if (DEBUG_MODE) {
    Logger.log('[Gemini API] ❌ カテゴリ情報スキップ - includeCategory: ' + config.includeCategory + ', category: ' + productInfo.category);
  }

  prompt += `
アイテム: ${productInfo.itemName}`;

  if (config.includeSize !== false && productInfo.size) {
    prompt += `
サイズ: ${productInfo.size}`;
    if (DEBUG_MODE) Logger.log('[Gemini API] ✅ サイズ情報を追加');
  } else if (DEBUG_MODE) {
    Logger.log('[Gemini API] ❌ サイズ情報スキップ - includeSize: ' + config.includeSize + ', size: ' + productInfo.size);
  }

  if (config.includeCondition !== false && productInfo.condition) {
    prompt += `
状態: ${productInfo.condition}`;
    if (DEBUG_MODE) Logger.log('[Gemini API] ✅ 商品状態を追加');
  } else if (DEBUG_MODE) {
    Logger.log('[Gemini API] ❌ 商品状態スキップ - includeCondition: ' + config.includeCondition + ', condition: ' + productInfo.condition);
  }

  if (config.includeMaterial !== false && productInfo.material) {
    prompt += `
素材: ${productInfo.material}`;
    if (DEBUG_MODE) Logger.log('[Gemini API] ✅ 素材情報を追加');
  } else if (DEBUG_MODE) {
    Logger.log('[Gemini API] ❌ 素材情報スキップ - includeMaterial: ' + config.includeMaterial + ', material: ' + productInfo.material);
  }

  if (config.includeColor !== false && productInfo.color) {
    prompt += `
カラー: ${productInfo.color}`;
    if (DEBUG_MODE) {
      Logger.log('[Gemini API] ✅ カラー情報を追加: ' + productInfo.color);
    }
  } else if (DEBUG_MODE) {
    Logger.log('[Gemini API] カラー情報スキップ - includeColor: ' + config.includeColor + ', color: ' + productInfo.color);
  }

  if (config.includeAttributes !== false && productInfo.attributes) {
    prompt += `
商品属性: ${productInfo.attributes}`;
    if (DEBUG_MODE) {
      Logger.log('[Gemini API] ✅ 商品属性を追加: ' + productInfo.attributes);
    }
  } else if (DEBUG_MODE) {
    Logger.log('[Gemini API] 商品属性スキップ - includeAttributes: ' + config.includeAttributes + ', attributes: ' + productInfo.attributes);
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

  // 画像がある場合の指示（画像最優先）
  if (imageCount > 0) {
    prompt += `

【重要: 画像解析を最優先してください】
${imageCount}枚の商品画像が添付されています。

**必ず画像を詳細に観察し、以下の情報を具体的に説明文に含めてください**：

1. **色・柄・プリント**
   - 正確な色名（例: ネイビー、オフホワイト、ベージュ等）
   - 柄の種類（無地、ボーダー、チェック、花柄、プリント等）
   - 柄のサイズや配置

2. **素材感・質感**
   - 見た目から推測される素材（コットン、デニム、ニット、レザー等）
   - 生地の厚み（薄手、中厚、厚手）
   - 表面の質感（光沢、マット、起毛等）

3. **デザイン・ディテール**
   - シルエット（タイト、レギュラー、オーバーサイズ等）
   - 襟の形（ラウンドネック、Vネック、ポロカラー等）
   - ポケットの有無・位置・デザイン
   - ボタン・ファスナーの種類
   - 装飾（刺繍、ワッペン、リブ等）

4. **状態・コンディション**
   - 使用感の有無
   - 汚れ・シミ・ダメージの有無と位置
   - 全体的な綺麗さ

5. **雰囲気・スタイル**
   - カジュアル/フォーマル/ストリート等のテイスト
   - どんなコーディネートに合うか
   - どんなシーンで着られるか

6. **ロゴ・文字・タグ（重要）**
   - ブランドロゴに書かれている文字を正確に読み取る
   - モデル名やシリーズ名（ロゴやタグから読み取れる場合）
   - 品番・型番（タグに記載されている場合）
   - プリントされた文字やグラフィック
   - 内側のタグに書かれている情報

**画像から読み取れる情報を具体的に、詳しく書いてください。特にロゴや文字は正確に読み取り、商品名の特定に活用してください。曖昧な表現は避けてください。**`;
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
    if (DEBUG_MODE) Logger.log('[Gemini API] ✅ コーディネート提案を追加');
  } else if (DEBUG_MODE) {
    Logger.log('[Gemini API] ❌ コーディネート提案スキップ - includeCoordinate: ' + config.includeCoordinate);
  }

  if (config.includeScene !== false) {
    prompt += `
   - 着用シーンの提案`;
    if (DEBUG_MODE) Logger.log('[Gemini API] ✅ 着用シーンを追加');
  } else if (DEBUG_MODE) {
    Logger.log('[Gemini API] ❌ 着用シーンスキップ - includeScene: ' + config.includeScene);
  }

  prompt += `
5. 自然で読みやすい文章
6. 購入者の視点に立った魅力的な表現
7. 過度な誇張表現は避ける

説明文のみを出力してください。余計な前置きや注釈は不要です。`;

  // デバッグ: プロンプト全体を出力
  if (DEBUG_MODE) {
    Logger.log('[Gemini API] 生成したプロンプト:');
    Logger.log('='.repeat(80));
    Logger.log(prompt);
    Logger.log('='.repeat(80));
  }

  return prompt;
}

// =============================================================================
// API呼び出し（フォールバック対応）
// =============================================================================

/**
 * モデル情報を取得
 * @param {string} modelName - モデル名
 * @returns {Object} モデル設定オブジェクト
 */
function getModelConfig(modelName) {
  return GEMINI_MODEL_TIERS.find(m => m.name === modelName) || GEMINI_MODEL_TIERS[0];
}

/**
 * フォールバック対象のエラーかどうかを判定
 * @param {number} statusCode - HTTPステータスコード
 * @param {string} errorMessage - エラーメッセージ
 * @param {string} finishReason - 生成終了理由
 * @returns {boolean} フォールバックすべきかどうか
 */
function shouldFallback(statusCode, errorMessage, finishReason) {
  // 429: レート制限 → フォールバック
  if (statusCode === 429) return true;

  // 503: サービス利用不可 → フォールバック
  if (statusCode === 503) return true;

  // 500: サーバーエラー → フォールバック
  if (statusCode === 500) return true;

  // MAX_TOKENS: トークン上限到達（思考モデルで発生しやすい）→ フォールバック
  if (finishReason === 'MAX_TOKENS') return true;

  // 空レスポンス → フォールバック
  if (errorMessage && errorMessage.includes('空です')) return true;

  return false;
}

/**
 * Gemini APIを呼び出し（フォールバック付き）
 * 上位モデルで失敗した場合、自動的に下位モデルにフォールバック
 *
 * @param {string} prompt - 生成用プロンプト
 * @param {Object} [aiConfig] - AI生成設定
 * @param {Object} [productInfo] - 商品情報
 * @param {Array} [images] - 画像データ配列
 * @returns {string} 生成されたテキスト
 * @throws {Error} 全モデルで失敗した場合
 */
function callGeminiApiWithFallback(prompt, aiConfig, productInfo, images) {
  let lastError = null;

  for (let i = 0; i < GEMINI_MODEL_TIERS.length; i++) {
    const modelConfig = GEMINI_MODEL_TIERS[i];
    const modelName = modelConfig.name;

    try {
      Logger.log(`[Gemini API] 🔄 モデル試行 ${i + 1}/${GEMINI_MODEL_TIERS.length}: ${modelName} (${modelConfig.description})`);

      const result = callGeminiApiWithModel(prompt, aiConfig, productInfo, images, modelName);

      Logger.log(`[Gemini API] ✅ ${modelName} で生成成功`);
      return result;

    } catch (error) {
      lastError = error;
      Logger.log(`[Gemini API] ⚠️ ${modelName} でエラー: ${error.message}`);

      // フォールバック対象エラーかチェック
      const errorMsg = error.message || '';
      const is429 = errorMsg.includes('429');
      const is5xx = errorMsg.includes('500') || errorMsg.includes('503');
      const isMaxTokens = errorMsg.includes('MAX_TOKENS');
      const isEmpty = errorMsg.includes('空です');

      if (is429 || is5xx || isMaxTokens || isEmpty) {
        if (i < GEMINI_MODEL_TIERS.length - 1) {
          Logger.log(`[Gemini API] 🔄 フォールバック: ${modelName} → ${GEMINI_MODEL_TIERS[i + 1].name}`);
          continue;  // 次のモデルを試す
        }
      }

      // フォールバック対象外のエラー、または最後のモデル
      throw error;
    }
  }

  // 全モデルで失敗
  throw lastError || new Error('NG(API): 全てのモデルで生成に失敗しました。');
}

/**
 * 指定モデルでGemini APIを呼び出してテキストを生成
 *
 * @param {string} prompt - 生成用プロンプト
 * @param {Object} [aiConfig] - AI生成設定
 * @param {Object} [productInfo] - 商品情報（Google Search Grounding判定用）
 * @param {Array} [images] - 画像データ配列
 * @param {string} [modelName] - 使用するモデル名
 * @returns {string} 生成されたテキスト
 * @throws {Error} API呼び出しに失敗した場合
 */
function callGeminiApiWithModel(prompt, aiConfig, productInfo, images, modelName) {
  try {
    const apiKey = getGeminiApiKey();
    const model = modelName || DEFAULT_MODEL;
    const modelConfig = getModelConfig(model);
    const url = `${GEMINI_API_BASE_URL}/${model}:generateContent?key=${apiKey}`;

    // AI設定のデフォルト値
    const config = aiConfig || {};
    const temperature = config.temperature !== undefined ? config.temperature : 0.7;
    // 思考モデルは多めのトークンが必要
    const minTokens = modelConfig.isThinkingModel ? modelConfig.minMaxTokens : 1024;
    const maxTokens = Math.max(config.maxTokens || 1024, minTokens);

    // 画像データの検証
    images = images || [];

    if (DEBUG_MODE) {
      Logger.log(`[Gemini API] 画像数: ${images.length}`);
      if (images.length > 0) {
        Logger.log('[Gemini API] ✅ 画像あり - Vision機能を使用します');
      } else {
        Logger.log('[Gemini API] 画像なし - テキストのみで生成します');
      }
    }

    // partsの構築（テキスト + 画像）
    const parts = [{ text: prompt }];

    // 画像がある場合は追加
    if (images.length > 0) {
      images.forEach((image, index) => {
        // Base64データの最初の50文字のみログに出力（データ量が多いため）
        const dataPreview = image.data.substring(0, 50) + '...';

        parts.push({
          inline_data: {
            mime_type: image.mimeType,
            data: image.data
          }
        });

        if (DEBUG_MODE) {
          Logger.log(`[Gemini API] 📷 画像 ${index + 1}/${images.length}:`, image.mimeType);
          Logger.log(`[Gemini API]   データサイズ: ${image.data.length} 文字`);
          Logger.log(`[Gemini API]   データプレビュー: ${dataPreview}`);
        }
      });

      if (DEBUG_MODE) {
        Logger.log(`[Gemini API] ✅ ${images.length}枚の画像をリクエストに含めました`);
      }
    }

    // thinkingConfig: 画像なしの場合はthinkingBudget: 0で思考機能を無効化
    // gemini-2.5-flashは思考モデルのため、テキストのみの場合は負荷が高くなる
    // 画像ありの場合は思考機能を活用して詳細な分析を行う
    const hasImages = images.length > 0;
    const thinkingConfig = hasImages
      ? { thinkingBudget: 1024 }   // 画像あり: 思考機能有効
      : { thinkingBudget: 0 };     // 画像なし: 思考機能無効（503エラー対策）

    if (DEBUG_MODE) {
      Logger.log(`[Gemini API] thinkingConfig: ${JSON.stringify(thinkingConfig)} (画像: ${hasImages ? 'あり' : 'なし'})`);
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
        topK: 40,
        thinkingConfig: thinkingConfig
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
    let useGoogleSearch = false;
    if (productInfo && productInfo.modelNumber && productInfo.modelNumber.trim()) {
      requestBody.tools = [{
        googleSearch: {}
      }];
      useGoogleSearch = true;

      if (DEBUG_MODE) {
        Logger.log('[Gemini API] ✅ Google Search Grounding有効 - 品番: ' + productInfo.modelNumber);
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
      Logger.log('[Gemini API] モデル: ' + model);
      Logger.log('[Gemini API] maxOutputTokens: ' + maxTokens);
      Logger.log('[Gemini API] 画像数: ' + images.length);
      Logger.log('[Gemini API] リクエスト送信: ' + url.replace(/key=.*/, 'key=***'));
    }

    // API呼び出し（503エラー時は最大3回リトライ）
    let response;
    let statusCode;
    let responseText;
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 2000;  // 2秒待機

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      response = UrlFetchApp.fetch(url, options);
      statusCode = response.getResponseCode();
      responseText = response.getContentText();

      // 503以外、または成功の場合はループを抜ける
      if (statusCode !== 503) {
        break;
      }

      // 503エラーの場合、リトライ
      if (attempt < MAX_RETRIES) {
        Logger.log(`[Gemini API] ⚠️ 503エラー (試行 ${attempt}/${MAX_RETRIES}) - ${RETRY_DELAY_MS/1000}秒後にリトライします...`);
        Utilities.sleep(RETRY_DELAY_MS);
      } else {
        Logger.log(`[Gemini API] ❌ 503エラー - 全 ${MAX_RETRIES} 回の試行が失敗しました`);
      }
    }

    Logger.log('[Gemini API] ステータスコード: ' + statusCode);
    Logger.log('[Gemini API] レスポンス長: ' + responseText.length + '文字');

    // レスポンスの最初の500文字を表示（デバッグ用）
    if (responseText.length > 0) {
      Logger.log('[Gemini API] レスポンス内容: ' + responseText.substring(0, 500));
    } else {
      Logger.log('[Gemini API] ⚠️ レスポンスが空です');
    }

    // ステータスコードのチェック
    if (statusCode !== 200) {
      const errorData = JSON.parse(responseText);
      const errorMessage = errorData.error?.message || 'Unknown error';
      const errorCode = errorData.error?.code || 'Unknown code';
      const errorStatus = errorData.error?.status || 'Unknown status';
      const errorDetails = errorData.error?.details ? JSON.stringify(errorData.error.details) : 'No details';

      // 詳細なエラーログ
      Logger.log('[Gemini API] ❌ エラー詳細:');
      Logger.log('  - ステータスコード: ' + statusCode);
      Logger.log('  - エラーコード: ' + errorCode);
      Logger.log('  - エラーステータス: ' + errorStatus);
      Logger.log('  - エラーメッセージ: ' + errorMessage);
      Logger.log('  - 詳細: ' + errorDetails);
      Logger.log('  - 画像数: ' + images.length);
      Logger.log('  - モデル: ' + model);
      Logger.log('  - プロンプト長: ' + prompt.length + '文字');

      // Google Search Grounding関連のエラーの場合は再試行
      if (useGoogleSearch && (errorMessage.includes('google_search') || errorMessage.includes('googleSearch') || errorMessage.includes('grounding'))) {
        Logger.log('[Gemini API] ⚠️ Google Search Groundingがサポートされていません。Google Searchなしで再試行します。');
        
        // Google Search Groundingを無効化して再試行
        delete requestBody.tools;
        
        const retryOptions = {
          method: 'post',
          contentType: 'application/json',
          payload: JSON.stringify(requestBody),
          muteHttpExceptions: true
        };
        
        const retryResponse = UrlFetchApp.fetch(url, retryOptions);
        const retryStatusCode = retryResponse.getResponseCode();
        const retryResponseText = retryResponse.getContentText();
        
        if (DEBUG_MODE) {
          Logger.log('[Gemini API] 再試行 ステータスコード: ' + retryStatusCode);
        }
        
        if (retryStatusCode !== 200) {
          const retryErrorData = JSON.parse(retryResponseText);
          throw new Error(`NG(API): Gemini API呼び出しエラー (${retryStatusCode}): ${retryErrorData.error?.message || 'Unknown error'}`);
        }
        
        // 再試行成功時は、このレスポンスを使用して処理を続行
        const retryResponseData = JSON.parse(retryResponseText);
        
        if (!retryResponseData.candidates || retryResponseData.candidates.length === 0) {
          throw new Error('NG(API): Gemini APIから結果が返されませんでした。');
        }
        
        const retryCandidate = retryResponseData.candidates[0];
        
        if (retryCandidate.finishReason === 'SAFETY') {
          throw new Error('NG(API): 安全性フィルタにより生成がブロックされました。プロンプトを見直してください。');
        }
        
        if (!retryCandidate.content || !retryCandidate.content.parts || retryCandidate.content.parts.length === 0) {
          throw new Error('NG(API): 生成されたテキストが空です。');
        }
        
        const retryGeneratedText = retryCandidate.content.parts[0].text;
        
        if (DEBUG_MODE) {
          Logger.log('[Gemini API] 生成されたテキスト（再試行）: ' + retryGeneratedText);
        }
        
        return retryGeneratedText.trim();
      }
      
      throw new Error(`NG(API): Gemini API呼び出しエラー (${statusCode}): ${errorMessage}`);
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
      Logger.log('[Gemini API] 生成されたテキスト:', generatedText);
    }

    return generatedText.trim();

  } catch (error) {
    if (error.message.startsWith('NG(')) {
      throw error;
    }
    throw new Error(`NG(API): Gemini API呼び出し中にエラーが発生しました: ${error.message}`);
  }
}

/**
 * Gemini APIを呼び出してテキストを生成（シンプル版）
 * gemini-2.5-flashのみ使用
 */
function callGeminiApi(prompt, aiConfig, productInfo, images) {
  return callGeminiApiWithModel(prompt, aiConfig, productInfo, images || [], 'gemini-2.5-flash');
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
      Logger.log(`[情報] ${images.length}枚の画像を使用してAI生成します`);
    }

    // AI生成設定を取得（Firestoreから - SaaS対応）
    let aiConfig = {};
    try {
      const firestoreConfig = loadConfigFromFirestore();
      if (firestoreConfig && firestoreConfig.aiSettings) {
        aiConfig = firestoreConfig.aiSettings;
        Logger.log('[Gemini API] ✅ FirestoreからAI設定を読み込み');
      } else {
        Logger.log('[Gemini API] ⚠️ FirestoreにAI設定なし。デフォルト設定を使用');
      }
    } catch (error) {
      Logger.log('[警告] AI生成設定の読み込みに失敗。デフォルト設定を使用します:', error);
      aiConfig = {};
    }

    // デバッグ: 商品情報を出力
    if (DEBUG_MODE) {
      Logger.log('[Gemini API] 収集した商品情報:', JSON.stringify(productInfo, null, 2));
      Logger.log('[Gemini API] AI設定:', JSON.stringify(aiConfig, null, 2));
      Logger.log('[Gemini API] 含める要素の設定:');
      Logger.log('  - includeBrand: ' + aiConfig.includeBrand + ' (デフォルト: true)');
      Logger.log('  - includeCategory: ' + aiConfig.includeCategory + ' (デフォルト: true)');
      Logger.log('  - includeSize: ' + aiConfig.includeSize + ' (デフォルト: true)');
      Logger.log('  - includeMaterial: ' + aiConfig.includeMaterial + ' (デフォルト: true)');
      Logger.log('  - includeColor: ' + aiConfig.includeColor + ' (デフォルト: true)');
      Logger.log('  - includeAttributes: ' + aiConfig.includeAttributes + ' (デフォルト: true)');
      Logger.log('  - includeCondition: ' + aiConfig.includeCondition + ' (デフォルト: true)');
      Logger.log('  - includeCoordinate: ' + aiConfig.includeCoordinate + ' (デフォルト: true)');
      Logger.log('  - includeScene: ' + aiConfig.includeScene + ' (デフォルト: true)');
    }

    // プロンプトの構築（画像の枚数を渡す）
    const prompt = buildDescriptionPrompt(productInfo, aiConfig, images.length);

    // API呼び出し（gemini-2.5-flashのみ使用）
    const generatedText = callGeminiApi(prompt, aiConfig, productInfo, images);

    // 文字数チェック（設定された範囲を使用）
    const minLength = getMinLengthFromConfig(aiConfig);
    const maxLength = getMaxLengthFromConfig(aiConfig);

    if (generatedText.length < minLength) {
      Logger.log(`[警告] 生成された説明文が短すぎます (${generatedText.length}文字)`);
    } else if (generatedText.length > maxLength) {
      Logger.log(`[警告] 生成された説明文が長すぎます (${generatedText.length}文字)`);
    }

    return generatedText;

  } catch (error) {
    Logger.log('[エラー] 商品説明文の生成に失敗:', error);
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
    const response = callGeminiApi(testPrompt, null, null, []);

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
