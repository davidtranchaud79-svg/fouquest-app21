// ============================================================
// 🍷 Fouquet’s Joy — Gold Motion v17.3
// Frontend aligné avec code.gs
// + Inventaire mensuel intelligent intégré sans casser l’ancien mode
// ============================================================

// ===== CONFIG =====
const API_URL = "https://script.google.com/macros/s/AKfycbxqh8yvag7cBGZ34zza181fpWV2TssYeQIIqUEd5ZI91knMY5jSK6sUP0QDEULfh12a/exec";

// ===== HELPERS =====
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => [...r.querySelectorAll(s)];

function serialize(params) {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => u.append(k, v == null ? '' : String(v)));
  return u.toString();
}

async function api(action, params = {}) {
  const url = `${API_URL}?${serialize({ action, ...params })}`;

  try {
    const r = await fetch(url, { method: 'GET', cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e) {
    console.error("Erreur API", e);
    return { status: "error", message: e.message };
  }
}

function setBadge(state) {
  const b = qs('#syncBadge');
  if (!b) return;

  b.textContent = state === 'online'
    ? 'En ligne'
    : (state === 'error' ? 'Erreur' : 'Hors ligne');

  b.classList.toggle('offline', state !== 'online');
  b.classList.toggle('online', state === 'online');
}

const toNum = v => {
  if (v == null) return 0;
  const s = String(v).replace(',', '.');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
};

// ===== NAVIGATION =====
document.addEventListener('DOMContentLoaded', () => {
  qsa('.tab').forEach(btn => btn.addEventListener('click', () => {
    qsa('.tab').forEach(b => b.classList.toggle('active', b === btn));
    render(btn.dataset.view);
  }));

  const syncBtn = qs('#btnSync');
  if (syncBtn) syncBtn.addEventListener('click', checkConnection);

  render('dashboard');
  checkConnection();
});

async function checkConnection() {
  const res = await api('ping');
  setBadge(res.status === 'success' ? 'online' : 'error');
}

// ===== RENDER =====
async function render(view) {
  const tpl = qs(`#tpl-${view}`);

  qs('#app').innerHTML = tpl
    ? tpl.innerHTML
    : '<section class="section"><div class="card">Vue indisponible</div></section>';

  if (view === 'dashboard') await mountDashboard();
  if (view === 'pertes') mountPertes();
  if (view === 'invj') await mountInvJ();
  if (view === 'invm') await mountInvM();
  if (view === 'recettes') await mountRecettes();
  if (view === 'settings') mountSettings();
}

// ============================================================
// 📊 DASHBOARD – Pareto pertes + bascule simple
// ============================================================
async function mountDashboard() {
  try {
    const etat = await api('getEtatStock');

    if (etat.status === 'success') {
      qs('#kpiStock').textContent = `€ ${(etat.valeurTotale || 0).toLocaleString('fr-FR')}`;
      qs('#kpiStockQte').textContent = `${(etat.quantiteTotale || 0).toLocaleString('fr-FR')} unités`;
    }
  } catch (e) {
    console.warn('Etat stock', e);
  }

  try {
    const pertes = await api('getPertesPoids');

    if (pertes.status === 'success') {
      qs('#kpiPertes').textContent = `${(pertes.pertesKg || 0).toFixed(2)} kg`;

      const lab = qs('#kpiPertesLabel');
      if (lab) lab.textContent = "Poids total des pertes (kg)";
    }
  } catch (e) {}

  try {
    const detail = await api('getStockDetail');
    const tbody = qs('#tableStockDetail tbody');
    if (!tbody) return;

    const stockList = detail.stock || detail;
    tbody.innerHTML = '';

    (Array.isArray(stockList) ? stockList : []).forEach(it => {
      const tr = document.createElement('tr');

      tr.innerHTML = `
        <td>${it.produit || ''}</td>
        <td style="text-align:right">${Number(it.quantite || 0)}</td>
        <td>${it.unite || ''}</td>
        <td style="text-align:right">${Number(it.prix || 0).toFixed(2)}</td>
        <td style="text-align:right">${Number(it.valeur || 0).toFixed(2)}</td>
        <td>${it.zone || ''}</td>
      `;

      tbody.appendChild(tr);
    });
  } catch (e) {
    console.warn('Stock detail', e);
  }

  const ctx = qs('#chartPertes');
  const legendContainer = qs('#pertesLegend');
  const toggle = qs('#togglePareto');

  if (!ctx || !window.Chart) return;

  const simpleConfig = {
    type: 'bar',
    data: {
      labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
      datasets: [
        {
          label: 'Pertes (kg)',
          data: [4, 5.5, 3, 6.2, 4.8, 7.1, 5.6]
        }
      ]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  };

  let chart;

  function renderSimple() {
    if (chart) chart.destroy();

    chart = new Chart(ctx, simpleConfig);

    if (legendContainer) legendContainer.innerHTML = '';
  }

  async function renderPareto() {
    if (chart) chart.destroy();

    try {
      const pertesParProduit = await api('getPertesParProduit');

      if (pertesParProduit.status !== 'success') {
        renderSimple();
        return;
      }

      const pertes = pertesParProduit.pertes || [];

      if (!pertes.length) {
        if (ctx.parentElement) {
          ctx.parentElement.innerHTML = '<div class="muted">Aucune perte ce mois-ci 🎉</div>';
        }

        if (legendContainer) legendContainer.innerHTML = '';
        return;
      }

      const total = pertes.reduce((sum, p) => sum + p.qte, 0);
      const top = pertes.slice(0, 10);
      const labels = top.map(p => p.produit);
      const dataVals = top.map(p => p.qte);

      let cumul = 0;
      const cumulPct = dataVals.map(v => (cumul += v, (cumul / total * 100).toFixed(1)));

      chart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Pertes (kg)',
              data: dataVals,
              yAxisID: 'y',
              borderWidth: 1,
              borderRadius: 6
            },
            {
              label: 'Cumul (%)',
              data: cumulPct,
              type: 'line',
              yAxisID: 'y1',
              tension: 0.3
            }
          ]
        },
        options: {
          plugins: {
            legend: { position: 'bottom' },
            title: { display: true, text: 'Pareto des pertes (Top 10 produits)' }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Pertes (kg)' }
            },
            y1: {
              beginAtZero: true,
              position: 'right',
              min: 0,
              max: 100,
              grid: { drawOnChartArea: false },
              ticks: { callback: v => v + '%' },
              title: { display: true, text: 'Cumul %' }
            }
          }
        }
      });

      if (legendContainer) {
        legendContainer.innerHTML = `
          <div class="card muted" style="margin-top:1rem">
            ${top.map((p, i) => {
              const pct = ((p.qte / total) * 100).toFixed(1);

              return `
                <div style="display:flex;justify-content:space-between;">
                  <span>${i + 1}. ${p.produit}</span>
                  <span><b>${p.qte.toFixed(2)} kg</b> <small>(${pct}%)</small></span>
                </div>
              `;
            }).join('')}
            <hr>
            <div style="text-align:right;font-weight:bold;">Total : ${total.toFixed(2)} kg</div>
          </div>
        `;
      }
    } catch (e) {
      console.warn('Graph Pareto', e);
      renderSimple();
    }
  }

  if (toggle) {
    toggle.onchange = () => toggle.checked ? renderPareto() : renderSimple();
    toggle.checked = true;
    await renderPareto();
  } else {
    renderSimple();
  }
}

