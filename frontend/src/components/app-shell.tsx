import { Link, useRouterState } from "@tanstack/react-router";
import { BarChart3, Search } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { to: "/", label: "Search", icon: Search },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      {/* Fixed top navigation bar */}
      <header className="fixed inset-x-0 top-0 z-50 border-border/60 border-b bg-bg-deep/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          {/* Logo */}
          <div className="flex items-baseline gap-2">
            <h1 className="font-bold font-display text-text-primary text-xl uppercase tracking-widest">
              Miles
            </h1>
            <span className="font-mono text-[10px] text-text-tertiary uppercase tracking-wider">
              Tracker
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.to === "/"
                  ? currentPath === "/"
                  : currentPath.startsWith(item.to);
              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-2 rounded-lg px-4 py-2 font-medium text-sm transition-all duration-200",
                    isActive
                      ? "text-gold"
                      : "text-text-secondary hover:text-text-primary"
                  )}
                  key={item.to}
                  to={item.to}
                >
                  <item.icon
                    className={cn(
                      "size-4 transition-colors",
                      isActive
                        ? "text-gold"
                        : "text-text-tertiary group-hover:text-text-secondary"
                    )}
                    strokeWidth={isActive ? 2 : 1.5}
                  />
                  <span>{item.label}</span>
                  {/* Active indicator */}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-gold" />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main content area */}
      <main className="flex-1 pt-16">
        <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
