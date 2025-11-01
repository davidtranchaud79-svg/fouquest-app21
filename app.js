// Fouquet’s Joy Suite – v14.9 (Gold Motion Premium Sync)
export const API_URL = localStorage.getItem('API_BASE') || "https://script.google.com/macros/s/AKfycbziae5yZmBlCoEiH8xqeY5Ignplw-To47TJsQ6E1ErDkqaashBEryfrcvDre87856GaNw/exec";

const qs = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];

const state = { view:'dashboard' };

if('serviceWorker' in navigator){
  window.addEventListener('load', ()=> navigator.serviceWorker.register('./service-worker.js'));
}

// ---- Status badge ----
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
  badge.title = {
    online: 'Connecté à Google Sheets',
    offline: 'Mode hors-ligne (cache actif)',
    error: 'Erreur de synchronisation',
    synced: 'Synchronisé avec Sheets'
  }[mode] || '';
}

window.addEventListener('online',  ()=> setStatus('online'));
window.addEventListener('offline', ()=> setStatus('offline'));

async function checkConnection(){
  try{
    const r = await fetch(`${API_URL}?action=getEtatStock`, { method:'GET', cache:'no-store' });
    if(!r.ok) throw new Error('HTTP');
    const data = await r.json();
    if(data.status==='success'){ setStatus('online'); return true; }
    setStatus('error'); return false;
  }catch(e){
    setStatus(navigator.onLine ? 'error' : 'offline');
    return false;
  }
}

document.addEventListener('DOMContentLoaded', ()=>{
  qsa('.tab').forEach(btn => btn.addEventListener('click', ()=> render(btn.dataset.view)));
  render('dashboard');
  checkConnection(); // initial ping
  const btn = qs('#btnSync');
  if(btn){
    btn.addEventListener('click', async ()=>{
      const ok = await checkConnection();
      if(ok){
        setStatus('synced');
        setTimeout(()=> setStatus('online'), 2000);
        alert('✅ Synchronisation réussie avec Sheets');
      }else{
        alert('⚠️ Impossible de synchroniser (hors ligne ou erreur Apps Script)');
      }
    });
  }
});

// ---- Views ----
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

// ------------- Dashboard -------------
async function loadEtatStock(){
  const res = await fetch(`${API_URL}?action=getEtatStock`).then(r=>r.json()).catch(()=>({status:'error'}));
  if(res.status==='success'){
    qs('#kpiStock').textContent = '€ ' + (res.valeurTotale||0).toLocaleString('fr-FR');
    qs('#kpiStockQte').textContent = (res.quantiteTotale||0).toLocaleString('fr-FR') + ' unités';
  }else{
    qs('#kpiStock').textContent = '—';
    qs('#kpiStockQte').textContent = '—';
  }
}

async function loadStockDetail(){
  const res = await fetch(`${API_URL}?action=getStockDetail`).then(r=>r.json()).catch(()=>({status:'error'}));
  const tbody = qs('#tableStockDetail tbody'); if(!tbody) return;
  tbody.innerHTML='';
  if(res.status==='success'){
    res.stock.forEach(it=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${it.produit||''}</td>
        <td style="text-align:right">${Number(it.quantite||0)}</td>
        <td>${it.unite||''}</td>
        <td style="text-align:right">${Number(it.prix||0).toFixed(2)}</td>
        <td style="text-align:right">${Number(it.valeur||0).toFixed(2)}</td>
        <td>${it.zone||''}</td>`;
      tbody.appendChild(tr);
    });
  }else{
    tbody.innerHTML = '<tr><td colspan="6">⚠️ Erreur de chargement</td></tr>';
  }
}

function mountDashboard(){
  loadEtatStock();
  loadStockDetail();
  const tbody = qs('#topPertes tbody');
  [['Saumon Label Rouge','6,2 kg','€ 148'],['Beurre AOP','3,0 kg','€ 96'],['Framboise','2,1 kg','€ 74']]
    .forEach(r => { const tr = document.createElement('tr'); r.forEach(c=>{const td=document.createElement('td');td.textContent=c;tr.appendChild(td)}); tbody.appendChild(tr); });
  const ctx = qs('#chartPertes');
  if(ctx && window.Chart){
    new Chart(ctx, { type:'line', data:{ labels:['J-6','J-5','J-4','J-3','J-2','J-1','J'], datasets:[{ label:'Pertes €', data:[50,80,60,120,90,140,110]}] }, options:{ plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} } });
  }
}

// ------------- Zones dynamiques depuis Sheets -------------
// Charge les zones depuis Sheets et les insère dans le <select>
async function loadZones(selectId){
  const sel = document.getElementById(selectId);
  if(!sel) return;

  // Affiche un indicateur pendant le chargement
  sel.innerHTML = '<option>Chargement...</option>';
  const voyant = document.querySelector(`#${selectId}-status`);
  if(voyant) voyant.textContent = '🟠';

  try {
    const res = await fetch(`${API_URL}?action=zonesList`);
    const data = await res.json();

    if (data.status === 'success') {
      sel.innerHTML = data.zones.map(z => `<option value="${z}">${z}</option>`).join('');
      if(voyant) voyant.textContent = '🟢';
    } else {
      sel.innerHTML = '<option>Erreur de chargement</option>';
      if(voyant) voyant.textContent = '🔴';
    }
  } catch (e) {
    sel.innerHTML = '<option>Hors-ligne</option>';
    if(voyant) voyant.textContent = '🔴';
  }
}

// ------------- Pertes -------------
function mountPertes(){
  loadZones('pertesZone');
  qs('#btnSavePerte').addEventListener('click', async ()=>{
    const payload = {
      action:'pertesAdd',
      produit: qs('#pertesProduit').value,
      qte: qs('#pertesQte').value,
      unite: qs('#pertesUnite').value,
      motif: qs('#pertesMotif').value,
      zone: qs('#pertesZone').value,
      comment: qs('#pertesComment').value
    };
    const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()).catch(()=>({status:'error'}));
    alert(res.status==='success' ? 'Perte enregistrée.' : ('Erreur: '+(res.message||'inconnue')));
  });
  qs('#btnResetPerte').addEventListener('click', ()=>{
    ['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesZone','pertesComment'].forEach(id=>{ const el=qs('#'+id); if(el) el.value=''; });
  });
}

// ------------- Inventaire journalier -------------
function mountInvJ(){
  loadZones('invjZone');
  qs('#btnSaveInvJ').addEventListener('click', async ()=>{
    const payload = {
      action:'inventaireJournalier',
      produit: qs('#invjProduit').value,
      qte: qs('#invjQte').value,
      unite: qs('#invjUnite').value,
      zone: qs('#invjZone').value
    };
    const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()).catch(()=>({status:'error'}));
    alert(res.status==='success' ? 'Ajustement enregistré.' : ('Erreur: '+(res.message||'inconnue')));
  });
  qs('#btnResetInvJ').addEventListener('click', ()=>{
    ['invjProduit','invjQte','invjUnite','invjZone'].forEach(id=>{ const el=qs('#'+id); if(el) el.value=''; });
  });
}

