// ===============================
// 🍷 Fouquet’s Joy Suite — app.js v15.5
// Epak Design • Zones + Produits dynamiques • Entrée/Sortie
// ===============================

// --- API BASE (modifie via localStorage 'API_BASE' si besoin) ---
export const API_URL =
  localStorage.getItem('API_BASE') ||
  "https://script.google.com/macros/s/REMP_LA_URL_DU_DEPLOIEMENT/exec";

// --- Helpers DOM ---
const qs = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];

// --- État ---
const state = { view: 'dashboard', products: [], zones: [] };

// --- Service Worker (PWA) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}

// ===============================
//           Statut Sync
// ===============================
function setStatus(mode) {
  const badge = qs('#syncBadge');
  if (!badge) return;
  badge.className = 'status-badge ' + mode;
  badge.textContent = ({
    online: 'En ligne',
    offline: 'Hors ligne',
    error: 'Erreur',
    synced: 'Synchronisé'
  }[mode]) || '—';
  badge.title = ({
    online: 'Connecté à Google Sheets',
    offline: 'Mode hors-ligne (cache actif)',
    error: 'Erreur de synchronisation',
    synced: 'Synchronisé avec Sheets'
  }[mode]) || '';
}

window.addEventListener('online',  ()=> setStatus('online'));
window.addEventListener('offline', ()=> setStatus('offline'));

