const JEFFDESIGN_BUILD = 'portal-render-fix-2026-09-03';

const cfg = window.LIME_CRM_CONFIG || {};
const statusLabels = {ongoing:'Ongoing',review:'In Review',waiting:'Waiting',complete:'Complete',paused:'Paused'};
const statusColors = {ongoing:'#baff3a',review:'#71d7ff',waiting:'#ffc857',complete:'#55e58a',paused:'#b69cff'};
const $ = id => document.getElementById(id);
const esc = (v='') => String(v).replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
const els = {
  pageTitle:$('page-title'), globalSearch:$('global-search'), clientSearch:$('client-search'),
  clientSort:$('client-sort'), clientStatusFilter:$('client-status-filter'), clientList:$('client-list'),
  recentClients:$('recent-clients'), projectBoard:$('project-board'), clientDetail:$('client-detail'),
  detailSearch:$('detail-search'), modalBackdrop:$('modal-backdrop'), clientForm:$('client-form'),
  deleteClient:$('delete-client'), saveState:$('save-state'), toast:$('toast')
};

let sb = null;
let session = null;
let profile = null;
let currentRole = 'client';
let clients = [];
let trash = [];
let activeClientId = null;
let detailReturnView = 'clients';
let formAutosaveTimer = null;
let submissionAutosaveTimer = null;
let workSession = null;
let workTimerInterval = null;
let timeEntries = [];
let invoices = [];
let billingSettings = null;

