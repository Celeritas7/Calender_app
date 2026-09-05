/* ═══════════════ SUPABASE ═══════════════ */
const sb = window.supabase.createClient(
  'https://wylxvmkcrexwfpjpbhyy.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5bHh2bWtjcmV4d2ZwanBiaHl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MzkxMDYsImV4cCI6MjA4NDIxNTEwNn0.6Bxo42hx4jwlJGWnfjiTpiDUsYfc1QLTN3YtrU1efak'
);

/* UID is now dynamic — set after login */
let UID = null;

/* ── Guest / preview mode: no account, local-only, all cloud calls no-op ── */
let GUEST = false;
const _sbFrom = sb.from.bind(sb);
function _sbStub(){
  const res={data:null,error:null};
  const ch=new Proxy({},{get(_,p){
    if(p==='then')return (r)=>Promise.resolve(res).then(r);
    if(p==='catch'||p==='finally')return ()=>ch;
    return ()=>ch;
  }});
  return ch;
}
sb.from = (t) => GUEST ? _sbStub() : _sbFrom(t);
async function enterGuest(){
  GUEST = true;
  UID = 'guest';
  hideLoginScreen();
  await bootApp();
  if(typeof flashToast==='function') flashToast('👤 Preview mode — saved on this device only');
}

/* ═══════════════ AUTH ═══════════════ */
let loginTab = 'signin';

function switchTab(tab) {
  loginTab = tab;
  document.getElementById('tab-signin').classList.toggle('act', tab === 'signin');
  document.getElementById('tab-signup').classList.toggle('act', tab === 'signup');
  document.getElementById('login-btn').textContent = tab === 'signin' ? 'Sign In' : 'Create Account';
  document.getElementById('login-subtitle').textContent = tab === 'signin' ? 'Sign in to your calendar' : 'Create your calendar account';
  document.getElementById('login-error').textContent = '';
  document.getElementById('login-error').className = 'login-error';
}

async function handleAuth() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  const btn = document.getElementById('login-btn');

  errEl.textContent = '';
  errEl.className = 'login-error';

  if (!email || !password) {
    errEl.textContent = 'Please enter your email and password';
    errEl.className = 'login-error err';
    return;
  }

  btn.disabled = true;
  btn.textContent = '...';

  try {
    let result;
    if (loginTab === 'signin') {
      result = await sb.auth.signInWithPassword({ email, password });
    } else {
      result = await sb.auth.signUp({ email, password });
      if (!result.error && result.data?.user && !result.data?.session) {
        errEl.textContent = '✓ Check your email to confirm your account!';
        errEl.className = 'login-error ok';
        btn.disabled = false;
        btn.textContent = 'Create Account';
        return;
      }
    }
    if (result.error) throw result.error;
    // onAuthStateChange will handle the rest
  } catch (e) {
    errEl.textContent = e.message;
    errEl.className = 'login-error err';
    btn.disabled = false;
    btn.textContent = loginTab === 'signin' ? 'Sign In' : 'Create Account';
  }
}

async function signInWithGoogle() {
  const errEl = document.getElementById('login-error');
  errEl.textContent = '';
  errEl.className = 'login-error';
  try {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.href }
    });
    if (error) throw error;
  } catch (e) {
    errEl.textContent = e.message;
    errEl.className = 'login-error err';
  }
}

async function signOut() {
  await sb.auth.signOut();
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
}

function hideLoginScreen() {
  document.getElementById('login-screen').style.display = 'none';
}

/* ═══════════════ CONSTANTS ═══════════════ */
const MO=['January','February','March','April','May','June','July','August','September','October','November','December'];
const DN=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MC={red:'#d63031',pink:'#e84393',teal:'#00b894',cyan:'#00cec9',orange:'#e17055',purple:'#6c5ce7',yellow:'#fdcb6e'};
const TH=[{name:'Newsprint',emoji:'📰'},{name:'Linen',emoji:'🪷'},{name:'Terminal Green',emoji:'🟢'},{name:'Botanical Sketch',emoji:'🌾'},{name:'Concrete',emoji:'🧱'},{name:'Plum Velvet',emoji:'🍷'},{name:'Solar Flare',emoji:'🌞'},{name:'Parchment Journal',emoji:'📜'},{name:'Midnight Tokyo',emoji:'🌃'},{name:'Forest Morning',emoji:'🌿'},{name:'Ocean Breeze',emoji:'🌊'},{name:'Sunset Amber',emoji:'🌅'},{name:'Lavender Dusk',emoji:'🪻'},{name:'Carbon Night',emoji:'🖤'},{name:'Paper White',emoji:'⬜'}];
let curYear=new Date().getFullYear(),curMonth=new Date().getMonth();
let calData={},modalKey=null,modalColor='red',manualTheme=-1,wxMode=false;
let birthdays=[];
let diaryMood='good';
let diaryLineMoods=[];
let holidays={};
let weatherData={};

function $(id){return document.getElementById(id)}

/* ═══════════════ JAPAN HOLIDAYS ═══════════════ */
const JP_HOLIDAYS_STATIC = {
  '2025-01-01':'New Year','2025-01-13':'Coming of Age','2025-02-11':'Foundation Day',
  '2025-02-23':'Emperor\'s Birthday','2025-02-24':'Holiday (observed)','2025-03-20':'Vernal Equinox',
  '2025-04-29':'Shōwa Day','2025-05-03':'Constitution Day','2025-05-04':'Greenery Day',
  '2025-05-05':'Children\'s Day','2025-05-06':'Holiday (observed)','2025-07-21':'Marine Day',
  '2025-08-11':'Mountain Day','2025-09-15':'Respect for Aged','2025-09-23':'Autumnal Equinox',
  '2025-10-13':'Sports Day','2025-11-03':'Culture Day','2025-11-23':'Labor Thanksgiving','2025-11-24':'Holiday (observed)',
  '2026-01-01':'New Year','2026-01-12':'Coming of Age','2026-02-11':'Foundation Day',
  '2026-02-23':'Emperor\'s Birthday','2026-03-20':'Vernal Equinox',
  '2026-04-29':'Shōwa Day','2026-05-03':'Constitution Day','2026-05-04':'Greenery Day',
  '2026-05-05':'Children\'s Day','2026-05-06':'Holiday (observed)','2026-07-20':'Marine Day',
  '2026-08-11':'Mountain Day','2026-09-21':'Respect for Aged','2026-09-23':'Autumnal Equinox',
  '2026-10-12':'Sports Day','2026-11-03':'Culture Day','2026-11-23':'Labor Thanksgiving'
};
Object.assign(holidays, JP_HOLIDAYS_STATIC);

