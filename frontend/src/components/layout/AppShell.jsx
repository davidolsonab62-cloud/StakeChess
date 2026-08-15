import { useState, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";
import { navigateBack } from "@/utils/navigation";

const STORAGE_KEY = "stakechess-sidebar-collapsed";

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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  const showBackButton = location.pathname !== "/lobby";

  return (
    <div className="flex min-h-screen" style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <button
        onClick={() => setMobileNavOpen((open) => !open)}
        aria-label={mobileNavOpen ? "Close menu" : "Open menu"}
        aria-expanded={mobileNavOpen}
        title={mobileNavOpen ? "Close menu" : "Menu"}
        className="lg:hidden fixed top-2 right-2 z-[70] flex h-9 w-9 items-center justify-center rounded-lg sc-icon-btn"
        style={{ color: "var(--text-secondary)", background: "var(--surface-0)", border: "1px solid var(--hairline)" }}
      >
        {mobileNavOpen ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        )}
      </button>

      <div className="flex-1 min-w-0 flex flex-col">
        <div
          className="lg:hidden flex items-center gap-1 px-2 sticky top-0 z-30"
          style={{ height: 52, borderBottom: "1px solid var(--hairline)", background: "var(--surface-0)" }}
        >
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
          <div className="flex-1" />
          <div className="h-9 w-9" />
        </div>

        <main className="flex-1 min-w-0 px-5 py-6 md:px-8 md:py-7">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
