/* ---------- SETUP ---------- */
function viewSetup(){
  const tabs = [
    ['entities','Entities'],
    ['departments','Departments'],
    ['categories','Expense Categories'],
    ['employees','Employees by Department'],
    ['fx','FX Rates'],
    ['general','Approval flow'],
  ];
  return `
    <div class="tag-strip">
      ${tabs.map(([id,label])=>`<div class="tag-btn ${UI.setupTab===id?'active':''}" onclick="UI.setupTab='${id}';render()">${label}</div>`).join('')}
    </div>
    ${setupBody()}
  `;
}
function setupBody(){
  switch(UI.setupTab){
    case 'entities': return setupEntities();
    case 'departments': return setupDepartments();
    case 'categories': return setupCategories();
    case 'employees': return setupEmployees();
    case 'fx': return viewFx();
    case 'general': return setupGeneral();
    default: return '';
  }
}
function setupEntities(){
  return `
    <div class="toolbar">
      <div class="section-desc" style="margin:0;">${ENTITIES.length} entities</div>
      <button class="btn primary" onclick="openModal('newEntity')">+ Add Entity</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>Entity</th><th>Country</th><th>Region</th><th>Tax ID</th><th>Status</th><th>Vendors</th></tr></thead>
        <tbody>${ENTITIES.map(e=>{
          const info = ENTITY_INFO[e] || {};
          return `
          <tr class="clickable" onclick="openDrawer('entity','${e}')">
            <td><div>${e}</div><div class="section-desc" style="margin:0;">${info.legalName||'—'}</div></td>
            <td>${info.country||'—'}</td>
            <td>${info.region||'—'}</td>
            <td class="mono">${info.taxId||'—'}</td>
            <td>${statusBadge(info.status||'Active')}</td>
            <td class="mono">${VENDORS.filter(v=>v.entity===e).length}</td>
          </tr>`;
        }).join('') || `<tr><td colspan="6"><div class="empty">No entities yet</div></td></tr>`}</tbody>
      </table></div>
    </div>
  `;
}
function setupDepartments(){
  return `
    <div class="toolbar">
      <div class="section-desc" style="margin:0;">${DEPARTMENTS.length} departments</div>
      <button class="btn primary" onclick="openModal('newDepartment')">+ Add Department</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>Department</th><th>Sub-departments</th><th>Employees</th><th>Open PRs</th><th>PR value</th></tr></thead>
        <tbody>${DEPARTMENTS.map(d=>`
          <tr class="clickable" onclick="openDrawer('department','${d}')">
            <td>${d}</td>
            <td class="mono">${(SUBDEPARTMENTS[d]||[]).length}</td>
            <td class="mono">${EMPLOYEES.filter(e=>e.dept===d).length}</td>
            <td class="mono">${PRS.filter(p=>p.dept===d).length}</td>
            <td class="mono">${fmtM(PRS.filter(p=>p.dept===d).reduce((s,p)=>s+p.amount,0))}</td>
          </tr>
        `).join('') || `<tr><td colspan="5"><div class="empty">No departments yet</div></td></tr>`}</tbody>
      </table></div>
    </div>
  `;
}
function setupCategories(){
  return `
    <div class="toolbar">
      <div class="section-desc" style="margin:0;">${EXPENSE_CATEGORIES.length} expense categories</div>
      <button class="btn primary" onclick="openModal('newCategory')">+ Add Category</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>Category</th><th>Vendors</th><th>Invoiced (period)</th></tr></thead>
        <tbody>${EXPENSE_CATEGORIES.map(c=>`
          <tr>
            <td>${c}</td>
            <td class="mono">${VENDORS.filter(v=>v.category===c).length}</td>
            <td class="mono">${fmtM(INVOICES.filter(i=>VENDORS.find(v=>v.name===i.vendor)?.category===c).reduce((s,i)=>s+i.amount,0))}</td>
          </tr>
        `).join('') || `<tr><td colspan="3"><div class="empty">No categories yet</div></td></tr>`}</tbody>
      </table></div>
    </div>
  `;
}
function setupEmployees(){
  return `
    <div class="toolbar">
      <div class="section-desc" style="margin:0;">${EMPLOYEES.length} employees</div>
      <button class="btn primary" onclick="openModal('newEmployee')">+ Add Employee</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Department</th><th>Sub-department</th><th>Role</th><th>Email address</th></tr></thead>
        <tbody>${EMPLOYEES.map(e=>`<tr><td>${e.name}</td><td>${e.dept}</td><td>${e.subDept||'—'}</td><td>${e.role}</td><td class="mono">${e.email||'—'}</td></tr>`).join('') || `<tr><td colspan="5"><div class="empty">No employees yet</div></td></tr>`}</tbody>
      </table></div>
    </div>
  `;
}
function setupGeneral(){
  return `
    <div class="grid-2 row-gap">
      <div class="card card-pad">
        <div class="section-title">Approval chain template</div>
        <div class="section-desc">Applies to purchase requests and contracts by default</div>
        ${renderStepper(APPROVAL_CHAIN, APPROVAL_CHAIN.length+1)}
        <div style="margin-top:18px;" class="section-desc">Contract-specific chain</div>
        ${renderStepper(CONTRACT_APPROVAL, CONTRACT_APPROVAL.length+1)}
      </div>
      <div class="card card-pad">
        <div class="section-title">ERP integrations</div>
        <div class="section-desc">Export targets for vendor master, PRs/POs, invoices and accruals</div>
        ${['Oracle','SAP','NetSuite'].map(erp=>`
          <div class="notice ok"><span>⇄</span><span><b>${erp}</b> — ${VENDORS.filter(v=>v.erp===erp).length} vendors connected</span></div>
        `).join('')}
      </div>
    </div>
  `;
}

