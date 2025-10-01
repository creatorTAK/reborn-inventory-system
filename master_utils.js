/** master_utils.gs
 * マスタ／在庫シート名の取得と、見出しマッチ＆文字列ユーティリティ
 * どのファイルからでも使える共通関数を定義します。
 */

// シート名（定数があればそれを優先）
function getMasterSheetName_(){
  try { if (typeof MASTER_SHEET !== 'undefined' && MASTER_SHEET) return MASTER_SHEET; } catch(_){}
  return 'マスタデータ';
}
function getMainSheetName_(){
  try { if (typeof SHEET_NAME !== 'undefined' && SHEET_NAME) return SHEET_NAME; } catch(_){}
  return '在庫/売上管理表';
}

// 見出しの正規化（全角→半角、空白・大文字小文字などを吸収）
function _norm(s){
  return String(s||'')
    .trim()
    .replace(/（/g,'(').replace(/）/g,')')
    .replace(/／/g,'/')
    .replace(/\u3000/g,' ')
    .toLowerCase()
    .replace(/\s+/g,'');
}

// 見出しインデックス検索（エイリアス配列のどれかに一致した列を返す）
function _findIdx(headers, aliases){
  const map = new Map();
  headers.forEach((h,i)=> map.set(_norm(h), i));
  for (const a of aliases){
    const idx = map.get(_norm(a));
    if (idx !== undefined) return idx;
  }
  return -1;
}

// セル内複数値の分割（, 、 / ／ 改行）
function _splitMulti(s){
  return String(s||'')
    .split(/[,\u3001\/\uFF0F\n]+/)
    .map(v=>v.trim())
    .filter(Boolean);
}

// 重複除去＆順序維持
function _uniqKeepOrder(arr){
  const seen = new Set(), out = [];
  for (const x of (arr||[])){
    const v = (x??'').toString().trim();
    if (!v || seen.has(v)) continue;
    seen.add(v); out.push(v);
  }
  return out;
}
