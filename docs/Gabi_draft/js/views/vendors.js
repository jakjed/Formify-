/* ---------- VENDORS ---------- */
function viewVendors(){
  const q = (UI.vendorFilter||'').trim().toLowerCase();
  const entityFilter = UI.vendorEntityFilter || 'All';
  const filtered = VENDORS.filter(v=>
    (entityFilter==='All' || v.entity===entityFilter) &&
    (!q || v.name.toLowerCase().includes(q) || v.id.toLowerCase().includes(q))
  );
  const rows = filtered.map(v=>{
    const spend = INVOICES.filter(i=>i.vendor===v.name).reduce((s,i)=>s+i.amount,0);
    const pendingProposals = PR_PROPOSALS.filter(p=>p.vendor===v.name).length;
    return `<tr class="clickable" onclick="openDrawer('vendor','${v.id}')">
      <td class="mono">${v.id}</td>
      <td>${v.name}${pendingProposals? ` <span class="badge b-indigo">✦ ${pendingProposals} PR proposal${pendingProposals>1?'s':''}</span>`:''}</td>
      <td>${v.entity}</td>
      <td>${v.category}</td>
      <td>${statusBadge(v.status)}</td>
      <td><span class="badge b-grey">${v.erp}</span></td>
      <td class="mono">${fmtM(spend, v.currency)}</td>
    </tr>`;
  }).join('');
  return `
    <div class="toolbar">
      <div style="display:flex;gap:8px;">
        <input id="vendorSearch" class="search" placeholder="Search vendors…" value="${UI.vendorFilter||''}" oninput="UI.vendorFilter=this.value;render()">
        <select class="filter" onchange="UI.vendorEntityFilter=this.value;render()">
          <option value="All" ${entityFilter==='All'?'selected':''}>All entities</option>
          ${ENTITIES.map(e=>`<option ${entityFilter===e?'selected':''}>${e}</option>`).join('')}
        </select>
      </div>
      <button class="btn primary" onclick="openModal('newVendor')">+ Create Vendor</button>
    </div>
    <div class="card">
      <div class="table-wrap"><table>
        <thead><tr><th>ID</th><th>Vendor</th><th>Entity</th><th>Category</th><th>Status</th><th>ERP</th><th>Total Spend</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="7"><div class="empty">No vendors match your filters</div></td></tr>`}</tbody>
      </table></div>
    </div>
  `;
}

