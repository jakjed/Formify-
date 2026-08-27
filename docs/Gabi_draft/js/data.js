/* ---------------- Master data ---------------- */
const ENTITIES = ['US HoldCo','UK Ltd','Ireland BV'];
let ENTITY_INFO = {
  'US HoldCo': {
    legalName:'US HoldCo, Inc.', country:'United States', region:'Americas',
    taxId:'84-3021557', regId:'DE-7719021', address1:'251 Little Falls Drive',
    address2:'Wilmington, DE 19808', legalReps:'David Kim (CFO), Sarah Klein (Controller)', status:'Active',
  },
  'UK Ltd': {
    legalName:'UK Ltd', country:'United Kingdom', region:'EMEA',
    taxId:'GB 947 2831 06', regId:'CRN 09182734', address1:'1 Fore Street',
    address2:'London EC2Y 9DT', legalReps:'Tom Whitfield (Director)', status:'Active',
  },
  'Ireland BV': {
    legalName:'Ireland Operations B.V.', country:'Ireland', region:'EMEA',
    taxId:'IE 6392847 K', regId:'CRO 618734', address1:'2 Grand Canal Square',
    address2:'Dublin D02 A342', legalReps:'James Okafor (Director)', status:'Dormant',
  },
};
const DEPARTMENTS = ['G&A','R&D','Sales & Marketing','Finance','Operations'];
let SUBDEPARTMENTS = {
  'G&A': [ {code:'1000',name:'G&A'}, {code:'1100',name:'Compliance'}, {code:'1200',name:'Legal'} ],
  'R&D': [ {code:'2000',name:'Development'}, {code:'2100',name:'Q&A'}, {code:'2200',name:'Product Management'} ],
  'Sales & Marketing': [ {code:'3000',name:'Sales'}, {code:'3100',name:'Marketing'} ],
  'Finance': [ {code:'4000',name:'Accounting'}, {code:'4100',name:'Tax'}, {code:'4200',name:'FP&A'}, {code:'4300',name:'Finance General'} ],
  'Operations': [ {code:'5000',name:'Customer Support'}, {code:'5100',name:'Merchant Support'}, {code:'5200',name:'Underwriting'} ],
};
const EXPENSE_CATEGORIES = ['Software & SaaS','Professional Services','Marketing','Facilities','Travel & Entertainment','Consulting'];
const APPROVAL_CHAIN = ['Budget Owner','Legal','Tax','Compliance','Finance','CFO'];
const CONTRACT_APPROVAL = ['Budget Owner','Legal','Tax','Compliance','Finance'];
const INVOICE_APPROVAL = ['Cost Center Owner','AP Manager','Finance'];
const ACCRUAL_APPROVAL = ['AP Manager','Controller'];
const BANKS = ['Payoneer','JPMorgan Chase','Citibank','HSBC','Wise','Deutsche Bank'];
const BANK_FORMATS = {
  'Payoneer':'API push (JSON)', 'JPMorgan Chase':'ISO 20022 pain.001 XML', 'Citibank':'ISO 20022 pain.001 XML',
  'HSBC':'SWIFT MT101', 'Wise':'API push (JSON)', 'Deutsche Bank':'SWIFT MT101',
};
const CLM_TOOLS = ['Conga','Docusign CLM','PandaDoc','IronClad'];

const EMPLOYEES = [
  {id:1,name:'Maria Ionescu',dept:'Finance',subDept:'Accounting',role:'AP Manager',email:'maria.ionescu@ledgerline.com'},
  {id:2,name:'Tom Whitfield',dept:'G&A',subDept:'G&A',role:'Budget Owner',email:'tom.whitfield@ledgerline.com'},
  {id:3,name:'Priya Nair',dept:'R&D',subDept:'Development',role:'Budget Owner',email:'priya.nair@ledgerline.com'},
  {id:4,name:'Diego Alvarez',dept:'Sales & Marketing',subDept:'Marketing',role:'Budget Owner',email:'diego.alvarez@ledgerline.com'},
  {id:5,name:'Sarah Klein',dept:'Finance',subDept:'Accounting',role:'Controller',email:'sarah.klein@ledgerline.com'},
  {id:6,name:'James Okafor',dept:'Operations',subDept:'Customer Support',role:'Budget Owner',email:'james.okafor@ledgerline.com'},
  {id:7,name:'Elena Popescu',dept:'Finance',subDept:'Finance General',role:'Legal Counsel',email:'elena.popescu@ledgerline.com'},
  {id:8,name:'Robert Zhang',dept:'Finance',subDept:'Tax',role:'Tax Manager',email:'robert.zhang@ledgerline.com'},
  {id:9,name:'Linda Moreau',dept:'Finance',subDept:'Finance General',role:'Compliance Officer',email:'linda.moreau@ledgerline.com'},
  {id:10,name:'David Kim',dept:'Finance',subDept:'Finance General',role:'CFO',email:'david.kim@ledgerline.com'},
];

