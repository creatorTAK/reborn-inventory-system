/**
 * packaging_materials_manager.js
 * 梱包資材マスタ管理システム
 * SaaS化を見据えたUI経由でのマスタデータ管理
 */

// =============================================================================
// サイドバー表示
// =============================================================================

/**
 * 梱包資材マスタ管理サイドバーを表示
 */
function showPackagingMaterialsManager() {
  const html = HtmlService.createTemplateFromFile('packaging_materials_ui');
  const sidebar = html.evaluate()
    .setTitle('📦 梱包資材マスタ管理')
    .setWidth(500);
  SpreadsheetApp.getUi().showSidebar(sidebar);
}

// =============================================================================
// データ取得API
// =============================================================================

/**
 * 梱包資材マスタの全データを取得
 * @returns {Object} { success: boolean, data: Array, message: string }
 */
function getPackagingMaterialsAPI() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('備品在庫リスト');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「備品在庫リスト」が見つかりません。先に販売記録機能セットアップを実行してください。',
        data: []
      };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return {
        success: true,
        data: [],
        message: 'データがありません'
      };
    }

    // ヘッダー行を除く全データを取得（12列: 経費区分列追加対応）
    const values = sheet.getRange(2, 1, lastRow - 1, 12).getValues();

    const data = values.map((row, index) => ({
      rowIndex: index + 2, // スプレッドシートの行番号（1-indexed、ヘッダー除く）
      imageUrl: row[0] || '',
      productName: row[1] || '',
      category: row[2] || '', // カテゴリ列
      supplier: row[3] || '',  // 発注先
      productLink: row[4] || '', // 商品リンク
      quantity: Number(row[5]) || 0, // 個数
      price: Number(row[6]) || 0, // 価格
      unitCost: Number(row[7]) || 0, // 1個あたり
      inStock: Number(row[8]) || 0, // 入庫数
      outStock: Number(row[9]) || 0, // 出庫数
      inventory: Number(row[10]) || 0, // 在庫数
      expenseType: row[11] || '個別原価' // 経費区分（デフォルト: 個別原価）
    })).filter(item => item.productName); // 商品名が空の行を除外

    return {
      success: true,
      data: data,
      message: `${data.length}件のデータを取得しました`
    };

  } catch (error) {
    console.error('梱包資材マスタ取得エラー:', error);
    return {
      success: false,
      message: `データ取得エラー: ${error.message}`,
      data: []
    };
  }
}

/**
 * 梱包資材マスタをカテゴリ別に取得
 * @returns {Object} { success: boolean, data: Object, categories: Array, message: string }
 */
function getPackagingMaterialsByCategoryAPI() {
  try {
    const result = getPackagingMaterialsAPI();

    if (!result.success) {
      return result;
    }

    // カテゴリ別にグループ化
    const byCategory = {};
    const categories = [];

    result.data.forEach(material => {
      const category = material.category || 'その他';

      if (!byCategory[category]) {
        byCategory[category] = [];
        categories.push(category);
      }

      // 全資材を返す（個別原価・月次経費の両方）
      byCategory[category].push({
        rowIndex: material.rowIndex,
        imageUrl: material.imageUrl,
        productName: material.productName,
        category: material.category,
        supplier: material.supplier,
        productLink: material.productLink,
        quantity: material.quantity,
        price: material.price,
        unitCost: material.unitCost,
        inStock: material.inStock,
        outStock: material.outStock,
        inventory: material.inventory,
        expenseType: material.expenseType
      });
    });

    return {
      success: true,
      data: byCategory, // { "カテゴリ1": [...], "カテゴリ2": [...] }
      categories: categories, // カテゴリ一覧（シート登場順）
      message: `${categories.length}カテゴリ、${result.data.length}件のデータを取得しました`
    };

  } catch (error) {
    console.error('梱包資材カテゴリ別取得エラー:', error);
    return {
      success: false,
      message: `データ取得エラー: ${error.message}`,
      data: {},
      categories: []
    };
  }
}

// =============================================================================
// データ追加API
// =============================================================================

/**
 * 梱包資材を新規追加
 * @param {Object} params - { imageUrl, productName, category, supplier, productLink, quantity, price, inStock, expenseType }
 * @returns {Object} { success: boolean, message: string }
 */
