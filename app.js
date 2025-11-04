// =====================================================
// 🍷 Fouquet’s Suite — app.js (v15 JSONP Safe)
// - appels JSONP => pas de CORS
// - boutons Entrée / Sortie en inventaire journalier
// - reset auto des formulaires perte & invJ
// =====================================================

const API_BASE = localStorage.getItem('API_BASE')
  || "https://script.google.com/macros/s/TON_DEPLOIEMENT_EXEC/exec"; // ← mets ton URL

// ---------- utilitaires DOM ----------
const qs  = (s, r=document) => r.querySelector(s);
const qsa = (s, r=document) => [...r.querySelectorAll(s)];

// ---------- JSONP helper ----------
function jsonp(action, params = {}, timeoutMs = 15000){
  return new Promise((resolve, reject)=>{
    const cbName = "__jsonp_cb_" + Math.random().toString(36).slice(2);
    const timeout = setTimeout(()=>{
      cleanup(); reject(new Error("JSONP timeout"));
    }, timeoutMs);

    function cleanup(){
      clearTimeout(timeout);
      delete window[cbName];
      if(script && script.parentNode){ script.parentNode.removeChild(script); }
    }

    window[cbName] = function(data){ cleanup(); resolve(data); };

    const url = new URL(API_BASE);
    url.searchParams.set('action', action);
    url.searchParams.set('callback', cbName);
    Object.entries(params).forEach(([k,v]) => url.searchParams.set(k, v));

    const script = document.createElement('script');
    script.src = url.toString();
    script.onerror = () => { cleanup(); reject(new Error("JSONP network error")); };
    document.body.appendChild(script);
  });
}

// ---------- statut ----------
function setStatus(mode){
  const badge = qs('#syncBadge'); if(!badge) return;
  badge.className = 'status-badge ' + mode;
  badge.textContent = mode==='online' ? 'En ligne' : (mode==='offline' ? 'Hors ligne' : mode);
  badge.title = mode==='online' ? 'Connecté à Google Sheets' :
               mode==='offline' ? 'Hors-ligne' : '';
}

// ---------- rendu ----------
function render(view){
  qsa('.tab').forEach(b => b.classList.toggle('active', b.dataset.view===view));
  const tpl = qs(`#tpl-${view}`);
  qs('#app').innerHTML = tpl ? tpl.innerHTML : '<div class="section"><div class="card">Vue non disponible.</div></div>';

  if(view==='dashboard') mountDashboard();
  if(view==='pertes')    mountPertes();
  if(view==='invj')      mountInvJ();
  if(view==='invm')      mountInvM();
  if(view==='recettes')  mountRecettes();
  if(view==='settings')  mountSettings();
}

// ---------- dashboard ----------
async function mountDashboard(){
  try{
    const etat = await jsonp('getEtatStock');
    if(etat.status==='success'){
      qs('#kpiStock').textContent    = '€ ' + (etat.totalValeur||0).toLocaleString('fr-FR');
      qs('#kpiStockQte').textContent = (etat.totalQuantite||0).toLocaleString('fr-FR') + ' unités';
      setStatus('online');
    }else{ setStatus('offline'); }

    const detail = await jsonp('getStockDetail');
    const tbody = qs('#tableStockDetail tbody'); if(tbody){
      tbody.innerHTML = (detail.stock||[]).map(it=>`
        <tr>
          <td>${it.produit||''}</td>
          <td style="text-align:right">${Number(it.qte||0)}</td>
          <td>${it.unite||''}</td>
          <td style="text-align:right">${Number(it.prix||0).toFixed(2)}</td>
          <td style="text-align:right">${Number(it.valeur||0).toFixed(2)}</td>
          <td>${it.zone||''}</td>
        </tr>
      `).join('');
    }
  }catch(e){
    setStatus('offline');
    console.error(e);
  }
}

