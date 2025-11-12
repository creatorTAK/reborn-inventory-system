/**
 * REBORN在庫管理システム - ブランドマスタFirestore Migration
 *
 * 52,667件のブランドデータをFirestoreに移行します。
 * GASの6分制限対策として、1,000件ずつ分割実行します。
 *
 * 使用方法:
 * 1. GASエディタでこのスクリプトを開く
 * 2. 初回: migrateNextBatch() を実行
 * 3. 完了したら再度 migrateNextBatch() を実行
 * 4. 全件完了まで繰り返し（約53回）
 *
 * 進捗確認: checkMigrationProgress() を実行
 * リセット: resetMigrationProgress() を実行
 *
 * @version 2.0.0 (進捗管理対応)
 * @created 2025-11-12
 * @related-issue ARCH-001 Phase 3.2
 */

// Firestore REST API設定
const BRANDS_FIRESTORE_PROJECT_ID = 'reborn-chat';
const BRANDS_FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${BRANDS_FIRESTORE_PROJECT_ID}/databases/(default)/documents`;

// 1回の実行で処理する件数（安全マージン）
const CHUNK_SIZE = 1000; // 元に戻す（19,000件まで成功していた設定）

// バッチサイズ（Firestoreへの書き込み単位）
const BATCH_SIZE = 500;

/**
 * 次のバッチを移行（メイン実行関数）
 * 進捗を自動管理し、続きから処理を再開します
 */
function migrateNextBatch() {
  const startTime = Date.now();

  console.log('========================================');
  console.log('ブランドマスタFirestore移行 - 次のバッチ実行');
  console.log('========================================');

  try {
    // 進捗状況を取得
    const progress = getProgress();
    const lastProcessedRow = progress.lastProcessedRow || 0;
    const totalProcessed = progress.totalProcessed || 0;

    console.log(`\n📊 現在の進捗:`);
    console.log(`  - 処理済み行: ${lastProcessedRow}`);
    console.log(`  - 処理済み件数: ${totalProcessed}`);

    // シート情報取得
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('手動管理_ブランド');

    if (!sheet) {
      throw new Error('シート「手動管理_ブランド」が見つかりません');
    }

    const totalRows = sheet.getLastRow() - 1; // ヘッダー除く

    // 完了チェック
    if (lastProcessedRow >= totalRows) {
      console.log('\n🎉 全件移行完了！');
      console.log(`総処理件数: ${totalProcessed}件`);

      // インデックスドキュメント作成
      createBrandsIndexDocument(totalProcessed, totalProcessed);

      return {
        success: true,
        completed: true,
        totalProcessed: totalProcessed
      };
    }

    // 次のバッチ範囲計算
    const startRow = lastProcessedRow + 1;
    const endRow = Math.min(startRow + CHUNK_SIZE - 1, totalRows);
    const batchSize = endRow - startRow + 1;

    console.log(`\n🔄 次のバッチ処理:`);
    console.log(`  - 開始行: ${startRow}`);
    console.log(`  - 終了行: ${endRow}`);
    console.log(`  - 処理件数: ${batchSize}件`);

    // データ取得
    console.log(`\n[1/2] データ取得中...`);
    const data = sheet.getRange(startRow + 1, 1, batchSize, 2).getValues(); // +1はヘッダー分

    const brands = [];
    const seenBrands = new Set();

    for (let i = 0; i < data.length; i++) {
      const nameEn = String(data[i][0] || '').trim();
      const nameKana = String(data[i][1] || '').trim();

      // 空行スキップ
      if (!nameEn && !nameKana) {
        continue;
      }

      // 重複チェック
      const brandKey = `${nameEn}:${nameKana}`;
      if (seenBrands.has(brandKey)) {
        continue;
      }
      seenBrands.add(brandKey);

      // ブランドID生成（グローバル連番）
      const brandId = `brand_${String(totalProcessed + brands.length + 1).padStart(6, '0')}`;

      // 検索用テキスト生成
      const searchText = [
        nameEn.toLowerCase(),
        nameKana
      ].filter(t => t).join(',');

      brands.push({
        id: brandId,
        nameEn: nameEn,
        nameKana: nameKana,
        searchText: searchText,
        usageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    console.log(`✅ データ取得完了: ${brands.length}件`);

    // Firestoreに保存
    console.log(`\n[2/2] Firestore保存中...`);
    const saveResult = saveBrandsToFirestore(brands);

    console.log(`✅ 保存完了: ${saveResult.successCount}/${brands.length}件`);

    // 進捗更新
    const newProgress = {
      lastProcessedRow: endRow,
      totalProcessed: totalProcessed + saveResult.successCount,
      lastUpdated: new Date().toISOString()
    };
    saveProgress(newProgress);

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const remainingRows = totalRows - endRow;
    const remainingBatches = Math.ceil(remainingRows / CHUNK_SIZE);

    console.log(`\n========================================`);
    console.log(`✅ バッチ完了 (所要時間: ${duration}秒)`);
    console.log(`📊 進捗: ${endRow}/${totalRows}行 (${((endRow/totalRows)*100).toFixed(1)}%)`);
    console.log(`🔄 残り: 約${remainingBatches}回実行`);
    console.log(`========================================`);

    if (remainingRows > 0) {
      console.log(`\n💡 続けるには migrateNextBatch() を再度実行してください`);
    }

    return {
      success: true,
      completed: false,
      processedThisBatch: saveResult.successCount,
      totalProcessed: newProgress.totalProcessed,
      remainingBatches: remainingBatches
    };

  } catch (error) {
    console.error('❌ 移行エラー:', error);
    throw error;
  }
}

/**
 * BrandsをFirestoreに保存（Batch Write API使用）
 */
function saveBrandsToFirestore(brands) {
  let successCount = 0;
  let failedCount = 0;
  const failedIds = [];

  // Batch Write APIで処理（最大500件/バッチ）
  for (let i = 0; i < brands.length; i += BATCH_SIZE) {
    const batchBrands = brands.slice(i, i + BATCH_SIZE);

    try {
      // Batch Write APIのリクエストボディ構築
      const writes = batchBrands.map(brand => {
        return {
          update: {
            name: `projects/${BRANDS_FIRESTORE_PROJECT_ID}/databases/(default)/documents/brands/${brand.id}`,
            fields: {
              nameEn: { stringValue: brand.nameEn },
              nameKana: { stringValue: brand.nameKana },
              searchText: { stringValue: brand.searchText },
              usageCount: { integerValue: brand.usageCount },
              createdAt: { stringValue: brand.createdAt },
              updatedAt: { stringValue: brand.updatedAt }
            }
          }
        };
      });

      const batchRequest = {
        writes: writes
      };

      // Batch Write API呼び出し
      const url = `https://firestore.googleapis.com/v1/projects/${BRANDS_FIRESTORE_PROJECT_ID}/databases/(default)/documents:batchWrite`;
      const options = {
        method: 'post',
        contentType: 'application/json',
        headers: {
          'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
        },
        payload: JSON.stringify(batchRequest),
        muteHttpExceptions: true
      };

      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();

      if (responseCode === 200) {
        // バッチ全体が成功
        successCount += batchBrands.length;
        console.log(`  ✅ バッチ成功: ${batchBrands.length}件`);
      } else {
        // バッチ全体が失敗
        failedCount += batchBrands.length;
        batchBrands.forEach(brand => failedIds.push(brand.id));

        // エラー詳細をログ出力
        console.error(`❌ バッチ失敗: ${batchBrands.length}件`);
        console.error(`  HTTPステータス: ${responseCode}`);
        console.error(`  レスポンス: ${response.getContentText().substring(0, 1000)}`);

        // 10件以上失敗したら処理を停止
        if (failedCount >= 10) {
          console.error(`\n⚠️ エラーが続くため処理を中断します`);
          throw new Error('Too many batch failures');
        }
      }

      // 進捗表示
      const processed = Math.min(i + BATCH_SIZE, brands.length);
      console.log(`  進捗: ${processed}/${brands.length}件 (成功: ${successCount}, 失敗: ${failedCount})`);

      // バッチ間に短い待機（レート制限対策）
      if (i + BATCH_SIZE < brands.length) {
        Utilities.sleep(100);
      }

    } catch (error) {
      failedCount += batchBrands.length;
      batchBrands.forEach(brand => failedIds.push(brand.id));

      console.error(`❌ バッチ例外: ${batchBrands.length}件`);
      console.error(`  エラー: ${error.toString()}`);

      // 10件以上失敗したら処理を停止
      if (failedCount >= 10) {
        console.error(`\n⚠️ エラーが続くため処理を中断します`);
        throw error;
      }
    }
  }

  // 結果サマリー
  if (failedCount > 0) {
    console.error(`\n⚠️ 失敗したブランドID一覧:`);
    failedIds.forEach(id => console.error(`  - ${id}`));
  }

  return {
    successCount: successCount,
    failedCount: failedCount,
    failedIds: failedIds
  };
}

