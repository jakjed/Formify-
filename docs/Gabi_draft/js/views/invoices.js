/* ---------- INVOICES ---------- */
function viewInvoices(){
  const filtered = INVOICES.filter(i=> UI.invFilter==='All' || i.status===UI.invFilter);
  const rows = filtered.map(i=>`
    <tr class="clickable" onclick="openDrawer('invoice','${i.id}')">
      <td class="mono">${i.id}${i.aiScanned?' <span class="badge b-indigo">✦ AI</span>':''}</td>
      <td>${i.vendor}</td>
      <td class="mono">${i.po||'—'}</td>
      <td>${i.entity}</td>
      <td class="mono">${fmtM(i.amount)}</td>
      <td>${statusBadge(i.status)}</td>
      <td class="mono">${i.dueDate}</td>
    </tr>
  `).join('');
  return `
    <div class="tag-strip">
      ${['All','Scanned - Pending Review','Pending Approval','Approved','Paid'].map(f=>`<div class="tag-btn ${UI.invFilter===f?'active':''}" onclick="UI.invFilter='${f}';render()">${f}</div>`).join('')}
    </div>
    <div class="toolbar">
      <div class="section-desc" style="margin:0;">${filtered.length} invoices · ${fmtM(filtered.reduce((s,i)=>s+i.amount,0))} total</div>
      <div style="display:flex; gap:8px;">
        <button class="btn ghost" onclick="openModal('uploadVendorInvoice')">✦ Upload Invoice &amp; Scan with AI</button>
        <button class="btn primary" onclick="openModal('newInvoice')">+ Log Invoice</button>
      </div>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>Invoice</th><th>Vendor</th><th>PO</th><th>Entity</th><th>Amount</th><th>Status</th><th>Due</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
    </div>
  `;
}

