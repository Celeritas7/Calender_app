/* ═══════════════ SUKKIRI — garbage days + cleaning cycles ═══════════════
   Sukkiri owns the ideal rules (shiyakusho garbage categories, cleaning intervals).
   The calendar owns the practical data (urgent tasks, away days) and applies them. */
const SK_KEY='calapp_sukkiri';
const SK_WD=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const SK_COLORS=['#c0392b','#e67e22','#2980b9','#27ae60','#8e44ad','#16a085','#7f8c8d'];
/* Monochrome glyphs — tinted with each category's colour, drawn as the cell watermark. */
const SK_ICONS={
  flame:'<path d="M12 2c3.2 4.2 6 6.3 6 10.2A6 6 0 1 1 6 12.2c0-2 .9-3.3 2.2-4.5 0 2 .8 3.1 1.8 3.1s1.5-1 1.5-3.1S10.6 4.2 12 2z"/>',
  recycle:'<g><path d="M12 2.6l3.2 5.5H8.8L12 2.6z"/><path d="M5.2 21.4l-3.2-5.5 5.5-3.2 3.2 5.5-5.5 3.2z" opacity=".85"/><path d="M18.8 21.4l-5.5-3.2 3.2-5.5 5.5 3.2-3.2 5.5z" opacity=".7"/></g>',
  bottle:'<path d="M10 2h4v2.6l1.9 3.1a3 3 0 0 1 .4 1.5V20a2 2 0 0 1-2 2h-4.6a2 2 0 0 1-2-2V9.2c0-.5.1-1 .4-1.5L10 4.6V2zm-.4 8.6h4.8v2.2H9.6v-2.2z"/>',
  can:'<path d="M7 5.2c0-1.2 2.2-2.2 5-2.2s5 1 5 2.2v13.6c0 1.2-2.2 2.2-5 2.2s-5-1-5-2.2V5.2zm1.6 2.4v2h6.8v-2H8.6z"/>',
  paper:'<path d="M6 2h7l5 5v15H6V2zm7 1.6V7h3.4L13 3.6zM8.4 10.4h7.2V12H8.4v-1.6zm0 3.4h7.2v1.6H8.4v-1.6zm0 3.4h4.8V19H8.4v-1.8z"/>',
  trash:'<path d="M9 2.6h6v2h4.4v2H4.6v-2H9v-2zM6 8.6h12l-1.1 12.2a1.4 1.4 0 0 1-1.4 1.2H8.5a1.4 1.4 0 0 1-1.4-1.2L6 8.6z"/>',
  leaf:'<path d="M21 3c-9.4 0-17 4.4-17 11.6 0 1.3.3 2.4.9 3.3L14 8.8l-8.4 10.6c.9.7 2 1 3.3 1C16.4 20.4 21 12.6 21 3z"/>',
  box:'<path d="M12 2.2l9 4.3v11l-9 4.3-9-4.3v-11l9-4.3zm0 2.3L5.6 7.5 12 10.5l6.4-3L12 4.5z"/>',
  battery:'<path d="M9 2h6v2.2h2.6V22H6.4V4.2H9V2zm-.6 6.4v2h7.2v-2H8.4z"/>',
  glass:'<path d="M5 2.6h14L17 11l-4 3.4V19h3v2.4H8V19h3v-4.6L7 11 5 2.6zm2.6 2.4l.8 3.4h7.2l.8-3.4H7.6z"/>'
};
const SK_ICON_IDS=Object.keys(SK_ICONS);
function skIconSvg(id,color,extra){
  const p=SK_ICONS[id];if(!p)return '';
  return `<svg viewBox="0 0 24 24" ${extra||''} style="fill:${color||'currentColor'}">${p}</svg>`;
}
function skDefaults(){
  const anchor=skNextDow(0);
  return {
    show:true,wm:true,
    block:{urg:true,any:false,away:true,hol:false},
    garbage:[
      {id:'g1',label:'Burnable',short:'燃 BURN',icon:'flame',days:[1,4],weeks:[],color:'#c0392b'},
      {id:'g2',label:'Plastic',short:'プラ PLA',icon:'recycle',days:[2],weeks:[],color:'#e67e22'},
      {id:'g3',label:'Cans · Bottles · PET',short:'缶 びん PET',icon:'can',days:[3],weeks:[],color:'#2980b9'},
      {id:'g4',label:'Paper',short:'紙 PAPER',icon:'paper',days:[5],weeks:[2,4],color:'#27ae60'},
      {id:'g5',label:'Non-burnable',short:'不燃 NON',icon:'trash',days:[5],weeks:[1,3],color:'#7f8c8d'}
    ],
    cycles:[
      {id:'c1',name:'Bathroom deep clean',every:14,anchor,color:'#8e44ad'},
      {id:'c2',name:'Fridge & kitchen',every:28,anchor,color:'#16a085'}
    ],
    overrides:{},done:{},away:[]
  };
}
function skNextDow(dow){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+((dow-d.getDay()+7)%7));return skKey(d)}
function skKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function skDate(k){return new Date(k+'T00:00:00')}
function skAdd(k,n){const d=skDate(k);d.setDate(d.getDate()+n);return skKey(d)}
function skId(){return 's'+Date.now().toString(36)+Math.random().toString(36).slice(2,5)}
let sk=skDefaults();
/* Older saved data has no icon/colour — infer a mark from the label so watermarks stay iconographic. */
function skMigrate(){
  const guess=(s)=>{s=(s||'').toLowerCase();
    if(/burn|燃|combust/.test(s)&&!/non|不/.test(s))return 'flame';
    if(/non.?burn|不燃/.test(s))return 'trash';
    if(/plastic|プラ|recycl/.test(s))return 'recycle';
    if(/can|缶|bottle|pet|びん/.test(s))return 'can';
    if(/paper|紙|card/.test(s))return 'paper';
    if(/glass|ガラス/.test(s))return 'glass';
    if(/batter|電池|small metal/.test(s))return 'battery';
    if(/garden|leaf|green|草/.test(s))return 'leaf';
    if(/large|bulky|粗大/.test(s))return 'box';
    return 'bottle';};
  (sk.garbage||[]).forEach(g=>{if(!g.icon||!SK_ICONS[g.icon])g.icon=guess(g.label||g.short)});
  (sk.cycles||[]).forEach((c,i)=>{if(!c.color)c.color=SK_COLORS[(i+4)%SK_COLORS.length]});
}
try{const s=JSON.parse(localStorage.getItem(SK_KEY)||'null');if(s)sk=Object.assign(skDefaults(),s)}catch(e){}
skMigrate();