function configured(){
  return cfg.supabaseUrl && cfg.supabasePublishableKey &&
    !cfg.supabaseUrl.includes('YOUR_SUPABASE') &&
    !cfg.supabasePublishableKey.includes('YOUR_SUPABASE');
}
function showToast(msg){
  els.toast.textContent=msg; els.toast.classList.add('show');
  setTimeout(()=>els.toast.classList.remove('show'),1800);
}
function fmtDate(date){
  if(!date)return '—';
  const d=new Date(date.length===10?date+'T00:00:00':date);
  return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(d);
}
function fmtUpdated(date){
  if(!date)return '—';
  const d=new Date(date),days=Math.floor(Math.max(0,Date.now()-d.getTime())/864e5);
  if(days===0)return 'Today'; if(days===1)return 'Yesterday'; if(days<7)return `${days} days ago`;
  return fmtDate(date.slice(0,10));
}
function initials(name='?'){return name.split(/\s+/).slice(0,2).map(x=>x[0]||'').join('').toUpperCase()}
function humanSize(bytes=0){
  const u=['B','KB','MB','GB'];let n=bytes,i=0;while(n>=1024&&i<u.length-1){n/=1024;i++}
  return `${i&&n<10?n.toFixed(1):Math.round(n)} ${u[i]}`;
}
function statusChip(s){return `<span class="status-chip status-${esc(s)}">● ${esc(statusLabels[s]||s)}</span>`}
function websiteHref(v){if(!v)return '';return /^https?:\/\//i.test(v)?v:'https://'+v}

function fromRow(r){
  return {
    id:r.id,name:r.name||'',company:r.company||'',email:r.email||'',phone:r.phone||'',website:r.website||'',
    projectType:r.project_type||'',status:r.status||'ongoing',priority:r.priority||'Normal',
    startDate:r.start_date||'',deadline:r.deadline||'',completedDate:r.completed_date||'',budget:r.budget||'',
    overview:r.overview||'',hosting:r.hosting||'',stack:r.stack||'',registrar:r.registrar||'',contact:r.contact||'',
    deliverables:r.deliverables||'',notes:r.notes||'',tags:r.tags||[],clientUsername:r.client_username||'',permission:r.portal_permission||'edit',authUserId:r.auth_user_id||null,deletedAt:r.deleted_at||'',
    createdAt:r.created_at,updatedAt:r.updated_at
  };
}
function toRow(c){
  return {
    name:c.name,company:c.company||null,email:c.email,phone:c.phone||null,website:c.website||null,
    project_type:c.projectType||null,status:c.status,priority:c.priority||'Normal',
    start_date:c.startDate||null,deadline:c.deadline||null,completed_date:c.completedDate||null,budget:c.budget||null,
    overview:c.overview||null,hosting:c.hosting||null,stack:c.stack||null,registrar:c.registrar||null,contact:c.contact||null,
    deliverables:c.deliverables||null,notes:c.notes||null,tags:c.tags||[],client_username:c.clientUsername||null,portal_permission:c.permission||'edit'
  };
}

function lockUI(locked){
  document.body.classList.toggle('locked',locked);
  $('login-screen')?.classList.toggle('hidden',!locked);
}
function setRoleUI(){
  document.body.classList.toggle('client-role',currentRole!=='admin');
  $('role-badge').textContent=currentRole==='admin'?'Admin':'Client';
  els.deleteClient.classList.toggle('hidden',currentRole!=='admin' || !$('client-id').value);
}
async function resolveProfile(){
  const {data,error}=await sb.from('profiles').select('id,email,role').eq('id',session.user.id).maybeSingle();
  if(error) throw error;
  profile=data||{id:session.user.id,email:session.user.email,role:'client'};
  currentRole=profile.role||'client';
  setRoleUI();
}
async function loadCloudData(){
  let q=sb.from('clients').select('*').order('updated_at',{ascending:false});
  const {data,error}=await q;
  if(error) throw error;
  const rows=(data||[]).map(fromRow);
  if(currentRole==='admin'){
    clients=rows.filter(x=>!x.deletedAt);
    trash=rows.filter(x=>x.deletedAt);
  }else{
    clients=rows.filter(x=>!x.deletedAt);
    trash=[];
  }
  await loadBillingSettings();
  await loadTimeEntries();
  await loadInvoices();
  renderAll();
}
function renderAll(){
  updateDashboard(); renderClients(); renderProjectBoard(); renderTrash(); renderTimePage(); renderInvoicesPage(); renderBillingSettings();
}
async function onSignedIn(){
  lockUI(false);
  await resolveProfile();
  await loadCloudData();
  if(currentRole==='admin'){
    setView('dashboard');
  }else if(clients[0]){
    activeClientId=clients[0].id;
    renderClientPortal('client-home');
  }else{
    activeClientId=null;
    $('client-home-content').innerHTML=`<article class="panel glass"><div class="empty"><strong>No client project linked yet</strong>Please contact Jeffdesign101 so your account can be connected to a project.</div></article>`;
    setView('client-home');
  }
}
async function initializeAuth(){
  if(!configured()){
    lockUI(true);
    $('login-error').innerHTML='<div class="setup-error">Supabase is not configured yet. Open <b>config.js</b>, add your Supabase URL and publishable key, then run <b>supabase-schema.sql</b> in the Supabase SQL Editor.</div>';
    return;
  }
  sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
  const {data}=await sb.auth.getSession();
  session=data.session;
  if(session) await onSignedIn(); else lockUI(true);
  sb.auth.onAuthStateChange((_event,newSession)=>{
    session=newSession;
    if(newSession){
      // Run Supabase queries after the auth callback finishes.
      // Awaiting database calls directly inside onAuthStateChange can deadlock sign-in.
      setTimeout(()=>{
        onSignedIn().catch(err=>{
          console.error('Post-login load failed:',err);
          lockUI(true);
          $('login-error').textContent=err?.message||'Signed in, but the CRM could not load.';
        });
      },0);
    } else {
      profile=null;clients=[];trash=[];lockUI(true);
    }
  });
}

async function loadBillingSettings(){
  if(!sb||!session)return;
  const {data,error}=await sb.from('billing_settings').select('*').eq('user_id',session.user.id).maybeSingle();
  if(error){console.warn(error);return}
  billingSettings=data||{
    hourly_rate:3,business_name:'Webdev VA',full_name:'',email:session.user.email||'',
    phone:'',address:'Philippines',payment_instructions:''
  };
}
async function saveBillingSettings(){
  if(currentRole!=='admin')return;
  const payload={
    user_id:session.user.id,
    hourly_rate:parseFloat($('default-hourly-rate').value||'3'),
    business_name:$('billing-business-name').value.trim(),
    full_name:$('billing-name').value.trim(),
    email:$('billing-email').value.trim(),
    phone:$('billing-phone').value.trim(),
    address:$('billing-address').value.trim(),
    payment_instructions:$('billing-payment').value.trim()
  };
  const {error}=await sb.from('billing_settings').upsert(payload,{onConflict:'user_id'});
  if(error){showToast(error.message);return}
  billingSettings=payload;showToast('Billing settings saved');renderTimePage();renderInvoicesPage();
}
function renderBillingSettings(){
  if(!$('default-hourly-rate')||currentRole!=='admin')return;
  const b=billingSettings||{};
  $('default-hourly-rate').value=(b.hourly_rate??3);
  $('billing-business-name').value=b.business_name||'Webdev VA';
  $('billing-name').value=b.full_name||'';
  $('billing-email').value=b.email||session?.user?.email||'';
  $('billing-phone').value=b.phone||'';
  $('billing-address').value=b.address||'';
  $('billing-payment').value=b.payment_instructions||'';
}
async function loadTimeEntries(){
  if(!sb||!session)return;
  let q=sb.from('time_entries').select('*').order('clock_in',{ascending:false});
  const {data,error}=await q;
  if(error){console.warn(error);return}
  timeEntries=data||[];
  workSession=timeEntries.find(x=>!x.clock_out)||null;
  startLiveTimer();
}
function hoursBetween(a,b){
  if(!a)return 0;
  const start=new Date(a),end=b?new Date(b):new Date();
  return Math.max(0,(end-start)/36e5);
}
function money(n){return '$'+Number(n||0).toFixed(2)}
function startOfWeek(d=new Date()){
  const x=new Date(d),day=x.getDay(),diff=(day===0?-6:1-day);x.setDate(x.getDate()+diff);x.setHours(0,0,0,0);return x;
}
function timeEntryHours(e){return Number(e.hours||hoursBetween(e.clock_in,e.clock_out))}
function startLiveTimer(){
  clearInterval(workTimerInterval);
  const tick=()=>{
    const el=$('live-timer');if(!el)return;
    if(!workSession){el.textContent='00:00:00';return}
    const sec=Math.floor((Date.now()-new Date(workSession.clock_in).getTime())/1000);
    const h=String(Math.floor(sec/3600)).padStart(2,'0'),m=String(Math.floor(sec%3600/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');
    el.textContent=`${h}:${m}:${s}`;
  };
  tick();workTimerInterval=setInterval(tick,1000);
}
async function clockIn(){
  if(currentRole!=='admin')return;
  if(workSession){showToast('A work session is already active');return}
  const clientId=$('timer-client').value,task=$('timer-task').value.trim();
  if(!clientId){showToast('Select a client first');return}
  const {data,error}=await sb.from('time_entries').insert({
    user_id:session.user.id,client_id:clientId,task,clock_in:new Date().toISOString(),hourly_rate:Number(billingSettings?.hourly_rate||3)
  }).select().single();
  if(error){showToast(error.message);return}
  workSession=data;timeEntries.unshift(data);startLiveTimer();renderTimePage();showToast('Work session started');
}
async function clockOut(){
  if(currentRole!=='admin'||!workSession){showToast('No active work session');return}
  const out=new Date().toISOString(),hrs=hoursBetween(workSession.clock_in,out);
  const {data,error}=await sb.from('time_entries').update({clock_out:out,hours:hrs}).eq('id',workSession.id).select().single();
  if(error){showToast(error.message);return}
  timeEntries=timeEntries.map(x=>x.id===data.id?data:x);workSession=null;startLiveTimer();renderTimePage();renderInvoicesPage();showToast('Work session stopped');
}

function updateManualAmount(){
  const hours=Number($('manual-hours')?.value||0);
  const rate=Number($('manual-rate')?.value||billingSettings?.hourly_rate||3);
  const amount=$('manual-amount');
  if(amount) amount.textContent=money(hours*rate);
}

async function addManualHours(){
  if(currentRole!=='admin')return;
  const clientId=$('manual-client')?.value;
  const date=$('manual-date')?.value;
  const hours=Number($('manual-hours')?.value||0);
  const rate=Number($('manual-rate')?.value||billingSettings?.hourly_rate||3);
  const task=$('manual-task')?.value.trim()||'Manual work entry';

  if(!clientId){showToast('Select a client');return}
  if(!date){showToast('Select the work date');return}
  if(!hours || hours<=0){showToast('Enter the number of hours worked');return}

  // Store a completed time entry so it works with invoice generation exactly
  // like a timer-based entry.
  const startLocal=new Date(`${date}T09:00:00`);
  const endLocal=new Date(startLocal.getTime()+hours*3600000);

  const {data,error}=await sb.from('time_entries').insert({
    user_id:session.user.id,
    client_id:clientId,
    task,
    clock_in:startLocal.toISOString(),
    clock_out:endLocal.toISOString(),
    hours,
    hourly_rate:rate
  }).select().single();

  if(error){showToast(error.message);return}

  timeEntries.unshift(data);
  $('manual-hours').value='';
  $('manual-task').value='';
  updateManualAmount();
  renderTimePage();
  renderInvoicesPage();
  showToast(`${hours.toFixed(2)} hours added`);
}

function renderTimePage(){
  if(!$('time-entry-list')||currentRole!=='admin')return;
  const rate=Number(billingSettings?.hourly_rate||3),now=new Date(),today=now.toISOString().slice(0,10),week=startOfWeek(now);
  const todayH=timeEntries.filter(e=>String(e.clock_in).slice(0,10)===today).reduce((s,e)=>s+timeEntryHours(e),0);
  const weekH=timeEntries.filter(e=>new Date(e.clock_in)>=week).reduce((s,e)=>s+timeEntryHours(e),0);
  const uninvoiced=timeEntries.filter(e=>!e.invoice_id&&e.clock_out).reduce((s,e)=>s+timeEntryHours(e)*Number(e.hourly_rate||rate),0);
  $('time-today').textContent=todayH.toFixed(2)+'h';$('time-week').textContent=weekH.toFixed(2)+'h';$('time-rate').textContent=money(rate);$('time-uninvoiced').textContent=money(uninvoiced);
  $('timer-status').className='status-chip '+(workSession?'status-ongoing':'status-paused');$('timer-status').textContent=workSession?'● Working now':'● Not working';
  $('timer-client-label').textContent=workSession?`Working on ${clients.find(c=>c.id===workSession.client_id)?.name||'client'} since ${new Date(workSession.clock_in).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`:'Select a client before starting work.';
  $('clock-in').disabled=!!workSession;$('clock-out').disabled=!workSession;
  $('timer-client').innerHTML='<option value="">Select client…</option>'+clients.map(c=>`<option value="${c.id}" ${workSession?.client_id===c.id?'selected':''}>${esc(c.name)}</option>`).join('');

  if($('manual-client')){
    const previous=$('manual-client').value;
    $('manual-client').innerHTML='<option value="">Select client…</option>'+clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
    if(previous) $('manual-client').value=previous;
    if(!$('manual-date').value) $('manual-date').value=new Date().toISOString().slice(0,10);
    if(!$('manual-rate').value) $('manual-rate').value=rate.toFixed(2);
    updateManualAmount();
  }

  $('time-entry-list').innerHTML=timeEntries.length?timeEntries.map(e=>{
    const c=clients.find(x=>x.id===e.client_id)||{};
    return `<div class="invoice-row"><div><strong>${esc(c.name||'Client')}</strong><small>${esc(e.task||'General work')}</small></div><div><strong>${esc(new Date(e.clock_in).toLocaleDateString())}</strong><small>${esc(new Date(e.clock_in).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}${e.clock_out?' → '+esc(new Date(e.clock_out).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})):' → active'}</small></div><div><strong>${timeEntryHours(e).toFixed(2)} hrs</strong><small>${money(e.hourly_rate||rate)}/hr</small></div><div class="invoice-amount">${money(timeEntryHours(e)*Number(e.hourly_rate||rate))}</div><div>${e.invoice_id?'<span class="invoice-status paid">Invoiced</span>':'<span class="invoice-status draft">Uninvoiced</span>'}</div></div>`;
  }).join(''):'<div class="empty"><strong>No time entries yet</strong>Start a work session to begin tracking hours.</div>';
}
async function loadInvoices(){
  if(!sb||!session)return;
  const {data,error}=await sb.from('invoices').select('*').order('invoice_date',{ascending:false});
  if(error){console.warn(error);return}
  invoices=data||[];
}

function invoiceUsesManualHours(){
  return $('invoice-hours-mode')?.value==='manual';
}
function invoiceHoursValue(){
  if(invoiceUsesManualHours()){
    return Math.max(0,Number($('invoice-manual-hours')?.value||0));
  }
  return selectedInvoiceEntries().reduce((s,e)=>s+timeEntryHours(e),0);
}
function updateInvoiceHoursModeUI(){
  const manual=invoiceUsesManualHours();
  $('invoice-manual-hours-wrap')?.classList.toggle('hidden',!manual);
  if($('invoice-hours-help')){
    $('invoice-hours-help').textContent=manual
      ? 'Manual mode lets you enter billable hours directly, even without Time Log entries.'
      : 'Time Log mode automatically totals uninvoiced work entries in the selected period.';
  }
  updateInvoicePreviewNumbers();
}

function selectedInvoiceEntries(){
  const clientId=$('invoice-client')?.value,start=$('invoice-start')?.value,end=$('invoice-end')?.value;
  return timeEntries.filter(e=>{
    if(!e.clock_out||e.invoice_id||e.client_id!==clientId)return false;
    const d=String(e.clock_in).slice(0,10);
    return (!start||d>=start)&&(!end||d<=end);
  });
}
function updateInvoicePreviewNumbers(){
  if(!$('invoice-hours-preview'))return;
  const hours=invoiceHoursValue();
  const rate=Number($('invoice-rate').value||billingSettings?.hourly_rate||3);
  $('invoice-hours-preview').textContent=hours.toFixed(2)+' hrs';
  $('invoice-total-preview').textContent=money(hours*rate);
}
function nextInvoiceNumber(){
  const nums=invoices.map(i=>Number(String(i.invoice_number||'').match(/\d+/)?.[0]||0));return 'INV-'+String(Math.max(1000,...nums)+1).padStart(4,'0');
}
function renderInvoicesPage(){
  if(!$('invoice-list'))return;
  const visible=currentRole==='admin'?invoices:invoices.filter(i=>clients.some(c=>c.id===i.client_id));
  const pending=visible.filter(i=>i.status==='pending'),paid=visible.filter(i=>i.status==='paid');
  $('invoice-pending-count').textContent=pending.length;$('invoice-paid-count').textContent=paid.length;
  $('invoice-outstanding').textContent=money(pending.reduce((s,i)=>s+Number(i.total||0),0));
  $('invoice-paid-total').textContent=money(paid.reduce((s,i)=>s+Number(i.total||0),0));
  if(currentRole==='admin'){
    $('invoice-client').innerHTML='<option value="">Select client…</option>'+clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
    if(!$('invoice-number').value)$('invoice-number').value=nextInvoiceNumber();
    if(!$('invoice-date').value)$('invoice-date').value=new Date().toISOString().slice(0,10);
    if(!$('invoice-rate').value)$('invoice-rate').value=Number(billingSettings?.hourly_rate||3).toFixed(2);
    updateInvoiceHoursModeUI();
  }
  $('invoice-list').innerHTML=visible.length?visible.map(i=>{
    const c=clients.find(x=>x.id===i.client_id)||{};
    return `<div class="invoice-row"><div><strong>${esc(i.invoice_number)}</strong><small>${esc(c.name||'Client')} · ${esc(i.description||'Online Work')}</small></div><div><strong>${esc(fmtDate(i.invoice_date))}</strong><small>${esc(i.period_start?fmtDate(i.period_start):'')} ${i.period_end?'— '+esc(fmtDate(i.period_end)):''}</small></div><div><strong>${Number(i.hours||0).toFixed(2)} hrs</strong><small>${money(i.hourly_rate)}/hr</small></div><div class="invoice-amount">${money(i.total)}</div><div class="row-actions"><span class="invoice-status ${esc(i.status)}">${esc(i.status==='paid'?'Paid':i.status==='pending'?'Incoming':'Draft')}</span><button class="mini-btn" data-view-invoice="${i.id}">View</button>${currentRole==='admin'&&i.status!=='paid'?`<button class="mini-btn restore" data-mark-paid="${i.id}">Mark Paid</button>`:''}</div></div>`;
  }).join(''):'<div class="empty"><strong>No invoices yet</strong>Generated invoices will appear here.</div>';
}
function buildInvoiceHTML(invoice,client){
  const b=billingSettings||{},payment=invoice.notes||b.payment_instructions||'';
  return `<div class="invoice-paper">
    <div class="invoice-paper-header">
      <div class="invoice-brand"><h2>${esc(b.business_name||'Webdev VA')}</h2><p><b>${esc(b.full_name||'')}</b></p><p>${esc(b.address||'')}</p><p>${esc(b.phone||'')}</p><p>${esc(b.email||'')}</p></div>
      <div><h1>INVOICE</h1><div class="invoice-meta"><span>Invoice #</span><strong>${esc(invoice.invoice_number)}</strong><span>Invoice Date</span><strong>${esc(fmtDate(invoice.invoice_date))}</strong><span>Work Period</span><strong>${esc(fmtDate(invoice.period_start))} — ${esc(fmtDate(invoice.period_end))}</strong><span>Status</span><strong>${esc((invoice.status||'pending').toUpperCase())}</strong></div></div>
    </div>
    <div class="invoice-client-box"><strong>Bill To</strong><div>${esc(client?.name||'Client')}</div><div>${esc(client?.company||'')}</div><div>${esc(client?.email||'')}</div></div>
    <table class="invoice-table"><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead><tbody><tr><td>${esc(invoice.description||'Online Work')}</td><td>${Number(invoice.hours||0).toFixed(2)}</td><td>hrs</td><td>${money(invoice.hourly_rate)}</td><td>${money(invoice.total)}</td></tr></tbody></table>
    <div class="invoice-total-box"><div><span>TOTAL</span><strong>${money(invoice.total)}</strong></div></div>
    <div class="invoice-payment"><h4>PAYMENT / NOTES</h4><p>${esc(payment||'Thank you for your business.')}</p></div>
  </div>`;
}
function openInvoicePreview(invoice){
  const client=clients.find(c=>c.id===invoice.client_id);
  $('invoice-preview-content').innerHTML=buildInvoiceHTML(invoice,client);
  $('invoice-preview-backdrop').classList.remove('hidden');
}
function previewInvoiceDraft(){
  const hours=invoiceHoursValue();
  const rate=Number($('invoice-rate').value||3);
  const clientId=$('invoice-client').value;
  if(!clientId){showToast('Select a client');return}
  if(hours<=0){showToast('Enter billable hours');return}
  openInvoicePreview({
    invoice_number:$('invoice-number').value||nextInvoiceNumber(),
    invoice_date:$('invoice-date').value,
    period_start:$('invoice-start').value,
    period_end:$('invoice-end').value,
    hours,
    hourly_rate:rate,
    total:hours*rate,
    description:$('invoice-description').value,
    notes:$('invoice-notes').value,
    status:'pending',
    client_id:clientId
  });
}
async function createInvoice(){
  if(currentRole!=='admin')return;
  const manual=invoiceUsesManualHours();
  const entries=manual?[]:selectedInvoiceEntries();
  const clientId=$('invoice-client').value;
  if(!clientId){showToast('Select a client');return}

  const hours=invoiceHoursValue();
  if(hours<=0){
    showToast(manual?'Enter manual billable hours':'No uninvoiced time entries in this period');
    return;
  }

  const rate=Number($('invoice-rate').value||billingSettings?.hourly_rate||3);
  const total=hours*rate;
  const payload={
    user_id:session.user.id,
    client_id:clientId,
    invoice_number:$('invoice-number').value||nextInvoiceNumber(),
    invoice_date:$('invoice-date').value,
    period_start:$('invoice-start').value||null,
    period_end:$('invoice-end').value||null,
    hours,
    hourly_rate:rate,
    total,
    description:$('invoice-description').value.trim()||'Online Work',
    notes:$('invoice-notes').value.trim(),
    status:'pending'
  };

  const {data,error}=await sb.from('invoices').insert(payload).select().single();
  if(error){showToast(error.message);return}

  // Only Time Log mode links time entries to the invoice.
  if(!manual && entries.length){
    await sb.from('time_entries').update({invoice_id:data.id}).in('id',entries.map(e=>e.id));
  }

  await loadTimeEntries();
  await loadInvoices();
  renderInvoicesPage();
  $('invoice-number').value=nextInvoiceNumber();
  if($('invoice-manual-hours')) $('invoice-manual-hours').value='';
  updateInvoicePreviewNumbers();
  showToast('Invoice created');
}
async function markInvoicePaid(id){
  if(currentRole!=='admin')return;
  const {error}=await sb.from('invoices').update({status:'paid',paid_at:new Date().toISOString()}).eq('id',id);
  if(error){showToast(error.message);return}
  await loadInvoices();renderInvoicesPage();showToast('Invoice marked paid');
}


function portalClient(){
  return clients.find(c=>c.id===activeClientId)||clients[0]||null;
}
function projectProgress(status){
  return {ongoing:35,review:75,waiting:55,complete:100,paused:45}[status]||20;
}
async function renderClientPortal(view='client-home'){
  if(currentRole==='admin')return;
  const c=portalClient();
  if(!c){setView('client-home');return}
  activeClientId=c.id;

  if($('portal-client-name')) $('portal-client-name').textContent=c.name||'My Project';
  if($('portal-client-subtitle')) $('portal-client-subtitle').textContent=c.projectType||c.company||'Jeffdesign101 project workspace';
  if($('portal-project-status')) $('portal-project-status').innerHTML=statusChip(c.status);

  document.querySelectorAll('.client-tab').forEach(b=>b.classList.toggle('active',b.dataset.clientView===view));
  const canEdit=c.permission!=='view';

  if(view==='client-home') await renderClientOverview(c,canEdit);
  if(view==='client-tasks') await renderClientTasksPage(c,canEdit);
  if(view==='client-progress') await renderClientProgressPage(c);
  if(view==='client-files') await renderClientFilesPage(c,canEdit);
  if(view==='client-invoices') await renderClientInvoicesPage(c);
  if(view==='client-account') renderClientAccountPage(c);

  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  $(`${view}-view`)?.classList.add('active');
  els.pageTitle.textContent={ 'client-home':'My Project','client-tasks':'Tasks','client-progress':'Progress','client-files':'Files','client-invoices':'Invoices','client-account':'Account'}[view]||'Client Portal';
}

async function renderClientOverview(c,canEdit){
  const submission=await getSubmission(c.id).catch(()=>null);
  const tasksRes=await sb.from('client_tasks').select('*').eq('client_id',c.id).order('created_at',{ascending:false});
  const tasks=tasksRes.data||[];
  const myInvoices=invoices.filter(i=>i.client_id===c.id);
  const unpaid=myInvoices.filter(i=>i.status==='pending').reduce((s,i)=>s+Number(i.total||0),0);
  const progress=projectProgress(c.status);
  $('client-home-content').innerHTML=`
    ${!canEdit?`<div class="readonly-banner" style="margin-top:16px">Your portal is currently <b>View Only</b>. You can review progress, files and invoices, but editing is disabled.</div>`:''}
    <div class="portal-kpis">
      <div class="portal-kpi"><span>Status</span><strong>${esc(statusLabels[c.status]||c.status)}</strong></div>
      <div class="portal-kpi"><span>Progress</span><strong>${progress}%</strong></div>
      <div class="portal-kpi"><span>Open tasks</span><strong>${tasks.filter(t=>!t.done).length}</strong></div>
      <div class="portal-kpi"><span>Amount due</span><strong>${money(unpaid)}</strong></div>
    </div>
    <div class="portal-overview-grid">
      <article class="portal-summary-card glass">
        <p class="eyebrow">PROJECT</p><h3>${esc(c.projectType||'Website Project')}</h3>
        <div class="project-progress"><span style="width:${progress}%"></span></div>
        <div class="info-grid" style="margin-top:18px">
          <div class="info-item"><span>Started</span><strong>${esc(fmtDate(c.startDate))}</strong></div>
          <div class="info-item"><span>Deadline</span><strong>${esc(fmtDate(c.deadline))}</strong></div>
          <div class="info-item"><span>Priority</span><strong>${esc(c.priority||'Normal')}</strong></div>
          <div class="info-item"><span>Website</span>${c.website?`<a href="${esc(websiteHref(c.website))}" target="_blank" rel="noopener">${esc(c.website)}</a>`:'<strong>—</strong>'}</div>
        </div>
      </article>
      <article class="portal-summary-card glass">
        <p class="eyebrow">NEXT TASKS</p><h3>Current requests</h3>
        ${tasks.slice(0,4).map(t=>`<div class="task-entry"><input type="checkbox" ${t.done?'checked':''} disabled><div><strong>${esc(t.task)}</strong><small>${t.done?'Completed':'Open'}</small></div></div>`).join('')||'<div class="muted">No tasks yet.</div>'}
      </article>
      <article class="portal-summary-card glass full">
        <p class="eyebrow">OVERVIEW</p><h3>Project information</h3>
        <div class="prose">${esc(c.overview||'No overview added yet.')}</div>
      </article>
      <article class="portal-summary-card glass full">
        <p class="eyebrow">LATEST INFORMATION</p><h3>Shared project notes</h3>
        <div class="prose">${submission?.info_html||esc(submission?.info||'No shared information yet.')}</div>
      </article>
    </div>`;
}

async function renderClientTasksPage(c,canEdit){
  const {data,error}=await sb.from('client_tasks').select('*').eq('client_id',c.id).order('created_at',{ascending:false});
  const tasks=data||[];
  $('client-tasks-content').innerHTML=`
    <div class="portal-overview-grid">
      ${canEdit?`<article class="portal-summary-card glass">
        <p class="eyebrow">NEW TASK</p><h3>Send a task to your VA</h3>
        <div class="portal-task-form">
          <input id="portal-task-title" placeholder="Task title">
          <textarea id="portal-task-details" placeholder="Detailed instructions, checklist, links, requirements..."></textarea>
          <div class="form-grid">
            <label><span>Priority</span><select id="portal-task-priority"><option>Normal</option><option>High</option><option>Urgent</option><option>Low</option></select></label>
            <label><span>Due date</span><input id="portal-task-due" type="date"></label>
          </div>
          <button id="portal-add-task" class="btn btn-primary">＋ Send Task</button>
        </div>
      </article>`:''}
      <article class="portal-summary-card glass ${canEdit?'':'full'}">
        <p class="eyebrow">TASK STATUS</p><h3>${tasks.filter(t=>!t.done).length} open · ${tasks.filter(t=>t.done).length} completed</h3>
        <div class="project-progress"><span style="width:${tasks.length?Math.round(tasks.filter(t=>t.done).length/tasks.length*100):0}%"></span></div>
      </article>
      <article class="portal-summary-card glass full">
        <p class="eyebrow">ALL TASKS</p><h3>Task history</h3>
        <div id="portal-task-list">
          ${tasks.length?tasks.map(t=>`<div class="portal-task-card">
            <div class="task-top"><div><h4>${esc(t.task)}</h4><p>${esc(t.details||'')}</p></div><span class="status-chip ${t.done?'status-complete':'status-ongoing'}">${t.done?'● Complete':'● Open'}</span></div>
            <div class="portal-task-meta"><span>${esc(t.priority||'Normal')}</span>${t.due_date?`<span>Due ${esc(fmtDate(t.due_date))}</span>`:''}<span>${esc(fmtUpdated(t.created_at))}</span></div>
          </div>`).join(''):'<div class="empty"><strong>No tasks yet</strong>Create the first task for your VA.</div>'}
        </div>
      </article>
    </div>`;
  if(canEdit){
    $('portal-add-task')?.addEventListener('click',async()=>{
      const title=$('portal-task-title').value.trim();
      if(!title){showToast('Add a task title');return}
      const {error}=await sb.from('client_tasks').insert({
        client_id:c.id,user_id:session.user.id,task:title,details:$('portal-task-details').value.trim(),
        priority:$('portal-task-priority').value,due_date:$('portal-task-due').value||null
      });
      if(error){showToast(error.message);return}
      showToast('Task sent');await renderClientTasksPage(c,canEdit);
    });
  }
}

async function renderClientProgressPage(c){
  const entries=timeEntries.filter(e=>e.client_id===c.id);
  const totalH=entries.reduce((s,e)=>s+timeEntryHours(e),0);
  const week=startOfWeek(new Date());
  const weekH=entries.filter(e=>new Date(e.clock_in)>=week).reduce((s,e)=>s+timeEntryHours(e),0);
  const progress=projectProgress(c.status);
  $('client-progress-content').innerHTML=`
    <div class="portal-kpis">
      <div class="portal-kpi"><span>Project progress</span><strong>${progress}%</strong></div>
      <div class="portal-kpi"><span>Total work</span><strong>${totalH.toFixed(2)}h</strong></div>
      <div class="portal-kpi"><span>This week</span><strong>${weekH.toFixed(2)}h</strong></div>
      <div class="portal-kpi"><span>Status</span><strong>${esc(statusLabels[c.status]||c.status)}</strong></div>
    </div>
    <article class="portal-summary-card glass" style="margin-top:16px">
      <p class="eyebrow">WORK LOG</p><h3>VA progress history</h3>
      ${entries.length?entries.map(e=>`<div class="portal-worklog-row">
        <div><strong>${esc(e.task||'General work')}</strong><small class="muted">${esc(new Date(e.clock_in).toLocaleDateString())}</small></div>
        <div><span class="muted">Hours</span><strong>${timeEntryHours(e).toFixed(2)}h</strong></div>
        <div><span class="muted">Started</span><strong>${esc(new Date(e.clock_in).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))}</strong></div>
        <div><span class="muted">Finished</span><strong>${e.clock_out?esc(new Date(e.clock_out).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})):'Active'}</strong></div>
      </div>`).join(''):'<div class="empty"><strong>No work logged yet</strong>Your VA work history will appear here.</div>'}
    </article>`;
}

