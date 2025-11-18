/**
 * REBORN在庫管理システム - Firestore版ブランドサジェスト
 *
 * Firestoreから直接ブランドを検索して、サジェスト表示する高速版
 * GAS APIの起動コスト（2〜2.5秒）を回避し、リアルタイム検索を実現
 *
 * @module brand-suggest-firestore
 * @version 1.0.0
 * @created 2025-11-14
 * @related-issue ARCH-001-3.2
 */

// ============================================
// ユーティリティ関数
// ============================================

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
// ブランドサジェスト関数（Firestore版）
// ============================================

/**
 * Firestore版ブランドサジェスト機能をアタッチ
 *
 * ユーザーが入力するとFirestoreからリアルタイムで検索し、
 * 結果をサジェストパネルに表示します。
 *
 * @param {string} inputId - 入力フィールドのID（例: 'ブランド(英語)'）
 * @param {Object} options - オプション設定
 * @param {number} options.limit - 表示件数（デフォルト: 15）
 * @param {number} options.minChars - 最小入力文字数（デフォルト: 1）
 * @param {number} options.debounceMs - デバウンス時間（デフォルト: 300ms）
 *
 * @example
 * // 基本的な使い方
 * attachBrandSuggestFirestore('ブランド(英語)');
 *
 * // カスタム設定
 * attachBrandSuggestFirestore('ブランド(英語)', {
 *   limit: 20,
 *   minChars: 2,
 *   debounceMs: 500
 * });
 */
