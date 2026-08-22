import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useMotionValue, useSpring, useReducedMotion, MotionConfig } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/App";
import { useTheme } from "@/context/ThemeContext";
import {
  Zap,
  Bot,
  Puzzle,
  Trophy,
  ChevronRight,
  Menu,
  X,
  Play,
  Sun,
  Moon,
} from "lucide-react";

/* Nav stays minimal: Dashboard, News, and the auth action.
   Leaderboard / Wallet / Profile / Admin live in the app shell, not here. */
const LOGO_URL = "/stakechess-logo.png";

/* Shared button spring — used everywhere a Button/icon-button gets
   hover/tap physics instead of the flatter CSS transition. */
const BUTTON_SPRING = { type: "spring", stiffness: 500, damping: 30 };

const MotionButton = motion(Button);

const NAV_LINKS = [
  { to: "/lobby", label: "Dashboard" },
  { to: "/news", label: "News" },
];

const STATS = [
  { value: "12,456", label: "Players online", dot: "var(--green)" },
  { value: "$152.48K", label: "Prize pool" },
  { value: "84,331", label: "Games today" },
  { value: "$8,420", label: "Total wagered" },
  { value: "842", label: "Live matches", dot: "var(--red)" },
];

/**
 * Hero board pieces. Positions are file/rank on an 8x8 grid (0-7 from the
 * near edge). `hero: true` marks the king as the visual anchor the glow
 * pools under. Index order here is what MOVE_SEQUENCES below refers to.
 */
const HERO_PIECES = [
  // 0
  { p: "♚", f: 4, r: 3, size: 1.0, tone: "dark", hero: true },
  // 1
  { p: "♞", f: 2, r: 4, size: 0.52, tone: "light" },
  // 2
  { p: "♝", f: 6, r: 4, size: 0.48, tone: "light" },
  // 3
  { p: "♜", f: 1, r: 2, size: 0.42, tone: "dark" },
  // 4
  { p: "♟", f: 5, r: 5, size: 0.34, tone: "light" },
  // 5
  { p: "♟", f: 3, r: 5, size: 0.34, tone: "dark" },
];

/* One of these is picked at random on every mount, so the hero plays a
   different move on every load/refresh. Each entry moves exactly one
   piece (by its index in HERO_PIECES above) to a new square — kept to
   short, plausible-looking hops rather than full legal chess. */
const MOVE_SEQUENCES = [
  { pieceIndex: 1, toF: 4, toR: 5 }, // knight hops toward center
  { pieceIndex: 2, toF: 3, toR: 1 }, // bishop cuts across the diagonal
  { pieceIndex: 3, toF: 1, toR: 6 }, // rook slides down the file
  { pieceIndex: 4, toF: 5, toR: 4 }, // pawn advances one
  { pieceIndex: 5, toF: 2, toR: 4 }, // pawn advances toward the knight
  { pieceIndex: 2, toF: 4, toR: 6 }, // bishop threatens deep
];

/* Unicode glyph -> piece type, so HERO_PIECES (above) doesn't need to
   change shape to support the SVG renderer below. */
const PIECE_TYPE_FROM_GLYPH = {
  "♚": "k",
  "♛": "q",
  "♝": "b",
  "♞": "n",
  "♜": "r",
  "♟": "p",
};

/**
 * Premium piece silhouette, built from primitive SVG shapes (no external
 * art assets) and shaded with a gradient + soft top highlight so it reads
 * as a polished, dimensional object rather than a flat glyph. Kept purely
 * declarative/static so it's cheap to render 6x per board.
 */
