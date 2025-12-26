/**
 * REBORN在庫管理システム - 期間ベース棚卸API
 *
 * 棚卸期間の管理、スタッフ進捗追跡、チェック結果保存を行う
 *
 * @module stocktaking-period-api
 * @version 1.0.0
 * @created 2025-12-26
 * @related-issue STOCKTAKING-001
 */

// ============================================
// Firebase初期化（compat版）
// ============================================

const FIREBASE_CONFIG_PERIOD = {
  apiKey: "AIzaSyCe-mj6xoV1HbHkIOVqeHCjKjwwtCorUZQ",
  authDomain: "furira.jp",
  projectId: "reborn-chat",
  storageBucket: "reborn-chat.firebasestorage.app",
  messagingSenderId: "345706548795",
  appId: "1:345706548795:web:058a553da6b4b74db5161e"
};

// compat版Firebaseを初期化（既存の初期化があれば使用）
function initializeFirebaseCompat() {
  if (typeof firebase === 'undefined') {
    console.warn('[Stocktaking Period API] firebase compat SDKが読み込まれていません');
    return null;
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG_PERIOD);
  }

  return firebase.firestore();
}

// Firestoreインスタンスを取得（初期化済みのものがあればそれを使用）
async function getFirestoreInstance() {
  // window.dbがあればそれを使用（他のページとの互換性）
  if (window.db && typeof window.db.collection === 'function') {
    return window.db;
  }

  // compat版で初期化
  const db = initializeFirebaseCompat();
  if (db) {
    window.db = db;
    return db;
  }

  throw new Error('Firestoreの初期化に失敗しました');
}

// ============================================
// 棚卸期間管理
// ============================================

/**
 * 新規棚卸期間を作成
 * @param {Object} periodData - 期間データ
 * @returns {Promise<string>} 作成されたドキュメントID
 */
async function createStocktakingPeriod(periodData) {
  const db = await getFirestoreInstance();

  const docData = {
    name: periodData.name,
    startDate: firebase.firestore.Timestamp.fromDate(new Date(periodData.startDate)),
    endDate: firebase.firestore.Timestamp.fromDate(new Date(periodData.endDate)),
    status: 'draft',
    createdBy: firebase.auth().currentUser?.email || 'unknown',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    settings: {
      autoExcludeSoldProducts: true
    },
    stats: {
      totalStaff: 0,
      completedStaff: 0,
      totalProducts: 0,
      checkedProducts: 0,
      discrepancyCount: 0
    }
  };

  const docRef = await db.collection('stocktakingPeriods').add(docData);
  console.log('[Stocktaking API] 棚卸期間作成:', docRef.id);
  return docRef.id;
}

/**
 * アクティブな棚卸期間を取得
 * @returns {Promise<Object|null>} アクティブな期間、またはnull
 */
async function getActiveStocktakingPeriod() {
  const db = await getFirestoreInstance();

  const snapshot = await db.collection('stocktakingPeriods')
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (snapshot.empty) {
    return null;
  }

  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
    startDate: doc.data().startDate?.toDate(),
    endDate: doc.data().endDate?.toDate()
  };
}

/**
 * 棚卸期間を取得
 * @param {string} periodId - 期間ID
 * @returns {Promise<Object|null>} 期間データ
 */
async function getStocktakingPeriod(periodId) {
  const db = await getFirestoreInstance();

  const doc = await db.collection('stocktakingPeriods').doc(periodId).get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
    startDate: doc.data().startDate?.toDate(),
    endDate: doc.data().endDate?.toDate()
  };
}

/**
 * 全ての棚卸期間を取得（新しい順）
 * @param {number} limit - 取得件数上限
 * @returns {Promise<Array>} 期間リスト
 */
async function getAllStocktakingPeriods(limit = 20) {
  const db = await getFirestoreInstance();

  const snapshot = await db.collection('stocktakingPeriods')
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    startDate: doc.data().startDate?.toDate(),
    endDate: doc.data().endDate?.toDate()
  }));
}

/**
 * 棚卸期間を更新
 * @param {string} periodId - 期間ID
 * @param {Object} updates - 更新データ
 * @returns {Promise<void>}
 */
