/* ---------------- Notifications ---------------- */
function computeNotifications(){
  const notes=[];
  CONTRACTS.filter(c=>c.expiry).forEach(c=>{
    const d = daysBetween(todayISO(), c.expiry);
    if(d>=0 && d<=60) notes.push({type:'warn', text:`Contract ${c.id} (${c.vendor}) expires in ${d} days — ${c.expiry}`});
  });
  INVOICES.filter(i=>i.status==='Approved').forEach(i=>{
    const d = daysBetween(todayISO(), i.dueDate);
    if(d>=0 && d<=14) notes.push({type: d<=5?'warn':'info', text:`Invoice ${i.id} (${i.vendor}) due in ${d} days — ${fmtM(i.amount)}`});
  });
  return notes;
}

