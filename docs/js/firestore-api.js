/**
 * REBORN在庫管理システム - Firestore API連携モジュール
 * 
 * PWAからFirestoreを直接読み取るためのラッパー関数を提供します。
 * GAS Web Appの起動コスト（2〜2.5秒）を回避し、高速化を実現します。
 * 
 * @module firestore-api
 * @version 1.0.0
 * @created 2025-11-11
 * @related-issue ARCH-001
 */

// ============================================
// Firebase設定（reborn-chat統一）
// ============================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCe-mj6xoV1HbHkIOVqeHCjKjwwtCorUZQ",
  authDomain: "reborn-chat.firebaseapp.com",
  projectId: "reborn-chat",
  storageBucket: "reborn-chat.firebasestorage.app",
  messagingSenderId: "345706548795",
  appId: "1:345706548795:web:058a553da6b4b74db5161e"
};

// ============================================
// グローバル変数
// ============================================

let firebaseApp = null;
let firestoreDb = null;
let _initializePromise = null; // 初期化Promise（単一インスタンス管理）

// キャッシュ管理
let userListCache = null;
let cacheTimestamp = 0;
let productListCache = null;
let productCacheTimestamp = 0;
let brandsCache = null; // ブランドキャッシュ
let brandsCacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分間
const BRANDS_CACHE_DURATION = 30 * 60 * 1000; // ブランドは30分間キャッシュ

// ============================================
// Firebase初期化（Promise-based Singleton）
// ============================================

/**
 * Firebase/Firestoreを初期化
 * 複数回呼ばれても安全（シングルトン、Promise-based）
 *
 * @returns {Promise<Object>} Firestoreインスタンス
 */
async function initializeFirestore() {
  // 初期化中または初期化済みの場合、既存のPromiseを返す
  if (_initializePromise) {
    return _initializePromise;
  }

  // 新規初期化Promiseを作成
  _initializePromise = (async () => {
    // 既に初期化済みの場合はそのまま返す
    if (firestoreDb) {
      return firestoreDb;
    }

    try {
      console.log('[Firestore API] 初期化開始...');

      // Firebase SDKを動的インポート
      const { initializeApp, getApps } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
      const { getFirestore } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

      // 既に初期化済みか確認
      const existingApps = getApps();
      if (existingApps.length > 0) {
        firebaseApp = existingApps.find(app => app.name === 'firestore-api-app');
        if (!firebaseApp) {
          firebaseApp = initializeApp(FIREBASE_CONFIG, 'firestore-api-app');
        }
      } else {
        firebaseApp = initializeApp(FIREBASE_CONFIG, 'firestore-api-app');
      }

      firestoreDb = getFirestore(firebaseApp);
      console.log('[Firestore API] ✅ 初期化完了');

      return firestoreDb;
    } catch (error) {
      console.error('[Firestore API] ❌ 初期化エラー:', error);
      _initializePromise = null; // エラー時はPromiseをリセット（再試行可能に）
      throw error;
    }
  })();

  return _initializePromise;
}

// ============================================
// ユーザー関連API
// ============================================

/**
 * ユーザー一覧をFirestoreから取得
 * 
 * @returns {Promise<Array>} ユーザー一覧
 * @throws {Error} Firestore読み取りエラー
 * 
 * @example
 * const users = await getUserListFromFirestore();
 * console.log(users); // [{ userName: '山田太郎', ... }, ...]
 */
async function getUserListFromFirestore() {
  try {
    const startTime = performance.now();

    // Firestore初期化
    const db = await initializeFirestore();

    // Firebase SDKを動的インポート
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    // ユーザー一覧取得（アクティブユーザーのみ）
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('status', '==', 'アクティブ'));
    const snapshot = await getDocs(q);

    const users = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      users.push({
        id: doc.id,
        userName: data.userName,
        email: data.email || '',
        permission: data.permission || 'スタッフ',
        status: data.status || 'アクティブ',
        registeredAt: data.registeredAt ? data.registeredAt.toDate().toISOString() : '',
        userIconUrl: data.userIconUrl || ''
      });
    });

    const endTime = performance.now();
    console.log(`[Firestore API] getUserList: ${users.length}件取得 (${(endTime - startTime).toFixed(2)}ms)`);

    return users;

  } catch (error) {
    console.error('[Firestore API] getUserList エラー:', error);
    // エラー時は空配列を返す（GAS APIへのフォールバックは呼び出し側で実装）
    return [];
  }
}

/**
 * キャッシング付きユーザー一覧取得
 * 5分間キャッシュを保持し、高速化を実現
 * 
 * @param {boolean} forceRefresh - trueの場合、キャッシュを無視して再取得
 * @returns {Promise<Array>} ユーザー一覧
 * 
 * @example
 * // 通常取得（キャッシュ使用）
 * const users = await getUserList();
 * 
 * // 強制更新
 * const users = await getUserList(true);
 */
