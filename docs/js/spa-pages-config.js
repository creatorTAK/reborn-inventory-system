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
  }
};
