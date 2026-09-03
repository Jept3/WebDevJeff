const BUILD="clean-v1";
const cfg=window.LIME_CRM_CONFIG||{};
const $=id=>document.getElementById(id);
const $$=q=>[...document.querySelectorAll(q)];
const esc=(v="")=>String(v).replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]));
const money=n=>"$"+Number(n||0).toFixed(2);
const fmtDate=v=>{if(!v)return"—";const d=new Date(String(v).length===10?v+"T00:00:00":v);return isNaN(d)?"—":d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})};
const fmtTime=v=>v?new Date(v).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—";
const humanSize=n=>{let x=Number(n||0),u=["B","KB","MB","GB"],i=0;while(x>=1024&&i<3){x/=1024;i++}return`${i&&x<10?x.toFixed(1):Math.round(x)} ${u[i]}`};
const websiteHref=v=>/^https?:\/\//i.test(v||"")?v:"https://"+v;

const state={
  sb:null,session:null,profile:null,role:null,clients:[],tasks:[],time:[],invoices:[],billing:null,
  activeClient:null,adminView:"dashboard",employerView:"overview",workspacePromise:null,timer:null
};

function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove("show"),2200)}
function configured(){return !!cfg.supabaseUrl&&!!cfg.supabasePublishableKey&&!cfg.supabaseUrl.includes("YOUR_")}
function showLogin(msg=""){document.body.classList.remove("booting");$("loginScreen").classList.remove("hidden");$("app").classList.add("hidden");$("loginError").textContent=msg}
function showApp(){document.body.classList.remove("booting");$("loginScreen").classList.add("hidden");$("app").classList.remove("hidden")}
function currentClient(){return state.clients.find(c=>c.id===state.activeClient)||state.clients[0]||null}
function roleIsAdmin(){return state.role==="admin"}

function initSupabase(){
  if(state.sb)return state.sb;
  if(!configured())throw new Error("Supabase config is missing.");
  if(!window.supabase?.createClient)throw new Error("Supabase library did not load.");
  state.sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{
    auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true,storage:localStorage,storageKey:"jeffdesign101-auth-v1"}
  });
  return state.sb;
}

async function init(){
  try{
    const sb=initSupabase();
    const {data,error}=await sb.auth.getSession();
    if(error)throw error;
    state.session=data.session;
    if(state.session)await loadWorkspace();
    else showLogin();

    sb.auth.onAuthStateChange((event,session)=>{
      if(event==="SIGNED_OUT"){state.session=null;state.profile=null;state.role=null;showLogin()}
      else if(session)state.session=session;
    });
  }catch(e){console.error(e);showLogin(e.message)}
}

async function loadWorkspace(){
  if(state.workspacePromise)return state.workspacePromise;
  state.workspacePromise=(async()=>{
    const sb=initSupabase();
    const {data:p,error:pe}=await sb.from("profiles").select("id,email,role").eq("id",state.session.user.id).maybeSingle();
    if(pe)throw pe;
    state.profile=p||{id:state.session.user.id,email:state.session.user.email,role:"client"};
    state.role=state.profile.role||"client";

    const {data:c,error:ce}=await sb.from("clients").select("*").order("updated_at",{ascending:false});
    if(ce)throw ce;
    state.clients=(c||[]).filter(x=>!x.deleted_at);

    await Promise.all([loadTasks(),loadTime(),loadInvoices(),loadBilling()]);
    showApp();
    configureRoleUI();
    if(roleIsAdmin())renderAdmin("dashboard"); else {state.activeClient=state.clients[0]?.id||null;renderEmployer("overview")}
  })().finally(()=>state.workspacePromise=null);
  return state.workspacePromise;
}

async function loadTasks(){const {data,error}=await state.sb.from("client_tasks").select("*").order("created_at",{ascending:false});if(error)throw error;state.tasks=data||[]}
async function loadTime(){const {data,error}=await state.sb.from("time_entries").select("*").order("clock_in",{ascending:false});if(error)throw error;state.time=data||[]}
async function loadInvoices(){const {data,error}=await state.sb.from("invoices").select("*").order("invoice_date",{ascending:false});if(error)throw error;state.invoices=data||[]}
async function loadBilling(){
  let q=state.sb.from("billing_settings").select("*");
  q=roleIsAdmin()?q.eq("user_id",state.session.user.id):q.order("updated_at",{ascending:false}).limit(1);
  const {data,error}=await q.maybeSingle();
  if(error)console.warn(error);
  state.billing=data||{hourly_rate:3,business_name:"Jeffdesign101 / Webdev VA",full_name:"",email:"",phone:"",address:"Philippines",payment_instructions:""};
}

function configureRoleUI(){
  $("roleBadge").textContent=roleIsAdmin()?"ADMIN":"EMPLOYER";
  $("workspaceLabel").textContent=roleIsAdmin()?"ADMIN WORKSPACE":"EMPLOYER PORTAL";
  $("adminSidebar").classList.toggle("hidden",!roleIsAdmin());
  $("employerTabs").classList.toggle("hidden",roleIsAdmin());
  document.body.classList.toggle("employer",!roleIsAdmin());
  updateStatusDock();
}

function setPageTitle(t){$("pageTitle").textContent=t}
function renderAdmin(view){
  state.adminView=view;
  $$("[data-admin-view]").forEach(b=>b.classList.toggle("active",b.dataset.adminView===view));
  const map={dashboard:renderDashboard,clients:renderClients,tasks:renderTaskInbox,time:renderTimePage,invoices:renderAdminInvoices,billing:renderBilling,trash:renderTrash};
  map[view]?.();
}
function renderEmployer(view){
  state.employerView=view;
  $$("[data-employer-view]").forEach(b=>b.classList.toggle("active",b.dataset.employerView===view));
  const map={overview:renderEmployerOverview,tasks:renderEmployerTasks,files:renderEmployerFiles,work:renderEmployerWork,invoices:renderEmployerInvoices,account:renderEmployerAccount};
  map[view]?.();
}

function statusPill(s){const label={ongoing:"Active",paused:"Paused",complete:"Complete"}[s]||s;return`<span class="status ${esc(s)}">${esc(label)}</span>`}
function clientName(id){return state.clients.find(c=>c.id===id)?.name||"Employer"}
function hoursOf(e){return Number(e.hours??((new Date(e.clock_out||Date.now())-new Date(e.clock_in))/36e5))}
function todayStart(){const d=new Date();d.setHours(0,0,0,0);return d}
function weekStart(){const d=todayStart(),day=d.getDay()||7;d.setDate(d.getDate()-day+1);return d}
function monthStart(){const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)}
function sumHours(list,start=null){return list.filter(e=>!start||new Date(e.clock_in)>=start).reduce((s,e)=>s+hoursOf(e),0)}
function dur(h){const m=Math.round(h*60);return`${Math.floor(m/60)}h ${String(m%60).padStart(2,"0")}m`}

