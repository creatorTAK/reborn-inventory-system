/**
 * 設定マスタシートからデータを読み込む関数群
 */

// 設定データのキャッシュ（5分間有効）
let CONFIG_CACHE = null;
let CONFIG_CACHE_TIMESTAMP = null;
const CONFIG_CACHE_DURATION = 5 * 60 * 1000; // 5分

/**
 * 設定マスタシート全体を読み込む
 */
function loadConfigMaster() {
  // キャッシュチェック
  const now = new Date().getTime();
  if (CONFIG_CACHE && CONFIG_CACHE_TIMESTAMP && (now - CONFIG_CACHE_TIMESTAMP < CONFIG_CACHE_DURATION)) {
    console.log('設定マスタ: キャッシュから取得');
    return CONFIG_CACHE;
  }

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('設定マスタ');

    if (!sheet) {
      console.error('設定マスタシートが見つかりません');
      return null;
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      console.log('設定マスタにデータがありません');
      return null;
    }

    // 全データを取得（ヘッダー除く）
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

    // カテゴリ別に整理
    const config = {
      商品状態ボタン: [],
      ハッシュタグ: {},
      割引情報: {},
      配送デフォルト: {},
      仕入出品デフォルト: {},
      管理番号設定: {},
      よく使うセールスワード: {}
    };

    data.forEach(row => {
      const [category, item1, item2, item3, value] = row;

      if (!category || !value) return; // 空行スキップ

      switch (category) {
        case '商品状態ボタン':
          config.商品状態ボタン.push({
            商品の状態: item1,
            ボタンラベル: item2,
            ボタンテキスト: value
          });
          break;

        case 'ハッシュタグ':
          // 新形式: JSON文字列をパース
          if (item1 === 'config') {
            try {
              config.ハッシュタグ = JSON.parse(value);
            } catch (e) {
              console.error('ハッシュタグ設定のJSON解析エラー:', e);
              config.ハッシュタグ = { commonPrefix: '#', hashtags: [] };
            }
          } else {
            // 旧形式との互換性
            if (!config.ハッシュタグ.commonPrefix) {
              config.ハッシュタグ = {};
            }
            config.ハッシュタグ[item1] = value;
          }
          break;

        case '割引情報':
          if (item2 === '説明文') {
            // 説明文の場合
            config.割引情報[`${item1}_説明文`] = value;
          } else {
            // 範囲と割引額の場合
            if (!config.割引情報[item1]) {
              config.割引情報[item1] = [];
            }
            config.割引情報[item1].push({
              範囲: item2,
              割引額: value
            });
          }
          break;

        case '配送デフォルト':
          config.配送デフォルト[item1] = value;
          break;

        case '仕入出品デフォルト':
          config.仕入出品デフォルト[item1] = value;
          break;

        case '管理番号設定':
          // segmentsはJSON文字列なのでパース
          if (item1 === 'segments') {
            try {
              config.管理番号設定.segments = JSON.parse(value);
            } catch (e) {
              console.error('segmentsのJSON解析エラー:', e);
              config.管理番号設定.segments = [];
            }
          } else {
            config.管理番号設定[item1] = value;
          }
          break;

        case '管理番号ビルダー':
          // JSON形式のセグメントデータを解析
          try {
            config.管理番号設定 = JSON.parse(value);
          } catch (e) {
            console.error('管理番号ビルダーデータ解析エラー:', e);
          }
          break;

        case 'よく使うセールスワード':
          // JSON文字列をパース
          if (item1 === 'config') {
            try {
              config.よく使うセールスワード = JSON.parse(value);
              console.log('セールスワード設定を読み込みました:', config.よく使うセールスワード);
            } catch (e) {
              console.error('セールスワード設定のJSON解析エラー:', e);
              config.よく使うセールスワード = { よく使う: [], 表示形式: { globalPrefix: '【', globalSuffix: '】', wordOverrides: [] } };
            }
          }
          break;

        case '商品名ブロック並び順':
          // JSON文字列をパース
          try {
            config.商品名ブロック並び順 = JSON.parse(value);
            console.log('商品名ブロック並び順を読み込みました:', config.商品名ブロック並び順);
          } catch (e) {
            console.error('商品名ブロック並び順のJSON解析エラー:', e);
            config.商品名ブロック並び順 = ['salesword', 'brand', 'item', 'attribute'];
          }
          break;
      }
    });

    // キャッシュに保存
    CONFIG_CACHE = config;
    CONFIG_CACHE_TIMESTAMP = now;

    console.log('設定マスタ読み込み完了');
    return config;

  } catch (error) {
    console.error('設定マスタ読み込みエラー:', error);
    return null;
  }
}

