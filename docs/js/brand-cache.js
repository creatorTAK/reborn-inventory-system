// ========================================
// ブランドキャッシュシステム（IndexedDB）
// MASTER-002: バックグラウンドプリロード対応
// ========================================

const BRAND_CACHE_CONFIG = {
  DB_NAME: 'RebornBrandCache',
  DB_VERSION: 1,
  STORE_NAME: 'brands',
  CACHE_TTL: 3600000, // 1時間（ミリ秒）
  MAX_RETRY: 3
};

class BrandCacheManager {
  constructor() {
    this.db = null;
    this.isInitialized = false;
    this.preloadPromise = null;
  }

  /**
   * IndexedDB初期化
   */
  async initialize() {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(BRAND_CACHE_CONFIG.DB_NAME, BRAND_CACHE_CONFIG.DB_VERSION);

      request.onerror = () => {
        console.error('[BrandCache] IndexedDB初期化エラー:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('[BrandCache] IndexedDB初期化完了');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // brandsストア作成
        if (!db.objectStoreNames.contains(BRAND_CACHE_CONFIG.STORE_NAME)) {
          const store = db.createObjectStore(BRAND_CACHE_CONFIG.STORE_NAME, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          console.log('[BrandCache] ObjectStore作成完了');
        }
      };
    });
  }

  /**
   * キャッシュメタデータ取得
   */
  async getCacheMetadata() {
    const metadata = localStorage.getItem('brand_cache_metadata');
    return metadata ? JSON.parse(metadata) : null;
  }

  /**
   * キャッシュメタデータ保存
   */
  saveCacheMetadata(count) {
    const metadata = {
      count: count,
      timestamp: Date.now(),
      version: BRAND_CACHE_CONFIG.DB_VERSION
    };
    localStorage.setItem('brand_cache_metadata', JSON.stringify(metadata));
  }

  /**
   * キャッシュが有効か判定
   */
  async isCacheValid() {
    const metadata = await this.getCacheMetadata();

    if (!metadata) return false;

    const age = Date.now() - metadata.timestamp;
    const isValid = age < BRAND_CACHE_CONFIG.CACHE_TTL;

    console.log(`[BrandCache] キャッシュ判定: ${isValid ? '有効' : '無効'} (経過時間: ${Math.floor(age / 60000)}分)`);

    return isValid;
  }

  /**
   * Firestoreからブランド読み込み
   */
  async loadFromFirestore() {
    console.log('[BrandCache] Firestore読み込み開始...');
    const startTime = Date.now();

    try {
      // Firestore初期化（グローバル関数を使用）
      if (!window.initializeFirestore) {
        throw new Error('initializeFirestore が見つかりません');
      }
      const db = await window.initializeFirestore();

      // Firebase SDKを動的インポート
      const { collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');

      const brandsRef = collection(db, 'brands');
      const snapshot = await getDocs(brandsRef);

      const brands = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[BrandCache] Firestore読み込み完了: ${brands.length}件 (${duration}秒)`);

      return brands;
    } catch (error) {
      console.error('[BrandCache] Firestore読み込みエラー:', error);
      throw error;
    }
  }

  /**
   * IndexedDBに保存
   */
  async saveToCache(brands) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([BRAND_CACHE_CONFIG.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(BRAND_CACHE_CONFIG.STORE_NAME);

      // 既存データをクリア
      store.clear();

      // 新しいデータを保存
      let savedCount = 0;
      brands.forEach(brand => {
        store.add(brand);
        savedCount++;
      });

      transaction.oncomplete = () => {
        this.saveCacheMetadata(savedCount);
        console.log(`[BrandCache] IndexedDB保存完了: ${savedCount}件`);
        resolve(savedCount);
      };

      transaction.onerror = () => {
        console.error('[BrandCache] IndexedDB保存エラー:', transaction.error);
        reject(transaction.error);
      };
    });
  }

  /**
   * IndexedDBから読み込み
   */
  async loadFromCache() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([BRAND_CACHE_CONFIG.STORE_NAME], 'readonly');
      const store = transaction.objectStore(BRAND_CACHE_CONFIG.STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const brands = request.result;
        console.log(`[BrandCache] IndexedDB読み込み完了: ${brands.length}件`);
        resolve(brands);
      };

      request.onerror = () => {
        console.error('[BrandCache] IndexedDB読み込みエラー:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * バックグラウンドプリロード
   * アプリ起動時に自動実行（ユーザーを待たせない）
   */
  async preloadInBackground() {
    // 既にプリロード中なら同じPromiseを返す
    if (this.preloadPromise) {
      return this.preloadPromise;
    }

    this.preloadPromise = (async () => {
      try {
        await this.initialize();

        // キャッシュが有効ならスキップ
        if (await this.isCacheValid()) {
          console.log('[BrandCache] キャッシュ有効、プリロードスキップ');
          return { cached: true, count: (await this.getCacheMetadata()).count };
        }

        // Firestoreから読み込み
        console.log('[BrandCache] バックグラウンドプリロード開始');
        const brands = await this.loadFromFirestore();

        // IndexedDBに保存
        await this.saveToCache(brands);

        console.log('[BrandCache] バックグラウンドプリロード完了');
        return { cached: false, count: brands.length };
      } catch (error) {
        console.error('[BrandCache] バックグラウンドプリロードエラー:', error);
        // エラーでも続行（次回リトライ）
        return { cached: false, count: 0, error: error.message };
      }
    })();

    return this.preloadPromise;
  }

  /**
   * ブランド取得（高速）
   * マスタ管理画面・商品登録画面から使用
   */
  async getBrands() {
    try {
      await this.initialize();

      // キャッシュ有効なら即座に返す
      if (await this.isCacheValid()) {
        const brands = await this.loadFromCache();
        console.log(`[BrandCache] キャッシュから取得: ${brands.length}件`);
        return brands;
      }

      // キャッシュ無効 → Firestoreから読み込み → キャッシュ更新
      console.log('[BrandCache] キャッシュ無効、Firestoreから読み込み');
      const brands = await this.loadFromFirestore();
      await this.saveToCache(brands);

      return brands;
    } catch (error) {
      console.error('[BrandCache] ブランド取得エラー:', error);
      throw error;
    }
  }

  /**
   * キャッシュクリア（デバッグ用）
   */
  async clearCache() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([BRAND_CACHE_CONFIG.STORE_NAME], 'readwrite');
      const store = transaction.objectStore(BRAND_CACHE_CONFIG.STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        localStorage.removeItem('brand_cache_metadata');
        console.log('[BrandCache] キャッシュクリア完了');
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * キャッシュ統計情報
   */
  async getCacheStats() {
    const metadata = await this.getCacheMetadata();

    if (!metadata) {
      return {
        cached: false,
        count: 0,
        age: 0,
        valid: false
      };
    }

    const age = Date.now() - metadata.timestamp;
    const valid = age < BRAND_CACHE_CONFIG.CACHE_TTL;

    return {
      cached: true,
      count: metadata.count,
      age: Math.floor(age / 60000), // 分単位
      ageMs: age,
      valid: valid,
      timestamp: new Date(metadata.timestamp).toLocaleString('ja-JP')
    };
  }
}

// グローバルインスタンス
window.brandCacheManager = new BrandCacheManager();

console.log('[BrandCache] BrandCacheManager初期化完了');
