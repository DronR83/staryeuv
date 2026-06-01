import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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
const fmt = n => Math.round(n??0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");

// ─── MODAL ────────────────────────────────────────────────────────────────────
// ─── SHIP PICKER 3D ──────────────────────────────────────────────────────────
function ShipPicker3D({ value, onChange, hangarShips, color }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);
  const [manual, setManual] = useState(false);
  const [manualVal, setManualVal] = useState("");

  // Index pseudo-aléatoire basé sur le nom du vaisseau pour la forme 3D
  const shipIndex = useMemo(() => {
    if (!value) return 0;
    return value.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 12;
  }, [value]);

  // Animation canvas vaisseau 3D (même logique que HangarShip)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    cancelAnimationFrame(rafRef.current);
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = 280, H = 120;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    let t = 0;
    const seed = shipIndex * 137.5;
    const r = n => ((Math.sin(seed + n) + 1) / 2);
    const col = color || "#00d4ff";

    function draw() {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(W / 2, H / 2);

      // Rotation douce
      const rot = Math.sin(t * 0.018) * 0.12;
      ctx.rotate(rot);

      // Halo glow
      const halo = ctx.createRadialGradient(0, 0, 8, 0, 0, 80);
      halo.addColorStop(0, col + "28"); halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.ellipse(0, 6, 90, 36, 0, 0, Math.PI * 2); ctx.fill();

      // Ombre portée sol
      const shadow = ctx.createRadialGradient(0, 32, 2, 0, 32, 55);
      shadow.addColorStop(0, col + "22"); shadow.addColorStop(1, "transparent");
      ctx.fillStyle = shadow;
      ctx.beginPath(); ctx.ellipse(0, 32, 55, 10, 0, 0, Math.PI * 2); ctx.fill();

      // Corps principal
      const w1 = 44 + r(1) * 26, h1 = 10 + r(3) * 8;
      ctx.shadowColor = col; ctx.shadowBlur = 14 + 6 * Math.sin(t * 0.05);
      ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.fillStyle = col + "2a";
      ctx.beginPath();
      ctx.moveTo(-w1, 0);
      ctx.bezierCurveTo(-w1 * 0.5, -h1 * 1.6, w1 * 0.3, -h1, w1, 0);
      ctx.bezierCurveTo(w1 * 0.3, h1, -w1 * 0.5, h1 * 1.6, -w1, 0);
      ctx.fill(); ctx.stroke();

      // Ligne centrale détail
      ctx.shadowBlur = 4;
      ctx.strokeStyle = col + "66"; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.moveTo(-w1 * 0.7, 0); ctx.lineTo(w1 * 0.8, 0); ctx.stroke();

      // Cockpit
      ctx.shadowBlur = 10; ctx.fillStyle = col + "99";
      ctx.beginPath();
      ctx.ellipse(w1 * 0.22, -h1 * 0.28, w1 * 0.18 * (0.6 + r(6) * 0.4), h1 * 0.55, -0.2, 0, Math.PI * 2);
      ctx.fill();
      // Reflet cockpit
      ctx.fillStyle = "rgba(255,255,255,0.18)";
      ctx.beginPath();
      ctx.ellipse(w1 * 0.22 + 3, -h1 * 0.38, w1 * 0.06, h1 * 0.2, -0.4, 0, Math.PI * 2);
      ctx.fill();

      // Ailes
      ctx.shadowBlur = 6;
      const wingLen = h1 * 1.4 + r(4) * 14;
      [[1, -1], [1, 1]].forEach(([xs, ys]) => {
        ctx.fillStyle = col + "1e"; ctx.strokeStyle = col + "aa"; ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-w1 * 0.38, ys * (h1 + wingLen));
        ctx.lineTo(-w1 * 0.78, ys * h1 * 0.55);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Détail aile
        ctx.strokeStyle = col + "44"; ctx.lineWidth = 0.6;
        ctx.beginPath();
        ctx.moveTo(-w1 * 0.2, ys * h1 * 0.4);
        ctx.lineTo(-w1 * 0.5, ys * (h1 + wingLen * 0.6));
        ctx.stroke();
      });

      // Nacelle centrale dessous
      ctx.shadowBlur = 8; ctx.fillStyle = col + "33"; ctx.strokeStyle = col + "77"; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(-w1 * 0.15, h1 * 0.55 + r(7) * 3, w1 * 0.22, h1 * 0.28, 0, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();

      // Réacteurs
      for (let i = 0; i < 2; i++) {
        const ry = (i === 0 ? -1 : 1) * (h1 * 0.6 + r(5 + i) * 5);
        const flicker = 0.65 + 0.35 * Math.sin(t * 0.14 + i * 2.1);
        ctx.shadowColor = col; ctx.shadowBlur = 18 * flicker;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.ellipse(-w1 * 0.88, ry, 5, 3, 0, 0, Math.PI * 2); ctx.fill();
        const jet = ctx.createLinearGradient(-w1 * 0.88, ry, -w1 * 0.88 - 28 * flicker, ry);
        jet.addColorStop(0, col + "dd"); jet.addColorStop(0.5, col + "66"); jet.addColorStop(1, "transparent");
        ctx.fillStyle = jet;
        ctx.beginPath(); ctx.ellipse(-w1 * 0.88 - 14 * flicker, ry, 14 * flicker, 2.5, 0, 0, Math.PI * 2); ctx.fill();
      }

      // Nom du vaisseau
      ctx.restore();
      ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.fillStyle = col + "cc";
      ctx.font = `600 11px 'Rajdhani',sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "bottom";
      ctx.fillText(value || "— Aucun —", W / 2, H - 4);
      ctx.shadowBlur = 0;
      rafRef.current = requestAnimationFrame(draw);
      t++;
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shipIndex, color, value]);

  return (
    <div>
      {/* Canvas 3D */}
      <div style={{background:"#030b1a",border:`1px solid ${color||"#00d4ff"}33`,borderRadius:12,overflow:"hidden",marginBottom:10,position:"relative"}}>
        <canvas ref={canvasRef} style={{width:"100%",height:90,display:"block"}} width={560} height={240}/>
      </div>

      {/* Chips du hangar */}
      {hangarShips && hangarShips.length > 0 && (
        <>
          <div style={{color:"#8899bb",fontSize:10,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",textTransform:"uppercase",marginBottom:6}}>Sélectionner depuis le hangar</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>
            {hangarShips.map((s,i) => (
              <button key={s.id||i} onClick={()=>{onChange(s.name);setManual(false);}}
                style={{background:value===s.name?`${color||"#00d4ff"}22`:"#0a1628",border:`1px solid ${value===s.name?color||"#00d4ff":"#1a2a44"}`,borderRadius:20,padding:"5px 12px",color:value===s.name?color||"#00d4ff":"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:12,cursor:"pointer",transition:"all .2s",fontWeight:value===s.name?700:400}}>
                🚀 {s.name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Toggle manuel */}
      <button onClick={()=>setManual(m=>!m)} style={{background:"transparent",border:"none",color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:11,cursor:"pointer",letterSpacing:1,textDecoration:"underline",padding:"0 0 6px",display:"block"}}>
        {manual ? "↑ Masquer" : "✏️ Saisir manuellement"}
      </button>
      {manual && (
        <input
          value={manualVal || value}
          onChange={e => { setManualVal(e.target.value); onChange(e.target.value); }}
          style={S.input}
          placeholder="Ex: Hercules C2, Cutlass Black…"
          autoFocus
        />
      )}
    </div>
  );
}

// ─── TILE ICON ANIMÉ (Star Citizen style HD) ──────────────────────────────────
// ─── SHIP BADGE 3D (compact, à côté du nom vaisseau) ──────────────────────────
function ShipBadge3D({ shipName, color = "#00d4ff", size = 44 }) {
  const ref = useRef(null);
  const raf = useRef(null);
  const idx = useMemo(() => {
    if (!shipName) return 0;
    return shipName.split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 12;
  }, [shipName]);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const W = size * 1.9, H = size;
    canvas.width = W * dpr; canvas.height = H * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    let t = 0;
    cancelAnimationFrame(raf.current);
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.46;

    function frame() {
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(cx, cy);
      const rot = Math.sin(t * 0.018) * 0.12;
      ctx.rotate(rot);
      const bob = Math.sin(t * 0.03) * R * 0.06;
      ctx.translate(0, bob);

      // halo
      const halo = ctx.createRadialGradient(0, 0, R * 0.3, 0, 0, R * 1.5);
      halo.addColorStop(0, color + "33"); halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.ellipse(0, 2, R * 1.5, R * 0.6, 0, 0, Math.PI * 2); ctx.fill();

      // corps
      const w1 = R * 1.15, h1 = R * 0.3;
      ctx.shadowColor = color; ctx.shadowBlur = 10 + 4 * Math.sin(t * 0.05);
      ctx.strokeStyle = color; ctx.lineWidth = 1.4; ctx.fillStyle = color + "2a";
      ctx.beginPath();
      ctx.moveTo(-w1, 0);
      ctx.bezierCurveTo(-w1 * 0.5, -h1 * 1.6, w1 * 0.3, -h1, w1, 0);
      ctx.bezierCurveTo(w1 * 0.3, h1, -w1 * 0.5, h1 * 1.6, -w1, 0);
      ctx.fill(); ctx.stroke();
      // cockpit
      ctx.fillStyle = color + "aa"; ctx.shadowBlur = 7;
      ctx.beginPath(); ctx.ellipse(w1 * 0.3, -h1 * 0.3, w1 * 0.16, h1 * 0.6, -0.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.shadowBlur = 0;
      ctx.beginPath(); ctx.arc(w1 * 0.27, -h1 * 0.45, w1 * 0.045, 0, Math.PI * 2); ctx.fill();
      // ailes
      ctx.fillStyle = color + "1e"; ctx.strokeStyle = color + "aa"; ctx.lineWidth = 0.9; ctx.shadowBlur = 5;
      [[1, -1], [1, 1]].forEach(([, ys]) => {
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.lineTo(-w1 * 0.4, ys * (h1 + R * 0.42)); ctx.lineTo(-w1 * 0.78, ys * h1 * 0.5);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      });
      // réacteurs
      for (let i = 0; i < 2; i++) {
        const ry = (i === 0 ? -1 : 1) * (h1 * 0.6);
        const fl = 0.6 + 0.4 * Math.sin(t * 0.14 + i * 2);
        ctx.shadowColor = color; ctx.shadowBlur = 14 * fl; ctx.fillStyle = color;
        ctx.beginPath(); ctx.ellipse(-w1 * 0.85, ry, 3.2, 2, 0, 0, Math.PI * 2); ctx.fill();
        const jet = ctx.createLinearGradient(-w1 * 0.85, ry, -w1 * 0.85 - 20 * fl, ry);
        jet.addColorStop(0, color + "dd"); jet.addColorStop(1, "transparent");
        ctx.fillStyle = jet;
        ctx.beginPath(); ctx.ellipse(-w1 * 0.85 - 10 * fl, ry, 10 * fl, 1.6, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      t++;
      raf.current = requestAnimationFrame(frame);
    }
    frame();
    return () => cancelAnimationFrame(raf.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, color, size]);

  return <canvas ref={ref} style={{ width: size * 1.9, height: size, display: "block", flexShrink: 0, margin: "4px auto" }} width={size * 3.8} height={size * 2} />;
}


function TileIcon({ kind, color = "#00d4ff", size = 56 }) {
  const ref = useRef(null);
  const raf = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr; canvas.height = size * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    let t = 0;
    cancelAnimationFrame(raf.current);
    const c = size / 2;

    function halo(r, a) {
      const g = ctx.createRadialGradient(c, c, 0, c, c, r);
      g.addColorStop(0, color + Math.round(a).toString(16).padStart(2, "0"));
      g.addColorStop(1, "transparent");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(c, c, r, 0, Math.PI * 2); ctx.fill();
    }

    const DRAW = {
      // Coffre / lingots aUEC (Total Gagné)
      gold: () => {
        const r = size * 0.34;
        halo(size * 0.46, 26 + 16 * Math.sin(t * 0.04));
        ctx.save(); ctx.translate(c, c);
        // socle hologramme
        ctx.strokeStyle = color + "55"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(0, r * 0.85, r * 1.1, r * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
        // lingots empilés (flottants)
        const bob = Math.sin(t * 0.03) * r * 0.08;
        ctx.translate(0, bob);
        ctx.shadowColor = color; ctx.shadowBlur = 12;
        const bars = [[-r*0.55, r*0.3, 0.5], [r*0.05, r*0.3, 0.5], [-r*0.25, -r*0.05, 0.55]];
        bars.forEach(([bx, by, bw], i) => {
          const grad = ctx.createLinearGradient(bx, by - r*0.2, bx, by + r*0.2);
          grad.addColorStop(0, color); grad.addColorStop(1, color + "88");
          ctx.fillStyle = grad; ctx.strokeStyle = "#fff8"; ctx.lineWidth = 0.8;
          ctx.beginPath();
          const w = r * bw, hh = r * 0.34;
          ctx.moveTo(bx, by); ctx.lineTo(bx + w, by - hh * 0.25);
          ctx.lineTo(bx + w, by + hh * 0.55); ctx.lineTo(bx, by + hh * 0.8);
          ctx.closePath(); ctx.fill(); ctx.stroke();
          // top face
          ctx.fillStyle = "#ffffffcc";
          ctx.beginPath();
          ctx.moveTo(bx, by); ctx.lineTo(bx + w, by - hh*0.25);
          ctx.lineTo(bx + w*0.7, by - hh*0.5); ctx.lineTo(bx - w*0.3, by - hh*0.22);
          ctx.closePath(); ctx.globalAlpha = 0.5; ctx.fill(); ctx.globalAlpha = 1;
        });
        // symbole ₵ flottant
        ctx.shadowBlur = 14; ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.round(r*0.5)}px Orbitron,monospace`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("₵", 0, -r*0.55 + Math.sin(t*0.05)*2);
        ctx.restore();
      },
      // Datapad missions
      pad: () => {
        const r = size * 0.32;
        halo(size * 0.45, 22 + 14 * Math.sin(t * 0.04));
        ctx.save(); ctx.translate(c, c);
        ctx.rotate(Math.sin(t * 0.02) * 0.05);
        ctx.shadowColor = color; ctx.shadowBlur = 12;
        ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.fillStyle = color + "1e";
        // tablette
        ctx.beginPath();
        ctx.roundRect(-r*0.7, -r, r*1.4, r*2, 4);
        ctx.fill(); ctx.stroke();
        // bord lumineux haut
        ctx.fillStyle = color + "66";
        ctx.beginPath(); ctx.roundRect(-r*0.5, -r*0.85, r, r*0.12, 2); ctx.fill();
        // lignes texte qui défilent
        ctx.shadowBlur = 4;
        for (let i = 0; i < 5; i++) {
          const ly = -r*0.55 + i * r*0.3;
          const scan = (Math.sin(t * 0.05 - i * 0.6) + 1) / 2;
          ctx.strokeStyle = color + Math.round(60 + scan * 150).toString(16).padStart(2, "0");
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(-r*0.45, ly);
          ctx.lineTo(-r*0.45 + r*0.9 * (0.5 + scan*0.5), ly);
          ctx.stroke();
        }
        // check vert qui pulse
        ctx.strokeStyle = "#00ff9d"; ctx.shadowColor = "#00ff9d";
        ctx.shadowBlur = 8 + 6 * Math.sin(t * 0.08); ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r*0.15, r*0.62); ctx.lineTo(0, r*0.78); ctx.lineTo(r*0.3, r*0.45);
        ctx.stroke();
        ctx.restore();
      },
      // Poignée de main / partage co-op
      share: () => {
        const r = size * 0.33;
        halo(size * 0.45, 22 + 14 * Math.sin(t * 0.04));
        ctx.save(); ctx.translate(c, c);
        ctx.shadowColor = color; ctx.shadowBlur = 10;
        // deux noeuds reliés
        const pulse = (Math.sin(t * 0.06) + 1) / 2;
        const lx = -r*0.6, rx = r*0.6;
        // ligne énergie entre
        const lg = ctx.createLinearGradient(lx, 0, rx, 0);
        lg.addColorStop(0, color); lg.addColorStop(0.5, "#fff"); lg.addColorStop(1, color);
        ctx.strokeStyle = lg; ctx.lineWidth = 2 + pulse * 1.5;
        ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(rx, 0); ctx.stroke();
        // particule qui circule
        const px = lx + (rx - lx) * ((t * 0.02) % 1);
        ctx.fillStyle = "#fff"; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(px, 0, 2.5, 0, Math.PI*2); ctx.fill();
        // noeuds
        [[lx, color], [rx, color]].forEach(([x, col]) => {
          ctx.shadowColor = col; ctx.shadowBlur = 14;
          const ng = ctx.createRadialGradient(x, 0, 0, x, 0, r*0.42);
          ng.addColorStop(0, "#fff"); ng.addColorStop(0.4, col); ng.addColorStop(1, col + "33");
          ctx.fillStyle = ng;
          ctx.beginPath(); ctx.arc(x, 0, r*0.36 + pulse*2, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = col; ctx.lineWidth = 1.5;
          ctx.beginPath(); ctx.arc(x, 0, r*0.36 + pulse*2, 0, Math.PI*2); ctx.stroke();
        });
        // anneau orbital
        ctx.strokeStyle = color + "44"; ctx.lineWidth = 1; ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.ellipse(0, 0, r*0.95, r*0.4, t*0.03, 0, Math.PI*2); ctx.stroke();
        ctx.restore();
      },
      // Cible objectifs
      target: () => {
        const r = size * 0.36;
        halo(size * 0.45, 22 + 14 * Math.sin(t * 0.05));
        ctx.save(); ctx.translate(c, c);
        ctx.strokeStyle = color; ctx.shadowColor = color;
        [0.92, 0.62, 0.34].forEach((rr, i) => {
          ctx.shadowBlur = i === 2 ? 12 : 4;
          ctx.lineWidth = i === 2 ? 2 : 1.3;
          ctx.globalAlpha = i === 2 ? 1 : 0.7;
          ctx.save(); ctx.rotate(t * 0.012 * (i % 2 ? -1 : 1) * (i+1) * 0.4);
          ctx.beginPath(); ctx.arc(0, 0, r * rr, 0, Math.PI*2); ctx.stroke();
          if (i < 2) for (let n = 0; n < 4; n++) {
            const a = (n/4)*Math.PI*2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a)*r*rr*0.82, Math.sin(a)*r*rr*0.82);
            ctx.lineTo(Math.cos(a)*r*rr*1.18, Math.sin(a)*r*rr*1.18);
            ctx.stroke();
          }
          ctx.restore();
        });
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 14 + 6*Math.sin(t*0.08); ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(0, 0, r*0.13, 0, Math.PI*2); ctx.fill();
        ctx.lineWidth = 1.4; ctx.strokeStyle = color;
        [[-r*0.9,0,-r*0.4,0],[r*0.4,0,r*0.9,0],[0,-r*0.9,0,-r*0.4],[0,r*0.4,0,r*0.9]].forEach(([x1,y1,x2,y2])=>{
          ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
        });
        ctx.restore();
      },
      // Vaisseau (fleet) - réutilise rendu de ShipMini
      ship: () => {
        const r = size * 0.34;
        halo(size * 0.46, 22 + 14 * Math.sin(t * 0.04));
        ctx.save(); ctx.translate(c, c);
        ctx.rotate(Math.sin(t * 0.02) * 0.08);
        const bob = Math.sin(t * 0.03) * r * 0.06;
        ctx.translate(0, bob);
        ctx.shadowColor = color; ctx.shadowBlur = 12;
        ctx.strokeStyle = color; ctx.lineWidth = 1.6; ctx.fillStyle = color + "2a";
        const w1 = r * 1.1, h1 = r * 0.3;
        ctx.beginPath();
        ctx.moveTo(-w1, 0);
        ctx.bezierCurveTo(-w1*0.5, -h1*1.6, w1*0.3, -h1, w1, 0);
        ctx.bezierCurveTo(w1*0.3, h1, -w1*0.5, h1*1.6, -w1, 0);
        ctx.fill(); ctx.stroke();
        // cockpit
        ctx.fillStyle = color + "aa"; ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.ellipse(w1*0.3, -h1*0.3, w1*0.18, h1*0.6, -0.2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.beginPath(); ctx.arc(w1*0.28, -h1*0.45, w1*0.05, 0, Math.PI*2); ctx.fill();
        // ailes
        ctx.fillStyle = color + "1e"; ctx.strokeStyle = color + "aa"; ctx.lineWidth = 1;
        [[1,-1],[1,1]].forEach(([,ys])=>{
          ctx.beginPath(); ctx.moveTo(0,0);
          ctx.lineTo(-w1*0.4, ys*(h1+r*0.4)); ctx.lineTo(-w1*0.78, ys*h1*0.5);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        });
        // réacteurs flammes
        for (let i = 0; i < 2; i++) {
          const ry = (i===0?-1:1)*(h1*0.6);
          const fl = 0.6 + 0.4*Math.sin(t*0.14 + i*2);
          ctx.shadowColor = color; ctx.shadowBlur = 16*fl; ctx.fillStyle = color;
          ctx.beginPath(); ctx.ellipse(-w1*0.85, ry, 4, 2.5, 0, 0, Math.PI*2); ctx.fill();
          const jet = ctx.createLinearGradient(-w1*0.85, ry, -w1*0.85 - 22*fl, ry);
          jet.addColorStop(0, color+"dd"); jet.addColorStop(1, "transparent");
          ctx.fillStyle = jet;
          ctx.beginPath(); ctx.ellipse(-w1*0.85 - 11*fl, ry, 11*fl, 2, 0, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
      },
    };

    function frame() {
      ctx.clearRect(0, 0, size, size);
      (DRAW[kind] || DRAW.target)();
      t++;
      raf.current = requestAnimationFrame(frame);
    }
    frame();
    return () => cancelAnimationFrame(raf.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, color, size]);
  return <canvas ref={ref} style={{ width: size, height: size, display: "block", margin: "0 auto" }} width={size*2} height={size*2} />;
}


