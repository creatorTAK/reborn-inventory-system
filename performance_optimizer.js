/**
 * performance_optimizer.gs - パフォーマンス最適化システム
 * マスタデータ取得の効率化、キャッシュ機能、一括処理の最適化
 */

// =============================================================================
// キャッシュ機能（セッション内でマスタデータを保持）
// =============================================================================
const CACHE_DURATION = 5 * 60 * 1000; // 5分間キャッシュ
let masterDataCache = null;
let cacheTimestamp = null;

function isCacheValid() {
  if (!masterDataCache || !cacheTimestamp) return false;
  return (Date.now() - cacheTimestamp) < CACHE_DURATION;
}

function clearMasterCache() {
  masterDataCache = null;
  cacheTimestamp = null;
}

// =============================================================================
// 最適化されたマスタデータ取得
// =============================================================================
function getMasterOptionsOptimized() {
  // キャッシュチェック
  if (isCacheValid()) {
    console.log('マスタデータ: キャッシュから取得');
    return masterDataCache;
  }
  
  console.log('マスタデータ: シートから新規取得');
  
  try {
    const startTime = Date.now();
    
    // 元のgetMasterOptions()を実行
    const masterData = getMasterOptions();
    
    // キャッシュに保存
    masterDataCache = masterData;
    cacheTimestamp = Date.now();
    
    const duration = Date.now() - startTime;
    console.log(`マスタデータ取得完了: ${duration}ms`);
    
    return masterData;
    
  } catch (error) {
    console.error('マスタデータ取得エラー:', error);
    // エラー時は既存キャッシュを返すか、空のデータ構造を返す
    return masterDataCache || createEmptyMasterData();
  }
}

function createEmptyMasterData() {
  return {
    '担当者': [],
    'ブランド(英語)': [],
    'ブランド(カナ)': [],
    '仕入先': [],
    'セールスワード': [],
    '生地・素材・質感系': [],
    'サイズ': [],
    '商品の状態': [],
    '出品先': [],
    '配送料の負担': [],
    '配送の方法': [],
    '発送元の地域': [],
    '発送までの日数': []
  };
}

// =============================================================================
// カテゴリーデータの最適化取得
// =============================================================================
let categoryDataCache = null;
let categoryCacheTimestamp = null;

function getCategoryRowsOptimized() {
  // キャッシュチェック
  if (categoryDataCache && categoryCacheTimestamp && 
      (Date.now() - categoryCacheTimestamp) < CACHE_DURATION) {
    console.log('カテゴリーデータ: キャッシュから取得');
    return categoryDataCache;
  }
  
  console.log('カテゴリーデータ: シートから新規取得');
  
  try {
    const startTime = Date.now();
    
    // 元のgetCategoryRows()を実行
    const categoryData = getCategoryRows();
    
    // キャッシュに保存
    categoryDataCache = categoryData;
    categoryCacheTimestamp = Date.now();
    
    const duration = Date.now() - startTime;
    console.log(`カテゴリーデータ取得完了: ${duration}ms`);
    
    return categoryData;
    
  } catch (error) {
    console.error('カテゴリーデータ取得エラー:', error);
    return categoryDataCache || { ok: true, rows: [] };
  }
}

// =============================================================================
// ブランド候補の最適化
// =============================================================================
function getOptimizedBrandSuggestions(brandType, searchQuery, limit = 10) {
  try {
    const startTime = Date.now();
    
    // マスタデータをキャッシュから取得
    const masterData = getMasterOptionsOptimized();
    const brandList = masterData[brandType] || [];
    
    if (!searchQuery || searchQuery.trim() === '') {
      // 検索クエリが空の場合は先頭から指定件数を返す
      const result = brandList.slice(0, limit);
      console.log(`ブランド候補(${brandType}): ${Date.now() - startTime}ms, ${result.length}件`);
      return result;
    }
    
    // 検索処理の最適化
    const query = searchQuery.trim();
    const queryLower = brandType === 'ブランド(英語)' ? query.toLowerCase() : query;
    
    const matches = [];
    let exactMatches = [];
    let prefixMatches = [];
    let containsMatches = [];
    
    // 3段階のマッチング優先度
    for (const brand of brandList) {
      const brandText = brandType === 'ブランド(英語)' ? brand.toLowerCase() : brand;
      
      if (brandText === queryLower) {
        exactMatches.push(brand);
      } else if (brandText.startsWith(queryLower)) {
        prefixMatches.push(brand);
      } else if (brandText.includes(queryLower)) {
        containsMatches.push(brand);
      }
      
      // 制限に達したら終了
      if (exactMatches.length + prefixMatches.length + containsMatches.length >= limit * 2) {
        break;
      }
    }
    
    // 優先度順に結合
    const result = [
      ...exactMatches,
      ...prefixMatches,
      ...containsMatches
    ].slice(0, limit);
    
    const duration = Date.now() - startTime;
    console.log(`ブランド検索(${brandType}): ${duration}ms, クエリ:"${query}", 結果:${result.length}件`);
    
    return result;
    
  } catch (error) {
    console.error('ブランド候補取得エラー:', error);
    return [];
  }
}

