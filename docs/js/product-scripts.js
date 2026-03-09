function navigateInPWA(url) {
  try {
    // iframe内にいる場合、最上位ウィンドウにpostMessageで通知
    if (window.top && window.top !== window.self) {
      console.log('📤 postMessage送信 (to window.top):', url);
      window.top.postMessage({
        type: 'navigate',
        url: url
      }, '*'); // GASのサンドボックスiframeから送信するため、ワイルドカードを使用
    } else {
      // iframe外（通常のブラウザ）の場合
      window.location.href = url;
    }
  } catch (e) {
    console.error('❌ ナビゲーションエラー:', e);
    // フォールバック: 通常の遷移
    window.location.href = url;
  }
}

async function goBack() {
    console.log('[goBack] >>> called at', new Date().toISOString());
    const isInIframe = window.self !== window.top;
    console.log('[goBack] isInIframe:', isInIframe);

    if (isInIframe) {
      // 親に「戻りたい」という要求だけ送る（親が履歴を見て判断）
      window.top.postMessage({ type: 'requestBack' }, '*');
      console.log('[goBack] ✅ requestBack sent to parent');
    } else {
      google.script.host.close();
    }
  }
  
  document.addEventListener('DOMContentLoaded', () => {
      const backButton = document.getElementById('back-button');
    console.log('[sidebar_product] backButton element:', backButton);
    
    if (backButton) {
      backButton.addEventListener('click', goBack);
        } else {
      console.error('[sidebar_product] ❌ 戻るボタンが見つかりません');
    }
  });

console.log('[product.html] ✅ Script loaded - Version @316-ConditionRank');

// ====================================
// 商品の状態 → ランク マッピング
// ====================================
const CONDITION_TO_RANK_MAP = {
  // メルカリ・共通
  '新品、未使用': { code: 'S', name: '新品同様' },
  '未使用に近い': { code: 'A', name: '非常に良い' },
  '目立った傷や汚れなし': { code: 'B', name: '良い' },
  'やや傷や汚れあり': { code: 'C', name: 'やや難あり' },
  '傷や汚れあり': { code: 'D', name: '難あり' },
  // 追加パターン
  '新品・未使用': { code: 'S', name: '新品同様' },
  '未使用': { code: 'S', name: '新品同様' },
  '新品': { code: 'S', name: '新品同様' }
};

// 現在のランク（商品の状態から自動設定）
window.currentConditionRank = null;

/**
 * 商品の状態からランクを取得
 * @param {string} condition - 商品の状態
 * @returns {object|null} - { code: 'S', name: '新品同様' } または null
 */
function getConditionRank(condition) {
  if (!condition) return null;
  return CONDITION_TO_RANK_MAP[condition] || null;
}

/**
 * 商品の状態変更時にランクを更新
 */
function onConditionChange() {
  const conditionSelect = document.getElementById('商品の状態');
  if (!conditionSelect) return;

  const condition = conditionSelect.value;
  window.currentConditionRank = getConditionRank(condition);

  // 隠しフィールドを更新
  const rankHidden = document.getElementById('ランク');

  // ランク表示バッジを更新（商品状態詳細セクション内）
  const rankBadge = document.getElementById('conditionRankBadge');
  const rankDisplay = document.getElementById('conditionRankDisplay');

  if (window.currentConditionRank) {
    const rankText = `${window.currentConditionRank.code}: ${window.currentConditionRank.name}`;
    if (rankHidden) rankHidden.value = window.currentConditionRank.code;

    // バッジを表示
    if (rankBadge) rankBadge.style.display = 'block';
    if (rankDisplay) rankDisplay.textContent = rankText;

    console.log(`✅ [ランク連動] ${condition} → ${rankText}`);
  } else {
    if (rankHidden) rankHidden.value = '';

    // バッジを非表示
    if (rankBadge) rankBadge.style.display = 'none';
    if (rankDisplay) rankDisplay.textContent = '';

    if (condition) {
      console.log(`ℹ️ [ランク連動] 商品の状態「${condition}」に対応するランクが見つかりません`);
    }
  }

  // 説明文プレビューを更新
  if (typeof window.updateDescriptionFromDetail === 'function') {
    window.updateDescriptionFromDetail();
  }

  // 商品の状態に応じたボタン表示更新（既存機能）
  if (typeof toggleConditionButtons === 'function') {
    toggleConditionButtons();
  }
}

// グローバルに公開
window.getConditionRank = getConditionRank;
window.onConditionChange = onConditionChange;
window.CONDITION_TO_RANK_MAP = CONDITION_TO_RANK_MAP;

  // ブランドキャッシュをグローバルに初期化
  window.brandsCache = null;
  window.brandsCacheTimestamp = null;

  // カテゴリコードキャッシュをグローバルに初期化
  window.categoryCodesCache = null;

  // v315: QRスキャンからのスロットデータ自動反映
  window.pendingSlotData = null;

  /**
   * v315: スロットデータから商品登録フォームに自動反映
   * scan.htmlからsessionStorageに保存されたデータを読み込む
   */
  function checkAndApplySlotData() {
    try {
      const slotDataStr = sessionStorage.getItem('pendingSlotData');

      // v324: スロットデータの有無でフローティングボタンの表示を制御
      const floatingBtn = document.getElementById('qrFloatingBtn');

      if (!slotDataStr) {
        // スキップして来た場合 → フローティングボタン表示
        if (floatingBtn) {
          floatingBtn.style.display = 'flex';
          console.log('📦 [v324] スロットデータなし → QRスキャンボタン表示');
        }
        return;
      }

      const slotData = JSON.parse(slotDataStr);
      console.log('📦 [v315] スロットデータ検出:', slotData.slotId);

      // グローバルに保存（後で商品登録時にslotIdを紐付けるため）
      window.pendingSlotData = slotData;

      // sessionStorageからは削除（重複適用防止）
      sessionStorage.removeItem('pendingSlotData');

      // v324: スキャン済みで来た場合 → フローティングボタン非表示
      if (floatingBtn) {
        floatingBtn.style.display = 'none';
        console.log('📦 [v324] スロットデータあり → QRスキャンボタン非表示');
      }

      // 少し遅延してから反映（DOM要素の準備を待つ）
      setTimeout(() => applySlotDataToForm(slotData), 500);

    } catch (e) {
      console.error('📦 [v315] スロットデータ読み込みエラー:', e);
    }
  }

  /**
   * v315: スロットデータをフォームに反映
   */
  function applySlotDataToForm(slotData) {
    console.log('📦 [v315] フォームにスロットデータを反映中...', slotData);

    // ブランド（英語）- サジェストを表示せずに値を設定
    if (slotData.brand) {
      const brandInput = document.getElementById('ブランド(英語)');
      if (brandInput) {
        brandInput.value = slotData.brand;
        console.log('📦 [v315] ブランド(英語)設定:', slotData.brand);
      }
      // 商品名用のブランドフィールドにも設定
      const brandNameInput = document.getElementById('商品名_ブランド(英語)');
      if (brandNameInput) {
        brandNameInput.value = slotData.brand;
      }
    }

    // ブランド（カナ）
    if (slotData.brandKana) {
      const brandKanaInput = document.getElementById('ブランド(カナ)');
      if (brandKanaInput) {
        brandKanaInput.value = slotData.brandKana;
        console.log('📦 [v315] ブランド(カナ)設定:', slotData.brandKana);
      }
      // 商品名用のブランドカナフィールドにも設定
      const brandKanaNameInput = document.getElementById('商品名_ブランド(カナ)');
      if (brandKanaNameInput) {
        brandKanaNameInput.value = slotData.brandKana;
      }
    }

    // 商品名プレビューを更新（ブランド設定後）
    if (slotData.brand && typeof updateNamePreview === 'function') {
      setTimeout(() => updateNamePreview(), 100);
    }

    // サイズ
    if (slotData.size) {
      const sizeInput = document.getElementById('サイズ');
      if (sizeInput) {
        sizeInput.value = slotData.size;
        console.log('📦 [v315] サイズ設定:', slotData.size);
      }
    }

    // 商品の状態
    if (slotData.condition) {
      const conditionSelect = document.getElementById('商品の状態');
      if (conditionSelect) {
        conditionSelect.value = slotData.condition;
        console.log('📦 [v315] 商品の状態設定:', slotData.condition);
      }
    }

    // ランク（レガシーデータ互換：現在は商品の状態から自動連動）
    if (slotData.rank) {
      const rankHidden = document.getElementById('ランク');
      if (rankHidden) {
        rankHidden.value = slotData.rank;
        console.log('📦 [v315] ランク設定（レガシー）:', slotData.rank);
        // 商品説明プレビュー更新
        if (typeof updateDescriptionFromDetail === 'function') {
          updateDescriptionFromDetail();
        }
      }
    }

    // カテゴリ（7階層）
    if (slotData.category) {
      applyCategoryFromSlot(slotData.category);
    }

    // 付属品（備考欄に追加）
    if (slotData.accessories && slotData.accessories.length > 0) {
      const remarksInput = document.getElementById('備考');
      if (remarksInput) {
        const accessoriesText = '【付属品】' + slotData.accessories.join('、');
        remarksInput.value = remarksInput.value ? remarksInput.value + '\n' + accessoriesText : accessoriesText;
        console.log('📦 [v315] 付属品設定:', slotData.accessories);
      }
    }

    // メモ（備考欄に追加）
    if (slotData.note) {
      const remarksInput = document.getElementById('備考');
      if (remarksInput) {
        const noteText = '【検品メモ】' + slotData.note;
        remarksInput.value = remarksInput.value ? remarksInput.value + '\n' + noteText : noteText;
      }
    }

    // ダメージマーカー画像を表示
    if (slotData.damageMarkerImage) {
      displayDamageMarkerFromSlot(slotData);
    }

    console.log('📦 [v315] スロットデータ反映完了');

    // スロットデータ反映後に下書き保存
    if (typeof prdMarkEdited === 'function') prdMarkEdited();
    if (typeof prdSaveDraft === 'function') prdSaveDraft(true);

    // 反映完了通知（ユーザーへのフィードバック）
    showSlotDataAppliedNotification(slotData);
  }

  /**
   * v315: カテゴリ情報を反映（7階層対応）
   */
  function applyCategoryFromSlot(category) {
    console.log('📦 [v315] カテゴリ反映:', category);

    // ヘルパー関数: セレクトボックスの値を設定してchangeイベントを発火
    function selectValue(elementId, value) {
      const el = document.getElementById(elementId);
      if (!el || !value) return false;
      for (let i = 0; i < el.options.length; i++) {
        if (el.options[i].value === value) {
          el.selectedIndex = i;
          el.dispatchEvent(new Event('change', { bubbles: true }));
          console.log('📦 [v315] ' + elementId + ' 設定:', value);
          return true;
        }
      }
      return false;
    }

    // 特大分類
    if (category.superCategory) {
      selectValue('特大分類', category.superCategory);
    }

    // 大分類〜アイテム名は連動プルダウンなので、順番に遅延させて設定
    setTimeout(() => {
      if (category.major) {
        selectValue('大分類(カテゴリ)', category.major);
      }
      setTimeout(() => {
        if (category.middle) {
          selectValue('中分類(カテゴリ)', category.middle);
        }
        setTimeout(() => {
          if (category.small) {
            selectValue('小分類(カテゴリ)', category.small);
          }
          setTimeout(() => {
            if (category.fine) {
              selectValue('細分類(カテゴリ)', category.fine);
            }
            setTimeout(() => {
              if (category.fine2) {
                selectValue('細分類2', category.fine2);
              }
              setTimeout(() => {
                if (category.itemName) {
                  selectValue('アイテム名', category.itemName);
                }
              }, 100);
            }, 100);
          }, 100);
        }, 100);
      }, 100);
    }, 100);
  }

  /**
   * v315: ダメージマーカー画像を表示
   */
  function displayDamageMarkerFromSlot(slotData) {
    console.log('📦 [v315] ダメージマーカー画像を表示');
    
    const previewSection = document.getElementById('damageMarkerPreviewSection');
    const previewImg = document.getElementById('damageMarkerPreviewImg');
    const typeLabel = document.getElementById('damageMarkerTypeLabel');
    const noteSection = document.getElementById('damageMarkerNoteSection');
    const noteText = document.getElementById('damageMarkerNoteText');

    if (!previewSection || !previewImg) {
      console.warn('📦 [v315] ダメージマーカー表示要素が見つかりません');
      return;
    }

    previewImg.src = slotData.damageMarkerImage;
    if (typeLabel) {
      typeLabel.textContent = slotData.damageMarkerType || '';
    }
    previewSection.style.display = 'block';

    // 補足説明があれば表示
    if (slotData.damageMarkerNote && noteSection && noteText) {
      noteText.textContent = slotData.damageMarkerNote;
      noteSection.style.display = 'block';
    } else if (noteSection) {
      noteSection.style.display = 'none';
    }

    // グローバル変数に保持（商品登録時に使用）
    window.currentDamageMarker = {
      image: slotData.damageMarkerImage,
      type: slotData.damageMarkerType || null,
      note: slotData.damageMarkerNote || null
    };
  }

  /**
   * v315: スロットデータ反映完了通知
   */
  function showSlotDataAppliedNotification(slotData) {
    // 簡易トースト通知
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: #10b981;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 10000;
      animation: fadeInUp 0.3s ease;
    `;
    toast.innerHTML = `<i class="bi bi-check-circle me-2"></i>検品情報を反映しました`;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // ===== 複製データ読み込み（在庫管理からのコピー） =====
  function checkAndApplyCopiedProduct() {
    try {
      var copyStr = localStorage.getItem('reborn_copy_product');
      if (!copyStr) return;
      var copyData = JSON.parse(copyStr);
      if (!copyData || !copyData.sourceManagementNumber) {
        localStorage.removeItem('reborn_copy_product');
        return;
      }
      console.log('[CopyProduct] コピーデータ検出:', copyData.sourceManagementNumber);

      // 確認ダイアログ
      if (!confirm('過去の商品データ「' + copyData.sourceManagementNumber + '」を読み込みますか？\n\nブランド、カテゴリ、商品名、説明文などが自動入力されます。')) {
        localStorage.removeItem('reborn_copy_product');
        console.log('[CopyProduct] ユーザーがキャンセル、データ破棄');
        return;
      }

      // データ破棄（再適用防止）
      localStorage.removeItem('reborn_copy_product');

      // DOM準備を待ってから適用（マスタデータ読み込み完了後）
      setTimeout(function() { applyCopiedProductToForm(copyData); }, 1500);
    } catch (e) {
      console.warn('[CopyProduct] エラー:', e);
      localStorage.removeItem('reborn_copy_product');
    }
  }

  function applyCopiedProductToForm(data) {
    console.log('[CopyProduct] フォームにデータ反映開始...');

    // --- ブランド ---
    if (data.brand) {
      var brandEn = data.brand.nameEn || (typeof data.brand === 'string' ? data.brand : '');
      var brandKana = data.brand.nameKana || '';
      if (brandEn) {
        var el = document.getElementById('ブランド(英語)');
        if (el) el.value = brandEn;
        var el2 = document.getElementById('商品名_ブランド(英語)');
        if (el2) el2.value = brandEn;
      }
      if (brandKana) {
        var el = document.getElementById('ブランド(カナ)');
        if (el) el.value = brandKana;
        var el3 = document.getElementById('商品名_ブランド(カナ)');
        if (el3) el3.value = brandKana;
      }
    }

    // --- 商品の状態 ---
    if (data.condition) {
      var condEl = document.getElementById('商品の状態');
      if (condEl) {
        condEl.value = data.condition;
        condEl.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    // --- サイズ ---
    if (data.size) {
      var sizeVal = data.size.display || (typeof data.size === 'string' ? data.size : '');
      if (sizeVal) {
        var sizeEl = document.getElementById('サイズ');
        if (sizeEl) sizeEl.value = sizeVal;
      }
    }

    // --- カテゴリ（7階層） ---
    if (data.category) {
      applyCategoryFromSlot({
        superCategory: data.category.superCategory || '',
        major: data.category.major || '',
        middle: data.category.middle || '',
        small: data.category.minor || '',
        fine: data.category.detail1 || '',
        fine2: data.category.detail2 || '',
        itemName: data.itemName || ''
      });
    }

    // --- セールスワード ---
    if (data.salesWord) {
      if (data.salesWord.category) {
        var swCatEl = document.getElementById('セールスワード(カテゴリ)');
        if (swCatEl) {
          swCatEl.value = data.salesWord.category;
          swCatEl.dispatchEvent(new Event('change', { bubbles: true }));
          setTimeout(function() {
            if (data.salesWord.word) {
              var swEl = document.getElementById('セールスワード');
              if (swEl) swEl.value = data.salesWord.word;
            }
          }, 300);
        }
      }
    }

    // --- 商品の説明 ---
    if (data.description) {
      var descEl = document.getElementById('商品の説明');
      if (descEl) {
        descEl.value = data.description;
        descEl.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }

    // --- 商品状態詳細 ---
    if (data.conditionDetail) {
      var cdEl = document.getElementById('商品状態詳細');
      if (cdEl) cdEl.value = data.conditionDetail;
    }

    // --- 寸法 ---
    if (data.measurements) {
      var mMap = {
        shoulderWidth: '肩幅', chestWidth: '身幅', sleeveLength: '袖丈',
        length: '着丈', waist: 'ウエスト', hip: 'ヒップ',
        rise: '股上', inseam: '股下'
      };
      Object.keys(mMap).forEach(function(key) {
        if (data.measurements[key]) {
          var mEl = document.getElementById(mMap[key]);
          if (mEl) mEl.value = data.measurements[key];
        }
      });
    }

    // --- 配送設定 ---
    if (data.shipping) {
      var shipMap = {
        feeBearer: '配送料の負担', method: '配送の方法',
        region: '発送元の地域', days: '発送までの日数'
      };
      Object.keys(shipMap).forEach(function(key) {
        if (data.shipping[key]) {
          var sEl = document.getElementById(shipMap[key]);
          if (sEl) sEl.value = data.shipping[key];
        }
      });
    }

    // --- 商品名プレビュー更新 ---
    setTimeout(function() {
      if (typeof updateNamePreview === 'function') updateNamePreview();
    }, 800);

    // --- 反映完了通知 ---
    setTimeout(function() {
      var toast = document.createElement('div');
      toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#3b82f6;color:white;padding:12px 24px;border-radius:8px;font-size:14px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.15);z-index:10000;';
      toast.innerHTML = '<i class="bi bi-clipboard-check me-2"></i>「' + data.sourceManagementNumber + '」のデータを読み込みました';
      document.body.appendChild(toast);
      setTimeout(function() {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(function() { toast.remove(); }, 300);
      }, 4000);
    }, 1000);

    console.log('[CopyProduct] フォームへのデータ反映完了');
  }

  // v315: ページ読み込み時にスロットデータをチェック
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      checkAndApplySlotData();
      // コピーデータは少し遅延してチェック（スロットデータ優先）
      setTimeout(checkAndApplyCopiedProduct, 2000);
    });
  } else {
    checkAndApplySlotData();
    setTimeout(checkAndApplyCopiedProduct, 2000);
  }

  /**
   * 親ウィンドウからデータを受信（Algolia移行版）
   * - 管理番号設定: GAS経由で受け取る（Firestore直接アクセスをスキップ）
   * - ブランド: Algoliaで検索（プリロード不要）
   */
  window.addEventListener('message', function(event) {
    // セキュリティ: 送信元を検証
    const allowedOrigins = [
      'https://reborn-inventory-system.pages.dev',
      'https://furira.jp',
      'http://localhost:8080',
      'http://127.0.0.1:8080'
    ];

    if (!allowedOrigins.includes(event.origin)) {
      console.warn('⚠️ [postMessage] 許可されていないオリジンから受信:', event.origin);
      return;
    }

    // 管理番号設定を受信
    if (event.data && event.data.type === 'managementConfig') {
      const config = event.data.config;

      if (!config || typeof config !== 'object') {
        console.error('❌ [postMessage] 無効な管理番号設定:', config);
        return;
      }

      // localStorageに保存（Firestore形式と統一）
      localStorage.setItem('rebornConfig_managementNumber', JSON.stringify(config));
      localStorage.setItem('managementConfigTimestamp', Date.now().toString());

      console.log('✅ [postMessage] 管理番号設定受信完了: prefix="' + config.prefix + '", segments=' + (config.segments?.length || 0) + '件');
      console.log('📦 [postMessage] localStorage保存完了（rebornConfig_managementNumber形式）、次回セッションで高速表示');

      // 管理番号UI更新（既に初期化されている場合）
      if (typeof window.updateManagementNumberUI === 'function') {
        console.log('🎨 管理番号UI更新開始（postMessage経由）');
        window.updateManagementNumberUI();
      }
    }

    // ブランドデータを受信（互換性維持、Algolia移行後は不要になる）
    if (event.data && event.data.type === 'brands') {
      const brands = event.data.brands;

      if (!brands || !Array.isArray(brands)) {
        console.error('❌ [postMessage] 無効なブランドデータ:', brands);
        return;
      }

      // キャッシュに保存
      window.brandsCache = brands;
      window.brandsCacheTimestamp = Date.now();

      console.log('✅ [postMessage] ブランドデータ受信完了:', brands.length + '件');
    
      // ブランドサジェストを初期化（モジュールが読み込まれている場合）
      if (window.firestoreBrandModulesLoaded && typeof window.initBrandSuggestWithCache === 'function') {
        console.log('🎨 ブランドサジェスト初期化開始（postMessage経由）');
        window.initBrandSuggestWithCache();
      }
    }
  }, false);

console.log('👂 [postMessage] データ受信リスナー登録完了（管理番号設定 + ブランド）');

// ==================== デバッグ設定 ====================
  // 本番環境ではfalseに設定してログを無効化
  const DEBUG_MODE = true;

  // デバッグ用ログユーティリティ
  const debug = {
  log: (...args) => { if (DEBUG_MODE) console.log(...args); },
  warn: (...args) => { if (DEBUG_MODE) console.warn(...args); },
  error: (...args) => { console.error(...args); }, // エラーは常に表示
  info: (...args) => { if (DEBUG_MODE) console.info(...args); }
};

// ==================== 定数定義 ====================
const NAME_LIMIT = 40;
  const NAME_LIMIT_MODE = 'warn';
  const DESC_LIMIT = 1000;
  const DESC_LIMIT_MODE = 'warn';

  // 画像ストレージプロバイダー設定
  // 'firebase': Firebase Storage（安定: API連携対応、公開URL取得可能）
  // 'r2': Cloudflare R2（転送料無料: リトライ機能付き）
  // 'gdrive': Googleドライブ（旧方式: 非推奨）
  // ※ 問題発生時は 'firebase' に戻す
  const IMAGE_STORAGE_PROVIDER = 'r2';

// AI生成文を保存するグローバル変数
window.AI_GENERATED_TEXT = '';

// 設定マスタ全体をキャッシュ
window.CACHED_CONFIG = null;

// localStorageキー定義（設定システム用）
window.CONFIG_STORAGE_KEYS = {
    CONDITION_BUTTONS: 'rebornConfig_conditionButtons',
    HASHTAG: 'rebornConfig_hashtag',
    DISCOUNT: 'rebornConfig_discount',
    SHIPPING_DEFAULT: 'rebornConfig_shippingDefault',
    PROCURE_LISTING_DEFAULT: 'rebornConfig_procureListingDefault',
    MANAGEMENT_NUMBER: 'rebornConfig_managementNumber',
    SALESWORD: 'rebornConfig_salesword',
    AI_SETTINGS: 'rebornConfig_aiSettings',
    DESIGN_THEME: 'rebornTheme',
    IMAGE_SAVE: 'enableProductImageSave'
  };

  // ==================== テーマの即座適用（ちらつき防止） ====================
  // ページ読み込み直後にLocalStorageからテーマを復元
  (function() {
    try {
      const cachedTheme = localStorage.getItem('rebornTheme');
      if (cachedTheme && cachedTheme !== 'casual') {
        document.body.classList.add('theme-' + cachedTheme);
        console.log('🚀 LocalStorageからテーマを即座に適用:', cachedTheme);
      }
    } catch (e) {
      console.warn('LocalStorageアクセスエラー:', e);
    }
  })();

  // 🔐 postMessage送信（二重iframe対応：window.top.postMessage()は届く）
  // origin検証のみでOK（event.source比較不要、pmToken不要）

  // テーマをLocalStorageに保存
  function saveThemeToLocalStorage(theme) {
    try {
      localStorage.setItem('rebornTheme', theme);
      console.log('💾 テーマをLocalStorageに保存:', theme);
    } catch (e) {
      console.warn('LocalStorage保存エラー:', e);
    }
  }

  // 設定マスタ全体を読み込む（localStorage優先、サーバーでバックアップ同期）
  async function loadAllConfig() {
    console.log('🚀 設定読み込み開始（ハイブリッド方式）');
    console.log('📍 [DEBUG] 現在のURL:', window.location.href);
    console.log('📍 [DEBUG] オリジン:', window.location.origin);
    console.log('📍 [DEBUG] localStorageの状態:');
    console.log('  - localStorage使用可能:', typeof Storage !== 'undefined');
    console.log('  - localStorage.length:', localStorage.length);
    
    // localStorage内の全キーを表示
    console.log('  - 保存されているキー一覧:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      console.log(`    [${i}] ${key}`);
    }

    // 1. まずlocalStorageから即座に読み込み（高速表示）
    try {
      if (!window.CACHED_CONFIG) {
        window.CACHED_CONFIG = {};
      }

      const conditionButtons = localStorage.getItem('rebornConfig_conditionButtons');
      const hashtag = localStorage.getItem('rebornConfig_hashtag');
      const discount = localStorage.getItem('rebornConfig_discount');
      const shippingDefault = localStorage.getItem('rebornConfig_shippingDefault');
      const procureListingDefault = localStorage.getItem('rebornConfig_procureListingDefault');
      const managementNumber = localStorage.getItem('rebornConfig_managementNumber');
      const salesword = localStorage.getItem('rebornConfig_salesword');
      const aiSettings = localStorage.getItem('rebornConfig_aiSettings');

      if (conditionButtons) window.CACHED_CONFIG['商品状態ボタン'] = JSON.parse(conditionButtons);
      if (hashtag) window.CACHED_CONFIG['ハッシュタグ'] = JSON.parse(hashtag);
      if (discount) window.CACHED_CONFIG['割引情報'] = JSON.parse(discount);
      if (shippingDefault) window.CACHED_CONFIG['配送デフォルト'] = JSON.parse(shippingDefault);
      if (procureListingDefault) window.CACHED_CONFIG['仕入出品デフォルト'] = JSON.parse(procureListingDefault);
      if (managementNumber) window.CACHED_CONFIG['管理番号設定'] = JSON.parse(managementNumber);
      if (salesword) window.CACHED_CONFIG['よく使うセールスワード'] = JSON.parse(salesword);
      if (aiSettings) window.CACHED_CONFIG['AI生成設定'] = JSON.parse(aiSettings);

      console.log('✅ Step 1: localStorageから読み込み完了:', window.CACHED_CONFIG);
    } catch (e) {
      console.error('localStorage読み込みエラー:', e);
    }

    // 2. Firestoreから最新設定を取得してCACHED_CONFIGに統合（PWA版）
    console.log('🔄 Step 2: Firestoreから最新設定を取得中...');
    try {
      const docRef = firebase.firestore().collection('settings').doc('common');
      const docSnap = await docRef.get();
      
      if (docSnap.exists) {
        const firestoreData = docSnap.data();
        console.log('✅ Firestoreから設定取得成功:', firestoreData);
        
        // Firestoreのデータを日本語キーに変換してCACHED_CONFIGにマージ
        if (firestoreData.conditionButtons) {
          window.CACHED_CONFIG['商品状態ボタン'] = firestoreData.conditionButtons;
          localStorage.setItem('rebornConfig_conditionButtons', JSON.stringify(firestoreData.conditionButtons));
        }
        if (firestoreData.hashtag) {
          window.CACHED_CONFIG['ハッシュタグ'] = firestoreData.hashtag;
          localStorage.setItem('rebornConfig_hashtag', JSON.stringify(firestoreData.hashtag));
        }
        if (firestoreData.discount) {
          window.CACHED_CONFIG['割引情報'] = firestoreData.discount;
          localStorage.setItem('rebornConfig_discount', JSON.stringify(firestoreData.discount));
        }
        if (firestoreData.shippingDefault) {
          window.CACHED_CONFIG['配送デフォルト'] = firestoreData.shippingDefault;
          localStorage.setItem('rebornConfig_shippingDefault', JSON.stringify(firestoreData.shippingDefault));
        }
        if (firestoreData.procureListingDefault) {
          window.CACHED_CONFIG['仕入出品デフォルト'] = firestoreData.procureListingDefault;
          localStorage.setItem('rebornConfig_procureListingDefault', JSON.stringify(firestoreData.procureListingDefault));
        }
        if (firestoreData.managementNumber) {
          window.CACHED_CONFIG['管理番号設定'] = firestoreData.managementNumber;
          localStorage.setItem('rebornConfig_managementNumber', JSON.stringify(firestoreData.managementNumber));
        }
        if (firestoreData.salesword) {
          window.CACHED_CONFIG['よく使うセールスワード'] = firestoreData.salesword;
          localStorage.setItem('rebornConfig_salesword', JSON.stringify(firestoreData.salesword));
          console.log('✅ セールスワード設定をCACHED_CONFIGに反映:', firestoreData.salesword);
        }
        if (firestoreData.aiSettings) {
          window.CACHED_CONFIG['AI生成設定'] = firestoreData.aiSettings;
          localStorage.setItem('rebornConfig_aiSettings', JSON.stringify(firestoreData.aiSettings));
        }
        
        console.log('✅ Step 2: Firestore設定をCACHED_CONFIGに統合完了:', window.CACHED_CONFIG);
      } else {
        console.log('⚠️ Firestore settings/commonが存在しません');
      }
    } catch (e) {
      console.error('❌ Firestore設定取得エラー:', e);
      console.log('⚠️ localStorageのみを使用します');
    }

    // デザインテーマを適用（localStorageから）
    try {
      const savedTheme = localStorage.getItem(window.CONFIG_STORAGE_KEYS.DESIGN_THEME);
      if (savedTheme && savedTheme !== 'casual') {
        const themeClass = 'theme-' + savedTheme;
        if (!document.body.classList.contains(themeClass)) {
          document.body.classList.add(themeClass);
          console.log('✅ デザインテーマを適用:', themeClass);
        }
      }
    } catch (e) {
      console.warn('デザインテーマ適用エラー:', e);
    }

  }

  // ==================== ローディングオーバーレイ ====================

/**
 * ローディングオーバーレイを初期化
 */
window.initLoadingOverlay = function() {
    // オーバーレイHTMLを動的に生成
    const overlayHTML = `
      <div id="loadingOverlay">
        <div class="loading-content">
          <div class="loading-spinner"></div>
          <div class="loading-title" id="loadingTitle">データを保存中...</div>
          <div class="loading-message" id="loadingMessage">しばらくお待ちください</div>
          <div class="loading-progress">
            <div class="loading-progress-bar" id="loadingProgressBar"></div>
          </div>
          <div class="loading-progress-text" id="loadingProgressText">0%</div>
        </div>
      </div>
    `;

    // bodyに追加
    document.body.insertAdjacentHTML('beforeend', overlayHTML);
    console.log('✅ ローディングオーバーレイを初期化しました');
  }

/**
 * ローディングオーバーレイを表示
 * @param {string} title - タイトルテキスト（デフォルト: "データを保存中..."）
 * @param {string} message - メッセージテキスト（デフォルト: "しばらくお待ちください"）
 */
window.showLoadingOverlay = function(title = 'データを保存中...', message = 'しばらくお待ちください') {
    const overlay = document.getElementById('loadingOverlay');
    const titleEl = document.getElementById('loadingTitle');
    const messageEl = document.getElementById('loadingMessage');

    if (overlay) {
      titleEl.textContent = title;
      messageEl.textContent = message;
      overlay.classList.add('active');
      updateLoadingProgress(0, '0%'); // プログレスバーを初期化
    }
  }

/**
 * ローディングオーバーレイを非表示
 */
window.hideLoadingOverlay = function() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
      overlay.classList.remove('active');
    }
  }

  /**
   * ローディング進捗を更新
   * @param {number} percent - 進捗率（0-100）
   * @param {string} text - 進捗テキスト（例: "画像アップロード中 (2/3)"）
   */
window.updateLoadingProgress = function(percent, text) {
    const progressBar = document.getElementById('loadingProgressBar');
    const progressText = document.getElementById('loadingProgressText');
    const messageEl = document.getElementById('loadingMessage');

    if (progressBar) {
      progressBar.style.width = percent + '%';
    }
    if (progressText) {
      progressText.textContent = text;
    }
    if (messageEl && text !== `${Math.round(percent)}%`) {
      messageEl.textContent = text;
    }
  }

// ==================== 保存成功モーダル ====================

/**
 * 保存成功モーダルを初期化
 */
window.initSuccessModal = function() {
  // 既に存在する場合は作成しない
  if (document.getElementById('saveSuccessModal')) return;

  const modalHTML = `
    <div id="saveSuccessModal" class="success-modal-overlay">
      <div class="success-modal-content">
        <div class="success-modal-icon">✅</div>
        <div class="success-modal-title">出品が完了しました</div>
        <div class="success-modal-message">商品が正常に出品されました</div>
        <div class="success-modal-buttons">
          <button type="button" class="success-modal-btn primary" onclick="continueProductRegistration()">
            続けて登録
          </button>
          <button type="button" class="success-modal-btn secondary" onclick="closeSuccessModal()">
            閉じる
          </button>
        </div>
      </div>
    </div>
    <style>
      .success-modal-overlay {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        align-items: center;
        justify-content: center;
      }
      .success-modal-overlay.active {
        display: flex;
      }
      .success-modal-content {
        background: white;
        border-radius: 16px;
        padding: 32px 24px;
        max-width: 320px;
        width: 90%;
        text-align: center;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
        animation: modalSlideIn 0.3s ease-out;
      }
      @keyframes modalSlideIn {
        from {
          opacity: 0;
          transform: translateY(-20px) scale(0.95);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }
      .success-modal-icon {
        font-size: 48px;
        margin-bottom: 16px;
      }
      .success-modal-title {
        font-size: 20px;
        font-weight: 700;
        color: #1f2937;
        margin-bottom: 8px;
      }
      .success-modal-message {
        font-size: 14px;
        color: #6b7280;
        margin-bottom: 24px;
      }
      .success-modal-buttons {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .success-modal-btn {
        padding: 14px 24px;
        border-radius: 10px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
      }
      .success-modal-btn.primary {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
      }
      .success-modal-btn.primary:hover {
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);
      }
      .success-modal-btn.secondary {
        background: #f3f4f6;
        color: #4b5563;
      }
      .success-modal-btn.secondary:hover {
        background: #e5e7eb;
      }
    </style>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  console.log('✅ 保存成功モーダルを初期化しました');
}

/**
 * 保存成功モーダルを表示
 */
window.showSuccessModal = function() {
  // モーダルが初期化されていない場合は初期化
  if (!document.getElementById('saveSuccessModal')) {
    initSuccessModal();
  }
  const modal = document.getElementById('saveSuccessModal');
  if (modal) {
    modal.classList.add('active');
  }
}

/**
 * 保存成功モーダルを閉じる
 */
window.closeSuccessModal = function() {
  const modal = document.getElementById('saveSuccessModal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * 続けて登録（ページリロード）
 */
window.continueProductRegistration = function() {
  // モーダルを閉じる
  closeSuccessModal();

  // リロード後にトップへスクロールするフラグをセット
  sessionStorage.setItem('scrollToTopAfterReload', 'true');

  // ページをリロードして初期状態に戻す
  window.location.reload();
};

// ページロード時にスクロールトップフラグをチェック
(function() {
  if (sessionStorage.getItem('scrollToTopAfterReload') === 'true') {
    // フラグを削除
    sessionStorage.removeItem('scrollToTopAfterReload');

    // 親フレームとiframe両方をトップへスクロールする関数
    const scrollToTop = function() {
      // iframe内のスクロール
      window.scrollTo(0, 0);

      // 親フレームのスクロール（同一オリジンなので直接呼び出し可能）
      try {
        if (window.parent && window.parent !== window) {
          window.parent.scrollTo(0, 0);
        }
      } catch (e) {
        // cross-origin の場合は無視
        console.log('[ScrollToTop] 親フレームへのアクセス失敗:', e);
      }
    };

    // ブラウザの復元処理と競合するため、複数回実行して確実にトップへ移動
    // loadイベント後に実行（画像等の読み込み完了後）
    window.addEventListener('load', function() {
      scrollToTop();
      requestAnimationFrame(scrollToTop);
      setTimeout(scrollToTop, 50);
      setTimeout(scrollToTop, 150);
      setTimeout(scrollToTop, 300);
    });

    // DOMContentLoadedでも実行（より早いタイミング）
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', scrollToTop);
    } else {
      scrollToTop();
      requestAnimationFrame(scrollToTop);
    }
  }
})();


  // 配送デフォルト設定（設定マスタから読み込む。未設定時は空）
  let SHIPPING_DEFAULTS = {};

  // Firestoreから配送方法カテゴリをセレクトボックスに読み込む
  /**
   * Firestoreから発送方法カテゴリ一覧を取得してプルダウンに設定
   * マスタ管理の発送方法と連動
   *
   * データ構造（shippingMethodsコレクション）:
   * - ドキュメントID = カテゴリ名（例: "らくらくメルカリ便"）
   * - order: ソート順
   * - items: [{detail: "ネコポス", price: 210}, ...]
   */
  async function loadShippingMethodOptions() {
    const select = document.getElementById('配送の方法');
    if (!select) {
      console.log('配送の方法セレクトが見つかりません');
      return;
    }

    try {
      // PWA版: Firestoreから直接取得
      if (window.db) {
        const snapshot = await window.db.collection('shippingMethods')
          .orderBy('order', 'asc')
          .get();

        // セレクトボックスをクリアして再構築
        select.innerHTML = '<option value="">--選択してください--</option>';

        // ドキュメントID（カテゴリ名）を追加
        snapshot.forEach(doc => {
          const option = document.createElement('option');
          option.value = doc.id;
          option.textContent = doc.id;
          select.appendChild(option);
        });

        console.log(`✅ 配送方法オプションを読み込みました: ${snapshot.size}件`);
      }
    } catch (error) {
      console.error('配送方法オプション読み込みエラー:', error);
    }
  }

  // 設定マスタから配送デフォルトを読み込む（3段フォールバック）
  async function loadShippingDefaults() {
    // まず配送方法オプションをFirestoreから読み込む
    await loadShippingMethodOptions();

    var loaded = null;

    // 1. CACHED_CONFIG から（loadAllConfigで既に読み込み済みの場合）
    if (window.CACHED_CONFIG && window.CACHED_CONFIG['配送デフォルト']) {
      loaded = window.CACHED_CONFIG['配送デフォルト'];
      console.log('[配送デフォルト] CACHED_CONFIGから取得:', loaded);
    }

    // 2. localStorage から（フォールバック）
    if (!loaded) {
      try {
        var saved = localStorage.getItem('rebornConfig_shippingDefault');
        if (saved) { loaded = JSON.parse(saved); console.log('[配送デフォルト] localStorageから取得:', loaded); }
      } catch (e) {}
    }

    // 3. Firestore直接読み込み（localStorage消失時の最終フォールバック）
    if (!loaded && window.db) {
      try {
        var doc = await window.db.collection('settings').doc('common').get();
        if (doc.exists && doc.data().shippingDefault) {
          loaded = doc.data().shippingDefault;
          console.log('[配送デフォルト] Firestoreから直接取得:', loaded);
          // localStorageにキャッシュ
          localStorage.setItem('rebornConfig_shippingDefault', JSON.stringify(loaded));
        }
      } catch (e) { console.warn('[配送デフォルト] Firestore読み込みエラー:', e); }
    }

    // 実際に値が設定されているかチェック（空文字のみのデータは無視）
    if (loaded && typeof loaded === 'object') {
      var hasValues = Object.keys(loaded).some(function(k) { return loaded[k] && loaded[k] !== ''; });
      if (hasValues) {
        SHIPPING_DEFAULTS = loaded;
        console.log('✅ 配送デフォルト設定を読み込みました:', SHIPPING_DEFAULTS);
        applyShippingDefaults();
      }
    }
  }

  // 仕入・出品デフォルト設定（設定マスタから読み込む。未設定時は空）
  let PROCURE_LISTING_DEFAULTS = {};

  // 設定マスタから仕入・出品デフォルトを読み込む（3段フォールバック）
  async function loadProcureListingDefaults() {
    // まず仕入先・出品先の選択肢をFirestoreから読み込む
    await loadSupplierAndSalesChannelOptions();
    // カテゴリコードマスタも読み込む（管理番号設定用）
    await loadCategoryCodesFromFirestore();
    // 付属品チェックボックスを読み込む
    await loadAccessoriesCheckboxes();

    var loaded = null;

    // 1. CACHED_CONFIG から
    if (window.CACHED_CONFIG && window.CACHED_CONFIG['仕入出品デフォルト']) {
      loaded = window.CACHED_CONFIG['仕入出品デフォルト'];
      console.log('[仕入出品デフォルト] CACHED_CONFIGから取得:', loaded);
    }

    // 2. localStorage から
    if (!loaded) {
      try {
        var saved = localStorage.getItem('rebornConfig_procureListingDefault');
        if (saved) { loaded = JSON.parse(saved); console.log('[仕入出品デフォルト] localStorageから取得:', loaded); }
      } catch (e) {}
    }

    // 3. Firestore直接読み込み（最終フォールバック）
    if (!loaded && window.db) {
      try {
        var doc = await window.db.collection('settings').doc('common').get();
        if (doc.exists && doc.data().procureListingDefault) {
          loaded = doc.data().procureListingDefault;
          console.log('[仕入出品デフォルト] Firestoreから直接取得:', loaded);
          localStorage.setItem('rebornConfig_procureListingDefault', JSON.stringify(loaded));
        }
      } catch (e) { console.warn('[仕入出品デフォルト] Firestore読み込みエラー:', e); }
    }

    // 実際に意味のある値が設定されているかチェック
    if (loaded && typeof loaded === 'object') {
      var hasValues = Object.keys(loaded).some(function(k) {
        var v = loaded[k];
        return v !== '' && v !== false && v !== null && v !== undefined;
      });
      if (hasValues) {
        PROCURE_LISTING_DEFAULTS = loaded;
        console.log('✅ 仕入・出品デフォルト設定を読み込みました:', PROCURE_LISTING_DEFAULTS);
      }
    }

    // 設定未保存でも「今日の日付」をデフォルト適用（設定画面の初期状態と一致）
    if (!PROCURE_LISTING_DEFAULTS['仕入日_今日'] && PROCURE_LISTING_DEFAULTS['仕入日_今日'] !== false) {
      PROCURE_LISTING_DEFAULTS['仕入日_今日'] = true;
    }
    if (!PROCURE_LISTING_DEFAULTS['出品日_今日'] && PROCURE_LISTING_DEFAULTS['出品日_今日'] !== false) {
      PROCURE_LISTING_DEFAULTS['出品日_今日'] = true;
    }
    applyProcureListingDefaults();
  }

  // 付属品チェックボックスをFirestoreから読み込んで描画
  async function loadAccessoriesCheckboxes() {
    const container = document.getElementById('accessoriesCheckboxes');
    if (!container) {
      console.warn('⚠️ accessoriesCheckboxes要素が見つかりません');
      return;
    }

    // デフォルトの付属品リスト（Firestoreから取得できない場合のフォールバック）
    const defaultAccessories = [
      { name: '箱', displayOrder: 1 },
      { name: '保存袋', displayOrder: 2 },
      { name: '保証書', displayOrder: 3 },
      { name: 'ギャランティカード', displayOrder: 4 },
      { name: 'タグ', displayOrder: 5 },
      { name: 'その他', displayOrder: 99 }
    ];

    let accessories = defaultAccessories;

    // Firestoreから付属品マスタを取得（あれば）
    if (window.db) {
      try {
        const snapshot = await window.db.collection('accessories').orderBy('displayOrder', 'asc').get();
        if (!snapshot.empty) {
          accessories = [];
          snapshot.forEach(doc => {
            const data = doc.data();
            if (data.name) {
              accessories.push({ name: data.name, displayOrder: data.displayOrder || 99 });
            }
          });
          console.log('✅ 付属品マスタをFirestoreから読み込み:', accessories.length + '件');
        } else {
          console.log('ℹ️ 付属品マスタが空、デフォルト値を使用');
        }
      } catch (e) {
        console.warn('⚠️ 付属品マスタ読み込みエラー、デフォルト値を使用:', e);
      }
    } else {
      console.log('ℹ️ Firestore未初期化、デフォルト付属品を使用');
    }

    // チェックボックスを生成
    container.innerHTML = accessories.map(acc => `
      <label class="accessory-checkbox" style="display: flex; align-items: center; gap: 4px; font-size: 0.8rem; background: white; padding: 6px 10px; border: 1px solid #e5e7eb; border-radius: 6px; cursor: pointer; transition: all 0.2s;">
        <input type="checkbox" value="${acc.name}" onchange="updateAccessoryCheckbox(this)">
        ${acc.name}
      </label>
    `).join('');

    console.log('✅ 付属品チェックボックスを描画:', accessories.length + '件');
  }

  // 付属品チェックボックス変更時の処理
  window.updateAccessoryCheckbox = function(checkbox) {
    const label = checkbox.parentElement;
    if (checkbox.checked) {
      label.style.background = '#dbeafe';
      label.style.borderColor = '#3b82f6';
      label.style.color = '#1d4ed8';
    } else {
      label.style.background = 'white';
      label.style.borderColor = '#e5e7eb';
      label.style.color = 'inherit';
    }

    // 「その他」チェックボックスの場合、フリーテキスト入力欄を表示/非表示
    if (checkbox.value === 'その他') {
      const otherInputContainer = document.getElementById('accessoryOtherInputContainer');
      if (otherInputContainer) {
        otherInputContainer.style.display = checkbox.checked ? 'block' : 'none';
        if (!checkbox.checked) {
          // チェックを外したらテキストもクリア
          const otherText = document.getElementById('accessoryOtherText');
          if (otherText) otherText.value = '';
        }
      }
    }
  };

  // 付属品チェックボックスを外部から設定（QRスキャン連動用）
  window.setAccessoriesFromQR = function(accessoriesArray) {
    const container = document.getElementById('accessoriesCheckboxes');
    if (!container || !accessoriesArray || accessoriesArray.length === 0) return;

    // まず全てのチェックを外す
    container.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      const label = cb.parentElement;
      label.style.background = 'white';
      label.style.borderColor = '#e5e7eb';
      label.style.color = 'inherit';
    });

    // QRコードからの付属品をチェック
    accessoriesArray.forEach(accName => {
      // 「その他付属品」→「その他」に変換（旧形式対応）
      const normalizedName = accName === 'その他付属品' ? 'その他' : accName;

      const checkbox = container.querySelector(`input[value="${normalizedName}"]`);
      if (checkbox) {
        checkbox.checked = true;
        const label = checkbox.parentElement;
        label.style.background = '#dbeafe';
        label.style.borderColor = '#3b82f6';
        label.style.color = '#1d4ed8';

        // 「その他」の場合、フリーテキスト入力欄を表示
        if (normalizedName === 'その他') {
          const otherInputContainer = document.getElementById('accessoryOtherInputContainer');
          if (otherInputContainer) {
            otherInputContainer.style.display = 'block';
          }
        }
      } else {
        // マスタに存在しない付属品は「その他」として扱う
        const otherCheckbox = container.querySelector('input[value="その他"]');
        if (otherCheckbox) {
          otherCheckbox.checked = true;
          const label = otherCheckbox.parentElement;
          label.style.background = '#dbeafe';
          label.style.borderColor = '#3b82f6';
          label.style.color = '#1d4ed8';

          const otherInputContainer = document.getElementById('accessoryOtherInputContainer');
          const otherTextInput = document.getElementById('accessoryOtherText');
          if (otherInputContainer) {
            otherInputContainer.style.display = 'block';
          }
          if (otherTextInput) {
            // 既存のテキストに追加
            const currentText = otherTextInput.value.trim();
            if (currentText) {
              otherTextInput.value = currentText + '、' + accName;
            } else {
              otherTextInput.value = accName;
            }
          }
        }
      }
    });

    console.log('✅ QRコードから付属品を設定:', accessoriesArray.join('、'));
  };

  // 仕入先・出品先の選択肢をFirestoreから読み込む
  async function loadSupplierAndSalesChannelOptions() {
    if (!window.db) {
      console.warn('⚠️ Firestoreが初期化されていません（仕入先・出品先選択肢）');
      return;
    }

    const fillSel = (id, arr) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '<option value="">--選択してください--</option>';
      (arr || []).forEach(v => sel.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`));
    };

    try {
      // 仕入先を取得
      const suppliersSnap = await window.db.collection('suppliers').orderBy('name', 'asc').get();
      const suppliers = [];
      suppliersSnap.forEach(doc => {
        const data = doc.data();
        if (data.name) suppliers.push(data.name);
      });
      if (suppliers.length > 0) {
        fillSel('仕入先', suppliers);
        console.log('✅ 仕入先選択肢を設定:', suppliers.length + '件');
      }

      // 出品先を取得（platformIdで重複排除、プラン名を除去）
      const channelsSnap = await window.db.collection('salesChannels').orderBy('order', 'asc').get();
      const channels = [];
      const seenPlatforms = {};
      channelsSnap.forEach(doc => {
        const data = doc.data();
        if (!data.name) return;
        const pid = data.platformId || data.name;
        if (seenPlatforms[pid]) return;
        seenPlatforms[pid] = true;
        channels.push(data.name.replace(/（[^）]*）$/, ''));
      });
      if (channels.length > 0) {
        fillSel('出品先', channels);
        console.log('✅ 出品先選択肢を設定:', channels.length + '件');
      }
    } catch (e) {
      console.error('❌ 仕入先・出品先選択肢読み込みエラー:', e);
    }
  }

  // カテゴリコードをFirestoreから読み込む（管理番号設定用）
  async function loadCategoryCodesFromFirestore() {
    if (!window.db) {
      console.warn('⚠️ Firestoreが初期化されていません（カテゴリコード）');
      return;
    }

    try {
      const snapshot = await window.db.collection('categoryCodes').orderBy('code', 'asc').get();
      const codes = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.code && data.name) {
          codes.push({ code: data.code, name: data.name });
        }
      });

      if (codes.length > 0) {
        window.categoryCodesCache = codes;
        console.log('✅ カテゴリコードマスタを読み込み:', codes.length + '件');
      } else {
        window.categoryCodesCache = [];
        console.log('⚠️ カテゴリコードマスタが空です');
      }
    } catch (e) {
      console.error('❌ カテゴリコード読み込みエラー:', e);
      window.categoryCodesCache = [];
    }
  }

  // 担当者名を読み込む（PWA版：URLパラメータから取得）
  function loadOperatorName() {
    try {
      // URLパラメータからuserNameを取得
      const urlParams = new URLSearchParams(window.location.search);
      const userName = urlParams.get('userName') || '';

      if (userName) {
        const staffField = document.getElementById('担当者');
        if (staffField) {
          staffField.value = userName;
          console.log('✅ 担当者名を設定しました (PWA版):', userName);
        }
      } else {
        console.log('ℹ️ 担当者名がURLパラメータに含まれていません');
      }
    } catch (error) {
      console.error('❌ 担当者名読み込みエラー:', error);
    }
  }
  const REQUIRED = [];
  
  const FIELD_IDS = [
  '管理番号','担当者',
  'セールスワード(カテゴリ)','セールスワード',
  'ブランド(英語)','ブランド(カナ)',
  '商品名(タイトル)',
  '特大分類','大分類(カテゴリ)','中分類(カテゴリ)','小分類(カテゴリ)','細分類(カテゴリ)','細分類2',
  'サイズ','商品の状態',
  'アイテム名',
  '商品の説明',  // 保存対象に含める（リセット時の処理はresetFormとは別）
  '商品状態詳細',
  'サイズ(表記)','サイズ(表記)_靴','その他のサイズ表記_靴','普段のサイズ_靴','フィット感_靴',
  '肩幅','身幅','袖丈','着丈','ウエスト','ヒップ','股上','股下',
  '仕入日','仕入先','仕入金額',
  '出品日','出品先','出品金額',
  '配送料の負担','配送の方法','発送元の地域','発送までの日数',
  'invId'  // 仕入商品ID（QRスキャン時に紐付け）
];

  let CAT_ROWS = [];
  let BRAND_EN = [];
  let BRAND_KANA = [];
  let MASTER_OPTIONS = {}; // マスターオプションを保存

  // ブランドペアデータ（英語名とカナ読みの正確な対応関係）
  let BRAND_PAIRS = [];

  // ブランドデータの高速検索用インデックスマップ（ペア用）
  let BRAND_INDEX_MAP = new Map();

  // セールスワードデータ保存用
  let SALESWORD_DATA = {
    categories: [],
    wordsByCategory: {},
    allWords: []
  };

  // セールスワード表示形式設定
  let SALESWORD_FORMAT = {
    globalPrefix: '【',
    globalSuffix: '】',
    wordOverrides: []
  };

  // デフォルトセールスワード設定
  let defaultSalesword = null;

  // 商品状態履歴保持用
  let CONDITION_HISTORY = [];

  // 商品の状態別のクイック挿入ボタン定義（設定マスタから読み込む）
  let CONDITION_BUTTONS = {};

  // 商品名ブロックの並び順（設定マスタから読み込む）
  let TITLE_BLOCK_ORDER = ['salesword', 'brand', 'item', 'attribute'];

  // 設定マスタから商品名ブロックの並び順を読み込む（PWA版: CACHED_CONFIG経由）
  function loadTitleBlockOrder() {
    // no-op: PWA版ではCACHED_CONFIGから読み込み済み
  }

  // 設定マスタから商品状態ボタンを読み込む
  function loadConditionButtonsFromConfig() {
    // 1. まずCACHED_CONFIG（localStorage/Firestore）を確認
    if (window.CACHED_CONFIG && window.CACHED_CONFIG['商品状態ボタン']) {
      const cachedButtons = window.CACHED_CONFIG['商品状態ボタン'];
      if (cachedButtons && (Array.isArray(cachedButtons) ? cachedButtons.length > 0 : Object.keys(cachedButtons).length > 0)) {
        // 配列形式の場合、オブジェクト形式に変換
        if (Array.isArray(cachedButtons)) {
          CONDITION_BUTTONS = {};
          cachedButtons.forEach(btn => {
            const state = btn['商品の状態'];
            if (state) {
              if (!CONDITION_BUTTONS[state]) {
                CONDITION_BUTTONS[state] = [];
              }
              CONDITION_BUTTONS[state].push({
                ボタンラベル: btn['ボタンラベル'] || btn['ラベル'] || '',
                ボタンテキスト: btn['ボタンテキスト'] || btn['テキスト'] || ''
              });
            }
          });
          console.log('✅ 商品状態ボタン設定を読み込みました（キャッシュ・配列→オブジェクト変換）:', Object.keys(CONDITION_BUTTONS).length, '種類');
        } else {
          CONDITION_BUTTONS = cachedButtons;
          console.log('✅ 商品状態ボタン設定を読み込みました（キャッシュ）:', Object.keys(CONDITION_BUTTONS).length, '種類');
        }
        updateConditionButtons();
        return;
      }
    }

    // キャッシュにない場合
    console.warn('⚠️ 商品状態ボタン設定が見つかりません（キャッシュ利用不可）');
  }

  // 素材システム用のグローバル変数
  let materialCount = 1;
  let MATERIAL_LOCATIONS = [];
  let MATERIAL_TYPES = [];

  // カラーシステム用のグローバル変数
  let colorCount = 1;
  let COLOR_OPTIONS = [];

  // 素材マスタデータの取得と設定
  function initializeMaterialMasters() {
    // 1. まずFirestoreから読み込んだMASTER_OPTIONSを確認
    const masterOpts = window.globalMasterOptions || MASTER_OPTIONS || {};
    const hasLocation = masterOpts['素材(箇所)'] && masterOpts['素材(箇所)'].length > 0;
    const hasType = masterOpts['素材(種類)'] && masterOpts['素材(種類)'].length > 0;

    if (hasLocation || hasType) {
      MATERIAL_LOCATIONS = masterOpts['素材(箇所)'] || [];
      MATERIAL_TYPES = masterOpts['素材(種類)'] || [];
      populateMaterialSelects(1);
      console.log('✅ 素材マスタ取得完了（Firestore） - 箇所:', MATERIAL_LOCATIONS.length, '種類:', MATERIAL_TYPES.length);
      return;
    }

    // Firestoreにもない場合
    console.warn('⚠️ 素材マスタデータが見つかりません（Firestoreデータ利用不可）');
  }

  // カラーマスタデータの取得と設定
  function initializeColorMasters() {
    // 1. まずFirestoreから読み込んだMASTER_OPTIONSを確認
    const masterOpts = window.globalMasterOptions || MASTER_OPTIONS || {};
    if (masterOpts['カラー/配色/トーン'] && masterOpts['カラー/配色/トーン'].length > 0) {
      COLOR_OPTIONS = masterOpts['カラー/配色/トーン'];
      populateColorSelect(1);
      console.log('✅ カラーマスタ取得完了（Firestore）:', COLOR_OPTIONS.length);
      return;
    }

    // Firestoreにもない場合
    console.warn('⚠️ カラーマスタデータが見つかりません（Firestoreデータ利用不可）');
  }

  // セレクトボックスにマスタデータを設定
  function populateMaterialSelects(index) {
    const locationSelect = document.getElementById(`素材${index}_箇所`);

    // 箇所のドロップダウンを設定
    if (locationSelect) {
      locationSelect.innerHTML = '<option value="">--選択してください--</option>';
      MATERIAL_LOCATIONS.forEach(loc => {
        locationSelect.insertAdjacentHTML('beforeend', `<option value="${loc}">${loc}</option>`);
      });
    }

    // 素材セクション内の全ての種類・割合セレクトを設定
    const composition = document.querySelector(`.material-composition[data-material-index="${index}"]`);
    if (composition) {
      const rows = composition.querySelectorAll('.composition-row');
      rows.forEach((row, i) => {
        const rowIndex = i + 1;
        const typeSelect = document.getElementById(`素材${index}_種類${rowIndex}`);
        const percentSelect = document.getElementById(`素材${index}_％${rowIndex}`);

        if (typeSelect) {
          typeSelect.innerHTML = '<option value="">--選択してください--</option>';
          MATERIAL_TYPES.forEach(type => {
            typeSelect.insertAdjacentHTML('beforeend', `<option value="${type}">${type}</option>`);
          });
        }

        if (percentSelect) {
          percentSelect.innerHTML = '<option value="">--選択してください--</option>';
          for (let p = 1; p <= 100; p++) {
            percentSelect.insertAdjacentHTML('beforeend', `<option value="${p}%">${p}%</option>`);
          }
        }
      });

      // 削除ボタンの表示更新
      updateCompositionRemoveButtons(index);
    }
  }

  // 素材セットを追加
  function addMaterial() {
    if (materialCount >= 10) {
      alert('素材は最大10個まで追加できます');
      return;
    }

    materialCount++;

    const materialList = document.getElementById('materialList');
    const newItem = document.createElement('div');
    newItem.className = 'material-item';
    newItem.setAttribute('data-index', materialCount);

    newItem.innerHTML = `
      <div class="material-header">
        <span>素材 ${materialCount}</span>
        <button type="button" class="remove-material-btn" onclick="removeMaterial(${materialCount})">削除</button>
      </div>
      
      <div class="material-fields">
        <label>箇所:
          <select id="素材${materialCount}_箇所" class="material-location">
            <option value="">--選択してください--</option>
          </select>
        </label>

        <div class="material-composition" data-material-index="${materialCount}">
          <div class="composition-row" data-row-index="1">
            <label>種類:
              <select id="素材${materialCount}_種類1" class="material-type">
                <option value="">--選択してください--</option>
              </select>
            </label>
            <label>割合:
              <select id="素材${materialCount}_％1" class="material-percent">
                <option value="">--選択してください--</option>
              </select>
            </label>
            <button type="button" class="remove-composition-btn" onclick="removeCompositionRow(${materialCount}, 1)" style="display:none;">×</button>
          </div>
        </div>
        <button type="button" class="add-composition-btn" onclick="addCompositionRow(${materialCount})">＋ 種類を追加</button>
      </div>
    `;

    materialList.appendChild(newItem);
    populateMaterialSelects(materialCount);
    updateRemoveButtons();

    // 新しいセレクトにイベントリスナーを追加してプレビュー更新
    const locationSelect = document.getElementById(`素材${materialCount}_箇所`);
    const typeSelect = document.getElementById(`素材${materialCount}_種類1`);
    const percentSelect = document.getElementById(`素材${materialCount}_％1`);

    const updateMaterialPreview = () => {
      if (typeof updateDescriptionFromDetail === 'function') {
        updateDescriptionFromDetail();
      }
    };

    if (locationSelect) {
      locationSelect.addEventListener('change', updateMaterialPreview);
    }
    if (typeSelect) {
      typeSelect.addEventListener('change', updateMaterialPreview);
    }
    if (percentSelect) {
      percentSelect.addEventListener('change', updateMaterialPreview);
    }
  }

  // 素材セットを削除
  function removeMaterial(index) {
    const item = document.querySelector(`.material-item[data-index="${index}"]`);
    if (item) {
      item.remove();

      const items = document.querySelectorAll('.material-item');
      materialCount = items.length;

      items.forEach((item, i) => {
        const newIndex = i + 1;
        item.setAttribute('data-index', newIndex);
        item.querySelector('.material-header span').textContent = `素材 ${newIndex}`;

        // onclickも更新
        const removeBtn = item.querySelector('.remove-material-btn');
        if (removeBtn) {
          removeBtn.onclick = () => removeMaterial(newIndex);
        }
      });

      updateRemoveButtons();
      updateDescriptionFromDetail(); // 素材情報更新
    }
  }

  // 削除ボタンの表示制御
  function updateRemoveButtons() {
    const items = document.querySelectorAll('.material-item');
    items.forEach(item => {
      const btn = item.querySelector('.remove-material-btn');
      if (btn) {
        btn.style.display = items.length > 1 ? 'block' : 'none';
      }
    });
  }

  // ========== 素材の種類・割合 動的追加機能 ==========

  // 種類・割合の行を追加
  function addCompositionRow(materialIndex) {
    const composition = document.querySelector(`.material-composition[data-material-index="${materialIndex}"]`);
    if (!composition) {
      console.error('素材セクションが見つかりません:', materialIndex);
      return;
    }

    // 現在の行数を取得
    const currentRows = composition.querySelectorAll('.composition-row');
    const newRowIndex = currentRows.length + 1;

    // 最大10行まで
    if (newRowIndex > 10) {
      alert('種類は最大10個まで追加できます');
      return;
    }

    // 新しい行を作成
    const newRow = document.createElement('div');
    newRow.className = 'composition-row';
    newRow.setAttribute('data-row-index', newRowIndex);
    newRow.innerHTML = `
      <label>種類:
        <select id="素材${materialIndex}_種類${newRowIndex}" class="material-type">
          <option value="">--選択してください--</option>
        </select>
      </label>
      <label>割合:
        <select id="素材${materialIndex}_％${newRowIndex}" class="material-percent">
          <option value="">--選択してください--</option>
        </select>
      </label>
      <button type="button" class="remove-composition-btn" onclick="removeCompositionRow(${materialIndex}, ${newRowIndex})">×</button>
    `;

    composition.appendChild(newRow);

    // 新しいセレクトボックスにオプションを設定
    const typeSelect = document.getElementById(`素材${materialIndex}_種類${newRowIndex}`);
    const percentSelect = document.getElementById(`素材${materialIndex}_％${newRowIndex}`);

    if (typeSelect) {
      MATERIAL_TYPES.forEach(type => {
        typeSelect.insertAdjacentHTML('beforeend', `<option value="${type}">${type}</option>`);
      });
    }

    if (percentSelect) {
      for (let p = 1; p <= 100; p++) {
        percentSelect.insertAdjacentHTML('beforeend', `<option value="${p}%">${p}%</option>`);
      }
    }

    // 新しいセレクトにイベントリスナーを追加してプレビュー更新
    const updateMaterialPreview = () => {
      if (typeof updateDescriptionFromDetail === 'function') {
        updateDescriptionFromDetail();
      }
    };

    if (typeSelect) {
      typeSelect.addEventListener('change', updateMaterialPreview);
    }
    if (percentSelect) {
      percentSelect.addEventListener('change', updateMaterialPreview);
    }

    // 削除ボタンの表示更新
    updateCompositionRemoveButtons(materialIndex);
  }

  // 種類・割合の行を削除
  function removeCompositionRow(materialIndex, rowIndex) {
    const composition = document.querySelector(`.material-composition[data-material-index="${materialIndex}"]`);
    if (!composition) return;

    const row = composition.querySelector(`.composition-row[data-row-index="${rowIndex}"]`);
    if (row) {
      row.remove();

      // 行のインデックスを再番号付け
      const rows = composition.querySelectorAll('.composition-row');
      rows.forEach((r, i) => {
        const newIndex = i + 1;
        r.setAttribute('data-row-index', newIndex);

        // IDを更新
        const typeSelect = r.querySelector('.material-type');
        const percentSelect = r.querySelector('.material-percent');
        const removeBtn = r.querySelector('.remove-composition-btn');

        if (typeSelect) typeSelect.id = `素材${materialIndex}_種類${newIndex}`;
        if (percentSelect) percentSelect.id = `素材${materialIndex}_％${newIndex}`;
        if (removeBtn) removeBtn.onclick = () => removeCompositionRow(materialIndex, newIndex);
      });

      updateCompositionRemoveButtons(materialIndex);
      updateDescriptionFromDetail(); // 素材情報更新
    }
  }

  // 種類・割合の削除ボタン表示制御
  function updateCompositionRemoveButtons(materialIndex) {
    const composition = document.querySelector(`.material-composition[data-material-index="${materialIndex}"]`);
    if (!composition) return;

    const rows = composition.querySelectorAll('.composition-row');
    rows.forEach(row => {
      const btn = row.querySelector('.remove-composition-btn');
      if (btn) {
        // 1行しかない場合は削除ボタンを非表示
        btn.style.display = rows.length > 1 ? 'inline-block' : 'none';
      }
    });
  }

  // グローバルに公開
  window.addCompositionRow = addCompositionRow;
  window.removeCompositionRow = removeCompositionRow;

  // ========== カラー動的追加機能 ==========

  // カラーセレクトボックスにマスタデータを設定
  function populateColorSelect(index) {
    const colorSelect = document.getElementById(`カラー${index}`);

    if (colorSelect) {
      colorSelect.innerHTML = '<option value="">--選択してください--</option>';
      COLOR_OPTIONS.forEach(color => {
        colorSelect.insertAdjacentHTML('beforeend', `<option value="${color}">${color}</option>`);
      });

      // 変更時にプレビューを更新
      colorSelect.addEventListener('change', updateDescriptionFromDetail);
    }
  }

  // カラーを追加
  function addColor() {
    if (colorCount >= 5) {
      alert('カラーは最大5個まで追加できます');
      return;
    }

    colorCount++;

    const colorList = document.getElementById('colorList');
    const newItem = document.createElement('div');
    newItem.className = 'color-item';
    newItem.setAttribute('data-index', colorCount);

    newItem.innerHTML = `
      <div class="color-header">
        <span>カラー ${colorCount}</span>
        <button type="button" class="remove-color-btn" onclick="removeColor(${colorCount})">削除</button>
      </div>

      <!-- カラー検索入力欄 -->
      <div class="color-search-wrapper" style="margin-bottom: 8px; position: relative;">
        <input type="text" class="color-search-input" data-index="${colorCount}" placeholder="カラーを検索..." autocomplete="off" style="font-size: 16px; width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
        <div class="color-suggest-list" data-index="${colorCount}" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #d1d5db; border-top: none; border-radius: 0 0 6px 6px; max-height: 200px; overflow-y: auto; z-index: 100; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>
      </div>

      <div class="color-fields">
        <label>色:
          <select id="カラー${colorCount}" class="color-select">
            <option value="">--選択してください--</option>
          </select>
        </label>
      </div>
    `;

    colorList.appendChild(newItem);
    populateColorSelect(colorCount);
    setupColorRowSearch(colorCount); // 検索機能をセットアップ
    updateColorRemoveButtons();
  }

  // カラーを削除
  function removeColor(index) {
    const item = document.querySelector(`.color-item[data-index="${index}"]`);
    if (item) {
      item.remove();

      const items = document.querySelectorAll('.color-item');
      colorCount = items.length;

      items.forEach((item, i) => {
        const newIndex = i + 1;
        item.setAttribute('data-index', newIndex);
        item.querySelector('.color-header span').textContent = `カラー ${newIndex}`;

        // onclickも更新
        const removeBtn = item.querySelector('.remove-color-btn');
        if (removeBtn) {
          removeBtn.onclick = () => removeColor(newIndex);
        }

        // selectのIDも更新
        const select = item.querySelector('.color-select');
        if (select) {
          const oldId = select.id;
          const oldValue = select.value;
          select.id = `カラー${newIndex}`;
          select.value = oldValue; // 選択値を保持
        }

        // 検索要素のdata-indexも更新
        const searchInput = item.querySelector('.color-search-input');
        const suggestList = item.querySelector('.color-suggest-list');
        if (searchInput) searchInput.setAttribute('data-index', newIndex);
        if (suggestList) suggestList.setAttribute('data-index', newIndex);
      });

      updateColorRemoveButtons();
      updateDescriptionFromDetail(); // カラー情報更新
    }
  }

  // カラー削除ボタンの表示制御
  function updateColorRemoveButtons() {
    const items = document.querySelectorAll('.color-item');
    items.forEach(item => {
      const btn = item.querySelector('.remove-color-btn');
      if (btn) {
        btn.style.display = items.length > 1 ? 'block' : 'none';
      }
    });
  }

  // ========== カラー検索機能 ==========

  /**
   * カラー検索機能のセットアップ（全行に対して初期化）
   */
  function setupColorSearch() {
    console.log('🔍 setupColorSearch() 開始');

    // 既存のカラー行すべてに検索機能をセットアップ
    const colorItems = document.querySelectorAll('.color-item');
    console.log('🔍 検出されたカラー行数:', colorItems.length);

    colorItems.forEach(item => {
      const index = item.getAttribute('data-index');
      if (index) {
        console.log('🔍 カラー行', index, 'に検索機能をセットアップ');
        setupColorRowSearch(parseInt(index));
      }
    });

    // 入力欄外クリックで全ての候補リストを閉じる（1回だけ登録）
    if (!window._colorSearchClickHandlerRegistered) {
      document.addEventListener('click', function(e) {
        if (!e.target.closest('.color-search-wrapper')) {
          document.querySelectorAll('.color-suggest-list').forEach(list => {
            list.style.display = 'none';
          });
        }
      });
      window._colorSearchClickHandlerRegistered = true;
    }

    console.log('✅ カラー検索機能を初期化しました');
  }

  /**
   * 特定のカラー行に検索機能をセットアップ
   */
  function setupColorRowSearch(index) {
    const searchInput = document.querySelector(`.color-search-input[data-index="${index}"]`);
    const suggestList = document.querySelector(`.color-suggest-list[data-index="${index}"]`);

    if (!searchInput || !suggestList) {
      console.log(`カラー${index}の検索要素が見つかりません`);
      return;
    }

    // 入力時の検索処理
    searchInput.addEventListener('input', function() {
      const query = this.value.trim().toLowerCase();

      if (query.length === 0) {
        suggestList.style.display = 'none';
        return;
      }

      // カラーデータを取得（複数ソースをフォールバック）
      let colorData = COLOR_OPTIONS;
      console.log('カラー検索開始 - query:', query, 'COLOR_OPTIONS:', COLOR_OPTIONS?.length || 0);

      if (!colorData || colorData.length === 0) {
        const masterOpts = window.globalMasterOptions || MASTER_OPTIONS || {};
        colorData = masterOpts['カラー/配色/トーン'] || [];
        console.log('カラー検索: globalMasterOptionsからデータ取得:', colorData.length, 'キー一覧:', Object.keys(masterOpts));
      }

      // カラーデータから検索
      const results = [];
      colorData.forEach(color => {
        if (color.toLowerCase().includes(query)) {
          results.push(color);
        }
      });

      // 候補を表示
      if (results.length > 0) {
        suggestList.innerHTML = results.slice(0, 20).map(color => `
          <div class="color-suggest-item" data-value="${color}"
               style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;"
               onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
            <span style="font-weight: 500;">${color}</span>
          </div>
        `).join('');
        suggestList.style.display = 'block';

        // 候補クリック時の処理
        suggestList.querySelectorAll('.color-suggest-item').forEach(item => {
          item.addEventListener('click', function() {
            const value = this.dataset.value;
            selectColorForRow(index, value);
            searchInput.value = '';
            suggestList.style.display = 'none';
          });
        });
      } else {
        suggestList.innerHTML = '<div style="padding: 10px 12px; color: #9ca3af; font-size: 13px;">該当するカラーが見つかりません</div>';
        suggestList.style.display = 'block';
      }
    });

    // Escapeキーで候補を閉じる
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        suggestList.style.display = 'none';
        this.blur();
      }
    });
  }

  /**
   * 指定した行にカラーを設定
   */
  function selectColorForRow(index, value) {
    const colorSelect = document.getElementById(`カラー${index}`);

    if (!colorSelect) {
      console.error(`カラー${index}のプルダウンが見つかりません`);
      return;
    }

    // 値を設定
    colorSelect.value = value;

    // プレビューを更新
    if (typeof updateDescriptionFromDetail === 'function') {
      updateDescriptionFromDetail();
    }

    console.log(`カラー${index}に「${value}」を設定しました`);
  }

  // ========== 商品属性動的追加機能 ==========
  let attributeCount = 1;

  // カテゴリの選択肢を生成
  function getAttributeCategoryOptions() {
    const categories = [
      '生地・素材・質感系', '季節感・機能性', '着用シーン・イベント', '見た目・印象',
      'トレンド表現', 'サイズ感・体型カバー', '年代・テイスト・スタイル', 'カラー/配色/トーン',
      '柄・模様', 'ディテール・仕様', 'シルエット/ライン', 'ネックライン',
      '襟・衿', '袖・袖付け', '丈', '革/加工', '毛皮/加工', '生産国'
    ];
    let options = '<option value="">--選択してください--</option>';
    categories.forEach(cat => {
      options += `<option value="${cat}">${cat}</option>`;
    });
    return options;
  }

  // 商品属性のカテゴリプルダウンに選択肢を設定
  function populateAttributeCategory(index) {
    const categorySelect = document.getElementById(`商品属性${index}_カテゴリ`);
    if (categorySelect) {
      categorySelect.innerHTML = getAttributeCategoryOptions();
    }
  }

  // 商品属性セットを追加
  function addAttribute() {
    if (attributeCount >= 10) {
      alert('商品属性は最大10個まで追加できます');
      return;
    }

    attributeCount++;

    const attributeList = document.getElementById('attributeList');
    const newItem = document.createElement('div');
    newItem.className = 'attribute-item';
    newItem.setAttribute('data-index', attributeCount);

    newItem.innerHTML = `
      <div class="attribute-header">
        <span>属性 ${attributeCount}</span>
        <button type="button" class="remove-attribute-btn" onclick="removeProductAttribute(${attributeCount})">削除</button>
      </div>

      <!-- 検索バー -->
      <div class="attribute-search-wrapper" style="margin-bottom: 8px; position: relative;">
        <input type="text" class="attribute-search-input" data-index="${attributeCount}" placeholder="属性を検索..." autocomplete="off" style="font-size: 16px; width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 6px;">
        <div class="attribute-suggest-list" data-index="${attributeCount}" style="display: none; position: absolute; top: 100%; left: 0; right: 0; background: white; border: 1px solid #d1d5db; border-top: none; border-radius: 0 0 8px 8px; max-height: 200px; overflow-y: auto; z-index: 100; box-shadow: 0 4px 6px rgba(0,0,0,0.1);"></div>
      </div>

      <div class="row" style="margin-top: 6px;">
        <div>
          <label>カテゴリ</label>
          <select id="商品属性${attributeCount}_カテゴリ">
            <option value="">--選択してください--</option>
          </select>
        </div>
        <div>
          <label>値</label>
          <select id="商品属性${attributeCount}_値" disabled>
            <option value="">--カテゴリを選択してください--</option>
          </select>
        </div>
      </div>
    `;

    attributeList.appendChild(newItem);
    populateAttributeCategory(attributeCount);
    setupAttributeSelector(attributeCount);
    setupAttributeRowSearch(attributeCount); // 検索機能をセットアップ
    updateAttributeRemoveButtons();
    updateAttributeFields();
  }

  // 商品属性セットを削除
  function removeProductAttribute(index) {
    const item = document.querySelector(`.attribute-item[data-index="${index}"]`);
    if (item) {
      item.remove();

      const items = document.querySelectorAll('.attribute-item');
      attributeCount = items.length;

      items.forEach((item, i) => {
        const newIndex = i + 1;
        item.setAttribute('data-index', newIndex);
        item.querySelector('.attribute-header span').textContent = `属性 ${newIndex}`;

        // onclickも更新
        const removeBtn = item.querySelector('.remove-attribute-btn');
        if (removeBtn) {
          removeBtn.onclick = () => removeProductAttribute(newIndex);
        }
      });

      updateAttributeRemoveButtons();
      updateAttributeFields();
      updateNamePreview();
    }
  }

  // 削除ボタンの表示制御
  function updateAttributeRemoveButtons() {
    const items = document.querySelectorAll('.attribute-item');
    items.forEach(item => {
      const btn = item.querySelector('.remove-attribute-btn');
      if (btn) {
        btn.style.display = (items.length > 1) ? 'block' : 'none';
      }
    });
  }

  // NAME_REST_FIELDS配列を更新（商品名プレビュー用）
  function updateAttributeFields() {
    const items = document.querySelectorAll('.attribute-item');
    NAME_REST_FIELDS.length = 0; // 配列をクリア
    items.forEach((item, i) => {
      NAME_REST_FIELDS.push(`商品属性${i + 1}_値`);
    });
  }

  // 単一の商品属性セレクターをセットアップ
  function setupAttributeSelector(index) {
    const categorySelect = document.getElementById(`商品属性${index}_カテゴリ`);
    const valueSelect = document.getElementById(`商品属性${index}_値`);

    if (categorySelect && valueSelect) {
      categorySelect.addEventListener('change', function() {
        updateAttributeValues(`商品属性${index}_カテゴリ`, `商品属性${index}_値`);
      });

      valueSelect.addEventListener('change', updateNamePreview);
    }
  }

  /**
   * 商品属性検索機能のセットアップ（全行に対して初期化）
   */
  function setupAttributeSearch() {
    // 既存の属性行すべてに検索機能をセットアップ
    const attributeItems = document.querySelectorAll('.attribute-item');
    attributeItems.forEach(item => {
      const index = item.getAttribute('data-index');
      if (index) {
        setupAttributeRowSearch(parseInt(index));
      }
    });

    // 入力欄外クリックで全ての候補リストを閉じる
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.attribute-search-wrapper')) {
        document.querySelectorAll('.attribute-suggest-list').forEach(list => {
          list.style.display = 'none';
        });
      }
    });

    console.log('商品属性検索機能を初期化しました');
  }

  /**
   * 特定の属性行に検索機能をセットアップ
   */
  function setupAttributeRowSearch(index) {
    const searchInput = document.querySelector(`.attribute-search-input[data-index="${index}"]`);
    const suggestList = document.querySelector(`.attribute-suggest-list[data-index="${index}"]`);

    if (!searchInput || !suggestList) {
      console.log(`属性${index}の検索要素が見つかりません`);
      return;
    }

    // 入力時の検索処理
    searchInput.addEventListener('input', function() {
      const query = this.value.trim().toLowerCase();

      if (query.length === 0) {
        suggestList.style.display = 'none';
        return;
      }

      // globalMasterOptionsまたはMASTER_OPTIONSから検索
      const masterOptions = window.globalMasterOptions || MASTER_OPTIONS || {};
      const results = [];

      // カテゴリリスト（商品属性用）
      const attributeCategories = [
        '生地・素材・質感系', '季節感・機能性', '着用シーン・イベント', '見た目・印象',
        'トレンド表現', 'サイズ感・体型カバー', '年代・テイスト・スタイル', 'カラー/配色/トーン',
        '柄・模様', 'ディテール・仕様', 'シルエット/ライン', 'ネックライン',
        '襟・衿', '袖・袖付け', '丈', '革/加工', '毛皮/加工', '生産国'
      ];

      // 各カテゴリの値を検索
      attributeCategories.forEach(category => {
        const values = masterOptions[category] || [];
        values.forEach(value => {
          if (value.toLowerCase().includes(query)) {
            results.push({ value, category });
          }
        });
      });

      // 重複排除
      const uniqueResults = results.filter((item, idx, self) =>
        idx === self.findIndex(t => t.value === item.value && t.category === item.category)
      );

      // 候補を表示
      if (uniqueResults.length > 0) {
        suggestList.innerHTML = uniqueResults.slice(0, 20).map(item => `
          <div class="attribute-suggest-item" data-value="${item.value}" data-category="${item.category}"
               style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;"
               onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
            <span style="font-weight: 500;">${item.value}</span>
            <span style="font-size: 11px; color: #6b7280; background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${item.category}</span>
          </div>
        `).join('');
        suggestList.style.display = 'block';

        // 候補クリック時の処理
        suggestList.querySelectorAll('.attribute-suggest-item').forEach(item => {
          item.addEventListener('click', function() {
            const value = this.dataset.value;
            const category = this.dataset.category;
            selectAttributeForRow(index, value, category);
            searchInput.value = '';
            suggestList.style.display = 'none';
          });
        });
      } else {
        suggestList.innerHTML = '<div style="padding: 10px 12px; color: #9ca3af; font-size: 13px;">該当する属性が見つかりません</div>';
        suggestList.style.display = 'block';
      }
    });

    // Escapeキーで候補を閉じる
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        suggestList.style.display = 'none';
        this.blur();
      }
    });
  }

  /**
   * 指定した行に属性を設定
   */
  function selectAttributeForRow(index, value, category) {
    const categorySelect = document.getElementById(`商品属性${index}_カテゴリ`);
    const valueSelect = document.getElementById(`商品属性${index}_値`);

    if (!categorySelect || !valueSelect) {
      console.error(`属性${index}のプルダウンが見つかりません`);
      return;
    }

    // カテゴリを設定
    categorySelect.value = category;
    updateAttributeValues(`商品属性${index}_カテゴリ`, `商品属性${index}_値`);

    // 値のセットは少し遅延させる（プルダウンの更新を待つ）
    setTimeout(() => {
      const updatedValueSelect = document.getElementById(`商品属性${index}_値`);
      if (updatedValueSelect) {
        updatedValueSelect.value = value;
        updateNamePreview();
      }
    }, 100);
  }

  // 商品の状態に応じてボタンを表示切替
  function updateConditionButtons() {
    const conditionSelect = document.getElementById('商品の状態');
    const container = document.getElementById('quickInsertButtonsContainer');

    if (!conditionSelect || !container) {
      console.log('商品の状態またはボタンコンテナが見つかりません');
      return;
    }

    const conditionValue = conditionSelect.value;
    const buttons = CONDITION_BUTTONS[conditionValue] || [];

    // コンテナをクリア
    container.innerHTML = '';

    // ボタンが存在しない場合は非表示
    if (buttons.length === 0) {
      container.style.display = 'none';
      return;
    }

    container.style.display = '';

    // ボタンを生成
    buttons.forEach(btn => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'quick-btn';
      button.textContent = btn.ボタンラベル || btn.label || '';
      button.setAttribute('data-text', btn.ボタンテキスト || btn.text || '');

      // クリックイベント
      button.addEventListener('click', function() {
        const textarea = document.getElementById('商品状態詳細');
        if (!textarea) return;

        const text = this.getAttribute('data-text');

        // ボタンを押すと常に置き換え（上書き）
        textarea.value = text;

        // 商品の説明を更新
        if (typeof updateDescriptionFromDetail === 'function') {
          updateDescriptionFromDetail();
        }
      });

      container.appendChild(button);
    });

    console.log('クイック挿入ボタン表示更新:', buttons.length, '個');
  }

  // クイック挿入ボタンのイベントリスナー設定
  function setupQuickInsertButtons() {
    // 初期化時に商品の状態に応じてボタンを表示
    updateConditionButtons();
    console.log('クイック挿入ボタン初期化完了');
  }

  // 商品状態詳細オートコンプリート機能
  function attachConditionSuggest(inputId, list) {
    const input = document.getElementById(inputId);
    const panel = document.getElementById('suggest-' + inputId);

    if (!input || !panel) {
      console.log(`商品状態詳細オートコンプリート: 要素が見つかりません ${inputId}`);
      return;
    }

    let activeIndex = -1;
    const limit = 10;

    const render = (items) => {
      panel.innerHTML = '';
      if (!items.length) {
        panel.innerHTML = '<div class="sug-empty">候補なし</div>';
        panel.hidden = false;
        return;
      }

      items.slice(0, limit).forEach((v, i) => {
        const div = document.createElement('div');
        div.className = 'sug-item';
        div.textContent = v;

        div.addEventListener('mousemove', () => {
          Array.from(panel.querySelectorAll('.sug-item')).forEach(x => x.classList.remove('active'));
          div.classList.add('active');
          activeIndex = i;
        });

        div.addEventListener('mousedown', (e) => {
          e.preventDefault();
        });

        div.addEventListener('click', () => {
          input.value = v;
          hide();
          if (typeof updateDescriptionFromDetail === 'function') {
            updateDescriptionFromDetail();
          }
        });

        panel.appendChild(div);
      });

      panel.hidden = false;
    };

    const hide = () => {
      panel.hidden = true;
      activeIndex = -1;
    };

    const hideLater = () => setTimeout(hide, 100);

    const doFilter = () => {
      const q = (input.value || '').trim();

      if (!Array.isArray(list) || list.length === 0 || !q || q.length < 2) {
        hide();
        return;
      }

      // 部分一致検索（大文字小文字を区別しない）
      const qq = q.toLowerCase();
      const filtered = list.filter(v => {
        const s = String(v).toLowerCase();
        return s.indexOf(qq) !== -1;
      });

      console.log(`商品状態詳細候補: ${filtered.length}件`);
      render(filtered);
    };

    input.addEventListener('input', doFilter);
    input.addEventListener('focus', doFilter);
    input.addEventListener('blur', hideLater);

    input.addEventListener('keydown', (e) => {
      if (panel.hidden) return;
      const items = Array.from(panel.querySelectorAll('.sug-item'));
      if (!items.length) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        items.forEach(x => x.classList.remove('active'));
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach(x => x.classList.remove('active'));
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0) {
          e.preventDefault();
          input.value = items[activeIndex].textContent || '';
          hide();
          if (typeof updateDescriptionFromDetail === 'function') {
            updateDescriptionFromDetail();
          }
        }
      } else if (e.key === 'Escape') {
        hide();
      }
    });

    console.log('商品状態詳細オートコンプリート設定完了');
  }

  // ハッシュタグ設定（設定マスタから読み込む）
  // デフォルトは空（Firestoreから読み込む）
  let HASHTAG_CONFIG = {
    hashtags: []  // 空の場合はプレビューに表示されない
  };

  // 設定マスタからハッシュタグ設定を読み込む
  function loadHashtagConfig() {
    // 1. まずCACHED_CONFIG（Firestore）から読み込み
    if (window.CACHED_CONFIG && window.CACHED_CONFIG['ハッシュタグ']) {
      HASHTAG_CONFIG = window.CACHED_CONFIG['ハッシュタグ'];
      console.log('✅ ハッシュタグ設定をCACHED_CONFIGから読み込みました:', HASHTAG_CONFIG);
      renderHashtagCheckboxes();
      if (typeof updateDescriptionFromDetail === 'function') {
        updateDescriptionFromDetail();
      }
      return;
    }

    // CACHED_CONFIGにもない場合はチェックボックスを空で表示
    console.log('⚠️ ハッシュタグ設定が見つかりません');
    renderHashtagCheckboxes();
  }

  /**
   * ハッシュタグチェックボックスを生成
   */
  function renderHashtagCheckboxes() {
    console.log('renderHashtagCheckboxes が呼び出されました');
    const container = document.getElementById('hashtagCheckboxContainer');
    if (!container) {
      console.error('hashtagCheckboxContainer が見つかりません');
      return;
    }

    container.innerHTML = '';

    console.log('HASHTAG_CONFIG:', HASHTAG_CONFIG);
    if (!HASHTAG_CONFIG || !HASHTAG_CONFIG.hashtags || HASHTAG_CONFIG.hashtags.length === 0) {
      console.warn('ハッシュタグ設定が空です');
      container.innerHTML = '<div style="font-size: 11px; color: #6b7280; text-align: center;">ハッシュタグ設定がありません</div>';
      return;
    }

    const hashtags = HASHTAG_CONFIG.hashtags;
    const commonPrefix = HASHTAG_CONFIG.commonPrefix || '#';

    hashtags.forEach((hashtag, index) => {
      const title = hashtag.title || '';
      const icon = hashtag.icon || '';
      const suffix = hashtag.suffix || '';

      // プレビューテキストを生成（実際の値は商品登録時に動的に変わる）
      let previewText = '';
      if (title === '全商品') {
        previewText = `${commonPrefix}${suffix}`;
      } else if (title === 'ブランド') {
        previewText = `${commonPrefix}ブランド名${suffix}`;
      } else if (title === 'カテゴリ') {
        const categoryOptions = hashtag.categoryOptions || [];
        const categoryPreview = categoryOptions.join('+');
        previewText = `${commonPrefix}${categoryPreview}${suffix}`;
      } else {
        previewText = `${commonPrefix}${suffix}`;
      }

      const checkboxId = `hashtag-checkbox-${index}`;

      console.log(`Creating toggle ${index}:`, {title, icon, previewText});

      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 4px; border-bottom: 1px solid #e5e7eb;';

      const textSpan = document.createElement('span');
      textSpan.style.cssText = 'font-size: 12px; color: #374151;';
      textSpan.textContent = previewText;

      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'toggle-switch';
      toggleLabel.style.cssText = 'flex-shrink: 0;';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxId;
      checkbox.setAttribute('data-index', index);
      checkbox.checked = true;
      checkbox.onchange = updateDescriptionFromDetail;

      const slider = document.createElement('span');
      slider.className = 'toggle-slider';

      toggleLabel.appendChild(checkbox);
      toggleLabel.appendChild(slider);

      row.appendChild(textSpan);
      row.appendChild(toggleLabel);

      container.appendChild(row);
    });

    // 生成後のDOMを確認
    console.log('生成されたHTML:', container.innerHTML);
    console.log('チェックボックスコンテナの子要素数:', container.children.length);
  }

  /**
   * 折りたたみ機能
   */
  function toggleCollapse(sectionId) {
    const section = document.getElementById(sectionId);
    const toggleIcon = document.getElementById(sectionId.replace('Section', 'Toggle'));

    if (section && toggleIcon) {
      const isHidden = section.style.display === 'none';
      section.style.display = isHidden ? 'block' : 'none';
      toggleIcon.textContent = isHidden ? '▲' : '▼';
    }
  }

  /**
   * 割引情報チェックボックスを動的生成
   */
  function renderDiscountCheckboxes() {
    console.log('renderDiscountCheckboxes が呼び出されました');
    const container = document.getElementById('discountCheckboxContainer');
    if (!container) {
      console.error('discountCheckboxContainer が見つかりません');
      return;
    }

    container.innerHTML = '';

    console.log('DISCOUNT_CONFIG:', DISCOUNT_CONFIG);
    if (!DISCOUNT_CONFIG) {
      console.warn('割引設定が空です');
      container.innerHTML = '<div style="font-size: 11px; color: #6b7280; text-align: center;">割引設定がありません</div>';
      return;
    }

    const discounts = [];

    // フォロー割
    if (DISCOUNT_CONFIG['フォロー割'] && DISCOUNT_CONFIG['フォロー割'].length > 0) {
      discounts.push({
        id: 'follow',
        label: 'フォロー割',
        icon: ''
      });
    }

    // リピート割
    if (DISCOUNT_CONFIG['リピート割'] && DISCOUNT_CONFIG['リピート割'].length > 0) {
      discounts.push({
        id: 'repeat',
        label: 'リピート割',
        icon: ''
      });
    }

    // まとめ割
    if (DISCOUNT_CONFIG['まとめ割'] && DISCOUNT_CONFIG['まとめ割'].length > 0) {
      discounts.push({
        id: 'matome',
        label: 'まとめ割',
        icon: ''
      });
    }

    if (discounts.length === 0) {
      container.innerHTML = '<div style="font-size: 11px; color: #6b7280; text-align: center;">割引設定がありません</div>';
      return;
    }

    // テーマチェック: モダンテーマの場合は絵文字を表示しない
    const isModernTheme = document.body.classList.contains('theme-modern');

    discounts.forEach((discount, index) => {
      const checkboxId = `discount-checkbox-${discount.id}`;

      const row = document.createElement('div');
      row.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 10px 4px; border-bottom: 1px solid #e5e7eb;';

      const textSpan = document.createElement('span');
      textSpan.style.cssText = 'font-size: 14px; color: #374151;';
      textSpan.textContent = isModernTheme ? discount.label : `${discount.icon} ${discount.label}`;

      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'toggle-switch';
      toggleLabel.style.cssText = 'flex-shrink: 0;';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = checkboxId;
      checkbox.setAttribute('data-discount-type', discount.id);
      checkbox.checked = true;
      checkbox.onchange = updateDescriptionFromDetail;

      const slider = document.createElement('span');
      slider.className = 'toggle-slider';

      toggleLabel.appendChild(checkbox);
      toggleLabel.appendChild(slider);

      row.appendChild(textSpan);
      row.appendChild(toggleLabel);

      container.appendChild(row);
    });

    console.log('割引情報チェックボックス生成完了:', discounts.length);
  }

  /**
   * ハッシュタグチェックボックスのプレビューテキストを更新
   */
  function updateHashtagCheckboxPreviews() {
    if (!HASHTAG_CONFIG || !HASHTAG_CONFIG.hashtags) return;

    const hashtags = HASHTAG_CONFIG.hashtags;
    const commonPrefix = HASHTAG_CONFIG.commonPrefix || '#';

    hashtags.forEach((hashtag, index) => {
      const previewElement = document.getElementById(`hashtag-preview-${index}`);
      if (!previewElement) return;

      const title = hashtag.title || '';
      const suffix = hashtag.suffix || '';
      let previewText = '';

      if (title === '全商品') {
        previewText = `${commonPrefix}${suffix}`;
      } else if (title === 'ブランド') {
        const brandEn = _val('ブランド(英語)');
        const brandKana = _val('ブランド(カナ)');
        const brand = brandEn || brandKana;
        if (brand) {
          const cleanBrand = brand.replace(/\s+/g, '');
          previewText = `${commonPrefix}${cleanBrand}${suffix}`;
        } else {
          previewText = `${commonPrefix}ブランド名${suffix}`;
        }
      } else if (title === 'カテゴリ') {
        const categoryOptions = hashtag.categoryOptions || [];
        const categoryMap = {
          '大分類': _val('大分類(カテゴリ)'),
          '中分類': _val('中分類(カテゴリ)'),
          '小分類': _val('小分類(カテゴリ)'),
          '細分類1': _val('細分類(カテゴリ)'),
          '細分類2': _val('細分類2'),
          'アイテム名': _val('アイテム名')
        };

        const categoryParts = [];
        categoryOptions.forEach(optionName => {
          const value = categoryMap[optionName];
          if (value) {
            categoryParts.push(value);
          }
        });

        if (categoryParts.length > 0) {
          previewText = `${commonPrefix}${categoryParts.join('')}${suffix}`;
        } else {
          const categoryPreview = categoryOptions.join('+');
          previewText = `${commonPrefix}${categoryPreview}${suffix}`;
        }
      } else {
        previewText = `${commonPrefix}${suffix}`;
      }

      previewElement.textContent = previewText;
    });
  }

  // ========================================
  // ランクマスタ関連
  // ========================================
  
  // ランクデータをキャッシュ
  let RANK_OPTIONS = [];
  
  /**
   * ランクマスタをFirestoreから読み込み、セレクトボックスに設定
   */
  async function loadRankOptions() {
    const rankSelect = document.getElementById('ランク');
    if (!rankSelect) {
      console.log('[Rank] ランクセレクトが見つかりません');
      return;
    }
    
    try {
      if (!window.db) {
        console.warn('[Rank] Firestoreが初期化されていません');
        return;
      }
      
      const snapshot = await window.db.collection('conditionRanks')
        .orderBy('sortOrder', 'asc')
        .get();
      
      if (snapshot.empty) {
        console.log('[Rank] ランクマスタが空です');
        return;
      }
      
      // オプションをクリアして再構築
      rankSelect.innerHTML = '<option value="">--選択してください--</option>';
      
      RANK_OPTIONS = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        RANK_OPTIONS.push({
          id: doc.id,
          code: data.code || '',
          name: data.name || '',
          description: data.description || '',
          minPrice: data.minPrice || 0,
          maxPrice: data.maxPrice || 0
        });
        
        // オプションを追加（コード + 名前を表示）
        const option = document.createElement('option');
        option.value = data.code || '';
        option.textContent = `${data.code || ''} - ${data.name || ''}`;
        option.dataset.rankId = doc.id;
        option.dataset.description = data.description || '';
        rankSelect.appendChild(option);
      });
      
      console.log(`✅ [Rank] ランクマスタ読み込み完了: ${RANK_OPTIONS.length}件`);
      
      // グローバルに公開（仕入登録等で使用）
      window.RANK_OPTIONS = RANK_OPTIONS;
      
    } catch (error) {
      console.error('[Rank] ランクマスタ読み込みエラー:', error);
    }
  }
  
  /**
   * ランク変更時のハンドラ（レガシー互換）
   * ※ 現在はonConditionChangeで商品の状態からランクが自動連動
   */
  window.onRankChange = function() {
    // hidden input からランク値を取得
    const rankHidden = document.getElementById('ランク');
    const rankCode = rankHidden ? rankHidden.value : '';

    console.log(`[Rank] ランク変更（レガシー）: ${rankCode}`);

    // 商品説明プレビューを更新
    if (typeof updateDescriptionFromDetail === 'function') {
      updateDescriptionFromDetail();
    }
  };
  
  /**
   * 現在選択されているランク情報を取得
   */
  function getSelectedRankInfo() {
    // ランクは商品の状態から自動連動（onConditionChangeで設定）
    if (window.currentConditionRank) {
      return {
        code: window.currentConditionRank.code,
        name: window.currentConditionRank.name,
        description: window.currentConditionRank.description || ''
      };
    }
    
    // フォールバック: hidden inputから直接取得
    const rankHidden = document.getElementById('ランク');
    if (rankHidden && rankHidden.value) {
      const rankInfo = CONDITION_TO_RANK_MAP[Object.keys(CONDITION_TO_RANK_MAP).find(
        key => CONDITION_TO_RANK_MAP[key].code === rankHidden.value
      )];
      if (rankInfo) {
        return {
          code: rankInfo.code,
          name: rankInfo.name,
          description: ''
        };
      }
    }
    
    return null;
  }
  
  // グローバルに公開
  window.loadRankOptions = loadRankOptions;
  window.getSelectedRankInfo = getSelectedRankInfo;

  // 割引情報設定（設定マスタから読み込む）
  // デフォルトは空（Firestoreから読み込む）
  let DISCOUNT_CONFIG = {};  // 空の場合はプレビューに表示されない

  // 設定マスタから割引情報を読み込む
  function loadDiscountConfig() {
    // 1. まずCACHED_CONFIG（Firestore）から読み込み
    if (window.CACHED_CONFIG && window.CACHED_CONFIG['割引情報']) {
      DISCOUNT_CONFIG = window.CACHED_CONFIG['割引情報'];
      console.log('✅ 割引情報設定をCACHED_CONFIGから読み込みました:', DISCOUNT_CONFIG);
      renderDiscountCheckboxes();
      if (typeof updateDescriptionFromDetail === 'function') {
        updateDescriptionFromDetail();
      }
      return;
    }

    // CACHED_CONFIGにもない場合はチェックボックスを空で表示
    console.log('⚠️ 割引情報設定が見つかりません');
    renderDiscountCheckboxes();
  }

  // 割引情報テキストを生成（チェックボックス対応版）
  function generateDiscountInfo() {
    // 割引情報があるかチェック
    const hasFollow = DISCOUNT_CONFIG['フォロー割'] && DISCOUNT_CONFIG['フォロー割'].length > 0;
    const hasRepeat = DISCOUNT_CONFIG['リピート割'] && DISCOUNT_CONFIG['リピート割'].length > 0;
    const hasMatome = DISCOUNT_CONFIG['まとめ割'] && DISCOUNT_CONFIG['まとめ割'].length > 0;

    // チェックボックスの状態を確認
    const followCheckbox = document.getElementById('discount-checkbox-follow');
    const repeatCheckbox = document.getElementById('discount-checkbox-repeat');
    const matomeCheckbox = document.getElementById('discount-checkbox-matome');

    const includeFollow = hasFollow && (!followCheckbox || followCheckbox.checked);
    const includeRepeat = hasRepeat && (!repeatCheckbox || repeatCheckbox.checked);
    const includeMatome = hasMatome && (!matomeCheckbox || matomeCheckbox.checked);

    // すべての割引が空またはチェックなしの場合は空文字を返す
    if (!includeFollow && !includeRepeat && !includeMatome) {
      return '';
    }

    let text = '\n【お得な割引情報】\n\n';

    // テーマチェック: モダンテーマの場合は絵文字を表示しない
    const isModernTheme = document.body.classList.contains('theme-modern');
    const bullet = isModernTheme ? '' : '■ ';

    // フォロー割
    if (includeFollow) {
      text += `${bullet}フォロー割\n`;
      DISCOUNT_CONFIG['フォロー割'].forEach(item => {
        text += `${item.範囲} ⇒ ${item.割引額}\n`;
      });
      // 説明文があれば追加
      if (DISCOUNT_CONFIG['フォロー割_説明文']) {
        text += `${DISCOUNT_CONFIG['フォロー割_説明文']}\n`;
      }
      text += '\n';
    }

    // リピート割
    if (includeRepeat) {
      const repeatDiscount = DISCOUNT_CONFIG['リピート割'][0].割引額;
      text += `${bullet}リピート割\n`;
      text += `次回購入時に${repeatDiscount}\n`;
      // 説明文があれば追加
      if (DISCOUNT_CONFIG['リピート割_説明文']) {
        text += `${DISCOUNT_CONFIG['リピート割_説明文']}\n`;
      }
      text += '\n';
    }

    // まとめ割
    if (includeMatome) {
      text += `${bullet}まとめ割\n`;
      DISCOUNT_CONFIG['まとめ割'].forEach(item => {
        text += `${item.範囲}⇒${item.割引額}\n`;
      });
      // 説明文があれば追加
      if (DISCOUNT_CONFIG['まとめ割_説明文']) {
        text += `${DISCOUNT_CONFIG['まとめ割_説明文']}`;
      }
    }

    return text;
  }

  // オリジナルハッシュタグ生成関数（動的設定対応版・チェックボックス連動）
  function generateHashtags() {
    const tags = [];

    // 新形式（動的ハッシュタグ配列 + 共通プレフィックス）に対応
    if (HASHTAG_CONFIG.hashtags && Array.isArray(HASHTAG_CONFIG.hashtags)) {
      const commonPrefix = HASHTAG_CONFIG.commonPrefix || '';

      HASHTAG_CONFIG.hashtags.forEach((hashtag, index) => {
        // チェックボックスの状態を確認
        const checkbox = document.getElementById(`hashtag-checkbox-${index}`);
        if (!checkbox || !checkbox.checked) {
          return; // チェックされていない場合はスキップ
        }

        const suffix = hashtag.suffix || '';
        const title = hashtag.title || '';

        // タイトルに基づいて中間部分を決定
        if (title === '全商品') {
          // 全商品タグ
          tags.push(`${commonPrefix}${suffix}`);
        } else if (title === 'ブランド') {
          // ブランド別タグ（英語優先、なければカナ）
          const brandEn = _val('ブランド(英語)');
          const brandKana = _val('ブランド(カナ)');
          const brand = brandEn || brandKana;
          if (brand) {
            const cleanBrand = brand.replace(/\s+/g, '');
            tags.push(`${commonPrefix}${cleanBrand}${suffix}`);
          }
        } else if (title === 'カテゴリ') {
          // カテゴリタグ（選択されたカテゴリを連結）
          const categoryOptions = hashtag.categoryOptions || ['大分類', '中分類'];

          // カテゴリ値のマッピング
          const categoryMap = {
            '特大分類': _val('特大分類'),
            '大分類': _val('大分類(カテゴリ)'),
            '中分類': _val('中分類(カテゴリ)'),
            '小分類': _val('小分類(カテゴリ)'),
            '細分類1': _val('細分類(カテゴリ)'),
            '細分類2': _val('細分類2'),
            'アイテム名': _val('アイテム名')
          };

          // 選択されたカテゴリを順番に連結
          const categoryParts = [];
          categoryOptions.forEach(optionName => {
            const value = categoryMap[optionName];
            if (value) {
              categoryParts.push(value);
            }
          });

          // 連結されたカテゴリでハッシュタグを生成
          if (categoryParts.length > 0) {
            const combinedCategory = categoryParts.join('');
            tags.push(`${commonPrefix}${combinedCategory}${suffix}`);
          }
        } else if (title === 'カラー') {
          // カラータグ
          const colorValue = _val('カラー');
          if (colorValue) {
            const cleanColor = colorValue.replace(/\s+/g, '');
            tags.push(`${commonPrefix}${cleanColor}${suffix}`);
          }
        } else if (title === 'サイズ') {
          // サイズタグ
          const sizeValue = _val('サイズ');
          if (sizeValue) {
            const cleanSize = sizeValue.replace(/\s+/g, '');
            tags.push(`${commonPrefix}${cleanSize}${suffix}`);
          }
        } else {
          // カスタムハッシュタグ（タイトルが特定のものでない場合）
          // 共通プレフィックスとサフィックスのみ結合
          if (commonPrefix || suffix) {
            tags.push(`${commonPrefix}${suffix}`);
          }
        }
      });
    } else {
      // 旧形式（固定3項目）との後方互換性
      // 全商品タグ
      if (HASHTAG_CONFIG.全商品プレフィックス || HASHTAG_CONFIG.全商品テキスト) {
        const allProductPrefix = HASHTAG_CONFIG.全商品プレフィックス || '#REBORN_';
        const allProductText = HASHTAG_CONFIG.全商品テキスト || '全商品';
        tags.push(`${allProductPrefix}${allProductText}`);
      }

      // ブランド別タグ
      const brandEn = _val('ブランド(英語)');
      if (brandEn && (HASHTAG_CONFIG.ブランドプレフィックス || HASHTAG_CONFIG.ブランドサフィックス)) {
        const brandPrefix = HASHTAG_CONFIG.ブランドプレフィックス || '#REBORN_';
        const brandSuffix = HASHTAG_CONFIG.ブランドサフィックス || 'アイテム一覧';
        const cleanBrand = brandEn.replace(/\s+/g, '');
        tags.push(`${brandPrefix}${cleanBrand}${brandSuffix}`);
      }

      // カテゴリタグ
      if (HASHTAG_CONFIG.カテゴリプレフィックス || HASHTAG_CONFIG.カテゴリサフィックス) {
        const categoryPrefix = HASHTAG_CONFIG.カテゴリプレフィックス || '#REBORN_';
        const categorySuffix = HASHTAG_CONFIG.カテゴリサフィックス || '一覧';

        const category1 = _val('大分類(カテゴリ)');
        const category2 = _val('中分類(カテゴリ)');

        if (category2) {
          tags.push(`${categoryPrefix}${category2}${categorySuffix}`);
        }
        if (category1) {
          tags.push(`${categoryPrefix}${category1}${categorySuffix}`);
        }
        if (category1 && category2) {
          tags.push(`${categoryPrefix}${category1}${category2}${categorySuffix}`);
        }
      }
    }

    // 重複削除
    return [...new Set(tags)];
  }

  function splitMulti(s) {
    return String(s||'').split(/[,\u3001\/\uFF0F\n]+/).map(v=>v.trim()).filter(v=>v.length>0);
  }

  function uniqKeepOrder(arr) {
    const s=new Set(), out=[];
    for(const x of arr||[]) {
      const v=(x??'').toString().trim();
      if(!v||s.has(v))continue;
      s.add(v);
      out.push(v);
    }
    return out;
  }

  // ブランドペアデータの高速検索用インデックスマップを構築
  function buildBrandIndexMap() {
    BRAND_INDEX_MAP.clear();

    // ペアデータから英語名をキーとしてマップを構築
    BRAND_PAIRS.forEach((pair, index) => {
      if (pair && pair.english) {
        BRAND_INDEX_MAP.set(pair.english, index);
      }
    });

    console.log(`ブランドペアインデックスマップ構築完了: ${BRAND_INDEX_MAP.size}件`);
    console.log('ブランドペアデータ数:', BRAND_PAIRS.length);
  }

  function fillSelectSafe(sel, values) {
    if (!sel) return;
    if (Array.isArray(values) && values.length) {
      const prev = sel.value;
      sel.innerHTML = '<option value="">--選択してください--</option>';
      values.forEach(v=> sel.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`));
      sel.disabled = false;
      if (prev && values.includes(prev)) sel.value = prev;
    }
  }

  function resetSelect(id, disable=true) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '<option value="">--選択してください--</option>';
    sel.value = '';
    if (disable) sel.disabled = true;
  }

  function applyShippingDefaults() {
    for (const k of Object.keys(SHIPPING_DEFAULTS)) {
      const el = document.getElementById(k);
      if (!el) continue;
      const def = SHIPPING_DEFAULTS[k];
      if (!def) continue;
      const exists = Array.from(el.options).some(o => String(o.value) === def);
      if (!exists) el.insertAdjacentHTML('beforeend', `<option value="${def}">${def}</option>`);
      el.value = def;
    }
  }

  function applyProcureListingDefaults() {
    // ローカル時間（日本時間）でYYYY-MM-DD形式を取得
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const today = `${year}-${month}-${day}`;

    // デフォルト仕入日
    const procureDateField = document.getElementById('仕入日');
    if (procureDateField) {
      if (PROCURE_LISTING_DEFAULTS['仕入日_今日'] === true) {
        // 「常に今日」がチェックされている場合は今日の日付を使用
        procureDateField.value = today;
      } else {
        // 固定日付を使用
        const defaultProcureDate = PROCURE_LISTING_DEFAULTS['デフォルト仕入日'];
        if (defaultProcureDate) {
          procureDateField.value = defaultProcureDate;
        }
      }
    }

    // デフォルト仕入先
    const defaultProcureSource = PROCURE_LISTING_DEFAULTS['デフォルト仕入先'];
    if (defaultProcureSource) {
      const procureSourceField = document.getElementById('仕入先');
      if (procureSourceField) {
        // 選択肢に存在するか確認
        const exists = Array.from(procureSourceField.options).some(o => String(o.value) === defaultProcureSource);
        if (!exists) {
          procureSourceField.insertAdjacentHTML('beforeend', `<option value="${defaultProcureSource}">${defaultProcureSource}</option>`);
        }
        procureSourceField.value = defaultProcureSource;
      }
    }

    // デフォルト出品日
    const listingDateField = document.getElementById('出品日');
    if (listingDateField) {
      if (PROCURE_LISTING_DEFAULTS['出品日_今日'] === true) {
        // 「常に今日」がチェックされている場合は今日の日付を使用
        listingDateField.value = today;
      } else {
        // 固定日付を使用
        const defaultListingDate = PROCURE_LISTING_DEFAULTS['デフォルト出品日'];
        if (defaultListingDate) {
          listingDateField.value = defaultListingDate;
        }
      }
    }

    // デフォルト出品先
    const defaultListingDest = PROCURE_LISTING_DEFAULTS['デフォルト出品先'];
    if (defaultListingDest) {
      const listingDestField = document.getElementById('出品先');
      if (listingDestField) {
        // 選択肢に存在するか確認
        const exists = Array.from(listingDestField.options).some(o => String(o.value) === defaultListingDest);
        if (!exists) {
          listingDestField.insertAdjacentHTML('beforeend', `<option value="${defaultListingDest}">${defaultListingDest}</option>`);
        }
        listingDestField.value = defaultListingDest;

        // 販売タイプの表示/非表示を更新（メルカリの場合は表示）
        if (typeof handleSalesChannelChange === 'function') {
          handleSalesChannelChange();
          console.log('✅ デフォルト出品先設定後に販売タイプを更新');
        }

        // デフォルト販売タイプを設定（メルカリの場合のみ）
        const defaultSalesType = PROCURE_LISTING_DEFAULTS['デフォルト販売タイプ'];
        if (defaultSalesType && defaultListingDest === 'メルカリ') {
          const salesTypeSelect = document.getElementById('salesType');
          if (salesTypeSelect) {
            salesTypeSelect.value = defaultSalesType;
            // 販売タイプに応じたUI更新
            if (typeof handleSalesTypeChange === 'function') {
              handleSalesTypeChange();
            }
            console.log('✅ デフォルト販売タイプを設定:', defaultSalesType);
          }
        }
      }
    }
  }

  // ========== 管理番号セグメント方式UI ==========

  /**
   * Firestoreから管理番号設定を読み込み（タイムアウト付き）
   * @returns {Promise<Object|null>} 管理番号設定オブジェクト、または null
   */
  async function loadManagementConfigFromFirestore() {
    if (!window.db) {
      console.warn('⚠️ Firestoreが初期化されていません');
      return null;
    }

    const startTime = performance.now();

    try {
      console.log('📥 Firestoreから管理番号設定を読み込み中...');

      // タイムアウト処理（3秒）
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Firestore読み込みタイムアウト（3秒）')), 3000)
      );

      const fetchPromise = (async () => {
        const docRef = firebase.firestore().collection('settings').doc('common');
        const docSnap = await docRef.get();
        return docSnap;
      })();

      // Firestore読み込みとタイムアウトを競争
      const docSnap = await Promise.race([fetchPromise, timeoutPromise]);
      const duration = (performance.now() - startTime).toFixed(2);

      if (docSnap.exists) {
        const data = docSnap.data();
        console.log(`✅ Firestoreから設定を取得: ${duration}ms`, data);

        // managementNumber フィールドを返す
        if (data.managementNumber) {
          // タイムスタンプ比較：localStorageの方が新しい場合は上書きしない
          const localTimestamp = parseInt(localStorage.getItem('managementConfigTimestamp') || '0');
          const firestoreTimestamp = data.updatedAt?.toMillis?.() || 0;

          console.log('🕐 タイムスタンプ比較:', {
            local: localTimestamp,
            localDate: localTimestamp ? new Date(localTimestamp).toISOString() : 'なし',
            firestore: firestoreTimestamp,
            firestoreDate: firestoreTimestamp ? new Date(firestoreTimestamp).toISOString() : 'なし'
          });

          if (localTimestamp > firestoreTimestamp) {
            console.log('⏭️ localStorageの方が新しいため、Firestoreデータでの上書きをスキップ');
            // localStorageの既存データを返す
            const existingConfig = localStorage.getItem('rebornConfig_managementNumber');
            if (existingConfig) {
              return JSON.parse(existingConfig);
            }
          }

          // Firestoreの方が新しい、または同等の場合はキャッシュを更新
          localStorage.setItem('rebornConfig_managementNumber', JSON.stringify(data.managementNumber));
          localStorage.setItem('managementConfigTimestamp', firestoreTimestamp.toString());
          console.log('💾 localStorageをFirestoreデータで更新しました');
          return data.managementNumber;
        } else {
          console.log('⚠️ managementNumber フィールドが存在しません');
          return null;
        }
      } else {
        console.log('⚠️ Firestore settings/common ドキュメントが存在しません');
        return null;
      }
    } catch (e) {
      const duration = (performance.now() - startTime).toFixed(2);
      if (e.message.includes('タイムアウト')) {
        console.warn(`⏱️ ${e.message} (${duration}ms経過) → キャッシュを使用`);
      } else {
        console.error('❌ Firestore読み込みエラー:', e);
      }
      return null;
    }
  }

  // グローバル変数：管理番号設定をキャッシュ
  window.managementNumberConfig = null;

  // 管理番号セグメントUIを初期化
  async function initManagementNumberUI() {
  
    let config = null;
    let segments = null;

    // 1. まずlocalStorageキャッシュから即座に読み込み（高速表示）
    const cachedConfigStr = localStorage.getItem('rebornConfig_managementNumber');
    console.log('📦 localStorage確認 (rebornConfig_managementNumber):', {
      cachedConfigStr: cachedConfigStr,
      type: typeof cachedConfigStr,
      isTruthy: !!cachedConfigStr,
      length: cachedConfigStr ? cachedConfigStr.length : 'N/A'
    });

    if (cachedConfigStr) {
      console.log('✅ localStorageから設定を即座に読み込みます');
      try {
        config = JSON.parse(cachedConfigStr);
        console.log('📦 管理番号設定をlocalStorageから読み込み:', config);
        segments = config.segments || null;
        console.log('📦 セグメント配列:', segments);

        // グローバル変数にも保存
        window.managementNumberConfig = config;

        // キャッシュがあれば即座にUI描画
        if (segments && segments.length > 0) {
          console.log('⚡ キャッシュからUIを即座に描画');
          renderManagementSegmentUI(segments);
        }
      } catch (e) {
        console.error('❌ localStorage パースに失敗:', e);
      }
    } else {
      console.log('⚠️ localStorageにキャッシュが存在しません');
    }

    // 2. バックグラウンドでFirestoreから最新設定を取得
    try {
      const latestConfig = await loadManagementConfigFromFirestore();
      if (latestConfig) {
        console.log('✅ Firestoreから最新設定を取得:', latestConfig);
        const latestSegments = latestConfig.segments || null;

        console.log('🔍 [デバッグ] segments比較:', {
          'config?.segments': config?.segments,
          'latestSegments': latestSegments,
          'cachedStr': JSON.stringify(config?.segments || []),
          'latestStr': JSON.stringify(latestSegments || [])
        });

        // 初回ロード時は必ずUIを生成
        if (!config || !config.segments) {
          console.log('⚡ 初回ロード検知 → 強制的にUI生成');
          if (latestSegments && latestSegments.length > 0) {
            renderManagementSegmentUI(latestSegments);
          }
          config = latestConfig;
          segments = latestSegments;
          // グローバル変数にも保存
          window.managementNumberConfig = latestConfig;
        } else {
          // 2回目以降は差分チェック
          const cachedStr = JSON.stringify(config.segments);
          const latestStr = JSON.stringify(latestSegments || []);

          if (cachedStr !== latestStr) {
            console.log('🔄 設定が変更されているため、UIを更新します');
            if (latestSegments && latestSegments.length > 0) {
              renderManagementSegmentUI(latestSegments);
            }
            config = latestConfig;
            segments = latestSegments;
            // グローバル変数にも保存
            window.managementNumberConfig = latestConfig;
          } else {
            console.log('✅ 設定に変更なし、UIそのまま');
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Firestore読み込み失敗（キャッシュを使用）:', e);
    }

    // 3. キャッシュもFirestoreもなければレガシーUIへ
    if (!segments || segments.length === 0) {
      console.log('⚠️ セグメント配列が空です');
    }

    // PWA版：管理番号設定はlocalStorageのみを使用
    if (!segments || segments.length === 0) {
      showManagementNumberNotConfigured();
    }
  }

  // セグメントUIを生成
  function renderManagementSegmentUI(segments) {
    const container = document.getElementById('managementNumberFields');
    if (!container) return;

    container.innerHTML = '';

    // ユーザー入力が必要なセグメントがあるかチェック
    let hasUserInput = false;

    segments.forEach((segment, index) => {
      const type = segment.type;
      const config = segment.config;

      // ユーザー入力が必要なセグメントのみUIを生成
      switch (type) {
        case 'shelf':
          // 棚番号選択（2段階選択: 頭文字 → 棚番号）
          const shelfDiv = document.createElement('div');
          shelfDiv.style.marginBottom = '8px';

          // 頭文字の選択肢を生成（A-Z）
          let shelfFirstCharOptions = '<option value="">--選択--</option>';
          for (let i = 65; i <= 90; i++) {
            const char = String.fromCharCode(i);
            shelfFirstCharOptions += `<option value="${char}">${char}</option>`;
          }

          shelfDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%;">
              <div style="min-width: 0;">
                <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
                  頭文字
                </label>
                <select id="mgmt_shelf_first" class="tight" style="width: 100%; min-width: 0; box-sizing: border-box;">
                  ${shelfFirstCharOptions}
                </select>
              </div>
              <div style="min-width: 0;">
                <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
                  棚番号
                </label>
                <select id="mgmt_shelf_second" class="tight" style="width: 100%; min-width: 0; box-sizing: border-box;" disabled>
                  <option value="">--選択--</option>
                </select>
              </div>
            </div>
          `;
          container.appendChild(shelfDiv);

          // DOM追加後に要素を取得（shelfDiv内から直接取得）
          const shelfFirstSelect = shelfDiv.querySelector('#mgmt_shelf_first');
          const shelfSecondSelect = shelfDiv.querySelector('#mgmt_shelf_second');

          console.log('[管理番号] 頭文字select要素:', shelfFirstSelect);
          console.log('[管理番号] 棚番号select要素:', shelfSecondSelect);

          // 2文字目のイベントリスナーを先に設定
          const updateShelfHandler = function() {
            updateManagementNumberPreview();
          };
          shelfSecondSelect.addEventListener('change', updateShelfHandler);

          // 頭文字選択時に2文字目を更新
          shelfFirstSelect.addEventListener('change', function() {
            const firstChar = this.value;
            console.log('[管理番号] 頭文字が変更されました:', firstChar);

            // イベントリスナーを一時的に削除
            shelfSecondSelect.removeEventListener('change', updateShelfHandler);

            if (!firstChar) {
              shelfSecondSelect.innerHTML = '<option value="">--選択--</option>';
              shelfSecondSelect.disabled = true;
              shelfSecondSelect.value = '';
              // 頭文字が空の場合は管理番号をクリア
              setManagementNumber('', '未選択');
              console.log('[管理番号] 棚番号をリセット（disabled）');
            } else {
              let secondOptions = '<option value="">--選択--</option>';
              for (let i = 65; i <= 90; i++) {
                const char = String.fromCharCode(i);
                secondOptions += `<option value="${char}">${firstChar}${char}</option>`;
              }
              shelfSecondSelect.innerHTML = secondOptions;
              shelfSecondSelect.value = '';  // 明示的に空欄に設定
              shelfSecondSelect.disabled = false;
              // 頭文字選択時はプレビュー更新しない（2文字目選択まで待つ）
              setManagementNumber('', '');
              console.log('[管理番号] 棚番号オプション生成完了:', secondOptions.substring(0, 100) + '...');
            }

            // イベントリスナーを再設定
            shelfSecondSelect.addEventListener('change', updateShelfHandler);
          });
          hasUserInput = true;
          break;

        case 'category':
          // カテゴリコード選択（Firestoreマスタから取得）
          const categoryDiv = document.createElement('div');
          categoryDiv.style.marginBottom = '8px';

          // カテゴリコードマスタから選択肢を生成
          let categoryOptions = '<option value="">--選択--</option>';
          if (window.categoryCodesCache && window.categoryCodesCache.length > 0) {
            window.categoryCodesCache.forEach(item => {
              categoryOptions += `<option value="${item.code}">${item.code} (${item.name})</option>`;
            });
          } else {
            // マスタが空の場合はメッセージ表示
            categoryOptions = '<option value="">-- マスタ管理で追加してください --</option>';
          }

          categoryDiv.innerHTML = `
            <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
              📁 カテゴリコード
            </label>
            <select id="mgmt_category" class="tight" style="width: 100%;">
              ${categoryOptions}
            </select>
          `;
          container.appendChild(categoryDiv);

          // プレビュー更新イベント
          document.getElementById('mgmt_category').addEventListener('change', updateManagementNumberPreview);
          hasUserInput = true;
          break;

        case 'rank':
          // 品質ランク選択
          const rankDiv = document.createElement('div');
          rankDiv.style.marginBottom = '8px';
          rankDiv.innerHTML = `
            <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
              ⭐ 品質ランク
            </label>
            <select id="mgmt_rank" class="tight" style="width: 100%;">
              <option value="">--選択--</option>
              <option value="S">S (最高品質)</option>
              <option value="A">A (新品・美品)</option>
              <option value="B">B (良好)</option>
              <option value="C">C (使用感あり)</option>
              <option value="D">D (難あり)</option>
              <option value="E">E (ジャンク)</option>
            </select>
          `;
          container.appendChild(rankDiv);

          // プレビュー更新イベント
          document.getElementById('mgmt_rank').addEventListener('change', updateManagementNumberPreview);
          hasUserInput = true;
          break;

        case 'size':
          // サイズコード選択
          const sizeDiv = document.createElement('div');
          sizeDiv.style.marginBottom = '8px';
          sizeDiv.innerHTML = `
            <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
              📏 サイズコード
            </label>
            <select id="mgmt_size" class="tight" style="width: 100%;">
              <option value="">--選択--</option>
              <option value="XS">XS</option>
              <option value="S">S</option>
              <option value="M">M</option>
              <option value="L">L</option>
              <option value="XL">XL</option>
              <option value="XXL">XXL</option>
            </select>
          `;
          container.appendChild(sizeDiv);

          // プレビュー更新イベント
          document.getElementById('mgmt_size').addEventListener('change', updateManagementNumberPreview);
          hasUserInput = true;
          break;

        case 'color':
          // 色コード選択
          const colorDiv = document.createElement('div');
          colorDiv.style.marginBottom = '8px';
          colorDiv.innerHTML = `
            <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
              🎨 色コード
            </label>
            <select id="mgmt_color" class="tight" style="width: 100%;">
              <option value="">--選択--</option>
              <option value="BK">BK (黒)</option>
              <option value="W">W (白)</option>
              <option value="R">R (赤)</option>
              <option value="BL">BL (青)</option>
              <option value="GR">GR (緑)</option>
              <option value="Y">Y (黄)</option>
              <option value="G">G (グレー)</option>
              <option value="BR">BR (茶)</option>
              <option value="BE">BE (ベージュ)</option>
              <option value="P">P (ピンク)</option>
              <option value="O">O (オレンジ)</option>
            </select>
          `;
          container.appendChild(colorDiv);

          // プレビュー更新イベント
          document.getElementById('mgmt_color').addEventListener('change', updateManagementNumberPreview);
          hasUserInput = true;
          break;

        case 'custom':
          // カスタム値（2段階選択: 頭文字 → 棚番号）
          const customDiv = document.createElement('div');
          customDiv.style.marginBottom = '8px';

          // 頭文字の選択肢を生成（A-Z）
          let firstCharOptions = '<option value="">--選択--</option>';
          for (let i = 65; i <= 90; i++) {
            const char = String.fromCharCode(i);
            firstCharOptions += `<option value="${char}">${char}</option>`;
          }

          customDiv.innerHTML = `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; width: 100%;">
              <div style="min-width: 0;">
                <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
                  頭文字
                </label>
                <select id="mgmt_custom_first" class="tight" style="width: 100%; min-width: 0; box-sizing: border-box;">
                  ${firstCharOptions}
                </select>
              </div>
              <div style="min-width: 0;">
                <label style="font-size: 12px; color: #6b7280; margin-bottom: 4px; display: block;">
                  棚番号
                </label>
                <select id="mgmt_custom_second" class="tight" style="width: 100%; min-width: 0; box-sizing: border-box;">
                  <option value="">--選択--</option>
                </select>
              </div>
            </div>
          `;
          container.appendChild(customDiv);

          // 2文字目のイベントリスナーを先に設定
          const secondSelect = document.getElementById('mgmt_custom_second');
          const updateSecondHandler = function() {
            updateManagementNumberPreview();
          };
          secondSelect.addEventListener('change', updateSecondHandler);

          // 頭文字選択時に2文字目を更新
          document.getElementById('mgmt_custom_first').addEventListener('change', function() {
            const firstChar = this.value;

            // イベントリスナーを一時的に削除
            secondSelect.removeEventListener('change', updateSecondHandler);

            if (!firstChar) {
              secondSelect.innerHTML = '<option value="">--選択--</option>';
              secondSelect.disabled = true;
              secondSelect.value = '';
              // 頭文字が空の場合は管理番号をクリア
              setManagementNumber('', '未選択');
            } else {
              let secondOptions = '<option value="">--選択--</option>';
              for (let i = 65; i <= 90; i++) {
                const char = String.fromCharCode(i);
                secondOptions += `<option value="${char}">${firstChar}${char}</option>`;
              }
              secondSelect.innerHTML = secondOptions;
              secondSelect.value = '';  // 明示的に空欄に設定
              secondSelect.disabled = false;
              // 頭文字選択時はプレビュー更新しない（2文字目選択まで待つ）
              setManagementNumber('', '');
            }

            // イベントリスナーを再設定
            secondSelect.addEventListener('change', updateSecondHandler);
          });
          hasUserInput = true;
          break;

        case 'date':
        case 'sequence':
          // これらは自動生成なのでUIは不要
          break;
      }
    });

    // ユーザー入力が不要な場合（連番のみなど）は自動で管理番号を生成
    if (!hasUserInput) {
      updateManagementNumberPreview();
    } else {
      // 初期状態では管理番号フィールドを空欄にする
      setManagementNumber('', '未選択');
    }

    // UI生成完了後、表示する
    container.style.display = 'block';
    const previewSection = document.getElementById('managementNumberPreview');
    if (previewSection) {
      previewSection.style.display = 'block';
    }
  }

  // 管理番号プレビューを更新
  function updateManagementNumberPreview() {
    // 棚番号は2段階選択から結合
    const shelfFirst = _val('mgmt_shelf_first');
    const shelfSecond = _val('mgmt_shelf_second');
    const shelfValue = (shelfFirst && shelfSecond) ? shelfFirst + shelfSecond : '';

    // カスタム値は2段階選択から結合
    const customFirst = _val('mgmt_custom_first');
    const customSecond = _val('mgmt_custom_second');
    const customValue = (customFirst && customSecond) ? customFirst + customSecond : '';

    // 棚番号フィールドが存在する場合、2文字目が未選択なら採番しない
    const shelfFirstField = document.getElementById('mgmt_shelf_first');
    if (shelfFirstField && shelfFirst && !shelfSecond) {
      setManagementNumber('', '');
      return;
    }

    // カスタム値フィールドが存在する場合、2文字目が未選択なら採番しない
    const customFirstField = document.getElementById('mgmt_custom_first');
    if (customFirstField && customFirst && !customSecond) {
      setManagementNumber('', '');
      return;
    }

    const userInputs = {
      shelf: shelfValue,
      category: _val('mgmt_category'),
      rank: _val('mgmt_rank'),
      size: _val('mgmt_size'),
      color: _val('mgmt_color'),
      custom: customValue
    };

    // 採番中を表示
    setManagementNumber('', '採番中...');

    // PWA版：Firestoreから採番
    generateSegmentBasedManagementNumberPWA(userInputs);
  }

  // PWA版：セグメント設定に基づいて管理番号を生成
  async function generateSegmentBasedManagementNumberPWA(userInputs) {
    try {
      if (!window.db) {
        throw new Error('Firestoreが初期化されていません');
      }

      console.log('📥 PWA版管理番号採番開始:', userInputs);

      let segments = null;

      // グローバル変数が存在すればそれを使用（Firestoreアクセスを回避）
      if (window.managementNumberConfig && window.managementNumberConfig.segments) {
        console.log('✅ グローバル変数から設定を取得（Firestoreアクセス不要）');
        segments = window.managementNumberConfig.segments;
      } else {
        // グローバル変数がない場合のみFirestoreから読み込み
        console.log('📥 グローバル変数なし → Firestoreから設定を読み込み');
        const docRef = window.db.collection('settings').doc('common');
        const docSnap = await docRef.get();

        if (!docSnap.exists) {
          throw new Error('管理番号設定が見つかりません');
        }

        const data = docSnap.data();
        segments = data.managementNumber?.segments || [];

        // グローバル変数にも保存（次回のため）
        window.managementNumberConfig = data.managementNumber || null;
      }

      if (segments.length === 0) {
        throw new Error('セグメント設定が空です');
      }

      console.log('📋 セグメント設定:', segments);

      // セグメントに基づいて管理番号を生成
      const parts = [];
      let counterKey = 'counter';

      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const config = segment.config || {};
        let value = '';

        switch (segment.type) {
          case 'shelf':
            // 棚番号：ユーザー入力から取得
            if (config.format === 'custom') {
              value = config.code || userInputs.shelf || '';
            } else {
              value = userInputs.shelf || '';
            }
            if (value) {
              counterKey += `_shelf_${value}`;
            }
            break;

          case 'category':
            // カテゴリ：ユーザー入力または固定値
            if (config.format === 'userInput') {
              value = userInputs.category || '';
            } else {
              value = config.code || '';
            }
            if (value) {
              counterKey += `_category_${value}`;
            }
            break;

          case 'date':
            // 登録日：現在日時をフォーマット
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');

            switch(config.format) {
              case 'YYYYMMDD':
                value = `${y}${m}${d}`;
                break;
              case 'YYMD':
                value = `${String(y).slice(2)}${parseInt(m)}${parseInt(d)}`;
                break;
              case 'YYMM':
                value = `${String(y).slice(2)}${m}`;
                break;
              default: // 'YYMMDD'
                value = `${String(y).slice(2)}${m}${d}`;
            }
            counterKey += `_date_${value}`;
            break;

          case 'rank':
            // 品質ランク：ユーザー入力または固定値
            if (config.format === 'userInput') {
              value = userInputs.rank || '';
            } else {
              value = config.value || '';
            }
            if (value) {
              counterKey += `_rank_${value}`;
            }
            break;

          case 'size':
            // サイズ：ユーザー入力または固定値
            if (config.format === 'userInput') {
              value = userInputs.size || '';
            } else {
              value = config.code || '';
            }
            if (value) {
              counterKey += `_size_${value}`;
            }
            break;

          case 'color':
            // 色：ユーザー入力または固定値
            if (config.format === 'userInput') {
              value = userInputs.color || '';
            } else {
              value = config.code || '';
            }
            if (value) {
              counterKey += `_color_${value}`;
            }
            break;

          case 'custom':
            // カスタム値：ユーザー入力または固定値
            if (config.format === 'userInput') {
              value = userInputs.custom || '';
            } else {
              value = config.value || '';
            }
            if (value) {
              counterKey += `_custom_${value}`;
            }
            break;

          case 'sequence':
            // 連番：カウンター方式で高速採番（O(1)）
            const digits = parseInt(config.digits) || 3;
            const startNum = parseInt(config.start) || 1;

            // プレフィックスを構築（連番セグメントより前の部分）
            const prefix = parts.join('');

            // カウンター方式で次の番号を取得（O(1)の高速アクセス）
            const nextNumber = await getNextSequenceNumber(prefix, startNum);

            value = String(nextNumber).padStart(digits, '0');
            break;

          default:
            console.warn('⚠️ 未知のセグメントタイプ:', segment.type);
            value = '';
        }

        if (value) {
          parts.push(value);
          // 次のセグメントがある場合は区切り文字を追加
          if (i < segments.length - 1 && segment.separator) {
            parts.push(segment.separator);
          }
        }
      }

      const managementNumber = parts.join('');
      console.log('✅ PWA版管理番号生成完了:', { segments, counterKey, managementNumber });

      setManagementNumber(managementNumber, '');
    } catch (error) {
      console.error('❌ PWA版採番エラー:', error);
      setManagementNumber('', 'エラー');
    }
  }

  // 管理番号の連番を調整（▲▼ボタン用）
  function adjustManagementNumber(delta) {
    const input = document.getElementById('管理番号');
    if (!input || !input.value) return;

    const currentValue = input.value;

    // 管理番号を分解（例：BB-1001 → prefix: 'BB-', number: 1001）
    const match = currentValue.match(/^(.*?)(\d+)$/);
    if (!match) return;

    const prefix = match[1]; // 例：'BB-'
    const currentNumber = parseInt(match[2], 10); // 例：1001
    const digits = match[2].length; // ゼロパディング用

    // 新しい番号を計算
    let newNumber = currentNumber + delta;
    
    // 最小値は1（0以下にはしない）
    newNumber = Math.max(1, newNumber);
    
    // ゼロパディングして適用
    const paddedNumber = String(newNumber).padStart(digits, '0');
    const newValue = prefix + paddedNumber;
    input.value = newValue;
    
    console.log(`管理番号を調整: ${currentValue} → ${newValue}`);
  }

  // 旧UI初期化（後方互換用）
  // 管理番号が未設定の場合のメッセージ表示
  function showManagementNumberNotConfigured() {
    const container = document.getElementById('managementNumberFields');
    if (!container) {
      console.log('❌ managementNumberFields が見つかりません');
      return;
    }

    container.innerHTML = `
      <div style="padding: 12px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center;">
        <div style="font-size: 13px; color: #64748b; margin-bottom: 8px;">
          📋 管理番号は設定されていません
        </div>
        <div style="font-size: 11px; color: #94a3b8;">
          設定画面の「🔢管理番号設定」から設定できます
        </div>
      </div>
    `;

    // UI生成完了後、コンテナを表示する
    container.style.display = 'block';
    console.log('✅ 管理番号未設定メッセージを表示しました');

    // プレビューセクションは非表示のまま
    const previewSection = document.getElementById('managementNumberPreview');
    if (previewSection) {
      previewSection.style.display = 'none';
    }
  }

  function initLegacyManagementUI() {
      const container = document.getElementById('managementNumberFields');
    if (!container) {
      console.log('❌ managementNumberFields が見つかりません');
      return;
    }

    container.innerHTML = `
      <div class="row3">
        <div>
          <span class="small">頭文字</span>
          <select id="prefix1" class="tight">
            <option value="">--選択してください--</option>
          </select>
        </div>
        <div>
          <span class="small">棚番号</span>
          <select id="棚番号" class="tight" disabled>
            <option value="">--選択してください--</option>
          </select>
        </div>
      </div>
    `;

    initPrefix1();

    // UI生成完了後、コンテナを表示する
    container.style.display = 'block';
    console.log('✅ managementNumberFields を表示しました');

    // プレビューセクションも表示する
    const previewSection = document.getElementById('managementNumberPreview');
    if (previewSection) {
      previewSection.style.display = 'block';
      console.log('✅ managementNumberPreview を表示しました');
    }

    // ★ イベントリスナーをUI生成後に設定
    const p1 = document.getElementById('prefix1');
    const shelf = document.getElementById('棚番号');

    if (p1) {
      p1.addEventListener('change', buildShelf);
      console.log('✅ [レガシーUI] prefix1 イベントリスナー設定完了');
    }

    if (shelf) {
      shelf.addEventListener('change', requestNextManagementNumber);
      console.log('✅ [レガシーUI] 棚番号 イベントリスナー設定完了');
    }
  }

  // ========== 旧システム（後方互換用） ==========

  // 頭文字プルダウンを初期化
  function initPrefix1() {
      const p1 = document.getElementById('prefix1');
    if (!p1) {
      console.log('❌ prefix1 要素が見つかりません');
      return;
    }
    console.log('✅ prefix1 要素を発見:', p1);
    p1.innerHTML = '<option value="">--選択してください--</option>';
    console.log('📝 デフォルトオプション設定完了');

    let optionsAdded = 0;
    for (let c=65;c<=90;c++) {
      const v=String.fromCharCode(c);
      p1.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`);
      optionsAdded++;
    }
    console.log(`✅ ${optionsAdded}個のオプションを追加しました`);
    console.log('📋 prefix1.options.length:', p1.options.length);
    console.log('📋 prefix1.innerHTML:', p1.innerHTML.substring(0, 200));
  }

  // 棚番号プルダウンを構築
  function buildShelf() {
      const p1 = document.getElementById('prefix1');
    const shelf = document.getElementById('棚番号');
    console.log('📋 フィールド確認:', { p1: !!p1, shelf: !!shelf, p1Value: p1?.value });

    if (!p1 || !shelf) {
      console.log('❌ prefix1 または 棚番号 フィールドが見つかりません');
      return;
    }

    const v1 = p1.value;
    shelf.innerHTML = '<option value="">--選択してください--</option>';

    if (!v1) {
      console.log('⚠️ prefix1 の値が空です');
      shelf.disabled = true;
      setManagementNumber('', '選択してください');
      return;
    }

    shelf.disabled = false;
    for (let c=65;c<=90;c++) {
      const v=v1+String.fromCharCode(c);
      shelf.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`);
    }
    shelf.value = '';
    setManagementNumber('', '選択してください');

    // HTMLを上書きしたのでイベントリスナーを再設定
    shelf.removeEventListener('change', requestNextManagementNumber);
    shelf.addEventListener('change', requestNextManagementNumber);
    console.log('✅ 棚番号イベントリスナーを再設定しました');
  }

  // 棚番号選択時に管理番号を取得
  async function requestNextManagementNumber() {
    console.log('🎯 requestNextManagementNumber() が呼ばれました');
    const shelfSel = document.getElementById('棚番号');
    if (!shelfSel) {
      console.log('❌ 棚番号フィールドが見つかりません');
      setManagementNumber('', '選択してください');
      return;
    }
    const shelf = shelfSel.value;
    console.log('📋 選択された棚番号:', shelf);
    if (!shelf) {
      console.log('⚠️ 棚番号が選択されていません');
      setManagementNumber('', '選択してください');
      return;
    }
    setManagementNumber('', '採番中…');

    // PWA版：セグメント設定に基づいて管理番号を生成
    try {
      if (!window.db) {
        throw new Error('Firestoreが初期化されていません');
      }

      // localStorage から segments 設定を読み込み
      const saved = localStorage.getItem('rebornConfig_managementNumber');
      let segments = [];

      if (saved) {
        const config = JSON.parse(saved);
        segments = config.segments || [];
        console.log('📋 管理番号セグメント設定:', segments);
      }

      // セグメントが未設定の場合、デフォルト（棚番号-4桁連番、1001開始）
      if (segments.length === 0) {
        segments = [
          { type: 'shelf', config: { format: 'AA' }, separator: '-' },
          { type: 'sequence', config: { digits: '4', start: '1001' }, separator: '' }
        ];
        console.log('⚠️ セグメント未設定、デフォルト使用（AA-1001形式）:', segments);
      }

      // 管理番号を生成
      const managementNumber = await generateManagementNumber(segments, shelf);
      setManagementNumber(managementNumber, '');
      console.log('✅ 管理番号採番成功:', managementNumber);
    } catch (error) {
      console.error('❌ 採番エラー:', error);
      setManagementNumber('', 'エラー');
      show(`NG(採番): ${error.message}`);
    }
  }

  /**
   * 既存商品から指定プレフィックスの最大連番を取得（移行時のみ使用）
   * @param {string} prefix - プレフィックス（例: 'AA-'）
   * @returns {Promise<number>} 最大連番（見つからない場合は0）
   */
  async function scanExistingProductsForMigration(prefix) {
    try {
      console.log('🔍 [移行] 既存商品から最大番号をスキャン:', prefix);

      // Firestoreから全商品を取得
      const productsRef = window.db.collection('products');
      const snapshot = await productsRef.get();

      let maxNumber = 0;
      let matchCount = 0;

      // プレフィックスに一致する管理番号から最大の連番を探す
      snapshot.forEach(doc => {
        const data = doc.data();
        const managementNumber = data.managementNumber || '';

        // プレフィックスで始まるかチェック
        if (managementNumber.startsWith(prefix)) {
          matchCount++;
          // プレフィックス以降の部分を取得
          const suffix = managementNumber.substring(prefix.length);

          // 連番部分を抽出（数字のみ、ハイフン等の区切り文字を除外）
          const match = suffix.match(/^(\d+)/);
          if (match) {
            const number = parseInt(match[1], 10);
            if (!isNaN(number) && number > maxNumber) {
              maxNumber = number;
            }
          }
        }
      });

      console.log(`✅ [移行] スキャン完了: ${matchCount}件の商品から最大番号 ${maxNumber} を検出`);
      return maxNumber;

    } catch (error) {
      console.error('❌ [移行] スキャンエラー:', error);
      return 0;
    }
  }

  /**
   * カウンター方式で指定プレフィックスの次の連番を取得（プレビュー表示用）
   * @param {string} prefix - プレフィックス（例: 'AA-', 'AA-251119-'）
   * @param {number} startNum - 開始番号（設定値）
   * @returns {Promise<number>} 次の連番（カウンターは更新しない）
   */
  async function getNextSequenceNumber(prefix, startNum) {
    try {
      console.log('🔍 カウンター方式で次の番号を取得（プレビュー用）:', { prefix, startNum });

      // プレフィックスをFirestore ドキュメントIDに使える形式に変換（ハイフン等を除去）
      const counterKey = prefix.replace(/[^a-zA-Z0-9]/g, '_');
      console.log('📋 カウンターキー:', counterKey);

      const counterRef = window.db.collection('managementNumberCounters').doc(counterKey);
      const counterDoc = await counterRef.get();

      let nextNumber;

      if (counterDoc.exists) {
        // カウンターが存在する場合
        const currentNumber = counterDoc.data().currentNumber || 0;
        console.log('✅ 既存カウンター値:', currentNumber);

        // 既存の最大値と設定の開始番号を比較
        nextNumber = Math.max(currentNumber, startNum - 1) + 1;
        console.log('🔢 次の番号（プレビュー）:', nextNumber);
      } else {
        // カウンターが存在しない場合（初回）→ 既存商品をスキャンして移行
        console.log('⚡ カウンター初回作成 → 既存商品をスキャン');

        const maxFromProducts = await scanExistingProductsForMigration(prefix);
        console.log('📊 既存商品の最大番号:', maxFromProducts);

        // 既存商品の最大値と設定の開始番号を比較
        nextNumber = Math.max(maxFromProducts, startNum - 1) + 1;
        console.log('🔢 移行後の次の番号（プレビュー）:', nextNumber);
      }

      // ★ カウンター更新はしない（商品登録時に更新）
      console.log(`📌 カウンター未更新（商品登録時に確定）: ${counterKey}`);
      return nextNumber;

    } catch (error) {
      console.error('❌ カウンター取得エラー:', error);
      // エラー時は開始番号を返す
      return startNum;
    }
  }

  /**
   * 商品登録時に管理番号を確定してカウンターを更新
   * @param {string} managementNumber - 管理番号（例: 'AA-1015'）
   * @returns {Promise<boolean>} 成功/失敗
   */
  async function confirmManagementNumber(managementNumber) {
    try {
      console.log('🔒 管理番号確定処理開始:', managementNumber);

      // 1. 重複チェック
      const productsRef = window.db.collection('products');
      const duplicateCheck = await productsRef
        .where('managementNumber', '==', managementNumber)
        .limit(1)
        .get();

      if (!duplicateCheck.empty) {
        console.error('❌ 管理番号が重複しています:', managementNumber);
        alert('❌ この管理番号はすでに使用されています。\n\n番号を変更してから再度保存してください。');
        return false;
      }

      // 2. プレフィックスと連番を抽出
      const match = managementNumber.match(/^(.+?)(\d+)$/);
      if (!match) {
        console.warn('⚠️ 管理番号の形式が不正:', managementNumber);
        return true; // 形式が不正でもスキップ（手動入力を許容）
      }

      const prefix = match[1];
      const number = parseInt(match[2], 10);

      // 3. カウンター更新
      const counterKey = prefix.replace(/[^a-zA-Z0-9]/g, '_');
      const counterRef = window.db.collection('managementNumberCounters').doc(counterKey);

      await counterRef.set({
        currentNumber: number,
        prefix: prefix,
        lastUpdated: new Date().toISOString()
      }, { merge: true });

      console.log(`✅ カウンター確定: ${counterKey} = ${number}`);
      return true;

    } catch (error) {
      console.error('❌ 管理番号確定エラー:', error);
      alert('❌ 管理番号の確定処理でエラーが発生しました。\n\n' + error.message);
      return false;
    }
  }

  // グローバル公開（商品登録処理から呼び出せるように）
  window.confirmManagementNumber = confirmManagementNumber;

  // セグメント設定に基づいて管理番号を生成
  async function generateManagementNumber(segments, selectedShelf) {
    const parts = [];
    let counterKey = 'counter';  // カウンターキーの構築

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const config = segment.config || {};
      let value = '';

      switch (segment.type) {
        case 'shelf':
          // 棚番号：商品登録画面で選択された値を使用
          if (config.format === 'custom') {
            value = config.code || selectedShelf;
          } else {
            value = selectedShelf;  // 実際に選択された棚番号
          }
          counterKey += `_shelf_${value}`;
          break;

        case 'category':
          // カテゴリコード：固定値
          value = config.code || 'K';
          counterKey += `_category_${value}`;
          break;

        case 'date':
          // 登録日：現在日時をフォーマット
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, '0');
          const d = String(now.getDate()).padStart(2, '0');

          switch(config.format) {
            case 'YYYYMMDD':
              value = `${y}${m}${d}`;
              break;
            case 'YYMD':
              value = `${String(y).slice(2)}${parseInt(m)}${parseInt(d)}`;
              break;
            case 'YYMM':
              value = `${String(y).slice(2)}${m}`;
              break;
            default: // 'YYMMDD'
              value = `${String(y).slice(2)}${m}${d}`;
          }
          counterKey += `_date_${value}`;
          break;

        case 'rank':
          // 品質ランク：固定値
          value = config.value || 'A';
          counterKey += `_rank_${value}`;
          break;

        case 'size':
          // サイズコード：固定値
          value = config.code || 'M';
          counterKey += `_size_${value}`;
          break;

        case 'color':
          // 色コード：固定値
          value = config.code || 'DB';
          counterKey += `_color_${value}`;
          break;

        case 'custom':
          // カスタム固定値
          value = config.value || 'XXX';
          counterKey += `_custom_${value}`;
          break;

        case 'sequence':
          // 連番：カウンター方式で高速採番（O(1)）
          const digits = parseInt(config.digits) || 3;
          const startNum = parseInt(config.start) || 1;

          // プレフィックスを構築（連番セグメントより前の部分）
          const prefix = parts.join('');
          console.log('🔍 採番プレフィックス:', prefix);

          // カウンター方式で次の番号を取得（O(1)の高速アクセス）
          const newNumber = await getNextSequenceNumber(prefix, startNum);
          console.log('📊 次の番号:', newNumber);

          value = String(newNumber).padStart(digits, '0');
          console.log('✅ 連番生成:', { counterKey, prefix, value, newNumber });
          break;

        case 'sequence_legacy_old':
          // レガシー：既存商品データとFirestoreカウンターを参照（削除予定）
          const digitsOld = parseInt(config.digits) || 3;
          const startNumOld = parseInt(config.start) || 1;

          const prefixOld = parts.join('');
          const counterRefOld = window.db.collection('counters').doc(counterKey);
          const newNumberOld = await window.db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRefOld);
            let currentCount = 0;
            if (counterDoc.exists) {
              currentCount = counterDoc.data().count || 0;
            }

            const candidateNumber = Math.max(
              currentCount || 0,
              startNumOld - 1
            ) + 1;

            transaction.set(counterRefOld, {
              count: candidateNumber,
              key: counterKey,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            return candidateNumber;
          });

          value = String(newNumberOld).padStart(digitsOld, '0');
          console.log('✅ 連番生成（レガシー）:', { counterKey, prefixOld, value, newNumberOld });
          break;

        default:
          console.warn('⚠️ 未知のセグメントタイプ:', segment.type);
          value = '';
      }

      if (value) {
        parts.push(value);
        // 次のセグメントがある場合は区切り文字を追加
        if (i < segments.length - 1 && segment.separator) {
          parts.push(segment.separator);
        }
      }
    }

    const managementNumber = parts.join('');
    console.log('📝 管理番号生成完了:', { segments, counterKey, managementNumber });
    return managementNumber;
  }

  // 管理番号フィールドに値を設定
  function setManagementNumber(val, ph) {
    const el=document.getElementById('管理番号');
    if (!el) return;
    el.value=val||'';
    el.placeholder=ph||'';

    // 管理番号が変更されたら商品名プレビューも更新
    if (typeof updateNamePreview === 'function') {
      updateNamePreview();
    }
  }

  let NAME_REST_FIELDS = ['商品属性1_値'];

  // DOM要素キャッシュ
  const elementCache = new Map();

  function _val(id) {
    if (!elementCache.has(id)) {
      elementCache.set(id, document.getElementById(id));
    }
    const el = elementCache.get(id);
    return (el && (el.value||'').toString().trim()) || '';
  }

  // キャッシュクリア機能（必要時のため）
  function clearElementCache() {
    elementCache.clear();
  }

  function _truncateByCodePoints(str, limit) {
    const a = Array.from(str);
    return (a.length > limit) ? a.slice(0, limit).join('') : str;
  }

  function adjustPreviewHeight() {
    const ta = document.getElementById('商品名プレビュー');
    if (!ta) return;
    ta.classList.remove('scroll');
    ta.style.height = 'auto';
    const sh = ta.scrollHeight;
    const max = 140;
    if (sh > max) {
      ta.style.height = max + 'px';
      ta.classList.add('scroll');
    } else {
      ta.style.height = sh + 'px';
    }
  }

  /**
   * セールスワードに形式を適用
   */
  function applySaleswordFormat(salesword) {
    if (!salesword) return '';

    // ワード別オーバーライドを確認
    let prefix = SALESWORD_FORMAT.globalPrefix;
    let suffix = SALESWORD_FORMAT.globalSuffix;

    if (SALESWORD_FORMAT.wordOverrides) {
      const override = SALESWORD_FORMAT.wordOverrides.find(o => o.word === salesword);
      if (override) {
        prefix = override.prefix;
        suffix = override.suffix;
      }
    }

    return prefix + salesword + suffix;
  }

  // ========== 商品名ブロック並び替え機能 ==========

  /**
   * 商品名ブロックのドラッグ&ドロップを初期化（Sortable.js使用）
   * タッチデバイス（スマホ）でも動作するようになりました
   */
  function initTitleBlockDragDrop() {
    const container = document.getElementById('titleBlockContainer');
    if (!container) return;

    // Sortable.jsを使用してドラッグ&ドロップを初期化
    // タッチイベントに自動対応
    Sortable.create(container, {
      animation: 150,                    // アニメーション速度（ミリ秒）
      handle: '.drag-handle',            // ⋮⋮ アイコンのみでドラッグ
      ghostClass: 'sortable-ghost',      // ドラッグ中の要素に適用されるクラス
      chosenClass: 'sortable-chosen',    // 選択中の要素に適用されるクラス
      dragClass: 'sortable-drag',        // ドラッグ中の要素に適用されるクラス
      delay: 300,                        // 300ms長押しでドラッグ開始（誤操作防止）
      delayOnTouchOnly: true,            // タッチデバイスのみ遅延適用
      touchStartThreshold: 10,           // 10px以上移動したらドラッグキャンセル（スクロール優先）
      onEnd: function() {
        // ドロップ後に並び順を保存
        saveTitleBlockOrder();
        updateNamePreview();
      }
    });
  }

  /**
   * 現在の商品名ブロックの並び順を保存
   */
  function saveTitleBlockOrder() {
    const container = document.getElementById('titleBlockContainer');
    if (!container) return;

    const blocks = container.querySelectorAll('.title-draggable-block');
    TITLE_BLOCK_ORDER = Array.from(blocks).map(block => block.dataset.blockId);
    console.log('商品名ブロックの並び順を更新:', TITLE_BLOCK_ORDER);

  }

  /**
   * 保存された並び順でブロックを再配置
   */
  function applyTitleBlockOrder() {
    const container = document.getElementById('titleBlockContainer');
    if (!container || !TITLE_BLOCK_ORDER || TITLE_BLOCK_ORDER.length === 0) return;

    TITLE_BLOCK_ORDER.forEach(blockId => {
      const block = container.querySelector(`[data-block-id="${blockId}"]`);
      if (block) {
        container.appendChild(block);
      }
    });
  }

  /**
   * 両端が閉じた括弧で括られているかチェック
   * @param {string} text - チェックするテキスト
   * @returns {boolean} 両端が閉じた括弧で括られている場合true
   */
  function isBracketEnclosed(text) {
    if (!text || typeof text !== 'string') return false;

    // 両端が閉じている括弧のペアをチェック
    const pairs = [
      { start: '【', end: '】' },
      { start: '『', end: '』' },
      { start: '「', end: '」' },
      { start: '（', end: '）' },
      { start: '｜', end: '｜' }  // 縦棒は両端同じ
    ];

    return pairs.some(pair => text.startsWith(pair.start) && text.endsWith(pair.end));
  }

  /**
   * 商品名パーツをスマートに結合
   * 両端が閉じた括弧（【】『』「」（）｜｜）で括られている場合は前後のスペースを削除
   * @param {Array<string>} parts - 結合するパーツ配列
   * @returns {string} 結合された文字列
   */
  function smartJoinParts(parts) {
    if (!parts || parts.length === 0) return '';
    if (parts.length === 1) return parts[0];

    let result = parts[0];
    for (let i = 1; i < parts.length; i++) {
      const prevPart = parts[i - 1];
      const currentPart = parts[i];

      // 前のパーツが両端閉じている、または現在のパーツが両端閉じている場合はスペースなし
      if (isBracketEnclosed(prevPart) || isBracketEnclosed(currentPart)) {
        result += currentPart;
      } else {
        result += ' ' + currentPart;
      }
    }

    return result;
  }

  /**
   * 商品名プレビューを更新
   * セールスワード、ブランド名、アイテム名、商品属性、管理番号を組み立てる
   * TITLE_BLOCK_ORDERの順序に従って表示
   * @throws {Error} 処理中にエラーが発生した場合
   */
  function updateNamePreview() {
    try {
      // 各ブロックの値を取得
      const kw = _val('セールスワード');
      const formattedKw = applySaleswordFormat(kw);

    // 商品名ブロック内のブランドを参照（どちらか片方でも可）
    const brandEn = _val('商品名_ブランド(英語)');
    const brandKana = _val('商品名_ブランド(カナ)');

    // チェックボックスの状態を確認
    const brandEnCheckbox = document.getElementById('商品名_ブランド(英語)_チェック');
    const brandKanaCheckbox = document.getElementById('商品名_ブランド(カナ)_チェック');
    const useBrandEn = brandEnCheckbox && brandEnCheckbox.checked && brandEn;
    const useBrandKana = brandKanaCheckbox && brandKanaCheckbox.checked && brandKana;

    // ブランド名の構築（カナの前に半角スペース）
    let brands = '';
    if (useBrandEn && useBrandKana) {
      brands = brandEn + ' ' + brandKana;
    } else if (useBrandEn) {
      brands = brandEn;
    } else if (useBrandKana) {
      brands = brandKana;
    }

    // 商品名ブロック内のアイテム名（編集可能）
    const itemNameInTitle = _val('商品名_アイテム名');
    const others = NAME_REST_FIELDS.map(_val).filter(Boolean);

    // 並び順に基づいて商品名を構築
    const parts = [];
    TITLE_BLOCK_ORDER.forEach(blockId => {
      if (blockId === 'salesword' && formattedKw) {
        parts.push(formattedKw);
      } else if (blockId === 'brand' && brands) {
        parts.push(brands);
      } else if (blockId === 'item' && itemNameInTitle) {
        // 商品名ブロック内のアイテム名を使用
        parts.push(itemNameInTitle);
      } else if (blockId === 'attribute') {
        // 商品属性のみを追加（アイテム名は含めない）
        if (others.length) parts.push(...others);
      }
    });

    let text = smartJoinParts(parts);

    // 管理番号を商品名に追加（localStorageの設定に基づく）
    try {
      const saved = localStorage.getItem('managementNumberPlacement');
      console.log('🔍 商品名生成: localStorage取得結果:', saved);

      if (saved) {
        const settings = JSON.parse(saved);
        console.log('📋 商品名生成: 管理番号配置設定:', settings);

        if (settings.inTitle) {
          const mgmtNumber = _val('管理番号');
          console.log('🔢 商品名生成: 管理番号フィールド値:', mgmtNumber);

          if (mgmtNumber) {
            const format = settings.format || '【】';
            let formattedMgmtNumber = '';

            switch (format) {
              case '【】':
                formattedMgmtNumber = `【${mgmtNumber}】`;
                break;
              case '（）':
              case '()':  // 旧形式との互換性
                formattedMgmtNumber = `（${mgmtNumber}）`;
                break;
              case '『』':
                formattedMgmtNumber = `『${mgmtNumber}』`;
                break;
              case '「」':
                formattedMgmtNumber = `「${mgmtNumber}」`;
                break;
              case '｜｜':
                formattedMgmtNumber = `｜${mgmtNumber}｜`;
                break;
              case '｜':
                formattedMgmtNumber = `｜${mgmtNumber}`;
                break;
              case '-':
                formattedMgmtNumber = `- ${mgmtNumber}`;
                break;
              case 'none':
                formattedMgmtNumber = mgmtNumber;
                break;
              default:
                formattedMgmtNumber = `【${mgmtNumber}】`;
            }

            console.log('✅ 商品名に管理番号を追加:', formattedMgmtNumber);

            // 配置位置に応じて管理番号を追加
            const position = settings.position || 'end';
            console.log('📍 管理番号配置位置:', position);

            if (text) {
              // 両端閉じている場合はスペースなし、それ以外はスペースあり
              const needsSpace = !isBracketEnclosed(formattedMgmtNumber);

              if (position === 'start') {
                // 先頭に配置
                text = needsSpace ? `${formattedMgmtNumber} ${text}` : `${formattedMgmtNumber}${text}`;
              } else {
                // 後ろに配置（デフォルト）
                text = needsSpace ? `${text} ${formattedMgmtNumber}` : `${text}${formattedMgmtNumber}`;
              }
            } else {
              text = formattedMgmtNumber;
            }
          } else {
            console.log('⚠️ 管理番号フィールドが空です');
          }
        } else {
          console.log('⏭️ 商品名への管理番号配置がOFFです');
        }
      } else {
        console.log('⚠️ localStorageに管理番号配置設定がありません');
      }
    } catch (e) {
      console.error('❌ 管理番号配置設定の読み込みエラー:', e);
    }

    const count = Array.from(text).length;
    const counterEl = document.getElementById('nameCounter');
    const nameCountEl = document.getElementById('nameCount');
    const nameMaxEl = document.getElementById('nameMax');
    if (nameCountEl) nameCountEl.textContent = count;
    if (nameMaxEl) nameMaxEl.textContent = NAME_LIMIT;
    if (counterEl) counterEl.classList.toggle('over', count > NAME_LIMIT);
    let saveText = text;
    if (NAME_LIMIT_MODE === 'truncate' && count > NAME_LIMIT) {
      saveText = _truncateByCodePoints(text, NAME_LIMIT);
    }
    const ta = document.getElementById('商品名プレビュー');
    if (ta) {
      ta.value = text;
      adjustPreviewHeight();
    }
      const hidden = document.getElementById('商品名(タイトル)');
      if (hidden) hidden.value = saveText;

      // 形式選択が変更された場合も設定を保存
      saveManagementNumberPlacementSettings();
    } catch (error) {
      console.error('商品名プレビュー更新エラー:', error);
      debug.error('updateNamePreview エラー:', error);
    }
  }

  // 管理番号配置設定を保存
  function saveManagementNumberPlacementSettings() {
    const titleCheckbox = document.getElementById('商品名に管理番号配置');
    const descCheckbox = document.getElementById('説明文に管理番号配置');
    const formatSelect = document.getElementById('管理番号形式');
    const positionSelect = document.getElementById('管理番号配置位置');
    const descFormatSelect = document.getElementById('説明文管理番号形式');
    const descPositionSelect = document.getElementById('説明文管理番号配置位置');

    // チェックボックスが存在しない場合は保存しない（設定画面専用の要素のため）
    if (!titleCheckbox && !descCheckbox && !formatSelect && !positionSelect && !descFormatSelect && !descPositionSelect) {
      console.log('⏭️ 管理番号配置チェックボックスが存在しないため、設定を保存しません');
      return;
    }

    const settings = {
      inTitle: titleCheckbox ? titleCheckbox.checked : false,
      inDesc: descCheckbox ? descCheckbox.checked : false,
      format: formatSelect ? formatSelect.value : '【】',
      position: positionSelect ? positionSelect.value : 'end',
      descFormat: descFormatSelect ? descFormatSelect.value : '【】',
      descPosition: descPositionSelect ? descPositionSelect.value : 'bottom'
    };

    try {
      localStorage.setItem('managementNumberPlacement', JSON.stringify(settings));
      console.log('💾 管理番号配置設定を保存:', settings);
    } catch (e) {
      console.warn('LocalStorage保存エラー:', e);
    }
  }

  /**
   * 管理番号設定変更時のハンドラー
   * 設定を保存してメインの商品名プレビューを更新
   */
  function onManagementNumberSettingChange() {
    // 設定を保存
    saveManagementNumberPlacementSettings();
    // メインプレビューを更新
    updateNamePreview();
  }

  // 管理番号フィールドの変更を監視して説明文を更新
  function setupManagementNumberObserver() {
    const mgmtNumberField = document.getElementById('管理番号');
    
    if (!mgmtNumberField) {
      console.log('⚠️ 管理番号フィールドが見つかりません');
      return;
    }

    console.log('👁️ 管理番号フィールドの監視を開始');

    // 値の変更を検出するためのMutationObserver
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
          const newValue = mgmtNumberField.value;
          console.log('🔔 管理番号フィールドの値が変更されました:', newValue);
          
          // 説明文を更新
          if (typeof updateDescriptionFromDetail === 'function') {
            console.log('📝 説明文を再生成します');
            updateDescriptionFromDetail();
          }
          
          // 商品名も更新
          if (typeof updateNamePreview === 'function') {
            updateNamePreview();
          }
        }
      });
    });

    // value属性の変更を監視
    observer.observe(mgmtNumberField, {
      attributes: true,
      attributeFilter: ['value']
    });

    // input/changeイベントでも監視（手動入力の場合）
    mgmtNumberField.addEventListener('input', () => {
      const newValue = mgmtNumberField.value;
      console.log('⌨️ 管理番号フィールドが入力されました:', newValue);
      
      if (typeof updateDescriptionFromDetail === 'function') {
        console.log('📝 説明文を再生成します（input）');
        updateDescriptionFromDetail();
      }
      
      if (typeof updateNamePreview === 'function') {
        updateNamePreview();
      }
    });

    // より確実に検出するため、定期的にチェック
    let lastValue = mgmtNumberField.value;
    setInterval(() => {
      const currentValue = mgmtNumberField.value;
      if (currentValue !== lastValue) {
        console.log('🔄 管理番号フィールドの値が変更されました（ポーリング）:', currentValue);
        lastValue = currentValue;
        
        if (typeof updateDescriptionFromDetail === 'function') {
          console.log('📝 説明文を再生成します（ポーリング）');
          updateDescriptionFromDetail();
        }
        
        if (typeof updateNamePreview === 'function') {
          updateNamePreview();
        }
      }
    }, 500); // 500msごとにチェック
  }

  // 管理番号配置設定の読み込み（PWA版: CACHED_CONFIG/localStorageから取得済み）
  function loadManagementNumberPlacementFromServer() {
    // no-op: PWA版ではCACHED_CONFIGから読み込み済み
  }

  // 管理番号配置設定を復元（localStorageからチェックボックスに反映）
  function restoreManagementNumberPlacementSettings() {
    try {
      const saved = localStorage.getItem('managementNumberPlacement');
      if (!saved) {
        console.log('⏭️ localStorageに管理番号配置設定がありません');
        return;
      }

      const settings = JSON.parse(saved);
      console.log('📋 localStorageから管理番号配置設定を復元:', settings);

      const titleCheckbox = document.getElementById('商品名に管理番号配置');
      const descCheckbox = document.getElementById('説明文に管理番号配置');
      const formatSelect = document.getElementById('管理番号形式');
      const positionSelect = document.getElementById('管理番号配置位置');
      const formatSelector = document.getElementById('管理番号形式選択');

      if (titleCheckbox) titleCheckbox.checked = settings.inTitle || false;
      if (descCheckbox) descCheckbox.checked = settings.inDesc || false;
      if (formatSelect) formatSelect.value = settings.format || '【】';
      if (positionSelect) positionSelect.value = settings.position || 'end';

      // 形式選択の表示/非表示を更新
      if (formatSelector && titleCheckbox) {
        formatSelector.style.display = titleCheckbox.checked ? 'block' : 'none';
      }
    } catch (e) {
      console.warn('LocalStorage読み込みエラー:', e);
    }
  }

  // 管理番号配置オプションの表示切り替え
  function toggleManagementNumberOptions() {
    const titleCheckbox = document.getElementById('商品名に管理番号配置');
    const descCheckbox = document.getElementById('説明文に管理番号配置');
    const formatSelector = document.getElementById('管理番号形式選択');

    // 商品名チェックボックスがONの時だけ形式選択を表示
    if (formatSelector) {
      if (titleCheckbox && titleCheckbox.checked) {
        formatSelector.style.display = 'block';
      } else {
        formatSelector.style.display = 'none';
      }
    }

    // 設定の保存は「保存」ボタン押下時に行う

    // 商品名プレビューを更新
    updateNamePreview();

    // 商品の説明プレビューを更新
    if (typeof updateDescriptionFromDetail === 'function') {
      updateDescriptionFromDetail();
    }
  }

  // アイテム名表示フィールドの更新（基本情報→商品名ブロックへ自動反映）
  function updateItemNameDisplay() {
    try {
      console.log('★★★ updateItemNameDisplay() が呼ばれました');
      const basicItemName = _val('アイテム名');
      const titleItemField = document.getElementById('商品名_アイテム名');

      if (titleItemField && basicItemName) {
        titleItemField.value = basicItemName;
        updateNamePreview();
      }

      // === 中分類に応じてサイズセクションを切り替え ===
      const chuBunrui = _val('中分類(カテゴリ)');
      console.log(`★★★ 中分類を取得しました: "${chuBunrui}"`);
      updateSizeSectionDisplay(chuBunrui);
    } catch (error) {
      console.error('updateItemNameDisplay エラー:', error);
      // エラーが起きても処理を続行
    }
  }

  // ブランド表示フィールドの更新（基本情報→商品名ブロックへ自動反映）
  let updateBrandDisplayTimeout = null;
  function updateBrandDisplay() {
    // デバウンス処理: 300ms待ってから実行
    clearTimeout(updateBrandDisplayTimeout);
    updateBrandDisplayTimeout = setTimeout(() => {
      const englishName = _val('ブランド(英語)');
      const englishField = document.getElementById('商品名_ブランド(英語)');
      const kanaField = document.getElementById('商品名_ブランド(カナ)');
      const basicKanaField = document.getElementById('ブランド(カナ)');

      if (!englishField || !kanaField) return;

      if (englishName) {
        // 完全一致するブランドのみセット（途中の文字列では反応しない）
        const pairIndex = BRAND_INDEX_MAP.get(englishName);

        if (pairIndex !== undefined && BRAND_PAIRS[pairIndex]) {
          const kanaName = BRAND_PAIRS[pairIndex].kana;

          englishField.value = englishName;
          kanaField.value = kanaName;

          // 基本情報ブロックの隠しフィールドにもカナ読みを設定
          if (basicKanaField) {
            basicKanaField.value = kanaName;
            console.log(`基本情報ブランド(カナ)に設定: "${kanaName}"`);
          }

          // 商品名プレビューを更新
          updateNamePreview();
        }
      } else {
        // 空の場合はクリア
        englishField.value = '';
        kanaField.value = '';
        englishField.placeholder = '入力すると候補が表示されます';
        kanaField.placeholder = '入力すると候補が表示されます';

        // 基本情報ブロックの隠しフィールドもクリア
        if (basicKanaField) {
          basicKanaField.value = '';
        }

        // 商品名プレビューを更新
        updateNamePreview();
      }
    }, 300);
  }

  function wirePreviewWatchers() {
    const ids = new Set(['セールスワード','ブランド(英語)','アイテム名','セールスワード(カテゴリ)',
  '商品名_ブランド(英語)', '商品名_ブランド(カナ)', ...NAME_REST_FIELDS]);
    ids.forEach(id=>{
      const el = document.getElementById(id);
      if (!el) return;
      const ev = (el.tagName === 'INPUT') ? 'input' : 'change';

      // 既存のイベントリスナーを削除してから追加
      el.removeEventListener(ev, updateNamePreview);
      el.addEventListener(ev, updateNamePreview);

      // 基本情報のブランド(英語)の場合はブランド表示と商品説明も更新
      if (id === 'ブランド(英語)') {
        el.removeEventListener(ev, updateBrandDisplay);
        el.addEventListener(ev, updateBrandDisplay);
        el.removeEventListener(ev, updateDescriptionFromDetail);
        el.addEventListener(ev, updateDescriptionFromDetail);
      }
    });
  }

  function adjustDescHeight() {
    // この関数は autoResizeTextarea() に置き換えられました
    const ta = document.getElementById('商品の説明');
    if (!ta) return;
    autoResizeTextarea(ta);
  }

  function updateDesc() {
    const ta = document.getElementById('商品の説明');
    if (!ta) return;
    const text = (ta.value || '').toString();
    const count = Array.from(text).length;
    const counterEl = document.getElementById('descCounter');
    const descCountEl = document.getElementById('descCount');
    const descMaxEl = document.getElementById('descMax');
    if (descCountEl) descCountEl.textContent = count;
    if (descMaxEl) descMaxEl.textContent = DESC_LIMIT;
    if (counterEl) counterEl.classList.toggle('over', count > DESC_LIMIT);
    if (DESC_LIMIT_MODE === 'truncate' && count > DESC_LIMIT) {
      ta.value = Array.from(text).slice(0, DESC_LIMIT).join('');
    }
    adjustDescHeight();
  }

  function wireDescWatcher() {
    const ta = document.getElementById('商品の説明');
    if (!ta) return;
    ta.addEventListener('input', updateDesc);
  }

  // ブランド情報取得関数
  function getBrandInfo() {
    const englishName = _val('ブランド(英語)');
    if (!englishName) return '';

    // Firestore版対応: ブランド(カナ)フィールドから直接取得
    const kanaName = _val('ブランド(カナ)') || '';
    return `ブランド名：${englishName}（${kanaName}）

`;
  }

  // サイズ情報取得関数
  function getSizeInfo() {
    // サイズ(表記)を取得（服または靴）
    const sizeHyoki = _val('サイズ(表記)_トップス') || _val('サイズ(表記)_ボトムス') || _val('サイズ(表記)_靴');

    // 靴の追加情報を取得
    const shoesOtherSize = _val('その他のサイズ表記_靴');
    const shoesUsualSize = _val('普段のサイズ_靴');
    const shoesFit = _val('フィット感_靴');

    // ラグラン判定
    const itemName = _val('アイテム名');
    const isRaglan = itemName && itemName.includes('ラグラン');
    const shoulderLabel = isRaglan ? '裄丈' : '肩幅';

    // サイズ(実寸)を取得
    const sizeValues = {
      肩幅: _val('肩幅'),
      身幅: _val('身幅'),
      袖丈: _val('袖丈'),
      着丈: _val('着丈'),
      ウエスト: _val('ウエスト'),
      ヒップ: _val('ヒップ'),
      股上: _val('股上'),
      股下: _val('股下')
    };

    // 靴または服のサイズ情報があるか確認
    const hasShoesSizeData = sizeHyoki && (_val('サイズ(表記)_靴') !== '');
    const hasClothesSizeData = sizeHyoki && (Object.values(sizeValues).some(value => value) || _val('サイズ(表記)_トップス') || _val('サイズ(表記)_ボトムス'));

    if (!sizeHyoki && !shoesOtherSize && !shoesUsualSize && !shoesFit) return '';

    let sizeText = '';

    // サイズ(表記)セクション
    if (sizeHyoki) {
      sizeText += `サイズ(表記)：${sizeHyoki}\n`;
    }

    // 靴の場合の追加情報
    if (hasShoesSizeData || shoesOtherSize || shoesUsualSize || shoesFit) {
      if (shoesOtherSize) {
        sizeText += `その他のサイズ表記：${shoesOtherSize}\n`;
      }
      if (shoesUsualSize) {
        sizeText += `普段のサイズ：${shoesUsualSize}\n`;
      }
      if (shoesFit) {
        sizeText += `フィット感：${shoesFit}\n`;
      }
      sizeText += '\n';
      return sizeText; // 靴の場合は実寸サイズを表示しない
    }

    // 服の場合のみ実寸サイズを表示
    if (sizeHyoki) {
      sizeText += '\n';
    }

    // サイズ(実寸)セクション
    const hasJissunData = Object.values(sizeValues).some(value => value);
    if (hasJissunData) {
      sizeText += '【サイズ(実寸)】\n';
      if (sizeValues.肩幅) sizeText += `${shoulderLabel}：${sizeValues.肩幅}cm\n`;
      if (sizeValues.身幅) sizeText += `身幅：${sizeValues.身幅}cm\n`;
      if (sizeValues.袖丈) sizeText += `袖丈：${sizeValues.袖丈}cm\n`;
      if (sizeValues.着丈) sizeText += `着丈：${sizeValues.着丈}cm\n`;
      if (sizeValues.ウエスト) sizeText += `ウエスト：${sizeValues.ウエスト}cm\n`;
      if (sizeValues.ヒップ) sizeText += `ヒップ：${sizeValues.ヒップ}cm\n`;
      if (sizeValues.股上) sizeText += `股上：${sizeValues.股上}cm\n`;
      if (sizeValues.股下) sizeText += `股下：${sizeValues.股下}cm\n`;
      sizeText += '\n';
    }

    return sizeText;
  }

  // 素材情報取得関数
  function getMaterialInfo() {
    let materialText = '';
    const items = document.querySelectorAll('.material-item');

    items.forEach((item, i) => {
      const index = i + 1;
      const location = _val(`素材${index}_箇所`);

      // 動的な行数に対応: 全ての種類・割合を取得
      const composition = item.querySelector('.material-composition');
      const materials = [];

      if (composition) {
        const rows = composition.querySelectorAll('.composition-row');
        rows.forEach((row, rowIdx) => {
          const rowIndex = rowIdx + 1;
          const type = _val(`素材${index}_種類${rowIndex}`);
          const percent = _val(`素材${index}_％${rowIndex}`);

          if (type) {
            let part = type;
            if (percent) part += ` ${percent}`;
            materials.push(part);
          }
        });
      }

      if (location && materials.length > 0) {
        materialText += `${location}: ${materials.join('、')}\n`;
      }
    });

    if (materialText) {
      materialText = '【素材】\n' + materialText + '\n';
    }

    return materialText;
  }

  function getColorInfo() {
    const items = document.querySelectorAll('.color-item');
    const colors = [];

    items.forEach((item, i) => {
      const index = i + 1;
      const colorValue = _val(`カラー${index}`);
      if (colorValue) {
        colors.push(colorValue);
      }
    });

    if (colors.length > 0) {
      return 'カラー(詳細)：' + colors.join('、') + '\n\n';
    }

    return '';
  }

  /**
   * 付属品情報を取得
   */
  function getAccessoriesInfo() {
    const container = document.getElementById('accessoriesCheckboxes');
    if (!container) return '';

    const checked = Array.from(container.querySelectorAll('input[type="checkbox"]:checked'))
      .map(cb => cb.value)
      .filter(v => v && v !== 'その他');

    // その他のフリーテキスト
    const otherText = document.getElementById('accessoryOtherText')?.value?.trim();
    if (otherText) {
      checked.push(otherText);
    }

    if (checked.length > 0) {
      return '【付属品】' + checked.join('、') + '\n\n';
    }

    return '';
  }

  /**
   * 配置順序に従って商品説明を組み立てる
   * @param {Object} elements - 各要素のテキスト（brand, color, size, material, condition, ai, management, discount, hashtag）
   * @param {HTMLTextAreaElement} descTextarea - 説明文を表示するテキストエリア
   */
  function buildDescriptionByOrder(elements, descTextarea) {
    console.log('buildDescriptionByOrder 関数が呼び出されました');

    // 1. AI生成設定から配置順序を取得（設定画面で管理可能）
    let order = [];
    try {
      const aiSettings = localStorage.getItem('rebornConfig_aiSettings');
      console.log('📋 [配置順序] rebornConfig_aiSettings:', aiSettings ? '存在' : 'なし');
      if (aiSettings) {
        const settings = JSON.parse(aiSettings);
        console.log('📋 [配置順序] descriptionOrder:', settings.descriptionOrder);
        if (settings.descriptionOrder && Array.isArray(settings.descriptionOrder)) {
          // 設定画面で保存された配置順序を使用（管理番号も含む）
          order = settings.descriptionOrder
            .map(item => ({
              id: item.id === 'ai' ? 'aiGeneration' : item.id,
              enabled: item.enabled !== false
            }));
          console.log('📋 [配置順序] 最終的な順序:', order.map(o => o.id).join(' → '));
        } else {
          console.log('📋 [配置順序] descriptionOrderが設定されていません');
        }
      }
    } catch (e) {
      console.error('配置順序の読み込みエラー:', e);
    }

    // 2. 配置順序が取得できない場合は、デフォルト順序を使用
    if (order.length === 0) {
      // デフォルト順序（管理番号・ランクを含む）
      order = [
        { id: 'brand', enabled: true },
        { id: 'color', enabled: true },
        { id: 'size', enabled: true },
        { id: 'material', enabled: true },
        { id: 'accessories', enabled: true },
        { id: 'condition', enabled: true },
        { id: 'rank', enabled: true },
        { id: 'aiGeneration', enabled: true },
        { id: 'management', enabled: true },
        { id: 'discount', enabled: true },
        { id: 'hashtag', enabled: true }
      ];
      console.log('📋 [配置順序] デフォルト順序を使用');
    }

    // 3. 配置順序に従って説明文を組み立て（管理番号も通常要素として処理）
    const parts = [];

    for (const item of order) {
      // 無効化されている要素はスキップ
      if (item.enabled === false) {
        console.log(`要素 ${item.id} は無効化されているためスキップ`);
        continue;
      }

      // 要素の内容を取得（management も elements から取得）
      const content = elements[item.id];
      if (content && content.trim()) {
        parts.push(content.trim());
        console.log(`要素 ${item.id} を追加`);
      } else {
        console.log(`要素 ${item.id} は空のためスキップ`);
      }
    }

    // 4. 全要素を結合（2行の空行で区切る）
    const finalText = parts.join('\n\n');
    descTextarea.value = finalText;

    console.log('商品説明を配置順序に従って生成しました:', finalText.length, '文字');

    // 6. UIを更新
    if (typeof updateDesc === 'function') {
      updateDesc();
    }
    autoResizeTextarea(descTextarea);
  }

  // ================= 画像アップロード機能 =================

  // アップロードされた画像を保存する配列
  let uploadedImages = [];

  /**
   * 画像アップロード処理
   * @param {Event} event - ファイル選択イベント
   */
  function handleImageUpload(event) {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    // 既存の画像数と新規画像数の合計が3を超える場合は警告
    if (uploadedImages.length + files.length > 3) {
      alert('AI生成用の画像は最大3枚までアップロードできます');
      return;
    }

    // 各ファイルをBase64に変換
    Array.from(files).forEach((file, index) => {
      // ファイルサイズチェック（10MB制限）
      if (file.size > 10 * 1024 * 1024) {
        alert(`${file.name}のサイズが大きすぎます（最大10MB）`);
        return;
      }

      // 画像ファイルかチェック
      if (!file.type.startsWith('image/')) {
        alert(`${file.name}は画像ファイルではありません`);
        return;
      }

      const reader = new FileReader();

      reader.onload = function(e) {
        const base64Data = e.target.result;

        uploadedImages.push({
          name: file.name,
          data: base64Data,
          mimeType: file.type
        });

        // プレビューを更新
        displayImagePreviews();

        debug.log(`画像をアップロードしました: ${file.name}`);
      };

      reader.onerror = function(error) {
        console.error('画像の読み込みに失敗しました:', error);
        alert(`${file.name}の読み込みに失敗しました`);
      };

      reader.readAsDataURL(file);
    });
  }

  /**
   * 画像プレビューを表示
   */
  function displayImagePreviews() {
    const container = document.getElementById('imagePreviewContainer');
    const list = document.getElementById('imagePreviewList');
    const aiImageCount = document.getElementById('aiImageCount');

    if (!container || !list) {
      console.error('プレビュー要素が見つかりません');
      return;
    }

    // 画像がない場合は非表示
    if (uploadedImages.length === 0) {
      container.style.display = 'none';
      if (aiImageCount) aiImageCount.textContent = '0';
      return;
    }

    // 画像がある場合は表示
    container.style.display = 'block';
    // AI生成用画像数を更新（最大3枚）
    const aiCount = Math.min(uploadedImages.length, 3);
    if (aiImageCount) aiImageCount.textContent = aiCount;

    // プレビューリストをクリア
    list.innerHTML = '';

    // 各画像のプレビューを作成
    uploadedImages.forEach((image, index) => {
      const previewItem = document.createElement('div');
      previewItem.style.cssText = 'position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 2px solid #e5e7eb;';

      previewItem.innerHTML = `
        <img src="${image.data}" alt="${image.name}" style="width: 100%; height: 100%; object-fit: cover;">
        <button
          type="button"
          onclick="removeImage(${index})"
          style="position: absolute; top: 4px; right: 4px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;"
          title="削除"
        >×</button>
      `;

      list.appendChild(previewItem);
    });
  }

  /**
   * 画像を削除
   * @param {number} index - 削除する画像のインデックス
   */
  function removeImage(index) {
    uploadedImages.splice(index, 1);
    displayImagePreviews();
    debug.log(`画像を削除しました (index: ${index})`);
  }

  /**
   * アップロードされた画像を取得
   * @returns {Array} Base64画像データの配列
   */
  function getUploadedImages() {
    return uploadedImages.map(img => ({
      data: img.data.split(',')[1], // Base64部分のみ（data:image/png;base64,を除く）
      mimeType: img.mimeType
    }));
  }

  /**
   * 画像を自動リサイズ（横幅800px、JPEG品質70%）
   * @param {string} base64Data - 元のBase64画像データ
   * @param {string} fileName - ファイル名
   * @returns {Promise<string>} リサイズ後のBase64データ
   */
  function resizeImage(base64Data, fileName) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = function() {
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        // 横幅が800pxより大きい場合のみリサイズ
        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }

        // Canvasでリサイズ
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // JPEG品質70%で再エンコード
        const resizedBase64 = canvas.toDataURL('image/jpeg', 0.7);

        debug.log(`画像リサイズ完了: ${fileName} (${img.width}x${img.height} → ${width}x${height})`);
        resolve(resizedBase64);
      };

      img.onerror = function() {
        console.error('画像の読み込みに失敗しました:', fileName);
        reject(new Error('画像の読み込みに失敗しました'));
      };

      img.src = base64Data;
    });
  }

  // ================= 商品画像ブロック（Google Drive保存用） =================

  // 商品画像を保存する配列（最大20枚）
  let productImages = [];

  /**
   * 商品画像ブロックを表示
   * v355: 画像管理設定を廃止し、常に表示に変更
   */
  function checkProductImageBlockVisibility() {
    const block = document.getElementById('productImagesBlock');

    if (block) {
      block.style.display = '';
      console.log('📷 商品画像ブロック: 常時表示');
    } else {
      console.error('❌ productImagesBlock要素が見つかりません');
    }
  }

  /**
   * 商品画像アップロード処理
   * @param {Event} event - ファイル選択イベント
   */
  async function handleProductImageUpload(event) {
    const files = event.target.files;

    if (!files || files.length === 0) {
      return;
    }

    // 既存の画像数と新規画像数の合計が20を超える場合は警告
    if (productImages.length + files.length > 20) {
      alert('商品画像は最大20枚までアップロードできます');
      return;
    }

    // 各ファイルを並列処理するPromise配列を作成
    const processPromises = Array.from(files).map((file) => {
      return new Promise(async (resolve, reject) => {
        // ファイルサイズチェック（10MB制限）
        if (file.size > 10 * 1024 * 1024) {
          alert(`${file.name}のサイズが大きすぎます（最大10MB）`);
          reject(new Error('File too large'));
          return;
        }

        // 画像ファイルかチェック
        if (!file.type.startsWith('image/')) {
          alert(`${file.name}は画像ファイルではありません`);
          reject(new Error('Not an image file'));
          return;
        }

        const reader = new FileReader();

        reader.onload = async function(e) {
          const base64Data = e.target.result;

          try {
            // 画像を自動リサイズ
            const resizedBase64 = await resizeImage(base64Data, file.name);

            resolve({
              name: file.name,
              data: resizedBase64,
              mimeType: 'image/jpeg' // リサイズ後はJPEGになる
            });

            debug.log(`商品画像をアップロードしました（リサイズ済み）: ${file.name}`);
          } catch (error) {
            console.error('画像のリサイズに失敗しました:', error);
            alert(`${file.name}の処理に失敗しました`);
            reject(error);
          }
        };

        reader.onerror = function(error) {
          console.error('画像の読み込みに失敗しました:', error);
          alert(`${file.name}の読み込みに失敗しました`);
          reject(error);
        };

        reader.readAsDataURL(file);
      });
    });

    try {
      // 全ての画像を並列処理
      const processedImages = await Promise.all(processPromises);

      // 成功した画像のみを追加
      productImages.push(...processedImages.filter(img => img != null));

      // プレビューを一度だけ更新
      displayProductImagesPreview();

      debug.log(`${processedImages.length}枚の画像を並列処理しました`);
    } catch (error) {
      console.error('画像処理中にエラーが発生しました:', error);
    }
  }

  /**
   * 商品画像プレビューを表示
   */
  function displayProductImagesPreview() {
    const container = document.getElementById('productImagesPreviewContainer');
    const list = document.getElementById('productImagesPreviewList');
    const count = document.getElementById('productImageCount');

    if (!container || !list || !count) {
      console.error('商品画像プレビュー要素が見つかりません');
      return;
    }

    // 画像がない場合は非表示（プレビューリストもクリア）
    if (productImages.length === 0) {
      container.style.display = 'none';
      list.innerHTML = '';  // ← 修正: プレビューリストをクリア
      count.textContent = '0';
      return;
    }

    // 画像がある場合は表示
    container.style.display = 'block';
    count.textContent = productImages.length;

    // プレビューリストをクリア
    list.innerHTML = '';

    // 各画像のプレビューを作成
    productImages.forEach((image, index) => {
      const previewItem = document.createElement('div');
      previewItem.style.cssText = 'position: relative; aspect-ratio: 1; border-radius: 8px; overflow: hidden; border: 2px solid #e5e7eb;';

      // 1枚目のみAI加工ボタンを表示
      let aiButtonHtml = '';
      if (index === 0) {
        const hasOriginal = !!image._originalData;
        if (hasOriginal) {
          // AI加工済み → 元に戻すボタン
          aiButtonHtml = `
            <button type="button" onclick="undoAiEdit()" style="position: absolute; bottom: 4px; left: 4px; right: 4px; background: rgba(107,101,96,0.9); color: white; border: none; border-radius: 4px; padding: 4px 0; font-size: 10px; cursor: pointer; font-weight: 500;">元に戻す</button>
          `;
        } else {
          // 未加工 → AI加工ボタン
          aiButtonHtml = `
            <button type="button" id="aiEditBtn" onclick="applyAiEdit()" style="position: absolute; bottom: 4px; left: 4px; right: 4px; background: rgba(74,127,181,0.9); color: white; border: none; border-radius: 4px; padding: 4px 0; font-size: 10px; cursor: pointer; font-weight: 500;">AI加工</button>
          `;
        }
      }

      previewItem.innerHTML = `
        <img src="${image.data}" alt="${image.name}" style="width: 100%; height: 100%; object-fit: cover;">
        <button
          type="button"
          onclick="removeProductImage(${index})"
          style="position: absolute; top: 4px; right: 4px; background: rgba(239, 68, 68, 0.9); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; font-size: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0;"
          title="削除"
        >×</button>
        ${aiButtonHtml}
      `;

      list.appendChild(previewItem);
    });
  }

  /**
   * 商品画像を削除
   * @param {number} index - 削除する画像のインデックス
   */
  function removeProductImage(index) {
    productImages.splice(index, 1);
    displayProductImagesPreview();
    debug.log(`商品画像を削除しました (index: ${index})`);
  }

  /**
   * すべての商品画像を削除
   */
  function clearAllProductImages() {
    if (productImages.length === 0) {
      return;
    }

    if (confirm(`${productImages.length}枚の画像をすべて削除しますか？`)) {
      productImages = [];
      displayProductImagesPreview();

      // ファイル入力もリセット
      const fileInput = document.getElementById('productImagesForSave');
      if (fileInput) {
        fileInput.value = '';
      }

      debug.log('すべての商品画像を削除しました');
    }
  }

  /**
   * 1枚目の画像にPhotoroom AI加工（背景除去+影+リライト）を適用
   */
  async function applyAiEdit() {
    if (productImages.length === 0) return;

    const btn = document.getElementById('aiEditBtn');
    if (btn) {
      btn.textContent = '処理中...';
      btn.disabled = true;
      btn.style.opacity = '0.6';
    }

    try {
      const image = productImages[0];
      const functionUrl = window._prdPhotoroomUrl ||
        'https://asia-northeast1-reborn-chat.cloudfunctions.net/photoroomEditImage';

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: image.data }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || 'AI加工に失敗しました');
      }

      const result = await response.json();
      if (result.success && result.imageBase64) {
        // 元画像を保持してから置き換え
        image._originalData = image.data;
        image.data = result.imageBase64;
        image.mimeType = 'image/jpeg';
        displayProductImagesPreview();
        debug.log('AI加工を適用しました（1枚目）');
      }
    } catch (error) {
      console.error('[AI Edit] Error:', error);
      alert('AI加工に失敗しました: ' + error.message);
      if (btn) {
        btn.textContent = 'AI加工';
        btn.disabled = false;
        btn.style.opacity = '1';
      }
    }
  }

  /**
   * 1枚目のAI加工を元に戻す
   */
  function undoAiEdit() {
    if (productImages.length === 0) return;
    const image = productImages[0];
    if (image._originalData) {
      image.data = image._originalData;
      delete image._originalData;
      displayProductImagesPreview();
      debug.log('AI加工を元に戻しました（1枚目）');
    }
  }

  /**
   * Firebase Storageに商品画像をアップロード
   * @param {string} managementNumber - 管理番号（フォルダ名として使用）
   * @param {Array} images - アップロードする画像の配列 [{data: base64, name: filename}]
   * @returns {Promise<{success: boolean, urls: string[], error?: string}>}
   */
  async function uploadImagesToFirebaseStorage(managementNumber, images, onProgress) {
    console.log('[Firebase Storage] 並列アップロード開始:', managementNumber, images.length + '枚');

    // Firebase Storageが初期化されているか確認
    if (!window.firebaseStorage || !window.storageRef || !window.storageUploadBytes || !window.storageGetDownloadURL) {
      console.error('[Firebase Storage] Firebase Storageが初期化されていません');
      return {
        success: false,
        urls: [],
        error: 'Firebase Storageが初期化されていません'
      };
    }

    const totalImages = images.length;
    let completedCount = 0;
    const errors = [];
    const timestamp = Date.now();

    // 初期進捗表示
    if (onProgress) {
      onProgress(20, `画像アップロード開始... (0/${totalImages}枚)`);
    }

    // 各画像のアップロードPromiseを作成（並列実行）
    const uploadPromises = images.map(async (image, index) => {
      try {
        console.log(`[Firebase Storage] 画像 ${index + 1}/${totalImages} アップロード開始: ${image.name}`);

        // Base64データからBlobを作成
        const base64Data = image.data.split(',')[1]; // data:image/jpeg;base64,xxx の xxx 部分
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: image.mimeType || 'image/jpeg' });

        // ファイル名を生成（タイムスタンプ + 連番）
        const fileName = `image_${String(index + 1).padStart(3, '0')}_${timestamp}.jpg`;

        // Firebase Storageにアップロード
        const storagePath = `products/${managementNumber}/${fileName}`;
        const imageRef = window.storageRef(window.firebaseStorage, storagePath);

        await window.storageUploadBytes(imageRef, blob);
        console.log(`[Firebase Storage] アップロード完了: ${storagePath}`);

        // 公開URLを取得
        const downloadURL = await window.storageGetDownloadURL(imageRef);
        console.log(`[Firebase Storage] URL取得: ${downloadURL}`);

        // 完了カウント更新＆進捗バー更新
        completedCount++;
        if (onProgress) {
          const progressPercent = 20 + Math.round((completedCount / totalImages) * 50); // 20% ～ 70%
          onProgress(progressPercent, `画像アップロード中... (${completedCount}/${totalImages}枚)`);
        }

        return { index, url: downloadURL, success: true };

      } catch (error) {
        console.error(`[Firebase Storage] 画像 ${index + 1} アップロードエラー:`, error);
        errors.push(`${image.name}: ${error.message}`);

        // エラーでも完了カウント更新
        completedCount++;
        if (onProgress) {
          const progressPercent = 20 + Math.round((completedCount / totalImages) * 50);
          onProgress(progressPercent, `画像アップロード中... (${completedCount}/${totalImages}枚)`);
        }

        return { index, url: null, success: false };
      }
    });

    // 全画像の並列アップロードを待機
    const results = await Promise.all(uploadPromises);

    // 結果を元の順序でソートしてURLを抽出
    const sortedResults = results.sort((a, b) => a.index - b.index);
    const uploadedUrls = sortedResults.filter(r => r.success).map(r => r.url);

    const result = {
      success: uploadedUrls.length > 0,
      urls: uploadedUrls,
      successCount: uploadedUrls.length,
      totalCount: images.length,
      error: errors.length > 0 ? errors.join(', ') : null
    };

    console.log('[Firebase Storage] 並列アップロード結果:', result);
    return result;
  }

  // グローバルに公開（PWA版で使用）
  window.uploadImagesToFirebaseStorage = uploadImagesToFirebaseStorage;

  // ============================================
  // Cloudflare R2 画像アップロード（リトライ機能付き）
  // ============================================

  const R2_WORKER_URL = 'https://reborn-r2-uploader.mercari-yasuhirotakuji.workers.dev';
  const R2_MAX_RETRIES = 3;
  const R2_RETRY_DELAY_MS = 1000;

  /**
   * 単一ファイルをR2にアップロード（リトライ付き）
   * @param {Blob} blob - アップロードするファイル
   * @param {string} fileName - ファイル名
   * @param {number} retries - リトライ回数
   * @returns {Promise<{success: boolean, url?: string, error?: string}>}
   */
  async function uploadSingleFileToR2(blob, fileName, retries = R2_MAX_RETRIES) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        console.log(`[R2] アップロード試行 ${attempt}/${retries}: ${fileName}`);

        const formData = new FormData();
        formData.append('file', blob, fileName);

        const response = await fetch(`${R2_WORKER_URL}/upload`, {
          method: 'POST',
          body: formData
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();

        if (!result.success) {
          throw new Error(result.error || 'アップロード失敗');
        }

        console.log(`[R2] ✅ アップロード成功: ${result.url}`);
        return { success: true, url: result.url, fileName: result.fileName };

      } catch (error) {
        console.warn(`[R2] ⚠️ 試行 ${attempt} 失敗:`, error.message);

        if (attempt < retries) {
          // リトライ前に待機（コールドスタート対策）
          console.log(`[R2] ${R2_RETRY_DELAY_MS}ms 待機後にリトライ...`);
          await new Promise(resolve => setTimeout(resolve, R2_RETRY_DELAY_MS));
        } else {
          console.error(`[R2] ❌ 最大リトライ回数到達: ${fileName}`);
          return { success: false, error: error.message };
        }
      }
    }
    return { success: false, error: '予期しないエラー' };
  }

  /**
   * Cloudflare R2に商品画像をアップロード（リトライ機能付き）
   * Firebase Storage版と同じインターフェース
   * @param {string} managementNumber - 管理番号（フォルダ名として使用）
   * @param {Array} images - アップロードする画像の配列 [{data: base64, name: filename}]
   * @param {Function} onProgress - 進捗コールバック
   * @returns {Promise<{success: boolean, urls: string[], error?: string}>}
   */
  async function uploadImagesToR2(managementNumber, images, onProgress) {
    console.log('[R2] 並列アップロード開始:', managementNumber, images.length + '枚');
    console.log('[R2] ⚡ リトライ機能有効: 最大', R2_MAX_RETRIES, '回');

    const totalImages = images.length;
    let completedCount = 0;
    const errors = [];
    const timestamp = Date.now();

    // 初期進捗表示
    if (onProgress) {
      onProgress(20, `R2画像アップロード開始... (0/${totalImages}枚)`);
    }

    // 各画像のアップロードPromiseを作成（並列実行）
    const uploadPromises = images.map(async (image, index) => {
      try {
        console.log(`[R2] 画像 ${index + 1}/${totalImages} 準備: ${image.name}`);

        // Base64データからBlobを作成
        const base64Data = image.data.split(',')[1];
        const byteCharacters = atob(base64Data);
        const byteNumbers = new Array(byteCharacters.length);
        for (let j = 0; j < byteCharacters.length; j++) {
          byteNumbers[j] = byteCharacters.charCodeAt(j);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: image.mimeType || 'image/jpeg' });

        // ファイル名を生成
        const fileName = `${managementNumber}_${String(index + 1).padStart(3, '0')}_${timestamp}.jpg`;

        // リトライ付きでアップロード
        const result = await uploadSingleFileToR2(blob, fileName);

        // 完了カウント更新＆進捗バー更新
        completedCount++;
        if (onProgress) {
          const progressPercent = 20 + Math.round((completedCount / totalImages) * 50);
          onProgress(progressPercent, `R2画像アップロード中... (${completedCount}/${totalImages}枚)`);
        }

        if (result.success) {
          return { index, url: result.url, success: true };
        } else {
          errors.push(`${image.name}: ${result.error}`);
          return { index, url: null, success: false };
        }

      } catch (error) {
        console.error(`[R2] 画像 ${index + 1} エラー:`, error);
        errors.push(`${image.name}: ${error.message}`);
        completedCount++;
        if (onProgress) {
          const progressPercent = 20 + Math.round((completedCount / totalImages) * 50);
          onProgress(progressPercent, `R2画像アップロード中... (${completedCount}/${totalImages}枚)`);
        }
        return { index, url: null, success: false };
      }
    });

    // 全画像の並列アップロードを待機
    const results = await Promise.all(uploadPromises);

    // 結果を元の順序でソートしてURLを抽出
    const sortedResults = results.sort((a, b) => a.index - b.index);
    const uploadedUrls = sortedResults.filter(r => r.success).map(r => r.url);

    const result = {
      success: uploadedUrls.length > 0,
      urls: uploadedUrls,
      successCount: uploadedUrls.length,
      totalCount: images.length,
      error: errors.length > 0 ? errors.join(', ') : null
    };

    console.log('[R2] 並列アップロード結果:', result);
    return result;
  }

  // グローバルに公開（PWA版で使用）
  window.uploadImagesToR2 = uploadImagesToR2;

  // ページ読み込み時に設定を確認
  document.addEventListener('DOMContentLoaded', function() {
    checkProductImageBlockVisibility();
  });

  // ================= AI生成機能 =================

  /**
   * AI生成ボタンクリック時の処理
   * 商品情報を収集してGemini APIで説明文を生成
   */
  function generateAiDescription() {
    try {
      debug.log('AI説明文生成を開始します');

      // ボタンの状態を変更（ローディング表示）
      const aiGenBtn = document.getElementById('aiGenBtn');
      if (!aiGenBtn) {
        console.error('AI生成ボタンが見つかりません');
        return;
      }

      // 元のテキストを保存
      const originalText = aiGenBtn.innerHTML;

      // ローディング状態に変更（アニメーション付き）
      aiGenBtn.disabled = true;
      aiGenBtn.innerHTML = '<span class="hourglass">⏳</span> 生成中<span class="loading-dots"></span>';
      aiGenBtn.classList.add('ai-btn-loading', 'ai-btn-loading-pulse');
      aiGenBtn.style.cursor = 'wait';

      // 商品情報を収集
      const productInfo = collectProductInfo();

      // 画像データを取得
      const images = getUploadedImages();

      debug.log('収集した商品情報:', productInfo);
      debug.log('アップロードされた画像数:', images.length);

      // バリデーション
      if (!productInfo.brandName || !productInfo.itemName) {
        alert('❌ ブランド名とアイテム名を入力してください。');
        resetAiButton(aiGenBtn, originalText);
        return;
      }

      // 画像がない場合は確認メッセージを表示
      if (images.length === 0) {
        const proceed = confirm('⚠️ AI生成用の画像がアップロードされていません。\n\n画像なしでも生成できますが、画像があるとより正確な説明文が生成されます。\n\nこのまま画像なしで生成しますか？');
        if (!proceed) {
          resetAiButton(aiGenBtn, originalText);
          return;
        }
      }

      // PWA版: Cloudflare Worker経由でGemini APIを呼び出す
      {
        const WORKER_URL = 'https://reborn-help-chatbot.mercari-yasuhirotakuji.workers.dev/generate-description';

        fetch(WORKER_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            productInfo: productInfo,
            images: images,
            aiConfig: window.CACHED_CONFIG['AI生成設定'] || {}
          })
        })
        .then(response => response.json())
        .then(result => {
          if (result.success) {
            debug.log('AI生成成功:', result.generatedText);

            // AI生成文をグローバル変数に保存
            window.AI_GENERATED_TEXT = result.generatedText;

            // プレビューを更新
            updateDescriptionFromDetail();

            // 成功メッセージ
            alert(`✅ AI説明文を生成しました！

商品の説明プレビューを確認して、必要に応じて直接編集してください。

⚠️ 注意事項
• 品番から取得した情報は、Google検索結果の品質に依存します
• 画像から取得した情報は、AIの判断に基づいています
• 必ず内容をご確認の上、誤りがあれば修正してください`);

            // ボタンを元に戻す
            resetAiButton(aiGenBtn, originalText);
          } else {
            throw new Error(result.error || 'Unknown error');
          }
        })
        .catch(error => {
          console.error('AI生成エラー:', error);
          alert('❌ AI説明文の生成に失敗しました。\n\nエラー詳細: ' + error.message);
          resetAiButton(aiGenBtn, originalText);
        });

      }

    } catch (error) {
      console.error('AI生成処理エラー:', error);
      alert('❌ エラーが発生しました: ' + error.message);

      // ボタンを元に戻す
      const aiGenBtn = document.getElementById('aiGenBtn');
      if (aiGenBtn) {
        resetAiButton(aiGenBtn, '✨ AI生成');
      }
    }
  }

  /**
   * 商品情報を収集（AI生成用）
   * @returns {Object} 商品情報オブジェクト
   */
  function collectProductInfo() {
    const productInfo = {};

    // ブランド名（基本情報ブロックから優先取得）
    productInfo.brandName = _val('ブランド(英語)') || _val('商品名_ブランド(英語)') || '';
    productInfo.brandKana = _val('ブランド(カナ)') || _val('商品名_ブランド(カナ)') || '';

    // アイテム名（基本情報ブロックから優先取得、なければ商品名ブロック）
    productInfo.itemName = _val('アイテム名') || _val('商品名_アイテム名') || '';

    // カテゴリ（階層情報を統合）
    const categories = [];
    const daiCategory = _val('大分類(カテゴリ)');
    const chuCategory = _val('中分類(カテゴリ)');
    const shoCategory = _val('小分類(カテゴリ)');
    if (daiCategory) categories.push(daiCategory);
    if (chuCategory) categories.push(chuCategory);
    if (shoCategory) categories.push(shoCategory);
    productInfo.category = categories.join(' > ');

    // サイズ
    productInfo.size = _val('サイズ(表記)_トップス') || _val('サイズ(表記)_ボトムス') || _val('サイズ') || '';

    // 商品の状態
    productInfo.condition = _val('商品の状態') || '';

    // 素材情報を収集（動的行数対応）
    // 動的追加された要素はキャッシュに入っていない可能性があるので直接取得
    const materials = [];
    const materialItems = document.querySelectorAll('.material-item');
    materialItems.forEach((item, idx) => {
      const materialIndex = idx + 1;
      const locationEl = document.getElementById(`素材${materialIndex}_箇所`);
      const location = locationEl ? (locationEl.value || '').trim() : '';

      // 動的な行数に対応
      const composition = item.querySelector('.material-composition');
      const parts = [];
      if (composition) {
        const rows = composition.querySelectorAll('.composition-row');
        rows.forEach((row, rowIdx) => {
          const rowIndex = rowIdx + 1;
          const typeEl = document.getElementById(`素材${materialIndex}_種類${rowIndex}`);
          const percentEl = document.getElementById(`素材${materialIndex}_％${rowIndex}`);
          const type = typeEl ? (typeEl.value || '').trim() : '';
          const percent = percentEl ? (percentEl.value || '').trim() : '';
          if (type) {
            let part = type;
            if (percent) part += ` ${percent}`;
            parts.push(part);
          }
        });
      }

      if (location || parts.length > 0) {
        let materialStr = '';
        if (location) materialStr += location + ': ';
        materialStr += parts.join('、');
        materials.push(materialStr);
      }
    });
    productInfo.material = materials.join(', ');

    // カラー情報を収集（selectドロップダウンから）
    // 動的追加された要素はキャッシュに入っていない可能性があるので直接取得
    const colors = [];
    for (let i = 1; i <= 10; i++) {
      const colorEl = document.getElementById(`カラー${i}`);
      const colorValue = colorEl ? (colorEl.value || '').trim() : '';
      if (colorValue) {
        colors.push(colorValue);
        debug.log(`カラー${i}: ${colorValue}`);
      }
    }
    productInfo.color = colors.join(', ');
    debug.log(`収集したカラー情報: "${productInfo.color}"`);

    // 商品属性を収集（商品名ブロックから）
    // フィールドIDは「商品属性N_値」の形式
    // 動的追加された要素はキャッシュに入っていない可能性があるので直接取得
    const attributes = [];
    for (let i = 1; i <= 10; i++) {
      const attrElement = document.getElementById(`商品属性${i}_値`);
      const attrValue = attrElement ? (attrElement.value || '').trim() : '';
      if (attrValue) {
        attributes.push(attrValue);
        debug.log(`商品属性${i}_値: ${attrValue}`);
      }
    }

    // AI生成用 追加属性を収集（商品の説明ブロックから）
    // キャッシュを使わず直接取得（最新の値を確実に取得するため）
    const aiAttributesElement = document.getElementById('AI用商品属性');
    const aiAttributesText = aiAttributesElement ? aiAttributesElement.value.trim() : '';

    debug.log(`AI用商品属性の値: "${aiAttributesText}"`);

    if (aiAttributesText) {
      // カンマ区切りで分割して追加
      const aiAttributes = aiAttributesText.split(',').map(attr => attr.trim()).filter(attr => attr);
      attributes.push(...aiAttributes);
      debug.log(`AI用商品属性を追加しました: ${aiAttributes.join(', ')}`);
    }

    productInfo.attributes = attributes.join(', ');
    debug.log(`最終的なattributes: "${productInfo.attributes}"`);

    // 品番・型番を収集（Google Search Grounding用）
    productInfo.modelNumber = _val('品番型番') || '';

    // 付属品を収集
    const accessories = [];
    const accessoriesContainer = document.getElementById('accessoriesCheckboxes');
    if (accessoriesContainer) {
      const checkedBoxes = accessoriesContainer.querySelectorAll('input[type="checkbox"]:checked');
      checkedBoxes.forEach(cb => {
        const accName = cb.value;
        if (accName === 'その他') {
          // その他の場合はフリーテキストを取得
          const otherText = document.getElementById('accessoryOtherText')?.value?.trim();
          if (otherText) {
            accessories.push(otherText);
          }
        } else {
          accessories.push(accName);
        }
      });
    }
    productInfo.accessories = accessories.join('、');
    debug.log(`収集した付属品: "${productInfo.accessories}"`);

    return productInfo;
  }

  /**
   * AI生成ボタンを元の状態に戻す
   * @param {HTMLElement} button - ボタン要素
   * @param {string} originalText - 元のテキスト
   */
  function resetAiButton(button, originalText) {
    if (!button) return;

    button.disabled = false;
    button.innerHTML = originalText;
    button.classList.remove('ai-btn-loading', 'ai-btn-loading-pulse');
    button.style.opacity = '1';
    button.style.cursor = 'pointer';
  }

  // ================= 商品の説明プレビュー =================

  /**
   * 商品の説明プレビューを更新
   * ブランド、カラー、サイズ、素材、商品状態、管理番号、割引情報、ハッシュタグを組み立てる
   * @throws {Error} 要素が見つからない場合や処理中にエラーが発生した場合
   */
  function updateDescriptionFromDetail() {
    try {
        console.log('updateDescriptionFromDetail 関数が呼び出されました');
        const detailInput = document.getElementById('商品状態詳細');
        const descTextarea = document.getElementById('商品の説明');
        if (!detailInput || !descTextarea) {
          console.error('要素が見つかりません', { detailInput, descTextarea });
          return;
        }

        // ハッシュタグチェックボックスのプレビューを更新
        updateHashtagCheckboxPreviews();

        // ブランド情報を取得
        const brandText = getBrandInfo();

        // カラー情報を取得
        const colorText = getColorInfo();

        // サイズ情報を取得
        const sizeText = getSizeInfo();

          // 素材情報を収集
          const materialText = getMaterialInfo();

          // 商品の状態を取得（基本情報ブロックから）
          const conditionSelect = document.getElementById('商品の状態');
          const conditionValue = conditionSelect ? (conditionSelect.value || '').trim() : '';
          let conditionSection = '';
          if (conditionValue) {
            // 商品の状態のみ（ランクは商品状態詳細セクションに移動）
            conditionSection = `商品の状態：${conditionValue}\n\n`;
          }

          // 商品状態詳細を取得（ランクを含む）
          const detailText = (detailInput.value || '').trim();
          let detailSection = '';
          if (detailText) {
            const rank = window.currentConditionRank;
            if (rank) {
              detailSection = `商品状態(詳細)：\n状態ランク${rank.code}\n${detailText}\n\n`;
            } else {
              detailSection = `商品状態(詳細)：\n${detailText}\n\n`;
            }
          }

          // AI生成文を取得
          let aiGenerationSection = '';
          if (window.AI_GENERATED_TEXT) {
            aiGenerationSection = `${window.AI_GENERATED_TEXT}\n\n`;
          }

        // ハッシュタグ生成
          const hashtags = generateHashtags();
          const hashtagText = hashtags.join('\n');

          // 管理番号セクション（localStorageの設定に基づく）
          // ※配置位置は「配置順序」タブで設定（descPositionは使用しない）
          let managementNumberSection = '';
          try {
            const saved = localStorage.getItem('managementNumberPlacement');
            console.log('🔍 説明文生成: localStorage取得結果:', saved);

            if (saved) {
              const settings = JSON.parse(saved);
              console.log('📋 説明文生成: 管理番号配置設定:', settings);

              if (settings.inDesc) {
                const mgmtNumber = _val('管理番号');
                console.log('🔢 説明文生成: 管理番号フィールド値:', mgmtNumber);

                if (mgmtNumber) {
                  // 形式を適用（絵文字なし）
                  const descFormat = settings.descFormat || '【】';
                  let formattedNumber = '';

                  switch (descFormat) {
                    case '【】':
                      formattedNumber = `管理番号：【${mgmtNumber}】`;
                      break;
                    case '（）':
                      formattedNumber = `管理番号：（${mgmtNumber}）`;
                      break;
                    case '『』':
                      formattedNumber = `管理番号：『${mgmtNumber}』`;
                      break;
                    case '「」':
                      formattedNumber = `管理番号：「${mgmtNumber}」`;
                      break;
                    case '｜｜':
                      formattedNumber = `管理番号：｜${mgmtNumber}｜`;
                      break;
                    case '｜':
                      formattedNumber = `管理番号：｜${mgmtNumber}`;
                      break;
                    case '-':
                      formattedNumber = `管理番号：- ${mgmtNumber}`;
                      break;
                    case 'none':
                      formattedNumber = `管理番号：${mgmtNumber}`;
                      break;
                    default:
                      formattedNumber = `管理番号：【${mgmtNumber}】`;
                  }

                  managementNumberSection = `${formattedNumber}\n\n`;
                  console.log('✅ 説明文に管理番号を追加:', formattedNumber, '（配置位置は配置順序タブで設定）');
                } else {
                  console.log('⚠️ 管理番号フィールドが空です');
                }
              } else {
                console.log('⏭️ 説明文への管理番号配置がOFFです');
              }
            } else {
              console.log('⚠️ localStorageに管理番号配置設定がありません');
            }
          } catch (e) {
            console.error('❌ 管理番号配置設定の読み込みエラー（説明文）:', e);
          }

          // 割引案内テキスト（設定シート対応版）
          const discountInfo = generateDiscountInfo();

          // 付属品テキスト
          const accessoriesText = getAccessoriesInfo();

          // ランク情報は商品状態(詳細)セクションに統合済み
          // 別途のrankSectionは不要
          let rankSection = '';

          // 配置順序を取得して説明文を組み立て（配置順序は「配置順序」タブで設定）
          buildDescriptionByOrder({
            brand: brandText,
            size: sizeText,
            color: colorText,
            condition: detailSection,
            material: materialText,
            accessories: accessoriesText,
            rank: rankSection,
            management: managementNumberSection,
            aiGeneration: aiGenerationSection,
            discount: discountInfo,
            hashtag: hashtagText
          }, descTextarea);
    } catch (error) {
      console.error('商品の説明更新エラー:', error);
      debug.error('updateDescriptionFromDetail エラー:', error);
    }
  }

  function setupDetailEventListener() {
    console.log('setupDetailEventListener 関数が呼び出されました');
    const detailInput = document.getElementById('商品状態詳細');
    if (detailInput) {
      // 既存のイベントリスナーを削除
      detailInput.removeEventListener('input', updateDescriptionFromDetail);
      // 新しいイベントリスナーを追加
      detailInput.addEventListener('input', updateDescriptionFromDetail);
      console.log('商品状態(詳細)イベントリスナー設定完了');
      // テスト用: 初回実行
      updateDescriptionFromDetail();
    } else {
      console.error('商品状態詳細の要素が見つかりません');
    }

    // 靴のサイズ関連項目にもイベントリスナーを追加
    const shoesFields = [
      'サイズ(表記)_靴',
      'その他のサイズ表記_靴',
      '普段のサイズ_靴',
      'フィット感_靴'
    ];

    shoesFields.forEach(fieldId => {
      const element = document.getElementById(fieldId);
      if (element) {
        const eventType = element.tagName === 'SELECT' ? 'change' : 'input';
        element.removeEventListener(eventType, updateDescriptionFromDetail);
        element.addEventListener(eventType, updateDescriptionFromDetail);
        console.log(`${fieldId}のイベントリスナー設定完了`);
      }
    });
  }

  // ================= 新セールスワードシステム =================
  function initializeSalesWords() {
    console.log('=== セールスワード初期化開始 ===');
    // PWA版：Firestoreから読み込み
    console.log('PWA版：Firestoreからセールスワードを読み込み');
    loadSalesWordsFromFirestore();
  }

  /**
   * セールスワード検索機能のセットアップ
   */
  function setupSaleswordSearch() {
    const searchInput = document.getElementById('saleswordSearch');
    const suggestList = document.getElementById('saleswordSuggestList');

    if (!searchInput || !suggestList) {
      console.log('セールスワード検索要素が見つかりません');
      return;
    }

    // 入力時の検索処理
    searchInput.addEventListener('input', function() {
      const query = this.value.trim().toLowerCase();

      if (query.length === 0) {
        suggestList.style.display = 'none';
        return;
      }

      // 全カテゴリからワードを検索
      const results = [];
      for (const [category, words] of Object.entries(SALESWORD_DATA.wordsByCategory || {})) {
        if (!words || !Array.isArray(words)) continue;

        words.forEach(word => {
          if (word.toLowerCase().includes(query)) {
            results.push({ word, category });
          }
        });
      }

      // 重複排除（同じワードでも異なるカテゴリなら表示）
      const uniqueResults = results.filter((item, index, self) =>
        index === self.findIndex(t => t.word === item.word && t.category === item.category)
      );

      // 候補を表示
      if (uniqueResults.length > 0) {
        suggestList.innerHTML = uniqueResults.slice(0, 20).map(item => `
          <div class="salesword-suggest-item" data-word="${item.word}" data-category="${item.category}"
               style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center;"
               onmouseover="this.style.background='#f3f4f6'" onmouseout="this.style.background='white'">
            <span style="font-weight: 500;">${item.word}</span>
            <span style="font-size: 11px; color: #6b7280; background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${item.category}</span>
          </div>
        `).join('');
        suggestList.style.display = 'block';

        // 候補クリック時の処理
        suggestList.querySelectorAll('.salesword-suggest-item').forEach(item => {
          item.addEventListener('click', function() {
            const word = this.dataset.word;
            const category = this.dataset.category;
            selectSaleswordFromSearch(word, category);
            searchInput.value = '';
            suggestList.style.display = 'none';
          });
        });
      } else {
        suggestList.innerHTML = '<div style="padding: 10px 12px; color: #9ca3af; font-size: 13px;">該当するワードが見つかりません</div>';
        suggestList.style.display = 'block';
      }
    });

    // 入力欄外クリックで候補を閉じる
    document.addEventListener('click', function(e) {
      if (!searchInput.contains(e.target) && !suggestList.contains(e.target)) {
        suggestList.style.display = 'none';
      }
    });

    // Escapeキーで候補を閉じる
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        suggestList.style.display = 'none';
        this.blur();
      }
    });

    console.log('セールスワード検索機能を初期化しました');
  }

  /**
   * 検索から選択されたセールスワードをプルダウンに反映
   */
  function selectSaleswordFromSearch(word, category) {
    const categorySelect = document.getElementById('セールスワード(カテゴリ)');
    const keywordSelect = document.getElementById('セールスワード');

    if (!categorySelect || !keywordSelect) {
      console.error('セールスワードプルダウンが見つかりません');
      return;
    }

    // カテゴリを設定
    categorySelect.value = category;

    // キーワードプルダウンを更新（onSalesWordCategoryChangedと同様の処理）
    const categoryWords = SALESWORD_DATA.wordsByCategory[category] || [];
    const uniqueWords = [...new Set(categoryWords)];

    keywordSelect.innerHTML = '<option value="">-- キーワードを選択 --</option>';
    uniqueWords.forEach(w => {
      const option = document.createElement('option');
      option.value = w;
      option.textContent = w;
      keywordSelect.appendChild(option);
    });
    keywordSelect.disabled = false;

    // キーワードを設定
    keywordSelect.value = word;

    // 商品名プレビューを更新
    updateNamePreview();

    console.log(`セールスワード検索から選択: ${category} / ${word}`);
  }

  function setupCategoryDropdown() {
    const categorySelect = document.getElementById('セールスワード(カテゴリ)');
    if (!categorySelect) {
      console.log('セールスワード(カテゴリ)要素が見つかりません');
      return;
    }
    // プルダウンをクリア
    categorySelect.innerHTML = '<option value="">-- カテゴリを選択 --</option>';

    // 「よく使う」カテゴリを先頭に追加（SALESWORD_DATAから読み込み）
    if (SALESWORD_DATA.wordsByCategory && SALESWORD_DATA.wordsByCategory['よく使う']) {
      const option = document.createElement('option');
      option.value = 'よく使う';
      option.textContent = '⭐ よく使う';
      categorySelect.appendChild(option);
      console.log(`✅ よく使うワード追加: ${SALESWORD_DATA.wordsByCategory['よく使う'].length}件`);
    } else {
      console.log('⚠️ よく使うワードが設定されていません');
    }

    // その他のカテゴリオプションを追加
    if (SALESWORD_DATA.categories && Array.isArray(SALESWORD_DATA.categories)) {
      SALESWORD_DATA.categories.forEach(category => {
        const option = document.createElement('option');
        option.value = category;
        option.textContent = category;
        categorySelect.appendChild(option);
      });
    }

    const totalCategories = (SALESWORD_DATA.categories?.length || 0) + (SALESWORD_DATA.wordsByCategory?.['よく使う'] ? 1 : 0);
    console.log(`✅ カテゴリプルダウン設定完了: ${totalCategories}件`);

    // キーワードプルダウンをリセット
    resetKeywordDropdown();
  }

  function resetKeywordDropdown() {
    const keywordSelect = document.getElementById('セールスワード');
    if (!keywordSelect) {
      console.log('セールスワード要素が見つかりません');
      return;
    }
    keywordSelect.innerHTML = '<option value="">-- キーワードを選択 --</option>';
    keywordSelect.disabled = true;
  }

  function onSalesWordCategoryChanged() {
    const categorySelect = document.getElementById('セールスワード(カテゴリ)');
    const keywordSelect = document.getElementById('セールスワード');
    if (!categorySelect || !keywordSelect) {
      console.log('セールスワード要素が見つかりません');
      updateNamePreview();
      return;
    }
    const selectedCategory = categorySelect.value.trim();
    if (!selectedCategory) {
      resetKeywordDropdown();
      updateNamePreview();
      return;
    }
    console.log('カテゴリ選択:', selectedCategory);
    // 選択されたカテゴリのキーワードを取得
    const categoryWords = SALESWORD_DATA.wordsByCategory[selectedCategory] || [];
    // 重複を排除
    const uniqueWords = [...new Set(categoryWords)];
    // キーワードプルダウンを更新
    keywordSelect.innerHTML = '<option value="">-- キーワードを選択 --</option>';
    uniqueWords.forEach(word => {
      const option = document.createElement('option');
      option.value = word;
      // 表示は元の値のまま（形式は適用しない）
      option.textContent = word;
      keywordSelect.appendChild(option);
    });
    keywordSelect.disabled = categoryWords.length === 0;
    console.log(`キーワード設定完了: ${categoryWords.length}件`);
    updateNamePreview();
  }

  /**
   * PWA版：FirestoreからセールスワードマスタをFirestoreから読み込み
   */
  async function loadSalesWordsFromFirestore() {
    try {
      console.log('[Firestore] セールスワードマスタ読み込み開始');

      if (!window.db) {
        console.error('[Firestore] Firestoreが初期化されていません、フォールバックを使用');
        setupFallbackSalesWords();
        return;
      }

      const snapshot = await window.db.collection('saleswords').orderBy('order').get();

      if (snapshot.empty) {
        console.warn('[Firestore] セールスワードデータが存在しません、フォールバックを使用');
        setupFallbackSalesWords();
        return;
      }

      const result = {
        categories: [],
        wordsByCategory: {},
        allWords: []
      };

      snapshot.forEach(doc => {
        const data = doc.data();
        result.categories.push(data.category);
        result.wordsByCategory[data.category] = data.words || [];
        result.allWords = result.allWords.concat(data.words || []);
      });

      SALESWORD_DATA = result;
      console.log('[Firestore] セールスワードマスタ読み込み成功');
      console.log('カテゴリ数:', result.categories.length);
      console.log('全ワード数:', result.allWords.length);

      // CACHED_CONFIG初期化を待ってからsetupCategoryDropdown()を実行
      waitForCachedConfigAndSetup();

    } catch (error) {
      console.error('[Firestore] セールスワード読み込みエラー:', error);
      setupFallbackSalesWords();
    }
  }

  /**
   * CACHED_CONFIG初期化を待ってセールスワードカテゴリプルダウンをセットアップ
   */
  function waitForCachedConfigAndSetup() {
    const maxWaitTime = 5000; // 最大5秒
    const checkInterval = 100; // 100msごとにチェック
    let elapsedTime = 0;

    console.log('[waitForCachedConfigAndSetup] CACHED_CONFIG初期化待機開始');

    const intervalId = setInterval(() => {
      elapsedTime += checkInterval;

      // CACHED_CONFIGが初期化され、かつセールスワード設定が読み込まれたらセットアップ実行
      // 注意: CACHED_CONFIG = {} だけでは不十分、よく使うセールスワードの読み込み完了を待つ
      if (window.CACHED_CONFIG && window.CACHED_CONFIG['よく使うセールスワード']) {
        clearInterval(intervalId);
        console.log('[waitForCachedConfigAndSetup] ✅ CACHED_CONFIG初期化完了（' + elapsedTime + 'ms経過）');

        // CACHED_CONFIGから「よく使う」を取得してSALESWORD_DATAに追加
        const saleswordConfig = window.CACHED_CONFIG['よく使うセールスワード'];
        const frequentWords = saleswordConfig?.よく使う || [];

        console.log('[waitForCachedConfigAndSetup] saleswordConfig:', saleswordConfig);
        console.log('[waitForCachedConfigAndSetup] よく使うワード:', frequentWords);

        if (frequentWords.length > 0) {
          SALESWORD_DATA.wordsByCategory['よく使う'] = frequentWords;
          console.log('[waitForCachedConfigAndSetup] ✅ SALESWORD_DATAに「よく使う」を追加:', frequentWords.length + '件');
        }

        // 表示形式設定を読み込み
        if (saleswordConfig?.表示形式) {
          SALESWORD_FORMAT = saleswordConfig.表示形式;
          console.log('[waitForCachedConfigAndSetup] ✅ SALESWORD_FORMATに表示形式を設定');
        }

        // デフォルトセールスワード設定を読み込み
        if (saleswordConfig?.デフォルト) {
          defaultSalesword = saleswordConfig.デフォルト;
          console.log('[waitForCachedConfigAndSetup] ✅ デフォルトセールスワードを設定:', defaultSalesword);
        }

        setupCategoryDropdown();
        applyDefaultSalesword();
        setupSaleswordSearch(); // セールスワード検索機能を初期化
        return;
      }

      // タイムアウト
      if (elapsedTime >= maxWaitTime) {
        clearInterval(intervalId);
        console.warn('[waitForCachedConfigAndSetup] ⚠️ CACHED_CONFIG初期化タイムアウト（' + maxWaitTime + 'ms）');

        // タイムアウト時はlocalStorageから直接読み込みを試みる
        try {
          const saleswordConfigStr = localStorage.getItem('rebornConfig_salesword');
          if (saleswordConfigStr) {
            const saleswordConfig = JSON.parse(saleswordConfigStr);
            console.log('[waitForCachedConfigAndSetup] ⚠️ フォールバック: localStorageから直接読み込み:', saleswordConfig);

            if (saleswordConfig?.表示形式) {
              SALESWORD_FORMAT = saleswordConfig.表示形式;
              console.log('[waitForCachedConfigAndSetup] ✅ SALESWORD_FORMATに表示形式を設定（フォールバック）:', SALESWORD_FORMAT);
            }

            if (saleswordConfig?.よく使う && saleswordConfig.よく使う.length > 0) {
              SALESWORD_DATA.wordsByCategory['よく使う'] = saleswordConfig.よく使う;
            }

            if (saleswordConfig?.デフォルト) {
              defaultSalesword = saleswordConfig.デフォルト;
            }
          }
        } catch (e) {
          console.error('[waitForCachedConfigAndSetup] ❌ フォールバック読み込みエラー:', e);
        }

        setupCategoryDropdown();
        setupSaleswordSearch(); // セールスワード検索機能を初期化
      }
    }, checkInterval);
  }

  function setupFallbackSalesWords() {
    console.log('フォールバック用セールスワード設定');
    const fallbackCategories = [
      '価格・セール', '希少性・在庫状況', '状態・コンディション',
      '取引・配送方法', '商品タイプ・ジャンル'
    ];
    const fallbackWords = {
      '価格・セール': ['【セール】', '【特価】', '【値下げ】'],
      '希少性・在庫状況': ['【レア】', '【限定】', '【1点もの】'],
      '状態・コンディション': ['【美品】', '【新品同様】', '【良品】'],
      '取引・配送方法': ['【匿名配送】', '【送料無料】'],
      '商品タイプ・ジャンル': ['【古着】', '【ヴィンテージ】']
    };
    SALESWORD_DATA = {
      categories: fallbackCategories,
      wordsByCategory: fallbackWords,
      allWords: Object.values(fallbackWords).flat()
    };

    // CACHED_CONFIG初期化を待ってからセットアップ
    waitForCachedConfigAndSetup();
  }

  function setupSalesWordEventListeners() {
    const categorySelect = document.getElementById('セールスワード(カテゴリ)');
    if (categorySelect) {
      // 既存のイベントリスナーを削除
      categorySelect.removeEventListener('change', onSalesWordCategoryChanged);
      // 新しいイベントリスナーを追加
      categorySelect.addEventListener('change', onSalesWordCategoryChanged);
      console.log('セールスワードイベントリスナー設定完了');
    }
  }

  /**
   * デフォルトセールスワードを適用
   * CACHED_CONFIGから読み込んで適用（引数不要）
   */
  function applyDefaultSalesword() {
    console.log('==========================================================');
    console.log('[applyDefaultSalesword] 🔍 デバッグ開始');
    console.log('==========================================================');

    // 1. CACHED_CONFIG確認
    console.log('[applyDefaultSalesword] window.CACHED_CONFIG:', window.CACHED_CONFIG);

    const saleswordConfig = window.CACHED_CONFIG?.['よく使うセールスワード'];
    console.log('[applyDefaultSalesword] saleswordConfig:', saleswordConfig);

    const defaultConfig = saleswordConfig?.デフォルト;
    console.log('[applyDefaultSalesword] defaultConfig:', defaultConfig);

    if (!defaultConfig || !defaultConfig.カテゴリ || !defaultConfig.セールスワード) {
      console.error('[applyDefaultSalesword] ❌ デフォルト設定がありません');
      console.log('[applyDefaultSalesword] saleswordConfig:', saleswordConfig);
      console.log('==========================================================');
      return;
    }

    // 2. DOM要素確認
    const categorySelect = document.getElementById('セールスワード(カテゴリ)');
    const saleswordSelect = document.getElementById('セールスワード');

    console.log('[applyDefaultSalesword] categorySelect:', categorySelect);
    console.log('[applyDefaultSalesword] saleswordSelect:', saleswordSelect);

    if (!categorySelect || !saleswordSelect) {
      console.error('[applyDefaultSalesword] ❌ セールスワードの要素が見つかりません');
      console.log('==========================================================');
      return;
    }

    // 3. カテゴリプルダウンの選択肢を確認
    console.log('[applyDefaultSalesword] カテゴリプルダウンの選択肢数:', categorySelect.options.length);
    for (let i = 0; i < categorySelect.options.length; i++) {
      console.log(`  選択肢${i}: value="${categorySelect.options[i].value}", text="${categorySelect.options[i].text}"`);
    }

    // 4. カテゴリを設定
    console.log('[applyDefaultSalesword] 設定するカテゴリ:', defaultConfig.カテゴリ);
    categorySelect.value = defaultConfig.カテゴリ;
    console.log('[applyDefaultSalesword] カテゴリ設定後のvalue:', categorySelect.value);

    // 5. カテゴリ変更イベントをトリガー
    console.log('[applyDefaultSalesword] onSalesWordCategoryChanged()実行');
    onSalesWordCategoryChanged();

    // 6. セールスワードを設定（プルダウン更新後）
    setTimeout(() => {
      console.log('[applyDefaultSalesword] セールスワードプルダウンの選択肢数:', saleswordSelect.options.length);
      for (let i = 0; i < saleswordSelect.options.length; i++) {
        console.log(`  選択肢${i}: value="${saleswordSelect.options[i].value}"`);
      }

      console.log('[applyDefaultSalesword] 設定するセールスワード:', defaultConfig.セールスワード);
      saleswordSelect.value = defaultConfig.セールスワード;
      console.log('[applyDefaultSalesword] セールスワード設定後のvalue:', saleswordSelect.value);

      // 7. 商品名プレビューを更新
      if (typeof updateNamePreview === 'function') {
        updateNamePreview();
        console.log('[applyDefaultSalesword] ✅ 商品名プレビュー更新完了');
      }

      console.log('==========================================================');
      console.log('[applyDefaultSalesword] 🎉 完了');
      console.log('==========================================================');
    }, 200);  // 100ms → 200msに延長
  }

  // ================= カテゴリ階層 =================
  function filterByCategory(rows) {
    const l1 = (document.getElementById('大分類(カテゴリ)')?.value||'').trim();
    const l2 = (document.getElementById('中分類(カテゴリ)')?.value||'').trim();
    const l3 = (document.getElementById('小分類(カテゴリ)')?.value||'').trim();
    const l4 = (document.getElementById('細分類(カテゴリ)')?.value||'').trim();
    const l5 = (document.getElementById('細分類2')?.value||'').trim();
    let r = rows.slice();
    if (l1) r = r.filter(x=> x.大分類 === l1);
    if (l2) r = r.filter(x=> x.中分類 === l2);
    if (l3) r = r.filter(x=> x.小分類 === l3);
    if (l4) r = r.filter(x=> x.細分類 === l4);
    if (l5) r = r.filter(x=> x.細分類2 === l5);
    return r;
  }

  function refreshItems() {
    const rows = filterByCategory(CAT_ROWS);
    fillSelectSafe(document.getElementById('アイテム名'), uniqKeepOrder(rows.map(r=>r.アイテム名)));
    updateItemNameDisplay();
    updateNamePreview();
  }

  /**
   * 中分類に応じてサイズプルダウンの選択肢を切り替える
   * @param {string} chuBunrui - 中分類の値
   */
  function updateSizeOptions(chuBunrui) {
    try {
      debug.log(`updateSizeOptions() が呼ばれました。中分類: "${chuBunrui}"`);
      const sizeSelect = document.getElementById('サイズ');
      if (!sizeSelect) {
        debug.log('サイズプルダウンが見つかりません');
        return;
      }

      const currentValue = sizeSelect.value; // 現在の選択値を保持

      // 中分類が「靴」の場合は靴用サイズ、それ以外は服用サイズ
      if (chuBunrui === '靴') {
        // 大分類でメンズ/レディースを判定
        const daiBunrui = _val('大分類(カテゴリ)');
        const shoeSizes = [];

        if (daiBunrui === 'メンズ') {
          // メンズ: 23.5cm以下、24cm～30.5cm、31cm以上
          shoeSizes.push('23.5cm以下');
          for (let size = 24.0; size <= 30.5; size += 0.5) {
            shoeSizes.push(size.toFixed(1) + 'cm');
          }
          shoeSizes.push('31cm以上');
        } else if (daiBunrui === 'レディース') {
          // レディース: 20cm以下、20.5cm～27cm、27.5cm以上
          shoeSizes.push('20cm以下');
          for (let size = 20.5; size <= 27.0; size += 0.5) {
            shoeSizes.push(size.toFixed(1) + 'cm');
          }
          shoeSizes.push('27.5cm以上');
        } else {
          // その他（キッズなど）: デフォルト
          for (let size = 22.0; size <= 30.0; size += 0.5) {
            shoeSizes.push(size.toFixed(1) + 'cm');
          }
        }

        fillSelectSafe(sizeSelect, shoeSizes);
        debug.log(`サイズプルダウンを靴用サイズに切り替えました（${daiBunrui}）`);
      } else {
        // 服用サイズ: マスターデータから取得（エラー時は何もしない）
        try {
          const sizeOptions = MASTER_OPTIONS && MASTER_OPTIONS['サイズ'] ? MASTER_OPTIONS['サイズ'] : [];
          if (sizeOptions.length > 0) {
            fillSelectSafe(sizeSelect, sizeOptions);
            debug.log('サイズプルダウンを服用サイズに切り替えました');
          } else {
            debug.log('マスターデータに服用サイズが見つかりません');
          }
        } catch (e) {
          debug.log('マスターデータからサイズ取得エラー:', e);
          // エラー時は何もしない（既存の選択肢を維持）
        }
      }

      // 以前の選択値が新しい選択肢に存在する場合は復元
      if (currentValue) {
        const options = Array.from(sizeSelect.options).map(opt => opt.value);
        if (options.includes(currentValue)) {
          sizeSelect.value = currentValue;
        }
      }
    } catch (error) {
      console.error('updateSizeOptions エラー:', error);
      // エラーが起きても処理を続行
    }
  }

  /**
   * 基本情報のサイズを商品の説明ブロックに同期
   */
  function syncBasicSizeToDescription() {
    try {
      const chuBunrui = _val('中分類(カテゴリ)');
      const basicSize = _val('サイズ');

      if (chuBunrui === '靴' && basicSize) {
        const shoesSizeSelect = document.getElementById('サイズ(表記)_靴');
        if (shoesSizeSelect) {
          shoesSizeSelect.value = basicSize;
          debug.log(`基本情報のサイズ(${basicSize})を商品の説明ブロック（靴）に反映しました`);
          // 説明文プレビューを更新
          updateDescriptionFromDetail();
        }
      }
    } catch (error) {
      console.error('syncBasicSizeToDescription エラー:', error);
    }
  }

  /**
   * 中分類に応じて商品の説明ブロックのサイズセクション表示を切り替える
   * @param {string} chuBunrui - 中分類の値
   */
  function updateSizeSectionDisplay(chuBunrui) {
    try {
      console.log(`★★★ updateSizeSectionDisplay() が呼ばれました。中分類: "${chuBunrui}"`);
      const sizeSection = document.getElementById('sizeSection');
      const topsSize = document.getElementById('topsSize');
      const bottomsSize = document.getElementById('bottomsSize');
      const shoesSize = document.getElementById('shoesSize');
      const sizeIconDisplay = document.getElementById('sizeIconDisplay');
      const sizeLabelDisplay = document.getElementById('sizeLabelDisplay');

      console.log('★★★ 要素チェック:', {sizeSection: !!sizeSection, topsSize: !!topsSize, bottomsSize: !!bottomsSize, shoesSize: !!shoesSize});

      if (!sizeSection || !topsSize || !bottomsSize || !shoesSize) {
        console.log('★★★ サイズセクションの要素が見つかりません');
        return;
      }

      // 全て非表示にする
      topsSize.style.display = 'none';
      bottomsSize.style.display = 'none';
      shoesSize.style.display = 'none';

      if (chuBunrui === '靴') {
        // 靴の場合
        console.log('★★★ 靴モード: displayを設定する前 - sizeSection.style.display:', sizeSection.style.display);
        sizeSection.style.display = 'block';

        // 折りたたみコンテンツも表示し、ボタンの状態も更新する
        const sectionContent = sizeSection.querySelector('.section-content');
        const collapseBtn = sizeSection.querySelector('.collapse-btn');
        if (sectionContent) {
          sectionContent.style.display = 'block';
          if (collapseBtn) {
            collapseBtn.textContent = '▼';
          }
          console.log('★★★ section-content とボタンを表示状態にしました');
        }

        shoesSize.style.display = 'block';
        console.log('★★★ 靴モード: displayを設定した後 - sizeSection.style.display:', sizeSection.style.display);
        console.log('★★★ 靴モード: displayを設定した後 - shoesSize.style.display:', shoesSize.style.display);

        // 要素の詳細情報をログ出力
        const rect = sizeSection.getBoundingClientRect();
        console.log('★★★ sizeSection の位置とサイズ:', {
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          visible: rect.width > 0 && rect.height > 0
        });
        console.log('★★★ sizeSection の親要素:', sizeSection.parentElement ? sizeSection.parentElement.tagName : 'なし');
        console.log('★★★ sizeSection の親要素の display:', sizeSection.parentElement ? window.getComputedStyle(sizeSection.parentElement).display : 'なし');

        if (sizeIconDisplay) sizeIconDisplay.textContent = '👟';
        if (sizeLabelDisplay) sizeLabelDisplay.textContent = 'サイズ（靴）';

        // 靴用サイズ選択肢を生成
        const shoesSizeSelect = document.getElementById('サイズ(表記)_靴');
        if (shoesSizeSelect) {
          const shoeSizes = [];
          for (let size = 22.0; size <= 30.0; size += 0.5) {
            shoeSizes.push(size.toFixed(1) + 'cm');
          }
          fillSelectSafe(shoesSizeSelect, shoeSizes);

          // 基本情報のサイズを靴用サイズ(表記)に同期
          const basicSize = _val('サイズ');
          if (basicSize) {
            shoesSizeSelect.value = basicSize;
            console.log(`★★★ 基本情報のサイズ(${basicSize})を反映しました`);
          }
        }
        console.log('★★★ サイズセクションを靴用に切り替えました');
      } else {
        // 服の場合（既存の処理）
        sizeSection.style.display = 'none'; // 初期状態は非表示
        console.log('★★★ サイズセクションを非表示にしました（アイテム名選択後に表示されます）');
      }
    } catch (error) {
      console.error('updateSizeSectionDisplay エラー:', error);
      // エラーが起きても処理を続行
    }
  }

  // 特大分類（メルカリトップカテゴリー）の変更ハンドラ
  function onL0Changed() {
    // 全ての下位プルダウンをリセット
    resetSelect('大分類(カテゴリ)');
    resetSelect('中分類(カテゴリ)');
    resetSelect('小分類(カテゴリ)');
    resetSelect('細分類(カテゴリ)');
    resetSelect('細分類2');
    resetSelect('アイテム名', false);
    // 細分類行を非表示
    const saibunruiRow = document.getElementById('saibunruiRow');
    if (saibunruiRow) saibunruiRow.style.display = 'none';
    const saibunrui2Container = document.getElementById('saibunrui2Container');
    if (saibunrui2Container) saibunrui2Container.style.display = 'none';

    const l0 = (document.getElementById('特大分類')?.value || '').trim();
    if (l0) {
      // 特大分類が選択されたら、その特大分類に属する大分類のみ表示
      const filteredRows = CAT_ROWS.filter(r => r.特大分類 === l0);
      const l1s = uniqKeepOrder(filteredRows.map(r => r.大分類));
      fillSelectSafe(document.getElementById('大分類(カテゴリ)'), l1s);
      debug.log('特大分類選択: ' + l0 + ', 大分類選択肢: ' + l1s.length + '件');
    }
    // アイテム名は最下層まで選択されてから有効化
    updateNamePreview();
  }

  function onL1Changed() {
    resetSelect('中分類(カテゴリ)');
    resetSelect('小分類(カテゴリ)');
    resetSelect('細分類(カテゴリ)');
    resetSelect('細分類2');
    resetSelect('アイテム名', false);
    // 細分類行を非表示
    const saibunruiRow = document.getElementById('saibunruiRow');
    if (saibunruiRow) saibunruiRow.style.display = 'none';
    const saibunrui2Container = document.getElementById('saibunrui2Container');
    if (saibunrui2Container) saibunrui2Container.style.display = 'none';

    const l1 = (document.getElementById('大分類(カテゴリ)')?.value||'').trim();
    if (l1) {
      const mids = uniqKeepOrder(CAT_ROWS.filter(r=>r.大分類===l1).map(r=>r.中分類));
      fillSelectSafe(document.getElementById('中分類(カテゴリ)'), mids);
    }
    // アイテム名は最下層まで選択されてから有効化
    updateNamePreview();
  }

  function onL2Changed() {
    debug.log('onL2Changed() が呼ばれました');
    resetSelect('小分類(カテゴリ)');
    resetSelect('細分類(カテゴリ)');
    resetSelect('細分類2');
    resetSelect('アイテム名', false);
    // 細分類行を非表示
    const saibunruiRow = document.getElementById('saibunruiRow');
    if (saibunruiRow) saibunruiRow.style.display = 'none';
    const saibunrui2Container = document.getElementById('saibunrui2Container');
    if (saibunrui2Container) saibunrui2Container.style.display = 'none';

    const l1 = (document.getElementById('大分類(カテゴリ)')?.value||'').trim();
    const l2 = (document.getElementById('中分類(カテゴリ)')?.value||'').trim();
    debug.log(`中分類の値: "${l2}"`);
    if (l2) {
      const smalls = uniqKeepOrder(CAT_ROWS.filter(r=>r.大分類===l1 && r.中分類===l2).map(r=>r.小分類));
      fillSelectSafe(document.getElementById('小分類(カテゴリ)'), smalls);
    }

    // === 靴の場合、サイズプルダウンを靴用サイズに切り替え ===
    updateSizeOptions(l2);

    // アイテム名は最下層まで選択されてから有効化
    updateNamePreview();
  }

  function onL3Changed() {
    resetSelect('細分類(カテゴリ)');
    resetSelect('細分類2');
    resetSelect('アイテム名', false);
    const l1 = (document.getElementById('大分類(カテゴリ)')?.value||'').trim();
    const l2 = (document.getElementById('中分類(カテゴリ)')?.value||'').trim();
    const l3 = (document.getElementById('小分類(カテゴリ)')?.value||'').trim();
    const saibunruiRow = document.getElementById('saibunruiRow');
    const saibunrui2Container = document.getElementById('saibunrui2Container');

    if (l3) {
      const mins = uniqKeepOrder(CAT_ROWS.filter(r=>r.大分類===l1 && r.中分類===l2 && r.小分類===l3).map(r=>r.細分類));
      fillSelectSafe(document.getElementById('細分類(カテゴリ)'), mins);

      // 細分類の選択肢がある場合のみ表示
      if (mins.length > 0 && saibunruiRow) {
        saibunruiRow.style.display = '';
      } else {
        // 細分類がない場合はアイテム名を直接表示
        if (saibunruiRow) saibunruiRow.style.display = 'none';
        refreshItems();
      }
    } else {
      // 小分類が未選択の場合は非表示
      if (saibunruiRow) saibunruiRow.style.display = 'none';
    }
    // 細分類2も非表示にリセット
    if (saibunrui2Container) saibunrui2Container.style.display = 'none';
    updateNamePreview();
  }

  function onL4Changed() {
    resetSelect('細分類2');
    resetSelect('アイテム名', false);
    const l1 = (document.getElementById('大分類(カテゴリ)')?.value||'').trim();
    const l2 = (document.getElementById('中分類(カテゴリ)')?.value||'').trim();
    const l3 = (document.getElementById('小分類(カテゴリ)')?.value||'').trim();
    const l4 = (document.getElementById('細分類(カテゴリ)')?.value||'').trim();
    const saibunrui2Container = document.getElementById('saibunrui2Container');

    if (l4) {
      const fin2 = uniqKeepOrder(CAT_ROWS.filter(r=>r.大分類===l1 && r.中分類===l2 && r.小分類===l3 && r.細分類===l4).map(r=>r.細分類2));
      fillSelectSafe(document.getElementById('細分類2'), fin2);

      // 細分類2の選択肢がある場合のみ表示
      if (fin2.length > 0 && saibunrui2Container) {
        saibunrui2Container.style.display = '';
      } else {
        // 細分類2がない場合はアイテム名を直接表示
        if (saibunrui2Container) saibunrui2Container.style.display = 'none';
        refreshItems();
      }
    } else {
      // 細分類1が未選択の場合は非表示
      if (saibunrui2Container) saibunrui2Container.style.display = 'none';
    }
    updateNamePreview();
  }

  function onL5Changed() {
    refreshItems();
  }

  function collect() {
    const d={};
    FIELD_IDS.forEach(k=>{
      const el = document.getElementById(k);
      if (!el) return;
      const v=(el.value||'').trim();
      if (v !== '') d[k]=v;
    });

    // サイズ(表記)の特殊処理: トップス、ボトムス、靴のいずれかの値を使用
    const sizeHyokiTop = _val('サイズ(表記)_トップス');
    const sizeHyokiBottom = _val('サイズ(表記)_ボトムス');
    const sizeHyokiShoes = _val('サイズ(表記)_靴');
    const sizeHyoki = sizeHyokiTop || sizeHyokiBottom || sizeHyokiShoes;
    if (sizeHyoki) {
      d['サイズ(表記)'] = sizeHyoki;
    }

    // === 画像はGoogle Driveにアップロード後にJSON形式で保存 ===
    // 画像アップロードはonSave()関数で処理します
    // ここでは何もしません（Base64データをスプレッドシートに保存するとエラーになるため）

    // === AI生成履歴を追加 ===
    debug.log(`window.AI_GENERATED_TEXT: "${window.AI_GENERATED_TEXT ? window.AI_GENERATED_TEXT.substring(0, 50) + '...' : '(空)'}"`);
    if (window.AI_GENERATED_TEXT && window.AI_GENERATED_TEXT.trim() !== '') {
      const aiHistory = {
        timestamp: new Date().toISOString(),
        text: window.AI_GENERATED_TEXT,
        imageCount: uploadedImages ? uploadedImages.length : 0,
        brandName: _val('ブランド(英語)') || _val('商品名_ブランド(英語)') || '',
        itemName: _val('アイテム名') || ''
      };
      const historyJson = JSON.stringify(aiHistory);
      d['AI生成履歴'] = historyJson;
      debug.log(`AI生成履歴を追加しました (${historyJson.length}文字)`);
    } else {
      debug.log('AI生成履歴は空のためスキップしました');
    }

    return d;
  }

  function frontValidate(d) {
    const name = d['商品名(タイトル)'] || '';
    const len = Array.from(name).length;
    if (NAME_LIMIT_MODE === 'block' && len > NAME_LIMIT) {
      return `NG(NAME): 商品名(タイトル)は${NAME_LIMIT}文字以内にしてください（現在${len}文字）`;
    }
    const desc = d['商品の説明'] || '';
    const dlen = Array.from(desc).length;
    if (DESC_LIMIT_MODE === 'block' && dlen > DESC_LIMIT) {
      return `NG(DESC): 商品の説明は${DESC_LIMIT}文字以内にしてください（現在${dlen}文字）`;
    }
    if (d['仕入金額'] && isNaN(Number(d['仕入金額']))) return "NG(FORMAT): 仕入金額は数値で入力してください";
    if (d['出品金額'] && isNaN(Number(d['出品金額']))) return "NG(FORMAT): 出品金額は数値で入力してください";
    return '';
  }

  async function onSave() {
    console.log('[DEBUG] onSave() called');
    
    // 仕入商品との紐付けチェック（QR未スキャンの場合は警告）
    if (typeof checkInvIdBeforeSave === 'function' && !checkInvIdBeforeSave()) {
      console.log('[DEBUG] Save cancelled - no invId linked');
      return;
    }
    
    updateNamePreview();
    updateDesc();
    const d = collect();
    console.log('[DEBUG] Collected data:', d);
    const ng = frontValidate(d);
    console.log('[DEBUG] Validation result:', ng);
    if (ng) {
      return show(ng);
    }

    // 画像チェック
    if (!productImages || productImages.length === 0) {
      return show('商品画像を1枚以上アップロードしてください');
    }

    // ローディング画面を表示（保存完了まで表示し続ける）
    showLoadingOverlay('出品中', 'データを保存中...');
    updateLoadingProgress(10, '準備中...');

    // バックグラウンドで実際の保存処理
    console.log('[DEBUG] Checking productImages:', productImages ? productImages.length : 0);

    // PWA版：Firestore直接保存
    console.log('[PWA] Firestoreに保存');
    {
      try {
        // 商品画像がある場合は先にストレージにアップロード
        if (productImages && productImages.length > 0 && (IMAGE_STORAGE_PROVIDER === 'firebase' || IMAGE_STORAGE_PROVIDER === 'r2')) {
          const managementNumber = d['管理番号'] || 'unknown_' + Date.now();
          console.log(`[PWA] ${IMAGE_STORAGE_PROVIDER} 画像アップロード開始:`, managementNumber);

          let uploadResult;

          if (IMAGE_STORAGE_PROVIDER === 'r2') {
            // Cloudflare R2（リトライ機能付き）
            uploadResult = await window.uploadImagesToR2(
              managementNumber,
              productImages,
              (percent, message) => updateLoadingProgress(percent, message)
            );
          } else {
            // Firebase Storage
            uploadResult = await window.uploadImagesToFirebaseStorage(
              managementNumber,
              productImages,
              (percent, message) => updateLoadingProgress(percent, message)
            );
          }

          if (uploadResult.success) {
            debug.log(`✅ ${IMAGE_STORAGE_PROVIDER} アップロード成功: ${uploadResult.successCount}/${uploadResult.totalCount}枚`);
            // 画像URLをJSON形式で保存
            d['JSON_データ'] = JSON.stringify({ imageUrls: uploadResult.urls });
            d['画像URL'] = uploadResult.urls.join('\n'); // 改行区切りでも保存（互換性）
            updateLoadingProgress(70, '画像アップロード完了');
          } else {
            console.warn(`[PWA] ${IMAGE_STORAGE_PROVIDER} 画像アップロード一部失敗:`, uploadResult.error);
            if (uploadResult.urls.length > 0) {
              // 一部成功した場合は続行
              d['JSON_データ'] = JSON.stringify({ imageUrls: uploadResult.urls });
              d['画像URL'] = uploadResult.urls.join('\n');
            }
          }
        } else {
          updateLoadingProgress(30, '商品データを準備中...');
        }

        // EC用コンテンツをAI生成
        updateLoadingProgress(75, 'EC用コンテンツを生成中...');
        try {
          const ecProductInfo = collectProductInfo();
          const ecImages = getUploadedImages();
          const EC_WORKER_URL = 'https://reborn-help-chatbot.mercari-yasuhirotakuji.workers.dev/generate-ec-content';
          const ecResponse = await fetch(EC_WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productInfo: ecProductInfo, images: ecImages })
          });
          const ecResult = await ecResponse.json();
          if (ecResult.success && ecResult.ecTitle) {
            d['ecTitle'] = ecResult.ecTitle;
            d['ecDescription'] = ecResult.ecDescription || '';
            console.log('[onSave] EC用コンテンツ生成成功:', ecResult.ecTitle);
          } else {
            console.warn('[onSave] EC用コンテンツ生成: タイトル取得できず、スキップ');
          }
        } catch (ecError) {
          console.warn('[onSave] EC用コンテンツ生成エラー（出品は続行）:', ecError.message);
        }

        // Firestore保存
        updateLoadingProgress(85, 'データを保存中...');
        const result = await saveProductToFirestore(d);
        console.log('[onSave] Firestore保存結果:', result);

        if (result.success) {
          updateLoadingProgress(100, '出品完了！');

          // 下書きを削除（出品成功）
          if (typeof prdClearDraft === 'function') prdClearDraft();

          // 少し待ってからオーバーレイを閉じてモーダル表示
          await new Promise(resolve => setTimeout(resolve, 300));

          show(''); // メッセージをクリア
          hideLoadingOverlay();

          // 保存成功モーダルを表示
          showSuccessModal();

          // クリアボタンを「続けて登録」に変更
          const resetBtn = document.getElementById('resetButton');
          if (resetBtn) {
            resetBtn.textContent = '続けて登録';
            resetBtn.onclick = continueProductRegistration;
            resetBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
            resetBtn.style.color = 'white';
            resetBtn.style.border = 'none';
          }
        } else {
          // エラーメッセージ表示
          hideLoadingOverlay();
          show(result.message);
        }
      } catch (error) {
        console.error('[onSave] エラー:', error);
        hideLoadingOverlay();
        show(`NG(ERROR): ${error.message}`);
      }
    }
  }

  /**
   * スプレッドシートに商品データを保存
   * @param {Object} d - 商品データ
   */
  function saveProductToSheet(d) {
    console.log('[DEBUG] saveProductToSheet() called with data:', d);

    // ★ 管理番号の重複チェックとカウンター更新
    const managementNumber = d['管理番号'];
    if (managementNumber) {
      confirmManagementNumber(managementNumber).then(confirmed => {
        if (!confirmed) {
          // 重複エラー：保存を中断
          hideLoadingOverlay();
          return;
        }

        // 重複チェックOK：Firestoreへ保存
        executeSaveToFirestore(d);
      });
    } else {
      // 管理番号なし：そのまま保存
      executeSaveToFirestore(d);
    }
  }

  /**
   * Firestoreへの保存実行（confirmManagementNumber後に呼び出し）
   * @param {Object} d - 商品データ
   */
  async function executeSaveToFirestore(d) {
    try {
      console.log('[DEBUG] Firestore保存開始:', d);

      // Firestoreに商品データを保存
      const docRef = await window.db.collection('products').add({
        ...d,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      console.log('[DEBUG] Firestore保存成功:', docRef.id);

      // 📢 Webhook経由で通知送信（GAS版と同じ仕組み）
      try {
        const userName = localStorage.getItem('reborn_user_name') || window.CACHED_CONFIG?.userName || '匿名ユーザー';

        const brandName = d['ブランド(英語)'] || d['ブランド(カナ)'] || '';
        const itemName = d['アイテム名'] || '';
        const category = d['大分類(カテゴリ)'] || d['大分類'] || '';
        const managementNumber = d['管理番号'] || '';
        const listingDestination = d['出品先'] || '';
        const listingAmount = d['出品金額'] || '';

        const productName = (brandName ? brandName + ' ' : '') + (itemName || category || '');
        const notificationText = `✅ 商品登録完了\n${userName}さんが商品を登録しました\n\n管理番号: ${managementNumber}\n${productName}\n${listingDestination ? '出品先: ' + listingDestination : ''}\n${listingAmount ? '出品金額: ' + Number(listingAmount).toLocaleString() + '円' : ''}`;

        // 通知対象ユーザー（登録者以外の全ユーザー）
        const allUsers = window.CACHED_CONFIG?.allUsers || [];
        const targetUsers = allUsers.filter(user => user && user !== userName && user !== 'システム');

        const notificationData = {
          type: 'PRODUCT_REGISTERED',
          userName: userName,
          managementNumber: managementNumber,
          productName: productName,
          listingDestination: listingDestination,
          listingAmount: listingAmount,
          timestamp: new Date().toISOString(),
          content: notificationText,
          sender: userName,
          title: '✅ 商品登録完了',
          targetUsers: targetUsers
        };

        if (typeof window.sendWebhookNotification === 'function') {
          await window.sendWebhookNotification(notificationData);
          console.log('[System Notification] Webhook経由で通知送信完了');
        } else {
          console.warn('[System Notification] sendWebhookNotification 関数が見つかりません - webhook-config.js の読み込みを確認してください');
        }

      } catch (notificationError) {
        console.error('[System Notification] 通知送信エラー:', notificationError);
        // 通知エラーは商品保存の成功には影響しない
      }

      // 楽観的UI: ローディングは既にアニメーションで閉じている
      // 保存完了後の処理のみ実行

      show(''); // メッセージをクリア
      
      // 保存成功後も商品の説明エリアの高さを保持
      const descTextarea = document.getElementById('商品の説明');
      if (descTextarea) {
        autoResizeTextarea(descTextarea);
      }
      
      // 保存成功後に開閉状態と管理番号配置を保存
      saveDescriptionBlocksCollapseState();
      saveTitleBlocksCollapseState();
      saveManagementNumberPlacementSettings();
      console.log('保存成功：開閉状態と管理番号配置を保存しました');

      // === 保存成功後に画像データとAI生成テキストをクリア ===
      // AI生成用画像（uploadedImages）をクリア
      if (typeof uploadedImages !== 'undefined') {
        uploadedImages = [];
        const container = document.getElementById('imagePreviewContainer');
        if (container) {
          container.style.display = 'none';
          // プレビューのDOM要素もクリア
          const previewList = container.querySelector('.preview-list, #imagePreviewList');
          if (previewList) previewList.innerHTML = '';
        }
        const fileInput = document.getElementById('productImages');
        if (fileInput) {
          fileInput.value = '';
        }
        // プレビュー表示を更新
        if (typeof displayImagePreviews === 'function') {
          displayImagePreviews();
        }
        debug.log('保存成功後にAI生成用画像データをクリアしました');
      }

      // 商品画像（productImages）をクリア
      if (typeof productImages !== 'undefined') {
        productImages.length = 0; // 配列を空にする（参照を維持）
        const fileInput = document.getElementById('productImagesForSave');
        if (fileInput) {
          fileInput.value = '';
        }
        // プレビュー表示を更新（DOMクリアも含む）
        if (typeof displayProductImagesPreview === 'function') {
          displayProductImagesPreview();
        }
        // 直接DOM要素もクリア（displayProductImagesPreviewが効かない場合の保険）
        const productImagesContainer = document.getElementById('productImagesPreviewContainer');
        if (productImagesContainer) {
          productImagesContainer.style.display = 'none';
          const list = document.getElementById('productImagesPreviewList');
          if (list) list.innerHTML = '';
        }
        debug.log('保存成功後に商品画像データをクリアしました');
      }

      if (window.AI_GENERATED_TEXT) {
        window.AI_GENERATED_TEXT = '';
        debug.log('保存成功後にAI生成テキストをクリアしました');
      }

      // === 商品属性のリセットと商品名プレビューの更新 ===
      // 属性2以降を削除し、NAME_REST_FIELDSを更新
      try {
        // window経由で確実に呼び出し
        if (typeof window.resetAttributeSections === 'function') {
          window.resetAttributeSections();
          debug.log('✅ resetAttributeSections 実行完了');
        } else {
          console.warn('⚠️ window.resetAttributeSections が見つかりません');
        }
        if (typeof window.updateAttributeFields === 'function') {
          window.updateAttributeFields();
          debug.log('✅ updateAttributeFields 実行完了');
        } else {
          console.warn('⚠️ window.updateAttributeFields が見つかりません');
        }
        if (typeof window.updateNamePreview === 'function') {
          window.updateNamePreview();
          debug.log('✅ updateNamePreview 実行完了');
        } else {
          console.warn('⚠️ window.updateNamePreview が見つかりません');
        }
        debug.log('保存成功後に商品属性と商品名プレビューをリセットしました');
      } catch (resetError) {
        console.error('属性リセットエラー:', resetError);
      }

      hideLoadingOverlay();

      // 保存成功モーダルを表示
      showSuccessModal();

      // リセットボタンを「続けて登録」に変更
      const resetBtn = document.getElementById('resetButton');
      if (resetBtn) {
        resetBtn.textContent = '続けて登録';
        resetBtn.onclick = continueProductRegistration;
        resetBtn.style.background = 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
        resetBtn.style.color = 'white';
        resetBtn.style.border = 'none';
      }

    } catch (error) {
      console.error('[DEBUG] Firestore保存エラー:', error);
      hideLoadingOverlay();
      show(`保存エラー: ${error && error.message ? error.message : error}`);
    }
  }

  // ==================== リセット機能（新実装） ====================
  // Issue: RESET-005
  // 「次の商品へ」機能として全面改修

  /**
   * ヘルパー関数: フィールドをクリア
   */
  function clearField(fieldId) {
    try {
      const el = document.getElementById(fieldId);
      if (el) {
        el.value = '';
      }
    } catch (error) {
      console.error(`[clearField] エラー (${fieldId}):`, error);
    }
  }

  /**
   * 管理番号ブロックをリセット
   */
  function resetManagementNumber() {
    try {
      console.log('[Reset] 管理番号ブロック開始');

      // 基本フィールド
      clearField('prefix1');
      clearField('棚番号');
      clearField('管理番号');
      clearField('担当者');

      // 動的生成フィールド
      clearField('mgmt_shelf_first');
      clearField('mgmt_shelf_second');
      clearField('mgmt_custom_first');
      clearField('mgmt_custom_second');

      console.log('[Reset] 管理番号ブロック完了');
    } catch (error) {
      console.error('[Reset] 管理番号ブロックエラー:', error);
    }
  }

  /**
   * 基本情報ブロックをリセット
   */
  function resetBasicInfo() {
    try {
      console.log('[Reset] 基本情報ブロック開始');

      // カテゴリー
      clearField('大分類(カテゴリ)');
      ['中分類(カテゴリ)', '小分類(カテゴリ)', '細分類(カテゴリ)', '細分類2'].forEach(id => {
        if (typeof resetSelect === 'function') {
          resetSelect(id, true);
        }
      });

      // 細分類行を非表示
      const saibunruiRow = document.getElementById('saibunruiRow');
      if (saibunruiRow) saibunruiRow.style.display = 'none';

      // ブランド
      clearField('ブランド(英語)');
      clearField('ブランド(カナ)');
      if (typeof hideSuggest === 'function') {
        hideSuggest('ブランド(英語)');
      }

      // その他
      clearField('アイテム名');
      clearField('サイズ');
      clearField('商品の状態');

      console.log('[Reset] 基本情報ブロック完了');
    } catch (error) {
      console.error('[Reset] 基本情報ブロックエラー:', error);
    }
  }

  /**
   * 商品名ブロックをリセット
   */
  function resetProductName() {
    try {
      console.log('[Reset] 商品名ブロック開始');

      // 商品名プレビュー
      clearField('商品名プレビュー');

      // ブランド情報
      clearField('商品名_ブランド(英語)');
      clearField('商品名_ブランド(カナ)');

      // ブランドチェックボックスをチェック状態に
      const brandEnCheckbox = document.getElementById('商品名_ブランド(英語)_チェック');
      const brandKanaCheckbox = document.getElementById('商品名_ブランド(カナ)_チェック');
      if (brandEnCheckbox) brandEnCheckbox.checked = true;
      if (brandKanaCheckbox) brandKanaCheckbox.checked = true;

      // アイテム名
      clearField('商品名_アイテム名');

      // 商品属性（2個目以降を削除）
      resetAttributeSections();

      console.log('[Reset] 商品名ブロック完了');
    } catch (error) {
      console.error('[Reset] 商品名ブロックエラー:', error);
    }
  }

  /**
   * 商品詳細ブロックをリセット
   */
  function resetProductDetails() {
    try {
      console.log('[Reset] 商品詳細ブロック開始');

      // サイズセクション
      resetSizeSection();

      // カラー
      resetColorSections();

      // 素材
      resetMaterialSections();

      // 商品の状態詳細
      clearField('商品状態詳細');

      // AI生成情報
      clearField('AI用商品属性');
      clearField('品番型番');
      resetProductImages();

      console.log('[Reset] 商品詳細ブロック完了');
    } catch (error) {
      console.error('[Reset] 商品詳細ブロックエラー:', error);
    }
  }

  /**
   * 商品説明ブロックをリセット（部分保持）
   * 割引情報とハッシュタグは保持、商品固有情報はクリア
   */
  function resetDescriptionBlock() {
    try {
      console.log('[Reset] 商品説明ブロック開始');

      const descTextarea = document.getElementById('商品の説明');
      if (!descTextarea) return;

      // 割引情報を生成（設定から）
      let discountInfo = '';
      if (typeof generateDiscountInfo === 'function') {
        discountInfo = generateDiscountInfo();
      }

      // ハッシュタグを生成（設定から）
      let hashtagText = '';
      if (typeof generateHashtags === 'function') {
        const hashtags = generateHashtags();
        if (hashtags && hashtags.length > 0) {
          hashtagText = '\n' + hashtags.join('\n');
        }
      }

      // 割引情報とハッシュタグを結合
      let preservedContent = '';
      if (discountInfo) {
        preservedContent += discountInfo;
      }
      if (hashtagText) {
        preservedContent += hashtagText;
      }

      // textareaに設定
      descTextarea.value = preservedContent.trim();

      // テキストエリアの高さを再調整
      if (typeof autoResizeTextarea === 'function') {
        autoResizeTextarea(descTextarea);
      }

      console.log('[Reset] 商品説明ブロック完了（割引情報・ハッシュタグ保持）');
    } catch (error) {
      console.error('[Reset] 商品説明ブロックエラー:', error);
      // エラーが発生しても処理を継続（最悪の場合は空になる）
    }
  }

  /**
   * 仕入・出品情報をリセット
   * デフォルト値以外をクリア（金額フィールドなど）
   */
  function resetProcureListingInfo() {
    try {
      console.log('[Reset] 仕入・出品情報ブロック開始');

      // 仕入情報: 全フィールドをクリア
      clearField('仕入日');
      clearField('仕入先');
      clearField('仕入金額');

      // 出品情報: 全フィールドをクリア
      clearField('出品日');
      clearField('出品先');
      clearField('出品金額');

      console.log('[Reset] 仕入・出品情報ブロック完了');
    } catch (error) {
      console.error('[Reset] 仕入・出品情報ブロックエラー:', error);
    }
  }

  /**
   * デフォルト値を再適用
   */
  function applyDefaultValuesAfterReset() {
    try {
      console.log('[Reset] デフォルト値適用開始');

      // セールスワード（CACHED_CONFIGから読み込み）
      setTimeout(() => {
        if (typeof applyDefaultSalesword === 'function') {
          applyDefaultSalesword();
          console.log('デフォルトセールスワードを再適用しました');
        }
      }, 100);

      // 配送情報
      if (typeof applyShippingDefaults === 'function') {
        applyShippingDefaults();
      }

      // 仕入・出品情報
      if (typeof applyProcureListingDefaults === 'function') {
        applyProcureListingDefaults();
      }

      console.log('[Reset] デフォルト値適用完了');
    } catch (error) {
      console.error('[Reset] デフォルト値適用エラー:', error);
    }
  }

  /**
   * プレビューを更新
   */
  function updateAllPreviewsAfterReset() {
    try {
      console.log('[Reset] プレビュー更新開始');

      // ブランド表示を更新
      if (typeof updateBrandDisplay === 'function') {
        updateBrandDisplay();
      }

      // 商品名プレビュー・商品の説明を更新
      setTimeout(() => {
        if (typeof updateNamePreview === 'function') {
          updateNamePreview();
        }
        if (typeof updateDescriptionFromDetail === 'function') {
          updateDescriptionFromDetail();
        }
      }, 100);

      console.log('[Reset] プレビュー更新完了');
    } catch (error) {
      console.error('[Reset] プレビュー更新エラー:', error);
    }
  }

  /**
   * 商品属性セクションを1つに戻す
   */
  function resetAttributeSections() {
    try {
      const attributeItems = document.querySelectorAll('.attribute-item');
      attributeItems.forEach((item, index) => {
        if (index === 0) {
          // 1個目はクリア
          clearField('商品属性1_カテゴリ');
          clearField('商品属性1_値');
          const valueSelect = document.getElementById('商品属性1_値');
          if (valueSelect) valueSelect.disabled = true;
        } else {
          // 2個目以降は削除
          item.remove();
        }
      });
      if (typeof attributeCount !== 'undefined') attributeCount = 1;
      if (typeof updateAttributeRemoveButtons === 'function') {
        updateAttributeRemoveButtons();
      }
    } catch (error) {
      console.error('[resetAttributeSections] エラー:', error);
    }
  }

  /**
   * カラーセクションを1つに戻す
   */
  function resetColorSections() {
    try {
      const colorItems = document.querySelectorAll('.color-item');
      colorItems.forEach((item, index) => {
        if (index === 0) {
          clearField('カラー1');
        } else {
          item.remove();
        }
      });
      if (typeof colorCount !== 'undefined') colorCount = 1;
      if (typeof updateColorRemoveButtons === 'function') {
        updateColorRemoveButtons();
      }
    } catch (error) {
      console.error('[resetColorSections] エラー:', error);
    }
  }

  /**
   * 素材セクションを1つに戻す（動的行数対応）
   */
  function resetMaterialSections() {
    try {
      const materialItems = document.querySelectorAll('.material-item');
      materialItems.forEach((item, index) => {
        if (index === 0) {
          // 箇所をクリア
          clearField('素材1_箇所');

          // 動的な行数に対応: 全ての種類・割合をクリア
          const composition = item.querySelector('.material-composition');
          if (composition) {
            const rows = composition.querySelectorAll('.composition-row');
            // 最初の行だけ残し、残りは削除
            rows.forEach((row, rowIdx) => {
              if (rowIdx === 0) {
                clearField('素材1_種類1');
                clearField('素材1_％1');
              } else {
                row.remove();
              }
            });
            // 削除ボタン非表示に
            if (typeof updateCompositionRemoveButtons === 'function') {
              updateCompositionRemoveButtons(1);
            }
          }
        } else {
          item.remove();
        }
      });
      if (typeof materialCount !== 'undefined') materialCount = 1;
      if (typeof updateRemoveButtons === 'function') {
        updateRemoveButtons();
      }
    } catch (error) {
      console.error('[resetMaterialSections] エラー:', error);
    }
  }

  /**
   * サイズセクションを非表示に戻す
   */
  function resetSizeSection() {
    try {
      // サイズセクション非表示
      const sizeSection = document.getElementById('sizeSection');
      if (sizeSection) sizeSection.style.display = 'none';

      // アイコン・ラベルを初期状態に
      const sizeIconDisplay = document.getElementById('sizeIconDisplay');
      const sizeLabelDisplay = document.getElementById('sizeLabelDisplay');
      if (sizeIconDisplay) sizeIconDisplay.textContent = '👕';
      if (sizeLabelDisplay) sizeLabelDisplay.textContent = 'サイズ';

      // 全サイズフィールドをクリア
      const sizeHyokiTop = document.getElementById('サイズ(表記)_トップス');
      const sizeHyokiBottom = document.getElementById('サイズ(表記)_ボトムス');
      const sizeHyokiShoes = document.getElementById('サイズ(表記)_靴');
      const otherSizeShoes = document.getElementById('その他のサイズ表記_靴');
      const usualSizeShoes = document.getElementById('普段のサイズ_靴');
      const fitShoes = document.getElementById('フィット感_靴');

      if (sizeHyokiTop) sizeHyokiTop.value = '';
      if (sizeHyokiBottom) sizeHyokiBottom.value = '';
      if (sizeHyokiShoes) sizeHyokiShoes.value = '';
      if (otherSizeShoes) otherSizeShoes.value = '';
      if (usualSizeShoes) usualSizeShoes.value = '';
      if (fitShoes) fitShoes.value = '';

      // サイズフィールド（実寸）
      ['肩幅', '身幅', '袖丈', '着丈', 'ウエスト', 'ヒップ', '股上', '股下'].forEach(id => {
        clearField(id);
      });

      // shoulderWidthLabel を「肩幅」に戻す
      const shoulderLabel = document.getElementById('shoulderWidthLabel');
      if (shoulderLabel) shoulderLabel.textContent = '肩幅';
    } catch (error) {
      console.error('[resetSizeSection] エラー:', error);
    }
  }

  /**
   * 商品画像を全削除
   */
  function resetProductImages() {
    try {
      // グローバル変数をクリア
      if (typeof window.AI_GENERATED_TEXT !== 'undefined') window.AI_GENERATED_TEXT = '';
      if (typeof uploadedImages !== 'undefined') uploadedImages = [];

      // プレビューコンテナを非表示
      const container = document.getElementById('imagePreviewContainer');
      if (container) container.style.display = 'none';

      // ファイル入力をリセット
      const fileInput = document.getElementById('productImages');
      if (fileInput) fileInput.value = '';

      // プレビューを更新
      if (typeof displayImagePreviews === 'function') {
        displayImagePreviews();
      }

      console.log('[Reset] 商品画像をクリア');
    } catch (error) {
      console.error('[resetProductImages] エラー:', error);
    }
  }

  /**
   * フォーム全体をリセット（「次の商品へ」機能）
   * RESET-005: リセット機能の全面改修
   */
  function onReset() {
    try {
      console.log('=== クリア開始 ===');
      // 下書きも削除
      if (typeof prdClearDraft === 'function') prdClearDraft();

      // Phase 1: データクリア
      resetManagementNumber();
      resetBasicInfo();
      resetProductName();
      resetProductDetails();
      resetDescriptionBlock();
      resetProcureListingInfo();

      // Phase 2: デフォルト値再適用
      applyDefaultValuesAfterReset();

      // Phase 3: プレビュー更新
      updateAllPreviewsAfterReset();

      // メッセージをクリア
      if (typeof show === 'function') {
        show('');
      }

      // ハッシュタグ・割引情報のチェックボックスを全てチェック
      document.querySelectorAll('input[id^="hashtag-checkbox-"]').forEach(cb => {
        cb.checked = true;
      });
      document.querySelectorAll('input[id^="discount-checkbox-"]').forEach(cb => {
        cb.checked = true;
      });

      // 折りたたみ状態をリセット（閉じる）
      const hashtagSection = document.getElementById('hashtagSection');
      const hashtagToggle = document.getElementById('hashtagToggle');
      if (hashtagSection && hashtagToggle) {
        hashtagSection.style.display = 'none';
        hashtagToggle.textContent = '▼';
      }

      const discountSection = document.getElementById('discountSection');
      const discountToggle = document.getElementById('discountToggle');
      if (discountSection && discountToggle) {
        discountSection.style.display = 'none';
        discountToggle.textContent = '▼';
      }

      console.log('=== クリア完了 ===');
    } catch (error) {
      console.error('リセット処理エラー:', error);
      alert('リセット処理中にエラーが発生しました。ページを再読み込みしてください。');
    }
  }

  // ==================== 旧リセット機能（バックアップ） ====================
  /**
   * フォーム全体をリセット（旧実装）
   * すべての入力フィールドをクリアし、デフォルト値（配送情報、仕入・出品情報）を再適用
   * 管理番号の配置設定と形式は保持される（ユーザーの運用方針のため）
   * @throws {Error} リセット処理中にエラーが発生した場合
   */
  function onReset_OLD() {
    try {
      console.log('=== リセット開始 ===');

      // 0. AI生成文をクリア
      window.AI_GENERATED_TEXT = '';

      // 0-1. 画像データをクリア
      if (uploadedImages && uploadedImages.length > 0) {
        uploadedImages = [];
        const container = document.getElementById('imagePreviewContainer');
        if (container) {
          container.style.display = 'none';
        }
        // ファイル入力もリセット
        const fileInput = document.getElementById('productImages');
        if (fileInput) {
          fileInput.value = '';
        }
        console.log('画像データをクリアしました');
      }

      // 1. すべての入力フィールドをクリア
      FIELD_IDS.forEach(k=>{
        const el=document.getElementById(k);
        if(el) {
          el.value='';
          console.log(`クリア: ${k}`);
        }
      });

    // 2. カテゴリプルダウンをリセット
    ['中分類(カテゴリ)','小分類(カテゴリ)','細分類(カテゴリ)','細分類2'].forEach(id=> resetSelect(id, true));
    const l1 = document.getElementById('大分類(カテゴリ)');
    if (l1) l1.value='';

    // 細分類行を非表示
    const saibunruiRow = document.getElementById('saibunruiRow');
    if (saibunruiRow) saibunruiRow.style.display = 'none';

    // 3. その他のフィールドをクリア
    ['サイズ','商品の状態','アイテム名','商品名_アイテム名',
     '商品属性1_カテゴリ','商品属性1_値','商品属性2_カテゴリ','商品属性2_値',
     '商品属性3_カテゴリ','商品属性3_値']
    .forEach(id=>{
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    // 4. セールスワードをリセット
    try {
      resetKeywordDropdown();
      const categorySelect = document.getElementById('セールスワード(カテゴリ)');
      if (categorySelect) categorySelect.value = '';

      // デフォルトセールスワードを再適用（CACHED_CONFIGから読み込み）
      setTimeout(() => {
        applyDefaultSalesword();
        console.log('デフォルトセールスワードを再適用しました');
      }, 100);
    } catch (error) {
      console.error('セールスワードリセットエラー:', error);
    }

    // 5. 商品状態(詳細)をリセット
    const detailInput = document.getElementById('商品状態詳細');
    if (detailInput) detailInput.value = '';

    // 6. 素材フィールドをリセット
    const materialItems = document.querySelectorAll('.material-item');
    materialItems.forEach((item, index) => {
      if (index === 0) {
        const locationSelect = item.querySelector(`#素材1_箇所`);
        const type1Select = item.querySelector(`#素材1_種類1`);
        const percent1Input = item.querySelector(`#素材1_％1`);
        const type2Select = item.querySelector(`#素材1_種類2`);
        const percent2Input = item.querySelector(`#素材1_％2`);
        if (locationSelect) locationSelect.value = '';
        if (type1Select) type1Select.value = '';
        if (percent1Input) percent1Input.value = '';
        if (type2Select) type2Select.value = '';
        if (percent2Input) percent2Input.value = '';
      } else {
        item.remove();
      }
    });
    materialCount = 1;
    updateRemoveButtons();

    // 6.5. カラーフィールドをリセット
    const colorItems = document.querySelectorAll('.color-item');
    colorItems.forEach((item, index) => {
      if (index === 0) {
        const colorSelect = item.querySelector(`#カラー1`);
        if (colorSelect) colorSelect.value = '';
      } else {
        item.remove();
      }
    });
    colorCount = 1;
    updateColorRemoveButtons();

    // 6.6. 商品属性フィールドをリセット
    const attributeItems = document.querySelectorAll('.attribute-item');
    attributeItems.forEach((item, index) => {
      if (index === 0) {
        // 1個目はフィールドをクリア
        const categorySelect = item.querySelector(`#商品属性1_カテゴリ`);
        const valueSelect = item.querySelector(`#商品属性1_値`);
        if (categorySelect) categorySelect.value = '';
        if (valueSelect) {
          valueSelect.value = '';
          valueSelect.disabled = true;
        }
      } else {
        // 2個目以降は削除
        item.remove();
      }
    });
    attributeCount = 1;
    updateAttributeRemoveButtons();
    updateAttributeFields();

    // 6.7. AI用商品属性をクリア
    const aiAttributesField = document.getElementById('AI用商品属性');
    if (aiAttributesField) aiAttributesField.value = '';

    // 6.8. 品番・型番をクリア
    const modelNumberField = document.getElementById('品番型番');
    if (modelNumberField) modelNumberField.value = '';

    // 7. サイズ関連をリセット
    const shoulderLabel = document.getElementById('shoulderWidthLabel');
    if (shoulderLabel) shoulderLabel.textContent = '肩幅';

    const sizeHyokiTop = document.getElementById('サイズ(表記)_トップス');
    const sizeHyokiBottom = document.getElementById('サイズ(表記)_ボトムス');
    const sizeHyokiShoes = document.getElementById('サイズ(表記)_靴');
    const otherSizeShoes = document.getElementById('その他のサイズ表記_靴');
    const usualSizeShoes = document.getElementById('普段のサイズ_靴');
    const fitShoes = document.getElementById('フィット感_靴');

    if (sizeHyokiTop) sizeHyokiTop.value = '';
    if (sizeHyokiBottom) sizeHyokiBottom.value = '';
    if (sizeHyokiShoes) sizeHyokiShoes.value = '';
    if (otherSizeShoes) otherSizeShoes.value = '';
    if (usualSizeShoes) usualSizeShoes.value = '';
    if (fitShoes) fitShoes.value = '';

    const sizeSection = document.getElementById('sizeSection');
    if (sizeSection) sizeSection.style.display = 'none';

    const sizeIconDisplay = document.getElementById('sizeIconDisplay');
    const sizeLabelDisplay = document.getElementById('sizeLabelDisplay');
    if (sizeIconDisplay) sizeIconDisplay.textContent = '👕';
    if (sizeLabelDisplay) sizeLabelDisplay.textContent = 'サイズ';

    // 8. 配送デフォルトを適用
    applyShippingDefaults();

    // 8-2. 仕入・出品デフォルトを適用
    applyProcureListingDefaults();

    // 9. 管理番号関連をリセット
    const p1 = document.getElementById('prefix1');
    if (p1) {
      p1.value = '';
      console.log('prefix1をクリアしました');
    }
    const shelfField = document.getElementById('棚番号');
    if (shelfField) {
      shelfField.value = '';
      console.log('棚番号をクリアしました');
    }

    // 動的に生成される管理番号フィールドをクリア
    const mgmtShelfFirst = document.getElementById('mgmt_shelf_first');
    const mgmtShelfSecond = document.getElementById('mgmt_shelf_second');
    const mgmtCustomFirst = document.getElementById('mgmt_custom_first');
    const mgmtCustomSecond = document.getElementById('mgmt_custom_second');
    if (mgmtShelfFirst) mgmtShelfFirst.value = '';
    if (mgmtShelfSecond) mgmtShelfSecond.value = '';
    if (mgmtCustomFirst) mgmtCustomFirst.value = '';
    if (mgmtCustomSecond) mgmtCustomSecond.value = '';

    // 管理番号プレビューをクリア
    const mgmtNumberField = document.getElementById('管理番号');
    if (mgmtNumberField) mgmtNumberField.value = '';

    // 管理番号の配置チェックボックスと形式は保持（ユーザーの好みなので）

    // buildShelf()を呼ぶと値が戻されるのでコメントアウト
    // buildShelf();

    // 10. ブランドフィールドをクリア
    const brandEnBasic = document.getElementById('ブランド(英語)');
    if (brandEnBasic) brandEnBasic.value = '';

    const brandEn = document.getElementById('商品名_ブランド(英語)');
    const brandKana = document.getElementById('商品名_ブランド(カナ)');
    if (brandEn) brandEn.value = '';
    if (brandKana) brandKana.value = '';

    // ブランドチェックボックスをチェック状態に戻す
    const brandEnCheckbox = document.getElementById('商品名_ブランド(英語)_チェック');
    const brandKanaCheckbox = document.getElementById('商品名_ブランド(カナ)_チェック');
    if (brandEnCheckbox) brandEnCheckbox.checked = true;
    if (brandKanaCheckbox) brandKanaCheckbox.checked = true;

    hideSuggest('ブランド(英語)');
    hideSuggest('商品名_ブランド(英語)');
    hideSuggest('商品名_ブランド(カナ)');

    // 11. プレビューをリセット
    const namePreview = document.getElementById('商品名プレビュー');
    if (namePreview) {
      namePreview.value = '';
      console.log('商品名プレビューをクリア');
    }

    const descPreview = document.getElementById('商品の説明');
    if (descPreview) {
      descPreview.value = '';
      console.log('商品の説明をクリア（後でデフォルト値復活）');
    }

    // 12. メッセージをクリア
    show('');

    // 13. ハッシュタグ・割引情報のチェックボックスを全てチェック
    document.querySelectorAll('input[id^="hashtag-checkbox-"]').forEach(cb => {
      cb.checked = true;
    });
    document.querySelectorAll('input[id^="discount-checkbox-"]').forEach(cb => {
      cb.checked = true;
    });

    // 14. 折りたたみ状態をリセット（閉じる）
    const hashtagSection = document.getElementById('hashtagSection');
    const hashtagToggle = document.getElementById('hashtagToggle');
    if (hashtagSection && hashtagToggle) {
      hashtagSection.style.display = 'none';
      hashtagToggle.textContent = '▼';
    }

    const discountSection = document.getElementById('discountSection');
    const discountToggle = document.getElementById('discountToggle');
    if (discountSection && discountToggle) {
      discountSection.style.display = 'none';
      discountToggle.textContent = '▼';
    }

    // 15. プレビューを再構築（商品名は空、商品の説明はデフォルト値）
    console.log('ブランド表示を更新');
    updateBrandDisplay(); // ブランド情報をクリア

    console.log('商品名プレビュー再構築');
    // updateBrandDisplay()が非同期なので、少し待ってから商品名プレビューを更新
    setTimeout(() => {
      updateNamePreview();
      console.log('商品の説明デフォルト値復活');
      updateDescriptionFromDetail();
    }, 100);

    // 16. 画像をクリア
    uploadedImages = [];
    const imageInput = document.getElementById('productImages');
    if (imageInput) imageInput.value = '';
    displayImagePreviews();
    console.log('画像をクリア');

      console.log('=== リセット完了 ===');
    } catch (error) {
      console.error('リセット処理エラー:', error);
      debug.error('onReset エラー:', error);
      alert('リセット処理中にエラーが発生しました。ページを再読み込みしてください。');
    }
  }

  // クリップボードにコピー
  function copyToClipboard(fieldId, buttonId) {
    const field = document.getElementById(fieldId);

    if (!field || !field.value.trim()) {
      alert('コピーする内容がありません');
      return;
    }

    // クリップボードにコピー
    navigator.clipboard.writeText(field.value).then(function() {
      // トースト通知を表示
      showCopyToast();
    }).catch(function(err) {
      console.error('クリップボードへのコピーに失敗しました:', err);
      alert('コピーに失敗しました。ブラウザの設定を確認してください。');
    });
  }

  // コピー完了トースト表示
  function showCopyToast() {
    // 既存のトーストがあれば削除
    const existingToast = document.getElementById('copyToast');
    if (existingToast) {
      existingToast.remove();
    }

    // トースト要素を作成
    const toast = document.createElement('div');
    toast.id = 'copyToast';
    toast.className = 'copy-toast';
    toast.innerHTML = '<i class="bi bi-check-circle"></i> コピーしました';
    document.body.appendChild(toast);

    // 表示アニメーション
    setTimeout(() => toast.classList.add('show'), 10);

    // 1.5秒後にフェードアウトして削除
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 1500);
  }

  // テキストエリアの高さを自動調整
  function autoResizeTextarea(textarea) {
    if (!textarea) return;

    // DOMの更新を待ってから実行
    setTimeout(function() {
      console.log('autoResizeTextarea 実行開始');
      console.log('現在の値の長さ:', textarea.value.length);
      console.log('現在の高さ:', textarea.style.height);

      // 一旦高さをリセットしてscrollHeightを正しく取得
      textarea.style.height = 'auto';

      // scrollHeightを取得
      const scrollHeight = textarea.scrollHeight;
      console.log('scrollHeight:', scrollHeight);

      // scrollHeightに基づいて高さを設定（padding + border分を考慮）
      const newHeight = Math.max(120, scrollHeight + 10);
      textarea.style.height = newHeight + 'px';

      console.log('新しい高さ:', newHeight + 'px');
    }, 50);
  }

  function show(t) {
    const el=document.getElementById('msg');
    if (el) el.textContent = t;
  }

  function unifyConditionList(list) {
    const arr = (list||[]).map(v => (v??'').toString().trim()).filter(v=>v);
    const hasCombined = arr.includes('新品、未使用');
    const idxNew = arr.indexOf('新品');
    const idxUnused = arr.indexOf('未使用');
    if (hasCombined && idxNew === -1 && idxUnused === -1) return arr;
    const earliest = Math.min(
      idxNew === -1 ? Infinity : idxNew,
      idxUnused === -1 ? Infinity : idxUnused
    );
    const out = [];
    let combinedInserted = false;
    for (let i=0; i<arr.length; i++) {
      const v = arr[i];
      if (i === earliest && (idxNew !== -1 || idxUnused !== -1)) {
        if (!combinedInserted) {
          out.push('新品、未使用');
          combinedInserted = true;
        }
        continue;
      }
      if (v === '新品' || v === '未使用') continue;
      if (v === '新品、未使用') {
        if (!combinedInserted) {
          out.push(v);
          combinedInserted = true;
        }
        continue;
      }
      out.push(v);
    }
    if (!combinedInserted && (idxNew !== -1 || idxUnused !== -1)) out.unshift('新品、未使用');
    return out;
  }

  /**
   * ひらがなをカタカナに変換（スマホ対応）
   * 例: "ないき" → "ナイキ"
   */
  function hiraganaToKatakana(str) {
    return str.replace(/[\u3041-\u3096]/g, function(match) {
      var chr = match.charCodeAt(0) + 0x60;
      return String.fromCharCode(chr);
    });
  }

  function attachBrandSuggest(inputId, list) {
    console.log(`attachBrandSuggest called for ${inputId} with list length:`, list ? list.length : 'undefined');
    const input = document.getElementById(inputId);
    const panel = document.getElementById('suggest-' + inputId);
    if (!input || !panel) {
      console.log(`Missing elements for ${inputId}: input=${!!input}, panel=${!!panel}`);
      return;
    }
    let activeIndex = -1;
    const limit = 15;
    const render = (items) => {
      panel.innerHTML = '';

      // 入力欄の画面位置を取得して、候補リストを上/下どちらに表示するか決定
      const inputRect = input.getBoundingClientRect();
      const screenHeight = window.innerHeight;
      const isInLowerHalf = inputRect.top > screenHeight * 0.5;

      // 画面の下半分にある場合は候補を上に表示
      if (isInLowerHalf) {
        panel.classList.add('suggest-above');
      } else {
        panel.classList.remove('suggest-above');
      }

      if (!items.length) {
        panel.innerHTML = '<div class="sug-empty">候補なし</div>';
        panel.hidden = false;
        return;
      }

      // ブランド入力フィールドかどうかを判定
      const isBrandField = inputId === 'ブランド(英語)' || inputId === '商品名_ブランド(英語)';

      items.slice(0, limit).forEach((v, i)=>{
        const div = document.createElement('div');

if (isBrandField) {
            // ブランド(英語)の場合は2行表示
            div.className = 'sug-item brand-item';

            const englishName = v;
            // ペアデータから正確なカナ読みを取得
            const pairIndex = BRAND_INDEX_MAP.get(englishName);
            const kanaName = pairIndex !== undefined && BRAND_PAIRS[pairIndex] ? BRAND_PAIRS[pairIndex].kana : '';

            const escapedEnglishName = String(englishName).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g,
  '&gt;').replace(/"/g, '&quot;');
            const escapedKanaName = String(kanaName).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g,
  '&gt;').replace(/"/g, '&quot;');

            div.innerHTML = `
              <div class="brand-english">${escapedEnglishName}</div>
              <div class="brand-kana">${escapedKanaName}</div>
            `;
          } else {
          // その他のフィールドは従来通り1行表示
          div.className = 'sug-item';
          div.textContent = v;
        }

        div.addEventListener('mousemove', ()=> {
          Array.from(panel.querySelectorAll('.sug-item')).forEach(x=> x.classList.remove('active'));
          div.classList.add('active');
          activeIndex = i;
        });
        div.addEventListener('mousedown', (e)=> {
          e.preventDefault();
        });
        div.addEventListener('click', ()=> {
            // ブランド(英語)の2行表示の場合は英語名のみを取得
            if ((inputId === 'ブランド(英語)' || inputId === '商品名_ブランド(英語)') &&
  div.classList.contains('brand-item')) {
              const englishDiv = div.querySelector('.brand-english');
              input.value = englishDiv ? englishDiv.textContent : '';
            } else {
              input.value = v;
            }
            hide();
            // 基本情報のブランド(英語)選択時は、先に商品名ブロックに反映してから商品名プレビューを更新
            if (inputId === 'ブランド(英語)') {
              updateBrandDisplay();
              updateNamePreview();
              updateDescriptionFromDetail();
            } else {
              updateNamePreview();
              updateDescriptionFromDetail();
            }
          });
        panel.appendChild(div);
      });
      panel.hidden = false;
    };
    const hide = ()=>{
      panel.hidden = true;
      activeIndex = -1;
    };
    const hideLater = ()=> setTimeout(hide, 100);
    const doFilter = ()=>{
      let q = (input.value || '').trim();

      // ひらがなをカタカナに変換（スマホ対応）
      // 例: "ないき" → "ナイキ"
      if (inputId === 'ブランド(英語)' || inputId === '商品名_ブランド(英語)') {
        q = hiraganaToKatakana(q);
      }

      // デバッグ用ログ
      console.log(`doFilter called for ${inputId}, query: "${q}", list length: ${list ? list.length : 'undefined'}`);

      // リストが存在しない場合は何もしない
      if (!Array.isArray(list) || list.length === 0) {
        console.log(`No data available for ${inputId}`);
        hide();
        return;
      }

      if (!q) {
        hide();
        return;
      }

      // 短すぎる検索文字列の場合は処理を制限（パフォーマンス向上）
      if (inputId === 'ブランド(英語)' && q.length < 2 && list.length > 10000) {
        hide();
        return;
      }

      let filtered;

if (inputId === '商品名_ブランド(英語)' || inputId === 'ブランド(英語)') {
        // ブランド(英語)の場合は英語名とカナ読み両方で検索（ペアデータ使用）
        const qq = q.toLowerCase();
        filtered = list.filter(v=>{
          const englishName = String(v).toLowerCase();

          // 完全一致検索
          if (englishName.indexOf(qq) !== -1) {
            return true;
          }

          // 単語境界での部分一致検索（スペース区切り）
          const words = englishName.split(/\s+/);
          if (words.some(word => word.startsWith(qq))) {
            return true;
          }

          // カナ読み検索（ペアデータから正確に取得）
          const pairIndex = BRAND_INDEX_MAP.get(v);
          if (pairIndex !== undefined && BRAND_PAIRS[pairIndex]) {
            const kanaName = String(BRAND_PAIRS[pairIndex].kana || '').toLowerCase();

            // カナ読み完全一致
            if (kanaName.indexOf(qq) !== -1) {
              return true;
            }

            // カナ読み単語境界での部分一致
            const kanaWords = kanaName.split(/[\s・]+/);
            if (kanaWords.some(word => word.startsWith(qq))) {
              return true;
            }
          }

          return false;
        });
        } else if (inputId === 'ブランド(英語)') {
          // 基本情報ブランド(英語)の場合も同様の柔軟検索
          const qq = q.toLowerCase();
          filtered = list.filter(v=>{
            const englishName = String(v).toLowerCase();

            // 完全一致検索
            if (englishName.indexOf(qq) !== -1) {
              return true;
            }

            // 単語境界での部分一致検索（スペース区切り）
            const words = englishName.split(/\s+/);
            if (words.some(word => word.startsWith(qq))) {
              return true;
            }

            // カナ読み検索（ペアデータから正確に取得）
            const pairIndex = BRAND_INDEX_MAP.get(v);
            if (pairIndex !== undefined && BRAND_PAIRS[pairIndex]) {
              const kanaName = String(BRAND_PAIRS[pairIndex].kana || '').toLowerCase();

              // カナ読み完全一致
              if (kanaName.indexOf(qq) !== -1) {
                return true;
              }

              // カナ読み単語境界での部分一致
              const kanaWords = kanaName.split(/[\s・]+/);
              if (kanaWords.some(word => word.startsWith(qq))) {
                return true;
              }
            }

            return false;
          });
        } else {
          // その他のフィールドは従来通り（case-insensitive対応）
          const qq = q.toLowerCase();
          filtered = list.filter(v=>{
            const s = String(v).toLowerCase();
            return s.indexOf(qq) !== -1;
          });
        }

      console.log(`Filtered results for ${inputId}: ${filtered.length} items`);
      render(filtered);
    };
    input.addEventListener('input', () => {
      doFilter();
      // 商品名ブロックのブランドフィールドの場合、常にプレビューを更新（空の場合も含む）
      if (inputId === '商品名_ブランド(英語)' || inputId === '商品名_ブランド(カナ)') {
        updateNamePreview();
      }
    });
    input.addEventListener('focus', () => {
      doFilter();

      // ブランドフィールドの場合、候補リストが見えるように自動スクロール
      if (inputId === 'ブランド(英語)' || inputId === '商品名_ブランド(英語)') {
        // iOSキーボード対応：複数回のスクロール試行
        const scrollInputToTop = () => {
          // scrollIntoViewを使用（iOSでより確実に動作）
          input.scrollIntoView({ behavior: 'smooth', block: 'start' });

          // 親フレームでも同様にスクロール
          try {
            if (window.parent && window.parent !== window) {
              // 親フレーム内での入力位置を取得
              const inputRect = input.getBoundingClientRect();
              const iframeRect = window.frameElement ? window.frameElement.getBoundingClientRect() : { top: 0 };
              const absoluteTop = iframeRect.top + inputRect.top;

              // 入力欄を画面上部に移動（100pxの余白を確保）
              const targetScrollTop = window.parent.scrollY + absoluteTop - 100;
              window.parent.scrollTo({ top: targetScrollTop, behavior: 'smooth' });
            }
          } catch (e) {
            // cross-origin の場合は無視
          }
        };

        // キーボードアニメーション完了を待って複数回試行
        setTimeout(scrollInputToTop, 100);
        setTimeout(scrollInputToTop, 300);
        setTimeout(scrollInputToTop, 500);
      }
    });
    input.addEventListener('blur', hideLater);
    input.addEventListener('keydown', (e)=>{
      if (panel.hidden) return;
      const items = Array.from(panel.querySelectorAll('.sug-item'));
      if (!items.length) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        activeIndex = (activeIndex + 1) % items.length;
        items.forEach(x=>x.classList.remove('active'));
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block:'nearest' });
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items.forEach(x=>x.classList.remove('active'));
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block:'nearest' });
      } else if (e.key === 'Enter') {
        if (activeIndex >= 0) {
          e.preventDefault();
          const selectedItem = items[activeIndex];

          // ブランド(英語)の2行表示の場合は英語名のみを取得
          if ((inputId === 'ブランド(英語)' || inputId === '商品名_ブランド(英語)') &&
  selectedItem.classList.contains('brand-item')) {
            const englishDiv = selectedItem.querySelector('.brand-english');
            input.value = englishDiv ? englishDiv.textContent : '';
          } else {
            input.value = selectedItem.textContent || '';
          }

          hide();
          updateNamePreview();

          // ブランド(英語)の場合は追加の更新処理
          if (inputId === 'ブランド(英語)') {
            updateBrandDisplay();
            updateDescriptionFromDetail();
          }
        }
      } else if (e.key === 'Escape') {
        hide();
      }
    });
    function hideExternal() {
      hide();
    }
    input._hideSuggest = hideExternal;
  }

  function hideSuggest(inputId) {
    const input = document.getElementById(inputId);
    if (input && input._hideSuggest) input._hideSuggest();
  }

  // ================= 初期化処理 =================
  function initManagementNumberSystem() {
    console.log('🚀 管理番号システム初期化開始');
    // 頭文字・棚番号プルダウンを初期化
    initPrefix1();
      buildShelf();
      const p1 = document.getElementById('prefix1');
    if (p1) {
      p1.addEventListener('change', buildShelf);
        } else {
      console.log('❌ prefix1 フィールドが見つかりません');
    }
    const sh = document.getElementById('棚番号');
    if (sh) {
      sh.addEventListener('change', requestNextManagementNumber);
        } else {
      console.log('❌ 棚番号 フィールドが見つかりません');
    }
  }

  // DOMContentLoaded後に初期化を実行
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initManagementNumberSystem);
  } else {
    // すでにDOMが読み込まれている場合は即座に実行
    initManagementNumberSystem();
  }

  // カテゴリマスタ読み込みは即座実行（非同期なのでOK）
  (async function() {

    // カテゴリマスタ取得（PWA版：Firestoreから直接取得）
    (async function loadCategoryMaster() {
      try {
        // 1. localStorageキャッシュから即座に読み込み
        var cachedCatRows = localStorage.getItem('rebornCache_categoryMaster');
        if (cachedCatRows) {
          try {
            CAT_ROWS = JSON.parse(cachedCatRows);
            console.log('⚡ カテゴリマスタをキャッシュから即座に読み込み:', CAT_ROWS.length + '件');
          } catch (e) { /* パースエラーは無視 */ }
        }

        // 2. Firestoreからバックグラウンド取得
        if (window.db) {
          try {
            const db = window.db;
            const docRef = db.collection('categories').doc('master');
            const docSnap = await docRef.get();
            if (docSnap.exists) {
              const data = docSnap.data();
              const rows = data.rows || [];
              CAT_ROWS = rows.map(r=>({
                特大分類:String(r.特大分類||'').trim(),
                大分類:String(r.大分類||'').trim(),
                中分類:String(r.中分類||'').trim(),
                小分類:String(r.小分類||'').trim(),
                細分類:String(r.細分類||'').trim(),
                細分類2:String(r.細分類2||'').trim(),
                アイテム名:String(r.アイテム名||'').trim(),
              }));
              // キャッシュ更新
              localStorage.setItem('rebornCache_categoryMaster', JSON.stringify(CAT_ROWS));
              console.log('✅ カテゴリマスタをFirestoreから更新:', CAT_ROWS.length + '件');
            }
          } catch (firestoreErr) {
            console.warn('⚠️ Firestoreカテゴリ読み込み失敗（キャッシュを使用）:', firestoreErr.message);
          }
        }

        if (!CAT_ROWS || CAT_ROWS.length === 0) {
          console.warn('⚠️ カテゴリマスタが空です');
        }

        // 特大分類をマスタデータから動的生成
        const l0Select = document.getElementById('特大分類');
        if (l0Select && CAT_ROWS.length > 0) {
          const l0Values = uniqKeepOrder(CAT_ROWS.map(r => r.特大分類).filter(Boolean));
          fillSelectSafe(l0Select, l0Values);
          console.log('✅ 特大分類をマスタから動的生成:', l0Values.length + '件');
        }

        // カテゴリプルダウンのイベントリスナーを設定
        const l1Select = document.getElementById('大分類(カテゴリ)');
        const l2Select = document.getElementById('中分類(カテゴリ)');
        const l3Select = document.getElementById('小分類(カテゴリ)');
        const l4Select = document.getElementById('細分類(カテゴリ)');
        const l5Select = document.getElementById('細分類2');
        const itemSelect = document.getElementById('アイテム名');
        if (l0Select) {
          l0Select.addEventListener('change', onL0Changed);
          debug.log('特大分類のイベントリスナーを設定しました');
        }
        if (l1Select) {
          l1Select.addEventListener('change', onL1Changed);
          debug.log('大分類のイベントリスナーを設定しました');
        }
        if (l2Select) {
          l2Select.addEventListener('change', onL2Changed);
          debug.log('中分類のイベントリスナーを設定しました');
        }
        if (l3Select) {
          l3Select.addEventListener('change', onL3Changed);
          debug.log('小分類のイベントリスナーを設定しました');
        }
        if (l4Select) l4Select.addEventListener('change', onL4Changed);
        if (l5Select) l5Select.addEventListener('change', onL5Changed);
        if (itemSelect) itemSelect.addEventListener('change', updateItemNameDisplay);

        // 基本情報のサイズプルダウンのイベントリスナーを設定（商品の説明ブロックに連動）
        const sizeSelect = document.getElementById('サイズ');
        if (sizeSelect) {
          sizeSelect.addEventListener('change', syncBasicSizeToDescription);
          debug.log('サイズプルダウンのイベントリスナーを設定しました');
        }

        wirePreviewWatchers();
        updateNamePreview();
        adjustPreviewHeight();

        console.log('✅ カテゴリマスタ読み込み完了:', CAT_ROWS.length + '件');
      } catch (error) {
        console.error('❌ カテゴリマスタ読み込みエラー:', error);
        show(`NG(MASTER): ${error && error.message ? error.message : error}`);
      }
    })(); // 即座実行

    // マスタオプション取得（PWA版：Firestoreから直接取得）
    (async function loadMasterOptions() {
      try {
        var opts = {};

        // 1. localStorageキャッシュから即座に読み込み
        var cachedOpts = localStorage.getItem('rebornCache_masterOptions');
        if (cachedOpts) {
          try {
            opts = JSON.parse(cachedOpts);
            MASTER_OPTIONS = opts;
            console.log('⚡ マスタオプションをキャッシュから即座に読み込み:', Object.keys(opts).length + 'フィールド');
          } catch (e) { /* パースエラーは無視 */ }
        }

        // 2. Firestoreからバックグラウンド取得
        if (window.db) {
          try {
            const db = window.db;
            const snapshot = await db.collection('masterOptions').get();
            if (!snapshot.empty) {
              var freshOpts = {};
              snapshot.forEach(doc => {
                const data = doc.data();
                if (doc.id !== '_index' && data.fieldName && data.items) {
                  freshOpts[data.fieldName] = data.items;
                }
              });
              if (Object.keys(freshOpts).length > 0) {
                opts = freshOpts;
                MASTER_OPTIONS = opts;
                localStorage.setItem('rebornCache_masterOptions', JSON.stringify(opts));
                console.log('✅ マスタオプションをFirestoreから更新:', Object.keys(opts).length + 'フィールド');
              }
            }
          } catch (firestoreErr) {
            console.warn('⚠️ Firestoreマスタオプション読み込み失敗（キャッシュを使用）:', firestoreErr.message);
          }
        }

        if (Object.keys(opts).length === 0) {
          console.warn('⚠️ マスタオプションが空です');
          return;
        }

        // マスターオプションをグローバル変数に保存
        MASTER_OPTIONS = opts;

        const fillSel=(id,arr)=>{
          const sel=document.getElementById(id);
          if(!sel) return;
          sel.innerHTML='<option value="">--選択してください--</option>';
          (arr||[]).forEach(v=> sel.insertAdjacentHTML('beforeend', `<option value="${v}">${v}</option>`));
        };

        // 基本フィールド
        fillSel('担当者', opts['担当者']||[]);
        fillSel('仕入先', opts['仕入先']||[]);
        fillSel('生地・素材・質感系', opts['生地・素材・質感系']||[]);
        fillSel('サイズ', opts['サイズ']||[]);
        fillSel('商品の状態', unifyConditionList(opts['商品の状態']||[]));

        // サイズ(表記)の選択肢を設定
        fillSel('サイズ(表記)_トップス', opts['サイズ(表記)']||[]);
        fillSel('サイズ(表記)_ボトムス', opts['サイズ(表記)']||[]);

        // ブランドデータ（Firestore版に移行）
        // モジュール読み込み完了を待ってからAlgolia版ブランド検索を初期化
        const initAlgoliaBrandSearch = () => {
          if (typeof window.attachBrandSuggestAlgolia === 'function') {
            console.log('🔍 Algolia版ブランド検索を初期化');

            // 基本情報ブロックのブランド(英語)フィールド
            window.attachBrandSuggestAlgolia('ブランド(英語)', {
              limit: 15,
              minChars: 1,
              debounceMs: 300
            });

            // 商品名ブロックのブランド(英語)フィールド
            window.attachBrandSuggestAlgolia('商品名_ブランド(英語)', {
              limit: 15,
              minChars: 1,
              debounceMs: 300
            });

                    } else {
            console.warn('⏳ Algoliaモジュール読み込み中... 1秒後に再試行');
            setTimeout(initAlgoliaBrandSearch, 1000);
          }
        };

        // モジュール読み込み完了を待機
        if (window.algoliaBrandModulesLoaded) {
          initAlgoliaBrandSearch();
        } else {
          // 読み込み完了を監視
          const checkInterval = setInterval(() => {
            if (window.algoliaBrandModulesLoaded) {
              clearInterval(checkInterval);
              initAlgoliaBrandSearch();
            }
          }, 100);
        }

        // タイトル情報フィールド
        [
          '季節感・機能性','着用シーン・イベント','見た目・印象','トレンド表現',
          'サイズ感・体型カバー','年代・テイスト・スタイル','カラー/配色/トーン','柄・模様',
          'ディテール・仕様','シルエット/ライン','ネックライン','襟・衿',
          '袖・袖付け','丈','革/加工','毛皮/加工','生産国'
        ].forEach(name => fillSel(name, opts[name]||[]));

        // 出品・配送関連
        fillSel('出品先', opts['出品先']||[]);
        fillSel('配送料の負担', opts['配送料の負担']||[]);
        fillSel('配送の方法', opts['配送の方法']||[]);
        fillSel('発送元の地域', opts['発送元の地域']||[]);
        fillSel('発送までの日数', opts['発送までの日数']||[]);

        // ランクマスタを読み込み
        loadRankOptions();

        applyShippingDefaults();
        applyProcureListingDefaults();

        // サイズ・商品の状態などのイベントリスナーを設定
        const sizeSelect = document.getElementById('サイズ');
        if (sizeSelect) {
          sizeSelect.removeEventListener('change', updateNamePreview);
          sizeSelect.addEventListener('change', updateNamePreview);
          console.log('サイズプルダウンのイベントリスナー設定完了');
        }

        const conditionSelect = document.getElementById('商品の状態');
        if (conditionSelect) {
          conditionSelect.removeEventListener('change', updateDescriptionFromDetail);
          conditionSelect.addEventListener('change', updateDescriptionFromDetail);
          conditionSelect.removeEventListener('change', updateConditionButtons);
          conditionSelect.addEventListener('change', updateConditionButtons);
          console.log('商品の状態プルダウンのイベントリスナー設定完了');
        }

        const staffSelect = document.getElementById('担当者');
        if (staffSelect) {
          staffSelect.removeEventListener('change', updateNamePreview);
          staffSelect.addEventListener('change', updateNamePreview);
          console.log('担当者プルダウンのイベントリスナー設定完了');
        }

        // グローバルにマスターオプションを保存（階層式セレクター用）
        window.globalMasterOptions = opts;

        // カラー・素材マスタ初期化（Firestoreデータ読み込み完了後に実行）
        initializeColorMasters();
        initializeMaterialMasters();

        // カラー検索機能をセットアップ（COLOR_OPTIONS設定後）
        setupColorSearch();

        wirePreviewWatchers();
        updateNamePreview();
        adjustPreviewHeight();

            } catch (error) {
        console.error('❌ マスタオプション読み込みエラー:', error);
        show(`NG(MASTER): ${error && error.message ? error.message : error}`);
      }
    })(); // 即座実行

// 階層式商品属性セレクター設定
  setupAttributeSelectors();

  // 動的サイズシステム設定
  setupSizeSystem();

    // 設定マスタ全体を読み込み（配置順序を含む）
    // ⚠️ 重要: initializeSalesWords() より先に実行すること
    // CACHED_CONFIGにセールスワード表示形式が設定された後でないと
    // SALESWORD_FORMAT変数が正しく初期化されない
    await loadAllConfig();

    // セールスワード専用初期化（loadAllConfig後に実行）
    initializeSalesWords();

    // 設定マスタから商品状態ボタンを読み込み
    loadConditionButtonsFromConfig();

    // 設定マスタからハッシュタグ設定を読み込み
    loadHashtagConfig();

    // 設定マスタから割引情報を読み込み
    loadDiscountConfig();

    // 設定マスタから配送デフォルトを読み込み
    await loadShippingDefaults();

    // 設定マスタから仕入・出品デフォルトを読み込み
    await loadProcureListingDefaults();

    // 担当者名を読み込み（PropertiesService）
    loadOperatorName();

    // 設定マスタから商品名ブロック並び順を読み込み
    loadTitleBlockOrder();

    // イベントリスナー設定
    const l1=document.getElementById('大分類(カテゴリ)');
    if (l1) l1.addEventListener('change', onL1Changed);
    const l2=document.getElementById('中分類(カテゴリ)');
    if (l2) l2.addEventListener('change', onL2Changed);
    const l3=document.getElementById('小分類(カテゴリ)');
    if (l3) l3.addEventListener('change', onL3Changed);
    const l4=document.getElementById('細分類(カテゴリ)');
    if (l4) l4.addEventListener('change', onL4Changed);
    const l5=document.getElementById('細分類2');
    if (l5) l5.addEventListener('change', onL5Changed);
    const itemName=document.getElementById('アイテム名');
    if (itemName) itemName.addEventListener('change', updateItemNameDisplay);

    // セールスワード専用イベント設定
    setupSalesWordEventListeners();

    wireDescWatcher();

    // 初期ロード時にテキストエリアの高さを調整
    updateDesc();

    // 商品状態(詳細)イベントリスナー設定を追加
    setupDetailEventListener();

    // クイック挿入ボタン設定
    setupQuickInsertButtons();

    // 素材・カラーマスターデータ初期化は loadMasterOptions() 内で実行
    // （Firestoreデータ読み込み完了後に実行する必要があるため）

    // 管理番号UI初期化（動的セグメント対応）
    initManagementNumberUI();

    // ★ 別タブから設定変更通知を受信（BroadcastChannel）
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('reborn_config_updates');
      channel.addEventListener('message', async (event) => {
        if (event.data && event.data.type === 'configChanged') {
          console.log('📥 BroadcastChannelで設定変更通知を受信しました:', event.data.timestamp);

          // localStorageから最新設定を読み込み（管理番号）
          const cachedConfigStr = localStorage.getItem('rebornConfig_managementNumber');
          if (cachedConfigStr) {
            try {
              const newConfig = JSON.parse(cachedConfigStr);
              window.managementNumberConfig = newConfig;
              console.log('✅ 管理番号グローバル変数を更新しました:', newConfig);

              // UIも再描画
              if (newConfig.segments && newConfig.segments.length > 0) {
                renderManagementSegmentUI(newConfig.segments);
                console.log('✅ 管理番号UIを再描画しました');
              }
            } catch (e) {
              console.error('❌ localStorage設定のパースに失敗:', e);
            }
          }

          // localStorageから最新設定を読み込み（セールスワード表示形式）
          const saleswordConfigStr = localStorage.getItem('rebornConfig_salesword');
          if (saleswordConfigStr) {
            try {
              const saleswordConfig = JSON.parse(saleswordConfigStr);
              if (saleswordConfig.表示形式) {
                SALESWORD_FORMAT = saleswordConfig.表示形式;
                console.log('✅ SALESWORD_FORMATを更新しました:', SALESWORD_FORMAT);
              }
            } catch (e) {
              console.error('❌ セールスワード設定のパースに失敗:', e);
            }
          }

          // 商品名プレビューと説明プレビューも更新（管理番号形式・セールスワード形式変更対応）
          if (typeof updateNamePreview === 'function') {
            updateNamePreview();
            console.log('✅ 商品名プレビューを更新しました');
          }
          if (typeof updateDescriptionFromDetail === 'function') {
            updateDescriptionFromDetail();
            console.log('✅ 説明プレビューを更新しました');
          }
        }
      });
      console.log('📡 BroadcastChannelリスナー起動完了（reborn_config_updates）');
    } else {
      console.warn('⚠️ BroadcastChannel非対応ブラウザ（設定変更の自動反映不可）');
    }

    // 素材追加ボタンのイベントリスナー
    const addBtn = document.getElementById('addMaterialBtn');
    if (addBtn) {
      addBtn.addEventListener('click', addMaterial);
    }

    // カラー追加ボタンのイベントリスナー
    const addColorBtnEl = document.getElementById('addColorBtn');
    if (addColorBtnEl) {
      addColorBtnEl.addEventListener('click', addColor);
    }

    // 商品属性追加ボタンのイベントリスナー
    const addAttributeBtn = document.getElementById('addAttributeBtn');
    if (addAttributeBtn) {
      addAttributeBtn.addEventListener('click', addAttribute);
    }

    // 初期の商品属性セットアップ
    populateAttributeCategory(1);
    setupAttributeSelector(1);
    updateAttributeRemoveButtons();

    // 商品属性検索機能をセットアップ
    setupAttributeSearch();

    // カラー検索機能は loadMasterOptions() 内で実行
    // （COLOR_OPTIONS設定後に実行する必要があるため）

    // 素材入力フィールドの変更監視
    document.addEventListener('change', function(e) {
      if (e.target.classList.contains('material-location') ||
          e.target.classList.contains('material-type') ||
          e.target.classList.contains('material-percent')) {
        updateDescriptionFromDetail();
      }
    });

    // 商品状態履歴のオートコンプリート設定
    attachConditionSuggest('商品状態詳細', CONDITION_HISTORY || []);

    window.addEventListener('resize', ()=>{
      adjustPreviewHeight();
      adjustDescHeight();
    });
  })();

  // ================= 動的サイズ機能 =================
  function setupSizeSystem() {
    // サイズプルダウンに数値選択肢を設定
    const sizeFields = ['肩幅', '身幅', '袖丈', '着丈', 'ウエスト', 'ヒップ', '股上', '股下'];

    sizeFields.forEach(fieldId => {
      const select = document.getElementById(fieldId);
      if (select) {
        // 20cm〜120cmまで1cm刻みで選択肢を生成
  for (let i = 20; i <= 120; i += 1) {
    const option = document.createElement('option');
    option.value = i.toString();
    option.textContent = i.toString();
    select.appendChild(option);
  }

        // サイズ選択時に説明文を更新
        select.addEventListener('change', updateDescriptionFromDetail);
      }
    });

    // 小分類変更時のサイズ表示切り替え
    const subcategorySelect = document.getElementById('小分類(カテゴリ)');
    if (subcategorySelect) {
      subcategorySelect.addEventListener('change', updateSizeDisplay);
    }

    // 初期表示設定
    updateSizeDisplay();
  }

  // カテゴリに応じたアイコンとラベルを取得
  function getSizeIconAndLabel(subcategory) {
    // アイコンマッピング（大分類・中分類・アイテム名に対応）
    const iconMap = {
      // トップス系
      'Tシャツ': { icon: '👕', label: 'Tシャツ' },
      'シャツ': { icon: '👔', label: 'シャツ' },
      'ニット': { icon: '👕', label: 'ニット' },
      'セーター': { icon: '👕', label: 'セーター' },
      'パーカー': { icon: '🧥', label: 'パーカー' },
      'スウェット': { icon: '👕', label: 'スウェット' },
      'ジャケット': { icon: '🧥', label: 'ジャケット' },
      'ブレザー': { icon: '🧥', label: 'ブレザー' },
      'カーディガン': { icon: '🧥', label: 'カーディガン' },
      'ベスト': { icon: '🦺', label: 'ベスト' },
      'タンクトップ': { icon: '🎽', label: 'タンクトップ' },
      'キャミソール': { icon: '👗', label: 'キャミソール' },
      'ブラウス': { icon: '👚', label: 'ブラウス' },
      'チュニック': { icon: '👚', label: 'チュニック' },
      'ワンピース': { icon: '👗', label: 'ワンピース' },
      'コート': { icon: '🧥', label: 'コート' },
      'ダウンジャケット': { icon: '🧥', label: 'ダウンジャケット' },
      'アウター': { icon: '🧥', label: 'アウター' },
      'ジャンパー': { icon: '🧥', label: 'ジャンパー' },

      // ボトムス系
      'パンツ': { icon: '👖', label: 'パンツ' },
      'ジーンズ': { icon: '👖', label: 'ジーンズ' },
      'デニム': { icon: '👖', label: 'デニム' },
      'チノパン': { icon: '👖', label: 'チノパン' },
      'スラックス': { icon: '👔', label: 'スラックス' },
      'ショートパンツ': { icon: '🩳', label: 'ショートパンツ' },
      'ハーフパンツ': { icon: '🩳', label: 'ハーフパンツ' },
      'レギンス': { icon: '👖', label: 'レギンス' },
      'スパッツ': { icon: '👖', label: 'スパッツ' },
      'ジョガーパンツ': { icon: '👖', label: 'ジョガーパンツ' },
      'カーゴパンツ': { icon: '👖', label: 'カーゴパンツ' },
      'スカート': { icon: '👗', label: 'スカート' },
      'ミニスカート': { icon: '👗', label: 'ミニスカート' },
      'マキシスカート': { icon: '👗', label: 'マキシスカート' },
      'プリーツスカート': { icon: '👗', label: 'プリーツスカート' }
    };

    // デフォルトアイコン
    const defaultTops = { icon: '👕', label: 'トップス' };
    const defaultBottoms = { icon: '👖', label: 'パンツ' };

    // 部分一致でマッピング検索
    for (const [key, value] of Object.entries(iconMap)) {
      if (subcategory && subcategory.includes(key)) {
        return value;
      }
    }

    // 見つからない場合はデフォルト
    return null;
  }

  function updateSizeDisplay() {
    const subcategory = _val('小分類(カテゴリ)');
    const sizeSection = document.getElementById('sizeSection');
    const topsSize = document.getElementById('topsSize');
    const bottomsSize = document.getElementById('bottomsSize');
    const shoesSize = document.getElementById('shoesSize');
    const sizeIconDisplay = document.getElementById('sizeIconDisplay');
    const sizeLabelDisplay = document.getElementById('sizeLabelDisplay');

    if (!sizeSection || !topsSize || !bottomsSize || !shoesSize) return;

    // カテゴリマッピング
    const topsCategories = [
      'Tシャツ', 'シャツ', 'ニット', 'セーター', 'パーカー', 'スウェット',
      'ジャケット', 'ブレザー', 'カーディガン', 'ベスト', 'タンクトップ',
      'キャミソール', 'ブラウス', 'チュニック', 'ワンピース',
      'コート', 'ダウンジャケット', 'アウター', 'ジャンパー'
    ];

    const bottomsCategories = [
      'パンツ', 'ジーンズ', 'デニム', 'チノパン', 'スラックス', 'ショートパンツ',
      'ハーフパンツ', 'レギンス', 'スパッツ', 'ジョガーパンツ', 'カーゴパンツ',
      'スカート', 'ミニスカート', 'マキシスカート', 'プリーツスカート'
    ];

    const setCategories = [
      'スーツ', 'セットアップ', 'パジャマ', 'ルームウェア', 'ジャージ',
      'トラックスーツ', 'スポーツウェア', '作業着', 'つなぎ'
    ];

    const shoesCategories = [
      'スニーカー', 'ローファー', 'ブーツ', 'サンダル', 'パンプス',
      'レザーシューズ', 'スポーツシューズ', 'ランニングシューズ',
      'バスケットシューズ', 'スケートシューズ', 'ハイカットスニーカー',
      'ローカットスニーカー', 'スリッポン', 'モカシン', 'デッキシューズ'
    ];

    // 表示状態をリセット
    sizeSection.style.display = 'none';
    topsSize.style.display = 'none';
    bottomsSize.style.display = 'none';
    shoesSize.style.display = 'none';

    if (!subcategory) return;

    // アイコンとラベルを取得
    const iconData = getSizeIconAndLabel(subcategory);

    // ラグラン判定（アイテム名で判定）
    const itemName = _val('アイテム名');
    const isRaglan = itemName && itemName.includes('ラグラン');

    // カテゴリに応じて表示切り替え＆アイコン更新
    if (topsCategories.some(cat => subcategory.includes(cat))) {
      sizeSection.style.display = 'block';
      topsSize.style.display = 'block';
      if (iconData && sizeIconDisplay && sizeLabelDisplay) {
        sizeIconDisplay.textContent = iconData.icon;
        sizeLabelDisplay.textContent = iconData.label;
      }
      // ラグラン例外処理: 肩幅→裄丈
      const shoulderLabel = document.getElementById('shoulderWidthLabel');
      if (shoulderLabel) {
        shoulderLabel.textContent = isRaglan ? '裄丈' : '肩幅';
      }
    } else if (bottomsCategories.some(cat => subcategory.includes(cat))) {
      sizeSection.style.display = 'block';
      bottomsSize.style.display = 'block';
      if (iconData && sizeIconDisplay && sizeLabelDisplay) {
        sizeIconDisplay.textContent = iconData.icon;
        sizeLabelDisplay.textContent = iconData.label;
      }
    } else if (setCategories.some(cat => subcategory.includes(cat))) {
      sizeSection.style.display = 'block';
      topsSize.style.display = 'block';
      bottomsSize.style.display = 'block';
      if (iconData && sizeIconDisplay && sizeLabelDisplay) {
        sizeIconDisplay.textContent = iconData.icon;
        sizeLabelDisplay.textContent = iconData.label;
      }
      // ラグラン例外処理: 肩幅→裄丈
      const shoulderLabel = document.getElementById('shoulderWidthLabel');
      if (shoulderLabel) {
        shoulderLabel.textContent = isRaglan ? '裄丈' : '肩幅';
      }
    } else if (shoesCategories.some(cat => subcategory.includes(cat))) {
      // 靴の場合
      sizeSection.style.display = 'block';
      shoesSize.style.display = 'block';
      if (sizeIconDisplay && sizeLabelDisplay) {
        sizeIconDisplay.textContent = '👟';
        sizeLabelDisplay.textContent = 'サイズ（靴）';
      }

      // サイズ(表記)_靴のselectに選択肢を設定
      const shoesSizeSelect = document.getElementById('サイズ(表記)_靴');
      const basicSizeSelect = document.getElementById('サイズ');
      if (shoesSizeSelect && basicSizeSelect) {
        // 基本情報のサイズプルダウンの選択肢をコピー
        const currentValue = shoesSizeSelect.value;
        shoesSizeSelect.innerHTML = '';

        // 基本情報の全選択肢をコピー
        Array.from(basicSizeSelect.options).forEach(option => {
          const newOption = document.createElement('option');
          newOption.value = option.value;
          newOption.textContent = option.textContent;
          shoesSizeSelect.appendChild(newOption);
        });

        // 基本情報で選択されている値があれば同期
        const basicSize = basicSizeSelect.value;
        if (basicSize) {
          shoesSizeSelect.value = basicSize;
        } else if (currentValue) {
          // 以前の選択値を復元
          shoesSizeSelect.value = currentValue;
        }
      }

      console.log('★★★ updateSizeDisplay() で靴のサイズセクションを表示しました');
    }

    // 説明文を更新
    updateDescriptionFromDetail();
  }

  // グローバル関数設定
  window.onSave = onSave;
  window.onReset = onReset;
  window.initPrefix1 = initPrefix1;
  window.buildShelf = buildShelf;
  window.requestNextManagementNumber = requestNextManagementNumber;
  window.updateDescriptionFromDetail = updateDescriptionFromDetail;
  window.setupDetailEventListener = setupDetailEventListener;

  // ================= 階層式商品属性セレクター =================
  function setupAttributeSelectors() {
    // 商品属性1
    const category1 = document.getElementById('商品属性1_カテゴリ');
    const value1 = document.getElementById('商品属性1_値');
    if (category1 && value1) {
      category1.addEventListener('change', function() {
        updateAttributeValues('商品属性1_カテゴリ', '商品属性1_値');
      });
    }

    // 商品属性2
    const category2 = document.getElementById('商品属性2_カテゴリ');
    const value2 = document.getElementById('商品属性2_値');
    if (category2 && value2) {
      category2.addEventListener('change', function() {
        updateAttributeValues('商品属性2_カテゴリ', '商品属性2_値');
      });
    }

    // 商品属性3
    const category3 = document.getElementById('商品属性3_カテゴリ');
    const value3 = document.getElementById('商品属性3_値');
    if (category3 && value3) {
      category3.addEventListener('change', function() {
        updateAttributeValues('商品属性3_カテゴリ', '商品属性3_値');
      });
    }
  }

  function updateAttributeValues(categoryId, valueId) {
    const categorySelect = document.getElementById(categoryId);
    const valueSelect = document.getElementById(valueId);

    if (!categorySelect || !valueSelect) return;

    const selectedCategory = categorySelect.value;

    // 値プルダウンをリセット
    valueSelect.innerHTML = '<option value="">--カテゴリを選択してください--</option>';
    valueSelect.disabled = true;

    if (!selectedCategory) {
      updateNamePreview();
      return;
    }

    // グローバルなマスターオプションから値を取得
    if (window.globalMasterOptions && window.globalMasterOptions[selectedCategory]) {
      const values = window.globalMasterOptions[selectedCategory];

      if (values && values.length > 0) {
        valueSelect.innerHTML = '<option value="">--選択してください--</option>';
        values.forEach(value => {
          const option = document.createElement('option');
          option.value = value;
          option.textContent = value;
          valueSelect.appendChild(option);
        });
        valueSelect.disabled = false;

        // 値選択時のイベントリスナーを設定（重複回避のため一度削除）
        valueSelect.removeEventListener('change', updateNamePreview);
        valueSelect.addEventListener('change', updateNamePreview);
      }
    }

    updateNamePreview();
  }

  // 基本情報フィールド変更時にハッシュタグプレビューを更新
  function setupHashtagPreviewListeners() {
    const fieldsToWatch = [
      'ブランド(英語)', 'ブランド(カナ)',
      '大分類(カテゴリ)', '中分類(カテゴリ)', '小分類(カテゴリ)',
      '細分類(カテゴリ)', '細分類2', 'アイテム名'
    ];

    fieldsToWatch.forEach(fieldId => {
      const element = document.getElementById(fieldId);
      if (element) {
        element.addEventListener('change', function() {
          updateHashtagCheckboxPreviews();
        });
      }
    });
  }

  // サイズ(表記)フィールドのイベントリスナーを設定
  function setupSizeHyokiListeners() {
    const sizeHyokiTop = document.getElementById('サイズ(表記)_トップス');
    const sizeHyokiBottom = document.getElementById('サイズ(表記)_ボトムス');

    if (sizeHyokiTop) {
      sizeHyokiTop.addEventListener('change', updateDescriptionFromDetail);
    }
    if (sizeHyokiBottom) {
      sizeHyokiBottom.addEventListener('change', updateDescriptionFromDetail);
    }
  }

  // ラグラン判定のイベントリスナーを設定
  function setupRaglanListener() {
    const itemNameField = document.getElementById('アイテム名');
    if (itemNameField) {
      itemNameField.addEventListener('change', updateSizeDisplay);
    }
  }

  /**
   * 商品の説明ブロックの現在の順序を取得
   * @returns {Array} ブロックタイプの配列
   */
  function getDescriptionBlocksOrder() {
    const container = document.getElementById('descriptionBlocksContainer');
    if (!container) return [];

    const blocks = container.querySelectorAll('.desc-draggable-block');
    return Array.from(blocks).map(block => block.dataset.blockType);
  }

  /**
   * 商品の説明ブロックの開閉トグル
   * @param {HTMLElement} button - クリックされた開閉ボタン
   */
  function toggleDescBlock(button) {
    const block = button.closest('.desc-draggable-block');
    if (!block) return;

    const content = block.querySelector('.section-content');
    if (!content) return;

    const isOpen = content.style.display !== 'none';

    if (isOpen) {
      content.style.display = 'none';
      button.textContent = '▶';
    } else {
      content.style.display = 'block';
      button.textContent = '▼';
    }

    // 開閉状態を即時保存（ページを離れても維持されるように）
    try {
      const container = document.getElementById('descriptionBlocksContainer');
      if (container) {
        const blocks = container.querySelectorAll('.desc-draggable-block');
        const state = {};
        blocks.forEach(b => {
          const c = b.querySelector('.section-content');
          if (c) {
            const blockType = b.dataset.blockType;
            state[blockType] = c.style.display !== 'none';
          }
        });
        localStorage.setItem('descriptionBlocksCollapseState', JSON.stringify(state));
        console.log('説明ブロック開閉状態を即時保存:', state);
      }
    } catch (e) {
      console.error('説明ブロック開閉状態保存エラー:', e);
    }
  }

  /**
   * AI生成サブブロックの折りたたみ切り替え
   */
  function toggleAiSubBlock(header) {
    const subBlock = header.closest('.ai-sub-block');
    if (!subBlock) return;

    const content = subBlock.querySelector('.ai-sub-content');
    const button = subBlock.querySelector('.ai-sub-collapse-btn');
    if (!content || !button) return;

    const isOpen = content.style.display !== 'none';

    if (isOpen) {
      content.style.display = 'none';
      button.textContent = '▶';
    } else {
      content.style.display = 'block';
      button.textContent = '▼';
    }
  }

  /**
   * 商品名ブロックの開閉トグル
   * @param {HTMLElement} button - クリックされた開閉ボタン
   */
  function toggleTitleBlock(button) {
    const block = button.closest('.title-draggable-block');
    if (!block) return;

    const content = block.querySelector('.section-content');
    if (!content) return;

    const isOpen = content.style.display !== 'none';

    if (isOpen) {
      content.style.display = 'none';
      button.textContent = '▶';
    } else {
      content.style.display = 'block';
      button.textContent = '▼';
    }

    // 開閉状態を即時保存（ページを離れても維持されるように）
    try {
      const container = document.getElementById('titleBlockContainer');
      if (container) {
        const blocks = container.querySelectorAll('.title-draggable-block');
        const state = {};
        blocks.forEach(b => {
          const c = b.querySelector('.section-content');
          if (c) {
            const blockId = b.dataset.blockId;
            state[blockId] = c.style.display !== 'none';
          }
        });
        localStorage.setItem('titleBlocksCollapseState', JSON.stringify(state));
        console.log('タイトルブロック開閉状態を即時保存:', state);
      }
    } catch (e) {
      console.error('タイトルブロック開閉状態保存エラー:', e);
    }
  }

  /**
   * 商品の説明ブロックのドラッグ&ドロップを初期化
   */
  function initDescriptionBlocksDragDrop() {
    const container = document.getElementById('descriptionBlocksContainer');
    if (!container) return;

    // Sortable.jsを使用してドラッグ&ドロップを初期化
    Sortable.create(container, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      dragClass: 'sortable-drag',
      delay: 300,                        // 300ms長押しでドラッグ開始（誤操作防止）
      delayOnTouchOnly: true,            // タッチデバイスのみ遅延適用
      touchStartThreshold: 10,           // 10px以上移動したらドラッグキャンセル（スクロール優先）
      onEnd: function() {
        // ドロップ後に並び順を保存
        saveDescriptionBlocksOrder();
      }
    });

    console.log('商品の説明ブロックのドラッグ&ドロップを初期化しました');
  }

  /**
   * 商品の説明ブロックの並び順を保存
   */
  function saveDescriptionBlocksOrder() {
    const container = document.getElementById('descriptionBlocksContainer');
    if (!container) return;

    const blocks = container.querySelectorAll('.desc-draggable-block');
    const order = Array.from(blocks).map(block => block.dataset.blockType);

    console.log('商品の説明ブロック並び順を保存:', order);

    // 設定マスタに保存（TODO: config_loader.jsに保存機能を追加）
    // 今は一旦localStorageに保存
    localStorage.setItem('descriptionBlocksOrder', JSON.stringify(order));
  }

  /**
   * 商品の説明ブロックの並び順を読み込み
   */
  function loadDescriptionBlocksOrder() {
    const savedOrder = localStorage.getItem('descriptionBlocksOrder');
    if (!savedOrder) return;

    try {
      const order = JSON.parse(savedOrder);
      const container = document.getElementById('descriptionBlocksContainer');
      if (!container) return;

      // 並び順に応じてブロックを並び替え
      order.forEach(blockType => {
        const block = container.querySelector(`[data-block-type="${blockType}"]`);
        if (block) {
          container.appendChild(block);
        }
      });

      console.log('商品の説明ブロック並び順を復元しました:', order);
    } catch (error) {
      console.error('商品の説明ブロック並び順の読み込みエラー:', error);
    }
  }

  /**
   * 商品の説明ブロックの開閉状態を保存
   */
  function saveDescriptionBlocksCollapseState() {
    const container = document.getElementById('descriptionBlocksContainer');
    if (!container) return;

    const blocks = container.querySelectorAll('.desc-draggable-block');
    const state = {};

    blocks.forEach(block => {
      const content = block.querySelector('.section-content');
      if (content) {
        const blockType = block.dataset.blockType;
        state[blockType] = content.style.display !== 'none';
      }
    });

    console.log('商品の説明ブロック開閉状態を保存:', state);

    // 今は一旦localStorageに保存
    localStorage.setItem('descriptionBlocksCollapseState', JSON.stringify(state));
  }

  /**
   * 商品名ブロックの開閉状態を保存
   */
  function saveTitleBlocksCollapseState() {
    const container = document.getElementById('titleBlockContainer');
    if (!container) return;

    const blocks = container.querySelectorAll('.title-draggable-block');
    const state = {};

    blocks.forEach(block => {
      const content = block.querySelector('.section-content');
      if (content) {
        const blockId = block.dataset.blockId;
        state[blockId] = content.style.display !== 'none';
      }
    });

    console.log('商品名ブロック開閉状態を保存:', state);

    // localStorageに保存
    localStorage.setItem('titleBlocksCollapseState', JSON.stringify(state));
  }

  /**
   * 商品の説明ブロックの開閉状態を読み込み
   */
  function loadDescriptionBlocksCollapseState() {
    const container = document.getElementById('descriptionBlocksContainer');
    if (!container) return;

    const savedState = localStorage.getItem('descriptionBlocksCollapseState');

    // デフォルトで閉じるブロック
    const defaultClosedBlocks = ['discount', 'hashtag'];

    let state = {};

    if (savedState) {
      try {
        state = JSON.parse(savedState);
        console.log('商品の説明ブロック開閉状態を復元しました:', state);
      } catch (error) {
        console.error('商品の説明ブロック開閉状態の読み込みエラー:', error);
        // エラー時はデフォルト状態を使用
        defaultClosedBlocks.forEach(blockType => {
          state[blockType] = false;
        });
      }
    } else {
      // 初回読み込み時はデフォルトで閉じる
      defaultClosedBlocks.forEach(blockType => {
        state[blockType] = false;
      });
      console.log('デフォルト開閉状態を適用しました:', state);
    }

    // すべてのブロックに開閉状態を適用
    const blocks = container.querySelectorAll('.desc-draggable-block');
    blocks.forEach(block => {
      const blockType = block.dataset.blockType;
      const content = block.querySelector('.section-content');
      const button = block.querySelector('.collapse-btn');

      if (!content || !button) return;

      // stateに含まれている場合はその状態を使用、含まれていない場合は開いた状態
      const isOpen = state[blockType] !== undefined ? state[blockType] : true;

      if (isOpen) {
        content.style.display = 'block';
        button.textContent = '▼';
      } else {
        content.style.display = 'none';
        button.textContent = '▶';
      }
    });
  }

  /**
   * 商品名ブロックの開閉状態を読み込み
   */
  function loadTitleBlocksCollapseState() {
    const container = document.getElementById('titleBlockContainer');
    if (!container) return;

    const savedState = localStorage.getItem('titleBlocksCollapseState');

    let state = {};

    if (savedState) {
      try {
        state = JSON.parse(savedState);
        console.log('商品名ブロック開閉状態を復元しました:', state);
      } catch (error) {
        console.error('商品名ブロック開閉状態の読み込みエラー:', error);
      }
    }

    // すべてのブロックに開閉状態を適用
    const blocks = container.querySelectorAll('.title-draggable-block');
    blocks.forEach(block => {
      const blockId = block.dataset.blockId;
      const content = block.querySelector('.section-content');
      const button = block.querySelector('.collapse-btn');

      if (!content || !button) return;

      // stateに含まれている場合はその状態を使用、含まれていない場合は開いた状態（デフォルト）
      const isOpen = state[blockId] !== undefined ? state[blockId] : true;

      if (isOpen) {
        content.style.display = 'block';
        button.textContent = '▼';
      } else {
        content.style.display = 'none';
        button.textContent = '▶';
      }
    });
  }

  // ページ読み込み時にイベントリスナーを設定
  setTimeout(() => {
    console.log('🚀 ページ初期化開始');
    setupHashtagPreviewListeners();
    setupSizeHyokiListeners();
    setupRaglanListener();
    initTitleBlockDragDrop();
    applyTitleBlockOrder();

    // PropertiesServiceから管理番号配置設定を読み込み（タスクキル後の復元）
    console.log('📞 loadManagementNumberPlacementFromServer() を呼び出し');
    try {
      loadManagementNumberPlacementFromServer();
    } catch (e) {
      console.error('❌ loadManagementNumberPlacementFromServer() エラー:', e);
    }

    // 管理番号フィールドの変更監視を開始
    console.log('📞 setupManagementNumberObserver() を呼び出し');
    try {
      setupManagementNumberObserver();
    } catch (e) {
      console.error('❌ setupManagementNumberObserver() エラー:', e);
    }

    initDescriptionBlocksDragDrop();
    loadDescriptionBlocksOrder();
    loadDescriptionBlocksCollapseState();
    loadTitleBlocksCollapseState();
    }, 1000);

  // 最終セーフティネット: loadMasterOptions()のfillSelがセレクトをクリアした後に
  // デフォルト設定を確実に再適用する（タイミング競合対策）
  setTimeout(async () => {
    try {
      console.log('[SafetyNet] デフォルト設定の最終チェック開始');

      // 配送デフォルトが未適用なら再取得・再適用
      var shippingApplied = false;
      var fields = ['配送料の負担', '配送の方法', '発送元の地域', '発送までの日数'];
      for (var i = 0; i < fields.length; i++) {
        var sel = document.getElementById(fields[i]);
        if (sel && sel.value && sel.value !== '') { shippingApplied = true; break; }
      }

      if (!shippingApplied) {
        console.log('[SafetyNet] 配送デフォルト未適用 → Firestoreから再取得');
        if (window.db) {
          var doc = await window.db.collection('settings').doc('common').get();
          if (doc.exists) {
            var data = doc.data();
            if (data.shippingDefault) {
              SHIPPING_DEFAULTS = data.shippingDefault;
              applyShippingDefaults();
              console.log('[SafetyNet] ✅ 配送デフォルト適用:', data.shippingDefault);
            }
            if (data.procureListingDefault) {
              PROCURE_LISTING_DEFAULTS = data.procureListingDefault;
              if (!PROCURE_LISTING_DEFAULTS['仕入日_今日'] && PROCURE_LISTING_DEFAULTS['仕入日_今日'] !== false) {
                PROCURE_LISTING_DEFAULTS['仕入日_今日'] = true;
              }
              if (!PROCURE_LISTING_DEFAULTS['出品日_今日'] && PROCURE_LISTING_DEFAULTS['出品日_今日'] !== false) {
                PROCURE_LISTING_DEFAULTS['出品日_今日'] = true;
              }
              applyProcureListingDefaults();
              console.log('[SafetyNet] ✅ 仕入出品デフォルト適用:', data.procureListingDefault);
            }
          }
        }
      } else {
        console.log('[SafetyNet] 配送デフォルト適用済み、スキップ');
      }
    } catch (e) {
      console.warn('[SafetyNet] エラー:', e);
    }
  }, 3000);

// ============================================
// 商品保存（Firestore直接保存） - PROD-002 完全移行
// ============================================

/**
 * 商品番号を生成（P + YYYYMMDD + 連番3桁）
 * @returns {Promise<String>} 商品番号（例：P20251121001）
 */
async function generateProductId() {
  try {
    if (!window.db) {
      throw new Error('Firestoreが初期化されていません');
    }

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    // 今日の開始時刻（00:00:00）
    const todayStart = new Date(year, today.getMonth(), today.getDate());

    // 今日登録された商品をクエリ
    const snapshot = await window.db.collection('products')
      .where('createdAt', '>=', todayStart)
      .get();

    // 今日の商品数をカウント
    const todayCount = snapshot.size || 0;
    const serial = String(todayCount + 1).padStart(3, '0');

    const productId = `P${dateStr}${serial}`;
    console.log(`[generateProductId] 生成: ${productId} (今日の商品数: ${todayCount})`);

    return productId;

  } catch (error) {
    console.error('[generateProductId] エラー:', error);
    // エラー時はタイムスタンプベースのIDを生成
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = Date.now();
    return `P${dateStr}${String(timestamp).slice(-3)}`;
  }
}

/**
 * フォームデータをFirestore用のドキュメントに変換
 * @param {Object} formData - フォームデータ
 * @param {String} productId - 商品番号
 * @param {String} userEmail - ユーザーメールアドレス
 * @param {String} userName - ユーザー名
 * @returns {Object} Firestoreドキュメント
 */
function convertFormToFirestoreDoc(formData, productId, userEmail, userName) {
  const now = new Date();

  // 基本情報
  const doc = {
    productId: productId,
    shelfNumber: formData['棚番号'] || '',
    managementNumber: formData['管理番号'] || '',
    purchaseSlotId: formData['invId'] || null,  // 仕入商品との紐付けID

    // 商品情報
    productName: formData['商品名(タイトル)'] || '',
    brand: {
      nameEn: formData['ブランド(英語)'] || '',
      nameKana: formData['ブランド(カナ)'] || ''
    },
    category: {
      superCategory: formData['特大分類'] || '',  // メルカリトップカテゴリー
      major: formData['大分類(カテゴリ)'] || formData['大分類'] || '',
      middle: formData['中分類(カテゴリ)'] || formData['中分類'] || '',
      minor: formData['小分類(カテゴリ)'] || formData['小分類'] || '',
      detail1: formData['細分類(カテゴリ)'] || formData['細分類1'] || '',
      detail2: formData['細分類2'] || ''
    },

    // 商品詳細
    description: formData['商品の説明'] || '',
    condition: formData['商品の状態'] || '',
    conditionDetail: formData['商品状態詳細'] || formData['商品状態(詳細)'] || '',
    rank: (() => {
      // ランクは商品の状態から自動連動
      if (window.currentConditionRank) {
        return {
          code: window.currentConditionRank.code,
          name: window.currentConditionRank.name,
          description: window.currentConditionRank.description || ''
        };
      }
      // フォールバック: hidden inputから取得
      const rankValue = formData['ランク'];
      if (rankValue) {
        const rankInfo = Object.values(CONDITION_TO_RANK_MAP).find(r => r.code === rankValue);
        if (rankInfo) {
          return {
            code: rankInfo.code,
            name: rankInfo.name,
            description: ''
          };
        }
      }
      return null;
    })(),
    itemName: formData['アイテム名'] || '',
    size: {
      display: formData['サイズ'] || '',
      actual: formData['サイズ(表記)'] || ''
    },

    // セールスワード
    salesWord: {
      category: formData['セールスワード(カテゴリ)'] || '',
      word: formData['セールスワード'] || ''
    },

    // 商品属性
    attributes: {
      material: formData['生地・素材・質感系'] || '',
      season: formData['季節感・機能性'] || '',
      scene: formData['着用シーン・イベント'] || '',
      appearance: formData['見た目・印象'] || '',
      trend: formData['トレンド表現'] || '',
      sizeFeeling: formData['サイズ感・体型カバー'] || '',
      style: formData['年代・テイスト・スタイル'] || '',
      color: formData['カラー/配色/トーン'] || '',
      pattern: formData['柄・模様'] || '',
      detail: formData['ディテール・仕様'] || '',
      silhouette: formData['シルエット/ライン'] || '',
      neckline: formData['ネックライン'] || '',
      collar: formData['襟・衿'] || '',
      sleeve: formData['袖・袖付け'] || '',
      length: formData['丈'] || '',
      leather: formData['革/加工'] || '',
      fur: formData['毛皮/加工'] || '',
      origin: formData['生産国'] || ''
    },

    // 寸法
    measurements: {
      shoulderWidth: formData['肩幅'] || '',
      chestWidth: formData['身幅'] || '',
      sleeveLength: formData['袖丈'] || '',
      length: formData['着丈'] || '',
      waist: formData['ウエスト'] || '',
      hip: formData['ヒップ'] || '',
      rise: formData['股上'] || '',
      inseam: formData['股下'] || ''
    },

    // 仕入情報
    purchase: {
      date: formData['仕入日'] ? new Date(formData['仕入日']) : null,
      supplier: formData['仕入先'] || '',
      amount: formData['仕入金額'] ? Number(formData['仕入金額']) : 0
    },

    // 出品情報
    listing: {
      date: formData['出品日'] ? new Date(formData['出品日']) : null,
      destination: formData['出品先'] || '',
      amount: formData['出品金額'] ? Number(formData['出品金額']) : 0,
      salesType: formData['salesType'] || 'fixed'
    },

    // 配送設定
    shipping: {
      feeBearer: formData['配送料の負担'] || '',
      method: formData['配送の方法'] || '',
      region: formData['発送元の地域'] || '',
      days: formData['発送までの日数'] || ''
    },

    // 梱包資材（PROD-002）- 将来実装
    packaging: {
      preset: '',
      materials: [],
      totalCost: 0
    },

    // INV-010: 新品/バリエーション対応
    itemType: formData['itemType'] || 'unique', // 'unique'=1点物, 'sku-based'=SKU管理
    skuId: formData['skuId'] || null, // SKU ID（SKU管理時のみ）
    variations: formData['variations'] || {}, // バリエーション情報 { size, color, etc }
    stockQuantity: formData['stockQuantity'] || 1, // 在庫数量（1点物は常に1）

    // EC用コンテンツ（AI自動生成）
    ecTitle: formData['ecTitle'] || '',
    ecDescription: formData['ecDescription'] || '',

    // ステータス管理（現状メルカリのみ・API不可のため登録=出品中。API連携時はトリガー差し替え）
    status: formData['ステータス'] || '出品中',

    // 担当者
    assignedTo: formData['担当者'] || userName,

    // メタデータ
    createdBy: userName,
    createdByEmail: userEmail,
    createdAt: now,
    updatedBy: userName,
    updatedByEmail: userEmail,
    updatedAt: now,

    // AI関連（将来使用）
    aiGenerated: {
      history: formData['AI生成履歴'] ? JSON.parse(formData['AI生成履歴']) : [],
      tags: formData['AIタグ'] ? formData['AIタグ'].split(',') : [],
      analysis: formData['Agent分析結果'] ? JSON.parse(formData['Agent分析結果']) : {}
    },

    // 画像（常に { imageUrls: [...] } 形式で保存）
    images: (() => {
      if (!formData['JSON_データ']) return { imageUrls: [] };
      try {
        const parsed = JSON.parse(formData['JSON_データ']);
        // {imageUrls: [...]} 形式ならそのまま、配列ならimageUrlsにラップ
        if (parsed && parsed.imageUrls) {
          return { imageUrls: parsed.imageUrls };
        } else if (Array.isArray(parsed)) {
          return { imageUrls: parsed };
        }
        return { imageUrls: [] };
      } catch (e) {
        console.error('[convertFormToFirestoreDoc] JSON_データのパースエラー:', e);
        return { imageUrls: [] };
      }
    })(),

    // 傷・汚れマーキング画像
    damageMarker: (() => {
      // window.currentDamageMarkerから取得（QRスキャン時にセットされる）
      if (window.currentDamageMarker && window.currentDamageMarker.image) {
        return {
          image: window.currentDamageMarker.image,
          type: window.currentDamageMarker.type || null,
          note: window.currentDamageMarker.note || null
        };
      }
      return null;
    })()
  };

  return doc;
}

/**
 * 商品データをFirestoreに保存
 * @param {Object} formData - フォームデータ
 * @returns {Promise<Object>} 保存結果
 */
async function saveProductToFirestore(formData) {
  console.log('[saveProductToFirestore] 開始');
  console.log('[saveProductToFirestore] フォームデータ:', formData);

  try {
    if (!window.db) {
      throw new Error('Firestoreが初期化されていません');
    }

    // ユーザー情報取得（URLパラメータ優先、localStorage代替、Firebase Auth最終手段）
    const urlParams = new URLSearchParams(window.location.search);
    let userEmail = urlParams.get('userEmail') || localStorage.getItem('reborn_user_email');
    let userName = urlParams.get('userName') || localStorage.getItem('reborn_user_name');

    if (userEmail && userName) {
      // URLパラメータまたはlocalStorageから正常取得
      const source = urlParams.get('userName') ? 'URLパラメータ' : 'localStorage';
      console.log(`[saveProductToFirestore] ${source}からユーザー情報取得:`, { userEmail, userName });
    } else {
      // URLパラメータとlocalStorageにない場合、Firebase Authを確認
      if (firebase.auth && firebase.auth().currentUser) {
        userEmail = firebase.auth().currentUser.email;
        userName = firebase.auth().currentUser.displayName || userEmail;
        console.log('[saveProductToFirestore] Firebase Authからユーザー情報取得:', { userEmail, userName });
      } else {
        // どれもない場合のデフォルト
        userEmail = userEmail || 'unknown@example.com';
        userName = userName || '匿名ユーザー';
        console.warn('[saveProductToFirestore] ユーザー情報なし、デフォルト値使用:', { userEmail, userName });
      }
    }

    // 商品番号生成
    const productId = await generateProductId();
    console.log(`[saveProductToFirestore] 商品番号: ${productId}`);

    // 管理番号の確定とカウンター更新
    const managementNumber = formData['管理番号'];
    if (managementNumber) {
      console.log(`[saveProductToFirestore] 管理番号確定処理: ${managementNumber}`);
      const confirmed = await window.confirmManagementNumber(managementNumber);
      if (!confirmed) {
        throw new Error('管理番号が重複しています');
      }
      console.log(`[saveProductToFirestore] 管理番号確定完了`);
    }

    // INV-010: QRスキャン時のSKU情報をformDataに反映
    if (window.currentSkuInfo) {
      formData['itemType'] = window.currentSkuInfo.itemType || 'unique';
      formData['skuId'] = window.currentSkuInfo.skuId || null;
      formData['stockQuantity'] = window.currentSkuInfo.quantity || 1;
      // 単価情報も保持（原価計算用）
      if (window.currentSkuInfo.unitPrice) {
        formData['unitPurchasePrice'] = window.currentSkuInfo.unitPrice;
      }
    }

    // 販売タイプを取得してformDataに設定
    formData['salesType'] = getSalesType();

    // Firestoreドキュメント作成
    const doc = convertFormToFirestoreDoc(formData, productId, userEmail, userName);
    console.log(`[saveProductToFirestore] ドキュメント作成完了`);

    // Firestoreに保存（ドキュメントIDは商品番号）
    await window.db.collection('products').doc(productId).set(doc);
    console.log(`[saveProductToFirestore] Firestore保存完了: products/${productId}`);

    // purchaseSlotsの処理（紐付け更新 or 自動作成）
    let purchaseSlotId = formData['invId'];
    
    if (purchaseSlotId) {
      // 既存のpurchaseSlotを更新
      try {
        await window.db.collection('purchaseSlots').doc(purchaseSlotId).update({
          productId: productId,
          managementNumber: formData['管理番号'] || '',
          status: 'registered',
          registeredAt: new Date().toISOString()
        });
        console.log(`[saveProductToFirestore] purchaseSlots更新完了: ${purchaseSlotId} → ${productId}`);

        // INV-010: sku-based商品の場合はSKUコレクションも更新
        if (window.currentSkuInfo && window.currentSkuInfo.itemType === 'sku-based' && window.currentSkuInfo.skuId) {
          try {
            await window.db.collection('skus').doc(window.currentSkuInfo.skuId).set({
              skuId: window.currentSkuInfo.skuId,
              productId: productId,
              name: formData['商品名'] || '',
              brand: formData['ブランド'] || '',
              category: formData['カテゴリ'] || '',
              currentStock: window.currentSkuInfo.quantity || 1,
              unitPurchasePrice: window.currentSkuInfo.unitPrice || null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }, { merge: true });
            console.log(`[saveProductToFirestore] SKU登録完了: ${window.currentSkuInfo.skuId}`);
          } catch (skuError) {
            console.warn(`[saveProductToFirestore] SKU登録スキップ:`, skuError.message);
          }
        }
      } catch (slotError) {
        console.warn(`[saveProductToFirestore] purchaseSlots更新スキップ:`, slotError.message);
      }
    } else {
      // purchaseSlotがない場合は自動作成（副業ユーザー向け）
      try {
        const autoSlotId = `AUTO-${productId}`;
        const purchaseSlotData = {
          slotId: autoSlotId,
          productId: productId,
          managementNumber: formData['管理番号'] || '',
          productName: formData['商品名'] || '',
          brand: formData['ブランド'] || '',
          category: formData['カテゴリ'] || '',
          purchasePrice: parseFloat(formData['仕入価格']) || 0,
          status: 'registered',
          autoCreated: true, // 自動作成フラグ
          // INV-010: 新品/バリエーション対応（自動作成は常に1点物）
          itemType: 'unique',
          quantity: 1,
          skuId: null,
          unitPrice: null,
          createdAt: new Date().toISOString(),
          registeredAt: new Date().toISOString()
        };
        
        await window.db.collection('purchaseSlots').doc(autoSlotId).set(purchaseSlotData);
        console.log(`[saveProductToFirestore] purchaseSlots自動作成: ${autoSlotId}`);
        
        // productsドキュメントにもpurchaseSlotIdを追記
        await window.db.collection('products').doc(productId).update({
          purchaseSlotId: autoSlotId
        });
        console.log(`[saveProductToFirestore] products.purchaseSlotId更新: ${autoSlotId}`);
        
        purchaseSlotId = autoSlotId;
      } catch (autoSlotError) {
        // 自動作成失敗はログのみ（商品登録自体は成功させる）
        console.warn(`[saveProductToFirestore] purchaseSlots自動作成スキップ:`, autoSlotError.message);
      }
    }

    // 成功レスポンス
    return {
      success: true,
      message: '登録完了しました',
      productId: productId,
      managementNumber: formData['管理番号'] || ''
    };

  } catch (error) {
    console.error('[saveProductToFirestore] エラー:', error);
    console.error('[saveProductToFirestore] スタック:', error.stack);

    return {
      success: false,
      message: `NG(ERROR): ${error.message}`
    };
  }
}

// ============================================
// グローバルスコープに公開（外部モジュールから呼び出し可能に）
// ============================================
window.updateBrandDisplay = updateBrandDisplay;
window.updateNamePreview = updateNamePreview;
window.saveProductToFirestore = saveProductToFirestore;
window.updateAttributeFields = updateAttributeFields;
window.resetAttributeSections = resetAttributeSections;

// AI生成用画像アップロード関数をグローバルスコープに公開
window.handleImageUpload = handleImageUpload;
window.removeImage = removeImage;

// 商品画像アップロード関数をグローバルスコープに公開
window.handleProductImageUpload = handleProductImageUpload;
window.displayProductImagesPreview = displayProductImagesPreview;
window.removeProductImage = removeProductImage;
window.clearAllProductImages = clearAllProductImages;
window.applyAiEdit = applyAiEdit;
window.undoAiEdit = undoAiEdit;

// ============================================
// 販売タイプ制御（メルカリ選択時のみ表示）
// ============================================

/**
 * 出品先の変更時に販売タイプの表示/非表示を切り替える
 */
function handleSalesChannelChange() {
  const salesChannelSelect = document.getElementById('出品先');
  const salesTypeContainer = document.getElementById('sales-type-container');

  if (!salesChannelSelect || !salesTypeContainer) {
    console.warn('⚠️ 販売タイプ制御: 必要な要素が見つかりません');
    return;
  }

  const selectedValue = salesChannelSelect.value;

  // メルカリが選択された場合のみ販売タイプを表示
  if (selectedValue === 'メルカリ') {
    salesTypeContainer.style.display = 'block';
    console.log('✅ 販売タイプ表示（メルカリ選択）');
  } else {
    salesTypeContainer.style.display = 'none';
    // メルカリ以外の場合は「価格を設定する」にリセット
    const salesTypeSelect = document.getElementById('salesType');
    if (salesTypeSelect) {
      salesTypeSelect.value = 'fixed';
      handleSalesTypeChange(); // オークション表示もリセット
    }
    console.log('✅ 販売タイプ非表示（メルカリ以外）');
  }
}

/**
 * 販売タイプの変更時に出品金額の表示を変更する
 */
function handleSalesTypeChange() {
  const salesTypeSelect = document.getElementById('salesType');
  const auctionSuffix = document.getElementById('auction-suffix');
  const listingPriceInput = document.getElementById('出品金額');

  if (!salesTypeSelect || !auctionSuffix || !listingPriceInput) {
    return;
  }

  if (salesTypeSelect.value === 'auction') {
    // オークション形式：〜を表示
    auctionSuffix.style.display = 'inline';
    listingPriceInput.style.paddingRight = '30px'; // 〜の分だけ右余白
    console.log('✅ オークション形式選択 - 金額に〜を表示');
  } else {
    // 価格を設定する：〜を非表示
    auctionSuffix.style.display = 'none';
    listingPriceInput.style.paddingRight = '';
    console.log('✅ 価格設定選択 - 通常表示');
  }
}

/**
 * 販売タイプを取得（保存時に使用）
 */
function getSalesType() {
  const salesTypeSelect = document.getElementById('salesType');
  return salesTypeSelect ? salesTypeSelect.value : 'fixed';
}

/**
 * 販売タイプのイベントリスナーを設定
 */
function initSalesTypeControl() {
  // 出品先の変更イベント
  const salesChannelSelect = document.getElementById('出品先');
  if (salesChannelSelect) {
    salesChannelSelect.addEventListener('change', handleSalesChannelChange);
    console.log('✅ 出品先変更イベントリスナーを設定');
  }

  // 販売タイプのセレクトボックス変更イベント
  const salesTypeSelect = document.getElementById('salesType');
  if (salesTypeSelect) {
    salesTypeSelect.addEventListener('change', handleSalesTypeChange);
    console.log('✅ 販売タイプ変更イベントリスナーを設定');
  }

  // 初期状態を設定
  handleSalesChannelChange();
}

// グローバルスコープに公開
window.handleSalesChannelChange = handleSalesChannelChange;
window.handleSalesTypeChange = handleSalesTypeChange;
window.getSalesType = getSalesType;
window.initSalesTypeControl = initSalesTypeControl;

// ページ読み込み時に初期化（遅延実行でDOM準備後に実行）
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    // 出品先の選択肢が読み込まれた後に実行するため、少し遅延
    setTimeout(initSalesTypeControl, 500);
  });
} else {
  setTimeout(initSalesTypeControl, 500);
}

// ==========================================================================
// SPA再訪問用: DOM再構築後の再初期化関数
// product-scripts.jsの自動実行コードは初回ロード時のみ動作するため、
// SPA遷移で再表示される際はこの関数でUIとリスナーを復元する
// ==========================================================================
window.reinitProductScripts = async function() {
  console.log('🔄 [SPA reinit] 開始');

  // 1. DOMキャッシュクリア（古い参照を破棄）
  clearElementCache();

  // 2. カテゴリマスタ → カスケードリスナー再設定
  if (!CAT_ROWS || CAT_ROWS.length === 0) {
    // まずlocalStorageキャッシュから読み込み
    try {
      var cachedCat = localStorage.getItem('rebornCache_categoryMaster');
      if (cachedCat) {
        CAT_ROWS = JSON.parse(cachedCat);
        console.log('⚡ [SPA reinit] カテゴリマスタをキャッシュから読み込み:', CAT_ROWS.length + '件');
      }
    } catch (e) { /* パースエラー無視 */ }
    // キャッシュもなければFirestoreから取得
    if (!CAT_ROWS || CAT_ROWS.length === 0) {
      try {
        if (window.db) {
          var catDoc = await window.db.collection('categories').doc('master').get();
          if (catDoc.exists) {
            var rows = catDoc.data().rows || [];
            CAT_ROWS = rows.map(function(r) {
              return {
                特大分類: String(r.特大分類 || '').trim(),
                大分類: String(r.大分類 || '').trim(),
                中分類: String(r.中分類 || '').trim(),
                小分類: String(r.小分類 || '').trim(),
                細分類: String(r.細分類 || '').trim(),
                細分類2: String(r.細分類2 || '').trim(),
                アイテム名: String(r.アイテム名 || '').trim()
              };
            });
            localStorage.setItem('rebornCache_categoryMaster', JSON.stringify(CAT_ROWS));
            console.log('✅ [SPA reinit] カテゴリマスタをFirestoreから読み込み:', CAT_ROWS.length + '件');
          }
        }
      } catch (e) {
        console.warn('⚠️ [SPA reinit] カテゴリマスタ読み込みエラー:', e.message);
      }
    }
  }

  // カテゴリカスケードリスナー（remove→addで重複回避）
  var catFields = [
    { id: '特大分類', fn: onL0Changed },
    { id: '大分類(カテゴリ)', fn: onL1Changed },
    { id: '中分類(カテゴリ)', fn: onL2Changed },
    { id: '小分類(カテゴリ)', fn: onL3Changed },
    { id: '細分類(カテゴリ)', fn: onL4Changed },
    { id: '細分類2', fn: onL5Changed },
    { id: 'アイテム名', fn: updateItemNameDisplay }
  ];
  catFields.forEach(function(f) {
    var el = document.getElementById(f.id);
    if (el) {
      el.removeEventListener('change', f.fn);
      el.addEventListener('change', f.fn);
    }
  });

  var szBasic = document.getElementById('サイズ');
  if (szBasic) {
    szBasic.removeEventListener('change', syncBasicSizeToDescription);
    szBasic.addEventListener('change', syncBasicSizeToDescription);
  }

  // 3. マスタオプション → セレクト再充填 + リスナー再設定
  if (!MASTER_OPTIONS || Object.keys(MASTER_OPTIONS).length === 0) {
    // まずlocalStorageキャッシュから読み込み
    try {
      var cachedOpts = localStorage.getItem('rebornCache_masterOptions');
      if (cachedOpts) {
        MASTER_OPTIONS = JSON.parse(cachedOpts);
        console.log('⚡ [SPA reinit] マスタオプションをキャッシュから読み込み:', Object.keys(MASTER_OPTIONS).length + 'フィールド');
      }
    } catch (e) { /* パースエラー無視 */ }
    // キャッシュもなければFirestoreから取得
    if (!MASTER_OPTIONS || Object.keys(MASTER_OPTIONS).length === 0) {
      try {
        if (window.db) {
          var snapshot = await window.db.collection('masterOptions').get();
          var opts = {};
          snapshot.forEach(function(doc) {
            var data = doc.data();
            if (doc.id !== '_index' && data.fieldName && data.items) {
              opts[data.fieldName] = data.items;
            }
          });
          MASTER_OPTIONS = opts;
          localStorage.setItem('rebornCache_masterOptions', JSON.stringify(opts));
          console.log('✅ [SPA reinit] マスタオプションをFirestoreから読み込み:', Object.keys(opts).length + 'フィールド');
        }
      } catch (e) {
        console.warn('⚠️ [SPA reinit] マスタオプション読み込みエラー:', e.message);
      }
    }
  }

  if (MASTER_OPTIONS && Object.keys(MASTER_OPTIONS).length > 0) {
    var _fill = function(id, arr) {
      var sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = '<option value="">--選択してください--</option>';
      (arr || []).forEach(function(v) {
        sel.insertAdjacentHTML('beforeend', '<option value="' + v + '">' + v + '</option>');
      });
    };

    _fill('担当者', MASTER_OPTIONS['担当者'] || []);
    _fill('仕入先', MASTER_OPTIONS['仕入先'] || []);
    _fill('生地・素材・質感系', MASTER_OPTIONS['生地・素材・質感系'] || []);
    _fill('サイズ', MASTER_OPTIONS['サイズ'] || []);
    _fill('商品の状態', unifyConditionList(MASTER_OPTIONS['商品の状態'] || []));
    _fill('サイズ(表記)_トップス', MASTER_OPTIONS['サイズ(表記)'] || []);
    _fill('サイズ(表記)_ボトムス', MASTER_OPTIONS['サイズ(表記)'] || []);

    var titleFields = [
      '季節感・機能性','着用シーン・イベント','見た目・印象','トレンド表現',
      'サイズ感・体型カバー','年代・テイスト・スタイル','カラー/配色/トーン','柄・模様',
      'ディテール・仕様','シルエット/ライン','ネックライン','襟・衿',
      '袖・袖付け','丈','革/加工','毛皮/加工','生産国'
    ];
    titleFields.forEach(function(name) { _fill(name, MASTER_OPTIONS[name] || []); });

    _fill('出品先', MASTER_OPTIONS['出品先'] || []);
    _fill('配送料の負担', MASTER_OPTIONS['配送料の負担'] || []);
    _fill('配送の方法', MASTER_OPTIONS['配送の方法'] || []);
    _fill('発送元の地域', MASTER_OPTIONS['発送元の地域'] || []);
    _fill('発送までの日数', MASTER_OPTIONS['発送までの日数'] || []);

    // マスタオプション再読み込み後にデフォルト設定を再適用
    if (typeof applyShippingDefaults === 'function') applyShippingDefaults();
    if (typeof applyProcureListingDefaults === 'function') applyProcureListingDefaults();

    window.globalMasterOptions = MASTER_OPTIONS;

    // マスタ依存のリスナー再設定
    var sizeSelect = document.getElementById('サイズ');
    if (sizeSelect) {
      sizeSelect.removeEventListener('change', updateNamePreview);
      sizeSelect.addEventListener('change', updateNamePreview);
    }
    var condSelect = document.getElementById('商品の状態');
    if (condSelect) {
      condSelect.removeEventListener('change', updateDescriptionFromDetail);
      condSelect.addEventListener('change', updateDescriptionFromDetail);
      condSelect.removeEventListener('change', updateConditionButtons);
      condSelect.addEventListener('change', updateConditionButtons);
    }
    var staffSel = document.getElementById('担当者');
    if (staffSel) {
      staffSel.removeEventListener('change', updateNamePreview);
      staffSel.addEventListener('change', updateNamePreview);
    }

    // カラー・素材マスタ初期化
    initializeColorMasters();
    initializeMaterialMasters();
    setupColorSearch();

    // ブランド検索（Algolia）はwaitForCachedConfigAndSetup内で初期化済み
  }

  // 4. 設定読み込み + 依存初期化
  await loadAllConfig();
  initializeSalesWords();
  loadConditionButtonsFromConfig();
  loadHashtagConfig();
  loadDiscountConfig();
  await loadShippingDefaults();
  await loadProcureListingDefaults();
  loadOperatorName();
  loadTitleBlockOrder();
  loadRankOptions();

  // 5. 各種システム再セットアップ
  setupAttributeSelectors();
  setupSizeSystem();
  setupSalesWordEventListeners();
  wireDescWatcher();
  updateDesc();
  setupDetailEventListener();
  setupQuickInsertButtons();

  // 6. 管理番号UI初期化
  initManagementNumberUI();

  // 7. プレビュー系
  wirePreviewWatchers();
  updateNamePreview();
  adjustPreviewHeight();

  // 8. 出品タイプ制御
  setTimeout(initSalesTypeControl, 300);

  // 9. セールスワードデフォルト再適用
  if (typeof applyDefaultSalesword === 'function') {
    setTimeout(function() { applyDefaultSalesword(); }, 500);
  }

  // 10. イベントリスナー再設定（初期ロードと同等）
  setupHashtagPreviewListeners();
  setupSizeHyokiListeners();
  setupRaglanListener();

  // 11. ブロック管理（ドラッグ&ドロップ、順序、折りたたみ状態）
  initTitleBlockDragDrop();
  applyTitleBlockOrder();
  initDescriptionBlocksDragDrop();
  loadDescriptionBlocksOrder();
  loadDescriptionBlocksCollapseState();
  loadTitleBlocksCollapseState();

  // 12. 管理番号オブザーバー・配置設定
  try { loadManagementNumberPlacementFromServer(); } catch (e) { console.error('[reinit] mnb placement error:', e); }
  try { setupManagementNumberObserver(); } catch (e) { console.error('[reinit] mnb observer error:', e); }

  console.log('✅ [SPA reinit] 完了');
};