function addPackagingMaterialAPI(params) {
  try {
    // バリデーション
    if (!params.productName) {
      return {
        success: false,
        message: '商品名は必須です'
      };
    }

    if (typeof params.quantity !== 'number' || params.quantity <= 0) {
      return {
        success: false,
        message: '個数は1以上の数値で入力してください'
      };
    }

    if (typeof params.price !== 'number' || params.price < 0) {
      return {
        success: false,
        message: '価格は0以上の数値で入力してください'
      };
    }

    if (typeof params.inStock !== 'number' || params.inStock < 0) {
      return {
        success: false,
        message: '入庫数は0以上の数値で入力してください'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('備品在庫リスト');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「備品在庫リスト」が見つかりません'
      };
    }

    // 重複チェック（商品名で判定）
    const existingData = getPackagingMaterialsAPI();
    if (existingData.success) {
      const duplicate = existingData.data.find(item =>
        item.productName === params.productName
      );

      if (duplicate) {
        return {
          success: false,
          message: `同じ商品名の梱包資材が既に登録されています（${params.productName}）`
        };
      }
    }

    // 新規行を追加（12列: 経費区分列追加対応）
    const lastRow = sheet.getLastRow();
    const unitCost = params.quantity > 0 ? params.price / params.quantity : 0;
    const outStock = 0; // 初期値
    const inventory = params.inStock - outStock;

    const newRow = [
      params.imageUrl || '',
      params.productName,
      params.category || '', // カテゴリ列
      params.supplier || '',  // 発注先
      params.productLink || '', // 商品リンク
      params.quantity, // 個数
      params.price, // 価格
      `=G${lastRow + 1}/F${lastRow + 1}`, // 1個あたりの計算式
      params.inStock, // 入庫数
      outStock, // 出庫数
      `=I${lastRow + 1}-J${lastRow + 1}`, // 在庫数の計算式（I列-J列）
      params.expenseType || '個別原価' // 経費区分（デフォルト: 個別原価）
    ];

    sheet.getRange(lastRow + 1, 1, 1, 12).setValues([newRow]);

    // フォーマット適用
    sheet.getRange(lastRow + 1, 6).setNumberFormat('#,##0');      // 個数
    sheet.getRange(lastRow + 1, 7).setNumberFormat('¥#,##0');     // 価格
    sheet.getRange(lastRow + 1, 8).setNumberFormat('¥#,##0.00');  // 1個あたり
    sheet.getRange(lastRow + 1, 9).setNumberFormat('#,##0');      // 入庫数
    sheet.getRange(lastRow + 1, 10).setNumberFormat('#,##0');     // 出庫数
    sheet.getRange(lastRow + 1, 11).setNumberFormat('#,##0');     // 在庫数

    // 罫線適用
    const dataRange = sheet.getRange(1, 1, lastRow + 1, 12);
    dataRange.setBorder(true, true, true, true, true, true);

    Logger.log(`梱包資材追加: ${params.productName} ¥${params.price}`);

    return {
      success: true,
      message: '梱包資材を追加しました'
    };

  } catch (error) {
    console.error('梱包資材追加エラー:', error);
    return {
      success: false,
      message: `追加エラー: ${error.message}`
    };
  }
}

// =============================================================================
// データ更新API
// =============================================================================

/**
 * 梱包資材を編集
 * @param {Object} params - { rowIndex, imageUrl, productName, category, supplier, productLink, quantity, price, inStock, expenseType }
 * @returns {Object} { success: boolean, message: string }
 */
