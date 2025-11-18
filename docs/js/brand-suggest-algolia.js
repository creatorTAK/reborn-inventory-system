/**
 * REBORN在庫管理システム - Algolia版ブランドサジェスト
 *
 * Algoliaから高速にブランドを検索して、サジェスト表示
 * - 検索速度: 50-100ms（Firestore直接アクセスより高速）
 * - プリロード不要: 検索時のみAlgoliaにアクセス
 *
 * @module brand-suggest-algolia
 * @version 1.0.0
 * @created 2025-11-19
 */

// Algolia認証情報（Search-Only API Key - 公開OK）
const ALGOLIA_APP_ID = 'P68RUXXTYN';
const ALGOLIA_SEARCH_KEY = '12758e11bbd889f72177b459d296ed50';
const ALGOLIA_INDEX_NAME = 'brands';

// ============================================
// ユーティリティ関数
// ============================================

/**
 * HTMLエスケープ
 * @param {string} str - エスケープする文字列
 * @returns {string} エスケープされた文字列
 */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================
// Algoliaブランドサジェスト
// ============================================

/**
 * Algolia版ブランドサジェスト機能をアタッチ
 *
 * @param {string} inputId - 入力フィールドのID（例: 'ブランド(英語)'）
 * @param {Object} options - オプション設定
 * @param {number} options.limit - 表示件数（デフォルト: 15）
 * @param {number} options.minChars - 最小入力文字数（デフォルト: 1）
 * @param {number} options.debounceMs - デバウンス時間（デフォルト: 300ms）
 */
async function attachBrandSuggestAlgolia(inputId, options = {}) {
  // オプションのデフォルト値
  const limit = options.limit || 15;
  const minChars = options.minChars || 1;
  const debounceMs = options.debounceMs || 300;

  const input = document.getElementById(inputId);
  const panel = document.getElementById('suggest-' + inputId);

  if (!input || !panel) {
    console.warn(`[Brand Suggest Algolia] Missing elements for ${inputId}:`, {
      input: !!input,
      panel: !!panel
    });
    return;
  }

  // Algoliaクライアント初期化（動的インポート）
  let searchClient;
  try {
    const { algoliasearch } = await import('https://cdn.jsdelivr.net/npm/algoliasearch@5/dist/builds/browser.min.js');
    searchClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);
    console.log('✅ [Algolia] クライアント初期化成功');
  } catch (error) {
    console.error('❌ [Algolia] クライアント初期化エラー:', error);
    return;
  }

  let debounceTimer = null;
  let currentRequest = null;

  /**
   * Algoliaでブランド検索
   */
  async function searchBrands(query) {
    try {
      const startTime = performance.now();

      // 前回のリクエストをキャンセル
      if (currentRequest) {
        currentRequest.abort();
      }

      currentRequest = new AbortController();

      const { results } = await searchClient.search({
        requests: [
          {
            indexName: ALGOLIA_INDEX_NAME,
            query: query,
            hitsPerPage: limit,
            attributesToRetrieve: ['id', 'name', 'nameKana', 'usageCount']
          }
        ]
      });

      const brands = results[0].hits;

      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);

      console.log(`✅ [Algolia] 検索完了: "${query}" → ${brands.length}件 (${duration}ms)`);

      return brands;

    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('⏹️  [Algolia] 検索キャンセル');
        return [];
      }
      console.error('❌ [Algolia] 検索エラー:', error);
      return [];
    } finally {
      currentRequest = null;
    }
  }

  /**
   * サジェストパネルを表示
   */
  function showSuggestions(brands) {
    if (brands.length === 0) {
      panel.style.display = 'none';
      return;
    }

    const html = brands.map(brand => {
      const displayName = brand.name || brand.nameKana || brand.id;
      const displayKana = brand.nameKana || '';
      const count = brand.usageCount || 0;

      return `
        <div class="suggest-item" data-value="${escapeHtml(brand.name)}" data-id="${escapeHtml(brand.id)}">
          <strong>${escapeHtml(displayName)}</strong>
          ${displayKana ? `<span class="kana">${escapeHtml(displayKana)}</span>` : ''}
          ${count > 0 ? `<span class="count">(${count})</span>` : ''}
        </div>
      `;
    }).join('');

    panel.innerHTML = html;
    panel.style.display = 'block';

    // クリックイベント登録
    panel.querySelectorAll('.suggest-item').forEach(item => {
      item.addEventListener('click', function() {
        const value = this.getAttribute('data-value');
        input.value = value;
        panel.style.display = 'none';

        // 入力イベントを発火（他のハンドラーに通知）
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
    });
  }

  /**
   * 入力イベントハンドラー
   */
  input.addEventListener('input', function() {
    const query = this.value.trim();

    // デバウンスタイマーをクリア
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    // 最小文字数未満の場合、パネルを非表示
    if (query.length < minChars) {
      panel.style.display = 'none';
      return;
    }

    // デバウンス処理
    debounceTimer = setTimeout(async () => {
      const brands = await searchBrands(query);
      showSuggestions(brands);
    }, debounceMs);
  });

  // フォーカス時にパネルを表示（既に入力がある場合）
  input.addEventListener('focus', function() {
    const query = this.value.trim();
    if (query.length >= minChars && panel.innerHTML) {
      panel.style.display = 'block';
    }
  });

  // フォーカスアウト時にパネルを非表示（少し遅延させてクリックイベントを処理）
  input.addEventListener('blur', function() {
    setTimeout(() => {
      panel.style.display = 'none';
    }, 200);
  });

  console.log(`✅ [Brand Suggest Algolia] ${inputId} に Algolia検索機能をアタッチしました`);
}

// グローバルスコープに公開
window.attachBrandSuggestAlgolia = attachBrandSuggestAlgolia;
