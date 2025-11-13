/**
 * REBORN在庫管理システム - ブランドマスタ管理
 *
 * ブランドマスタの追加・削除・一覧表示を行うモジュール
 *
 * @module master-brand-manager
 * @version 1.0.0
 * @created 2025-11-14
 * @related-issue MASTER-001
 */

// ============================================
// グローバル変数
// ============================================

let allBrands = [];
let filteredBrands = [];
let brandToDelete = null;
let unsubscribe = null;

// Firestore API関数
let createBrand, deleteBrand, updateBrand, initializeFirestore, searchBrands, preloadBrandsInBackground;

// ============================================
// 初期化
// ============================================

/**
 * ページ初期化
 */
async function init() {
  try {
    console.log('📥 [Master Brand Manager] 初期化開始');

    // Firestore APIモジュール読み込み（絶対パス使用）
    const module = await import('/js/firestore-api.js');
    createBrand = module.createBrand;
    deleteBrand = module.deleteBrand;
    updateBrand = module.updateBrand;
    initializeFirestore = module.initializeFirestore;
    searchBrands = module.searchBrands;
    preloadBrandsInBackground = module.preloadBrandsInBackground;

    console.log('✅ [Master Brand Manager] Firestore API読み込み完了');

    // リアルタイム同期開始
    await setupRealtimeSync();

    // 検索イベント設定
    setupSearchEvents();

    // グローバル関数設定
    setupGlobalFunctions();

    console.log('✅ [Master Brand Manager] 初期化完了');

  } catch (error) {
    console.error('❌ [Master Brand Manager] 初期化エラー:', error);
    alert('初期化エラーが発生しました。ページを再読み込みしてください。');
  }
}

// ============================================
// リアルタイム同期
// ============================================

/**
 * 初期状態設定
 * 【重要】検索主導型UI: 初期表示ではデータ読み込みなし
 */
async function setupRealtimeSync() {
  try {
    console.log('🔄 [Master Brand Manager] 検索主導型モードで起動');

    // 初期状態: 空表示
    allBrands = [];
    filteredBrands = [];

    renderBrandList();
    updateStats();

  } catch (error) {
    console.error('❌ [Master Brand Manager] 初期化エラー:', error);
  }
}

// ============================================
// 検索・フィルタ
// ============================================

/**
 * 検索イベント設定
 * 【重要】検索主導型: 入力があるときのみFirestore検索
 */
function setupSearchEvents() {
  const searchInput = document.getElementById('searchInput');

  if (!searchInput) {
    console.warn('[Master Brand Manager] 検索入力フィールドが見つかりません');
    return;
  }

  // 入力イベント（デバウンス付き）
  let debounceTimer;
  searchInput.addEventListener('input', async (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const query = searchInput.value.trim();

      if (query.length > 0) {
        // 🔍 検索実行: 全51,342件から検索（最大50件取得）
        showLoading(true);
        console.log(`🔍 [Master Brand Manager] 検索実行: "${query}"`);

        try {
          const results = await searchBrands(query, 50);
          allBrands = results;
          filteredBrands = results;
          console.log(`✅ [Master Brand Manager] 検索結果: ${results.length}件`);
        } catch (error) {
          console.error('❌ [Master Brand Manager] 検索エラー:', error);
          allBrands = [];
          filteredBrands = [];
        }

        showLoading(false);
      } else {
        // 検索クエリなし = 空表示
        console.log('🔄 [Master Brand Manager] 検索クリア');
        allBrands = [];
        filteredBrands = [];
      }

      // 表示更新
      renderBrandList();
      updateStats();
    }, 300);
  });
}

/**
 * 検索フィルタ適用
 * 【注意】検索主導型UIでは不要（検索時に直接filteredBrandsを設定）
 */
function applySearchFilter() {
  // この関数は検索主導型UIでは使用しない
  // filteredBrands は setupSearchEvents() で直接設定される
}

// ============================================
// 表示更新
// ============================================

/**
 * ブランドリスト表示
 */
function renderBrandList() {
  const container = document.getElementById('brandsContainer');
  const emptyState = document.getElementById('emptyState');

  if (!container || !emptyState) {
    console.warn('[Master Brand Manager] コンテナ要素が見つかりません');
    return;
  }

  // コンテナクリア
  container.innerHTML = '';

  // 空状態チェック
  if (filteredBrands.length === 0) {
    container.classList.add('hidden');
    emptyState.classList.remove('hidden');
    return;
  }

  // リスト表示
  container.classList.remove('hidden');
  emptyState.classList.add('hidden');

  filteredBrands.forEach(brand => {
    const card = createBrandCard(brand);
    container.appendChild(card);
  });
}

/**
 * ブランドカード作成
 * @param {Object} brand - ブランドデータ
 * @returns {HTMLElement} ブランドカード要素
 */
