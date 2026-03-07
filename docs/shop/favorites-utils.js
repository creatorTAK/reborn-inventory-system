/**
 * FURIRA Favorites Utilities
 * localStorage based favorites for vintage items
 */
var FuriraFavorites = {
  KEY: 'furira_favorites',

  get: function() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch (e) {
      return [];
    }
  },

  save: function(favs) {
    localStorage.setItem(this.KEY, JSON.stringify(favs));
  },

  toggle: function(productId) {
    var favs = this.get();
    var index = favs.indexOf(productId);
    if (index === -1) {
      favs.push(productId);
      this.save(favs);
      return true; // added
    } else {
      favs.splice(index, 1);
      this.save(favs);
      return false; // removed
    }
  },

  has: function(productId) {
    return this.get().indexOf(productId) !== -1;
  },

  count: function() {
    return this.get().length;
  }
};
