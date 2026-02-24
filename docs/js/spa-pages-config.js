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
  'pickup-management': {
    type: 'fragment',
    fragmentUrl: '/fragments/pickup-management.html',
    init: 'initPickupPage',
    destroy: 'destroyPickupPage',
    bottomNav: null
  }
};