async function loadSukkiri(){
  try{
    const{data}=await sb.from('calendar_app_sukkiri').select('payload').eq('user_id',UID).maybeSingle();
    if(data&&data.payload){sk=Object.assign(skDefaults(),data.payload);skMigrate();localStorage.setItem(SK_KEY,JSON.stringify(sk))}
  }catch(e){/* table optional — localStorage is the fallback */}
}
async function saveSukkiri(){
  try{localStorage.setItem(SK_KEY,JSON.stringify(sk))}catch(e){}
  if(typeof renderCal==='function')renderCal();
  try{await sb.from('calendar_app_sukkiri').upsert({user_id:UID,payload:sk,updated_at:new Date().toISOString()},{onConflict:'user_id'})}catch(e){}
}

/* ── garbage ── */
function skGarbageOn(key){
  const d=skDate(key),dow=d.getDay(),nth=Math.ceil(d.getDate()/7);
  return sk.garbage.filter(g=>g.days.includes(dow)&&(!g.weeks.length||g.weeks.includes(nth)));
}

/* ── blocked days (the practical data) ── */
function skIsAway(key){return sk.away.includes(key)}
function skBlockedReason(key){
  const r=[];
  if(sk.block.away&&skIsAway(key))r.push('away');
  const tks=typeof tasksOn==='function'?tasksOn(key):[];
  if(sk.block.urg&&tks.some(t=>t.urg&&!t.done))r.push('urgent task');
  else if(sk.block.any&&tks.some(t=>!t.done))r.push('task');
  if(sk.block.hol&&typeof getHoliday==='function'&&getHoliday(key))r.push('holiday');
  return r.join(' + ');
}

/* ── cleaning occurrences ──
   due = ideal date from the cycle. If blocked and no manual choice → auto 1 week EARLIER.
   Manual options (kept): due / earlier / later / skip. */