async function refreshHolidays() {
  try {
    const year = new Date().getFullYear();
    for (const y of [year, year + 1]) {
      const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${y}/JP`);
      if (!res.ok) continue;
      const data = await res.json();
      data.forEach(h => { holidays[h.date] = h.localName || h.name; });
    }
  } catch (e) { console.warn('Holiday API failed, using static:', e.message); }
}

function getHoliday(dateStr) { return holidays[dateStr] || null; }

/* ═══════════════ WEATHER ═══════════════ */
const WX_ICONS = {
  0:'☀️',1:'🌤️',2:'⛅',3:'☁️',45:'🌫️',48:'🌫️',
  51:'🌦️',53:'🌦️',55:'🌧️',61:'🌧️',63:'🌧️',65:'🌧️',
  66:'🌧️',67:'🌧️',71:'❄️',73:'❄️',75:'❄️',77:'❄️',
  80:'🌧️',81:'🌧️',82:'🌧️',85:'❄️',86:'❄️',95:'⛈️',96:'⛈️',99:'⛈️'
};

async function loadWeather() {
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=35.79&longitude=140.06&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=Asia%2FTokyo&forecast_days=7');
    if (!res.ok) return;
    const d = await res.json();
    const days = d.daily;
    for (let i = 0; i < days.time.length; i++) {
      const code = days.weathercode[i];
      const tMax = days.temperature_2m_max[i];
      const tMin = days.temperature_2m_min[i];
      let icon = WX_ICONS[code] || '🌤️';
      if (tMin <= 0) icon = '🥶';
      weatherData[days.time[i]] = { icon, tMax: Math.round(tMax), tMin: Math.round(tMin), code };
    }
  } catch (e) { console.warn('Weather failed:', e.message); }
}

/* ═══════════════ BIRTHDAYS ═══════════════ */
async function loadBirthdays() {
  try {
    const { data } = await sb.from('calendar_app_birthdays').select('*').eq('user_id', UID);
    birthdays = data || [];
  } catch (e) { console.warn('Bday load failed:', e); birthdays = []; }
}

function getBdaysForDate(month, day) {
  return birthdays.filter(b => {
    const d = new Date(b.birth_date + 'T00:00:00');
    return d.getMonth() === month && d.getDate() === day;
  });
}

function calcAge(birthDate, onDate) {
  let age = onDate.getFullYear() - birthDate.getFullYear();
  const m = onDate.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && onDate.getDate() < birthDate.getDate())) age--;
  return age;
}

function yearKnown(b) {
  return new Date(b.birth_date + 'T00:00:00').getFullYear() !== 1900;
}

function openBdayManager() { $('bday-ov').classList.remove('hidden'); renderBdayList(); }
function closeBdayManager() { $('bday-ov').classList.add('hidden'); cancelEdit(); }

function renderBdayList() {
  const list = $('bday-list');
  if (birthdays.length === 0) {
    list.innerHTML = '<div style="text-align:center;color:var(--txt2);padding:20px;font-size:14px">No birthdays yet — add one below!</div>';
    return;
  }
  const sorted = [...birthdays].sort((a, b) => {
    const da = new Date(a.birth_date + 'T00:00:00'), db = new Date(b.birth_date + 'T00:00:00');
    return (da.getMonth() * 100 + da.getDate()) - (db.getMonth() * 100 + db.getDate());
  });
  list.innerHTML = sorted.map(b => {
    const d = new Date(b.birth_date + 'T00:00:00');
    const yk = yearKnown(b);
    const age = yk ? calcAge(d, new Date()) : null;
    const dateStr = `${d.getDate()} ${MO[d.getMonth()]}` + (yk ? ` ${d.getFullYear()} · Age ${age}` : '');
    return `<div class="bday-row">
      <div class="bday-row-info">
        <span class="bday-row-name">🎂 ${esc(b.person_name)}</span>
        <span class="bday-row-date">${dateStr}</span>
      </div>
      <div class="bday-row-actions">
        <button onclick="editBday('${b.id}')" title="Edit">✏️</button>
        <button onclick="deleteBday('${b.id}')" title="Delete">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

let editingBdayId = null;

function editBday(id) {
  const b = birthdays.find(x => x.id === id);
  if (!b) return;
  const d = new Date(b.birth_date + 'T00:00:00');
  $('bday-name').value = b.person_name;
  $('bday-day').value = d.getDate();
  $('bday-month').value = d.getMonth() + 1;
  $('bday-year').value = yearKnown(b) ? d.getFullYear() : '';
  editingBdayId = id;
  $('bday-add-btn').textContent = 'Save';
  $('bday-msg').textContent = 'Editing — change fields and hit Save';
  $('bday-msg').style.color = 'var(--goal)';
}

function cancelEdit() {
  editingBdayId = null;
  $('bday-name').value = '';
  $('bday-day').value = '';
  $('bday-month').value = '';
  $('bday-year').value = '';
  $('bday-add-btn').textContent = 'Add';
  $('bday-msg').textContent = '';
}

async function addBday() {
  const name = $('bday-name').value.trim();
  const day = $('bday-day').value;
  const month = $('bday-month').value;
  const year = $('bday-year').value.trim();
  $('bday-msg').textContent = '';
  $('bday-msg').style.color = 'var(--accent)';
  if (!name || !day || !month) return ($('bday-msg').textContent = 'Fill in name, day, and month');
  const y = year ? parseInt(year) : 1900;
  const m = String(parseInt(month)).padStart(2, '0');
  const d = String(parseInt(day)).padStart(2, '0');
  const date = `${y}-${m}-${d}`;
  if (editingBdayId) {
    try {
      const { data, error } = await sb.from('calendar_app_birthdays').update({ person_name: name, birth_date: date }).eq('id', editingBdayId).select();
      if (error) throw error;
      const idx = birthdays.findIndex(b => b.id === editingBdayId);
      if (idx >= 0) birthdays[idx] = data[0];
      cancelEdit(); renderBdayList(); renderCal();
    } catch (e) { $('bday-msg').textContent = e.message; }
  } else {
    try {
      const { data, error } = await sb.from('calendar_app_birthdays').insert({ user_id: UID, person_name: name, birth_date: date }).select();
      if (error) throw error;
      birthdays.push(data[0]);
      cancelEdit(); renderBdayList(); renderCal();
    } catch (e) { $('bday-msg').textContent = e.message; }
  }
}

async function deleteBday(id) {
  try {
    await sb.from('calendar_app_birthdays').delete().eq('id', id);
    birthdays = birthdays.filter(b => b.id !== id);
    renderBdayList(); renderCal();
  } catch (e) { console.error('Delete bday:', e); }
}

/* ═══════════════ WEATHER VIEW ═══════════════ */
function toggleWxView(){
  wxMode=!wxMode;
  document.body.classList.toggle('wx-mode',wxMode);
  $('wx-toggle').classList.toggle('wx-view-active',wxMode);
  $('wx-toggle').title=wxMode?'Normal View':'Weather View';
  renderCal();
}

/* ═══════════════ THEMES ═══════════════ */
function autoTheme(){const n=new Date(),s=new Date(n.getFullYear(),0,0);return Math.floor((n-s)/864e5)%TH.length}
function activeTheme(){return manualTheme===-1?autoTheme():manualTheme}
function applyTheme(i){document.body.setAttribute('data-theme',i);$('t-emoji').textContent=TH[i].emoji;$('t-name').textContent=TH[i].name}

function buildThemeDD(){
  const dd=$('theme-dd');dd.innerHTML='';
  let b=document.createElement('button');b.className='dd-opt'+(manualTheme===-1?' active':'');b.textContent='🔄 Auto (daily rotation)';
  b.onclick=()=>{manualTheme=-1;applyTheme(activeTheme());buildThemeDD();saveThemePref();closeAllDD()};dd.appendChild(b);
  dd.appendChild(Object.assign(document.createElement('div'),{className:'dd-div'}));
  TH.forEach((t,i)=>{let b=document.createElement('button');b.className='dd-opt'+(manualTheme===i?' active':'');b.textContent=t.emoji+' '+t.name;
  b.onclick=()=>{manualTheme=i;applyTheme(i);buildThemeDD();saveThemePref();closeAllDD()};dd.appendChild(b)});
}

async function saveThemePref(){await sb.from('calendar_app_preferences').upsert({user_id:UID,theme_pref:manualTheme},{onConflict:'user_id'})}
async function loadThemePref(){const{data}=await sb.from('calendar_app_preferences').select('theme_pref').eq('user_id',UID).single();manualTheme=data?.theme_pref??-1;buildThemeDD()}

/* ═══════════════ DROPDOWN ═══════════════ */
function toggleDD(id,e){e.stopPropagation();const el=$(id),was=el.classList.contains('hidden');closeAllDD();if(was)el.classList.remove('hidden')}
function closeAllDD(){document.querySelectorAll('.dd-panel').forEach(p=>p.classList.add('hidden'))}
document.addEventListener('click',closeAllDD);

/* ═══════════════ CALENDAR RENDERING ═══════════════ */
function daysIn(y,m){return new Date(y,m+1,0).getDate()}
function firstDay(y,m){const d=new Date(y,m,1).getDay();return d===0?6:d-1}

/* ═══════════════ MONTHLY PRINTOUT ═══════════════ */
const PO_KEY='calapp_print_opts';
function getPrintOpts(){let o={holidays:1,weather:1,notes:1,diary:1,goals:1,marks:1,bdays:1,tasks:1,sukkiri:1,fs:8,ch:.85};try{Object.assign(o,JSON.parse(localStorage.getItem(PO_KEY)||'{}'))}catch(e){}return o}
function togglePrintOpts(){const p=$('pr-opts');if(p.classList.toggle('open')){const o=getPrintOpts();p.querySelectorAll('input[data-po]').forEach(i=>{i.checked=!!o[i.dataset.po]});$('pr-fs').value=o.fs;$('pr-fs-v').textContent=o.fs+'px';$('pr-ch').value=o.ch;$('pr-ch-v').textContent=o.ch+'in';
  $('pr-fs').oninput=e=>{$('pr-fs-v').textContent=e.target.value+'px'};
  $('pr-ch').oninput=e=>{$('pr-ch-v').textContent=e.target.value+'in'};}}
function doPrint(){const o={};$('pr-opts').querySelectorAll('input[data-po]').forEach(i=>{o[i.dataset.po]=i.checked?1:0});o.fs=parseFloat($('pr-fs').value);o.ch=parseFloat($('pr-ch').value);localStorage.setItem(PO_KEY,JSON.stringify(o));$('pr-opts').classList.remove('open');printMonth(o)}
function printMonth(o){o=o||getPrintOpts();
  const dim=daysIn(curYear,curMonth),fd=firstDay(curYear,curMonth),pDim=daysIn(curYear,curMonth===0?11:curMonth-1);
  let h='<div class="pr-h"><div class="pr-mo">'+MO[curMonth]+'</div><div class="pr-yr">'+curYear+'</div></div><div class="pr-cal">';
  ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].forEach((d,i)=>{h+='<div class="pr-hdr'+(i>=5?' wk':'')+'">'+d+'</div>'});
  for(let i=0;i<42;i++){
    let day,cur;
    if(i<fd){day=pDim-fd+i+1;cur=false}else if(i<fd+dim){day=i-fd+1;cur=true}else{day=i-fd-dim+1;cur=false}
    const we=i%7>=5;
    const key=cur?curYear+'-'+String(curMonth+1).padStart(2,'0')+'-'+String(day).padStart(2,'0'):null;
    const hol=key?getHoliday(key):null;
    const dd=key?calData[key]:null,wx=key?weatherData[key]:null,bdays=cur?getBdaysForDate(curMonth,day):[];
    const skf=cur&&o.sukkiri&&typeof skCellFlags==='function'?skCellFlags(key):null;
    let inner='<span class="pr-d">'+day+'</span>';
    if(cur){
      if(o.sukkiri&&typeof skPrintCell==='function')inner+=skPrintCell(key);
      if(o.weather&&wx)inner+='<span class="pr-wx">'+wx.icon+'</span>';
      if(o.marks&&dd&&dd.marked)inner+='<svg class="pr-x" viewBox="0 0 40 40" preserveAspectRatio="none"><line x1="7" y1="7" x2="33" y2="33" stroke="'+(MC[dd.markColor]||MC.red)+'"/><line x1="33" y1="7" x2="7" y2="33" stroke="'+(MC[dd.markColor]||MC.red)+'"/></svg>';
      let lines='';
      if(o.goals&&dd&&dd.isGoal)lines+='<div class="pr-goal">★ GOAL</div>';
      if(o.notes&&dd&&dd.note)lines+='<div class="pr-note">'+esc(dd.note)+'</div>';
      if(o.tasks)tasksOn(key).forEach(t=>{lines+='<div class="pr-task'+(t.done?' done':'')+'">▢ '+(t.urg?'⚑ ':'')+esc(t.text)+(t.time?' · '+t.time:'')+'</div>'});
      if(o.diary&&dd&&dd.diary){const dec=decodeDiary(dd.diary);const prev=dec.text.split('\n').filter(l=>l.trim()).join(' · ');if(prev)lines+='<div class="pr-diary">📖 '+esc(prev)+'</div>'}
      if(o.bdays)bdays.forEach(b=>{lines+='<div class="pr-bday">🎂 '+esc(b.person_name)+'</div>'});
      if(o.sukkiri)lines+=skPrintLines(key);
      if(lines)inner+='<div class="pr-body">'+lines+'</div>';
      if(o.holidays&&hol)inner+='<span class="pr-hol">🎌 '+esc(hol)+'</span>';
    }
    h+='<div class="pr-cell'+(we?' we':'')+(cur?'':' om')+(hol?' hol':'')+(skf?' sk-clean'+(skf.clash?' sk-clash':'')+(skf.urg?' sk-urgclash':''):'')+'"'+(skf?' style="--sk-c:'+skf.color+'"':'')+'>'+inner+'</div>';
  }
  const ps=document.getElementById('print-sheet');
  ps.style.setProperty('--pr-fs',(o.fs||8)+'px');
  ps.style.setProperty('--pr-cellmin',(o.ch||.85)+'in');
  ps.innerHTML=h+'</div>';
  window.print();
}

function isToday(d){const t=new Date();return d===t.getDate()&&curMonth===t.getMonth()&&curYear===t.getFullYear()}
function dk(d){return`${curYear}-${String(curMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`}
function esc(s){const d=document.createElement('div');d.textContent=s;return d.innerHTML}
function xSvg(c){return`<svg class="xm" width="28" height="28" viewBox="0 0 40 40"><line x1="7" y1="7" x2="33" y2="33" stroke="${c}" stroke-width="4" stroke-linecap="round"/><line x1="33" y1="7" x2="7" y2="33" stroke="${c}" stroke-width="4" stroke-linecap="round"/></svg>`}

function renderCal(){
  const c=$('cells'),dim=daysIn(curYear,curMonth),fd=firstDay(curYear,curMonth),pDim=daysIn(curYear,curMonth===0?11:curMonth-1);
  const total=Math.ceil((fd+dim)/7)*7,rows=Math.ceil(total/7);
  skOccCache.from='';
  $('m-name').textContent=MO[curMonth];$('y-label').textContent=curYear;
  let h='';
  for(let i=0;i<total;i++){
    let day,cur;
    if(i<fd){day=pDim-fd+i+1;cur=false}else if(i<fd+dim){day=i-fd+1;cur=true}else{day=i-fd-dim+1;cur=false}
    const we=i%7>=5,lr=Math.floor(i/7)===rows-1;
    const key=cur?dk(day):null,dd=key?calData[key]:null;
    const hol=cur?getHoliday(key):null;
    const bdays=cur?getBdaysForDate(curMonth,day):[];
    const wx=cur?weatherData[key]:null;
    const today=isToday(day)&&cur;
    let cls='cell';
    if(cur)cls+=' cur';else cls+=' om';
    if(we&&cur)cls+=' we';
    if(lr)cls+=' lr';
    if(hol&&cur)cls+=' holiday';
    if(bdays.length>0&&cur)cls+=' birthday';
    const skf=cur&&typeof skCellFlags==='function'?skCellFlags(key):null;
    if(skf)cls+=' sk-clean'+(skf.clash?' sk-clash':'')+(skf.urg?' sk-urgclash':'');
    let dcls='dnum';
    h+=`<div class="${cls}" ${skf?`style="--sk-c:${skf.color}"`:''} ${cur?`data-k="${key}"`:''}>`;
    if(today) h+='<div class="today-dot"></div>';
    if(wx&&cur&&bdays.length===0) h+=`<span class="wx-icon">${wx.icon}</span>`;
    if(bdays.length>0&&cur) h+='<span class="bday-icon">🎂</span>';
    if(cur)h+=skCellHtml(key);
    h+=`<div class="${dcls}">${day}</div>`;
    if(cur&&dd){
      if(dd.marked)h+=xSvg(MC[dd.markColor]||MC.red);
      if(dd.isGoal)h+='<div class="gb">★ GOAL</div>';
      if(dd.note)h+=`<div class="np">${esc(dd.note)}</div>`;
      if(dd.diary){
        const dm=diaryOverallMood(dd.diary);
        const dcls=dm==='mixed'?'di-mixed':dm==='good'?'di-good':dm==='bad'?'di-bad':'';
        const pcls=dm==='mixed'?'dp-mixed':dm==='good'?'dp-good':dm==='bad'?'dp-bad':'dp-neutral';
        const decoded=decodeDiary(dd.diary);
        const preview=decoded.text.split('\n').filter(l=>l.trim()).join(' · ');
        h+=`<div class="dp ${pcls}">${esc(preview)}</div>`;
        h+=`<div class="di ${dcls}">📖</div>`;
      }
    }
    if(cur&&tkStyle.show){
      tasksOn(key).forEach(t=>{h+=`<div class="tk${t.done?' done':''}${t.urg?' urg':''}"><span class="tkd"></span><span>${esc(t.text)}${t.time?' · '+t.time:''}</span></div>`});
    }
    if(cur)h+=skCellBodyHtml(key);
    if(bdays.length>0&&cur){
      const bname=bdays.map(b=>b.person_name).join(', ');
      h+=`<span class="bday-name">${esc(bname)}</span>`;
    }
    if(hol&&cur&&bdays.length===0) h+=`<span class="holiday-tag">🎌 ${esc(hol)}</span>`;
    if(cur&&wx) h+=`<div class="wx-big"><span class="wx-big-icon">${wx.icon}</span><div class="wx-temps"><span class="wx-hi">${wx.tMax}°</span><span class="wx-lo">${wx.tMin}°</span></div></div>`;
    else if(cur&&!wx) h+='<div class="wx-big"><span class="wx-none">—</span></div>';
    h+='</div>';
  }
  c.innerHTML=h;
  c.querySelectorAll('.cell.cur').forEach(el=>{
    el.addEventListener('click',()=>{
      if(bulkMode) bulkToggleCell(el.dataset.k);
      else openModal(el.dataset.k,calData[el.dataset.k]);
    });
  });
  const g=$('cal-grid');g.style.animation='none';g.offsetHeight;g.style.animation='slideIn .35s ease';
  updateStats();
}

function updateStats(){
  if(wxMode){
    const keys=Object.keys(weatherData);
    if(keys.length>0){
      const temps=Object.values(weatherData);
      const hi=Math.max(...temps.map(w=>w.tMax)),lo=Math.min(...temps.map(w=>w.tMin));
      const hasRain=temps.some(w=>[51,53,55,61,63,65,66,67,80,81,82].includes(w.code));
      const hasSnow=temps.some(w=>[71,73,75,77,85,86].includes(w.code));
      let summary=`<span>🌡️ Week: <b style="color:#e74c3c">${hi}°C</b> / <b style="color:#3498db">${lo}°C</b></span>`;
      if(hasRain)summary+='<span>🌧️ Rain expected</span>';
      if(hasSnow)summary+='<span>❄️ Snow expected</span>';
      if(lo<=0)summary+='<span>🥶 Below freezing</span>';
      $('stats').innerHTML=summary;
    } else { $('stats').innerHTML='<span>No weather data — only shows 7 days from today</span>'; }
    return;
  }
  const ent=Object.values(calData),m=ent.filter(e=>e.marked).length,g=ent.filter(e=>e.isGoal).length,d=ent.filter(e=>e.diary).length;
  $('stats').innerHTML=m+g+d===0?'Tap any day to start tracking':`<span>✕ ${m} marked</span><span>⭐ ${g} goals</span><span>📖 ${d} diary entries</span>`;
}

/* ═══════════════ NAVIGATION ═══════════════ */
function prevMonth(){if(curMonth===0){curMonth=11;curYear--}else curMonth--;loadAndRender()}
function nextMonth(){if(curMonth===11){curMonth=0;curYear++}else curMonth++;loadAndRender()}
function goToday(){const t=new Date();curYear=t.getFullYear();curMonth=t.getMonth();loadAndRender()}

/* ═══════════════ MONTH/YEAR PICKER ═══════════════ */
function openPicker(){
  const ov=$('picker-ov');
  let h='<div class="picker"><div class="picker-col" style="flex:1"><div class="picker-col-label">Month</div><div class="picker-months">';
  MO.forEach((m,i)=>{h+=`<button class="picker-mo${i===curMonth?' act':''}" data-m="${i}">${m.slice(0,3)}</button>`;});
  h+='</div></div><div class="picker-col"><div class="picker-col-label">Year</div><div class="picker-years" id="picker-yrs">';
  const curYr=new Date().getFullYear();
  for(let y=curYr+5;y>=2020;y--){h+=`<button class="picker-yr${y===curYear?' act':''}" data-y="${y}">${y}</button>`;}
  h+='</div></div></div>';
  ov.innerHTML=h;
  ov.classList.remove('hidden');
  ov.querySelectorAll('.picker-mo').forEach(b=>{
    b.onclick=()=>{curMonth=parseInt(b.dataset.m);ov.querySelectorAll('.picker-mo').forEach(x=>x.classList.remove('act'));b.classList.add('act');$('m-name').textContent=MO[curMonth];};
  });
  ov.querySelectorAll('.picker-yr').forEach(b=>{
    b.onclick=()=>{curYear=parseInt(b.dataset.y);ov.querySelectorAll('.picker-yr').forEach(x=>x.classList.remove('act'));b.classList.add('act');$('y-label').textContent=curYear;};
  });
  setTimeout(()=>{const actY=ov.querySelector('.picker-yr.act');if(actY)actY.scrollIntoView({block:'center',behavior:'instant'});},50);
}

function closePicker(){ $('picker-ov').classList.add('hidden'); loadAndRender(); }

/* ═══════════════ BULK MARK MODE ═══════════════ */
let bulkMode=false, bulkColor='red';

function toggleBulkMode(){
  bulkMode=!bulkMode;
  $('bulk-toggle').classList.toggle('bulk-active',bulkMode);
  $('bulk-bar').classList.toggle('hidden',!bulkMode);
  if(bulkMode) buildBulkDots();
  renderCal();
}

function buildBulkDots(){
  const el=$('bulk-dots');el.innerHTML='';
  Object.entries(MC).forEach(([n,c])=>{
    const b=document.createElement('button');
    b.className='bulk-dot'+(bulkColor===n?' act':'');
    b.style.background=c;
    b.onclick=()=>{bulkColor=n;buildBulkDots()};
    el.appendChild(b);
  });
}

async function bulkToggleCell(key){
  const existing=calData[key];
  if(existing&&existing.marked){
    existing.marked=false;existing.markColor='red';
    const empty=!existing.marked&&!existing.isGoal&&!existing.note&&!existing.diary;
    if(empty)delete calData[key];
    try{
      if(empty) await sb.from('calendar_app_entries').delete().eq('user_id',UID).eq('entry_date',key);
      else await sb.from('calendar_app_entries').upsert({user_id:UID,entry_date:key,is_marked:false,mark_color:'red',is_goal:existing.isGoal||false,note:existing.note||null},{onConflict:'user_id,entry_date'});
    }catch(e){console.error('Bulk:',e)}
  } else {
    if(!calData[key]) calData[key]={marked:false,markColor:'red',isGoal:false,note:'',diary:''};
    calData[key].marked=true;calData[key].markColor=bulkColor;
    try{
      await sb.from('calendar_app_entries').upsert({user_id:UID,entry_date:key,is_marked:true,mark_color:bulkColor,is_goal:calData[key].isGoal||false,note:calData[key].note||null},{onConflict:'user_id,entry_date'});
    }catch(e){console.error('Bulk:',e)}
  }
  renderCal();
}

document.addEventListener('keydown',e=>{if(!$('modal-ov').classList.contains('hidden')||!$('bday-ov').classList.contains('hidden')||!$('picker-ov').classList.contains('hidden'))return;if(e.key==='ArrowLeft')prevMonth();if(e.key==='ArrowRight')nextMonth()});

/* ═══════════════ LOAD DATA ═══════════════ */
async function loadAndRender(){
  $('toast').classList.remove('hidden');
  const s=`${curYear}-${String(curMonth+1).padStart(2,'0')}-01`,last=daysIn(curYear,curMonth),e=`${curYear}-${String(curMonth+1).padStart(2,'0')}-${last}`;
  calData={};
  try{
    const{data:cal}=await sb.from('calendar_app_entries').select('entry_date,is_marked,mark_color,is_goal,note').eq('user_id',UID).gte('entry_date',s).lte('entry_date',e);
    const{data:diary}=await sb.from('calendar_app_diary').select('entry_date,content').eq('user_id',UID).gte('entry_date',s).lte('entry_date',e);
    (cal||[]).forEach(r=>{calData[r.entry_date]={marked:r.is_marked,markColor:r.mark_color||'red',isGoal:r.is_goal,note:r.note||'',diary:''}});
    (diary||[]).forEach(r=>{if(!calData[r.entry_date])calData[r.entry_date]={marked:false,markColor:'red',isGoal:false,note:'',diary:''};calData[r.entry_date].diary=r.content||''});
  }catch(err){console.error('Load:',err)}
  $('toast').classList.add('hidden');renderCal();
}

/* ═══════════════ DAY MODAL ═══════════════ */
function buildCP(){const cpk=$('cpk');cpk.innerHTML='';Object.entries(MC).forEach(([n,c])=>{const b=document.createElement('button');b.className='cdot'+(modalColor===n?' act':'');b.style.background=c;b.onclick=()=>{modalColor=n;buildCP()};cpk.appendChild(b)})}
function toggleCP(){$('cpk').classList.toggle('hidden',!$('chk-mark').checked)}

function setDiaryMood(m){
  diaryMood=m;
  document.querySelectorAll('.diary-mood').forEach(b=>b.classList.remove('act'));
  $('dm-'+m).classList.add('act');
  const ta=$('inp-diary');
  const pos=ta.selectionStart;
  let lineIdx=ta.value.substring(0,pos).split('\n').length-1;
  while(diaryLineMoods.length<=lineIdx)diaryLineMoods.push({mood:'neutral'});
  diaryLineMoods[lineIdx].mood=m;
  diaryPreviewUpdate();
}

function diaryPreviewUpdate(){
  const raw=$('inp-diary').value;
  const prev=$('diary-preview');
  if(!raw.trim()){prev.innerHTML='';return}
  const lines=raw.split('\n');
  while(diaryLineMoods.length<lines.length)diaryLineMoods.push({mood:diaryMood});
  diaryLineMoods.length=lines.length;
  const ta=$('inp-diary');
  const curLine=ta.value.substring(0,ta.selectionStart).split('\n').length-1;
  diaryLineMoods[curLine].mood=diaryMood;
  prev.innerHTML=lines.map((l,i)=>{
    if(!l.trim())return'';
    const m=diaryLineMoods[i]?.mood||'neutral';
    const cls='dl-'+m;
    const dotColor=m==='good'?'#27ae60':m==='bad'?'#e74c3c':'#999';
    return `<div class="${cls}"><span class="dl-dot" style="background:${dotColor}"></span>${esc(l)}</div>`;
  }).join('');
}

function encodeDiary(){
  const raw=$('inp-diary').value;
  if(!raw.trim())return'';
  return raw.split('\n').map((l,i)=>{
    if(!l.trim())return'';
    const m=diaryLineMoods[i]?.mood||'neutral';
    if(m==='good')return'+'+l;
    if(m==='bad')return'-'+l;
    return '~'+l;
  }).filter(l=>l).join('\n');
}

function decodeDiary(encoded){
  if(!encoded)return{text:'',moods:[]};
  const lines=encoded.split('\n');
  const text=[],moods=[];
  lines.forEach(l=>{
    if(l.startsWith('+')){ moods.push({mood:'good'}); text.push(l.slice(1)); }
    else if(l.startsWith('-')){ moods.push({mood:'bad'}); text.push(l.slice(1)); }
    else if(l.startsWith('~')){ moods.push({mood:'neutral'}); text.push(l.slice(1)); }
    else { moods.push({mood:'neutral'}); text.push(l); }
  });
  return{text:text.join('\n'),moods};
}

function diaryOverallMood(encoded){
  if(!encoded)return null;
  const lines=encoded.split('\n');
  let g=0,b=0;
  lines.forEach(l=>{if(l.startsWith('+'))g++;else if(l.startsWith('-'))b++});
  if(g>0&&b>0)return'mixed';
  if(g>0)return'good';
  if(b>0)return'bad';
  return null;
}

function openModal(key,data){
  modalKey=key;
  const d=new Date(key+'T00:00:00');
  $('m-title').textContent=`${d.getDate()} ${MO[d.getMonth()]}`;
  $('m-day').textContent=`${DN[d.getDay()]}, ${d.getFullYear()}`;
  const bdays=getBdaysForDate(d.getMonth(),d.getDate());
  if(bdays.length>0){
    const infos=bdays.map(b=>{
      const bd=new Date(b.birth_date+'T00:00:00');
      const yk=yearKnown(b);
      if(yk){const age=calcAge(bd,d);return `🎂 <b>${esc(b.person_name)}</b> turns <b>${age}</b>`;}
      return `🎂 <b>${esc(b.person_name)}</b>'s birthday`;
    }).join('<br>');
    $('modal-bday-info').innerHTML=`<div class="bday-info" style="margin-bottom:12px">${infos}</div>`;
  } else { $('modal-bday-info').innerHTML=''; }
  const hol=getHoliday(key);
  if(hol){
    $('modal-holiday-info').innerHTML=`<div class="bday-info" style="margin-bottom:12px;border-color:rgba(192,57,43,.25);background:linear-gradient(135deg,rgba(231,76,60,.08),rgba(241,196,15,.08))">🎌 <b>${esc(hol)}</b></div>`;
  } else { $('modal-holiday-info').innerHTML=''; }
  const wx=weatherData[key];
  if(wx){
    $('modal-wx-info').innerHTML=`<div class="bday-info" style="margin-bottom:12px;border-color:rgba(52,152,219,.25);background:linear-gradient(135deg,rgba(52,152,219,.08),rgba(46,204,113,.08))">${wx.icon} <b>${wx.tMax}°C</b> / ${wx.tMin}°C</div>`;
  } else { $('modal-wx-info').innerHTML=''; }
  renderModalTasks(key);
  renderModalSukkiri(key);
  const dd=data||{};
  $('chk-mark').checked=dd.marked||false;$('chk-goal').checked=dd.isGoal||false;
  $('inp-note').value=dd.note||'';
  modalColor=dd.markColor||'red';
  const decoded=decodeDiary(dd.diary||'');
  $('inp-diary').value=decoded.text;
  diaryLineMoods=decoded.moods;
  diaryMood='good';
  setDiaryMood('good');
  diaryPreviewUpdate();
  buildCP();toggleCP();$('modal-ov').classList.remove('hidden');
}

function closeModal(){$('modal-ov').classList.add('hidden');modalKey=null}

async function saveModal(){
  if(!modalKey)return;
  const key=modalKey;
  const encodedDiary=encodeDiary();
  const data={marked:$('chk-mark').checked,markColor:modalColor,isGoal:$('chk-goal').checked,note:$('inp-note').value.trim(),diary:encodedDiary};
  const empty=!data.marked&&!data.isGoal&&!data.note&&!data.diary;
  if(empty)delete calData[key];else calData[key]=data;
  closeModal();renderCal();
  try{
    if(data.marked||data.isGoal||data.note){await sb.from('calendar_app_entries').upsert({user_id:UID,entry_date:key,is_marked:data.marked,mark_color:data.markColor,is_goal:data.isGoal,note:data.note||null},{onConflict:'user_id,entry_date'})}
    else{await sb.from('calendar_app_entries').delete().eq('user_id',UID).eq('entry_date',key)}
    if(data.diary){await sb.from('calendar_app_diary').upsert({user_id:UID,entry_date:key,content:data.diary},{onConflict:'user_id,entry_date'})}
    else{await sb.from('calendar_app_diary').delete().eq('user_id',UID).eq('entry_date',key)}
  }catch(err){console.error('Save:',err)}
}

document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeBdayManager();closePicker();closeSukkiri()}});