/**
 * インデックスドキュメント作成
 */
function createBrandsIndexDocument(totalCount, successCount) {
  const indexDoc = {
    fields: {
      totalCount: { integerValue: totalCount },
      successCount: { integerValue: successCount },
      updatedAt: { stringValue: new Date().toISOString() },
      version: { stringValue: '2.0.0' },
      source: { stringValue: 'migration_brands_to_firestore.js' }
    }
  };

  const url = `${BRANDS_FIRESTORE_BASE_URL}/brands/_index`;
  const options = {
    method: 'patch',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken()
    },
    payload: JSON.stringify(indexDoc),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    console.warn('⚠️ インデックスドキュメント保存失敗:', response.getContentText());
  }
}

// ============================================
// 進捗管理
// ============================================

/**
 * 進捗状況を取得
 */
function getProgress() {
  const props = PropertiesService.getScriptProperties();
  const progressJson = props.getProperty('BRAND_MIGRATION_PROGRESS');

  if (progressJson) {
    return JSON.parse(progressJson);
  }

  return {
    lastProcessedRow: 0,
    totalProcessed: 0,
    lastUpdated: null
  };
}

/**
 * 進捗状況を保存
 */
function saveProgress(progress) {
  const props = PropertiesService.getScriptProperties();
  props.setProperty('BRAND_MIGRATION_PROGRESS', JSON.stringify(progress));
}