async function getUserList(forceRefresh = false) {
  const now = Date.now();

  // キャッシュ有効期間内かつ強制更新でない場合、キャッシュを返す
  if (!forceRefresh && userListCache && (now - cacheTimestamp) < CACHE_DURATION) {
    console.log('[Firestore API] getUserList: キャッシュから返却');
    return userListCache;
  }

  // Firestoreから取得
  console.log('[Firestore API] getUserList: Firestoreから取得');
  userListCache = await getUserListFromFirestore();
  cacheTimestamp = now;

  return userListCache;
}

/**
 * キャッシュをクリア
 * ユーザー情報が更新された場合に手動でクリアできる
 * 
 * @example
 * await clearUserListCache();
 * const users = await getUserList(); // 最新データを取得
 */
function clearUserListCache() {
  userListCache = null;
  cacheTimestamp = 0;
  console.log('[Firestore API] キャッシュクリア完了');
}

/**
 * 特定のユーザー情報を取得
 * 
 * @param {string} userName - ユーザー名
 * @returns {Promise<Object|null>} ユーザー情報（見つからない場合はnull）
 * 
 * @example
 * const user = await getUserByName('山田太郎');
 * if (user) {
 *   console.log(user.email);
 * }
 */
async function getUserByName(userName) {
  try {
    const db = await initializeFirestore();
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const userRef = doc(db, 'users', userName);
    const docSnap = await getDoc(userRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        userName: data.userName,
        email: data.email || '',
        permission: data.permission || 'スタッフ',
        status: data.status || 'アクティブ',
        registeredAt: data.registeredAt ? data.registeredAt.toDate().toISOString() : '',
        userIconUrl: data.userIconUrl || ''
      };
    }

    return null;

  } catch (error) {
    console.error('[Firestore API] getUserByName エラー:', error);
    return null;
  }
}

// ============================================
// 商品関連API（ARCH-001 Phase 3）
// ============================================

/**
 * 商品一覧をFirestoreから取得
 *
 * @param {Object} filters - 検索フィルタ（オプション）
 * @param {string} filters.status - ステータス
 * @param {string} filters.brand - ブランド
 * @param {string} filters.category - カテゴリ
 * @param {string} filters.person - 担当者
 * @returns {Promise<Array>} 商品一覧
 * @throws {Error} Firestore読み取りエラー
 *
 * @example
 * const products = await getProductListFromFirestore();
 * const inStock = await getProductListFromFirestore({ status: '在庫中' });
 */
async function getProductListFromFirestore(filters = {}) {
  try {
    const startTime = performance.now();

    // Firestore初期化
    const db = await initializeFirestore();

    // Firebase SDKを動的インポート
    const { collection, getDocs, query, where } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    // クエリ構築
    const productsRef = collection(db, 'products');
    let q = productsRef;

    // フィルタ適用
    const constraints = [];
    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    }
    if (filters.brand) {
      constraints.push(where('brand', '==', filters.brand));
    }
    if (filters.category) {
      constraints.push(where('category', '==', filters.category));
    }
    if (filters.person) {
      constraints.push(where('person', '==', filters.person));
    }

    if (constraints.length > 0) {
      q = query(productsRef, ...constraints);
    }

    // データ取得
    const snapshot = await getDocs(q);

    const products = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      products.push({
        id: doc.id,
        managementNumber: data.managementNumber || '',
        status: data.status || '',
        brand: data.brand || '',
        category: data.category || '',
        itemName: data.itemName || '',
        person: data.person || '',
        size: data.size || '',
        color: data.color || '',
        productName: data.productName || '',
        purchaseDate: data.purchaseDate || '',
        purchaseAmount: data.purchaseAmount || 0,
        listingDate: data.listingDate || '',
        listingAmount: data.listingAmount || 0,
        saleDate: data.saleDate || '',
        saleAmount: data.saleAmount || 0,
        profit: data.profit || 0,
        profitRate: data.profitRate || '',
        inventoryDays: data.inventoryDays || 0,
        registrant: data.registrant || '',
        registeredAt: data.registeredAt || '',
        lastEditor: data.lastEditor || '',
        updatedAt: data.updatedAt || '',
        imageUrl1: data.imageUrl1 || '',
        searchText: data.searchText || ''
      });
    });

    const endTime = performance.now();
    console.log(`[Firestore API] getProductList: ${products.length}件取得 (${(endTime - startTime).toFixed(2)}ms)`);

    return products;

  } catch (error) {
    console.error('[Firestore API] getProductList エラー:', error);
    return [];
  }
}

/**
 * キャッシング付き商品一覧取得
 *
 * @param {Object} filters - 検索フィルタ
 * @param {boolean} forceRefresh - キャッシュ強制更新
 * @returns {Promise<Array>} 商品一覧
 */
