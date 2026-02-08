import { useState, useEffect, useCallback } from "react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MARK_COLORS = { red:"#d63031", pink:"#e84393", teal:"#00b894", cyan:"#00cec9", orange:"#e17055", purple:"#6c5ce7", yellow:"#fdcb6e" };

const THEMES = [
  { name:"Parchment Journal", emoji:"📜", bg:"linear-gradient(145deg,#fdf6e3,#f5e6c8,#ede0c8)", cardBg:"#fffdf7", border:"#d4c5a9", hFont:"'Playfair Display',serif", bFont:"'Caveat',cursive", txt:"#2d3436", txt2:"#636e72", accent:"#d63031", goal:"#00b894", note:"#00b894", diary:"#6c5ce7", todayBg:"#d63031", wknd:"#d63031", btn:"linear-gradient(135deg,#00b894,#00cec9)", btnSh:"rgba(0,184,148,0.4)", inputBg:"#fff9ee", pattern:"none", shadow:"0 8px 40px rgba(0,0,0,0.08)" },
  { name:"Midnight Tokyo", emoji:"🌃", bg:"linear-gradient(145deg,#0a0a1a,#1a1a3e,#0d0d2b)", cardBg:"#12122e", border:"#2a2a5e", hFont:"'Orbitron',sans-serif", bFont:"'Rajdhani',sans-serif", txt:"#e0e0ff", txt2:"#8888bb", accent:"#ff2d95", goal:"#00f5d4", note:"#00f5d4", diary:"#b388ff", todayBg:"#ff2d95", wknd:"#ff6b9d", btn:"linear-gradient(135deg,#ff2d95,#ff6b6b)", btnSh:"rgba(255,45,149,0.4)", inputBg:"#1a1a3e", pattern:"radial-gradient(circle at 20% 80%,rgba(255,45,149,0.06),transparent 50%),radial-gradient(circle at 80% 20%,rgba(0,245,212,0.04),transparent 50%)", shadow:"0 8px 40px rgba(255,45,149,0.1),0 0 80px rgba(0,0,0,0.5)" },
  { name:"Forest Morning", emoji:"🌿", bg:"linear-gradient(145deg,#f0f7ee,#dcedc8,#c5e1a5)", cardBg:"#f9fdf6", border:"#a5d6a7", hFont:"'DM Serif Display',serif", bFont:"'Nunito',sans-serif", txt:"#2e4a2e", txt2:"#5a7a5a", accent:"#2e7d32", goal:"#ff8f00", note:"#2e7d32", diary:"#5d4037", todayBg:"#2e7d32", wknd:"#558b2f", btn:"linear-gradient(135deg,#43a047,#66bb6a)", btnSh:"rgba(67,160,71,0.4)", inputBg:"#f0f7ee", pattern:"none", shadow:"0 8px 40px rgba(46,125,50,0.08)" },
  { name:"Ocean Breeze", emoji:"🌊", bg:"linear-gradient(145deg,#e3f2fd,#bbdefb,#90caf9)", cardBg:"#f5faff", border:"#90caf9", hFont:"'Libre Baskerville',serif", bFont:"'Source Sans 3',sans-serif", txt:"#1a3a5c", txt2:"#5a8ab5", accent:"#0277bd", goal:"#e65100", note:"#0277bd", diary:"#4527a0", todayBg:"#0277bd", wknd:"#0288d1", btn:"linear-gradient(135deg,#0288d1,#03a9f4)", btnSh:"rgba(2,136,209,0.4)", inputBg:"#e8f4fd", pattern:"none", shadow:"0 8px 40px rgba(2,119,189,0.08)" },
  { name:"Sunset Amber", emoji:"🌅", bg:"linear-gradient(145deg,#fff3e0,#ffe0b2,#ffcc80)", cardBg:"#fffaf3", border:"#ffb74d", hFont:"'Abril Fatface',serif", bFont:"'Quicksand',sans-serif", txt:"#4e2a00", txt2:"#8d6e40", accent:"#e65100", goal:"#ad1457", note:"#e65100", diary:"#6a1b9a", todayBg:"#e65100", wknd:"#f4511e", btn:"linear-gradient(135deg,#e65100,#ff6d00)", btnSh:"rgba(230,81,0,0.35)", inputBg:"#fff8ee", pattern:"none", shadow:"0 8px 40px rgba(230,81,0,0.08)" },
  { name:"Lavender Dusk", emoji:"🪻", bg:"linear-gradient(145deg,#f3e5f5,#e1bee7,#ce93d8)", cardBg:"#faf5fc", border:"#ce93d8", hFont:"'Cormorant Garamond',serif", bFont:"'Outfit',sans-serif", txt:"#3a1a4a", txt2:"#7a5a8a", accent:"#7b1fa2", goal:"#00838f", note:"#7b1fa2", diary:"#c2185b", todayBg:"#7b1fa2", wknd:"#8e24aa", btn:"linear-gradient(135deg,#8e24aa,#ab47bc)", btnSh:"rgba(142,36,170,0.4)", inputBg:"#f3e5f5", pattern:"none", shadow:"0 8px 40px rgba(123,31,162,0.08)" },
  { name:"Carbon Night", emoji:"🖤", bg:"linear-gradient(145deg,#1a1a1a,#2d2d2d,#1e1e1e)", cardBg:"#252525", border:"#444", hFont:"'Bebas Neue',sans-serif", bFont:"'IBM Plex Mono',monospace", txt:"#e0e0e0", txt2:"#888", accent:"#ff6b35", goal:"#4ecdc4", note:"#4ecdc4", diary:"#ffd93d", todayBg:"#ff6b35", wknd:"#ff8a5c", btn:"linear-gradient(135deg,#ff6b35,#ff8a5c)", btnSh:"rgba(255,107,53,0.4)", inputBg:"#1e1e1e", pattern:"repeating-linear-gradient(0deg,transparent,transparent 49px,rgba(255,255,255,0.02) 50px)", shadow:"0 8px 40px rgba(0,0,0,0.4)" }
];

