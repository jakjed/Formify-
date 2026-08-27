/* ---------- PAYMENTS ---------- */
function viewPayments(){
  const approved = INVOICES.filter(i=>i.status==='Approved').sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const notes = computeNotifications().filter(n=>n.text.includes('Invoice'));
  return `
    <div class="grid-2 row-gap">
      <div class="card card-pad">
        <div class="section-title">Cash-flow forecast — vendor payments</div>
        <div class="section-desc">Based on invoice due dates, next 8 weeks</div>
        <div class="chart-box"><canvas id="chartCashflow"></canvas></div>
      </div>
      <div class="card card-pad">
        <div class="section-title">Due-date notifications</div>
        <div class="section-desc">Sent to the AP team as invoices approach their due date</div>
        ${notes.length? notes.map(n=>`<div class="notice ${n.type}">⚠ ${n.text}</div>`).join('') : `<div class="empty">Nothing due in the next 14 days</div>`}
      </div>
    </div>

    <div class="card card-pad row-gap">
      <div class="toolbar" style="margin-bottom:10px;">
        <div>
          <div class="section-title" style="margin:0;">Payment proposals</div>
          <div class="section-desc">Group approved invoices into a proposal, then export it to the chosen bank</div>
        </div>
        <button class="btn teal" onclick="openModal('newPaymentProposal')">Create Payment Proposal</button>
      </div>
      ${PAYMENT_PROPOSALS.length? PAYMENT_PROPOSALS.map(pp=>`
        <div style="border:1px solid var(--line); border-radius:10px; padding:14px; margin-bottom:10px;">
          <div class="toolbar" style="margin-bottom:8px;">
            <div>
              <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:600; font-size:13px;">${pp.id} · ${pp.bank}</span>
                <span class="badge b-grey">${BANK_FORMATS[pp.bank]||'File export'}</span>
                ${statusBadge(pp.status==='Exported'?'Completed':'Draft')}
              </div>
              <div class="section-desc">${pp.invoiceIds.length} invoice${pp.invoiceIds.length>1?'s':''} · ${fmtM(pp.total)}${pp.fileRef? ` · ${pp.fileRef}` : ''}</div>
            </div>
            ${pp.status==='Draft' ? `<button class="btn primary sm" onclick="exportPaymentProposal('${pp.id}')">Export to Bank</button>` : `<span class="section-desc" style="margin:0;">Sent ${pp.exportedAt}</span>`}
          </div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            ${pp.invoiceIds.map(iid=>{ const inv=INVOICES.find(i=>i.id===iid); return `<span class="badge b-grey">${iid} · ${inv? fmtM(inv.amount):''}</span>`; }).join('')}
          </div>
        </div>
      `).join('') : `<div class="empty">No payment proposals yet — create one from approved invoices</div>`}
    </div>

    <div class="grid-2 row-gap">
      <div class="card card-pad">
        <div class="section-title">Approved invoices</div>
        <div class="section-desc">Ready to be included in a payment proposal</div>
        <table>
          <thead><tr><th>Invoice</th><th>Vendor</th><th>Amount</th><th>Due date</th></tr></thead>
          <tbody>${approved.length? approved.map(i=>`
            <tr><td class="mono">${i.id}</td><td>${i.vendor}</td><td class="mono">${fmtM(i.amount)}</td><td class="mono">${i.dueDate}</td></tr>
          `).join('') : `<tr><td colspan="4"><div class="empty">Nothing approved and unpaid right now</div></td></tr>`}</tbody>
        </table>
      </div>
      <div class="card card-pad">
        <div class="section-title">Bank integrations</div>
        <div class="section-desc">Export formats used per bank when a proposal is sent</div>
        ${BANKS.map(b=>`<div class="kv"><span class="k">${b}</span><span class="v" style="font-weight:400;">${BANK_FORMATS[b]||'—'}</span></div>`).join('')}
      </div>
    </div>

    <div class="card card-pad">
      <div class="section-title">Payment history</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Payment</th><th>Invoice</th><th>Vendor</th><th>Amount</th><th>Bank</th><th>Date</th><th>Status</th></tr></thead>
        <tbody>${PAYMENTS.map(p=>`
          <tr><td class="mono">${p.id}</td><td class="mono">${p.invoice}</td><td>${p.vendor}</td>
          <td class="mono">${fmtM(p.amount)}</td><td>${p.bank}</td><td class="mono">${p.date}</td><td>${statusBadge(p.status)}</td></tr>
        `).join('')}</tbody>
      </table></div>
    </div>
  `;
}

