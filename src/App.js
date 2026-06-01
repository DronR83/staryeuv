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
// Flotte par joueur : { p1: [...], p2: [...] }
const DEFAULT_FLEETS = {
  p1: [
    { id: "s1", name: "Cutlass Black", capacity: 46  },
    { id: "s2", name: "Prospector",    capacity: 32  },
  ],
  p2: [
    { id: "s3", name: "Avenger Titan", capacity: 8   },
    { id: "s4", name: "Caterpillar",   capacity: 576 },
  ],
};

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
    const stars = [], shooters = [], dustParticles = [];

    function resize() { w = canvas.width = window.innerWidth; h = canvas.height = window.innerHeight; }
    resize();
    window.addEventListener("resize", resize);

    // Étoiles
    for (let i = 0; i < 280; i++) stars.push({
      x: Math.random()*3000, y: Math.random()*3000,
      r: Math.random()*1.2+.15,
      speed: Math.random()*.006+.001,
      phase: Math.random()*Math.PI*2,
      brightness: Math.random()*.5+.5
    });

    // Poussière cosmique autour du trou noir
    for (let i = 0; i < 60; i++) dustParticles.push({
      angle: Math.random()*Math.PI*2,
      radius: Math.random()*.3+.7,
      speed: (Math.random()*.003+.001)*(Math.random()<.5?1:-1),
      size: Math.random()*1.5+.5,
      alpha: Math.random()*.6+.2,
    });

    function spawnShooter() {
      if (shooters.length > 3) return;
      shooters.push({
        x: Math.random()*w, y: Math.random()*h*.4,
        vx: (Math.random()*5+3)*(Math.random()<.5?1:-1),
        vy: Math.random()*1.5+.5,
        life: 1, len: Math.random()*140+80
      });
    }

    function draw() {
      t++;
      ctx.clearRect(0,0,w,h);

      // ── Fond dégradé spatial ──────────────────────────────────────────────
      const bgGrad = ctx.createLinearGradient(0,0,0,h);
      bgGrad.addColorStop(0, "#020510");
      bgGrad.addColorStop(.5,"#030814");
      bgGrad.addColorStop(1, "#020510");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0,0,w,h);

      // ── Trou noir ── positionné en haut à droite, plus petit ─────────────
      const cx = w * 0.78;
      const cy = h * 0.18;
      const bhR = Math.min(w,h) * 0.10; // plus petit = moins gênant

      // Lentille gravitationnelle — halo extérieur subtil
      for (let ring = 5; ring >= 1; ring--) {
        const rr = bhR*(1.2+ring*.5);
        const alpha = 0.04/ring;
        const lensGrad = ctx.createRadialGradient(cx,cy,bhR,cx,cy,rr);
        lensGrad.addColorStop(0, `rgba(60,120,255,${alpha*2})`);
        lensGrad.addColorStop(.5,`rgba(140,60,255,${alpha})`);
        lensGrad.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = lensGrad;
        ctx.beginPath();
        ctx.arc(cx,cy,rr,0,Math.PI*2);
        ctx.fill();
      }

      // Disque d'accrétion — anneau elliptique lumineux rotatif
      ctx.save();
      ctx.translate(cx, cy);
      const diskAngle = t * 0.004;
      ctx.rotate(diskAngle);

      // Anneau avant (en dessous du trou noir)
      for (let layer = 0; layer < 3; layer++) {
        const stretch = 2.2 + layer*0.3;
        const squeeze = 0.32 - layer*0.04;
        const diskR   = bhR*(1.1+layer*0.18);
        const alphaD  = (0.7-layer*0.2)*(0.85+0.15*Math.sin(t*0.025+layer));
        const diskGrad = ctx.createRadialGradient(0,0,diskR*0.6,0,0,diskR*stretch);
        if (layer===0) {
          diskGrad.addColorStop(0,   `rgba(255,200,100,${alphaD})`);
          diskGrad.addColorStop(0.3, `rgba(255,120,40,${alphaD*.8})`);
          diskGrad.addColorStop(0.6, `rgba(100,60,255,${alphaD*.4})`);
          diskGrad.addColorStop(1,   "rgba(0,0,0,0)");
        } else {
          diskGrad.addColorStop(0,   `rgba(0,180,255,${alphaD*.6})`);
          diskGrad.addColorStop(0.5, `rgba(80,0,200,${alphaD*.3})`);
          diskGrad.addColorStop(1,   "rgba(0,0,0,0)");
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = diskGrad;
        ctx.beginPath();
        ctx.ellipse(0,0,diskR*stretch,diskR*squeeze,0,0,Math.PI*2);
        ctx.fill();
      }
      ctx.restore();

      // Singularité — trou noir central (pur noir)
      const singGrad = ctx.createRadialGradient(cx,cy,0,cx,cy,bhR*1.05);
      singGrad.addColorStop(0,   "rgba(0,0,0,1)");
      singGrad.addColorStop(0.7, "rgba(0,0,0,1)");
      singGrad.addColorStop(0.85,"rgba(0,0,0,.96)");
      singGrad.addColorStop(1,   "rgba(0,0,0,.7)");
      ctx.fillStyle = singGrad;
      ctx.beginPath();
      ctx.arc(cx,cy,bhR*1.05,0,Math.PI*2);
      ctx.fill();

      // Photon ring — anneau lumineux autour de la singularité
      ctx.save();
      ctx.shadowColor = "#ffaa44";
      ctx.shadowBlur = 12+5*Math.sin(t*0.03);
      ctx.strokeStyle = `rgba(255,180,80,${0.6+0.2*Math.sin(t*0.03)})`;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx,cy,bhR*0.98,0,Math.PI*2);
      ctx.stroke();
      ctx.shadowColor = "#4488ff";
      ctx.shadowBlur = 8;
      ctx.strokeStyle = `rgba(80,160,255,${0.3+0.1*Math.sin(t*0.05)})`;
      ctx.lineWidth = .7;
      ctx.beginPath();
      ctx.arc(cx,cy,bhR*1.06,0,Math.PI*2);
      ctx.stroke();
      ctx.restore();

      // Poussière orbitale
      dustParticles.forEach(d => {
        d.angle += d.speed;
        const dx = cx + Math.cos(d.angle)*bhR*(d.radius+1.2);
        const dy = cy + Math.sin(d.angle)*bhR*(d.radius*.35+.2);
        ctx.globalAlpha = d.alpha*(0.5+0.5*Math.sin(t*.02+d.angle));
        ctx.fillStyle = "#ffcc88";
        ctx.beginPath();
        ctx.arc(dx,dy,d.size*.6,0,Math.PI*2);
        ctx.fill();
      });

      // ── Étoiles scintillantes ─────────────────────────────────────────────
      ctx.globalAlpha = 1;
      stars.forEach(s => {
        const flicker = s.brightness*(0.5+0.5*Math.abs(Math.sin(t*s.speed+s.phase)));
        // Étoiles loin du trou noir = plus visibles
        const dist = Math.hypot((s.x%w)-cx,(s.y%h)-cy);
        const obscure = dist < bhR*2.5 ? Math.max(0,(dist-bhR*1.1)/(bhR*1.4)) : 1;
        ctx.globalAlpha = flicker*obscure;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(s.x%w,s.y%h,s.r,0,Math.PI*2);
        ctx.fill();
        // Petite croix pour les grosses étoiles
        if (s.r > 1.0 && flicker > 0.8) {
          ctx.globalAlpha = flicker*obscure*.4;
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = .5;
          ctx.beginPath();
          ctx.moveTo(s.x%w-s.r*3,s.y%h); ctx.lineTo(s.x%w+s.r*3,s.y%h);
          ctx.moveTo(s.x%w,s.y%h-s.r*3); ctx.lineTo(s.x%w,s.y%h+s.r*3);
          ctx.stroke();
        }
      });

      // ── Étoiles filantes ─────────────────────────────────────────────────
      if(t%100===0) spawnShooter();
      for(let i=shooters.length-1;i>=0;i--){
        const s=shooters[i]; s.x+=s.vx; s.y+=s.vy; s.life-=.01;
        if(s.life<=0||s.x<-300||s.x>w+300||s.y>h+200){shooters.splice(i,1);continue;}
        const mag=Math.hypot(s.vx,s.vy);
        const sg=ctx.createLinearGradient(s.x-s.vx*(s.len/mag),s.y-s.vy*(s.len/mag),s.x,s.y);
        sg.addColorStop(0,"rgba(255,255,255,0)");
        sg.addColorStop(.7,`rgba(200,230,255,${s.life*.4})`);
        sg.addColorStop(1,`rgba(255,255,255,${s.life*.9})`);
        ctx.globalAlpha=1; ctx.strokeStyle=sg; ctx.lineWidth=1.2;
        ctx.beginPath();
        ctx.moveTo(s.x-s.vx*(s.len/mag),s.y-s.vy*(s.len/mag));
        ctx.lineTo(s.x,s.y); ctx.stroke();
      }
      ctx.globalAlpha=1;
      raf=requestAnimationFrame(draw);
    }
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize",resize); };
  }, []);
  return (
    <canvas
      ref={canvasRef}
      style={{ position:"fixed", inset:0, zIndex:0, pointerEvents:"none", opacity:0.85 }}
    />
  );
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
function HexTile({ icon, label, value, sub, color="#00d4ff", onClick, pulse, isDesktop }) {
  const [hov,setHov]=useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ ...S.hexTile, padding:isDesktop?"20px 14px":"14px 10px", borderColor:hov?color:color+"66", boxShadow:hov?`0 0 32px ${color}88,0 0 8px ${color}44 inset`:`0 0 12px ${color}33`, transform:hov?"scale(1.04) translateY(-2px)":"scale(1)", background:hov?"#0a1628dd":"#07111fcc", cursor:onClick?"pointer":"default", animation:pulse?"pulse 2s ease-in-out infinite":"none" }}>
      <div style={{fontSize:isDesktop?38:32,marginBottom:isDesktop?7:5}}>{icon}</div>
      <div style={{color,fontSize:isDesktop?13:12,fontFamily:"'Rajdhani',sans-serif",letterSpacing:2,textTransform:"uppercase"}}>{label}</div>
      {value!==undefined&&<div style={{color:"#e8f4ff",fontSize:isDesktop?24:20,fontWeight:700,fontFamily:"'Orbitron',sans-serif",margin:isDesktop?"4px 0":"3px 0"}}>{value}</div>}
      {sub&&<div style={{color:"#8899bb",fontSize:isDesktop?12:11,fontFamily:"'Rajdhani',sans-serif"}}>{sub}</div>}
    </div>
  );
}