async function updateStocktakingPeriod(periodId, updates) {
  const db = await getFirestoreInstance();

  const updateData = {
    ...updates,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  // 日付フィールドがある場合はTimestampに変換
  if (updates.startDate) {
    updateData.startDate = firebase.firestore.Timestamp.fromDate(new Date(updates.startDate));
  }
  if (updates.endDate) {
    updateData.endDate = firebase.firestore.Timestamp.fromDate(new Date(updates.endDate));
  }

  await db.collection('stocktakingPeriods').doc(periodId).update(updateData);
  console.log('[Stocktaking API] 棚卸期間更新:', periodId);
}

/**
 * 棚卸期間を開始（アクティブ化）
 * @param {string} periodId - 期間ID
 * @returns {Promise<Object>} 初期化結果（スタッフ数、商品数）
 */
async function activateStocktakingPeriod(periodId) {
  const db = await getFirestoreInstance();

  // 既にアクティブな期間がないか確認
  const activePeriod = await getActiveStocktakingPeriod();
  if (activePeriod && activePeriod.id !== periodId) {
    throw new Error('既にアクティブな棚卸期間があります: ' + activePeriod.name);
  }

  // スタッフ別の商品数を集計
  const staffProgress = await initializeStaffProgress(periodId);

  // 期間をアクティブ化
  await db.collection('stocktakingPeriods').doc(periodId).update({
    status: 'active',
    activatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    stats: {
      totalStaff: staffProgress.totalStaff,
      completedStaff: 0,
      totalProducts: staffProgress.totalProducts,
      checkedProducts: 0,
      discrepancyCount: 0
    }
  });

  console.log('[Stocktaking API] 棚卸期間アクティブ化:', periodId);
  return staffProgress;
}

/**
 * 棚卸期間を終了
 * @param {string} periodId - 期間ID
 * @returns {Promise<void>}
 */
async function completeStocktakingPeriod(periodId) {
  const db = await getFirestoreInstance();

  await db.collection('stocktakingPeriods').doc(periodId).update({
    status: 'completed',
    completedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  console.log('[Stocktaking API] 棚卸期間終了:', periodId);
}

// ============================================
// スタッフ進捗管理
// ============================================

/**
 * 棚卸タスクが有効なユーザー一覧を取得
 * @returns {Promise<Set<string>>} 棚卸担当者のメールアドレスSet
 */
async function getStocktakingEnabledUsers() {
  const db = await getFirestoreInstance();

  const usersSnapshot = await db.collection('users').get();
  const enabledUsers = new Set();

  usersSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const assignedTasks = data.assignedTasks || [];

    // assignedTasksに'stocktaking'が含まれているか確認
    if (assignedTasks.includes('stocktaking')) {
      enabledUsers.add(doc.id); // doc.idはメールアドレス
    }
  });

  console.log('[Stocktaking API] 棚卸担当者:', enabledUsers.size, '名');
  return enabledUsers;
}

/**
 * スタッフ進捗を初期化（期間アクティブ化時に呼び出し）
 * タスク担当設定で「棚卸」が有効なユーザーのみ対象
 * @param {string} periodId - 期間ID
 * @returns {Promise<Object>} 集計結果
 */
async function initializeStaffProgress(periodId) {
  const db = await getFirestoreInstance();

  // 1. 棚卸タスクが有効なユーザーを取得
  const stocktakingUsers = await getStocktakingEnabledUsers();

  if (stocktakingUsers.size === 0) {
    console.warn('[Stocktaking API] 棚卸担当者が設定されていません');
    return { totalStaff: 0, totalProducts: 0, warning: '棚卸担当者が設定されていません' };
  }

  // 2. 販売済み以外のpurchaseSlotsを取得
  const slotsSnapshot = await db.collection('purchaseSlots')
    .where('status', '!=', 'sold')
    .get();

  // 3. 棚卸担当者の商品のみを集計
  const staffCounts = {};
  const staffNames = {};

  slotsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    const email = data.personEmail || data.person || 'unknown';
    const name = data.person || 'unknown';

    // 棚卸タスクが有効なユーザーのみ対象
    if (!stocktakingUsers.has(email)) {
      return; // スキップ
    }

    if (!staffCounts[email]) {
      staffCounts[email] = 0;
      staffNames[email] = name;
    }
    staffCounts[email]++;
  });

  // 4. 各スタッフの進捗ドキュメントを作成
  const batch = db.batch();
  let totalStaff = 0;
  let totalProducts = 0;

  for (const [email, count] of Object.entries(staffCounts)) {
    if (email === 'unknown') continue;

    const progressRef = db.collection('stocktakingPeriods')
      .doc(periodId)
      .collection('staffProgress')
      .doc(email);

    batch.set(progressRef, {
      staffEmail: email,
      staffName: staffNames[email],
      totalProducts: count,
      checkedProducts: 0,
      matchedProducts: 0,
      discrepancyProducts: 0,
      status: 'not_started',
      lastCheckAt: null,
      completedAt: null,
      excludedProductIds: []
    });

    totalStaff++;
    totalProducts += count;
  }

  await batch.commit();
  console.log('[Stocktaking API] スタッフ進捗初期化完了:', totalStaff, 'スタッフ,', totalProducts, '商品');
  console.log('[Stocktaking API] 対象担当者:', Object.keys(staffCounts).join(', '));

  return { totalStaff, totalProducts };
}