function ChessPieceGlyph({ type, tone, isDark, gradId }) {
  const isDarkTone = tone === "dark";
  const stops = isDarkTone
    ? isDark
      ? ["#4B4470", "#2A2440", "#131022"]
      : ["#4A4468", "#2C2748", "#171325"]
    : isDark
    ? ["#FFFDFB", "#E7E0F7", "#C7BEE8"]
    : ["#FFFFFF", "#EFEAFA", "#D8D1F0"];
  const rim = isDarkTone
    ? isDark
      ? "rgba(180,150,255,.55)"
      : "rgba(120,90,200,.35)"
    : isDark
    ? "rgba(255,255,255,.5)"
    : "rgba(255,255,255,.9)";
  const fill = `url(#${gradId})`;

  const base = <ellipse cx="32" cy="83" rx="19" ry="5.5" fill={fill} stroke={rim} strokeWidth="0.75" />;
  const highlight = (
    <ellipse cx="27" cy="30" rx="7" ry="12" fill="#FFFFFF" opacity={isDarkTone ? 0.14 : 0.5} />
  );

  let body = null;
  switch (type) {
    case "p":
      body = (
        <>
          <path d="M21,79 C21,62 27,53 25,42 C25,36 39,36 39,42 C37,53 43,62 43,79 Z" fill={fill} stroke={rim} strokeWidth="0.75" />
          <ellipse cx="32" cy="42" rx="9" ry="3.5" fill={fill} stroke={rim} strokeWidth="0.6" />
          <circle cx="32" cy="27" r="11" fill={fill} stroke={rim} strokeWidth="0.75" />
        </>
      );
      break;
    case "r":
      body = (
        <>
          <path d="M19,79 C19,60 24,55 22,46 L42,46 C40,55 45,60 45,79 Z" fill={fill} stroke={rim} strokeWidth="0.75" />
          <rect x="15" y="38" width="34" height="9" rx="2" fill={fill} stroke={rim} strokeWidth="0.6" />
          <rect x="17" y="14" width="8" height="18" fill={fill} stroke={rim} strokeWidth="0.6" />
          <rect x="28" y="14" width="8" height="18" fill={fill} stroke={rim} strokeWidth="0.6" />
          <rect x="39" y="14" width="8" height="18" fill={fill} stroke={rim} strokeWidth="0.6" />
          <rect x="15" y="30" width="34" height="6" fill={fill} stroke={rim} strokeWidth="0.6" />
        </>
      );
      break;
    case "n":
      body = (
        <path
          d="M22,79 C22,68 25,62 24,55 C19,52 16,44 19,36 C21,29 27,24 31,20 C29,16 30,11 34,9 C39,7 46,10 47,16 C48,20 45,22 42,21 C44,25 43,29 39,30 C42,33 42,38 38,41 C41,45 42,51 39,56 C43,60 44,68 42,79 Z"
          fill={fill}
          stroke={rim}
          strokeWidth="0.75"
        />
      );
      break;
    case "b":
      body = (
        <>
          <path
            d="M23,79 C21,62 25,54 27,46 C23,42 23,35 27,31 C23,27 25,20 32,15 C39,20 41,27 37,31 C41,35 41,42 37,46 C39,54 43,62 41,79 Z"
            fill={fill}
            stroke={rim}
            strokeWidth="0.75"
          />
          <circle cx="32" cy="10" r="4.5" fill={fill} stroke={rim} strokeWidth="0.6" />
          <rect x="29" y="24" width="6" height="1.6" fill={rim} opacity="0.8" transform="rotate(35 32 25)" />
        </>
      );
      break;
    case "q":
      body = (
        <>
          <path
            d="M18,79 C18,58 26,52 24,40 C22,32 42,32 40,40 C38,52 46,58 46,79 Z"
            fill={fill}
            stroke={rim}
            strokeWidth="0.75"
          />
          <rect x="16" y="32" width="32" height="6" rx="2" fill={fill} stroke={rim} strokeWidth="0.6" />
          {[16, 24, 32, 40, 48].map((cx) => (
            <circle key={cx} cx={cx} cy="20" r="3.6" fill={fill} stroke={rim} strokeWidth="0.6" />
          ))}
        </>
      );
      break;
    case "k":
    default:
      body = (
        <>
          <path
            d="M18,79 C18,58 26,52 24,40 C22,32 42,32 40,40 C38,52 46,58 46,79 Z"
            fill={fill}
            stroke={rim}
            strokeWidth="0.75"
          />
          <rect x="17" y="33" width="30" height="6" rx="2" fill={fill} stroke={rim} strokeWidth="0.6" />
          <rect x="29" y="10" width="4" height="18" fill={fill} stroke={rim} strokeWidth="0.6" />
          <rect x="22" y="16" width="18" height="4" fill={fill} stroke={rim} strokeWidth="0.6" />
        </>
      );
      break;
  }

  return (
    <svg viewBox="0 0 64 90" width="100%" height="100%" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stops[0]} />
          <stop offset="55%" stopColor={stops[1]} />
          <stop offset="100%" stopColor={stops[2]} />
        </linearGradient>
      </defs>
      {base}
      {body}
      {highlight}
    </svg>
  );
}