/* ═══════════════ WEEKLY FOCUS TASKS ═══════════════ */
const TKS_KEY='calapp_task_style';
let tkStyle={show:true,font:'',size:9,cell:9,weight:400};
try{Object.assign(tkStyle,JSON.parse(localStorage.getItem(TKS_KEY)||'{}'))}catch(e){}
const TK_FONTS=['','Work Sans','Inter','DM Sans','Nunito','Source Sans 3','Chakra Petch','IBM Plex Mono','PT Serif','Caveat'];
function applyTkStyle(){
  document.body.style.setProperty('--tk-font',tkStyle.font?`'${tkStyle.font}',sans-serif`:'var(--b-font)');
  document.body.style.setProperty('--tk-size',tkStyle.size+'px');
  document.body.style.setProperty('--tk-weight',tkStyle.weight);
  document.body.style.setProperty('--cell-fs',tkStyle.cell+'px');
  document.body.style.setProperty('--cell-fs-sm',Math.max(4,tkStyle.cell-1)+'px');
}
function saveTkStyle(){try{localStorage.setItem(TKS_KEY,JSON.stringify(tkStyle))}catch(e){}applyTkStyle()}

let wfRows={};  /* 'board||item_key' -> payload */
let wfNames={}; /* item id -> name */
let wfTasks=[];
function wfLegacyId(t){let s=String(t||''),h=5381;for(let i=0;i<s.length;i++){h=((h*33)^s.charCodeAt(i))>>>0}return 'l_'+h.toString(36)}
async function loadWfTasks(){
  try{
    const{data:inv}=await sb.from('weekly_focus_inventory').select('apps,study,office');
    wfNames={};
    (inv||[]).forEach(r=>['apps','study','office'].forEach(k=>(r[k]||[]).forEach(it=>{if(it&&it.id)wfNames[it.id]=it.name||it.id})));
    const{data:rows}=await sb.from('weekly_focus_entries').select('board_id,item_key,payload');
    wfRows={};wfTasks=[];
    (rows||[]).forEach(r=>{
      wfRows[r.board_id+'||'+r.item_key]=r.payload||{};
      const p=r.payload||{};
      if(r.item_key==='__board')return;
      if(r.item_key==='__timeline'){
        (Array.isArray(p.notes)?p.notes:[]).forEach(n=>{if(!n||!n.t)return;
          wfTasks.push({kind:'note',board:r.board_id,itemKey:r.item_key,sid:n.id,text:n.t,date:(n.ts||'').slice(0,10),time:(n.ts||'').length>10?n.ts.slice(11,16):'',done:!!n.done,src:'Note'+(n.loc?' · '+n.loc:''),urg:false})});
        return;
      }
      if(r.item_key==='__inbox'){
        (Array.isArray(p.items)?p.items:[]).forEach(n=>{if(!n||!n.t)return;
          wfTasks.push({kind:'inbox',board:r.board_id,itemKey:r.item_key,sid:n.id,text:n.t,date:(n.day||'').slice(0,10),time:'',done:!!n.done,src:'Inbox'+(n.loc?' · '+n.loc:''),urg:false})});
        return;
      }
      const active=p.active===true;
      (Array.isArray(p.subtasks)?p.subtasks:[]).forEach(s=>{
        if(!s||s.del||!s.t)return;
        const when=s.when||'';
        if(!when&&!active)return; /* undated tasks only from active items */
        wfTasks.push({kind:'sub',board:r.board_id,itemKey:r.item_key,sid:s.id||wfLegacyId(s.t),text:s.t,date:when.slice(0,10),time:when.length>10?when.slice(11,16):'',done:!!s.done,src:(wfNames[r.item_key]||r.item_key.replace(/^(app|study|office):/,''))+(s.loc?' · '+s.loc:''),urg:!!s.urg});
      });
    });
  }catch(e){console.warn('WF tasks load failed:',e)}
}
function tasksOn(key){return wfTasks.filter(t=>t.date===key)}
function tasksUndated(){return wfTasks.filter(t=>!t.date)}
function tkRow(t){
  const a=s=>esc(String(s==null?'':s)).replace(/"/g,'&quot;');
  return `<div class="tk-row${t.done?' done':''}"><button class="tk-chk${t.done?' on':''}" data-tk-kind="${a(t.kind)}" data-tk-board="${a(t.board)}" data-tk-item="${a(t.itemKey)}" data-tk-sid="${a(t.sid)}">${t.done?'✓':''}</button><span class="tk-t">${t.urg?'<span class="tk-urgflag">⚑ </span>':''}${esc(t.text)}${t.time?' <b>· '+t.time+'</b>':''}</span><span class="tk-src">${esc(t.src)}</span></div>`;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('.tk-chk');
  if(!b||b.dataset.tkSid===undefined)return;
  e.stopPropagation();e.preventDefault();
  toggleWfTask(b.dataset.tkKind,b.dataset.tkBoard,b.dataset.tkItem,b.dataset.tkSid);
},true);
async function toggleWfTask(kind,board,itemKey,sid){
  const t=wfTasks.find(x=>x.kind===kind&&x.board===board&&x.itemKey===itemKey&&x.sid===sid);
  if(!t)return;
  t.done=!t.done;
  const rk=board+'||'+itemKey,p=Object.assign({},wfRows[rk]);
  if(kind==='sub')p.subtasks=(p.subtasks||[]).map(x=>{if(!x)return x;const xid=x.id||wfLegacyId(x.t);return xid===sid?Object.assign({},x,{done:t.done,u:Date.now()}):x});
  else if(kind==='note')p.notes=(p.notes||[]).map(x=>x&&x.id===sid?Object.assign({},x,{done:t.done}):x);
  else p.items=(p.items||[]).map(x=>x&&x.id===sid?Object.assign({},x,{done:t.done}):x);
  wfRows[rk]=p;
  renderCal();renderNoDate();
  if(modalKey)renderModalTasks(modalKey);
  try{await sb.from('weekly_focus_entries').upsert({user_id:UID,board_id:board,item_key:itemKey,payload:p,updated_at:new Date().toISOString()},{onConflict:'user_id,board_id,item_key'})}
  catch(e){console.error('Task sync:',e);flashToast('⚠️ Sync failed')}
}
function renderModalTasks(key){
  const el=$('modal-tasks');if(!el)return;
  const tks=tasksOn(key);
  el.innerHTML=tks.length?`<div class="msec"><span class="msec-t">📋 Weekly Focus tasks</span>${tks.map(tkRow).join('')}</div>`:'';
}
function renderNoDate(){
  const el=$('nd-panel');if(!el)return;
  const list=tasksUndated();
  if(!tkStyle.show||!list.length){el.classList.add('hidden');return}
  el.classList.remove('hidden');
  const open=list.filter(t=>!t.done),done=list.filter(t=>t.done);
  el.innerHTML=`<h3>📋 No date yet</h3><div class="nd-sub">Undated tasks from Weekly Focus — give them a date there, or tick them off here.</div><div class="nd-list">${open.concat(done).map(tkRow).join('')}</div>`;
}
function flashToast(msg){const t=$('toast');t.textContent=msg;t.classList.remove('hidden');setTimeout(()=>{t.classList.add('hidden');t.textContent='Loading...'},1400)}
function buildTaskDD(){
  const dd=$('task-dd');if(!dd)return;
  dd.innerHTML=`<button class="dd-opt" id="tk-show">${tkStyle.show?'✅':'⬜'} Show tasks on calendar</button>
<button class="dd-opt" id="tk-refresh">↻ Refresh from Weekly Focus</button>
<div class="dd-div"></div>
<div style="padding:6px 12px 2px;font-size:11px;color:var(--txt2);font-weight:700;letter-spacing:.5px">TASK TEXT</div>
<div style="padding:4px 12px"><select id="tk-font" style="width:100%;padding:6px;border:1.5px solid var(--border);border-radius:8px;background:var(--input-bg);color:var(--txt);font-family:var(--b-font)">${TK_FONTS.map(f=>`<option value="${f}"${tkStyle.font===f?' selected':''}>${f||'Theme font'}</option>`).join('')}</select></div>
<div style="display:flex;align-items:center;gap:8px;padding:4px 12px;font-size:12px;color:var(--txt)"><span>Size</span><input type="range" id="tk-size" min="4" max="16" step="0.5" value="${tkStyle.size}" style="flex:1;accent-color:var(--accent)"><b id="tk-size-v" style="min-width:38px;text-align:right">${tkStyle.size}px</b></div>
<div style="display:flex;gap:4px;padding:4px 12px 8px">${[[400,'Regular'],[600,'Semibold'],[700,'Bold']].map(w=>`<button class="dd-opt" data-tkw="${w[0]}" style="flex:1;justify-content:center;padding:5px;${tkStyle.weight==w[0]?'background:rgba(128,128,128,.18);font-weight:700':''}">${w[1]}</button>`).join('')}</div>
<div class="dd-div"></div>
<div style="padding:6px 12px 2px;font-size:11px;color:var(--txt2);font-weight:700;letter-spacing:.5px">NOTE / DIARY / BIRTHDAY TEXT</div>
<div style="display:flex;align-items:center;gap:8px;padding:4px 12px 8px;font-size:12px;color:var(--txt)"><span>Size</span><input type="range" id="tk-cell" min="4" max="14" step="0.5" value="${tkStyle.cell}" style="flex:1;accent-color:var(--accent)"><b id="tk-cell-v" style="min-width:38px;text-align:right">${tkStyle.cell}px</b></div>`;
  $('tk-show').onclick=()=>{tkStyle.show=!tkStyle.show;saveTkStyle();renderCal();renderNoDate();buildTaskDD()};
  $('tk-refresh').onclick=async()=>{await loadWfTasks();renderCal();renderNoDate();flashToast('Tasks refreshed')};
  $('tk-font').onchange=e=>{tkStyle.font=e.target.value;saveTkStyle()};
  $('tk-size').oninput=e=>{tkStyle.size=+e.target.value;$('tk-size-v').textContent=tkStyle.size+'px';saveTkStyle()};
  $('tk-cell').oninput=e=>{tkStyle.cell=+e.target.value;$('tk-cell-v').textContent=tkStyle.cell+'px';saveTkStyle()};
  dd.querySelectorAll('[data-tkw]').forEach(b=>b.onclick=()=>{tkStyle.weight=+b.dataset.tkw;saveTkStyle();buildTaskDD()});
}
function printTaskSheet(){
  $('pr-opts').classList.remove('open');
  const pref=curYear+'-'+String(curMonth+1).padStart(2,'0');
  const days={};
  wfTasks.forEach(t=>{if(t.date&&t.date.startsWith(pref))(days[t.date]=days[t.date]||[]).push(t)});
  const und=tasksUndated();
  let h='<div class="ts-h"><div class="ts-mo">'+MO[curMonth]+' '+curYear+' — Tasks</div><div class="ts-sub">Weekly Focus · printed '+new Date().toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})+'</div></div>';
  const keys=Object.keys(days).sort();
  if(!keys.length&&!und.length)h+='<div style="font-size:13px;color:#666">No tasks this month.</div>';
  h+='<div class="ts-cols">';
  keys.forEach(k=>{
    const d=new Date(k+'T00:00:00');
    h+='<div class="ts-daywrap"><div class="ts-day">'+d.getDate()+' '+MO[d.getMonth()].slice(0,3)+' <span class="ts-dw">'+DN[d.getDay()].slice(0,3)+'</span></div>';
    days[k].sort((a,b)=>(a.done?1:0)-(b.done?1:0)||(a.time||'').localeCompare(b.time||''));
    days[k].forEach(t=>{h+='<div class="ts-row'+(t.done?' done':'')+'"><span class="ts-box"></span><span>'+(t.urg?'⚑ ':'')+esc(t.text)+(t.time?' · '+t.time:'')+'</span><span class="ts-meta">'+esc(t.src)+'</span></div>'});
    h+='</div>';
  });
  h+='</div>';
  if(und.length)h+='<div class="ts-nd"><div class="ts-day">No date yet</div><div class="ts-cols">'+und.map(t=>'<div class="ts-row'+(t.done?' done':'')+'"><span class="ts-box"></span><span>'+esc(t.text)+'</span><span class="ts-meta">'+esc(t.src)+'</span></div>').join('')+'</div></div>';
  const ps=$('print-sheet');
  ps.classList.add('tsheet');ps.innerHTML=h;
  const prevTheme=document.body.getAttribute('data-theme');
  document.body.setAttribute('data-theme','14');
  window.print();
  document.body.setAttribute('data-theme',prevTheme);
  ps.classList.remove('tsheet');
}