async function renderClientFilesPage(c,canEdit){
  const files=await listFiles(c.id).catch(()=>[]);
  $('client-files-content').innerHTML=`
    <article class="portal-summary-card glass" style="margin-top:16px">
      <div class="panel-head"><div><p class="eyebrow">PROJECT FILES</p><h3>Shared documents</h3></div>
      ${canEdit?`<label class="btn btn-primary">＋ Upload Files<input id="portal-file-upload" type="file" multiple hidden></label>`:''}</div>
      <div class="portal-file-grid">
        ${files.length?files.map(f=>`<div class="attachment"><div class="file-meta"><strong>${esc(f.name.replace(/^\d+-[a-z0-9]+-/,''))}</strong><small>${esc(humanSize(f.metadata?.size||0))}</small></div><div class="file-actions"><button class="mini-btn" data-open-file="${esc(c.id+'/'+f.name)}">Open</button>${canEdit?`<button class="mini-btn delete" data-delete-cloud-file="${esc(c.id+'/'+f.name)}">Delete</button>`:''}</div></div>`).join(''):'<div class="empty"><strong>No files yet</strong>Project files will appear here.</div>'}
      </div>
    </article>`;
  if(canEdit){
    $('portal-file-upload')?.addEventListener('change',async e=>{
      if(e.target.files?.length){await uploadFiles(c.id,[...e.target.files]);await renderClientFilesPage(c,canEdit)}
    });
  }
}