function renderDashboard(){
  setPageTitle("Dashboard");
  const active=state.time.filter(e=>!e.clock_out),open=state.tasks.filter(t=>!t.done),pending=state.invoices.filter(i=>i.status==="pending");
  $("taskBadge").textContent=state.tasks.filter(t=>!t.admin_seen_at).length;
  $("taskBadge").classList.toggle("hidden",!state.tasks.some(t=>!t.admin_seen_at));
  $("view").innerHTML=`
    <div class="hero glass"><div><span class="section-label">JEFFDESIGN101</span><h1>VA work, organized clearly.</h1><p>Employer requests, time tracking, files and billing in one stable workspace.</p></div><button class="btn primary" data-action="new-client">+ Add Employer</button></div>
    <div class="stats">
      <div class="stat glass"><span>Employers</span><strong>${state.clients.length}</strong></div>
      <div class="stat glass"><span>Open tasks</span><strong>${open.length}</strong></div>
      <div class="stat glass"><span>Active sessions</span><strong>${active.length}</strong></div>
      <div class="stat glass"><span>Outstanding</span><strong>${money(pending.reduce((s,i)=>s+Number(i.total||0),0))}</strong></div>
    </div>
    <div class="grid2">
      <article class="card glass"><div class="section-head"><div><span class="section-label">TASK INBOX</span><h3>Latest employer requests</h3></div><button class="mini-btn" data-admin-view="tasks">Open inbox</button></div>${taskListHtml(open.slice(0,5),true)}</article>
      <article class="card glass"><span class="section-label">ACTIVE WORK</span><h3>Running timers</h3>${active.length?active.map(activeSessionHtml).join(""):'<div class="empty"><strong>No active session</strong>Start work from Time Log.</div>'}</article>
    </div>`;
}

function renderClients(){
  setPageTitle("Employers");
  $("view").innerHTML=`
    <article class="card glass">
      <div class="section-head"><div><span class="section-label">DIRECTORY</span><h3>Employers & projects</h3></div><div class="toolbar"><input id="clientSearch" placeholder="Search name, company, website"><select id="clientSort"><option value="updated">Recently updated</option><option value="name">Name A–Z</option><option value="status">Status</option></select><button class="btn primary" data-action="new-client">+ Add Employer</button></div></div>
      <div id="clientRows" class="table-list"></div>
    </article>`;
  renderClientRows();
}
function renderClientRows(){
  const q=($("clientSearch")?.value||"").toLowerCase(),sort=$("clientSort")?.value||"updated";
  let list=state.clients.filter(c=>[c.name,c.company,c.website,c.project_type].some(v=>String(v||"").toLowerCase().includes(q)));
  if(sort==="name")list.sort((a,b)=>a.name.localeCompare(b.name));else if(sort==="status")list.sort((a,b)=>a.status.localeCompare(b.status));else list.sort((a,b)=>String(b.updated_at).localeCompare(String(a.updated_at)));
  $("clientRows").innerHTML=list.length?list.map(c=>`<div class="row-card"><div><strong>${esc(c.name)}</strong><small>${esc(c.company||c.project_type||"Website project")}</small></div><div>${statusPill(c.status)}</div><div><strong>${esc(c.client_username||"No login")}</strong><small>${c.portal_permission==="view"?"View Only":"Can Edit"}</small></div><div class="row-actions"><button class="mini-btn" data-action="client-detail" data-id="${c.id}">Open</button><button class="mini-btn" data-action="edit-client" data-id="${c.id}">Edit</button><button class="mini-btn" data-action="trash-client" data-id="${c.id}">Trash</button></div></div>`).join(""):'<div class="empty"><strong>No employer found</strong></div>';
}

async function renderClientDetail(id){
  const c=state.clients.find(x=>x.id===id);if(!c)return;
  state.activeClient=id;setPageTitle("Employer Details");
  const sub=await getSubmission(id),tasks=state.tasks.filter(t=>t.client_id===id),files=await listFiles(id);
  $("view").innerHTML=`
    <button class="btn ghost" data-admin-view="clients">← Back</button>
    <article class="card glass" style="margin-top:10px"><div class="section-head"><div><span class="section-label">EMPLOYER / WEBSITE PROJECT</span><h3>${esc(c.name)}</h3><p class="muted">${esc(c.company||"")}</p></div><div>${statusPill(c.status)} <button class="mini-btn" data-action="edit-client" data-id="${c.id}">Edit</button></div></div>
    <div class="info-grid"><div class="info"><span>Project</span><strong>${esc(c.project_type||"—")}</strong></div><div class="info"><span>Priority</span><strong>${esc(c.priority||"Normal")}</strong></div><div class="info"><span>Started</span><strong>${fmtDate(c.start_date)}</strong></div><div class="info"><span>Deadline</span><strong>${fmtDate(c.deadline)}</strong></div></div></article>
    <div class="grid2">
      <article class="card glass"><span class="section-label">EMPLOYER INFORMATION</span><h3>Project information</h3><div>${nl2br(sub?.project_information||"No employer project information yet.")}</div></article>
      <article class="card glass"><span class="section-label">SHARED NOTES</span><h3>Notes from employer</h3><div>${nl2br(sub?.shared_notes||"No shared notes yet.")}</div></article>
    </div>
    <article class="card glass" style="margin-top:13px"><div class="section-head"><div><span class="section-label">EMPLOYER TASKS</span><h3>Read-only requests</h3></div><button class="mini-btn" data-admin-view="tasks">Open Task Inbox</button></div>${taskListHtml(tasks,false)}</article>
    <article class="card glass" style="margin-top:13px"><span class="section-label">FILES</span><h3>Project files</h3>${fileListHtml(files,c,true)}</article>`;
}

function renderTaskInbox(){
  setPageTitle("Task Inbox");
  const unread=state.tasks.filter(t=>!t.admin_seen_at).length;$("taskBadge").textContent=unread;$("taskBadge").classList.toggle("hidden",!unread);
  $("view").innerHTML=`<article class="card glass"><div class="section-head"><div><span class="section-label">EMPLOYER REQUESTS</span><h3>Task Inbox</h3></div><select id="taskFilter"><option value="all">All</option><option value="unread">Unread</option><option value="open">Open</option><option value="done">Completed</option></select></div><div id="taskInboxRows"></div></article>`;
  renderTaskInboxRows();
}
function renderTaskInboxRows(){
  const f=$("taskFilter")?.value||"all";
  const list=state.tasks.filter(t=>f==="all"||f==="unread"&&!t.admin_seen_at||f==="open"&&!t.done||f==="done"&&t.done);
  $("taskInboxRows").innerHTML=list.length?list.map(t=>`<div class="row-card"><div><strong>${esc(t.task)}</strong><small>${esc(stripHtml(t.details||"")).slice(0,130)}${stripHtml(t.details||"").length>130?"…":""}</small></div><div><strong>${esc(clientName(t.client_id))}</strong><small>${esc(t.priority||"Normal")}</small></div><div>${t.done?'<span class="status complete">Completed</span>':'<span class="status">Open</span>'}${!t.admin_seen_at?' <span class="status">New</span>':""}</div><div class="row-actions"><button class="mini-btn" data-action="view-task" data-id="${t.id}">Open</button><button class="mini-btn" data-action="toggle-task" data-id="${t.id}">${t.done?"Reopen":"Mark Done"}</button></div></div>`).join(""):'<div class="empty"><strong>No tasks</strong></div>';
}