async function getProductList(filters = {}, forceRefresh = false) {
  const now = Date.now();

  // フィルタなし かつ キャッシュ有効 かつ 強制更新なし → キャッシュ返却
  const hasFilters = Object.keys(filters).length > 0;
  if (!hasFilters && !forceRefresh && productListCache && (now - productCacheTimestamp) < CACHE_DURATION) {
    console.log('[Firestore API] getProductList: キャッシュから返却');
    return productListCache;
  }

  // Firestoreから取得
  console.log('[Firestore API] getProductList: Firestoreから取得');
  const products = await getProductListFromFirestore(filters);

  // フィルタなしの場合のみキャッシュ
  if (!hasFilters) {
    productListCache = products;
    productCacheTimestamp = now;
  }

  return products;
}

/**
 * 特定の商品情報を管理番号で取得
 *
 * @param {string} managementNumber - 管理番号
 * @returns {Promise<Object|null>} 商品情報（見つからない場合はnull）
 *
 * @example
 * const product = await getProductByManagementNumber('A-001');
 */
async function getProductByManagementNumber(managementNumber) {
  try {
    const db = await initializeFirestore();
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    // ドキュメントIDは管理番号（特殊文字置換済み）
    const docId = managementNumber.replace(/[\/\.\$\#\[\]]/g, '_');
    const productRef = doc(db, 'products', docId);
    const docSnap = await getDoc(productRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        managementNumber: data.managementNumber || '',
        status: data.status || '',
        brand: data.brand || '',
        category: data.category || '',
        itemName: data.itemName || '',
        person: data.person || '',
        size: data.size || '',
        color: data.color || '',
        productName: data.productName || '',
        purchaseDate: data.purchaseDate || '',
        purchaseAmount: data.purchaseAmount || 0,
        listingDate: data.listingDate || '',
        listingAmount: data.listingAmount || 0,
        saleDate: data.saleDate || '',
        saleAmount: data.saleAmount || 0,
        profit: data.profit || 0,
        profitRate: data.profitRate || '',
        inventoryDays: data.inventoryDays || 0,
        imageUrl1: data.imageUrl1 || ''
      };
    }

    return null;

  } catch (error) {
    console.error('[Firestore API] getProductByManagementNumber エラー:', error);
    return null;
  }
}

/**
 * 商品キャッシュをクリア
 */
function clearProductListCache() {
  productListCache = null;
  productCacheTimestamp = 0;
  console.log('[Firestore API] 商品キャッシュクリア完了');
}

/**
 * ハイブリッド商品取得（Firestore優先、失敗時GAS API）
 *
 * @param {Object} filters - 検索フィルタ
 * @param {boolean} forceRefresh - キャッシュ強制更新
 * @returns {Promise<Array>} 商品一覧
 */
async function getProductListHybrid(filters = {}, forceRefresh = false) {
  try {
    // Firestore取得を試行
    const products = await getProductList(filters, forceRefresh);

    // データが取得できた場合はそのまま返す
    if (products && products.length > 0) {
      return products;
    }

    // データが空の場合、GAS APIにフォールバック
    console.log('[Firestore API] Firestoreが空 → GAS APIフォールバック');
    // TODO: GAS側のgetProductList APIを実装後、ここでフォールバック
    return [];

  } catch (error) {
    console.error('[Firestore API] 商品ハイブリッド取得エラー:', error);
    return [];
  }
}

// ============================================
// GAS APIフォールバック
// ============================================

/**
 * Firestore取得失敗時のGAS APIフォールバック
 * 
 * @returns {Promise<Array>} ユーザー一覧
 */
async function getUserListFromGAS() {
  try {
    // 既存のapi.jsのgetUserList()を使用
    if (window.GasApi && window.GasApi.getUserList) {
      console.log('[Firestore API] フォールバック: GAS API呼び出し');
      return await window.GasApi.getUserList();
    }

    console.warn('[Firestore API] GasApiが見つかりません');
    return [];

  } catch (error) {
    console.error('[Firestore API] GAS APIフォールバックエラー:', error);
    return [];
  }
}

/**
 * ハイブリッド取得（Firestore優先、失敗時GAS API）
 * 
 * @param {boolean} forceRefresh - キャッシュ強制更新
 * @returns {Promise<Array>} ユーザー一覧
 * 
 * @example
 * const users = await getUserListHybrid();
 */
async function getUserListHybrid(forceRefresh = false) {
  try {
    // Firestore取得を試行
    const users = await getUserList(forceRefresh);
    
    // データが取得できた場合はそのまま返す
    if (users && users.length > 0) {
      return users;
    }

    // データが空の場合、GAS APIにフォールバック
    console.log('[Firestore API] Firestoreが空 → GAS APIフォールバック');
    return await getUserListFromGAS();

  } catch (error) {
    console.error('[Firestore API] ハイブリッド取得エラー:', error);
    // 最終手段: GAS API
    return await getUserListFromGAS();
  }
}

// ============================================
// エクスポート
// ============================================

// ============================================
// マスタデータ取得 (ARCH-001 Phase 3.1)
// ============================================

/**
 * カテゴリマスタを取得
 * @returns {Promise<Object>} { ok: boolean, rows: Array }
 */
async function getCategoryMaster() {
  try {
    const db = await initializeFirestore();
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const docRef = doc(db, 'categories', 'master');
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      console.warn('カテゴリマスタが見つかりません');
      return { ok: true, rows: [] };
    }

    const data = docSnap.data();
    return {
      ok: true,
      rows: data.rows || [],
      updatedAt: data.updatedAt
    };
  } catch (error) {
    console.error('カテゴリマスタ取得エラー:', error);
    return { ok: false, msg: error.message, rows: [] };
  }
}

