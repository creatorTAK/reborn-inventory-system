/*************************************************
 ** utils.gs ユーティリティ（最小）
 **************************************************/
function colByName_(sh, headerName){
  const lastCol = sh.getLastColumn(); if (!lastCol) return 0;
  const headers = sh.getRange(1,1,1,lastCol).getDisplayValues()[0];
  const norm = s => String(s||'').replace(/[ \t\r\n　]+/g,'').trim();
  const target = norm(headerName);
  for (let i=0;i<headers.length;i++){ if (norm(headers[i]) === target) return i+1; }
  return 0;
}

function writeRowByHeadersForce_(sheet, row, updates) {
  const lastCol = sheet.getLastColumn();
  const headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0] : [];
  const norm = s => String(s||'').replace(/[ \t\r\n　]+/g,'').trim();
  const hmap = {}; headers.forEach((h,i)=>{ hmap[norm(h)] = i+1; });

  for (const [h, v] of Object.entries(updates || {})) {
    const col = hmap[norm(h)] || 0;
    if (!col) continue;
    try { sheet.getRange(row, col).setValue(v); } catch(_) {}
  }
}
