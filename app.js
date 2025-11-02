// ===============================
// 🍷 Fouquet’s Joy Suite — app.js v15.6
// Epak Design • Entrée/Sortie sans dropdown
// ===============================

export const API_URL =
  localStorage.getItem('API_BASE') ||
  "https://script.google.com/macros/s/AKfycbzhXTkQ0vSkU_hcR17GrWLiZM55cMBuUlaMMNu83XW8frY47vQuCfdavoNTRngTDKA4/exec";

const qs = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];
const state = { view: 'dashboard', products: [], zones: [] };

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./service-worker.js'));
}

// ===============================
// Status Sync
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
}

// ===============================
// API
// ===============================
async function api(action, method='GET', body=null) {
  try {
    if (method === 'GET') {
      const r = await fetch(`${API_URL}?action=${encodeURIComponent(action)}`);
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
    return { status: 'error', message: e.message };
  }
}

async function checkConnection() {
  const res = await api('getEtatStock');
  if (res.status === 'success') { setStatus('online'); return true; }
  setStatus(navigator.onLine ? 'error' : 'offline'); return false;
}

// ===============================
// Datalist Produits
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
// Data Loaders
// ===============================
async function loadZones() {
  const res = await api('zonesList');
  state.zones = (res.status === 'success' && Array.isArray(res.zones)) ? res.zones : [];
  return state.zones;
}

async function loadProducts() {
  const res = await api('getStockDetail');
  state.products = (res.status === 'success' && Array.isArray(res.stock)) ? res.stock : [];
  fillProductsDatalist(state.products, 'produitsList');
  return state.products;
}

// ===============================
// Routing
// ===============================
document.addEventListener('DOMContentLoaded', () => {
  qsa('.tab').forEach(btn => btn.addEventListener('click', () => render(btn.dataset.view)));
  render('dashboard');
  checkConnection();
  const btn = qs('#btnSync');
  btn && btn.addEventListener('click', async () => {
    const ok = await checkConnection();
    setStatus(ok ? 'synced' : 'error');
    if (ok) setTimeout(() => setStatus('online'), 2000);
  });
});

function render(view) {
  state.view = view;
  qsa('.tab').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  const tpl = qs(`#tpl-${view}`);
  qs('#app').innerHTML = tpl ? tpl.innerHTML : '<div class="card">Vue non disponible</div>';
  if (view === 'dashboard') mountDashboard();
  if (view === 'pertes')    mountPertes();
  if (view === 'invj')      mountInvJ();
  if (view === 'invm')      mountInvM();
  if (view === 'recettes')  mountRecettes();
}

// ===============================
// Dashboard
// ===============================
async function mountDashboard() {
  const res = await api('getEtatStock');
  if (res.status === 'success') {
    qs('#kpiStock').textContent = '€ ' + (res.valeurTotale||0).toLocaleString('fr-FR');
    qs('#kpiStockQte').textContent = (res.quantiteTotale||0).toLocaleString('fr-FR') + ' unités';
  }
  const st = await api('getStockDetail');
  const tb = qs('#tableStockDetail tbody');
  tb.innerHTML = st.stock.map(r =>
    `<tr><td>${escapeHtml(r.produit)}</td><td>${r.quantite}</td><td>${escapeHtml(r.unite)}</td><td>${r.prix}</td><td>${r.valeur}</td><td>${escapeHtml(r.zone)}</td></tr>`
  ).join('');
}

// ===============================
// Pertes
// ===============================
async function mountPertes() {
  ensureGlobalDatalist('produitsList');
  await loadProducts();

  const btnSave = qs('#btnSavePerte');
  const btnReset = qs('#btnResetPerte');

  btnSave?.addEventListener('click', async () => {
    const payload = {
      produit: qs('#pertesProduit')?.value,
      qte: qs('#pertesQte')?.value,
      unite: qs('#pertesUnite')?.value,
      motif: qs('#pertesMotif')?.value,
      comment: qs('#pertesComment')?.value
    };
    const res = await api('pertesAdd','POST', payload);
    alert(res.status==='success'?'✅ Perte enregistrée':'❌ '+res.message);
    if(res.status==='success') ['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesComment'].forEach(i=>qs('#'+i).value='');
  });

  btnReset?.addEventListener('click', ()=>['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesComment'].forEach(i=>qs('#'+i).value=''));
}

// ===============================
// Inventaire journalier (sans dropdown mouvement)
// ===============================
async function mountInvJ() {
  ensureGlobalDatalist('produitsList');
  await loadProducts();

  const btnEntree = qs('#btnInvJEntree');
  const btnSortie = qs('#btnInvJSortie');
  const btnReset  = qs('#btnResetInvJ');

  async function handler(type) {
    const payload = {
      type, // 'entree' ou 'sortie'
      produit: qs('#invjProduit')?.value,
      qte: qs('#invjQte')?.value,
      unite: qs('#invjUnite')?.value
    };
    const res = await api('inventaireJournalier','POST', payload);
    alert(res.status==='success'?`✅ ${type==='sortie'?'Sortie':'Entrée'} enregistrée`:'❌ '+res.message);
    if(res.status==='success') ['invjProduit','invjQte','invjUnite'].forEach(i=>qs('#'+i).value='');
  }

  btnEntree?.addEventListener('click', ()=>handler('entree'));
  btnSortie?.addEventListener('click', ()=>handler('sortie'));
  btnReset?.addEventListener('click', ()=>['invjProduit','invjQte','invjUnite'].forEach(i=>qs('#'+i).value=''));
}

// ===============================
// Inventaire mensuel
// ===============================
async function mountInvM() {
  const zSel = qs('#invmZone');
  if (zSel) {
    zSel.innerHTML = '<option>Chargement…</option>';
    const zones = await loadZones();
    zSel.innerHTML = zones.map(z=>`<option value="${escapeHtml(z)}">${escapeHtml(z)}</option>`).join('');
  }
  ensureGlobalDatalist('produitsList');
  await loadProducts();
  qs('#invmProduit')?.setAttribute('list','produitsList');

  qs('#btnInvmGenerate')?.addEventListener('click', async () => {
    const payload = { zone: qs('#invmZone')?.value, mois: qs('#invmMois')?.value };
    const res = await api('createInventaireMensuel','POST',payload);
    alert(res.status==='success'?'📄 Feuille générée':'❌ '+res.message);
  });

  qs('#btnInvmSave')?.addEventListener('click', async () => {
    const payload = {
      zone: qs('#invmZone')?.value,
      mois: qs('#invmMois')?.value,
      produits: qs('#invmProduit')?.value,
      quantite: qs('#invmQte')?.value,
      unite: qs('#invmUnite')?.value,
      commentaires: qs('#invmComment')?.value
    };
    const res = await api('saveInventaireMensuel','POST',payload);
    alert(res.status==='success'?'💾 Enregistré':'❌ '+res.message);
    if(res.status==='success') ['invmProduit','invmQte','invmUnite','invmComment'].forEach(i=>qs('#'+i).value='');
  });
}

// ===============================
// Recettes
// ===============================
async function mountRecettes() {
  const res = await api('getRecettes');
  const list = qs('#recettesList');
  const search = qs('#recetteSearch');
  let all = (res.status==='success'?res.recettes:[])||[];
  renderRecettes(all);
  search?.addEventListener('input',e=>{
    const q = e.target.value.toLowerCase();
    renderRecettes(all.filter(r=>(r.nom||'').toLowerCase().includes(q)));
  });
}

function renderRecettes(items) {
  const list = qs('#recettesList'); list.innerHTML='';
  items.forEach(r=>{
    const card=document.createElement('div'); card.className='card'; card.innerHTML=`<strong>${escapeHtml(r.nom)}</strong><br><small>${r.categorie||''}</small>`;
    card.addEventListener('click',()=>loadRecetteDetail(r.code));
    list.appendChild(card);
  });
}

async function loadRecetteDetail(code) {
  const res = await api(`getRecette&code=${encodeURIComponent(code)}`);
  const c = qs('#recetteDetail');
  if(res.status!=='success'){ c.innerHTML='<div class="card">Recette introuvable</div>'; return; }
  const r = res.recette;
  c.innerHTML = `<div class="card"><h3>${r.nom}</h3><table class="list"><thead><tr><th>Produit</th><th>Qté</th><th>Unité</th></tr></thead><tbody>${r.ingredients.map(i=>`<tr><td>${i.produit}</td><td>${i.quantite}</td><td>${i.unite}</td></tr>`).join('')}</tbody></table></div>`;
}
