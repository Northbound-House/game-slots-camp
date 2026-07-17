import React, { useState, useEffect, useRef, useCallback } from "react";

/* ============================================================
   CAMPGROUND — hold & spin
   5 columns of campsites: 4 / 4 / 6 / 6 / 8 rows, bottom aligned.
   Campers hold in place; nature icons spin around them.
   Counter = nights left on the booking. New camper -> back to 3.
   Counter runs out -> that column checks out (clears).
   Column fills -> pays into that column's bag, then clears.
   ============================================================ */

const COL_ROWS = [4, 4, 6, 6, 8];
const BET = 50;
const CELL = 60;
const COL_GAP = 12;
const ROW_GAP = 5;
const CAB_W = 500;
const CAB_H = 900;

const C = {
  night: "#0E1F26",
  nightDeep: "#081418",
  pine: "#0C2A22",
  bark: "#2E2116",
  barkLight: "#4A3524",
  canvas: "#E8DCC0",
  lantern: "#F2A93B",
  ember: "#D9502B",
  teal: "#4FB3A5",
  gold: "#FFD166",
  slot: "#0A181C",
  slotLine: "#1D3A40",
};

/* ---------- value pools per column ---------- */
const POOLS = [
  { tent: [25, 50, 75], trailer: [100, 150, 200], rig: [250, 375, 500] },
  { tent: [25, 50, 75], trailer: [100, 150, 200], rig: [250, 375, 500] },
  { tent: [25, 50, 75], trailer: [100, 150, 250], rig: [500, 750, 1000] },
  { tent: [25, 50, 75], trailer: [100, 150, 250], rig: [500, 750, 1000] },
  { tent: [50, 75, 100], trailer: [150, 250, 375], rig: [1000, 2000, 5000] },
];

const JACKPOT_BY_COL = ["MINI", "MINI", "MINOR", "MINOR", "MAJOR"];
const JP_BASE = { MINI: 1000, MINOR: 5000, MAJOR: 50000, GRAND: 250000 };
const JP_COLOR = {
  MINI: "#6FBF73",
  MINOR: "#4FA3D9",
  MAJOR: "#C05CC0",
  GRAND: "#F2A93B",
};

const pick = (a) => a[Math.floor(Math.random() * a.length)];

function makeCamper(colIdx) {
  const r = Math.random();
  if (r < 0.003 && colIdx === 4)
    return { tier: "rig", jackpot: "GRAND", value: 0 };
  if (r < 0.023)
    return { tier: "rig", jackpot: JACKPOT_BY_COL[colIdx], value: 0 };
  const t = Math.random();
  const tier = t < 0.6 ? "tent" : t < 0.9 ? "trailer" : "rig";
  return { tier, jackpot: null, value: pick(POOLS[colIdx][tier]) };
}

const emptyCol = (i) => ({
  cells: Array(COL_ROWS[i]).fill(null),
  counter: null,
});

/* ============================================================
   Artwork
   ============================================================ */

const Tent = ({ c = C.canvas }) => (
  <svg viewBox="0 0 48 48" width="100%" height="100%">
    <path d="M24 9 L41 37 H7 Z" fill={c} />
    <path d="M24 9 L24 37" stroke="rgba(0,0,0,.28)" strokeWidth="1.5" />
    <path d="M24 15 L31 37 H17 Z" fill="rgba(0,0,0,.35)" />
    <path d="M7 37 H41" stroke="rgba(0,0,0,.4)" strokeWidth="2.5" />
  </svg>
);

const Trailer = ({ c = C.teal }) => (
  <svg viewBox="0 0 48 48" width="100%" height="100%">
    <path d="M6 30 Q6 15 24 15 Q42 15 42 28 L42 32 H6 Z" fill={c} />
    <path d="M6 24 Q22 20 42 24 L42 27 Q22 23 6 27 Z" fill="rgba(255,255,255,.3)" />
    <rect x="12" y="20" width="9" height="7" rx="2" fill="rgba(0,0,0,.35)" />
    <rect x="4" y="31" width="40" height="3" rx="1.5" fill="rgba(0,0,0,.45)" />
    <circle cx="16" cy="36" r="4" fill="#1a1a1a" />
    <circle cx="16" cy="36" r="1.6" fill={c} />
    <circle cx="33" cy="36" r="4" fill="#1a1a1a" />
    <circle cx="33" cy="36" r="1.6" fill={c} />
  </svg>
);

