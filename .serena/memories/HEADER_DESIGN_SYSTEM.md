# ヘッダーデザインシステム

**最終更新: 2025-12-23**

---

## 基本構造

### メインページ（ボトムナビから直接開く画面）

```
┌─────────────────────────────────────────┐
│ [ロゴ]                      [🔔] [⚙️]  │
└─────────────────────────────────────────┘
```

| 位置 | 要素 | 備考 |
|------|------|------|
| 左 | フリラロゴ | タップでトップメニューに戻る |
| 中央 | なし | タイトル不要 |
| 右 | ベルアイコン + 歯車アイコン | `bi-bell` + `bi-gear` |

**対象画面:**
- 商品登録
- 在庫管理
- 入出庫履歴
- チャット一覧
- マイページ
- マスタ管理
- 設定管理
- タスク

---

### サブページ（メインページから遷移する画面）

```
┌─────────────────────────────────────────┐
│ [←]        タイトル             [☰]    │
└─────────────────────────────────────────┘
```

| 位置 | 要素 | 備考 |
|------|------|------|
| 左 | 戻るボタン | `bi-chevron-left` |
| 中央 | H1タイトル | 現在の画面名 |
| 右 | 3本線メニュー | `bi-list` |

**対象画面:**
- 完了した履歴（タスク）
- チャットルーム内
- ノート編集
- 設定詳細
- マスタ詳細

---

## 使用素材

### ロゴ
- **ファイル**: `/images/furira-square-logo.png?v=20251209`
- **幅**: 100px（高さは自動）
- **タップ時**: トップメニューに戻る

### アイコン（Bootstrap Icons）
- **ベル（メインページ右側）**: `bi-bell`
- **歯車（メインページ右側）**: `bi-gear`
- **3本線メニュー（サブページ右側）**: `bi-list`
- **戻るボタン（サブページ左側）**: `bi-chevron-left`

---

## CSS基本スタイル

### メインページヘッダー（ミニマルヘッダー）

```css
.minimal-header {
  background: #ffffff;
  height: 56px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 1000;
  border-bottom: 1px solid #f0f0f0;
}

.minimal-header-logo {
  width: 100px;
  height: auto;
  cursor: pointer;
}

.minimal-header-icons {
  display: flex;
  align-items: center;
  gap: 2px;
}

.minimal-header-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #606060;
  font-size: 20px;
  transition: background 0.2s;
}

.minimal-header-icon:hover {
  background: #f2f2f2;
}

.minimal-header-icon:active {
  background: #e5e5e5;
}
```

### サブページヘッダー

```css
.sub-header {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 56px;
  padding: 0 16px;
  background: #ffffff;
  border-bottom: 1px solid #f0f0f0;
  position: sticky;
  top: 0;
  z-index: 100;
  position: relative;
}

.sub-header-back {
  position: absolute;
  left: 8px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: #374151;
  font-size: 20px;
  cursor: pointer;
}

.sub-header-title {
  font-size: 17px;
  font-weight: 600;
  color: #111827;
}

.sub-header-menu {
  position: absolute;
  right: 8px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: transparent;
  border: none;
  color: #374151;
  font-size: 20px;
  cursor: pointer;
}
```

---

## ルールまとめ

| 画面タイプ | 左 | 中央 | 右 |
|-----------|-----|------|-----|
| メインページ | ロゴ | なし | 🔔 ベル + ⚙️ 歯車 |
| サブページ | ← 戻る | タイトル | ☰ 3本線 |

---

## 参考実装

- **タスクページ**: `docs/todo_list.html` - ミニマルヘッダーの参照実装
- **完了した履歴**: `docs/todo_history.html` - サブページヘッダーの参照実装
