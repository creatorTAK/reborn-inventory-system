/**
 * SPA Pages Configuration Registry
 *
 * Fragment登録されたページはSPA方式で表示、未登録はiframe fallback。
 * type: 'fragment' → fetch + DOM注入
 * type: 'iframe'  → 従来のiframe方式（明示的に指定する場合）
 */
const FURIRA_PAGES = {
  // === Phase 1: パイロットページ ===
  plans: {
    type: 'fragment',
    fragmentUrl: '/fragments/plans.html',
    init: 'initPlansPage',
    destroy: 'destroyPlansPage',
    bottomNav: null
  },
  feedback: {
    type: 'fragment',
    fragmentUrl: '/fragments/feedback.html',
    init: 'initFeedbackPage',
    destroy: 'destroyFeedbackPage',
    bottomNav: null
  },
  announce: {
    type: 'fragment',
    fragmentUrl: '/fragments/announce.html',
    init: 'initAnnouncePage',
    destroy: 'destroyAnnouncePage',
    bottomNav: null
  },

  // === Phase 2: 高頻度ページ ===
  home: {
    type: 'fragment',
    fragmentUrl: '/fragments/menu_home.html',
    init: 'initMenuHomePage',
    destroy: 'destroyMenuHomePage',
    bottomNav: 'home'
  },
  'todo-list': {
    type: 'fragment',
    fragmentUrl: '/fragments/todo_list.html',
    init: 'initTodoListPage',
    destroy: 'destroyTodoListPage',
    bottomNav: 'todo'
  },
  todo: {
    type: 'fragment',
    fragmentUrl: '/fragments/todo_list.html',
    init: 'initTodoListPage',
    destroy: 'destroyTodoListPage',
    bottomNav: 'todo'
  },
  help: {
    type: 'fragment',
    fragmentUrl: '/fragments/help.html',
    init: 'initHelpPage',
    destroy: 'destroyHelpPage',
    bottomNav: null
  },
  compensation: {
    type: 'fragment',
    fragmentUrl: '/fragments/compensation.html',
    init: 'initCompensationPage',
    destroy: 'destroyCompensationPage',
    bottomNav: null
  },
  accounting: {
    type: 'fragment',
    fragmentUrl: '/fragments/accounting.html',
    init: 'initAccountingPage',
    destroy: 'destroyAccountingPage',
    bottomNav: null
  },
  // 'pickup-management': 一時的に非表示（改善後に復活予定）
  // {
  //   type: 'fragment',
  //   fragmentUrl: '/fragments/pickup-management.html',
  //   init: 'initPickupPage',
  //   destroy: 'destroyPickupPage',
  //   bottomNav: null
  // },

  // === Phase 3: 中規模ページ ===
  sales: {
    type: 'fragment',
    fragmentUrl: '/fragments/sales.html',
    init: 'initSalesPage',
    destroy: 'destroySalesPage',
    bottomNav: null
  },
  stocktaking: {
    type: 'fragment',
    fragmentUrl: '/fragments/stocktaking.html',
    init: 'initStocktakingPage',
    destroy: 'destroyStocktakingPage',
    bottomNav: null
  },
  'master-product': {
    type: 'fragment',
    fragmentUrl: '/fragments/master-management.html',
    init: 'initMasterManagementPage',
    destroy: 'destroyMasterManagementPage',
    bottomNav: null
  },
  'master-business': {
    type: 'fragment',
    fragmentUrl: '/fragments/master-management.html',
    init: 'initMasterManagementPage',
    destroy: 'destroyMasterManagementPage',
    bottomNav: null
  },
  product: {
    type: 'fragment',
    fragmentUrl: '/fragments/product.html',
    init: 'initProductPage',
    destroy: 'destroyProductPage',
    bottomNav: null
  },

  // === Phase 4: 大規模ページ ===
  'config-system': {
    type: 'fragment',
    fragmentUrl: '/fragments/config.html',
    init: 'initConfigPage',
    destroy: 'destroyConfigPage',
    bottomNav: null
  },
  'config-product': {
    type: 'fragment',
    fragmentUrl: '/fragments/config.html',
    init: 'initConfigPage',
    destroy: 'destroyConfigPage',
    bottomNav: null
  },
  'config-permission-users': {
    type: 'fragment',
    fragmentUrl: '/fragments/config.html',
    init: 'initConfigPage',
    destroy: 'destroyConfigPage',
    bottomNav: null
  },
  mypage: {
    type: 'fragment',
    fragmentUrl: '/fragments/mypage.html',
    init: 'initMypagePage',
    destroy: 'destroyMypagePage',
    bottomNav: 'mypage'
  },
  purchase: {
    type: 'fragment',
    fragmentUrl: '/fragments/purchase.html',
    init: 'initPurchasePage',
    destroy: 'destroyPurchasePage',
    bottomNav: null
  },

  // === Phase 5: チャット・在庫ページ ===
  'todo-history': {
    type: 'fragment',
    fragmentUrl: '/fragments/todo_history.html',
    init: 'initTodoHistoryPage',
    destroy: 'destroyTodoHistoryPage',
    bottomNav: null
  },
  inventory: {
    type: 'fragment',
    fragmentUrl: '/fragments/inventory.html',
    init: 'initInventoryPage',
    destroy: 'destroyInventoryPage',
    bottomNav: null
  },
  chat: {
    type: 'fragment',
    fragmentUrl: '/fragments/chat_rooms_list.html',
    init: 'initChatRoomsPage',
    destroy: 'destroyChatRoomsPage',
    bottomNav: 'chat'
  },
  'chat-room': {
    type: 'fragment',
    fragmentUrl: '/fragments/chat_ui_firestore.html',
    init: 'initChatUiPage',
    destroy: 'destroyChatUiPage',
    bottomNav: 'chat'
  },

  // === Phase 6: 最終ページ（GAS→Firestore移行完了） ===
  inventory_history: {
    type: 'fragment',
    fragmentUrl: '/fragments/inventory_history.html',
    init: 'initInventoryHistoryPage',
    destroy: 'destroyInventoryHistoryPage',
    bottomNav: null
  }
};