function updatePackagingMaterialAPI(params) {
  try {
    // バリデーション
    if (!params.rowIndex || params.rowIndex < 2) {
      return {
        success: false,
        message: '無効な行番号です'
      };
    }

    if (!params.productName) {
      return {
        success: false,
        message: '商品名は必須です'
      };
    }

    if (typeof params.quantity !== 'number' || params.quantity <= 0) {
      return {
        success: false,
        message: '個数は1以上の数値で入力してください'
      };
    }

    if (typeof params.price !== 'number' || params.price < 0) {
      return {
        success: false,
        message: '価格は0以上の数値で入力してください'
      };
    }

    if (typeof params.inStock !== 'number' || params.inStock < 0) {
      return {
        success: false,
        message: '入庫数は0以上の数値で入力してください'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('備品在庫リスト');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「備品在庫リスト」が見つかりません'
      };
    }

    // 重複チェック（自分自身を除く）
    const existingData = getPackagingMaterialsAPI();
    if (existingData.success) {
      const duplicate = existingData.data.find(item =>
        item.rowIndex !== params.rowIndex &&
        item.productName === params.productName
      );

      if (duplicate) {
        return {
          success: false,
          message: `同じ商品名の梱包資材が既に登録されています（${params.productName}）`
        };
      }
    }

    // 現在の出庫数を取得
    const currentOutStock = sheet.getRange(params.rowIndex, 10).getValue() || 0;

    // データ更新（12列: 経費区分列追加対応）
    const updateRow = [
      params.imageUrl || '',
      params.productName,
      params.category || '', // カテゴリ列
      params.supplier || '',  // 発注先
      params.productLink || '', // 商品リンク
      params.quantity, // 個数
      params.price, // 価格
      `=G${params.rowIndex}/F${params.rowIndex}`, // 1個あたりの計算式
      params.inStock, // 入庫数
      currentOutStock, // 出庫数は既存値を維持
      `=I${params.rowIndex}-J${params.rowIndex}`, // 在庫数の計算式（I列-J列）
      params.expenseType || '個別原価' // 経費区分
    ];

    sheet.getRange(params.rowIndex, 1, 1, 12).setValues([updateRow]);

    // フォーマット適用
    sheet.getRange(params.rowIndex, 6).setNumberFormat('#,##0');      // 個数
    sheet.getRange(params.rowIndex, 7).setNumberFormat('¥#,##0');     // 価格
    sheet.getRange(params.rowIndex, 8).setNumberFormat('¥#,##0.00');  // 1個あたり
    sheet.getRange(params.rowIndex, 9).setNumberFormat('#,##0');      // 入庫数
    sheet.getRange(params.rowIndex, 10).setNumberFormat('#,##0');     // 出庫数
    sheet.getRange(params.rowIndex, 11).setNumberFormat('#,##0');     // 在庫数

    Logger.log(`梱包資材更新: 行${params.rowIndex} - ${params.productName}`);

    return {
      success: true,
      message: '梱包資材を更新しました'
    };

  } catch (error) {
    console.error('梱包資材更新エラー:', error);
    return {
      success: false,
      message: `更新エラー: ${error.message}`
    };
  }
}

// =============================================================================
// データ削除API
// =============================================================================

/**
 * 梱包資材を削除
 * @param {number} rowIndex - 削除する行番号
 * @returns {Object} { success: boolean, message: string }
 */
function deletePackagingMaterialAPI(rowIndex) {
  try {
    // バリデーション
    if (!rowIndex || rowIndex < 2) {
      return {
        success: false,
        message: '無効な行番号です'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('備品在庫リスト');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「備品在庫リスト」が見つかりません'
      };
    }

    const lastRow = sheet.getLastRow();
    if (rowIndex > lastRow) {
      return {
        success: false,
        message: '指定された行が見つかりません'
      };
    }

    // 削除前のデータを取得（ログ用）
    const deletedData = sheet.getRange(rowIndex, 1, 1, 12).getValues()[0];

    // 行を削除
    sheet.deleteRow(rowIndex);

    Logger.log(`梱包資材削除: ${deletedData[1]}`);

    return {
      success: true,
      message: '梱包資材を削除しました'
    };

  } catch (error) {
    console.error('梱包資材削除エラー:', error);
    return {
      success: false,
      message: `削除エラー: ${error.message}`
    };
  }
}

/**
 * 梱包資材を一括削除（複数行）
 * @param {Array<number>} rowIndexes - 削除する行番号の配列
 * @return {Object} 処理結果
 */
function deleteBulkPackagingMaterialsAPI(rowIndexes) {
  try {
    // バリデーション
    if (!Array.isArray(rowIndexes) || rowIndexes.length === 0) {
      return {
        success: false,
        message: '削除する行が指定されていません'
      };
    }

    // 無効な行番号をチェック
    const invalidRows = rowIndexes.filter(idx => !idx || idx < 2);
    if (invalidRows.length > 0) {
      return {
        success: false,
        message: '無効な行番号が含まれています'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('備品在庫リスト');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「備品在庫リスト」が見つかりません'
      };
    }

    // 行番号を降順にソート（後ろから削除しないと行番号がずれる）
    const sortedRowIndexes = rowIndexes.sort((a, b) => b - a);

    let deletedCount = 0;
    const deletedItems = [];

    // 各行を削除
    sortedRowIndexes.forEach(rowIndex => {
      const lastRow = sheet.getLastRow();
      if (rowIndex <= lastRow) {
        // 削除前のデータを取得（ログ用）
        const deletedData = sheet.getRange(rowIndex, 1, 1, 12).getValues()[0];
        deletedItems.push(deletedData[1]); // 商品名

        // 行を削除
        sheet.deleteRow(rowIndex);
        deletedCount++;
      }
    });

    Logger.log(`梱包資材一括削除: ${deletedCount}件 - ${deletedItems.join(', ')}`);

    return {
      success: true,
      message: `${deletedCount}件の梱包資材を削除しました`
    };

  } catch (error) {
    console.error('梱包資材一括削除エラー:', error);
    return {
      success: false,
      message: `一括削除エラー: ${error.message}`
    };
  }
}

