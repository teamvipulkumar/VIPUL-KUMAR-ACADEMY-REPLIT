import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useLogout, useListNotifications, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { Bell, Menu, X, BookOpen, LayoutDashboard, Share2, CreditCard, LogOut, ShieldCheck, GraduationCap, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

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
    ...(isAdmin ? [{ href: "/admin", label: "Admin Panel", icon: ShieldCheck }] : []),
  ];

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 max-w-screen-2xl items-center px-4">
          {/* Logo */}
          <Link href="/" className="mr-6 flex items-center space-x-2 flex-shrink-0" onClick={() => setMobileOpen(false)}>
            <span className="font-bold text-xl text-primary tracking-tight">EduPro</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium flex-1">
            <Link href="/courses" className={`transition-colors hover:text-foreground ${location === "/courses" ? "text-foreground" : "text-foreground/60"}`}>Courses</Link>
            {isAuthenticated && (
              <>
                <Link href="/dashboard" className={`transition-colors hover:text-foreground ${location === "/dashboard" ? "text-foreground" : "text-foreground/60"}`}>Dashboard</Link>
                <Link href="/my-courses" className={`transition-colors hover:text-foreground ${location === "/my-courses" ? "text-foreground" : "text-foreground/60"}`}>My Learning</Link>
                <Link href="/affiliate" className={`transition-colors hover:text-foreground ${location === "/affiliate" ? "text-foreground" : "text-foreground/60"}`}>Affiliate</Link>
              </>
            )}
            {isAdmin && (
              <Link href="/admin" className="transition-colors text-primary font-semibold hover:text-primary/80">Admin</Link>
            )}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center space-x-2 ml-auto">
            {!isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" asChild><Link href="/login">Login</Link></Button>
                <Button size="sm" asChild><Link href="/register">Sign Up</Link></Button>
              </>
            ) : (
              <>
                <Link href="/notifications">
                  <Button variant="ghost" size="sm" className="relative">
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Button>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                      <span className="hidden sm:block text-sm">{user?.name?.split(" ")[0]}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
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
                    <DropdownMenuItem onClick={handleLogout} className="text-red-400 focus:text-red-400">Logout</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>

          {/* Mobile: bell + hamburger */}
          <div className="flex md:hidden items-center gap-2 ml-auto">
            {isAuthenticated && (
              <Link href="/notifications" onClick={() => setMobileOpen(false)}>
                <Button variant="ghost" size="sm" className="relative px-2">
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" className="px-2" onClick={() => setMobileOpen(o => !o)} aria-label="Toggle menu">
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          {/* Panel */}
          <nav className="absolute top-14 left-0 right-0 bg-background border-b border-border shadow-2xl max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            {isAuthenticated && (
              <div className="flex items-center gap-3 px-5 py-4 border-b border-border">
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            )}

            <div className="py-2">
              {navLinks.map(link => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                  <div className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-colors ${location === link.href ? "text-primary bg-primary/5" : "text-foreground hover:bg-card"}`}>
                    <link.icon className="w-4 h-4 flex-shrink-0" />
                    {link.label}
                    <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>

            <div className="px-4 py-4 border-t border-border space-y-2">
              {!isAuthenticated ? (
                <>
                  <Button className="w-full" asChild onClick={() => setMobileOpen(false)}>
                    <Link href="/register">Create Account</Link>
                  </Button>
                  <Button variant="outline" className="w-full" asChild onClick={() => setMobileOpen(false)}>
                    <Link href="/login">Sign In</Link>
                  </Button>
                </>
              ) : (
                <Button variant="ghost" className="w-full text-red-400 hover:text-red-400 hover:bg-red-500/10 flex items-center gap-2 justify-center" onClick={handleLogout}>
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
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row px-4">
          <p className="text-sm leading-loose text-muted-foreground text-center">
            &copy; {new Date().getFullYear()} EduPro Platform. All rights reserved.
          </p>
          <nav className="flex items-center gap-4 text-xs text-muted-foreground">
            <Link href="/courses" className="hover:text-foreground transition-colors">Courses</Link>
            <Link href="/affiliate" className="hover:text-foreground transition-colors">Affiliate Program</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