// ------------- Inventaire mensuel -------------
function mountInvM(){
  loadZones('invmZone');
  qs('#btnInvmGenerate').addEventListener('click', async ()=>{
    const payload = { action:'createInventaireMensuel', zone: qs('#invmZone').value, mois: qs('#invmMois').value };
    const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()).catch(()=>({status:'error'}));
    alert(res.status==='success' ? 'Feuille générée.' : 'Erreur de génération.');
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
    const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()).catch(()=>({status:'error'}));
    alert(res.status==='success' ? 'Enregistré sur la feuille.' : 'Erreur d’enregistrement.');
  });
  qs('#btnInvmReset').addEventListener('click', ()=>{
    ['invmMois','invmProduit','invmQte','invmUnite','invmComment'].forEach(id=>{ const el=qs('#'+id); if(el) el.value=''; });
  });
}

// ------------- Recettes (amélioré visuel) -------------
async function loadRecettesListe(){
  const res = await fetch(`${API_URL}?action=getRecettes`).then(r=>r.json()).catch(()=>({status:'error'}));
  const list = qs('#recettesList'); const search = qs('#recetteSearch'); let all = [];
  if(res.status==='success'){ all = res.recettes || []; renderRecetteCards(all); }
  search.addEventListener('input', e=>{
    const q = e.target.value.toLowerCase();
    renderRecetteCards(all.filter(r => (r.nom||'').toLowerCase().includes(q)));
  });
}

function renderRecetteCards(items){
  const list = qs('#recettesList'); list.innerHTML = '';
  items.forEach(r=>{
    const card = document.createElement('div');
    card.className='card'; card.style.cursor='pointer';
    card.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div><strong>${r.nom}</strong><br><small>Base ${r.portions} portions</small></div>
      <button class="btn">Voir</button></div>`;
    card.querySelector('button').addEventListener('click', ()=> loadRecetteDetail(r.code));
    list.appendChild(card);
  });
}

async function loadRecetteDetail(code){
  const res = await fetch(`${API_URL}?action=getRecette&code=${encodeURIComponent(code)}`).then(r=>r.json()).catch(()=>({status:'error'}));
  const container = document.getElementById('recetteDetail'); container.innerHTML='';
  if(res.status!=='success'){ container.textContent='⚠️ Recette introuvable.'; return; }
  const r = res.recette;
  container.innerHTML = `<div class="card recette-card">
    <h2 class="recette-title">${r.nom}</h2>
    <div class="recette-meta"><span>Base ${r.portions || 1} portions</span></div>
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
  (r.ingredients||[]).forEach(i=>{
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${i.produit}</td><td data-base="${i.quantite}">${Number(i.quantite).toFixed(2)}</td><td>${i.unite}</td><td>${i.zone||''}</td>`;
    tbody.appendChild(tr);
  });
  document.getElementById('multiInput').addEventListener('input', e=>{
    const m = Number(e.target.value)||1;
    tbody.querySelectorAll('td[data-base]').forEach(td=>{
      const base = Number(td.getAttribute('data-base'));
      td.textContent = (base*m).toFixed(2);
    });
  });
}
function mountRecettes(){ loadRecettesListe(); }

// ------------- Settings -------------
function mountSettings(){
  qs('#btnSetSave').addEventListener('click', ()=>{
    localStorage.setItem('etab', qs('#setEtab').value);
    localStorage.setItem('tz', qs('#setTz').value);
    localStorage.setItem('emailCC', qs('#setEmail').value);
    localStorage.setItem('lang', qs('#setLang').value);
    alert('Paramètres enregistrés.');
  });
}
