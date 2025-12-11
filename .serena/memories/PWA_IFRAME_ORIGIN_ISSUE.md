# PWA iframe オリジン問題と解決策

## 問題の概要
PWAでカスタムドメイン（furira.jp）を使用している場合、iframe内のページが異なるオリジンから読み込まれると、localStorageが共有されない。

## 発生した問題
- 親ページ (index.html): `https://furira.jp`
- iframe (menu_home.html): `https://reborn-inventory-system.pages.dev` (ハードコード)
- **結果**: localStorage が共有されず、権限チェックが動作しなかった

## 解決策
```javascript
// ❌ 修正前（ハードコード）
const pwaBaseUrl = 'https://reborn-inventory-system.pages.dev';

// ✅ 修正後（動的に取得）
const pwaBaseUrl = location.origin;
```

## デバッグ方法
1. Safari Web Inspector でデバイスに接続
2. コンソールでフレームコンテキストを切り替え（右下のドロップダウン）
3. 各コンテキストで `location.origin` を確認
4. `localStorage.getItem('key')` で値の存在を確認

## 影響範囲
- docs/index.html の `pwaBaseUrl` 定義箇所（7箇所）
- iframe で読み込むすべてのPWAページ

## 注意点
- 新しいiframe読み込み処理を追加する際は、必ず `location.origin` を使用
- ハードコードされたドメインを使用しない
- カスタムドメインと開発ドメインの両方で動作確認が必要

## 関連Issue
- PERM-001: 権限によるメニュー制御

## 解決日
2025-11-29
