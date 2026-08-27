/* ---------- REPORTING ---------- */
function viewReporting(){
  const tabs = [
    ['contracts','Contracts'],['pr','PR Aging'],['po','Open POs'],['invoices','Invoices'],['expense','Monthly Expense'],['ap','AP Payments'],['budget','Actual vs Budget'],
  ];
  return `
    <div class="tag-strip">
      ${tabs.map(([id,label])=>`<div class="tag-btn ${UI.reportTab===id?'active':''}" onclick="UI.reportTab='${id}';render()">${label}</div>`).join('')}
    </div>
    ${reportBody()}
  `;
}
function reportBody(){
  switch(UI.reportTab){
    case 'contracts': return reportContracts();
    case 'pr': return reportPRAging();
    case 'po': return reportOpenPOs();
    case 'invoices': return reportInvoices();
    case 'expense': return reportMonthlyExpense();
    case 'ap': return reportAP();
    case 'budget': return reportBudget();
    default: return '';
  }
}
function reportContracts(){
  const byStatus = groupBy(CONTRACTS,'status');
  const byDept = {};
  CONTRACTS.forEach(c=>{
    const cc = ensureContractShape(c);
    const dept = cc.costCenter ? deptFromCostCenter(cc.costCenter) : 'Unassigned';
    (byDept[dept] = byDept[dept]||[]).push(cc);
  });
  const deptNames = Object.keys(byDept).sort();
  return `<div class="grid-2 row-gap">
    <div class="card card-pad">
      <div class="section-title">Contracts by status</div>
      <div class="chart-box sm"><canvas id="chartContractStatus"></canvas></div>
    </div>
    <div class="card card-pad">
      <div class="section-title">Value by status</div>
      ${Object.entries(byStatus).map(([s,list])=>`<div class="kv"><span class="k">${s}</span><span class="v">${fmtM(list.reduce((a,c)=>a+c.value,0))}</span></div>`).join('')}
    </div>
  </div>
  <div class="card card-pad">
    <div class="section-title">Contracts by department</div>
    <div class="section-desc">Grouped using each contract's assigned cost center</div>
    <table>
      <thead><tr><th>Department / Contract</th><th>Vendor</th><th>Value</th><th>Status</th></tr></thead>
      <tbody>
        ${deptNames.map(d=>{
          const list = byDept[d];
          const subtotal = list.reduce((s,c)=>s+c.value,0);
          return `
            <tr style="background:#FAFBFC;"><td colspan="2" style="font-weight:600;">${d}</td><td class="mono" style="font-weight:600;">${fmtM(subtotal)}</td><td></td></tr>
            ${list.map(c=>`<tr><td style="padding-left:24px;" class="mono">${c.contractNumber||c.id}</td><td>${c.vendor}</td><td class="mono">${fmtM(c.value)}</td><td>${statusBadge(c.status)}</td></tr>`).join('')}
          `;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}
function reportPRAging(){
  const openPRs = PRS.filter(p=>p.status==='Pending Approval');
  const openCount = openPRs.length;
  const openVal = openPRs.reduce((s,p)=>s+p.amount,0);
  const avgAge = Math.round(openPRs.reduce((s,p)=>s+daysBetween(p.date,todayISO()),0)/Math.max(1,openCount));

  const byMonth = {};
  openPRs.forEach(p=>{ const k=p.date.slice(0,7); byMonth[k]=byMonth[k]||{count:0,value:0}; byMonth[k].count++; byMonth[k].value+=p.amount; });
  const monthKeys = Object.keys(byMonth).sort();

  const byDept = {};
  openPRs.forEach(p=>{ (byDept[p.dept]=byDept[p.dept]||[]).push(p); });
  const deptNames = Object.keys(byDept).sort();

  return `
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);">
      ${kpi('Open PRs', openCount, 'awaiting approval','flat')}
      ${kpi('Open PR value', fmtM(openVal), 'not yet converted to PO','flat')}
      ${kpi('Avg. age', avgAge+'d', 'since submission','flat')}
    </div>

    <div class="card card-pad row-gap">
      <div class="section-title">Open PRs by month</div>
      <div class="section-desc">Grouped by each PR's opening (submission) date</div>
      <table>
        <thead><tr><th>Month</th><th>Count</th><th>Value</th></tr></thead>
        <tbody>${monthKeys.length? monthKeys.map(k=>`<tr><td>${monthLabelFromKey(k)}</td><td class="mono">${byMonth[k].count}</td><td class="mono">${fmtM(byMonth[k].value)}</td></tr>`).join('') : `<tr><td colspan="3"><div class="empty">No open PRs</div></td></tr>`}</tbody>
      </table>
    </div>

    <div class="card card-pad row-gap">
      <div class="section-title">Open PR aging by department</div>
      <table>
        <thead><tr><th>PR</th><th>Vendor</th><th>Value</th><th>Age</th><th></th></tr></thead>
        <tbody>
          ${deptNames.length? deptNames.map(d=>{
            const list = byDept[d];
            const subtotal = list.reduce((s,p)=>s+p.amount,0);
            return `
              <tr style="background:#FAFBFC;"><td colspan="2" style="font-weight:600;">${d}</td><td class="mono" style="font-weight:600;">${fmtM(subtotal)}</td><td colspan="2"></td></tr>
              ${list.map(p=>{
                const age = daysBetween(p.date, todayISO());
                return `<tr><td style="padding-left:24px;" class="mono">${p.id}</td><td>${p.vendor}</td><td class="mono">${fmtM(p.amount)}</td><td class="mono">${age}d</td><td>${age>14?statusBadge('Pending'):'<span class="badge b-grey">On track</span>'}</td></tr>`;
              }).join('')}
            `;
          }).join('') : `<tr><td colspan="5"><div class="empty">No open PRs</div></td></tr>`}
          ${deptNames.length? `<tr style="border-top:2px solid var(--line);"><td colspan="2" style="font-weight:700;">Grand total</td><td class="mono" style="font-weight:700;">${fmtM(openVal)}</td><td colspan="2"></td></tr>` : ''}
        </tbody>
      </table>
    </div>

    <div class="card card-pad">
      <div class="section-title">Open PR value by department</div>
      <div class="chart-box sm"><canvas id="chartOpenPRDept"></canvas></div>
    </div>
  `;
}
function reportOpenPOs(){
  const byDept = {};
  POS.forEach(po=>{
    const pr = PRS.find(p=>p.id===po.pr);
    const d = pr?pr.dept:'—';
    byDept[d]=(byDept[d]||0)+(po.amount-po.invoiced);
  });
  const byVendor = {};
  POS.forEach(po=>{ byVendor[po.vendor] = (byVendor[po.vendor]||0) + (po.amount-po.invoiced); });
  const vendorRows = Object.entries(byVendor).sort((a,b)=>b[1]-a[1]);
  return `<div class="grid-2 row-gap">
    <div class="card card-pad">
      <div class="section-title">Remaining open PO value by department</div>
      <div class="chart-box sm"><canvas id="chartOpenPODept"></canvas></div>
    </div>
    <div class="card card-pad">
      <div class="section-title">Remaining open PO value by entity</div>
      ${ENTITIES.map(e=>{
        const val = POS.filter(po=>po.entity===e).reduce((s,po)=>s+(po.amount-po.invoiced),0);
        return `<div class="kv"><span class="k">${e}</span><span class="v">${fmtM(val)}</span></div>`;
      }).join('')}
    </div>
  </div>
  <div class="card card-pad">
    <div class="section-title">Open PO value by supplier / vendor</div>
    <table>
      <thead><tr><th>Vendor</th><th>Open POs</th><th>Remaining value</th></tr></thead>
      <tbody>${vendorRows.length? vendorRows.map(([v,val])=>{
        const cnt = POS.filter(po=>po.vendor===v && (po.amount-po.invoiced)>0).length;
        return `<tr><td>${v}</td><td class="mono">${cnt}</td><td class="mono">${fmtM(val)}</td></tr>`;
      }).join('') : `<tr><td colspan="3"><div class="empty">No open POs</div></td></tr>`}</tbody>
    </table>
  </div>`;
}
function reportInvoices(){
  const groups = ['Scanned - Pending Review','Pending Approval','Approved','Paid'];
  return `<div class="card card-pad">
    <div class="section-title">Invoices by status, value and GL coding</div>
    <table>
      <thead><tr><th>Status</th><th>Count</th><th>Expense</th><th>Prepaid</th><th>Tax</th><th>AP total</th></tr></thead>
      <tbody>${groups.map(g=>{
        const list = INVOICES.filter(i=>i.status===g);
        return `<tr><td>${statusBadge(g)}</td><td class="mono">${list.length}</td>
          <td class="mono">${fmtM(list.reduce((s,i)=>s+i.expense,0))}</td>
          <td class="mono">${fmtM(list.reduce((s,i)=>s+i.prepaid,0))}</td>
          <td class="mono">${fmtM(list.reduce((s,i)=>s+i.tax,0))}</td>
          <td class="mono">${fmtM(list.reduce((s,i)=>s+i.ap,0))}</td></tr>`;
      }).join('')}</tbody>
    </table>
  </div>`;
}
function reportMonthlyExpense(){
  const entityFilter = UI.expenseEntity || 'All';
  const relevant = INVOICES.filter(i=>{
    if(entityFilter==='All') return true;
    return deptEntityOfInvoice(i).entity===entityFilter;
  });
  const months = [...new Set(relevant.map(i=>i.issueDate.slice(0,7)))].sort();
  const deptMonthTotals = {};
  relevant.forEach(i=>{
    const dept = deptEntityOfInvoice(i).dept || 'Unassigned';
    const m = i.issueDate.slice(0,7);
    deptMonthTotals[dept] = deptMonthTotals[dept] || {};
    deptMonthTotals[dept][m] = (deptMonthTotals[dept][m]||0) + i.amount;
  });
  const deptNames = Object.keys(deptMonthTotals).sort();
  const monthCols = months.length? months : [];

  return `<div class="card card-pad row-gap">
    <div class="section-title">Monthly expense report</div>
    <div class="section-desc">Combines invoices, open POs and accruals — by category</div>
    <table><thead><tr><th>Category</th><th>Invoiced</th><th>Open PO accrual</th><th>Total</th></tr></thead>
    <tbody>${EXPENSE_CATEGORIES.map(cat=>{
      const inv = INVOICES.filter(i=>{ const v=VENDORS.find(v=>v.name===i.vendor); return v&&v.category===cat; }).reduce((s,i)=>s+i.amount,0);
      const accrual = POS.filter(po=>{ const v=VENDORS.find(v=>v.name===po.vendor); return v&&v.category===cat; }).reduce((s,po)=>s+(po.amount-po.invoiced),0);
      return `<tr><td>${cat}</td><td class="mono">${fmtM(inv)}</td><td class="mono">${fmtM(accrual)}</td><td class="mono">${fmtM(inv+accrual)}</td></tr>`;
    }).join('')}</tbody></table>
  </div>
  <div class="card card-pad">
    <div class="toolbar" style="margin-bottom:10px;">
      <div>
        <div class="section-title" style="margin:0;">Total expense by department, sub-department and period</div>
        <div class="section-desc">Sub-department split is estimated evenly within each department</div>
      </div>
      <select class="filter" onchange="UI.expenseEntity=this.value;render()">
        <option ${entityFilter==='All'?'selected':''}>All</option>
        ${ENTITIES.map(e=>`<option ${entityFilter===e?'selected':''}>${e}</option>`).join('')}
      </select>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Department / Sub-department</th>${monthCols.map(m=>`<th>${monthLabelFromKey(m)}</th>`).join('')}<th>Total</th></tr></thead>
      <tbody>${deptNames.length? deptNames.map(d=>{
        const subs = SUBDEPARTMENTS[d] || [];
        const deptTotal = monthCols.reduce((s,m)=>s+(deptMonthTotals[d][m]||0),0);
        const deptRow = `<tr style="background:#FAFBFC;"><td style="font-weight:600;">${d}</td>${monthCols.map(m=>`<td class="mono" style="font-weight:600;">${fmtM(deptMonthTotals[d][m]||0)}</td>`).join('')}<td class="mono" style="font-weight:600;">${fmtM(deptTotal)}</td></tr>`;
        const subRows = subs.length? subs.map(s=>{
          const subTotal = deptTotal/subs.length;
          return `<tr><td style="padding-left:24px;">${s.code} ${s.name}</td>${monthCols.map(m=>`<td class="mono">${fmtM((deptMonthTotals[d][m]||0)/subs.length)}</td>`).join('')}<td class="mono">${fmtM(subTotal)}</td></tr>`;
        }).join('') : '';
        return deptRow + subRows;
      }).join('') : `<tr><td colspan="${monthCols.length+2}"><div class="empty">No invoices for this entity yet</div></td></tr>`}</tbody>
    </table></div>
  </div>`;
}
function reportAP(){
  const due = INVOICES.filter(i=>i.status==='Approved');
  const paid = INVOICES.filter(i=>i.status==='Paid');
  return `<div class="grid-2">
    <div class="card card-pad">
      <div class="section-title">Due but unpaid</div>
      <table><thead><tr><th>Invoice</th><th>Vendor</th><th>Amount</th><th>Due</th></tr></thead>
      <tbody>${due.map(i=>`<tr><td class="mono">${i.id}</td><td>${i.vendor}</td><td class="mono">${fmtM(i.amount)}</td><td class="mono">${i.dueDate}</td></tr>`).join('')}</tbody></table>
    </div>
    <div class="card card-pad">
      <div class="section-title">Paid this period</div>
      <table><thead><tr><th>Invoice</th><th>Vendor</th><th>Amount</th></tr></thead>
      <tbody>${paid.map(i=>`<tr><td class="mono">${i.id}</td><td>${i.vendor}</td><td class="mono">${fmtM(i.amount)}</td></tr>`).join('')}</tbody></table>
    </div>
  </div>`;
}
function computeBudgetReportData(){
  const scope = UI.reportBudgetEntity || 'All';
  const scopeEntities = scope==='All' ? ENTITIES : [scope];
  const now = new Date('2026-08-21');
  const curMonth = now.getMonth();

  const deptRows = DEPARTMENTS.map(d=>{
    let budget=0;
    scopeEntities.forEach(e=>{ for(let m=0;m<=curMonth;m++){ budget += BUDGET[`${e}|${d}|${m}`]||0; } });
    const actual = PRS.filter(p=>p.dept===d && scopeEntities.includes(p.entity)).reduce((s,p)=>s+p.amount,0);
    return {label:d, budget, actual};
  });
  const totalBudget = deptRows.reduce((s,r)=>s+r.budget,0);

  const catActual = {};
  EXPENSE_CATEGORIES.forEach(c=>{ catActual[c] = PRS.filter(p=>p.category===c && scopeEntities.includes(p.entity)).reduce((s,p)=>s+p.amount,0); });
  const totalCatActual = Object.values(catActual).reduce((a,b)=>a+b,0) || 1;
  const catRows = EXPENSE_CATEGORIES.map(c=>({ label:c, budget: totalBudget*(catActual[c]/totalCatActual), actual: catActual[c] }));

  const monthRows = [];
  for(let m=0;m<=curMonth;m++){
    let budget=0;
    scopeEntities.forEach(e=>{ DEPARTMENTS.forEach(d=>{ budget += BUDGET[`${e}|${d}|${m}`]||0; }); });
    const actual = INVOICES.filter(i=>{
      const info = deptEntityOfInvoice(i);
      return scopeEntities.includes(info.entity) && parseInt(i.issueDate.slice(5,7),10)-1===m;
    }).reduce((s,i)=>s+i.amount,0);
    monthRows.push({label:monthName(m), budget, actual});
  }

  return {scope, deptRows, catRows, monthRows};
}
function reportBudget(){
  const {scope, deptRows, catRows, monthRows} = computeBudgetReportData();
  const varianceCell = (budget,actual) => `<td class="mono" style="color:${actual>budget?'var(--coral)':'var(--teal)'}">${actual>budget?'+':''}${fmtM(actual-budget)}</td>`;
  return `
    <div class="toolbar">
      <div class="section-desc" style="margin:0;">Scope: ${scope}</div>
      <select class="filter" onchange="UI.reportBudgetEntity=this.value;render()">
        <option ${scope==='All'?'selected':''}>All</option>
        ${ENTITIES.map(e=>`<option ${scope===e?'selected':''}>${e}</option>`).join('')}
      </select>
    </div>

    <div class="card card-pad row-gap">
      <div class="section-title">Actual vs Budget by department</div>
      <table><thead><tr><th>Department</th><th>Budget (YTD)</th><th>Actual (YTD)</th><th>Variance</th></tr></thead>
      <tbody>${deptRows.map(r=>`<tr><td>${r.label}</td><td class="mono">${fmtM(r.budget)}</td><td class="mono">${fmtM(r.actual)}</td>${varianceCell(r.budget,r.actual)}</tr>`).join('')}</tbody></table>
    </div>

    <div class="card card-pad row-gap">
      <div class="section-title">Actual vs Budget by expense category</div>
      <div class="section-desc">Budget allocated pro-rata to the current spend mix — no categorized budget entry exists yet</div>
      <table><thead><tr><th>Category</th><th>Est. Budget (YTD)</th><th>Actual (YTD)</th><th>Variance</th></tr></thead>
      <tbody>${catRows.map(r=>`<tr><td>${r.label}</td><td class="mono">${fmtM(r.budget)}</td><td class="mono">${fmtM(r.actual)}</td>${varianceCell(r.budget,r.actual)}</tr>`).join('')}</tbody></table>
    </div>

    <div class="card card-pad">
      <div class="section-title">Actual vs Budget by month</div>
      <div class="section-desc">${scope} · year to date</div>
      <div class="chart-box"><canvas id="chartBudgetMoM"></canvas></div>
    </div>
  `;
}

