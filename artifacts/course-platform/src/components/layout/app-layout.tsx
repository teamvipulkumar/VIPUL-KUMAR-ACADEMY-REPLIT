import { Link, useLocation } from "wouter";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { useLogout, useListNotifications, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function Navbar() {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const [, setLocation] = useLocation();
  const logout = useLogout();
  const { data: notifications } = useListNotifications({ query: { queryKey: getListNotificationsQueryKey(), enabled: isAuthenticated } });
  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => setLocation("/"),
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 flex flex-1">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="font-bold text-xl text-primary tracking-tight">EduPro</span>
          </Link>
          <nav className="flex items-center space-x-6 text-sm font-medium">
            <Link href="/courses" className="transition-colors hover:text-foreground/80 text-foreground/60">Courses</Link>
            {isAuthenticated && (
              <>
                <Link href="/dashboard" className="transition-colors hover:text-foreground/80 text-foreground/60">Dashboard</Link>
                <Link href="/my-courses" className="transition-colors hover:text-foreground/80 text-foreground/60">My Learning</Link>
                <Link href="/affiliate" className="transition-colors hover:text-foreground/80 text-foreground/60">Affiliate</Link>
              </>
            )}
            {isAdmin && (
              <Link href="/admin" className="transition-colors hover:text-foreground/80 text-foreground/60 font-semibold text-primary">Admin</Link>
            )}
          </nav>
        </div>
        <div className="flex items-center space-x-2">
          {!isAuthenticated ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Sign Up</Link>
              </Button>
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
      </div>
    </header>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1">{children}</main>
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row">
          <p className="text-sm leading-loose text-muted-foreground">
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
