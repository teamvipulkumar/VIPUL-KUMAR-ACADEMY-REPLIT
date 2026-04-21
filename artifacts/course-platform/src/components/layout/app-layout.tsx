import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { Button } from "@/components/ui/button";
import { useLogout, useListNotifications, getListNotificationsQueryKey, getGetMeQueryKey, useMarkNotificationRead, useMarkAllNotificationsRead } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, Menu, X, BookOpen, Share2, GraduationCap, LogOut, ShieldCheck, ChevronRight, Mail, Youtube, Twitter, Linkedin, Instagram, CheckCheck, Sun, Moon, ArrowRight, Star, Award, Users } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { EmailVerificationBanner } from "@/components/email-verification-banner";

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

/* ─── Notification Popup ─── */
function NotificationPopup({ iconSize = "w-4 h-4" }: { iconSize?: string }) {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const { data: notifications } = useListNotifications({ query: { queryKey: getListNotificationsQueryKey(), enabled: isAuthenticated } });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

  const handleMarkRead = (id: number) => {
    markRead.mutate({ notificationId: id }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    });
  };
  const handleMarkAll = () => {
    markAll.mutate(undefined, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListNotificationsQueryKey() }),
    });
  };
  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };
  const typeStyle: Record<string, { dot: string; border: string }> = {
    success: { dot: "bg-green-400", border: "border-l-green-500" },
    info:    { dot: "bg-blue-400",  border: "border-l-blue-500"  },
    warning: { dot: "bg-amber-400", border: "border-l-amber-500" },
    error:   { dot: "bg-red-400",   border: "border-l-red-500"   },
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative w-9 h-9 p-0 rounded-lg hover:bg-white/5">
          <Bell className={`${iconSize} text-foreground/70`} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={8} className="w-[min(20rem,calc(100vw-16px))] border p-0 shadow-2xl" style={{ backgroundColor: "var(--dropdown-bg)", borderColor: "var(--dropdown-border)" }} sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Bell className="w-3.5 h-3.5 text-primary" />
            <span className="text-sm font-semibold text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <span className="text-[10px] bg-primary/15 text-primary rounded-full px-1.5 py-0.5 font-bold">{unreadCount} new</span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={handleMarkAll} className="text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center gap-1">
              <CheckCheck className="w-3 h-3" />Mark all read
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-[360px] overflow-y-auto divide-y divide-white/[0.05]">
          {!notifications || notifications.length === 0 ? (
            <div className="py-12 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.slice(0, 8).map(n => {
              const ts = typeStyle[n.type] ?? typeStyle.info;
              return (
                <div
                  key={n.id}
                  onClick={() => { if (!n.isRead) handleMarkRead(n.id); }}
                  className={`flex gap-3 px-4 py-3 border-l-2 ${ts.border} transition-colors ${
                    n.isRead ? "opacity-55 cursor-default" : "bg-white/[0.025] cursor-pointer hover:bg-white/[0.05]"
                  }`}
                >
                  <span className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${ts.dot} ${n.isRead ? "opacity-40" : ""}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold leading-snug ${n.isRead ? "text-muted-foreground" : "text-foreground"}`}>{n.title}</p>
                      <span className="text-[10px] text-muted-foreground/50 flex-shrink-0 mt-0.5">{timeAgo(String(n.createdAt))}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{n.message}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        {notifications && notifications.length > 0 && (
          <div className="px-4 py-2.5 border-t border-white/10">
            <Link href="/notifications" className="text-xs text-primary hover:text-primary/80 transition-colors font-medium flex items-center justify-center gap-1">
              View all notifications <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function Navbar() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();
  const [location] = useLocation();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.setQueryData(getGetMeQueryKey(), null);
        queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
        setMobileOpen(false);
        setLocation("/");
      },
      onError: () => {
        queryClient.setQueryData(getGetMeQueryKey(), null);
        queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
        setMobileOpen(false);
        setLocation("/");
      },
    });
  };

  const navLinks = [
    { href: "/courses", label: "Courses", icon: BookOpen },
    { href: "/about-us", label: "About", icon: Award },
    ...(isAuthenticated ? [
      { href: "/my-courses", label: "My Learning", icon: GraduationCap },
      { href: "/affiliate", label: "Affiliate", icon: Share2 },
    ] : [
      { href: "/affiliate", label: "Earn with Us", icon: Share2 },
    ]),
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: ShieldCheck }] : []),
  ];

  const linkClass = (href: string) =>
    `relative py-1 text-sm font-medium transition-colors hover:text-foreground after:absolute after:bottom-0 after:left-0 after:h-[2px] after:w-full after:rounded-full after:bg-primary after:scale-x-0 hover:after:scale-x-100 after:transition-transform after:duration-200 ${
      location === href ? "text-foreground after:scale-x-100" : "text-foreground/55"
    }`;

  const isScrolledOrOpen = scrolled || mobileOpen;

  return (
    <>
      {/* ── Trust bar (desktop only) ── */}
      <div className={`hidden md:flex items-center justify-center gap-5 px-4 py-1.5 text-[11px] font-medium border-b transition-all duration-300 ${scrolled ? "h-0 overflow-hidden opacity-0 border-transparent py-0" : "opacity-100"}`}
        style={{ backgroundColor: "var(--nav-bg)", borderColor: "var(--nav-border)" }}>
        <div className="flex items-center gap-1.5 text-muted-foreground/70">
          <div className="flex gap-px">
            {[1,2,3,4,5].map(i => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
          </div>
          <span>4.9/5 · Rated by 2,400+ students</span>
        </div>
        <div className="w-px h-3.5 bg-border/50" />
        <div className="flex items-center gap-1.5 text-muted-foreground/70">
          <Award className="w-3 h-3 text-primary/70" />
          <span>Industry-recognized certificates</span>
        </div>
        <div className="w-px h-3.5 bg-border/50" />
        <div className="flex items-center gap-1.5 text-muted-foreground/70">
          <Users className="w-3 h-3 text-primary/70" />
          <span>Community of 2,400+ operators</span>
        </div>
      </div>

      {/* ── Main navbar ── */}
      <header className={`sticky top-0 left-0 right-0 z-50 w-full border-b transition-all duration-300 ${
        isScrolledOrOpen
          ? "shadow-[0_4px_32px_0_rgba(0,0,0,0.22)] backdrop-blur-xl"
          : "backdrop-blur-md"
      }`} style={{ backgroundColor: isScrolledOrOpen ? "var(--nav-bg-solid)" : "var(--nav-bg)", borderColor: "var(--nav-border)" }}>

        {/* Subtle gradient accent line at bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent pointer-events-none" />

        <div className={`max-w-screen-xl mx-auto flex items-center px-4 md:px-8 gap-6 transition-all duration-300 ${scrolled ? "h-13" : "h-16"}`}>

          {/* ── Logo ── */}
          <Link href="/" className="flex items-center gap-3 flex-shrink-0 group" onClick={() => setMobileOpen(false)}>
            <div className={`transition-all duration-300 ${scrolled ? "scale-[0.88] origin-left" : "scale-100"}`}>
              <AcademyLogo size={36} />
            </div>
            <div className="leading-none">
              <div className="font-black text-[15px] tracking-[0.06em] text-foreground whitespace-nowrap">
                VIPUL KUMAR
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="font-bold text-[9px] tracking-[0.28em] text-primary uppercase whitespace-nowrap">Academy</span>
                <span className="w-1 h-1 rounded-full bg-primary/50 flex-shrink-0" />
                <span className="font-semibold text-[9px] tracking-[0.15em] text-muted-foreground/60 uppercase whitespace-nowrap">Est. 2020</span>
              </div>
            </div>
          </Link>

          {/* ── Divider ── */}
          <div className="hidden lg:block w-px h-6 bg-border/60 flex-shrink-0" />

          {/* ── Desktop nav ── */}
          <nav className="hidden md:flex items-center gap-6 flex-1">
            {navLinks.map(link => (
              <Link key={link.href} href={link.href} className={linkClass(link.href)}>
                {link.label}
              </Link>
            ))}
          </nav>

          {/* ── Right actions ── */}
          <div className="hidden md:flex items-center gap-2 ml-auto flex-shrink-0">
            {!isAuthenticated ? (
              <>
                <Button variant="ghost" size="sm" asChild className="text-foreground/60 hover:text-foreground text-sm h-9 px-4">
                  <Link href="/login">Sign In</Link>
                </Button>
                <Button size="sm" asChild className="h-9 px-5 text-sm font-semibold bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/25 rounded-lg gap-1.5">
                  <Link href="/register">Start Learning <ArrowRight className="w-3.5 h-3.5" /></Link>
                </Button>
              </>
            ) : (
              <div className="flex items-center gap-1.5">
                <NotificationPopup iconSize="w-4 h-4" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2 h-9 px-2.5 rounded-lg hover:bg-white/5">
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ring-2 ring-primary/20">
                        {user?.name?.charAt(0).toUpperCase()}
                      </div>
                      <span className="hidden lg:block text-sm font-medium text-foreground/80">{user?.name?.split(" ")[0]}</span>
                      <ChevronRight className="hidden lg:block w-3.5 h-3.5 text-muted-foreground/50 rotate-90" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56 border" style={{ backgroundColor: "var(--dropdown-bg)", borderColor: "var(--dropdown-border)" }}>
                    <div className="px-3 py-2.5 border-b mb-1" style={{ borderColor: "var(--dropdown-border)" }}>
                      <p className="text-xs font-semibold text-foreground truncate">{user?.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <DropdownMenuItem asChild><Link href="/my-courses">My Learning</Link></DropdownMenuItem>
                    <DropdownMenuItem asChild><Link href="/affiliate">Affiliate Program</Link></DropdownMenuItem>
                    {isAdmin && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem asChild><Link href="/admin">Admin Panel</Link></DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <div className="px-2 py-1">
                      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-1">Preferences</p>
                      <button
                        onClick={toggleTheme}
                        className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm text-foreground hover:bg-accent transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          {theme === "dark" ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                          {theme === "dark" ? "Dark Mode" : "Light Mode"}
                        </span>
                        <span className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${theme === "dark" ? "bg-primary" : "bg-muted"}`}>
                          <span className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition-transform ${theme === "dark" ? "translate-x-3.5" : "translate-x-0.5"}`} />
                        </span>
                      </button>
                    </div>
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
            {isAuthenticated && <NotificationPopup iconSize="w-5 h-5" />}
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

      {/* ── Mobile drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <nav className="absolute top-[65px] left-0 right-0 border-b shadow-2xl max-h-[calc(100vh-65px)] overflow-y-auto" style={{ backgroundColor: "var(--mobile-drawer-bg)", borderColor: "var(--nav-border)" }}>

            {/* Brand trust strip */}
            {!isAuthenticated && (
              <div className="flex items-center justify-center gap-1.5 px-5 py-2.5 border-b border-white/5 bg-primary/5">
                <div className="flex gap-px">
                  {[1,2,3,4,5].map(i => <Star key={i} className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />)}
                </div>
                <span className="text-xs font-medium text-muted-foreground/80">4.9/5 · 2,400+ students enrolled</span>
              </div>
            )}

            {isAuthenticated && (
              <div className="flex items-center gap-3 px-5 py-4 border-b border-white/5">
                <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-sm font-bold text-white ring-2 ring-primary/20">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">{user?.name}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            )}

            <div className="py-1.5">
              {navLinks.map(link => (
                <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                  <div className={`flex items-center gap-3 px-5 py-3.5 text-sm font-medium transition-colors ${
                    location === link.href
                      ? "text-primary bg-primary/8 border-l-2 border-primary"
                      : "text-foreground/70 hover:text-foreground hover:bg-white/5"
                  }`}>
                    <link.icon className="w-4 h-4 flex-shrink-0" />
                    {link.label}
                    <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground/40" />
                  </div>
                </Link>
              ))}
            </div>

            <div className="px-4 py-4 border-t border-white/5 space-y-2.5">
              {!isAuthenticated ? (
                <>
                  <Button className="w-full h-11 bg-primary hover:bg-primary/90 font-semibold text-sm shadow-md shadow-primary/20 gap-2" asChild onClick={() => setMobileOpen(false)}>
                    <Link href="/register">Start Learning Free <ArrowRight className="w-4 h-4" /></Link>
                  </Button>
                  <Button variant="outline" className="w-full h-11 border-white/10 hover:bg-white/5 text-sm font-medium" asChild onClick={() => setMobileOpen(false)}>
                    <Link href="/login">Sign In</Link>
                  </Button>
                  <p className="text-center text-[11px] text-muted-foreground/50 pt-1">No credit card required · 30-day guarantee</p>
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

export function SiteFooter() {
  const year = new Date().getFullYear();

  const footerNav = {
    platform: [
      { label: "Browse Courses", href: "/courses" },
      { label: "My Learning", href: "/my-courses" },
      { label: "Affiliate Program", href: "/affiliate" },
    ],
    company: [
      { label: "About Us", href: "/about-us" },
      { label: "Careers", href: "/careers" },
      { label: "Contact Us", href: "/contact-us" },
      { label: "Help Center", href: "/help-center" },
    ],
    legal: [
      { label: "Privacy Policy", href: "/privacy-policy" },
      { label: "Terms of Service", href: "/terms-of-service" },
      { label: "Cookie Policy", href: "/cookie-policy" },
      { label: "Refund Policy", href: "/refund-policy" },
    ],
  };

  const social = [
    { icon: Youtube, label: "YouTube", href: "#", color: "hover:text-red-400" },
    { icon: Twitter, label: "Twitter / X", href: "#", color: "hover:text-sky-400" },
    { icon: Linkedin, label: "LinkedIn", href: "#", color: "hover:text-blue-400" },
    { icon: Instagram, label: "Instagram", href: "#", color: "hover:text-pink-400" },
    { icon: Mail, label: "Email", href: "mailto:support@vipulkumaracademy.com", color: "hover:text-primary" },
  ];

  return (
    <footer className="border-t" style={{ backgroundColor: "var(--footer-bg)", borderColor: "var(--nav-border)" }}>
      {/* ── Main grid ── */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-8 pt-14 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
              <AcademyLogo size={36} />
              <div className="leading-none">
                <p className="font-extrabold text-sm tracking-wide text-foreground">VIPUL KUMAR</p>
                <p className="font-bold text-[11px] tracking-[0.2em] text-primary uppercase">Academy</p>
              </div>
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-5">
              Premium online education platform for aspiring entrepreneurs. Master affiliate marketing, e-commerce, and dropshipping — built by operators.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-2">
              {social.map(({ icon: Icon, label, href, color }) => (
                <a
                  key={label}
                  href={href}
                  target={href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  aria-label={label}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center text-muted-foreground transition-all hover:text-foreground ${color}`} style={{ backgroundColor: "var(--elevate-1)", borderColor: "var(--button-outline)" }}
                >
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-4">Platform</h4>
            <ul className="space-y-2.5">
              {footerNav.platform.map(item => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-4">Company</h4>
            <ul className="space-y-2.5">
              {footerNav.company.map(item => (
                <li key={item.label}>
                  <Link href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-widest mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {footerNav.legal.map(item => (
                <li key={item.href}>
                  <Link href={item.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
            {/* Trust badge */}
            <div className="mt-6 flex items-center gap-1.5 text-xs text-muted-foreground/60">
              <svg className="w-3.5 h-3.5 text-green-500/70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
              SSL Secured &amp; GDPR Compliant
            </div>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-white/[0.05]" />

      {/* ── Bottom bar ── */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-8 py-5">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {/* Copyright */}
          <p className="text-xs text-muted-foreground/60 text-center sm:text-left">
            &copy; {year} Vipul Kumar Academy. All rights reserved. Made with ♥ in India.
          </p>

          {/* Legal quick links */}
          <div className="flex items-center gap-4 flex-wrap justify-center">
            {footerNav.legal.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export function AppLayout({ children, noFooter }: { children: React.ReactNode; noFooter?: boolean }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <div className="pt-16">
        <EmailVerificationBanner />
        <main className="flex-1 min-w-0">{children}</main>
      </div>
      {!noFooter && <SiteFooter />}
    </div>
  );
}
