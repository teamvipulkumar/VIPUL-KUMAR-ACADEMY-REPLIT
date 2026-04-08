import { Link } from "wouter";
import { useListMyEnrollments, getListMyEnrollmentsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";

export default function MyCoursesPage() {
  const { data: enrollments, isLoading } = useListMyEnrollments({ query: { queryKey: getListMyEnrollmentsQueryKey() } });

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight mb-2">My Learning</h1>
        <p className="text-muted-foreground mb-8">Track your progress across all enrolled courses.</p>

        {isLoading ? (
          <div className="grid md:grid-cols-2 gap-6">{[1,2,3].map(i => <div key={i} className="h-48 bg-card rounded-xl animate-pulse" />)}</div>
        ) : !enrollments || enrollments.length === 0 ? (
          <Card className="bg-card border-border">
            <CardContent className="py-16 text-center">
              <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">No courses yet</h2>
              <p className="text-muted-foreground mb-6">Browse our catalog and start learning.</p>
              <Button asChild><Link href="/courses">Browse Courses</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
            {enrollments.map(e => (
              <Card key={e.id} className="bg-card border-border hover:border-primary/40 transition-all">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg">{e.course?.title}</h3>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{e.course?.category}</Badge>
                        <Badge variant="outline" className="text-xs capitalize">{e.course?.level}</Badge>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-2xl font-bold text-primary">{e.progressPercent}%</span>
                      <p className="text-xs text-muted-foreground">complete</p>
                    </div>
                  </div>
                  <Progress value={e.progressPercent} className="h-2 mb-4" />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Enrolled {new Date(e.enrolledAt).toLocaleDateString()}</p>
                    <Button size="sm" asChild>
                      <Link href={`/learn/${e.courseId}`}>{e.progressPercent === 0 ? "Start" : "Continue"} &rarr;</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
