const BUILD="v2.22.3-save-reload-stability";
const cfg=window.LIME_CRM_CONFIG||{};
const $=id=>document.getElementById(id);
const $$=q=>[...document.querySelectorAll(q)];
const esc=(v="")=>String(v).replace(/[&<>"']/g,s=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[s]));
const money=n=>"$"+Number(n||0).toFixed(2);
const fmtDate=v=>{if(!v)return"—";const d=new Date(String(v).length===10?v+"T00:00:00":v);return isNaN(d)?"—":d.toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})};
const fmtTime=v=>v?new Date(v).toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"}):"—";
const toLocalDateTimeInput=v=>{if(!v)return"";const d=new Date(v);if(isNaN(d))return"";const p=n=>String(n).padStart(2,"0");return`${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`};
const humanSize=n=>{let x=Number(n||0),u=["B","KB","MB","GB"],i=0;while(x>=1024&&i<3){x/=1024;i++}return`${i&&x<10?x.toFixed(1):Math.round(x)} ${u[i]}`};
const websiteHref=v=>{const raw=String(v||"").trim();if(!raw)return"#";const candidate=/^https?:\/\//i.test(raw)?raw:`https://${raw}`;try{const u=new URL(candidate);return ["http:","https:"].includes(u.protocol)?u.href:"#"}catch{return"#"}};



const ASSET_CATEGORIES=[
  {id:"brand",label:"Logo & Brand"},
  {id:"photos",label:"Photos"},
  {id:"content",label:"Content & Copy"},
  {id:"documents",label:"Documents"},
  {id:"references",label:"References"},
  {id:"other",label:"Other"}
];
function assetCategoryLabel(id){return ASSET_CATEGORIES.find(x=>x.id===id)?.label||"Other"}
function assetCategoryOptions(selected="other"){return ASSET_CATEGORIES.map(x=>`<option value="${x.id}" ${x.id===selected?"selected":""}>${x.label}</option>`).join("")}
function safeFileName(name="upload"){return String(name||"upload").replace(/[^\w.\- ]+/g,"_")}

const WEBSITE_INTAKE_SECTIONS=[
  {id:"business_basics",title:"1. Business Basics",help:"Core business/contact details visitors need to find and understand you.",items:["Business name","Short description of what you do","Business address, if applicable","Service areas, if applicable","Phone number","Email address","Business hours","Social media links","Google Business / Google Maps link, if available"]},
  {id:"website_goal",title:"2. Main Goal of the Website",help:"What is the main action you want visitors to take?",items:["Book an appointment","Call","Request a quote","Send a message","Visit your location","Buy a product","Schedule a consultation"]},
  {id:"services_products",title:"3. Services or Products",help:"List your main services/products. For each, include whatever you already have.",items:["Name","Short description","Price","Duration","Important details","Menu, price list, brochure, booking page, or service-list link if available"]},
  {id:"about_business",title:"4. About Your Business",help:"Rough notes are completely fine.",items:["Your story","What makes your business different","What you want customers to know about you","Why customers choose you"]},
  {id:"photos_branding",title:"5. Photos & Branding",help:"Upload the actual files in the Website Assets section below and add any instructions here.",items:["Logo","Brand colors","Business photos","Product or service photos","Location photos","Team or owner photos","Videos","Photos you do not want us to use"]},
  {id:"website_style",title:"6. Website Style",help:"Send 2–3 websites you like. They do not need to be from your industry.",items:["Website links","Colors","Layout","Clean design","Luxury feel","Modern style","Photography","Animations","Overall mood","Anything you definitely do not want"]},
  {id:"reviews",title:"7. Reviews & Testimonials",help:"These help us understand what your customers value most.",items:["Google Reviews link","Testimonials","Review screenshots","Yelp or Facebook review links, if relevant"]},
  {id:"booking_contact",title:"8. Booking & Contact",help:"How should customers contact or book with you?",items:["Booking link","Phone number","WhatsApp number, if used","Email","Contact form preferences","Online booking platform link"]},
  {id:"faqs_policies",title:"9. FAQs & Policies",help:"If you do not have these yet, just say so.",items:["Questions customers ask most often","Cancellation policy","Rescheduling policy","Deposit policy","Refund policy","Travel policy","Any other important policies"]},
  {id:"service_area",title:"10. Service Areas / Location",help:"Tell us where you work or how customers visit you.",items:["Cities or areas you serve","Travel radius","Travel fees","Areas you do not serve","Full address","Parking details","Entry instructions, if needed"]},
  {id:"competitors",title:"11. Competitors",help:"Send 2–3 competitors or similar businesses.",items:["Competitor links/names","What you like about them","What you dislike","How you want your business to feel different"]},
  {id:"future_plans",title:"12. Future Plans",help:"This helps us build the website so it can grow with your business.",items:["Online shop","Products","Gift cards","Memberships","Packages","New services","Blog","Courses","Additional locations","Client portal","Anything else you may add later"]}
];
function intakeValue(obj,id){const v=obj&&typeof obj==="object"?obj[id]:"";return typeof v==="string"?v:""}
function autoGrow(el){if(!el||el.tagName!=="TEXTAREA")return;el.style.height="auto";el.style.height=Math.min(Math.max(el.scrollHeight,120),520)+"px"}
function setupAutoGrow(scope=document){scope.querySelectorAll?.("textarea.auto-grow").forEach(el=>{autoGrow(el);el.addEventListener("input",()=>autoGrow(el))})}
async function copyText(text,label="Copied to clipboard"){
  try{if(navigator.clipboard&&window.isSecureContext)await navigator.clipboard.writeText(text);else throw new Error("fallback");toast(label);return true}catch{}
  const ta=document.createElement("textarea");ta.value=text;ta.setAttribute("readonly","");ta.style.cssText="position:fixed;left:-9999px;top:0;opacity:0";document.body.appendChild(ta);ta.select();ta.setSelectionRange(0,ta.value.length);let ok=false;try{ok=document.execCommand("copy")}catch{}ta.remove();toast(ok?label:"Copy failed — select and copy manually");return ok
}
function websiteIntakeText(c,project,assets=[]){
  const intake=project?.website_intake&&typeof project.website_intake==="object"?project.website_intake:{};
  const out=["# Website Client Intake","",`Website Name: ${project?.website_name||c?.company||c?.name||"Not provided"}`,`Employer: ${c?.name||"Not provided"}`,`Project Status: ${websiteProjectStatusLabel(project?.status)}`,""];
  for(const section of WEBSITE_INTAKE_SECTIONS){out.push(`## ${section.title.replace(/^\d+\.\s*/,"")}`,intakeValue(intake,section.id)||"Not provided","")}
  out.push("## Additional Notes",project?.website_notes||"Not provided","");
  out.push("## Website Assets / Files",assets.length?assets.map(x=>`- [${assetCategoryLabel(x.category)}] ${x.file_name||x.name||"File"}`).join("\n"):"No website assets uploaded yet.","");
  return out.join("\n");
}
function websiteProjectStatusLabel(status){return({draft:"Drafting",in_progress:"In Progress",ready:"Ready to Build",complete:"Completed"})[status]||"Draft"}
function websiteProjectStatusPill(status){return `<span class="status ${status==="complete"?"complete":""}">${esc(websiteProjectStatusLabel(status))}</span>`}


const state={
  sb:null,session:null,profile:null,role:null,clients:[],tasks:[],time:[],invoices:[],billing:null,
  activeClient:null,activeWebsiteProject:null,activeWebsiteProjectMode:null,adminView:"dashboard",employerView:"overview",workspacePromise:null,timer:null,authSubscription:null,navSeq:0,routing:false
};

function hideBootSplash(){document.body.classList.remove("booting")}

function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove("show"),2200)}
function configured(){return !!cfg.supabaseUrl&&!!cfg.supabasePublishableKey&&!cfg.supabaseUrl.includes("YOUR_")}
function showLogin(msg=""){stopTicker();hideBootSplash();$("loginScreen").classList.remove("hidden");$("app").classList.add("hidden");$("loginError").textContent=msg;closeCommandPalette()}
function showApp(){hideBootSplash();$("loginScreen").classList.add("hidden");$("app").classList.remove("hidden")}
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

    const {data:authListener}=sb.auth.onAuthStateChange((event,session)=>{
      if(event==="SIGNED_OUT"){state.session=null;state.profile=null;state.role=null;state.clients=[];state.tasks=[];state.time=[];state.invoices=[];showLogin()}
      else if(session)state.session=session;
    });
    state.authSubscription=authListener?.subscription||null;
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
    configureRoleUI();
    if(!roleIsAdmin())state.activeClient=state.clients[0]?.id||null;
    showApp();
    await applyAppRoute({replaceInvalid:true});
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

