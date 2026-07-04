(function () {
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
      el.classList.add('is-closed');
    });
    document.body?.classList.remove('auth-open', 'ios-install-open');
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
  hideBlockingOverlays();
  purgeSwCache();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      applyBodyTouch();
      hideBlockingOverlays();
    });
  }
})();