// ---------- pertes ----------
function mountPertes(){
  const btnSave  = qs('#btnSavePerte');
  const btnReset = qs('#btnResetPerte');

  btnSave?.addEventListener('click', async ()=>{
    const payload = {
      produit: qs('#pertesProduit').value,
      qte:     qs('#pertesQte').value,
      unite:   qs('#pertesUnite').value,
      motif:   qs('#pertesMotif').value,
      comment: qs('#pertesComment').value,
      zone:    '' // si tu veux réactiver plus tard
    };
    const res = await jsonp('pertesAdd', payload).catch(err=>({status:'error', message:err.message}));
    alert(res.status==='success' ? '✅ Perte enregistrée' : ('❌ ' + (res.message||'Erreur inconnue')));

    // reset auto
    ['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesComment'].forEach(id=>{
      const el=qs('#'+id); if(el) el.value='';
    });
  });

  btnReset?.addEventListener('click', ()=>{
    ['pertesProduit','pertesQte','pertesUnite','pertesMotif','pertesComment'].forEach(id=>{
      const el=qs('#'+id); if(el) el.value='';
    });
  });
}

// ---------- inventaire journalier ----------
function mountInvJ(){
  // Ajouter datalist produits depuis Stock
  (async ()=>{
    const res = await jsonp('getStockDetail').catch(()=>({status:'error'}));
    const list = (res.stock||[]).map(p=>p.produit).filter(Boolean);
    const dl = document.createElement('datalist'); dl.id='produitsList';
    dl.innerHTML = list.map(n=>`<option value="${n}">`).join('');
    document.body.appendChild(dl);
    const inp = qs('#invjProduit'); if(inp) inp.setAttribute('list','produitsList');
  })();

  const btnEntree = qs('#btnInvJEntree');
  const btnSortie = qs('#btnInvJSortie');
  const btnReset  = qs('#btnResetInvJ');

  async function handler(kind){
    const payload = {
      type:    kind, // 'entree' | 'sortie'
      produit: qs('#invjProduit').value,
      qte:     qs('#invjQte').value,
      unite:   qs('#invjUnite').value,
      zone:    '' // si tu réactives
    };
    const res = await jsonp('inventaireJournalier', payload).catch(err=>({status:'error', message:err.message}));
    alert(res.status==='success' ? '✅ Mouvement enregistré' : ('❌ ' + (res.message||'Erreur inconnue')));

    // reset auto
    ['invjProduit','invjQte','invjUnite'].forEach(id=>{
      const el=qs('#'+id); if(el) el.value='';
    });
  }

  btnEntree?.addEventListener('click', ()=> handler('entree'));
  btnSortie?.addEventListener('click', ()=> handler('sortie'));
  btnReset?.addEventListener('click', ()=>{
    ['invjProduit','invjQte','invjUnite'].forEach(id=>{
      const el=qs('#'+id); if(el) el.value='';
    });
  });
}

// ---------- inventaire mensuel ----------
function mountInvM(){
  // zones → select
  (async ()=>{
    const z = await jsonp('zonesList').catch(()=>({status:'error'}));
    const sel = qs('#invmZone');
    if(sel && z.status==='success'){
      sel.innerHTML = (z.zones||[]).map(n=>`<option>${n}</option>`).join('');
    }
    // produits → datalist
    const res = await jsonp('getStockDetail').catch(()=>({status:'error'}));
    const list = (res.stock||[]).map(p=>p.produit).filter(Boolean);
    const dl = document.createElement('datalist'); dl.id='produitsMensuel';
    dl.innerHTML = list.map(n=>`<option value="${n}">`).join('');
    document.body.appendChild(dl);
    const inp = qs('#invmProduit'); if(inp) inp.setAttribute('list','produitsMensuel');
  })();

  qs('#btnInvmGenerate')?.addEventListener('click', async ()=>{
    const res = await jsonp('createInventaireMensuel', {
      zone: qs('#invmZone').value,
      mois: qs('#invmMois').value
    }).catch(err=>({status:'error', message:err.message}));
    alert(res.status==='success' ? '📄 Feuille générée' : ('❌ '+(res.message||'Erreur')));
  });

  qs('#btnInvmSave')?.addEventListener('click', async ()=>{
    const payload = {
      zone:        qs('#invmZone').value,
      mois:        qs('#invmMois').value,
      produits:    qs('#invmProduit').value,
      quantite:    qs('#invmQte').value,
      unite:       qs('#invmUnite').value,
      commentaires:qs('#invmComment').value
    };
    const res = await jsonp('saveInventaireMensuel', payload).catch(err=>({status:'error', message:err.message}));
    alert(res.status==='success' ? '💾 Enregistré' : ('❌ '+(res.message||'Erreur')));
    // reset léger
    ['invmProduit','invmQte','invmUnite','invmComment'].forEach(id=>{
      const el=qs('#'+id); if(el) el.value='';
    });
  });

  qs('#btnInvmReset')?.addEventListener('click', ()=>{
    ['invmMois','invmProduit','invmQte','invmUnite','invmComment'].forEach(id=>{
      const el=qs('#'+id); if(el) el.value='';
    });
  });
}

