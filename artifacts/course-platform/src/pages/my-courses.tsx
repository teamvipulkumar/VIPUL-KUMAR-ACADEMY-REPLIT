import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListMyEnrollments, getListMyEnrollmentsQueryKey, useGetPaymentHistory, getGetPaymentHistoryQueryKey } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Play, CheckCircle2, Clock, TrendingUp,
  BadgeIndianRupee, ShoppingBag, ChevronRight, Layers,
  CheckCheck, AlertCircle, RotateCcw, Zap, Calendar,
  GraduationCap, CreditCard, Star, Package, ChevronDown,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Tab = "courses" | "packages" | "orders";

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  completed: { label: "Paid", cls: "text-green-400 border-green-400/30 bg-green-400/10", icon: <CheckCircle2 className="w-3 h-3" /> },
  pending:   { label: "Pending", cls: "text-amber-400 border-amber-400/30 bg-amber-400/10", icon: <Clock className="w-3 h-3" /> },
  failed:    { label: "Failed", cls: "text-red-400 border-red-400/30 bg-red-400/10", icon: <AlertCircle className="w-3 h-3" /> },
  refunded:  { label: "Refunded", cls: "text-blue-400 border-blue-400/30 bg-blue-400/10", icon: <RotateCcw className="w-3 h-3" /> },
};

const GATEWAY_LABEL: Record<string, string> = {
  cashfree: "Cashfree", razorpay: "Razorpay", stripe: "Stripe",
  payu: "PayU", paytm: "Paytm",
};

const levelColors: Record<string, string> = {
  beginner: "bg-green-500/10 text-green-400 border-green-500/20",
  intermediate: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  advanced: "bg-red-500/10 text-red-400 border-red-500/20",
};

type BundleCourse = {
  id: number; title: string; description: string | null; thumbnailUrl: string | null;
  price: number; category: string; level: string; durationMinutes: number;
};
type MyBundle = {
  id: number; name: string; slug: string; description: string | null;
  thumbnailUrl: string | null; price: number; compareAtPrice: number | null;
  purchasedAt: string | null; amount: number | null; courses: BundleCourse[];
};

