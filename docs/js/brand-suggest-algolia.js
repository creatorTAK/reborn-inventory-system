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

  // Algoliaクライアント初期化（CDN版）
  let searchClient;

  // Algolia SDKをCDNから読み込み（scriptタグで読み込まれる想定）
  if (typeof window.algoliasearch === 'undefined') {
    console.error('❌ [Algolia] algoliasearch SDKが読み込まれていません');
    console.log('💡 product.htmlに<script src="https://cdn.jsdelivr.net/npm/algoliasearch@4/dist/algoliasearch-lite.umd.js"></script>を追加してください');
    return;
  }

  try {
    searchClient = window.algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);
    console.log('✅ [Algolia] クライアント初期化成功');
  } catch (error) {
    console.error('❌ [Algolia] クライアント初期化エラー:', error);
    return;
  }

  // インデックス初期化
  const index = searchClient.initIndex(ALGOLIA_INDEX_NAME);

  let debounceTimer = null;

  /**
   * Algoliaでブランド検索
   */
  async function searchBrands(query) {
    try {
      const startTime = performance.now();

      // ひらがなをカタカナに変換（例: なぎけ → ナイキ）
      const convertedQuery = hiraganaToKatakana(query);

      // v4 APIでは index.search() を使用
      const { hits } = await index.search(convertedQuery, {
        hitsPerPage: limit,
        attributesToRetrieve: ['id', 'name', 'nameKana', 'usageCount']
      });

      const brands = hits;

      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);

      console.log(`✅ [Algolia] 検索完了: "${query}" → "${convertedQuery}" → ${brands.length}件 (${duration}ms)`);

      return brands;

    } catch (error) {
      console.error('❌ [Algolia] 検索エラー:', error);
      return [];
    }
  }

  /**
   * サジェストパネルを表示（Firestore版と同じ2行表示）
   */
  function showSuggestions(brands) {
    if (brands.length === 0) {
      panel.style.display = 'none';
      return;
    }

    panel.innerHTML = '';

    brands.forEach((brand, i) => {
      const div = document.createElement('div');
      div.className = 'sug-item brand-item';

      // HTMLエスケープ
      const escapedNameEn = escapeHtml(brand.name || '');
      const escapedNameKana = escapeHtml(brand.nameKana || '');

      // 2行表示（英語名 + カナ名）
      div.innerHTML = `
        <div class="brand-english">${escapedNameEn}</div>
        <div class="brand-kana">${escapedNameKana}</div>
      `;

      // データ属性に保存
      div.dataset.brandId = brand.id;
      div.dataset.nameEn = brand.name || '';
      div.dataset.nameKana = brand.nameKana || '';

      // マウスホバーイベント
      div.addEventListener('mousemove', () => {
        Array.from(panel.querySelectorAll('.sug-item')).forEach(x => x.classList.remove('active'));
        div.classList.add('active');
      });

      // マウスダウンイベント（フォーカス維持）
      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });

      // クリックイベント
      div.addEventListener('click', () => {
        const brandNameEn = brand.name || '';
        const brandNameKana = brand.nameKana || '';

        // 英語名を入力フィールドに設定
        input.value = brandNameEn || brandNameKana;
        panel.style.display = 'none';

        // カナ名を隠しフィールドに設定
        const kanaField = document.getElementById('ブランド(カナ)');
        if (kanaField) {
          kanaField.value = brandNameKana;
        }

        // 商品名ブロックのブランドフィールドに反映
        const titleBrandEnField = document.getElementById('商品名_ブランド(英語)');
        const titleBrandKanaField = document.getElementById('商品名_ブランド(カナ)');
        if (titleBrandEnField) {
          titleBrandEnField.value = brandNameEn;
        }
        if (titleBrandKanaField) {
          titleBrandKanaField.value = brandNameKana;
        }

        // updateBrandDisplay() を呼び出し（商品名プレビュー更新）
        if (typeof window.updateBrandDisplay === 'function') {
          window.updateBrandDisplay();
        }

        // updateNamePreview() を呼び出し
        if (typeof window.updateNamePreview === 'function') {
          window.updateNamePreview();
        }

        // 入力イベントを発火（他のハンドラーに通知）
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });

      panel.appendChild(div);
    });

    panel.style.display = 'block';
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