// ─── NAV ICON ANIMÉ ───────────────────────────────────────────────────────────
function NavIcon({ tabId, active, size = 32 }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const S = size * dpr;
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    let t = 0;
    cancelAnimationFrame(rafRef.current);

    const ICONS = {
      dashboard: (ctx, s, t, active) => {
        // Maison futuriste animée
        const c = s / 2, r = s * 0.38;
        const col = active ? "#00d4ff" : "#8899bb";
        ctx.clearRect(0, 0, s, s);
        ctx.save();
        ctx.translate(c, c);
        // Pulse halo
        if (active) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 0.04);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
          g.addColorStop(0, `rgba(0,212,255,${0.15 * pulse})`);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(0, 0, r * 1.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = col; ctx.lineWidth = 1.6; ctx.lineJoin = "round";
        ctx.shadowColor = col; ctx.shadowBlur = active ? 8 + 4 * Math.sin(t * 0.05) : 3;
        // Corps maison
        ctx.fillStyle = col + (active ? "25" : "15");
        ctx.beginPath();
        ctx.moveTo(-r * 0.65, r * 0.35);
        ctx.lineTo(-r * 0.65, -r * 0.08);
        ctx.lineTo(0, -r * 0.72);
        ctx.lineTo(r * 0.65, -r * 0.08);
        ctx.lineTo(r * 0.65, r * 0.35);
        ctx.closePath();
        ctx.fill(); ctx.stroke();
        // Toit détail
        ctx.beginPath();
        ctx.moveTo(-r * 0.82, -r * 0.06);
        ctx.lineTo(0, -r * 0.88);
        ctx.lineTo(r * 0.82, -r * 0.06);
        ctx.stroke();
        // Porte
        ctx.fillStyle = col + "44";
        ctx.beginPath();
        ctx.roundRect(-r * 0.18, r * 0.02, r * 0.36, r * 0.33, 2);
        ctx.fill(); ctx.stroke();
        // Fenêtre
        const winAlpha = active ? (0.6 + 0.4 * Math.sin(t * 0.07)) : 0.3;
        ctx.fillStyle = `rgba(0,212,255,${winAlpha})`;
        ctx.beginPath();
        ctx.rect(-r * 0.42, -r * 0.12, r * 0.28, r * 0.22);
        ctx.fill(); ctx.stroke();
        ctx.beginPath();
        ctx.rect(r * 0.14, -r * 0.12, r * 0.28, r * 0.22);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      },

      concession: (ctx, s, t, active) => {
        // Fusée spatiale animée
        const c = s / 2, r = s * 0.36;
        const col = active ? "#00d4ff" : "#8899bb";
        ctx.clearRect(0, 0, s, s);
        ctx.save();
        ctx.translate(c, c);
        const bob = Math.sin(t * 0.03) * r * 0.04;
        ctx.translate(0, bob);
        if (active) {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.1);
          g.addColorStop(0, `rgba(0,212,255,${0.12 + 0.08 * Math.sin(t * 0.04)})`);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = col; ctx.lineWidth = 1.5; ctx.fillStyle = col + "28";
        ctx.shadowColor = col; ctx.shadowBlur = active ? 10 : 3;
        // Corps fusée
        ctx.beginPath();
        ctx.moveTo(0, -r * 0.85);
        ctx.bezierCurveTo(r * 0.28, -r * 0.4, r * 0.28, r * 0.2, r * 0.18, r * 0.52);
        ctx.lineTo(-r * 0.18, r * 0.52);
        ctx.bezierCurveTo(-r * 0.28, r * 0.2, -r * 0.28, -r * 0.4, 0, -r * 0.85);
        ctx.fill(); ctx.stroke();
        // Ailettes
        [[-1, 1], [1, 1]].forEach(([dx]) => {
          ctx.beginPath();
          ctx.moveTo(dx * r * 0.18, r * 0.2);
          ctx.lineTo(dx * r * 0.58, r * 0.6);
          ctx.lineTo(dx * r * 0.18, r * 0.52);
          ctx.closePath(); ctx.fill(); ctx.stroke();
        });
        // Hublot
        const hubAlpha = active ? (0.7 + 0.3 * Math.sin(t * 0.06)) : 0.4;
        ctx.fillStyle = `rgba(0,212,255,${hubAlpha})`;
        ctx.shadowBlur = active ? 12 : 4;
        ctx.beginPath(); ctx.arc(0, -r * 0.22, r * 0.16, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        // Reflet hublot
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(-r * 0.04, -r * 0.27, r * 0.055, 0, Math.PI * 2); ctx.fill();
        // Flamme réacteur
        if (active) {
          const fl = 0.6 + 0.4 * Math.sin(t * 0.12);
          const fg = ctx.createLinearGradient(0, r * 0.52, 0, r * 0.52 + r * 0.55 * fl);
          fg.addColorStop(0, `rgba(0,212,255,${0.9 * fl})`);
          fg.addColorStop(0.4, `rgba(0,255,157,${0.5 * fl})`);
          fg.addColorStop(1, "transparent");
          ctx.fillStyle = fg;
          ctx.beginPath();
          ctx.ellipse(0, r * 0.52 + r * 0.28 * fl, r * 0.1, r * 0.28 * fl, 0, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      },

      objectives: (ctx, s, t, active) => {
        // Cible holographique animée
        const c = s / 2, r = s * 0.38;
        const col = active ? "#ff6b35" : "#8899bb";
        ctx.clearRect(0, 0, s, s);
        ctx.save();
        ctx.translate(c, c);
        const rot = t * 0.012;
        if (active) {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          g.addColorStop(0, `rgba(255,107,53,${0.12 + 0.08 * Math.sin(t * 0.05)})`);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = col; ctx.shadowColor = col;
        // Anneaux tournants
        [0.9, 0.6, 0.32].forEach((rr, i) => {
          ctx.shadowBlur = active ? (i === 2 ? 10 : 4) : 2;
          ctx.lineWidth = i === 2 ? 1.8 : 1.2;
          ctx.globalAlpha = i === 2 ? 1 : 0.7 - i * 0.1;
          ctx.save();
          ctx.rotate(rot * (i % 2 === 0 ? 1 : -1) * (i + 1) * 0.5);
          ctx.beginPath(); ctx.arc(0, 0, r * rr, 0, Math.PI * 2);
          ctx.stroke();
          // Encoches
          if (i < 2) {
            for (let n = 0; n < 4; n++) {
              const a = (n / 4) * Math.PI * 2 + rot;
              ctx.beginPath();
              ctx.moveTo(Math.cos(a) * r * rr * 0.85, Math.sin(a) * r * rr * 0.85);
              ctx.lineTo(Math.cos(a) * r * rr * 1.15, Math.sin(a) * r * rr * 1.15);
              ctx.stroke();
            }
          }
          ctx.restore();
        });
        ctx.globalAlpha = 1;
        // Centre cible
        ctx.shadowBlur = active ? 14 + 6 * Math.sin(t * 0.07) : 4;
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.14, 0, Math.PI * 2); ctx.fill();
        // Croix
        ctx.strokeStyle = col; ctx.lineWidth = 1.4;
        [[-r * 0.88, 0, -r * 0.42, 0], [r * 0.42, 0, r * 0.88, 0],
         [0, -r * 0.88, 0, -r * 0.42], [0, r * 0.42, 0, r * 0.88]].forEach(([x1, y1, x2, y2]) => {
          ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        });
        ctx.restore();
      },

      calc: (ctx, s, t, active) => {
        // Pioche/cristal energie animé
        const c = s / 2, r = s * 0.36;
        const col = active ? "#00ff9d" : "#8899bb";
        ctx.clearRect(0, 0, s, s);
        ctx.save();
        ctx.translate(c, c);
        if (active) {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.1);
          g.addColorStop(0, `rgba(0,255,157,${0.12 + 0.08 * Math.sin(t * 0.05)})`);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.1, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = col; ctx.lineWidth = 1.6;
        ctx.shadowColor = col; ctx.shadowBlur = active ? 8 + 4 * Math.sin(t * 0.06) : 3;
        ctx.fillStyle = col + "28";
        // Pioche gauche
        const swing = active ? Math.sin(t * 0.04) * 0.15 : 0;
        ctx.save();
        ctx.rotate(-Math.PI * 0.25 + swing);
        ctx.beginPath();
        ctx.moveTo(-r * 0.08, r * 0.06);
        ctx.lineTo(r * 0.72, -r * 0.6);
        ctx.lineTo(r * 0.82, -r * 0.48);
        ctx.lineTo(r * 0.1, r * 0.14);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        // Tête pioche
        ctx.fillStyle = col + "55";
        ctx.beginPath();
        ctx.moveTo(r * 0.55, -r * 0.75);
        ctx.lineTo(r * 0.9, -r * 0.52);
        ctx.lineTo(r * 0.72, -r * 0.3);
        ctx.lineTo(r * 0.38, -r * 0.52);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        // Pioche droite (symétrique)
        ctx.save();
        ctx.rotate(Math.PI * 0.25 - swing);
        ctx.beginPath();
        ctx.moveTo(r * 0.08, r * 0.06);
        ctx.lineTo(-r * 0.72, -r * 0.6);
        ctx.lineTo(-r * 0.82, -r * 0.48);
        ctx.lineTo(-r * 0.1, r * 0.14);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = col + "55";
        ctx.beginPath();
        ctx.moveTo(-r * 0.55, -r * 0.75);
        ctx.lineTo(-r * 0.9, -r * 0.52);
        ctx.lineTo(-r * 0.72, -r * 0.3);
        ctx.lineTo(-r * 0.38, -r * 0.52);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        // Cristal central lumineux
        if (active) {
          const cr = r * (0.18 + 0.06 * Math.sin(t * 0.07));
          const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, cr);
          cg.addColorStop(0, `rgba(0,255,157,${0.9 + 0.1 * Math.sin(t * 0.08)})`);
          cg.addColorStop(1, `rgba(0,255,157,0.2)`);
          ctx.fillStyle = cg; ctx.shadowBlur = 16;
          ctx.beginPath();
          ctx.moveTo(0, -cr); ctx.lineTo(cr * 0.7, 0);
          ctx.lineTo(0, cr); ctx.lineTo(-cr * 0.7, 0); ctx.closePath();
          ctx.fill();
        }
        ctx.restore();
      },

      settings: (ctx, s, t, active) => {
        // Engrenage futuriste animé
        const c = s / 2, r = s * 0.36;
        const col = active ? "#c084fc" : "#8899bb";
        ctx.clearRect(0, 0, s, s);
        ctx.save();
        ctx.translate(c, c);
        if (active) {
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
          g.addColorStop(0, `rgba(192,132,252,${0.15 + 0.08 * Math.sin(t * 0.04)})`);
          g.addColorStop(1, "transparent");
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        }
        const rot = t * 0.015;
        ctx.save();
        ctx.rotate(rot);
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.shadowColor = col; ctx.shadowBlur = active ? 8 + 4 * Math.sin(t * 0.05) : 3;
        ctx.fillStyle = col + "25";
        // Dents engrenage
        const teeth = 8;
        ctx.beginPath();
        for (let i = 0; i < teeth; i++) {
          const a1 = (i / teeth) * Math.PI * 2;
          const a2 = ((i + 0.3) / teeth) * Math.PI * 2;
          const a3 = ((i + 0.7) / teeth) * Math.PI * 2;
          const a4 = ((i + 1) / teeth) * Math.PI * 2;
          if (i === 0) ctx.moveTo(Math.cos(a1) * r * 0.6, Math.sin(a1) * r * 0.6);
          else ctx.lineTo(Math.cos(a1) * r * 0.6, Math.sin(a1) * r * 0.6);
          ctx.lineTo(Math.cos(a2) * r * 0.88, Math.sin(a2) * r * 0.88);
          ctx.lineTo(Math.cos(a3) * r * 0.88, Math.sin(a3) * r * 0.88);
          ctx.lineTo(Math.cos(a4) * r * 0.6, Math.sin(a4) * r * 0.6);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        // Anneau intérieur (tourne à l'envers)
        ctx.save();
        ctx.rotate(-rot * 1.5);
        ctx.strokeStyle = col + "88"; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 - rot * 1.5;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.26, Math.sin(a) * r * 0.26);
          ctx.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
          ctx.stroke();
        }
        ctx.restore();
        // Centre
        ctx.shadowBlur = active ? 12 : 4;
        ctx.fillStyle = col + "cc";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.25)";
        ctx.shadowBlur = 0;
        ctx.beginPath(); ctx.arc(-r * 0.04, -r * 0.06, r * 0.07, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      },
    };

    function frame() {
      if (ICONS[tabId]) ICONS[tabId](ctx, size, t, active);
      t += active ? 1 : 0.4;
      rafRef.current = requestAnimationFrame(frame);
    }
    frame();
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId, active, size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: "block" }} width={size * 2} height={size * 2} />;
}

