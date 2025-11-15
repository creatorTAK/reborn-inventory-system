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

// 選択モード関連
let selectionMode = false;
let selectedMasterData = new Set(); // 選択されたマスタID

// キャッシュ管理
let masterCache = {}; // カテゴリ/タイプごとのキャッシュ {collection: [...]}

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

    // 商品関連はデフォルトで開いている
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

  if (!currentMasterConfig) {
    console.error(`❌ [Master Manager] マスタ設定が見つかりません: ${category}/${type}`);
    alert(`マスタ「${type}」が見つかりません。`);
    return;
  }

  console.log(`✅ [Master Manager] マスタ設定読み込み完了: ${currentMasterConfig.label}`);

  // ヘッダーにマスタ種別を表示
  updateMasterTypeDisplay();

  // initialDisplay設定チェック
  const initialDisplay = currentMasterConfig.initialDisplay !== undefined
    ? currentMasterConfig.initialDisplay
    : (currentMasterConfig.maxDisplayResults || 100);

  if (initialDisplay === 0) {
    // 初期表示なし（検索後のみデータ表示）
    console.log('ℹ️ [Master Manager] 初期表示なし（検索後のみデータ表示）');
    
    // キャッシュに先行読み込み（await で完了を待つ）
    await loadMasterDataToCache();
    
    allMasterData = [];
    filteredMasterData = [];
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

    // ブランドマスタの場合はbrandCacheManagerを使用（高速化）
    let data;
    if (currentMasterConfig.collection === 'brands' && window.brandCacheManager) {
      console.log('🚀 [Master Manager] ブランドキャッシュから読み込み');
      data = await window.brandCacheManager.getBrands();
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

    // ブランドマスタの場合はbrandCacheManagerを使用（高速化）
    let data;
    if (currentMasterConfig.collection === 'brands' && window.brandCacheManager) {
      console.log('🚀 [Master Manager] ブランドキャッシュから読み込み');
      data = await window.brandCacheManager.getBrands();
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
      allMasterData = [];
      filteredMasterData = [];
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

      const results = masterCache[collection].filter(item => {
        // searchTextをひらがなに変換して比較
        const searchText = item.searchText || '';
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
    const emptyStateText = emptyState.querySelector('.empty-state-text');
    const emptyStateHint = emptyState.querySelector('.empty-state-hint');

    if (hasSearchQuery) {
      // 検索後に0件の場合
      if (emptyStateText) emptyStateText.textContent = 'データが見つかりません';
      if (emptyStateHint) emptyStateHint.textContent = '検索条件を変更してください';
    } else {
      // 検索前の初期状態
      if (emptyStateText) emptyStateText.textContent = '検索して絞り込んでください';
      if (emptyStateHint) emptyStateHint.textContent = '';
    }
    return;
  }

  // リスト表示
  container.classList.remove('hidden');
  emptyState.classList.add('hidden');

  // 表示件数制限（パフォーマンス対策）
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
 * マスタカード作成
 * @param {Object} item - マスタデータ
 * @returns {HTMLElement} カード要素
 */
function createMasterCard(item) {
  const card = document.createElement('div');
  card.className = 'master-card';
  card.setAttribute('data-master-id', item.id);

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

  // displayFieldsに従ってフィールドを表示
  const displayFields = currentMasterConfig.displayFields || ['name'];
  displayFields.forEach((fieldName, index) => {
    const fieldValue = item[fieldName] || '';
    const className = index === 0 ? 'master-field-primary' : 'master-field-secondary';
    cardContent += `<div class="${className}">${escapeHtml(fieldValue)}</div>`;
  });

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

  // 通常モード時のみ削除ボタン表示
  if (!selectionMode) {
    cardContent += `
      <div class="master-actions">
        <button class="btn-delete" onclick="showDeleteModal('${item.id}')">
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
  const collection = currentMasterConfig?.collection;
  const totalItems = masterCache[collection] ? masterCache[collection].length : 0;

  if (statsText) {
    const resultCount = filteredMasterData.length;
    if (resultCount > 0) {
      statsText.textContent = `検索結果: ${resultCount.toLocaleString()}件 | 全${totalItems.toLocaleString()}件`;
    } else {
      statsText.textContent = `全${totalItems.toLocaleString()}件`;
    }
  }
}

// ============================================
// マスタ追加
// ============================================

/**
 * 追加モーダル表示
 */
window.showAddModal = function() {
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
    input.type = 'text';
    input.id = `add-${field.name}`;
    input.className = 'form-input';
    input.placeholder = field.placeholder || '';
    if (field.maxLength) {
      input.maxLength = field.maxLength;
    }

    formGroup.appendChild(label);
    formGroup.appendChild(input);
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

  currentMasterConfig.fields.forEach(field => {
    const input = document.getElementById(`add-${field.name}`);
    const value = input ? input.value.trim() : '';

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

      hideAddModal();
      alert(`${currentMasterConfig.label}を追加しました。\n検索して確認してください。`);

      // 検索を再実行
      const searchInput = document.getElementById('searchInput');
      if (searchInput && searchInput.value.trim().length > 0) {
        await performSearch(searchInput.value.trim());
      }
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
    if (selectModeBtn) selectModeBtn.classList.add('active');
    if (selectionToolbar) selectionToolbar.classList.remove('hidden');
  } else {
    // 選択モードOFF
    if (selectModeBtn) selectModeBtn.classList.remove('active');
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

console.log('✅ [Master Manager] モジュール読み込み完了');