/* ═══════════════ BOOT ═══════════════ */
async function bootApp() {
  await Promise.allSettled([loadThemePref(), loadBirthdays(), loadWeather(), refreshHolidays(), loadWfTasks(), loadSukkiri()]);
  skOccCache.from='';
  applyTheme(activeTheme());
  buildTaskDD();
  await loadAndRender();
  renderNoDate();
  console.log('✅ Calendar ready — user:', UID);
}

document.addEventListener('DOMContentLoaded', async () => {
  // Populate day/month dropdowns
  const daySel=$('bday-day'), monSel=$('bday-month');
  for(let i=1;i<=31;i++){const o=document.createElement('option');o.value=i;o.textContent=i;daySel.appendChild(o)}
  MO.forEach((m,i)=>{const o=document.createElement('option');o.value=i+1;o.textContent=m;monSel.appendChild(o)});

  // Apply default theme immediately (looks nice on login screen too)
  applyTheme(autoTheme());
  applyTkStyle();

  // Check if already logged in
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    UID = session.user.id;
    hideLoginScreen();
    await bootApp();
  } else {
    showLoginScreen();
  }

  // Listen for future auth changes (login / logout)
  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      UID = session.user.id;
      hideLoginScreen();
      await bootApp();
    } else if (event === 'SIGNED_OUT') {
      UID = null;
      calData = {};
      birthdays = {};
      showLoginScreen();
    }
  });
});