/**
 * 進捗状況を確認
 */
function checkMigrationProgress() {
  const progress = getProgress();

  console.log('========================================');
  console.log('ブランドマスタ移行 - 進捗状況');
  console.log('========================================');
  console.log(`処理済み行: ${progress.lastProcessedRow}`);
  console.log(`処理済み件数: ${progress.totalProcessed}`);
  console.log(`最終更新: ${progress.lastUpdated || '未実行'}`);

  // シート情報
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('手動管理_ブランド');
  if (sheet) {
    const totalRows = sheet.getLastRow() - 1;
    const remainingRows = totalRows - progress.lastProcessedRow;
    const remainingBatches = Math.ceil(remainingRows / CHUNK_SIZE);

    console.log(`\n総行数: ${totalRows}`);
    console.log(`残り行数: ${remainingRows}`);
    console.log(`進捗率: ${((progress.lastProcessedRow / totalRows) * 100).toFixed(1)}%`);
    console.log(`残り実行回数: 約${remainingBatches}回`);
  }

  console.log('========================================');

  return progress;
}

/**
 * 進捗をリセット（最初からやり直す場合）
 */
function resetMigrationProgress() {
  const props = PropertiesService.getScriptProperties();
  props.deleteProperty('BRAND_MIGRATION_PROGRESS');

  console.log('✅ 進捗をリセットしました');
  console.log('次回 migrateNextBatch() 実行時に最初から開始します');
}

/**
 * 問題のある範囲をスキップ（エラー回避用）
 * 現在の位置から指定件数スキップして進捗を進める
 *
 * @param {number} skipRows - スキップする行数（デフォルト1000）
 */
function skipCurrentBatch(skipRows = 1000) {
  const progress = getProgress();
  const lastProcessedRow = progress.lastProcessedRow || 0;

  console.log('========================================');
  console.log('問題範囲のスキップ');
  console.log('========================================');
  console.log(`現在の処理済み行: ${lastProcessedRow}`);
  console.log(`スキップする行数: ${skipRows}`);

  const newRow = lastProcessedRow + skipRows;

  const newProgress = {
    lastProcessedRow: newRow,
    totalProcessed: progress.totalProcessed, // 件数は増やさない
    lastUpdated: new Date().toISOString(),
    skippedRanges: progress.skippedRanges || []
  };

  // スキップ範囲を記録
  newProgress.skippedRanges.push({
    start: lastProcessedRow + 1,
    end: newRow,
    skippedAt: new Date().toISOString()
  });

  saveProgress(newProgress);

  console.log(`\n✅ スキップ完了`);
  console.log(`新しい処理済み行: ${newRow}`);
  console.log(`\n⚠️ スキップした範囲: ${lastProcessedRow + 1} 〜 ${newRow}`);
  console.log(`💡 次回 migrateNextBatch() で ${newRow + 1} 行目から再開します`);
  console.log('========================================');

  return newProgress;
}

/**
 * スキップした範囲を確認
 */
function checkSkippedRanges() {
  const progress = getProgress();
  const skippedRanges = progress.skippedRanges || [];

  console.log('========================================');
  console.log('スキップ範囲一覧');
  console.log('========================================');

  if (skippedRanges.length === 0) {
    console.log('スキップした範囲はありません');
  } else {
    skippedRanges.forEach((range, index) => {
      console.log(`\n[${index + 1}] ${range.start} 〜 ${range.end}行`);
      console.log(`    スキップ日時: ${range.skippedAt}`);
    });

    console.log(`\n総スキップ範囲: ${skippedRanges.length}箇所`);
  }

  console.log('========================================');

  return skippedRanges;
}
