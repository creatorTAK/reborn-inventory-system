/**
 * SPA Router v585 — DOM保持型ページ切替
 *
 * 一度表示したページのDOMはメモリに保持し、
 * 再訪問時はDOM表示切替のみ（fetch/パース/スクリプト実行なし）。
 * 初回訪問時のみfetch + inject + スクリプト実行を行う。
 */
(function() {
  'use strict';

  // Fragment HTMLキャッシュ（プリフェッチ用。初回injectに使用）
  const _fragmentCache = {};

  // DOM保持キャッシュ（ページ名 → DOMコンテナ要素）
  // 一度表示したページのDOMを保持し、再訪問時は表示切替のみ
  const _pageContainers = {};

  const _FRAGMENT_VERSION = '586';

  let _currentSpaPage = null;
  let _isSpaActive = false;
  let _switchGeneration = 0;
  let _prefetchDone = false;

  /**
   * ボトムナビページをバックグラウンドでHTMLプリフェッチ
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
    if (typeof FURIRA_PAGES === 'undefined' || !FURIRA_PAGES[pageName]) {
      return false;
    }

    const pageConfig = FURIRA_PAGES[pageName];
    if (pageConfig.type !== 'fragment') {
      return false;
    }

    const thisGeneration = ++_switchGeneration;
    const startTime = performance.now();

    // 現在ページを非表示（DOMは保持）
    _hideCurrentPage();

    const spaContent = document.getElementById('spa-content');
    const iframe = document.getElementById('gas-iframe');
    if (!spaContent || !iframe) return false;

    // スピナーが残っていれば除去
    const oldSpinner = document.getElementById('spa-loading-spinner');
    if (oldSpinner) oldSpinner.remove();

    iframe.style.display = 'none';
    spaContent.style.display = 'block';
    _isSpaActive = true;
    _currentSpaPage = pageName;

    // ========================================
    // ★ 再訪問: キャッシュ済みDOMを即時表示
    // ========================================
    if (_pageContainers[pageName]) {
      _pageContainers[pageName].style.display = '';
      spaContent.scrollTop = 0;
      window.scrollTo(0, 0);

      // init呼び出し（データ再取得 + リスナー再登録）
      if (pageConfig.init && typeof window[pageConfig.init] === 'function') {
        try {
          window[pageConfig.init]();
        } catch (e) {
          console.error(`[SPA] init関数エラー: ${pageConfig.init}()`, e);
        }
      }

      console.log(`[SPA] ★ ${pageName} 即時表示: ${(performance.now() - startTime).toFixed(0)}ms`);
      return true;
    }

    // ========================================
    // 初回訪問: fetch → コンテナ作成 → inject
    // ========================================
    console.log(`[SPA] ${pageName} 初回読み込み開始`);

    // スピナー表示
    const spinnerEl = document.createElement('div');
    spinnerEl.id = 'spa-loading-spinner';
    spinnerEl.style.cssText = 'display:flex;align-items:center;justify-content:center;height:200px';
    spinnerEl.innerHTML = '<div class="spinner-border text-primary" role="status"></div>';
    spaContent.appendChild(spinnerEl);

    try {
      let html;
      if (_fragmentCache[pageName]) {
        html = _fragmentCache[pageName];
      } else {
        const fragmentUrl = pageConfig.fragmentUrl + '?v=' + _FRAGMENT_VERSION;
        const response = await fetch(fragmentUrl);
        if (thisGeneration !== _switchGeneration) return false;
        if (!response.ok) throw new Error(`Fragment fetch failed: ${response.status}`);
        html = await response.text();
        if (thisGeneration !== _switchGeneration) return false;
        _fragmentCache[pageName] = html;
      }

      if (thisGeneration !== _switchGeneration) return false;

      // スピナー除去
      if (spinnerEl.parentNode) spinnerEl.remove();

      // ページコンテナ作成 & DOM注入
      const container = document.createElement('div');
      container.setAttribute('data-spa-page', pageName);
      spaContent.appendChild(container);
      _pageContainers[pageName] = container;

      _injectFragment(container, html, pageName);

      spaContent.scrollTop = 0;
      window.scrollTo(0, 0);

      // init実行
      if (pageConfig.init && typeof window[pageConfig.init] === 'function') {
        try {
          window[pageConfig.init]();
        } catch (e) {
          console.error(`[SPA] init関数エラー: ${pageConfig.init}()`, e);
        }
      }

      console.log(`[SPA] ${pageName} 初回表示完了: ${(performance.now() - startTime).toFixed(0)}ms`);

      // プリフェッチ開始（初回ページ表示後）
      if (!_prefetchDone) {
        _prefetchDone = true;
        setTimeout(_prefetchBottomNavPages, 300);
      }

    } catch (error) {
      if (thisGeneration !== _switchGeneration) return false;
      console.error(`[SPA] Fragment読み込みエラー: ${pageName}`, error);
      if (spinnerEl.parentNode) spinnerEl.remove();
      _deactivateSpa();
      return false;
    }

    return true;
  }

  /**
   * Fragment HTMLをコンテナに注入し、scriptタグを実行
   */
  function _injectFragment(container, html) {
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
   * 現在ページを非表示にする（DOMは保持、destroyは呼ぶ）
   */
  function _hideCurrentPage() {
    if (!_currentSpaPage || !_isSpaActive) return;

    const pageConfig = typeof FURIRA_PAGES !== 'undefined' ? FURIRA_PAGES[_currentSpaPage] : null;

    // destroy呼び出し（リスナー解除、タイマー停止等）
    if (pageConfig && pageConfig.destroy && typeof window[pageConfig.destroy] === 'function') {
      try {
        window[pageConfig.destroy]();
      } catch (e) {
        console.error(`[SPA] destroy失敗: ${pageConfig.destroy}()`, e);
      }
    }

    // ページコンテナを非表示（DOMは残す）
    if (_pageContainers[_currentSpaPage]) {
      _pageContainers[_currentSpaPage].style.display = 'none';
    }

    // ボトムナビ・レイアウトをデフォルト状態に復元
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) bottomNav.classList.remove('hidden');
    const spaContent = document.getElementById('spa-content');
    if (spaContent) {
      spaContent.style.bottom = '';
      spaContent.style.overflow = '';
    }

    _currentSpaPage = null;
  }

  /**
   * 後方互換: 外部からのクリーンアップ呼び出し
   */
  function cleanupCurrentPage() {
    _hideCurrentPage();
  }

  /**
   * SPA表示を解除してiframe表示に戻す
   */
  function _deactivateSpa() {
    _hideCurrentPage();
    const spaContent = document.getElementById('spa-content');
    const iframe = document.getElementById('gas-iframe');
    if (spaContent) spaContent.style.display = 'none';
    if (iframe) iframe.style.display = '';
    _isSpaActive = false;
  }

  function deactivateSpaIfNeeded() {
    if (_isSpaActive) _deactivateSpa();
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
