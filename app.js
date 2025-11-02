// ==========================================
// 🍷 Fouquet’s Joy Suite – v15.2
// Gold Motion / No-CORS + Zones Auto Refresh + Feedback visuel
// ==========================================

export const API_URL = localStorage.getItem('API_BASE') ||
  "https://script.google.com/macros/s/AKfycbwBx1RipR7oSn4Xb8VTem9U6g8D2OgSIrr8OEcGmtH0qNnUU9CJgh3acWt4DU2N2hMC/exec";

const qs = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];
const state = { view:'dashboard' };

// === SERVICE WORKER ===
if('serviceWorker' in navigator){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('./service-worker.js'));
}

// === BADGE STATUS ===
function setStatus(mode){
  const badge = qs('#syncBadge');
  if(!badge) return;
  badge.className = 'status-badge ' + mode;
  badge.textContent = {
    online: 'En ligne',
    offline: 'Hors ligne',
    error: 'Erreur',
    synced: 'Synchronisé'
  }[mode] || '—';

  // ✨ Effet visuel de transition
  badge.classList.remove('pulse');
  if(mode === 'synced'){
    badge.classList.add('pulse');
    setTimeout(()=> badge.classList.remove('pulse'), 2000);
  }
}

// === ÉVÉNEMENTS RESEAU ===
window.addEventListener('online',  ()=> setStatus('online'));
window.addEventListener('offline', ()=> setStatus('offline'));

// === TEST CONNEXION ===
async function checkConnection(){
  try{
    await fetch(`${API_URL}?action=getEtatStock`, { method:'GET', cache:'no-store', mode:'no-cors' });
    setStatus('online');
    return true;
  }catch(e){
    setStatus(navigator.onLine ? 'error' : 'offline');
    return false;
  }
}

// === INITIALISATION ===
document.addEventListener('DOMContentLoaded', ()=>{
  qsa('.tab').forEach(btn => btn.addEventListener('click', ()=> render(btn.dataset.view)));
  render('dashboard');
  checkConnection();

  const btn = qs('#btnSync');
  if(btn){
    btn.addEventListener('click', async ()=>{
      const ok = await checkConnection();
      if(ok){
        setStatus('synced');
        // 🔄 Recharge les zones
        const updated = await loadZonesCache(true);
        setTimeout(()=> setStatus('online'), 2000);
        if(updated) showToast('✅ Synchronisation réussie avec Sheets');
        else showToast('⚠️ Synchronisation sans mise à jour');
      }else{
        showToast('❌ Impossible de synchroniser (hors ligne ou erreur Apps Script)');
        setStatus('error');
      }
    });
  }
});

// === TOAST MESSAGE VISUEL ===
function showToast(msg){
  let toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(()=> toast.classList.add('show'), 50);
  setTimeout(()=> {
    toast.classList.remove('show');
    setTimeout(()=> toast.remove(), 500);
  }, 2500);
}

// === RENDU DE VUE ===
function render(view){
  state.view = view;
  qsa('.tab').forEach(b => b.classList.toggle('active', b.dataset.view===view));
  const tpl = qs(`#tpl-${view}`);
  qs('#app').innerHTML = tpl ? tpl.innerHTML : '<div class="section"><div class="card">Vue non disponible.</div></div>';

  if(view==='dashboard') mountDashboard();
  if(view==='pertes') mountPertes();
  if(view==='invj') mountInvJ();
  if(view==='invm') mountInvM();
  if(view==='recettes') mountRecettes();
  if(view==='settings') mountSettings();
}

// ===================================================
// 🔧  ZONES – Cache local + animation synchro
// ===================================================
async function loadZonesCache(showEffect=false){
  try {
    const res = await fetch(`${API_URL}?action=zonesList`, {method:'GET', mode:'no-cors'});
    const data = await res.json();
    if(data.status === 'success' && data.zones){
      localStorage.setItem('zones', JSON.stringify(data.zones));
      console.log('Zones mises à jour depuis Sheets:', data.zones);

      if(showEffect){
        const syncBadge = qs('#syncBadge');
        if(syncBadge){
          syncBadge.style.transition = 'background-color 0.5s';
          syncBadge.style.backgroundColor = '#7dd56f'; // vert succès
          setTimeout(()=> syncBadge.style.backgroundColor = '', 1000);
        }
      }
      return true;
    }
  } catch(e){ 
    console.warn('⚠️ Impossible de charger les zones:', e.message); 
  }
  return false;
}

function populateZones(selectId){
  const select = document.getElementById(selectId);
  if(!select) return;
  select.innerHTML = '';
  const zones = JSON.parse(localStorage.getItem('zones') || '[]');
  zones.forEach(z=>{
    const opt = document.createElement('option');
    opt.value = z; opt.textContent = z;
    select.appendChild(opt);
  });
}