function skOccurrences(fromKey,toKey){
  const out=[];
  sk.cycles.forEach(c=>{
    if(!c.anchor||!c.every)return;
    let due=c.anchor;
    /* rewind so we start before the window */
    while(skAdd(due,0)>fromKey)due=skAdd(due,-c.every);
    for(let i=0;i<200&&due<=toKey;i++,due=skAdd(due,c.every)){
      const ok=c.id+'|'+due,ov=sk.overrides[ok];
      let at=due,mode='due',reason=skBlockedReason(due);
      if(ov==='skip'){mode='skip'}
      else if(ov==='before'){at=skAdd(due,-7);mode='before'}
      else if(ov==='after'){at=skAdd(due,7);mode='after'}
      else if(ov==='due'){mode='due'}
      else if(reason){at=skAdd(due,-7);mode='auto'}
      out.push({cycle:c,due,at,mode,reason,key:ok,done:!!sk.done[ok],manual:!!ov});
    }
  });
  return out;
}
let skOccCache={from:'',to:'',list:[]};
function skOccFor(key){
  const mk=key.slice(0,7);
  if(skOccCache.from!==mk){
    const from=skAdd(mk+'-01',-21),to=skAdd(mk+'-28',+35);
    skOccCache={from:mk,list:skOccurrences(from,to)};
  }
  return skOccCache.list.filter(o=>o.mode!=='skip'&&o.at===key);
}
function skGhostFor(key){return skOccCache.list.filter(o=>o.mode!=='due'&&o.mode!=='skip'&&o.due===key)}

/* ── cell rendering (called from renderCal) ── */
function skCellHtml(key){
  if(!sk.show)return '';
  let h='';
  const gs=skGarbageOn(key);
  if(sk.wm&&gs.length){
    h+=`<div class="sk-wm${gs.length>1?' multi':''}" aria-hidden="true" title="${esc(gs.map(g=>g.label).join(' · '))}">${gs.map(g=>g.icon&&SK_ICONS[g.icon]?skIconSvg(g.icon,g.color):`<span style="color:${g.color}">${esc(g.short||g.label)}</span>`).join('')}</div>`;
  }
  if(skIsAway(key))h+='<span class="sk-away" title="Away — cleaning phases avoid this day">✈</span>';
  return h;
}
/* ── clash detection: an open task sitting on a day a cleaning phase lands on ── */
function skClashTasks(key){
  const t=typeof tasksOn==='function'?tasksOn(key):[];
  return t.filter(x=>!x.done);
}
/* flags for the calendar cell (colour-code + clash ring) */
function skCellFlags(key){
  if(!sk.show)return null;
  const occ=skOccFor(key);
  if(!occ.length)return null;
  const pend=occ.filter(o=>!o.done);
  const tks=pend.length?skClashTasks(key):[];
  return {color:occ[0].cycle.color||'#8e44ad',clash:tks.length>0,urg:tks.some(t=>t.urg),tasks:tks,names:pend.map(o=>o.cycle.name)};
}
function skCellBodyHtml(key){
  if(!sk.show)return '';
  skOccFor(key); /* warms cache */
  let h='';
  const clash=skClashTasks(key);
  skOccFor(key).forEach(o=>{
    const c=o.cycle.color||'#8e44ad';
    const cl=!o.done&&clash.length;
    const tag=o.mode==='due'?'':`<b class="sk-shift">${o.mode==='after'?'+1w':'−1w'}</b>`;
    const ttl=`${o.cycle.name} · every ${o.cycle.every} days${o.reason?' · blocked on '+o.due+' ('+o.reason+')':''}${cl?' — CLASHES with '+clash.length+' open task'+(clash.length>1?'s':'')+': '+clash.map(t=>t.text).join(', '):''}`;
    h+=`<div class="sk-cy${o.done?' done':''}${o.mode!=='due'?' moved':''}${cl?' clash':''}" style="--sk-c:${c}" title="${esc(ttl)}">${cl?'<b class="sk-cw">⚠</b>':'<i class="sk-dot"></i>'}<span>${esc(o.cycle.name)}</span>${tag}</div>`;
  });
  skGhostFor(key).forEach(o=>{h+=`<div class="sk-ghost" style="--sk-c:${o.cycle.color||'#8e44ad'}" title="Originally due here — moved (${esc(o.reason||'manual')})"><span>${esc(o.cycle.name)}</span></div>`});
  return h;
}

