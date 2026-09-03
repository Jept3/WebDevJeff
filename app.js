
const STORAGE_KEY = 'limeCRM.clients.v1';
const statusLabels = {
  ongoing: 'Ongoing',
  review: 'In Review',
  waiting: 'Waiting',
  complete: 'Complete',
  paused: 'Paused'
};
const statusColors = {
  ongoing: '#baff3a',
  review: '#71d7ff',
  waiting: '#ffc857',
  complete: '#55e58a',
  paused: '#b69cff'
};

const $ = (id) => document.getElementById(id);
const els = {
  pageTitle: $('page-title'),
  globalSearch: $('global-search'),
  clientSearch: $('client-search'),
  clientSort: $('client-sort'),
  clientStatusFilter: $('client-status-filter'),
  clientList: $('client-list'),
  recentClients: $('recent-clients'),
  projectBoard: $('project-board'),
  clientDetail: $('client-detail'),
  detailSearch: $('detail-search'),
  modalBackdrop: $('modal-backdrop'),
  clientForm: $('client-form'),
  deleteClient: $('delete-client'),
  saveState: $('save-state'),
  toast: $('toast')
};

let clients = loadClients();
let activeClientId = null;
let detailReturnView = 'clients';
let autoSaveTimer = null;

function uid(){
  return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}
