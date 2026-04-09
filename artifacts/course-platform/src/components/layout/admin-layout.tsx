import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, BookOpen, Share2, CreditCard, Tag, Settings, ArrowLeft, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/courses", icon: BookOpen, label: "Courses" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/affiliates", icon: Share2, label: "Affiliates" },
  { href: "/admin/payouts", icon: CreditCard, label: "Payouts" },
  { href: "/admin/coupons", icon: Tag, label: "Coupons" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

function NavContent({ location, onNav }: { location: string; onNav?: () => void }) {
  return (
    <>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => {
          const isActive = item.href === "/admin"
            ? location === "/admin"
            : location.startsWith(item.href + "/") || location === item.href;
          return (
            <Link key={item.href} href={item.href} onClick={onNav}>
              <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}>
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>
      <div className="p-3 border-t border-border">
        <Link href="/dashboard" onClick={onNav}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-background cursor-pointer transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to App
          </div>
        </Link>
      </div>
    </>
  );
}

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 border-r border-border bg-card flex-shrink-0 flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary text-lg">EduPro</span>
            <span className="text-xs text-muted-foreground">Admin</span>
          </div>
        </div>
        <NavContent location={location} />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b border-border flex items-center px-4 gap-3">
        <Button variant="ghost" size="sm" className="px-2" onClick={() => setMobileOpen(o => !o)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
        <span className="font-bold text-primary">EduPro</span>
        <span className="text-xs text-muted-foreground">Admin</span>
      </div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-14 left-0 bottom-0 w-64 bg-card border-r border-border flex flex-col shadow-2xl">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="font-bold text-primary text-lg">EduPro</span>
                <span className="text-xs text-muted-foreground">Admin</span>
              </div>
            </div>
            <NavContent location={location} onNav={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto min-w-0 md:pt-0 pt-14">
        {children}
      </main>
    </div>
  );
}