async function renderClientInvoicesPage(c){
  const list=invoices.filter(i=>i.client_id===c.id);
  const pending=list.filter(i=>i.status==='pending'),paid=list.filter(i=>i.status==='paid');
  $('client-invoices-content').innerHTML=`
    <div class="portal-kpis">
      <div class="portal-kpi"><span>Incoming</span><strong>${pending.length}</strong></div>
      <div class="portal-kpi"><span>Amount due</span><strong>${money(pending.reduce((s,i)=>s+Number(i.total||0),0))}</strong></div>
      <div class="portal-kpi"><span>Paid invoices</span><strong>${paid.length}</strong></div>
      <div class="portal-kpi"><span>Total paid</span><strong>${money(paid.reduce((s,i)=>s+Number(i.total||0),0))}</strong></div>
    </div>
    <article class="portal-summary-card glass" style="margin-top:16px">
      <p class="eyebrow">INVOICES</p><h3>Billing history</h3>
      <div class="invoice-list">
        ${list.length?list.map(i=>`<div class="invoice-row"><div><strong>${esc(i.invoice_number)}</strong><small>${esc(i.description||'Online Work')}</small></div><div><strong>${esc(fmtDate(i.invoice_date))}</strong><small>${Number(i.hours||0).toFixed(2)} hrs</small></div><div><strong>${money(i.hourly_rate)}/hr</strong></div><div class="invoice-amount">${money(i.total)}</div><div class="row-actions"><span class="invoice-status ${esc(i.status)}">${i.status==='paid'?'Paid':'Incoming'}</span><button class="mini-btn" data-view-invoice="${i.id}">View</button></div></div>`).join(''):'<div class="empty"><strong>No invoices yet</strong>Your invoices will appear here.</div>'}
      </div>
    </article>`;
}

function renderClientAccountPage(c){
  $('client-account-content').innerHTML=`
    <article class="portal-account-card glass">
      <p class="eyebrow">ACCOUNT</p><h3 style="margin-top:0">Client Login</h3>
      <div class="info-grid">
        <div class="info-item"><span>Username</span><strong>${esc(c.clientUsername||'—')}</strong></div>
        <div class="info-item"><span>Access</span><strong>${c.permission==='view'?'View Only':'Can Edit'}</strong></div>
      </div>
      <div style="margin-top:20px">
        <label><span>New password</span><input id="client-new-password" type="password" placeholder="At least 8 characters"></label>
      </div>
      <div class="modal-actions"><button id="client-signout" class="btn btn-ghost">Sign out</button><button id="client-change-password" class="btn btn-primary">Change Password</button></div>
    </article>`;
  $('client-signout')?.addEventListener('click',()=>sb.auth.signOut());
  $('client-change-password')?.addEventListener('click',async()=>{
    const password=$('client-new-password').value;
    if(password.length<8){showToast('Use at least 8 characters');return}
    const {error}=await sb.auth.updateUser({password});
    if(error){showToast(error.message);return}
    $('client-new-password').value='';showToast('Password updated');
  });
}

