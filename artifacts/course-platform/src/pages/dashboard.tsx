import { Link } from "wouter";
import { useGetAnalyticsSummary, getGetAnalyticsSummaryQueryKey, useListMyEnrollments, getListMyEnrollmentsQueryKey, useGetRecentActivity, getGetRecentActivityQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BookOpen, DollarSign, Users, TrendingUp } from "lucide-react";

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary } = useGetAnalyticsSummary({ query: { queryKey: getGetAnalyticsSummaryQueryKey() } });
  const { data: enrollments } = useListMyEnrollments({ query: { queryKey: getListMyEnrollmentsQueryKey() } });
  const { data: activity } = useGetRecentActivity({ limit: 5 }, { query: { queryKey: getGetRecentActivityQueryKey({ limit: 5 }) } });

  const stats = [
    { label: "Enrolled Courses", value: summary?.enrolledCourses ?? 0, icon: BookOpen, color: "text-blue-400" },
    { label: "Completed", value: summary?.completedCourses ?? 0, icon: TrendingUp, color: "text-green-400" },
    { label: "Total Spent", value: `$${(summary?.totalSpent ?? 0).toFixed(2)}`, icon: DollarSign, color: "text-yellow-400" },
    { label: "Affiliate Earnings", value: `$${(summary?.affiliateEarnings ?? 0).toFixed(2)}`, icon: Users, color: "text-purple-400" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.name?.split(" ")[0]}</h1>
          <p className="text-muted-foreground mt-1">Here's what's happening with your account.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map(stat => (
            <Card key={stat.label} className="bg-card border-border">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">My Courses</h2>
              <Button variant="ghost" size="sm" asChild><Link href="/my-courses">View all</Link></Button>
            </div>
            {!enrollments || enrollments.length === 0 ? (
              <Card className="bg-card border-border">
                <CardContent className="py-12 text-center">
                  <BookOpen className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground mb-4">No courses yet. Start learning today.</p>
                  <Button asChild><Link href="/courses">Browse Courses</Link></Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {enrollments.slice(0, 3).map(e => (
                  <Card key={e.id} className="bg-card border-border">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-medium">{e.course?.title}</h3>
                          <p className="text-xs text-muted-foreground">{e.course?.category} · {e.course?.level}</p>
                        </div>
                        <Badge variant="outline" className="text-xs">{e.progressPercent}%</Badge>
                      </div>
                      <Progress value={e.progressPercent} className="h-1.5" />
                      <div className="flex justify-end mt-3">
                        <Button size="sm" variant="ghost" asChild>
                          <Link href={`/learn/${e.courseId}`}>Continue &rarr;</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
            <div className="space-y-3">
              {!activity || activity.length === 0 ? (
                <Card className="bg-card border-border"><CardContent className="py-8 text-center text-sm text-muted-foreground">No recent activity</CardContent></Card>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="flex gap-3 p-3 rounded-lg bg-card border border-border">
                    <div className="mt-0.5">
                      <div className="w-2 h-2 rounded-full bg-primary mt-1" />
                    </div>
                    <div>
                      <p className="text-sm">{item.description}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{new Date(item.createdAt).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
              <p className="text-sm font-medium text-primary mb-1">Your referral code</p>
              <p className="font-mono font-bold text-lg tracking-widest">{user?.referralCode}</p>
              <Button size="sm" variant="ghost" className="mt-2 text-xs" asChild>
                <Link href="/affiliate">View affiliate dashboard &rarr;</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