const ADMIN_ROUTE_VIEWS=new Set(["dashboard","clients","websites","activity","prompts","tasks","time","invoices","billing","trash"]);
const EMPLOYER_ROUTE_TO_VIEW={overview:"overview",websites:"website",tasks:"tasks",files:"files",work:"work",invoices:"invoices",account:"account"};
const EMPLOYER_VIEW_TO_ROUTE={overview:"overview",website:"websites",tasks:"tasks",files:"files",work:"work",invoices:"invoices",account:"account"};
function routeSegments(){return String(location.hash||"").replace(/^#\/?/,"").split("/").filter(Boolean).map(x=>{try{return decodeURIComponent(x)}catch{return x}})}
function routeHash(parts){return "#/"+parts.map(x=>encodeURIComponent(String(x))).join("/")}
function setAppRoute(parts,{replace=false}={}){
  if(state.routing)return;
  const hash=routeHash(parts);if(location.hash===hash)return;
  history[replace?"replaceState":"pushState"]({jeffRoute:parts},"",hash);
}
function canonicalRoute(parts){const hash=routeHash(parts);if(location.hash!==hash)history.replaceState({jeffRoute:parts},"",hash)}
function adminRouteForView(view){return ["admin",ADMIN_ROUTE_VIEWS.has(view)?view:"dashboard"]}
function employerRouteForView(view){return ["employer",EMPLOYER_VIEW_TO_ROUTE[view]||"overview"]}
async function applyAppRoute({replaceInvalid=true}={}){
  if(!state.session||!state.role)return;
  const seg=routeSegments();state.routing=true;
  try{
    if(roleIsAdmin()){
      if(seg[0]!=="admin"){
        renderAdmin("dashboard");if(replaceInvalid)canonicalRoute(["admin","dashboard"]);return;
      }
      if(seg[1]==="clients"&&seg[2]){
        const client=state.clients.find(c=>c.id===seg[2]);if(client){state.activeClient=client.id;await renderClientDetail(client.id);return}
      }
      if(seg[1]==="websites"&&seg[2]&&seg[3]){
        const client=state.clients.find(c=>c.id===seg[2]);if(client){state.activeClient=client.id;await renderAdminWebsiteProject(client.id,seg[3]);return}
      }
      const view=ADMIN_ROUTE_VIEWS.has(seg[1])?seg[1]:"dashboard";renderAdmin(view);if(replaceInvalid&&seg[1]!==view)canonicalRoute(["admin",view]);return;
    }
    state.activeClient=state.clients[0]?.id||null;
    if(seg[0]!=="employer"){
      state.activeWebsiteProject=null;state.activeWebsiteProjectMode=null;renderEmployer("overview");if(replaceInvalid)canonicalRoute(["employer","overview"]);return;
    }
    if(seg[1]==="websites"&&seg[2]){
      state.activeWebsiteProject=seg[2];state.activeWebsiteProjectMode=seg[3]==="intake"?"intake":"viewer";renderEmployer("website");return;
    }
    const view=EMPLOYER_ROUTE_TO_VIEW[seg[1]]||"overview";
    if(view!=="website"){state.activeWebsiteProject=null;state.activeWebsiteProjectMode=null}
    renderEmployer(view);if(replaceInvalid&&!EMPLOYER_ROUTE_TO_VIEW[seg[1]])canonicalRoute(employerRouteForView(view));
  }catch(error){showPageError("Route",error)}finally{state.routing=false}
}
let routeApplyQueued=false;
function queueApplyAppRoute(){if(routeApplyQueued)return;routeApplyQueued=true;queueMicrotask(async()=>{routeApplyQueued=false;await applyAppRoute({replaceInvalid:true})})}
window.addEventListener("popstate",queueApplyAppRoute);
window.addEventListener("hashchange",queueApplyAppRoute);

function configureRoleUI(){
  $("roleBadge").textContent=roleIsAdmin()?"ADMIN":"EMPLOYER";
  $("workspaceLabel").textContent=roleIsAdmin()?"ADMIN WORKSPACE":"EMPLOYER PORTAL";
  $("adminSidebar").classList.toggle("hidden",!roleIsAdmin());
  $("employerTabs").classList.toggle("hidden",roleIsAdmin());
  document.body.classList.toggle("employer",!roleIsAdmin());
  document.documentElement.classList.toggle("employer-mode",!roleIsAdmin());
  closeMobileNav();
  updateStatusDock();
}

function setPageTitle(t){$("pageTitle").textContent=t}
function showPageError(name,error){console.error(`[${name}]`,error);const v=$("view");if(v)v.innerHTML=`<section class="page-shell"><article class="card glass page-error"><span class="section-label">PAGE ERROR</span><h2>${esc(name)} could not load</h2><p class="muted">${esc(error?.message||"Unexpected page error")}</p><button class="btn primary" data-action="home">Return Home</button></article></section>`;toast(`${name} could not load`)}
function runPage(name,fn){try{const result=fn();if(result&&typeof result.catch==="function")result.catch(error=>showPageError(name,error))}catch(error){showPageError(name,error)}}
function renderAdmin(view){
  state.navSeq++;state.adminView=view;
  setAppRoute(adminRouteForView(view));
  $$("[data-admin-view]").forEach(b=>b.classList.toggle("active",b.dataset.adminView===view));
  const map={dashboard:()=>renderDashboard(),clients:()=>renderClients(),websites:()=>renderAdminWebsiteProjects(),activity:()=>renderAdminProjectActivity(),prompts:()=>renderPromptLibrary(),tasks:()=>renderTaskInbox(),time:()=>renderTimePage(),invoices:()=>renderAdminInvoices(),billing:()=>renderBilling(),trash:()=>renderTrash()};
  closeMobileNav();runPage(`Admin ${view}`,map[view]||map.dashboard);
}
function renderEmployer(view){
  state.navSeq++;state.employerView=view;
  if(view==="website"&&state.activeWebsiteProject)setAppRoute(["employer","websites",state.activeWebsiteProject,state.activeWebsiteProjectMode==="intake"?"intake":"view"]);
  else setAppRoute(employerRouteForView(view));
  $$("[data-employer-view]").forEach(b=>b.classList.toggle("active",b.dataset.employerView===view));
  const map={overview:()=>renderEmployerOverview(),website:()=>renderEmployerWebsiteProject(),tasks:()=>renderEmployerTasks(),files:()=>renderEmployerFiles(),work:()=>renderEmployerWork(),invoices:()=>renderEmployerInvoices(),account:()=>renderEmployerAccount()};
  closeMobileNav();runPage(`Employer ${view}`,map[view]||map.overview);
}

function statusPill(s){const label={ongoing:"Active",paused:"Paused",complete:"Complete"}[s]||s;return`<span class="status ${esc(s)}">${esc(label)}</span>`}
function clientName(id){return state.clients.find(c=>c.id===id)?.name||"Employer"}
function hoursOf(e){return Number(e.hours??((new Date(e.clock_out||Date.now())-new Date(e.clock_in))/36e5))}
function todayStart(){const d=new Date();d.setHours(0,0,0,0);return d}
function weekStart(){const d=todayStart(),day=d.getDay()||7;d.setDate(d.getDate()-day+1);return d}
function monthStart(){const d=new Date();return new Date(d.getFullYear(),d.getMonth(),1)}
function sumHours(list,start=null){return list.filter(e=>!start||new Date(e.clock_in)>=start).reduce((s,e)=>s+hoursOf(e),0)}
function dur(h){const m=Math.round(h*60);return`${Math.floor(m/60)}h ${String(m%60).padStart(2,"0")}m`}

function clamp(n,min=0,max=100){return Math.max(min,Math.min(max,Number(n)||0))}
function pct(part,total){return total?Math.round((Number(part||0)/Number(total))*100):0}
function progressRing(value,label="Progress",sub=""){
  const v=clamp(value);
  return `<div class="progress-ring" style="--p:${v}" role="img" aria-label="${esc(label)} ${v}%"><div><strong>${v}%</strong><span>${esc(label)}</span>${sub?`<small>${esc(sub)}</small>`:""}</div></div>`;
}
function projectCompletion(project){
  const intake=project?.website_intake&&typeof project.website_intake==="object"?project.website_intake:{};
  const answered=WEBSITE_INTAKE_SECTIONS.filter(s=>String(intakeValue(intake,s.id)||"").trim()).length;
  const base=WEBSITE_INTAKE_SECTIONS.length?Math.round(answered/WEBSITE_INTAKE_SECTIONS.length*82):0;
  const notes=String(project?.website_notes||"").trim()?6:0;
  const statusBonus={draft:0,in_progress:5,ready:10,complete:12}[project?.status]||0;
  return clamp(base+notes+statusBonus);
}
function lastSevenDayHours(list){
  const out=[];for(let back=6;back>=0;back--){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-back);const next=new Date(d);next.setDate(next.getDate()+1);const hours=list.filter(e=>{const t=new Date(e.clock_in);return t>=d&&t<next}).reduce((s,e)=>s+hoursOf(e),0);out.push({label:d.toLocaleDateString(undefined,{weekday:"narrow"}),hours})}return out;
}
function miniBars(data){const max=Math.max(1,...data.map(x=>x.hours));return `<div class="mini-bars" aria-label="Work hours for the last seven days">${data.map(x=>`<div class="mini-bar-col"><span class="mini-bar-value">${x.hours?x.hours.toFixed(1):""}</span><i style="height:${Math.max(6,Math.round(x.hours/max*100))}%"></i><b>${esc(x.label)}</b></div>`).join("")}</div>`}
function metricVisual(icon,label,value,detail="",tone="lime"){return `<article class="visual-stat glass tone-${tone}"><div class="visual-stat-top"><span class="visual-icon">${icon}</span><span class="visual-pulse"></span></div><strong>${value}</strong><span>${esc(label)}</span>${detail?`<small>${esc(detail)}</small>`:""}</article>`}

function renderDashboard(){
  setPageTitle("Dashboard");
  const active=state.time.filter(e=>!e.clock_out),open=state.tasks.filter(t=>!t.done),pending=state.invoices.filter(i=>i.status==="pending"),done=state.tasks.filter(t=>t.done);
  const taskPercent=pct(done.length,state.tasks.length),outstanding=pending.reduce((s,i)=>s+Number(i.total||0),0),weekHours=sumHours(state.time,weekStart()),bars=lastSevenDayHours(state.time);
  $("taskBadge").textContent=state.tasks.filter(t=>!t.admin_seen_at).length;
  $("taskBadge").classList.toggle("hidden",!state.tasks.some(t=>!t.admin_seen_at));
  $("view").innerHTML=`<section class="page-shell visual-dashboard">
    <section class="agency-hero glass">
      <div class="agency-hero-copy"><span class="section-label">JEFFDESIGN101 CONTROL CENTER</span><h1>Build, track and deliver—<em>all in one view.</em></h1><p>Your live workspace for employer requests, website projects, hours and billing.</p><div class="agency-hero-actions"><button class="btn primary" data-action="new-client">+ Add Employer</button><button class="btn ghost" data-admin-view="time">Open Time Log</button></div></div>
      <div class="agency-orbit" aria-hidden="true"><span class="orbit-core">JD</span><i class="orbit orbit-a"></i><i class="orbit orbit-b"></i><b class="orbit-node node-a">⌁</b><b class="orbit-node node-b">◷</b><b class="orbit-node node-c">▤</b></div>
    </section>
    <div class="visual-stats-grid">
      ${metricVisual("◎","Employers",state.clients.length,state.clients.length?"Active workspace":"Ready for your first client","lime")}
      ${metricVisual("☷","Open Tasks",open.length,`${done.length} completed`,"blue")}
      ${metricVisual("◷","This Week",dur(weekHours),`${active.length} active now`,"violet")}
      ${metricVisual("$","Outstanding",money(outstanding),`${pending.length} invoice${pending.length===1?"":"s"}`,"gold")}
    </div>
    <div class="analytics-grid">
      <article class="card glass chart-card"><div class="section-head"><div><span class="section-label">WORK RHYTHM</span><h3>Last 7 days</h3></div><span class="status">${dur(bars.reduce((s,x)=>s+x.hours,0))}</span></div>${miniBars(bars)}</article>
      <article class="card glass completion-card"><div><span class="section-label">TASK FLOW</span><h3>Completion rate</h3><p class="muted">A quick view of request throughput.</p></div>${progressRing(taskPercent,"Complete",`${done.length}/${state.tasks.length||0} tasks`)}</article>
    </div>
    <div class="grid2">
      <article class="card glass"><div class="section-head"><div><span class="section-label">TASK INBOX</span><h3>Latest employer requests</h3></div><button class="mini-btn" data-admin-view="tasks">Open inbox</button></div>${taskListHtml(open.slice(0,5),true)}</article>
      <article class="card glass"><div class="section-head"><div><span class="section-label">ACTIVE WORK</span><h3>Running timers</h3></div>${active.length?'<span class="live-chip"><i></i> LIVE</span>':''}</div>${active.length?active.map(activeSessionHtml).join(""):'<div class="visual-empty"><span>◷</span><strong>No active session</strong><p>Start work from Time Log when you are ready.</p><button class="mini-btn" data-admin-view="time">Open Time Log</button></div>'}</article>
    </div>
  </section>`;
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
  setAppRoute(["admin","clients",id]);
  const seq=++state.navSeq,c=state.clients.find(x=>x.id===id);if(!c)return;
  state.activeClient=id;state.activeWebsiteProject=null;setPageTitle("Employer Details");
  const [sub,files,projects,legacyAssets]=await Promise.all([getSubmission(id),listFiles(id),listWebsiteProjects(id),listLegacyWebsiteAssets(id)]),tasks=state.tasks.filter(t=>t.client_id===id);if(seq!==state.navSeq)return;
  const projectBundles=await Promise.all(projects.map(async project=>({project,assets:await listWebsiteProjectAssets(id,project.id)})));if(seq!==state.navSeq)return;
  $("view").innerHTML=`
    <button class="btn ghost" data-admin-view="clients">← Back</button>
    <article class="card glass" style="margin-top:10px"><div class="section-head"><div><span class="section-label">EMPLOYER</span><h3>${esc(c.name)}</h3><p class="muted">${esc(c.company||"")}</p></div><div>${statusPill(c.status)} <button class="mini-btn" data-action="edit-client" data-id="${c.id}">Edit</button></div></div>
    <div class="info-grid"><div class="info"><span>Website projects</span><strong>${projects.length}</strong></div><div class="info"><span>Priority</span><strong>${esc(c.priority||"Normal")}</strong></div><div class="info"><span>Started</span><strong>${fmtDate(c.start_date)}</strong></div><div class="info"><span>Deadline</span><strong>${fmtDate(c.deadline)}</strong></div></div></article>
    <div class="grid2">
      <article class="card glass"><span class="section-label">EMPLOYER INFORMATION</span><h3>Project information</h3><div>${richStoredHtml(sub?.project_information||"No employer project information yet.")}</div></article>
      <article class="card glass"><span class="section-label">SHARED NOTES</span><h3>Notes from employer</h3><div>${richStoredHtml(sub?.shared_notes||"No shared notes yet.")}</div></article>
    </div>
    <article class="card glass" style="margin-top:13px"><div class="section-head"><div><span class="section-label">WEBSITE PROJECTS</span><h3>${projects.length} website project${projects.length===1?"":"s"}</h3><p class="muted">Every website has its own intake, notes and assets.</p></div></div>
      <div class="website-project-list admin-project-list">${projectBundles.length?projectBundles.map(({project,assets})=>websiteProjectAdminCard(c,project,assets)).join(""):'<div class="empty"><strong>No website projects yet</strong>The employer can add a project from the Website Projects page.</div>'}</div>
    </article>
    ${legacyAssets.length?`<article class="card glass legacy-assets-card" style="margin-top:13px"><div class="section-head"><div><span class="section-label">V2.12 LEGACY ASSETS</span><h3>Previous website uploads</h3><p class="muted">Files uploaded before multi-project mode. They are preserved here.</p></div><span class="status">${legacyAssets.length} files</span></div>${legacyWebsiteAssetAdminListHtml(legacyAssets,c)}</article>`:""}
    <article class="card glass" style="margin-top:13px"><div class="section-head"><div><span class="section-label">EMPLOYER TASKS</span><h3>Read-only requests</h3></div><button class="mini-btn" data-admin-view="tasks">Open Task Inbox</button></div>${taskListHtml(tasks,false)}</article>
    <article class="card glass" style="margin-top:13px"><span class="section-label">LEGACY SHARED FILES</span><h3>Older unassigned files</h3><p class="muted">New website assets are managed inside each Website Project by category.</p>${fileListHtml(files,c,true)}</article>`;
}
function websiteProjectAdminCard(c,project,assets){return `<article class="website-project-card glass"><div class="website-project-card-head"><div><span class="section-label">WEBSITE PROJECT</span><h4>${esc(project.website_name||"Untitled Website")}</h4><p class="muted">Updated ${fmtDate(project.updated_at)}</p></div><div class="row-actions">${websiteProjectStatusPill(project.status)}${project.showcase_published?'<span class="status complete">Showcase Live</span>':''}<button class="btn primary" data-action="open-admin-website-project" data-id="${project.id}" data-client-id="${c.id}">Open Admin Workspace</button><button class="mini-btn" data-action="copy-project-intake" data-id="${project.id}" data-client-id="${c.id}">Copy Full Intake</button></div></div><details class="admin-project-details"><summary>Quick intake preview</summary><div class="intake-admin-preview">${websiteIntakeAdminHtml(project)}</div><div class="project-assets-admin"><div class="section-head"><div><span class="section-label">EMPLOYER ASSETS</span><h4>${assets.length} file${assets.length===1?"":"s"}</h4></div></div>${websiteProjectAssetAdminListHtml(assets,c,project)}</div></details></article>`}


function websiteIntakeAdminHtml(project){
  const intake=project?.website_intake&&typeof project.website_intake==="object"?project.website_intake:{};
  return `<div class="intake-admin-grid">${WEBSITE_INTAKE_SECTIONS.map(section=>`<section class="intake-admin-section"><span>${esc(section.title)}</span><div>${nl2br(intakeValue(intake,section.id)||"Not provided")}</div></section>`).join("")}<section class="intake-admin-section intake-admin-notes"><span>Additional Notes</span><div>${nl2br(project?.website_notes||"Not provided")}</div></section></div>`;
}
async function renderPromptLibrary(){
  const seq=state.navSeq;setPageTitle("Prompt Library");
  const {data,error}=await state.sb.from("website_prompts").select("*").order("updated_at",{ascending:false});
  if(error){$("view").innerHTML=`<article class="card glass"><span class="section-label">PROMPT LIBRARY</span><h3>Database setup required</h3><p class="muted">Run V2.12-WEBSITE-WORKSPACE-PATCH.sql in Supabase, then refresh this page.</p><div class="form-error">${esc(error.message)}</div></article>`;return}
  if(seq!==state.navSeq)return;
  state.prompts=data||[];
  $("view").innerHTML=`<div class="prompt-layout"><article class="card glass prompt-editor"><span class="section-label">COMMAND PROMPTS</span><h3>Save a reusable website prompt</h3><input id="promptId" type="hidden"><div class="field"><span>Prompt name</span><input id="promptTitle" placeholder="e.g. Local SEO homepage copy"></div><div class="field"><span>Category</span><select id="promptCategory"><option>Website Build</option><option>Content</option><option>SEO</option><option>Design</option><option>Development</option><option>Client Communication</option><option>Custom</option></select></div><div class="field"><span>Prompt</span><textarea id="promptText" class="auto-grow prompt-textarea" rows="12" placeholder="Paste or write the prompt you want to reuse…"></textarea></div><div class="card-actions start"><button class="btn primary" data-action="save-prompt">Save Prompt</button><button class="btn ghost hidden" id="cancelPromptEdit" data-action="cancel-prompt-edit">Cancel Edit</button></div></article><article class="card glass"><div class="section-head"><div><span class="section-label">SAVED PROMPTS</span><h3>${(data||[]).length} saved</h3></div><input id="promptSearch" class="prompt-search" placeholder="Search prompts…"></div><div id="promptRows" class="prompt-list"></div></article></div>`;
  renderPromptRows();setupAutoGrow($("view"));
}
function renderPromptRows(){
  const box=$("promptRows");if(!box)return;const q=($("promptSearch")?.value||"").trim().toLowerCase();const list=(state.prompts||[]).filter(p=>!q||`${p.title} ${p.category} ${p.prompt_text}`.toLowerCase().includes(q));
  box.innerHTML=list.length?list.map(p=>`<article class="prompt-item"><div class="prompt-item-head"><div><span class="status">${esc(p.category||"Website")}</span><h4>${esc(p.title)}</h4></div><div class="row-actions"><button class="mini-btn" data-action="copy-prompt" data-id="${p.id}">Copy</button><button class="mini-btn" data-action="edit-prompt" data-id="${p.id}">Edit</button><button class="mini-btn danger" data-action="delete-prompt" data-id="${p.id}">Delete</button></div></div><pre>${esc(p.prompt_text)}</pre></article>`).join(""):'<div class="empty"><strong>No prompts yet</strong>Save your first website prompt on the left.</div>';
}
async function savePrompt(){
  const id=$("promptId")?.value,title=$("promptTitle")?.value.trim(),category=$("promptCategory")?.value||"Website",prompt_text=$("promptText")?.value.trim();if(!title||!prompt_text)return toast("Prompt name and prompt text are required");
  const payload={user_id:state.session.user.id,title,category,prompt_text,updated_at:new Date().toISOString()};let q=id?state.sb.from("website_prompts").update(payload).eq("id",id):state.sb.from("website_prompts").insert(payload);const {error}=await q;if(error)return toast(error.message);toast(id?"Prompt updated":"Prompt saved");renderPromptLibrary();
}
function editPrompt(id){const p=(state.prompts||[]).find(x=>x.id===id);if(!p)return;$("promptId").value=p.id;$("promptTitle").value=p.title||"";$("promptCategory").value=p.category||"Custom";$("promptText").value=p.prompt_text||"";$("cancelPromptEdit").classList.remove("hidden");autoGrow($("promptText"));$("promptTitle").focus();window.scrollTo({top:0,behavior:"smooth"})}
function cancelPromptEdit(){if(!$("promptId"))return;$("promptId").value="";$("promptTitle").value="";$("promptCategory").value="Website Build";$("promptText").value="";$("cancelPromptEdit").classList.add("hidden");autoGrow($("promptText"))}
async function deletePrompt(id){const p=(state.prompts||[]).find(x=>x.id===id);if(!p||!confirm(`Delete prompt “${p.title}”?`))return;const {error}=await state.sb.from("website_prompts").delete().eq("id",id);if(error)return toast(error.message);toast("Prompt deleted");renderPromptLibrary()}

async function listWebsiteProjects(clientId){if(!clientId)return[];const {data,error}=await state.sb.from("website_projects").select("*").eq("client_id",clientId).order("updated_at",{ascending:false});if(error){console.warn(error);throw error}return data||[]}
async function getWebsiteProject(projectId){if(!projectId)return null;const {data,error}=await state.sb.from("website_projects").select("*").eq("id",projectId).maybeSingle();if(error)throw error;return data}

function renderTaskInbox(){
  setPageTitle("Task Inbox");
  const unread=state.tasks.filter(t=>!t.admin_seen_at).length;
  $("taskBadge").textContent=unread;$("taskBadge").classList.toggle("hidden",!unread);
  $("view").innerHTML=`<section class="page-shell"><div class="page-head"><div><span class="section-label">EMPLOYER REQUESTS</span><h1>Task Inbox</h1><p class="muted">Review, open, and complete requests from every employer.</p></div><div class="page-head-actions"><select id="taskFilter" aria-label="Filter tasks"><option value="all">All tasks</option><option value="unread">Unread</option><option value="open">Open</option><option value="done">Completed</option></select></div></div><article class="card glass"><div id="taskInboxRows" class="table-list"></div></article></section>`;
  renderTaskInboxRows();
}
function renderTaskInboxRows(){
  const box=$("taskInboxRows");if(!box)return;
  const f=$("taskFilter")?.value||"all";
  const list=state.tasks.filter(t=>f==="all"||f==="unread"&&!t.admin_seen_at||f==="open"&&!t.done||f==="done"&&t.done);
  box.innerHTML=list.length?list.map(t=>`<article class="row-card mobile-stack"><div class="row-main"><strong class="rich-task-title">${richTitleHtml(t.task)}</strong><small>${esc(stripHtml(t.details||"")).slice(0,160)}${stripHtml(t.details||"").length>160?"…":""}</small></div><div><strong>${esc(clientName(t.client_id))}</strong><small>${esc(t.priority||"Normal")}</small></div><div class="status-group">${t.done?'<span class="status complete">Completed</span>':'<span class="status">Open</span>'}${!t.admin_seen_at?' <span class="status">New</span>':""}</div><div class="row-actions"><button class="mini-btn" data-action="view-task" data-id="${t.id}">Open</button><button class="mini-btn" data-action="toggle-task" data-id="${t.id}">${t.done?"Reopen":"Mark Done"}</button></div></article>`).join(""):'<div class="empty"><strong>No tasks found</strong><p>Requests will appear here when employers send them.</p></div>';
}

function renderTimePage(){
  setPageTitle("Time Log");
  const active=state.time.filter(e=>!e.clock_out),rate=Number(state.billing?.hourly_rate||3);
  $("view").innerHTML=`<section class="page-shell"><div class="page-head"><div><span class="section-label">WORK TRACKING</span><h1>Time Log</h1><p class="muted">Track live sessions, add manual work, and correct recorded time.</p></div></div>
    <div class="stats"><div class="stat glass"><span>Today</span><strong>${dur(sumHours(state.time,todayStart()))}</strong></div><div class="stat glass"><span>This week</span><strong>${dur(sumHours(state.time,weekStart()))}</strong></div><div class="stat glass"><span>Rate</span><strong>${money(rate)}/h</strong></div><div class="stat glass"><span>Active</span><strong>${active.length}</strong></div></div>
    <div class="grid2"><article class="card glass"><span class="section-label">START / STOP</span><h3>Work session</h3><div class="field"><span>Employer</span><select id="timerClient"><option value="">Select employer</option>${state.clients.map(c=>`<option value="${c.id}">${esc(c.name)}${active.some(a=>a.client_id===c.id)?" • ACTIVE":""}</option>`).join("")}</select></div><div class="field"><span>Task</span><input id="timerTask" placeholder="What are you working on?"></div><div class="row-actions start-actions"><button class="btn primary" data-action="clock-in">Start Work</button><button class="btn danger" data-action="clock-out-selected">Stop Selected</button></div></article>
    <article class="card glass"><span class="section-label">MANUAL ENTRY</span><h3>Add hours worked</h3><div class="form-grid"><div class="field"><span>Employer</span><select id="manualClient"><option value="">Select employer</option>${state.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div><div class="field"><span>Date</span><input id="manualDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><span>Hours</span><input id="manualHours" type="number" min=".01" step=".25"></div><div class="field"><span>Rate</span><input id="manualRate" type="number" min="0" step=".01" value="${rate.toFixed(2)}"></div></div><div class="field"><span>Description</span><input id="manualTask" placeholder="Work description"></div><button class="btn primary" data-action="manual-hours" style="margin-top:12px">Add Hours</button></article></div>
    <article class="card glass section-card"><div class="section-head"><div><span class="section-label">ACTIVE SESSIONS</span><h3>Running timers</h3></div><span class="status">${active.length} active</span></div><div id="activeSessions">${active.length?active.map(activeSessionHtml).join(""):'<div class="empty"><strong>No active sessions</strong></div>'}</div></article>
    <article class="card glass section-card"><div class="section-head"><div><span class="section-label">WORK HISTORY</span><h3>Recent entries</h3></div></div><div class="table-list">${state.time.slice(0,50).map(e=>`<article class="row-card mobile-stack"><div><strong>${esc(clientName(e.client_id))}</strong><small>${esc(e.task||"General work")}</small></div><div><strong>${fmtDate(e.clock_in)}</strong><small>${fmtTime(e.clock_in)}${e.clock_out?" → "+fmtTime(e.clock_out):" → active"}</small></div><div><strong>${dur(hoursOf(e))}</strong><small>${money(e.hourly_rate||rate)}/h</small></div><div class="row-actions">${e.invoice_id?'<span class="status complete">Invoiced</span>':e.clock_out?'<span class="status">Uninvoiced</span>':'<span class="status">Running</span>'}<button class="mini-btn" data-action="edit-time-entry" data-id="${e.id}">Edit</button></div></article>`).join("")||'<div class="empty"><strong>No work entries yet</strong></div>'}</div></article></section>`;
  startTicker();
}
function activeSessionHtml(e){return`<div class="active-session"><div><strong>${esc(clientName(e.client_id))}</strong><small class="muted">${esc(e.task||"General work")}</small></div><div><span class="muted">Started</span><strong>${fmtTime(e.clock_in)}</strong></div><div class="live-time" data-session-clock="${e.id}">00:00:00</div><div class="row-actions"><button class="mini-btn" data-action="edit-time-entry" data-id="${e.id}">Edit</button><button class="mini-btn" data-action="stop-session" data-id="${e.id}">Stop</button></div></div>`}

function renderAdminInvoices(){
  setPageTitle("Invoices");
  const pending=state.invoices.filter(i=>i.status==="pending"),paid=state.invoices.filter(i=>i.status==="paid"),rate=Number(state.billing?.hourly_rate||3);
  $("view").innerHTML=`<section class="page-shell"><div class="page-head"><div><span class="section-label">BILLING</span><h1>Invoices</h1><p class="muted">Create, preview, review, and mark client invoices as paid.</p></div></div>
    <div class="stats"><div class="stat glass"><span>Incoming</span><strong>${pending.length}</strong></div><div class="stat glass"><span>Paid</span><strong>${paid.length}</strong></div><div class="stat glass"><span>Outstanding</span><strong>${money(pending.reduce((s,i)=>s+Number(i.total||0),0))}</strong></div><div class="stat glass"><span>Total paid</span><strong>${money(paid.reduce((s,i)=>s+Number(i.total||0),0))}</strong></div></div>
    <article class="card glass section-card"><div class="section-head"><div><span class="section-label">CREATE INVOICE</span><h3>Generate invoice</h3></div></div><div class="form-grid"><div class="field"><span>Employer</span><select id="invoiceClient"><option value="">Select employer</option>${state.clients.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("")}</select></div><div class="field"><span>Invoice #</span><input id="invoiceNumber" value="${nextInvoiceNumber()}"></div><div class="field"><span>Invoice date</span><input id="invoiceDate" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><span>Hours source</span><select id="invoiceMode"><option value="time">Use Time Log</option><option value="manual">Enter Hours Manually</option></select></div><div class="field"><span>Period start</span><input id="invoiceStart" type="date"></div><div class="field"><span>Period end</span><input id="invoiceEnd" type="date"></div><div class="field"><span>Manual hours</span><input id="invoiceManualHours" type="number" min=".01" step=".25" disabled></div><div class="field"><span>Hourly rate</span><input id="invoiceRate" type="number" min="0" step=".01" value="${rate.toFixed(2)}"></div></div><div class="field"><span>Description</span><input id="invoiceDescription" value="Online Web Work"></div><div class="field"><span>Notes / payment instructions</span><textarea id="invoiceNotes" rows="4">${esc(state.billing?.payment_instructions||"")}</textarea></div><div class="invoice-create-footer"><div class="invoice-live-total"><span id="invoiceHoursPreview">0.00 hrs</span><strong id="invoiceTotalPreview">$0.00</strong></div><div class="row-actions"><button class="btn ghost" data-action="preview-invoice">Preview</button><button class="btn primary" data-action="create-invoice">Create Invoice</button></div></div></article>
    <article class="card glass section-card"><div class="section-head"><div><span class="section-label">BILLING HISTORY</span><h3>Invoices</h3></div><span class="status">${state.invoices.length} total</span></div>${invoiceRows(state.invoices,true)}</article></section>`;
  updateInvoicePreview();
}
function invoiceRows(list,admin){return`<div class="table-list">${list.length?list.map(i=>`<article class="row-card mobile-stack"><div><strong>${esc(i.invoice_number)}</strong><small>${esc(clientName(i.client_id))} · ${esc(i.description||"Online Work")}</small></div><div><strong>${fmtDate(i.invoice_date)}</strong><small>${i.period_start?fmtDate(i.period_start)+" — "+fmtDate(i.period_end):"No billing period"}</small></div><div><strong>${money(i.total)}</strong><small>${Number(i.hours||0).toFixed(2)} hrs · ${money(i.hourly_rate)}/h</small></div><div class="row-actions"><span class="status ${i.status==="paid"?"complete":""}">${i.status==="paid"?"Paid":"Incoming"}</span><button class="mini-btn" data-action="view-invoice" data-id="${i.id}">View</button>${admin&&i.status!=="paid"?`<button class="mini-btn" data-action="mark-paid" data-id="${i.id}">Mark Paid</button>`:""}</div></article>`).join(""):'<div class="empty"><strong>No invoices yet</strong><p>Create your first invoice above.</p></div>'}</div>`}

function renderBilling(){
  setPageTitle("Rate & Billing");const b=state.billing||{};
  $("view").innerHTML=`<section class="page-shell"><div class="page-head"><div><span class="section-label">BILLING PROFILE</span><h1>Rate & Billing</h1><p class="muted">Manage your hourly rate and the business details shown on invoices.</p></div></div><article class="card glass"><div class="form-grid"><div class="field"><span>Hourly rate USD</span><input id="billRate" type="number" step=".01" value="${Number(b.hourly_rate||3)}"></div><div class="field"><span>Business / VA name</span><input id="billBusiness" value="${esc(b.business_name||"Jeffdesign101 / Webdev VA")}"></div><div class="field"><span>Your full name</span><input id="billName" value="${esc(b.full_name||"")}"></div><div class="field"><span>Email shown on invoice</span><input id="billEmail" value="${esc(b.email||"")}"></div><div class="field"><span>Phone</span><input id="billPhone" value="${esc(b.phone||"")}"></div><div class="field"><span>Address</span><input id="billAddress" value="${esc(b.address||"")}"></div></div><div class="field"><span>Payment instructions</span><textarea id="billPayment" rows="5">${esc(b.payment_instructions||"")}</textarea></div><div class="card-actions start"><button class="btn primary" data-action="save-billing">Save Billing Settings</button></div></article></section>`;
}
async function renderTrash(){
  const seq=state.navSeq;setPageTitle("Trash");
  const {data,error}=await state.sb.from("clients").select("*").not("deleted_at","is",null).order("deleted_at",{ascending:false});if(error){toast(error.message);return}if(seq!==state.navSeq)return;
  $("view").innerHTML=`<section class="page-shell"><div class="page-head"><div><span class="section-label">ARCHIVE</span><h1>Trash</h1><p class="muted">Restore employers that were previously removed from the active workspace.</p></div></div><article class="card glass"><div class="table-list">${(data||[]).map(c=>`<article class="row-card mobile-stack"><div><strong>${esc(c.name)}</strong><small>${esc(c.company||"")}</small></div><div>${statusPill(c.status)}</div><div><small>Deleted ${fmtDate(c.deleted_at)}</small></div><div class="row-actions"><button class="mini-btn" data-action="restore-client" data-id="${c.id}">Restore</button></div></article>`).join("")||'<div class="empty"><strong>Trash is empty</strong></div>'}</div></article></section>`;
}

async function renderEmployerOverview(){
  const seq=state.navSeq;setPageTitle("Employer Portal");const c=currentClient();
  if(!c){$("view").innerHTML='<div class="empty"><strong>No project linked</strong></div>';return}
  let projects=[];let sub,files;
  try{[sub,files,projects]=await Promise.all([getSubmission(c.id),listFiles(c.id),listWebsiteProjects(c.id)])}catch(e){[sub,files]=await Promise.all([getSubmission(c.id),listFiles(c.id)]);projects=[]}
  const tasks=state.tasks.filter(t=>t.client_id===c.id),editable=c.portal_permission!=="view",pending=state.invoices.filter(i=>i.client_id===c.id&&i.status==="pending"),done=tasks.filter(t=>t.done);
  if(seq!==state.navSeq)return;
  const avgProgress=projects.length?Math.round(projects.reduce((s,p)=>s+projectCompletion(p),0)/projects.length):0,showcases=projects.filter(p=>p.showcase_published).length;
  const dashboardPreviewProject=projects.find(p=>p.showcase_published&&showcaseGalleryPaths(p).length);
  let dashboardPreview="";
  if(dashboardPreviewProject){const previewPaths=showcaseGalleryPaths(dashboardPreviewProject),previewUrls=(await Promise.all(previewPaths.map(p=>signedFileUrl(p)))).filter(Boolean);if(seq!==state.navSeq)return;if(previewUrls.length)dashboardPreview=`<article class="card glass employer-dashboard-preview"><div class="section-head"><div><span class="section-label">LATEST WEBSITE PREVIEW</span><h3>${esc(dashboardPreviewProject.website_name||"Website Project")}</h3><p class="muted">Auto-playing preview · swipe or use the arrows to browse.</p></div><button class="mini-btn" data-action="view-website-project" data-id="${dashboardPreviewProject.id}">Open Project</button></div>${showcaseCarouselHtml(previewUrls,{admin:false})}</article>`}
  $("view").innerHTML=`<section class="page-shell employer-experience">
    <section class="client-hero glass">
      <div class="client-hero-copy"><span class="section-label">YOUR PROJECT PORTAL</span><h1>${esc(c.company||c.name)}</h1><p>${esc(c.project_type||"Website collaboration workspace")} · everything your VA needs, organized in one place.</p><div class="client-status-actions">${["ongoing","paused","complete"].map(s=>`<button class="mini-btn ${c.status===s?"active":""}" data-action="employer-status" data-status="${s}" ${editable?"":"disabled"}>${s==="ongoing"?"Active":s[0].toUpperCase()+s.slice(1)}</button>`).join("")}</div>${editable?`<div class="client-hero-cta"><button class="btn primary" data-action="new-website-project">+ Add Website Project</button><button class="btn ghost" data-employer-view="website">Open Website Projects</button></div>`:""}</div>
      <div class="client-hero-visual">${progressRing(avgProgress,"Project Ready",projects.length?`${projects.length} website project${projects.length===1?"":"s"}`:"Start a project")}</div>
    </section>
    <div class="visual-stats-grid employer-kpis">
      ${metricVisual("☷","Open Requests",tasks.filter(t=>!t.done).length,`${done.length} completed`,"blue")}
      ${metricVisual("◈","Website Projects",projects.length,`${showcases} showcase${showcases===1?"":"s"} live`,"lime")}
      ${metricVisual("▤","Incoming Invoices",pending.length,pending.length?"Awaiting payment":"Nothing due","violet")}
      ${metricVisual("$","Amount Due",money(pending.reduce((s,i)=>s+Number(i.total||0),0)),"Current balance","gold")}
    </div>
    ${projects.length?`<article class="card glass project-snapshot"><div class="section-head"><div><span class="section-label">WEBSITE PROJECTS</span><h3>Your active workspace</h3><p class="muted">Tap a project to continue the intake or review the latest showcase.</p></div><button class="mini-btn" data-employer-view="website">View all</button></div><div class="project-snapshot-grid">${projects.slice(0,3).map(p=>`<button class="project-snapshot-card" data-action="view-website-project" data-id="${p.id}"><span class="project-snapshot-top">${websiteProjectStatusPill(p.status)}${p.showcase_published?'<b>● Preview live</b>':''}</span><strong>${esc(p.website_name||"Untitled Website")}</strong><small>${projectCompletion(p)}% intake progress</small><i><em style="width:${projectCompletion(p)}%"></em></i></button>`).join("")}</div></article>`:""}
    ${dashboardPreview}
    <div class="grid2">
      <article class="card glass request-compose-card"><span class="section-label">CURRENT REQUEST</span><h3>Send a task to your VA</h3><p class="muted">Share a request, revision or next action.</p>${editable?taskComposerHtml("overview"):'<p class="muted">This portal is View Only.</p>'}</article>
      <article class="card glass"><div class="section-head"><div><span class="section-label">REQUESTS</span><h3>Latest tasks</h3></div><button class="mini-btn" data-employer-view="tasks">View all</button></div>${taskListHtml(tasks.slice(0,5),false,editable)}</article>
    </div>
    <div class="grid2 employer-info-grid">
      <article class="card glass section-panel"><span class="section-label">PROJECT INFORMATION</span><h3>Website information & instructions</h3>${editable?officeEditorHtml("projectInfo",sub?.project_information||"","Hosting details, admin access, content notes, feature requests, URLs, and everything your VA needs…","save-project-info","Save Information"):`<div class="read-block rich-output">${richStoredHtml(sub?.project_information||"No project information yet.")}</div>`}</article>
      <article class="card glass section-panel"><span class="section-label">SHARED NOTES</span><h3>Notes for your VA</h3>${editable?officeEditorHtml("sharedNotes",sub?.shared_notes||"","Share reminders, follow-ups, revisions, deadlines, or anything your VA should remember…","save-shared-notes","Save Notes"):`<div class="read-block rich-output">${richStoredHtml(sub?.shared_notes||"No notes yet.")}</div>`}</article>
    </div>
    <article class="card glass"><div class="section-head"><div><span class="section-label">FILES</span><h3>Shared project files</h3><p class="muted">Logos, documents, screenshots and source materials.</p></div><button class="mini-btn" data-employer-view="website">Manage Project Assets</button></div>${fileListHtml(files,c,editable)}</article>
  </section>`;
  setupRichEditors();startShowcaseCarousels();updateStatusDock();
}

async function renderEmployerWebsiteProject(){
  const seq=state.navSeq;setPageTitle("Website Projects");const c=currentClient();if(!c){$("view").innerHTML='<div class="empty"><strong>No employer account linked</strong></div>';return}const editable=c.portal_permission!=="view";
  let projects=[],legacyAssets=[];try{[projects,legacyAssets]=await Promise.all([listWebsiteProjects(c.id),listLegacyWebsiteAssets(c.id)])}catch(error){$("view").innerHTML=`<article class="card glass"><span class="section-label">WEBSITE PROJECTS</span><h3>Database upgrade required</h3><p class="muted">Run V2.13-MULTI-WEBSITE-PROJECTS-PATCH.sql in Supabase, then refresh.</p><div class="form-error">${esc(error.message)}</div></article>`;return}if(seq!==state.navSeq)return;
  const selected=state.activeWebsiteProject&&projects.find(p=>p.id===state.activeWebsiteProject);
  if(selected){
    if(state.activeWebsiteProjectMode==="viewer")return renderEmployerWebsiteProjectViewer(selected);
    return renderEmployerWebsiteProjectEditor(selected,editable);
  }
  $("view").innerHTML=`<section class="page-shell employer-websites-page"><div class="page-head glass website-project-pagehead"><div><span class="section-label">WEBSITE PROJECTS</span><h1>Your Website Workspace</h1><p class="muted">Create a separate intake for every website, landing page, store, branch, or redesign.</p></div><div class="page-head-actions">${editable?'<button class="btn primary" data-action="new-website-project">+ Add Website Project</button>':'<div class="status">View Only</div>'}</div></div><div class="website-project-list">${projects.length?projects.map(p=>websiteProjectEmployerCard(p,editable)).join(""):'<article class="card glass empty-project-state"><strong>No website projects yet</strong><p class="muted">Create your first project and complete the website intake checklist.</p>'+(editable?'<button class="btn primary" data-action="new-website-project">+ Add Website Project</button>':'')+'</article>'}</div>${legacyAssets.length?`<article class="card glass legacy-assets-card"><div class="section-head"><div><span class="section-label">PREVIOUS UPLOADS</span><h3>Assets uploaded before multi-project mode</h3><p class="muted">These files are preserved from your earlier Website Project workspace.</p></div><span class="status">${legacyAssets.length} files</span></div>${legacyWebsiteAssetAdminListHtml(legacyAssets,c)}</article>`:""}</section>`;
}
function websiteProjectEmployerCard(project,editable){
  const progress=projectCompletion(project);
  return `<article class="website-project-card glass visual-project-card">
    <div class="website-project-card-head"><div class="project-card-title"><span class="section-label">WEBSITE PROJECT</span><h3>${esc(project.website_name||"Untitled Website")}</h3><p class="muted">Updated ${fmtDate(project.updated_at)}</p></div>${progressRing(progress,"Intake",project.showcase_published?"Preview available":"Submitted")}</div>
    <div class="project-progress-line"><span><b>${progress}%</b> intake prepared</span><i><em style="width:${progress}%"></em></i></div>
    <div class="project-card-meta">${websiteProjectStatusPill(project.status)}${project.showcase_published?'<span class="status complete">● Project preview available</span>':'<span class="status">Production managed by Admin</span>'}</div>
    <div class="website-project-card-actions project-role-actions">
      <button class="btn primary" data-action="view-website-project" data-id="${project.id}">View Website Project</button>
      ${editable?`<button class="btn ghost" data-action="open-website-project" data-id="${project.id}">Update Intake</button>`:""}
    </div>
  </article>`
}
function openNewWebsiteProjectModal(){const c=currentClient();if(!c||c.portal_permission==="view")return toast("This portal is View Only");$("websiteProjectName").value=c.company||"";$("websiteProjectType").value="Business Website";$("websiteProjectNote").value="";openModal("websiteProjectModal");setTimeout(()=>$("websiteProjectName")?.focus(),60)}
async function createWebsiteProject(){const c=currentClient();if(!c||c.portal_permission==="view")return toast("This portal is View Only");const name=$("websiteProjectName")?.value.trim()||"",type=$("websiteProjectType")?.value||"Business Website",note=$("websiteProjectNote")?.value.trim()||"";if(!name)return toast("Enter a website project name");const website_notes=[type?`Project type: ${type}`:"",note].filter(Boolean).join("\n\n");const payload={client_id:c.id,created_by:state.session.user.id,website_name:name,website_intake:{},website_notes,status:"draft",updated_at:new Date().toISOString()};const submit=$("websiteProjectForm")?.querySelector('button[type="submit"]');setBusy(submit,true,"Creating…");try{const {data,error}=await state.sb.from("website_projects").insert(payload).select("*").single();if(error)throw error;state.activeWebsiteProject=data.id;state.activeWebsiteProjectMode="intake";closeModal("websiteProjectModal");toast("Website project created");renderEmployer("website")}catch(e){toast(e.message||"Could not create project")}finally{setBusy(submit,false)}}
async function openWebsiteProject(id){state.activeWebsiteProject=id;state.activeWebsiteProjectMode="intake";renderEmployer("website")}
async function viewWebsiteProject(id){state.activeWebsiteProject=id;state.activeWebsiteProjectMode="viewer";renderEmployer("website")}
function closeWebsiteProject(){state.activeWebsiteProject=null;state.activeWebsiteProjectMode=null;renderEmployer("website")}
async function renderEmployerWebsiteProjectViewer(project){
  const seq=state.navSeq;setPageTitle(project.website_name||"Website Project");
  const [showcase,events]=await Promise.all([buildShowcaseView(project),listWebsiteProjectEvents(project.client_id,project.id,20)]);if(seq!==state.navSeq)return;state._websiteProjects=[project];
  const progress=projectCompletion(project),published=!!project.showcase_published,site=published&&project.showcase_url?websiteHref(project.showcase_url):"#";
  const statusLabel=({draft:"Drafting",in_progress:"In Progress",ready:"Ready to Build",complete:"Completed"}[project.status]||String(project.status||"Drafting").replace(/_/g," "));
  $("view").innerHTML=`<section class="page-shell employer-project-view-page">
    <div class="project-view-nav"><button class="btn ghost" data-action="back-to-website-projects">← Website Projects</button><button class="btn ghost" data-action="open-website-project" data-id="${project.id}">Update Intake</button></div>
    <section class="project-view-hero glass">
      <div class="project-view-copy"><span class="section-label">WEBSITE PROJECT VIEW</span><h1>${esc(project.website_name||"Untitled Website")}</h1><p class="muted">This production page is managed by Jeffdesign101 and is view-only for your account.</p><div class="project-view-badges">${websiteProjectStatusPill(project.status)}${project.showcase_published?'<span class="status complete">● Preview Published</span>':'<span class="status">Preview Not Published Yet</span>'}</div></div>
      ${progressRing(progress,"Intake",`${statusLabel}`)}
    </section>
    <div class="project-view-grid">
      <article class="card glass project-view-detail"><span class="section-label">CURRENT STATUS</span><h3>${esc(statusLabel)}</h3><p class="muted">Production status is updated by the Admin as your website moves toward completion.</p></article>
      <article class="card glass project-view-detail"><span class="section-label">WEBSITE LINK</span><h3>${site!=="#"?"Preview / Live Site":"Not available yet"}</h3>${site!=="#"?`<a class="btn primary project-view-site" href="${esc(site)}" target="_blank" rel="noopener">Open Website ↗</a>`:'<p class="muted">The Admin will publish the staging or live link here when it is ready.</p>'}</article>
      <article class="card glass project-view-detail project-view-update"><span class="section-label">LATEST UPDATE</span><h3>Project Notes</h3><div class="read-block">${esc(published?(project.showcase_notes||"No production update has been added yet."):"No production update has been published yet.")}</div></article>
    </div>
    ${showcase||`<article class="card glass project-preview-waiting"><div class="preview-waiting-icon">◈</div><div><span class="section-label">DESIGN PREVIEW</span><h3>Preview coming soon</h3><p class="muted">Your logo, screenshots and visual website preview will appear here once the Admin publishes them.</p></div></article>`}
    <article class="card glass employer-activity-panel"><div class="section-head"><div><span class="section-label">PROJECT UPDATES</span><h3>Recent Activity</h3><p class="muted">Changes to your intake, uploaded files, status, and published preview.</p></div></div><div class="project-event-list">${events.length?events.slice(0,10).map(e=>projectEventHtml(e,true)).join(""):'<div class="empty"><strong>No updates yet</strong></div>'}</div></article>
    <article class="card glass project-view-intake-summary"><div class="section-head"><div><span class="section-label">YOUR SUBMISSION</span><h3>Website Intake</h3><p class="muted">Your intake remains separate from this view-only production page.</p></div><button class="btn ghost" data-action="open-website-project" data-id="${project.id}">Open Intake</button></div><div class="project-progress-line"><span><b>${progress}%</b> completed</span><i><em style="width:${progress}%"></em></i></div></article>
  </section>`;
  startShowcaseCarousels();
}

async function renderEmployerWebsiteProjectEditor(project,editable){
  const c=currentClient(),seq=state.navSeq;if(seq!==state.navSeq)return;const intake=project.website_intake&&typeof project.website_intake==="object"?project.website_intake:{};
  $("view").innerHTML=`<div class="project-editor-top"><button class="btn ghost" data-action="back-to-website-projects">← All Website Projects</button></div>
  <article class="card glass website-project-hero"><div><span class="section-label">WEBSITE PROJECT</span><h3>${esc(project.website_name||"Untitled Website")}</h3><p class="muted">Add your website name and complete the intake information below. Production status and website previews are managed by Jeffdesign101.</p></div>${websiteProjectStatusPill(project.status)}</article>
  <article class="card glass intake-save-bar"><div class="field"><span>Site Name</span><input id="websiteProjectName" value="${esc(project.website_name||"")}" placeholder="Business / website name" ${editable?"":"disabled"}></div>${editable?`<button class="btn primary" data-action="save-website-project" data-id="${project.id}">Save Information</button>`:'<span class="status">View Only</span>'}</article>
  <div class="intake-accordion">${WEBSITE_INTAKE_SECTIONS.map((section,i)=>`<details class="intake-section glass" ${i===0?"open":""}><summary><div><span class="intake-number">${String(i+1).padStart(2,"0")}</span><strong>${esc(section.title.replace(/^\d+\.\s*/,""))}</strong></div><span class="intake-chevron">⌄</span></summary><div class="intake-body"><div class="intake-guide"><p>${esc(section.help)}</p><ul>${section.items.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div><div class="intake-response"><label>YOUR INFORMATION</label><textarea class="auto-grow intake-answer" data-intake-id="${section.id}" rows="8" placeholder="Type or paste your answer here…" ${editable?"":"disabled"}>${esc(intakeValue(intake,section.id))}</textarea></div></div></details>`).join("")}</div>
  <article class="card glass section-panel" style="margin-top:13px"><span class="section-label">MORE INFORMATION</span><h3>Additional Notes</h3><textarea id="websiteProjectNotes" class="auto-grow soft-textarea" rows="7" placeholder="Anything else we should know about this website…" ${editable?"":"disabled"}>${esc(project.website_notes||"")}</textarea>${editable?`<div class="card-actions start"><button class="btn primary" data-action="save-website-project" data-id="${project.id}">Save Information</button></div>`:""}</article>
  <article class="card glass website-assets-panel" style="margin-top:13px"><div class="section-head"><div><span class="section-label">PROJECT ASSET LIBRARY</span><h3>Files for this website</h3><p class="muted">Keep every logo, photo, document and reference attached to the correct website project.</p></div></div>${editable?`<div class="asset-upload-controls"><div class="field"><span>File Category</span><select id="websiteAssetCategory">${assetCategoryOptions("brand")}</select></div><label id="websiteAssetDrop" class="website-dropzone employer-upload-drop"><strong>＋ Upload to this Project</strong><span>Choose files or drag them here · up to 25 MB each</span><input id="websiteAssetInput" type="file" multiple hidden></label></div><div id="websiteAssetUploadStatus" class="upload-status muted">No upload in progress.</div>`:""}<div id="websiteProjectAssetsList" class="website-assets"><div class="empty"><strong>Loading project assets…</strong></div></div></article>
  <article class="card glass employer-project-readonly"><span class="section-label">PROJECT PRODUCTION</span><h3>Managed by Jeffdesign101</h3><p class="muted">Project status, website logo, staging/live link, screenshots, and showcase publishing are controlled by the Admin. When a preview is published, it will appear in the View Website Project page.</p></article>
  ${editable?`<footer class="project-save-footer glass employer-project-save-footer" aria-label="Save website project"><div><span class="section-label">SAVE YOUR CHANGES</span><strong>Finished updating this website?</strong><p class="muted">Save the site name, intake answers, and additional notes before leaving this page.</p></div><button class="btn primary project-footer-save" data-action="save-website-project" data-id="${project.id}">Save Website Information</button></footer>`:""}`;
  setupAutoGrow($("view"));
  loadEmployerProjectAssets(project,editable);
  if(editable)setupWebsiteProjectDropzone(project.id);
  startShowcaseCarousels();
}
async function saveWebsiteProject(projectId){const c=currentClient();if(!c||c.portal_permission==="view")return toast("This portal is View Only");const website_intake={};$$('[data-intake-id]').forEach(el=>website_intake[el.dataset.intakeId]=el.value.trim());const payload={website_name:$("websiteProjectName")?.value.trim()||"Untitled Website",website_intake,website_notes:$("websiteProjectNotes")?.value.trim()||"",updated_at:new Date().toISOString()};const buttons=$$(`[data-action="save-website-project"][data-id="${projectId}"]`);buttons.forEach(b=>setBusy(b,true,"Saving…"));try{const {data,error}=await state.sb.from("website_projects").update(payload).eq("id",projectId).eq("client_id",c.id).select("id,website_name,updated_at").maybeSingle();if(error)throw error;if(!data)throw new Error("Your project information could not be saved. Please refresh and try again.");toast("Website information saved");state.activeWebsiteProject=projectId;state.activeWebsiteProjectMode="intake";renderEmployer("website")}catch(e){toast(e.message||"Could not save website information")}finally{buttons.forEach(b=>setBusy(b,false))}}
async function listWebsiteProjectAssets(clientId,projectId){
  if(!clientId||!projectId)return[];
  const {data,error}=await state.sb.from("website_project_assets").select("id,client_id,project_id,storage_path,file_name,category,mime_type,size_bytes,uploaded_by_role,created_at").eq("client_id",clientId).eq("project_id",projectId).order("created_at",{ascending:false});
  if(error){console.warn("Asset metadata load failed",error);return[]}
  return data||[];
}
async function listLegacyWebsiteAssets(clientId){if(!clientId)return[];const {data,error}=await state.sb.storage.from("client-files").list(`${clientId}/website-assets`,{limit:100,sortBy:{column:"created_at",order:"desc"}});if(error){console.warn(error);return[]}return(data||[]).filter(x=>x.name!==".emptyFolderPlaceholder")}
function isPreviewImageAsset(f){const t=String(f?.mime_type||"").toLowerCase(),n=String(f?.file_name||"").toLowerCase();return t.startsWith("image/")||/\.(png|jpe?g|webp|gif|svg|avif|heic|heif)$/i.test(n)}
function isPreviewPdfAsset(f){const t=String(f?.mime_type||"").toLowerCase(),n=String(f?.file_name||"").toLowerCase();return t==="application/pdf"||/\.pdf$/i.test(n)}
function assetLibraryHtml(files,editable=false){
  if(!files.length)return '<div class="empty website-assets-empty"><strong>No project assets yet</strong><span>Upload files and choose a category so both sides can find them quickly.</span></div>';
  return `<div class="asset-category-stack">${ASSET_CATEGORIES.map(cat=>{const items=files.filter(f=>(f.category||"other")===cat.id);if(!items.length)return"";return `<section class="asset-category-group"><div class="asset-category-head"><div><span class="section-label">${esc(cat.label)}</span><strong>${items.length} file${items.length===1?"":"s"}</strong></div></div><div class="file-grid asset-preview-grid">${items.map(f=>`<div class="file-card asset-file-card asset-preview-card">${isPreviewImageAsset(f)?`<button class="asset-preview-media image" data-action="open-file" data-path="${esc(f.storage_path)}"><img data-asset-preview-path="${esc(f.storage_path)}" alt="Preview of ${esc(f.file_name||"uploaded image")}"><span class="asset-preview-loading">Loading preview…</span></button>`:isPreviewPdfAsset(f)?`<button class="asset-preview-media pdf" data-action="open-file" data-path="${esc(f.storage_path)}"><iframe data-asset-preview-path="${esc(f.storage_path)}" title="PDF preview" tabindex="-1"></iframe><span class="asset-preview-badge">PDF Preview</span></button>`:`<div class="asset-preview-media generic"><div class="asset-file-icon">${cat.id==="brand"?"◈":cat.id==="photos"?"▧":cat.id==="documents"?"▤":"◆"}</div><span>${esc((f.file_name||"FILE").split('.').pop()?.toUpperCase()||"FILE")}</span></div>`}<div class="asset-file-copy"><strong>${esc(f.file_name||"File")}</strong><small class="muted">${humanSize(f.size_bytes||0)} · ${esc(f.uploaded_by_role==="admin"?"Admin":"Employer")}</small></div><div class="row-actions"><button class="mini-btn" data-action="open-file" data-path="${esc(f.storage_path)}">View</button>${editable?`<button class="mini-btn danger" data-action="delete-project-asset" data-id="${f.id}" data-path="${esc(f.storage_path)}" data-project-id="${f.project_id}">Delete</button>`:""}</div></div>`).join("")}</div></section>`}).join("")}</div>`;
}
async function hydrateAssetPreviews(root=document){
  const nodes=[...root.querySelectorAll('[data-asset-preview-path]:not([data-preview-ready])')];
  await Promise.all(nodes.map(async el=>{el.dataset.previewReady="1";const url=await signedFileUrl(el.dataset.assetPreviewPath,900);if(!url)return;el.src=url;el.closest('.asset-preview-media')?.classList.add('preview-ready')}));
}
function websiteProjectAssetListHtml(files,c,project,editable){return assetLibraryHtml(files,editable)}
function websiteProjectAssetAdminListHtml(files,c,project){return assetLibraryHtml(files,false)}
function legacyWebsiteAssetAdminListHtml(files,c){return `<div class="file-grid website-assets">${files.map(f=>{const path=`${c.id}/website-assets/${f.name}`;return`<div class="file-card"><div><strong>${esc(f.name)}</strong><small class="muted">${humanSize(f.metadata?.size||0)} · Legacy file</small></div><div class="row-actions"><button class="mini-btn" data-action="open-file" data-path="${esc(path)}">Open</button></div></div>`}).join("")}</div>`}
async function loadEmployerProjectAssets(project,editable){const c=currentClient(),box=$("websiteProjectAssetsList");if(!c||!project||!box)return;const files=await listWebsiteProjectAssets(c.id,project.id);if(!box.isConnected)return;box.innerHTML=assetLibraryHtml(files,editable);await hydrateAssetPreviews(box)}
async function uploadWebsiteProjectAssets(files,projectId){
  const c=currentClient(),status=$("websiteAssetUploadStatus"),input=$("websiteAssetInput"),category=$("websiteAssetCategory")?.value||"other";
  if(!c||!files?.length||!projectId)return;const maxBytes=25*1024*1024;
  if(status){status.textContent=`Uploading ${files.length} file${files.length===1?"":"s"} to ${assetCategoryLabel(category)}…`;status.classList.remove("upload-error","upload-success")}
  const uploaded=[];
  try{
    for(const f of files){
      if(f.size>maxBytes)throw new Error(`${f.name} exceeds the 25 MB limit`);
      const filename=`${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safeFileName(f.name)}`;
      const path=`${c.id}/website-projects/${projectId}/assets/${category}/${filename}`;
      const {error:storageError}=await state.sb.storage.from("client-files").upload(path,f,{upsert:false,contentType:f.type||undefined});
      if(storageError)throw storageError;uploaded.push(path);
      const {error:metaError}=await state.sb.from("website_project_assets").insert({client_id:c.id,project_id:projectId,storage_path:path,file_name:f.name||filename,category,mime_type:f.type||"",size_bytes:Number(f.size||0),uploaded_by:state.session.user.id,uploaded_by_role:roleIsAdmin()?"admin":"employer"});
      if(metaError){await state.sb.storage.from("client-files").remove([path]);throw metaError}
    }
    if(status){status.textContent=`Uploaded ${files.length} file${files.length===1?"":"s"} to ${assetCategoryLabel(category)}.`;status.classList.add("upload-success")}
    toast("Project assets uploaded");const project=await getWebsiteProject(projectId);if(project)await loadEmployerProjectAssets(project,true);
  }catch(error){
    console.error("Project asset upload failed",error);
    const raw=error?.message||"Upload failed";const friendly=/row-level security|violates.*policy/i.test(raw)?"Upload blocked by project storage permissions. Run the v2.18 Project Asset Library migration in Supabase, then retry.":raw;
    if(status){status.textContent=friendly;status.classList.add("upload-error")}toast(friendly);
  }finally{if(input)input.value=""}
}
async function deleteWebsiteProjectAsset(assetId,path,projectId){
  if(!confirm("Delete this project asset?"))return;
  const {error:storageError}=await state.sb.storage.from("client-files").remove([path]);if(storageError)return toast(storageError.message);
  if(assetId){const {error:metaError}=await state.sb.from("website_project_assets").delete().eq("id",assetId);if(metaError)return toast(metaError.message)}
  toast("Asset deleted");if(roleIsAdmin()){const project=await getWebsiteProject(projectId);if(project)await renderAdminWebsiteProject(project.client_id,projectId)}else{const project=await getWebsiteProject(projectId);if(project)await loadEmployerProjectAssets(project,true)}
}
function setupWebsiteProjectDropzone(projectId){const zone=$("websiteAssetDrop"),input=$("websiteAssetInput");if(!zone||!input)return;["dragenter","dragover"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.add("dragging")}));["dragleave","drop"].forEach(ev=>zone.addEventListener(ev,e=>{e.preventDefault();zone.classList.remove("dragging")}));zone.addEventListener("drop",e=>{const files=[...(e.dataTransfer?.files||[])];if(files.length)uploadWebsiteProjectAssets(files,projectId)});input.addEventListener("change",()=>{const files=[...(input.files||[])];if(files.length)uploadWebsiteProjectAssets(files,projectId)})}