/* ── day modal section ── */
function renderModalSukkiri(key){
  const el=$('modal-sukkiri');if(!el)return;
  const gs=skGarbageOn(key),occ=skOccFor(key),ghost=skGhostFor(key),away=skIsAway(key),reason=skBlockedReason(key);
  let h='<div class="msec sk-sec"><span class="msec-t">🧹 Sukkiri</span>';
  h+=`<div class="sk-line">🗑 ${gs.length?gs.map(g=>`<span class="sk-gtag" style="border-color:${g.color};color:${g.color}">${esc(g.label)}</span>`).join(''):'<span class="sk-dim">No collection today</span>'}</div>`;
  h+=`<label class="cbl sk-awaycb"><input type="checkbox" id="sk-away-chk"${away?' checked':''}><span>✈️ I'm away / not in the city</span></label>`;
  if(reason)h+=`<div class="sk-warn">⚠ Blocked day (${esc(reason)}) — cleaning due here moves 1 week earlier unless you choose otherwise.</div>`;
  const clash=occ.filter(o=>!o.done).length?skClashTasks(key):[];
  if(clash.length)h+=`<div class="sk-clashbox${clash.some(t=>t.urg)?' urg':''}"><div class="sk-clashbox-h">⚠ Clash — cleaning lands on a day with ${clash.length} open task${clash.length>1?'s':''}</div><div class="sk-clashbox-l">${clash.map(t=>`<span class="sk-ctag${t.urg?' urg':''}">${t.urg?'⚑ ':''}${esc(t.text)}${t.time?' · '+esc(t.time):''}</span>`).join('')}</div><div class="sk-clashbox-f">Move the phase below so you don't miss it.</div></div>`;
  occ.concat(ghost.filter(g=>g.at!==key)).forEach(o=>{
    const here=o.at===key;
    h+=`<div class="sk-occ${o.done?' done':''}"><div class="sk-occ-h"><b>${esc(o.cycle.name)}</b><span class="sk-dim">every ${o.cycle.every}d · due ${o.due.slice(5)}${o.mode==='auto'?' · auto-moved earlier ('+esc(o.reason)+')':o.mode==='before'?' · moved earlier':o.mode==='after'?' · moved later':''}${here?'':' · now on '+o.at.slice(5)}</span></div>
<div class="sk-occ-b">
<button class="sk-b${o.done?' on':''}" data-sk-done="${o.key}">${o.done?'✓ Done':'Mark done'}</button>
<button class="sk-b${o.mode==='before'||o.mode==='auto'?' on':''}" data-sk-ov="${o.key}" data-v="before">← 1 week earlier</button>
<button class="sk-b${o.mode==='due'?' on':''}" data-sk-ov="${o.key}" data-v="due">Keep due date</button>
<button class="sk-b${o.mode==='after'?' on':''}" data-sk-ov="${o.key}" data-v="after">1 week later →</button>
<button class="sk-b sk-skip" data-sk-ov="${o.key}" data-v="skip">Skip once</button>
</div></div>`;
  });
  h+='</div>';
  el.innerHTML=h;
  $('sk-away-chk').onchange=e=>{
    if(e.target.checked){if(!sk.away.includes(key))sk.away.push(key)}else sk.away=sk.away.filter(k=>k!==key);
    skOccCache.from='';saveSukkiri();renderModalSukkiri(key);
  };
  el.querySelectorAll('[data-sk-done]').forEach(b=>b.onclick=()=>{const k=b.dataset.skDone;if(sk.done[k])delete sk.done[k];else sk.done[k]=true;skOccCache.from='';saveSukkiri();renderModalSukkiri(key)});
  el.querySelectorAll('[data-sk-ov]').forEach(b=>b.onclick=()=>{
    const k=b.dataset.skOv,v=b.dataset.v;
    if(v==='skip'&&!confirm('Skip this cleaning phase once?'))return;
    sk.overrides[k]=v;skOccCache.from='';saveSukkiri();renderModalSukkiri(key);
  });
}