/* FX tables: reporting currency USD */
let FX_TABLES = {
  'Corporate Standard': {USD:1, EUR:0.925, GBP:0.79, RON:4.58},
  'Q3 Budget Rates': {USD:1, EUR:0.91, GBP:0.785, RON:4.55},
};
let ACTIVE_FX_TABLE = 'Corporate Standard';

/* ---------------- Vendors ---------------- */
let VENDORS = [
  {id:'V-1001',name:'Nimbus Cloud Systems',entity:'US HoldCo',category:'Software & SaaS',erp:'NetSuite',status:'Active',currency:'USD'},
  {id:'V-1002',name:'Halberd Legal Partners',entity:'UK Ltd',category:'Professional Services',erp:'SAP',status:'Active',currency:'GBP'},
  {id:'V-1003',name:'Meridian Marketing Group',entity:'US HoldCo',category:'Marketing',erp:'NetSuite',status:'Active',currency:'USD'},
  {id:'V-1004',name:'Kilbride Facilities Ltd',entity:'Ireland BV',category:'Facilities',erp:'Oracle',status:'Active',currency:'EUR'},
  {id:'V-1005',name:'Aster Consulting',entity:'US HoldCo',category:'Consulting',erp:'NetSuite',status:'Pending',currency:'USD'},
  {id:'V-1006',name:'Voyage Travel Co',entity:'UK Ltd',category:'Travel & Entertainment',erp:'SAP',status:'Active',currency:'GBP'},
  {id:'V-1007',name:'Orbital Data Labs',entity:'US HoldCo',category:'Software & SaaS',erp:'NetSuite',status:'Active',currency:'USD'},
  {id:'V-1008',name:'Fenwick Tax Advisory',entity:'Ireland BV',category:'Professional Services',erp:'Oracle',status:'Inactive',currency:'EUR'},
];

