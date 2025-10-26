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
  'ステータス','販売日','販売金額','送料','梱包資材費','販売手数料','利益金額','利益率','在庫日数',

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
