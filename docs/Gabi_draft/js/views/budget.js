/* ---------- BUDGET ---------- */
function viewBudget(){
  const entity = UI.budgetEntity;
  const now = new Date('2026-08-21');
  const curMonth = now.getMonth();
  const rows = DEPARTMENTS.map(d=>{
    let budget=0, actual=0;
    for(let m=0;m<=curMonth;m++){ budget += BUDGET[`${entity}|${d}|${m}`]||0; }
    actual = INVOICES.filter(i=>{
      const v=VENDORS.find(v=>v.name===i.vendor);
      return v && v.entity===entity;
    }).length ? 0 : 0; // placeholder, replaced below per-dept using PR dept mapping
    // approximate actuals via PR/invoice linkage by department for demo purposes
    actual = PRS.filter(p=>p.entity===entity && p.dept===d).reduce((s,p)=>s+p.amount,0);
    const pct = budget? Math.min(100, Math.round(actual/budget*100)) : 0;
    const over = actual>budget;
    return `<tr>
      <td>${d}</td>
      <td class="mono">${fmtM(budget)}</td>
      <td class="mono">${fmtM(actual)}</td>
      <td class="mono" style="color:${over?'var(--coral)':'var(--teal)'}">${over?'+':''}${fmtM(actual-budget)}</td>
      <td><div class="bar-mini ${over?'over':''}"><div style="width:${pct}%"></div></div></td>
    </tr>`;
  }).join('');
  return `
    <div class="toolbar">
      <select class="filter" onchange="UI.budgetEntity=this.value;render()">
        ${ENTITIES.map(e=>`<option ${e===entity?'selected':''}>${e}</option>`).join('')}
      </select>
      <button class="btn primary" onclick="openModal('uploadBudget')">Upload Budget</button>
    </div>
    <div class="card card-pad row-gap">
      <div class="section-title">Actual vs Budget by department — ${entity}</div>
      <div class="section-desc">Year to date through August 2026 · uploaded by entity, supplier, expense category, department and month</div>
      <table>
        <thead><tr><th>Department</th><th>Budget (YTD)</th><th>Actual (YTD)</th><th>Variance</th><th>% used</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="card card-pad">
      <div class="section-title">Monthly budget grid</div>
      <div class="section-desc">${entity} · editable cells feed the Actual vs Budget report</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Department</th>${Array.from({length:12},(_,m)=>`<th>${monthName(m)}</th>`).join('')}</tr></thead>
        <tbody>${DEPARTMENTS.map(d=>`
          <tr><td>${d}</td>${Array.from({length:12},(_,m)=>`
            <td class="mono"><input style="width:64px;border:1px solid var(--line);border-radius:6px;padding:3px 5px;font-family:inherit;font-size:11.5px;" value="${BUDGET[`${entity}|${d}|${m}`]}" onchange="BUDGET['${entity}|${d}|${m}']=parseFloat(this.value)||0;render()"></td>
          `).join('')}</tr>
        `).join('')}</tbody>
      </table></div>
    </div>
  `;
}