// ===============================
//             API
// ===============================
async function api(action, method='GET', body=null) {
  try {
    if (method === 'GET') {
      const r = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`, { method: 'GET', cache: 'no-store' });
      return await r.json();
    } else {
      const r = await fetch(API_URL, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ action, ...(body||{}) })
      });
      return await r.json();
    }
  } catch (e) {
    return { status: 'error', message: e.message || 'Fetch error' };
  }
}

async function checkConnection() {
  const res = await api('getEtatStock','GET');
  if (res.status === 'success') { setStatus('online'); return true; }
  setStatus(navigator.onLine ? 'error' : 'offline'); return false;
}

// ===============================
//    Datalist global produits
// ===============================
function ensureGlobalDatalist(id='produitsList') {
  let dl = document.getElementById(id);
  if (!dl) {
    dl = document.createElement('datalist');
    dl.id = id;
    document.body.appendChild(dl);
  }
  return dl;
}

function fillProductsDatalist(products, datalistId='produitsList') {
  const dl = ensureGlobalDatalist(datalistId);
  dl.innerHTML = products
    .filter(p => (p && p.produit))
    .map(p => `<option value="${escapeHtml(p.produit)}"></option>`)
    .join('');
}

function escapeHtml(s='') {
  return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

// ===============================
//      Chargements dynamiques
// ===============================
async function loadZones() {
  const res = await api('zonesList','GET');
  state.zones = (res.status === 'success' && Array.isArray(res.zones)) ? res.zones : [];
  return state.zones;
}

async function loadProducts() {
  const res = await api('getStockDetail','GET');
  state.products = (res.status === 'success' && Array.isArray(res.stock)) ? res.stock : [];
  // Alimente le datalist global
  fillProductsDatalist(state.products, 'produitsList');
  return state.products;
}

// ===============================
//           Views Router
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  // Onglets
  qsa('.tab').forEach(btn => btn.addEventListener('click', () => render(btn.dataset.view)));
  // Première vue
  render('dashboard');
  // Ping backend
  checkConnection();
  // Bouton sync
  const btn = qs('#btnSync');
  if (btn) {
    btn.addEventListener('click', async () => {
      const ok = await checkConnection();
      if (ok) {
        setStatus('synced');
        setTimeout(() => setStatus('online'), 1500);
        alert('✅ Synchronisation réussie avec Sheets');
      } else {
        alert('⚠️ Impossible de synchroniser (hors ligne ou erreur Apps Script)');
      }
    });
  }
});

function render(view) {
  state.view = view;
  qsa('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const tpl = qs(`#tpl-${view}`);
  qs('#app').innerHTML = tpl ? tpl.innerHTML : '<div class="section"><div class="card">Vue non disponible.</div></div>';
  if (view === 'dashboard') mountDashboard();
  if (view === 'pertes')    mountPertes();
  if (view === 'invj')      mountInvJ();
  if (view === 'invm')      mountInvM();
  if (view === 'recettes')  mountRecettes();
  if (view === 'settings')  mountSettings();
}

// ===============================
//           Dashboard
// ===============================
async function loadEtatStock() {
  const res = await api('getEtatStock','GET');
  if (res.status === 'success') {
    qs('#kpiStock')    && (qs('#kpiStock').textContent    = '€ ' + (res.valeurTotale||0).toLocaleString('fr-FR'));
    qs('#kpiStockQte') && (qs('#kpiStockQte').textContent = (res.quantiteTotale||0).toLocaleString('fr-FR') + ' unités');
  } else {
    qs('#kpiStock')    && (qs('#kpiStock').textContent    = '—');
    qs('#kpiStockQte') && (qs('#kpiStockQte').textContent = '—');
  }
}

async function loadStockDetail() {
  const res = await api('getStockDetail','GET');
  const tbody = qs('#tableStockDetail tbody'); if (!tbody) return;
  tbody.innerHTML = '';
  if (res.status === 'success') {
    res.stock.forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(it.produit||'')}</td>
        <td style="text-align:right">${Number(it.quantite||0)}</td>
        <td>${escapeHtml(it.unite||'')}</td>
        <td style="text-align:right">${Number(it.prix||0).toFixed(2)}</td>
        <td style="text-align:right">${Number(it.valeur||0).toFixed(2)}</td>
        <td>${escapeHtml(it.zone||'')}</td>`;
      tbody.appendChild(tr);
    });
  } else {
    tbody.innerHTML = '<tr><td colspan="6">⚠️ Erreur de chargement</td></tr>';
  }
}

function mountDashboard() {
  loadEtatStock();
  loadStockDetail();

  // Démo top pertes (remplace par ton endpoint si dispo)
  const tbody = qs('#topPertes tbody');
  if (tbody) {
    [['Saumon Label Rouge','6,2 kg','€ 148'],['Beurre AOP','3,0 kg','€ 96'],['Framboise','2,1 kg','€ 74']]
      .forEach(r => { const tr = document.createElement('tr'); r.forEach(c=>{const td=document.createElement('td');td.textContent=c;tr.appendChild(td)}); tbody.appendChild(tr); });
  }
  const ctx = qs('#chartPertes');
  if (ctx && window.Chart) {
    new Chart(ctx, {
      type: 'line',
      data: { labels:['J-6','J-5','J-4','J-3','J-2','J-1','J'], datasets:[{ label:'Pertes €', data:[50,80,60,120,90,140,110] }] },
      options: { plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
  }
}

// ===============================
//             Pertes
// ===============================
async function mountPertes() {
  // Assure datalist produits global dispo
  ensureGlobalDatalist('produitsList');
  await loadProducts(); // remplit le datalist
  // Événements
  const btnSave  = qs('#btnSavePerte');
  const btnReset = qs('#btnResetPerte');

  btnSave && btnSave.addEventListener('click', async () => {
    const payload = {
      produit: qs('#pertesProduit')?.value?.trim(),
      qte:     qs('#pertesQte')?.value,
      unite:   qs('#pertesUnite')?.value?.trim(),
      motif:   qs('#pertesMotif')?.value?.trim(),
      comment: qs('#pertesComment')?.value?.trim()
    };
    const res = await api('pertesAdd','POST', payload);
    alert(res.status === 'success' ? '✅ Perte enregistrée.' : ('❌ Erreur: ' + (res.message||'inconnue')));
    if (res.status === 'success') {
      // reset auto
      ['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesComment'].forEach(id => {
        const el = qs('#'+id); if (el) el.value = '';
      });
    }
  });

  btnReset && btnReset.addEventListener('click', () => {
    ['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesComment'].forEach(id => {
      const el = qs('#'+id); if (el) el.value = '';
    });
  });
}

// ===============================
//       Inventaire journalier
// ===============================
async function mountInvJ() {
  // Produits dynamiques
  ensureGlobalDatalist('produitsList');
  await loadProducts();

  const btnEntree = qs('#btnInvJEntree');
  const btnSortie = qs('#btnInvJSortie');
  const btnReset  = qs('#btnResetInvJ');

  async function handler(type) {
    const payload = {
      type, // 'entree' ou 'sortie'
      produit: qs('#invjProduit')?.value?.trim(),
      qte:     qs('#invjQte')?.value,
      unite:   qs('#invjUnite')?.value?.trim()
    };
    const res = await api('inventaireJournalier','POST', payload);
    alert(res.status === 'success' ? `✅ ${type==='sortie'?'Sortie':'Entrée'} enregistrée.` : ('❌ Erreur: ' + (res.message||'inconnue')));
    if (res.status === 'success') {
      // reset auto
      ['invjProduit','invjQte','invjUnite'].forEach(id => { const el=qs('#'+id); if (el) el.value=''; });
    }
  }

  btnEntree && btnEntree.addEventListener('click', () => handler('entree'));
  btnSortie && btnSortie.addEventListener('click', () => handler('sortie'));

  btnReset && btnReset.addEventListener('click', () => {
    ['invjProduit','invjQte','invjUnite'].forEach(id => { const el=qs('#'+id); if (el) el.value=''; });
  });
}

// ===============================
//       Inventaire mensuel
// ===============================
async function mountInvM() {
  // Zones dynamiques
  const zSel = qs('#invmZone');
  if (zSel) {
    zSel.innerHTML = '<option>Chargement…</option>';
    const zones = await loadZones();
    zSel.innerHTML = zones.length ? zones.map(z => `<option value="${escapeHtml(z)}">${escapeHtml(z)}</option>`).join('') : '<option>(Aucune zone)</option>';
  }

  // Produits dynamiques (attacher le datalist global à #invmProduit)
  ensureGlobalDatalist('produitsList');
  await loadProducts();
  const prodInput = qs('#invmProduit');
  if (prodInput) prodInput.setAttribute('list','produitsList');

  // Actions
  const btnGen   = qs('#btnInvmGenerate');
  const btnSave  = qs('#btnInvmSave');
  const btnReset = qs('#btnInvmReset');

  btnGen && btnGen.addEventListener('click', async () => {
    const payload = {
      zone: qs('#invmZone')?.value?.trim(),
      mois: qs('#invmMois')?.value || ''
    };
    const res = await api('createInventaireMensuel','POST', payload);
    alert(res.status === 'success' ? '📄 Feuille générée.' : ('❌ Erreur: ' + (res.message||'inconnue')));
  });

  btnSave && btnSave.addEventListener('click', async () => {
    const payload = {
      zone:         qs('#invmZone')?.value?.trim(),
      mois:         qs('#invmMois')?.value || '',
      produits:     qs('#invmProduit')?.value?.trim(),
      quantite:     qs('#invmQte')?.value,
      unite:        qs('#invmUnite')?.value?.trim(),
      commentaires: qs('#invmComment')?.value?.trim()
    };
    const res = await api('saveInventaireMensuel','POST', payload);
    alert(res.status === 'success' ? '💾 Enregistré sur la feuille.' : ('❌ Erreur: ' + (res.message||'inconnue')));
    if (res.status === 'success') {
      ['invmProduit','invmQte','invmUnite','invmComment'].forEach(id => { const el=qs('#'+id); if (el) el.value=''; });
    }
  });

  btnReset && btnReset.addEventListener('click', () => {
    ['invmMois','invmProduit','invmQte','invmUnite','invmComment'].forEach(id => { const el=qs('#'+id); if (el) el.value=''; });
  });
}

// ===============================
//            Recettes
// ===============================
async function loadRecettesListe() {
  const res = await api('getRecettes','GET');
  const list = qs('#recettesList');
  const search = qs('#recetteSearch');
  if (!list || !search) return;

  let all = [];
  if (res.status === 'success') { all = res.recettes || []; renderRecetteCards(all); }

  search.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    renderRecetteCards(all.filter(r => (r.nom||'').toLowerCase().includes(q)));
  });
}

function renderRecetteCards(items) {
  const list = qs('#recettesList'); if (!list) return;
  list.innerHTML = '';
  items.forEach(r => {
    const card = document.createElement('div');
    card.className = 'card'; card.style.cursor = 'pointer';
    card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div><strong>${escapeHtml(r.nom)}</strong><br><small>Base ${Number(r.portions||1)} portions</small></div>
      <button class="btn">Voir</button>
    </div>`;
    card.querySelector('button').addEventListener('click', () => loadRecetteDetail(r.code));
    list.appendChild(card);
  });
}