/**
 * 商品状態ボタン設定を取得
 * @returns {Object} 商品の状態ごとのボタン定義
 */
function getConditionButtons() {
  const config = loadConfigMaster();
  if (!config || !config.商品状態ボタン) {
    console.log('商品状態ボタン設定が見つかりません。デフォルト値を使用します。');
    return getDefaultConditionButtons();
  }

  // 商品の状態別にグループ化
  const buttons = {};
  config.商品状態ボタン.forEach(item => {
    const condition = item.商品の状態;
    if (!buttons[condition]) {
      buttons[condition] = [];
    }
    buttons[condition].push({
      label: item.ボタンラベル,
      text: item.ボタンテキスト
    });
  });

  return buttons;
}

/**
 * ハッシュタグ設定を取得
 * @returns {Object} ハッシュタグ設定
 */
function getHashtagConfig() {
  const config = loadConfigMaster();
  if (!config || !config.ハッシュタグ) {
    console.log('ハッシュタグ設定が見つかりません。デフォルト値を使用します。');
    return {
      全商品プレフィックス: '#REBORN_',
      全商品テキスト: '全商品',
      ブランドプレフィックス: '#REBORN_',
      ブランドサフィックス: 'アイテム一覧',
      カテゴリプレフィックス: '#REBORN_',
      カテゴリサフィックス: '一覧'
    };
  }

  return config.ハッシュタグ;
}

/**
 * 割引情報設定を取得
 * @returns {Object} 割引情報設定
 */
function getDiscountConfig() {
  const config = loadConfigMaster();
  if (!config || !config.割引情報) {
    console.log('割引情報設定が見つかりません。デフォルト値を使用します。');
    return getDefaultDiscountConfig();
  }

  return config.割引情報;
}

/**
 * 配送デフォルト設定を取得
 * @returns {Object} 配送デフォルト設定
 */
function getShippingDefaults() {
  const config = loadConfigMaster();
  if (!config || !config.配送デフォルト) {
    console.log('配送デフォルト設定が見つかりません。デフォルト値を使用します。');
    return {
      '配送料の負担': '送料込み(出品者負担)',
      '配送の方法': 'ゆうゆうメルカリ便',
      '発送元の地域': '岡山県',
      '発送までの日数': '1~2日で発送'
    };
  }

  return config.配送デフォルト;
}

/**
 * 仕入・出品デフォルト設定を取得
 * @returns {Object} 仕入・出品デフォルト設定
 */
function getProcureListingDefaults() {
  const config = loadConfigMaster();
  if (!config || !config.仕入出品デフォルト) {
    console.log('仕入・出品デフォルト設定が見つかりません。デフォルト値を使用します。');
    return {
      '仕入日_今日': false,
      'デフォルト仕入日': '',
      'デフォルト仕入先': '',
      '出品日_今日': false,
      'デフォルト出品日': '',
      'デフォルト出品先': ''
    };
  }

  return config.仕入出品デフォルト;
}

/**
 * 管理番号設定を取得
 * @returns {Object} 管理番号設定
 */
function getManagementNumberConfig() {
  const config = loadConfigMaster();
  if (!config || !config.管理番号設定) {
    console.log('管理番号設定が見つかりません。デフォルト値を使用します。');
    return {
      segments: []  // 空の配列（ユーザーが自分で設定）
    };
  }

  return config.管理番号設定;
}

/**
 * 商品名ブロックの並び順を取得
 * @returns {Array} 並び順の配列
 */
function getTitleBlockOrder() {
  const config = loadConfigMaster();
  if (!config || !config.商品名ブロック並び順) {
    console.log('商品名ブロック並び順が見つかりません。デフォルト値を使用します。');
    return ['salesword', 'brand', 'item', 'attribute'];  // デフォルト順序
  }

  return config.商品名ブロック並び順;
}

/**
 * 商品名ブロックの並び順を保存
 * @param {Array} order - 並び順の配列（例: ['brand', 'salesword', 'attribute']）
 */
