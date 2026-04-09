import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useLogout, useListNotifications, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { Bell, Menu, X, BookOpen, LayoutDashboard, Share2, GraduationCap, LogOut, ShieldCheck, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

function AcademyLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="10" fill="#2563eb" />
      <path d="M20 8L32 14v2l-12 6L8 16v-2L20 8z" fill="white" opacity="0.95" />
      <path d="M12 18.5v7c0 1.5 3.6 4.5 8 4.5s8-3 8-4.5v-7L20 22l-8-3.5z" fill="white" opacity="0.85" />
      <rect x="31" y="14" width="2" height="10" rx="1" fill="white" opacity="0.7" />
      <circle cx="32" cy="25" r="2" fill="#60a5fa" />
    </svg>
  );
}

export function Navbar() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const logout = useLogout();
  const { data: notifications } = useListNotifications({ query: { queryKey: getListNotificationsQueryKey(), enabled: isAuthenticated } });
  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, { onSuccess: () => { setLocation("/"); setMobileOpen(false); } });
  };

  const navLinks = [
    { href: "/courses", label: "Courses", icon: BookOpen },
    ...(isAuthenticated ? [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/my-courses", label: "My Learning", icon: GraduationCap },
      { href: "/affiliate", label: "Affiliate", icon: Share2 },
    ] : []),
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  const linkClass = (href: string) =>
    `relative py-1 text-sm font-medium transition-colors hover:text-foreground after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:rounded-full after:bg-primary after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200 ${
      location === href
        ? "text-foreground after:scale-x-100"
        : "text-foreground/60"
    }`;

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#070c1a]/95 backdrop-blur supports-[backdrop-filter]:bg-[#070c1a]/80 shadow-[0_1px_0_0_rgba(255,255,255,0.05)]">
        <div className="max-w-screen-xl mx-auto flex h-16 items-center px-4 md:px-8 gap-4">

          {/* ── Logo (left) ── */}
          <Link href="/" className="flex items-center gap-2.5 flex-shrink-0 group" onClick={() => setMobileOpen(false)}>
            <AcademyLogo size={34} />
            <div className="leading-none">
              <span className="font-extrabold text-sm tracking-wide text-white">VIPUL KUMAR</span>
              <br />
              <span className="font-bold text-[11px] tracking-[0.18em] text-primary/90 uppercase">Academy</span>
            </div>
          </Link>

          {/* ── Center nav (desktop) ── */}
          <nav className="hidden md:flex items-center gap-7 flex-1 justify-center">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </nav>

          {/* ── Right actions (desktop) ── */}
          <div className="hidden md:flex items-center gap-2 ml-auto flex-shrink-0">
            {!isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" asChild className="text-foreground/70 hover:text-foreground">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button size="sm" asChild className="bg-primary hover:bg-primary/90 text-white font-semibold px-4 rounded-lg">
                  <Link href="/register">Get Started</Link>
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <Link href="/notifications">
                  <Button variant="ghost" size="sm" className="relative w-9 h-9 p-0 rounded-lg hover:bg-white/5">
                    <Bell className="w-4 h-4 text-foreground/70" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 h-9 px-2 rounded-lg hover:bg-white/5">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                      <span className="hidden lg:block text-sm font-medium text-foreground/80">{user?.name?.split(" ")[0]}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52 bg-[#0d1424] border-white/10">
                    <div className="px-3 py-2 border-b border-white/5 mb-1">
                      <p className="text-xs font-semibold text-foreground truncate">{user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <DropdownMenuItem asChild><Link href="/dashboard">Dashboard</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/my-courses">My Courses</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/payments">Payment History</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/affiliate">Affiliate</Link></DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild><Link href="/admin">Admin Panel</Link></DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:text-red-400 focus:bg-red-500/10">
                      <LogOut className="w-3.5 h-3.5 mr-2" />Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          {/* ── Mobile right controls ── */}
          <div className="flex md:hidden items-center gap-1 ml-auto">
            {isAuthenticated && (
              <Link href="/notifications" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" size="sm" className="relative w-9 h-9 p-0 rounded-lg hover:bg-white/5">
                  <Bell className="w-5 h-5 text-foreground/70" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="w-9 h-9 p-0 rounded-lg hover:bg-white/5"
              onClick={() => setMobileOpen(o => !o)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* ── Mobile full-screen drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <nav className="absolute top-16 left-0 right-0 bg-[#070c1a] border-b border-white/10 shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto">
            {isAuthenticated && (
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            )}

            <div className="py-2">
              {navLinks.map(link => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                  <div className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-colors ${
                    location === link.href
                      ? "text-primary bg-primary/8 border-l-2 border-primary"
                      : "text-foreground/70 hover:text-foreground hover:bg-white/5"
                  }`}>
                    <link.icon className="w-4 h-4 flex-shrink-0" />
                    {link.label}
                    <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/50" />
                  </div>
                </Link>
              ))}
            </div>

            <div className="px-4 py-4 border-t border-white/5 space-y-2">
              {!isAuthenticated ? (
                <>
                  <Button className="w-full bg-primary hover:bg-primary/90 font-semibold" asChild onClick={() => setMobileOpen(false)}>
                    <Link href="/register">Get Started Free</Link>
                  </Button>
                  <Button variant="outline" className="w-full border-white/10 hover:bg-white/5" asChild onClick={() => setMobileOpen(false)}>
                    <Link href="/login">Log In</Link>
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  className="w-full text-red-400 hover:text-red-300 hover:bg-red-500/10 flex items-center gap-2 justify-center"
                  onClick={handleLogout}
                >
                  <LogOut className="w-4 h-4" />Sign Out
                </Button>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/[0.06] py-6 md:py-0 bg-[#070c1a]">
        <div className="max-w-screen-xl mx-auto flex flex-col items-center justify-between gap-3 md:h-14 md:flex-row px-4 md:px-8">
          <div className="flex items-center gap-2">
            <AcademyLogo size={20} />
            <p className="text-xs text-muted-foreground">
              &copy; {new Date().getFullYear()} Vipul Kumar Academy. All rights reserved.
            </p>
          </div>
          <nav className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/courses" className="hover:text-foreground transition-colors">Courses</Link>
            <Link href="/affiliate" className="hover:text-foreground transition-colors">Affiliate</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