// ============================================================
// 🗑️ PERTES
// ============================================================
async function preloadProduits(datalistId) {
  try {
    const d = await api('getStockDetail');
    const dl = qs(`#${datalistId}`);
    if (!dl) return;

    const stockList = d.stock || d;

    dl.innerHTML = Array.isArray(stockList)
      ? stockList.map(p => `<option value="${smartEscape(p.produit)}">`).join('')
      : '';
  } catch (_) {}
}

function mountPertes() {
  preloadProduits('dlProduitsPertes');

  qs('#btnSavePerte').addEventListener('click', async () => {
    const payload = {
      produit: qs('#pertesProduit').value.trim(),
      qte: qs('#pertesQte').value,
      unite: qs('#pertesUnite').value.trim(),
      motif: qs('#pertesMotif').value.trim(),
      comment: qs('#pertesComment').value.trim()
    };

    if (!payload.produit || !payload.qte) return alert('Produit + quantité requis.');

    const res = await api('pertesAdd', payload);

    alert(res.status === 'success'
      ? '✅ Perte enregistrée'
      : ('❌ ' + (res.message || 'Erreur'))
    );

    ['pertesProduit', 'pertesQte', 'pertesUnite', 'pertesMotif', 'pertesComment']
      .forEach(id => qs('#' + id).value = '');
  });

  qs('#btnResetPerte').addEventListener('click', () => {
    ['pertesProduit', 'pertesQte', 'pertesUnite', 'pertesMotif', 'pertesComment']
      .forEach(id => qs('#' + id).value = '');
  });
}