/**
 * スタッフ進捗を取得
 * @param {string} periodId - 期間ID
 * @param {string} staffEmail - スタッフメール
 * @returns {Promise<Object|null>} 進捗データ
 */
async function getStaffProgress(periodId, staffEmail) {
  const db = await getFirestoreInstance();

  const doc = await db.collection('stocktakingPeriods')
    .doc(periodId)
    .collection('staffProgress')
    .doc(staffEmail)
    .get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
    lastCheckAt: doc.data().lastCheckAt?.toDate(),
    completedAt: doc.data().completedAt?.toDate()
  };
}

/**
 * 全スタッフの進捗を取得
 * @param {string} periodId - 期間ID
 * @returns {Promise<Array>} 全スタッフの進捗リスト
 */
async function getAllStaffProgress(periodId) {
  const db = await getFirestoreInstance();

  const snapshot = await db.collection('stocktakingPeriods')
    .doc(periodId)
    .collection('staffProgress')
    .orderBy('staffName')
    .get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    lastCheckAt: doc.data().lastCheckAt?.toDate(),
    completedAt: doc.data().completedAt?.toDate()
  }));
}

/**
 * スタッフ進捗を更新（チェック結果保存後に呼び出し）
 * @param {string} periodId - 期間ID
 * @param {string} staffEmail - スタッフメール
 * @returns {Promise<void>}
 */