/**
 * 梱包資材をカテゴリ順にソート（カテゴリ内の資材順も保持）
 * @param {Array} categoryOrder - カテゴリの並び順
 * @param {Object} materialOrderByCategory - カテゴリ別の資材並び順 { "カテゴリ名": ["商品名1", "商品名2", ...] }
 * @return {Object} 処理結果
 */
function sortPackagingMaterialsByCategoryAPI(categoryOrder, materialOrderByCategory) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('備品在庫リスト');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「備品在庫リスト」が見つかりません'
      };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) {
      return {
        success: false,
        message: 'データがありません'
      };
    }

    // ヘッダー行を除く全データを取得
    const dataRange = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn());
    const data = dataRange.getValues();

    // カテゴリ列のインデックスを取得（C列 = 2）
    const categoryColIndex = 2;
    // 商品名列のインデックス（B列 = 1）
    const productNameColIndex = 1;

    // カテゴリ順序のマップを作成（カスタム順序でソート）
    const categoryOrderMap = {};
    if (categoryOrder && Array.isArray(categoryOrder)) {
      categoryOrder.forEach((cat, index) => {
        categoryOrderMap[cat] = index;
      });
    }

    // カテゴリ内の資材順序マップを作成
    const materialOrderMap = {};
    if (materialOrderByCategory && typeof materialOrderByCategory === 'object') {
      Object.keys(materialOrderByCategory).forEach(category => {
        const materials = materialOrderByCategory[category];
        if (Array.isArray(materials)) {
          materialOrderMap[category] = {};
          materials.forEach((productName, index) => {
            materialOrderMap[category][productName] = index;
          });
        }
      });
    }

    // データをカテゴリ + 資材の表示順でソート
    data.sort((a, b) => {
      const catA = a[categoryColIndex] || '';
      const catB = b[categoryColIndex] || '';
      const nameA = a[productNameColIndex] || '';
      const nameB = b[productNameColIndex] || '';

      // まずカテゴリでソート
      if (Object.keys(categoryOrderMap).length > 0) {
        const orderA = categoryOrderMap[catA] !== undefined ? categoryOrderMap[catA] : 9999;
        const orderB = categoryOrderMap[catB] !== undefined ? categoryOrderMap[catB] : 9999;

        if (orderA !== orderB) {
          return orderA - orderB;
        }
      } else {
        // カスタム順序がない場合は五十音順
        const catCompare = catA.localeCompare(catB, 'ja');
        if (catCompare !== 0) {
          return catCompare;
        }
      }

      // 同じカテゴリ内では資材順でソート
      if (catA === catB && materialOrderMap[catA]) {
        const matOrderA = materialOrderMap[catA][nameA] !== undefined ? materialOrderMap[catA][nameA] : 9999;
        const matOrderB = materialOrderMap[catA][nameB] !== undefined ? materialOrderMap[catA][nameB] : 9999;

        if (matOrderA !== matOrderB) {
          return matOrderA - matOrderB;
        }
      }

      // それ以外は商品名の五十音順
      return nameA.localeCompare(nameB, 'ja');
    });

    // ソート後のデータを書き込み
    dataRange.setValues(data);

    // K列（在庫数）の数式を再設定（ソートで数式が消えるため）
    const inventoryColIndex = 11; // K列 = 在庫数
    for (let i = 0; i < data.length; i++) {
      const rowNum = i + 2; // ヘッダーを除く実際の行番号
      sheet.getRange(rowNum, inventoryColIndex).setFormula(`=I${rowNum}-J${rowNum}`);
    }

    Logger.log(`梱包資材をカテゴリ順にソート: ${lastRow - 1}件（数式を再設定）`);

    return {
      success: true,
      message: `${lastRow - 1}件の梱包資材をカテゴリ順に並び替えました`
    };

  } catch (error) {
    console.error('梱包資材ソートエラー:', error);
    return {
      success: false,
      message: `ソートエラー: ${error.message}`
    };
  }
}

