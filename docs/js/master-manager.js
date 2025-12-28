/**
 * 汎用マスタ管理ロジック
 *
 * master-config.jsで定義されたマスタ設定に基づいて動的にUIを生成し、
 * firestore-api.jsの汎用CRUD APIを使用してマスタデータを管理する
 *
 * MASTER-002: 一覧表示モード実装（master-brand-manager.jsベース）
 * - ひらがな検索対応
 * - バックグラウンドプリロード
 * - キャッシュ検索
 * - 選択モード（一括削除）
 */

// ============================================
// グローバル変数
// ============================================

const MAX_DISPLAY_RESULTS = 100; // 表示件数上限（パフォーマンス対策）

let currentCategory = null;
let currentMasterType = null;
let currentMasterConfig = null;
let allMasterData = [];
let filteredMasterData = [];
let searchDebounceTimer = null;
let masterToDelete = null;
let masterToEdit = null; // 編集中のマスタデータ

// 選択モード関連
let selectionMode = false;
let selectedMasterData = new Set(); // 選択されたマスタID

// キャッシュ管理
let masterCache = {}; // カテゴリ/タイプごとのキャッシュ {collection: [...]}

// 件数管理（動的更新）
let masterTotalCount = 0; // 現在のマスタの総件数

// アコーディオン展開状態管理
let expandedGroups = new Set(); // 展開中のグループ名

// プラットフォーム管理
let currentPlatform = null; // 現在選択中のプラットフォーム

// ============================================
// トースト通知
// ============================================

/**
 * トースト通知を表示
 * @param {string} message - 表示メッセージ
 * @param {string} type - 'success' | 'warning' | 'error'
 */
