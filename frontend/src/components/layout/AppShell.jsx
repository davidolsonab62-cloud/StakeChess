import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import { useTheme } from "@/context/ThemeContext";

const STORAGE_KEY = "stakechess-sidebar-collapsed";

/**
 * Shared shell for authenticated pages: collapsible sidebar + content area.
 * A slim bar sits at the top-left of the content column on every
 * breakpoint, holding the dark mode toggle. On mobile it also holds the
 * menu icon to open the sidebar drawer (hidden on lg, since the sidebar is
 * a static rail there instead). Closing the drawer happens via the X
 * inside it (see Sidebar.jsx), not from this bar.
 *
 * Back navigation lives per-page via <PageHeader>
 * (components/layout/PageHeader.jsx) directly beside each page's title.
 */
export default function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  // Close the mobile drawer automatically whenever the route changes, so it
  // never lingers open after tapping a link or navigating back/forward.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <div
          className="flex items-center gap-1 px-2 sticky top-0 z-30"
          style={{ height: 52, borderBottom: "1px solid var(--hairline)", background: "var(--surface-0)" }}
        >
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            title="Menu"
            className="lg:hidden flex h-9 w-9 items-center justify-center rounded-lg sc-icon-btn"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex-1" />

          <button
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            title={isDark ? "Light mode" : "Dark mode"}
            className="flex h-9 w-9 items-center justify-center rounded-lg sc-icon-btn"
            style={{ color: "var(--text-secondary)" }}
          >
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
          </button>
        </div>

        <main className="flex-1 min-w-0 px-5 py-6 md:px-8 md:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