/* ---------------- Contracts ---------------- */
let CONTRACTS = [
  {id:'CT-3001',vendor:'Nimbus Cloud Systems',type:'Vendor Agreement',tool:'Docusign CLM',value:184000,stage:6,status:'Signed',owner:'Tom Whitfield',start:'2025-11-01',expiry:'2026-10-31',
    company:'US HoldCo',contractNumber:'AGR-2025-1001',contractDate:'2025-10-22',costCenter:'2000 Development',currency:'USD',
    period:'12 months (Nov 1, 2025 – Oct 31, 2026)',purpose:'Cloud infrastructure hosting for the production environment.',
    serviceDescription:'Provision of cloud compute, storage and managed database services supporting the core production platform, including 24/7 monitoring and a 99.9% uptime SLA.',
    term:{termType:'Auto-Renew', effectiveDate:'2025-11-01', expirationDate:'2026-10-31', noticePeriod:'60 days'},
    documents:{draft:[{name:'Nimbus_MSA_draft_v3.docx',date:'2025-10-05'}], executed:[{name:'Nimbus_MSA_executed.pdf',date:'2025-10-30'}], correspondence:[{name:'Renewal_terms_email_thread.pdf',date:'2025-10-18'}], paymentForm:[{name:'Nimbus_ACH_form.pdf',date:'2025-10-28'}], misc:[], others:[]},
    signature:{status:'Completed', envelopeId:'DS-88213', sentAt:'2025-10-27', signers:[
      {name:'Tom Whitfield', role:'Budget Owner', status:'Signed', signedAt:'2025-10-28'},
      {name:'David Kim', role:'CFO', status:'Signed', signedAt:'2025-10-29'},
      {name:'Nimbus Cloud Systems Representative', role:'Vendor signatory', status:'Signed', signedAt:'2025-10-30'},
    ]},
  },
  {id:'CT-3002',vendor:'Halberd Legal Partners',type:'New Agreement',tool:'IronClad',value:96000,stage:2,status:'Under Approval',owner:'Elena Popescu',start:'',expiry:'',
    company:'UK Ltd',contractNumber:'AGR-2026-1002',contractDate:'2026-08-01',costCenter:'1200 Legal',currency:'GBP',
    period:'Not yet effective — pending approval',purpose:'Outside counsel for corporate and commercial legal matters.',
    serviceDescription:'General corporate legal advisory, contract review and support on commercial disputes for the UK entity, billed at agreed hourly rates with a monthly cap.',
    term:{termType:'Fixed Term', effectiveDate:'2026-09-01', expirationDate:'2027-08-31', noticePeriod:'90 days'},
    documents:{draft:[{name:'Halberd_Agreement_draft_v1.docx',date:'2026-08-01'}], executed:[], correspondence:[{name:'Scope_clarification_email.pdf',date:'2026-08-10'}], paymentForm:[], misc:[], others:[]},
  },
  {id:'CT-3003',vendor:'Meridian Marketing Group',type:'Vendor Agreement',tool:'PandaDoc',value:220000,stage:6,status:'Signed',owner:'Diego Alvarez',start:'2025-06-01',expiry:'2026-09-15',
    company:'US HoldCo',contractNumber:'AGR-2025-1003',contractDate:'2025-05-18',costCenter:'3100 Marketing',currency:'USD',
    period:'15 months (Jun 1, 2025 – Sep 15, 2026)',purpose:'Retained agency for brand campaigns and demand generation.',
    serviceDescription:'Full-funnel marketing services including paid media management, brand campaigns, content production and quarterly performance reporting.',
    term:{termType:'Fixed Term', effectiveDate:'2025-06-01', expirationDate:'2026-09-15', noticePeriod:'60 days'},
    documents:{draft:[{name:'Meridian_SOW_draft.docx',date:'2025-05-10'}], executed:[{name:'Meridian_SOW_executed.pdf',date:'2025-05-30'}], correspondence:[], paymentForm:[{name:'Meridian_wire_instructions.pdf',date:'2025-05-28'}], misc:[{name:'Q1_campaign_brief.pdf',date:'2026-01-12'}], others:[]},
    signature:{status:'Completed', envelopeId:'DS-77410', sentAt:'2025-05-27', signers:[
      {name:'Diego Alvarez', role:'Budget Owner', status:'Signed', signedAt:'2025-05-28'},
      {name:'David Kim', role:'CFO', status:'Signed', signedAt:'2025-05-29'},
      {name:'Meridian Marketing Group Representative', role:'Vendor signatory', status:'Signed', signedAt:'2025-05-30'},
    ]},
  },
  {id:'CT-3004',vendor:'Aster Consulting',type:'New Agreement',tool:'Conga',value:75000,stage:0,status:'Draft',owner:'Sarah Klein',start:'',expiry:'',
    company:'US HoldCo',contractNumber:'AGR-2026-1004',contractDate:'2026-08-15',costCenter:'1000 G&A',currency:'USD',
    period:'Not yet effective — drafting in progress',purpose:'Finance transformation advisory engagement.',
    serviceDescription:'Advisory support for close-process redesign and month-end reporting improvements, delivered over a fixed-fee, milestone-based engagement.',
    term:{termType:'Fixed Term', effectiveDate:'2026-09-15', expirationDate:'2027-03-14', noticePeriod:'30 days'},
    documents:{draft:[{name:'Aster_SOW_draft_v1.docx',date:'2026-08-15'}], executed:[], correspondence:[], paymentForm:[], misc:[], others:[]},
  },
  {id:'CT-3005',vendor:'Kilbride Facilities Ltd',type:'Vendor Agreement',tool:'Docusign CLM',value:132000,stage:6,status:'Signed',owner:'James Okafor',start:'2025-01-01',expiry:'2026-09-05',
    company:'Ireland BV',contractNumber:'AGR-2025-1005',contractDate:'2024-12-10',costCenter:'1000 G&A',currency:'EUR',
    period:'20 months (Jan 1, 2025 – Sep 5, 2026)',purpose:'Facilities management for the Dublin office.',
    serviceDescription:'Day-to-day facilities management, maintenance and reception services for the Dublin office, including quarterly health & safety inspections.',
    term:{termType:'Auto-Renew', effectiveDate:'2025-01-01', expirationDate:'2026-09-05', noticePeriod:'90 days'},
    documents:{draft:[{name:'Kilbride_Agreement_draft.docx',date:'2024-11-20'}], executed:[{name:'Kilbride_Agreement_executed.pdf',date:'2024-12-28'}], correspondence:[], paymentForm:[{name:'Kilbride_SEPA_form.pdf',date:'2024-12-22'}], misc:[], others:[{name:'Insurance_certificate.pdf',date:'2025-01-05'}]},
    signature:{status:'Completed', envelopeId:'DS-65209', sentAt:'2024-12-20', signers:[
      {name:'James Okafor', role:'Budget Owner', status:'Signed', signedAt:'2024-12-22'},
      {name:'David Kim', role:'CFO', status:'Signed', signedAt:'2024-12-26'},
      {name:'Kilbride Facilities Ltd Representative', role:'Vendor signatory', status:'Signed', signedAt:'2024-12-28'},
    ]},
  },
  {id:'CT-3006',vendor:'Orbital Data Labs',type:'Vendor Agreement',tool:'PandaDoc',value:58000,stage:6,status:'Pending Signature',owner:'Priya Nair',start:'',expiry:'',
    company:'US HoldCo',contractNumber:'AGR-2026-1006',contractDate:'2026-07-28',costCenter:'2100 Q&A',currency:'USD',
    period:'Not yet effective — pending signature',purpose:'Data quality and testing tooling for the analytics platform.',
    serviceDescription:'License and support for a data-quality testing suite used to validate ETL pipelines feeding the analytics platform.',
    term:{termType:'Auto-Renew', effectiveDate:'2026-09-01', expirationDate:'2027-08-31', noticePeriod:'60 days'},
    documents:{draft:[{name:'Orbital_Order_Form_draft.pdf',date:'2026-07-28'}], executed:[], correspondence:[{name:'Compliance_review_notes.pdf',date:'2026-08-05'}], paymentForm:[], misc:[], others:[]},
    signature:{status:'Sent', envelopeId:'DS-90144', sentAt:'2026-08-18', signers:[
      {name:'Priya Nair', role:'Budget Owner', status:'Signed', signedAt:'2026-08-19'},
      {name:'David Kim', role:'CFO', status:'Sent', signedAt:null},
      {name:'Orbital Data Labs Representative', role:'Vendor signatory', status:'Sent', signedAt:null},
    ]},
  },
];
function ensureContractShape(c){
  if(!c.documents) c.documents = {draft:[],executed:[],correspondence:[],paymentForm:[],misc:[],others:[]};
  if(!c.term) c.term = {termType:'Fixed Term', effectiveDate:c.start||'', expirationDate:c.expiry||'', noticePeriod:'60 days'};
  if(!c.company) c.company = VENDORS.find(v=>v.name===c.vendor)?.entity || ENTITIES[0];
  if(!c.contractNumber) c.contractNumber = 'AGR-'+c.id.replace('CT-','');
  if(!c.contractDate) c.contractDate = todayISO();
  if(!c.costCenter) c.costCenter = '';
  if(!c.currency) c.currency = VENDORS.find(v=>v.name===c.vendor)?.currency || 'USD';
  if(!c.period) c.period = (c.start && c.expiry) ? `${c.start} – ${c.expiry}` : 'Not yet effective';
  if(!c.purpose) c.purpose = '';
  if(!c.serviceDescription) c.serviceDescription = '';
  if(!c.signature) c.signature = {status:'Not started', envelopeId:null, sentAt:null, signers:[]};
  return c;
}
function initSignatureEnvelope(c){
  c.signature = {
    status:'Not started', envelopeId:null, sentAt:null,
    signers:[
      {name:c.owner, role:'Budget Owner', status:'Waiting', signedAt:null},
      {name:'David Kim', role:'CFO', status:'Waiting', signedAt:null},
      {name:`${c.vendor} Representative`, role:'Vendor signatory', status:'Waiting', signedAt:null},
    ],
  };
}