function showToast(message, type = 'success') {
  // 既存のトーストを削除
  const existingToast = document.querySelector('.master-toast');
  if (existingToast) existingToast.remove();

  const toast = document.createElement('div');
  toast.className = `master-toast master-toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    border-radius: 8px;
    color: white;
    font-size: 14px;
    z-index: 10000;
    animation: toastFadeIn 0.3s ease;
    background: ${type === 'success' ? '#4CAF50' : type === 'warning' ? '#FF9800' : '#F44336'};
  `;

  document.body.appendChild(toast);

  // 3秒後に自動削除
  setTimeout(() => {
    toast.style.animation = 'toastFadeOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// ユーティリティ関数（カタカナ⇔ひらがな変換）
// ============================================

/**
 * カタカナをひらがなに変換
 * @param {string} str - 変換する文字列
 * @returns {string} ひらがなに変換された文字列
 */
function katakanaToHiragana(str) {
  return str.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

/**
 * ひらがなをカタカナに変換
 * @param {string} str - 変換する文字列
 * @returns {string} カタカナに変換された文字列
 */
function hiraganaToKatakana(str) {
  return str.replace(/[\u3041-\u3096]/g, function(match) {
    const chr = match.charCodeAt(0) + 0x60;
    return String.fromCharCode(chr);
  });
}

// ============================================
// GAS版マスタUI表示（フェーズ0: 発送方法・梱包資材）
// ============================================

/**
 * GAS版マスタUIをiframe表示
 * @param {string} type - マスタタイプ（shipping/packaging）
 */
function showGasMasterUI(type) {
  console.log(`🚀 [GAS Master UI] 表示開始: ${type}`);

  // 汎用エンジンのUIを非表示
  hideGenericMasterUI();

  // iframe コンテナを表示
  const iframeContainer = document.getElementById('gasMasterIframeContainer');
  const iframe = document.getElementById('gasMasterIframe');

  if (!iframeContainer || !iframe) {
    console.error('❌ [GAS Master UI] iframeコンテナが見つかりません');
    alert('GAS版マスタUIの表示に失敗しました。');
    return;
  }

  // GAS Web App URLの構築
  const baseUrl = 'https://script.google.com/macros/s/AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA/exec';
  const menuParam = type === 'shipping' ? 'shipping-master' : 'packaging-master';

  // FCMトークンを取得（通知用）
  const fcmToken = localStorage.getItem('fcmToken') || '';
  const fcmParam = fcmToken ? `&fcmToken=${encodeURIComponent(fcmToken)}` : '';

  // セキュリティパラメータ（ユーザーメール）
  const userEmail = localStorage.getItem('userEmail') || '';
  const securityParams = `&userEmail=${encodeURIComponent(userEmail)}`;

  // iframe URLを設定
  iframe.src = `${baseUrl}?menu=${menuParam}${fcmParam}${securityParams}`;

  // iframeコンテナを表示
  iframeContainer.classList.remove('hidden');

  console.log(`✅ [GAS Master UI] 表示完了: ${iframe.src}`);
}

/**
 * 汎用エンジンのUIを非表示
 */
function hideGenericMasterUI() {
  const searchContainer = document.querySelector('.search-container');
  const actionBar = document.querySelector('.action-bar');
  const selectionToolbar = document.getElementById('selectionToolbar');
  const masterListContainer = document.getElementById('masterListContainer');
  const emptyState = document.getElementById('emptyState');

  if (searchContainer) searchContainer.classList.add('hidden');
  if (actionBar) actionBar.classList.add('hidden');
  if (selectionToolbar) selectionToolbar.classList.add('hidden');
  if (masterListContainer) masterListContainer.classList.add('hidden');
  if (emptyState) emptyState.classList.add('hidden');
}

/**
 * GAS版UIを非表示にして汎用エンジンUIを表示
 */
function hideGasMasterUI() {
  // iframeコンテナを非表示
  const iframeContainer = document.getElementById('gasMasterIframeContainer');
  if (iframeContainer) {
    iframeContainer.classList.add('hidden');
  }

  // 汎用エンジンのUIを表示
  const searchContainer = document.querySelector('.search-container');
  const actionBar = document.querySelector('.action-bar');
  const selectionToolbar = document.getElementById('selectionToolbar');
  const masterListContainer = document.getElementById('masterListContainer');
  const emptyState = document.getElementById('emptyState');

  if (searchContainer) searchContainer.classList.remove('hidden');
  if (actionBar) actionBar.classList.remove('hidden');
  // selectionToolbarは選択モード時のみ表示（初期は非表示のまま）
  if (masterListContainer) masterListContainer.classList.remove('hidden');
  // emptyStateは状況に応じて表示（初期は非表示のまま）
}

// ============================================
// 初期化
// ============================================

/**
 * 初期化処理
 */
window.initMasterManager = function() {
  console.log('🚀 [Master Manager] 初期化開始');

  // master-config.jsが読み込まれているか確認
  if (typeof window.masterCategories === 'undefined') {
    console.error('❌ [Master Manager] master-config.js が読み込まれていません');
    alert('マスタ定義設定が読み込まれていません。ページを再読み込みしてください。');
    return;
  }

  console.log('✅ [Master Manager] master-config.js 読み込み確認完了');

  // URLパラメータから初期カテゴリを取得
  const urlParams = new URLSearchParams(window.location.search);
  const urlCategory = urlParams.get('category');

  // カテゴリに応じて不要なアコーディオンを削除（メニュー重複解消）
  if (urlCategory === 'business') {
    // 業務関連マスタのみ表示 → 商品関連アコーディオンを削除
    const productAccordionItem = document.querySelector('[data-bs-target="#productMasterCollapse"]')?.closest('.accordion-item');
    if (productAccordionItem) {
      productAccordionItem.remove();
      console.log('✅ [Master Manager] 商品関連アコーディオン削除（業務関連モード）');
    }

    // 業務関連を開く
    const businessCollapse = document.getElementById('businessMasterCollapse');
    const businessButton = document.querySelector('[data-bs-target="#businessMasterCollapse"]');
    if (businessCollapse && businessButton) {
      businessCollapse.classList.add('show');
      businessButton.classList.remove('collapsed');
      businessButton.setAttribute('aria-expanded', 'true');
    }

    loadMaster('business', 'shipping');
  } else {
    // 商品関連マスタのみ表示 → 業務関連アコーディオンを削除
    const businessAccordionItem = document.querySelector('[data-bs-target="#businessMasterCollapse"]')?.closest('.accordion-item');
    if (businessAccordionItem) {
      businessAccordionItem.remove();
      console.log('✅ [Master Manager] 業務関連アコーディオン削除（商品関連モード）');
    }

    // 初回はブランドを表示（検索専用モード）
    loadMaster('product', 'brand');
  }

  // イベントリスナー設定
  setupEventListeners();

  console.log('✅ [Master Manager] 初期化完了');
};

/**
 * イベントリスナー設定
 */
function setupEventListeners() {
  const searchInput = document.getElementById('searchInput');

  if (!searchInput) {
    console.warn('[Master Manager] 検索入力フィールドが見つかりません');
    return;
  }

  // 入力イベント（デバウンス付き）
  searchInput.addEventListener('input', async (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(async () => {
      const query = searchInput.value.trim();
      await performSearch(query);
    }, 500); // デバウンス時間500ms
  });
}

// ============================================
// マスタロード
// ============================================

/**
 * マスタロード
 */
async function loadMaster(category, type) {
  console.log(`📋 [Master Manager] マスタロード開始: ${category}/${type}`);

  // 全マスタを汎用Firestoreエンジンで表示（GAS版UI廃止）
  hideGasMasterUI();

  // タブグループの表示切り替え
  const productTabs = document.getElementById('product-master-tabs');
  const businessTabs = document.getElementById('business-master-tabs');

  if (productTabs && businessTabs) {
    if (category === 'product') {
      productTabs.style.display = 'block';
      businessTabs.style.display = 'none';
      // 業務タブのアクティブ状態をクリア
      document.querySelectorAll('#businessMasterTabs .nav-link').forEach(tab => {
        tab.classList.remove('active');
      });
    } else if (category === 'business') {
      productTabs.style.display = 'none';
      businessTabs.style.display = 'block';
      // 商品タブのアクティブ状態をクリア
      document.querySelectorAll('#productMasterTabs .nav-link').forEach(tab => {
        tab.classList.remove('active');
      });
    }

    // 現在のタブをアクティブに設定
    const currentTabId = `master-${type}-tab`;
    const currentTab = document.getElementById(currentTabId);
    if (currentTab) {
      // 同じグループ内の他のタブのアクティブを解除
      const tabContainer = category === 'product' ? '#productMasterTabs' : '#businessMasterTabs';
      document.querySelectorAll(`${tabContainer} .nav-link`).forEach(tab => {
        tab.classList.remove('active');
      });
      currentTab.classList.add('active');
    }

    // ヘッダータイトルをカテゴリに応じて変更（v209: 初期非表示→設定後に表示）
    const headerTitle = document.getElementById('headerTitle');
    if (headerTitle) {
      if (category === 'product') {
        headerTitle.textContent = '商品マスタ管理';
      } else if (category === 'business') {
        headerTitle.textContent = '業務マスタ管理';
      }
      // タイトル設定後に表示
      headerTitle.classList.add('visible');
    }
  }

  // window.masterCategoriesの存在確認
  if (!window.masterCategories) {
    console.error('❌ [Master Manager] master-config.js が読み込まれていません');
    alert('マスタ設定が読み込まれていません。ページを再読み込みしてください。');
    return;
  }

  // カテゴリの存在確認
  if (!window.masterCategories[category]) {
    console.error(`❌ [Master Manager] カテゴリが見つかりません: ${category}`);
    alert(`カテゴリ「${category}」が見つかりません。`);
    return;
  }

  // マスタタイプの存在確認
  if (!window.masterCategories[category].masters) {
    console.error(`❌ [Master Manager] カテゴリ「${category}」にmastersが定義されていません`);
    alert(`マスタ設定にエラーがあります。`);
    return;
  }

  currentCategory = category;
  currentMasterType = type;
  currentMasterConfig = window.masterCategories[category].masters[type];

  // マスタタイプ変更時はアコーディオン展開状態をリセット
  expandedGroups.clear();

  if (!currentMasterConfig) {
    console.error(`❌ [Master Manager] マスタ設定が見つかりません: ${category}/${type}`);
    alert(`マスタ「${type}」が見つかりません。`);
    return;
  }

  console.log(`✅ [Master Manager] マスタ設定読み込み完了: ${currentMasterConfig.label}`);

  // ヘッダーにマスタ種別を表示
  updateMasterTypeDisplay();

  // プラットフォームタブの表示/非表示
  if (currentMasterConfig.platformSupport) {
    // デフォルトプラットフォームを先に設定（showPlatformTabsで使用するため）
    currentPlatform = currentMasterConfig.defaultPlatform || currentMasterConfig.platforms[0]?.id;
    
    // キャッシュクリア（新しいプラットフォームデータを取得するため）
    if (window.masterCacheManager && typeof window.masterCacheManager.clearCache === 'function') {
      window.masterCacheManager.clearCache('categories');
    }
    
    showPlatformTabs();
  } else {
    hidePlatformTabs();
    currentPlatform = null;
  }

  // 検索プレースホルダーを更新（カスタム設定がある場合）
  const searchInput = document.getElementById('searchInput');
  if (searchInput && currentMasterConfig.searchPlaceholder) {
    searchInput.placeholder = currentMasterConfig.searchPlaceholder;
  } else if (searchInput) {
    searchInput.placeholder = '絞り込み検索...';
  }

  // initialDisplay設定チェック
  const initialDisplay = currentMasterConfig.initialDisplay !== undefined
    ? currentMasterConfig.initialDisplay
    : (currentMasterConfig.maxDisplayResults || 100);

  if (initialDisplay === 0) {
    // 初期表示なし（検索後のみデータ表示）
    // キャッシュ読み込みもスキップ（検索時のみFirestoreクエリ実行）
    console.log('ℹ️ [Master Manager] 検索専用モード（初期ロードなし、検索時のみFirestoreクエリ）');

    // 空の状態で初期化
    allMasterData = [];
    filteredMasterData = [];

    // 総件数取得（emptyState.showTotalCountがtrueの場合）
    if (currentMasterConfig.emptyState?.showTotalCount) {
      // プラットフォーム別管理の場合はプラットフォーム別件数を取得
      if (currentMasterConfig.platformSupport && currentPlatform) {
        fetchAndDisplayTotalCountByPlatform();
      } else {
        fetchAndDisplayTotalCount();
      }
    } else {
      masterTotalCount = 0;
    }

    renderMasterList();
    updateStats();
  } else {
    // 初期表示あり（従来の動作）
    await loadMasterData();
  }
}

/**
 * マスタタイプ表示更新
 */
function updateMasterTypeDisplay() {
  const masterTypeDisplay = document.getElementById('master-type-display');
  if (masterTypeDisplay && currentMasterConfig) {
    masterTypeDisplay.textContent = currentMasterConfig.label;
  }
}

// ============================================
// プラットフォームタブ関連
// ============================================

/**
 * プラットフォームタブを表示
 */
function showPlatformTabs() {
  let container = document.getElementById('platformTabsContainer');

  // プラットフォーム設定を読み込み
  let platforms = [];

  try {
    const config = JSON.parse(localStorage.getItem('config') || '{}');
    const platformSettings = config.プラットフォーム設定;

    if (platformSettings?.platforms && Array.isArray(platformSettings.platforms)) {
      // 有効なプラットフォームのみ取得（編集済みのname/iconを含む）
      platforms = platformSettings.platforms
        .filter(p => p.enabled)
        .map(p => {
          // デフォルトアイコンを設定
          const defaultConfig = (currentMasterConfig.platforms || []).find(dp => dp.id === p.id);
          return {
            id: p.id,
            name: p.name || defaultConfig?.name || p.id,
            icon: p.icon || defaultConfig?.icon || '/images/platform/default.png'
          };
        });
    }

    // プラットフォーム設定がない場合はデフォルト（メルカリのみ）
    if (platforms.length === 0) {
      const mercariConfig = (currentMasterConfig.platforms || []).find(p => p.id === 'mercari');
      platforms = [{
        id: 'mercari',
        name: mercariConfig?.name || 'メルカリ',
        icon: mercariConfig?.icon || '/images/platform/mercari.png'
      }];
    }

    console.log(`🔧 [Master Manager] 有効なプラットフォーム: ${platforms.map(p => p.id).join(', ')}`);
  } catch (e) {
    console.error('❌ [Master Manager] プラットフォーム設定読み込みエラー:', e);
    // エラー時はデフォルト
    platforms = [{ id: 'mercari', name: 'メルカリ', icon: '/images/platform/mercari.png' }];
  }

  // 有効なプラットフォームが1つ以下なら非表示
  if (platforms.length <= 1) {
    if (container) {
      container.style.display = 'none';
    }
    // 唯一のプラットフォームをデフォルトに設定
    if (platforms.length === 1) {
      currentPlatform = platforms[0].id;
    }
    return;
  }

  // コンテナがなければ作成
  if (!container) {
    container = document.createElement('div');
    container.id = 'platformTabsContainer';
    container.className = 'platform-tabs-container';
    // 商品登録と同じスタイル（product-styles.css準拠）
    container.style.cssText = `
      display: flex;
      background: #ffffff;
      border-bottom: 2px solid #e5e7eb;
      overflow-x: auto;
      overflow-y: hidden;
      -webkit-overflow-scrolling: touch;
      scrollbar-width: none;
    `;

    // action-barの上に挿入
    const actionBar = document.querySelector('.action-bar');
    if (actionBar && actionBar.parentNode) {
      actionBar.parentNode.insertBefore(container, actionBar);
    }
  }

  // デフォルトプラットフォームが有効リストにない場合、最初の有効なものを使用
  if (!platforms.some(p => p.id === currentPlatform)) {
    currentPlatform = platforms[0].id;
  }

  // タブを生成（商品登録CSSと完全一致）
  container.innerHTML = platforms.map(p => {
    const isActive = p.id === currentPlatform;
    const iconSrc = p.icon || '/images/platform/default.png';
    
    return `
    <button class="platform-tab ${isActive ? 'active' : ''}"
            data-platform="${p.id}"
            onclick="selectPlatformTab('${p.id}')"
            style="
              flex: 0 0 auto;
              display: flex;
              align-items: center;
              gap: 6px;
              padding: 10px 14px;
              font-size: 12px;
              font-weight: ${isActive ? '600' : '500'};
              color: ${isActive ? '#40B4E5' : '#6b7280'};
              background: ${isActive ? 'rgba(64, 180, 229, 0.08)' : 'transparent'};
              border: none;
              border-bottom: 3px solid ${isActive ? '#40B4E5' : 'transparent'};
              cursor: pointer;
              transition: all 0.2s ease;
              white-space: nowrap;
              margin-bottom: -2px;
            ">
      <img src="${iconSrc}" alt="${p.name}" style="width: 18px; height: 18px;" onerror="this.innerHTML='🌐';this.style.fontSize='16px'">
      <span>${p.name}</span>
    </button>
  `;
  }).join('');

  container.style.display = 'flex';
}

/**
 * プラットフォームタブを非表示
 */
function hidePlatformTabs() {
  const container = document.getElementById('platformTabsContainer');
  if (container) {
    container.style.display = 'none';
  }
}


/**
 * プラットフォーム間でカテゴリデータをコピー
 * @param {string} sourcePlatform - コピー元プラットフォーム（例: 'mercari'）
 * @param {string} targetPlatform - コピー先プラットフォーム（例: 'mercari-shops'）
 */
window.copyPlatformCategories = async function(sourcePlatform, targetPlatform) {
  if (!confirm(`「${sourcePlatform}」のカテゴリを「${targetPlatform}」にコピーしますか？\n既存の「${targetPlatform}」データは上書きされません。`)) {
    return;
  }

  console.log(`🔄 [Master Manager] カテゴリコピー開始: ${sourcePlatform} → ${targetPlatform}`);

  try {
    // 全カテゴリ取得
    let categories = [];
    if (window.masterCacheManager) {
      categories = await window.masterCacheManager.getCategories();
    } else {
      categories = await window.getMasterData('categories');
    }

    // ソースプラットフォームのデータを抽出
    const sourceData = categories.filter(cat => {
      const catPlatform = cat.platform || 'mercari';
      return catPlatform === sourcePlatform;
    });

    // ターゲットプラットフォームの既存データを取得
    const existingTargetData = categories.filter(cat => cat.platform === targetPlatform);
    const existingKeys = new Set(existingTargetData.map(cat => 
      `${cat.superCategory || ''}|${cat.level1 || ''}|${cat.level2 || ''}|${cat.level3 || ''}|${cat.level4 || ''}|${cat.level5 || ''}|${cat.itemName || ''}`
    ));

    console.log(`📊 [Master Manager] ${sourcePlatform}: ${sourceData.length}件, ${targetPlatform}既存: ${existingTargetData.length}件`);

    // Firestoreにコピー（重複チェック付き）
    const db = firebase.firestore();
    const batch = db.batch();
    let copyCount = 0;

    for (const cat of sourceData) {
      const key = `${cat.superCategory || ''}|${cat.level1 || ''}|${cat.level2 || ''}|${cat.level3 || ''}|${cat.level4 || ''}|${cat.level5 || ''}|${cat.itemName || ''}`;
      
      if (!existingKeys.has(key)) {
        const newDoc = db.collection('categories').doc();
        const newData = { ...cat, platform: targetPlatform };
        delete newData.id; // IDは新規生成
        batch.set(newDoc, newData);
        copyCount++;

        // バッチ制限（500件）に達したらコミット
        if (copyCount % 400 === 0) {
          await batch.commit();
          console.log(`✅ [Master Manager] ${copyCount}件コミット完了`);
        }
      }
    }

    if (copyCount > 0) {
      await batch.commit();
    }

    console.log(`✅ [Master Manager] カテゴリコピー完了: ${copyCount}件追加`);
    alert(`${copyCount}件のカテゴリを「${targetPlatform}」にコピーしました。`);

    // キャッシュクリア
    if (window.masterCacheManager) {
      window.masterCacheManager.clearCache('categories');
    }

    // 画面更新
    if (currentMasterConfig?.platformSupport) {
      fetchAndDisplayTotalCountByPlatform();
    }

  } catch (error) {
    console.error('❌ [Master Manager] カテゴリコピーエラー:', error);
    alert('カテゴリコピー中にエラーが発生しました: ' + error.message);
  }
};

/**
 * プラットフォームタブ選択
 */
window.selectPlatformTab = async function selectPlatformTab(platformId) {
  if (currentPlatform === platformId) return;

  currentPlatform = platformId;

  // タブのアクティブ状態を更新（商品登録CSSと完全一致）
  const container = document.getElementById('platformTabsContainer');
  if (container) {
    container.querySelectorAll('.platform-tab').forEach(tab => {
      const isActive = tab.dataset.platform === platformId;
      
      tab.classList.toggle('active', isActive);
      tab.style.color = isActive ? '#40B4E5' : '#6b7280';
      tab.style.background = isActive ? 'rgba(64, 180, 229, 0.08)' : 'transparent';
      tab.style.fontWeight = isActive ? '600' : '500';
      tab.style.borderBottom = isActive ? '3px solid #40B4E5' : '3px solid transparent';
    });
  }

  console.log(`🔄 [Master Manager] プラットフォーム切り替え: ${platformId}`);

  // キャッシュクリア（プラットフォーム別データを再取得するため）
  delete masterCache[currentMasterConfig.collection];

  // masterCacheManagerのキャッシュもクリア
  if (window.masterCacheManager && typeof window.masterCacheManager.clearCache === 'function') {
    window.masterCacheManager.clearCache('categories');
  }

  // ツリービューのキャッシュもクリア
  if (typeof expandedTreeNodes !== 'undefined') {
    expandedTreeNodes.clear();
  }

  // データ再読み込み
  allMasterData = [];
  filteredMasterData = [];

  // 総件数取得
  if (currentMasterConfig.emptyState?.showTotalCount) {
    await fetchAndDisplayTotalCountByPlatform();
  }

  renderMasterList();
  updateStats();
};

/**
 * プラットフォーム別の総件数を取得
 */
async function fetchAndDisplayTotalCountByPlatform() {
  try {
    masterTotalCount = -1;
    updateEmptyStateCount();

    // プラットフォームでフィルタリングした件数を取得
    let categories = [];
    if (window.masterCacheManager) {
      categories = await window.masterCacheManager.getCategories();
    } else {
      categories = await window.getMasterData(currentMasterConfig.collection);
    }

    // カテゴリはプラットフォーム共通（フィルターしない）
    // 他のマスタはプラットフォームでフィルタリング
    let filtered;
    if (currentMasterConfig.collection === 'categories') {
      // カテゴリは全件表示（プラットフォーム共通）
      filtered = categories;
      console.log(`📊 [Master Manager] カテゴリ: プラットフォーム共通 ${categories.length}件`);
    } else {
      // 他のマスタはプラットフォームでフィルタリング
      filtered = categories.filter(cat => {
        const catPlatform = cat.platform || 'mercari';
        return catPlatform === currentPlatform;
      });
    }
    masterTotalCount = filtered.length;

    // キャッシュに保存
    masterCache[currentMasterConfig.collection] = filtered;
    allMasterData = filtered;
    filteredMasterData = filtered;

    updateEmptyStateCount();
    renderMasterList();

    console.log(`📊 [Master Manager] ${currentPlatform}の件数: ${masterTotalCount}件`);
  } catch (error) {
    console.error('❌ [Master Manager] プラットフォーム別件数取得エラー:', error);
    masterTotalCount = -2;
    updateEmptyStateCount();
  }
}

/**
 * 総件数を非同期で取得して表示を更新
 * Firestoreの count() クエリを使用（高速）
 */
async function fetchAndDisplayTotalCount() {
  try {
    // 先に「読み込み中」表示
    masterTotalCount = -1;
    updateEmptyStateCount();

    // Firestoreから件数取得（数十ms）
    const count = await window.getMasterCount(currentMasterConfig.collection);

    if (count === -1) {
      // APIがエラーを返した場合
      console.warn('⚠️ [Master Manager] 件数取得失敗（API側エラー）');
      masterTotalCount = -2; // エラー状態
      updateEmptyStateCount();
      return;
    }

    masterTotalCount = count;

    // 表示更新
    updateEmptyStateCount();
    console.log(`📊 [Master Manager] 総件数更新: ${count.toLocaleString()}件`);

  } catch (error) {
    console.error('❌ [Master Manager] 件数取得エラー:', error);
    masterTotalCount = -2; // エラー状態
    updateEmptyStateCount();
  }
}

/**
 * 空状態の件数表示を更新
 */
function updateEmptyStateCount() {
  // アクションバーの件数テキストを更新（stats-info内）
  const countEl = document.getElementById('totalCountBadge');
  if (!countEl) return;

  if (masterTotalCount === -1) {
    // 読み込み中 - 非表示
    countEl.classList.add('hidden');
  } else if (masterTotalCount === -2) {
    // エラーまたは取得不可 - 非表示
    countEl.classList.add('hidden');
  } else if (masterTotalCount > 0) {
    countEl.textContent = `${masterTotalCount.toLocaleString()}件`;
    countEl.classList.remove('hidden');
  } else {
    countEl.classList.add('hidden');
  }
}

/**
 * マスタデータ読み込み
 */
/**
 * マスタデータをキャッシュに読み込む（レンダリングなし）
 * initialDisplay: 0 の場合に使用し、検索高速化のため先行読み込みする
 */
async function loadMasterDataToCache() {
  try {
    console.log(`📥 [Master Manager] キャッシュ読み込み開始: ${currentMasterConfig.collection}`);
    showLoading(true);

    // ブランド・カテゴリはmasterCacheManagerを使用（高速化）
    let data;
    if (currentMasterConfig.collection === 'brands' && window.masterCacheManager) {
      console.log('🚀 [Master Manager] ブランドキャッシュから読み込み');
      // キャッシュがあれば即座に返る、なければFirestoreから取得
      data = await window.masterCacheManager.getBrands();
    } else if (currentMasterConfig.collection === 'categories' && window.masterCacheManager) {
      console.log('🚀 [Master Manager] カテゴリキャッシュから読み込み');
      // キャッシュがあれば即座に返る、なければFirestoreから取得
      data = await window.masterCacheManager.getCategories();
    } else {
      // その他のマスタはFirestore APIで取得
      data = await window.getMasterData(currentMasterConfig.collection);
    }

    if (data && data.length > 0) {
      masterCache[currentMasterConfig.collection] = data;
      console.log(`✅ [Master Manager] キャッシュ読み込み完了: ${data.length}件`);
    } else {
      console.log(`ℹ️ [Master Manager] データなし: ${currentMasterConfig.collection}`);
      masterCache[currentMasterConfig.collection] = [];
    }

  } catch (error) {
    console.error(`❌ [Master Manager] キャッシュ読み込みエラー:`, error);
    console.error(`エラー詳細 - コレクション: ${currentMasterConfig.collection}`, error.message || error);

    // 空のキャッシュを設定して処理を継続
    masterCache[currentMasterConfig.collection] = [];

    // ユーザーに通知（詳細情報付き）
    alert(`データの読み込みに失敗しました\n\nコレクション: ${currentMasterConfig.collection}\nエラー: ${error.message || 'Firestore接続エラー'}\n\n「OK」を押すと空の状態で画面を開きます。`);
  } finally {
    showLoading(false);
  }
}

async function loadMasterData() {
  try {
    console.log(`🔄 [Master Manager] データ読み込み開始: ${currentMasterConfig.collection}`);
    showLoading(true);

    // ブランド・カテゴリはmasterCacheManagerを使用（高速化）
    let data;
    if (currentMasterConfig.collection === 'brands') {
      if (window.masterCacheManager) {
        console.log('🚀 [Master Manager] ブランドキャッシュから読み込み');
        // キャッシュがあれば即座に返る、なければFirestoreから取得
        data = await window.masterCacheManager.getBrands();
        console.log(`📦 [Master Manager] ブランドキャッシュ取得結果: ${data ? data.length : 0}件`);
      } else {
        console.warn('⚠️ [Master Manager] masterCacheManager未定義、Firestore APIで取得');
        data = await window.getMasterData('brands');
      }
    } else if (currentMasterConfig.collection === 'categories') {
      if (window.masterCacheManager) {
        console.log('🚀 [Master Manager] カテゴリキャッシュから読み込み');
        // キャッシュがあれば即座に返る、なければFirestoreから取得
        data = await window.masterCacheManager.getCategories();
        console.log(`📦 [Master Manager] カテゴリキャッシュ取得結果: ${data ? data.length : 0}件`);
      } else {
        console.warn('⚠️ [Master Manager] masterCacheManager未定義、Firestore APIで取得');
        data = await window.getMasterData('categories');
      }
    } else {
      // その他のマスタはFirestore APIで取得
      data = await window.getMasterData(currentMasterConfig.collection);
    }

    if (data && data.length > 0) {
      allMasterData = data;
      filteredMasterData = data;

      console.log(`✅ [Master Manager] データ読み込み完了: ${data.length}件`);

      // キャッシュに保存
      masterCache[currentMasterConfig.collection] = data;
    } else {
      console.log(`ℹ️ [Master Manager] データなし: ${currentMasterConfig.collection}`);

      // defaultDataが定義されている場合、自動的に初期データを登録
      if (currentMasterConfig.defaultData && currentMasterConfig.defaultData.length > 0) {
        console.log(`🔧 [Master Manager] 初期データを自動登録中: ${currentMasterConfig.defaultData.length}件`);
        try {
          const includeUsageCount = currentMasterConfig.usageCount === true;
          for (const item of currentMasterConfig.defaultData) {
            await window.createMaster(currentMasterConfig.collection, item, includeUsageCount);
          }
          console.log(`✅ [Master Manager] 初期データ登録完了`);

          // 再読み込み
          const newData = await window.getMasterData(currentMasterConfig.collection);
          allMasterData = newData || [];
          filteredMasterData = allMasterData;
          masterCache[currentMasterConfig.collection] = allMasterData;
        } catch (initError) {
          console.error(`❌ [Master Manager] 初期データ登録エラー:`, initError);
          allMasterData = [];
          filteredMasterData = [];
        }
      } else {
        allMasterData = [];
        filteredMasterData = [];
      }
    }

    renderMasterList();
    updateStats();

  } catch (error) {
    console.error(`❌ [Master Manager] データ読み込みエラー:`, error);
    console.error(`エラー詳細 - コレクション: ${currentMasterConfig.collection}`, error.message || error);

    // 空のデータを設定して処理を継続
    allMasterData = [];
    filteredMasterData = [];
    renderMasterList();
    updateStats();

    // ユーザーに通知（詳細情報付き）
    alert(`データの読み込みに失敗しました\n\nコレクション: ${currentMasterConfig.collection}\nエラー: ${error.message || 'Firestore接続エラー'}\n\n「OK」を押すと空の状態で画面を開きます。`);
  } finally {
    showLoading(false);
  }
}

// バックグラウンドプリロード関数は削除（loadMasterDataToCache()に統合）

// ============================================
// 検索・フィルタ
// ============================================

/**
 * 検索実行
 */
async function performSearch(query) {
  const collection = currentMasterConfig.collection;

  if (query.length > 0) {
    console.log(`🔍 [Master Manager] 検索実行: "${query}"`);

    // ひらがなをカタカナに変換
    const katakanaQuery = hiraganaToKatakana(query);

    if (masterCache[collection] && masterCache[collection].length > 0) {
      // ✅ キャッシュから検索（高速）
      console.log('⚡ [Master Manager] キャッシュから検索');
      const lowerQuery = katakanaQuery.toLowerCase();
      const hiraganaQuery = katakanaToHiragana(lowerQuery);

      // searchFields設定を使用して検索（searchTextがない場合にも対応）
      const searchFields = currentMasterConfig.searchFields || ['name'];

      const results = masterCache[collection].filter(item => {
        // searchFieldsの各フィールドを検索対象として結合
        const searchText = searchFields
          .map(field => item[field] || '')
          .join(' ');
        const hiraganaSearchText = katakanaToHiragana(searchText.toLowerCase());
        return hiraganaSearchText.includes(hiraganaQuery);
      });

      allMasterData = results;
      filteredMasterData = results;
      console.log(`✅ [Master Manager] キャッシュ検索結果: ${results.length}件`);
    } else {
      // ❌ キャッシュなし → Firestore検索
      console.log('📡 [Master Manager] Firestore検索');
      showLoading(true);
      try {
        const results = await window.searchMaster(
          collection,
          query,
          currentMasterConfig.searchFields || [],
          currentMasterConfig.maxDisplayResults || 100
        );
        allMasterData = results || [];
        filteredMasterData = results || [];
        console.log(`✅ [Master Manager] Firestore検索結果: ${allMasterData.length}件`);
      } catch (error) {
        console.error('❌ [Master Manager] 検索エラー:', error);
        allMasterData = [];
        filteredMasterData = [];
      } finally {
        showLoading(false);
      }
    }
  } else {
    // 検索クエリなし = 空表示（initialDisplay: 0の場合）
    console.log('🔄 [Master Manager] 検索クリア');
    allMasterData = [];
    filteredMasterData = [];
  }

  renderMasterList();
  updateStats();
}

/**
 * フィルタ適用（従来互換）
 */
function filterMasterData(query) {
  performSearch(query);
}

// ============================================
// 表示更新
// ============================================

/**
 * マスタリスト表示
 */
function renderMasterList() {
  const container = document.getElementById('masterListContainer');
  const emptyState = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');

  if (!container || !emptyState) {
    console.warn('[Master Manager] コンテナ要素が見つかりません');
    return;
  }

  // コンテナクリア
  container.innerHTML = '';

  // 空状態チェック
  if (filteredMasterData.length === 0) {
    container.classList.add('hidden');
    emptyState.classList.remove('hidden');

    // 検索入力があるかどうかで文言を変更
    const hasSearchQuery = searchInput && searchInput.value.trim().length > 0;
    const emptyStateIcon = emptyState.querySelector('.empty-state i, .empty-state-icon');
    const emptyStateText = emptyState.querySelector('.empty-state-text');
    const emptyStateHint = emptyState.querySelector('.empty-state-hint');

    // カスタムemptyState設定があるか確認
    const customEmptyState = currentMasterConfig?.emptyState;

    if (hasSearchQuery) {
      // 検索後に0件の場合
      if (emptyStateIcon) emptyStateIcon.className = 'bi bi-inbox';
      if (emptyStateText) emptyStateText.textContent = 'データが見つかりません';
      if (emptyStateHint) emptyStateHint.textContent = '検索条件を変更してください';
    } else if (customEmptyState) {
      // カスタムemptyState設定がある場合
      if (emptyStateIcon && customEmptyState.icon) {
        emptyStateIcon.textContent = customEmptyState.icon;
        emptyStateIcon.className = 'empty-state-icon';
        emptyStateIcon.style.fontSize = '48px';
        emptyStateIcon.style.marginBottom = '12px';
      }
      if (emptyStateText) {
        emptyStateText.textContent = customEmptyState.message || '検索して絞り込んでください';
      }
      if (emptyStateHint) {
        emptyStateHint.textContent = customEmptyState.hint || '';
      }
    } else {
      // デフォルトの空状態
      if (emptyStateIcon) emptyStateIcon.className = 'bi bi-inbox';
      if (emptyStateText) emptyStateText.textContent = '検索して絞り込んでください';
      if (emptyStateHint) emptyStateHint.textContent = '';
    }
    return;
  }

  // リスト表示
  container.classList.remove('hidden');
  emptyState.classList.add('hidden');

  // viewModeに応じた表示方式を選択
  if (currentMasterConfig.viewMode === 'tree') {
    // ツリービュー表示（カテゴリ用）
    renderCategoryTreeView(container);
    // ツリービューでは上部の「新規追加」ボタンを非表示（ツリー内に追加機能あり）
    const actionBarAddBtn = document.querySelector('.action-bar .btn-add');
    if (actionBarAddBtn) actionBarAddBtn.style.display = 'none';
  } else if (currentMasterConfig.groupBy) {
    // アコーディオン表示
    renderAccordionList(container);
    // 上部の「新規追加」ボタンを表示
    const actionBarAddBtn = document.querySelector('.action-bar .btn-add');
    if (actionBarAddBtn) actionBarAddBtn.style.display = '';
  } else {
    // 従来のフラットリスト表示
    renderFlatList(container);
    // 上部の「新規追加」ボタンを表示
    const actionBarAddBtn = document.querySelector('.action-bar .btn-add');
    if (actionBarAddBtn) actionBarAddBtn.style.display = '';
  }
}

/**
 * フラットリスト表示（従来の表示方式）
 */
function renderFlatList(container) {
  const displayItems = filteredMasterData.slice(0, MAX_DISPLAY_RESULTS);
  const hasMore = filteredMasterData.length > MAX_DISPLAY_RESULTS;

  displayItems.forEach(item => {
    const card = createMasterCard(item);
    container.appendChild(card);
  });

  // 件数超過の場合は通知メッセージを表示
  if (hasMore) {
    const moreNotice = document.createElement('div');
    moreNotice.className = 'more-results-notice';
    moreNotice.innerHTML = `
      <i class="bi bi-info-circle"></i>
      <span>最初の${MAX_DISPLAY_RESULTS}件を表示中（全${filteredMasterData.length}件）</span>
      <small>さらに絞り込むと見つけやすくなります</small>
    `;
    container.appendChild(moreNotice);
  }
}

/**
 * アコーディオン表示（グループ別折りたたみ）
 */
function renderAccordionList(container) {
  const groupBy = currentMasterConfig.groupBy;

  // データをグループ化
  const groups = {};
  filteredMasterData.forEach(item => {
    const groupKey = item[groupBy] || '未分類';
    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(item);
  });

  // グループ名でソート
  const sortedGroupKeys = Object.keys(groups).sort((a, b) => a.localeCompare(b, 'ja'));

  // 検索時のみ全グループを展開（初回表示は全て閉じた状態）
  if (sortedGroupKeys.length > 0) {
    const searchInput = document.getElementById('searchInput');
    const hasSearchQuery = searchInput && searchInput.value.trim().length > 0;
    if (hasSearchQuery) {
      // 検索結果がある場合は全て展開
      sortedGroupKeys.forEach(key => expandedGroups.add(key));
    }
    // 検索なしの場合は全て閉じた状態（自動展開しない）
  }

  // 各グループをアコーディオン形式で表示
  sortedGroupKeys.forEach(groupKey => {
    const groupItems = groups[groupKey];
    const isExpanded = expandedGroups.has(groupKey);

    // グループヘッダー
    const groupHeader = document.createElement('div');
    groupHeader.className = `accordion-header ${isExpanded ? 'expanded' : ''}`;
    groupHeader.innerHTML = `
      <div class="accordion-toggle">
        <i class="bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'}"></i>
        <span class="accordion-title">${escapeHtml(groupKey)}</span>
        <span class="accordion-count">(${groupItems.length}件)</span>
      </div>
    `;
    groupHeader.addEventListener('click', () => toggleAccordion(groupKey));
    container.appendChild(groupHeader);

    // グループ内アイテム（コンテナ）
    const groupContent = document.createElement('div');
    groupContent.className = `accordion-content ${isExpanded ? 'expanded' : ''}`;
    groupContent.setAttribute('data-group', groupKey);

    // CSS Grid アニメーション用の内部ラッパー
    const innerWrapper = document.createElement('div');
    innerWrapper.className = 'accordion-inner';

    if (isExpanded) {
      groupItems.forEach(item => {
        const card = createMasterCard(item, true); // true = ラベル付き表示
        innerWrapper.appendChild(card);
      });
    }

    groupContent.appendChild(innerWrapper);
    container.appendChild(groupContent);
  });
}

/**
 * アコーディオンの展開/収納を切り替え
 */
window.toggleAccordion = function(groupKey) {
  const isCurrentlyExpanded = expandedGroups.has(groupKey);

  if (isCurrentlyExpanded) {
    expandedGroups.delete(groupKey);
  } else {
    expandedGroups.add(groupKey);
  }

  // 該当グループのみ更新
  const header = document.querySelector(`.accordion-header .accordion-title`);
  const allHeaders = document.querySelectorAll('.accordion-header');
  const allContents = document.querySelectorAll('.accordion-content');

  allHeaders.forEach((h, index) => {
    const title = h.querySelector('.accordion-title');
    if (title && title.textContent === groupKey) {
      const content = allContents[index];
      const icon = h.querySelector('i');

      if (expandedGroups.has(groupKey)) {
        h.classList.add('expanded');
        content.classList.add('expanded');
        icon.className = 'bi bi-chevron-down';

        // コンテンツを動的に生成（accordion-inner内に追加）
        const innerWrapper = content.querySelector('.accordion-inner') || content;
        if (innerWrapper.children.length === 0) {
          const groupBy = currentMasterConfig.groupBy;
          const groupItems = filteredMasterData.filter(item => (item[groupBy] || '未分類') === groupKey);
          groupItems.forEach(item => {
            const card = createMasterCard(item, true);
            innerWrapper.appendChild(card);
          });
        }
      } else {
        h.classList.remove('expanded');
        content.classList.remove('expanded');
        icon.className = 'bi bi-chevron-right';
      }
    }
  });
}

// ============================================
// カテゴリツリービュー
// ============================================

// 展開状態を管理するSet（ツリービュー用）
const expandedTreeNodes = new Set();

/**
 * フラットなカテゴリデータをツリー構造に変換
 * @param {Array} categories - カテゴリデータ配列
 * @returns {Object} ツリー構造
 */
function buildCategoryTree(categories) {
  const tree = {};
  const treeConfig = currentMasterConfig.treeConfig || {};
  const levelFields = treeConfig.levelFields || ['level1', 'level2', 'level3'];

  categories.forEach(cat => {
    const levels = levelFields.map(f => cat[f]).filter(Boolean);

    let current = tree;
    levels.forEach((level, index) => {
      if (!current[level]) {
        current[level] = {
          name: level,
          count: 0,
          children: {},
          items: [],
          level: index + 1,
          path: levels.slice(0, index + 1).join(' > ')
        };
      }
      current[level].count++;

      // 最終レベルの場合、アイテムとして登録
      if (index === levels.length - 1) {
        current[level].items.push(cat);
      }

      current = current[level].children;
    });
  });

  return tree;
}

/**
 * カテゴリツリービューをレンダリング
 * @param {HTMLElement} container - コンテナ要素
 */
function renderCategoryTreeView(container) {
  // ツリー構造を構築（特大分類をルートとして構築）
  const tree = buildCategoryTreeWithSuperCategory(filteredMasterData);

  // 検索時は全ノードを展開
  const searchInput = document.getElementById('searchInput');
  const hasSearchQuery = searchInput && searchInput.value.trim().length > 0;
  if (hasSearchQuery) {
    // 検索結果がある場合は全て展開
    expandAllTreeNodes(tree);
  }

  // ツリーをレンダリング
  const treeWrapper = document.createElement('div');
  treeWrapper.className = 'category-tree-wrapper';

  renderTreeLevel(tree, treeWrapper, 1, []); // 明示的に空配列を渡す

  container.appendChild(treeWrapper);
}

/**
 * 特大分類をルートとしてカテゴリツリーを構築
 */
function buildCategoryTreeWithSuperCategory(categories) {
  const tree = {};
  const cascadeConfig = currentMasterConfig.cascadeAdd || {};
  const treeConfig = currentMasterConfig.treeConfig || {};
  const superCategoryOptions = cascadeConfig.superCategoryOptions || [];
  const level1ToSuperCategoryMap = cascadeConfig.level1ToSuperCategoryMap || {};
  const levelFields = treeConfig.levelFields || ['superCategory', 'level1', 'level2', 'level3', 'level4', 'level5'];

  // 特大分類オプションをルートノードとして初期化
  superCategoryOptions.forEach(superCat => {
    tree[superCat] = {
      name: superCat,
      count: 0,
      children: {},
      items: [],
      level: 1,
      path: superCat,
      isSuperCategory: true
    };
  });

  // デバッグ用カウンター
  const debugStats = {
    total: categories.length,
    skipped: 0,
    bySuperCategory: {}
  };

  // カテゴリデータをツリーに追加
  categories.forEach(cat => {
    // superCategoryを取得（フィールドがない場合はfullPathから推測）
    let superCategory = cat.superCategory || cat[levelFields[0]];
    let subLevels = [];

    // fullPathから階層を推測
    if (cat.fullPath) {
      const pathParts = cat.fullPath.split(' > ');
      if (pathParts.length > 0) {
        const firstPart = pathParts[0];

        // 最初の要素がsuperCategoryOptionsに含まれているか確認
        if (superCategoryOptions.includes(firstPart)) {
          // 正常なフォーマット: "ファッション > メンズ > ..."
          superCategory = firstPart;
          subLevels = pathParts.slice(1);
        } else if (level1ToSuperCategoryMap[firstPart]) {
          // 既存データ互換: "メンズ > ..." → "ファッション" + ["メンズ", ...]
          superCategory = level1ToSuperCategoryMap[firstPart];
          subLevels = pathParts; // 全体がsubLevels（superCategoryは推測値）
        } else {
          // マッピングにない場合はそのまま（新しいsuperCategoryとして扱う）
          superCategory = firstPart;
          subLevels = pathParts.slice(1);
          // デバッグ: マッピングされなかったデータを出力
          console.warn('[CategoryTree] マッピングなし:', { firstPart, fullPath: cat.fullPath });
        }
      }
    }

    // フィールドからsubLevelsを取得（fullPathがない場合のフォールバック）
    if (subLevels.length === 0) {
      subLevels = levelFields.slice(1).map(f => cat[f]).filter(Boolean);
    }

    if (!superCategory) {
      debugStats.skipped++;
      console.warn('[CategoryTree] スキップ: superCategoryなし', { id: cat.id, fullPath: cat.fullPath });
      return;
    }

    // デバッグ: superCategoryごとの件数を追跡
    debugStats.bySuperCategory[superCategory] = (debugStats.bySuperCategory[superCategory] || 0) + 1;

    // 該当する特大分類がなければ作成
    if (!tree[superCategory]) {
      tree[superCategory] = {
        name: superCategory,
        count: 0,
        children: {},
        items: [],
        level: 1,
        path: superCategory,
        isSuperCategory: true
      };
    }

    tree[superCategory].count++;

    let current = tree[superCategory].children;
    let currentPath = superCategory;

    subLevels.forEach((levelValue, index) => {
      currentPath = `${currentPath} > ${levelValue}`;

      if (!current[levelValue]) {
        current[levelValue] = {
          name: levelValue,
          count: 0,
          children: {},
          items: [],
          level: index + 2, // +2 because superCategory is level 1
          path: currentPath
        };
      }
      current[levelValue].count++;

      // 最終レベルの場合、アイテムとして登録
      if (index === subLevels.length - 1) {
        current[levelValue].items.push(cat);
      }

      current = current[levelValue].children;
    });
  });

  // デバッグ: 統計情報を出力
  console.log('[CategoryTree] 統計:', debugStats);

  // ツリー内の件数合計を計算
  let treeTotal = 0;
  Object.keys(tree).forEach(key => {
    treeTotal += tree[key].count;
    console.log(`[CategoryTree] ${key}: ${tree[key].count}件`);
  });
  console.log(`[CategoryTree] ツリー合計: ${treeTotal}件 / 入力: ${categories.length}件`);

  return tree;
}

/**
 * ツリーの全ノードを展開状態にする
 */
function expandAllTreeNodes(tree, parentPath = '') {
  Object.keys(tree).forEach(key => {
    const node = tree[key];
    const nodePath = parentPath ? `${parentPath} > ${key}` : key;
    expandedTreeNodes.add(nodePath);

    if (Object.keys(node.children).length > 0) {
      expandAllTreeNodes(node.children, nodePath);
    }
  });
}

/**
 * ツリーの1レベルをレンダリング
 * @param {Object} tree - ツリー構造
 * @param {HTMLElement} container - コンテナ要素
 * @param {number} level - 現在のレベル（1〜）
 */
function renderTreeLevel(tree, container, level, parentPathArray = []) {
  const sortedKeys = Object.keys(tree).sort((a, b) => a.localeCompare(b, 'ja'));
  const treeConfig = currentMasterConfig.treeConfig || {};
  const levelFields = treeConfig.levelFields || [];
  const maxLevels = levelFields.length;

  sortedKeys.forEach(key => {
    const node = tree[key];
    const hasChildren = Object.keys(node.children).length > 0;
    const hasItems = node.items.length > 0;
    const nodePath = node.path;
    const isExpanded = expandedTreeNodes.has(nodePath);
    const currentPathArray = [...parentPathArray, key];

    // ノードヘッダー
    const nodeContainer = document.createElement('div');
    nodeContainer.className = `category-tree-node level-${level}`;

    const nodeHeader = document.createElement('div');
    nodeHeader.className = `category-tree-header ${isExpanded ? 'expanded' : ''} ${hasChildren || hasItems ? 'has-children' : ''}`;

    // [+]ボタンを追加（子カテゴリまたはアイテム追加用）
    const canAddChildren = level <= maxLevels; // アイテム名も追加可能
    const addBtnHtml = canAddChildren ? `<button class="tree-add-btn" data-path="${escapeHtml(nodePath)}" data-level="${level}" title="ここに追加"><i class="bi bi-plus"></i></button>` : '';

    nodeHeader.innerHTML = `
      <div class="tree-node-content">
        ${hasChildren || hasItems ? `<i class="bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} toggle-icon"></i>` : '<span class="tree-spacer"></span>'}
        <span class="tree-node-name">${escapeHtml(key)}</span>
        <span class="tree-node-count">(${node.count}件)</span>
        ${addBtnHtml}
      </div>
    `;

    // 展開/収納のクリックイベント（[+]ボタン以外）
    const nodeContent = nodeHeader.querySelector('.tree-node-content');
    if (hasChildren || hasItems) {
      nodeContent.addEventListener('click', (e) => {
        if (!e.target.closest('.tree-add-btn')) {
          toggleTreeNode(nodePath, node, level);
        }
      });
    }

    // [+]ボタンのクリックイベント
    const addBtn = nodeHeader.querySelector('.tree-add-btn');
    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showTreeInlineAddForm(nodePath, level, currentPathArray, nodeContainer);
      });
    }

    nodeContainer.appendChild(nodeHeader);

    // 子要素コンテナ
    const childrenContainer = document.createElement('div');
    childrenContainer.className = `category-tree-children ${isExpanded ? 'expanded' : ''}`;
    childrenContainer.setAttribute('data-path', nodePath);

    const childrenInner = document.createElement('div');
    childrenInner.className = 'tree-children-inner';

    if (isExpanded) {
      // 子ノードをレンダリング
      if (hasChildren) {
        renderTreeLevel(node.children, childrenInner, level + 1, currentPathArray);
      }

      // アイテムをレンダリング（最終レベルのみ）
      if (hasItems && !hasChildren) {
        node.items.forEach(item => {
          const itemEl = createTreeItemCard(item);
          childrenInner.appendChild(itemEl);
        });
      }
    }

    childrenContainer.appendChild(childrenInner);
    nodeContainer.appendChild(childrenContainer);

    container.appendChild(nodeContainer);
  });
}

/**
 * ツリー上でのインライン追加フォームを表示
 * @param {string} nodePath - 親ノードのパス（例: "メンズ > トップス"）
 * @param {number} level - 親ノードのレベル
 * @param {Array} pathArray - パス配列（例: ["メンズ", "トップス"]）
 * @param {HTMLElement} nodeContainer - ノードコンテナ要素
 */
function showTreeInlineAddForm(nodePath, level, pathArray, nodeContainer) {
  // 既存のインラインフォームがあれば削除
  const existingForm = document.querySelector('.tree-inline-add-form');
  if (existingForm) {
    existingForm.remove();
  }

  const treeConfig = currentMasterConfig.treeConfig || {};
  const levelFields = treeConfig.levelFields || [];
  const itemNameField = treeConfig.itemNameField || 'itemName';
  const maxLevels = levelFields.length;

  // 追加対象レベルを決定（現在レベルの次 or アイテム名）
  const nextLevel = level + 1;
  const isAddingItemName = nextLevel > maxLevels;
  const targetLabel = isAddingItemName ? 'アイテム名' : `階層${nextLevel}`;

  // インラインフォームを作成
  const formContainer = document.createElement('div');
  formContainer.className = 'tree-inline-add-form';
  formContainer.innerHTML = `
    <div class="inline-form-header">
      <span class="inline-form-path">${escapeHtml(nodePath)} に追加</span>
      <button class="inline-form-close" title="閉じる"><i class="bi bi-x"></i></button>
    </div>
    <div class="inline-form-body">
      <textarea class="inline-form-input" placeholder="追加する名前を入力（複数行で一括追加可能）" rows="3"></textarea>
      <div class="inline-form-hint">1行に1つずつ入力すると一括追加できます</div>
      <div class="inline-form-actions">
        <button class="inline-form-cancel">キャンセル</button>
        <button class="inline-form-submit">追加する</button>
      </div>
    </div>
  `;

  // ノードの子要素コンテナの後に挿入
  const childrenContainer = nodeContainer.querySelector('.category-tree-children');
  if (childrenContainer) {
    childrenContainer.after(formContainer);
  } else {
    nodeContainer.appendChild(formContainer);
  }

  // フォーカス
  const textarea = formContainer.querySelector('.inline-form-input');
  textarea.focus();

  // テキストエリアの高さを自動調整
  const autoResizeTextarea = () => {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 200); // 最大200px
    textarea.style.height = newHeight + 'px';
  };
  textarea.addEventListener('input', autoResizeTextarea);

  // 閉じるボタン
  formContainer.querySelector('.inline-form-close').addEventListener('click', () => {
    formContainer.remove();
  });

  // キャンセルボタン
  formContainer.querySelector('.inline-form-cancel').addEventListener('click', () => {
    formContainer.remove();
  });

  // 追加ボタン
  const submitBtn = formContainer.querySelector('.inline-form-submit');
  submitBtn.addEventListener('click', async () => {
    // 連打防止
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    submitBtn.textContent = '追加中...';

    const inputValue = textarea.value.trim();
    if (!inputValue) {
      showToast('追加する名前を入力してください', 'warning');
      submitBtn.disabled = false;
      submitBtn.textContent = '追加する';
      return;
    }

    // 複数行対応
    const newValues = inputValue.split('\n').map(v => v.trim()).filter(v => v.length > 0);
    if (newValues.length === 0) {
      showToast('追加する名前を入力してください', 'warning');
      submitBtn.disabled = false;
      submitBtn.textContent = '追加する';
      return;
    }

    // 追加処理
    await addTreeItems(pathArray, newValues, isAddingItemName);
    formContainer.remove();
  });

  // Escapeキーでキャンセル（Enterは改行として許可 - iOS対応）
  textarea.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
      formContainer.remove();
    }
  });
}