// ─── PROFILE CARD ─────────────────────────────────────────────────────────────
function ProfileCard({ profile, onEdit, onHangar, isDesktop }) {
  const [hov,setHov]=useState(false);
  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ ...S.profileCard, padding:isDesktop?20:14, borderColor:hov?profile.color:profile.color+"55", boxShadow:hov?`0 0 40px ${profile.color}44`:`0 0 16px ${profile.color}22`, transform:hov?"translateY(-4px)":"none" }}>
      <div style={{display:"flex",alignItems:"center",gap:isDesktop?18:14,marginBottom:isDesktop?16:12}}>
        <div
          onClick={onHangar}
          style={{ width:isDesktop?72:56,height:isDesktop?72:56,borderRadius:"50%",border:`2px solid ${profile.color}`,background:profile.avatar?`url(${profile.avatar}) center/cover no-repeat`:`radial-gradient(circle,${profile.color}44,#0a1628)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:isDesktop?28:22,boxShadow:`0 0 16px ${profile.color}66`,flexShrink:0,cursor:"pointer",transition:"transform .2s" }}
          title="Ouvrir le hangar"
        >
          {!profile.avatar&&"👤"}
        </div>
        <div onClick={onHangar} title="Ouvrir le hangar" style={{flex:1,cursor:"pointer"}}>
          <div style={{color:profile.color,fontFamily:"'Orbitron',sans-serif",fontSize:isDesktop?18:15,fontWeight:700}}>{profile.name}</div>
          <div style={{color:"#8899bb",fontSize:isDesktop?12:10,fontFamily:"'Rajdhani',sans-serif",letterSpacing:1}}>🚀 VOIR LE HANGAR</div>
        </div>
        <button onClick={onEdit} style={{...S.editBtn,borderColor:profile.color,color:profile.color,fontSize:isDesktop?15:12}}>✏️</button>
      </div>
      <div style={S.statRow}>
        <div style={S.statItem}><div style={{...S.statLabel,fontSize:isDesktop?11:10}}>aUEC</div><div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:isDesktop?19:16,fontWeight:700}}>{fmt(profile.aUEC)}</div></div>
        <div style={S.statItem}><div style={{...S.statLabel,fontSize:isDesktop?11:10}}>VAISSEAU</div><div style={{color:"#e8f4ff",fontFamily:"'Rajdhani',sans-serif",fontSize:isDesktop?15:12}}>{profile.ship}</div></div>
        <div style={S.statItem}><div style={{...S.statLabel,fontSize:isDesktop?11:10}}>POSITION</div><div style={{color:"#e8f4ff",fontFamily:"'Rajdhani',sans-serif",fontSize:isDesktop?14:11}}>{profile.location}</div></div>
      </div>
    </div>
  );
}

// ─── MISSION ITEM ─────────────────────────────────────────────────────────────
function MissionItem({ mission, profiles, onDelete, isDesktop }) {
  const [exp,setExp]=useState(false);
  const share=Math.floor(mission.amount/2);
  const owner=profiles.find(p=>p.id===mission.assignee);
  return (
    <div style={{...S.missionItem,padding:isDesktop?"16px 20px":14}} onClick={()=>setExp(!exp)}>
      <div style={{display:"flex",alignItems:"center",gap:isDesktop?14:10}}>
        <div style={{fontSize:isDesktop?22:18}}>{mission.split?"🤝":mission.assignee==="p1"?"🔵":"🟠"}</div>
        <div style={{flex:1}}>
          <div style={{color:"#e8f4ff",fontFamily:"'Rajdhani',sans-serif",fontSize:isDesktop?16:14,fontWeight:600}}>{mission.name}</div>
          <div style={{color:"#8899bb",fontSize:isDesktop?12:10,fontFamily:"'Rajdhani',sans-serif"}}>{mission.date}</div>
        </div>
        <div style={{textAlign:"right"}}>
          <div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:isDesktop?15:13,fontWeight:700}}>{fmt(mission.amount)} aUEC</div>
          {mission.split&&<div style={{color:"#ffcc00",fontSize:isDesktop?12:10,fontFamily:"'Rajdhani',sans-serif"}}>PARTAGÉE</div>}
        </div>
      </div>
      {exp&&(
        <div style={{marginTop:10,paddingTop:10,borderTop:"1px solid #1a2a44"}}>
          {mission.split?(
            <div style={{display:"flex",gap:12}}>
              {profiles.map(p=>(
                <div key={p.id} style={{flex:1,background:"#0a1628",borderRadius:6,padding:8,border:`1px solid ${p.color}44`}}>
                  <div style={{color:p.color,fontSize:isDesktop?12:10,fontFamily:"'Rajdhani',sans-serif"}}>{p.name}</div>
                  <div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:isDesktop?16:14}}>+{fmt(share)}</div>
                </div>
              ))}
            </div>
          ):(
            <div style={{color:"#8899bb",fontSize:isDesktop?14:12,fontFamily:"'Rajdhani',sans-serif"}}>Attribué à : <span style={{color:owner?.color}}>{owner?.name}</span></div>
          )}
          {mission.note&&<div style={{color:"#8899bb",fontSize:isDesktop?13:11,marginTop:6,fontFamily:"'Rajdhani',sans-serif"}}>📝 {mission.note}</div>}
          <button onClick={e=>{e.stopPropagation();onDelete(mission.id);}} style={{...S.dangerBtn,marginTop:8,fontSize:isDesktop?13:11}}>🗑 Supprimer</button>
        </div>
      )}
    </div>
  );
}

// ─── MINING CALCULATOR (prix réel minerai) ────────────────────────────────────
// ─── OBJECTIVES TAB ───────────────────────────────────────────────────────────
const OBJ_CATEGORIES = [
  { id:"ship",    icon:"🚀", label:"Vaisseau"   },
  { id:"armor",   icon:"🛡", label:"Armure"     },
  { id:"weapon",  icon:"🔫", label:"Arme"       },
  { id:"clothes", icon:"👕", label:"Vêtement"   },
  { id:"accesso", icon:"💎", label:"Accessoire" },
  { id:"other",   icon:"🎯", label:"Autre"      },
];

function ObjectivesTab({ objectives, setObjectives, profiles, setProfiles }) {
  const [modal,      setModal]      = useState(false);
  const [detailObj,  setDetailObj]  = useState(null); // objectif commun sélectionné
  const [form, setForm] = useState({ name:"", cost:"", icon:"🎯", category:"other", type:"common", owner:"p1" });

  const all = [
    ...objectives.common.map(o=>({...o, type:"common"})),
    ...Object.entries(objectives.personal).flatMap(([pid,arr])=>arr.map(o=>({...o, type:"personal", owner:pid})))
  ];

  function add() {
    if (!form.name) return;
    const catIcon = OBJ_CATEGORIES.find(c=>c.id===form.category)?.icon || "🎯";
    const obj = { id:"obj"+Date.now(), icon:catIcon, name:form.name, cost:+form.cost, category:form.category, type:form.type, owner:form.owner };
    if (form.type==="common") setObjectives(p=>({...p, common:[...p.common, obj]}));
    else setObjectives(p=>({...p, personal:{...p.personal, [form.owner]:[...(p.personal[form.owner]||[]), obj]}}));
    setModal(false);
    setForm({ name:"", cost:"", icon:"🎯", category:"other", type:"common", owner:"p1" });
  }

  function validateObjective(obj) {
    if (!window.confirm(`Valider "${obj.name}" et déduire ${fmt(obj.cost)} aUEC ?`)) return;
    // Déduire les aUEC
    if (obj.type === "common") {
      const share = Math.floor(obj.cost / profiles.length);
      setProfiles(prev => prev.map(p => ({ ...p, aUEC: p.aUEC - share })));
    } else {
      setProfiles(prev => prev.map(p => p.id === obj.owner ? { ...p, aUEC: p.aUEC - obj.cost } : p));
    }
    // Supprimer l'objectif
    del(obj);
  }
    if (obj.type==="common") setObjectives(p=>({...p, common:p.common.filter(x=>x.id!==obj.id)}));
    else setObjectives(p=>({...p, personal:{...p.personal, [obj.owner]:p.personal[obj.owner].filter(x=>x.id!==obj.id)}}));
    setDetailObj(null);
  }

  function getAutoProgress(obj) {
    if (!obj.cost || obj.cost<=0) return 0;
    if (obj.type==="common") {
      const total = profiles.reduce((a,p)=>a+(p.aUEC||0), 0);
      return Math.min(100, Math.round((total/obj.cost)*100));
    } else {
      const money = profiles.find(p=>p.id===obj.owner)?.aUEC || 0;
      return Math.min(100, Math.round((money/obj.cost)*100));
    }
  }

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
        <div style={S.sectionTitle}>🎯 OBJECTIFS</div>
        <button onClick={()=>setModal(true)} style={{...S.primaryBtn,width:"auto",marginTop:0}}>+ Objectif</button>
      </div>
      {all.length===0 && <div style={{color:"#8899bb",textAlign:"center",padding:40,fontFamily:"'Rajdhani',sans-serif"}}>Aucun objectif</div>}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {all.map(obj=>{
          const owner    = profiles.find(p=>p.id===obj.owner);
          const pct      = getAutoProgress(obj);
          const barColor = pct>=100?"#00ff9d":obj.type==="common"?"#ffcc00":(owner?.color||"#00d4ff");
          const currentMoney = obj.type==="common"
            ? profiles.reduce((a,p)=>a+(p.aUEC||0),0)
            : (profiles.find(p=>p.id===obj.owner)?.aUEC||0);
          return (
            <div key={obj.id}
              onClick={()=>{ if(obj.type==="common") setDetailObj(obj); }}
              style={{...S.objectiveCard, borderColor:obj.type==="common"?"#ffcc0055":(owner?.color+"55"||"#00d4ff55"), cursor:obj.type==="common"?"pointer":"default" }}>
              <div style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                <div style={{fontSize:26,flexShrink:0}}>{obj.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:6,marginBottom:4,flexWrap:"wrap"}}>
                    <div style={{color:"#e8f4ff",fontFamily:"'Rajdhani',sans-serif",fontSize:15,fontWeight:600}}>{obj.name}</div>
                    <div style={{display:"flex",gap:4,alignItems:"center"}}>
                      {obj.type==="common"
                        ? <span style={S.badgeCommon}>COMMUN 👆</span>
                        : <span style={{...S.badgePersonal,color:owner?.color,borderColor:owner?.color+"55"}}>{owner?.name}</span>
                      }
                    </div>
                  </div>
                  {obj.cost>0&&(
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8,flexWrap:"wrap",gap:4}}>
                      <div style={{color:"#ffcc00",fontSize:11,fontFamily:"'Orbitron',sans-serif"}}>{fmt(currentMoney)} / {fmt(obj.cost)} aUEC</div>
                      {pct>=100
                        ? <span style={{color:"#00ff9d",fontSize:11,fontFamily:"'Orbitron',sans-serif",fontWeight:700}}>✅ ATTEINT !</span>
                        : <span style={{color:barColor,fontSize:13,fontFamily:"'Orbitron',sans-serif",fontWeight:700}}>{pct}%</span>
                      }
                    </div>
                  )}
                  <div style={{...S.progressBar,height:8,borderRadius:6,position:"relative",overflow:"hidden"}}>
                    <div style={{...S.progressFill,width:`${pct}%`,background:`linear-gradient(90deg,${barColor}88,${barColor})`,borderRadius:6,boxShadow:`0 0 10px ${barColor}88`,transition:"width 1s ease"}}/>
                    <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.12) 50%,transparent)",animation:"shimmer 2s infinite"}}/>
                  </div>
                  {pct>=100&&obj.cost>0&&(
                    <button
                      onClick={e=>{e.stopPropagation();validateObjective(obj);}}
                      style={{
                        marginTop:10,width:"100%",padding:"10px 0",
                        background:"linear-gradient(135deg,#00ff9d22,#0a1628)",
                        border:"1px solid #00ff9d88",borderRadius:8,cursor:"pointer",
                        color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:11,fontWeight:700,
                        letterSpacing:1,boxShadow:"0 0 16px #00ff9d44",
                        animation:"pulse 1.5s ease-in-out infinite",
                      }}
                    >✅ VALIDER — DÉDUIRE {fmt(obj.cost)} aUEC</button>
                  )}
                </div>
                <button onClick={e=>{e.stopPropagation();del(obj);}} style={{...S.closeBtn,flexShrink:0}}>🗑</button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal détail objectif commun */}
      {detailObj&&(()=>{
        const total    = profiles.reduce((a,p)=>a+(p.aUEC||0),0);
        const missing  = Math.max(0, (detailObj.cost||0) - total);
        const perPerson= Math.ceil(missing / profiles.length);
        const pct      = detailObj.cost>0 ? Math.min(100,Math.round(total/detailObj.cost*100)) : 0;
        return (
          <Modal title={`🎯 ${detailObj.name}`} onClose={()=>setDetailObj(null)}>
            <div style={{textAlign:"center",marginBottom:12}}>
              <div style={{fontSize:40,marginBottom:6}}>{detailObj.icon}</div>
              <div style={{color:"#ffcc00",fontFamily:"'Orbitron',sans-serif",fontSize:18,fontWeight:700}}>{fmt(detailObj.cost)} aUEC</div>
              <div style={{color:"#8899bb",fontSize:10,fontFamily:"'Rajdhani',sans-serif",letterSpacing:2}}>OBJECTIF TOTAL</div>
            </div>
            {/* Barre globale */}
            <div style={{...S.progressBar,height:12,borderRadius:8,marginBottom:6,position:"relative",overflow:"hidden"}}>
              <div style={{...S.progressFill,width:`${pct}%`,background:"linear-gradient(90deg,#ffcc0088,#ffcc00)",borderRadius:8,boxShadow:"0 0 12px #ffcc0088",transition:"width 1s ease"}}/>
              <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.12) 50%,transparent)",animation:"shimmer 2s infinite"}}/>
            </div>
            <div style={{color:"#ffcc00",textAlign:"center",fontFamily:"'Orbitron',sans-serif",fontSize:14,marginBottom:16}}>{pct}% atteint</div>

            {/* Avancement par joueur */}
            <div style={{background:"#0a1628",borderRadius:10,padding:12,marginBottom:12}}>
              <div style={{color:"#8899bb",fontSize:10,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",marginBottom:10}}>AVANCEMENT PAR JOUEUR</div>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {profiles.map(p=>{
                  const pPct = detailObj.cost>0 ? Math.min(100,Math.round((p.aUEC||0)/detailObj.cost*100)) : 0;
                  const pMiss = Math.max(0,(detailObj.cost||0)-(p.aUEC||0));
                  return (
                    <div key={p.id} style={{background:"#07111f",borderRadius:8,padding:10,border:`1px solid ${p.color}44`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                        <div style={{color:p.color,fontSize:12,fontFamily:"'Orbitron',sans-serif",fontWeight:700}}>{p.name}</div>
                        <div style={{color:p.color,fontSize:13,fontFamily:"'Orbitron',sans-serif",fontWeight:700}}>{pPct}%</div>
                      </div>
                      <div style={{...S.progressBar,height:7,borderRadius:4,position:"relative",overflow:"hidden",marginBottom:5}}>
                        <div style={{...S.progressFill,width:`${pPct}%`,background:`linear-gradient(90deg,${p.color}88,${p.color})`,borderRadius:4,boxShadow:`0 0 8px ${p.color}66`,transition:"width 1s ease"}}/>
                        <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.1) 50%,transparent)",animation:"shimmer 2s infinite"}}/>
                      </div>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:10,fontFamily:"'Rajdhani',sans-serif"}}>
                        <span style={{color:"#00ff9d"}}>{fmt(p.aUEC)} aUEC</span>
                        {pMiss>0&&<span style={{color:"#ff6b35"}}>manque {fmt(pMiss)}</span>}
                        {pMiss<=0&&<span style={{color:"#00ff9d"}}>✅ Part atteinte</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Il manque global */}
            {missing>0?(
              <div style={{background:"#0a1628",borderRadius:10,padding:12}}>
                <div style={{color:"#8899bb",fontSize:10,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",marginBottom:6}}>IL MANQUE AU TOTAL</div>
                <div style={{color:"#ff6b35",fontFamily:"'Orbitron',sans-serif",fontSize:20,fontWeight:700,textAlign:"center",marginBottom:10}}>{fmt(missing)} aUEC</div>
                <div style={{color:"#8899bb",fontSize:10,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",marginBottom:6}}>PAR PERSONNE</div>
                <div style={{display:"flex",gap:8}}>
                  {profiles.map(p=>(
                    <div key={p.id} style={{flex:1,background:"#07111f",borderRadius:8,padding:8,border:`1px solid ${p.color}44`,textAlign:"center"}}>
                      <div style={{color:p.color,fontSize:10,fontFamily:"'Rajdhani',sans-serif",marginBottom:4}}>{p.name}</div>
                      <div style={{color:"#ff6b35",fontFamily:"'Orbitron',sans-serif",fontSize:13,fontWeight:700}}>{fmt(perPerson)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ):(
              <div style={{color:"#00ff9d",textAlign:"center",fontFamily:"'Orbitron',sans-serif",fontSize:16,padding:12}}>✅ OBJECTIF ATTEINT !</div>
            )}
          </Modal>
        );
      })()}

      {/* Modal création */}
      {modal&&(
        <Modal title="Nouvel objectif" onClose={()=>setModal(false)}>
          <label style={S.label}>Catégorie</label>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
            {OBJ_CATEGORIES.map(c=>(
              <button key={c.id} onClick={()=>setForm(p=>({...p,category:c.id}))} style={{
                padding:"7px 12px",borderRadius:8,cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",fontSize:12,fontWeight:600,
                background: form.category===c.id?"#00d4ff22":"#0a1628",
                border:`1px solid ${form.category===c.id?"#00d4ff":"#1a2a44"}`,
                color: form.category===c.id?"#00d4ff":"#8899bb",
              }}>{c.icon} {c.label}</button>
            ))}
          </div>
          <label style={S.label}>Nom</label>
          <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={S.input} placeholder="Ex: Hercules C2, Armure Novikov..."/>
          <label style={S.label}>Coût en aUEC</label>
          <input type="number" value={form.cost} onChange={e=>setForm(p=>({...p,cost:e.target.value}))} style={S.input} placeholder="Ex: 5000000"/>
          <label style={S.label}>Type</label>
          <div style={{display:"flex",gap:8,marginBottom:4}}>
            <button onClick={()=>setForm(p=>({...p,type:"common"}))} style={{...S.toggleBtn,flex:1,...(form.type==="common"?S.toggleActive:{})}}>🤝 Commun</button>
            <button onClick={()=>setForm(p=>({...p,type:"personal"}))} style={{...S.toggleBtn,flex:1,...(form.type==="personal"?S.toggleActive:{})}}>👤 Personnel</button>
          </div>
          {form.type==="personal"&&(
            <div style={{display:"flex",gap:8,marginTop:6}}>
              {profiles.map(p=>(
                <button key={p.id} onClick={()=>setForm(prev=>({...prev,owner:p.id}))}
                  style={{...S.toggleBtn,flex:1,...(form.owner===p.id?{background:p.color+"22",borderColor:p.color+"66",color:p.color}:{})}}>
                  {p.name}
                </button>
              ))}
            </div>
          )}
          <button onClick={add} style={S.primaryBtn}>✅ Créer</button>
        </Modal>
      )}
    </div>
  );
}

// ─── CALCULATEUR TAB ──────────────────────────────────────────────────────────
function CalcTab({ fleets, profiles }) {
  const [minerals,   setMinerals]   = useState([]);
  const [loadingMin, setLoadingMin] = useState(false);
  const [selMineral, setSelMineral] = useState("");
  const [selShip,    setSelShip]    = useState("");
  const [manualPrice,setManualPrice]= useState("");
  // Achat/Revente
  const [buyPrice,   setBuyPrice]   = useState("");
  const [sellPrice,  setSellPrice]  = useState("");
  const [quantity,   setQuantity]   = useState("100");
  const [mode,       setMode]       = useState("mining"); // mining | trade
  const [tradeModal, setTradeModal] = useState(false);
  const [tradeForm,  setTradeForm]  = useState({ type:"common", owner:"p1" });

  const allShips = Object.values(fleets).flat();

  useEffect(() => {
    if (allShips.length > 0) setSelShip(allShips[0].id);
  }, []); // eslint-disable-line

  async function loadMinerals() {
    setLoadingMin(true);
    try {
      const r = await fetch("https://api.uexcorp.space/2.0/commodities_raw_prices_all");
      const j = await r.json();
      const rows = j.data || j || [];
      const map = {};
      rows.forEach(row => {
        const name = row.commodity_name || row.name;
        if (!name || !(row.price_sell > 0)) return;
        if (!map[name] || row.price_sell > map[name].price) map[name] = { name, price: Math.round(row.price_sell) };
      });
      const list = Object.values(map).sort((a,b)=>b.price-a.price);
      setMinerals(list);
      if (list.length > 0) { setSelMineral(list[0].name); setManualPrice(String(list[0].price)); }
    } catch(e) {}
    setLoadingMin(false);
  }

  useEffect(() => { loadMinerals(); }, []); // eslint-disable-line

  const ship       = allShips.find(s=>s.id===selShip);
  const price      = +manualPrice || 0;
  const profitFull = ship ? price * 100 * ship.capacity : 0;

  // Achat/Revente
  const buy      = +buyPrice  || 0;
  const sell     = +sellPrice || 0;
  const qty      = +quantity  || 0;
  const margin   = sell - buy;
  const totalProfit = margin * qty;
  const marginPct   = buy > 0 ? Math.round((margin / buy) * 100) : 0;

  return (
    <div>
      {/* Bouton UEX Corp */}
      <a href="https://uexcorp.space" target="_blank" rel="noreferrer" style={{ textDecoration:"none", display:"block", marginBottom:20 }}>
        <div style={{
          background:"linear-gradient(135deg,#00d4ff18,#0a1628,#7b2fff18)",
          border:"1px solid #00d4ff55", borderRadius:14, padding:"16px 20px",
          display:"flex", alignItems:"center", gap:14,
          boxShadow:"0 0 24px #00d4ff22", animation:"pulse 3s ease-in-out infinite",
          position:"relative", overflow:"hidden",
        }}>
          <div style={{ position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(0,212,255,0.06),transparent)",animation:"shimmer 3s infinite",pointerEvents:"none" }}/>
          <div style={{ fontSize:32 }}>🌐</div>
          <div style={{ flex:1 }}>
            <div style={{ color:"#00d4ff", fontFamily:"'Orbitron',sans-serif", fontSize:15, fontWeight:900, letterSpacing:2 }}>UEX CORP</div>
            <div style={{ color:"#8899bb", fontSize:11, fontFamily:"'Rajdhani',sans-serif", letterSpacing:1 }}>PRIX MINERAIS & TRADING EN TEMPS RÉEL</div>
          </div>
          <div style={{ color:"#00d4ff", fontSize:20 }}>→</div>
        </div>
      </a>

      {/* Sélecteur de mode */}
      <div style={{ display:"flex", gap:8, marginBottom:16 }}>
        {[["mining","⛏ MINAGE"],["trade","🔄 ACHAT/REVENTE"]].map(([m,l])=>(
          <button key={m} onClick={()=>setMode(m)} style={{
            flex:1, padding:"11px 8px", border:`2px solid ${mode===m?"#00d4ff":"#1a2a44"}`,
            borderRadius:10, background: mode===m?"#00d4ff22":"#0a1628",
            color: mode===m?"#00d4ff":"#8899bb",
            fontFamily:"'Rajdhani',sans-serif", fontSize:13, fontWeight:700, letterSpacing:1, cursor:"pointer",
            boxShadow: mode===m?"0 0 16px #00d4ff33":"none", transition:"all .2s"
          }}>{l}</button>
        ))}
      </div>

      {/* ── MODE MINAGE ── */}
      {mode==="mining" && (
        <div style={{ background:"#07111fcc", border:"1px solid #00d4ff33", borderRadius:16, padding:20, backdropFilter:"blur(12px)" }}>
          <div style={S.sectionTitle}>⛏ CALCULATEUR DE MINAGE</div>
          <label style={S.label}>Minerai</label>
          <select value={selMineral} onChange={e=>{ setSelMineral(e.target.value); const m=minerals.find(x=>x.name===e.target.value); if(m) setManualPrice(String(m.price)); }} style={S.input} disabled={loadingMin}>
            {loadingMin?<option>Chargement...</option>:minerals.map(m=><option key={m.name} value={m.name}>{m.name} — {fmt(m.price)} aUEC/u</option>)}
          </select>
          <label style={S.label}>Prix/unité (aUEC) — modifiable manuellement</label>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input type="number" value={manualPrice} onChange={e=>setManualPrice(e.target.value)} style={{ ...S.input, flex:1, marginBottom:0, fontSize:18, fontFamily:"'Orbitron',sans-serif", color:"#ffcc00" }}/>
            <button onClick={loadMinerals} style={{ ...S.editBtn, color:"#00d4ff", borderColor:"#00d4ff44", padding:"10px 12px", fontSize:16 }} disabled={loadingMin}>{loadingMin?"⏳":"🔄"}</button>
          </div>
          <label style={S.label}>Vaisseau</label>
          <select value={selShip} onChange={e=>setSelShip(e.target.value)} style={S.input}>
            {allShips.length===0&&<option>— Ajoute un vaisseau dans le hangar —</option>}
            {allShips.map(s=>{ const own=Object.entries(fleets).find(([,arr])=>arr.find(x=>x.id===s.id)); const p=profiles.find(p=>p.id===own?.[0]); return <option key={s.id} value={s.id}>{s.name} ({s.capacity} SCU) — {p?.name||""}</option>; })}
          </select>
          {ship && price > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:16 }}>
              <div style={{ display:"flex", gap:10 }}>
                <div style={{ flex:1, background:"#0a1628", border:"1px solid #ffcc0033", borderRadius:10, padding:"12px 14px", textAlign:"center" }}>
                  <div style={{ color:"#8899bb", fontSize:9, letterSpacing:2, fontFamily:"'Rajdhani',sans-serif", marginBottom:4 }}>PRIX / UNITÉ</div>
                  <div style={{ color:"#ffcc00", fontFamily:"'Orbitron',sans-serif", fontSize:16, fontWeight:700 }}>{fmt(price)}</div>
                  <div style={{ color:"#8899bb", fontSize:9 }}>aUEC</div>
                </div>
                <div style={{ flex:1, background:"#0a1628", border:"1px solid #00d4ff33", borderRadius:10, padding:"12px 14px", textAlign:"center" }}>
                  <div style={{ color:"#8899bb", fontSize:9, letterSpacing:2, fontFamily:"'Rajdhani',sans-serif", marginBottom:4 }}>PROFIT / SCU</div>
                  <div style={{ color:"#00d4ff", fontFamily:"'Orbitron',sans-serif", fontSize:16, fontWeight:700 }}>{fmt(price*100)}</div>
                  <div style={{ color:"#8899bb", fontSize:9 }}>aUEC</div>
                </div>
              </div>
              <div style={{ background:"linear-gradient(135deg,#00ff9d11,#0a1628)", border:"1px solid #00ff9d55", borderRadius:12, padding:"18px 20px", textAlign:"center", boxShadow:"0 0 20px #00ff9d22", position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(0,255,157,0.05),transparent)",animation:"shimmer 4s infinite",pointerEvents:"none" }}/>
                <div style={{ color:"#8899bb", fontSize:9, letterSpacing:3, fontFamily:"'Rajdhani',sans-serif", marginBottom:6 }}>PROFIT MAX — {ship.name} ({ship.capacity} SCU)</div>
                <div style={{ color:"#00ff9d", fontFamily:"'Orbitron',sans-serif", fontSize:28, fontWeight:900, letterSpacing:2, textShadow:"0 0 20px #00ff9d88" }}>{fmt(profitFull)}</div>
                <div style={{ color:"#8899bb", fontSize:11, fontFamily:"'Rajdhani',sans-serif", marginTop:4, marginBottom:16 }}>aUEC par voyage complet</div>
                <button onClick={()=>{ window._pendingAmount=profitFull; window._pendingLabel=`Minage ${selMineral} — ${ship?.name}`; setTradeModal(true); }} style={{
                  background:"linear-gradient(135deg,#00ff9d22,#0a1628)",
                  border:"1px solid #00ff9d66", color:"#00ff9d",
                  borderRadius:10, padding:"11px 24px", cursor:"pointer",
                  fontFamily:"'Orbitron',sans-serif", fontSize:12, fontWeight:700, letterSpacing:1,
                  boxShadow:"0 0 14px #00ff9d22"
                }}>✅ VALIDER CE PROFIT</button>
              </div>
            </div>
          )}
          {(!ship||!price)&&<div style={{ color:"#8899bb", textAlign:"center", padding:20, fontFamily:"'Rajdhani',sans-serif" }}>Choisis un minerai et un vaisseau</div>}
        </div>
      )}

      {/* ── MODE ACHAT/REVENTE ── */}
      {mode==="trade" && (
        <div style={{ background:"#07111fcc", border:"1px solid #ffcc0033", borderRadius:16, padding:20, backdropFilter:"blur(12px)" }}>
          <div style={{ ...S.sectionTitle, color:"#ffcc00" }}>🔄 CALCULATEUR ACHAT / REVENTE</div>
          <label style={S.label}>Prix d'achat (aUEC/unité)</label>
          <input type="number" value={buyPrice} onChange={e=>setBuyPrice(e.target.value)} style={{ ...S.input, color:"#ff6b35", fontSize:18, fontFamily:"'Orbitron',sans-serif" }} placeholder="Ex: 1200"/>
          <label style={S.label}>Prix de vente (aUEC/unité)</label>
          <input type="number" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} style={{ ...S.input, color:"#00ff9d", fontSize:18, fontFamily:"'Orbitron',sans-serif" }} placeholder="Ex: 2400"/>
          <label style={S.label}>Quantité (unités)</label>
          <input type="number" value={quantity} onChange={e=>setQuantity(e.target.value)} style={{ ...S.input, fontSize:16 }} placeholder="Ex: 100"/>

          {buy > 0 && sell > 0 && qty > 0 && (
            <div style={{ display:"flex", flexDirection:"column", gap:10, marginTop:16 }}>
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1, background:"#0a1628", border:"1px solid #ff6b3544", borderRadius:10, padding:"12px 10px", textAlign:"center" }}>
                  <div style={{ color:"#8899bb", fontSize:9, letterSpacing:1, fontFamily:"'Rajdhani',sans-serif", marginBottom:4 }}>COÛT TOTAL</div>
                  <div style={{ color:"#ff6b35", fontFamily:"'Orbitron',sans-serif", fontSize:14, fontWeight:700 }}>{fmt(buy*qty)}</div>
                  <div style={{ color:"#8899bb", fontSize:9 }}>aUEC</div>
                </div>
                <div style={{ flex:1, background:"#0a1628", border:"1px solid #00ff9d44", borderRadius:10, padding:"12px 10px", textAlign:"center" }}>
                  <div style={{ color:"#8899bb", fontSize:9, letterSpacing:1, fontFamily:"'Rajdhani',sans-serif", marginBottom:4 }}>REVENTE TOTALE</div>
                  <div style={{ color:"#00ff9d", fontFamily:"'Orbitron',sans-serif", fontSize:14, fontWeight:700 }}>{fmt(sell*qty)}</div>
                  <div style={{ color:"#8899bb", fontSize:9 }}>aUEC</div>
                </div>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <div style={{ flex:1, background:"#0a1628", border:"1px solid #ffcc0044", borderRadius:10, padding:"12px 10px", textAlign:"center" }}>
                  <div style={{ color:"#8899bb", fontSize:9, letterSpacing:1, fontFamily:"'Rajdhani',sans-serif", marginBottom:4 }}>MARGE / UNITÉ</div>
                  <div style={{ color: margin>=0?"#ffcc00":"#ff4466", fontFamily:"'Orbitron',sans-serif", fontSize:14, fontWeight:700 }}>{margin>=0?"+":""}{fmt(margin)}</div>
                  <div style={{ color:"#8899bb", fontSize:9 }}>aUEC</div>
                </div>
                <div style={{ flex:1, background:"#0a1628", border:"1px solid #ffcc0044", borderRadius:10, padding:"12px 10px", textAlign:"center" }}>
                  <div style={{ color:"#8899bb", fontSize:9, letterSpacing:1, fontFamily:"'Rajdhani',sans-serif", marginBottom:4 }}>MARGE %</div>
                  <div style={{ color: marginPct>=0?"#ffcc00":"#ff4466", fontFamily:"'Orbitron',sans-serif", fontSize:14, fontWeight:700 }}>{marginPct>=0?"+":""}{marginPct}%</div>
                </div>
              </div>
              {/* Profit net animé */}
              <div style={{
                background: totalProfit>=0 ? "linear-gradient(135deg,#00ff9d11,#0a1628)" : "linear-gradient(135deg,#ff446611,#0a1628)",
                border: `1px solid ${totalProfit>=0?"#00ff9d55":"#ff446655"}`,
                borderRadius:12, padding:"20px", textAlign:"center",
                boxShadow: `0 0 24px ${totalProfit>=0?"#00ff9d33":"#ff446633"}`,
                position:"relative", overflow:"hidden"
              }}>
                <div style={{ position:"absolute",inset:0,background:`linear-gradient(90deg,transparent,${totalProfit>=0?"rgba(0,255,157,0.07)":"rgba(255,68,102,0.07)"},transparent)`,animation:"shimmer 3s infinite",pointerEvents:"none" }}/>
                <div style={{ color:"#8899bb", fontSize:9, letterSpacing:3, fontFamily:"'Rajdhani',sans-serif", marginBottom:8 }}>PROFIT NET TOTAL ({fmt(qty)} unités)</div>
                <div style={{
                  color: totalProfit>=0?"#00ff9d":"#ff4466",
                  fontFamily:"'Orbitron',sans-serif", fontSize:32, fontWeight:900, letterSpacing:2,
                  textShadow:`0 0 24px ${totalProfit>=0?"#00ff9daa":"#ff4466aa"}`,
                  animation:"glow 2s ease-in-out infinite"
                }}>
                  {totalProfit>=0?"+":""}{fmt(totalProfit)}
                </div>
                <div style={{ color:"#8899bb", fontSize:11, fontFamily:"'Rajdhani',sans-serif", marginTop:4, marginBottom:16 }}>aUEC</div>
                <button onClick={()=>{ window._pendingAmount=totalProfit; window._pendingLabel=`Trade ×${fmt(qty)}u`; setTradeModal(true); }} style={{
                  background: totalProfit>=0?"linear-gradient(135deg,#00ff9d22,#0a1628)":"linear-gradient(135deg,#ff446622,#0a1628)",
                  border:`1px solid ${totalProfit>=0?"#00ff9d66":"#ff446666"}`,
                  color: totalProfit>=0?"#00ff9d":"#ff4466",
                  borderRadius:10, padding:"11px 24px", cursor:"pointer",
                  fontFamily:"'Orbitron',sans-serif", fontSize:12, fontWeight:700, letterSpacing:1,
                  boxShadow:`0 0 14px ${totalProfit>=0?"#00ff9d22":"#ff446622"}`
                }}>{totalProfit>=0?"✅ VALIDER CE PROFIT":"⚠️ ENREGISTRER CETTE PERTE"}</button>
              </div>
            </div>
          )}
          {(!buy||!sell||!qty)&&<div style={{ color:"#8899bb", textAlign:"center", padding:20, fontFamily:"'Rajdhani',sans-serif" }}>Entre les prix d'achat, de vente et la quantité</div>}
        </div>
      )}

      {/* Modal validation profit */}
      {tradeModal && (
        <Modal title={window._pendingAmount>=0?"✅ Valider le profit":"⚠️ Enregistrer la perte"} onClose={()=>setTradeModal(false)}>
          {(()=>{
            const amount = window._pendingAmount || 0;
            const label  = window._pendingLabel  || "Transaction";
            return (
              <>
                <div style={{ textAlign:"center", marginBottom:16 }}>
                  <div style={{ color: amount>=0?"#00ff9d":"#ff4466", fontFamily:"'Orbitron',sans-serif", fontSize:26, fontWeight:900, textShadow:`0 0 20px ${amount>=0?"#00ff9daa":"#ff4466aa"}`, marginBottom:4 }}>
                    {amount>=0?"+":""}{fmt(amount)} aUEC
                  </div>
                  <div style={{ color:"#8899bb", fontSize:10, fontFamily:"'Rajdhani',sans-serif" }}>{label}</div>
                </div>
                <label style={S.label}>Attribuer à</label>
                <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                  <button onClick={()=>setTradeForm(p=>({...p,type:"common"}))} style={{...S.toggleBtn,flex:1,...(tradeForm.type==="common"?S.toggleActive:{})}}>🤝 Partager 50/50</button>
                  <button onClick={()=>setTradeForm(p=>({...p,type:"personal"}))} style={{...S.toggleBtn,flex:1,...(tradeForm.type==="personal"?S.toggleActive:{})}}>👤 Un joueur</button>
                </div>
                {tradeForm.type==="personal"&&(
                  <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                    {profiles.map(p=>(
                      <button key={p.id} onClick={()=>setTradeForm(prev=>({...prev,owner:p.id}))}
                        style={{...S.toggleBtn,flex:1,...(tradeForm.owner===p.id?{background:p.color+"22",borderColor:p.color+"66",color:p.color}:{})}}>
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
                <div style={{ background:"#0a1628", borderRadius:8, padding:10, marginBottom:12 }}>
                  {tradeForm.type==="common"
                    ? profiles.map(p=>(
                        <div key={p.id} style={{ color:p.color, fontFamily:"'Orbitron',sans-serif", fontSize:14, marginBottom:4 }}>
                          {p.name} : {amount>=0?"+":""}{fmt(Math.floor(amount/profiles.length))} aUEC
                        </div>
                      ))
                    : <div style={{ color:profiles.find(p=>p.id===tradeForm.owner)?.color, fontFamily:"'Orbitron',sans-serif", fontSize:16 }}>
                        {profiles.find(p=>p.id===tradeForm.owner)?.name} : {amount>=0?"+":""}{fmt(amount)} aUEC
                      </div>
                  }
                </div>
                <button onClick={()=>{
                  const amount = window._pendingAmount || 0;
                  const label  = window._pendingLabel  || "Transaction";
                  const mission = {
                    id:"m"+Date.now(), name: label,
                    amount: Math.abs(amount),
                    split: tradeForm.type==="common",
                    assignee: tradeForm.owner,
                    note: amount<0?"Perte enregistrée":"",
                    date: new Date().toLocaleDateString("fr-FR")
                  };
                  window._pendingMission = mission;
                  window._pendingMissionProfiles = profiles.map(p=>({
                    ...p,
                    aUEC: tradeForm.type==="common"
                      ? p.aUEC + Math.floor(amount/profiles.length)
                      : p.id===tradeForm.owner ? p.aUEC+amount : p.aUEC
                  }));
                  setTradeModal(false);
                  window.dispatchEvent(new CustomEvent("staryeuv_trade_validated"));
                }} style={S.primaryBtn}>🚀 Confirmer</button>
              </>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

// ─── HANGAR PAGE ──────────────────────────────────────────────────────────────
function HangarShip({ ship, color, index }) {
  const canvasRef = useRef(null);
  const [hov, setHov] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, t = 0;
    const W = canvas.width = 180, H = canvas.height = 100;

    // Génère une forme de vaisseau unique basée sur l'index
    const seed = index * 137.5;
    const r = (n) => ((Math.sin(seed + n) + 1) / 2);

    function drawShip(t) {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W/2, H/2);

      // Rotation lente
      const rot = Math.sin(t * 0.02) * 0.15;
      ctx.rotate(rot);

      // Halo glow
      const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, 60);
      halo.addColorStop(0, color + "22");
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.ellipse(0, 5, 70, 30, 0, 0, Math.PI * 2);
      ctx.fill();

      // Corps principal
      ctx.shadowColor = color;
      ctx.shadowBlur = 12 + 6 * Math.sin(t * 0.05);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.fillStyle = color + "33";

      // Forme vaisseau générique paramétrique
      const w1 = 30 + r(1) * 20, w2 = 18 + r(2) * 12;
      const h1 = 8 + r(3) * 6;
      ctx.beginPath();
      ctx.moveTo(-w1, 0);
      ctx.bezierCurveTo(-w1 * 0.5, -h1 * 1.5, w1 * 0.3, -h1, w1, 0);
      ctx.bezierCurveTo(w1 * 0.3, h1, -w1 * 0.5, h1 * 1.5, -w1, 0);
      ctx.fill(); ctx.stroke();

      // Cockpit
      ctx.fillStyle = color + "88";
      ctx.beginPath();
      ctx.ellipse(w1 * 0.25, -h1 * 0.3, w2 * 0.35, h1 * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();

      // Aile
      ctx.fillStyle = color + "22";
      ctx.strokeStyle = color + "aa";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-w1 * 0.4, -(h1 * 1.5 + r(4) * 12));
      ctx.lineTo(-w1 * 0.8, -h1 * 0.5);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-w1 * 0.4, (h1 * 1.5 + r(4) * 12));
      ctx.lineTo(-w1 * 0.8, h1 * 0.5);
      ctx.closePath();
      ctx.fill(); ctx.stroke();

      // Réacteurs
      for (let i = 0; i < 2; i++) {
        const ry = (i === 0 ? -1 : 1) * (h1 * 0.6 + r(5 + i) * 4);
        const flicker = 0.7 + 0.3 * Math.sin(t * 0.15 + i * 2);
        ctx.shadowColor = color;
        ctx.shadowBlur = 15 * flicker;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(-w1 * 0.85, ry, 4, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Jet
        const jetGrad = ctx.createLinearGradient(-w1 * 0.85, ry, -w1 * 0.85 - 20 * flicker, ry);
        jetGrad.addColorStop(0, color + "cc");
        jetGrad.addColorStop(1, "transparent");
        ctx.fillStyle = jetGrad;
        ctx.beginPath();
        ctx.ellipse(-w1 * 0.85 - 10 * flicker, ry, 10 * flicker, 1.5, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }

    function loop() { t++; drawShip(t); raf = requestAnimationFrame(loop); }
    loop();
    return () => cancelAnimationFrame(raf);
  }, [color, index]);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? "#0a1628" : "#07111fcc",
        border: `1px solid ${color}${hov ? "99" : "44"}`,
        borderRadius: 14,
        padding: "14px 16px",
        display: "flex",
        alignItems: "center",
        gap: 14,
        transition: "all .3s",
        boxShadow: hov ? `0 0 24px ${color}44` : `0 0 8px ${color}22`,
        transform: hov ? "translateY(-2px)" : "none",
        cursor: "default",
      }}
    >
      <canvas ref={canvasRef} style={{ width: 120, height: 66, flexShrink: 0 }} width={180} height={100} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ color, fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{ship.name}</div>
        <div style={{ color: "#8899bb", fontSize: 10, fontFamily: "'Rajdhani',sans-serif", letterSpacing: 1 }}>CAPACITÉ</div>
        <div style={{ color: "#e8f4ff", fontFamily: "'Orbitron',sans-serif", fontSize: 15, fontWeight: 700 }}>{ship.capacity} SCU</div>
      </div>
    </div>
  );
}

function HangarBackground({ color }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, t = 0;

    function resize() { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; }
    resize();

    function draw() {
      t++;
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Sol de hangar avec grille
      ctx.strokeStyle = color + "22";
      ctx.lineWidth = 1;
      const gridSize = 40;
      const vanishX = W / 2, vanishY = H * 0.45;

      for (let x = -W; x < W * 2; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(vanishX, vanishY);
        ctx.lineTo(x, H);
        ctx.stroke();
      }
      for (let i = 0; i < 8; i++) {
        const y = vanishY + (H - vanishY) * (i / 8);
        const spread = (y - vanishY) / (H - vanishY);
        ctx.beginPath();
        ctx.moveTo(vanishX - W * spread, y);
        ctx.lineTo(vanishX + W * spread, y);
        ctx.stroke();
      }

      // Portails latéraux
      ctx.strokeStyle = color + "44";
      ctx.lineWidth = 2;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8 + 4 * Math.sin(t * 0.03);
      for (let side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(vanishX + side * W * 0.3, vanishY);
        ctx.lineTo(vanishX + side * W * 0.5, H * 0.7);
        ctx.stroke();
      }

      // Lumières du plafond
      for (let i = 0; i < 5; i++) {
        const lx = W * 0.2 + (W * 0.6 / 4) * i;
        const flicker = 0.5 + 0.5 * Math.abs(Math.sin(t * 0.04 + i));
        ctx.shadowBlur = 20 * flicker;
        ctx.fillStyle = color + "88";
        ctx.beginPath();
        ctx.arc(lx, 8, 3, 0, Math.PI * 2);
        ctx.fill();
        // Halo lumière vers le bas
        const lg = ctx.createRadialGradient(lx, 8, 0, lx, 8, 80);
        lg.addColorStop(0, color + "22");
        lg.addColorStop(1, "transparent");
        ctx.fillStyle = lg;
        ctx.beginPath();
        ctx.ellipse(lx, 60, 50, 80, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
    />
  );
}

function HangarPage({ profile, ships, setShips, onClose }) {
  const [editShip,    setEditShip]    = useState(null);
  const [slideOut,    setSlideOut]    = useState(false);
  const touchStartX  = useRef(null);

  const shipColors = ["#00d4ff","#00ff9d","#ff6b35","#bf5fff","#ffcc00","#ff4466","#00ffcc","#ff88aa"];

  function handleClose() {
    setSlideOut(true);
    setTimeout(() => onClose(), 350);
  }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx > 80) handleClose(); // swipe droite > 80px = retour
    touchStartX.current = null;
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.95)",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
        transform: slideOut ? "translateX(100%)" : "translateX(0)",
        transition: "transform .35s cubic-bezier(.4,0,.2,1)",
        animation: slideOut ? "none" : "slideInRight .35s cubic-bezier(.4,0,.2,1)",
      }}
    >
      {/* Fond hangar animé */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0 }}>
        <HangarBackground color={profile.color} />
      </div>

      {/* Header */}
      <div style={{
        position: "sticky", top: 0, zIndex: 10,
        background: "rgba(3,7,15,0.92)", borderBottom: `1px solid ${profile.color}44`,
        backdropFilter: "blur(16px)", padding: "12px 16px",
        display: "flex", alignItems: "center", gap: 12
      }}>
        <button onClick={handleClose} style={{ ...S.closeBtn, fontSize: 22, color: profile.color }}>←</button>
        <div style={{
          width: 44, height: 44, borderRadius: "50%",
          border: `2px solid ${profile.color}`,
          background: profile.avatar ? `url(${profile.avatar}) center/cover` : `radial-gradient(circle,${profile.color}44,#0a1628)`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          boxShadow: `0 0 16px ${profile.color}66`, flexShrink: 0
        }}>
          {!profile.avatar && "👤"}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ color: profile.color, fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 900 }}>{profile.name}</div>
          <div style={{ color: "#8899bb", fontSize: 10, fontFamily: "'Rajdhani',sans-serif", letterSpacing: 2 }}>HANGAR PERSONNEL</div>
        </div>
        <button onClick={() => { const ns = { id: "s"+Date.now(), name: "Nouveau Vaisseau", capacity: 100 }; setShips(p=>[...p,ns]); setEditShip(ns); }} style={{ ...S.primaryBtn, width: "auto", marginTop: 0, padding: "8px 14px", fontSize: 11 }}>+ Ajouter</button>
      </div>

      {/* Hologramme nom */}
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "24px 16px 8px" }}>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 11, letterSpacing: 6,
          color: profile.color + "88", textTransform: "uppercase", marginBottom: 4
        }}>HANGAR · {ships.length} VAISSEAU{ships.length > 1 ? "X" : ""}</div>
        <div style={{
          fontFamily: "'Orbitron',sans-serif", fontSize: 22, fontWeight: 900,
          color: profile.color, letterSpacing: 4,
          textShadow: `0 0 20px ${profile.color}88, 0 0 40px ${profile.color}44`,
          animation: "glow 3s ease-in-out infinite"
        }}>{profile.name.toUpperCase()}</div>
        <div style={{
          width: 80, height: 1, background: `linear-gradient(90deg,transparent,${profile.color},transparent)`,
          margin: "8px auto"
        }}/>
      </div>

      {/* Liste vaisseaux */}
      <div style={{ position: "relative", zIndex: 1, padding: "8px 16px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
        {ships.length === 0 && (
          <div style={{ color: "#8899bb", textAlign: "center", padding: 40, fontFamily: "'Rajdhani',sans-serif" }}>
            Aucun vaisseau — Ajoute ta flotte !
          </div>
        )}
        {ships.map((ship, i) => (
          <div key={ship.id} style={{ position: "relative" }}>
            <HangarShip ship={ship} color={shipColors[i % shipColors.length]} index={i} />
            <button
              onClick={() => setEditShip({ ...ship })}
              style={{
                position: "absolute", top: 10, right: 10,
                background: "transparent", border: `1px solid ${shipColors[i % shipColors.length]}66`,
                color: shipColors[i % shipColors.length], borderRadius: 6,
                padding: "3px 8px", cursor: "pointer", fontSize: 11
              }}
            >✏️</button>
          </div>
        ))}
      </div>

      {/* Modal édition vaisseau */}
      {editShip && (
        <Modal title="Modifier le vaisseau" onClose={() => setEditShip(null)}>
          <label style={S.label}>Nom du vaisseau</label>
          <input value={editShip.name} onChange={e => setEditShip(p => ({ ...p, name: e.target.value }))} style={S.input} placeholder="Ex: Prospector, Mole, Caterpillar..." />
          <label style={S.label}>Capacité de cargo (SCU)</label>
          <input type="number" value={editShip.capacity} onChange={e => setEditShip(p => ({ ...p, capacity: +e.target.value }))} style={S.input} />
          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => { setShips(prev => prev.map(x => x.id === editShip.id ? editShip : x)); setEditShip(null); }} style={{ ...S.primaryBtn, flex: 2 }}>💾 Sauvegarder</button>
            <button onClick={() => { if (window.confirm("Supprimer ce vaisseau ?")) { setShips(prev => prev.filter(x => x.id !== editShip.id)); setEditShip(null); } }} style={{ ...S.dangerBtn, flex: 1, padding: "10px 8px" }}>🗑 Suppr.</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── SHIPS TAB ────────────────────────────────────────────────────────────────
// Catalogue de vaisseaux RSI classés par taille avec prix USD + aUEC estimé
// Taille pad RSI → catégorie : XS/S = small, M = medium, L = large, XL/capital = capital
// ─── CONCESSION TAB ───────────────────────────────────────────────────────────
function ConcessionShip3D({ color, index }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let raf, t = 0;
    const W = canvas.width = 260, H = canvas.height = 140;
    const seed = index * 137.5 + 42;
    const r = n => (Math.sin(seed + n) + 1) / 2;

    function draw() {
      t++;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2);
      const rot = Math.sin(t * 0.018) * 0.18;
      ctx.rotate(rot);

      // Halo
      const halo = ctx.createRadialGradient(0, 0, 10, 0, 0, 80);
      halo.addColorStop(0, color + "33"); halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.ellipse(0, 8, 90, 36, 0, 0, Math.PI * 2); ctx.fill();

      ctx.shadowColor = color; ctx.shadowBlur = 14 + 6 * Math.sin(t * 0.04);
      ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.fillStyle = color + "44";

      const w1 = 38 + r(1) * 22, h1 = 10 + r(3) * 7;
      // Corps
      ctx.beginPath();
      ctx.moveTo(-w1, 0);
      ctx.bezierCurveTo(-w1 * 0.4, -h1 * 1.8, w1 * 0.35, -h1, w1, 0);
      ctx.bezierCurveTo(w1 * 0.35, h1, -w1 * 0.4, h1 * 1.8, -w1, 0);
      ctx.fill(); ctx.stroke();

      // Cockpit
      ctx.fillStyle = color + "99";
      ctx.beginPath();
      ctx.ellipse(w1 * 0.22, -h1 * 0.35, w1 * 0.28, h1 * 0.52, 0, 0, Math.PI * 2);
      ctx.fill();

      // Ailes
      ctx.fillStyle = color + "28"; ctx.strokeStyle = color + "bb"; ctx.lineWidth = 1.2;
      [[-1], [1]].forEach(([s]) => {
        ctx.beginPath();
        ctx.moveTo(-w1 * 0.1, 0);
        ctx.lineTo(-w1 * 0.45, s * (h1 * 1.8 + r(5) * 14));
        ctx.lineTo(-w1 * 0.75, s * h1 * 0.6);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      });

      // Réacteurs
      [-1, 1].forEach((s, i) => {
        const ry = s * (h1 * 0.55 + r(6 + i) * 4);
        const fl = 0.7 + 0.3 * Math.sin(t * 0.18 + i * 2);
        ctx.shadowColor = color; ctx.shadowBlur = 18 * fl;
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(-w1 * 0.87, ry, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
        // Jet
        const jg = ctx.createLinearGradient(-w1 * 0.87, ry, -w1 * 0.87 - 22 * fl, ry);
        jg.addColorStop(0, color + "dd"); jg.addColorStop(1, "transparent");
        ctx.fillStyle = jg;
        ctx.beginPath(); ctx.ellipse(-w1 * 0.87 - 11 * fl, ry, 11 * fl, 2, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
      raf = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(raf);
  }, [color, index]);
  return <canvas ref={canvasRef} style={{ width: 160, height: 88, flexShrink: 0 }} width={260} height={140} />;
}

function ConcessionTab({ profiles, fleets, setFleets }) {
  const [modal, setModal] = useState(false);
  const [form,  setForm]  = useState({ name:"", maker:"", price:"", capacity:"", owner:"p1" });
  const SHIP_COLORS = ["#00d4ff","#00ff9d","#ff6b35","#bf5fff","#ffcc00","#ff4466","#00ffcc","#ff88aa"];

  // Tous les vaisseaux de tous les joueurs avec leur propriétaire
  const allEntries = profiles.flatMap(p =>
    (fleets[p.id] || []).map((s, i) => ({ ship: s, profile: p, colorIdx: i }))
  );

  function addShip() {
    if (!form.name || !form.owner) return;
    const ns = { id: "s" + Date.now(), name: form.name, maker: form.maker, capacity: +form.capacity || 0, price: +form.price || 0 };
    setFleets(prev => ({ ...prev, [form.owner]: [...(prev[form.owner] || []), ns] }));
    setModal(false);
    setForm({ name:"", maker:"", price:"", capacity:"", owner:"p1" });
  }

  function removeShip(pid, sid) {
    if (!window.confirm("Supprimer ce vaisseau ?")) return;
    setFleets(prev => ({ ...prev, [pid]: (prev[pid] || []).filter(s => s.id !== sid) }));
  }

  return (
    <div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
        <div style={S.sectionTitle}>🚀 CONCESSION</div>
        <button onClick={()=>setModal(true)} style={{ ...S.primaryBtn, width:"auto", marginTop:0 }}>+ Acquérir</button>
      </div>
      <p style={{ color:"#8899bb", fontSize:11, fontFamily:"'Rajdhani',sans-serif", marginBottom:16 }}>
        Enregistre un achat de vaisseau — il sera automatiquement ajouté au hangar du membre concerné.
      </p>

      {allEntries.length === 0 && (
        <div style={{ color:"#8899bb", textAlign:"center", padding:40, fontFamily:"'Rajdhani',sans-serif" }}>
          Aucun vaisseau enregistré — Ajoute ta flotte !
        </div>
      )}

      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {allEntries.map(({ ship, profile, colorIdx }, i) => {
          const color = SHIP_COLORS[colorIdx % SHIP_COLORS.length];
          return (
            <div key={ship.id} style={{
              background:"#07111fcc", border:`1px solid ${color}44`,
              borderRadius:14, padding:"14px 16px", backdropFilter:"blur(10px)",
              display:"flex", alignItems:"center", gap:14,
              boxShadow:`0 0 16px ${color}22`,
            }}>
              <ConcessionShip3D color={color} index={i} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ color, fontFamily:"'Orbitron',sans-serif", fontSize:14, fontWeight:700, marginBottom:4 }}>{ship.name}</div>
                {ship.maker && <div style={{ color:"#8899bb", fontSize:11, fontFamily:"'Rajdhani',sans-serif", marginBottom:6 }}>{ship.maker}</div>}
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  <div style={{ background:"#0a1628", borderRadius:6, padding:"4px 10px", border:`1px solid ${profile.color}33` }}>
                    <div style={{ color:"#8899bb", fontSize:9, letterSpacing:1 }}>PILOTE</div>
                    <div style={{ color:profile.color, fontFamily:"'Rajdhani',sans-serif", fontSize:12, fontWeight:600 }}>{profile.name}</div>
                  </div>
                  {ship.capacity > 0 && (
                    <div style={{ background:"#0a1628", borderRadius:6, padding:"4px 10px", border:"1px solid #00d4ff22" }}>
                      <div style={{ color:"#8899bb", fontSize:9, letterSpacing:1 }}>CARGO</div>
                      <div style={{ color:"#00d4ff", fontFamily:"'Orbitron',sans-serif", fontSize:12, fontWeight:700 }}>{ship.capacity} SCU</div>
                    </div>
                  )}
                  {ship.price > 0 && (
                    <div style={{ background:"#0a1628", borderRadius:6, padding:"4px 10px", border:"1px solid #ffcc0022" }}>
                      <div style={{ color:"#8899bb", fontSize:9, letterSpacing:1 }}>PRIX</div>
                      <div style={{ color:"#ffcc00", fontFamily:"'Orbitron',sans-serif", fontSize:12, fontWeight:700 }}>{fmt(ship.price)} aUEC</div>
                    </div>
                  )}
                </div>
              </div>
              <button onClick={()=>removeShip(profile.id, ship.id)} style={{ ...S.dangerBtn, flexShrink:0, fontSize:16, padding:"6px 10px" }}>🗑</button>
            </div>
          );
        })}
      </div>

      {modal && (
        <Modal title="🚀 Nouveau vaisseau" onClose={()=>setModal(false)}>
          <label style={S.label}>Modèle du vaisseau</label>
          <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} style={S.input} placeholder="Ex: Cutlass Black, Mole..."/>
          <label style={S.label}>Fabricant</label>
          <input value={form.maker} onChange={e=>setForm(p=>({...p,maker:e.target.value}))} style={S.input} placeholder="Ex: Drake, MISC, RSI..."/>
          <label style={S.label}>Prix d'achat (aUEC)</label>
          <input type="number" value={form.price} onChange={e=>setForm(p=>({...p,price:e.target.value}))} style={S.input} placeholder="Ex: 3000000"/>
          <label style={S.label}>Capacité cargo (SCU)</label>
          <input type="number" value={form.capacity} onChange={e=>setForm(p=>({...p,capacity:e.target.value}))} style={S.input} placeholder="Ex: 46"/>
          <label style={S.label}>Attribuer à</label>
          <div style={{ display:"flex", gap:8 }}>
            {profiles.map(p=>(
              <button key={p.id} onClick={()=>setForm(prev=>({...prev,owner:p.id}))}
                style={{...S.toggleBtn,flex:1,...(form.owner===p.id?{background:p.color+"22",borderColor:p.color+"66",color:p.color}:{})}}>
                {p.name}
              </button>
            ))}
          </div>
          <button onClick={addShip} style={S.primaryBtn}>🚀 Confirmer l'acquisition</button>
        </Modal>
      )}
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
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 900);
  useEffect(() => {
    const fn = () => setIsDesktop(window.innerWidth >= 900);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);

  // Chaque état est synchronisé avec sa propre collection Firestore
  const [profiles,  setProfiles,  profLoaded,  saveProfiles  ] = useFirestore("profiles",   DEFAULT_PROFILES);
  const [missions,  setMissions,  missLoaded,  saveMissions  ] = useFirestore("missions",   DEFAULT_MISSIONS);
  const [objectives,setObjectives,objLoaded,   saveObjectives] = useFirestore("objectives", DEFAULT_OBJECTIVES);
  const [fleets,    setFleets,    fleetLoaded, saveFleets    ] = useFirestore("fleets",     DEFAULT_FLEETS);
  const [settings,  setSettings,  settLoaded,  saveSettings  ] = useFirestore("settings",   DEFAULT_SETTINGS);

  const loaded = profLoaded && missLoaded && objLoaded && fleetLoaded && settLoaded;

  // Écoute validation trade depuis CalcTab
  useEffect(() => {
    function onTradeValidated() {
      if (window._pendingMission) {
        setMissions(prev => [window._pendingMission, ...prev]);
        window._pendingMission = null;
      }
      if (window._pendingMissionProfiles) {
        setProfiles(window._pendingMissionProfiles);
        window._pendingMissionProfiles = null;
      }
    }
    window.addEventListener("staryeuv_trade_validated", onTradeValidated);
    return () => window.removeEventListener("staryeuv_trade_validated", onTradeValidated);
  }, []); // eslint-disable-line

  // Sync vers Firebase à chaque changement (avec debounce 600ms)
  const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t=setTimeout(()=>fn(...a), ms); }; };
  const dSaveProfiles   = useCallback(debounce(saveProfiles,   600), [saveProfiles]);   // eslint-disable-line
  const dSaveMissions   = useCallback(debounce(saveMissions,   600), [saveMissions]);   // eslint-disable-line
  const dSaveObjectives = useCallback(debounce(saveObjectives, 600), [saveObjectives]); // eslint-disable-line
  const dSaveFleets     = useCallback(debounce(saveFleets,     600), [saveFleets]);     // eslint-disable-line
  const dSaveSettings   = useCallback(debounce(saveSettings,   600), [saveSettings]);   // eslint-disable-line

  useEffect(() => { if (loaded) dSaveProfiles(profiles);     }, [profiles,   loaded]); // eslint-disable-line
  useEffect(() => { if (loaded) dSaveMissions(missions);     }, [missions,   loaded]); // eslint-disable-line
  useEffect(() => { if (loaded) dSaveObjectives(objectives); }, [objectives, loaded]); // eslint-disable-line
  useEffect(() => { if (loaded) dSaveFleets(fleets);         }, [fleets,     loaded]); // eslint-disable-line
  useEffect(() => { if (loaded) dSaveSettings(settings);     }, [settings,   loaded]); // eslint-disable-line

  // Modals
  const [editProfile,    setEditProfile]    = useState(null);
  const [hangarProfile,  setHangarProfile]  = useState(null);
  const [missionsModal,  setMissionsModal]  = useState(false);
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

  const TABS=[
    {id:"dashboard",   icon:"🏠", label:"HOME"},
    {id:"concession",  icon:"🚀", label:"CONCESSION"},
    {id:"objectives",  icon:"🎯", label:"OBJECTIFS"},
    {id:"calc",        icon:"⛏", label:"CALCUL"},
    {id:"settings",    icon:"⚙️", label:"RÉGLAGES"},
  ];

  // Swipe gauche/droite pour changer d'onglet
  const swipeStartX = useRef(null);
  function onSwipeStart(e) { swipeStartX.current = e.touches?.[0]?.clientX ?? null; }
  function onSwipeEnd(e) {
    if (swipeStartX.current === null) return;
    const dx = (e.changedTouches?.[0]?.clientX ?? swipeStartX.current) - swipeStartX.current;
    if (Math.abs(dx) < 60) return;
    const idx = TABS.findIndex(t => t.id === tab);
    if (dx < 0 && idx < TABS.length - 1) setTab(TABS[idx + 1].id);
    if (dx > 0 && idx > 0)               setTab(TABS[idx - 1].id);
    swipeStartX.current = null;
  }

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
    <div style={{background:"#020510",minHeight:"100vh",color:"#e8f4ff",fontFamily:"'Rajdhani',sans-serif",position:"relative"}}>
      {/* Overlay sombre pour lisibilité — entre canvas et contenu */}
      <div style={{ position:"fixed", inset:0, zIndex:1, pointerEvents:"none", background:"rgba(2,5,16,0.55)" }} />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:6px;background:#07111f;}
        ::-webkit-scrollbar-thumb{background:#00d4ff44;border-radius:4px;}
        input,select,textarea{font-family:'Rajdhani',sans-serif;}
        @keyframes pulse{0%,100%{box-shadow:0 0 12px #00d4ff33}50%{box-shadow:0 0 28px #00d4ff88}}
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes glow{0%,100%{text-shadow:0 0 8px #00d4ff66}50%{text-shadow:0 0 20px #00d4ffcc}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes slideInRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
        html,body{overflow-x:hidden;max-width:100vw;}

        /* NAV TABS — mobile */
        .nav-tab{
          flex:1 0 60px; padding:14px 6px;
          background:transparent; border:none;
          border-bottom:3px solid transparent;
          color:#8899bb; cursor:pointer;
          display:flex; flex-direction:column; align-items:center; gap:4px;
          font-family:'Rajdhani',sans-serif; font-weight:700;
          transition:all .2s;
        }
        .nav-tab .icon{font-size:24px;}
        .nav-tab .label{font-size:11px;letter-spacing:1px;}
        .nav-tab.active{
          background:linear-gradient(135deg,#00d4ff22,#0a1628);
          border-bottom:3px solid #00d4ff; color:#00d4ff;
        }
        .nav-tab:hover{color:#00d4ffcc;}

        /* SIDEBAR — desktop only */
        .sidebar{display:none;}
        .desktop-shift{margin-left:0;}

        @media(min-width:900px){
          .sidebar{
            display:flex; flex-direction:column;
            position:fixed; left:0; top:0; bottom:0; width:260px;
            background:rgba(2,5,16,0.97); border-right:1px solid #00d4ff33;
            backdropFilter:blur(20px); padding-top:110px; z-index:98;
          }
          .sidebar .nav-tab{
            flex:none; width:100%;
            flex-direction:row; justify-content:flex-start;
            gap:18px; padding:20px 32px;
            border-bottom:none; border-left:4px solid transparent;
            font-size:16px; letter-spacing:1.5px;
          }
          .sidebar .nav-tab .icon{font-size:28px;}
          .sidebar .nav-tab .label{font-size:15px;letter-spacing:2px;font-weight:700;}
          .sidebar .nav-tab.active{
            border-left:4px solid #00d4ff; border-bottom:none;
            background:linear-gradient(90deg,#00d4ff22,transparent);
            color:#00d4ff;
          }
          .top-nav{display:none!important;}
          .desktop-shift{margin-left:260px;}
          .desktop-main-content{max-width:100%!important; padding:40px 56px 100px!important;}
          .desktop-header-inner{padding:20px 40px!important;}
          .desktop-header-title{font-size:32px!important; letter-spacing:4px!important;}
          .desktop-header-sub{font-size:13px!important; letter-spacing:4px!important;}
          .desktop-fortune{font-size:20px!important;}
        }

        /* PROFILES GRID */
        .profiles-grid{display:grid;grid-template-columns:1fr;gap:12px;margin-bottom:20px;}
        @media(min-width:520px){.profiles-grid{grid-template-columns:1fr 1fr;}}
        @media(min-width:900px){.profiles-grid{grid-template-columns:1fr 1fr;}}
      `}</style>
      <CosmicBackground/>

      {/* Sidebar desktop uniquement (cachée sur mobile via CSS) */}
      <div className="sidebar">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} className={`nav-tab${tab===t.id?" active":""}`}>
            <span className="icon">{t.icon}</span>
            <span className="label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Wrapper décalé sur desktop */}
      <div className="desktop-shift">

        {/* Header */}
        <div style={S.header}>
          <div style={{...S.headerInner, padding: isDesktop ? "20px 48px" : "12px 20px"}} className="desktop-header-inner">
            <div style={{display:"flex",alignItems:"center",gap:isDesktop?18:12}}>
              {settings.appIcon?<img src={settings.appIcon} alt="logo" style={{height:isDesktop?52:42,width:isDesktop?52:42,objectFit:"contain"}}/>:<div style={{fontSize:isDesktop?42:34,filter:"drop-shadow(0 0 8px #00d4ff)"}}>⭐</div>}
              <div>
                <div className="desktop-header-title" style={{fontFamily:"'Orbitron',sans-serif",fontSize:isDesktop?30:22,fontWeight:900,color:"#00d4ff",animation:"glow 3s ease-in-out infinite",letterSpacing:isDesktop?4:3}}>STAR YeUv</div>
                <div className="desktop-header-sub" style={{color:"#8899bb",fontSize:isDesktop?13:11,letterSpacing:isDesktop?4:3,fontFamily:"'Rajdhani',sans-serif"}}>COMPANION APP</div>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
              <SyncBadge synced={loaded}/>
              <div className="desktop-fortune" style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:isDesktop?20:15,textAlign:"right"}}>
                <div style={{fontSize:isDesktop?11:10,color:"#8899bb",letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>FORTUNE TOTALE</div>
                {fmt((p1?.aUEC||0)+(p2?.aUEC||0))} aUEC
              </div>
            </div>
          </div>
        </div>

        {/* Nav mobile (cachée sur desktop) */}
        <div style={S.nav} className="top-nav">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} className={`nav-tab${tab===t.id?" active":""}`}>
              <span className="icon">{t.icon}</span>
              <span className="label">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Contenu avec swipe */}
        <div style={{...S.content, padding: isDesktop ? "40px 56px 100px" : "24px 20px 100px"}} className="desktop-main-content" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>

        {/* DASHBOARD */}
        {tab==="dashboard"&&(
          <div style={{animation:"fadeIn .4s ease"}}>
            <div className="profiles-grid">
              {profiles.map(p=>(
                <ProfileCard
                  key={p.id}
                  profile={p}
                  onEdit={()=>setEditProfile({...p})}
                  onHangar={()=>setHangarProfile(p)}
                  isDesktop={isDesktop}
                />
              ))}
            </div>
            <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(${isDesktop?160:110}px,1fr))`,gap:isDesktop?14:10,marginBottom:20}}>
              <HexTile icon="💰" label="Total Gagné" value={fmt(totalEarned)} sub="aUEC" color="#ffcc00" isDesktop={isDesktop}/>
              <HexTile icon="📋" label="Missions" value={missions.length} sub="complétées" color="#00d4ff" onClick={()=>setMissionsModal(true)} isDesktop={isDesktop}/>
              <HexTile icon="🤝" label="Partagées" value={missions.filter(m=>m.split).length} sub="co-op" color="#00ff9d" isDesktop={isDesktop}/>
              <HexTile icon="🎯" label="Objectifs" value={objectives.common.length+Object.values(objectives.personal).flat().length} sub="en cours" color="#ff6b35" onClick={()=>setTab("objectives")} isDesktop={isDesktop}/>
              {profiles.map(p=>(
                <HexTile key={p.id} icon="🚀" label={p.name} value={(fleets[p.id]||[]).length} sub="vaisseau(x)" color={p.color} onClick={()=>setHangarProfile(p)} isDesktop={isDesktop}/>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
              <button onClick={()=>setAddMissionModal(true)} style={{...S.primaryBtn,width:"auto",fontSize:isDesktop?16:14,padding:isDesktop?"14px 48px":"12px 32px",letterSpacing:2}}>➕ NOUVELLE MISSION</button>
            </div>
            <div style={{...S.sectionTitle,fontSize:isDesktop?15:13}}>📋 MISSIONS RÉCENTES</div>
            {missions.slice(0,5).map(m=><MissionItem key={m.id} mission={m} profiles={profiles} onDelete={deleteMission} isDesktop={isDesktop}/>)}
            {missions.length===0&&<div style={{color:"#8899bb",textAlign:"center",padding:30,fontFamily:"'Rajdhani',sans-serif",fontSize:isDesktop?15:13}}>Aucune mission — commencez à jouer !</div>}
            {missions.length>5&&<button onClick={()=>setMissionsModal(true)} style={{...S.ghostBtn,width:"100%",marginTop:8}}>Voir toutes les missions ({missions.length}) →</button>}
          </div>
        )}

        {tab==="concession"&&<div style={{animation:"fadeIn .4s ease"}}><ConcessionTab profiles={profiles} fleets={fleets} setFleets={setFleets}/></div>}

        {tab==="objectives"&&<div style={{animation:"fadeIn .4s ease"}}><ObjectivesTab objectives={objectives} setObjectives={setObjectives} profiles={profiles} setProfiles={setProfiles}/></div>}
        {tab==="calc"&&<div style={{animation:"fadeIn .4s ease"}}><CalcTab fleets={fleets} profiles={profiles}/></div>}
        {tab==="settings"&&<div style={{animation:"fadeIn .4s ease"}}><SettingsTab settings={settings} setSettings={setSettings} profiles={profiles} setProfiles={setProfiles}/></div>}
      </div>{/* /content */}
      </div>{/* /desktop-shift */}

      {/* Modal Missions (depuis Home) */}
      {missionsModal&&(
        <Modal title="📋 TOUTES LES MISSIONS" onClose={()=>setMissionsModal(false)}>
          <button onClick={()=>setAddMissionModal(true)} style={{...S.primaryBtn,marginBottom:12}}>+ Nouvelle mission</button>
          {missions.length===0&&<div style={{color:"#8899bb",textAlign:"center",padding:20,fontFamily:"'Rajdhani',sans-serif"}}>Aucune mission enregistrée</div>}
          <div style={{maxHeight:"60vh",overflowY:"auto"}}>
            {missions.map(m=><MissionItem key={m.id} mission={m} profiles={profiles} onDelete={deleteMission}/>)}
          </div>
        </Modal>
      )}

      {/* HANGAR OVERLAY */}
      {hangarProfile && (
        <HangarPage
          profile={hangarProfile}
          ships={fleets[hangarProfile.id] || []}
          setShips={(updater) => setFleets(prev => ({
            ...prev,
            [hangarProfile.id]: typeof updater === "function" ? updater(prev[hangarProfile.id] || []) : updater
          }))}
          onClose={()=>setHangarProfile(null)}
        />
      )}

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
  header:{position:"sticky",top:0,zIndex:100,background:"rgba(2,5,16,0.92)",borderBottom:"1px solid #00d4ff22",backdropFilter:"blur(16px)"},
  headerInner:{maxWidth:"100%",margin:"0 auto",padding:"12px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",gap:8},
  nav:{display:"flex",overflowX:"auto",background:"rgba(2,5,16,0.92)",borderBottom:"1px solid #1a2a4455",position:"sticky",top:68,zIndex:99,backdropFilter:"blur(12px)"},
  content:{maxWidth:"100%",margin:"0 auto",padding:"24px 20px 100px",overflowX:"hidden",boxSizing:"border-box",position:"relative",zIndex:2},
  profileCard:{background:"#07111fcc",border:"1px solid",borderRadius:14,padding:14,transition:"all .3s",backdropFilter:"blur(12px)",minWidth:0,overflow:"hidden"},
  statRow:{display:"flex",gap:6,flexWrap:"wrap"},
  statItem:{flex:1,minWidth:0,background:"#0a1628",borderRadius:8,padding:"5px 7px",overflow:"hidden"},
  statLabel:{color:"#8899bb",fontSize:10,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"},
  hexTile:{background:"#07111fcc",border:"1px solid",borderRadius:12,padding:"14px 10px",textAlign:"center",transition:"all .25s",backdropFilter:"blur(8px)"},
  missionItem:{background:"#07111fcc",border:"1px solid #1a2a4488",borderRadius:10,padding:14,marginBottom:8,cursor:"pointer",backdropFilter:"blur(8px)"},
  calcBox:{background:"#07111fcc",border:"1px solid #1a2a4488",borderRadius:12,padding:18,backdropFilter:"blur(8px)"},
  objectiveCard:{background:"#07111fcc",border:"1px solid",borderRadius:12,padding:14,backdropFilter:"blur(8px)"},
  progressBar:{background:"#1a2a44",borderRadius:4,height:6,overflow:"hidden"},
  progressFill:{height:"100%",borderRadius:4,transition:"width .4s ease"},
  resultBox:{background:"#0a1628",border:"1px solid #00d4ff44",borderRadius:10,padding:"10px 14px"},
  shipChip:{background:"#0a1628",border:"1px solid #1a2a4488",borderRadius:20,padding:"5px 12px",fontSize:12,color:"#8899bb",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",transition:"all .2s"},
  sectionTitle:{fontFamily:"'Orbitron',sans-serif",fontSize:13,fontWeight:700,color:"#00d4ff",letterSpacing:3,marginBottom:14,textTransform:"uppercase"},
  label:{display:"block",color:"#8899bb",fontSize:12,letterSpacing:1.5,marginBottom:4,marginTop:10,fontFamily:"'Rajdhani',sans-serif",textTransform:"uppercase"},
  input:{width:"100%",background:"#0a1628",border:"1px solid #1a2a44",borderRadius:8,padding:"10px 14px",color:"#e8f4ff",fontSize:15,outline:"none",marginBottom:4},
  primaryBtn:{background:"linear-gradient(135deg,#00d4ff22,#0a1628)",border:"1px solid #00d4ff66",color:"#00d4ff",borderRadius:8,padding:"11px 20px",cursor:"pointer",fontFamily:"'Orbitron',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1,transition:"all .2s",marginTop:10,width:"100%"},
  dangerBtn:{background:"transparent",border:"1px solid #ff446644",color:"#ff4466",borderRadius:6,padding:"6px 12px",cursor:"pointer",fontSize:12,fontFamily:"'Rajdhani',sans-serif"},
  ghostBtn:{background:"transparent",border:"1px solid #1a2a44",color:"#8899bb",borderRadius:8,padding:"9px 18px",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",fontSize:13},
  editBtn:{background:"transparent",border:"1px solid",borderRadius:6,padding:"5px 9px",cursor:"pointer",fontSize:13},
  closeBtn:{background:"transparent",border:"none",color:"#8899bb",cursor:"pointer",fontSize:20,padding:4},
  toggleBtn:{flex:1,background:"#0a1628",border:"1px solid #1a2a44",color:"#8899bb",borderRadius:8,padding:"9px 12px",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",fontSize:14,fontWeight:600},
  toggleActive:{background:"#00d4ff22",borderColor:"#00d4ff66",color:"#00d4ff"},
  badgeCommon:{background:"#ffcc0022",border:"1px solid #ffcc0055",color:"#ffcc00",borderRadius:10,padding:"2px 9px",fontSize:10,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"},
  badgePersonal:{background:"transparent",border:"1px solid",borderRadius:10,padding:"2px 9px",fontSize:10,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"},
  modalOverlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.82)",zIndex:999,display:"flex",alignItems:"flex-end",justifyContent:"center",backdropFilter:"blur(4px)"},
  modalBox:{background:"#07111f",border:"1px solid #00d4ff44",borderRadius:"16px 16px 0 0",width:"100%",maxWidth:520,maxHeight:"90vh",overflow:"hidden",display:"flex",flexDirection:"column"},
  modalHeader:{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"18px 22px",borderBottom:"1px solid #1a2a44"},
  modalTitle:{fontFamily:"'Orbitron',sans-serif",fontSize:15,color:"#00d4ff",fontWeight:700},
  modalBody:{padding:"18px 22px",overflowY:"auto",flex:1},
};
