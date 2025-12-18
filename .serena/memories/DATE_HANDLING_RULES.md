# 日付処理ルール（必須）

## 🔴 禁止パターン

**以下のコードは絶対に使用禁止：**

```javascript
// ❌ 禁止: toISOString()はUTC時間を返すため、日本時間の午前0〜9時に前日表示される
new Date().toISOString().slice(0, 10)
someDate.toISOString().slice(0, 10)
now.toISOString().slice(0, 7) + '-01'
```

## ✅ 正しいパターン

**各HTMLファイルに以下のヘルパー関数を追加して使用する：**

```javascript
// 日本時間で今日の日付を取得（YYYY-MM-DD形式）
function getJSTToday() {
  const now = new Date();
  const jst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);
  const year = jst.getFullYear();
  const month = String(jst.getMonth() + 1).padStart(2, '0');
  const day = String(jst.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 日本時間で今月を取得（YYYY-MM形式）
function getJSTMonth() {
  const now = new Date();
  const jst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000);
  const year = jst.getFullYear();
  const month = String(jst.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// 任意のDateオブジェクトから日付文字列を取得（YYYY-MM-DD形式）
// ※ローカルタイムゾーンの日付を返す
function formatDateLocal(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

## 使用例

```javascript
// ✅ 正しい使い方
document.getElementById('dateInput').value = getJSTToday();
const monthStart = getJSTMonth() + '-01';

// 計算した日付からフォーマット
const nextMonth = new Date();
nextMonth.setMonth(nextMonth.getMonth() + 1);
const endDate = formatDateLocal(nextMonth);

// ファイル名のタイムスタンプ
const filename = `data_${getJSTToday()}.csv`;
```

## 根本原因

`Date.toISOString()`は常にUTC（協定世界時）を返します。
日本はUTC+9なので、日本時間の午前0:00〜8:59の間は、UTCではまだ前日です。

例：日本時間 2025-12-18 09:00 = UTC 2025-12-18 00:00
例：日本時間 2025-12-18 08:59 = UTC 2025-12-17 23:59 ← 前日！

## チェックリスト（コードレビュー時）

- [ ] `toISOString().slice(0, 10)` がコード内に存在しないか
- [ ] `toISOString().slice(0, 7)` がコード内に存在しないか
- [ ] 日付入力のデフォルト値は `getJSTToday()` を使用しているか
- [ ] 月の開始日は `getJSTMonth() + '-01'` を使用しているか

---

**最終更新: 2025-12-18**
**適用済みファイル:** accounting.html, inventory_history.html, purchase.html, sales-analysis.html, sales.html, stocktaking.html
