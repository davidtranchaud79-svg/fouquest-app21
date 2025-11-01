// Fouquet’s Joy Suite – v15.0 (Gold Motion Premium – Zones sur Inventaire Mensuel)
export const API_URL = localStorage.getItem('API_BASE') || "https://script.google.com/macros/s/AKfycbw9YtrIwgaRg5nkaofUMRrPPmmvnVq7NFX3tCPM2aTIs46iGAOm0hOFkbjsoBIg9l7_Sg/exec";

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

// ------------- Pertes (simplifiées) -------------
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
    const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()).catch(()=>({status:'error'}));
    alert(res.status==='success' ? 'Perte enregistrée.' : ('Erreur: '+(res.message||'inconnue')));
  });
  qs('#btnResetPerte').addEventListener('click', ()=>{
    ['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesComment'].forEach(id=>{ const el=qs('#'+id); if(el) el.value=''; });
  });
}

// ------------- Inventaire journalier (sans zone) -------------
function mountInvJ(){
  qs('#btnSaveInvJ').addEventListener('click', async ()=>{
    const payload = {
      action:'inventaireJournalier',
      produit: qs('#invjProduit').value,
      qte: qs('#invjQte').value,
      unite: qs('#invjUnite').value
    };
    const res = await fetch(API_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }).then(r=>r.json()).catch(()=>({status:'error'}));
    alert(res.status==='success' ? 'Ajustement enregistré.' : ('Erreur: '+(res.message||'inconnue')));
  });
  qs('#btnResetInvJ').addEventListener('click', ()=>{
    ['invjProduit','invjQte','invjUnite'].forEach(id=>{ const el=qs('#'+id); if(el) el.value=''; });
  });
}

// ------------- Inventaire mensuel (avec zone dynamique) -------------
async function loadZones(selectId){
  const sel = document.getElementById(selectId);
  if(!sel) return;
  sel.innerHTML = '<option>Chargement...</option>';
  try {
    const res = await fetch(`${API_URL}?action=zonesList`);
    const data = await res.json();
    if (data.status === 'success') {
      sel.innerHTML = data.zones.map(z => `<option value="${z}">${z}</option>`).join('');
    } else {
      sel.innerHTML = '<option>Erreur de chargement</option>';
    }
  } catch {
    sel.innerHTML = '<option>Hors-ligne</option>';
  }
}

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

// ------------- Recettes -------------
function mountRecettes(){ /* inchangé */ }

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
