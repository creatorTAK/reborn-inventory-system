# 🚨 clasp操作前の必須チェックリスト

**clasp push/deploy前に必ず実行すること**

## clasp push前の必須確認

### 1. .claspignore検証
```bash
# 現在の.claspignoreを確認
Read: /Users/yasuhirotakushi/Desktop/reborn-project/.claspignore

# 除外すべきディレクトリ/ファイル
- **/node_modules/**
- reborn-r2-worker/**
- reborn-ai-chat/**
- tests/**
- .git/**
- *.md（ドキュメント）
- playwright.config.js
```

### 2. プッシュ対象ファイル確認
```bash
# dry-runで確認
clasp push --dry-run
```
- [ ] 意図しないファイルが含まれていないか
- [ ] 必要なファイル（menu.js等）が含まれているか

### 3. バージョン確認
```bash
clasp versions
```
- [ ] 現在のバージョン番号確認
- [ ] ロールバック用のバージョン番号記録

### 4. バックアップ確認
- [ ] 最新版のpull完了済みか？
- [ ] Gitコミット済みか？

## clasp deploy実行の禁止

**❌ clasp deployは絶対に実行しない**
- clasp deployを実行するとライブラリになる
- ウェブアプリのデプロイは手動で行う

## 手動デプロイ手順
1. GASエディタで「デプロイを管理」を開く
2. アクティブなデプロイの編集アイコンをクリック
3. 「新しいバージョン」を選択
4. 「デプロイ」ボタンをクリック

## このチェックリストを守らなかった場合のリスク
- GASファイルの削除（今回の事故）
- システム全体の破壊
- ロールバック不可能な状況