function renderTimePage(){
  setPageTitle("Time Log");
  const active=state.time.filter(e=>!e.clock_out),rate=Number(state.billing?.hourly_rate||3);
  $("view").innerHTML=`
    <div class="stats"><div class="stat glass"><span>Today</span><strong>${dur(sumHours(state.time,todayStart()))}</strong></div><div class="stat glass"><span>This week</span><strong>${dur(sumHours(state.time,weekStart()))}</strong></div><div class="stat glass"><span>Rate</span><strong>${money(rate)}/h</strong></div><div class="stat glass"><span>Active clients</span><strong>${active.length}</strong></div></div>
    <div class="grid2">
      <article class="card glass"><span class="section-label">START / STOP</span><h3>Client work session</h3>
        <div class="field"><span>Employer</span><select id="timerClient"><option value="">Select employer</option>${state.clients.map(c=>`<option value="${c.id}">${esc(c.name)}${active.some(a=>a.client_id===c.id)?" • ACTIVE":""}</option>`).join("")}</select></div>
        <div class="field"><span>Task</span><input id="timerTask" placeholder="What are you working on?"></div>
        <div class="row-actions" style="justify-content:flex-start;margin-top:12px"><button class="btn primary" data-action="clock-in">Login / Start</button><button class="btn danger" data-action="clock-out-selected">Logout / Stop</button></div>
      </article>
      <article class="card glass"><span class="section-label">MANUAL ENTRY</span><h3>Add hours worked</h3>
        <div class="form-grid"><div class="field"><span>Employer</span><select id="manualClient"><option value="">Select employer</option>${state.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div><div class="field"><span>Date</span><input id="manualDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><span>Hours</span><input id="manualHours" type="number" min=".01" step=".25"></div><div class="field"><span>Rate</span><input id="manualRate" type="number" min="0" step=".01" value="${rate.toFixed(2)}"></div></div>
        <div class="field"><span>Description</span><input id="manualTask" placeholder="Work description"></div><button class="btn primary" data-action="manual-hours" style="margin-top:12px">Add Hours</button>
      </article>
    </div>
    <article class="card glass" style="margin-top:13px"><span class="section-label">ACTIVE SESSIONS</span><h3>Running client timers</h3><div id="activeSessions">${active.length?active.map(activeSessionHtml).join(""):'<div class="empty"><strong>No active sessions</strong></div>'}</div></article>
    <article class="card glass" style="margin-top:13px"><span class="section-label">WORK HISTORY</span><h3>Recent entries</h3><div class="table-list">${state.time.slice(0,40).map(e=>`<div class="row-card"><div><strong>${esc(clientName(e.client_id))}</strong><small>${esc(e.task||"General work")}</small></div><div><strong>${fmtDate(e.clock_in)}</strong><small>${fmtTime(e.clock_in)}${e.clock_out?" → "+fmtTime(e.clock_out):" → active"}</small></div><div><strong>${dur(hoursOf(e))}</strong><small>${money(e.hourly_rate||rate)}/h</small></div><div>${e.invoice_id?'<span class="status complete">Invoiced</span>':e.clock_out?'<span class="status">Uninvoiced</span>':'<span class="status">Running</span>'}</div></div>`).join("")}</div></article>`;
  startTicker();
}

function activeSessionHtml(e){return`<div class="active-session"><div><strong>${esc(clientName(e.client_id))}</strong><small class="muted">${esc(e.task||"General work")}</small></div><div><span class="muted">Started</span><strong>${fmtTime(e.clock_in)}</strong></div><div class="live-time" data-session-clock="${e.id}">00:00:00</div><button class="mini-btn" data-action="stop-session" data-id="${e.id}">Stop</button></div>`}

function renderAdminInvoices(){
  setPageTitle("Invoices");
  const pending=state.invoices.filter(i=>i.status==="pending"),paid=state.invoices.filter(i=>i.status==="paid"),rate=Number(state.billing?.hourly_rate||3);
  $("view").innerHTML=`
    <div class="stats"><div class="stat glass"><span>Incoming</span><strong>${pending.length}</strong></div><div class="stat glass"><span>Paid</span><strong>${paid.length}</strong></div><div class="stat glass"><span>Outstanding</span><strong>${money(pending.reduce((s,i)=>s+Number(i.total||0),0))}</strong></div><div class="stat glass"><span>Total paid</span><strong>${money(paid.reduce((s,i)=>s+Number(i.total||0),0))}</strong></div></div>
    <article class="card glass" style="margin-top:13px"><span class="section-label">CREATE INVOICE</span><h3>Generate invoice</h3>
      <div class="form-grid"><div class="field"><span>Employer</span><select id="invoiceClient"><option value="">Select employer</option>${state.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div><div class="field"><span>Invoice #</span><input id="invoiceNumber" value="${nextInvoiceNumber()}"></div><div class="field"><span>Invoice date</span><input id="invoiceDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><span>Hours source</span><select id="invoiceMode"><option value="time">Use Time Log</option><option value="manual">Enter Hours Manually</option></select></div><div class="field"><span>Period start</span><input id="invoiceStart" type="date"></div><div class="field"><span>Period end</span><input id="invoiceEnd" type="date"></div><div class="field"><span>Manual hours</span><input id="invoiceManualHours" type="number" min=".01" step=".25" disabled></div><div class="field"><span>Hourly rate</span><input id="invoiceRate" type="number" min="0" step=".01" value="${rate.toFixed(2)}"></div></div>
      <div class="field"><span>Description</span><input id="invoiceDescription" value="Online Web Work"></div><div class="field"><span>Notes / payment instructions</span><textarea id="invoiceNotes" rows="4">${esc(state.billing?.payment_instructions||"")}</textarea></div>
      <div class="section-head" style="margin-top:12px"><div><strong id="invoiceHoursPreview">0.00 hrs</strong><small class="muted"> · </small><strong id="invoiceTotalPreview">$0.00</strong></div><div class="row-actions"><button class="btn ghost" data-action="preview-invoice">Preview</button><button class="btn primary" data-action="create-invoice">Create Invoice</button></div></div>
    </article>
    <article class="card glass" style="margin-top:13px"><span class="section-label">BILLING HISTORY</span><h3>Incoming & paid invoices</h3>${invoiceRows(state.invoices,true)}</article>`;
  updateInvoicePreview();
}

function invoiceRows(list,admin){return`<div class="table-list">${list.length?list.map(i=>`<div class="row-card"><div><strong>${esc(i.invoice_number)}</strong><small>${esc(clientName(i.client_id))} · ${esc(i.description||"Online Work")}</small></div><div><strong>${fmtDate(i.invoice_date)}</strong><small>${i.period_start?fmtDate(i.period_start)+" — "+fmtDate(i.period_end):""}</small></div><div><strong>${Number(i.hours||0).toFixed(2)} hrs</strong><small>${money(i.hourly_rate)}/h · ${money(i.total)}</small></div><div class="row-actions"><span class="status ${i.status==="paid"?"complete":""}">${i.status==="paid"?"Paid":"Incoming"}</span><button class="mini-btn" data-action="view-invoice" data-id="${i.id}">View</button>${admin&&i.status!=="paid"?`<button class="mini-btn" data-action="mark-paid" data-id="${i.id}">Mark Paid</button>`:""}</div></div>`).join(""):'<div class="empty"><strong>No invoices</strong></div>'}</div>`}

