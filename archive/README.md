# Archive Directory

このディレクトリには、現在使用されていないが履歴保持のため保管されているファイルが格納されています。

## マイグレーションスクリプト（5ファイル）

Firestore移行完了済み。移行作業は完了しているため、通常は使用しません。

- `migration_brands_to_firestore.js` - ブランドデータFirestore移行
- `migration_users_to_firestore.js` - ユーザーデータFirestore移行
- `migration_masters_to_firestore.js` - マスタデータFirestore移行
- `migration_products_to_firestore.js` - 商品データFirestore移行
- `master_migration.js` - マスタ移行総合スクリプト

## エクスポート/インポートスクリプト（4ファイル）

Algolia移行完了済み。移行作業は完了しているため、通常は使用しません。

- `export-brands-from-gas.js` - GAS経由ブランドエクスポート
- `export-brands-from-firestore.js` - Firestore直接ブランドエクスポート
- `import-brands-to-algolia.js` - Algoliaインポート（旧版）
- `import-brands-from-json.js` - JSONからAlgoliaインポート

## 使用方法

再度マイグレーションが必要な場合は、このディレクトリから必要なスクリプトをプロジェクトルートにコピーして実行してください。

## 注意事項

- これらのファイルは.claspignoreで除外されており、GASデプロイには含まれません
- 削除ではなくアーカイブすることで、必要時に参照・復元が可能です
