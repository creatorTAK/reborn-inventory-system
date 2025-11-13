# SEC-003: Google Safe Browsing警告（Android）

## 問題
Android端末で https://www.reborn-inventory.com および https://furira.jp にアクセスすると、Google Safe Browsingによる「危険なサイト」警告が表示される。

## 発見日
2025-11-13

## 影響
- Android端末からのアクセスがブロックされる
- ユーザーの信頼性低下
- PWAのインストール・利用が困難

## 考えられる原因
1. **マルウェア感染**（可能性低）
2. **フィッシング報告**（誤報の可能性）
3. **不正コンテンツ検出**（誤報の可能性）
4. **ドメインの履歴**（前所有者の問題）
5. **CloudflareのIPレピュテーション**

## 調査手順
1. Google Search Console - セキュリティ問題確認
2. Google Safe Browsing Status - https://transparencyreport.google.com/safe-browsing/search
3. Cloudflare Security - セキュリティイベント確認
4. サイトスキャン - マルウェアチェック

## 対応方針
1. **緊急調査**: Google Search Consoleでセキュリティ問題を確認
2. **誤報の場合**: Googleに再審査リクエスト
3. **実際の問題の場合**: マルウェア除去 + セキュリティ強化

## 優先度
🔴 高（Android端末からのアクセスがブロックされている）
