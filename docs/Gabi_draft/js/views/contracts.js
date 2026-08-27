/* ---------- CONTRACTS ---------- */
function viewContracts(){
  const tabs = [
    ['setup','Contract Set-up'],
    ['approval','Contract Approval'],
    ['signature','Contract Signature'],
  ];
  return `
    <div class="tag-strip">
      ${tabs.map(([id,label])=>`<div class="tag-btn ${UI.contractTab===id?'active':''}" onclick="UI.contractTab='${id}';render()">${label}</div>`).join('')}
    </div>
    ${UI.contractTab==='approval' ? viewContractApproval() : UI.contractTab==='signature' ? viewContractSignature() : viewContractSetup()}
  `;
}
function viewContractSetup(){
  const q = (UI.contractSearch||'').trim().toLowerCase();
  const statusFilter = UI.contractStatusFilter || 'All';
  const filtered = CONTRACTS.filter(c=>
    (statusFilter==='All' || c.status===statusFilter) &&
    (!q || c.vendor.toLowerCase().includes(q) || c.id.toLowerCase().includes(q))
  );
  const rows = filtered.map(c=>`
    <tr class="clickable" onclick="openContractDetail('${c.id}')">
      <td>${c.vendor}</td>
      <td class="mono">${c.id}${c.aiExtracted?' <span class="badge b-indigo" style="margin-left:4px;">✦ AI</span>':''}</td>
      <td>${c.type}</td>
      <td class="mono">${fmtM(c.value)}</td>
      <td>${statusBadge(c.status)}</td>
      <td>${c.tool}</td>
      <td>${c.status==='Draft' ? `<button class="btn teal sm" onclick="event.stopPropagation(); sendForApproval('${c.id}')">Send for Approval</button>` : `<button class="btn ghost sm" onclick="event.stopPropagation(); openContractDetail('${c.id}')">View →</button>`}</td>
    </tr>
  `).join('');
  const statuses = ['Draft','Under Approval','Pending Signature','Signed'];
  return `
    <div class="toolbar">
      <div style="display:flex;gap:8px;">
        <input id="contractSearch" class="search" placeholder="Search contracts…" value="${UI.contractSearch||''}" oninput="UI.contractSearch=this.value;render()">
        <select class="filter" onchange="UI.contractStatusFilter=this.value;render()">
          <option value="All" ${statusFilter==='All'?'selected':''}>All statuses</option>
          ${statuses.map(s=>`<option ${statusFilter===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
      <div style="display:flex; gap:8px;">
        <button class="btn primary" onclick="openModal('uploadSupplierContract')">✦ Upload from Supplier &amp; Scan with AI</button>
        <button class="btn primary" onclick="openModal('newContract')">+ New Contract</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>Vendor</th><th>ID</th><th>Type</th><th>Value</th><th>Status</th><th>CLM tool</th><th></th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7"><div class="empty">No contracts match your filters</div></td></tr>`}</tbody>
      </table></div>
    </div>
    <div class="grid-2" style="margin-top:16px;">
      <div class="card card-pad">
        <div class="section-title">Repository tools in use</div>
        <div class="section-desc">Store &amp; route documents for signature, similar to a shared repository</div>
        ${CLM_TOOLS.map(t=>`<div class="kv"><span class="k">${t}</span><span class="v" style="font-weight:400;">${CONTRACTS.filter(c=>c.tool===t).length} contracts</span></div>`).join('')}
      </div>
      <div class="card card-pad">
        <div class="section-title">AI contract intake</div>
        <div class="section-desc">Scans a supplier's contract, pre-fills the record below, and checks it for red flags</div>
        <div class="ai-box">
          <div class="ai-tag">✦ How it works</div>
          1. Supplier sends the agreement · 2. Upload it here — AI extracts vendor, value, dates and term details into a draft ·
          3. Review and edit the extracted fields · 4. Send it for approval when it's ready.
        </div>
      </div>
    </div>
  `;
}
function viewContractApproval(){
  const inFlight = CONTRACTS.filter(c=>c.status==='Under Approval');
  const awaitingSubmission = CONTRACTS.filter(c=>c.status==='Draft');
  return `
    <div class="notice info">ⓘ Review and approval here is an internal sign-off only — it does not constitute an official signature. Signing happens separately via DocuSign once approval is complete.</div>
    ${awaitingSubmission.length? `
      <div class="card card-pad row-gap">
        <div class="section-title">Awaiting submission</div>
        <div class="section-desc">Drafts the requester hasn't yet sent into the approval chain</div>
        <table><thead><tr><th>Contract</th><th>Vendor</th><th>Value</th><th></th></tr></thead>
        <tbody>${awaitingSubmission.map(c=>`
          <tr><td class="mono">${c.contractNumber}</td><td>${c.vendor}</td><td class="mono">${fmtM(c.value,c.currency)}</td>
          <td><button class="btn teal sm" onclick="sendForApproval('${c.id}')">Send for Approval</button></td></tr>
        `).join('')}</tbody></table>
      </div>
    ` : ''}
    <div class="section-desc" style="margin-bottom:12px;">${inFlight.length} contracts moving through the approval chain — Budget Owner → Legal → Tax → Compliance → Finance</div>
    ${inFlight.length? inFlight.map(c=>`
      <div class="card card-pad row-gap">
        <div class="toolbar" style="margin-bottom:10px;">
          <div>
            <div class="section-title" style="margin:0;">${c.contractNumber} · ${c.vendor}</div>
            <div class="section-desc">${fmtM(c.value, c.currency)} · Owner ${c.owner}</div>
          </div>
          <div style="display:flex; gap:6px;">
            <button class="btn ghost sm" onclick="openContractDetail('${c.id}')">View contract →</button>
            <button class="btn primary sm" onclick="advanceContract('${c.id}')">Approve &amp; advance</button>
          </div>
        </div>
        ${renderStepper(CONTRACT_APPROVAL, c.stage)}
      </div>
    `).join('') : `<div class="empty"><div class="e-icon">✓</div>No contracts currently in approval</div>`}
  `;
}
function viewContractSignature(){
  const pending = CONTRACTS.filter(c=>c.status==='Pending Signature');
  const completed = CONTRACTS.filter(c=>c.status==='Signed' && c.signature && c.signature.status==='Completed');
  return `
    <div class="card card-pad row-gap">
      <div class="section-title">Awaiting signature</div>
      <div class="section-desc">Contracts that have cleared internal approval and are ready to send — or are already out — for e-signature via DocuSign</div>
      ${pending.length? pending.map(c=>renderSignatureEnvelope(c)).join('') : `<div class="empty"><div class="e-icon">✓</div>Nothing is waiting on a signature right now</div>`}
    </div>
    <div class="card card-pad">
      <div class="section-title">Recently completed</div>
      <div class="section-desc">Fully executed envelopes</div>
      ${completed.length? `<table>
        <thead><tr><th>Contract</th><th>Vendor</th><th>Envelope</th><th>Completed</th></tr></thead>
        <tbody>${completed.map(c=>{
          const last = c.signature.signers.reduce((a,b)=> (a.signedAt||'') > (b.signedAt||'') ? a : b);
          return `<tr class="clickable" onclick="openContractDetail('${c.id}')"><td class="mono">${c.contractNumber}</td><td>${c.vendor}</td><td class="mono">${c.signature.envelopeId}</td><td class="mono">${last.signedAt||'—'}</td></tr>`;
        }).join('')}</tbody>
      </table>` : `<div class="empty">No completed envelopes yet</div>`}
    </div>
  `;
}
function renderSignatureEnvelope(c){
  const sig = c.signature;
  const signedCount = sig.signers.filter(s=>s.status==='Signed').length;
  const pct = sig.signers.length? Math.round(signedCount/sig.signers.length*100) : 0;
  const allSigned = sig.signers.length>0 && sig.signers.every(s=>s.status==='Signed');
  const uploadId = `sigUpload-${c.id}`;
  return `
    <div style="border:1px solid var(--line); border-radius:10px; padding:16px; margin-bottom:12px;">
      <div class="toolbar" style="margin-bottom:10px;">
        <div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-weight:600; font-size:13px;">${c.contractNumber} · ${c.vendor}</span>
            <span class="badge b-indigo">⇄ DocuSign</span>
          </div>
          <div class="section-desc">${sig.envelopeId? `Envelope ${sig.envelopeId} · sent ${sig.sentAt}` : 'Envelope not yet sent'}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn ghost sm" onclick="openContractDetail('${c.id}')">View contract →</button>
          ${sig.status==='Not started' || !sig.envelopeId ? `<button class="btn teal sm" onclick="sendForSignature('${c.id}')">Send for Signature via DocuSign ↗</button>` : ''}
        </div>
      </div>
      ${sig.envelopeId ? `
        <div class="notice info" style="margin-bottom:10px;">ⓘ Signing takes place in DocuSign, outside Ledgerline. Once every party has signed, upload the executed copy below to complete this contract.</div>
      ` : ''}
      <div class="bar-mini" style="margin-bottom:10px;"><div style="width:${pct}%"></div></div>
      <table>
        <thead><tr><th>Signer</th><th>Role</th><th>Status</th><th>Signed on</th></tr></thead>
        <tbody>${sig.signers.map(s=>`
          <tr>
            <td>${s.name}</td>
            <td>${s.role}</td>
            <td>${statusBadge(s.status)}</td>
            <td class="mono">${s.signedAt||'—'}</td>
          </tr>
        `).join('')}</tbody>
      </table>
      ${sig.envelopeId ? `
        <div style="display:flex; gap:8px; margin-top:12px;">
          ${!allSigned ? `<button class="btn ghost sm" onclick="checkDocuSignStatus('${c.id}')">Check DocuSign status</button>` : ''}
          ${allSigned ? `
            <label class="btn teal sm" style="cursor:pointer; margin:0;" for="${uploadId}">Upload signed agreement</label>
            <input type="file" id="${uploadId}" style="display:none;" onchange="uploadSignedAgreement('${c.id}', this)">
          ` : `<span class="section-desc" style="margin:0; align-self:center;">Upload unlocks once all parties have signed in DocuSign</span>`}
        </div>
      ` : ''}
    </div>
  `;
}

/* ---------- CONTRACT DETAIL PAGE ---------- */
const DOC_CATEGORIES = [
  ['draft','Contract draft'],
  ['executed','Executed contract'],
  ['correspondence','Correspondence'],
  ['paymentForm','Payment Form'],
  ['misc','Misc'],
  ['others','Others'],
];
function viewContractDetail(){
  const c = ensureContractShape(CONTRACTS.find(x=>x.id===UI.contractDetailId));
  if(!c) return `<div class="empty">Contract not found</div>`;
  const vendorInfo = VENDORS.find(v=>v.name===c.vendor);
  return `
    ${c.aiExtracted ? `<div class="notice info">✦ Pre-populated by AI from the supplier's document. Review the extracted fields below before sending this contract for approval.</div>` : ''}
    <div class="card card-pad row-gap">
      <div class="toolbar" style="margin-bottom:0;">
        <div>
          <div class="section-title" style="font-size:16px;">${c.contractNumber} · ${c.vendor}</div>
          <div class="section-desc">${statusBadgeText(c.status)} · Owner ${c.owner}</div>
        </div>
        <div style="display:flex; gap:6px;">
          <button class="btn ghost sm" onclick="aiSummarize('${c.id}')">✦ Ask AI to summarize</button>
          ${c.status==='Draft' ? `<button class="btn teal sm" onclick="sendForApproval('${c.id}')">Send for Approval</button>` : ''}
          ${c.status==='Under Approval' && c.stage<=CONTRACT_APPROVAL.length ? `<button class="btn teal sm" onclick="advanceContract('${c.id}')">Approve &amp; advance</button>` : ''}
          <button class="btn primary sm" onclick="openModal('editContract',{id:'${c.id}'})">Edit details</button>
        </div>
      </div>
      <div id="aiOut-${c.id}"></div>
    </div>

    <div class="card card-pad row-gap">
      <div class="section-title">Approval progress</div>
      <div class="section-desc">Internal sign-off only — this does not constitute an official signature</div>
      ${renderStepper(CONTRACT_APPROVAL, c.stage)}
    </div>

    ${c.signature && c.signature.signers.length ? `
    <div class="card card-pad row-gap">
      <div class="toolbar" style="margin-bottom:8px;">
        <div class="section-title" style="margin:0;">Signature status</div>
        <button class="btn ghost sm" onclick="UI.contractTab='signature';navigate('contracts')">Open in Contract Signature →</button>
      </div>
      <div style="display:flex; gap:16px; flex-wrap:wrap;">
        ${c.signature.signers.map(s=>`<div class="kv" style="min-width:220px;"><span class="k">${s.name} (${s.role})</span><span class="v">${statusBadge(s.status)}</span></div>`).join('')}
      </div>
    </div>` : ''}

    <div class="grid-2 row-gap">
      <div class="card card-pad">
        <div class="section-title">Key information</div>
        <div class="kv"><span class="k">1. Company (contracting the service)</span><span class="v" style="font-weight:400;">${c.company}</span></div>
        <div class="kv"><span class="k">2. Contract number</span><span class="v">${c.contractNumber}</span></div>
        <div class="kv"><span class="k">3. Contract date</span><span class="v">${c.contractDate}</span></div>
        <div class="kv"><span class="k">4. Vendor / Supplier</span><span class="v" style="font-weight:400;">${c.vendor}</span></div>
        <div class="kv"><span class="k">5. Cost center / Sub-department</span><span class="v" style="font-weight:400;">${c.costCenter||'—'}</span></div>
        <div class="kv"><span class="k">6. Contract value</span><span class="v">${fmtM(c.value, c.currency)}</span></div>
        <div class="kv"><span class="k">7. Currency</span><span class="v">${c.currency}</span></div>
        <div class="kv"><span class="k">8. Contract period</span><span class="v" style="font-weight:400;">${c.period}</span></div>
        <div class="kv"><span class="k">9. Agreement type</span><span class="v" style="font-weight:400;">${c.type}</span></div>
      </div>
      <div class="card card-pad">
        <div class="section-title">10. Contract purpose</div>
        <div class="section-desc" style="margin-bottom:14px;">${c.purpose || '—'}</div>
        <div class="section-title">11. Service description</div>
        <div class="section-desc" style="margin-bottom:14px;">${c.serviceDescription || '—'}</div>
        <div class="section-title">12. Term and renewal</div>
        <div class="kv"><span class="k">Term type</span><span class="v" style="font-weight:400;">${c.term.termType}</span></div>
        <div class="kv"><span class="k">Effective date</span><span class="v">${c.term.effectiveDate||'—'}</span></div>
        <div class="kv"><span class="k">Expiration date</span><span class="v">${c.term.expirationDate||'—'}</span></div>
        <div class="kv"><span class="k">Notice period</span><span class="v" style="font-weight:400;">${c.term.noticePeriod}</span></div>
      </div>
    </div>

    <div class="card card-pad row-gap">
      <div class="section-title">13. Documents</div>
      <div class="section-desc">Store contract files by category · saved here for this session</div>
      <div class="grid-3">
        ${DOC_CATEGORIES.map(([key,label])=>renderDocBox(c,key,label)).join('')}
      </div>
    </div>

    <div class="card card-pad">
      <div class="toolbar" style="margin-bottom:10px;">
        <div>
          <div class="section-title" style="margin:0;">✦ AI Red Flag Scan</div>
          <div class="section-desc">Scans the agreement's terms and checks the file for common risk indicators</div>
        </div>
        <button class="btn ghost sm" onclick="scanRedFlags('${c.id}')">${c.redFlags? 'Re-scan' : 'Scan for Red Flags'}</button>
      </div>
      ${c.redFlags && c.redFlags.length ? c.redFlags.map(f=>`
        <div class="notice ${f.severity==='High'?'warn':f.severity==='Medium'?'info':'ok'}" style="align-items:center;">
          <span class="badge ${f.severity==='High'?'b-coral':f.severity==='Medium'?'b-amber':'b-grey'}">${f.severity}</span>
          <span>${f.text}</span>
        </div>
      `).join('') : `<div class="empty">Not scanned yet — click “Scan for Red Flags” to check this agreement.</div>`}
    </div>
  `;
}
function statusBadgeText(status){ return statusBadge(status); }
function renderDocBox(c,key,label){
  const docs = c.documents[key] || [];
  const inputId = `docInput-${c.id}-${key}`;
  return `
    <div style="border:1px dashed var(--line); border-radius:10px; padding:12px; background:#FAFBFC;">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
        <div style="font-size:12.5px; font-weight:600;">${label}</div>
        <label class="btn ghost sm" style="cursor:pointer; margin:0;" for="${inputId}">+ Upload</label>
        <input type="file" id="${inputId}" style="display:none;" onchange="addContractDoc('${c.id}','${key}', this)">
      </div>
      ${docs.length? docs.map((d,i)=>`
        <div class="kv" style="padding:5px 0;">
          <span class="k" style="font-size:11.5px;">📎 ${d.name}</span>
          <span style="display:flex; align-items:center; gap:8px;">
            <span class="v" style="font-weight:400; font-size:10.5px; color:var(--text-faint);">${d.date}</span>
            <button class="btn ghost sm" style="padding:2px 6px;" onclick="removeContractDoc('${c.id}','${key}',${i})">✕</button>
          </span>
        </div>
      `).join('') : `<div class="section-desc" style="margin:0;">No files yet</div>`}
    </div>
  `;
}
function addContractDoc(id,key,inputEl){
  const file = inputEl.files[0];
  if(!file) return;
  const c = CONTRACTS.find(x=>x.id===id);
  c.documents[key].push({name:file.name, date:todayISO()});
  toast(`${file.name} added to ${DOC_CATEGORIES.find(d=>d[0]===key)[1]}`);
  render();
}
function removeContractDoc(id,key,idx){
  const c = CONTRACTS.find(x=>x.id===id);
  c.documents[key].splice(idx,1);
  toast('Document removed'); render();
}
function statusBadge(status){
  const map={
    'Signed':'b-teal','Approved':'b-teal','Active':'b-teal','Completed':'b-teal','Paid':'b-teal','Fully Invoiced':'b-teal','Posted':'b-teal',
    'Under Approval':'b-amber','Pending Approval':'b-amber','Pending':'b-amber','Open':'b-indigo','Dormant':'b-amber','Pending Signature':'b-indigo','Sent':'b-indigo','Scanned - Pending Review':'b-indigo',
    'Draft':'b-grey','Inactive':'b-grey','Closed':'b-coral','Waiting':'b-grey',
  };
  return `<span class="badge ${map[status]||'b-grey'}">${status}</span>`;
}
function renderStepper(chain, currentStage){
  return `<div class="stepper">
    ${chain.map((label,i)=>{
      const idx=i+1;
      const cls = idx<currentStage? 'done' : idx===currentStage? 'current' : '';
      return `<div class="step ${cls}"><div class="step-line"></div><div class="step-dot">${idx<currentStage?'✓':idx}</div><div class="step-label">${label}</div></div>`;
    }).join('')}
  </div>`;
}

