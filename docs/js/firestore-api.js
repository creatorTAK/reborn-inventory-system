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

// CommonJS環境（Node.js等）向けエクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initializeFirestore,
    getUserList,
    getUserListFromFirestore,
    getUserByName,
    clearUserListCache,
    getUserListFromGAS,
    getUserListHybrid
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
    getUserListHybrid
  };
}
