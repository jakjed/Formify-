/* ================= RENDER ================= */
function render(){
  const app = document.getElementById('app');
  const active = document.activeElement;
  const focusId = active && active.id ? active.id : null;
  const selStart = focusId && 'selectionStart' in active ? active.selectionStart : null;
  const selEnd = focusId && 'selectionEnd' in active ? active.selectionEnd : null;
  app.innerHTML = `
    <div class="sidebar">
      <div class="brand">
        <div class="brand-mark">LL</div>
        <div>
          <div class="brand-name">Ledgerline</div>
          <div class="brand-sub">Procure&nbsp;→&nbsp;Pay</div>
        </div>
      </div>
      <nav class="nav">
        ${NAV.map(g=>`
          <div class="nav-group-label">${g.group}</div>
          ${g.items.map(it=>`
            <div class="nav-item ${(ROUTE===it.id || (ROUTE==='contractDetail' && it.id==='contracts'))?'active':''}" onclick="navigate('${it.id}')">
              <span class="nav-icon">${it.icon}</span><span>${it.label}</span>
              ${it.badge && it.badge()>0 ? `<span class="nav-badge">${it.badge()}</span>` : ''}
            </div>
          `).join('')}
        `).join('')}
      </nav>
      <div class="sidebar-foot">Ledgerline P2P Suite<br>Prototype build · data resets on refresh</div>
    </div>
    <div class="main">
      ${renderTopbar()}
      <div class="content">${renderRoute()}</div>
    </div>
    ${UI.drawer ? renderDrawer() : ''}
    ${UI.modal ? renderModal() : ''}
  `;
  afterRender();
  if(focusId){
    const el = document.getElementById(focusId);
    if(el){
      el.focus();
      if(selStart!=null && el.setSelectionRange){ try{ el.setSelectionRange(selStart, selEnd); }catch(e){} }
    }
  }
}

function routeMeta(){
  const map = {
    dashboard:['Dashboard','Company-wide procure-to-pay snapshot'],
    contracts:['Contracts','Contract lifecycle: draft, approval, signature, repository'],
    vendors:['Vendors','Vendor master data and integration status'],
    pr:['Purchase Requests','PR approval flow and PO conversion'],
    invoices:['Invoices','Invoice processing, coding and approval'],
    payments:['Payments','Cash-flow forecast and payment preparation'],
    budget:['Budget','Vendor spend budgets by entity, department and month'],
    reporting:['Reporting','Detailed analysis across the P2P cycle'],
    setup:['Setup','Entities, departments, categories and employees'],
  };
  if(ROUTE==='contractDetail'){
    const c = CONTRACTS.find(x=>x.id===UI.contractDetailId);
    return [c? c.contractNumber||c.id : 'Contract', c? c.vendor : ''];
  }
  return map[ROUTE]||['Ledgerline',''];
}
function renderTopbar(){
  const [title,sub]=routeMeta();
  return `
    <div class="topbar">
      <div style="display:flex; align-items:center; gap:12px;">
        ${ROUTE==='contractDetail' ? `<button class="btn ghost sm" onclick="closeContractDetail()">← Contracts</button>` : ''}
        <div>
          <div class="topbar-title">${title}</div>
          <div class="topbar-sub">${sub}</div>
        </div>
      </div>
      <div class="topbar-right">
        <div class="pill"><span class="dot"></span>All systems synced</div>
        <div class="avatar">MI</div>
      </div>
    </div>
  `;
}

function renderRoute(){
  switch(ROUTE){
    case 'dashboard': return viewDashboard();
    case 'contracts': return viewContracts();
    case 'contractDetail': return viewContractDetail();
    case 'vendors': return viewVendors();
    case 'pr': return viewPRs();
    case 'invoices': return viewInvoices();
    case 'payments': return viewPayments();
    case 'budget': return viewBudget();
    case 'reporting': return viewReporting();
    case 'setup': return viewSetup();
    default: return '';
  }
}

