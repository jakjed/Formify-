/* ---------------- Router / state ---------------- */
let ROUTE = 'dashboard';
let UI = { vendorFilter:'', vendorEntityFilter:'All', contractSearch:'', contractStatusFilter:'All', prFilter:'All', invFilter:'All', budgetEntity:'US HoldCo', reportTab:'contracts', setupTab:'entities', contractTab:'setup', prTab:'pr', contractDetailId:null, expenseEntity:'All', reportBudgetEntity:'All', drawer:null, modal:null };

function navigate(route){ ROUTE = route; UI.drawer=null; UI.modal=null; render(); window.scrollTo(0,0); }
function openContractDetail(id){ ROUTE='contractDetail'; UI.contractDetailId=id; UI.drawer=null; UI.modal=null; render(); window.scrollTo(0,0); }
function closeContractDetail(){ ROUTE='contracts'; UI.contractDetailId=null; render(); window.scrollTo(0,0); }
function openDrawer(kind,id){ UI.drawer={kind,id}; render(); }
function closeDrawer(){ UI.drawer=null; render(); }
function openModal(kind,payload){ UI.modal={kind,payload}; render(); }
function closeModal(){ UI.modal=null; render(); }
function toast(msg){
  const t=document.createElement('div'); t.className='toast'; t.innerHTML=`<span>✓</span><span>${msg}</span>`;
  document.body.appendChild(t); setTimeout(()=>t.remove(),2600);
}

const NAV = [
  {group:'Overview', items:[
    {id:'dashboard', label:'Dashboard', icon:'◇'},
  ]},
  {group:'Procure-to-Pay', items:[
    {id:'contracts', label:'Contracts', icon:'▤', badge:()=>CONTRACTS.filter(c=>c.status==='Under Approval'||c.status==='Pending Signature').length},
    {id:'vendors', label:'Vendors', icon:'▣', badge:()=>VENDORS.length},
    {id:'pr', label:'Purchase Requests', icon:'▥', badge:()=>PRS.filter(p=>p.status==='Pending Approval').length + PR_PROPOSALS.length},
    {id:'invoices', label:'Invoices', icon:'▦', badge:()=>INVOICES.filter(i=>i.status==='Pending Approval'||i.status==='Scanned - Pending Review').length},
    {id:'payments', label:'Payments', icon:'◈'},
  ]},
  {group:'Planning', items:[
    {id:'budget', label:'Budget', icon:'▧'},
    {id:'reporting', label:'Reporting', icon:'▩'},
  ]},
  {group:'Admin', items:[
    {id:'setup', label:'Setup', icon:'⚙'},
  ]},
];

