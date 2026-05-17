import { useState, useEffect, useRef, useCallback } from "react";
import { fsGet, fsSet, fsListen } from "./firebase";

// ─── DEFAULTS ─────────────────────────────────────────────────────────────────
const DEFAULT_PROFILES = [
  { id: "p1", name: "Pilote Alpha", aUEC: 150000, location: "Lorville, Hurston",      ship: "Cutlass Black",  color: "#00d4ff", avatar: null },
  { id: "p2", name: "Pilote Beta",  aUEC: 98000,  location: "New Babbage, microTech", ship: "Avenger Titan",  color: "#ff6b35", avatar: null },
];
const DEFAULT_MISSIONS   = [];
const DEFAULT_OBJECTIVES = { personal: { p1: [], p2: [] }, common: [] };
const DEFAULT_SETTINGS   = { appIcon: null };
const DEFAULT_SHIPS      = [
  { id: "s1", name: "Cutlass Black", capacity: 46   },
  { id: "s2", name: "Caterpillar",   capacity: 576  },
  { id: "s3", name: "Hull C",        capacity: 4608 },
  { id: "s4", name: "Prospector",    capacity: 32   },
];

// ─── SYNC HOOK — lit Firestore au démarrage, écoute en temps réel ──────────
function useFirestore(collection, defaultValue) {
  const [data,   setData]   = useState(defaultValue);
  const [loaded, setLoaded] = useState(false);
  const skipNext = useRef(false); // évite la boucle écriture → snapshot → setData

  // Écoute temps réel
  useEffect(() => {
    const unsub = fsListen(collection, (remote) => {
      if (skipNext.current) { skipNext.current = false; return; }
      const val = remote?.value ?? defaultValue;
      setData(val);
      if (!loaded) setLoaded(true);
    });
    // Fallback si le document n'existe pas encore
    fsGet(collection).then((d) => {
      if (!d) setLoaded(true); // rien dans Firestore → utilise le défaut
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection]);

  // Écriture debounced
  const save = useCallback(
    (val) => {
      skipNext.current = true;
      fsSet(collection, { value: val });
    },
    [collection]
  );

  return [data, setData, loaded, save];
}

// ─── COSMIC BACKGROUND ────────────────────────────────────────────────────────
function CosmicBackground() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, w, h, t = 0;
    const stars = [], shooters = [];

    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);
    for (let i = 0; i < 220; i++) stars.push({ x: Math.random()*2000, y: Math.random()*2000, r: Math.random()*1.4+.2, speed: Math.random()*.008+.002, phase: Math.random()*Math.PI*2 });

    function spawnShooter() {
      if (shooters.length > 4) return;
      shooters.push({ x: Math.random()*w, y: Math.random()*h*.5, vx: (Math.random()*4+3)*(Math.random()<.5?1:-1), vy: Math.random()*2+1, life: 1, len: Math.random()*120+60 });
    }

    function draw() {
      t++; ctx.clearRect(0,0,w,h);
      // Black hole
      const cx=w*.72, cy=h*.28, bhR=Math.min(w,h)*.18;
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,bhR*2.5);
      g.addColorStop(0,"rgba(0,0,0,1)"); g.addColorStop(.25,"rgba(0,0,0,.97)"); g.addColorStop(.5,"rgba(10,0,30,.7)"); g.addColorStop(.72,"rgba(0,100,200,.18)"); g.addColorStop(.85,"rgba(80,0,180,.1)"); g.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=g; ctx.beginPath(); ctx.ellipse(cx,cy,bhR*2.5,bhR*2.5,0,0,Math.PI*2); ctx.fill();
      // Accretion
      const dg=ctx.createRadialGradient(cx,cy,bhR*.9,cx,cy,bhR*1.7);
      dg.addColorStop(0,"rgba(0,160,255,.55)"); dg.addColorStop(.4,"rgba(255,120,0,.32)"); dg.addColorStop(.75,"rgba(100,0,200,.15)"); dg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.globalAlpha=.85+.08*Math.sin(t*.018); ctx.fillStyle=dg; ctx.beginPath(); ctx.ellipse(cx,cy,bhR*1.7,bhR*.38,Math.PI*.08+t*.003,0,Math.PI*2); ctx.fill();
      // Stars
      stars.forEach(s => { ctx.globalAlpha=.4+.6*Math.abs(Math.sin(t*s.speed+s.phase)); ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(s.x%w,s.y%h,s.r,0,Math.PI*2); ctx.fill(); });
      // Shooters
      if(t%90===0) spawnShooter();
      for(let i=shooters.length-1;i>=0;i--){ const s=shooters[i]; s.x+=s.vx; s.y+=s.vy; s.life-=.012; if(s.life<=0||s.x<-200||s.x>w+200||s.y>h+100){shooters.splice(i,1);continue;} const mag=Math.hypot(s.vx,s.vy); const sg=ctx.createLinearGradient(s.x-s.vx*(s.len/mag),s.y-s.vy*(s.len/mag),s.x,s.y); sg.addColorStop(0,"rgba(255,255,255,0)"); sg.addColorStop(1,`rgba(180,230,255,${s.life*.9})`); ctx.globalAlpha=1; ctx.strokeStyle=sg; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(s.x-s.vx*(s.len/mag),s.y-s.vy*(s.len/mag)); ctx.lineTo(s.x,s.y); ctx.stroke(); }
      ctx.globalAlpha=1; raf=requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize",resize); };
  }, []);
  return <canvas ref={canvasRef} style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none" }} />;
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const fmt = n => (n??0).toLocaleString("fr-FR");

// ─── MODAL ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={S.modalOverlay} onClick={e => { if(e.target===e.currentTarget) onClose(); }}>
      <div style={S.modalBox}>
        <div style={S.modalHeader}>
          <span style={S.modalTitle}>{title}</span>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>
        <div style={S.modalBody}>{children}</div>
      </div>
    </div>
  );
}

