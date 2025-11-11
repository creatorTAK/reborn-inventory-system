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

// キャッシュ管理
let userListCache = null;
let cacheTimestamp = 0;
let productListCache = null;
let productCacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5分間

// ============================================
// Firebase初期化
// ============================================

/**
 * Firebase/Firestoreを初期化
 * 複数回呼ばれても安全（シングルトン）
 * 
 * @returns {Promise<Object>} Firestoreインスタンス
 */
async function initializeFirestore() {
  if (firestoreDb) {
    return firestoreDb;
  }

  try {
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
    console.log('[Firestore API] 初期化完了');

    return firestoreDb;
  } catch (error) {
    console.error('[Firestore API] 初期化エラー:', error);
    throw error;
  }
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
    const db = await initializeFirestore();
    const { collection, getDocs, query: fbQuery, where, orderBy, limit: fbLimit } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

    const brandsRef = collection(db, 'brands');

    // クエリが空の場合は、使用頻度の高い上位N件を返す
    if (!query || query.trim() === '') {
      const q = fbQuery(brandsRef, orderBy('usageCount', 'desc'), fbLimit(limit));
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

      console.log(`🔍 [BRANDS] 人気上位取得: ${brands.length}件`);
      return brands;
    }

    // 検索クエリがある場合は、全件取得してクライアント側フィルタ
    // （Firestoreの制限により、部分一致検索は全件取得が必要）
    const snapshot = await getDocs(brandsRef);
    const searchLower = query.toLowerCase();

    const brands = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      const nameEn = (data.nameEn || '').toLowerCase();
      const nameKana = data.nameKana || '';

      // 英語名またはカナ名で前方一致
      if (nameEn.startsWith(searchLower) || nameKana.startsWith(query)) {
        brands.push({
          id: doc.id,
          nameEn: data.nameEn || '',
          nameKana: data.nameKana || '',
          usageCount: data.usageCount || 0
        });
      }
    });

    // 使用頻度でソート → 上位N件
    brands.sort((a, b) => b.usageCount - a.usageCount);
    const results = brands.slice(0, limit);

    console.log(`🔍 [BRANDS] 検索完了: "${query}" → ${results.length}件`);
    return results;

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
    incrementBrandUsageCount
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
    incrementBrandUsageCount
  };
}