async function copyProjectIntake(clientId,projectId){const c=state.clients.find(x=>x.id===clientId);if(!c)return;const [project,assets]=await Promise.all([getWebsiteProject(projectId),listWebsiteProjectAssets(clientId,projectId)]);if(!project)return toast("Project not found");await copyText(websiteIntakeText(c,project,assets),"Full website intake copied")}



async function listWebsiteProjectEvents(clientId=null,projectId=null,limit=100){
  let q=state.sb.from("website_project_events").select("id,client_id,project_id,actor_id,actor_role,event_type,title,details,metadata,created_at").order("created_at",{ascending:false}).limit(limit);
  if(clientId)q=q.eq("client_id",clientId);if(projectId)q=q.eq("project_id",projectId);
  const {data,error}=await q;if(error){console.warn("Project activity unavailable",error);return[]}return data||[];
}
function projectEventIcon(type){return({project_created:"＋",project_baseline:"◆",status_changed:"↗",intake_updated:"✎",asset_uploaded:"⇧",asset_deleted:"−",logo_updated:"◈",gallery_updated:"▧",preview_updated:"↗",showcase_published:"●",showcase_unpublished:"○"})[type]||"•"}
function projectEventHtml(event,compact=false){
  const project=(state._websiteProjects||[]).find(p=>p.id===event.project_id),client=state.clients.find(c=>c.id===event.client_id);
  return `<div class="project-event ${compact?"compact":""}"><div class="project-event-icon">${projectEventIcon(event.event_type)}</div><div class="project-event-copy"><div class="project-event-title"><strong>${esc(event.title||"Project activity")}</strong><span>${fmtDate(event.created_at)} · ${fmtTime(event.created_at)}</span></div><p>${esc(event.details||"")}</p>${!compact?`<small>${esc(project?.website_name||"Website Project")} · ${esc(client?.name||"Employer")} · ${esc(event.actor_role||"system")}</small>`:""}</div></div>`;
}
function projectHealth(project){const missing=[];if(projectCompletion(project)<70)missing.push("Intake incomplete");if(!project.showcase_logo_path)missing.push("No logo");if(!String(project.showcase_url||"").trim())missing.push("No site link");if(!project.showcase_published)missing.push("Preview hidden");return missing}
function projectHealthHtml(project){const missing=projectHealth(project);return missing.length?`<div class="project-health warn"><strong>Needs attention</strong><span>${missing.map(esc).join(" · ")}</span></div>`:`<div class="project-health good"><strong>Ready</strong><span>Core production information is complete.</span></div>`}
async function renderAdminProjectActivity(){
  setPageTitle("Project Activity");const seq=state.navSeq;const [events,projectsResult]=await Promise.all([listWebsiteProjectEvents(null,null,150),state.sb.from("website_projects").select("id,client_id,website_name,status").order("updated_at",{ascending:false})]);if(seq!==state.navSeq)return;state._websiteProjects=projectsResult.data||[];
  const counts={status:events.filter(e=>e.event_type==="status_changed").length,uploads:events.filter(e=>e.event_type==="asset_uploaded").length,published:events.filter(e=>e.event_type==="showcase_published").length,intake:events.filter(e=>e.event_type==="intake_updated").length};
  $("view").innerHTML=`<section class="page-shell activity-center"><div class="page-head glass"><div><span class="section-label">PROJECT OPERATIONS</span><h1>Activity Center</h1><p class="muted">A chronological record of Employer intake changes, project status, files, logo/gallery updates, and published previews.</p></div></div><div class="visual-stats-grid">${metricVisual("↗","Status changes",counts.status,"Project lifecycle updates","lime")}${metricVisual("⇧","Asset uploads",counts.uploads,"Project source files","blue")}${metricVisual("●","Published",counts.published,"Employer previews","gold")}${metricVisual("✎","Intake updates",counts.intake,"Employer information","violet")}</div><article class="card glass"><div class="section-head"><div><span class="section-label">RECENT ACTIVITY</span><h3>Website project timeline</h3></div><span class="status">${events.length} events</span></div><div class="project-event-list">${events.length?events.map(e=>projectEventHtml(e)).join(""):'<div class="empty"><strong>No activity recorded yet</strong><span>Run the v2.19 SQL migration to enable project history.</span></div>'}</div></article></section>`;
}

