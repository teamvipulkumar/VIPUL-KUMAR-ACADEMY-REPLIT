import { Link, useLocation } from "wouter";
import { LayoutDashboard, Users, BookOpen, Share2, CreditCard, Tag, Settings, ArrowLeft } from "lucide-react";

const navItems = [
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/admin/courses", icon: BookOpen, label: "Courses" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/affiliates", icon: Share2, label: "Affiliates" },
  { href: "/admin/payouts", icon: CreditCard, label: "Payouts" },
  { href: "/admin/coupons", icon: Tag, label: "Coupons" },
  { href: "/admin/settings", icon: Settings, label: "Settings" },
];

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="flex min-h-screen bg-background">
      <aside className="w-56 border-r border-border bg-card flex-shrink-0 flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="font-bold text-primary text-lg">EduPro</span>
            <span className="text-xs text-muted-foreground">Admin</span>
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(item => {
            const isActive = item.href === "/admin" ? location === "/admin" : location.startsWith(item.href + "/") || location === item.href;
            return (
              <Link key={item.href} href={item.href}>
                <div className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-background hover:text-foreground"}`}>
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <Link href="/dashboard">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:bg-background cursor-pointer transition-colors">
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to App
            </div>
          </Link>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto min-w-0">{children}</main>
    </div>
  );
}
