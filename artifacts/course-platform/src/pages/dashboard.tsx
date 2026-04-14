import { Link } from "wouter";
import { useGetAnalyticsSummary, getGetAnalyticsSummaryQueryKey, useListMyEnrollments, getListMyEnrollmentsQueryKey, useGetRecentActivity, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, BadgeIndianRupee, Users, TrendingUp, Copy, Check } from "lucide-react";
import { useState } from "react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary } = useGetAnalyticsSummary({ query: { queryKey: getGetAnalyticsSummaryQueryKey() } });
  const { data: enrollments } = useListMyEnrollments({ query: { queryKey: getListMyEnrollmentsQueryKey() } });
  const { data: activity } = useGetRecentActivity({ limit: 5 }, { query: { queryKey: getGetRecentActivityQueryKey({ limit: 5 }) } });
  const [copied, setCopied] = useState(false);

  const stats = [
    { label: "Enrolled Courses", value: summary?.enrolledCourses ?? 0, icon: BookOpen, color: "text-blue-400" },
    { label: "Completed", value: summary?.completedCourses ?? 0, icon: TrendingUp, color: "text-green-400" },
    { label: "Total Spent", value: `₹${(summary?.totalSpent ?? 0).toFixed(2)}`, icon: BadgeIndianRupee, color: "text-yellow-400" },
    { label: "Affiliate Earnings", value: `₹${(summary?.affiliateEarnings ?? 0).toFixed(2)}`, icon: Users, color: "text-purple-400" },
  ];

  const copyCode = () => {
    if (user?.referralCode) {
      navigator.clipboard.writeText(user.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 md:py-10">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Welcome back, {user?.name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">Here's what's happening with your account.</p>
        </div>

        {/* Stats grid — 2 cols on mobile, 4 on lg */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-8 md:mb-10">
          {stats.map(stat => (
            <Card key={stat.label} className="bg-card border-border">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs md:text-sm text-muted-foreground leading-tight">{stat.label}</span>
                  <stat.icon className={`w-4 h-4 flex-shrink-0 ${stat.color}`} />
                </div>
                <div className="text-xl md:text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {/* Courses — full width on mobile, 2/3 on md */}
          <div className="md:col-span-2 order-2 md:order-1">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg md:text-xl font-semibold">My Courses</h2>
              <Button variant="ghost" size="sm" asChild><Link href="/my-courses">View all</Link></Button>
            </div>
            {!enrollments || enrollments.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-10 md:py-12 text-center">
                  <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4 text-sm">No courses yet. Start learning today.</p>
                  <Button asChild><Link href="/courses">Browse Courses</Link></Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3 md:space-y-4">
                {enrollments.slice(0, 3).map(e => (
                  <Card key={e.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3 gap-3">
                        <div className="min-w-0">
                          <h3 className="font-medium text-sm md:text-base truncate">{e.course?.title}</h3>
                          <p className="text-xs text-muted-foreground">{e.course?.category} · {e.course?.level}</p>
                        </div>
                        <Badge variant="outline" className="text-xs flex-shrink-0">{e.progressPercent}%</Badge>
                      </div>
                      <Progress value={e.progressPercent} className="h-1.5" />
                      <div className="flex justify-end mt-3">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/learn/${e.courseId}`}>Continue →</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Sidebar — shows first on mobile */}
          <div className="order-1 md:order-2 space-y-4 md:space-y-6">
            {/* Referral code */}
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-sm font-medium text-primary mb-2">Your referral code</p>
              <div className="flex items-center gap-2">
                <p className="font-mono font-bold text-lg tracking-widest flex-1">{user?.referralCode}</p>
                <button onClick={copyCode} className="text-primary hover:text-primary/80 transition-colors cursor-pointer">
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
              <Button size="sm" variant="ghost" className="mt-2 text-xs px-0 text-primary hover:text-primary/80" asChild>
                <Link href="/affiliate">View affiliate dashboard →</Link>
              </Button>
            </div>

            {/* Recent activity */}
            <div>
              <h2 className="text-lg md:text-xl font-semibold mb-3 md:mb-4">Recent Activity</h2>
              <div className="space-y-2 md:space-y-3">
                {!activity || activity.length === 0 ? (
                  <Card className="bg-card border-border"><CardContent className="py-6 text-center text-sm text-muted-foreground">No recent activity</CardContent></Card>
                ) : (
                  activity.map(item => (
                    <div key={item.id} className="flex gap-3 p-3 rounded-lg bg-card border border-border">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm leading-snug">{item.description}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{new Date(item.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