function useMyBundles() {
  return useQuery<MyBundle[]>({
    queryKey: ["my-bundles"],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/payments/my-bundles`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-3 sm:p-4 flex items-center gap-2.5 sm:gap-3.5">
      <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4 sm:[&>svg]:w-5 sm:[&>svg]:h-5">{icon}</div>
      <div className="min-w-0">
        <p className="text-lg sm:text-xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{label}</p>
        {sub && <p className="text-[10px] text-primary mt-0.5 truncate">{sub}</p>}
      </div>
    </div>
  );
}

function CourseCard({ e }: { e: any }) {
  const pct = e.progressPercent ?? 0;
  const isDone = pct === 100;
  const isStarted = pct > 0;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden hover:border-primary/40 transition-all group">
      <div className="relative aspect-video bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center overflow-hidden">
        {e.course?.thumbnailUrl ? (
          <img src={e.course.thumbnailUrl} alt={e.course.title} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#2563eb22_0%,_transparent_60%)]" />
            <GraduationCap className="w-14 h-14 text-primary/30" />
          </>
        )}
        {isDone && (
          <div className="absolute top-3 right-3 bg-green-500/20 border border-green-500/30 text-green-400 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCheck className="w-3 h-3" />Completed
          </div>
        )}
        {!isDone && isStarted && (
          <div className="absolute top-3 right-3 bg-primary/20 border border-primary/30 text-primary text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Zap className="w-3 h-3" />In Progress
          </div>
        )}
        <Link href={`/learn/${e.courseId}`}>
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </Link>
      </div>

      <div className="p-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground text-sm leading-tight line-clamp-2">{e.course?.title}</h3>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 mb-3">
          {e.course?.category && (
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground px-1.5 py-0">
              <Layers className="w-2.5 h-2.5 mr-1" />{e.course.category}
            </Badge>
          )}
          {e.course?.level && (
            <Badge variant="outline" className="text-[10px] border-border text-muted-foreground px-1.5 py-0 capitalize">
              <Star className="w-2.5 h-2.5 mr-1" />{e.course.level}
            </Badge>
          )}
        </div>
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Progress</span>
            <span className={`text-xs font-bold ${isDone ? "text-green-400" : "text-primary"}`}>{pct}%</span>
          </div>
          <Progress value={pct} className="h-1.5" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Calendar className="w-3 h-3" />
            {new Date(e.enrolledAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </div>
          <Button size="sm" asChild className={`h-7 text-xs px-3 gap-1 ${isDone ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30" : "bg-primary hover:bg-primary/90 text-white"}`}>
            <Link href={`/learn/${e.courseId}`}>
              {isDone ? <><CheckCheck className="w-3 h-3" />Review</> : isStarted ? <>Continue <ChevronRight className="w-3 h-3" /></> : <>Start <Play className="w-3 h-3 fill-white" /></>}
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

function BundleCard({ bundle, enrollments }: { bundle: MyBundle; enrollments: any[] }) {
  const [expanded, setExpanded] = useState(false);
  const [, navigate] = useLocation();
  const totalHours = Math.round(bundle.courses.reduce((s, c) => s + (c.durationMinutes ?? 0), 0) / 60);

  const getCourseProgress = (courseId: number) => {
    const enrollment = enrollments.find(e => e.courseId === courseId);
    return enrollment?.progressPercent ?? 0;
  };

  const totalProgress = bundle.courses.length > 0
    ? Math.round(bundle.courses.reduce((s, c) => s + getCourseProgress(c.id), 0) / bundle.courses.length)
    : 0;

  const completedCourses = bundle.courses.filter(c => getCourseProgress(c.id) === 100).length;

  return (
    <div className="bg-gradient-to-br from-primary/10 via-card to-blue-950/30 border border-primary/30 rounded-2xl overflow-hidden hover:border-primary/50 transition-all">
      {/* Bundle Header */}
      <div className="p-5">
        <div className="flex gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-24 h-16 rounded-xl overflow-hidden">
            {bundle.thumbnailUrl ? (
              <img src={bundle.thumbnailUrl} alt={bundle.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-primary/20 to-blue-900/40 flex items-center justify-center">
                <Package className="w-7 h-7 text-primary/40" />
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex items-center gap-1 text-xs font-semibold text-primary uppercase tracking-wider">
                <Star className="w-3 h-3 fill-primary" />Package
              </span>
              <span className="text-xs text-muted-foreground">· {bundle.courses.length} courses</span>
            </div>
            <h3 className="font-bold text-foreground text-base leading-tight mb-1">{bundle.name}</h3>
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><BookOpen className="w-3 h-3 text-primary" />{bundle.courses.length} courses</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3 text-primary" />{totalHours}h total</span>
              <span className="flex items-center gap-1"><CheckCheck className="w-3 h-3 text-green-400" />{completedCourses}/{bundle.courses.length} done</span>
            </div>
          </div>

          {/* Progress circle + expand */}
          <div className="flex-shrink-0 flex flex-col items-end gap-2">
            <div className="text-right">
              <p className={`text-lg font-bold ${totalProgress === 100 ? "text-green-400" : "text-primary"}`}>{totalProgress}%</p>
              <p className="text-[10px] text-muted-foreground">overall</p>
            </div>
          </div>
        </div>

        {/* Overall Progress Bar */}
        <div className="mt-3 mb-3">
          <Progress value={totalProgress} className="h-2" />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Purchased {bundle.purchasedAt ? new Date(bundle.purchasedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
          </span>
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            {expanded ? "Hide" : "View"} courses
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Course List */}
      {expanded && (
        <div className="border-t border-primary/20 divide-y divide-border/50">
          {bundle.courses.map((course, idx) => {
            const pct = getCourseProgress(course.id);
            const isDone = pct === 100;
            const isStarted = pct > 0;
            return (
              <div key={course.id} className="flex items-center gap-3 px-5 py-3.5 bg-background/30 hover:bg-primary/5 transition-colors">
                {/* Number */}
                <span className="text-xs text-primary/50 font-mono w-5 flex-shrink-0">#{idx + 1}</span>

                {/* Thumbnail */}
                <div className="flex-shrink-0 w-12 h-8 rounded-lg overflow-hidden">
                  {course.thumbnailUrl ? (
                    <img src={course.thumbnailUrl} alt={course.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/20 to-blue-900/40 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary/40">{course.category?.charAt(0)}</span>
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{course.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge variant="outline" className={`text-[9px] px-1 py-0 capitalize border ${levelColors[course.level] ?? "border-border text-muted-foreground"}`}>
                      {course.level}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">{Math.round((course.durationMinutes ?? 0) / 60)}h</span>
                  </div>
                </div>

                {/* Progress */}
                <div className="flex-shrink-0 w-16 hidden sm:block">
                  <div className="flex justify-between mb-0.5">
                    <span className="text-[9px] text-muted-foreground">Progress</span>
                    <span className={`text-[9px] font-bold ${isDone ? "text-green-400" : "text-primary"}`}>{pct}%</span>
                  </div>
                  <Progress value={pct} className="h-1" />
                </div>

                {/* CTA */}
                <Button
                  size="sm"
                  className={`flex-shrink-0 h-7 text-xs px-3 gap-1 ${isDone ? "bg-green-500/20 text-green-400 hover:bg-green-500/30 border border-green-500/30" : "bg-primary hover:bg-primary/90 text-white"}`}
                  onClick={() => navigate(`/learn/${course.id}`)}
                >
                  {isDone ? <><CheckCheck className="w-3 h-3" />Review</> : isStarted ? <>Continue</> : <><Play className="w-3 h-3 fill-white" />Start</>}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OrderRow({ p }: { p: any }) {
  const meta = STATUS_META[p.status] ?? STATUS_META.pending;
  const isBundle = !!p.bundle;
  return (
    <div className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors border-b border-border last:border-0">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isBundle ? "bg-primary/15" : "bg-primary/10"}`}>
        {isBundle ? <Package className="w-4 h-4 text-primary" /> : <ShoppingBag className="w-4 h-4 text-primary" />}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isBundle && (
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">Package</span>
          )}
          <p className="text-sm font-semibold text-foreground truncate">
            {isBundle ? p.bundle.name : (p.course?.title ?? `Course #${p.courseId}`)}
          </p>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground capitalize">{GATEWAY_LABEL[p.gateway] ?? p.gateway}</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" />
            {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        <p className="text-sm font-bold text-foreground">₹{Number(p.amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
        <Badge className={`text-[10px] mt-1 gap-1 ${meta.cls}`}>
          {meta.icon}{meta.label}
        </Badge>
      </div>
    </div>
  );
}

export default function MyCoursesPage() {
  const [tab, setTab] = useState<Tab>("courses");
  const { data: enrollments, isLoading: loadingEnrollments } = useListMyEnrollments({ query: { queryKey: getListMyEnrollmentsQueryKey() } });
  const { data: payments, isLoading: loadingOrders } = useGetPaymentHistory({ query: { queryKey: getGetPaymentHistoryQueryKey() } });
  const { data: myBundles, isLoading: loadingBundles } = useMyBundles();

  const totalCourses = enrollments?.length ?? 0;
  const completedCourses = enrollments?.filter(e => (e.progressPercent ?? 0) === 100).length ?? 0;
  const avgProgress = totalCourses > 0
    ? Math.round(enrollments!.reduce((s, e) => s + (e.progressPercent ?? 0), 0) / totalCourses)
    : 0;
  const totalSpent = payments?.filter(p => p.status === "completed").reduce((s, p) => s + Number(p.amount), 0) ?? 0;
  const bundleCount = myBundles?.length ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">

        {/* ── Page Header ── */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">My Learning</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Your enrolled courses, bundle packages, and order history — all in one place.</p>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3 mb-6 sm:mb-8">
          <StatCard icon={<BookOpen className="w-5 h-5" />} label="Enrolled Courses" value={totalCourses} />
          <StatCard icon={<Package className="w-5 h-5" />} label="Packages" value={bundleCount} sub={bundleCount > 0 ? `${myBundles!.reduce((s, b) => s + b.courses.length, 0)} courses included` : undefined} />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Avg. Progress" value={`${avgProgress}%`} />
          <StatCard icon={<BadgeIndianRupee className="w-5 h-5" />} label="Total Invested" value={`₹${totalSpent.toLocaleString("en-IN")}`} />
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 mb-6 bg-card border border-border rounded-xl p-1 w-full sm:w-fit">
          {[
            { id: "courses" as Tab, label: "My Courses", shortLabel: "Courses", icon: <BookOpen className="w-4 h-4" />, count: totalCourses },
            { id: "packages" as Tab, label: "My Packages", shortLabel: "Packages", icon: <Package className="w-4 h-4" />, count: bundleCount },
            { id: "orders" as Tab, label: "Order History", shortLabel: "Orders", icon: <CreditCard className="w-4 h-4" />, count: payments?.length ?? 0 },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 sm:flex-none flex items-center justify-center sm:justify-start gap-1.5 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                tab === t.id ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              <span className="sm:hidden">{t.shortLabel}</span>
              <span className="hidden sm:inline">{t.label}</span>
              {t.count > 0 && (
                <span className={`text-[10px] font-bold rounded-full px-1.5 py-0 hidden sm:inline ${tab === t.id ? "bg-white/20 text-white" : "bg-border text-muted-foreground"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── My Courses Tab ── */}
        {tab === "courses" && (
          <>
            {loadingEnrollments ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => <div key={i} className="h-72 bg-card rounded-2xl animate-pulse" />)}
              </div>
            ) : !enrollments || enrollments.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl py-20 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-2">No courses yet</h2>
                <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">Explore our catalog and start your learning journey.</p>
                <Button asChild className="bg-primary hover:bg-primary/90 gap-2">
                  <Link href="/courses"><BookOpen className="w-4 h-4" />Browse Courses</Link>
                </Button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {enrollments.map(e => <CourseCard key={e.id} e={e} />)}
              </div>
            )}
          </>
        )}

        {/* ── My Packages Tab ── */}
        {tab === "packages" && (
          <>
            {loadingBundles ? (
              <div className="space-y-4">
                {[1, 2].map(i => <div key={i} className="h-40 bg-card rounded-2xl animate-pulse" />)}
              </div>
            ) : !myBundles || myBundles.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl py-20 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-2">No packages yet</h2>
                <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
                  Get a package to access multiple courses at a discounted price.
                </p>
                <Button asChild className="bg-primary hover:bg-primary/90 gap-2">
                  <Link href="/courses"><Package className="w-4 h-4" />Browse Packages</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {myBundles.map(bundle => (
                  <BundleCard key={bundle.id} bundle={bundle} enrollments={enrollments ?? []} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Order History Tab ── */}
        {tab === "orders" && (
          <>
            {loadingOrders ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-card rounded-xl animate-pulse" />)}
              </div>
            ) : !payments || payments.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl py-20 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CreditCard className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold mb-2">No orders yet</h2>
                <p className="text-muted-foreground text-sm mb-6">Your purchase history will appear here.</p>
                <Button asChild className="bg-primary hover:bg-primary/90 gap-2">
                  <Link href="/courses"><BookOpen className="w-4 h-4" />Browse Courses</Link>
                </Button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border bg-background/50 hidden sm:flex items-center gap-4">
                  <div className="w-9 flex-shrink-0" />
                  <div className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Product</div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Amount</div>
                </div>
                {payments.map(p => <OrderRow key={p.id} p={p} />)}
                <div className="px-4 py-3 border-t border-border bg-background/30 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{payments.length} transaction{payments.length !== 1 ? "s" : ""}</span>
                  <div className="text-xs text-muted-foreground">
                    Total paid: <span className="font-bold text-foreground">
                      ₹{payments.filter(p => p.status === "completed").reduce((s, p) => s + Number(p.amount), 0).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