/* ---------------- Purchase Requests / POs ---------------- */
let PRS = [
  {id:'PR-5001',vendor:'Nimbus Cloud Systems',dept:'R&D',category:'Software & SaaS',entity:'US HoldCo',amount:42000,stage:7,status:'Approved',requester:'Priya Nair',date:'2026-07-02',po:'PO-7001'},
  {id:'PR-5002',vendor:'Meridian Marketing Group',dept:'Sales & Marketing',category:'Marketing',entity:'US HoldCo',amount:65000,stage:7,status:'Approved',requester:'Diego Alvarez',date:'2026-07-10',po:'PO-7002'},
  {id:'PR-5003',vendor:'Aster Consulting',dept:'G&A',category:'Consulting',entity:'US HoldCo',amount:28000,stage:3,status:'Pending Approval',requester:'Tom Whitfield',date:'2026-08-01',po:null},
  {id:'PR-5004',vendor:'Voyage Travel Co',dept:'Sales & Marketing',category:'Travel & Entertainment',entity:'UK Ltd',amount:9200,stage:7,status:'Approved',requester:'Diego Alvarez',date:'2026-07-18',po:'PO-7003'},
  {id:'PR-5005',vendor:'Kilbride Facilities Ltd',dept:'Operations',category:'Facilities',entity:'Ireland BV',amount:31500,stage:7,status:'Approved',requester:'James Okafor',date:'2026-06-28',po:'PO-7004'},
  {id:'PR-5006',vendor:'Orbital Data Labs',dept:'R&D',category:'Software & SaaS',entity:'US HoldCo',amount:18700,stage:2,status:'Pending Approval',requester:'Priya Nair',date:'2026-08-11',po:null},
  {id:'PR-5007',vendor:'Halberd Legal Partners',dept:'G&A',category:'Professional Services',entity:'UK Ltd',amount:54000,stage:7,status:'Approved',requester:'Tom Whitfield',date:'2026-05-20',po:'PO-7005'},
  {id:'PR-5008',vendor:'Fenwick Tax Advisory',dept:'Finance',category:'Professional Services',entity:'Ireland BV',amount:12800,stage:1,status:'Pending Approval',requester:'Sarah Klein',date:'2026-08-15',po:null},
];
let POS = [
  {id:'PO-7001',pr:'PR-5001',vendor:'Nimbus Cloud Systems',entity:'US HoldCo',amount:42000,invoiced:42000,status:'Fully Invoiced'},
  {id:'PO-7002',pr:'PR-5002',vendor:'Meridian Marketing Group',entity:'US HoldCo',amount:65000,invoiced:38000,status:'Open'},
  {id:'PO-7003',pr:'PR-5004',vendor:'Voyage Travel Co',entity:'UK Ltd',amount:9200,invoiced:9200,status:'Fully Invoiced'},
  {id:'PO-7004',pr:'PR-5005',vendor:'Kilbride Facilities Ltd',entity:'Ireland BV',amount:31500,invoiced:15750,status:'Open'},
  {id:'PO-7005',pr:'PR-5007',vendor:'Halberd Legal Partners',entity:'UK Ltd',amount:54000,invoiced:27000,status:'Open'},
];

