# セッション状態

**更新日時**: 2025-12-15 15:30

## 現在の作業
iOS Safari PWA + iframeでキーボード表示時にヘッダーが消える問題の修正

## 試した解決策（すべて失敗）
1. position: sticky → 効果なし
2. position: fixed + padding-top → 効果なし
3. visualViewport API → 効果なし
4. flex + 100dvh構造（ChatGPT推奨）→ 効果なし

## 次のステップ
**親ページ(index.html)にヘッダーを移動**
- chat_ui_firestore.htmlからヘッダーを非表示/削除
- index.htmlにチャット用ヘッダーを追加（チャット画面表示時のみ表示）
- postMessageでルーム名や戻るボタンの動作を連携

## 最近のコミット
- v296: 余分な</div>タグを削除 - 入力エリア消失を修正
- v295: iOS Safari PWA キーボード対応 - flex+100dvh構造に変更
- v294: iOS Safari キーボード表示時ヘッダー固定対応
- v293: バッジ同期時にアプリバッジも正しい値に更新

## 未完了Issue数
6件（PROD-002, TEST-001, UI-017, TASK-001, MASTER-002, PLAT-001）
