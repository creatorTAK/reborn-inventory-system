# 設定管理メニューの階層化 (UI-008)

## 概要

設定メニューを6個のサブメニューに分割し、アコーディオン形式で整理しました。

## 実装日

2025-11-02（複数回のデプロイで完成）

## メニュー構造

### 1. 基本設定
- スプレッドシートID
- 画像ストレージプロバイダー選択（R2 / Google Drive）

### 2. API設定
- Gemini API キー
- R2関連設定（Access Key ID, Secret Access Key, Bucket Name, Public URL）

### 3. PWA設定
- PWAインストールボタン
- プッシュ通知設定
- サービスワーカー管理

### 4. マスタ管理
- 発送方法マスタ
- 梱包資材マスタ
- マスタデータダウンロード

### 5. テスト・診断
- 疎通テスト
- 診断機能
- 詳細診断

### 6. その他
- 設定リセット

## 実装ファイル

**sidebar_config.html**:
- アコーディオンUI実装
- 各サブメニューの開閉機能
- Bootstrap Iconsの使用

## アコーディオンの動作

- 初期状態：すべて閉じている（デフォルト）
- クリックで開閉切り替え
- 複数セクション同時展開可能
- アイコンが回転してvisual feedback

## CSSクラス

```css
.config-section-header {
  cursor: pointer;
  padding: 12px 16px;
  background-color: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-section-content {
  padding: 16px;
  border: 1px solid #dee2e6;
  border-top: none;
  border-radius: 0 0 4px 4px;
  display: none; /* 初期状態は非表示 */
}

.config-section-content.active {
  display: block;
}
```

## JavaScript

```javascript
document.querySelectorAll('.config-section-header').forEach(header => {
  header.addEventListener('click', () => {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.toggle-icon');
    
    content.classList.toggle('active');
    icon.style.transform = content.classList.contains('active') 
      ? 'rotate(90deg)' 
      : 'rotate(0deg)';
  });
});
```

## デプロイ履歴

- 初回実装：設定を6セクションに分割
- 修正1：PWAアコーディオンをデフォルト展開に変更（cfddf94）
- 修正2：全セクションをデフォルト閉じた状態に戻す（69b7c15）- 最終版

## ユーザーフィードバック

- UI改善が評価され、採用された
- 設定項目が多い場合でも見やすくなった
- アコーディオンで必要な設定だけ開けるので使いやすい

## 注意事項

- 新しい設定項目を追加する場合は、適切なセクションに配置すること
- アコーディオンの初期状態は「閉じた状態」を維持すること
- セクションヘッダーのアイコンは Bootstrap Icons の `bi-chevron-right` を使用
