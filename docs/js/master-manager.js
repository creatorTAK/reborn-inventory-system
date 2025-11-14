/**
 * 汎用マスタ管理ロジック
 * 
 * master-config.jsで定義されたマスタ設定に基づいて動的にUIを生成し、
 * firestore-api.jsの汎用CRUD APIを使用してマスタデータを管理する
 */

// グローバル変数
let currentCategory = null;
let currentMasterType = null;
let currentMasterConfig = null;
let allMasterData = [];
let filteredMasterData = [];
let isSelectionMode = false;
let selectedIds = new Set();
let deleteTargetId = null;
let searchDebounceTimer = null;

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

  // カテゴリに応じてアコーディオンを開き、最初のタブをロード
  if (urlCategory === 'business') {
    // 業務関連マスタを開く
    const businessCollapse = document.getElementById('businessMasterCollapse');
    const businessButton = document.querySelector('[data-bs-target="#businessMasterCollapse"]');
    if (businessCollapse && businessButton) {
      // 商品関連を閉じる
      const productCollapse = document.getElementById('productMasterCollapse');
      const productButton = document.querySelector('[data-bs-target="#productMasterCollapse"]');
      if (productCollapse) productCollapse.classList.remove('show');
      if (productButton) productButton.classList.add('collapsed');
      productButton.setAttribute('aria-expanded', 'false');

      // 業務関連を開く
      businessCollapse.classList.add('show');
      businessButton.classList.remove('collapsed');
      businessButton.setAttribute('aria-expanded', 'true');
    }
    loadMaster('business', 'shipping');
  } else {
    // デフォルトまたはcategory=productの場合: 商品関連マスタを開く（既にデフォルトで開いている）
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
  // 検索入力（デバウンス処理）
  document.getElementById('searchInput').addEventListener('input', (e) => {
    clearTimeout(searchDebounceTimer);
    searchDebounceTimer = setTimeout(() => {
      filterMasterData(e.target.value);
    }, 500);
  });
}

/**
 * マスタロード
 */
async function loadMaster(category, type) {
  console.log(`📋 [Master Manager] マスタロード開始: ${category}/${type}`);
  
  currentCategory = category;
  currentMasterType = type;
  currentMasterConfig = window.masterCategories[category].masters[type];

  if (!currentMasterConfig) {
    console.error('❌ [Master Manager] マスタ設定が見つかりません');
    return;
  }

  // ヘッダー更新
  updateHeader();

  // 検索プレースホルダー更新
  document.getElementById('searchInput').placeholder = `${currentMasterConfig.label}で絞り込み...`;

  // データロード
  await loadMasterData();
}

/**
 * ヘッダー更新
 */
function updateHeader() {
  const categoryConfig = window.masterCategories[currentCategory];
  const headerTitle = document.getElementById('headerTitle');
  const headerIcon = document.getElementById('headerIcon');

  headerIcon.className = `bi ${getIconClass(categoryConfig.icon)}`;
  headerTitle.innerHTML = `
    <i class="bi ${getIconClass(categoryConfig.icon)}"></i>
    ${currentMasterConfig.label}マスタ管理
  `;
}

/**
 * アイコンクラス取得
 */
function getIconClass(emoji) {
  const iconMap = {
    '📦': 'bi-box-seam',
    '🏢': 'bi-building',
    '📋': 'bi-clipboard-data',
    '🏷️': 'bi-tags',
    '📊': 'bi-graph-up'
  };
  return iconMap[emoji] || 'bi-gear';
}

/**
 * マスタデータロード
 */
async function loadMasterData() {
  showLoading();

  try {
    console.log(`🔍 [Master Manager] データ取得中: ${currentMasterConfig.collection}`);

    const data = await window.getMasterData(currentMasterConfig.collection, {
      sortBy: currentMasterConfig.sortBy,
      sortOrder: currentMasterConfig.sortOrder,
      limit: currentMasterConfig.maxDisplayResults || 100
    });

    console.log(`✅ [Master Manager] データ取得完了: ${data.length}件`);

    allMasterData = data;
    filteredMasterData = data;
    
    renderMasterList();
    updateStats();

  } catch (error) {
    console.error('❌ [Master Manager] データ取得エラー:', error);
    showError('データの取得に失敗しました');
  } finally {
    hideLoading();
  }
}

/**
 * マスタリスト描画
 */