const BigRig = ({ c = C.gold }) => (
  <svg viewBox="0 0 48 48" width="100%" height="100%">
    <path d="M3 14 H34 L45 22 V32 H3 Z" fill={c} />
    <path d="M35 17 H41 L44 23 H35 Z" fill="rgba(255,255,255,.45)" />
    <rect x="6" y="17" width="7" height="6" rx="1.5" fill="rgba(0,0,0,.35)" />
    <rect x="16" y="17" width="7" height="6" rx="1.5" fill="rgba(0,0,0,.35)" />
    <rect x="26" y="17" width="5" height="6" rx="1.5" fill="rgba(0,0,0,.35)" />
    <rect x="3" y="26" width="42" height="4" fill="rgba(0,0,0,.3)" />
    <rect x="2" y="31" width="44" height="3" rx="1.5" fill="rgba(0,0,0,.5)" />
    <circle cx="12" cy="36" r="4.5" fill="#151515" />
    <circle cx="12" cy="36" r="1.8" fill={c} />
    <circle cx="36" cy="36" r="4.5" fill="#151515" />
    <circle cx="36" cy="36" r="1.8" fill={c} />
  </svg>
);

const Pine = () => (
  <svg viewBox="0 0 48 48" width="100%" height="100%">
    <path d="M24 6 L33 20 H15 Z M24 15 L36 30 H12 Z M24 24 L39 40 H9 Z" fill="#2E5E4A" />
    <rect x="22" y="38" width="4" height="6" fill="#3A2A1C" />
  </svg>
);
const Campfire = () => (
  <svg viewBox="0 0 48 48" width="100%" height="100%">
    <path d="M24 10 Q32 20 30 28 Q28 34 24 36 Q20 34 18 28 Q16 20 24 10Z" fill="#C4452A" />
    <path d="M24 18 Q29 25 27 30 Q25 34 24 34 Q23 34 21 30 Q19 25 24 18Z" fill="#E8933B" />
    <rect x="9" y="36" width="30" height="3.5" rx="1.7" fill="#4A3524" transform="rotate(-8 24 38)" />
    <rect x="9" y="36" width="30" height="3.5" rx="1.7" fill="#3A2A1C" transform="rotate(8 24 38)" />
  </svg>
);
const Canoe = () => (
  <svg viewBox="0 0 48 48" width="100%" height="100%">
    <path d="M5 20 Q24 40 43 20 Q24 30 5 20Z" fill="#7A4B2A" />
    <path d="M5 20 Q24 33 43 20 Q24 27 5 20Z" fill="#A96B3C" />
    <rect x="20" y="8" width="3" height="20" rx="1.5" fill="#5C3A20" transform="rotate(28 24 20)" />
  </svg>
);
const Lantern = () => (
  <svg viewBox="0 0 48 48" width="100%" height="100%">
    <path d="M20 8 Q24 4 28 8" stroke="#5C4A33" strokeWidth="2.5" fill="none" />
    <rect x="16" y="12" width="16" height="4" rx="1.5" fill="#5C4A33" />
    <rect x="17" y="16" width="14" height="18" fill="#F2C96B" opacity=".85" />
    <rect x="16" y="34" width="16" height="4" rx="1.5" fill="#5C4A33" />
    <rect x="22" y="20" width="4" height="10" rx="2" fill="#FFF3C4" />
  </svg>
);
const Bear = () => (
  <svg viewBox="0 0 48 48" width="100%" height="100%">
    <circle cx="14" cy="14" r="5" fill="#5A4030" />
    <circle cx="34" cy="14" r="5" fill="#5A4030" />
    <circle cx="24" cy="26" r="14" fill="#6B4C38" />
    <ellipse cx="24" cy="31" rx="7" ry="5" fill="#A9856A" />
    <ellipse cx="24" cy="28" rx="3" ry="2.2" fill="#241811" />
    <circle cx="18" cy="22" r="1.8" fill="#241811" />
    <circle cx="30" cy="22" r="1.8" fill="#241811" />
  </svg>
);