function saveTitleBlockOrder(order) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('設定マスタ');

    if (!sheet) {
      throw new Error('設定マスタシートが見つかりません');
    }

    // 既存の商品名ブロック並び順設定を削除
    const data = sheet.getDataRange().getValues();
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][0] === '商品名ブロック並び順') {
        sheet.deleteRow(i + 1);
      }
    }

    // 新しい並び順を保存（JSON形式）
    sheet.appendRow(['商品名ブロック並び順', 'order', '', '', JSON.stringify(order)]);

    // キャッシュをクリア
    clearConfigCache();

    console.log('商品名ブロックの並び順を保存しました:', order);
    return 'OK';
  } catch (error) {
    console.error('商品名ブロック並び順の保存エラー:', error);
    throw error;
  }
}

/**
 * 管理番号ビルダーのセグメント設定を保存
 * @param {Object} segmentsData - セグメントデータ
 */
function saveManagementNumberSegments(segmentsData) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('設定マスタ');

    if (!sheet) {
      throw new Error('設定マスタシートが見つかりません');
    }

    // 既存の管理番号設定を削除
    const lastRow = sheet.getLastRow();
    const data = sheet.getRange(2, 1, lastRow - 1, 5).getValues();

    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][0] === '管理番号ビルダー') {
        sheet.deleteRow(i + 2);
      }
    }

    // 新しい設定を追加
    const newRows = [];
    newRows.push(['管理番号ビルダー', 'segments', '', '', JSON.stringify(segmentsData)]);

    if (newRows.length > 0) {
      const newLastRow = sheet.getLastRow();
      sheet.getRange(newLastRow + 1, 1, newRows.length, 5).setValues(newRows);
    }

    // キャッシュをクリア
    clearConfigCache();

    return { success: true, message: '管理番号設定を保存しました' };
  } catch (error) {
    console.error('管理番号設定保存エラー:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * デフォルトの商品状態ボタン定義（フォールバック用）
 */
function getDefaultConditionButtons() {
  return {
    '新品、未使用': [
      { label: 'タグ付き未使用', text: 'タグ付き未使用品です。' },
      { label: '試着のみ', text: '試着のみで着用していません。' },
      { label: '保管時の折り目', text: '保管時の軽い折り目がありますが、未使用品です。' }
    ],
    '未使用に近い': [
      { label: '数回のみ着用', text: '数回のみ着用で、目立った傷や汚れはありません。' },
      { label: '使用感なし', text: 'ほとんど使用しておらず、使用感はありません。' },
      { label: '新品同様', text: '新品同様の状態です。' }
    ],
    '目立った傷や汚れなし': [
      { label: '目立った傷なし', text: '目立った傷や汚れなし。' },
      { label: '使用感あり', text: '若干の使用感がありますが、着用に問題ありません。' },
      { label: '全体的に良好', text: '全体的に状態は良好です。' }
    ],
    'やや傷や汚れあり': [
      { label: '襟元シミ', text: '襟元に薄いシミがあります。' },
      { label: '袖口毛玉', text: '袖口に毛玉があります。' },
      { label: '裾ほつれ', text: '裾にほつれがあります。' },
      { label: 'ボタン傷', text: 'ボタンに傷があります。' },
      { label: '色褪せ', text: '色褪せがあります。' }
    ],
    '傷や汚れあり': [
      { label: '目立つ汚れ', text: '目立つ汚れがあります。' },
      { label: '目立つ傷', text: '目立つ傷があります。' },
      { label: '複数箇所に傷', text: '複数箇所に傷や汚れがあります。' },
      { label: '色褪せ目立つ', text: '色褪せが目立ちます。' }
    ],
    '全体的に状態が悪い': [
      { label: '大きな傷', text: '大きな傷があります。' },
      { label: '大きな汚れ', text: '大きな汚れがあります。' },
      { label: 'ダメージ多数', text: 'ダメージが多数あります。' }
    ]
  };
}

/**
 * デフォルトの割引情報（フォールバック用）
 */
function getDefaultDiscountConfig() {
  return {
    'フォロー割': [
      { 範囲: '〜2,999円', 割引額: '100円引' },
      { 範囲: '〜5,999円', 割引額: '200円引' },
      { 範囲: '〜8,999円', 割引額: '300円引' },
      { 範囲: '9,000円〜', 割引額: '500円引' }
    ],
    'リピート割': [
      { 範囲: '', 割引額: '200円引' }
    ],
    'まとめ割': [
      { 範囲: '2点', 割引額: '300円' },
      { 範囲: '3点', 割引額: '500円' },
      { 範囲: '4点', 割引額: '1,000円' }
    ]
  };
}

/**
 * 設定マスタのキャッシュをクリア
 */
function clearConfigCache() {
  CONFIG_CACHE = null;
  CONFIG_CACHE_TIMESTAMP = null;
  console.log('設定マスタキャッシュをクリアしました');
}

/**
 * 設定マスタシートに設定を保存
 * @param {Object} newConfig - 保存する設定データ
 * @returns {Object} 結果オブジェクト {success: boolean, error?: string}
 */
function saveConfigMaster(newConfig) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('設定マスタ');

    // シートが存在しない場合は作成
    if (!sheet) {
      sheet = ss.insertSheet('設定マスタ');
      // ヘッダー行を作成
      sheet.getRange(1, 1, 1, 5).setValues([['カテゴリ', '項目1', '項目2', '項目3', '値']]);
      sheet.getRange(1, 1, 1, 5)
        .setFontWeight('bold')
        .setBackground('#4285f4')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }

    // 既存データをクリア（ヘッダー除く）
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(2, 1, lastRow - 1, 5).clearContent();
    }

    // 新しいデータを準備
    const rows = [];

    // 商品状態ボタン
    if (newConfig.商品状態ボタン && Array.isArray(newConfig.商品状態ボタン)) {
      newConfig.商品状態ボタン.forEach(item => {
        rows.push(['商品状態ボタン', item.商品の状態, item.ボタンラベル, '', item.ボタンテキスト]);
      });
    }

    // ハッシュタグ
    if (newConfig.ハッシュタグ && typeof newConfig.ハッシュタグ === 'object') {
      // 新形式: commonPrefix + hashtags配列
      if (newConfig.ハッシュタグ.hashtags && Array.isArray(newConfig.ハッシュタグ.hashtags)) {
        // JSON文字列として1行に保存
        rows.push(['ハッシュタグ', 'config', '', '', JSON.stringify(newConfig.ハッシュタグ)]);
      } else {
        // 旧形式との互換性
        Object.entries(newConfig.ハッシュタグ).forEach(([key, value]) => {
          rows.push(['ハッシュタグ', key, '', '', value]);
        });
      }
    }

    // 割引情報
    if (newConfig.割引情報 && typeof newConfig.割引情報 === 'object') {
      Object.entries(newConfig.割引情報).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          // 範囲と割引額の配列
          value.forEach(range => {
            rows.push(['割引情報', key, range.範囲, '', range.割引額]);
          });
        } else if (key.endsWith('_説明文')) {
          // 説明文
          const discountType = key.replace('_説明文', '');
          rows.push(['割引情報', discountType, '説明文', '', value]);
        }
      });
    }

    // 配送デフォルト
    if (newConfig.配送デフォルト && typeof newConfig.配送デフォルト === 'object') {
      Object.entries(newConfig.配送デフォルト).forEach(([key, value]) => {
        rows.push(['配送デフォルト', key, '', '', value]);
      });
    }

    // 仕入出品デフォルト
    if (newConfig.仕入出品デフォルト && typeof newConfig.仕入出品デフォルト === 'object') {
      Object.entries(newConfig.仕入出品デフォルト).forEach(([key, value]) => {
        rows.push(['仕入出品デフォルト', key, '', '', value]);
      });
    }

    // 管理番号設定（セグメント方式）
    if (newConfig.管理番号設定 && typeof newConfig.管理番号設定 === 'object') {
      if (newConfig.管理番号設定.segments && Array.isArray(newConfig.管理番号設定.segments)) {
        // 新方式: セグメント配列をJSON文字列として保存
        rows.push(['管理番号設定', 'segments', '', '', JSON.stringify(newConfig.管理番号設定.segments)]);
      } else {
        // 旧方式との互換性維持
        Object.entries(newConfig.管理番号設定).forEach(([key, value]) => {
          if (key !== 'segments') {
            rows.push(['管理番号設定', key, '', '', value]);
          }
        });
      }
    }

    // よく使うセールスワード
    if (newConfig.よく使うセールスワード && typeof newConfig.よく使うセールスワード === 'object') {
      // JSON文字列として保存
      rows.push(['よく使うセールスワード', 'config', '', '', JSON.stringify(newConfig.よく使うセールスワード)]);
      console.log('セールスワード設定を保存:', newConfig.よく使うセールスワード);
    }

    // データを書き込み
    if (rows.length > 0) {
      sheet.getRange(2, 1, rows.length, 5).setValues(rows);
    }

    // キャッシュをクリア
    clearConfigCache();

    console.log('設定マスタを保存しました:', rows.length, '行');
    return { success: true };

  } catch (error) {
    console.error('設定マスタ保存エラー:', error);
    return { success: false, error: error.message };
  }
}
