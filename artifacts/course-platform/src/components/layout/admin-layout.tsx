import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, BookOpen, Share2, CreditCard, Tag, Settings, ArrowLeft, Menu, X, ShoppingCart, GraduationCap, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";

function AdminLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#2563eb" />
      <path d="M20 8L32 14v2l-12 6L8 16v-2L20 8z" fill="white" opacity="0.95" />
      <path d="M12 18.5v7c0 1.5 3.6 4.5 8 4.5s8-3 8-4.5v-7L20 22l-8-3.5z" fill="white" opacity="0.85" />
      <rect x="31" y="14" width="2" height="10" rx="1" fill="white" opacity="0.7" />
      <circle cx="32" cy="25" r="2" fill="#60a5fa" />
    </svg>
  );
}

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/orders", icon: ShoppingCart, label: "Orders" },
  { href: "/admin/enrollments", icon: GraduationCap, label: "Enrollments" },
  { href: "/admin/courses", icon: BookOpen, label: "Courses" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/affiliates", icon: Share2, label: "Affiliates" },
  { href: "/admin/payouts", icon: CreditCard, label: "Payouts" },
  { href: "/admin/coupons", icon: Tag, label: "Coupons" },
  { href: "/admin/payment-gateways", icon: Landmark, label: "Payment Gateways" },
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
        <Link href="/" onClick={onNav}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-background cursor-pointer transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Site
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
            <AdminLogo />
            <div className="leading-none">
              <p className="font-bold text-xs text-foreground tracking-wide">VK ACADEMY</p>
              <p className="text-[10px] text-primary/80 tracking-wider uppercase font-medium">Admin Panel</p>
            </div>
          </div>
        </div>
        <NavContent location={location} />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-card border-b border-border flex items-center px-4 gap-3">
        <Button variant="ghost" size="sm" className="px-2" onClick={() => setMobileOpen(o => !o)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
        <AdminLogo />
        <div className="leading-none">
          <p className="font-bold text-xs text-foreground">VK ACADEMY</p>
          <p className="text-[10px] text-primary/80 tracking-wide uppercase">Admin Panel</p>
        </div>
      </div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-14 left-0 bottom-0 w-64 bg-card border-r border-border flex flex-col shadow-2xl">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <AdminLogo />
                <div className="leading-none">
                  <p className="font-bold text-xs text-foreground tracking-wide">VK ACADEMY</p>
                  <p className="text-[10px] text-primary/80 tracking-wider uppercase">Admin Panel</p>
                </div>
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