const FILLERS = [Pine, Campfire, Canoe, Lantern, Bear];

const CamperArt = ({ tier, jackpot }) => {
  const col = jackpot ? JP_COLOR[jackpot] : null;
  if (tier === "tent") return <Tent c={col || C.canvas} />;
  if (tier === "trailer") return <Trailer c={col || C.teal} />;
  return <BigRig c={col || C.gold} />;
};

/* ============================================================
   Cell
   ============================================================ */

function Cell({ camper, spinning, seed, flashing }) {
  const F = FILLERS[seed % FILLERS.length];
  const held = !!camper;

  return (
    <div
      style={{
        width: CELL,
        height: CELL,
        borderRadius: 8,
        position: "relative",
        overflow: "hidden",
        background: held
          ? "radial-gradient(circle at 50% 35%, rgba(255,255,255,.12), rgba(0,0,0,.35))"
          : C.slot,
        border: held
          ? `2px solid ${camper.jackpot ? JP_COLOR[camper.jackpot] : C.lantern}`
          : `1px solid ${C.slotLine}`,
        boxShadow: held
          ? `0 0 12px ${camper.jackpot ? JP_COLOR[camper.jackpot] : "rgba(242,169,59,.5)"} , inset 0 0 18px rgba(0,0,0,.5)`
          : "inset 0 2px 6px rgba(0,0,0,.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "border-color .2s, box-shadow .2s",
      }}
    >
      {flashing && (
        <div
          className="cg-flash"
          style={{
            position: "absolute",
            inset: 0,
            background: C.gold,
            mixBlendMode: "overlay",
            zIndex: 3,
          }}
        />
      )}

      {held ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            padding: 3,
          }}
        >
          <div style={{ width: "72%", height: "56%" }}>
            <CamperArt tier={camper.tier} jackpot={camper.jackpot} />
          </div>
          <div
            style={{
              marginTop: 1,
              fontFamily: "'Barlow Condensed', system-ui, sans-serif",
              fontWeight: 700,
              fontSize: camper.jackpot ? 12 : 15,
              letterSpacing: camper.jackpot ? ".06em" : "0",
              lineHeight: 1,
              color: camper.jackpot ? "#12080A" : C.night,
              background: camper.jackpot ? JP_COLOR[camper.jackpot] : C.canvas,
              borderRadius: 4,
              padding: "1px 6px",
              boxShadow: "0 1px 0 rgba(0,0,0,.4)",
            }}
          >
            {camper.jackpot ? camper.jackpot : camper.value}
          </div>
        </div>
      ) : (
        <div
          className={spinning ? "cg-spin" : ""}
          style={{ width: "60%", height: "60%", opacity: spinning ? 0.5 : 0.75 }}
        >
          <F />
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Signpost counter — nights left on the booking
   ============================================================ */

function Signpost({ n }) {
  if (n == null) return <div style={{ width: CELL, height: 40 }} />;
  const hot = n <= 1;
  return (
    <div
      style={{
        width: CELL,
        height: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <div style={{ width: 4, height: 5, background: C.barkLight }} />
      <div
        className={hot ? "cg-pulse" : ""}
        style={{
          width: 42,
          height: 26,
          borderRadius: 3,
          background: hot ? C.ember : C.bark,
          border: `2px solid ${hot ? "#F2A93B" : C.barkLight}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Barlow Condensed', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: 17,
          color: hot ? "#FFF3C4" : C.canvas,
          boxShadow: hot ? `0 0 12px ${C.ember}` : "0 2px 4px rgba(0,0,0,.5)",
        }}
      >
        {n}
      </div>
      <div style={{ width: 4, height: 7, background: C.barkLight }} />
    </div>
  );
}

/* ============================================================
   Money bag
   ============================================================ */

function Bag({ total, popping }) {
  return (
    <div
      style={{
        width: CELL,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 3,
      }}
    >
      <div
        className={popping ? "cg-pop" : ""}
        style={{ width: 52, height: 50, position: "relative" }}
      >
        <svg viewBox="0 0 52 50" width="52" height="50">
          <path
            d="M18 8 Q26 3 34 8 L34 12 L18 12 Z"
            fill="#8A6A3F"
            stroke="#5C4A33"
            strokeWidth="1.5"
          />
          <path
            d="M20 12 Q4 26 10 40 Q14 48 26 48 Q38 48 42 40 Q48 26 32 12 Z"
            fill="#B08A52"
            stroke="#6E552F"
            strokeWidth="1.5"
          />
          <path
            d="M22 15 Q10 27 14 38"
            stroke="rgba(255,255,255,.25)"
            strokeWidth="3"
            fill="none"
          />
          <text
            x="26"
            y="36"
            textAnchor="middle"
            fontFamily="'Bevan', Georgia, serif"
            fontSize="15"
            fill="#4A3218"
          >
            $
          </text>
        </svg>
      </div>
      <div
        style={{
          fontFamily: "'Barlow Condensed', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: 14,
          color: total > 0 ? C.gold : "rgba(232,220,192,.35)",
          letterSpacing: ".03em",
        }}
      >
        {total.toLocaleString()}
      </div>
    </div>
  );
}

/* ============================================================
   Jackpot banners
   ============================================================ */

function JPBanner({ label, value, size }) {
  const big = size === "big";
  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${JP_COLOR[label]}22, rgba(0,0,0,.6))`,
        border: `2px solid ${JP_COLOR[label]}`,
        borderRadius: 8,
        padding: big ? "6px 18px" : "3px 10px",
        textAlign: "center",
        boxShadow: `0 0 ${big ? 18 : 8}px ${JP_COLOR[label]}55`,
        minWidth: big ? 240 : 108,
      }}
    >
      <div
        style={{
          fontFamily: "'Bevan', Georgia, serif",
          fontSize: big ? 13 : 10,
          letterSpacing: ".22em",
          color: JP_COLOR[label],
          textShadow: `0 0 8px ${JP_COLOR[label]}`,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "'Barlow Condensed', system-ui, sans-serif",
          fontWeight: 700,
          fontSize: big ? 34 : 19,
          lineHeight: 1.05,
          color: "#FFF6DD",
          textShadow: "0 2px 6px rgba(0,0,0,.8)",
        }}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

/* ============================================================
   Main
   ============================================================ */

export default function Campground() {
  const [cols, setCols] = useState(() => COL_ROWS.map((_, i) => emptyCol(i)));
  const [bags, setBags] = useState([0, 0, 0, 0, 0]);
  const [balance, setBalance] = useState(5000);
  const [jp, setJp] = useState({ ...JP_BASE });
  const [spinningCols, setSpinning] = useState([false, false, false, false, false]);
  const [busy, setBusy] = useState(false);
  const [auto, setAuto] = useState(false);
  const [seed, setSeed] = useState(0);
  const [win, setWin] = useState(0);
  const [msg, setMsg] = useState("Tap spin to open the gate");
  const [flashCol, setFlashCol] = useState(null);
  const [popBag, setPopBag] = useState(null);
  const [scale, setScale] = useState(1);

  const timers = useRef([]);
  const colsRef = useRef(cols);
  colsRef.current = cols;

  /* fit the cabinet to the viewport */
  useEffect(() => {
    const fit = () => {
      const k = Math.min(
        window.innerWidth / (CAB_W + 24),
        window.innerHeight / (CAB_H + 24)
      );
      setScale(Math.min(k, 1.15));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  /* filler churn while spinning */
  useEffect(() => {
    if (!spinningCols.some(Boolean)) return;
    const id = setInterval(() => setSeed((s) => s + 1), 70);
    return () => clearInterval(id);
  }, [spinningCols]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const later = (fn, ms) => timers.current.push(setTimeout(fn, ms));

  const spin = useCallback(() => {
    if (busy || balance < BET) return;
    setBusy(true);
    setWin(0);
    setMsg("");
    setBalance((b) => b - BET);
    setJp((j) => ({ ...j, MAJOR: j.MAJOR + 12, GRAND: j.GRAND + 30 }));
    setSpinning([true, true, true, true, true]);

    /* decide the whole spin up front, then reveal column by column */
    const results = colsRef.current.map((col, i) => {
      const openIdx = col.cells
        .map((c, k) => (c ? null : k))
        .filter((k) => k !== null);
      if (!openIdx.length || Math.random() > 0.42) return [];
      const r = Math.random();
      const want = r < 0.7 ? 1 : r < 0.93 ? 2 : 3;
      const n = Math.min(want, openIdx.length);
      const shuffled = openIdx.sort(() => Math.random() - 0.5).slice(0, n);
      return shuffled.map((slot) => ({ slot, camper: makeCamper(i) }));
    });

    results.forEach((res, i) => {
      later(() => {
        setSpinning((s) => {
          const n = [...s];
          n[i] = false;
          return n;
        });
        setCols((prev) => {
          const next = prev.map((c) => ({ ...c, cells: [...c.cells] }));
          if (res.length) {
            res.forEach(({ slot, camper }) => (next[i].cells[slot] = camper));
            next[i].counter = 3;
          } else if (next[i].counter != null) {
            next[i].counter -= 1;
          }
          return next;
        });
      }, 420 + i * 190);
    });

    /* settle: clear checkouts, pay full columns */
    later(() => {
      const snapshot = colsRef.current;
      let totalWin = 0;
      const fills = [];
      const checkouts = [];

      snapshot.forEach((col, i) => {
        if (col.cells.every(Boolean)) fills.push(i);
        else if (col.counter === 0) checkouts.push(i);
      });

      if (checkouts.length) {
        setCols((prev) =>
          prev.map((c, i) => (checkouts.includes(i) ? emptyCol(i) : c))
        );
        setMsg(
          checkouts.length === 1
            ? `Site ${checkouts[0] + 1} checked out`
            : "Sites cleared"
        );
      }

      if (!fills.length) {
        setBusy(false);
        return;
      }

      /* pay each full column into its bag */
      fills.forEach((i, order) => {
        later(() => {
          const col = colsRef.current[i];
          let amount = 0;
          col.cells.forEach((c) => {
            amount += c.jackpot ? jp[c.jackpot] : c.value;
          });
          totalWin += amount;
          setFlashCol(i);
          setPopBag(i);
          later(() => {
            setBags((b) => {
              const n = [...b];
              n[i] += amount;
              return n;
            });
            setBalance((b) => b + amount);
            setWin((w) => w + amount);
            setCols((prev) => prev.map((c, k) => (k === i ? emptyCol(k) : c)));
            setMsg(`Site ${i + 1} full — ${amount.toLocaleString()} to the bag`);
            setFlashCol(null);
            setPopBag(null);
            setJp((j) => {
              const hitGrand = col.cells.some((c) => c.jackpot === "GRAND");
              return hitGrand ? { ...j, GRAND: JP_BASE.GRAND } : j;
            });
            if (order === fills.length - 1) setBusy(false);
          }, 720);
        }, order * 1100);
      });
    }, 420 + 4 * 190 + 260);
  }, [busy, balance, jp]);

  /* autoplay */
  useEffect(() => {
    if (!auto || busy) return;
    if (balance < BET) {
      setAuto(false);
      setMsg("Out of credits — reset to keep camping");
      return;
    }
    const id = setTimeout(spin, 500);
    return () => clearTimeout(id);
  }, [auto, busy, balance, spin]);

  const reset = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setAuto(false);
    setBusy(false);
    setCols(COL_ROWS.map((_, i) => emptyCol(i)));
    setBags([0, 0, 0, 0, 0]);
    setBalance(5000);
    setJp({ ...JP_BASE });
    setWin(0);
    setSpinning([false, false, false, false, false]);
    setMsg("Fresh season. Gate's open.");
  };

  const boardW = COL_ROWS.length * CELL + (COL_ROWS.length - 1) * COL_GAP;

  return (
    <div
      style={{
        width: "100%",
        minHeight: "100vh",
        background: `radial-gradient(ellipse at 50% 0%, #14323C 0%, ${C.nightDeep} 70%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <style>{`
        @keyframes cgSpin { 0%{transform:translateY(-14px)} 100%{transform:translateY(14px)} }
        .cg-spin { animation: cgSpin .09s linear infinite alternate; filter: blur(1.2px); }
        @keyframes cgPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.14)} }
        .cg-pulse { animation: cgPulse .6s ease-in-out infinite; }
        @keyframes cgFlash { 0%,100%{opacity:0} 50%{opacity:.85} }
        .cg-flash { animation: cgFlash .22s ease-in-out infinite; }
        @keyframes cgPop { 0%{transform:scale(1)} 40%{transform:scale(1.28) rotate(-4deg)} 100%{transform:scale(1)} }
        .cg-pop { animation: cgPop .5s ease-out infinite; }
        .cg-btn:active { transform: translateY(2px); }
        .cg-btn:focus-visible { outline: 3px solid ${C.lantern}; outline-offset: 3px; }
        @media (prefers-reduced-motion: reduce) {
          .cg-spin,.cg-pulse,.cg-flash,.cg-pop { animation: none !important; filter:none !important; }
        }
      `}</style>

      <div
        style={{
          width: CAB_W,
          height: CAB_H,
          transform: `scale(${scale})`,
          transformOrigin: "center",
          flexShrink: 0,
          position: "relative",
          background: `linear-gradient(180deg, #16323D 0%, #0E2029 45%, ${C.pine} 100%)`,
          borderRadius: 18,
          border: `6px solid ${C.bark}`,
          boxShadow: "0 30px 80px rgba(0,0,0,.8)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "14px 0 12px",
          overflow: "hidden",
        }}
      >
        {/* treeline */}
        <svg
          viewBox="0 0 500 120"
          style={{ position: "absolute", bottom: 0, left: 0, width: "100%", opacity: 0.5 }}
        >
          <path
            d="M0 120 L0 70 L20 40 L40 70 L60 35 L85 75 L110 45 L135 80 L160 50 L185 85 L215 55 L245 90 L275 55 L305 85 L335 50 L360 80 L390 45 L415 75 L440 38 L465 70 L485 42 L500 70 L500 120 Z"
            fill="#07130F"
          />
        </svg>

        {/* ---- jackpot ladder ---- */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 5,
            zIndex: 2,
          }}
        >
          <JPBanner label="GRAND" value={jp.GRAND} size="small" />
          <JPBanner label="MAJOR" value={jp.MAJOR} size="big" />
          <div style={{ display: "flex", gap: 10 }}>
            <JPBanner label="MINOR" value={jp.MINOR} size="small" />
            <JPBanner label="MINI" value={jp.MINI} size="small" />
          </div>
        </div>

        {/* ---- title ---- */}
        <div
          style={{
            position: "absolute",
            left: 14,
            top: 210,
            width: 66,
            textAlign: "center",
            zIndex: 2,
          }}
        >
          <div
            style={{
              fontFamily: "'Bevan', Georgia, serif",
              fontSize: 19,
              lineHeight: 1,
              color: C.lantern,
              textShadow: "0 2px 0 #5C3A20, 0 0 14px rgba(242,169,59,.6)",
            }}
          >
            CAMP
            <br />
            GROUND
          </div>
          <div
            style={{
              marginTop: 5,
              fontFamily: "'Barlow Condensed', system-ui, sans-serif",
              fontSize: 10,
              letterSpacing: ".14em",
              color: "rgba(232,220,192,.6)",
            }}
          >
            HOLD &amp; SPIN
          </div>
        </div>

        {/* ---- board ---- */}
        <div
          style={{
            marginTop: "auto",
            width: boardW,
            display: "flex",
            alignItems: "flex-end",
            gap: COL_GAP,
            zIndex: 2,
          }}
        >
          {cols.map((col, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: ROW_GAP,
                padding: 4,
                borderRadius: 10,
                background: "rgba(0,0,0,.35)",
                border: `1px solid ${
                  col.counter != null ? "rgba(242,169,59,.5)" : "rgba(255,255,255,.06)"
                }`,
              }}
            >
              {col.cells.map((camper, k) => (
                <Cell
                  key={k}
                  camper={camper}
                  spinning={spinningCols[i]}
                  seed={seed + i * 7 + k * 3}
                  flashing={flashCol === i}
                />
              ))}
            </div>
          ))}
        </div>

        {/* ---- counters ---- */}
        <div style={{ display: "flex", gap: COL_GAP + 8, marginTop: 6, zIndex: 2 }}>
          {cols.map((col, i) => (
            <Signpost
              key={i}
              n={col.cells.some(Boolean) ? col.counter : null}
            />
          ))}
        </div>

        {/* ---- bags ---- */}
        <div style={{ display: "flex", gap: COL_GAP + 8, marginTop: 2, zIndex: 2 }}>
          {bags.map((t, i) => (
            <Bag key={i} total={t} popping={popBag === i} />
          ))}
        </div>

        {/* ---- status line ---- */}
        <div
          style={{
            height: 20,
            marginTop: 6,
            fontFamily: "'Barlow Condensed', system-ui, sans-serif",
            fontSize: 15,
            letterSpacing: ".04em",
            color: win > 0 ? C.gold : "rgba(232,220,192,.7)",
            zIndex: 2,
          }}
        >
          {win > 0 ? `WIN ${win.toLocaleString()}` : msg}
        </div>

        {/* ---- controls ---- */}
        <div
          style={{
            marginTop: "auto",
            width: CAB_W - 40,
            display: "flex",
            alignItems: "center",
            gap: 10,
            background: "rgba(0,0,0,.5)",
            border: `2px solid ${C.barkLight}`,
            borderRadius: 10,
            padding: "8px 12px",
            zIndex: 2,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={label}>CREDITS</div>
            <div style={readout}>{balance.toLocaleString()}</div>
          </div>
          <div>
            <div style={label}>BET</div>
            <div style={readout}>{BET}</div>
          </div>

          <button
            className="cg-btn"
            onClick={() => setAuto((a) => !a)}
            style={{
              ...btn,
              background: auto ? C.ember : "transparent",
              color: auto ? "#FFF3C4" : C.canvas,
              border: `2px solid ${auto ? C.lantern : C.barkLight}`,
              width: 62,
              fontSize: 12,
            }}
          >
            AUTO
          </button>

          <button
            className="cg-btn"
            onClick={spin}
            disabled={busy || balance < BET}
            style={{
              ...btn,
              width: 108,
              fontSize: 17,
              background:
                busy || balance < BET
                  ? "#3A3A3A"
                  : `linear-gradient(180deg, ${C.lantern}, #C87A1E)`,
              color: busy || balance < BET ? "#777" : "#2A1A08",
              border: "2px solid #FFE1A0",
              cursor: busy || balance < BET ? "default" : "pointer",
            }}
          >
            SPIN
          </button>

          <button className="cg-btn" onClick={reset} style={{ ...btn, width: 52, fontSize: 11 }}>
            RESET
          </button>
        </div>
      </div>
    </div>
  );
}

const label = {
  fontFamily: "'Barlow Condensed', system-ui, sans-serif",
  fontSize: 9,
  letterSpacing: ".18em",
  color: "rgba(232,220,192,.5)",
};
const readout = {
  fontFamily: "'Barlow Condensed', system-ui, sans-serif",
  fontWeight: 700,
  fontSize: 20,
  color: C.gold,
  lineHeight: 1,
};
const btn = {
  fontFamily: "'Bevan', Georgia, serif",
  letterSpacing: ".06em",
  padding: "9px 0",
  borderRadius: 8,
  background: "transparent",
  color: C.canvas,
  border: `2px solid ${C.barkLight}`,
  cursor: "pointer",
  transition: "transform .08s",
};
