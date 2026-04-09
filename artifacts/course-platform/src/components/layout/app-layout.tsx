import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useLogout, useListNotifications, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { Bell, Menu, X, BookOpen, LayoutDashboard, Share2, GraduationCap, LogOut, ShieldCheck, ChevronRight, Mail, Youtube, Twitter, Linkedin, Instagram } from "lucide-react";
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

function SiteFooter() {
  const year = new Date().getFullYear();

  const footerNav = {
    platform: [
      { label: "Browse Courses", href: "/courses" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "My Learning", href: "/my-courses" },
      { label: "Affiliate Program", href: "/affiliate" },
      { label: "Payment History", href: "/payments" },
    ],
    company: [
      { label: "About Us", href: "#" },
      { label: "Blog", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Contact Us", href: "mailto:hello@vipulkumaracademy.com" },
      { label: "Help Center", href: "#" },
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
    { icon: Mail, label: "Email", href: "mailto:hello@vipulkumaracademy.com", color: "hover:text-primary" },
  ];

  return (
    <footer className="bg-[#040810] border-t border-white/[0.06]">
      {/* ── Main grid ── */}
      <div className="max-w-screen-xl mx-auto px-4 md:px-8 pt-14 pb-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">

          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
              <AcademyLogo size={36} />
              <div className="leading-none">
                <p className="font-extrabold text-sm tracking-wide text-white">VIPUL KUMAR</p>
                <p className="font-bold text-[11px] tracking-[0.2em] text-primary/90 uppercase">Academy</p>
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
                  className={`w-8 h-8 rounded-lg bg-white/5 border border-white/[0.07] flex items-center justify-center text-muted-foreground transition-all hover:bg-white/10 hover:border-white/15 ${color}`}
                >
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>

          {/* Platform */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-widest mb-4">Platform</h4>
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
            <h4 className="text-xs font-semibold text-white uppercase tracking-widest mb-4">Company</h4>
            <ul className="space-y-2.5">
              {footerNav.company.map(item => (
                <li key={item.label}>
                  <a
                    href={item.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    {...(item.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-xs font-semibold text-white uppercase tracking-widest mb-4">Legal</h4>
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

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