function getTodayThemeIdx() { const n=new Date(),s=new Date(n.getFullYear(),0,0); return Math.floor((n-s)/864e5)%THEMES.length; }
function daysIn(y,m){ return new Date(y,m+1,0).getDate(); }
function firstDay(y,m){ const d=new Date(y,m,1).getDay(); return d===0?6:d-1; }

function XMark({color="#d63031",size=28}){
  return <svg width={size} height={size} viewBox="0 0 40 40" style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",opacity:.75,pointerEvents:"none"}}>
    <line x1="7" y1="7" x2="33" y2="33" stroke={color} strokeWidth="4" strokeLinecap="round"/>
    <line x1="33" y1="7" x2="7" y2="33" stroke={color} strokeWidth="4" strokeLinecap="round"/>
  </svg>;
}

function Modal({isOpen,onClose,date,data,onSave,t}){
  const [marked,setMarked]=useState(false);
  const [markColor,setMarkColor]=useState("red");
  const [note,setNote]=useState("");
  const [isGoal,setIsGoal]=useState(false);
  const [diary,setDiary]=useState("");

  useEffect(()=>{
    if(data){setMarked(data.marked||false);setMarkColor(data.markColor||"red");setNote(data.note||"");setIsGoal(data.isGoal||false);setDiary(data.diary||"");}
    else{setMarked(false);setMarkColor("red");setNote("");setIsGoal(false);setDiary("");}
  },[data,date]);

  if(!isOpen||!date) return null;
  const d=new Date(date);
  const dayName=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][d.getDay()];

  const save=()=>{onSave({marked,markColor,note,isGoal,diary});onClose();};

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,backdropFilter:"blur(6px)"}} onClick={onClose}>
      <div onClick={e=>e.stopPropagation()} style={{background:t.cardBg,borderRadius:18,padding:"28px 26px 22px",width:"92%",maxWidth:450,maxHeight:"85vh",overflowY:"auto",boxShadow:t.shadow,fontFamily:t.bFont,border:`2px solid ${t.border}`,position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:10,right:14,background:"none",border:"none",fontSize:24,cursor:"pointer",color:t.txt2,fontFamily:t.bFont}}>✕</button>
        <h2 style={{margin:"0 0 2px",fontSize:28,color:t.txt,fontFamily:t.hFont,fontWeight:900}}>{d.getDate()} {MONTHS[d.getMonth()]}</h2>
        <p style={{margin:"0 0 18px",fontSize:16,color:t.txt2}}>{dayName}, {d.getFullYear()}</p>

        <div style={{marginBottom:16}}>
          <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:17,color:t.txt}}>
            <input type="checkbox" checked={marked} onChange={e=>setMarked(e.target.checked)} style={{width:18,height:18,accentColor:MARK_COLORS[markColor]}}/>✕ Mark this day
          </label>
          {marked&&<div style={{display:"flex",gap:6,marginTop:8,marginLeft:28}}>
            {Object.entries(MARK_COLORS).map(([n,c])=><button key={n} onClick={()=>setMarkColor(n)} style={{width:24,height:24,borderRadius:"50%",background:c,border:markColor===n?`3px solid ${t.txt}`:"2px solid transparent",cursor:"pointer",transform:markColor===n?"scale(1.25)":"scale(1)",transition:"transform .12s"}}/>)}
          </div>}
        </div>

        <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer",fontSize:17,marginBottom:16,color:t.txt}}>
          <input type="checkbox" checked={isGoal} onChange={e=>setIsGoal(e.target.checked)} style={{width:18,height:18,accentColor:t.goal}}/>⭐ Goal achieved
        </label>

        <div style={{marginBottom:14}}>
          <label style={{fontSize:16,display:"block",marginBottom:4,color:t.txt,fontWeight:600}}>📝 Note</label>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Quick note..." rows={2} style={{width:"100%",boxSizing:"border-box",padding:10,borderRadius:10,border:`1.5px solid ${t.border}`,background:t.inputBg,fontSize:15,fontFamily:t.bFont,resize:"vertical",outline:"none",color:t.note}}/>
        </div>

        <div style={{marginBottom:20}}>
          <label style={{fontSize:16,display:"block",marginBottom:4,color:t.txt,fontWeight:600}}>📖 Personal Diary</label>
          <textarea value={diary} onChange={e=>setDiary(e.target.value)} placeholder="Write your thoughts..." rows={4} style={{width:"100%",boxSizing:"border-box",padding:10,borderRadius:10,border:`1.5px solid ${t.border}`,background:t.inputBg,fontSize:15,fontFamily:t.bFont,resize:"vertical",outline:"none",color:t.diary}}/>
        </div>

        <button onClick={save} style={{width:"100%",padding:"11px 0",borderRadius:12,border:"none",background:t.btn,color:"#fff",fontSize:18,fontFamily:t.bFont,cursor:"pointer",fontWeight:700,boxShadow:`0 4px 15px ${t.btnSh}`,transition:"transform .12s"}} onMouseOver={e=>e.target.style.transform="scale(1.02)"} onMouseOut={e=>e.target.style.transform="scale(1)"}>Save Entry</button>
      </div>
    </div>
  );
}