function createBrandCard(brand) {
  const card = document.createElement('div');
  card.className = 'brand-card';
  card.innerHTML = `
    <div class="brand-info">
      <div class="brand-name-en">${escapeHtml(brand.nameEn)}</div>
      <div class="brand-name-kana">${escapeHtml(brand.nameKana)}</div>
      <div class="brand-meta">
        <div class="usage-count">
          <i class="bi bi-graph-up"></i>
          <span>使用回数: ${brand.usageCount}回</span>
        </div>
      </div>
    </div>
    <div class="brand-actions">
      <button class="btn-delete" onclick="showDeleteModal('${brand.id}', '${escapeHtml(brand.nameEn)}', '${escapeHtml(brand.nameKana)}')">
        <i class="bi bi-trash"></i>
      </button>
    </div>
  `;
  return card;
}

/**
 * 統計情報更新
 */
function updateStats() {
  const totalCount = document.getElementById('totalCount');

  if (totalCount) {
    totalCount.textContent = filteredBrands.length.toLocaleString();
  }
}

// ============================================
// ブランド追加
// ============================================

/**
 * 追加モーダル表示
 */
window.showAddModal = function() {
  const modal = document.getElementById('addModal');
  const nameEnInput = document.getElementById('addNameEn');
  const nameKanaInput = document.getElementById('addNameKana');
  const errorMessage = document.getElementById('addErrorMessage');

  if (!modal) return;

  // 入力フィールドクリア
  if (nameEnInput) nameEnInput.value = '';
  if (nameKanaInput) nameKanaInput.value = '';
  if (errorMessage) {
    errorMessage.textContent = '';
    errorMessage.classList.add('hidden');
  }

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
 * ブランド追加実行
 */
window.addBrand = async function() {
  const nameEnInput = document.getElementById('addNameEn');
  const nameKanaInput = document.getElementById('addNameKana');
  const errorMessage = document.getElementById('addErrorMessage');

  if (!nameEnInput || !nameKanaInput || !errorMessage) return;

  const nameEn = nameEnInput.value.trim();
  const nameKana = nameKanaInput.value.trim();

  // バリデーション
  if (!nameEn) {
    showError(errorMessage, 'ブランド英語名を入力してください');
    return;
  }

  if (!nameKana) {
    showError(errorMessage, 'ブランドカナ名を入力してください');
    return;
  }

  try {
    showLoading(true);

    // Firestore APIで追加
    const result = await createBrand(nameEn, nameKana);

    if (result.success) {
      console.log(`✅ [Master Brand Manager] ブランド追加成功: ${nameEn}`);
      hideAddModal();

      // 成功メッセージ（オプション）
      // alert(`ブランド「${nameEn}」を追加しました`);
    } else {
      showError(errorMessage, result.error || 'ブランドの追加に失敗しました');
    }

  } catch (error) {
    console.error('❌ [Master Brand Manager] ブランド追加エラー:', error);
    showError(errorMessage, 'ブランドの追加に失敗しました');
  } finally {
    showLoading(false);
  }
};

// ============================================
// ブランド削除
// ============================================

/**
 * 削除確認モーダル表示
 * @param {string} brandId - ブランドID
 * @param {string} nameEn - ブランド英語名
 * @param {string} nameKana - ブランドカナ名
 */
window.showDeleteModal = function(brandId, nameEn, nameKana) {
  const modal = document.getElementById('deleteModal');
  const deleteNameEn = document.getElementById('deleteNameEn');
  const deleteNameKana = document.getElementById('deleteNameKana');

  if (!modal) return;

  brandToDelete = { id: brandId, nameEn, nameKana };

  if (deleteNameEn) deleteNameEn.textContent = nameEn;
  if (deleteNameKana) deleteNameKana.textContent = nameKana;

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
  brandToDelete = null;
};

/**
 * ブランド削除実行
 */
window.confirmDelete = async function() {
  if (!brandToDelete) {
    console.warn('[Master Brand Manager] 削除対象のブランドが選択されていません');
    return;
  }

  try {
    showLoading(true);

    const result = await deleteBrand(brandToDelete.id);

    if (result.success) {
      console.log(`✅ [Master Brand Manager] ブランド削除成功: ${brandToDelete.nameEn}`);
      hideDeleteModal();

      // 成功メッセージ（オプション）
      // alert(`ブランド「${brandToDelete.nameEn}」を削除しました`);
    } else {
      alert(result.error || 'ブランドの削除に失敗しました');
    }

  } catch (error) {
    console.error('❌ [Master Brand Manager] ブランド削除エラー:', error);
    alert('ブランドの削除に失敗しました');
  } finally {
    showLoading(false);
    brandToDelete = null;
  }
};

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
 * グローバル関数設定
 */
function setupGlobalFunctions() {
  // window.showAddModal, hideAddModal, addBrand は既に設定済み
  // window.showDeleteModal, hideDeleteModal, confirmDelete も既に設定済み
  // window.goBack も設定済み
  console.log('✅ [Master Brand Manager] グローバル関数設定完了');
}

// ============================================
// ページ読み込み時に初期化実行
// ============================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// ページアンロード時にリスナー解除
window.addEventListener('beforeunload', () => {
  if (unsubscribe) {
    unsubscribe();
    console.log('🔌 [Master Brand Manager] リアルタイム同期解除');
  }
});