async function recalculateStaffProgress(periodId, staffEmail) {
  const db = await getFirestoreInstance();

  // チェック結果を集計
  const resultsSnapshot = await db.collection('stocktakingPeriods')
    .doc(periodId)
    .collection('checkResults')
    .where('staffEmail', '==', staffEmail)
    .get();

  let checkedProducts = 0;
  let matchedProducts = 0;
  let discrepancyProducts = 0;

  resultsSnapshot.docs.forEach(doc => {
    const data = doc.data();
    if (data.status === 'excluded') return;

    checkedProducts++;
    if (data.difference === 0) {
      matchedProducts++;
    } else {
      discrepancyProducts++;
    }
  });

  // 進捗ドキュメントを取得
  const progressRef = db.collection('stocktakingPeriods')
    .doc(periodId)
    .collection('staffProgress')
    .doc(staffEmail);

  const progressDoc = await progressRef.get();
  if (!progressDoc.exists) return;

  const totalProducts = progressDoc.data().totalProducts || 0;
  const excludedCount = progressDoc.data().excludedProductIds?.length || 0;
  const effectiveTotal = totalProducts - excludedCount;

  // ステータス判定
  let status = 'not_started';
  if (checkedProducts > 0) {
    status = (checkedProducts >= effectiveTotal) ? 'completed' : 'in_progress';
  }

  // 更新
  const updateData = {
    checkedProducts,
    matchedProducts,
    discrepancyProducts,
    status,
    lastCheckAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  if (status === 'completed') {
    updateData.completedAt = firebase.firestore.FieldValue.serverTimestamp();
  }

  await progressRef.update(updateData);

  // 期間全体の統計も更新
  await updatePeriodStats(periodId);

  console.log('[Stocktaking API] スタッフ進捗更新:', staffEmail, checkedProducts, '/', effectiveTotal);
}

/**
 * 期間全体の統計を更新
 * @param {string} periodId - 期間ID
 * @returns {Promise<void>}
 */
async function updatePeriodStats(periodId) {
  const db = await getFirestoreInstance();

  // 全スタッフの進捗を集計
  const allProgress = await getAllStaffProgress(periodId);

  let totalProducts = 0;
  let checkedProducts = 0;
  let discrepancyCount = 0;
  let completedStaff = 0;

  allProgress.forEach(progress => {
    totalProducts += progress.totalProducts || 0;
    checkedProducts += progress.checkedProducts || 0;
    discrepancyCount += progress.discrepancyProducts || 0;
    if (progress.status === 'completed') {
      completedStaff++;
    }
  });

  await db.collection('stocktakingPeriods').doc(periodId).update({
    'stats.totalStaff': allProgress.length,
    'stats.completedStaff': completedStaff,
    'stats.totalProducts': totalProducts,
    'stats.checkedProducts': checkedProducts,
    'stats.discrepancyCount': discrepancyCount,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
}

// ============================================
// チェック結果管理
// ============================================

/**
 * チェック結果を保存
 * @param {string} periodId - 期間ID
 * @param {Object} checkData - チェックデータ
 * @returns {Promise<string>} 保存されたドキュメントID
 */
async function saveCheckResult(periodId, checkData) {
  const db = await getFirestoreInstance();
  const currentUser = firebase.auth().currentUser;

  const docData = {
    slotId: checkData.slotId,
    productId: checkData.productId || null,
    managementNumber: checkData.managementNumber || '',
    productName: checkData.productName || '',
    staffEmail: currentUser?.email || checkData.staffEmail,
    staffName: checkData.staffName || '',
    bookQuantity: checkData.bookQuantity || 1,
    actualQuantity: checkData.actualQuantity,
    difference: (checkData.actualQuantity || 0) - (checkData.bookQuantity || 1),
    status: 'checked',
    excludeReason: null,
    checkedAt: firebase.firestore.FieldValue.serverTimestamp(),
    note: checkData.note || ''
  };

  // 差異がある場合はステータスを変更
  if (docData.difference !== 0) {
    docData.status = 'discrepancy';
  }

  // slotIdをドキュメントIDとして使用（重複防止）
  const docRef = db.collection('stocktakingPeriods')
    .doc(periodId)
    .collection('checkResults')
    .doc(checkData.slotId);

  await docRef.set(docData, { merge: true });

  // スタッフ進捗を再計算
  await recalculateStaffProgress(periodId, currentUser?.email || checkData.staffEmail);

  console.log('[Stocktaking API] チェック結果保存:', checkData.slotId);
  return checkData.slotId;
}

/**
 * チェック結果を取得
 * @param {string} periodId - 期間ID
 * @param {string} slotId - スロットID
 * @returns {Promise<Object|null>} チェック結果
 */
async function getCheckResult(periodId, slotId) {
  const db = await getFirestoreInstance();

  const doc = await db.collection('stocktakingPeriods')
    .doc(periodId)
    .collection('checkResults')
    .doc(slotId)
    .get();

  if (!doc.exists) {
    return null;
  }

  return {
    id: doc.id,
    ...doc.data(),
    checkedAt: doc.data().checkedAt?.toDate()
  };
}

/**
 * スタッフのチェック結果一覧を取得
 * @param {string} periodId - 期間ID
 * @param {string} staffEmail - スタッフメール（省略時は全件）
 * @returns {Promise<Array>} チェック結果リスト
 */
async function getCheckResults(periodId, staffEmail = null) {
  const db = await getFirestoreInstance();

  let query = db.collection('stocktakingPeriods')
    .doc(periodId)
    .collection('checkResults');

  if (staffEmail) {
    query = query.where('staffEmail', '==', staffEmail);
  }

  const snapshot = await query.orderBy('checkedAt', 'desc').get();

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    checkedAt: doc.data().checkedAt?.toDate()
  }));
}

/**
 * 商品を除外（売却など）
 * @param {string} periodId - 期間ID
 * @param {string} slotId - スロットID
 * @param {string} reason - 除外理由（sold, transferred, manual）
 * @returns {Promise<void>}
 */
