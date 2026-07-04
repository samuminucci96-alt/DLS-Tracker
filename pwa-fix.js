(function () {
  var standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.matchMedia('(display-mode: minimal-ui)').matches
    || window.navigator.standalone === true;

  document.documentElement.style.touchAction = 'manipulation';

  function applyBodyTouch() {
    if (document.body) document.body.style.touchAction = 'manipulation';
  }

  function hideBlockingOverlays() {
    ['authOverlay', 'profileOverlay'].forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      el.hidden = true;
      el.style.display = 'none';
      el.style.pointerEvents = 'none';
      el.classList.add('is-closed');
    });
    if (document.body) {
      document.body.classList.remove('auth-open', 'ios-install-open');
      document.body.style.overflow = '';
    }
    document.getElementById('installBanner')?.remove();
    document.getElementById('installIosSheet')?.remove();
  }

  function purgeSwCache() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        return Promise.all(regs.map(function (r) { return r.unregister(); }));
      }).catch(function () {});
    }
    if ('caches' in window) {
      caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }).catch(function () {});
    }
  }

  function bindPwaActions() {
    if (!standalone || document.documentElement.dataset.pwaActions === '1') return;
    document.documentElement.dataset.pwaActions = '1';

    document.addEventListener('submit', function (e) {
      var form = e.target;
      if (form && form.id === 'pokemonForm') {
        e.preventDefault();
        if (typeof window.doSearch === 'function') window.doSearch();
      }
    }, true);

    document.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('#searchBtn, #opSearchBtn, #rbSearchBtn, #userBtn, .game-tab') : null;
      if (!t) return;
      if (t.id === 'searchBtn' && typeof window.doSearch === 'function') {
        e.preventDefault();
        window.doSearch();
      } else if (t.id === 'opSearchBtn' && typeof window.tcgDoSearch === 'function') {
        e.preventDefault();
        window.tcgDoSearch('onepiece');
      } else if (t.id === 'rbSearchBtn' && typeof window.tcgDoSearch === 'function') {
        e.preventDefault();
        window.tcgDoSearch('riftbound');
      } else if (t.id === 'userBtn' && typeof window.openAuthModal === 'function') {
        e.preventDefault();
        window.openAuthModal();
      } else if (t.classList && t.classList.contains('game-tab') && t.dataset.game && typeof window.switchActiveGame === 'function') {
        e.preventDefault();
        window.switchActiveGame(t.dataset.game);
      }
    }, true);

    var sel = document.getElementById('gameSelect');
    if (sel && !sel.dataset.pwaBound) {
      sel.dataset.pwaBound = '1';
      sel.addEventListener('change', function () {
        if (typeof window.switchActiveGame === 'function') window.switchActiveGame(sel.value);
      });
    }
  }

  if (standalone) document.documentElement.classList.add('is-standalone');

  applyBodyTouch();
  purgeSwCache();
  hideBlockingOverlays();

  document.addEventListener('DOMContentLoaded', function () {
    applyBodyTouch();
    hideBlockingOverlays();
    bindPwaActions();
  });
  window.addEventListener('pageshow', function () {
    hideBlockingOverlays();
    bindPwaActions();
  });
})();