function renderMasterList() {
  const container = document.getElementById('dataContainer');
  const emptyState = document.getElementById('emptyState');

  if (filteredMasterData.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    document.getElementById('emptyStateText').textContent = 
      allMasterData.length === 0 ? 'データが登録されていません' : '検索結果が見つかりませんでした';
    document.getElementById('emptyStateHint').textContent = 
      allMasterData.length === 0 ? '新規追加ボタンからデータを追加してください' : '検索条件を変更してください';
    return;
  }

  emptyState.classList.add('hidden');
  container.innerHTML = filteredMasterData.map(item => createDataCard(item)).join('');
}

/**
 * データカード生成
 */
function createDataCard(item) {
  const displayFields = currentMasterConfig.displayFields || [];
  const fieldsHtml = displayFields.map(fieldName => {
    const field = currentMasterConfig.fields.find(f => f.name === fieldName);
    const label = field ? field.label : fieldName;
    const value = item[fieldName] || '-';

    return `
      <div class="data-field">
        <span class="data-field-label">${label}:</span>
        <span class="data-field-value">${escapeHtml(value)}</span>
      </div>
    `;
  }).join('');

  const usageCountHtml = currentMasterConfig.usageCount && item.usageCount !== undefined ? `
    <div class="usage-count">
      <i class="bi bi-graph-up"></i>
      使用回数: ${item.usageCount}回
    </div>
  ` : '';

  const checkboxHtml = isSelectionMode ? `
    <input type="checkbox" class="data-checkbox" 
      ${selectedIds.has(item.id) ? 'checked' : ''}
      onchange="toggleSelection('${item.id}')">
  ` : '';

  const deleteButtonHtml = !isSelectionMode ? `
    <button class="btn-delete" onclick="showDeleteModal('${item.id}')">
      <i class="bi bi-trash"></i>
    </button>
  ` : '';

  return `
    <div class="data-card ${isSelectionMode ? 'selection-mode' : ''} ${selectedIds.has(item.id) ? 'selected' : ''}" 
      data-id="${item.id}">
      ${checkboxHtml}
      <div class="data-info">
        ${fieldsHtml}
        ${usageCountHtml ? `<div class="data-meta">${usageCountHtml}</div>` : ''}
      </div>
      <div class="data-actions">
        ${deleteButtonHtml}
      </div>
    </div>
  `;
}

/**
 * 統計情報更新
 */
function updateStats() {
  const statsText = document.getElementById('statsText');
  statsText.textContent = `検索結果: ${filteredMasterData.length}件`;
}

/**
 * マスタデータフィルタリング
 */
function filterMasterData(query) {
  if (!query || query.trim() === '') {
    filteredMasterData = allMasterData;
  } else {
    const searchFields = currentMasterConfig.searchFields || [];
    const lowerQuery = query.toLowerCase();

    filteredMasterData = allMasterData.filter(item => {
      return searchFields.some(field => {
        const value = item[field];
        return value && value.toString().toLowerCase().includes(lowerQuery);
      });
    });
  }

  renderMasterList();
  updateStats();
}

/**
 * 新規追加モーダル表示
 */
window.showAddModal = function() {
  if (!currentMasterConfig) {
    alert('マスタを選択してください');
    return;
  }

  document.getElementById('addModalTitle').textContent = `${currentMasterConfig.label}新規追加`;
  document.getElementById('addErrorMessage').classList.add('hidden');
  
  // フォームフィールド動的生成
  const formFields = document.getElementById('addFormFields');
  formFields.innerHTML = currentMasterConfig.fields.map(field => {
    return createFormField(field);
  }).join('');

  document.getElementById('addModal').classList.remove('hidden');
};

/**
 * フォームフィールド生成
 */
