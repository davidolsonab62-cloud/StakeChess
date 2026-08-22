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

/* ---------------------------------------------------------------
   Hero board.

   A live 8x8 board (not a static image) so pieces are real, individually
   animated elements: one plays a short, randomly-chosen move shortly
   after load, the rest idle with a slow float, and the whole board
   tilts gently toward the pointer for a sense of depth. Square colours
   come straight from the theme tokens (--sq-light/--sq-dark/--sq-highlight)
   so it reads correctly in both themes without any extra styling here.
   --------------------------------------------------------------- */
function HeroBoard() {
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

  return (
    <div className="relative w-full" aria-hidden="true" style={{ perspective: 1000 }}>
      {/* glow bleeding out past the board edges, so it melts into the panel */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[125%] h-[125%]"
        style={{
          background:
            "radial-gradient(ellipse at 55% 60%, rgba(124,92,252,.38), rgba(124,92,252,.10) 45%, transparent 70%)",
        }}
      />
      <motion.div
        className="relative aspect-square w-[92%] mx-auto rounded-2xl overflow-hidden"
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
          border: "1px solid rgba(150,120,255,.20)",
          boxShadow: "0 30px 60px -20px rgba(20,10,50,.55)",
        }}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {/* squares */}
        <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
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
        </div>

        {/* glow pooling under the king's current square */}
        <motion.div
          className="pointer-events-none absolute rounded-full"
          style={{
            width: "22%",
            height: "22%",
            background: "radial-gradient(circle, var(--sq-highlight), transparent 72%)",
          }}
          animate={{
            left: `${(kingSquare.f / 8) * 100 + 1.5}%`,
            top: `${(kingSquare.r / 8) * 100 + 1.5}%`,
          }}
          transition={
            prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 90, damping: 16 }
          }
        />

        {/* pieces */}
        {pieces.map((pc, i) => (
          <motion.div
            key={i}
            className="absolute flex items-center justify-center select-none"
            style={{
              width: "12.5%",
              height: "12.5%",
              fontSize: `${pc.size * 3.6}rem`,
              lineHeight: 1,
              color: pc.tone === "dark" ? "#221D3D" : "#F6F4FF",
              filter: pc.hero
                ? "drop-shadow(0 10px 16px rgba(0,0,0,.5))"
                : "drop-shadow(0 6px 10px rgba(0,0,0,.4))",
              zIndex: pc.hero ? 5 : 3,
            }}
            animate={{ left: `${(pc.f / 8) * 100}%`, top: `${(pc.r / 8) * 100}%` }}
            transition={
              prefersReducedMotion ? { duration: 0 } : { type: "spring", stiffness: 85, damping: 15 }
            }
          >
            <motion.span
              animate={prefersReducedMotion ? undefined : { y: [0, -5, 0] }}
              transition={{
                duration: 3.2 + i * 0.4,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.25,
              }}
            >
              {pc.p}
            </motion.span>
          </motion.div>
        ))}
      </motion.div>
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
