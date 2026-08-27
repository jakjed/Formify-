/* ================= MODALS ================= */
function entityFormFields(v){
  const g = (key,def='') => (v[key]!==undefined && v[key]!==null) ? v[key] : def;
  return `
    <div class="field"><label>Entity name (short)</label><input id="m_name" placeholder="e.g. Germany GmbH" value="${g('name')}"></div>
    <div class="field"><label>Legal name</label><input id="m_legalName" placeholder="e.g. Germany Operations GmbH" value="${g('legalName')}"></div>
    <div class="field-row">
      <div class="field"><label>Country</label><input id="m_country" placeholder="e.g. Germany" value="${g('country')}"></div>
      <div class="field"><label>Region</label><select id="m_region">
        ${['Americas','EMEA','APAC','LATAM'].map(r=>`<option ${g('region')===r?'selected':''}>${r}</option>`).join('')}
      </select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Tax ID</label><input id="m_taxId" placeholder="e.g. DE 123456789" value="${g('taxId')}"></div>
      <div class="field"><label>Registration ID</label><input id="m_regId" placeholder="e.g. HRB 987654" value="${g('regId')}"></div>
    </div>
    <div class="field"><label>Address 1</label><input id="m_address1" placeholder="Street address" value="${g('address1')}"></div>
    <div class="field"><label>Address 2</label><input id="m_address2" placeholder="City, postal code" value="${g('address2')}"></div>
    <div class="field"><label>Legal representatives</label><input id="m_legalReps" placeholder="e.g. Jane Doe (Managing Director)" value="${g('legalReps')}"></div>
    <div class="field"><label>Status</label><select id="m_status">
      ${['Active','Dormant','Closed'].map(s=>`<option ${g('status','Active')===s?'selected':''}>${s}</option>`).join('')}
    </select></div>
  `;
}
function contractFormFields(c){
  const g = (key,def='') => (c[key]!==undefined && c[key]!==null) ? c[key] : def;
  const t = c.term || {};
  const costCenterOptions = [];
  DEPARTMENTS.forEach(d=>{ (SUBDEPARTMENTS[d]||[]).forEach(s=>costCenterOptions.push(`${s.code} ${s.name}`)); });
  return `
    <div class="field-row">
      <div class="field"><label>Company (contracting entity)</label><select id="m_company">${ENTITIES.map(e=>`<option ${g('company')===e?'selected':''}>${e}</option>`).join('')}</select></div>
      <div class="field"><label>Contract number</label><input id="m_contractNumber" value="${g('contractNumber')}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Contract date</label><input id="m_contractDate" type="date" value="${g('contractDate')}"></div>
      <div class="field"><label>Vendor / Supplier</label><select id="m_vendor2">${VENDORS.map(v=>`<option ${g('vendor')===v.name?'selected':''}>${v.name}</option>`).join('')}</select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Cost center / Sub-department</label><select id="m_costCenter">
        <option value="">— none —</option>
        ${costCenterOptions.map(o=>`<option ${g('costCenter')===o?'selected':''}>${o}</option>`).join('')}
      </select></div>
      <div class="field"><label>Agreement type</label><select id="m_type2">
        ${['Vendor Agreement','New Agreement','Amendment','Renewal'].map(o=>`<option ${g('type')===o?'selected':''}>${o}</option>`).join('')}
      </select></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Contract value</label><input id="m_value2" type="number" value="${g('value',0)}"></div>
      <div class="field"><label>Currency</label><select id="m_currency">${['USD','EUR','GBP','RON'].map(cu=>`<option ${g('currency')===cu?'selected':''}>${cu}</option>`).join('')}</select></div>
    </div>
    <div class="field"><label>Contract period</label><input id="m_period" placeholder="e.g. 12 months (Jan 1 – Dec 31, 2026)" value="${g('period')}"></div>
    <div class="field"><label>Contract purpose</label><textarea id="m_purpose">${g('purpose')}</textarea></div>
    <div class="field"><label>Service description</label><textarea id="m_serviceDescription">${g('serviceDescription')}</textarea></div>
    <div class="field-row">
      <div class="field"><label>Term type</label><select id="m_termType">${['Fixed Term','Auto-Renew','Rolling'].map(o=>`<option ${t.termType===o?'selected':''}>${o}</option>`).join('')}</select></div>
      <div class="field"><label>Notice period</label><input id="m_noticePeriod" placeholder="e.g. 60 days" value="${t.noticePeriod||''}"></div>
    </div>
    <div class="field-row">
      <div class="field"><label>Effective date</label><input id="m_effectiveDate" type="date" value="${t.effectiveDate||''}"></div>
      <div class="field"><label>Expiration date</label><input id="m_expirationDate" type="date" value="${t.expirationDate||''}"></div>
    </div>
  `;
}
function renderModal(){
  const {kind} = UI.modal;
  let title='', body='', footer='';
  if(kind==='uploadSupplierContract'){
    title='Upload Contract from Supplier';
    body = `
      <div class="notice info">ⓘ AI will scan the document and pre-populate the contract record below for your review — including a first-pass red flag check.</div>
      <div class="field"><label>Contract file from supplier</label><input id="m_file" type="file"></div>
      <div class="field"><label>Vendor / Supplier</label><select id="m_vendor">${VENDORS.map(v=>`<option>${v.name}</option>`).join('')}</select></div>
    `;
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn teal" onclick="submitSupplierUpload()">Scan with AI</button>`;
  } else if(kind==='newContract'){
    const presetVendor = UI.modal.payload && UI.modal.payload.vendor;
    title = presetVendor ? `New Contract — ${presetVendor}` : 'New Contract';
    body = `
      <div class="field"><label>Vendor</label><select id="m_vendor">${VENDORS.map(v=>`<option ${presetVendor===v.name?'selected':''}>${v.name}</option>`).join('')}</select></div>
      <div class="field-row">
        <div class="field"><label>Type</label><select id="m_type"><option>Vendor Agreement</option><option>New Agreement</option></select></div>
        <div class="field"><label>CLM tool</label><select id="m_tool">${CLM_TOOLS.map(t=>`<option>${t}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Contract value (USD)</label><input id="m_value" type="number" placeholder="e.g. 120000"></div>
      <div class="field"><label>Owner</label><select id="m_owner">${EMPLOYEES.map(e=>`<option>${e.name}</option>`).join('')}</select></div>
    `;
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="submitContract()">Create as Draft</button>`;
  } else if(kind==='editContract'){
    const c = ensureContractShape(CONTRACTS.find(x=>x.id===UI.modal.payload.id));
    title = `Edit ${c.contractNumber}`;
    body = `<input type="hidden" id="m_editId" value="${c.id}">` + contractFormFields(c);
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="submitEditContract()">Save changes</button>`;
  } else if(kind==='newVendor'){
    title='Create Vendor';
    body = `
      <div class="field"><label>Vendor name</label><input id="m_name" placeholder="e.g. Acme Supplies Ltd"></div>
      <div class="field-row">
        <div class="field"><label>Entity</label><select id="m_entity">${ENTITIES.map(e=>`<option>${e}</option>`).join('')}</select></div>
        <div class="field"><label>Category</label><select id="m_cat">${EXPENSE_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>ERP for export/import</label><select id="m_erp"><option>NetSuite</option><option>Oracle</option><option>SAP</option><option>Navision</option></select></div>
        <div class="field"><label>Currency</label><select id="m_cur"><option>USD</option><option>EUR</option><option>GBP</option><option>RON</option></select></div>
      </div>
    `;
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="submitVendor()">Create vendor</button>`;
  } else if(kind==='newPR'){
    title='New Purchase Request';
    body = `
      <div class="field"><label>Vendor</label><select id="m_vendor">${VENDORS.map(v=>`<option>${v.name}</option>`).join('')}</select></div>
      <div class="field-row">
        <div class="field"><label>Department</label><select id="m_dept">${DEPARTMENTS.map(d=>`<option>${d}</option>`).join('')}</select></div>
        <div class="field"><label>Entity</label><select id="m_entity">${ENTITIES.map(e=>`<option>${e}</option>`).join('')}</select></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Category</label><select id="m_cat">${EXPENSE_CATEGORIES.map(c=>`<option>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Amount (USD)</label><input id="m_amount" type="number" placeholder="e.g. 15000"></div>
      </div>
      <div class="field"><label>Justification</label><textarea id="m_just" placeholder="Business reason for this request"></textarea></div>
    `;
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="submitPR()">Submit for approval</button>`;
  } else if(kind==='uploadVendorInvoice'){
    title='Upload Invoice from Vendor';
    body = `
      <div class="notice info">ⓘ AI will scan the invoice and extract the vendor, amount, due date and GL coding for your review.</div>
      <div class="field"><label>Invoice file</label><input id="m_file" type="file"></div>
      <div class="field"><label>Vendor</label><select id="m_vendor">${VENDORS.map(v=>`<option>${v.name}</option>`).join('')}</select></div>
      <div class="field"><label>Matched PO (optional)</label><select id="m_po"><option value="">— none —</option>${POS.map(p=>`<option>${p.id}</option>`).join('')}</select></div>
    `;
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn teal" onclick="submitVendorInvoiceUpload()">Scan with AI</button>`;
  } else if(kind==='newInvoice'){
    title='Log Invoice';
    body = `
      <div class="field"><label>Vendor</label><select id="m_vendor">${VENDORS.map(v=>`<option>${v.name}</option>`).join('')}</select></div>
      <div class="field"><label>Matched PO (optional)</label><select id="m_po"><option value="">— none —</option>${POS.map(p=>`<option>${p.id}</option>`).join('')}</select></div>
      <div class="field-row">
        <div class="field"><label>Amount (USD)</label><input id="m_amount" type="number" placeholder="e.g. 12000"></div>
        <div class="field"><label>Due date</label><input id="m_due" type="date" value="${addDays(todayISO(),30)}"></div>
      </div>
    `;
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="submitInvoice()">Log invoice</button>`;
  } else if(kind==='newPaymentProposal'){
    title='Create Payment Proposal';
    const eligible = INVOICES.filter(i=>i.status==='Approved');
    body = `
      <div class="field"><label>Bank</label><select id="m_bank">${BANKS.map(b=>`<option ${b==='Payoneer'?'selected':''}>${b} — ${BANK_FORMATS[b]||''}</option>`).join('')}</select></div>
      <div class="field"><label>Invoices to include (${eligible.length} approved)</label>
        <div style="max-height:200px;overflow-y:auto;border:1px solid var(--line);border-radius:8px;padding:8px;">
          ${eligible.length? eligible.map(i=>`
            <label style="display:flex; align-items:center; gap:8px; padding:5px 0; font-size:12.5px; cursor:pointer;">
              <input type="checkbox" class="pay-inv-check" value="${i.id}" checked>
              <span style="flex:1;">${i.id} · ${i.vendor}</span>
              <span class="mono">${fmtM(i.amount)}</span>
            </label>
          `).join('') : '<div class="section-desc">No approved invoices ready</div>'}
        </div>
      </div>
    `;
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn teal" onclick="submitPaymentProposal()">Create proposal</button>`;
  } else if(kind==='newFxTable'){
    title='New FX Table';
    body = `
      <div class="field"><label>Table name</label><input id="m_name" placeholder="e.g. Q4 Forecast Rates"></div>
      <div class="field-row">
        <div class="field"><label>EUR / USD</label><input id="m_eur" type="number" step="0.001" value="0.92"></div>
        <div class="field"><label>GBP / USD</label><input id="m_gbp" type="number" step="0.001" value="0.79"></div>
      </div>
      <div class="field"><label>RON / USD</label><input id="m_ron" type="number" step="0.001" value="4.56"></div>
    `;
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="submitFxTable()">Create table</button>`;
  } else if(kind==='uploadBudget'){
    title='Upload Budget';
    body = `
      <div class="notice info">Demo mode: this simulates a bulk upload. Use the monthly grid below the report to edit values directly.</div>
      <div class="field"><label>Entity</label><select id="m_entity">${ENTITIES.map(e=>`<option>${e}</option>`).join('')}</select></div>
      <div class="field"><label>File</label><input type="file"></div>
    `;
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="closeModal();toast('Budget file received and applied')">Upload</button>`;
  } else if(kind==='newEntity'){
    title='Add Entity';
    body = entityFormFields({});
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="submitEntity()">Add entity</button>`;
  } else if(kind==='editEntity'){
    const name = UI.modal.payload.name;
    const info = ENTITY_INFO[name] || {};
    title = `Edit ${name}`;
    body = `<input type="hidden" id="m_origname" value="${name}">` + entityFormFields({...info, name});
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="submitEditEntity()">Save changes</button>`;
  } else if(kind==='newDepartment'){
    title='Add Department';
    body = `
      <div class="field"><label>Department name</label><input id="m_name" placeholder="e.g. Customer Success"></div>
    `;
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="submitDepartment()">Add department</button>`;
  } else if(kind==='newCategory'){
    title='Add Expense Category';
    body = `
      <div class="field"><label>Category name</label><input id="m_name" placeholder="e.g. Insurance"></div>
    `;
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="submitCategory()">Add category</button>`;
  } else if(kind==='newSubDept'){
    const dept = UI.modal.payload.dept;
    title = `Add Sub-department — ${dept}`;
    body = `
      <input type="hidden" id="m_dept" value="${dept}">
      <div class="field-row">
        <div class="field"><label>Code</label><input id="m_code" placeholder="e.g. 1300"></div>
        <div class="field"><label>Name</label><input id="m_subname" placeholder="e.g. Internal Audit"></div>
      </div>
    `;
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="submitSubDept()">Add sub-department</button>`;
  } else if(kind==='newEmployee'){
    title='Add Employee';
    body = `
      <div class="field"><label>Full name</label><input id="m_name" placeholder="e.g. Anna Petrova"></div>
      <div class="field-row">
        <div class="field"><label>Department</label><select id="m_dept">${DEPARTMENTS.map(d=>`<option>${d}</option>`).join('')}</select></div>
        <div class="field"><label>Sub-department</label><input id="m_subdept" placeholder="e.g. Internal Audit"></div>
      </div>
      <div class="field-row">
        <div class="field"><label>Role</label><input id="m_role" placeholder="e.g. Budget Owner"></div>
        <div class="field"><label>Email address</label><input id="m_email" type="email" placeholder="e.g. anna.petrova@ledgerline.com"></div>
      </div>
    `;
    footer = `<button class="btn ghost" onclick="closeModal()">Cancel</button><button class="btn primary" onclick="submitEmployee()">Add employee</button>`;
  }
  return `
    <div class="modal-backdrop" onclick="if(event.target===this)closeModal()">
      <div class="modal">
        <div class="modal-head"><div class="section-title" style="margin:0;">${title}</div><button class="btn ghost sm" onclick="closeModal()">✕</button></div>
        <div class="modal-body">${body}</div>
        <div class="modal-foot">${footer}</div>
      </div>
    </div>
  `;
}
function val(id){ return document.getElementById(id).value; }
function submitContract(){
  const id='CT-'+uid();
  const c = ensureContractShape({id,vendor:val('m_vendor'),type:val('m_type'),tool:val('m_tool'),value:parseFloat(val('m_value'))||0,stage:0,status:'Draft',owner:val('m_owner'),start:'',expiry:''});
  CONTRACTS.push(c);
  closeModal(); toast(`${id} created as Draft`); openContractDetail(id);
}
function submitSupplierUpload(){
  const fileInput = document.getElementById('m_file');
  const file = fileInput.files[0];
  if(!file){ toast('Attach the contract file to scan'); return; }
  const vendorName = val('m_vendor');
  const vendor = VENDORS.find(v=>v.name===vendorName);
  const id = 'CT-'+uid();
  const today = todayISO();
  const c = ensureContractShape({
    id, vendor:vendorName, type:'Vendor Agreement', tool:'Docusign CLM', value:Math.round(20000+Math.random()*80000),
    stage:0, status:'Draft', owner:'Maria Ionescu', start:'', expiry:'',
    company: vendor? vendor.entity : ENTITIES[0], contractDate: today, costCenter:'', currency: vendor? vendor.currency : 'USD',
    period:'Not yet effective — drafting in progress',
    purpose:`AI-extracted: ${vendor? vendor.category : 'Services'} agreement with ${vendorName}. Please verify against the source document.`,
    serviceDescription:'AI-extracted summary — confirm scope, deliverables and SLAs against the uploaded document before sending for approval.',
    term:{termType:'Fixed Term', effectiveDate:addDays(today,30), expirationDate:addDays(today,395), noticePeriod:'60 days'},
    aiExtracted:true,
  });
  c.documents.draft.push({name:file.name, date:today});
  c.redFlags = generateRedFlags(c);
  CONTRACTS.push(c);
  closeModal();
  toast(`AI scanned ${file.name} — draft created for review`);
  openContractDetail(id);
}
function generateRedFlags(c){
  const flags = [];
  if(c.term && c.term.termType==='Auto-Renew') flags.push({severity:'Medium', text:'Auto-renewal clause — confirm a cancellation reminder is scheduled before the notice window closes.'});
  if(c.term && parseInt(c.term.noticePeriod)>=90) flags.push({severity:'Low', text:`Long notice period (${c.term.noticePeriod}) — factor this into any exit planning.`});
  if(!c.documents.executed.length) flags.push({severity:'Medium', text:'No fully executed copy on file yet.'});
  if(c.value>150000) flags.push({severity:'High', text:'High contract value — confirm it exceeds the standard approval threshold and has the right sign-off.'});
  if(!c.term || !c.term.effectiveDate || !c.term.expirationDate) flags.push({severity:'Medium', text:'Missing effective or expiration date — confirm term dates before signature.'});
  if(!c.costCenter) flags.push({severity:'Low', text:'No cost center assigned — required for budget tracking.'});
  if(!flags.length) flags.push({severity:'Low', text:'No material issues detected in the standard clause set.'});
  return flags;
}
function scanRedFlags(id){
  const c = CONTRACTS.find(x=>x.id===id);
  c.redFlags = generateRedFlags(c);
  toast('AI red flag scan complete'); render();
}
function submitEditContract(){
  const id = val('m_editId');
  const c = CONTRACTS.find(x=>x.id===id);
  c.company = val('m_company');
  c.contractNumber = val('m_contractNumber');
  c.contractDate = val('m_contractDate');
  c.vendor = val('m_vendor2');
  c.costCenter = val('m_costCenter');
  c.type = val('m_type2');
  c.value = parseFloat(val('m_value2'))||0;
  c.currency = val('m_currency');
  c.period = val('m_period');
  c.purpose = val('m_purpose');
  c.serviceDescription = val('m_serviceDescription');
  c.term = {
    termType: val('m_termType'),
    noticePeriod: val('m_noticePeriod'),
    effectiveDate: val('m_effectiveDate'),
    expirationDate: val('m_expirationDate'),
  };
  closeModal(); toast(`${c.contractNumber} updated`); render();
}
function submitVendor(){
  const id='V-'+uid();
  VENDORS.push({id,name:val('m_name')||'New Vendor',entity:val('m_entity'),category:val('m_cat'),erp:val('m_erp'),status:'Pending',currency:val('m_cur')});
  closeModal(); toast(`${id} created — pending activation`); render();
}
function submitPR(){
  const id='PR-'+uid();
  PRS.push({id,vendor:val('m_vendor'),dept:val('m_dept'),category:val('m_cat'),entity:val('m_entity'),amount:parseFloat(val('m_amount'))||0,stage:1,status:'Pending Approval',requester:'Maria Ionescu',date:todayISO(),po:null});
  closeModal(); toast(`${id} submitted for approval`); render();
}
function submitInvoice(){
  const id='INV-'+uid();
  const amt = parseFloat(val('m_amount'))||0;
  INVOICES.push({id,vendor:val('m_vendor'),po:val('m_po')||null,entity: VENDORS.find(v=>v.name===val('m_vendor'))?.entity||ENTITIES[0],amount:amt,expense:Math.round(amt*0.91),prepaid:0,tax:Math.round(amt*0.09),ap:amt,status:'Pending Approval',stage:1,exportedToERP:false,exportedAt:null,dueDate:val('m_due'),issueDate:todayISO()});
  closeModal(); toast(`${id} logged and routed for approval`); render();
}
function submitVendorInvoiceUpload(){
  const fileInput = document.getElementById('m_file');
  const file = fileInput.files[0];
  if(!file){ toast('Attach the invoice file to scan'); return; }
  const vendorName = val('m_vendor');
  const vendor = VENDORS.find(v=>v.name===vendorName);
  const poId = val('m_po') || null;
  const po = poId ? POS.find(p=>p.id===poId) : null;
  const amt = po ? Math.round((po.amount-po.invoiced) || po.amount*0.3) || Math.round(5000+Math.random()*20000) : Math.round(5000+Math.random()*20000);
  const id = 'INV-'+uid();
  INVOICES.push({
    id, vendor:vendorName, po:poId, entity: vendor? vendor.entity : ENTITIES[0],
    amount:amt, expense:Math.round(amt*0.91), prepaid:0, tax:Math.round(amt*0.09), ap:amt,
    status:'Scanned - Pending Review', stage:0, exportedToERP:false, exportedAt:null,
    dueDate:addDays(todayISO(),30), issueDate:todayISO(), aiScanned:true, attachedFile:file.name,
  });
  closeModal();
  toast(`AI scanned ${file.name} — ${id} created for review`);
  openDrawer('invoice', id);
}
function genBankFileRef(bank, id){
  const fmt = BANK_FORMATS[bank] || '';
  if(fmt.includes('pain.001')) return `pain001_${id}.xml`;
  if(fmt.includes('MT101')) return `MT101_${id}.txt`;
  return `payout_${id}.json`;
}
function submitPaymentProposal(){
  const bankRaw = val('m_bank');
  const bank = bankRaw.split(' — ')[0];
  const checked = Array.from(document.querySelectorAll('.pay-inv-check:checked')).map(el=>el.value);
  if(!checked.length){ toast('Select at least one invoice'); return; }
  const invoices = INVOICES.filter(i=>checked.includes(i.id));
  const total = invoices.reduce((s,i)=>s+i.amount,0);
  const id = 'PP-'+uid();
  PAYMENT_PROPOSALS.push({id, bank, invoiceIds:checked, total, status:'Draft', createdDate:todayISO(), exportedAt:null, fileRef:null});
  closeModal(); toast(`${id} created with ${checked.length} invoice${checked.length>1?'s':''} for ${bank}`); render();
}
function exportPaymentProposal(id){
  const pp = PAYMENT_PROPOSALS.find(x=>x.id===id);
  pp.invoiceIds.forEach(invId=>{
    const inv = INVOICES.find(i=>i.id===invId);
    if(!inv) return;
    inv.status = 'Paid';
    PAYMENTS.push({id:'PMT-'+uid(), invoice:invId, vendor:inv.vendor, amount:inv.amount, date:todayISO(), bank:pp.bank, status:'Completed'});
  });
  pp.status = 'Exported';
  pp.exportedAt = todayISO();
  pp.fileRef = genBankFileRef(pp.bank, pp.id);
  toast(`${pp.invoiceIds.length} payment(s) exported to ${pp.bank} as ${pp.fileRef}`);
  render();
}
function submitFxTable(){
  const name = val('m_name')||'New Table';
  FX_TABLES[name] = {USD:1, EUR:parseFloat(val('m_eur'))||0.92, GBP:parseFloat(val('m_gbp'))||0.79, RON:parseFloat(val('m_ron'))||4.56};
  ACTIVE_FX_TABLE = name;
  closeModal(); toast(`${name} created`); render();
}
function submitEntity(){
  const name = (val('m_name')||'').trim();
  if(!name){ toast('Enter an entity name'); return; }
  if(ENTITIES.includes(name)){ toast(`${name} already exists`); return; }
  ENTITIES.push(name);
  ENTITY_INFO[name] = {
    legalName: val('m_legalName')||name, country: val('m_country'), region: val('m_region'),
    taxId: val('m_taxId'), regId: val('m_regId'), address1: val('m_address1'), address2: val('m_address2'),
    legalReps: val('m_legalReps'), status: val('m_status'),
  };
  closeModal(); toast(`${name} added`); render();
}
function submitEditEntity(){
  const origName = val('m_origname');
  const newName = (val('m_name')||'').trim() || origName;
  const info = {
    legalName: val('m_legalName')||newName, country: val('m_country'), region: val('m_region'),
    taxId: val('m_taxId'), regId: val('m_regId'), address1: val('m_address1'), address2: val('m_address2'),
    legalReps: val('m_legalReps'), status: val('m_status'),
  };
  if(newName !== origName){
    // rename: update ENTITIES list and every record referencing the old entity name
    const idx = ENTITIES.indexOf(origName);
    if(idx>-1) ENTITIES[idx] = newName;
    delete ENTITY_INFO[origName];
    VENDORS.forEach(v=>{ if(v.entity===origName) v.entity=newName; });
    PRS.forEach(p=>{ if(p.entity===origName) p.entity=newName; });
    POS.forEach(p=>{ if(p.entity===origName) p.entity=newName; });
    INVOICES.forEach(i=>{ if(i.entity===origName) i.entity=newName; });
    Object.keys(BUDGET).forEach(k=>{
      if(k.startsWith(origName+'|')){ BUDGET[k.replace(origName+'|', newName+'|')] = BUDGET[k]; delete BUDGET[k]; }
    });
    if(UI.budgetEntity===origName) UI.budgetEntity=newName;
  }
  ENTITY_INFO[newName] = info;
  closeModal(); toast(`${newName} updated`); UI.drawer=null; render();
}
function submitDepartment(){
  const name = (val('m_name')||'').trim();
  if(!name){ toast('Enter a department name'); return; }
  if(DEPARTMENTS.includes(name)){ toast(`${name} already exists`); return; }
  DEPARTMENTS.push(name);
  SUBDEPARTMENTS[name] = [];
  closeModal(); toast(`${name} added`); render();
}
function submitSubDept(){
  const dept = val('m_dept');
  const code = (val('m_code')||'').trim();
  const name = (val('m_subname')||'').trim();
  if(!code || !name){ toast('Enter both a code and a name'); return; }
  if(!SUBDEPARTMENTS[dept]) SUBDEPARTMENTS[dept] = [];
  if(SUBDEPARTMENTS[dept].some(s=>s.code===code)){ toast(`Code ${code} already exists in ${dept}`); return; }
  SUBDEPARTMENTS[dept].push({code,name});
  closeModal(); toast(`${code} ${name} added to ${dept}`); openDrawer('department',dept);
}
function removeSubDept(dept, idx){
  SUBDEPARTMENTS[dept].splice(idx,1);
  toast('Sub-department removed'); openDrawer('department',dept);
}
function submitCategory(){
  const name = (val('m_name')||'').trim();
  if(!name){ toast('Enter a category name'); return; }
  if(EXPENSE_CATEGORIES.includes(name)){ toast(`${name} already exists`); return; }
  EXPENSE_CATEGORIES.push(name);
  closeModal(); toast(`${name} added`); render();
}
function submitEmployee(){
  const name = (val('m_name')||'').trim();
  if(!name){ toast('Enter a name'); return; }
  EMPLOYEES.push({id:uid(), name, dept:val('m_dept'), subDept:(val('m_subdept')||'').trim(), role:(val('m_role')||'').trim()||'Team Member', email:(val('m_email')||'').trim()});
  closeModal(); toast(`${name} added`); render();
}