/**
 * ツリーにアイテムを追加
 * @param {Array} pathArray - 親パス配列
 * @param {Array} newValues - 追加する値の配列
 * @param {boolean} isItemName - アイテム名として追加するか
 */
async function addTreeItems(pathArray, newValues, isItemName) {
  console.log('[addTreeItems] 開始:', { pathArray, newValues, isItemName });

  const treeConfig = currentMasterConfig.treeConfig || {};
  const levelFields = treeConfig.levelFields || [];
  const itemNameField = treeConfig.itemNameField || 'itemName';
  const cascadeConfig = currentMasterConfig.cascadeAdd || {};
  const platformField = cascadeConfig.platformField || 'platforms';

  console.log('[addTreeItems] levelFields:', levelFields);

  // 現在のプラットフォームを取得
  const selectedPlatforms = getSelectedPlatforms();

  let addedCount = 0;
  let duplicateCount = 0;
  const categories = masterCache[currentMasterConfig.collection] || [];

  for (const newValue of newValues) {
    // 親階層の値を設定
    const newItem = {};
    pathArray.forEach((value, index) => {
      if (index < levelFields.length) {
        newItem[levelFields[index]] = value;
      }
    });

    if (isItemName) {
      // アイテム名として追加
      newItem[itemNameField] = newValue;
    } else {
      // 次の階層として追加
      const nextLevelIndex = pathArray.length;
      if (nextLevelIndex < levelFields.length) {
        newItem[levelFields[nextLevelIndex]] = newValue;
      }
    }

    // fullPath を生成
    const pathParts = [...pathArray, newValue];
    newItem.fullPath = pathParts.join(' > ');

    console.log('[addTreeItems] 生成データ:', { newItem, pathParts });

    // プラットフォーム設定
    if (selectedPlatforms.length > 0) {
      newItem[platformField] = selectedPlatforms;
    }

    // 重複チェック
    const isDuplicate = categories.some(cat => cat.fullPath === newItem.fullPath);
    if (isDuplicate) {
      duplicateCount++;
      continue;
    }

    // Firestoreに追加
    try {
      const docRef = await firebase.firestore()
        .collection(currentMasterConfig.collection)
        .add({
          ...newItem,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      newItem.id = docRef.id;
      masterCache[currentMasterConfig.collection].push(newItem);
      addedCount++;
    } catch (error) {
      console.error('[Master Manager] 追加エラー:', error);
      showToast(`追加エラー: ${error.message}`, 'error');
    }
  }

  // 結果通知
  if (addedCount > 0) {
    showToast(`${addedCount}件追加しました${duplicateCount > 0 ? `（${duplicateCount}件は重複のためスキップ）` : ''}`, 'success');

    // キャッシュを無効化（メタデータのみ削除、データは保持）
    // 次回の完全リロード時にキャッシュが更新される
    if (window.masterCacheManager && window.masterCacheManager.db) {
      try {
        const transaction = window.masterCacheManager.db.transaction(['metadata'], 'readwrite');
        const store = transaction.objectStore('metadata');
        store.delete(currentMasterConfig.collection);
        console.log('[Master Manager] キャッシュメタデータを無効化');
      } catch (e) {
        console.warn('[Master Manager] キャッシュ無効化失敗:', e);
      }
    }

    // 直接Firestoreから取得して即座に表示（キャッシュ保存をスキップ）
    try {
      console.log('[Master Manager] Firestoreから直接取得開始...');
      const freshData = await window.getMasterData(currentMasterConfig.collection);

      if (freshData && freshData.length > 0) {
        allMasterData = freshData;
        filteredMasterData = freshData;
        masterCache[currentMasterConfig.collection] = freshData;
        console.log(`[Master Manager] Firestore直接取得完了: ${freshData.length}件`);
      }

      renderMasterList();
      updateStats();
    } catch (error) {
      console.error('[Master Manager] Firestore直接取得エラー:', error);
      // フォールバック: 通常のloadMasterData
      await loadMasterData();
    }
  } else if (duplicateCount > 0) {
    showToast(`すべて重複のため追加されませんでした（${duplicateCount}件）`, 'warning');
  }
}

/**
 * 選択されているプラットフォームを取得
 */
function getSelectedPlatforms() {
  const platformTabs = document.querySelectorAll('.platform-tab.active');
  if (platformTabs.length === 0) return [];

  // 「すべて」タブがアクティブな場合は空配列
  const activeTab = document.querySelector('.platform-tab.active');
  if (activeTab && activeTab.dataset.platform === 'all') {
    return [];
  }

  return Array.from(platformTabs).map(tab => tab.dataset.platform).filter(Boolean);
}

/**
 * ツリーノードの展開/収納を切り替え
 */
window.toggleTreeNode = function(nodePath, node, level) {
  const isCurrentlyExpanded = expandedTreeNodes.has(nodePath);

  if (isCurrentlyExpanded) {
    expandedTreeNodes.delete(nodePath);
  } else {
    expandedTreeNodes.add(nodePath);
  }

  // nodePathからparentPathArrayを構築
  const parentPathArray = nodePath.split(' > ');

  // 該当ノードのみ更新
  const container = document.querySelector(`.category-tree-children[data-path="${CSS.escape(nodePath)}"]`);
  const header = container?.previousElementSibling;

  if (container && header) {
    const icon = header.querySelector('.toggle-icon');
    const childrenInner = container.querySelector('.tree-children-inner');

    if (expandedTreeNodes.has(nodePath)) {
      header.classList.add('expanded');
      container.classList.add('expanded');
      if (icon) icon.className = 'bi bi-chevron-down toggle-icon';

      // コンテンツを動的に生成
      if (childrenInner && childrenInner.children.length === 0) {
        const hasChildren = Object.keys(node.children).length > 0;
        const hasItems = node.items.length > 0;

        if (hasChildren) {
          renderTreeLevel(node.children, childrenInner, level + 1, parentPathArray);
        }

        if (hasItems && !hasChildren) {
          node.items.forEach(item => {
            const itemEl = createTreeItemCard(item);
            childrenInner.appendChild(itemEl);
          });
        }
      }
    } else {
      header.classList.remove('expanded');
      container.classList.remove('expanded');
      if (icon) icon.className = 'bi bi-chevron-right toggle-icon';
    }
  }
}

/**
 * ツリーアイテムカードを作成
 * @param {Object} item - カテゴリアイテム
 * @returns {HTMLElement} カード要素
 */
function createTreeItemCard(item) {
  const card = document.createElement('div');
  card.className = 'tree-item-card';
  card.setAttribute('data-master-id', item.id);

  // 表示名を決定（itemNameまたはfullPath）
  const treeConfig = currentMasterConfig.treeConfig || {};
  const itemNameField = treeConfig.itemNameField || 'itemName';
  const displayName = item[itemNameField] || item.fullPath || item.id;

  card.innerHTML = `
    <div class="tree-item-content">
      <span class="tree-item-name">${escapeHtml(displayName)}</span>
    </div>
    <div class="tree-item-actions">
      <button class="btn-icon btn-edit" onclick="showEditModal('${item.id}')" title="編集">
        <i class="bi bi-pencil"></i>
      </button>
      <button class="btn-icon btn-delete" onclick="showDeleteModal('${item.id}')" title="削除">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `;

  return card;
}

/**
 * マスタカード作成
 * @param {Object} item - マスタデータ
 * @returns {HTMLElement} カード要素
 */
function createMasterCard(item, useLabeled = false) {
  const card = document.createElement('div');
  card.className = 'master-card';
  card.setAttribute('data-master-id', item.id);

  // ラベル付き表示モードか判定
  const isLabeledMode = useLabeled || currentMasterConfig.itemDisplayMode === 'labeled';

  // 通常モード時はクリックで編集モーダルを開く
  if (!selectionMode) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', (e) => {
      // 編集・削除ボタンクリック時はカードのクリックイベントを無視
      if (e.target.closest('.btn-delete') || e.target.closest('.btn-edit')) return;
      showEditModal(item.id);
    });
  }

  // カード内容を構築
  let cardContent = '';

  if (selectionMode) {
    // 選択モード時
    card.classList.add('selection-mode');
    const isSelected = selectedMasterData.has(item.id);
    if (isSelected) {
      card.classList.add('selected');
    }

    cardContent += `
      <input type="checkbox"
             class="master-checkbox"
             ${isSelected ? 'checked' : ''}
             onchange="toggleMasterSelection('${item.id}')">
    `;
  }

  // メイン情報部分
  cardContent += '<div class="master-info">';

  if (isLabeledMode) {
    // ラベル付き表示モード（GAS版風）
    const fields = currentMasterConfig.fields || [];
    const displayFields = currentMasterConfig.displayFields || [];
    const groupByField = currentMasterConfig.groupBy;

    displayFields.forEach(fieldName => {
      // groupByフィールドは既にヘッダーに表示されているのでスキップ
      if (fieldName === groupByField) return;

      const fieldConfig = fields.find(f => f.name === fieldName);
      const fieldLabel = fieldConfig ? fieldConfig.label : fieldName;
      let fieldValue = item[fieldName];

      // 数値フィールドで価格の場合は¥を付ける
      let isPriceField = false;
      if (fieldConfig && fieldConfig.type === 'number' && (fieldName === 'price' || fieldName.includes('price') || fieldName.includes('fee'))) {
        fieldValue = fieldValue !== undefined && fieldValue !== null ? `¥${Number(fieldValue).toLocaleString()}` : '';
        isPriceField = true;
      } else {
        fieldValue = fieldValue !== undefined && fieldValue !== null ? fieldValue : '';
      }

      const priceClass = isPriceField ? ' price-value' : '';
      cardContent += `
        <div class="master-field-labeled">
          <span class="field-label">${escapeHtml(fieldLabel)}</span>
          <span class="field-value${priceClass}">${escapeHtml(String(fieldValue))}</span>
        </div>
      `;
    });
  } else {
    // 従来の表示モード（コンパクト）
    const displayFields = currentMasterConfig.displayFields || ['name'];
    displayFields.forEach((fieldName, index) => {
      const fieldValue = item[fieldName] || '';
      const className = index === 0 ? 'master-field-primary' : 'master-field-secondary';
      cardContent += `<div class="${className}">${escapeHtml(fieldValue)}</div>`;
    });
  }

  // 使用回数表示（usageCount対応の場合）
  if (currentMasterConfig.usageCount && item.usageCount !== undefined) {
    cardContent += `
      <div class="master-meta">
        <div class="usage-count">
          <i class="bi bi-graph-up"></i>
          <span>使用回数: ${item.usageCount}回</span>
        </div>
      </div>
    `;
  }

  cardContent += '</div>'; // master-info終了

  // 通常モード時のみ編集・削除ボタン表示
  if (!selectionMode) {
    cardContent += `
      <div class="master-actions">
        <button class="btn-edit" onclick="event.stopPropagation(); showEditModal('${item.id}')" title="編集">
          <i class="bi bi-pencil"></i>
        </button>
        <button class="btn-delete" onclick="event.stopPropagation(); showDeleteModal('${item.id}')" title="削除">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    `;
  }

  card.innerHTML = cardContent;
  return card;
}

