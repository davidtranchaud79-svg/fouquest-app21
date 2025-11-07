// ============================================================
// 🍷 Fouquet’s Joy — Gold Motion v15.8
// Frontend aligné avec code.gs v15.7
// ============================================================

// ===== CONFIG =====
const API_URL = "https://script.google.com/macros/s/AKfycbxCb6ro57HyI-EF2g0dCEwArHojyrsCvL-x9x2cWTJwC3V8Z6kWsBHaF0qk2jwVG7Yx/exec";

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
    const data = await r.json();
    return data;
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
  try{
    const res = await api('ping');
    setBadge(res.status==='success' ? 'online' : 'error');
  }catch(_){ setBadge('error'); }
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

  try{
    const detail = await api('getStockDetail');
    const tbody = qs('#tableStockDetail tbody');
    if(!tbody) return;
    tbody.innerHTML = '';
    if(detail.status==='success' || Array.isArray(detail)){
      const stockList = detail.stock || detail; // compatible avec ton code.gs
      stockList.forEach(it=>{
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

  const ctx = qs('#chartPertes');
  if(ctx && window.Chart){
    new Chart(ctx, {
      type:'bar',
      data:{
        labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
        datasets:[{ label:'Pertes €', data:[50,80,60,120,90,140,110], backgroundColor:'#C9A227' }]
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

// ===== INVENTAIRE MENSUEL – Tableau dynamique =====
async function mountInvM() {
  const zoneSelect = qs('#invmZone');
  const moisInput = qs('#invmMois');
  const tableContainer = document.createElement('div');
  tableContainer.className = 'card';
  qs('#app section').appendChild(tableContainer);

  // zones dynamiques
  try {
    const z = await api('zonesList');
    zoneSelect.innerHTML = (z.status==='success' ? z.zones : []).map(v=>`<option>${v}</option>`).join('');
  } catch(e) { zoneSelect.innerHTML = '<option>Général</option>'; }

  // produits dynamiques
  let produits = [];
  try {
    const d = await api('getStockDetail');
    produits = (d.status==='success' ? d.stock.map(p=>p.produit) : []);
  } catch(_){}

  // structure du tableau
  tableContainer.innerHTML = `
    <div class="card-title">📋 Inventaire – ${zoneSelect.value || 'Zone'} ${moisInput.value || ''}</div>
    <table class="list" id="invTable">
      <thead><tr><th>Produit</th><th>Quantité</th><th>Unité</th><th>Commentaire</th><th></th></tr></thead>
      <tbody></tbody>
    </table>
    <div class="row-actions">
      <button class="btn ghost" id="btnAddRow">➕ Ajouter une ligne</button>
      <button class="btn" id="btnSaveInv">💾 Valider l’inventaire</button>
      <button class="btn" id="btnGenSheet">📄 Générer la feuille</button>
    </div>
  `;

  const tbody = tableContainer.querySelector('tbody');

  // Fonction pour ajouter une ligne de saisie
  function addRow(produit='', qte='', unite='', comment='') {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input list="dlProduitsInvM" value="${produit}" placeholder="Produit"></td>
      <td><input type="number" step="0.01" value="${qte}" placeholder="0.00"></td>
      <td><input value="${unite}" placeholder="kg / L / pcs"></td>
      <td><input value="${comment}" placeholder="Commentaire"></td>
      <td><button class="btn danger small">✖</button></td>
    `;
    tr.querySelector('button').addEventListener('click', ()=> tr.remove());
    tbody.appendChild(tr);
  }

  // ajouter au moins une ligne par défaut
  addRow();

  // gestion des boutons
  qs('#btnAddRow').addEventListener('click', ()=> addRow());

  qs('#btnGenSheet').addEventListener('click', async ()=>{
    const payload = { zone: zoneSelect.value, mois: moisInput.value };
    try {
      const res = await api('createInventaireMensuel', payload);
      alert(res.status==='success' ? '✅ Feuille créée' : res.message);
    } catch(e){ alert('❌ Erreur de génération'); }
  });

  qs('#btnSaveInv').addEventListener('click', async ()=>{
    const lignes = [];
    qsa('tbody tr', tableContainer).forEach(tr=>{
      const [p,q,u,c] = qsa('input', tr).map(i=>i.value);
      if(p && q) lignes.push({produit:p, qte:q, unite:u, comment:c});
    });

    if(!lignes.length) return alert('Aucune ligne saisie.');
    const payload = {
      zone: zoneSelect.value,
      mois: moisInput.value,
      lignes: JSON.stringify(lignes)
    };
    try {
      const res = await api('saveInventaireMensuelBatch', payload);
      alert(res.status==='success' ? '✅ Inventaire enregistré' : res.message);
    } catch(e){ alert('❌ Erreur réseau'); }
  });
}

// ===== RECETTES =====
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
        </div>
      `).join('');

      qsa('.recette-card', list).forEach(card=>{
        card.addEventListener('click', async ()=>{
          const detail = card.querySelector('.recette-detail');

          // toggle : referme si déjà ouvert
          if(detail.style.display==='block'){
            detail.style.display='none';
            detail.innerHTML='';
            return;
          }

          // referme les autres
          qsa('.recette-detail').forEach(d=>{
            d.style.display='none';
            d.innerHTML='';
          });

          // charge la recette
          detail.innerHTML = '<div class="muted">Chargement...</div>';
          detail.style.display='block';

          try{
            const r = await api('getRecette', {code: card.dataset.code});
            if(r.status!=='success'){ 
              detail.innerHTML = '<div class="muted">Recette introuvable.</div>'; 
              return;
            }
            const rec = r.recette;
            detail.innerHTML = `
              <div class="recette-body">
                <table class="list mini">
                  <thead><tr><th>Produit</th><th>Qté</th><th>Unité</th><th>Zone</th></tr></thead>
                  <tbody>
                    ${(rec.ingredients||[]).map(i=>`
                      <tr>
                        <td>${i.produit}</td>
                        <td>${Number(i.quantite).toFixed(2)}</td>
                        <td>${i.unite}</td>
                        <td>${i.zone||''}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>`;
          }catch(e){
            detail.innerHTML = '<div class="muted">Erreur de chargement.</div>';
          }
        });
      });

      // 🔍 Recherche instantanée
      qs('#recetteSearch').addEventListener('input', e=>{
        const q = e.target.value.toLowerCase();
        qsa('.recette-card', list).forEach(c=>{
          const name = c.querySelector('strong').textContent.toLowerCase();
          c.style.display = name.includes(q) ? '' : 'none';
        });
      });
    }else{
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
