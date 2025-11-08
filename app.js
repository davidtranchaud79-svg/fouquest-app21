// ============================================================
// 🍷 Fouquet’s Joy — Gold Motion v17.1
// Frontend aligné avec code.gs (Pareto pertes + unités auto + multiplicateur recettes)
// ============================================================

// ===== CONFIG =====
const API_URL = "https://script.google.com/macros/s/AKfycbxqh8yvag7cBGZ34zza181fpWV2TssYeQIIqUEd5ZI91knMY5jSK6sUP0QDEULfh12a/exec";

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

// ===== NAVIGATION =====
document.addEventListener('DOMContentLoaded', ()=>{
  qsa('.tab').forEach(btn=> btn.addEventListener('click', ()=>{
    qsa('.tab').forEach(b=> b.classList.toggle('active', b===btn));
    render(btn.dataset.view);
  }));
  const syncBtn = qs('#btnSync'); if (syncBtn) syncBtn.addEventListener('click', checkConnection);
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
// 📊 DASHBOARD – Pareto pertes + bascule simple
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
  } catch(e){}

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
  const legendContainer = qs('#pertesLegend');
  const toggle = qs('#togglePareto');
  if (!ctx || !window.Chart) return;

  const simpleConfig = {
    type:'bar',
    data:{
      labels:['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'],
      datasets:[{ label:'Pertes (kg)', data:[4,5.5,3,6.2,4.8,7.1,5.6] }]
    },
    options:{ plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  };

  let chart;
  function renderSimple(){
    if(chart) chart.destroy();
    chart = new Chart(ctx, simpleConfig);
    if (legendContainer) legendContainer.innerHTML = '';
  }

  async function renderPareto(){
    if(chart) chart.destroy();
    try {
      const pertesParProduit = await api('getPertesParProduit');
      if (pertesParProduit.status !== 'success') { renderSimple(); return; }
      const pertes = pertesParProduit.pertes || [];
      if (!pertes.length) {
        ctx.replaceWith("Aucune perte ce mois-ci 🎉");
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
        data: { labels, datasets: [
          { label:'Pertes (kg)', data:dataVals, yAxisID:'y', borderWidth:1, borderRadius:6 },
          { label:'Cumul (%)', data:cumulPct, type:'line', yAxisID:'y1', tension:0.3 }
        ]},
        options: {
          plugins: {
            legend: { position:'bottom' },
            title: { display:true, text:'Pareto des pertes (Top 10 produits)' }
          },
          scales: {
            y: { beginAtZero:true, title:{display:true,text:'Pertes (kg)'} },
            y1:{ beginAtZero:true, position:'right', min:0, max:100, grid:{drawOnChartArea:false},
                 ticks:{ callback:v=>v+'%' }, title:{display:true,text:'Cumul %'} }
          }
        }
      });
      if (legendContainer) {
        legendContainer.innerHTML = `
          <div class="card muted" style="margin-top:1rem">
            ${top.map((p,i)=>{
              const pct = ((p.qte/total)*100).toFixed(1);
              return `<div style="display:flex;justify-content:space-between;">
                        <span>${i+1}. ${p.produit}</span>
                        <span><b>${p.qte.toFixed(2)} kg</b> <small>(${pct}%)</small></span>
                      </div>`;
            }).join('')}
            <hr>
            <div style="text-align:right;font-weight:bold;">Total : ${total.toFixed(2)} kg</div>
          </div>`;
      }
    } catch(e){ console.warn('Graph Pareto', e); renderSimple(); }
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
      produit: qs('#pertesProduit').value.trim(),
      qte: qs('#pertesQte').value,
      unite: qs('#pertesUnite').value.trim(),
      motif: qs('#pertesMotif').value.trim(),
      comment: qs('#pertesComment').value.trim()
    };
    if(!payload.produit || !payload.qte) return alert('Produit + quantité requis.');
    const res = await api('pertesAdd', payload);
    alert(res.status==='success' ? '✅ Perte enregistrée' : ('❌ '+(res.message||'Erreur')));
    ['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesComment'].forEach(id=>qs('#'+id).value='');
  });
  qs('#btnResetPerte').addEventListener('click', ()=>['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesComment'].forEach(id=>qs('#'+id).value=''));
}