function setView(view){
  if(currentRole!=='admin' && ['dashboard','projects','trash','clients','time','settings','invoices','client-detail'].includes(view)){
    view='client-home';
  }

  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  $(`${view}-view`)?.classList.add('active');

  const titles={
    dashboard:'Dashboard',
    clients:'Client Directory',
    projects:'Project Monitoring',
    time:'Time Log',
    invoices:'Invoices',
    settings:'Rate & Billing',
    trash:'Trash',
    'client-detail':'Client Details',
    'client-home':'My Project',
    'client-tasks':'Tasks',
    'client-progress':'Progress',
    'client-files':'Files',
    'client-invoices':'Invoices',
    'client-account':'Account'
  };

  els.pageTitle.textContent=titles[view]||'Jeffdesign101';

  if(view==='clients')renderClients();
  if(view==='projects')renderProjectBoard();
  if(view==='trash')renderTrash();
  if(view==='time')renderTimePage();
  if(view==='invoices')renderInvoicesPage();
  if(view==='settings')renderBillingSettings();
  if(view==='dashboard')updateDashboard();

  if(view.startsWith('client-') && view!=='client-detail' && currentRole!=='admin'){
    renderClientPortal(view).catch(error=>{
      console.error('Client portal render failed:',error);
      showToast(error?.message||'Could not open client portal');
    });
  }

  window.scrollTo({top:0,behavior:'smooth'});
}

function clientMatches(c,q){
  if(!q)return true;q=q.toLowerCase();
  return [c.name,c.company,c.email,c.phone,c.website,c.projectType,c.status,c.priority,c.overview,c.hosting,c.stack,c.registrar,c.contact,c.deliverables,c.notes,(c.tags||[]).join(' ')].join(' ').toLowerCase().includes(q);
}
function sortedClients(list){
  const sort=els.clientSort?.value||'updated-desc';
  return [...list].sort((a,b)=>{
    if(sort==='name-asc')return a.name.localeCompare(b.name);
    if(sort==='name-desc')return b.name.localeCompare(a.name);
    if(sort==='created-desc')return new Date(b.createdAt)-new Date(a.createdAt);
    if(sort==='created-asc')return new Date(a.createdAt)-new Date(b.createdAt);
    if(sort==='deadline-asc')return (a.deadline?new Date(a.deadline):Infinity)-(b.deadline?new Date(b.deadline):Infinity);
    return new Date(b.updatedAt)-new Date(a.updatedAt);
  });
}
function renderClients(overrideQuery=null){
  if(!els.clientList)return;
  const q=overrideQuery!==null?overrideQuery:(els.clientSearch?.value||'');
  const st=els.clientStatusFilter?.value||'all';
  const list=sortedClients(clients.filter(c=>clientMatches(c,q)&&(st==='all'||c.status===st)));
  els.clientList.innerHTML=list.length?list.map(c=>`
    <div class="client-row with-actions">
      <div class="client-main" data-open-client="${esc(c.id)}">
        <div class="avatar">${esc(initials(c.name))}</div>
        <div><strong>${esc(c.name)}</strong><small>${esc(c.website||c.company||c.email)}</small></div>
      </div>
      <div class="muted" data-open-client="${esc(c.id)}">${esc(c.projectType||'Website project')}</div>
      <div data-open-client="${esc(c.id)}">${statusChip(c.status)}</div>
      <div class="muted">Updated ${esc(fmtUpdated(c.updatedAt))}</div>
      <div class="row-actions">
        <button class="mini-btn edit" data-edit-client="${esc(c.id)}">Edit</button>
        <button class="mini-btn delete" data-trash-client="${esc(c.id)}">Delete</button>
      </div>
    </div>`).join(''):`<div class="empty"><strong>No clients found</strong>Try another search/filter or add a client.</div>`;
}
function renderRecent(){
  const list=[...clients].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,5);
  els.recentClients.innerHTML=list.length?list.map(c=>`
    <div class="recent-row" data-open-client="${esc(c.id)}">
      <div class="client-main"><div class="avatar">${esc(initials(c.name))}</div><div><strong>${esc(c.name)}</strong><small>${esc(c.website||c.email)}</small></div></div>
      <div class="muted">${esc(c.projectType||'Website project')}</div><div>${statusChip(c.status)}</div>
      <div class="muted">${esc(fmtUpdated(c.updatedAt))}</div><button class="row-open">›</button>
    </div>`).join(''):`<div class="empty"><strong>No client records yet</strong>Add your first client.</div>`;
}
function avgCompletionDays(){
  const done=clients.filter(c=>c.startDate&&c.completedDate);if(!done.length)return null;
  return Math.round(done.reduce((s,c)=>s+Math.max(0,(new Date(c.completedDate)-new Date(c.startDate))/864e5),0)/done.length);
}
function updateDashboard(){
  if(!$('stat-clients'))return;
  $('stat-clients').textContent=clients.length;
  $('stat-ongoing').textContent=clients.filter(c=>['ongoing','review','waiting'].includes(c.status)).length;
  $('stat-completed').textContent=clients.filter(c=>c.status==='complete').length;
  const avg=avgCompletionDays();$('stat-duration').textContent=avg==null?'—':`${avg}d`;
  $('donut-total').textContent=clients.length;renderDonut();renderMonthlyChart();renderRecent();
}
function renderDonut(){
  const canvas=$('status-donut');if(!canvas)return;const ctx=canvas.getContext('2d'),w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,r=92,line=27;
  ctx.clearRect(0,0,w,h);const counts=Object.keys(statusLabels).map(k=>({key:k,count:clients.filter(c=>c.status===k).length}));const total=counts.reduce((s,x)=>s+x.count,0);
  if(!total){ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=line;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke()}
  else{let start=-Math.PI/2;counts.forEach(x=>{if(!x.count)return;const arc=x.count/total*Math.PI*2;ctx.beginPath();ctx.strokeStyle=statusColors[x.key];ctx.lineWidth=line;ctx.lineCap='round';ctx.arc(cx,cy,r,start+.02,start+arc-.02);ctx.stroke();start+=arc})}
  $('donut-legend').innerHTML=counts.filter(x=>x.count).map(x=>`<div class="legend-item"><span class="legend-dot" style="background:${statusColors[x.key]}"></span>${esc(statusLabels[x.key])} ${x.count}</div>`).join('');
}
function roundRect(ctx,x,y,w,h,r){if(h<1)return;r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function renderMonthlyChart(){
  const canvas=$('monthly-chart');if(!canvas)return;const rect=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2),w=Math.max(300,Math.floor(rect.width)),h=Math.max(240,Math.floor(rect.height));
  canvas.width=w*dpr;canvas.height=h*dpr;const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);const pad={l:35,r:18,t:25,b:40},months=[],now=new Date();
  for(let i=5;i>=0;i--){const d=new Date(now.getFullYear(),now.getMonth()-i,1);months.push({y:d.getFullYear(),m:d.getMonth(),label:d.toLocaleString(undefined,{month:'short'}),count:0})}
  clients.forEach(c=>{const d=new Date(c.createdAt),m=months.find(x=>x.y===d.getFullYear()&&x.m===d.getMonth());if(m)m.count++});
  const max=Math.max(3,...months.map(x=>x.count));ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(255,255,255,.06)';
  for(let i=0;i<=3;i++){const y=pad.t+(h-pad.t-pad.b)*(i/3);ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke()}
  const usable=w-pad.l-pad.r,step=usable/months.length,bw=Math.max(16,step*.55);
  months.forEach((m,i)=>{const x=pad.l+i*step+(step-bw)/2,bh=m.count/max*(h-pad.t-pad.b-12),y=h-pad.b-bh,gr=ctx.createLinearGradient(0,y,0,h-pad.b);gr.addColorStop(0,'rgba(186,255,58,.95)');gr.addColorStop(1,'rgba(186,255,58,.15)');ctx.fillStyle=gr;roundRect(ctx,x,y,bw,bh,8);ctx.fill();ctx.fillStyle='#829087';ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText(m.label,x+bw/2,h-16);if(m.count){ctx.fillStyle='#dfffc1';ctx.fillText(String(m.count),x+bw/2,y-8)}})
}
function renderProjectBoard(){
  if(!els.projectBoard)return;const statuses=['ongoing','review','waiting','complete','paused'];
  els.projectBoard.innerHTML=statuses.map(s=>{const items=clients.filter(c=>c.status===s);return `<section class="board-column"><div class="board-head"><strong>${statusLabels[s]}</strong><span class="count-pill">${items.length}</span></div>${items.map(c=>`<article class="project-card" data-open-client="${c.id}"><strong>${esc(c.name)}</strong><p>${esc(c.projectType||'Website project')}</p><div class="project-meta"><span>${esc(c.priority)}</span><span>${esc(c.deadline?fmtDate(c.deadline):'No deadline')}</span></div></article>`).join('')||'<div class="muted" style="padding:8px">No projects</div>'}</section>`}).join('');
}
function renderTrash(){
  const el=$('trash-list');if(!el)return;
  el.innerHTML=trash.length?[...trash].sort((a,b)=>new Date(b.deletedAt)-new Date(a.deletedAt)).map(c=>`
    <div class="client-row with-actions">
      <div class="client-main"><div class="avatar">${esc(initials(c.name))}</div><div><strong>${esc(c.name)}</strong><small>Deleted ${esc(fmtUpdated(c.deletedAt))}</small></div></div>
      <div class="muted">${esc(c.projectType||'Website project')}</div><div>${statusChip(c.status)}</div><div class="trash-note">${esc(c.website||c.email)}</div>
      <div class="row-actions"><button class="mini-btn restore" data-restore-client="${c.id}">Restore</button><button class="mini-btn delete" data-perma-client="${c.id}">Delete forever</button></div>
    </div>`).join(''):`<div class="empty"><strong>Trash is empty</strong>Deleted clients will appear here.</div>`;
}

