/**
 * REBORN在庫管理システム - GAS API連携モジュール
 * 
 * PWAからGoogle Apps Script (GAS)のAPIエンドポイントを呼び出すための
 * ラッパー関数を提供します。
 * 
 * @module api
 * @version 1.0.0
 * @created 2025-11-11
 * @related-issue ARCH-001
 */

// ============================================
// 定数定義
// ============================================

/**
 * GAS API ベースURL
 * @constant {string}
 */
const GAS_API_URL = 'https://script.google.com/macros/s/AKfycbx6ybbRLDqKQJ8IR-NPoVP8981Gtozzz0N3880XanEGRS4--iZtset8PFrVcD_u9YAHMA/exec';

/**
 * APIタイムアウト時間（ミリ秒）
 * @constant {number}
 */
const API_TIMEOUT = 30000;

// ============================================
// コアAPI関数
// ============================================

/**
 * GAS APIを呼び出す汎用関数
 * 
 * @param {string} action - APIアクション名
 * @param {Object} params - 追加パラメータ（オプション）
 * @param {Object} options - リクエストオプション
 * @param {number} options.timeout - タイムアウト時間（ミリ秒）
 * @returns {Promise<Object>} GASからのJSON レスポンス
 * @throws {Error} ネットワークエラーまたはタイムアウト時
 * 
 * @example
 * const result = await callGasApi('test');
 * console.log(result.status); // 'success'
 * 
 * @example
 * const users = await callGasApi('getUserListForUI');
 * console.log(users);
 */
async function callGasApi(action, params = {}, options = {}) {
  try {
    // URLクエリパラメータを構築
    const url = new URL(GAS_API_URL);
    url.searchParams.append('action', action);
    
    // 追加パラメータをクエリストリングに追加
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null) {
        const paramValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
        url.searchParams.append(key, paramValue);
      }
    }
    
    // タイムアウト制御付きでfetch実行
    const timeout = options.timeout || API_TIMEOUT;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'Accept': 'application/json'
      }
    });
    
    clearTimeout(timeoutId);
    
    // HTTPステータスチェック
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    // JSONレスポンスをパース
    const data = await response.json();
    return data;
    
  } catch (error) {
    // エラーハンドリング
    if (error.name === 'AbortError') {
      throw new Error(`GAS API タイムアウト: ${action} (${API_TIMEOUT}ms)`);
    }
    console.error(`[API Error] action: ${action}`, error);
    throw error;
  }
}

// ============================================
// 基本API関数
// ============================================

/**
 * GAS API接続テスト
 * 
 * @returns {Promise<Object>} テスト結果
 * @returns {string} return.status - 'success' または 'error'
 * @returns {string} return.message - メッセージ
 * @returns {string} return.timestamp - タイムスタンプ
 * @returns {Object} return.data - プロジェクト情報
 * 
 * @example
 * const result = await testGasApi();
 * if (result.status === 'success') {
 *   console.log('GAS接続成功:', result.message);
 * }
 */
async function testGasApi() {
  return await callGasApi('test');
}

/**
 * ユーザー一覧を取得（PWA UI表示用）
 *
 * Firestore API優先で取得し、失敗時はGAS APIにフォールバック。
 * これにより、GAS 3800ms → Firestore 60-300ms (10-63倍高速化) を実現。
 *
 * @returns {Promise<Array>} ユーザー一覧
 * @returns {string} return[].id - ユーザーID
 * @returns {string} return[].userName - ユーザー名
 * @returns {string} return[].email - メールアドレス
 * @returns {string} return[].permission - 権限（オーナー/スタッフ/外注）
 * @returns {string} return[].status - ステータス
 * @returns {string} return[].userIconUrl - アイコンURL
 *
 * @example
 * const users = await getUserList();
 * users.forEach(user => {
 *   console.log(user.userName, user.permission);
 * });
 *
 * @since 1.1.0 Firestore優先取得に変更（ARCH-001 Phase 1.5）
 */
