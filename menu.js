function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * POSTリクエストのエントリーポイント
 * Push通知関連のAPIエンドポイント
 */
function doPost(e) {
  try {
    // リクエストボディを解析
    const requestBody = e.postData ? JSON.parse(e.postData.contents) : {};
    const action = requestBody.action;

    if (!action) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'アクションが指定されていません'
      }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'subscribeFCM') {
      // FCMトークンを保存（チーム利用対応: デバイス情報も保存）
      const token = requestBody.token;
      const deviceInfo = requestBody.deviceInfo || null;
      const result = saveFCMToken(token, deviceInfo);
      return ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === 'sendFCM') {
      // FCM通知を送信（POSTメソッド）
      try {
        // デバッグログをスプレッドシートに書き込む
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        let debugSheet = ss.getSheetByName('デバッグログ');
        if (!debugSheet) {
          debugSheet = ss.insertSheet('デバッグログ');
          debugSheet.appendRow(['タイムスタンプ', 'メソッド', 'アクション', '受信データ', 'title', 'body', '送信結果']);
        }

        const timestamp = new Date().toLocaleString('ja-JP');
        const rawData = JSON.stringify(requestBody);

        // POSTデータから直接取得（エンコード/デコード不要）
        const title = requestBody.title || 'REBORN';
        const body = requestBody.body || 'テスト通知です';

        const result = sendFCMNotification(title, body);

        // デバッグ情報をスプレッドシートに記録
        debugSheet.appendRow([
          timestamp,
          'POST',
          'sendFCM',
          rawData,
          title,
          body,
          JSON.stringify(result)
        ]);

        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({
          status: 'error',
          message: 'エラー: ' + error.toString()
        }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: '不明なアクション: ' + action
    }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log('doPost error: ' + error);
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Web Appのエントリーポイント
 * URLパラメータ ?menu=product または ?menu=config でメニューを指定可能
 */
function doGet(e) {
  try {
    // JSON APIエンドポイント（GitHub Pages用）
    if (e && e.parameter && e.parameter.action) {
      const action = e.parameter.action;

      if (action === 'test') {
        // テストAPI
        const response = {
          status: 'success',
          message: 'GAS API接続成功！GitHub Pages + GAS hybrid構成が正しく動作しています。',
          timestamp: new Date().toISOString(),
          data: {
            project: 'REBORN',
            version: '1.0.0',
            architecture: 'GitHub Pages (Frontend) + GAS (Backend API)'
          }
        };

        return ContentService.createTextOutput(JSON.stringify(response))
          .setMimeType(ContentService.MimeType.JSON);
      }

      if (action === 'subscribeFCM') {
        // FCMトークンを保存（GETメソッド、チーム利用対応）
        const token = e.parameter.token;
        const deviceInfoParam = e.parameter.deviceInfo;
        const userIdParam = e.parameter.userId;

        // デバッグログをスプレッドシートに書き込む
        try {
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          let debugSheet = ss.getSheetByName('FCM登録デバッグ');
          if (!debugSheet) {
            debugSheet = ss.insertSheet('FCM登録デバッグ');
            debugSheet.appendRow(['タイムスタンプ', 'トークン（先頭20文字）', 'deviceInfoParam', 'userIdParam', 'userId (decoded)']);
          }

          const deviceInfo = deviceInfoParam ? JSON.parse(decodeURIComponent(deviceInfoParam)) : null;
          const userId = userIdParam ? decodeURIComponent(userIdParam) : null;

          debugSheet.appendRow([
            Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
            token ? token.substring(0, 20) + '...' : 'null',
            deviceInfoParam ? 'あり（' + deviceInfoParam.substring(0, 30) + '...）' : 'null',
            userIdParam || 'null',
            userId || 'null'
          ]);
        } catch (debugError) {
          Logger.log('Debug sheet error: ' + debugError);
        }

        const deviceInfo = deviceInfoParam ? JSON.parse(decodeURIComponent(deviceInfoParam)) : null;
        const userId = userIdParam ? decodeURIComponent(userIdParam) : null;

        const result = saveFCMToken(token, deviceInfo, userId);
        return ContentService.createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      }

      if (action === 'sendFCM') {
        // FCM通知を送信（GETメソッド + Base64デコード）
        try {
          // デバッグログをスプレッドシートに書き込む
          const ss = SpreadsheetApp.getActiveSpreadsheet();
          let debugSheet = ss.getSheetByName('デバッグログ');
          if (!debugSheet) {
            debugSheet = ss.insertSheet('デバッグログ');
            debugSheet.appendRow(['タイムスタンプ', 'アクション', '受信パラメータ', 'デコード後title', 'デコード後body', '送信結果']);
          }

          const timestamp = new Date().toLocaleString('ja-JP');
          const rawParams = JSON.stringify(e.parameter);

          // URLパラメータからBase64エンコードされた文字列を取得
          const titleEncoded = e.parameter.title || '';
          const bodyEncoded = e.parameter.body || '';

          // デフォルト値
          let title = 'REBORN';
          let body = 'テスト通知です';

          // Base64デコード + URIデコード
          try {
            if (titleEncoded) {
              // Base64デコード → バイト配列 → 文字列 → URIデコード
              const titleBytes = Utilities.base64Decode(titleEncoded);
              const titleDecoded = Utilities.newBlob(titleBytes).getDataAsString();
              title = decodeURIComponent(titleDecoded);
            }
            if (bodyEncoded) {
              const bodyBytes = Utilities.base64Decode(bodyEncoded);
              const bodyDecoded = Utilities.newBlob(bodyBytes).getDataAsString();
              body = decodeURIComponent(bodyDecoded);
            }
          } catch (decodeError) {
            Logger.log('パラメータのデコードに失敗: ' + decodeError);
            // デコード失敗時はデフォルト値を使用
          }

          const result = sendFCMNotification(title, body);

          // デバッグ情報をスプレッドシートに記録
          debugSheet.appendRow([
            timestamp,
            'sendFCM',
            rawParams,
            title,
            body,
            JSON.stringify(result)
          ]);

          return ContentService.createTextOutput(JSON.stringify(result))
            .setMimeType(ContentService.MimeType.JSON);
        } catch (error) {
          return ContentService.createTextOutput(JSON.stringify({
            status: 'error',
            message: 'エラー: ' + error.toString()
          }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }

      if (action === 'getNotificationHistory') {
        // 通知履歴を取得
        const limit = parseInt(e.parameter.limit) || 50;
        const history = getNotificationHistory(limit);

        return ContentService.createTextOutput(JSON.stringify({
          status: 'success',
          history: history
        }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      if (action === 'getInventoryDashboard') {
        const start = new Date();
        const params = {
          statuses: e.parameter.statuses ? e.parameter.statuses.split(',') : [],
          page: parseInt(e.parameter.page) || 1,
          limit: parseInt(e.parameter.limit) || 10,
          sortBy: e.parameter.sortBy || 'registeredAt',
          sortOrder: e.parameter.sortOrder || 'desc',
          searchText: e.parameter.searchText || '',
          brand: e.parameter.brand || '',
          category: e.parameter.category || '',
          size: e.parameter.size || '',
          color: e.parameter.color || ''
        };
        logDebug_Reach(action, e.parameter, start);
        const result = getInventoryDashboardAPI(params);
        // inventory.js関数は既に{success: true/false, data/error: ...}形式を返す
        return toContentService_(result);
      }

      if (action === 'getProductDetail') {
        const start = new Date();
        logDebug_Reach(action, e.parameter, start);
        const result = getProductDetailAPI({ managementNumber: e.parameter.managementNumber });
        return toContentService_(result);
      }

      if (action === 'updateProductStatus') {
        const start = new Date();
        const params = {
          managementNumber: e.parameter.managementNumber,
          newStatus: e.parameter.newStatus
        };
        logDebug_Reach(action, e.parameter, start);
        const result = updateProductStatusAPI(params);
        return toContentService_(result);
      }

      if (action === 'updateProduct') {
        const start = new Date();
        const params = {
          managementNumber: e.parameter.managementNumber,
          field: e.parameter.field,
          value: e.parameter.value,
          editor: e.parameter.editor || 'unknown'
        };
        logDebug_Reach(action, e.parameter, start);
        const result = updateProductAPI(params);
        return toContentService_(result);
      }

      if (action === 'duplicateProduct') {
        const start = new Date();
        logDebug_Reach(action, e.parameter, start);
        const result = duplicateProductAPI({ managementNumber: e.parameter.managementNumber });
        return toContentService_(result);
      }

      if (action === 'ping') {
        // ヘルスチェック用
        return jsonOk_({ serverTime: new Date().toISOString(), message: 'pong' });
      }

      if (action === 'echo') {
        // デバッグ用：全てのパラメータをそのまま返す
        return jsonOk_({
          query: e.parameter,
          timestamp: new Date().toISOString(),
          message: 'echo OK'
        });
      }

      // 不明なアクション
      return jsonError_('不明なアクション: ' + action);
    }

    const menuType = (e && e.parameter && e.parameter.menu) ? e.parameter.menu : 'product';

    // PWAアイコン配信
    if (menuType === 'icon') {
      const iconBase64 = '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';
      const iconBlob = Utilities.newBlob(Utilities.base64Decode(iconBase64), 'image/png');
      return ContentService.createTextOutput()
        .setContent(iconBlob.getBytes())
        .setMimeType(ContentService.MimeType.PNG);
    }

    // PWA manifest.json配信
    if (menuType === 'manifest') {
      const baseUrl = ScriptApp.getService().getUrl();
      const manifest = {
        name: "REBORN.",
        short_name: "REBORN",
        description: "古着物販管理システム - 商品登録から在庫管理まで",
        start_url: baseUrl + "?menu=product",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        orientation: "portrait",
        icons: [
          {
            src: baseUrl + "?menu=icon",
            sizes: "180x180",
            type: "image/png",
            purpose: "any maskable"
          }
        ]
      };

      return ContentService.createTextOutput(JSON.stringify(manifest))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // メインメニュー
    if (menuType === 'test' || menuType === 'main') {
      const baseUrl = ScriptApp.getService().getUrl();
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            /* スクロール固定（モバイル対応） */
            html, body {
              overflow-x: hidden;
              width: 100%;
              position: relative;
              -webkit-overflow-scrolling: touch;
            }
            html {
              touch-action: pan-y;
            }
            * {
              max-width: 100%;
              box-sizing: border-box;
            }

            body {
              font-family: system-ui, sans-serif;
              padding: 20px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              margin: 0;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              border-radius: 16px;
              padding: 32px;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
              max-width: 400px;
              width: 100%;
            }
            h1 {
              color: #1f2937;
              margin: 0 0 8px 0;
              font-size: 28px;
              text-align: center;
            }
            .subtitle {
              color: #6b7280;
              text-align: center;
              font-size: 14px;
              margin-bottom: 32px;
            }
            .menu-section {
              margin-bottom: 24px;
            }
            .menu-title {
              font-size: 12px;
              color: #6b7280;
              font-weight: 600;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 12px;
            }
            .menu-button {
              display: block;
              width: 100%;
              padding: 16px 20px;
              margin-bottom: 12px;
              background: white;
              border: 2px solid #e5e7eb;
              border-radius: 12px;
              text-decoration: none;
              color: #1f2937;
              font-size: 16px;
              font-weight: 500;
              transition: all 0.2s ease;
              text-align: left;
              cursor: pointer;
            }
            .menu-button:hover {
              border-color: #667eea;
              background: #f9fafb;
              transform: translateY(-2px);
              box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);
            }
            .menu-button:active {
              transform: translateY(0);
            }
            .icon {
              font-size: 20px;
              margin-right: 12px;
            }
            .debug-section {
              padding-top: 24px;
              border-top: 1px solid #e5e7eb;
            }
            .debug-button {
              background: #f3f4f6;
              border-color: #d1d5db;
              color: #6b7280;
              font-size: 14px;
              padding: 12px 16px;
            }
            .debug-button:hover {
              border-color: #9ca3af;
              background: #e5e7eb;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔄 REBORN</h1>
            <p class="subtitle">古着物販管理システム</p>

            <div class="menu-section">
              <div class="menu-title">メインメニュー</div>
              <a href="${baseUrl}?menu=product" class="menu-button">
                <span class="icon">📝</span>商品登録
              </a>
              <a href="${baseUrl}?menu=config" class="menu-button">
                <span class="icon">⚙️</span>設定管理
              </a>
              <a href="#" class="menu-button" style="opacity: 0.5; pointer-events: none;">
                <span class="icon">📦</span>在庫管理（準備中）
              </a>
            </div>

            <div class="debug-section">
              <div class="menu-title">開発・デバッグ</div>
              <a href="${baseUrl}?menu=product-simple" class="menu-button debug-button">
                <span class="icon">🧪</span>シンプル商品登録
              </a>
            </div>
          </div>
        </body>
        </html>
      `)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    // デバッグ用：シンプルな商品登録テスト（超ミニマル版）
    if (menuType === 'product-simple') {
      const baseUrl = ScriptApp.getService().getUrl();
      return HtmlService.createHtmlOutput(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            body {
              font-family: system-ui, sans-serif;
              padding: 20px;
              background: #f0f0f0;
            }
            h1 { color: #059669; }
            button {
              padding: 15px 30px;
              font-size: 18px;
              background: #10b981;
              color: white;
              border: none;
              border-radius: 8px;
              margin: 10px 0;
            }
            a {
              display: inline-block;
              margin: 10px 0;
              padding: 10px 16px;
              background: #6b7280;
              color: white;
              text-decoration: none;
              border-radius: 6px;
            }
          </style>
        </head>
        <body>
          <h1>シンプル商品登録（テスト）</h1>
          <p>このページが表示されれば成功です。</p>
          <button onclick="alert('動作しています！')">テストボタン</button>
          <hr>
          <p><a href="${baseUrl}?menu=test">← 戻る</a></p>
        </body>
        </html>
      `)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    let template;
    let title;

    if (menuType === 'config') {
      template = HtmlService.createTemplateFromFile('sidebar_config');
      title = 'REBORN';
    } else if (menuType === 'product') {
      template = HtmlService.createTemplateFromFile('sidebar_product');
      title = 'REBORN';
    } else if (menuType === 'inventory') {
      template = HtmlService.createTemplateFromFile('sidebar_inventory');
      title = 'REBORN - 在庫管理';
    } else {
      // 不明なメニューの場合はデフォルトで商品登録
      template = HtmlService.createTemplateFromFile('sidebar_product');
      title = 'REBORN';
    }

    // Web Appとして開かれていることを示すフラグ（戻るボタン表示用）
    template.showBackButton = true;

    // GAS自身のURL（Web App /exec）をテンプレート変数として渡す（クロスオリジン対策）
    template.GAS_BASE_URL = ScriptApp.getService().getUrl();

    // Web Appとして開く場合はwidthを指定しない（画面幅いっぱいに表示）
    return template.evaluate()
      .setTitle(title)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  } catch (error) {
    // JSON APIリクエストのエラー時はJSONで返す
    if (e && e.parameter && e.parameter.action) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: error.message,
        stack: error.stack
      }))
        .setMimeType(ContentService.MimeType.JSON)
        .setHeader('Access-Control-Allow-Origin', '*')
        .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        .setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    // 通常のエラー時の表示
    return HtmlService.createHtmlOutput(
      '<h1>エラーが発生しました</h1><p>' + error.message + '</p><p>' + error.stack + '</p>'
    );
  }
}

/**
 * テスト用：doGet()をローカルでテストする関数
 * GASエディタでこの関数を実行して、doGet()の動作を確認できます
 */
function testDoGet() {
  try {
    const e = {
      parameter: {
        menu: 'inventory'
      }
    };

    Logger.log('=== testDoGet開始 ===');
    const result = doGet(e);
    Logger.log('Result type: ' + typeof result);
    Logger.log('Has evaluate: ' + (result && typeof result.evaluate === 'function'));

    if (result && typeof result.evaluate === 'function') {
      Logger.log('Evaluating...');
      const html = result.evaluate();
      Logger.log('HTML generated successfully');
      Logger.log('HTML content length: ' + html.getContent().length);
      Logger.log('First 200 chars: ' + html.getContent().substring(0, 200));
      return { success: true, message: 'HTML template generated successfully', contentLength: html.getContent().length };
    } else {
      Logger.log('ERROR: result is not a template');
      Logger.log('result: ' + JSON.stringify(result));
      return { success: false, message: 'Result is not a template', result: result };
    }
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return { success: false, message: error.toString(), stack: error.stack };
  }
}

/**
 * テスト用：超シンプルな関数（google.script.run検証用）
 */
function testHelloWorld() {
  return { success: true, data: 'Hello World from GAS!' };
}

/**
 * テスト用：getInventoryDashboardAPIと同じ形式で固定データを返す
 */
function testInventoryDashboardMock() {
  return {
    success: true,
    data: {
      statistics: {
        total: 1,
        statusCounts: {
          registered: 1,
          preparingListing: 0,
          listed: 0,
          sold: 0,
          withdrawn: 0
        },
        totalPurchaseAmount: 1000,
        totalListingAmount: 2000,
        totalSaleAmount: 0,
        totalProfit: 0,
        averageProfit: 0,
        averageInventoryDays: 0
      },
      products: [
        {
          managementNumber: 'TEST-001',
          brand: 'テストブランド',
          productName: 'テスト商品',
          status: '登録済み',
          purchaseAmount: 1000,
          listingAmount: 2000,
          category: 'メンズ',
          size: 'M',
          color: 'ブルー'
        }
      ],
      count: 1,
      totalCount: 1,
      page: 1,
      perPage: 10,
      totalPages: 1
    }
  };
}

/**
 * テスト用：getInventoryDashboardAPIを直接テスト
 */
function testInventoryAPI() {
  try {
    Logger.log('=== testInventoryAPI開始 ===');
    const params = {
      statuses: ['登録済み', '出品準備中', '出品中'],
      page: 1,
      limit: 10,
      sortBy: 'registeredAt',
      sortOrder: 'desc',
      searchText: '',
      brand: '',
      category: '',
      size: '',
      color: ''
    };

    const result = getInventoryDashboardAPI(params);
    Logger.log('Result type: ' + typeof result);
    Logger.log('Result: ' + JSON.stringify(result).substring(0, 500));
    return result;
  } catch (error) {
    Logger.log('ERROR: ' + error.toString());
    Logger.log('Stack: ' + error.stack);
    return { success: false, error: error.toString() };
  }
}

function showProductSidebar() {
  const t = HtmlService.createTemplateFromFile('sidebar_product');
  t.isSidebar = true;  // スプレッドシートのサイドバーフラグ
  const html = t.evaluate().setTitle('商品登録').setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showInventorySidebar() {
  const html = HtmlService.createHtmlOutputFromFile('sidebar_inventory')
    .setTitle('📦 在庫管理')
    .setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showMasterDataManager() {
  SpreadsheetApp.getUi().alert('情報', 'マスタデータ管理機能は準備中です', SpreadsheetApp.getUi().ButtonSet.OK);
}

function showSalesAnalysis() {
  SpreadsheetApp.getUi().alert('情報', '売上分析機能は将来実装予定です', SpreadsheetApp.getUi().ButtonSet.OK);
}

function showConfigManager() {
  const t = HtmlService.createTemplateFromFile('sidebar_config');
  t.isSidebar = true;  // スプレッドシートのサイドバーフラグ
  const html = t.evaluate().setTitle('設定管理').setWidth(400);
  SpreadsheetApp.getUi().showSidebar(html);
}

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  // 商品管理メニュー
  ui.createMenu('📝 商品管理')
    .addItem('📝 商品登録', 'showProductSidebar')
    .addItem('📦 在庫管理', 'showInventorySidebar')
    .addToUi();

  // フィルタ・検索メニュー
  ui.createMenu('🔍 フィルタ・検索')
    .addItem('🔍 詳細絞り込み', 'showFilterDialog')
    .addSeparator()
    .addItem('📦 在庫中のみ表示', 'quickFilterInStock')
    .addItem('🚀 出品済のみ表示', 'quickFilterListed')
    .addItem('💰 未販売のみ表示', 'quickFilterUnsold')
    .addItem('📅 今月仕入れ分のみ', 'quickFilterThisMonth')
    .addItem('⚠️ 在庫日数30日以上', 'quickFilterOldStock')
    .addSeparator()
    .addItem('✖️ フィルタ解除', 'clearFilter')
    .addToUi();

  // マスタ・設定メニュー
  ui.createMenu('🗂️ マスタ・設定')
    .addItem('🗂️ マスタデータ管理', 'showMasterDataManager')
    .addItem('⚙️ 設定管理', 'showConfigManager')
    .addSeparator()
    .addItem('💰 販売記録機能セットアップ', 'setupSalesRecordingSheets')
    .addItem('🚚 発送方法マスタ管理', 'showShippingMethodMasterManager')
    .addSeparator()
    .addItem('🔧 APIキー検証', 'validateAllApiKeys')
    .addToUi();
}

// ========================================
// CORS対応のJSON レスポンスヘルパー関数
// ========================================

/**
 * オブジェクトをContentServiceでラップ（inventory.js用）
 */
function toContentService_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * JSON 成功レスポンス
 * 注：GASは自動的にCORSを処理するため、手動ヘッダー設定不要
 */
function jsonOk_(obj) {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: obj }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * JSON エラーレスポンス
 */
function jsonError_(message) {
  return ContentService.createTextOutput(JSON.stringify({ ok: false, error: message }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader('Access-Control-Allow-Origin', '*')
    .setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    .setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

/**
 * 到達ログ（デバッグ用）
 */
function logDebug_Reach(action, params, startTime) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName('FCM登録デバッグ');
    if (!sh) {
      sh = ss.insertSheet('FCM登録デバッグ');
      sh.appendRow(['タイムスタンプ', 'ソース', 'アクション', 'パラメータ', '処理時間']);
    }
    sh.appendRow([
      new Date(),
      'menu.doGet',
      action,
      JSON.stringify(params).substring(0, 200),
      (new Date() - startTime) + 'ms'
    ]);
  } catch (e) {
    // ログ失敗は握りつぶし
    Logger.log('logDebug_Reach error: ' + e);
  }
}