/**
 * マスタオプションを取得（フィールドごとに分割保存されたデータ）
 * @returns {Promise<Object>} 各フィールドの選択肢オブジェクト
 */
async function getMasterOptions() {
  try {
    const db = await initializeFirestore();
    const { doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    // インデックスドキュメントから全フィールド名を取得
    const indexRef = doc(db, 'masterOptions', '_index');
    const indexSnap = await getDoc(indexRef);

    if (!indexSnap.exists()) {
      console.warn('マスタオプションインデックスが見つかりません');
      return {};
    }

    const indexData = indexSnap.data();
    const fieldNames = indexData.fieldNames || [];

    // 各フィールドのデータを並列取得
    const options = {};
    const promises = fieldNames.map(async (fieldName) => {
      // フィールド名をURLセーフに変換
      const safeFieldName = fieldName
        .replace(/\//g, '_')
        .replace(/\(/g, '_')
        .replace(/\)/g, '_')
        .replace(/\s/g, '_');

      const fieldRef = doc(db, 'masterOptions', safeFieldName);
      const fieldSnap = await getDoc(fieldRef);

      if (fieldSnap.exists()) {
        const fieldData = fieldSnap.data();
        options[fieldName] = fieldData.items || [];
      } else {
        console.warn(`フィールド "${fieldName}" が見つかりません`);
        options[fieldName] = [];
      }
    });

    await Promise.all(promises);

    return options;
  } catch (error) {
    console.error('マスタオプション取得エラー:', error);
    return {};
  }
}

/**
 * 担当者名を取得（FCMトークンまたはメールアドレスから）
 * @param {string} identifier - FCMトークンまたはメールアドレス
 * @returns {Promise<Object>} { success: boolean, name: string, source: string }
 */
async function getOperatorName(identifier) {
  if (!identifier) {
    return { success: false, name: '', source: 'no_identifier' };
  }

  try {
    // usersコレクションから検索
    const users = await getUserList();

    // FCMトークンで検索
    let user = users.find(u => u.fcmToken === identifier);
    if (user && user.name) {
      return {
        success: true,
        name: user.name,
        iconUrl: user.iconUrl || '',
        source: 'fcm_token'
      };
    }

    // メールアドレスで検索
    user = users.find(u => u.email === identifier);
    if (user && user.name) {
      return {
        success: true,
        name: user.name,
        iconUrl: user.iconUrl || '',
        source: 'email'
      };
    }

    return { success: false, name: '', source: 'not_found' };
  } catch (error) {
    console.error('担当者名取得エラー:', error);
    return { success: false, name: '', source: 'error' };
  }
}

/**
 * キャッシュされたブランドから検索（高速フィルタリング）
 * @param {string} query - 検索クエリ
 * @param {number} limit - 取得件数
 * @returns {Array} 検索結果
 */
/**
 * バックグラウンドでブランドをプリロード（GAS版と同じ動作）
 * attachBrandSuggestFirestore呼び出し時に自動実行
 */
async function preloadBrandsInBackground() {
  // 既にロード済み、またはロード中の場合はスキップ
  if (brandsCache || window.brandsPreloading) {
    return;
  }

  window.brandsPreloading = true;

  try {
    console.log('📥 [BRANDS] プリロード開始（バックグラウンド）...');
    const startTime = performance.now();

    const db = await initializeFirestore();
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const brandsRef = collection(db, 'brands');
    const snapshot = await getDocs(brandsRef);

    const brands = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      brands.push({
        id: doc.id,
        nameEn: data.nameEn || '',
        nameKana: data.nameKana || '',
        searchText: (data.searchText || '').toLowerCase(),
        usageCount: data.usageCount || 0
      });
    });

    // グローバルキャッシュに保存
    brandsCache = brands;
    window.brandsCache = brands;
    brandsCacheTimestamp = Date.now();

    const endTime = performance.now();
    console.log(`✅ [BRANDS] プリロード完了: ${brands.length}件 (${(endTime - startTime).toFixed(2)}ms)`);

  } catch (error) {
    console.error('❌ [BRANDS] プリロードエラー:', error);
  } finally {
    window.brandsPreloading = false;
  }
}

