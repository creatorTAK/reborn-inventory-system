/**
 * SPA Router — Fragment読み込み + キャッシュ管理
 *
 * switchPage(pageName): FURIRA_PAGESに登録済みならFragment読み込み、未登録はfalse返却
 * cleanupCurrentPage(): 前ページのdestroy関数を呼び、DOMをクリア
 */
(function() {
  'use strict';

  // Fragment HTMLキャッシュ（2回目以降は即時表示）
  const _fragmentCache = {};

  // 現在表示中のSPAページ名
  let _currentSpaPage = null;

  // SPA表示中かどうか
  let _isSpaActive = false;

  // v577: レース条件防止用の世代カウンター
  // 新しいswitchPageが呼ばれるたびにインクリメント
  // await後にカウンターが変わっていたら中断（後の遷移が優先）
  let _switchGeneration = 0;

  /**
   * SPAページに切り替え
   * @param {string} pageName - FURIRA_PAGESのキー
   * @returns {boolean} SPA処理したならtrue、iframe fallbackが必要ならfalse
   */
  async function switchPage(pageName) {
    // FURIRA_PAGESに未登録 → iframe fallback
    if (typeof FURIRA_PAGES === 'undefined' || !FURIRA_PAGES[pageName]) {
      return false;
    }

    const pageConfig = FURIRA_PAGES[pageName];
    if (pageConfig.type !== 'fragment') {
      return false;
    }

    // v577: この呼び出しの世代番号を記録
    const thisGeneration = ++_switchGeneration;

    const startTime = performance.now();
    console.log(`[SPA] switchPage: ${pageName} 開始 (gen:${thisGeneration})`);

    // 前ページのクリーンアップ
    cleanupCurrentPage();

    const spaContent = document.getElementById('spa-content');
    const iframe = document.getElementById('gas-iframe');
    if (!spaContent || !iframe) {
      console.error('[SPA] #spa-content or #gas-iframe not found');
      return false;
    }

    // iframe非表示 → SPA表示
    iframe.style.display = 'none';
    spaContent.style.display = 'block';

    _isSpaActive = true;
    _currentSpaPage = pageName;

    try {
      let html;
      if (_fragmentCache[pageName]) {
        // キャッシュヒット
        html = _fragmentCache[pageName];
        console.log(`[SPA] キャッシュから読み込み: ${pageName}`);
      } else {
        // fetchで取得
        const response = await fetch(pageConfig.fragmentUrl);
        // v577: await後にレース条件チェック
        if (thisGeneration !== _switchGeneration) {
          console.log(`[SPA] switchPage中断: ${pageName} (新しい遷移が優先 gen:${thisGeneration}→${_switchGeneration})`);
          return false;
        }
        if (!response.ok) {
          throw new Error(`Fragment fetch failed: ${response.status}`);
        }
        html = await response.text();
        // v577: 2回目のレース条件チェック
        if (thisGeneration !== _switchGeneration) {
          console.log(`[SPA] switchPage中断: ${pageName} (新しい遷移が優先 gen:${thisGeneration}→${_switchGeneration})`);
          return false;
        }
        _fragmentCache[pageName] = html;
        console.log(`[SPA] fetchで取得: ${pageName}`);
      }

      // v577: DOM注入前の最終チェック
      if (thisGeneration !== _switchGeneration) {
        console.log(`[SPA] switchPage中断: ${pageName} (新しい遷移が優先)`);
        return false;
      }

      // DOM注入（scriptタグは後で実行）
      _injectFragment(spaContent, html, pageName);

      // スクロール位置リセット（DOM注入後に実行）
      spaContent.scrollTop = 0;
      window.scrollTo(0, 0);

      // v577: init関数を個別try-catchで実行
      // init失敗してもページDOMは表示を維持（SPA全体を停止しない）
      if (pageConfig.init && typeof window[pageConfig.init] === 'function') {
        try {
          window[pageConfig.init]();
          console.log(`[SPA] init実行: ${pageConfig.init}()`);
        } catch (initError) {
          console.error(`[SPA] init関数エラー: ${pageConfig.init}()`, initError);
        }
      }

      const loadTime = performance.now() - startTime;
      console.log(`[SPA] ${pageName} 表示完了: ${loadTime.toFixed(0)}ms`);

    } catch (error) {
      // v577: 中断された遷移のエラーは無視
      if (thisGeneration !== _switchGeneration) {
        console.log(`[SPA] 中断済み遷移のエラーを無視: ${pageName}`);
        return false;
      }
      console.error(`[SPA] Fragment読み込みエラー: ${pageName}`, error);
      // エラー時はiframeにfallback
      _deactivateSpa();
      return false;
    }

    return true;
  }

  /**
   * Fragment HTMLをDOMに注入し、<script>タグを実行
   */
  function _injectFragment(container, html, pageName) {
    // まずHTMLを注入（scriptは実行されない）
    container.innerHTML = html;

    // scriptタグを抽出して順次実行
    const scripts = container.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');

      // 属性をコピー
      Array.from(oldScript.attributes).forEach(attr => {
        // type="module" はSPAでは通常のスクリプトとして実行
        if (attr.name === 'type' && attr.value === 'module') {
          // moduleスクリプトはスキップ（Fragment側で不要にしている）
          return;
        }
        newScript.setAttribute(attr.name, attr.value);
      });

      newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
    });
  }

  /**
   * 現在のSPAページをクリーンアップ
   */
  function cleanupCurrentPage() {
    if (!_currentSpaPage || !_isSpaActive) return;

    const pageConfig = typeof FURIRA_PAGES !== 'undefined' ? FURIRA_PAGES[_currentSpaPage] : null;

    // destroy関数を呼び出し
    if (pageConfig && pageConfig.destroy && typeof window[pageConfig.destroy] === 'function') {
      try {
        window[pageConfig.destroy]();
        console.log(`[SPA] destroy実行: ${pageConfig.destroy}()`);
      } catch (e) {
        console.error(`[SPA] destroy失敗: ${pageConfig.destroy}()`, e);
      }
    }

    // v575: ボトムナビ・レイアウトをデフォルト状態に復元
    // destroyが失敗した場合や、destroyで復元しないページでも確実にリセット
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.classList.remove('hidden');
    const spaContent = document.getElementById('spa-content');
    if (spaContent) {
      spaContent.style.bottom = '';
      spaContent.style.overflow = '';
      spaContent.innerHTML = '';
    }

    _currentSpaPage = null;
  }

  /**
   * SPA表示を解除してiframe表示に戻す
   */
  function _deactivateSpa() {
    cleanupCurrentPage();

    const spaContent = document.getElementById('spa-content');
    const iframe = document.getElementById('gas-iframe');

    if (spaContent) spaContent.style.display = 'none';
    if (iframe) iframe.style.display = '';

    _isSpaActive = false;
  }

  /**
   * iframeに遷移する前にSPAをクリーンアップ（navigateToPage内で呼ぶ）
   */
  function deactivateSpaIfNeeded() {
    if (_isSpaActive) {
      _deactivateSpa();
    }
  }

  /**
   * SPAが現在アクティブかどうか
   */
  function isSpaActive() {
    return _isSpaActive;
  }

  /**
   * 現在のSPAページ名
   */
  function getCurrentSpaPage() {
    return _currentSpaPage;
  }

  /**
   * Fragment goBack — 親のgoBackInHistory()を呼ぶ
   * Fragment内の戻るボタンから使用
   */
  function spaGoBack() {
    if (typeof goBackInHistory === 'function') {
      goBackInHistory();
    } else {
      navigateToPage('home', { skipHistory: true });
    }
  }

  // グローバルに公開
  window.switchPage = switchPage;
  window.cleanupCurrentPage = cleanupCurrentPage;
  window.deactivateSpaIfNeeded = deactivateSpaIfNeeded;
  window.isSpaActive = isSpaActive;
  window.getCurrentSpaPage = getCurrentSpaPage;
  window.spaGoBack = spaGoBack;

})();