// =============================================================================
// 担当者名管理（PropertiesService）
// =============================================================================

/**
 * 担当者名を保存
 * @param {string} name - 担当者名
 * @returns {Object} { success: boolean, message: string }
 */
function setOperatorNameAPI(name) {
  try {
    if (!name || name.trim() === '') {
      return {
        success: false,
        message: '担当者名を入力してください'
      };
    }

    const userProperties = PropertiesService.getUserProperties();
    userProperties.setProperty('OPERATOR_NAME', name.trim());

    return {
      success: true,
      message: '担当者名を保存しました'
    };
  } catch (error) {
    console.error('担当者名保存エラー:', error);
    return {
      success: false,
      message: `保存エラー: ${error.message}`
    };
  }
}

/**
 * 担当者名を取得
 * @returns {Object} { success: boolean, name: string }
 */
function getOperatorNameAPI() {
  try {
    const userProperties = PropertiesService.getUserProperties();
    const name = userProperties.getProperty('OPERATOR_NAME');

    return {
      success: true,
      name: name || ''
    };
  } catch (error) {
    console.error('担当者名取得エラー:', error);
    return {
      success: false,
      name: ''
    };
  }
}

/**
 * FCMトークンから担当者名を取得
 * @param {string} fcmToken - FCMトークン
 * @return {Object} 取得結果
 */
function getOperatorNameByTokenAPI(fcmToken) {
  try {
    console.log('=== getOperatorNameByTokenAPI 開始 ===');
    console.log('FCMトークン:', fcmToken ? fcmToken.substring(0, 20) + '...' : 'なし');

    if (!fcmToken) {
      console.log('FCMトークンが指定されていません → Googleアカウントのメールアドレスで検索します');

      // Googleアカウントのメールアドレスを取得
      const userEmail = Session.getActiveUser().getEmail();
      console.log('Googleアカウント:', userEmail);

      if (!userEmail) {
        console.error('Googleアカウントのメールアドレスが取得できません');
        return {
          success: false,
          name: '',
          source: 'no_email'
        };
      }

      // FCM通知登録シートでメールアドレスを検索
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = ss.getSheetByName('FCM通知登録');

      if (!sheet) {
        console.error('FCM通知登録シートが見つかりません');
        return {
          success: false,
          name: '',
          source: 'no_sheet'
        };
      }

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) {
        console.log('FCM通知登録シートにデータがありません');
        return {
          success: false,
          name: '',
          source: 'no_data'
        };
      }

      const dataRange = sheet.getRange(2, 1, lastRow - 1, 11);
      const data = dataRange.getValues();

      // メールアドレスで検索（列8）
      for (let i = 0; i < data.length; i++) {
        const rowEmail = data[i][7]; // 列8: メールアドレス
        if (rowEmail === userEmail) {
          const userName = data[i][1]; // 列2: ユーザー名
          const iconUrl = data[i][8] || ''; // 列9: アイコンURL
          console.log('✅ メールアドレスに一致するユーザー名を発見:', userName);
          return {
            success: true,
            name: userName || '',
            iconUrl: iconUrl,
            source: 'fcm_sheet_by_email'
          };
        }
      }

      console.log('⚠️ メールアドレスに一致するデータが見つかりませんでした');
      return {
        success: false,
        name: '',
        source: 'not_found_by_email'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('FCM通知登録');

    if (!sheet) {
      console.error('FCM通知登録シートが見つかりません');
      return {
        success: false,
        name: '',
        source: 'no_sheet'
      };
    }

    // データ範囲を取得（ヘッダー行を除く）
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      console.log('FCM通知登録シートにデータがありません');
      return {
        success: true,
        name: '',
        source: 'none'
      };
    }

    const dataRange = sheet.getRange(2, 1, lastRow - 1, 11); // 列1〜11（アイコンURL含む）
    const data = dataRange.getValues();

    console.log('FCM通知登録シートのデータ件数:', data.length);

    // FCMトークンで検索（列4）
    for (let i = 0; i < data.length; i++) {
      const rowToken = data[i][3]; // 列4: FCMトークン
      if (rowToken === fcmToken) {
        const userName = data[i][1]; // 列2: ユーザー名
        const iconUrl = data[i][8] || ''; // 列9: アイコンURL
        console.log('✅ FCMトークンに一致するユーザー名を発見:', userName);
        return {
          success: true,
          name: userName || '',
          iconUrl: iconUrl,
          source: 'fcm_sheet'
        };
      }
    }

    console.log('⚠️ FCMトークンに一致するデータが見つかりませんでした');
    return {
      success: false,
      name: '',
      source: 'not_found_by_token'
    };

  } catch (error) {
    console.error('❌ FCMトークンから担当者名取得エラー:', error);
    return {
      success: false,
      name: '',
      error: error.message
    };
  }
}