function renderBilling(){
  setPageTitle("Rate & Billing");const b=state.billing||{};
  $("view").innerHTML=`<article class="card glass"><span class="section-label">BILLING PROFILE</span><h3>Hourly rate & invoice information</h3><div class="form-grid"><div class="field"><span>Hourly rate USD</span><input id="billRate" type="number" step=".01" value="${Number(b.hourly_rate||3)}"></div><div class="field"><span>Business / VA name</span><input id="billBusiness" value="${esc(b.business_name||"Jeffdesign101 / Webdev VA")}"></div><div class="field"><span>Your full name</span><input id="billName" value="${esc(b.full_name||"")}"></div><div class="field"><span>Email shown on invoice</span><input id="billEmail" value="${esc(b.email||"")}"></div><div class="field"><span>Phone</span><input id="billPhone" value="${esc(b.phone||"")}"></div><div class="field"><span>Address</span><input id="billAddress" value="${esc(b.address||"")}"></div></div><div class="field"><span>Payment instructions</span><textarea id="billPayment" rows="5">${esc(b.payment_instructions||"")}</textarea></div><button class="btn primary" data-action="save-billing" style="margin-top:12px">Save Billing Settings</button></article>`;
}

async function renderTrash(){
  setPageTitle("Trash");
  const {data,error}=await state.sb.from("clients").select("*").not("deleted_at","is",null).order("deleted_at",{ascending:false});if(error){toast(error.message);return}
  $("view").innerHTML=`<article class="card glass"><span class="section-label">TRASH</span><h3>Deleted employers</h3><div class="table-list">${(data||[]).map(c=>`<div class="row-card"><div><strong>${esc(c.name)}</strong><small>${esc(c.company||"")}</small></div><div>${statusPill(c.status)}</div><div><small>Deleted ${fmtDate(c.deleted_at)}</small></div><div class="row-actions"><button class="mini-btn" data-action="restore-client" data-id="${c.id}">Restore</button></div></div>`).join("")||'<div class="empty"><strong>Trash is empty</strong></div>'}</div></article>`;
}

async function renderEmployerOverview(){
  setPageTitle("Employer Portal");const c=currentClient();if(!c){$("view").innerHTML='<div class="empty"><strong>No project linked</strong></div>';return}
  const sub=await getSubmission(c.id),tasks=state.tasks.filter(t=>t.client_id===c.id),files=await listFiles(c.id),editable=c.portal_permission!=="view";
  $("view").innerHTML=`
    <article class="card glass"><div class="section-head"><div><span class="section-label">EMPLOYER PROJECT</span><h3>${esc(c.name)}</h3><p class="muted">${esc(c.company||c.project_type||"Website project")}</p></div><div class="row-actions">${["ongoing","paused","complete"].map(s=>`<button class="mini-btn ${c.status===s?"active":""}" data-action="employer-status" data-status="${s}" ${editable?"":"disabled"}>${s==="ongoing"?"Active":s[0].toUpperCase()+s.slice(1)}</button>`).join("")}</div></div></article>
    <div class="stats"><div class="stat glass"><span>Open requests</span><strong>${tasks.filter(t=>!t.done).length}</strong></div><div class="stat glass"><span>Completed</span><strong>${tasks.filter(t=>t.done).length}</strong></div><div class="stat glass"><span>Incoming invoices</span><strong>${state.invoices.filter(i=>i.client_id===c.id&&i.status==="pending").length}</strong></div><div class="stat glass"><span>Amount due</span><strong>${money(state.invoices.filter(i=>i.client_id===c.id&&i.status==="pending").reduce((s,i)=>s+Number(i.total||0),0))}</strong></div></div>
    <div class="grid2">
      <article class="card glass"><span class="section-label">CURRENT REQUEST</span><h3>Send a task to your VA</h3>${editable?taskComposerHtml("overview"):'<p class="muted">This portal is View Only.</p>'}</article>
      <article class="card glass"><span class="section-label">CURRENT REQUESTS</span><h3>Tasks you've sent</h3>${taskListHtml(tasks.slice(0,5),false)}</article>
    </div>
    <article class="card glass" style="margin-top:13px"><span class="section-label">PROJECT INFORMATION</span><h3>Website information & instructions</h3>${editable?`<textarea id="projectInfo" rows="7">${esc(sub?.project_information||"")}</textarea><button class="btn primary" data-action="save-project-info" style="margin-top:9px">Save Information</button>`:`<div>${nl2br(sub?.project_information||"No project information yet.")}</div>`}</article>
    <article class="card glass" style="margin-top:13px"><span class="section-label">SHARED NOTES</span><h3>Notes for your VA</h3>${editable?`<textarea id="sharedNotes" rows="6">${esc(sub?.shared_notes||"")}</textarea><button class="btn primary" data-action="save-shared-notes" style="margin-top:9px">Save Notes</button>`:`<div>${nl2br(sub?.shared_notes||"No notes yet.")}</div>`}</article>
    <article class="card glass" style="margin-top:13px"><div class="section-head"><div><span class="section-label">FILES</span><h3>Send files to your VA</h3></div>${editable?'<label class="btn primary">+ Upload Files<input id="overviewFiles" type="file" multiple hidden></label>':""}</div>${fileListHtml(files,c,editable)}</article>`;
  setupRichEditors();updateStatusDock();
}
function renderEmployerTasks(){
  setPageTitle("Tasks");const c=currentClient(),list=state.tasks.filter(t=>t.client_id===c?.id),editable=c?.portal_permission!=="view";
  $("view").innerHTML=`<div class="grid2">${editable?`<article class="card glass"><span class="section-label">NEW REQUEST</span><h3>Send a task</h3>${taskComposerHtml("tasks")}</article>`:""}<article class="card glass"><span class="section-label">TASK STATUS</span><h3>${list.filter(t=>!t.done).length} open · ${list.filter(t=>t.done).length} completed</h3></article></div><article class="card glass" style="margin-top:13px"><span class="section-label">TASK HISTORY</span><h3>All requests</h3>${taskListHtml(list,false,true)}</article>`;setupRichEditors()
}
async function renderEmployerFiles(){setPageTitle("Files");const c=currentClient(),files=await listFiles(c?.id),editable=c?.portal_permission!=="view";$("view").innerHTML=`<article class="card glass"><div class="section-head"><div><span class="section-label">PROJECT FILES</span><h3>Shared documents</h3></div>${editable?'<label class="btn primary">+ Upload Files<input id="filesPageInput" type="file" multiple hidden></label>':""}</div>${fileListHtml(files,c,editable)}</article>`}
function renderEmployerWork(){
  setPageTitle("Work Monitor");const c=currentClient(),list=state.time.filter(e=>e.client_id===c?.id),active=list.find(e=>!e.clock_out);
  $("view").innerHTML=`<article class="card glass"><span class="section-label">VA WORK STATUS</span><h3>${active?"Working now":"Signed out / Not working"}</h3><div class="timer-big" id="employerTimer">00:00:00</div><p class="muted">${active?`Current task: ${esc(active.task||"General work")} · started ${fmtTime(active.clock_in)}`:"No active session."}</p></article><div class="grid3" style="margin-top:13px"><div class="stat glass"><span>Today</span><strong>${dur(sumHours(list,todayStart()))}</strong></div><div class="stat glass"><span>This week</span><strong>${dur(sumHours(list,weekStart()))}</strong></div><div class="stat glass"><span>This month</span><strong>${dur(sumHours(list,monthStart()))}</strong></div></div><article class="card glass" style="margin-top:13px"><span class="section-label">WORK HISTORY</span><h3>Recent sessions</h3><div class="table-list">${list.slice(0,30).map(e=>`<div class="row-card"><div><strong>${esc(e.task||"General work")}</strong><small>${fmtDate(e.clock_in)}</small></div><div><strong>${fmtTime(e.clock_in)}${e.clock_out?" → "+fmtTime(e.clock_out):" → now"}</strong></div><div><strong>${dur(hoursOf(e))}</strong></div><div>${e.clock_out?'<span class="status complete">Completed</span>':'<span class="status">Working now</span>'}</div></div>`).join("")}</div></article>`;startTicker()
}
function renderEmployerInvoices(){setPageTitle("Invoices");const c=currentClient(),list=state.invoices.filter(i=>i.client_id===c?.id);$("view").innerHTML=`<div class="stats"><div class="stat glass"><span>Incoming</span><strong>${list.filter(i=>i.status==="pending").length}</strong></div><div class="stat glass"><span>Paid</span><strong>${list.filter(i=>i.status==="paid").length}</strong></div><div class="stat glass"><span>Amount due</span><strong>${money(list.filter(i=>i.status==="pending").reduce((s,i)=>s+Number(i.total||0),0))}</strong></div><div class="stat glass"><span>Total paid</span><strong>${money(list.filter(i=>i.status==="paid").reduce((s,i)=>s+Number(i.total||0),0))}</strong></div></div><article class="card glass" style="margin-top:13px"><span class="section-label">BILLING HISTORY</span><h3>Invoices</h3>${invoiceRows(list,false)}</article>`}
function renderEmployerAccount(){setPageTitle("Account");const c=currentClient();$("view").innerHTML=`<article class="card glass" style="max-width:720px;margin:auto"><span class="section-label">ACCOUNT</span><h3>Employer Login</h3><div class="info-grid"><div class="info"><span>Username</span><strong>${esc(c?.client_username||"—")}</strong></div><div class="info"><span>Access</span><strong>${c?.portal_permission==="view"?"View Only":"Can Edit"}</strong></div></div><div class="field"><span>New password</span><input id="newEmployerPassword" type="password" minlength="8"></div><button class="btn primary" data-action="change-password" style="margin-top:12px">Change Password</button></article>`}