// ---------- recettes ----------
async function mountRecettes(){
  const listEl = qs('#recettesList');
  const detail = qs('#recetteDetail');
  const search = qs('#recetteSearch');

  const r = await jsonp('getRecettes').catch(()=>({status:'error'}));
  let all = (r.status==='success' ? (r.recettes||[]) : []);
  renderCards(all);

  search?.addEventListener('input', e=>{
    const q = (e.target.value||'').toLowerCase();
    renderCards(all.filter(x => (x.nom||'').toLowerCase().includes(q)));
  });

  function renderCards(items){
    listEl.innerHTML = items.map(r=>`
      <div class="card" data-code="${r.code}" style="cursor:pointer">
        <strong>${r.nom}</strong><br><small>Base ${r.portions||1} portions</small>
      </div>
    `).join('');
    listEl.querySelectorAll('.card').forEach(c=>{
      c.addEventListener('click', ()=> loadRecette(c.dataset.code));
    });
  }

  async function loadRecette(code){
    const res = await jsonp('getRecette', {code}).catch(()=>({status:'error'}));
    if(res.status!=='success'){ detail.textContent = '⚠️ Recette introuvable'; return; }
    const r = res.recette;
    detail.innerHTML = `
      <div class="card">
        <h2>${r.nom}</h2>
        <div>Base ${r.portions||1} portions</div>
        <div style="margin-top:8px">
          <label>Multiplier par :</label>
          <input id="multiInput" type="number" value="1" min="0.1" step="0.5" style="width:80px;margin-left:8px">
        </div>
        <table class="list" style="margin-top:10px">
          <thead><tr><th>Produit</th><th>Qté</th><th>Unité</th><th>Zone</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>`;
    const tb = detail.querySelector('tbody');
    (r.ingredients||[]).forEach(i=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i.produit}</td><td data-base="${i.quantite}">${Number(i.quantite).toFixed(2)}</td><td>${i.unite}</td><td>${i.zone||''}</td>`;
      tb.appendChild(tr);
    });
    detail.querySelector('#multiInput').addEventListener('input', e=>{
      const m = Number(e.target.value)||1;
      tb.querySelectorAll('td[data-base]').forEach(td=>{
        const base = Number(td.getAttribute('data-base'));
        td.textContent = (base*m).toFixed(2);
      });
    });
  }
}

// ---------- settings ----------
function mountSettings(){
  qs('#btnSetSave')?.addEventListener('click', ()=>{
    localStorage.setItem('etab', qs('#setEtab').value);
    localStorage.setItem('tz', qs('#setTz').value);
    localStorage.setItem('emailCC', qs('#setEmail').value);
    localStorage.setItem('lang', qs('#setLang').value);
    alert('✅ Paramètres enregistrés');
  });
}

// ---------- boot ----------
document.addEventListener('DOMContentLoaded', ()=>{
  qsa('.tab').forEach(btn => btn.addEventListener('click', ()=> render(btn.dataset.view)));
  render('dashboard');
});
