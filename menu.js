function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Web Appのエントリーポイント
 * URLパラメータ ?menu=product または ?menu=config でメニューを指定可能
 */
function doGet(e) {
  try {
    const menuType = (e && e.parameter && e.parameter.menu) ? e.parameter.menu : 'test';

    // テストモード
    if (menuType === 'test') {
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
              min-height: 50px;
            }
            a {
              display: inline-block;
              margin: 10px 0;
              padding: 12px 20px;
              background: #3b82f6;
              color: white;
              text-decoration: none;
              border-radius: 6px;
              font-size: 16px;
            }
            a:hover {
              background: #2563eb;
            }
          </style>
        </head>
        <body>
          <h1>✅ Web App 動作テスト成功！</h1>
          <p>このページが表示されれば、doGet()関数は正しく動作しています。</p>
          <button onclick="alert('ボタンも動作します！')">テストボタン</button>
          <hr>
          <h3>📱 次のテスト：</h3>
          <p><a href="${baseUrl}?menu=product-simple">シンプル商品登録を開く</a></p>
          <p><a href="${baseUrl}?menu=product">フル機能商品登録を開く</a></p>
        </body>
        </html>
      `)
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
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
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }

    let template;
    let title;

    if (menuType === 'config') {
      template = HtmlService.createTemplateFromFile('sidebar_config');
      title = '設定管理';
    } else if (menuType === 'product') {
      template = HtmlService.createTemplateFromFile('sidebar_product');
      title = '商品登録';
    } else {
      // 不明なメニューの場合はデフォルトで商品登録
      template = HtmlService.createTemplateFromFile('sidebar_product');
      title = '商品登録';
    }

    // Web Appとして開く場合はwidthを指定しない（画面幅いっぱいに表示）
    return template.evaluate()
      .setTitle(title)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
      .setSandboxMode(HtmlService.SandboxMode.IFRAME);
  } catch (error) {
    // エラー時の表示
    return HtmlService.createHtmlOutput(
      '<h1>エラーが発生しました</h1><p>' + error.message + '</p><p>' + error.stack + '</p>'
    );
  }
}

function showProductSidebar() {
  const t = HtmlService.createTemplateFromFile('sidebar_product');
  const html = t.evaluate().setTitle('商品登録').setWidth(360);
  SpreadsheetApp.getUi().showSidebar(html);
}

function showInventorySidebar() {
  SpreadsheetApp.getUi().alert('情報', '在庫管理機能は準備中です', SpreadsheetApp.getUi().ButtonSet.OK);
}

function showMasterDataManager() {
  SpreadsheetApp.getUi().alert('情報', 'マスタデータ管理機能は準備中です', SpreadsheetApp.getUi().ButtonSet.OK);
}

function showSalesAnalysis() {
  SpreadsheetApp.getUi().alert('情報', '売上分析機能は将来実装予定です', SpreadsheetApp.getUi().ButtonSet.OK);
}

function showConfigManager() {
  const t = HtmlService.createTemplateFromFile('sidebar_config');
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
    .addToUi();
}