function attachBrandSuggestFirestore(inputId, options = {}) {
  // オプションのデフォルト値
  const limit = options.limit || 15;
  const minChars = options.minChars || 1;
  const debounceMs = options.debounceMs || 300;

  // バックグラウンドでプリロード開始（5秒遅延で管理番号UI優先）
  // ただし、postMessageで受信したキャッシュがあればスキップ
  if (!window.brandsPreloadScheduled && !window.brandsCache) {
    window.brandsPreloadScheduled = true;
    setTimeout(() => {
      // 再度チェック: タイムアウト前にpostMessageで受信していたらスキップ
      if (!window.brandsCache) {
        console.log('⏰ ブランドプリロード開始（5秒遅延、Firestore直接アクセス）');
        preloadBrandsInBackground();
      } else {
        console.log('✅ ブランドキャッシュが既に存在（postMessage受信済み）、Firestoreプリロードをスキップ');
      }
    }, 5000);
  } else if (window.brandsCache) {
    console.log('✅ ブランドキャッシュが既に存在（postMessage受信済み）、Firestoreプリロードをスキップ');
  }

  const input = document.getElementById(inputId);
  const panel = document.getElementById('suggest-' + inputId);

  if (!input || !panel) {
    console.warn(`[Brand Suggest Firestore] Missing elements for ${inputId}:`, {
      input: !!input,
      panel: !!panel
    });
    return;
  }

  console.log(`[Brand Suggest Firestore] Attached to ${inputId}`);

  let activeIndex = -1;
  let currentBrands = [];
  let debounceTimer = null;

  // ============================================
  // レンダリング関数
  // ============================================

  const render = (brands) => {
    panel.innerHTML = '';
    currentBrands = brands;

    if (!brands || brands.length === 0) {
      panel.innerHTML = '<div class="sug-empty">候補なし</div>';
      panel.hidden = false;
      return;
    }

    brands.slice(0, limit).forEach((brand, i) => {
      const div = document.createElement('div');
      div.className = 'sug-item brand-item';

      // HTMLエスケープ
      const escapedNameEn = escapeHtml(brand.nameEn);
      const escapedNameKana = escapeHtml(brand.nameKana);

      // 2行表示（英語名 + カナ名）
      div.innerHTML = `
        <div class="brand-english">${escapedNameEn}</div>
        <div class="brand-kana">${escapedNameKana}</div>
      `;

      // データ属性に保存
      div.dataset.brandId = brand.id;
      div.dataset.nameEn = brand.nameEn;
      div.dataset.nameKana = brand.nameKana;

      // マウスホバーイベント
      div.addEventListener('mousemove', () => {
        Array.from(panel.querySelectorAll('.sug-item')).forEach(x => x.classList.remove('active'));
        div.classList.add('active');
        activeIndex = i;
      });

      // マウスダウンイベント（フォーカス維持）
      div.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });

      // クリックイベント
      div.addEventListener('click', () => {
        selectBrand(brand);
      });

      panel.appendChild(div);
    });

    panel.hidden = false;
  };

  // ============================================
  // ブランド選択処理
  // ============================================

  const selectBrand = (brand) => {
    // 英語名を入力フィールドに設定
    input.value = brand.nameEn;

    // カナ名を隠しフィールドに設定
    const kanaField = document.getElementById(inputId.replace('(英語)', '(カナ)'));
    if (kanaField) {
      kanaField.value = brand.nameKana;
    }

    // 使用カウントをインクリメント（バックグラウンドで実行）
    if (typeof incrementBrandUsageCount === 'function') {
      incrementBrandUsageCount(brand.id).catch(err => {
        console.warn('[Brand Suggest] 使用カウント更新失敗:', err);
      });
    }

    hide();

    // 基本情報のブランド(英語)選択時の追加処理
    if (inputId === 'ブランド(英語)') {
      // 商品名ブロックのブランドフィールドにも反映（GAS版と同じ動作）
      const titleBrandEnField = document.getElementById('商品名_ブランド(英語)');
      const titleBrandKanaField = document.getElementById('商品名_ブランド(カナ)');
      
      if (titleBrandEnField) {
        titleBrandEnField.value = brand.nameEn;
      }
      if (titleBrandKanaField) {
        titleBrandKanaField.value = brand.nameKana;
      }
      
      console.log(`商品名ブロックに反映: ${brand.nameEn} / ${brand.nameKana}`);
      
      // 商品名プレビュー更新
      if (typeof updateNamePreview === 'function') {
        updateNamePreview();
      }
      // 商品説明更新
      if (typeof updateDescriptionFromDetail === 'function') {
        updateDescriptionFromDetail();
      }
    } else if (inputId === '商品名_ブランド(英語)') {
      // 商品名ブロックの場合
      if (typeof updateNamePreview === 'function') {
        updateNamePreview();
      }
      if (typeof updateDescriptionFromDetail === 'function') {
        updateDescriptionFromDetail();
      }
    }
  };

  // ============================================
  // パネル表示/非表示
  // ============================================

  const hide = () => {
    panel.hidden = true;
    activeIndex = -1;
    currentBrands = [];
  };

  const hideLater = () => setTimeout(hide, 100);

  // ============================================
  // 検索処理（Firestore）
  // ============================================

  const doSearch = () => {
    let query = (input.value || '').trim();

    // ひらがなをカタカナに変換
    query = hiraganaToKatakana(query);

    // 最小文字数チェック
    if (query.length < minChars) {
      hide();
      return;
    }

    // キャッシュがまだロードされていない場合
    if (!window.brandsCache) {
      panel.innerHTML = '<div class="sug-empty">読み込み中...</div>';
      panel.hidden = false;
      return;
    }

    try {
      console.log(`[Brand Suggest] 検索開始: "${query}"`);
      const startTime = performance.now();

      // キャッシュから検索（即座）
      if (typeof searchBrandsFromCache !== 'function') {
        console.error('[Brand Suggest] searchBrandsFromCache関数が見つかりません');
        return;
      }

      const brands = window.searchBrandsFromCache(query, limit);
      const endTime = performance.now();

      console.log(`[Brand Suggest] 検索完了: ${brands.length}件 (${(endTime - startTime).toFixed(2)}ms)`);

      // 結果を表示
      render(brands);

    } catch (error) {
      console.error('[Brand Suggest] 検索エラー:', error);
      panel.innerHTML = '<div class="sug-empty">検索エラー</div>';
      panel.hidden = false;
    }
  };

  // デバウンス付き検索
  const debouncedSearch = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(doSearch, debounceMs);
  };

  // ============================================
  // イベントリスナー登録
  // ============================================

  // 入力イベント
  input.addEventListener('input', debouncedSearch);

  // キーボードナビゲーション
  input.addEventListener('keydown', (e) => {
    if (panel.hidden || currentBrands.length === 0) {
      return;
    }

    const items = Array.from(panel.querySelectorAll('.sug-item'));

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        items.forEach((item, i) => {
          item.classList.toggle('active', i === activeIndex);
        });
        break;

      case 'ArrowUp':
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach((item, i) => {
          item.classList.toggle('active', i === activeIndex);
        });
        break;

      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < currentBrands.length) {
          selectBrand(currentBrands[activeIndex]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        hide();
        break;
    }
  });

  // フォーカス喪失時に非表示
  input.addEventListener('blur', hideLater);

  // フォーカス時に再検索（空の場合は人気上位を表示）
  input.addEventListener('focus', () => {
    if (input.value.trim().length >= minChars) {
      doSearch();
    }
  });
}

// ============================================
// グローバルエクスポート
// ============================================

if (typeof window !== 'undefined') {
  window.attachBrandSuggestFirestore = attachBrandSuggestFirestore;
  window.hiraganaToKatakana = hiraganaToKatakana;
  console.log('[Brand Suggest Firestore] モジュール読み込み完了');
}

// ES6モジュールエクスポート（import文用）
export {
  attachBrandSuggestFirestore,
  hiraganaToKatakana
};
