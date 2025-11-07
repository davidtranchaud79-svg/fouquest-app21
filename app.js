// ============================================================
// 🍷 Fouquet’s Joy — Gold Motion v16.1.2
// Frontend aligné avec code.gs v16.1 (pertes en kg) + fix Inventaire M
// ============================================================

// ===== CONFIG =====
const API_URL = "https://script.google.com/macros/s/AKfycbyMppxq_f0XzgvR68hNbjxAkpW506xEvG5Oaxj9kysqGI6G_E1e-Ft9g2rhHCmf8bFw/exec";

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
  try {
    const r = await fetch(url, { method:'GET', cache:'no-store' });
    if(!r.ok) throw new Error('HTTP '+r.status);
    return await r.json();
  } catch(e) {
    console.error("Erreur API", e);
    return { status:"error", message:e.message };
  }
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
  const res = await api('ping');
  setBadge(res.status==='success' ? 'online' : 'error');
}

// ===== RENDER =====
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

// ============================================================
// 📊 DASHBOARD
// ============================================================
async function mountDashboard(){
  try{
    const etat = await api('getEtatStock');
    if(etat.status==='success'){
      qs('#kpiStock').textContent = `€ ${(etat.valeurTotale||0).toLocaleString('fr-FR')}`;
      qs('#kpiStockQte').textContent = `${(etat.quantiteTotale||0).toLocaleString('fr-FR')} unités`;
    }
  }catch(e){ console.warn('Etat stock', e); }

  try {
    const pertes = await api('getPertesPoids');
    if(pertes.status === 'success'){
      qs('#kpiPertes').textContent = `${(pertes.pertesKg || 0).toFixed(2)} kg`;
      const lab = qs('#kpiPertesLabel'); if (lab) lab.textContent = "Poids total des pertes (kg)";
    }
  } catch(e){ /* silencieux */ }

  try{
    const detail = await api('getStockDetail');
    const tbody = qs('#tableStockDetail tbody');
    if(!tbody) return;
    const stockList = detail.stock || detail;
    tbody.innerHTML = '';
    (Array.isArray(stockList) ? stockList : []).forEach(it=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${it.produit||''}</td>
        <td style="text-align:right">${Number(it.quantite||0)}</td>
        <td>${it.unite||''}</td>
        <td style="text-align:right">${Number(it.prix||0).toFixed(2)}</td>
        <td style="text-align:right">${Number(it.valeur||0).toFixed(2)}</td>
        <td>${it.zone||''}</td>`;
      tbody.appendChild(tr);
    });
  }catch(e){ console.warn('Stock detail', e); }

  const ctx = qs('#chartPertes');
  if(ctx && window.Chart){
    new Chart(ctx, {
      type:'bar',
      data:{
        labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
        datasets:[{ label:'Pertes (kg)', data:[4,5.5,3,6.2,4.8,7.1,5.6] }]
      },
      options:{ plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
    });
  }
}

// ============================================================
// 🗑️ PERTES
// ============================================================
async function preloadProduits(datalistId){
  try{
    const d = await api('getStockDetail');
    const dl = qs(`#${datalistId}`);
    if(!dl) return;
    const stockList = d.stock || d;
    dl.innerHTML = (Array.isArray(stockList) ? stockList.map(p=>`<option value="${p.produit}">`).join('') : '');
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
    const res = await api('pertesAdd', payload);
    alert(res.status==='success' ? '✅ Perte enregistrée' : ('❌ '+(res.message||'Erreur')));
    ['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesComment'].forEach(id=>qs('#'+id).value='');
  });
  qs('#btnResetPerte').addEventListener('click', ()=>['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesComment'].forEach(id=>qs('#'+id).value=''));
}

// ============================================================
// 📦 INVENTAIRE JOURNALIER
// ============================================================
async function mountInvJ(){
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
  const res = await api('inventaireJournalier', payload);
  alert(res.status==='success' ? '✅ Mouvement ajouté' : ('❌ '+(res.message||'Erreur')));
  ['invjProduit','invjQte','invjUnite'].forEach(id=>qs('#'+id).value='');
}