function createFormField(field) {
  const required = field.required ? '<span style="color: #ff4757;">*</span>' : '';
  const placeholder = field.placeholder || '';
  
  let inputHtml = '';

  switch (field.type) {
    case 'textarea':
      inputHtml = `<textarea id="field_${field.name}" class="form-textarea" placeholder="${placeholder}"></textarea>`;
      break;
    
    case 'select':
      const options = field.options || [];
      const optionsHtml = options.map(opt => `<option value="${opt.value || opt}">${opt.label || opt}</option>`).join('');
      inputHtml = `
        <select id="field_${field.name}" class="form-select">
          <option value="">選択してください</option>
          ${optionsHtml}
        </select>
      `;
      break;
    
    case 'number':
      inputHtml = `<input type="number" id="field_${field.name}" class="form-input" placeholder="${placeholder}">`;
      break;
    
    case 'email':
      inputHtml = `<input type="email" id="field_${field.name}" class="form-input" placeholder="${placeholder}">`;
      break;
    
    case 'tel':
      inputHtml = `<input type="tel" id="field_${field.name}" class="form-input" placeholder="${placeholder}">`;
      break;
    
    case 'url':
      inputHtml = `<input type="url" id="field_${field.name}" class="form-input" placeholder="${placeholder}">`;
      break;
    
    default: // text
      inputHtml = `<input type="text" id="field_${field.name}" class="form-input" placeholder="${placeholder}">`;
  }

  return `
    <div class="form-group">
      <label class="form-label" for="field_${field.name}">${field.label} ${required}</label>
      ${inputHtml}
    </div>
  `;
}

/**
 * 新規追加モーダル非表示
 */
window.hideAddModal = function() {
  document.getElementById('addModal').classList.add('hidden');
};

/**
 * データ追加
 */
window.addData = async function() {
  const errorElement = document.getElementById('addErrorMessage');
  errorElement.classList.add('hidden');

  // フォームデータ収集
  const data = {};
  let hasError = false;

  for (const field of currentMasterConfig.fields) {
    const inputElement = document.getElementById(`field_${field.name}`);
    const value = inputElement.value.trim();

    // 必須チェック
    if (field.required && !value) {
      errorElement.textContent = `${field.label}は必須です`;
      errorElement.classList.remove('hidden');
      return;
    }

    // バリデーション
    if (value && field.validation) {
      const validation = field.validation;

      // 最小長チェック
      if (validation.minLength && value.length < validation.minLength) {
        errorElement.textContent = `${field.label}は${validation.minLength}文字以上で入力してください`;
        errorElement.classList.remove('hidden');
        return;
      }

      // 最大長チェック
      if (validation.maxLength && value.length > validation.maxLength) {
        errorElement.textContent = `${field.label}は${validation.maxLength}文字以内で入力してください`;
        errorElement.classList.remove('hidden');
        return;
      }

      // 数値範囲チェック
      if (field.type === 'number') {
        const numValue = parseFloat(value);
        if (validation.min !== undefined && numValue < validation.min) {
          errorElement.textContent = `${field.label}は${validation.min}以上で入力してください`;
          errorElement.classList.remove('hidden');
          return;
        }
        if (validation.max !== undefined && numValue > validation.max) {
          errorElement.textContent = `${field.label}は${validation.max}以下で入力してください`;
          errorElement.classList.remove('hidden');
          return;
        }
      }
    }

    // データに追加
    if (field.type === 'number' && value) {
      data[field.name] = parseFloat(value);
    } else {
      data[field.name] = value;
    }
  }

  showLoading();

  try {
    const result = await window.createMaster(
      currentMasterConfig.collection,
      data,
      currentMasterConfig.usageCount || false
    );

    if (!result.success) {
      throw new Error(result.error || 'データの作成に失敗しました');
    }

    console.log('✅ [Master Manager] データ追加成功');
    hideAddModal();
    await loadMasterData();

  } catch (error) {
    console.error('❌ [Master Manager] データ追加エラー:', error);
    errorElement.textContent = error.message || 'データの追加に失敗しました';
    errorElement.classList.remove('hidden');
  } finally {
    hideLoading();
  }
};

/**
 * 削除モーダル表示
 */
window.showDeleteModal = function(id) {
  deleteTargetId = id;
  
  const item = allMasterData.find(d => d.id === id);
  if (!item) return;

  document.getElementById('deleteModalTitle').textContent = `${currentMasterConfig.label}削除確認`;

  // データプレビュー生成
  const displayFields = currentMasterConfig.displayFields || [];
  const previewHtml = displayFields.map(fieldName => {
    const field = currentMasterConfig.fields.find(f => f.name === fieldName);
    const label = field ? field.label : fieldName;
    const value = item[fieldName] || '-';

    return `
      <div style="margin-bottom: 8px;">
        <strong>${label}:</strong> ${escapeHtml(value)}
      </div>
    `;
  }).join('');

  document.getElementById('deleteDataPreview').innerHTML = previewHtml;
  document.getElementById('deleteModal').classList.remove('hidden');
};

/**
 * 削除モーダル非表示
 */
window.hideDeleteModal = function() {
  document.getElementById('deleteModal').classList.add('hidden');
  deleteTargetId = null;
};

