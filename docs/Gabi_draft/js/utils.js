/* =========================================================
   LEDGERLINE — Procure-to-Pay prototype
   In-memory mock data. Nothing persists across a page reload.
   ========================================================= */

const fmt = n => n.toLocaleString('en-US',{maximumFractionDigits:0});
const fmtM = (n,cur='USD') => (n<0? '(' : '') + (cur==='USD'?'$':cur==='EUR'?'€':cur==='GBP'?'£':cur+' ') + fmt(Math.abs(n)) + (n<0? ')' : '');
const uid = (()=>{ let i=1000; return ()=> (i++); })();
const todayISO = ()=> new Date().toISOString().slice(0,10);
function addDays(d,n){ const dt=new Date(d); dt.setDate(dt.getDate()+n); return dt.toISOString().slice(0,10); }
function daysBetween(a,b){ return Math.round((new Date(b)-new Date(a))/86400000); }
function monthName(m){ return ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m]; }
function monthLabelFromKey(key){ const [y,m] = key.split('-'); return monthName(parseInt(m,10)-1)+' '+y; }
function deptEntityOfInvoice(i){
  if(i.po){
    const po = POS.find(p=>p.id===i.po);
    if(po){ const pr = PRS.find(p=>p.id===po.pr); if(pr) return {dept:pr.dept, entity:pr.entity}; }
  }
  const v = VENDORS.find(v=>v.name===i.vendor);
  return {dept:null, entity: v? v.entity : i.entity};
}