function todayISO(){ return new Date().toISOString().slice(0,10); }
function daysAgo(n){
  const d = new Date(); d.setDate(d.getDate()-n); return d.toISOString().slice(0,10);
}
function daysFromNow(n){
  const d = new Date(); d.setDate(d.getDate()+n); return d.toISOString().slice(0,10);
}
function seedClients(){
  const now = new Date().toISOString();
  return [
    {
      id:uid(), name:'Nova Dental Studio', company:'Nova Dental', email:'hello@novadental.example', phone:'+1 555 212 7890',
      website:'https://novadental.example', projectType:'Modern business website', status:'ongoing', priority:'High',
      startDate:daysAgo(18), deadline:daysFromNow(16), completedDate:'', budget:'$3,800',
      overview:'Redesign the clinic website with a premium, calming presentation focused on appointment conversion, service education and local trust.',
      hosting:'Vercel', stack:'Next.js / static content', registrar:'Namecheap', contact:'Maya — Practice Manager',
      deliverables:'Home, About, Services, Team, Testimonials, Contact, appointment CTA, local SEO foundation.',
      notes:'Homepage direction approved. Waiting for final staff photos and updated service pricing.',
      tags:['healthcare','redesign','seo'], createdAt:new Date(Date.now()-18*864e5).toISOString(), updatedAt:now
    },
    {
      id:uid(), name:'Atlas Creative Co.', company:'Atlas Creative', email:'studio@atlascreative.example', phone:'+1 555 380 1299',
      website:'https://atlascreative.example', projectType:'Portfolio website', status:'review', priority:'Normal',
      startDate:daysAgo(30), deadline:daysFromNow(5), completedDate:'', budget:'$2,600',
      overview:'A visual portfolio site for a creative studio with project case studies, motion details and a streamlined inquiry flow.',
      hosting:'GitHub Pages', stack:'HTML / CSS / JavaScript', registrar:'Cloudflare', contact:'Jordan — Founder',
      deliverables:'Homepage, Work directory, Case study template, About, Contact, mobile optimization.',
      notes:'Client is reviewing desktop and mobile staging. Need final copy notes before launch.',
      tags:['portfolio','animation','branding'], createdAt:new Date(Date.now()-30*864e5).toISOString(), updatedAt:new Date(Date.now()-864e5).toISOString()
    },
    {
      id:uid(), name:'Greenline Landscaping', company:'Greenline', email:'info@greenline.example', phone:'+1 555 882 4430',
      website:'https://greenline.example', projectType:'Lead generation website', status:'complete', priority:'Normal',
      startDate:daysAgo(70), deadline:daysAgo(26), completedDate:daysAgo(29), budget:'$2,100',
      overview:'Local landscaping website designed to generate quote requests and clearly present residential and commercial services.',
      hosting:'Hostinger', stack:'WordPress', registrar:'GoDaddy', contact:'Alex — Owner',
      deliverables:'Home, Services, Gallery, Reviews, Service Areas, Contact, quote form.',
      notes:'Launched successfully. Add portfolio photos during the next maintenance cycle.',
      tags:['local-business','lead-gen','completed'], createdAt:new Date(Date.now()-70*864e5).toISOString(), updatedAt:new Date(Date.now()-22*864e5).toISOString()
    },
    {
      id:uid(), name:'Mori Coffee Lab', company:'Mori', email:'hello@mori.example', phone:'+1 555 930 4402',
      website:'https://mori.example', projectType:'Cafe brand website', status:'waiting', priority:'Low',
      startDate:daysAgo(9), deadline:daysFromNow(30), completedDate:'', budget:'$1,900',
      overview:'Minimal editorial website for a specialty coffee bar featuring menu highlights, location information and brand story.',
      hosting:'GitHub Pages', stack:'HTML / CSS / JS', registrar:'Squarespace Domains', contact:'Rina — Co-owner',
      deliverables:'Landing page, Menu, Story, Location, Instagram links.',
      notes:'Waiting for updated menu PDF, opening hours and final brand photography.',
      tags:['hospitality','minimal','content'], createdAt:new Date(Date.now()-9*864e5).toISOString(), updatedAt:new Date(Date.now()-2*864e5).toISOString()
    }
  ];
}
function loadClients(){
  try{
    const saved = localStorage.getItem(STORAGE_KEY);
    if(saved) return JSON.parse(saved);
  }catch(e){}
  const seeded = seedClients();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
  return seeded;
}
function persist(){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clients));
  updateDashboard();
}
function esc(value=''){
  return String(value).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]));
}
function fmtDate(date){
  if(!date) return '—';
  const d = new Date(date + (date.length===10?'T00:00:00':''));
  if(Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'}).format(d);
}
function fmtUpdated(date){
  const d = new Date(date); if(Number.isNaN(d)) return '—';
  const delta = Math.max(0, Date.now()-d.getTime());
  const days = Math.floor(delta/864e5);
  if(days===0) return 'Today';
  if(days===1) return 'Yesterday';
  if(days<7) return `${days} days ago`;
  return fmtDate(date.slice(0,10));
}
function initials(name='?'){
  return name.split(/\s+/).slice(0,2).map(v=>v[0]||'').join('').toUpperCase();
}
function statusChip(status){
  return `<span class="status-chip status-${esc(status)}">● ${esc(statusLabels[status] || status)}</span>`;
}
function showToast(message){
  els.toast.textContent = message;
  els.toast.classList.add('show');
  setTimeout(()=>els.toast.classList.remove('show'),1800);
}
function setView(view){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(b=>b.classList.toggle('active', b.dataset.view===view));
  const target = $(`${view}-view`);
  if(target) target.classList.add('active');
  const titles = {dashboard:'Dashboard',clients:'Client Directory',projects:'Project Monitoring','client-detail':'Client Details'};
  els.pageTitle.textContent = titles[view] || 'LimeCRM';
  if(view==='clients') renderClients();
  if(view==='projects') renderProjectBoard();
  if(view==='dashboard') updateDashboard();
  window.scrollTo({top:0,behavior:'smooth'});
}
function clientMatches(c, q){
  if(!q) return true;
  q = q.toLowerCase();
  return [
    c.name,c.company,c.email,c.phone,c.website,c.projectType,c.status,c.priority,c.overview,
    c.hosting,c.stack,c.registrar,c.contact,c.deliverables,c.notes,(c.tags||[]).join(' ')
  ].join(' ').toLowerCase().includes(q);
}
function sortedClients(list){
  const sort = els.clientSort?.value || 'updated-desc';
  return [...list].sort((a,b)=>{
    if(sort==='name-asc') return a.name.localeCompare(b.name);
    if(sort==='name-desc') return b.name.localeCompare(a.name);
    if(sort==='created-desc') return new Date(b.createdAt)-new Date(a.createdAt);
    if(sort==='created-asc') return new Date(a.createdAt)-new Date(b.createdAt);
    if(sort==='deadline-asc'){
      const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
      const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
      return da-db;
    }
    return new Date(b.updatedAt)-new Date(a.updatedAt);
  });
}
function renderClients(overrideQuery=null){
  const q = overrideQuery !== null ? overrideQuery : (els.clientSearch?.value || '');
  const status = els.clientStatusFilter?.value || 'all';
  let list = clients.filter(c=>clientMatches(c,q) && (status==='all'||c.status===status));
  list = sortedClients(list);
  if(!list.length){
    els.clientList.innerHTML = `<div class="empty"><strong>No clients found</strong>Try another search/filter or add a new client.</div>`;
    return;
  }
  els.clientList.innerHTML = list.map(c=>`
    <div class="client-row" data-open-client="${esc(c.id)}">
      <div class="client-main">
        <div class="avatar">${esc(initials(c.name))}</div>
        <div>
          <strong>${esc(c.name)}</strong>
          <small>${esc(c.website || c.company || 'No website added')}</small>
        </div>
      </div>
      <div class="muted">${esc(c.projectType || 'Website project')}</div>
      <div>${statusChip(c.status)}</div>
      <div class="muted">Updated ${esc(fmtUpdated(c.updatedAt))}</div>
      <button class="row-open" aria-label="Open client">›</button>
    </div>
  `).join('');
}
function renderRecent(){
  const list = [...clients].sort((a,b)=>new Date(b.updatedAt)-new Date(a.updatedAt)).slice(0,5);
  if(!list.length){
    els.recentClients.innerHTML = `<div class="empty"><strong>No client records yet</strong>Add your first client to start tracking website projects.</div>`;
    return;
  }
  els.recentClients.innerHTML = list.map(c=>`
    <div class="recent-row" data-open-client="${esc(c.id)}">
      <div class="client-main">
        <div class="avatar">${esc(initials(c.name))}</div>
        <div><strong>${esc(c.name)}</strong><small>${esc(c.website || c.company || '')}</small></div>
      </div>
      <div class="muted">${esc(c.projectType || 'Website project')}</div>
      <div>${statusChip(c.status)}</div>
      <div class="muted">${esc(fmtUpdated(c.updatedAt))}</div>
      <button class="row-open">›</button>
    </div>
  `).join('');
}
function avgCompletionDays(){
  const completed = clients.filter(c=>c.startDate && c.completedDate);
  if(!completed.length) return null;
  const avg = completed.reduce((sum,c)=>sum + Math.max(0,(new Date(c.completedDate)-new Date(c.startDate))/864e5),0)/completed.length;
  return Math.round(avg);
}
function updateDashboard(){
  $('stat-clients').textContent = clients.length;
  $('stat-ongoing').textContent = clients.filter(c=>['ongoing','review','waiting'].includes(c.status)).length;
  $('stat-completed').textContent = clients.filter(c=>c.status==='complete').length;
  const avg = avgCompletionDays();
  $('stat-duration').textContent = avg==null ? '—' : `${avg}d`;
  $('donut-total').textContent = clients.length;
  renderDonut();
  renderMonthlyChart();
  renderRecent();
}
function renderDonut(){
  const canvas = $('status-donut'); if(!canvas) return;
  const ctx = canvas.getContext('2d'), w=canvas.width,h=canvas.height,cx=w/2,cy=h/2,r=92,line=27;
  ctx.clearRect(0,0,w,h);
  const counts = Object.keys(statusLabels).map(k=>({key:k,count:clients.filter(c=>c.status===k).length}));
  const total = counts.reduce((s,x)=>s+x.count,0);
  if(!total){
    ctx.strokeStyle='rgba(255,255,255,.08)';ctx.lineWidth=line;ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.stroke();
  }else{
    let start=-Math.PI/2;
    counts.forEach(item=>{
      if(!item.count) return;
      const arc = (item.count/total)*Math.PI*2;
      ctx.beginPath();ctx.strokeStyle=statusColors[item.key];ctx.lineWidth=line;ctx.lineCap='round';
      ctx.arc(cx,cy,r,start+0.02,start+arc-0.02);ctx.stroke();
      start+=arc;
    });
  }
  $('donut-legend').innerHTML = counts.filter(x=>x.count).map(x=>`<div class="legend-item"><span class="legend-dot" style="background:${statusColors[x.key]}"></span>${esc(statusLabels[x.key])} ${x.count}</div>`).join('');
}
function renderMonthlyChart(){
  const canvas=$('monthly-chart'); if(!canvas)return;
  const rect=canvas.getBoundingClientRect(), dpr=Math.min(window.devicePixelRatio||1,2);
  const cssW=Math.max(300,Math.floor(rect.width)), cssH=Math.max(240,Math.floor(rect.height));
  canvas.width=cssW*dpr;canvas.height=cssH*dpr;
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);
  const w=cssW,h=cssH,pad={l:35,r:18,t:25,b:40};
  const months=[];
  const now=new Date();
  for(let i=5;i>=0;i--){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    months.push({y:d.getFullYear(),m:d.getMonth(),label:d.toLocaleString(undefined,{month:'short'}),count:0});
  }
  clients.forEach(c=>{
    const d=new Date(c.createdAt);
    const item=months.find(x=>x.y===d.getFullYear()&&x.m===d.getMonth());
    if(item)item.count++;
  });
  const max=Math.max(3,...months.map(x=>x.count));
  ctx.clearRect(0,0,w,h);
  ctx.strokeStyle='rgba(255,255,255,.06)';ctx.lineWidth=1;
  for(let i=0;i<=3;i++){
    const y=pad.t+(h-pad.t-pad.b)*(i/3);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(w-pad.r,y);ctx.stroke();
  }
  const gap=18;
  const usable=w-pad.l-pad.r;
  const bw=Math.max(16,(usable-gap*(months.length-1))/months.length*.58);
  const step=usable/months.length;
  months.forEach((m,i)=>{
    const x=pad.l+i*step+(step-bw)/2;
    const bh=(m.count/max)*(h-pad.t-pad.b-12);
    const y=h-pad.b-bh;
    const grad=ctx.createLinearGradient(0,y,0,h-pad.b);grad.addColorStop(0,'rgba(186,255,58,.95)');grad.addColorStop(1,'rgba(186,255,58,.15)');
    ctx.fillStyle=grad;roundRect(ctx,x,y,bw,bh,8);ctx.fill();
    ctx.fillStyle='#829087';ctx.font='11px system-ui';ctx.textAlign='center';ctx.fillText(m.label,x+bw/2,h-16);
    if(m.count){ctx.fillStyle='#dfffc1';ctx.fillText(String(m.count),x+bw/2,y-8);}
  });
}
function roundRect(ctx,x,y,w,h,r){
  if(h<1) return;
  r=Math.min(r,w/2,h/2);ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
}
function renderProjectBoard(){
  const statuses=['ongoing','review','waiting','complete','paused'];
  els.projectBoard.innerHTML=statuses.map(s=>{
    const items=clients.filter(c=>c.status===s);
    return `<section class="board-column">
      <div class="board-head"><strong>${esc(statusLabels[s])}</strong><span class="count-pill">${items.length}</span></div>
      ${items.map(c=>`<article class="project-card" data-open-client="${esc(c.id)}">
        <strong>${esc(c.name)}</strong>
        <p>${esc(c.projectType || 'Website project')}</p>
        <div class="project-meta"><span>${esc(c.priority || 'Normal')}</span><span>${esc(c.deadline ? fmtDate(c.deadline) : 'No deadline')}</span></div>
      </article>`).join('') || '<div class="muted" style="padding:8px">No projects</div>'}
    </section>`;
  }).join('');
}
function openClient(id, returnView='clients'){
  const c=clients.find(x=>x.id===id); if(!c)return;
  activeClientId=id;detailReturnView=returnView;
  renderClientDetail(c);
  setView('client-detail');
}
function websiteHref(value){
  if(!value) return '';
  return /^https?:\/\//i.test(value)?value:'https://'+value;
}
function renderClientDetail(c, q=''){
  const tagHtml=(c.tags||[]).map(t=>`<span class="tag">${esc(t)}</span>`).join('');
  els.clientDetail.innerHTML=`
    <article class="detail-hero glass searchable-detail">
      <div>
        <p class="eyebrow">CLIENT / WEBSITE PROJECT</p>
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.company || c.projectType || 'Website project')}</p>
        <div class="detail-tags">${statusChip(c.status)}${tagHtml}</div>
      </div>
      ${statusChip(c.status)}
    </article>
    <div class="detail-grid searchable-detail">
      <article class="detail-card glass">
        <h4>Client information</h4>
        <div class="info-grid">
          <div class="info-item"><span>Email</span><strong>${esc(c.email||'—')}</strong></div>
          <div class="info-item"><span>Phone</span><strong>${esc(c.phone||'—')}</strong></div>
          <div class="info-item"><span>Primary contact</span><strong>${esc(c.contact||'—')}</strong></div>
          <div class="info-item"><span>Priority</span><strong>${esc(c.priority||'—')}</strong></div>
        </div>
      </article>
      <article class="detail-card glass">
        <h4>Website setup</h4>
        <div class="info-grid">
          <div class="info-item"><span>Website</span>${c.website?`<a href="${esc(websiteHref(c.website))}" target="_blank" rel="noopener">${esc(c.website)}</a>`:'<strong>—</strong>'}</div>
          <div class="info-item"><span>Project type</span><strong>${esc(c.projectType||'—')}</strong></div>
          <div class="info-item"><span>Hosting</span><strong>${esc(c.hosting||'—')}</strong></div>
          <div class="info-item"><span>CMS / stack</span><strong>${esc(c.stack||'—')}</strong></div>
          <div class="info-item"><span>Domain registrar</span><strong>${esc(c.registrar||'—')}</strong></div>
          <div class="info-item"><span>Budget</span><strong>${esc(c.budget||'—')}</strong></div>
        </div>
      </article>
      <article class="detail-card glass full">
        <h4>Project timeline</h4>
        <div class="timeline">
          <div class="timeline-item"><small>Started</small><strong>${esc(fmtDate(c.startDate))}</strong></div>
          <div class="timeline-item"><small>Deadline</small><strong>${esc(fmtDate(c.deadline))}</strong></div>
          <div class="timeline-item"><small>Completed</small><strong>${esc(fmtDate(c.completedDate))}</strong></div>
        </div>
      </article>
      <article class="detail-card glass full">
        <h4>Website project overview</h4><div class="prose">${esc(c.overview||'No overview added yet.')}</div>
      </article>
      <article class="detail-card glass">
        <h4>Deliverables</h4><div class="prose">${esc(c.deliverables||'No deliverables added yet.')}</div>
      </article>
      <article class="detail-card glass">
        <h4>Notes & next steps</h4><div class="prose">${esc(c.notes||'No notes added yet.')}</div>
      </article>
      <article class="detail-card glass full">
        <h4>Record details</h4>
        <div class="info-grid">
          <div class="info-item"><span>Created</span><strong>${esc(fmtDate(c.createdAt.slice(0,10)))}</strong></div>
          <div class="info-item"><span>Last updated</span><strong>${esc(fmtUpdated(c.updatedAt))}</strong></div>
        </div>
      </article>
    </div>`;
  if(q) highlightDetail(q);
}
function highlightDetail(q){
  q=q.trim();
  if(!q)return;
  const safe=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const re=new RegExp(`(${safe})`,'gi');
  document.querySelectorAll('#client-detail .prose, #client-detail .info-item strong, #client-detail .info-item a, #client-detail h4').forEach(el=>{
    el.innerHTML=el.textContent.replace(re,'<mark>$1</mark>');
  });
}
const fields = {
  name:'client-name', company:'client-company', email:'client-email', phone:'client-phone', website:'client-website',
  projectType:'client-project-type', status:'client-status', priority:'client-priority', startDate:'client-start',
  deadline:'client-deadline', completedDate:'client-completed', budget:'client-budget', overview:'client-overview',
  hosting:'client-hosting', stack:'client-stack', registrar:'client-registrar', contact:'client-contact',
  deliverables:'client-deliverables', notes:'client-notes', tags:'client-tags'
};
function openModal(id=null){
  $('modal-title').textContent=id?'Edit client':'Add client';
  $('client-id').value=id||'';
  const c=id?clients.find(x=>x.id===id):null;
  Object.entries(fields).forEach(([key,elId])=>{
    const el=$(elId);
    if(key==='tags') el.value=c?(c.tags||[]).join(', '):'';
    else el.value=c?(c[key]||''):(key==='status'?'ongoing':key==='priority'?'Normal':'');
  });
  els.deleteClient.classList.toggle('hidden',!id);
  els.saveState.textContent='Autosave ready';
  els.modalBackdrop.classList.remove('hidden');
  setTimeout(()=>$('client-name').focus(),50);
}
function closeModal(){els.modalBackdrop.classList.add('hidden');}
function collectForm(){
  const now=new Date().toISOString();
  const id=$('client-id').value||uid();
  const old=clients.find(c=>c.id===id);
  const obj={id};
  Object.entries(fields).forEach(([key,elId])=>{
    let value=$(elId).value.trim();
    if(key==='tags') value=value.split(',').map(v=>v.trim()).filter(Boolean);
    obj[key]=value;
  });
  obj.createdAt=old?.createdAt||now;
  obj.updatedAt=now;
  return obj;
}
function saveForm(show=true){
  if(!$('client-name').value.trim()) return null;
  const c=collectForm();
  const idx=clients.findIndex(x=>x.id===c.id);
  if(idx>=0) clients[idx]=c; else clients.unshift(c);
  persist();
  if(show)showToast('Client saved');
  return c;
}
function scheduleAutoSave(){
  clearTimeout(autoSaveTimer);
  els.saveState.textContent='Saving…';
  autoSaveTimer=setTimeout(()=>{
    if($('client-id').value && $('client-name').value.trim()){
      saveForm(false);
      els.saveState.textContent='Autosaved';
    }else{
      els.saveState.textContent='Autosave ready';
    }
  },500);
}
function deleteCurrent(){
  const id=$('client-id').value;
  if(!id)return;
  if(!confirm('Delete this client record? This cannot be undone.'))return;
  clients=clients.filter(c=>c.id!==id);persist();closeModal();setView('clients');showToast('Client deleted');
}
function globalSearch(q){
  if(!q.trim()) return;
  setView('clients');
  els.clientSearch.value=q;
  renderClients(q);
}