/**
 * キャッシュされたブランドから検索（高速フィルタリング）
 * @param {string} query - 検索クエリ
 * @param {number} limit - 取得件数
 * @returns {Array} 検索結果
 */
function searchBrandsFromCache(query, limit) {
  const cache = brandsCache || window.brandsCache;

  if (!cache) {
    console.warn('[BRANDS] キャッシュがまだロードされていません');
    return [];
  }

  if (!query || query.length === 0) {
    // 空検索の場合は使用頻度上位を返す
    return cache
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, limit);
  }

  const normalizedQuery = query.toLowerCase();
  
  // 検索条件に一致するブランドをフィルタ
  const matches = cache.filter(brand => {
    return brand.searchText.includes(normalizedQuery);
  });

  // 使用頻度順にソートして返す
  return matches
    .sort((a, b) => b.usageCount - a.usageCount)
    .slice(0, limit);
}

// ============================================
// ブランド検索API (ARCH-001 Phase 3.2)
// ============================================

/**
 * ブランド検索（オートコンプリート用）
 * @param {string} query - 検索クエリ（英語名またはカナ名）
 * @param {number} limit - 取得件数（デフォルト50件）
 * @returns {Promise<Array>} ブランドリスト
 */
async function searchBrands(query = '', limit = 50) {
  try {
    const now = Date.now();

    // キャッシュが有効な場合はキャッシュから検索
    if (brandsCache && (now - brandsCacheTimestamp) < BRANDS_CACHE_DURATION) {
      console.log('🚀 [BRANDS] キャッシュから検索');
      return searchBrandsFromCache(query, limit);
    }

    // キャッシュがない、または期限切れの場合は全件取得
    console.log('📥 [BRANDS] Firestoreから全件取得中...');
    const startTime = performance.now();

    const db = await initializeFirestore();
    const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const brandsRef = collection(db, 'brands');
    const snapshot = await getDocs(brandsRef);

    const brands = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      brands.push({
        id: doc.id,
        nameEn: data.nameEn || '',
        nameKana: data.nameKana || '',
        searchText: (data.searchText || '').toLowerCase(),
        usageCount: data.usageCount || 0
      });
    });

    // キャッシュに保存
    brandsCache = brands;
    brandsCacheTimestamp = now;

    const endTime = performance.now();
    console.log(`✅ [BRANDS] 全件取得完了: ${brands.length}件 (${(endTime - startTime).toFixed(2)}ms)`);

    // キャッシュから検索して返す
    return searchBrandsFromCache(query, limit);

  } catch (error) {
    console.error('ブランド検索エラー:', error);
    return [];
  }
}

/**
 * すべてのブランドを取得（初期ロード用）
 * @param {number} limit - 取得件数制限（デフォルト500件）
 * @returns {Promise<Array>} ブランドリスト
 */
async function getAllBrands(limit = 500) {
  try {
    const db = await initializeFirestore();
    const { collection, getDocs, query, orderBy, limit: fbLimit } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const brandsRef = collection(db, 'brands');

    // 使用頻度の高い順に取得
    const q = query(brandsRef, orderBy('usageCount', 'desc'), fbLimit(limit));
    const snapshot = await getDocs(q);

    const brands = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      brands.push({
        id: doc.id,
        nameEn: data.nameEn || '',
        nameKana: data.nameKana || '',
        usageCount: data.usageCount || 0
      });
    });

    console.log(`📦 [BRANDS] 全件取得完了: ${brands.length}件`);
    return brands;

  } catch (error) {
    console.error('ブランド全件取得エラー:', error);
    return [];
  }
}

/**
 * ブランド使用カウント更新
 * @param {string} brandId - ブランドID
 * @returns {Promise<boolean>} 成功/失敗
 */
