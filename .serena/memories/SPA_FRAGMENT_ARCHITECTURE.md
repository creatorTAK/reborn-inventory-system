# SPA Fragment Architecture — 編集ファイルルール

## 🔴 最重要ルール

**ページのHTML/JS/CSSを修正する場合、必ず `docs/fragments/` 配下のファイルを編集すること。**
`docs/` 直下の同名HTMLファイル（config.html, menu_home.html等）は旧iframe版であり、現在のSPAでは一切使用されていない。

## アーキテクチャ

- SPA Router (`docs/js/spa-router.js`) が全ページをフラグメント方式で読み込む
- ページ定義: `docs/js/spa-pages-config.js` の `FURIRA_PAGES`
- 全ページが `type: 'fragment'` — iframe fallbackは存在しない
- index.html内のiframe URL設定コード（navigateToPage内）は到達しないデッドコード

## ファイルマッピング

| ページキー | 実際に読み込まれるファイル | ⚠️ 編集してはいけないファイル |
|-----------|--------------------------|---------------------------|
| home | `docs/fragments/menu_home.html` | `docs/menu_home.html` |
| config-system, config-product, config-permission-users | `docs/fragments/config.html` | `docs/config.html` |
| master-product, master-business | `docs/fragments/master-management.html` | `docs/master-management.html` |
| product | `docs/fragments/product.html` | `docs/product.html` |
| mypage | `docs/fragments/mypage.html` | `docs/mypage.html` |
| chat | `docs/fragments/chat_rooms_list.html` | — |
| chat-room | `docs/fragments/chat_ui_firestore.html` | — |
| todo-list, todo | `docs/fragments/todo_list.html` | — |
| inventory | `docs/fragments/inventory.html` | — |
| inventory_history | `docs/fragments/inventory_history.html` | — |
| その他全ページ | `docs/fragments/*.html` | `docs/*.html`（旧版） |

## 共有フラグメント

同じfragmentUrlを複数ページキーで共有:
- `config.html` → config-system, config-product, config-permission-users
- `master-management.html` → master-product, master-business
- `todo_list.html` → todo-list, todo

## 常に編集対象のファイル

- `docs/index.html` — メインシェル（SPA Router、Firebase初期化、バッジ等）
- `docs/js/spa-router.js` — SPAルーター
- `docs/js/spa-pages-config.js` — ページ定義
- `docs/fragments/*.html` — 各ページの実体

## 編集前チェック手順

1. 修正対象ページのキーを特定（例: config-permission-users）
2. `spa-pages-config.js` で `fragmentUrl` を確認
3. `docs/fragments/` 配下の該当ファイルを編集
4. **絶対に `docs/` 直下の同名ファイルを編集しない**