// ─── ANIMATED AVATAR ──────────────────────────────────────────────────────────
function AnimatedAvatar({ profile, size = 56, onClick }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const S = size * dpr;
    canvas.width = S; canvas.height = S;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    let t = 0;
    const col = profile.color || "#00d4ff";
    cancelAnimationFrame(rafRef.current);

    // Pré-charger avatar si disponible
    let img = null;
    if (profile.avatar) {
      img = new Image();
      img.src = profile.avatar;
    }

    function frame() {
      ctx.clearRect(0, 0, size, size);
      const c = size / 2;
      const avatarR = size * 0.36;

      // Halo extérieur pulsant
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.025);
      const halo = ctx.createRadialGradient(c, c, avatarR * 0.9, c, c, size * 0.48);
      halo.addColorStop(0, `${col}${Math.round(40 * pulse).toString(16).padStart(2, "0")}`);
      halo.addColorStop(1, "transparent");
      ctx.fillStyle = halo;
      ctx.beginPath(); ctx.arc(c, c, size * 0.48, 0, Math.PI * 2); ctx.fill();

      // Anneau LED extérieur tournant (pointillés lumineux)
      const rot1 = t * 0.018;
      const R1 = size * 0.455;
      ctx.shadowColor = col; ctx.shadowBlur = 8;
      const dots1 = 24;
      for (let i = 0; i < dots1; i++) {
        const a = (i / dots1) * Math.PI * 2 + rot1;
        const bright = (Math.sin(a * 3 - t * 0.04) + 1) / 2;
        const dotR = 1.5 + bright * 2;
        ctx.globalAlpha = 0.3 + bright * 0.7;
        ctx.fillStyle = col;
        ctx.shadowBlur = bright * 12;
        ctx.beginPath();
        ctx.arc(c + Math.cos(a) * R1, c + Math.sin(a) * R1, dotR, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;

      // Anneau LED intérieur tournant inverse (tirets)
      const rot2 = -t * 0.012;
      const R2 = size * 0.42;
      const segments = 8;
      for (let i = 0; i < segments; i++) {
        const aStart = (i / segments) * Math.PI * 2 + rot2;
        const aEnd   = aStart + (Math.PI * 2 / segments) * 0.55;
        const bright = (Math.sin(i * 1.3 + t * 0.03) + 1) / 2;
        ctx.strokeStyle = col;
        ctx.lineWidth   = 2.5;
        ctx.lineCap     = "round";
        ctx.globalAlpha = 0.35 + bright * 0.65;
        ctx.shadowColor = col; ctx.shadowBlur = 8 + bright * 8;
        ctx.beginPath();
        ctx.arc(c, c, R2, aStart, aEnd);
        ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;

      // Fond avatar
      const bg = ctx.createRadialGradient(c - size * 0.06, c - size * 0.06, 0, c, c, avatarR);
      bg.addColorStop(0, col + "55");
      bg.addColorStop(1, "#0a1628");
      ctx.fillStyle = bg;
      ctx.beginPath(); ctx.arc(c, c, avatarR, 0, Math.PI * 2); ctx.fill();

      // Image avatar si disponible
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.save();
        ctx.beginPath(); ctx.arc(c, c, avatarR, 0, Math.PI * 2); ctx.clip();
        ctx.drawImage(img, c - avatarR, c - avatarR, avatarR * 2, avatarR * 2);
        ctx.restore();
      } else {
        // Emoji 👤 fallback
        ctx.font = `${Math.round(avatarR * 1.1)}px serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("👤", c, c + 2);
      }

      // Bordure avatar principale lumineuse
      ctx.shadowColor = col; ctx.shadowBlur = 14 + 6 * Math.sin(t * 0.025);
      ctx.strokeStyle = col; ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.arc(c, c, avatarR, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;

      // Éclats de lumière aux 4 coins de l'anneau
      const sparkRot = t * 0.022;
      [0, 1, 2, 3].forEach(i => {
        const a = (i / 4) * Math.PI * 2 + sparkRot;
        const sx = c + Math.cos(a) * R1;
        const sy = c + Math.sin(a) * R1;
        const bright = (Math.sin(t * 0.04 + i * 1.57) + 1) / 2;
        if (bright > 0.6) {
          const sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, 5);
          sg.addColorStop(0, `rgba(255,255,255,${bright * 0.9})`);
          sg.addColorStop(0.3, col + Math.round(bright * 180).toString(16).padStart(2, "0"));
          sg.addColorStop(1, "transparent");
          ctx.fillStyle = sg;
          ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill();
        }
      });

      t++; rafRef.current = requestAnimationFrame(frame);
    }
    frame();
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.color, profile.avatar, size]);

  return (
    <canvas
      ref={canvasRef}
      onClick={onClick}
      style={{ width: size, height: size, display: "block", flexShrink: 0, cursor: "pointer" }}
      width={size * 2}
      height={size * 2}
    />
  );
}

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
// ─── GAINS HISTORY MODAL ──────────────────────────────────────────────────────
function GainsCanvas() {
  const ref = useRef(null);
  const raf = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    const cx = w/2, cy = h/2, R = Math.min(w,h)*0.4;
    let t = 0;
    const bars = Array.from({length:9},(_,i)=>({ x:(i/8-0.5)*R*1.4, ph:Math.random()*6, base:0.3+Math.random()*0.5 }));
    const sparks = Array.from({length:16},(_,i)=>({ a:(i/16)*Math.PI*2, sp:0.007+Math.random()*0.006, r:R*(0.5+Math.random()*0.55), sz:1.5+Math.random()*2.5 }));
    function frame(){
      t+=0.02; ctx.clearRect(0,0,w,h);
      [R*1.1,R*0.7].forEach((rr,i)=>{
        const g=ctx.createRadialGradient(cx,cy,0,cx,cy,rr);
        g.addColorStop(0,`rgba(255,204,0,${0.14-i*0.05})`); g.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,rr,0,Math.PI*2); ctx.fill();
      });
      // barres graph montantes
      ctx.save(); ctx.translate(cx,cy);
      bars.forEach((b,i)=>{
        const hh = R*0.5*(b.base+0.3*Math.abs(Math.sin(t*1.5+b.ph)));
        const bw = R*0.13;
        const al = 0.4+0.4*Math.abs(Math.sin(t+b.ph));
        const grad=ctx.createLinearGradient(0,R*0.85,0,R*0.85-hh);
        grad.addColorStop(0,`rgba(255,107,53,${al})`); grad.addColorStop(1,`rgba(255,204,0,${al})`);
        ctx.fillStyle=grad; ctx.shadowColor="#ffcc00"; ctx.shadowBlur=8;
        ctx.fillRect(b.x-bw/2, R*0.85-hh, bw, hh);
      });
      ctx.shadowBlur=0; ctx.restore();
      // sparks orbite
      sparks.forEach(s=>{ s.a+=s.sp; const x=cx+Math.cos(s.a)*s.r,y=cy+Math.sin(s.a)*s.r*0.3; const d=(Math.sin(s.a)+1)/2,al=0.3+d*0.7,sz=s.sz*(0.4+d*0.6);
        ctx.beginPath(); ctx.arc(x,y,sz,0,Math.PI*2); ctx.fillStyle=`rgba(255,204,0,${al})`; ctx.fill();
      });
      const sg=ctx.createRadialGradient(cx-R*.06,cy-R*.06,0,cx,cy,R*0.2);
      sg.addColorStop(0,"rgba(255,240,200,.98)"); sg.addColorStop(.4,"rgba(255,204,0,.85)"); sg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(cx,cy,R*0.2,0,Math.PI*2); ctx.fillStyle=sg; ctx.fill();
      ctx.font=`bold ${Math.round(R*.2)}px Orbitron,monospace`; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle="rgba(255,255,255,.95)"; ctx.shadowColor="#ffcc00"; ctx.shadowBlur=16;
      ctx.fillText("₵",cx,cy+1); ctx.shadowBlur=0;
      raf.current=requestAnimationFrame(frame);
    }
    frame();
    return ()=>cancelAnimationFrame(raf.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  return <canvas ref={ref} style={{width:"100%",height:"100%",display:"block"}}/>;
}

function GainsHistoryModal({ missions, profiles, totalEarned, onClose }) {
  const [filter, setFilter] = useState("all"); // all | p1 | p2...

  // Gains par joueur
  function gainFor(m, pid) {
    if (m.split) return Math.floor(m.amount/2);
    return m.assignee===pid ? m.amount : 0;
  }
  const perPlayer = profiles.map(p => ({
    ...p,
    total: missions.reduce((a,m)=>a+gainFor(m,p.id),0),
  }));

  const filtered = filter==="all" ? missions : missions.filter(m => m.split || m.assignee===filter);

  return (
    <div style={S.modalOverlay} onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{...S.modalBox,maxWidth:560}}>
        <div style={S.modalHeader}>
          <div style={S.modalTitle}>💰 HISTORIQUE DES GAINS</div>
          <button onClick={onClose} style={S.closeBtn}>✕</button>
        </div>
        <div style={S.modalBody}>
          {/* Canvas animé */}
          <div style={{position:"relative",width:"100%",height:140,borderRadius:12,overflow:"hidden",marginBottom:8,background:"#030b1a",border:"1px solid #ffcc0022"}}>
            <GainsCanvas/>
            <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"12px 32px",borderRadius:14,background:"radial-gradient(ellipse at center, rgba(3,11,26,0.92) 0%, rgba(3,11,26,0.75) 60%, rgba(3,11,26,0) 100%)",backdropFilter:"blur(2px)"}}>
                <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:12,letterSpacing:3,marginBottom:2}}>TOTAL GAGNÉ</div>
                <div style={{color:"#ffd633",fontFamily:"'Orbitron',sans-serif",fontSize:30,fontWeight:900,textShadow:"0 2px 8px #000, 0 0 20px #ffcc00aa",letterSpacing:1}}>{fmt(totalEarned)}</div>
                <div style={{color:"#ffcc0099",fontFamily:"'Rajdhani',sans-serif",fontSize:12,letterSpacing:2,marginTop:1}}>aUEC</div>
              </div>
            </div>
          </div>

          {/* Cartes par joueur */}
          <div style={{display:"flex",gap:10,marginBottom:16}}>
            {perPlayer.map(p=>(
              <div key={p.id} style={{flex:1,background:"#0a1628",border:`1px solid ${p.color}44`,borderRadius:10,padding:"10px 12px"}}>
                <div style={{color:p.color,fontFamily:"'Orbitron',sans-serif",fontSize:12,fontWeight:700,marginBottom:4}}>{p.name}</div>
                <div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:16,fontWeight:700}}>{fmt(p.total)}</div>
                <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:10}}>aUEC gagnés</div>
              </div>
            ))}
          </div>

          {/* Filtre */}
          <div style={{display:"flex",gap:6,marginBottom:14,flexWrap:"wrap"}}>
            <button onClick={()=>setFilter("all")} style={{background:filter==="all"?"#ffcc0022":"#0a1628",border:`1px solid ${filter==="all"?"#ffcc00":"#1a2a44"}`,borderRadius:20,padding:"5px 14px",color:filter==="all"?"#ffcc00":"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:12,cursor:"pointer",fontWeight:filter==="all"?700:400}}>Tout</button>
            {profiles.map(p=>(
              <button key={p.id} onClick={()=>setFilter(p.id)} style={{background:filter===p.id?`${p.color}22`:"#0a1628",border:`1px solid ${filter===p.id?p.color:"#1a2a44"}`,borderRadius:20,padding:"5px 14px",color:filter===p.id?p.color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:12,cursor:"pointer",fontWeight:filter===p.id?700:400}}>{p.name}</button>
            ))}
          </div>

          {/* Liste gains */}
          {filtered.length===0 ? (
            <div style={{textAlign:"center",padding:"40px 20px"}}>
              <div style={{fontSize:40,marginBottom:12,opacity:.4}}>💰</div>
              <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:14}}>Aucun gain enregistré</div>
            </div>
          ) : (
            <>
              <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:12,letterSpacing:1,marginBottom:10}}>{filtered.length} MISSION{filtered.length>1?"S":""}</div>
              {filtered.map(m=>{
                const owner = profiles.find(p=>p.id===m.assignee);
                return (
                  <div key={m.id} style={{background:"#0a1628",border:"1px solid #1a2a4488",borderRadius:10,padding:"12px 14px",marginBottom:8}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                      <div style={{flex:1}}>
                        <div style={{color:"#e8f4ff",fontFamily:"'Rajdhani',sans-serif",fontSize:14,fontWeight:600}}>{m.name}</div>
                        <div style={{display:"flex",gap:8,alignItems:"center",marginTop:3}}>
                          {m.split
                            ? <span style={{color:"#ffcc00",fontFamily:"'Rajdhani',sans-serif",fontSize:10,letterSpacing:1}}>🤝 PARTAGÉE</span>
                            : <span style={{color:owner?.color,fontFamily:"'Orbitron',sans-serif",fontSize:10,fontWeight:700}}>{owner?.name}</span>}
                          <span style={{color:"#4a5a6a",fontFamily:"'Rajdhani',sans-serif",fontSize:10}}>{m.date}</span>
                        </div>
                      </div>
                      <div style={{textAlign:"right",whiteSpace:"nowrap"}}>
                        <div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:15,fontWeight:700}}>+{fmt(m.amount)}</div>
                        {m.split && <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:10}}>{fmt(Math.floor(m.amount/2))} / pilote</div>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── CHAT TILE + INTERFACE ────────────────────────────────────────────────────
function ChatCanvas() {
  const ref = useRef(null);
  const raf = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    let t = 0;
    // bulles de chat flottantes
    const bubbles = Array.from({length: 8}, (_, i) => ({
      x: 0.1 + Math.random() * 0.8,
      y: 1.1 + Math.random() * 0.5,
      sp: 0.0008 + Math.random() * 0.0012,
      w: 0.15 + Math.random() * 0.25,
      h2: 0.06 + Math.random() * 0.08,
      col: Math.random() > 0.5 ? "#00d4ff" : "#a78bfa",
      ph: Math.random() * 6,
    }));
    function frame() {
      t += 0.016; ctx.clearRect(0, 0, w, h);
      // fond dégradé
      const bg = ctx.createLinearGradient(0, 0, w, h);
      bg.addColorStop(0, "rgba(5,8,24,0)"); bg.addColorStop(1, "rgba(10,5,28,0)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
      // bulles flottantes
      bubbles.forEach(b => {
        b.y -= b.sp;
        if (b.y < -0.15) { b.y = 1.1 + Math.random() * 0.3; b.x = 0.05 + Math.random() * 0.9; }
        const bx = b.x * w, by = b.y * h, bw = b.w * w, bh = b.h2 * h;
        const al = 0.12 + 0.1 * Math.abs(Math.sin(t * 1.2 + b.ph));
        ctx.strokeStyle = b.col + Math.round(al * 255).toString(16).padStart(2, "0");
        ctx.fillStyle = b.col + Math.round(al * 60).toString(16).padStart(2, "0");
        ctx.lineWidth = 1; ctx.shadowColor = b.col; ctx.shadowBlur = 4;
        const r2 = bh * 0.5;
        ctx.beginPath();
        ctx.moveTo(bx + r2, by); ctx.arcTo(bx + bw, by, bx + bw, by + bh, r2);
        ctx.arcTo(bx + bw, by + bh, bx, by + bh, r2);
        // petite pointe
        ctx.arcTo(bx, by + bh, bx, by, r2);
        ctx.arcTo(bx, by, bx + bw, by, r2);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
      });
      // lignes réseau
      for (let i = 0; i < 3; i++) {
        const y2 = h * (0.25 + i * 0.25 + 0.03 * Math.sin(t * 0.4 + i));
        const al2 = 0.04 + 0.02 * Math.sin(t * 0.3 + i * 2);
        ctx.strokeStyle = `rgba(167,139,250,${al2})`; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(w, y2); ctx.stroke();
      }
      raf.current = requestAnimationFrame(frame);
    }
    frame();
    return () => cancelAnimationFrame(raf.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <canvas ref={ref} style={{ width: "100%", height: "100%", display: "block" }} />;
}

function ChatTile({ profiles, msgCount, onClick, isDesktop }) {
  const [hov, setHov] = useState(false);
  const hasNew = msgCount > 0;
  const base = {
    position: "relative", overflow: "hidden", cursor: "pointer",
    background: "#07111fcc", borderRadius: 12, transition: "all .25s",
    backdropFilter: "blur(8px)",
    border: `1px solid ${hov ? "#a78bfa99" : "#a78bfa44"}`,
    boxShadow: hov ? "0 0 32px #a78bfa88, 0 0 8px #a78bfa44 inset" : "0 0 12px #a78bfa33",
    transform: hov ? "scale(1.03) translateY(-2px)" : "scale(1)",
  };
  return isDesktop ? (
    <div style={{ ...base, padding: "20px 14px", textAlign: "center" }}
      onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ position: "absolute", inset: 0 }}><ChatCanvas /></div>
      {hasNew && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "#a78bfa", color: "#fff", fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 900, borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 10px #a78bfa", animation: "badgePop 1.5s ease-in-out infinite", zIndex: 2 }}>{msgCount}</div>
      )}
      <div style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>
        <div style={{ fontSize: 32, marginBottom: 8, filter: "drop-shadow(0 0 8px #a78bfa)" }}>💬</div>
        <div style={{ color: "#a78bfa", fontSize: 15, fontFamily: "'Rajdhani',sans-serif", letterSpacing: 2, textTransform: "uppercase", fontWeight: 600 }}>CHAT</div>
        <div style={{ color: "#e8f4ff", fontSize: 22, fontWeight: 700, fontFamily: "'Orbitron',sans-serif", margin: "5px 0" }}>MEMO</div>
        <div style={{ color: "#8899bb", fontSize: 12, fontFamily: "'Rajdhani',sans-serif" }}>Notes internes</div>
      </div>
    </div>
  ) : (
    <div style={{ ...base, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}
      onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
      <div style={{ position: "absolute", inset: 0 }}><ChatCanvas /></div>
      {hasNew && (
        <div style={{ position: "absolute", top: 8, right: 8, background: "#a78bfa", color: "#fff", fontFamily: "'Orbitron',sans-serif", fontSize: 11, fontWeight: 900, borderRadius: "50%", width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 10px #a78bfa", animation: "badgePop 1.5s ease-in-out infinite", zIndex: 2 }}>{msgCount}</div>
      )}
      <div style={{ position: "relative", zIndex: 1, fontSize: 36, filter: "drop-shadow(0 0 10px #a78bfa)", flexShrink: 0 }}>💬</div>
      <div style={{ position: "relative", zIndex: 1, flex: 1 }}>
        <div style={{ color: "#a78bfa", fontSize: 14, fontFamily: "'Rajdhani',sans-serif", letterSpacing: 2, textTransform: "uppercase", fontWeight: 700, marginBottom: 2 }}>CHAT · MEMO</div>
        <div style={{ color: "#e8f4ff", fontSize: 22, fontWeight: 700, fontFamily: "'Orbitron',sans-serif" }}>Notes internes</div>
        <div style={{ color: "#8899bb", fontSize: 12, fontFamily: "'Rajdhani',sans-serif" }}>Messages persistants</div>
      </div>
      <div style={{ position: "relative", zIndex: 1, color: "#a78bfa", fontSize: 22, opacity: 0.7 }}>→</div>
    </div>
  );
}

function ChatInterface({ profiles, messages, setMessages, onMarkRead, onClose }) {
  const [text, setText] = useState("");
  const [author, setAuthor] = useState(profiles[0]?.id || "");
  const endRef = useRef(null);
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Fond animé interface chat
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    function resize() { canvas.width = canvas.offsetWidth * dpr; canvas.height = canvas.offsetHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
    resize();
    const w = () => canvas.offsetWidth, h = () => canvas.offsetHeight;
    let t2 = 0;
    const stars2 = Array.from({ length: 40 }, () => ({ x: Math.random(), y: Math.random(), r: 0.5 + Math.random() * 1.5, ph: Math.random() * 6 }));
    function frame2() {
      t2 += 0.012; ctx.clearRect(0, 0, w(), h());
      const bg2 = ctx.createLinearGradient(0, 0, 0, h());
      bg2.addColorStop(0, "rgb(5,8,24)"); bg2.addColorStop(1, "rgb(8,4,20)");
      ctx.fillStyle = bg2; ctx.fillRect(0, 0, w(), h());
      // grille holographique
      ctx.strokeStyle = "rgba(167,139,250,0.04)"; ctx.lineWidth = 0.8;
      const gap2 = 32;
      for (let x2 = 0; x2 < w() + gap2; x2 += gap2) { ctx.beginPath(); ctx.moveTo(x2, 0); ctx.lineTo(x2, h()); ctx.stroke(); }
      for (let y2 = 0; y2 < h() + gap2; y2 += gap2) { ctx.beginPath(); ctx.moveTo(0, y2); ctx.lineTo(w(), y2); ctx.stroke(); }
      // étoiles
      stars2.forEach(s => {
        const al3 = 0.2 + 0.3 * Math.abs(Math.sin(t2 * 0.8 + s.ph));
        ctx.fillStyle = `rgba(200,220,255,${al3})`;
        ctx.beginPath(); ctx.arc(s.x * w(), s.y * h(), s.r, 0, Math.PI * 2); ctx.fill();
      });
      rafRef.current = requestAnimationFrame(frame2);
    }
    frame2();
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  function send() {
    if (!text.trim() || !author) return;
    const p = profiles.find(p2 => p2.id === author);
    const msg = { id: Date.now(), author: p?.name || author, color: p?.color || "#a78bfa", text: text.trim(), time: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), date: new Date().toLocaleDateString("fr-FR") };
    const next = [...messages, msg];
    setMessages(next);
    setText("");
  }

  function del(id) {
    const next = messages.filter(m => m.id !== id);
    setMessages(next);
  }

  // grouper par date
  const grouped = messages.reduce((acc, m) => {
    const d = m.date || ""; if (!acc[d]) acc[d] = []; acc[d].push(m); return acc;
  }, {});

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 999, display: "flex", flexDirection: "column" }}>
      {/* Fond animé */}
      <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {/* Header */}
      <div style={{ position: "relative", zIndex: 1, background: "rgba(5,8,24,0.95)", borderBottom: "1px solid #a78bfa44", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", backdropFilter: "blur(16px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 28, filter: "drop-shadow(0 0 8px #a78bfa)" }}>💬</div>
          <div>
            <div style={{ color: "#a78bfa", fontFamily: "'Orbitron',sans-serif", fontSize: 16, fontWeight: 700, letterSpacing: 2 }}>CHAT · MEMO</div>
            <div style={{ color: "#8899bb", fontFamily: "'Rajdhani',sans-serif", fontSize: 12, letterSpacing: 1 }}>{messages.length} MESSAGE{messages.length !== 1 ? "S" : ""}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {messages.length > 0 && <button onClick={() => { if (window.confirm("Effacer tous les messages ?")) { setMessages([]); } }} style={{ background: "transparent", border: "1px solid #ff446644", color: "#ff4466", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontSize: 12 }}>🗑 Vider</button>}
          {onMarkRead && <button onClick={onMarkRead} style={{ background: "transparent", border: "1px solid #a78bfa55", color: "#a78bfa", borderRadius: 6, padding: "5px 10px", cursor: "pointer", fontFamily: "'Rajdhani',sans-serif", fontSize: 12 }}>✓ Marquer lu</button>}
          <button onClick={onClose} style={{ background: "transparent", border: "1px solid #a78bfa55", color: "#a78bfa", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 700 }}>✕ FERMER</button>
        </div>
      </div>
      {/* Messages */}
      <div style={{ position: "relative", zIndex: 1, flex: 1, overflowY: "auto", padding: "20px 16px" }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }}>💬</div>
            <div style={{ color: "#8899bb", fontFamily: "'Rajdhani',sans-serif", fontSize: 16, letterSpacing: 1 }}>Aucun message — commencez à écrire !</div>
          </div>
        )}
        {Object.entries(grouped).map(([date, msgs]) => (
          <div key={date}>
            <div style={{ textAlign: "center", margin: "16px 0 12px", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,transparent,#a78bfa33)" }} />
              <div style={{ color: "#8899bb", fontFamily: "'Rajdhani',sans-serif", fontSize: 11, letterSpacing: 2 }}>{date}</div>
              <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#a78bfa33,transparent)" }} />
            </div>
            {msgs.map((m, mi) => {
              const isFirst = mi === 0 || msgs[mi - 1]?.author !== m.author;
              return (
                <div key={m.id} style={{ marginBottom: 6, animation: "fadeIn .3s ease" }}>
                  {isFirst && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, marginTop: mi > 0 ? 12 : 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `radial-gradient(circle,${m.color}44,#0a1628)`, border: `1.5px solid ${m.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, boxShadow: `0 0 8px ${m.color}66` }}>👤</div>
                      <div style={{ color: m.color, fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700 }}>{m.author}</div>
                      <div style={{ color: "#4a5a6a", fontFamily: "'Rajdhani',sans-serif", fontSize: 10 }}>{m.time}</div>
                    </div>
                  )}
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, paddingLeft: 36 }}>
                    <div style={{ flex: 1, background: `linear-gradient(135deg,${m.color}0f,#0a162888)`, border: `1px solid ${m.color}33`, borderRadius: "0 12px 12px 12px", padding: "8px 12px", backdropFilter: "blur(4px)" }}>
                      <div style={{ color: "#e8f4ff", fontFamily: "'Rajdhani',sans-serif", fontSize: 15, lineHeight: 1.5, wordBreak: "break-word" }}>{m.text}</div>
                    </div>
                    <button onClick={() => del(m.id)} style={{ background: "transparent", border: "none", color: "#4a5a6a", cursor: "pointer", fontSize: 13, padding: "4px", opacity: 0.5, flexShrink: 0 }} title="Supprimer">🗑</button>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      {/* Input */}
      <div style={{ position: "relative", zIndex: 1, background: "rgba(5,8,24,0.97)", borderTop: "1px solid #a78bfa33", padding: "12px 16px", backdropFilter: "blur(16px)" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <select value={author} onChange={e => setAuthor(e.target.value)} style={{ background: "#0a1628", border: "1px solid #a78bfa44", borderRadius: 8, color: "#a78bfa", fontFamily: "'Orbitron',sans-serif", fontSize: 12, padding: "8px 12px", cursor: "pointer", flex: "0 0 auto" }}>
            {profiles.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div style={{ color: "#8899bb", fontFamily: "'Rajdhani',sans-serif", fontSize: 11, alignSelf: "center", flexShrink: 0 }}>écrit en tant que :</div>
          <div style={{ color: profiles.find(p => p.id === author)?.color || "#a78bfa", fontFamily: "'Orbitron',sans-serif", fontSize: 12, fontWeight: 700, alignSelf: "center" }}>{profiles.find(p => p.id === author)?.name}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            style={{ flex: 1, background: "#0a1628", border: "1px solid #a78bfa44", borderRadius: 10, padding: "11px 14px", color: "#e8f4ff", fontFamily: "'Rajdhani',sans-serif", fontSize: 15, outline: "none" }}
            placeholder="Écrire un message… (Entrée pour envoyer)"
          />
          <button onClick={send} disabled={!text.trim()} style={{ background: text.trim() ? "linear-gradient(135deg,#a78bfa33,#0a1628)" : "#0a1628", border: `1px solid ${text.trim() ? "#a78bfa" : "#1a2a44"}`, color: text.trim() ? "#a78bfa" : "#4a5a6a", borderRadius: 10, padding: "11px 18px", cursor: text.trim() ? "pointer" : "default", fontFamily: "'Orbitron',sans-serif", fontSize: 13, fontWeight: 700, transition: "all .2s", boxShadow: text.trim() ? "0 0 12px #a78bfa44" : "none" }}>
            ENVOYER
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── DÉPENSES TILE ────────────────────────────────────────────────────────────
function DepensesCanvas() {
  const ref = useRef(null);
  const raf = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    const cx = w/2, cy = h/2, R = Math.min(w,h)*0.38;
    let t = 0;
    const coins = Array.from({length:14},(_,i)=>({ a:(i/14)*Math.PI*2, sp:0.008+Math.random()*0.006, r:R*(0.55+Math.random()*0.5), sz:3+Math.random()*3 }));
    function frame(){
      t+=0.02; ctx.clearRect(0,0,w,h);
      [R*1.1,R*0.7].forEach((rr,i)=>{
        const g=ctx.createRadialGradient(cx,cy,0,cx,cy,rr);
        g.addColorStop(0,`rgba(255,107,53,${0.14-i*0.05})`); g.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,rr,0,Math.PI*2); ctx.fill();
      });
      ctx.save(); ctx.translate(cx,cy);
      ctx.beginPath(); ctx.ellipse(0,0,R*0.85,R*0.26,t*0.16,0,Math.PI*2);
      const rg=ctx.createLinearGradient(-R,0,R,0);
      rg.addColorStop(0,"rgba(255,107,53,0)"); rg.addColorStop(.4,"rgba(255,107,53,.9)");
      rg.addColorStop(.6,"rgba(255,204,0,1)"); rg.addColorStop(1,"rgba(255,107,53,0)");
      ctx.strokeStyle=rg; ctx.lineWidth=2.5; ctx.stroke(); ctx.restore();
      coins.forEach(c=>{ c.a+=c.sp; const x=cx+Math.cos(c.a)*c.r,y=cy+Math.sin(c.a)*c.r*0.26; const d=(Math.sin(c.a)+1)/2,al=0.3+d*0.7,sz=c.sz*(0.5+d*0.6);
        ctx.save(); ctx.translate(x,y); ctx.scale(1,0.5+0.5*Math.abs(Math.sin(t*2+c.a)));
        ctx.beginPath(); ctx.arc(0,0,sz,0,Math.PI*2);
        ctx.fillStyle=`rgba(255,204,0,${al})`; ctx.strokeStyle=`rgba(255,107,53,${al})`; ctx.lineWidth=1;
        ctx.fill(); ctx.stroke(); ctx.restore();
      });
      const sg=ctx.createRadialGradient(cx-R*.06,cy-R*.06,0,cx,cy,R*0.22);
      sg.addColorStop(0,"rgba(255,230,180,.98)"); sg.addColorStop(.4,"rgba(255,107,53,.85)"); sg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(cx,cy,R*0.22,0,Math.PI*2); ctx.fillStyle=sg; ctx.fill();
      ctx.font=`bold ${Math.round(R*.2)}px Orbitron,monospace`; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle="rgba(255,255,255,.95)"; ctx.shadowColor="#ff6b35"; ctx.shadowBlur=14;
      ctx.fillText("−₵",cx,cy+1); ctx.shadowBlur=0;
      raf.current=requestAnimationFrame(frame);
    }
    frame();
    return ()=>cancelAnimationFrame(raf.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  return <canvas ref={ref} style={{width:"100%",height:"100%",display:"block"}}/>;
}

function DepensesTile({ profiles, setProfiles, isDesktop }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("depense");
  const [who, setWho] = useState("");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [hov, setHov] = useState(false);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("depenses_history") || "[]"); } catch { return []; }
  });
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => { if (profiles.length && !who) setWho(profiles[0].id); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let w,h,t=0;
    function resize(){ w=canvas.offsetWidth; h=canvas.offsetHeight; canvas.width=w*dpr; canvas.height=h*dpr; ctx.scale(dpr,dpr); }
    resize();
    const coins = Array.from({length:18},(_,i)=>({ a:(i/18)*Math.PI*2, sp:0.009+Math.random()*0.006, rf:0.55+Math.random()*0.45, sz:2+Math.random()*3 }));
    function frame(){
      t+=0.02; ctx.clearRect(0,0,w,h);
      const cx=w/2,cy=h/2,R=Math.min(w,h)*0.36;
      const bg=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
      bg.addColorStop(0,"rgba(255,107,53,0.16)"); bg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();
      ctx.save(); ctx.translate(cx,cy);
      ctx.beginPath(); ctx.ellipse(0,0,R*0.85,R*0.25,t*0.18,0,Math.PI*2);
      const rg=ctx.createLinearGradient(-R,0,R,0);
      rg.addColorStop(0,"rgba(255,107,53,0)"); rg.addColorStop(.4,"rgba(255,107,53,.9)");
      rg.addColorStop(.6,"rgba(255,204,0,1)"); rg.addColorStop(1,"rgba(255,107,53,0)");
      ctx.strokeStyle=rg; ctx.lineWidth=2.5; ctx.stroke(); ctx.restore();
      coins.forEach(c=>{ c.a+=c.sp; const PR=R*c.rf; const x=cx+Math.cos(c.a)*PR,y=cy+Math.sin(c.a)*PR*0.25; const d=(Math.sin(c.a)+1)/2,al=0.25+d*0.75,sz=c.sz*(0.4+d*0.6);
        ctx.save(); ctx.translate(x,y); ctx.scale(1,0.5+0.5*Math.abs(Math.sin(t*2+c.a)));
        ctx.beginPath(); ctx.arc(0,0,sz,0,Math.PI*2); ctx.fillStyle=`rgba(255,204,0,${al})`; ctx.strokeStyle=`rgba(255,107,53,${al})`; ctx.lineWidth=1; ctx.fill(); ctx.stroke(); ctx.restore();
      });
      const sg=ctx.createRadialGradient(cx-R*.07,cy-R*.07,0,cx,cy,R*0.22);
      sg.addColorStop(0,"rgba(255,235,190,.98)"); sg.addColorStop(.35,"rgba(255,107,53,.85)"); sg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(cx,cy,R*0.22,0,Math.PI*2); ctx.fillStyle=sg; ctx.fill();
      ctx.font=`bold ${Math.round(R*.18)}px Orbitron,monospace`; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle="rgba(255,255,255,.98)"; ctx.shadowColor="#ff6b35"; ctx.shadowBlur=16;
      ctx.fillText("−₵",cx,cy+1); ctx.shadowBlur=0;
      rafRef.current=requestAnimationFrame(frame);
    }
    frame();
    return ()=>cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const whoP = profiles.find(p=>p.id===who);
  const num = parseFloat(amount)||0;
  const canSave = num>0 && label.trim() && whoP && whoP.aUEC>=num;

  function doDepense(){
    if(!canSave) return;
    setSaving(true);
    setTimeout(()=>{
      setProfiles(prev=>prev.map(p=>p.id===who?{...p,aUEC:p.aUEC-num}:p));
      const entry={ id:Date.now(), date:new Date().toLocaleString("fr-FR"), who:whoP.name, whoColor:whoP.color||"#ff6b35", label:label.trim(), amount:num };
      setHistory(prev=>{ const next=[entry,...prev].slice(0,100); try{localStorage.setItem("depenses_history",JSON.stringify(next));}catch{} return next; });
      setOk(true); setSaving(false); setAmount(""); setLabel("");
      setTimeout(()=>{ setOk(false); setOpen(false); },2800);
    },800);
  }

  const tileBase = { position:"relative", background:"#07111fcc", border:`1px solid ${hov?"#ff6b3577":"#ff6b3533"}`, borderRadius:12, transition:"all .25s", backdropFilter:"blur(8px)", cursor:"pointer", overflow:"hidden", boxShadow:hov?"0 0 32px #ff6b3588,0 0 8px #ff6b3544 inset":"0 0 12px #ff6b3533" };

  return (
    <>
      {isDesktop ? (
        <div style={{...tileBase, padding:"20px 14px", textAlign:"center", transform:hov?"scale(1.04) translateY(-2px)":"scale(1)"}}
          onClick={()=>setOpen(true)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
          <canvas ref={canvasRef} style={{width:"100%",height:110,display:"block",borderRadius:8,marginBottom:8}}/>
          <div style={{color:"#ff6b35",fontSize:13,fontFamily:"'Rajdhani',sans-serif",letterSpacing:2,textTransform:"uppercase"}}>DÉPENSES</div>
          <div style={{color:"#e8f4ff",fontSize:24,fontWeight:700,fontFamily:"'Orbitron',sans-serif",margin:"3px 0"}}>DIVERSES</div>
          <div style={{color:"#8899bb",fontSize:12,fontFamily:"'Rajdhani',sans-serif"}}>Sorties d'aUEC</div>
        </div>
      ) : (
        <div style={{...tileBase, padding:"16px 18px", display:"flex", alignItems:"center", gap:16, transform:hov?"scale(1.01)":"scale(1)"}}
          onClick={()=>setOpen(true)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
          <canvas ref={canvasRef} style={{width:90,height:90,display:"block",flexShrink:0,borderRadius:10}}/>
          <div style={{flex:1}}>
            <div style={{color:"#ff6b35",fontSize:13,fontFamily:"'Rajdhani',sans-serif",letterSpacing:2,textTransform:"uppercase",marginBottom:2}}>DÉPENSES DIVERSES</div>
            <div style={{color:"#e8f4ff",fontSize:22,fontWeight:700,fontFamily:"'Orbitron',sans-serif",marginBottom:2}}>aUEC</div>
            <div style={{color:"#8899bb",fontSize:12,fontFamily:"'Rajdhani',sans-serif"}}>Suivi des sorties d'argent</div>
          </div>
          <div style={{color:"#ff6b35",fontSize:28,opacity:0.6}}>−</div>
        </div>
      )}

      {open && (
        <div style={S.modalOverlay} onClick={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
          <div style={{...S.modalBox,maxWidth:480}}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>💳 DÉPENSES DIVERSES</div>
              <button onClick={()=>setOpen(false)} style={S.closeBtn}>✕</button>
            </div>
            <div style={{display:"flex",borderBottom:"1px solid #1a2a44",background:"#050e1d"}}>
              {[["depense","💳 Dépense"],["historique","📜 Historique"]].map(([id,lbl])=>(
                <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"12px 0",background:"transparent",border:"none",borderBottom:`2px solid ${tab===id?"#ff6b35":"transparent"}`,color:tab===id?"#ff6b35":"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1.5,cursor:"pointer",transition:"all .2s",textTransform:"uppercase"}}>{lbl}</button>
              ))}
            </div>
            <div style={S.modalBody}>
            {tab==="depense" && <>
              <div style={{position:"relative",width:"100%",height:120,borderRadius:12,overflow:"hidden",marginBottom:18,background:"#030b1a",border:"1px solid #ff6b3522"}}>
                <DepensesCanvas/>
              </div>
              <label style={S.label}>Qui dépense ?</label>
              <select value={who} onChange={e=>setWho(e.target.value)} style={S.input}>
                {profiles.map(p=><option key={p.id} value={p.id}>{p.name} — {fmt(p.aUEC)} aUEC</option>)}
              </select>
              <label style={S.label}>Description</label>
              <input value={label} onChange={e=>setLabel(e.target.value)} style={S.input} placeholder="Ex: Carburant, Réparation, Armes…"/>
              <label style={S.label}>Montant (aUEC)</label>
              <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} style={S.input} placeholder="Ex: 25 000" min="1"/>
              {num>0 && (
                <div style={{background:"#07111f",border:"1px solid #ff6b3522",borderRadius:10,padding:"12px 16px",marginTop:8}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:"#ff6b35",fontFamily:"'Rajdhani',sans-serif",fontSize:14,fontWeight:700}}>Débité de {whoP?.name}</span>
                    <span style={{color:"#ff6b35",fontFamily:"'Orbitron',sans-serif",fontSize:14,fontWeight:700}}>−{fmt(num)} aUEC</span>
                  </div>
                  {whoP && num>whoP.aUEC && <div style={{color:"#ff4466",fontFamily:"'Rajdhani',sans-serif",fontSize:12,marginTop:6}}>⛔ Solde insuffisant — {fmt(whoP.aUEC)} aUEC dispo</div>}
                </div>
              )}
              {ok && (
                <div style={{background:"#ff6b3511",border:"1px solid #ff6b3555",borderRadius:10,padding:"14px",marginTop:12,textAlign:"center",animation:"fadeIn .3s ease"}}>
                  <div style={{fontSize:30,marginBottom:6}}>✅</div>
                  <div style={{color:"#ff6b35",fontFamily:"'Orbitron',sans-serif",fontSize:14,fontWeight:700}}>Dépense enregistrée !</div>
                </div>
              )}
              <button onClick={doDepense} disabled={!canSave||saving} style={{...S.primaryBtn,marginTop:14,background:canSave?"linear-gradient(135deg,#ff6b3522,#0a1628)":"#0a1628",borderColor:canSave?"#ff6b3566":"#1a2a44",color:canSave?"#ff6b35":"#4a5a6a",opacity:saving?.7:1}}>
                {saving?"⏳ ENREGISTREMENT...":"💳 ENREGISTRER LA DÉPENSE"}
              </button>
            </>}

            {tab==="historique" && <>
              {history.length===0 ? (
                <div style={{textAlign:"center",padding:"48px 20px"}}>
                  <div style={{fontSize:40,marginBottom:12,opacity:.4}}>📜</div>
                  <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:14,letterSpacing:1}}>Aucune dépense enregistrée</div>
                </div>
              ) : (
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:12,letterSpacing:1}}>{history.length} DÉPENSE{history.length>1?"S":""} · TOTAL {fmt(history.reduce((a,h)=>a+h.amount,0))} aUEC</div>
                    <button onClick={()=>{setHistory([]);try{localStorage.removeItem("depenses_history")}catch{}}} style={{...S.dangerBtn,fontSize:11,padding:"3px 10px"}}>🗑 Vider</button>
                  </div>
                  {history.map(h=>(
                    <div key={h.id} style={{background:"#0a1628",border:"1px solid #1a2a4488",borderRadius:10,padding:"12px 14px",marginBottom:8,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div>
                        <div style={{color:"#e8f4ff",fontFamily:"'Rajdhani',sans-serif",fontSize:14,fontWeight:600}}>{h.label}</div>
                        <div style={{display:"flex",gap:8,alignItems:"center",marginTop:3}}>
                          <span style={{color:h.whoColor,fontFamily:"'Orbitron',sans-serif",fontSize:10,fontWeight:700}}>{h.who}</span>
                          <span style={{color:"#4a5a6a",fontFamily:"'Rajdhani',sans-serif",fontSize:10}}>{h.date}</span>
                        </div>
                      </div>
                      <div style={{color:"#ff6b35",fontFamily:"'Orbitron',sans-serif",fontSize:15,fontWeight:700,whiteSpace:"nowrap"}}>−{fmt(h.amount)}</div>
                    </div>
                  ))}
                </>
              )}
            </>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}


// ─── VIREMENT TILE ────────────────────────────────────────────────────────────
function VirementCanvas() {
  const ref = useRef(null);
  const raf = useRef(null);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvas.offsetWidth  * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);
    const w = canvas.offsetWidth, h = canvas.offsetHeight;
    const cx = w/2, cy = h/2, R = Math.min(w,h)*0.38;
    let t = 0;
    const pts = Array.from({length:40},(_,i)=>({ a:(i/40)*Math.PI*2, sp:0.009+Math.random()*0.006, r:R*(0.6+Math.random()*0.5), sz:1+Math.random()*2, c:Math.random()>.5?"#00d4ff":"#00ff9d", ti:(Math.random()-.5)*.5 }));
    function frame(){
      t+=0.018; ctx.clearRect(0,0,w,h);
      [R*1.1,R*0.75,R*0.45].forEach((rr,i)=>{
        const g=ctx.createRadialGradient(cx,cy,0,cx,cy,rr);
        g.addColorStop(0,`rgba(0,212,255,${0.12-i*0.03})`); g.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,rr,0,Math.PI*2); ctx.fill();
      });
      ctx.save(); ctx.translate(cx,cy);
      ctx.beginPath(); ctx.ellipse(0,0,R*0.88,R*0.26,t*0.2,0,Math.PI*2);
      const rg=ctx.createLinearGradient(-R,0,R,0);
      rg.addColorStop(0,"rgba(0,212,255,0)"); rg.addColorStop(.4,"rgba(0,212,255,.8)");
      rg.addColorStop(.6,"rgba(0,255,157,.9)"); rg.addColorStop(1,"rgba(0,212,255,0)");
      ctx.strokeStyle=rg; ctx.lineWidth=2; ctx.stroke(); ctx.restore();
      pts.forEach(p=>{
        p.a+=p.sp;
        const x=cx+Math.cos(p.a)*p.r, y=cy+Math.sin(p.a)*p.r*0.26;
        const d=(Math.sin(p.a)+1)/2, al=0.3+d*0.7, sz=p.sz*(0.4+d*0.7);
        ctx.beginPath(); ctx.arc(x,y,sz,0,Math.PI*2);
        ctx.fillStyle=p.c==="#00d4ff"?`rgba(0,212,255,${al})`:`rgba(0,255,157,${al})`;
        ctx.fill();
      });
      const sg=ctx.createRadialGradient(cx-R*.06,cy-R*.06,0,cx,cy,R*0.2);
      sg.addColorStop(0,"rgba(200,245,255,.95)"); sg.addColorStop(.4,"rgba(0,212,255,.8)"); sg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(cx,cy,R*0.2,0,Math.PI*2); ctx.fillStyle=sg; ctx.fill();
      ctx.font=`bold ${Math.round(R*.2)}px Orbitron,monospace`; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle="rgba(255,255,255,.95)"; ctx.shadowColor="#00d4ff"; ctx.shadowBlur=14;
      ctx.fillText("aUEC",cx,cy+1); ctx.shadowBlur=0;
      raf.current=requestAnimationFrame(frame);
    }
    frame();
    return ()=>cancelAnimationFrame(raf.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  return <canvas ref={ref} style={{width:"100%",height:"100%",display:"block"}}/>;
}

function VirementTile({ profiles, setProfiles, isDesktop }) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("virement");
  const [from, setFrom] = useState("");
  const [to,   setTo]   = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [success, setSuccess] = useState(null);
  const [hov, setHov] = useState(false);
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem("virement_history") || "[]"); }
    catch { return []; }
  });
  const canvasRef = useRef(null);
  const rafRef    = useRef(null);

  useEffect(() => {
    if (profiles.length >= 2) {
      if (!from) setFrom(profiles[0].id);
      if (!to)   setTo(profiles[1].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profiles]);

  // Animation canvas tuile
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    let w, h, t = 0;
    function resize() {
      w = canvas.offsetWidth; h = canvas.offsetHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.scale(dpr, dpr);
    }
    resize();
    const cx = ()=>w/2, cy = ()=>h/2, R = ()=>Math.min(w,h)*0.36;
    const pts = Array.from({length:24},(_,i)=>({ a:(i/24)*Math.PI*2, sp:0.01+Math.random()*0.007, r:()=>R()*(0.55+Math.random()*0.5), sz:1+Math.random()*2.5, c:Math.random()>.5?"#00d4ff":"#00ff9d" }));
    function frame(){
      t+=0.02; ctx.clearRect(0,0,w,h);
      const CX=cx(),CY=cy(),RR=R();
      const bg=ctx.createRadialGradient(CX,CY,0,CX,CY,RR);
      bg.addColorStop(0,"rgba(0,212,255,0.15)"); bg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=bg; ctx.beginPath(); ctx.arc(CX,CY,RR,0,Math.PI*2); ctx.fill();
      ctx.save(); ctx.translate(CX,CY);
      ctx.beginPath(); ctx.ellipse(0,0,RR*0.85,RR*0.25,t*0.18,0,Math.PI*2);
      const rg=ctx.createLinearGradient(-RR,0,RR,0);
      rg.addColorStop(0,"rgba(0,212,255,0)"); rg.addColorStop(.4,"rgba(0,212,255,.9)");
      rg.addColorStop(.6,"rgba(0,255,157,1)"); rg.addColorStop(1,"rgba(0,212,255,0)");
      ctx.strokeStyle=rg; ctx.lineWidth=2.5; ctx.stroke(); ctx.restore();
      pts.forEach(p=>{ p.a+=p.sp; const PR=p.r(); const x=CX+Math.cos(p.a)*PR,y=CY+Math.sin(p.a)*PR*0.25; const d=(Math.sin(p.a)+1)/2,al=0.25+d*0.75,sz=p.sz*(0.4+d*0.6); ctx.beginPath();ctx.arc(x,y,sz,0,Math.PI*2); ctx.fillStyle=p.c==="#00d4ff"?`rgba(0,212,255,${al})`:`rgba(0,255,157,${al})`; ctx.fill(); });
      const sg=ctx.createRadialGradient(CX-RR*.07,CY-RR*.07,0,CX,CY,RR*0.22);
      sg.addColorStop(0,"rgba(210,248,255,.98)"); sg.addColorStop(.35,"rgba(0,212,255,.85)"); sg.addColorStop(1,"rgba(0,0,0,0)");
      ctx.beginPath(); ctx.arc(CX,CY,RR*0.22,0,Math.PI*2); ctx.fillStyle=sg; ctx.fill();
      ctx.font=`bold ${Math.round(RR*.16)}px Orbitron,monospace`; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.fillStyle="rgba(255,255,255,.98)"; ctx.shadowColor="#00d4ff"; ctx.shadowBlur=16;
      ctx.fillText("₵",CX,CY+1); ctx.shadowBlur=0;
      rafRef.current=requestAnimationFrame(frame);
    }
    frame();
    return ()=>cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const fromP = profiles.find(p=>p.id===from);
  const toP   = profiles.find(p=>p.id===to);
  const num   = parseFloat(amount)||0;
  const fee   = Math.round(num*0.005);
  const total = num+fee;
  const canSend = num>0 && from && to && from!==to && fromP && fromP.aUEC>=total;

  function doVirement() {
    if (!canSend) return;
    setSending(true);
    setTimeout(()=>{
      const fromName = fromP?.name || from;
      const toName   = toP?.name   || to;
      setProfiles(prev=>prev.map(p=>{ if(p.id===from) return{...p,aUEC:p.aUEC-total}; if(p.id===to) return{...p,aUEC:p.aUEC+num}; return p; }));
      const entry = { id: Date.now(), date: new Date().toLocaleString("fr-FR"), from: fromName, to: toName, fromColor: fromP?.color||"#00d4ff", toColor: toP?.color||"#00ff9d", net: num, fee, total };
      setHistory(prev => {
        const next = [entry, ...prev].slice(0, 50);
        try { localStorage.setItem("virement_history", JSON.stringify(next)); } catch {}
        return next;
      });
      setSuccess({net:num,fee}); setSending(false); setAmount("");
      setTimeout(()=>{ setSuccess(null); setOpen(false); }, 3200);
    },900);
  }

  const tileBase = { position:"relative", background:"#07111fcc", border:`1px solid ${hov?"#00ff9d77":"#00ff9d33"}`, borderRadius:12, transition:"all .25s", backdropFilter:"blur(8px)", cursor:"pointer", overflow:"hidden", boxShadow:hov?"0 0 32px #00ff9d88,0 0 8px #00ff9d44 inset":"0 0 12px #00ff9d33" };

  return (
    <>
      {isDesktop ? (
        <div style={{...tileBase, padding:"20px 14px", textAlign:"center", transform:hov?"scale(1.04) translateY(-2px)":"scale(1)"}}
          onClick={()=>setOpen(true)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
          <canvas ref={canvasRef} style={{width:"100%",height:110,display:"block",borderRadius:8,marginBottom:8}}/>
          <div style={{color:"#00ff9d",fontSize:13,fontFamily:"'Rajdhani',sans-serif",letterSpacing:2,textTransform:"uppercase"}}>VIREMENT</div>
          <div style={{color:"#e8f4ff",fontSize:24,fontWeight:700,fontFamily:"'Orbitron',sans-serif",margin:"3px 0"}}>aUEC</div>
          <div style={{color:"#8899bb",fontSize:12,fontFamily:"'Rajdhani',sans-serif"}}>Transfert direct</div>
        </div>
      ) : (
        <div style={{...tileBase, padding:"16px 18px", display:"flex", alignItems:"center", gap:16, transform:hov?"scale(1.01)":"scale(1)"}}
          onClick={()=>setOpen(true)} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
          <canvas ref={canvasRef} style={{width:90,height:90,display:"block",flexShrink:0,borderRadius:10}}/>
          <div style={{flex:1}}>
            <div style={{color:"#00ff9d",fontSize:13,fontFamily:"'Rajdhani',sans-serif",letterSpacing:2,textTransform:"uppercase",marginBottom:2}}>VIREMENT</div>
            <div style={{color:"#e8f4ff",fontSize:22,fontWeight:700,fontFamily:"'Orbitron',sans-serif",marginBottom:2}}>aUEC</div>
            <div style={{color:"#8899bb",fontSize:12,fontFamily:"'Rajdhani',sans-serif"}}>Transfert direct entre pilotes</div>
          </div>
          <div style={{color:"#00ff9d",fontSize:28,opacity:0.6}}>→</div>
        </div>
      )}

      {open && (
        <div style={S.modalOverlay} onClick={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
          <div style={{...S.modalBox,maxWidth:480}}>
            <div style={S.modalHeader}>
              <div style={S.modalTitle}>💸 VIREMENT aUEC</div>
              <button onClick={()=>setOpen(false)} style={S.closeBtn}>✕</button>
            </div>
            {/* Onglets */}
            <div style={{display:"flex",borderBottom:"1px solid #1a2a44",background:"#050e1d"}}>
              {[["virement","💸 Virement"],["historique","📜 Historique"]].map(([id,label])=>(
                <button key={id} onClick={()=>setActiveTab(id)} style={{flex:1,padding:"12px 0",background:"transparent",border:"none",borderBottom:`2px solid ${activeTab===id?"#00ff9d":"transparent"}`,color:activeTab===id?"#00ff9d":"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:13,fontWeight:700,letterSpacing:1.5,cursor:"pointer",transition:"all .2s",textTransform:"uppercase"}}>
                  {label}
                </button>
              ))}
            </div>
            <div style={S.modalBody}>
            {activeTab==="virement" && <>
              {/* Canvas animé modal */}
              <div style={{position:"relative",width:"100%",height:130,borderRadius:12,overflow:"hidden",marginBottom:18,background:"#030b1a",border:"1px solid #00ff9d22"}}>
                <VirementCanvas/>
                {fromP&&toP&&(
                  <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 20px",pointerEvents:"none"}}>
                    <div style={{textAlign:"center"}}>
                      <div style={{width:46,height:46,borderRadius:"50%",border:`2px solid ${fromP.color}`,background:fromP.avatar?`url(${fromP.avatar}) center/cover`:`radial-gradient(circle,${fromP.color}44,#0a1628)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,margin:"0 auto 4px",boxShadow:`0 0 14px ${fromP.color}66`}}>{!fromP.avatar&&"👤"}</div>
                      <div style={{color:fromP.color,fontFamily:"'Orbitron',sans-serif",fontSize:10,fontWeight:700,letterSpacing:1}}>{fromP.name}</div>
                      <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:10}}>{fmt(fromP.aUEC)} aUEC</div>
                    </div>
                    <div style={{flex:1,textAlign:"center"}}>
                      <div style={{color:"#00ff9d",fontSize:28,lineHeight:1}}>→</div>
                      {num>0&&<div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:11,fontWeight:700,marginTop:2}}>{fmt(num)}</div>}
                    </div>
                    <div style={{textAlign:"center"}}>
                      <div style={{width:46,height:46,borderRadius:"50%",border:`2px solid ${toP.color}`,background:toP.avatar?`url(${toP.avatar}) center/cover`:`radial-gradient(circle,${toP.color}44,#0a1628)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,margin:"0 auto 4px",boxShadow:`0 0 14px ${toP.color}66`}}>{!toP.avatar&&"👤"}</div>
                      <div style={{color:toP.color,fontFamily:"'Orbitron',sans-serif",fontSize:10,fontWeight:700,letterSpacing:1}}>{toP.name}</div>
                      <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:10}}>{fmt(toP.aUEC)} aUEC</div>
                    </div>
                  </div>
                )}
              </div>

              <label style={S.label}>De (expéditeur)</label>
              <select value={from} onChange={e=>{const v=e.target.value;setFrom(v);if(v===to)setTo(profiles.find(p=>p.id!==v)?.id||"");}} style={S.input}>
                {profiles.map(p=><option key={p.id} value={p.id}>{p.name} — {fmt(p.aUEC)} aUEC</option>)}
              </select>

              <label style={S.label}>Vers (destinataire)</label>
              <select value={to} onChange={e=>{const v=e.target.value;setTo(v);if(v===from)setFrom(profiles.find(p=>p.id!==v)?.id||"");}} style={S.input}>
                {profiles.map(p=><option key={p.id} value={p.id}>{p.name} — {fmt(p.aUEC)} aUEC</option>)}
              </select>

              <label style={S.label}>Montant (aUEC)</label>
              <input type="number" value={amount} onChange={e=>setAmount(e.target.value)} style={S.input} placeholder="Ex: 50 000" min="1"/>

              {num>0&&(
                <div style={{background:"#07111f",border:"1px solid #00ff9d22",borderRadius:10,padding:"12px 16px",marginTop:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:13}}>Montant reçu par {toP?.name}</span>
                    <span style={{color:"#e8f4ff",fontFamily:"'Orbitron',sans-serif",fontSize:13,fontWeight:700}}>{fmt(num)} aUEC</span>
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                    <span style={{color:"#ff6b35",fontFamily:"'Rajdhani',sans-serif",fontSize:13}}>⚠️ Frais de service (0,5%)</span>
                    <span style={{color:"#ff6b35",fontFamily:"'Orbitron',sans-serif",fontSize:13,fontWeight:700}}>−{fmt(fee)} aUEC</span>
                  </div>
                  <div style={{height:1,background:"#1a2a44",margin:"8px 0"}}/>
                  <div style={{display:"flex",justifyContent:"space-between"}}>
                    <span style={{color:"#00ff9d",fontFamily:"'Rajdhani',sans-serif",fontSize:14,fontWeight:700}}>Total débité de {fromP?.name}</span>
                    <span style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:14,fontWeight:700}}>{fmt(total)} aUEC</span>
                  </div>
                  {fromP&&total>fromP.aUEC&&(
                    <div style={{color:"#ff4466",fontFamily:"'Rajdhani',sans-serif",fontSize:12,marginTop:6}}>⛔ Solde insuffisant — disponible : {fmt(fromP.aUEC)} aUEC</div>
                  )}
                </div>
              )}

              {success&&(
                <div style={{background:"#00ff9d11",border:"1px solid #00ff9d55",borderRadius:10,padding:"14px",marginTop:12,textAlign:"center",animation:"fadeIn .3s ease"}}>
                  <div style={{fontSize:30,marginBottom:6}}>✅</div>
                  <div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:14,fontWeight:700}}>Virement effectué !</div>
                  <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:12,marginTop:4}}>{fmt(success.net)} aUEC transférés · Frais prélevés : {fmt(success.fee)} aUEC</div>
                </div>
              )}

              <button onClick={doVirement} disabled={!canSend||sending} style={{...S.primaryBtn,marginTop:14,background:canSend?"linear-gradient(135deg,#00ff9d22,#0a1628)":"#0a1628",borderColor:canSend?"#00ff9d66":"#1a2a44",color:canSend?"#00ff9d":"#4a5a6a",opacity:sending?.7:1}}>
                {sending?"⏳ TRANSFERT EN COURS...":"💸 CONFIRMER LE VIREMENT"}
              </button>
            </>}
            </div>}

            {/* ── ONGLET HISTORIQUE ── */}
            {activeTab==="historique" && <div style={{...S.modalBody, paddingTop:8}}>
              {history.length===0 ? (
                <div style={{textAlign:"center",padding:"48px 20px"}}>
                  <div style={{fontSize:40,marginBottom:12,opacity:.4}}>📜</div>
                  <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:14,letterSpacing:1}}>Aucun virement effectué</div>
                </div>
              ) : (
                <>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:12,letterSpacing:1}}>{history.length} TRANSACTION{history.length>1?"S":""}</div>
                    <button onClick={()=>{setHistory([]);try{localStorage.removeItem("virement_history")}catch{}}} style={{...S.dangerBtn,fontSize:11,padding:"3px 10px"}}>🗑 Vider</button>
                  </div>
                  {history.map((h,i)=>(
                    <div key={h.id} style={{background:"#0a1628",border:"1px solid #1a2a4488",borderRadius:10,padding:"12px 14px",marginBottom:8,animation:`fadeIn .${3+i%5}s ease`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                        <div style={{display:"flex",alignItems:"center",gap:8}}>
                          <span style={{color:h.fromColor,fontFamily:"'Orbitron',sans-serif",fontSize:11,fontWeight:700}}>{h.from}</span>
                          <span style={{color:"#00ff9d",fontSize:14}}>→</span>
                          <span style={{color:h.toColor,fontFamily:"'Orbitron',sans-serif",fontSize:11,fontWeight:700}}>{h.to}</span>
                        </div>
                        <div style={{color:"#4a5a6a",fontFamily:"'Rajdhani',sans-serif",fontSize:10}}>{h.date}</div>
                      </div>
                      <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                        <div style={{flex:1,background:"#07111f",borderRadius:6,padding:"5px 10px",border:"1px solid #00ff9d22"}}>
                          <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:10,letterSpacing:1}}>REÇU</div>
                          <div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:13,fontWeight:700}}>{fmt(h.net)} aUEC</div>
                        </div>
                        <div style={{flex:1,background:"#07111f",borderRadius:6,padding:"5px 10px",border:"1px solid #ff6b3522"}}>
                          <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:10,letterSpacing:1}}>FRAIS</div>
                          <div style={{color:"#ff6b35",fontFamily:"'Orbitron',sans-serif",fontSize:13,fontWeight:700}}>−{fmt(h.fee)} aUEC</div>
                        </div>
                        <div style={{flex:1,background:"#07111f",borderRadius:6,padding:"5px 10px",border:"1px solid #00d4ff22"}}>
                          <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:10,letterSpacing:1}}>DÉBITÉ</div>
                          <div style={{color:"#00d4ff",fontFamily:"'Orbitron',sans-serif",fontSize:13,fontWeight:700}}>{fmt(h.total)} aUEC</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>}

          </div>
        </div>
      )}
    </>
  );
}