/* ── settings overlay ── */
function openSukkiri(){$('sk-ov').classList.remove('hidden');renderSukkiriSettings()}
function closeSukkiri(){const o=$('sk-ov');if(o)o.classList.add('hidden')}
function renderSukkiriSettings(){
  const ov=$('sk-ov');
  const wdBtns=(g)=>[1,2,3,4,5,6,0].map(d=>`<button class="sk-chip${g.days.includes(d)?' on':''}" data-gd="${g.id}" data-d="${d}">${SK_WD[d]}</button>`).join('');
  const wkBtns=(g)=>[1,2,3,4,5].map(w=>`<button class="sk-chip sm${g.weeks.includes(w)?' on':''}" data-gw="${g.id}" data-w="${w}">${w}</button>`).join('');
  let h=`<div class="modal sk-modal" onclick="event.stopPropagation()"><button class="modal-x" onclick="closeSukkiri()">✕</button>
<h2>🧹 Sukkiri</h2><p>Shiyakusho garbage rules + ideal cleaning cycles. The calendar applies your real week to them.</p>
<div class="sk-row"><label class="cbl"><input type="checkbox" id="sk-show"${sk.show?' checked':''}><span>Show on calendar</span></label><label class="cbl"><input type="checkbox" id="sk-wm"${sk.wm?' checked':''}><span>Garbage watermark</span></label></div>
<div class="msec"><span class="msec-t">🗑 Garbage collection</span><div class="sk-dim" style="margin-bottom:8px">Pick weekdays. Leave week numbers empty for every week, or choose e.g. 2 + 4 for 2nd & 4th.</div>`;
  const icBtns=(g)=>SK_ICON_IDS.map(i=>`<button class="sk-ic${g.icon===i?' on':''}" data-gi="${g.id}" data-i="${i}" title="${i}">${skIconSvg(i,g.icon===i?g.color:'currentColor')}</button>`).join('');
  sk.garbage.forEach(g=>{h+=`<div class="sk-g"><div class="sk-g-h"><input class="sk-in" data-gl="${g.id}" value="${esc(g.label)}" placeholder="Category"><input type="color" data-gc="${g.id}" value="${g.color}" title="Colour"><button class="sk-del" data-gx="${g.id}" title="Remove">✕</button></div><div class="sk-chips sk-ics"><span class="sk-dim" style="margin-right:4px">mark</span>${icBtns(g)}</div><div class="sk-chips">${wdBtns(g)}</div><div class="sk-chips"><span class="sk-dim" style="margin-right:4px">week</span>${wkBtns(g)}</div></div>`});
  h+=`<button class="sk-add" id="sk-gadd">+ Add category</button></div>
<div class="msec"><span class="msec-t">🧹 Cleaning cycles</span><div class="sk-dim" style="margin-bottom:8px">Anchor = the day the cycle starts counting from. Blocked days auto-move the phase one week earlier.</div>`;
  sk.cycles.forEach(c=>{h+=`<div class="sk-c"><input type="color" data-cc="${c.id}" value="${c.color||'#8e44ad'}" title="Colour"><input class="sk-in" data-cn="${c.id}" value="${esc(c.name)}" placeholder="What to clean"><span class="sk-dim">every</span><input class="sk-in sk-in-n" type="number" min="1" max="365" data-ce="${c.id}" value="${c.every}"><span class="sk-dim">days from</span><input class="sk-in" type="date" data-ca="${c.id}" value="${c.anchor}"><button class="sk-del" data-cx="${c.id}" title="Remove">✕</button></div>`});
  h+=`<button class="sk-add" id="sk-cadd">+ Add cycle</button></div>
<div class="msec"><span class="msec-t">⚠ What counts as a blocked day</span><div class="sk-row sk-wrap">
<label class="cbl"><input type="checkbox" data-bk="urg"${sk.block.urg?' checked':''}><span>⚑ Urgent task</span></label>
<label class="cbl"><input type="checkbox" data-bk="any"${sk.block.any?' checked':''}><span>Any open task</span></label>
<label class="cbl"><input type="checkbox" data-bk="away"${sk.block.away?' checked':''}><span>✈️ Away day</span></label>
<label class="cbl"><input type="checkbox" data-bk="hol"${sk.block.hol?' checked':''}><span>🎌 Holiday</span></label></div></div>
<button class="btn-save" onclick="closeSukkiri()">Done</button></div>`;
  ov.innerHTML=h;
  const commit=()=>{skOccCache.from='';saveSukkiri()};
  $('sk-show').onchange=e=>{sk.show=e.target.checked;commit()};
  $('sk-wm').onchange=e=>{sk.wm=e.target.checked;commit()};
  ov.querySelectorAll('[data-bk]').forEach(i=>i.onchange=()=>{sk.block[i.dataset.bk]=i.checked;commit()});
  const gById=id=>sk.garbage.find(g=>g.id===id),cById=id=>sk.cycles.find(c=>c.id===id);
  ov.querySelectorAll('[data-gl]').forEach(i=>i.oninput=()=>{gById(i.dataset.gl).label=i.value;commit()});
  ov.querySelectorAll('[data-gc]').forEach(i=>i.oninput=()=>{gById(i.dataset.gc).color=i.value;commit()});
  ov.querySelectorAll('[data-cc]').forEach(i=>i.oninput=()=>{cById(i.dataset.cc).color=i.value;commit()});
  ov.querySelectorAll('[data-gi]').forEach(b=>b.onclick=()=>{const g=gById(b.dataset.gi);g.icon=g.icon===b.dataset.i?'':b.dataset.i;commit();renderSukkiriSettings()});
  ov.querySelectorAll('[data-gd]').forEach(b=>b.onclick=()=>{const g=gById(b.dataset.gd),d=+b.dataset.d;g.days=g.days.includes(d)?g.days.filter(x=>x!==d):g.days.concat(d);commit();renderSukkiriSettings()});
  ov.querySelectorAll('[data-gw]').forEach(b=>b.onclick=()=>{const g=gById(b.dataset.gw),w=+b.dataset.w;g.weeks=g.weeks.includes(w)?g.weeks.filter(x=>x!==w):g.weeks.concat(w).sort();commit();renderSukkiriSettings()});
  ov.querySelectorAll('[data-gx]').forEach(b=>b.onclick=()=>{sk.garbage=sk.garbage.filter(g=>g.id!==b.dataset.gx);commit();renderSukkiriSettings()});
  $('sk-gadd').onclick=()=>{sk.garbage.push({id:skId(),label:'',short:'',icon:SK_ICON_IDS[sk.garbage.length%SK_ICON_IDS.length],days:[],weeks:[],color:SK_COLORS[sk.garbage.length%SK_COLORS.length]});commit();renderSukkiriSettings();const last=ov.querySelectorAll('[data-gl]');last[last.length-1].focus()};
  ov.querySelectorAll('[data-cn]').forEach(i=>i.oninput=()=>{cById(i.dataset.cn).name=i.value;commit()});
  ov.querySelectorAll('[data-ce]').forEach(i=>i.onchange=()=>{cById(i.dataset.ce).every=Math.max(1,+i.value||1);commit()});
  ov.querySelectorAll('[data-ca]').forEach(i=>i.onchange=()=>{cById(i.dataset.ca).anchor=i.value;commit()});
  ov.querySelectorAll('[data-cx]').forEach(b=>b.onclick=()=>{sk.cycles=sk.cycles.filter(c=>c.id!==b.dataset.cx);commit();renderSukkiriSettings()});
  $('sk-cadd').onclick=()=>{sk.cycles.push({id:skId(),name:'',every:14,anchor:skNextDow(0),color:SK_COLORS[(sk.cycles.length+4)%SK_COLORS.length]});commit();renderSukkiriSettings();const last=ov.querySelectorAll('[data-cn]');last[last.length-1].focus()};
}