async function getUserList() {
  const startTime = performance.now();

  // デバッグ表示を作成（画面右上）
  function showDebugInfo(source, duration) {
    let debugDiv = document.getElementById('api-debug-info');
    if (!debugDiv) {
      debugDiv = document.createElement('div');
      debugDiv.id = 'api-debug-info';
      debugDiv.style.cssText = 'position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.8);color:white;padding:10px;border-radius:5px;z-index:99999;font-size:14px;font-family:monospace;';
      document.body.appendChild(debugDiv);
    }
    const color = source === 'Firestore' ? '#00ff00' : '#ff9900';
    debugDiv.innerHTML = `<div style="color:${color}">📊 ${source}: ${duration}ms</div>`;
    setTimeout(() => debugDiv.remove(), 5000);
  }

  try {
    // Firestore API優先で取得
    if (typeof window.FirestoreApi !== 'undefined' && window.FirestoreApi.getUserListHybrid) {
      console.log('[API] 🔥 Firestore経由でユーザー一覧取得');
      const users = await window.FirestoreApi.getUserListHybrid();
      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(0);
      console.log(`[API] ✅ Firestore取得完了: ${duration}ms`);
      showDebugInfo('Firestore', duration);
      return users;
    }

    // FirestoreApiが未ロードの場合
    console.warn('[API] ⚠️ FirestoreApi未ロード、GAS APIにフォールバック');
    showDebugInfo('FirestoreApi未ロード', 0);
  } catch (error) {
    console.error('[API] ❌ Firestore取得エラー、GAS APIにフォールバック:', error);
    showDebugInfo('Firestoreエラー', 0);
  }

  // フォールバック: 従来のGAS API
  console.log('[API] 📡 GAS API経由でユーザー一覧取得（フォールバック）');
  const users = await callGasApi('getUserListForUI');
  const endTime = performance.now();
  const duration = (endTime - startTime).toFixed(0);
  console.log(`[API] ✅ GAS取得完了: ${duration}ms`);
  showDebugInfo('GAS API', duration);
  return users;
}

/**
 * オペレーター名を設定
 * 
 * @param {string} operatorName - オペレーター名
 * @returns {Promise<Object>} 設定結果
 * 
 * @example
 * await setOperatorName('山田太郎');
 */
async function setOperatorName(operatorName) {
  return await callGasApi('setOperatorName', { operatorName });
}

/**
 * 既存ユーザー数を取得
 * 
 * @returns {Promise<number>} ユーザー数
 * 
 * @example
 * const count = await getExistingUserCount();
 * console.log(`登録ユーザー数: ${count}`);
 */
async function getExistingUserCount() {
  const result = await callGasApi('getExistingUserCount');
  return result.count || 0;
}

// ============================================
// チャット関連API関数
// ============================================

/**
 * 新着メッセージを取得
 * 
 * @param {string} chatRoomId - チャットルームID
 * @param {string} lastMessageId - 最後に取得したメッセージID（オプション）
 * @returns {Promise<Array>} メッセージ一覧
 * 
 * @example
 * const messages = await getNewMessages('room123');
 */
async function getNewMessages(chatRoomId, lastMessageId = null) {
  const params = { chatRoomId };
  if (lastMessageId) {
    params.lastMessageId = lastMessageId;
  }
  return await callGasApi('getNewMessages', params);
}

/**
 * FCM購読登録
 * 
 * @param {string} userId - ユーザーID
 * @param {string} token - FCMトークン
 * @returns {Promise<Object>} 登録結果
 * 
 * @example
 * await subscribeFCM('user123', 'fcm_token_...');
 */
async function subscribeFCM(userId, token) {
  return await callGasApi('subscribeFCM', { userId, token });
}

/**
 * FCM通知送信
 * 
 * @param {string} userId - 送信先ユーザーID
 * @param {string} title - 通知タイトル
 * @param {string} body - 通知本文
 * @param {Object} data - 追加データ（オプション）
 * @returns {Promise<Object>} 送信結果
 * 
 * @example
 * await sendFCM('user123', '新着メッセージ', '山田さんからメッセージが届きました');
 */