/* ---------------- PR Proposals (AI, from signed agreements) ---------------- */
function deptFromCostCenter(costCenter){
  for(const d of DEPARTMENTS){ if((SUBDEPARTMENTS[d]||[]).some(s=>`${s.code} ${s.name}`===costCenter)) return d; }
  return DEPARTMENTS[0];
}
let PR_PROPOSALS = [];
function generatePRProposal(c){
  const vendor = VENDORS.find(v=>v.name===c.vendor);
  const proposal = {
    id:'PRP-'+uid(), contractId:c.id, contractNumber:c.contractNumber, vendor:c.vendor,
    entity:c.company, dept: c.costCenter? deptFromCostCenter(c.costCenter) : DEPARTMENTS[0],
    category: vendor? vendor.category : EXPENSE_CATEGORIES[0],
    amount: c.value, currency:c.currency, createdDate: todayISO(),
    notes:`AI-generated from signed contract ${c.contractNumber}.`,
  };
  PR_PROPOSALS.push(proposal);
  return proposal;
}
// Seed one proposal so the review queue isn't empty on load
generatePRProposal(CONTRACTS.find(c=>c.id==='CT-3001'));

/* ---------------- AP Accruals (generated from open POs) ---------------- */
let AP_ACCRUALS = [];
function generateAccrualsFromPOs(){
  let created = 0;
  POS.forEach(po=>{
    const remaining = po.amount - po.invoiced;
    if(remaining<=0) return;
    const existing = AP_ACCRUALS.find(a=>a.poId===po.id && a.status!=='Posted');
    if(existing){ existing.amount = remaining; return; }
    const vendor = VENDORS.find(v=>v.name===po.vendor);
    const pr = PRS.find(p=>p.id===po.pr);
    AP_ACCRUALS.push({
      id:'ACR-'+uid(), poId:po.id, vendor:po.vendor, entity:po.entity,
      dept: pr? pr.dept : DEPARTMENTS[0], category: vendor? vendor.category : EXPENSE_CATEGORIES[0],
      amount: remaining, status:'Draft', stage:0, createdDate: todayISO(),
    });
    created++;
  });
  return created;
}

