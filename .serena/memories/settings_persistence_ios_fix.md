# iOS/スマホでの設定永続化問題の解決

## 問題の概要

**発生日**: 2025年10月頃  
**症状**: 設定画面で変更した設定が、スマホ（iOS）でタスクキル後に失われる。PCブラウザでは正常に動作していた。

### 影響を受けていた設定項目
- 画像管理設定（商品画像をGoogle Driveに保存する）
- 配送設定のデフォルト値
- デザインテーマ
- ハッシュタグのデフォルト値
- 管理番号フォーマット
- その他すべての設定項目

## 根本原因

**iOS Safari/PWAの制限**
- Google Apps Scriptのアプリはiframeで実行される
- iOS SafariはiFrame内のlocalStorageアクセスを制限（サードパーティCookie制限）
- そのため、localStorageへの保存が失敗または読み込みができなくなる
- PC/デスクトップブラウザでは制限がないため正常動作

## 解決策：二重保存戦略（Hybrid Storage Pattern）

### 実装アプローチ

**1. 保存時：両方に保存**
```javascript
// localStorage に保存（PC用・高速）
localStorage.setItem('key', value);

// PropertiesService に保存（iOS/スマホ用・永続化）
google.script.run.saveSettingToServer(key, value);
```

**2. 読み込み時：両方から読み込んで同期**
```javascript
// まずlocalStorageから即座に読み込み（高速表示）
let value = localStorage.getItem('key');
updateUI(value);

// バックグラウンドでサーバーから読み込み
google.script.run
  .withSuccessHandler(function(serverValue) {
    if (serverValue !== value) {
      // サーバー側を優先して同期
      value = serverValue;
      localStorage.setItem('key', value);
      updateUI(value);
    }
  })
  .loadSettingFromServer(key);
```

### メリット
- **PC**: localStorageで高速動作
- **iOS/スマホ**: PropertiesServiceで確実に永続化
- **同期**: 複数デバイス間でも設定が共有される
- **信頼性**: どちらかが失敗しても、もう一方で復元可能

## 実装されたファイル

### 1. config_loader.js（サーバーサイド）
新規追加した関数：
- `saveImageSettingToServer(enabled)` - 画像管理設定をPropertiesServiceに保存
- `loadImageSettingFromServer()` - 画像管理設定をPropertiesServiceから読み込み

その他の設定項目についても同様のパターンで実装済み。

### 2. sidebar_config.html（設定画面UI）
修正した関数：
- `window.toggleProductImageSave()` - 二重保存を実装
- `window.initImageSettings()` - 二重読み込みと同期を実装
- `window.saveImageSettings()` - グローバルスコープ化

### 3. sp_scripts.html（商品登録画面）
修正内容：
- `CONFIG_STORAGE_KEYS` 定数を先頭に移動（26-38行目）
- `checkProductImageBlockVisibility()` - 二重読み込みと同期を実装
- `loadAllConfig()` - すべての設定項目の読み込みロジック

## テスト結果

### テスト環境
- デバイス: iPhone（iOS）
- アプリ形式: PWA（ホーム画面追加）
- テストシナリオ: 設定変更 → タスクキル → 再起動 → 設定確認

### テスト結果（すべて✅成功）

1. **画像管理設定**
   - チェックボックスON → タスクキル → 再起動
   - ✅ 設定が維持され、商品登録画面で画像ブロックが表示される

2. **配送設定のデフォルト値**
   - デフォルト配送方法を変更 → タスクキル → 再起動
   - ✅ 設定が維持され、商品登録画面でデフォルト値が反映される

## 技術的な注意点

### 1. 関数のグローバルスコープ化
HTML属性（`onchange="functionName()"`）から呼び出す関数は、グローバルスコープに公開する必要がある：
```javascript
window.functionName = function() { ... };
```

### 2. 変数定義の順序
`const`/`let`で定義した変数は、ホイスティングされないため、使用前に定義が必要：
```javascript
// ❌ エラー: CONFIG_STORAGE_KEYSが未定義
function loadConfig() {
  const key = CONFIG_STORAGE_KEYS.IMAGE_SAVE;
}
const CONFIG_STORAGE_KEYS = { ... };

// ✅ 正しい: 先に定義
const CONFIG_STORAGE_KEYS = { ... };
function loadConfig() {
  const key = CONFIG_STORAGE_KEYS.IMAGE_SAVE;
}
```

### 3. PropertiesServiceの制限
- ユーザーごとに500KBまで
- 軽量な設定値のみ保存（画像データなどは不可）
- 読み書きにネットワーク通信が必要（localStorageより遅い）

## 今後の展開

### すべての設定項目に適用済み
現在、以下の設定項目すべてに二重保存戦略が適用されている：
- 状態ボタン設定
- ハッシュタグ設定
- 値引き設定
- 配送デフォルト設定
- 仕入先・出品先デフォルト設定
- 管理番号設定
- セールスワード設定
- AI設定
- デザインテーマ
- 画像管理設定

### メンテナンス
新しい設定項目を追加する場合：
1. `CONFIG_STORAGE_KEYS` に新しいキーを追加
2. サーバー側に `save***ToServer()` と `load***FromServer()` を実装
3. クライアント側で二重保存・二重読み込みを実装

## 結論

iOS/スマホでの設定永続化問題は、localStorage + PropertiesServiceの二重保存戦略により完全に解決された。これにより、ユーザーはデバイスに関係なく、設定変更が即座に反映され、永続化されるようになった。

**成果**: PCとスマホで完全なプラットフォームパリティを達成 ✅
