(function () {
  var standalone = window.matchMedia('(display-mode: standalone)').matches
    || window.matchMedia('(display-mode: fullscreen)').matches
    || window.navigator.standalone === true;

  document.documentElement.style.touchAction = 'manipulation';
  if (standalone) document.documentElement.classList.add('is-standalone');

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

  applyBodyTouch();
  purgeSwCache();
  hideBlockingOverlays();

  document.addEventListener('DOMContentLoaded', function () {
    applyBodyTouch();
    hideBlockingOverlays();
  });
  window.addEventListener('pageshow', hideBlockingOverlays);
})();