/**
 * 統計情報更新
 */
function updateStats() {
  const statsText = document.getElementById('statsText');
  const totalCountEl = document.getElementById('totalCountBadge');
  const collection = currentMasterConfig?.collection;
  const totalItems = masterCache[collection] ? masterCache[collection].length : 0;
  const initialDisplay = currentMasterConfig?.initialDisplay;

  // 検索クエリがあるかどうかをチェック
  const searchInput = document.getElementById('searchInput');
  const hasSearchQuery = searchInput && searchInput.value.trim().length > 0;

  if (statsText) {
    const resultCount = filteredMasterData.length;

    if (hasSearchQuery && resultCount > 0) {
      // 検索結果がある場合のみ「検索結果:」を表示
      statsText.textContent = `検索結果: ${resultCount.toLocaleString()}件`;
      if (totalCountEl) totalCountEl.classList.add('hidden');
    } else if (resultCount > 0) {
      // 検索なしでデータがある場合は件数のみ表示
      statsText.textContent = `${resultCount.toLocaleString()}件`;
      if (totalCountEl) totalCountEl.classList.add('hidden');
    } else {
      // データなしの場合
      if (initialDisplay === 0) {
        statsText.textContent = '';
        // 総件数を表示（showTotalCountがtrueの場合のみ）
        if (totalCountEl && currentMasterConfig?.emptyState?.showTotalCount && masterTotalCount > 0) {
          totalCountEl.classList.remove('hidden');
        }
      } else {
        // 通常モード
        statsText.textContent = `全${totalItems.toLocaleString()}件`;
        if (totalCountEl) totalCountEl.classList.add('hidden');
      }
    }
  }
}