function taskComposerHtml(prefix){return`<div class="field"><span>Task title</span><input id="${prefix}TaskTitle"></div><div class="field"><span>Instructions</span><div class="rich-wrap"><div class="rich-tools">${[["bold","B"],["italic","I"],["underline","U"],["backColor","HL"],["insertUnorderedList","• List"],["insertOrderedList","1."],["createLink","Link"],["removeFormat","Tx"]].map(([c,l])=>`<button type="button" class="mini-btn" data-rich-cmd="${c}" data-editor="${prefix}TaskDetails">${l}</button>`).join("")}</div><div id="${prefix}TaskDetails" class="rich-editor" contenteditable="true" data-placeholder="Detailed instructions, checklist, links, copy, design requirements..."></div></div></div><div class="form-grid"><div class="field"><span>Priority</span><select id="${prefix}TaskPriority"><option>Normal</option><option>High</option><option>Urgent</option><option>Low</option></select></div><div class="field"><span>Due date</span><input id="${prefix}TaskDue" type="date"></div></div><button class="btn primary full" data-action="send-task" data-prefix="${prefix}" style="margin-top:11px">+ Send Request</button>`}
function taskListHtml(list,admin=false,editable=false){return list.length?list.map(t=>`<div class="task-card"><div class="task-top"><div style="min-width:0"><h4 class="task-title">${esc(t.task)}</h4><div id="preview-${t.id}" class="task-preview">${sanitizeRich(t.details||"No additional details.")}</div><button class="mini-btn" data-action="toggle-preview" data-id="${t.id}" style="margin-top:7px">See more</button></div>${t.done?'<span class="status complete">Completed</span>':'<span class="status">Open</span>'}</div><div class="meta"><b>${esc(t.priority||"Normal")}</b>${t.due_date?`<b>Due ${fmtDate(t.due_date)}</b>`:""}</div><div class="row-actions" style="margin-top:9px">${admin?`<button class="mini-btn" data-action="view-task" data-id="${t.id}">Open</button><button class="mini-btn" data-action="toggle-task" data-id="${t.id}">${t.done?"Reopen":"Mark Done"}</button>`:editable?`<button class="mini-btn" data-action="edit-employer-task" data-id="${t.id}">Edit</button>`:""}</div></div>`).join(""):'<div class="empty"><strong>No tasks yet</strong></div>'}

function setupRichEditors(){
  $$("[data-rich-cmd]").forEach(b=>b.onclick=()=>{
    const ed=$(b.dataset.editor);if(!ed)return;ed.focus();
    if(b.dataset.richCmd==="createLink"){const url=prompt("Enter https:// link");if(url&&/^https?:\/\//i.test(url))document.execCommand("createLink",false,url)}
    else if(b.dataset.richCmd==="backColor")document.execCommand("backColor",false,"#baff3a");
    else document.execCommand(b.dataset.richCmd,false,null);
  })
}
function stripHtml(h){const d=document.createElement("div");d.innerHTML=h;return d.textContent||""}
function nl2br(s){return esc(s).replace(/\n/g,"<br>")}
function sanitizeRich(html){
  const doc=new DOMParser().parseFromString(`<div>${html}</div>`,"text/html"),root=doc.body.firstElementChild;
  const allowed=new Set(["DIV","P","BR","B","STRONG","I","EM","U","UL","OL","LI","A","SPAN"]);
  [...root.querySelectorAll("*")].forEach(el=>{
    if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);return}
    const href=el.tagName==="A"?(el.getAttribute("href")||""):"";
    [...el.attributes].forEach(a=>el.removeAttribute(a.name));
    if(el.tagName==="A"&&/^https?:\/\//i.test(href)){
      el.setAttribute("href",href);
      el.setAttribute("target","_blank");
      el.setAttribute("rel","noopener");
    }
  });
  return root.innerHTML;
}

async function sendTask(prefix){
  const c=currentClient(),title=$(`${prefix}TaskTitle`)?.value.trim(),details=sanitizeRich($(`${prefix}TaskDetails`)?.innerHTML||"");
  if(!c||!title)return toast("Add a task title");
  const {error}=await state.sb.from("client_tasks").insert({client_id:c.id,user_id:state.session.user.id,task:title,details,priority:$(`${prefix}TaskPriority`).value,due_date:$(`${prefix}TaskDue`).value||null});
  if(error)return toast(error.message);await loadTasks();toast("Task sent");renderEmployer(state.employerView)
}

async function viewTask(id){
  const t=state.tasks.find(x=>x.id===id);if(!t)return;
  if(roleIsAdmin()&&!t.admin_seen_at){await state.sb.from("client_tasks").update({admin_seen_at:new Date().toISOString()}).eq("id",id);t.admin_seen_at=new Date().toISOString()}
  $("taskModalTitle").textContent=t.task;
  $("taskModalBody").innerHTML=`<div class="info-grid"><div class="info"><span>Employer</span><strong>${esc(clientName(t.client_id))}</strong></div><div class="info"><span>Priority</span><strong>${esc(t.priority||"Normal")}</strong></div><div class="info"><span>Due</span><strong>${fmtDate(t.due_date)}</strong></div><div class="info"><span>Status</span><strong>${t.done?"Completed":"Open"}</strong></div></div><div class="card" style="margin-top:12px"><h3>Instructions</h3>${sanitizeRich(t.details||"No instructions.")}</div>${roleIsAdmin()?`<div class="modal-actions"><button class="btn primary" data-action="toggle-task" data-id="${t.id}">${t.done?"Reopen Task":"Mark Completed"}</button></div>`:""}`;
  openModal("taskModal")
}

