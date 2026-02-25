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

  // v581: フラグメントURLにバージョンパラメータを付与（SW/CDNキャッシュ対策）
  const _FRAGMENT_VERSION = '584';

  // 現在表示中のSPAページ名
  let _currentSpaPage = null;

  // SPA表示中かどうか
  let _isSpaActive = false;

  // v577: レース条件防止用の世代カウンター
  let _switchGeneration = 0;

  // v584: プリフェッチ済みフラグ
  let _prefetchDone = false;

  /**
   * v584: ボトムナビページをバックグラウンドでプリフェッチ
   * 最初のページ表示後に呼び出し、以降のページ遷移を即時化する
   */
  function _prefetchBottomNavPages() {
    if (typeof FURIRA_PAGES === 'undefined') return;
    const fetchedUrls = {};
    for (const pageName in FURIRA_PAGES) {
      const config = FURIRA_PAGES[pageName];
      if (config.type !== 'fragment' || !config.bottomNav) continue;
      if (_fragmentCache[pageName]) continue;

      const url = config.fragmentUrl;
      if (fetchedUrls[url]) {
        // 同じURLを別ページ名で使う場合（todo/todo-list等）、結果を共有
        fetchedUrls[url].then(html => { if (html) _fragmentCache[pageName] = html; });
        continue;
      }

      const fetchUrl = url + '?v=' + _FRAGMENT_VERSION;
      fetchedUrls[url] = fetch(fetchUrl)
        .then(r => r.ok ? r.text() : null)
        .then(html => {
          if (html) {
            _fragmentCache[pageName] = html;
            console.log(`[SPA] プリフェッチ完了: ${pageName}`);
          }
          return html;
        })
        .catch(() => null);
    }
  }

  /**
   * SPAページに切り替え
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

    // v584: スピナーはネットワーク取得時のみ表示（キャッシュヒット時は不要）
    const isCached = !!_fragmentCache[pageName];
    if (!isCached) {
      spaContent.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px"><div class="spinner-border text-primary" role="status"></div></div>';
    }

    try {
      let html;
      if (isCached) {
        // キャッシュヒット → 即時表示
        html = _fragmentCache[pageName];
        console.log(`[SPA] キャッシュから即時表示: ${pageName}`);
      } else {
        // fetchで取得
        const fragmentUrl = pageConfig.fragmentUrl + '?v=' + _FRAGMENT_VERSION;
        const response = await fetch(fragmentUrl);
        if (thisGeneration !== _switchGeneration) {
          console.log(`[SPA] switchPage中断: ${pageName} (新しい遷移が優先)`);
          return false;
        }
        if (!response.ok) {
          throw new Error(`Fragment fetch failed: ${response.status}`);
        }
        html = await response.text();
        if (thisGeneration !== _switchGeneration) {
          console.log(`[SPA] switchPage中断: ${pageName} (新しい遷移が優先)`);
          return false;
        }
        _fragmentCache[pageName] = html;
        console.log(`[SPA] fetchで取得: ${pageName}`);
      }

      if (thisGeneration !== _switchGeneration) {
        return false;
      }

      // DOM注入（scriptタグは後で実行）
      _injectFragment(spaContent, html, pageName);

      // スクロール位置リセット
      spaContent.scrollTop = 0;
      window.scrollTo(0, 0);

      // init関数実行
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

      // v584: 最初のページ表示後にボトムナビページをプリフェッチ
      if (!_prefetchDone) {
        _prefetchDone = true;
        setTimeout(_prefetchBottomNavPages, 300);
      }

    } catch (error) {
      if (thisGeneration !== _switchGeneration) {
        return false;
      }
      console.error(`[SPA] Fragment読み込みエラー: ${pageName}`, error);
      _deactivateSpa();
      return false;
    }

    return true;
  }

  /**
   * Fragment HTMLをDOMに注入し、<script>タグを実行
   */
  function _injectFragment(container, html, pageName) {
    container.innerHTML = html;

    const scripts = container.querySelectorAll('script');
    scripts.forEach(oldScript => {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => {
        if (attr.name === 'type' && attr.value === 'module') return;
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

    if (pageConfig && pageConfig.destroy && typeof window[pageConfig.destroy] === 'function') {
      try {
        window[pageConfig.destroy]();
        console.log(`[SPA] destroy実行: ${pageConfig.destroy}()`);
      } catch (e) {
        console.error(`[SPA] destroy失敗: ${pageConfig.destroy}()`, e);
      }
    }

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

  function _deactivateSpa() {
    cleanupCurrentPage();
    const spaContent = document.getElementById('spa-content');
    const iframe = document.getElementById('gas-iframe');
    if (spaContent) spaContent.style.display = 'none';
    if (iframe) iframe.style.display = '';
    _isSpaActive = false;
  }

  function deactivateSpaIfNeeded() {
    if (_isSpaActive) {
      _deactivateSpa();
    }
  }

  function isSpaActive() {
    return _isSpaActive;
  }

  function getCurrentSpaPage() {
    return _currentSpaPage;
  }

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