function ThemePicker({current,onPick,t}){
  const [open,setOpen]=useState(false);
  return(
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(!open)} style={{background:t.cardBg,border:`1.5px solid ${t.border}`,borderRadius:22,padding:"5px 14px",fontSize:13,fontFamily:t.bFont,cursor:"pointer",color:t.txt,display:"flex",alignItems:"center",gap:5,boxShadow:"0 2px 8px rgba(0,0,0,0.08)"}}>
        {t.emoji} {t.name} ▾
      </button>
      {open&&<div style={{position:"absolute",top:"115%",right:0,background:t.cardBg,border:`1.5px solid ${t.border}`,borderRadius:14,padding:5,zIndex:100,minWidth:210,boxShadow:"0 12px 40px rgba(0,0,0,0.25)"}}>
        <button onClick={()=>{onPick(-1);setOpen(false);}} style={{display:"flex",alignItems:"center",gap:7,width:"100%",padding:"7px 11px",border:"none",background:current===-1?"rgba(128,128,128,0.12)":"transparent",borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:t.bFont,color:t.txt}}>🔄 Auto (daily rotation)</button>
        <div style={{height:1,background:t.border,margin:"3px 0"}}/>
        {THEMES.map((th,i)=><button key={i} onClick={()=>{onPick(i);setOpen(false);}} style={{display:"flex",alignItems:"center",gap:7,width:"100%",padding:"7px 11px",border:"none",background:i===current?"rgba(128,128,128,0.12)":"transparent",borderRadius:9,cursor:"pointer",fontSize:13,fontFamily:t.bFont,color:t.txt}}>{th.emoji} {th.name}</button>)}
      </div>}
    </div>
  );
}