/* ── print ── */
/* cell-level: watermark icons + garbage caption (goes outside .pr-body) */
function skPrintCell(key){
  if(!sk.show)return '';
  const gs=skGarbageOn(key);if(!gs.length)return '';
  let h=`<div class="pr-sk-wm${gs.length>1?' multi':''}">${gs.map(g=>g.icon&&SK_ICONS[g.icon]?skIconSvg(g.icon,g.color):`<span style="color:${g.color}">${esc(g.short||g.label)}</span>`).join('')}</div>`;
  h+='<div class="pr-sk-g">'+gs.map(g=>`<span style="color:${g.color}">${esc(g.short||g.label)}</span>`).join('<i>·</i>')+'</div>';
  return h;
}
/* body-level: cleaning phases as chips */
function skPrintLines(key){
  if(!sk.show)return '';
  let l='';
  const cl=skClashTasks(key).length;
  skOccFor(key).forEach(o=>{
    const c=o.cycle.color||'#8e44ad',clash=!o.done&&cl;
    l+=`<div class="pr-sk-c${o.done?' done':''}${clash?' clash':''}" style="--sk-c:${c}">${clash?'<b class="w">⚠</b>':'<i class="d"></i>'}<span>${esc(o.cycle.name)}</span>${o.mode!=='due'?`<b class="s">${o.mode==='after'?'+1w':'−1w'}</b>`:''}</div>`;
  });
  skGhostFor(key).forEach(o=>{l+=`<div class="pr-sk-ghost" style="--sk-c:${o.cycle.color||'#8e44ad'}"><span>${esc(o.cycle.name)}</span></div>`});
  return l;
}