// ============================================================
// 📦 INVENTAIRE JOURNALIER — unités auto depuis Sheets
// ============================================================
let produitsUnites = [];

async function mountInvJ() {
  try {
    const d = await api('getProduitsEtUnites');

    produitsUnites = d.status === 'success'
      ? d.produits
      : [];

    const dl = qs('#dlProduitsInvJ');

    if (dl) {
      dl.innerHTML = produitsUnites
        .map(p => `<option value="${smartEscape(p.produit)}">`)
        .join('');
    }
  } catch (e) {
    console.warn('Produits non chargés', e);
  }

  const inputProduit = qs('#invjProduit');
  const inputUnite = qs('#invjUnite');

  if (inputProduit) {
    inputProduit.addEventListener('input', () => {
      const val = inputProduit.value.trim().toLowerCase();

      const found = produitsUnites.find(p =>
        String(p.produit || '').trim().toLowerCase() === val
      );

      if (found) {
        inputUnite.value = found.unite || '';
        inputUnite.setAttribute('readonly', 'readonly');
        inputUnite.classList.add('locked');
      } else {
        inputUnite.value = '';
        inputUnite.removeAttribute('readonly');
        inputUnite.classList.remove('locked');
      }
    });
  }

  qs('#btnInvJEntree').addEventListener('click', () => handleInvJ('entree'));
  qs('#btnInvJSortie').addEventListener('click', () => handleInvJ('sortie'));

  qs('#btnResetInvJ').addEventListener('click', () => {
    ['invjProduit', 'invjQte', 'invjUnite'].forEach(id => qs('#' + id).value = '');
  });
}

async function handleInvJ(type) {
  const produit = qs('#invjProduit').value.trim();
  const qte = qs('#invjQte').value;
  const unite = qs('#invjUnite').value.trim();

  if (!produit || !qte) return alert('Veuillez remplir le produit et la quantité.');

  const res = await api('inventaireJournalier', { produit, qte, unite, type });

  alert(res.status === 'success'
    ? `✅ ${type === "entree" ? "Entrée" : "Sortie"} enregistrée`
    : '❌ ' + (res.message || 'Erreur')
  );

  ['invjProduit', 'invjQte', 'invjUnite'].forEach(id => qs('#' + id).value = '');

  qs('#invjUnite').removeAttribute('readonly');
  qs('#invjUnite').classList.remove('locked');
}

