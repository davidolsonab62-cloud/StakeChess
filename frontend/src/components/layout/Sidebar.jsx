import { Link, NavLink } from "react-router-dom";
import { useAuth } from "@/App";
import { useTheme } from "@/context/ThemeContext";

// Collapsed sidebar shows just the king icon (cropped from the full
// lockup); expanded sidebar shows the full "StakeChess" wordmark image.
// Swapping the source files at these two paths updates the brand
// everywhere without touching this component again.
const ICON_LOGO_URL = "/stakechess-icon.png";
const FULL_LOGO_URL = "/stakechess-logo.png";

const BrandMark = ({ collapsed }) => {
  if (collapsed) {
    return (
      <img
        src={ICON_LOGO_URL}
        alt="StakeChess"
        style={{
          height: 30,
          width: 30,
          objectFit: "contain",
          flexShrink: 0,
        }}
      />
    );
  }

  return (
    <img
      src={FULL_LOGO_URL}
      alt="StakeChess"
      style={{
        height: 26,
        width: "auto",
        maxWidth: 168,
        objectFit: "contain",
        flexShrink: 0,
      }}
    />
  );
};

const NAV_ITEMS = [
  { to: "/lobby", label: "Home", icon: "▣" },
  { to: "/play-computer", label: "Play", icon: "♟" },
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
  { to: "/profile", label: "Profile", icon: "◐" },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout, pendingChallengeCount, watchableMatchCount, puzzleProgress } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isAdmin = user?.role === "admin" || user?.is_admin;
  const isDark = theme === "dark";

  const rowBase =
    "flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-[14px] font-medium no-underline transition-colors sc-nav-row";

  return (
    <aside
      className="hidden md:flex md:flex-col shrink-0 sc-sidebar"
      style={{
        width: collapsed ? 68 : 216,
        borderRight: "1px solid var(--hairline)",
        background: "var(--surface-0)",
        padding: "18px 12px",
      }}
    >
      {/* Brand + collapse control */}
      <div className={`flex items-center ${collapsed ? "justify-center" : "gap-2 px-1"} pb-5`}>
        <Link
          to="/"
          className={`flex items-center ${collapsed ? "justify-center" : "gap-2 truncate"}`}
          aria-label="Go to landing page"
          title="StakeChess"
          style={{ overflow: "hidden", minWidth: 0 }}
        >
          <BrandMark collapsed={collapsed} />
        </Link>
        {!collapsed && (
          <button
            onClick={onToggle}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="ml-auto flex h-7 w-7 items-center justify-center rounded-lg sc-icon-btn"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="9" y1="3" x2="9" y2="21" />
            </svg>
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={onToggle}
          aria-label="Expand sidebar"
          title="Expand sidebar"
          className="mb-3 flex h-9 w-full items-center justify-center rounded-lg sc-icon-btn"
          style={{ color: "var(--text-secondary)" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </button>
      )}

      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={collapsed ? item.label : undefined}
            className={`${rowBase} ${collapsed ? "justify-center px-0" : ""}`}
            style={({ isActive }) => ({
              background: isActive ? "var(--brand-dim)" : "transparent",
              color: isActive ? "var(--brand)" : "var(--text-secondary)",
            })}
          >
            <div className="flex items-center justify-between w-full gap-3">
              <div className="flex items-center gap-3">
                <i className="w-[18px] text-center not-italic shrink-0">{item.icon}</i>
                {!collapsed && item.label}
              </div>
              {!collapsed && (
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
        ))}
        {isAdmin && (
          <NavLink
            to="/admin"
            title={collapsed ? "Admin" : undefined}
            className={`${rowBase} ${collapsed ? "justify-center px-0" : ""}`}
            style={({ isActive }) => ({
              background: isActive ? "var(--brand-dim)" : "transparent",
              color: isActive ? "var(--brand)" : "var(--text-secondary)",
            })}
          >
            <i className="w-[18px] text-center not-italic shrink-0">◆</i>
            {!collapsed && "Admin"}
          </NavLink>
        )}
      </nav>

      <div className="flex-1" />

      {/* Theme toggle now lives here instead of in a topbar strip */}
      <button
        onClick={toggleTheme}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        title={isDark ? "Light mode" : "Dark mode"}
        className={`${rowBase} w-full ${collapsed ? "justify-center px-0" : ""}`}
        style={{ color: "var(--text-secondary)", background: "transparent" }}
      >
        <i className="w-[18px] flex items-center justify-center not-italic shrink-0">
          {isDark ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
            </svg>
          )}
        </i>
        {!collapsed && (isDark ? "Light mode" : "Dark mode")}
      </button>

      {user && (
        <div
          className={`flex items-center gap-2 ${collapsed ? "justify-center" : ""}`}
          style={{ borderTop: "1px solid var(--hairline)", marginTop: 8, paddingTop: 6 }}
        >
          <NavLink
            to="/profile"
            title={collapsed ? user.username || user.name : undefined}
            className={`flex items-center gap-2.5 rounded-[9px] no-underline min-w-0 sc-nav-row ${collapsed ? "justify-center p-1.5" : "px-2 py-2.5 flex-1"}`}
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
            {!collapsed && (
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
          {!collapsed && (
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

      {/* About section */}
      <div
        style={{ borderTop: "1px solid var(--hairline)", marginTop: 12, paddingTop: 12 }}
      >
        {!collapsed && (
          <div className="mb-3 px-1">
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              About StakeChess
            </div>
          </div>
        )}
        <nav className="flex flex-col gap-0.5">
          <Link
            to="/wallet"
            title={collapsed ? "Subscribe" : undefined}
            className={`${rowBase} text-[13px] ${collapsed ? "justify-center px-0" : ""}`}
            style={{ color: "var(--text-secondary)" }}
          >
            <i className="w-[18px] text-center not-italic shrink-0">💎</i>
            {!collapsed && "Subscribe"}
          </Link>
          <Link
            to="/support"
            title={collapsed ? "Support" : undefined}
            className={`${rowBase} text-[13px] ${collapsed ? "justify-center px-0" : ""}`}
            style={{ color: "var(--text-secondary)" }}
          >
            <i className="w-[18px] text-center not-italic shrink-0">💬</i>
            {!collapsed && "Support"}
          </Link>
          <Link
            to="/privacy"
            title={collapsed ? "Privacy" : undefined}
            className={`${rowBase} text-[13px] ${collapsed ? "justify-center px-0" : ""}`}
            style={{ color: "var(--text-secondary)" }}
          >
            <i className="w-[18px] text-center not-italic shrink-0">🔒</i>
            {!collapsed && "Privacy"}
          </Link>
          <Link
            to="/terms"
            title={collapsed ? "Terms" : undefined}
            className={`${rowBase} text-[13px] ${collapsed ? "justify-center px-0" : ""}`}
            style={{ color: "var(--text-secondary)" }}
          >
            <i className="w-[18px] text-center not-italic shrink-0">📋</i>
            {!collapsed && "Terms"}
          </Link>
          <Link
            to="/database"
            title={collapsed ? "Database" : undefined}
            className={`${rowBase} text-[13px] ${collapsed ? "justify-center px-0" : ""}`}
            style={{ color: "var(--text-secondary)" }}
          >
            <i className="w-[18px] text-center not-italic shrink-0">📊</i>
            {!collapsed && "Database"}
          </Link>
        </nav>
      </div>
    </aside>
  );
}