async function toggleTask(id){const t=state.tasks.find(x=>x.id===id);if(!t)return;const {error}=await state.sb.from("client_tasks").update({done:!t.done,updated_at:new Date().toISOString()}).eq("id",id);if(error)return toast(error.message);await loadTasks();closeModal("taskModal");roleIsAdmin()?renderAdmin(state.adminView):renderEmployer(state.employerView)}
async function editEmployerTask(id){
  const t=state.tasks.find(x=>x.id===id);if(!t)return;
  $("taskModalTitle").textContent="Edit Task";
  $("taskModalBody").innerHTML=`<div class="field"><span>Title</span><input id="editTaskTitle" value="${esc(t.task)}"></div><div class="field"><span>Instructions</span><textarea id="editTaskDetails" rows="8">${esc(stripHtml(t.details||""))}</textarea></div><div class="form-grid"><div class="field"><span>Priority</span><select id="editTaskPriority">${["Normal","High","Urgent","Low"].map(p=>`<option ${p===(t.priority||"Normal")?"selected":""}>${p}</option>`).join("")}</select></div><div class="field"><span>Due</span><input id="editTaskDue" type="date" value="${esc(t.due_date||"")}"></div></div><div class="modal-actions"><button class="btn primary" data-action="save-employer-task" data-id="${t.id}">Save Changes</button></div>`;openModal("taskModal")
}
async function saveEmployerTask(id){const {error}=await state.sb.from("client_tasks").update({task:$("editTaskTitle").value.trim(),details:nl2br($("editTaskDetails").value),priority:$("editTaskPriority").value,due_date:$("editTaskDue").value||null,updated_at:new Date().toISOString()}).eq("id",id);if(error)return toast(error.message);await loadTasks();closeModal("taskModal");renderEmployer("tasks")}

async function getSubmission(clientId){const {data,error}=await state.sb.from("client_submissions").select("*").eq("client_id",clientId).maybeSingle();if(error)throw error;return data}
async function saveSubmission(field,value){const c=currentClient(),old=await getSubmission(c.id);const payload={client_id:c.id,user_id:state.session.user.id,info:old?.info||"",info_html:old?.info_html||"",project_information:old?.project_information||"",shared_notes:old?.shared_notes||""};payload[field]=value;const {error}=await state.sb.from("client_submissions").upsert(payload,{onConflict:"client_id"});if(error)return toast(error.message);toast("Saved")}

async function listFiles(clientId){if(!clientId)return[];const {data,error}=await state.sb.storage.from("client-files").list(clientId,{limit:100,sortBy:{column:"created_at",order:"desc"}});if(error){console.warn(error);return[]}return data||[]}
function fileListHtml(files,c,editable){return`<div class="file-grid">${files.length?files.map(f=>`<div class="file-card"><div><strong>${esc(f.name.replace(/^\d+-[a-z0-9]+-/,""))}</strong><small class="muted">${humanSize(f.metadata?.size)}</small></div><div class="row-actions"><button class="mini-btn" data-action="open-file" data-path="${c.id}/${esc(f.name)}">Open</button>${editable?`<button class="mini-btn" data-action="delete-file" data-path="${c.id}/${esc(f.name)}">Delete</button>`:""}</div></div>`).join(""):'<div class="empty"><strong>No files yet</strong></div>'}</div>`}
async function uploadFiles(files){const c=currentClient();for(const f of files){const name=`${Date.now()}-${crypto.randomUUID().slice(0,8)}-${f.name.replace(/[^\w.\- ]+/g,"_")}`;const {error}=await state.sb.storage.from("client-files").upload(`${c.id}/${name}`,f,{upsert:false});if(error)return toast(error.message)}toast("Files uploaded");renderEmployer(state.employerView)}
async function openFile(path){const {data,error}=await state.sb.storage.from("client-files").createSignedUrl(path,120);if(error)return toast(error.message);window.open(data.signedUrl,"_blank","noopener")}
async function deleteFile(path){if(!confirm("Delete this file?"))return;const {error}=await state.sb.storage.from("client-files").remove([path]);if(error)return toast(error.message);renderEmployer(state.employerView)}

async function clockIn(){const clientId=$("timerClient")?.value,task=$("timerTask")?.value.trim();if(!clientId)return toast("Select an employer");if(state.time.some(e=>e.client_id===clientId&&!e.clock_out))return toast("That employer already has an active session");const {error}=await state.sb.from("time_entries").insert({user_id:state.session.user.id,client_id:clientId,task,clock_in:new Date().toISOString(),hourly_rate:Number(state.billing?.hourly_rate||3)});if(error)return toast(error.message);await loadTime();renderTimePage();updateStatusDock()}
async function stopSession(id){const e=state.time.find(x=>x.id===id);if(!e)return;const out=new Date().toISOString(),h=(new Date(out)-new Date(e.clock_in))/36e5;const {error}=await state.sb.from("time_entries").update({clock_out:out,hours:h}).eq("id",id);if(error)return toast(error.message);await loadTime();renderTimePage();updateStatusDock()}
async function addManualHours(){const client_id=$("manualClient").value,date=$("manualDate").value,h=Number($("manualHours").value),rate=Number($("manualRate").value),task=$("manualTask").value.trim()||"Manual work";if(!client_id||!date||!h)return toast("Complete employer, date and hours");const start=new Date(`${date}T09:00:00`),end=new Date(start.getTime()+h*36e5);const {error}=await state.sb.from("time_entries").insert({user_id:state.session.user.id,client_id,task,clock_in:start.toISOString(),clock_out:end.toISOString(),hours:h,hourly_rate:rate});if(error)return toast(error.message);await loadTime();renderTimePage()}