// ============================================================
// 🧾 INVENTAIRE MENSUEL — version intelligente intégrée
// Compatible avec ton app actuelle : api(action, params)
// ============================================================
async function mountInvM() {
  const section = qs('#app section') || qs('#app');

  let zones = [];

  try {
    const z = await api('zonesList');
    zones = z.status === 'success' ? z.zones : [];
  } catch {
    zones = [];
  }

  if (!zones.length) zones = ['Général'];

  let produitsData = [];

  try {
    const d = await api('getStockDetail');
    produitsData = d.status === 'success' ? (d.stock || []) : [];
  } catch {
    produitsData = [];
  }

  const produits = [...new Set(
    produitsData
      .map(p => p.produit || p.article || '')
      .filter(Boolean)
  )];

  const postes = [
    'Petit déjeuner',
    'Garde-manger',
    'Entremets',
    'Poisson',
    'Viande',
    'Surgelés',
    'Économat',
    'Pâtisserie',
    'Boulangerie',
    'Production cuisine',
    'A_RECLASSER'
  ];

  const moisActuel = new Date().toISOString().slice(0, 7);

  section.innerHTML = `
    <div class="card invm-header">
      <div class="card-title">📦 Inventaire Mensuel</div>

      <div class="grid" style="align-items:end;">
        <div class="input-field">
          <label>Zone</label>
          <select id="invmZone">
            ${zones.map(z => `<option>${smartEscape(z)}</option>`).join('')}
          </select>
        </div>

        <div class="input-field">
          <label>Mois</label>
          <input type="month" id="invmMois" value="${moisActuel}"/>
        </div>

        <div class="input-field">
          <button class="btn gold" id="btnGenSheet">📄 Générer la feuille</button>
        </div>
      </div>
    </div>

    <div class="card invm-smart">
      <div class="card-title">🧠 Inventaire intelligent</div>

      <div class="muted">
        Tu tapes ton article terrain, l’application cherche l’article le plus proche.
        Si le backend intelligent est branché, elle range directement dans le bon mois.
        Sinon, elle ajoute la ligne dans l’inventaire classique pour ne rien perdre.
      </div>

      <div class="grid" style="margin-top:1rem;">
        <div class="input-field">
          <label>Poste</label>
          <select id="smartPoste">
            ${postes.map(p => `<option>${smartEscape(p)}</option>`).join('')}
          </select>
        </div>

        <div class="input-field">
          <label>Mois</label>
          <input type="month" id="smartMois" value="${moisActuel}">
        </div>
      </div>

      <div class="grid">
        <div class="input-field">
          <label>Article terrain</label>
          <input id="smartArticle" placeholder="Ex : bacon, avocat, beans..." autocomplete="off">
        </div>

        <div class="input-field">
          <label>Quantité</label>
          <input id="smartQte" type="number" step="0.001" placeholder="0.000">
        </div>
      </div>

      <div class="grid">
        <div class="input-field">
          <label>Unité</label>
          <select id="smartUnite">
            <option value="KG">KG</option>
            <option value="L">L</option>
            <option value="PCS">PCS</option>
            <option value="G">G</option>
            <option value="ML">ML</option>
          </select>
        </div>

        <div class="input-field" style="display:flex;align-items:end;">
          <button class="btn success" id="btnSmartSave">✅ Enregistrer intelligemment</button>
        </div>
      </div>

      <div id="smartSuggestions" style="margin-top:1rem;"></div>
      <div id="smartStatus" class="muted" style="margin-top:.75rem;"></div>

      <hr>

      <div class="input-field">
        <label>Collage inventaire terrain en masse</label>
        <textarea id="smartBulkText" rows="8" placeholder="Ex :
BEANS    2    KG
BACON    1.5    KG
AVOCAT   12   PCS"></textarea>
      </div>

      <button class="btn gold" id="btnSmartBulk">🚀 Importer le collage intelligemment</button>
    </div>

    <div class="card invm-body">
      <div class="card-title">📋 Feuille d’inventaire classique</div>

      <table class="list" id="invTable">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Quantité</th>
            <th>Unité</th>
            <th>Commentaire</th>
            <th></th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>

      <div class="row-actions center">
        <button class="btn ghost" id="btnAddRow">➕ Ajouter une ligne</button>
        <button class="btn success" id="btnSaveInv">💾 Valider l’inventaire classique</button>
      </div>
    </div>

    <datalist id="dlProduitsInvM">
      ${produits.map(p => `<option value="${smartEscape(p)}">`).join('')}
    </datalist>
  `;

  const tbody = qs('#invTable tbody');

  function addRow(p = '', q = '', u = '', c = '') {
    const tr = document.createElement('tr');

    tr.innerHTML = `
      <td><input list="dlProduitsInvM" value="${smartEscape(p)}" placeholder="Produit"></td>
      <td><input type="number" step="0.01" value="${smartEscape(q)}" placeholder="0.00"></td>
      <td><input value="${smartEscape(u)}" placeholder="kg / L / pcs"></td>
      <td><input value="${smartEscape(c)}" placeholder="Commentaire"></td>
      <td><button class="btn danger small" type="button">✖</button></td>
    `;

    tr.querySelector('button').addEventListener('click', () => tr.remove());
    tbody.appendChild(tr);
  }

  addRow();

  qs('#btnAddRow').addEventListener('click', () => addRow());

  qs('#btnGenSheet').addEventListener('click', async () => {
    const res = await api('createInventaireMensuel', {
      zone: qs('#invmZone').value,
      mois: qs('#invmMois').value
    });

    alert(res.status === 'success'
      ? '✅ Feuille générée'
      : '❌ ' + (res.message || 'Erreur')
    );
  });

  qs('#btnSaveInv').addEventListener('click', async () => {
    const lignes = [];

    qsa('#invTable tbody tr').forEach(tr => {
      const [p, q, u, c] = qsa('input', tr).map(i => i.value);
      if (p && q) lignes.push({ produit: p, qte: q, unite: u, comment: c });
    });

    if (!lignes.length) return alert('Aucune ligne saisie.');

    const res = await api('saveInventaireMensuelBatch', {
      zone: qs('#invmZone').value,
      mois: qs('#invmMois').value,
      lignes: JSON.stringify(lignes)
    });

    alert(res.status === 'success'
      ? '✅ Inventaire enregistré'
      : '❌ ' + (res.message || 'Erreur')
    );

    if (res.status === 'success') {
      tbody.innerHTML = '';
      addRow();
    }
  });

  qs('#invmMois').addEventListener('input', () => {
    qs('#smartMois').value = qs('#invmMois').value;
  });

  qs('#smartMois').addEventListener('input', () => {
    qs('#invmMois').value = qs('#smartMois').value;
  });

  let smartSelected = null;
  let smartTimer = null;

  qs('#smartArticle').addEventListener('input', () => {
    smartSelected = null;
    clearTimeout(smartTimer);

    smartTimer = setTimeout(async () => {
      const query = qs('#smartArticle').value.trim();
      const poste = qs('#smartPoste').value;

      if (!query || query.length < 2) {
        qs('#smartSuggestions').innerHTML = '';
        return;
      }

      const items = await smartSearchArticles(query, poste, produitsData);

      smartRenderSuggestions(items, item => {
        smartSelected = item;

        const unite = item.unite || '';
        if (unite) qs('#smartUnite').value = smartNormalizeUnit(unite);

        const nom = item.article || item.produit || item.label || '';
        smartSetStatus('Sélection : ' + nom);
      });
    }, 250);
  });

  qs('#btnSmartSave').addEventListener('click', async () => {
    const articleTerrain = qs('#smartArticle').value.trim();
    const qte = qs('#smartQte').value;
    const unite = qs('#smartUnite').value;
    const poste = qs('#smartPoste').value;
    const mois = qs('#smartMois').value;

    if (!articleTerrain || !qte) {
      return alert('Article + quantité requis.');
    }

    smartSetStatus('Enregistrement intelligent en cours...');

    const payload = {
      mois,
      poste,
      articleTerrain,
      qte,
      unite,
      cle: smartSelected?.cle || '',
      cleChoisie: smartSelected?.cle || '',
      articleAxel: smartSelected?.article || smartSelected?.produit || smartSelected?.label || ''
    };

    let res;

    try {
      res = await api('inventorySmartSubmit', payload);
    } catch (e) {
      res = { status: 'error', message: e.message };
    }

    if (res.status === 'success' || res.ok === true) {
      smartSetStatus('✅ ' + (res.message || 'Enregistré intelligemment.'));

      qs('#smartArticle').value = '';
      qs('#smartQte').value = '';
      qs('#smartSuggestions').innerHTML = '';
      smartSelected = null;

      return;
    }

    if (res.status === 'NEED_CHOICE' || res.status === 'need_choice') {
      const suggestions = res.suggestions || res.items || [];

      smartRenderSuggestions(suggestions, item => {
        smartSelected = item;

        const uniteSuggestion = item.unite || '';
        if (uniteSuggestion) qs('#smartUnite').value = smartNormalizeUnit(uniteSuggestion);

        smartSetStatus('Sélection : ' + (item.article || item.produit || item.label || ''));
      });

      smartSetStatus('⚠️ Plusieurs choix possibles. Sélectionne la bonne ligne puis reclique sur enregistrer.');
      return;
    }

    const fallbackProduit =
      smartSelected?.article ||
      smartSelected?.produit ||
      smartSelected?.label ||
      articleTerrain;

    addRow(fallbackProduit, qte, unite, 'Ajouté par module intelligent — backend à brancher');

    smartSetStatus('⚠️ Backend intelligent pas encore branché. Ligne ajoutée dans l’inventaire classique.');
  });

  qs('#btnSmartBulk').addEventListener('click', async () => {
    const raw = qs('#smartBulkText').value.trim();
    if (!raw) return alert('Aucun collage à importer.');

    const rows = smartParseBulk(raw);
    if (!rows.length) return alert('Aucune ligne exploitable.');

    smartSetStatus('Import intelligent en masse en cours...');

    let res;

    try {
      res = await api('inventorySmartBulkImport', {
        mois: qs('#smartMois').value,
        poste: qs('#smartPoste').value,
        lignes: JSON.stringify(rows),
        rows: JSON.stringify(rows)
      });
    } catch (e) {
      res = { status: 'error', message: e.message };
    }

    if (res.status === 'success' || res.ok === true) {
      const s = res.summary || {};

      smartSetStatus(
        `✅ Import terminé : ${s.ok || 0} rangés, ${s.needChoice || 0} à vérifier, ${s.error || 0} erreurs.`
      );

      qs('#smartBulkText').value = '';
      return;
    }

    rows.forEach(row => {
      const best = smartLocalBest(row.articleTerrain, produitsData);

      addRow(
        best?.produit || best?.article || row.articleTerrain,
        row.qte,
        row.unite,
        'Import collage — backend intelligent à brancher'
      );
    });

    smartSetStatus('⚠️ Backend intelligent pas encore branché. Les lignes ont été ajoutées dans le tableau classique.');
  });
}