// ============================================================
// 📦 INVENTAIRE JOURNALIER (unités auto depuis Sheets)
// ============================================================
let produitsUnites = [];
async function mountInvJ(){
  try {
    const d = await api('getProduitsEtUnites');
    produitsUnites = (d.status === 'success' ? d.produits : []);
    const dl = qs('#dlProduitsInvJ');
    if(dl) dl.innerHTML = produitsUnites.map(p=>`<option value="${p.produit}">`).join('');
  } catch(e){ console.warn('Produits non chargés', e); }

  const inputProduit = qs('#invjProduit');
  const inputUnite = qs('#invjUnite');

  if(inputProduit){
    inputProduit.addEventListener('input', ()=>{
      const val = inputProduit.value.trim().toLowerCase();
      const found = produitsUnites.find(p=>p.produit.trim().toLowerCase() === val);
      if(found){
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

  qs('#btnInvJEntree').addEventListener('click', ()=> handleInvJ('entree'));
  qs('#btnInvJSortie').addEventListener('click', ()=> handleInvJ('sortie'));
  qs('#btnResetInvJ').addEventListener('click', ()=> ['invjProduit','invjQte','invjUnite'].forEach(id=>qs('#'+id).value=''));
}
async function handleInvJ(type){
  const produit = qs('#invjProduit').value.trim();
  const qte = qs('#invjQte').value;
  const unite = qs('#invjUnite').value.trim();
  if(!produit || !qte) return alert('Veuillez remplir le produit et la quantité.');
  const res = await api('inventaireJournalier', { produit, qte, unite, type });
  alert(res.status==='success' ? `✅ ${type==="entree"?"Entrée":"Sortie"} enregistrée` : '❌ ' + (res.message||'Erreur'));
  ['invjProduit','invjQte','invjUnite'].forEach(id=>qs('#'+id).value='');
  qs('#invjUnite').removeAttribute('readonly');
  qs('#invjUnite').classList.remove('locked');
}

// ============================================================
// 🧾 INVENTAIRE MENSUEL
// ============================================================
async function mountInvM() {
  const section = qs('#app section');
  let zones = [];
  try {
    const z = await api('zonesList');
    zones = (z.status === 'success' ? z.zones : []);
  } catch { zones = ['Général']; }

  let produits = [];
  try {
    const d = await api('getStockDetail');
    produits = (d.status === 'success' ? d.stock.map(p => p.produit) : []);
  } catch {}

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
          <button class="btn gold" id="btnGenSheet">📄 Générer la feuille</button>
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

  qs('#btnAddRow').addEventListener('click', ()=> addRow());
  qs('#btnGenSheet').addEventListener('click', async ()=>{
    const res = await api('createInventaireMensuel', {
      zone: qs('#invmZone').value,
      mois: qs('#invmMois').value
    });
    alert(res.status==='success' ? '✅ Feuille générée' : '❌ ' + res.message);
  });
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
    if (res.status==='success') tbody.innerHTML = '', addRow();
  });
}

// ============================================================
// 🍽️ RECETTES — multiplicateur de portions
// ============================================================
let recetteCache = {};

async function mountRecettes(){
  try{
    const res = await api('getRecettes');
    const list = qs('#recettesList');
    const factorInput = qs('#recetteFactor');
    const applyBtn = qs('#btnApplyFactor');

    const applyFactorToOpen = ()=>{
      const factor = Math.max(0, parseFloat(factorInput?.value || '1') || 1);
      qsa('.recette-card.open').forEach(card=>{
        const code = card.dataset.code;
        const cache = recetteCache[code];
        if (cache?.recette) renderRecetteDetailInCard(card, cache.recette, factor);
      });
    };
    if (applyBtn) applyBtn.onclick = applyFactorToOpen;
    if (factorInput) factorInput.addEventListener('input', applyFactorToOpen);

    if(res.status==='success'){
      list.innerHTML = res.recettes.map(r=>`
        <div class="card recette-card" data-code="${r.code}">
          <div class="recette-header" style="display:flex;justify-content:space-between;gap:8px;align-items:center">
            <div>
              <strong>${r.nom}</strong>
              <div class="muted">${r.categorie||''} • base ${r.portions||1} p.</div>
            </div>
            <button class="btn ghost small">Voir</button>
          </div>
          <div class="recette-detail" style="display:none;"></div>
        </div>`).join('');

      qsa('.recette-card', list).forEach(card=>{
        const btn = card.querySelector('.btn.small');
        btn.addEventListener('click', async (ev)=>{
          ev.stopPropagation();
          const detail = card.querySelector('.recette-detail');
          if(detail.style.display==='block'){
            detail.style.display='none'; detail.innerHTML=''; card.classList.remove('open'); btn.textContent='Voir'; return;
          }
          qsa('.recette-detail').forEach(d=>{d.style.display='none'; d.innerHTML=''; d.parentElement.classList.remove('open');});
          qsa('.recette-card .btn.small').forEach(b=> b.textContent='Voir');

          detail.innerHTML = '<div class="muted">Chargement...</div>'; detail.style.display='block'; card.classList.add('open'); btn.textContent='Fermer';

          const code = card.dataset.code;
          if (!recetteCache[code]) {
            const r = await api('getRecette', {code});
            if(r.status!=='success'){ detail.innerHTML='<div class="muted">Recette introuvable.</div>'; return; }
            recetteCache[code] = { recette: r.recette };
          }
          const factor = Math.max(0, parseFloat(qs('#recetteFactor')?.value || '1') || 1);
          renderRecetteDetailInCard(card, recetteCache[code].recette, factor);
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
      qs('#recettesList').innerHTML = '<div class="muted">Aucune recette.</div>';
    }
  }catch(e){
    qs('#recettesList').innerHTML = '<div class="muted">Erreur de chargement.</div>';
  }
}

function renderRecetteDetailInCard(card, recette, factor){
  const detail = card.querySelector('.recette-detail');
  const basePortions = Number(recette.portions || 1);
  const factorNum = Math.max(0, parseFloat(factor) || 1);
  const totalPortions = basePortions * factorNum;

  const rows = (recette.ingredients || []).map(i => {
    const q = Number(i.quantite) || 0;
    const scaled = q * factorNum;
    return `<tr>
      <td>${i.produit}</td>
      <td style="text-align:right">${scaled.toFixed(2)}</td>
      <td>${i.unite}</td>
      <td>${i.zone || ''}</td>
    </tr>`;
  }).join('');

  detail.innerHTML = `
    <div class="recette-body">
      <div class="muted" style="margin-bottom:6px">
        Base : ${basePortions} p. • Multiplicateur : <b>${factorNum}</b> → Total : <b>${totalPortions.toFixed(1)} p.</b>
      </div>
      <table class="list mini">
        <thead><tr><th>Produit</th><th>Qté</th><th>Unité</th><th>Zone</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

// ============================================================
// ⚙️ PARAMÈTRES
// ============================================================
function mountSettings(){
  const etab = localStorage.getItem('etab') || '';
  const tz = localStorage.getItem('tz') || 'Europe/Paris';
  const email = localStorage.getItem('emailCC') || '';
  const lang = localStorage.getItem('lang') || 'fr';
  if (qs('#setEtab')) qs('#setEtab').value = etab;
  if (qs('#setTz')) qs('#setTz').value = tz;
  if (qs('#setEmail')) qs('#setEmail').value = email;
  if (qs('#setLang')) qs('#setLang').value = lang;

  qs('#btnSetSave').addEventListener('click', ()=>{
    localStorage.setItem('etab', qs('#setEtab').value);
    localStorage.setItem('tz', qs('#setTz').value);
    localStorage.setItem('emailCC', qs('#setEmail').value);
    localStorage.setItem('lang', qs('#setLang').value);
    alert('Paramètres enregistrés ✅');
  });
}