async function renderAdminWebsiteProjects(){
  const seq=state.navSeq;setPageTitle("Website Projects");
  const {data,error}=await state.sb.from("website_projects").select("*").order("updated_at",{ascending:false});
  if(error){$("view").innerHTML=`<article class="card glass"><span class="section-label">WEBSITE PROJECTS</span><h3>Could not load projects</h3><p class="form-error">${esc(error.message)}</p></article>`;return}
  if(seq!==state.navSeq)return;
  const projects=data||[];state._websiteProjects=projects;const draft=projects.filter(p=>p.status==="draft").length,progress=projects.filter(p=>p.status==="in_progress").length,ready=projects.filter(p=>p.status==="ready").length,complete=projects.filter(p=>p.status==="complete").length;
  const rows=projects.map(p=>{const c=state.clients.find(x=>x.id===p.client_id);return `<article class="admin-website-list-card glass" data-project-status="${esc(p.status)}" data-project-search="${esc(`${p.website_name||""} ${c?.name||""} ${c?.company||""}`.toLowerCase())}"><div class="admin-website-list-main"><div><span class="section-label">${esc(c?.name||"EMPLOYER")}</span><h3>${esc(p.website_name||"Untitled Website")}</h3><p class="muted">${esc(c?.company||c?.name||"Employer")} · Updated ${fmtDate(p.updated_at)}</p></div><div class="admin-website-card-meta">${websiteProjectStatusPill(p.status)}${p.showcase_published?'<span class="status complete">Preview Live</span>':''}<span class="status">${projectCompletion(p)}% Intake</span></div></div><div class="project-progress-line"><i style="width:${projectCompletion(p)}%"></i></div>${projectHealthHtml(p)}<div class="admin-website-card-actions"><button class="btn primary" data-action="open-admin-website-project" data-id="${p.id}" data-client-id="${p.client_id}">Open Admin Workspace</button><button class="btn ghost" data-action="copy-project-intake" data-id="${p.id}" data-client-id="${p.client_id}">Copy Intake</button>${c?`<button class="mini-btn" data-action="client-detail" data-id="${c.id}">Employer</button>`:""}</div></article>`}).join("");
  $("view").innerHTML=`<section class="page-shell admin-websites-page"><div class="page-head"><div><span class="section-label">PRODUCTION CONTROL</span><h1>Website Projects</h1><p class="muted">Manage every Employer website from intake through launch in one place.</p></div></div><div class="visual-stats-grid admin-website-stats">${metricVisual("◌","Drafting",draft,"Waiting / planning","lime")}${metricVisual("↗","In Progress",progress,"Currently being built","blue")}${metricVisual("✓","Ready to Build",ready,"Intake ready","gold")}${metricVisual("◆","Completed",complete,"Delivered projects","violet")}</div><div class="project-filter-bar glass"><input id="websiteProjectSearch" placeholder="Search website or Employer…"><select id="websiteProjectStatusFilter"><option value="all">All statuses</option><option value="draft">Drafting</option><option value="in_progress">In Progress</option><option value="ready">Ready to Build</option><option value="complete">Completed</option></select><button class="btn ghost" data-admin-view="activity">Project Activity</button></div><div class="admin-website-list">${rows||'<article class="card glass empty-project-state"><strong>No website projects yet</strong><p class="muted">Employer-created projects will appear here automatically.</p></article>'}</div></section>`;
}