function nextInvoiceNumber(){const n=Math.max(1000,...state.invoices.map(i=>Number(String(i.invoice_number||"").match(/\d+/)?.[0]||0)))+1;return"INV-"+String(n).padStart(4,"0")}
function invoiceEntries(){const c=$("invoiceClient")?.value,s=$("invoiceStart")?.value,e=$("invoiceEnd")?.value;return state.time.filter(x=>x.client_id===c&&x.clock_out&&!x.invoice_id&&(!s||String(x.clock_in).slice(0,10)>=s)&&(!e||String(x.clock_in).slice(0,10)<=e))}
function invoiceHours(){return $("invoiceMode")?.value==="manual"?Number($("invoiceManualHours")?.value||0):invoiceEntries().reduce((s,e)=>s+hoursOf(e),0)}
function updateInvoicePreview(){if(!$("invoiceHoursPreview"))return;$("invoiceManualHours").disabled=$("invoiceMode").value!=="manual";const h=invoiceHours(),r=Number($("invoiceRate").value||0);$("invoiceHoursPreview").textContent=h.toFixed(2)+" hrs";$("invoiceTotalPreview").textContent=money(h*r)}
function draftInvoice(){const h=invoiceHours(),r=Number($("invoiceRate").value),client_id=$("invoiceClient").value;if(!client_id||!h)throw new Error("Select employer and billable hours");return{id:"draft",client_id,invoice_number:$("invoiceNumber").value,invoice_date:$("invoiceDate").value,period_start:$("invoiceStart").value||null,period_end:$("invoiceEnd").value||null,hours:h,hourly_rate:r,total:h*r,description:$("invoiceDescription").value.trim()||"Online Work",notes:$("invoiceNotes").value.trim(),status:"pending"}}
async function createInvoice(){let inv;try{inv=draftInvoice()}catch(e){return toast(e.message)}const entries=$("invoiceMode").value==="time"?invoiceEntries():[];delete inv.id;inv.user_id=state.session.user.id;const {data,error}=await state.sb.from("invoices").insert(inv).select().single();if(error)return toast(error.message);if(entries.length)await state.sb.from("time_entries").update({invoice_id:data.id}).in("id",entries.map(x=>x.id));await Promise.all([loadInvoices(),loadTime()]);toast("Invoice created");renderAdminInvoices()}
async function markPaid(id){const {error}=await state.sb.from("invoices").update({status:"paid",paid_at:new Date().toISOString()}).eq("id",id);if(error)return toast(error.message);await loadInvoices();renderAdminInvoices()}
async function viewInvoice(id){let i=state.invoices.find(x=>x.id===id);if(!i){const {data,error}=await state.sb.from("invoices").select("*").eq("id",id).single();if(error)return toast(error.message);i=data}await loadBilling();const c=state.clients.find(x=>x.id===i.client_id);$("invoiceModalBody").innerHTML=invoiceHtml(i,c);openModal("invoiceModal")}
function invoiceHtml(i,c){const b=state.billing||{};return`<div class="invoice-paper"><div class="invoice-head"><div class="invoice-brand"><h2>${esc(b.business_name||"Jeffdesign101 / Webdev VA")}</h2><p><b>${esc(b.full_name||"")}</b></p><p>${esc(b.address||"")}</p><p>${esc(b.phone||"")}</p><p>${esc(b.email||"")}</p></div><div><h1>INVOICE</h1><div class="invoice-meta"><p>Invoice # <b>${esc(i.invoice_number)}</b></p><p>Invoice date <b>${fmtDate(i.invoice_date)}</b></p><p>Work period <b>${i.period_start?fmtDate(i.period_start)+" — "+fmtDate(i.period_end):"—"}</b></p><p>Status <b>${esc(String(i.status).toUpperCase())}</b></p></div></div></div><div class="bill-to"><b>Bill To</b><div>${esc(c?.name||"Employer")}</div><div>${esc(c?.company||"")}</div>${c?.email?`<div>${esc(c.email)}</div>`:""}</div><table class="invoice-table"><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead><tbody><tr><td>${esc(i.description||"Online Work")}</td><td>${Number(i.hours||0).toFixed(2)}</td><td>hrs</td><td>${money(i.hourly_rate)}</td><td>${money(i.total)}</td></tr></tbody></table><div class="invoice-total"><span>TOTAL</span><strong>${money(i.total)}</strong></div><div class="invoice-notes"><b>PAYMENT / NOTES</b><br><br>${esc(i.notes||b.payment_instructions||"Thank you for your business.")}</div></div>`}

async function saveBilling(){const payload={user_id:state.session.user.id,hourly_rate:Number($("billRate").value||3),business_name:$("billBusiness").value.trim(),full_name:$("billName").value.trim(),email:$("billEmail").value.trim(),phone:$("billPhone").value.trim(),address:$("billAddress").value.trim(),payment_instructions:$("billPayment").value.trim(),updated_at:new Date().toISOString()};const {error}=await state.sb.from("billing_settings").upsert(payload,{onConflict:"user_id"});if(error)return toast(error.message);state.billing=payload;toast("Billing settings saved")}

function openClientModal(id=null){const c=id?state.clients.find(x=>x.id===id):null;$("clientModalTitle").textContent=c?"Edit Employer":"Add Employer";$("clientId").value=c?.id||"";$("clientName").value=c?.name||"";$("clientCompany").value=c?.company||"";$("clientEmail").value=c?.email||"";$("clientPhone").value=c?.phone||"";$("clientWebsite").value=c?.website||"";$("clientProjectType").value=c?.project_type||"";$("clientStatus").value=c?.status||"ongoing";$("clientPriority").value=c?.priority||"Normal";$("clientStartDate").value=c?.start_date||"";$("clientDeadline").value=c?.deadline||"";$("clientPermission").value=c?.portal_permission||"edit";$("clientOverview").value=c?.overview||"";$("clientUsername").value=c?.client_username||"";$("clientTempPassword").value="";$("credentialStatus").textContent="";openModal("clientModal")}
async function saveClient(){const payload={name:$("clientName").value.trim(),company:$("clientCompany").value.trim()||null,email:$("clientEmail").value.trim()||null,phone:$("clientPhone").value.trim()||null,website:$("clientWebsite").value.trim()||null,project_type:$("clientProjectType").value.trim()||null,status:$("clientStatus").value,priority:$("clientPriority").value,start_date:$("clientStartDate").value||null,deadline:$("clientDeadline").value||null,portal_permission:$("clientPermission").value,overview:$("clientOverview").value.trim()||null,updated_at:new Date().toISOString()};if(!payload.name)throw new Error("Employer name is required");const id=$("clientId").value;let res=id?await state.sb.from("clients").update(payload).eq("id",id).select().single():await state.sb.from("clients").insert(payload).select().single();if(res.error)throw res.error;await reloadClients();$("clientId").value=res.data.id;return res.data}
async function createEmployerLogin(){const status=$("credentialStatus"),user=$("clientUsername").value.trim(),pass=$("clientTempPassword").value;try{status.textContent="Saving employer…";const c=await saveClient();if(!user||pass.length<8)throw new Error("Username and password of at least 8 characters are required");status.textContent="Creating login…";const {data}=await state.sb.auth.getSession();const r=await fetch(`${cfg.supabaseUrl}/functions/v1/admin-create-client-user`,{method:"POST",headers:{"content-type":"application/json","apikey":cfg.supabasePublishableKey,"authorization":`Bearer ${data.session.access_token}`},body:JSON.stringify({clientId:c.id,username:user,password:pass})});const body=await r.json().catch(()=>({}));if(!r.ok)throw new Error(body.error||`Edge Function ${r.status}`);status.textContent=`Login ready: ${body.username||user}`;$("clientTempPassword").value="";await reloadClients()}catch(e){status.textContent=e.message}}
async function reloadClients(){const {data,error}=await state.sb.from("clients").select("*").order("updated_at",{ascending:false});if(error)throw error;state.clients=(data||[]).filter(c=>!c.deleted_at)}
async function trashClient(id){if(!confirm("Move employer to Trash?"))return;const {error}=await state.sb.from("clients").update({deleted_at:new Date().toISOString()}).eq("id",id);if(error)return toast(error.message);await reloadClients();renderClients()}
async function restoreClient(id){const {error}=await state.sb.from("clients").update({deleted_at:null}).eq("id",id);if(error)return toast(error.message);await reloadClients();renderTrash()}

async function employerStatus(status){const c=currentClient();const {error}=await state.sb.from("clients").update({status}).eq("id",c.id);if(error)return toast(error.message);c.status=status;renderEmployerOverview()}
async function changePassword(){const p=$("newEmployerPassword").value;if(p.length<8)return toast("Use at least 8 characters");const {error}=await state.sb.auth.updateUser({password:p});if(error)return toast(error.message);toast("Password changed")}

