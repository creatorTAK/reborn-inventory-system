/**
 * FURIRA Recently Viewed Utilities
 * localStorage based recently viewed products
 */
var FuriraRecentlyViewed = {
  KEY: 'furira_recently_viewed',
  MAX: 20,

  get: function() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch (e) {
      return [];
    }
  },

  save: function(items) {
    localStorage.setItem(this.KEY, JSON.stringify(items));
  },

  add: function(productId) {
    var items = this.get();
    // Remove if already exists (will re-add at front)
    items = items.filter(function(id) { return id !== productId; });
    items.unshift(productId);
    // Keep max items
    if (items.length > this.MAX) items = items.slice(0, this.MAX);
    this.save(items);
  },

  getExcluding: function(excludeId, limit) {
    var items = this.get();
    if (excludeId) {
      items = items.filter(function(id) { return id !== excludeId; });
    }
    return items.slice(0, limit || 10);
  }
};