/* ---------- FX ---------- */
function viewFx(){
  const tables = Object.keys(FX_TABLES);
  return `
    <div class="tag-strip">
      ${tables.map(t=>`<div class="tag-btn ${ACTIVE_FX_TABLE===t?'active':''}" onclick="ACTIVE_FX_TABLE='${t}';render()">${t}</div>`).join('')}
      <div class="tag-btn" onclick="openModal('newFxTable')" style="border-style:dashed;">+ New table</div>
    </div>
    <div class="grid-2">
      <div class="card card-pad">
        <div class="section-title">${ACTIVE_FX_TABLE}</div>
        <div class="section-desc">Base rates entered to USD · rates to EUR and GBP are derived automatically</div>
        <table>
          <thead><tr><th>Currency</th><th>Rate to USD</th><th>Rate to EUR</th><th>Rate to GBP</th></tr></thead>
          <tbody>${Object.entries(FX_TABLES[ACTIVE_FX_TABLE]).map(([cur,rate])=>{
            const table = FX_TABLES[ACTIVE_FX_TABLE];
            const toEur = table['EUR'] ? rate/table['EUR'] : null;
            const toGbp = table['GBP'] ? rate/table['GBP'] : null;
            return `<tr>
              <td>${cur}</td>
              <td class="mono"><input style="width:80px;border:1px solid var(--line);border-radius:6px;padding:4px 6px;font-family:inherit;" value="${rate}" onchange="FX_TABLES['${ACTIVE_FX_TABLE}']['${cur}']=parseFloat(this.value)||0;render()"></td>
              <td class="mono">${cur==='EUR' ? '1.0000' : (toEur!==null? toEur.toFixed(4) : '—')}</td>
              <td class="mono">${cur==='GBP' ? '1.0000' : (toGbp!==null? toGbp.toFixed(4) : '—')}</td>
            </tr>`;
          }).join('')}</tbody>
        </table>
      </div>
      <div class="card card-pad">
        <div class="section-title">Converted vendor spend preview</div>
        <div class="section-desc">Total invoiced amount per vendor currency, converted using ${ACTIVE_FX_TABLE}</div>
        ${Object.entries(groupBy(INVOICES,'entity')).map(()=>``).join('')}
        <table>
          <thead><tr><th>Vendor currency</th><th>Native total</th><th>USD equivalent</th></tr></thead>
          <tbody>${(()=>{
            const byCur={};
            INVOICES.forEach(i=>{
              const v = VENDORS.find(v=>v.name===i.vendor);
              const cur = v? v.currency : 'USD';
              byCur[cur] = (byCur[cur]||0) + i.amount;
            });
            return Object.entries(byCur).map(([cur,amt])=>{
              const rate = FX_TABLES[ACTIVE_FX_TABLE][cur] ?? 1;
              return `<tr><td>${cur}</td><td class="mono">${fmtM(amt,cur)}</td><td class="mono">${fmtM(amt*rate,'USD')}</td></tr>`;
            }).join('');
          })()}</tbody>
        </table>
      </div>
    </div>
  `;
}
function groupBy(arr,key){ return arr.reduce((acc,x)=>{ (acc[x[key]]=acc[x[key]]||[]).push(x); return acc; },{}); }

