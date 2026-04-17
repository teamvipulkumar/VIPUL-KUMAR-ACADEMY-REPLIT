import { useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, BookOpen, Share2, CreditCard, Tag, Settings, ArrowLeft, Menu, X, ShoppingCart, GraduationCap, Landmark, Mail, Layers, FileText, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";

function AdminLogo() {
  return (
    <svg width="26" height="26" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#0f2210" />
      <rect width="40" height="40" rx="10" fill="url(#adminLogoGrad)" />
      <path d="M20 8L32 14v2l-12 6L8 16v-2L20 8z" fill="#22c55e" opacity="0.95" />
      <path d="M12 18.5v7c0 1.5 3.6 4.5 8 4.5s8-3 8-4.5v-7L20 22l-8-3.5z" fill="#22c55e" opacity="0.75" />
      <rect x="31" y="14" width="2" height="10" rx="1" fill="#4ade80" opacity="0.8" />
      <circle cx="32" cy="25" r="2" fill="#4ade80" />
      <defs>
        <linearGradient id="adminLogoGrad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#052c0a" />
          <stop offset="100%" stopColor="#0a1a0b" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const navGroups = [
  {
    label: "DASHBOARDS",
    items: [
      { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
      { href: "/admin/orders", icon: ShoppingCart, label: "Orders" },
      { href: "/admin/enrollments", icon: GraduationCap, label: "Enrollments" },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { href: "/admin/courses", icon: BookOpen, label: "Courses" },
      { href: "/admin/users", icon: Users, label: "Users" },
      { href: "/admin/affiliates", icon: Share2, label: "Affiliates" },
      { href: "/admin/payouts", icon: CreditCard, label: "Payouts" },
      { href: "/admin/coupons", icon: Tag, label: "Coupons" },
    ],
  },
  {
    label: "SETTINGS",
    items: [
      { href: "/admin/payment-gateways", icon: Landmark, label: "Payment Gateways" },
      { href: "/admin/crm", icon: Mail, label: "CRM & Email" },
      { href: "/admin/gst-invoicing", icon: FileText, label: "GST Invoicing" },
      { href: "/admin/files", icon: HardDrive, label: "Files" },
      { href: "/admin/pages", icon: Layers, label: "Pages" },
      { href: "/admin/settings", icon: Settings, label: "Settings" },
    ],
  },
];

function NavContent({ location, onNav }: { location: string; onNav?: () => void }) {
  return (
    <>
      <nav className="flex-1 p-3 space-y-5 overflow-y-auto">
        {navGroups.map(group => (
          <div key={group.label}>
            <p className="text-[10px] font-semibold tracking-widest px-3 mb-1.5" style={{ color: "hsl(142 40% 30%)" }}>
              {group.label}
            </p>
            <div className="space-y-0.5">
              {group.items.map(item => {
                const isActive = item.href === "/admin"
                  ? location === "/admin"
                  : location.startsWith(item.href + "/") || location === item.href;
                return (
                  <Link key={item.href} href={item.href} onClick={onNav}>
                    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
                      isActive
                        ? "admin-nav-active"
                        : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                    }`}>
                      <item.icon className="w-4 h-4 flex-shrink-0" />
                      {item.label}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
      <div className="p-3 border-t border-border">
        <Link href="/" onClick={onNav}>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-white/5 cursor-pointer transition-colors">
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
    <div className="admin-theme flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-56 border-r border-border bg-background flex-shrink-0 flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <AdminLogo />
            <div className="leading-none">
              <p className="font-bold text-xs text-foreground tracking-wide">VK ACADEMY</p>
              <p className="text-[10px] tracking-wider uppercase font-medium" style={{ color: "hsl(142 71% 45%)" }}>Admin Panel</p>
            </div>
          </div>
        </div>
        <NavContent location={location} />
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 h-14 bg-background border-b border-border flex items-center px-4 gap-3">
        <Button variant="ghost" size="sm" className="px-2" onClick={() => setMobileOpen(o => !o)}>
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
        <AdminLogo />
        <div className="leading-none">
          <p className="font-bold text-xs text-foreground">VK ACADEMY</p>
          <p className="text-[10px] tracking-wide uppercase font-medium" style={{ color: "hsl(142 71% 45%)" }}>Admin Panel</p>
        </div>
      </div>

      {/* Mobile sidebar drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute top-14 left-0 bottom-0 w-64 bg-background border-r border-border flex flex-col shadow-2xl">
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <AdminLogo />
                <div className="leading-none">
                  <p className="font-bold text-xs text-foreground tracking-wide">VK ACADEMY</p>
                  <p className="text-[10px] tracking-wider uppercase font-medium" style={{ color: "hsl(142 71% 45%)" }}>Admin Panel</p>
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