function filterAdminWebsiteCards(){const q=($("websiteProjectSearch")?.value||"").trim().toLowerCase(),status=$("websiteProjectStatusFilter")?.value||"all";$$('.admin-website-list-card').forEach(card=>{const matchText=!q||String(card.dataset.projectSearch||"").includes(q),matchStatus=status==="all"||card.dataset.projectStatus===status;card.classList.toggle("hidden",!(matchText&&matchStatus))})}

async function renderAdminWebsiteProject(clientId,projectId){
  setAppRoute(["admin","websites",clientId,projectId]);
  const seq=++state.navSeq,c=state.clients.find(x=>x.id===clientId);if(!c)return toast("Employer not found");state.activeClient=clientId;state.activeAdminWebsiteProject=projectId;setPageTitle("Website Project Admin");
  const project=await getWebsiteProject(projectId);if(!project||seq!==state.navSeq)return;const [assets,events]=await Promise.all([listWebsiteProjectAssets(clientId,projectId),listWebsiteProjectEvents(clientId,projectId,40)]);if(seq!==state.navSeq)return;state._websiteProjects=[project];const gallery=showcaseGalleryPaths(project),logoPaths=[project.showcase_logo_path,project.showcase_logo_dark_path].filter(Boolean),urls=await Promise.all([...logoPaths,...gallery].map(p=>signedFileUrl(p)));if(seq!==state.navSeq)return;let cursor=0;const logoUrl=project.showcase_logo_path?urls[cursor++]:"",darkLogoUrl=project.showcase_logo_dark_path?urls[cursor++]:"",galleryUrls=gallery.map(()=>urls[cursor++]).filter(Boolean);
  $("view").innerHTML=`<section class="page-shell admin-website-workspace"><div class="page-head"><div><button class="btn ghost" data-action="back-to-admin-websites">← Website Projects</button><span class="section-label">ADMIN WEBSITE WORKSPACE</span><h1>${esc(project.website_name||"Untitled Website")}</h1><p class="muted">You control production status, branding, website preview, screenshots, and what the Employer can see.</p></div><div class="page-head-actions"><button class="btn ghost" data-action="copy-project-intake" data-id="${project.id}" data-client-id="${c.id}">Copy Full Intake</button></div></div>
  <div class="admin-project-grid"><article class="card glass admin-production-panel"><span class="section-label">PRODUCTION CONTROL</span><h3>Status & website preview</h3><div class="field"><span>Site Name</span><input id="adminWebsiteProjectName" value="${esc(project.website_name||"")}"></div><div class="field"><span>Project Status</span><select id="adminWebsiteProjectStatus"><option value="draft" ${project.status==="draft"?"selected":""}>Drafting</option><option value="in_progress" ${project.status==="in_progress"?"selected":""}>In Progress</option><option value="ready" ${project.status==="ready"?"selected":""}>Ready to Build</option><option value="complete" ${project.status==="complete"?"selected":""}>Completed</option></select></div><div class="field"><span>Website / Staging Link</span><input id="adminShowcaseUrl" value="${esc(project.showcase_url||"")}" placeholder="https://..."></div><div class="field"><span>Employer Update / Preview Notes</span><textarea id="adminShowcaseNotes" rows="6" placeholder="Latest update the Employer should see…">${esc(project.showcase_notes||"")}</textarea></div><label class="admin-publish-toggle"><input id="adminShowcasePublished" type="checkbox" ${project.showcase_published?"checked":""}><span><strong>Show preview to Employer</strong><small>Employer can only view the published logo, link and screenshots.</small></span></label><button class="btn primary full" data-action="save-admin-website-project" data-id="${project.id}" data-client-id="${c.id}">Save Production Settings</button></article>
  <article class="card glass admin-branding-panel"><span class="section-label">BRANDING & GALLERY</span><h3>Logo variants and screenshots</h3><div class="admin-logo-stage"><div class="dual-logo-proof">${logoUrl?`<div class="logo-variant-card light"><div class="logo-proof-head"><div><span class="section-label">LIGHT BACKGROUND VARIANT</span><h4>Light-surface logo</h4></div><button class="mini-btn" data-action="open-showcase-image" data-url="${esc(logoUrl)}" data-mode="logo">Enlarge</button></div><button class="logo-variant-preview light" data-action="open-showcase-image" data-url="${esc(logoUrl)}" data-mode="logo"><img src="${esc(logoUrl)}" alt="Light background logo"></button></div>`:'<div class="logo-variant-card light empty-logo-variant"><strong>No light logo</strong><span>Upload the logo intended for white/light surfaces.</span></div>'}${darkLogoUrl?`<div class="logo-variant-card dark"><div class="logo-proof-head"><div><span class="section-label">DARK BACKGROUND VARIANT</span><h4>Dark-surface logo</h4></div><button class="mini-btn" data-action="open-showcase-image" data-url="${esc(darkLogoUrl)}" data-mode="logo">Enlarge</button></div><button class="logo-variant-preview dark" data-action="open-showcase-image" data-url="${esc(darkLogoUrl)}" data-mode="logo"><img src="${esc(darkLogoUrl)}" alt="Dark background logo"></button></div>`:'<div class="logo-variant-card dark empty-logo-variant"><strong>No dark logo</strong><span>Upload the logo intended for dark surfaces.</span></div>'}</div></div><div class="dual-logo-upload"><label class="website-dropzone"><strong>＋ Light Background Logo</strong><span>Primary logo for white/light surfaces</span><input id="adminShowcaseLogoInput" type="file" accept="image/*,.svg,.heic,.heif" hidden></label><label class="website-dropzone"><strong>＋ Dark Background Logo</strong><span>Alternate logo for dark surfaces</span><input id="adminShowcaseDarkLogoInput" type="file" accept="image/*,.svg,.heic,.heif" hidden></label></div><div id="adminLogoUploadStatus" class="upload-status muted">Choose a light or dark logo variant to upload.</div><label class="website-dropzone"><strong>＋ Add Project Screenshots</strong><span>Select multiple images for the Employer carousel</span><input id="adminShowcaseGalleryInput" type="file" multiple accept="image/*,.heic,.heif" hidden></label><div id="adminGalleryUploadStatus" class="upload-status muted">Choose one or more screenshots to upload.</div>${galleryUrls.length?showcaseCarouselHtml(galleryUrls,{admin:true,projectId:project.id}):'<div class="empty admin-gallery-empty"><strong>No screenshots yet</strong>The Employer carousel will appear after you upload screenshots and publish the preview.</div>'}</article></div>
  <article class="card glass admin-asset-library"><div class="section-head"><div><span class="section-label">PROJECT ASSET LIBRARY</span><h3>Source files by category</h3><p class="muted">Employer and Admin source files for this website project. Showcase screenshots remain separate above.</p></div><span class="status">${assets.length} files</span></div><div class="admin-asset-upload-row"><div class="field"><span>Upload Category</span><select id="adminProjectAssetCategory">${assetCategoryOptions("brand")}</select></div><label class="btn ghost admin-project-asset-upload">+ Add Source Files<input id="adminProjectAssetInput" type="file" multiple hidden></label><div id="adminProjectAssetStatus" class="upload-status muted">Optional: add source files to this project.</div></div>${assetLibraryHtml(assets,true)}</article>
  <article class="card glass project-health-panel"><div class="section-head"><div><span class="section-label">PROJECT HEALTH</span><h3>Production readiness</h3></div>${websiteProjectStatusPill(project.status)}</div>${projectHealthHtml(project)}</article><article class="card glass"><div class="section-head"><div><span class="section-label">PROJECT ACTIVITY</span><h3>Recent changes</h3><p class="muted">A shared timeline of intake, assets, status, and preview updates.</p></div><button class="mini-btn" data-admin-view="activity">Open Activity Center</button></div><div class="project-event-list">${events.length?events.slice(0,12).map(e=>projectEventHtml(e,true)).join(""):'<div class="empty"><strong>No timeline events yet</strong></div>'}</div></article><article class="card glass"><div class="section-head"><div><span class="section-label">EMPLOYER INTAKE</span><h3>Submitted website information</h3><p class="muted">Employer-editable information is displayed here for Admin review.</p></div>${websiteProjectStatusPill(project.status)}</div><div class="intake-admin-preview">${websiteIntakeAdminHtml(project)}</div></article><footer class="project-save-footer glass admin-project-save-footer" aria-label="Save production settings"><div><span class="section-label">PRODUCTION SETTINGS</span><strong>Save this project before leaving</strong><p class="muted">Applies the Site Name, status, staging/live URL, Employer update, and preview publishing setting above. Uploaded logos, screenshots, and source files are saved immediately when uploaded.</p></div><button class="btn primary project-footer-save" data-action="save-admin-website-project" data-id="${project.id}" data-client-id="${c.id}">Save Production Settings</button></footer></section>`;
  setupAutoGrow($("view"));
  setupAdminShowcaseUploads(clientId,projectId);
  setupAdminProjectAssetUpload(clientId,projectId);
  await hydrateAssetPreviews($("view"));
  startShowcaseCarousels();
}

async function uploadAdminProjectAssets(clientId,projectId,files){
  files=[...(files||[])];if(!files.length)return;const category=$("adminProjectAssetCategory")?.value||"other",status=$("adminProjectAssetStatus"),input=$("adminProjectAssetInput"),uploaded=[];
  if(status){status.textContent=`Uploading ${files.length} file${files.length===1?"":"s"} to ${assetCategoryLabel(category)}…`;status.className="upload-status uploading"}
  try{
    for(const f of files){
      if(f.size>25*1024*1024)throw new Error(`${f.name} exceeds the 25 MB limit`);
      const filename=`${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safeFileName(f.name)}`,path=`${clientId}/website-projects/${projectId}/assets/${category}/${filename}`;
      const {error:se}=await state.sb.storage.from("client-files").upload(path,f,{upsert:false,contentType:f.type||undefined});if(se)throw se;uploaded.push(path);
      const {error:me}=await state.sb.from("website_project_assets").insert({client_id:clientId,project_id:projectId,storage_path:path,file_name:f.name||filename,category,mime_type:f.type||"",size_bytes:Number(f.size||0),uploaded_by:state.session.user.id,uploaded_by_role:"admin"});
      if(me){await state.sb.storage.from("client-files").remove([path]);throw me}
    }
    toast("Project source files uploaded");await renderAdminWebsiteProject(clientId,projectId);
  }catch(e){console.error(e);if(status){status.textContent=e.message||"Upload failed";status.className="upload-status error"}toast(e.message||"Upload failed")}finally{if(input)input.value=""}
}
function setupAdminProjectAssetUpload(clientId,projectId){const input=$("adminProjectAssetInput");if(input)input.addEventListener("change",()=>uploadAdminProjectAssets(clientId,projectId,[...(input.files||[])]))}

