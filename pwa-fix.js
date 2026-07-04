(function () {
  var isInstalled = window.matchMedia('(display-mode: standalone)').matches
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

  function showPwaMsg(text, type) {
    var box = document.getElementById('msgBox');
    if (!box) return;
    box.hidden = false;
    box.className = 'msg ' + (type || 'info');
    box.innerHTML = '<span>' + String(text).replace(/</g, '&lt;') + '</span>';
  }

  function setPwaSearchLoading(on) {
    var btn = document.getElementById('searchBtn');
    var inner = document.getElementById('searchBtnInner');
    if (!btn) return;
    btn.disabled = !!on;
    if (inner) inner.textContent = on ? 'Ricerca in corso…' : '🔍   Cerca Carta';
  }

  function renderPwaChoices(cards) {
    var list = document.getElementById('choicesList');
    var card = document.getElementById('choicesCard');
    var count = document.getElementById('choicesCount');
    if (!list || !card) {
      showPwaMsg('Trovate ' + cards.length + ' carte.', 'success');
      return;
    }
    list.innerHTML = cards.slice(0, 12).map(function (c, i) {
      var label = (c.name || 'Carta') + ' · ' + ((c.set && c.set.name) || '');
      return '<button type="button" class="choice-card" data-i="' + i + '">' +
        label.replace(/</g, '&lt;') + '</button>';
    }).join('');
    if (count) count.textContent = String(cards.length);
    card.hidden = false;
    window.__pwaCards = cards;
    list.querySelectorAll('button[data-i]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = window.__pwaCards[parseInt(btn.dataset.i, 10)];
        if (typeof window.selectCard === 'function') window.selectCard(c);
        else showPwaMsg('Selezionata: ' + (c.name || 'carta'), 'success');
      });
    });
  }

  async function pwaSearchPokemon() {
    var name = (document.getElementById('pokemonName')?.value || '').trim();
    var number = (document.getElementById('cardNumber')?.value || '').trim();
    if (!name && !number) {
      showPwaMsg('Inserisci almeno il nome del Pokémon o il numero della carta.', 'error');
      return;
    }

    setPwaSearchLoading(true);
    showPwaMsg('Ricerca in corso…', 'loading');

    try {
      var parts = [];
      if (name) parts.push('name:*' + name.replace(/[*"]/g, '') + '*');
      if (number) parts.push('number:' + number.replace(/"/g, ''));
      var url = new URL('/api/pokemontcg', location.origin);
      url.searchParams.set('q', parts.join(' '));
      url.searchParams.set('pageSize', '16');

      var res = await fetch(url.href, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
        cache: 'no-store',
      });
      if (!res.ok) throw new Error('Ricerca non disponibile (' + res.status + '). Controlla la connessione.');

      var json = await res.json();
      var cards = (json && json.data) ? json.data : [];
      if (!cards.length) {
        showPwaMsg('Nessuna carta trovata. Prova un altro nome.', 'warning');
        return;
      }

      showPwaMsg(cards.length === 1 ? 'Carta trovata!' : 'Trovate ' + cards.length + ' carte — seleziona quella corretta.', 'success');
      if (cards.length === 1 && typeof window.selectCard === 'function') {
        window.selectCard(cards[0]);
      } else if (typeof window.renderChoices === 'function') {
        window.renderChoices(cards);
      } else {
        renderPwaChoices(cards);
      }
    } catch (err) {
      showPwaMsg(err.message || 'Errore durante la ricerca.', 'error');
    } finally {
      setPwaSearchLoading(false);
    }
  }

  window.__dlsSearch = function (e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    var installed = document.documentElement.classList.contains('is-standalone')
      || window.matchMedia('(display-mode: standalone)').matches
      || window.matchMedia('(display-mode: minimal-ui)').matches
      || window.navigator.standalone === true;
    if (installed || typeof window.doSearch !== 'function') {
      pwaSearchPokemon();
    } else {
      window.doSearch();
    }
    return false;
  };

  function bindTap(el, fn) {
    if (!el || el.dataset.pwaTap === '1') return;
    el.dataset.pwaTap = '1';
    var last = 0;
    var run = function (e) {
      if (e.type === 'touchend') e.preventDefault();
      var now = Date.now();
      if (now - last < 350) return;
      last = now;
      fn(e);
    };
    el.addEventListener('touchend', run, { passive: false });
    el.addEventListener('click', run);
  }

  function bindSearchUi() {
    var form = document.getElementById('pokemonForm');
    var btn = document.getElementById('searchBtn');
    if (form && !form.dataset.pwaBound) {
      form.dataset.pwaBound = '1';
      form.addEventListener('submit', function (e) {
        window.__dlsSearch(e);
      });
    }
    bindTap(btn, function () { window.__dlsSearch(); });

    bindTap(document.getElementById('userBtn'), function () {
      if (typeof window.openAuthModal === 'function') window.openAuthModal();
    });

    var sel = document.getElementById('gameSelect');
    if (sel && !sel.dataset.pwaBound) {
      sel.dataset.pwaBound = '1';
      sel.addEventListener('change', function () {
        if (typeof window.switchActiveGame === 'function') window.switchActiveGame(sel.value);
      });
    }

    document.querySelectorAll('.game-tab[data-game]').forEach(function (tab) {
      bindTap(tab, function () {
        if (typeof window.switchActiveGame === 'function') window.switchActiveGame(tab.dataset.game);
      });
    });
  }

  if (isInstalled) document.documentElement.classList.add('is-standalone');

  applyBodyTouch();
  purgeSwCache();
  hideBlockingOverlays();

  document.addEventListener('DOMContentLoaded', function () {
    applyBodyTouch();
    hideBlockingOverlays();
    bindSearchUi();
  });
  window.addEventListener('pageshow', function () {
    hideBlockingOverlays();
    bindSearchUi();
  });
})();
