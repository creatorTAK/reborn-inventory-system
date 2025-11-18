// GitHub連携テスト - 2025/10/02
/** config.gs：在庫/売上管理表に安全保存（空欄キーは送らない） */
const SHEET_NAME = '在庫/売上管理表';

/** UI（サイドバー）から渡ってくる論理名 */
const FIELDS = [
  '棚番号','商品番号',
  '担当者',
  'セールスワード(カテゴリ)','セールスワード',
  'ブランド(英語)','ブランド(カナ)',

  // ★ 商品名タイトル（プレビューを保存）
  '商品名(タイトル)',

  // タイトル情報
  '生地・素材・質感系',
  '季節感・機能性','着用シーン・イベント','見た目・印象','トレンド表現',
  'サイズ感・体型カバー','年代・テイスト・スタイル','カラー/配色/トーン','柄・模様',
  'ディテール・仕様','シルエット/ライン','ネックライン','襟・衿',
  '袖・袖付け','丈','革/加工','毛皮/加工','生産国',

  // カテゴリー（5段対応）
  '大分類(カテゴリ)','中分類(カテゴリ)','小分類(カテゴリ)','細分類(カテゴリ)','細分類2',

  // 基本情報
  'サイズ','サイズ(表記)','商品の状態',

  // 商品名（個別）
  'アイテム名',

  // 仕入
  '仕入日','仕入先','仕入金額',

  // 出品
  '出品日','出品先','出品金額',
  
  // 販売・利益
  'ステータス','販売日','販売金額','発送方法1','発送方法2','送料','梱包資材費','手数料','利益金額','利益率','在庫日数',

  // 梱包資材詳細
  '梱包資材1','梱包費1','梱包資材2','梱包費2','梱包資材3','梱包費3',

  // ★ こだわり条件（新規）
  '配送料の負担','配送の方法','発送元の地域','発送までの日数',

  // Phase 1: 今すぐ使う列（チーム連携・履歴管理・画像保存）
  '登録者','登録日時','最終更新者','更新日時',
  '画像URL1','画像URL2','画像URL3',

  // Phase 4: 将来使う列（Agent SDK用）
  'AI生成履歴','メルカリURL','競合価格履歴','AIタグ','JSON_データ','Agent分析結果'
];

const REQUIRED_FIELDS = []; // すべて任意

// ===== 見出しの別名（表記ゆれ対応） =====
const HEADER_ALIASES = {
  '大分類(カテゴリ)': ['大分類(カテゴリ)','大分類'],
  '中分類(カテゴリ)': ['中分類(カテゴリ)','中分類'],
  '小分類(カテゴリ)': ['小分類(カテゴリ)','小分類'],
  '細分類(カテゴリ)': ['細分類(カテゴリ)','細分類','細分類1','細分類１'],
  '細分類2'         : ['細分類2','細分類２','細分類(2)'],

  // 商品名(タイトル)
  '商品名(タイトル)': ['商品名(タイトル)','商品名','タイトル','商品名（タイトル）'],

  // こだわり条件（表記ゆれあればここに追加）
  '配送料の負担'   : ['配送料の負担'],
  '配送の方法'     : ['配送の方法'],
  '発送元の地域'   : ['発送元の地域'],
  '発送までの日数' : ['発送までの日数']
};

function getSheet_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET_NAME);
  if (!sh) throw new Error(`NG(RANGE): シート '${SHEET_NAME}' が見つかりません`);
  return sh;
}

// ヘッダ正規化（全角括弧/スラッシュ/全角空白→半角、空白除去、小文字化）
function _normHeader_(s){
  return String(s||'')
    .trim()
    .replace(/（/g,'(').replace(/）/g,')')
    .replace(/／/g,'/')
    .replace(/\u3000/g,' ')
    .toLowerCase()
    .replace(/\s+/g,'');
}
function _findHeaderIdx_(headers, candidates){
  const map = new Map();
  headers.forEach((h,i)=> map.set(_normHeader_(h), i));
  for (const c of candidates){
    const idx = map.get(_normHeader_(c));
    if (idx !== undefined) return idx;
  }
  return -1;
}