function validShowcaseImage(file){
  if(!file)return false;
  const type=String(file.type||"").toLowerCase(),name=String(file.name||"").toLowerCase();
  return type.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg|heic|heif|avif)$/i.test(name);
}
function uploadStatus(id,msg,state=""){
  const el=$(id);if(!el)return;el.textContent=msg;el.classList.remove("uploading","success","error");if(state)el.classList.add(state);
}
async function uploadAdminLogoNow(clientId,projectId,file,variant="light"){
  if(!validShowcaseImage(file))return uploadStatus("adminLogoUploadStatus","Please choose an image file.","error");
  if(file.size>25*1024*1024)return uploadStatus("adminLogoUploadStatus",`${file.name} exceeds the 25 MB limit.`,"error");
  uploadStatus("adminLogoUploadStatus",`Uploading ${file.name}…`,"uploading");
  try{
    const project=await getWebsiteProject(projectId);if(!project)throw new Error("Project not found");
    const field=variant==="dark"?"showcase_logo_dark_path":"showcase_logo_path",kind=variant==="dark"?"logo-dark":"logo-light";
    const next=await uploadShowcaseFile(file,clientId,projectId,kind);
    const {error}=await state.sb.from("website_projects").update({[field]:next,showcase_updated_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",projectId).eq("client_id",clientId);
    if(error){await state.sb.storage.from("client-files").remove([next]);throw error}
    if(project[field]&&project[field]!==next)await state.sb.storage.from("client-files").remove([project[field]]);
    uploadStatus("adminLogoUploadStatus",`${variant==="dark"?"Dark":"Light"} logo uploaded successfully.`,"success");toast(`${variant==="dark"?"Dark":"Light"} logo uploaded`);
    await renderAdminWebsiteProject(clientId,projectId);
  }catch(e){console.error(e);uploadStatus("adminLogoUploadStatus",e.message||"Logo upload failed.","error");toast(e.message||"Logo upload failed")}
}
async function uploadAdminGalleryNow(clientId,projectId,files){
  files=[...(files||[])];if(!files.length)return;
  const bad=files.find(f=>!validShowcaseImage(f)||f.size>25*1024*1024);if(bad)return uploadStatus("adminGalleryUploadStatus",!validShowcaseImage(bad)?`${bad.name} is not a supported image.`:`${bad.name} exceeds the 25 MB limit.`,"error");
  uploadStatus("adminGalleryUploadStatus",`Uploading ${files.length} screenshot${files.length===1?"":"s"}…`,"uploading");
  const uploaded=[];
  try{
    const project=await getWebsiteProject(projectId);if(!project)throw new Error("Project not found");
    const gallery=showcaseGalleryPaths(project);
    for(let i=0;i<files.length;i++){
      uploadStatus("adminGalleryUploadStatus",`Uploading ${i+1} of ${files.length}: ${files[i].name}`,"uploading");
      const path=await uploadShowcaseFile(files[i],clientId,projectId,"gallery");uploaded.push(path);gallery.push(path);
    }
    const {error}=await state.sb.from("website_projects").update({showcase_gallery:gallery,showcase_updated_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",projectId).eq("client_id",clientId);
    if(error){if(uploaded.length)await state.sb.storage.from("client-files").remove(uploaded);throw error}
    uploadStatus("adminGalleryUploadStatus",`${files.length} screenshot${files.length===1?"":"s"} uploaded successfully.`,"success");toast("Screenshots uploaded");
    await renderAdminWebsiteProject(clientId,projectId);
  }catch(e){console.error(e);uploadStatus("adminGalleryUploadStatus",e.message||"Screenshot upload failed.","error");toast(e.message||"Screenshot upload failed")}
}
function setupAdminShowcaseUploads(clientId,projectId){
  const logo=$("adminShowcaseLogoInput"),darkLogo=$("adminShowcaseDarkLogoInput"),gallery=$("adminShowcaseGalleryInput");
  if(logo)logo.addEventListener("change",async()=>{const file=logo.files?.[0];logo.value="";if(file)await uploadAdminLogoNow(clientId,projectId,file,"light")});
  if(darkLogo)darkLogo.addEventListener("change",async()=>{const file=darkLogo.files?.[0];darkLogo.value="";if(file)await uploadAdminLogoNow(clientId,projectId,file,"dark")});
  if(gallery)gallery.addEventListener("change",async()=>{const files=[...(gallery.files||[])];gallery.value="";if(files.length)await uploadAdminGalleryNow(clientId,projectId,files)});
}
async function saveAdminWebsiteProject(clientId,projectId){
  const project=await getWebsiteProject(projectId);if(!project)return toast("Project not found");
  const buttons=$$(`[data-action="save-admin-website-project"][data-id="${projectId}"]`);buttons.forEach(btn=>setBusy(btn,true,"Saving…"));
  try{
    const payload={website_name:$("adminWebsiteProjectName")?.value.trim()||project.website_name,status:$("adminWebsiteProjectStatus")?.value||"draft",showcase_url:$("adminShowcaseUrl")?.value.trim()||"",showcase_notes:$("adminShowcaseNotes")?.value.trim()||"",showcase_published:!!$("adminShowcasePublished")?.checked,showcase_updated_at:new Date().toISOString(),updated_at:new Date().toISOString()};
    const {error}=await state.sb.from("website_projects").update(payload).eq("id",projectId).eq("client_id",clientId);if(error)throw error;
    toast("Production settings saved");await renderAdminWebsiteProject(clientId,projectId);
  }catch(e){toast(e.message||"Could not save project settings")}finally{buttons.forEach(btn=>setBusy(btn,false))}
}
async function signedFileUrl(path,ttl=900){
  if(!path)return"";const {data,error}=await state.sb.storage.from("client-files").createSignedUrl(path,ttl);if(error){console.warn(error);return""}return data?.signedUrl||"";
}
function showcaseGalleryPaths(project){return Array.isArray(project?.showcase_gallery)?project.showcase_gallery.filter(Boolean):[]}
async function buildShowcaseView(project){
  if(!project?.showcase_published)return"";
  const gallery=showcaseGalleryPaths(project),paths=[project.showcase_logo_path,project.showcase_logo_dark_path,...gallery].filter(Boolean);
  const urls=await Promise.all(paths.map(p=>signedFileUrl(p)));
  let cursor=0,logoUrl=project.showcase_logo_path?urls[cursor++]:"",darkLogoUrl=project.showcase_logo_dark_path?urls[cursor++]:"";const galleryUrls=gallery.map(()=>urls[cursor++]).filter(Boolean);
  const site=project.showcase_url?websiteHref(project.showcase_url):"#";
  return `<section class="project-showcase glass"><div class="showcase-top"><div><span class="section-label">ONGOING WEBSITE PREVIEW</span><h2>${esc(project.website_name||"Website Project")}</h2><p class="muted">${esc(project.showcase_notes||"Preview the latest design direction and website progress below.")}</p>${site!=="#"?`<a class="btn primary showcase-site-link" href="${esc(site)}" target="_blank" rel="noopener">Open Website ↗</a>`:""}</div>${logoUrl||darkLogoUrl?`<div class="showcase-logo-proof"><div class="logo-proof-head"><div><span class="section-label">APPROVED BRAND MARKS</span><h3>Website Logo Variants</h3></div></div><div class="logo-proof-grid">${logoUrl?`<button class="logo-proof-panel light" data-action="open-showcase-image" data-url="${esc(logoUrl)}" data-mode="logo"><span>Light Background</span><img src="${esc(logoUrl)}" alt="${esc(project.website_name||"Website")} light-background logo"></button>`:""}${darkLogoUrl?`<button class="logo-proof-panel dark" data-action="open-showcase-image" data-url="${esc(darkLogoUrl)}" data-mode="logo"><span>Dark Background</span><img src="${esc(darkLogoUrl)}" alt="${esc(project.website_name||"Website")} dark-background logo"></button>`:""}</div></div>`:""}</div>${galleryUrls.length?`<div class="showcase-gallery-head"><div><span class="section-label">LATEST SCREENSHOTS</span><h3>Website Gallery</h3></div><span class="muted">Swipe, use arrows, or tap to enlarge</span></div>${showcaseCarouselHtml(galleryUrls,{admin:false})}`:""}</section>`;
}
function showcaseCarouselHtml(urls,{admin=false,projectId=""}={}){
  const total=urls.length;
  return `<div class="showcase-carousel ${admin?"admin-showcase-carousel":"employer-showcase-carousel"}" data-showcase-carousel data-autoplay="true" tabindex="0" aria-label="Website screenshots carousel">
    <div class="showcase-viewport"><div class="showcase-track">${urls.map((url,i)=>`<div class="showcase-slide" data-slide-index="${i}"><button class="showcase-slide-open" data-action="open-showcase-image" data-url="${esc(url)}" data-mode="screenshot" aria-label="Open screenshot ${i+1}"><img src="${esc(url)}" alt="Website screenshot ${i+1}" loading="lazy"></button>${admin?`<button class="carousel-remove-btn" data-action="remove-showcase-image" data-id="${projectId}" data-index="${i}" data-return="admin-workspace" aria-label="Remove screenshot ${i+1}">Remove</button>`:""}<span class="carousel-slide-number">${String(i+1).padStart(2,"0")}</span></div>`).join("")}</div>
      ${total>1?`<button type="button" class="carousel-arrow prev" data-carousel-prev aria-label="Previous screenshot">‹</button><button type="button" class="carousel-arrow next" data-carousel-next aria-label="Next screenshot">›</button>`:""}
    </div>
    <div class="carousel-control-bar"><div class="carousel-counter"><strong data-carousel-current>1</strong><span>/ ${total}</span></div><div class="showcase-dots">${urls.map((_,i)=>`<button type="button" class="${i===0?"active":""}" data-carousel-dot="${i}" aria-label="Go to screenshot ${i+1}"></button>`).join("")}</div><button class="carousel-play-toggle" type="button" data-carousel-toggle aria-label="Pause carousel">Pause</button></div>
    ${total>1?`<div class="carousel-thumb-rail" aria-label="Screenshot thumbnails">${urls.map((url,i)=>`<button type="button" class="carousel-thumb ${i===0?"active":""}" data-carousel-thumb="${i}" aria-label="Show screenshot ${i+1}"><img src="${esc(url)}" alt="" loading="lazy"></button>`).join("")}</div>`:""}
  </div>`;
}
function startShowcaseCarousels(){
  $$('[data-showcase-carousel]').forEach(car=>{
    if(car._cleanup)car._cleanup();
    const track=car.querySelector('.showcase-track'),slides=[...car.querySelectorAll('.showcase-slide')],dots=[...car.querySelectorAll('[data-carousel-dot]')],thumbs=[...car.querySelectorAll('[data-carousel-thumb]')],counter=car.querySelector('[data-carousel-current]'),toggle=car.querySelector('[data-carousel-toggle]');
    if(!track||!slides.length)return;
    let i=0,timer=null,paused=false,startX=0,dragX=0,dragging=false,suppressClick=false,inView=true;
    const reduce=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    const go=(n,animate=true)=>{
      i=(n+slides.length)%slides.length;
      track.style.transition=animate&&!reduce?'transform .62s cubic-bezier(.2,.8,.2,1)':'none';
      track.style.transform=`translate3d(-${i*100}%,0,0)`;
      dots.forEach((d,x)=>{const active=x===i;d.classList.toggle('active',active);d.setAttribute('aria-current',active?'true':'false')});
      thumbs.forEach((t,x)=>{const active=x===i;t.classList.toggle('active',active);t.setAttribute('aria-current',active?'true':'false')});
      if(counter)counter.textContent=String(i+1);
    };
    const stop=()=>{if(timer){clearInterval(timer);timer=null}};
    const start=()=>{stop();if(slides.length<2||paused||reduce||document.hidden||!inView)return;timer=setInterval(()=>go(i+1),4300)};
    const setPaused=v=>{paused=v;stop();if(toggle){toggle.textContent=paused?'Play':'Pause';toggle.setAttribute('aria-label',paused?'Play carousel':'Pause carousel')}if(!paused)start()};
    const onClick=e=>{
      const prev=e.target.closest('[data-carousel-prev]'),next=e.target.closest('[data-carousel-next]'),dot=e.target.closest('[data-carousel-dot]'),thumb=e.target.closest('[data-carousel-thumb]'),play=e.target.closest('[data-carousel-toggle]');
      if(!(prev||next||dot||thumb||play))return;
      e.preventDefault();e.stopPropagation();
      if(prev)go(i-1);
      else if(next)go(i+1);
      else if(dot)go(Number(dot.dataset.carouselDot));
      else if(thumb)go(Number(thumb.dataset.carouselThumb));
      else if(play){setPaused(!paused);return}
      start();
    };
    const stopControlPointer=e=>{if(e.target.closest('[data-carousel-prev],[data-carousel-next],[data-carousel-dot],[data-carousel-thumb],[data-carousel-toggle]'))e.stopPropagation()};
    car.addEventListener('click',onClick);
    car.addEventListener('pointerdown',stopControlPointer,true);
    car.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();go(i-1);start()}else if(e.key==='ArrowRight'){e.preventDefault();go(i+1);start()}});
    const vp=car.querySelector('.showcase-viewport');
    const down=e=>{if(slides.length<2||e.target.closest('button,a,input,select,textarea,label'))return;dragging=true;startX=e.clientX;dragX=0;stop();vp?.setPointerCapture?.(e.pointerId);car.classList.add('is-dragging')};
    const move=e=>{if(!dragging)return;dragX=e.clientX-startX;const pct=(dragX/(vp?.clientWidth||1))*100;track.style.transition='none';track.style.transform=`translate3d(calc(-${i*100}% + ${pct}%),0,0)`};
    const up=e=>{if(!dragging)return;dragging=false;car.classList.remove('is-dragging');const threshold=Math.min(90,(vp?.clientWidth||400)*.16);if(Math.abs(dragX)>threshold){suppressClick=true;go(i+(dragX<0?1:-1));setTimeout(()=>{suppressClick=false},100)}else go(i);start()};
    vp?.addEventListener('pointerdown',down);vp?.addEventListener('pointermove',move);vp?.addEventListener('pointerup',up);vp?.addEventListener('pointercancel',up);vp?.addEventListener('click',e=>{if(suppressClick){e.preventDefault();e.stopPropagation()}},true);
    car.addEventListener('mouseenter',stop);car.addEventListener('mouseleave',start);
    const vis=()=>{if(document.hidden)stop();else start()};document.addEventListener('visibilitychange',vis);
    let observer=null;
    if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{const entry=entries[0];inView=!!entry?.isIntersecting&&entry.intersectionRatio>=.25;if(inView)start();else stop()},{threshold:[0,.25,.5]});observer.observe(car)}
    car._cleanup=()=>{stop();document.removeEventListener('visibilitychange',vis);car.removeEventListener('click',onClick);car.removeEventListener('pointerdown',stopControlPointer,true);observer?.disconnect()};
    go(0,false);start();
  })
}
async function uploadShowcaseFile(file,clientId,projectId,kind){
  if(!file)return"";if(!validShowcaseImage(file))throw new Error("Showcase files must be images");if(file.size>25*1024*1024)throw new Error(`${file.name} exceeds the 25 MB limit`);const safe=file.name.replace(/[^\w.\- ]+/g,"_");const path=`${clientId}/website-projects/${projectId}/showcase/${kind}/${Date.now()}-${crypto.randomUUID().slice(0,8)}-${safe}`;const options={upsert:false};if(file.type)options.contentType=file.type;const {error}=await state.sb.storage.from("client-files").upload(path,file,options);if(error)throw error;return path;
}
async function removeShowcaseImage(projectId,index,returnMode="admin-workspace"){const p=await getWebsiteProject(projectId);if(!p)return;const gallery=showcaseGalleryPaths(p),path=gallery[index];if(!path)return;const {error:se}=await state.sb.storage.from("client-files").remove([path]);if(se)return toast(se.message);gallery.splice(index,1);const {error}=await state.sb.from("website_projects").update({showcase_gallery:gallery,showcase_updated_at:new Date().toISOString()}).eq("id",projectId);if(error)return toast(error.message);await renderAdminWebsiteProject(p.client_id,projectId)}
function openShowcaseLightbox(url,mode="screenshot"){$("showcaseLightboxImage").src=url;$("showcaseLightbox").classList.remove("hidden");$("showcaseLightbox").classList.toggle("logo-mode",mode==="logo");$("showcaseBgControls").classList.toggle("hidden",mode!=="logo");setShowcaseLogoBg("light")}
function setShowcaseLogoBg(mode){const stage=$("showcaseLightboxStage");if(!stage)return;stage.classList.toggle("dark-logo-bg",mode==="dark");stage.classList.toggle("light-logo-bg",mode!=="dark");$$('[data-showcase-bg]').forEach(b=>b.classList.toggle('active',b.dataset.showcaseBg===mode))}

function renderEmployerTasks(){
  setPageTitle("Tasks");const c=currentClient(),list=state.tasks.filter(t=>t.client_id===c?.id),editable=c?.portal_permission!=="view";
  $("view").innerHTML=`<div class="grid2">${editable?`<article class="card glass"><span class="section-label">NEW REQUEST</span><h3>Send a task</h3>${taskComposerHtml("tasks")}</article>`:""}<article class="card glass"><span class="section-label">TASK STATUS</span><h3>${list.filter(t=>!t.done).length} open · ${list.filter(t=>t.done).length} completed</h3></article></div><article class="card glass" style="margin-top:13px"><span class="section-label">TASK HISTORY</span><h3>All requests</h3>${taskListHtml(list,false,true)}</article>`;setupRichEditors()
}
async function renderEmployerFiles(){
  const seq=state.navSeq;setPageTitle("Files");const c=currentClient();if(!c)return;
  const [projects,legacy]=await Promise.all([listWebsiteProjects(c.id),listFiles(c.id)]);if(seq!==state.navSeq)return;
  const bundles=await Promise.all(projects.map(async p=>({project:p,assets:await listWebsiteProjectAssets(c.id,p.id)})));if(seq!==state.navSeq)return;
  $("view").innerHTML=`<section class="page-shell"><div class="page-head glass"><div><span class="section-label">FILE LIBRARY</span><h1>Website Project Assets</h1><p class="muted">Files are organized by website project and category. Upload new website materials from the project's Update Intake page so nothing becomes orphaned.</p></div><div class="page-head-actions"><button class="btn primary" data-employer-view="website">Website Projects</button></div></div>${bundles.map(({project,assets})=>`<article class="card glass asset-library-project"><div class="section-head"><div><span class="section-label">${esc(websiteProjectStatusLabel(project.status))}</span><h3>${esc(project.website_name||"Untitled Website")}</h3></div><button class="mini-btn" data-action="open-website-project" data-id="${project.id}">Update Intake & Upload</button></div>${assetLibraryHtml(assets,false)}</article>`).join("")||'<article class="card glass empty"><strong>No website projects yet</strong></article>'}${legacy.length?`<article class="card glass"><span class="section-label">LEGACY SHARED FILES</span><h3>Files from older versions</h3><p class="muted">These are preserved for compatibility. New website files should be uploaded inside a Website Project.</p>${fileListHtml(legacy,c,false)}</article>`:""}</section>`;  await hydrateAssetPreviews($("view"));
}
function renderEmployerWork(){
  setPageTitle("Work Monitor");const c=currentClient(),list=state.time.filter(e=>e.client_id===c?.id),active=list.find(e=>!e.clock_out);
  $("view").innerHTML=`<article class="card glass"><span class="section-label">VA WORK STATUS</span><h3>${active?"Working now":"Signed out / Not working"}</h3><div class="timer-big" id="employerTimer">00:00:00</div><p class="muted">${active?`Current task: ${esc(active.task||"General work")} · started ${fmtTime(active.clock_in)}`:"No active session."}</p></article><div class="grid3" style="margin-top:13px"><div class="stat glass"><span>Today</span><strong>${dur(sumHours(list,todayStart()))}</strong></div><div class="stat glass"><span>This week</span><strong>${dur(sumHours(list,weekStart()))}</strong></div><div class="stat glass"><span>This month</span><strong>${dur(sumHours(list,monthStart()))}</strong></div></div><article class="card glass" style="margin-top:13px"><span class="section-label">WORK HISTORY</span><h3>Recent sessions</h3><div class="table-list">${list.slice(0,30).map(e=>`<div class="row-card"><div><strong>${esc(e.task||"General work")}</strong><small>${fmtDate(e.clock_in)}</small></div><div><strong>${fmtTime(e.clock_in)}${e.clock_out?" → "+fmtTime(e.clock_out):" → now"}</strong></div><div><strong>${dur(hoursOf(e))}</strong></div><div>${e.clock_out?'<span class="status complete">Completed</span>':'<span class="status">Working now</span>'}</div></div>`).join("")}</div></article>`;startTicker()
}
function renderEmployerInvoices(){setPageTitle("Invoices");const c=currentClient(),list=state.invoices.filter(i=>i.client_id===c?.id);$("view").innerHTML=`<div class="stats"><div class="stat glass"><span>Incoming</span><strong>${list.filter(i=>i.status==="pending").length}</strong></div><div class="stat glass"><span>Paid</span><strong>${list.filter(i=>i.status==="paid").length}</strong></div><div class="stat glass"><span>Amount due</span><strong>${money(list.filter(i=>i.status==="pending").reduce((s,i)=>s+Number(i.total||0),0))}</strong></div><div class="stat glass"><span>Total paid</span><strong>${money(list.filter(i=>i.status==="paid").reduce((s,i)=>s+Number(i.total||0),0))}</strong></div></div><article class="card glass" style="margin-top:13px"><span class="section-label">BILLING HISTORY</span><h3>Invoices</h3>${invoiceRows(list,false)}</article>`}
function renderEmployerAccount(){setPageTitle("Account");const c=currentClient();$("view").innerHTML=`<article class="card glass" style="max-width:720px;margin:auto"><span class="section-label">ACCOUNT</span><h3>Employer Login</h3><div class="info-grid"><div class="info"><span>Username</span><strong>${esc(c?.client_username||"—")}</strong></div><div class="info"><span>Access</span><strong>${c?.portal_permission==="view"?"View Only":"Can Edit"}</strong></div></div><div class="field"><span>New password</span><input id="newEmployerPassword" type="password" minlength="8"></div><button class="btn primary" data-action="change-password" style="margin-top:12px">Change Password</button></article>`}

function taskComposerHtml(prefix){return`<div class="field"><span>Task title</span><div class="rich-wrap rich-title-wrap"><div class="rich-tools compact">${[["bold","B"],["italic","I"],["underline","U"],["removeFormat","Tx"]].map(([c,l])=>`<button type="button" class="mini-btn" data-rich-cmd="${c}" data-editor="${prefix}TaskTitle">${l}</button>`).join("")}</div><div id="${prefix}TaskTitle" class="rich-editor rich-title-editor" contenteditable="true" data-inline-rich="1" data-placeholder="Task title…"></div></div></div><div class="field"><span>Instructions</span><div class="rich-wrap"><div class="rich-tools">${[["bold","B"],["italic","I"],["underline","U"],["backColor","HL"],["insertUnorderedList","• List"],["insertOrderedList","1."],["createLink","Link"],["removeFormat","Tx"]].map(([c,l])=>`<button type="button" class="mini-btn" data-rich-cmd="${c}" data-editor="${prefix}TaskDetails">${l}</button>`).join("")}</div><div id="${prefix}TaskDetails" class="rich-editor" contenteditable="true" data-placeholder="Detailed instructions, checklist, links, copy, design requirements..."></div></div></div><div class="form-grid"><div class="field"><span>Priority</span><select id="${prefix}TaskPriority"><option>Normal</option><option>High</option><option>Urgent</option><option>Low</option></select></div><div class="field"><span>Due date</span><input id="${prefix}TaskDue" type="date"></div></div><button class="btn primary full" data-action="send-task" data-prefix="${prefix}" style="margin-top:11px">+ Send Request</button>`}
function taskListHtml(list,admin=false,editable=false){return list.length?list.map(t=>`<div class="task-card"><div class="task-top"><div style="min-width:0"><h4 class="task-title rich-task-title">${richTitleHtml(t.task)}</h4><div id="preview-${t.id}" class="task-preview">${sanitizeRich(t.details||"No additional details.")}</div><button class="mini-btn" data-action="toggle-preview" data-id="${t.id}" style="margin-top:7px">See more</button></div>${t.done?'<span class="status complete">Completed</span>':'<span class="status">Open</span>'}</div><div class="meta"><b>${esc(t.priority||"Normal")}</b>${t.due_date?`<b>Due ${fmtDate(t.due_date)}</b>`:""}</div><div class="row-actions" style="margin-top:9px">${admin?`<button class="mini-btn" data-action="view-task" data-id="${t.id}">Open</button><button class="mini-btn" data-action="toggle-task" data-id="${t.id}">${t.done?"Reopen":"Mark Done"}</button>`:editable?`<button class="mini-btn" data-action="edit-employer-task" data-id="${t.id}">Edit</button><button class="mini-btn danger" data-action="delete-employer-task" data-id="${t.id}">Delete</button>`:""}</div></div>`).join(""):'<div class="empty"><strong>No tasks yet</strong></div>'}