// ============================================================
// 🧾 INVENTAIRE MENSUEL — version simplifiée et propre
// ============================================================
async function mountInvM() {
  const section = qs('#app section');

  // Charger les zones depuis Sheets
  let zones = [];
  try {
    const z = await api('zonesList');
    zones = (z.status === 'success' ? z.zones : []);
  } catch { zones = ['Général']; }

  // Charger les produits disponibles
  let produits = [];
  try {
    const d = await api('getStockDetail');
    produits = (d.status === 'success' ? d.stock.map(p => p.produit) : []);
  } catch {}

  // Structure unique et lisible
  section.innerHTML = `
    <div class="card invm-header">
      <div class="card-title">📦 Inventaire Mensuel</div>
      <div class="grid" style="align-items:end;">
        <div class="input-field">
          <label>Zone</label>
          <select id="invmZone">${zones.map(z=>`<option>${z}</option>`).join('')}</select>
        </div>
        <div class="input-field">
          <label>Mois</label>
          <input type="month" id="invmMois" value="${new Date().toISOString().slice(0,7)}"/>
        </div>
        <div class="input-field">
          <button class="btn" id="btnGenSheet">📄 Générer la feuille</button>
        </div>
      </div>
    </div>

    <div class="card invm-body">
      <div class="card-title">📋 Feuille d’inventaire</div>
      <table class="list" id="invTable">
        <thead><tr><th>Produit</th><th>Quantité</th><th>Unité</th><th>Commentaire</th><th></th></tr></thead>
        <tbody></tbody>
      </table>
      <div class="row-actions center">
        <button class="btn ghost" id="btnAddRow">➕ Ajouter une ligne</button>
        <button class="btn success" id="btnSaveInv">💾 Valider l’inventaire</button>
      </div>
    </div>

    <datalist id="dlProduitsInvM">
      ${produits.map(p => `<option value="${p}">`).join('')}
    </datalist>
  `;

  const tbody = qs('#invTable tbody');

  // === Ajouter une ligne ===
  function addRow(p = '', q = '', u = '', c = '') {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input list="dlProduitsInvM" value="${p}" placeholder="Produit"></td>
      <td><input type="number" step="0.01" value="${q}" placeholder="0.00"></td>
      <td><input value="${u}" placeholder="kg / L / pcs"></td>
      <td><input value="${c}" placeholder="Commentaire"></td>
      <td><button class="btn danger small" type="button">✖</button></td>`;
    tr.querySelector('button').addEventListener('click', ()=> tr.remove());
    tbody.appendChild(tr);
  }
  addRow();

  // === Bouton Ajouter ===
  qs('#btnAddRow').addEventListener('click', ()=> addRow());

  // === Générer la feuille ===
  qs('#btnGenSheet').addEventListener('click', async ()=>{
    const res = await api('createInventaireMensuel', {
      zone: qs('#invmZone').value,
      mois: qs('#invmMois').value
    });
    alert(res.status==='success' ? '✅ Feuille générée' : '❌ ' + res.message);
  });

  // === Valider l’inventaire ===
  qs('#btnSaveInv').addEventListener('click', async ()=>{
    const lignes = [];
    qsa('#invTable tbody tr').forEach(tr=>{
      const [p,q,u,c] = qsa('input', tr).map(i=>i.value);
      if(p && q) lignes.push({produit:p, qte:q, unite:u, comment:c});
    });
    if(!lignes.length) return alert('Aucune ligne saisie.');
    const res = await api('saveInventaireMensuelBatch', {
      zone: qs('#invmZone').value,
      mois: qs('#invmMois').value,
      lignes: JSON.stringify(lignes)
    });
    alert(res.status==='success' ? '✅ Inventaire enregistré' : '❌ ' + (res.message||'Erreur'));
    if (res.status==='success') tbody.innerHTML = '', addRow(); // réinitialise proprement
  });
}

// ============================================================
// 🍽️ RECETTES (affichage inline)
// ============================================================
async function mountRecettes(){
  try{
    const res = await api('getRecettes');
    const list = qs('#recettesList');
    if(res.status==='success'){
      list.innerHTML = res.recettes.map(r=>`
        <div class="card recette-card" data-code="${r.code}">
          <div class="recette-header">
            <strong>${r.nom}</strong>
            <div class="muted">${r.categorie||''} • base ${r.portions||1} p.</div>
          </div>
          <div class="recette-detail" style="display:none;"></div>
        </div>`).join('');
      qsa('.recette-card', list).forEach(card=>{
        card.addEventListener('click', async ()=>{
          const detail = card.querySelector('.recette-detail');
          if(detail.style.display==='block'){ detail.style.display='none'; detail.innerHTML=''; return; }
          qsa('.recette-detail').forEach(d=>{d.style.display='none'; d.innerHTML='';});
          detail.innerHTML = '<div class="muted">Chargement...</div>'; detail.style.display='block';
          const r = await api('getRecette', {code: card.dataset.code});
          if(r.status!=='success'){ detail.innerHTML='<div class="muted">Recette introuvable.</div>'; return; }
          const rec = r.recette;
          detail.innerHTML = `
            <div class="recette-body">
              <table class="list mini">
                <thead><tr><th>Produit</th><th>Qté</th><th>Unité</th><th>Zone</th></tr></thead>
                <tbody>${(rec.ingredients||[]).map(i=>`
                  <tr><td>${i.produit}</td><td>${Number(i.quantite).toFixed(2)}</td><td>${i.unite}</td><td>${i.zone||''}</td></tr>`).join('')}
                </tbody>
              </table>
            </div>`;
        });
      });
      qs('#recetteSearch').addEventListener('input', e=>{
        const q = e.target.value.toLowerCase();
        qsa('.recette-card', list).forEach(c=>{
          const name = c.querySelector('strong').textContent.toLowerCase();
          c.style.display = name.includes(q) ? '' : 'none';
        });
      });
    } else {
      list.innerHTML = '<div class="muted">Aucune recette.</div>';
    }
  }catch(e){
    qs('#recettesList').innerHTML = '<div class="muted">Erreur de chargement.</div>';
  }
}

// ============================================================
// ⚙️ PARAMÈTRES
// ============================================================
function mountSettings(){
  qs('#btnSetSave').addEventListener('click', ()=>{
    localStorage.setItem('etab', qs('#setEtab').value);
    localStorage.setItem('tz', qs('#setTz').value);
    localStorage.setItem('emailCC', qs('#setEmail').value);
    localStorage.setItem('lang', qs('#setLang').value);
    alert('Paramètres enregistrés ✅');
  });
}
