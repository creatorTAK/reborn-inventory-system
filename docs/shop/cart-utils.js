/**
 * FURIRA Cart Utilities
 * localStorage based cart for one-of-a-kind vintage items (no quantity)
 */
var FuriraCart = {
  KEY: 'furira_cart',

  get: function() {
    try {
      return JSON.parse(localStorage.getItem(this.KEY)) || [];
    } catch (e) {
      return [];
    }
  },

  save: function(cart) {
    localStorage.setItem(this.KEY, JSON.stringify(cart));
    this.updateBadge();
  },

  add: function(productId) {
    var cart = this.get();
    if (cart.indexOf(productId) !== -1) return false; // already in cart
    cart.push(productId);
    this.save(cart);
    return true;
  },

  remove: function(productId) {
    var cart = this.get().filter(function(id) { return id !== productId; });
    this.save(cart);
  },

  has: function(productId) {
    return this.get().indexOf(productId) !== -1;
  },

  count: function() {
    return this.get().length;
  },

  clear: function() {
    this.save([]);
  },

  updateBadge: function() {
    var badge = document.getElementById('cartBadge');
    if (!badge) return;
    var count = this.count();
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = 'flex';
    } else {
      badge.style.display = 'none';
    }
  }
};