// =============================================================================
// 梱包資材プリセット管理
// =============================================================================

/**
 * 梱包資材プリセットシートを作成（初回のみ実行）
 * @returns {Object} { success: boolean, message: string }
 */
function setupPackagingPresetsSheet() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('梱包資材プリセット');

    if (sheet) {
      return {
        success: true,
        message: 'シート「梱包資材プリセット」は既に存在します'
      };
    }

    // 新規シートを作成
    sheet = ss.insertSheet('梱包資材プリセット');

    // ヘッダー行を設定
    const headers = ['プリセットID', 'プリセット名', '資材リスト（JSON）'];
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    // ヘッダー行のフォーマット
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#3B82F6')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');

    // 列幅を調整
    sheet.setColumnWidth(1, 120); // プリセットID
    sheet.setColumnWidth(2, 200); // プリセット名
    sheet.setColumnWidth(3, 400); // 資材リスト

    // シートを保護（ヘッダー行のみ）
    const protection = sheet.protect();
    protection.setDescription('梱包資材プリセットシート（ヘッダー行保護）');
    const unprotectedRange = sheet.getRange(2, 1, sheet.getMaxRows() - 1, headers.length);
    protection.setUnprotectedRanges([unprotectedRange]);

    Logger.log('梱包資材プリセットシートを作成しました');

    return {
      success: true,
      message: '✅ シート「梱包資材プリセット」を作成しました'
    };

  } catch (error) {
    console.error('プリセットシート作成エラー:', error);
    return {
      success: false,
      message: `シート作成エラー: ${error.message}`
    };
  }
}

/**
 * 梱包資材プリセット一覧を取得
 * @returns {Object} { success: boolean, data: Array, message: string }
 */
function getPackagingPresetsAPI() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('梱包資材プリセット');

    // シートがなければ作成
    if (!sheet) {
      const setupResult = setupPackagingPresetsSheet();
      if (!setupResult.success) {
        return {
          success: false,
          message: setupResult.message,
          data: []
        };
      }
      sheet = ss.getSheetByName('梱包資材プリセット');
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return {
        success: true,
        data: [],
        message: 'プリセットがありません'
      };
    }

    // ヘッダー行を除く全データを取得
    const values = sheet.getRange(2, 1, lastRow - 1, 3).getValues();

    const data = values.map((row, index) => {
      let materialsList = [];
      try {
        if (row[2]) {
          materialsList = JSON.parse(row[2]);
        }
      } catch (e) {
        console.error(`プリセットID ${row[0]} の資材リストJSON解析エラー:`, e);
      }

      return {
        rowIndex: index + 2,
        presetId: row[0] || '',
        presetName: row[1] || '',
        materialsList: materialsList // [{ productName: "OPP袋S" }, ...]
      };
    }).filter(item => item.presetName); // プリセット名が空の行を除外

    return {
      success: true,
      data: data,
      message: `${data.length}件のプリセットを取得しました`
    };

  } catch (error) {
    console.error('プリセット一覧取得エラー:', error);
    return {
      success: false,
      message: `プリセット取得エラー: ${error.message}`,
      data: []
    };
  }
}

/**
 * 梱包資材プリセットを保存（新規・更新）
 * @param {Object} params - { presetId, presetName, materialsList }
 * @returns {Object} { success: boolean, message: string }
 */