async function getSubmission(clientId){
  const {data,error}=await sb.from('client_submissions').select('*').eq('client_id',clientId).maybeSingle();
  if(error)throw error;return data;
}
async function saveSubmission(clientId,info,quiet=false){
  const payload={client_id:clientId,user_id:session.user.id,info};
  const {error}=await sb.from('client_submissions').upsert(payload,{onConflict:'client_id'});
  if(error){if(!quiet)showToast(error.message);throw error}
  if(!quiet)showToast('Information saved');
  const s=$('submission-save-state');if(s)s.textContent='Saved';
}
async function renderClientDetail(c,q=''){
  let submission=null;
  try{submission=await getSubmission(c.id)}catch(e){console.error(e)}
  const tags=(c.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('');
  const canEdit=currentRole==='admin' || c.permission!=='view';
  const progress={ongoing:35,review:75,waiting:55,complete:100,paused:45}[c.status]||25;

  els.clientDetail.innerHTML=`
    <article class="detail-hero glass">
      <div>
        <p class="eyebrow">${currentRole==='admin'?'CLIENT / WEBSITE PROJECT':'MY ONGOING PROJECT'}</p>
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.company||c.projectType||'Website project')}</p>
        <div class="detail-tags">${statusChip(c.status)}${tags}<span class="permission-pill">${canEdit?'Editing enabled':'View only'}</span></div>
      </div>
      ${statusChip(c.status)}
    </article>

    ${currentRole==='client'&&!canEdit?`<div class="readonly-banner" style="margin-top:14px">This project is currently set to <b>View Only</b> by the administrator. You can view project information and existing files, but editing and uploads are disabled.</div>`:''}

    <div class="portal-grid">
      <article class="portal-card glass">
        <div class="task-toolbar">
          <div><p class="eyebrow">TODAY</p><h4 style="margin:0">Task of the Day</h4></div>
          <span class="task-date">${esc(new Intl.DateTimeFormat(undefined,{weekday:'long',month:'short',day:'numeric'}).format(new Date()))}</span>
        </div>
        ${canEdit?`<div class="task-add"><input id="new-task" placeholder="Add today's task…"><button id="add-task" class="btn btn-primary">＋ Add</button></div>`:''}
        <div id="task-list"><div class="muted" style="padding:12px 0">Loading tasks…</div></div>
      </article>

      <article class="portal-card glass">
        <p class="eyebrow">PROJECT STATUS</p>
        <h4 style="margin:0 0 12px">Current progress</h4>
        ${statusChip(c.status)}
        <div class="project-progress"><span style="width:${progress}%"></span></div>
        <div class="info-grid" style="margin-top:18px">
          <div class="info-item"><span>Started</span><strong>${esc(fmtDate(c.startDate))}</strong></div>
          <div class="info-item"><span>Deadline</span><strong>${esc(fmtDate(c.deadline))}</strong></div>
          <div class="info-item"><span>Project type</span><strong>${esc(c.projectType||'—')}</strong></div>
          <div class="info-item"><span>Priority</span><strong>${esc(c.priority||'—')}</strong></div>
        </div>
      </article>

      <article class="portal-card glass full">
        <div class="task-toolbar">
          <div><p class="eyebrow">CLIENT INFORMATION</p><h4 style="margin:0">Project Notes & Information</h4></div>
          <span id="rich-save-state" class="save-state">${canEdit?'Autosave on':'View only'}</span>
        </div>
        <div class="rich-wrap">
          ${canEdit?`<div class="rich-toolbar">
            <button class="rich-tool" data-rich="bold" title="Bold"><b>B</b></button>
            <button class="rich-tool" data-rich="italic" title="Italic"><i>I</i></button>
            <button class="rich-tool" data-rich="underline" title="Underline"><u>U</u></button>
            <button class="rich-tool" data-rich="hiliteColor" data-value="#baff3a" title="Highlight">HL</button>
            <button class="rich-tool" data-rich="insertUnorderedList" title="Bullets">• List</button>
            <button class="rich-tool" data-rich="insertOrderedList" title="Numbered list">1.</button>
            <button class="rich-tool" data-rich="removeFormat" title="Clear formatting">Tx</button>
          </div>`:''}
          <div id="rich-editor" class="rich-editor" ${canEdit?'contenteditable="true"':'contenteditable="false"'} data-placeholder="Type project information, links, content, instructions, feedback…">${submission?.info_html||submission?.info||''}</div>
        </div>
      </article>

      <article class="portal-card glass full">
        <div class="task-toolbar">
          <div><p class="eyebrow">FILES</p><h4 style="margin:0">Project uploads</h4></div>
          ${canEdit?`<label class="btn btn-primary">＋ Upload Files<input id="detail-file-upload" type="file" multiple hidden></label>`:''}
        </div>
        <div class="muted" style="margin-bottom:10px">PDF, Word, Excel, images, ZIP and other project files.</div>
        <div id="detail-files" class="attachment-grid"><div class="muted">Loading files…</div></div>
      </article>

      <article class="portal-card glass">
        <h4>Website project overview</h4>
        <div class="prose">${esc(c.overview||'No overview added yet.')}</div>
      </article>

      <article class="portal-card glass">
        <h4>Deliverables</h4>
        <div class="prose">${esc(c.deliverables||'No deliverables added yet.')}</div>
      </article>

      <article class="portal-card glass full">
        <h4>Website setup</h4>
        <div class="info-grid">
          <div class="info-item"><span>Website</span>${c.website?`<a href="${esc(websiteHref(c.website))}" target="_blank" rel="noopener">${esc(c.website)}</a>`:'<strong>—</strong>'}</div>
          <div class="info-item"><span>Hosting</span><strong>${esc(c.hosting||'—')}</strong></div>
          <div class="info-item"><span>CMS / stack</span><strong>${esc(c.stack||'—')}</strong></div>
          <div class="info-item"><span>Domain registrar</span><strong>${esc(c.registrar||'—')}</strong></div>
        </div>
      </article>
    </div>`;

  await renderTasks(c.id,canEdit);
  await renderDetailFiles(c.id);

  if(canEdit){
    document.querySelectorAll('[data-rich]').forEach(btn=>btn.addEventListener('click',e=>{
      e.preventDefault();
      document.execCommand(btn.dataset.rich,false,btn.dataset.value||null);
      $('rich-editor').focus();
      scheduleRichSave(c.id);
    }));
    $('rich-editor')?.addEventListener('input',()=>{
      autoLinkEditor();
      scheduleRichSave(c.id);
    });
    $('detail-file-upload')?.addEventListener('change',async e=>{
      if(e.target.files?.length){await uploadFiles(c.id,[...e.target.files]);e.target.value=''}
    });
    $('add-task')?.addEventListener('click',()=>addTask(c.id));
    $('new-task')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();addTask(c.id)}});
  }
}

