import { useLocation, Link } from "wouter";
import {
  LayoutDashboard,
  ShieldCheck,
  AlertTriangle,
  GraduationCap,
  FileWarning,
  FileText,
  Settings,
  LogOut,
  Shield,
  ChevronLeft,
  Menu,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compliance", label: "NDPR Compliance", icon: ShieldCheck },
  { href: "/threats", label: "Threat Monitor", icon: AlertTriangle },
  { href: "/training", label: "Staff Training", icon: GraduationCap },
  { href: "/incidents", label: "Incidents", icon: FileWarning },
  { href: "/reports", label: "Reports & Audit", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile toggle */}
      <button
        data-testid="sidebar-mobile-toggle"
        className="fixed top-3 left-3 z-50 md:hidden p-2 rounded-lg bg-sidebar text-sidebar-foreground"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen flex flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-all duration-200",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Header */}
        <div className={cn("flex items-center gap-3 p-4 border-b border-sidebar-border", collapsed && "justify-center px-2")}>
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-sidebar-foreground truncate">HarmonyShield Pro</h1>
              <p className="text-[10px] text-sidebar-foreground/50 truncate">by Harmony Digital Consults</p>
            </div>
          )}
          <button
            data-testid="sidebar-collapse-toggle"
            className="hidden md:flex ml-auto p-1 rounded hover:bg-sidebar-accent transition-colors"
            onClick={() => setCollapsed(!collapsed)}
          >
            <ChevronLeft className={cn("w-4 h-4 transition-transform", collapsed && "rotate-180")} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                data-testid={`nav-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                onClick={() => setMobileOpen(false)}
              >
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Tagline */}
        {!collapsed && (
          <div className="px-4 py-2">
            <p className="text-[10px] text-sidebar-foreground/40 italic text-center leading-tight">
              Protecting Nigerian Education,<br />One School at a Time
            </p>
          </div>
        )}

        {/* User info + logout */}
        <div className={cn("border-t border-sidebar-border p-3", collapsed && "px-2")}>
          <div className={cn("flex items-center gap-2", collapsed && "justify-center")}>
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary flex-shrink-0">
              {user?.name?.split(" ").map(n => n[0]).join("").substring(0, 2)}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate" data-testid="sidebar-user-name">
                  {user?.name}
                </p>
                <p className="text-[10px] text-sidebar-foreground/50 capitalize" data-testid="sidebar-user-role">
                  {user?.role}
                </p>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              data-testid="button-logout"
              className="flex-shrink-0 text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 w-8"
              onClick={() => { void logout(); }}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}