function getHeaderMap_() {
  const sh = getSheet_();
  const lastCol = sh.getLastColumn();
  const headerRow = sh.getRange(1, 1, 1, lastCol).getValues()[0];

  // 重複チェック
  const counts = headerRow.reduce((m, v) => { if (!v) return m; m[v] = (m[v] || 0) + 1; return m; }, {});
  const dup = Object.keys(counts).find(k => counts[k] > 1);
  if (dup) throw new Error(`NG(HEADER_DUPLICATE): 見出し '${dup}' が重複しています`);

  // 論理名 → 実列番号（1始まり）
  const map = {};
  for (const logical of FIELDS) {
    const aliases = HEADER_ALIASES[logical] || [logical];
    const idx = _findHeaderIdx_(headerRow, aliases);
    if (idx !== -1) map[logical] = idx + 1;
  }
  return { map, lastCol };
}

/**
 * ========================================
 * Firestore操作関数（設定管理用）
 * ========================================
 * GAS iframeからのCORS問題を回避するため、
 * サーバー側（GAS）でFirestore REST APIを使用
 */

/**
 * 設定をFirestoreに保存（settings/commonドキュメント）
 * @param {Object} config - 設定オブジェクト
 * @return {Object} 成功/失敗の結果
 */
function saveConfigToFirestore(config) {
  try {
    const projectId = 'reborn-chat';
    const collectionPath = 'settings';
    const documentId = 'common';
    
    // Firestore REST API URL
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}/${documentId}`;
    
    // Firestoreドキュメント形式に変換
    const firestoreDoc = {
      fields: {
        conditionButtons: { arrayValue: { values: (config['商品状態ボタン'] || []).map(v => ({ stringValue: v })) } },
        hashtag: { mapValue: { fields: convertToFirestoreMap(config['ハッシュタグ'] || {}) } },
        discount: { mapValue: { fields: convertToFirestoreMap(config['割引情報'] || {}) } },
        shippingDefault: { mapValue: { fields: convertToFirestoreMap(config['配送デフォルト'] || {}) } },
        procureListingDefault: { mapValue: { fields: convertToFirestoreMap(config['仕入出品デフォルト'] || {}) } },
        managementNumber: { mapValue: { fields: convertToFirestoreMap(config['管理番号設定'] || {}) } },
        salesword: { mapValue: { fields: convertToFirestoreMap(config['よく使うセールスワード'] || {}) } },
        aiSettings: { mapValue: { fields: convertToFirestoreMap(config['AI生成設定'] || {}) } },
        designTheme: { stringValue: config['デザインテーマ'] || 'modern' },
        updatedAt: { timestampValue: new Date().toISOString() }
      }
    };
    
    // OAuth2トークン取得
    const token = ScriptApp.getOAuthToken();
    
    // PATCH request（ドキュメント更新・存在しなければ作成）
    const options = {
      method: 'patch',
      contentType: 'application/json',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      payload: JSON.stringify(firestoreDoc),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      Logger.log('✅ Firestoreに保存成功: settings/common');
      return { success: true, message: 'Firestoreに保存しました' };
    } else {
      const errorText = response.getContentText();
      Logger.log('❌ Firestore保存エラー: ' + responseCode + ' - ' + errorText);
      return { success: false, error: errorText, code: responseCode };
    }
    
  } catch (error) {
    Logger.log('❌ Firestore保存例外: ' + error.toString());
    return { success: false, error: error.toString() };
  }
}

/**
 * JavaScriptオブジェクトをFirestore Map形式に変換
 * @param {Object} obj - 変換元オブジェクト
 * @return {Object} Firestore Map形式
 */
function convertToFirestoreMap(obj) {
  const result = {};
  
  for (const key in obj) {
    const value = obj[key];
    
    if (value === null || value === undefined) {
      result[key] = { nullValue: null };
    } else if (typeof value === 'string') {
      result[key] = { stringValue: value };
    } else if (typeof value === 'number') {
      result[key] = Number.isInteger(value) 
        ? { integerValue: value.toString() }
        : { doubleValue: value };
    } else if (typeof value === 'boolean') {
      result[key] = { booleanValue: value };
    } else if (Array.isArray(value)) {
      result[key] = { 
        arrayValue: { 
          values: value.map(v => {
            if (typeof v === 'string') return { stringValue: v };
            if (typeof v === 'number') return { doubleValue: v };
            if (typeof v === 'boolean') return { booleanValue: v };
            if (typeof v === 'object') return { mapValue: { fields: convertToFirestoreMap(v) } };
            return { stringValue: String(v) };
          })
        }
      };
    } else if (typeof value === 'object') {
      result[key] = { mapValue: { fields: convertToFirestoreMap(value) } };
    } else {
      result[key] = { stringValue: String(value) };
    }
  }
  
  return result;
}

/**
 * Firestoreから設定を読み込み（settings/commonドキュメント）
 * @return {Object} 設定オブジェクトまたはnull
 */
function loadConfigFromFirestore() {
  try {
    const projectId = 'reborn-chat';
    const collectionPath = 'settings';
    const documentId = 'common';
    
    // Firestore REST API URL
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}/${documentId}`;
    
    // OAuth2トークン取得
    const token = ScriptApp.getOAuthToken();
    
    // GET request
    const options = {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + token
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200) {
      const data = JSON.parse(response.getContentText());
      Logger.log('✅ Firestoreから読み込み成功: settings/common');
      return convertFromFirestoreDoc(data);
    } else if (responseCode === 404) {
      Logger.log('📝 Firestoreドキュメントが存在しません: settings/common');
      return null;
    } else {
      const errorText = response.getContentText();
      Logger.log('❌ Firestore読み込みエラー: ' + responseCode + ' - ' + errorText);
      return null;
    }
    
  } catch (error) {
    Logger.log('❌ Firestore読み込み例外: ' + error.toString());
    return null;
  }
}