// ============================================================
// 🧠 HELPERS INVENTAIRE INTELLIGENT FRONTEND
// ============================================================
async function smartSearchArticles(query, poste, produitsData) {
  let items = [];

  try {
    const res = await api('inventorySmartSearch', {
      q: query,
      poste,
      limit: 8
    });

    if (res.status === 'success' || res.ok === true) {
      items = res.items || res.suggestions || [];
    }
  } catch {
    items = [];
  }

  if (!items.length) {
    items = smartLocalSearch(query, produitsData, 8);
  }

  return items;
}

function smartRenderSuggestions(items, onSelect) {
  const box = qs('#smartSuggestions');
  if (!box) return;

  if (!items || !items.length) {
    box.innerHTML = `<div class="muted">Aucune proposition fiable.</div>`;
    return;
  }

  box.innerHTML = items.map((it, idx) => {
    const article = it.article || it.produit || it.label || '';
    const groupe = it.groupe || it.zone || it.famille || '';
    const unite = it.unite || '';
    const score = it.score || '';

    return `
      <button class="btn ghost smart-choice" data-index="${idx}" type="button"
        style="display:block;width:100%;text-align:left;margin:.35rem 0;">
        <strong>${smartEscape(article)}</strong>
        <div class="muted">
          ${smartEscape(groupe)}
          ${unite ? '• ' + smartEscape(unite) : ''}
          ${score ? '• score ' + smartEscape(score) : ''}
        </div>
      </button>
    `;
  }).join('');

  qsa('.smart-choice', box).forEach(btn => {
    btn.addEventListener('click', () => {
      const index = Number(btn.dataset.index);
      const item = items[index];

      qsa('.smart-choice', box).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      if (typeof onSelect === 'function') onSelect(item);
    });
  });
}