function savePackagingPresetAPI(params) {
  try {
    Logger.log('[DEBUG] savePackagingPresetAPI called with params: ' + JSON.stringify(params));
    
    // バリデーション
    if (!params.presetName || params.presetName.trim() === '') {
      Logger.log('[DEBUG] Validation failed: presetName is empty');
      return {
        success: false,
        message: 'プリセット名は必須です'
      };
    }

    if (!Array.isArray(params.materialsList) || params.materialsList.length === 0) {
      Logger.log('[DEBUG] Validation failed: materialsList is empty or not array');
      return {
        success: false,
        message: '梱包資材を1つ以上選択してください'
      };
    }

    Logger.log('[DEBUG] Validation passed, getting spreadsheet...');
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('梱包資材プリセット');
    Logger.log('[DEBUG] Sheet found: ' + (sheet ? 'yes' : 'no'));

    // シートがなければ作成
    if (!sheet) {
      Logger.log('[DEBUG] Sheet not found, creating...');
      const setupResult = setupPackagingPresetsSheet();
      if (!setupResult.success) {
        Logger.log('[DEBUG] Sheet creation failed: ' + setupResult.message);
        return setupResult;
      }
      sheet = ss.getSheetByName('梱包資材プリセット');
      Logger.log('[DEBUG] Sheet created successfully');
    }

    const presetName = params.presetName.trim();
    const materialsJson = JSON.stringify(params.materialsList);
    Logger.log('[DEBUG] presetName: ' + presetName);
    Logger.log('[DEBUG] materialsJson: ' + materialsJson);

    // 新規作成 or 更新判定
    if (params.presetId) {
      Logger.log('[DEBUG] Update mode, presetId: ' + params.presetId);
      // 更新: 既存のpresetIdを検索
      const lastRow = sheet.getLastRow();
      Logger.log('[DEBUG] lastRow: ' + lastRow);
      if (lastRow >= 2) {
        const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (let i = 0; i < ids.length; i++) {
          if (ids[i][0] === params.presetId) {
            const rowIndex = i + 2;
            // 同じプリセット名が他に存在しないかチェック（自分自身を除く）
            const names = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
            for (let j = 0; j < names.length; j++) {
              if (j !== i && names[j][0] === presetName) {
                return {
                  success: false,
                  message: `同じプリセット名が既に登録されています（${presetName}）`
                };
              }
            }

            // 更新
            Logger.log('[DEBUG] Updating row ' + rowIndex);
            sheet.getRange(rowIndex, 2, 1, 2).setValues([[presetName, materialsJson]]);
            Logger.log(`[DEBUG] Update successful: ${params.presetId} - ${presetName}`);

            return {
              success: true,
              message: 'プリセットを更新しました'
            };
          }
        }
      }

      // presetIdが指定されているのに見つからない場合はエラー
      return {
        success: false,
        message: '指定されたプリセットIDが見つかりません'
      };

    } else {
      // 新規作成
      Logger.log('[DEBUG] Create mode (no presetId)');

      // 重複チェック
      Logger.log('[DEBUG] Checking for duplicates...');
      const existingPresets = getPackagingPresetsAPI();
      if (existingPresets.success) {
        const duplicate = existingPresets.data.find(preset =>
          preset.presetName === presetName
        );

        if (duplicate) {
          Logger.log('[DEBUG] Duplicate found: ' + presetName);
          return {
            success: false,
            message: `同じプリセット名が既に登録されています（${presetName}）`
          };
        }
      }

      Logger.log('[DEBUG] No duplicates, proceeding with creation...');
      // 新しいIDを生成（PRESET001, PRESET002, ...）
      const lastRow = sheet.getLastRow();
      const nextNumber = lastRow >= 2 ? lastRow - 1 + 1 : 1;
      const newPresetId = 'PRESET' + String(nextNumber).padStart(3, '0');
      Logger.log('[DEBUG] Generated presetId: ' + newPresetId + ', lastRow: ' + lastRow);

      // 新規行を追加
      const newRow = [newPresetId, presetName, materialsJson];
      Logger.log('[DEBUG] Inserting row at position: ' + (lastRow + 1));
      Logger.log('[DEBUG] Row data: ' + JSON.stringify(newRow));
      sheet.getRange(lastRow + 1, 1, 1, 3).setValues([newRow]);
      Logger.log('[DEBUG] Row inserted successfully');

      // 罫線適用
      Logger.log('[DEBUG] Applying borders...');
      const dataRange = sheet.getRange(1, 1, lastRow + 1, 3);
      dataRange.setBorder(true, true, true, true, true, true);

      Logger.log(`[DEBUG] Preset created successfully: ${newPresetId} - ${presetName}`);

      return {
        success: true,
        message: 'プリセットを作成しました'
      };
    }

  } catch (error) {
    Logger.log('[DEBUG] Error in savePackagingPresetAPI: ' + error.message);
    Logger.log('[DEBUG] Error stack: ' + error.stack);
    console.error('プリセット保存エラー:', error);
    return {
      success: false,
      message: `保存エラー: ${error.message}`
    };
  }
}