async function incrementBrandUsageCount(brandId) {
  try {
    const db = await initializeFirestore();
    const { doc, updateDoc, increment, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const brandRef = doc(db, 'brands', brandId);

    // usageCountをインクリメント
    await updateDoc(brandRef, {
      usageCount: increment(1),
      updatedAt: serverTimestamp()
    });

    console.log(`✅ [BRANDS] 使用カウント更新: ${brandId}`);
    return true;

  } catch (error) {
    console.error('ブランド使用カウント更新エラー:', error);
    return false;
  }
}

// ============================================
// ブランドCRUD操作 (MASTER-001)
// ============================================

/**
 * 新規ブランドを追加
 * @param {string} nameEn - ブランド英語名
 * @param {string} nameKana - ブランドカナ名
 * @returns {Promise<Object>} { success: boolean, brandId?: string, error?: string }
 */
async function createBrand(nameEn, nameKana) {
  try {
    // バリデーション
    if (!nameEn || !nameEn.trim()) {
      return { success: false, error: 'ブランド英語名は必須です' };
    }
    if (!nameKana || !nameKana.trim()) {
      return { success: false, error: 'ブランドカナ名は必須です' };
    }

    const db = await initializeFirestore();
    const { collection, addDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    // searchText生成（英語名 + カナ名を小文字化）
    const searchText = `${nameEn.toLowerCase()},${nameKana}`.toLowerCase();

    const brandData = {
      nameEn: nameEn.trim(),
      nameKana: nameKana.trim(),
      searchText: searchText,
      usageCount: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const brandsRef = collection(db, 'brands');
    const docRef = await addDoc(brandsRef, brandData);

    console.log(`✅ [BRANDS] ブランド追加成功: ${docRef.id} (${nameEn})`);

    // キャッシュに新規ブランドを追加（クリアしない）
    if (brandsCache && window.brandsCache) {
      const newBrand = {
        id: docRef.id,
        nameEn: nameEn.trim(),
        nameKana: nameKana.trim(),
        searchText: searchText,
        usageCount: 0
      };
      brandsCache.push(newBrand);
      window.brandsCache.push(newBrand);
      console.log('✅ [BRANDS] キャッシュに新規ブランド追加:', newBrand);
    }

    return {
      success: true,
      brandId: docRef.id,
      brand: {
        id: docRef.id,
        nameEn: nameEn.trim(),
        nameKana: nameKana.trim(),
        usageCount: 0
      }
    };

  } catch (error) {
    console.error('❌ [BRANDS] ブランド追加エラー:', error);
    return {
      success: false,
      error: error.message || 'ブランドの追加に失敗しました'
    };
  }
}

/**
 * ブランドを削除
 * @param {string} brandId - ブランドID
 * @returns {Promise<Object>} { success: boolean, error?: string }
 */
async function deleteBrand(brandId) {
  try {
    if (!brandId || !brandId.trim()) {
      return { success: false, error: 'ブランドIDは必須です' };
    }

    const db = await initializeFirestore();
    const { doc, deleteDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const brandRef = doc(db, 'brands', brandId);
    await deleteDoc(brandRef);

    console.log(`✅ [BRANDS] ブランド削除成功: ${brandId}`);

    // キャッシュから削除（クリアしない）
    if (brandsCache && window.brandsCache) {
      brandsCache = brandsCache.filter(b => b.id !== brandId);
      window.brandsCache = window.brandsCache.filter(b => b.id !== brandId);
      console.log('✅ [BRANDS] キャッシュからブランド削除:', brandId);
    }

    return { success: true };

  } catch (error) {
    console.error('❌ [BRANDS] ブランド削除エラー:', error);
    return {
      success: false,
      error: error.message || 'ブランドの削除に失敗しました'
    };
  }
}

/**
 * ブランド情報を更新
 * @param {string} brandId - ブランドID
 * @param {string} nameEn - ブランド英語名
 * @param {string} nameKana - ブランドカナ名
 * @returns {Promise<Object>} { success: boolean, error?: string }
 */
async function updateBrand(brandId, nameEn, nameKana) {
  try {
    // バリデーション
    if (!brandId || !brandId.trim()) {
      return { success: false, error: 'ブランドIDは必須です' };
    }
    if (!nameEn || !nameEn.trim()) {
      return { success: false, error: 'ブランド英語名は必須です' };
    }
    if (!nameKana || !nameKana.trim()) {
      return { success: false, error: 'ブランドカナ名は必須です' };
    }

    const db = await initializeFirestore();
    const { doc, updateDoc, serverTimestamp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    // searchText生成
    const searchText = `${nameEn.toLowerCase()},${nameKana}`.toLowerCase();

    const brandRef = doc(db, 'brands', brandId);
    await updateDoc(brandRef, {
      nameEn: nameEn.trim(),
      nameKana: nameKana.trim(),
      searchText: searchText,
      updatedAt: serverTimestamp()
    });

    console.log(`✅ [BRANDS] ブランド更新成功: ${brandId} (${nameEn})`);

    // キャッシュをクリア
    brandsCache = null;
    window.brandsCache = null;
    brandsCacheTimestamp = 0;

    return { success: true };

  } catch (error) {
    console.error('❌ [BRANDS] ブランド更新エラー:', error);
    return {
      success: false,
      error: error.message || 'ブランドの更新に失敗しました'
    };
    }
}

// ============================================
// 汎用マスタ管理API（MASTER-002）
// ============================================

/**
 * 汎用マスタ取得（コレクション全件）
 * 
 * @param {string} collection - Firestoreコレクション名
 * @param {object} options - オプション
 * @param {string} options.sortBy - ソートフィールド名
 * @param {string} options.sortOrder - ソート順序('asc'/'desc')
 * @param {number} options.limit - 取得件数制限
 * @returns {Promise<Array>} マスタデータ配列
 */
async function getMasterData(collection, options = {}) {
  try {
    const db = await initializeFirestore();
    const {
      collection: firestoreCollection,
      getDocs,
      query,
      orderBy,
      limit: firestoreLimit,
      startAfter
    } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    // クエリ構築
    let q = firestoreCollection(db, collection);
    const queryConstraints = [];

    // ページネーション用のソート（idでソート）
    if (options.limit || options.startAfter) {
      queryConstraints.push(orderBy('id', 'asc'));
    }

    // カスタムソート（ページネーション時は上書きされる）
    if (options.sortBy && !options.limit && !options.startAfter) {
      const sortOrder = options.sortOrder || 'asc';
      queryConstraints.push(orderBy(options.sortBy, sortOrder));
    }

    // 件数制限
    if (options.limit) {
      queryConstraints.push(firestoreLimit(options.limit));
    }

    // ページネーション開始位置
    if (options.startAfter) {
      queryConstraints.push(startAfter(options.startAfter.id));
    }

    // クエリ適用
    if (queryConstraints.length > 0) {
      q = query(q, ...queryConstraints);
    }

    const snapshot = await getDocs(q);
    const data = [];

    snapshot.forEach((doc) => {
      data.push({
        id: doc.id,
        ...doc.data()
      });
    });

    console.log(`✅ [Master API] ${collection}取得完了: ${data.length}件`);
    return data;

  } catch (error) {
    console.error(`❌ [Master API] ${collection}取得エラー:`, error);
    throw error;
  }
}

/**
 * 汎用マスタ作成
 * 
 * @param {string} collection - Firestoreコレクション名
 * @param {object} data - マスタデータ
 * @param {boolean} includeUsageCount - 使用回数カウント機能を含めるか
 * @returns {Promise<object>} { success: boolean, id?: string, error?: string }
 */
async function createMaster(collection, data, includeUsageCount = false) {
  try {
    const db = await initializeFirestore();
    const {
      collection: firestoreCollection,
      addDoc,
      serverTimestamp
    } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const masterData = {
      ...data,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    // 使用回数カウント機能
    if (includeUsageCount) {
      masterData.usageCount = 0;
    }

    const docRef = await addDoc(firestoreCollection(db, collection), masterData);
    console.log(`✅ [Master API] ${collection}作成成功: ${docRef.id}`);

    return {
      success: true,
      id: docRef.id
    };

  } catch (error) {
    console.error(`❌ [Master API] ${collection}作成エラー:`, error);
    return {
      success: false,
      error: error.message || 'マスタの作成に失敗しました'
    };
  }
}

/**
 * 汎用マスタ更新
 * 
 * @param {string} collection - Firestoreコレクション名
 * @param {string} id - ドキュメントID
 * @param {object} data - 更新データ
 * @returns {Promise<object>} { success: boolean, error?: string }
 */
async function updateMaster(collection, id, data) {
  try {
    if (!id || !id.trim()) {
      return { success: false, error: 'IDは必須です' };
    }

    const db = await initializeFirestore();
    const {
      doc,
      updateDoc,
      serverTimestamp
    } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const updateData = {
      ...data,
      updatedAt: serverTimestamp()
    };

    const docRef = doc(db, collection, id);
    await updateDoc(docRef, updateData);

    console.log(`✅ [Master API] ${collection}更新成功: ${id}`);
    return { success: true };

  } catch (error) {
    console.error(`❌ [Master API] ${collection}更新エラー:`, error);
    return {
      success: false,
      error: error.message || 'マスタの更新に失敗しました'
    };
  }
}

/**
 * マスタ使用回数をインクリメント（汎用）
 *
 * @param {string} collection - Firestoreコレクション名
 * @param {string} id - ドキュメントID
 * @returns {Promise<object>} { success: boolean, error?: string }
 */
async function incrementMasterUsageCount(collection, id) {
  try {
    if (!id || !id.trim()) {
      return { success: false, error: 'IDは必須です' };
    }

    const db = await initializeFirestore();
    const {
      doc,
      updateDoc,
      increment,
      serverTimestamp
    } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const docRef = doc(db, collection, id);
    await updateDoc(docRef, {
      usageCount: increment(1),
      updatedAt: serverTimestamp()
    });

    console.log(`✅ [Master API] ${collection}使用回数更新: ${id}`);
    return { success: true };

  } catch (error) {
    console.error(`❌ [Master API] ${collection}使用回数更新エラー:`, error);
    return {
      success: false,
      error: error.message || '使用回数の更新に失敗しました'
    };
  }
}

/**
 * 汎用マスタ削除
 *
 * @param {string} collection - Firestoreコレクション名
 * @param {string} id - ドキュメントID
 * @returns {Promise<object>} { success: boolean, error?: string }
 */
async function deleteMaster(collection, id) {
  try {
    if (!id || !id.trim()) {
      return { success: false, error: 'IDは必須です' };
    }

    const db = await initializeFirestore();
    const {
      doc,
      deleteDoc
    } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const docRef = doc(db, collection, id);
    await deleteDoc(docRef);

    console.log(`✅ [Master API] ${collection}削除成功: ${id}`);
    return { success: true };

  } catch (error) {
    console.error(`❌ [Master API] ${collection}削除エラー:`, error);
    return {
      success: false,
      error: error.message || 'マスタの削除に失敗しました'
    };
  }
}

/**
 * 汎用マスタ検索
 * 
 * @param {string} collection - Firestoreコレクション名
 * @param {string} searchQuery - 検索クエリ
 * @param {Array} searchFields - 検索対象フィールド名配列
 * @param {number} limit - 取得件数制限
 * @returns {Promise<Array>} 検索結果配列
 */
async function searchMaster(collection, searchQuery, searchFields, limit = 100) {
  try {
    // まず全件取得してクライアント側でフィルタリング
    // (Firestoreは部分一致検索が不得意なため)
    const allData = await getMasterData(collection);

    const query = searchQuery.toLowerCase();
    const results = allData.filter(item => {
      return searchFields.some(field => {
        const fieldValue = item[field];
        if (!fieldValue) return false;
        return fieldValue.toString().toLowerCase().includes(query);
      });
    });

    console.log(`✅ [Master API] ${collection}検索完了: ${results.length}件 / ${allData.length}件`);
    return results.slice(0, limit);

  } catch (error) {
    console.error(`❌ [Master API] ${collection}検索エラー:`, error);
    throw error;
  }
}

// CommonJS環境（Node.js等）向けエクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeFirestore,
    getUserList,
    getUserListFromFirestore,
    getUserByName,
    clearUserListCache,
    getUserListFromGAS,
    getUserListHybrid,
    getProductList,
    getProductListFromFirestore,
    getProductByManagementNumber,
    clearProductListCache,
    getProductListHybrid,
    getCategoryMaster,
    getMasterOptions,
    getOperatorName,
    searchBrands,
    getAllBrands,
    incrementBrandUsageCount,
    preloadBrandsInBackground,
    searchBrandsFromCache,
    createBrand,
    deleteBrand,
    updateBrand,
    getMasterData,
    createMaster,
    updateMaster,
    deleteMaster,
    searchMaster
  };
}

// ブラウザ環境向けエクスポート
if (typeof window !== 'undefined') {
  window.FirestoreApi = {
    initializeFirestore,
    getUserList,
    getUserListFromFirestore,
    getUserByName,
    clearUserListCache,
    getUserListFromGAS,
    getUserListHybrid,
    getProductList,
    getProductListFromFirestore,
    getProductByManagementNumber,
    clearProductListCache,
    getProductListHybrid,
    getCategoryMaster,
    getMasterOptions,
    getOperatorName,
    searchBrands,
    getAllBrands,
    incrementBrandUsageCount,
    preloadBrandsInBackground,
    searchBrandsFromCache,
    createBrand,
    deleteBrand,
    updateBrand,
    getMasterData,
    createMaster,
    updateMaster,
    deleteMaster,
    searchMaster,
    incrementMasterUsageCount
  };
}

// ES6モジュールエクスポート（import文用）
export {
  initializeFirestore,
  getUserList,
  getUserListFromFirestore,
  getUserByName,
  clearUserListCache,
  getUserListFromGAS,
  getUserListHybrid,
  getProductList,
  getProductListFromFirestore,
  getProductByManagementNumber,
  clearProductListCache,
  getProductListHybrid,
  getCategoryMaster,
  getMasterOptions,
  getOperatorName,
  searchBrands,
  getAllBrands,
  incrementBrandUsageCount,
  preloadBrandsInBackground,
  searchBrandsFromCache,
  createBrand,
  deleteBrand,
  updateBrand,
  getMasterData,
  createMaster,
  updateMaster,
  deleteMaster,
  searchMaster,
  incrementMasterUsageCount
};

// グローバルスコープに公開（非モジュールスクリプトから使用するため）
// master-cache.js 等の通常スクリプトから window.initializeFirestore でアクセス可能
window.initializeFirestore = initializeFirestore;

// 初期化Promiseをグローバルに公開（バックグラウンドプリロード用）
// master-cache.js から await window.firestoreReady で初期化完了を待機可能
window.firestoreReady = initializeFirestore();