function autoLinkEditor(){
  const ed=$('rich-editor'); if(!ed)return;
  // Avoid destructive replacement while user is actively editing inside an existing link.
  const sel=window.getSelection();
  if(sel && sel.anchorNode && sel.anchorNode.parentElement?.closest('a')) return;
  const walker=document.createTreeWalker(ed,NodeFilter.SHOW_TEXT);
  const nodes=[];while(walker.nextNode())nodes.push(walker.currentNode);
  const urlRe=/\bhttps?:\/\/[^\s<]+/gi;
  nodes.forEach(node=>{
    if(node.parentElement?.closest('a'))return;
    const text=node.nodeValue;
    if(!urlRe.test(text))return;
    urlRe.lastIndex=0;
    const frag=document.createDocumentFragment();let last=0,m;
    while((m=urlRe.exec(text))){
      frag.append(document.createTextNode(text.slice(last,m.index)));
      const a=document.createElement('a');a.href=m[0];a.target='_blank';a.rel='noopener';a.textContent=m[0];frag.append(a);
      last=m.index+m[0].length;
    }
    frag.append(document.createTextNode(text.slice(last)));node.replaceWith(frag);
  });
}
function scheduleRichSave(clientId){
  clearTimeout(submissionAutosaveTimer);
  const state=$('rich-save-state');if(state)state.textContent='Saving…';
  submissionAutosaveTimer=setTimeout(()=>saveRichSubmission(clientId),650);
}
async function saveRichSubmission(clientId){
  const html=$('rich-editor')?.innerHTML||'';
  const text=$('rich-editor')?.innerText||'';
  const payload={client_id:clientId,user_id:session.user.id,info:text,info_html:html};
  const {error}=await sb.from('client_submissions').upsert(payload,{onConflict:'client_id'});
  const state=$('rich-save-state');
  if(error){if(state)state.textContent='Save failed';showToast(error.message);return}
  if(state)state.textContent='Autosaved';
}
async function renderTasks(clientId,canEdit){
  const box=$('task-list');if(!box)return;
  const {data,error}=await sb.from('client_tasks').select('*').eq('client_id',clientId).order('created_at',{ascending:false});
  if(error){box.innerHTML=`<div class="muted">${esc(error.message)}</div>`;return}
  const tasks=data||[];
  box.innerHTML=tasks.length?tasks.map(t=>`
    <div class="task-entry">
      <input type="checkbox" ${t.done?'checked':''} ${canEdit?'':'disabled'} data-task-toggle="${t.id}">
      <div><strong style="${t.done?'text-decoration:line-through;opacity:.6':''}">${esc(t.task)}</strong><small>${esc(fmtUpdated(t.created_at))}</small></div>
      ${canEdit?`<button class="mini-btn delete" data-task-delete="${t.id}">Delete</button>`:''}
    </div>`).join(''):`<div class="muted" style="padding:12px 0">No tasks yet today.</div>`;
  if(canEdit){
    box.querySelectorAll('[data-task-toggle]').forEach(el=>el.addEventListener('change',async()=>{
      await sb.from('client_tasks').update({done:el.checked}).eq('id',el.dataset.taskToggle);await renderTasks(clientId,canEdit);
    }));
    box.querySelectorAll('[data-task-delete]').forEach(el=>el.addEventListener('click',async()=>{
      await sb.from('client_tasks').delete().eq('id',el.dataset.taskDelete);await renderTasks(clientId,canEdit);
    }));
  }
}
async function addTask(clientId){
  const input=$('new-task');const task=input?.value.trim();if(!task)return;
  const {error}=await sb.from('client_tasks').insert({client_id:clientId,user_id:session.user.id,task});
  if(error){showToast(error.message);return}
  input.value='';await renderTasks(clientId,true);
}
async function createOrResetClientLogin(){
  if(currentRole!=='admin')return;

  const resultEl=$('credential-result');
  const button=$('create-client-login');
  const username=$('client-username').value.trim();
  const password=$('client-temp-password').value;

  const setCredentialState=(message,type='')=>{
    resultEl.textContent=message;
    resultEl.className='save-state credential-result'+(type?' '+type:'');
  };

  if(!$('client-name').value.trim()){
    setCredentialState('Enter the client name first.','error');
    $('client-name').focus();
    return;
  }
  if(!username){
    setCredentialState('Enter a client username.','error');
    $('client-username').focus();
    return;
  }
  if(password.length<8){
    setCredentialState('Temporary password must be at least 8 characters.','error');
    $('client-temp-password').focus();
    return;
  }

  button.disabled=true;
  setCredentialState('Saving client record…','working');

  try{
    // A new client no longer needs a separate Save step.
    // This also saves normal client fields before login creation/reset.
    const saved=await saveForm(false);
    if(!saved) throw new Error('Could not save the client record.');
    const clientId=saved.id;
    $('client-id').value=clientId;
    els.deleteClient.classList.remove('hidden');

    setCredentialState('Creating secure login…','working');

    const {data:sessionData,error:sessionError}=await sb.auth.getSession();
    if(sessionError) throw sessionError;
    const accessToken=sessionData?.session?.access_token;
    if(!accessToken) throw new Error('Your admin session expired. Sign out and sign in again.');

    // Use a direct request so we can display the real HTTP error instead of
    // the generic "Failed to send a request to the Edge Function" message.
    let response;
    try{
      response=await fetch(`${cfg.supabaseUrl}/functions/v1/admin-create-client-user`,{
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'apikey':cfg.supabasePublishableKey,
          'Authorization':`Bearer ${accessToken}`
        },
        body:JSON.stringify({clientId,username,password})
      });
    }catch(networkError){
      throw new Error(
        'Cannot reach the Supabase Edge Function. Confirm that admin-create-client-user is deployed and that its Verify JWT setting is OFF.'
      );
    }

    const raw=await response.text();
    let payload={};
    try{payload=raw?JSON.parse(raw):{}}catch(_){payload={error:raw}}

    if(!response.ok){
      const detail=payload?.error||payload?.message||`HTTP ${response.status}`;
      if(response.status===401){
        throw new Error(`Edge Function authorization failed (401): ${detail}. In Supabase Edge Functions, turn OFF the built-in Verify JWT setting for this function, then redeploy.`);
      }
      if(response.status===404){
        throw new Error('Edge Function not found (404). Deploy a function named exactly: admin-create-client-user.');
      }
      throw new Error(`Edge Function error (${response.status}): ${detail}`);
    }

    setCredentialState(`Login ready — Username: ${payload.username||username}`,'success');
    $('client-temp-password').value='';
    $('client-temp-password').type='password';
    if($('toggle-client-temp-password')) $('toggle-client-temp-password').textContent='Show';

    await loadCloudData();
  }catch(error){
    console.error('Client login creation failed:',error);
    setCredentialState(error?.message||'Could not create the client login.','error');
  }finally{
    button.disabled=false;
  }
}
async function openClient(id,returnView='clients'){
  const c=clients.find(x=>x.id===id);if(!c)return;activeClientId=id;detailReturnView=returnView;
  await renderClientDetail(c);setView('client-detail');
}

const fields={name:'client-name',company:'client-company',email:'client-email',phone:'client-phone',website:'client-website',projectType:'client-project-type',status:'client-status',priority:'client-priority',startDate:'client-start',deadline:'client-deadline',completedDate:'client-completed',budget:'client-budget',overview:'client-overview',hosting:'client-hosting',stack:'client-stack',registrar:'client-registrar',contact:'client-contact',deliverables:'client-deliverables',notes:'client-notes',clientUsername:'client-username',permission:'client-permission',tags:'client-tags'};
async function openModal(id=null){
  if(currentRole!=='admin')return;
  $('modal-title').textContent=id?'Edit client':'Add client';$('client-id').value=id||'';
  const c=id?clients.find(x=>x.id===id):null;
  Object.entries(fields).forEach(([key,elId])=>{$(elId).value=key==='tags'?(c?(c.tags||[]).join(', '):''):(c?(c[key]||''):(key==='status'?'ongoing':key==='priority'?'Normal':''))});
  $('client-submitted-info').value='';
  if($('client-temp-password')){
    $('client-temp-password').value='';
    $('client-temp-password').type='password';
  }
  if($('toggle-client-temp-password')) $('toggle-client-temp-password').textContent='Show';
  if($('credential-result')){
    $('credential-result').textContent='';
    $('credential-result').className='save-state credential-result';
  }
  els.deleteClient.classList.toggle('hidden',!id);els.saveState.textContent=id?'Autosave on':'New client — save or create login when ready';
  els.modalBackdrop.classList.remove('hidden');await renderModalFiles(id);
  if(id){try{const s=await getSubmission(id);$('client-submitted-info').value=s?.info||''}catch(e){}}
}
function closeModal(){els.modalBackdrop.classList.add('hidden')}
function collectForm(){
  const c={};Object.entries(fields).forEach(([key,id])=>{let v=$(id).value.trim();if(key==='tags')v=v.split(',').map(x=>x.trim()).filter(Boolean);c[key]=v});return c;
}
async function saveForm(show=true){
  if(currentRole!=='admin'||!$('client-name').value.trim())return null;
  const id=$('client-id').value,c=collectForm(),row=toRow(c);
  let result;
  if(id)result=await sb.from('clients').update(row).eq('id',id).select().single();
  else result=await sb.from('clients').insert(row).select().single();
  if(result.error){showToast(result.error.message);throw result.error}
  const saved=fromRow(result.data);$('client-id').value=saved.id;
  const submitted=$('client-submitted-info').value.trim();
  if(submitted){
    // Admin can read submissions but the schema intentionally doesn't let admin impersonate a client submission.
    // Keep this field client-controlled in cloud mode.
  }
  await loadCloudData();if(show)showToast('Client saved');return saved;
}
function scheduleFormAutosave(event){
  if(currentRole!=='admin')return;

  // Login credentials have their own explicit Save/Create button.
  // Do not let normal form autosave fire while username/password is being edited.
  if(event?.target?.closest?.('.credential-panel'))return;

  if(!$('client-id').value)return;
  clearTimeout(formAutosaveTimer);
  els.saveState.textContent='Saving…';
  formAutosaveTimer=setTimeout(
    ()=>saveForm(false)
      .then(()=>els.saveState.textContent='Autosaved')
      .catch(()=>els.saveState.textContent='Save failed'),
    700
  );
}

function safeFileName(name){return name.replace(/[^\w.\-() ]+/g,'_').replace(/\s+/g,'_').slice(-160)}
async function uploadFiles(clientId,files){
  for(const file of files){
    const path=`${clientId}/${Date.now()}-${Math.random().toString(36).slice(2,7)}-${safeFileName(file.name)}`;
    const {error}=await sb.storage.from('client-files').upload(path,file,{upsert:false,contentType:file.type||undefined});
    if(error){showToast(error.message);throw error}
  }
  await renderDetailFiles(clientId);await renderModalFiles(clientId);showToast(`${files.length} file${files.length===1?'':'s'} uploaded`);
}
async function listFiles(clientId){
  const {data,error}=await sb.storage.from('client-files').list(clientId,{limit:100,sortBy:{column:'created_at',order:'desc'}});
  if(error)throw error;return (data||[]).filter(x=>x.name!=='.emptyFolderPlaceholder');
}
async function renderDetailFiles(clientId){
  const box=$('detail-files');if(!box)return;try{
    const files=await listFiles(clientId);
    box.innerHTML=files.length?files.map(f=>`<div class="attachment"><div class="file-meta"><strong>${esc(f.name.replace(/^\d+-[a-z0-9]+-/,''))}</strong><small>${esc(humanSize(f.metadata?.size||0))}</small></div><div class="file-actions"><button class="mini-btn" data-open-file="${esc(clientId+'/'+f.name)}">Open</button>${(currentRole==='admin'||(clients.find(c=>c.id===clientId)?.permission!=='view'))?`<button class="mini-btn delete" data-delete-cloud-file="${esc(clientId+'/'+f.name)}">Delete</button>`:''}</div></div>`).join(''):'<div class="muted">No files attached yet.</div>';
  }catch(e){box.innerHTML=`<div class="muted">${esc(e.message)}</div>`}
}
async function renderModalFiles(clientId){
  const box=$('file-list');if(!box)return;
  if(!clientId){box.innerHTML='<div class="muted">Save the client first, then upload files.</div>';return}
  try{
    const files=await listFiles(clientId);
    box.innerHTML=files.length?files.map(f=>`<div class="file-item"><div class="file-meta"><strong>${esc(f.name.replace(/^\d+-[a-z0-9]+-/,''))}</strong><small>${esc(humanSize(f.metadata?.size||0))}</small></div><div class="file-actions"><button type="button" class="mini-btn" data-open-file="${esc(clientId+'/'+f.name)}">Open</button><button type="button" class="mini-btn delete" data-delete-cloud-file="${esc(clientId+'/'+f.name)}">Delete</button></div></div>`).join(''):'<div class="muted">No files attached yet.</div>';
  }catch(e){box.innerHTML=`<div class="muted">${esc(e.message)}</div>`}
}
async function openCloudFile(path){
  const {data,error}=await sb.storage.from('client-files').createSignedUrl(path,60);
  if(error){showToast(error.message);return}window.open(data.signedUrl,'_blank','noopener');
}
async function deleteCloudFile(path){
  if(!confirm('Delete this file?'))return;
  const {error}=await sb.storage.from('client-files').remove([path]);if(error){showToast(error.message);return}
  if(activeClientId)await renderDetailFiles(activeClientId);
  if($('client-id').value)await renderModalFiles($('client-id').value);
  showToast('File deleted');
}

