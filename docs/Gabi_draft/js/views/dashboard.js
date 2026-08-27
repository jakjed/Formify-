/* ---------- DASHBOARD ---------- */
function viewDashboard(){
  const openPRValue = PRS.filter(p=>p.status==='Pending Approval').reduce((s,p)=>s+p.amount,0);
  const openPOValue = POS.reduce((s,p)=>s+(p.amount-p.invoiced),0);
  const pendingInvValue = INVOICES.filter(i=>i.status==='Pending Approval').reduce((s,i)=>s+i.amount,0);
  const mtdSpend = INVOICES.reduce((s,i)=>s+i.amount,0);
  const upcoming30 = INVOICES.filter(i=>i.status==='Approved' && daysBetween(todayISO(),i.dueDate)<=30 && daysBetween(todayISO(),i.dueDate)>=0).reduce((s,i)=>s+i.amount,0);

  const notes = computeNotifications();

  return `
    <div class="kpi-grid">
      ${kpi('Open PR value', fmtM(openPRValue), `${PRS.filter(p=>p.status==='Pending Approval').length} awaiting approval`,'flat')}
      ${kpi('Open PO value', fmtM(openPOValue), `${POS.filter(p=>p.status==='Open').length} POs open`,'flat')}
      ${kpi('Invoices pending', fmtM(pendingInvValue), `${INVOICES.filter(i=>i.status==='Pending Approval').length} in approval queue`,'down')}
      ${kpi('Vendor spend (period)', fmtM(mtdSpend), 'across ' + VENDORS.length + ' vendors','up')}
      ${kpi('Cash out — next 30d', fmtM(upcoming30), 'forecasted vendor payments','flat')}
    </div>

    <div class="card row-gap">
      <div class="card-pad">
        <div class="section-title">Procure-to-pay flow</div>
        <div class="section-desc">Live count and value of items moving through the cycle</div>
        ${renderPipeline()}
      </div>
    </div>

    <div class="grid-2 row-gap">
      <div class="card card-pad">
        <div class="section-title">Actual vs Budget — last 6 months</div>
        <div class="section-desc">${UI.budgetEntity==='All'?'All entities':UI.budgetEntity} · reporting currency USD</div>
        <div class="chart-box"><canvas id="chartActualBudget"></canvas></div>
      </div>
      <div class="card card-pad">
        <div class="section-title">Vendor spend by department</div>
        <div class="section-desc">Trailing period, all entities</div>
        <div class="chart-box"><canvas id="chartByDept"></canvas></div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card card-pad">
        <div class="section-title">Notifications</div>
        <div class="section-desc">Contract expirations and invoices coming due</div>
        ${notes.length? notes.map(n=>`<div class="notice ${n.type}">${n.type==='warn'?'⚠':'ⓘ'}&nbsp; ${n.text}</div>`).join('') : `<div class="empty"><div class="e-icon">✓</div>Nothing needs attention right now</div>`}
      </div>
      <div class="card card-pad">
        <div class="section-title">Recent activity</div>
        <div class="section-desc">Across contracts, PRs, invoices and payments</div>
        ${recentActivity()}
      </div>
    </div>
  `;
}
function kpi(label,value,delta,dir){
  return `<div class="kpi">
    <div class="kpi-label">${label}</div>
    <div class="kpi-value">${value}</div>
    <div class="kpi-delta ${dir}">${dir==='up'?'▲':dir==='down'?'▼':'—'} ${delta}</div>
  </div>`;
}
function renderPipeline(){
  const stages = [
    {label:'Contracts', count:CONTRACTS.length, amt:CONTRACTS.reduce((s,c)=>s+c.value,0)},
    {label:'Vendors', count:VENDORS.length, amt:null},
    {label:'PRs', count:PRS.length, amt:PRS.reduce((s,p)=>s+p.amount,0)},
    {label:'POs', count:POS.length, amt:POS.reduce((s,p)=>s+p.amount,0)},
    {label:'Invoices', count:INVOICES.length, amt:INVOICES.reduce((s,i)=>s+i.amount,0)},
    {label:'Payments', count:PAYMENTS.length, amt:PAYMENTS.reduce((s,p)=>s+p.amount,0)},
  ];
  return `
    <div class="pipeline">
      <div class="pipe-track"></div>
      ${stages.map(s=>`
        <div class="pipe-node">
          <div class="pipe-dot"></div>
          <div class="pn-count">${s.count}</div>
          ${s.amt!==null? `<div class="pn-amt">${fmtM(s.amt)}</div>` : '<div class="pn-amt">&nbsp;</div>'}
          <div class="pn-label">${s.label}</div>
        </div>
      `).join('')}
    </div>
  `;
}
function recentActivity(){
  const items = [
    {t:'Invoice INV-9002 approved for payment', when:'2h ago'},
    {t:'PO-7002 partially invoiced by Meridian Marketing Group', when:'6h ago'},
    {t:'Contract CT-3006 moved to Compliance review', when:'1d ago'},
    {t:'PR-5008 submitted by Sarah Klein', when:'1d ago'},
    {t:'Payment PMT-2 completed via HSBC', when:'3d ago'},
  ];
  return `<div>${items.map(i=>`
    <div class="kv"><span class="k">${i.t}</span><span class="v" style="font-weight:400;">${i.when}</span></div>
  `).join('')}</div>`;
}