// ─── SYNC BADGE ───────────────────────────────────────────────────────────────
function SyncBadge({ synced }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:10, fontFamily:"'Rajdhani',sans-serif", color: synced?"#00ff9d":"#ffcc00" }}>
      <div style={{ width:6, height:6, borderRadius:"50%", background: synced?"#00ff9d":"#ffcc00", boxShadow: synced?"0 0 6px #00ff9d":"0 0 6px #ffcc00", animation: synced?"none":"pulse 1s infinite" }} />
      {synced ? "SYNC" : "SYNC..."}
    </div>
  );
}

// ─── HEX TILE ─────────────────────────────────────────────────────────────────
function HexTile({ icon, label, value, sub, color="#00d4ff", onClick, pulse }) {
  const [hov,setHov]=useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ ...S.hexTile, borderColor:hov?color:color+"66", boxShadow:hov?`0 0 32px ${color}88,0 0 8px ${color}44 inset`:`0 0 12px ${color}33`, transform:hov?"scale(1.04) translateY(-2px)":"scale(1)", background:hov?"#0a1628dd":"#07111fcc", cursor:onClick?"pointer":"default", animation:pulse?"pulse 2s ease-in-out infinite":"none" }}>
      <div style={{fontSize:28,marginBottom:4}}>{icon}</div>
      <div style={{color,fontSize:11,fontFamily:"'Rajdhani',sans-serif",letterSpacing:2,textTransform:"uppercase"}}>{label}</div>
      {value!==undefined&&<div style={{color:"#e8f4ff",fontSize:18,fontWeight:700,fontFamily:"'Orbitron',sans-serif",margin:"2px 0"}}>{value}</div>}
      {sub&&<div style={{color:"#8899bb",fontSize:10,fontFamily:"'Rajdhani',sans-serif"}}>{sub}</div>}
    </div>
  );
}

