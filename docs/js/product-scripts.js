function navigateInPWA(url) {
  try {
    // iframe内にいる場合、最上位ウィンドウにpostMessageで通知
    if (window.top && window.top !== window.self) {
      console.log('📤 postMessage送信 (to window.top):', url);
      window.top.postMessage({
        type: 'navigate',
        url: url
      }, '*'); // GASのサンドボックスiframeから送信するため、ワイルドカードを使用
    } else {
      // iframe外（通常のブラウザ）の場合
      window.location.href = url;
    }
  } catch (e) {
    console.error('❌ ナビゲーションエラー:', e);
    // フォールバック: 通常の遷移
    window.location.href = url;
  }
}

async function goBack() {
    console.log('[sidebar_product] >>> goBack() called at', new Date().toISOString());
    const isInIframe = window.self !== window.top;
    console.log('[sidebar_product] isInIframe:', isInIframe);
    
    if (isInIframe) {
          window.top.postMessage({ type: 'navigateToHome' }, '*');
        } else {
          google.script.host.close();
    }
  }
  
  document.addEventListener('DOMContentLoaded', () => {
      const backButton = document.getElementById('back-button');
    console.log('[sidebar_product] backButton element:', backButton);
    
    if (backButton) {
      backButton.addEventListener('click', goBack);
        } else {
      console.error('[sidebar_product] ❌ 戻るボタンが見つかりません');
    }
  });

console.log('[product.html] ✅ Script loaded - Version @945-PWA-Brand-Preload');

  // ブランドキャッシュをグローバルに初期化
  window.brandsCache = null;
  window.brandsCacheTimestamp = null;

  /**
   * 親ウィンドウからデータを受信（Algolia移行版）
   * - 管理番号設定: GAS経由で受け取る（Firestore直接アクセスをスキップ）
   * - ブランド: Algoliaで検索（プリロード不要）
   */
  window.addEventListener('message', function(event) {
    // セキュリティ: 送信元を検証
    const allowedOrigins = [
      'https://reborn-inventory-system.pages.dev',
      'https://furira.jp',
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];

    if (!allowedOrigins.includes(event.origin)) {
      console.warn('⚠️ [postMessage] 許可されていないオリジンから受信:', event.origin);
      return;
    }

    // 管理番号設定を受信
    if (event.data && event.data.type === 'managementConfig') {
      const config = event.data.config;

      if (!config || typeof config !== 'object') {
        console.error('❌ [postMessage] 無効な管理番号設定:', config);
        return;
      }

      // localStorageに保存（Firestore形式と統一）
      localStorage.setItem('rebornConfig_managementNumber', JSON.stringify(config));
      localStorage.setItem('managementConfigTimestamp', Date.now().toString());

      console.log('✅ [postMessage] 管理番号設定受信完了: prefix="' + config.prefix + '", segments=' + (config.segments?.length || 0) + '件');
      console.log('📦 [postMessage] localStorage保存完了（rebornConfig_managementNumber形式）、次回セッションで高速表示');

      // 管理番号UI更新（既に初期化されている場合）
      if (typeof window.updateManagementNumberUI === 'function') {
        console.log('🎨 管理番号UI更新開始（postMessage経由）');
        window.updateManagementNumberUI();
      }
    }

    // ブランドデータを受信（互換性維持、Algolia移行後は不要になる）
    if (event.data && event.data.type === 'brands') {
      const brands = event.data.brands;

      if (!brands || !Array.isArray(brands)) {
        console.error('❌ [postMessage] 無効なブランドデータ:', brands);
        return;
      }

      // キャッシュに保存
      window.brandsCache = brands;
      window.brandsCacheTimestamp = Date.now();

      console.log('✅ [postMessage] ブランドデータ受信完了:', brands.length + '件');
    
      // ブランドサジェストを初期化（モジュールが読み込まれている場合）
      if (window.firestoreBrandModulesLoaded && typeof window.initBrandSuggestWithCache === 'function') {
        console.log('🎨 ブランドサジェスト初期化開始（postMessage経由）');
        window.initBrandSuggestWithCache();
      }
    }
  }, false);

console.log('👂 [postMessage] データ受信リスナー登録完了（管理番号設定 + ブランド）');

// ==================== デバッグ設定 ====================
  // 本番環境ではfalseに設定してログを無効化
  const DEBUG_MODE = true;

  // デバッグ用ログユーティリティ
  const debug = {
  log: (...args) => { if (DEBUG_MODE) console.log(...args); },
  warn: (...args) => { if (DEBUG_MODE) console.warn(...args); },
  error: (...args) => { console.error(...args); }, // エラーは常に表示
  info: (...args) => { if (DEBUG_MODE) console.info(...args); }
};

// ==================== 定数定義 ====================
const NAME_LIMIT = 40;
  const NAME_LIMIT_MODE = 'warn';
  const DESC_LIMIT = 1000;
  const DESC_LIMIT_MODE = 'warn';

  // 画像ストレージプロバイダー設定
  // 'gdrive': Googleドライブ（推奨: 個人・チーム利用）
  // 'r2': Cloudflare R2（将来: SaaS化時）
  const IMAGE_STORAGE_PROVIDER = 'gdrive';

// AI生成文を保存するグローバル変数
window.AI_GENERATED_TEXT = '';

// 設定マスタ全体をキャッシュ
window.CACHED_CONFIG = null;

// localStorageキー定義（設定システム用）
window.CONFIG_STORAGE_KEYS = {
    CONDITION_BUTTONS: 'rebornConfig_conditionButtons',
    HASHTAG: 'rebornConfig_hashtag',
    DISCOUNT: 'rebornConfig_discount',
    SHIPPING_DEFAULT: 'rebornConfig_shippingDefault',
    PROCURE_LISTING_DEFAULT: 'rebornConfig_procureListingDefault',
    MANAGEMENT_NUMBER: 'rebornConfig_managementNumber',
    SALESWORD: 'rebornConfig_salesword',
    AI_SETTINGS: 'rebornConfig_aiSettings',
    DESIGN_THEME: 'rebornTheme',
    IMAGE_SAVE: 'enableProductImageSave'
  };

  // ==================== テーマの即座適用（ちらつき防止） ====================
  // ページ読み込み直後にLocalStorageからテーマを復元
  (function() {
    try {
      const cachedTheme = localStorage.getItem('rebornTheme');
      if (cachedTheme && cachedTheme !== 'casual') {
        document.body.classList.add('theme-' + cachedTheme);
        console.log('🚀 LocalStorageからテーマを即座に適用:', cachedTheme);
      }
    } catch (e) {
      console.warn('LocalStorageアクセスエラー:', e);
    }
  })();

  // 🔐 postMessage送信（二重iframe対応：window.top.postMessage()は届く）
  // origin検証のみでOK（event.source比較不要、pmToken不要）

  // テーマをLocalStorageに保存
  function saveThemeToLocalStorage(theme) {
    try {
      localStorage.setItem('rebornTheme', theme);
      console.log('💾 テーマをLocalStorageに保存:', theme);
    } catch (e) {
      console.warn('LocalStorage保存エラー:', e);
    }
  }

  // 設定マスタ全体を読み込む（localStorage優先、サーバーでバックアップ同期）
  function loadAllConfig() {
    console.log('🚀 設定読み込み開始（ハイブリッド方式）');

    // 1. まずlocalStorageから即座に読み込み（高速表示）
    try {
      if (!window.CACHED_CONFIG) {
        window.CACHED_CONFIG = {};
      }

      const conditionButtons = localStorage.getItem('rebornConfig_conditionButtons');
      const hashtag = localStorage.getItem('rebornConfig_hashtag');
      const discount = localStorage.getItem('rebornConfig_discount');
      const shippingDefault = localStorage.getItem('rebornConfig_shippingDefault');
      const procureListingDefault = localStorage.getItem('rebornConfig_procureListingDefault');
      const managementNumber = localStorage.getItem('rebornConfig_managementNumber');
      const salesword = localStorage.getItem('rebornConfig_salesword');
      const aiSettings = localStorage.getItem('rebornConfig_aiSettings');

      if (conditionButtons) window.CACHED_CONFIG['商品状態ボタン'] = JSON.parse(conditionButtons);
      if (hashtag) window.CACHED_CONFIG['ハッシュタグ'] = JSON.parse(hashtag);
      if (discount) window.CACHED_CONFIG['割引情報'] = JSON.parse(discount);
      if (shippingDefault) window.CACHED_CONFIG['配送デフォルト'] = JSON.parse(shippingDefault);
      if (procureListingDefault) window.CACHED_CONFIG['仕入出品デフォルト'] = JSON.parse(procureListingDefault);
      if (managementNumber) window.CACHED_CONFIG['管理番号設定'] = JSON.parse(managementNumber);
      if (salesword) window.CACHED_CONFIG['よく使うセールスワード'] = JSON.parse(salesword);
      if (aiSettings) window.CACHED_CONFIG['AI生成設定'] = JSON.parse(aiSettings);

      console.log('✅ Step 1: localStorageから読み込み完了:', window.CACHED_CONFIG);
    } catch (e) {
      console.error('localStorage読み込みエラー:', e);
    }

    // PWA版：localStorageのみを使用（Firestore同期は将来実装予定）
    console.log('✅ PWA版: localStorage設定を使用（Firestore同期は未実装）');

    // デザインテーマを適用（localStorageから）
    try {
      const savedTheme = localStorage.getItem(window.CONFIG_STORAGE_KEYS.DESIGN_THEME);
      if (savedTheme && savedTheme !== 'casual') {
        const themeClass = 'theme-' + savedTheme;
        if (!document.body.classList.contains(themeClass)) {
          document.body.classList.add(themeClass);
          console.log('✅ デザインテーマを適用:', themeClass);
        }
      }
    } catch (e) {
      console.warn('デザインテーマ適用エラー:', e);
    }
  }

  // ==================== ローディングオーバーレイ ====================

/**
 * ローディングオーバーレイを初期化
 */
window.initLoadingOverlay = function() {
    // オーバーレイHTMLを動的に生成
    const overlayHTML = `
      <div id="loadingOverlay">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <div class="loading-title" id="loadingTitle">データを保存中...</div>
          <div class="loading-message" id="loadingMessage">しばらくお待ちください</div>
          <div class="loading-progress">
            <div class="loading-progress-bar" id="loadingProgressBar"></div>
          </div>
          <div class="loading-progress-text" id="loadingProgressText">0%</div>
        </div>
      </div>
    `;

    // bodyに追加
    document.body.insertAdjacentHTML('beforeend', overlayHTML);
    console.log('✅ ローディングオーバーレイを初期化しました');
  }

/**
 * ローディングオーバーレイを表示
 * @param {string} title - タイトルテキスト（デフォルト: "データを保存中..."）
 * @param {string} message - メッセージテキスト（デフォルト: "しばらくお待ちください"）
 */
window.showLoadingOverlay = function(title = 'データを保存中...', message = 'しばらくお待ちください') {
    const overlay = document.getElementById('loadingOverlay');
    const titleEl = document.getElementById('loadingTitle');
    const messageEl = document.getElementById('loadingMessage');

    if (overlay) {
      titleEl.textContent = title;
      messageEl.textContent = message;
      overlay.classList.add('active');
      updateLoadingProgress(0, '0%'); // プログレスバーを初期化
    }
  }

/**
 * ローディングオーバーレイを非表示
 */
window.hideLoadingOverlay = function() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  /**
   * ローディング進捗を更新
   * @param {number} percent - 進捗率（0-100）
   * @param {string} text - 進捗テキスト（例: "画像アップロード中 (2/3)"）
   */