document.querySelectorAll('.nav-link').forEach(btn=>btn.addEventListener('click',()=>setView(btn.dataset.view)));
document.addEventListener('click',(e)=>{
  const row=e.target.closest('[data-open-client]');
  if(row){
    const current=document.querySelector('.view.active')?.id.replace('-view','')||'clients';
    openClient(row.dataset.openClient,current==='client-detail'?'clients':current);
  }
  const jump=e.target.closest('[data-view-jump]'); if(jump)setView(jump.dataset.viewJump);
});
['add-client','add-client-top','add-client-hero'].forEach(id=>$(id)?.addEventListener('click',()=>openModal()));
$('modal-close').addEventListener('click',closeModal);
$('cancel-client').addEventListener('click',closeModal);
els.modalBackdrop.addEventListener('click',(e)=>{if(e.target===els.modalBackdrop)closeModal()});
els.clientForm.addEventListener('submit',(e)=>{
  e.preventDefault();
  const c=saveForm(true);
  if(c){closeModal();renderClients(); if(activeClientId===c.id)renderClientDetail(c);}
});
els.clientForm.addEventListener('input',scheduleAutoSave);
els.clientForm.addEventListener('change',scheduleAutoSave);
els.deleteClient.addEventListener('click',deleteCurrent);
els.clientSearch.addEventListener('input',()=>renderClients());
els.clientSort.addEventListener('change',()=>renderClients());
els.clientStatusFilter.addEventListener('change',()=>renderClients());
els.globalSearch.addEventListener('keydown',(e)=>{if(e.key==='Enter')globalSearch(e.target.value)});
els.globalSearch.addEventListener('input',(e)=>{if(!e.target.value.trim() && document.querySelector('#clients-view.active')){els.clientSearch.value='';renderClients();}});
$('detail-back').addEventListener('click',()=>setView(detailReturnView==='client-detail'?'clients':detailReturnView));
$('edit-client-detail').addEventListener('click',()=>activeClientId&&openModal(activeClientId));
els.detailSearch.addEventListener('input',(e)=>{
  const c=clients.find(x=>x.id===activeClientId);
  if(c)renderClientDetail(c,e.target.value);
});
window.addEventListener('resize',()=>{if(document.querySelector('#dashboard-view.active'))renderMonthlyChart()});
window.addEventListener('keydown',(e)=>{if(e.key==='Escape'&&!els.modalBackdrop.classList.contains('hidden'))closeModal()});

updateDashboard();
renderClients();
renderProjectBoard();