async function sendFCM(userId, title, body, data = {}) {
  return await callGasApi('sendFCM', { userId, title, body, data });
}

/**
 * 通知履歴を取得
 * 
 * @param {string} userId - ユーザーID
 * @returns {Promise<Array>} 通知履歴一覧
 * 
 * @example
 * const history = await getNotificationHistory('user123');
 */
async function getNotificationHistory(userId) {
  return await callGasApi('getNotificationHistory', { userId });
}

// ============================================
// 在庫管理関連API関数
// ============================================

/**
 * 商品一覧を検索（フィルタ付き）
 *
 * @param {Object} filters - 検索フィルタ
 * @param {string} filters.status - ステータスでフィルタ（オプション）
 * @param {string} filters.brand - ブランドでフィルタ（オプション）
 * @param {string} filters.category - カテゴリでフィルタ（オプション）
 * @param {string} filters.person - 担当者でフィルタ（オプション）
 * @returns {Promise<Array>} 商品一覧
 *
 * @example
 * const products = await searchInventory({});
 * const inStock = await searchInventory({ status: '在庫' });
 * const nike = await searchInventory({ brand: 'NIKE' });
 */
async function searchInventory(filters = {}) {
  return await callGasApi('search_inventory', filters);
}

/**
 * 在庫ダッシュボードデータを取得
 *
 * @returns {Promise<Object>} ダッシュボードデータ
 * @returns {number} return.totalProducts - 総商品数
 * @returns {number} return.lowStockCount - 在庫少ない商品数
 * @returns {Array} return.recentActivity - 最近のアクティビティ
 *
 * @example
 * const dashboard = await getInventoryDashboard();
 * console.log(`総商品数: ${dashboard.totalProducts}`);
 */
async function getInventoryDashboard() {
  return await callGasApi('getInventoryDashboard');
}

/**
 * 商品詳細を取得
 * 
 * @param {string} productId - 商品ID
 * @returns {Promise<Object>} 商品詳細データ
 * 
 * @example
 * const product = await getProductDetail('PROD-001');
 * console.log(product.name, product.stock);
 */
async function getProductDetail(productId) {
  return await callGasApi('getProductDetail', { productId });
}

/**
 * 商品ステータスを更新
 * 
 * @param {string} productId - 商品ID
 * @param {string} status - 新しいステータス
 * @returns {Promise<Object>} 更新結果
 * 
 * @example
 * await updateProductStatus('PROD-001', 'active');
 */
async function updateProductStatus(productId, status) {
  return await callGasApi('updateProductStatus', { productId, status });
}

/**
 * 商品情報を更新
 * 
 * @param {string} productId - 商品ID
 * @param {Object} productData - 更新する商品データ
 * @returns {Promise<Object>} 更新結果
 * 
 * @example
 * await updateProduct('PROD-001', {
 *   name: '新商品名',
 *   price: 1000,
 *   stock: 50
 * });
 */
async function updateProduct(productId, productData) {
  return await callGasApi('updateProduct', { productId, ...productData });
}

/**
 * 商品を複製
 * 
 * @param {string} productId - 複製元商品ID
 * @returns {Promise<Object>} 複製結果（新しい商品ID含む）
 * 
 * @example
 * const result = await duplicateProduct('PROD-001');
 * console.log('新商品ID:', result.newProductId);
 */
async function duplicateProduct(productId) {
  return await callGasApi('duplicateProduct', { productId });
}

// ============================================
// アラート管理関連API関数
// ============================================

/**
 * 在庫アラート設定を取得
 * 
 * @returns {Promise<Array>} アラート設定一覧
 * 
 * @example
 * const settings = await getInventoryAlertSettings();
 */
async function getInventoryAlertSettings() {
  return await callGasApi('getInventoryAlertSettings');
}