/* ---------------- Invoices ---------------- */
let INVOICES = [
  {id:'INV-9001',vendor:'Nimbus Cloud Systems',po:'PO-7001',entity:'US HoldCo',amount:42000,expense:38000,prepaid:0,tax:4000,ap:42000,status:'Paid',dueDate:'2026-07-30',issueDate:'2026-07-05',stage:4,exportedToERP:true,exportedAt:'2026-07-06'},
  {id:'INV-9002',vendor:'Meridian Marketing Group',po:'PO-7002',entity:'US HoldCo',amount:19000,expense:17300,prepaid:0,tax:1700,ap:19000,status:'Approved',dueDate:'2026-09-05',issueDate:'2026-08-08',stage:4,exportedToERP:true,exportedAt:'2026-08-09'},
  {id:'INV-9003',vendor:'Meridian Marketing Group',po:'PO-7002',entity:'US HoldCo',amount:19000,expense:17300,prepaid:0,tax:1700,ap:19000,status:'Pending Approval',dueDate:'2026-09-20',issueDate:'2026-08-18',stage:2,exportedToERP:false,exportedAt:null},
  {id:'INV-9004',vendor:'Voyage Travel Co',po:'PO-7003',entity:'UK Ltd',amount:9200,expense:9200,prepaid:0,tax:0,ap:9200,status:'Paid',dueDate:'2026-08-01',issueDate:'2026-07-12',stage:4,exportedToERP:true,exportedAt:'2026-07-13'},
  {id:'INV-9005',vendor:'Kilbride Facilities Ltd',po:'PO-7004',entity:'Ireland BV',amount:15750,expense:14300,prepaid:0,tax:1450,ap:15750,status:'Approved',dueDate:'2026-08-28',issueDate:'2026-08-01',stage:4,exportedToERP:true,exportedAt:'2026-08-02'},
  {id:'INV-9006',vendor:'Halberd Legal Partners',po:'PO-7005',entity:'UK Ltd',amount:27000,expense:24500,prepaid:0,tax:2500,ap:27000,status:'Pending Approval',dueDate:'2026-09-12',issueDate:'2026-08-19',stage:1,exportedToERP:false,exportedAt:null},
  {id:'INV-9007',vendor:'Nimbus Cloud Systems',po:null,entity:'US HoldCo',amount:15000,expense:0,prepaid:15000,tax:0,ap:15000,status:'Approved',dueDate:'2026-09-01',issueDate:'2026-08-01',stage:4,exportedToERP:true,exportedAt:'2026-08-02'},
  {id:'INV-9008',vendor:'Orbital Data Labs',po:null,entity:'US HoldCo',amount:6200,expense:5640,prepaid:0,tax:560,ap:6200,status:'Pending Approval',dueDate:'2026-08-25',issueDate:'2026-08-17',stage:1,exportedToERP:false,exportedAt:null},
];
function ensureInvoiceShape(i){
  if(i.stage===undefined) i.stage = i.status==='Pending Approval' ? 1 : 0;
  if(i.exportedToERP===undefined) i.exportedToERP = false;
  if(i.exportedAt===undefined) i.exportedAt = null;
  return i;
}

/* ---------------- Payments ---------------- */
let PAYMENTS = [
  {id:'PMT-1',invoice:'INV-9001',vendor:'Nimbus Cloud Systems',amount:42000,date:'2026-07-29',bank:'Payoneer',status:'Completed'},
  {id:'PMT-2',invoice:'INV-9004',vendor:'Voyage Travel Co',amount:9200,date:'2026-07-31',bank:'HSBC',status:'Completed'},
];
let PAYMENT_PROPOSALS = [];

/* ---------------- Budget (Entity x Dept x Category x Month), simplified to Dept x Month for demo ---------------- */
let BUDGET = {}; // key: `${entity}|${dept}|${month}` -> amount
(function seedBudget(){
  ENTITIES.forEach(e=>{
    DEPARTMENTS.forEach(d=>{
      for(let m=0;m<12;m++){
        const base = {'G&A':22000,'R&D':38000,'Sales & Marketing':45000,'Finance':16000,'Operations':21000}[d];
        const entityMul = e==='US HoldCo'?1:e==='UK Ltd'?0.55:0.32;
        BUDGET[`${e}|${d}|${m}`] = Math.round(base*entityMul*(0.9+Math.random()*0.2));
      }
    });
  });
})();

