/* ================= CHARTS ================= */
let chartInstances=[];
function destroyCharts(){ chartInstances.forEach(c=>c.destroy()); chartInstances=[]; }
function afterRender(){
  destroyCharts();
  const gridColor = '#EEF1F5';
  Chart.defaults.font.family = "'IBM Plex Sans', sans-serif";
  Chart.defaults.font.size = 11.5;
  Chart.defaults.color = '#5B6478';

  if(document.getElementById('chartActualBudget')){
    const months = ['Mar','Apr','May','Jun','Jul','Aug'];
    const budget = months.map((_,i)=> 95000+i*3000+ (i%2?4000:0));
    const actual = months.map((_,i)=> 88000+i*3400+ (i===4?12000:0));
    chartInstances.push(new Chart(document.getElementById('chartActualBudget'),{
      type:'bar',
      data:{labels:months, datasets:[
        {label:'Budget', data:budget, backgroundColor:'#D8DEEB', borderRadius:4, barPercentage:.6},
        {label:'Actual', data:actual, backgroundColor:'#0E8F72', borderRadius:4, barPercentage:.6},
      ]},
      options:{responsive:true,maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10,boxHeight:10}}}, scales:{y:{grid:{color:gridColor}, ticks:{callback:v=>'$'+fmt(v)}}, x:{grid:{display:false}}}}
    }));
  }
  if(document.getElementById('chartByDept')){
    const data = DEPARTMENTS.map(d=> PRS.filter(p=>p.dept===d).reduce((s,p)=>s+p.amount,0));
    chartInstances.push(new Chart(document.getElementById('chartByDept'),{
      type:'doughnut',
      data:{labels:DEPARTMENTS, datasets:[{data, backgroundColor:['#12213B','#4A5AD1','#0E8F72','#B87A12','#C0483F'], borderWidth:2, borderColor:'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false, plugins:{legend:{position:'bottom', labels:{boxWidth:10,boxHeight:10, font:{size:10.5}}}}, cutout:'62%'}
    }));
  }
  if(document.getElementById('chartCashflow')){
    const weeks = Array.from({length:8},(_,i)=>`Wk ${i+1}`);
    const vals = weeks.map(()=> Math.round(8000+Math.random()*30000));
    chartInstances.push(new Chart(document.getElementById('chartCashflow'),{
      type:'bar',
      data:{labels:weeks, datasets:[{label:'Forecast outflow', data:vals, backgroundColor:'#4A5AD1', borderRadius:4}]},
      options:{responsive:true,maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{y:{grid:{color:gridColor}, ticks:{callback:v=>'$'+fmt(v)}}, x:{grid:{display:false}}}}
    }));
  }
  if(document.getElementById('chartContractStatus')){
    const statuses = ['Draft','Under Approval','Signed'];
    const data = statuses.map(s=>CONTRACTS.filter(c=>c.status===s).length);
    chartInstances.push(new Chart(document.getElementById('chartContractStatus'),{
      type:'doughnut',
      data:{labels:statuses, datasets:[{data, backgroundColor:['#B87A12','#4A5AD1','#0E8F72'], borderWidth:2, borderColor:'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, cutout:'62%'}
    }));
  }
  if(document.getElementById('chartOpenPODept')){
    const byDept={};
    POS.forEach(po=>{ const pr=PRS.find(p=>p.id===po.pr); const d=pr?pr.dept:'—'; byDept[d]=(byDept[d]||0)+(po.amount-po.invoiced); });
    chartInstances.push(new Chart(document.getElementById('chartOpenPODept'),{
      type:'bar',
      data:{labels:Object.keys(byDept), datasets:[{data:Object.values(byDept), backgroundColor:'#12213B', borderRadius:4}]},
      options:{indexAxis:'y', responsive:true,maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{color:gridColor}, ticks:{callback:v=>'$'+fmt(v)}}, y:{grid:{display:false}}}}
    }));
  }
  if(document.getElementById('chartOpenPRDept')){
    const byDept={};
    PRS.filter(p=>p.status==='Pending Approval').forEach(p=>{ byDept[p.dept]=(byDept[p.dept]||0)+p.amount; });
    chartInstances.push(new Chart(document.getElementById('chartOpenPRDept'),{
      type:'bar',
      data:{labels:Object.keys(byDept), datasets:[{data:Object.values(byDept), backgroundColor:'#4A5AD1', borderRadius:4}]},
      options:{indexAxis:'y', responsive:true,maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{grid:{color:gridColor}, ticks:{callback:v=>'$'+fmt(v)}}, y:{grid:{display:false}}}}
    }));
  }
  if(document.getElementById('chartBudgetMoM')){
    const {monthRows} = computeBudgetReportData();
    const months = monthRows.map(r=>r.label);
    const b = monthRows.map(r=>r.budget);
    const a = monthRows.map(r=>r.actual);
    chartInstances.push(new Chart(document.getElementById('chartBudgetMoM'),{
      type:'line',
      data:{labels:months, datasets:[
        {label:'Budget', data:b, borderColor:'#B0B8CB', backgroundColor:'transparent', tension:.35, borderDash:[5,4]},
        {label:'Actual', data:a, borderColor:'#0E8F72', backgroundColor:'rgba(14,143,114,.08)', tension:.35, fill:true},
      ]},
      options:{responsive:true,maintainAspectRatio:false, plugins:{legend:{position:'bottom'}}, scales:{y:{grid:{color:gridColor}, ticks:{callback:v=>'$'+fmt(v)}}, x:{grid:{display:false}}}}
    }));
  }
}