// ============================================
// マスタ追加
// ============================================

/**
 * 既存の発送方法カテゴリを取得
 * @returns {Promise<string[]>} ユニークなカテゴリ名の配列
 */
async function getExistingShippingCategories() {
  try {
    // Firestoreから発送方法データを取得
    const shippingData = await window.getMasterData('shippingMethods', { sortBy: 'category' });
    
    // ユニークなカテゴリを抽出
    const categories = [...new Set(shippingData.map(item => item.category).filter(Boolean))];
    categories.sort((a, b) => a.localeCompare(b, 'ja'));
    
    console.log('📋 [Master Manager] 既存カテゴリ取得:', categories);
    return categories;
  } catch (error) {
    console.error('❌ [Master Manager] カテゴリ取得エラー:', error);
    return [];
  }
}

/**
 * 追加モーダル表示
 */
window.showAddModal = async function() {
  const modal = document.getElementById('addModal');
  const modalBody = document.getElementById('addModalBody');
  const errorMessage = document.getElementById('addErrorMessage');

  if (!modal || !modalBody) {
    console.error('[Master Manager] モーダル要素が見つかりません');
    return;
  }

  // currentMasterConfigが未設定の場合はエラー
  if (!currentMasterConfig) {
    console.error('[Master Manager] マスタが選択されていません');
    alert('マスタを選択してください');
    return;
  }

  // カスケード追加モードの場合は専用UIを表示
  if (currentMasterConfig.cascadeAdd && currentMasterConfig.cascadeAdd.enabled) {
    showCascadeAddModal();
    return;
  }

  // fieldsが未定義の場合はエラー
  if (!currentMasterConfig.fields || currentMasterConfig.fields.length === 0) {
    console.error('[Master Manager] マスタ設定にfieldsが定義されていません:', currentMasterConfig);
    alert('マスタ設定にエラーがあります');
    return;
  }

  // エラーメッセージクリア
  if (errorMessage) {
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
  }

  // 入力フォーム動的生成
  modalBody.innerHTML = '';

  // 発送方法の場合、既存カテゴリを取得
  let existingCategories = [];
  const isShippingMethod = currentMasterConfig.collection === 'shippingMethods';
  if (isShippingMethod) {
    existingCategories = await getExistingShippingCategories();
  }

  currentMasterConfig.fields.forEach(field => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = `add-${field.name}`;
    label.textContent = field.label;
    if (field.required) {
      label.innerHTML += ' <span style="color: #ff4757;">*</span>';
    }

    formGroup.appendChild(label);

    // 発送方法のカテゴリフィールドはプルダウン＋カスタム入力
    if (isShippingMethod && field.name === 'category') {
      // プルダウン（セレクト）
      const select = document.createElement('select');
      select.id = `add-${field.name}`;
      select.className = 'form-input';
      
      // 「選択してください」オプション
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '選択してください';
      select.appendChild(defaultOption);
      
      // 既存カテゴリをオプションとして追加
      existingCategories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        select.appendChild(option);
      });
      
      // カスタム（新規作成）オプション
      const customOption = document.createElement('option');
      customOption.value = '__custom__';
      customOption.textContent = '＋ 新しいカテゴリを作成';
      select.appendChild(customOption);
      
      formGroup.appendChild(select);
      
      // カスタム入力フィールド（初期非表示）
      const customInputWrapper = document.createElement('div');
      customInputWrapper.id = `add-${field.name}-custom-wrapper`;
      customInputWrapper.style.display = 'none';
      customInputWrapper.style.marginTop = '8px';
      
      const customInput = document.createElement('input');
      customInput.type = 'text';
      customInput.id = `add-${field.name}-custom`;
      customInput.className = 'form-input';
      customInput.placeholder = '新しいカテゴリ名を入力（例: らくらくメルカリ便）';
      
      customInputWrapper.appendChild(customInput);
      formGroup.appendChild(customInputWrapper);
      
      // プルダウン変更時のイベントハンドラ
      select.addEventListener('change', function() {
        const customWrapper = document.getElementById(`add-${field.name}-custom-wrapper`);
        if (this.value === '__custom__') {
          customWrapper.style.display = 'block';
          document.getElementById(`add-${field.name}-custom`).focus();
        } else {
          customWrapper.style.display = 'none';
        }
      });
    } else if (field.type === 'user-select') {
      // スタッフ選択プルダウン
      const select = document.createElement('select');
      select.id = `add-${field.name}`;
      select.className = 'form-input';

      // 「選択してください」オプション
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '-- スタッフを選択 --';
      select.appendChild(defaultOption);

      // usersコレクションからスタッフを読み込み
      if (window.db) {
        window.db.collection('users').get().then(snapshot => {
          snapshot.forEach(doc => {
            const userData = doc.data();
            // アクティブなスタッフのみ表示
            if (userData.status === 'アクティブ') {
              const option = document.createElement('option');
              option.value = doc.id; // userEmail
              option.textContent = userData.userName || userData.displayName || doc.id;
              select.appendChild(option);
            }
          });
        }).catch(err => {
          console.error('スタッフ読み込みエラー:', err);
        });
      }

      formGroup.appendChild(select);

      // 説明文があれば追加
      if (field.description) {
        const helpText = document.createElement('small');
        helpText.className = 'form-help-text';
        helpText.style.color = '#6b7280';
        helpText.style.fontSize = '12px';
        helpText.style.marginTop = '4px';
        helpText.style.display = 'block';
        helpText.textContent = field.description;
        formGroup.appendChild(helpText);
      }
    } else {
      // 通常のテキスト入力
      const input = document.createElement('input');
      input.type = field.type === 'number' ? 'number' : 'text';
      input.id = `add-${field.name}`;
      input.className = 'form-input';
      input.placeholder = field.placeholder || '';
      if (field.maxLength) {
        input.maxLength = field.maxLength;
      }
      formGroup.appendChild(input);
    }

    modalBody.appendChild(formGroup);
  });

  modal.classList.remove('hidden');
};

/**
 * 追加モーダル非表示
 */
window.hideAddModal = function() {
  const modal = document.getElementById('addModal');
  if (modal) {
    modal.classList.add('hidden');
  }

  // 編集モードをリセット
  masterToEdit = null;

  // カスケードモードをリセット
  cascadeSelections = {};
  cascadeOptions = {};

  // モーダルを追加モードに戻す
  const modalTitle = document.getElementById('addModalTitle');
  const submitBtn = document.getElementById('addSubmitBtn');
  if (modalTitle) {
    modalTitle.textContent = '新規追加';
  }
  if (submitBtn) {
    submitBtn.textContent = '追加';
    submitBtn.setAttribute('onclick', 'addMaster()');
  }
};

/**
 * マスタ追加実行
 */
window.addMaster = async function() {
  const errorMessage = document.getElementById('addErrorMessage');

  if (!errorMessage) return;

  // 入力値を収集
  const data = {};
  let hasError = false;
  const isShippingMethod = currentMasterConfig.collection === 'shippingMethods';

  currentMasterConfig.fields.forEach(field => {
    const input = document.getElementById(`add-${field.name}`);
    let value = input ? input.value.trim() : '';

    // 発送方法のカテゴリでカスタム選択の場合、カスタム入力フィールドの値を使用
    if (isShippingMethod && field.name === 'category' && value === '__custom__') {
      const customInput = document.getElementById(`add-${field.name}-custom`);
      value = customInput ? customInput.value.trim() : '';
    }

    // バリデーション
    if (field.required && !value) {
      showError(errorMessage, `${field.label}を入力してください`);
      hasError = true;
      return;
    }

    data[field.name] = value;
  });

  if (hasError) return;

  try {
    showLoading(true);

    // Firestore APIで追加
    const result = await window.createMaster(currentMasterConfig.collection, data);

    if (result.success) {
      console.log(`✅ [Master Manager] 追加成功: ${currentMasterConfig.label}`);

      // キャッシュクリア（再読み込み強制）
      delete masterCache[currentMasterConfig.collection];

      // 新しいアイテムをローカルデータに追加（即座に反映）
      const newItem = {
        id: result.id,
        ...data
      };
      allMasterData.push(newItem);
      filteredMasterData.push(newItem);

      // 件数を更新（動的カウント）
      if (masterTotalCount > 0) {
        masterTotalCount++;
        updateEmptyStateCount();
        console.log(`📊 [Master Manager] 件数更新: ${masterTotalCount.toLocaleString()}件`);
      }

      // 画面を即座に更新
      renderMasterList();
      updateStats();

      hideAddModal();
      alert(`${currentMasterConfig.label}を追加しました。`);
    } else {
      const detailedError = result.error || '追加に失敗しました';
      console.error('❌ [Master Manager] 追加失敗:', detailedError);
      showError(errorMessage, detailedError);
    }

  } catch (error) {
    console.error('❌ [Master Manager] 追加エラー:', error);
    const detailedError = `エラー: ${error.message || '追加に失敗しました'}`;
    showError(errorMessage, detailedError);
  } finally {
    showLoading(false);
  }
};

// ============================================
// カスケード追加UI（カテゴリ用）
// ============================================

// カスケード選択の状態管理
let cascadeSelections = {};
let cascadeOptions = {};

// 追加する階層のインデックス（グローバル状態）
let addTargetLevelIndex = -1; // -1 = アイテム名（最下層）

// 一括追加モード（複数アイテムを同時登録）
let batchAddMode = false;

/**
 * 指定レベルの既存項目を取得
 * @param {string} targetField - 取得したいレベルのフィールド名
 * @param {Object} parentSelections - 親階層の選択値
 * @param {Array} levels - 階層設定
 * @returns {Array} 既存の値一覧
 */
function getExistingItemsAtLevel(targetField, parentSelections, levels) {
  const categories = masterCache[currentMasterConfig.collection] || [];

  // 親階層でフィルタリング
  const filtered = categories.filter(cat => {
    for (const [field, value] of Object.entries(parentSelections)) {
      if (value && cat[field] !== value) {
        return false;
      }
    }
    return true;
  });

  // 対象フィールドのユニーク値を取得
  const uniqueValues = [...new Set(filtered.map(c => c[targetField]).filter(Boolean))];
  uniqueValues.sort((a, b) => a.localeCompare(b, 'ja'));

  return uniqueValues;
}

/**
 * 既存項目リストをレンダリング
 * @param {string} containerId - コンテナのID
 * @param {Array} items - 表示する項目
 * @param {string} levelLabel - 階層ラベル
 */