async function loadRecetteDetail(code) {
  const container = qs('#recetteDetail'); if (!container) return;
  container.innerHTML = '';
  const res = await api(`getRecette&code=${encodeURIComponent(code)}`,'GET');
  if (res.status !== 'success') { container.textContent = '⚠️ Recette introuvable.'; return; }
  const r = res.recette;
  container.innerHTML = `<div class="card recette-card">
    <h2 class="recette-title">${escapeHtml(r.nom)}</h2>
    <div class="recette-meta"><span>Base ${Number(r.portions||1)} portions</span></div>
    <div class="recette-controls">
      <label>Multiplier par :</label>
      <input id="multiInput" type="number" value="1" min="0.1" step="0.5" class="recette-multi">
    </div>
    <table class="list recette-table">
      <thead><tr><th>Produit</th><th>Qté</th><th>Unité</th><th>Zone</th></tr></thead>
      <tbody></tbody>
    </table>
  </div>`;
  const tbody = container.querySelector('tbody');
  (r.ingredients||[]).forEach(i => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${escapeHtml(i.produit||'')}</td>
                    <td data-base="${Number(i.quantite||0)}">${Number(i.quantite||0).toFixed(2)}</td>
                    <td>${escapeHtml(i.unite||'')}</td>
                    <td>${escapeHtml(i.zone||'')}</td>`;
    tbody.appendChild(tr);
  });
  const multi = qs('#multiInput');
  multi && multi.addEventListener('input', e => {
    const m = Number(e.target.value)||1;
    tbody.querySelectorAll('td[data-base]').forEach(td => {
      const base = Number(td.getAttribute('data-base'))||0;
      td.textContent = (base*m).toFixed(2);
    });
  });
}

function mountRecettes(){ loadRecettesListe(); }

// ===============================
//           Settings
// ===============================
function mountSettings() {
  const btn = qs('#btnSetSave');
  btn && btn.addEventListener('click', () => {
    localStorage.setItem('etab',   qs('#setEtab')?.value || '');
    localStorage.setItem('tz',     qs('#setTz')?.value || '');
    localStorage.setItem('emailCC',qs('#setEmail')?.value || '');
    localStorage.setItem('lang',   qs('#setLang')?.value || 'fr');
    alert('Paramètres enregistrés.');
  });
}