/**
 * 削除確認
 */
window.confirmDelete = async function() {
  if (!deleteTargetId) return;

  showLoading();

  try {
    const result = await window.deleteMaster(currentMasterConfig.collection, deleteTargetId);

    if (!result.success) {
      throw new Error(result.error || '削除に失敗しました');
    }

    console.log('✅ [Master Manager] データ削除成功');
    hideDeleteModal();
    await loadMasterData();

  } catch (error) {
    console.error('❌ [Master Manager] データ削除エラー:', error);
    alert(error.message || 'データの削除に失敗しました');
  } finally {
    hideLoading();
  }
};

/**
 * 選択モード切り替え
 */
window.toggleSelectionMode = function() {
  isSelectionMode = !isSelectionMode;
  selectedIds.clear();

  const selectModeBtn = document.getElementById('selectModeBtn');
  const selectionToolbar = document.getElementById('selectionToolbar');

  if (isSelectionMode) {
    selectModeBtn.classList.add('active');
    selectionToolbar.classList.remove('hidden');
  } else {
    selectModeBtn.classList.remove('active');
    selectionToolbar.classList.add('hidden');
  }

  renderMasterList();
  updateSelectedCount();
};

/**
 * 選択切り替え
 */
window.toggleSelection = function(id) {
  if (selectedIds.has(id)) {
    selectedIds.delete(id);
  } else {
    selectedIds.add(id);
  }
  
  renderMasterList();
  updateSelectedCount();
};

/**
 * 全選択
 */
window.selectAll = function() {
  filteredMasterData.forEach(item => selectedIds.add(item.id));
  renderMasterList();
  updateSelectedCount();
};

/**
 * 選択数更新
 */
function updateSelectedCount() {
  document.getElementById('selectedCount').textContent = `${selectedIds.size}件選択中`;
}

/**
 * 選択削除
 */
window.deleteSelected = async function() {
  if (selectedIds.size === 0) {
    alert('削除するデータを選択してください');
    return;
  }

  if (!confirm(`${selectedIds.size}件のデータを削除してもよろしいですか？\nこの操作は取り消せません。`)) {
    return;
  }

  showLoading();

  try {
    // 並列削除実行
    const deletePromises = Array.from(selectedIds).map(id =>
      window.deleteMaster(currentMasterConfig.collection, id)
    );

    const results = await Promise.all(deletePromises);

    const failedCount = results.filter(r => !r.success).length;

    if (failedCount > 0) {
      console.warn(`⚠️ [Master Manager] ${failedCount}件の削除に失敗`);
      alert(`${results.length - failedCount}件削除しました（${failedCount}件失敗）`);
    } else {
      console.log(`✅ [Master Manager] ${results.length}件削除成功`);
    }

    // 選択モード解除
    toggleSelectionMode();
    
    // データ再読み込み
    await loadMasterData();

  } catch (error) {
    console.error('❌ [Master Manager] 一括削除エラー:', error);
    alert('削除処理でエラーが発生しました');
  } finally {
    hideLoading();
  }
};

/**
 * マスタ表示クリア
 */
function clearMasterDisplay() {
  currentCategory = null;
  currentMasterType = null;
  currentMasterConfig = null;
  allMasterData = [];
  filteredMasterData = [];

  document.getElementById('dataContainer').innerHTML = '';
  document.getElementById('emptyState').classList.remove('hidden');
  document.getElementById('emptyStateText').textContent = 'マスタを選択してください';
  document.getElementById('emptyStateHint').textContent = '';
  
  document.getElementById('headerTitle').innerHTML = '<i class="bi bi-gear"></i> マスタ管理';
  document.getElementById('searchInput').value = '';
  document.getElementById('searchInput').placeholder = '絞り込み検索...';
  document.getElementById('statsText').textContent = '検索結果: 0件';

  // URL更新
  const url = new URL(window.location);
  url.searchParams.delete('category');
  url.searchParams.delete('type');
  window.history.pushState({}, '', url);
}

/**
 * ローディング表示
 */
function showLoading() {
  document.getElementById('loadingOverlay').classList.remove('hidden');
}

/**
 * ローディング非表示
 */
function hideLoading() {
  document.getElementById('loadingOverlay').classList.add('hidden');
}

/**
 * エラー表示
 */
function showError(message) {
  alert(message);
}

/**
 * HTMLエスケープ
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

console.log('✅ [Master Manager] master-manager.js読み込み完了');