// ─── MONEY BOX (argent joueur, style bannière) ────────────────────────────────
function hexToRgb(hex){
  let h=(hex||"#00d4ff").replace("#","");
  if(h.length===3) h=h.split("").map(x=>x+x).join("");
  const n=parseInt(h,16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}

// ─── FORTUNE AMOUNT (auto-fit, néon jaune) ────────────────────────────────────
function FortuneAmount({ amount, isDesktop }) {
  const boxRef = useRef(null);
  const numRef = useRef(null);
  const [fs, setFs] = useState(isDesktop ? 26 : 18);
  useEffect(() => {
    const fit = () => {
      const box = boxRef.current, num = numRef.current;
      if (!box || !num) return;
      const avail = box.clientWidth;
      if (avail <= 0) return;
      const maxF = isDesktop ? 32 : 30;
      const minF = isDesktop ? 14 : 14;
      num.style.fontSize = maxF + "px";
      const wAt = num.scrollWidth;
      let target = maxF;
      if (wAt > avail) target = Math.max(minF, Math.floor(maxF * avail / wAt));
      num.style.fontSize = target + "px";
      setFs(target);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, isDesktop]);
  return (
    <div ref={boxRef} style={{width:"100%",textAlign:isDesktop?"right":"center",overflow:"hidden"}}>
      <span ref={numRef} style={{
        display:"inline-block", color:"#ffffff", fontFamily:"'Orbitron',sans-serif",
        fontWeight:800, fontSize:fs, whiteSpace:"nowrap", letterSpacing:0.5,
        animation:"fortuneBreath 4s ease-in-out infinite"
      }}>{fmt(amount)}<span style={{fontSize:"0.5em",color:"#ffcc00",fontWeight:700,marginLeft:"0.4em",letterSpacing:1,textShadow:"0 0 4px #ffcc0088"}}>aUEC</span></span>
    </div>
  );
}


function MoneyBox({ amount, color, isDesktop }) {
  const ref = useRef(null);
  const raf = useRef(null);
  const numRef = useRef(null);
  const boxRef = useRef(null);
  const col = color || "#00d4ff";
  const [fontSize, setFontSize] = useState(isDesktop ? 32 : 26);

  // Auto-fit : agrandit/rétrécit le nombre pour remplir sans déborder
  useEffect(() => {
    const fit = () => {
      const box = boxRef.current, num = numRef.current;
      if (!box || !num) return;
      const avail = box.clientWidth - 8;
      if (avail <= 0) return;
      const maxF = isDesktop ? 40 : 32;
      const minF = isDesktop ? 15 : 12;
      // mesure à taille de référence puis met à l'échelle
      num.style.fontSize = maxF + "px";
      const wAt = num.scrollWidth;
      let target = maxF;
      if (wAt > avail) target = Math.max(minF, Math.floor(maxF * avail / wAt));
      num.style.fontSize = target + "px";
      setFontSize(target);
    };
    fit();
    const ro = new ResizeObserver(fit);
    if (boxRef.current) ro.observe(boxRef.current);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, isDesktop]);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    function resize(){ canvas.width=canvas.offsetWidth*dpr; canvas.height=canvas.offsetHeight*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    resize();
    const [r,g,b]=hexToRgb(col);
    let t = 0;
    const coins = Array.from({length:16},(_,i)=>({ x:Math.random(), y:Math.random(), sp:0.0008+Math.random()*0.0014, sz:1.1+Math.random()*2.4, ph:Math.random()*6 }));
    function frame(){
      const w=canvas.offsetWidth, h=canvas.offsetHeight;
      t+=0.016; ctx.clearRect(0,0,w,h);
      const gx=(Math.sin(t*0.3)*0.5+0.5)*w;
      const grd=ctx.createRadialGradient(gx,h/2,0,gx,h/2,w*0.5);
      grd.addColorStop(0,`rgba(${r},${g},${b},0.08)`); grd.addColorStop(1,"transparent");
      ctx.fillStyle=grd; ctx.fillRect(0,0,w,h);
      coins.forEach(c=>{ c.y-=c.sp; if(c.y<-0.05){ c.y=1.05; c.x=Math.random(); }
        const px=c.x*w, py=c.y*h;
        const al=0.15+0.25*Math.abs(Math.sin(t*1.5+c.ph));
        ctx.save(); ctx.translate(px,py); ctx.scale(1,0.5+0.5*Math.abs(Math.sin(t*2+c.ph)));
        ctx.beginPath(); ctx.arc(0,0,c.sz,0,Math.PI*2);
        ctx.fillStyle=`rgba(${r},${g},${b},${al})`; ctx.strokeStyle=`rgba(${Math.min(r+80,255)},${Math.min(g+80,255)},${Math.min(b+80,255)},${al})`; ctx.lineWidth=0.6;
        ctx.fill(); ctx.stroke(); ctx.restore();
      });
      const sx=((t*0.15)%1)*w;
      const lg=ctx.createLinearGradient(sx-26,0,sx+26,0);
      lg.addColorStop(0,"transparent"); lg.addColorStop(0.5,`rgba(${r},${g},${b},0.10)`); lg.addColorStop(1,"transparent");
      ctx.fillStyle=lg; ctx.fillRect(sx-26,0,52,h);
      raf.current=requestAnimationFrame(frame);
    }
    frame();
    return ()=>cancelAnimationFrame(raf.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[col]);

  return (
    <div style={{position:"relative",overflow:"hidden",borderRadius:10,background:"linear-gradient(135deg,#0a1424,#0a0e18)",border:`1px solid ${col}55`,boxShadow:`0 0 14px ${col}33`,padding:isDesktop?"14px 18px":"12px 14px",display:"flex",alignItems:"center",gap:isDesktop?16:12}}>
      <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>
      <div style={{position:"relative",flexShrink:0}}><TileIcon kind="gold" color={col} size={isDesktop?44:36}/></div>
      <div ref={boxRef} style={{position:"relative",minWidth:0,flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center"}}>
        <div style={{color:col,fontFamily:"'Rajdhani',sans-serif",fontSize:isDesktop?12:11,letterSpacing:3,textTransform:"uppercase",fontWeight:600,marginBottom:2}}>aUEC</div>
        <div ref={numRef} style={{color:"#eafff5",fontFamily:"'Orbitron',sans-serif",fontSize:fontSize,fontWeight:800,whiteSpace:"nowrap",lineHeight:1,animation:"neonBreath 3.5s ease-in-out infinite","--mc":col}}>{fmt(amount)}</div>
      </div>
    </div>
  );
}

// ─── SHIP TILE (vaisseau + fond hyperespace) ──────────────────────────────────
function ShipTile({ shipName, color, isDesktop, onClick }) {
  const ref = useRef(null);
  const raf = useRef(null);
  const [hov, setHov] = useState(false);
  const col = color || "#00d4ff";
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    function resize(){ canvas.width=canvas.offsetWidth*dpr; canvas.height=canvas.offsetHeight*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    resize();
    const [r,g,b]=hexToRgb(col);
    let W=canvas.offsetWidth, H=canvas.offsetHeight;
    // étoiles hyperespace partant du centre
    let stars=[];
    function seed(){ W=canvas.offsetWidth; H=canvas.offsetHeight; stars=Array.from({length:70},()=>spawn()); }
    function spawn(){ const a=Math.random()*Math.PI*2; return { a, dist:Math.random()*Math.min(W,H)*0.5, sp:0.8+Math.random()*3.2, len:0 }; }
    seed();
    function frame(){
      W=canvas.offsetWidth; H=canvas.offsetHeight;
      const cx=W/2, cy=H/2;
      // fond sombre dégradé
      ctx.fillStyle="rgba(4,9,20,0.35)"; ctx.fillRect(0,0,W,H);
      // tunnel lumineux central
      const tg=ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(W,H)*0.5);
      tg.addColorStop(0,`rgba(${r},${g},${b},0.12)`); tg.addColorStop(0.5,`rgba(${r},${g},${b},0.03)`); tg.addColorStop(1,"transparent");
      ctx.fillStyle=tg; ctx.fillRect(0,0,W,H);
      // étoiles streak
      stars.forEach(s=>{
        s.dist+=s.sp*(1+s.dist*0.012);
        const x=cx+Math.cos(s.a)*s.dist, y=cy+Math.sin(s.a)*s.dist;
        const px=cx+Math.cos(s.a)*(s.dist-s.sp*6), py=cy+Math.sin(s.a)*(s.dist-s.sp*6);
        const edge=Math.max(W,H)*0.6;
        const al=Math.min(1, s.dist/edge*1.4);
        ctx.strokeStyle=`rgba(${Math.min(r+120,255)},${Math.min(g+120,255)},${Math.min(b+120,255)},${al*0.9})`;
        ctx.lineWidth=Math.min(2.2, 0.5+s.dist*0.012);
        ctx.beginPath(); ctx.moveTo(px,py); ctx.lineTo(x,y); ctx.stroke();
        if(s.dist>edge){ Object.assign(s, spawn(), {dist:Math.random()*8}); }
      });
      raf.current=requestAnimationFrame(frame);
    }
    frame();
    const ro=new ResizeObserver(seed); ro.observe(canvas);
    return ()=>{ cancelAnimationFrame(raf.current); ro.disconnect(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[col]);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position:"relative", overflow:"hidden", borderRadius:10,
        background: hov ? `linear-gradient(135deg,${col}18,#070d18)` : "#070d18",
        border:`1px solid ${hov ? col : col+"44"}`,
        boxShadow: hov ? `0 0 28px ${col}77, 0 0 8px ${col}44 inset` : `0 0 12px ${col}22`,
        padding:isDesktop?"8px 10px 10px":"6px 8px 8px",
        display:"flex", flexDirection:"column", alignItems:"center",
        cursor: onClick ? "pointer" : "default",
        transform: hov ? "translateY(-3px) scale(1.02)" : "none",
        transition:"all .25s cubic-bezier(.4,0,.2,1)",
      }}>
      <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>
      {/* Overlay lumineux au hover */}
      {hov && <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse at 50% 60%, ${col}22 0%, transparent 70%)`,pointerEvents:"none",transition:"opacity .25s"}}/>}
      <div style={{position:"relative",width:"100%",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <div style={{color:col,fontFamily:"'Rajdhani',sans-serif",fontSize:isDesktop?12:11,letterSpacing:3,textTransform:"uppercase",fontWeight:600}}>Vaisseau</div>
        {onClick && <div style={{color:col,fontFamily:"'Rajdhani',sans-serif",fontSize:isDesktop?11:10,letterSpacing:1,opacity: hov ? 1 : 0,transition:"opacity .2s",display:"flex",alignItems:"center",gap:4}}>
          <span style={{fontSize:12}}>🚀</span> HANGAR
        </div>}
      </div>
      <div style={{position:"relative",transform: hov ? "scale(1.08)" : "scale(1)", transition:"transform .3s cubic-bezier(.4,0,.2,1)"}}>
        <ShipBadge3D shipName={shipName} color={col} size={isDesktop?58:46}/>
      </div>
      <div style={{position:"relative",color:"#eafdff",fontFamily:"'Orbitron',sans-serif",fontSize:isDesktop?17:14,fontWeight:700,lineHeight:1.1,textAlign:"center",wordBreak:"break-word",width:"100%",letterSpacing:0.5,textShadow: hov ? `0 0 18px ${col}, 0 0 8px ${col}` : `0 0 10px ${col}66`,transition:"text-shadow .25s"}}>{shipName}</div>
    </div>
  );
}


// ─── MONEY BANNER (Total Gagné en long) ───────────────────────────────────────
function MoneyBanner({ totalEarned, profiles, onClick, isDesktop }) {
  const ref = useRef(null);
  const raf = useRef(null);
  const [hov, setHov] = useState(false);

  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    function resize(){ canvas.width=canvas.offsetWidth*dpr; canvas.height=canvas.offsetHeight*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    resize();
    let t = 0;
    const coins = Array.from({length:26},(_,i)=>({ x:Math.random(), y:Math.random(), sp:0.0008+Math.random()*0.0014, sz:1.5+Math.random()*3, ph:Math.random()*6 }));
    function frame(){
      const w=canvas.offsetWidth, h=canvas.offsetHeight;
      t+=0.016; ctx.clearRect(0,0,w,h);
      // dégradé doré diffus en mouvement
      const gx = (Math.sin(t*0.3)*0.5+0.5)*w;
      const g = ctx.createRadialGradient(gx,h/2,0,gx,h/2,w*0.5);
      g.addColorStop(0,"rgba(255,204,0,0.10)"); g.addColorStop(1,"transparent");
      ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
      // pièces flottantes
      coins.forEach(c=>{ c.y-=c.sp; if(c.y<-0.05){ c.y=1.05; c.x=Math.random(); }
        const px=c.x*w, py=c.y*h;
        const al=0.2+0.3*Math.abs(Math.sin(t*1.5+c.ph));
        ctx.save(); ctx.translate(px,py); ctx.scale(1,0.5+0.5*Math.abs(Math.sin(t*2+c.ph)));
        ctx.beginPath(); ctx.arc(0,0,c.sz,0,Math.PI*2);
        ctx.fillStyle=`rgba(255,204,0,${al})`; ctx.strokeStyle=`rgba(255,160,40,${al})`; ctx.lineWidth=0.8;
        ctx.fill(); ctx.stroke(); ctx.restore();
      });
      // ligne énergie qui balaie
      const sx=((t*0.15)%1)*w;
      const lg=ctx.createLinearGradient(sx-40,0,sx+40,0);
      lg.addColorStop(0,"transparent"); lg.addColorStop(0.5,"rgba(255,220,80,0.12)"); lg.addColorStop(1,"transparent");
      ctx.fillStyle=lg; ctx.fillRect(sx-40,0,80,h);
      raf.current=requestAnimationFrame(frame);
    }
    frame();
    return ()=>cancelAnimationFrame(raf.current);
  },[]);

  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ position:"relative", overflow:"hidden", cursor:"pointer", borderRadius:14,
        background:"linear-gradient(135deg,#0a1424,#0e0a04)", border:`1px solid ${hov?"#ffcc00":"#ffcc0055"}`,
        boxShadow:hov?"0 0 36px #ffcc0066, 0 0 8px #ffcc0044 inset":"0 0 16px #ffcc0022",
        transition:"all .25s", transform:hov?"translateY(-2px)":"none",
        marginBottom:isDesktop?18:14, padding:isDesktop?"18px 28px":"16px 18px",
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:16 }}>
      <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>
      <div style={{position:"relative",display:"flex",alignItems:"center",gap:isDesktop?20:14,minWidth:0}}>
        <div style={{flexShrink:0}}><TileIcon kind="gold" color="#ffcc00" size={isDesktop?60:48}/></div>
        <div style={{minWidth:0}}>
          <div style={{color:"#ffcc00",fontFamily:"'Rajdhani',sans-serif",fontSize:isDesktop?14:12,letterSpacing:3,textTransform:"uppercase",fontWeight:600}}>Total Gagné</div>
          <div style={{color:"#fff",fontFamily:"'Orbitron',sans-serif",fontSize:isDesktop?34:26,fontWeight:900,textShadow:"0 0 18px #ffcc0088",letterSpacing:isDesktop?0:-0.5,whiteSpace:"nowrap"}}>{fmt(totalEarned)} <span style={{fontSize:isDesktop?18:14,color:"#ffcc00aa"}}>aUEC</span></div>
        </div>
      </div>
      <div style={{position:"relative",display:isDesktop?"flex":"none",gap:14,flexShrink:0}}>
        {profiles.map(p=>(
          <div key={p.id} style={{textAlign:"right"}}>
            <div style={{color:p.color,fontFamily:"'Orbitron',sans-serif",fontSize:12,fontWeight:700}}>{p.name}</div>
            <div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:15,fontWeight:700}}>{fmt(p.aUEC)}</div>
          </div>
        ))}
        <div style={{color:"#ffcc0088",fontSize:22,alignSelf:"center"}}>→</div>
      </div>
    </div>
  );
}

// ─── CALC TILE (raccourci calculatrice) ───────────────────────────────────────
function CalcTile({ onClick, isDesktop }) {
  const ref = useRef(null);
  const raf = useRef(null);
  const [hov, setHov] = useState(false);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    function resize(){ canvas.width=canvas.offsetWidth*dpr; canvas.height=canvas.offsetHeight*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    const ctx = canvas.getContext("2d");
    resize();
    let t = 0;
    const col = "#a78bfa";
    function frame(){
      const w=canvas.offsetWidth,h=canvas.offsetHeight,cx=w/2,cy=h/2,R=Math.min(w,h)*0.36;
      t+=0.02; ctx.clearRect(0,0,w,h);
      const g=ctx.createRadialGradient(cx,cy,0,cx,cy,R);
      g.addColorStop(0,`rgba(167,139,250,${0.14+0.06*Math.sin(t*0.05)})`); g.addColorStop(1,"transparent");
      ctx.fillStyle=g; ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2); ctx.fill();
      // calculatrice stylisée
      ctx.save(); ctx.translate(cx,cy);
      ctx.rotate(Math.sin(t*0.02)*0.05);
      ctx.shadowColor=col; ctx.shadowBlur=12; ctx.strokeStyle=col; ctx.lineWidth=1.6; ctx.fillStyle=col+"1e";
      ctx.beginPath(); ctx.roundRect(-R*0.6,-R*0.8,R*1.2,R*1.6,5); ctx.fill(); ctx.stroke();
      // écran
      const sa=0.5+0.5*Math.sin(t*0.08);
      ctx.fillStyle=`rgba(167,139,250,${0.3+sa*0.4})`; ctx.shadowBlur=8;
      ctx.beginPath(); ctx.roundRect(-R*0.42,-R*0.62,R*0.84,R*0.34,2); ctx.fill();
      // boutons
      ctx.shadowBlur=4;
      for(let r=0;r<3;r++)for(let cc=0;cc<3;cc++){
        const bx=-R*0.36+cc*R*0.36, by=-R*0.05+r*R*0.32;
        const lit=(Math.sin(t*0.1+r*1.3+cc*0.7)+1)/2;
        ctx.fillStyle=`rgba(167,139,250,${0.2+lit*0.5})`;
        ctx.beginPath(); ctx.arc(bx,by,R*0.08,0,Math.PI*2); ctx.fill();
      }
      ctx.restore();
      raf.current=requestAnimationFrame(frame);
    }
    frame();
    return ()=>cancelAnimationFrame(raf.current);
  },[]);

  const base = { position:"relative", background:"#07111fcc", border:`1px solid ${hov?"#a78bfa99":"#a78bfa44"}`, borderRadius:12, transition:"all .25s", backdropFilter:"blur(8px)", cursor:"pointer", overflow:"hidden", boxShadow:hov?"0 0 32px #a78bfa88,0 0 8px #a78bfa44 inset":"0 0 12px #a78bfa33" };
  return isDesktop ? (
    <div style={{...base, padding:"22px 14px", textAlign:"center", transform:hov?"scale(1.04) translateY(-2px)":"scale(1)"}}
      onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <canvas ref={ref} style={{width:"100%",height:64,display:"block",marginBottom:8}}/>
      <div style={{color:"#a78bfa",fontSize:15,fontFamily:"'Rajdhani',sans-serif",letterSpacing:1.5,textTransform:"uppercase",fontWeight:600,whiteSpace:"nowrap"}}>Calculatrice</div>
      <div style={{color:"#e8f4ff",fontSize:26,fontWeight:700,fontFamily:"'Orbitron',sans-serif",margin:"5px 0"}}>=</div>
      <div style={{color:"#8899bb",fontSize:13,fontFamily:"'Rajdhani',sans-serif"}}>Calcul rapide</div>
    </div>
  ) : (
    <div style={{...base, padding:"16px 10px", textAlign:"center", transform:hov?"scale(1.03)":"scale(1)"}}
      onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}>
      <canvas ref={ref} style={{width:"100%",height:50,display:"block",marginBottom:6}}/>
      <div style={{color:"#a78bfa",fontSize:13,fontFamily:"'Rajdhani',sans-serif",letterSpacing:1,textTransform:"uppercase",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Calculatrice</div>
      <div style={{color:"#e8f4ff",fontSize:21,fontWeight:700,fontFamily:"'Orbitron',sans-serif",margin:"3px 0"}}>=</div>
      <div style={{color:"#8899bb",fontSize:12,fontFamily:"'Rajdhani',sans-serif"}}>Calcul</div>
    </div>
  );
}


function HexTile({ icon, iconKind, label, value, sub, color="#00d4ff", onClick, pulse, isDesktop }) {
  const [hov,setHov]=useState(false);
  return (
    <div onClick={onClick} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ ...S.hexTile, padding:isDesktop?"22px 14px":"16px 10px", borderColor:hov?color:color+"66", boxShadow:hov?`0 0 32px ${color}88,0 0 8px ${color}44 inset`:`0 0 12px ${color}33`, transform:hov?"scale(1.04) translateY(-2px)":"scale(1)", background:hov?"#0a1628dd":"#07111fcc", cursor:onClick?"pointer":"default", animation:pulse?"pulse 2s ease-in-out infinite":"none" }}>
      {iconKind
        ? <div style={{marginBottom:isDesktop?8:6}}><TileIcon kind={iconKind} color={color} size={isDesktop?56:46}/></div>
        : <div style={{fontSize:isDesktop?42:34,marginBottom:isDesktop?8:6}}>{icon}</div>}
      <div style={{color,fontSize:isDesktop?15:13,fontFamily:"'Rajdhani',sans-serif",letterSpacing:1.5,textTransform:"uppercase",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%"}}>{label}</div>
      {value!==undefined&&<div style={{color:"#e8f4ff",fontSize:isDesktop?26:21,fontWeight:700,fontFamily:"'Orbitron',sans-serif",margin:isDesktop?"5px 0":"3px 0",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:"100%",letterSpacing:-0.5}}>{value}</div>}
      {sub&&<div style={{color:"#8899bb",fontSize:isDesktop?13:12,fontFamily:"'Rajdhani',sans-serif"}}>{sub}</div>}
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
        <AnimatedAvatar
          profile={profile}
          size={isDesktop?72:56}
          onClick={onHangar}
        />
        <div onClick={onHangar} title="Ouvrir le hangar" style={{flex:1,cursor:"pointer"}}>
          <div style={{color:profile.color,fontFamily:"'Orbitron',sans-serif",fontSize:isDesktop?22:18,fontWeight:700}}>{profile.name}</div>
          <div style={{color:"#8899bb",fontSize:isDesktop?13:11,fontFamily:"'Rajdhani',sans-serif",letterSpacing:1}}>🚀 VOIR LE HANGAR</div>
        </div>
        <button onClick={onEdit} style={{...S.editBtn,borderColor:profile.color,color:profile.color,fontSize:isDesktop?15:12}}>✏️</button>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:isDesktop?12:10}}>
        <MoneyBox amount={profile.aUEC} color={profile.color} isDesktop={isDesktop}/>
        <ShipTile shipName={profile.ship} color={profile.color} isDesktop={isDesktop} onClick={onHangar}/>
      </div>
    </div>
  );
}

// ─── MISSION ITEM ─────────────────────────────────────────────────────────────
function MissionItem({ mission, profiles, onDelete, onValidate, isDesktop }) {
  const [exp,setExp]=useState(false);
  const share=Math.floor(mission.amount/2);
  const owner=profiles.find(p=>p.id===mission.assignee);
  const isPending = !mission.status || mission.status === "pending";
  return (
    <div style={{...S.missionItem,padding:isDesktop?"16px 20px":14,border:`1px solid ${isPending?"#ffcc0044":"#1a2a4488"}`,position:"relative"}} onClick={()=>setExp(!exp)}>
      {/* Badge statut */}
      <div style={{position:"absolute",top:8,right:8,background:isPending?"#ffcc0022":"#00ff9d22",border:`1px solid ${isPending?"#ffcc0066":"#00ff9d66"}`,borderRadius:20,padding:"2px 9px",fontFamily:"'Rajdhani',sans-serif",fontSize:10,fontWeight:700,color:isPending?"#ffcc00":"#00ff9d",letterSpacing:1}}>
        {isPending ? "⏳ EN ATTENTE" : "✅ VALIDÉE"}
      </div>
      <div style={{display:"flex",alignItems:"center",gap:isDesktop?14:10,paddingRight:100}}>
        <div style={{fontSize:isDesktop?22:18}}>{mission.split?"🤝":mission.assignee==="p1"?"🔵":"🟠"}</div>
        <div style={{flex:1}}>
          <div style={{color:"#e8f4ff",fontFamily:"'Rajdhani',sans-serif",fontSize:isDesktop?16:14,fontWeight:600}}>{mission.name}</div>
          <div style={{color:"#8899bb",fontSize:isDesktop?12:10,fontFamily:"'Rajdhani',sans-serif"}}>{mission.date}</div>
        </div>
        <div style={{textAlign:"right",flexShrink:0}}>
          <div style={{color:isPending?"#ffcc00":"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:isDesktop?15:13,fontWeight:700}}>{fmt(mission.amount)} aUEC</div>
          {mission.split&&<div style={{color:"#ffcc00",fontSize:isDesktop?12:10,fontFamily:"'Rajdhani',sans-serif"}}>PARTAGÉE</div>}
        </div>
      </div>
      {exp&&(
        <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #1a2a44"}} onClick={e=>e.stopPropagation()}>
          {mission.split?(
            <div style={{display:"flex",gap:12,marginBottom:10}}>
              {profiles.map(p=>(
                <div key={p.id} style={{flex:1,background:"#0a1628",borderRadius:8,padding:10,border:`1px solid ${p.color}44`}}>
                  <div style={{color:p.color,fontSize:isDesktop?12:10,fontFamily:"'Rajdhani',sans-serif",marginBottom:2}}>{p.name}</div>
                  <div style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:isDesktop?16:14,fontWeight:700}}>+{fmt(share)}</div>
                </div>
              ))}
            </div>
          ):(
            <div style={{color:"#8899bb",fontSize:isDesktop?14:12,fontFamily:"'Rajdhani',sans-serif",marginBottom:10}}>
              Attribué à : <span style={{color:owner?.color,fontWeight:700}}>{owner?.name}</span>
              <span style={{color:"#00ff9d",fontFamily:"'Orbitron',sans-serif",marginLeft:10,fontWeight:700}}>+{fmt(mission.amount)}</span>
            </div>
          )}
          {mission.note&&<div style={{color:"#8899bb",fontSize:isDesktop?13:11,marginBottom:10,fontFamily:"'Rajdhani',sans-serif"}}>📝 {mission.note}</div>}
          <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
            {isPending && onValidate && (
              <button onClick={e=>{e.stopPropagation();onValidate(mission.id);}} style={{background:"linear-gradient(135deg,#00ff9d22,#0a1628)",border:"1px solid #00ff9d88",color:"#00ff9d",borderRadius:8,padding:"8px 16px",cursor:"pointer",fontFamily:"'Orbitron',sans-serif",fontSize:isDesktop?13:11,fontWeight:700,boxShadow:"0 0 10px #00ff9d33",flex:1}}>
                ✅ VALIDER + DISTRIBUER {fmt(mission.amount)} aUEC
              </button>
            )}
            <button onClick={e=>{e.stopPropagation();onDelete(mission.id);}} style={{...S.dangerBtn,fontSize:isDesktop?13:11,padding:"8px 14px"}}>🗑 Supprimer</button>
          </div>
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

  function del(obj) {
    if (obj.type==="common") setObjectives(p=>({...p, common:p.common.filter(x=>x.id!==obj.id)}));
    else setObjectives(p=>({...p, personal:{...p.personal, [obj.owner]:p.personal[obj.owner].filter(x=>x.id!==obj.id)}}));
    setDetailObj(null);
  }

  function validateObjective(obj) {
    if (!window.confirm(`Valider "${obj.name}" et déduire ${fmt(obj.cost)} aUEC ?`)) return;
    if (obj.type === "common") {
      const share = Math.floor(obj.cost / profiles.length);
      setProfiles(prev => prev.map(p => ({ ...p, aUEC: p.aUEC - share })));
    } else {
      setProfiles(prev => prev.map(p => p.id === obj.owner ? { ...p, aUEC: p.aUEC - obj.cost } : p));
    }
    del(obj);
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
// ─── QUICK CALC (calculatrice animée) ─────────────────────────────────────────
function QuickCalc({ embedded }) {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState("");
  const [flash, setFlash] = useState(false);
  const ref = useRef(null);
  const raf = useRef(null);

  function press(k) {
    if(k==="C"){ setExpr(""); setResult(""); return; }
    if(k==="⌫"){ setExpr(e=>e.slice(0,-1)); return; }
    if(k==="="){
      setExpr(prev => {
        try{
          const clean=prev.replace(/[^0-9+\-*/.()%\s]/g,"").replace(/%/g,"/100");
          if(!clean) return prev;
          // eslint-disable-next-line no-new-func
          const r=Function('"use strict";return ('+clean+')')();
          if(r===undefined||r===null||isNaN(r)){ setResult("Erreur"); }
          else{ setResult(String(Math.round(r*100)/100)); setFlash(true); setTimeout(()=>setFlash(false),300); }
        }catch{ setResult("Erreur"); }
        return prev;
      });
      return;
    }
    setResult("");
    setExpr(e=>e+k);
  }

  // Clavier physique PC + pavé numérique
  useEffect(() => {
    function onKey(e) {
      if(e.target.tagName==="INPUT"||e.target.tagName==="TEXTAREA") return;
      const map = {
        "0":"0","1":"1","2":"2","3":"3","4":"4","5":"5","6":"6","7":"7","8":"8","9":"9",
        "Numpad0":"0","Numpad1":"1","Numpad2":"2","Numpad3":"3","Numpad4":"4",
        "Numpad5":"5","Numpad6":"6","Numpad7":"7","Numpad8":"8","Numpad9":"9",
        "NumpadAdd":"+","NumpadSubtract":"-","NumpadMultiply":"*","NumpadDivide":"/",
        "NumpadDecimal":".","NumpadEnter":"=",
        "+":"+","-":"-","*":"*","/":"/",".":".",
        "Enter":"=","Backspace":"⌫","Escape":"C","Delete":"C",
        "NumpadEqual":"=","Equal":"=",
        "%":"%","(":"(",")":")","NumpadParenLeft":"(","NumpadParenRight":")",
      };
      const key = map[e.code] || map[e.key];
      if(key){ e.preventDefault(); press(key); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const canvas = ref.current; if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    function resize(){ canvas.width=canvas.offsetWidth*dpr; canvas.height=canvas.offsetHeight*dpr; ctx.setTransform(dpr,0,0,dpr,0,0); }
    resize();
    let t = 0;
    function frame(){
      const w=canvas.offsetWidth, h=canvas.offsetHeight;
      t+=0.01; ctx.clearRect(0,0,w,h);
      ctx.strokeStyle="rgba(0,212,255,0.06)"; ctx.lineWidth=1;
      const gap=26, off=(t*10)%gap;
      for(let x=-gap+off; x<w+gap; x+=gap){ ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+h*0.3,h); ctx.stroke(); }
      for(let y=0; y<h; y+=gap){ ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
      // particules flottantes
      for(let i=0;i<6;i++){
        const px=(Math.sin(t*0.5+i*1.3)*0.5+0.5)*w;
        const py=(Math.cos(t*0.4+i*2.1)*0.5+0.5)*h;
        const al=0.15+0.15*Math.sin(t*2+i);
        ctx.fillStyle=`rgba(0,255,157,${al})`;
        ctx.beginPath(); ctx.arc(px,py,1.5,0,Math.PI*2); ctx.fill();
      }
      raf.current=requestAnimationFrame(frame);
    }
    frame();
    return ()=>cancelAnimationFrame(raf.current);
  },[]);

  const KEYS = [
    ["C","⌫","%","/"],
    ["7","8","9","*"],
    ["4","5","6","-"],
    ["1","2","3","+"],
    ["0",".","(",")"],
  ];
  const opColor = "#00d4ff", numColor = "#e8f4ff";

  return (
    <div style={{marginTop:embedded?0:24}}>
      {!embedded && <div style={{...S.sectionTitle, color:"#00ff9d"}}>🧮 CALCULATRICE RAPIDE</div>}
      <div style={{position:"relative",background:"#050e1d",border:"1px solid #00ff9d33",borderRadius:16,overflow:"hidden",boxShadow:"0 0 24px #00ff9d22",maxWidth:380,margin:"0 auto"}}>
        <canvas ref={ref} style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}/>
        <div style={{position:"relative",padding:18}}>
          {/* Écran */}
          <div style={{background:"#030b1a",border:"1px solid #00ff9d22",borderRadius:10,padding:"14px 16px",marginBottom:16,minHeight:70,display:"flex",flexDirection:"column",justifyContent:"center",alignItems:"flex-end"}}>
            <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:18,minHeight:24,wordBreak:"break-all",textAlign:"right"}}>{expr||"0"}</div>
            <div style={{color: result==="Erreur"?"#ff4466":"#00ff9d",fontFamily:"'Orbitron',sans-serif",fontSize:28,fontWeight:700,textShadow:flash?"0 0 16px #00ff9daa":"0 0 6px #00ff9d44",transition:"text-shadow .2s",wordBreak:"break-all",textAlign:"right"}}>{result!==""?result:""}</div>
          </div>
          {/* Touches */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
            {KEYS.flat().map(k=>{
              const isOp=["/","*","-","+","%"].includes(k);
              const isAct=["C","⌫"].includes(k);
              const col = isAct?"#ff6b35":isOp?opColor:numColor;
              return (
                <CalcKey key={k} label={k} color={col} onClick={()=>press(k)} />
              );
            })}
            <CalcKey label="=" color="#00ff9d" wide onClick={()=>press("=")} />
          </div>
        </div>
      </div>
    </div>
  );
}

function CalcKey({ label, color, onClick, wide }) {
  const [down, setDown] = useState(false);
  const touched = useRef(false);
  return (
    <button
      onPointerDown={e => { e.preventDefault(); setDown(true); onClick(); touched.current = true; }}
      onPointerUp={e => { e.preventDefault(); setDown(false); }}
      onPointerLeave={() => setDown(false)}
      onPointerCancel={() => setDown(false)}
      onClick={e => { if (touched.current) { touched.current = false; return; } onClick(); }}
      style={{
        gridColumn: wide ? "span 4" : "auto",
        background: down ? `${color}44` : "#0a1628",
        border: `1px solid ${down ? color : color + "44"}`,
        borderRadius: 10, padding: "14px 0",
        color, fontFamily: "'Orbitron',sans-serif", fontSize: 18, fontWeight: 700,
        cursor: "pointer",
        boxShadow: down ? `0 0 20px ${color}88, inset 0 0 10px ${color}44` : "none",
        transform: down ? "scale(0.92)" : "scale(1)",
        transition: "none",
        userSelect: "none", WebkitUserSelect: "none",
        touchAction: "none", WebkitTapHighlightColor: "transparent",
        willChange: "transform",
      }}
    >{label}</button>
  );
}


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
      <QuickCalc/>
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
  const [chatMsgs,  setChatMsgs,  ,            saveChatMsgs  ] = useFirestore("chat",        []);

  // Dernier lu par appareil (localStorage)
  const [lastRead, setLastRead] = useState(() => { try { return parseInt(localStorage.getItem("chat_lastRead") || "0"); } catch { return 0; } });
  const unreadCount = chatMsgs.filter(m => (m.id || 0) > lastRead).length;

  // Reset badge à 00h01 chaque jour
  useEffect(() => {
    function scheduleReset() {
      const now2 = new Date();
      const next = new Date(now2); next.setHours(0, 1, 0, 0); next.setDate(next.getDate() + 1);
      const ms = next - now2;
      return setTimeout(() => {
        const ts = Date.now();
        setLastRead(ts);
        try { localStorage.setItem("chat_lastRead", String(ts)); } catch {}
        scheduleReset();
      }, ms);
    }
    const tid = scheduleReset();
    return () => clearTimeout(tid);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  const [gainsModal,     setGainsModal]     = useState(false);
  const [calcModal,      setCalcModal]      = useState(false);
  const [chatOpen,       setChatOpen]       = useState(false);

  function openChat() {
    setChatOpen(true);
  }

  function markChatRead() {
    const now = Date.now();
    setLastRead(now);
    try { localStorage.setItem("chat_lastRead", String(now)); } catch {}
  }
  const [addMissionModal,setAddMissionModal]= useState(false);
  const [missionForm,    setMissionForm]    = useState({name:"",amount:"",split:true,assignee:"p1",note:""});

  const totalEarned = missions.filter(m=>m.status==="validated").reduce((a,m)=>a+m.amount,0);
  const validatedMissions = missions.filter(m=>m.status==="validated");
  const pendingMissions   = missions.filter(m=>!m.status||m.status==="pending");
  const p1=profiles.find(p=>p.id==="p1");
  const p2=profiles.find(p=>p.id==="p2");

  function addMission(){
    if(!missionForm.name||!missionForm.amount) return;
    const m={id:"m"+Date.now(),name:missionForm.name,amount:+missionForm.amount,split:missionForm.split,assignee:missionForm.assignee,note:missionForm.note,date:new Date().toLocaleDateString("fr-FR"),status:"pending"};
    // Pas de distribution d'argent ici — en attente de validation
    setMissions(prev=>[m,...prev]);
    saveMissions([m,...missions]);
    setAddMissionModal(false);
    setMissionForm({name:"",amount:"",split:true,assignee:"p1",note:""});
  }

  function validateMission(id){
    const m=missions.find(x=>x.id===id); if(!m||m.status==="validated") return;
    const half=Math.floor(m.amount/2);
    setProfiles(prev=>prev.map(p=>{ if(m.split) return{...p,aUEC:p.aUEC+half}; if(p.id===m.assignee) return{...p,aUEC:p.aUEC+m.amount}; return p; }));
    const updated=missions.map(x=>x.id===id?{...x,status:"validated"}:x);
    setMissions(updated); saveMissions(updated);
  }

  function deleteMission(id){
    const m=missions.find(x=>x.id===id); if(!m) return;
    // Rembourse seulement si déjà validée
    if(m.status==="validated"){
      const half=Math.floor(m.amount/2);
      setProfiles(prev=>prev.map(p=>{ if(m.split) return{...p,aUEC:p.aUEC-half}; if(p.id===m.assignee) return{...p,aUEC:p.aUEC-m.amount}; return p; }));
    }
    const updated=missions.filter(x=>x.id!==id);
    setMissions(updated); saveMissions(updated);
  }

  const TABS=[
    {id:"dashboard",   icon:"🏠", label:"HOME"},
    {id:"concession",  icon:"🚀", label:"CONCESSION"},
    {id:"objectives",  icon:"🎯", label:"OBJECTIFS"},
    {id:"calc",        icon:"⛏", label:"CALCUL"},
    {id:"settings",    icon:"⚙️", label:"RÉGLAGES"},
  ];

  // Swipe gauche/droite pour changer d'onglet
  const [slideHome, setSlideHome] = useState(false);

  const swipeStartX = useRef(null);
  const swipeStartY = useRef(null);
  function onSwipeStart(e) {
    swipeStartX.current = e.touches?.[0]?.clientX ?? null;
    swipeStartY.current = e.touches?.[0]?.clientY ?? null;
  }
  function onSwipeEnd(e) {
    if (swipeStartX.current === null) return;
    const dx = (e.changedTouches?.[0]?.clientX ?? swipeStartX.current) - swipeStartX.current;
    const dy = Math.abs((e.changedTouches?.[0]?.clientY ?? swipeStartY.current) - swipeStartY.current);
    swipeStartX.current = null; swipeStartY.current = null;
    if (Math.abs(dx) < 60 || dy > Math.abs(dx) * 0.8) return;
    // Swipe droite depuis n'importe où → Home avec animation
    if (dx > 0 && tab !== "dashboard") {
      setSlideHome(true);
      setTimeout(() => { setTab("dashboard"); setSlideHome(false); }, 380);
      return;
    }
    const idx = TABS.findIndex(t => t.id === tab);
    if (dx < 0 && idx < TABS.length - 1) setTab(TABS[idx + 1].id);
    if (dx > 0 && idx > 0)               setTab(TABS[idx - 1].id);
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
        @keyframes neonFlicker{
          0%,18%,22%,25%,53%,57%,100%{
            text-shadow:0 0 4px #00d4ff,0 0 11px #00d4ff,0 0 19px #00d4ff,0 0 40px #0099ff,0 0 80px #0099ff;
            color:#caf4ff;opacity:1;
          }
          20%,24%,55%{
            text-shadow:none;color:#3a6a88;opacity:0.75;
          }
        }
        @keyframes neonSweep{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes moneyPulse{0%,100%{text-shadow:0 0 6px #00ff9d66;transform:scale(1)}50%{text-shadow:0 0 18px #00ff9dcc,0 0 30px #00ff9d55;transform:scale(1.04)}}
        @keyframes neonBreath{
          0%,100%{ text-shadow:0 0 2px var(--mc), 0 0 5px var(--mc); }
          50%{ text-shadow:0 0 3px var(--mc), 0 0 9px var(--mc), 0 0 14px var(--mc); }
        }
        @keyframes fortuneBreath{
          0%,100%{ text-shadow:0 0 1px #ffcc00, 0 0 4px #ffcc0099; }
          50%{ text-shadow:0 0 2px #ffcc00, 0 0 6px #ffcc00, 0 0 10px #ffaa0088; }
        }
        @keyframes badgePop{
          0%,100%{ transform:scale(1); box-shadow:0 0 8px #a78bfa; }
          50%{ transform:scale(1.18); box-shadow:0 0 16px #a78bfacc; }
        }
        @keyframes slideToHome{
          0%{ transform:translateX(0); opacity:1; }
          40%{ transform:translateX(120px); opacity:0; }
          41%{ transform:translateX(-60px); opacity:0; }
          100%{ transform:translateX(0); opacity:1; }
        }
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
            <NavIcon tabId={t.id} active={tab===t.id} size={isDesktop?30:26}/>
            <span className="label">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Wrapper décalé sur desktop */}
      <div className="desktop-shift">

        {/* Header */}
        <div style={S.header}>
          <div style={{...S.headerInner, padding: isDesktop ? "20px 48px" : "12px 18px", flexDirection: isDesktop?"row":"column", alignItems: isDesktop?"center":"stretch", gap: isDesktop?8:10}} className="desktop-header-inner">
            <div style={{display:"flex",alignItems:"center",gap:isDesktop?18:12,justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:isDesktop?18:12,minWidth:0}}>
                {settings.appIcon?<img src={settings.appIcon} alt="logo" style={{height:isDesktop?52:42,width:isDesktop?52:42,objectFit:"contain",flexShrink:0}}/>:<div style={{fontSize:isDesktop?42:34,filter:"drop-shadow(0 0 8px #00d4ff)",flexShrink:0}}>⭐</div>}
                <div style={{minWidth:0}}>
                  <div className="desktop-header-title" style={{fontFamily:"'Orbitron',sans-serif",fontSize:isDesktop?30:22,fontWeight:900,color:"#caf4ff",animation:"neonFlicker 4s linear infinite",letterSpacing:isDesktop?4:3,whiteSpace:"nowrap"}}>STAR YeUv</div>
                  <div className="desktop-header-sub" style={{color:"#8899bb",fontSize:isDesktop?13:11,letterSpacing:isDesktop?4:3,fontFamily:"'Rajdhani',sans-serif"}}>COMPANION APP</div>
                </div>
              </div>
              {!isDesktop && <SyncBadge synced={loaded}/>}
            </div>
            <div style={{display:"flex",flexDirection:"column",alignItems:isDesktop?"flex-end":"center",gap:3,minWidth:0,maxWidth:isDesktop?360:"100%",width:isDesktop?"auto":"100%"}}>
              {isDesktop && <SyncBadge synced={loaded}/>}
              <div style={{fontSize:isDesktop?12:11,color:"#8899bb",letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",textAlign:isDesktop?"right":"center"}}>FORTUNE TOTALE</div>
              <FortuneAmount amount={(p1?.aUEC||0)+(p2?.aUEC||0)} isDesktop={isDesktop}/>
            </div>
          </div>
        </div>

        {/* Nav mobile (cachée sur desktop) */}
        <div style={S.nav} className="top-nav">
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} className={`nav-tab${tab===t.id?" active":""}`}>
              <NavIcon tabId={t.id} active={tab===t.id} size={24}/>
              <span className="label">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Contenu avec swipe */}
        <div style={{...S.content, padding: isDesktop ? "40px 56px 100px" : "24px 20px 100px", animation: slideHome ? "slideToHome 0.38s cubic-bezier(.4,0,.2,1) forwards" : undefined}} className="desktop-main-content" onTouchStart={onSwipeStart} onTouchEnd={onSwipeEnd}>

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
            {isDesktop ? (
              <>
                <MoneyBanner totalEarned={totalEarned} profiles={profiles} onClick={()=>setGainsModal(true)} isDesktop={isDesktop}/>
                <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill,minmax(160px,1fr))`,gap:14,marginBottom:20}}>
                  <CalcTile onClick={()=>setCalcModal(true)} isDesktop={isDesktop}/>
                  <ChatTile profiles={profiles} msgCount={unreadCount} onClick={openChat} isDesktop={isDesktop}/>
                  <HexTile iconKind="pad" label="Missions" value={validatedMissions.length} sub="complétées" color="#00d4ff" onClick={()=>setMissionsModal(true)} isDesktop={isDesktop}/>
                  <HexTile iconKind="share" label="Partagées" value={validatedMissions.filter(m=>m.split).length} sub="co-op" color="#00ff9d" isDesktop={isDesktop}/>
                  <HexTile iconKind="target" label="Objectifs" value={objectives.common.length+Object.values(objectives.personal).flat().length} sub="en cours" color="#ff6b35" onClick={()=>setTab("objectives")} isDesktop={isDesktop}/>
                  {profiles.map(p=>(
                    <HexTile key={p.id} iconKind="ship" label={p.name} value={(fleets[p.id]||[]).length} sub="vaisseau(x)" color={p.color} onClick={()=>setHangarProfile(p)} isDesktop={isDesktop}/>
                  ))}
                  <VirementTile profiles={profiles} setProfiles={setProfiles} isDesktop={isDesktop}/>
                  <DepensesTile profiles={profiles} setProfiles={setProfiles} isDesktop={isDesktop}/>
                </div>
              </>
            ) : (
              <>
                <MoneyBanner totalEarned={totalEarned} profiles={profiles} onClick={()=>setGainsModal(true)} isDesktop={isDesktop}/>
                <div style={{marginBottom:12}}>
                  <ChatTile profiles={profiles} msgCount={unreadCount} onClick={openChat} isDesktop={isDesktop}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(110px,1fr))",gap:10,marginBottom:10}}>
                  <HexTile iconKind="pad" label="Missions" value={validatedMissions.length} sub="complétées" color="#00d4ff" onClick={()=>setMissionsModal(true)} isDesktop={isDesktop}/>
                  <CalcTile onClick={()=>setCalcModal(true)} isDesktop={isDesktop}/>
                  <HexTile iconKind="share" label="Partagées" value={validatedMissions.filter(m=>m.split).length} sub="co-op" color="#00ff9d" isDesktop={isDesktop}/>
                  <HexTile iconKind="target" label="Objectifs" value={objectives.common.length+Object.values(objectives.personal).flat().length} sub="en cours" color="#ff6b35" onClick={()=>setTab("objectives")} isDesktop={isDesktop}/>
                  {profiles.map(p=>(
                    <HexTile key={p.id} iconKind="ship" label={p.name} value={(fleets[p.id]||[]).length} sub="vaisseau(x)" color={p.color} onClick={()=>setHangarProfile(p)} isDesktop={isDesktop}/>
                  ))}
                </div>
                <div style={{marginBottom:20}}>
                  <VirementTile profiles={profiles} setProfiles={setProfiles} isDesktop={isDesktop}/>
                </div>
                <div style={{marginBottom:20}}>
                  <DepensesTile profiles={profiles} setProfiles={setProfiles} isDesktop={isDesktop}/>
                </div>
              </>
            )}
            <div style={{display:"flex",justifyContent:"center",marginBottom:20}}>
              <button onClick={()=>setAddMissionModal(true)} style={{...S.primaryBtn,width:"auto",fontSize:isDesktop?16:14,padding:isDesktop?"14px 48px":"12px 32px",letterSpacing:2}}>➕ NOUVELLE MISSION</button>
            </div>
            <div style={{...S.sectionTitle,fontSize:isDesktop?15:13}}>📋 MISSIONS RÉCENTES</div>
            {pendingMissions.length>0&&<div style={{background:"#ffcc0011",border:"1px solid #ffcc0044",borderRadius:10,padding:"10px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:10}}>
              <span style={{fontSize:18}}>⏳</span>
              <div style={{flex:1}}>
                <div style={{color:"#ffcc00",fontFamily:"'Orbitron',sans-serif",fontSize:13,fontWeight:700}}>{pendingMissions.length} MISSION{pendingMissions.length>1?"S":""} EN ATTENTE</div>
                <div style={{color:"#8899bb",fontFamily:"'Rajdhani',sans-serif",fontSize:11}}>Cliquez sur une mission pour valider et distribuer l'argent</div>
              </div>
            </div>}
            {missions.slice(0,5).map(m=><MissionItem key={m.id} mission={m} profiles={profiles} onDelete={deleteMission} onValidate={validateMission} isDesktop={isDesktop}/>)}
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
      {chatOpen && <ChatInterface profiles={profiles} messages={chatMsgs} setMessages={(m)=>{setChatMsgs(m);saveChatMsgs(m);}} onMarkRead={markChatRead} onClose={()=>setChatOpen(false)}/>}

      {calcModal&&(
        <Modal title="🧮 CALCULATRICE" onClose={()=>setCalcModal(false)}>
          <QuickCalc embedded/>
        </Modal>
      )}

      {gainsModal&&(
        <GainsHistoryModal missions={missions} profiles={profiles} totalEarned={totalEarned} onClose={()=>setGainsModal(false)}/>
      )}

      {missionsModal&&(
        <Modal title="📋 TOUTES LES MISSIONS" onClose={()=>setMissionsModal(false)}>
          <button onClick={()=>setAddMissionModal(true)} style={{...S.primaryBtn,marginBottom:12}}>+ Nouvelle mission</button>
          {missions.length===0&&<div style={{color:"#8899bb",textAlign:"center",padding:20,fontFamily:"'Rajdhani',sans-serif"}}>Aucune mission enregistrée</div>}
          <div style={{maxHeight:"60vh",overflowY:"auto"}}>
            {missions.map(m=><MissionItem key={m.id} mission={m} profiles={profiles} onDelete={deleteMission} onValidate={validateMission}/>)}
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
          <ShipPicker3D
            value={editProfile.ship}
            onChange={v => setEditProfile(p=>({...p, ship:v}))}
            hangarShips={fleets[editProfile.id] || []}
            color={editProfile.color}
          />
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
          <button onClick={addMission} style={S.primaryBtn}>📋 Créer la mission (en attente)</button>
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
  statRow:{display:"flex",gap:8,alignItems:"stretch"},
  statItem:{flex:1,minWidth:0,background:"#0a1628",borderRadius:8,padding:"8px 10px",overflow:"hidden",display:"flex",flexDirection:"column",justifyContent:"flex-start",gap:3},
  statLabel:{color:"#8899bb",fontSize:12,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"},
  hexTile:{background:"#07111fcc",border:"1px solid",borderRadius:12,padding:"14px 10px",textAlign:"center",transition:"all .25s",backdropFilter:"blur(8px)"},
  missionItem:{background:"#07111fcc",border:"1px solid #1a2a4488",borderRadius:10,padding:14,marginBottom:8,cursor:"pointer",backdropFilter:"blur(8px)"},
  calcBox:{background:"#07111fcc",border:"1px solid #1a2a4488",borderRadius:12,padding:18,backdropFilter:"blur(8px)"},
  objectiveCard:{background:"#07111fcc",border:"1px solid",borderRadius:12,padding:14,backdropFilter:"blur(8px)"},
  progressBar:{background:"#1a2a44",borderRadius:4,height:6,overflow:"hidden"},
  progressFill:{height:"100%",borderRadius:4,transition:"width .4s ease"},
  resultBox:{background:"#0a1628",border:"1px solid #00d4ff44",borderRadius:10,padding:"10px 14px"},
  shipChip:{background:"#0a1628",border:"1px solid #1a2a4488",borderRadius:20,padding:"5px 12px",fontSize:12,color:"#8899bb",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",transition:"all .2s"},
  sectionTitle:{fontFamily:"'Orbitron',sans-serif",fontSize:15,fontWeight:700,color:"#00d4ff",letterSpacing:3,marginBottom:14,textTransform:"uppercase"},
  label:{display:"block",color:"#8899bb",fontSize:13,letterSpacing:1.5,marginBottom:4,marginTop:10,fontFamily:"'Rajdhani',sans-serif",textTransform:"uppercase"},
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
