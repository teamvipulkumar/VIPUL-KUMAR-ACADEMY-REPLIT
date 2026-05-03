import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  BookOpen, TrendingUp, CheckCircle2, FileText,
  IndianRupee, ShoppingCart,
} from "lucide-react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CourseRow {
  id: number;
  title: string;
  thumbnailUrl: string | null;
  price: number;
  isPublished: boolean;
  salesCount: number;
  totalEarnings: number;
}

async function fetchCourses(): Promise<CourseRow[]> {
  const res = await fetch(`${API_BASE}/api/creator/courses`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load courses");
  return res.json();
}

const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function CreatorCoursesPage() {
  const { data, isLoading } = useQuery({ queryKey: ["creator-courses"], queryFn: fetchCourses });
  const courses = data ?? [];
  const totalCourses = courses.length;
  const published = courses.filter(c => c.isPublished).length;
  const totalSales = courses.reduce((a, c) => a + c.salesCount, 0);
  const totalEarn = courses.reduce((a, c) => a + c.totalEarnings, 0);
  const topEarn = Math.max(...courses.map(c => c.totalEarnings), 1);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
      {/* Hero header */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-5 md:p-6">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex items-start gap-3">
          <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">My Courses</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Courses assigned to you by the admin. You earn 25% of each sale (split equally across creators in a bundle).
            </p>
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={BookOpen}     color="blue"   label="Total Courses"   value={`${totalCourses}`}      sub="Assigned to you" />
        <StatCard icon={CheckCircle2} color="green"  label="Published"       value={`${published}`}         sub={`${totalCourses - published} draft${totalCourses - published === 1 ? "" : "s"}`} />
        <StatCard icon={ShoppingCart} color="violet" label="Total Sales"     value={`${totalSales}`}        sub="Across all courses" />
        <StatCard icon={TrendingUp}   color="amber"  label="Total Earnings"  value={fmt(totalEarn)}         sub="Lifetime commission" />
      </div>

      {/* Course grid */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading…</div>
      ) : courses.length === 0 ? (
        <div className="bg-card border border-border rounded-xl py-16 text-center">
          <BookOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm font-semibold text-foreground">No courses assigned yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
            Contact the admin to assign courses to your creator profile. Once assigned, sales will appear here automatically.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {courses.map(c => {
            const earnPct = (c.totalEarnings / topEarn) * 100;
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl overflow-hidden hover:border-primary/30 hover:shadow-md transition-all flex flex-col">
                {/* Thumbnail */}
                <div className="aspect-video bg-muted overflow-hidden relative">
                  {c.thumbnailUrl ? (
                    <img src={c.thumbnailUrl} alt={c.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-primary/30" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <PublishedPill published={c.isPublished} />
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="text-sm font-semibold line-clamp-2 mb-3 min-h-[2.5em]">{c.title}</h3>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <Stat icon={IndianRupee}  label="Price" value={fmt(c.price)} />
                    <Stat icon={ShoppingCart} label="Sales" value={`${c.salesCount}`} />
                  </div>

                  {/* Earnings highlight */}
                  <div className="mt-auto bg-primary/5 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Your Earnings</span>
                      <TrendingUp className="w-3 h-3 text-primary" />
                    </div>
                    <div className="text-lg font-bold text-primary">{fmt(c.totalEarnings)}</div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden mt-2">
                      <div
                        className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all"
                        style={{ width: `${earnPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─────────────── helpers ─────────────── */
function StatCard({
  icon: Icon, color, label, value, sub,
}: {
  icon: LucideIcon;
  color: "green" | "amber" | "blue" | "violet";
  label: string;
  value: string;
  sub?: string;
}) {
  const colorMap: Record<string, string> = {
    green:  "text-green-400  bg-green-500/10  border-green-500/30",
    amber:  "text-amber-400  bg-amber-500/10  border-amber-500/30",
    blue:   "text-blue-400   bg-blue-500/10   border-blue-500/30",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/30",
  };
  return (
    <div className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 hover:shadow-md transition-all">
      <div className={`w-9 h-9 rounded-lg border flex items-center justify-center ${colorMap[color]}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="mt-3 text-xl md:text-2xl font-bold tracking-tight">{value}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70 mt-1">{sub}</div>}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-md px-2.5 py-1.5">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
        <Icon className="w-3 h-3" />{label}
      </div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function PublishedPill({ published }: { published: boolean }) {
  return published ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/90 text-white backdrop-blur-sm shadow-sm">
      <CheckCircle2 className="w-2.5 h-2.5" />Live
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground backdrop-blur-sm shadow-sm">
      <FileText className="w-2.5 h-2.5" />Draft
    </span>
  );
}
