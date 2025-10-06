function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
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
  const html = HtmlService.createHtmlOutputFromFile('sidebar_config')
    .setTitle('設定管理')
    .setWidth(400);
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