function smartLocalSearch(query, produitsData, limit = 8) {
  const q = smartNormalize(query);

  return (produitsData || [])
    .map(p => {
      const produit = p.produit || p.article || '';

      return {
        produit,
        article: produit,
        groupe: p.zone || p.famille || '',
        unite: p.unite || '',
        cle: p.cle || '',
        score: smartScore(q, smartNormalize(produit))
      };
    })
    .filter(x => x.produit && x.score > 15)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function smartLocalBest(query, produitsData) {
  return smartLocalSearch(query, produitsData, 1)[0] || null;
}

function smartScore(q, target) {
  if (!q || !target) return 0;

  let score = 0;

  if (target === q) score += 100;
  if (target.startsWith(q)) score += 50;
  if (target.includes(q)) score += 35;

  const qTokens = q.split(' ').filter(Boolean);
  const tTokens = target.split(' ').filter(Boolean);

  qTokens.forEach(tok => {
    if (tTokens.includes(tok)) score += 25;
    else if (target.includes(tok)) score += 10;
  });

  return score;
}

function smartParseBulk(raw) {
  return String(raw || '')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(/\t|;/).map(x => x.trim()).filter(Boolean);

      if (parts.length >= 3) {
        return {
          articleTerrain: parts[0],
          qte: parts[1],
          unite: smartNormalizeUnit(parts[2])
        };
      }

      const m = line.match(/^(.+?)\s+([0-9]+(?:[,.][0-9]+)?)\s*(kg|kilo|l|litre|pcs|piece|pièces|g|ml)?$/i);

      if (m) {
        return {
          articleTerrain: m[1].trim(),
          qte: m[2],
          unite: smartNormalizeUnit(m[3] || '')
        };
      }

      return {
        articleTerrain: line,
        qte: '',
        unite: ''
      };
    });
}