function renderExistingItems(containerId, items, levelLabel) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<div style="color: #9ca3af; font-size: 12px; padding: 8px 0;">既存の${levelLabel}はありません</div>`;
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px; margin-top: 6px; max-height: 150px; overflow-y: auto;';

  const header = document.createElement('div');
  header.style.cssText = 'font-size: 11px; color: #64748b; margin-bottom: 6px; font-weight: 500;';
  header.textContent = `既存の${levelLabel}（${items.length}件）`;
  wrapper.appendChild(header);

  const itemsContainer = document.createElement('div');
  itemsContainer.style.cssText = 'display: flex; flex-wrap: wrap; gap: 4px;';

  items.forEach(item => {
    const chip = document.createElement('span');
    chip.style.cssText = 'background: #e2e8f0; color: #475569; font-size: 12px; padding: 2px 8px; border-radius: 4px; white-space: nowrap;';
    chip.textContent = item;
    itemsContainer.appendChild(chip);
  });

  wrapper.appendChild(itemsContainer);
  container.innerHTML = '';
  container.appendChild(wrapper);
}

/**
 * カスケード追加モーダル表示（カテゴリ用）
 */

async function showCascadeAddModal() {
  const modal = document.getElementById('addModal');
  const modalBody = document.getElementById('addModalBody');
  const modalTitle = document.getElementById('addModalTitle');
  const errorMessage = document.getElementById('addErrorMessage');
  const submitBtn = document.getElementById('addSubmitBtn');

  if (!modal || !modalBody) {
    console.error('[Master Manager] モーダル要素が見つかりません');
    return;
  }

  // 状態リセット
  cascadeSelections = {};
  cascadeOptions = {};
  addTargetLevelIndex = -1; // デフォルトはアイテム名
  batchAddMode = false; // 一括追加モードリセット

  // モーダルタイトル
  if (modalTitle) {
    modalTitle.textContent = 'カテゴリを追加';
  }

  // 送信ボタン
  if (submitBtn) {
    submitBtn.textContent = '追加';
    submitBtn.setAttribute('onclick', 'addCascadeItem()');
  }

  // エラーメッセージクリア
  if (errorMessage) {
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
  }

  // カスケード設定を取得
  const cascadeConfig = currentMasterConfig.cascadeAdd;
  const levels = cascadeConfig.levels;

  // キャッシュまたはFirestoreからカテゴリデータを取得
  let categories = masterCache[currentMasterConfig.collection];
  if (!categories || categories.length === 0) {
    showLoading(true);
    try {
      if (window.masterCacheManager) {
        categories = await window.masterCacheManager.getCategories();
      } else {
        categories = await window.getMasterData(currentMasterConfig.collection);
      }
      masterCache[currentMasterConfig.collection] = categories || [];
    } catch (error) {
      console.error('❌ [Master Manager] カテゴリ取得エラー:', error);
      categories = [];
    }
    showLoading(false);
  }

  // 各レベルのユニーク値を抽出
  levels.forEach((levelConfig, index) => {
    const field = levelConfig.field;
    const uniqueValues = [...new Set(categories.map(c => c[field]).filter(Boolean))];
    uniqueValues.sort((a, b) => a.localeCompare(b, 'ja'));
    cascadeOptions[field] = uniqueValues;
  });

  // フォーム生成
  modalBody.innerHTML = '';

  // 説明文
  const description = document.createElement('div');
  description.className = 'cascade-description';
  description.innerHTML = `
    <p style="color: #666; font-size: 14px; margin-bottom: 16px;">
      追加する階層を選択し、親カテゴリを選んで新しい値を入力します。
    </p>
  `;
  modalBody.appendChild(description);

  // ========== 追加する階層選択 ==========
  const targetLevelGroup = document.createElement('div');
  targetLevelGroup.className = 'form-group';
  targetLevelGroup.style.marginBottom = '20px';
  targetLevelGroup.style.paddingBottom = '16px';
  targetLevelGroup.style.borderBottom = '1px solid #e0e0e0';

  const targetLevelLabel = document.createElement('label');
  targetLevelLabel.className = 'form-label';
  targetLevelLabel.textContent = '追加する階層';
  targetLevelLabel.innerHTML += ' <span style="color: #ff4757;">*</span>';

  const targetLevelSelect = document.createElement('select');
  targetLevelSelect.id = 'cascade-targetLevel';
  targetLevelSelect.className = 'form-input';

  // 階層選択肢を追加（各レベル + アイテム名）
  levels.forEach((levelConfig, index) => {
    const option = document.createElement('option');
    option.value = index.toString();
    option.textContent = levelConfig.label;
    targetLevelSelect.appendChild(option);
  });
  // アイテム名オプション
  const itemNameOption = document.createElement('option');
  itemNameOption.value = '-1';
  itemNameOption.textContent = cascadeConfig.itemNameLabel || 'アイテム名';
  itemNameOption.selected = true;
  targetLevelSelect.appendChild(itemNameOption);

  // 階層選択変更イベント
  targetLevelSelect.addEventListener('change', () => {
    addTargetLevelIndex = parseInt(targetLevelSelect.value, 10);
    rebuildCascadeAddForm(levels, cascadeConfig);
  });

  targetLevelGroup.appendChild(targetLevelLabel);
  targetLevelGroup.appendChild(targetLevelSelect);
  modalBody.appendChild(targetLevelGroup);

  // ========== 一括追加モードトグル ==========
  const batchModeGroup = document.createElement('div');
  batchModeGroup.className = 'form-group';
  batchModeGroup.style.cssText = 'margin-bottom: 16px; display: flex; align-items: center; gap: 10px;';

  const batchModeLabel = document.createElement('label');
  batchModeLabel.style.cssText = 'font-size: 14px; color: #374151; cursor: pointer; display: flex; align-items: center; gap: 8px;';

  const batchModeCheckbox = document.createElement('input');
  batchModeCheckbox.type = 'checkbox';
  batchModeCheckbox.id = 'cascade-batch-mode';
  batchModeCheckbox.checked = batchAddMode;
  batchModeCheckbox.style.cssText = 'width: 18px; height: 18px; accent-color: #40B4E5; cursor: pointer;';

  batchModeCheckbox.addEventListener('change', () => {
    batchAddMode = batchModeCheckbox.checked;
    rebuildCascadeAddForm(levels, cascadeConfig);
  });

  batchModeLabel.appendChild(batchModeCheckbox);
  batchModeLabel.appendChild(document.createTextNode('一括追加モード（複数同時登録）'));

  const batchModeHint = document.createElement('span');
  batchModeHint.style.cssText = 'font-size: 11px; color: #9ca3af;';
  batchModeHint.textContent = '※1行に1つずつ入力';

  batchModeGroup.appendChild(batchModeLabel);
  batchModeGroup.appendChild(batchModeHint);
  modalBody.appendChild(batchModeGroup);

  // ========== 動的フォームコンテナ ==========
  const dynamicFormContainer = document.createElement('div');
  dynamicFormContainer.id = 'cascade-dynamic-form';
  modalBody.appendChild(dynamicFormContainer);

  // ========== プレビュー表示 ==========
  const previewGroup = document.createElement('div');
  previewGroup.className = 'form-group';
  previewGroup.style.marginTop = '24px';

  const previewLabel = document.createElement('label');
  previewLabel.className = 'form-label';
  previewLabel.textContent = 'プレビュー';
  previewLabel.style.color = '#666';

  const previewBox = document.createElement('div');
  previewBox.id = 'cascade-preview';
  previewBox.style.cssText = `
    padding: 12px 16px;
    background: #f8f9fa;
    border-radius: 8px;
    font-size: 14px;
    color: #999;
    min-height: 20px;
  `;
  previewBox.textContent = '階層を選択してください';

  previewGroup.appendChild(previewLabel);
  previewGroup.appendChild(previewBox);
  modalBody.appendChild(previewGroup);

  // 初期フォーム生成（アイテム名追加モード）
  rebuildCascadeAddForm(levels, cascadeConfig);

  modal.classList.remove('hidden');
}

/**
 * 追加する階層に応じてフォームを再構築
 */
function rebuildCascadeAddForm(levels, cascadeConfig) {
  const container = document.getElementById('cascade-dynamic-form');
  if (!container) return;

  container.innerHTML = '';
  cascadeSelections = {};

  const targetIndex = addTargetLevelIndex;
  const categories = masterCache[currentMasterConfig.collection] || [];

  // カテゴリーラベル
  const categoryLabel = document.createElement('label');
  categoryLabel.className = 'form-label';
  categoryLabel.textContent = 'カテゴリー';
  categoryLabel.innerHTML += ' <span style="color: #ff4757;">*</span>';
  categoryLabel.style.marginBottom = '8px';
  categoryLabel.style.display = 'block';
  container.appendChild(categoryLabel);

  // ========== 親階層（選択した階層より上）はプルダウン ==========
  const parentLevels = targetIndex === -1 ? levels : levels.slice(0, targetIndex);

  parentLevels.forEach((levelConfig, index) => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    formGroup.dataset.field = levelConfig.field;
    formGroup.style.marginBottom = '8px';

    // conditional フィールドは初期非表示
    if (levelConfig.conditional && index > 0) {
      formGroup.style.display = 'none';
    }

    const select = document.createElement('select');
    select.id = `cascade-${levelConfig.field}`;
    select.className = 'form-input';
    select.disabled = index > 0;

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = '--選択--';
    select.appendChild(defaultOption);

    if (index === 0) {
      const options = cascadeConfig.superCategoryOptions || cascadeOptions[levelConfig.field];
      (options || []).forEach(value => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });
    }

    select.addEventListener('change', () => {
      onCascadeParentSelectChange(levelConfig.field, select.value, index, parentLevels, cascadeConfig, levels);
    });

    formGroup.appendChild(select);

    // 既存項目表示用コンテナ（次の階層の既存項目を表示）
    const existingContainer = document.createElement('div');
    existingContainer.id = `existing-items-${levelConfig.field}`;
    formGroup.appendChild(existingContainer);

    container.appendChild(formGroup);
  });

  // ========== 追加対象レベルの既存項目表示用コンテナ ==========
  const existingTargetContainer = document.createElement('div');
  existingTargetContainer.id = 'existing-items-target';
  existingTargetContainer.style.marginTop = '8px';
  container.appendChild(existingTargetContainer);

  // ========== 追加対象の階層は入力フィールド ==========
  if (targetIndex >= 0 && targetIndex < levels.length) {
    // 特定の階層を追加する場合
    const targetLevel = levels[targetIndex];

    const inputGroup = document.createElement('div');
    inputGroup.className = 'form-group';
    inputGroup.style.marginTop = '16px';

    const inputLabel = document.createElement('label');
    inputLabel.className = 'form-label';
    inputLabel.htmlFor = 'cascade-newValue';
    inputLabel.textContent = batchAddMode ? `新しい${targetLevel.label}（複数可）` : `新しい${targetLevel.label}`;
    inputLabel.innerHTML += ' <span style="color: #ff4757;">*</span>';

    inputGroup.appendChild(inputLabel);

    if (batchAddMode) {
      // 一括追加モード: テキストエリア
      const textarea = document.createElement('textarea');
      textarea.id = 'cascade-newValue';
      textarea.className = 'form-input';
      textarea.placeholder = `1行に1つずつ入力\n例:\n値1\n値2\n値3`;
      textarea.style.cssText = 'min-height: 120px; resize: vertical; font-size: 16px;';
      textarea.addEventListener('input', updateCascadePreview);
      inputGroup.appendChild(textarea);

      const hint = document.createElement('div');
      hint.style.cssText = 'font-size: 11px; color: #9ca3af; margin-top: 4px;';
      hint.textContent = '複数入力すると一度に追加されます';
      inputGroup.appendChild(hint);
    } else {
      // 通常モード: テキストフィールド
      const input = document.createElement('input');
      input.type = 'text';
      input.id = 'cascade-newValue';
      input.className = 'form-input';
      input.placeholder = `例: 新しい${targetLevel.label}を入力`;
      input.addEventListener('input', updateCascadePreview);
      inputGroup.appendChild(input);
    }

    container.appendChild(inputGroup);
  } else {
    // アイテム名を追加する場合
    const itemNameGroup = document.createElement('div');
    itemNameGroup.className = 'form-group';
    itemNameGroup.style.marginTop = '16px';

    const itemNameLabel = document.createElement('label');
    itemNameLabel.className = 'form-label';
    itemNameLabel.htmlFor = 'cascade-itemName';
    const labelText = cascadeConfig.itemNameLabel || 'アイテム名';
    itemNameLabel.textContent = batchAddMode ? `${labelText}（複数可）` : labelText;
    itemNameLabel.innerHTML += ' <span style="color: #ff4757;">*</span>';

    itemNameGroup.appendChild(itemNameLabel);

    if (batchAddMode) {
      // 一括追加モード: テキストエリア
      const textarea = document.createElement('textarea');
      textarea.id = 'cascade-itemName';
      textarea.className = 'form-input';
      textarea.placeholder = `1行に1つずつ入力\n例:\n半袖プリントTシャツ\n長袖プリントTシャツ\nノースリーブTシャツ`;
      textarea.style.cssText = 'min-height: 120px; resize: vertical; font-size: 16px;';
      textarea.addEventListener('input', updateCascadePreview);
      itemNameGroup.appendChild(textarea);

      const hint = document.createElement('div');
      hint.style.cssText = 'font-size: 11px; color: #9ca3af; margin-top: 4px;';
      hint.textContent = '複数入力すると一度に追加されます';
      itemNameGroup.appendChild(hint);
    } else {
      // 通常モード: テキストフィールド
      const itemNameInput = document.createElement('input');
      itemNameInput.type = 'text';
      itemNameInput.id = 'cascade-itemName';
      itemNameInput.className = 'form-input';
      itemNameInput.placeholder = '例: 半袖プリントTシャツ';
      itemNameInput.addEventListener('input', updateCascadePreview);
      itemNameGroup.appendChild(itemNameInput);
    }

    container.appendChild(itemNameGroup);
  }

  // プレビュー更新
  updateCascadePreview();
}

/**
 * 親階層セレクト変更時の処理（追加モード専用）
 */
function onCascadeParentSelectChange(changedField, value, changedIndex, parentLevels, cascadeConfig, levels) {
  cascadeSelections[changedField] = value;

  const categories = masterCache[currentMasterConfig.collection] || [];

  // 後続のセレクトをリセット + 既存項目表示をクリア
  for (let i = changedIndex + 1; i < parentLevels.length; i++) {
    const field = parentLevels[i].field;
    const select = document.getElementById(`cascade-${field}`);
    if (select) {
      select.innerHTML = '';
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '--選択--';
      select.appendChild(defaultOption);
      select.disabled = true;
      cascadeSelections[field] = '';

      if (parentLevels[i].conditional) {
        const formGroup = select.closest('.form-group');
        if (formGroup) formGroup.style.display = 'none';
      }
    }

    // 既存項目表示をクリア
    const existingContainer = document.getElementById(`existing-items-${field}`);
    if (existingContainer) existingContainer.innerHTML = '';
  }

  // 追加対象レベルの既存項目をクリア
  const existingTargetContainer = document.getElementById('existing-items-target');
  if (existingTargetContainer) existingTargetContainer.innerHTML = '';

  // 次のセレクトを有効化
  if (value && changedIndex < parentLevels.length - 1) {
    const nextLevel = parentLevels[changedIndex + 1];
    const nextSelect = document.getElementById(`cascade-${nextLevel.field}`);
    if (nextSelect) {
      nextSelect.disabled = false;

      const filteredCategories = categories.filter(cat => {
        for (let i = 0; i <= changedIndex; i++) {
          const field = parentLevels[i].field;
          if (cat[field] !== cascadeSelections[field]) {
            return false;
          }
        }
        return true;
      });

      const uniqueValues = [...new Set(filteredCategories.map(c => c[nextLevel.field]).filter(Boolean))];
      uniqueValues.sort((a, b) => a.localeCompare(b, 'ja'));

      if (nextLevel.conditional) {
        const formGroup = nextSelect.closest('.form-group');
        if (formGroup) {
          formGroup.style.display = uniqueValues.length > 0 ? '' : 'none';
        }
        if (uniqueValues.length === 0) {
          nextSelect.disabled = true;
          updateCascadePreview();
          return;
        }
      }

      uniqueValues.forEach(val => {
        const option = document.createElement('option');
        option.value = val;
        option.textContent = val;
        nextSelect.appendChild(option);
      });

      // 次の階層の既存項目を表示
      renderExistingItems(`existing-items-${changedField}`, uniqueValues, nextLevel.label);
    }
  }

  // 最後の親階層を選択した場合、追加対象レベルの既存項目を表示
  if (value && changedIndex === parentLevels.length - 1) {
    const targetIndex = addTargetLevelIndex;
    let targetField, targetLabel;

    if (targetIndex >= 0 && targetIndex < levels.length) {
      // 特定階層を追加する場合
      targetField = levels[targetIndex].field;
      targetLabel = levels[targetIndex].label;
    } else {
      // アイテム名を追加する場合
      targetField = cascadeConfig.itemNameField || 'itemName';
      targetLabel = cascadeConfig.itemNameLabel || 'アイテム名';
    }

    const existingItems = getExistingItemsAtLevel(targetField, cascadeSelections, levels);
    renderExistingItems('existing-items-target', existingItems, targetLabel);
  }

  updateCascadePreview();
}

/**
 * カスケードセレクト変更時の処理
 */
function onCascadeSelectChange(changedField, value, changedIndex, levels) {
  // 選択値を保存
  cascadeSelections[changedField] = value;

  // 後続のレベルをリセット
  const cascadeConfig = currentMasterConfig.cascadeAdd;
  for (let i = changedIndex + 1; i < levels.length; i++) {
    const field = levels[i].field;
    const select = document.getElementById(`cascade-${field}`);
    if (select) {
      select.innerHTML = '';
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = cascadeConfig.hideLabels ? '--選択--' : `${levels[i].label}を選択`;
      select.appendChild(defaultOption);
      select.disabled = true;
      cascadeSelections[field] = '';

      // conditionalフィールドは非表示に戻す
      if (levels[i].conditional) {
        const formGroup = select.closest('.form-group');
        if (formGroup) formGroup.style.display = 'none';
      }
    }
  }

  // 次のレベルの選択肢を更新
  if (value && changedIndex < levels.length - 1) {
    const nextLevel = levels[changedIndex + 1];
    const nextSelect = document.getElementById(`cascade-${nextLevel.field}`);
    if (nextSelect) {
      nextSelect.disabled = false;

      // フィルタリングした選択肢を取得
      const categories = masterCache[currentMasterConfig.collection] || [];
      const filteredCategories = categories.filter(cat => {
        // 全ての上位レベルが一致するか確認
        for (let i = 0; i <= changedIndex; i++) {
          const field = levels[i].field;
          if (cat[field] !== cascadeSelections[field]) {
            return false;
          }
        }
        return true;
      });

      // ユニークな値を取得
      const uniqueValues = [...new Set(filteredCategories.map(c => c[nextLevel.field]).filter(Boolean))];
      uniqueValues.sort((a, b) => a.localeCompare(b, 'ja'));

      // conditionalフィールドの表示制御（選択肢がある場合のみ表示）
      if (nextLevel.conditional) {
        const formGroup = nextSelect.closest('.form-group');
        if (formGroup) {
          formGroup.style.display = uniqueValues.length > 0 ? '' : 'none';
        }
        // 選択肢がない場合はスキップ
        if (uniqueValues.length === 0) {
          nextSelect.disabled = true;
          return;
        }
      }

      // 選択肢を追加
      uniqueValues.forEach(val => {
        const option = document.createElement('option');
        option.value = val;
        option.textContent = val;
        nextSelect.appendChild(option);
      });
    }
  }

  // プレビュー更新
  updateCascadePreview();
}

/**
 * カスケードプレビュー更新
 */
function updateCascadePreview() {
  const previewBox = document.getElementById('cascade-preview');
  if (!previewBox) return;

  const cascadeConfig = currentMasterConfig.cascadeAdd;
  const levels = cascadeConfig.levels;
  const targetIndex = addTargetLevelIndex;

  // 親階層の選択値を取得
  const parentLevels = targetIndex === -1 ? levels : levels.slice(0, targetIndex);
  const selectedParents = parentLevels.map(l => cascadeSelections[l.field]).filter(Boolean);

  // 新規入力値を取得
  const newValue = document.getElementById('cascade-newValue')?.value.trim() || '';
  const itemName = document.getElementById('cascade-itemName')?.value.trim() || '';

  if (selectedParents.length === 0 && targetIndex !== 0) {
    previewBox.textContent = '親カテゴリを選択してください';
    previewBox.style.color = '#999';
    return;
  }

  let fullPath = selectedParents.join(' > ');

  if (targetIndex >= 0 && targetIndex < levels.length) {
    // 特定の階層を追加する場合
    if (newValue) {
      fullPath = fullPath ? `${fullPath} > ${newValue}` : newValue;
      previewBox.style.color = '#333';
    } else {
      previewBox.style.color = '#666';
    }
  } else {
    // アイテム名を追加する場合
    if (itemName) {
      fullPath += ` > ${itemName}`;
      previewBox.style.color = '#333';
    } else {
      previewBox.style.color = '#666';
    }
  }

  previewBox.textContent = fullPath || '階層を選択してください';
}

/**
 * カスケードアイテム追加実行
 */
window.addCascadeItem = async function() {
  const errorMessage = document.getElementById('addErrorMessage');

  if (!errorMessage) return;

  const cascadeConfig = currentMasterConfig.cascadeAdd;
  const levels = cascadeConfig.levels;
  const targetIndex = addTargetLevelIndex;

  // 親階層（追加対象より上）の選択値をチェック
  const parentLevels = targetIndex === -1 ? levels : levels.slice(0, targetIndex);
  const baseData = {};

  for (let i = 0; i < parentLevels.length; i++) {
    const levelConfig = parentLevels[i];
    const value = cascadeSelections[levelConfig.field];

    // conditionalフィールドで選択肢がない場合はスキップ可能
    if (levelConfig.conditional) {
      const select = document.getElementById(`cascade-${levelConfig.field}`);
      if (select && select.options.length <= 1) {
        continue;
      }
    }

    if (!value) {
      showError(errorMessage, `${levelConfig.label}を選択してください`);
      return;
    }
    baseData[levelConfig.field] = value;
  }

  // 追加対象の値を取得
  let newValues = [];

  if (targetIndex >= 0 && targetIndex < levels.length) {
    // 特定の階層を追加する場合
    const targetLevel = levels[targetIndex];
    const inputValue = document.getElementById('cascade-newValue')?.value.trim();
    if (!inputValue) {
      showError(errorMessage, `${targetLevel.label}を入力してください`);
      return;
    }

    if (batchAddMode) {
      // 一括追加: 改行で分割
      newValues = inputValue.split('\n').map(v => v.trim()).filter(v => v.length > 0);
    } else {
      newValues = [inputValue];
    }
  } else {
    // アイテム名を追加する場合
    const inputValue = document.getElementById('cascade-itemName')?.value.trim();
    if (!inputValue) {
      showError(errorMessage, 'アイテム名を入力してください');
      return;
    }

    if (batchAddMode) {
      // 一括追加: 改行で分割
      newValues = inputValue.split('\n').map(v => v.trim()).filter(v => v.length > 0);
    } else {
      newValues = [inputValue];
    }
  }

  if (newValues.length === 0) {
    showError(errorMessage, '追加するアイテムを入力してください');
    return;
  }

  // 重複チェック用
  const categories = masterCache[currentMasterConfig.collection] || [];
  const existingPaths = new Set(categories.map(c => c.fullPath));

  // 追加するアイテムリストを生成
  const itemsToAdd = [];
  const duplicates = [];

  for (const value of newValues) {
    const data = { ...baseData };

    if (targetIndex >= 0 && targetIndex < levels.length) {
      const targetLevel = levels[targetIndex];
      data[targetLevel.field] = value;
      const parentValues = parentLevels.map(l => data[l.field]).filter(Boolean);
      data.fullPath = [...parentValues, value].join(' > ');
    } else {
      data.itemName = value;
      const levelValues = parentLevels.map(l => data[l.field]).filter(Boolean);
      data.fullPath = [...levelValues, value].join(' > ');
    }

    // 重複チェック
    if (existingPaths.has(data.fullPath)) {
      duplicates.push(value);
      continue;
    }

    // プラットフォーム設定
    data.platform = currentPlatform || 'mercari';

    itemsToAdd.push(data);
    existingPaths.add(data.fullPath); // 同一バッチ内の重複も防止
  }

  if (itemsToAdd.length === 0) {
    if (duplicates.length > 0) {
      showError(errorMessage, `すべて重複しています:\n${duplicates.join(', ')}`);
    } else {
      showError(errorMessage, '追加するアイテムがありません');
    }
    return;
  }

  try {
    showLoading(true);

    let successCount = 0;
    const addedItems = [];

    // 順番に追加（並列だと大量追加時に問題が起きる可能性があるため）
    for (const data of itemsToAdd) {
      const result = await window.createMaster(currentMasterConfig.collection, data, true);

      if (result.success) {
        successCount++;
        const newItem = {
          id: result.id,
          ...data,
          usageCount: 0
        };
        addedItems.push(newItem);
        allMasterData.push(newItem);
        filteredMasterData.push(newItem);
      }
    }

    if (successCount > 0) {
      console.log(`✅ [Master Manager] カスケード追加成功: ${successCount}件`);

      // キャッシュクリア
      delete masterCache[currentMasterConfig.collection];

      // 件数更新
      if (masterTotalCount > 0) {
        masterTotalCount += successCount;
        updateEmptyStateCount();
      }

      // ツリービューのキャッシュをクリア
      expandedTreeNodes.clear();

      // 画面更新
      renderMasterList();
      updateStats();

      hideAddModal();

      // 結果メッセージ
      let message = `${successCount}件のアイテムを追加しました`;
      if (duplicates.length > 0) {
        message += `\n\n※重複スキップ: ${duplicates.length}件`;
      }
      if (successCount <= 5) {
        message += '\n\n' + addedItems.map(i => i.fullPath).join('\n');
      }
      alert(message);
    } else {
      showError(errorMessage, '追加に失敗しました');
    }

  } catch (error) {
    console.error('❌ [Master Manager] カスケード追加エラー:', error);
    showError(errorMessage, `エラー: ${error.message || '追加に失敗しました'}`);
  } finally {
    showLoading(false);
  }
};

/**
 * カスケード編集モーダル表示（カテゴリ用）
 * @param {Object} item - 編集対象のアイテム
 */
async function showCascadeEditModal(item) {
  const modal = document.getElementById('addModal');
  const modalBody = document.getElementById('addModalBody');
  const modalTitle = document.getElementById('addModalTitle');
  const errorMessage = document.getElementById('addErrorMessage');
  const submitBtn = document.getElementById('addSubmitBtn');

  if (!modal || !modalBody) {
    console.error('[Master Manager] モーダル要素が見つかりません');
    return;
  }

  // 状態リセット
  cascadeSelections = {};
  cascadeOptions = {};

  // モーダルタイトル
  if (modalTitle) {
    modalTitle.textContent = 'カテゴリを編集';
  }

  // 送信ボタン
  if (submitBtn) {
    submitBtn.textContent = '更新';
    submitBtn.setAttribute('onclick', 'updateCascadeItem()');
  }

  // エラーメッセージクリア
  if (errorMessage) {
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
  }

  // カスケード設定を取得
  const cascadeConfig = currentMasterConfig.cascadeAdd;
  const levels = cascadeConfig.levels;

  // キャッシュまたはFirestoreからカテゴリデータを取得
  let categories = masterCache[currentMasterConfig.collection];
  if (!categories || categories.length === 0) {
    showLoading(true);
    try {
      if (window.masterCacheManager) {
        categories = await window.masterCacheManager.getCategories();
      } else {
        categories = await window.getMasterData(currentMasterConfig.collection);
      }
      masterCache[currentMasterConfig.collection] = categories || [];
    } catch (error) {
      console.error('❌ [Master Manager] カテゴリ取得エラー:', error);
      categories = [];
    }
    showLoading(false);
  }

  // 各レベルのユニーク値を抽出
  levels.forEach((levelConfig, index) => {
    const field = levelConfig.field;
    const uniqueValues = [...new Set(categories.map(c => c[field]).filter(Boolean))];
    uniqueValues.sort((a, b) => a.localeCompare(b, 'ja'));
    cascadeOptions[field] = uniqueValues;
  });

  // フォーム生成
  modalBody.innerHTML = '';

  // 説明文
  const description = document.createElement('div');
  description.className = 'cascade-description';
  description.innerHTML = `
    <p style="color: #666; font-size: 14px; margin-bottom: 16px;">
      カテゴリの各階層とアイテム名を編集できます。
    </p>
  `;
  modalBody.appendChild(description);

  // 既存のデータから選択状態を復元
  levels.forEach((levelConfig, index) => {
    const existingValue = item[levelConfig.field];
    if (existingValue) {
      cascadeSelections[levelConfig.field] = existingValue;
    }
  });

  // hideLabels: true の場合、最初のセレクトボックスの上に「カテゴリー」ラベルを追加
  if (cascadeConfig.hideLabels) {
    const categoryLabel = document.createElement('label');
    categoryLabel.className = 'form-label';
    categoryLabel.textContent = 'カテゴリー';
    categoryLabel.innerHTML += ' <span style="color: #ff4757;">*</span>';
    categoryLabel.style.marginBottom = '8px';
    categoryLabel.style.display = 'block';
    modalBody.appendChild(categoryLabel);
  }

  // 各レベルのセレクトボックス
  levels.forEach((levelConfig, index) => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';
    formGroup.dataset.field = levelConfig.field;

    // conditional: true のフィールドは選択肢がない場合非表示
    // 編集時は既存データがあれば表示
    const hasExistingValue = !!item[levelConfig.field];

    // hideLabels設定に基づいてラベル表示を制御
    if (!cascadeConfig.hideLabels) {
      const label = document.createElement('label');
      label.className = 'form-label';
      label.htmlFor = `cascade-${levelConfig.field}`;
      label.textContent = levelConfig.label;
      label.innerHTML += ' <span style="color: #ff4757;">*</span>';
      formGroup.appendChild(label);
    }

    const select = document.createElement('select');
    select.id = `cascade-${levelConfig.field}`;
    select.className = 'form-input';

    // 選択肢を設定（hideLabelsの場合は「--選択--」に統一）
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = cascadeConfig.hideLabels ? '--選択--' : `${levelConfig.label}を選択`;
    select.appendChild(defaultOption);

    // 選択肢をフィルタリングして追加
    let filteredValues;
    if (index === 0) {
      // superCategoryOptionsがある場合は固定選択肢を使用
      filteredValues = cascadeConfig.superCategoryOptions || cascadeOptions[levelConfig.field];
    } else {
      // 2番目以降は上位レベルでフィルタリング
      const filteredCategories = categories.filter(cat => {
        for (let i = 0; i < index; i++) {
          const field = levels[i].field;
          if (cat[field] !== cascadeSelections[field]) {
            return false;
          }
        }
        return true;
      });
      filteredValues = [...new Set(filteredCategories.map(c => c[levelConfig.field]).filter(Boolean))];
      filteredValues.sort((a, b) => a.localeCompare(b, 'ja'));
    }

    // conditionalフィールドの表示制御
    if (levelConfig.conditional) {
      if (filteredValues.length === 0 && !hasExistingValue) {
        formGroup.style.display = 'none';
      }
    }

    (filteredValues || []).forEach(value => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      if (value === item[levelConfig.field]) {
        option.selected = true;
      }
      select.appendChild(option);
    });

    // 変更イベント
    select.addEventListener('change', () => {
      onCascadeSelectChange(levelConfig.field, select.value, index, levels);
    });

    formGroup.appendChild(select);
    modalBody.appendChild(formGroup);
  });

  // アイテム名入力フィールド
  const itemNameGroup = document.createElement('div');
  itemNameGroup.className = 'form-group';
  itemNameGroup.style.marginTop = '24px';

  const itemNameLabel = document.createElement('label');
  itemNameLabel.className = 'form-label';
  itemNameLabel.htmlFor = 'cascade-itemName';
  itemNameLabel.textContent = cascadeConfig.itemNameLabel || 'アイテム名';
  itemNameLabel.innerHTML += ' <span style="color: #ff4757;">*</span>';

  const itemNameInput = document.createElement('input');
  itemNameInput.type = 'text';
  itemNameInput.id = 'cascade-itemName';
  itemNameInput.className = 'form-input';
  itemNameInput.placeholder = '例: 半袖プリントTシャツ';
  itemNameInput.value = item.itemName || '';
  itemNameInput.addEventListener('input', updateCascadePreview);

  itemNameGroup.appendChild(itemNameLabel);
  itemNameGroup.appendChild(itemNameInput);
  modalBody.appendChild(itemNameGroup);

  // プレビュー表示
  const previewGroup = document.createElement('div');
  previewGroup.className = 'form-group';
  previewGroup.style.marginTop = '24px';

  const previewLabel = document.createElement('label');
  previewLabel.className = 'form-label';
  previewLabel.textContent = 'プレビュー';
  previewLabel.style.color = '#666';

  const previewBox = document.createElement('div');
  previewBox.id = 'cascade-preview';
  previewBox.style.cssText = `
    padding: 12px 16px;
    background: #f8f9fa;
    border-radius: 8px;
    font-size: 14px;
    color: #333;
    min-height: 20px;
  `;

  // 初期プレビュー
  const initialPath = item.fullPath || '';
  previewBox.textContent = initialPath;

  previewGroup.appendChild(previewLabel);
  previewGroup.appendChild(previewBox);
  modalBody.appendChild(previewGroup);

  modal.classList.remove('hidden');

  // 初期プレビュー更新
  updateCascadePreview();
}

/**
 * カスケードアイテム更新実行
 */
window.updateCascadeItem = async function() {
  const errorMessage = document.getElementById('addErrorMessage');

  if (!errorMessage || !masterToEdit) {
    console.error('[Master Manager] 更新対象がありません');
    return;
  }

  const cascadeConfig = currentMasterConfig.cascadeAdd;
  const levels = cascadeConfig.levels;

  // バリデーション
  let hasError = false;
  const data = {};

  // レベルの選択値をチェック
  for (const levelConfig of levels) {
    const value = cascadeSelections[levelConfig.field];
    if (!value) {
      showError(errorMessage, `${levelConfig.label}を選択してください`);
      hasError = true;
      break;
    }
    data[levelConfig.field] = value;
  }

  if (hasError) return;

  // アイテム名をチェック
  const itemName = document.getElementById('cascade-itemName')?.value.trim();
  if (!itemName) {
    showError(errorMessage, 'アイテム名を入力してください');
    return;
  }
  data.itemName = itemName;

  // fullPath生成
  const levelValues = levels.map(l => data[l.field]);
  data.fullPath = [...levelValues, itemName].join(' > ');

  // 重複チェック（自分自身は除外）
  const categories = masterCache[currentMasterConfig.collection] || [];
  const duplicate = categories.find(cat => cat.fullPath === data.fullPath && cat.id !== masterToEdit.id);
  if (duplicate) {
    showError(errorMessage, 'このカテゴリは既に存在します');
    return;
  }

  try {
    showLoading(true);

    // Firestore APIで更新
    const result = await window.updateMaster(currentMasterConfig.collection, masterToEdit.id, data);

    if (result.success) {
      console.log(`✅ [Master Manager] カスケード更新成功: ${data.fullPath}`);

      // ローカルデータを更新
      const updateLocalData = (dataArray) => {
        const index = dataArray.findIndex(m => m.id === masterToEdit.id);
        if (index !== -1) {
          dataArray[index] = { ...dataArray[index], ...data };
        }
      };

      updateLocalData(allMasterData);
      updateLocalData(filteredMasterData);
      if (masterCache[currentMasterConfig.collection]) {
        updateLocalData(masterCache[currentMasterConfig.collection]);
      }

      // ツリービューのキャッシュをクリア
      expandedTreeNodes.clear();

      // 画面更新
      renderMasterList();
      updateStats();

      hideAddModal();
      alert(`カテゴリを更新しました:\n${data.fullPath}`);
    } else {
      showError(errorMessage, result.error || '更新に失敗しました');
    }

  } catch (error) {
    console.error('❌ [Master Manager] カスケード更新エラー:', error);
    showError(errorMessage, `エラー: ${error.message || '更新に失敗しました'}`);
  } finally {
    showLoading(false);
  }
};

// ============================================
// マスタ編集
// ============================================

/**
 * 編集モーダル表示
 * @param {string} masterId - マスタID
 */
window.showEditModal = function(masterId) {
  const modal = document.getElementById('addModal');
  const modalTitle = document.getElementById('addModalTitle');
  const modalBody = document.getElementById('addModalBody');
  const errorMessage = document.getElementById('addErrorMessage');
  const submitBtn = document.getElementById('addSubmitBtn');

  if (!modal || !modalBody) {
    console.error('[Master Manager] モーダル要素が見つかりません');
    return;
  }

  // 編集対象を検索
  const item = filteredMasterData.find(m => m.id === masterId) ||
               allMasterData.find(m => m.id === masterId);
  if (!item) {
    console.error('[Master Manager] 編集対象が見つかりません:', masterId);
    alert('データが見つかりません');
    return;
  }

  masterToEdit = item;

  // currentMasterConfigが未設定の場合はエラー
  if (!currentMasterConfig) {
    console.error('[Master Manager] マスタが選択されていません');
    alert('マスタを選択してください');
    return;
  }

  // カスケード編集モードの場合は専用UIを表示
  if (currentMasterConfig.cascadeAdd && currentMasterConfig.cascadeAdd.enabled) {
    showCascadeEditModal(item);
    return;
  }

  // fieldsが未定義の場合はエラー
  if (!currentMasterConfig.fields || currentMasterConfig.fields.length === 0) {
    console.error('[Master Manager] マスタ設定にfieldsが定義されていません:', currentMasterConfig);
    alert('マスタ設定にエラーがあります');
    return;
  }

  // モーダルタイトルを変更
  if (modalTitle) {
    modalTitle.textContent = '編集';
  }

  // 送信ボタンのテキストを変更
  if (submitBtn) {
    submitBtn.textContent = '更新';
    submitBtn.setAttribute('onclick', 'updateMasterData()');
  }

  // エラーメッセージクリア
  if (errorMessage) {
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
  }

  // 入力フォーム動的生成（既存データを入力）
  modalBody.innerHTML = '';

  currentMasterConfig.fields.forEach(field => {
    const formGroup = document.createElement('div');
    formGroup.className = 'form-group';

    const label = document.createElement('label');
    label.className = 'form-label';
    label.htmlFor = `add-${field.name}`;
    label.textContent = field.label;
    if (field.required) {
      label.innerHTML += ' <span style="color: #ff4757;">*</span>';
    }

    const input = document.createElement('input');
    input.type = field.type === 'number' ? 'number' : 'text';
    input.id = `add-${field.name}`;
    input.className = 'form-input';
    input.placeholder = field.placeholder || '';
    if (field.maxLength) {
      input.maxLength = field.maxLength;
    }

    // 既存データを入力
    const existingValue = item[field.name];
    if (existingValue !== undefined && existingValue !== null) {
      input.value = existingValue;
    }

    formGroup.appendChild(label);
    formGroup.appendChild(input);
    modalBody.appendChild(formGroup);
  });

  modal.classList.remove('hidden');
};

/**
 * 編集モーダル非表示（追加モーダルと共通）
 */
window.hideEditModal = function() {
  hideAddModal(); // hideAddModal内でリセット処理も実行される
};

/**
 * マスタ更新実行
 */
window.updateMasterData = async function() {
  const errorMessage = document.getElementById('addErrorMessage');

  if (!errorMessage || !masterToEdit) {
    console.error('[Master Manager] 更新対象がありません');
    return;
  }

  // 入力値を収集
  const data = {};
  let hasError = false;

  currentMasterConfig.fields.forEach(field => {
    const input = document.getElementById(`add-${field.name}`);
    let value = input ? input.value.trim() : '';

    // 数値型の変換
    if (field.type === 'number' && value !== '') {
      value = parseFloat(value);
      if (isNaN(value)) {
        showError(errorMessage, `${field.label}は数値で入力してください`);
        hasError = true;
        return;
      }
    }

    // バリデーション
    if (field.required && (value === '' || value === null || value === undefined)) {
      showError(errorMessage, `${field.label}を入力してください`);
      hasError = true;
      return;
    }

    data[field.name] = value;
  });

  if (hasError) return;

  try {
    showLoading(true);

    // Firestore APIで更新
    const result = await window.updateMaster(currentMasterConfig.collection, masterToEdit.id, data);

    if (result.success) {
      console.log(`✅ [Master Manager] 更新成功: ${currentMasterConfig.label}`);

      // ローカルデータを更新
      const updateLocalData = (dataArray) => {
        const index = dataArray.findIndex(m => m.id === masterToEdit.id);
        if (index !== -1) {
          dataArray[index] = { ...dataArray[index], ...data };
        }
      };

      updateLocalData(allMasterData);
      updateLocalData(filteredMasterData);
      if (masterCache[currentMasterConfig.collection]) {
        updateLocalData(masterCache[currentMasterConfig.collection]);
      }

      // リスト再描画
      renderMasterList();

      // モーダルを閉じてリセット
      hideEditModal();
      alert(`${currentMasterConfig.label}を更新しました`);
    } else {
      const detailedError = result.error || '更新に失敗しました';
      console.error('❌ [Master Manager] 更新失敗:', detailedError);
      showError(errorMessage, detailedError);
    }

  } catch (error) {
    console.error('❌ [Master Manager] 更新エラー:', error);
    const detailedError = `エラー: ${error.message || '更新に失敗しました'}`;
    showError(errorMessage, detailedError);
  } finally {
    showLoading(false);
  }
};

// ============================================
// マスタ削除
// ============================================

/**
 * 削除確認モーダル表示
 * @param {string} masterId - マスタID
 */
window.showDeleteModal = function(masterId) {
  const modal = document.getElementById('deleteModal');
  const deleteNameDisplay = document.getElementById('deleteNameDisplay');

  if (!modal) return;

  // 削除対象を検索
  const item = filteredMasterData.find(m => m.id === masterId);
  if (!item) {
    console.error('[Master Manager] 削除対象が見つかりません:', masterId);
    return;
  }

  masterToDelete = item;

  // プライマリフィールドを表示
  const primaryField = currentMasterConfig.displayFields[0];
  const displayName = item[primaryField] || '';

  if (deleteNameDisplay) {
    deleteNameDisplay.innerHTML = `
      <div style="font-weight: 600; color: #333;">${escapeHtml(displayName)}</div>
    `;
  }

  modal.classList.remove('hidden');
};

/**
 * 削除確認モーダル非表示
 */
window.hideDeleteModal = function() {
  const modal = document.getElementById('deleteModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  masterToDelete = null;
};

/**
 * マスタ削除実行
 */
window.confirmDelete = async function() {
  if (!masterToDelete) {
    console.warn('[Master Manager] 削除対象が選択されていません');
    return;
  }

  try {
    showLoading(true);

    const result = await window.deleteMaster(currentMasterConfig.collection, masterToDelete.id);

    if (result.success) {
      console.log(`✅ [Master Manager] 削除成功: ${masterToDelete.id}`);

      // 検索結果から削除
      allMasterData = allMasterData.filter(item => item.id !== masterToDelete.id);
      filteredMasterData = filteredMasterData.filter(item => item.id !== masterToDelete.id);

      // キャッシュからも削除
      if (masterCache[currentMasterConfig.collection]) {
        masterCache[currentMasterConfig.collection] = masterCache[currentMasterConfig.collection].filter(
          item => item.id !== masterToDelete.id
        );
      }

      // 件数を更新（動的カウント）
      if (masterTotalCount > 0) {
        masterTotalCount--;
        updateEmptyStateCount();
        console.log(`📊 [Master Manager] 件数更新: ${masterTotalCount.toLocaleString()}件`);
      }

      renderMasterList();
      updateStats();

      hideDeleteModal();
      alert(`${currentMasterConfig.label}を削除しました`);
    } else {
      alert(result.error || '削除に失敗しました');
    }

  } catch (error) {
    console.error('❌ [Master Manager] 削除エラー:', error);
    alert('削除に失敗しました');
  } finally {
    showLoading(false);
    masterToDelete = null;
  }
};

// ============================================
// 選択モード機能
// ============================================

/**
 * 選択モードの切り替え
 */
window.toggleSelectionMode = function() {
  selectionMode = !selectionMode;
  selectedMasterData.clear();

  const selectModeBtn = document.getElementById('selectModeBtn');
  const selectionToolbar = document.getElementById('selectionToolbar');

  if (selectionMode) {
    // 選択モードON
    if (selectModeBtn) {
      selectModeBtn.classList.add('active');
      // ボタンのテキストとアイコンを「解除」に変更
      selectModeBtn.innerHTML = '<i class="bi bi-x-square"></i><span>選択解除</span>';
    }
    if (selectionToolbar) selectionToolbar.classList.remove('hidden');
  } else {
    // 選択モードOFF
    if (selectModeBtn) {
      selectModeBtn.classList.remove('active');
      // ボタンのテキストとアイコンを「選択削除」に戻す
      selectModeBtn.innerHTML = '<i class="bi bi-check-square"></i><span>選択削除</span>';
    }
    if (selectionToolbar) selectionToolbar.classList.add('hidden');
  }

  // リスト再描画
  renderMasterList();
  updateSelectionCount();
};

/**
 * 全選択
 */
window.selectAll = function() {
  filteredMasterData.forEach(item => {
    selectedMasterData.add(item.id);
  });
  renderMasterList();
  updateSelectionCount();
};

/**
 * 選択されたマスタを削除
 */
window.deleteSelected = async function() {
  if (selectedMasterData.size === 0) {
    alert('削除するデータを選択してください');
    return;
  }

  const count = selectedMasterData.size;
  if (!confirm(`選択した${count}件を削除しますか？\n\nこの操作は取り消せません。`)) {
    return;
  }

  showLoading(true);

  try {
    const deletePromises = Array.from(selectedMasterData).map(id =>
      window.deleteMaster(currentMasterConfig.collection, id)
    );

    const results = await Promise.all(deletePromises);
    const successCount = results.filter(r => r.success).length;

    showLoading(false);

    if (successCount === count) {
      alert(`${successCount}件を削除しました`);
    } else {
      alert(`${successCount}/${count}件を削除しました\n一部削除に失敗しました`);
    }

    // キャッシュクリア
    delete masterCache[currentMasterConfig.collection];

    // 選択モードOFF
    window.toggleSelectionMode();

    // 検索を再実行
    const searchInput = document.getElementById('searchInput');
    if (searchInput && searchInput.value.trim().length > 0) {
      await performSearch(searchInput.value.trim());
    } else {
      allMasterData = [];
      filteredMasterData = [];
      renderMasterList();
      updateStats();
    }

  } catch (error) {
    showLoading(false);
    console.error('❌ [Master Manager] 一括削除エラー:', error);
    alert('削除中にエラーが発生しました');
  }
};

/**
 * マスタの選択状態を切り替え
 */
window.toggleMasterSelection = function(masterId) {
  if (selectedMasterData.has(masterId)) {
    selectedMasterData.delete(masterId);
  } else {
    selectedMasterData.add(masterId);
  }
  updateSelectionCount();

  // カードの見た目を更新
  const card = document.querySelector(`[data-master-id="${masterId}"]`);
  const checkbox = card?.querySelector('.master-checkbox');
  if (card && checkbox) {
    checkbox.checked = selectedMasterData.has(masterId);
    if (selectedMasterData.has(masterId)) {
      card.classList.add('selected');
    } else {
      card.classList.remove('selected');
    }
  }
};

/**
 * 選択件数表示を更新
 */
function updateSelectionCount() {
  const selectedCount = document.getElementById('selectedCount');
  if (selectedCount) {
    selectedCount.textContent = `${selectedMasterData.size}件選択中`;
  }
}

// ============================================
// ユーティリティ関数
// ============================================

/**
 * ローディング表示制御
 * @param {boolean} show - 表示/非表示
 */
function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) {
    if (show) {
      overlay.classList.remove('hidden');
    } else {
      overlay.classList.add('hidden');
    }
  }
}

/**
 * エラーメッセージ表示
 * @param {HTMLElement} element - エラー表示要素
 * @param {string} message - エラーメッセージ
 */
function showError(element, message) {
  if (element) {
    element.textContent = message;
    element.classList.remove('hidden');
  }
}

/**
 * HTMLエスケープ
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープされた文字列
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 戻るボタン処理
 */
window.goBack = function() {
  // トップメニューに戻る（絶対パス使用）
  window.location.href = '/index.html';
};

/**
 * グローバル関数公開（HTML onclickから呼び出し可能にする）
 */
window.loadMaster = loadMaster;

console.log('✅ [Master Manager] モジュール読み込み完了');