/* ---------------------------------------------------------------
   Hero board.

   A live 8x8 board (not a static image) so pieces are real, individually
   animated elements: one plays a short, randomly-chosen move shortly
   after load, the rest idle with a slow float, and the whole board
   tilts gently toward the pointer for a sense of depth. Square colours
   come straight from the theme tokens (--sq-light/--sq-dark/--sq-highlight)
   so it reads correctly in both themes without any extra styling here.

   Visual redesign: the board sits inside a CSS-3D isometric frame
   (rotateX + rotateZ on a `perspective`d ancestor) so it reads as a
   physical, floating slab rather than a flat top-down grid. Pieces are
   billboarded — each is counter-rotated back to face the camera so they
   stand upright on the tilted surface instead of lying flat on it — while
   staying positioned via the exact same file/rank math used before.
   --------------------------------------------------------------- */
function HeroBoard() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const prefersReducedMotion = useReducedMotion();

  const [pieces, setPieces] = useState(() => HERO_PIECES.map((pc) => ({ ...pc })));
  const [move] = useState(
    () => MOVE_SEQUENCES[Math.floor(Math.random() * MOVE_SEQUENCES.length)]
  );

  useEffect(() => {
    if (prefersReducedMotion) return;
    // small delay so the move reads as deliberate, not a load glitch
    const t = setTimeout(() => {
      setPieces((prev) =>
        prev.map((pc, i) =>
          i === move.pieceIndex ? { ...pc, f: move.toF, r: move.toR } : pc
        )
      );
    }, 1100);
    return () => clearTimeout(t);
  }, [move, prefersReducedMotion]);

  // Pointer-tilt parallax on the board itself. Smoothed with a spring so
  // it settles rather than snapping straight to the cursor.
  const rawRotateX = useMotionValue(0);
  const rawRotateY = useMotionValue(0);
  const rotateX = useSpring(rawRotateX, { stiffness: 120, damping: 16 });
  const rotateY = useSpring(rawRotateY, { stiffness: 120, damping: 16 });

  const handlePointerMove = (e) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    rawRotateY.set(px * 9);
    rawRotateX.set(py * -9);
  };
  const handlePointerLeave = () => {
    rawRotateX.set(0);
    rawRotateY.set(0);
  };

  // Lightweight device-tilt parallax for mobile, where there's no pointer.
  // Browsers that expose orientation events freely (Android, older iOS)
  // get it immediately. iOS 13+ Safari gates deviceorientation behind
  // DeviceOrientationEvent.requestPermission(), which itself only resolves
  // when called from inside a user gesture — it can't be called on load.
  // Rather than show a dedicated "enable motion?" prompt (which the spec
  // rules out), we piggyback on the visitor's first tap/touch anywhere on
  // the page: the native iOS permission dialog appears attached to an
  // interaction the user already made, not as a separate interruption.
  // If they decline, or nothing happens for the whole session, the board
  // simply stays untilted on mobile — still fully usable and correct.
  useEffect(() => {
    if (prefersReducedMotion) return;
    if (typeof window === "undefined" || !window.DeviceOrientationEvent) return;

    const handleOrientation = (e) => {
      if (e.beta == null || e.gamma == null) return;
      const clampedBeta = Math.max(-20, Math.min(20, e.beta - 45));
      const clampedGamma = Math.max(-20, Math.min(20, e.gamma));
      rawRotateX.set((clampedBeta / 20) * -6);
      rawRotateY.set((clampedGamma / 20) * 6);
    };

    // Browsers without the gated API (Android, etc.) — attach right away.
    if (typeof window.DeviceOrientationEvent.requestPermission !== "function") {
      window.addEventListener("deviceorientation", handleOrientation);
      return () => window.removeEventListener("deviceorientation", handleOrientation);
    }

    // iOS 13+ — wait for the first real user gesture anywhere on the page,
    // then ask inside that gesture's call stack so no separate prompt UI
    // of our own is ever shown.
    let cancelled = false;
    const requestOnGesture = () => {
      window.DeviceOrientationEvent.requestPermission()
        .then((state) => {
          if (!cancelled && state === "granted") {
            window.addEventListener("deviceorientation", handleOrientation);
          }
        })
        .catch(() => {
          /* denied or unsupported — board stays untilted, no retry/nag */
        });
    };
    window.addEventListener("touchstart", requestOnGesture, { once: true, passive: true });
    window.addEventListener("pointerdown", requestOnGesture, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("touchstart", requestOnGesture);
      window.removeEventListener("pointerdown", requestOnGesture);
      window.removeEventListener("deviceorientation", handleOrientation);
    };
  }, [prefersReducedMotion, rawRotateX, rawRotateY]);

  const kingSquare = pieces.find((pc) => pc.hero) || HERO_PIECES[0];

  // Base isometric tilt for the "physical slab" look (fixed), on top of
  // which the existing pointer/device-tilt springs add a few degrees of
  // live parallax. Kept modest on the X axis so the board doesn't read as
  // fully top-down — we still want to see the front edge/thickness.
  const BASE_ROTATE_X = 52;
  const BASE_ROTATE_Z = 45;

  return (
    <div className="relative w-full" aria-hidden="true" style={{ perspective: 1200 }}>
      {/* glow bleeding out past the board edges, so it melts into the panel */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[125%] h-[125%]"
        style={{
          background:
            "radial-gradient(ellipse at 55% 60%, rgba(124,92,252,.38), rgba(124,92,252,.10) 45%, transparent 70%)",
        }}
      />
      {/* soft grounding shadow the slab appears to float above — flat on
          the panel, not part of the 3D board, so it never rotates */}
      <div
        className="pointer-events-none absolute left-1/2 top-[62%] -translate-x-1/2 w-[70%] h-[18%] rounded-full"
        style={{
          background: isDark
            ? "radial-gradient(ellipse, rgba(0,0,0,.55), transparent 72%)"
            : "radial-gradient(ellipse, rgba(60,40,120,.22), transparent 72%)",
          filter: "blur(6px)",
        }}
      />

      <div className="relative aspect-square w-[92%] mx-auto" style={{ transformStyle: "preserve-3d" }}>
        {/* fixed isometric rotation — the board's resting orientation */}
        <div
          className="absolute inset-0"
          style={{
            transformStyle: "preserve-3d",
            transform: `rotateX(${BASE_ROTATE_X}deg) rotateZ(${BASE_ROTATE_Z}deg)`,
          }}
        >
          {/* live pointer/device tilt, layered on top of the fixed tilt */}
          <motion.div
            className="absolute inset-0"
            style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          >
            {/* the physical slab: gradient body + stepped edge (fakes
                thickness) + ambient rim glow, all via box-shadow so it
                stays cheap (no extra blur filters/layers) */}
            <div
              className="absolute inset-0"
              style={{
                transformStyle: "preserve-3d",
                borderRadius: "20%",
                background: isDark
                  ? "linear-gradient(135deg, #2C2648 0%, #171328 55%, #0D0A1B 100%)"
                  : "linear-gradient(135deg, #FEFEFF 0%, #EEECFB 55%, #E1DEF4 100%)",
                border: isDark ? "1px solid rgba(200,180,255,.20)" : "1px solid rgba(255,255,255,.85)",
                boxShadow: [
                  isDark ? "0 3px 0 rgba(9,7,18,.9)" : "0 3px 0 rgba(208,203,228,.9)",
                  isDark ? "0 6px 0 rgba(7,5,14,.85)" : "0 6px 0 rgba(196,190,220,.85)",
                  isDark ? "0 9px 0 rgba(5,4,10,.8)" : "0 9px 0 rgba(186,180,212,.8)",
                  isDark ? "0 16px 26px rgba(0,0,0,.5)" : "0 16px 26px rgba(70,50,150,.16)",
                  isDark ? "0 0 46px rgba(150,100,255,.38)" : "0 0 34px rgba(140,90,255,.20)",
                ].join(", "),
              }}
            >
              {/* inset playing surface — visible frame/bezel around the
                  grid, with a thin warm-gold trim like the reference */}
              <div
                className="absolute"
                style={{
                  inset: "5%",
                  transformStyle: "preserve-3d",
                  borderRadius: "15%",
                  border: isDark ? "1px solid rgba(255,222,150,.28)" : "1px solid rgba(180,150,90,.38)",
                  boxShadow: isDark
                    ? "inset 0 2px 8px rgba(0,0,0,.35)"
                    : "inset 0 2px 8px rgba(40,30,90,.12)",
                }}
              >
                {/* squares, clipped to the rounded frame */}
                <div
                  className="absolute inset-[2px] overflow-hidden grid grid-cols-8 grid-rows-8"
                  style={{ borderRadius: "13%" }}
                >
                  {Array.from({ length: 64 }).map((_, i) => {
                    const file = i % 8;
                    const rank = Math.floor(i / 8);
                    const isLight = (file + rank) % 2 === 0;
                    return (
                      <div
                        key={i}
                        style={{ background: isLight ? "var(--sq-light)" : "var(--sq-dark)" }}
                      />
                    );
                  })}
                  {/* single soft directional-light wash across the whole
                      surface, instead of per-square gradients */}
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(135deg, rgba(255,255,255,.16) 0%, transparent 45%, rgba(0,0,0,.10) 100%)",
                      mixBlendMode: isDark ? "overlay" : "soft-light",
                    }}
                  />
                </div>

                {/* glow pooling under the king's current square — flat on
                    the surface, like the reference's focal light */}
                <motion.div
                  className="pointer-events-none absolute rounded-full"
                  style={{
                    width: "24%",
                    height: "24%",
                    background: "radial-gradient(circle, var(--sq-highlight), transparent 70%)",
                  }}
                  animate={{
                    left: `${(kingSquare.f / 8) * 100 + 1.5}%`,
                    top: `${(kingSquare.r / 8) * 100 + 1.5}%`,
                  }}
                  transition={
                    prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 16 }
                  }
                />

                {/* pieces — each billboarded (counter-rotated) so it
                    stands upright on the tilted surface instead of lying
                    flat on it, while its position still follows the same
                    file/rank math as before */}
                {pieces.map((pc, i) => {
                  const type = PIECE_TYPE_FROM_GLYPH[pc.p] || "p";
                  return (
                    <motion.div
                      key={i}
                      className="absolute select-none"
                      style={{
                        width: "12.5%",
                        height: "12.5%",
                        transformStyle: "preserve-3d",
                        zIndex: pc.hero ? 5 : 3,
                      }}
                      animate={{ left: `${(pc.f / 8) * 100}%`, top: `${(pc.r / 8) * 100}%` }}
                      transition={
                        prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 85, damping: 15 }
                      }
                    >
                      {/* flat contact shadow, stays on the board surface */}
                      <div
                        className="pointer-events-none absolute rounded-full"
                        style={{
                          left: "50%",
                          bottom: "6%",
                          width: `${pc.size * 62}%`,
                          height: `${pc.size * 26}%`,
                          transform: "translateX(-50%)",
                          background: "radial-gradient(ellipse, rgba(0,0,0,.42), transparent 72%)",
                        }}
                      />
                      <div
                        style={{
                          // counter-rotate the fixed isometric tilt + the
                          // live pointer/device tilt so the piece art
                          // faces the camera (billboarded) rather than
                          // lying flat on the board plane
                          transform: `rotateZ(${-BASE_ROTATE_Z}deg) rotateX(${-BASE_ROTATE_X}deg)`,
                          transformOrigin: "50% 92%",
                          transformStyle: "preserve-3d",
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "flex-end",
                          justifyContent: "center",
                        }}
                      >
                        <motion.div
                          style={{
                            width: `${pc.size * 78}%`,
                            filter: pc.hero
                              ? "drop-shadow(0 6px 10px rgba(0,0,0,.5))"
                              : "drop-shadow(0 4px 7px rgba(0,0,0,.4))",
                          }}
                          animate={prefersReducedMotion ? undefined : { y: [0, -4, 0] }}
                          transition={{
                            duration: 3.2 + i * 0.4,
                            repeat: Infinity,
                            ease: "easeInOut",
                            delay: i * 0.25,
                          }}
                        >
                          <ChessPieceGlyph
                            type={type}
                            tone={pc.tone}
                            isDark={isDark}
                            gradId={`sc-hero-piece-${i}-${pc.tone}`}
                          />
                        </motion.div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}

function PlayTile({ icon: Icon, title, subtitle, tint, onClick }) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.button
      onClick={onClick}
      className="text-left rounded-2xl p-5 w-full"
      style={{
        /* subtle colour wash per tile, like the reference */
        background: `linear-gradient(150deg, ${tint.bg} 0%, var(--surface-1) 62%)`,
        border: "1px solid var(--hairline)",
      }}
      whileHover={
        prefersReducedMotion
          ? undefined
          : { y: -4, borderColor: "var(--brand)", boxShadow: "var(--shadow-md)" }
      }
      whileTap={prefersReducedMotion ? undefined : { scale: 0.975, y: -1 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
    >
      <motion.div
        className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
        style={{ background: tint.bg, color: tint.fg }}
        whileHover={prefersReducedMotion ? undefined : { scale: 1.08, rotate: -6 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
      >
        <Icon className="w-5 h-5" />
      </motion.div>
      <div className="font-display font-bold text-[15px]">{title}</div>
      <div className="text-[12px] mt-0.5" style={{ color: "var(--text-secondary)" }}>
        {subtitle}
      </div>
    </motion.button>
  );
}

export default function Landing() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDark = theme === "dark";

  // Nav hides on scroll-down, reveals on scroll-up — tracks the last
  // scroll position and compares each tick.
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentY = window.scrollY;
      const delta = currentY - lastScrollY.current;

      // Ignore tiny jitters (e.g. rubber-band bounce on mobile) and stay
      // visible right at the top of the page regardless of direction.
      if (Math.abs(delta) > 4) {
        if (currentY <= 8) {
          setNavHidden(false);
        } else if (delta > 0) {
          // scrolling down
          setNavHidden(true);
        } else {
          // scrolling up
          setNavHidden(false);
        }
        lastScrollY.current = currentY;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const go = (path) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen" style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}>
      {/* ---------------- Nav ---------------- */}
      <header
        className="sticky top-0 z-50 backdrop-blur"
        style={{
          borderBottom: "1px solid var(--hairline)",
          background: "color-mix(in srgb, var(--surface-0) 88%, transparent)",
          transform: navHidden ? "translateY(-100%)" : "translateY(0)",
          transition: "transform 220ms ease",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 no-underline" style={{ color: "var(--text-primary)" }}>
            <img
              src={LOGO_URL}
              alt="StakeChess logo"
              className="h-10 w-auto object-contain"
              loading="lazy"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="sc-nav-row rounded-lg px-3.5 py-2 text-[14px] font-medium no-underline"
                style={{ color: "var(--text-secondary)" }}
              >
                {l.label}
              </Link>
            ))}

            <motion.button
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
              title={isDark ? "Light mode" : "Dark mode"}
              className="sc-icon-btn ml-1 flex h-9 w-9 items-center justify-center rounded-lg"
              style={{ color: "var(--text-secondary)" }}
              whileHover={{ scale: 1.08, rotate: isDark ? -14 : 14 }}
              whileTap={{ scale: 0.9 }}
              transition={BUTTON_SPRING}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </motion.button>

            {user ? (
              <MotionButton
                onClick={logout}
                variant="outline"
                className="ml-2 font-semibold"
                style={{ borderColor: "var(--hairline)", color: "var(--text-primary)", background: "transparent" }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                transition={BUTTON_SPRING}
              >
                Logout
              </MotionButton>
            ) : (
              <MotionButton
                onClick={() => go("/login")}
                className="ml-2 font-semibold"
                style={{ background: "var(--brand)", color: "var(--on-brand)" }}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.96 }}
                transition={BUTTON_SPRING}
              >
                Login
              </MotionButton>
            )}
          </nav>

          <motion.button
            className="md:hidden sc-icon-btn h-9 w-9 rounded-lg flex items-center justify-center"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Menu"
            style={{ color: "var(--text-secondary)" }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.9 }}
            transition={BUTTON_SPRING}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </motion.button>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden px-5 pb-4 flex flex-col gap-1" style={{ borderTop: "1px solid var(--hairline)" }}>
            {NAV_LINKS.map((l) => (
              <button
                key={l.to}
                onClick={() => go(l.to)}
                className="sc-nav-row text-left rounded-lg px-3 py-2.5 text-[14px] font-medium"
                style={{ color: "var(--text-secondary)", background: "transparent" }}
              >
                {l.label}
              </button>
            ))}
            <button
              onClick={toggleTheme}
              className="sc-nav-row text-left rounded-lg px-3 py-2.5 text-[14px] font-medium"
              style={{ color: "var(--text-secondary)", background: "transparent" }}
            >
              {isDark ? "Light mode" : "Dark mode"}
            </button>
            {user ? (
              <MotionButton
                onClick={logout}
                variant="outline"
                className="mt-2"
                style={{ borderColor: "var(--hairline)", color: "var(--text-primary)" }}
                whileTap={{ scale: 0.96 }}
                transition={BUTTON_SPRING}
              >
                Logout
              </MotionButton>
            ) : (
              <MotionButton
                onClick={() => go("/login")}
                className="mt-2"
                style={{ background: "var(--brand)", color: "var(--on-brand)" }}
                whileTap={{ scale: 0.96 }}
                transition={BUTTON_SPRING}
              >
                Login
              </MotionButton>
            )}
          </div>
        )}
      </header>

      {/* ---------------- Hero card ---------------- */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 pt-7 md:pt-10">
        <div
          className="sc-page sc-hero relative overflow-hidden rounded-3xl"
          style={{
            background: isDark
              ? "linear-gradient(150deg, #171233 0%, #0E0B20 55%, #14102B 100%)"
              : "linear-gradient(150deg, #FFFFFF 0%, #F7F7FF 55%, #F0F0FF 100%)",
            border: isDark ? "1px solid rgba(140,110,255,.18)" : "1px solid rgba(148, 156, 255, 0.25)",
          }}
        >
          {/* ambient glows */}
          <div
            className="pointer-events-none absolute -top-40 right-[-10%] w-[560px] h-[560px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(124,92,252,.30), transparent 66%)" }}
          />
          <div
            className="pointer-events-none absolute -bottom-48 -left-32 w-[460px] h-[460px] rounded-full"
            style={{ background: "radial-gradient(circle, rgba(60,203,127,.14), transparent 70%)" }}
          />

          <div className="relative grid md:grid-cols-[1.02fr,1fr] gap-8 items-center pl-6 md:pl-12 pt-10 md:pt-14 pr-6 md:pr-0">
            <div className="pb-2">
              <div className="mb-6 flex items-center gap-3 flex-wrap">
                <img
                  src={LOGO_URL}
                  alt="StakeChess branding"
                  className="h-16 w-auto object-contain"
                  loading="lazy"
                />
              </div>
              
              <h1 className="font-display font-bold text-[42px] md:text-[58px] leading-[1.02] tracking-tight">
                <span style={{ color: isDark ? "white" : "black" }}>STAKE.</span>{" "}
                <span style={{ color: "var(--brand)" }}>PLAY.</span>{" "}
                <span style={{ color: "var(--green)" }}>WIN.</span>
              </h1>

              <p className="sc-hero-sub mt-3 text-[13px] md:text-[14px] tracking-wider font-medium" style={{ color: "var(--text-secondary)", letterSpacing: "0.15em" }}>
                STAKE • PLAY • WIN
              </p>

              <p className="sc-hero-sub mt-5 text-[15px] md:text-[16px] leading-relaxed max-w-[440px]">
                The premier real-time chess platform where skill meets stakes. Challenge opponents,
                wager crypto, and prove you're the grandmaster.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <MotionButton
                  onClick={() => go(user ? "/lobby" : "/login")}
                  className="font-semibold px-6 h-12 rounded-xl text-[13.5px] tracking-wide"
                  style={{ background: "var(--brand)", color: "var(--on-brand)" }}
                  whileHover={{ y: -3, boxShadow: "0 12px 24px -8px rgba(124,92,252,.55)" }}
                  whileTap={{ scale: 0.96, y: -1 }}
                  transition={BUTTON_SPRING}
                >
                  {user ? "ENTER LOBBY" : "START PLAYING"}
                  <ChevronRight className="w-4 h-4 ml-1.5" />
                </MotionButton>
                <MotionButton
                  onClick={() => go("/live")}
                  variant="outline"
                  className="sc-hero-ghost font-semibold px-6 h-12 rounded-xl text-[13.5px] tracking-wide"
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.96, y: -1 }}
                  transition={BUTTON_SPRING}
                >
                  <Play className="w-4 h-4 mr-1.5" />
                  WATCH LIVE
                </MotionButton>
              </div>

              {/* social proof */}
              <div className="mt-7 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {["M", "S", "D", "K"].map((initial, i) => (
                    <span
                      key={initial}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold"
                      style={{
                        background: [
                          "var(--brand-dim)",
                          "var(--green-dim)",
                          "var(--orange-dim)",
                          "var(--blue-dim)",
                        ][i],
                        color: ["var(--brand)", "var(--green)", "var(--orange)", "var(--blue)"][i],
                        border: "2px solid rgba(255,255,255,.16)",
                      }}
                    >
                      {initial}
                    </span>
                  ))}
                </div>
                <p className="sc-hero-trust text-[13px]">
                  <strong>25,000+</strong> players trust StakeChess
                </p>
              </div>
            </div>

            <HeroBoard />
          </div>

          {/* Stats bar — inside the hero panel, as in the reference */}
          <div className="relative mx-6 md:mx-12 mb-8 md:mb-10 mt-2">
            <div
              className="rounded-2xl grid grid-cols-2 md:grid-cols-5 overflow-hidden"
              style={{
                background: "rgba(255,255,255,.035)",
                border: "1px solid rgba(150,120,255,.16)",
              }}
            >
              {STATS.map((s, i) => (
                <div
                  key={s.label}
                  className="px-5 py-4 text-center"
                  style={{
                    borderLeft: i === 0 ? "none" : "1px solid rgba(150,120,255,.14)",
                    borderTop: i >= 2 ? "1px solid rgba(150,120,255,.14)" : "none",
                  }}
                >
                  <div
                    className="font-display font-bold text-[20px] md:text-[23px]"
                    style={{ color: isDark ? "#F4F2FF" : "#0B0B0F" }}
                  >
                    {s.value}
                  </div>
                  <div className="flex items-center gap-1.5 justify-center mt-0.5">
                    <span className="text-[11.5px]" style={{ color: isDark ? "#A9A2C9" : "#1F2937" }}>
                      {s.label}
                    </span>
                    {s.dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.dot }} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>


      {/* ---------------- Play your way ---------------- */}
      <section className="max-w-6xl mx-auto px-5 md:px-8 pt-9 pb-16">
        <h2
          className="text-[12px] font-semibold uppercase tracking-[0.14em] mb-4"
          style={{ color: "var(--text-secondary)" }}
        >
          Play your way
        </h2>
        <div className="sc-stagger grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <PlayTile
            icon={Zap}
            title="Play online"
            subtitle="Find real opponents"
            tint={{ bg: "var(--brand-dim)", fg: "var(--brand)" }}
            onClick={() => go(user ? "/lobby" : "/login")}
          />
          <PlayTile
            icon={Bot}
            title="Play AI"
            subtitle="Practice with bots"
            tint={{ bg: "var(--blue-dim)", fg: "var(--blue)" }}
            onClick={() => go("/play-computer")}
          />
          <PlayTile
            icon={Puzzle}
            title="Daily puzzle"
            subtitle="Solve and earn rating"
            tint={{ bg: "var(--green-dim)", fg: "var(--green)" }}
            onClick={() => go(user ? "/puzzles" : "/login")}
          />
          <PlayTile
            icon={Trophy}
            title="Tournaments"
            subtitle="Compete and win big"
            tint={{ bg: "var(--orange-dim)", fg: "var(--orange)" }}
            onClick={() => go("/tournaments")}
          />
        </div>
      </section>

      <footer style={{ borderTop: "1px solid var(--hairline)" }}>
        <div
          className="max-w-6xl mx-auto px-5 md:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px]"
          style={{ color: "var(--text-secondary)" }}
        >
          <span>StakeChess — stake. play. win.</span>
          <div className="flex gap-5">
            <Link to="/news" className="no-underline" style={{ color: "var(--text-secondary)" }}>News</Link>
            <Link to="/live" className="no-underline" style={{ color: "var(--text-secondary)" }}>Watch</Link>
          </div>
        </div>
      </footer>
    </div>
    </MotionConfig>
  );
}