window.updateLoadingProgress = function(percent, text) {
    const progressBar = document.getElementById('loadingProgressBar');
    const progressText = document.getElementById('loadingProgressText');
    const messageEl = document.getElementById('loadingMessage');

    if (progressBar) {
      progressBar.style.width = percent + '%';
    }
    if (progressText) {
      progressText.textContent = text;
    }
    if (messageEl && text !== `${Math.round(percent)}%`) {
      messageEl.textContent = text;
    }
  }


  // 配送デフォルト設定（設定マスタから読み込む）
  let SHIPPING_DEFAULTS = {
    '配送料の負担': '送料込み(出品者負担)',
    '配送の方法': 'ゆうゆうメルカリ便',
    '発送元の地域': '岡山県',
    '発送までの日数': '1~2日で発送'
  };

  // 設定マスタから配送デフォルトを読み込む
  function loadShippingDefaults() {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(config) {
          if (config) {
            SHIPPING_DEFAULTS = config;
            console.log('配送デフォルト設定を読み込みました:', config);
            // デフォルト値を適用
            applyShippingDefaults();
          }
        })
        .withFailureHandler(function(error) {
          console.error('配送デフォルト設定読み込みエラー:', error);
        })
        .getShippingDefaults();
    }
  }

  // 仕入・出品デフォルト設定（設定マスタから読み込む）
  let PROCURE_LISTING_DEFAULTS = {
    '仕入日_今日': false,
    'デフォルト仕入日': '',
    'デフォルト仕入先': '',
    '出品日_今日': false,
    'デフォルト出品日': '',
    'デフォルト出品先': ''
  };

  // 設定マスタから仕入・出品デフォルトを読み込む
  function loadProcureListingDefaults() {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(config) {
          if (config) {
            PROCURE_LISTING_DEFAULTS = config;
            console.log('仕入・出品デフォルト設定を読み込みました:', config);
            // デフォルト値を適用
            applyProcureListingDefaults();
          }
        })
        .withFailureHandler(function(error) {
          console.error('仕入・出品デフォルト設定読み込みエラー:', error);
        })
        .getProcureListingDefaults();
    }
  }

  // 担当者名を読み込む（PWA版：URLパラメータから取得）
  function loadOperatorName() {
    try {
      // URLパラメータからuserNameを取得
      const urlParams = new URLSearchParams(window.location.search);
      const userName = urlParams.get('userName') || '';

      if (userName) {
        const staffField = document.getElementById('担当者');
        if (staffField) {
          staffField.value = userName;
          console.log('✅ 担当者名を設定しました (PWA版):', userName);
        }
      } else {
        console.log('ℹ️ 担当者名がURLパラメータに含まれていません');
      }
    } catch (error) {
      console.error('❌ 担当者名読み込みエラー:', error);
    }
  }
  const REQUIRED = [];
  
  const FIELD_IDS = [
  '管理番号','担当者',
  'セールスワード(カテゴリ)','セールスワード',
  'ブランド(英語)','ブランド(カナ)',
  '商品名(タイトル)',
  '大分類(カテゴリ)','中分類(カテゴリ)','小分類(カテゴリ)','細分類(カテゴリ)','細分類2',
  'サイズ','商品の状態',
  'アイテム名',
  // '商品の説明', // リセット時にクリアしない（updateDescriptionFromDetailで更新）
  '商品状態詳細',
  'サイズ(表記)','サイズ(表記)_靴','その他のサイズ表記_靴','普段のサイズ_靴','フィット感_靴',
  '肩幅','身幅','袖丈','着丈','ウエスト','ヒップ','股上','股下',
  '仕入日','仕入先','仕入金額',
  '出品日','出品先','出品金額',
  '配送料の負担','配送の方法','発送元の地域','発送までの日数'
];

  let CAT_ROWS = [];
  let BRAND_EN = [];
  let BRAND_KANA = [];
  let MASTER_OPTIONS = {}; // マスターオプションを保存

  // ブランドペアデータ（英語名とカナ読みの正確な対応関係）
  let BRAND_PAIRS = [];

  // ブランドデータの高速検索用インデックスマップ（ペア用）
  let BRAND_INDEX_MAP = new Map();

  // セールスワードデータ保存用
  let SALESWORD_DATA = {
    categories: [],
    wordsByCategory: {},
    allWords: []
  };

  // セールスワード表示形式設定
  let SALESWORD_FORMAT = {
    globalPrefix: '【',
    globalSuffix: '】',
    wordOverrides: []
  };

  // デフォルトセールスワード設定
  let defaultSalesword = null;

  // 商品状態履歴保持用
  let CONDITION_HISTORY = [];

  // 商品の状態別のクイック挿入ボタン定義（設定マスタから読み込む）
  let CONDITION_BUTTONS = {};

  // 商品名ブロックの並び順（設定マスタから読み込む）
  let TITLE_BLOCK_ORDER = ['salesword', 'brand', 'item', 'attribute'];

  // 設定マスタから商品名ブロックの並び順を読み込む
  function loadTitleBlockOrder() {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(order) {
          if (order && Array.isArray(order)) {
            // 'item'が含まれていない古い設定の場合は、brandの後に挿入
            if (!order.includes('item')) {
              const brandIndex = order.indexOf('brand');
              if (brandIndex !== -1) {
                order.splice(brandIndex + 1, 0, 'item');
              } else {
                // brandもない場合はデフォルト順序を使用
                order = ['salesword', 'brand', 'item', 'attribute'];
              }
              console.log('商品名ブロック並び順に item を追加しました:', order);
              // 更新した並び順を保存
              saveTitleBlockOrder();
            }
            TITLE_BLOCK_ORDER = order;
            console.log('商品名ブロックの並び順を読み込みました:', order);
            applyTitleBlockOrder();
          }
        })
        .withFailureHandler(function(error) {
          console.error('商品名ブロック並び順読み込みエラー:', error);
        })
        .getTitleBlockOrder();
    }
  }

  // 設定マスタから商品状態ボタンを読み込む
  function loadConditionButtonsFromConfig() {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(buttons) {
          if (buttons) {
            CONDITION_BUTTONS = buttons;
            console.log('商品状態ボタン設定を読み込みました:', Object.keys(CONDITION_BUTTONS).length, '種類');
            // 既に商品の状態が選択されている場合はボタンを更新
            updateConditionButtons();
          }
        })
        .withFailureHandler(function(error) {
          console.error('商品状態ボタン設定読み込みエラー:', error);
        })
        .getConditionButtons();
    }
  }

  // 素材システム用のグローバル変数
  let materialCount = 1;
  let MATERIAL_LOCATIONS = [];
  let MATERIAL_TYPES = [];

  // カラーシステム用のグローバル変数
  let colorCount = 1;
  let COLOR_OPTIONS = [];

  // 素材マスタデータの取得と設定
  function initializeMaterialMasters() {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(opts) {
          MATERIAL_LOCATIONS = opts['素材(箇所)'] || [];
          MATERIAL_TYPES = opts['素材(種類)'] || [];

          populateMaterialSelects(1);

          console.log('素材マスタ取得完了 - 箇所:', MATERIAL_LOCATIONS.length, '種類:', MATERIAL_TYPES.length);
        })
        .withFailureHandler(function(error) {
          console.error('素材マスタ取得エラー:', error);
        })
        .getMasterOptions();
    }
  }

  // カラーマスタデータの取得と設定
  function initializeColorMasters() {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(opts) {
          COLOR_OPTIONS = opts['カラー/配色/トーン'] || [];

          populateColorSelect(1);

          console.log('カラーマスタ取得完了:', COLOR_OPTIONS.length);
        })
        .withFailureHandler(function(error) {
          console.error('カラーマスタ取得エラー:', error);
        })
        .getMasterOptions();
    }
  }

  // セレクトボックスにマスタデータを設定
  function populateMaterialSelects(index) {
    const locationSelect = document.getElementById(`素材${index}_箇所`);
    const type1Select = document.getElementById(`素材${index}_種類1`);
    const type2Select = document.getElementById(`素材${index}_種類2`);
    const percent1Select = document.getElementById(`素材${index}_％1`);
    const percent2Select = document.getElementById(`素材${index}_％2`);

    if (locationSelect) {
      locationSelect.innerHTML = '<option value="">--</option>';
      MATERIAL_LOCATIONS.forEach(loc => {
        locationSelect.insertAdjacentHTML('beforeend', `<option value="${loc}">${loc}</option>`);
      });
    }

    if (type1Select) {
      type1Select.innerHTML = '<option value="">--</option>';
      MATERIAL_TYPES.forEach(type => {
        type1Select.insertAdjacentHTML('beforeend', `<option value="${type}">${type}</option>`);
      });
    }

    if (type2Select) {
      type2Select.innerHTML = '<option value="">--</option>';
      MATERIAL_TYPES.forEach(type => {
        type2Select.insertAdjacentHTML('beforeend', `<option value="${type}">${type}</option>`);
      });
    }

    // 割合のプルダウンを0-100で初期化
    if (percent1Select) {
      percent1Select.innerHTML = '<option value="">--%</option>';
      for (let i = 0; i <= 100; i++) {
        percent1Select.insertAdjacentHTML('beforeend', `<option value="${i}">${i}%</option>`);
      }
    }

    if (percent2Select) {
      percent2Select.innerHTML = '<option value="">--%</option>';
      for (let i = 0; i <= 100; i++) {
        percent2Select.insertAdjacentHTML('beforeend', `<option value="${i}">${i}%</option>`);
      }
    }
  }

  // 素材セットを追加
  function addMaterial() {
    if (materialCount >= 10) {
      alert('素材は最大10個まで追加できます');
      return;
    }

    materialCount++;

    const materialList = document.getElementById('materialList');
    const newItem = document.createElement('div');
    newItem.className = 'material-item';
    newItem.setAttribute('data-index', materialCount);

    newItem.innerHTML = `
      <div class="material-header">
        <span>素材 ${materialCount}</span>
        <button type="button" class="remove-material-btn" onclick="removeMaterial(${materialCount})">削除</button>
      </div>
      
      <div class="material-fields">
        <label>箇所:
          <select id="素材${materialCount}_箇所" class="material-location">
            <option value="">--</option>
          </select>
        </label>
        
        <div class="material-composition">
          <div class="composition-row">
            <label>種類:
              <select id="素材${materialCount}_種類1" class="material-type">
                <option value="">--</option>
              </select>
            </label>
            <label>割合:
              <select id="素材${materialCount}_％1" class="material-percent">
                <option value="">--%</option>
              </select>
            </label>
          </div>

          <div class="composition-row">
            <label>種類:
              <select id="素材${materialCount}_種類2" class="material-type">
                <option value="">--</option>
              </select>
            </label>
            <label>割合:
              <select id="素材${materialCount}_％2" class="material-percent">
                <option value="">--%</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    `;

    materialList.appendChild(newItem);
    populateMaterialSelects(materialCount);
    updateRemoveButtons();
  }

  // 素材セットを削除
  function removeMaterial(index) {
    const item = document.querySelector(`.material-item[data-index="${index}"]`);
    if (item) {
      item.remove();

      const items = document.querySelectorAll('.material-item');
      materialCount = items.length;

      items.forEach((item, i) => {
        const newIndex = i + 1;
        item.setAttribute('data-index', newIndex);
        item.querySelector('.material-header span').textContent = `素材 ${newIndex}`;

        // onclickも更新
        const removeBtn = item.querySelector('.remove-material-btn');
        if (removeBtn) {
          removeBtn.onclick = () => removeMaterial(newIndex);
        }
      });

      updateRemoveButtons();
      updateDescriptionFromDetail(); // 素材情報更新
    }
  }

  // 削除ボタンの表示制御
  function updateRemoveButtons() {
    const items = document.querySelectorAll('.material-item');
    items.forEach(item => {
      const btn = item.querySelector('.remove-material-btn');
      if (btn) {
        btn.style.display = items.length > 1 ? 'block' : 'none';
      }
    });
  }

  // ========== カラー動的追加機能 ==========

  // カラーセレクトボックスにマスタデータを設定
  function populateColorSelect(index) {
    const colorSelect = document.getElementById(`カラー${index}`);

    if (colorSelect) {
      colorSelect.innerHTML = '<option value="">--</option>';
      COLOR_OPTIONS.forEach(color => {
        colorSelect.insertAdjacentHTML('beforeend', `<option value="${color}">${color}</option>`);
      });

      // 変更時にプレビューを更新
      colorSelect.addEventListener('change', updateDescriptionFromDetail);
    }
  }

  // カラーを追加
  function addColor() {
    if (colorCount >= 5) {
      alert('カラーは最大5個まで追加できます');
      return;
    }

    colorCount++;

    const colorList = document.getElementById('colorList');
    const newItem = document.createElement('div');
    newItem.className = 'color-item';
    newItem.setAttribute('data-index', colorCount);

    newItem.innerHTML = `
      <div class="color-header">
        <span>カラー ${colorCount}</span>
        <button type="button" class="remove-color-btn" onclick="removeColor(${colorCount})">削除</button>
      </div>

      <div class="color-fields">
        <label>色:
          <select id="カラー${colorCount}" class="color-select">
            <option value="">--</option>
          </select>
        </label>
      </div>
    `;

    colorList.appendChild(newItem);
    populateColorSelect(colorCount);
    updateColorRemoveButtons();
  }

  // カラーを削除
  function removeColor(index) {
    const item = document.querySelector(`.color-item[data-index="${index}"]`);
    if (item) {
      item.remove();

      const items = document.querySelectorAll('.color-item');
      colorCount = items.length;

      items.forEach((item, i) => {
        const newIndex = i + 1;
        item.setAttribute('data-index', newIndex);
        item.querySelector('.color-header span').textContent = `カラー ${newIndex}`;

        // onclickも更新
        const removeBtn = item.querySelector('.remove-color-btn');
        if (removeBtn) {
          removeBtn.onclick = () => removeColor(newIndex);
        }

        // selectのIDも更新
        const select = item.querySelector('.color-select');
        if (select) {
          const oldId = select.id;
          const oldValue = select.value;
          select.id = `カラー${newIndex}`;
          select.value = oldValue; // 選択値を保持
        }
      });

      updateColorRemoveButtons();
      updateDescriptionFromDetail(); // カラー情報更新
    }
  }

  // カラー削除ボタンの表示制御
  function updateColorRemoveButtons() {
    const items = document.querySelectorAll('.color-item');
    items.forEach(item => {
      const btn = item.querySelector('.remove-color-btn');
      if (btn) {
        btn.style.display = items.length > 1 ? 'block' : 'none';
      }
    });
  }

  // ========== 商品属性動的追加機能 ==========
  let attributeCount = 1;

  // カテゴリの選択肢を生成
  function getAttributeCategoryOptions() {
    const categories = [
      '生地・素材・質感系', '季節感・機能性', '着用シーン・イベント', '見た目・印象',
      'トレンド表現', 'サイズ感・体型カバー', '年代・テイスト・スタイル', 'カラー/配色/トーン',
      '柄・模様', 'ディテール・仕様', 'シルエット/ライン', 'ネックライン',
      '襟・衿', '袖・袖付け', '丈', '革/加工', '毛皮/加工', '生産国'
    ];
    let options = '<option value="">--選択してください--</option>';
    categories.forEach(cat => {
      options += `<option value="${cat}">${cat}</option>`;
    });
    return options;
  }

  // 商品属性のカテゴリプルダウンに選択肢を設定
  function populateAttributeCategory(index) {
    const categorySelect = document.getElementById(`商品属性${index}_カテゴリ`);
    if (categorySelect) {
      categorySelect.innerHTML = getAttributeCategoryOptions();
    }
  }

  // 商品属性セットを追加
  function addAttribute() {
    if (attributeCount >= 10) {
      alert('商品属性は最大10個まで追加できます');
      return;
    }

    attributeCount++;

    const attributeList = document.getElementById('attributeList');
    const newItem = document.createElement('div');
    newItem.className = 'attribute-item';
    newItem.setAttribute('data-index', attributeCount);

    newItem.innerHTML = `
      <div class="attribute-header">
        <span>属性 ${attributeCount}</span>
        <button type="button" class="remove-attribute-btn" onclick="removeProductAttribute(${attributeCount})">削除</button>
      </div>

      <div class="row" style="margin-top: 6px;">
        <div>
          <label>カテゴリ</label>
          <select id="商品属性${attributeCount}_カテゴリ">
            <option value="">--選択してください--</option>
          </select>
        </div>
        <div>
          <label>値</label>
          <select id="商品属性${attributeCount}_値" disabled>
            <option value="">--カテゴリを選択してください--</option>
          </select>
        </div>
      </div>
    `;

    attributeList.appendChild(newItem);
    populateAttributeCategory(attributeCount);
    setupAttributeSelector(attributeCount);
    updateAttributeRemoveButtons();
    updateAttributeFields();
  }

  // 商品属性セットを削除
  function removeProductAttribute(index) {
    const item = document.querySelector(`.attribute-item[data-index="${index}"]`);
    if (item) {
      item.remove();

      const items = document.querySelectorAll('.attribute-item');
      attributeCount = items.length;

      items.forEach((item, i) => {
        const newIndex = i + 1;
        item.setAttribute('data-index', newIndex);
        item.querySelector('.attribute-header span').textContent = `属性 ${newIndex}`;

        // onclickも更新
        const removeBtn = item.querySelector('.remove-attribute-btn');
        if (removeBtn) {
          removeBtn.onclick = () => removeProductAttribute(newIndex);
        }
      });

      updateAttributeRemoveButtons();
      updateAttributeFields();
      updateNamePreview();
    }
  }

  // 削除ボタンの表示制御
  function updateAttributeRemoveButtons() {
    const items = document.querySelectorAll('.attribute-item');
    items.forEach(item => {
      const btn = item.querySelector('.remove-attribute-btn');
      if (btn) {
        btn.style.display = (items.length > 1) ? 'block' : 'none';
      }
    });
  }

  // NAME_REST_FIELDS配列を更新（商品名プレビュー用）
  function updateAttributeFields() {
    const items = document.querySelectorAll('.attribute-item');
    NAME_REST_FIELDS.length = 0; // 配列をクリア
    items.forEach((item, i) => {
      NAME_REST_FIELDS.push(`商品属性${i + 1}_値`);
    });
  }

  // 単一の商品属性セレクターをセットアップ
  function setupAttributeSelector(index) {
    const categorySelect = document.getElementById(`商品属性${index}_カテゴリ`);
    const valueSelect = document.getElementById(`商品属性${index}_値`);

    if (categorySelect && valueSelect) {
      categorySelect.addEventListener('change', function() {
        updateAttributeValues(`商品属性${index}_カテゴリ`, `商品属性${index}_値`);
      });

      valueSelect.addEventListener('change', updateNamePreview);
    }
  }

  // 商品の状態に応じてボタンを表示切替
  function updateConditionButtons() {
    const conditionSelect = document.getElementById('商品の状態');
    const container = document.getElementById('quickInsertButtonsContainer');

    if (!conditionSelect || !container) {
      console.log('商品の状態またはボタンコンテナが見つかりません');
      return;
    }

    const conditionValue = conditionSelect.value;
    const buttons = CONDITION_BUTTONS[conditionValue] || [];

    // コンテナをクリア
    container.innerHTML = '';

    // ボタンが存在しない場合は非表示
    if (buttons.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = '';

    // ボタンを生成
    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quick-btn';
      button.textContent = btn.label;
      button.setAttribute('data-text', btn.text);

      // クリックイベント
      button.addEventListener('click', function() {
        const textarea = document.getElementById('商品状態詳細');
        if (!textarea) return;

        const text = this.getAttribute('data-text');

        // ボタンを押すと常に置き換え（上書き）
        textarea.value = text;

        // 商品の説明を更新
        if (typeof updateDescriptionFromDetail === 'function') {
          updateDescriptionFromDetail();
        }
      });

      container.appendChild(button);
    });

    console.log('クイック挿入ボタン表示更新:', buttons.length, '個');
  }

  // クイック挿入ボタンのイベントリスナー設定
  function setupQuickInsertButtons() {
    // 初期化時に商品の状態に応じてボタンを表示
    updateConditionButtons();
    console.log('クイック挿入ボタン初期化完了');
  }

  // 商品状態詳細オートコンプリート機能
  function attachConditionSuggest(inputId, list) {
    const input = document.getElementById(inputId);
    const panel = document.getElementById('suggest-' + inputId);

    if (!input || !panel) {
      console.log(`商品状態詳細オートコンプリート: 要素が見つかりません ${inputId}`);
      return;
    }

    let activeIndex = -1;
    const limit = 10;

    const render = (items) => {
      panel.innerHTML = '';
      if (!items.length) {
        panel.innerHTML = '<div class="sug-empty">候補なし</div>';
        panel.hidden = false;
        return;
      }

      items.slice(0, limit).forEach((v, i) => {
        const div = document.createElement('div');
        div.className = 'sug-item';
        div.textContent = v;

        div.addEventListener('mousemove', () => {
          Array.from(panel.querySelectorAll('.sug-item')).forEach(x => x.classList.remove('active'));
          div.classList.add('active');
          activeIndex = i;
        });

        div.addEventListener('mousedown', (e) => {
          e.preventDefault();
        });

        div.addEventListener('click', () => {
          input.value = v;
          hide();
          if (typeof updateDescriptionFromDetail === 'function') {
            updateDescriptionFromDetail();
          }
        });

        panel.appendChild(div);
      });

      panel.hidden = false;
    };

    const hide = () => {
      panel.hidden = true;
      activeIndex = -1;
    };

    const hideLater = () => setTimeout(hide, 100);

    const doFilter = () => {
      const q = (input.value || '').trim();

      if (!Array.isArray(list) || list.length === 0 || !q || q.length < 2) {
        hide();
        return;
      }

      // 部分一致検索（大文字小文字を区別しない）
      const qq = q.toLowerCase();
      const filtered = list.filter(v => {
        const s = String(v).toLowerCase();
        return s.indexOf(qq) !== -1;
      });

      console.log(`商品状態詳細候補: ${filtered.length}件`);
      render(filtered);
    };

    input.addEventListener('input', doFilter);
    input.addEventListener('focus', doFilter);
    input.addEventListener('blur', hideLater);

    input.addEventListener('keydown', (e) => {
      if (panel.hidden) return;
      const items = Array.from(panel.querySelectorAll('.sug-item'));
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        items.forEach(x => x.classList.remove('active'));
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach(x => x.classList.remove('active'));
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0) {
          e.preventDefault();
          input.value = items[activeIndex].textContent || '';
          hide();
          if (typeof updateDescriptionFromDetail === 'function') {
            updateDescriptionFromDetail();
          }
        }
      } else if (e.key === 'Escape') {
        hide();
      }
    });

    console.log('商品状態詳細オートコンプリート設定完了');
  }

  // ハッシュタグ設定（設定マスタから読み込む）
  let HASHTAG_CONFIG = {
    全商品プレフィックス: '#REBORN_',
    全商品テキスト: '全商品',
    ブランドプレフィックス: '#REBORN_',
    ブランドサフィックス: 'アイテム一覧',
    カテゴリプレフィックス: '#REBORN_',
    カテゴリサフィックス: '一覧'
  };

  // 設定マスタからハッシュタグ設定を読み込む
  function loadHashtagConfig() {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(config) {
          if (config) {
            HASHTAG_CONFIG = config;
            console.log('ハッシュタグ設定を読み込みました:', config);
            // ハッシュタグチェックボックスを生成
            renderHashtagCheckboxes();
            // 設定読み込み後、商品の説明を更新
            if (typeof updateDescriptionFromDetail === 'function') {
              updateDescriptionFromDetail();
            }
          }
        })
        .withFailureHandler(function(error) {
          console.error('ハッシュタグ設定読み込みエラー:', error);
        })
        .getHashtagConfig();
    }
  }

  /**
   * ハッシュタグチェックボックスを生成
   */
  function renderHashtagCheckboxes() {
    console.log('renderHashtagCheckboxes が呼び出されました');
    const container = document.getElementById('hashtagCheckboxContainer');
    if (!container) {
      console.error('hashtagCheckboxContainer が見つかりません');
      return;
    }

    container.innerHTML = '';

    console.log('HASHTAG_CONFIG:', HASHTAG_CONFIG);
    if (!HASHTAG_CONFIG || !HASHTAG_CONFIG.hashtags || HASHTAG_CONFIG.hashtags.length === 0) {
      console.warn('ハッシュタグ設定が空です');
      container.innerHTML = '<div style="font-size: 11px; color: #6b7280; text-align: center;">ハッシュタグ設定がありません</div>';
      return;
    }

    const hashtags = HASHTAG_CONFIG.hashtags;
    const commonPrefix = HASHTAG_CONFIG.commonPrefix || '#';

    hashtags.forEach((hashtag, index) => {
      const title = hashtag.title || '';
      const icon = hashtag.icon || '🏷️';
      const suffix = hashtag.suffix || '';

      // プレビューテキストを生成（実際の値は商品登録時に動的に変わる）
      let previewText = '';
      if (title === '全商品') {
        previewText = `${commonPrefix}${suffix}`;
      } else if (title === 'ブランド') {
        previewText = `${commonPrefix}ブランド名${suffix}`;
      } else if (title === 'カテゴリ') {
        const categoryOptions = hashtag.categoryOptions || [];
        const categoryPreview = categoryOptions.join('+');
        previewText = `${commonPrefix}${categoryPreview}${suffix}`;
      } else {
        previewText = `${commonPrefix}${suffix}`;
      }

      const checkboxId = `hashtag-checkbox-${index}`;

      console.log(`Creating checkbox ${index}:`, {title, icon, previewText});

      // シンプルに1行で表示
      const label = document.createElement('label');
      label.style.cssText = 'display: block; cursor: pointer; padding: 6px 4px; border-bottom: 1px solid #e5e7eb;';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxId;
      checkbox.setAttribute('data-index', index);
      checkbox.checked = true;
      checkbox.onchange = updateDescriptionFromDetail;
      checkbox.style.cssText = 'cursor: pointer; margin-right: 6px; vertical-align: middle;';

      const textSpan = document.createElement('span');
      textSpan.style.cssText = 'font-size: 11px; color: #374151; vertical-align: middle;';
      textSpan.textContent = previewText;

      label.appendChild(checkbox);
      label.appendChild(textSpan);

      container.appendChild(label);
    });

    // 生成後のDOMを確認
    console.log('生成されたHTML:', container.innerHTML);
    console.log('チェックボックスコンテナの子要素数:', container.children.length);
  }

  /**
   * 折りたたみ機能
   */
  function toggleCollapse(sectionId) {
    const section = document.getElementById(sectionId);
    const toggleIcon = document.getElementById(sectionId.replace('Section', 'Toggle'));

    if (section && toggleIcon) {
      const isHidden = section.style.display === 'none';
      section.style.display = isHidden ? 'block' : 'none';
      toggleIcon.textContent = isHidden ? '▲' : '▼';
    }
  }

  /**
   * 割引情報チェックボックスを動的生成
   */
  function renderDiscountCheckboxes() {
    console.log('renderDiscountCheckboxes が呼び出されました');
    const container = document.getElementById('discountCheckboxContainer');
    if (!container) {
      console.error('discountCheckboxContainer が見つかりません');
      return;
    }

    container.innerHTML = '';

    console.log('DISCOUNT_CONFIG:', DISCOUNT_CONFIG);
    if (!DISCOUNT_CONFIG) {
      console.warn('割引設定が空です');
      container.innerHTML = '<div style="font-size: 11px; color: #6b7280; text-align: center;">割引設定がありません</div>';
      return;
    }

    const discounts = [];

    // フォロー割
    if (DISCOUNT_CONFIG['フォロー割'] && DISCOUNT_CONFIG['フォロー割'].length > 0) {
      discounts.push({
        id: 'follow',
        label: 'フォロー割',
        icon: '👥'
      });
    }

    // リピート割
    if (DISCOUNT_CONFIG['リピート割'] && DISCOUNT_CONFIG['リピート割'].length > 0) {
      discounts.push({
        id: 'repeat',
        label: 'リピート割',
        icon: '🔁'
      });
    }

    // まとめ割
    if (DISCOUNT_CONFIG['まとめ割'] && DISCOUNT_CONFIG['まとめ割'].length > 0) {
      discounts.push({
        id: 'matome',
        label: 'まとめ割',
        icon: '📦'
      });
    }

    if (discounts.length === 0) {
      container.innerHTML = '<div style="font-size: 11px; color: #6b7280; text-align: center;">割引設定がありません</div>';
      return;
    }

    // テーマチェック: モダンテーマの場合は絵文字を表示しない
    const isModernTheme = document.body.classList.contains('theme-modern');

    discounts.forEach((discount, index) => {
      const checkboxId = `discount-checkbox-${discount.id}`;

      const label = document.createElement('label');
      label.style.cssText = 'display: block; cursor: pointer; padding: 6px 4px; border-bottom: 1px solid #e5e7eb;';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxId;
      checkbox.setAttribute('data-discount-type', discount.id);
      checkbox.checked = true;
      checkbox.onchange = updateDescriptionFromDetail;
      checkbox.style.cssText = 'cursor: pointer; margin-right: 6px; vertical-align: middle;';

      const textSpan = document.createElement('span');
      textSpan.style.cssText = 'font-size: 11px; color: #374151; vertical-align: middle;';
      textSpan.textContent = isModernTheme ? discount.label : `${discount.icon} ${discount.label}`;

      label.appendChild(checkbox);
      label.appendChild(textSpan);

      container.appendChild(label);
    });

    console.log('割引情報チェックボックス生成完了:', discounts.length);
  }

  /**
   * ハッシュタグチェックボックスのプレビューテキストを更新
   */
  function updateHashtagCheckboxPreviews() {
    if (!HASHTAG_CONFIG || !HASHTAG_CONFIG.hashtags) return;

    const hashtags = HASHTAG_CONFIG.hashtags;
    const commonPrefix = HASHTAG_CONFIG.commonPrefix || '#';

    hashtags.forEach((hashtag, index) => {
      const previewElement = document.getElementById(`hashtag-preview-${index}`);
      if (!previewElement) return;

      const title = hashtag.title || '';
      const suffix = hashtag.suffix || '';
      let previewText = '';

      if (title === '全商品') {
        previewText = `${commonPrefix}${suffix}`;
      } else if (title === 'ブランド') {
        const brandEn = _val('ブランド(英語)');
        const brandKana = _val('ブランド(カナ)');
        const brand = brandEn || brandKana;
        if (brand) {
          const cleanBrand = brand.replace(/\s+/g, '');
          previewText = `${commonPrefix}${cleanBrand}${suffix}`;
        } else {
          previewText = `${commonPrefix}ブランド名${suffix}`;
        }
      } else if (title === 'カテゴリ') {
        const categoryOptions = hashtag.categoryOptions || [];
        const categoryMap = {
          '大分類': _val('大分類(カテゴリ)'),
          '中分類': _val('中分類(カテゴリ)'),
          '小分類': _val('小分類(カテゴリ)'),
          '細分類1': _val('細分類(カテゴリ)'),
          '細分類2': _val('細分類2'),
          'アイテム名': _val('アイテム名')
        };

        const categoryParts = [];
        categoryOptions.forEach(optionName => {
          const value = categoryMap[optionName];
          if (value) {
            categoryParts.push(value);
          }
        });

        if (categoryParts.length > 0) {
          previewText = `${commonPrefix}${categoryParts.join('')}${suffix}`;
        } else {
          const categoryPreview = categoryOptions.join('+');
          previewText = `${commonPrefix}${categoryPreview}${suffix}`;
        }
      } else {
        previewText = `${commonPrefix}${suffix}`;
      }

      previewElement.textContent = previewText;
    });
  }

  // 割引情報設定（設定マスタから読み込む）
  let DISCOUNT_CONFIG = {
    'フォロー割': [
      { 範囲: '〜2,999円', 割引額: '100円引' },
      { 範囲: '〜5,999円', 割引額: '200円引' },
      { 範囲: '〜8,999円', 割引額: '300円引' },
      { 範囲: '9,000円〜', 割引額: '500円引' }
    ],
    'リピート割': [
      { 範囲: '', 割引額: '200円引' }
    ],
    'まとめ割': [
      { 範囲: '2点', 割引額: '300円' },
      { 範囲: '3点', 割引額: '500円' },
      { 範囲: '4点', 割引額: '1,000円' }
    ]
  };

  // 設定マスタから割引情報を読み込む
  function loadDiscountConfig() {
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(config) {
          if (config) {
            DISCOUNT_CONFIG = config;
            console.log('割引情報設定を読み込みました:', Object.keys(config).length, '種類');
            // チェックボックスを生成
            renderDiscountCheckboxes();
            // 設定読み込み後、商品の説明を更新
            if (typeof updateDescriptionFromDetail === 'function') {
              updateDescriptionFromDetail();
            }
          }
        })
        .withFailureHandler(function(error) {
          console.error('割引情報設定読み込みエラー:', error);
        })
        .getDiscountConfig();
    }
  }

  // 割引情報テキストを生成（チェックボックス対応版）
  function generateDiscountInfo() {
    // 割引情報があるかチェック
    const hasFollow = DISCOUNT_CONFIG['フォロー割'] && DISCOUNT_CONFIG['フォロー割'].length > 0;
    const hasRepeat = DISCOUNT_CONFIG['リピート割'] && DISCOUNT_CONFIG['リピート割'].length > 0;
    const hasMatome = DISCOUNT_CONFIG['まとめ割'] && DISCOUNT_CONFIG['まとめ割'].length > 0;

    // チェックボックスの状態を確認
    const followCheckbox = document.getElementById('discount-checkbox-follow');
    const repeatCheckbox = document.getElementById('discount-checkbox-repeat');
    const matomeCheckbox = document.getElementById('discount-checkbox-matome');

    const includeFollow = hasFollow && (!followCheckbox || followCheckbox.checked);
    const includeRepeat = hasRepeat && (!repeatCheckbox || repeatCheckbox.checked);
    const includeMatome = hasMatome && (!matomeCheckbox || matomeCheckbox.checked);

    // すべての割引が空またはチェックなしの場合は空文字を返す
    if (!includeFollow && !includeRepeat && !includeMatome) {
      return '';
    }

    let text = '\n【お得な割引情報】\n\n';

    // テーマチェック: モダンテーマの場合は絵文字を表示しない
    const isModernTheme = document.body.classList.contains('theme-modern');
    const bullet = isModernTheme ? '' : '■ ';

    // フォロー割
    if (includeFollow) {
      text += `${bullet}フォロー割\n`;
      DISCOUNT_CONFIG['フォロー割'].forEach(item => {
        text += `${item.範囲} ⇒ ${item.割引額}\n`;
      });
      // 説明文があれば追加
      if (DISCOUNT_CONFIG['フォロー割_説明文']) {
        text += `${DISCOUNT_CONFIG['フォロー割_説明文']}\n`;
      }
      text += '\n';
    }

    // リピート割
    if (includeRepeat) {
      const repeatDiscount = DISCOUNT_CONFIG['リピート割'][0].割引額;
      text += `${bullet}リピート割\n`;
      text += `次回購入時に${repeatDiscount}\n`;
      // 説明文があれば追加
      if (DISCOUNT_CONFIG['リピート割_説明文']) {
        text += `${DISCOUNT_CONFIG['リピート割_説明文']}\n`;
      }
      text += '\n';
    }

    // まとめ割
    if (includeMatome) {
      text += `${bullet}まとめ割\n`;
      DISCOUNT_CONFIG['まとめ割'].forEach(item => {
        text += `${item.範囲}⇒${item.割引額}\n`;
      });
      // 説明文があれば追加
      if (DISCOUNT_CONFIG['まとめ割_説明文']) {
        text += `${DISCOUNT_CONFIG['まとめ割_説明文']}`;
      }
    }

    return text;
  }

  // オリジナルハッシュタグ生成関数（動的設定対応版・チェックボックス連動）
  function generateHashtags() {
    const tags = [];

    // 新形式（動的ハッシュタグ配列 + 共通プレフィックス）に対応
    if (HASHTAG_CONFIG.hashtags && Array.isArray(HASHTAG_CONFIG.hashtags)) {
      const commonPrefix = HASHTAG_CONFIG.commonPrefix || '';

      HASHTAG_CONFIG.hashtags.forEach((hashtag, index) => {
        // チェックボックスの状態を確認
        const checkbox = document.getElementById(`hashtag-checkbox-${index}`);
        if (!checkbox || !checkbox.checked) {
          return; // チェックされていない場合はスキップ
        }

        const suffix = hashtag.suffix || '';
        const title = hashtag.title || '';

        // タイトルに基づいて中間部分を決定
        if (title === '全商品') {
          // 全商品タグ
          tags.push(`${commonPrefix}${suffix}`);
        } else if (title === 'ブランド') {
          // ブランド別タグ（英語優先、なければカナ）
          const brandEn = _val('ブランド(英語)');
          const brandKana = _val('ブランド(カナ)');
          const brand = brandEn || brandKana;
          if (brand) {
            const cleanBrand = brand.replace(/\s+/g, '');
            tags.push(`${commonPrefix}${cleanBrand}${suffix}`);
          }
        } else if (title === 'カテゴリ') {
          // カテゴリタグ（選択されたカテゴリを連結）
          const categoryOptions = hashtag.categoryOptions || ['大分類', '中分類'];

          // カテゴリ値のマッピング
          const categoryMap = {
            '大分類': _val('大分類(カテゴリ)'),
            '中分類': _val('中分類(カテゴリ)'),
            '小分類': _val('小分類(カテゴリ)'),
            '細分類1': _val('細分類(カテゴリ)'),
            '細分類2': _val('細分類2'),
            'アイテム名': _val('アイテム名')
          };

          // 選択されたカテゴリを順番に連結
          const categoryParts = [];
          categoryOptions.forEach(optionName => {
            const value = categoryMap[optionName];
            if (value) {
              categoryParts.push(value);
            }
          });

          // 連結されたカテゴリでハッシュタグを生成
          if (categoryParts.length > 0) {
            const combinedCategory = categoryParts.join('');
            tags.push(`${commonPrefix}${combinedCategory}${suffix}`);
          }
        } else if (title === 'カラー') {
          // カラータグ
          const colorValue = _val('カラー');
          if (colorValue) {
            const cleanColor = colorValue.replace(/\s+/g, '');
            tags.push(`${commonPrefix}${cleanColor}${suffix}`);
          }
        } else if (title === 'サイズ') {
          // サイズタグ
          const sizeValue = _val('サイズ');
          if (sizeValue) {
            const cleanSize = sizeValue.replace(/\s+/g, '');
            tags.push(`${commonPrefix}${cleanSize}${suffix}`);
          }
        } else {
          // カスタムハッシュタグ（タイトルが特定のものでない場合）
          // 共通プレフィックスとサフィックスのみ結合
          if (commonPrefix || suffix) {
            tags.push(`${commonPrefix}${suffix}`);
          }
        }
      });
    } else {
      // 旧形式（固定3項目）との後方互換性
      // 全商品タグ
      if (HASHTAG_CONFIG.全商品プレフィックス || HASHTAG_CONFIG.全商品テキスト) {
        const allProductPrefix = HASHTAG_CONFIG.全商品プレフィックス || '#REBORN_';
        const allProductText = HASHTAG_CONFIG.全商品テキスト || '全商品';
        tags.push(`${allProductPrefix}${allProductText}`);
      }

      // ブランド別タグ
      const brandEn = _val('ブランド(英語)');
      if (brandEn && (HASHTAG_CONFIG.ブランドプレフィックス || HASHTAG_CONFIG.ブランドサフィックス)) {
        const brandPrefix = HASHTAG_CONFIG.ブランドプレフィックス || '#REBORN_';
        const brandSuffix = HASHTAG_CONFIG.ブランドサフィックス || 'アイテム一覧';
        const cleanBrand = brandEn.replace(/\s+/g, '');
        tags.push(`${brandPrefix}${cleanBrand}${brandSuffix}`);
      }

      // カテゴリタグ
      if (HASHTAG_CONFIG.カテゴリプレフィックス || HASHTAG_CONFIG.カテゴリサフィックス) {
        const categoryPrefix = HASHTAG_CONFIG.カテゴリプレフィックス || '#REBORN_';
        const categorySuffix = HASHTAG_CONFIG.カテゴリサフィックス || '一覧';

        const category1 = _val('大分類(カテゴリ)');
        const category2 = _val('中分類(カテゴリ)');

        if (category2) {
          tags.push(`${categoryPrefix}${category2}${categorySuffix}`);
        }
        if (category1) {
          tags.push(`${categoryPrefix}${category1}${categorySuffix}`);
        }
        if (category1 && category2) {
          tags.push(`${categoryPrefix}${category1}${category2}${categorySuffix}`);
        }
      }
    }

    // 重複削除
    return [...new Set(tags)];
  }

  function splitMulti(s) {
    return String(s||'').split(/[,\u3001\/\uFF0F\n]+/).map(v=>v.trim()).filter(v=>v.length>0);
  }

  function uniqKeepOrder(arr) {
    const s=new Set(), out=[];
    for(const x of arr||[]) {
      const v=(x??'').toString().trim();
      if(!v||s.has(v))continue;
      s.add(v);
      out.push(v);
    }
    return out;
  }

  // ブランドペアデータの高速検索用インデックスマップを構築
  function buildBrandIndexMap() {
    BRAND_INDEX_MAP.clear();

    // ペアデータから英語名をキーとしてマップを構築
    BRAND_PAIRS.forEach((pair, index) => {
      if (pair && pair.english) {
        BRAND_INDEX_MAP.set(pair.english, index);
      }
    });

    console.log(`ブランドペアインデックスマップ構築完了: ${BRAND_INDEX_MAP.size}件`);
    console.log('ブランドペアデータ数:', BRAND_PAIRS.length);
  }

  function fillSelectSafe(sel, values) {
    if (!sel) return;
    if (Array.isArray(values) && values.length) {
      const prev = sel.value;
      sel.innerHTML = '<option value="">--</option>';
      values.forEach(v=> sel.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`));
      sel.disabled = false;
      if (prev && values.includes(prev)) sel.value = prev;
    }
  }

  function resetSelect(id, disable=true) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">--</option>';
    sel.value = '';
    if (disable) sel.disabled = true;
  }

  function applyShippingDefaults() {
    for (const k of Object.keys(SHIPPING_DEFAULTS)) {
      const el = document.getElementById(k);
      if (!el) continue;
      const def = SHIPPING_DEFAULTS[k];
      const exists = Array.from(el.options).some(o => String(o.value) === def);
      if (!exists) el.insertAdjacentHTML('beforeend', `<option value="${def}">${def}</option>`);
      el.value = def;
    }
  }

  function applyProcureListingDefaults() {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD形式

    // デフォルト仕入日
    const procureDateField = document.getElementById('仕入日');
    if (procureDateField) {
      if (PROCURE_LISTING_DEFAULTS['仕入日_今日'] === true) {
        // 「常に今日」がチェックされている場合は今日の日付を使用
        procureDateField.value = today;
      } else {
        // 固定日付を使用
        const defaultProcureDate = PROCURE_LISTING_DEFAULTS['デフォルト仕入日'];
        if (defaultProcureDate) {
          procureDateField.value = defaultProcureDate;
        }
      }
    }

    // デフォルト仕入先
    const defaultProcureSource = PROCURE_LISTING_DEFAULTS['デフォルト仕入先'];
    if (defaultProcureSource) {
      const procureSourceField = document.getElementById('仕入先');
      if (procureSourceField) {
        // 選択肢に存在するか確認
        const exists = Array.from(procureSourceField.options).some(o => String(o.value) === defaultProcureSource);
        if (!exists) {
          procureSourceField.insertAdjacentHTML('beforeend', `<option value="${defaultProcureSource}">${defaultProcureSource}</option>`);
        }
        procureSourceField.value = defaultProcureSource;
      }
    }

    // デフォルト出品日
    const listingDateField = document.getElementById('出品日');
    if (listingDateField) {
      if (PROCURE_LISTING_DEFAULTS['出品日_今日'] === true) {
        // 「常に今日」がチェックされている場合は今日の日付を使用
        listingDateField.value = today;
      } else {
        // 固定日付を使用
        const defaultListingDate = PROCURE_LISTING_DEFAULTS['デフォルト出品日'];
        if (defaultListingDate) {
          listingDateField.value = defaultListingDate;
        }
      }
    }

    // デフォルト出品先
    const defaultListingDest = PROCURE_LISTING_DEFAULTS['デフォルト出品先'];
    if (defaultListingDest) {
      const listingDestField = document.getElementById('出品先');
      if (listingDestField) {
        // 選択肢に存在するか確認
        const exists = Array.from(listingDestField.options).some(o => String(o.value) === defaultListingDest);
        if (!exists) {
          listingDestField.insertAdjacentHTML('beforeend', `<option value="${defaultListingDest}">${defaultListingDest}</option>`);
        }
        listingDestField.value = defaultListingDest;
      }
    }
  }

  // ========== 管理番号セグメント方式UI ==========

  /**
   * Firestoreから管理番号設定を読み込み（タイムアウト付き）
   * @returns {Promise<Object|null>} 管理番号設定オブジェクト、または null
   */
  async function loadManagementConfigFromFirestore() {
    if (!window.db) {
      console.warn('⚠️ Firestoreが初期化されていません');
      return null;
    }

    const startTime = performance.now();

    try {
      console.log('📥 Firestoreから管理番号設定を読み込み中...');

      // タイムアウト処理（3秒）
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore読み込みタイムアウト（3秒）')), 3000)
      );

      const fetchPromise = (async () => {
        const docRef = firebase.firestore().collection('settings').doc('common');
        const docSnap = await docRef.get();
        return docSnap;
      })();

      // Firestore読み込みとタイムアウトを競争
      const docSnap = await Promise.race([fetchPromise, timeoutPromise]);
      const duration = (performance.now() - startTime).toFixed(2);

      if (docSnap.exists) {
        const data = docSnap.data();
        console.log(`✅ Firestoreから設定を取得: ${duration}ms`, data);

        // managementNumber フィールドを返す
        if (data.managementNumber) {
          // localStorageにもキャッシュ（次回の高速表示用）
          localStorage.setItem('rebornConfig_managementNumber', JSON.stringify(data.managementNumber));
          console.log('💾 localStorageにもキャッシュしました');
          return data.managementNumber;
        } else {
          console.log('⚠️ managementNumber フィールドが存在しません');
          return null;
        }
      } else {
        console.log('⚠️ Firestore settings/common ドキュメントが存在しません');
        return null;
      }
    } catch (e) {
      const duration = (performance.now() - startTime).toFixed(2);
      if (e.message.includes('タイムアウト')) {
        console.warn(`⏱️ ${e.message} (${duration}ms経過) → キャッシュを使用`);
      } else {
        console.error('❌ Firestore読み込みエラー:', e);
      }
      return null;
    }
  }

  // グローバル変数：管理番号設定をキャッシュ
  window.managementNumberConfig = null;

  // 管理番号セグメントUIを初期化
  async function initManagementNumberUI() {
  
    let config = null;
    let segments = null;

    // 1. まずlocalStorageキャッシュから即座に読み込み（高速表示）
    const cachedConfigStr = localStorage.getItem('rebornConfig_managementNumber');
    console.log('📦 localStorage確認 (rebornConfig_managementNumber):', {
      cachedConfigStr: cachedConfigStr,
      type: typeof cachedConfigStr,
      isTruthy: !!cachedConfigStr,
      length: cachedConfigStr ? cachedConfigStr.length : 'N/A'
    });

    if (cachedConfigStr) {
      console.log('✅ localStorageから設定を即座に読み込みます');
      try {
        config = JSON.parse(cachedConfigStr);
        console.log('📦 管理番号設定をlocalStorageから読み込み:', config);
        segments = config.segments || null;
        console.log('📦 セグメント配列:', segments);

        // グローバル変数にも保存
        window.managementNumberConfig = config;

        // キャッシュがあれば即座にUI描画
        if (segments && segments.length > 0) {
          console.log('⚡ キャッシュからUIを即座に描画');
          renderManagementSegmentUI(segments);
        }
      } catch (e) {
        console.error('❌ localStorage パースに失敗:', e);
      }
    } else {
      console.log('⚠️ localStorageにキャッシュが存在しません');
    }

    // 2. バックグラウンドでFirestoreから最新設定を取得
    try {
      const latestConfig = await loadManagementConfigFromFirestore();
      if (latestConfig) {
        console.log('✅ Firestoreから最新設定を取得:', latestConfig);
        const latestSegments = latestConfig.segments || null;

        console.log('🔍 [デバッグ] segments比較:', {
          'config?.segments': config?.segments,
          'latestSegments': latestSegments,
          'cachedStr': JSON.stringify(config?.segments || []),
          'latestStr': JSON.stringify(latestSegments || [])
        });

        // 初回ロード時は必ずUIを生成
        if (!config || !config.segments) {
          console.log('⚡ 初回ロード検知 → 強制的にUI生成');
          if (latestSegments && latestSegments.length > 0) {
            renderManagementSegmentUI(latestSegments);
          }
          config = latestConfig;
          segments = latestSegments;
          // グローバル変数にも保存
          window.managementNumberConfig = latestConfig;
        } else {
          // 2回目以降は差分チェック
          const cachedStr = JSON.stringify(config.segments);
          const latestStr = JSON.stringify(latestSegments || []);

          if (cachedStr !== latestStr) {
            console.log('🔄 設定が変更されているため、UIを更新します');
            if (latestSegments && latestSegments.length > 0) {
              renderManagementSegmentUI(latestSegments);
            }
            config = latestConfig;
            segments = latestSegments;
            // グローバル変数にも保存
            window.managementNumberConfig = latestConfig;
          } else {
            console.log('✅ 設定に変更なし、UIそのまま');
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Firestore読み込み失敗（キャッシュを使用）:', e);
    }

    // 3. キャッシュもFirestoreもなければレガシーUIへ
    if (!segments || segments.length === 0) {
      console.log('⚠️ セグメント配列が空です');
    }

    // PWA版：google.script.runは使用不可、localStorageのみ
    if (!(typeof google !== 'undefined' && google.script && google.script.run)) {
      console.log('PWA版：管理番号設定はlocalStorageのみを使用');
      // セグメント設定がなければレガシーUIを使用
      console.log('🔍 レガシーUI判定:', {
        segments: segments,
        notSegments: !segments,
        willCallLegacy: !segments || segments.length === 0
      });
      if (!segments || segments.length === 0) {
        console.log('✅ レガシーUIを呼び出します');
        initLegacyManagementUI();
      } else {
        console.log('❌ セグメント設定が存在するため、レガシーUIをスキップ');
      }
      return;
    }

    // GAS版：バックグラウンドで最新設定を取得
    google.script.run
      .withSuccessHandler(function(segments) {
        if (!segments || segments.length === 0) {
          // セグメント設定がない場合は旧UIを使用
          localStorage.removeItem('reborn_mgmt_segments');
          if (!cachedSegments) {
            initLegacyManagementUI();
          }
          return;
        }

        // 設定が変更されている場合のみUIを更新
        const currentCache = localStorage.getItem('reborn_mgmt_segments');
        const newCache = JSON.stringify(segments);

        if (currentCache !== newCache) {
          console.log('🔄 管理番号設定が更新されました');
          localStorage.setItem('reborn_mgmt_segments', newCache);
          renderManagementSegmentUI(segments);
        } else {
          console.log('✅ 管理番号設定は最新です');
        }
      })
      .withFailureHandler(function(e) {
        console.error('セグメント設定の読み込みに失敗:', e);
        // キャッシュがなければ旧UIを使用
        if (!cachedSegments) {
          initLegacyManagementUI();
        }
      })
      .getManagementNumberSegments();
  }

  // セグメントUIを生成
  function renderManagementSegmentUI(segments) {
    const container = document.getElementById('managementNumberFields');
    if (!container) return;

    container.innerHTML = '';

    // ユーザー入力が必要なセグメントがあるかチェック
    let hasUserInput = false;

    segments.forEach((segment, index) => {
      const type = segment.type;
      const config = segment.config;

      // ユーザー入力が必要なセグメントのみUIを生成
      switch (type) {
        case 'shelf':
          // 棚番号選択（2段階選択: 頭文字 → 棚番号）
          const shelfDiv = document.createElement('div');
          shelfDiv.style.marginBottom = '8px';

          // 頭文字の選択肢を生成（A-Z）
          let shelfFirstCharOptions = '<option value="">--選択--</option>';
          for (let i = 65; i <= 90; i++) {
            const char = String.fromCharCode(i);
            shelfFirstCharOptions += `<option value="${char}">${char}</option>`;
          }

          shelfDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div>
                <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
                  頭文字
                </label>
                <select id="mgmt_shelf_first" class="tight" style="width: 100%;">
                  ${shelfFirstCharOptions}
                </select>
              </div>
              <div>
                <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
                  棚番号
                </label>
                <select id="mgmt_shelf_second" class="tight" style="width: 100%;">
                  <option value="">--選択--</option>
                </select>
              </div>
            </div>
          `;
          container.appendChild(shelfDiv);

          // 2文字目のイベントリスナーを先に設定
          const shelfSecondSelect = document.getElementById('mgmt_shelf_second');
          const updateShelfHandler = function() {
            updateManagementNumberPreview();
          };
          shelfSecondSelect.addEventListener('change', updateShelfHandler);

          // 頭文字選択時に2文字目を更新
          document.getElementById('mgmt_shelf_first').addEventListener('change', function() {
            const firstChar = this.value;

            // イベントリスナーを一時的に削除
            shelfSecondSelect.removeEventListener('change', updateShelfHandler);

            if (!firstChar) {
              shelfSecondSelect.innerHTML = '<option value="">--選択--</option>';
              shelfSecondSelect.disabled = true;
              shelfSecondSelect.value = '';
              // 頭文字が空の場合は管理番号をクリア
              setManagementNumber('', '未選択');
            } else {
              let secondOptions = '<option value="">--選択--</option>';
              for (let i = 65; i <= 90; i++) {
                const char = String.fromCharCode(i);
                secondOptions += `<option value="${char}">${firstChar}${char}</option>`;
              }
              shelfSecondSelect.innerHTML = secondOptions;
              shelfSecondSelect.value = '';  // 明示的に空欄に設定
              shelfSecondSelect.disabled = false;
              // 頭文字選択時はプレビュー更新しない（2文字目選択まで待つ）
              setManagementNumber('', '');
            }

            // イベントリスナーを再設定
            shelfSecondSelect.addEventListener('change', updateShelfHandler);
          });
          hasUserInput = true;
          break;

        case 'category':
          // カテゴリコード選択（AA〜ZZ）
          const categoryDiv = document.createElement('div');
          categoryDiv.style.marginBottom = '8px';

          // AA〜ZZの選択肢を生成
          let categoryOptions = '<option value="">--選択--</option>';
          for (let i = 65; i <= 90; i++) { // A-Z
            for (let j = 65; j <= 90; j++) { // A-Z
              const code = String.fromCharCode(i) + String.fromCharCode(j);
              categoryOptions += `<option value="${code}">${code}</option>`;
            }
          }

          categoryDiv.innerHTML = `
            <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
              📁 カテゴリコード
            </label>
            <select id="mgmt_category" class="tight" style="width: 100%;">
              ${categoryOptions}
            </select>
          `;
          container.appendChild(categoryDiv);

          // プレビュー更新イベント
          document.getElementById('mgmt_category').addEventListener('change', updateManagementNumberPreview);
          hasUserInput = true;
          break;

        case 'rank':
          // 品質ランク選択
          const rankDiv = document.createElement('div');
          rankDiv.style.marginBottom = '8px';
          rankDiv.innerHTML = `
            <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
              ⭐ 品質ランク
            </label>
            <select id="mgmt_rank" class="tight" style="width: 100%;">
              <option value="">--選択--</option>
              <option value="S">S (最高品質)</option>
              <option value="A">A (新品・美品)</option>
              <option value="B">B (良好)</option>
              <option value="C">C (使用感あり)</option>
              <option value="D">D (難あり)</option>
              <option value="E">E (ジャンク)</option>
            </select>
          `;
          container.appendChild(rankDiv);

          // プレビュー更新イベント
          document.getElementById('mgmt_rank').addEventListener('change', updateManagementNumberPreview);
          hasUserInput = true;
          break;

        case 'size':
          // サイズコード選択
          const sizeDiv = document.createElement('div');
          sizeDiv.style.marginBottom = '8px';
          sizeDiv.innerHTML = `
            <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
              📏 サイズコード
            </label>
            <select id="mgmt_size" class="tight" style="width: 100%;">
              <option value="">--選択--</option>
              <option value="XS">XS</option>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
              <option value="XXL">XXL</option>
            </select>
          `;
          container.appendChild(sizeDiv);

          // プレビュー更新イベント
          document.getElementById('mgmt_size').addEventListener('change', updateManagementNumberPreview);
          hasUserInput = true;
          break;

        case 'color':
          // 色コード選択
          const colorDiv = document.createElement('div');
          colorDiv.style.marginBottom = '8px';
          colorDiv.innerHTML = `
            <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
              🎨 色コード
            </label>
            <select id="mgmt_color" class="tight" style="width: 100%;">
              <option value="">--選択--</option>
              <option value="BK">BK (黒)</option>
              <option value="W">W (白)</option>
              <option value="R">R (赤)</option>
              <option value="BL">BL (青)</option>
              <option value="GR">GR (緑)</option>
              <option value="Y">Y (黄)</option>
              <option value="G">G (グレー)</option>
              <option value="BR">BR (茶)</option>
              <option value="BE">BE (ベージュ)</option>
              <option value="P">P (ピンク)</option>
              <option value="O">O (オレンジ)</option>
            </select>
          `;
          container.appendChild(colorDiv);

          // プレビュー更新イベント
          document.getElementById('mgmt_color').addEventListener('change', updateManagementNumberPreview);
          hasUserInput = true;
          break;

        case 'custom':
          // カスタム値（2段階選択: 頭文字 → 棚番号）
          const customDiv = document.createElement('div');
          customDiv.style.marginBottom = '8px';

          // 頭文字の選択肢を生成（A-Z）
          let firstCharOptions = '<option value="">--選択--</option>';
          for (let i = 65; i <= 90; i++) {
            const char = String.fromCharCode(i);
            firstCharOptions += `<option value="${char}">${char}</option>`;
          }

          customDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
              <div>
                <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
                  頭文字
                </label>
                <select id="mgmt_custom_first" class="tight" style="width: 100%;">
                  ${firstCharOptions}
                </select>
              </div>
              <div>
                <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
                  棚番号
                </label>
                <select id="mgmt_custom_second" class="tight" style="width: 100%;">
                  <option value="">--選択--</option>
                </select>
              </div>
            </div>
          `;
          container.appendChild(customDiv);

          // 2文字目のイベントリスナーを先に設定
          const secondSelect = document.getElementById('mgmt_custom_second');
          const updateSecondHandler = function() {
            updateManagementNumberPreview();
          };
          secondSelect.addEventListener('change', updateSecondHandler);

          // 頭文字選択時に2文字目を更新
          document.getElementById('mgmt_custom_first').addEventListener('change', function() {
            const firstChar = this.value;

            // イベントリスナーを一時的に削除
            secondSelect.removeEventListener('change', updateSecondHandler);

            if (!firstChar) {
              secondSelect.innerHTML = '<option value="">--選択--</option>';
              secondSelect.disabled = true;
              secondSelect.value = '';
              // 頭文字が空の場合は管理番号をクリア
              setManagementNumber('', '未選択');
            } else {
              let secondOptions = '<option value="">--選択--</option>';
              for (let i = 65; i <= 90; i++) {
                const char = String.fromCharCode(i);
                secondOptions += `<option value="${char}">${firstChar}${char}</option>`;
              }
              secondSelect.innerHTML = secondOptions;
              secondSelect.value = '';  // 明示的に空欄に設定
              secondSelect.disabled = false;
              // 頭文字選択時はプレビュー更新しない（2文字目選択まで待つ）
              setManagementNumber('', '');
            }

            // イベントリスナーを再設定
            secondSelect.addEventListener('change', updateSecondHandler);
          });
          hasUserInput = true;
          break;

        case 'date':
        case 'sequence':
          // これらは自動生成なのでUIは不要
          break;
      }
    });

    // ユーザー入力が不要な場合（連番のみなど）は自動で管理番号を生成
    if (!hasUserInput) {
      updateManagementNumberPreview();
    } else {
      // 初期状態では管理番号フィールドを空欄にする
      setManagementNumber('', '未選択');
    }

    // UI生成完了後、表示する
    container.style.display = 'block';
    const previewSection = document.getElementById('managementNumberPreview');
    if (previewSection) {
      previewSection.style.display = 'block';
    }
  }

  // 管理番号プレビューを更新
  function updateManagementNumberPreview() {
    // 棚番号は2段階選択から結合
    const shelfFirst = _val('mgmt_shelf_first');
    const shelfSecond = _val('mgmt_shelf_second');
    const shelfValue = (shelfFirst && shelfSecond) ? shelfFirst + shelfSecond : '';

    // カスタム値は2段階選択から結合
    const customFirst = _val('mgmt_custom_first');
    const customSecond = _val('mgmt_custom_second');
    const customValue = (customFirst && customSecond) ? customFirst + customSecond : '';

    // 棚番号フィールドが存在する場合、2文字目が未選択なら採番しない
    const shelfFirstField = document.getElementById('mgmt_shelf_first');
    if (shelfFirstField && shelfFirst && !shelfSecond) {
      setManagementNumber('', '');
      return;
    }

    // カスタム値フィールドが存在する場合、2文字目が未選択なら採番しない
    const customFirstField = document.getElementById('mgmt_custom_first');
    if (customFirstField && customFirst && !customSecond) {
      setManagementNumber('', '');
      return;
    }

    const userInputs = {
      shelf: shelfValue,
      category: _val('mgmt_category'),
      rank: _val('mgmt_rank'),
      size: _val('mgmt_size'),
      color: _val('mgmt_color'),
      custom: customValue
    };

    // 採番中を表示
    setManagementNumber('', '採番中...');

    // PWA版かGAS版かを判定
    if (typeof google === 'undefined' || !google.script || !google.script.run) {
      // PWA版：Firestoreから採番
      generateSegmentBasedManagementNumberPWA(userInputs);
    } else {
      // GAS版：従来通り
      google.script.run
        .withSuccessHandler(function(managementNumber) {
          if (typeof managementNumber === 'string' && managementNumber.startsWith('NG(')) {
            setManagementNumber('', managementNumber);
            return;
          }
          setManagementNumber(managementNumber, '');
        })
        .withFailureHandler(function(e) {
          console.error('管理番号生成エラー:', e);
          setManagementNumber('', 'エラー');
        })
        .generateSegmentBasedManagementNumber(userInputs);
    }
  }

  // PWA版：セグメント設定に基づいて管理番号を生成
  async function generateSegmentBasedManagementNumberPWA(userInputs) {
    try {
      if (!window.db) {
        throw new Error('Firestoreが初期化されていません');
      }

      console.log('📥 PWA版管理番号採番開始:', userInputs);

      let segments = null;

      // グローバル変数が存在すればそれを使用（Firestoreアクセスを回避）
      if (window.managementNumberConfig && window.managementNumberConfig.segments) {
        console.log('✅ グローバル変数から設定を取得（Firestoreアクセス不要）');
        segments = window.managementNumberConfig.segments;
      } else {
        // グローバル変数がない場合のみFirestoreから読み込み
        console.log('📥 グローバル変数なし → Firestoreから設定を読み込み');
        const docRef = window.db.collection('settings').doc('common');
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          throw new Error('管理番号設定が見つかりません');
        }

        const data = docSnap.data();
        segments = data.managementNumber?.segments || [];

        // グローバル変数にも保存（次回のため）
        window.managementNumberConfig = data.managementNumber || null;
      }

      if (segments.length === 0) {
        throw new Error('セグメント設定が空です');
      }

      console.log('📋 セグメント設定:', segments);

      // セグメントに基づいて管理番号を生成
      const parts = [];
      let counterKey = 'counter';

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const config = segment.config || {};
        let value = '';

        switch (segment.type) {
          case 'shelf':
            // 棚番号：ユーザー入力から取得
            if (config.format === 'custom') {
              value = config.code || userInputs.shelf || '';
            } else {
              value = userInputs.shelf || '';
            }
            if (value) {
              counterKey += `_shelf_${value}`;
            }
            break;

          case 'category':
            // カテゴリ：ユーザー入力または固定値
            if (config.format === 'userInput') {
              value = userInputs.category || '';
            } else {
              value = config.code || '';
            }
            if (value) {
              counterKey += `_category_${value}`;
            }
            break;

          case 'date':
            // 登録日：現在日時をフォーマット
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');

            switch(config.format) {
              case 'YYYYMMDD':
                value = `${y}${m}${d}`;
                break;
              case 'YYMD':
                value = `${String(y).slice(2)}${parseInt(m)}${parseInt(d)}`;
                break;
              case 'YYMM':
                value = `${String(y).slice(2)}${m}`;
                break;
              default: // 'YYMMDD'
                value = `${String(y).slice(2)}${m}${d}`;
            }
            counterKey += `_date_${value}`;
            break;

          case 'rank':
            // 品質ランク：ユーザー入力または固定値
            if (config.format === 'userInput') {
              value = userInputs.rank || '';
            } else {
              value = config.value || '';
            }
            if (value) {
              counterKey += `_rank_${value}`;
            }
            break;

          case 'size':
            // サイズ：ユーザー入力または固定値
            if (config.format === 'userInput') {
              value = userInputs.size || '';
            } else {
              value = config.code || '';
            }
            if (value) {
              counterKey += `_size_${value}`;
            }
            break;

          case 'color':
            // 色：ユーザー入力または固定値
            if (config.format === 'userInput') {
              value = userInputs.color || '';
            } else {
              value = config.code || '';
            }
            if (value) {
              counterKey += `_color_${value}`;
            }
            break;

          case 'custom':
            // カスタム値：ユーザー入力または固定値
            if (config.format === 'userInput') {
              value = userInputs.custom || '';
            } else {
              value = config.value || '';
            }
            if (value) {
              counterKey += `_custom_${value}`;
            }
            break;

          case 'sequence':
            // 連番：カウンター方式で高速採番（O(1)）
            const digits = parseInt(config.digits) || 3;
            const startNum = parseInt(config.start) || 1;

            // プレフィックスを構築（連番セグメントより前の部分）
            const prefix = parts.join('');

            // カウンター方式で次の番号を取得（O(1)の高速アクセス）
            const nextNumber = await getNextSequenceNumber(prefix, startNum);

            value = String(nextNumber).padStart(digits, '0');
            break;

          default:
            console.warn('⚠️ 未知のセグメントタイプ:', segment.type);
            value = '';
        }

        if (value) {
          parts.push(value);
          // 次のセグメントがある場合は区切り文字を追加
          if (i < segments.length - 1 && segment.separator) {
            parts.push(segment.separator);
          }
        }
      }

      const managementNumber = parts.join('');
      console.log('✅ PWA版管理番号生成完了:', { segments, counterKey, managementNumber });

      setManagementNumber(managementNumber, '');
    } catch (error) {
      console.error('❌ PWA版採番エラー:', error);
      setManagementNumber('', 'エラー');
    }
  }

  // 管理番号の連番を調整（▲▼ボタン用）
  function adjustManagementNumber(delta) {
    const input = document.getElementById('管理番号');
    if (!input || !input.value) return;

    const currentValue = input.value;

    // 管理番号を分解（例：BB-1001 → prefix: 'BB-', number: 1001）
    const match = currentValue.match(/^(.*?)(\d+)$/);
    if (!match) return;

    const prefix = match[1]; // 例：'BB-'
    const currentNumber = parseInt(match[2], 10); // 例：1001
    const digits = match[2].length; // ゼロパディング用

    // 新しい番号を計算
    let newNumber = currentNumber + delta;
    
    // 最小値は1（0以下にはしない）
    newNumber = Math.max(1, newNumber);
    
    // ゼロパディングして適用
    const paddedNumber = String(newNumber).padStart(digits, '0');
    const newValue = prefix + paddedNumber;
    input.value = newValue;
    
    console.log(`管理番号を調整: ${currentValue} → ${newValue}`);
  }

  // 旧UI初期化（後方互換用）
  function initLegacyManagementUI() {
      const container = document.getElementById('managementNumberFields');
    if (!container) {
      console.log('❌ managementNumberFields が見つかりません');
      return;
    }

    container.innerHTML = `
      <div class="row3">
        <div>
          <span class="small">頭文字</span>
          <select id="prefix1" class="tight">
            <option value="">--</option>
          </select>
        </div>
        <div>
          <span class="small">棚番号</span>
          <select id="棚番号" class="tight" disabled>
            <option value="">--</option>
          </select>
        </div>
        <div></div>
      </div>
    `;

    initPrefix1();

    // UI生成完了後、コンテナを表示する
    container.style.display = 'block';
    console.log('✅ managementNumberFields を表示しました');

    // プレビューセクションも表示する
    const previewSection = document.getElementById('managementNumberPreview');
    if (previewSection) {
      previewSection.style.display = 'block';
      console.log('✅ managementNumberPreview を表示しました');
    }
  }

  // ========== 旧システム（後方互換用） ==========

  // 頭文字プルダウンを初期化
  function initPrefix1() {
      const p1 = document.getElementById('prefix1');
    if (!p1) {
      console.log('❌ prefix1 要素が見つかりません');
      return;
    }
    console.log('✅ prefix1 要素を発見:', p1);
    p1.innerHTML = '<option value="">--</option>';
    console.log('📝 デフォルトオプション設定完了');

    let optionsAdded = 0;
    for (let c=65;c<=90;c++) {
      const v=String.fromCharCode(c);
      p1.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`);
      optionsAdded++;
    }
    console.log(`✅ ${optionsAdded}個のオプションを追加しました`);
    console.log('📋 prefix1.options.length:', p1.options.length);
    console.log('📋 prefix1.innerHTML:', p1.innerHTML.substring(0, 200));
  }

  // 棚番号プルダウンを構築
  function buildShelf() {
      const p1 = document.getElementById('prefix1');
    const shelf = document.getElementById('棚番号');
    console.log('📋 フィールド確認:', { p1: !!p1, shelf: !!shelf, p1Value: p1?.value });

    if (!p1 || !shelf) {
      console.log('❌ prefix1 または 棚番号 フィールドが見つかりません');
      return;
    }

    const v1 = p1.value;
    shelf.innerHTML = '<option value="">--</option>';

    if (!v1) {
      console.log('⚠️ prefix1 の値が空です');
      shelf.disabled = true;
      setManagementNumber('', '選択してください');
      return;
    }

    shelf.disabled = false;
    for (let c=65;c<=90;c++) {
      const v=v1+String.fromCharCode(c);
      shelf.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`);
    }
    shelf.value = '';
    setManagementNumber('', '選択してください');

    // HTMLを上書きしたのでイベントリスナーを再設定
    shelf.removeEventListener('change', requestNextManagementNumber);
    shelf.addEventListener('change', requestNextManagementNumber);
    console.log('✅ 棚番号イベントリスナーを再設定しました');
  }

  // 棚番号選択時に管理番号を取得
  async function requestNextManagementNumber() {
    console.log('🎯 requestNextManagementNumber() が呼ばれました');
    const shelfSel = document.getElementById('棚番号');
    if (!shelfSel) {
      console.log('❌ 棚番号フィールドが見つかりません');
      setManagementNumber('', '選択してください');
      return;
    }
    const shelf = shelfSel.value;
    console.log('📋 選択された棚番号:', shelf);
    if (!shelf) {
      console.log('⚠️ 棚番号が選択されていません');
      setManagementNumber('', '選択してください');
      return;
    }
    setManagementNumber('', '採番中…');

    // PWA版：セグメント設定に基づいて管理番号を生成
    if (!(typeof google !== 'undefined' && google.script && google.script.run)) {
      try {
        if (!window.db) {
          throw new Error('Firestoreが初期化されていません');
        }

        // localStorage から segments 設定を読み込み
        const saved = localStorage.getItem('rebornConfig_managementNumber');
        let segments = [];

        if (saved) {
          const config = JSON.parse(saved);
          segments = config.segments || [];
          console.log('📋 管理番号セグメント設定:', segments);
        }

        // セグメントが未設定の場合、デフォルト（棚-連番）
        if (segments.length === 0) {
          segments = [
            { type: 'shelf', config: { format: 'AA' }, separator: '-' },
            { type: 'sequence', config: { digits: '5', start: '1' }, separator: '' }
          ];
          console.log('⚠️ セグメント未設定、デフォルト使用:', segments);
        }

        // 管理番号を生成
        const managementNumber = await generateManagementNumber(segments, shelf);
        setManagementNumber(managementNumber, '');
        console.log('✅ 管理番号採番成功 (PWA版):', managementNumber);
      } catch (error) {
        console.error('❌ 採番エラー:', error);
        setManagementNumber('', 'エラー');
        show(`NG(採番): ${error.message}`);
      }
      return;
    }

    // GAS版（従来）
    google.script.run.withSuccessHandler(res=>{
      if (typeof res === 'string' && res.startsWith('NG(')) {
        show(res);
        setManagementNumber('', 'エラー');
        return;
      }
      setManagementNumber(res, '');
    }).withFailureHandler(e=> {
      show(`NG(UNKNOWN): ${e && e.message ? e.message : e}`);
      setManagementNumber('', 'エラー');
    }).getNextManagementNumber(shelf);
  }

  /**
   * 既存商品から指定プレフィックスの最大連番を取得（移行時のみ使用）
   * @param {string} prefix - プレフィックス（例: 'AA-'）
   * @returns {Promise<number>} 最大連番（見つからない場合は0）
   */
  async function scanExistingProductsForMigration(prefix) {
    try {
      console.log('🔍 [移行] 既存商品から最大番号をスキャン:', prefix);

      // Firestoreから全商品を取得
      const productsRef = window.db.collection('products');
      const snapshot = await productsRef.get();

      let maxNumber = 0;
      let matchCount = 0;

      // プレフィックスに一致する管理番号から最大の連番を探す
      snapshot.forEach(doc => {
        const data = doc.data();
        const managementNumber = data.managementNumber || '';

        // プレフィックスで始まるかチェック
        if (managementNumber.startsWith(prefix)) {
          matchCount++;
          // プレフィックス以降の部分を取得
          const suffix = managementNumber.substring(prefix.length);

          // 連番部分を抽出（数字のみ、ハイフン等の区切り文字を除外）
          const match = suffix.match(/^(\d+)/);
          if (match) {
            const number = parseInt(match[1], 10);
            if (!isNaN(number) && number > maxNumber) {
              maxNumber = number;
            }
          }
        }
      });

      console.log(`✅ [移行] スキャン完了: ${matchCount}件の商品から最大番号 ${maxNumber} を検出`);
      return maxNumber;

    } catch (error) {
      console.error('❌ [移行] スキャンエラー:', error);
      return 0;
    }
  }

  /**
   * カウンター方式で指定プレフィックスの次の連番を取得（プレビュー表示用）
   * @param {string} prefix - プレフィックス（例: 'AA-', 'AA-251119-'）
   * @param {number} startNum - 開始番号（設定値）
   * @returns {Promise<number>} 次の連番（カウンターは更新しない）
   */
  async function getNextSequenceNumber(prefix, startNum) {
    try {
      console.log('🔍 カウンター方式で次の番号を取得（プレビュー用）:', { prefix, startNum });

      // プレフィックスをFirestore ドキュメントIDに使える形式に変換（ハイフン等を除去）
      const counterKey = prefix.replace(/[^a-zA-Z0-9]/g, '_');
      console.log('📋 カウンターキー:', counterKey);

      const counterRef = window.db.collection('managementNumberCounters').doc(counterKey);
      const counterDoc = await counterRef.get();

      let nextNumber;

      if (counterDoc.exists) {
        // カウンターが存在する場合
        const currentNumber = counterDoc.data().currentNumber || 0;
        console.log('✅ 既存カウンター値:', currentNumber);

        // 既存の最大値と設定の開始番号を比較
        nextNumber = Math.max(currentNumber, startNum - 1) + 1;
        console.log('🔢 次の番号（プレビュー）:', nextNumber);
      } else {
        // カウンターが存在しない場合（初回）→ 既存商品をスキャンして移行
        console.log('⚡ カウンター初回作成 → 既存商品をスキャン');

        const maxFromProducts = await scanExistingProductsForMigration(prefix);
        console.log('📊 既存商品の最大番号:', maxFromProducts);

        // 既存商品の最大値と設定の開始番号を比較
        nextNumber = Math.max(maxFromProducts, startNum - 1) + 1;
        console.log('🔢 移行後の次の番号（プレビュー）:', nextNumber);
      }

      // ★ カウンター更新はしない（商品登録時に更新）
      console.log(`📌 カウンター未更新（商品登録時に確定）: ${counterKey}`);
      return nextNumber;

    } catch (error) {
      console.error('❌ カウンター取得エラー:', error);
      // エラー時は開始番号を返す
      return startNum;
    }
  }

  /**
   * 商品登録時に管理番号を確定してカウンターを更新
   * @param {string} managementNumber - 管理番号（例: 'AA-1015'）
   * @returns {Promise<boolean>} 成功/失敗
   */
  async function confirmManagementNumber(managementNumber) {
    try {
      console.log('🔒 管理番号確定処理開始:', managementNumber);

      // 1. 重複チェック
      const productsRef = window.db.collection('products');
      const duplicateCheck = await productsRef
        .where('managementNumber', '==', managementNumber)
        .limit(1)
        .get();

      if (!duplicateCheck.empty) {
        console.error('❌ 管理番号が重複しています:', managementNumber);
        alert('❌ この管理番号はすでに使用されています。\n\n番号を変更してから再度保存してください。');
        return false;
      }

      // 2. プレフィックスと連番を抽出
      const match = managementNumber.match(/^(.+?)(\d+)$/);
      if (!match) {
        console.warn('⚠️ 管理番号の形式が不正:', managementNumber);
        return true; // 形式が不正でもスキップ（手動入力を許容）
      }

      const prefix = match[1];
      const number = parseInt(match[2], 10);

      // 3. カウンター更新
      const counterKey = prefix.replace(/[^a-zA-Z0-9]/g, '_');
      const counterRef = window.db.collection('managementNumberCounters').doc(counterKey);

      await counterRef.set({
        currentNumber: number,
        prefix: prefix,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      console.log(`✅ カウンター確定: ${counterKey} = ${number}`);
      return true;

    } catch (error) {
      console.error('❌ 管理番号確定エラー:', error);
      alert('❌ 管理番号の確定処理でエラーが発生しました。\n\n' + error.message);
      return false;
    }
  }

  // グローバル公開（商品登録処理から呼び出せるように）
  window.confirmManagementNumber = confirmManagementNumber;

  // セグメント設定に基づいて管理番号を生成
  async function generateManagementNumber(segments, selectedShelf) {
    const parts = [];
    let counterKey = 'counter';  // カウンターキーの構築

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const config = segment.config || {};
      let value = '';

      switch (segment.type) {
        case 'shelf':
          // 棚番号：商品登録画面で選択された値を使用
          if (config.format === 'custom') {
            value = config.code || selectedShelf;
          } else {
            value = selectedShelf;  // 実際に選択された棚番号
          }
          counterKey += `_shelf_${value}`;
          break;

        case 'category':
          // カテゴリコード：固定値
          value = config.code || 'K';
          counterKey += `_category_${value}`;
          break;

        case 'date':
          // 登録日：現在日時をフォーマット
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');

          switch(config.format) {
            case 'YYYYMMDD':
              value = `${y}${m}${d}`;
              break;
            case 'YYMD':
              value = `${String(y).slice(2)}${parseInt(m)}${parseInt(d)}`;
              break;
            case 'YYMM':
              value = `${String(y).slice(2)}${m}`;
              break;
            default: // 'YYMMDD'
              value = `${String(y).slice(2)}${m}${d}`;
          }
          counterKey += `_date_${value}`;
          break;

        case 'rank':
          // 品質ランク：固定値
          value = config.value || 'A';
          counterKey += `_rank_${value}`;
          break;

        case 'size':
          // サイズコード：固定値
          value = config.code || 'M';
          counterKey += `_size_${value}`;
          break;

        case 'color':
          // 色コード：固定値
          value = config.code || 'DB';
          counterKey += `_color_${value}`;
          break;

        case 'custom':
          // カスタム固定値
          value = config.value || 'XXX';
          counterKey += `_custom_${value}`;
          break;

        case 'sequence':
          // 連番：カウンター方式で高速採番（O(1)）
          const digits = parseInt(config.digits) || 3;
          const startNum = parseInt(config.start) || 1;

          // プレフィックスを構築（連番セグメントより前の部分）
          const prefix = parts.join('');
          console.log('🔍 採番プレフィックス:', prefix);

          // カウンター方式で次の番号を取得（O(1)の高速アクセス）
          const newNumber = await getNextSequenceNumber(prefix, startNum);
          console.log('📊 次の番号:', newNumber);

          value = String(newNumber).padStart(digits, '0');
          console.log('✅ 連番生成:', { counterKey, prefix, value, newNumber });
          break;

        case 'sequence_legacy_old':
          // レガシー：既存商品データとFirestoreカウンターを参照（削除予定）
          const digitsOld = parseInt(config.digits) || 3;
          const startNumOld = parseInt(config.start) || 1;

          const prefixOld = parts.join('');
          const counterRefOld = window.db.collection('counters').doc(counterKey);
          const newNumberOld = await window.db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRefOld);
            let currentCount = 0;
            if (counterDoc.exists) {
              currentCount = counterDoc.data().count || 0;
            }

            const candidateNumber = Math.max(
              currentCount || 0,
              startNumOld - 1
            ) + 1;

            transaction.set(counterRefOld, {
              count: candidateNumber,
              key: counterKey,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            return candidateNumber;
          });

          value = String(newNumberOld).padStart(digitsOld, '0');
          console.log('✅ 連番生成（レガシー）:', { counterKey, prefixOld, value, newNumberOld });
          break;

        default:
          console.warn('⚠️ 未知のセグメントタイプ:', segment.type);
          value = '';
      }

      if (value) {
        parts.push(value);
        // 次のセグメントがある場合は区切り文字を追加
        if (i < segments.length - 1 && segment.separator) {
          parts.push(segment.separator);
        }
      }
    }

    const managementNumber = parts.join('');
    console.log('📝 管理番号生成完了:', { segments, counterKey, managementNumber });
    return managementNumber;
  }

  // 管理番号フィールドに値を設定
  function setManagementNumber(val, ph) {
    const el=document.getElementById('管理番号');
    if (!el) return;
    el.value=val||'';
    el.placeholder=ph||'';

    // 管理番号が変更されたら商品名プレビューも更新
    if (typeof updateNamePreview === 'function') {
      updateNamePreview();
    }
  }

  let NAME_REST_FIELDS = ['商品属性1_値'];

  // DOM要素キャッシュ
  const elementCache = new Map();

  function _val(id) {
    if (!elementCache.has(id)) {
      elementCache.set(id, document.getElementById(id));
    }
    const el = elementCache.get(id);
    return (el && (el.value||'').toString().trim()) || '';
  }

  // キャッシュクリア機能（必要時のため）
  function clearElementCache() {
    elementCache.clear();
  }

  function _truncateByCodePoints(str, limit) {
    const a = Array.from(str);
    return (a.length > limit) ? a.slice(0, limit).join('') : str;
  }

  function adjustPreviewHeight() {
    const ta = document.getElementById('商品名プレビュー');
    if (!ta) return;
    ta.classList.remove('scroll');
    ta.style.height = 'auto';
    const sh = ta.scrollHeight;
    const max = 140;
    if (sh > max) {
      ta.style.height = max + 'px';
      ta.classList.add('scroll');
    } else {
      ta.style.height = sh + 'px';
    }
  }

  /**
   * セールスワードに形式を適用
   */
  function applySaleswordFormat(salesword) {
    if (!salesword) return '';

    // ワード別オーバーライドを確認
    let prefix = SALESWORD_FORMAT.globalPrefix;
    let suffix = SALESWORD_FORMAT.globalSuffix;

    if (SALESWORD_FORMAT.wordOverrides) {
      const override = SALESWORD_FORMAT.wordOverrides.find(o => o.word === salesword);
      if (override) {
        prefix = override.prefix;
        suffix = override.suffix;
      }
    }

    return prefix + salesword + suffix;
  }

  // ========== 商品名ブロック並び替え機能 ==========

  /**
   * 商品名ブロックのドラッグ&ドロップを初期化（Sortable.js使用）
   * タッチデバイス（スマホ）でも動作するようになりました
   */
  function initTitleBlockDragDrop() {
    const container = document.getElementById('titleBlockContainer');
    if (!container) return;

    // Sortable.jsを使用してドラッグ&ドロップを初期化
    // タッチイベントに自動対応
    Sortable.create(container, {
      animation: 150,                    // アニメーション速度（ミリ秒）
      handle: '.drag-handle',            // ⋮⋮ アイコンのみでドラッグ
      ghostClass: 'sortable-ghost',      // ドラッグ中の要素に適用されるクラス
      chosenClass: 'sortable-chosen',    // 選択中の要素に適用されるクラス
      dragClass: 'sortable-drag',        // ドラッグ中の要素に適用されるクラス
      onEnd: function() {
        // ドロップ後に並び順を保存
        saveTitleBlockOrder();
        updateNamePreview();
      }
    });
  }

  /**
   * 現在の商品名ブロックの並び順を保存
   */
  function saveTitleBlockOrder() {
    const container = document.getElementById('titleBlockContainer');
    if (!container) return;

    const blocks = container.querySelectorAll('.title-draggable-block');
    TITLE_BLOCK_ORDER = Array.from(blocks).map(block => block.dataset.blockId);
    console.log('商品名ブロックの並び順を更新:', TITLE_BLOCK_ORDER);

    // 設定マスタに保存
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(result) {
          console.log('商品名ブロックの並び順を設定マスタに保存しました');
        })
        .withFailureHandler(function(error) {
          console.error('商品名ブロック並び順保存エラー:', error);
        })
        .saveTitleBlockOrder(TITLE_BLOCK_ORDER);
    }
  }

  /**
   * 保存された並び順でブロックを再配置
   */
  function applyTitleBlockOrder() {
    const container = document.getElementById('titleBlockContainer');
    if (!container || !TITLE_BLOCK_ORDER || TITLE_BLOCK_ORDER.length === 0) return;

    TITLE_BLOCK_ORDER.forEach(blockId => {
      const block = container.querySelector(`[data-block-id="${blockId}"]`);
      if (block) {
        container.appendChild(block);
      }
    });
  }

  /**
   * 両端が閉じた括弧で括られているかチェック
   * @param {string} text - チェックするテキスト
   * @returns {boolean} 両端が閉じた括弧で括られている場合true
   */
  function isBracketEnclosed(text) {
    if (!text || typeof text !== 'string') return false;

    // 両端が閉じている括弧のペアをチェック
    const pairs = [
      { start: '【', end: '】' },
      { start: '『', end: '』' },
      { start: '「', end: '」' },
      { start: '（', end: '）' },
      { start: '｜', end: '｜' }  // 縦棒は両端同じ
    ];

    return pairs.some(pair => text.startsWith(pair.start) && text.endsWith(pair.end));
  }

  /**
   * 商品名パーツをスマートに結合
   * 両端が閉じた括弧（【】『』「」（）｜｜）で括られている場合は前後のスペースを削除
   * @param {Array<string>} parts - 結合するパーツ配列
   * @returns {string} 結合された文字列
   */
  function smartJoinParts(parts) {
    if (!parts || parts.length === 0) return '';
    if (parts.length === 1) return parts[0];

    let result = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const prevPart = parts[i - 1];
      const currentPart = parts[i];

      // 前のパーツが両端閉じている、または現在のパーツが両端閉じている場合はスペースなし
      if (isBracketEnclosed(prevPart) || isBracketEnclosed(currentPart)) {
        result += currentPart;
      } else {
        result += ' ' + currentPart;
      }
    }

    return result;
  }

  /**
   * 商品名プレビューを更新
   * セールスワード、ブランド名、アイテム名、商品属性、管理番号を組み立てる
   * TITLE_BLOCK_ORDERの順序に従って表示
   * @throws {Error} 処理中にエラーが発生した場合
   */
  function updateNamePreview() {
    try {
      // 各ブロックの値を取得
      const kw = _val('セールスワード');
      const formattedKw = applySaleswordFormat(kw);

    // 商品名ブロック内のブランドを参照（どちらか片方でも可）
    const brandEn = _val('商品名_ブランド(英語)');
    const brandKana = _val('商品名_ブランド(カナ)');

    // チェックボックスの状態を確認
    const brandEnCheckbox = document.getElementById('商品名_ブランド(英語)_チェック');
    const brandKanaCheckbox = document.getElementById('商品名_ブランド(カナ)_チェック');
    const useBrandEn = brandEnCheckbox && brandEnCheckbox.checked && brandEn;
    const useBrandKana = brandKanaCheckbox && brandKanaCheckbox.checked && brandKana;

    // ブランド名の構築（カナの前に半角スペース）
    let brands = '';
    if (useBrandEn && useBrandKana) {
      brands = brandEn + ' ' + brandKana;
    } else if (useBrandEn) {
      brands = brandEn;
    } else if (useBrandKana) {
      brands = brandKana;
    }

    // 商品名ブロック内のアイテム名（編集可能）
    const itemNameInTitle = _val('商品名_アイテム名');
    const others = NAME_REST_FIELDS.map(_val).filter(Boolean);

    // 並び順に基づいて商品名を構築
    const parts = [];
    TITLE_BLOCK_ORDER.forEach(blockId => {
      if (blockId === 'salesword' && formattedKw) {
        parts.push(formattedKw);
      } else if (blockId === 'brand' && brands) {
        parts.push(brands);
      } else if (blockId === 'item' && itemNameInTitle) {
        // 商品名ブロック内のアイテム名を使用
        parts.push(itemNameInTitle);
      } else if (blockId === 'attribute') {
        // 商品属性のみを追加（アイテム名は含めない）
        if (others.length) parts.push(...others);
      }
    });

    let text = smartJoinParts(parts);

    // 管理番号を商品名に追加（localStorageの設定に基づく）
    try {
      const saved = localStorage.getItem('managementNumberPlacement');
      console.log('🔍 商品名生成: localStorage取得結果:', saved);

      if (saved) {
        const settings = JSON.parse(saved);
        console.log('📋 商品名生成: 管理番号配置設定:', settings);

        if (settings.inTitle) {
          const mgmtNumber = _val('管理番号');
          console.log('🔢 商品名生成: 管理番号フィールド値:', mgmtNumber);

          if (mgmtNumber) {
            const format = settings.format || '【】';
            let formattedMgmtNumber = '';

            switch (format) {
              case '【】':
                formattedMgmtNumber = `【${mgmtNumber}】`;
                break;
              case '（）':
              case '()':  // 旧形式との互換性
                formattedMgmtNumber = `（${mgmtNumber}）`;
                break;
              case '『』':
                formattedMgmtNumber = `『${mgmtNumber}』`;
                break;
              case '「」':
                formattedMgmtNumber = `「${mgmtNumber}」`;
                break;
              case '｜｜':
                formattedMgmtNumber = `｜${mgmtNumber}｜`;
                break;
              case '｜':
                formattedMgmtNumber = `｜${mgmtNumber}`;
                break;
              case '-':
                formattedMgmtNumber = `- ${mgmtNumber}`;
                break;
              case 'none':
                formattedMgmtNumber = mgmtNumber;
                break;
              default:
                formattedMgmtNumber = `【${mgmtNumber}】`;
            }

            console.log('✅ 商品名に管理番号を追加:', formattedMgmtNumber);

            // 配置位置に応じて管理番号を追加
            const position = settings.position || 'end';
            console.log('📍 管理番号配置位置:', position);

            if (text) {
              // 両端閉じている場合はスペースなし、それ以外はスペースあり
              const needsSpace = !isBracketEnclosed(formattedMgmtNumber);

              if (position === 'start') {
                // 先頭に配置
                text = needsSpace ? `${formattedMgmtNumber} ${text}` : `${formattedMgmtNumber}${text}`;
              } else {
                // 後ろに配置（デフォルト）
                text = needsSpace ? `${text} ${formattedMgmtNumber}` : `${text}${formattedMgmtNumber}`;
              }
            } else {
              text = formattedMgmtNumber;
            }
          } else {
            console.log('⚠️ 管理番号フィールドが空です');
          }
        } else {
          console.log('⏭️ 商品名への管理番号配置がOFFです');
        }
      } else {
        console.log('⚠️ localStorageに管理番号配置設定がありません');
      }
    } catch (e) {
      console.error('❌ 管理番号配置設定の読み込みエラー:', e);
    }

    const count = Array.from(text).length;
    const counterEl = document.getElementById('nameCounter');
    const nameCountEl = document.getElementById('nameCount');
    const nameMaxEl = document.getElementById('nameMax');
    if (nameCountEl) nameCountEl.textContent = count;
    if (nameMaxEl) nameMaxEl.textContent = NAME_LIMIT;
    if (counterEl) counterEl.classList.toggle('over', count > NAME_LIMIT);
    let saveText = text;
    if (NAME_LIMIT_MODE === 'truncate' && count > NAME_LIMIT) {
      saveText = _truncateByCodePoints(text, NAME_LIMIT);
    }
    const ta = document.getElementById('商品名プレビュー');
    if (ta) {
      ta.value = text;
      adjustPreviewHeight();
    }
      const hidden = document.getElementById('商品名(タイトル)');
      if (hidden) hidden.value = saveText;

      // 形式選択が変更された場合も設定を保存
      saveManagementNumberPlacementSettings();
    } catch (error) {
      console.error('商品名プレビュー更新エラー:', error);
      debug.error('updateNamePreview エラー:', error);
    }
  }

  // 管理番号配置設定を保存
  function saveManagementNumberPlacementSettings() {
    const titleCheckbox = document.getElementById('商品名に管理番号配置');
    const descCheckbox = document.getElementById('説明文に管理番号配置');
    const formatSelect = document.getElementById('管理番号形式');
    const positionSelect = document.getElementById('管理番号配置位置');
    const descFormatSelect = document.getElementById('説明文管理番号形式');
    const descPositionSelect = document.getElementById('説明文管理番号配置位置');

    // チェックボックスが存在しない場合は保存しない（設定画面専用の要素のため）
    if (!titleCheckbox && !descCheckbox && !formatSelect && !positionSelect && !descFormatSelect && !descPositionSelect) {
      console.log('⏭️ 管理番号配置チェックボックスが存在しないため、設定を保存しません');
      return;
    }

    const settings = {
      inTitle: titleCheckbox ? titleCheckbox.checked : false,
      inDesc: descCheckbox ? descCheckbox.checked : false,
      format: formatSelect ? formatSelect.value : '【】',
      position: positionSelect ? positionSelect.value : 'end',
      descFormat: descFormatSelect ? descFormatSelect.value : '【】',
      descPosition: descPositionSelect ? descPositionSelect.value : 'bottom'
    };

    try {
      localStorage.setItem('managementNumberPlacement', JSON.stringify(settings));
      console.log('💾 管理番号配置設定を保存:', settings);
    } catch (e) {
      console.warn('LocalStorage保存エラー:', e);
    }
  }

  /**
   * 管理番号設定変更時のハンドラー
   * 設定を保存してメインの商品名プレビューを更新
   */
  function onManagementNumberSettingChange() {
    // 設定を保存
    saveManagementNumberPlacementSettings();
    // メインプレビューを更新
    updateNamePreview();
  }

  // 管理番号フィールドの変更を監視して説明文を更新
  function setupManagementNumberObserver() {
    const mgmtNumberField = document.getElementById('管理番号');
    
    if (!mgmtNumberField) {
      console.log('⚠️ 管理番号フィールドが見つかりません');
      return;
    }

    console.log('👁️ 管理番号フィールドの監視を開始');

    // 値の変更を検出するためのMutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
          const newValue = mgmtNumberField.value;
          console.log('🔔 管理番号フィールドの値が変更されました:', newValue);
          
          // 説明文を更新
          if (typeof updateDescriptionFromDetail === 'function') {
            console.log('📝 説明文を再生成します');
            updateDescriptionFromDetail();
          }
          
          // 商品名も更新
          if (typeof updateNamePreview === 'function') {
            updateNamePreview();
          }
        }
      });
    });

    // value属性の変更を監視
    observer.observe(mgmtNumberField, {
      attributes: true,
      attributeFilter: ['value']
    });

    // input/changeイベントでも監視（手動入力の場合）
    mgmtNumberField.addEventListener('input', () => {
      const newValue = mgmtNumberField.value;
      console.log('⌨️ 管理番号フィールドが入力されました:', newValue);
      
      if (typeof updateDescriptionFromDetail === 'function') {
        console.log('📝 説明文を再生成します（input）');
        updateDescriptionFromDetail();
      }
      
      if (typeof updateNamePreview === 'function') {
        updateNamePreview();
      }
    });

    // より確実に検出するため、定期的にチェック
    let lastValue = mgmtNumberField.value;
    setInterval(() => {
      const currentValue = mgmtNumberField.value;
      if (currentValue !== lastValue) {
        console.log('🔄 管理番号フィールドの値が変更されました（ポーリング）:', currentValue);
        lastValue = currentValue;
        
        if (typeof updateDescriptionFromDetail === 'function') {
          console.log('📝 説明文を再生成します（ポーリング）');
          updateDescriptionFromDetail();
        }
        
        if (typeof updateNamePreview === 'function') {
          updateNamePreview();
        }
      }
    }, 500); // 500msごとにチェック
  }

  // PropertiesServiceから管理番号配置設定をlocalStorageに読み込む
  function loadManagementNumberPlacementFromServer() {
    console.log('🔄 PropertiesServiceから管理番号配置設定を読み込み中...');
    console.log('google:', typeof google);
    console.log('google.script:', typeof google !== 'undefined' ? typeof google.script : 'undefined');
    console.log('google.script.run:', typeof google !== 'undefined' && google.script ? typeof google.script.run : 'undefined');

    if (typeof google !== 'undefined' && google.script && google.script.run) {
      console.log('✅ google.script.run利用可能、loadConfigMaster呼び出し開始');
      google.script.run
        .withSuccessHandler(function(config) {
          console.log('📦 loadConfigMaster成功、config:', config);
          if (config && config.管理番号設定) {
            const mgmtConfig = config.管理番号設定;
            console.log('📋 管理番号設定取得:', mgmtConfig);

            // PropertiesServiceに配置設定が保存されているか確認
            const hasPlacementSettings =
              mgmtConfig.showInTitle !== undefined ||
              mgmtConfig.showInDescription !== undefined ||
              mgmtConfig.titleFormat !== undefined;

            if (hasPlacementSettings) {
              // PropertiesServiceに配置設定がある場合のみ上書き
              const settings = {
                inTitle: mgmtConfig.showInTitle || false,
                inDesc: mgmtConfig.showInDescription || false,
                format: mgmtConfig.titleFormat || '【】'
              };

              try {
                localStorage.setItem('managementNumberPlacement', JSON.stringify(settings));
                console.log('✅ PropertiesServiceから管理番号配置設定を取得し、localStorageに保存:', settings);

                // 設定をチェックボックスに反映（存在する場合のみ）
                restoreManagementNumberPlacementSettings();

                // 商品名と説明文を更新
                updateNamePreview();
                if (typeof updateDescriptionFromDetail === 'function') {
                  updateDescriptionFromDetail();
                }
              } catch (e) {
                console.error('❌ localStorage保存エラー:', e);
              }
            } else {
              console.log('⚠️ PropertiesServiceに管理番号配置設定が保存されていません。localStorageの設定を維持します。');
              console.log('現在のlocalStorage設定:', localStorage.getItem('managementNumberPlacement'));
            }
          } else {
            console.log('⚠️ PropertiesServiceに管理番号配置設定が存在しません。config:', config);
          }
        })
        .withFailureHandler(function(error) {
          console.error('❌ PropertiesServiceからの読み込みエラー:', error);
        })
        .loadConfigMaster();
    } else {
      console.warn('⚠️ google.script.runが利用できません');
    }
  }

  // 管理番号配置設定を復元（localStorageからチェックボックスに反映）
  function restoreManagementNumberPlacementSettings() {
    try {
      const saved = localStorage.getItem('managementNumberPlacement');
      if (!saved) {
        console.log('⏭️ localStorageに管理番号配置設定がありません');
        return;
      }

      const settings = JSON.parse(saved);
      console.log('📋 localStorageから管理番号配置設定を復元:', settings);

      const titleCheckbox = document.getElementById('商品名に管理番号配置');
      const descCheckbox = document.getElementById('説明文に管理番号配置');
      const formatSelect = document.getElementById('管理番号形式');
      const positionSelect = document.getElementById('管理番号配置位置');
      const formatSelector = document.getElementById('管理番号形式選択');

      if (titleCheckbox) titleCheckbox.checked = settings.inTitle || false;
      if (descCheckbox) descCheckbox.checked = settings.inDesc || false;
      if (formatSelect) formatSelect.value = settings.format || '【】';
      if (positionSelect) positionSelect.value = settings.position || 'end';

      // 形式選択の表示/非表示を更新
      if (formatSelector && titleCheckbox) {
        formatSelector.style.display = titleCheckbox.checked ? 'block' : 'none';
      }
    } catch (e) {
      console.warn('LocalStorage読み込みエラー:', e);
    }
  }

  // 管理番号配置オプションの表示切り替え
  function toggleManagementNumberOptions() {
    const titleCheckbox = document.getElementById('商品名に管理番号配置');
    const descCheckbox = document.getElementById('説明文に管理番号配置');
    const formatSelector = document.getElementById('管理番号形式選択');

    // 商品名チェックボックスがONの時だけ形式選択を表示
    if (formatSelector) {
      if (titleCheckbox && titleCheckbox.checked) {
        formatSelector.style.display = 'block';
      } else {
        formatSelector.style.display = 'none';
      }
    }

    // 設定の保存は「保存」ボタン押下時に行う

    // 商品名プレビューを更新
    updateNamePreview();

    // 商品の説明プレビューを更新
    if (typeof updateDescriptionFromDetail === 'function') {
      updateDescriptionFromDetail();
    }
  }

  // アイテム名表示フィールドの更新（基本情報→商品名ブロックへ自動反映）
  function updateItemNameDisplay() {
    try {
      console.log('★★★ updateItemNameDisplay() が呼ばれました');
      const basicItemName = _val('アイテム名');
      const titleItemField = document.getElementById('商品名_アイテム名');

      if (titleItemField && basicItemName) {
        titleItemField.value = basicItemName;
        updateNamePreview();
      }

      // === 中分類に応じてサイズセクションを切り替え ===
      const chuBunrui = _val('中分類(カテゴリ)');
      console.log(`★★★ 中分類を取得しました: "${chuBunrui}"`);
      updateSizeSectionDisplay(chuBunrui);
    } catch (error) {
      console.error('updateItemNameDisplay エラー:', error);
      // エラーが起きても処理を続行
    }
  }

  // ブランド表示フィールドの更新（基本情報→商品名ブロックへ自動反映）
  let updateBrandDisplayTimeout = null;
  function updateBrandDisplay() {
    // デバウンス処理: 300ms待ってから実行
    clearTimeout(updateBrandDisplayTimeout);
    updateBrandDisplayTimeout = setTimeout(() => {
      const englishName = _val('ブランド(英語)');
      const englishField = document.getElementById('商品名_ブランド(英語)');
      const kanaField = document.getElementById('商品名_ブランド(カナ)');
      const basicKanaField = document.getElementById('ブランド(カナ)');

      if (!englishField || !kanaField) return;

      if (englishName) {
        // 完全一致するブランドのみセット（途中の文字列では反応しない）
        const pairIndex = BRAND_INDEX_MAP.get(englishName);

        if (pairIndex !== undefined && BRAND_PAIRS[pairIndex]) {
          const kanaName = BRAND_PAIRS[pairIndex].kana;

          englishField.value = englishName;
          kanaField.value = kanaName;

          // 基本情報ブロックの隠しフィールドにもカナ読みを設定
          if (basicKanaField) {
            basicKanaField.value = kanaName;
            console.log(`基本情報ブランド(カナ)に設定: "${kanaName}"`);
          }

          // 商品名プレビューを更新
          updateNamePreview();
        }
      } else {
        // 空の場合はクリア
        englishField.value = '';
        kanaField.value = '';
        englishField.placeholder = '入力すると候補が表示されます';
        kanaField.placeholder = '入力すると候補が表示されます';

        // 基本情報ブロックの隠しフィールドもクリア
        if (basicKanaField) {
          basicKanaField.value = '';
        }

        // 商品名プレビューを更新
        updateNamePreview();
      }
    }, 300);
  }

  function wirePreviewWatchers() {
    const ids = new Set(['セールスワード','ブランド(英語)','アイテム名','セールスワード(カテゴリ)',
  '商品名_ブランド(英語)', '商品名_ブランド(カナ)', ...NAME_REST_FIELDS]);
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if (!el) return;
      const ev = (el.tagName === 'INPUT') ? 'input' : 'change';

      // 既存のイベントリスナーを削除してから追加
      el.removeEventListener(ev, updateNamePreview);
      el.addEventListener(ev, updateNamePreview);

      // 基本情報のブランド(英語)の場合はブランド表示と商品説明も更新
      if (id === 'ブランド(英語)') {
        el.removeEventListener(ev, updateBrandDisplay);
        el.addEventListener(ev, updateBrandDisplay);
        el.removeEventListener(ev, updateDescriptionFromDetail);
        el.addEventListener(ev, updateDescriptionFromDetail);
      }
    });
  }

  function adjustDescHeight() {
    // この関数は autoResizeTextarea() に置き換えられました
    const ta = document.getElementById('商品の説明');
    if (!ta) return;
    autoResizeTextarea(ta);
  }

  function updateDesc() {
    const ta = document.getElementById('商品の説明');
    if (!ta) return;
    const text = (ta.value || '').toString();
    const count = Array.from(text).length;
    const counterEl = document.getElementById('descCounter');
    const descCountEl = document.getElementById('descCount');
    const descMaxEl = document.getElementById('descMax');
    if (descCountEl) descCountEl.textContent = count;
    if (descMaxEl) descMaxEl.textContent = DESC_LIMIT;
    if (counterEl) counterEl.classList.toggle('over', count > DESC_LIMIT);
    if (DESC_LIMIT_MODE === 'truncate' && count > DESC_LIMIT) {
      ta.value = Array.from(text).slice(0, DESC_LIMIT).join('');
    }
    adjustDescHeight();
  }

  function wireDescWatcher() {
    const ta = document.getElementById('商品の説明');
    if (!ta) return;
    ta.addEventListener('input', updateDesc);
  }

  // ブランド情報取得関数
  function getBrandInfo() {
    const englishName = _val('ブランド(英語)');
    if (!englishName) return '';

    // Firestore版対応: ブランド(カナ)フィールドから直接取得
    const kanaName = _val('ブランド(カナ)') || '';
    return `ブランド名：${englishName}（${kanaName}）

`;
  }

  // サイズ情報取得関数
  function getSizeInfo() {
    // サイズ(表記)を取得（服または靴）
    const sizeHyoki = _val('サイズ(表記)_トップス') || _val('サイズ(表記)_ボトムス') || _val('サイズ(表記)_靴');

    // 靴の追加情報を取得
    const shoesOtherSize = _val('その他のサイズ表記_靴');
    const shoesUsualSize = _val('普段のサイズ_靴');
    const shoesFit = _val('フィット感_靴');

    // ラグラン判定
    const itemName = _val('アイテム名');
    const isRaglan = itemName && itemName.includes('ラグラン');
    const shoulderLabel = isRaglan ? '裄丈' : '肩幅';

    // サイズ(実寸)を取得
    const sizeValues = {
      肩幅: _val('肩幅'),
      身幅: _val('身幅'),
      袖丈: _val('袖丈'),
      着丈: _val('着丈'),
      ウエスト: _val('ウエスト'),
      ヒップ: _val('ヒップ'),
      股上: _val('股上'),
      股下: _val('股下')
    };

    // 靴または服のサイズ情報があるか確認
    const hasShoesSizeData = sizeHyoki && (_val('サイズ(表記)_靴') !== '');
    const hasClothesSizeData = sizeHyoki && (Object.values(sizeValues).some(value => value) || _val('サイズ(表記)_トップス') || _val('サイズ(表記)_ボトムス'));

    if (!sizeHyoki && !shoesOtherSize && !shoesUsualSize && !shoesFit) return '';

    let sizeText = '';

    // サイズ(表記)セクション
    if (sizeHyoki) {
      sizeText += `サイズ(表記)：${sizeHyoki}\n`;
    }

    // 靴の場合の追加情報
    if (hasShoesSizeData || shoesOtherSize || shoesUsualSize || shoesFit) {
      if (shoesOtherSize) {
        sizeText += `その他のサイズ表記：${shoesOtherSize}\n`;
      }
      if (shoesUsualSize) {
        sizeText += `普段のサイズ：${shoesUsualSize}\n`;
      }
      if (shoesFit) {
        sizeText += `フィット感：${shoesFit}\n`;
      }
      sizeText += '\n';
      return sizeText; // 靴の場合は実寸サイズを表示しない
    }

    // 服の場合のみ実寸サイズを表示
    if (sizeHyoki) {
      sizeText += '\n';
    }

    // サイズ(実寸)セクション
    const hasJissunData = Object.values(sizeValues).some(value => value);
    if (hasJissunData) {
      sizeText += '【サイズ(実寸)】\n';
      if (sizeValues.肩幅) sizeText += `${shoulderLabel}：${sizeValues.肩幅}cm\n`;
      if (sizeValues.身幅) sizeText += `身幅：${sizeValues.身幅}cm\n`;
      if (sizeValues.袖丈) sizeText += `袖丈：${sizeValues.袖丈}cm\n`;
      if (sizeValues.着丈) sizeText += `着丈：${sizeValues.着丈}cm\n`;
      if (sizeValues.ウエスト) sizeText += `ウエスト：${sizeValues.ウエスト}cm\n`;
      if (sizeValues.ヒップ) sizeText += `ヒップ：${sizeValues.ヒップ}cm\n`;
      if (sizeValues.股上) sizeText += `股上：${sizeValues.股上}cm\n`;
      if (sizeValues.股下) sizeText += `股下：${sizeValues.股下}cm\n`;
      sizeText += '\n';
    }

    return sizeText;
  }

  // 素材情報取得関数
  function getMaterialInfo() {
    let materialText = '';
    const items = document.querySelectorAll('.material-item');

    items.forEach((item, i) => {
      const index = i + 1;
      const location = _val(`素材${index}_箇所`);
      const type1 = _val(`素材${index}_種類1`);
      const percent1 = _val(`素材${index}_％1`);
      const type2 = _val(`素材${index}_種類2`);
      const percent2 = _val(`素材${index}_％2`);

      if (location && type1) {
        materialText += `${location}: ${type1}`;
        if (percent1) materialText += ` ${percent1}%`;
        if (type2) {
          materialText += `, ${type2}`;
          if (percent2) materialText += ` ${percent2}%`;
        }
        materialText += '\n';
      }
    });

    if (materialText) {
      materialText = '【素材】\n' + materialText + '\n';
    }

    return materialText;
  }

  function getColorInfo() {
    const items = document.querySelectorAll('.color-item');
    const colors = [];

    items.forEach((item, i) => {
      const index = i + 1;
      const colorValue = _val(`カラー${index}`);
      if (colorValue) {
        colors.push(colorValue);
      }
    });

    if (colors.length > 0) {
      return 'カラー(詳細)：' + colors.join('、') + '\n\n';
    }

    return '';
  }

  /**
   * 配置順序に従って商品説明を組み立てる
   * @param {Object} elements - 各要素のテキスト（brand, color, size, material, condition, ai, management, discount, hashtag）
   * @param {HTMLTextAreaElement} descTextarea - 説明文を表示するテキストエリア
   */
  function buildDescriptionByOrder(elements, descTextarea, managementNumberPosition) {
    console.log('buildDescriptionByOrder 関数が呼び出されました');

    // 管理番号は位置ベースで配置するため、通常の順序からは除外
    const managementContent = elements.management;
    const elementsWithoutManagement = Object.assign({}, elements);
    delete elementsWithoutManagement.management;

    // 1. AI生成設定から配置順序を取得（設定画面で管理可能）
    let order = [];
    try {
      const aiSettings = localStorage.getItem('rebornConfig_aiSettings');
      if (aiSettings) {
        const settings = JSON.parse(aiSettings);
        if (settings.descriptionOrder && Array.isArray(settings.descriptionOrder)) {
          // 設定画面で保存された配置順序を使用（管理番号を除外）
          order = settings.descriptionOrder
            .filter(item => item.id !== 'management')  // 管理番号を除外
            .map(item => ({
              id: item.id === 'ai' ? 'aiGeneration' : item.id,
              enabled: item.enabled !== false
            }));
          console.log('AI生成設定から配置順序を取得（管理番号除外）:', order);
        }
      }
    } catch (e) {
      console.error('配置順序の読み込みエラー:', e);
    }

    // 2. 配置順序が取得できない場合は、HTML要素の実際の順序を使用
    if (order.length === 0) {
      const actualBlocksOrder = getDescriptionBlocksOrder();
      console.log('実際のブロック順序:', actualBlocksOrder);

      const blockTypeToElementId = {
        'brandName': 'brand',
        'size': 'size',
        'color': 'color',
        'condition': 'condition',
        'material': 'material',
        'aiGeneration': 'aiGeneration',
        'discount': 'discount',
        'hashtag': 'hashtag'
      };

      if (actualBlocksOrder.length > 0) {
        order = actualBlocksOrder.map(blockType => ({
          id: blockTypeToElementId[blockType] || blockType,
          enabled: true
        }));
        console.log('実際のブロック順序から配置順序を生成:', order);
      } else {
        // フォールバック: デフォルト順序（管理番号なし）
        order = [
          { id: 'brand', enabled: true },
          { id: 'size', enabled: true },
          { id: 'color', enabled: true },
          { id: 'condition', enabled: true },
          { id: 'material', enabled: true },
          { id: 'aiGeneration', enabled: true },
          { id: 'discount', enabled: true },
          { id: 'hashtag', enabled: true }
        ];
        console.log('デフォルト順序を使用');
      }
    }

    // 3. 配置順序に従って説明文を組み立て
    const parts = [];

    for (const item of order) {
      // 無効化されている要素はスキップ
      if (item.enabled === false) {
        console.log(`要素 ${item.id} は無効化されているためスキップ`);
        continue;
      }

      // 要素の内容を取得
      const content = elementsWithoutManagement[item.id];
      if (content && content.trim()) {
        parts.push(content.trim());
        console.log(`要素 ${item.id} を追加`);
      } else {
        console.log(`要素 ${item.id} は空のためスキップ`);
      }
    }

    // 4. 管理番号を指定位置に挿入
    if (managementContent && managementContent.trim()) {
      const position = managementNumberPosition || 'middle';

      if (position === 'top') {
        // 先頭（ブランド名の上、最初の位置）
        parts.unshift(managementContent.trim());
        console.log('✅ 管理番号を先頭（ブランド名の上）に配置');
      } else if (position === 'bottom') {
        // 末尾（ハッシュタグの下、最後の位置）
        parts.push(managementContent.trim());
        console.log('✅ 管理番号を末尾（ハッシュタグの下）に配置');
      } else {
        // 中（商品情報の下）
        // brand, size, color, condition, material の後に挿入
        const productInfoIds = ['brand', 'size', 'color', 'condition', 'material'];
        let insertIndex = 0;

        // parts配列の中で最後の商品情報要素の位置を見つける
        for (let i = parts.length - 1; i >= 0; i--) {
          // この部分の元IDを特定するために、order配列を参照
          let elementId = null;
          let partIndex = 0;
          for (const item of order) {
            if (item.enabled !== false) {
              const content = elementsWithoutManagement[item.id];
              if (content && content.trim()) {
                if (partIndex === i) {
                  elementId = item.id;
                  break;
                }
                partIndex++;
              }
            }
          }

          if (elementId && productInfoIds.includes(elementId)) {
            insertIndex = i + 1;
            break;
          }
        }

        parts.splice(insertIndex, 0, managementContent.trim());
        console.log(`✅ 管理番号を中（商品情報の下、インデックス ${insertIndex}）に配置`);
      }
    }

    // 5. 全要素を結合（2行の空行で区切る）
    const finalText = parts.join('\n\n');
    descTextarea.value = finalText;

    console.log('商品説明を配置順序に従って生成しました:', finalText.length, '文字');

    // 6. UIを更新
    if (typeof updateDesc === 'function') {
      updateDesc();
    }
    autoResizeTextarea(descTextarea);
  }

  // ================= 画像アップロード機能 =================

  // アップロードされた画像を保存する配列
  let uploadedImages = [];

  /**
   * 画像アップロード処理
   * @param {Event} event - ファイル選択イベント
   */
  function handleImageUpload(event) {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    // 既存の画像数と新規画像数の合計が3を超える場合は警告
    if (uploadedImages.length + files.length > 3) {
      alert('AI生成用の画像は最大3枚までアップロードできます');
      return;
    }

    // 各ファイルをBase64に変換
    Array.from(files).forEach((file, index) => {
      // ファイルサイズチェック（10MB制限）
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name}のサイズが大きすぎます（最大10MB）`);
        return;
      }

      // 画像ファイルかチェック
      if (!file.type.startsWith('image/')) {
        alert(`${file.name}は画像ファイルではありません`);
        return;
      }

      const reader = new FileReader();

      reader.onload = function(e) {
        const base64Data = e.target.result;

        uploadedImages.push({
          name: file.name,
          data: base64Data,
          mimeType: file.type
        });

        // プレビューを更新
        displayImagePreviews();

        debug.log(`画像をアップロードしました: ${file.name}`);
      };

      reader.onerror = function(error) {
        console.error('画像の読み込みに失敗しました:', error);
        alert(`${file.name}の読み込みに失敗しました`);
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * 画像プレビューを表示
   */
  function displayImagePreviews() {
    const container = document.getElementById('imagePreviewContainer');
    const list = document.getElementById('imagePreviewList');
    const count = document.getElementById('imageCount');

    if (!container || !list || !count) {
      console.error('プレビュー要素が見つかりません');
      return;
    }

    // 画像がない場合は非表示
    if (uploadedImages.length === 0) {
      container.style.display = 'none';
      return;
    }

    // 画像がある場合は表示
    container.style.display = 'block';
    count.textContent = uploadedImages.length;

    // プレビューリストをクリア
    list.innerHTML = '';

    // 各画像のプレビューを作成
    uploadedImages.forEach((image, index) => {
      const previewItem = document.createElement('div');
      previewItem.style.cssText = 'position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 2px solid #e5e7eb;';

      previewItem.innerHTML = `
        <img src="${image.data}" alt="${image.name}" style="width: 100%; height: 100%; object-fit: cover;">
        <button
          type="button"
          onclick="removeImage(${index})"
          style="position: absolute; top: 4px; right: 4px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;"
          title="削除"
        >×</button>
      `;

      list.appendChild(previewItem);
    });
  }

  /**
   * 画像を削除
   * @param {number} index - 削除する画像のインデックス
   */
  function removeImage(index) {
    uploadedImages.splice(index, 1);
    displayImagePreviews();
    debug.log(`画像を削除しました (index: ${index})`);
  }

  /**
   * アップロードされた画像を取得
   * @returns {Array} Base64画像データの配列
   */
  function getUploadedImages() {
    return uploadedImages.map(img => ({
      data: img.data.split(',')[1], // Base64部分のみ（data:image/png;base64,を除く）
      mimeType: img.mimeType
    }));
  }

  /**
   * 画像を自動リサイズ（横幅800px、JPEG品質70%）
   * @param {string} base64Data - 元のBase64画像データ
   * @param {string} fileName - ファイル名
   * @returns {Promise<string>} リサイズ後のBase64データ
   */
  function resizeImage(base64Data, fileName) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = function() {
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        // 横幅が800pxより大きい場合のみリサイズ
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        // Canvasでリサイズ
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG品質70%で再エンコード
        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.7);

        debug.log(`画像リサイズ完了: ${fileName} (${img.width}x${img.height} → ${width}x${height})`);
        resolve(resizedBase64);
      };

      img.onerror = function() {
        console.error('画像の読み込みに失敗しました:', fileName);
        reject(new Error('画像の読み込みに失敗しました'));
      };

      img.src = base64Data;
    });
  }

  // ================= 商品画像ブロック（Google Drive保存用） =================

  // 商品画像を保存する配列（最大20枚）
  let productImages = [];

  /**
   * ページ読み込み時に設定を確認して、商品画像ブロックの表示/非表示を切り替え
   */
  function checkProductImageBlockVisibility() {
    const block = document.getElementById('productImagesBlock');

    // まずlocalStorageから読み込み（高速表示）
    const localStorageValue = localStorage.getItem('enableProductImageSave');
    let enabled = localStorageValue === 'true';

    console.log('🔍 商品画像ブロック表示チェック:');
    console.log('  - localStorage値:', localStorageValue);
    console.log('  - 有効:', enabled);
    console.log('  - ブロック要素:', block ? '存在' : '見つからない');

    // UIを即座に更新
    if (block) {
      block.style.display = enabled ? '' : 'none';
      console.log('  - 表示状態:', enabled ? '表示' : '非表示');
    } else {
      console.error('❌ productImagesBlock要素が見つかりません');
      return;
    }

    // バックグラウンドでサーバーから読み込み（iOS/スマホ対応・バックアップ復元）
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(serverEnabled) {
          console.log('📥 [商品登録画面] サーバーから読み込み:', serverEnabled);

          // サーバーの値とlocalStorageの値が異なる場合は同期
          if (serverEnabled !== enabled) {
            console.log('⚠️ サーバーとlocalStorageの値が異なるため同期します');
            enabled = serverEnabled;

            // localStorageを更新
            try {
              localStorage.setItem('enableProductImageSave', enabled.toString());
            } catch (e) {
              console.warn('localStorage更新エラー（iOS/スマホでは制限される場合があります）');
            }

            // UIを更新
            if (block) {
              block.style.display = enabled ? '' : 'none';
              console.log('  - 同期後の表示状態:', enabled ? '表示' : '非表示');
            }
          }
        })
        .withFailureHandler(function(error) {
          console.error('❌ サーバーからの読み込みエラー:', error);
        })
        .loadImageSettingFromServer();
    }
  }

  /**
   * 商品画像アップロード処理
   * @param {Event} event - ファイル選択イベント
   */
  async function handleProductImageUpload(event) {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    // 既存の画像数と新規画像数の合計が20を超える場合は警告
    if (productImages.length + files.length > 20) {
      alert('商品画像は最大20枚までアップロードできます');
      return;
    }

    // 各ファイルを並列処理するPromise配列を作成
    const processPromises = Array.from(files).map((file) => {
      return new Promise(async (resolve, reject) => {
        // ファイルサイズチェック（10MB制限）
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name}のサイズが大きすぎます（最大10MB）`);
          reject(new Error('File too large'));
          return;
        }

        // 画像ファイルかチェック
        if (!file.type.startsWith('image/')) {
          alert(`${file.name}は画像ファイルではありません`);
          reject(new Error('Not an image file'));
          return;
        }

        const reader = new FileReader();

        reader.onload = async function(e) {
          const base64Data = e.target.result;

          try {
            // 画像を自動リサイズ
            const resizedBase64 = await resizeImage(base64Data, file.name);

            resolve({
              name: file.name,
              data: resizedBase64,
              mimeType: 'image/jpeg' // リサイズ後はJPEGになる
            });

            debug.log(`商品画像をアップロードしました（リサイズ済み）: ${file.name}`);
          } catch (error) {
            console.error('画像のリサイズに失敗しました:', error);
            alert(`${file.name}の処理に失敗しました`);
            reject(error);
          }
        };

        reader.onerror = function(error) {
          console.error('画像の読み込みに失敗しました:', error);
          alert(`${file.name}の読み込みに失敗しました`);
          reject(error);
        };

        reader.readAsDataURL(file);
      });
    });

    try {
      // 全ての画像を並列処理
      const processedImages = await Promise.all(processPromises);

      // 成功した画像のみを追加
      productImages.push(...processedImages.filter(img => img != null));

      // プレビューを一度だけ更新
      displayProductImagesPreview();

      debug.log(`${processedImages.length}枚の画像を並列処理しました`);
    } catch (error) {
      console.error('画像処理中にエラーが発生しました:', error);
    }
  }

  /**
   * 商品画像プレビューを表示
   */
  function displayProductImagesPreview() {
    const container = document.getElementById('productImagesPreviewContainer');
    const list = document.getElementById('productImagesPreviewList');
    const count = document.getElementById('productImageCount');

    if (!container || !list || !count) {
      console.error('商品画像プレビュー要素が見つかりません');
      return;
    }

    // 画像がない場合は非表示
    if (productImages.length === 0) {
      container.style.display = 'none';
      return;
    }

    // 画像がある場合は表示
    container.style.display = 'block';
    count.textContent = productImages.length;

    // プレビューリストをクリア
    list.innerHTML = '';

    // 各画像のプレビューを作成
    productImages.forEach((image, index) => {
      const previewItem = document.createElement('div');
      previewItem.style.cssText = 'position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 2px solid #e5e7eb;';

      previewItem.innerHTML = `
        <img src="${image.data}" alt="${image.name}" style="width: 100%; height: 100%; object-fit: cover;">
        <button
          type="button"
          onclick="removeProductImage(${index})"
          style="position: absolute; top: 4px; right: 4px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;"
          title="削除"
        >×</button>
      `;

      list.appendChild(previewItem);
    });
  }

  /**
   * 商品画像を削除
   * @param {number} index - 削除する画像のインデックス
   */
  function removeProductImage(index) {
    productImages.splice(index, 1);
    displayProductImagesPreview();
    debug.log(`商品画像を削除しました (index: ${index})`);
  }

  /**
   * すべての商品画像を削除
   */
  function clearAllProductImages() {
    if (productImages.length === 0) {
      return;
    }

    if (confirm(`${productImages.length}枚の画像をすべて削除しますか？`)) {
      productImages = [];
      displayProductImagesPreview();

      // ファイル入力もリセット
      const fileInput = document.getElementById('productImagesForSave');
      if (fileInput) {
        fileInput.value = '';
      }

      debug.log('すべての商品画像を削除しました');
    }
  }

  // ページ読み込み時に設定を確認
  document.addEventListener('DOMContentLoaded', function() {
    checkProductImageBlockVisibility();
  });

  // ================= AI生成機能 =================

  /**
   * AI生成ボタンクリック時の処理
   * 商品情報を収集してGemini APIで説明文を生成
   */
  function generateAiDescription() {
    try {
      debug.log('AI説明文生成を開始します');

      // ボタンの状態を変更（ローディング表示）
      const aiGenBtn = document.getElementById('aiGenBtn');
      if (!aiGenBtn) {
        console.error('AI生成ボタンが見つかりません');
        return;
      }

      // 元のテキストを保存
      const originalText = aiGenBtn.innerHTML;

      // ローディング状態に変更
      aiGenBtn.disabled = true;
      aiGenBtn.innerHTML = '⏳ 生成中...';
      aiGenBtn.style.opacity = '0.6';
      aiGenBtn.style.cursor = 'wait';

      // 商品情報を収集
      const productInfo = collectProductInfo();

      // 画像データを取得
      const images = getUploadedImages();

      debug.log('収集した商品情報:', productInfo);
      debug.log('アップロードされた画像数:', images.length);

      // バリデーション
      if (!productInfo.brandName || !productInfo.itemName) {
        alert('❌ ブランド名とアイテム名を入力してください。');
        resetAiButton(aiGenBtn, originalText);
        return;
      }

      // サーバー側のAPI呼び出し
      google.script.run
        .withSuccessHandler(function(generatedText) {
          debug.log('AI生成成功:', generatedText);

          // AI生成文をグローバル変数に保存
          window.AI_GENERATED_TEXT = generatedText;

          // プレビューを更新
          updateDescriptionFromDetail();

          // 成功メッセージ
          alert(`✅ AI説明文を生成しました！

商品の説明プレビューを確認して、必要に応じて直接編集してください。

⚠️ 注意事項
• 品番から取得した情報は、Google検索結果の品質に依存します
• 画像から取得した情報は、AIの判断に基づいています
• 必ず内容をご確認の上、誤りがあれば修正してください`);

          // ボタンを元に戻す
          resetAiButton(aiGenBtn, originalText);

          // 画像データはクリアしない（保存時に画像URLを記録するため）
          debug.log('AI生成成功。画像データは保存時まで保持します。');
        })
        .withFailureHandler(function(error) {
          console.error('AI生成エラー:', error);

          // エラーメッセージの表示
          let errorMsg = 'AI説明文の生成に失敗しました。\n\n';

          if (error.message && error.message.includes('NG(CONFIG)')) {
            errorMsg += 'APIキーが設定されていません。\n\n';
            errorMsg += '【設定手順】\n';
            errorMsg += '1. Google Apps Scriptエディタを開く\n';
            errorMsg += '2. ⚙️ プロジェクトの設定を開く\n';
            errorMsg += '3. スクリプト プロパティに追加:\n';
            errorMsg += '   プロパティ: GEMINI_API_KEY\n';
            errorMsg += '   値: あなたのAPIキー';
          } else if (error.message && error.message.includes('NG(API)')) {
            errorMsg += 'API呼び出しに失敗しました。\n';
            errorMsg += 'しばらく時間をおいて再度お試しください。\n\n';
            errorMsg += `エラー詳細: ${error.message}`;
          } else {
            errorMsg += `エラー詳細: ${error.message || 'Unknown error'}`;
          }

          alert('❌ ' + errorMsg);

          // ボタンを元に戻す
          resetAiButton(aiGenBtn, originalText);
        })
        .generateProductDescription(productInfo, images);

    } catch (error) {
      console.error('AI生成処理エラー:', error);
      alert('❌ エラーが発生しました: ' + error.message);

      // ボタンを元に戻す
      const aiGenBtn = document.getElementById('aiGenBtn');
      if (aiGenBtn) {
        resetAiButton(aiGenBtn, '✨ AI生成');
      }
    }
  }

  /**
   * 商品情報を収集（AI生成用）
   * @returns {Object} 商品情報オブジェクト
   */
  function collectProductInfo() {
    const productInfo = {};

    // ブランド名（基本情報ブロックから優先取得）
    productInfo.brandName = _val('ブランド(英語)') || _val('商品名_ブランド(英語)') || '';
    productInfo.brandKana = _val('ブランド(カナ)') || _val('商品名_ブランド(カナ)') || '';

    // アイテム名（基本情報ブロックから優先取得、なければ商品名ブロック）
    productInfo.itemName = _val('アイテム名') || _val('商品名_アイテム名') || '';

    // カテゴリ（階層情報を統合）
    const categories = [];
    const daiCategory = _val('大分類(カテゴリ)');
    const chuCategory = _val('中分類(カテゴリ)');
    const shoCategory = _val('小分類(カテゴリ)');
    if (daiCategory) categories.push(daiCategory);
    if (chuCategory) categories.push(chuCategory);
    if (shoCategory) categories.push(shoCategory);
    productInfo.category = categories.join(' > ');

    // サイズ
    productInfo.size = _val('サイズ(表記)_トップス') || _val('サイズ(表記)_ボトムス') || _val('サイズ') || '';

    // 商品の状態
    productInfo.condition = _val('商品の状態') || '';

    // 素材情報を収集
    const materials = [];
    for (let i = 1; i <= 10; i++) {
      const location = _val(`素材${i}_箇所`);
      const type1 = _val(`素材${i}_種類1`);
      const percent1 = _val(`素材${i}_％1`);

      if (location || type1) {
        let materialStr = '';
        if (location) materialStr += location + ': ';
        if (type1) {
          materialStr += type1;
          if (percent1) materialStr += ` ${percent1}%`;
        }
        materials.push(materialStr);
      }
    }
    productInfo.material = materials.join(', ');

    // カラー情報を収集（selectドロップダウンから）
    const colors = [];
    for (let i = 1; i <= 10; i++) {
      const colorValue = _val(`カラー${i}`);
      if (colorValue) {
        colors.push(colorValue);
        debug.log(`カラー${i}: ${colorValue}`);
      }
    }
    productInfo.color = colors.join(', ');
    debug.log(`収集したカラー情報: "${productInfo.color}"`);

    // 商品属性を収集（商品名ブロックから）
    const attributes = [];
    for (let i = 1; i <= 10; i++) {
      const attrValue = _val(`商品属性${i}`);
      if (attrValue) {
        attributes.push(attrValue);
      }
    }

    // AI生成用 追加属性を収集（商品の説明ブロックから）
    // キャッシュを使わず直接取得（最新の値を確実に取得するため）
    const aiAttributesElement = document.getElementById('AI用商品属性');
    const aiAttributesText = aiAttributesElement ? aiAttributesElement.value.trim() : '';

    debug.log(`AI用商品属性の値: "${aiAttributesText}"`);

    if (aiAttributesText) {
      // カンマ区切りで分割して追加
      const aiAttributes = aiAttributesText.split(',').map(attr => attr.trim()).filter(attr => attr);
      attributes.push(...aiAttributes);
      debug.log(`AI用商品属性を追加しました: ${aiAttributes.join(', ')}`);
    }

    productInfo.attributes = attributes.join(', ');
    debug.log(`最終的なattributes: "${productInfo.attributes}"`);

    // 品番・型番を収集（Google Search Grounding用）
    productInfo.modelNumber = _val('品番型番') || '';

    return productInfo;
  }

  /**
   * AI生成ボタンを元の状態に戻す
   * @param {HTMLElement} button - ボタン要素
   * @param {string} originalText - 元のテキスト
   */
  function resetAiButton(button, originalText) {
    if (!button) return;

    button.disabled = false;
    button.innerHTML = originalText;
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
  }

  // ================= 商品の説明プレビュー =================

  /**
   * 商品の説明プレビューを更新
   * ブランド、カラー、サイズ、素材、商品状態、管理番号、割引情報、ハッシュタグを組み立てる
   * @throws {Error} 要素が見つからない場合や処理中にエラーが発生した場合
   */
  function updateDescriptionFromDetail() {
    try {
        console.log('updateDescriptionFromDetail 関数が呼び出されました');
        const detailInput = document.getElementById('商品状態詳細');
        const descTextarea = document.getElementById('商品の説明');
        if (!detailInput || !descTextarea) {
          console.error('要素が見つかりません', { detailInput, descTextarea });
          return;
        }

        // ハッシュタグチェックボックスのプレビューを更新
        updateHashtagCheckboxPreviews();

        // ブランド情報を取得
        const brandText = getBrandInfo();

        // カラー情報を取得
        const colorText = getColorInfo();

        // サイズ情報を取得
        const sizeText = getSizeInfo();

          // 素材情報を収集
          const materialText = getMaterialInfo();

          // 商品の状態を取得（基本情報ブロックから）
          const conditionSelect = document.getElementById('商品の状態');
          const conditionValue = conditionSelect ? (conditionSelect.value || '').trim() : '';
          let conditionSection = '';
          if (conditionValue) {
            conditionSection = `商品の状態：${conditionValue}\n\n`;
          }

          // 商品状態詳細を取得
          const detailText = (detailInput.value || '').trim();
          let detailSection = '';
          if (detailText) {
            detailSection = `商品状態(詳細)：\n${detailText}\n\n`;
          }

          // AI生成文を取得
          let aiGenerationSection = '';
          if (window.AI_GENERATED_TEXT) {
            aiGenerationSection = `${window.AI_GENERATED_TEXT}\n\n`;
          }

        // ハッシュタグ生成
          const hashtags = generateHashtags();
          const hashtagText = hashtags.join('\n');

          // 管理番号セクション（localStorageの設定に基づく）
          let managementNumberSection = '';
          let managementNumberPosition = 'middle'; // デフォルトは中
          try {
            const saved = localStorage.getItem('managementNumberPlacement');
            console.log('🔍 説明文生成: localStorage取得結果:', saved);

            if (saved) {
              const settings = JSON.parse(saved);
              console.log('📋 説明文生成: 管理番号配置設定:', settings);

              if (settings.inDesc) {
                const mgmtNumber = _val('管理番号');
                console.log('🔢 説明文生成: 管理番号フィールド値:', mgmtNumber);

                if (mgmtNumber) {
                  // 形式を適用（絵文字なし）
                  const descFormat = settings.descFormat || '【】';
                  let formattedNumber = '';

                  switch (descFormat) {
                    case '【】':
                      formattedNumber = `管理番号：【${mgmtNumber}】`;
                      break;
                    case '（）':
                      formattedNumber = `管理番号：（${mgmtNumber}）`;
                      break;
                    case '『』':
                      formattedNumber = `管理番号：『${mgmtNumber}』`;
                      break;
                    case '「」':
                      formattedNumber = `管理番号：「${mgmtNumber}」`;
                      break;
                    case '｜｜':
                      formattedNumber = `管理番号：｜${mgmtNumber}｜`;
                      break;
                    case '｜':
                      formattedNumber = `管理番号：｜${mgmtNumber}`;
                      break;
                    case '-':
                      formattedNumber = `管理番号：- ${mgmtNumber}`;
                      break;
                    case 'none':
                      formattedNumber = `管理番号：${mgmtNumber}`;
                      break;
                    default:
                      formattedNumber = `管理番号：【${mgmtNumber}】`;
                  }

                  managementNumberSection = `${formattedNumber}\n\n`;
                  managementNumberPosition = settings.descPosition || 'middle';
                  console.log('✅ 説明文に管理番号を追加:', formattedNumber, '配置:', managementNumberPosition);
                } else {
                  console.log('⚠️ 管理番号フィールドが空です');
                }
              } else {
                console.log('⏭️ 説明文への管理番号配置がOFFです');
              }
            } else {
              console.log('⚠️ localStorageに管理番号配置設定がありません');
            }
          } catch (e) {
            console.error('❌ 管理番号配置設定の読み込みエラー（説明文）:', e);
          }

          // 割引案内テキスト（設定シート対応版）
          const discountInfo = generateDiscountInfo();

          // 配置順序を取得して説明文を組み立て（管理番号の位置を指定）
          buildDescriptionByOrder({
            brand: brandText,
            size: sizeText,
            color: colorText,
            condition: detailSection,
            material: materialText,
            management: managementNumberSection,
            aiGeneration: aiGenerationSection,
            discount: discountInfo,
            hashtag: hashtagText
          }, descTextarea, managementNumberPosition);
    } catch (error) {
      console.error('商品の説明更新エラー:', error);
      debug.error('updateDescriptionFromDetail エラー:', error);
    }
  }

  function setupDetailEventListener() {
    console.log('setupDetailEventListener 関数が呼び出されました');
    const detailInput = document.getElementById('商品状態詳細');
    if (detailInput) {
      // 既存のイベントリスナーを削除
      detailInput.removeEventListener('input', updateDescriptionFromDetail);
      // 新しいイベントリスナーを追加
      detailInput.addEventListener('input', updateDescriptionFromDetail);
      console.log('商品状態(詳細)イベントリスナー設定完了');
      // テスト用: 初回実行
      updateDescriptionFromDetail();
    } else {
      console.error('商品状態詳細の要素が見つかりません');
    }

    // 靴のサイズ関連項目にもイベントリスナーを追加
    const shoesFields = [
      'サイズ(表記)_靴',
      'その他のサイズ表記_靴',
      '普段のサイズ_靴',
      'フィット感_靴'
    ];

    shoesFields.forEach(fieldId => {
      const element = document.getElementById(fieldId);
      if (element) {
        const eventType = element.tagName === 'SELECT' ? 'change' : 'input';
        element.removeEventListener(eventType, updateDescriptionFromDetail);
        element.addEventListener(eventType, updateDescriptionFromDetail);
        console.log(`${fieldId}のイベントリスナー設定完了`);
      }
    });
  }

  // ================= 新セールスワードシステム =================
  function initializeSalesWords() {
    console.log('=== セールスワード初期化開始 ===');
    // PWA版：google.script.runは使用不可
    if (!(typeof google !== 'undefined' && google.script && google.script.run)) {
      console.log('PWA版：google.script.run が利用できません、フォールバック処理を実行');
      setupFallbackSalesWords();
      return;
    }

    // セールスワード専用データ取得と設定マスタからの「よく使う」読み込みを並行実行
    let salesWordData = null;
    let favoriteSalesWords = [];
    // defaultSalesword はグローバル変数として宣言済み（190行目）

    google.script.run
      .withSuccessHandler(function(data) {
        console.log('セールスワードデータ取得成功:', data);
        salesWordData = data;
        checkAndSetup();
      })
      .withFailureHandler(function(error) {
        console.error('セールスワードデータ取得エラー:', error);
        setupFallbackSalesWords();
      })
      .getSalesWordData();

    google.script.run
      .withSuccessHandler(function(config) {
        if (config && config.よく使うセールスワード) {
          // 新しい構造（よく使う + 表示形式 + デフォルト）に対応
          if (typeof config.よく使うセールスワード === 'object' && config.よく使うセールスワード.よく使う) {
            favoriteSalesWords = config.よく使うセールスワード.よく使う || [];
            // 表示形式設定を読み込み
            if (config.よく使うセールスワード.表示形式) {
              SALESWORD_FORMAT = config.よく使うセールスワード.表示形式;
              console.log('セールスワード表示形式取得成功:', SALESWORD_FORMAT);
            }
            // デフォルトセールスワード設定を読み込み
            if (config.よく使うセールスワード.デフォルト) {
              defaultSalesword = config.よく使うセールスワード.デフォルト;
              console.log('デフォルトセールスワード取得成功:', defaultSalesword);
            }
          } else {
            // 旧形式（配列のみ）に対応
            favoriteSalesWords = config.よく使うセールスワード;
          }
          console.log('よく使うセールスワード取得成功:', favoriteSalesWords);
        }
        checkAndSetup();
      })
      .withFailureHandler(function(error) {
        console.error('よく使うセールスワード取得エラー:', error);
        checkAndSetup();
      })
      .loadConfigMaster();

    function checkAndSetup() {
      if (salesWordData !== null) {
        SALESWORD_DATA = salesWordData;

        // 「よく使う」カテゴリを追加
        if (favoriteSalesWords.length > 0) {
          SALESWORD_DATA.wordsByCategory['よく使う'] = favoriteSalesWords;
        }

        setupCategoryDropdown();

        // デフォルトセールスワードを適用
        applyDefaultSalesword(defaultSalesword);

        console.log('セールスワード初期化完了');
      }
    }
  }

  function setupCategoryDropdown() {
    const categorySelect = document.getElementById('セールスワード(カテゴリ)');
    if (!categorySelect) {
      console.log('セールスワード(カテゴリ)要素が見つかりません');
      return;
    }
    // プルダウンをクリア
    categorySelect.innerHTML = '<option value="">-- カテゴリを選択 --</option>';

    // 「よく使う」カテゴリを先頭に追加
    if (SALESWORD_DATA.wordsByCategory['よく使う']) {
      const option = document.createElement('option');
      option.value = 'よく使う';
      option.textContent = '⭐ よく使う';
      categorySelect.appendChild(option);
    }

    // その他のカテゴリオプションを追加
    SALESWORD_DATA.categories.forEach(category => {
      const option = document.createElement('option');
      option.value = category;
      option.textContent = category;
      categorySelect.appendChild(option);
    });

    const totalCategories = SALESWORD_DATA.categories.length + (SALESWORD_DATA.wordsByCategory['よく使う'] ? 1 : 0);
    console.log(`カテゴリプルダウン設定完了: ${totalCategories}件`);
    // キーワードプルダウンをリセット
    resetKeywordDropdown();
  }

  function resetKeywordDropdown() {
    const keywordSelect = document.getElementById('セールスワード');
    if (!keywordSelect) {
      console.log('セールスワード要素が見つかりません');
      return;
    }
    keywordSelect.innerHTML = '<option value="">-- キーワードを選択 --</option>';
    keywordSelect.disabled = true;
  }

  function onSalesWordCategoryChanged() {
    const categorySelect = document.getElementById('セールスワード(カテゴリ)');
    const keywordSelect = document.getElementById('セールスワード');
    if (!categorySelect || !keywordSelect) {
      console.log('セールスワード要素が見つかりません');
      updateNamePreview();
      return;
    }
    const selectedCategory = categorySelect.value.trim();
    if (!selectedCategory) {
      resetKeywordDropdown();
      updateNamePreview();
      return;
    }
    console.log('カテゴリ選択:', selectedCategory);
    // 選択されたカテゴリのキーワードを取得
    const categoryWords = SALESWORD_DATA.wordsByCategory[selectedCategory] || [];
    // 重複を排除
    const uniqueWords = [...new Set(categoryWords)];
    // キーワードプルダウンを更新
    keywordSelect.innerHTML = '<option value="">-- キーワードを選択 --</option>';
    uniqueWords.forEach(word => {
      const option = document.createElement('option');
      option.value = word;
      // 表示は元の値のまま（形式は適用しない）
      option.textContent = word;
      keywordSelect.appendChild(option);
    });
    keywordSelect.disabled = categoryWords.length === 0;
    console.log(`キーワード設定完了: ${categoryWords.length}件`);
    updateNamePreview();
  }

  function setupFallbackSalesWords() {
    console.log('フォールバック用セールスワード設定');
    const fallbackCategories = [
      '価格・セール', '希少性・在庫状況', '状態・コンディション',
      '取引・配送方法', '商品タイプ・ジャンル'
    ];
    const fallbackWords = {
      '価格・セール': ['【セール】', '【特価】', '【値下げ】'],
      '希少性・在庫状況': ['【レア】', '【限定】', '【1点もの】'],
      '状態・コンディション': ['【美品】', '【新品同様】', '【良品】'],
      '取引・配送方法': ['【匿名配送】', '【送料無料】'],
      '商品タイプ・ジャンル': ['【古着】', '【ヴィンテージ】']
    };
    SALESWORD_DATA = {
      categories: fallbackCategories,
      wordsByCategory: fallbackWords,
      allWords: Object.values(fallbackWords).flat()
    };
    setupCategoryDropdown();
  }

  function setupSalesWordEventListeners() {
    const categorySelect = document.getElementById('セールスワード(カテゴリ)');
    if (categorySelect) {
      // 既存のイベントリスナーを削除
      categorySelect.removeEventListener('change', onSalesWordCategoryChanged);
      // 新しいイベントリスナーを追加
      categorySelect.addEventListener('change', onSalesWordCategoryChanged);
      console.log('セールスワードイベントリスナー設定完了');
    }
  }

  /**
   * デフォルトセールスワードを適用
   */
  function applyDefaultSalesword(defaultConfig) {
    if (!defaultConfig || !defaultConfig.カテゴリ || !defaultConfig.セールスワード) {
      console.log('デフォルトセールスワード設定がありません');
      return;
    }

    const categorySelect = document.getElementById('セールスワード(カテゴリ)');
    const saleswordSelect = document.getElementById('セールスワード');

    if (!categorySelect || !saleswordSelect) {
      console.log('セールスワードの要素が見つかりません');
      return;
    }

    // カテゴリを設定
    categorySelect.value = defaultConfig.カテゴリ;
    console.log('デフォルトカテゴリを設定:', defaultConfig.カテゴリ);

    // カテゴリ変更イベントをトリガー（セールスワードプルダウンを更新）
    onSalesWordCategoryChanged();

    // セールスワードを設定（プルダウン更新後に設定）
    setTimeout(() => {
      saleswordSelect.value = defaultConfig.セールスワード;
      console.log('デフォルトセールスワードを設定:', defaultConfig.セールスワード);

      // 商品名プレビューを更新
      if (typeof updateNamePreview === 'function') {
        updateNamePreview();
      }
    }, 100);
  }

  // ================= カテゴリ階層 =================
  function filterByCategory(rows) {
    const l1 = (document.getElementById('大分類(カテゴリ)')?.value||'').trim();
    const l2 = (document.getElementById('中分類(カテゴリ)')?.value||'').trim();
    const l3 = (document.getElementById('小分類(カテゴリ)')?.value||'').trim();
    const l4 = (document.getElementById('細分類(カテゴリ)')?.value||'').trim();
    const l5 = (document.getElementById('細分類2')?.value||'').trim();
    let r = rows.slice();
    if (l1) r = r.filter(x=> x.大分類 === l1);
    if (l2) r = r.filter(x=> x.中分類 === l2);
    if (l3) r = r.filter(x=> x.小分類 === l3);
    if (l4) r = r.filter(x=> x.細分類 === l4);
    if (l5) r = r.filter(x=> x.細分類2 === l5);
    return r;
  }

  function refreshItems() {
    const rows = filterByCategory(CAT_ROWS);
    fillSelectSafe(document.getElementById('アイテム名'), uniqKeepOrder(rows.map(r=>r.アイテム名)));
    updateItemNameDisplay();
    updateNamePreview();
  }

  /**
   * 中分類に応じてサイズプルダウンの選択肢を切り替える
   * @param {string} chuBunrui - 中分類の値
   */
  function updateSizeOptions(chuBunrui) {
    try {
      debug.log(`updateSizeOptions() が呼ばれました。中分類: "${chuBunrui}"`);
      const sizeSelect = document.getElementById('サイズ');
      if (!sizeSelect) {
        debug.log('サイズプルダウンが見つかりません');
        return;
      }

      const currentValue = sizeSelect.value; // 現在の選択値を保持

      // 中分類が「靴」の場合は靴用サイズ、それ以外は服用サイズ
      if (chuBunrui === '靴') {
        // 大分類でメンズ/レディースを判定
        const daiBunrui = _val('大分類(カテゴリ)');
        const shoeSizes = [];

        if (daiBunrui === 'メンズ') {
          // メンズ: 23.5cm以下、24cm～30.5cm、31cm以上
          shoeSizes.push('23.5cm以下');
          for (let size = 24.0; size <= 30.5; size += 0.5) {
            shoeSizes.push(size.toFixed(1) + 'cm');
          }
          shoeSizes.push('31cm以上');
        } else if (daiBunrui === 'レディース') {
          // レディース: 20cm以下、20.5cm～27cm、27.5cm以上
          shoeSizes.push('20cm以下');
          for (let size = 20.5; size <= 27.0; size += 0.5) {
            shoeSizes.push(size.toFixed(1) + 'cm');
          }
          shoeSizes.push('27.5cm以上');
        } else {
          // その他（キッズなど）: デフォルト
          for (let size = 22.0; size <= 30.0; size += 0.5) {
            shoeSizes.push(size.toFixed(1) + 'cm');
          }
        }

        fillSelectSafe(sizeSelect, shoeSizes);
        debug.log(`サイズプルダウンを靴用サイズに切り替えました（${daiBunrui}）`);
      } else {
        // 服用サイズ: マスターデータから取得（エラー時は何もしない）
        try {
          const sizeOptions = MASTER_OPTIONS && MASTER_OPTIONS['サイズ'] ? MASTER_OPTIONS['サイズ'] : [];
          if (sizeOptions.length > 0) {
            fillSelectSafe(sizeSelect, sizeOptions);
            debug.log('サイズプルダウンを服用サイズに切り替えました');
          } else {
            debug.log('マスターデータに服用サイズが見つかりません');
          }
        } catch (e) {
          debug.log('マスターデータからサイズ取得エラー:', e);
          // エラー時は何もしない（既存の選択肢を維持）
        }
      }

      // 以前の選択値が新しい選択肢に存在する場合は復元
      if (currentValue) {
        const options = Array.from(sizeSelect.options).map(opt => opt.value);
        if (options.includes(currentValue)) {
          sizeSelect.value = currentValue;
        }
      }
    } catch (error) {
      console.error('updateSizeOptions エラー:', error);
      // エラーが起きても処理を続行
    }
  }

  /**
   * 基本情報のサイズを商品の説明ブロックに同期
   */
  function syncBasicSizeToDescription() {
    try {
      const chuBunrui = _val('中分類(カテゴリ)');
      const basicSize = _val('サイズ');

      if (chuBunrui === '靴' && basicSize) {
        const shoesSizeSelect = document.getElementById('サイズ(表記)_靴');
        if (shoesSizeSelect) {
          shoesSizeSelect.value = basicSize;
          debug.log(`基本情報のサイズ(${basicSize})を商品の説明ブロック（靴）に反映しました`);
          // 説明文プレビューを更新
          updateDescriptionFromDetail();
        }
      }
    } catch (error) {
      console.error('syncBasicSizeToDescription エラー:', error);
    }
  }

  /**
   * 中分類に応じて商品の説明ブロックのサイズセクション表示を切り替える
   * @param {string} chuBunrui - 中分類の値
   */
  function updateSizeSectionDisplay(chuBunrui) {
    try {
      console.log(`★★★ updateSizeSectionDisplay() が呼ばれました。中分類: "${chuBunrui}"`);
      const sizeSection = document.getElementById('sizeSection');
      const topsSize = document.getElementById('topsSize');
      const bottomsSize = document.getElementById('bottomsSize');
      const shoesSize = document.getElementById('shoesSize');
      const sizeIconDisplay = document.getElementById('sizeIconDisplay');
      const sizeLabelDisplay = document.getElementById('sizeLabelDisplay');

      console.log('★★★ 要素チェック:', {sizeSection: !!sizeSection, topsSize: !!topsSize, bottomsSize: !!bottomsSize, shoesSize: !!shoesSize});

      if (!sizeSection || !topsSize || !bottomsSize || !shoesSize) {
        console.log('★★★ サイズセクションの要素が見つかりません');
        return;
      }

      // 全て非表示にする
      topsSize.style.display = 'none';
      bottomsSize.style.display = 'none';
      shoesSize.style.display = 'none';

      if (chuBunrui === '靴') {
        // 靴の場合
        console.log('★★★ 靴モード: displayを設定する前 - sizeSection.style.display:', sizeSection.style.display);
        sizeSection.style.display = 'block';

        // 折りたたみコンテンツも表示し、ボタンの状態も更新する
        const sectionContent = sizeSection.querySelector('.section-content');
        const collapseBtn = sizeSection.querySelector('.collapse-btn');
        if (sectionContent) {
          sectionContent.style.display = 'block';
          if (collapseBtn) {
            collapseBtn.textContent = '▼';
          }
          console.log('★★★ section-content とボタンを表示状態にしました');
        }

        shoesSize.style.display = 'block';
        console.log('★★★ 靴モード: displayを設定した後 - sizeSection.style.display:', sizeSection.style.display);
        console.log('★★★ 靴モード: displayを設定した後 - shoesSize.style.display:', shoesSize.style.display);

        // 要素の詳細情報をログ出力
        const rect = sizeSection.getBoundingClientRect();
        console.log('★★★ sizeSection の位置とサイズ:', {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          visible: rect.width > 0 && rect.height > 0
        });
        console.log('★★★ sizeSection の親要素:', sizeSection.parentElement ? sizeSection.parentElement.tagName : 'なし');
        console.log('★★★ sizeSection の親要素の display:', sizeSection.parentElement ? window.getComputedStyle(sizeSection.parentElement).display : 'なし');

        if (sizeIconDisplay) sizeIconDisplay.textContent = '👟';
        if (sizeLabelDisplay) sizeLabelDisplay.textContent = 'サイズ（靴）';

        // 靴用サイズ選択肢を生成
        const shoesSizeSelect = document.getElementById('サイズ(表記)_靴');
        if (shoesSizeSelect) {
          const shoeSizes = [];
          for (let size = 22.0; size <= 30.0; size += 0.5) {
            shoeSizes.push(size.toFixed(1) + 'cm');
          }
          fillSelectSafe(shoesSizeSelect, shoeSizes);

          // 基本情報のサイズを靴用サイズ(表記)に同期
          const basicSize = _val('サイズ');
          if (basicSize) {
            shoesSizeSelect.value = basicSize;
            console.log(`★★★ 基本情報のサイズ(${basicSize})を反映しました`);
          }
        }
        console.log('★★★ サイズセクションを靴用に切り替えました');
      } else {
        // 服の場合（既存の処理）
        sizeSection.style.display = 'none'; // 初期状態は非表示
        console.log('★★★ サイズセクションを非表示にしました（アイテム名選択後に表示されます）');
      }
    } catch (error) {
      console.error('updateSizeSectionDisplay エラー:', error);
      // エラーが起きても処理を続行
    }
  }

  function onL1Changed() {
    resetSelect('中分類(カテゴリ)');
    resetSelect('小分類(カテゴリ)');
    resetSelect('細分類(カテゴリ)');
    resetSelect('細分類2');
    resetSelect('アイテム名', false);
    // 細分類行を非表示
    const saibunruiRow = document.getElementById('saibunruiRow');
    if (saibunruiRow) saibunruiRow.style.display = 'none';

    const l1 = (document.getElementById('大分類(カテゴリ)')?.value||'').trim();
    if (l1) {
      const mids = uniqKeepOrder(CAT_ROWS.filter(r=>r.大分類===l1).map(r=>r.中分類));
      fillSelectSafe(document.getElementById('中分類(カテゴリ)'), mids);
    }
    refreshItems();
  }

  function onL2Changed() {
    debug.log('onL2Changed() が呼ばれました');
    resetSelect('小分類(カテゴリ)');
    resetSelect('細分類(カテゴリ)');
    resetSelect('細分類2');
    resetSelect('アイテム名', false);
    // 細分類行を非表示
    const saibunruiRow = document.getElementById('saibunruiRow');
    if (saibunruiRow) saibunruiRow.style.display = 'none';

    const l1 = (document.getElementById('大分類(カテゴリ)')?.value||'').trim();
    const l2 = (document.getElementById('中分類(カテゴリ)')?.value||'').trim();
    debug.log(`中分類の値: "${l2}"`);
    if (l2) {
      const smalls = uniqKeepOrder(CAT_ROWS.filter(r=>r.大分類===l1 && r.中分類===l2).map(r=>r.小分類));
      fillSelectSafe(document.getElementById('小分類(カテゴリ)'), smalls);
    }

    // === 靴の場合、サイズプルダウンを靴用サイズに切り替え ===
    updateSizeOptions(l2);

    refreshItems();
  }

  function onL3Changed() {
    resetSelect('細分類(カテゴリ)');
    resetSelect('細分類2');
    resetSelect('アイテム名', false);
    const l1 = (document.getElementById('大分類(カテゴリ)')?.value||'').trim();
    const l2 = (document.getElementById('中分類(カテゴリ)')?.value||'').trim();
    const l3 = (document.getElementById('小分類(カテゴリ)')?.value||'').trim();
    const saibunruiRow = document.getElementById('saibunruiRow');

    if (l3) {
      const mins = uniqKeepOrder(CAT_ROWS.filter(r=>r.大分類===l1 && r.中分類===l2 && r.小分類===l3).map(r=>r.細分類));
      fillSelectSafe(document.getElementById('細分類(カテゴリ)'), mins);

      // 細分類の選択肢がある場合のみ表示
      if (mins.length > 0 && saibunruiRow) {
        saibunruiRow.style.display = '';
      } else if (saibunruiRow) {
        saibunruiRow.style.display = 'none';
      }
    } else {
      // 小分類が未選択の場合は非表示
      if (saibunruiRow) saibunruiRow.style.display = 'none';
    }
    refreshItems();
  }

  function onL4Changed() {
    resetSelect('細分類2');
    resetSelect('アイテム名', false);
    const l1 = (document.getElementById('大分類(カテゴリ)')?.value||'').trim();
    const l2 = (document.getElementById('中分類(カテゴリ)')?.value||'').trim();
    const l3 = (document.getElementById('小分類(カテゴリ)')?.value||'').trim();
    const l4 = (document.getElementById('細分類(カテゴリ)')?.value||'').trim();
    if (l4) {
      const fin2 = uniqKeepOrder(CAT_ROWS.filter(r=>r.大分類===l1 && r.中分類===l2 && r.小分類===l3 && r.細分類===l4).map(r=>r.細分類2));
      fillSelectSafe(document.getElementById('細分類2'), fin2);
    }
    refreshItems();
  }

  function onL5Changed() {
    refreshItems();
  }

  function collect() {
    const d={};
    FIELD_IDS.forEach(k=>{
      const el = document.getElementById(k);
      if (!el) return;
      const v=(el.value||'').trim();
      if (v !== '') d[k]=v;
    });

    // サイズ(表記)の特殊処理: トップス、ボトムス、靴のいずれかの値を使用
    const sizeHyokiTop = _val('サイズ(表記)_トップス');
    const sizeHyokiBottom = _val('サイズ(表記)_ボトムス');
    const sizeHyokiShoes = _val('サイズ(表記)_靴');
    const sizeHyoki = sizeHyokiTop || sizeHyokiBottom || sizeHyokiShoes;
    if (sizeHyoki) {
      d['サイズ(表記)'] = sizeHyoki;
    }

    // === 画像はGoogle Driveにアップロード後にJSON形式で保存 ===
    // 画像アップロードはonSave()関数で処理します
    // ここでは何もしません（Base64データをスプレッドシートに保存するとエラーになるため）

    // === AI生成履歴を追加 ===
    debug.log(`window.AI_GENERATED_TEXT: "${window.AI_GENERATED_TEXT ? window.AI_GENERATED_TEXT.substring(0, 50) + '...' : '(空)'}"`);
    if (window.AI_GENERATED_TEXT && window.AI_GENERATED_TEXT.trim() !== '') {
      const aiHistory = {
        timestamp: new Date().toISOString(),
        text: window.AI_GENERATED_TEXT,
        imageCount: uploadedImages ? uploadedImages.length : 0,
        brandName: _val('ブランド(英語)') || _val('商品名_ブランド(英語)') || '',
        itemName: _val('アイテム名') || ''
      };
      const historyJson = JSON.stringify(aiHistory);
      d['AI生成履歴'] = historyJson;
      debug.log(`AI生成履歴を追加しました (${historyJson.length}文字)`);
    } else {
      debug.log('AI生成履歴は空のためスキップしました');
    }

    return d;
  }

  function frontValidate(d) {
    const name = d['商品名(タイトル)'] || '';
    const len = Array.from(name).length;
    if (NAME_LIMIT_MODE === 'block' && len > NAME_LIMIT) {
      return `NG(NAME): 商品名(タイトル)は${NAME_LIMIT}文字以内にしてください（現在${len}文字）`;
    }
    const desc = d['商品の説明'] || '';
    const dlen = Array.from(desc).length;
    if (DESC_LIMIT_MODE === 'block' && dlen > DESC_LIMIT) {
      return `NG(DESC): 商品の説明は${DESC_LIMIT}文字以内にしてください（現在${dlen}文字）`;
    }
    if (d['仕入金額'] && isNaN(Number(d['仕入金額']))) return "NG(FORMAT): 仕入金額は数値で入力してください";
    if (d['出品金額'] && isNaN(Number(d['出品金額']))) return "NG(FORMAT): 出品金額は数値で入力してください";
    return '';
  }

  function onSave() {
    console.log('[DEBUG] onSave() called');
    updateNamePreview();
    updateDesc();
    const d = collect();
    console.log('[DEBUG] Collected data:', d);
    const ng = frontValidate(d);
    console.log('[DEBUG] Validation result:', ng);
    if (ng) {
      return show(ng);
    }

    if (!(typeof google !== 'undefined' && google.script && google.script.run)) {
      show('NG(ENV): google.script.run が無効です');
      return;
    }

    // 楽観的UI: ローディング画面を表示し、1.5秒で0→100%アニメーション
    showLoadingOverlay('登録中', 'データを保存中...');

    const startTime = Date.now();
    const duration = 1500; // 1.5秒

    const animateProgress = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min((elapsed / duration) * 100, 100);

      updateLoadingProgress(progress, `${Math.round(progress)}%`);

      if (progress < 100) {
        requestAnimationFrame(animateProgress);
      } else {
        // 100%到達 → すぐにローディング画面を閉じる
        setTimeout(() => {
          hideLoadingOverlay();
        }, 100);
      }
    };

    requestAnimationFrame(animateProgress);

    // バックグラウンドで実際の保存処理
    console.log('[DEBUG] Checking productImages:', productImages ? productImages.length : 0);
    if (productImages && productImages.length > 0) {
      // 商品IDを取得（管理番号を使用）
      const productId = d['管理番号'] || 'unknown_' + new Date().getTime();
      console.log('[DEBUG] Product has images, uploading first. ProductId:', productId);

      // アップロード用データを準備
      const imagesToUpload = productImages.map(img => ({
        data: img.data,
        name: img.name,
        forAI: false  // 商品画像（AI用ではない）
      }));

      // 画像をストレージにアップロード（プロバイダーに応じて切り替え）
      const uploadParams = {
        images: imagesToUpload,
        productId: productId
      };

      debug.log(`📤 画像アップロード開始: プロバイダー=${IMAGE_STORAGE_PROVIDER}`);

      // プロバイダーに応じて関数を呼び出し
      if (IMAGE_STORAGE_PROVIDER === 'gdrive') {
        google.script.run
          .withSuccessHandler(function(uploadResult) {
            console.log('[DEBUG] Upload result:', uploadResult);
            if (uploadResult.success) {
              debug.log(`✅ 商品画像アップロード成功: ${uploadResult.successCount}/${uploadResult.totalCount}枚`);
              debug.log(`📂 ストレージ: ${IMAGE_STORAGE_PROVIDER}`);

              // JSON形式でURLを保存
              const imageUrlsJson = JSON.stringify(uploadResult.urls);
              d['JSON_データ'] = imageUrlsJson;

              // スプレッドシートに保存
              console.log('[DEBUG] Calling saveProductToSheet after image upload');
              saveProductToSheet(d);
            } else {
              console.log('[DEBUG] Image upload failed:', uploadResult.error);
              show(`NG(IMAGE_UPLOAD): ${uploadResult.error}`);
            }
          })
          .withFailureHandler(function(error) {
            console.log('[DEBUG] Image upload API call failed:', error);
            show(`NG(IMAGE_UPLOAD): ${error && error.message ? error.message : error}`);
          })
          .uploadImagesToGoogleDrive(uploadParams);
      } else {
        google.script.run
          .withSuccessHandler(function(uploadResult) {
            console.log('[DEBUG] Upload result:', uploadResult);
            if (uploadResult.success) {
              debug.log(`✅ 商品画像アップロード成功: ${uploadResult.successCount}/${uploadResult.totalCount}枚`);
              debug.log(`📂 ストレージ: ${IMAGE_STORAGE_PROVIDER}`);

              // JSON形式でURLを保存
              const imageUrlsJson = JSON.stringify(uploadResult.urls);
              d['JSON_データ'] = imageUrlsJson;

              // スプレッドシートに保存
              console.log('[DEBUG] Calling saveProductToSheet after image upload');
              saveProductToSheet(d);
            } else {
              console.log('[DEBUG] Image upload failed:', uploadResult.error);
              show(`NG(IMAGE_UPLOAD): ${uploadResult.error}`);
            }
          })
          .withFailureHandler(function(error) {
            console.log('[DEBUG] Image upload API call failed:', error);
            show(`NG(IMAGE_UPLOAD): ${error && error.message ? error.message : error}`);
          })
          .uploadImagesToR2(uploadParams);
      }
    } else {
      // 商品画像がない場合は直接保存
      console.log('[DEBUG] No product images, calling saveProductToSheet directly');
      saveProductToSheet(d);
    }
  }

  /**
   * スプレッドシートに商品データを保存
   * @param {Object} d - 商品データ
   */
  function saveProductToSheet(d) {
    console.log('[DEBUG] saveProductToSheet() called with data:', d);

    // ★ 管理番号の重複チェックとカウンター更新
    const managementNumber = d['管理番号'];
    if (managementNumber) {
      confirmManagementNumber(managementNumber).then(confirmed => {
        if (!confirmed) {
          // 重複エラー：保存を中断
          hideLoadingOverlay();
          return;
        }

        // 重複チェックOK：Firestoreへ保存
        executeSaveToFirestore(d);
      });
    } else {
      // 管理番号なし：そのまま保存
      executeSaveToFirestore(d);
    }
  }

  /**
   * Firestoreへの保存実行（confirmManagementNumber後に呼び出し）
   * @param {Object} d - 商品データ
   */
  async function executeSaveToFirestore(d) {
    try {
      console.log('[DEBUG] Firestore保存開始:', d);

      // Firestoreに商品データを保存
      const docRef = await window.db.collection('products').add({
        ...d,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log('[DEBUG] Firestore保存成功:', docRef.id);

      // 📢 システム通知ルームへの投稿（Firestore直接書き込み）
      try {
        // 現在のユーザー名を取得
        const userName = window.CACHED_CONFIG?.userName || '不明';

        // 通知本文を作成
        const brandName = d['ブランド(英語)'] || d['ブランド(カナ)'] || '';
        const itemName = d['アイテム名'] || '';
        const category = d['大分類(カテゴリ)'] || d['大分類'] || '';
        const managementNumber = d['管理番号'] || '';
        const listingDestination = d['出品先'] || '';
        const listingAmount = d['出品金額'] || '';

        const productName = (brandName ? brandName + ' ' : '') + (itemName || category || '');
        const notificationText = `✅ 商品登録完了\n${userName}さんが商品を登録しました\n\n管理番号: ${managementNumber}\n${productName}\n${listingDestination ? '出品先: ' + listingDestination : ''}\n${listingAmount ? '出品金額: ' + Number(listingAmount).toLocaleString() + '円' : ''}`;

        // システム通知ルームIDは固定
        const systemRoomId = 'room_system_notifications';

        // Firestoreにメッセージを投稿（チャットと同じ形式）
        await window.db.collection(`rooms/${systemRoomId}/messages`).add({
          text: notificationText,
          userName: 'システム',
          timestamp: new Date(),
          deletedBy: []
        });

        // ルーム情報を更新
        await window.db.collection('rooms').doc(systemRoomId).set({
          lastMessage: notificationText,
          lastMessageAt: new Date(),
          lastMessageBy: 'システム',
          members: [], // システム通知は全ユーザーが閲覧可能
          roomName: '📢 システム通知'
        }, { merge: true });

        console.log('[System Notification] システム通知ルームへの投稿完了');
      } catch (notificationError) {
        console.error('[System Notification] 通知投稿エラー:', notificationError);
        // 通知エラーは商品保存の成功には影響しない
      }

      // 楽観的UI: ローディングは既にアニメーションで閉じている
      // 保存完了後の処理のみ実行

      show(''); // メッセージをクリア
      
      // 保存成功後も商品の説明エリアの高さを保持
      const descTextarea = document.getElementById('商品の説明');
      if (descTextarea) {
        autoResizeTextarea(descTextarea);
      }
      
      // 保存成功後に開閉状態と管理番号配置を保存
      saveDescriptionBlocksCollapseState();
      saveTitleBlocksCollapseState();
      saveManagementNumberPlacementSettings();
      console.log('保存成功：開閉状態と管理番号配置を保存しました');

      // === 保存成功後に画像データとAI生成テキストをクリア ===
      // AI生成用画像（uploadedImages）をクリア
      if (uploadedImages && uploadedImages.length > 0) {
        uploadedImages = [];
        const container = document.getElementById('imagePreviewContainer');
        if (container) {
          container.style.display = 'none';
        }
        const fileInput = document.getElementById('productImages');
        if (fileInput) {
          fileInput.value = '';
        }
        debug.log('保存成功後にAI生成用画像データをクリアしました');
      }

      // 商品画像（productImages）をクリア
      if (productImages && productImages.length > 0) {
        productImages = [];
        const container = document.getElementById('productImagesPreviewContainer');
        if (container) {
          container.style.display = 'none';
        }
        const fileInput = document.getElementById('productImagesForSave');
        if (fileInput) {
          fileInput.value = '';
        }
        debug.log('保存成功後に商品画像データをクリアしました');
      }

      if (window.AI_GENERATED_TEXT) {
        window.AI_GENERATED_TEXT = '';
        debug.log('保存成功後にAI生成テキストをクリアしました');
      }

      hideLoadingOverlay();
      
    } catch (error) {
      console.error('[DEBUG] Firestore保存エラー:', error);
      hideLoadingOverlay();
      show(`保存エラー: ${error && error.message ? error.message : error}`);
    }
  }

  // ==================== リセット機能（新実装） ====================
  // Issue: RESET-005
  // 「次の商品へ」機能として全面改修

  /**
   * ヘルパー関数: フィールドをクリア
   */
  function clearField(fieldId) {
    try {
      const el = document.getElementById(fieldId);
      if (el) {
        el.value = '';
      }
    } catch (error) {
      console.error(`[clearField] エラー (${fieldId}):`, error);
    }
  }

  /**
   * 管理番号ブロックをリセット
   */
  function resetManagementNumber() {
    try {
      console.log('[Reset] 管理番号ブロック開始');

      // 基本フィールド
      clearField('prefix1');
      clearField('棚番号');
      clearField('管理番号');
      clearField('担当者');

      // 動的生成フィールド
      clearField('mgmt_shelf_first');
      clearField('mgmt_shelf_second');
      clearField('mgmt_custom_first');
      clearField('mgmt_custom_second');

      console.log('[Reset] 管理番号ブロック完了');
    } catch (error) {
      console.error('[Reset] 管理番号ブロックエラー:', error);
    }
  }

  /**
   * 基本情報ブロックをリセット
   */
  function resetBasicInfo() {
    try {
      console.log('[Reset] 基本情報ブロック開始');

      // カテゴリー
      clearField('大分類(カテゴリ)');
      ['中分類(カテゴリ)', '小分類(カテゴリ)', '細分類(カテゴリ)', '細分類2'].forEach(id => {
        if (typeof resetSelect === 'function') {
          resetSelect(id, true);
        }
      });

      // 細分類行を非表示
      const saibunruiRow = document.getElementById('saibunruiRow');
      if (saibunruiRow) saibunruiRow.style.display = 'none';

      // ブランド
      clearField('ブランド(英語)');
      clearField('ブランド(カナ)');
      if (typeof hideSuggest === 'function') {
        hideSuggest('ブランド(英語)');
      }

      // その他
      clearField('アイテム名');
      clearField('サイズ');
      clearField('商品の状態');

      console.log('[Reset] 基本情報ブロック完了');
    } catch (error) {
      console.error('[Reset] 基本情報ブロックエラー:', error);
    }
  }

  /**
   * 商品名ブロックをリセット
   */
  function resetProductName() {
    try {
      console.log('[Reset] 商品名ブロック開始');

      // 商品名プレビュー
      clearField('商品名プレビュー');

      // ブランド情報
      clearField('商品名_ブランド(英語)');
      clearField('商品名_ブランド(カナ)');

      // ブランドチェックボックスをチェック状態に
      const brandEnCheckbox = document.getElementById('商品名_ブランド(英語)_チェック');
      const brandKanaCheckbox = document.getElementById('商品名_ブランド(カナ)_チェック');
      if (brandEnCheckbox) brandEnCheckbox.checked = true;
      if (brandKanaCheckbox) brandKanaCheckbox.checked = true;

      // アイテム名
      clearField('商品名_アイテム名');

      // 商品属性（2個目以降を削除）
      resetAttributeSections();

      console.log('[Reset] 商品名ブロック完了');
    } catch (error) {
      console.error('[Reset] 商品名ブロックエラー:', error);
    }
  }

  /**
   * 商品詳細ブロックをリセット
   */
  function resetProductDetails() {
    try {
      console.log('[Reset] 商品詳細ブロック開始');

      // サイズセクション
      resetSizeSection();

      // カラー
      resetColorSections();

      // 素材
      resetMaterialSections();

      // 商品の状態詳細
      clearField('商品状態詳細');

      // AI生成情報
      clearField('AI用商品属性');
      clearField('品番型番');
      resetProductImages();

      console.log('[Reset] 商品詳細ブロック完了');
    } catch (error) {
      console.error('[Reset] 商品詳細ブロックエラー:', error);
    }
  }

  /**
   * 商品説明ブロックをリセット（部分保持）
   * 割引情報とハッシュタグは保持、商品固有情報はクリア
   */
  function resetDescriptionBlock() {
    try {
      console.log('[Reset] 商品説明ブロック開始');

      const descTextarea = document.getElementById('商品の説明');
      if (!descTextarea) return;

      // 割引情報を生成（設定から）
      let discountInfo = '';
      if (typeof generateDiscountInfo === 'function') {
        discountInfo = generateDiscountInfo();
      }

      // ハッシュタグを生成（設定から）
      let hashtagText = '';
      if (typeof generateHashtags === 'function') {
        const hashtags = generateHashtags();
        if (hashtags && hashtags.length > 0) {
          hashtagText = '\n' + hashtags.join('\n');
        }
      }

      // 割引情報とハッシュタグを結合
      let preservedContent = '';
      if (discountInfo) {
        preservedContent += discountInfo;
      }
      if (hashtagText) {
        preservedContent += hashtagText;
      }

      // textareaに設定
      descTextarea.value = preservedContent.trim();

      console.log('[Reset] 商品説明ブロック完了（割引情報・ハッシュタグ保持）');
    } catch (error) {
      console.error('[Reset] 商品説明ブロックエラー:', error);
      // エラーが発生しても処理を継続（最悪の場合は空になる）
    }
  }

  /**
   * 仕入・出品情報をリセット
   * デフォルト値以外をクリア（金額フィールドなど）
   */
  function resetProcureListingInfo() {
    try {
      console.log('[Reset] 仕入・出品情報ブロック開始');

      // 仕入情報: 全フィールドをクリア
      clearField('仕入日');
      clearField('仕入先');
      clearField('仕入金額');

      // 出品情報: 全フィールドをクリア
      clearField('出品日');
      clearField('出品先');
      clearField('出品金額');

      console.log('[Reset] 仕入・出品情報ブロック完了');
    } catch (error) {
      console.error('[Reset] 仕入・出品情報ブロックエラー:', error);
    }
  }

  /**
   * デフォルト値を再適用
   */
  function applyDefaultValuesAfterReset() {
    try {
      console.log('[Reset] デフォルト値適用開始');

      // セールスワード
      if (typeof defaultSalesword !== 'undefined' && defaultSalesword &&
          defaultSalesword.カテゴリ && defaultSalesword.セールスワード) {
        setTimeout(() => {
          if (typeof applyDefaultSalesword === 'function') {
            applyDefaultSalesword(defaultSalesword);
            console.log('デフォルトセールスワードを再適用しました');
          }
        }, 100);
      }

      // 配送情報
      if (typeof applyShippingDefaults === 'function') {
        applyShippingDefaults();
      }

      // 仕入・出品情報
      if (typeof applyProcureListingDefaults === 'function') {
        applyProcureListingDefaults();
      }

      console.log('[Reset] デフォルト値適用完了');
    } catch (error) {
      console.error('[Reset] デフォルト値適用エラー:', error);
    }
  }

  /**
   * プレビューを更新
   */
  function updateAllPreviewsAfterReset() {
    try {
      console.log('[Reset] プレビュー更新開始');

      // ブランド表示を更新
      if (typeof updateBrandDisplay === 'function') {
        updateBrandDisplay();
      }

      // 商品名プレビュー・商品の説明を更新
      setTimeout(() => {
        if (typeof updateNamePreview === 'function') {
          updateNamePreview();
        }
        if (typeof updateDescriptionFromDetail === 'function') {
          updateDescriptionFromDetail();
        }
      }, 100);

      console.log('[Reset] プレビュー更新完了');
    } catch (error) {
      console.error('[Reset] プレビュー更新エラー:', error);
    }
  }

  /**
   * 商品属性セクションを1つに戻す
   */
  function resetAttributeSections() {
    try {
      const attributeItems = document.querySelectorAll('.attribute-item');
      attributeItems.forEach((item, index) => {
        if (index === 0) {
          // 1個目はクリア
          clearField('商品属性1_カテゴリ');
          clearField('商品属性1_値');
          const valueSelect = document.getElementById('商品属性1_値');
          if (valueSelect) valueSelect.disabled = true;
        } else {
          // 2個目以降は削除
          item.remove();
        }
      });
      if (typeof attributeCount !== 'undefined') attributeCount = 1;
      if (typeof updateAttributeRemoveButtons === 'function') {
        updateAttributeRemoveButtons();
      }
    } catch (error) {
      console.error('[resetAttributeSections] エラー:', error);
    }
  }

  /**
   * カラーセクションを1つに戻す
   */
  function resetColorSections() {
    try {
      const colorItems = document.querySelectorAll('.color-item');
      colorItems.forEach((item, index) => {
        if (index === 0) {
          clearField('カラー1');
        } else {
          item.remove();
        }
      });
      if (typeof colorCount !== 'undefined') colorCount = 1;
      if (typeof updateColorRemoveButtons === 'function') {
        updateColorRemoveButtons();
      }
    } catch (error) {
      console.error('[resetColorSections] エラー:', error);
    }
  }

  /**
   * 素材セクションを1つに戻す
   */
  function resetMaterialSections() {
    try {
      const materialItems = document.querySelectorAll('.material-item');
      materialItems.forEach((item, index) => {
        if (index === 0) {
          clearField('素材1_箇所');
          clearField('素材1_種類1');
          clearField('素材1_％1');
          clearField('素材1_種類2');
          clearField('素材1_％2');
        } else {
          item.remove();
        }
      });
      if (typeof materialCount !== 'undefined') materialCount = 1;
      if (typeof updateRemoveButtons === 'function') {
        updateRemoveButtons();
      }
    } catch (error) {
      console.error('[resetMaterialSections] エラー:', error);
    }
  }

  /**
   * サイズセクションを非表示に戻す
   */
  function resetSizeSection() {
    try {
      // サイズセクション非表示
      const sizeSection = document.getElementById('sizeSection');
      if (sizeSection) sizeSection.style.display = 'none';

      // アイコン・ラベルを初期状態に
      const sizeIconDisplay = document.getElementById('sizeIconDisplay');
      const sizeLabelDisplay = document.getElementById('sizeLabelDisplay');
      if (sizeIconDisplay) sizeIconDisplay.textContent = '👕';
      if (sizeLabelDisplay) sizeLabelDisplay.textContent = 'サイズ';

      // 全サイズフィールドをクリア
      const sizeHyokiTop = document.getElementById('サイズ(表記)_トップス');
      const sizeHyokiBottom = document.getElementById('サイズ(表記)_ボトムス');
      const sizeHyokiShoes = document.getElementById('サイズ(表記)_靴');
      const otherSizeShoes = document.getElementById('その他のサイズ表記_靴');
      const usualSizeShoes = document.getElementById('普段のサイズ_靴');
      const fitShoes = document.getElementById('フィット感_靴');

      if (sizeHyokiTop) sizeHyokiTop.value = '';
      if (sizeHyokiBottom) sizeHyokiBottom.value = '';
      if (sizeHyokiShoes) sizeHyokiShoes.value = '';
      if (otherSizeShoes) otherSizeShoes.value = '';
      if (usualSizeShoes) usualSizeShoes.value = '';
      if (fitShoes) fitShoes.value = '';

      // サイズフィールド（実寸）
      ['肩幅', '身幅', '袖丈', '着丈', 'ウエスト', 'ヒップ', '股上', '股下'].forEach(id => {
        clearField(id);
      });

      // shoulderWidthLabel を「肩幅」に戻す
      const shoulderLabel = document.getElementById('shoulderWidthLabel');
      if (shoulderLabel) shoulderLabel.textContent = '肩幅';
    } catch (error) {
      console.error('[resetSizeSection] エラー:', error);
    }
  }

  /**
   * 商品画像を全削除
   */
  function resetProductImages() {
    try {
      // グローバル変数をクリア
      if (typeof window.AI_GENERATED_TEXT !== 'undefined') window.AI_GENERATED_TEXT = '';
      if (typeof uploadedImages !== 'undefined') uploadedImages = [];

      // プレビューコンテナを非表示
      const container = document.getElementById('imagePreviewContainer');
      if (container) container.style.display = 'none';

      // ファイル入力をリセット
      const fileInput = document.getElementById('productImages');
      if (fileInput) fileInput.value = '';

      // プレビューを更新
      if (typeof displayImagePreviews === 'function') {
        displayImagePreviews();
      }

      console.log('[Reset] 商品画像をクリア');
    } catch (error) {
      console.error('[resetProductImages] エラー:', error);
    }
  }

  /**
   * フォーム全体をリセット（「次の商品へ」機能）
   * RESET-005: リセット機能の全面改修
   */
  function onReset() {
    try {
      console.log('=== リセット開始（新実装） ===');

      // Phase 1: データクリア
      resetManagementNumber();
      resetBasicInfo();
      resetProductName();
      resetProductDetails();
      resetDescriptionBlock();
      resetProcureListingInfo();

      // Phase 2: デフォルト値再適用
      applyDefaultValuesAfterReset();

      // Phase 3: プレビュー更新
      updateAllPreviewsAfterReset();

      // メッセージをクリア
      if (typeof show === 'function') {
        show('');
      }

      // ハッシュタグ・割引情報のチェックボックスを全てチェック
      document.querySelectorAll('input[id^="hashtag-checkbox-"]').forEach(cb => {
        cb.checked = true;
      });
      document.querySelectorAll('input[id^="discount-checkbox-"]').forEach(cb => {
        cb.checked = true;
      });

      // 折りたたみ状態をリセット（閉じる）
      const hashtagSection = document.getElementById('hashtagSection');
      const hashtagToggle = document.getElementById('hashtagToggle');
      if (hashtagSection && hashtagToggle) {
        hashtagSection.style.display = 'none';
        hashtagToggle.textContent = '▼';
      }

      const discountSection = document.getElementById('discountSection');
      const discountToggle = document.getElementById('discountToggle');
      if (discountSection && discountToggle) {
        discountSection.style.display = 'none';
        discountToggle.textContent = '▼';
      }

      console.log('=== リセット完了（新実装） ===');
    } catch (error) {
      console.error('リセット処理エラー:', error);
      alert('リセット処理中にエラーが発生しました。ページを再読み込みしてください。');
    }
  }

  // ==================== 旧リセット機能（バックアップ） ====================
  /**
   * フォーム全体をリセット（旧実装）
   * すべての入力フィールドをクリアし、デフォルト値（配送情報、仕入・出品情報）を再適用
   * 管理番号の配置設定と形式は保持される（ユーザーの運用方針のため）
   * @throws {Error} リセット処理中にエラーが発生した場合
   */
  function onReset_OLD() {
    try {
      console.log('=== リセット開始 ===');

      // 0. AI生成文をクリア
      window.AI_GENERATED_TEXT = '';

      // 0-1. 画像データをクリア
      if (uploadedImages && uploadedImages.length > 0) {
        uploadedImages = [];
        const container = document.getElementById('imagePreviewContainer');
        if (container) {
          container.style.display = 'none';
        }
        // ファイル入力もリセット
        const fileInput = document.getElementById('productImages');
        if (fileInput) {
          fileInput.value = '';
        }
        console.log('画像データをクリアしました');
      }

      // 1. すべての入力フィールドをクリア
      FIELD_IDS.forEach(k=>{
        const el=document.getElementById(k);
        if(el) {
          el.value='';
          console.log(`クリア: ${k}`);
        }
      });

    // 2. カテゴリプルダウンをリセット
    ['中分類(カテゴリ)','小分類(カテゴリ)','細分類(カテゴリ)','細分類2'].forEach(id=> resetSelect(id, true));
    const l1 = document.getElementById('大分類(カテゴリ)');
    if (l1) l1.value='';

    // 細分類行を非表示
    const saibunruiRow = document.getElementById('saibunruiRow');
    if (saibunruiRow) saibunruiRow.style.display = 'none';

    // 3. その他のフィールドをクリア
    ['サイズ','商品の状態','アイテム名','商品名_アイテム名',
     '商品属性1_カテゴリ','商品属性1_値','商品属性2_カテゴリ','商品属性2_値',
     '商品属性3_カテゴリ','商品属性3_値']
    .forEach(id=>{
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // 4. セールスワードをリセット
    try {
      resetKeywordDropdown();
      const categorySelect = document.getElementById('セールスワード(カテゴリ)');
      if (categorySelect) categorySelect.value = '';

      // デフォルトセールスワードを再適用
      if (typeof defaultSalesword !== 'undefined' && defaultSalesword && defaultSalesword.カテゴリ && defaultSalesword.セールスワード) {
        setTimeout(() => {
          applyDefaultSalesword(defaultSalesword);
          console.log('デフォルトセールスワードを再適用しました');
        }, 100);
      }
    } catch (error) {
      console.error('セールスワードリセットエラー:', error);
    }

    // 5. 商品状態(詳細)をリセット
    const detailInput = document.getElementById('商品状態詳細');
    if (detailInput) detailInput.value = '';

    // 6. 素材フィールドをリセット
    const materialItems = document.querySelectorAll('.material-item');
    materialItems.forEach((item, index) => {
      if (index === 0) {
        const locationSelect = item.querySelector(`#素材1_箇所`);
        const type1Select = item.querySelector(`#素材1_種類1`);
        const percent1Input = item.querySelector(`#素材1_％1`);
        const type2Select = item.querySelector(`#素材1_種類2`);
        const percent2Input = item.querySelector(`#素材1_％2`);
        if (locationSelect) locationSelect.value = '';
        if (type1Select) type1Select.value = '';
        if (percent1Input) percent1Input.value = '';
        if (type2Select) type2Select.value = '';
        if (percent2Input) percent2Input.value = '';
      } else {
        item.remove();
      }
    });
    materialCount = 1;
    updateRemoveButtons();

    // 6.5. カラーフィールドをリセット
    const colorItems = document.querySelectorAll('.color-item');
    colorItems.forEach((item, index) => {
      if (index === 0) {
        const colorSelect = item.querySelector(`#カラー1`);
        if (colorSelect) colorSelect.value = '';
      } else {
        item.remove();
      }
    });
    colorCount = 1;
    updateColorRemoveButtons();

    // 6.6. 商品属性フィールドをリセット
    const attributeItems = document.querySelectorAll('.attribute-item');
    attributeItems.forEach((item, index) => {
      if (index === 0) {
        // 1個目はフィールドをクリア
        const categorySelect = item.querySelector(`#商品属性1_カテゴリ`);
        const valueSelect = item.querySelector(`#商品属性1_値`);
        if (categorySelect) categorySelect.value = '';
        if (valueSelect) {
          valueSelect.value = '';
          valueSelect.disabled = true;
        }
      } else {
        // 2個目以降は削除
        item.remove();
      }
    });
    attributeCount = 1;
    updateAttributeRemoveButtons();
    updateAttributeFields();

    // 6.7. AI用商品属性をクリア
    const aiAttributesField = document.getElementById('AI用商品属性');
    if (aiAttributesField) aiAttributesField.value = '';

    // 6.8. 品番・型番をクリア
    const modelNumberField = document.getElementById('品番型番');
    if (modelNumberField) modelNumberField.value = '';

    // 7. サイズ関連をリセット
    const shoulderLabel = document.getElementById('shoulderWidthLabel');
    if (shoulderLabel) shoulderLabel.textContent = '肩幅';

    const sizeHyokiTop = document.getElementById('サイズ(表記)_トップス');
    const sizeHyokiBottom = document.getElementById('サイズ(表記)_ボトムス');
    const sizeHyokiShoes = document.getElementById('サイズ(表記)_靴');
    const otherSizeShoes = document.getElementById('その他のサイズ表記_靴');
    const usualSizeShoes = document.getElementById('普段のサイズ_靴');
    const fitShoes = document.getElementById('フィット感_靴');

    if (sizeHyokiTop) sizeHyokiTop.value = '';
    if (sizeHyokiBottom) sizeHyokiBottom.value = '';
    if (sizeHyokiShoes) sizeHyokiShoes.value = '';
    if (otherSizeShoes) otherSizeShoes.value = '';
    if (usualSizeShoes) usualSizeShoes.value = '';
    if (fitShoes) fitShoes.value = '';

    const sizeSection = document.getElementById('sizeSection');
    if (sizeSection) sizeSection.style.display = 'none';

    const sizeIconDisplay = document.getElementById('sizeIconDisplay');
    const sizeLabelDisplay = document.getElementById('sizeLabelDisplay');
    if (sizeIconDisplay) sizeIconDisplay.textContent = '👕';
    if (sizeLabelDisplay) sizeLabelDisplay.textContent = 'サイズ';

    // 8. 配送デフォルトを適用
    applyShippingDefaults();

    // 8-2. 仕入・出品デフォルトを適用
    applyProcureListingDefaults();

    // 9. 管理番号関連をリセット
    const p1 = document.getElementById('prefix1');
    if (p1) {
      p1.value = '';
      console.log('prefix1をクリアしました');
    }
    const shelfField = document.getElementById('棚番号');
    if (shelfField) {
      shelfField.value = '';
      console.log('棚番号をクリアしました');
    }

    // 動的に生成される管理番号フィールドをクリア
    const mgmtShelfFirst = document.getElementById('mgmt_shelf_first');
    const mgmtShelfSecond = document.getElementById('mgmt_shelf_second');
    const mgmtCustomFirst = document.getElementById('mgmt_custom_first');
    const mgmtCustomSecond = document.getElementById('mgmt_custom_second');
    if (mgmtShelfFirst) mgmtShelfFirst.value = '';
    if (mgmtShelfSecond) mgmtShelfSecond.value = '';
    if (mgmtCustomFirst) mgmtCustomFirst.value = '';
    if (mgmtCustomSecond) mgmtCustomSecond.value = '';

    // 管理番号プレビューをクリア
    const mgmtNumberField = document.getElementById('管理番号');
    if (mgmtNumberField) mgmtNumberField.value = '';

    // 管理番号の配置チェックボックスと形式は保持（ユーザーの好みなので）

    // buildShelf()を呼ぶと値が戻されるのでコメントアウト
    // buildShelf();

    // 10. ブランドフィールドをクリア
    const brandEnBasic = document.getElementById('ブランド(英語)');
    if (brandEnBasic) brandEnBasic.value = '';

    const brandEn = document.getElementById('商品名_ブランド(英語)');
    const brandKana = document.getElementById('商品名_ブランド(カナ)');
    if (brandEn) brandEn.value = '';
    if (brandKana) brandKana.value = '';

    // ブランドチェックボックスをチェック状態に戻す
    const brandEnCheckbox = document.getElementById('商品名_ブランド(英語)_チェック');
    const brandKanaCheckbox = document.getElementById('商品名_ブランド(カナ)_チェック');
    if (brandEnCheckbox) brandEnCheckbox.checked = true;
    if (brandKanaCheckbox) brandKanaCheckbox.checked = true;

    hideSuggest('ブランド(英語)');
    hideSuggest('商品名_ブランド(英語)');
    hideSuggest('商品名_ブランド(カナ)');

    // 11. プレビューをリセット
    const namePreview = document.getElementById('商品名プレビュー');
    if (namePreview) {
      namePreview.value = '';
      console.log('商品名プレビューをクリア');
    }

    const descPreview = document.getElementById('商品の説明');
    if (descPreview) {
      descPreview.value = '';
      console.log('商品の説明をクリア（後でデフォルト値復活）');
    }

    // 12. メッセージをクリア
    show('');

    // 13. ハッシュタグ・割引情報のチェックボックスを全てチェック
    document.querySelectorAll('input[id^="hashtag-checkbox-"]').forEach(cb => {
      cb.checked = true;
    });
    document.querySelectorAll('input[id^="discount-checkbox-"]').forEach(cb => {
      cb.checked = true;
    });

    // 14. 折りたたみ状態をリセット（閉じる）
    const hashtagSection = document.getElementById('hashtagSection');
    const hashtagToggle = document.getElementById('hashtagToggle');
    if (hashtagSection && hashtagToggle) {
      hashtagSection.style.display = 'none';
      hashtagToggle.textContent = '▼';
    }

    const discountSection = document.getElementById('discountSection');
    const discountToggle = document.getElementById('discountToggle');
    if (discountSection && discountToggle) {
      discountSection.style.display = 'none';
      discountToggle.textContent = '▼';
    }

    // 15. プレビューを再構築（商品名は空、商品の説明はデフォルト値）
    console.log('ブランド表示を更新');
    updateBrandDisplay(); // ブランド情報をクリア

    console.log('商品名プレビュー再構築');
    // updateBrandDisplay()が非同期なので、少し待ってから商品名プレビューを更新
    setTimeout(() => {
      updateNamePreview();
      console.log('商品の説明デフォルト値復活');
      updateDescriptionFromDetail();
    }, 100);

    // 16. 画像をクリア
    uploadedImages = [];
    const imageInput = document.getElementById('productImages');
    if (imageInput) imageInput.value = '';
    displayImagePreviews();
    console.log('画像をクリア');

      console.log('=== リセット完了 ===');
    } catch (error) {
      console.error('リセット処理エラー:', error);
      debug.error('onReset エラー:', error);
      alert('リセット処理中にエラーが発生しました。ページを再読み込みしてください。');
    }
  }

  // クリップボードにコピー
  function copyToClipboard(fieldId, buttonId) {
    const field = document.getElementById(fieldId);
    const button = document.getElementById(buttonId);

    if (!field || !field.value.trim()) {
      alert('コピーする内容がありません');
      return;
    }

    // クリップボードにコピー
    navigator.clipboard.writeText(field.value).then(function() {
      // ボタンのテキストを「✓ コピー済み」に変更
      const originalText = button.innerHTML;
      button.innerHTML = '✓ コピー済み';
      button.style.background = '#c8e6c9';
      button.style.borderColor = '#81c784';
      button.style.color = '#2e7d32';

      // 1秒後に元に戻す
      setTimeout(function() {
        button.innerHTML = originalText;
        button.style.background = '#e3f2fd';
        button.style.borderColor = '#90caf9';
        button.style.color = '#1976d2';
      }, 1000);
    }).catch(function(err) {
      console.error('クリップボードへのコピーに失敗しました:', err);
      alert('コピーに失敗しました。ブラウザの設定を確認してください。');
    });
  }

  // テキストエリアの高さを自動調整
  function autoResizeTextarea(textarea) {
    if (!textarea) return;

    // DOMの更新を待ってから実行
    setTimeout(function() {
      console.log('autoResizeTextarea 実行開始');
      console.log('現在の値の長さ:', textarea.value.length);
      console.log('現在の高さ:', textarea.style.height);

      // 一旦高さをリセットしてscrollHeightを正しく取得
      textarea.style.height = 'auto';

      // scrollHeightを取得
      const scrollHeight = textarea.scrollHeight;
      console.log('scrollHeight:', scrollHeight);

      // scrollHeightに基づいて高さを設定（padding + border分を考慮）
      const newHeight = Math.max(120, scrollHeight + 10);
      textarea.style.height = newHeight + 'px';

      console.log('新しい高さ:', newHeight + 'px');
    }, 50);
  }

  function show(t) {
    const el=document.getElementById('msg');
    if (el) el.textContent = t;
  }

  function unifyConditionList(list) {
    const arr = (list||[]).map(v => (v??'').toString().trim()).filter(v=>v);
    const hasCombined = arr.includes('新品、未使用');
    const idxNew = arr.indexOf('新品');
    const idxUnused = arr.indexOf('未使用');
    if (hasCombined && idxNew === -1 && idxUnused === -1) return arr;
    const earliest = Math.min(
      idxNew === -1 ? Infinity : idxNew,
      idxUnused === -1 ? Infinity : idxUnused
    );
    const out = [];
    let combinedInserted = false;
    for (let i=0; i<arr.length; i++) {
      const v = arr[i];
      if (i === earliest && (idxNew !== -1 || idxUnused !== -1)) {
        if (!combinedInserted) {
          out.push('新品、未使用');
          combinedInserted = true;
        }
        continue;
      }
      if (v === '新品' || v === '未使用') continue;
      if (v === '新品、未使用') {
        if (!combinedInserted) {
          out.push(v);
          combinedInserted = true;
        }
        continue;
      }
      out.push(v);
    }
    if (!combinedInserted && (idxNew !== -1 || idxUnused !== -1)) out.unshift('新品、未使用');
    return out;
  }

  /**
   * ひらがなをカタカナに変換（スマホ対応）
   * 例: "ないき" → "ナイキ"
   */
  function hiraganaToKatakana(str) {
    return str.replace(/[\u3041-\u3096]/g, function(match) {
      var chr = match.charCodeAt(0) + 0x60;
      return String.fromCharCode(chr);
    });
  }

  function attachBrandSuggest(inputId, list) {
    console.log(`attachBrandSuggest called for ${inputId} with list length:`, list ? list.length : 'undefined');
    const input = document.getElementById(inputId);
    const panel = document.getElementById('suggest-' + inputId);
    if (!input || !panel) {
      console.log(`Missing elements for ${inputId}: input=${!!input}, panel=${!!panel}`);
      return;
    }
    let activeIndex = -1;
    const limit = 15;
    const render = (items) => {
      panel.innerHTML = '';
      if (!items.length) {
        panel.innerHTML = '<div class="sug-empty">候補なし</div>';
        panel.hidden = false;
        return;
      }

      // ブランド入力フィールドかどうかを判定
      const isBrandField = inputId === 'ブランド(英語)' || inputId === '商品名_ブランド(英語)';

      items.slice(0, limit).forEach((v, i)=>{
        const div = document.createElement('div');

if (isBrandField) {
            // ブランド(英語)の場合は2行表示
            div.className = 'sug-item brand-item';

            const englishName = v;
            // ペアデータから正確なカナ読みを取得
            const pairIndex = BRAND_INDEX_MAP.get(englishName);
            const kanaName = pairIndex !== undefined && BRAND_PAIRS[pairIndex] ? BRAND_PAIRS[pairIndex].kana : '';

            const escapedEnglishName = String(englishName).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g,
  '&gt;').replace(/"/g, '&quot;');
            const escapedKanaName = String(kanaName).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g,
  '&gt;').replace(/"/g, '&quot;');

            div.innerHTML = `
              <div class="brand-english">${escapedEnglishName}</div>
              <div class="brand-kana">${escapedKanaName}</div>
            `;
          } else {
          // その他のフィールドは従来通り1行表示
          div.className = 'sug-item';
          div.textContent = v;
        }

        div.addEventListener('mousemove', ()=> {
          Array.from(panel.querySelectorAll('.sug-item')).forEach(x=> x.classList.remove('active'));
          div.classList.add('active');
          activeIndex = i;
        });
        div.addEventListener('mousedown', (e)=> {
          e.preventDefault();
        });
        div.addEventListener('click', ()=> {
            // ブランド(英語)の2行表示の場合は英語名のみを取得
            if ((inputId === 'ブランド(英語)' || inputId === '商品名_ブランド(英語)') &&
  div.classList.contains('brand-item')) {
              const englishDiv = div.querySelector('.brand-english');
              input.value = englishDiv ? englishDiv.textContent : '';
            } else {
              input.value = v;
            }
            hide();
            // 基本情報のブランド(英語)選択時は、先に商品名ブロックに反映してから商品名プレビューを更新
            if (inputId === 'ブランド(英語)') {
              updateBrandDisplay();
              updateNamePreview();
              updateDescriptionFromDetail();
            } else {
              updateNamePreview();
              updateDescriptionFromDetail();
            }
          });
        panel.appendChild(div);
      });
      panel.hidden = false;
    };
    const hide = ()=>{
      panel.hidden = true;
      activeIndex = -1;
    };
    const hideLater = ()=> setTimeout(hide, 100);
    const doFilter = ()=>{
      let q = (input.value || '').trim();

      // ひらがなをカタカナに変換（スマホ対応）
      // 例: "ないき" → "ナイキ"
      if (inputId === 'ブランド(英語)' || inputId === '商品名_ブランド(英語)') {
        q = hiraganaToKatakana(q);
      }

      // デバッグ用ログ
      console.log(`doFilter called for ${inputId}, query: "${q}", list length: ${list ? list.length : 'undefined'}`);

      // リストが存在しない場合は何もしない
      if (!Array.isArray(list) || list.length === 0) {
        console.log(`No data available for ${inputId}`);
        hide();
        return;
      }

      if (!q) {
        hide();
        return;
      }

      // 短すぎる検索文字列の場合は処理を制限（パフォーマンス向上）
      if (inputId === 'ブランド(英語)' && q.length < 2 && list.length > 10000) {
        hide();
        return;
      }

      let filtered;

if (inputId === '商品名_ブランド(英語)' || inputId === 'ブランド(英語)') {
        // ブランド(英語)の場合は英語名とカナ読み両方で検索（ペアデータ使用）
        const qq = q.toLowerCase();
        filtered = list.filter(v=>{
          const englishName = String(v).toLowerCase();

          // 完全一致検索
          if (englishName.indexOf(qq) !== -1) {
            return true;
          }

          // 単語境界での部分一致検索（スペース区切り）
          const words = englishName.split(/\s+/);
          if (words.some(word => word.startsWith(qq))) {
            return true;
          }

          // カナ読み検索（ペアデータから正確に取得）
          const pairIndex = BRAND_INDEX_MAP.get(v);
          if (pairIndex !== undefined && BRAND_PAIRS[pairIndex]) {
            const kanaName = String(BRAND_PAIRS[pairIndex].kana || '').toLowerCase();

            // カナ読み完全一致
            if (kanaName.indexOf(qq) !== -1) {
              return true;
            }

            // カナ読み単語境界での部分一致
            const kanaWords = kanaName.split(/[\s・]+/);
            if (kanaWords.some(word => word.startsWith(qq))) {
              return true;
            }
          }

          return false;
        });
        } else if (inputId === 'ブランド(英語)') {
          // 基本情報ブランド(英語)の場合も同様の柔軟検索
          const qq = q.toLowerCase();
          filtered = list.filter(v=>{
            const englishName = String(v).toLowerCase();

            // 完全一致検索
            if (englishName.indexOf(qq) !== -1) {
              return true;
            }

            // 単語境界での部分一致検索（スペース区切り）
            const words = englishName.split(/\s+/);
            if (words.some(word => word.startsWith(qq))) {
              return true;
            }

            // カナ読み検索（ペアデータから正確に取得）
            const pairIndex = BRAND_INDEX_MAP.get(v);
            if (pairIndex !== undefined && BRAND_PAIRS[pairIndex]) {
              const kanaName = String(BRAND_PAIRS[pairIndex].kana || '').toLowerCase();

              // カナ読み完全一致
              if (kanaName.indexOf(qq) !== -1) {
                return true;
              }

              // カナ読み単語境界での部分一致
              const kanaWords = kanaName.split(/[\s・]+/);
              if (kanaWords.some(word => word.startsWith(qq))) {
                return true;
              }
            }

            return false;
          });
        } else {
          // その他のフィールドは従来通り（case-insensitive対応）
          const qq = q.toLowerCase();
          filtered = list.filter(v=>{
            const s = String(v).toLowerCase();
            return s.indexOf(qq) !== -1;
          });
        }

      console.log(`Filtered results for ${inputId}: ${filtered.length} items`);
      render(filtered);
    };
    input.addEventListener('input', () => {
      doFilter();
      // 商品名ブロックのブランドフィールドの場合、常にプレビューを更新（空の場合も含む）
      if (inputId === '商品名_ブランド(英語)' || inputId === '商品名_ブランド(カナ)') {
        updateNamePreview();
      }
    });
    input.addEventListener('focus', doFilter);
    input.addEventListener('blur', hideLater);
    input.addEventListener('keydown', (e)=>{
      if (panel.hidden) return;
      const items = Array.from(panel.querySelectorAll('.sug-item'));
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        items.forEach(x=>x.classList.remove('active'));
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block:'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach(x=>x.classList.remove('active'));
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block:'nearest' });
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0) {
          e.preventDefault();
          const selectedItem = items[activeIndex];

          // ブランド(英語)の2行表示の場合は英語名のみを取得
          if ((inputId === 'ブランド(英語)' || inputId === '商品名_ブランド(英語)') &&
  selectedItem.classList.contains('brand-item')) {
            const englishDiv = selectedItem.querySelector('.brand-english');
            input.value = englishDiv ? englishDiv.textContent : '';
          } else {
            input.value = selectedItem.textContent || '';
          }

          hide();
          updateNamePreview();

          // ブランド(英語)の場合は追加の更新処理
          if (inputId === 'ブランド(英語)') {
            updateBrandDisplay();
            updateDescriptionFromDetail();
          }
        }
      } else if (e.key === 'Escape') {
        hide();
      }
    });
    function hideExternal() {
      hide();
    }
    input._hideSuggest = hideExternal;
  }

  function hideSuggest(inputId) {
    const input = document.getElementById(inputId);
    if (input && input._hideSuggest) input._hideSuggest();
  }

  // ================= 初期化処理 =================
  function initManagementNumberSystem() {
    console.log('🚀 管理番号システム初期化開始');
    // 頭文字・棚番号プルダウンを初期化
    initPrefix1();
      buildShelf();
      const p1 = document.getElementById('prefix1');
    if (p1) {
      p1.addEventListener('change', buildShelf);
        } else {
      console.log('❌ prefix1 フィールドが見つかりません');
    }
    const sh = document.getElementById('棚番号');
    if (sh) {
      sh.addEventListener('change', requestNextManagementNumber);
        } else {
      console.log('❌ 棚番号 フィールドが見つかりません');
    }
  }

  // DOMContentLoaded後に初期化を実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initManagementNumberSystem);
  } else {
    // すでにDOMが読み込まれている場合は即座に実行
    initManagementNumberSystem();
  }

  // カテゴリマスタ読み込みは即座実行（非同期なのでOK）
  (function() {

    // カテゴリマスタ取得（PWA版：Firestoreから直接取得）
    (async function loadCategoryMaster() {
      try {
        // グローバルに定義されたdbを使用
        if (!window.db) {
          console.error('❌ Firestoreが初期化されていません');
          show('NG(MASTER): Firestoreが初期化されていません');
          return;
        }
        const db = window.db;
        const docRef = db.collection('categories').doc('master');
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          show('NG(MASTER): カテゴリマスタが見つかりません');
          return;
        }

        const data = docSnap.data();
        const rows = data.rows || [];

        CAT_ROWS = rows.map(r=>({
          大分類:String(r.大分類||'').trim(),
          中分類:String(r.中分類||'').trim(),
          小分類:String(r.小分類||'').trim(),
          細分類:String(r.細分類||'').trim(),
          細分類2:String(r.細分類2||'').trim(),
          アイテム名:String(r.アイテム名||'').trim(),
        }));
        const l1s = uniqKeepOrder(CAT_ROWS.map(r=>r.大分類));
        fillSelectSafe(document.getElementById('大分類(カテゴリ)'), l1s);

        // カテゴリプルダウンのイベントリスナーを設定
        const l1Select = document.getElementById('大分類(カテゴリ)');
        const l2Select = document.getElementById('中分類(カテゴリ)');
        const l3Select = document.getElementById('小分類(カテゴリ)');
        const l4Select = document.getElementById('細分類(カテゴリ)');
        const l5Select = document.getElementById('細分類2');
        const itemSelect = document.getElementById('アイテム名');
        if (l1Select) {
          l1Select.addEventListener('change', onL1Changed);
          debug.log('大分類のイベントリスナーを設定しました');
        }
        if (l2Select) {
          l2Select.addEventListener('change', onL2Changed);
          debug.log('中分類のイベントリスナーを設定しました');
        }
        if (l3Select) {
          l3Select.addEventListener('change', onL3Changed);
          debug.log('小分類のイベントリスナーを設定しました');
        }
        if (l4Select) l4Select.addEventListener('change', onL4Changed);
        if (l5Select) l5Select.addEventListener('change', onL5Changed);
        if (itemSelect) itemSelect.addEventListener('change', updateItemNameDisplay);

        // 基本情報のサイズプルダウンのイベントリスナーを設定（商品の説明ブロックに連動）
        const sizeSelect = document.getElementById('サイズ');
        if (sizeSelect) {
          sizeSelect.addEventListener('change', syncBasicSizeToDescription);
          debug.log('サイズプルダウンのイベントリスナーを設定しました');
        }

        wirePreviewWatchers();
        updateNamePreview();
        adjustPreviewHeight();

        console.log('✅ カテゴリマスタ読み込み完了:', CAT_ROWS.length + '件');
      } catch (error) {
        console.error('❌ カテゴリマスタ読み込みエラー:', error);
        show(`NG(MASTER): ${error && error.message ? error.message : error}`);
      }
    })(); // 即座実行

    // マスタオプション取得（PWA版：Firestoreから直接取得）
    (async function loadMasterOptions() {
      try {
        // グローバルに定義されたdbを使用
        if (!window.db) {
          console.error('❌ Firestoreが初期化されていません');
          show('NG(MASTER): Firestoreが初期化されていません');
          return;
        }
        const db = window.db;

        // masterOptionsコレクション全体を取得（各フィールドが個別ドキュメント）
        const snapshot = await db.collection('masterOptions').get();

        if (snapshot.empty) {
          show('NG(MASTER): マスタオプションが見つかりません');
          return;
        }

        // 各ドキュメントからフィールドを再構築
        const opts = {};
        snapshot.forEach(doc => {
          const data = doc.data();
          // _indexドキュメントはスキップ
          if (doc.id === '_index') return;

          // fieldName と items を取得
          if (data.fieldName && data.items) {
            opts[data.fieldName] = data.items;
          }
        });

        if (Object.keys(opts).length === 0) {
          show('NG(MASTER): 空の応答');
          return;
        }

        console.log('✅ マスタオプション取得完了:', Object.keys(opts).length + 'フィールド');

        // マスターオプションをグローバル変数に保存
        MASTER_OPTIONS = opts;

        const fillSel=(id,arr)=>{
          const sel=document.getElementById(id);
          if(!sel) return;
          sel.innerHTML='<option value="">--</option>';
          (arr||[]).forEach(v=> sel.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`));
        };

        // 基本フィールド
        fillSel('担当者', opts['担当者']||[]);
        fillSel('仕入先', opts['仕入先']||[]);
        fillSel('生地・素材・質感系', opts['生地・素材・質感系']||[]);
        fillSel('サイズ', opts['サイズ']||[]);
        fillSel('商品の状態', unifyConditionList(opts['商品の状態']||[]));

        // サイズ(表記)の選択肢を設定
        fillSel('サイズ(表記)_トップス', opts['サイズ(表記)']||[]);
        fillSel('サイズ(表記)_ボトムス', opts['サイズ(表記)']||[]);

        // ブランドデータ（Firestore版に移行）
        // モジュール読み込み完了を待ってからAlgolia版ブランド検索を初期化
        const initAlgoliaBrandSearch = () => {
          if (typeof window.attachBrandSuggestAlgolia === 'function') {
            console.log('🔍 Algolia版ブランド検索を初期化');

            // 基本情報ブロックのブランド(英語)フィールド
            window.attachBrandSuggestAlgolia('ブランド(英語)', {
              limit: 15,
              minChars: 1,
              debounceMs: 300
            });

            // 商品名ブロックのブランド(英語)フィールド
            window.attachBrandSuggestAlgolia('商品名_ブランド(英語)', {
              limit: 15,
              minChars: 1,
              debounceMs: 300
            });

                    } else {
            console.warn('⏳ Algoliaモジュール読み込み中... 1秒後に再試行');
            setTimeout(initAlgoliaBrandSearch, 1000);
          }
        };

        // モジュール読み込み完了を待機
        if (window.algoliaBrandModulesLoaded) {
          initAlgoliaBrandSearch();
        } else {
          // 読み込み完了を監視
          const checkInterval = setInterval(() => {
            if (window.algoliaBrandModulesLoaded) {
              clearInterval(checkInterval);
              initAlgoliaBrandSearch();
            }
          }, 100);
        }

        // タイトル情報フィールド
        [
          '季節感・機能性','着用シーン・イベント','見た目・印象','トレンド表現',
          'サイズ感・体型カバー','年代・テイスト・スタイル','カラー/配色/トーン','柄・模様',
          'ディテール・仕様','シルエット/ライン','ネックライン','襟・衿',
          '袖・袖付け','丈','革/加工','毛皮/加工','生産国'
        ].forEach(name => fillSel(name, opts[name]||[]));

        // 出品・配送関連
        fillSel('出品先', opts['出品先']||[]);
        fillSel('配送料の負担', opts['配送料の負担']||[]);
        fillSel('配送の方法', opts['配送の方法']||[]);
        fillSel('発送元の地域', opts['発送元の地域']||[]);
        fillSel('発送までの日数', opts['発送までの日数']||[]);

        applyShippingDefaults();
        applyProcureListingDefaults();

        // サイズ・商品の状態などのイベントリスナーを設定
        const sizeSelect = document.getElementById('サイズ');
        if (sizeSelect) {
          sizeSelect.removeEventListener('change', updateNamePreview);
          sizeSelect.addEventListener('change', updateNamePreview);
          console.log('サイズプルダウンのイベントリスナー設定完了');
        }

        const conditionSelect = document.getElementById('商品の状態');
        if (conditionSelect) {
          conditionSelect.removeEventListener('change', updateDescriptionFromDetail);
          conditionSelect.addEventListener('change', updateDescriptionFromDetail);
          conditionSelect.removeEventListener('change', updateConditionButtons);
          conditionSelect.addEventListener('change', updateConditionButtons);
          console.log('商品の状態プルダウンのイベントリスナー設定完了');
        }

        const staffSelect = document.getElementById('担当者');
        if (staffSelect) {
          staffSelect.removeEventListener('change', updateNamePreview);
          staffSelect.addEventListener('change', updateNamePreview);
          console.log('担当者プルダウンのイベントリスナー設定完了');
        }

        // グローバルにマスターオプションを保存（階層式セレクター用）
        window.globalMasterOptions = opts;

        wirePreviewWatchers();
        updateNamePreview();
        adjustPreviewHeight();

            } catch (error) {
        console.error('❌ マスタオプション読み込みエラー:', error);
        show(`NG(MASTER): ${error && error.message ? error.message : error}`);
      }
    })(); // 即座実行

// 階層式商品属性セレクター設定
  setupAttributeSelectors();

  // 動的サイズシステム設定
  setupSizeSystem();

    // セールスワード専用初期化
    initializeSalesWords();

    // 設定マスタ全体を読み込み（配置順序を含む）
    loadAllConfig();

    // 設定マスタから商品状態ボタンを読み込み
    loadConditionButtonsFromConfig();

    // 設定マスタからハッシュタグ設定を読み込み
    loadHashtagConfig();

    // 設定マスタから割引情報を読み込み
    loadDiscountConfig();

    // 設定マスタから配送デフォルトを読み込み
    loadShippingDefaults();

    // 設定マスタから仕入・出品デフォルトを読み込み
    loadProcureListingDefaults();

    // 担当者名を読み込み（PropertiesService）
    loadOperatorName();

    // 設定マスタから商品名ブロック並び順を読み込み
    loadTitleBlockOrder();

    // イベントリスナー設定
    const l1=document.getElementById('大分類(カテゴリ)');
    if (l1) l1.addEventListener('change', onL1Changed);
    const l2=document.getElementById('中分類(カテゴリ)');
    if (l2) l2.addEventListener('change', onL2Changed);
    const l3=document.getElementById('小分類(カテゴリ)');
    if (l3) l3.addEventListener('change', onL3Changed);
    const l4=document.getElementById('細分類(カテゴリ)');
    if (l4) l4.addEventListener('change', onL4Changed);
    const l5=document.getElementById('細分類2');
    if (l5) l5.addEventListener('change', onL5Changed);
    const itemName=document.getElementById('アイテム名');
    if (itemName) itemName.addEventListener('change', updateItemNameDisplay);

    // セールスワード専用イベント設定
    setupSalesWordEventListeners();

    wireDescWatcher();

    // 商品状態(詳細)イベントリスナー設定を追加
    setupDetailEventListener();

    // クイック挿入ボタン設定
    setupQuickInsertButtons();

    // 素材マスターデータ初期化
    initializeMaterialMasters();

    // カラーマスターデータ初期化
    initializeColorMasters();

    // 管理番号UI初期化（動的セグメント対応）
    initManagementNumberUI();

    // ★ 別タブから設定変更通知を受信（BroadcastChannel）
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('reborn_config_updates');
      channel.addEventListener('message', async (event) => {
        if (event.data && event.data.type === 'configChanged') {
          console.log('📥 BroadcastChannelで設定変更通知を受信しました:', event.data.timestamp);

          // localStorageから最新設定を読み込み
          const cachedConfigStr = localStorage.getItem('rebornConfig_managementNumber');
          if (cachedConfigStr) {
            try {
              const newConfig = JSON.parse(cachedConfigStr);
              window.managementNumberConfig = newConfig;
              console.log('✅ グローバル変数を更新しました:', newConfig);

              // UIも再描画
              if (newConfig.segments && newConfig.segments.length > 0) {
                renderManagementSegmentUI(newConfig.segments);
                console.log('✅ 管理番号UIを再描画しました');
              }
            } catch (e) {
              console.error('❌ localStorage設定のパースに失敗:', e);
            }
          }
        }
      });
      console.log('📡 BroadcastChannelリスナー起動完了（reborn_config_updates）');
    } else {
      console.warn('⚠️ BroadcastChannel非対応ブラウザ（設定変更の自動反映不可）');
    }

    // 素材追加ボタンのイベントリスナー
    const addBtn = document.getElementById('addMaterialBtn');
    if (addBtn) {
      addBtn.addEventListener('click', addMaterial);
    }

    // カラー追加ボタンのイベントリスナー
    const addColorBtnEl = document.getElementById('addColorBtn');
    if (addColorBtnEl) {
      addColorBtnEl.addEventListener('click', addColor);
    }

    // 商品属性追加ボタンのイベントリスナー
    const addAttributeBtn = document.getElementById('addAttributeBtn');
    if (addAttributeBtn) {
      addAttributeBtn.addEventListener('click', addAttribute);
    }

    // 初期の商品属性セットアップ
    populateAttributeCategory(1);
    setupAttributeSelector(1);
    updateAttributeRemoveButtons();

    // 素材入力フィールドの変更監視
    document.addEventListener('change', function(e) {
      if (e.target.classList.contains('material-location') ||
          e.target.classList.contains('material-type') ||
          e.target.classList.contains('material-percent')) {
        updateDescriptionFromDetail();
      }
    });

    // 商品状態履歴を取得してオートコンプリート設定
    if (typeof google !== 'undefined' && google.script && google.script.run) {
      google.script.run
        .withSuccessHandler(function(history) {
          CONDITION_HISTORY = history || [];
          console.log('商品状態履歴取得完了:', CONDITION_HISTORY.length, '件');

          // オートコンプリートを設定
          attachConditionSuggest('商品状態詳細', CONDITION_HISTORY);
        })
        .withFailureHandler(function(error) {
          console.error('商品状態履歴取得エラー:', error);
          // エラー時もボタンは使えるようにする
          attachConditionSuggest('商品状態詳細', []);
        })
        .getProductConditionHistory();
    }

    window.addEventListener('resize', ()=>{
      adjustPreviewHeight();
      adjustDescHeight();
    });
  })();

  // ================= 動的サイズ機能 =================
  function setupSizeSystem() {
    // サイズプルダウンに数値選択肢を設定
    const sizeFields = ['肩幅', '身幅', '袖丈', '着丈', 'ウエスト', 'ヒップ', '股上', '股下'];

    sizeFields.forEach(fieldId => {
      const select = document.getElementById(fieldId);
      if (select) {
        // 20cm〜120cmまで1cm刻みで選択肢を生成
  for (let i = 20; i <= 120; i += 1) {
    const option = document.createElement('option');
    option.value = i.toString();
    option.textContent = i.toString();
    select.appendChild(option);
  }

        // サイズ選択時に説明文を更新
        select.addEventListener('change', updateDescriptionFromDetail);
      }
    });

    // 小分類変更時のサイズ表示切り替え
    const subcategorySelect = document.getElementById('小分類(カテゴリ)');
    if (subcategorySelect) {
      subcategorySelect.addEventListener('change', updateSizeDisplay);
    }

    // 初期表示設定
    updateSizeDisplay();
  }

  // カテゴリに応じたアイコンとラベルを取得
  function getSizeIconAndLabel(subcategory) {
    // アイコンマッピング（大分類・中分類・アイテム名に対応）
    const iconMap = {
      // トップス系
      'Tシャツ': { icon: '👕', label: 'Tシャツ' },
      'シャツ': { icon: '👔', label: 'シャツ' },
      'ニット': { icon: '👕', label: 'ニット' },
      'セーター': { icon: '👕', label: 'セーター' },
      'パーカー': { icon: '🧥', label: 'パーカー' },
      'スウェット': { icon: '👕', label: 'スウェット' },
      'ジャケット': { icon: '🧥', label: 'ジャケット' },
      'ブレザー': { icon: '🧥', label: 'ブレザー' },
      'カーディガン': { icon: '🧥', label: 'カーディガン' },
      'ベスト': { icon: '🦺', label: 'ベスト' },
      'タンクトップ': { icon: '🎽', label: 'タンクトップ' },
      'キャミソール': { icon: '👗', label: 'キャミソール' },
      'ブラウス': { icon: '👚', label: 'ブラウス' },
      'チュニック': { icon: '👚', label: 'チュニック' },
      'ワンピース': { icon: '👗', label: 'ワンピース' },
      'コート': { icon: '🧥', label: 'コート' },
      'ダウンジャケット': { icon: '🧥', label: 'ダウンジャケット' },
      'アウター': { icon: '🧥', label: 'アウター' },
      'ジャンパー': { icon: '🧥', label: 'ジャンパー' },

      // ボトムス系
      'パンツ': { icon: '👖', label: 'パンツ' },
      'ジーンズ': { icon: '👖', label: 'ジーンズ' },
      'デニム': { icon: '👖', label: 'デニム' },
      'チノパン': { icon: '👖', label: 'チノパン' },
      'スラックス': { icon: '👔', label: 'スラックス' },
      'ショートパンツ': { icon: '🩳', label: 'ショートパンツ' },
      'ハーフパンツ': { icon: '🩳', label: 'ハーフパンツ' },
      'レギンス': { icon: '👖', label: 'レギンス' },
      'スパッツ': { icon: '👖', label: 'スパッツ' },
      'ジョガーパンツ': { icon: '👖', label: 'ジョガーパンツ' },
      'カーゴパンツ': { icon: '👖', label: 'カーゴパンツ' },
      'スカート': { icon: '👗', label: 'スカート' },
      'ミニスカート': { icon: '👗', label: 'ミニスカート' },
      'マキシスカート': { icon: '👗', label: 'マキシスカート' },
      'プリーツスカート': { icon: '👗', label: 'プリーツスカート' }
    };

    // デフォルトアイコン
    const defaultTops = { icon: '👕', label: 'トップス' };
    const defaultBottoms = { icon: '👖', label: 'パンツ' };

    // 部分一致でマッピング検索
    for (const [key, value] of Object.entries(iconMap)) {
      if (subcategory && subcategory.includes(key)) {
        return value;
      }
    }

    // 見つからない場合はデフォルト
    return null;
  }

  function updateSizeDisplay() {
    const subcategory = _val('小分類(カテゴリ)');
    const sizeSection = document.getElementById('sizeSection');
    const topsSize = document.getElementById('topsSize');
    const bottomsSize = document.getElementById('bottomsSize');
    const shoesSize = document.getElementById('shoesSize');
    const sizeIconDisplay = document.getElementById('sizeIconDisplay');
    const sizeLabelDisplay = document.getElementById('sizeLabelDisplay');

    if (!sizeSection || !topsSize || !bottomsSize || !shoesSize) return;

    // カテゴリマッピング
    const topsCategories = [
      'Tシャツ', 'シャツ', 'ニット', 'セーター', 'パーカー', 'スウェット',
      'ジャケット', 'ブレザー', 'カーディガン', 'ベスト', 'タンクトップ',
      'キャミソール', 'ブラウス', 'チュニック', 'ワンピース',
      'コート', 'ダウンジャケット', 'アウター', 'ジャンパー'
    ];

    const bottomsCategories = [
      'パンツ', 'ジーンズ', 'デニム', 'チノパン', 'スラックス', 'ショートパンツ',
      'ハーフパンツ', 'レギンス', 'スパッツ', 'ジョガーパンツ', 'カーゴパンツ',
      'スカート', 'ミニスカート', 'マキシスカート', 'プリーツスカート'
    ];

    const setCategories = [
      'スーツ', 'セットアップ', 'パジャマ', 'ルームウェア', 'ジャージ',
      'トラックスーツ', 'スポーツウェア', '作業着', 'つなぎ'
    ];

    const shoesCategories = [
      'スニーカー', 'ローファー', 'ブーツ', 'サンダル', 'パンプス',
      'レザーシューズ', 'スポーツシューズ', 'ランニングシューズ',
      'バスケットシューズ', 'スケートシューズ', 'ハイカットスニーカー',
      'ローカットスニーカー', 'スリッポン', 'モカシン', 'デッキシューズ'
    ];

    // 表示状態をリセット
    sizeSection.style.display = 'none';
    topsSize.style.display = 'none';
    bottomsSize.style.display = 'none';
    shoesSize.style.display = 'none';

    if (!subcategory) return;

    // アイコンとラベルを取得
    const iconData = getSizeIconAndLabel(subcategory);

    // ラグラン判定（アイテム名で判定）
    const itemName = _val('アイテム名');
    const isRaglan = itemName && itemName.includes('ラグラン');

    // カテゴリに応じて表示切り替え＆アイコン更新
    if (topsCategories.some(cat => subcategory.includes(cat))) {
      sizeSection.style.display = 'block';
      topsSize.style.display = 'block';
      if (iconData && sizeIconDisplay && sizeLabelDisplay) {
        sizeIconDisplay.textContent = iconData.icon;
        sizeLabelDisplay.textContent = iconData.label;
      }
      // ラグラン例外処理: 肩幅→裄丈
      const shoulderLabel = document.getElementById('shoulderWidthLabel');
      if (shoulderLabel) {
        shoulderLabel.textContent = isRaglan ? '裄丈' : '肩幅';
      }
    } else if (bottomsCategories.some(cat => subcategory.includes(cat))) {
      sizeSection.style.display = 'block';
      bottomsSize.style.display = 'block';
      if (iconData && sizeIconDisplay && sizeLabelDisplay) {
        sizeIconDisplay.textContent = iconData.icon;
        sizeLabelDisplay.textContent = iconData.label;
      }
    } else if (setCategories.some(cat => subcategory.includes(cat))) {
      sizeSection.style.display = 'block';
      topsSize.style.display = 'block';
      bottomsSize.style.display = 'block';
      if (iconData && sizeIconDisplay && sizeLabelDisplay) {
        sizeIconDisplay.textContent = iconData.icon;
        sizeLabelDisplay.textContent = iconData.label;
      }
      // ラグラン例外処理: 肩幅→裄丈
      const shoulderLabel = document.getElementById('shoulderWidthLabel');
      if (shoulderLabel) {
        shoulderLabel.textContent = isRaglan ? '裄丈' : '肩幅';
      }
    } else if (shoesCategories.some(cat => subcategory.includes(cat))) {
      // 靴の場合
      sizeSection.style.display = 'block';
      shoesSize.style.display = 'block';
      if (sizeIconDisplay && sizeLabelDisplay) {
        sizeIconDisplay.textContent = '👟';
        sizeLabelDisplay.textContent = 'サイズ（靴）';
      }

      // サイズ(表記)_靴のselectに選択肢を設定
      const shoesSizeSelect = document.getElementById('サイズ(表記)_靴');
      const basicSizeSelect = document.getElementById('サイズ');
      if (shoesSizeSelect && basicSizeSelect) {
        // 基本情報のサイズプルダウンの選択肢をコピー
        const currentValue = shoesSizeSelect.value;
        shoesSizeSelect.innerHTML = '';

        // 基本情報の全選択肢をコピー
        Array.from(basicSizeSelect.options).forEach(option => {
          const newOption = document.createElement('option');
          newOption.value = option.value;
          newOption.textContent = option.textContent;
          shoesSizeSelect.appendChild(newOption);
        });

        // 基本情報で選択されている値があれば同期
        const basicSize = basicSizeSelect.value;
        if (basicSize) {
          shoesSizeSelect.value = basicSize;
        } else if (currentValue) {
          // 以前の選択値を復元
          shoesSizeSelect.value = currentValue;
        }
      }

      console.log('★★★ updateSizeDisplay() で靴のサイズセクションを表示しました');
    }

    // 説明文を更新
    updateDescriptionFromDetail();
  }

  // グローバル関数設定
  window.onSave = onSave;
  window.onReset = onReset;
  window.initPrefix1 = initPrefix1;
  window.buildShelf = buildShelf;
  window.requestNextManagementNumber = requestNextManagementNumber;
  window.updateDescriptionFromDetail = updateDescriptionFromDetail;
  window.setupDetailEventListener = setupDetailEventListener;

  // ================= 階層式商品属性セレクター =================
  function setupAttributeSelectors() {
    // 商品属性1
    const category1 = document.getElementById('商品属性1_カテゴリ');
    const value1 = document.getElementById('商品属性1_値');
    if (category1 && value1) {
      category1.addEventListener('change', function() {
        updateAttributeValues('商品属性1_カテゴリ', '商品属性1_値');
      });
    }

    // 商品属性2
    const category2 = document.getElementById('商品属性2_カテゴリ');
    const value2 = document.getElementById('商品属性2_値');
    if (category2 && value2) {
      category2.addEventListener('change', function() {
        updateAttributeValues('商品属性2_カテゴリ', '商品属性2_値');
      });
    }

    // 商品属性3
    const category3 = document.getElementById('商品属性3_カテゴリ');
    const value3 = document.getElementById('商品属性3_値');
    if (category3 && value3) {
      category3.addEventListener('change', function() {
        updateAttributeValues('商品属性3_カテゴリ', '商品属性3_値');
      });
    }
  }

  function updateAttributeValues(categoryId, valueId) {
    const categorySelect = document.getElementById(categoryId);
    const valueSelect = document.getElementById(valueId);

    if (!categorySelect || !valueSelect) return;

    const selectedCategory = categorySelect.value;

    // 値プルダウンをリセット
    valueSelect.innerHTML = '<option value="">--カテゴリを選択してください--</option>';
    valueSelect.disabled = true;

    if (!selectedCategory) {
      updateNamePreview();
      return;
    }

    // グローバルなマスターオプションから値を取得
    if (window.globalMasterOptions && window.globalMasterOptions[selectedCategory]) {
      const values = window.globalMasterOptions[selectedCategory];

      if (values && values.length > 0) {
        valueSelect.innerHTML = '<option value="">--選択してください--</option>';
        values.forEach(value => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          valueSelect.appendChild(option);
        });
        valueSelect.disabled = false;

        // 値選択時のイベントリスナーを設定（重複回避のため一度削除）
        valueSelect.removeEventListener('change', updateNamePreview);
        valueSelect.addEventListener('change', updateNamePreview);
      }
    }

    updateNamePreview();
  }

  // 基本情報フィールド変更時にハッシュタグプレビューを更新
  function setupHashtagPreviewListeners() {
    const fieldsToWatch = [
      'ブランド(英語)', 'ブランド(カナ)',
      '大分類(カテゴリ)', '中分類(カテゴリ)', '小分類(カテゴリ)',
      '細分類(カテゴリ)', '細分類2', 'アイテム名'
    ];

    fieldsToWatch.forEach(fieldId => {
      const element = document.getElementById(fieldId);
      if (element) {
        element.addEventListener('change', function() {
          updateHashtagCheckboxPreviews();
        });
      }
    });
  }

  // サイズ(表記)フィールドのイベントリスナーを設定
  function setupSizeHyokiListeners() {
    const sizeHyokiTop = document.getElementById('サイズ(表記)_トップス');
    const sizeHyokiBottom = document.getElementById('サイズ(表記)_ボトムス');

    if (sizeHyokiTop) {
      sizeHyokiTop.addEventListener('change', updateDescriptionFromDetail);
    }
    if (sizeHyokiBottom) {
      sizeHyokiBottom.addEventListener('change', updateDescriptionFromDetail);
    }
  }

  // ラグラン判定のイベントリスナーを設定
  function setupRaglanListener() {
    const itemNameField = document.getElementById('アイテム名');
    if (itemNameField) {
      itemNameField.addEventListener('change', updateSizeDisplay);
    }
  }

  /**
   * 商品の説明ブロックの現在の順序を取得
   * @returns {Array} ブロックタイプの配列
   */
  function getDescriptionBlocksOrder() {
    const container = document.getElementById('descriptionBlocksContainer');
    if (!container) return [];

    const blocks = container.querySelectorAll('.desc-draggable-block');
    return Array.from(blocks).map(block => block.dataset.blockType);
  }

  /**
   * 商品の説明ブロックの開閉トグル
   * @param {HTMLElement} button - クリックされた開閉ボタン
   */
  function toggleDescBlock(button) {
    const block = button.closest('.desc-draggable-block');
    if (!block) return;

    const content = block.querySelector('.section-content');
    if (!content) return;

    const isOpen = content.style.display !== 'none';

    if (isOpen) {
      content.style.display = 'none';
      button.textContent = '▶';
    } else {
      content.style.display = 'block';
      button.textContent = '▼';
    }

    // 開閉状態の保存は「保存」ボタン押下時に行う
  }

  /**
   * AI生成サブブロックの折りたたみ切り替え
   */
  function toggleAiSubBlock(header) {
    const subBlock = header.closest('.ai-sub-block');
    if (!subBlock) return;

    const content = subBlock.querySelector('.ai-sub-content');
    const button = subBlock.querySelector('.ai-sub-collapse-btn');
    if (!content || !button) return;

    const isOpen = content.style.display !== 'none';

    if (isOpen) {
      content.style.display = 'none';
      button.textContent = '▶';
    } else {
      content.style.display = 'block';
      button.textContent = '▼';
    }
  }

  /**
   * 商品名ブロックの開閉トグル
   * @param {HTMLElement} button - クリックされた開閉ボタン
   */
  function toggleTitleBlock(button) {
    const block = button.closest('.title-draggable-block');
    if (!block) return;

    const content = block.querySelector('.section-content');
    if (!content) return;

    const isOpen = content.style.display !== 'none';

    if (isOpen) {
      content.style.display = 'none';
      button.textContent = '▶';
    } else {
      content.style.display = 'block';
      button.textContent = '▼';
    }

    // 開閉状態の保存は「保存」ボタン押下時に行う
  }

  /**
   * 商品の説明ブロックのドラッグ&ドロップを初期化
   */
  function initDescriptionBlocksDragDrop() {
    const container = document.getElementById('descriptionBlocksContainer');
    if (!container) return;

    // Sortable.jsを使用してドラッグ&ドロップを初期化
    Sortable.create(container, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      onEnd: function() {
        // ドロップ後に並び順を保存
        saveDescriptionBlocksOrder();
      }
    });

    console.log('商品の説明ブロックのドラッグ&ドロップを初期化しました');
  }

  /**
   * 商品の説明ブロックの並び順を保存
   */
  function saveDescriptionBlocksOrder() {
    const container = document.getElementById('descriptionBlocksContainer');
    if (!container) return;

    const blocks = container.querySelectorAll('.desc-draggable-block');
    const order = Array.from(blocks).map(block => block.dataset.blockType);

    console.log('商品の説明ブロック並び順を保存:', order);

    // 設定マスタに保存（TODO: config_loader.jsに保存機能を追加）
    // 今は一旦localStorageに保存
    localStorage.setItem('descriptionBlocksOrder', JSON.stringify(order));
  }

  /**
   * 商品の説明ブロックの並び順を読み込み
   */
  function loadDescriptionBlocksOrder() {
    const savedOrder = localStorage.getItem('descriptionBlocksOrder');
    if (!savedOrder) return;

    try {
      const order = JSON.parse(savedOrder);
      const container = document.getElementById('descriptionBlocksContainer');
      if (!container) return;

      // 並び順に応じてブロックを並び替え
      order.forEach(blockType => {
        const block = container.querySelector(`[data-block-type="${blockType}"]`);
        if (block) {
          container.appendChild(block);
        }
      });

      console.log('商品の説明ブロック並び順を復元しました:', order);
    } catch (error) {
      console.error('商品の説明ブロック並び順の読み込みエラー:', error);
    }
  }

  /**
   * 商品の説明ブロックの開閉状態を保存
   */
  function saveDescriptionBlocksCollapseState() {
    const container = document.getElementById('descriptionBlocksContainer');
    if (!container) return;

    const blocks = container.querySelectorAll('.desc-draggable-block');
    const state = {};

    blocks.forEach(block => {
      const content = block.querySelector('.section-content');
      if (content) {
        const blockType = block.dataset.blockType;
        state[blockType] = content.style.display !== 'none';
      }
    });

    console.log('商品の説明ブロック開閉状態を保存:', state);

    // 今は一旦localStorageに保存
    localStorage.setItem('descriptionBlocksCollapseState', JSON.stringify(state));
  }

  /**
   * 商品名ブロックの開閉状態を保存
   */
  function saveTitleBlocksCollapseState() {
    const container = document.getElementById('titleBlockContainer');
    if (!container) return;

    const blocks = container.querySelectorAll('.title-draggable-block');
    const state = {};

    blocks.forEach(block => {
      const content = block.querySelector('.section-content');
      if (content) {
        const blockId = block.dataset.blockId;
        state[blockId] = content.style.display !== 'none';
      }
    });

    console.log('商品名ブロック開閉状態を保存:', state);

    // localStorageに保存
    localStorage.setItem('titleBlocksCollapseState', JSON.stringify(state));
  }

  /**
   * 商品の説明ブロックの開閉状態を読み込み
   */
  function loadDescriptionBlocksCollapseState() {
    const container = document.getElementById('descriptionBlocksContainer');
    if (!container) return;

    const savedState = localStorage.getItem('descriptionBlocksCollapseState');

    // デフォルトで閉じるブロック
    const defaultClosedBlocks = ['discount', 'hashtag'];

    let state = {};

    if (savedState) {
      try {
        state = JSON.parse(savedState);
        console.log('商品の説明ブロック開閉状態を復元しました:', state);
      } catch (error) {
        console.error('商品の説明ブロック開閉状態の読み込みエラー:', error);
        // エラー時はデフォルト状態を使用
        defaultClosedBlocks.forEach(blockType => {
          state[blockType] = false;
        });
      }
    } else {
      // 初回読み込み時はデフォルトで閉じる
      defaultClosedBlocks.forEach(blockType => {
        state[blockType] = false;
      });
      console.log('デフォルト開閉状態を適用しました:', state);
    }

    // すべてのブロックに開閉状態を適用
    const blocks = container.querySelectorAll('.desc-draggable-block');
    blocks.forEach(block => {
      const blockType = block.dataset.blockType;
      const content = block.querySelector('.section-content');
      const button = block.querySelector('.collapse-btn');

      if (!content || !button) return;

      // stateに含まれている場合はその状態を使用、含まれていない場合は開いた状態
      const isOpen = state[blockType] !== undefined ? state[blockType] : true;

      if (isOpen) {
        content.style.display = 'block';
        button.textContent = '▼';
      } else {
        content.style.display = 'none';
        button.textContent = '▶';
      }
    });
  }

  /**
   * 商品名ブロックの開閉状態を読み込み
   */
  function loadTitleBlocksCollapseState() {
    const container = document.getElementById('titleBlockContainer');
    if (!container) return;

    const savedState = localStorage.getItem('titleBlocksCollapseState');

    let state = {};

    if (savedState) {
      try {
        state = JSON.parse(savedState);
        console.log('商品名ブロック開閉状態を復元しました:', state);
      } catch (error) {
        console.error('商品名ブロック開閉状態の読み込みエラー:', error);
      }
    }

    // すべてのブロックに開閉状態を適用
    const blocks = container.querySelectorAll('.title-draggable-block');
    blocks.forEach(block => {
      const blockId = block.dataset.blockId;
      const content = block.querySelector('.section-content');
      const button = block.querySelector('.collapse-btn');

      if (!content || !button) return;

      // stateに含まれている場合はその状態を使用、含まれていない場合は開いた状態（デフォルト）
      const isOpen = state[blockId] !== undefined ? state[blockId] : true;

      if (isOpen) {
        content.style.display = 'block';
        button.textContent = '▼';
      } else {
        content.style.display = 'none';
        button.textContent = '▶';
      }
    });
  }

  // ページ読み込み時にイベントリスナーを設定
  setTimeout(() => {
    console.log('🚀 ページ初期化開始');
    setupHashtagPreviewListeners();
    setupSizeHyokiListeners();
    setupRaglanListener();
    initTitleBlockDragDrop();
    applyTitleBlockOrder();

    // PropertiesServiceから管理番号配置設定を読み込み（タスクキル後の復元）
    console.log('📞 loadManagementNumberPlacementFromServer() を呼び出し');
    try {
      loadManagementNumberPlacementFromServer();
    } catch (e) {
      console.error('❌ loadManagementNumberPlacementFromServer() エラー:', e);
    }

    // 管理番号フィールドの変更監視を開始
    console.log('📞 setupManagementNumberObserver() を呼び出し');
    try {
      setupManagementNumberObserver();
    } catch (e) {
      console.error('❌ setupManagementNumberObserver() エラー:', e);
    }

    initDescriptionBlocksDragDrop();
    loadDescriptionBlocksOrder();
    loadDescriptionBlocksCollapseState();
    loadTitleBlocksCollapseState();
    }, 1000);