/**
 * FirestoreドキュメントをJavaScriptオブジェクトに変換
 * @param {Object} doc - Firestoreドキュメント
 * @return {Object} JavaScriptオブジェクト
 */
function convertFromFirestoreDoc(doc) {
  if (!doc || !doc.fields) return {};
  
  const result = {};
  
  for (const key in doc.fields) {
    result[key] = convertFirestoreValue(doc.fields[key]);
  }
  
  return result;
}

/**
 * Firestore値をJavaScript値に変換
 * @param {Object} value - Firestore値
 * @return {*} JavaScript値
 */
function convertFirestoreValue(value) {
  if (!value) return null;
  
  if (value.stringValue !== undefined) return value.stringValue;
  if (value.integerValue !== undefined) return parseInt(value.integerValue);
  if (value.doubleValue !== undefined) return value.doubleValue;
  if (value.booleanValue !== undefined) return value.booleanValue;
  if (value.nullValue !== undefined) return null;
  if (value.timestampValue !== undefined) return new Date(value.timestampValue);
  
  if (value.arrayValue && value.arrayValue.values) {
    return value.arrayValue.values.map(v => convertFirestoreValue(v));
  }
  
  if (value.mapValue && value.mapValue.fields) {
    const obj = {};
    for (const k in value.mapValue.fields) {
      obj[k] = convertFirestoreValue(value.mapValue.fields[k]);
    }
    return obj;
  }
  
  return null;
}

/**
 * ========================================
 * ブランドマスタ取得（Firestore REST API）
 * ========================================
 * GAS版商品登録画面でブランドデータを取得
 * クライアント側のiframe CORS問題を回避するため、
 * サーバー側（GAS）でFirestore REST APIを使用
 */

/**
 * Firestoreからブランドマスタを全件取得
 * @return {Array} ブランドデータ配列
 */