// =============================================================================
// 一括データ取得の最適化
// =============================================================================
function getBulkInitializationData() {
  try {
    const startTime = Date.now();
    console.log('一括初期化データ取得開始');
    
    // 並列処理で複数のデータを同時取得
    const results = {};
    
    // マスタオプション
    results.masterOptions = getMasterOptionsOptimized();
    
    // カテゴリー階層
    results.categoryData = getCategoryRowsOptimized();
    
    // ブランドデータのプリロード（上位100件）
    results.topBrandsEn = (results.masterOptions['ブランド(英語)'] || []).slice(0, 100);
    results.topBrandsKana = (results.masterOptions['ブランド(カナ)'] || []).slice(0, 100);
    
    const duration = Date.now() - startTime;
    console.log(`一括初期化完了: ${duration}ms`);
    
    return {
      success: true,
      data: results,
      loadTime: duration
    };
    
  } catch (error) {
    console.error('一括初期化エラー:', error);
    return {
      success: false,
      error: error.message,
      data: {
        masterOptions: createEmptyMasterData(),
        categoryData: { ok: true, rows: [] },
        topBrandsEn: [],
        topBrandsKana: []
      }
    };
  }
}

// =============================================================================
// シート操作の最適化
// =============================================================================
function optimizedGetHeaderMap() {
  // 既存のgetHeaderMapCommon()にキャッシュ機能を追加
  const cacheKey = 'headerMap';
  const cached = getFromSessionCache(cacheKey);
  
  if (cached) {
    return cached;
  }
  
  const result = getHeaderMapCommon();
  setToSessionCache(cacheKey, result, 10 * 60 * 1000); // 10分間キャッシュ
  
  return result;
}

// セッションキャッシュ（簡易版）
const sessionCache = {};

function setToSessionCache(key, value, ttl = 5 * 60 * 1000) {
  sessionCache[key] = {
    value: value,
    expires: Date.now() + ttl
  };
}

function getFromSessionCache(key) {
  const cached = sessionCache[key];
  if (!cached) return null;
  
  if (Date.now() > cached.expires) {
    delete sessionCache[key];
    return null;
  }
  
  return cached.value;
}

function clearSessionCache() {
  Object.keys(sessionCache).forEach(key => delete sessionCache[key]);
}

// =============================================================================
// パフォーマンス計測
// =============================================================================
function measurePerformance(functionName, fn) {
  const startTime = Date.now();
  const startMemory = DriveApp.getStorageUsed(); // 概算
  
  try {
    const result = fn();
    const duration = Date.now() - startTime;
    
    console.log(`パフォーマンス[${functionName}]: ${duration}ms`);
    
    return {
      success: true,
      result: result,
      duration: duration
    };
    
  } catch (error) {
    const duration = Date.now() - startTime;
    
    console.error(`パフォーマンス[${functionName}]: エラー ${duration}ms - ${error.message}`);
    
    return {
      success: false,
      error: error,
      duration: duration
    };
  }
}

// =============================================================================
// パフォーマンステスト
// =============================================================================
function testPerformanceOptimizations() {
  console.log('=== パフォーマンス最適化テスト開始 ===');
  
  // キャッシュクリア
  clearMasterCache();
  clearSessionCache();
  
  // 1回目: キャッシュなし
  const test1 = measurePerformance('初回マスタデータ取得', () => {
    return getMasterOptionsOptimized();
  });
  
  // 2回目: キャッシュあり
  const test2 = measurePerformance('キャッシュ済みマスタデータ取得', () => {
    return getMasterOptionsOptimized();
  });
  
  // 一括初期化テスト
  const test3 = measurePerformance('一括初期化データ取得', () => {
    return getBulkInitializationData();
  });
  
  // ブランド検索テスト
  const test4 = measurePerformance('ブランド検索', () => {
    return getOptimizedBrandSuggestions('ブランド(英語)', 'adidas', 10);
  });
  
  console.log('=== パフォーマンス最適化テスト完了 ===');
  
  return {
    initialLoad: test1.duration,
    cachedLoad: test2.duration,
    bulkInitialization: test3.duration,
    brandSearch: test4.duration,
    cacheEfficiency: test1.duration > 0 ? (test1.duration - test2.duration) / test1.duration : 0
  };
}