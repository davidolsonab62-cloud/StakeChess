import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import { navigateBack } from "@/utils/navigation";

const STORAGE_KEY = "stakechess-sidebar-collapsed";

/**
 * Shared shell for authenticated pages: collapsible sidebar + content area.
 * There's deliberately no topbar on desktop — the theme toggle and account
 * row live in the sidebar so pages start flush at the top with their own
 * heading. On mobile the sidebar is an off-canvas drawer (hidden by
 * default), so a slim mobile-only bar provides a menu icon to reveal it and
 * a back control for navigating to the previous page.
 */
export default function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  // Close the mobile drawer automatically whenever the route changes, so it
  // never lingers open after tapping a link or navigating back/forward.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  // The lobby is the app's "home" — no back control needed there.
  const showBackButton = location.pathname !== "/lobby";

  return (
    <div className="flex min-h-screen" style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile-only bar: sidebar is auto-hidden below md, so this is the
            only way to reveal it, plus a back control for quick navigation. */}
        <div
          className="md:hidden flex items-center gap-1 px-2 sticky top-0 z-30"
          style={{ height: 52, borderBottom: "1px solid var(--hairline)", background: "var(--surface-0)" }}
        >
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            title="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg sc-icon-btn"
            style={{ color: "var(--text-secondary)" }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <div className="flex-1" />

          {showBackButton ? (
            <button
              onClick={() => navigateBack(navigate, "/lobby")}
              aria-label="Go back"
              title="Back"
              className="flex h-9 w-9 items-center justify-center rounded-lg sc-icon-btn"
              style={{ color: "var(--text-secondary)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
          ) : (
            <div className="h-9 w-9" />
          )}
        </div>

        <main className="flex-1 min-w-0 px-5 py-6 md:px-8 md:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