async function excludeProduct(periodId, slotId, reason) {
  const db = await getFirestoreInstance();

  // チェック結果があれば除外ステータスに更新
  const resultRef = db.collection('stocktakingPeriods')
    .doc(periodId)
    .collection('checkResults')
    .doc(slotId);

  const resultDoc = await resultRef.get();

  if (resultDoc.exists) {
    await resultRef.update({
      status: 'excluded',
      excludeReason: reason,
      excludedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  // スロットから担当者を取得して除外リストに追加
  const slotDoc = await db.collection('purchaseSlots').doc(slotId).get();
  if (slotDoc.exists) {
    const staffEmail = slotDoc.data().personEmail || slotDoc.data().person;

    if (staffEmail) {
      const progressRef = db.collection('stocktakingPeriods')
        .doc(periodId)
        .collection('staffProgress')
        .doc(staffEmail);

      await progressRef.update({
        excludedProductIds: firebase.firestore.FieldValue.arrayUnion(slotId)
      });

      // 進捗を再計算
      await recalculateStaffProgress(periodId, staffEmail);
    }
  }

  console.log('[Stocktaking API] 商品除外:', slotId, reason);
}

// ============================================
// ユーティリティ関数
// ============================================

/**
 * 期間がアクティブかどうかを確認
 * @param {Object} period - 期間オブジェクト
 * @returns {boolean}
 */
function isPeriodActive(period) {
  if (!period || period.status !== 'active') {
    return false;
  }

  const now = new Date();
  return now >= period.startDate && now <= period.endDate;
}

/**
 * 残り日数を計算
 * @param {Object} period - 期間オブジェクト
 * @returns {number} 残り日数（負の場合は終了済み）
 */
function getRemainingDays(period) {
  if (!period || !period.endDate) {
    return 0;
  }

  const now = new Date();
  const end = new Date(period.endDate);
  const diffTime = end.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * 期間を日本語フォーマットで表示
 * @param {Date} startDate - 開始日
 * @param {Date} endDate - 終了日
 * @returns {string}
 */
function formatPeriodRange(startDate, endDate) {
  const format = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
  };

  return `${format(startDate)} ~ ${format(endDate)}`;
}

/**
 * 進捗率を計算
 * @param {number} checked - チェック済み数
 * @param {number} total - 総数
 * @returns {number} 進捗率（0-100）
 */
function calculateProgress(checked, total) {
  if (!total || total === 0) return 0;
  return Math.round((checked / total) * 100);
}

/**
 * 現在のユーザーの担当商品を取得（未チェック優先）
 * @param {string} periodId - 期間ID
 * @returns {Promise<Array>} 商品リスト
 */
async function getMyStocktakingProducts(periodId) {
  const db = await getFirestoreInstance();
  const currentUser = firebase.auth().currentUser;

  if (!currentUser) {
    throw new Error('ログインが必要です');
  }

  // ユーザー情報を取得（person名との紐付け用）
  const userDoc = await db.collection('users').doc(currentUser.email).get();
  const userData = userDoc.exists ? userDoc.data() : {};
  const userName = userData.userName || null;

  // 棚卸タスクが有効か確認
  const assignedTasks = userData.assignedTasks || [];
  if (!assignedTasks.includes('stocktaking')) {
    console.warn('[Stocktaking API] このユーザーは棚卸タスクが割り当てられていません');
    return []; // 棚卸担当でない場合は空配列を返す
  }

  // 販売済み以外の商品を取得
  const slotsSnapshot = await db.collection('purchaseSlots')
    .where('status', '!=', 'sold')
    .get();

  // 担当者でフィルタリング
  const mySlots = slotsSnapshot.docs.filter(doc => {
    const data = doc.data();
    return data.personEmail === currentUser.email ||
           data.person === userName ||
           data.person === currentUser.email;
  });

  // チェック済み情報を取得
  const checkResults = await getCheckResults(periodId, currentUser.email);
  const checkedSlotIds = new Set(checkResults.map(r => r.slotId));

  // 除外リストを取得
  const progress = await getStaffProgress(periodId, currentUser.email);
  const excludedIds = new Set(progress?.excludedProductIds || []);

  // 商品リストを構築
  const products = mySlots
    .filter(doc => !excludedIds.has(doc.id))
    .map(doc => ({
      id: doc.id,
      ...doc.data(),
      isChecked: checkedSlotIds.has(doc.id),
      checkResult: checkResults.find(r => r.slotId === doc.id) || null
    }));

  // 未チェック優先でソート
  products.sort((a, b) => {
    if (a.isChecked !== b.isChecked) {
      return a.isChecked ? 1 : -1;
    }
    return 0;
  });

  return products;
}

// グローバルに公開
window.StocktakingPeriodAPI = {
  // 期間管理
  createStocktakingPeriod,
  getActiveStocktakingPeriod,
  getStocktakingPeriod,
  getAllStocktakingPeriods,
  updateStocktakingPeriod,
  activateStocktakingPeriod,
  completeStocktakingPeriod,

  // スタッフ進捗
  getStaffProgress,
  getAllStaffProgress,
  recalculateStaffProgress,

  // チェック結果
  saveCheckResult,
  getCheckResult,
  getCheckResults,
  excludeProduct,

  // ユーティリティ
  isPeriodActive,
  getRemainingDays,
  formatPeriodRange,
  calculateProgress,
  getMyStocktakingProducts
};

console.log('[Stocktaking Period API] モジュール読み込み完了');
