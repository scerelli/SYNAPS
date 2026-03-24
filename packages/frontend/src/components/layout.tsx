import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router";
import { LogoIcon } from "@/components/logo-icon";
import {
  ClipboardList,
  FileText,
  HeartPulse,
  Home,
  Network,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: Home },
  { path: "/track", label: "Track", icon: ClipboardList },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/conditions", label: "Conditions", icon: HeartPulse },
  { path: "/insights", label: "Insights", icon: Network },
  { path: "/profile", label: "Profile", icon: User },
  { path: "/settings", label: "Settings", icon: Settings },
];

function Sidebar({ collapsed }: { collapsed: boolean }) {
  const location = useLocation();

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-border bg-sidebar-background h-screen sticky top-0 transition-all",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className="flex items-center h-14 px-3 border-b border-border gap-2.5 overflow-hidden">
        <LogoIcon className={`shrink-0 text-sidebar-primary ${collapsed ? "h-7 w-auto" : "h-6 w-auto"}`} />
        {!collapsed && (
          <span className="font-display text-sm font-bold tracking-[0.15em] text-sidebar-primary truncate">
            SYNAPS
          </span>
        )}
      </div>
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileNav() {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border bg-background h-16 px-2 overflow-x-auto">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center gap-1 px-2 py-1 text-xs transition-colors shrink-0",
              active
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-5 w-5" />
            <span className="hidden">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex min-h-screen">
      <Sidebar collapsed={collapsed} />
      <div className="flex-1 flex flex-col">
        <header className="flex items-center h-14 px-4 border-b border-border bg-background sticky top-0 z-40">
          <Button
            variant="ghost"
            size="icon"
            className="hidden md:inline-flex"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Toggle sidebar"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </Button>
          <span className="md:hidden flex items-center gap-2">
            <LogoIcon className="h-5 w-auto text-foreground" />
            <span className="font-display text-sm font-bold tracking-[0.15em]">SYNAPS</span>
          </span>
        </header>
        <main className="flex-1 p-4 md:p-6 pb-20 md:pb-6">
          <Outlet />
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