function getBrandsFromFirestore() {
  try {
    console.log('📥 [GAS] Firestoreからブランドマスタを取得開始...');
    const startTime = new Date().getTime();

    const projectId = 'reborn-chat';
    const collectionPath = 'brands';
    const token = ScriptApp.getOAuthToken();

    let brands = [];
    let pageToken = null;
    let pageCount = 0;

    // ページネーションで全件取得（Firestore REST APIは1リクエストで最大数百件まで）
    do {
      pageCount++;

      // Firestore REST API URL（pageSize=1000で最大取得、pageTokenがあれば追加）
      let url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collectionPath}?pageSize=1000`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const response = UrlFetchApp.fetch(url, {
        method: 'get',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        muteHttpExceptions: true
      });

      const responseCode = response.getResponseCode();
      if (responseCode !== 200) {
        console.error('❌ [GAS] Firestore取得エラー:', responseCode, response.getContentText());
        break;
      }

      const data = JSON.parse(response.getContentText());

      // ドキュメントを処理
      if (data.documents && Array.isArray(data.documents)) {
        for (let i = 0; i < data.documents.length; i++) {
          const doc = data.documents[i];
          const fields = doc.fields || {};
          const docName = doc.name || '';
          const docId = docName.split('/').pop();

          brands.push({
            id: docId,
            nameEn: convertFirestoreValue(fields.nameEn) || '',
            nameKana: convertFirestoreValue(fields.nameKana) || '',
            searchText: (convertFirestoreValue(fields.searchText) || '').toLowerCase(),
            usageCount: convertFirestoreValue(fields.usageCount) || 0
          });
        }
      }

      // 次のページのトークンを取得
      pageToken = data.nextPageToken || null;

      console.log(`📄 [GAS] ページ ${pageCount}: ${data.documents ? data.documents.length : 0}件取得（累計: ${brands.length}件）`);

      // GASの実行時間制限（6分）を考慮して、50ページ以上は打ち切り
      if (pageCount >= 50) {
        console.log('⚠️ [GAS] ページ数上限に達したため、取得を終了します');
        break;
      }

    } while (pageToken); // pageTokenがある限り繰り返す

    const endTime = new Date().getTime();
    const duration = endTime - startTime;

    console.log(`✅ [GAS] ブランドマスタ取得完了: ${brands.length}件 (${duration}ms、${pageCount}ページ)`);

    return brands;

  } catch (error) {
    console.error('❌ [GAS] getBrandsFromFirestore エラー:', error);
    return [];
  }
}

/**
 * Firestoreから管理番号設定を取得（settings/common）
 * @return {Object} 管理番号設定オブジェクト { prefix: string, segments: Array }
 */
function getManagementConfig() {
  try {
    console.log('📥 [GAS] Firestoreから管理番号設定を取得開始...');
    const startTime = new Date().getTime();

    const projectId = 'reborn-chat';
    const documentPath = 'settings/common';
    const token = ScriptApp.getOAuthToken();

    // Firestore REST API URL（単一ドキュメント取得）
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${documentPath}`;

    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    });

    const responseCode = response.getResponseCode();
    if (responseCode !== 200) {
      console.error('❌ [GAS] Firestore取得エラー:', responseCode, response.getContentText());
      return null;
    }

    const data = JSON.parse(response.getContentText());
    const fields = data.fields || {};

    // デバッグ: フィールド名を確認
    console.log('[GAS] 利用可能なフィールド:', Object.keys(fields).join(', '));

    // 管理番号設定を抽出（managementNumberオブジェクト内をチェック）
    let prefix = '';
    let segments = [];

    // パターン1: managementNumber.prefix と managementNumber.segments
    if (fields.managementNumber && fields.managementNumber.mapValue) {
      const mnFields = fields.managementNumber.mapValue.fields || {};
      prefix = convertFirestoreValue(mnFields.prefix) || '';
      segments = convertFirestoreValue(mnFields.segments) || [];
      console.log('[GAS] パターン1で取得（managementNumber内）');
    }
    // パターン2: 直接 managementNumberPrefix と segments
    else if (fields.managementNumberPrefix || fields.segments) {
      prefix = convertFirestoreValue(fields.managementNumberPrefix) || '';
      segments = convertFirestoreValue(fields.segments) || [];
      console.log('[GAS] パターン2で取得（直接フィールド）');
    }
    // パターン3: prefix と segments（シンプル名）
    else if (fields.prefix || fields.segments) {
      prefix = convertFirestoreValue(fields.prefix) || '';
      segments = convertFirestoreValue(fields.segments) || [];
      console.log('[GAS] パターン3で取得（シンプル名）');
    }

    const config = {
      prefix: prefix,
      segments: segments
    };

    const endTime = new Date().getTime();
    const duration = endTime - startTime;

    console.log(`✅ [GAS] 管理番号設定取得完了: prefix="${config.prefix}", segments=${config.segments.length}件 (${duration}ms)`);

    return config;

  } catch (error) {
    console.error('❌ [GAS] getManagementConfig エラー:', error);
    return null;
  }
}
