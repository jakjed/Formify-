/* ---------- PURCHASE REQUESTS / PO ---------- */
function viewPRs(){
  const tabs = [
    ['proposals', `PR Proposals (AI)${PR_PROPOSALS.length? ' · '+PR_PROPOSALS.length : ''}`],
    ['pr','Purchase Requests'],
    ['po','Purchase Orders'],
    ['accruals','AP Accruals'],
  ];
  return `
    <div class="tag-strip">
      ${tabs.map(([id,label])=>`<div class="tag-btn ${UI.prTab===id?'active':''}" onclick="UI.prTab='${id}';render()">${label}</div>`).join('')}
    </div>
    ${UI.prTab==='proposals' ? viewPRProposals() : UI.prTab==='po' ? viewPOList() : UI.prTab==='accruals' ? viewAPAccruals() : viewPRList()}
  `;
}
function viewPRProposals(){
  return `
    <div class="notice info">✦ These proposals were drafted by AI from newly signed vendor agreements. Review the extracted details, adjust if needed, then send each one for approval.</div>
    ${PR_PROPOSALS.length? PR_PROPOSALS.map(p=>`
      <div class="card card-pad row-gap">
        <div class="toolbar" style="margin-bottom:10px;">
          <div>
            <div class="section-title" style="margin:0;">${p.id} · ${p.vendor}</div>
            <div class="section-desc">${p.notes}</div>
          </div>
          <button class="btn teal sm" onclick="sendProposalForApproval('${p.id}')">Send for Approval</button>
        </div>
        <div class="field-row">
          <div class="field"><label>Department</label><select id="prop_dept_${p.id}" onchange="PR_PROPOSALS.find(x=>x.id==='${p.id}').dept=this.value">${DEPARTMENTS.map(d=>`<option ${p.dept===d?'selected':''}>${d}</option>`).join('')}</select></div>
          <div class="field"><label>Category</label><select id="prop_cat_${p.id}" onchange="PR_PROPOSALS.find(x=>x.id==='${p.id}').category=this.value">${EXPENSE_CATEGORIES.map(c=>`<option ${p.category===c?'selected':''}>${c}</option>`).join('')}</select></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Entity</label><select id="prop_entity_${p.id}" onchange="PR_PROPOSALS.find(x=>x.id==='${p.id}').entity=this.value">${ENTITIES.map(e=>`<option ${p.entity===e?'selected':''}>${e}</option>`).join('')}</select></div>
          <div class="field"><label>Amount</label><input type="number" value="${p.amount}" onchange="PR_PROPOSALS.find(x=>x.id==='${p.id}').amount=parseFloat(this.value)||0"></div>
        </div>
      </div>
    `).join('') : `<div class="empty"><div class="e-icon">✓</div>No AI-generated proposals waiting for review</div>`}
  `;
}
function viewPRList(){
  const filtered = PRS.filter(p=> UI.prFilter==='All' || p.status===UI.prFilter);
  const rows = filtered.map(p=>`
    <tr class="clickable" onclick="openDrawer('pr','${p.id}')">
      <td class="mono">${p.id}</td>
      <td>${p.vendor}</td>
      <td>${p.dept}</td>
      <td>${p.entity}</td>
      <td class="mono">${fmtM(p.amount)}</td>
      <td>${statusBadge(p.status)}</td>
      <td class="mono">${p.po || '—'}</td>
    </tr>
  `).join('');
  return `
    <div class="tag-strip">
      ${['All','Pending Approval','Approved'].map(f=>`<div class="tag-btn ${UI.prFilter===f?'active':''}" onclick="UI.prFilter='${f}';render()">${f}</div>`).join('')}
    </div>
    <div class="toolbar">
      <div class="section-desc" style="margin:0;">${filtered.length} purchase requests · ${fmtM(filtered.reduce((s,p)=>s+p.amount,0))} total</div>
      <button class="btn primary" onclick="openModal('newPR')">+ New Purchase Request</button>
    </div>
    <div class="card row-gap">
      <div class="table-wrap"><table>
        <thead><tr><th>PR ID</th><th>Vendor</th><th>Department</th><th>Entity</th><th>Amount</th><th>Status</th><th>PO</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
  `;
}
function viewPOList(){
  return `
    <div class="section-desc" style="margin-bottom:12px;">Purchase orders are generated automatically once a purchase request completes approval.</div>
    <div class="card card-pad">
      <div class="table-wrap"><table>
        <thead><tr><th>PO ID</th><th>Vendor</th><th>Entity</th><th>PO Value</th><th>Invoiced</th><th>Remaining</th><th>Status</th></tr></thead>
        <tbody>${POS.map(po=>`
          <tr>
            <td class="mono">${po.id}</td><td>${po.vendor}</td><td>${po.entity}</td>
            <td class="mono">${fmtM(po.amount)}</td><td class="mono">${fmtM(po.invoiced)}</td>
            <td class="mono">${fmtM(po.amount-po.invoiced)}</td><td>${statusBadge(po.status)}</td>
          </tr>
        `).join('')}</tbody>
      </table></div>
    </div>
    <div class="section-desc" style="margin-top:10px;">Unbilled amounts on open POs feed the <b>AP Accruals</b> tab.</div>
  `;
}
function viewAPAccruals(){
  return `
    <div class="toolbar">
      <div class="section-desc" style="margin:0;">${AP_ACCRUALS.length} accrual proposals · ${fmtM(AP_ACCRUALS.reduce((s,a)=>s+a.amount,0))} total</div>
      <button class="btn primary" onclick="runGenerateAccruals()">Generate Accrual Proposals from Open POs</button>
    </div>
    ${AP_ACCRUALS.length? `
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>Accrual</th><th>PO</th><th>Vendor</th><th>Dept</th><th>Category</th><th>Amount</th><th>Status</th><th></th></tr></thead>
        <tbody>${AP_ACCRUALS.map(a=>`
          <tr>
            <td class="mono">${a.id}</td>
            <td class="mono">${a.poId}</td>
            <td>${a.vendor}</td>
            <td>${a.dept}</td>
            <td>${a.category}</td>
            <td class="mono">${a.status==='Posted' ? fmtM(a.amount) : `<input style="width:90px;border:1px solid var(--line);border-radius:6px;padding:4px 6px;font-family:inherit;" value="${a.amount}" onchange="AP_ACCRUALS.find(x=>x.id==='${a.id}').amount=parseFloat(this.value)||0">`}</td>
            <td>${statusBadge(a.status)}</td>
            <td>
              ${a.status==='Draft' ? `<button class="btn teal sm" onclick="sendAccrualForApproval('${a.id}')">Send for Approval</button>` : ''}
              ${a.status==='Under Approval' && a.stage<=ACCRUAL_APPROVAL.length ? `<button class="btn primary sm" onclick="advanceAccrual('${a.id}')">Approve (${ACCRUAL_APPROVAL[a.stage-1]})</button>` : ''}
              ${a.status==='Approved' ? `<button class="btn teal sm" onclick="postAccrualToERP('${a.id}')">Send to ERP</button>` : ''}
            </td>
          </tr>
        `).join('')}</tbody>
      </table></div>
    </div>
    ` : `<div class="empty"><div class="e-icon">▧</div>No accrual proposals yet — generate them from open POs</div>`}
  `;
}