async function moveToTrash(id){
  if(currentRole!=='admin')return;
  const {error}=await sb.from('clients').update({deleted_at:new Date().toISOString()}).eq('id',id);
  if(error){showToast(error.message);return}await loadCloudData();showToast('Moved to Trash');
}
async function restoreClient(id){
  const {error}=await sb.from('clients').update({deleted_at:null}).eq('id',id);
  if(error){showToast(error.message);return}await loadCloudData();renderTrash();showToast('Client restored');
}
async function permanentlyDeleteClient(id){
  if(!confirm('Permanently delete this client and all attached files?'))return;
  try{const files=await listFiles(id);if(files.length)await sb.storage.from('client-files').remove(files.map(f=>`${id}/${f.name}`))}catch(e){}
  const {error}=await sb.from('clients').delete().eq('id',id);if(error){showToast(error.message);return}
  await loadCloudData();renderTrash();showToast('Permanently deleted');
}
async function emptyTrash(){
  if(!trash.length||!confirm('Permanently delete everything in Trash?'))return;
  for(const c of [...trash])await permanentlyDeleteClient(c.id);
}
function globalSearch(q){if(!q.trim()||currentRole!=='admin')return;setView('clients');els.clientSearch.value=q;renderClients(q)}

document.querySelectorAll('.nav-link').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
document.addEventListener('click',e=>{
  const tab=e.target.closest('[data-client-view]');
  if(tab && currentRole!=='admin') renderClientPortal(tab.dataset.clientView);
});
document.addEventListener('click',async e=>{
  const edit=e.target.closest('[data-edit-client]');if(edit){await openModal(edit.dataset.editClient);return}
  const del=e.target.closest('[data-trash-client]');if(del){if(confirm('Move this client to Trash?'))await moveToTrash(del.dataset.trashClient);return}
  const restore=e.target.closest('[data-restore-client]');if(restore){await restoreClient(restore.dataset.restoreClient);return}
  const perma=e.target.closest('[data-perma-client]');if(perma){await permanentlyDeleteClient(perma.dataset.permaClient);return}
  const openf=e.target.closest('[data-open-file]');if(openf){await openCloudFile(openf.dataset.openFile);return}
  const delf=e.target.closest('[data-delete-cloud-file]');if(delf){await deleteCloudFile(delf.dataset.deleteCloudFile);return}
  const row=e.target.closest('[data-open-client]');if(row){const current=document.querySelector('.view.active')?.id.replace('-view','')||'clients';await openClient(row.dataset.openClient,current);return}
  const jump=e.target.closest('[data-view-jump]');if(jump)setView(jump.dataset.viewJump);
});
['add-client','add-client-top','add-client-hero'].forEach(id=>$(id)?.addEventListener('click',()=>openModal()));
$('modal-close')?.addEventListener('click',closeModal);$('cancel-client')?.addEventListener('click',closeModal);
els.modalBackdrop?.addEventListener('click',e=>{if(e.target===els.modalBackdrop)closeModal()});
els.clientForm?.addEventListener('submit',async e=>{e.preventDefault();const c=await saveForm(true);if(c){closeModal();await openClient(c.id,'clients')}});
els.clientForm?.addEventListener('input',scheduleFormAutosave);els.clientForm?.addEventListener('change',scheduleFormAutosave);
els.deleteClient?.addEventListener('click',async()=>{const id=$('client-id').value;if(id&&confirm('Move this client to Trash?')){await moveToTrash(id);closeModal();setView('clients')}});
$('create-client-login')?.addEventListener('click',createOrResetClientLogin);
$('toggle-client-temp-password')?.addEventListener('click',()=>{
  const input=$('client-temp-password');
  if(!input)return;
  const show=input.type==='password';
  input.type=show?'text':'password';
  $('toggle-client-temp-password').textContent=show?'Hide':'Show';
});
$('client-files')?.addEventListener('change',async e=>{let id=$('client-id').value;if(!id){const c=await saveForm(false);id=c?.id||''}if(id&&e.target.files?.length){await uploadFiles(id,[...e.target.files]);e.target.value=''}});
$('empty-trash')?.addEventListener('click',emptyTrash);
els.clientSearch?.addEventListener('input',()=>renderClients());els.clientSort?.addEventListener('change',()=>renderClients());els.clientStatusFilter?.addEventListener('change',()=>renderClients());
els.globalSearch?.addEventListener('keydown',e=>{if(e.key==='Enter')globalSearch(e.target.value)});
$('detail-back')?.addEventListener('click',()=>setView(currentRole==='admin'?(detailReturnView==='client-detail'?'clients':detailReturnView):'client-detail'));
$('edit-client-detail')?.addEventListener('click',()=>currentRole==='admin'&&activeClientId&&openModal(activeClientId));
els.detailSearch?.addEventListener('input',async e=>{const c=clients.find(x=>x.id===activeClientId);if(c)await renderClientDetail(c,e.target.value)});
window.addEventListener('resize',()=>{if(document.querySelector('#dashboard-view.active'))renderMonthlyChart()});

$('login-form')?.addEventListener('submit',async e=>{
  e.preventDefault();
  if(!configured())return;
  $('login-error').textContent='Signing in…';
  const identifier=$('login-username').value.trim();
  let loginEmail=identifier;
  if(!identifier.includes('@')){
    const {data:resolved,error:resolveError}=await sb.rpc('resolve_login_email',{login_name:identifier});
    if(resolveError||!resolved){$('login-error').textContent='Username not found.';return}
    loginEmail=resolved;
  }
  try {
    const {data,error}=await sb.auth.signInWithPassword({email:loginEmail,password:$('login-password').value});
    if(error){
      $('login-error').textContent=error.message;
      return;
    }
    session=data.session;
    $('login-error').textContent='';
  } catch (err) {
    console.error(err);
    $('login-error').textContent=err?.message||'Unable to sign in. Please try again.';
  }
});
$('create-account')?.addEventListener('click',async()=>{
  if(!configured())return;
  const email=$('login-username').value.trim(),password=$('login-password').value;
  if(!email||password.length<6){$('login-error').textContent='Enter an email and a password of at least 6 characters.';return}
  $('login-error').textContent='Creating account…';
  const {data,error}=await sb.auth.signUp({email,password,options:{emailRedirectTo:location.href}});
  if(error){$('login-error').textContent=error.message;return}
  $('login-error').textContent=data.session?'Account created.':'Account created. Check your email to confirm it, then sign in.';
});
$('toggle-password')?.addEventListener('click',()=>{const i=$('login-password'),show=i.type==='password';i.type=show?'text':'password';$('toggle-password').textContent=show?'Hide':'Show'});
$('sign-out')?.addEventListener('click',()=>sb?.auth.signOut());


$('save-billing-settings')?.addEventListener('click',saveBillingSettings);
$('clock-in')?.addEventListener('click',clockIn);
$('clock-out')?.addEventListener('click',clockOut);
$('add-manual-hours')?.addEventListener('click',addManualHours);
$('manual-hours')?.addEventListener('input',updateManualAmount);
$('manual-rate')?.addEventListener('input',updateManualAmount);
['invoice-client','invoice-start','invoice-end','invoice-rate'].forEach(id=>$(id)?.addEventListener('input',updateInvoicePreviewNumbers));
$('invoice-hours-mode')?.addEventListener('change',updateInvoiceHoursModeUI);
$('invoice-manual-hours')?.addEventListener('input',updateInvoicePreviewNumbers);
$('preview-invoice')?.addEventListener('click',previewInvoiceDraft);
$('create-invoice')?.addEventListener('click',createInvoice);
$('invoice-preview-close')?.addEventListener('click',()=>$('invoice-preview-backdrop').classList.add('hidden'));
$('invoice-preview-backdrop')?.addEventListener('click',e=>{if(e.target===$('invoice-preview-backdrop'))$('invoice-preview-backdrop').classList.add('hidden')});
document.addEventListener('click',async e=>{
  const vi=e.target.closest('[data-view-invoice]');if(vi){const inv=invoices.find(x=>x.id===vi.dataset.viewInvoice);if(inv)openInvoicePreview(inv)}
  const mp=e.target.closest('[data-mark-paid]');if(mp)await markInvoicePaid(mp.dataset.markPaid);
});

console.info('Jeffdesign101 build:',JEFFDESIGN_BUILD);
initializeAuth().catch(e=>{
  console.error(e);lockUI(true);$('login-error').textContent=e.message||'Could not initialize CRM.';
});
