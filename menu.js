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

function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('物販管理システム')
    .addItem('📝 商品登録', 'showProductSidebar')
    .addItem('📦 在庫管理', 'showInventorySidebar')
    .addSeparator()
    .addItem('🗂️ マスタデータ管理', 'showMasterDataManager')
    .addSeparator()
    .addItem('📊 売上分析', 'showSalesAnalysis')
    .addToUi();
}