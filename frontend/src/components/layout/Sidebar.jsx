import { useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "@/App";
import PlayMenuDialog from "@/components/play/PlayMenuDialog";

const ICON_LOGO_URL = "/stakechess-icon.png";
const FULL_LOGO_URL = "/stakechess-logo.png";

const BrandMark = ({ collapsed }) => {
  if (collapsed) {
    return (
      <img
        src={ICON_LOGO_URL}
        alt="StakeChess"
        style={{ height: 30, width: 30, objectFit: "contain", flexShrink: 0 }}
      />
    );
  }
  return (
    <img
      src={FULL_LOGO_URL}
      alt="StakeChess"
      style={{ height: 26, width: "auto", maxWidth: 168, objectFit: "contain", flexShrink: 0 }}
    />
  );
};

const NAV_ITEMS = [
  { to: "/lobby", label: "Home", icon: "▣" },
  { to: "/play-computer", label: "Play", icon: "♟", isPlayMenu: true },
  { to: "/import-pgn", label: "Import PGN", icon: "⎘" },
  { to: "/board-editor", label: "Board Editor", icon: "⌘" },
  { to: "/chess-clock", label: "Chess Clock", icon: "⏱" },
  { to: "/tournaments", label: "Tournaments", icon: "◈" },
  { to: "/live", label: "Watch", icon: "◉" },
  { to: "/puzzles", label: "Puzzles", icon: "★" },
  { to: "/study", label: "Study", icon: "📚" },
  { to: "/leaderboard", label: "Leaderboard", icon: "◎" },
  { to: "/challenge-queue", label: "Challenges", icon: "⚔" },
  { to: "/messages", label: "Messages", icon: "✉" },
  { to: "/wallet", label: "Wallet", icon: "⬒" },
];

export default function Sidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose = () => {} }) {
  const { user, logout, pendingChallengeCount, watchableMatchCount, puzzleProgress } = useAuth();
  const isAdmin = user?.role === "admin" || user?.is_admin;
  const compact = collapsed && !mobileOpen;
  const [aboutOpen, setAboutOpen] = useState(false);
  const [playDialogOpen, setPlayDialogOpen] = useState(false);
  const location = useLocation();

  const rowBase =
    "flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-[14px] font-medium no-underline transition-colors sc-nav-row";

  return (
    <>
    <aside
        // sc-no-reveal: opts this element out of useScrollReveal's
        // auto-attach (it matches any direct child of a ".min-h-screen"
        // element, which this is, via AppShell's wrapper div). Without this,
        // the hook adds sc-reveal/sc-reveal-visible once the sidebar scrolls
        // into view, and sc-reveal-visible's `transform: none` permanently
        // overrides the translate-x classes below at equal specificity —
        // which is why the drawer stayed visually open no matter what
        // mobileOpen/onMobileClose did. This is a controlled, always-mounted,
        // transform-driven element; it should never carry a scroll-reveal
        // class in the first place.
        //
        // On mobile this is hidden via `left` (not `transform: translateX`).
        // A `position: fixed` element moved off-screen with a transform is a
        // known WebKit bug: iOS Safari still counts its off-canvas width
        // toward the page's scrollable area even though it's invisible, which
        // silently ate the same amount of width off the right edge of every
        // page (board, timers, footer text all clipped at once). Animating
        // `left` instead keeps it truly in fixed/viewport coordinate space
        // and sidesteps the bug. On lg the sidebar is `static` anyway, so
        // `left` has no effect there.
        className="fixed lg:static inset-y-0 z-50 flex flex-col shrink-0 sc-sidebar sc-no-reveal transition-[left] duration-200 ease-out"
        style={{
          width: compact ? 68 : 216,
          left: mobileOpen ? 0 : -(compact ? 68 : 216),
          borderRight: "1px solid var(--hairline)",
          background: "var(--surface-0)",
          padding: "18px 12px",
          boxShadow: mobileOpen ? "var(--shadow-md, 0 8px 24px rgba(0,0,0,0.25))" : undefined,
        }}
      >
        <div className={`flex items-center ${compact ? "justify-center" : "gap-2 px-1"} pb-5`}>
          <Link
            to="/"
            className={`flex items-center ${compact ? "justify-center" : "gap-2 truncate"}`}
            aria-label="Go to landing page"
            title="StakeChess"
            style={{ overflow: "hidden", minWidth: 0 }}
            onClick={onMobileClose}
          >
            <BrandMark collapsed={compact} />
          </Link>
          {!compact && (
            <button
              onClick={onToggle}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="ml-auto hidden lg:flex h-7 w-7 items-center justify-center rounded-lg sc-icon-btn"
              style={{ color: "var(--text-secondary)" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <line x1="9" y1="3" x2="9" y2="21" />
              </svg>
            </button>
          )}
          <button
            onClick={onMobileClose}
            aria-label="Close menu"
            title="Close menu"
            className="ml-auto flex lg:hidden h-10 w-10 items-center justify-center rounded-lg sc-icon-btn"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {compact && (
          <button
            onClick={onToggle}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mb-3 hidden lg:flex h-9 w-full items-center justify-center rounded-lg sc-icon-btn"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </button>
        )}

        <nav className="flex flex-col gap-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          if (item.isPlayMenu) {
            const isActive = location.pathname === item.to;
            return (
              <button
                key={item.to}
                type="button"
                title={compact ? item.label : undefined}
                onClick={() => setPlayDialogOpen(true)}
                className={`${rowBase} ${compact ? "justify-center px-0" : ""}`}
                style={{
                  background: isActive ? "var(--brand-dim)" : "transparent",
                  color: isActive ? "var(--brand)" : "var(--text-secondary)",
                }}
              >
                <i className="w-[18px] text-center not-italic shrink-0">{item.icon}</i>
                {!compact && item.label}
              </button>
            );
          }

          return (
          <NavLink
            key={item.to}
            to={item.to}
            title={compact ? item.label : undefined}
            className={`${rowBase} ${compact ? "justify-center px-0" : ""}`}
            style={({ isActive }) => ({
              background: isActive ? "var(--brand-dim)" : "transparent",
              color: isActive ? "var(--brand)" : "var(--text-secondary)",
            })}
            onClick={onMobileClose}
          >
            <div className="flex items-center justify-between w-full gap-3">
              <div className="flex items-center gap-3">
                <i className="w-[18px] text-center not-italic shrink-0">{item.icon}</i>
                {!compact && item.label}
              </div>
              {!compact && (
                <div className="flex items-center gap-2">
                  {item.to === "/challenge-queue" && pendingChallengeCount > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full bg-brand text-on-brand text-[10px] font-semibold px-2 py-0.5">
                      {pendingChallengeCount}
                    </span>
                  )}
                  {item.to === "/live" && watchableMatchCount > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full bg-[#FF6B6B] text-white text-[10px] font-semibold px-2 py-0.5">
                      {watchableMatchCount}
                    </span>
                  )}
                  {item.to === "/puzzles" && puzzleProgress?.current_difficulty > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full bg-[#7C5CFC] text-white text-[10px] font-semibold px-2 py-0.5">
                      {puzzleProgress.current_difficulty}
                    </span>
                  )}
                </div>
              )}
            </div>
          </NavLink>
          );
        })}
        {isAdmin && (
          <NavLink
            to="/admin"
            title={compact ? "Admin" : undefined}
            className={`${rowBase} ${compact ? "justify-center px-0" : ""}`}
            style={({ isActive }) => ({
              background: isActive ? "var(--brand-dim)" : "transparent",
              color: isActive ? "var(--brand)" : "var(--text-secondary)",
            })}
            onClick={onMobileClose}
          >
            <i className="w-[18px] text-center not-italic shrink-0">◆</i>
            {!compact && "Admin"}
          </NavLink>
        )}
      </nav>

      <div className="flex-1" />

      {user && (
        <div
          className={`flex items-center gap-2 ${compact ? "justify-center" : ""}`}
          style={{ borderTop: "1px solid var(--hairline)", marginTop: 8, paddingTop: 6 }}
        >
          <NavLink
            to="/profile"
            title={compact ? user.username || user.name : undefined}
            className={`flex items-center gap-2.5 rounded-[9px] no-underline min-w-0 sc-nav-row ${compact ? "justify-center p-1.5" : "px-2 py-2.5 flex-1"}`}
            onClick={onMobileClose}
          >
            {user.picture ? (
              <img
                src={user.picture}
                alt=""
                className="h-9 w-9 rounded-[9px] object-cover shrink-0"
                style={{ border: "1px solid var(--hairline)" }}
              />
            ) : (
              <div
                className="flex h-9 w-9 items-center justify-center rounded-[9px] font-bold shrink-0"
                style={{ background: "var(--surface-1)", border: "1px solid var(--hairline)", color: "var(--brand)" }}
              >
                {(user.username || user.name || "?")[0]?.toUpperCase()}
              </div>
            )}
            {!compact && (
              <div className="min-w-0">
                <div className="text-[13px] font-semibold truncate" style={{ color: "var(--text-primary)" }}>
                  {user.username || user.name}
                </div>
                <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {user.rating ?? user.elo ?? "—"} ELO
                </div>
              </div>
            )}
          </NavLink>
          {!compact && (
            <button
              onClick={logout}
              aria-label="Log out"
              title="Log out"
              className="flex h-9 w-9 items-center justify-center rounded-[9px] shrink-0 sc-icon-btn"
              style={{ color: "var(--text-secondary)", background: "transparent" }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          )}
        </div>
      )}

      <div style={{ borderTop: "1px solid var(--hairline)", marginTop: 12, paddingTop: 12 }}>
        {compact ? (
          <nav className="flex flex-col gap-0.5">
            <Link to="/wallet" title="Subscribe" className={`${rowBase} text-[13px] justify-center px-0`} style={{ color: "var(--text-secondary)" }} onClick={onMobileClose}>
              <i className="w-[18px] text-center not-italic shrink-0">💎</i>
            </Link>
            <Link to="/support" title="Support" className={`${rowBase} text-[13px] justify-center px-0`} style={{ color: "var(--text-secondary)" }} onClick={onMobileClose}>
              <i className="w-[18px] text-center not-italic shrink-0">💬</i>
            </Link>
            <Link to="/privacy" title="Privacy" className={`${rowBase} text-[13px] justify-center px-0`} style={{ color: "var(--text-secondary)" }} onClick={onMobileClose}>
              <i className="w-[18px] text-center not-italic shrink-0">🔒</i>
            </Link>
            <Link to="/terms" title="Terms" className={`${rowBase} text-[13px] justify-center px-0`} style={{ color: "var(--text-secondary)" }} onClick={onMobileClose}>
              <i className="w-[18px] text-center not-italic shrink-0">📋</i>
            </Link>
            <Link to="/database" title="Database" className={`${rowBase} text-[13px] justify-center px-0`} style={{ color: "var(--text-secondary)" }} onClick={onMobileClose}>
              <i className="w-[18px] text-center not-italic shrink-0">📊</i>
            </Link>
          </nav>
        ) : (
          <>
            <button
              onClick={() => setAboutOpen((o) => !o)}
              aria-expanded={aboutOpen}
              className="mb-1 px-1 py-1 flex items-center justify-between w-full rounded-lg sc-icon-btn"
              style={{ color: "var(--text-secondary)" }}
            >
              <span className="text-[11px] font-semibold uppercase tracking-wider">About StakeChess</span>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ transform: aboutOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s ease" }}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {aboutOpen && (
              <nav className="flex flex-col gap-0.5">
                <Link to="/wallet" className={`${rowBase} text-[13px]`} style={{ color: "var(--text-secondary)" }} onClick={onMobileClose}>
                  <i className="w-[18px] text-center not-italic shrink-0">💎</i>
                  Subscribe
                </Link>
                <Link to="/support" className={`${rowBase} text-[13px]`} style={{ color: "var(--text-secondary)" }} onClick={onMobileClose}>
                  <i className="w-[18px] text-center not-italic shrink-0">💬</i>
                  Support
                </Link>
                <Link to="/privacy" className={`${rowBase} text-[13px]`} style={{ color: "var(--text-secondary)" }} onClick={onMobileClose}>
                  <i className="w-[18px] text-center not-italic shrink-0">🔒</i>
                  Privacy
                </Link>
                <Link to="/terms" className={`${rowBase} text-[13px]`} style={{ color: "var(--text-secondary)" }} onClick={onMobileClose}>
                  <i className="w-[18px] text-center not-italic shrink-0">📋</i>
                  Terms
                </Link>
                <Link to="/database" className={`${rowBase} text-[13px]`} style={{ color: "var(--text-secondary)" }} onClick={onMobileClose}>
                  <i className="w-[18px] text-center not-italic shrink-0">📊</i>
                  Database
                </Link>
              </nav>
            )}
          </>
        )}
      </div>
      </aside>
      <PlayMenuDialog open={playDialogOpen} onOpenChange={setPlayDialogOpen} />
    </>
  );
}
