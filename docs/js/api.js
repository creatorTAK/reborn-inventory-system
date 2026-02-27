/**
 * REBORN在庫管理システム - APIモジュール
 *
 * GAS API依存を除去済み。Firestore経由でデータ取得。
 *
 * @module api
 * @version 2.0.0
 * @created 2025-11-11
 * @updated 2026-02-27
 */

console.log('[API Module] Loaded v2.0.0 - GAS依存除去済み');

// ============================================
// ユーザー一覧取得（Firestore経由）
// ============================================

/**
 * ユーザー一覧を取得（Firestore API経由）
 *
 * @returns {Promise<Array>} ユーザー一覧
 */
async function getUserList() {
  const startTime = performance.now();

  if (typeof window.FirestoreApi !== 'undefined' && window.FirestoreApi.getUserListHybrid) {
    console.log('[API] Firestore経由でユーザー一覧取得');
    const users = await window.FirestoreApi.getUserListHybrid();
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(0);
    console.log(`[API] Firestore取得完了: ${duration}ms`);
    return users;
  }

  throw new Error('[API] FirestoreApi未ロード: ユーザー一覧取得不可');
}

// ============================================
// 画像プロキシ（レガシー互換）
// ============================================

/**
 * Google Driveの画像URLを取得（レガシー互換用）
 *
 * @param {string} fileId - Google DriveファイルID
 * @returns {string} 画像URL
 */
function getImageProxyUrl(fileId) {
  return `https://drive.google.com/uc?id=${fileId}&export=view`;
}

// ============================================
// エクスポート
// ============================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { getUserList, getImageProxyUrl };
}

if (typeof window !== 'undefined') {
  window.GasApi = { getUserList, getImageProxyUrl };
}