/**
 * 在庫アラート設定を更新
 * 
 * @param {string} settingId - 設定ID
 * @param {Object} settingData - 更新する設定データ
 * @returns {Promise<Object>} 更新結果
 * 
 * @example
 * await updateInventoryAlertSetting('alert-001', {
 *   threshold: 10,
 *   enabled: true
 * });
 */
async function updateInventoryAlertSetting(settingId, settingData) {
  return await callGasApi('updateInventoryAlertSetting', { settingId, ...settingData });
}

/**
 * 在庫アラートチェックを実行
 * 
 * @returns {Promise<Object>} チェック結果
 * @returns {Array} return.alerts - 発生したアラート一覧
 * 
 * @example
 * const result = await runInventoryAlertCheck();
 * if (result.alerts.length > 0) {
 *   console.log('アラート発生:', result.alerts);
 * }
 */
async function runInventoryAlertCheck() {
  return await callGasApi('runInventoryAlertCheck');
}

// ============================================
// ユーザー管理関連API関数
// ============================================

/**
 * ユーザー権限を更新
 * 
 * @param {string} userId - ユーザーID
 * @param {string} permission - 権限レベル
 * @returns {Promise<Object>} 更新結果
 * 
 * @example
 * await updateUserPermission('user123', 'admin');
 */
async function updateUserPermission(userId, permission) {
  return await callGasApi('updateUserPermission', { userId, permission });
}

/**
 * ユーザー権限を取得
 * 
 * @param {string} userId - ユーザーID
 * @returns {Promise<Object>} ユーザー権限情報
 * 
 * @example
 * const permission = await getUserPermission('user123');
 * console.log(permission.role);
 */
async function getUserPermission(userId) {
  return await callGasApi('getUserPermission', { userId });
}

// ============================================
// 画像プロキシAPI関数
// ============================================

/**
 * Google Driveの画像URLを取得（3rd-party cookie問題回避）
 * 
 * @param {string} fileId - Google DriveファイルID
 * @returns {string} プロキシ経由の画像URL
 * 
 * @example
 * const imageUrl = getImageProxyUrl('1ABC...XYZ');
 * document.querySelector('img').src = imageUrl;
 */
function getImageProxyUrl(fileId) {
  const url = new URL(GAS_API_URL);
  url.searchParams.append('action', 'getImage');
  url.searchParams.append('id', fileId);
  return url.toString();
}

// ============================================
// エクスポート
// ============================================

// CommonJS環境（Node.js等）向けエクスポート
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // コア
    callGasApi,
    testGasApi,
    
    // 基本
    getUserList,
    setOperatorName,
    getExistingUserCount,
    
    // チャット
    getNewMessages,
    subscribeFCM,
    sendFCM,
    getNotificationHistory,
    
    // 在庫管理
    searchInventory,
    getInventoryDashboard,
    getProductDetail,
    updateProductStatus,
    updateProduct,
    duplicateProduct,
    
    // アラート
    getInventoryAlertSettings,
    updateInventoryAlertSetting,
    runInventoryAlertCheck,
    
    // ユーザー管理
    updateUserPermission,
    getUserPermission,
    
    // 画像
    getImageProxyUrl
  };
}

// ES6モジュール環境向けエクスポート
if (typeof window !== 'undefined') {
  window.GasApi = {
    // コア
    callGasApi,
    testGasApi,
    
    // 基本
    getUserList,
    setOperatorName,
    getExistingUserCount,
    
    // チャット
    getNewMessages,
    subscribeFCM,
    sendFCM,
    getNotificationHistory,
    
    // 在庫管理
    searchInventory,
    getInventoryDashboard,
    getProductDetail,
    updateProductStatus,
    updateProduct,
    duplicateProduct,
    
    // アラート
    getInventoryAlertSettings,
    updateInventoryAlertSetting,
    runInventoryAlertCheck,
    
    // ユーザー管理
    updateUserPermission,
    getUserPermission,
    
    // 画像
    getImageProxyUrl
  };
}