export default function CalendarApp(){
  const today=new Date();
  const autoIdx=getTodayThemeIdx();
  const [manual,setManual]=useState(-1);
  const idx=manual===-1?autoIdx:manual;
  const t=THEMES[idx];

  const [year,setYear]=useState(today.getFullYear());
  const [month,setMonth]=useState(today.getMonth());
  const [calData,setCalData]=useState({});
  const [modalOpen,setModalOpen]=useState(false);
  const [selDate,setSelDate]=useState(null);
  const [loading,setLoading]=useState(true);

  const sKey=`cal-${year}-${month}`;

  const load=useCallback(async()=>{
    setLoading(true);
    try{ const r=await window.storage.get(sKey); setCalData(r?.value?JSON.parse(r.value):{}); }catch{setCalData({});}
    setLoading(false);
  },[sKey]);

  useEffect(()=>{load();},[load]);

  const saveDay=async(dd)=>{
    const empty=!dd.marked&&!dd.note&&!dd.isGoal&&!dd.diary;
    const u={...calData}; if(empty)delete u[selDate]; else u[selDate]=dd;
    setCalData(u);
    try{await window.storage.set(sKey,JSON.stringify(u));}catch(e){console.error(e);}
  };

  const prev=()=>{if(month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1);};
  const next=()=>{if(month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1);};

  const dim=daysIn(year,month), fd=firstDay(year,month), pDim=daysIn(year,month===0?11:month-1);
  const total=Math.ceil((fd+dim)/7)*7;
  const cells=[];
  for(let i=0;i<total;i++){
    if(i<fd)cells.push({day:pDim-fd+i+1,cur:false});
    else if(i<fd+dim)cells.push({day:i-fd+1,cur:true});
    else cells.push({day:i-fd-dim+1,cur:false});
  }

  const isT=(d)=>d===today.getDate()&&month===today.getMonth()&&year===today.getFullYear();
  const openDay=(d)=>{setSelDate(`${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`);setModalOpen(true);};

  const ent=Object.values(calData);
  const st={m:ent.filter(e=>e.marked).length,g:ent.filter(e=>e.isGoal).length,d:ent.filter(e=>e.diary).length};

  return(
    <div style={{minHeight:"100vh",background:t.bg,fontFamily:t.bFont,padding:"14px 8px 30px",display:"flex",flexDirection:"column",alignItems:"center",transition:"background .5s"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Caveat:wght@400;600;700&family=Orbitron:wght@700;900&family=Rajdhani:wght@400;600&family=DM+Serif+Display&family=Nunito:wght@400;600;700&family=Libre+Baskerville:wght@400;700&family=Source+Sans+3:wght@400;600&family=Abril+Fatface&family=Quicksand:wght@400;600;700&family=Cormorant+Garamond:wght@600;700&family=Outfit:wght@400;600&family=Bebas+Neue&family=IBM+Plex+Mono:wght@400;600&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .c{transition:all .12s;cursor:pointer;position:relative}.c:hover{transform:scale(1.03);z-index:2}.c:active{transform:scale(.97)}
        @keyframes si{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}.ga{animation:si .35s ease}
        @keyframes p{0%,100%{box-shadow:0 0 0 0 ${t.accent}33}50%{box-shadow:0 0 0 8px transparent}}.tp{animation:p 2.5s infinite}
        ::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:${t.border};border-radius:3px}
      `}</style>

      {t.pattern!=="none"&&<div style={{position:"fixed",inset:0,background:t.pattern,pointerEvents:"none",zIndex:0}}/>}

      {/* Top bar */}
      <div style={{width:"100%",maxWidth:840,display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6,position:"relative",zIndex:10}}>
        <button onClick={()=>{setYear(today.getFullYear());setMonth(today.getMonth());}} style={{background:`${t.accent}18`,border:`1.5px solid ${t.accent}44`,borderRadius:20,padding:"5px 14px",fontSize:13,fontFamily:t.bFont,cursor:"pointer",color:t.accent,fontWeight:600}}>● Today</button>
        <ThemePicker current={manual} onPick={setManual} t={t}/>
      </div>

      {/* Header */}
      <div style={{width:"100%",maxWidth:840,marginBottom:10,zIndex:1}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <button onClick={prev} style={{background:"none",border:"none",fontSize:40,cursor:"pointer",color:t.txt2,padding:"0 12px",lineHeight:1}}>‹</button>
          <div style={{textAlign:"center"}}>
            <h1 style={{fontSize:"clamp(36px,9vw,66px)",fontFamily:t.hFont,fontWeight:900,color:t.txt,letterSpacing:t.hFont.includes("Bebas")?4:-1,lineHeight:1.05}}>{MONTHS[month]}</h1>
            <p style={{fontSize:"clamp(15px,3.5vw,22px)",color:t.txt2,fontFamily:t.hFont,fontWeight:700,letterSpacing:t.hFont.includes("Bebas")?5:0}}>{year}</p>
          </div>
          <button onClick={next} style={{background:"none",border:"none",fontSize:40,cursor:"pointer",color:t.txt2,padding:"0 12px",lineHeight:1}}>›</button>
        </div>
      </div>

      {/* Grid */}
      <div className="ga" key={`${year}-${month}-${idx}`} style={{width:"100%",maxWidth:840,background:t.cardBg,borderRadius:16,border:`2px solid ${t.border}`,overflow:"hidden",boxShadow:t.shadow,zIndex:1}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",borderBottom:`2px solid ${t.border}`}}>
          {DAYS.map((d,i)=><div key={d} style={{textAlign:"center",padding:"10px 0",fontSize:"clamp(11px,2.6vw,16px)",fontWeight:700,color:i>=5?t.wknd:t.txt,fontFamily:t.hFont,borderRight:i<6?`1px solid ${t.border}33`:"none",letterSpacing:t.hFont.includes("Bebas")?2:0}}>{d}</div>)}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)"}}>
          {cells.map((cell,i)=>{
            const dk=cell.cur?`${year}-${String(month+1).padStart(2,"0")}-${String(cell.day).padStart(2,"0")}`:null;
            const dd=dk?calData[dk]:null;
            const isW=i%7>=5;
            const ri=Math.floor(i/7), tr=Math.ceil(cells.length/7);
            return(
              <div key={i} className={cell.cur?"c":""} onClick={()=>cell.cur&&openDay(cell.day)} style={{minHeight:"clamp(64px,12vw,106px)",padding:"4px 5px",borderRight:i%7<6?`1px solid ${t.border}33`:"none",borderBottom:ri<tr-1?`1px solid ${t.border}33`:"none",background:!cell.cur?`${t.txt}08`:isW?`${t.wknd}06`:"transparent",opacity:cell.cur?1:.22,cursor:cell.cur?"pointer":"default",overflow:"hidden",position:"relative"}}>
                <div className={isT(cell.day)&&cell.cur?"tp":""} style={{fontSize:"clamp(13px,3vw,22px)",fontWeight:700,fontFamily:t.hFont,color:isT(cell.day)&&cell.cur?"#fff":isW&&cell.cur?t.wknd:cell.cur?t.txt:t.txt2,width:isT(cell.day)&&cell.cur?"clamp(22px,5vw,32px)":"auto",height:isT(cell.day)&&cell.cur?"clamp(22px,5vw,32px)":"auto",borderRadius:"50%",background:isT(cell.day)&&cell.cur?t.todayBg:"transparent",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,position:"relative",zIndex:3}}>{cell.day}</div>
                {dd?.marked&&cell.cur&&<XMark color={MARK_COLORS[dd.markColor]||MARK_COLORS.red} size={28}/>}
                {dd?.isGoal&&cell.cur&&<div style={{position:"absolute",top:2,right:3,fontSize:8,background:t.goal,color:"#fff",borderRadius:5,padding:"1px 4px",fontFamily:t.bFont,fontWeight:700,zIndex:4,lineHeight:"12px"}}>★ GOAL</div>}
                {dd?.note&&cell.cur&&<div style={{fontSize:"clamp(8px,1.5vw,11px)",color:t.note,lineHeight:1.15,marginTop:1,overflow:"hidden",textOverflow:"ellipsis",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical",zIndex:3,fontWeight:600}}>{dd.note}</div>}
                {dd?.diary&&cell.cur&&<div style={{position:"absolute",bottom:2,right:3,fontSize:10,zIndex:3}}>📖</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div style={{width:"100%",maxWidth:840,marginTop:10,display:"flex",flexWrap:"wrap",gap:18,justifyContent:"center",fontSize:14,color:t.txt2,zIndex:1}}>
        {st.m+st.g+st.d===0?<span>Tap any day to start tracking</span>:<><span>✕ {st.m} marked</span><span>⭐ {st.g} goals</span><span>📖 {st.d} diary entries</span></>}
      </div>
      <div style={{marginTop:5,fontSize:12,color:t.txt2,opacity:.6,zIndex:1}}>Theme changes daily · pick one manually from the dropdown</div>

      {loading&&<div style={{position:"fixed",bottom:20,left:"50%",transform:"translateX(-50%)",background:t.txt,color:t.cardBg,padding:"7px 18px",borderRadius:20,fontSize:13,zIndex:50}}>Loading...</div>}

      <Modal isOpen={modalOpen} onClose={()=>setModalOpen(false)} date={selDate} data={selDate?calData[selDate]:null} onSave={saveDay} t={t}/>
    </div>
  );
}
