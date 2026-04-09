import { useState } from "react";
import { Link } from "wouter";
import { useListMyEnrollments, getListMyEnrollmentsQueryKey, useGetPaymentHistory, getGetPaymentHistoryQueryKey } from "@workspace/api-client-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Play, CheckCircle2, Clock, TrendingUp,
  BadgeIndianRupee, ShoppingBag, ChevronRight, Layers,
  CheckCheck, AlertCircle, RotateCcw, Zap, Calendar,
  GraduationCap, CreditCard, Star
} from "lucide-react";

type Tab = "courses" | "orders";

const STATUS_META: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  completed: { label: "Paid", cls: "text-green-400 border-green-400/30 bg-green-400/10", icon: <CheckCircle2 className="w-3 h-3" /> },
  pending:   { label: "Pending", cls: "text-amber-400 border-amber-400/30 bg-amber-400/10", icon: <Clock className="w-3 h-3" /> },
  failed:    { label: "Failed", cls: "text-red-400 border-red-400/30 bg-red-400/10", icon: <AlertCircle className="w-3 h-3" /> },
  refunded:  { label: "Refunded", cls: "text-blue-400 border-blue-400/30 bg-blue-400/10", icon: <RotateCcw className="w-3 h-3" /> },
};

const GATEWAY_LABEL: Record<string, string> = {
  cashfree: "Cashfree",
  razorpay: "Razorpay",
  stripe: "Stripe",
  payu: "PayU",
  paytm: "Paytm",
};

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3.5">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-primary mt-0.5">{sub}</p>}
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
      {/* Thumbnail area */}
      <div className="relative h-36 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#2563eb22_0%,_transparent_60%)]" />
        <GraduationCap className="w-14 h-14 text-primary/30" />
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
        {/* Play overlay on hover */}
        <Link href={`/learn/${e.courseId}`}>
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center shadow-lg shadow-primary/40">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </Link>
      </div>

      {/* Content */}
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

        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-muted-foreground">Progress</span>
            <span className={`text-xs font-bold ${isDone ? "text-green-400" : "text-primary"}`}>{pct}%</span>
          </div>
          <Progress
            value={pct}
            className="h-1.5"
          />
        </div>

        {/* Footer */}
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

function OrderRow({ p }: { p: any }) {
  const meta = STATUS_META[p.status] ?? STATUS_META.pending;
  return (
    <div className="flex items-center gap-4 p-4 hover:bg-white/[0.02] transition-colors border-b border-border last:border-0">
      {/* Icon */}
      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
        <ShoppingBag className="w-4 h-4 text-primary" />
      </div>

      {/* Course info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{p.course?.title ?? `Course #${p.courseId}`}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[11px] text-muted-foreground capitalize">{GATEWAY_LABEL[p.gateway] ?? p.gateway}</span>
          <span className="text-muted-foreground/30">·</span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Calendar className="w-2.5 h-2.5" />
            {new Date(p.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* Amount */}
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

  const totalCourses = enrollments?.length ?? 0;
  const completedCourses = enrollments?.filter(e => (e.progressPercent ?? 0) === 100).length ?? 0;
  const avgProgress = totalCourses > 0
    ? Math.round(enrollments!.reduce((s, e) => s + (e.progressPercent ?? 0), 0) / totalCourses)
    : 0;
  const totalSpent = payments?.filter(p => p.status === "completed").reduce((s, p) => s + Number(p.amount), 0) ?? 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-10">

        {/* ── Page Header ── */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">My Learning</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Your enrolled courses and order history — all in one place.</p>
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard icon={<BookOpen className="w-5 h-5" />} label="Enrolled Courses" value={totalCourses} />
          <StatCard icon={<CheckCircle2 className="w-5 h-5" />} label="Completed" value={completedCourses} sub={totalCourses > 0 ? `${Math.round(completedCourses / totalCourses * 100)}% done` : undefined} />
          <StatCard icon={<TrendingUp className="w-5 h-5" />} label="Avg. Progress" value={`${avgProgress}%`} />
          <StatCard icon={<BadgeIndianRupee className="w-5 h-5" />} label="Total Invested" value={`₹${totalSpent.toLocaleString("en-IN")}`} />
        </div>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 mb-6 bg-card border border-border rounded-xl p-1 w-fit">
          {[
            { id: "courses" as Tab, label: "Enrolled Courses", icon: <BookOpen className="w-4 h-4" />, count: totalCourses },
            { id: "orders" as Tab, label: "Order History", icon: <CreditCard className="w-4 h-4" />, count: payments?.length ?? 0 },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.id
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.icon}
              {t.label}
              {t.count > 0 && (
                <span className={`text-[10px] font-bold rounded-full px-1.5 py-0 ${tab === t.id ? "bg-white/20 text-white" : "bg-border text-muted-foreground"}`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Enrolled Courses Tab ── */}
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
                <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
                  Explore our course catalog and start your learning journey today.
                </p>
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
                <p className="text-muted-foreground text-sm mb-6">
                  Your purchase history will appear here once you enroll in a course.
                </p>
                <Button asChild className="bg-primary hover:bg-primary/90 gap-2">
                  <Link href="/courses"><BookOpen className="w-4 h-4" />Browse Courses</Link>
                </Button>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl overflow-hidden">
                {/* Table header */}
                <div className="px-4 py-3 border-b border-border bg-background/50 hidden sm:flex items-center gap-4">
                  <div className="w-9 flex-shrink-0" />
                  <div className="flex-1 text-xs font-medium text-muted-foreground uppercase tracking-wide">Course</div>
                  <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide text-right">Amount</div>
                </div>
                {payments.map(p => <OrderRow key={p.id} p={p} />)}

                {/* Summary footer */}
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
