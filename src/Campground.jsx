import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";

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

/* Board geometry. The column pitch is CELL + COL_GAP and nothing is allowed to
   widen it — the site frame is drawn as an inset overlay rather than padding, so
   the signposts and money bags below line up with the columns they belong to. */
const CELL = 60;
const COL_GAP = 12;
const ROW_GAP = 5;
const FRAME_INSET = 5;
const BOARD_W = COL_ROWS.length * CELL + (COL_ROWS.length - 1) * COL_GAP; // 348

/* Cabinet is border-box: CAB_W/CAB_H are the *painted* outer size, so the
   wrapper that reserves layout space can match it exactly. */
const CAB_W = 500;
const CAB_H = 960;
const FRAME = 7;
const PAD_T = 14;
const PAD_B = 12;
const INNER_W = CAB_W - FRAME * 2; // 486 — scenery + centred content width
const INNER_H = CAB_H - FRAME * 2; // 946 — padding box the scenery paints into

const VIEWPORT_PAD = 16;
const MAX_SCALE = 1.15;

const FONT_D = "'Bevan', Rockwell, Georgia, serif";
const FONT_U = "'Barlow Condensed', Oswald, 'Arial Narrow', system-ui, sans-serif";

const C = {
  night: "#0E1F26",
  nightDeep: "#081418",
  pine: "#0C2A22",
  bark: "#2E2116",
  barkLight: "#4A3524",
  barkDark: "#1A1109",
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
   Scenery — generated once from a fixed seed so the night sky
   is hand-made-looking but identical on every load.
   ============================================================ */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Overlapping triangles read as a pine ridge without needing per-tree markup. */
function treeline(rng, { base, min, max, step, jitter = 0.35 }) {
  let d = `M-20 ${base + 120} L-20 ${base}`;
  let x = -20;
  while (x < INNER_W + 20) {
    const half = step * (0.5 + rng() * jitter);
    const h = min + rng() * (max - min);
    d += ` L${(x + half).toFixed(1)} ${(base - h).toFixed(1)} L${(x + half * 2).toFixed(1)} ${base}`;
    x += half * 2 * (0.68 + rng() * 0.22);
  }
  return `${d} L${INNER_W + 20} ${base} L${INNER_W + 20} ${base + 120} Z`;
}

function ridgeline(rng, { base, min, max, step }) {
  let d = `M-20 ${base + 120} L-20 ${base}`;
  let x = -20;
  while (x < INNER_W + 20) {
    const w = step * (0.6 + rng() * 0.8);
    const h = min + rng() * (max - min);
    d += ` L${(x + w * 0.5).toFixed(1)} ${(base - h).toFixed(1)} L${(x + w).toFixed(1)} ${(base - h * 0.18).toFixed(1)}`;
    x += w;
  }
  return `${d} L${INNER_W + 20} ${base + 120} Z`;
}

/* Scene depth is tuned to the board silhouette: the ridges and treelines top
   out in the wedge of sky the short columns leave open on the left. */
const SCENE = (() => {
  const rng = mulberry32(20250807);
  const stars = [];
  for (let i = 0; i < 95; i++) {
    stars.push({
      x: +(rng() * INNER_W).toFixed(1),
      y: +(rng() * 460).toFixed(1),
      r: +(0.5 + rng() * 1.3).toFixed(2),
      o: +(0.2 + rng() * 0.7).toFixed(2),
      tw: rng() < 0.22 ? +(rng() * 4).toFixed(2) : null,
    });
  }
  return {
    stars,
    farRidge: ridgeline(rng, { base: 440, min: 58, max: 128, step: 106 }),
    midTrees: treeline(rng, { base: 506, min: 52, max: 106, step: 30 }),
    nearTrees: treeline(rng, { base: 748, min: 96, max: 176, step: 44, jitter: 0.5 }),
  };
})();

const NightScene = React.memo(function NightScene() {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden" }}>
      {/* sky */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(180deg,#04101A 0%,#082230 26%,#10404E 52%,#0B2E33 74%,#061A16 100%)",
        }}
      />

      {/* aurora wash */}
      <div
        style={{
          position: "absolute",
          left: -60,
          top: 60,
          width: INNER_W + 140,
          height: 260,
          background:
            "radial-gradient(60% 50% at 30% 60%, rgba(79,179,165,.20), transparent 70%)," +
            "radial-gradient(50% 46% at 72% 40%, rgba(111,191,115,.14), transparent 72%)",
          filter: "blur(14px)",
        }}
      />

      {/* stars */}
      <svg
        viewBox={`0 0 ${INNER_W} 460`}
        width={INNER_W}
        height={460}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        {SCENE.stars.map((s, i) => (
          <circle
            key={i}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#F3F7E8"
            opacity={s.o}
            className={s.tw != null ? "cg-twinkle" : undefined}
            style={s.tw != null ? { animationDelay: `${s.tw}s` } : undefined}
          />
        ))}
      </svg>

      {/* moon + halo, sitting in the wedge of sky the short columns leave open */}
      <div
        style={{
          position: "absolute",
          left: 84,
          top: 196,
          width: 210,
          height: 210,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(244,239,216,.32) 0%, rgba(244,239,216,.09) 34%, transparent 66%)",
        }}
      />
      <svg viewBox="0 0 68 68" width={68} height={68} style={{ position: "absolute", left: 155, top: 267 }}>
        <circle cx="34" cy="34" r="26" fill="url(#cgMoon)" />
        <circle cx="26" cy="27" r="5" fill="#D9D2B6" opacity=".5" />
        <circle cx="41" cy="40" r="7" fill="#D9D2B6" opacity=".36" />
        <circle cx="38" cy="21" r="3" fill="#D9D2B6" opacity=".42" />
      </svg>

      {/* ridge + treelines */}
      <svg
        viewBox={`0 0 ${INNER_W} ${INNER_H}`}
        width={INNER_W}
        height={INNER_H}
        style={{ position: "absolute", left: 0, top: 0 }}
      >
        <path d={SCENE.farRidge} fill="#0B2733" opacity=".92" />
        <path d={SCENE.farRidge} fill="url(#cgRidgeLight)" opacity=".5" />
        <path d={SCENE.midTrees} fill="#08201F" />
        <path d={SCENE.nearTrees} fill="#04120F" />
      </svg>

      {/* ground fog above the near treeline */}
      <div
        style={{
          position: "absolute",
          left: -40,
          top: 520,
          width: INNER_W + 80,
          height: 96,
          background: "linear-gradient(180deg, transparent, rgba(120,190,190,.13) 55%, transparent)",
          filter: "blur(9px)",
        }}
      />

      {/* vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: "radial-gradient(120% 78% at 50% 42%, transparent 42%, rgba(0,0,0,.55) 100%)",
        }}
      />
    </div>
  );
});

/* Shared gradient defs — declared once so the SVGs below can reference them
   without minting duplicate ids per instance. */
const SceneDefs = React.memo(function SceneDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <radialGradient id="cgMoon" cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor="#FFFDF2" />
          <stop offset="100%" stopColor="#CFC7A8" />
        </radialGradient>
        <linearGradient id="cgRidgeLight" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="#12414E" stopOpacity="0" />
          <stop offset="100%" stopColor="#2A6B76" stopOpacity=".7" />
        </linearGradient>
        <linearGradient id="cgBag" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C79A5C" />
          <stop offset="55%" stopColor="#A87F49" />
          <stop offset="100%" stopColor="#7E5C31" />
        </linearGradient>
        <linearGradient id="cgPost" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3A2A1C" />
          <stop offset="45%" stopColor="#6B4E32" />
          <stop offset="100%" stopColor="#2C1F14" />
        </linearGradient>
      </defs>
    </svg>
  );
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
    <path d="M24 6 L28 20 H15 Z M24 15 L30 30 H12 Z M24 24 L32 40 H9 Z" fill="rgba(255,255,255,.09)" />
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

const Cell = React.memo(function Cell({ camper, spinning, seed, flashing }) {
  const F = FILLERS[seed % FILLERS.length];
  const held = !!camper;
  const accent = held ? (camper.jackpot ? JP_COLOR[camper.jackpot] : C.lantern) : null;

  return (
    <div
      style={{
        width: CELL,
        height: CELL,
        borderRadius: 9,
        position: "relative",
        overflow: "hidden",
        background: held
          ? `radial-gradient(circle at 50% 22%, ${accent}33, rgba(0,0,0,.55) 72%)`
          : "radial-gradient(circle at 50% 30%, #10242A, #08151A 78%)",
        border: held ? `2px solid ${accent}` : `1px solid ${C.slotLine}`,
        boxShadow: held
          ? `0 0 14px ${accent}88, 0 0 34px ${accent}30, inset 0 0 18px rgba(0,0,0,.55)`
          : "inset 0 2px 7px rgba(0,0,0,.65), inset 0 -1px 0 rgba(255,255,255,.04)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "border-color .2s, box-shadow .25s, background .25s",
      }}
    >
      {/* lantern light falling from the top of an occupied site */}
      {held && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, ${accent}2E, transparent 58%)`,
            pointerEvents: "none",
          }}
        />
      )}

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
          key="held"
          className="cg-land"
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            padding: 3,
            position: "relative",
          }}
        >
          <div style={{ width: "74%", height: "56%", filter: "drop-shadow(0 2px 3px rgba(0,0,0,.55))" }}>
            <CamperArt tier={camper.tier} jackpot={camper.jackpot} />
          </div>
          <div
            style={{
              marginTop: 2,
              fontFamily: FONT_U,
              fontWeight: 700,
              fontSize: camper.jackpot ? 11 : 15,
              letterSpacing: camper.jackpot ? ".07em" : "0",
              lineHeight: 1,
              color: camper.jackpot ? "#12080A" : "#1A2A22",
              background: camper.jackpot
                ? `linear-gradient(180deg, ${JP_COLOR[camper.jackpot]}, ${JP_COLOR[camper.jackpot]}C0)`
                : "linear-gradient(180deg, #F5EDD6, #D9CBA8)",
              borderRadius: 4,
              padding: "1px 6px",
              boxShadow: "0 1px 0 rgba(0,0,0,.5), inset 0 1px 0 rgba(255,255,255,.5)",
            }}
          >
            {camper.jackpot ? camper.jackpot : camper.value}
          </div>
        </div>
      ) : (
        <div
          key="empty"
          className={spinning ? "cg-spin" : ""}
          style={{ width: "62%", height: "62%", opacity: spinning ? 0.45 : 0.72 }}
        >
          <F />
        </div>
      )}
    </div>
  );
});

/* ============================================================
   Signpost counter — nights left on the booking
   ============================================================ */

function Signpost({ n }) {
  const active = n != null;
  const hot = active && n <= 1;

  return (
    <div
      style={{
        width: CELL,
        height: 40,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        opacity: active ? 1 : 0.3,
        transition: "opacity .25s",
      }}
    >
      <div
        className={hot ? "cg-pulse" : ""}
        style={{
          width: 46,
          height: 26,
          visibility: active ? "visible" : "hidden",
          borderRadius: 4,
          background: hot
            ? `linear-gradient(180deg, #E8633C, ${C.ember})`
            : "linear-gradient(180deg, #4A3524, #2A1E14)",
          border: `2px solid ${hot ? "#FFC670" : "#6B4E32"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: FONT_U,
          fontWeight: 700,
          fontSize: 17,
          color: hot ? "#FFF3C4" : C.canvas,
          boxShadow: hot
            ? `0 0 14px ${C.ember}, inset 0 1px 0 rgba(255,255,255,.25)`
            : "0 2px 5px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.12)",
          position: "relative",
        }}
      >
        {active ? n : ""}
      </div>
      {/* post */}
      <svg viewBox="0 0 10 16" width="10" height="16" style={{ marginTop: -1 }}>
        <rect x="3" y="0" width="4" height="16" fill="url(#cgPost)" />
      </svg>
    </div>
  );
}

/* ============================================================
   Money bag
   ============================================================ */

function Bag({ total, popping }) {
  const filled = total > 0;
  return (
    <div
      style={{
        width: CELL,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <div
        className={popping ? "cg-pop" : ""}
        style={{
          width: 46,
          height: 44,
          position: "relative",
          opacity: filled ? 1 : 0.42,
          filter: filled ? `drop-shadow(0 0 7px ${C.lantern}55)` : "none",
          transition: "opacity .3s",
        }}
      >
        <svg viewBox="0 0 52 50" width="46" height="44">
          <path d="M18 7 Q26 2 34 7 L33 12 L19 12 Z" fill="#7E6238" stroke="#4E3C21" strokeWidth="1.5" />
          <path d="M20 12 Q4 26 10 40 Q14 48 26 48 Q38 48 42 40 Q48 26 32 12 Z" fill="url(#cgBag)" stroke="#5F4726" strokeWidth="1.5" />
          <path d="M22 16 Q11 27 14 37" stroke="rgba(255,255,255,.28)" strokeWidth="3" strokeLinecap="round" fill="none" />
          <path d="M18 12 H34" stroke="#4E3C21" strokeWidth="2.5" strokeLinecap="round" />
          <text x="26" y="37" textAnchor="middle" fontFamily={FONT_D} fontSize="15" fill="#3F3417">
            $
          </text>
        </svg>
      </div>
      <div
        style={{
          fontFamily: FONT_U,
          fontWeight: 700,
          fontSize: 14,
          color: filled ? C.gold : "rgba(232,220,192,.3)",
          letterSpacing: ".03em",
          textShadow: filled ? "0 0 8px rgba(255,209,102,.45)" : "none",
        }}
      >
        {total.toLocaleString()}
      </div>
    </div>
  );
}

/* ============================================================
   Jackpot ladder
   ============================================================ */

const JP_TIER = {
  GRAND: { w: 306, pad: "5px 16px 6px", label: 12, value: 30, bulbs: true },
  MAJOR: { w: 244, pad: "4px 14px 5px", label: 10, value: 23 },
  MINOR: { w: 116, pad: "3px 8px 4px", label: 9, value: 17 },
  MINI: { w: 116, pad: "3px 8px 4px", label: 9, value: 17 },
};

function JPBanner({ label, value }) {
  const t = JP_TIER[label];
  const col = JP_COLOR[label];
  return (
    <div
      style={{
        position: "relative",
        width: t.w,
        padding: t.pad,
        textAlign: "center",
        borderRadius: 9,
        border: `2px solid ${col}`,
        background: `linear-gradient(180deg, ${col}2E, rgba(4,10,14,.86) 62%, rgba(0,0,0,.9))`,
        boxShadow: `0 0 ${t.bulbs ? 22 : 10}px ${col}55, inset 0 1px 0 ${col}55, 0 3px 10px rgba(0,0,0,.6)`,
        overflow: "hidden",
      }}
    >
      {t.bulbs && <div className="cg-shine" style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />}
      <div
        style={{
          fontFamily: FONT_D,
          fontSize: t.label,
          letterSpacing: ".22em",
          textIndent: ".22em",
          color: col,
          textShadow: `0 0 10px ${col}, 0 1px 0 rgba(0,0,0,.6)`,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONT_U,
          fontWeight: 700,
          fontSize: t.value,
          lineHeight: 1.06,
          color: "#FFF8E4",
          textShadow: `0 0 12px ${col}66, 0 2px 6px rgba(0,0,0,.85)`,
        }}
      >
        {value.toLocaleString()}
      </div>
    </div>
  );
}

/* ============================================================
   Title — a carved sign hanging on the left rail
   ============================================================ */

const TitleSign = React.memo(function TitleSign() {
  return (
    <div style={{ position: "absolute", left: 9, top: 206, width: 48, zIndex: 3, textAlign: "center" }}>
      {/* chains it hangs from */}
      <svg viewBox="0 0 48 16" width="48" height="16" style={{ display: "block" }}>
        <path d="M12 0 V15 M36 0 V15" stroke="#5C4A33" strokeWidth="2" strokeDasharray="3 2.5" />
      </svg>

      <div
        style={{
          borderRadius: 7,
          padding: "9px 0 10px",
          background:
            "linear-gradient(90deg, #241A10, #4A3524 26%, #3A2A1A 62%, #21170E)," +
            "repeating-linear-gradient(2deg, rgba(0,0,0,.16) 0 4px, transparent 4px 9px)",
          border: "2px solid #6B4E32",
          boxShadow: "0 6px 16px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.16)",
        }}
      >
        <div
          style={{
            writingMode: "vertical-rl",
            textOrientation: "upright",
            margin: "0 auto",
            fontFamily: FONT_D,
            fontSize: 16,
            /* in vertical-upright text the line box is the glyph advance —
               left at the default the sign stretches half the cabinet */
            lineHeight: 1.04,
            letterSpacing: ".02em",
            color: C.lantern,
            textShadow: "0 1px 0 #3A2408, 0 0 13px rgba(242,169,59,.75)",
          }}
        >
          CAMPGROUND
        </div>
      </div>

      <div
        style={{
          marginTop: 6,
          fontFamily: FONT_U,
          fontWeight: 600,
          fontSize: 8,
          letterSpacing: ".1em",
          textIndent: ".1em",
          color: "rgba(232,220,192,.55)",
        }}
      >
        HOLD &amp; SPIN
      </div>

      {/* lantern hanging below, lighting the rail */}
      <div
        style={{
          width: 26,
          height: 28,
          margin: "8px auto 0",
          filter: "drop-shadow(0 0 10px rgba(242,201,107,.8))",
        }}
      >
        <Lantern />
      </div>
    </div>
  );
});

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
  const [bustCols, setBustCols] = useState([]);
  const [popBag, setPopBag] = useState(null);
  const [scale, setScale] = useState(null);

  const timers = useRef([]);
  const colsRef = useRef(cols);
  colsRef.current = cols;

  /* fit the cabinet to the viewport */
  useLayoutEffect(() => {
    const fit = () => {
      const vv = window.visualViewport;
      const w = vv ? vv.width : window.innerWidth;
      const h = vv ? vv.height : window.innerHeight;
      const k = Math.min((w - VIEWPORT_PAD) / CAB_W, (h - VIEWPORT_PAD) / CAB_H);
      setScale(Math.max(0.15, Math.min(k, MAX_SCALE)));
    };
    fit();
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    window.visualViewport?.addEventListener("resize", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
      window.visualViewport?.removeEventListener("resize", fit);
    };
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
    /* the last event stays on the ticker through the spin rather than blanking
       it for ~1.5s and leaving an empty strip on a no-event spin */
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
        setBustCols(checkouts);
        later(() => setBustCols([]), 700);
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
    setFlashCol(null);
    setBustCols([]);
    setPopBag(null);
    setSpinning([false, false, false, false, false]);
    setMsg("Fresh season. Gate's open.");
  };

  const spinDisabled = busy || balance < BET;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `radial-gradient(ellipse 90% 60% at 50% 0%, #123039 0%, #0A1A20 45%, ${C.nightDeep} 100%)`,
        touchAction: "manipulation",
      }}
    >
      <style>{`
        @keyframes cgSpin { 0%{transform:translateY(-14px)} 100%{transform:translateY(14px)} }
        .cg-spin { animation: cgSpin .09s linear infinite alternate; filter: blur(1.2px); }
        @keyframes cgPulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.13)} }
        .cg-pulse { animation: cgPulse .6s ease-in-out infinite; }
        @keyframes cgFlash { 0%,100%{opacity:0} 50%{opacity:.85} }
        .cg-flash { animation: cgFlash .22s ease-in-out infinite; }
        @keyframes cgPop { 0%{transform:scale(1)} 40%{transform:scale(1.26) rotate(-4deg)} 100%{transform:scale(1)} }
        .cg-pop { animation: cgPop .5s ease-out infinite; }
        @keyframes cgLand { 0%{transform:scale(1.3);opacity:0} 55%{transform:scale(.96);opacity:1} 100%{transform:scale(1)} }
        .cg-land { animation: cgLand .3s cubic-bezier(.2,.9,.3,1.4) both; }
        @keyframes cgTwinkle { 0%,100%{opacity:.15} 50%{opacity:1} }
        .cg-twinkle { animation: cgTwinkle 3.6s ease-in-out infinite; }
        @keyframes cgShine { 0%{transform:translateX(-120%)} 55%,100%{transform:translateX(120%)} }
        .cg-shine::after {
          content:""; position:absolute; inset:0;
          background: linear-gradient(105deg, transparent 38%, rgba(255,244,214,.28) 50%, transparent 62%);
          animation: cgShine 4.5s ease-in-out infinite;
        }
        @keyframes cgBust { 0%,100%{opacity:0} 30%,60%{opacity:1} }
        .cg-bust { animation: cgBust .7s ease-in-out; }

        .cg-btn { transition: transform .08s, filter .15s, box-shadow .15s; }
        .cg-btn:hover:not(:disabled) { filter: brightness(1.14); }
        .cg-btn:active:not(:disabled) { transform: translateY(2px); }
        .cg-btn:focus-visible { outline: 3px solid ${C.lantern}; outline-offset: 3px; }
        .cg-btn:disabled { cursor: default; }

        @media (prefers-reduced-motion: reduce) {
          .cg-spin,.cg-pulse,.cg-flash,.cg-pop,.cg-land,.cg-twinkle,.cg-bust { animation: none !important; filter: none !important; }
          .cg-shine::after { animation: none !important; opacity: .1; }
        }
      `}</style>

      <SceneDefs />

      {/* Layout box matches the *painted* size, so a scaled-down cabinet can
          never push the document past the viewport and make the page scroll. */}
      <div
        style={{
          width: scale == null ? CAB_W : CAB_W * scale,
          height: scale == null ? CAB_H : CAB_H * scale,
          position: "relative",
          flexShrink: 0,
          visibility: scale == null ? "hidden" : "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            width: CAB_W,
            height: CAB_H,
            boxSizing: "border-box",
            transform: `scale(${scale ?? 1})`,
            transformOrigin: "top left",
            borderRadius: 22,
            border: `${FRAME}px solid transparent`,
            background:
              `linear-gradient(180deg, #071A24, ${C.pine}) padding-box,` +
              "repeating-linear-gradient(96deg, #43301D 0 5px, #2E2116 5px 10px, #221709 10px 14px) border-box",
            boxShadow:
              "0 34px 90px rgba(0,0,0,.85), 0 0 0 1px rgba(255,226,170,.10), inset 0 0 0 2px rgba(0,0,0,.55)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: `${PAD_T}px 0 ${PAD_B}px`,
            overflow: "hidden",
          }}
        >
          <NightScene />

          {/* glass glare */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 6,
              background:
                "linear-gradient(112deg, rgba(255,255,255,.055) 0%, rgba(255,255,255,.015) 26%, transparent 44%)",
            }}
          />

          {/* ---- jackpot ladder ---- */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
              zIndex: 2,
            }}
          >
            <JPBanner label="GRAND" value={jp.GRAND} />
            <JPBanner label="MAJOR" value={jp.MAJOR} />
            <div style={{ display: "flex", gap: 12 }}>
              <JPBanner label="MINOR" value={jp.MINOR} />
              <JPBanner label="MINI" value={jp.MINI} />
            </div>
          </div>

          <TitleSign />

          {/* ---- board ---- */}
          <div
            style={{
              marginTop: "auto",
              width: BOARD_W,
              display: "flex",
              alignItems: "flex-end",
              gap: COL_GAP,
              zIndex: 2,
            }}
          >
            {cols.map((col, i) => {
              const booked = col.counter != null;
              return (
                <div
                  key={i}
                  style={{
                    width: CELL,
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                    gap: ROW_GAP,
                  }}
                >
                  {/* site frame — drawn outside the column box so it never
                      widens the pitch the signposts and bags align to */}
                  <div
                    style={{
                      position: "absolute",
                      inset: -FRAME_INSET,
                      borderRadius: 12,
                      background: "linear-gradient(180deg, rgba(0,0,0,.30), rgba(0,0,0,.48))",
                      border: `1px solid ${booked ? "rgba(242,169,59,.55)" : "rgba(200,230,235,.08)"}`,
                      boxShadow: booked
                        ? "0 0 16px rgba(242,169,59,.22), inset 0 1px 0 rgba(255,255,255,.06)"
                        : "inset 0 1px 0 rgba(255,255,255,.04)",
                      transition: "border-color .25s, box-shadow .25s",
                    }}
                  />
                  {bustCols.includes(i) && (
                    <div
                      className="cg-bust"
                      style={{
                        position: "absolute",
                        inset: -FRAME_INSET,
                        borderRadius: 12,
                        border: `2px solid ${C.ember}`,
                        background: "rgba(217,80,43,.18)",
                        boxShadow: `0 0 22px ${C.ember}88`,
                        pointerEvents: "none",
                        zIndex: 4,
                      }}
                    />
                  )}

                  {col.cells.map((camper, k) => (
                    <div key={k} style={{ position: "relative", zIndex: 1 }}>
                      <Cell
                        camper={camper}
                        spinning={spinningCols[i]}
                        seed={camper ? 0 : seed + i * 7 + k * 3}
                        flashing={flashCol === i}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {/* ---- counters ---- */}
          <div style={{ display: "flex", gap: COL_GAP, marginTop: 10, width: BOARD_W, zIndex: 2 }}>
            {cols.map((col, i) => (
              <Signpost key={i} n={col.cells.some(Boolean) ? col.counter : null} />
            ))}
          </div>

          {/* ---- bags ---- */}
          <div style={{ display: "flex", gap: COL_GAP, marginTop: 4, width: BOARD_W, zIndex: 2 }}>
            {bags.map((t, i) => (
              <Bag key={i} total={t} popping={popBag === i} />
            ))}
          </div>

          {/* ---- status line ---- */}
          <div
            style={{
              marginTop: 8,
              width: BOARD_W,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: 6,
              background: "rgba(0,0,0,.34)",
              border: "1px solid rgba(200,230,235,.07)",
              fontFamily: FONT_U,
              fontWeight: 600,
              fontSize: 15,
              letterSpacing: ".04em",
              color: win > 0 ? C.gold : "rgba(232,220,192,.72)",
              textShadow: win > 0 ? "0 0 10px rgba(255,209,102,.5)" : "none",
              zIndex: 2,
            }}
          >
            {win > 0 ? `WIN ${win.toLocaleString()}` : msg}
          </div>

          {/* ---- controls ---- */}
          <div
            style={{
              marginTop: "auto",
              width: INNER_W - 30,
              display: "flex",
              alignItems: "center",
              gap: 10,
              background:
                "linear-gradient(180deg, rgba(74,53,36,.55), rgba(12,8,4,.85))," +
                "repeating-linear-gradient(91deg, rgba(255,255,255,.02) 0 3px, transparent 3px 7px)",
              border: `2px solid ${C.barkLight}`,
              borderRadius: 12,
              padding: "8px 12px",
              boxShadow: "0 6px 18px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.10)",
              zIndex: 2,
            }}
          >
            <div style={{ ...meterBox, flex: 1 }}>
              <div style={label}>CREDITS</div>
              <div style={readout}>{balance.toLocaleString()}</div>
            </div>
            <div style={meterBox}>
              <div style={label}>BET</div>
              <div style={readout}>{BET}</div>
            </div>

            <button
              className="cg-btn"
              onClick={() => setAuto((a) => !a)}
              aria-pressed={auto}
              style={{
                ...btn,
                background: auto
                  ? `linear-gradient(180deg, #E8633C, ${C.ember})`
                  : "linear-gradient(180deg, rgba(74,53,36,.5), rgba(0,0,0,.35))",
                color: auto ? "#FFF3C4" : C.canvas,
                border: `2px solid ${auto ? C.lantern : C.barkLight}`,
                boxShadow: auto
                  ? `0 0 14px ${C.ember}99, inset 0 1px 0 rgba(255,255,255,.25)`
                  : "inset 0 1px 0 rgba(255,255,255,.09)",
                width: 62,
                fontSize: 12,
              }}
            >
              AUTO
            </button>

            <button
              className="cg-btn"
              onClick={spin}
              disabled={spinDisabled}
              style={{
                ...btn,
                width: 112,
                fontSize: 18,
                background: spinDisabled
                  ? "linear-gradient(180deg, #4A4A4A, #303030)"
                  : `linear-gradient(180deg, #FFD98A 0%, ${C.lantern} 42%, #B86A16 100%)`,
                color: spinDisabled ? "#7C7C7C" : "#2A1A08",
                border: `2px solid ${spinDisabled ? "#5A5A5A" : "#FFE9BC"}`,
                boxShadow: spinDisabled
                  ? "inset 0 1px 0 rgba(255,255,255,.06)"
                  : "0 0 20px rgba(242,169,59,.5), inset 0 1px 0 rgba(255,255,255,.65), inset 0 -3px 8px rgba(0,0,0,.28)",
                textShadow: spinDisabled ? "none" : "0 1px 0 rgba(255,255,255,.35)",
              }}
            >
              SPIN
            </button>

            <button className="cg-btn" onClick={reset} style={{ ...btn, width: 56, fontSize: 11 }}>
              RESET
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const label = {
  fontFamily: FONT_U,
  fontSize: 9,
  fontWeight: 600,
  letterSpacing: ".18em",
  textIndent: ".18em",
  color: "rgba(232,220,192,.5)",
};
const readout = {
  fontFamily: FONT_U,
  fontWeight: 700,
  fontSize: 21,
  color: C.gold,
  lineHeight: 1,
  textShadow: "0 0 10px rgba(255,209,102,.45)",
};
const meterBox = {
  padding: "3px 9px 4px",
  borderRadius: 7,
  background: "rgba(0,0,0,.5)",
  border: "1px solid rgba(255,225,170,.12)",
  boxShadow: "inset 0 2px 6px rgba(0,0,0,.7)",
};
const btn = {
  fontFamily: FONT_D,
  letterSpacing: ".06em",
  padding: "9px 0",
  borderRadius: 9,
  background: "linear-gradient(180deg, rgba(74,53,36,.5), rgba(0,0,0,.35))",
  color: C.canvas,
  border: `2px solid ${C.barkLight}`,
  boxShadow: "inset 0 1px 0 rgba(255,255,255,.09)",
  cursor: "pointer",
};