function smartNormalize(value) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[’']/g, ' ')
    .replace(/\bOEUFS\b/g, 'OEUF')
    .replace(/\bPDT\b/g, 'POMME TERRE')
    .replace(/\bPOMMES DE TERRE\b/g, 'POMME TERRE')
    .replace(/\b(KG|KILO|KILOS|LITRE|LITRES|L|U|PCS|PCE|PIECE|PIECES|GR|GRS|G|ML)\b/g, '')
    .replace(/\d+[.,]?\d*/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function smartNormalizeUnit(value) {
  const u = String(value || '').trim().toUpperCase();

  if (['KG', 'KILO', 'KILOS'].includes(u)) return 'KG';
  if (['L', 'LITRE', 'LITRES'].includes(u)) return 'L';
  if (['PCS', 'PIECE', 'PIECES', 'PCE', 'U'].includes(u)) return 'PCS';
  if (['G', 'GR', 'GRS'].includes(u)) return 'G';
  if (['ML'].includes(u)) return 'ML';

  return u || 'KG';
}

function smartSetStatus(message) {
  const el = qs('#smartStatus');
  if (!el) return;

  el.textContent = message || '';
}

function smartEscape(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ============================================================
// 🍽️ RECETTES — multiplicateur autonome par carte
// ============================================================
let recetteCache = {};

async function mountRecettes() {
  try {
    const res = await api('getRecettes');
    const list = qs('#recettesList');

    if (res.status === 'success') {
      list.innerHTML = res.recettes.map(r => `
        <div class="card recette-card" data-code="${smartEscape(r.code)}">
          <div class="recette-header" style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <div>
              <strong>${smartEscape(r.nom)}</strong>
              <div class="muted">${smartEscape(r.categorie || '')} • base ${smartEscape(r.portions || 1)} p.</div>
            </div>
            <button class="btn ghost small">Voir</button>
          </div>
          <div class="recette-detail" style="display:none;"></div>
        </div>
      `).join('');

      qsa('.recette-card', list).forEach(card => {
        const btn = card.querySelector('.btn.small');

        btn.addEventListener('click', async ev => {
          ev.stopPropagation();

          const detail = card.querySelector('.recette-detail');

          if (detail.style.display === 'block') {
            detail.style.display = 'none';
            detail.innerHTML = '';
            card.classList.remove('open');
            btn.textContent = 'Voir';
            return;
          }

          qsa('.recette-detail').forEach(d => {
            d.style.display = 'none';
            d.innerHTML = '';
            d.parentElement.classList.remove('open');
          });

          qsa('.recette-card .btn.small').forEach(b => b.textContent = 'Voir');

          detail.innerHTML = '<div class="muted">Chargement...</div>';
          detail.style.display = 'block';
          card.classList.add('open');
          btn.textContent = 'Fermer';

          const code = card.dataset.code;

          if (!recetteCache[code]) {
            const r = await api('getRecette', { code });

            if (r.status !== 'success') {
              detail.innerHTML = '<div class="muted">Recette introuvable.</div>';
              return;
            }

            recetteCache[code] = { recette: r.recette, factor: 1 };
          }

          renderRecetteDetailInCard(card, recetteCache[code].recette, recetteCache[code].factor ?? 1);
        });
      });

      const search = qs('#recetteSearch');

      if (search) {
        search.addEventListener('input', e => {
          const q = e.target.value.toLowerCase();

          qsa('.recette-card', list).forEach(c => {
            const name = c.querySelector('strong').textContent.toLowerCase();
            c.style.display = name.includes(q) ? '' : 'none';
          });
        });
      }
    } else {
      qs('#recettesList').innerHTML = '<div class="muted">Aucune recette.</div>';
    }
  } catch (e) {
    qs('#recettesList').innerHTML = '<div class="muted">Erreur de chargement.</div>';
  }
}

function renderRecetteDetailInCard(card, recette, factorInit) {
  const code = card.dataset.code;
  const detail = card.querySelector('.recette-detail');
  const basePortions = toNum(recette.portions || 1);
  const f0 = Math.max(0, toNum(factorInit) || 1);

  detail.innerHTML = `
    <div class="recette-body">
      <div class="row-actions" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
        <span class="muted">Multiplicateur :</span>
        <button class="btn ghost small factor-dec" type="button">−</button>
        <input class="factor-input" type="number" step="0.1" min="0" value="${f0}" style="width:90px">
        <button class="btn ghost small factor-inc" type="button">+</button>
        <span class="info-line muted" style="margin-left:8px"></span>
      </div>

      <table class="list mini">
        <thead>
          <tr>
            <th>Produit</th>
            <th>Qté</th>
            <th>Unité</th>
            <th>Zone</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const input = detail.querySelector('.factor-input');
  const decBtn = detail.querySelector('.factor-dec');
  const incBtn = detail.querySelector('.factor-inc');
  const tbody = detail.querySelector('tbody');
  const info = detail.querySelector('.info-line');

  const renderRows = factor => {
    const rows = (recette.ingredients || []).map(i => {
      const q = toNum(i.quantite);
      const scaled = q * factor;

      return `
        <tr>
          <td>${smartEscape(i.produit)}</td>
          <td style="text-align:right">${scaled.toFixed(2)}</td>
          <td>${smartEscape(i.unite)}</td>
          <td>${smartEscape(i.zone || '')}</td>
        </tr>
      `;
    }).join('');

    tbody.innerHTML = rows;

    const totalPortions = basePortions * factor;

    info.innerHTML = `Base ${basePortions} p. → <b>${totalPortions.toFixed(1)} p.</b> (×${factor.toFixed(2)})`;
  };

  const setFactor = f => {
    const nf = Math.max(0, toNum(f) || 1);
    input.value = String(nf);
    recetteCache[code].factor = nf;
    renderRows(nf);
  };

  input.addEventListener('input', () => setFactor(input.value));
  decBtn.addEventListener('click', () => setFactor(toNum(input.value) - 1));
  incBtn.addEventListener('click', () => setFactor(toNum(input.value) + 1));

  setFactor(f0);
}

// ============================================================
// ⚙️ PARAMÈTRES
// ============================================================
function mountSettings() {
  const etab = localStorage.getItem('etab') || '';
  const tz = localStorage.getItem('tz') || 'Europe/Paris';
  const email = localStorage.getItem('emailCC') || '';
  const lang = localStorage.getItem('lang') || 'fr';

  if (qs('#setEtab')) qs('#setEtab').value = etab;
  if (qs('#setTz')) qs('#setTz').value = tz;
  if (qs('#setEmail')) qs('#setEmail').value = email;
  if (qs('#setLang')) qs('#setLang').value = lang;

  qs('#btnSetSave').addEventListener('click', () => {
    localStorage.setItem('etab', qs('#setEtab').value);
    localStorage.setItem('tz', qs('#setTz').value);
    localStorage.setItem('emailCC', qs('#setEmail').value);
    localStorage.setItem('lang', qs('#setLang').value);

    alert('Paramètres enregistrés ✅');
  });
}
