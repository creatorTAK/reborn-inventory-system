// ========================================
// 汎用マスタキャッシュシステム（IndexedDB）
// MASTER-002: バックグラウンドプリロード対応
// ブランド、カテゴリなど複数マスタを統一管理
// ========================================

const MASTER_CACHE_CONFIG = {
  DB_NAME: 'RebornMasterCache',
  DB_VERSION: 2, // メタデータストア追加のためバージョンアップ
  CACHE_TTL: 3600000, // 1時間（ミリ秒）
  MAX_RETRY: 3,
  COLLECTIONS: {
    brands: 'brands',
    categories: 'categories'
  }
};

class MasterCacheManager {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.preloadPromises = {}; // コレクションごとのプリロードPromise
  }

  /**
   * IndexedDB初期化（複数ストア対応）
   */
  async initialize() {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(MASTER_CACHE_CONFIG.DB_NAME, MASTER_CACHE_CONFIG.DB_VERSION);

      request.onerror = () => {
        console.error('[MasterCache] IndexedDB初期化エラー:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('[MasterCache] IndexedDB初期化完了');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // メタデータストア作成（iframe間共有のため）
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'collection' });
          console.log('[MasterCache] metadataストア作成完了');
        }

        // ブランドストア作成
        if (!db.objectStoreNames.contains(MASTER_CACHE_CONFIG.COLLECTIONS.brands)) {
          const brandsStore = db.createObjectStore(MASTER_CACHE_CONFIG.COLLECTIONS.brands, { keyPath: 'id' });
          brandsStore.createIndex('name', 'name', { unique: false });
          console.log('[MasterCache] brandsストア作成完了');
        }

        // カテゴリストア作成
        if (!db.objectStoreNames.contains(MASTER_CACHE_CONFIG.COLLECTIONS.categories)) {
          const categoriesStore = db.createObjectStore(MASTER_CACHE_CONFIG.COLLECTIONS.categories, { keyPath: 'id' });
          categoriesStore.createIndex('fullPath', 'fullPath', { unique: false });
          console.log('[MasterCache] categoriesストア作成完了');
        }
      };
    });
  }

  /**
   * キャッシュメタデータ取得（IndexedDB版、iframe間共有）
   */
  async getCacheMetadata(collection) {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      const request = store.get(collection);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        console.error(`[MasterCache] ${collection}: メタデータ取得エラー`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * キャッシュメタデータ保存（IndexedDB版、iframe間共有）
   */
  async saveCacheMetadata(collection, count) {
    await this.initialize();

    const metadata = {
      collection: collection, // keyPath
      count: count,
      timestamp: Date.now(),
      version: MASTER_CACHE_CONFIG.DB_VERSION
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(['metadata'], 'readwrite');
      const store = transaction.objectStore('metadata');
      store.put(metadata);

      transaction.oncomplete = () => {
        console.log(`[MasterCache] ${collection}: メタデータ保存完了`);
        resolve();
      };

      transaction.onerror = () => {
        console.error(`[MasterCache] ${collection}: メタデータ保存エラー`, transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * キャッシュが有効か判定
   */
  async isCacheValid(collection) {
    const metadata = await this.getCacheMetadata(collection);

    if (!metadata) {
      console.log(`[MasterCache] ${collection}: メタデータなし（初回）`);
      return false;
    }

    const age = Date.now() - metadata.timestamp;
    const valid = age < MASTER_CACHE_CONFIG.CACHE_TTL;

    console.log(`[MasterCache] ${collection}: キャッシュ年齢=${(age / 1000).toFixed(0)}秒, 有効=${valid}`);
    return valid;
  }

  /**
   * キャッシュからデータ取得
   */
  async getFromCache(collection) {
    await this.initialize();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([collection], 'readonly');
      const store = transaction.objectStore(collection);
      const request = store.getAll();

      request.onsuccess = () => {
        console.log(`[MasterCache] ${collection}: キャッシュから${request.result.length}件取得`);
        resolve(request.result);
      };

      request.onerror = () => {
        console.error(`[MasterCache] ${collection}: 読み込みエラー`, request.error);
        reject(request.error);
      };
    });
  }

  /**
   * キャッシュにデータ保存（チャンク分割で安定化）
   */
  async saveToCache(collection, data) {
    await this.initialize();

    const CHUNK_SIZE = 1000; // 1000件ずつ分割保存
    const totalChunks = Math.ceil(data.length / CHUNK_SIZE);

    console.log(`[MasterCache] ${collection}: ${data.length}件を${totalChunks}チャンクに分割して保存開始`);

    try {
      // ステップ1: 既存データクリア
      await new Promise((resolve, reject) => {
        const transaction = this.db.transaction([collection], 'readwrite');
        const store = transaction.objectStore(collection);
        store.clear();

        transaction.oncomplete = () => {
          console.log(`[MasterCache] ${collection}: 既存データクリア完了`);
          resolve();
        };
        transaction.onerror = () => reject(transaction.error);
      });

      // ステップ2: チャンクごとに保存
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, data.length);
        const chunk = data.slice(start, end);

        await new Promise((resolve, reject) => {
          const transaction = this.db.transaction([collection], 'readwrite');
          const store = transaction.objectStore(collection);

          chunk.forEach(item => {
            store.add(item);
          });

          transaction.oncomplete = () => {
            console.log(`[MasterCache] ${collection}: チャンク ${i + 1}/${totalChunks} 保存完了 (${chunk.length}件)`);
            resolve();
          };
          transaction.onerror = () => reject(transaction.error);
        });
      }

      // メタデータ保存
      await this.saveCacheMetadata(collection, data.length);
      console.log(`[MasterCache] ${collection}: ✅ ${data.length}件の保存完了`);

    } catch (error) {
      console.error(`[MasterCache] ${collection}: 保存エラー`, error);
      throw error;
    }
  }

  /**
   * Firestoreからデータ取得（動的importで確実にモジュールをロード）
   * Exponential backoff retry + タイムアウト付き
   */
  async fetchFromFirestore(collection, maxAttempts = 5) {
    console.log(`[MasterCache] ${collection}: Firestoreから取得開始`);

    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        // タイムアウト付きPromise（60秒）
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('取得タイムアウト (60秒)')), 60000);
        });

        const fetchPromise = (async () => {
          // 動的importでfirestore-api.jsモジュールを確実にロード
          console.log(`[MasterCache] ${collection}: モジュールインポート開始`);
          const firestoreModule = await import('/js/firestore-api.js');
          console.log(`[MasterCache] ${collection}: モジュールインポート完了`);

          // 初期化完了を待機（window.firestoreReadyを使用）
          if (window.firestoreReady) {
            console.log(`[MasterCache] ${collection}: Firestore初期化待機中...`);
            await window.firestoreReady;
            console.log(`[MasterCache] ${collection}: Firestore初期化完了`);
          }

          // getMasterData関数を取得
          const getMasterData = firestoreModule.getMasterData || window.FirestoreApi?.getMasterData;

          if (!getMasterData) {
            throw new Error('getMasterData関数が見つかりません');
          }

          console.log(`[MasterCache] ${collection}: getMasterData呼び出し開始`);
          // データ取得
          const data = await getMasterData(collection);
          console.log(`[MasterCache] ${collection}: Firestoreから${data.length}件取得`);
          return data;
        })();

        // タイムアウトとの競争
        const data = await Promise.race([fetchPromise, timeoutPromise]);
        return data;

      } catch (error) {
        attempt++;
        console.error(`[MasterCache] ${collection}: 取得試行 ${attempt}/${maxAttempts} 失敗:`, error);
        console.error(`[MasterCache] ${collection}: エラー詳細:`, {
          message: error.message,
          stack: error.stack,
          type: error.constructor.name
        });

        if (attempt >= maxAttempts) {
          console.error(`[MasterCache] ${collection}: 最大試行回数超過`);
          throw error;
        }

        // Exponential backoff（200ms → 400ms → 800ms → 1600ms）
        const delay = 200 * Math.pow(2, attempt);
        console.log(`[MasterCache] ${collection}: ${delay}ms待機後に再試行...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * データ取得（キャッシュ優先、Firestore フォールバック）
   */
  async getData(collection) {
    try {
      // キャッシュ有効性チェック
      const cacheValid = await this.isCacheValid(collection);

      if (cacheValid) {
        // キャッシュから取得
        const cachedData = await this.getFromCache(collection);
        if (cachedData && cachedData.length > 0) {
          console.log(`[MasterCache] ${collection}: ✅ キャッシュ利用 (${cachedData.length}件)`);
          return cachedData;
        }
      }

      // キャッシュ無効 or 空 → Firestoreから取得
      const data = await this.fetchFromFirestore(collection);

      // キャッシュに保存
      await this.saveToCache(collection, data);

      console.log(`[MasterCache] ${collection}: ✅ Firestore読み込み完了 (${data.length}件)`);
      return data;

    } catch (error) {
      console.error(`[MasterCache] ${collection}: エラー`, error);

      // エラー時はキャッシュから取得を試みる
      try {
        const cachedData = await this.getFromCache(collection);
        if (cachedData && cachedData.length > 0) {
          console.warn(`[MasterCache] ${collection}: ⚠️ エラー発生、古いキャッシュ利用 (${cachedData.length}件)`);
          return cachedData;
        }
      } catch (cacheError) {
        console.error(`[MasterCache] ${collection}: キャッシュ取得も失敗`, cacheError);
      }

      return [];
    }
  }

  /**
   * バックグラウンドプリロード
   */
  async preloadInBackground(collection) {
    console.log(`[MasterCache] ========== ${collection}: preloadInBackground() 呼び出し ==========`);
    console.log(`[MasterCache] ${collection}: プリロード中チェック: ${!!this.preloadPromises[collection]}`);

    // すでにプリロード中の場合は既存のPromiseを返す
    if (this.preloadPromises[collection]) {
      console.log(`[MasterCache] ${collection}: ⚠️ プリロード既に実行中 - 既存Promiseを返す`);
      return this.preloadPromises[collection];
    }

    console.log(`[MasterCache] ${collection}: 🚀 バックグラウンドプリロード開始（新規Promise作成）`);

    this.preloadPromises[collection] = (async () => {
      try {
        console.log(`[MasterCache] ${collection}: ステップ1 - キャッシュ有効性チェック開始`);

        // キャッシュ有効性チェック
        const cacheValid = await this.isCacheValid(collection);
        console.log(`[MasterCache] ${collection}: ステップ1完了 - キャッシュ有効性: ${cacheValid}`);

        if (cacheValid) {
          console.log(`[MasterCache] ${collection}: ステップ2a - キャッシュ有効なのでキャッシュから取得`);
          const cachedData = await this.getFromCache(collection);
          console.log(`[MasterCache] ${collection}: ✅ キャッシュ有効、プリロード不要 (${cachedData.length}件)`);
          return { cached: true, count: cachedData.length };
        }

        console.log(`[MasterCache] ${collection}: ステップ2b - キャッシュ無効なのでFirestoreから取得開始`);

        // Firestoreから取得してキャッシュ更新
        const data = await this.fetchFromFirestore(collection);
        console.log(`[MasterCache] ${collection}: ステップ3 - Firestore取得完了 (${data.length}件)、キャッシュ保存開始`);

        await this.saveToCache(collection, data);
        console.log(`[MasterCache] ${collection}: ステップ4 - キャッシュ保存完了`);

        console.log(`[MasterCache] ${collection}: ✅ プリロード完了 (${data.length}件)`);
        return { cached: false, count: data.length };

      } catch (error) {
        console.error(`[MasterCache] ${collection}: ❌ プリロードエラー`, error);
        console.error(`[MasterCache] ${collection}: エラー詳細:`, {
          message: error.message,
          stack: error.stack,
          type: error.constructor.name
        });
        return { error: error.message };
      }
    })();

    console.log(`[MasterCache] ${collection}: Promise作成完了、返却します`);
    return this.preloadPromises[collection];
  }

  /**
   * キャッシュ統計取得
   */
  async getCacheStats(collection) {
    const metadata = await this.getCacheMetadata(collection);

    if (!metadata) {
      return {
        exists: false,
        count: 0,
        age: null,
        valid: false
      };
    }

    const age = Date.now() - metadata.timestamp;
    const valid = age < MASTER_CACHE_CONFIG.CACHE_TTL;

    return {
      exists: true,
      count: metadata.count,
      ageMs: age,
      valid: valid,
      timestamp: new Date(metadata.timestamp).toLocaleString('ja-JP')
    };
  }

  // ========================================
  // 便利メソッド（後方互換性のため）
  // ========================================

  async getBrands() {
    return this.getData(MASTER_CACHE_CONFIG.COLLECTIONS.brands);
  }

  async getCategories() {
    return this.getData(MASTER_CACHE_CONFIG.COLLECTIONS.categories);
  }
}

// グローバルインスタンス
window.masterCacheManager = new MasterCacheManager();

// 後方互換性のため
window.brandCacheManager = {
  getBrands: () => window.masterCacheManager.getBrands(),
  preloadInBackground: () => window.masterCacheManager.preloadInBackground('brands'),
  getCacheStats: () => window.masterCacheManager.getCacheStats('brands')
};

console.log('[MasterCache] MasterCacheManager初期化完了');

// バックグラウンドプリロード開始関数（master-manager.jsから呼び出し）
window.startMasterCachePreload = async function() {
  console.log('========================================');
  console.log('[MasterCache] 🚀 バックグラウンドプリロード開始（ブランド＋カテゴリ）');
  console.log('========================================');

  try {
    console.log('[MasterCache] Promise.all で並列プリロード開始');
    console.log('[MasterCache] - brands: preloadInBackground() 呼び出し準備');
    console.log('[MasterCache] - categories: preloadInBackground() 呼び出し準備');

    const [brandsResult, categoriesResult] = await Promise.all([
      window.masterCacheManager.preloadInBackground('brands'),
      window.masterCacheManager.preloadInBackground('categories')
    ]);

    console.log('========================================');
    console.log('[MasterCache] Promise.all 完了 - 結果集計開始');
    console.log('========================================');

    console.log('[MasterCache] brandsResult:', brandsResult);
    console.log('[MasterCache] categoriesResult:', categoriesResult);

    // ブランド結果
    if (brandsResult.cached) {
      console.log(`[MasterCache] ブランド: ✅ キャッシュ利用 (${brandsResult.count}件)`);
    } else if (brandsResult.error) {
      console.warn(`[MasterCache] ブランド: ⚠️ エラー: ${brandsResult.error}`);
    } else {
      console.log(`[MasterCache] ブランド: ✅ Firestore読み込み完了 (${brandsResult.count}件)`);
    }

    // カテゴリ結果
    if (categoriesResult.cached) {
      console.log(`[MasterCache] カテゴリ: ✅ キャッシュ利用 (${categoriesResult.count}件)`);
    } else if (categoriesResult.error) {
      console.warn(`[MasterCache] カテゴリ: ⚠️ エラー: ${categoriesResult.error}`);
    } else {
      console.log(`[MasterCache] カテゴリ: ✅ Firestore読み込み完了 (${categoriesResult.count}件)`);
    }

    // キャッシュ統計をコンソールに出力
    const brandsStats = await window.masterCacheManager.getCacheStats('brands');
    const categoriesStats = await window.masterCacheManager.getCacheStats('categories');
    console.log('[MasterCache] ブランド統計:', brandsStats);
    console.log('[MasterCache] カテゴリ統計:', categoriesStats);

  } catch (error) {
    console.error('[MasterCache] プリロードエラー:', error);
  }
};

// ========================================
// 自動バックグラウンドプリロード開始
// ========================================
// master-cache.js読み込み完了後、即座にバックグラウンドプリロードを開始
// キャッシュがあれば即座に返る、プリロード中なら既存Promiseを返すので安全
console.log('[MasterCache] 自動バックグラウンドプリロード開始チェック');

// 少し遅延させてFirestore初期化を確実に完了させる
setTimeout(async () => {
  try {
    // プリロード中かチェック
    const brandsPreloading = window.masterCacheManager.preloadPromises['brands'];
    const categoriesPreloading = window.masterCacheManager.preloadPromises['categories'];

    if (brandsPreloading || categoriesPreloading) {
      console.log('[MasterCache] ⏭️ プリロード既に実行中 - スキップ');
      return;
    }

    // キャッシュ有効性チェック
    const brandsValid = await window.masterCacheManager.isCacheValid('brands');
    const categoriesValid = await window.masterCacheManager.isCacheValid('categories');

    if (brandsValid && categoriesValid) {
      console.log('[MasterCache] ✅ キャッシュ有効 - プリロード不要');
      return;
    }

    console.log('[MasterCache] ✅ 自動バックグラウンドプリロード実行');
    window.startMasterCachePreload();
  } catch (error) {
    console.error('[MasterCache] 自動プリロード開始エラー:', error);
  }
}, 100); // 100ms遅延
