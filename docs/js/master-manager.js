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
let currentProductSubGroup = 'listing'; // 商品マスタのサブグループ（listing/description）
let currentBusinessSubGroup = 'delivery'; // 業務マスタのサブグループ（delivery/material/partner/system）
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
// ヘルパー関数
// ============================================

/**
 * プラットフォームが属するグループのメンバーを取得
 * 同じグループ内のプラットフォームはデータを共有する
 * @param {string} platformId - プラットフォームID
 * @returns {string[]} グループメンバーの配列（グループがなければ元のIDのみ）
 */
function getPlatformGroupMembers(platformId) {
  if (!currentMasterConfig?.platformGroups) {
    return [platformId];
  }

  // プラットフォームが属するグループを探す
  for (const [groupName, members] of Object.entries(currentMasterConfig.platformGroups)) {
    if (members.includes(platformId)) {
      return members;
    }
  }

  return [platformId];
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
 * 商品マスタのサブグループを切り替え
 * @param {string} subGroupId - 'listing' または 'description'
 */
window.switchProductSubGroup = function(subGroupId) {
  if (currentProductSubGroup === subGroupId) return;
  
  currentProductSubGroup = subGroupId;
  
  // ボタンのアクティブ状態を更新
  const buttons = document.querySelectorAll('#productSubGroupButtons .sub-group-btn');
  buttons.forEach(btn => {
    const isActive = btn.dataset.subgroup === subGroupId;
    btn.classList.toggle('active', isActive);
  });
  
  // タブの表示/非表示を切り替え
  const listingTabs = document.getElementById('productMasterTabs-listing');
  const descriptionTabs = document.getElementById('productMasterTabs-description');
  
  if (subGroupId === 'listing') {
    listingTabs.style.display = 'flex';
    descriptionTabs.style.display = 'none';
    
    // 出品設定グループの最初のタブをアクティブに
    const firstTab = listingTabs.querySelector('.nav-link');
    if (firstTab) {
      // 他のタブのアクティブを解除
      listingTabs.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
      descriptionTabs.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
      firstTab.classList.add('active');
      loadMaster('product', 'brand');
    }
  } else {
    listingTabs.style.display = 'none';
    descriptionTabs.style.display = 'flex';
    
    // 説明文生成グループの最初のタブをアクティブに
    const firstTab = descriptionTabs.querySelector('.nav-link');
    if (firstTab) {
      // 他のタブのアクティブを解除
      listingTabs.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
      descriptionTabs.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
      firstTab.classList.add('active');
      loadMaster('product', 'material');
    }
  }
  
  console.log(`🔄 [Master Manager] サブグループ切り替え: ${subGroupId}`);
};

/**
 * 業務マスタのサブグループを切り替え
 * @param {string} subGroupId - 'delivery', 'material', 'partner', 'system'
 */
window.switchBusinessSubGroup = function(subGroupId) {
  if (currentBusinessSubGroup === subGroupId) return;
  
  currentBusinessSubGroup = subGroupId;
  
  // ボタンのアクティブ状態を更新
  const buttons = document.querySelectorAll('#businessSubGroupButtons .sub-group-btn');
  buttons.forEach(btn => {
    const isActive = btn.dataset.subgroup === subGroupId;
    btn.classList.toggle('active', isActive);
  });
  
  // 全てのタブを非表示
  const tabGroups = ['delivery', 'material', 'partner', 'system'];
  tabGroups.forEach(group => {
    const tabs = document.getElementById(`businessMasterTabs-${group}`);
    if (tabs) {
      tabs.style.display = 'none';
      tabs.querySelectorAll('.nav-link').forEach(tab => tab.classList.remove('active'));
    }
  });
  
  // 選択されたタブグループを表示
  const activeTabs = document.getElementById(`businessMasterTabs-${subGroupId}`);
  if (activeTabs) {
    activeTabs.style.display = 'flex';
    
    // 最初のタブをアクティブに
    const firstTab = activeTabs.querySelector('.nav-link');
    if (firstTab) {
      firstTab.classList.add('active');
      
      // サブグループに応じてデフォルトマスタをロード
      if (subGroupId === 'system') {
        loadManagementNumberMaster();
      } else {
        const defaultMasters = {
          delivery: 'shipping',
          material: 'packaging',
          partner: 'supplier'
        };
        loadMaster('business', defaultMasters[subGroupId] || 'shipping');
      }
    }
  }
  
  console.log(`🔄 [Master Manager] 業務サブグループ切り替え: ${subGroupId}`);
};

// 管理番号マスタの現在のタイプ（rank または categoryCode）
let currentManagementNumberType = 'rank';

/**
 * 管理番号マスタをロード（ドロップダウンセレクター付き）
 */
window.loadManagementNumberMaster = function() {
  console.log(`📋 [Master Manager] 管理番号マスタロード: ${currentManagementNumberType}`);
  
  // ドロップダウンセレクターを表示
  showManagementNumberSelector();
  
  // 現在のタイプに応じてマスタをロード
  loadMaster('business', currentManagementNumberType);
};

/**
 * 管理番号タイプを切り替え
 */
window.switchManagementNumberType = function(type) {
  if (currentManagementNumberType === type) return;
  
  currentManagementNumberType = type;
  console.log(`🔄 [Master Manager] 管理番号タイプ切り替え: ${type}`);
  
  // マスタをロード
  loadMaster('business', type);
};

/**
 * 管理番号セレクターを表示
 */
function showManagementNumberSelector() {
  const searchContainer = document.getElementById('searchContainer');
  if (!searchContainer) return;
  
  // 既存のセレクターを削除
  const existingSelector = document.getElementById('managementNumberSelector');
  if (existingSelector) {
    existingSelector.remove();
  }
  
  // セレクターHTMLを作成
  const selectorHtml = `
    <div id="managementNumberSelector" class="master-options-dropdown-selector" style="max-width: 800px; margin: 0 auto 16px; padding: 0 16px;">
      <div style="background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <label>管理番号設定</label>
        <select class="form-select" onchange="switchManagementNumberType(this.value)">
          <option value="rank" ${currentManagementNumberType === 'rank' ? 'selected' : ''}>ランク（商品状態）</option>
          <option value="categoryCode" ${currentManagementNumberType === 'categoryCode' ? 'selected' : ''}>カテゴリコード</option>
        </select>
      </div>
    </div>
  `;
  
  // 検索バーの前に挿入
  searchContainer.insertAdjacentHTML('beforebegin', selectorHtml);
}

/**
 * 管理番号セレクターを非表示
 */
function hideManagementNumberSelector() {
  const selector = document.getElementById('managementNumberSelector');
  if (selector) {
    selector.remove();
  }
}

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

  // 管理番号以外のマスタではセレクターを非表示
  if (type !== 'rank' && type !== 'categoryCode') {
    hideManagementNumberSelector();
  }

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
      // 商品タブのアクティブ状態をクリア（両サブグループ）
      document.querySelectorAll('#productMasterTabs-listing .nav-link, #productMasterTabs-description .nav-link').forEach(tab => {
        tab.classList.remove('active');
      });
    }

    // 現在のタブをアクティブに設定
    const currentTabId = `master-${type}-tab`;
    const currentTab = document.getElementById(currentTabId);
    if (currentTab) {
      // 同じグループ内の他のタブのアクティブを解除
      if (category === 'product') {
        // 商品関連は両サブグループのタブをクリア
        document.querySelectorAll('#productMasterTabs-listing .nav-link, #productMasterTabs-description .nav-link').forEach(tab => {
          tab.classList.remove('active');
        });
      } else {
        // 業務関連は全サブグループのタブをクリア
        ['delivery', 'material', 'partner', 'system'].forEach(group => {
          document.querySelectorAll(`#businessMasterTabs-${group} .nav-link`).forEach(tab => {
            tab.classList.remove('active');
          });
        });
      }
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

  // 検索バーを表示し、プレースホルダーを更新
  showSearchUI();
  updateSearchPlaceholder();
  clearSearchInput();

  // masterOptionsタイプの場合は専用UIを表示
  if (currentMasterConfig.type === 'masterOptions') {
    console.log('📋 [Master Manager] masterOptionsタイプ - 専用UI表示');
    
    // プラットフォーム別管理の場合はタブを表示
    if (currentMasterConfig.platformSupport) {
      currentPlatform = currentMasterConfig.defaultPlatform || 'mercari';
      showPlatformTabs();
    } else {
      hidePlatformTabs();
    }
    
    hideActionBar();
    await renderMasterOptionsUI();
    return;
  }

  // masterOptionsDropdownタイプの場合はドロップダウン切替UIを表示
  if (currentMasterConfig.type === 'masterOptionsDropdown') {
    console.log('📋 [Master Manager] masterOptionsDropdownタイプ - ドロップダウンUI表示');
    hidePlatformTabs();
    hideActionBar();
    await renderMasterOptionsDropdownUI();
    return;
  }

  // simpleListタイプの場合はシンプルリストUIを表示
  if (currentMasterConfig.type === 'simpleList') {
    console.log('📋 [Master Manager] simpleListタイプ - シンプルリストUI表示');
    // プラットフォームサポートがある場合はタブを表示
    if (currentMasterConfig.platformSupport) {
      currentPlatform = currentMasterConfig.defaultPlatform || 'mercari';
      showPlatformTabs();
    } else {
      hidePlatformTabs();
    }
    hideActionBar();
    await renderSimpleListUI();
    return;
  }

  // categoryWordsタイプの場合（セールスワード等：カテゴリ→値配列構造）
  if (currentMasterConfig.type === 'categoryWords') {
    console.log('📋 [Master Manager] categoryWordsタイプ - カテゴリ別ワードUI表示');
    hidePlatformTabs();
    hideActionBar();
    await renderCategoryWordsUI();
    return;
  }

  // categoryWordsDropdownタイプの場合（ドロップダウン形式でカテゴリ選択）
  if (currentMasterConfig.type === 'categoryWordsDropdown') {
    console.log('📋 [Master Manager] categoryWordsDropdownタイプ - ドロップダウン形式UI表示');
    hidePlatformTabs();
    hideActionBar();
    await renderCategoryWordsDropdownUI();
    return;
  }

  // shippingDropdownタイプの場合（発送方法管理）
  if (currentMasterConfig.type === 'shippingDropdown') {
    console.log('📋 [Master Manager] shippingDropdownタイプ - 発送方法UI表示');
    // プラットフォームサポートがある場合はタブを表示
    if (currentMasterConfig.platformSupport) {
      currentPlatform = currentMasterConfig.defaultPlatform || 'mercari';
      showPlatformTabs();
    } else {
      hidePlatformTabs();
    }
    hideActionBar();
    await renderShippingDropdownUI();
    return;
  }

  // packagingDropdownタイプの場合（梱包資材管理）
  if (currentMasterConfig.type === 'packagingDropdown') {
    console.log('📋 [Master Manager] packagingDropdownタイプ - 梱包資材UI表示');
    hidePlatformTabs();
    hideActionBar();
    await renderPackagingDropdownUI();
    return;
  }

  // salesChannelDropdownタイプの場合（出品先管理）
  if (currentMasterConfig.type === 'salesChannelDropdown') {
    console.log('📋 [Master Manager] salesChannelDropdownタイプ - 出品先UI表示');
    hidePlatformTabs();
    hideActionBar();
    await renderSalesChannelDropdownUI();
    return;
  }

  // 通常タイプの場合はアクションバーを表示
  showActionBar();

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
 * 検索UIを非表示
 */
function hideSearchUI() {
  const searchContainer = document.getElementById('searchContainer');
  if (searchContainer) {
    searchContainer.style.display = 'none';
  }
}

/**
 * 検索UIを表示
 */
function showSearchUI() {
  const searchContainer = document.getElementById('searchContainer');
  if (searchContainer) {
    searchContainer.style.display = 'block';
  }
}

/**
 * アクションバーを非表示
 */
function hideActionBar() {
  const actionBar = document.querySelector('.action-bar');
  if (actionBar) {
    actionBar.style.display = 'none';
  }
}

/**
 * アクションバーを表示
 */
function showActionBar() {
  const actionBar = document.querySelector('.action-bar');
  if (actionBar) {
    actionBar.style.display = 'flex';
  }
}

/**
 * 検索プレースホルダーを現在のタブに応じて更新
 */
function updateSearchPlaceholder() {
  const searchInput = document.getElementById('searchInput');
  if (!searchInput || !currentMasterConfig) return;

  const label = currentMasterConfig.label || 'アイテム';
  searchInput.placeholder = `${label}を検索...`;
}

/**
 * 検索入力をクリア
 */
function clearSearchInput() {
  const searchInput = document.getElementById('searchInput');
  const resultCount = document.getElementById('searchResultCount');
  if (searchInput) searchInput.value = '';
  if (resultCount) resultCount.textContent = '';
}

/**
 * グローバルフィルター処理（全タブ共通）
 * タブのタイプに応じて適切なフィルター関数を呼び出す
 */
window.handleGlobalFilter = function(query) {
  if (!currentMasterConfig) return;

  const type = currentMasterConfig.type;

  switch (type) {
    case 'masterOptions':
      filterMasterOptions(query);
      break;
    case 'masterOptionsDropdown':
      filterDropdownItems(query);
      break;
    case 'simpleList':
      filterSimpleList(query);
      break;
    case 'categoryWords':
      filterCategoryWords(query);
      break;
    case 'categoryWordsDropdown':
      filterCWDropdownItems(query);
      break;
    default:
      // ブランド・カテゴリ等の通常タイプ
      filterDefaultList(query);
      break;
  }
};

/**
 * 通常リスト（ブランド・カテゴリ等）のフィルター処理
 */
function filterDefaultList(query) {
  const normalizedQuery = query.toLowerCase().trim();
  const items = document.querySelectorAll('#masterListContainer .master-item, #masterListContainer .tree-node');
  let visible = 0;

  items.forEach(item => {
    const text = (item.dataset.text || item.textContent || '').toLowerCase();
    if (!normalizedQuery || text.includes(normalizedQuery)) {
      item.classList.remove('hidden');
      visible++;
    } else {
      item.classList.add('hidden');
    }
  });

  updateSearchResultCount(visible, normalizedQuery);
}

/**
 * 検索結果カウントを更新
 */
function updateSearchResultCount(count, query) {
  const resultCount = document.getElementById('searchResultCount');
  if (resultCount) {
    resultCount.textContent = query ? `${count}件` : '';
  }
}

// ============================================
// masterOptions 専用UI
// ============================================

/**
 * masterOptionsフィールドのデータを取得
 */
async function getMasterOptionsFieldData(fieldKey, platformId = null) {
  try {
    // フィールド名をURLセーフに変換
    let safeFieldName = fieldKey
      .replace(/\//g, '_')
      .replace(/\(/g, '_')
      .replace(/\)/g, '_')
      .replace(/\s/g, '_');

    // プラットフォーム指定がある場合はドキュメント名に追加
    if (platformId) {
      safeFieldName = `${safeFieldName}_${platformId}`;
    }

    const doc = await db.collection('masterOptions').doc(safeFieldName).get();
    if (doc.exists) {
      return doc.data().items || [];
    }
    
    // プラットフォーム指定でデータがない場合、フォールバックとしてプラットフォームなしのデータを返す
    // （既存データの互換性のため）
    if (platformId) {
      const fallbackFieldName = fieldKey
        .replace(/\//g, '_')
        .replace(/\(/g, '_')
        .replace(/\)/g, '_')
        .replace(/\s/g, '_');
      const fallbackDoc = await db.collection('masterOptions').doc(fallbackFieldName).get();
      if (fallbackDoc.exists) {
        console.log(`ℹ️ [Master Options] プラットフォーム「${platformId}」のデータがないため、共通データを使用`);
        return fallbackDoc.data().items || [];
      }
    }
    
    return [];
  } catch (error) {
    console.error(`❌ [Master Options] データ取得エラー: ${fieldKey}`, error);
    return [];
  }
}

/**
 * masterOptionsフィールドのデータを保存
 */
async function saveMasterOptionsFieldData(fieldKey, items, platformId = null) {
  try {
    // フィールド名をURLセーフに変換
    let safeFieldName = fieldKey
      .replace(/\//g, '_')
      .replace(/\(/g, '_')
      .replace(/\)/g, '_')
      .replace(/\s/g, '_');

    // プラットフォーム指定がある場合はドキュメント名に追加
    if (platformId) {
      safeFieldName = `${safeFieldName}_${platformId}`;
    }

    await db.collection('masterOptions').doc(safeFieldName).set({
      fieldName: fieldKey,
      items: items,
      platformId: platformId || null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const platformLabel = platformId ? `(${platformId})` : '';
    console.log(`✅ [Master Options] 保存完了: ${fieldKey}${platformLabel} (${items.length}件)`);
    return true;
  } catch (error) {
    console.error(`❌ [Master Options] 保存エラー: ${fieldKey}`, error);
    return false;
  }
}

/**
 * masterOptions専用UIをレンダリング
 */
async function renderMasterOptionsUI() {
  const container = document.getElementById('masterListContainer');
  const emptyState = document.getElementById('emptyState');

  if (!container) return;

  // 空状態を非表示
  if (emptyState) emptyState.classList.add('hidden');

  // フィールド設定を取得
  const fields = currentMasterConfig.masterOptionsFields || [];

  if (fields.length === 0) {
    container.innerHTML = '<p class="text-center text-muted py-4">フィールドが設定されていません</p>';
    return;
  }

  // プラットフォーム対応の場合は現在のプラットフォームを使用
  const platformId = currentMasterConfig.platformSupport ? currentPlatform : null;

  // 各フィールドのデータを取得（プラットフォーム対応）
  const fieldsData = await Promise.all(
    fields.map(async (field) => ({
      ...field,
      items: await getMasterOptionsFieldData(field.key, platformId)
    }))
  );

  // 総アイテム数を計算
  const totalItems = fieldsData.reduce((sum, f) => sum + f.items.length, 0);
  const placeholder = currentMasterConfig.searchPlaceholder || `${currentMasterConfig.label}を検索...`;

  // UIを生成
  container.innerHTML = `
    <div class="master-options-container">
      ${fieldsData.map((field, fieldIndex) => `
        <div class="master-options-section" data-field-index="${fieldIndex}" data-field-key="${field.key}">
          <div class="master-options-header">
            <h6><i class="bi ${field.icon || 'bi-list'}"></i> ${field.label}</h6>
            <span class="badge bg-secondary" id="fieldCount_${fieldIndex}">${field.items.length}件</span>
          </div>
          <div class="master-options-list" id="masterOptionsList_${fieldIndex}">
            ${field.items.map((item, itemIndex) => `
              <div class="master-options-item" data-item-index="${itemIndex}" data-text="${escapeHtml(item.toLowerCase())}">
                <span class="item-text">${escapeHtml(item)}</span>
                <div class="item-actions">
                  <button class="btn-icon btn-edit" onclick="editMasterOptionItem(${fieldIndex}, ${itemIndex})" title="編集">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn-icon btn-delete" onclick="deleteMasterOptionItem(${fieldIndex}, ${itemIndex})" title="削除">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="master-options-add">
            <input type="text" class="form-control form-control-sm" id="newItem_${fieldIndex}" placeholder="${field.placeholder || '新しい項目を入力'}">
            <button class="btn btn-sm btn-primary" onclick="addMasterOptionItem(${fieldIndex})">
              <i class="bi bi-plus"></i> 追加
            </button>
          </div>
        </div>
      `).join('')}
    </div>
  `;

  // 現在のフィールドデータをグローバルに保持（編集・削除用）
  window._masterOptionsFieldsData = fieldsData;
}

/**
 * masterOptionsのフィルター処理
 */
window.filterMasterOptions = function(query) {
  const normalizedQuery = query.toLowerCase().trim();
  const sections = document.querySelectorAll('.master-options-section');
  let totalVisible = 0;

  sections.forEach((section, sectionIndex) => {
    const items = section.querySelectorAll('.master-options-item');
    let visibleInSection = 0;

    items.forEach(item => {
      const text = item.dataset.text || '';
      if (!normalizedQuery || text.includes(normalizedQuery)) {
        item.classList.remove('hidden');
        visibleInSection++;
      } else {
        item.classList.add('hidden');
      }
    });

    // セクション内のカウント更新
    const badge = section.querySelector(`#fieldCount_${sectionIndex}`);
    if (badge) {
      badge.textContent = `${visibleInSection}件`;
    }

    totalVisible += visibleInSection;
  });

  // グローバル検索カウント更新
  updateSearchResultCount(totalVisible, normalizedQuery);
}

/**
 * masterOptionsに項目を追加
 */
window.addMasterOptionItem = async function(fieldIndex) {
  const input = document.getElementById(`newItem_${fieldIndex}`);
  const value = input?.value?.trim();

  if (!value) {
    alert('値を入力してください');
    return;
  }

  const fieldData = window._masterOptionsFieldsData[fieldIndex];
  if (!fieldData) return;

  // 重複チェック
  if (fieldData.items.includes(value)) {
    alert('この値は既に登録されています');
    return;
  }

  // 配列に追加
  fieldData.items.push(value);

  // プラットフォーム対応の場合は現在のプラットフォームを使用
  const platformId = currentMasterConfig?.platformSupport ? currentPlatform : null;

  // Firestoreに保存
  const success = await saveMasterOptionsFieldData(fieldData.key, fieldData.items, platformId);
  if (success) {
    input.value = '';
    await renderMasterOptionsUI();
  } else {
    // 失敗時はロールバック
    fieldData.items.pop();
    alert('保存に失敗しました');
  }
};

/**
 * masterOptionsの項目を編集
 */
window.editMasterOptionItem = async function(fieldIndex, itemIndex) {
  const fieldData = window._masterOptionsFieldsData[fieldIndex];
  if (!fieldData) return;

  const currentValue = fieldData.items[itemIndex];
  const newValue = prompt('新しい値を入力:', currentValue);

  if (newValue === null || newValue.trim() === '') return;
  if (newValue.trim() === currentValue) return;

  // 重複チェック
  if (fieldData.items.includes(newValue.trim()) && newValue.trim() !== currentValue) {
    alert('この値は既に登録されています');
    return;
  }

  const oldValue = fieldData.items[itemIndex];
  fieldData.items[itemIndex] = newValue.trim();

  // プラットフォーム対応の場合は現在のプラットフォームを使用
  const platformId = currentMasterConfig?.platformSupport ? currentPlatform : null;

  const success = await saveMasterOptionsFieldData(fieldData.key, fieldData.items, platformId);
  if (success) {
    await renderMasterOptionsUI();
  } else {
    fieldData.items[itemIndex] = oldValue;
    alert('保存に失敗しました');
  }
};

/**
 * masterOptionsの項目を削除
 */
window.deleteMasterOptionItem = async function(fieldIndex, itemIndex) {
  const fieldData = window._masterOptionsFieldsData[fieldIndex];
  if (!fieldData) return;

  const value = fieldData.items[itemIndex];
  if (!confirm(`「${value}」を削除しますか？`)) return;

  const removedItem = fieldData.items.splice(itemIndex, 1)[0];

  // プラットフォーム対応の場合は現在のプラットフォームを使用
  const platformId = currentMasterConfig?.platformSupport ? currentPlatform : null;

  const success = await saveMasterOptionsFieldData(fieldData.key, fieldData.items, platformId);
  if (success) {
    await renderMasterOptionsUI();
  } else {
    fieldData.items.splice(itemIndex, 0, removedItem);
    alert('削除に失敗しました');
  }
};

// ============================================
// masterOptions ドロップダウン切替UI（商品属性用）
// ============================================

// 現在選択中のカテゴリインデックス
let currentDropdownCategoryIndex = 0;

/**
 * masterOptionsドロップダウンUIをレンダリング
 */
async function renderMasterOptionsDropdownUI() {
  const container = document.getElementById('masterListContainer');
  const emptyState = document.getElementById('emptyState');

  if (!container) return;

  // 空状態を非表示
  if (emptyState) emptyState.classList.add('hidden');

  // カテゴリ設定を取得（設定のみ - _indexからの追加読み込みは無効化）
  // masterOptionsCategories が定義済みの場合はそれのみを使用
  let categories = [...(currentMasterConfig.masterOptionsCategories || [])];

  if (categories.length === 0) {
    container.innerHTML = `
      <div class="master-options-container">
        <div class="master-options-empty" style="padding: 40px; text-align: center;">
          <p>カテゴリがありません</p>
          <div class="master-options-add" style="border-top: none; margin-top: 16px;">
            <input type="text" class="form-control form-control-sm" id="newMasterOptionsCategoryName" placeholder="新しいカテゴリ名">
            <button class="btn btn-sm btn-outline-primary" onclick="addMasterOptionsCategory()">
              <i class="bi bi-folder-plus"></i> カテゴリ追加
            </button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // 選択中のカテゴリのデータを取得
  const selectedCategory = categories[currentDropdownCategoryIndex];
  const items = await getMasterOptionsFieldData(selectedCategory.key);

  // UIを生成
  container.innerHTML = `
    <div class="master-options-container">
      <!-- カテゴリ選択ドロップダウン -->
      <div class="master-options-dropdown-selector">
        <label for="attributeCategorySelect">カテゴリ選択</label>
        <select id="attributeCategorySelect" class="form-select" onchange="changeAttributeCategory(this.value)">
          ${categories.map((cat, index) => `
            <option value="${index}" ${index === currentDropdownCategoryIndex ? 'selected' : ''}>
              ${cat.label}
            </option>
          `).join('')}
        </select>
      </div>

      <!-- 選択されたカテゴリの内容 -->
      <div class="master-options-section" data-category-key="${selectedCategory.key}">
        <div class="master-options-header">
          <h6><i class="bi ${selectedCategory.icon || 'bi-list'}"></i> ${selectedCategory.label}</h6>
          <span class="badge bg-secondary" id="dropdownItemCount">${items.length}件</span>
        </div>
        <div class="master-options-list" id="masterOptionsDropdownList">
          ${items.length === 0 ? `
            <div class="master-options-empty">
              <p>このカテゴリにはまだ項目がありません</p>
            </div>
          ` : items.map((item, itemIndex) => `
            <div class="master-options-item" data-item-index="${itemIndex}" data-text="${escapeHtml(item.toLowerCase())}">
              <span class="item-text">${escapeHtml(item)}</span>
              <div class="item-actions">
                <button class="btn-icon btn-edit" onclick="editDropdownItem(${itemIndex})" title="編集">
                  <i class="bi bi-pencil"></i>
                </button>
                <button class="btn-icon btn-delete" onclick="deleteDropdownItem(${itemIndex})" title="削除">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="master-options-add">
          <input type="text" class="form-control form-control-sm" id="newDropdownItem" placeholder="新しい${selectedCategory.label}を入力">
          <button class="btn btn-sm btn-primary" onclick="addDropdownItem()">
            <i class="bi bi-plus"></i> 追加
          </button>
        </div>
      </div>

      <!-- 新規カテゴリ追加 -->
      <div class="master-options-section" style="background: #f8f9fa;">
        <div class="master-options-add" style="border-top: none;">
          <input type="text" class="form-control form-control-sm" id="newMasterOptionsCategoryName" placeholder="新しいカテゴリ名">
          <button class="btn btn-sm btn-outline-primary" onclick="addMasterOptionsCategory()">
            <i class="bi bi-folder-plus"></i> カテゴリ追加
          </button>
        </div>
      </div>
    </div>
  `;

  // 現在のカテゴリデータを保持
  window._currentDropdownCategory = selectedCategory;
  window._currentDropdownItems = items;
  window._currentMasterOptionsCategories = categories;
}

/**
 * ドロップダウンUIのフィルター処理
 */
window.filterDropdownItems = function(query) {
  const normalizedQuery = query.toLowerCase().trim();
  const items = document.querySelectorAll('#masterOptionsDropdownList .master-options-item');
  let visible = 0;

  items.forEach(item => {
    const text = item.dataset.text || '';
    if (!normalizedQuery || text.includes(normalizedQuery)) {
      item.classList.remove('hidden');
      visible++;
    } else {
      item.classList.add('hidden');
    }
  });

  // セクション内カウント更新
  const itemCount = document.getElementById('dropdownItemCount');
  if (itemCount) itemCount.textContent = `${visible}件`;

  // グローバル検索カウント更新
  updateSearchResultCount(visible, normalizedQuery);
}

/**
 * カテゴリ変更
 */
window.changeAttributeCategory = async function(index) {
  currentDropdownCategoryIndex = parseInt(index);
  await renderMasterOptionsDropdownUI();
};

/**
 * ドロップダウンUIで項目追加
 */
window.addDropdownItem = async function() {
  const input = document.getElementById('newDropdownItem');
  const value = input?.value?.trim();

  if (!value) {
    alert('値を入力してください');
    return;
  }

  const category = window._currentDropdownCategory;
  const items = window._currentDropdownItems;

  if (!category) return;

  // 重複チェック
  if (items.includes(value)) {
    alert('この値は既に登録されています');
    return;
  }

  // 配列に追加
  items.push(value);

  // Firestoreに保存
  const success = await saveMasterOptionsFieldData(category.key, items);
  if (success) {
    input.value = '';
    await renderMasterOptionsDropdownUI();
  } else {
    items.pop();
    alert('保存に失敗しました');
  }
};

/**
 * ドロップダウンUIで項目編集
 */
window.editDropdownItem = async function(itemIndex) {
  const category = window._currentDropdownCategory;
  const items = window._currentDropdownItems;

  if (!category || !items) return;

  const currentValue = items[itemIndex];
  const newValue = prompt('新しい値を入力:', currentValue);

  if (newValue === null || newValue.trim() === '') return;
  if (newValue.trim() === currentValue) return;

  // 重複チェック
  if (items.includes(newValue.trim()) && newValue.trim() !== currentValue) {
    alert('この値は既に登録されています');
    return;
  }

  const oldValue = items[itemIndex];
  items[itemIndex] = newValue.trim();

  const success = await saveMasterOptionsFieldData(category.key, items);
  if (success) {
    await renderMasterOptionsDropdownUI();
  } else {
    items[itemIndex] = oldValue;
    alert('保存に失敗しました');
  }
};

/**
 * ドロップダウンUIで項目削除
 */
window.deleteDropdownItem = async function(itemIndex) {
  const category = window._currentDropdownCategory;
  const items = window._currentDropdownItems;

  if (!category || !items) return;

  const value = items[itemIndex];
  if (!confirm(`「${value}」を削除しますか？`)) return;

  const removedItem = items.splice(itemIndex, 1)[0];

  const success = await saveMasterOptionsFieldData(category.key, items);
  if (success) {
    await renderMasterOptionsDropdownUI();
  } else {
    items.splice(itemIndex, 0, removedItem);
    alert('削除に失敗しました');
  }
};

/**
 * masterOptionsに新規カテゴリを追加
 */
window.addMasterOptionsCategory = async function() {
  const input = document.getElementById('newMasterOptionsCategoryName');
  const categoryName = input?.value?.trim();

  if (!categoryName) {
    alert('カテゴリ名を入力してください');
    return;
  }

  // 既存カテゴリとの重複チェック
  const existingCategories = window._currentMasterOptionsCategories || [];
  if (existingCategories.some(cat => cat.key === categoryName || cat.label === categoryName)) {
    alert('このカテゴリ名は既に存在します');
    return;
  }

  try {
    // フィールド名をURLセーフに変換
    const safeFieldName = categoryName
      .replace(/\//g, '_')
      .replace(/\(/g, '_')
      .replace(/\)/g, '_')
      .replace(/\s/g, '_');

    // 1. masterOptionsに新しいドキュメントを作成
    await window.db.collection('masterOptions').doc(safeFieldName).set({
      items: [],
      fieldName: categoryName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      count: 0
    });

    // 2. _indexドキュメントを更新（fieldNamesに追加）
    const indexDoc = await window.db.collection('masterOptions').doc('_index').get();
    let fieldNames = [];
    if (indexDoc.exists) {
      fieldNames = indexDoc.data().fieldNames || [];
    }
    if (!fieldNames.includes(categoryName)) {
      fieldNames.push(categoryName);
      await window.db.collection('masterOptions').doc('_index').set({
        fieldNames: fieldNames,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // 3. 設定のカテゴリ配列に追加（動的に）
    const newCategory = {
      key: categoryName,
      label: categoryName,
      icon: 'bi-tag'
    };
    currentMasterConfig.masterOptionsCategories.push(newCategory);

    // 4. 新しいカテゴリを選択状態にして再描画
    currentDropdownCategoryIndex = currentMasterConfig.masterOptionsCategories.length - 1;

    input.value = '';
    await renderMasterOptionsDropdownUI();

    console.log(`✅ [Master Options] 新規カテゴリ追加: ${categoryName}`);
  } catch (error) {
    console.error('カテゴリ追加エラー:', error);
    alert('カテゴリの追加に失敗しました: ' + error.message);
  }
};

// ============================================
// simpleList タイプ（付属品・セールスワード用）
// ============================================

/**
 * シンプルリストUIをレンダリング
 * Firestoreコレクションを読み取り、素材タブと同じUIで表示
 */
async function renderSimpleListUI() {
  const container = document.getElementById('masterListContainer');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

  const collection = currentMasterConfig.collection;
  const displayField = currentMasterConfig.displayField || 'name';
  const displayFormat = currentMasterConfig.displayFormat; // カスタム表示形式（例: '{code}: {name}'）
  const orderField = currentMasterConfig.orderField;
  const label = currentMasterConfig.label;
  const icon = currentMasterConfig.icon || 'bi-list';
  const placeholder = currentMasterConfig.placeholder || '新しい項目を入力';

  // displayFormat適用のヘルパー関数
  const formatDisplay = (item) => {
    if (displayFormat) {
      return displayFormat.replace(/\{(\w+)\}/g, (match, field) => item[field] || '');
    }
    return item[displayField] || '';
  };

  try {
    // Firestoreからデータ取得（orderByはオプショナル）
    let snapshot;
    try {
      let query = window.db.collection(collection);
      // プラットフォームサポートがある場合はフィルタリング
      if (currentMasterConfig.platformSupport && currentPlatform) {
        // プラットフォームグループを取得（同じグループ内でデータを共有）
        const platformsToQuery = getPlatformGroupMembers(currentPlatform);
        if (platformsToQuery.length > 1) {
          query = query.where('platform', 'in', platformsToQuery);
        } else {
          query = query.where('platform', '==', currentPlatform);
        }
      }
      if (orderField) {
        query = query.orderBy(orderField, 'asc');
      }
      snapshot = await query.get();
    } catch (orderError) {
      console.warn('orderByエラー、ソートなしで取得:', orderError.message);
      let fallbackQuery = window.db.collection(collection);
      if (currentMasterConfig.platformSupport && currentPlatform) {
        const platformsToQuery = getPlatformGroupMembers(currentPlatform);
        if (platformsToQuery.length > 1) {
          fallbackQuery = fallbackQuery.where('platform', 'in', platformsToQuery);
        } else {
          fallbackQuery = fallbackQuery.where('platform', '==', currentPlatform);
        }
      }
      snapshot = await fallbackQuery.get();
    }
    const items = [];
    snapshot.forEach(doc => {
      items.push({ id: doc.id, ...doc.data() });
    });

    // クライアント側でソート
    items.sort((a, b) => {
      const aVal = a[orderField] || a[displayField] || '';
      const bVal = b[orderField] || b[displayField] || '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return aVal - bVal;
      }
      return String(aVal).localeCompare(String(bVal), 'ja');
    });

    // 現在のデータを保持
    window._currentSimpleListItems = items;

    // UIを生成
    container.innerHTML = `
      <div class="master-options-container">
        <div class="master-options-section">
          <div class="master-options-header">
            <h6><i class="bi ${icon}"></i> ${label}</h6>
            <span class="badge bg-secondary" id="simpleListItemCount">${items.length}件</span>
          </div>
          <div class="master-options-list" id="simpleListItems">
            ${items.length === 0 ? `
              <div class="master-options-empty">
                <p>まだ項目がありません</p>
              </div>
            ` : items.map((item, index) => `
              <div class="master-options-item" data-id="${item.id}" data-index="${index}" data-text="${escapeHtml((formatDisplay(item) || '').toLowerCase())}">
                <span class="item-text">${escapeHtml(formatDisplay(item))}</span>
                <div class="item-actions">
                  <button class="btn-icon btn-edit" onclick="editSimpleListItem('${item.id}', ${index})" title="編集">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn-icon btn-delete" onclick="deleteSimpleListItem('${item.id}', ${index})" title="削除">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="master-options-add">
            <input type="text" class="form-control form-control-sm" id="newSimpleListItem" placeholder="${placeholder}">
            <button class="btn btn-sm btn-primary" onclick="addSimpleListItem()">
              <i class="bi bi-plus"></i> 追加
            </button>
          </div>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('simpleList読み込みエラー:', error);
    container.innerHTML = `<div class="text-center text-danger py-4">読み込みエラー: ${error.message}</div>`;
  }
}

/**
 * simpleListのフィルター処理
 */
window.filterSimpleList = function(query) {
  const normalizedQuery = query.toLowerCase().trim();
  const items = document.querySelectorAll('#simpleListItems .master-options-item');
  let visible = 0;

  items.forEach(item => {
    const text = item.dataset.text || '';
    if (!normalizedQuery || text.includes(normalizedQuery)) {
      item.classList.remove('hidden');
      visible++;
    } else {
      item.classList.add('hidden');
    }
  });

  // セクション内カウント更新
  const countBadge = document.getElementById('simpleListItemCount');
  if (countBadge) countBadge.textContent = `${visible}件`;

  // グローバル検索カウント更新
  updateSearchResultCount(visible, normalizedQuery);
}

/**
 * シンプルリストに項目追加
 */
window.addSimpleListItem = async function() {
  const input = document.getElementById('newSimpleListItem');
  const value = input?.value?.trim();

  if (!value) {
    alert('値を入力してください');
    return;
  }

  const collection = currentMasterConfig.collection;
  const displayField = currentMasterConfig.displayField || 'name';
  const orderField = currentMasterConfig.orderField;
  const items = window._currentSimpleListItems || [];

  // 重複チェック
  if (items.some(item => item[displayField] === value)) {
    alert('この値は既に登録されています');
    return;
  }

  try {
    // 新規ドキュメント作成
    const newData = {
      [displayField]: value,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // プラットフォームサポートがある場合はplatformフィールドを追加
    if (currentMasterConfig.platformSupport && currentPlatform) {
      newData.platform = currentPlatform;
    }

    // 表示順がある場合は最大値+1を設定
    if (orderField) {
      const maxOrder = items.reduce((max, item) => Math.max(max, item[orderField] || 0), 0);
      newData[orderField] = maxOrder + 1;
    }

    await window.db.collection(collection).add(newData);
    input.value = '';
    await renderSimpleListUI();
  } catch (error) {
    console.error('追加エラー:', error);
    alert('追加に失敗しました: ' + error.message);
  }
};

/**
 * シンプルリストの項目編集
 */
window.editSimpleListItem = async function(docId, index) {
  const items = window._currentSimpleListItems || [];
  const item = items[index];
  if (!item) return;

  const displayField = currentMasterConfig.displayField || 'name';
  const oldValue = item[displayField];

  const newValue = prompt('新しい値を入力:', oldValue);
  if (!newValue || newValue.trim() === oldValue) return;

  // 重複チェック
  if (items.some((it, i) => i !== index && it[displayField] === newValue.trim())) {
    alert('この値は既に登録されています');
    return;
  }

  try {
    await window.db.collection(currentMasterConfig.collection).doc(docId).update({
      [displayField]: newValue.trim(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await renderSimpleListUI();
  } catch (error) {
    console.error('編集エラー:', error);
    alert('編集に失敗しました: ' + error.message);
  }
};

/**
 * シンプルリストの項目削除
 */
window.deleteSimpleListItem = async function(docId, index) {
  const items = window._currentSimpleListItems || [];
  const item = items[index];
  if (!item) return;

  const displayField = currentMasterConfig.displayField || 'name';
  const value = item[displayField];

  if (!confirm(`「${value}」を削除しますか？`)) return;

  try {
    await window.db.collection(currentMasterConfig.collection).doc(docId).delete();
    await renderSimpleListUI();
  } catch (error) {
    console.error('削除エラー:', error);
    alert('削除に失敗しました: ' + error.message);
  }
};

// ============================================
// categoryWords タイプ（セールスワード用）
// カテゴリ → 値配列 の構造を持つコレクション
// ============================================

/**
 * カテゴリ別ワードUIをレンダリング
 * 素材タブと同じレイアウトで、各カテゴリをセクションとして表示
 */
async function renderCategoryWordsUI() {
  const container = document.getElementById('masterListContainer');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

  const collection = currentMasterConfig.collection;
  const wordsField = currentMasterConfig.wordsField || 'words';
  const orderField = currentMasterConfig.orderField || 'order';
  const icon = currentMasterConfig.icon || 'bi-list';
  const placeholder = currentMasterConfig.placeholder || '新しい項目を入力';

  try {
    // Firestoreからデータ取得（order順）
    const snapshot = await window.db.collection(collection).orderBy(orderField, 'asc').get();

    const categories = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      categories.push({
        id: doc.id,
        name: doc.id,
        words: data[wordsField] || [],
        order: data[orderField] || 0
      });
    });

    // 現在のデータを保持
    window._currentCategoryWordsData = categories;

    // 総ワード数を計算
    const totalWords = categories.reduce((sum, cat) => sum + cat.words.length, 0);

    const label = currentMasterConfig.label || 'ワード';

    // UIを生成（素材タブと同じレイアウト）
    container.innerHTML = `
      <div class="master-options-container">
        ${categories.length === 0 ? `
          <div class="master-options-empty" style="padding: 40px; text-align: center;">
            <p>カテゴリがありません</p>
          </div>
        ` : categories.map((cat, catIndex) => `
          <div class="master-options-section" data-category-id="${cat.id}" data-cat-index="${catIndex}">
            <div class="master-options-header">
              <h6><i class="bi ${icon}"></i> ${escapeHtml(cat.name)}</h6>
              <span class="badge bg-secondary" id="categoryWordsCount_${catIndex}">${cat.words.length}件</span>
            </div>
            <div class="master-options-list" id="categoryWordsList_${catIndex}">
              ${cat.words.length === 0 ? `
                <div class="master-options-empty">
                  <p>このカテゴリにはまだ項目がありません</p>
                </div>
              ` : cat.words.map((word, wordIndex) => `
                <div class="master-options-item" data-category-index="${catIndex}" data-word-index="${wordIndex}" data-text="${escapeHtml(word.toLowerCase())}">
                  <span class="item-text">${escapeHtml(word)}</span>
                  <div class="item-actions">
                    <button class="btn-icon btn-edit" onclick="editCategoryWord(${catIndex}, ${wordIndex})" title="編集">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteCategoryWord(${catIndex}, ${wordIndex})" title="削除">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
            <div class="master-options-add">
              <input type="text" class="form-control form-control-sm" id="newCategoryWord_${catIndex}" placeholder="${placeholder}">
              <button class="btn btn-sm btn-primary" onclick="addCategoryWord(${catIndex})">
                <i class="bi bi-plus"></i> 追加
              </button>
            </div>
          </div>
        `).join('')}

        <!-- 新規カテゴリ追加 -->
        <div class="master-options-section" style="background: #f8f9fa;">
          <div class="master-options-add" style="border-top: none;">
            <input type="text" class="form-control form-control-sm" id="newCategoryName" placeholder="新しいカテゴリ名">
            <button class="btn btn-sm btn-outline-primary" onclick="addNewCategory()">
              <i class="bi bi-folder-plus"></i> カテゴリ追加
            </button>
          </div>
        </div>
      </div>
    `;

    console.log(`categoryWords読み込み完了: ${categories.length}カテゴリ, ${totalWords}ワード`);
  } catch (error) {
    console.error('categoryWords読み込みエラー:', error);
    container.innerHTML = `<div class="text-center text-danger py-4">読み込みエラー: ${error.message}</div>`;
  }
}

/**
 * categoryWordsのフィルター処理
 */
window.filterCategoryWords = function(query) {
  const normalizedQuery = query.toLowerCase().trim();
  const sections = document.querySelectorAll('.master-options-section[data-cat-index]');
  let totalVisible = 0;

  sections.forEach(section => {
    const catIndex = section.dataset.catIndex;
    const items = section.querySelectorAll('.master-options-item');
    let visibleInSection = 0;

    items.forEach(item => {
      const text = item.dataset.text || '';
      if (!normalizedQuery || text.includes(normalizedQuery)) {
        item.classList.remove('hidden');
        visibleInSection++;
      } else {
        item.classList.add('hidden');
      }
    });

    // セクション内のカウント更新
    const badge = document.getElementById(`categoryWordsCount_${catIndex}`);
    if (badge) badge.textContent = `${visibleInSection}件`;

    totalVisible += visibleInSection;
  });

  // グローバル検索カウント更新
  updateSearchResultCount(totalVisible, normalizedQuery);
}

/**
 * カテゴリにワードを追加
 */
window.addCategoryWord = async function(catIndex) {
  const input = document.getElementById(`newCategoryWord_${catIndex}`);
  const value = input?.value?.trim();

  if (!value) {
    alert('値を入力してください');
    return;
  }

  const categories = window._currentCategoryWordsData || [];
  const category = categories[catIndex];
  if (!category) return;

  // 重複チェック
  if (category.words.includes(value)) {
    alert('この値は既に登録されています');
    return;
  }

  try {
    const wordsField = currentMasterConfig.wordsField || 'words';
    const newWords = [...category.words, value];

    await window.db.collection(currentMasterConfig.collection).doc(category.id).update({
      [wordsField]: newWords,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    input.value = '';
    await renderCategoryWordsUI();
  } catch (error) {
    console.error('追加エラー:', error);
    alert('追加に失敗しました: ' + error.message);
  }
};

/**
 * カテゴリ内のワードを編集
 */
window.editCategoryWord = async function(catIndex, wordIndex) {
  const categories = window._currentCategoryWordsData || [];
  const category = categories[catIndex];
  if (!category) return;

  const oldValue = category.words[wordIndex];
  const newValue = prompt('新しい値を入力:', oldValue);
  if (!newValue || newValue.trim() === oldValue) return;

  // 重複チェック
  if (category.words.some((w, i) => i !== wordIndex && w === newValue.trim())) {
    alert('この値は既に登録されています');
    return;
  }

  try {
    const wordsField = currentMasterConfig.wordsField || 'words';
    const newWords = [...category.words];
    newWords[wordIndex] = newValue.trim();

    await window.db.collection(currentMasterConfig.collection).doc(category.id).update({
      [wordsField]: newWords,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await renderCategoryWordsUI();
  } catch (error) {
    console.error('編集エラー:', error);
    alert('編集に失敗しました: ' + error.message);
  }
};

/**
 * カテゴリ内のワードを削除
 */
window.deleteCategoryWord = async function(catIndex, wordIndex) {
  const categories = window._currentCategoryWordsData || [];
  const category = categories[catIndex];
  if (!category) return;

  const value = category.words[wordIndex];
  if (!confirm(`「${value}」を削除しますか？`)) return;

  try {
    const wordsField = currentMasterConfig.wordsField || 'words';
    const newWords = category.words.filter((_, i) => i !== wordIndex);

    await window.db.collection(currentMasterConfig.collection).doc(category.id).update({
      [wordsField]: newWords,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await renderCategoryWordsUI();
  } catch (error) {
    console.error('削除エラー:', error);
    alert('削除に失敗しました: ' + error.message);
  }
};

/**
 * 新規カテゴリを追加
 */
window.addNewCategory = async function() {
  const input = document.getElementById('newCategoryName');
  const categoryName = input?.value?.trim();

  if (!categoryName) {
    alert('カテゴリ名を入力してください');
    return;
  }

  const categories = window._currentCategoryWordsData || [];

  // 重複チェック
  if (categories.some(cat => cat.id === categoryName)) {
    alert('このカテゴリ名は既に存在します');
    return;
  }

  try {
    const wordsField = currentMasterConfig.wordsField || 'words';
    const orderField = currentMasterConfig.orderField || 'order';
    const maxOrder = categories.reduce((max, cat) => Math.max(max, cat.order || 0), 0);

    await window.db.collection(currentMasterConfig.collection).doc(categoryName).set({
      [wordsField]: [],
      [orderField]: maxOrder + 1,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    input.value = '';
    await renderCategoryWordsUI();
  } catch (error) {
    console.error('カテゴリ追加エラー:', error);
    alert('カテゴリの追加に失敗しました: ' + error.message);
  }
};

// ============================================
// categoryWordsDropdown タイプ（セールスワード用ドロップダウン形式）
// カテゴリ → 値配列 の構造を持つコレクションをドロップダウンで選択
// ============================================

// 現在選択中のカテゴリインデックス（categoryWordsDropdown用）
let currentCWDropdownCategoryIndex = 0;

/**
 * カテゴリ別ワード ドロップダウンUIをレンダリング
 * 商品属性と同様のUIでカテゴリを選択して表示
 */
async function renderCategoryWordsDropdownUI() {
  const container = document.getElementById('masterListContainer');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

  const collection = currentMasterConfig.collection;
  const wordsField = currentMasterConfig.wordsField || 'words';
  const orderField = currentMasterConfig.orderField || 'order';
  const icon = currentMasterConfig.icon || 'bi-list';
  const placeholder = currentMasterConfig.placeholder || '新しい項目を入力';
  const label = currentMasterConfig.label || 'ワード';

  try {
    // Firestoreからデータ取得（order順）
    const snapshot = await window.db.collection(collection).orderBy(orderField, 'asc').get();

    const categories = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      categories.push({
        id: doc.id,
        name: doc.id,
        words: data[wordsField] || [],
        order: data[orderField] || 0
      });
    });

    // 現在のデータを保持
    window._currentCWDropdownCategories = categories;

    if (categories.length === 0) {
      container.innerHTML = `
        <div class="master-options-container">
          <div class="master-options-empty" style="padding: 40px; text-align: center;">
            <p>カテゴリがありません</p>
            <div class="master-options-add" style="border-top: none; margin-top: 16px;">
              <input type="text" class="form-control form-control-sm" id="newCWDropdownCategoryName" placeholder="新しいカテゴリ名">
              <button class="btn btn-sm btn-outline-primary" onclick="addCWDropdownCategory()">
                <i class="bi bi-folder-plus"></i> カテゴリ追加
              </button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // インデックスが範囲外の場合は0に戻す
    if (currentCWDropdownCategoryIndex >= categories.length) {
      currentCWDropdownCategoryIndex = 0;
    }

    // 選択中のカテゴリのデータを取得
    const selectedCategory = categories[currentCWDropdownCategoryIndex];
    const items = selectedCategory.words;

    // UIを生成
    container.innerHTML = `
      <div class="master-options-container">
        <!-- カテゴリ選択ドロップダウン -->
        <div class="master-options-dropdown-selector">
          <label for="cwDropdownCategorySelect">カテゴリ選択</label>
          <select id="cwDropdownCategorySelect" class="form-select" onchange="changeCWDropdownCategory(this.value)">
            ${categories.map((cat, index) => `
              <option value="${index}" ${index === currentCWDropdownCategoryIndex ? 'selected' : ''}>
                ${escapeHtml(cat.name)}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- 選択されたカテゴリの内容 -->
        <div class="master-options-section" data-category-id="${selectedCategory.id}">
          <div class="master-options-header">
            <h6><i class="bi ${icon}"></i> ${escapeHtml(selectedCategory.name)}</h6>
            <span class="badge bg-secondary" id="cwDropdownItemCount">${items.length}件</span>
          </div>
          <div class="master-options-list" id="cwDropdownList">
            ${items.length === 0 ? `
              <div class="master-options-empty">
                <p>このカテゴリにはまだ項目がありません</p>
              </div>
            ` : items.map((item, itemIndex) => `
              <div class="master-options-item" data-item-index="${itemIndex}" data-text="${escapeHtml(item.toLowerCase())}">
                <span class="item-text">${escapeHtml(item)}</span>
                <div class="item-actions">
                  <button class="btn-icon btn-edit" onclick="editCWDropdownItem(${itemIndex})" title="編集">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn-icon btn-delete" onclick="deleteCWDropdownItem(${itemIndex})" title="削除">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
          <div class="master-options-add">
            <input type="text" class="form-control form-control-sm" id="newCWDropdownItem" placeholder="${placeholder}">
            <button class="btn btn-sm btn-primary" onclick="addCWDropdownItem()">
              <i class="bi bi-plus"></i> 追加
            </button>
          </div>
        </div>

        <!-- 新規カテゴリ追加 -->
        <div class="master-options-section" style="background: #f8f9fa;">
          <div class="master-options-add" style="border-top: none;">
            <input type="text" class="form-control form-control-sm" id="newCWDropdownCategoryName" placeholder="新しいカテゴリ名">
            <button class="btn btn-sm btn-outline-primary" onclick="addCWDropdownCategory()">
              <i class="bi bi-folder-plus"></i> カテゴリ追加
            </button>
          </div>
        </div>
      </div>
    `;

    // 現在のカテゴリデータを保持
    window._currentCWDropdownCategory = selectedCategory;
    window._currentCWDropdownItems = items;

    console.log(`categoryWordsDropdown読み込み完了: ${categories.length}カテゴリ, 選択中: ${selectedCategory.name}(${items.length}件)`);
  } catch (error) {
    console.error('categoryWordsDropdown読み込みエラー:', error);
    container.innerHTML = `<div class="text-center text-danger py-4">読み込みエラー: ${error.message}</div>`;
  }
}

/**
 * categoryWordsDropdownのフィルター処理
 */
window.filterCWDropdownItems = function(query) {
  const normalizedQuery = query.toLowerCase().trim();
  const items = document.querySelectorAll('#cwDropdownList .master-options-item');
  let visible = 0;

  items.forEach(item => {
    const text = item.dataset.text || '';
    if (!normalizedQuery || text.includes(normalizedQuery)) {
      item.classList.remove('hidden');
      visible++;
    } else {
      item.classList.add('hidden');
    }
  });

  // セクション内カウント更新
  const itemCount = document.getElementById('cwDropdownItemCount');
  if (itemCount) itemCount.textContent = `${visible}件`;

  // グローバル検索カウント更新
  updateSearchResultCount(visible, normalizedQuery);
}

/**
 * カテゴリ変更（categoryWordsDropdown用）
 */
window.changeCWDropdownCategory = async function(index) {
  currentCWDropdownCategoryIndex = parseInt(index);
  await renderCategoryWordsDropdownUI();
};

/**
 * 項目追加（categoryWordsDropdown用）
 */
window.addCWDropdownItem = async function() {
  const input = document.getElementById('newCWDropdownItem');
  const value = input?.value?.trim();

  if (!value) {
    alert('値を入力してください');
    return;
  }

  const category = window._currentCWDropdownCategory;
  if (!category) return;

  // 重複チェック
  if (category.words.includes(value)) {
    alert('この値は既に登録されています');
    return;
  }

  try {
    const wordsField = currentMasterConfig.wordsField || 'words';
    const newWords = [...category.words, value];

    await window.db.collection(currentMasterConfig.collection).doc(category.id).update({
      [wordsField]: newWords,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    input.value = '';
    await renderCategoryWordsDropdownUI();
  } catch (error) {
    console.error('追加エラー:', error);
    alert('追加に失敗しました: ' + error.message);
  }
};

/**
 * 項目編集（categoryWordsDropdown用）
 */
window.editCWDropdownItem = async function(itemIndex) {
  const category = window._currentCWDropdownCategory;
  if (!category) return;

  const oldValue = category.words[itemIndex];
  const newValue = prompt('新しい値を入力:', oldValue);
  if (!newValue || newValue.trim() === oldValue) return;

  // 重複チェック
  if (category.words.some((w, i) => i !== itemIndex && w === newValue.trim())) {
    alert('この値は既に登録されています');
    return;
  }

  try {
    const wordsField = currentMasterConfig.wordsField || 'words';
    const newWords = [...category.words];
    newWords[itemIndex] = newValue.trim();

    await window.db.collection(currentMasterConfig.collection).doc(category.id).update({
      [wordsField]: newWords,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await renderCategoryWordsDropdownUI();
  } catch (error) {
    console.error('編集エラー:', error);
    alert('編集に失敗しました: ' + error.message);
  }
};

/**
 * 項目削除（categoryWordsDropdown用）
 */
window.deleteCWDropdownItem = async function(itemIndex) {
  const category = window._currentCWDropdownCategory;
  if (!category) return;

  const value = category.words[itemIndex];
  if (!confirm(`「${value}」を削除しますか？`)) return;

  try {
    const wordsField = currentMasterConfig.wordsField || 'words';
    const newWords = category.words.filter((_, i) => i !== itemIndex);

    await window.db.collection(currentMasterConfig.collection).doc(category.id).update({
      [wordsField]: newWords,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await renderCategoryWordsDropdownUI();
  } catch (error) {
    console.error('削除エラー:', error);
    alert('削除に失敗しました: ' + error.message);
  }
};

/**
 * 新規カテゴリを追加（categoryWordsDropdown用）
 */
window.addCWDropdownCategory = async function() {
  const input = document.getElementById('newCWDropdownCategoryName');
  const categoryName = input?.value?.trim();

  if (!categoryName) {
    alert('カテゴリ名を入力してください');
    return;
  }

  const categories = window._currentCWDropdownCategories || [];

  // 重複チェック
  if (categories.some(cat => cat.id === categoryName)) {
    alert('このカテゴリ名は既に存在します');
    return;
  }

  try {
    const wordsField = currentMasterConfig.wordsField || 'words';
    const orderField = currentMasterConfig.orderField || 'order';
    const maxOrder = categories.reduce((max, cat) => Math.max(max, cat.order || 0), 0);

    await window.db.collection(currentMasterConfig.collection).doc(categoryName).set({
      [wordsField]: [],
      [orderField]: maxOrder + 1,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    input.value = '';
    // 新しく追加したカテゴリを選択
    currentCWDropdownCategoryIndex = categories.length;
    await renderCategoryWordsDropdownUI();
  } catch (error) {
    console.error('カテゴリ追加エラー:', error);
    alert('カテゴリの追加に失敗しました: ' + error.message);
  }
};

// ==============================================================================
// shippingDropdownタイプ（発送方法管理）
// ==============================================================================

// 現在選択中のカテゴリインデックス
let currentShippingCategoryIndex = 0;

/**
 * 発送方法ドロップダウンUIをレンダリング
 */
async function renderShippingDropdownUI() {
  const container = document.getElementById('masterListContainer');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

  const collection = currentMasterConfig.collection;
  const icon = currentMasterConfig.icon || 'bi-truck';

  try {
    // Firestoreからデータ取得（プラットフォームサポートがある場合はフィルタリング）
    let query = window.db.collection(collection);
    if (currentMasterConfig.platformSupport && currentPlatform) {
      // プラットフォームグループを取得（同じグループ内でデータを共有）
      const platformsToQuery = getPlatformGroupMembers(currentPlatform);
      if (platformsToQuery.length > 1) {
        query = query.where('platform', 'in', platformsToQuery);
      } else {
        query = query.where('platform', '==', currentPlatform);
      }
    }
    const snapshot = await query.orderBy('order', 'asc').get();

    const categories = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      categories.push({
        id: doc.id,
        name: data.category || doc.id,  // categoryフィールドを優先表示
        items: data.items || [],
        order: data.order || 0,
        platform: data.platform || null
      });
    });

    // 現在のデータを保持
    window._currentShippingCategories = categories;

    if (categories.length === 0) {
      container.innerHTML = `
        <div class="master-options-container">
          <div class="master-options-empty" style="padding: 40px; text-align: center;">
            <p>発送カテゴリがありません</p>
            <div class="master-options-add" style="border-top: none; margin-top: 16px;">
              <input type="text" class="form-control form-control-sm" id="newShippingCategoryName" placeholder="新しいカテゴリ名">
              <button class="btn btn-sm btn-outline-primary" onclick="addShippingCategory()">
                <i class="bi bi-folder-plus"></i> カテゴリ追加
              </button>
            </div>
          </div>
        </div>
      `;
      return;
    }

    // インデックスが範囲外の場合は0に戻す
    if (currentShippingCategoryIndex >= categories.length) {
      currentShippingCategoryIndex = 0;
    }

    // 選択中のカテゴリのデータを取得
    const selectedCategory = categories[currentShippingCategoryIndex];
    const items = selectedCategory.items;

    // UIを生成
    container.innerHTML = `
      <div class="master-options-container">
        <!-- カテゴリ選択ドロップダウン -->
        <div class="master-options-dropdown-selector">
          <label for="shippingCategorySelect">発送カテゴリ選択</label>
          <select id="shippingCategorySelect" class="form-select" onchange="changeShippingCategory(this.value)">
            ${categories.map((cat, index) => `
              <option value="${index}" ${index === currentShippingCategoryIndex ? 'selected' : ''}>
                ${escapeHtml(cat.name)}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- 選択されたカテゴリの内容 -->
        <div class="master-options-section" data-category-id="${selectedCategory.id}">
          <div class="master-options-header">
            <h6><i class="bi ${icon}"></i> ${escapeHtml(selectedCategory.name)}</h6>
            <span class="badge bg-secondary" id="shippingItemCount">${items.length}件</span>
          </div>
          <div class="master-options-list" id="shippingItemList">
            ${items.length === 0 ? `
              <div class="master-options-empty">
                <p>このカテゴリにはまだ発送方法がありません</p>
              </div>
            ` : items.map((item, itemIndex) => `
              <div class="master-options-item" data-item-index="${itemIndex}" style="flex-direction:column;align-items:stretch;gap:4px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                  <span class="item-text">${escapeHtml(item.detail || '')}</span>
                  <div class="item-actions">
                    <button class="btn-icon btn-edit" onclick="editShippingItem(${itemIndex})" title="編集">
                      <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn-icon btn-delete" onclick="deleteShippingItem(${itemIndex})" title="削除">
                      <i class="bi bi-trash"></i>
                    </button>
                  </div>
                </div>
                <div style="color:#666;font-size:14px;">¥${Number(item.price || 0).toLocaleString()}</div>
              </div>
            `).join('')}
          </div>
          <div class="master-options-add">
            <input type="text" class="form-control form-control-sm" id="newShippingDetail" placeholder="${currentMasterConfig.placeholder || '例: ネコポス'}">
            <input type="number" class="form-control form-control-sm" id="newShippingPrice" placeholder="送料" style="width:80px;">
            <button class="btn btn-sm btn-primary" onclick="addShippingItem()">
              <i class="bi bi-plus"></i> 追加
            </button>
          </div>
        </div>

        <!-- 新規カテゴリ追加 -->
        <div class="master-options-section" style="background: #f8f9fa;">
          <div class="master-options-add" style="border-top: none;">
            <input type="text" class="form-control form-control-sm" id="newShippingCategoryName" placeholder="新しいカテゴリ名">
            <button class="btn btn-sm btn-outline-primary" onclick="addShippingCategory()">
              <i class="bi bi-folder-plus"></i> カテゴリ追加
            </button>
          </div>
        </div>
      </div>
    `;

    // 現在のカテゴリデータを保持
    window._currentShippingCategory = selectedCategory;
    window._currentShippingItems = items;

    console.log(`shippingDropdown読み込み完了: ${categories.length}カテゴリ, 選択中: ${selectedCategory.name}(${items.length}件)`);
  } catch (error) {
    console.error('shippingDropdown読み込みエラー:', error);
    container.innerHTML = `<div class="text-center text-danger py-4">読み込みエラー: ${error.message}</div>`;
  }
}

/**
 * 発送カテゴリを切り替え
 */
window.changeShippingCategory = function(index) {
  currentShippingCategoryIndex = parseInt(index, 10);
  renderShippingDropdownUI();
};

/**
 * 発送方法を追加
 */
window.addShippingItem = async function() {
  const detailInput = document.getElementById('newShippingDetail');
  const priceInput = document.getElementById('newShippingPrice');
  const detail = detailInput?.value?.trim();
  const price = parseInt(priceInput?.value, 10) || 0;

  if (!detail) {
    alert('発送方法名を入力してください');
    return;
  }

  const category = window._currentShippingCategory;
  if (!category) return;

  // 重複チェック
  if (category.items.some(item => item.detail === detail)) {
    alert('この発送方法は既に登録されています');
    return;
  }

  try {
    const newItems = [...category.items, { detail, price }];

    await window.db.collection(currentMasterConfig.collection).doc(category.id).update({
      items: newItems,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    detailInput.value = '';
    priceInput.value = '';
    await renderShippingDropdownUI();
  } catch (error) {
    console.error('追加エラー:', error);
    alert('追加に失敗しました: ' + error.message);
  }
};

/**
 * 発送方法を編集（モーダル表示）
 */
window.editShippingItem = function(itemIndex) {
  const category = window._currentShippingCategory;
  if (!category) return;

  const item = category.items[itemIndex];

  // モーダル内容を設定
  document.getElementById('editItemModalTitle').textContent = '発送方法を編集';
  document.getElementById('editItemModalBody').innerHTML = `
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:4px;font-weight:500;">発送方法名</label>
      <input type="text" class="form-control" id="editItemName" value="${escapeHtml(item.detail || '')}" style="font-size:16px;">
    </div>
    <div class="form-group">
      <label style="display:block;margin-bottom:4px;font-weight:500;">送料（円）</label>
      <input type="number" class="form-control" id="editItemPrice" value="${item.price || 0}" style="font-size:16px;">
    </div>
  `;

  // 編集対象情報を保存
  window._editItemContext = { type: 'shipping', itemIndex };

  // モーダル表示（フォーカスなしで開く）
  document.getElementById('editItemModal').classList.remove('hidden');
};

/**
 * 発送方法の編集を保存（モーダルから）
 */
async function saveShippingFromModal(itemIndex) {
  const category = window._currentShippingCategory;
  if (!category) return;

  const detailInput = document.getElementById('editItemName');
  const priceInput = document.getElementById('editItemPrice');

  const newDetail = detailInput.value.trim();
  if (!newDetail) {
    alert('発送方法名を入力してください');
    detailInput.focus();
    return;
  }

  try {
    const newItems = [...category.items];
    newItems[itemIndex] = {
      detail: newDetail,
      price: parseInt(priceInput.value, 10) || 0
    };

    await window.db.collection(currentMasterConfig.collection).doc(category.id).update({
      items: newItems,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    hideEditItemModal();
    await renderShippingDropdownUI();
    showToast('更新しました');
  } catch (error) {
    console.error('編集エラー:', error);
    alert('編集に失敗しました: ' + error.message);
  }
}

/**
 * 発送方法を削除
 */
window.deleteShippingItem = async function(itemIndex) {
  const category = window._currentShippingCategory;
  if (!category) return;

  const item = category.items[itemIndex];
  if (!confirm(`「${item.detail}」を削除しますか？`)) return;

  try {
    const newItems = category.items.filter((_, i) => i !== itemIndex);

    await window.db.collection(currentMasterConfig.collection).doc(category.id).update({
      items: newItems,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await renderShippingDropdownUI();
  } catch (error) {
    console.error('削除エラー:', error);
    alert('削除に失敗しました: ' + error.message);
  }
};

/**
 * 新規発送カテゴリを追加
 */
window.addShippingCategory = async function() {
  const input = document.getElementById('newShippingCategoryName');
  const categoryName = input?.value?.trim();

  if (!categoryName) {
    alert('カテゴリ名を入力してください');
    return;
  }

  const categories = window._currentShippingCategories || [];

  // 重複チェック
  if (categories.some(cat => cat.id === categoryName)) {
    alert('このカテゴリ名は既に存在します');
    return;
  }

  try {
    const maxOrder = categories.reduce((max, cat) => Math.max(max, cat.order || 0), 0);

    const newData = {
      items: [],
      order: maxOrder + 1,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // プラットフォームサポートがある場合はplatformフィールドを追加
    if (currentMasterConfig.platformSupport && currentPlatform) {
      newData.platform = currentPlatform;
    }

    await window.db.collection(currentMasterConfig.collection).doc(categoryName).set(newData);

    input.value = '';
    // 新しく追加したカテゴリを選択
    currentShippingCategoryIndex = categories.length;
    await renderShippingDropdownUI();
  } catch (error) {
    console.error('カテゴリ追加エラー:', error);
    alert('カテゴリの追加に失敗しました: ' + error.message);
  }
};

// ============================================
// 梱包資材ドロップダウンUI（packagingDropdown）
// ============================================

// 現在選択中の梱包資材カテゴリインデックス
let currentPackagingCategoryIndex = 0;

/**
 * 梱包資材ドロップダウンUIを描画
 * データ構造: 各ドキュメントが独立したアイテム、categoryフィールドでグループ化
 */
async function renderPackagingDropdownUI() {
  const container = document.getElementById('masterListContainer');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

  const collection = currentMasterConfig.collection;
  const icon = currentMasterConfig.icon || 'bi-box-seam';
  const definedCategories = currentMasterConfig.categories || [];

  try {
    // Firestoreから全データ取得（並列実行）
    const [itemsSnapshot, categoriesSnapshot] = await Promise.all([
      window.db.collection(collection).get(),
      window.db.collection('packagingCategories').orderBy('order', 'asc').get()
    ]);

    const allItems = [];
    itemsSnapshot.forEach(doc => {
      const data = doc.data();
      allItems.push({
        id: doc.id,
        name: data.name || '',
        category: data.category || 'その他',
        price: data.price || 0,
        quantity: data.quantity || 1,
        abbreviation: data.abbreviation || '',
        // Phase 1: 新規フィールド
        expenseCategory: data.expenseCategory || 'individual',  // デフォルト: 個別原価
        supplier: data.supplier || '',
        currentStock: data.currentStock ?? 0,  // 現在庫
        stockAlertThreshold: data.stockAlertThreshold ?? 10,  // デフォルト閾値: 10
        imageUrl: data.imageUrl || ''  // 商品画像URL
      });
    });

    // Firestoreからカテゴリを取得
    const firestoreCategories = [];
    categoriesSnapshot.forEach(doc => {
      const data = doc.data();
      firestoreCategories.push({
        id: doc.id,
        name: data.name || doc.id,
        icon: data.icon || 'bi-box-seam',
        order: data.order || 0
      });
    });

    // カテゴリごとにグループ化（Firestoreカテゴリ + 設定カテゴリをマージ）
    const categoryGroups = {};

    // 1. 設定ファイルのカテゴリを追加
    definedCategories.forEach(cat => {
      categoryGroups[cat.name] = {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        order: cat.order || 0,
        items: []
      };
    });

    // 2. Firestoreのカテゴリを追加（設定にないもの）
    firestoreCategories.forEach(cat => {
      if (!categoryGroups[cat.name]) {
        categoryGroups[cat.name] = {
          id: cat.id,
          name: cat.name,
          icon: cat.icon,
          order: cat.order || 100, // Firestoreカテゴリは後ろに
          items: []
        };
      }
    });

    // 3. その他カテゴリを追加（定義されていない場合）
    if (!categoryGroups['その他']) {
      categoryGroups['その他'] = {
        id: 'other',
        name: 'その他',
        icon: 'bi-three-dots',
        order: 999,
        items: []
      };
    }

    // アイテムをカテゴリに振り分け
    allItems.forEach(item => {
      const catName = item.category;
      if (categoryGroups[catName]) {
        categoryGroups[catName].items.push(item);
      } else {
        // 未知のカテゴリはその他に振り分け
        categoryGroups['その他'].items.push(item);
      }
    });

    // 配列に変換（order順でソート）
    const categories = Object.values(categoryGroups).sort((a, b) => (a.order || 0) - (b.order || 0));

    // 現在のデータを保持
    window._currentPackagingCategories = categories;
    window._currentPackagingAllItems = allItems;

    if (categories.length === 0) {
      container.innerHTML = `
        <div class="master-options-container">
          <div class="master-options-empty" style="padding: 40px; text-align: center;">
            <p>カテゴリ設定がありません</p>
          </div>
        </div>
      `;
      return;
    }

    // インデックスが範囲外の場合は0に戻す
    if (currentPackagingCategoryIndex >= categories.length) {
      currentPackagingCategoryIndex = 0;
    }

    // 選択中のカテゴリのデータを取得
    const selectedCategory = categories[currentPackagingCategoryIndex];
    const items = selectedCategory.items;

    // 単価を計算するヘルパー関数
    const calcUnitPrice = (price, quantity) => {
      if (!quantity || quantity === 0) return 0;
      return Math.round(price / quantity * 100) / 100;
    };

    // UIを生成
    container.innerHTML = `
      <div class="master-options-container">
        <!-- カテゴリ選択ドロップダウン -->
        <div class="master-options-dropdown-selector">
          <label for="packagingCategorySelect">カテゴリ選択</label>
          <select id="packagingCategorySelect" class="form-select" onchange="changePackagingCategory(this.value)">
            ${categories.map((cat, index) => `
              <option value="${index}" ${index === currentPackagingCategoryIndex ? 'selected' : ''}>
                ${escapeHtml(cat.name)}
              </option>
            `).join('')}
          </select>
        </div>

        <!-- 選択されたカテゴリの内容 -->
        <div class="master-options-section" data-category-name="${escapeHtml(selectedCategory.name)}">
          <div class="master-options-header">
            <h6><i class="bi ${selectedCategory.icon || icon}"></i> ${escapeHtml(selectedCategory.name)}</h6>
            <span class="badge bg-secondary" id="packagingItemCount">${items.length}件</span>
          </div>
          <div class="master-options-list" id="packagingItemList">
            ${items.length === 0 ? `
              <div class="master-options-empty">
                <p>このカテゴリにはまだ資材がありません</p>
              </div>
            ` : items.map((item, itemIndex) => {
              const expenseCategoryLabel = item.expenseCategory === 'monthly' ? '月次' : '個別';
              const expenseCategoryColor = item.expenseCategory === 'monthly' ? '#6c757d' : '#0d6efd';
              // 画像サムネイル（28x28px、角丸、画像がない場合はアイコン表示）
              const thumbnail = item.imageUrl
                ? `<img src="${escapeHtml(item.imageUrl)}" alt="" style="width:28px;height:28px;object-fit:cover;border-radius:4px;border:1px solid #e9ecef;flex-shrink:0;">`
                : `<div style="width:28px;height:28px;background:#f0f0f0;border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi bi-box-seam" style="font-size:14px;color:#aaa;"></i></div>`;

              return `
              <div class="master-options-item" data-item-id="${item.id}">
                <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:0;margin-right:12px;">
                  ${thumbnail}
                  <span class="item-text" style="font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(item.name)}</span>
                  <span style="font-size:11px;padding:2px 6px;border-radius:4px;background:${expenseCategoryColor};color:#fff;flex-shrink:0;">${expenseCategoryLabel}</span>
                </div>
                <div class="item-actions" style="flex-shrink:0;">
                  <button class="btn-icon btn-edit" onclick="editPackagingItem('${item.id}')" title="編集">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn-icon btn-delete" onclick="deletePackagingItem('${item.id}')" title="削除">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            `;}).join('')}
          </div>
          <div class="master-options-add" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <label style="margin:0;cursor:pointer;flex-shrink:0;" title="画像を選択">
              <div id="newPackagingImagePreview" style="width:36px;height:36px;background:#f5f5f5;border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;border:1px dashed #ccc;">
                <i class="bi bi-image" style="font-size:16px;color:#aaa;"></i>
              </div>
              <input type="file" id="newPackagingImageFile" accept="image/*" style="display:none;" onchange="previewNewPackagingImage(this)">
            </label>
            <input type="text" class="form-control form-control-sm" id="newPackagingName" placeholder="${currentMasterConfig.placeholder || '例: A4封筒'}" style="flex:1;min-width:120px;font-size:16px;">
            <select class="form-select form-select-sm" id="newPackagingExpenseCategory" style="width:70px;font-size:14px;padding-right:24px;">
              <option value="individual">個別</option>
              <option value="monthly">月次</option>
            </select>
            <button class="btn btn-sm btn-primary" onclick="addPackagingItem()" style="flex-shrink:0;">
              <i class="bi bi-plus"></i> 追加
            </button>
          </div>
        </div>

        <!-- 新規カテゴリ追加 -->
        <div class="master-options-section" style="background: #f8f9fa;">
          <div class="master-options-add" style="border-top: none;">
            <input type="text" class="form-control form-control-sm" id="newPackagingCategoryName" placeholder="新しいカテゴリ名" style="font-size:16px;">
            <button class="btn btn-sm btn-outline-primary" onclick="addPackagingCategory()">
              <i class="bi bi-folder-plus"></i> カテゴリ追加
            </button>
          </div>
        </div>
      </div>
    `;

    // 現在のカテゴリデータを保持
    window._currentPackagingCategory = selectedCategory;
    window._currentPackagingItems = items;

    console.log(`packagingDropdown読み込み完了: ${categories.length}カテゴリ, 選択中: ${selectedCategory.name}(${items.length}件)`);
  } catch (error) {
    console.error('packagingDropdown読み込みエラー:', error);
    container.innerHTML = `<div class="text-center text-danger py-4">読み込みエラー: ${error.message}</div>`;
  }
}

/**
 * 梱包資材カテゴリを切り替え
 */
window.changePackagingCategory = function(index) {
  currentPackagingCategoryIndex = parseInt(index, 10);
  renderPackagingDropdownUI();
};

/**
 * 新規カテゴリを追加（梱包資材用）
 */
window.addPackagingCategory = async function() {
  const input = document.getElementById('newPackagingCategoryName');
  const categoryName = input?.value?.trim();

  if (!categoryName) {
    alert('カテゴリ名を入力してください');
    return;
  }

  const categories = window._currentPackagingCategories || [];

  // 重複チェック
  if (categories.some(cat => cat.name === categoryName)) {
    alert('このカテゴリ名は既に存在します');
    return;
  }

  try {
    // packagingCategoriesコレクションに新しいカテゴリを追加
    const maxOrder = categories.reduce((max, cat) => Math.max(max, cat.order || 0), 0);

    await window.db.collection('packagingCategories').doc(categoryName).set({
      name: categoryName,
      icon: 'bi-box-seam',
      order: maxOrder + 1,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    input.value = '';
    // 新しく追加したカテゴリを選択
    currentPackagingCategoryIndex = categories.length;
    await renderPackagingDropdownUI();

    console.log(`✅ [Packaging] 新規カテゴリ追加: ${categoryName}`);
  } catch (error) {
    console.error('カテゴリ追加エラー:', error);
    alert('カテゴリの追加に失敗しました: ' + error.message);
  }
};

/**
 * 梱包資材を追加
 */
window.addPackagingItem = async function() {
  const nameInput = document.getElementById('newPackagingName');
  const expenseCategorySelect = document.getElementById('newPackagingExpenseCategory');
  const imageInput = document.getElementById('newPackagingImageFile');

  const name = nameInput?.value?.trim();
  const expenseCategory = expenseCategorySelect?.value || 'individual';

  if (!name) {
    alert('資材名を入力してください');
    return;
  }

  const category = window._currentPackagingCategory;
  if (!category) return;

  // 重複チェック
  if (category.items.some(item => item.name === name)) {
    alert('この資材名は既に登録されています');
    return;
  }

  try {
    const newData = {
      name,
      category: category.name,
      expenseCategory,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // まずFirestoreにドキュメントを追加
    const docRef = await window.db.collection(currentMasterConfig.collection).add(newData);

    // 画像が選択されていればアップロード
    if (imageInput?.files?.length > 0) {
      try {
        const imageUrl = await uploadPackagingImage(imageInput.files[0], docRef.id);
        await docRef.update({ imageUrl });
        console.log(`✅ [Packaging] 新規追加: 画像アップロード完了`);
      } catch (imgError) {
        console.error('画像アップロードエラー:', imgError);
        // 画像アップロード失敗しても資材自体は追加済み
      }
    }

    // フォームをリセット
    nameInput.value = '';
    if (expenseCategorySelect) expenseCategorySelect.value = 'individual';
    if (imageInput) imageInput.value = '';
    const preview = document.getElementById('newPackagingImagePreview');
    if (preview) {
      preview.innerHTML = `<i class="bi bi-image" style="font-size:16px;color:#aaa;"></i>`;
    }

    await renderPackagingDropdownUI();
    showToast('追加しました');
  } catch (error) {
    console.error('追加エラー:', error);
    alert('追加に失敗しました: ' + error.message);
  }
};

/**
 * 梱包資材を編集（モーダル表示）
 */
window.editPackagingItem = function(itemId) {
  const allItems = window._currentPackagingAllItems || [];
  const item = allItems.find(i => i.id === itemId);
  if (!item) return;

  // 現在の画像プレビュー
  const currentImageHtml = item.imageUrl
    ? `<img src="${escapeHtml(item.imageUrl)}" alt="現在の画像" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">`
    : `<div style="width:60px;height:60px;background:#f0f0f0;border-radius:6px;display:flex;align-items:center;justify-content:center;"><i class="bi bi-image" style="font-size:24px;color:#aaa;"></i></div>`;

  // モーダル内容を設定
  document.getElementById('editItemModalTitle').textContent = '梱包資材を編集';
  document.getElementById('editItemModalBody').innerHTML = `
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:4px;font-weight:500;">資材名</label>
      <input type="text" class="form-control" id="editItemName" value="${escapeHtml(item.name)}" style="font-size:16px;">
    </div>
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:4px;font-weight:500;">経費区分</label>
      <select class="form-select" id="editItemExpenseCategory" style="font-size:16px;">
        <option value="individual" ${item.expenseCategory !== 'monthly' ? 'selected' : ''}>個別原価</option>
        <option value="monthly" ${item.expenseCategory === 'monthly' ? 'selected' : ''}>月次経費</option>
      </select>
    </div>
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:8px;font-weight:500;">商品画像</label>
      <div style="display:flex;align-items:center;gap:12px;">
        <div id="editItemImagePreview">${currentImageHtml}</div>
        <div style="flex:1;">
          <input type="file" class="form-control" id="editItemImageFile" accept="image/*" style="font-size:14px;" onchange="previewPackagingImage(this)">
          <small class="text-muted">推奨: 正方形、200x200px以上</small>
        </div>
      </div>
      <input type="hidden" id="editItemCurrentImageUrl" value="${escapeHtml(item.imageUrl || '')}">
    </div>
  `;

  // 編集対象情報を保存
  window._editItemContext = { type: 'packaging', itemId };

  // モーダル表示（フォーカスなしで開く）
  document.getElementById('editItemModal').classList.remove('hidden');
};

/**
 * 編集モーダルを非表示
 */
window.hideEditItemModal = function() {
  document.getElementById('editItemModal').classList.add('hidden');
  window._editItemContext = null;
};

/**
 * 梱包資材画像のプレビュー表示
 */
window.previewPackagingImage = function(input) {
  const preview = document.getElementById('editItemImagePreview');
  if (!preview) return;

  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" alt="プレビュー" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #ddd;">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
};

/**
 * 新規追加用の梱包資材画像プレビュー
 */
window.previewNewPackagingImage = function(input) {
  const preview = document.getElementById('newPackagingImagePreview');
  if (input.files && input.files[0] && preview) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" alt="プレビュー" style="width:36px;height:36px;object-fit:cover;border-radius:6px;">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
};

/**
 * 梱包資材画像をFirebase Storageにアップロード
 * @returns {Promise<string>} - アップロードされた画像のURL
 */
async function uploadPackagingImage(file, itemId) {
  // 親ウィンドウのStorage関数を使用
  const storage = window.parent?.firebaseStorage || window.firebaseStorage;
  const storageRef = window.parent?.storageRef || window.storageRef;
  const uploadBytes = window.parent?.storageUploadBytes || window.storageUploadBytes;
  const getDownloadURL = window.parent?.storageGetDownloadURL || window.storageGetDownloadURL;

  if (!storage || !storageRef || !uploadBytes || !getDownloadURL) {
    throw new Error('Firebase Storageが利用できません');
  }

  // ファイルパス: packaging-materials/{itemId}/{timestamp}.{ext}
  const ext = file.name.split('.').pop().toLowerCase();
  const timestamp = Date.now();
  const path = `packaging-materials/${itemId}/${timestamp}.${ext}`;

  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);

  console.log(`✅ [Packaging] 画像アップロード完了: ${path}`);
  return url;
}

/**
 * 編集モーダルの保存処理
 */
window.submitEditItem = async function() {
  const context = window._editItemContext;
  if (!context) return;

  if (context.type === 'packaging') {
    await savePackagingFromModal(context.itemId);
  } else if (context.type === 'shipping') {
    await saveShippingFromModal(context.itemIndex);
  } else if (context.type === 'salesChannel') {
    await saveSalesChannelFromModal(context.itemId);
  }
};

/**
 * 梱包資材の編集を保存（モーダルから）
 */
async function savePackagingFromModal(itemId) {
  const nameInput = document.getElementById('editItemName');
  const expenseCategorySelect = document.getElementById('editItemExpenseCategory');
  const imageFileInput = document.getElementById('editItemImageFile');
  const currentImageUrl = document.getElementById('editItemCurrentImageUrl')?.value || '';

  const newName = nameInput.value.trim();
  if (!newName) {
    alert('資材名を入力してください');
    nameInput.focus();
    return;
  }

  try {
    // 更新データを準備
    const updateData = {
      name: newName,
      expenseCategory: expenseCategorySelect?.value || 'individual',
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 画像が選択されている場合はアップロード
    if (imageFileInput?.files?.[0]) {
      const file = imageFileInput.files[0];

      // ファイルサイズチェック（5MB以下）
      if (file.size > 5 * 1024 * 1024) {
        alert('画像サイズは5MB以下にしてください');
        return;
      }

      // 画像をアップロード
      showToast('画像をアップロード中...');
      const imageUrl = await uploadPackagingImage(file, itemId);
      updateData.imageUrl = imageUrl;
    }

    await window.db.collection(currentMasterConfig.collection).doc(itemId).update(updateData);

    hideEditItemModal();
    await renderPackagingDropdownUI();
    showToast('更新しました');
  } catch (error) {
    console.error('編集エラー:', error);
    alert('編集に失敗しました: ' + error.message);
  }
}


// ============================================
// 出品先ドロップダウンUI（salesChannelDropdown）
// ============================================

/**
 * 出品先ドロップダウンUIを描画
 * サムネイル画像表示・アップロード対応
 */
async function renderSalesChannelDropdownUI() {
  const container = document.getElementById('masterListContainer');
  if (!container) return;

  container.innerHTML = '<div class="text-center py-4"><div class="spinner-border text-primary"></div></div>';

  const collection = currentMasterConfig.collection;

  try {
    // Firestoreから全データ取得
    const snapshot = await window.db.collection(collection).orderBy('order', 'asc').get();

    const items = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      items.push({
        id: doc.id,
        platformId: data.platformId || doc.id,
        name: data.name || '',
        iconUrl: data.iconUrl || '',
        // 手数料関連フィールド
        feeType: data.feeType || 'simple',
        commission: data.commission || 0,
        commissionMin: data.commissionMin || 0,
        commissionMax: data.commissionMax || 0,
        commissionDefault: data.commissionDefault || 0,
        commissionFormula: data.commissionFormula || '',
        formulaDescription: data.formulaDescription || '',
        feeNote: data.feeNote || '',
        feeEstimate: data.feeEstimate || 0,
        url: data.url || '',
        order: data.order || 0,
        active: data.active !== false
      });
    });

    // 現在のデータを保持
    window._currentSalesChannels = items;

    // 手数料タイプの表示テキストを生成する関数
    const getFeeDisplayText = (item) => {
      switch (item.feeType) {
        case 'simple':
          return item.commission ? `${item.commission}%` : '';
        case 'variable':
          return item.commissionMin && item.commissionMax
            ? `${item.commissionMin}〜${item.commissionMax}%`
            : (item.commissionDefault ? `${item.commissionDefault}%` : '');
        case 'complex':
          return item.commissionFormula || '複合計算';
        case 'manual':
          return item.feeEstimate ? `約${item.feeEstimate}%` : '手動入力';
        default:
          return '';
      }
    };

    // 手数料タイプのバッジを生成
    const getFeeTypeBadge = (feeType) => {
      const types = {
        simple: { label: '固定', color: '#28a745' },
        variable: { label: '変動', color: '#e67e22' },
        complex: { label: '複合', color: '#3498db' },
        manual: { label: '手動', color: '#95a5a6' }
      };
      const t = types[feeType] || types.simple;
      return `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:${t.color};color:#fff;font-weight:500;white-space:nowrap;">${t.label}</span>`;
    };

    // UIを生成
    container.innerHTML = `
      <div class="master-options-container">
        <div class="master-options-section">
          <div class="master-options-header">
            <h6><i class="bi bi-shop"></i> 出品先プラットフォーム</h6>
            <span class="badge bg-secondary">${items.length}件</span>
          </div>
          <div class="master-options-list" id="salesChannelList">
            ${items.length === 0 ? `
              <div class="master-options-empty">
                <p>出品先がまだ登録されていません</p>
              </div>
            ` : items.map(item => {
              // 画像URLを正規化（相対パスの場合は/を付与）
              const normalizedIconUrl = item.iconUrl
                ? (item.iconUrl.startsWith('http') || item.iconUrl.startsWith('/') ? item.iconUrl : '/' + item.iconUrl)
                : '';
              // サムネイル: 画像がある場合はimgタグ、なければフォールバックアイコン
              // onerrorでは画像を非表示にしてフォールバックを表示
              const thumbnail = normalizedIconUrl
                ? `<div style="width:32px;height:32px;flex-shrink:0;position:relative;">
                     <div style="position:absolute;inset:0;background:#f0f0f0;border-radius:6px;display:flex;align-items:center;justify-content:center;"><i class="bi bi-shop" style="font-size:16px;color:#aaa;"></i></div>
                     <img src="${escapeHtml(normalizedIconUrl)}" alt="" style="position:relative;width:32px;height:32px;object-fit:contain;border-radius:6px;background:#fff;border:1px solid #e9ecef;" onerror="this.style.display='none';">
                   </div>`
                : `<div style="width:32px;height:32px;background:#f0f0f0;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="bi bi-shop" style="font-size:16px;color:#aaa;"></i></div>`;
              const statusBadge = item.active
                ? ''
                : `<span style="font-size:10px;padding:2px 6px;border-radius:4px;background:#6c757d;color:#fff;margin-left:8px;">無効</span>`;
              const feeText = getFeeDisplayText(item);
              const feeTypeBadge = getFeeTypeBadge(item.feeType);

              return `
              <div class="master-options-item" data-item-id="${item.id}" style="${!item.active ? 'opacity:0.5;' : ''}">
                <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">
                  ${thumbnail}
                  <div style="flex:1;min-width:0;">
                    <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                      <span style="font-weight:600;font-size:14px;">${escapeHtml(item.name)}</span>
                      ${statusBadge}
                      ${feeTypeBadge}
                    </div>
                    <div style="font-size:12px;color:#666;margin-top:2px;">
                      ${feeText ? `手数料 ${feeText}` : '<span style="color:#aaa;">手数料未設定</span>'}
                    </div>
                  </div>
                </div>
                <div class="item-actions" style="display:flex;gap:4px;flex-shrink:0;">
                  <button class="btn-icon btn-edit" onclick="editSalesChannel('${item.id}')" title="編集">
                    <i class="bi bi-pencil"></i>
                  </button>
                  <button class="btn-icon btn-delete" onclick="deleteSalesChannel('${item.id}')" title="削除">
                    <i class="bi bi-trash"></i>
                  </button>
                </div>
              </div>
            `;}).join('')}
          </div>
          <div class="master-options-add" style="padding:12px;border-top:1px solid #e9ecef;text-align:center;">
            <button class="btn btn-primary" onclick="openAddSalesChannelModal()" style="padding:8px 24px;">
              <i class="bi bi-plus-circle"></i> 新しい出品先を追加
            </button>
          </div>
        </div>
      </div>
    `;

    console.log(`salesChannelDropdown読み込み完了: ${items.length}件`);
  } catch (error) {
    console.error('salesChannelDropdown読み込みエラー:', error);
    container.innerHTML = `<div class="text-center text-danger py-4">読み込みエラー: ${error.message}</div>`;
  }
}

/**
 * 新規追加用の出品先画像プレビュー
 */
window.previewNewSalesChannelImage = function(input) {
  const preview = document.getElementById('newSalesChannelImagePreview');
  if (input.files && input.files[0] && preview) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" alt="プレビュー" style="width:36px;height:36px;object-fit:contain;border-radius:6px;">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
};

/**
 * 出品先画像をFirebase Storageにアップロード
 */
async function uploadSalesChannelImage(file, platformId) {
  const storage = window.parent?.firebaseStorage || window.firebaseStorage;
  const storageRef = window.parent?.storageRef || window.storageRef;
  const uploadBytes = window.parent?.storageUploadBytes || window.storageUploadBytes;
  const getDownloadURL = window.parent?.storageGetDownloadURL || window.storageGetDownloadURL;

  if (!storage || !storageRef || !uploadBytes || !getDownloadURL) {
    throw new Error('Firebase Storageが利用できません');
  }

  const ext = file.name.split('.').pop().toLowerCase();
  const timestamp = Date.now();
  const path = `sales-channels/${platformId}/${timestamp}.${ext}`;

  const fileRef = storageRef(storage, path);
  await uploadBytes(fileRef, file);
  const url = await getDownloadURL(fileRef);

  console.log(`✅ [SalesChannel] 画像アップロード完了: ${path}`);
  return url;
}

/**
 * 出品先を追加
 */
window.addSalesChannel = async function() {
  const idInput = document.getElementById('newSalesChannelId');
  const nameInput = document.getElementById('newSalesChannelName');
  const imageInput = document.getElementById('newSalesChannelImageFile');

  const platformId = idInput?.value?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const name = nameInput?.value?.trim();

  if (!platformId) {
    alert('プラットフォームIDを入力してください');
    return;
  }
  if (!name) {
    alert('出品先名を入力してください');
    return;
  }

  // 重複チェック
  const items = window._currentSalesChannels || [];
  if (items.some(item => item.platformId === platformId)) {
    alert('このプラットフォームIDは既に登録されています');
    return;
  }

  try {
    const maxOrder = items.reduce((max, item) => Math.max(max, item.order || 0), 0);

    const newData = {
      platformId,
      name,
      commission: 0,
      url: '',
      order: maxOrder + 1,
      active: true,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // ドキュメントIDをplatformIdにする
    const docRef = window.db.collection(currentMasterConfig.collection).doc(platformId);
    await docRef.set(newData);

    // 画像が選択されていればアップロード
    if (imageInput?.files?.length > 0) {
      try {
        const iconUrl = await uploadSalesChannelImage(imageInput.files[0], platformId);
        await docRef.update({ iconUrl });
      } catch (imgError) {
        console.error('画像アップロードエラー:', imgError);
      }
    }

    // フォームリセット
    idInput.value = '';
    nameInput.value = '';
    if (imageInput) imageInput.value = '';
    const preview = document.getElementById('newSalesChannelImagePreview');
    if (preview) {
      preview.innerHTML = `<i class="bi bi-image" style="font-size:16px;color:#aaa;"></i>`;
    }

    await renderSalesChannelDropdownUI();
    showToast('追加しました');
  } catch (error) {
    console.error('追加エラー:', error);
    alert('追加に失敗しました: ' + error.message);
  }
};

/**
 * 出品先追加モーダルを開く
 */
window.openAddSalesChannelModal = function() {
  document.getElementById('editItemModalTitle').textContent = '新しい出品先を追加';
  document.getElementById('editItemModalBody').innerHTML = `
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:4px;font-weight:500;">プラットフォームID <span style="color:red;">*</span></label>
      <input type="text" class="form-control" id="addSalesChannelId" placeholder="例: mercari, yahoo-auction" style="font-size:16px;">
      <small class="text-muted">半角英数字とハイフンのみ（後から変更不可）</small>
    </div>
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:4px;font-weight:500;">出品先名 <span style="color:red;">*</span></label>
      <input type="text" class="form-control" id="addSalesChannelName" placeholder="例: メルカリ, ヤフオク!" style="font-size:16px;">
    </div>
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:8px;font-weight:500;">アイコン画像</label>
      <div style="display:flex;align-items:center;gap:12px;">
        <div id="addSalesChannelImagePreview" style="width:60px;height:60px;background:#f0f0f0;border-radius:6px;display:flex;align-items:center;justify-content:center;">
          <i class="bi bi-shop" style="font-size:24px;color:#aaa;"></i>
        </div>
        <div style="flex:1;">
          <input type="file" class="form-control" id="addSalesChannelImageFile" accept="image/*" style="font-size:14px;" onchange="previewAddSalesChannelImage(this)">
          <small class="text-muted">推奨: 正方形PNG、200x200px</small>
        </div>
      </div>
    </div>

    <!-- 手数料タイプ選択 -->
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:4px;font-weight:500;">手数料タイプ</label>
      <select class="form-select" id="addSalesChannelFeeType" style="font-size:16px;" onchange="toggleAddFeeTypeFields()">
        <option value="simple" selected>固定%（メルカリ、Yahoo!フリマ等）</option>
        <option value="variable">変動制（ラクマ等）</option>
        <option value="complex">複合計算（BASE等）</option>
        <option value="manual">手動入力（楽天、Amazon等）</option>
      </select>
    </div>

    <!-- simple: 固定% -->
    <div id="addFeeFields_simple" class="add-fee-type-fields" style="display:block;">
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-weight:500;">手数料率（%）</label>
        <input type="number" class="form-control" id="addSalesChannelCommission" value="10" min="0" max="100" step="0.1" style="font-size:16px;">
      </div>
    </div>

    <!-- variable: 変動制 -->
    <div id="addFeeFields_variable" class="add-fee-type-fields" style="display:none;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div class="form-group">
          <label style="display:block;margin-bottom:4px;font-weight:500;">最小（%）</label>
          <input type="number" class="form-control" id="addSalesChannelCommissionMin" value="0" min="0" max="100" step="0.1" style="font-size:16px;">
        </div>
        <div class="form-group">
          <label style="display:block;margin-bottom:4px;font-weight:500;">最大（%）</label>
          <input type="number" class="form-control" id="addSalesChannelCommissionMax" value="10" min="0" max="100" step="0.1" style="font-size:16px;">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-weight:500;">デフォルト（%）</label>
        <input type="number" class="form-control" id="addSalesChannelCommissionDefault" value="10" min="0" max="100" step="0.1" style="font-size:16px;">
      </div>
    </div>

    <!-- complex: 複合計算 -->
    <div id="addFeeFields_complex" class="add-fee-type-fields" style="display:none;">
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-weight:500;">計算式</label>
        <input type="text" class="form-control" id="addSalesChannelFormula" placeholder="例: 3.6% + 40円 + 3%" style="font-size:16px;">
      </div>
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-weight:500;">計算式の説明</label>
        <input type="text" class="form-control" id="addSalesChannelFormulaDesc" placeholder="例: 決済手数料3.6%+40円、サービス利用料3%" style="font-size:16px;">
      </div>
    </div>

    <!-- manual: 手動入力 -->
    <div id="addFeeFields_manual" class="add-fee-type-fields" style="display:none;">
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-weight:500;">手数料の説明</label>
        <textarea class="form-control" id="addSalesChannelFeeNote" rows="2" placeholder="例: カテゴリ別8〜15%" style="font-size:16px;"></textarea>
      </div>
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-weight:500;">目安手数料率（%）</label>
        <input type="number" class="form-control" id="addSalesChannelFeeEstimate" value="10" min="0" max="100" step="0.1" style="font-size:16px;">
      </div>
    </div>

    <!-- 月額費用 -->
    <div class="form-group" style="margin-bottom:16px;padding:12px;background:#f8f9fa;border-radius:8px;">
      <label style="display:block;margin-bottom:8px;font-weight:600;color:#495057;">💰 月額費用（有料プラン用）</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label style="display:block;margin-bottom:4px;font-weight:500;font-size:13px;">月払い（円）</label>
          <input type="number" class="form-control" id="addSalesChannelMonthlyFee" value="0" min="0" style="font-size:16px;">
        </div>
        <div class="form-group">
          <label style="display:block;margin-bottom:4px;font-weight:500;font-size:13px;">年払い（円/月換算）</label>
          <input type="number" class="form-control" id="addSalesChannelMonthlyFeeAnnual" value="0" min="0" style="font-size:16px;">
        </div>
      </div>
    </div>
  `;

  window._editItemContext = { type: 'addSalesChannel', itemId: null };

  document.getElementById('editItemSubmitBtn').textContent = '追加';
  document.getElementById('editItemSubmitBtn').onclick = saveNewSalesChannel;

  document.getElementById('editItemModal').classList.remove('hidden');
};

// 追加モーダル用: 手数料タイプ切り替え
window.toggleAddFeeTypeFields = function() {
  const feeType = document.getElementById('addSalesChannelFeeType')?.value || 'simple';
  document.querySelectorAll('.add-fee-type-fields').forEach(el => el.style.display = 'none');
  const targetEl = document.getElementById('addFeeFields_' + feeType);
  if (targetEl) targetEl.style.display = 'block';
};

// 追加モーダル用: 画像プレビュー
window.previewAddSalesChannelImage = function(input) {
  const preview = document.getElementById('addSalesChannelImagePreview');
  if (input.files && input.files[0] && preview) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" alt="プレビュー" style="width:60px;height:60px;object-fit:contain;border-radius:6px;">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
};

// 新規出品先を保存
async function saveNewSalesChannel() {
  const idInput = document.getElementById('addSalesChannelId');
  const nameInput = document.getElementById('addSalesChannelName');
  const feeTypeSelect = document.getElementById('addSalesChannelFeeType');
  const imageInput = document.getElementById('addSalesChannelImageFile');

  const platformId = idInput?.value?.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const name = nameInput?.value?.trim();
  const feeType = feeTypeSelect?.value || 'simple';

  if (!platformId) {
    alert('プラットフォームIDを入力してください');
    return;
  }
  if (!name) {
    alert('出品先名を入力してください');
    return;
  }

  // 重複チェック
  const items = window._currentSalesChannels || [];
  if (items.some(item => item.platformId === platformId || item.id === platformId)) {
    alert('このプラットフォームIDは既に登録されています');
    return;
  }

  try {
    const maxOrder = items.reduce((max, item) => Math.max(max, item.order || 0), 0);

    const newData = {
      platformId,
      name,
      feeType,
      order: maxOrder + 1,
      active: true,
      monthlyFee: parseInt(document.getElementById('addSalesChannelMonthlyFee')?.value) || 0,
      monthlyFeeAnnual: parseInt(document.getElementById('addSalesChannelMonthlyFeeAnnual')?.value) || 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 手数料タイプ別のフィールドを取得
    switch (feeType) {
      case 'simple':
        newData.commission = parseFloat(document.getElementById('addSalesChannelCommission')?.value) || 0;
        break;
      case 'variable':
        newData.commissionMin = parseFloat(document.getElementById('addSalesChannelCommissionMin')?.value) || 0;
        newData.commissionMax = parseFloat(document.getElementById('addSalesChannelCommissionMax')?.value) || 0;
        newData.commissionDefault = parseFloat(document.getElementById('addSalesChannelCommissionDefault')?.value) || 0;
        break;
      case 'complex':
        newData.commissionFormula = document.getElementById('addSalesChannelFormula')?.value?.trim() || '';
        newData.formulaDescription = document.getElementById('addSalesChannelFormulaDesc')?.value?.trim() || '';
        break;
      case 'manual':
        newData.feeNote = document.getElementById('addSalesChannelFeeNote')?.value?.trim() || '';
        newData.feeEstimate = parseFloat(document.getElementById('addSalesChannelFeeEstimate')?.value) || 0;
        break;
    }

    // ドキュメントIDをplatformIdにする
    const docRef = window.db.collection(currentMasterConfig.collection).doc(platformId);
    await docRef.set(newData);

    // 画像が選択されていればアップロード
    if (imageInput?.files?.length > 0) {
      try {
        const iconUrl = await uploadSalesChannelImage(imageInput.files[0], platformId);
        await docRef.update({ iconUrl });
      } catch (imgError) {
        console.error('画像アップロードエラー:', imgError);
      }
    }

    hideEditItemModal();
    await renderSalesChannelDropdownUI();
    showToast('追加しました');
  } catch (error) {
    console.error('追加エラー:', error);
    alert('追加に失敗しました: ' + error.message);
  }
}

/**
 * 出品先を編集（モーダル表示）
 */
window.editSalesChannel = function(itemId) {
  const items = window._currentSalesChannels || [];
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  // 画像URLを正規化
  const normalizedIconUrl = item.iconUrl
    ? (item.iconUrl.startsWith('http') || item.iconUrl.startsWith('/') ? item.iconUrl : '/' + item.iconUrl)
    : '';
  const currentImageHtml = normalizedIconUrl
    ? `<img src="${escapeHtml(normalizedIconUrl)}" alt="現在の画像" style="width:60px;height:60px;object-fit:contain;border-radius:6px;border:1px solid #ddd;background:#fff;" onerror="this.style.display='none';">`
    : `<div style="width:60px;height:60px;background:#f0f0f0;border-radius:6px;display:flex;align-items:center;justify-content:center;"><i class="bi bi-shop" style="font-size:24px;color:#aaa;"></i></div>`;

  const feeType = item.feeType || 'simple';

  document.getElementById('editItemModalTitle').textContent = '出品先を編集';
  document.getElementById('editItemModalBody').innerHTML = `
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:4px;font-weight:500;">プラットフォームID</label>
      <input type="text" class="form-control" id="editSalesChannelId" value="${escapeHtml(item.platformId)}" style="font-size:16px;" disabled>
      <small class="text-muted">IDは変更できません</small>
    </div>
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:4px;font-weight:500;">出品先名</label>
      <input type="text" class="form-control" id="editSalesChannelName" value="${escapeHtml(item.name)}" style="font-size:16px;">
    </div>
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:8px;font-weight:500;">アイコン画像</label>
      <div style="display:flex;align-items:center;gap:12px;">
        <div id="editSalesChannelImagePreview">${currentImageHtml}</div>
        <div style="flex:1;">
          <input type="file" class="form-control" id="editSalesChannelImageFile" accept="image/*" style="font-size:14px;" onchange="previewEditSalesChannelImage(this)">
          <small class="text-muted">推奨: 正方形PNG、200x200px</small>
        </div>
      </div>
    </div>

    <!-- 手数料タイプ選択 -->
    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:4px;font-weight:500;">手数料タイプ</label>
      <select class="form-select" id="editSalesChannelFeeType" style="font-size:16px;" onchange="toggleFeeTypeFields()">
        <option value="simple" ${feeType === 'simple' ? 'selected' : ''}>固定%（メルカリ、Yahoo!フリマ等）</option>
        <option value="variable" ${feeType === 'variable' ? 'selected' : ''}>変動制（ラクマ等）</option>
        <option value="complex" ${feeType === 'complex' ? 'selected' : ''}>複合計算（BASE等）</option>
        <option value="manual" ${feeType === 'manual' ? 'selected' : ''}>手動入力（楽天、Amazon等）</option>
      </select>
    </div>

    <!-- simple: 固定% -->
    <div id="feeFields_simple" class="fee-type-fields" style="display:${feeType === 'simple' ? 'block' : 'none'};">
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-weight:500;">手数料率（%）</label>
        <input type="number" class="form-control" id="editSalesChannelCommission" value="${item.commission || 0}" min="0" max="100" step="0.1" style="font-size:16px;">
      </div>
    </div>

    <!-- variable: 変動制 -->
    <div id="feeFields_variable" class="fee-type-fields" style="display:${feeType === 'variable' ? 'block' : 'none'};">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px;">
        <div class="form-group">
          <label style="display:block;margin-bottom:4px;font-weight:500;">最小（%）</label>
          <input type="number" class="form-control" id="editSalesChannelCommissionMin" value="${item.commissionMin || 0}" min="0" max="100" step="0.1" style="font-size:16px;">
        </div>
        <div class="form-group">
          <label style="display:block;margin-bottom:4px;font-weight:500;">最大（%）</label>
          <input type="number" class="form-control" id="editSalesChannelCommissionMax" value="${item.commissionMax || 0}" min="0" max="100" step="0.1" style="font-size:16px;">
        </div>
      </div>
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-weight:500;">デフォルト（%）</label>
        <input type="number" class="form-control" id="editSalesChannelCommissionDefault" value="${item.commissionDefault || 0}" min="0" max="100" step="0.1" style="font-size:16px;">
        <small class="text-muted">販売記録時に初期選択される値</small>
      </div>
    </div>

    <!-- complex: 複合計算 -->
    <div id="feeFields_complex" class="fee-type-fields" style="display:${feeType === 'complex' ? 'block' : 'none'};">
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-weight:500;">計算式</label>
        <input type="text" class="form-control" id="editSalesChannelFormula" value="${escapeHtml(item.commissionFormula || '')}" placeholder="例: 3.6% + 40円 + 3%" style="font-size:16px;">
        <small class="text-muted">形式: X% + Y円 + Z%（自動計算用）</small>
      </div>
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-weight:500;">計算式の説明</label>
        <input type="text" class="form-control" id="editSalesChannelFormulaDesc" value="${escapeHtml(item.formulaDescription || '')}" placeholder="例: 決済手数料3.6%+40円、サービス利用料3%" style="font-size:16px;">
      </div>
    </div>

    <!-- manual: 手動入力 -->
    <div id="feeFields_manual" class="fee-type-fields" style="display:${feeType === 'manual' ? 'block' : 'none'};">
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-weight:500;">手数料の説明</label>
        <textarea class="form-control" id="editSalesChannelFeeNote" rows="3" placeholder="例: カテゴリ別8〜15%、成約料あり、FBA手数料別途" style="font-size:16px;">${escapeHtml(item.feeNote || '')}</textarea>
      </div>
      <div class="form-group" style="margin-bottom:16px;">
        <label style="display:block;margin-bottom:4px;font-weight:500;">目安手数料率（%）</label>
        <input type="number" class="form-control" id="editSalesChannelFeeEstimate" value="${item.feeEstimate || 0}" min="0" max="100" step="0.1" style="font-size:16px;">
        <small class="text-muted">参考値として表示されます</small>
      </div>
    </div>

    <!-- 月額費用 -->
    <div class="form-group" style="margin-bottom:16px;padding:12px;background:#f8f9fa;border-radius:8px;">
      <label style="display:block;margin-bottom:8px;font-weight:600;color:#495057;">💰 月額費用（有料プラン用）</label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div class="form-group">
          <label style="display:block;margin-bottom:4px;font-weight:500;font-size:13px;">月払い（円）</label>
          <input type="number" class="form-control" id="editSalesChannelMonthlyFee" value="${item.monthlyFee || 0}" min="0" style="font-size:16px;">
        </div>
        <div class="form-group">
          <label style="display:block;margin-bottom:4px;font-weight:500;font-size:13px;">年払い（円/月換算）</label>
          <input type="number" class="form-control" id="editSalesChannelMonthlyFeeAnnual" value="${item.monthlyFeeAnnual || 0}" min="0" style="font-size:16px;">
        </div>
      </div>
      <small class="text-muted">売上分析で純利益計算に使用されます</small>
    </div>

    <div class="form-group" style="margin-bottom:16px;">
      <label style="display:block;margin-bottom:4px;font-weight:500;">表示順</label>
      <input type="number" class="form-control" id="editSalesChannelOrder" value="${item.order || 0}" min="0" style="font-size:16px;">
    </div>
    <div class="form-group">
      <div class="form-check">
        <input type="checkbox" class="form-check-input" id="editSalesChannelActive" ${item.active ? 'checked' : ''}>
        <label class="form-check-label" for="editSalesChannelActive">有効</label>
      </div>
    </div>
  `;

  window._editItemContext = { type: 'salesChannel', itemId };

  document.getElementById('editItemSubmitBtn').textContent = '保存';
  document.getElementById('editItemSubmitBtn').onclick = window.submitEditItem;

  document.getElementById('editItemModal').classList.remove('hidden');
};

/**
 * 手数料タイプに応じてフィールドを表示/非表示
 */
window.toggleFeeTypeFields = function() {
  const feeType = document.getElementById('editSalesChannelFeeType').value;
  const types = ['simple', 'variable', 'complex', 'manual'];

  types.forEach(type => {
    const fields = document.getElementById(`feeFields_${type}`);
    if (fields) {
      fields.style.display = type === feeType ? 'block' : 'none';
    }
  });
};

/**
 * 編集用の出品先画像プレビュー
 */
window.previewEditSalesChannelImage = function(input) {
  const preview = document.getElementById('editSalesChannelImagePreview');
  if (input.files && input.files[0] && preview) {
    const reader = new FileReader();
    reader.onload = function(e) {
      preview.innerHTML = `<img src="${e.target.result}" alt="プレビュー" style="width:60px;height:60px;object-fit:contain;border-radius:6px;border:1px solid #ddd;background:#fff;">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
};

/**
 * 出品先の編集を保存
 */
async function saveSalesChannelFromModal(itemId) {
  const nameInput = document.getElementById('editSalesChannelName');
  const feeTypeSelect = document.getElementById('editSalesChannelFeeType');
  const urlInput = document.getElementById('editSalesChannelUrl');
  const orderInput = document.getElementById('editSalesChannelOrder');
  const activeInput = document.getElementById('editSalesChannelActive');
  const imageInput = document.getElementById('editSalesChannelImageFile');

  const newName = nameInput.value.trim();
  if (!newName) {
    alert('出品先名を入力してください');
    nameInput.focus();
    return;
  }

  const feeType = feeTypeSelect?.value || 'simple';

  try {
    const updateData = {
      name: newName,
      feeType: feeType,
      url: urlInput.value.trim(),
      order: parseInt(orderInput.value, 10) || 0,
      active: activeInput.checked,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    // 手数料タイプ別のフィールドを取得
    switch (feeType) {
      case 'simple':
        updateData.commission = parseFloat(document.getElementById('editSalesChannelCommission')?.value) || 0;
        // 他のタイプのフィールドをクリア
        updateData.commissionMin = null;
        updateData.commissionMax = null;
        updateData.commissionDefault = null;
        updateData.commissionFormula = null;
        updateData.formulaDescription = null;
        updateData.feeNote = null;
        updateData.feeEstimate = null;
        break;
      case 'variable':
        updateData.commissionMin = parseFloat(document.getElementById('editSalesChannelCommissionMin')?.value) || 0;
        updateData.commissionMax = parseFloat(document.getElementById('editSalesChannelCommissionMax')?.value) || 0;
        updateData.commissionDefault = parseFloat(document.getElementById('editSalesChannelCommissionDefault')?.value) || 0;
        // 他のタイプのフィールドをクリア
        updateData.commission = null;
        updateData.commissionFormula = null;
        updateData.formulaDescription = null;
        updateData.feeNote = null;
        updateData.feeEstimate = null;
        break;
      case 'complex':
        updateData.commissionFormula = document.getElementById('editSalesChannelFormula')?.value?.trim() || '';
        updateData.formulaDescription = document.getElementById('editSalesChannelFormulaDesc')?.value?.trim() || '';
        // 他のタイプのフィールドをクリア
        updateData.commission = null;
        updateData.commissionMin = null;
        updateData.commissionMax = null;
        updateData.commissionDefault = null;
        updateData.feeNote = null;
        updateData.feeEstimate = null;
        break;
      case 'manual':
        updateData.feeNote = document.getElementById('editSalesChannelFeeNote')?.value?.trim() || '';
        updateData.feeEstimate = parseFloat(document.getElementById('editSalesChannelFeeEstimate')?.value) || 0;
        // 他のタイプのフィールドをクリア
        updateData.commission = null;
        updateData.commissionMin = null;
        updateData.commissionMax = null;
        updateData.commissionDefault = null;
        updateData.commissionFormula = null;
        updateData.formulaDescription = null;
        break;
    }

    // 月額固定費（全タイプ共通）
    updateData.monthlyFee = parseInt(document.getElementById('editSalesChannelMonthlyFee')?.value) || 0;
    updateData.monthlyFeeAnnual = parseInt(document.getElementById('editSalesChannelMonthlyFeeAnnual')?.value) || 0;

    // 画像が選択されていればアップロード
    if (imageInput?.files?.length > 0) {
      const items = window._currentSalesChannels || [];
      const item = items.find(i => i.id === itemId);
      if (item) {
        const iconUrl = await uploadSalesChannelImage(imageInput.files[0], item.platformId);
        updateData.iconUrl = iconUrl;
      }
    }

    await window.db.collection(currentMasterConfig.collection).doc(itemId).update(updateData);

    hideEditItemModal();
    await renderSalesChannelDropdownUI();
    showToast('更新しました');
  } catch (error) {
    console.error('編集エラー:', error);
    alert('編集に失敗しました: ' + error.message);
  }
}

/**
 * 出品先を削除
 */
window.deleteSalesChannel = async function(itemId) {
  const items = window._currentSalesChannels || [];
  const item = items.find(i => i.id === itemId);
  if (!item) return;

  if (!confirm(`「${item.name}」を削除しますか？\n\n※ この出品先を参照している他のマスタには影響があります。`)) return;

  try {
    await window.db.collection(currentMasterConfig.collection).doc(itemId).delete();
    await renderSalesChannelDropdownUI();
    showToast('削除しました');
  } catch (error) {
    console.error('削除エラー:', error);
    alert('削除に失敗しました: ' + error.message);
  }
};


// ============================================
// 場所管理機能（ハイブリッド在庫管理）
// ============================================

/**
 * 現在のユーザーの場所を取得（なければ自動作成）
 * @returns {Promise<Object>} - 場所オブジェクト { id, name, type, ... }
 */
async function getCurrentUserLocation() {
  const userEmail = window.currentUser?.email || localStorage.getItem('reborn_user_email');
  const userName = window.currentUser?.name || localStorage.getItem('reborn_user_name') || 'unknown';

  if (!userEmail) {
    console.warn('[Location] ユーザーメール未取得');
    return null;
  }

  // 既存の場所を検索
  const snapshot = await window.db.collection('packagingLocations')
    .where('assignedUserEmail', '==', userEmail)
    .where('type', '==', 'user_home')
    .limit(1)
    .get();

  if (!snapshot.empty) {
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  // 場所がなければ自動作成
  const newLocation = {
    name: `${userName}さん`,
    type: 'user_home',
    assignedUserEmail: userEmail,
    assignedUserName: userName,
    isActive: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const docRef = await window.db.collection('packagingLocations').add(newLocation);
  console.log(`✅ [Location] 新規作成: ${userName}さん (${docRef.id})`);
  return { id: docRef.id, ...newLocation };
}

/**
 * 全場所を取得（管理者用）
 * @returns {Promise<Array>} - 場所配列
 */
async function getAllLocations() {
  const snapshot = await window.db.collection('packagingLocations')
    .where('isActive', '==', true)
    .orderBy('type')
    .orderBy('name')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * 場所を作成（倉庫/事務所用）
 * @param {string} name - 場所名
 * @param {string} type - 'warehouse' | 'office'
 * @returns {Promise<string>} - 作成されたID
 */
async function createLocation(name, type) {
  const newLocation = {
    name,
    type,
    assignedUserEmail: null,
    assignedUserName: null,
    isActive: true,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const docRef = await window.db.collection('packagingLocations').add(newLocation);
  console.log(`✅ [Location] 新規作成: ${name} (${type})`);
  return docRef.id;
}

/**
 * 場所ごとの在庫サマリーを取得
 * @param {string} locationId - 場所ID（nullの場合は全場所）
 * @returns {Promise<Array>} - [{ materialId, materialName, totalStock, alertThreshold }]
 */
async function getStockSummaryByLocation(locationId = null) {
  let query = window.db.collection('packagingLots')
    .where('status', '==', 'active');

  if (locationId) {
    query = query.where('locationId', '==', locationId);
  }

  const lotsSnapshot = await query.get();

  // materialIdごとに集計
  const stockMap = {};
  lotsSnapshot.docs.forEach(doc => {
    const lot = doc.data();
    if (!stockMap[lot.materialId]) {
      stockMap[lot.materialId] = {
        materialId: lot.materialId,
        totalStock: 0,
        lots: []
      };
    }
    stockMap[lot.materialId].totalStock += lot.remainingQty || 0;
    stockMap[lot.materialId].lots.push({
      id: doc.id,
      remainingQty: lot.remainingQty,
      unitPrice: lot.unitPrice,
      locationId: lot.locationId
    });
  });

  return Object.values(stockMap);
}

/**
 * 管理者かどうかを判定
 * @returns {boolean}
 */
function isAdmin() {
  const permission = localStorage.getItem('reborn_user_permission');
  return permission === 'owner' || permission === 'admin';
}

// 現在の場所をキャッシュ
let _currentLocation = null;

/**
 * 現在の場所を取得（キャッシュ付き）
 */
async function getOrCreateCurrentLocation() {
  if (_currentLocation) return _currentLocation;
  _currentLocation = await getCurrentUserLocation();
  return _currentLocation;
}

// ============================================
// ロット管理機能（FIFO/LIFO対応）
// ============================================

/**
 * 新しいロットを作成
 * @param {string} materialId - 梱包資材ID
 * @param {number} quantity - 数量
 * @param {number} unitPrice - 単価
 * @param {string} locationId - 場所ID（必須）
 * @param {string} supplier - 発注先（任意）
 * @param {string} notes - 備考（任意）
 * @returns {Promise<string>} - 作成されたロットのID
 */
async function createLot(materialId, quantity, unitPrice, locationId, supplier = '', notes = '') {
  if (!locationId) {
    console.error('[Lot] locationId は必須です');
    throw new Error('locationId is required');
  }

  const lotData = {
    materialId,
    locationId,
    quantity,
    remainingQty: quantity,
    unitPrice,
    purchaseDate: firebase.firestore.FieldValue.serverTimestamp(),
    supplier,
    notes,
    status: 'active',
    createdBy: window.currentUser?.name || 'unknown',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  const docRef = await window.db.collection('packagingLots').add(lotData);
  console.log(`✅ [Lot] 新規ロット作成: ${docRef.id}, 場所: ${locationId}, 数量: ${quantity}, 単価: ${unitPrice}`);
  return docRef.id;
}

/**
 * 資材の有効なロットを取得（FIFO順：古い順）
 * @param {string} materialId - 梱包資材ID
 * @param {string} locationId - 場所ID（必須）
 * @returns {Promise<Array>} - ロット配列（purchaseDate昇順）
 */
async function getActiveLots(materialId, locationId) {
  if (!locationId) {
    console.error('[Lot] getActiveLots: locationId は必須です');
    return [];
  }

  const snapshot = await window.db.collection('packagingLots')
    .where('materialId', '==', materialId)
    .where('locationId', '==', locationId)
    .where('status', '==', 'active')
    .orderBy('purchaseDate', 'asc')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}

/**
 * 資材の合計在庫数を計算（全ロットのremainingQtyの合計）
 * @param {string} materialId - 梱包資材ID
 * @param {string} locationId - 場所ID（必須）
 * @returns {Promise<number>} - 合計在庫数
 */
async function getTotalStock(materialId, locationId) {
  const lots = await getActiveLots(materialId, locationId);
  return lots.reduce((sum, lot) => sum + (lot.remainingQty || 0), 0);
}

/**
 * FIFO方式で在庫を消費（出庫用）
 * 古いロットから順に消費
 * @param {string} materialId - 梱包資材ID
 * @param {string} locationId - 場所ID（必須）
 * @param {number} quantity - 消費数量
 * @returns {Promise<Array>} - 消費したロット情報（原価計算用）
 */
async function consumeStockFIFO(materialId, locationId, quantity) {
  if (!locationId) {
    console.error('[FIFO] locationId は必須です');
    return [];
  }

  const lots = await getActiveLots(materialId, locationId);
  let remaining = quantity;
  const consumed = [];

  for (const lot of lots) {
    if (remaining <= 0) break;

    const toConsume = Math.min(remaining, lot.remainingQty);
    const newRemainingQty = lot.remainingQty - toConsume;
    const newStatus = newRemainingQty <= 0 ? 'depleted' : 'active';

    await window.db.collection('packagingLots').doc(lot.id).update({
      remainingQty: newRemainingQty,
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    consumed.push({
      lotId: lot.id,
      quantity: toConsume,
      unitPrice: lot.unitPrice,
      cost: toConsume * lot.unitPrice
    });

    remaining -= toConsume;
    console.log(`📦 [FIFO] ロット ${lot.id}: ${lot.remainingQty} → ${newRemainingQty} (消費: ${toConsume})`);
  }

  if (remaining > 0) {
    console.warn(`⚠️ [FIFO] 在庫不足: 残り ${remaining} 消費できず`);
  }

  return consumed;
}

/**
 * LIFO方式で在庫を調整（調整用）
 * 新しいロットから順に減らす
 * @param {string} materialId - 梱包資材ID
 * @param {string} locationId - 場所ID（必須）
 * @param {number} quantity - 減少数量
 * @param {string} reason - 理由
 * @returns {Promise<Array>} - 調整したロット情報
 */
async function adjustStockLIFO(materialId, locationId, quantity, reason = '') {
  if (!locationId) {
    console.error('[LIFO] locationId は必須です');
    return [];
  }

  // LIFO: 新しい順に取得
  const snapshot = await window.db.collection('packagingLots')
    .where('materialId', '==', materialId)
    .where('locationId', '==', locationId)
    .where('status', '==', 'active')
    .orderBy('purchaseDate', 'desc')
    .get();

  const lots = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));

  let remaining = quantity;
  const adjusted = [];

  for (const lot of lots) {
    if (remaining <= 0) break;

    const toAdjust = Math.min(remaining, lot.remainingQty);
    const newRemainingQty = lot.remainingQty - toAdjust;
    const newStatus = newRemainingQty <= 0 ? 'depleted' : 'active';

    await window.db.collection('packagingLots').doc(lot.id).update({
      remainingQty: newRemainingQty,
      status: newStatus,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    adjusted.push({
      lotId: lot.id,
      quantity: toAdjust,
      unitPrice: lot.unitPrice
    });

    remaining -= toAdjust;
    console.log(`🔧 [LIFO] ロット ${lot.id}: ${lot.remainingQty} → ${newRemainingQty} (調整: ${toAdjust})`);
  }

  if (remaining > 0) {
    console.warn(`⚠️ [LIFO] 在庫不足: 残り ${remaining} 調整できず`);
  }

  return adjusted;
}

/**
 * ロット詳細を取得してフォーマット（UI表示用）
 * @param {string} materialId - 梱包資材ID
 * @param {string} locationId - 場所ID（必須）
 * @returns {Promise<Object>} - { totalStock, lots: [...] }
 */
async function getLotsWithDetails(materialId, locationId) {
  const lots = await getActiveLots(materialId, locationId);
  const totalStock = lots.reduce((sum, lot) => sum + (lot.remainingQty || 0), 0);

  return {
    totalStock,
    lots: lots.map(lot => ({
      id: lot.id,
      remainingQty: lot.remainingQty,
      quantity: lot.quantity,
      unitPrice: lot.unitPrice,
      purchaseDate: lot.purchaseDate?.toDate?.() || lot.purchaseDate,
      supplier: lot.supplier || ''
    }))
  };
}

// ============================================
// Phase 2: 入出庫管理機能
// ============================================

/**
 * 入庫登録モーダルを表示
 */
window.showStockInModal = function() {
  const allItems = window._currentPackagingAllItems || [];
  if (allItems.length === 0) {
    alert('先に梱包資材を登録してください');
    return;
  }

  const modal = document.getElementById('editItemModal');
  const title = document.getElementById('editItemModalTitle');
  const body = document.getElementById('editItemModalBody');
  const submitBtn = document.getElementById('editItemSubmitBtn');

  title.textContent = '入庫登録';

  // 資材選択プルダウンを生成
  const itemOptions = allItems.map(item =>
    `<option value="${item.id}">${escapeHtml(item.name)} (現在庫: ${item.currentStock})</option>`
  ).join('');

  body.innerHTML = `
    <div class="mb-3">
      <label class="form-label">梱包資材</label>
      <select class="form-select" id="stockInMaterialId" style="font-size:16px;">
        <option value="">-- 選択してください --</option>
        ${itemOptions}
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">入庫数</label>
      <input type="number" class="form-control" id="stockInQuantity" min="1" value="1" style="font-size:16px;">
    </div>
    <div class="mb-3">
      <label class="form-label">理由</label>
      <select class="form-select" id="stockInReason" style="font-size:16px;">
        <option value="purchase">購入</option>
        <option value="return">返品</option>
        <option value="adjustment">在庫調整</option>
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">購入価格（合計・任意）</label>
      <input type="number" class="form-control" id="stockInPrice" placeholder="¥（例: 900円で100枚なら900）" style="font-size:16px;">
      <small class="text-muted">※入庫数で割って単価を計算します</small>
    </div>
    <div class="mb-3">
      <label class="form-label">発注先（任意）</label>
      <input type="text" class="form-control" id="stockInSupplier" placeholder="例: Amazon, 楽天" style="font-size:16px;">
    </div>
    <div class="mb-3">
      <label class="form-label">備考（任意）</label>
      <input type="text" class="form-control" id="stockInNotes" placeholder="メモ" style="font-size:16px;">
    </div>
  `;

  submitBtn.textContent = '入庫登録';
  submitBtn.onclick = processStockIn;

  modal.classList.remove('hidden');
};

/**
 * 入庫処理を実行（ロット対応版）
 */
async function processStockIn() {
  const materialIdSelect = document.getElementById('stockInMaterialId');
  const quantityInput = document.getElementById('stockInQuantity');
  const reasonSelect = document.getElementById('stockInReason');
  const priceInput = document.getElementById('stockInPrice');
  const notesInput = document.getElementById('stockInNotes');
  const supplierInput = document.getElementById('stockInSupplier');

  const materialId = materialIdSelect?.value;
  const quantity = parseInt(quantityInput?.value, 10) || 0;
  const reason = reasonSelect?.value || 'purchase';
  const purchasePrice = parseInt(priceInput?.value, 10) || 0;
  const notes = notesInput?.value?.trim() || '';
  const supplier = supplierInput?.value?.trim() || '';

  if (!materialId) {
    alert('梱包資材を選択してください');
    materialIdSelect.focus();
    return;
  }

  if (quantity <= 0) {
    alert('入庫数は1以上を入力してください');
    quantityInput.focus();
    return;
  }

  try {
    // 1. 単価を計算
    const unitPrice = purchasePrice > 0 ? Math.round(purchasePrice / quantity) : 0;

    // 2. ロットを作成
    const lotId = await createLot(materialId, quantity, unitPrice, supplier, notes);

    // 3. トランザクション記録を作成
    const transactionData = {
      materialId: materialId,
      type: 'in',
      quantity: quantity,
      reason: reason,
      purchasePrice: purchasePrice,
      unitPrice: unitPrice,
      lotId: lotId,
      notes: notes,
      supplier: supplier,
      createdBy: window.currentUser?.name || 'unknown',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await window.db.collection('packagingTransactions').add(transactionData);

    // 4. 合計在庫を計算してmaterialに反映（互換性のため）
    const newTotalStock = await getTotalStock(materialId);
    await window.db.collection('packagingMaterials').doc(materialId).update({
      currentStock: newTotalStock,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 5. モーダルを閉じてUI更新
    hideEditItemModal();
    await renderPackagingDropdownUI();
    showToast(`入庫しました（+${quantity}）単価: ¥${unitPrice}`);

    console.log(`✅ [Stock In] ロット作成: ${lotId}, 数量: ${quantity}, 単価: ¥${unitPrice}`);

  } catch (error) {
    console.error('入庫処理エラー:', error);
    alert('入庫処理に失敗しました: ' + error.message);
  }
}

/**
 * 入出庫履歴モーダルを表示
 */
window.showStockHistoryModal = async function() {
  const modal = document.getElementById('editItemModal');
  const title = document.getElementById('editItemModalTitle');
  const body = document.getElementById('editItemModalBody');
  const submitBtn = document.getElementById('editItemSubmitBtn');

  title.textContent = '入出庫履歴';

  body.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div> 読み込み中...</div>';

  submitBtn.textContent = '閉じる';
  submitBtn.onclick = hideEditItemModal;

  modal.classList.remove('hidden');

  try {
    // 最新50件の履歴を取得
    const snapshot = await window.db.collection('packagingTransactions')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    if (snapshot.empty) {
      body.innerHTML = '<div class="text-center py-3 text-muted">履歴がありません</div>';
      return;
    }

    // 資材ID→名前のマップを作成
    const allItems = window._currentPackagingAllItems || [];
    const itemNameMap = {};
    allItems.forEach(item => {
      itemNameMap[item.id] = item.name;
    });

    const reasonLabels = {
      purchase: '購入',
      sale: '販売出庫',
      return: '返品',
      adjustment: '在庫調整'
    };

    const rows = snapshot.docs.map(doc => {
      const data = doc.data();
      const isIn = data.type === 'in';
      const typeClass = isIn ? 'text-success' : 'text-danger';
      const typeIcon = isIn ? 'bi-arrow-down-circle' : 'bi-arrow-up-circle';
      const qtyDisplay = isIn ? `+${data.quantity}` : `-${data.quantity}`;
      const materialName = itemNameMap[data.materialId] || '(削除済み)';
      const reasonLabel = reasonLabels[data.reason] || data.reason;
      const dateStr = data.createdAt?.toDate?.()?.toLocaleDateString('ja-JP') || '';

      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #eee;">
          <div>
            <span class="${typeClass}"><i class="bi ${typeIcon}"></i> ${qtyDisplay}</span>
            <span style="margin-left:8px;">${escapeHtml(materialName)}</span>
          </div>
          <div style="font-size:12px;color:#888;">
            <span>${reasonLabel}</span>
            <span style="margin-left:8px;">${dateStr}</span>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = `<div style="max-height:400px;overflow-y:auto;">${rows}</div>`;

  } catch (error) {
    console.error('履歴取得エラー:', error);
    body.innerHTML = `<div class="text-danger">読み込みエラー: ${error.message}</div>`;
  }
};

/**
 * 出庫処理（外部から呼び出し用）
 * @param {string} materialId - 資材ID
 * @param {number} quantity - 出庫数
 * @param {string} reason - 理由（'sale' | 'adjustment'）
 * @param {string} relatedSaleId - 関連販売記録ID（任意）
 * @param {string} notes - 備考（任意）
 */
window.processStockOut = async function(materialId, quantity, reason = 'sale', relatedSaleId = '', notes = '') {
  if (!materialId || quantity <= 0) {
    console.warn('[Stock Out] Invalid parameters:', { materialId, quantity });
    return false;
  }

  try {
    // 1. FIFO方式でロットから在庫を消費
    const consumed = await consumeStockFIFO(materialId, quantity);
    
    // 消費したロットの合計コストを計算
    const totalCost = consumed.reduce((sum, c) => sum + c.cost, 0);

    // 2. トランザクション記録を作成
    const transactionData = {
      materialId: materialId,
      type: 'out',
      quantity: quantity,
      reason: reason,
      relatedSaleId: relatedSaleId,
      notes: notes,
      consumedLots: consumed,  // どのロットから消費したか記録
      totalCost: totalCost,    // 原価合計
      createdBy: window.currentUser?.name || 'unknown',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await window.db.collection('packagingTransactions').add(transactionData);

    // 3. 合計在庫を計算してmaterialに反映（互換性のため）
    const newTotalStock = await getTotalStock(materialId);
    await window.db.collection('packagingMaterials').doc(materialId).update({
      currentStock: newTotalStock,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    console.log(`✅ [Stock Out FIFO] ${materialId}: -${quantity}, 原価: ¥${totalCost}`);
    return true;

  } catch (error) {
    console.error('出庫処理エラー:', error);
    return false;
  }
};


// ============================================
// Phase 2.5: 在庫調整機能（LIFO）
// ============================================

/**
 * 在庫調整モーダルを表示
 */
window.showStockAdjustmentModal = function() {
  const allItems = window._currentPackagingAllItems || [];
  if (allItems.length === 0) {
    alert('先に梱包資材を登録してください');
    return;
  }

  const modal = document.getElementById('editItemModal');
  const title = document.getElementById('editItemModalTitle');
  const body = document.getElementById('editItemModalBody');
  const submitBtn = document.getElementById('editItemSubmitBtn');

  title.textContent = '在庫調整（減少）';

  // 資材選択プルダウンを生成
  const itemOptions = allItems.map(item =>
    `<option value="${item.id}">${escapeHtml(item.name)} (現在庫: ${item.currentStock})</option>`
  ).join('');

  body.innerHTML = `
    <div class="mb-3">
      <label class="form-label">梱包資材</label>
      <select class="form-select" id="adjustMaterialId" style="font-size:16px;">
        <option value="">-- 選択してください --</option>
        ${itemOptions}
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">減少数量</label>
      <input type="number" class="form-control" id="adjustQuantity" min="1" value="1" style="font-size:16px;">
      <small class="text-muted">※新しいロットから自動的に減少します（LIFO）</small>
    </div>
    <div class="mb-3">
      <label class="form-label">理由</label>
      <select class="form-select" id="adjustReason" style="font-size:16px;">
        <option value="damaged">破損</option>
        <option value="lost">紛失</option>
        <option value="discarded">廃棄</option>
        <option value="other">その他</option>
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">備考（任意）</label>
      <input type="text" class="form-control" id="adjustNotes" placeholder="詳細メモ" style="font-size:16px;">
    </div>
  `;

  submitBtn.textContent = '在庫調整';
  submitBtn.onclick = processStockAdjustment;

  modal.classList.remove('hidden');
};

/**
 * 在庫調整処理を実行（LIFO）
 */
async function processStockAdjustment() {
  const materialIdSelect = document.getElementById('adjustMaterialId');
  const quantityInput = document.getElementById('adjustQuantity');
  const reasonSelect = document.getElementById('adjustReason');
  const notesInput = document.getElementById('adjustNotes');

  const materialId = materialIdSelect?.value;
  const quantity = parseInt(quantityInput?.value, 10) || 0;
  const reason = reasonSelect?.value || 'other';
  const notes = notesInput?.value?.trim() || '';

  if (!materialId) {
    alert('梱包資材を選択してください');
    materialIdSelect.focus();
    return;
  }

  if (quantity <= 0) {
    alert('減少数量は1以上を入力してください');
    quantityInput.focus();
    return;
  }

  // 確認ダイアログ
  const materialName = materialIdSelect.options[materialIdSelect.selectedIndex]?.text || '';
  if (!confirm(`「${materialName}」の在庫を${quantity}個減少させます。\nよろしいですか？`)) {
    return;
  }

  try {
    // 1. LIFO方式でロットから在庫を調整
    const adjusted = await adjustStockLIFO(materialId, quantity, reason);

    // 2. トランザクション記録を作成
    const transactionData = {
      materialId: materialId,
      type: 'adjustment',
      quantity: -quantity,  // マイナスで記録
      reason: reason,
      notes: notes,
      adjustedLots: adjusted,  // どのロットを調整したか記録
      createdBy: window.currentUser?.name || 'unknown',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await window.db.collection('packagingTransactions').add(transactionData);

    // 3. 合計在庫を計算してmaterialに反映（互換性のため）
    const newTotalStock = await getTotalStock(materialId);
    await window.db.collection('packagingMaterials').doc(materialId).update({
      currentStock: newTotalStock,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 4. モーダルを閉じてUI更新
    hideEditItemModal();
    await renderPackagingDropdownUI();
    showToast(`在庫を調整しました（-${quantity}）`);

    console.log(`✅ [Stock Adjustment LIFO] ${materialId}: -${quantity}`);

  } catch (error) {
    console.error('在庫調整エラー:', error);
    alert('在庫調整に失敗しました: ' + error.message);
  }
}


// ============================================
// Phase 3: 発注管理機能
// ============================================

/**
 * 発注登録モーダルを表示
 */
window.showOrderModal = function() {
  const allItems = window._currentPackagingAllItems || [];
  if (allItems.length === 0) {
    alert('先に梱包資材を登録してください');
    return;
  }

  const modal = document.getElementById('editItemModal');
  const title = document.getElementById('editItemModalTitle');
  const body = document.getElementById('editItemModalBody');
  const submitBtn = document.getElementById('editItemSubmitBtn');

  title.textContent = '発注登録';

  // 資材選択プルダウンを生成（在庫が少ないものを優先表示）
  const sortedItems = [...allItems].sort((a, b) => {
    // 在庫が閾値以下のものを優先
    const aLow = a.currentStock <= a.stockAlertThreshold;
    const bLow = b.currentStock <= b.stockAlertThreshold;
    if (aLow && !bLow) return -1;
    if (!aLow && bLow) return 1;
    return a.currentStock - b.currentStock;
  });

  const itemOptions = sortedItems.map(item => {
    const stockStatus = item.currentStock <= item.stockAlertThreshold ? '⚠️ ' : '';
    return `<option value="${item.id}" data-supplier="${escapeHtml(item.supplier || '')}">${stockStatus}${escapeHtml(item.name)} (在庫: ${item.currentStock})</option>`;
  }).join('');

  body.innerHTML = `
    <div class="mb-3">
      <label class="form-label">梱包資材</label>
      <select class="form-select" id="orderMaterialId" style="font-size:16px;" onchange="onOrderMaterialChange()">
        <option value="">-- 選択してください --</option>
        ${itemOptions}
      </select>
    </div>
    <div class="mb-3">
      <label class="form-label">発注数</label>
      <input type="number" class="form-control" id="orderQuantity" min="1" value="10" style="font-size:16px;">
    </div>
    <div class="mb-3">
      <label class="form-label">発注先</label>
      <input type="text" class="form-control" id="orderSupplier" placeholder="例: Amazon, モノタロウ" style="font-size:16px;">
    </div>
    <div class="mb-3">
      <label class="form-label">備考（任意）</label>
      <input type="text" class="form-control" id="orderNotes" placeholder="メモ" style="font-size:16px;">
    </div>
  `;

  submitBtn.textContent = '発注登録';
  submitBtn.onclick = processOrder;

  modal.classList.remove('hidden');
};

/**
 * 発注資材変更時の処理（発注先を自動入力）
 */
window.onOrderMaterialChange = function() {
  const select = document.getElementById('orderMaterialId');
  const supplierInput = document.getElementById('orderSupplier');
  const selectedOption = select.options[select.selectedIndex];

  if (selectedOption && selectedOption.dataset.supplier) {
    supplierInput.value = selectedOption.dataset.supplier;
  }
};

/**
 * 発注処理を実行
 */
async function processOrder() {
  const materialIdSelect = document.getElementById('orderMaterialId');
  const quantityInput = document.getElementById('orderQuantity');
  const supplierInput = document.getElementById('orderSupplier');
  const notesInput = document.getElementById('orderNotes');

  const materialId = materialIdSelect?.value;
  const quantity = parseInt(quantityInput?.value, 10) || 0;
  const supplier = supplierInput?.value?.trim() || '';
  const notes = notesInput?.value?.trim() || '';

  if (!materialId) {
    alert('梱包資材を選択してください');
    materialIdSelect.focus();
    return;
  }

  if (quantity <= 0) {
    alert('発注数は1以上を入力してください');
    quantityInput.focus();
    return;
  }

  try {
    // 発注記録を作成
    const orderData = {
      materialId: materialId,
      quantity: quantity,
      supplier: supplier,
      status: 'ordered',  // ordered | received | cancelled
      orderedAt: firebase.firestore.FieldValue.serverTimestamp(),
      receivedAt: null,
      notes: notes,
      createdBy: window.currentUser?.name || 'unknown'
    };

    await window.db.collection('packagingOrders').add(orderData);

    hideEditItemModal();
    showToast(`発注しました（${quantity}個）`);

    console.log(`✅ [Order] 発注登録: ${materialId}, 数量: ${quantity}`);

  } catch (error) {
    console.error('発注処理エラー:', error);
    alert('発注処理に失敗しました: ' + error.message);
  }
}

/**
 * 発注履歴モーダルを表示
 */
window.showOrderHistoryModal = async function() {
  const modal = document.getElementById('editItemModal');
  const title = document.getElementById('editItemModalTitle');
  const body = document.getElementById('editItemModalBody');
  const submitBtn = document.getElementById('editItemSubmitBtn');

  title.textContent = '発注履歴';

  body.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div> 読み込み中...</div>';

  submitBtn.textContent = '閉じる';
  submitBtn.onclick = hideEditItemModal;

  modal.classList.remove('hidden');

  try {
    // 最新30件の発注履歴を取得
    const snapshot = await window.db.collection('packagingOrders')
      .orderBy('orderedAt', 'desc')
      .limit(30)
      .get();

    if (snapshot.empty) {
      body.innerHTML = '<div class="text-center py-3 text-muted">発注履歴がありません</div>';
      return;
    }

    // 資材ID→名前のマップを作成
    const allItems = window._currentPackagingAllItems || [];
    const itemNameMap = {};
    allItems.forEach(item => {
      itemNameMap[item.id] = item.name;
    });

    const statusLabels = {
      ordered: { text: '発注中', color: 'warning' },
      received: { text: '入荷済', color: 'success' },
      cancelled: { text: 'キャンセル', color: 'secondary' }
    };

    const rows = snapshot.docs.map(doc => {
      const data = doc.data();
      const materialName = itemNameMap[data.materialId] || '(削除済み)';
      const status = statusLabels[data.status] || { text: data.status, color: 'secondary' };
      const dateStr = data.orderedAt?.toDate?.()?.toLocaleDateString('ja-JP') || '';
      const isOrdered = data.status === 'ordered';

      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #eee;">
          <div style="flex:1;">
            <div style="font-weight:500;">${escapeHtml(materialName)}</div>
            <div style="font-size:12px;color:#888;">
              ${data.quantity}個 | ${escapeHtml(data.supplier || '発注先なし')} | ${dateStr}
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="badge bg-${status.color}">${status.text}</span>
            ${isOrdered ? `
              <button class="btn btn-sm btn-success" onclick="processReceiveOrder('${doc.id}', '${data.materialId}', ${data.quantity})">
                <i class="bi bi-check"></i> 入荷
              </button>
              <button class="btn btn-sm btn-outline-danger" onclick="cancelOrder('${doc.id}')">
                <i class="bi bi-x"></i>
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = `<div style="max-height:400px;overflow-y:auto;">${rows}</div>`;

  } catch (error) {
    console.error('発注履歴取得エラー:', error);
    body.innerHTML = `<div class="text-danger">読み込みエラー: ${error.message}</div>`;
  }
};

/**
 * 発注を入荷処理（発注→入庫連携）
 */
window.processReceiveOrder = async function(orderId, materialId, quantity) {
  if (!confirm(`${quantity}個を入荷処理しますか？`)) return;

  try {
    // 1. 発注ステータスを更新
    await window.db.collection('packagingOrders').doc(orderId).update({
      status: 'received',
      receivedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 2. 入庫トランザクション作成
    const transactionData = {
      materialId: materialId,
      type: 'in',
      quantity: quantity,
      reason: 'purchase',
      notes: '発注入荷',
      createdBy: window.currentUser?.name || 'unknown',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await window.db.collection('packagingTransactions').add(transactionData);

    // 3. 在庫数を更新
    const materialRef = window.db.collection('packagingMaterials').doc(materialId);
    const materialDoc = await materialRef.get();
    const currentStock = materialDoc.data()?.currentStock || 0;
    const newStock = currentStock + quantity;

    await materialRef.update({
      currentStock: newStock,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    // 4. UI更新
    await showOrderHistoryModal();  // 履歴を再読み込み
    showToast(`入荷しました（+${quantity}）`);

    console.log(`✅ [Receive] 入荷処理: ${materialId}, ${currentStock} → ${newStock}`);

  } catch (error) {
    console.error('入荷処理エラー:', error);
    alert('入荷処理に失敗しました: ' + error.message);
  }
};

/**
 * 発注をキャンセル
 */
window.cancelOrder = async function(orderId) {
  if (!confirm('この発注をキャンセルしますか？')) return;

  try {
    await window.db.collection('packagingOrders').doc(orderId).update({
      status: 'cancelled'
    });

    await showOrderHistoryModal();  // 履歴を再読み込み
    showToast('発注をキャンセルしました');

  } catch (error) {
    console.error('キャンセルエラー:', error);
    alert('キャンセルに失敗しました: ' + error.message);
  }
};


// ============================================
// Phase 4: アラート機能
// ============================================

/**
 * 低在庫アラート一覧を表示
 */
window.showLowStockAlert = function() {
  const allItems = window._currentPackagingAllItems || [];

  // 低在庫アイテムを抽出（在庫0を最優先、次に閾値以下）
  const lowStockItems = allItems
    .filter(item => item.currentStock <= item.stockAlertThreshold)
    .sort((a, b) => a.currentStock - b.currentStock);

  const modal = document.getElementById('editItemModal');
  const title = document.getElementById('editItemModalTitle');
  const body = document.getElementById('editItemModalBody');
  const submitBtn = document.getElementById('editItemSubmitBtn');

  title.textContent = `要発注アラート（${lowStockItems.length}件）`;

  if (lowStockItems.length === 0) {
    body.innerHTML = '<div class="text-center py-3 text-success"><i class="bi bi-check-circle"></i> 在庫は十分です</div>';
  } else {
    const rows = lowStockItems.map(item => {
      const isZero = item.currentStock <= 0;
      const statusClass = isZero ? 'danger' : 'warning';
      const statusIcon = isZero ? 'bi-exclamation-triangle-fill' : 'bi-exclamation-circle-fill';
      const statusText = isZero ? '在庫切れ' : '在庫少';

      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid #eee;">
          <div style="flex:1;">
            <div style="display:flex;align-items:center;gap:8px;">
              <i class="bi ${statusIcon} text-${statusClass}"></i>
              <span style="font-weight:500;">${escapeHtml(item.name)}</span>
              <span class="badge bg-${statusClass}">${statusText}</span>
            </div>
            <div style="font-size:12px;color:#888;margin-top:4px;">
              現在庫: ${item.currentStock} / 閾値: ${item.stockAlertThreshold}
              ${item.supplier ? ` | 発注先: ${escapeHtml(item.supplier)}` : ''}
            </div>
          </div>
          <button class="btn btn-sm btn-primary" onclick="quickOrder('${item.id}', '${escapeHtml(item.name)}', '${escapeHtml(item.supplier || '')}')">
            <i class="bi bi-cart-plus"></i> 発注
          </button>
        </div>
      `;
    }).join('');

    body.innerHTML = `<div style="max-height:400px;overflow-y:auto;">${rows}</div>`;
  }

  submitBtn.textContent = '閉じる';
  submitBtn.onclick = hideEditItemModal;

  modal.classList.remove('hidden');
};

/**
 * クイック発注（アラート一覧から直接発注）
 */
window.quickOrder = async function(materialId, materialName, supplier) {
  const quantity = prompt(`「${materialName}」の発注数を入力してください:`, '10');
  if (!quantity) return;

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    alert('有効な数量を入力してください');
    return;
  }

  try {
    const orderData = {
      materialId: materialId,
      quantity: qty,
      supplier: supplier,
      status: 'ordered',
      orderedAt: firebase.firestore.FieldValue.serverTimestamp(),
      receivedAt: null,
      notes: 'アラートから発注',
      createdBy: window.currentUser?.name || 'unknown'
    };

    await window.db.collection('packagingOrders').add(orderData);

    hideEditItemModal();
    showToast(`「${materialName}」を${qty}個発注しました`);

  } catch (error) {
    console.error('クイック発注エラー:', error);
    alert('発注に失敗しました: ' + error.message);
  }
};


// ============================================
// Phase 5: プリセット機能
// ============================================

/**
 * プリセット管理モーダルを表示
 */
window.showPresetModal = async function() {
  const modal = document.getElementById('editItemModal');
  const title = document.getElementById('editItemModalTitle');
  const body = document.getElementById('editItemModalBody');
  const submitBtn = document.getElementById('editItemSubmitBtn');

  title.textContent = 'プリセット管理';

  body.innerHTML = '<div class="text-center py-3"><div class="spinner-border spinner-border-sm"></div> 読み込み中...</div>';

  submitBtn.textContent = '新規作成';
  submitBtn.onclick = showPresetCreateForm;

  modal.classList.remove('hidden');

  try {
    // プリセット一覧を取得
    const snapshot = await window.db.collection('packagingPresets')
      .orderBy('name')
      .get();

    // 資材ID→名前のマップを作成
    const allItems = window._currentPackagingAllItems || [];
    const itemNameMap = {};
    allItems.forEach(item => {
      itemNameMap[item.id] = item.name;
    });

    if (snapshot.empty) {
      body.innerHTML = `
        <div class="text-center py-3 text-muted">
          <i class="bi bi-collection" style="font-size:2rem;"></i>
          <p class="mt-2">プリセットがありません</p>
          <p class="small">よく使う梱包資材の組み合わせを登録しておくと便利です</p>
        </div>
      `;
      return;
    }

    const rows = snapshot.docs.map(doc => {
      const data = doc.data();
      const materialsList = (data.materials || []).map(m => {
        const name = itemNameMap[m.materialId] || '(削除済み)';
        return `${name}×${m.quantity}`;
      }).join(', ');

      return `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 0;border-bottom:1px solid #eee;">
          <div style="flex:1;">
            <div style="font-weight:500;"><i class="bi bi-collection"></i> ${escapeHtml(data.name)}</div>
            <div style="font-size:12px;color:#888;margin-top:4px;">${materialsList || '資材なし'}</div>
          </div>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-sm btn-outline-primary" onclick="editPreset('${doc.id}')">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-sm btn-outline-danger" onclick="deletePreset('${doc.id}', '${escapeHtml(data.name)}')">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </div>
      `;
    }).join('');

    body.innerHTML = `<div style="max-height:400px;overflow-y:auto;">${rows}</div>`;

  } catch (error) {
    console.error('プリセット取得エラー:', error);
    body.innerHTML = `<div class="text-danger">読み込みエラー: ${error.message}</div>`;
  }
};

/**
 * プリセット作成フォームを表示
 */
window.showPresetCreateForm = function() {
  const allItems = window._currentPackagingAllItems || [];

  const modal = document.getElementById('editItemModal');
  const title = document.getElementById('editItemModalTitle');
  const body = document.getElementById('editItemModalBody');
  const submitBtn = document.getElementById('editItemSubmitBtn');

  title.textContent = 'プリセット作成';

  // 資材選択チェックボックスを生成
  const checkboxes = allItems.map(item => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;">
      <input type="checkbox" id="preset_${item.id}" class="form-check-input" data-material-id="${item.id}">
      <label for="preset_${item.id}" style="flex:1;margin:0;">${escapeHtml(item.name)}</label>
      <input type="number" id="preset_qty_${item.id}" class="form-control form-control-sm" 
             style="width:60px;font-size:16px;" value="1" min="1" placeholder="数量">
    </div>
  `).join('');

  body.innerHTML = `
    <div class="mb-3">
      <label class="form-label">プリセット名</label>
      <input type="text" class="form-control" id="presetName" placeholder="例: 衣類梱包セット" style="font-size:16px;">
    </div>
    <div class="mb-3">
      <label class="form-label">含める資材（チェックして数量を指定）</label>
      <div style="max-height:250px;overflow-y:auto;border:1px solid #ddd;border-radius:4px;padding:8px;">
        ${checkboxes}
      </div>
    </div>
  `;

  submitBtn.textContent = '作成';
  submitBtn.onclick = saveNewPreset;
};

/**
 * 新規プリセットを保存
 */
async function saveNewPreset() {
  const nameInput = document.getElementById('presetName');
  const name = nameInput?.value?.trim();

  if (!name) {
    alert('プリセット名を入力してください');
    nameInput.focus();
    return;
  }

  // チェックされた資材を収集
  const materials = [];
  const checkboxes = document.querySelectorAll('input[type="checkbox"][data-material-id]:checked');

  checkboxes.forEach(cb => {
    const materialId = cb.dataset.materialId;
    const qtyInput = document.getElementById(`preset_qty_${materialId}`);
    const quantity = parseInt(qtyInput?.value, 10) || 1;

    materials.push({ materialId, quantity });
  });

  if (materials.length === 0) {
    alert('少なくとも1つの資材を選択してください');
    return;
  }

  try {
    const presetData = {
      name: name,
      materials: materials,
      createdBy: window.currentUser?.name || 'unknown',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await window.db.collection('packagingPresets').add(presetData);

    showToast('プリセットを作成しました');
    await showPresetModal();  // 一覧を再表示

  } catch (error) {
    console.error('プリセット作成エラー:', error);
    alert('プリセット作成に失敗しました: ' + error.message);
  }
}

/**
 * プリセットを編集
 */
window.editPreset = async function(presetId) {
  try {
    const doc = await window.db.collection('packagingPresets').doc(presetId).get();
    if (!doc.exists) {
      alert('プリセットが見つかりません');
      return;
    }

    const preset = doc.data();
    const allItems = window._currentPackagingAllItems || [];

    const modal = document.getElementById('editItemModal');
    const title = document.getElementById('editItemModalTitle');
    const body = document.getElementById('editItemModalBody');
    const submitBtn = document.getElementById('editItemSubmitBtn');

    title.textContent = 'プリセット編集';

    // 既存の資材選択状態を反映
    const existingMaterials = {};
    (preset.materials || []).forEach(m => {
      existingMaterials[m.materialId] = m.quantity;
    });

    const checkboxes = allItems.map(item => {
      const isChecked = existingMaterials[item.id] !== undefined;
      const qty = existingMaterials[item.id] || 1;

      return `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;">
          <input type="checkbox" id="preset_${item.id}" class="form-check-input" 
                 data-material-id="${item.id}" ${isChecked ? 'checked' : ''}>
          <label for="preset_${item.id}" style="flex:1;margin:0;">${escapeHtml(item.name)}</label>
          <input type="number" id="preset_qty_${item.id}" class="form-control form-control-sm" 
                 style="width:60px;font-size:16px;" value="${qty}" min="1" placeholder="数量">
        </div>
      `;
    }).join('');

    body.innerHTML = `
      <div class="mb-3">
        <label class="form-label">プリセット名</label>
        <input type="text" class="form-control" id="presetName" value="${escapeHtml(preset.name)}" style="font-size:16px;">
      </div>
      <div class="mb-3">
        <label class="form-label">含める資材</label>
        <div style="max-height:250px;overflow-y:auto;border:1px solid #ddd;border-radius:4px;padding:8px;">
          ${checkboxes}
        </div>
      </div>
    `;

    submitBtn.textContent = '更新';
    submitBtn.onclick = () => updatePreset(presetId);

  } catch (error) {
    console.error('プリセット編集エラー:', error);
    alert('プリセット読み込みに失敗しました: ' + error.message);
  }
};

/**
 * プリセットを更新
 */
async function updatePreset(presetId) {
  const nameInput = document.getElementById('presetName');
  const name = nameInput?.value?.trim();

  if (!name) {
    alert('プリセット名を入力してください');
    nameInput.focus();
    return;
  }

  const materials = [];
  const checkboxes = document.querySelectorAll('input[type="checkbox"][data-material-id]:checked');

  checkboxes.forEach(cb => {
    const materialId = cb.dataset.materialId;
    const qtyInput = document.getElementById(`preset_qty_${materialId}`);
    const quantity = parseInt(qtyInput?.value, 10) || 1;

    materials.push({ materialId, quantity });
  });

  if (materials.length === 0) {
    alert('少なくとも1つの資材を選択してください');
    return;
  }

  try {
    await window.db.collection('packagingPresets').doc(presetId).update({
      name: name,
      materials: materials,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    showToast('プリセットを更新しました');
    await showPresetModal();

  } catch (error) {
    console.error('プリセット更新エラー:', error);
    alert('プリセット更新に失敗しました: ' + error.message);
  }
}

/**
 * プリセットを削除
 */
window.deletePreset = async function(presetId, presetName) {
  if (!confirm(`プリセット「${presetName}」を削除しますか？`)) return;

  try {
    await window.db.collection('packagingPresets').doc(presetId).delete();

    showToast('プリセットを削除しました');
    await showPresetModal();

  } catch (error) {
    console.error('プリセット削除エラー:', error);
    alert('プリセット削除に失敗しました: ' + error.message);
  }
};

/**
 * プリセット適用（販売記録用 - 外部から呼び出し）
 * @param {string} presetId - プリセットID
 * @returns {Array} 資材リスト [{materialId, quantity, name}]
 */
window.getPresetMaterials = async function(presetId) {
  try {
    const doc = await window.db.collection('packagingPresets').doc(presetId).get();
    if (!doc.exists) return [];

    const preset = doc.data();
    const materials = preset.materials || [];

    // 資材名を付与
    const allItems = window._currentPackagingAllItems || [];
    const itemNameMap = {};
    allItems.forEach(item => {
      itemNameMap[item.id] = { name: item.name, unitCost: item.price / (item.quantity || 1) };
    });

    return materials.map(m => ({
      materialId: m.materialId,
      quantity: m.quantity,
      name: itemNameMap[m.materialId]?.name || '不明',
      unitCost: itemNameMap[m.materialId]?.unitCost || 0
    }));

  } catch (error) {
    console.error('プリセット取得エラー:', error);
    return [];
  }
};

/**
 * 梱包資材を削除
 */
window.deletePackagingItem = async function(itemId) {
  const allItems = window._currentPackagingAllItems || [];
  const item = allItems.find(i => i.id === itemId);
  if (!item) return;

  if (!confirm(`「${item.name}」を削除しますか？`)) return;

  try {
    await window.db.collection(currentMasterConfig.collection).doc(itemId).delete();

    await renderPackagingDropdownUI();
    showToast('削除しました');
  } catch (error) {
    console.error('削除エラー:', error);
    alert('削除に失敗しました: ' + error.message);
  }
};

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

  // masterOptionsタイプの場合は専用UIを再描画
  if (currentMasterConfig.type === 'masterOptions') {
    await renderMasterOptionsUI();
    return;
  }

  // simpleListタイプの場合は専用UIを再描画
  if (currentMasterConfig.type === 'simpleList') {
    await renderSimpleListUI();
    return;
  }

  // shippingDropdownタイプの場合は専用UIを再描画
  if (currentMasterConfig.type === 'shippingDropdown') {
    currentShippingCategoryIndex = 0; // カテゴリ選択をリセット
    await renderShippingDropdownUI();
    return;
  }

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

    // プラットフォームでフィルタリング
    // メルカリとメルカリShopsはカテゴリを共有
    const mercariGroup = ['mercari', 'mercari-shops'];
    const isMercariGroup = mercariGroup.includes(currentPlatform);

    let filtered;
    if (currentMasterConfig.collection === 'categories' && isMercariGroup) {
      // メルカリ/メルカリShopsはカテゴリ共通（platformなし = メルカリ共通）
      filtered = categories.filter(cat => {
        const catPlatform = cat.platform;
        // platformがない、またはメルカリグループのものを表示
        return !catPlatform || mercariGroup.includes(catPlatform);
      });
      console.log(`📊 [Master Manager] カテゴリ: メルカリ共通 ${filtered.length}件`);
    } else {
      // 他のプラットフォーム、または他のマスタはプラットフォームでフィルタリング
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
    countEl.innerHTML = `<i class="bi bi-database"></i> ${masterTotalCount.toLocaleString()}件`;
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
  // simpleList、categoryWords等の特殊タイプは専用フィルターを使用
  const specialTypes = ['simpleList', 'categoryWords', 'categoryWordsDropdown', 'shippingDropdown', 'masterOptions', 'masterOptionsDropdown'];
  if (currentMasterConfig && specialTypes.includes(currentMasterConfig.type)) {
    console.log(`🔍 [Master Manager] 特殊タイプ検索: ${currentMasterConfig.type}, クエリ: "${query}"`);
    handleGlobalFilter(query);
    return;
  }

  const collection = currentMasterConfig.collection;

  if (query.length > 0) {
    console.log(`🔍 [Master Manager] 検索実行: "${query}"`);

    // ひらがなをカタカナに変換
    const katakanaQuery = hiraganaToKatakana(query);

    if (masterCache[collection] && masterCache[collection].length > 0) {
      // ✅ メモリキャッシュから検索（最速）
      console.log('⚡ [Master Manager] メモリキャッシュから検索');
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
      console.log(`✅ [Master Manager] メモリキャッシュ検索結果: ${results.length}件`);
    } else if (collection === 'brands' && window.masterCacheManager && window.masterCacheManager.searchBrandsFromCache) {
      // ✅ ブランド: IndexedDBキャッシュから検索（高速）
      console.log('⚡ [Master Manager] IndexedDBキャッシュからブランド検索');
      showLoading(true);
      try {
        const results = await window.masterCacheManager.searchBrandsFromCache(
          katakanaQuery,
          currentMasterConfig.maxDisplayResults || 100
        );
        allMasterData = results || [];
        filteredMasterData = results || [];
        console.log(`✅ [Master Manager] IndexedDB検索結果: ${allMasterData.length}件`);

        // 統計情報を即時更新（検索結果件数を表示）
        const statsText = document.getElementById('statsText');
        if (statsText && results && results.length > 0) {
          statsText.textContent = `検索結果: ${results.length.toLocaleString()}件`;
        }
      } catch (error) {
        console.error('❌ [Master Manager] IndexedDB検索エラー:', error);
        // フォールバック: Firestore検索
        console.log('📡 [Master Manager] フォールバック: Firestore検索');
        try {
          const results = await window.searchMaster(
            collection,
            query,
            currentMasterConfig.searchFields || [],
            currentMasterConfig.maxDisplayResults || 100
          );
          allMasterData = results || [];
          filteredMasterData = results || [];
        } catch (e) {
          allMasterData = [];
          filteredMasterData = [];
        }
      } finally {
        showLoading(false);
      }
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
    // 検索クエリなし
    const initialDisplay = currentMasterConfig.initialDisplay !== undefined
      ? currentMasterConfig.initialDisplay
      : (currentMasterConfig.maxDisplayResults || 100);

    // ツリービュー（カテゴリ）は検索クリア時もツリーを表示
    if (currentMasterConfig.viewMode === 'tree') {
      console.log('🔄 [Master Manager] 検索クリア（ツリービュー: 全データ復元）');
      const cachedData = masterCache[collection] || [];

      if (cachedData.length > 0) {
        allMasterData = cachedData;
        filteredMasterData = [...cachedData];
      } else {
        // キャッシュが空の場合はデータを再読み込み
        console.log('🔄 [Master Manager] キャッシュ空のため再読み込み');
        if (currentMasterConfig.platformSupport) {
          await fetchAndDisplayTotalCountByPlatform();
        } else {
          await loadMasterData();
        }
        return; // 上記関数がrenderMasterListを呼ぶので早期リターン
      }
    } else if (initialDisplay === 0) {
      // 検索専用モード（ブランド等）: 空表示
      console.log('🔄 [Master Manager] 検索クリア（検索専用モード）');
      allMasterData = [];
      filteredMasterData = [];
    } else {
      // 通常モード: キャッシュから全データ復元
      console.log('🔄 [Master Manager] 検索クリア（全データ復元）');
      const cachedData = masterCache[collection] || [];

      if (cachedData.length > 0) {
        allMasterData = cachedData;
        filteredMasterData = [...cachedData];
      } else {
        await loadMasterData();
        return;
      }
    }
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

    // 空状態での新規追加ボタン表示制御
    const actionBarAddBtnEmpty = document.querySelector('.action-bar .btn-add:not(#categoryAddBtn)');
    const categoryAddBtnEmpty = document.getElementById('categoryAddBtn');
    if (currentMasterConfig?.viewMode === 'tree') {
      // ツリービューでは汎用追加ボタンを非表示、カテゴリ追加ボタンを表示
      if (actionBarAddBtnEmpty) actionBarAddBtnEmpty.style.display = 'none';
      if (categoryAddBtnEmpty) categoryAddBtnEmpty.style.display = 'flex';
    } else {
      // 非ツリービューでは汎用追加ボタンを表示、カテゴリ追加ボタンを非表示
      if (actionBarAddBtnEmpty) actionBarAddBtnEmpty.style.display = 'flex';
      if (categoryAddBtnEmpty) categoryAddBtnEmpty.style.display = 'none';
    }

    return;
  }

  // リスト表示
  container.classList.remove('hidden');
  emptyState.classList.add('hidden');

  // viewModeに応じた表示方式を選択
  const actionBarAddBtn = document.querySelector('.action-bar .btn-add:not(#categoryAddBtn)');
  const categoryAddBtn = document.getElementById('categoryAddBtn');

  if (currentMasterConfig.viewMode === 'tree') {
    // ツリービュー表示（カテゴリ用）
    renderCategoryTreeView(container);
    // 汎用追加ボタンを非表示、カテゴリ追加ボタンを表示
    if (actionBarAddBtn) actionBarAddBtn.style.display = 'none';
    if (categoryAddBtn) categoryAddBtn.style.display = 'flex';
  } else if (currentMasterConfig.groupBy) {
    // アコーディオン表示
    renderAccordionList(container);
    // 汎用追加ボタンを表示、カテゴリ追加ボタンを非表示
    if (actionBarAddBtn) actionBarAddBtn.style.display = 'flex';
    if (categoryAddBtn) categoryAddBtn.style.display = 'none';
  } else {
    // 従来のフラットリスト表示
    renderFlatList(container);
    // 汎用追加ボタンを表示、カテゴリ追加ボタンを非表示
    if (actionBarAddBtn) actionBarAddBtn.style.display = 'flex';
    if (categoryAddBtn) categoryAddBtn.style.display = 'none';
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

  // ルートカテゴリ追加ボタンはアクションバーに移動済み

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

    // 結果があるノードのみ展開（count > 0）
    if (node.count > 0) {
      expandedTreeNodes.add(nodePath);

      if (Object.keys(node.children).length > 0) {
        expandAllTreeNodes(node.children, nodePath);
      }
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

    // ケバブメニューボタン（編集・コピー・削除）
    const kebabBtnHtml = `
      <div class="tree-kebab-wrapper" style="position: relative;">
        <button class="tree-kebab-btn" data-path="${escapeHtml(nodePath)}" data-level="${level}" data-name="${escapeHtml(key)}" title="メニュー">
          <i class="bi bi-three-dots-vertical"></i>
        </button>
        <div class="tree-kebab-dropdown">
          <button class="tree-kebab-item" data-action="edit"><i class="bi bi-pencil"></i>編集</button>
          <button class="tree-kebab-item" data-action="copy"><i class="bi bi-copy"></i>コピー</button>
          <button class="tree-kebab-item danger" data-action="delete"><i class="bi bi-trash"></i>削除</button>
        </div>
      </div>
    `;

    nodeHeader.innerHTML = `
      <div class="tree-node-content">
        ${hasChildren || hasItems ? `<i class="bi ${isExpanded ? 'bi-chevron-down' : 'bi-chevron-right'} toggle-icon"></i>` : '<span class="tree-spacer"></span>'}
        <span class="tree-node-name">${escapeHtml(key)}</span>
        <span class="tree-node-count">(${node.count}件)</span>
      </div>
      <div class="tree-node-actions">
        ${addBtnHtml}
        ${kebabBtnHtml}
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

    // ケバブメニューのイベント
    const kebabBtn = nodeHeader.querySelector('.tree-kebab-btn');
    const kebabDropdown = nodeHeader.querySelector('.tree-kebab-dropdown');
    if (kebabBtn && kebabDropdown) {
      kebabBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        // 他のドロップダウンを閉じる
        document.querySelectorAll('.tree-kebab-dropdown.show').forEach(d => {
          if (d !== kebabDropdown) d.classList.remove('show');
        });
        kebabDropdown.classList.toggle('show');
      });

      // メニュー項目のクリック
      kebabDropdown.querySelectorAll('.tree-kebab-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const action = item.getAttribute('data-action');
          kebabDropdown.classList.remove('show');
          handleTreeNodeAction(action, nodePath, key, currentPathArray, node);
        });
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
 * ルートカテゴリ追加フォームを表示（ツリー最上部用）
 * アクションバーから呼び出されるため、グローバル関数として公開
 */
window.showRootCategoryAddForm = function() {
  // treeWrapperを自動検出
  const treeWrapper = document.querySelector('.category-tree-wrapper');
  if (!treeWrapper) {
    console.warn('カテゴリツリーが見つかりません');
    return;
  }

  // 既存のインラインフォームがあれば削除
  const existingForm = document.querySelector('.tree-inline-add-form');
  if (existingForm) {
    existingForm.remove();
  }

  // インラインフォームを作成
  const formContainer = document.createElement('div');
  formContainer.className = 'tree-inline-add-form';
  formContainer.style.marginLeft = '0'; // ルートレベルなのでインデントなし
  formContainer.innerHTML = `
    <div class="inline-form-header">
      <span class="inline-form-path">新規カテゴリを追加</span>
      <button class="inline-form-close" title="閉じる"><i class="bi bi-x"></i></button>
    </div>
    <div class="inline-form-body">
      <textarea class="inline-form-input" placeholder="追加するカテゴリ名を入力（複数行で一括追加可能）" rows="3"></textarea>
      <div class="inline-form-hint">1行に1つずつ入力すると一括追加できます（例: ファッション、家電、スポーツ）</div>
      <div class="inline-form-actions">
        <button class="inline-form-cancel">キャンセル</button>
        <button class="inline-form-submit">追加する</button>
      </div>
    </div>
  `;

  // ツリーの先頭に挿入
  treeWrapper.prepend(formContainer);

  // フォーカス
  const textarea = formContainer.querySelector('.inline-form-input');
  textarea.focus();

  // テキストエリアの高さを自動調整
  const autoResizeTextarea = () => {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, 200);
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
    if (submitBtn.disabled) return;
    submitBtn.disabled = true;
    submitBtn.textContent = '追加中...';

    const inputValue = textarea.value.trim();
    if (!inputValue) {
      showToast('カテゴリ名を入力してください', 'warning');
      submitBtn.disabled = false;
      submitBtn.textContent = '追加する';
      return;
    }

    // 複数行対応
    const newValues = inputValue.split('\n').map(v => v.trim()).filter(v => v.length > 0);
    if (newValues.length === 0) {
      showToast('カテゴリ名を入力してください', 'warning');
      submitBtn.disabled = false;
      submitBtn.textContent = '追加する';
      return;
    }

    // ルートレベルに追加（pathArray = []）
    await addTreeItems([], newValues, false);
    formContainer.remove();
  });

  // Escapeキーでキャンセル
  textarea.addEventListener('keydown', (e) => {
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

  const categories = masterCache[currentMasterConfig.collection] || [];
  const itemsToAdd = [];
  let duplicateCount = 0;

  // ステップ1: 追加対象のアイテムを準備（重複チェック含む）
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
    
    // platformId設定（削除・フィルタリング用 - 必須）
    const activePlatformId = currentPlatform || 'mercari';
    newItem.platformId = activePlatformId;
    newItem.platform = activePlatformId;
    console.log(`[addTreeItems] platformId設定: ${activePlatformId}`);

    // 重複チェック
    const isDuplicate = categories.some(cat => cat.fullPath === newItem.fullPath);
    if (isDuplicate) {
      duplicateCount++;
      continue;
    }

    itemsToAdd.push(newItem);
  }

  // 追加対象がない場合は早期リターン
  if (itemsToAdd.length === 0) {
    if (duplicateCount > 0) {
      showToast(`すべて重複のため追加されませんでした（${duplicateCount}件）`, 'warning');
    }
    return;
  }

  // ステップ2: Firestoreに並列書き込み（高速化）
  console.log(`[addTreeItems] ${itemsToAdd.length}件を並列でFirestoreに書き込み開始...`);
  
  const writePromises = itemsToAdd.map(async (newItem) => {
    try {
      const docRef = await firebase.firestore()
        .collection(currentMasterConfig.collection)
        .add({
          ...newItem,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

      return { success: true, id: docRef.id, item: newItem };
    } catch (error) {
      console.error('[Master Manager] 追加エラー:', error);
      return { success: false, error: error.message, item: newItem };
    }
  });

  const results = await Promise.all(writePromises);
  
  // 結果を集計
  const successResults = results.filter(r => r.success);
  const failedResults = results.filter(r => !r.success);
  const addedCount = successResults.length;

  // ローカルキャッシュに追加
  successResults.forEach(r => {
    r.item.id = r.id;
    masterCache[currentMasterConfig.collection].push(r.item);
  });

  console.log(`[addTreeItems] 書き込み完了: 成功${addedCount}件, 失敗${failedResults.length}件`);

  // 結果通知
  if (addedCount > 0) {
    let message = `${addedCount}件追加しました`;
    if (duplicateCount > 0) {
      message += `（${duplicateCount}件は重複のためスキップ）`;
    }
    if (failedResults.length > 0) {
      message += `（${failedResults.length}件は失敗）`;
    }
    showToast(message, 'success');

    // ローカルキャッシュを更新して即座に表示（Firestore再取得をスキップ）
    allMasterData = masterCache[currentMasterConfig.collection];
    filteredMasterData = allMasterData;
    
    console.log(`[Master Manager] ローカルキャッシュから表示: ${allMasterData.length}件`);
    
    renderMasterList();
    updateStats();
    
    // IndexedDBキャッシュを非同期で更新（バックグラウンド）
    if (window.masterCacheManager && window.masterCacheManager.invalidateCache) {
      window.masterCacheManager.invalidateCache(currentMasterConfig.collection)
        .then(() => console.log('[Master Manager] IndexedDBキャッシュ無効化完了'))
        .catch(e => console.warn('[Master Manager] IndexedDBキャッシュ無効化失敗:', e));
    }
    
    // categories/master を自動同期（商品登録・仕入管理連携）
    syncCategoriesMaster();
  } else if (failedResults.length > 0) {
    showToast(`追加に失敗しました（${failedResults.length}件）`, 'error');
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
    // 検索結果件数（filteredMasterDataから取得）
    const resultCount = filteredMasterData.length;

    if (hasSearchQuery && resultCount > 0) {
      // 検索結果がある場合
      statsText.textContent = `検索結果: ${resultCount.toLocaleString()}件`;
      if (totalCountEl) totalCountEl.classList.add('hidden');
    } else if (hasSearchQuery && resultCount === 0) {
      // 検索したが結果がない場合
      statsText.textContent = `検索結果: 0件`;
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

      // IndexedDBキャッシュも無効化
      if (window.masterCacheManager && window.masterCacheManager.invalidateCache) {
        window.masterCacheManager.invalidateCache(currentMasterConfig.collection)
          .then(() => console.log(`[Master Manager] IndexedDBキャッシュ無効化: ${currentMasterConfig.collection}`))
          .catch(e => console.error('[Master Manager] キャッシュ無効化エラー:', e));
      }

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
      
      // IndexedDBキャッシュも無効化
      if (window.masterCacheManager && window.masterCacheManager.invalidateCache) {
        await window.masterCacheManager.invalidateCache(currentMasterConfig.collection);
        console.log('✅ [Delete] IndexedDBキャッシュ無効化完了');
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
    
    // IndexedDBキャッシュも無効化
    if (window.masterCacheManager && window.masterCacheManager.invalidateCache) {
      await window.masterCacheManager.invalidateCache(currentMasterConfig.collection);
      console.log('✅ [BulkDelete] IndexedDBキャッシュ無効化完了');
    }

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

// ========================================
// ツリーノード操作（編集・コピー・削除）
// ========================================

/**
 * ツリーノードのアクション処理
 */
function handleTreeNodeAction(action, nodePath, nodeName, pathArray, node) {
  console.log(`🔧 [Master Manager] ツリーノードアクション: ${action}`, { nodePath, nodeName, pathArray });

  switch (action) {
    case 'edit':
      showTreeNodeEditModal(nodePath, nodeName, pathArray);
      break;
    case 'copy':
      showTreeNodeCopyModal(nodePath, nodeName, pathArray, node);
      break;
    case 'delete':
      showTreeNodeDeleteConfirm(nodePath, nodeName, node);
      break;
  }
}

/**
 * ツリーノード編集モーダル表示
 */
function showTreeNodeEditModal(nodePath, nodeName, pathArray) {
  const newName = prompt(`「${nodeName}」を編集:\n\n新しい名前を入力してください`, nodeName);

  if (!newName || newName.trim() === '' || newName === nodeName) {
    return; // キャンセルまたは変更なし
  }

  const trimmedName = newName.trim();

  // 確認
  if (!confirm(`「${nodeName}」を「${trimmedName}」に変更します。\n\nこの階層以下のすべてのカテゴリのパスも更新されます。\n\n続行しますか？`)) {
    return;
  }

  renameTreeNode(nodePath, nodeName, trimmedName, pathArray);
}

/**
 * ツリーノードの名前変更を実行
 */
async function renameTreeNode(nodePath, oldName, newName, pathArray) {
  showLoading(true);

  try {
    const collection = currentMasterConfig.collection;

    // 現在のプラットフォームを取得
    const platformId = currentPlatform || 'mercari';

    // 対象のカテゴリを検索（このノード以下のすべて）
    const allCategories = masterCache[collection] || allMasterData;
    const targetCategories = allCategories.filter(cat => {
      // platformId一致
      if (cat.platformId !== platformId) return false;
      // fullPathがこのノードで始まる
      return cat.fullPath && cat.fullPath.startsWith(nodePath);
    });

    console.log(`📝 [Master Manager] 名前変更対象: ${targetCategories.length}件`);

    // 新しいパスを計算
    const newPathArray = [...pathArray.slice(0, -1), newName];
    const newNodePath = newPathArray.join(' > ');

    // 各カテゴリのfullPathを更新
    const updatePromises = targetCategories.map(async (cat) => {
      const newFullPath = cat.fullPath.replace(nodePath, newNodePath);

      // 階層フィールドも更新（level1, level2など）
      const updates = { fullPath: newFullPath };
      const levelIndex = pathArray.length; // 1-indexed
      const levelField = `level${levelIndex}`;
      if (cat[levelField] === oldName) {
        updates[levelField] = newName;
      }

      return window.updateMaster(collection, cat.id, updates);
    });

    const results = await Promise.all(updatePromises);
    const successCount = results.filter(r => r && r.success).length;

    showLoading(false);

    if (successCount === targetCategories.length) {
      alert(`✅ ${successCount}件のカテゴリを更新しました`);
    } else {
      alert(`⚠️ ${successCount}/${targetCategories.length}件を更新しました`);
    }

    // キャッシュクリア＆再読み込み
    delete masterCache[collection];
    await fetchAndDisplayTotalCountByPlatform();

  } catch (error) {
    showLoading(false);
    console.error('❌ [Master Manager] 名前変更エラー:', error);
    alert('名前変更中にエラーが発生しました');
  }
}

/**
 * ツリーノード削除確認
 */
function showTreeNodeDeleteConfirm(nodePath, nodeName, node) {
  const count = node.count || 0;
  const message = count > 0
    ? `「${nodeName}」とその配下の${count}件のカテゴリを削除しますか？\n\n⚠️ この操作は取り消せません。`
    : `「${nodeName}」を削除しますか？\n\n⚠️ この操作は取り消せません。`;

  if (!confirm(message)) {
    return;
  }

  deleteTreeNode(nodePath, nodeName);
}

/**
 * ツリーノードの削除を実行
 */
async function deleteTreeNode(nodePath, nodeName) {
  showLoading(true);

  try {
    const collection = currentMasterConfig.collection;
    const platformId = currentPlatform || 'mercari';

    // 対象のカテゴリを検索（このノード以下のすべて）
    const allCategories = masterCache[collection] || allMasterData;
    const targetCategories = allCategories.filter(cat => {
      if (cat.platformId !== platformId) return false;
      return cat.fullPath && cat.fullPath.startsWith(nodePath);
    });

    console.log(`🗑️ [Master Manager] 削除対象: ${targetCategories.length}件`);

    if (targetCategories.length === 0) {
      showLoading(false);
      alert('削除対象が見つかりませんでした');
      return;
    }

    // 削除実行
    const deletePromises = targetCategories.map(cat =>
      window.deleteMaster(collection, cat.id)
    );

    const results = await Promise.all(deletePromises);
    const successCount = results.filter(r => r && r.success).length;

    showLoading(false);

    if (successCount === targetCategories.length) {
      alert(`✅ ${successCount}件を削除しました`);
    } else {
      alert(`⚠️ ${successCount}/${targetCategories.length}件を削除しました`);
    }

    // キャッシュクリア＆再読み込み
    delete masterCache[collection];
    
    // IndexedDBキャッシュも無効化
    if (window.masterCacheManager && window.masterCacheManager.invalidateCache) {
      await window.masterCacheManager.invalidateCache(collection);
      console.log('✅ [Delete] IndexedDBキャッシュ無効化完了');
    }
    
    await fetchAndDisplayTotalCountByPlatform();
    
    // categories/master を自動同期（商品登録・仕入管理連携）
    syncCategoriesMaster();

  } catch (error) {
    showLoading(false);
    console.error('❌ [Master Manager] 削除エラー:', error);
    alert('削除中にエラーが発生しました');
  }
}

// コピーモーダル用の一時データ保存
let copyModalData = null;

/**
 * 設定画面のプラットフォーム設定を取得（連動）
 * @returns {Array} プラットフォームリスト
 */
function getAvailablePlatforms() {
  try {
    // 設定画面のプラットフォーム設定を参照（localStorage）
    const configStr = localStorage.getItem('config');
    if (configStr) {
      const config = JSON.parse(configStr);
      const platformSettings = config['プラットフォーム設定'];
      if (platformSettings && platformSettings.platforms && platformSettings.platforms.length > 0) {
        // enabled: true のプラットフォームのみ返す
        const enabledPlatforms = platformSettings.platforms.filter(p => p.enabled);
        if (enabledPlatforms.length > 0) {
          console.log('📋 [Copy] 設定画面のプラットフォームを使用:', enabledPlatforms.map(p => p.name));
          return enabledPlatforms;
        }
      }
    }
  } catch (e) {
    console.warn('⚠️ [Copy] プラットフォーム設定の読み込みに失敗:', e);
  }

  // フォールバック: master-config.js の設定を使用
  console.log('📋 [Copy] フォールバック: master-config.jsの設定を使用');
  return currentMasterConfig.platforms || [];
}

/**
 * ツリーノードコピーモーダル表示（タップ式UI）
 */
function showTreeNodeCopyModal(nodePath, nodeName, pathArray, node) {
  // 設定画面のプラットフォーム設定と連動
  const platforms = getAvailablePlatforms();
  const currentPlatformId = currentPlatform || 'mercari';

  // 現在のプラットフォーム以外を選択肢に
  const otherPlatforms = platforms.filter(p => {
    // メルカリグループの場合は除外
    const mercariGroup = ['mercari', 'mercari-shops'];
    if (mercariGroup.includes(currentPlatformId) && mercariGroup.includes(p.id)) {
      return false;
    }
    return p.id !== currentPlatformId;
  });

  if (otherPlatforms.length === 0) {
    alert('コピー先のプラットフォームがありません');
    return;
  }

  // データを保存
  copyModalData = { nodePath, nodeName, node };

  // モーダル情報を更新
  const infoEl = document.getElementById('copyModalInfo');
  if (infoEl) {
    infoEl.innerHTML = `
      <div style="font-weight: 600; color: #333;">「${nodeName}」</div>
      <div style="font-size: 13px; color: #666; margin-top: 4px;">${node.count}件のカテゴリをコピー</div>
    `;
  }

  // プラットフォームボタンを生成
  const listEl = document.getElementById('copyPlatformList');
  if (listEl) {
    listEl.innerHTML = otherPlatforms.map(p => {
      // アイコンのフォールバック（頭文字表示）
      const initial = (p.name || p.id || '?').charAt(0).toUpperCase();
      const iconHtml = p.icon
        ? `<img src="${p.icon}" alt="${p.name}" style="width: 32px; height: 32px; border-radius: 6px; object-fit: contain; background: #f5f5f5; padding: 4px;" onerror="this.outerHTML='<div style=\\'width:32px;height:32px;border-radius:6px;background:#95bf47;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:16px;\\'>${initial}</div>'">`
        : `<div style="width:32px;height:32px;border-radius:6px;background:#6b7280;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:600;font-size:16px;">${initial}</div>`;

      return `
      <button type="button" class="copy-platform-btn" onclick="selectCopyPlatform('${p.id}', '${p.name}')"
        style="display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid #e0e0e0; border-radius: 10px; background: #fff; cursor: pointer; transition: all 0.2s; text-align: left;">
        ${iconHtml}
        <span style="font-size: 15px; font-weight: 500; color: #333;">${p.name}</span>
        <i class="bi bi-chevron-right" style="margin-left: auto; color: #999;"></i>
      </button>
    `;
    }).join('');
  }

  // モーダル表示
  const modal = document.getElementById('copyModal');
  if (modal) {
    modal.classList.remove('hidden');
  }
}

/**
 * コピー先プラットフォーム選択
 */
window.selectCopyPlatform = function(platformId, platformName) {
  if (!copyModalData) return;

  // platformId検証（早期チェック）
  if (!platformId || platformId === 'undefined' || platformId === 'null') {
    console.error('❌ [selectCopyPlatform] 無効なplatformId:', platformId);
    alert('❌ プラットフォームが正しく選択されていません');
    return;
  }

  const { nodePath, nodeName, node } = copyModalData;

  // モーダルを閉じる
  window.hideCopyModal();

  // 確認ダイアログ
  if (!confirm(`「${nodeName}」（${node.count}件）を「${platformName}」にコピーしますか？`)) {
    return;
  }

  console.log(`📋 [selectCopyPlatform] コピー開始: platformId="${platformId}"`);
  copyTreeNodeToPlatform(nodePath, nodeName, platformId, node);
};

/**
 * コピーモーダルを閉じる
 */
window.hideCopyModal = function() {
  const modal = document.getElementById('copyModal');
  if (modal) {
    modal.classList.add('hidden');
  }
  copyModalData = null;
};

/**
 * ツリーノードを別プラットフォームにコピー
 */
async function copyTreeNodeToPlatform(nodePath, nodeName, targetPlatformId, node) {
  showLoading(true);

  try {
    // ====== platform検証（undefined/空文字対策） ======
    const validPlatformIds = ['mercari', 'mercari-shops', 'yahoo-fleamarket', 'yahoo-auction', 'rakuma', 'base', 'shopify', 'stores'];
    
    if (!targetPlatformId || typeof targetPlatformId !== 'string' || targetPlatformId.trim() === '') {
      showLoading(false);
      console.error('❌ [Copy] 無効なtargetPlatformId:', targetPlatformId);
      alert('❌ コピー先プラットフォームが正しく選択されていません');
      return;
    }
    
    if (!validPlatformIds.includes(targetPlatformId)) {
      showLoading(false);
      console.error('❌ [Copy] 未知のプラットフォームID:', targetPlatformId);
      alert(`❌ 未知のプラットフォームID: ${targetPlatformId}`);
      return;
    }
    
    console.log(`✅ [Copy] platformId検証OK: "${targetPlatformId}"`);
    // ===============================================

    const collection = currentMasterConfig.collection;
    const sourcePlatformId = currentPlatform || 'mercari';

    // コピー元のカテゴリを取得
    const allCategories = masterCache[collection] || allMasterData;

    // デバッグログ
    console.log(`📋 [Copy Debug] nodePath: "${nodePath}"`);
    console.log(`📋 [Copy Debug] sourcePlatformId: "${sourcePlatformId}"`);
    console.log(`📋 [Copy Debug] allCategories count: ${allCategories ? allCategories.length : 0}`);
    if (allCategories && allCategories.length > 0) {
      console.log(`📋 [Copy Debug] サンプルfullPath: "${allCategories[0].fullPath}"`);
      console.log(`📋 [Copy Debug] サンプルplatformId: "${allCategories[0].platformId}"`);
    }

    const sourceCategories = allCategories.filter(cat => {
      // platformチェック（未設定の場合はmercariとして扱う）
      // 注: 既存データは platform フィールドを使用
      const catPlatform = cat.platform || cat.platformId || 'mercari';
      if (catPlatform !== sourcePlatformId) return false;

      // nodePathの階層数を確認（">" で分割）
      const nodePathParts = nodePath.split(' > ');
      const isTopLevel = nodePathParts.length === 1;

      if (isTopLevel) {
        // トップレベルノード（特大カテゴリ）の場合
        // superCategoryが完全一致するもののみ
        return cat.superCategory === nodePath;
      } else {
        // 中間ノードの場合
        // superCategory + fullPath の組み合わせでマッチング
        if (cat.superCategory && cat.fullPath) {
          const fullPathWithSuper = `${cat.superCategory} > ${cat.fullPath}`;
          // 完全一致または、nodePath + " > " で始まるもの
          if (fullPathWithSuper === nodePath || fullPathWithSuper.startsWith(nodePath + ' > ')) {
            return true;
          }
        }
        return false;
      }
    });

    console.log(`📋 [Master Manager] コピー元: ${sourceCategories.length}件`);

    if (sourceCategories.length === 0) {
      showLoading(false);
      // デバッグ情報を表示
      const platformMatch = allCategories.filter(cat => cat.platformId === sourcePlatformId);
      console.log(`📋 [Copy Debug] platformIdマッチ: ${platformMatch.length}件`);
      if (platformMatch.length > 0) {
        console.log(`📋 [Copy Debug] fullPathサンプル:`, platformMatch.slice(0, 3).map(c => c.fullPath));
      }
      alert('コピー元のカテゴリが見つかりませんでした');
      return;
    }

    // コピー先の既存カテゴリを取得（重複チェック用）
    const existingTargetCategories = allCategories.filter(cat => {
      const catPlatform = cat.platform || cat.platformId || 'mercari';
      return catPlatform === targetPlatformId;
    });

    // 既存データのキー（superCategory + fullPath）をSetに格納
    const existingKeys = new Set();
    existingTargetCategories.forEach(cat => {
      const key = `${cat.superCategory || ''}::${cat.fullPath || ''}`;
      existingKeys.add(key);
    });

    console.log(`📋 [Copy] コピー先の既存カテゴリ: ${existingTargetCategories.length}件`);

    // 重複を除外した新規カテゴリのみ抽出
    const newCategories = sourceCategories.filter(cat => {
      const key = `${cat.superCategory || ''}::${cat.fullPath || ''}`;
      return !existingKeys.has(key);
    });

    console.log(`📋 [Copy] 新規作成対象: ${newCategories.length}件（重複除外: ${sourceCategories.length - newCategories.length}件）`);

    if (newCategories.length === 0) {
      showLoading(false);
      alert(`⚠️ すべてのカテゴリが既にコピー先に存在します`);
      return;
    }

    // 新しいカテゴリを作成
    const createPromises = newCategories.map(async (cat) => {
      const newCat = { ...cat };
      delete newCat.id; // 新しいIDを生成させる
      delete newCat.createdAt; // createMasterが設定する
      delete newCat.updatedAt; // createMasterが設定する
      
      // platformフィールドを設定（防御的検証付き）
      if (!targetPlatformId || targetPlatformId === 'undefined') {
        console.error('❌ [Copy] 致命的エラー: targetPlatformIdが無効', targetPlatformId);
        throw new Error('platformIdが無効です');
      }
      newCat.platform = targetPlatformId;
      // platformIdも設定（互換性のため）
      newCat.platformId = targetPlatformId;
      
      console.log(`📋 [Copy] カテゴリ作成: ${newCat.superCategory} > ${newCat.fullPath} → platform: ${newCat.platform}`);

      // firestore-api.js の createMaster を使用
      return window.createMaster(collection, newCat);
    });

    const results = await Promise.all(createPromises);
    const successCount = results.filter(r => r && r.success).length;

    showLoading(false);

    const skippedCount = sourceCategories.length - newCategories.length;
    if (successCount === newCategories.length) {
      if (skippedCount > 0) {
        alert(`✅ ${successCount}件をコピーしました\n（${skippedCount}件は既に存在するためスキップ）`);
      } else {
        alert(`✅ ${successCount}件をコピーしました`);
      }
    } else {
      alert(`⚠️ ${successCount}/${newCategories.length}件をコピーしました`);
    }

    // キャッシュクリア（コピー先を見るときに再読み込みされる）
    delete masterCache[collection];
    
    // IndexedDBキャッシュも無効化
    if (window.masterCacheManager && window.masterCacheManager.invalidateCache) {
      await window.masterCacheManager.invalidateCache(collection);
      console.log('✅ [Copy] IndexedDBキャッシュ無効化完了');
    }
    
    // categories/master を自動同期（商品登録・仕入管理連携）
    syncCategoriesMaster();

  } catch (error) {
    showLoading(false);
    console.error('❌ [Master Manager] コピーエラー:', error);
    alert('コピー中にエラーが発生しました');
  }
}

// ドキュメントクリックでケバブメニューを閉じる
document.addEventListener('click', (e) => {
  if (!e.target.closest('.tree-kebab-wrapper')) {
    document.querySelectorAll('.tree-kebab-dropdown.show').forEach(d => {
      d.classList.remove('show');
    });
  }
});

// ============================================
// categories/master 自動同期（商品登録・仕入管理連携）
// ============================================

/**
 * 個別カテゴリドキュメントからcategories/masterを再生成
 * マスタ管理で追加/削除/コピー後に呼び出される
 */
async function syncCategoriesMaster() {
  // categoriesコレクション以外は対象外
  if (currentMasterConfig?.collection !== 'categories') {
    return;
  }
  
  console.log('🔄 [Sync] categories/master 同期開始...');
  
  try {
    const snapshot = await firebase.firestore().collection('categories').get();
    
    const rows = [];
    snapshot.docs.forEach(doc => {
      if (doc.id === 'master') return; // masterドキュメント自体はスキップ
      const d = doc.data();
      
      // createdAtをソート用に取得（ミリ秒）
      const createdAtMs = d.createdAt?.toMillis ? d.createdAt.toMillis() : 0;
      
      if (d.superCategory) {
        // 新形式: superCategoryを特大分類として使用
        rows.push({
          特大分類: d.superCategory,
          大分類: d.level1 || '',
          中分類: d.level2 || '',
          小分類: d.level3 || '',
          細分類: d.level4 || '',
          細分類2: d.level5 || '',
          アイテム名: d.itemName || '',
          _sortKey: createdAtMs
        });
      } else if (d.level1) {
        // 旧形式: ファッションに属する
        rows.push({
          特大分類: 'ファッション',
          大分類: d.level1 || '',
          中分類: d.level2 || '',
          小分類: d.level3 || '',
          細分類: d.level4 || '',
          細分類2: d.level5 || '',
          アイテム名: d.itemName || '',
          _sortKey: createdAtMs
        });
      }
    });
    
    // createdAt順（追加順）でソート
    rows.sort((a, b) => a._sortKey - b._sortKey);
    
    // ソートキーを削除（不要なデータを保存しない）
    rows.forEach(r => delete r._sortKey);
    
    // categories/masterを更新
    await firebase.firestore().collection('categories').doc('master').set({
      rows: rows,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ [Sync] categories/master 同期完了: ${rows.length}件`);
    
  } catch (error) {
    console.error('❌ [Sync] categories/master 同期エラー:', error);
  }
}

// ============================================
// 梱包資材 在庫アラート機能
// - 閾値を下回ったらチャット・通知・タスクに連携
// ============================================

// FCM Worker エンドポイント
const FCM_WORKER_URL = 'https://reborn-fcm-worker.antigravity-llc.workers.dev';

// アラート送信の最小間隔（同じ資材への重複アラート防止）
const ALERT_MIN_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4時間

/**
 * 在庫アラートチェック＆発火
 * 在庫が閾値を下回った場合にチャット・通知・タスクを作成
 *
 * @param {string} materialId - 梱包資材ID
 * @param {string} materialName - 資材名
 * @param {number} currentStock - 現在の在庫数
 * @param {number} threshold - アラート閾値
 * @param {string} locationId - 場所ID（任意）
 * @param {string} locationName - 場所名（任意）
 * @param {string} purchaseUrl - 購入先URL（任意）
 * @param {string} supplier - 発注先（任意）
 */
async function checkAndTriggerStockAlert(materialId, materialName, currentStock, threshold, locationId = null, locationName = '', purchaseUrl = '', supplier = '') {
  // 閾値が設定されていない、または在庫が閾値より多い場合はスキップ
  if (!threshold || threshold <= 0 || currentStock > threshold) {
    return;
  }

  console.log(`⚠️ [Stock Alert] 閾値チェック: ${materialName} 在庫=${currentStock} / 閾値=${threshold}`);

  try {
    // 重複アラート防止: 最近のアラートをチェック
    const recentAlertCheck = await window.db.collection('stockAlerts')
      .where('materialId', '==', materialId)
      .where('locationId', '==', locationId || '')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();

    if (!recentAlertCheck.empty) {
      const lastAlert = recentAlertCheck.docs[0].data();
      const lastAlertTime = lastAlert.createdAt?.toMillis?.() || 0;
      const now = Date.now();
      if (now - lastAlertTime < ALERT_MIN_INTERVAL_MS) {
        console.log(`🔕 [Stock Alert] 最近アラート済み（${Math.round((now - lastAlertTime) / 60000)}分前）、スキップ`);
        return;
      }
    }

    // アラート記録を作成
    const alertRecord = {
      materialId,
      materialName,
      currentStock,
      threshold,
      locationId: locationId || '',
      locationName: locationName || '',
      purchaseUrl: purchaseUrl || '',
      supplier: supplier || '',
      status: 'triggered',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    const alertDocRef = await window.db.collection('stockAlerts').add(alertRecord);
    console.log(`📝 [Stock Alert] アラート記録作成: ${alertDocRef.id}`);

    // 並列実行: チャットメッセージ、プッシュ通知、タスク作成
    await Promise.all([
      sendStockAlertChatMessage(materialName, currentStock, threshold, locationName, purchaseUrl, supplier),
      sendStockAlertPushNotification(materialName, currentStock, threshold, locationName),
      createStockAlertTask(materialId, materialName, currentStock, threshold, locationName, purchaseUrl, supplier)
    ]);

    console.log(`✅ [Stock Alert] アラート完了: ${materialName}`);

  } catch (error) {
    console.error('❌ [Stock Alert] アラート処理エラー:', error);
  }
}

/**
 * 在庫アラートチャットにメッセージを送信
 */
async function sendStockAlertChatMessage(materialName, currentStock, threshold, locationName = '', purchaseUrl = '', supplier = '') {
  try {
    const roomId = 'room_inventory_alert';
    const locationInfo = locationName ? ` (${locationName})` : '';
    const urgency = currentStock <= 0 ? '🚨 在庫切れ' : '⚠️ 在庫不足';
    const supplierInfo = supplier ? `\n発注先: ${supplier}` : '';
    const purchaseInfo = purchaseUrl ? `\n📎 購入リンク: ${purchaseUrl}` : '';

    const messageText = `${urgency}${locationInfo}
📦 ${materialName}
現在庫: ${currentStock}個 / 発注点: ${threshold}個${supplierInfo}${purchaseInfo}
補充をお願いします。`;

    // メッセージをFirestoreに追加
    await window.db.collection('messages').add({
      roomId: roomId,
      text: messageText,
      userName: 'システム',
      userEmail: 'system@reborn-inventory.com',
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      isSystemMessage: true
    });

    // roomsコレクションのlastMessageを更新
    await window.db.collection('rooms').doc(roomId).update({
      lastMessage: messageText.split('\n')[0], // 最初の行のみ
      lastMessageAt: firebase.firestore.FieldValue.serverTimestamp(),
      lastMessageBy: 'システム'
    });

    console.log(`💬 [Stock Alert] チャットメッセージ送信完了: ${roomId}`);

  } catch (error) {
    console.error('❌ [Stock Alert] チャットメッセージ送信エラー:', error);
  }
}

/**
 * 管理者にプッシュ通知を送信
 */
async function sendStockAlertPushNotification(materialName, currentStock, threshold, locationName = '') {
  try {
    // 管理者（owner/admin）のFCMトークンを取得
    const adminsSnapshot = await window.db.collection('users')
      .where('status', '==', 'active')
      .get();

    const adminTokens = [];
    adminsSnapshot.docs.forEach(doc => {
      const user = doc.data();
      if (user.permission === 'owner' || user.permission === 'admin') {
        // activeDevicesからトークンを取得
        if (user.activeDevices && Array.isArray(user.activeDevices)) {
          user.activeDevices.forEach(device => {
            if (device.fcmToken) {
              adminTokens.push(device.fcmToken);
            }
          });
        }
        // 旧形式のfcmTokenフィールドもチェック
        if (user.fcmToken) {
          adminTokens.push(user.fcmToken);
        }
      }
    });

    if (adminTokens.length === 0) {
      console.log('📭 [Stock Alert] 管理者のFCMトークンがありません');
      return;
    }

    const locationInfo = locationName ? ` (${locationName})` : '';
    const urgency = currentStock <= 0 ? '🚨 在庫切れ' : '⚠️ 在庫不足';

    // FCM Workerに送信
    const response = await fetch(`${FCM_WORKER_URL}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tokens: adminTokens,
        title: `${urgency} ${materialName}${locationInfo}`,
        body: `現在庫: ${currentStock}個 / 発注点: ${threshold}個`,
        data: {
          type: 'stock_alert',
          roomId: 'room_inventory_alert',
          url: '/inventory_history.html'
        }
      })
    });

    const result = await response.json();
    console.log(`🔔 [Stock Alert] プッシュ通知送信:`, result);

  } catch (error) {
    console.error('❌ [Stock Alert] プッシュ通知送信エラー:', error);
  }
}

/**
 * 管理者のやることリストにタスクを追加
 * タスクをタップすると資材管理画面に遷移、購入リンクがあれば表示
 */
async function createStockAlertTask(materialId, materialName, currentStock, threshold, locationName = '', purchaseUrl = '', supplier = '') {
  try {
    // 管理者（owner/admin）を取得
    const adminsSnapshot = await window.db.collection('users')
      .where('status', '==', 'active')
      .get();

    const admins = [];
    adminsSnapshot.docs.forEach(doc => {
      const user = doc.data();
      if (user.permission === 'owner' || user.permission === 'admin') {
        admins.push({
          email: user.email,
          name: user.userName || user.name || user.email
        });
      }
    });

    if (admins.length === 0) {
      console.log('📭 [Stock Alert] 管理者がいません');
      return;
    }

    const locationInfo = locationName ? ` (${locationName})` : '';
    const urgency = currentStock <= 0 ? '在庫切れ' : '在庫不足';
    const supplierInfo = supplier ? `\n発注先: ${supplier}` : '';

    // 購入リンク情報
    let purchaseLinkInfo = '';
    if (purchaseUrl) {
      purchaseLinkInfo = `\n\n📎 購入リンク:\n${purchaseUrl}`;
    } else {
      // 購入リンクがない場合はAmazon/楽天検索リンクを生成
      const searchQuery = encodeURIComponent(materialName);
      purchaseLinkInfo = `\n\n🔍 検索リンク:
・Amazon: https://www.amazon.co.jp/s?k=${searchQuery}
・楽天: https://search.rakuten.co.jp/search/mall/${searchQuery}
・モノタロウ: https://www.monotaro.com/s/?q=${searchQuery}`;
    }

    // 各管理者にタスクを作成
    for (const admin of admins) {
      const taskData = {
        type: 'stock_replenishment',
        title: `📦 ${urgency}: ${materialName}${locationInfo}`,
        description: `現在庫: ${currentStock}個 / 発注点: ${threshold}個${supplierInfo}
補充・発注が必要です。${purchaseLinkInfo}`,
        createdAt: new Date().toISOString(),
        completed: false,
        priority: currentStock <= 0 ? 'high' : 'medium',
        link: '/inventory_history.html',
        relatedData: {
          materialId,
          materialName,
          currentStock,
          threshold,
          locationName,
          purchaseUrl,
          supplier
        }
      };

      await window.db.collection('userTasks')
        .doc(admin.email)
        .collection('tasks')
        .add(taskData);

      console.log(`📋 [Stock Alert] タスク作成: ${admin.email}`);
    }

  } catch (error) {
    console.error('❌ [Stock Alert] タスク作成エラー:', error);
  }
}

/**
 * 資材情報を取得してアラートチェック（外部から呼び出し用）
 * ユーザー/場所ごとの閾値をサポート
 *
 * @param {string} materialId - 梱包資材ID
 * @param {number} newStock - 現在の在庫数
 * @param {string} locationId - 場所ID（必須: ユーザーごとの閾値チェック用）
 * @param {string} locationName - 場所名（任意）
 */
async function checkMaterialStockAlert(materialId, newStock, locationId = null, locationName = '') {
  try {
    const materialDoc = await window.db.collection('packagingMaterials').doc(materialId).get();
    if (!materialDoc.exists) return;

    const material = materialDoc.data();
    const materialName = material.productName || material.name || '不明な資材';

    let threshold = 0;
    let resolvedLocationName = locationName;

    // 場所IDがある場合、場所ごとの閾値を取得
    if (locationId) {
      const locationDoc = await window.db.collection('packagingLocations').doc(locationId).get();
      if (locationDoc.exists) {
        const location = locationDoc.data();
        resolvedLocationName = resolvedLocationName || location.name || '';

        // 場所ごとの資材閾値を取得
        const materialThresholds = location.materialThresholds || {};
        if (materialThresholds[materialId] !== undefined && materialThresholds[materialId] > 0) {
          threshold = materialThresholds[materialId];
          console.log(`📍 [Stock Alert] 場所別閾値を使用: ${resolvedLocationName} → ${threshold}個`);
        }
      }
    }

    // 場所ごとの閾値がない場合、資材のグローバル閾値を使用
    if (!threshold || threshold <= 0) {
      threshold = material.stockAlertThreshold || 0;
      if (threshold > 0) {
        console.log(`🌐 [Stock Alert] グローバル閾値を使用: ${threshold}個`);
      }
    }

    if (threshold > 0 && newStock <= threshold) {
      await checkAndTriggerStockAlert(
        materialId,
        materialName,
        newStock,
        threshold,
        locationId,
        resolvedLocationName,
        material.purchaseUrl || '',
        material.supplier || ''
      );
    }
  } catch (error) {
    console.error('❌ [Stock Alert] チェックエラー:', error);
  }
}

// グローバルに公開
window.checkAndTriggerStockAlert = checkAndTriggerStockAlert;
window.checkMaterialStockAlert = checkMaterialStockAlert;

console.log('✅ [Master Manager] モジュール読み込み完了');