// ===================================================
// 📊 DASHBOARD
// ===================================================
async function loadEtatStock(){
  try{
    const res = await fetch(`${API_URL}?action=getEtatStock`, {method:'GET', mode:'no-cors'});
    const data = await res.json();
    qs('#kpiStock').textContent = '€ ' + (data.valeurTotale||0).toLocaleString('fr-FR');
    qs('#kpiStockQte').textContent = (data.quantiteTotale||0).toLocaleString('fr-FR') + ' unités';
  }catch{
    qs('#kpiStock').textContent = '—';
    qs('#kpiStockQte').textContent = '—';
  }
}

async function loadStockDetail(){
  try{
    const res = await fetch(`${API_URL}?action=getStockDetail`, {method:'GET', mode:'no-cors'});
    const data = await res.json();
    const tbody = qs('#tableStockDetail tbody');
    tbody.innerHTML = '';
    (data.stock||[]).forEach(it=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${it.produit||''}</td>
        <td style="text-align:right">${Number(it.quantite||0)}</td>
        <td>${it.unite||''}</td>
        <td style="text-align:right">${Number(it.prix||0).toFixed(2)}</td>
        <td style="text-align:right">${Number(it.valeur||0).toFixed(2)}</td>
        <td>${it.zone||''}</td>`;
      tbody.appendChild(tr);
    });
  }catch(e){ console.error(e); }
}

function mountDashboard(){
  loadEtatStock();
  loadStockDetail();
  loadZonesCache();
}

// ===================================================
// 🗑️ PERTES
// ===================================================
function mountPertes(){
  qs('#btnSavePerte').addEventListener('click', async ()=>{
    const payload = {
      action:'pertesAdd',
      produit: qs('#pertesProduit').value,
      qte: qs('#pertesQte').value,
      unite: qs('#pertesUnite').value,
      motif: qs('#pertesMotif').value,
      comment: qs('#pertesComment').value
    };
    await fetch(API_URL, { 
      method:'POST', 
      headers:{'Content-Type':'application/json'}, 
      body: JSON.stringify(payload), 
      mode:'no-cors'
    });
    showToast('🗑️ Perte enregistrée');
  });
}

// ===================================================
// 📦 INVENTAIRE JOURNALIER
// ===================================================
function mountInvJ(){
  const btnSave = qs('#btnSaveInvJ');
  const btnReset = qs('#btnResetInvJ');
  btnSave.addEventListener('click', async ()=>{
    const payload = {
      action:'inventaireJournalier',
      produit: qs('#invjProduit').value,
      qte: qs('#invjQte').value,
      unite: qs('#invjUnite').value,
      type: qs('#invjType')?.value || 'entree'
    };
    await fetch(API_URL, { 
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload),
      mode:'no-cors'
    });
    showToast('📦 Mouvement enregistré');
  });
  btnReset.addEventListener('click', ()=>{
    ['invjProduit','invjQte','invjUnite'].forEach(id=>{ const el=qs('#'+id); if(el) el.value=''; });
  });
}

// ===================================================
// 🏷️ INVENTAIRE MENSUEL
// ===================================================
function mountInvM(){
  populateZones('invmZone');

  qs('#btnInvmGenerate').addEventListener('click', async ()=>{
    const payload = { 
      action:'createInventaireMensuel', 
      zone: qs('#invmZone').value, 
      mois: qs('#invmMois').value 
    };
    await fetch(API_URL, { 
      method:'POST', 
      headers:{'Content-Type':'application/json'}, 
      body: JSON.stringify(payload),
      mode:'no-cors'
    });
    showToast('📄 Feuille générée');
  });

  qs('#btnInvmSave').addEventListener('click', async ()=>{
    const payload = {
      action:'saveInventaireMensuel',
      zone: qs('#invmZone').value,
      mois: qs('#invmMois').value,
      produits: qs('#invmProduit').value,
      quantite: qs('#invmQte').value,
      unite: qs('#invmUnite').value,
      commentaires: qs('#invmComment').value
    };
    await fetch(API_URL, { 
      method:'POST', 
      headers:{'Content-Type':'application/json'}, 
      body: JSON.stringify(payload),
      mode:'no-cors'
    });
    showToast('💾 Ligne enregistrée');
  });
}

// ===================================================
// 🍽️ RECETTES + SETTINGS (inchangés)
// ===================================================
function mountRecettes(){ /* ... identique à v15.1 ... */ }
function mountSettings(){
  qs('#btnSetSave').addEventListener('click', ()=>{
    localStorage.setItem('etab', qs('#setEtab').value);
    localStorage.setItem('tz', qs('#setTz').value);
    localStorage.setItem('emailCC', qs('#setEmail').value);
    localStorage.setItem('lang', qs('#setLang').value);
    showToast('⚙️ Paramètres enregistrés');
  });
}
