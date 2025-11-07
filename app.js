// ===== CONFIG =====
const API_URL = "https://script.google.com/macros/s/AKfycbxWW8OIsd8Gwwk0aP7AYOsB57FpymhIjhY5-ElVCta79WdE-oKJslajMN3MegFE0xLx/exec";

// ===== HELPERS =====
const qs = (s, r=document)=>r.querySelector(s);
const qsa = (s, r=document)=>[...r.querySelectorAll(s)];
function serialize(params){
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k,v])=> u.append(k, v==null?'':String(v)));
  return u.toString();
}
async function api(action, params={}){
  const url = `${API_URL}?${serialize({action, ...params})}`;
  const r = await fetch(url, { method:'GET', cache:'no-store' });
  if(!r.ok) throw new Error('HTTP '+r.status);
  return r.json();
}
function setBadge(state){
  const b = qs('#syncBadge');
  if(!b) return;
  b.textContent = state==='online' ? 'En ligne' : (state==='error'?'Erreur':'Hors ligne');
  b.classList.toggle('offline', state!=='online');
  b.classList.toggle('online', state==='online');
}

// ===== NAV =====
document.addEventListener('DOMContentLoaded', ()=>{
  qsa('.tab').forEach(btn=> btn.addEventListener('click', ()=>{
    qsa('.tab').forEach(b=> b.classList.toggle('active', b===btn));
    render(btn.dataset.view);
  }));
  qs('#btnSync').addEventListener('click', checkConnection);
  render('dashboard');
  checkConnection();
});

async function checkConnection(){
  try{
    // ping simple: on tente un getEtatStock
    const res = await api('getEtatStock');
    setBadge(res.status==='success' ? 'online' : 'error');
  }catch(_){ setBadge('error'); }
}

// ===== RENDER SWITCH =====
async function render(view){
  const tpl = qs(`#tpl-${view}`);
  qs('#app').innerHTML = tpl ? tpl.innerHTML : '<section class="section"><div class="card">Vue indisponible</div></section>';
  if(view==='dashboard') await mountDashboard();
  if(view==='pertes') mountPertes();
  if(view==='invj') await mountInvJ();
  if(view==='invm') await mountInvM();
  if(view==='recettes') await mountRecettes();
  if(view==='settings') mountSettings();
}