function richToolbarHtml(editorId){
  const tools=[["bold","B"],["italic","I"],["underline","U"],["formatBlock:h3","H3"],["insertUnorderedList","• List"],["insertOrderedList","1. List"],["createLink","Link"],["removeFormat","Clear"]];
  return tools.map(([c,l])=>`<button type="button" class="mini-btn rich-tool-btn" data-rich-cmd="${c}" data-editor="${editorId}" title="${esc(l)}">${esc(l)}</button>`).join("");
}
function officeEditorHtml(id,value,placeholder,action,label){
  return `<div class="stack-field office-editor-wrap"><div class="rich-wrap office-rich"><div class="rich-tools"><span class="paste-hint">Paste from Word / Office</span>${richToolbarHtml(id)}</div><div id="${id}" class="rich-editor office-editor" contenteditable="true" role="textbox" aria-multiline="true" data-office-editor="true" data-placeholder="${esc(placeholder)}">${richStoredHtml(value)}</div></div><div class="editor-foot"><small>Formatting is kept when possible. Unsafe scripts and Microsoft-only markup are removed automatically.</small><button class="btn primary" data-action="${action}">${esc(label)}</button></div></div>`;
}
let pendingRichLinkEditor=null,pendingRichLinkRange=null;
function openRichLinkModal(editorId){const ed=$(editorId);if(!ed)return;pendingRichLinkEditor=editorId;const sel=window.getSelection();pendingRichLinkRange=sel&&sel.rangeCount?sel.getRangeAt(0).cloneRange():null;$("richLinkUrl").value="";openModal("richLinkModal");setTimeout(()=>$("richLinkUrl")?.focus(),40)}
function insertPendingRichLink(){const url=$("richLinkUrl")?.value.trim()||"";if(!/^https?:\/\//i.test(url))return toast("Enter a valid http:// or https:// link");const ed=$(pendingRichLinkEditor);if(!ed)return closeModal("richLinkModal");closeModal("richLinkModal");ed.focus();if(pendingRichLinkRange){const sel=window.getSelection();sel.removeAllRanges();sel.addRange(pendingRichLinkRange)}document.execCommand("createLink",false,url);pendingRichLinkEditor=null;pendingRichLinkRange=null}

function setupRichEditors(){
  $$('[data-rich-cmd]').forEach(b=>b.onclick=()=>{
    const ed=$(b.dataset.editor);if(!ed)return;ed.focus();
    const cmd=b.dataset.richCmd;
    if(cmd==="createLink"){openRichLinkModal(b.dataset.editor);return}
    else if(cmd==="backColor")document.execCommand("backColor",false,"#baff3a");
    else if(cmd.startsWith("formatBlock:"))document.execCommand("formatBlock",false,cmd.split(":")[1]);
    else document.execCommand(cmd,false,null);
  });
  $$('.rich-editor[contenteditable="true"]').forEach(ed=>{
    if(ed.dataset.pasteReady!=="1"){
      ed.addEventListener('paste',handleOfficePaste);
      ed.addEventListener('input',()=>{ed.classList.toggle('has-content',!!stripHtml(ed.innerHTML).trim())});
      ed.dataset.pasteReady="1";
    }
    ed.classList.toggle('has-content',!!stripHtml(ed.innerHTML).trim());
  });
}
function stripHtml(h){const d=document.createElement("div");d.innerHTML=h;return d.textContent||""}
function nl2br(s){return esc(s).replace(/\n/g,"<br>")}
function richStoredHtml(value){
  const raw=String(value||"");
  return /<\/?[a-z][\s\S]*>/i.test(raw)?sanitizeRich(raw):nl2br(raw);
}
function safeStyle(styleText=""){
  const out=[];
  String(styleText).split(';').forEach(part=>{
    const [rawKey,...rest]=part.split(':');if(!rawKey||!rest.length)return;
    const key=rawKey.trim().toLowerCase(),value=rest.join(':').trim();
    if(key==='text-align'&&/^(left|right|center|justify)$/i.test(value))out.push(`text-align:${value.toLowerCase()}`);
    if(key==='font-weight'&&/^(bold|[5-9]00)$/i.test(value))out.push('font-weight:700');
    if(key==='font-style'&&/^italic$/i.test(value))out.push('font-style:italic');
    if(key==='text-decoration'&&/underline/i.test(value))out.push('text-decoration:underline');
  });
  return out.join(';');
}
function sanitizeRich(html){
  const doc=new DOMParser().parseFromString(`<div>${html}</div>`,"text/html"),root=doc.body.firstElementChild;
  const allowed=new Set(["DIV","P","BR","B","STRONG","I","EM","U","S","STRIKE","H1","H2","H3","H4","UL","OL","LI","A","SPAN","BLOCKQUOTE","TABLE","THEAD","TBODY","TFOOT","TR","TH","TD"]);
  [...root.querySelectorAll('script,style,iframe,object,embed,meta,link,form,input,button,svg,math')].forEach(el=>el.remove());
  [...root.querySelectorAll("*")].forEach(el=>{
    if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);return}
    const href=el.tagName==="A"?(el.getAttribute("href")||""):"";
    const colspan=el.getAttribute('colspan'),rowspan=el.getAttribute('rowspan'),style=safeStyle(el.getAttribute('style')||'');
    [...el.attributes].forEach(a=>el.removeAttribute(a.name));
    if(style)el.setAttribute('style',style);
    if(el.tagName==="A"&&/^https?:\/\//i.test(href)){el.setAttribute("href",href);el.setAttribute("target","_blank");el.setAttribute("rel","noopener noreferrer")}
    if((el.tagName==='TD'||el.tagName==='TH')&&/^\d{1,2}$/.test(colspan||''))el.setAttribute('colspan',colspan);
    if((el.tagName==='TD'||el.tagName==='TH')&&/^\d{1,2}$/.test(rowspan||''))el.setAttribute('rowspan',rowspan);
  });
  return root.innerHTML
    .replace(/<!--([\s\S]*?)-->/g,'')
    .replace(/<span>(\s*)<\/span>/gi,'$1')
    .replace(/\sclass=("[^"]*"|'[^']*')/gi,'');
}
function sanitizeInlineRich(html){
  const doc=new DOMParser().parseFromString(`<div>${html||""}</div>`,"text/html"),root=doc.body.firstElementChild;
  const allowed=new Set(["B","STRONG","I","EM","U","S","STRIKE","SPAN","BR"]);
  [...root.querySelectorAll('script,style,iframe,object,embed,meta,link,form,input,button,svg,math,a,img,table,ul,ol,li,p,div,h1,h2,h3,h4,blockquote')].forEach(el=>{
    if(["P","DIV","H1","H2","H3","H4","BLOCKQUOTE","LI"].includes(el.tagName))el.replaceWith(...el.childNodes,doc.createTextNode(" "));
    else if(!allowed.has(el.tagName))el.replaceWith(...el.childNodes);
  });
  [...root.querySelectorAll("*")].forEach(el=>{
    if(!allowed.has(el.tagName)){el.replaceWith(...el.childNodes);return}
    const style=safeStyle(el.getAttribute("style")||"");
    [...el.attributes].forEach(a=>el.removeAttribute(a.name));
    if(style)el.setAttribute("style",style);
  });
  return root.innerHTML.replace(/(?:<br\s*\/?>\s*){2,}/gi,"<br>").trim();
}
function richTitleHtml(value){
  const raw=String(value||"");
  return /<\/?[a-z][\s\S]*>/i.test(raw)?sanitizeInlineRich(raw):esc(raw);
}
function richTitleText(value){return stripHtml(String(value||"")).replace(/\s+/g," ").trim()}
function insertHtmlAtCursor(html,editor){
  const target=editor||document.activeElement;
  if(!target)return false;
  try{
    const sel=window.getSelection();
    if(sel?.rangeCount){
      const range=sel.getRangeAt(0),node=range.commonAncestorContainer;
      if(target===node||target.contains(node.nodeType===1?node:node.parentNode)){
        range.deleteContents();
        const frag=range.createContextualFragment(html),last=frag.lastChild;
        range.insertNode(frag);
        if(last){range.setStartAfter(last);range.collapse(true);sel.removeAllRanges();sel.addRange(range)}
        return true;
      }
    }
  }catch(err){console.warn("Paste cursor insertion fallback",err)}
  try{
    target.focus();
    if(document.queryCommandSupported?.("insertHTML")&&document.execCommand("insertHTML",false,html))return true;
  }catch(err){console.warn("Paste execCommand fallback",err)}
  try{target.insertAdjacentHTML("beforeend",html);return true}catch{return false}
}
function cleanEditorAfterNativePaste(editor){
  // Run after the browser has committed its native paste. setTimeout is more
  // reliable than a single RAF in Safari/iOS standalone PWAs.
  setTimeout(()=>requestAnimationFrame(()=>{
    if(!editor?.isConnected)return;
    const isInline=editor.dataset.inlineRich==="1";
    const safe=isInline?sanitizeInlineRich(editor.innerHTML||""):sanitizeRich(editor.innerHTML||"");
    if(editor.innerHTML!==safe)editor.innerHTML=safe;
    editor.classList.toggle("has-content",!!stripHtml(editor.innerHTML).trim());
    editor.dispatchEvent(new Event("input",{bubbles:true}));
    // Keep caret usable after sanitizing a title pasted on iPhone/iPad.
    if(isInline){
      try{const sel=window.getSelection(),range=document.createRange();range.selectNodeContents(editor);range.collapse(false);sel.removeAllRanges();sel.addRange(range)}catch{}
    }
  }),0);
}
function handleOfficePaste(e){
  const editor=e.currentTarget;
  // Task titles use native paste on purpose. Safari/iOS/PWA clipboard APIs are
  // inconsistent inside contenteditable; native paste first + sanitize after
  // is the most reliable path and still preserves safe inline formatting.
  if(editor.dataset.inlineRich==="1"){
    cleanEditorAfterNativePaste(editor);
    return;
  }
  const dt=e.clipboardData||window.clipboardData;
  // Safari/iOS/PWA can expose the paste event without readable clipboard data.
  // In that case DO NOT block native paste; sanitize immediately afterwards.
  if(!dt){cleanEditorAfterNativePaste(editor);return}
  const html=dt.getData?.("text/html")||"";
  const text=dt.getData?.("text/plain")||"";
  if(!html&&!text){cleanEditorAfterNativePaste(editor);return}
  const cleaned=html?sanitizeRich(html):nl2br(text);
  if(!cleaned){cleanEditorAfterNativePaste(editor);return}
  e.preventDefault();
  if(!insertHtmlAtCursor(cleaned,editor)){
    editor.insertAdjacentHTML("beforeend",cleaned);
  }
  editor.classList.toggle("has-content",!!stripHtml(editor.innerHTML).trim());
  editor.dispatchEvent(new Event("input",{bubbles:true}));
}


async function sendTask(prefix){const c=currentClient(),titleEl=$(`${prefix}TaskTitle`),detailsEl=$(`${prefix}TaskDetails`),task=sanitizeInlineRich(titleEl?.innerHTML||""),details=sanitizeRich(detailsEl?.innerHTML||"");if(!c||!richTitleText(task))return toast("Task title is required");const {error}=await state.sb.from("client_tasks").insert({client_id:c.id,user_id:state.session.user.id,task,details,priority:$(`${prefix}TaskPriority`).value,due_date:$(`${prefix}TaskDue`).value||null,done:false});if(error)return toast(error.message);await loadTasks();toast("Task sent");renderEmployer(state.employerView)}

async function viewTask(id){
  const t=state.tasks.find(x=>x.id===id);if(!t)return;
  if(roleIsAdmin()&&!t.admin_seen_at){await state.sb.from("client_tasks").update({admin_seen_at:new Date().toISOString()}).eq("id",id);t.admin_seen_at=new Date().toISOString()}
  $("taskModalTitle").innerHTML=richTitleHtml(t.task);
  $("taskModalBody").innerHTML=`<div class="info-grid"><div class="info"><span>Employer</span><strong>${esc(clientName(t.client_id))}</strong></div><div class="info"><span>Priority</span><strong>${esc(t.priority||"Normal")}</strong></div><div class="info"><span>Due</span><strong>${fmtDate(t.due_date)}</strong></div><div class="info"><span>Status</span><strong>${t.done?"Completed":"Open"}</strong></div></div><div class="card" style="margin-top:12px"><h3>Instructions</h3>${sanitizeRich(t.details||"No instructions.")}</div>${roleIsAdmin()?`<div class="modal-actions"><button class="btn primary" data-action="toggle-task" data-id="${t.id}">${t.done?"Reopen Task":"Mark Completed"}</button></div>`:""}`;
  openModal("taskModal")
}

async function toggleTask(id){const t=state.tasks.find(x=>x.id===id);if(!t)return;const {error}=await state.sb.from("client_tasks").update({done:!t.done,updated_at:new Date().toISOString()}).eq("id",id);if(error)return toast(error.message);await loadTasks();closeModal("taskModal");roleIsAdmin()?renderAdmin(state.adminView):renderEmployer(state.employerView)}
async function editEmployerTask(id){
  const t=state.tasks.find(x=>x.id===id);if(!t)return;
  $("taskModalTitle").textContent="Edit Task";
  $("taskModalBody").innerHTML=`<div class="field"><span>Title</span><div class="rich-wrap rich-title-wrap"><div class="rich-tools compact">${[["bold","B"],["italic","I"],["underline","U"],["removeFormat","Tx"]].map(([c,l])=>`<button type="button" class="mini-btn" data-rich-cmd="${c}" data-editor="editTaskTitle">${l}</button>`).join("")}</div><div id="editTaskTitle" class="rich-editor rich-title-editor" contenteditable="true" data-inline-rich="1" data-placeholder="Task title…">${richTitleHtml(t.task)}</div></div></div><div class="field"><span>Instructions</span><div class="rich-wrap"><div class="rich-tools">${[["bold","B"],["italic","I"],["underline","U"],["backColor","HL"],["insertUnorderedList","• List"],["insertOrderedList","1."],["createLink","Link"],["removeFormat","Tx"]].map(([c,l])=>`<button type="button" class="mini-btn" data-rich-cmd="${c}" data-editor="editTaskDetails">${l}</button>`).join("")}</div><div id="editTaskDetails" class="rich-editor" contenteditable="true" data-placeholder="Detailed instructions…">${richStoredHtml(t.details||"")}</div></div></div><div class="form-grid"><div class="field"><span>Priority</span><select id="editTaskPriority">${["Normal","High","Urgent","Low"].map(p=>`<option ${p===(t.priority||"Normal")?"selected":""}>${p}</option>`).join("")}</select></div><div class="field"><span>Due</span><input id="editTaskDue" type="date" value="${esc(t.due_date||"")}"></div></div><div class="modal-actions"><button class="btn primary" data-action="save-employer-task" data-id="${t.id}">Save Changes</button></div>`;openModal("taskModal");setupRichEditors()
}
async function saveEmployerTask(id){const titleEl=$("editTaskTitle"),detailsEl=$("editTaskDetails"),task=sanitizeInlineRich(titleEl?.innerHTML||"");if(!richTitleText(task))return toast("Task title is required");const {error}=await state.sb.from("client_tasks").update({task,details:sanitizeRich(detailsEl?.innerHTML||""),priority:$("editTaskPriority").value,due_date:$("editTaskDue").value||null,updated_at:new Date().toISOString()}).eq("id",id);if(error)return toast(error.message);await loadTasks();closeModal("taskModal");renderEmployer("tasks")}

async function deleteEmployerTask(id){
  const t=state.tasks.find(x=>x.id===id),c=currentClient();
  if(!t||!c)return toast("Request not found");
  if(t.client_id!==c.id)return toast("You can only delete requests from this project");
  if(c.portal_permission==="view")return toast("This portal is View Only");
  if(!confirm(`Delete request “${richTitleText(t.task)||"Untitled"}”? This cannot be undone.`))return;
  let deleted=false,lastError=null;
  const rpc=await state.sb.rpc("delete_own_task",{target_task:id});
  if(!rpc.error)deleted=rpc.data===true;
  else if(!/function .*delete_own_task/i.test(rpc.error.message||"")&&!/PGRST202/i.test(rpc.error.code||""))lastError=rpc.error;
  if(!deleted&&!lastError){
    const direct=await state.sb.from("client_tasks").delete().eq("id",id).eq("client_id",c.id).select("id");
    if(direct.error)lastError=direct.error;else deleted=(direct.data||[]).some(x=>x.id===id);
  }
  if(lastError)return toast(lastError.message||"Delete failed");
  if(!deleted)return toast("Delete was blocked by database permissions. Run the v2.6 SQL patch included in this build.");
  await loadTasks();
  toast("Request deleted");
  renderEmployer(state.employerView);
}

async function getSubmission(clientId){const {data,error}=await state.sb.from("client_submissions").select("*").eq("client_id",clientId).maybeSingle();if(error)throw error;return data}
async function saveSubmission(field,value){const c=currentClient(),old=await getSubmission(c.id);const payload={client_id:c.id,user_id:state.session.user.id,info:old?.info||"",info_html:old?.info_html||"",project_information:old?.project_information||"",shared_notes:old?.shared_notes||""};payload[field]=value;const {error}=await state.sb.from("client_submissions").upsert(payload,{onConflict:"client_id"});if(error)return toast(error.message);toast("Saved")}

async function listFiles(clientId){if(!clientId)return[];const {data,error}=await state.sb.storage.from("client-files").list(clientId,{limit:100,sortBy:{column:"created_at",order:"desc"}});if(error){console.warn(error);return[]}return (data||[]).filter(x=>x.metadata&&typeof x.metadata.size!=="undefined")}
function fileListHtml(files,c,editable){return`<div class="file-grid">${files.length?files.map(f=>`<div class="file-card"><div><strong>${esc(f.name.replace(/^\d+-[a-z0-9]+-/,""))}</strong><small class="muted">${humanSize(f.metadata?.size)}</small></div><div class="row-actions"><button class="mini-btn" data-action="open-file" data-path="${c.id}/${esc(f.name)}">Open</button>${editable?`<button class="mini-btn" data-action="delete-file" data-path="${c.id}/${esc(f.name)}">Delete</button>`:""}</div></div>`).join(""):'<div class="empty"><strong>No files yet</strong></div>'}</div>`}
async function openFile(path){const {data,error}=await state.sb.storage.from("client-files").createSignedUrl(path,120);if(error)return toast(error.message);window.open(data.signedUrl,"_blank","noopener")}
async function deleteFile(path){if(!confirm("Delete this file?"))return;const {error}=await state.sb.storage.from("client-files").remove([path]);if(error)return toast(error.message);roleIsAdmin()?renderClientDetail(state.activeClient):renderEmployer(state.employerView)}

function openTimeEntryEditor(id){
  const e=state.time.find(x=>x.id===id);if(!e)return toast("Work entry not found");
  $("timeEditId").value=e.id;
  $("timeEditClient").innerHTML=state.clients.map(c=>`<option value="${c.id}" ${c.id===e.client_id?"selected":""}>${esc(c.name)}</option>`).join("");
  $("timeEditTask").value=e.task||"";
  $("timeEditStart").value=toLocalDateTimeInput(e.clock_in);
  $("timeEditEnd").value=toLocalDateTimeInput(e.clock_out);
  $("timeEditRate").value=Number(e.hourly_rate??state.billing?.hourly_rate??3).toFixed(2);
  $("timeEditInvoiceWarning").classList.toggle("hidden",!e.invoice_id);
  updateTimeEditPreview();
  openModal("timeEditModal");
}
function updateTimeEditPreview(){
  const start=$("timeEditStart")?.value,end=$("timeEditEnd")?.value,box=$("timeEditDuration");if(!box)return;
  if(!start){box.textContent="Enter a start time";return}
  if(!end){box.textContent="Active session · duration will continue running";return}
  const s=new Date(start),e=new Date(end);
  if(isNaN(s)||isNaN(e)||e<=s){box.textContent="End time must be later than start time";return}
  box.textContent=`Recalculated duration: ${dur((e-s)/36e5)}`;
}
async function saveTimeEntryEdit(){
  const id=$("timeEditId").value,entry=state.time.find(x=>x.id===id);if(!entry)return toast("Work entry not found");
  const client_id=$("timeEditClient").value,task=$("timeEditTask").value.trim()||"General work",startRaw=$("timeEditStart").value,endRaw=$("timeEditEnd").value,rate=Number($("timeEditRate").value);
  if(!client_id||!startRaw)return toast("Employer and start time are required");
  const clock_in=new Date(startRaw),clock_out=endRaw?new Date(endRaw):null;
  if(isNaN(clock_in))return toast("Invalid start time");
  if(clock_out&&isNaN(clock_out))return toast("Invalid end time");
  if(clock_out&&clock_out<=clock_in)return toast("End time must be later than start time");
  if(!Number.isFinite(rate)||rate<0)return toast("Enter a valid hourly rate");
  if(entry.invoice_id&&!confirm("This work entry is already attached to an invoice. Changing its time will not automatically change the existing invoice total. Continue?"))return;
  const hours=clock_out?(clock_out-clock_in)/36e5:null;
  const payload={client_id,task,clock_in:clock_in.toISOString(),clock_out:clock_out?clock_out.toISOString():null,hours,hourly_rate:rate};
  const {data,error}=await state.sb.from("time_entries").update(payload).eq("id",id).select("id").maybeSingle();
  if(error)return toast(error.message);
  if(!data)return toast("Work entry was not updated. Check your permissions.");
  await loadTime();closeModal("timeEditModal");renderTimePage();updateStatusDock();toast("Work time updated");
}

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

function openModal(id){
  const el=$(id);if(!el)return;
  el.classList.remove("hidden");
  el.scrollTop=0;
  const inner=el.querySelector(".modal");if(inner)inner.scrollTop=0;
  requestAnimationFrame(()=>el.classList.add("is-open"));
  document.body.classList.add("modal-open");
}
function closeModal(id){const el=$(id);if(!el)return;el.classList.remove("is-open");el.classList.add("hidden");if(!$$(".modal-backdrop:not(.hidden)").length)document.body.classList.remove("modal-open")}
function stopTicker(){if(state.timer){clearInterval(state.timer);state.timer=null}}
function startTicker(){
  stopTicker();
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

function setMobileNav(open){
  const allowed=window.matchMedia("(max-width: 950px)").matches;
  const next=!!open&&allowed;
  document.body.classList.toggle("mobile-nav-open",next);
  const btn=$("mobileMenuBtn"),backdrop=$("mobileNavBackdrop");
  if(btn){btn.setAttribute("aria-expanded",String(next));btn.setAttribute("aria-label",next?"Close navigation":"Open navigation")}
  if(backdrop)backdrop.classList.toggle("hidden",!next);
}
function closeMobileNav(){setMobileNav(false)}

document.addEventListener("click",async e=>{
  const a=e.target.closest("[data-action]"),av=e.target.closest("[data-admin-view]"),ev=e.target.closest("[data-employer-view]"),close=e.target.closest("[data-close]");
  if(close)return closeModal(close.dataset.close);
  if(av&&roleIsAdmin()){closeMobileNav();return renderAdmin(av.dataset.adminView)}
  if(ev&&!roleIsAdmin()){if(ev.dataset.employerView==="website"){state.activeWebsiteProject=null;state.activeWebsiteProjectMode=null}return renderEmployer(ev.dataset.employerView)}
  if(!a)return;
  const id=a.dataset.id,act=a.dataset.action;
  try{
    if(act==="home"){closeMobileNav();roleIsAdmin()?renderAdmin("dashboard"):renderEmployer("overview")}
    else if(act==="new-client")openClientModal();
    else if(act==="edit-client")openClientModal(id);
    else if(act==="client-detail")await renderClientDetail(id);
    else if(act==="trash-client")await trashClient(id);
    else if(act==="restore-client")await restoreClient(id);
    else if(act==="view-task")await viewTask(id);
    else if(act==="toggle-task")await toggleTask(id);
    else if(act==="toggle-preview"){const p=$(`preview-${id}`),ex=p.classList.toggle("expanded");a.textContent=ex?"See less":"See more"}
    else if(act==="edit-employer-task")await editEmployerTask(id);
    else if(act==="save-employer-task")await saveEmployerTask(id);
    else if(act==="delete-employer-task")await deleteEmployerTask(id);
    else if(act==="send-task")await sendTask(a.dataset.prefix);
    else if(act==="save-project-info")await saveSubmission("project_information",sanitizeRich($("projectInfo")?.innerHTML||""));
    else if(act==="save-shared-notes")await saveSubmission("shared_notes",sanitizeRich($("sharedNotes")?.innerHTML||""));
    else if(act==="employer-status")await employerStatus(a.dataset.status);
    else if(act==="open-file")await openFile(a.dataset.path);
    else if(act==="delete-file")await deleteFile(a.dataset.path);
    else if(act==="clock-in")await clockIn();
    else if(act==="clock-out-selected"){const cid=$("timerClient").value,active=state.time.find(x=>x.client_id===cid&&!x.clock_out);if(!active)return toast("Select an employer with an active session");await stopSession(active.id)}
    else if(act==="edit-time-entry")openTimeEntryEditor(id);
    else if(act==="stop-session")await stopSession(id);
    else if(act==="manual-hours")await addManualHours();
    else if(act==="save-time-entry")await saveTimeEntryEdit();
    else if(act==="preview-invoice"){try{const d=draftInvoice();$("invoiceModalBody").innerHTML=invoiceHtml(d,state.clients.find(c=>c.id===d.client_id));openModal("invoiceModal")}catch(x){toast(x.message)}}
    else if(act==="create-invoice")await createInvoice();
    else if(act==="view-invoice")await viewInvoice(id);
    else if(act==="mark-paid")await markPaid(id);
    else if(act==="save-billing")await saveBilling();
    else if(act==="save-prompt")await savePrompt();
    else if(act==="edit-prompt")editPrompt(id);
    else if(act==="cancel-prompt-edit")cancelPromptEdit();
    else if(act==="copy-prompt"){const p=(state.prompts||[]).find(x=>x.id===id);if(p)await copyText(p.prompt_text,"Prompt copied")}
    else if(act==="delete-prompt")await deletePrompt(id);
    else if(act==="new-website-project")openNewWebsiteProjectModal();
    else if(act==="view-website-project")await viewWebsiteProject(id);
    else if(act==="open-website-project")await openWebsiteProject(id);
    else if(act==="back-to-website-projects")closeWebsiteProject();
    else if(act==="save-website-project")await saveWebsiteProject(id);
    else if(act==="delete-project-asset")await deleteWebsiteProjectAsset(id,a.dataset.path,a.dataset.projectId);
    else if(act==="copy-project-intake")await copyProjectIntake(a.dataset.clientId,id);
    else if(act==="open-admin-website-project")await renderAdminWebsiteProject(a.dataset.clientId,id);
    else if(act==="save-admin-website-project")await saveAdminWebsiteProject(a.dataset.clientId,id);
    else if(act==="back-to-client-detail")await renderClientDetail(a.dataset.clientId);
    else if(act==="back-to-admin-websites")renderAdmin("websites");
    else if(act==="remove-showcase-logo")await removeShowcaseLogo(id);
    else if(act==="remove-showcase-image")await removeShowcaseImage(id,Number(a.dataset.index),a.dataset.return||"modal");
    else if(act==="open-showcase-image")openShowcaseLightbox(a.dataset.url,a.dataset.mode);
    else if(act==="showcase-logo-bg")setShowcaseLogoBg(a.dataset.showcaseBg);
    else if(act==="change-password")await changePassword();
  }catch(err){console.error(err);toast(err.message||"Something went wrong")}
});

document.addEventListener("input",e=>{if(e.target.id==="clientSearch")renderClientRows();if(e.target.id==="promptSearch")renderPromptRows();if(e.target.id==="websiteProjectSearch")filterAdminWebsiteCards();if(e.target.matches?.("textarea.auto-grow"))autoGrow(e.target);if(["invoiceClient","invoiceMode","invoiceStart","invoiceEnd","invoiceManualHours","invoiceRate"].includes(e.target.id))updateInvoicePreview();if(["timeEditStart","timeEditEnd"].includes(e.target.id))updateTimeEditPreview()});
document.addEventListener("change",e=>{if(e.target.id==="clientSort")renderClientRows();if(e.target.id==="taskFilter")renderTaskInboxRows();if(e.target.id==="websiteProjectStatusFilter")filterAdminWebsiteCards();if(["invoiceClient","invoiceMode","invoiceStart","invoiceEnd","invoiceManualHours","invoiceRate"].includes(e.target.id))updateInvoicePreview()});

$("richLinkForm")?.addEventListener("submit",e=>{e.preventDefault();insertPendingRichLink()});
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();const btn=$("loginSubmit");btn.disabled=true;$("loginError").textContent="Signing in…";
  try{const sb=initSupabase(),identifier=$("loginIdentifier").value.trim();let email=identifier;if(!identifier.includes("@")){const {data,error}=await sb.rpc("resolve_login_email",{login_name:identifier});if(error)throw error;if(!data)throw new Error("Invalid username or password");email=data}const {data,error}=await sb.auth.signInWithPassword({email,password:$("loginPassword").value});if(error)throw error;state.session=data.session;$("loginError").textContent="";await loadWorkspace()}catch(x){$("loginError").textContent=x.message}finally{btn.disabled=false}
});
$("toggleLoginPassword").onclick=()=>{const i=$("loginPassword");i.type=i.type==="password"?"text":"password";$("toggleLoginPassword").textContent=i.type==="password"?"Show":"Hide"};
$("toggleTempPassword").onclick=()=>{const i=$("clientTempPassword");i.type=i.type==="password"?"text":"password";$("toggleTempPassword").textContent=i.type==="password"?"Show":"Hide"};
$("signOutBtn").onclick=()=>state.sb.auth.signOut();
$("clientForm").addEventListener("submit",async e=>{e.preventDefault();try{await saveClient();closeModal("clientModal");renderClients();toast("Employer saved")}catch(x){toast(x.message)}});
$("websiteProjectForm")?.addEventListener("submit",async e=>{e.preventDefault();await createWebsiteProject()});
$("createLoginBtn").onclick=createEmployerLogin;
$("statusPill").onclick=e=>{e.stopPropagation();$("statusPopover").classList.toggle("hidden")};
$("hideStatusBtn").onclick=e=>{e.stopPropagation();sessionStorage.setItem("hideVaStatus","1");updateStatusDock()};
$("restoreStatusBtn").onclick=()=>{sessionStorage.removeItem("hideVaStatus");updateStatusDock()};
$("openWorkMonitorBtn").onclick=()=>{renderEmployer("work");$("statusPopover").classList.add("hidden")};
document.addEventListener("click",e=>{if(!$("statusDock").contains(e.target))$("statusPopover").classList.add("hidden")});
$$(".modal-backdrop").forEach(m=>m.addEventListener("click",e=>{if(e.target===m)closeModal(m.id)}));



// ---------- v2 experience layer ----------
const COMMANDS_ADMIN=[
  {label:"Dashboard",hint:"Overview & KPIs",view:"dashboard",keywords:"home stats overview"},
  {label:"Employers",hint:"Directory & client records",view:"clients",keywords:"clients companies employers"},
  {label:"Website Projects",hint:"All website production workspaces",view:"websites",keywords:"website projects intake status logo screenshots showcase"},
  {label:"Project Activity",hint:"Timeline of website changes",view:"activity",keywords:"activity updates history status uploads"},
  {label:"Prompt Library",hint:"Reusable website prompts",view:"prompts",keywords:"command prompts ai website copy"},
  {label:"Task Inbox",hint:"Employer requests",view:"tasks",keywords:"tasks requests inbox"},
  {label:"Time Log",hint:"Track work sessions",view:"time",keywords:"timer hours work"},
  {label:"Invoices",hint:"Billing history",view:"invoices",keywords:"invoice payments money"},
  {label:"Rate & Billing",hint:"Invoice settings",view:"billing",keywords:"rate settings billing"},
  {label:"Trash",hint:"Restore employers",view:"trash",keywords:"deleted restore"},
  {label:"Add Employer",hint:"Create a new employer",action:"new-client",keywords:"new client add"}
];
const COMMANDS_EMPLOYER=[
  {label:"Overview",hint:"Project summary",view:"overview",keywords:"home project"},
  {label:"Website Projects",hint:"Multiple website intakes & assets",view:"website",keywords:"intake logo photos branding websites projects"},
  {label:"Tasks",hint:"Requests & history",view:"tasks",keywords:"requests work"},
  {label:"Files",hint:"Shared documents",view:"files",keywords:"upload documents"},
  {label:"Work Monitor",hint:"VA hours & live status",view:"work",keywords:"time timer status"},
  {label:"Invoices",hint:"Billing history",view:"invoices",keywords:"payments bill"},
  {label:"Account",hint:"Login & password",view:"account",keywords:"security password"}
];
function commandItems(){return roleIsAdmin()?COMMANDS_ADMIN:COMMANDS_EMPLOYER}
function renderCommandResults(query=""){
  const box=$("commandResults");if(!box)return;
  const q=query.trim().toLowerCase();
  const items=commandItems().filter(x=>!q||`${x.label} ${x.hint} ${x.keywords}`.toLowerCase().includes(q));
  box.innerHTML=items.length?items.map((x,i)=>`<button class="command-item ${i===0?"selected":""}" data-command-index="${i}" data-command-view="${esc(x.view||"")}" data-command-action="${esc(x.action||"")}"><span><strong>${esc(x.label)}</strong><small>${esc(x.hint)}</small></span><kbd>↵</kbd></button>`).join(""):`<div class="command-empty">No matching destination</div>`;
}
function openCommandPalette(){if(!state.session)return;const p=$("commandPalette");if(!p)return;p.classList.remove("hidden");requestAnimationFrame(()=>p.classList.add("is-open"));renderCommandResults();const input=$("commandSearch");input.value="";setTimeout(()=>input.focus(),0)}
function closeCommandPalette(){const p=$("commandPalette");if(!p)return;p.classList.remove("is-open");p.classList.add("hidden")}
function runCommandButton(btn){if(!btn)return;const view=btn.dataset.commandView,action=btn.dataset.commandAction;closeCommandPalette();if(view){if(!roleIsAdmin()&&view==="website"){state.activeWebsiteProject=null;state.activeWebsiteProjectMode=null}roleIsAdmin()?renderAdmin(view):renderEmployer(view);return}if(action==="new-client"&&roleIsAdmin())openClientModal()}
function installViewMotion(){const view=$("view");if(!view)return;new MutationObserver(()=>{view.classList.remove("view-enter");requestAnimationFrame(()=>view.classList.add("view-enter"))}).observe(view,{childList:true})}
function setBusy(button,busy,label="Working…"){if(!button)return;if(busy){button.dataset.oldText=button.textContent;button.textContent=label;button.disabled=true;button.setAttribute("aria-busy","true")}else{button.textContent=button.dataset.oldText||button.textContent;button.disabled=false;button.removeAttribute("aria-busy")}}

$("mobileMenuBtn")?.addEventListener("click",()=>setMobileNav(!document.body.classList.contains("mobile-nav-open")));
$("mobileNavBackdrop")?.addEventListener("click",closeMobileNav);
window.addEventListener("resize",()=>{if(window.innerWidth>950)closeMobileNav()});

$("commandBtn")?.addEventListener("click",openCommandPalette);
$("commandPalette")?.addEventListener("click",e=>{if(e.target===$("commandPalette"))closeCommandPalette();const b=e.target.closest("[data-command-view],[data-command-action]");if(b)runCommandButton(b)});
$("commandSearch")?.addEventListener("input",e=>renderCommandResults(e.target.value));
$("commandSearch")?.addEventListener("keydown",e=>{const buttons=$$("#commandResults .command-item");if(!buttons.length)return;let i=Math.max(0,buttons.findIndex(b=>b.classList.contains("selected")));if(e.key==="ArrowDown"||e.key==="ArrowUp"){e.preventDefault();buttons[i].classList.remove("selected");i=(i+(e.key==="ArrowDown"?1:-1)+buttons.length)%buttons.length;buttons[i].classList.add("selected");buttons[i].scrollIntoView({block:"nearest"})}else if(e.key==="Enter"){e.preventDefault();runCommandButton(buttons[i])}});
document.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();$("commandPalette")?.classList.contains("hidden")?openCommandPalette():closeCommandPalette()}if(e.key==="Escape"){closeMobileNav();closeCommandPalette();$$(".modal-backdrop:not(.hidden)").forEach(m=>closeModal(m.id))}});
window.addEventListener("beforeunload",stopTicker);
document.addEventListener("visibilitychange",()=>{if(document.hidden)stopTicker();else if(state.session)startTicker()});
installViewMotion();

console.info("Jeffdesign101",BUILD);
init();

// v2.6: keep rich task titles compact and safe.
document.addEventListener("keydown",e=>{const ed=e.target.closest?.('[data-inline-rich="1"]');if(ed&&e.key==="Enter"){e.preventDefault();document.execCommand("insertText",false," ")}});
document.addEventListener("input",e=>{const ed=e.target.closest?.('[data-inline-rich="1"]');if(!ed)return; if(ed.innerHTML.length>1000)ed.innerHTML=sanitizeInlineRich(ed.innerHTML).slice(0,1000)});
