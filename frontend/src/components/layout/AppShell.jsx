import { useState, useEffect } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "@/components/layout/Sidebar";

const STORAGE_KEY = "stakechess-sidebar-collapsed";

/**
 * Shared shell for authenticated pages: collapsible sidebar + content area.
 * There's deliberately no topbar — the theme toggle and account row live in
 * the sidebar so pages start flush at the top with their own heading.
 */
export default function AppShell() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return (
    <div className="flex min-h-screen" style={{ background: "var(--surface-0)", color: "var(--text-primary)" }}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <main className="flex-1 min-w-0 px-5 py-6 md:px-8 md:py-7">
        <Outlet />
      </main>
    </div>
  );
}