function openModal(id){$(id).classList.remove("hidden")}
function closeModal(id){$(id).classList.add("hidden")}
function startTicker(){
  clearInterval(state.timer);
  state.timer=setInterval(()=>{
    $$("[data-session-clock]").forEach(el=>{const e=state.time.find(x=>x.id===el.dataset.sessionClock);if(e)el.textContent=clockString(new Date()-new Date(e.clock_in))});
    const c=currentClient(),a=state.time.find(e=>e.client_id===c?.id&&!e.clock_out),em=$("employerTimer");if(em)em.textContent=a?clockString(new Date()-new Date(a.clock_in)):"00:00:00";
    updateStatusDock();
  },1000);updateStatusDock()
}
function clockString(ms){let s=Math.max(0,Math.floor(ms/1000));return`${String(Math.floor(s/3600)).padStart(2,"0")}:${String(Math.floor(s%3600/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`}
function updateStatusDock(){
  if(roleIsAdmin()||!state.session){$("statusDock").classList.add("hidden");$("restoreStatusBtn").classList.add("hidden");return}
  const hidden=sessionStorage.getItem("hideVaStatus")==="1",c=currentClient(),a=state.time.find(e=>e.client_id===c?.id&&!e.clock_out);
  $("statusDock").classList.toggle("hidden",hidden);$("restoreStatusBtn").classList.toggle("hidden",!hidden);
  $("statusDot").classList.toggle("on",!!a);$("statusLabel").textContent=a?"VA Working":"VA Offline";$("statusFullLabel").textContent=a?"VA Working Now":"VA Offline";
  $("statusMiniTime").textContent=a?clockString(new Date()-new Date(a.clock_in)).slice(0,5):"—";$("statusFullTime").textContent=a?`${clockString(new Date()-new Date(a.clock_in))} · ${a.task||"General work"}`:"Not currently clocked in";
}

document.addEventListener("click",async e=>{
  const a=e.target.closest("[data-action]"),av=e.target.closest("[data-admin-view]"),ev=e.target.closest("[data-employer-view]"),close=e.target.closest("[data-close]");
  if(close)return closeModal(close.dataset.close);
  if(av&&roleIsAdmin())return renderAdmin(av.dataset.adminView);
  if(ev&&!roleIsAdmin())return renderEmployer(ev.dataset.employerView);
  if(!a)return;
  const id=a.dataset.id,act=a.dataset.action;
  try{
    if(act==="new-client")openClientModal();
    else if(act==="edit-client")openClientModal(id);
    else if(act==="client-detail")await renderClientDetail(id);
    else if(act==="trash-client")await trashClient(id);
    else if(act==="restore-client")await restoreClient(id);
    else if(act==="view-task")await viewTask(id);
    else if(act==="toggle-task")await toggleTask(id);
    else if(act==="toggle-preview"){const p=$(`preview-${id}`),ex=p.classList.toggle("expanded");a.textContent=ex?"See less":"See more"}
    else if(act==="edit-employer-task")await editEmployerTask(id);
    else if(act==="save-employer-task")await saveEmployerTask(id);
    else if(act==="send-task")await sendTask(a.dataset.prefix);
    else if(act==="save-project-info")await saveSubmission("project_information",$("projectInfo").value);
    else if(act==="save-shared-notes")await saveSubmission("shared_notes",$("sharedNotes").value);
    else if(act==="employer-status")await employerStatus(a.dataset.status);
    else if(act==="open-file")await openFile(a.dataset.path);
    else if(act==="delete-file")await deleteFile(a.dataset.path);
    else if(act==="clock-in")await clockIn();
    else if(act==="clock-out-selected"){const cid=$("timerClient").value,active=state.time.find(x=>x.client_id===cid&&!x.clock_out);if(!active)return toast("Select an employer with an active session");await stopSession(active.id)}
    else if(act==="stop-session")await stopSession(id);
    else if(act==="manual-hours")await addManualHours();
    else if(act==="preview-invoice"){try{const d=draftInvoice();$("invoiceModalBody").innerHTML=invoiceHtml(d,state.clients.find(c=>c.id===d.client_id));openModal("invoiceModal")}catch(x){toast(x.message)}}
    else if(act==="create-invoice")await createInvoice();
    else if(act==="view-invoice")await viewInvoice(id);
    else if(act==="mark-paid")await markPaid(id);
    else if(act==="save-billing")await saveBilling();
    else if(act==="change-password")await changePassword();
  }catch(err){console.error(err);toast(err.message||"Something went wrong")}
});

document.addEventListener("input",e=>{if(e.target.id==="clientSearch")renderClientRows();if(["invoiceClient","invoiceMode","invoiceStart","invoiceEnd","invoiceManualHours","invoiceRate"].includes(e.target.id))updateInvoicePreview()});
document.addEventListener("change",e=>{if(e.target.id==="clientSort")renderClientRows();if(e.target.id==="taskFilter")renderTaskInboxRows();if(["invoiceClient","invoiceMode","invoiceStart","invoiceEnd","invoiceManualHours","invoiceRate"].includes(e.target.id))updateInvoicePreview();if(e.target.matches("#overviewFiles,#filesPageInput")&&e.target.files?.length)uploadFiles([...e.target.files])});

$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();const btn=$("loginSubmit");btn.disabled=true;$("loginError").textContent="Signing in…";
  try{const sb=initSupabase(),identifier=$("loginIdentifier").value.trim();let email=identifier;if(!identifier.includes("@")){const {data,error}=await sb.rpc("resolve_login_email",{login_name:identifier});if(error)throw error;if(!data)throw new Error("Username not found");email=data}const {data,error}=await sb.auth.signInWithPassword({email,password:$("loginPassword").value});if(error)throw error;state.session=data.session;$("loginError").textContent="";await loadWorkspace()}catch(x){$("loginError").textContent=x.message}finally{btn.disabled=false}
});
$("toggleLoginPassword").onclick=()=>{const i=$("loginPassword");i.type=i.type==="password"?"text":"password";$("toggleLoginPassword").textContent=i.type==="password"?"Show":"Hide"};
$("toggleTempPassword").onclick=()=>{const i=$("clientTempPassword");i.type=i.type==="password"?"text":"password";$("toggleTempPassword").textContent=i.type==="password"?"Show":"Hide"};
$("signOutBtn").onclick=()=>state.sb.auth.signOut();
$("clientForm").addEventListener("submit",async e=>{e.preventDefault();try{await saveClient();closeModal("clientModal");renderClients();toast("Employer saved")}catch(x){toast(x.message)}});
$("createLoginBtn").onclick=createEmployerLogin;
$("statusPill").onclick=e=>{e.stopPropagation();$("statusPopover").classList.toggle("hidden")};
$("hideStatusBtn").onclick=e=>{e.stopPropagation();sessionStorage.setItem("hideVaStatus","1");updateStatusDock()};
$("restoreStatusBtn").onclick=()=>{sessionStorage.removeItem("hideVaStatus");updateStatusDock()};
$("openWorkMonitorBtn").onclick=()=>{renderEmployer("work");$("statusPopover").classList.add("hidden")};
document.addEventListener("click",e=>{if(!$("statusDock").contains(e.target))$("statusPopover").classList.add("hidden")});
$$(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)m.classList.add("hidden")}));

console.info("Jeffdesign101",BUILD);
init();