// ─── PROFILE CARD ─────────────────────────────────────────────────────────────
function ProfileCard({ profile, onEdit }) {
  const [hov,setHov]=useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ ...S.profileCard, borderColor:hov?profile.color:profile.color+"55", boxShadow:hov?`0 0 40px ${profile.color}44`:`0 0 16px ${profile.color}22`, transform:hov?"translateY(-4px)":"none" }}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
        <div style={{ width:56,height:56,borderRadius:"50%",border:`2px solid ${profile.color}`,background:profile.avatar?`url(${profile.avatar}) center/cover no-repeat`:`radial-gradient(circle,${profile.color}44,#0a1628)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,boxShadow:`0 0 16px ${profile.color}66`,flexShrink:0 }}>
          {!profile.avatar&&"👤"}
        </div>
        <div style={{flex:1}}>
          <div style={{color:profile.color,fontFamily:"'Orbitron',sans-serif",fontSize:15,fontWeight:700}}>{profile.name}</div>
          <div style={{color:"#8899bb",fontSize:11,fontFamily:"'Rajdhani',sans-serif",letterSpacing:1}}>CITOYEN STAR</div>
        </div>
        <button onClick={onEdit} style={{...S.editBtn,borderColor:profile.color,color:profile.color}}>✏️</button>
      </div>
      <div style={S.statRow}>
        <div style={S.statItem}><div style={S.statLabel}>aUEC</div><div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:16,fontWeight:700}}>{fmt(profile.aUEC)}</div></div>
        <div style={S.statItem}><div style={S.statLabel}>VAISSEAU</div><div style={{color:"#e8f4ff",fontFamily:"'Rajdhani',sans-serif",fontSize:12}}>{profile.ship}</div></div>
        <div style={S.statItem}><div style={S.statLabel}>POSITION</div><div style={{color:"#e8f4ff",fontFamily:"'Rajdhani',sans-serif",fontSize:11}}>{profile.location}</div></div>
      </div>
    </div>
  );
}

// ─── MISSION ITEM ─────────────────────────────────────────────────────────────
function MissionItem({ mission, profiles, onDelete }) {
  const [exp,setExp]=useState(false);
  const share=Math.floor(mission.amount/2);
  const owner=profiles.find(p=>p.id===mission.assignee);
  return (
    <div style={S.missionItem} onClick={()=>setExp(!exp)}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <div style={{fontSize:18}}>{mission.split?"🤝":mission.assignee==="p1"?"🔵":"🟠"}</div>
        <div style={{flex:1}}>
          <div style={{color:"#e8f4ff",fontFamily:"'Rajdhani',sans-serif",fontSize:14,fontWeight:600}}>{mission.name}</div>
          <div style={{color:"#8899bb",fontSize:10,fontFamily:"'Rajdhani',sans-serif"}}>{mission.date}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:13,fontWeight:700}}>{fmt(mission.amount)} aUEC</div>
          {mission.split&&<div style={{color:"#ffcc00",fontSize:10,fontFamily:"'Rajdhani',sans-serif"}}>PARTAGÉE</div>}
        </div>
      </div>
      {exp&&(
        <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #1a2a44"}}>
          {mission.split?(
            <div style={{display:"flex",gap:12}}>
              {profiles.map(p=>(
                <div key={p.id} style={{flex:1,background:"#0a1628",borderRadius:6,padding:8,border:`1px solid ${p.color}44`}}>
                  <div style={{color:p.color,fontSize:10,fontFamily:"'Rajdhani',sans-serif"}}>{p.name}</div>
                  <div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:14}}>+{fmt(share)}</div>
                </div>
              ))}
            </div>
          ):(
            <div style={{color:"#8899bb",fontSize:12,fontFamily:"'Rajdhani',sans-serif"}}>Attribué à : <span style={{color:owner?.color}}>{owner?.name}</span></div>
          )}
          {mission.note&&<div style={{color:"#8899bb",fontSize:11,marginTop:6,fontFamily:"'Rajdhani',sans-serif"}}>📝 {mission.note}</div>}
          <button onClick={e=>{e.stopPropagation();onDelete(mission.id);}} style={{...S.dangerBtn,marginTop:8,fontSize:11}}>🗑 Supprimer</button>
        </div>
      )}
    </div>
  );
}

// ─── MINING CALCULATOR ────────────────────────────────────────────────────────
function MiningCalc({ ships, setShips }) {
  const [auecPerSCU,setAuecPerSCU]=useState(1000);
  const [selShip,setSelShip]=useState(ships[0]?.id||"");
  const [editShipModal,setEditShipModal]=useState(null);
  const ship=ships.find(s=>s.id===selShip);
  const profit=ship?auecPerSCU*ship.capacity:0;

  function saveShip(s){ setShips(prev=>prev.map(x=>x.id===s.id?s:x)); setEditShipModal(null); }

  return (
    <div style={S.calcBox}>
      <div style={S.sectionTitle}>⚙️ CALCULATEUR DE PROFITS MINIERS</div>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:14}}>
        <div style={{flex:1,minWidth:140}}>
          <label style={S.label}>Prix/SCU (aUEC)</label>
          <input type="number" value={auecPerSCU} onChange={e=>setAuecPerSCU(+e.target.value)} style={S.input}/>
        </div>
        <div style={{flex:1,minWidth:140}}>
          <label style={S.label}>Vaisseau</label>
          <select value={selShip} onChange={e=>setSelShip(e.target.value)} style={S.input}>
            {ships.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      {ship&&(
        <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{...S.resultBox,flex:1}}>
            <div style={{color:"#8899bb",fontSize:10,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>CAPACITÉ</div>
            <div style={{color:"#00d4ff",fontFamily:"'Orbitron',sans-serif",fontSize:20,fontWeight:700}}>{ship.capacity} SCU</div>
          </div>
          <div style={{color:"#00ff9d",fontSize:24}}>→</div>
          <div style={{...S.resultBox,flex:1,borderColor:"#00ff9d55"}}>
            <div style={{color:"#8899bb",fontSize:10,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>PROFIT MAX</div>
            <div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:20,fontWeight:700}}>{fmt(profit)} aUEC</div>
          </div>
          <button onClick={()=>setEditShipModal({...ship})} style={{...S.editBtn,color:"#00d4ff",borderColor:"#00d4ff66",alignSelf:"flex-end"}}>✏️ Modifier</button>
        </div>
      )}
      <div style={{marginTop:14}}>
        <div style={S.label}>Flotte</div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
          {ships.map(s=>(
            <div key={s.id} style={S.shipChip} onClick={()=>{setSelShip(s.id);setEditShipModal({...s});}}>🚀 {s.name} · {s.capacity} SCU</div>
          ))}
          <div style={{...S.shipChip,borderColor:"#00ff9d55",color:"#00ff9d"}} onClick={()=>{const ns={id:"s"+Date.now(),name:"Nouveau",capacity:100};setShips(p=>[...p,ns]);setEditShipModal(ns);}}>+ Ajouter</div>
        </div>
      </div>
      {editShipModal&&(
        <Modal title="Modifier le vaisseau" onClose={()=>setEditShipModal(null)}>
          <label style={S.label}>Nom</label>
          <input value={editShipModal.name} onChange={e=>setEditShipModal(p=>({...p,name:e.target.value}))} style={S.input}/>
          <label style={S.label}>Capacité (SCU)</label>
          <input type="number" value={editShipModal.capacity} onChange={e=>setEditShipModal(p=>({...p,capacity:+e.target.value}))} style={S.input}/>
          <button onClick={()=>saveShip(editShipModal)} style={S.primaryBtn}>💾 Sauvegarder</button>
        </Modal>
      )}
    </div>
  );
}

// ─── OBJECTIVES TAB ───────────────────────────────────────────────────────────
function ObjectivesTab({ objectives, setObjectives, profiles }) {
  const [modal,setModal]=useState(false);
  const [form,setForm]=useState({name:"",cost:"",icon:"🎯",type:"common",owner:"p1",progress:0,target:100});

  const all=[
    ...objectives.common.map(o=>({...o,type:"common"})),
    ...Object.entries(objectives.personal).flatMap(([pid,arr])=>arr.map(o=>({...o,type:"personal",owner:pid})))
  ];

  function add(){
    if(!form.name) return;
    const obj={id:"obj"+Date.now(),icon:form.icon,name:form.name,cost:+form.cost,type:form.type,owner:form.owner};
    if(form.type==="common") setObjectives(p=>({...p,common:[...p.common,obj]}));
    else setObjectives(p=>({...p,personal:{...p.personal,[form.owner]:[...(p.personal[form.owner]||[]),obj]}}));
    setModal(false);
    setForm({name:"",cost:"",icon:"🎯",type:"common",owner:"p1",progress:0,target:100});
  }
  function del(obj){
    if(obj.type==="common") setObjectives(p=>({...p,common:p.common.filter(x=>x.id!==obj.id)}));
    else setObjectives(p=>({...p,personal:{...p.personal,[obj.owner]:p.personal[obj.owner].filter(x=>x.id!==obj.id)}}));
  }
  // Calcule la progression automatique depuis les aUEC
  function getAutoProgress(obj) {
    if (!obj.cost || obj.cost <= 0) return 0;
    if (obj.type === "common") {
      // Objectif commun : somme de tous les profils
      const total = profiles.reduce((a, p) => a + (p.aUEC || 0), 0);
      return Math.min(100, Math.round((total / obj.cost) * 100));
    } else {
      // Objectif personnel : aUEC du propriétaire
      const owner = profiles.find(p => p.id === obj.owner);
      const money = owner?.aUEC || 0;
      return Math.min(100, Math.round((money / obj.cost) * 100));
    }
  }

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={S.sectionTitle}>🎯 OBJECTIFS</div>
        <button onClick={()=>setModal(true)} style={{...S.primaryBtn,width:"auto",marginTop:0}}>+ Objectif</button>
      </div>
      {all.length===0&&<div style={{color:"#8899bb",textAlign:"center",padding:40,fontFamily:"'Rajdhani',sans-serif"}}>Aucun objectif défini</div>}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {all.map(obj=>{
          const owner=profiles.find(p=>p.id===obj.owner);
          const pct = getAutoProgress(obj);
          const barColor=pct>=100?"#00ff9d":obj.type==="common"?"#ffcc00":(owner?.color||"#00d4ff");
          const currentMoney = obj.type==="common"
            ? profiles.reduce((a,p)=>a+(p.aUEC||0),0)
            : (profiles.find(p=>p.id===obj.owner)?.aUEC||0);
          return (
            <div key={obj.id} style={{...S.objectiveCard,borderColor:obj.type==="common"?"#ffcc0055":(owner?.color+"55"||"#00d4ff55")}}>
              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{fontSize:26,flexShrink:0}}>{obj.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                    <div style={{color:"#e8f4ff",fontFamily:"'Rajdhani',sans-serif",fontSize:15,fontWeight:600}}>{obj.name}</div>
                    {obj.type==="common"
                      ?<span style={S.badgeCommon}>COMMUN</span>
                      :<span style={{...S.badgePersonal,color:owner?.color,borderColor:owner?.color+"55"}}>{owner?.name}</span>
                    }
                  </div>
                  {obj.cost>0&&(
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:4}}>
                      <div style={{color:"#ffcc00",fontSize:12,fontFamily:"'Orbitron',sans-serif"}}>{fmt(currentMoney)} / {fmt(obj.cost)} aUEC</div>
                      {pct>=100
                        ? <span style={{color:"#00ff9d",fontSize:11,fontFamily:"'Orbitron',sans-serif",fontWeight:700}}>✅ ATTEINT !</span>
                        : <span style={{color:barColor,fontSize:13,fontFamily:"'Orbitron',sans-serif",fontWeight:700}}>{pct}%</span>
                      }
                    </div>
                  )}
                  {/* Barre de progression animée */}
                  <div style={{...S.progressBar,height:10,borderRadius:6,position:"relative",overflow:"hidden"}}>
                    <div style={{
                      ...S.progressFill,
                      width:`${pct}%`,
                      background:`linear-gradient(90deg, ${barColor}88, ${barColor})`,
                      borderRadius:6,
                      boxShadow:`0 0 10px ${barColor}88`,
                      transition:"width 1s ease",
                    }}/>
                    {/* Shimmer animé */}
                    <div style={{
                      position:"absolute",top:0,left:0,right:0,bottom:0,
                      background:"linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.15) 50%,transparent 100%)",
                      animation:"shimmer 2s infinite",
                      backgroundSize:"200% 100%",
                    }}/>
                  </div>
                  {obj.cost<=0&&<div style={{color:"#8899bb",fontSize:10,fontFamily:"'Rajdhani',sans-serif",marginTop:4}}>Définis un coût pour voir la progression automatique</div>}
                </div>
                <button onClick={()=>del(obj)} style={{...S.closeBtn,flexShrink:0}}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>
      {modal&&(
        <Modal title="Nouvel objectif" onClose={()=>setModal(false)}>
          <label style={S.label}>Icône (emoji)</label>
          <input value={form.icon} onChange={e=>setForm(p=>({...p,icon:e.target.value}))} style={{...S.input,width:70}}/>
          <label style={S.label}>Nom de l'objectif</label>
          <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={S.input} placeholder="Ex: Hercules Starlifter, Armure Novikov..."/>
          <label style={S.label}>Coût en aUEC</label>
          <input type="number" value={form.cost} onChange={e=>setForm(p=>({...p,cost:e.target.value}))} style={S.input} placeholder="Ex: 5000000"/>
          <div style={{color:"#8899bb",fontSize:11,fontFamily:"'Rajdhani',sans-serif",marginBottom:8}}>
            💡 La barre se remplit automatiquement selon l'argent disponible
          </div>
          <label style={S.label}>Type</label>
          <select value={form.type} onChange={e=>setForm(p=>({...p,type:e.target.value}))} style={S.input}>
            <option value="common">Commun (somme des deux joueurs)</option>
            <option value="personal">Personnel (un seul joueur)</option>
          </select>
          {form.type==="personal"&&(<>
            <label style={S.label}>Propriétaire</label>
            <select value={form.owner} onChange={e=>setForm(p=>({...p,owner:e.target.value}))} style={S.input}>
              {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </>)}
          <button onClick={add} style={S.primaryBtn}>✅ Créer l'objectif</button>
        </Modal>
      )}
    </div>
  );
}

// ─── MINING TAB ───────────────────────────────────────────────────────────────
function MiningTab({ ships, setShips }) {
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState(null);
  const [error,setError]=useState(null);
  const [lastFetch,setLastFetch]=useState(null);

  async function fetchData(){
    setLoading(true); setError(null);
    try {
      const r=await fetch("https://api.uexcorp.space/2.0/commodities");
      if(!r.ok) throw new Error("HTTP "+r.status);
      const j=await r.json();
      setData(j.data||j); setLastFetch(new Date().toLocaleTimeString("fr-FR"));
    } catch(e){ setError("Impossible de contacter l'API UEX Corp. "+e.message); }
    setLoading(false);
  }

  const NAMES=["Quantanium","Bexalite","Borase","Agricium","Taranite","Laranite","Hephaestanite","Titanium","Copper","Iron","Gold","Corundum","Beryl","Diamond","Hadanite"];
  const minerals=data?.filter(c=>NAMES.includes(c.name))||[];

  return (
    <div>
      <div style={S.sectionTitle}>⛏ DONNÉES MINERAIS — UEX CORP</div>
      <p style={{color:"#8899bb",fontSize:12,fontFamily:"'Rajdhani',sans-serif",marginBottom:12}}>
        Données en temps réel depuis <span style={{color:"#00d4ff"}}>uexcorp.space</span>
      </p>
      <button onClick={fetchData} style={{...S.primaryBtn,width:"auto",marginTop:0,marginBottom:16}} disabled={loading}>
        {loading?"⏳ Chargement...":"🔄 Actualiser les données"}
      </button>
      {lastFetch&&<div style={{color:"#8899bb",fontSize:11,fontFamily:"'Rajdhani',sans-serif",marginBottom:12}}>MàJ : {lastFetch}</div>}
      {error&&<div style={{color:"#ff4466",background:"#ff446611",border:"1px solid #ff446633",borderRadius:8,padding:12,fontSize:13,fontFamily:"'Rajdhani',sans-serif",marginBottom:16}}>
        {error}<br/><a href="https://uexcorp.space" target="_blank" rel="noreferrer" style={{color:"#00d4ff"}}>→ Visiter UEX Corp</a>
      </div>}
      {minerals.length>0&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(155px,1fr))",gap:10,marginBottom:24}}>
          {minerals.map(m=>(
            <div key={m.id||m.name} style={{background:"#07111fcc",border:"1px solid #1a2a4488",borderRadius:10,padding:12,backdropFilter:"blur(8px)"}}>
              <div style={{color:"#00d4ff",fontSize:13,fontFamily:"'Orbitron',sans-serif",fontWeight:700}}>{m.name}</div>
              {m.price_sell&&<div style={{color:"#00ff9d",fontSize:12,marginTop:4,fontFamily:"'Rajdhani',sans-serif"}}>{fmt(Math.round(m.price_sell))} aUEC/u</div>}
              {m.trade_price_sell&&<div style={{color:"#ffcc00",fontSize:11,marginTop:2,fontFamily:"'Rajdhani',sans-serif"}}>{fmt(Math.round(m.trade_price_sell))} aUEC/SCU</div>}
              {m.code&&<div style={{color:"#8899bb",fontSize:10,marginTop:2}}>{m.code}</div>}
            </div>
          ))}
        </div>
      )}
      {!data&&!loading&&!error&&<div style={{color:"#8899bb",textAlign:"center",padding:40,fontFamily:"'Rajdhani',sans-serif"}}>Appuyez sur "Actualiser" pour charger les prix en temps réel.</div>}
      <div style={{marginTop:24}}><MiningCalc ships={ships} setShips={setShips}/></div>
    </div>
  );
}

// ─── SETTINGS TAB ─────────────────────────────────────────────────────────────
function SettingsTab({ settings, setSettings, profiles, setProfiles }) {
  const [urlIcon,setUrlIcon]=useState(settings.appIcon||"");
  return (
    <div>
      <div style={S.sectionTitle}>⚙️ PERSONNALISATION</div>
      <label style={S.label}>URL icône / logo (image ou GIF)</label>
      <div style={{display:"flex",gap:8,marginBottom:10}}>
        <input value={urlIcon} onChange={e=>setUrlIcon(e.target.value)} style={{...S.input,flex:1,marginBottom:0}} placeholder="https://..."/>
        <button onClick={()=>setSettings(p=>({...p,appIcon:urlIcon}))} style={{...S.primaryBtn,width:"auto",marginTop:0}}>Appliquer</button>
      </div>
      {settings.appIcon&&<img src={settings.appIcon} alt="icon" style={{height:60,borderRadius:8,border:"1px solid #00d4ff44",marginBottom:16}}/>}

      <div style={{marginTop:24}}>
        <div style={S.sectionTitle}>👤 AVATARS PROFILS</div>
        {profiles.map(p=>(
          <div key={p.id} style={{marginBottom:14}}>
            <label style={{...S.label,color:p.color}}>{p.name} — URL avatar</label>
            <div style={{display:"flex",gap:8}}>
              <input defaultValue={p.avatar||""} id={`av-${p.id}`} style={{...S.input,flex:1,marginBottom:0}} placeholder="https://..."/>
              <button onClick={()=>{const v=document.getElementById(`av-${p.id}`)?.value||"";setProfiles(prev=>prev.map(x=>x.id===p.id?{...x,avatar:v}:x));}} style={{...S.primaryBtn,width:"auto",marginTop:0,background:p.color+"22",borderColor:p.color,color:p.color}}>Appliquer</button>
            </div>
            {p.avatar&&<img src={p.avatar} alt="av" style={{height:44,width:44,borderRadius:"50%",border:`1px solid ${p.color}`,marginTop:6,objectFit:"cover"}}/>}
          </div>
        ))}
      </div>

      <div style={{marginTop:24,background:"#07111fcc",border:"1px solid #1a2a4488",borderRadius:10,padding:16}}>
        <div style={S.sectionTitle}>🔗 LIENS UTILES</div>
        {[["🌐 UEX Corp","https://uexcorp.space"],["🗺 SC-Trade.Tools","https://sc-trade.tools"],["📖 Star Citizen Wiki","https://starcitizen.tools"],["💬 Spectrum","https://robertsspaceindustries.com/spectrum"],["🚀 RSI","https://robertsspaceindustries.com"]].map(([l,u])=>(
          <a key={u} href={u} target="_blank" rel="noreferrer" style={{display:"block",color:"#00d4ff",fontFamily:"'Rajdhani',sans-serif",fontSize:14,marginBottom:10,textDecoration:"none"}}>{l} →</a>
        ))}
      </div>

      <div style={{marginTop:24,background:"#07111fcc",border:"1px solid #ff446633",borderRadius:10,padding:16}}>
        <div style={{...S.sectionTitle,color:"#ff4466"}}>🗑 RÉINITIALISER</div>
        <p style={{color:"#8899bb",fontSize:12,fontFamily:"'Rajdhani',sans-serif",marginBottom:10}}>Efface toutes les données Firebase. Irréversible.</p>
        <button onClick={()=>{if(window.confirm("Confirmer la réinitialisation complète ?")) window.location.reload();}} style={{...S.dangerBtn,fontSize:13,padding:"8px 16px"}}>⚠️ Réinitialiser</button>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [tab,setTab]=useState("dashboard");

  // Chaque état est synchronisé avec sa propre collection Firestore
  const [profiles,  setProfiles,  profLoaded,  saveProfiles  ] = useFirestore("profiles",   DEFAULT_PROFILES);
  const [missions,  setMissions,  missLoaded,  saveMissions  ] = useFirestore("missions",   DEFAULT_MISSIONS);
  const [objectives,setObjectives,objLoaded,   saveObjectives] = useFirestore("objectives", DEFAULT_OBJECTIVES);
  const [ships,     setShips,     shipLoaded,  saveShips     ] = useFirestore("ships",      DEFAULT_SHIPS);
  const [settings,  setSettings,  settLoaded,  saveSettings  ] = useFirestore("settings",   DEFAULT_SETTINGS);

  const loaded = profLoaded && missLoaded && objLoaded && shipLoaded && settLoaded;

  // Sync vers Firebase à chaque changement (avec debounce 600ms)
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dSaveProfiles   = useCallback(debounce(saveProfiles,   600), [saveProfiles]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dSaveMissions   = useCallback(debounce(saveMissions,   600), [saveMissions]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dSaveObjectives = useCallback(debounce(saveObjectives, 600), [saveObjectives]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dSaveShips      = useCallback(debounce(saveShips,      600), [saveShips]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dSaveSettings   = useCallback(debounce(saveSettings,   600), [saveSettings]);

  useEffect(() => { if (loaded) dSaveProfiles(profiles);     }, [profiles,   loaded]); // eslint-disable-line
  useEffect(() => { if (loaded) dSaveMissions(missions);     }, [missions,   loaded]); // eslint-disable-line
  useEffect(() => { if (loaded) dSaveObjectives(objectives); }, [objectives, loaded]); // eslint-disable-line
  useEffect(() => { if (loaded) dSaveShips(ships);           }, [ships,      loaded]); // eslint-disable-line
  useEffect(() => { if (loaded) dSaveSettings(settings);     }, [settings,   loaded]); // eslint-disable-line

  // Modals
  const [editProfile,    setEditProfile]    = useState(null);
  const [addMissionModal,setAddMissionModal]= useState(false);
  const [missionForm,    setMissionForm]    = useState({name:"",amount:"",split:true,assignee:"p1",note:""});

  const totalEarned = missions.reduce((a,m)=>a+m.amount,0);
  const p1=profiles.find(p=>p.id==="p1");
  const p2=profiles.find(p=>p.id==="p2");

  function addMission(){
    if(!missionForm.name||!missionForm.amount) return;
    const m={id:"m"+Date.now(),name:missionForm.name,amount:+missionForm.amount,split:missionForm.split,assignee:missionForm.assignee,note:missionForm.note,date:new Date().toLocaleDateString("fr-FR")};
    const half=Math.floor(m.amount/2);
    setProfiles(prev=>prev.map(p=>{ if(m.split) return{...p,aUEC:p.aUEC+half}; if(p.id===m.assignee) return{...p,aUEC:p.aUEC+m.amount}; return p; }));
    setMissions(prev=>[m,...prev]);
    setAddMissionModal(false);
    setMissionForm({name:"",amount:"",split:true,assignee:"p1",note:""});
  }

  function deleteMission(id){
    const m=missions.find(x=>x.id===id); if(!m) return;
    const half=Math.floor(m.amount/2);
    setProfiles(prev=>prev.map(p=>{ if(m.split) return{...p,aUEC:p.aUEC-half}; if(p.id===m.assignee) return{...p,aUEC:p.aUEC-m.amount}; return p; }));
    setMissions(prev=>prev.filter(x=>x.id!==id));
  }

  const TABS=[{id:"dashboard",icon:"🏠",label:"BORD"},{id:"missions",icon:"📋",label:"MISSIONS"},{id:"objectives",icon:"🎯",label:"OBJECTIFS"},{id:"mining",icon:"⛏",label:"MINERAIS"},{id:"settings",icon:"⚙️",label:"RÉGLAGES"}];

  if(!loaded) return (
    <div style={{background:"#03070f",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <CosmicBackground/>
      <div style={{color:"#00d4ff",fontFamily:"'Orbitron',sans-serif",fontSize:18,zIndex:10,textAlign:"center"}}>
        <div style={{animation:"spin 1s linear infinite",fontSize:40,marginBottom:16}}>⭐</div>
        SYNCHRONISATION FIREBASE...
      </div>
    </div>
  );

  return (
    <div style={{background:"#03070f",minHeight:"100vh",color:"#e8f4ff",fontFamily:"'Rajdhani',sans-serif",position:"relative"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;background:#07111f;}
        ::-webkit-scrollbar-thumb{background:#00d4ff44;border-radius:4px;}
        input,select,textarea{font-family:'Rajdhani',sans-serif;}
        @keyframes pulse{0%,100%{box-shadow:0 0 12px #00d4ff33}50%{box-shadow:0 0 28px #00d4ff88}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{text-shadow:0 0 8px #00d4ff66}50%{text-shadow:0 0 20px #00d4ffcc}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        html,body{overflow-x:hidden;max-width:100vw;}
        .nav-tab{flex:1 0 60px;padding:10px 6px;background:transparent;border:none;border-bottom:2px solid transparent;color:#8899bb;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:2px;font-family:'Rajdhani',sans-serif;font-weight:600;transition:all .2s;}
        .nav-tab.active{background:linear-gradient(135deg,#00d4ff22,#0a1628);border-bottom:2px solid #00d4ff;color:#00d4ff;}
        .nav-tab:hover{color:#00d4ffaa;}
        .profiles-grid{display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:20px;}
        @media(min-width:520px){.profiles-grid{grid-template-columns:1fr 1fr;}}
      `}</style>
      <CosmicBackground/>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerInner}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            {settings.appIcon?<img src={settings.appIcon} alt="logo" style={{height:40,width:40,objectFit:"contain"}}/>:<div style={{fontSize:32,filter:"drop-shadow(0 0 8px #00d4ff)"}}>⭐</div>}
            <div>
              <div style={{fontFamily:"'Orbitron',sans-serif",fontSize:20,fontWeight:900,color:"#00d4ff",animation:"glow 3s ease-in-out infinite",letterSpacing:3}}>STAR YeUv</div>
              <div style={{color:"#8899bb",fontSize:10,letterSpacing:3,fontFamily:"'Rajdhani',sans-serif"}}>COMPANION APP</div>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
            <SyncBadge synced={loaded}/>
            <div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:13,textAlign:"right"}}>
              <div style={{fontSize:9,color:"#8899bb",letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>FORTUNE TOTALE</div>
              {fmt((p1?.aUEC||0)+(p2?.aUEC||0))} aUEC
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={S.nav}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className={`nav-tab${tab===t.id?" active":""}`}>
            <span style={{fontSize:16}}>{t.icon}</span>
            <span style={{fontSize:9,letterSpacing:1}}>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={S.content}>

        {/* DASHBOARD */}
        {tab==="dashboard"&&(
          <div style={{animation:"fadeIn .4s ease"}}>
            <div className="profiles-grid">
              {profiles.map(p=><ProfileCard key={p.id} profile={p} onEdit={()=>setEditProfile({...p})}/>)}
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(115px,1fr))",gap:10,marginBottom:20}}>
              <HexTile icon="💰" label="Total Gagné" value={fmt(totalEarned)} sub="aUEC" color="#ffcc00"/>
              <HexTile icon="📋" label="Missions" value={missions.length} sub="complétées" color="#00d4ff"/>
              <HexTile icon="🤝" label="Partagées" value={missions.filter(m=>m.split).length} sub="co-op" color="#00ff9d"/>
              <HexTile icon="🎯" label="Objectifs" value={objectives.common.length+Object.values(objectives.personal).flat().length} sub="en cours" color="#ff6b35"/>
            </div>
            <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
              <button onClick={()=>setAddMissionModal(true)} style={{...S.primaryBtn,width:"auto",fontSize:14,padding:"12px 32px",letterSpacing:2}}>➕ NOUVELLE MISSION</button>
            </div>
            <div style={S.sectionTitle}>📋 MISSIONS RÉCENTES</div>
            {missions.slice(0,5).map(m=><MissionItem key={m.id} mission={m} profiles={profiles} onDelete={deleteMission}/>)}
            {missions.length===0&&<div style={{color:"#8899bb",textAlign:"center",padding:30,fontFamily:"'Rajdhani',sans-serif"}}>Aucune mission — commencez à jouer !</div>}
            {missions.length>5&&<button onClick={()=>setTab("missions")} style={{...S.ghostBtn,width:"100%",marginTop:8}}>Voir toutes les missions ({missions.length}) →</button>}
          </div>
        )}

        {tab==="missions"&&(
          <div style={{animation:"fadeIn .4s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
              <div style={S.sectionTitle}>📋 TOUTES LES MISSIONS</div>
              <button onClick={()=>setAddMissionModal(true)} style={{...S.primaryBtn,width:"auto",marginTop:0}}>+ Mission</button>
            </div>
            {missions.length===0&&<div style={{color:"#8899bb",textAlign:"center",padding:40}}>Aucune mission enregistrée</div>}
            {missions.map(m=><MissionItem key={m.id} mission={m} profiles={profiles} onDelete={deleteMission}/>)}
          </div>
        )}

        {tab==="objectives"&&<div style={{animation:"fadeIn .4s ease"}}><ObjectivesTab objectives={objectives} setObjectives={setObjectives} profiles={profiles}/></div>}
        {tab==="mining"&&<div style={{animation:"fadeIn .4s ease"}}><MiningTab ships={ships} setShips={setShips}/></div>}
        {tab==="settings"&&<div style={{animation:"fadeIn .4s ease"}}><SettingsTab settings={settings} setSettings={setSettings} profiles={profiles} setProfiles={setProfiles}/></div>}
      </div>

      {/* Edit Profile Modal */}
      {editProfile&&(
        <Modal title={`Modifier — ${editProfile.name}`} onClose={()=>setEditProfile(null)}>
          <label style={S.label}>Nom du pilote</label>
          <input value={editProfile.name} onChange={e=>setEditProfile(p=>({...p,name:e.target.value}))} style={S.input}/>
          <label style={S.label}>aUEC actuels</label>
          <input type="number" value={editProfile.aUEC} onChange={e=>setEditProfile(p=>({...p,aUEC:+e.target.value}))} style={S.input}/>
          <label style={S.label}>Localisation</label>
          <input value={editProfile.location} onChange={e=>setEditProfile(p=>({...p,location:e.target.value}))} style={S.input} placeholder="Ex: Area18, ArcCorp"/>
          <label style={S.label}>Vaisseau actuel</label>
          <input value={editProfile.ship} onChange={e=>setEditProfile(p=>({...p,ship:e.target.value}))} style={S.input} placeholder="Ex: Hercules C2"/>
          <label style={S.label}>Couleur du profil</label>
          <input type="color" value={editProfile.color} onChange={e=>setEditProfile(p=>({...p,color:e.target.value}))} style={{...S.input,height:44,padding:4}}/>
          <button onClick={()=>{setProfiles(prev=>prev.map(x=>x.id===editProfile.id?editProfile:x));setEditProfile(null);}} style={S.primaryBtn}>💾 Sauvegarder</button>
        </Modal>
      )}

      {/* Add Mission Modal */}
      {addMissionModal&&(
        <Modal title="Nouvelle Mission" onClose={()=>setAddMissionModal(false)}>
          <label style={S.label}>Nom de la mission</label>
          <input value={missionForm.name} onChange={e=>setMissionForm(p=>({...p,name:e.target.value}))} style={S.input} placeholder="Ex: Livraison Cargo — New Babbage"/>
          <label style={S.label}>Récompense (aUEC)</label>
          <input type="number" value={missionForm.amount} onChange={e=>setMissionForm(p=>({...p,amount:e.target.value}))} style={S.input} placeholder="25000"/>
          <label style={S.label}>Attribution</label>
          <div style={{display:"flex",gap:10,marginBottom:14}}>
            <button onClick={()=>setMissionForm(p=>({...p,split:true}))} style={{...S.toggleBtn,...(missionForm.split?S.toggleActive:{})}}>🤝 Partagée (50/50)</button>
            <button onClick={()=>setMissionForm(p=>({...p,split:false}))} style={{...S.toggleBtn,...(!missionForm.split?S.toggleActive:{})}}>👤 Solo</button>
          </div>
          {!missionForm.split&&(
            <>
              <label style={S.label}>Attribuer à</label>
              <select value={missionForm.assignee} onChange={e=>setMissionForm(p=>({...p,assignee:e.target.value}))} style={S.input}>
                {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </>
          )}
          <label style={S.label}>Note (optionnel)</label>
          <input value={missionForm.note} onChange={e=>setMissionForm(p=>({...p,note:e.target.value}))} style={S.input} placeholder="Type de mission, lieu..."/>
          {+missionForm.amount>0&&(
            <div style={{background:"#07111f",border:"1px solid #00ff9d44",borderRadius:8,padding:10,marginBottom:8,marginTop:4}}>
              <div style={{color:"#8899bb",fontSize:11,fontFamily:"'Rajdhani',sans-serif",marginBottom:4}}>Aperçu de la distribution</div>
              {missionForm.split?(
                <div style={{display:"flex",gap:10}}>
                  {profiles.map(p=><div key={p.id} style={{flex:1,color:p.color,fontFamily:"'Orbitron',sans-serif",fontSize:13}}>{p.name}: +{fmt(Math.floor(+missionForm.amount/2))}</div>)}
                </div>
              ):(
                <div style={{color:profiles.find(p=>p.id===missionForm.assignee)?.color,fontFamily:"'Orbitron',sans-serif",fontSize:13}}>
                  {profiles.find(p=>p.id===missionForm.assignee)?.name} : +{fmt(+missionForm.amount)} aUEC
                </div>
              )}
            </div>
          )}
          <button onClick={addMission} style={S.primaryBtn}>✅ Valider la mission</button>
        </Modal>
      )}
    </div>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────
const S={
  header:{position:"sticky",top:0,zIndex:100,background:"rgba(3,7,15,0.95)",borderBottom:"1px solid #00d4ff22",backdropFilter:"blur(16px)"},
  headerInner:{maxWidth:900,margin:"0 auto",padding:"10px 12px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8},
  nav:{display:"flex",overflowX:"auto",background:"rgba(3,7,15,0.9)",borderBottom:"1px solid #1a2a4455",position:"sticky",top:61,zIndex:99,backdropFilter:"blur(12px)"},
  content:{maxWidth:900,margin:"0 auto",padding:"16px 12px 80px",overflowX:"hidden",boxSizing:"border-box"},
  profileCard:{background:"#07111fcc",border:"1px solid",borderRadius:14,padding:14,transition:"all .3s",backdropFilter:"blur(12px)",minWidth:0,overflow:"hidden"},
  statRow:{display:"flex",gap:6,flexWrap:"wrap"},
  statItem:{flex:1,minWidth:70,background:"#0a1628",borderRadius:8,padding:"5px 7px",minWidth:0,overflow:"hidden"},
  statLabel:{color:"#8899bb",fontSize:9,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"},
  hexTile:{background:"#07111fcc",border:"1px solid",borderRadius:12,padding:"14px 10px",textAlign:"center",transition:"all .25s",backdropFilter:"blur(8px)"},
  missionItem:{background:"#07111fcc",border:"1px solid #1a2a4488",borderRadius:10,padding:14,marginBottom:8,cursor:"pointer",backdropFilter:"blur(8px)"},
  calcBox:{background:"#07111fcc",border:"1px solid #1a2a4488",borderRadius:12,padding:18,backdropFilter:"blur(8px)"},
  objectiveCard:{background:"#07111fcc",border:"1px solid",borderRadius:12,padding:14,backdropFilter:"blur(8px)"},
  progressBar:{background:"#1a2a44",borderRadius:4,height:6,overflow:"hidden"},
  progressFill:{height:"100%",borderRadius:4,transition:"width .4s ease"},
  resultBox:{background:"#0a1628",border:"1px solid #00d4ff44",borderRadius:10,padding:"10px 14px"},
  shipChip:{background:"#0a1628",border:"1px solid #1a2a4488",borderRadius:20,padding:"5px 12px",fontSize:12,color:"#8899bb",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",transition:"all .2s"},
  sectionTitle:{fontFamily:"'Orbitron',sans-serif",fontSize:12,fontWeight:700,color:"#00d4ff",letterSpacing:3,marginBottom:12,textTransform:"uppercase"},
  label:{display:"block",color:"#8899bb",fontSize:11,letterSpacing:1.5,marginBottom:4,marginTop:10,fontFamily:"'Rajdhani',sans-serif",textTransform:"uppercase"},
  input:{width:"100%",background:"#0a1628",border:"1px solid #1a2a44",borderRadius:8,padding:"9px 12px",color:"#e8f4ff",fontSize:14,outline:"none",marginBottom:4},
  primaryBtn:{background:"linear-gradient(135deg,#00d4ff22,#0a1628)",border:"1px solid #00d4ff66",color:"#00d4ff",borderRadius:8,padding:"10px 18px",cursor:"pointer",fontFamily:"'Orbitron',sans-serif",fontSize:12,fontWeight:700,letterSpacing:1,transition:"all .2s",marginTop:10,width:"100%"},
  dangerBtn:{background:"transparent",border:"1px solid #ff446644",color:"#ff4466",borderRadius:6,padding:"5px 10px",cursor:"pointer",fontSize:11,fontFamily:"'Rajdhani',sans-serif"},
  ghostBtn:{background:"transparent",border:"1px solid #1a2a44",color:"#8899bb",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",fontSize:12},
  editBtn:{background:"transparent",border:"1px solid",borderRadius:6,padding:"4px 8px",cursor:"pointer",fontSize:12},
  closeBtn:{background:"transparent",border:"none",color:"#8899bb",cursor:"pointer",fontSize:18,padding:4},
  toggleBtn:{flex:1,background:"#0a1628",border:"1px solid #1a2a44",color:"#8899bb",borderRadius:8,padding:"8px 12px",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",fontSize:13,fontWeight:600},
  toggleActive:{background:"#00d4ff22",borderColor:"#00d4ff66",color:"#00d4ff"},
  badgeCommon:{background:"#ffcc0022",border:"1px solid #ffcc0055",color:"#ffcc00",borderRadius:10,padding:"2px 8px",fontSize:9,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"},
  badgePersonal:{background:"transparent",border:"1px solid",borderRadius:10,padding:"2px 8px",fontSize:9,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",zIndex:999,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(4px)"},
  modalBox:{background:"#07111f",border:"1px solid #00d4ff44",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:520,maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column"},
  modalHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"16px 20px",borderBottom:"1px solid #1a2a44"},
  modalTitle:{fontFamily:"'Orbitron',sans-serif",fontSize:14,color:"#00d4ff",fontWeight:700},
  modalBody:{padding:"16px 20px",overflowY:"auto",flex:1},
};