/* ================= DRAWERS ================= */
function renderDrawer(){
  const {kind,id} = UI.drawer;
  let body='', title='';
  if(kind==='vendor'){
    const v = VENDORS.find(x=>x.id===id);
    const vInvoices = INVOICES.filter(i=>i.vendor===v.name);
    const vPOs = POS.filter(p=>p.vendor===v.name);
    const vContracts = CONTRACTS.filter(c=>c.vendor===v.name);
    const vProposals = PR_PROPOSALS.filter(p=>p.vendor===v.name);
    title = v.name;
    body = `
      <div class="kv"><span class="k">Vendor ID</span><span class="v">${v.id}</span></div>
      <div class="kv"><span class="k">Entity</span><span class="v" style="font-weight:400;">${v.entity}</span></div>
      <div class="kv"><span class="k">Category</span><span class="v" style="font-weight:400;">${v.category}</span></div>
      <div class="kv"><span class="k">Currency</span><span class="v">${v.currency}</span></div>
      <div class="kv"><span class="k">ERP</span><span class="v" style="font-weight:400;">${v.erp}</span></div>
      <div class="kv"><span class="k">Status</span><span class="v">${statusBadge(v.status)}</span></div>
      <div style="display:flex; align-items:center; justify-content:space-between; margin:16px 0 6px;">
        <div class="section-title" style="margin:0;">Contract repository (${vContracts.length})</div>
        <button class="btn ghost sm" onclick="openModal('newContract',{vendor:'${v.name}'})">+ Add Contract</button>
      </div>
      ${vContracts.length? `<table>
        <thead><tr><th>Contract</th><th>Type</th><th>Value</th><th>Status</th></tr></thead>
        <tbody>${vContracts.map(c=>`
          <tr class="clickable" onclick="openContractDetail('${c.id}')">
            <td class="mono">${c.contractNumber||c.id}</td>
            <td>${c.type}</td>
            <td class="mono">${fmtM(c.value, c.currency)}</td>
            <td>${statusBadge(c.status)}</td>
          </tr>
        `).join('')}</tbody>
      </table>` : '<div class="section-desc">No contracts on file yet</div>'}
      ${vProposals.length? `
        <div style="margin:16px 0 6px;" class="section-title">✦ AI PR Proposals awaiting review (${vProposals.length})</div>
        ${vProposals.map(p=>`<div class="kv"><span class="k">${p.id} · ${p.contractNumber}</span><span class="v">${fmtM(p.amount,p.currency)}</span></div>`).join('')}
        <button class="btn ghost sm" style="margin-top:6px;" onclick="UI.prTab='proposals';navigate('pr')">Review in Purchase Requests →</button>
      ` : ''}
      <div style="margin:16px 0 6px;" class="section-title">POs (${vPOs.length})</div>
      ${vPOs.map(p=>`<div class="kv"><span class="k">${p.id}</span><span class="v">${fmtM(p.amount)}</span></div>`).join('') || '<div class="section-desc">None</div>'}
      <div style="margin:16px 0 6px;" class="section-title">Invoices (${vInvoices.length})</div>
      ${vInvoices.map(i=>`<div class="kv"><span class="k">${i.id}</span><span class="v">${fmtM(i.amount)}</span></div>`).join('') || '<div class="section-desc">None</div>'}
    `;
  } else if(kind==='pr'){
    const p = PRS.find(x=>x.id===id);
    title = p.id;
    body = `
      <div class="kv"><span class="k">Vendor</span><span class="v">${p.vendor}</span></div>
      <div class="kv"><span class="k">Department</span><span class="v" style="font-weight:400;">${p.dept}</span></div>
      <div class="kv"><span class="k">Entity</span><span class="v" style="font-weight:400;">${p.entity}</span></div>
      <div class="kv"><span class="k">Amount</span><span class="v">${fmtM(p.amount)}</span></div>
      <div class="kv"><span class="k">Requester</span><span class="v" style="font-weight:400;">${p.requester}</span></div>
      <div class="kv"><span class="k">Submitted</span><span class="v">${p.date}</span></div>
      <div class="kv"><span class="k">PO</span><span class="v">${p.po||'Not yet created'}</span></div>
      <div style="margin:16px 0 8px;" class="section-title">Approval progress</div>
      ${renderStepper(APPROVAL_CHAIN, p.stage)}
      <div style="margin-top:18px; display:flex; gap:6px;">
        ${p.stage<=APPROVAL_CHAIN.length ? `<button class="btn primary sm" onclick="advancePR('${p.id}')">Advance stage</button>` : ''}
        ${(!p.po && p.status==='Approved') ? `<button class="btn teal sm" onclick="convertToPO('${p.id}')">Convert to PO</button>` : ''}
      </div>
    `;
  } else if(kind==='invoice'){
    const i = ensureInvoiceShape(INVOICES.find(x=>x.id===id));
    title = i.id;
    body = `
      ${i.aiScanned && i.status==='Scanned - Pending Review' ? `<div class="notice info">✦ Scanned by AI from the vendor's invoice. Review the extracted amounts and coding, then send it for approval.</div>` : ''}
      <div class="kv"><span class="k">Vendor</span><span class="v">${i.vendor}</span></div>
      <div class="kv"><span class="k">PO reference</span><span class="v">${i.po||'—'}</span></div>
      <div class="kv"><span class="k">Entity</span><span class="v" style="font-weight:400;">${i.entity}</span></div>
      <div class="kv"><span class="k">Issue date</span><span class="v">${i.issueDate}</span></div>
      <div class="kv"><span class="k">Due date</span><span class="v">${i.dueDate}</span></div>
      <div class="kv"><span class="k">Status</span><span class="v">${statusBadge(i.status)}</span></div>
      <div class="kv"><span class="k">ERP posting</span><span class="v" style="font-weight:400;">${i.exportedToERP? `✓ Posted ${i.exportedAt}` : 'Not yet posted'}</span></div>
      <div style="margin:16px 0 6px;" class="section-title">GL coding</div>
      <div class="kv"><span class="k">Expense</span><span class="v">${fmtM(i.expense)}</span></div>
      <div class="kv"><span class="k">Prepaid</span><span class="v">${fmtM(i.prepaid)}</span></div>
      <div class="kv"><span class="k">Tax</span><span class="v">${fmtM(i.tax)}</span></div>
      <div class="kv"><span class="k">Accounts Payable</span><span class="v">${fmtM(i.ap)}</span></div>
      ${i.status!=='Scanned - Pending Review' ? `
        <div style="margin:16px 0 8px;" class="section-title">Approval progress</div>
        <div class="section-desc" style="margin-bottom:8px;">Internal sign-off only</div>
        ${renderStepper(INVOICE_APPROVAL, i.stage)}
      ` : ''}
      <div style="margin-top:16px; display:flex; gap:6px; flex-wrap:wrap;">
        ${i.status==='Scanned - Pending Review' ? `<button class="btn teal sm" onclick="sendInvoiceForApproval('${i.id}')">Send for Approval</button>` : ''}
        ${i.status==='Pending Approval' && i.stage<=INVOICE_APPROVAL.length ? `<button class="btn primary sm" onclick="advanceInvoice('${i.id}')">Approve (${INVOICE_APPROVAL[i.stage-1]})</button>` : ''}
        ${i.exportedToERP ? `<button class="btn ghost sm" onclick="exportInvoice('${i.id}')">Re-export to ERP</button>` : (i.status==='Approved'||i.status==='Paid') ? `<button class="btn ghost sm" onclick="exportInvoice('${i.id}')">Export to ERP →</button>` : ''}
      </div>
      <div style="margin-top:14px;" class="section-title">Supporting documents</div>
      <div class="section-desc">Stored for tax authority review</div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        ${(i.attachedFile? [i.attachedFile] : ['invoice.pdf']).map(f=>`<span class="badge b-grey">📎 ${f}</span>`).join('')}
        <span class="badge b-grey">📎 PO-match.pdf</span>
        <span class="badge b-grey">📎 approval-trail.pdf</span>
      </div>
    `;
  } else if(kind==='entity'){
    const info = ENTITY_INFO[id] || {};
    title = id;
    body = `
      <div class="kv"><span class="k">Legal name</span><span class="v" style="font-weight:400;">${info.legalName||'—'}</span></div>
      <div class="kv"><span class="k">Status</span><span class="v">${statusBadge(info.status||'Active')}</span></div>
      <div class="kv"><span class="k">Country</span><span class="v" style="font-weight:400;">${info.country||'—'}</span></div>
      <div class="kv"><span class="k">Region</span><span class="v" style="font-weight:400;">${info.region||'—'}</span></div>
      <div class="kv"><span class="k">Tax ID</span><span class="v">${info.taxId||'—'}</span></div>
      <div class="kv"><span class="k">Registration ID</span><span class="v">${info.regId||'—'}</span></div>
      <div style="margin:16px 0 6px;" class="section-title">Registered address</div>
      <div class="kv"><span class="k">Address 1</span><span class="v" style="font-weight:400;">${info.address1||'—'}</span></div>
      <div class="kv"><span class="k">Address 2</span><span class="v" style="font-weight:400;">${info.address2||'—'}</span></div>
      <div style="margin:16px 0 6px;" class="section-title">Legal representatives</div>
      <div class="section-desc" style="margin:0 0 12px;">${info.legalReps||'—'}</div>
      <div style="margin:16px 0 6px;" class="section-title">Linked records</div>
      <div class="kv"><span class="k">Vendors</span><span class="v">${VENDORS.filter(v=>v.entity===id).length}</span></div>
      <div class="kv"><span class="k">Open PRs</span><span class="v">${PRS.filter(p=>p.entity===id).length}</span></div>
      <div class="kv"><span class="k">Contracts</span><span class="v">${CONTRACTS.filter(c=>VENDORS.find(v=>v.name===c.vendor)?.entity===id).length}</span></div>
      <div style="margin-top:18px;">
        <button class="btn primary sm" onclick="openModal('editEntity',{name:'${id}'})">Edit details</button>
      </div>
    `;
  } else if(kind==='department'){
    const subs = SUBDEPARTMENTS[id] || [];
    title = id;
    body = `
      <div class="kv"><span class="k">Employees</span><span class="v">${EMPLOYEES.filter(e=>e.dept===id).length}</span></div>
      <div class="kv"><span class="k">Open PRs</span><span class="v">${PRS.filter(p=>p.dept===id).length}</span></div>
      <div class="kv"><span class="k">PR value</span><span class="v">${fmtM(PRS.filter(p=>p.dept===id).reduce((s,p)=>s+p.amount,0))}</span></div>
      <div style="display:flex; align-items:center; justify-content:space-between; margin:18px 0 8px;">
        <div class="section-title" style="margin:0;">Sub-departments</div>
        <button class="btn sm ghost" onclick="openModal('newSubDept',{dept:'${id}'})">+ Add</button>
      </div>
      ${subs.length? `<table><thead><tr><th>Code</th><th>Sub-department</th><th></th></tr></thead><tbody>
        ${subs.map((s,i)=>`<tr><td class="mono">${s.code}</td><td>${s.name}</td><td><button class="btn ghost sm" onclick="removeSubDept('${id}',${i})">Remove</button></td></tr>`).join('')}
      </tbody></table>` : `<div class="empty">No sub-departments yet</div>`}
    `;
  }
  return `
    <div class="drawer-backdrop" onclick="closeDrawer()"></div>
    <div class="drawer">
      <div class="drawer-head" style="display:flex;justify-content:space-between;align-items:center;">
        <div class="section-title" style="margin:0;">${title}</div>
        <button class="btn ghost sm" onclick="closeDrawer()">✕</button>
      </div>
      <div class="drawer-body">${body}</div>
    </div>
  `;
}

function aiSummarize(id){
  const c = CONTRACTS.find(x=>x.id===id);
  const el = document.getElementById(`aiOut-${id}`);
  if(!el) return;
  el.innerHTML = `<div class="ai-box" style="margin-top:12px;">
    <div class="ai-tag">✦ AI summary — routed by function</div>
    <b>Budget:</b> ${fmtM(c.value)} total commitment with ${c.owner} as budget owner; recommend confirming against FY26 department budget.<br>
    <b>Legal:</b> Standard vendor terms detected; renewal notice window appears standard (60–90 days).<br>
    <b>Tax:</b> No unusual withholding clauses flagged; confirm entity of record is ${VENDORS.find(v=>v.name===c.vendor)?.entity||'—'}.<br>
    <b>Compliance:</b> No data-processing addendum on file — confirm GDPR terms if personal data is in scope.
  </div>`;
}
function sendForApproval(id){
  const c = CONTRACTS.find(x=>x.id===id);
  c.stage = 1;
  c.status = 'Under Approval';
  toast(`${c.contractNumber} sent for approval`); render();
}
function advanceContract(id){
  const c = CONTRACTS.find(x=>x.id===id);
  if(c.status==='Under Approval' && c.stage<=CONTRACT_APPROVAL.length){
    c.stage++;
    if(c.stage>CONTRACT_APPROVAL.length){
      c.status = 'Pending Signature';
      if(!c.signature || c.signature.status==='Not started') initSignatureEnvelope(c);
      toast(`${c.contractNumber} approved internally — no signature yet. Ready to send via DocuSign.`);
    } else {
      toast(`${c.contractNumber} approved by ${CONTRACT_APPROVAL[c.stage-2]} — now with ${CONTRACT_APPROVAL[c.stage-1]}`);
    }
  }
  render();
}
function sendForSignature(id){
  const c = CONTRACTS.find(x=>x.id===id);
  if(!c.signature || !c.signature.signers.length) initSignatureEnvelope(c);
  c.signature.status = 'Sent';
  c.signature.envelopeId = c.signature.envelopeId || ('DS-'+uid());
  c.signature.sentAt = todayISO();
  c.signature.signers.forEach(s=>{ if(s.status==='Waiting') s.status='Sent'; });
  toast(`Envelope ${c.signature.envelopeId} sent via DocuSign — signing happens outside Ledgerline`); render();
}
function checkDocuSignStatus(id){
  const c = CONTRACTS.find(x=>x.id===id);
  const next = c.signature.signers.find(s=>s.status!=='Signed');
  if(next){ next.status='Signed'; next.signedAt=todayISO(); toast(`DocuSign update: ${next.name} has signed`); }
  else toast('All parties have signed in DocuSign — upload the executed copy to complete this contract.');
  render();
}
function uploadSignedAgreement(id, inputEl){
  const file = inputEl.files[0];
  if(!file) return;
  const c = CONTRACTS.find(x=>x.id===id);
  c.documents.executed.push({name:file.name, date:todayISO()});
  c.signature.status = 'Completed';
  c.signature.signers.forEach(s=>{ if(s.status!=='Signed'){ s.status='Signed'; s.signedAt=todayISO(); } });
  c.status = 'Signed';
  c.start = todayISO();
  c.expiry = c.term.expirationDate || addDays(todayISO(),365);
  c.period = `${c.start} – ${c.expiry}`;
  const vendor = VENDORS.find(v=>v.name===c.vendor);
  if(vendor && vendor.status==='Pending') vendor.status = 'Active';
  const proposal = generatePRProposal(c);
  toast(`${file.name} received from DocuSign and stored as the executed contract. AI drafted PR proposal ${proposal.id} for review.`);
  render();
}
function advancePR(id){
  const p = PRS.find(x=>x.id===id);
  if(p.stage<=APPROVAL_CHAIN.length){
    p.stage++;
    if(p.stage>APPROVAL_CHAIN.length){
      p.status = 'Approved';
      if(!p.po) convertToPO(id, true);
      toast(`${id} approved — ${p.po} generated automatically`);
    } else {
      p.status = 'Pending Approval';
      toast(`${id} advanced to ${APPROVAL_CHAIN[p.stage-1]}`);
    }
  }
  render(); openDrawer('pr',id);
}
function convertToPO(id, silent){
  const p = PRS.find(x=>x.id===id);
  const poId = 'PO-'+uid();
  POS.push({id:poId,pr:p.id,vendor:p.vendor,entity:p.entity,amount:p.amount,invoiced:0,status:'Open'});
  p.po = poId;
  if(!silent){ toast(`${poId} created from ${id}`); render(); openDrawer('pr',id); }
}
function sendProposalForApproval(id){
  const p = PR_PROPOSALS.find(x=>x.id===id);
  const prId = 'PR-'+uid();
  PRS.push({
    id:prId, vendor:p.vendor, dept:p.dept, category:p.category, entity:p.entity, amount:p.amount,
    stage:1, status:'Pending Approval', requester:'Maria Ionescu', date:todayISO(), po:null, sourceProposal:p.id,
  });
  PR_PROPOSALS = PR_PROPOSALS.filter(x=>x.id!==id);
  toast(`${prId} created from ${p.id} and sent for approval`);
  UI.prTab = 'pr';
  render();
}
function runGenerateAccruals(){
  const n = generateAccrualsFromPOs();
  toast(n>0 ? `${n} new accrual proposal${n>1?'s':''} generated from open POs` : 'Accrual amounts refreshed — no new proposals needed');
  render();
}
function sendAccrualForApproval(id){
  const a = AP_ACCRUALS.find(x=>x.id===id);
  a.status = 'Under Approval'; a.stage = 1;
  toast(`${a.id} sent for approval`); render();
}
function advanceAccrual(id){
  const a = AP_ACCRUALS.find(x=>x.id===id);
  if(a.stage<=ACCRUAL_APPROVAL.length){
    a.stage++;
    a.status = a.stage>ACCRUAL_APPROVAL.length ? 'Approved' : 'Under Approval';
  }
  toast(`${a.id} ${a.status==='Approved' ? 'fully approved — ready for ERP' : 'advanced'}`); render();
}
function postAccrualToERP(id){
  const a = AP_ACCRUALS.find(x=>x.id===id);
  a.status = 'Posted';
  toast(`${a.id} sent to ERP for posting (${fmtM(a.amount)})`); render();
}
function sendInvoiceForApproval(id){
  const i = INVOICES.find(x=>x.id===id);
  i.status = 'Pending Approval';
  i.stage = 1;
  toast(`${id} sent for approval`); render(); openDrawer('invoice',id);
}
function advanceInvoice(id){
  const i = ensureInvoiceShape(INVOICES.find(x=>x.id===id));
  if(i.stage<=INVOICE_APPROVAL.length){
    i.stage++;
    if(i.stage>INVOICE_APPROVAL.length){
      i.status = 'Approved';
      exportInvoice(id, true);
      toast(`${id} approved — posted to ERP and added to the payment schedule`);
    } else {
      toast(`${id} approved by ${INVOICE_APPROVAL[i.stage-2]} — now with ${INVOICE_APPROVAL[i.stage-1]}`);
    }
  }
  render(); openDrawer('invoice',id);
}
function approveInvoice(id){ advanceInvoice(id); }
function exportInvoice(id, silent){
  const i = ensureInvoiceShape(INVOICES.find(x=>x.id===id));
  i.exportedToERP = true;
  i.exportedAt = todayISO();
  if(!silent){ toast(`${id} exported to ERP with GL coding (expense/prepaid/tax/AP)`); render(); openDrawer('invoice',id); }
}

