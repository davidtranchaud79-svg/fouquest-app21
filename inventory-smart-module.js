/**
 * INVENTAIRE JOY — MODULE FRONT EXISTING PWA
 * À charger dans ton app existante après app.js,
 * ou à coller à la fin de ton app.js.
 *
 * Dépend d'une URL Apps Script WebApp stockée dans :
 * - localStorage.GAS_URL
 * - ou window.API_URL
 * - ou champ #setApiUrl si présent dans tes settings.
 */

window.InventorySmart = (() => {
  const state = {
    init: null,
    selectedCle: '',
    suggestions: []
  };

  function apiBase() {
    return localStorage.getItem('GAS_URL')
      || localStorage.getItem('API_URL')
      || window.API_URL
      || (document.querySelector('#setApiUrl') ? document.querySelector('#setApiUrl').value : '')
      || '';
  }

  async function apiGet(path, params = {}) {
    const base = apiBase();
    if (!base) throw new Error('GAS_URL absent dans les réglages.');

    const url = new URL(base);
    url.searchParams.set('path', path);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const res = await fetch(url.toString());
    return await res.json();
  }

  async function apiPost(path, body = {}) {
    const base = apiBase();
    if (!base) throw new Error('GAS_URL absent dans les réglages.');

    const url = new URL(base);
    url.searchParams.set('path', path);

    const apiKey = localStorage.getItem('API_KEY') || '';
    if (apiKey) url.searchParams.set('apiKey', apiKey);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    });

    return await res.json();
  }

  async function init() {
    bindEvents();

    try {
      state.init = await apiGet('inventorySmartInit');

      const mois = document.querySelector('#smartMois');
      const poste = document.querySelector('#smartPoste');

      if (mois) mois.value = state.init.moisActif || '';

      if (poste) {
        poste.innerHTML = '';
        (state.init.postes || []).forEach(p => {
          const opt = document.createElement('option');
          opt.value = p;
          opt.textContent = p;
          poste.appendChild(opt);
        });
      }

      renderStatus('Module inventaire intelligent prêt.', 'ok');
    } catch (e) {
      renderStatus(e.message || String(e), 'error');
    }
  }

  function bindEvents() {
    const article = document.querySelector('#smartArticle');
    const save = document.querySelector('#smartSave');
    const bulk = document.querySelector('#smartBulkRun');

    if (article && !article.dataset.boundSmart) {
      article.dataset.boundSmart = '1';
      let timer = null;
      article.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(search, 250);
      });
    }

    if (save && !save.dataset.boundSmart) {
      save.dataset.boundSmart = '1';
      save.addEventListener('click', submit);
    }

    if (bulk && !bulk.dataset.boundSmart) {
      bulk.dataset.boundSmart = '1';
      bulk.addEventListener('click', bulkImport);
    }
  }

  async function search() {
    const q = val('#smartArticle');
    const poste = val('#smartPoste');

    state.selectedCle = '';

    if (q.length < 2) {
      renderSuggestions([]);
      return;
    }

    try {
      const res = await apiGet('inventorySmartSearch', { q, poste, limit: 8 });
      state.suggestions = res.items || [];
      renderSuggestions(state.suggestions);
    } catch (e) {
      renderStatus(e.message || String(e), 'error');
    }
  }

  async function submit() {
    const payload = {
      mois: val('#smartMois'),
      poste: val('#smartPoste'),
      articleTerrain: val('#smartArticle'),
      qte: val('#smartQte'),
      unite: val('#smartUnite'),
      cleChoisie: state.selectedCle
    };

    renderStatus('Enregistrement...', 'warn');

    try {
      const res = await apiPost('inventorySmartSubmit', payload);

      if (res.ok) {
        renderStatus(res.message || 'Enregistré.', 'ok');
        clearLine();
        return;
      }

      if (res.status === 'NEED_CHOICE') {
        state.suggestions = res.suggestions || [];
        renderSuggestions(state.suggestions);
        renderStatus('Choix nécessaire : sélectionne une proposition puis enregistre.', 'warn');
        return;
      }

      renderStatus(res.message || 'Erreur.', 'error');
    } catch (e) {
      renderStatus(e.message || String(e), 'error');
    }
  }

  async function bulkImport() {
    const raw = val('#smartBulkText');
    const mois = val('#smartMois');
    const poste = val('#smartPoste');

    const rows = parseBulk(raw);

    if (!rows.length) {
      renderStatus('Aucune ligne exploitable dans le collage.', 'warn');
      return;
    }

    renderStatus('Import en masse en cours...', 'warn');

    try {
      const res = await apiPost('inventorySmartBulkImport', { mois, poste, rows });

      if (res.ok) {
        renderStatus(
          `Import terminé : ${res.summary.ok} rangés, ${res.summary.needChoice} à vérifier, ${res.summary.error} erreurs.`,
          'ok'
        );
      } else {
        renderStatus(res.message || 'Erreur import.', 'error');
      }
    } catch (e) {
      renderStatus(e.message || String(e), 'error');
    }
  }

  function parseBulk(raw) {
    return String(raw || '')
      .split(/\n+/)
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split(/\t|;/).map(x => x.trim());

        if (parts.length >= 3) {
          return {
            articleTerrain: parts[0],
            qte: parts[1],
            unite: parts[2]
          };
        }

        const m = line.match(/^(.+?)\s+([0-9]+(?:[,.][0-9]+)?)\s*(kg|kilo|l|litre|pcs|piece|pièces|g|ml)?$/i);
        if (m) {
          return {
            articleTerrain: m[1].trim(),
            qte: m[2],
            unite: (m[3] || '').toUpperCase()
          };
        }

        return {
          articleTerrain: line,
          qte: '',
          unite: ''
        };
      });
  }

  function renderSuggestions(items) {
    const box = document.querySelector('#smartSuggestions');
    if (!box) return;

    box.innerHTML = '';

    if (!items || !items.length) {
      box.innerHTML = '<div class="smart-muted">Aucune proposition pour le moment.</div>';
      return;
    }

    items.forEach(item => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'smart-choice';
      btn.innerHTML = `
        <strong>${esc(item.article)}</strong>
        <small>${esc(item.groupe || '')} · ${esc(item.unite || '')} · score ${esc(item.score || '')}</small>
      `;

      btn.addEventListener('click', () => {
        state.selectedCle = item.cle;
        document.querySelectorAll('.smart-choice').forEach(x => x.classList.remove('selected'));
        btn.classList.add('selected');
        renderStatus(`Sélection : ${item.article}`, 'ok');
      });

      box.appendChild(btn);
    });
  }

  function renderStatus(message, type) {
    const el = document.querySelector('#smartStatus');
    if (!el) return;

    el.textContent = message || '';
    el.className = 'smart-status ' + (type || '');
    el.style.display = message ? 'block' : 'none';
  }

  function clearLine() {
    setVal('#smartArticle', '');
    setVal('#smartQte', '');
    state.selectedCle = '';
    renderSuggestions([]);
    const article = document.querySelector('#smartArticle');
    if (article) article.focus();
  }

  function val(sel) {
    const el = document.querySelector(sel);
    return el ? String(el.value || '').trim() : '';
  }

  function setVal(sel, value) {
    const el = document.querySelector(sel);
    if (el) el.value = value;
  }

  function esc(s) {
    return String(s || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  return { init, search, submit, bulkImport };
})();

document.addEventListener('DOMContentLoaded', () => {
  if (document.querySelector('#inventorySmartModule')) {
    window.InventorySmart.init();
  }
});