/**
 * 梱包資材プリセットを削除
 * @param {string} presetId - 削除するプリセットID
 * @returns {Object} { success: boolean, message: string }
 */
function deletePackagingPresetAPI(presetId) {
  try {
    if (!presetId) {
      return {
        success: false,
        message: 'プリセットIDが指定されていません'
      };
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('梱包資材プリセット');

    if (!sheet) {
      return {
        success: false,
        message: 'シート「梱包資材プリセット」が見つかりません'
      };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return {
        success: false,
        message: '削除するプリセットがありません'
      };
    }

    // プリセットIDで行を検索
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (ids[i][0] === presetId) {
        const rowIndex = i + 2;
        const deletedName = sheet.getRange(rowIndex, 2).getValue();

        // 行を削除
        sheet.deleteRow(rowIndex);

        Logger.log(`プリセット削除: ${presetId} - ${deletedName}`);

        return {
          success: true,
          message: 'プリセットを削除しました'
        };
      }
    }

    return {
      success: false,
      message: '指定されたプリセットIDが見つかりません'
    };

  } catch (error) {
    console.error('プリセット削除エラー:', error);
    return {
      success: false,
      message: `削除エラー: ${error.message}`
    };
  }
}

// =============================================================================
// INV-006 Phase 4: 備品在庫リストに担当者カラム追加
// =============================================================================

/**
 * 備品在庫リストに担当者カラム（M列）を追加するマイグレーション
 * @return {Object} マイグレーション結果
 */
function migrateAddManagerColumnToInventory() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('備品在庫リスト');

    if (!sheet) {
      Logger.log('ERROR: 備品在庫リストシートが見つかりません');
      return {
        success: false,
        message: '備品在庫リストシートが見つかりません'
      };
    }

    // 現在のヘッダー行を取得
    const lastColumn = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];

    Logger.log('現在のカラム数: ' + lastColumn);
    Logger.log('現在のヘッダー: ' + headers.join(', '));

    // 担当者カラム（M列 = 13列目）の確認
    if (lastColumn >= 13 && headers[12] === '担当者') {
      Logger.log('担当者カラムは既に存在します');
      return {
        success: true,
        message: '担当者カラムは既に存在します',
        alreadyExists: true
      };
    }

    // 担当者カラムを追加（M列 = 13列目）
    Logger.log('担当者カラムを追加します（M列）');
    sheet.getRange(1, 13).setValue('担当者');

    // データ検証を追加（登録ユーザー一覧をドロップダウンに設定）
    const userList = getUserList();
    if (userList && userList.length > 0) {
      const userNames = userList.map(user => user.userName).filter(name => name && name.trim() !== '');

      if (userNames.length > 0) {
        // M2セル以降にデータ検証を設定
        const dataRange = sheet.getRange(2, 13, sheet.getMaxRows() - 1, 1);
        const rule = SpreadsheetApp.newDataValidation()
          .requireValueInList(userNames, true)
          .setAllowInvalid(true) // 空白も許可
          .build();
        dataRange.setDataValidation(rule);
        Logger.log(`担当者カラムにドロップダウンを設定しました（${userNames.length}人）: ${userNames.join(', ')}`);
      }
    }

    Logger.log('担当者カラムの追加完了');

    return {
      success: true,
      message: '担当者カラム（M列）を追加しました',
      columnAdded: true
    };
  } catch (error) {
    Logger.log('migrateAddManagerColumnToInventory error: ' + error);
    return {
      success: false,
      message: error.toString()
    };
  }
}

/**
 * 担当者カラム追加済みかどうかをチェック
 * @return {Boolean} 追加済みならtrue
 */
function checkManagerColumnExists() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('備品在庫リスト');

    if (!sheet) {
      return false;
    }

    const lastColumn = sheet.getLastColumn();
    if (lastColumn < 13) {
      return false;
    }

    const header = sheet.getRange(1, 13).getValue();
    return header === '担当者';
  } catch (error) {
    Logger.log('checkManagerColumnExists error: ' + error);
    return false;
  }
}
