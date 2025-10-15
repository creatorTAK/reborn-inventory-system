function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Web Appのエントリーポイント
 * URLパラメータ ?menu=product または ?menu=config でメニューを指定可能
 */
function doGet(e) {
  try {
    const menuType = (e && e.parameter && e.parameter.menu) ? e.parameter.menu : 'product';

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
            src: "https://raw.githubusercontent.com/creatorTAK/reborn-inventory-system/main/icon-512-Photoroom.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable"
          },
          {
            src: "https://raw.githubusercontent.com/creatorTAK/reborn-inventory-system/main/icon-180.png",
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
    } else {
      // 不明なメニューの場合はデフォルトで商品登録
      template = HtmlService.createTemplateFromFile('sidebar_product');
      title = 'REBORN';
    }

    // Web Appとして開かれていることを示すフラグ（戻るボタン表示用）
    template.showBackButton = true;

    // Web Appとして開く場合はwidthを指定しない（画面幅いっぱいに表示）
    return template.evaluate()
      .setTitle(title)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, shrink-to-fit=no')
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
  t.isSidebar = true;  // スプレッドシートのサイドバーフラグ
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
    .addToUi();
}
