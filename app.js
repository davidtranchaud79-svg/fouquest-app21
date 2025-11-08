// ============================================================
// 🍷 Fouquet’s Joy — Gold Motion v16.5
// Frontend aligné avec code.gs v16.4 (Pareto + unités auto + multiplicateur recettes)
// ============================================================

const API_URL = "https://script.google.com/macros/s/AKfycbxqh8yvag7cBGZ34zza181fpWV2TssYeQIIqUEd5ZI91knMY5jSK6sUP0QDEULfh12a/exec";

// ===== HELPERS =====
const qs = (s, r=document)=>r.querySelector(s);
const qsa = (s, r=document)=>[...r.querySelectorAll(s)];
function serialize(params){ const u=new URLSearchParams(); Object.entries(params).forEach(([k,v])=>u.append(k,v==null?'':String(v))); return u.toString(); }
async function api(action, params={}){
  const url=`${API_URL}?${serialize({action,...params})}`;
  try{ const r=await fetch(url,{method:'GET',cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.json();}
  catch(e){console.error("Erreur API",e);return{status:"error",message:e.message};}
}
function setBadge(state){
  const b=qs('#syncBadge'); if(!b) return;
  b.textContent=state==='online'?'En ligne':(state==='error'?'Erreur':'Hors ligne');
  b.classList.toggle('offline',state!=='online'); b.classList.toggle('online',state==='online');
}

// ===== NAVIGATION =====
document.addEventListener('DOMContentLoaded',()=>{
  qsa('.tab').forEach(btn=>btn.addEventListener('click',()=>{
    qsa('.tab').forEach(b=>b.classList.toggle('active',b===btn)); render(btn.dataset.view);
  }));
  qs('#btnSync').addEventListener('click',checkConnection);
  render('dashboard'); checkConnection();
});
async function checkConnection(){ const res=await api('ping'); setBadge(res.status==='success'?'online':'error'); }

// ===== RENDER =====
async function render(view){
  const tpl=qs(`#tpl-${view}`);
  qs('#app').innerHTML=tpl?tpl.innerHTML:'<section class="section"><div class="card">Vue indisponible</div></section>';
  if(view==='dashboard') await mountDashboard();
  if(view==='pertes') mountPertes();
  if(view==='invj') await mountInvJ();
  if(view==='invm') await mountInvM();
  if(view==='recettes') await mountRecettes();
  if(view==='settings') mountSettings();
}

// ============================================================
// 📊 DASHBOARD – Pareto pertes
// ============================================================
async function mountDashboard(){
  try{
    const etat=await api('getEtatStock');
    if(etat.status==='success'){
      qs('#kpiStock').textContent=`€ ${(etat.valeurTotale||0).toLocaleString('fr-FR')}`;
      qs('#kpiStockQte').textContent=`${(etat.quantiteTotale||0).toLocaleString('fr-FR')} unités`;
    }
  }catch(e){}
  try{
    const pertes=await api('getPertesPoids');
    if(pertes.status==='success'){
      qs('#kpiPertes').textContent=`${(pertes.pertesKg||0).toFixed(2)} kg`;
      const lab=qs('#kpiPertesLabel'); if(lab) lab.textContent="Poids total des pertes (kg)";
    }
  }catch(e){}

  try{
    const detail=await api('getStockDetail'); const tbody=qs('#tableStockDetail tbody'); if(!tbody) return;
    const stockList=detail.stock||detail; tbody.innerHTML='';
    (Array.isArray(stockList)?stockList:[]).forEach(it=>{
      const tr=document.createElement('tr');
      tr.innerHTML=`<td>${it.produit||''}</td>
      <td style="text-align:right">${Number(it.quantite||0)}</td>
      <td>${it.unite||''}</td>
      <td style="text-align:right">${Number(it.prix||0).toFixed(2)}</td>
      <td style="text-align:right">${Number(it.valeur||0).toFixed(2)}</td>
      <td>${it.zone||''}</td>`; tbody.appendChild(tr);
    });
  }catch(e){}

  // === Pareto chart ===
  const ctx=qs('#chartPertes'); const legendContainer=qs('#pertesLegend');
  try{
   