// ===== DASHBOARD =====
async function mountDashboard(){
  try{
    const etat = await api('getEtatStock'); // {status, quantiteTotale, valeurTotale}
    if(etat.status==='success'){
      qs('#kpiStock').textContent = `€ ${(etat.valeurTotale||0).toLocaleString('fr-FR')}`;
      qs('#kpiStockQte').textContent = `${(etat.quantiteTotale||0).toLocaleString('fr-FR')} unités`;
    }
  }catch(e){ console.warn('Etat stock', e); }

  try{
    const detail = await api('getStockDetail'); // {status, stock:[{...}]}
    const tbody = qs('#tableStockDetail tbody'); if(!tbody) return;
    tbody.innerHTML = '';
    if(detail.status==='success'){
      detail.stock.forEach(it=>{
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
      tbody.innerHTML = '<tr><td colspan="6">Aucune donnée</td></tr>';
    }
  }catch(e){ console.warn('Stock detail', e); }

  // petit graph placebo (pour l’instant)
  const ctx = qs('#chartPertes');
  if(ctx && window.Chart){
    new Chart(ctx, { type:'line',
      data:{ labels:['J-6','J-5','J-4','J-3','J-2','J-1','J'],
        datasets:[{ label:'Pertes €', data:[50,80,60,120,90,140,110]}] },
      options:{ plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
  }
}

// ===== PERTES =====
async function preloadProduits(datalistId){
  try{
    const d = await api('getStockDetail');
    const dl = qs(`#${datalistId}`);
    if(!dl) return;
    dl.innerHTML = (d.status==='success' ? d.stock : []).map(p=>`<option value="${p.produit}">`).join('');
  }catch(_){}
}
function mountPertes(){
  preloadProduits('dlProduitsPertes');
  qs('#btnSavePerte').addEventListener('click', async ()=>{
    const payload = {
      produit: qs('#pertesProduit').value,
      qte: qs('#pertesQte').value,
      unite: qs('#pertesUnite').value,
      motif: qs('#pertesMotif').value,
      comment: qs('#pertesComment').value
    };
    try{
      const res = await api('pertesAdd', payload);
      alert(res.status==='success' ? '✅ Perte enregistrée' : ('❌ '+(res.message||'Erreur')));
      // reset
      ['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesComment'].forEach(id=> qs('#'+id).value='');
    }catch(e){ alert('❌ Erreur réseau'); }
  });
  qs('#btnResetPerte').addEventListener('click', ()=>{
    ['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesComment'].forEach(id=> qs('#'+id).value='');
  });
}

// ===== INVENTAIRE JOURNALIER =====
async function mountInvJ(){
  // produits dynamiques
  preloadProduits('dlProduitsInvJ');
  qs('#btnInvJEntree').addEventListener('click', ()=> handleInvJ('entree'));
  qs('#btnInvJSortie').addEventListener('click', ()=> handleInvJ('sortie'));
  qs('#btnResetInvJ').addEventListener('click', ()=> ['invjProduit','invjQte','invjUnite'].forEach(id=>qs('#'+id).value=''));
}
async function handleInvJ(type){
  const payload = {
    produit: qs('#invjProduit').value,
    qte: qs('#invjQte').value,
    unite: qs('#invjUnite').value,
    type
  };
  try{
    const res = await api('inventaireJournalier', payload);
    alert(res.status==='success' ? '✅ Mouvement enregistré' : ('❌ '+(res.message||'Erreur')));
    ['invjProduit','invjQte','invjUnite'].forEach(id=>qs('#'+id).value='');
  }catch(e){ alert('❌ Erreur réseau'); }
}

// ===== INVENTAIRE MENSUEL =====
async function mountInvM(){
  // zones dynamiques
  try{
    const z = await api('zonesList'); // {status, zones:[...]}
    const sel = qs('#invmZone');
    sel.innerHTML = (z.status==='success' ? z.zones : []).map(v=>`<option>${v}</option>`).join('');
  }catch(_){}

  // produits dynamiques
  preloadProduits('dlProduitsInvM');

  qs('#btnInvmGenerate').addEventListener('click', async ()=>{
    const payload = { zone: qs('#invmZone').value, mois: qs('#invmMois').value };
    try{
      const res = await api('createInventaireMensuel', payload);
      alert(res.status==='success' ? '✅ Feuille créée' : ('❌ '+(res.message||'Erreur')));
    }catch(e){ alert('❌ Erreur réseau'); }
  });

  qs('#btnInvmSave').addEventListener('click', async ()=>{
    const payload = {
      zone: qs('#invmZone').value,
      mois: qs('#invmMois').value,
      produits: qs('#invmProduit').value,
      quantite: qs('#invmQte').value,
      unite: qs('#invmUnite').value,
      commentaires: qs('#invmComment').value
    };
    try{
      const res = await api('saveInventaireMensuel', payload);
      alert(res.status==='success' ? '✅ Ligne enregistrée' : ('❌ '+(res.message||'Erreur')));
      // reset léger
      ['invmProduit','invmQte','invmUnite','invmComment'].forEach(id=>qs('#'+id).value='');
    }catch(e){ alert('❌ Erreur réseau'); }
  });

  qs('#btnInvmReset').addEventListener('click', ()=>{
    ['invmMois','invmProduit','invmQte','invmUnite','invmComment'].forEach(id=>qs('#'+id).value='');
  });
}

// ===== RECETTES =====
async function mountRecettes(){
  try{
    const res = await api('getRecettes'); // {status, recettes:[{code,nom,categorie,portions,commentaire}]}
    const list = qs('#recettesList');
    if(res.status==='success'){
      list.innerHTML = res.recettes.map(r=>`
        <div class="card recette-card" data-code="${r.code}">
          <div><strong>${r.nom}</strong><div class="muted">${r.categorie||''} • base ${r.portions||1} p.</div></div>
          <button class="btn ghost">Voir</button>
        </div>`).join('');
      qsa('.recette-card', list).forEach(div=>{
        div.querySelector('button').addEventListener('click', ()=> loadRecette(div.dataset.code));
      });
      qs('#recetteSearch').addEventListener('input', (e)=>{
        const q = e.target.value.toLowerCase();
        qsa('.recette-card', list).forEach(c=>{
          const name = c.querySelector('strong').textContent.toLowerCase();
          c.style.display = name.includes(q) ? '' : 'none';
        });
      });
    }else{
      list.innerHTML = '<div class="muted">Aucune recette.</div>';
    }
  }catch(_){}
}
async function loadRecette(code){
  const d = qs('#recetteDetail'); d.innerHTML = '';
  try{
    const r = await api('getRecette', {code});
    if(r.status!=='success'){ d.textContent='Recette introuvable.'; return; }
    const rec = r.recette;
    d.innerHTML = `
      <div class="card">
        <h3>${rec.nom}</h3>
        <div class="muted">Base ${rec.portions||1} portions</div>
        <div class="input-field" style="max-width:180px;margin:10px 0;">
          <label>Multiplier</label>
          <input id="multiInput" type="number" value="1" min="0.1" step="0.5">
        </div>
        <table class="list">
          <thead><tr><th>Produit</th><th>Qté</th><th>Unité</th><th>Zone</th></tr></thead>
          <tbody>${(rec.ingredients||[]).map(i=>`
            <tr><td>${i.produit}</td><td data-base="${i.quantite}">${Number(i.quantite).toFixed(2)}</td><td>${i.unite}</td><td>${i.zone||''}</td></tr>`).join('')}
          </tbody>
        </table>
      </div>`;
    qs('#multiInput').addEventListener('input', e=>{
      const m = Number(e.target.value)||1;
      qsa('td[data-base]', d).forEach(td=>{
        const base = Number(td.getAttribute('data-base'));
        td.textContent = (base*m).toFixed(2);
      });
    });
  }catch(_){ d.textContent='Erreur de chargement.'; }
}

// ===== SETTINGS =====
function mountSettings(){
  qs('#btnSetSave').addEventListener('click', ()=>{
    localStorage.setItem('etab', qs('#setEtab').value);
    localStorage.setItem('tz', qs('#setTz').value);
    localStorage.setItem('emailCC', qs('#setEmail').value);
    localStorage.setItem('lang', qs('#setLang').value);
    alert('Paramètres enregistrés.');
  });
}
